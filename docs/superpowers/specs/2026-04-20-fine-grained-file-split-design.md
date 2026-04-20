# Fine-Grained File Split Design

**Date:** 2026-04-20  
**Goal:** Split the monolithic `.ino` (1713 lines) into focused, navigable source files. Primary driver is navigability — finding things quickly by concern.

---

## Architecture

All shared global state moves to `globals.h` / `globals.cpp`. Every module includes `globals.h` instead of maintaining per-file `extern` lists. The `.ino` shrinks to ~200 lines containing only `setup()`, `loop()`, and queue/semaphore init.

---

## File Breakdown

| File | Responsibility | Est. lines |
|------|---------------|-----------|
| `globals.h` + `globals.cpp` | All shared state: audio config, RTSP state, diagnostics vars, queues, task handles, cross-core flags | ~150 |
| `Logging.h` + `Logging.cpp` | `simplePrint`, `simplePrintln`, `logTimestamp`, `fillTimestamp` | ~60 |
| `Config.h` + `Config.cpp` | `loadAudioSettings`, `saveAudioSettings`, `resetToDefaultSettings`, `computeRecommendedMinRate`, `scheduleReboot` | ~180 |
| `WiFiUtils.h` + `WiFiUtils.cpp` | `applyWifiTxPower`, `wifiPowerLevelToDbm`, `pickWifiPowerLevel`, power level table | ~70 |
| `AudioDSP.h` + `AudioDSP.cpp` | `Biquad` struct, `DcBlocker` struct, AGC constants (header); `updateHighpassCoeffs` implementation (cpp — reads globals) | ~100 |
| `I2SDriver.h` + `I2SDriver.cpp` | `setup_i2s_driver`, `restartI2S`, I2S pin defines | ~80 |
| `AudioTask.h` + `AudioTask.cpp` | `AudioFrame` struct, pool/queue handles, `audioCaptureTask`, `stopAudioCaptureTask` | ~230 |
| `RTSPSender.h` + `RTSPSender.cpp` | `rtspSenderTask`, `requestStreamStop`, `sendRTPPacket`, `writeAll` | ~180 |
| `RTSPProtocol.h` + `RTSPProtocol.cpp` | `handleRTSPCommand`, `processRTSP`, `drainRtspReceiveBuffer` | ~160 |
| `Diagnostics.h` + `Diagnostics.cpp` | `checkTemperature`, `checkPerformance`, `checkWiFiHealth`, `checkScheduledReset`, `recordOverheatTrip`, `persistOverheatNote` | ~200 |
| `WebUI.h` + `WebUI.cpp` | Unchanged except: remove 40 `extern` declarations, add `#include "globals.h"` | ~530 |
| `.ino` | `setup()`, `loop()`, queue/semaphore init, frame pool allocation, `handleSerialCommand` | ~200 |

---

## globals.h / globals.cpp

`globals.h` declares every shared variable with `extern`. `globals.cpp` defines them, replacing current definitions scattered in the `.ino`.

What goes in globals:
- Audio config: `currentSampleRate`, `currentGainFactor`, `currentBufferSize`, `i2sShiftBits`
- Audio DSP instances: `hpf`, `dcBlockerEnabled`, `highpassEnabled`, `highpassCutoffHz`, `hpfConfigSampleRate`, `hpfConfigCutoff`, `agcEnabled`, `agcMultiplier`, AGC constants
- Audio metering: `lastPeakAbs16`, `audioClipCount`, `audioClippedLastBlock`, `peakHoldAbs16`, `peakHoldUntilMs`
- Audio pool: `AudioFrame` struct, `AUDIO_POOL_DEPTH`, `audioFrameStorage`, `audioFramePool`, `audioReadyQueue`, `audioFreePool`
- RTSP state: `rtspServer`, `rtspClient`, `rtspSessionId`, `rtpSequence`, `rtpTimestamp`, `rtpSSRC`, `lastRTSPActivity`, `rtspParseBuffer`, `rtspParseBufferPos`
- Stream stats: `audioPacketsSent`, `audioPacketsDropped`, `lastStatsReset`, `rtspServerEnabled`, `rtspConnectCount`, `rtspPlayCount`, `lastRtspClientConnectMs`, `lastRtspPlayMs`
- Task handles + cross-core flags: `audioCaptureTaskHandle`, `audioTaskRunning`, `rtspSenderTaskHandle`, `stopStreamRequested`, `senderExitSemaphore`, `taskExitSemaphore`, `core1OwnsLED`, `logMux`
- Diagnostics: all `lastXxxCheck`, `minFreeHeap`, `maxPacketRate`, `minPacketRate`, `autoRecoveryEnabled`, `autoThresholdEnabled`, `scheduledFactoryReset`, `scheduledRebootAt`, `bootTime`, `lastI2SReset`
- Temperature: `maxTemperature`, `lastTemperatureC`, `lastTemperatureValid`, `overheat*` fields
- Scheduled reset: `scheduledResetEnabled`, `resetIntervalHours`
- Configurable thresholds: `minAcceptableRate`, `performanceCheckInterval`, `cpuFrequencyMhz`
- WiFi TX power: `wifiTxPowerDbm`, `currentWifiPowerLevel`
- LED: `ledMode`
- mDNS: `mdnsHostname`

`AudioFrame` struct definition lives in `globals.h` (used by both `AudioTask` and `RTSPSender`).  
`Biquad` and `DcBlocker` struct definitions live in `AudioDSP.h`; the global instances (`hpf`) are declared in `globals.h` via `#include "AudioDSP.h"` at the top of `globals.h`.

---

## AudioDSP.h / AudioDSP.cpp

`AudioDSP.h` contains `Biquad` and `DcBlocker` struct definitions with inline `process()` and `reset()` methods, AGC constants (`AGC_TARGET_RMS`, `AGC_MIN_MULT`, etc.), and the declaration of `updateHighpassCoeffs()`.

`AudioDSP.cpp` contains the `updateHighpassCoeffs()` implementation — it reads globals (`hpf`, `currentSampleRate`, `highpassCutoffHz`, etc.) so it cannot be header-only. `AudioTask.cpp` instantiates `Biquad` and `DcBlocker` on the stack as local variables; the global `hpf` instance is defined in `globals.cpp`.

---

## Circular Dependency Resolution

`Logging.cpp` calls `webui_pushLog()` (defined in `WebUI.cpp`).  
`WebUI.cpp` calls `simplePrintln()` (defined in `Logging.cpp`).

Fix: `Logging.cpp` uses `extern void webui_pushLog(String)` directly — same pattern currently in the codebase. No header cycle is introduced. `Logging.h` does not include `WebUI.h`.

---

## WebUI.cpp Changes

Remove all ~40 `extern` declarations at the top of `WebUI.cpp`. Replace with `#include "globals.h"`. No other logic changes to WebUI.

---

## .ino After Refactor

Includes all module headers. Contains only:
- Queue/semaphore creation (`xQueueCreate`, `xSemaphoreCreateBinary`)
- Audio frame pool `malloc` loop
- `handleSerialCommand()` (~10 lines, not worth its own file)
- `setup()` — orchestration: WiFiManager, NTP, mDNS, I2S, HPF, RTSP server, Web UI init
- `loop()` — orchestration: RTSP client accept, idle timeout, deferred reboot, periodic health check dispatch

---

## What Does Not Change

- `WebUI.cpp` logic and HTML/JS/CSS are untouched
- Cross-core safety patterns (FreeRTOS queues, spinlocks, `memw` barriers) are untouched
- DMA buffer alignment logic is untouched
- `i2sShiftBits` remains hardcoded to 0
- Build configuration (`platformio.ini`) requires no changes — PlatformIO auto-discovers all `.cpp` files in `src/`
