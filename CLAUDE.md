# CLAUDE.md - AI Development Context

See `README.md` for project documentation, features, architecture, and usage.

## Key Files
- `src/esp32_rtsp_mic_birdnetgo.ino` — Main firmware (dual-core audio, RTSP, I2S)
- `src/WebUI.cpp` — Web interface (HTML/JS/CSS embedded as string literals, API endpoints)
- `src/WebUI.h` — WebUI header
- `platformio.ini` — Build configuration and dependencies

## Critical Rules

### i2sShiftBits MUST be 0
- PDM microphones output 16-bit samples directly, no bit shifting needed
- This is hardcoded to 0 in the firmware — do not make it configurable
- If it gets set to any other value, all audio becomes zeros (e.g., `180 >> 11 = 0`)
- Web UI shows it as read-only: "0 bits (fixed for PDM)"

### Socket Ownership Model
- Core 0 exclusively owns the WiFiClient (`rtspClient`) at all times
- Core 1 never touches the socket — it only enqueues processed `AudioFrame*` pointers to `audioReadyQueue`
- Use `requestStreamStop()` for Core 0 to signal Core 1 to stop producing frames; Core 0 then closes the socket
- Task shutdown uses a FreeRTOS semaphore with 2s timeout (confirmed exit pattern)

### DMA Buffer Alignment (dma_buf_len must divide currentBufferSize)
- `dma_buf_len` = `currentSampleRate / 250` → 192 at 48 kHz
- `DEFAULT_BUFFER_SIZE` (3072) / 192 = 16 exactly — no partial-buffer seam
- Breaking this alignment causes the PDM decimation pipeline to glitch at each `i2s_read()` boundary,
  exciting the SPM1423 MEMS resonance and producing continuous 7–16 kHz clicking noise at the buffer rate
- All supported buffer sizes (256–8192) are valid divisors of 192 at 48 kHz
- `dma_buf_count` = 8 (ring = 8×192 = 1536 samples = 32 ms headroom)

### Cross-Core Safety
- Use FreeRTOS queues for inter-core data transfer (not custom ring buffers — cache coherency issues on ESP32)
- Audio pipeline uses `audioReadyQueue` (Core 1→Core 0: filled frames) and `audioFreePool` (Core 0→Core 1: empty frames) with a pre-allocated pool of 4 frames
- `AudioFrame` pool frames are sized to `MAX_BUFFER_SIZE` (8192) — `currentBufferSize` is capped at this value at settings load; default is `DEFAULT_BUFFER_SIZE` (3072)
- Use `portMUX_TYPE` spinlocks for shared log buffers
- Use Xtensa `memw` memory barriers on critical flag transitions between cores
- `core1OwnsLED` flag prevents concurrent FastLED/RMT driver access

## Debugging Tips

### If Audio Stops Working
1. Check serial monitor for `i2sShiftBits` value — must be 0
2. Uncomment debug lines in `streamAudio()` to see sample values at each processing step
3. Check raw I2S samples first, then processed samples, then RTP packets
4. Use "Defaults" button in Web UI if flash settings are corrupted

### If System is Unstable
1. Check WiFi RSSI (should be > -70 dBm)
2. Check free heap (should stay above ~80KB)
3. Look for "Write timeout" messages (client too slow)

## Build & Deploy
```bash
pio run                      # Build
pio run --target upload      # Upload
pio device monitor -b 115200 # Monitor
```

## Configuration Storage
Settings saved to flash in `audioPrefs` namespace via ESP32 Preferences library.
