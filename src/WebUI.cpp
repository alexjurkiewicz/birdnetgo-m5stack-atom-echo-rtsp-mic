#include <Arduino.h>
#include <math.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WiFiManager.h>
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

static String jsonEscape(const String &s) {
    String o; o.reserve(s.length()+8);
    for (size_t i=0;i<s.length();++i){char c=s[i]; if(c=='"'||c=='\\'){o+='\\';o+=c;} else if(c=='\n'){o+="\\n";} else {o+=c;}}
    return o;
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

// HTTP handlery

static void httpStatus() {
    lastNetworkActivity = millis();
    unsigned long uptimeSeconds = (millis() - bootTime) / 1000;
    String uptimeStr = formatUptime(uptimeSeconds);
    unsigned long runtime = millis() - lastStatsReset;
    uint32_t currentRate = (rtspSenderTaskHandle != NULL && runtime > 1000) ? (audioPacketsSent * 1000) / runtime : 0;
    String json = "{";
    json += "\"fw_version\":\"" + String(FW_VERSION_STR) + "\",";
    json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
    json += "\"wifi_rssi\":" + String(WiFi.RSSI()) + ",";
    json += "\"wifi_tx_dbm\":" + String(wifiPowerLevelToDbm(currentWifiPowerLevel),1) + ",";
    json += "\"free_heap_kb\":" + String(ESP.getFreeHeap()/1024) + ",";
    json += "\"min_free_heap_kb\":" + String(minFreeHeap/1024) + ",";
    json += "\"uptime\":\"" + uptimeStr + "\",";
    json += "\"rtsp_server_enabled\":" + String(rtspServerEnabled?"true":"false") + ",";
    if (rtspClient && rtspClient.connected()) json += "\"client\":\"" + rtspClient.remoteIP().toString() + "\","; else json += "\"client\":\"\",";
    json += "\"streaming\":" + String(rtspSenderTaskHandle != NULL ? "true" : "false") + ",";
    if (lastTemperatureValid) json += "\"temp_c\":" + String(lastTemperatureC, 1) + ",";
    json += "\"dropped_packets\":" + String(audioPacketsDropped) + ",";
    json += "\"current_rate_pkt_s\":" + String(currentRate) + ",";
    json += "\"last_rtsp_connect\":\"" + jsonEscape(formatSince(lastRtspClientConnectMs)) + "\",";
    json += "\"last_stream_start\":\"" + jsonEscape(formatSince(lastRtspPlayMs)) + "\",";
    json += "\"mdns_hostname\":\"" + jsonEscape(mdnsHostname) + "\"";
    json += "}";
    apiSendJSON(json);
}

static void httpAudioStatus() {
    float latency_ms = (float)currentBufferSize / currentSampleRate * 1000.0f;
    String json = "{";
    json += "\"sample_rate\":" + String(currentSampleRate) + ",";
    json += "\"gain\":" + String(currentGainFactor,2) + ",";
    json += "\"buffer_size\":" + String(currentBufferSize) + ",";
    json += "\"i2s_shift\":" + String(i2sShiftBits) + ",";
    json += "\"latency_ms\":" + String(latency_ms,1) + ",";
    extern bool highpassEnabled; extern uint16_t highpassCutoffHz;
    json += "\"profile\":\"" + jsonEscape(profileName(currentBufferSize)) + "\",";
    json += "\"dc_blocker_enable\":" + String(dcBlockerEnabled?"true":"false") + ",";
    json += "\"hp_enable\":" + String(highpassEnabled?"true":"false") + ",";
    json += "\"hp_cutoff_hz\":" + String((uint32_t)highpassCutoffHz) + ",";
    json += "\"agc_enable\":" + String(agcEnabled?"true":"false") + ",";
    json += "\"agc_multiplier\":" + String(agcMultiplier, 2) + ",";
    float effectiveGain = agcEnabled ? (currentGainFactor * agcMultiplier) : currentGainFactor;
    json += "\"effective_gain\":" + String(effectiveGain, 2) + ",";
    // Metering/clipping
    uint16_t p = (peakHoldAbs16 > 0) ? peakHoldAbs16 : lastPeakAbs16;
    float peak_pct = (p <= 0) ? 0.0f : (100.0f * (float)p / 32767.0f);
    float peak_dbfs = (p <= 0) ? -90.0f : (20.0f * log10f((float)p / 32767.0f));
    json += "\"peak_pct\":" + String(peak_pct,1) + ",";
    json += "\"peak_dbfs\":" + String(peak_dbfs,1) + ",";
    json += "\"clip\":" + String(audioClippedLastBlock?"true":"false") + ",";
    json += "\"clip_count\":" + String(audioClipCount) + ",";
    json += "\"led_mode\":" + String(ledMode);
    json += "}";
    apiSendJSON(json);
}

static void httpPerfStatus() {
    String json = "{";
    json += "\"restart_threshold_pkt_s\":" + String(minAcceptableRate) + ",";
    json += "\"check_interval_min\":" + String(performanceCheckInterval) + ",";
    json += "\"auto_recovery\":" + String(autoRecoveryEnabled?"true":"false") + ",";
    json += "\"auto_threshold\":" + String(autoThresholdEnabled?"true":"false") + ",";
    json += "\"recommended_min_rate\":" + String(computeRecommendedMinRate()) + ",";
    json += "\"scheduled_reset\":" + String(scheduledResetEnabled?"true":"false") + ",";
    json += "\"reset_hours\":" + String(resetIntervalHours) + "}";
    apiSendJSON(json);
}

static void httpThermal() {
    String since = "";
    if (overheatTripTemp > 0.0f && overheatTriggeredAt != 0) {
        since = formatSince(overheatTriggeredAt);
    }
    bool manualRequired = overheatLatched || (!rtspServerEnabled && overheatProtectionEnabled && overheatTripTemp > 0.0f);
    String json = "{";
    if (lastTemperatureValid) {
        json += "\"current_c\":" + String(lastTemperatureC,1) + ",";
    } else {
        json += "\"current_c\":null,";
    }
    json += "\"current_valid\":" + String(lastTemperatureValid?"true":"false") + ",";
    json += "\"max_c\":" + String(maxTemperature,1) + ",";
    json += "\"cpu_mhz\":" + String(getCpuFrequencyMhz()) + ",";
    json += "\"protection_enabled\":" + String(overheatProtectionEnabled?"true":"false") + ",";
    json += "\"shutdown_c\":" + String(overheatShutdownC,0) + ",";
    json += "\"latched\":" + String(overheatLockoutActive?"true":"false") + ",";
    json += "\"latched_persist\":" + String(overheatLatched?"true":"false") + ",";
    json += "\"sensor_fault\":" + String(overheatSensorFault?"true":"false") + ",";
    json += "\"last_trip_c\":" + String(overheatTripTemp,1) + ",";
    json += "\"last_reason\":\"" + jsonEscape(overheatLastReason) + "\",";
    json += "\"last_trip_ts\":\"" + jsonEscape(overheatLastTimestamp) + "\",";
    json += "\"last_trip_since\":\"" + jsonEscape(since) + "\",";
    json += "\"manual_restart\":" + String(manualRequired?"true":"false");
    json += "}";
    apiSendJSON(json);
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

static void httpLogs() {
    String out;
    for (size_t i=0;i<logCount;i++){
        size_t idx = (logHead + LOG_CAP - logCount + i) % LOG_CAP;
        out += logBuffer[idx]; out += '\n';
    }
    web.send(200, "text/plain; charset=utf-8", out.length() ? out : String("\n"));
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
    web.on("/api/status", httpStatus);
    web.on("/api/audio_status", httpAudioStatus);
    web.on("/api/perf_status", httpPerfStatus);
    web.on("/api/thermal", httpThermal);
    web.on("/api/thermal/clear", HTTP_POST, httpThermalClear);
    web.on("/api/logs", httpLogs);
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
