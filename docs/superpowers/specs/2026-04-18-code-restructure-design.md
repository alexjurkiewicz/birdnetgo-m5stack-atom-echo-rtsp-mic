# Code Restructure Design

**Date:** 2026-04-18
**Scope:** Split monolithic `.ino` into logical modules; extract web content to real editable files with a build-time inlining step.

---

## Goals

1. Replace the 1500-line monolithic `.ino` with focused, single-purpose modules.
2. Replace the giant embedded HTML/CSS/JS string in `WebUI.cpp` with real editable source files.

## Non-goals

- No new Python package dependencies (stdlib only).
- No LittleFS or filesystem changes.
- No behavioural changes to firmware or web UI.
- No encapsulation of globals into structs/classes (deferred; shared header for now).

---

## Part 1: Web Content Extraction

### Source files

Three new files under `src/web/`:

```
src/web/
  index.html   — HTML structure, references style.css and app.js normally
  style.css    — All CSS
  app.js       — All JavaScript
```

The `index.html` is valid standalone HTML (`<link rel="stylesheet" href="style.css">` and `<script src="app.js"></script>`), so editors give syntax highlighting and browser preview works.

### Build script

New file: `scripts/build_web.py`

- Registered as a PlatformIO pre-build action in `platformio.ini` via `extra_scripts = pre:scripts/build_web.py`.
- Uses only Python stdlib (`os`, `re`, file I/O) — no pip dependencies.
- Reads `index.html`, `style.css`, `app.js`.
- Inlines CSS by replacing the `<link>` tag with `<style>…</style>`.
- Inlines JS by replacing the `<script src="…">` tag with `<script>…</script>`.
- Writes `src/web_content.h` containing the combined HTML as a PROGMEM raw string literal.

### Generated header

`src/web_content.h` (git-ignored, do not edit):

```cpp
// Auto-generated — edit src/web/ files instead.
#pragma once
static const char HTML_PAGE[] PROGMEM = R"rawliteral(
<!doctype html>…combined HTML…
)rawliteral";
```

### WebUI.cpp changes

- `htmlIndex()` is removed; the index route handler serves `HTML_PAGE` directly.
- Remove all `extern` declarations (replaced by `SharedState.h` include).

### IP address injection

Currently C++ injects the device IP into the RTSP URL at request time. With a static template this moves to JavaScript.

`loadStatus()` in `app.js` already receives `j.ip`; it gains these lines inside the `.then(j => { … })` callback:

```js
const rtspUrl = 'rtsp://' + j.ip + ':8554/audio';
const rtspEl = $('rtsp');
if (rtspEl) { rtspEl.href = rtspUrl; rtspEl.textContent = rtspUrl; }
```

The HTML template has `href="#" id="rtsp"` as the initial anchor state.

No other runtime values are injected into the HTML template.

---

## Part 2: Module Split

### File structure after refactor

```
src/
  esp32_rtsp_mic_birdnetgo.ino   — includes, global definitions, logging helpers, setup(), loop()
  SharedState.h                  — extern declarations for all globals + function forward declarations
  Audio.h / Audio.cpp            — I2S, Core 1 pipeline, RTP, DSP (HPF, AGC)
  RTSP.h / RTSP.cpp              — RTSP protocol parsing and command handling
  Settings.h / Settings.cpp      — Flash persistence (load/save/reset), computeRecommendedMinRate
  Diagnostics.h / Diagnostics.cpp — Temperature, performance, WiFi health, scheduled reset, WiFi power helpers
  WebUI.h / WebUI.cpp            — HTTP server (interface unchanged)
  web/
    index.html
    style.css
    app.js
  web_content.h                  — generated
scripts/
  build_web.py
```

### SharedState.h

Declares (but does not define) every global variable and shared function currently spread across `extern` lines in `WebUI.cpp` and implicit `.ino` scope.

All global *definitions* remain in the `.ino` — `SharedState.h` is declarations only. Each `.cpp` module includes `SharedState.h` instead of repeating externs.

### Module responsibilities

**Audio.h / Audio.cpp**
- `struct Biquad` and its `process()` / `reset()` methods
- `updateHighpassCoeffs()`
- `setup_i2s_driver()`
- `audioCaptureTask()` — Core 1 task (I2S read → HPF → gain/AGC → metering → LED → RTP send)
- `startAudioCaptureTask()` / `stopAudioCaptureTask()`
- `requestStreamStop(const char* reason)`
- `sendRTPPacket()` and `writeAll()`

**RTSP.h / RTSP.cpp**
- `handleRTSPCommand(WiFiClient&, String)`
- `processRTSP(WiFiClient&)`
- `drainRtspReceiveBuffer(WiFiClient&)`

**Settings.h / Settings.cpp**
- `loadAudioSettings()`
- `saveAudioSettings()`
- `resetToDefaultSettings()`
- `scheduleReboot(bool factoryReset, uint32_t delayMs)`
- `computeRecommendedMinRate()`

**Diagnostics.h / Diagnostics.cpp**
- `checkTemperature()`
- `checkPerformance()`
- `checkWiFiHealth()`
- `checkScheduledReset()`
- `recordOverheatTrip(float temp)`
- `persistOverheatNote()`
- `applyWifiTxPower(bool log)`
- `wifiPowerLevelToDbm(wifi_power_t)`
- `pickWifiPowerLevel(float dbm)`
- `isTemperatureValid(float temp)` — also called from `setup()` in the `.ino`, so declared in `SharedState.h`

**Logging — stays in .ino**

`logTimestamp()`, `simplePrint()`, `simplePrintln()` remain in the `.ino` because they call `webui_pushLog()` (defined in `WebUI.cpp`). Moving them would create a circular dependency between modules and WebUI. They are declared in `SharedState.h` so all modules can call them.

### .ino after refactor (~300 lines)

- `#include` directives for all modules and libraries
- All global variable *definitions*
- Cross-core sync primitives
- `logTimestamp()` / `simplePrint()` / `simplePrintln()`
- `formatUptime()` / `formatSince()`
- `setup()`
- `loop()`

---

## Build system changes

`platformio.ini`:
```ini
extra_scripts = pre:scripts/build_web.py
```

`.gitignore` additions:
```
src/web_content.h
```

---

## Constraints preserved

- `i2sShiftBits` remains hardcoded to 0 — `Settings.cpp` enforces this on load.
- Socket ownership model unchanged — Core 1 owns the WiFiClient during streaming; `requestStreamStop()` remains the only safe cross-core stop mechanism.
- All cross-core synchronization primitives (`stopStreamRequested`, `streamCleanupDone`, `taskExitSemaphore`, `logMux`, `core1OwnsLED`) remain globals defined in the `.ino`.
