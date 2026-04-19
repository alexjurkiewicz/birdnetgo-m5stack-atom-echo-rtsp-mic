# WiFi Auto TX Power — Feature Retrospective

**Date:** 2026-04-19  
**Status:** Removed. May be worth revisiting if the approach changes.

## Why we tried it

The SPM1423 PDM microphone picks up RF emissions from the ESP32's WiFi radio as self-noise. Testing confirmed that reducing TX power from 19.5 dBm to lower levels produces a measurable reduction in background noise, which could improve BirdNET-Go detection sensitivity.

## What we built

An automatic TX power controller that stepped power up/down based on RSSI:
- Step-up immediately when RSSI < −65 dBm (fast path, every 30s in `checkWiFiHealth()`)
- Step-down after 2 consecutive 3-minute checks with RSSI > −50 dBm (confirmed slow path)
- 15 dBm dead band to prevent oscillation near boundaries
- All stepping used the existing `wifi_power_t` enum (12 levels, −1 to 19.5 dBm)

## What went wrong

### Root cause: `WiFi.setTxPower()` disrupts the WiFi PHY

Every call to `WiFi.setTxPower()` (which calls `esp_wifi_set_max_tx_power()`) causes the ESP32 radio to recalibrate. This briefly stalls TCP ACK delivery, causing:

1. `WiFiClient::write()` to block until `SO_SNDTIMEO` fires (2s per call)
2. The RTSP stream to degrade — packets queued in Core 1 outpace Core 0's blocked writes
3. After 10 consecutive write failures (~20s), the RTSP client disconnects
4. The WiFi stack itself enters a recovery state, making the device unreachable via HTTP for 60–120s additional seconds

This happened **on every single TX power change**, even one enum step (19.5 → 19.0 dBm), and even when called during an "inter-packet window" (queue empty between RTP packets). The disruption is at the PHY layer, not the application layer.

### Fixes attempted (none fully resolved the root cause)

| Fix | What it addressed | Why it wasn't enough |
|-----|------------------|----------------------|
| Remove `setTxPower()` from `resetWifiAutoState()` | Prevented cascade on reconnect | TX changes during streaming still caused stalls |
| `SO_SNDTIMEO = 2s` via `setsockopt()` | Prevented indefinite Core 0 block | Write loop still consumed ~20s before disconnect |
| Inter-packet window (`audioReadyQueue == 0`) | Avoided calling `setTxPower()` mid-write | PHY disruption happens regardless of timing |
| `nextWifiPowerLevel` variable (deferred apply) | Cleaner separation of evaluation vs. apply | Didn't change the PHY disruption on apply |

## Why we removed it

BirdNET-Go maintains continuous RTSP streams (session lengths of 6+ minutes observed). There is no safe window to call `setTxPower()` while a stream is active. Every power change disrupts the connection.

## How to revisit this

Two approaches worth considering in the future:

### Option A: Change TX power only between RTSP sessions
Gate the `setTxPower()` call on `!rtspClient.connected()`. If BirdNET-Go ever starts using short burst connections (connect → record ~10s → disconnect → repeat), this would work cleanly. The noise reduction would persist for the duration of each session.

### Option B: WiFi disconnect/reconnect cycle
Fully stop streaming, call `WiFi.disconnect()`, set TX power, call `WiFi.reconnect()`, wait for reconnect (~10–15s), resume. This is safe and deterministic, but causes a deliberate ~15s blackout per adjustment. Acceptable if adjustments happen rarely (e.g., once at startup after RSSI stabilises, never again).

### Option C: Static lower TX power
If the deployment location has consistently strong signal (RSSI > −50 dBm), just set TX power to a fixed lower value (e.g. 11–13 dBm) at startup and never change it. No dynamic logic, no instability. The noise benefit is always present. Only viable if the device is always close to the AP.
