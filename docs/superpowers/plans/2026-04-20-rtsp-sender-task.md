# RTSP Sender Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all RTSP/RTP work out of `loop()` into a dedicated FreeRTOS task on Core 1, so a stalled BirdNET-Go client can never block the HTTP web server.

**Architecture:** A new `rtspSenderTask` runs on Core 1 at priority 9 (below `audioCaptureTask` at 10). It owns `rtspClient` exclusively from PLAY until stream end, drives a `select()` loop to multiplex RTSP control reads and RTP frame writes, and exits cleanly on write timeout, TEARDOWN, or external stop request. `loop()` handles only HTTP and pre-PLAY RTSP negotiation.

**Tech Stack:** ESP32 Arduino / FreeRTOS, lwIP sockets (`sys/socket.h`), PlatformIO (`pio run`, `pio run --target upload`, `pio device monitor -b 115200`)

---

## File Map

| File | Changes |
|---|---|
| `src/esp32_rtsp_mic_birdnetgo.ino` | All firmware changes — new globals, rewritten functions, new task |
| `src/WebUI.cpp` | Replace `isStreaming` extern with `rtspSenderTaskHandle` |

---

### Task 1: Add new globals and semaphore; initialize in setup()

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino:18-26` (global declarations block)
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino:1391` (setup() semaphore init)

- [ ] **Step 1: Add `senderExitSemaphore` and `rtspSenderTaskHandle` to the globals block**

Find this block (around line 18):
```cpp
TaskHandle_t audioCaptureTaskHandle = NULL;
volatile bool audioTaskRunning = false;

// Cross-core synchronization primitives
portMUX_TYPE logMux = portMUX_INITIALIZER_UNLOCKED;  // spinlock for log ring buffer
volatile bool stopStreamRequested = false;   // Core 0 asks Core 1 to stop
volatile bool streamCleanupDone = false;     // Core 1 confirms cleanup complete
SemaphoreHandle_t taskExitSemaphore = NULL;  // confirmed task exit
volatile bool core1OwnsLED = false;          // LED ownership flag
```

Replace with:
```cpp
TaskHandle_t audioCaptureTaskHandle = NULL;
volatile bool audioTaskRunning = false;
TaskHandle_t rtspSenderTaskHandle = NULL;

// Cross-core synchronization primitives
portMUX_TYPE logMux = portMUX_INITIALIZER_UNLOCKED;  // spinlock for log ring buffer
volatile bool stopStreamRequested = false;   // Core 0 signals sender task to stop
SemaphoreHandle_t senderExitSemaphore = NULL; // sender task confirmed exit
SemaphoreHandle_t taskExitSemaphore = NULL;  // audioCaptureTask confirmed exit
volatile bool core1OwnsLED = false;          // LED ownership flag
```

- [ ] **Step 2: Initialize `senderExitSemaphore` in setup()**

Find this line in setup() (around line 1391):
```cpp
taskExitSemaphore = xSemaphoreCreateBinary();
```

Replace with:
```cpp
taskExitSemaphore = xSemaphoreCreateBinary();
senderExitSemaphore = xSemaphoreCreateBinary();
```

- [ ] **Step 3: Build to verify no compile errors**

```bash
pio run
```
Expected: `SUCCESS` with no errors. The removed `streamCleanupDone` will cause errors if references remain — those are fixed in later tasks. If errors appear here, add a temporary `volatile bool streamCleanupDone = false;` placeholder and remove it in Task 9.

---

### Task 2: Rewrite `writeAll()` and make `sendRTPPacket()` return bool

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino:1109-1217` (`writeAll` and `sendRTPPacket`)

`SO_SNDTIMEO` only works with blocking `send()`. The current `MSG_DONTWAIT` approach bypasses it. With the sender running in its own task, blocking is safe.

- [ ] **Step 1: Replace `writeAll()` with a blocking version**

Find the entire `writeAll` function (starts around line 1109):
```cpp
static bool writeAll(WiFiClient &client, const uint8_t* data, size_t len) {
    static const unsigned long WRITE_DEADLINE_MS = 2000;
    ...
    // (entire function body)
    ...
}
```

Replace with:
```cpp
// Blocking send loop — SO_SNDTIMEO (set on accept) bounds each call to 2s.
// Must only be called from rtspSenderTask (not loop()) so blocking is safe.
static bool writeAll(int sock, const uint8_t* data, size_t len) {
    size_t off = 0;
    while (off < len) {
        int w = send(sock, data + off, len - off, 0);
        if (w <= 0) return false;
        off += (size_t)w;
    }
    return true;
}
```

- [ ] **Step 2: Update `sendRTPPacket()` to return bool, use new writeAll(), remove dead code**

Find the entire `sendRTPPacket` function (starts around line 1149) and replace:
```cpp
bool sendRTPPacket(WiFiClient &client, int16_t* audioData, int numSamples) {
    if (!client.connected()) return false;

    const uint16_t payloadSize = (uint16_t)(numSamples * (int)sizeof(int16_t));
    const uint16_t packetSize = (uint16_t)(12 + payloadSize);

    uint8_t inter[4];
    inter[0] = 0x24;
    inter[1] = 0x00;
    inter[2] = (uint8_t)((packetSize >> 8) & 0xFF);
    inter[3] = (uint8_t)(packetSize & 0xFF);

    uint8_t header[12];
    header[0] = 0x80;
    header[1] = 96;
    header[2] = (uint8_t)((rtpSequence >> 8) & 0xFF);
    header[3] = (uint8_t)(rtpSequence & 0xFF);
    header[4] = (uint8_t)((rtpTimestamp >> 24) & 0xFF);
    header[5] = (uint8_t)((rtpTimestamp >> 16) & 0xFF);
    header[6] = (uint8_t)((rtpTimestamp >> 8) & 0xFF);
    header[7] = (uint8_t)(rtpTimestamp & 0xFF);
    header[8]  = (uint8_t)((rtpSSRC >> 24) & 0xFF);
    header[9]  = (uint8_t)((rtpSSRC >> 16) & 0xFF);
    header[10] = (uint8_t)((rtpSSRC >> 8) & 0xFF);
    header[11] = (uint8_t)(rtpSSRC & 0xFF);

    for (int i = 0; i < numSamples; ++i) {
        uint16_t s = (uint16_t)audioData[i];
        s = (uint16_t)((s << 8) | (s >> 8));
        audioData[i] = (int16_t)s;
    }

    int sock = client.fd();
    bool success = sock >= 0 &&
                   writeAll(sock, inter, sizeof(inter)) &&
                   writeAll(sock, header, sizeof(header)) &&
                   writeAll(sock, (uint8_t*)audioData, payloadSize);

    for (int i = 0; i < numSamples; ++i) {
        uint16_t s = (uint16_t)audioData[i];
        s = (uint16_t)((s << 8) | (s >> 8));
        audioData[i] = (int16_t)s;
    }

    if (success) {
        rtpSequence++;
        rtpTimestamp += (uint32_t)numSamples;
        audioPacketsSent++;
    } else {
        audioPacketsDropped++;
        client.stop();
    }
    return success;
}
```

- [ ] **Step 3: Remove the dead `consecutiveWriteFailures` globals**

Find and delete these two lines (around the old sendRTPPacket):
```cpp
static uint32_t consecutiveWriteFailures = 0;
static const uint32_t MAX_WRITE_FAILURES = 10;  // 10 × 2s SO_SNDTIMEO = ~20s before disconnect
```

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`. If `sendFrameRTP()` still calls the old void version there will be a type error — fix by adjusting the call site (or accept the error; `sendFrameRTP` is removed in Task 7).

---

### Task 3: Write `rtspSenderTask()`

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — add new function after `sendRTPPacket`

This task owns the socket. Its `select()` loop watches for incoming RTSP control messages (TEARDOWN, GET_PARAMETER) and for socket writability when a frame is queued. On any exit path it closes the socket and gives `senderExitSemaphore`.

- [ ] **Step 1: Add `rtspSenderTask` after `sendRTPPacket`**

```cpp
// ================== CORE 1: RTSP SENDER TASK ==================
// Owns rtspClient from PLAY until stream end.
// Multiplexes RTSP control reads and RTP frame writes via select().
// Exits on: write failure, TEARDOWN, stopStreamRequested.
// On exit: closes socket, gives senderExitSemaphore. loop() then stops audioCaptureTask.
void rtspSenderTask(void* parameter) {
    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Sender] RTSP sender task started\n", ts); }

    int sock = rtspClient.fd();
    uint8_t ctrlBuf[512];
    int ctrlBufPos = 0;

    while (!stopStreamRequested) {
        if (sock < 0 || !rtspClient.connected()) break;

        fd_set rfds, wfds;
        FD_ZERO(&rfds);
        FD_ZERO(&wfds);
        FD_SET(sock, &rfds);

        AudioFrame* frame = NULL;
        bool frameReady = (xQueuePeek(audioReadyQueue, &frame, 0) == pdTRUE);
        if (frameReady) FD_SET(sock, &wfds);

        struct timeval tv = {0, 100000}; // 100ms
        int sel = select(sock + 1, &rfds, frameReady ? &wfds : NULL, NULL, &tv);

        if (sel < 0) break; // socket error

        // Handle incoming RTSP control (TEARDOWN, GET_PARAMETER keepalive)
        if (sel > 0 && FD_ISSET(sock, &rfds)) {
            int avail = rtspClient.available();
            if (avail <= 0) break; // connection closed
            int space = (int)sizeof(ctrlBuf) - ctrlBufPos - 1;
            if (avail > space) avail = space;
            if (avail > 0) {
                rtspClient.read(ctrlBuf + ctrlBufPos, avail);
                ctrlBufPos += avail;
                ctrlBuf[ctrlBufPos] = '\0';
            }

            char* eoh = strstr((char*)ctrlBuf, "\r\n\r\n");
            if (eoh) {
                *eoh = '\0';
                String req = String((char*)ctrlBuf);
                int hlen = (eoh - (char*)ctrlBuf) + 4;
                int rem = ctrlBufPos - hlen;
                if (rem > 0) memmove(ctrlBuf, ctrlBuf + hlen, rem);
                ctrlBufPos = rem;

                // Extract CSeq
                String cseq = "1";
                int cp = req.indexOf("CSeq: ");
                if (cp >= 0) { cseq = req.substring(cp + 6, req.indexOf("\r", cp)); cseq.trim(); }

                lastRTSPActivity = millis();

                if (req.startsWith("TEARDOWN")) {
                    rtspClient.print("RTSP/1.0 200 OK\r\nCSeq: " + cseq + "\r\nSession: " + rtspSessionId + "\r\n\r\n");
                    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Sender] TEARDOWN received\n", ts); }
                    break;
                } else if (req.startsWith("GET_PARAMETER")) {
                    rtspClient.print("RTSP/1.0 200 OK\r\nCSeq: " + cseq + "\r\n\r\n");
                }
                // All other messages ignored — sender only handles TEARDOWN and keepalives
            }
        }

        // Send one RTP frame if socket is writable
        if (sel > 0 && frameReady && FD_ISSET(sock, &wfds)) {
            if (xQueueReceive(audioReadyQueue, &frame, 0) == pdTRUE) {
                bool ok = sendRTPPacket(rtspClient, frame->data, frame->samples);
                xQueueSend(audioFreePool, &frame, 0);
                if (!ok) break;
            }
        }
    }

    // Drain any buffered frames back to pool so audioCaptureTask isn't blocked
    {
        AudioFrame* frame = NULL;
        while (xQueueReceive(audioReadyQueue, &frame, 0) == pdTRUE) {
            xQueueSend(audioFreePool, &frame, 0);
        }
    }

    rtspClient.stop();
    core1OwnsLED = false;

    unsigned long sessionSec = (millis() - lastRtspPlayMs) / 1000;
    { char ts[16]; fillTimestamp(ts, sizeof(ts));
      Serial.printf("%s[Sender] Stream ended (session %lus, sent=%lu dropped=%lu)\n",
                    ts, sessionSec, audioPacketsSent, audioPacketsDropped); }

    xSemaphoreGive(senderExitSemaphore);
    vTaskDelete(NULL);
}
```

- [ ] **Step 2: Build**

```bash
pio run
```
Expected: `SUCCESS`. The task exists but is not yet called from anywhere.

---

### Task 4: Strip `audioCaptureTask()` of `isStreaming` and idle-loop logic

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino:750-979` (`audioCaptureTask`)

The task now runs flat-out from creation to deletion. No idle loop, no `isStreaming` check, no `stopStreamRequested` handler.

- [ ] **Step 1: Remove the `stopStreamRequested` handler block**

Find and delete this entire block inside `audioCaptureTask`'s `while` loop:
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

        if (!isStreaming) {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }
```

- [ ] **Step 2: Remove `isStreaming` and `core1OwnsLED` writes from the LED section**

The LED update block near the end of the loop currently references nothing to remove — it just calls `M5.dis.drawpix`. It's fine as-is; `core1OwnsLED` is now set/cleared by the sender task and loop().

- [ ] **Step 3: Build**

```bash
pio run
```
Expected: `SUCCESS`. Errors about `isStreaming` or `streamCleanupDone` not declared are expected here — they're cleaned up in Task 9.

---

### Task 5: Update `handleRTSPCommand()` PLAY branch to launch both tasks

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — `handleRTSPCommand` PLAY branch (around line 1266)

The PLAY branch previously set `isStreaming = true` and called `startAudioCaptureTask()`. Now it creates both tasks fresh.

- [ ] **Step 1: Rewrite the PLAY branch**

Find this block inside the `else if (request.startsWith("PLAY"))` branch:
```cpp
        rtpSequence = 0;
        rtpTimestamp = 0;
        audioPacketsSent = 0;
        audioPacketsDropped = 0;
        lastStatsReset = millis();
        lastRtspPlayMs = millis();
        rtspPlayCount++;

        // Initialize stream stop flags before handing off
        stopStreamRequested = false;
        streamCleanupDone = false;
        core1OwnsLED = true;
        __asm__ __volatile__("memw" ::: "memory");

        isStreaming = true;

        // Start audio capture task
        startAudioCaptureTask();

        // Core 1 now owns LED during streaming
        simplePrintln("STREAMING STARTED");
```

Replace with:
```cpp
        rtpSequence = 0;
        rtpTimestamp = 0;
        audioPacketsSent = 0;
        audioPacketsDropped = 0;
        lastStatsReset = millis();
        lastRtspPlayMs = millis();
        rtspPlayCount++;

        stopStreamRequested = false;
        core1OwnsLED = true;
        __asm__ __volatile__("memw" ::: "memory");

        // Create audio capture task first so frames are ready when sender starts
        BaseType_t captureResult = xTaskCreatePinnedToCore(
            audioCaptureTask, "AudioPipeline", 8192, NULL, 10,
            &audioCaptureTaskHandle, 1);
        if (captureResult != pdPASS) {
            simplePrintln("FATAL: Failed to create audio capture task");
            core1OwnsLED = false;
            return;
        }
        audioTaskRunning = true;

        BaseType_t senderResult = xTaskCreatePinnedToCore(
            rtspSenderTask, "RTPSender", 8192, NULL, 9,
            &rtspSenderTaskHandle, 1);
        if (senderResult != pdPASS) {
            simplePrintln("FATAL: Failed to create sender task");
            stopAudioCaptureTask();
            core1OwnsLED = false;
            return;
        }

        simplePrintln("STREAMING STARTED");
```

- [ ] **Step 2: Build**

```bash
pio run
```
Expected: `SUCCESS`.

---

### Task 6: Rewrite `requestStreamStop()` with `senderExitSemaphore`

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — `requestStreamStop` and `startAudioCaptureTask`

- [ ] **Step 1: Rewrite `requestStreamStop()`**

Find the entire `requestStreamStop` function and replace:
```cpp
bool requestStreamStop(const char* reason) {
    if (rtspSenderTaskHandle == NULL) return true;

    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Core0] requestStreamStop: %s\n", ts, reason); }

    stopStreamRequested = true;
    __asm__ __volatile__("memw" ::: "memory");

    // Wait for sender task to confirm exit (up to 2s)
    if (xSemaphoreTake(senderExitSemaphore, pdMS_TO_TICKS(2000)) != pdTRUE) {
        char ts[16]; fillTimestamp(ts, sizeof(ts));
        Serial.printf("%s[Core0] WARNING: Sender task did not exit within 2s: %s\n", ts, reason);
    }
    rtspSenderTaskHandle = NULL;
    stopStreamRequested = false;

    stopAudioCaptureTask();

    if (!core1OwnsLED) {
        if (ledMode > 0) M5.dis.drawpix(0, CRGB(0, 0, 128));
        else M5.dis.drawpix(0, CRGB(0, 0, 0));
    }

    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Core0] Stream stopped: %s\n", ts, reason); }
    return true;
}
```

- [ ] **Step 2: Simplify `startAudioCaptureTask()`**

The task now always creates fresh per session — remove the "already alive" guard. Find and replace `startAudioCaptureTask`:
```cpp
void startAudioCaptureTask() {
    BaseType_t result = xTaskCreatePinnedToCore(
        audioCaptureTask, "AudioPipeline", 8192, NULL, 10,
        &audioCaptureTaskHandle, 1);
    if (result != pdPASS) {
        simplePrintln("[Core1] FATAL: Failed to create audio pipeline task!");
    }
}
```

Note: `startAudioCaptureTask` is no longer called from the PLAY branch (Task 5 inlined it) but `restartI2S()` still uses it. Leave it for that path.

- [ ] **Step 3: Build**

```bash
pio run
```
Expected: `SUCCESS`.

---

### Task 7: Simplify `loop()` — remove sendFrameRTP, update streaming state checks

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — `loop()` and `sendFrameRTP` (around line 1548–1693)

- [ ] **Step 1: Delete `sendFrameRTP()` entirely**

Find and delete the entire function:
```cpp
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

- [ ] **Step 2: Update `loop()` — remove sendFrameRTP call and processRTSP during streaming**

Find in `loop()`:
```cpp
    webui_handleClient();

    // Drain one audio frame per loop() so HTTP requests aren't starved
    if (uxQueueMessagesWaiting(audioReadyQueue) > 0) {
        sendFrameRTP();
    }
```

Replace with:
```cpp
    webui_handleClient();
```

- [ ] **Step 3: Replace `wasStreaming` / disconnect detection block with `senderExitSemaphore` poll**

Find the RTSP client management block in `loop()`:
```cpp
    // RTSP client management (Core 0) — clear phase separation
    static bool wasStreaming = false;
    if (rtspServerEnabled) {
        // Phase: detect disconnect (Core 1 cleared isStreaming after self-disconnect)
        if (wasStreaming && !isStreaming) {
            // Core 0 detected client disconnect — socket already stopped, update LED and log
            if (!core1OwnsLED) {
                if (ledMode > 0) M5.dis.drawpix(0, CRGB(0, 0, 128));
                else M5.dis.drawpix(0, CRGB(0, 0, 0));
            }
            unsigned long sessionSec = (millis() - lastRtspPlayMs) / 1000;
            simplePrintln("RTSP client disconnected (session: " + String(sessionSec) + "s, dropped: " +
                         String(audioPacketsDropped) + ", RSSI: " + String(WiFi.RSSI()) + " dBm)");
        }
        wasStreaming = isStreaming;

        // Phase: accept new client (only when not streaming)
        if (!isStreaming) {
            if (!rtspClient || !rtspClient.connected()) {
                WiFiClient newClient = rtspServer.available();
                if (newClient) {
                    rtspClient = newClient;
                    rtspClient.setNoDelay(true);
                    // 2s send timeout: enough for TCP to handle normal congestion backoff
                    // without blocking Core0 indefinitely on a dead connection.
                    struct timeval tv = {2, 0};
                    setsockopt(rtspClient.fd(), SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
                    rtspParseBufferPos = 0;
                    lastRTSPActivity = millis();
                    lastNetworkActivity = millis();
                    lastRtspClientConnectMs = millis();
                    rtspConnectCount++;
                    simplePrintln("New RTSP client connected");
                }
            }
        }

        // RTSP command processing runs both pre-stream (negotiation) and during streaming
        // (TEARDOWN, GET_PARAMETER). Core 0 owns the socket so this is safe at all times.
        if (rtspClient && rtspClient.connected()) {
            processRTSP(rtspClient);
        }
    } else {
        // RTSP server disabled (overheat lockout)
        if (isStreaming) {
            requestStreamStop("server disabled");
            stopAudioCaptureTask();
        }
        if (!core1OwnsLED) {
            if (overheatLatched) {
                M5.dis.drawpix(0, CRGB(128, 0, 0));
            } else {
                if (ledMode > 0) M5.dis.drawpix(0, CRGB(0, 0, 128));
                else M5.dis.drawpix(0, CRGB(0, 0, 0));
            }
        }
    }
```

Replace with:
```cpp
    // RTSP client management
    if (rtspServerEnabled) {
        // Detect sender task exit (stream ended — either by sender or external stop)
        if (rtspSenderTaskHandle != NULL &&
            xSemaphoreTake(senderExitSemaphore, 0) == pdTRUE) {
            rtspSenderTaskHandle = NULL;
            stopStreamRequested = false;
            stopAudioCaptureTask();
            rtspParseBufferPos = 0;
            if (!core1OwnsLED) {
                if (ledMode > 0) M5.dis.drawpix(0, CRGB(0, 0, 128));
                else M5.dis.drawpix(0, CRGB(0, 0, 0));
            }
            simplePrintln("RTSP stream ended (dropped: " + String(audioPacketsDropped) +
                         ", RSSI: " + String(WiFi.RSSI()) + " dBm)");
        }

        // Accept new client only when not streaming
        if (rtspSenderTaskHandle == NULL) {
            if (!rtspClient || !rtspClient.connected()) {
                WiFiClient newClient = rtspServer.available();
                if (newClient) {
                    rtspClient = newClient;
                    rtspClient.setNoDelay(true);
                    struct timeval tv = {2, 0};
                    setsockopt(rtspClient.fd(), SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
                    rtspParseBufferPos = 0;
                    lastRTSPActivity = millis();
                    lastNetworkActivity = millis();
                    lastRtspClientConnectMs = millis();
                    rtspConnectCount++;
                    simplePrintln("New RTSP client connected");
                }
            }
            // Pre-PLAY RTSP negotiation (OPTIONS, DESCRIBE, SETUP, PLAY)
            if (rtspClient && rtspClient.connected()) {
                processRTSP(rtspClient);
            }
        }
    } else {
        // RTSP server disabled (overheat lockout)
        if (rtspSenderTaskHandle != NULL) {
            requestStreamStop("server disabled");
        }
        if (!core1OwnsLED) {
            if (overheatLatched) {
                M5.dis.drawpix(0, CRGB(128, 0, 0));
            } else {
                if (ledMode > 0) M5.dis.drawpix(0, CRGB(0, 0, 128));
                else M5.dis.drawpix(0, CRGB(0, 0, 0));
            }
        }
    }
```

- [ ] **Step 4: Update RTSP idle timeout check**

Find:
```cpp
    if (rtspClient && rtspClient.connected() && !isStreaming) {
        if (millis() - lastRTSPActivity > 60000) {
```

Replace with:
```cpp
    if (rtspSenderTaskHandle == NULL && rtspClient && rtspClient.connected()) {
        if (millis() - lastRTSPActivity > 60000) {
```

- [ ] **Step 5: Update `checkPerformance()` — replace isStreaming**

Find in `checkPerformance()`:
```cpp
    if (isStreaming && (millis() - lastStatsReset) > 30000) {
```
Replace with:
```cpp
    if (rtspSenderTaskHandle != NULL && (millis() - lastStatsReset) > 30000) {
```

- [ ] **Step 6: Update `checkWiFiHealth()` — replace isStreaming**

Find in `checkWiFiHealth()`:
```cpp
        if (isStreaming) {
            requestStreamStop("WiFi disconnect");
            stopAudioCaptureTask();
        }
```
Replace with:
```cpp
        if (rtspSenderTaskHandle != NULL) {
            requestStreamStop("WiFi disconnect");
        }
```

- [ ] **Step 7: Update `checkTemperature()` — replace isStreaming**

Find in `checkTemperature()`:
```cpp
            if (isStreaming) {
                requestStreamStop("overheat");
            }
            stopAudioCaptureTask();
```
Replace with:
```cpp
            if (rtspSenderTaskHandle != NULL) {
                requestStreamStop("overheat");
            }
```

- [ ] **Step 8: Update `restartI2S()` — replace isStreaming, fix double-stop**

`requestStreamStop()` now calls `stopAudioCaptureTask()` internally, so `restartI2S` must not call both. Replace the entire function body:

```cpp
void restartI2S() {
    simplePrintln("Restarting I2S with new parameters...");

    if (rtspSenderTaskHandle != NULL) {
        requestStreamStop("I2S restart");
        // requestStreamStop calls stopAudioCaptureTask() internally — don't call again
    }

    setup_i2s_driver();
    updateHighpassCoeffs();
    maxPacketRate = 0;
    minPacketRate = 0xFFFFFFFF;

    // Sender task is gone — client must re-issue PLAY to resume stream
    simplePrintln("I2S restarted");
}
```

- [ ] **Step 9: Update `resetToDefaultSettings()` — stop stream if running**

Find:
```cpp
    isStreaming = false;
```
Replace with:
```cpp
    if (rtspSenderTaskHandle != NULL) {
        requestStreamStop("factory reset");
    }
```

- [ ] **Step 10: Build**

```bash
pio run
```
Expected: `SUCCESS`. If residual `isStreaming` references remain, fix them now by applying the same `rtspSenderTaskHandle != NULL` pattern.

---

### Task 8: Update `WebUI.cpp` — replace `isStreaming` extern

**Files:**
- Modify: `src/WebUI.cpp:10` and three use sites

- [ ] **Step 1: Replace the extern declaration**

Find:
```cpp
extern volatile bool isStreaming;
```
Replace with:
```cpp
extern TaskHandle_t rtspSenderTaskHandle;
```

- [ ] **Step 2: Replace use in `httpStatus()` (two occurrences)**

Find (line 316):
```cpp
    uint32_t currentRate = (isStreaming && runtime > 1000) ? (audioPacketsSent * 1000) / runtime : 0;
```
Replace with:
```cpp
    uint32_t currentRate = (rtspSenderTaskHandle != NULL && runtime > 1000) ? (audioPacketsSent * 1000) / runtime : 0;
```

Find (line 327):
```cpp
    json += "\"streaming\":" + String(isStreaming?"true":"false") + ",";
```
Replace with:
```cpp
    json += "\"streaming\":" + String(rtspSenderTaskHandle != NULL ? "true" : "false") + ",";
```

- [ ] **Step 3: Replace use in `httpActionServerStop()` (line 454)**

Find:
```cpp
    if (isStreaming) {
        requestStreamStop("server_stop");
    }
```
Replace with:
```cpp
    if (rtspSenderTaskHandle != NULL) {
        requestStreamStop("server_stop");
    }
```

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`.

---

### Task 9: Remove `isStreaming` and `streamCleanupDone` globals; final cleanup and flash test

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — global declarations

- [ ] **Step 1: Remove the `isStreaming` and `streamCleanupDone` global declarations**

Find:
```cpp
volatile bool isStreaming = false;
```
Delete that line.

Find:
```cpp
volatile bool streamCleanupDone = false;     // Core 1 confirms cleanup complete
```
Delete that line.

- [ ] **Step 2: Final build**

```bash
pio run
```
Expected: `SUCCESS` with zero errors and zero warnings related to `isStreaming` or `streamCleanupDone`.

- [ ] **Step 3: Flash firmware**

```bash
pio run --target upload
```

- [ ] **Step 4: Open serial monitor and verify startup**

```bash
pio device monitor -b 115200
```

Expected log sequence on startup:
```
=== ESP32 RTSP Mic Starting ===
...
RTSP server ready on port 8554
Web UI: http://<ip>/
```

- [ ] **Step 5: Connect BirdNET-Go and verify streaming starts**

Connect BirdNET-Go to `rtsp://<ip>:8554/audio`. Expected serial output:
```
New RTSP client connected
STREAMING STARTED
[Sender] RTSP sender task started
[Core1] Audio pipeline task started
```

- [ ] **Step 6: Verify HTTP remains responsive during streaming**

While BirdNET-Go is streaming, open `http://<ip>/` in a browser. The status page should load within 1–2 seconds. Previously this would hang for 1–2 minutes when the client was stalling.

- [ ] **Step 7: Simulate client stall — verify HTTP stays up**

Stop BirdNET-Go from consuming data (pause/stop it) while keeping the TCP connection open. Verify `http://<ip>/` remains responsive. After 2s the sender task should log a write deadline message and exit cleanly:
```
[Sender] Stream ended (session Xs, sent=N dropped=M)
RTSP stream ended (dropped: M, RSSI: -XX dBm)
```

- [ ] **Step 8: Commit**

```bash
git add src/esp32_rtsp_mic_birdnetgo.ino src/WebUI.cpp
git commit -m "feat: move RTSP/RTP sending to dedicated Core 1 task

Sender task owns socket from PLAY, uses select() to multiplex RTSP
control reads and RTP writes. SO_SNDTIMEO now effective (blocking send).
loop() is HTTP-only. isStreaming replaced by rtspSenderTaskHandle check."
```
