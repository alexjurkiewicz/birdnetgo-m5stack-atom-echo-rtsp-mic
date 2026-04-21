# Code Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic 1524-line `.ino` into focused modules and extract embedded web content into real editable files with a build-time inlining step.

**Architecture:** Part 1 extracts HTML/CSS/JS from `WebUI.cpp`'s `htmlIndex()` function into `src/web/` source files; a PlatformIO pre-build Python script inlines them into a generated `src/web_content.h` PROGMEM header at compile time. Part 2 splits the `.ino` by concern into `Audio`, `RTSP`, `Settings`, and `Diagnostics` modules, with a `SharedState.h` providing `extern` declarations for all globals so modules can cross-reference without repeating externs.

**Tech Stack:** PlatformIO (Arduino / ESP32 framework), C++11, Python 3 stdlib only (`os`, `re`).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/web/index.html` | Create | HTML structure; links to style.css and app.js for editor support |
| `src/web/style.css` | Create | All CSS |
| `src/web/app.js` | Create | All JavaScript, including RTSP URL injection in `loadStatus()` |
| `scripts/build_web.py` | Create | Pre-build: inline CSS+JS into HTML, write `web_content.h` |
| `src/web_content.h` | Generated | PROGMEM raw-string of combined HTML; do not edit; git-ignored |
| `src/SharedState.h` | Create | `extern` declarations for every shared global + forward decls for `.ino` utility functions |
| `src/Audio.h` | Create | `Biquad` struct, `extern Biquad hpf`, Audio module function declarations |
| `src/Audio.cpp` | Create | I2S driver, Core 1 pipeline task, RTP, DSP (HPF, AGC), `restartI2S` |
| `src/RTSP.h` | Create | RTSP function declarations |
| `src/RTSP.cpp` | Create | `handleRTSPCommand`, `processRTSP`, `drainRtspReceiveBuffer` |
| `src/Settings.h` | Create | Settings function declarations |
| `src/Settings.cpp` | Create | `loadAudioSettings`, `saveAudioSettings`, `resetToDefaultSettings`, `scheduleReboot`, `computeRecommendedMinRate` |
| `src/Diagnostics.h` | Create | Diagnostics function declarations |
| `src/Diagnostics.cpp` | Create | Temperature, performance, WiFi health, overheat, WiFi power helpers |
| `src/esp32_rtsp_mic_birdnetgo.ino` | Modify | Reduce to: includes, global definitions, logging helpers, `setup()`, `loop()` |
| `src/WebUI.cpp` | Modify | Remove `htmlIndex()`, serve `HTML_PAGE`; replace `extern` soup with module includes |
| `platformio.ini` | Modify | Add `extra_scripts = pre:scripts/build_web.py` |
| `.gitignore` | Modify | Add `src/web_content.h` |

**Verification:** This project has no unit test framework. Every task ends with `pio run` to confirm the build compiles cleanly. Flash and manually verify web UI behaviour after Part 1 Task 5 and at the end of Part 2.

---

## Part 1: Web Content Extraction

### Task 1: Create src/web/style.css

**Files:**
- Create: `src/web/style.css`

The CSS lives inside the first `F()` string in `htmlIndex()` (WebUI.cpp lines 139–158), between `<style>` and `</style>`. It is a minified single-line block starting with `:root{--bg:#0b1020;`.

- [ ] **Step 1: Extract the CSS**

  In `src/WebUI.cpp`, find `htmlIndex()`. The CSS is the content of the `<style>` tag in the first large `h += F("...")` string. Copy everything between `<style>` and `</style>` (not including the tags themselves) into `src/web/style.css`.

  The extracted file should start with:
  ```
  :root{--bg:#0b1020;--fg:#e7ebf2;--muted:#9aa3b2;--card:#121a2e;--border:#1b2745;--acc:#4ea1f3;--acc2:#36d399;--warn:#f59e0b;--bad:#ef4444}
  ```
  and end with the `.overlay .box{...}` rule.

- [ ] **Step 2: Commit**

  ```bash
  git add src/web/style.css
  git commit -m "extract CSS into src/web/style.css"
  ```

---

### Task 2: Create src/web/app.js

**Files:**
- Create: `src/web/app.js`

The JavaScript lives between `<script>` and `</script>` at the end of `htmlIndex()` (WebUI.cpp approximately lines 262–299). It starts with `const T={en:{` and ends with `loadAll();`.

- [ ] **Step 1: Extract the JavaScript**

  Copy everything between `<script>` and `</script>` in `htmlIndex()` into `src/web/app.js`.

- [ ] **Step 2: Add RTSP URL injection to loadStatus()**

  In the extracted `app.js`, find the `loadStatus` function. Inside the `.then(j => { ... })` callback, after the line that sets `$('ip').textContent`, add:

  ```js
  const rtspUrl = 'rtsp://' + j.ip + ':8554/audio';
  const rtspEl = $('rtsp');
  if (rtspEl) { rtspEl.href = rtspUrl; rtspEl.textContent = rtspUrl; }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/web/app.js
  git commit -m "extract JS into src/web/app.js; populate RTSP URL from status API"
  ```

---

### Task 3: Create src/web/index.html

**Files:**
- Create: `src/web/index.html`

The HTML structure is everything in `htmlIndex()` that isn't the CSS or JS — the doctype, head (without the `<style>` block), and body (without the inline `<script>`). Three things change from the original: (1) `<style>` becomes `<link>`; (2) the inline `<script>` becomes `<script src="app.js">`; (3) the RTSP `<a>` tag gets `href="#"` and placeholder text instead of a C++-injected IP.

- [ ] **Step 1: Create the HTML template**

  Assemble `src/web/index.html` from `htmlIndex()` with these substitutions:

  **Head:** Replace the `<style>…</style>` block with:
  ```html
  <link rel="stylesheet" href="style.css">
  ```

  **RTSP anchor** (currently split across two `h += ip` concatenations):
  ```html
  <a id='rtsp' class='mono' href='#' target='_blank'>rtsp://…</a>
  ```

  **Script block at the end of `<body>`:** Replace the `<script>…</script>` block with:
  ```html
  <script src="app.js"></script>
  ```

  The file should be valid HTML that a browser can open locally (CSS/JS won't load from local disk but structure is visible).

- [ ] **Step 2: Commit**

  ```bash
  git add src/web/index.html
  git commit -m "create src/web/index.html template with external CSS/JS refs"
  ```

---

### Task 4: Create scripts/build_web.py

**Files:**
- Create: `scripts/build_web.py`

- [ ] **Step 1: Create the build script**

  ```python
  import os
  import re

  Import("env")

  def build_web_content(source, target, env):
      script_dir = os.path.dirname(os.path.realpath(__file__))
      web_dir    = os.path.join(script_dir, '..', 'src', 'web')
      out_path   = os.path.join(script_dir, '..', 'src', 'web_content.h')

      with open(os.path.join(web_dir, 'index.html'), encoding='utf-8') as f:
          html = f.read()
      with open(os.path.join(web_dir, 'style.css'), encoding='utf-8') as f:
          css = f.read()
      with open(os.path.join(web_dir, 'app.js'), encoding='utf-8') as f:
          js = f.read()

      # Inline CSS: replace <link rel="stylesheet" href="style.css"> with <style>...</style>
      html = re.sub(
          r'<link\s+rel=["\']stylesheet["\']\s+href=["\']style\.css["\']\s*/?>',
          '<style>' + css + '</style>',
          html
      )

      # Inline JS: replace <script src="app.js"></script> with <script>...</script>
      html = re.sub(
          r'<script\s+src=["\']app\.js["\']\s*>\s*</script>',
          '<script>' + js + '</script>',
          html
      )

      with open(out_path, 'w', encoding='utf-8') as f:
          f.write('// Auto-generated — do not edit. Edit src/web/ files instead.\n')
          f.write('#pragma once\n')
          f.write('static const char HTML_PAGE[] PROGMEM = R"WEBRAW(\n')
          f.write(html)
          f.write('\n)WEBRAW";\n')

      print("build_web.py: wrote", out_path)

  env.AddPreAction("buildprog", build_web_content)
  ```

  The raw string delimiter `WEBRAW` is chosen to be safe against HTML content (unlike the more common `rawliteral`).

- [ ] **Step 2: Commit**

  ```bash
  git add scripts/build_web.py
  git commit -m "add build_web.py: inline src/web/ files into web_content.h at build time"
  ```

---

### Task 5: Wire up build script; update WebUI.cpp; verify

**Files:**
- Modify: `platformio.ini`
- Modify: `.gitignore`
- Modify: `src/WebUI.cpp`

- [ ] **Step 1: Register the pre-build script in platformio.ini**

  Add after `framework = arduino`:
  ```ini
  extra_scripts = pre:scripts/build_web.py
  ```

- [ ] **Step 2: Add web_content.h to .gitignore**

  Append to `.gitignore`:
  ```
  src/web_content.h
  ```

- [ ] **Step 3: Run a build to generate web_content.h**

  ```bash
  pio run
  ```

  Expected: build succeeds, `src/web_content.h` is created. If the build fails, the script has an error — check the output from `build_web.py`.

- [ ] **Step 4: Update WebUI.cpp to serve HTML_PAGE**

  At the top of `src/WebUI.cpp`, add:
  ```cpp
  #include "web_content.h"
  ```

  Find `static String htmlIndex() { ... }` (the large function, approximately lines 132–301 of WebUI.cpp) and delete the entire function body.

  Find `static void httpIndex() { web.send(200, "text/html; charset=utf-8", htmlIndex()); }` and replace with:
  ```cpp
  static void httpIndex() { web.send(200, "text/html; charset=utf-8", HTML_PAGE); }
  ```

- [ ] **Step 5: Verify build compiles**

  ```bash
  pio run
  ```

  Expected: build succeeds with no errors. If `HTML_PAGE` is not found, confirm `web_content.h` was generated and the `#include` is at the top of `WebUI.cpp`.

- [ ] **Step 6: Flash and verify web UI**

  ```bash
  pio run --target upload && pio device monitor -b 115200
  ```

  Open `http://<device-ip>/` in a browser. Confirm:
  - Status card shows correct IP and RSSI
  - RTSP URL in the header updates to `rtsp://<ip>:8554/audio` (populated by JS from the status API)
  - All controls (gain, buffer, HPF, etc.) work as before

- [ ] **Step 7: Commit**

  ```bash
  git add platformio.ini .gitignore src/WebUI.cpp
  git commit -m "serve web UI from build-time generated header; remove htmlIndex()"
  ```

---

## Part 2: Module Split

### Task 6: Create src/SharedState.h

**Files:**
- Create: `src/SharedState.h`

`SharedState.h` provides `extern` declarations for every global variable defined in the `.ino`, so each new `.cpp` module can include one header instead of repeating `extern` lines. It also forward-declares the utility functions that live in the `.ino` itself (`simplePrint`, `simplePrintln`, `formatUptime`, `formatSince`).

- [ ] **Step 1: Create src/SharedState.h**

  ```cpp
  #pragma once

  #include <Arduino.h>
  #include <WiFi.h>
  #include <Preferences.h>
  #include "esp_wifi.h"

  // === Cross-core synchronization ===
  extern WiFiClient* volatile streamClient;
  extern TaskHandle_t         audioCaptureTaskHandle;
  extern volatile bool        audioTaskRunning;
  extern portMUX_TYPE         logMux;
  extern volatile bool        stopStreamRequested;
  extern volatile bool        streamCleanupDone;
  extern SemaphoreHandle_t    taskExitSemaphore;
  extern volatile bool        core1OwnsLED;

  // === Firmware version ===
  extern const char* FW_VERSION_STR;

  // === Servers ===
  extern WiFiServer rtspServer;
  extern WiFiClient rtspClient;

  // === RTSP streaming state ===
  extern String        rtspSessionId;
  extern volatile bool isStreaming;
  extern uint16_t      rtpSequence;
  extern uint32_t      rtpTimestamp;
  extern uint32_t      rtpSSRC;
  extern unsigned long lastRTSPActivity;
  extern uint8_t       rtspParseBuffer[1024];
  extern int           rtspParseBufferPos;

  // === Audio packet counters ===
  extern unsigned long audioPacketsSent;
  extern unsigned long audioPacketsDropped;
  extern unsigned long lastStatsReset;
  extern bool          rtspServerEnabled;

  // === Audio parameters ===
  extern uint32_t currentSampleRate;
  extern float    currentGainFactor;
  extern uint16_t currentBufferSize;
  extern uint8_t  i2sShiftBits;
  extern bool     highpassEnabled;
  extern uint16_t highpassCutoffHz;
  extern uint32_t hpfConfigSampleRate;
  extern uint16_t hpfConfigCutoff;

  // === Audio metering ===
  extern uint16_t      lastPeakAbs16;
  extern uint32_t      audioClipCount;
  extern bool          audioClippedLastBlock;
  extern uint16_t      peakHoldAbs16;
  extern unsigned long peakHoldUntilMs;

  // === LED / AGC ===
  extern uint8_t       ledMode;
  extern bool          agcEnabled;
  extern volatile float agcMultiplier;

  // === Preferences (flash storage) ===
  extern Preferences audioPrefs;

  // === Timing ===
  extern unsigned long lastMemoryCheck;
  extern unsigned long lastPerformanceCheck;
  extern unsigned long lastWiFiCheck;
  extern unsigned long lastTempCheck;
  extern unsigned long bootTime;
  extern unsigned long lastI2SReset;
  extern unsigned long lastRtspClientConnectMs;
  extern unsigned long lastRtspPlayMs;

  // === Diagnostics ===
  extern uint32_t      minFreeHeap;
  extern uint32_t      maxPacketRate;
  extern uint32_t      minPacketRate;
  extern bool          autoRecoveryEnabled;
  extern bool          autoThresholdEnabled;
  extern volatile bool          scheduledFactoryReset;
  extern volatile unsigned long scheduledRebootAt;
  extern float         maxTemperature;
  extern float         lastTemperatureC;
  extern bool          lastTemperatureValid;

  // === Overheat protection ===
  extern bool          overheatProtectionEnabled;
  extern float         overheatShutdownC;
  extern bool          overheatLockoutActive;
  extern float         overheatTripTemp;
  extern unsigned long overheatTriggeredAt;
  extern String        overheatLastReason;
  extern String        overheatLastTimestamp;
  extern bool          overheatSensorFault;
  extern bool          overheatLatched;

  // === Scheduled reset ===
  extern bool     scheduledResetEnabled;
  extern uint32_t resetIntervalHours;

  // === Configurable thresholds ===
  extern uint32_t minAcceptableRate;
  extern uint32_t performanceCheckInterval;
  extern uint8_t  cpuFrequencyMhz;

  // === WiFi TX power ===
  extern float         wifiTxPowerDbm;
  extern wifi_power_t  currentWifiPowerLevel;

  // === RTSP statistics ===
  extern uint32_t      rtspConnectCount;
  extern uint32_t      rtspPlayCount;

  // === Utility functions defined in the .ino ===
  void         simplePrint(String message);
  void         simplePrintln(String message);
  String       formatUptime(unsigned long seconds);
  String       formatSince(unsigned long eventMs);
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/SharedState.h
  git commit -m "add SharedState.h: extern declarations for all shared globals"
  ```

---

### Task 7: Create Settings module; slim the .ino

**Files:**
- Create: `src/Settings.h`
- Create: `src/Settings.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create src/Settings.h**

  ```cpp
  #pragma once

  void     loadAudioSettings();
  void     saveAudioSettings();
  void     resetToDefaultSettings();
  void     scheduleReboot(bool factoryReset, uint32_t delayMs);
  uint32_t computeRecommendedMinRate();
  ```

- [ ] **Step 2: Create src/Settings.cpp**

  ```cpp
  #include "Settings.h"
  #include "SharedState.h"
  #include "Diagnostics.h"  // pickWifiPowerLevel, wifiPowerLevelToDbm
  ```

  Then move these functions verbatim from the `.ino` into this file (in this order):
  - `computeRecommendedMinRate()` — `.ino` lines 535–542
  - `loadAudioSettings()` — `.ino` lines 446–494
  - `saveAudioSettings()` — `.ino` lines 496–527
  - `scheduleReboot()` — `.ino` lines 529–533
  - `resetToDefaultSettings()` — `.ino` lines 544–589

  No changes to function bodies are needed.

- [ ] **Step 3: Remove moved functions from the .ino**

  In `src/esp32_rtsp_mic_birdnetgo.ino`, delete the bodies of the five functions listed above. Add includes at the top of the `.ino` (after the existing `#include "WebUI.h"`):

  ```cpp
  #include "SharedState.h"
  #include "Settings.h"
  ```

- [ ] **Step 4: Verify build compiles**

  ```bash
  pio run
  ```

  Expected: clean compile. Common errors:
  - `'computeRecommendedMinRate' was not declared` — `Settings.h` not included where needed
  - `'audioPrefs' was not declared` — `SharedState.h` not included in Settings.cpp

- [ ] **Step 5: Commit**

  ```bash
  git add src/Settings.h src/Settings.cpp src/esp32_rtsp_mic_birdnetgo.ino
  git commit -m "extract Settings module: load/save/reset/scheduleReboot/computeMinRate"
  ```

---

### Task 8: Create Diagnostics module; slim the .ino

**Files:**
- Create: `src/Diagnostics.h`
- Create: `src/Diagnostics.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create src/Diagnostics.h**

  ```cpp
  #pragma once

  #include "esp_wifi.h"

  bool        isTemperatureValid(float temp);
  void        recordOverheatTrip(float temp);
  void        persistOverheatNote();
  void        checkTemperature();
  void        checkPerformance();
  void        checkWiFiHealth();
  void        checkScheduledReset();
  void        applyWifiTxPower(bool log = true);
  float       wifiPowerLevelToDbm(wifi_power_t lvl);
  wifi_power_t pickWifiPowerLevel(float dbm);
  ```

- [ ] **Step 2: Create src/Diagnostics.cpp**

  ```cpp
  #include "Diagnostics.h"
  #include "SharedState.h"
  #include "Audio.h"   // requestStreamStop, stopAudioCaptureTask, restartI2S
  ```

  Move these functions verbatim from the `.ino` into this file (in this order):
  - `wifiPowerLevelToDbm()` — `.ino` lines 174–191
  - `pickWifiPowerLevel()` — `.ino` lines 193–207 (remove the `static` qualifier; it is now declared in the header)
  - `applyWifiTxPower()` — `.ino` lines 209–220 (remove the default value from the definition — `bool log = true` becomes `bool log` in the `.cpp`; the default lives only in the header declaration)
  - `isTemperatureValid()` — `.ino` lines 284–288 (remove the `static` qualifier)
  - `persistOverheatNote()` — `.ino` lines 291–298
  - `recordOverheatTrip()` — `.ino` lines 300–311
  - `checkTemperature()` — `.ino` lines 313–373
  - `checkPerformance()` — `.ino` lines 375–411
  - `checkWiFiHealth()` — `.ino` lines 413–431
  - `checkScheduledReset()` — `.ino` lines 434–444

- [ ] **Step 3: Remove moved functions from the .ino; add includes**

  Delete the bodies of all ten functions listed above from the `.ino`. Add to the includes at the top of the `.ino`:

  ```cpp
  #include "Diagnostics.h"
  ```

- [ ] **Step 4: Verify build compiles**

  ```bash
  pio run
  ```

  Expected: clean compile. Common errors:
  - Duplicate default parameter on `applyWifiTxPower` — ensure the `.cpp` definition has no `= true`
  - `requestStreamStop` undeclared in Diagnostics.cpp — confirm `Audio.h` is included (it will be created in Task 10; use a forward declaration `bool requestStreamStop(const char*);` temporarily if needed, then remove after Task 10)

  **Note:** `Audio.h` does not exist yet. Add this temporary forward declaration block at the top of `Diagnostics.cpp` below the includes until Task 10 creates `Audio.h`:

  ```cpp
  // Temporary — replaced by #include "Audio.h" in Task 10
  bool requestStreamStop(const char* reason);
  void stopAudioCaptureTask();
  void restartI2S();
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/Diagnostics.h src/Diagnostics.cpp src/esp32_rtsp_mic_birdnetgo.ino
  git commit -m "extract Diagnostics module: temperature, performance, WiFi health, power helpers"
  ```

---

### Task 9: Create RTSP module; slim the .ino

**Files:**
- Create: `src/RTSP.h`
- Create: `src/RTSP.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create src/RTSP.h**

  ```cpp
  #pragma once

  #include <WiFi.h>

  void handleRTSPCommand(WiFiClient& client, String request);
  void processRTSP(WiFiClient& client);
  void drainRtspReceiveBuffer(WiFiClient& client);
  ```

- [ ] **Step 2: Create src/RTSP.cpp**

  ```cpp
  #include "RTSP.h"
  #include "SharedState.h"
  #include "Audio.h"   // startAudioCaptureTask, requestStreamStop
  ```

  **Note:** `Audio.h` does not exist yet. Add this temporary forward declaration block until Task 10:

  ```cpp
  // Temporary — replaced by #include "Audio.h" in Task 10
  void startAudioCaptureTask();
  bool requestStreamStop(const char* reason);
  ```

  Move these functions verbatim from the `.ino`:
  - `drainRtspReceiveBuffer()` — `.ino` lines 654–668
  - `handleRTSPCommand()` — `.ino` lines 1136–1230
  - `processRTSP()` — `.ino` lines 1232–1273

- [ ] **Step 3: Remove moved functions from the .ino; add includes**

  Delete the three function bodies from the `.ino`. Add to includes:

  ```cpp
  #include "RTSP.h"
  ```

- [ ] **Step 4: Verify build compiles**

  ```bash
  pio run
  ```

  Expected: clean compile.

- [ ] **Step 5: Commit**

  ```bash
  git add src/RTSP.h src/RTSP.cpp src/esp32_rtsp_mic_birdnetgo.ino
  git commit -m "extract RTSP module: handleRTSPCommand, processRTSP, drainRtspReceiveBuffer"
  ```

---

### Task 10: Create Audio module; slim the .ino

**Files:**
- Create: `src/Audio.h`
- Create: `src/Audio.cpp`
- Modify: `src/Diagnostics.cpp`
- Modify: `src/RTSP.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create src/Audio.h**

  ```cpp
  #pragma once

  #include <Arduino.h>
  #include <WiFi.h>

  struct Biquad {
      float b0{1.0f}, b1{0.0f}, b2{0.0f}, a1{0.0f}, a2{0.0f};
      float x1{0.0f}, x2{0.0f}, y1{0.0f}, y2{0.0f};
      inline float process(float x) {
          float y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
          x2 = x1; x1 = x; y2 = y1; y1 = y;
          return y;
      }
      inline void reset() { x1 = x2 = y1 = y2 = 0.0f; }
  };

  extern Biquad hpf;

  void updateHighpassCoeffs();
  void setup_i2s_driver();
  void audioCaptureTask(void* parameter);
  void startAudioCaptureTask();
  void stopAudioCaptureTask();
  bool requestStreamStop(const char* reason);
  void sendRTPPacket(WiFiClient& client, int16_t* audioData, int numSamples);
  void restartI2S();
  ```

- [ ] **Step 2: Create src/Audio.cpp**

  ```cpp
  #include "Audio.h"
  #include "SharedState.h"
  #include "driver/i2s.h"
  #include <M5Atom.h>
  #include <math.h>
  ```

  Move these functions verbatim from the `.ino`:
  - `updateHighpassCoeffs()` — `.ino` lines 222–258
  - `setup_i2s_driver()` — `.ino` lines 996–1039
  - `writeAll()` — `.ino` lines 1041–1058 (keep `static`; it is a private helper, not in the header)
  - `sendRTPPacket()` — `.ino` lines 1063–1128
  - `audioCaptureTask()` — `.ino` lines 674–921
  - `startAudioCaptureTask()` — `.ino` lines 923–943
  - `stopAudioCaptureTask()` — `.ino` lines 945–955
  - `requestStreamStop()` — `.ino` lines 957–994
  - `restartI2S()` — `.ino` lines 591–621

  Also move the file-scope statics used by `sendRTPPacket` (they sit just before it in the `.ino`):
  ```cpp
  static uint32_t consecutiveWriteFailures = 0;
  static const uint32_t MAX_WRITE_FAILURES = 100;
  ```

- [ ] **Step 3: Remove the Biquad struct from the .ino**

  In `src/esp32_rtsp_mic_birdnetgo.ino`, delete:
  - The `struct Biquad { ... };` definition (lines 106–115)
  - The `Biquad hpf;` global definition line — **keep it**, it is the definition of the `extern Biquad hpf` declared in `Audio.h`
  - The `hpfConfigSampleRate` and `hpfConfigCutoff` global definitions — **keep them**, they are defined in the `.ino` and declared `extern` in `SharedState.h`

  Delete the bodies of all nine functions listed in Step 2 from the `.ino`. Also delete the `consecutiveWriteFailures` and `MAX_WRITE_FAILURES` lines from the `.ino`.

  Add to includes at the top of the `.ino`:

  ```cpp
  #include "Audio.h"
  ```

- [ ] **Step 4: Replace temporary forward declarations in Diagnostics.cpp and RTSP.cpp**

  In `src/Diagnostics.cpp`, replace the temporary forward declarations added in Task 8 Step 4 with:
  ```cpp
  #include "Audio.h"
  ```

  In `src/RTSP.cpp`, replace the temporary forward declarations added in Task 9 Step 2 with:
  ```cpp
  #include "Audio.h"
  ```

- [ ] **Step 5: Verify build compiles**

  ```bash
  pio run
  ```

  Expected: clean compile. Common errors:
  - `Biquad` not found — confirm `Audio.h` is included in the `.ino` and `Biquad hpf;` definition is still in the `.ino`
  - Duplicate symbol for `writeAll` — confirm it is `static` in `Audio.cpp` and not in `Audio.h`
  - `M5` not found in `Audio.cpp` — confirm `#include <M5Atom.h>` is present

- [ ] **Step 6: Commit**

  ```bash
  git add src/Audio.h src/Audio.cpp src/Diagnostics.cpp src/RTSP.cpp src/esp32_rtsp_mic_birdnetgo.ino
  git commit -m "extract Audio module: I2S, pipeline task, RTP, DSP, restartI2S"
  ```

---

### Task 11: Update WebUI.cpp; final verification

**Files:**
- Modify: `src/WebUI.cpp`

WebUI.cpp currently has ~55 lines of `extern` declarations at the top (lines 8–93). These are replaced by four module includes. It also has two inline `extern` blocks inside function bodies that go away. Additionally, WebUI.cpp calls `updateHighpassCoeffs()` and `highpassEnabled`/`highpassCutoffHz` — those are now in `Audio.h` and `SharedState.h`.

- [ ] **Step 1: Replace extern declarations in WebUI.cpp**

  Delete all `extern` lines at the top of `WebUI.cpp` (everything between `// External variables and functions from main (.ino)` and the `// Local helper:` comment, approximately lines 7–93).

  Replace them with:

  ```cpp
  #include "SharedState.h"
  #include "Audio.h"       // updateHighpassCoeffs, restartI2S, requestStreamStop
  #include "Settings.h"    // saveAudioSettings, resetToDefaultSettings, scheduleReboot, computeRecommendedMinRate
  #include "Diagnostics.h" // applyWifiTxPower, wifiPowerLevelToDbm
  ```

- [ ] **Step 2: Remove inline extern declarations inside function bodies**

  In `httpAudioStatus()`: delete `extern bool highpassEnabled; extern uint16_t highpassCutoffHz;` — these are now in `SharedState.h`.

  In `httpSet()`: delete `extern float wifiTxPowerDbm;`, `extern bool scheduledResetEnabled;`, `extern uint32_t resetIntervalHours;`, `extern void updateHighpassCoeffs();`, `extern bool highpassEnabled;`, `extern uint16_t highpassCutoffHz;` — all now available via the includes above.

  Also in `httpActionServerStop()`: delete `extern WiFiClient* volatile streamClient;` and `extern bool requestStreamStop(const char* reason);` — both come from `SharedState.h` and `Audio.h`.

- [ ] **Step 3: Verify build compiles**

  ```bash
  pio run
  ```

  Expected: clean compile. Common errors:
  - Any remaining undeclared identifier — add the missing include or check SharedState.h coverage
  - Redefinition of a type — check for duplicate includes via `#pragma once` (all headers have it)

- [ ] **Step 4: Flash and do a final functional verification**

  ```bash
  pio run --target upload && pio device monitor -b 115200
  ```

  Verify:
  - Device boots, WiFi connects, RTSP server starts (check serial log)
  - Web UI loads at `http://<device-ip>/`; RTSP URL populates correctly
  - Gain, buffer size, HPF, AGC controls save and apply (confirm in serial log)
  - Start an RTSP stream with `ffplay rtsp://<device-ip>:8554/audio`; audio arrives
  - Reboot button works; factory reset button works

- [ ] **Step 5: Commit**

  ```bash
  git add src/WebUI.cpp
  git commit -m "replace WebUI.cpp extern soup with SharedState.h and module includes"
  ```

- [ ] **Step 6: Copy plan to main repo and commit**

  ```bash
  cp docs/superpowers/plans/2026-04-18-code-restructure.md \
     /Users/alex.jurkiewicz/personal/birdnetgo-m5stack-atom-echo-rtsp-mic/docs/superpowers/plans/
  ```

---

## Self-Review Notes

- **Spec coverage:** All spec requirements are covered: web content extraction (Tasks 1–5), build script (Task 4), SharedState.h (Task 6), all four modules (Tasks 7–10), WebUI.cpp cleanup (Task 11), `.gitignore` and `platformio.ini` changes (Task 5). RTSP URL JS injection covered in Task 2. `i2sShiftBits = 0` enforcement preserved — `loadAudioSettings()` hardcodes it (moved verbatim).
- **Temporary forward declarations:** Tasks 8 and 9 add temporary forward declarations for Audio functions that don't exist yet. Task 10 Step 4 replaces them with the real include. This keeps each task independently buildable.
- **Default parameter:** `applyWifiTxPower(bool log = true)` — default only in `Diagnostics.h`; definition in `Diagnostics.cpp` has `bool log` with no default. Noted explicitly in Task 8.
- **`static` removals:** `pickWifiPowerLevel` and `isTemperatureValid` were `static` in the `.ino`; they become non-static when moved to `Diagnostics.cpp` because they are declared in `Diagnostics.h`. `writeAll` stays `static` in `Audio.cpp` (private helper, not in header).
- **`hpf` global:** Defined in the `.ino` as `Biquad hpf;`. `Audio.h` declares `extern Biquad hpf;`. No circular include — `SharedState.h` does not reference `Biquad`; the `.ino` includes `Audio.h` before using `Biquad`.
