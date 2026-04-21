# Wi-Fi Auto TX Power Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Wi-Fi TX power setting with an auto mode that steps power up/down based on RSSI, while retaining manual override.

**Architecture:** Auto mode uses the existing 30s `checkWiFiHealth()` for fast step-up (immediate on weak signal) and a new 3-minute timer in the main loop for conservative step-down (requires 2 consecutive readings above −50 dBm). Manual mode is unchanged. Web UI replaces the TX power slider with a mode selector; slider is hidden when auto is active.

**Tech Stack:** ESP32 Arduino (C++), FreeRTOS, ESP-IDF WiFi API (`wifi_power_t`), embedded HTML/JS in `WebUI.cpp`.

---

## Files

- Modify: `src/esp32_rtsp_mic_birdnetgo.ino` — state variables, helpers, load/save/reset, `checkWiFiHealth()`, main loop, startup
- Modify: `src/WebUI.cpp` — extern declarations, status JSON, `wifi_tx_auto` set handler, HTML, JS

---

## Task 1: Add state, helpers, and persistence to firmware

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Add new global variables after the existing WiFi TX block (line ~203)**

Find:
```cpp
// -- WiFi TX power (configurable)
float wifiTxPowerDbm = DEFAULT_WIFI_TX_DBM;
wifi_power_t currentWifiPowerLevel = WIFI_POWER_19_5dBm;
```

Replace with:
```cpp
// -- WiFi TX power (configurable)
float wifiTxPowerDbm = DEFAULT_WIFI_TX_DBM;
wifi_power_t currentWifiPowerLevel = WIFI_POWER_19_5dBm;
bool wifiTxAutoEnabled = true;
uint8_t wifiAutoStepDownConfirm = 0;
unsigned long lastWifiAutoAdjust = 0;
```

- [ ] **Step 2: Add ordered power level array and stepping helpers before `applyWifiTxPower()` (line ~248)**

Find:
```cpp
// Apply WiFi TX power
// Logs only when changed; can be muted with log=false
void applyWifiTxPower(bool log = true) {
```

Insert before that block:
```cpp
static const wifi_power_t wifiPowerLevels[] = {
    WIFI_POWER_MINUS_1dBm, WIFI_POWER_2dBm, WIFI_POWER_5dBm,
    WIFI_POWER_7dBm, WIFI_POWER_8_5dBm, WIFI_POWER_11dBm,
    WIFI_POWER_13dBm, WIFI_POWER_15dBm, WIFI_POWER_17dBm,
    WIFI_POWER_18_5dBm, WIFI_POWER_19dBm, WIFI_POWER_19_5dBm
};
static const int wifiPowerLevelsCount = 12;

static wifi_power_t stepWifiPowerUp(wifi_power_t cur) {
    for (int i = 0; i < wifiPowerLevelsCount - 1; i++) {
        if (wifiPowerLevels[i] == cur) return wifiPowerLevels[i + 1];
    }
    return WIFI_POWER_19_5dBm;
}

static wifi_power_t stepWifiPowerDown(wifi_power_t cur) {
    for (int i = wifiPowerLevelsCount - 1; i > 0; i--) {
        if (wifiPowerLevels[i] == cur) return wifiPowerLevels[i - 1];
    }
    return WIFI_POWER_MINUS_1dBm;
}

void resetWifiAutoState() {
    wifiAutoStepDownConfirm = 0;
    currentWifiPowerLevel = WIFI_POWER_19_5dBm;
    WiFi.setTxPower(WIFI_POWER_19_5dBm);
}

```

- [ ] **Step 3: Add `wifiTxAutoEnabled` to `loadAudioSettings()`**

Find:
```cpp
    wifiTxPowerDbm = audioPrefs.getFloat("wifiTxDbm", DEFAULT_WIFI_TX_DBM);
```

Replace with:
```cpp
    wifiTxPowerDbm = audioPrefs.getFloat("wifiTxDbm", DEFAULT_WIFI_TX_DBM);
    wifiTxAutoEnabled = audioPrefs.getBool("wifiTxAuto", true);
```

- [ ] **Step 4: Add `wifiTxAutoEnabled` to `saveAudioSettings()`**

Find:
```cpp
    audioPrefs.putFloat("wifiTxDbm", wifiTxPowerDbm);
```

Replace with:
```cpp
    audioPrefs.putFloat("wifiTxDbm", wifiTxPowerDbm);
    audioPrefs.putBool("wifiTxAuto", wifiTxAutoEnabled);
```

- [ ] **Step 5: Reset `wifiTxAutoEnabled` in `resetToDefaultSettings()`**

Find:
```cpp
    wifiTxPowerDbm = DEFAULT_WIFI_TX_DBM;
```

Replace with:
```cpp
    wifiTxPowerDbm = DEFAULT_WIFI_TX_DBM;
    wifiTxAutoEnabled = true;
```

- [ ] **Step 6: Verify build compiles cleanly**

```bash
cd /Users/alex.jurkiewicz/personal/birdnetgo-m5stack-atom-echo-rtsp-mic && pio run 2>&1 | tail -20
```

Expected: `SUCCESS` with no errors.

---

## Task 2: Step-up logic in `checkWiFiHealth()` and startup

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Rewrite `checkWiFiHealth()` to include auto step-up and reset on disconnect**

Find the entire function:
```cpp
// WiFi health check
void checkWiFiHealth() {
    if (WiFi.status() != WL_CONNECTED) {
        // Stop streaming before reconnecting — no point sending RTP into a dead radio
        if (isStreaming) {
            requestStreamStop("WiFi disconnect");
            stopAudioCaptureTask();
        }
        simplePrintln("WiFi disconnected! Reconnecting...");
        WiFi.reconnect();
    }

    // Re-apply TX power WITHOUT logging (prevent periodic log spam)
    applyWifiTxPower(false);

    int32_t rssi = WiFi.RSSI();
    if (rssi < -85) {
        simplePrintln("WARNING: Weak WiFi signal: " + String(rssi) + " dBm");
    }
}
```

Replace with:
```cpp
// WiFi health check
void checkWiFiHealth() {
    if (WiFi.status() != WL_CONNECTED) {
        // Stop streaming before reconnecting — no point sending RTP into a dead radio
        if (isStreaming) {
            requestStreamStop("WiFi disconnect");
            stopAudioCaptureTask();
        }
        simplePrintln("WiFi disconnected! Reconnecting...");
        resetWifiAutoState();
        WiFi.reconnect();
    }

    int32_t rssi = WiFi.RSSI();

    if (wifiTxAutoEnabled) {
        if (rssi < 0 && rssi < -65) {
            wifi_power_t newLevel = stepWifiPowerUp(currentWifiPowerLevel);
            if (newLevel != currentWifiPowerLevel) {
                WiFi.setTxPower(newLevel);
                currentWifiPowerLevel = newLevel;
                wifiAutoStepDownConfirm = 0;
                simplePrintln("WiFi auto TX up: " + String(wifiPowerLevelToDbm(newLevel), 1) + " dBm (RSSI " + String(rssi) + " dBm)");
            }
        }
    } else {
        applyWifiTxPower(false);
    }

    if (rssi < -85) {
        simplePrintln("WARNING: Weak WiFi signal: " + String(rssi) + " dBm");
    }
}
```

- [ ] **Step 2: Update startup power application (line ~1394) to use auto/manual branch**

Find:
```cpp
    // Apply configured WiFi TX power after connect (logs once on change)
    applyWifiTxPower(true);
```

Replace with:
```cpp
    // Apply initial WiFi TX power after connect
    if (wifiTxAutoEnabled) {
        resetWifiAutoState();
        simplePrintln("WiFi TX power: auto mode, starting at 19.5 dBm");
    } else {
        applyWifiTxPower(true);
    }
```

- [ ] **Step 3: Build and upload, observe serial for correct startup log**

```bash
cd /Users/alex.jurkiewicz/personal/birdnetgo-m5stack-atom-echo-rtsp-mic && pio run --target upload 2>&1 | tail -5
```

Then monitor:
```bash
pio device monitor -b 115200
```

Expected on boot: `WiFi TX power: auto mode, starting at 19.5 dBm`
Expected on disconnect/reconnect: `WiFi disconnected! Reconnecting...` followed by reset to 19.5 dBm.

---

## Task 3: Step-down timer in main loop

**Files:**
- Modify: `src/esp32_rtsp_mic_birdnetgo.ino`

- [ ] **Step 1: Add step-down timer block after the `lastWiFiCheck` block in the main loop**

Find:
```cpp
    if (millis() - lastWiFiCheck > 30000) { // 30 s
        checkWiFiHealth(); // without TX power log spam
        lastWiFiCheck = millis();
    }
```

Replace with:
```cpp
    if (millis() - lastWiFiCheck > 30000) { // 30 s
        checkWiFiHealth(); // without TX power log spam
        lastWiFiCheck = millis();
    }

    if (wifiTxAutoEnabled && millis() - lastWifiAutoAdjust > 180000) { // 3 min
        int32_t rssi = WiFi.RSSI();
        if (rssi < 0) {
            if (rssi > -50) {
                wifiAutoStepDownConfirm++;
                if (wifiAutoStepDownConfirm >= 2) {
                    wifi_power_t newLevel = stepWifiPowerDown(currentWifiPowerLevel);
                    if (newLevel != currentWifiPowerLevel) {
                        WiFi.setTxPower(newLevel);
                        currentWifiPowerLevel = newLevel;
                        simplePrintln("WiFi auto TX down: " + String(wifiPowerLevelToDbm(newLevel), 1) + " dBm (RSSI " + String(rssi) + " dBm)");
                    }
                    wifiAutoStepDownConfirm = 0;
                }
            } else {
                wifiAutoStepDownConfirm = 0;
            }
        }
        lastWifiAutoAdjust = millis();
    }
```

- [ ] **Step 2: Build and upload, observe serial for step behaviour**

```bash
cd /Users/alex.jurkiewicz/personal/birdnetgo-m5stack-atom-echo-rtsp-mic && pio run --target upload 2>&1 | tail -5
```

Monitor:
```bash
pio device monitor -b 115200
```

Expected: no step-down messages on first run (device near AP). After 6 minutes with strong signal (RSSI > −50), expect: `WiFi auto TX down: 18.5 dBm (RSSI -XX dBm)`.

Expected: if signal is artificially weakened below −65 dBm, within 30 s: `WiFi auto TX up: 19.5 dBm (RSSI -XX dBm)`.

- [ ] **Step 3: Commit firmware changes**

```bash
cd /Users/alex.jurkiewicz/personal/birdnetgo-m5stack-atom-echo-rtsp-mic
git add src/esp32_rtsp_mic_birdnetgo.ino
git commit -m "feat: auto Wi-Fi TX power adjustment based on RSSI

Step up immediately (30s check) when RSSI < -65 dBm.
Step down conservatively (3min, 2 consecutive readings) when RSSI > -50 dBm.
Always reset to 19.5 dBm on startup and reconnect."
```

---

## Task 4: Web UI — status JSON, set handler, HTML and JS

**Files:**
- Modify: `src/WebUI.cpp`

- [ ] **Step 1: Add `wifiTxAutoEnabled` extern near the top of `WebUI.cpp` alongside existing externs**

Find:
```cpp
extern wifi_power_t currentWifiPowerLevel;
```

Replace with:
```cpp
extern wifi_power_t currentWifiPowerLevel;
extern bool wifiTxAutoEnabled;
```

- [ ] **Step 2: Add `wifi_tx_auto` to the status JSON in `httpStatus()`**

Find:
```cpp
    json += "\"wifi_tx_dbm\":" + String(wifiPowerLevelToDbm(currentWifiPowerLevel),1) + ",";
```

Replace with:
```cpp
    json += "\"wifi_tx_dbm\":" + String(wifiPowerLevelToDbm(currentWifiPowerLevel),1) + ",";
    json += "\"wifi_tx_auto\":" + String(wifiTxAutoEnabled?"true":"false") + ",";
```

- [ ] **Step 3: Add `wifi_tx_auto` set handler in `httpSet()`**

Find:
```cpp
    else if (key == "wifi_tx") { float v; if (argToFloat("value", v) && v>=-1.0f && v<=19.5f) { extern float wifiTxPowerDbm; wifiTxPowerDbm = snapWifiTxDbm(v); applyWifiTxPower(true); saveAudioSettings(); } }
```

Replace with:
```cpp
    else if (key == "wifi_tx") { float v; if (argToFloat("value", v) && v>=-1.0f && v<=19.5f) { extern float wifiTxPowerDbm; wifiTxPowerDbm = snapWifiTxDbm(v); applyWifiTxPower(true); saveAudioSettings(); } }
    else if (key == "wifi_tx_auto") { String v=web.arg("value"); if (v=="on"||v=="off") { wifiTxAutoEnabled=(v=="on"); if (wifiTxAutoEnabled) { extern void resetWifiAutoState(); resetWifiAutoState(); } else { applyWifiTxPower(true); } saveAudioSettings(); } }
```

- [ ] **Step 4: Replace the TX power HTML row in Advanced Settings with auto/manual toggle**

Find (lines ~251–254):
```cpp
        "<tr id='row_tx_hint' style='display:none'><td colspan='2'><div class='hint' id='txt_tx_hint'></div></td></tr>"
        "<tr><td class='k'><span id='t_wifi_tx2'>TX Power</span><span class='help' id='h_tx'>?</span></td><td class='v'><div class='field'>"
        "<select id='sel_tx'><option>-1.0</option><option>2.0</option><option>5.0</option><option>7.0</option><option>8.5</option><option>11.0</option><option>13.0</option><option selected>15.0</option><option>17.0</option><option>18.5</option><option>19.0</option><option>19.5</option></select>"
        "<span class='unit'>dBm</span><button id='btn_tx_set' onclick=\"setv('wifi_tx',sel_tx.value)\">Set</button></div></td></tr>"
```

Replace with:
```cpp
        "<tr id='row_tx_hint' style='display:none'><td colspan='2'><div class='hint' id='txt_tx_hint'></div></td></tr>"
        "<tr><td class='k'><span id='t_wifi_tx2'>TX Power</span><span class='help' id='h_tx'>?</span></td><td class='v'><div class='field'>"
        "<select id='sel_tx_mode' onchange=\"setv('wifi_tx_auto',this.value==='auto'?'on':'off')\"><option value='auto'>Auto</option><option value='manual'>Manual</option></select>"
        "<span id='tx_auto_val' class='unit'></span>"
        "<span id='tx_manual_ctrl' style='display:none'>"
        "<select id='sel_tx'><option>-1.0</option><option>2.0</option><option>5.0</option><option>7.0</option><option>8.5</option><option>11.0</option><option>13.0</option><option>15.0</option><option>17.0</option><option>18.5</option><option>19.0</option><option>19.5</option></select>"
        "<span class='unit'>dBm</span><button id='btn_tx_set' onclick=\"setv('wifi_tx',sel_tx.value)\">Set</button></span></div></td></tr>"
```

- [ ] **Step 5: Update the status table WiFi TX display to indicate auto mode**

Find in `loadStatus()` JS (line ~288):
```js
$('wtx').textContent=j.wifi_tx_dbm.toFixed(1)+' dBm';
```

Replace with:
```js
$('wtx').textContent=(j.wifi_tx_auto?'Auto: ':'')+j.wifi_tx_dbm.toFixed(1)+' dBm';
```

- [ ] **Step 6: Update `loadStatus()` JS to drive the mode selector and show/hide manual controls**

Find in `loadStatus()`:
```js
const stx=$('sel_tx'); const now=Date.now(); if(stx){ const editing=(edits['wifi_tx']&&now<edits['wifi_tx']); if(!(locks['wifi_tx']&&now<locks['wifi_tx']) && !editing) stx.value=j.wifi_tx_dbm.toFixed(1); toggleDirty(stx,'wifi_tx'); }
```

Replace with:
```js
const stxMode=$('sel_tx_mode'); const stx=$('sel_tx'); const txAutoVal=$('tx_auto_val'); const txManual=$('tx_manual_ctrl'); const now=Date.now(); if(stxMode){ const editing=(edits['wifi_tx_auto']&&now<edits['wifi_tx_auto']); if(!(locks['wifi_tx_auto']&&now<locks['wifi_tx_auto']) && !editing) stxMode.value=j.wifi_tx_auto?'auto':'manual'; const isAuto=(stxMode.value==='auto'); if(txManual) txManual.style.display=isAuto?'none':''; if(txAutoVal) txAutoVal.textContent=isAuto?(j.wifi_tx_dbm.toFixed(1)+' dBm'):''; } if(stx&&!j.wifi_tx_auto){ const editing=(edits['wifi_tx']&&now<edits['wifi_tx']); if(!(locks['wifi_tx']&&now<locks['wifi_tx']) && !editing) stx.value=j.wifi_tx_dbm.toFixed(1); toggleDirty(stx,'wifi_tx'); }
```

- [ ] **Step 7: Add `trackEdit` for the new mode selector in the JS init section**

Find:
```js
trackEdit($('sel_tx'),'wifi_tx');
```

Replace with:
```js
trackEdit($('sel_tx_mode'),'wifi_tx_auto'); trackEdit($('sel_tx'),'wifi_tx');
```

- [ ] **Step 8: Build and upload, then verify Web UI in browser**

```bash
cd /Users/alex.jurkiewicz/personal/birdnetgo-m5stack-atom-echo-rtsp-mic && pio run --target upload 2>&1 | tail -5
```

Open the device Web UI (http://\<device-ip\>/) and verify:
- Advanced Settings → TX Power shows "Auto" dropdown selected, with current dBm displayed as static text (e.g. "19.5 dBm")
- Status table "WiFi TX Power" shows "Auto: 19.5 dBm"
- Switching to "Manual" in the dropdown hides the static text and shows the slider + Set button
- Setting a manual value saves and shows the new level in the status table (without "Auto:" prefix)
- Switching back to "Auto" resets to 19.5 dBm (status table and static text both show "Auto: 19.5 dBm")
- Using "Defaults" button restores auto mode

- [ ] **Step 9: Commit Web UI changes**

```bash
cd /Users/alex.jurkiewicz/personal/birdnetgo-m5stack-atom-echo-rtsp-mic
git add src/WebUI.cpp
git commit -m "feat: Web UI auto/manual TX power mode selector

Replace static TX power slider with auto/manual dropdown.
Auto mode shows current effective level read-only; manual mode
shows slider. Status table prefixes level with 'Auto:' when active."
```
