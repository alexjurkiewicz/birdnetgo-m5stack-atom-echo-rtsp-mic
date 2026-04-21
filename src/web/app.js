import {
  html,
  render,
  useEffect,
  useRef,
  useState,
} from "https://esm.sh/htm/preact/standalone";

const I18N_CONFIG = {
  default_language: "en",
  languages: ["en", "cs"],
  translations: {
    "app.title": {
      en: "ESP32 RTSP Mic for BirdNET-Go",
      cs: "ESP32 RTSP Mic pro BirdNET-Go",
    },
    "app.subtitle": {
      en: "Embedded control surface for the M5Stack Atom Echo RTSP microphone.",
      cs: "Vestavěné rozhraní pro RTSP mikrofon M5Stack Atom Echo.",
    },
    "app.repository": { en: "GitHub", cs: "GitHub" },
    "app.language": { en: "Language", cs: "Jazyk" },
    "app.rtsp_url": { en: "RTSP URL", cs: "RTSP URL" },
    "app.summary.server": { en: "Server", cs: "Server" },
    "app.summary.streaming": { en: "Streaming", cs: "Streamování" },
    "app.summary.packet_rate": { en: "Packet Rate", cs: "Rychlost paketů" },
    "app.summary.temperature": { en: "Temperature", cs: "Teplota" },
    "common.loading": { en: "Loading…", cs: "Načítání…" },
    "common.na": { en: "N/A", cs: "N/A" },
    "common.waiting": { en: "Waiting…", cs: "Čekám…" },
    "common.unknown": { en: "Unknown", cs: "Neznámé" },
    "common.set": { en: "Set", cs: "Nastavit" },
    "common.set_reboot": { en: "Set & Reboot", cs: "Nastavit a restartovat" },
    "common.copy_logs": { en: "Copy Logs", cs: "Kopírovat logy" },
    "common.copied": { en: "Copied", cs: "Zkopírováno" },
    "common.on": { en: "ON", cs: "ZAP" },
    "common.off": { en: "OFF", cs: "VYP" },
    "common.auto": { en: "Auto", cs: "Automaticky" },
    "common.manual": { en: "Manual", cs: "Manuálně" },
    "common.enabled": { en: "Enabled", cs: "Povoleno" },
    "common.disabled": { en: "Disabled", cs: "Zakázáno" },
    "common.yes": { en: "Yes", cs: "Ano" },
    "common.no": { en: "No", cs: "Ne" },
    "common.active": { en: "Active", cs: "Aktivní" },
    "common.inactive": { en: "Inactive", cs: "Neaktivní" },
    "common.refresh_error": {
      en: "Some data could not be refreshed. The last known values are still shown.",
      cs: "Část dat se nepodařilo obnovit. Zobrazuji poslední známé hodnoty.",
    },
    "common.save_error": {
      en: "Setting update failed.",
      cs: "Uložení nastavení se nezdařilo.",
    },
    "common.action_error": {
      en: "Action request failed.",
      cs: "Požadovaná akce selhala.",
    },
    "common.connection_error": {
      en: "Device is not responding right now.",
      cs: "Zařízení právě neodpovídá.",
    },
    "common.invalid_value": {
      en: "Please fix the highlighted value first.",
      cs: "Nejprve opravte zvýrazněnou hodnotu.",
    },
    "action.server_start": { en: "RTSP Server ON", cs: "RTSP server ZAP" },
    "action.server_stop": { en: "RTSP Server OFF", cs: "RTSP server VYP" },
    "action.reset_i2s": { en: "Reset I2S", cs: "Reset I2S" },
    "action.reboot": { en: "Reboot", cs: "Restart" },
    "action.defaults": { en: "Defaults", cs: "Výchozí" },
    "action.wifi_setup": { en: "WiFi Setup", cs: "Nastavení WiFi" },
    "action.confirm_reboot": {
      en: "Restart device now?",
      cs: "Restartovat zařízení nyní?",
    },
    "action.confirm_defaults": {
      en: "Reset settings to defaults and reboot?",
      cs: "Obnovit výchozí nastavení a restartovat?",
    },
    "action.confirm_wifi": {
      en: "Erase stored WiFi credentials and reboot into the setup portal?",
      cs: "Smazat uložené WiFi údaje a restartovat do konfiguračního portálu?",
    },
    "overlay.restarting": {
      en: "Restarting device…",
      cs: "Zařízení se restartuje…",
    },
    "overlay.resetting": {
      en: "Restoring defaults and rebooting…",
      cs: "Obnovuji výchozí nastavení a restartuji…",
    },
    "overlay.wifi": {
      en: "Rebooting into WiFi setup. Connect to ESP32-RTSP-Mic-AP after the restart.",
      cs: "Zařízení se restartuje do WiFi nastavení. Po restartu se připojte k ESP32-RTSP-Mic-AP.",
    },
    "section.status": { en: "Status", cs: "Stav" },
    "section.audio": { en: "Audio", cs: "Audio" },
    "section.reliability": { en: "Reliability", cs: "Spolehlivost" },
    "section.thermal": { en: "Thermal", cs: "Teplota" },
    "section.advanced": { en: "Advanced", cs: "Pokročilé" },
    "section.logs": { en: "Logs", cs: "Logy" },
    "status.ip": { en: "IP Address", cs: "IP adresa" },
    "status.wifi_rssi": { en: "WiFi RSSI", cs: "WiFi RSSI" },
    "status.wifi_tx": { en: "WiFi TX Power", cs: "WiFi výkon" },
    "status.heap": { en: "Free Heap (min)", cs: "Volná RAM (min)" },
    "status.uptime": { en: "Uptime", cs: "Doba běhu" },
    "status.rtsp_server": { en: "RTSP Server", cs: "RTSP server" },
    "status.client": { en: "Client", cs: "Klient" },
    "status.streaming": { en: "Streaming", cs: "Streamování" },
    "status.packet_rate": { en: "Packet Rate", cs: "Rychlost paketů" },
    "status.last_connect": {
      en: "Last RTSP Connect",
      cs: "Poslední RTSP připojení",
    },
    "status.last_play": {
      en: "Last Stream Start",
      cs: "Poslední start streamu",
    },
    "status.server_enabled": { en: "Enabled", cs: "Povolen" },
    "status.server_disabled": { en: "Disabled", cs: "Zakázán" },
    "status.streaming_yes": { en: "Yes", cs: "Ano" },
    "status.streaming_no": { en: "No", cs: "Ne" },
    "status.overview": {
      en: "Live device status from the last refresh.",
      cs: "Živý stav zařízení z posledního obnovení.",
    },
    "audio.sample_rate": { en: "Sample Rate", cs: "Vzorkovací frekvence" },
    "audio.gain": { en: "Gain", cs: "Zisk" },
    "audio.dc_blocker": { en: "DC Blocker", cs: "DC blocker" },
    "audio.highpass": { en: "High-pass", cs: "Vysokopropustný filtr" },
    "audio.highpass_cutoff": {
      en: "HPF Cutoff",
      cs: "Mezní frekvence HPF",
    },
    "audio.agc": { en: "AGC", cs: "AGC" },
    "audio.led_mode": { en: "LED Mode", cs: "Režim LED" },
    "audio.buffer_size": { en: "Buffer Size", cs: "Velikost bufferu" },
    "audio.latency": { en: "Latency", cs: "Latence" },
    "audio.signal_level": { en: "Signal Level", cs: "Úroveň signálu" },
    "audio.profile": { en: "Profile", cs: "Profil" },
    "audio.led_off": { en: "Off", cs: "Vyp" },
    "audio.led_static": { en: "Static", cs: "Statická" },
    "audio.led_level": { en: "Level", cs: "Úroveň" },
    "audio.profile_ultra": {
      en: "Ultra-Low Latency",
      cs: "Ultra nízká latence",
    },
    "audio.profile_balanced": {
      en: "Balanced",
      cs: "Vyvážené",
    },
    "audio.profile_stable": {
      en: "Stable Streaming",
      cs: "Stabilní stream",
    },
    "audio.profile_high": {
      en: "High Stability",
      cs: "Vysoká stabilita",
    },
    "audio.agc_info": {
      en: "Multiplier {multiplier}×, effective gain {effective}×",
      cs: "Násobič {multiplier}×, efektivní zisk {effective}×",
    },
    "audio.level_ok": { en: "OK", cs: "V pořádku" },
    "audio.level_warn": {
      en: "High level, close to clipping",
      cs: "Vysoká úroveň, blízko přebuzení",
    },
    "audio.level_bad": {
      en: "Clipping detected",
      cs: "Detekováno přebuzení",
    },
    "audio.level_value": {
      en: "Peak {pct}% ({db} dBFS)",
      cs: "Špička {pct}% ({db} dBFS)",
    },
    "audio.level_value_clips": {
      en: "Peak {pct}% ({db} dBFS), clips: {clips}",
      cs: "Špička {pct}% ({db} dBFS), přebuzení: {clips}",
    },
    "audio.help.sample_rate": {
      en: "48 kHz is the recommended default and hardware maximum for the onboard PDM microphone.",
      cs: "48 kHz je doporučené výchozí nastavení a hardwarové maximum pro vestavěný PDM mikrofon.",
    },
    "audio.help.gain": {
      en: "Software amplification after the I2S shift. Too much gain causes clipping.",
      cs: "Softwarové zesílení po I2S posunu. Příliš vysoká hodnota způsobí přebuzení.",
    },
    "audio.help.dc_blocker": {
      en: "Single-pole filter that removes DC offset from the microphone. Leave it on unless you are debugging audio artifacts.",
      cs: "Jednopólový filtr, který odstraňuje DC složku mikrofonu. Vypínejte jen při ladění artefaktů.",
    },
    "audio.help.highpass": {
      en: "Removes low-frequency rumble such as wind, traffic and handling noise.",
      cs: "Potlačuje nízkofrekvenční hluk jako vítr, dopravu nebo manipulační ruch.",
    },
    "audio.help.highpass_cutoff": {
      en: "80 Hz is conservative. Raise only when low-frequency noise is overwhelming the useful signal.",
      cs: "80 Hz je konzervativní hodnota. Zvyšujte ji jen při silném nízkofrekvenčním hluku.",
    },
    "audio.help.agc": {
      en: "Automatic Gain Control adapts loudness. It is useful when bird distance changes over time.",
      cs: "Automatické řízení zisku upravuje hlasitost. Hodí se, když se vzdálenost ptáků mění.",
    },
    "audio.help.led_mode": {
      en: "Off keeps the LED dark, Static shows state, Level tracks the audio level.",
      cs: "Vyp zhasne LED, Statická ukazuje stav, Úroveň sleduje hlasitost signálu.",
    },
    "audio.help.buffer_size": {
      en: "Larger packets increase latency but improve stability on weak WiFi links.",
      cs: "Větší pakety zvyšují latenci, ale zlepšují stabilitu na slabší WiFi síti.",
    },
    "audio.hpf_group_note": {
      en: "Cutoff is available only while High-pass is enabled.",
      cs: "Mezní frekvence je dostupná jen při zapnutém vysokopropustném filtru.",
    },
    "audio.gain_mode_note": {
      en: "Manual uses a fixed gain. Auto enables AGC while keeping this value as the base gain.",
      cs: "Manuální režim používá pevný zisk. Automatický režim zapne AGC a tuto hodnotu ponechá jako základní zisk.",
    },
    "reliability.auto_recovery": {
      en: "Auto Recovery",
      cs: "Automatická obnova",
    },
    "reliability.threshold_mode": {
      en: "Threshold Mode",
      cs: "Režim prahu",
    },
    "reliability.restart_threshold": {
      en: "Restart Threshold",
      cs: "Prahová hodnota restartu",
    },
    "reliability.scheduled_reset": {
      en: "Scheduled Reset",
      cs: "Plánovaný restart",
    },
    "reliability.reset_hours": {
      en: "Reset After",
      cs: "Po kolika hodinách",
    },
    "reliability.help.auto_recovery": {
      en: "Restarts the audio pipeline when packet rate collapses.",
      cs: "Restartuje audio pipeline při kolapsu rychlosti paketů.",
    },
    "reliability.help.threshold_mode": {
      en: "Auto computes the threshold from sample rate and buffer size. Manual exposes the exact packet-rate floor.",
      cs: "Auto počítá práh ze vzorkovací frekvence a bufferu. Manuální režim vystaví přesnou mez paketové rychlosti.",
    },
    "reliability.help.restart_threshold": {
      en: "Used only in manual mode. Valid range is 5 to 200 packets per second.",
      cs: "Používá se jen v manuálním režimu. Platný rozsah je 5 až 200 paketů za sekundu.",
    },
    "reliability.help.scheduled_reset": {
      en: "Optional periodic reboot for problematic networks.",
      cs: "Volitelný periodický restart pro problematické sítě.",
    },
    "reliability.help.reset_hours": {
      en: "Number of hours between scheduled restarts.",
      cs: "Počet hodin mezi plánovanými restarty.",
    },
    "reliability.recommended_threshold": {
      en: "Recommended threshold: {value} pkt/s",
      cs: "Doporučený práh: {value} pkt/s",
    },
    "thermal.overheat_protection": {
      en: "Overheat Protection",
      cs: "Ochrana proti přehřátí",
    },
    "thermal.shutdown_limit": {
      en: "Shutdown Limit",
      cs: "Vypínací teplota",
    },
    "thermal.status": { en: "Status", cs: "Stav" },
    "thermal.current": { en: "Current Temp", cs: "Aktuální teplota" },
    "thermal.peak": { en: "Peak Temp", cs: "Maximální teplota" },
    "thermal.cpu": { en: "CPU Clock", cs: "Takt CPU" },
    "thermal.last": { en: "Last Shutdown", cs: "Poslední zásah" },
    "thermal.clear_latch": {
      en: "Acknowledge & Re-enable RTSP",
      cs: "Potvrdit a znovu povolit RTSP",
    },
    "thermal.help.overheat_protection": {
      en: "Stops streaming when the ESP32 exceeds the configured limit.",
      cs: "Zastaví stream, když ESP32 překročí nastavený limit.",
    },
    "thermal.help.shutdown_limit": {
      en: "80 °C is a safe default for most open boards. Use 70–75 °C in tight enclosures.",
      cs: "80 °C je bezpečná výchozí hodnota pro většinu odkrytých desek. V uzavřených krabičkách použijte 70–75 °C.",
    },
    "thermal.status_ready": {
      en: "Protection ready",
      cs: "Ochrana připravena",
    },
    "thermal.status_disabled": {
      en: "Protection disabled",
      cs: "Ochrana vypnuta",
    },
    "thermal.status_latched": {
      en: "Cooling required, restart manually",
      cs: "Vyžadováno ochlazení, restartujte ručně",
    },
    "thermal.status_sensor_fault": {
      en: "Sensor unavailable, protection paused",
      cs: "Senzor nedostupný, ochrana pozastavena",
    },
    "thermal.status_latched_persist": {
      en: "Protection latched, acknowledge to re-enable",
      cs: "Ochrana zablokována, potvrďte znovupovolení",
    },
    "thermal.last_none": {
      en: "No shutdown recorded yet.",
      cs: "Zatím nebylo zaznamenáno žádné vypnutí.",
    },
    "thermal.last_sensor_fault": {
      en: "Thermal protection disabled because the temperature sensor is unavailable.",
      cs: "Tepelná ochrana je vypnuta, protože teplotní senzor není dostupný.",
    },
    "thermal.last_fmt": {
      en: "Stopped at {temp} °C with a {limit} °C limit after {time} uptime ({ago}).",
      cs: "Stream se zastavil při {temp} °C s limitem {limit} °C po době běhu {time} ({ago}).",
    },
    "thermal.latch_notice": {
      en: "Thermal shutdown latched the RTSP server. Re-enable it only after the hardware has cooled down.",
      cs: "Tepelná ochrana zablokovala RTSP server. Znovu jej povolte až po vychladnutí hardwaru.",
    },
    "advanced.i2s_shift": { en: "I2S Shift", cs: "I2S posun" },
    "advanced.i2s_shift_value": {
      en: "0 bits (fixed for PDM microphones)",
      cs: "0 bitů (pevně pro PDM mikrofony)",
    },
    "advanced.check_interval": {
      en: "Check Interval",
      cs: "Interval kontroly",
    },
    "advanced.wifi_tx_power": {
      en: "TX Power",
      cs: "TX výkon",
    },
    "advanced.hostname": { en: "Hostname", cs: "Hostname" },
    "advanced.cpu_frequency": {
      en: "CPU Frequency",
      cs: "Frekvence CPU",
    },
    "advanced.help.check_interval": {
      en: "How often reliability checks run while the device is active.",
      cs: "Jak často se provádějí kontroly spolehlivosti, když je zařízení aktivní.",
    },
    "advanced.help.wifi_tx_power": {
      en: "Lower transmit power can reduce RF self-noise but also reduces range.",
      cs: "Nižší vysílací výkon může omezit vlastní RF šum, ale zkracuje dosah.",
    },
    "advanced.help.hostname": {
      en: "Changing the mDNS hostname schedules a reboot.",
      cs: "Změna mDNS hostname naplánuje restart.",
    },
    "advanced.help.cpu_frequency": {
      en: "Lower CPU speeds reduce heat and power usage. 120 MHz is a balanced default.",
      cs: "Nižší takty snižují teplotu i spotřebu. 120 MHz je vyvážená výchozí hodnota.",
    },
    "binary.enabled": { en: "Enabled", cs: "Povoleno" },
    "binary.disabled": { en: "Disabled", cs: "Zakázáno" },
    "logs.help": {
      en: "Live device log output. New lines append automatically.",
      cs: "Živý výstup logu zařízení. Nové řádky se doplňují automaticky.",
    },
  },
};

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "cs", label: "Čeština" },
];

const SAMPLE_RATE_OPTIONS = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];
const BUFFER_OPTIONS = [256, 512, 1024, 2048, 3072, 4096, 6144, 9600];
const WIFI_TX_OPTIONS = [-1.0, 2.0, 5.0, 7.0, 8.5, 11.0, 13.0, 15.0, 17.0, 18.5, 19.0, 19.5];
const CPU_OPTIONS = [80, 120, 160, 240];
const THERMAL_LIMIT_OPTIONS = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];

const state = {
  lang: "en",
  loading: true,
  error: "",
  info: "",
  overlay: "",
  copyLabelKey: "common.copy_logs",
  status: null,
  audio: null,
  perf: null,
  thermal: null,
  logs: "",
};

let reconnectTimer = null;
let pollTimer = null;

function createI18n(config) {
  let lang = detectInitialLanguage(config);

  function get(key) {
    const entry = config.translations[key];
    if (!entry) return key;
    return entry[lang] ?? entry[config.default_language] ?? key;
  }

  return {
    getLang() {
      return lang;
    },
    getLanguages() {
      return config.languages.slice();
    },
    setLang(next) {
      const normalized = config.languages.includes(next)
        ? next
        : config.default_language;
      lang = normalized;
      try {
        localStorage.setItem("lang", normalized);
      } catch (_error) {}
    },
    t(key, params = {}) {
      let text = get(key);
      return text.replace(/\{(\w+)\}/g, (_match, token) => {
        return params[token] ?? `{${token}}`;
      });
    },
  };
}

function detectInitialLanguage(config) {
  try {
    const saved = localStorage.getItem("lang");
    if (saved && config.languages.includes(saved)) return saved;
  } catch (_error) {}
  const nav = (navigator.language || "").toLowerCase();
  const base = nav.split("-")[0];
  return config.languages.includes(base) ? base : config.default_language;
}

const i18n = createI18n(I18N_CONFIG);
state.lang = i18n.getLang();
document.documentElement.lang = state.lang;

function t(key, params) {
  return i18n.t(key, params);
}

function rerender() {
  document.title = t("app.title");
  render(html`<${App} />`, document.getElementById("app"));
}

function setState(patch) {
  Object.assign(state, patch);
  rerender();
}

function parseNumber(rawValue) {
  const normalized = String(rawValue ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const FIELD_VALIDATORS = {
  gain(value) {
    const parsed = parseNumber(value);
    return parsed !== null && parsed >= 0.1 && parsed <= 100;
  },
  hp_cutoff(value) {
    const parsed = parseNumber(value);
    return parsed !== null && parsed >= 10 && parsed <= 10000;
  },
  min_rate(value) {
    const parsed = parseNumber(value);
    return parsed !== null && parsed >= 5 && parsed <= 200 && Number.isInteger(parsed);
  },
  reset_hours(value) {
    const parsed = parseNumber(value);
    return parsed !== null && parsed >= 1 && parsed <= 168 && Number.isInteger(parsed);
  },
  check_interval(value) {
    const parsed = parseNumber(value);
    return parsed !== null && parsed >= 1 && parsed <= 60 && Number.isInteger(parsed);
  },
  hostname(value) {
    const trimmed = String(value ?? "").trim();
    return /^[A-Za-z0-9-]{1,63}$/.test(trimmed);
  },
};

function setInfo(message) {
  state.info = message;
  rerender();
}

function clearInfoSoon() {
  window.setTimeout(() => {
    if (state.info) {
      state.info = "";
      rerender();
    }
  }, 2000);
}

function isFieldValid(fieldKey, rawValue) {
  const validator = FIELD_VALIDATORS[fieldKey];
  if (!validator) return true;
  const value = String(rawValue ?? "").trim();
  if (!value) return true;
  return validator(value);
}

function isBinaryOn(rawValue) {
  return String(rawValue ?? "") === "on";
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      throw new Error(`${path}: invalid JSON`);
    }
  }
  if (!response.ok) {
    throw new Error(data.error || response.statusText || path);
  }
  return data;
}

async function apiText(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
  });
  if (!response.ok) {
    throw new Error(response.statusText || path);
  }
  return response.text();
}

async function loadAll({ silent = false } = {}) {
  if (!silent) {
    state.loading = true;
    rerender();
  }

  const results = await Promise.allSettled([
    apiJson("/api/status"),
    apiJson("/api/audio_status"),
    apiJson("/api/perf_status"),
    apiJson("/api/thermal"),
    apiText("/api/logs"),
  ]);

  let hadError = false;

  if (results[0].status === "fulfilled") state.status = results[0].value;
  else hadError = true;

  if (results[1].status === "fulfilled") state.audio = results[1].value;
  else hadError = true;

  if (results[2].status === "fulfilled") state.perf = results[2].value;
  else hadError = true;

  if (results[3].status === "fulfilled") state.thermal = results[3].value;
  else hadError = true;

  if (results[4].status === "fulfilled") state.logs = results[4].value;
  else hadError = true;

  state.loading = false;
  state.error = hadError ? t("common.refresh_error") : "";
  rerender();
}

async function saveSetting(key, rawValue) {
  const value = String(rawValue ?? "").trim().replace(",", ".");
  if (!value) return;
  if (!isFieldValid(key, value)) {
    throw new Error(t("common.invalid_value"));
  }

  try {
    const data = await apiJson(
      `/api/set?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`,
    );
    if (!data.ok) throw new Error(t("common.save_error"));
    await loadAll({ silent: true });
    state.error = "";
    rerender();
  } catch (error) {
    state.error = error.message || t("common.save_error");
    rerender();
    throw error;
  }
}

async function runAction(actionName) {
  try {
    const data = await apiJson(`/api/action/${actionName}`);
    if (!data.ok) throw new Error(t("common.action_error"));
    await loadAll({ silent: true });
  } catch (error) {
    state.error = error.message || t("common.action_error");
    rerender();
  }
}

function startReconnectLoop() {
  window.clearTimeout(reconnectTimer);

  const tick = async () => {
    try {
      await apiJson("/api/status");
      window.location.reload();
    } catch (_error) {
      reconnectTimer = window.setTimeout(tick, 2000);
    }
  };

  reconnectTimer = window.setTimeout(tick, 4000);
}

async function handleReboot() {
  if (!window.confirm(t("action.confirm_reboot"))) return;
  setState({ overlay: t("overlay.restarting"), error: "" });
  try {
    await apiJson("/api/action/reboot");
    startReconnectLoop();
  } catch (error) {
    setState({ overlay: "", error: error.message || t("common.action_error") });
  }
}

async function handleDefaults() {
  if (!window.confirm(t("action.confirm_defaults"))) return;
  setState({ overlay: t("overlay.resetting"), error: "" });
  try {
    await apiJson("/api/action/factory_reset");
    startReconnectLoop();
  } catch (error) {
    setState({ overlay: "", error: error.message || t("common.action_error") });
  }
}

async function handleWifiSetup() {
  if (!window.confirm(t("action.confirm_wifi"))) return;
  setState({ overlay: t("overlay.wifi"), error: "" });
  try {
    await apiJson("/api/action/reconfigure_wifi");
  } catch (error) {
    setState({ overlay: "", error: error.message || t("common.action_error") });
  }
}

async function handleHostnameSave(_fieldKey, rawValue) {
  const value = String(rawValue ?? state.status?.mdns_hostname ?? "")
    .trim()
    .replace(/\s+/g, "");
  if (!value) return;
  if (!isFieldValid("hostname", value)) {
    throw new Error(t("common.invalid_value"));
  }

  state.overlay = t("overlay.restarting");
  rerender();

  try {
    const data = await apiJson(
      `/api/set?key=hostname&value=${encodeURIComponent(value)}`,
    );
    if (!data.ok) throw new Error(t("common.save_error"));
    startReconnectLoop();
  } catch (error) {
    setState({
      overlay: "",
      error: error.message || t("common.save_error"),
    });
    throw error;
  }
}

async function handleThermalClear() {
  try {
    const data = await apiJson("/api/thermal/clear", { method: "POST" });
    if (!data.ok) throw new Error(t("common.action_error"));
    await loadAll({ silent: true });
  } catch (error) {
    state.error = error.message || t("common.action_error");
    rerender();
  }
}

async function copyLogs() {
  const text = state.logs || "";
  if (!text) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    state.copyLabelKey = "common.copied";
    rerender();
    window.setTimeout(() => {
      state.copyLabelKey = "common.copy_logs";
      rerender();
    }, 1500);
  } catch (_error) {}
}

function handleLanguageChange(event) {
  const next = event.target.value;
  i18n.setLang(next);
  state.lang = i18n.getLang();
  document.documentElement.lang = state.lang;
  if (state.error) state.error = t("common.refresh_error");
  if (state.info) state.info = "";
  rerender();
}

function profileLabel(bufferSize) {
  const value = Number(bufferSize) || 0;
  if (value <= 256) return t("audio.profile_ultra");
  if (value <= 512) return t("audio.profile_balanced");
  if (value <= 1024) return t("audio.profile_stable");
  return t("audio.profile_high");
}

function boolPill(value, yesLabel, noLabel) {
  return renderPill(value ? yesLabel : noLabel, value ? "ok" : "bad");
}

function renderPill(label, tone = "neutral") {
  return html`<span class=${`status-pill ${tone}`}>${label}</span>`;
}

function formatNumber(value, digits = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : t("common.na");
}

function formatTemperature(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)} °C`
    : t("common.na");
}

function formatLevel(audio) {
  if (!audio) return t("common.loading");

  const pct = typeof audio.peak_pct === "number" ? audio.peak_pct : 0;
  const db = typeof audio.peak_dbfs === "number" ? audio.peak_dbfs : -90;
  const clips = typeof audio.clip_count === "number" ? audio.clip_count : 0;
  const base = audio.clip
    ? t("audio.level_bad")
    : pct >= 90
      ? t("audio.level_warn")
      : t("audio.level_ok");

  const detailKey = audio.clip ? "audio.level_value_clips" : "audio.level_value";
  const detail = t(detailKey, {
    pct: pct.toFixed(0),
    db: db.toFixed(1),
    clips: String(clips),
  });

  const tone = audio.clip ? "bad" : pct >= 90 ? "warn" : "ok";
  return html`
    <div>
      ${renderPill(base, tone)}
      <div class="meta-note">${detail}</div>
    </div>
  `;
}

function formatThermalStatus(thermal) {
  if (!thermal) return renderPill(t("common.loading"), "neutral");
  if (thermal.sensor_fault) return renderPill(t("thermal.status_sensor_fault"), "warn");
  if (thermal.latched_persist) return renderPill(t("thermal.status_latched_persist"), "warn");
  if (!thermal.protection_enabled) return renderPill(t("thermal.status_disabled"), "bad");
  if (thermal.manual_restart || thermal.latched) {
    return renderPill(t("thermal.status_latched"), "warn");
  }
  return renderPill(t("thermal.status_ready"), "ok");
}

function formatThermalLast(thermal) {
  if (!thermal) return t("common.loading");
  if (thermal.sensor_fault) return t("thermal.last_sensor_fault");
  if (thermal.last_trip_ts) {
    return t("thermal.last_fmt", {
      temp:
        typeof thermal.last_trip_c === "number" && Number.isFinite(thermal.last_trip_c)
          ? thermal.last_trip_c.toFixed(1)
          : "0.0",
      limit: String(Math.round(Number(thermal.shutdown_c) || 0)),
      time: thermal.last_trip_ts || t("common.unknown"),
      ago: thermal.last_trip_since || t("common.unknown"),
    });
  }
  if (thermal.last_reason) return thermal.last_reason;
  return t("thermal.last_none");
}

function summaryTiles() {
  const status = state.status;
  const thermal = state.thermal;
  return [
    {
      label: t("app.summary.server"),
      value: status
        ? status.rtsp_server_enabled
          ? t("status.server_enabled")
          : t("status.server_disabled")
        : t("common.loading"),
    },
    {
      label: t("app.summary.streaming"),
      value: status
        ? status.streaming
          ? t("status.streaming_yes")
          : t("status.streaming_no")
        : t("common.loading"),
    },
    {
      label: t("app.summary.packet_rate"),
      value: status ? `${status.current_rate_pkt_s} pkt/s` : t("common.loading"),
    },
    {
      label: t("app.summary.temperature"),
      value:
        thermal && thermal.current_valid
          ? formatTemperature(thermal.current_c)
          : t("common.na"),
    },
  ];
}

function renderStatusRows() {
  const status = state.status;
  return [
    [t("status.ip"), status?.ip || t("common.loading")],
    [t("status.wifi_rssi"), status ? `${status.wifi_rssi} dBm` : t("common.loading")],
    [
      t("status.wifi_tx"),
      status ? `${formatNumber(status.wifi_tx_dbm, 1)} dBm` : t("common.loading"),
    ],
    [
      t("status.heap"),
      status
        ? `${status.free_heap_kb} KB (${status.min_free_heap_kb} KB)`
        : t("common.loading"),
    ],
    [t("status.uptime"), status?.uptime || t("common.loading")],
    [
      t("status.rtsp_server"),
      status
        ? boolPill(
            status.rtsp_server_enabled,
            t("status.server_enabled"),
            t("status.server_disabled"),
          )
        : renderPill(t("common.loading"), "neutral"),
    ],
    [t("status.client"), status?.client || t("common.waiting")],
    [
      t("status.streaming"),
      status
        ? boolPill(
            status.streaming,
            t("status.streaming_yes"),
            t("status.streaming_no"),
          )
        : renderPill(t("common.loading"), "neutral"),
    ],
    [
      t("status.packet_rate"),
      status ? `${status.current_rate_pkt_s} pkt/s` : t("common.loading"),
    ],
    [t("status.last_connect"), status?.last_rtsp_connect || t("common.waiting")],
    [t("status.last_play"), status?.last_stream_start || t("common.waiting")],
  ];
}

function DataTable({ rows }) {
  return html`
    <table class="data-table">
      <tbody>
        ${rows.map(
          ([label, value]) => html`
            <tr>
              <th>${label}</th>
              <td>${value}</td>
            </tr>
          `,
        )}
      </tbody>
    </table>
  `;
}

function SettingRow({ label, helpKey, controls, note, className = "" }) {
  return html`
    <div class=${`setting-row ${className}`.trim()}>
      <div class="setting-head">
        <div class="setting-copy">
          <span class="setting-label">${label}</span>
          ${helpKey ? html`<p class="setting-help">${t(helpKey)}</p>` : null}
          ${note ? html`<div class="meta-note">${note}</div>` : null}
        </div>
        <div class="setting-controls">${controls}</div>
      </div>
    </div>
  `;
}

function useLocalSettingValue(currentValue) {
  const normalizedCurrent = String(currentValue ?? "");
  const [localValue, setLocalValue] = useState(normalizedCurrent);
  const previousCurrentRef = useRef(normalizedCurrent);

  useEffect(() => {
    if (localValue === previousCurrentRef.current) {
      setLocalValue(normalizedCurrent);
    }
    previousCurrentRef.current = normalizedCurrent;
  }, [normalizedCurrent, localValue]);

  return [localValue, setLocalValue, localValue !== normalizedCurrent];
}

function PendingSetButton({ disabled, label }) {
  return html`
    <button class="button button-outline button-pending" disabled=${disabled}>
      ${label}
    </button>
  `;
}

function TextSettingControl({
  fieldKey,
  currentValue,
  type = "text",
  min,
  max,
  step,
  maxLength,
  unit,
  saveLabel,
  placeholder = "",
  disabled = false,
  onSave = saveSetting,
}) {
  const [value, setValue, changed] = useLocalSettingValue(currentValue);
  const [saving, setSaving] = useState(false);
  const inputDisabled = disabled || saving;
  const invalid = !disabled && !isFieldValid(fieldKey, value);

  async function onSubmit(event) {
    event.preventDefault();
    if (inputDisabled || invalid || !changed) return;
    setSaving(true);
    try {
      await onSave(fieldKey, value);
    } catch (_error) {
      // Global error banner is already updated by the save helper.
    } finally {
      setSaving(false);
    }
  }

  return html`
    <form class="field-inline" onSubmit=${onSubmit}>
      <input
        class=${invalid ? "invalid-input" : ""}
        type=${type}
        value=${value}
        min=${min}
        max=${max}
        step=${step}
        maxlength=${maxLength}
        placeholder=${placeholder}
        disabled=${inputDisabled}
        aria-invalid=${invalid ? "true" : "false"}
        onInput=${(event) => setValue(event.currentTarget.value)}
        onKeyDown=${(event) => {
          if (event.key === "Enter") {
            onSubmit(event);
          }
        }}
      />
      ${unit ? html`<span class="field-unit">${unit}</span>` : null}
      <${PendingSetButton}
        disabled=${inputDisabled || invalid || !changed}
        label=${saveLabel}
      />
    </form>
  `;
}

function SelectSettingControl({
  fieldKey,
  currentValue,
  options,
  saveLabel,
  formatOption,
  onSave = saveSetting,
}) {
  const [value, setValue, changed] = useLocalSettingValue(currentValue);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (saving || !changed) return;
    setSaving(true);
    try {
      await onSave(fieldKey, value);
    } catch (_error) {
      // Global error banner is already updated by the save helper.
    } finally {
      setSaving(false);
    }
  }

  return html`
    <form class="field-inline" onSubmit=${onSubmit}>
      <select
        value=${value}
        disabled=${saving}
        onChange=${(event) => setValue(event.currentTarget.value)}
      >
        ${options.map((option) => {
          const optionValue = String(option);
          return html`
            <option value=${optionValue}>
              ${formatOption ? formatOption(option) : optionValue}
            </option>
          `;
        })}
      </select>
      <${PendingSetButton}
        disabled=${saving || !changed}
        label=${saveLabel}
      />
    </form>
  `;
}

function CheckboxSettingControl({
  fieldKey,
  currentValue,
  saveLabel,
  onSave = saveSetting,
}) {
  const [value, setValue, changed] = useLocalSettingValue(currentValue);
  const [saving, setSaving] = useState(false);
  const checked = isBinaryOn(value);

  async function onSubmit(event) {
    event.preventDefault();
    if (saving || !changed) return;
    setSaving(true);
    try {
      await onSave(fieldKey, checked ? "on" : "off");
    } catch (_error) {
      // Global error banner is already updated by the save helper.
    } finally {
      setSaving(false);
    }
  }

  return html`
    <form class="field-inline checkbox-inline" onSubmit=${onSubmit}>
      <label class="checkbox-control">
        <input
          type="checkbox"
          checked=${checked}
          disabled=${saving}
          onChange=${(event) =>
            setValue(event.currentTarget.checked ? "on" : "off")}
        />
        <span class="checkbox-label">
          ${checked ? t("binary.enabled") : t("binary.disabled")}
        </span>
      </label>
      <${PendingSetButton}
        disabled=${saving || !changed}
        label=${saveLabel}
      />
    </form>
  `;
}

function HighPassSettingControl({ enabledValue, cutoffValue }) {
  const [enabled, setEnabled, enabledChanged] = useLocalSettingValue(enabledValue);
  const [cutoff, setCutoff, cutoffChanged] = useLocalSettingValue(cutoffValue);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [savingCutoff, setSavingCutoff] = useState(false);
  const highpassEnabled = isBinaryOn(enabled);
  const invalidCutoff = highpassEnabled && !isFieldValid("hp_cutoff", cutoff);

  async function submitEnabled(event) {
    event.preventDefault();
    if (savingEnabled || !enabledChanged) return;
    setSavingEnabled(true);
    try {
      await saveSetting("hp_enable", highpassEnabled ? "on" : "off");
    } catch (_error) {
      // Global error banner is already updated by the save helper.
    } finally {
      setSavingEnabled(false);
    }
  }

  async function submitCutoff(event) {
    event.preventDefault();
    if (savingCutoff || !cutoffChanged || invalidCutoff || !highpassEnabled) return;
    setSavingCutoff(true);
    try {
      await saveSetting("hp_cutoff", cutoff);
    } catch (_error) {
      // Global error banner is already updated by the save helper.
    } finally {
      setSavingCutoff(false);
    }
  }

  return html`
    <div class="control-stack">
      <form class="field-inline checkbox-inline" onSubmit=${submitEnabled}>
        <label class="checkbox-control">
          <input
            type="checkbox"
            checked=${highpassEnabled}
            disabled=${savingEnabled}
            onChange=${(event) =>
              setEnabled(event.currentTarget.checked ? "on" : "off")}
          />
          <span class="checkbox-label">
            ${highpassEnabled ? t("binary.enabled") : t("binary.disabled")}
          </span>
        </label>
        <${PendingSetButton}
          disabled=${savingEnabled || !enabledChanged}
          label=${t("common.set")}
        />
      </form>

      <div class=${`linked-controls ${highpassEnabled ? "" : "linked-controls-disabled"}`.trim()}>
        <span class="field-subtitle">${t("audio.highpass_cutoff")}</span>
        <p class="setting-help">${t("audio.help.highpass_cutoff")}</p>
        <form class="field-inline" onSubmit=${submitCutoff}>
          <input
            class=${invalidCutoff ? "invalid-input" : ""}
            type="number"
            min="10"
            max="10000"
            step="10"
            value=${cutoff}
            disabled=${savingCutoff || !highpassEnabled}
            aria-invalid=${invalidCutoff ? "true" : "false"}
            onInput=${(event) => setCutoff(event.currentTarget.value)}
          />
          <span class="field-unit">Hz</span>
          <${PendingSetButton}
            disabled=${savingCutoff || invalidCutoff || !highpassEnabled || !cutoffChanged}
            label=${t("common.set")}
          />
        </form>
      </div>
    </div>
  `;
}

function GainSettingControl({ gainValue, agcValue, agcInfo }) {
  const currentMode = agcValue === "on" ? "auto" : "manual";
  const [mode, setMode, modeChanged] = useLocalSettingValue(currentMode);
  const [gain, setGain, gainChanged] = useLocalSettingValue(gainValue);
  const [saving, setSaving] = useState(false);
  const invalidGain = !isFieldValid("gain", gain);
  const changed = modeChanged || gainChanged;

  async function onSubmit(event) {
    event.preventDefault();
    if (saving || invalidGain || !changed) return;
    setSaving(true);
    try {
      if (modeChanged) {
        await saveSetting("agc_enable", mode === "auto" ? "on" : "off");
      }
      if (gainChanged) {
        await saveSetting("gain", gain);
      }
    } catch (_error) {
      // Global error banner is already updated by the save helper.
    } finally {
      setSaving(false);
    }
  }

  return html`
    <form class="control-stack" onSubmit=${onSubmit}>
      <div class="mode-toggle" role="radiogroup" aria-label=${t("audio.gain")}>
        <label class=${`mode-option ${mode === "manual" ? "active" : ""}`.trim()}>
          <input
            type="radio"
            name="gain_mode"
            checked=${mode === "manual"}
            disabled=${saving}
            onChange=${() => setMode("manual")}
          />
          <span>${t("common.manual")}</span>
        </label>
        <label class=${`mode-option ${mode === "auto" ? "active" : ""}`.trim()}>
          <input
            type="radio"
            name="gain_mode"
            checked=${mode === "auto"}
            disabled=${saving}
            onChange=${() => setMode("auto")}
          />
          <span>${t("common.auto")}</span>
        </label>
      </div>
      <div class="field-inline">
        <input
          class=${invalidGain ? "invalid-input" : ""}
          type="number"
          min="0.1"
          max="100"
          step="0.1"
          value=${gain}
          disabled=${saving}
          aria-invalid=${invalidGain ? "true" : "false"}
          onInput=${(event) => setGain(event.currentTarget.value)}
        />
        <span class="field-unit">×</span>
        <${PendingSetButton}
          disabled=${saving || invalidGain || !changed}
          label=${t("common.set")}
        />
      </div>
      <div class="meta-note">
        ${agcInfo || t("audio.gain_mode_note")}
      </div>
    </form>
  `;
}

function HeroCard() {
  const status = state.status;
  const rtspUrl = status?.mdns_hostname
    ? `rtsp://${status.mdns_hostname}.local:8554/audio`
    : t("common.loading");

  return html`
    <section class="card hero-card">
      <div class="hero-top">
        <div>
          <div class="eyebrow">M5Stack Atom Echo</div>
          <h1 class="hero-title">${t("app.title")}</h1>
          <p class="card-intro">${t("app.subtitle")}</p>
          <div class="hero-meta">
            <span class="firmware-badge">
              ${status?.fw_version ? `Version ${status.fw_version}` : t("common.loading")}
            </span>
          </div>
          <div class="hero-url">
            <span class="hero-url-label">${t("app.rtsp_url")}</span>
            <span class="hero-url-value mono">${rtspUrl}</span>
          </div>
        </div>

        <div class="hero-side">
          <a
            class="button button-outline hero-link"
            href="https://github.com/stedrow/birdnetgo-m5stack-atom-echo-rtsp-mic"
            target="_blank"
            rel="noreferrer"
          >
            ${t("app.repository")}
          </a>

          <label>
            ${t("app.language")}
            <select value=${state.lang} onChange=${handleLanguageChange}>
              ${LANGUAGE_OPTIONS.map(
                (option) => html`
                  <option value=${option.value}>${option.label}</option>
                `,
              )}
            </select>
          </label>
        </div>
      </div>

      <div class="summary-grid">
        ${summaryTiles().map(
          (tile) => html`
            <div class="summary-tile">
              <span class="summary-label">${tile.label}</span>
              <span class="summary-value">${tile.value}</span>
            </div>
          `,
        )}
      </div>

      <div class="action-bar">
        <button
          disabled=${!!status?.rtsp_server_enabled}
          onClick=${() => runAction("server_start")}
        >
          ${t("action.server_start")}
        </button>
        <button
          class="button button-outline"
          disabled=${status ? !status.rtsp_server_enabled : true}
          onClick=${() => runAction("server_stop")}
        >
          ${t("action.server_stop")}
        </button>
        <button class="button button-outline" onClick=${() => runAction("reset_i2s")}>
          ${t("action.reset_i2s")}
        </button>
        <button class="button subtle" onClick=${handleReboot}>${t("action.reboot")}</button>
        <button class="button button-warn" onClick=${handleDefaults}>
          ${t("action.defaults")}
        </button>
        <button class="button subtle" onClick=${handleWifiSetup}>
          ${t("action.wifi_setup")}
        </button>
      </div>

      <div class="hero-status">
        <h2>${t("section.status")}</h2>
        <p class="card-intro">${t("status.overview")}</p>
        <${DataTable} rows=${renderStatusRows()} />
      </div>
    </section>
  `;
}

function AudioCard() {
  const audio = state.audio;
  const currentRate = audio?.sample_rate ?? "";
  const currentGain =
    typeof audio?.gain === "number" ? audio.gain.toFixed(2) : "";
  const currentDcBlocker = audio?.dc_blocker_enable ? "on" : "off";
  const currentHpEnable = audio?.hp_enable ? "on" : "off";
  const currentHpCutoff = audio?.hp_cutoff_hz ?? "";
  const currentAgc = audio?.agc_enable ? "on" : "off";
  const currentLed = audio?.led_mode ?? 0;
  const currentBuffer = audio?.buffer_size ?? 9600;

  const agcInfo =
    audio?.agc_enable && typeof audio?.agc_multiplier === "number"
      ? t("audio.agc_info", {
          multiplier: audio.agc_multiplier.toFixed(1),
          effective: Number(audio.effective_gain || 0).toFixed(1),
        })
      : "";

  return html`
    <section class="card">
      <h2>${t("section.audio")}</h2>
      <div class="setting-list">
        <${SettingRow}
          label=${t("audio.sample_rate")}
          helpKey="audio.help.sample_rate"
          controls=${html`
            <${SelectSettingControl}
              fieldKey="rate"
              currentValue=${currentRate}
              options=${SAMPLE_RATE_OPTIONS}
              formatOption=${(value) => `${Math.round(value / 1000)} kHz`}
              saveLabel=${t("common.set")}
            />
          `}
        />
        <${SettingRow}
          label=${t("audio.gain")}
          helpKey="audio.help.gain"
          controls=${html`
            <${GainSettingControl}
              gainValue=${currentGain}
              agcValue=${currentAgc}
              agcInfo=${agcInfo}
            />
          `}
        />
        <${SettingRow}
          label=${t("audio.dc_blocker")}
          helpKey="audio.help.dc_blocker"
          controls=${html`
            <${CheckboxSettingControl}
              fieldKey="dc_blocker"
              currentValue=${currentDcBlocker}
              saveLabel=${t("common.set")}
            />
          `}
        />
        <${SettingRow}
          label=${t("audio.highpass")}
          helpKey="audio.help.highpass"
          note=${t("audio.hpf_group_note")}
          className="linked-setting"
          controls=${html`
            <${HighPassSettingControl}
              enabledValue=${currentHpEnable}
              cutoffValue=${currentHpCutoff}
            />
          `}
        />
        <${SettingRow}
          label=${t("audio.led_mode")}
          helpKey="audio.help.led_mode"
          controls=${html`
            <${SelectSettingControl}
              fieldKey="led_mode"
              currentValue=${currentLed}
              options=${[0, 1, 2]}
              formatOption=${(value) => {
                if (Number(value) === 0) return t("audio.led_off");
                if (Number(value) === 1) return t("audio.led_static");
                return t("audio.led_level");
              }}
              saveLabel=${t("common.set")}
            />
          `}
        />
        <${SettingRow}
          label=${t("audio.buffer_size")}
          helpKey="audio.help.buffer_size"
          controls=${html`
            <${SelectSettingControl}
              fieldKey="buffer"
              currentValue=${currentBuffer}
              options=${BUFFER_OPTIONS}
              formatOption=${(value) => `${value} samples`}
              saveLabel=${t("common.set")}
            />
          `}
        />
      </div>

      <div class="page-grid" style="margin-top: 1.6rem;">
        <div class="summary-tile">
          <span class="summary-label">${t("audio.latency")}</span>
          <span class="summary-value">
            ${audio ? `${formatNumber(audio.latency_ms, 1)} ms` : t("common.loading")}
          </span>
        </div>
        <div class="summary-tile">
          <span class="summary-label">${t("audio.profile")}</span>
          <span class="summary-value">
            ${audio ? profileLabel(audio.buffer_size) : t("common.loading")}
          </span>
        </div>
        <div class="summary-tile">
          <span class="summary-label">${t("audio.signal_level")}</span>
          <div class="summary-value" style="font-size: 1.6rem;">
            ${formatLevel(audio)}
          </div>
        </div>
      </div>
    </section>
  `;
}

function ReliabilityCard() {
  const perf = state.perf;
  const autoRecovery = perf?.auto_recovery ? "on" : "off";
  const thresholdMode = perf?.auto_threshold ? "auto" : "manual";
  const restartThreshold = perf?.restart_threshold_pkt_s ?? "";
  const scheduledReset = perf?.scheduled_reset ? "on" : "off";
  const resetHours = perf?.reset_hours ?? "";

  return html`
    <section class="card">
      <h2>${t("section.reliability")}</h2>
      <div class="setting-list">
        <${SettingRow}
          label=${t("reliability.auto_recovery")}
          helpKey="reliability.help.auto_recovery"
          controls=${html`
            <${CheckboxSettingControl}
              fieldKey="auto_recovery"
              currentValue=${autoRecovery}
              saveLabel=${t("common.set")}
            />
          `}
        />
        <${SettingRow}
          label=${t("reliability.threshold_mode")}
          helpKey="reliability.help.threshold_mode"
          note=${perf
            ? t("reliability.recommended_threshold", {
                value: String(perf.recommended_min_rate),
              })
            : ""}
          controls=${html`
            <${SelectSettingControl}
              fieldKey="thr_mode"
              currentValue=${thresholdMode}
              options=${["auto", "manual"]}
              formatOption=${(value) =>
                value === "auto" ? t("common.auto") : t("common.manual")}
              saveLabel=${t("common.set")}
            />
          `}
        />
        ${perf?.auto_threshold
          ? null
          : html`
              <${SettingRow}
                label=${t("reliability.restart_threshold")}
                helpKey="reliability.help.restart_threshold"
                controls=${html`
                  <${TextSettingControl}
                    fieldKey="min_rate"
                    currentValue=${restartThreshold}
                    type="number"
                    min="5"
                    max="200"
                    step="1"
                    unit="pkt/s"
                    saveLabel=${t("common.set")}
                  />
                `}
              />
            `}
        <${SettingRow}
          label=${t("reliability.scheduled_reset")}
          helpKey="reliability.help.scheduled_reset"
          controls=${html`
            <${CheckboxSettingControl}
              fieldKey="sched_reset"
              currentValue=${scheduledReset}
              saveLabel=${t("common.set")}
            />
          `}
        />
        <${SettingRow}
          label=${t("reliability.reset_hours")}
          helpKey="reliability.help.reset_hours"
          controls=${html`
            <${TextSettingControl}
              fieldKey="reset_hours"
              currentValue=${resetHours}
              type="number"
              min="1"
              max="168"
              step="1"
              unit="h"
              saveLabel=${t("common.set")}
            />
          `}
        />
      </div>
    </section>
  `;
}

function ThermalCard() {
  const thermal = state.thermal;
  const enableValue = thermal?.protection_enabled ? "on" : "off";
  const limitValue = thermal?.shutdown_c ?? 80;
  const showLatch = !!thermal?.latched_persist;

  return html`
    <section class="card">
      <h2>${t("section.thermal")}</h2>
      <div class="setting-list">
        <${SettingRow}
          label=${t("thermal.overheat_protection")}
          helpKey="thermal.help.overheat_protection"
          controls=${html`
            <${CheckboxSettingControl}
              fieldKey="oh_enable"
              currentValue=${enableValue}
              saveLabel=${t("common.set")}
            />
          `}
        />
        <${SettingRow}
          label=${t("thermal.shutdown_limit")}
          helpKey="thermal.help.shutdown_limit"
          controls=${html`
            <${SelectSettingControl}
              fieldKey="oh_limit"
              currentValue=${limitValue}
              options=${THERMAL_LIMIT_OPTIONS}
              formatOption=${(value) => `${value} °C`}
              saveLabel=${t("common.set")}
            />
          `}
        />
      </div>

      <div style="margin-top: 1.6rem;">
        <${DataTable}
          rows=${[
            [t("thermal.status"), formatThermalStatus(thermal)],
            [
              t("thermal.current"),
              thermal?.current_valid ? formatTemperature(thermal.current_c) : t("common.na"),
            ],
            [t("thermal.peak"), formatTemperature(thermal?.max_c)],
            [
              t("thermal.cpu"),
              thermal ? `${thermal.cpu_mhz} MHz` : t("common.loading"),
            ],
            [t("thermal.last"), formatThermalLast(thermal)],
          ]}
        />
      </div>

      ${showLatch
        ? html`
            <div class="banner error" style="margin-top: 1.6rem;">
              <p>${t("thermal.latch_notice")}</p>
              <button class="button button-danger" onClick=${handleThermalClear}>
                ${t("thermal.clear_latch")}
              </button>
            </div>
          `
        : null}
    </section>
  `;
}

function AdvancedCard() {
  const perf = state.perf;
  const status = state.status;
  const thermal = state.thermal;
  const checkInterval = perf?.check_interval_min ?? "";
  const wifiTx = status?.wifi_tx_dbm ?? -1.0;
  const hostname = status?.mdns_hostname ?? "";
  const cpuFreq = thermal?.cpu_mhz ?? 120;

  return html`
    <section class="card">
      <h2>${t("section.advanced")}</h2>
      <div class="setting-list">
        <${SettingRow}
          label=${t("advanced.i2s_shift")}
          controls=${html`<div class="small-note">${t("advanced.i2s_shift_value")}</div>`}
        />
        <${SettingRow}
          label=${t("advanced.check_interval")}
          helpKey="advanced.help.check_interval"
          controls=${html`
            <${TextSettingControl}
              fieldKey="check_interval"
              currentValue=${checkInterval}
              type="number"
              min="1"
              max="60"
              step="1"
              unit="min"
              saveLabel=${t("common.set")}
            />
          `}
        />
        <${SettingRow}
          label=${t("advanced.wifi_tx_power")}
          helpKey="advanced.help.wifi_tx_power"
          controls=${html`
            <${SelectSettingControl}
              fieldKey="wifi_tx"
              currentValue=${Number(wifiTx).toFixed(1)}
              options=${WIFI_TX_OPTIONS.map((value) => value.toFixed(1))}
              formatOption=${(value) => `${value} dBm`}
              saveLabel=${t("common.set")}
            />
          `}
        />
        <${SettingRow}
          label=${t("advanced.hostname")}
          helpKey="advanced.help.hostname"
          controls=${html`
            <${TextSettingControl}
              fieldKey="hostname"
              currentValue=${hostname}
              type="text"
              maxLength="63"
              unit=".local"
              onSave=${handleHostnameSave}
              saveLabel=${t("common.set_reboot")}
            />
          `}
        />
        <${SettingRow}
          label=${t("advanced.cpu_frequency")}
          helpKey="advanced.help.cpu_frequency"
          controls=${html`
            <${SelectSettingControl}
              fieldKey="cpu_freq"
              currentValue=${cpuFreq}
              options=${CPU_OPTIONS}
              formatOption=${(value) => `${value} MHz`}
              saveLabel=${t("common.set")}
            />
          `}
        />
      </div>
    </section>
  `;
}

function LogsCard() {
  return html`
    <section class="card">
      <h2>${t("section.logs")}</h2>
      <p class="card-intro">${t("logs.help")}</p>
      <div class="logs-panel">
        <div class="logs-actions">
          <span class="small-note mono">/api/logs</span>
          <button class="button button-outline" onClick=${copyLogs}>
            ${t(state.copyLabelKey)}
          </button>
        </div>
        <pre class="logs-frame mono">${state.logs || ""}</pre>
      </div>
    </section>
  `;
}

function App() {
  return html`
    <main class="app-shell">
      <${HeroCard} />
      ${state.error ? html`<div class="banner error">${state.error}</div>` : null}
      ${state.info ? html`<div class="banner info">${state.info}</div>` : null}

      <div class="page-grid">
        <${AudioCard} />
        <${ReliabilityCard} />
        <${ThermalCard} />
        <${AdvancedCard} />
        <${LogsCard} />
      </div>
    </main>

    ${state.overlay
      ? html`
          <div class="overlay">
            <div class="card overlay-card">
              <h2>${t("action.reboot")}</h2>
              <p>${state.overlay}</p>
            </div>
          </div>
        `
      : null}
  `;
}

async function init() {
  rerender();
  await loadAll();
  pollTimer = window.setInterval(() => {
    loadAll({ silent: true }).catch(() => {
      state.error = t("common.connection_error");
      rerender();
    });
  }, 3000);
}

init();
