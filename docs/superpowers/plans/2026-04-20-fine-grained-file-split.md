# Fine-Grained File Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1713-line `.ino` monolith into 10 focused modules plus `globals.h`/`globals.cpp` shared state foundation, improving navigability without changing any behaviour.

**Architecture:** All shared global state moves from the `.ino` to `globals.h` (extern declarations) and `globals.cpp` (definitions). Each module is extracted from the `.ino` one task at a time — create the header + implementation file, remove the functions from the `.ino`, verify the build compiles cleanly, then commit. The `.ino` shrinks to ~200 lines containing only `setup()`, `loop()`, and `handleSerialCommand`.

**Tech Stack:** ESP32/Arduino, PlatformIO, FreeRTOS, ESP-IDF I2S driver. No unit-test framework — the build is the test. Build command: `pio run`. Expected: `SUCCESS` with no errors or warnings new to this refactor.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/AudioDSP.h` | `Biquad`, `DcBlocker` structs (inline methods), AGC + DC constants, `updateHighpassCoeffs()` declaration |
| Create | `src/AudioDSP.cpp` | `updateHighpassCoeffs()` implementation |
| Create | `src/globals.h` | `extern` declarations for every shared variable + `#define` constants + `AudioFrame` struct |
| Create | `src/globals.cpp` | Definitions of all variables declared in `globals.h` |
| Create | `src/Logging.h` | `simplePrint`, `simplePrintln`, `fillTimestamp`, `formatUptime`, `formatSince` declarations |
| Create | `src/Logging.cpp` | Implementation of logging helpers |
| Create | `src/WiFiUtils.h` | `wifiPowerLevelToDbm`, `pickWifiPowerLevel`, `applyWifiTxPower` declarations |
| Create | `src/WiFiUtils.cpp` | Implementation + static power level table |
| Create | `src/RTSPSender.h` | `rtspSenderTask`, `requestStreamStop`, `sendRTPPacket` declarations |
| Create | `src/RTSPSender.cpp` | Implementation (`writeAll` stays static) |
| Create | `src/Config.h` | `loadAudioSettings`, `saveAudioSettings`, `resetToDefaultSettings`, `computeRecommendedMinRate`, `scheduleReboot` declarations |
| Create | `src/Config.cpp` | Implementation |
| Create | `src/I2SDriver.h` | `setup_i2s_driver`, `restartI2S`, I2S pin `#define`s |
| Create | `src/I2SDriver.cpp` | Implementation |
| Create | `src/AudioTask.h` | `audioCaptureTask`, `stopAudioCaptureTask` declarations |
| Create | `src/AudioTask.cpp` | Implementation |
| Create | `src/RTSPProtocol.h` | `handleRTSPCommand`, `processRTSP`, `drainRtspReceiveBuffer` declarations |
| Create | `src/RTSPProtocol.cpp` | Implementation |
| Create | `src/Diagnostics.h` | `isTemperatureValid`, `persistOverheatNote`, `recordOverheatTrip`, `checkTemperature`, `checkPerformance`, `checkWiFiHealth`, `checkScheduledReset` declarations |
| Create | `src/Diagnostics.cpp` | Implementation |
| Modify | `src/WebUI.cpp` | Remove all `extern` declarations (top block + scattered inline), add `#include "globals.h"` + module headers |
| Modify | `src/esp32_rtsp_mic_birdnetgo.ino` | Each task removes extracted functions and adds the module `#include` |

---

## Task 1: Create AudioDSP.h

**Files:**
- Create: `src/AudioDSP.h`

AudioDSP.h must exist before globals.h, because globals.h includes it for the `Biquad` type used by the `hpf` extern.

- [ ] **Step 1: Create `src/AudioDSP.h`**

```cpp
#pragma once
#include <math.h>

// AGC constants (used by audioCaptureTask)
static constexpr float AGC_TARGET_RMS   = 0.15f;
static constexpr float AGC_MIN_MULT     = 0.1f;
static constexpr float AGC_MAX_MULT     = 10.0f;
static constexpr float AGC_ATTACK_RATE  = 0.05f;
static constexpr float AGC_RELEASE_RATE = 0.001f;

// DC blocker pole — fixed at 0.9999 for SPM1423 PDM microphone
static constexpr float DC_BLOCKER_R = 0.9999f;

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

struct DcBlocker {
    float x1{0.0f}, y1{0.0f};
    inline float process(float x) {
        float y = x - x1 + DC_BLOCKER_R * y1;
        x1 = x; y1 = y;
        return y;
    }
    inline void reset() { x1 = y1 = 0.0f; }
};

void updateHighpassCoeffs();
```

- [ ] **Step 2: Build**

```bash
pio run
```
Expected: `SUCCESS`. Nothing changed in compiled code — `AudioDSP.h` is not yet included anywhere.

- [ ] **Step 3: Commit**

```bash
git add src/AudioDSP.h
git commit -m "refactor: add AudioDSP.h with Biquad, DcBlocker, AGC constants"
```

---

## Task 2: Create globals.h + globals.cpp, update .ino includes

**Files:**
- Create: `src/globals.h`
- Create: `src/globals.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

This is the foundation task. All shared variable definitions move from the `.ino` to `globals.cpp`; `globals.h` declares them with `extern`. The `.ino` adds `#include "globals.h"` and removes the now-duplicated definitions.

- [ ] **Step 1: Create `src/globals.h`**

```cpp
#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include "AudioDSP.h"

// ================== FIRMWARE VERSION ==================
#define FW_VERSION "2.4.0"
extern const char* FW_VERSION_STR;

// ================== DEFAULT PARAMETERS ==================
#define DEFAULT_SAMPLE_RATE  48000
#define DEFAULT_GAIN_FACTOR  3.0f
#define DEFAULT_BUFFER_SIZE  6144
#define MAX_BUFFER_SIZE      6144
#define DEFAULT_WIFI_TX_DBM  19.5f
#define DEFAULT_HPF_ENABLED  true
#define DEFAULT_HPF_CUTOFF_HZ 80
#define DEFAULT_MDNS_HOSTNAME "atomecho"
#define DEFAULT_OVERHEAT_PROTECTION true
#define DEFAULT_OVERHEAT_LIMIT_C 80
#define OVERHEAT_MIN_LIMIT_C 30
#define OVERHEAT_MAX_LIMIT_C 95
#define OVERHEAT_LIMIT_STEP_C 5

// ================== INTER-CORE AUDIO QUEUE ==================
#define AUDIO_POOL_DEPTH 4

struct AudioFrame {
    int16_t* data;
    uint16_t samples;
};

extern int16_t*    audioFrameStorage[AUDIO_POOL_DEPTH];
extern AudioFrame  audioFramePool[AUDIO_POOL_DEPTH];
extern QueueHandle_t audioReadyQueue;
extern QueueHandle_t audioFreePool;

// ================== CROSS-CORE SYNC ==================
extern portMUX_TYPE          logMux;
extern volatile bool         stopStreamRequested;
extern SemaphoreHandle_t     senderExitSemaphore;
extern SemaphoreHandle_t     taskExitSemaphore;
extern volatile bool         core1OwnsLED;

// ================== TASK HANDLES ==================
extern TaskHandle_t   audioCaptureTaskHandle;
extern volatile bool  audioTaskRunning;
extern TaskHandle_t   rtspSenderTaskHandle;

// ================== RTSP STATE ==================
extern WiFiServer     rtspServer;
extern WiFiClient     rtspClient;
extern String         rtspSessionId;
extern uint16_t       rtpSequence;
extern uint32_t       rtpTimestamp;
extern uint32_t       rtpSSRC;
extern unsigned long  lastRTSPActivity;
extern uint8_t        rtspParseBuffer[1024];
extern int            rtspParseBufferPos;

// ================== STREAM STATS ==================
extern unsigned long  audioPacketsSent;
extern unsigned long  audioPacketsDropped;
extern unsigned long  lastStatsReset;
extern bool           rtspServerEnabled;
extern unsigned long  lastRtspClientConnectMs;
extern unsigned long  lastRtspPlayMs;
extern uint32_t       rtspConnectCount;
extern uint32_t       rtspPlayCount;

// ================== AUDIO CONFIG ==================
extern uint32_t  currentSampleRate;
extern float     currentGainFactor;
extern uint16_t  currentBufferSize;
extern uint8_t   i2sShiftBits;

// ================== AUDIO METERING ==================
extern uint16_t      lastPeakAbs16;
extern uint32_t      audioClipCount;
extern bool          audioClippedLastBlock;
extern uint16_t      peakHoldAbs16;
extern unsigned long peakHoldUntilMs;

// ================== LED ==================
extern uint8_t ledMode;

// ================== AGC ==================
extern bool          agcEnabled;
extern volatile float agcMultiplier;

// ================== HIGH-PASS FILTER ==================
extern bool     dcBlockerEnabled;
extern bool     highpassEnabled;
extern uint16_t highpassCutoffHz;
extern Biquad   hpf;
extern uint32_t hpfConfigSampleRate;
extern uint16_t hpfConfigCutoff;

// ================== mDNS ==================
extern String mdnsHostname;

// ================== PREFERENCES ==================
extern Preferences audioPrefs;

// ================== DIAGNOSTICS TIMERS ==================
extern unsigned long lastMemoryCheck;
extern unsigned long lastPerformanceCheck;
extern unsigned long lastCore0StatsLog;
extern unsigned long lastWiFiCheck;
extern unsigned long lastNetworkActivity;
extern unsigned long lastTempCheck;
extern uint32_t      minFreeHeap;
extern uint32_t      maxPacketRate;
extern uint32_t      minPacketRate;
extern bool          autoRecoveryEnabled;
extern bool          autoThresholdEnabled;
extern volatile bool          scheduledFactoryReset;
extern volatile unsigned long scheduledRebootAt;
extern unsigned long bootTime;
extern unsigned long lastI2SReset;

// ================== TEMPERATURE ==================
extern float         maxTemperature;
extern float         lastTemperatureC;
extern bool          lastTemperatureValid;
extern bool          overheatProtectionEnabled;
extern float         overheatShutdownC;
extern bool          overheatLockoutActive;
extern float         overheatTripTemp;
extern unsigned long overheatTriggeredAt;
extern String        overheatLastReason;
extern String        overheatLastTimestamp;
extern bool          overheatSensorFault;
extern bool          overheatLatched;

// ================== SCHEDULED RESET ==================
extern bool     scheduledResetEnabled;
extern uint32_t resetIntervalHours;

// ================== CONFIGURABLE THRESHOLDS ==================
extern uint32_t minAcceptableRate;
extern uint32_t performanceCheckInterval;
extern uint8_t  cpuFrequencyMhz;

// ================== WIFI TX POWER ==================
extern float         wifiTxPowerDbm;
extern wifi_power_t  currentWifiPowerLevel;
```

- [ ] **Step 2: Create `src/globals.cpp`**

```cpp
#include "globals.h"

const char* FW_VERSION_STR = FW_VERSION;

// Audio pool
int16_t*     audioFrameStorage[AUDIO_POOL_DEPTH];
AudioFrame   audioFramePool[AUDIO_POOL_DEPTH];
QueueHandle_t audioReadyQueue = NULL;
QueueHandle_t audioFreePool   = NULL;

// Cross-core sync
portMUX_TYPE     logMux              = portMUX_INITIALIZER_UNLOCKED;
volatile bool    stopStreamRequested = false;
SemaphoreHandle_t senderExitSemaphore = NULL;
SemaphoreHandle_t taskExitSemaphore   = NULL;
volatile bool    core1OwnsLED        = false;

// Task handles
TaskHandle_t  audioCaptureTaskHandle = NULL;
volatile bool audioTaskRunning       = false;
TaskHandle_t  rtspSenderTaskHandle   = NULL;

// RTSP state
WiFiServer   rtspServer(8554);
WiFiClient   rtspClient;
String       rtspSessionId      = "";
uint16_t     rtpSequence        = 0;
uint32_t     rtpTimestamp       = 0;
uint32_t     rtpSSRC            = 0x43215678;
unsigned long lastRTSPActivity  = 0;
uint8_t      rtspParseBuffer[1024];
int          rtspParseBufferPos = 0;

// Stream stats
unsigned long audioPacketsSent      = 0;
unsigned long audioPacketsDropped   = 0;
unsigned long lastStatsReset        = 0;
bool          rtspServerEnabled     = true;
unsigned long lastRtspClientConnectMs = 0;
unsigned long lastRtspPlayMs        = 0;
uint32_t      rtspConnectCount      = 0;
uint32_t      rtspPlayCount         = 0;

// Audio config
uint32_t currentSampleRate = DEFAULT_SAMPLE_RATE;
float    currentGainFactor = DEFAULT_GAIN_FACTOR;
uint16_t currentBufferSize = DEFAULT_BUFFER_SIZE;
uint8_t  i2sShiftBits      = 0;

// Audio metering
uint16_t      lastPeakAbs16      = 0;
uint32_t      audioClipCount     = 0;
bool          audioClippedLastBlock = false;
uint16_t      peakHoldAbs16      = 0;
unsigned long peakHoldUntilMs    = 0;

// LED
uint8_t ledMode = 1;

// AGC
bool          agcEnabled    = false;
volatile float agcMultiplier = 1.0f;

// High-pass filter
bool     dcBlockerEnabled   = true;
bool     highpassEnabled    = DEFAULT_HPF_ENABLED;
uint16_t highpassCutoffHz   = DEFAULT_HPF_CUTOFF_HZ;
Biquad   hpf;
uint32_t hpfConfigSampleRate = 0;
uint16_t hpfConfigCutoff     = 0;

// mDNS
String mdnsHostname = DEFAULT_MDNS_HOSTNAME;

// Preferences
Preferences audioPrefs;

// Diagnostics timers
unsigned long lastMemoryCheck      = 0;
unsigned long lastPerformanceCheck = 0;
unsigned long lastCore0StatsLog    = 0;
unsigned long lastWiFiCheck        = 0;
unsigned long lastNetworkActivity  = 0;
unsigned long lastTempCheck        = 0;
uint32_t      minFreeHeap          = 0xFFFFFFFF;
uint32_t      maxPacketRate        = 0;
uint32_t      minPacketRate        = 0xFFFFFFFF;
bool          autoRecoveryEnabled  = false;
bool          autoThresholdEnabled = true;
volatile bool          scheduledFactoryReset = false;
volatile unsigned long scheduledRebootAt     = 0;
unsigned long bootTime    = 0;
unsigned long lastI2SReset = 0;

// Temperature
float         maxTemperature          = 0.0f;
float         lastTemperatureC        = 0.0f;
bool          lastTemperatureValid    = false;
bool          overheatProtectionEnabled = DEFAULT_OVERHEAT_PROTECTION;
float         overheatShutdownC       = (float)DEFAULT_OVERHEAT_LIMIT_C;
bool          overheatLockoutActive   = false;
float         overheatTripTemp        = 0.0f;
unsigned long overheatTriggeredAt     = 0;
String        overheatLastReason      = "";
String        overheatLastTimestamp   = "";
bool          overheatSensorFault     = false;
bool          overheatLatched         = false;

// Scheduled reset
bool     scheduledResetEnabled = false;
uint32_t resetIntervalHours    = 24;

// Configurable thresholds
uint32_t minAcceptableRate       = 50;
uint32_t performanceCheckInterval = 15;
uint8_t  cpuFrequencyMhz         = 160;

// WiFi TX power
float        wifiTxPowerDbm      = DEFAULT_WIFI_TX_DBM;
wifi_power_t currentWifiPowerLevel = WIFI_POWER_19_5dBm;
```

- [ ] **Step 3: Update `src/esp32_rtsp_mic_birdnetgo.ino` — add include, remove variable definitions**

At the top of the `.ino`, change the includes block to:

```cpp
#include <WiFi.h>
#include "esp_system.h"
#include "esp_core_dump.h"
#include <WiFiManager.h>
#include <ESPmDNS.h>
#include "driver/i2s.h"
#include <Preferences.h>
#include <math.h>
#include <M5Atom.h>
#include "WebUI.h"
#include <sys/socket.h>
#include "globals.h"
```

Then delete the block of global variable and struct definitions from the `.ino`. Specifically, remove everything from `TaskHandle_t audioCaptureTaskHandle = NULL;` (the first variable definition, ~line 18) down through `wifi_power_t currentWifiPowerLevel = WIFI_POWER_19_5dBm;` (the last variable definition, ~line 208), including:
- The `// ===== DUAL-CORE AUDIO ARCHITECTURE =====` comment block and all variable definitions beneath it
- The `struct AudioFrame { ... };` definition
- The `Biquad { ... }` struct definition
- The `static const float DC_BLOCKER_R` constant
- The `struct DcBlocker { ... }` definition
- The `#define AUDIO_POOL_DEPTH`, `#define FW_VERSION`, `#define DEFAULT_*`, `#define OVERHEAT_*` macros
- All `QueueHandle_t`, `portMUX_TYPE`, `SemaphoreHandle_t`, `volatile bool`, `TaskHandle_t`, `WiFiServer`, `WiFiClient`, `String`, `uint*`, `float`, `bool`, `Preferences`, `unsigned long` variable definitions in that block

Do NOT remove: function definitions, `setup()`, `loop()`, or the I2S pin `#define`s (those move later in Task 8).

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`. The `.ino` functions still compile; they now get globals via `globals.h`.

- [ ] **Step 5: Commit**

```bash
git add src/globals.h src/globals.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: centralize all shared globals into globals.h + globals.cpp"
```

---

## Task 3: Create AudioDSP.cpp, remove updateHighpassCoeffs from .ino

**Files:**
- Create: `src/AudioDSP.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create `src/AudioDSP.cpp`**

```cpp
#include "AudioDSP.h"
#include "globals.h"

void updateHighpassCoeffs() {
    if (!highpassEnabled) {
        hpf.reset();
        hpfConfigSampleRate = currentSampleRate;
        hpfConfigCutoff = highpassCutoffHz;
        return;
    }
    float fs = (float)currentSampleRate;
    float fc = (float)highpassCutoffHz;
    if (fc < 10.0f) fc = 10.0f;
    if (fc > fs * 0.45f) fc = fs * 0.45f;

    const float pi = 3.14159265358979323846f;
    float w0    = 2.0f * pi * (fc / fs);
    float cosw0 = cosf(w0);
    float sinw0 = sinf(w0);
    float Q     = 0.70710678f;
    float alpha = sinw0 / (2.0f * Q);

    float b0 =  (1.0f + cosw0) * 0.5f;
    float b1 = -(1.0f + cosw0);
    float b2 =  (1.0f + cosw0) * 0.5f;
    float a0 =  1.0f + alpha;
    float a1 = -2.0f * cosw0;
    float a2 =  1.0f - alpha;

    hpf.b0 = b0 / a0;
    hpf.b1 = b1 / a0;
    hpf.b2 = b2 / a0;
    hpf.a1 = a1 / a0;
    hpf.a2 = a2 / a0;
    hpf.reset();

    hpfConfigSampleRate = currentSampleRate;
    hpfConfigCutoff = (uint16_t)fc;
}
```

- [ ] **Step 2: Add `#include "AudioDSP.h"` to `.ino` includes and remove `updateHighpassCoeffs` from `.ino`**

In the includes block at the top of the `.ino`, add:
```cpp
#include "AudioDSP.h"
```

Then delete the entire `void updateHighpassCoeffs() { ... }` function body from the `.ino`.

- [ ] **Step 3: Build**

```bash
pio run
```
Expected: `SUCCESS`.

- [ ] **Step 4: Commit**

```bash
git add src/AudioDSP.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: move updateHighpassCoeffs to AudioDSP.cpp"
```

---

## Task 4: Create Logging.h + Logging.cpp, update .ino

**Files:**
- Create: `src/Logging.h`
- Create: `src/Logging.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create `src/Logging.h`**

```cpp
#pragma once
#include <Arduino.h>

String formatUptime(unsigned long seconds);
String formatSince(unsigned long eventMs);
void   simplePrint(String message);
void   simplePrintln(String message);
void   fillTimestamp(char* buf, size_t len);
```

- [ ] **Step 2: Create `src/Logging.cpp`**

```cpp
#include "Logging.h"
#include "globals.h"

extern void webui_pushLog(const String &line);

static String logTimestamp() {
    time_t now;
    time(&now);
    if (now > 100000) {
        struct tm ti;
        localtime_r(&now, &ti);
        char buf[24];
        strftime(buf, sizeof(buf), "[%H:%M:%S] ", &ti);
        return String(buf);
    }
    unsigned long s = (millis() - bootTime) / 1000;
    unsigned long h = s / 3600; s %= 3600;
    unsigned long m = s / 60;   s %= 60;
    char buf[16];
    snprintf(buf, sizeof(buf), "[%02lu:%02lu:%02lu] ", h, m, s);
    return String(buf);
}

void fillTimestamp(char* buf, size_t len) {
    unsigned long s = (millis() - bootTime) / 1000;
    unsigned long h = s / 3600; s %= 3600;
    unsigned long m = s / 60;   s %= 60;
    snprintf(buf, len, "[%02lu:%02lu:%02lu] ", h, m, s);
}

void simplePrint(String message) {
    Serial.print(logTimestamp() + message);
}

void simplePrintln(String message) {
    String stamped = logTimestamp() + message;
    Serial.println(stamped);
    webui_pushLog(stamped);
}

String formatUptime(unsigned long seconds) {
    unsigned long days    = seconds / 86400; seconds %= 86400;
    unsigned long hours   = seconds / 3600;  seconds %= 3600;
    unsigned long minutes = seconds / 60;    seconds %= 60;
    String result = "";
    if (days > 0)                            result += String(days)    + "d ";
    if (hours > 0 || days > 0)              result += String(hours)   + "h ";
    if (minutes > 0 || hours > 0 || days > 0) result += String(minutes) + "m ";
    result += String(seconds) + "s";
    return result;
}

String formatSince(unsigned long eventMs) {
    if (eventMs == 0) return String("never");
    unsigned long seconds = (millis() - eventMs) / 1000;
    return formatUptime(seconds) + " ago";
}
```

- [ ] **Step 3: Update `.ino` — add include, remove logging functions**

Add to the includes block:
```cpp
#include "Logging.h"
```

Remove the following functions from the `.ino`:
- `static String logTimestamp() { ... }`
- `static void fillTimestamp(char* buf, size_t len) { ... }`
- `void simplePrint(String message) { ... }`
- `void simplePrintln(String message) { ... }`
- `String formatUptime(unsigned long seconds) { ... }`
- `String formatSince(unsigned long eventMs) { ... }`

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/Logging.h src/Logging.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: move logging helpers to Logging.h/cpp"
```

---

## Task 5: Create WiFiUtils.h + WiFiUtils.cpp, update .ino

**Files:**
- Create: `src/WiFiUtils.h`
- Create: `src/WiFiUtils.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create `src/WiFiUtils.h`**

```cpp
#pragma once
#include <WiFi.h>

float        wifiPowerLevelToDbm(wifi_power_t lvl);
wifi_power_t pickWifiPowerLevel(float dbm);
void         applyWifiTxPower(bool log = true);
```

- [ ] **Step 2: Create `src/WiFiUtils.cpp`**

```cpp
#include "WiFiUtils.h"
#include "globals.h"
#include "Logging.h"

static const wifi_power_t wifiPowerLevels[] = {
    WIFI_POWER_MINUS_1dBm, WIFI_POWER_2dBm,  WIFI_POWER_5dBm,
    WIFI_POWER_7dBm,       WIFI_POWER_8_5dBm, WIFI_POWER_11dBm,
    WIFI_POWER_13dBm,      WIFI_POWER_15dBm,  WIFI_POWER_17dBm,
    WIFI_POWER_18_5dBm,    WIFI_POWER_19dBm,  WIFI_POWER_19_5dBm
};

float wifiPowerLevelToDbm(wifi_power_t lvl) {
    switch (lvl) {
        case WIFI_POWER_19_5dBm:    return 19.5f;
        case WIFI_POWER_19dBm:      return 19.0f;
        case WIFI_POWER_18_5dBm:    return 18.5f;
        case WIFI_POWER_17dBm:      return 17.0f;
        case WIFI_POWER_15dBm:      return 15.0f;
        case WIFI_POWER_13dBm:      return 13.0f;
        case WIFI_POWER_11dBm:      return 11.0f;
        case WIFI_POWER_8_5dBm:     return 8.5f;
        case WIFI_POWER_7dBm:       return 7.0f;
        case WIFI_POWER_5dBm:       return 5.0f;
        case WIFI_POWER_2dBm:       return 2.0f;
        case WIFI_POWER_MINUS_1dBm: return -1.0f;
        default:                    return 19.5f;
    }
}

wifi_power_t pickWifiPowerLevel(float dbm) {
    if (dbm <= -1.0f) return WIFI_POWER_MINUS_1dBm;
    if (dbm <=  2.0f) return WIFI_POWER_2dBm;
    if (dbm <=  5.0f) return WIFI_POWER_5dBm;
    if (dbm <=  7.0f) return WIFI_POWER_7dBm;
    if (dbm <=  8.5f) return WIFI_POWER_8_5dBm;
    if (dbm <= 11.0f) return WIFI_POWER_11dBm;
    if (dbm <= 13.0f) return WIFI_POWER_13dBm;
    if (dbm <= 15.0f) return WIFI_POWER_15dBm;
    if (dbm <= 17.0f) return WIFI_POWER_17dBm;
    if (dbm <= 18.5f) return WIFI_POWER_18_5dBm;
    if (dbm <= 19.0f) return WIFI_POWER_19dBm;
    return WIFI_POWER_19_5dBm;
}

void applyWifiTxPower(bool log) {
    wifi_power_t desired = pickWifiPowerLevel(wifiTxPowerDbm);
    if (desired != currentWifiPowerLevel) {
        WiFi.setTxPower(desired);
        currentWifiPowerLevel = desired;
        if (log) {
            simplePrintln("WiFi TX power set to " + String(wifiPowerLevelToDbm(currentWifiPowerLevel), 1) + " dBm");
        }
    }
}
```

- [ ] **Step 3: Update `.ino` — add include, remove WiFi util functions**

Add to the includes block:
```cpp
#include "WiFiUtils.h"
```

Remove the following from the `.ino`:
- `float wifiPowerLevelToDbm(wifi_power_t lvl) { ... }`
- `static wifi_power_t pickWifiPowerLevel(float dbm) { ... }`
- `static const wifi_power_t wifiPowerLevels[] = { ... };` and `static const int wifiPowerLevelsCount = 12;`
- `void applyWifiTxPower(bool log) { ... }`

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/WiFiUtils.h src/WiFiUtils.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: move WiFi TX power helpers to WiFiUtils.h/cpp"
```

---

## Task 6: Create RTSPSender.h + RTSPSender.cpp, update .ino

**Files:**
- Create: `src/RTSPSender.h`
- Create: `src/RTSPSender.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

RTSPSender is extracted before Config and I2SDriver because both of those call `requestStreamStop`.

- [ ] **Step 1: Create `src/RTSPSender.h`**

```cpp
#pragma once
#include <WiFiClient.h>

void rtspSenderTask(void* parameter);
bool requestStreamStop(const char* reason);
bool sendRTPPacket(WiFiClient &client, int16_t* audioData, int numSamples);
```

- [ ] **Step 2: Create `src/RTSPSender.cpp`**

```cpp
#include "RTSPSender.h"
#include "globals.h"
#include "Logging.h"
#include "AudioTask.h"
#include <M5Atom.h>
#include <sys/socket.h>

static bool writeAll(int sock, const uint8_t* data, size_t len) {
    size_t off = 0;
    while (off < len) {
        int w = send(sock, data + off, len - off, 0);
        if (w <= 0) return false;
        off += (size_t)w;
    }
    return true;
}

bool sendRTPPacket(WiFiClient &client, int16_t* audioData, int numSamples) {
    int sock = client.fd();
    if (sock < 0) return false;

    const uint16_t payloadSize = (uint16_t)(numSamples * (int)sizeof(int16_t));
    const uint16_t packetSize  = (uint16_t)(12 + payloadSize);

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

bool requestStreamStop(const char* reason) {
    if (rtspSenderTaskHandle == NULL) return true;

    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Core0] requestStreamStop: %s\n", ts, reason); }

    stopStreamRequested = true;
    __asm__ __volatile__("memw" ::: "memory");

    bool senderExited = (xSemaphoreTake(senderExitSemaphore, pdMS_TO_TICKS(2000)) == pdTRUE);
    if (!senderExited) {
        char ts[16]; fillTimestamp(ts, sizeof(ts));
        Serial.printf("%s[Core0] WARNING: Sender task did not exit within 2s, force-killing: %s\n", ts, reason);
        vTaskDelete(rtspSenderTaskHandle);
        xSemaphoreTake(senderExitSemaphore, 0);
    }
    rtspSenderTaskHandle = NULL;
    stopStreamRequested = false;
    __asm__ __volatile__("memw" ::: "memory");

    stopAudioCaptureTask();
    rtspParseBufferPos = 0;

    if (!core1OwnsLED) {
        if (ledMode > 0) M5.dis.drawpix(0, CRGB(0, 0, 128));
        else             M5.dis.drawpix(0, CRGB(0, 0, 0));
    }

    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Core0] Stream stopped: %s\n", ts, reason); }
    return true;
}

void rtspSenderTask(void* parameter) {
    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Sender] RTSP sender task started\n", ts); }

    int sock = rtspClient.fd();
    uint8_t ctrlBuf[512];
    int ctrlBufPos = 0;

    while (!stopStreamRequested) {
        if (sock < 0) break;

        fd_set rfds, wfds;
        FD_ZERO(&rfds);
        FD_ZERO(&wfds);
        FD_SET(sock, &rfds);

        AudioFrame* frame = NULL;
        bool frameReady = (xQueuePeek(audioReadyQueue, &frame, 0) == pdTRUE);
        if (frameReady) FD_SET(sock, &wfds);

        struct timeval tv = {0, 100000};
        int sel = select(sock + 1, &rfds, frameReady ? &wfds : NULL, NULL, &tv);

        if (sel < 0) break;

        if (sel > 0 && FD_ISSET(sock, &rfds)) {
            int space = (int)sizeof(ctrlBuf) - ctrlBufPos - 1;
            int n = recv(sock, ctrlBuf + ctrlBufPos, space > 0 ? space : 0, MSG_DONTWAIT);
            if (n <= 0) break;
            ctrlBufPos += n;
            ctrlBuf[ctrlBufPos] = '\0';

            if (ctrlBufPos >= (int)sizeof(ctrlBuf) - 1) {
                ctrlBufPos = 0;
                continue;
            }

            char* eoh = strstr((char*)ctrlBuf, "\r\n\r\n");
            if (eoh) {
                *eoh = '\0';
                String req = String((char*)ctrlBuf);
                int hlen = (eoh - (char*)ctrlBuf) + 4;
                int rem  = ctrlBufPos - hlen;
                if (rem > 0) memmove(ctrlBuf, ctrlBuf + hlen, rem);
                ctrlBufPos = rem;

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
            }
        }

        if (sel > 0 && frameReady && FD_ISSET(sock, &wfds)) {
            if (xQueueReceive(audioReadyQueue, &frame, 0) == pdTRUE) {
                bool ok = sendRTPPacket(rtspClient, frame->data, frame->samples);
                xQueueSend(audioFreePool, &frame, 0);
                if (!ok) break;
            }
        }
    }

    {
        AudioFrame* frame = NULL;
        while (xQueueReceive(audioReadyQueue, &frame, 0) == pdTRUE) {
            xQueueSend(audioFreePool, &frame, 0);
        }
    }

    rtspClient.stop();
    core1OwnsLED = false;
    __asm__ __volatile__("memw" ::: "memory");

    unsigned long sessionSec = (millis() - lastRtspPlayMs) / 1000;
    { char ts[16]; fillTimestamp(ts, sizeof(ts));
      Serial.printf("%s[Sender] Stream ended (session %lus, sent=%lu dropped=%lu)\n",
                    ts, sessionSec, audioPacketsSent, audioPacketsDropped); }

    audioTaskRunning = false;
    __asm__ __volatile__("memw" ::: "memory");
    xSemaphoreGive(senderExitSemaphore);
    vTaskDelete(NULL);
}
```


- [ ] **Step 3: Update `.ino` — add include, remove sender functions**

Add to the includes block:
```cpp
#include "RTSPSender.h"
```

Remove from the `.ino`:
- `static bool writeAll(int sock, const uint8_t* data, size_t len) { ... }`
- `bool sendRTPPacket(WiFiClient &client, int16_t* audioData, int numSamples) { ... }`
- `bool requestStreamStop(const char* reason) { ... }`
- `void rtspSenderTask(void* parameter) { ... }`

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/RTSPSender.h src/RTSPSender.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: move RTSP sender task and RTP helpers to RTSPSender.h/cpp"
```

---

## Task 7: Create Config.h + Config.cpp, update .ino

**Files:**
- Create: `src/Config.h`
- Create: `src/Config.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create `src/Config.h`**

```cpp
#pragma once

void     loadAudioSettings();
void     saveAudioSettings();
void     resetToDefaultSettings();
uint32_t computeRecommendedMinRate();
void     scheduleReboot(bool factoryReset, uint32_t delayMs);
```

- [ ] **Step 2: Create `src/Config.cpp`**

```cpp
#include "Config.h"
#include "globals.h"
#include "Logging.h"
#include "WiFiUtils.h"
#include "RTSPSender.h"
#include "AudioDSP.h"

uint32_t computeRecommendedMinRate() {
    uint32_t buf = max((uint16_t)1, currentBufferSize);
    float expectedPktPerSec = (float)currentSampleRate / (float)buf;
    uint32_t rec = (uint32_t)(expectedPktPerSec * 0.5f + 0.5f);
    if (rec < 5) rec = 5;
    return rec;
}

void scheduleReboot(bool factoryReset, uint32_t delayMs) {
    scheduledFactoryReset = factoryReset;
    scheduledRebootAt = millis() + delayMs;
}

void loadAudioSettings() {
    audioPrefs.begin("audio", false);
    currentSampleRate  = audioPrefs.getUInt("sampleRate", DEFAULT_SAMPLE_RATE);
    currentGainFactor  = audioPrefs.getFloat("gainFactor", DEFAULT_GAIN_FACTOR);
    currentBufferSize  = audioPrefs.getUShort("bufferSize", DEFAULT_BUFFER_SIZE);
    if (currentBufferSize > MAX_BUFFER_SIZE) currentBufferSize = MAX_BUFFER_SIZE;
    i2sShiftBits = 0;
    autoRecoveryEnabled   = audioPrefs.getBool("autoRecovery", false);
    scheduledResetEnabled = audioPrefs.getBool("schedReset", false);
    resetIntervalHours    = audioPrefs.getUInt("resetHours", 24);
    minAcceptableRate     = audioPrefs.getUInt("minRate", 50);
    performanceCheckInterval = audioPrefs.getUInt("checkInterval", 15);
    autoThresholdEnabled  = audioPrefs.getBool("thrAuto", true);
    cpuFrequencyMhz       = audioPrefs.getUChar("cpuFreq", 160);
    wifiTxPowerDbm        = audioPrefs.getFloat("wifiTxDbm", DEFAULT_WIFI_TX_DBM);
    dcBlockerEnabled      = audioPrefs.getBool("dcBlock", true);
    highpassEnabled       = audioPrefs.getBool("hpEnable", DEFAULT_HPF_ENABLED);
    highpassCutoffHz      = (uint16_t)audioPrefs.getUInt("hpCutoff", DEFAULT_HPF_CUTOFF_HZ);
    agcEnabled            = audioPrefs.getBool("agcEnable", false);
    ledMode               = audioPrefs.getUChar("ledMode", 1);
    if (ledMode > 2) ledMode = 1;
    overheatProtectionEnabled = audioPrefs.getBool("ohEnable", DEFAULT_OVERHEAT_PROTECTION);
    uint32_t ohLimit = audioPrefs.getUInt("ohThresh", DEFAULT_OVERHEAT_LIMIT_C);
    if (ohLimit < OVERHEAT_MIN_LIMIT_C) ohLimit = OVERHEAT_MIN_LIMIT_C;
    if (ohLimit > OVERHEAT_MAX_LIMIT_C) ohLimit = OVERHEAT_MAX_LIMIT_C;
    ohLimit = OVERHEAT_MIN_LIMIT_C + ((ohLimit - OVERHEAT_MIN_LIMIT_C) / OVERHEAT_LIMIT_STEP_C) * OVERHEAT_LIMIT_STEP_C;
    overheatShutdownC       = (float)ohLimit;
    overheatLastReason      = audioPrefs.getString("ohReason", "");
    overheatLastTimestamp   = audioPrefs.getString("ohStamp", "");
    overheatTripTemp        = audioPrefs.getFloat("ohTripC", 0.0f);
    overheatLatched         = audioPrefs.getBool("ohLatched", false);
    mdnsHostname            = audioPrefs.getString("mdnsHost", DEFAULT_MDNS_HOSTNAME);
    if (mdnsHostname.length() == 0) mdnsHostname = DEFAULT_MDNS_HOSTNAME;
    audioPrefs.end();

    if (autoThresholdEnabled) {
        minAcceptableRate = computeRecommendedMinRate();
    }
    if (overheatLatched) {
        rtspServerEnabled = false;
    }
    float txShown = wifiPowerLevelToDbm(pickWifiPowerLevel(wifiTxPowerDbm));
    simplePrintln("Loaded settings: Rate=" + String(currentSampleRate) +
                  ", Gain=" + String(currentGainFactor, 1) +
                  ", Buffer=" + String(currentBufferSize) +
                  ", WiFiTX=" + String(txShown, 1) + "dBm" +
                  ", shiftBits=" + String(i2sShiftBits) +
                  ", HPF=" + String(highpassEnabled?"on":"off") +
                  ", HPFcut=" + String(highpassCutoffHz) + "Hz");
}

void saveAudioSettings() {
    audioPrefs.begin("audio", false);
    audioPrefs.putUInt("sampleRate", currentSampleRate);
    audioPrefs.putFloat("gainFactor", currentGainFactor);
    audioPrefs.putUShort("bufferSize", currentBufferSize);
    audioPrefs.putUChar("shiftBits", i2sShiftBits);
    audioPrefs.putBool("autoRecovery", autoRecoveryEnabled);
    audioPrefs.putBool("schedReset", scheduledResetEnabled);
    audioPrefs.putUInt("resetHours", resetIntervalHours);
    audioPrefs.putUInt("minRate", minAcceptableRate);
    audioPrefs.putUInt("checkInterval", performanceCheckInterval);
    audioPrefs.putBool("thrAuto", autoThresholdEnabled);
    audioPrefs.putUChar("cpuFreq", cpuFrequencyMhz);
    audioPrefs.putFloat("wifiTxDbm", wifiTxPowerDbm);
    audioPrefs.putBool("dcBlock", dcBlockerEnabled);
    audioPrefs.putBool("hpEnable", highpassEnabled);
    audioPrefs.putUInt("hpCutoff", (uint32_t)highpassCutoffHz);
    audioPrefs.putBool("agcEnable", agcEnabled);
    audioPrefs.putUChar("ledMode", ledMode);
    audioPrefs.putBool("ohEnable", overheatProtectionEnabled);
    uint32_t ohLimit = (uint32_t)(overheatShutdownC + 0.5f);
    if (ohLimit < OVERHEAT_MIN_LIMIT_C) ohLimit = OVERHEAT_MIN_LIMIT_C;
    if (ohLimit > OVERHEAT_MAX_LIMIT_C) ohLimit = OVERHEAT_MAX_LIMIT_C;
    audioPrefs.putUInt("ohThresh", ohLimit);
    audioPrefs.putString("ohReason", overheatLastReason);
    audioPrefs.putString("ohStamp", overheatLastTimestamp);
    audioPrefs.putFloat("ohTripC", overheatTripTemp);
    audioPrefs.putBool("ohLatched", overheatLatched);
    audioPrefs.putString("mdnsHost", mdnsHostname);
    audioPrefs.end();
    simplePrintln("Settings saved to flash");
}

void resetToDefaultSettings() {
    simplePrintln("FACTORY RESET: Restoring default settings...");

    audioPrefs.begin("audio", false);
    audioPrefs.clear();
    audioPrefs.end();

    currentSampleRate = DEFAULT_SAMPLE_RATE;
    currentGainFactor = DEFAULT_GAIN_FACTOR;
    currentBufferSize = DEFAULT_BUFFER_SIZE;
    i2sShiftBits = 0;
    autoRecoveryEnabled   = false;
    autoThresholdEnabled  = true;
    scheduledResetEnabled = false;
    resetIntervalHours    = 24;
    minAcceptableRate     = computeRecommendedMinRate();
    performanceCheckInterval = 15;
    cpuFrequencyMhz       = 160;
    wifiTxPowerDbm        = DEFAULT_WIFI_TX_DBM;
    dcBlockerEnabled      = true;
    highpassEnabled       = DEFAULT_HPF_ENABLED;
    highpassCutoffHz      = DEFAULT_HPF_CUTOFF_HZ;
    agcEnabled            = false;
    agcMultiplier         = 1.0f;
    ledMode               = 1;
    overheatProtectionEnabled = DEFAULT_OVERHEAT_PROTECTION;
    overheatShutdownC     = (float)DEFAULT_OVERHEAT_LIMIT_C;
    overheatLockoutActive = false;
    overheatTripTemp      = 0.0f;
    overheatTriggeredAt   = 0;
    overheatLastReason    = "";
    overheatLastTimestamp = "";
    overheatSensorFault   = false;
    overheatLatched       = false;
    lastTemperatureC      = 0.0f;
    lastTemperatureValid  = false;

    if (rtspSenderTaskHandle != NULL) {
        requestStreamStop("factory reset");
    }

    saveAudioSettings();
    simplePrintln("Defaults applied. Device will reboot.");
}
```

- [ ] **Step 3: Update `.ino` — add include, remove config functions**

Add to the includes block:
```cpp
#include "Config.h"
```

Remove from the `.ino`:
- `uint32_t computeRecommendedMinRate() { ... }`
- `void scheduleReboot(bool factoryReset, uint32_t delayMs) { ... }`
- `void loadAudioSettings() { ... }`
- `void saveAudioSettings() { ... }`
- `void resetToDefaultSettings() { ... }`

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/Config.h src/Config.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: move settings management to Config.h/cpp"
```

---

## Task 8: Create I2SDriver.h + I2SDriver.cpp, update .ino

**Files:**
- Create: `src/I2SDriver.h`
- Create: `src/I2SDriver.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create `src/I2SDriver.h`**

```cpp
#pragma once

// I2S pins — M5Stack Atom Echo with SPM1423 PDM microphone
#define I2S_BCLK_PIN     19
#define I2S_LRCLK_PIN    33
#define I2S_DATA_IN_PIN  23
#define I2S_DATA_OUT_PIN 22

void setup_i2s_driver();
void restartI2S();
```

- [ ] **Step 2: Create `src/I2SDriver.cpp`**

```cpp
#include "I2SDriver.h"
#include "globals.h"
#include "Logging.h"
#include "AudioDSP.h"
#include "RTSPSender.h"
#include "driver/i2s.h"

void setup_i2s_driver() {
    i2s_driver_uninstall(I2S_NUM_0);

    uint16_t dma_target = (uint16_t)min(1024UL, (unsigned long)(currentSampleRate / 250UL));
    if (dma_target < 1) dma_target = 1;
    uint16_t dma_buf_len = dma_target;
    while (dma_buf_len > 1 && currentBufferSize % dma_buf_len != 0) {
        dma_buf_len--;
    }
    if (dma_buf_len == 1) {
        simplePrintln("WARNING: no good dma_buf_len divisor found for bufferSize=" +
                      String(currentBufferSize) + " — PDM clicking artifact likely. "
                      "Use a buffer size with small factors (e.g. 2048, 3072).");
    }

    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX | I2S_MODE_PDM),
        .sample_rate = currentSampleRate,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ALL_RIGHT,
#if ESP_IDF_VERSION > ESP_IDF_VERSION_VAL(4, 1, 0)
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
#else
        .communication_format = I2S_COMM_FORMAT_I2S,
#endif
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 8,
        .dma_buf_len = dma_buf_len,
        .use_apll = true,
        .tx_desc_auto_clear = false,
        .fixed_mclk = 0
    };

    i2s_pin_config_t pin_config = {
#if (ESP_IDF_VERSION > ESP_IDF_VERSION_VAL(4, 3, 0))
        .mck_io_num = I2S_PIN_NO_CHANGE,
#endif
        .bck_io_num   = I2S_BCLK_PIN,
        .ws_io_num    = I2S_LRCLK_PIN,
        .data_out_num = I2S_DATA_OUT_PIN,
        .data_in_num  = I2S_DATA_IN_PIN
    };

    i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
    i2s_set_pin(I2S_NUM_0, &pin_config);
    i2s_set_clk(I2S_NUM_0, currentSampleRate, I2S_BITS_PER_SAMPLE_16BIT, I2S_CHANNEL_MONO);

    simplePrintln("I2S ready (PDM mode): " + String(currentSampleRate) + "Hz, gain " +
                  String(currentGainFactor, 1) + ", buffer " + String(currentBufferSize) +
                  ", dma=" + String(dma_buf_len) + "×8" +
                  ", shiftBits " + String(i2sShiftBits));
}

void restartI2S() {
    simplePrintln("Restarting I2S with new parameters...");

    if (rtspSenderTaskHandle != NULL) {
        requestStreamStop("I2S restart");
    }

    setup_i2s_driver();
    updateHighpassCoeffs();
    maxPacketRate = 0;
    minPacketRate = 0xFFFFFFFF;

    simplePrintln("I2S restarted");
}
```

- [ ] **Step 3: Update `.ino` — add include, remove I2S functions and pin defines**

Add to the includes block:
```cpp
#include "I2SDriver.h"
```

Remove from the `.ino`:
- The four `#define I2S_*_PIN` pin defines
- `void setup_i2s_driver() { ... }`
- `void restartI2S() { ... }`

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/I2SDriver.h src/I2SDriver.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: move I2S driver setup to I2SDriver.h/cpp"
```

---

## Task 9: Create AudioTask.h + AudioTask.cpp, update .ino

**Files:**
- Create: `src/AudioTask.h`
- Create: `src/AudioTask.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create `src/AudioTask.h`**

```cpp
#pragma once

void audioCaptureTask(void* parameter);
void stopAudioCaptureTask();
```

- [ ] **Step 2: Create `src/AudioTask.cpp`**

```cpp
#include "AudioTask.h"
#include "globals.h"
#include "Logging.h"
#include "AudioDSP.h"
#include "driver/i2s.h"
#include <M5Atom.h>

void stopAudioCaptureTask() {
    if (audioCaptureTaskHandle != NULL) {
        audioTaskRunning = false;
        __asm__ __volatile__("memw" ::: "memory");
        bool taskExited = (xSemaphoreTake(taskExitSemaphore, pdMS_TO_TICKS(2000)) == pdTRUE);
        if (!taskExited) {
            char ts[16]; fillTimestamp(ts, sizeof(ts));
            Serial.printf("%s[Core0] WARNING: Audio task did not exit within 2s, force-killing\n", ts);
            vTaskDelete(audioCaptureTaskHandle);
            xSemaphoreTake(taskExitSemaphore, 0);
        }
        audioCaptureTaskHandle = NULL;
    }
}

void audioCaptureTask(void* parameter) {
    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Core1] Audio pipeline task started\n", ts); }
    audioTaskRunning = true;

    size_t bytesRead = 0;
    uint32_t consecutiveErrors = 0;
    const uint32_t MAX_ERRORS = 10;
    uint32_t packetCount = 0;

    int16_t* captureBuffer = (int16_t*)malloc(currentBufferSize * sizeof(int16_t));
    int16_t* outputBuffer  = (int16_t*)malloc(currentBufferSize * sizeof(int16_t));

    if (!captureBuffer || !outputBuffer) {
        { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Core1] FATAL: Failed to allocate audio buffers!\n", ts); }
        if (captureBuffer) free(captureBuffer);
        if (outputBuffer)  free(outputBuffer);
        audioTaskRunning = false;
        vTaskDelete(NULL);
        return;
    }

    Biquad localHpf = hpf;
    DcBlocker localDcBlocker;
    uint32_t localHpfConfigSampleRate = hpfConfigSampleRate;
    uint16_t localHpfConfigCutoff     = hpfConfigCutoff;
    float localAgcMult = 1.0f;

    uint32_t i2sErrors = 0;
    unsigned long lastStatsLog = millis();
    unsigned long lastLedUpdate = 0;

    while (audioTaskRunning) {
        if (millis() - lastStatsLog > 30000) {
            char ts[16];
            time_t now; time(&now);
            if (now > 100000) {
                struct tm ti; localtime_r(&now, &ti);
                strftime(ts, sizeof(ts), "[%H:%M:%S]", &ti);
            } else {
                unsigned long s = (millis() - bootTime) / 1000;
                snprintf(ts, sizeof(ts), "[%02lu:%02lu:%02lu]", s/3600, (s%3600)/60, s%60);
            }
            Serial.printf("%s [Core1] Sent=%u I2Serr=%u Clip=%lu AGC=%.2f\n",
                         ts, packetCount, i2sErrors, audioClipCount, localAgcMult);
            lastStatsLog = millis();
        }

        esp_err_t result = i2s_read(I2S_NUM_0, captureBuffer,
                                    currentBufferSize * sizeof(int16_t),
                                    &bytesRead, pdMS_TO_TICKS(100));

        if (result != ESP_OK || bytesRead == 0) {
            if (result != ESP_OK) {
                consecutiveErrors++;
                i2sErrors++;
                if (consecutiveErrors >= MAX_ERRORS) {
                    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Core1] Too many I2S errors, pausing\n", ts); }
                    vTaskDelay(pdMS_TO_TICKS(100));
                    consecutiveErrors = 0;
                }
            }
            continue;
        }

        consecutiveErrors = 0;
        uint16_t samplesRead = bytesRead / sizeof(int16_t);

        if (highpassEnabled && (localHpfConfigSampleRate != currentSampleRate ||
                                localHpfConfigCutoff != highpassCutoffHz)) {
            localHpf = hpf;
            localHpfConfigSampleRate = currentSampleRate;
            localHpfConfigCutoff = highpassCutoffHz;
        }

        float effectiveGain = currentGainFactor;
        if (agcEnabled) effectiveGain *= localAgcMult;

        bool clipped = false;
        float peakAbs = 0.0f;
        float sumSquares = 0.0f;

        for (int i = 0; i < samplesRead; i++) {
            float sample = (float)(captureBuffer[i] >> i2sShiftBits);

            if (dcBlockerEnabled) sample = localDcBlocker.process(sample);
            if (highpassEnabled)  sample = localHpf.process(sample);

            float amplified = sample * effectiveGain;
            float aabs = fabsf(amplified);
            if (aabs > peakAbs) peakAbs = aabs;
            if (aabs > 32767.0f) clipped = true;
            sumSquares += amplified * amplified;

            if (amplified >  32767.0f) amplified =  32767.0f;
            if (amplified < -32768.0f) amplified = -32768.0f;
            outputBuffer[i] = (int16_t)amplified;
        }

        if (agcEnabled && samplesRead > 0) {
            float rms = sqrtf(sumSquares / (float)samplesRead) / 32767.0f;
            if (rms > 0.001f) {
                float ratio = AGC_TARGET_RMS / rms;
                if (ratio < 1.0f) {
                    localAgcMult += (ratio - 1.0f) * AGC_ATTACK_RATE * localAgcMult;
                } else {
                    localAgcMult += (ratio - 1.0f) * AGC_RELEASE_RATE * localAgcMult;
                }
                if (localAgcMult < AGC_MIN_MULT) localAgcMult = AGC_MIN_MULT;
                if (localAgcMult > AGC_MAX_MULT) localAgcMult = AGC_MAX_MULT;
            }
            agcMultiplier = localAgcMult;
        }

        if (peakAbs > 32767.0f) peakAbs = 32767.0f;
        lastPeakAbs16 = (uint16_t)peakAbs;
        audioClippedLastBlock = clipped;
        if (clipped) {
            audioClipCount++;
            static unsigned long lastClipLog = 0;
            if (millis() - lastClipLog > 5000) {
                char ts[16]; fillTimestamp(ts, sizeof(ts));
                Serial.printf("%s[Core1] Clipping! Peak=%u count=%lu\n", ts, lastPeakAbs16, audioClipCount);
                lastClipLog = millis();
            }
        }

        if (lastPeakAbs16 > peakHoldAbs16) {
            peakHoldAbs16 = lastPeakAbs16;
            peakHoldUntilMs = millis() + 3000UL;
        } else if (peakHoldAbs16 > 0 && millis() > peakHoldUntilMs) {
            peakHoldAbs16 = 0;
        }

        if (millis() - lastLedUpdate > 100) {
            if (ledMode == 2) {
                float pct = peakAbs / 32767.0f;
                if (clipped)       M5.dis.drawpix(0, CRGB(255, 0, 0));
                else if (pct > 0.7f) M5.dis.drawpix(0, CRGB(255, 165, 0));
                else if (pct > 0.3f) M5.dis.drawpix(0, CRGB(0, 255, 0));
                else if (pct > 0.05f) M5.dis.drawpix(0, CRGB(0, 64, 0));
                else                 M5.dis.drawpix(0, CRGB(32, 0, 32));
            } else if (ledMode == 1) {
                M5.dis.drawpix(0, CRGB(0, 128, 0));
            } else {
                M5.dis.drawpix(0, CRGB(0, 0, 0));
            }
            lastLedUpdate = millis();
        }

        {
            uint16_t frameSamples = (samplesRead > MAX_BUFFER_SIZE)
                                    ? (uint16_t)MAX_BUFFER_SIZE
                                    : (uint16_t)samplesRead;
            AudioFrame* frame = NULL;
            if (xQueueReceive(audioFreePool, &frame, 0) == pdTRUE) {
                memcpy(frame->data, outputBuffer, frameSamples * sizeof(int16_t));
                frame->samples = frameSamples;
                if (xQueueSend(audioReadyQueue, &frame, 0) != pdTRUE) {
                    xQueueSend(audioFreePool, &frame, 0);
                    audioPacketsDropped++;
                } else {
                    packetCount++;
                }
            } else {
                audioPacketsDropped++;
            }
        }

        taskYIELD();
    }

    free(captureBuffer);
    free(outputBuffer);
    core1OwnsLED = false;
    audioTaskRunning = false;
    { char ts[16]; fillTimestamp(ts, sizeof(ts)); Serial.printf("%s[Core1] Audio pipeline task stopped\n", ts); }
    xSemaphoreGive(taskExitSemaphore);
    vTaskDelete(NULL);
}
```

- [ ] **Step 3: Update `.ino` — add include, remove audio task functions**

Add to the includes block:
```cpp
#include "AudioTask.h"
```

Remove from the `.ino`:
- `void stopAudioCaptureTask() { ... }`
- `void audioCaptureTask(void* parameter) { ... }`

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/AudioTask.h src/AudioTask.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: move audio capture task to AudioTask.h/cpp"
```

---

## Task 10: Create RTSPProtocol.h + RTSPProtocol.cpp, update .ino

**Files:**
- Create: `src/RTSPProtocol.h`
- Create: `src/RTSPProtocol.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create `src/RTSPProtocol.h`**

```cpp
#pragma once
#include <WiFiClient.h>

void handleRTSPCommand(WiFiClient &client, String request);
void processRTSP(WiFiClient &client);
void drainRtspReceiveBuffer(WiFiClient &client);
```

- [ ] **Step 2: Create `src/RTSPProtocol.cpp`**

```cpp
#include "RTSPProtocol.h"
#include "globals.h"
#include "Logging.h"
#include "AudioTask.h"
#include "RTSPSender.h"
#include <M5Atom.h>

void drainRtspReceiveBuffer(WiFiClient &client) {
    if (!client || !client.connected()) return;
    int drained = 0;
    while (client.available() > 0 && drained < 4096) {
        uint8_t buf[256];
        int n = client.read(buf, sizeof(buf));
        if (n <= 0) break;
        drained += n;
    }
    if (drained > 0) {
        simplePrintln("Drained " + String(drained) + " bytes from RTSP receive buffer");
    }
}

void handleRTSPCommand(WiFiClient &client, String request) {
    String cseq = "1";
    int cseqPos = request.indexOf("CSeq: ");
    if (cseqPos >= 0) {
        cseq = request.substring(cseqPos + 6, request.indexOf("\r", cseqPos));
        cseq.trim();
    }

    lastRTSPActivity = millis();

    if (request.startsWith("OPTIONS")) {
        client.print("RTSP/1.0 200 OK\r\n");
        client.print("CSeq: " + cseq + "\r\n");
        client.print("Public: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN, GET_PARAMETER\r\n\r\n");

    } else if (request.startsWith("DESCRIBE")) {
        String ip  = WiFi.localIP().toString();
        String sdp = "v=0\r\n";
        sdp += "o=- 0 0 IN IP4 " + ip + "\r\n";
        sdp += "s=ESP32 RTSP Mic (" + String(currentSampleRate) + "Hz, 16-bit PCM)\r\n";
        sdp += "c=IN IP4 " + ip + "\r\n";
        sdp += "t=0 0\r\n";
        sdp += "m=audio 0 RTP/AVP 96\r\n";
        sdp += "a=rtpmap:96 L16/" + String(currentSampleRate) + "/1\r\n";
        sdp += "a=control:track1\r\n";

        client.print("RTSP/1.0 200 OK\r\n");
        client.print("CSeq: " + cseq + "\r\n");
        client.print("Content-Type: application/sdp\r\n");
        client.print("Content-Base: rtsp://" + ip + ":8554/audio/\r\n");
        client.print("Content-Length: " + String(sdp.length()) + "\r\n\r\n");
        client.print(sdp);

    } else if (request.startsWith("SETUP")) {
        rtspSessionId = String(random(100000000, 999999999));
        client.print("RTSP/1.0 200 OK\r\n");
        client.print("CSeq: " + cseq + "\r\n");
        client.print("Session: " + rtspSessionId + ";timeout=86400\r\n");
        client.print("Transport: RTP/AVP/TCP;unicast;interleaved=0-1\r\n\r\n");

    } else if (request.startsWith("PLAY")) {
        client.print("RTSP/1.0 200 OK\r\n");
        client.print("CSeq: " + cseq + "\r\n");
        client.print("Session: " + rtspSessionId + "\r\n");
        client.print("Range: npt=0.000-\r\n\r\n");

        rtpSequence       = 0;
        rtpTimestamp      = 0;
        audioPacketsSent  = 0;
        audioPacketsDropped = 0;
        lastStatsReset    = millis();
        lastRtspPlayMs    = millis();
        rtspPlayCount++;

        stopStreamRequested = false;
        core1OwnsLED = true;
        __asm__ __volatile__("memw" ::: "memory");

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

    } else if (request.startsWith("TEARDOWN")) {
        if (rtspSenderTaskHandle != NULL) {
            requestStreamStop("TEARDOWN");
        }

        client.print("RTSP/1.0 200 OK\r\n");
        client.print("CSeq: " + cseq + "\r\n");
        client.print("Session: " + rtspSessionId + "\r\n\r\n");

        if (!core1OwnsLED) {
            if (ledMode > 0) M5.dis.drawpix(0, CRGB(0, 0, 128));
            else             M5.dis.drawpix(0, CRGB(0, 0, 0));
        }
        simplePrintln("STREAMING STOPPED");

    } else if (request.startsWith("GET_PARAMETER")) {
        client.print("RTSP/1.0 200 OK\r\n");
        client.print("CSeq: " + cseq + "\r\n\r\n");
    }
}

void processRTSP(WiFiClient &client) {
    if (!client.connected()) return;

    if (client.available()) {
        int available = client.available();
        int spaceLeft = sizeof(rtspParseBuffer) - rtspParseBufferPos - 1;

        if (available > spaceLeft) available = spaceLeft;

        if (available <= 0) {
            static unsigned long lastOverflowWarning = 0;
            if (millis() - lastOverflowWarning > 5000) {
                simplePrintln("RTSP buffer full - resetting");
                lastOverflowWarning = millis();
            }
            rtspParseBufferPos = 0;
            return;
        }

        client.read(rtspParseBuffer + rtspParseBufferPos, available);
        rtspParseBufferPos += available;
        rtspParseBuffer[rtspParseBufferPos] = '\0';

        char* endOfHeader = strstr((char*)rtspParseBuffer, "\r\n\r\n");
        if (endOfHeader != nullptr) {
            *endOfHeader = '\0';
            String request = String((char*)rtspParseBuffer);

            handleRTSPCommand(client, request);

            int headerLen = (endOfHeader - (char*)rtspParseBuffer) + 4;
            int remaining = rtspParseBufferPos - headerLen;
            if (remaining > 0) {
                memmove(rtspParseBuffer, rtspParseBuffer + headerLen, remaining);
            }
            rtspParseBufferPos = remaining;
        }
    }
}
```

- [ ] **Step 3: Update `.ino` — add include, remove RTSP protocol functions**

Add to the includes block:
```cpp
#include "RTSPProtocol.h"
```

Remove from the `.ino`:
- `void drainRtspReceiveBuffer(WiFiClient &client) { ... }`
- `void handleRTSPCommand(WiFiClient &client, String request) { ... }`
- `void processRTSP(WiFiClient &client) { ... }`

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/RTSPProtocol.h src/RTSPProtocol.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: move RTSP protocol handling to RTSPProtocol.h/cpp"
```

---

## Task 11: Create Diagnostics.h + Diagnostics.cpp, update .ino

**Files:**
- Create: `src/Diagnostics.h`
- Create: `src/Diagnostics.cpp`
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Create `src/Diagnostics.h`**

```cpp
#pragma once

bool isTemperatureValid(float temp);
void persistOverheatNote();
void recordOverheatTrip(float temp);
void checkTemperature();
void checkPerformance();
void checkWiFiHealth();
void checkScheduledReset();
```

- [ ] **Step 2: Create `src/Diagnostics.cpp`**

```cpp
#include "Diagnostics.h"
#include "globals.h"
#include "Logging.h"
#include "RTSPSender.h"
#include "I2SDriver.h"
#include "WiFiUtils.h"

bool isTemperatureValid(float temp) {
    if (isnan(temp) || isinf(temp)) return false;
    if (temp < -20.0f || temp > 130.0f) return false;
    return true;
}

void persistOverheatNote() {
    audioPrefs.begin("audio", false);
    audioPrefs.putString("ohReason", overheatLastReason);
    audioPrefs.putString("ohStamp",  overheatLastTimestamp);
    audioPrefs.putFloat("ohTripC",   overheatTripTemp);
    audioPrefs.putBool("ohLatched",  overheatLatched);
    audioPrefs.end();
}

void recordOverheatTrip(float temp) {
    unsigned long uptimeSeconds = (millis() - bootTime) / 1000;
    overheatTripTemp      = temp;
    overheatTriggeredAt   = millis();
    overheatLastTimestamp = formatUptime(uptimeSeconds);
    overheatLastReason    = String("Thermal shutdown: ") + String(temp, 1) + " C reached (limit " +
                            String(overheatShutdownC, 1) + " C). Stream disabled; acknowledge in UI.";
    overheatLatched = true;
    simplePrintln("THERMAL PROTECTION: " + overheatLastReason);
    simplePrintln("TIP: Improve cooling or lower WiFi TX power/CPU MHz if overheating persists.");
    persistOverheatNote();
}

void checkTemperature() {
    float temp = temperatureRead();
    bool tempValid = isTemperatureValid(temp);
    if (!tempValid) {
        lastTemperatureValid = false;
        if (!overheatSensorFault) {
            overheatSensorFault   = true;
            overheatLastReason    = "Thermal protection disabled: temperature sensor unavailable.";
            overheatLastTimestamp = "";
            overheatTripTemp      = 0.0f;
            overheatTriggeredAt   = 0;
            persistOverheatNote();
            simplePrintln("WARNING: Temperature sensor unavailable. Thermal protection paused.");
        }
        return;
    }

    lastTemperatureC     = temp;
    lastTemperatureValid = true;

    if (overheatSensorFault) {
        overheatSensorFault   = false;
        overheatLastReason    = "Thermal protection restored: temperature sensor reading valid.";
        overheatLastTimestamp = formatUptime((millis() - bootTime) / 1000);
        persistOverheatNote();
        simplePrintln("Temperature sensor restored. Thermal protection active again.");
    }

    if (temp > maxTemperature) maxTemperature = temp;

    bool protectionActive = overheatProtectionEnabled && !overheatSensorFault;
    if (protectionActive) {
        if (!overheatLockoutActive && temp >= overheatShutdownC) {
            overheatLockoutActive = true;
            recordOverheatTrip(temp);
            if (rtspSenderTaskHandle != NULL) {
                requestStreamStop("overheat");
            }
            rtspServerEnabled = false;
            rtspServer.stop();
        } else if (overheatLockoutActive && temp <= (overheatShutdownC - OVERHEAT_LIMIT_STEP_C)) {
            overheatLockoutActive = false;
        }
    } else {
        overheatLockoutActive = false;
    }

    static unsigned long lastTempWarn = 0;
    float warnThreshold = max(overheatShutdownC - 5.0f, (float)OVERHEAT_MIN_LIMIT_C);
    if (temp > warnThreshold && (millis() - lastTempWarn) > 600000UL) {
        simplePrintln("WARNING: High temperature detected (" + String(temp, 1) + " C). Approaching shutdown limit.");
        lastTempWarn = millis();
    }
}

void checkPerformance() {
    uint32_t currentHeap = ESP.getFreeHeap();
    if (currentHeap < minFreeHeap) minFreeHeap = currentHeap;

    if (rtspSenderTaskHandle != NULL && (millis() - lastStatsReset) > 30000) {
        if (lastI2SReset > 0 && (millis() - lastI2SReset) < 120000) return;

        uint32_t runtime     = millis() - lastStatsReset;
        uint32_t currentRate = (audioPacketsSent * 1000) / runtime;

        if (currentRate > maxPacketRate) maxPacketRate = currentRate;
        if (currentRate < minPacketRate) minPacketRate = currentRate;

        static uint8_t consecutiveLowCount = 0;
        if (currentRate < minAcceptableRate) {
            consecutiveLowCount++;
            simplePrintln("Low packet rate: " + String(currentRate) + " < " + String(minAcceptableRate) +
                          " pkt/s (" + String(consecutiveLowCount) + "/3)");

            if (consecutiveLowCount >= 3 && autoRecoveryEnabled) {
                simplePrintln("AUTO-RECOVERY: 3 consecutive failures, restarting I2S...");
                consecutiveLowCount = 0;
                restartI2S();
                audioPacketsSent = 0;
                lastStatsReset   = millis();
                lastI2SReset     = millis();
            }
        } else {
            consecutiveLowCount = 0;
        }
    }
}

void checkWiFiHealth() {
    if (WiFi.status() != WL_CONNECTED) {
        if (rtspSenderTaskHandle != NULL) {
            requestStreamStop("WiFi disconnect");
        }
        simplePrintln("WiFi disconnected! Reconnecting...");
        WiFi.reconnect();
        lastNetworkActivity = millis();
        return;
    }

    if (millis() - lastNetworkActivity > 300000UL) {
        simplePrintln("Network zombie detected (connected but no traffic for 5min) — restarting");
        delay(200);
        ESP.restart();
    }

    int32_t rssi = WiFi.RSSI();
    applyWifiTxPower(false);

    if (rssi < -85) {
        simplePrintln("WARNING: Weak WiFi signal: " + String(rssi) + " dBm");
    }
}

void checkScheduledReset() {
    if (!scheduledResetEnabled) return;
    unsigned long uptimeHours = (millis() - bootTime) / 3600000;
    if (uptimeHours >= resetIntervalHours) {
        simplePrintln("SCHEDULED RESET: " + String(resetIntervalHours) + " hours reached");
        delay(1000);
        ESP.restart();
    }
}
```

- [ ] **Step 3: Update `.ino` — add include, remove diagnostics functions**

Add to the includes block:
```cpp
#include "Diagnostics.h"
```

Remove from the `.ino`:
- `static bool isTemperatureValid(float temp) { ... }`
- `static void persistOverheatNote() { ... }`
- `void recordOverheatTrip(float temp) { ... }`
- `void checkTemperature() { ... }`
- `void checkPerformance() { ... }`
- `void checkWiFiHealth() { ... }`
- `void checkScheduledReset() { ... }`

- [ ] **Step 4: Build**

```bash
pio run
```
Expected: `SUCCESS`. The `.ino` should now contain only `handleSerialCommand`, `setup()`, and `loop()`.

- [ ] **Step 5: Commit**

```bash
git add src/Diagnostics.h src/Diagnostics.cpp src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "refactor: move diagnostics and thermal monitoring to Diagnostics.h/cpp"
```

---

## Task 12: Update WebUI.cpp — replace externs with header includes

**Files:**
- Modify: `src/WebUI.cpp`

WebUI.cpp has extern declarations in two places: a large block at the top (lines 8–63 in the original) and scattered inline externs inside function bodies. All are replaced by including the appropriate headers.

- [ ] **Step 1: Replace the top extern block**

Delete lines 8–63 of `WebUI.cpp` (from `// External variables and functions from main` through `extern bool dcBlockerEnabled;`).

Replace with:

```cpp
#include "globals.h"
#include "Logging.h"
#include "WiFiUtils.h"
#include "Config.h"
#include "I2SDriver.h"
#include "RTSPSender.h"
#include "AudioDSP.h"
```

Also delete the standalone `extern portMUX_TYPE logMux;` line that appears just before `void webui_pushLog(...)` (it was line 107 in the original).

- [ ] **Step 2: Remove scattered inline externs inside function bodies**

Find and remove the following inline extern declarations. Each is inside a function body — remove only the `extern` declaration, leaving the surrounding logic intact:

In `httpAudioStatus()`:
```cpp
extern bool highpassEnabled; extern uint16_t highpassCutoffHz;
```
(These are already available via `globals.h`.)

In `httpActionServerStop()`:
```cpp
extern bool requestStreamStop(const char* reason);
```

In the function extern block around lines 91–98 (just after `rebootTask`):
```cpp
extern float wifiPowerLevelToDbm(wifi_power_t lvl);
extern String formatUptime(unsigned long seconds);
extern String formatSince(unsigned long eventMs);
extern void restartI2S();
extern void saveAudioSettings();
extern void applyWifiTxPower(bool log);
extern const char* FW_VERSION_STR;
```

In `httpSet()`, the key `"wifi_tx"` handler:
```cpp
extern float wifiTxPowerDbm;
```

In `httpSet()`, the key `"sched_reset"` handler:
```cpp
extern bool scheduledResetEnabled;
```

In `httpSet()`, the key `"reset_hours"` handler:
```cpp
extern uint32_t resetIntervalHours;
```

In `httpSet()`, the key `"hp_enable"` handler:
```cpp
extern bool highpassEnabled; extern void updateHighpassCoeffs();
```

In `httpSet()`, the key `"hp_cutoff"` handler:
```cpp
extern uint16_t highpassCutoffHz; extern void updateHighpassCoeffs();
```

- [ ] **Step 3: Build**

```bash
pio run
```
Expected: `SUCCESS`.

- [ ] **Step 4: Commit**

```bash
git add src/WebUI.cpp
git commit -m "refactor: replace WebUI.cpp extern declarations with globals.h + module headers"
```

---

## Done

After Task 12, the refactor is complete. Verify the final state:

```bash
wc -l src/*.ino src/*.cpp src/*.h
```

Expected rough line counts:
- `.ino`: ~200 lines (`handleSerialCommand` + `setup()` + `loop()`)
- Each module `.cpp`: 60–230 lines
- `globals.h`: ~130 lines
- `globals.cpp`: ~100 lines
