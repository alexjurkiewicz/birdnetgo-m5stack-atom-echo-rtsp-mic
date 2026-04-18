# Core-Split Audio Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move WiFi/RTP send from Core 1 to Core 0 so Core 1 is never blocked by WiFi latency, eliminating DMA overflow and the resulting audio clicks.

**Architecture:** Core 1 is a pure real-time producer: I2S capture → process → enqueue frame (non-blocking, drop on full). Core 0 is the consumer: dequeue frame → build RTP packet → WiFi send. A fixed pool of pre-allocated `AudioFrame` objects flows between cores via two FreeRTOS queues (`audioReadyQueue` and `audioFreePool`), eliminating dynamic allocation on the hot path. Socket ownership moves entirely to Core 0.

**Tech Stack:** ESP32 FreeRTOS (xQueueCreate, xQueueSend, xQueueReceive), Arduino WiFiClient, existing I2S PDM driver, platformio espressif32@6.13.0

---

## Root Cause

At 48 kHz with 6 DMA buffers × 180 samples, the DMA ring holds 22.5 ms of audio. `writeAll()` has a 50 ms timeout. When WiFi blocks Core 1 for >22.5 ms, DMA overflows: the oldest buffer is overwritten, producing corrupted samples that manifest as clicks in every BirdNET-Go 3-second analysis window.

---

## File Map

| File | Change |
|---|---|
| `src/esp32_rtsp_mic_birdnetgo.ino` | All changes — queue declarations, AudioFrame pool, Core 1 producer, Core 0 consumer, lifecycle updates |
| `CLAUDE.md` | Update socket ownership section to reflect Core 0 now owns socket |

---

## Task 1: Add AudioFrame pool and queue globals

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — add after line 25 (cross-core sync section)

### What we're adding

A pool of 4 pre-allocated frames. At 48 kHz / 3072 buffer: 4 × 6144 bytes = 24 KB. This leaves ~56 KB free heap at runtime (current usage ~80 KB free of ~320 KB). Core 1 grabs a free frame from `audioFreePool`, fills it, sends to `audioReadyQueue`. Core 0 reads from `audioReadyQueue`, sends RTP, returns frame to `audioFreePool`.

- [ ] **Step 1: Add AudioFrame struct and queue handles after line 25**

Find this block (lines 21–25):
```cpp
portMUX_TYPE logMux = portMUX_INITIALIZER_UNLOCKED;  // spinlock for log ring buffer
volatile bool stopStreamRequested = false;   // Core 0 asks Core 1 to stop
volatile bool streamCleanupDone = false;     // Core 1 confirms cleanup complete
SemaphoreHandle_t taskExitSemaphore = NULL;  // confirmed task exit
volatile bool core1OwnsLED = false;          // LED ownership flag
```

Replace with:
```cpp
portMUX_TYPE logMux = portMUX_INITIALIZER_UNLOCKED;  // spinlock for log ring buffer
volatile bool stopStreamRequested = false;   // Core 0 asks Core 1 to stop
volatile bool streamCleanupDone = false;     // Core 1 confirms cleanup complete
SemaphoreHandle_t taskExitSemaphore = NULL;  // confirmed task exit
volatile bool core1OwnsLED = false;          // LED ownership flag

// ================== INTER-CORE AUDIO QUEUE ==================
// Core 1 produces processed frames; Core 0 consumes and sends via WiFi.
// Fixed pool eliminates malloc on hot path; non-blocking enqueue drops frames
// rather than stalling Core 1 (DMA overflow prevention).
#define AUDIO_POOL_DEPTH 4

struct AudioFrame {
    int16_t* data;       // points into pre-allocated buffer
    uint16_t samples;    // number of valid samples
};

// Pre-allocated sample storage for the pool
static int16_t audioFrameStorage[AUDIO_POOL_DEPTH][DEFAULT_BUFFER_SIZE];
static AudioFrame audioFramePool[AUDIO_POOL_DEPTH];

QueueHandle_t audioReadyQueue = NULL;  // Core 1 → Core 0: filled frames
QueueHandle_t audioFreePool   = NULL;  // Core 0 → Core 1: empty frames
```

- [ ] **Step 2: Build and verify it compiles**

```bash
pio run 2>&1 | tail -20
```

Expected: `SUCCESS` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "feat: add AudioFrame pool and inter-core queue declarations"
```

---

## Task 2: Initialise queues and pool in setup()

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — inside `setup()`, after taskExitSemaphore creation

- [ ] **Step 1: Add queue initialisation after the taskExitSemaphore line**

Find this in `setup()` (around line 1318):
```cpp
    // Create task exit semaphore for confirmed Core 1 task shutdown
    taskExitSemaphore = xSemaphoreCreateBinary();
```

Replace with:
```cpp
    // Create task exit semaphore for confirmed Core 1 task shutdown
    taskExitSemaphore = xSemaphoreCreateBinary();

    // Initialise inter-core audio queues and free pool
    audioReadyQueue = xQueueCreate(AUDIO_POOL_DEPTH, sizeof(AudioFrame*));
    audioFreePool   = xQueueCreate(AUDIO_POOL_DEPTH, sizeof(AudioFrame*));
    for (int i = 0; i < AUDIO_POOL_DEPTH; i++) {
        audioFramePool[i].data    = audioFrameStorage[i];
        audioFramePool[i].samples = 0;
        AudioFrame* fp = &audioFramePool[i];
        xQueueSend(audioFreePool, &fp, 0);
    }
```

- [ ] **Step 2: Build**

```bash
pio run 2>&1 | tail -20
```

Expected: `SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "feat: initialise AudioFrame pool and queues in setup()"
```

---

## Task 3: Refactor Core 1 — remove sendRTPPacket, enqueue frames

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — `audioCaptureTask()`

### What changes

- Remove the two `malloc` calls for `captureBuffer` / `outputBuffer` — replace with one `captureBuffer` malloc (raw I2S) and frame checkout from `audioFreePool`.
- Remove `sendRTPPacket(*client, outputBuffer, samplesRead)` call.
- After audio processing, write into `frame->data`, set `frame->samples`, enqueue to `audioReadyQueue` (non-blocking, 0 timeout). If no free frame or queue full, drop and increment `audioPacketsDropped`.
- Remove all `client` / `streamClient` usage from `audioCaptureTask` — Core 1 no longer touches the socket.
- Remove the RTSP command check block at the bottom of the loop (moved to Core 0).
- Keep all audio processing (DC blocker, HPF, gain, AGC, metering, LED) unchanged.

- [ ] **Step 1: Replace audioCaptureTask buffer allocation (lines 707–717)**

Find:
```cpp
    int16_t* captureBuffer = (int16_t*)malloc(currentBufferSize * sizeof(int16_t));
    int16_t* outputBuffer = (int16_t*)malloc(currentBufferSize * sizeof(int16_t));

    if (!captureBuffer || !outputBuffer) {
        Serial.println("[Core1] FATAL: Failed to allocate audio buffers!");
        if (captureBuffer) free(captureBuffer);
        if (outputBuffer) free(outputBuffer);
        audioTaskRunning = false;
        vTaskDelete(NULL);
        return;
    }
```

Replace with:
```cpp
    int16_t* captureBuffer = (int16_t*)malloc(currentBufferSize * sizeof(int16_t));

    if (!captureBuffer) {
        Serial.println("[Core1] FATAL: Failed to allocate capture buffer!");
        audioTaskRunning = false;
        vTaskDelete(NULL);
        return;
    }
```

- [ ] **Step 2: Remove client variable and stopStreamRequested cleanup from audioCaptureTask**

The stop-stream handler (lines 733–748) currently calls `client->stop()` and clears `streamClient`. Under the new model, Core 1 never owns the socket. Replace that block:

Find:
```cpp
        // Check if Core 0 requested us to stop streaming
        if (stopStreamRequested) {
            WiFiClient* client = streamClient;
            if (client) {
                client->stop();
            }
            streamClient = NULL;
            isStreaming = false;
            core1OwnsLED = false;
            streamCleanupDone = true;
            __asm__ __volatile__("memw" ::: "memory");
            // Wait for Core 0 to clear stopStreamRequested
            while (stopStreamRequested && audioTaskRunning) {
                vTaskDelay(pdMS_TO_TICKS(10));
            }
            continue;
        }
```

Replace with:
```cpp
        // Check if Core 0 requested us to stop streaming
        if (stopStreamRequested) {
            isStreaming = false;
            core1OwnsLED = false;
            streamCleanupDone = true;
            __asm__ __volatile__("memw" ::: "memory");
            while (stopStreamRequested && audioTaskRunning) {
                vTaskDelay(pdMS_TO_TICKS(10));
            }
            continue;
        }
```

- [ ] **Step 3: Remove streamClient check and WiFiClient* local variable**

Find:
```cpp
        if (!isStreaming || !streamClient) {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }

        WiFiClient* client = streamClient;
```

Replace with:
```cpp
        if (!isStreaming) {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }
```

- [ ] **Step 4: Replace sendRTPPacket call and RTSP command block with queue enqueue**

Find (near end of the main loop body):
```cpp
        // Send RTP packet
        sendRTPPacket(*client, outputBuffer, samplesRead);
        packetCount++;

        // Process incoming RTSP commands during streaming (~every 200ms)
        // Keeps all socket I/O on Core 1 during streaming
        static unsigned long lastRtspCheck = 0;
        if (client && isStreaming && (millis() - lastRtspCheck > 200)) {
            lastRtspCheck = millis();
            if (client->available() > 0) {
                char rtspBuf[512];
                int avail = client->available();
                if (avail > (int)sizeof(rtspBuf) - 1) avail = sizeof(rtspBuf) - 1;
                int n = client->read((uint8_t*)rtspBuf, avail);
                if (n > 0) {
                    rtspBuf[n] = '\0';
                    // Parse for RTSP commands
                    if (strstr(rtspBuf, "TEARDOWN") != NULL) {
                        // Extract CSeq
                        const char* cseqStr = strstr(rtspBuf, "CSeq: ");
                        int cseqVal = 1;
                        if (cseqStr) cseqVal = atoi(cseqStr + 6);
                        // Send response (Core 1 owns the socket)
                        char resp[128];
                        int rlen = snprintf(resp, sizeof(resp),
                            "RTSP/1.0 200 OK\r\nCSeq: %d\r\n\r\n", cseqVal);
                        client->write((uint8_t*)resp, rlen);
                        // Close and clean up
                        client->stop();
                        streamClient = NULL;
                        isStreaming = false;
                        core1OwnsLED = false;
                        Serial.println("[Core1] TEARDOWN received, stream stopped");
                    } else if (strstr(rtspBuf, "GET_PARAMETER") != NULL) {
                        const char* cseqStr = strstr(rtspBuf, "CSeq: ");
                        int cseqVal = 1;
                        if (cseqStr) cseqVal = atoi(cseqStr + 6);
                        char resp[128];
                        int rlen = snprintf(resp, sizeof(resp),
                            "RTSP/1.0 200 OK\r\nCSeq: %d\r\n\r\n", cseqVal);
                        client->write((uint8_t*)resp, rlen);
                        lastRTSPActivity = millis();
                    }
                    // Other commands silently discarded
                }
            }
        }
```

Replace with:
```cpp
        // Enqueue processed frame for Core 0 to send via WiFi
        {
            AudioFrame* frame = NULL;
            if (xQueueReceive(audioFreePool, &frame, 0) == pdTRUE) {
                memcpy(frame->data, outputBuffer, samplesRead * sizeof(int16_t));
                frame->samples = samplesRead;
                if (xQueueSend(audioReadyQueue, &frame, 0) != pdTRUE) {
                    // Queue full — return frame to pool, drop this packet
                    xQueueSend(audioFreePool, &frame, 0);
                    audioPacketsDropped++;
                } else {
                    packetCount++;
                }
            } else {
                // No free frame — pool exhausted, drop
                audioPacketsDropped++;
            }
        }
```

- [ ] **Step 5: Fix the outputBuffer reference — replace with local stack or pool-free buffer**

Since `outputBuffer` was previously malloc'd and is now gone, we need to write into a temporary. After captureBuffer malloc, add:

Find:
```cpp
    int16_t* captureBuffer = (int16_t*)malloc(currentBufferSize * sizeof(int16_t));

    if (!captureBuffer) {
        Serial.println("[Core1] FATAL: Failed to allocate capture buffer!");
        audioTaskRunning = false;
        vTaskDelete(NULL);
        return;
    }
```

Replace with:
```cpp
    int16_t* captureBuffer = (int16_t*)malloc(currentBufferSize * sizeof(int16_t));
    int16_t* outputBuffer  = (int16_t*)malloc(currentBufferSize * sizeof(int16_t));

    if (!captureBuffer || !outputBuffer) {
        Serial.println("[Core1] FATAL: Failed to allocate audio buffers!");
        free(captureBuffer);
        free(outputBuffer);
        audioTaskRunning = false;
        vTaskDelete(NULL);
        return;
    }
```

(We keep `outputBuffer` as a local working buffer; only the enqueue step copies into the pool frame. This avoids writing directly into pool storage while processing is still running.)

- [ ] **Step 6: Fix free at task exit — restore outputBuffer free**

Find:
```cpp
    free(captureBuffer);
    free(outputBuffer);
```

This should already exist at task exit. Verify it's still present — if Step 1 removed `outputBuffer`, the free will be a compile error. After Step 5 restores the malloc, this is correct again.

- [ ] **Step 7: Build**

```bash
pio run 2>&1 | tail -30
```

Expected: `SUCCESS` with no errors. Key things to check: no `outputBuffer` undeclared, no `client` undeclared.

- [ ] **Step 8: Commit**

```bash
git add src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "feat: Core 1 becomes pure audio producer, enqueues frames via FreeRTOS queue"
```

---

## Task 4: Add Core 0 consumer — dequeue and send RTP

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — `loop()` function

### What changes

In `loop()`, after `webui_handleClient()`, add a drain loop that dequeues all ready frames from `audioReadyQueue` and calls `sendRTPPacket()`. The drain runs on every `loop()` iteration (no throttle needed — frames only arrive at ~15.6/s at 48 kHz/3072).

`sendRTPPacket()` currently mutates `audioData` in-place (byte-swap). Since we now pass pool frames, we must return the frame to `audioFreePool` after sending. Add a wrapper `sendFrameRTP()` that handles this.

`WRITE_TIMEOUT_MS` can be increased to 200 ms — Core 1 is now immune to WiFi blocking.

- [ ] **Step 1: Update WRITE_TIMEOUT_MS in writeAll()**

Find:
```cpp
    const unsigned long WRITE_TIMEOUT_MS = 50;  // 50ms timeout - balance between responsiveness and stability
```

Replace with:
```cpp
    const unsigned long WRITE_TIMEOUT_MS = 200;  // Core 0 can afford longer timeout — Core 1 is never blocked
```

- [ ] **Step 2: Add sendFrameRTP() before loop()**

Find the comment line before `loop()`:
```cpp
void loop() {
```

Insert before it:
```cpp
// Dequeue one audio frame, send as RTP, return frame to pool.
// Called from Core 0 loop() only — Core 0 owns rtspClient exclusively.
static void sendFrameRTP() {
    AudioFrame* frame = NULL;
    if (xQueueReceive(audioReadyQueue, &frame, 0) != pdTRUE) return;

    if (isStreaming && rtspClient && rtspClient.connected()) {
        sendRTPPacket(rtspClient, frame->data, frame->samples);
    } else {
        audioPacketsDropped++;
    }

    xQueueSend(audioFreePool, &frame, 0);
}

```

- [ ] **Step 3: Add drain call at the top of loop(), after webui_handleClient()**

Find:
```cpp
    webui_handleClient();

    if (millis() - lastTempCheck > 60000) { // 1 min
```

Replace with:
```cpp
    webui_handleClient();

    // Drain audio frames from Core 1 and send via WiFi (Core 0 owns socket)
    {
        int drained = 0;
        while (uxQueueMessagesWaiting(audioReadyQueue) > 0 && drained < AUDIO_POOL_DEPTH) {
            sendFrameRTP();
            drained++;
        }
    }

    if (millis() - lastTempCheck > 60000) { // 1 min
```

- [ ] **Step 4: Fix sendRTPPacket — remove Core 1 socket ownership assumptions**

`sendRTPPacket()` currently closes `streamClient` and clears `isStreaming` on failure. Under the new model, Core 0 owns the socket directly via `rtspClient` (not via `streamClient` pointer). Update `sendRTPPacket()`:

Find:
```cpp
void sendRTPPacket(WiFiClient &client, int16_t* audioData, int numSamples) {
    if (!client.connected()) {
        // Client disconnected — Core 1 owns the socket, close it
        client.stop();
        streamClient = NULL;
        isStreaming = false;
        core1OwnsLED = false;
        return;
    }
```

Replace with:
```cpp
void sendRTPPacket(WiFiClient &client, int16_t* audioData, int numSamples) {
    if (!client.connected()) {
        isStreaming = false;
        core1OwnsLED = false;
        return;
    }
```

Find (inside `sendRTPPacket`, failure path):
```cpp
        if (consecutiveWriteFailures >= MAX_WRITE_FAILURES) {
            // Sustained failure — Core 1 owns the socket, close it
            Serial.printf("[Core1] %u consecutive write failures, disconnecting\n", consecutiveWriteFailures);
            consecutiveWriteFailures = 0;
            client.stop();
            streamClient = NULL;
            isStreaming = false;
            core1OwnsLED = false;
        }
```

Replace with:
```cpp
        if (consecutiveWriteFailures >= MAX_WRITE_FAILURES) {
            Serial.printf("[Core0] %u consecutive write failures, disconnecting\n", consecutiveWriteFailures);
            consecutiveWriteFailures = 0;
            isStreaming = false;
            core1OwnsLED = false;
        }
```

- [ ] **Step 5: Build**

```bash
pio run 2>&1 | tail -30
```

Expected: `SUCCESS`.

- [ ] **Step 6: Commit**

```bash
git add src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "feat: Core 0 drains audio queue and sends RTP, WRITE_TIMEOUT_MS 50→200ms"
```

---

## Task 5: Fix streaming lifecycle — socket ownership moves to Core 0

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

### What changes

`streamClient` was the pointer Core 0 passed to Core 1. It's now unused — Core 0 sends directly via `rtspClient`. Remove all `streamClient` assignments. `requestStreamStop()` no longer needs to wait for Core 1 to close the socket — Core 1 never had the socket.

- [ ] **Step 1: Simplify requestStreamStop()**

Find the full `requestStreamStop()` function and replace with:
```cpp
bool requestStreamStop(const char* reason) {
    if (!isStreaming) return true;

    Serial.printf("[Core0] requestStreamStop: %s\n", reason);

    stopStreamRequested = true;
    __asm__ __volatile__("memw" ::: "memory");

    unsigned long deadline = millis() + 3000;
    while (!streamCleanupDone && millis() < deadline) {
        vTaskDelay(pdMS_TO_TICKS(10));
    }

    bool clean = streamCleanupDone;
    isStreaming = false;
    stopStreamRequested = false;
    streamCleanupDone = false;

    // Core 0 owns the socket — close it here
    if (rtspClient && rtspClient.connected()) {
        rtspClient.stop();
    }

    if (!clean) {
        Serial.printf("[Core0] WARNING: Stream stop timeout, forced: %s\n", reason);
    } else {
        Serial.printf("[Core0] Stream stopped cleanly: %s\n", reason);
    }
    return clean;
}
```

- [ ] **Step 2: Remove streamClient assignment in handleRTSPCommand PLAY handler**

Find (in `handleRTSPCommand`, PLAY branch):
```cpp
        // Hand off client to Core 1 via pointer
        streamClient = &rtspClient;
        isStreaming = true;
```

Replace with:
```cpp
        isStreaming = true;
```

- [ ] **Step 3: Remove streamClient global and the WiFiClient* volatile declaration**

Find:
```cpp
// Pointer handoff: Core 0 sets on PLAY, Core 1 uses for streaming, clears on failure
WiFiClient* volatile streamClient = NULL;
```

Remove that line entirely (delete it).

- [ ] **Step 4: Build and check for remaining streamClient references**

```bash
pio run 2>&1 | tail -30
```

If there are `streamClient` undeclared errors, grep and remove each remaining use:

```bash
grep -n "streamClient" src/esp32_rtsp_mic_birdnetgo.ino
```

Fix each remaining reference — they should all be removable since Core 1 no longer touches the socket.

- [ ] **Step 5: Build clean**

```bash
pio run 2>&1 | tail -10
```

Expected: `SUCCESS`, no warnings about unused variables.

- [ ] **Step 6: Commit**

```bash
git add src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "feat: remove streamClient pointer, Core 0 exclusively owns rtspClient socket"
```

---

## Task 6: Handle TEARDOWN and GET_PARAMETER on Core 0

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — `processRTSP()` / `handleRTSPCommand()`

### What changes

The Core 1 RTSP command check block was removed in Task 3. TEARDOWN and GET_PARAMETER during streaming must now be handled on Core 0 via `processRTSP()`. Currently `processRTSP()` is only called when `!isStreaming`. We need to also call it (or a subset) during streaming.

- [ ] **Step 1: Call processRTSP during streaming in loop()**

Find in `loop()`:
```cpp
            // Phase: RTSP negotiation (only when not streaming)
            if (rtspClient && rtspClient.connected()) {
                processRTSP(rtspClient);
            }
```

Replace with:
```cpp
            // Phase: RTSP negotiation (only when not streaming)
            if (rtspClient && rtspClient.connected()) {
                processRTSP(rtspClient);
            }
        } else {
            // During streaming, still process RTSP commands (TEARDOWN, GET_PARAMETER)
            if (rtspClient && rtspClient.connected()) {
                processRTSP(rtspClient);
            }
```

Wait — look at the surrounding structure. The current `loop()` RTSP block is:

```cpp
        if (!isStreaming) {
            if (!rtspClient || !rtspClient.connected()) {
                // ... accept new client
            }
            // Phase: RTSP negotiation (only when not streaming)
            if (rtspClient && rtspClient.connected()) {
                processRTSP(rtspClient);
            }
        }
```

Change to:
```cpp
        if (!isStreaming) {
            if (!rtspClient || !rtspClient.connected()) {
                WiFiClient newClient = rtspServer.available();
                if (newClient) {
                    rtspClient = newClient;
                    rtspClient.setNoDelay(true);
                    rtspParseBufferPos = 0;
                    lastRTSPActivity = millis();
                    lastRtspClientConnectMs = millis();
                    rtspConnectCount++;
                    simplePrintln("New RTSP client connected");
                }
            }
        }

        // RTSP command processing: pre-stream negotiation and in-stream commands
        // (TEARDOWN, GET_PARAMETER). Now safe on Core 0 — Core 0 owns the socket.
        if (rtspClient && rtspClient.connected()) {
            processRTSP(rtspClient);
        }
```

This removes the `!isStreaming` guard from `processRTSP` so TEARDOWN is handled during streaming.

- [ ] **Step 2: Build**

```bash
pio run 2>&1 | tail -20
```

Expected: `SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "feat: handle RTSP TEARDOWN/GET_PARAMETER on Core 0 during streaming"
```

---

## Task 7: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Socket Ownership section**

Find:
```
### Socket Ownership Model
- Core 1 exclusively owns the WiFiClient socket during streaming
- Core 0 must never touch the socket while streaming is active
- Use `requestStreamStop()` for Core 0 to signal Core 1 to stop — never close the socket from Core 0
- Task shutdown uses a FreeRTOS semaphore with 2s timeout (confirmed exit pattern)
```

Replace with:
```
### Socket Ownership Model
- Core 0 exclusively owns the WiFiClient (`rtspClient`) at all times
- Core 1 never touches the socket — it only enqueues processed AudioFrame pointers to `audioReadyQueue`
- Use `requestStreamStop()` for Core 0 to signal Core 1 to stop producing frames; Core 0 then closes the socket
- Task shutdown uses a FreeRTOS semaphore with 2s timeout (confirmed exit pattern)
```

- [ ] **Step 2: Update the architecture comment**

Find:
```
// ================== DUAL-CORE AUDIO ARCHITECTURE ==================
// Core 1: Complete audio pipeline (I2S → process → RTP → WiFi)
// Core 0: Web UI, diagnostics, RTSP protocol, client management
```

Replace with:
```
// ================== DUAL-CORE AUDIO ARCHITECTURE ==================
// Core 1: Real-time audio producer (I2S → process → enqueue AudioFrame)
// Core 0: Consumer + sender (dequeue AudioFrame → RTP → WiFi) + Web UI + RTSP
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "docs: update CLAUDE.md socket ownership and architecture for Core 0 sender model"
```

---

## Task 8: Flash and verify

- [ ] **Step 1: Build final firmware**

```bash
pio run 2>&1 | tail -20
```

Expected: `SUCCESS`.

- [ ] **Step 2: Upload**

```bash
pio run --target upload 2>&1 | tail -20
```

- [ ] **Step 3: Monitor serial for 30 seconds after boot**

```bash
pio device monitor -b 115200 2>&1 | head -60
```

Expected output sequence:
- `=== ESP32 RTSP Mic Starting ===`
- `I2S ready (PDM mode): 48000Hz`
- `mDNS: atomecho.local` (or configured hostname)
- `RTSP server ready on port 8554`

- [ ] **Step 4: Connect VLC and check for clicking**

```bash
vlc --rtsp-tcp rtsp://atomecho.local:8554/audio
```

Listen for 60 seconds. Expected: no audible clicks. If clicks remain, open serial monitor and check for `audioPacketsDropped` increasing — if Core 0 queue is draining fast enough, drops should be near zero.

- [ ] **Step 5: Check packet stats in Web UI**

Open `http://atomecho.local/` → check that packet drop rate is low (< 1%).

Expected packet rate: ~15.6 pkt/s at 48 kHz / 3072 buffer.

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| Core 1 never blocks on WiFi | Task 3 (remove sendRTPPacket from Core 1) |
| FreeRTOS queue for inter-core transfer (CLAUDE.md rule) | Task 1, 2 |
| Core 0 drains queue and sends RTP | Task 4 |
| Socket owned exclusively by Core 0 | Task 5 |
| TEARDOWN handled during streaming | Task 6 |
| WRITE_TIMEOUT_MS can increase safely | Task 4, Step 1 |
| CLAUDE.md updated | Task 7 |
| Verified on hardware | Task 8 |

### No placeholder scan

All code blocks contain complete, compilable code. No "TBD" or "similar to above" references.

### Type consistency

- `AudioFrame*` used consistently throughout
- `audioReadyQueue` / `audioFreePool` declared in Task 1, initialised in Task 2, used in Tasks 3 and 4
- `sendFrameRTP()` calls `sendRTPPacket(rtspClient, ...)` — matches existing signature `void sendRTPPacket(WiFiClient &client, int16_t*, int)`
- `AUDIO_POOL_DEPTH` defined once, used in Tasks 1, 2, and 4
