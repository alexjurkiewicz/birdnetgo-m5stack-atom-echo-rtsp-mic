# Wi-Fi Auto TX Power Design

**Date:** 2026-04-18  
**Status:** Approved

## Overview

Replace the static Wi-Fi TX power setting with an automatic mode that steps power up and down based on RSSI, minimising transmission power while maintaining reliable connectivity. Manual mode is retained for explicit control.

## Settings

- `wifiTxAutoEnabled` (bool, default `true`) — whether auto mode is active
- Flash key: `wifiTxAuto`
- `wifiTxPowerDbm` (float) — retained unchanged, used only in manual mode; preserved in flash so switching back to manual restores the user's last value
- Follows the same on/off + associated-config pattern as `highpassEnabled` / `highpassCutoffHz`

Default changes from hardcoded 19.5 dBm to auto mode enabled.

## Algorithm

### Starting state
On startup and on every WiFi reconnect, TX power is set to 19.5 dBm (maximum) unconditionally, regardless of auto mode. The step-down confirmation counter is also reset. This ensures the device always begins from a known safe state.

### Step-up (fast path — 30s)
Inside the existing `checkWiFiHealth()` which runs every 30 seconds:

- Skip if RSSI ≥ 0 (invalid reading)
- If RSSI < −65 dBm: raise TX power by one level immediately
- Reset the step-down confirmation counter when stepping up

### Step-down (slow path — 3 minutes)
A separate `lastWifiAutoAdjust` timer, checked in the main loop every 3 minutes:

- Skip if RSSI ≥ 0 (invalid reading)
- If RSSI > −50 dBm: increment `wifiAutoStepDownConfirm` counter
- Otherwise: reset counter to 0
- If counter reaches 2 (i.e., RSSI has been above −50 for 2 consecutive 3-minute checks): reduce TX power by one level, reset counter

### Thresholds summary
| Condition | Action | Timing |
|---|---|---|
| RSSI < −65 dBm | Step up one level | Every 30s, immediate |
| RSSI > −50 dBm (×2 consecutive) | Step down one level | Every 3 min, confirmed |
| −65 to −50 dBm | No change | — |

The dead band (−65 to −50 dBm, 15 dBm wide) means normal RSSI fluctuation won't trigger any action. Crossing the upper edge (step-down) requires confirmation; crossing the lower edge (step-up) is immediate. Together these prevent power oscillation near boundaries.

### New state
- `bool wifiTxAutoEnabled` — mode flag
- `uint8_t wifiAutoStepDownConfirm` — confirmation counter (0–2), never persisted
- `unsigned long lastWifiAutoAdjust` — millis() timer for the 3-minute step-down check

The auto-computed power level is ephemeral and never saved to flash.

## Power stepping

Uses the existing ordered `wifi_power_t` enum (12 levels, −1 dBm to 19.5 dBm). Step up/down moves one enum entry at a time. The existing `pickWifiPowerLevel()` and `wifiPowerLevelToDbm()` functions are reused for the enum ↔ dBm conversion. Auto mode calls `WiFi.setTxPower(level)` and updates `currentWifiPowerLevel` directly — it does not touch `wifiTxPowerDbm`, so the user's manual value is never overwritten.

## Web UI

Follows the HPF on/off + cutoff pattern:

- Toggle: "Auto" checkbox (on by default), JSON field `wifi_tx_auto`, "on"/"off" values
- When auto is on: slider is hidden; current effective TX level shown as static text (populated at page load from status JSON, no polling)
- When auto is off: slider is shown and active, same as existing behaviour
- Status JSON gains `wifi_tx_auto` boolean field alongside existing `wifi_tx` float

## Files affected

- `src/esp32_rtsp_mic_birdnetgo.ino` — new state variables, auto-adjust logic in `checkWiFiHealth()` and main loop, startup/reconnect reset, `loadAudioSettings()`, `saveAudioSettings()`, `resetToDefaults()`
- `src/WebUI.cpp` — status JSON, toggle handler, UI HTML/JS
