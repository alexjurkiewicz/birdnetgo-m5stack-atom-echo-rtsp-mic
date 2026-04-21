#include <Arduino.h>
#include <math.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include "WebUI.h"
#include "webui_html.h"

// External variables and functions from main (.ino) – ESP32 RTSP Mic for BirdNET-Go
extern WiFiServer rtspServer;
extern WiFiClient rtspClient;
extern TaskHandle_t rtspSenderTaskHandle;
extern uint16_t rtpSequence;
extern uint32_t rtpTimestamp;
extern unsigned long lastStatsReset;
extern unsigned long lastNetworkActivity;
extern unsigned long lastRtspPlayMs;
extern uint32_t rtspPlayCount;
extern unsigned long lastRtspClientConnectMs;
extern unsigned long bootTime;
extern unsigned long lastRTSPActivity;
extern unsigned long lastWiFiCheck;
extern unsigned long lastTempCheck;
extern uint32_t minFreeHeap;
extern float maxTemperature;
extern bool rtspServerEnabled;
extern uint32_t audioPacketsSent;
extern uint32_t currentSampleRate;
extern float currentGainFactor;
extern uint16_t currentBufferSize;
extern uint8_t i2sShiftBits;
extern uint32_t minAcceptableRate;
extern uint32_t performanceCheckInterval;
extern bool autoRecoveryEnabled;
extern uint8_t cpuFrequencyMhz;
extern wifi_power_t currentWifiPowerLevel;
extern void resetToDefaultSettings();
extern bool autoThresholdEnabled;
extern uint32_t computeRecommendedMinRate();
extern bool scheduledResetEnabled;
extern uint32_t resetIntervalHours;
extern void scheduleReboot(bool factoryReset, uint32_t delayMs);
extern uint16_t lastPeakAbs16;
extern uint32_t audioClipCount;
extern bool audioClippedLastBlock;
extern uint16_t peakHoldAbs16;
extern bool overheatProtectionEnabled;
extern float overheatShutdownC;
extern bool overheatLockoutActive;
extern float overheatTripTemp;
extern unsigned long overheatTriggeredAt;
extern String overheatLastReason;
extern String mdnsHostname;
extern String overheatLastTimestamp;
extern bool overheatSensorFault;
extern float lastTemperatureC;
extern bool lastTemperatureValid;
extern bool overheatLatched;
extern bool agcEnabled;
extern volatile float agcMultiplier;
extern uint32_t audioPacketsDropped;
extern uint8_t ledMode;
extern bool dcBlockerEnabled;

// Local helper: snap requested Wi‑Fi TX power (dBm) to nearest supported step
static float snapWifiTxDbm(float dbm) {
    static const float steps[] = {-1.0f, 2.0f, 5.0f, 7.0f, 8.5f, 11.0f, 13.0f, 15.0f, 17.0f, 18.5f, 19.0f, 19.5f};
    float best = steps[0];
    float bestd = fabsf(dbm - steps[0]);
    for (size_t i=1;i<sizeof(steps)/sizeof(steps[0]);++i){
        float d = fabsf(dbm - steps[i]);
        if (d < bestd){ bestd = d; best = steps[i]; }
    }
    return best;
}

static const uint32_t OH_MIN = 30;
static const uint32_t OH_MAX = 95;
static const uint32_t OH_STEP = 5;

// Async reboot/factory-reset task to avoid restarting from HTTP context
static void rebootTask(void* arg){
    bool doFactory = ((uintptr_t)arg) != 0;
    if (doFactory) {
        resetToDefaultSettings();
    }
    vTaskDelay(pdMS_TO_TICKS(600));
    ESP.restart();
    vTaskDelete(NULL);
}

// Helper functions in main
extern float wifiPowerLevelToDbm(wifi_power_t lvl);
extern String formatUptime(unsigned long seconds);
extern String formatSince(unsigned long eventMs);
extern void restartI2S();
extern void saveAudioSettings();
extern void applyWifiTxPower(bool log);
extern const char* FW_VERSION_STR;

// Web server and in-memory log ring buffer
static WebServer web(80);
static const size_t LOG_CAP = 80;
static String logBuffer[LOG_CAP];
static size_t logHead = 0;
static size_t logCount = 0;

extern portMUX_TYPE logMux;

void webui_pushLog(const String &line) {
    portENTER_CRITICAL(&logMux);
    logBuffer[logHead] = line;
    logHead = (logHead + 1) % LOG_CAP;
    if (logCount < LOG_CAP) logCount++;
    portEXIT_CRITICAL(&logMux);
}

static String profileName(uint16_t buf) {
    // Server-side fallback (English). UI localizes on client by buffer size.
    if (buf <= 256) return F("Ultra-Low Latency (Higher CPU, May have dropouts)");
    if (buf <= 512) return F("Balanced (Moderate CPU, Good stability)");
    if (buf <= 1024) return F("Stable Streaming (Lower CPU, Excellent stability)");
    return F("High Stability (Lowest CPU, Maximum stability)");
}

static void apiSendJSON(const String &json) {
    web.sendHeader("Cache-Control", "no-cache");
    web.send(200, "application/json", json);
}

// HTML UI
static void httpIndex() {
    lastNetworkActivity = millis();
    web.setContentLength(CONTENT_LENGTH_UNKNOWN);
    web.send(200, "text/html; charset=utf-8", "");
    web.sendContent_P(WEBUI_HTML);
    web.sendContent("", 0);
}

// Single state endpoint — returns all device state as a flat JSON object
static void httpState() {
    lastNetworkActivity = millis();
    extern bool highpassEnabled; extern uint16_t highpassCutoffHz;

    unsigned long uptimeSeconds = (millis() - bootTime) / 1000;
    unsigned long runtime = millis() - lastStatsReset;
    uint32_t currentRate = (rtspSenderTaskHandle != NULL && runtime > 1000)
                           ? (audioPacketsSent * 1000) / runtime : 0;
    float latency_ms    = (float)currentBufferSize / currentSampleRate * 1000.0f;
    uint16_t p          = (peakHoldAbs16 > 0) ? peakHoldAbs16 : lastPeakAbs16;
    float peak_pct      = (p <= 0) ? 0.0f : (100.0f * (float)p / 32767.0f);
    float peak_dbfs     = (p <= 0) ? -90.0f : (20.0f * log10f((float)p / 32767.0f));
    float effectiveGain = agcEnabled ? (currentGainFactor * agcMultiplier) : currentGainFactor;
    bool manualRequired = overheatLatched
                          || (!rtspServerEnabled && overheatProtectionEnabled && overheatTripTemp > 0.0f);

    JsonDocument doc;
    doc["fw_version"]              = FW_VERSION_STR;
    doc["ip"]                      = WiFi.localIP().toString();
    doc["wifi_rssi"]               = WiFi.RSSI();
    doc["wifi_tx_dbm"]             = wifiPowerLevelToDbm(currentWifiPowerLevel);
    doc["free_heap_kb"]            = ESP.getFreeHeap() / 1024;
    doc["min_free_heap_kb"]        = minFreeHeap / 1024;
    doc["uptime"]                  = formatUptime(uptimeSeconds);
    doc["rtsp_server_enabled"]     = rtspServerEnabled;
    doc["client"]                  = (rtspClient && rtspClient.connected())
                                     ? rtspClient.remoteIP().toString() : String("");
    doc["streaming"]               = (rtspSenderTaskHandle != NULL);
    doc["dropped_packets"]         = audioPacketsDropped;
    doc["current_rate_pkt_s"]      = currentRate;
    doc["last_rtsp_connect"]       = formatSince(lastRtspClientConnectMs);
    doc["last_stream_start"]       = formatSince(lastRtspPlayMs);
    doc["mdns_hostname"]           = mdnsHostname;
    doc["sample_rate"]             = currentSampleRate;
    doc["gain"]                    = currentGainFactor;
    doc["buffer_size"]             = currentBufferSize;
    doc["i2s_shift"]               = i2sShiftBits;
    doc["latency_ms"]              = latency_ms;
    doc["profile"]                 = profileName(currentBufferSize);
    doc["dc_blocker_enable"]       = dcBlockerEnabled;
    doc["hp_enable"]               = highpassEnabled;
    doc["hp_cutoff_hz"]            = highpassCutoffHz;
    doc["agc_enable"]              = agcEnabled;
    doc["agc_multiplier"]          = agcMultiplier;
    doc["effective_gain"]          = effectiveGain;
    doc["peak_pct"]                = peak_pct;
    doc["peak_dbfs"]               = peak_dbfs;
    doc["clip"]                    = audioClippedLastBlock;
    doc["clip_count"]              = audioClipCount;
    doc["led_mode"]                = ledMode;
    doc["restart_threshold_pkt_s"] = minAcceptableRate;
    doc["check_interval_min"]      = performanceCheckInterval;
    doc["auto_recovery"]           = autoRecoveryEnabled;
    doc["auto_threshold"]          = autoThresholdEnabled;
    doc["recommended_min_rate"]    = computeRecommendedMinRate();
    doc["scheduled_reset"]         = scheduledResetEnabled;
    doc["reset_hours"]             = resetIntervalHours;
    if (lastTemperatureValid) { doc["current_c"] = lastTemperatureC; } else { doc["current_c"] = nullptr; }
    doc["current_valid"]           = lastTemperatureValid;
    doc["max_c"]                   = maxTemperature;
    doc["cpu_mhz"]                 = getCpuFrequencyMhz();
    doc["protection_enabled"]      = overheatProtectionEnabled;
    doc["shutdown_c"]              = (int)overheatShutdownC;
    doc["latched"]                 = overheatLockoutActive;
    doc["latched_persist"]         = overheatLatched;
    doc["sensor_fault"]            = overheatSensorFault;
    doc["last_trip_c"]             = overheatTripTemp;
    doc["last_reason"]             = overheatLastReason;
    doc["last_trip_ts"]            = overheatLastTimestamp;
    doc["last_trip_since"]         = (overheatTripTemp > 0.0f && overheatTriggeredAt != 0)
                                     ? formatSince(overheatTriggeredAt) : String("");
    doc["manual_restart"]          = manualRequired;

    // Snapshot log indices under spinlock, then read entries without holding it.
    // The writer only ever touches logBuffer[logHead] (the next slot), so the
    // committed entries we iterate over are safe to read lock-free.
    portENTER_CRITICAL(&logMux);
    size_t snapCount = logCount;
    size_t snapHead  = logHead;
    portEXIT_CRITICAL(&logMux);
    JsonArray logs = doc["logs"].to<JsonArray>();
    for (size_t i = 0; i < snapCount; i++) {
        size_t idx = (snapHead + LOG_CAP - snapCount + i) % LOG_CAP;
        logs.add(logBuffer[idx]);
    }

    String out;
    serializeJson(doc, out);
    apiSendJSON(out);
}

static void httpThermalClear() {
    if (overheatLatched) {
        overheatLatched = false;
        overheatLockoutActive = false;
        overheatTripTemp = 0.0f;
        overheatTriggeredAt = 0;
        overheatLastReason = String("Thermal latch cleared manually.");
        overheatLastTimestamp = String("");
        if (!rtspServerEnabled) {
            rtspServer.begin();
            rtspServer.setNoDelay(true);
            rtspServerEnabled = true;
        }
        saveAudioSettings();
        webui_pushLog(F("UI action: thermal_latch_clear"));
        apiSendJSON(F("{\"ok\":true}"));
    } else {
        apiSendJSON(F("{\"ok\":false}"));
    }
}

static void httpActionServerStart(){
    if (overheatLatched) {
        webui_pushLog(F("Server start blocked: thermal protection latched"));
        apiSendJSON(F("{\"ok\":false,\"error\":\"thermal_latched\"}"));
        return;
    }
    if (!rtspServerEnabled) {
        rtspServerEnabled=true; rtspServer.begin(); rtspServer.setNoDelay(true);
        overheatLockoutActive = false;
    }
    webui_pushLog(F("UI action: server_start"));
    apiSendJSON(F("{\"ok\":true}"));
}
extern bool requestStreamStop(const char* reason);
static void httpActionServerStop(){
    if (rtspSenderTaskHandle != NULL) {
        requestStreamStop("server_stop");
    }
    rtspServerEnabled=false;
    rtspServer.stop();
    webui_pushLog(F("UI action: server_stop"));
    apiSendJSON(F("{\"ok\":true}"));
}
static void httpActionResetI2S(){
    webui_pushLog(F("UI action: reset_i2s"));
    restartI2S(); apiSendJSON(F("{\"ok\":true}"));
}

static inline bool argToFloat(const String &name, float &out) { if (!web.hasArg("value")) return false; out = web.arg("value").toFloat(); return true; }
static inline bool argToUInt(const String &name, uint32_t &out) { if (!web.hasArg("value")) return false; out = (uint32_t) web.arg("value").toInt(); return true; }
static inline bool argToUShort(const String &name, uint16_t &out) { if (!web.hasArg("value")) return false; out = (uint16_t) web.arg("value").toInt(); return true; }
static inline bool argToUChar(const String &name, uint8_t &out) { if (!web.hasArg("value")) return false; out = (uint8_t) web.arg("value").toInt(); return true; }

static void httpSet() {
    if (!web.hasArg("key") || web.arg("key").length() == 0) {
        web.send(400, "application/json", F("{\"ok\":false,\"error\":\"missing key\"}"));
        return;
    }
    String key = web.arg("key");
    String val = web.hasArg("value") ? web.arg("value") : String("");
    bool matched = false;
    bool valid = false;
    if (val.length()) { webui_pushLog(String("UI set: ")+key+"="+val); }
    if (key == "gain") { matched=true; float v; if (argToFloat("value", v) && v>=0.1f && v<=100.0f) { valid=true; currentGainFactor=v; saveAudioSettings(); restartI2S(); } }
    else if (key == "rate") { matched=true; uint32_t v; if (argToUInt("value", v) && v>=8000 && v<=48000) { valid=true; currentSampleRate=v; if (autoThresholdEnabled) { minAcceptableRate = computeRecommendedMinRate(); } saveAudioSettings(); restartI2S(); } }
    else if (key == "buffer") { matched=true; uint16_t v; if (argToUShort("value", v) && v>=256 && v<=9600) { valid=true; currentBufferSize=v; if (autoThresholdEnabled) { minAcceptableRate = computeRecommendedMinRate(); } saveAudioSettings(); restartI2S(); } }
    // i2sShiftBits removed - fixed at 0 for PDM microphones
    else if (key == "wifi_tx") { matched=true; float v; if (argToFloat("value", v) && v>=-1.0f && v<=19.5f) { valid=true; extern float wifiTxPowerDbm; wifiTxPowerDbm = snapWifiTxDbm(v); applyWifiTxPower(true); saveAudioSettings(); } }
    else if (key == "auto_recovery") { matched=true; String v=web.arg("value"); if (v=="on"||v=="off") { valid=true; autoRecoveryEnabled=(v=="on"); saveAudioSettings(); } }
    else if (key == "thr_mode") { matched=true; String v=web.arg("value"); if (v=="auto") { valid=true; autoThresholdEnabled=true; minAcceptableRate = computeRecommendedMinRate(); saveAudioSettings(); } else if (v=="manual") { valid=true; autoThresholdEnabled=false; saveAudioSettings(); } }
    else if (key == "min_rate") { matched=true; uint32_t v; if (argToUInt("value", v) && v>=5 && v<=200) { valid=true; minAcceptableRate=v; saveAudioSettings(); } }
    else if (key == "check_interval") { matched=true; uint32_t v; if (argToUInt("value", v) && v>=1 && v<=60) { valid=true; performanceCheckInterval=v; saveAudioSettings(); } }
    else if (key == "sched_reset") { matched=true; String v=web.arg("value"); if (v=="on"||v=="off") { valid=true; extern bool scheduledResetEnabled; scheduledResetEnabled=(v=="on"); saveAudioSettings(); } }
    else if (key == "reset_hours") { matched=true; uint32_t v; if (argToUInt("value", v) && v>=1 && v<=168) { valid=true; extern uint32_t resetIntervalHours; resetIntervalHours=v; saveAudioSettings(); } }
    else if (key == "cpu_freq") { matched=true; uint32_t v; if (argToUInt("value", v) && v>=40 && v<=240) { valid=true; cpuFrequencyMhz=(uint8_t)v; setCpuFrequencyMhz(cpuFrequencyMhz); saveAudioSettings(); } }
    else if (key == "dc_blocker") { matched=true; String v=web.arg("value"); if (v=="on"||v=="off") { valid=true; dcBlockerEnabled=(v=="on"); saveAudioSettings(); } }
    else if (key == "hp_enable") { matched=true; String v=web.arg("value"); if (v=="on"||v=="off") { valid=true; extern bool highpassEnabled; highpassEnabled=(v=="on"); extern void updateHighpassCoeffs(); updateHighpassCoeffs(); saveAudioSettings(); } }
    else if (key == "hp_cutoff") { matched=true; uint32_t v; if (argToUInt("value", v) && v>=10 && v<=10000) { valid=true; extern uint16_t highpassCutoffHz; highpassCutoffHz=(uint16_t)v; extern void updateHighpassCoeffs(); updateHighpassCoeffs(); saveAudioSettings(); } }
    else if (key == "agc_enable") { matched=true; String v=web.arg("value"); if (v=="on"||v=="off") { valid=true; agcEnabled=(v=="on"); if (!agcEnabled) agcMultiplier=1.0f; saveAudioSettings(); } }
    else if (key == "led_mode") { matched=true; uint32_t v; if (argToUInt("value", v) && v<=2) { valid=true; ledMode=(uint8_t)v; saveAudioSettings(); } }
    else if (key == "oh_enable") { matched=true; String v=web.arg("value"); if (v=="on"||v=="off") { valid=true; overheatProtectionEnabled = (v=="on"); if (!overheatProtectionEnabled) { overheatLockoutActive = false; } saveAudioSettings(); } }
    else if (key == "oh_limit") { matched=true; uint32_t v; if (argToUInt("value", v) && v>=OH_MIN && v<=OH_MAX) { valid=true; uint32_t snapped = OH_MIN + ((v - OH_MIN)/OH_STEP)*OH_STEP; overheatShutdownC = (float)snapped; overheatLockoutActive = false; saveAudioSettings(); } }
    else if (key == "hostname") { matched=true; String v=val; v.trim(); if (v.length()>=1 && v.length()<=63) { valid=true; mdnsHostname=v; saveAudioSettings(); scheduleReboot(false, 600); } }
    if (!matched) { web.send(400, "application/json", F("{\"ok\":false,\"error\":\"unknown key\"}")); return; }
    if (!valid) { web.send(400, "application/json", F("{\"ok\":false,\"error\":\"invalid value\"}")); return; }
    apiSendJSON(F("{\"ok\":true}"));
}

void webui_begin() {
    web.on("/", httpIndex);
    web.on("/api/state", httpState);
    web.on("/api/thermal/clear", HTTP_POST, httpThermalClear);
    web.on("/api/action/server_start", httpActionServerStart);
    web.on("/api/action/server_stop", httpActionServerStop);
    web.on("/api/action/reset_i2s", httpActionResetI2S);
    web.on("/api/action/reboot", [](){ webui_pushLog(F("UI action: reboot")); apiSendJSON(F("{\"ok\":true}")); scheduleReboot(false, 600); });
    web.on("/api/action/factory_reset", [](){ webui_pushLog(F("UI action: factory_reset")); apiSendJSON(F("{\"ok\":true}")); scheduleReboot(true, 600); });
    web.on("/api/action/reconfigure_wifi", [](){ webui_pushLog(F("UI action: reconfigure_wifi")); apiSendJSON(F("{\"ok\":true}")); WiFiManager wm; wm.resetSettings(); scheduleReboot(false, 600); });
    web.on("/api/set", httpSet);
    web.begin();
}

void webui_handleClient() {
    web.handleClient();
}
