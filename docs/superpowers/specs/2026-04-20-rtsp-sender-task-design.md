# Design: Dedicated RTSP Sender Task

**Date:** 2026-04-20
**Status:** Approved

## Problem

When BirdNET-Go (the RTSP client) stops consuming data, the ESP32's HTTP web server
becomes unresponsive within 1–2 minutes. Root cause: `sendFrameRTP()` is called from
`loop()`, and `writeAll()` blocks up to 2s per call when the TCP send window closes.
`webui_handleClient()` never runs during that time. Additionally, `SO_SNDTIMEO` is
silently bypassed because `writeAll()` currently uses `MSG_DONTWAIT` to work around
Arduino's internal retry loop — making the timeout ineffective.

## Design Priority

Stream stability is the primary goal. HTTP web server responsiveness is secondary.

## Solution: Dedicated RTSP Sender Task on Core 1

Move all RTSP/RTP work out of `loop()` into a dedicated FreeRTOS task that runs on
Core 1. The sender task fully owns the socket from PLAY until stream end. `loop()`
becomes HTTP + pre-PLAY RTSP negotiation only.

## Task Architecture

```
Core 0: loop()
  - webui_handleClient()
  - RTSP negotiation: OPTIONS → DESCRIBE → SETUP → PLAY response
  - Accepts client, sets SO_SNDTIMEO, launches tasks on PLAY
  - Diagnostics, WiFi health, overheat, scheduled reset (unchanged)

Core 1: audioCaptureTask   (priority 10)
  - I2S → DC blocker → HPF → gain → AGC → enqueue AudioFrame* to audioReadyQueue
  - Created on PLAY, destroyed after sender exits
  - No idle loop — runs flat-out until vTaskDelete

Core 1: rtspSenderTask     (priority 9)
  - Owns rtspClient from PLAY until stream end
  - select() loop: RTSP control reads + RTP frame writes
  - On exit: closes socket, gives taskExitSemaphore, calls vTaskDelete(NULL)
```

Priority 9 < 10 ensures `audioCaptureTask` preempts the sender when both are runnable,
so DMA reads are never delayed by a blocked write. The queue absorbs brief gaps.

Both tasks are created together on PLAY and destroyed together on stream end — they
share a lifetime.

## Socket Handoff

`loop()` owns `rtspClient` through the SETUP/PLAY negotiation. On PLAY:

1. `loop()` sends the PLAY response (still owns socket)
2. `loop()` calls `xTaskCreatePinnedToCore(rtspSenderTask, ..., core=1)` and
   `xTaskCreatePinnedToCore(audioCaptureTask, ..., core=1)`
3. Sender task receives `rtspClient` via the existing global — no struct needed
4. `loop()` sets `rtspSenderTaskHandle` and stops touching `rtspClient`

After handoff, `loop()` does not read, write, or close `rtspClient` until the sender
task exits and `taskExitSemaphore` is taken.

## Sender Task Inner Loop

```
while (!stopStreamRequested) {
    fd_set rfds, wfds;
    FD_ZERO(&rfds); FD_ZERO(&wfds);
    FD_SET(sock, &rfds);  // always watch for RTSP control

    bool frameReady = (xQueuePeek(audioReadyQueue, &frame, 0) == pdTRUE);
    if (frameReady) FD_SET(sock, &wfds);

    struct timeval tv = {0, 100000};  // 100ms
    select(sock + 1, &rfds, frameReady ? &wfds : NULL, NULL, &tv);

    if (FD_ISSET(sock, &rfds))  → readRTSPControl()  // TEARDOWN → exit; GET_PARAMETER → 200 OK
    if (FD_ISSET(sock, &wfds))  → dequeue frame, sendRTPPacket(), return to pool
}
```

- Blocks in `select()` when no frame is ready and socket is quiet — no busy-spin
- TEARDOWN is always responsive: readable fd is always watched
- `SO_SNDTIMEO` now works correctly: sender calls blocking `send()` (no `MSG_DONTWAIT`)

## writeAll() Simplification

With `SO_SNDTIMEO` effective in task context, `writeAll()` becomes a straightforward
blocking `send()` loop:

```cpp
static bool writeAll(int sock, const uint8_t* data, size_t len) {
    size_t off = 0;
    while (off < len) {
        int w = send(sock, data + off, len - off, 0);  // blocking, timeout from SO_SNDTIMEO
        if (w <= 0) return false;  // timeout or broken pipe
        off += w;
    }
    return true;
}
```

The existing `MSG_DONTWAIT` retry logic, the `select()` inside `writeAll()`, and the
dead-code `consecutiveWriteFailures` block are all removed.

## Removed State

| Removed | Replaced by |
|---|---|
| `volatile bool isStreaming` | `rtspSenderTaskHandle != NULL` |
| `volatile bool streamCleanupDone` | `taskExitSemaphore` alone is sufficient |
| `volatile bool stopStreamRequested` | kept — signals sender to exit cleanly |
| `sendFrameRTP()` | absorbed into sender task loop |
| `processRTSP()` called from `loop()` during streaming | moved into sender task |

`audioCaptureTask` idle loop (the `if (!isStreaming) vTaskDelay` block) is removed —
the task runs from creation to deletion, no streaming flag needed.

## Shutdown Coordination

**Sender-initiated exit** (write failure, TEARDOWN):
1. Sender closes socket, gives `senderExitSemaphore`, calls `vTaskDelete(NULL)`
2. `loop()` takes `senderExitSemaphore`, calls `stopAudioCaptureTask()` (which sets
   `audioTaskRunning = false` and waits on the existing `taskExitSemaphore` for
   confirmed capture exit), clears `rtspSenderTaskHandle`, resets `rtspParseBufferPos`,
   updates LED, logs session stats

**External stop** (overheat, WiFi disconnect, settings change via `requestStreamStop()`):
1. Caller sets `stopStreamRequested = true` + `memw` barrier
2. Sender detects flag in its loop, closes socket, gives `senderExitSemaphore`, exits
3. Caller waits on `senderExitSemaphore` (2s timeout), then calls `stopAudioCaptureTask()`

`requestStreamStop()` simplifies: set flag, wait on `senderExitSemaphore`, call
`stopAudioCaptureTask()`, clear handle. No `streamCleanupDone` handshake.

Two semaphores are needed to avoid a race:
- `senderExitSemaphore` — given by sender task on exit, taken by loop() or requestStreamStop()
- `taskExitSemaphore` — given by audioCaptureTask on exit, taken by stopAudioCaptureTask()

Using a single binary semaphore for both would lose a give if capture exits before sender.

## loop() After Refactor

`loop()` retains:
- `webui_handleClient()`
- RTSP client accept + negotiation (OPTIONS → DESCRIBE → SETUP → PLAY)
- `taskExitSemaphore` poll (zero-timeout tryTake) to detect sender exit and log stats
- All diagnostics: temperature, heap, performance, WiFi health, scheduled reset

`loop()` removes:
- `sendFrameRTP()` call
- `processRTSP()` call during streaming (sender owns it post-PLAY)
- `wasStreaming` / `isStreaming` disconnect detection block

## What Does Not Change

- `audioCaptureTask` DSP logic — untouched
- `audioReadyQueue` / `audioFreePool` queue structure and pool depth — untouched
- RTSP negotiation flow in `handleRTSPCommand()` — untouched
- `setup_i2s_driver()`, HPF coefficients, all settings — untouched
- WebUI, diagnostics endpoints — untouched (use handle check instead of `isStreaming`)

## SRAM Impact

No change to audio frame pool size (4 frames × 9,600 samples × 2 bytes = 76.8 KB).
Sender task stack: 8 KB (matches audioCaptureTask — RTSP parsing uses Arduino String
operations which need headroom). Net SRAM delta: +8 KB stack for sender task.
