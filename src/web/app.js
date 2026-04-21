      const T = {
        en: {
          title: "ESP32 RTSP Mic for BirdNET-Go",
          status: "Status",
          ip: "IP Address",
          wifi_rssi: "WiFi RSSI",
          wifi_tx: "WiFi TX Power",
          heap: "Free Heap (min)",
          uptime: "Uptime",
          rtsp_server: "RTSP Server",
          client: "Client",
          streaming: "Streaming",
          pkt_rate: "Packet Rate",
          last_connect: "Last RTSP Connect",
          last_play: "Last Stream Start",
          audio: "Audio",
          rate: "Sample Rate",
          gain: "Gain",
          buf: "Buffer Size",
          latency: "Latency",
          profile: "Profile",
          perf: "Reliability",
          auto: "Auto Recovery",
          wifi: "WiFi",
          wifi_tx2: "TX Power (dBm)",
          thermal: "Thermal",
          logs: "Logs",
          bsrvon: "Server ON",
          bsrvoff: "Server OFF",
          breset: "Reset I2S",
          breboot: "Reboot",
          bdefaults: "Defaults",
          confirm_reboot: "Restart device now?",
          confirm_reset: "Reset to defaults and reboot?",
          restarting: "Restarting device…",
          resetting: "Restoring defaults and rebooting…",
          advanced_settings: "Advanced Settings",
          shift: "I2S Shift",
          thr: "Restart Threshold",
          chk: "Check Interval",
          thr_mode: "Threshold Mode",
          auto_m: "Auto",
          manual_m: "Manual",
          sched: "Scheduled Reset",
          hours: "Reset After",
          cpu: "CPU Frequency",
          set: "Set",
          profile_ultra: "Ultra-Low Latency (Higher CPU, May have dropouts)",
          profile_balanced: "Balanced (Moderate CPU, Good stability)",
          profile_stable: "Stable Streaming (Lower CPU, Excellent stability)",
          profile_high: "High Stability (Lowest CPU, Maximum stability)",
          help_rate: "Higher sample-rate = more detail, more bandwidth.",
          help_gain: "Amplifies audio after I²S shift; too high clips.",
          help_buf: "More samples per packet = higher latency, more stability.",
          help_auto: "Auto-restarts the pipeline when packet-rate collapses.",
          help_tx: "Wi-Fi TX power; lowering can reduce RF noise.",
          help_shift: "Digital right shift applied before scaling.",
          help_thr: "Minimum packet-rate before auto-recovery triggers.",
          help_chk: "How often performance is checked.",
          help_sched: "Periodic device restart for stability.",
          help_hours: "Interval between scheduled restarts.",
          help_cpu: "Lower MHz = cooler, higher latency possible.",
          therm_protect: "Overheat Protection",
          therm_limit: "Shutdown Limit",
          therm_status: "Status",
          therm_now: "Current Temp",
          therm_max: "Peak Temp",
          therm_cpu: "CPU Clock",
          therm_last: "Last Shutdown",
          therm_status_ready: "Protection ready",
          therm_status_disabled: "Protection disabled",
          therm_status_latched: "Cooling required - restart manually",
          therm_status_sensor_fault: "Sensor unavailable - protection paused",
          therm_status_latched_persist:
            "Protection latched — acknowledge to re-enable",
          therm_hint:
            "80 °C suits most ESP32 boards; drop to 70-75 °C for sealed enclosures.",
          therm_last_none: "No shutdown recorded yet.",
          therm_last_fmt:
            "Stopped at %TEMP% °C (limit %LIMIT% °C) after %TIME% uptime (%AGO%).",
          therm_last_sensor_fault:
            "Thermal protection disabled: temperature sensor unavailable.",
          therm_latch_notice:
            "Thermal shutdown latched the RTSP server. Confirm only after hardware cools down.",
          therm_clear_btn: "Acknowledge & re-enable RTSP",
          therm_time_unknown: "unknown time",
          therm_time_ago_unknown: "just now",
          help_therm_protect:
            "Automatically stops streaming when the ESP32 exceeds the limit to protect the board and microphone preamp.",
          help_therm_limit:
            "Temperature threshold for thermal shutdown. 80 °C is a safe default; use 70-75 °C if airflow is poor.",
        },
        cs: {
          title: "ESP32 RTSP Mic pro BirdNET-Go",
          status: "Stav",
          ip: "IP adresa",
          wifi_rssi: "WiFi RSSI",
          wifi_tx: "WiFi výkon",
          heap: "Volná RAM (min)",
          uptime: "Doba běhu",
          rtsp_server: "RTSP server",
          client: "Klient",
          streaming: "Streamování",
          pkt_rate: "Rychlost paketů",
          last_connect: "Poslední RTSP připojení",
          last_play: "Poslední start streamu",
          audio: "Audio",
          rate: "Vzorkovací frekvence",
          gain: "Zisk",
          buf: "Velikost bufferu",
          latency: "Latence",
          profile: "Profil",
          perf: "Spolehlivost",
          auto: "Automatická obnova",
          wifi: "WiFi",
          wifi_tx2: "TX výkon (dBm)",
          thermal: "Teplota",
          logs: "Logy",
          bsrvon: "Server ZAP",
          bsrvoff: "Server VYP",
          breset: "Reset I2S",
          breboot: "Restart",
          bdefaults: "Výchozí",
          confirm_reboot: "Restartovat zařízení nyní?",
          confirm_reset: "Obnovit výchozí nastavení a restartovat?",
          restarting: "Zařízení se restartuje…",
          resetting: "Obnovuji výchozí nastavení a restartuji…",
          advanced_settings: "Pokročilá nastavení",
          shift: "I2S posun",
          thr: "Prahová hodnota restartu",
          chk: "Interval kontroly",
          thr_mode: "Režim prahu",
          auto_m: "Automaticky",
          manual_m: "Manuálně",
          sched: "Plánovaný restart",
          hours: "Po kolika hodinách",
          cpu: "Frekvence CPU",
          set: "Nastavit",
          profile_ultra: "Ultra nízká latence (vyšší zátěž CPU, možné výpadky)",
          profile_balanced: "Vyvážené (střední zátěž CPU, dobrá stabilita)",
          profile_stable:
            "Stabilní stream (nižší zátěž CPU, výborná stabilita)",
          profile_high: "Vysoká stabilita (nejnižší zátěž CPU, max. stabilita)",
          help_rate: "Vyšší frekvence = více detailů, větší datový tok.",
          help_gain: "Zesílení po I²S posunu; příliš vysoké klipuje.",
          help_buf: "Více vzorků v paketu = vyšší latence, větší stabilita.",
          help_auto: "Při poklesu rychlosti paketů dojde k obnově.",
          help_tx: "Výkon vysílače Wi-Fi; snížení může zlepšit šum.",
          help_shift: "Digitální bitový posun před škálováním.",
          help_thr: "Minimální rychlost paketů pro spuštění obnovy.",
          help_chk: "Jak často se provádí kontrola výkonu.",
          help_sched: "Pravidelný restart zařízení kvůli stabilitě.",
          help_hours: "Interval mezi plánovanými restarty.",
          help_cpu: "Nižší MHz = chladnější, může přidat latenci.",
          therm_protect: "Ochrana proti přehřátí",
          therm_limit: "Vypínací teplota",
          therm_status: "Stav",
          therm_now: "Aktuální teplota",
          therm_max: "Maximální teplota",
          therm_cpu: "Takt CPU",
          therm_last: "Poslední zásah",
          therm_status_ready: "Ochrana připravena",
          therm_status_disabled: "Ochrana vypnuta",
          therm_status_latched: "Přehřátí - nejprve vychlaďte a spusťte ručně",
          therm_status_sensor_fault:
            "Senzor teploty nedostupný - ochrana pozastavena",
          therm_status_latched_persist:
            "Ochrana zůstává blokovaná - potvrďte znovuspuštění",
          therm_hint:
            "80 °C je bezpečné pro většinu ESP32; v uzavřených krabičkách volte 70-75 °C.",
          therm_last_none: "Zatím žádné přehřátí.",
          therm_last_fmt:
            "Stream vypnut při %TEMP% °C (limit %LIMIT% °C) po %TIME% běhu (%AGO%).",
          therm_last_sensor_fault:
            "Tepelná ochrana vypnuta: teplota není k dispozici.",
          therm_latch_notice:
            "Tepelná ochrana odstavila RTSP server. Zapínejte až po vychladnutí.",
          therm_clear_btn: "Potvrdit a znovu povolit RTSP",
          therm_time_unknown: "neznámý čas",
          therm_time_ago_unknown: "právě teď",
          help_therm_protect:
            "Při překročení limitu zastaví stream, aby chránila desku a předzesilovač.",
          help_therm_limit:
            "Teplota, při které se stream vypne. 80 °C vyhoví odkrytým deskám; v teplém prostředí nastavte 70-75 °C.",
        },
      };
      const HELP_EXT_EN = {
        dcb: "DC Blocker",
        help_dcb:
          "Single-pole IIR filter (pole R=0.9999) that removes any DC offset from the PDM microphone. Cutoff is ~0.25 Hz — well below all audio. Disable only to test whether it contributes to the clicking artifact; leave ON in normal use.",
        led: "LED Mode",
        help_led:
          "Off: LED stays dark during streaming. Static: Solid color (blue=ready, green=streaming). Level: Color changes with audio level — green=good, orange=hot, red=clipping, dim purple=quiet.",
        agc: "AGC (Auto Gain)",
        help_agc:
          "Automatic Gain Control adjusts volume automatically. Fast attack prevents clipping on loud sounds; slow release gradually boosts quiet periods. Great for outdoor bird recording where distance varies. Base Gain still applies — AGC adjusts on top of it.",
        hpf: "High-pass",
        hpf_cut: "HPF Cutoff",
        help_hpf:
          "High-pass filter (2nd-order, ~12 dB/oct) removes low-frequency rumble such as distant traffic, wind or handling noise. Turn ON to attenuate frequencies below the cutoff while keeping most bird vocalizations intact.",
        help_hpf_cut:
          "Cutoff frequency for the high-pass filter. Default 80 Hz removes only DC and infrasound — BirdNET-Go's low-frequency spectrogram covers 0-3 kHz and the model was trained on unfiltered audio, so a higher cutoff (e.g. 300 Hz) removes useful signal for owls, bitterns, and other low-calling species. Raise to 300-600 Hz only to combat strong wind or traffic noise.",
        help_rate:
          "How many audio samples per second are captured. 48 kHz is the recommended default and hardware maximum — the SPM1423 PDM clock tops out at 3.25 MHz with 64× oversampling (48 kHz × 64 = 3.072 MHz). BirdNET-Go natively processes up to 15 kHz, so 48 kHz gives full coverage with no upsampling artefacts.",
        help_gain:
          "Software amplification after the I2S shift. Use to boost loudness. Too high causes clipping (distortion). With default shift, 1.0× is neutral. Adjust while watching the stream.",
        help_buf:
          "Samples per network packet. Bigger buffer increases latency but improves stability on weak Wi-Fi; smaller buffer lowers latency but may drop packets. Default 9600 gives ~200 ms at 48 kHz. A larger buffer may also help reduce periodic high-frequency clicking from the PDM microphone.",
        help_auto:
          "When enabled, the device restarts the audio pipeline if packet rate drops below the threshold. Helps recover from glitches without manual intervention.",
        help_tx:
          "Wi-Fi transmit power in dBm. Lower values can reduce RF self-noise near the microphone and power draw, but reduce range. Only specific steps are supported by the radio. Change carefully if your signal is weak.",
        help_shift:
          "Right bit-shift applied to 32-bit I2S samples before converting to 16-bit. Higher shift lowers volume and avoids clipping; lower shift raises volume but may clip.",
        help_thr:
          "Minimum packet rate (packets per second) considered healthy while streaming. If measured rate stays below this at a check, auto recovery restarts I2S. In Auto mode this comes from sample rate and buffer size (about 70% of expected).",
        help_chk:
          "How often performance is checked (minutes). Shorter intervals react faster with small CPU cost; longer intervals reduce checks.",
        help_sched:
          "Optional periodic device reboot for long-term stability on problematic networks. Leave OFF unless you need it.",
        help_hours:
          "Number of hours between scheduled reboots. Applies only when Scheduled Reset is ON.",
        help_cpu:
          "Processor clock. Lower MHz reduces heat and power; higher MHz can help under heavy load. 120 MHz is a balanced default.",
        help_thr_mode:
          "Auto: Threshold is computed from Sample Rate and Buffer; recommended for most users. Manual: You set the exact minimum packet rate; use if you know your network and latency constraints.",
        level: "Signal Level",
        help_level:
          "Shows the highest peak since last update. Aim for 60-80% (about -4 to -2 dBFS). If it says CLIPPING, increase I2S Shift or reduce Gain. Turning ON the High-pass (500-600 Hz) often helps.",
        clip_ok: "OK",
        clip_warn:
          "High level — close to clipping (reduce Gain or increase I2S Shift).",
        clip_bad:
          "CLIPPING! Increase I2S Shift or reduce Gain; try High-pass 500-600 Hz.",
      };
      const HELP_EXT_CS = {
        dcb: "DC blocker",
        help_dcb:
          "Jednopólový IIR filtr (pól R=0,9999) odstraňující DC složku PDM mikrofonu. Mezní frekvence ~0,25 Hz — hluboko pod veškerým zvukem. Vypínejte pouze pro test, zda přispívá k artefaktu klikání; při normálním provozu nechte ZAP.",
        led: "Režim LED",
        help_led:
          "Vyp: LED je zhasnutá. Statická: Pevná barva (modrá=připraveno, zelená=streamuje). Úroveň: Barva se mění podle hlasitosti — zelená=ok, oranžová=vysoko, červená=přebuzení, tmavě fialová=ticho.",
        agc: "AGC (Auto zisk)",
        help_agc:
          "Automatické řízení zisku přizpůsobuje hlasitost. Rychlý útlum zabrání přebuzení u hlasitých zvuků; pomalé uvolnění postupně zesiluje tiché úseky. Ideální pro venkovní nahrávání ptáků, kde se vzdálenost mění. Základní zisk se stále uplatňuje — AGC upravuje nad ním.",
        hpf: "Vysokopropustný filtr",
        hpf_cut: "Mezní frekvence HPF",
        help_hpf:
          "Vysokopropustný filtr (2. řád, ~12 dB/okt.) potlačí nízké frekvence jako vzdálená silnice, vítr nebo manipulační hluk. Zapněte pro zeslabení pásem pod mezní frekvencí a zachování většiny ptačích hlasů.",
        help_hpf_cut:
          "Mezní frekvence vysokopropustného filtru. Výchozích 80 Hz odstraní pouze DC složku a infrazvuk — BirdNET-Go zpracovává spektrum od 0 do 3 kHz a model byl trénován na nefiltrovaných nahrávkách. Vyšší hodnota (např. 300 Hz) odstraňuje signál důležitý pro sovy, chřástaly a jiné nízko volající druhy. Zvyšujte pouze při silném větru nebo dopravním hluku.",
        help_rate:
          "Kolik vzorků za sekundu se pořizuje. 48 kHz je doporučené výchozí nastavení a hardwarové maximum — takt PDM mikrofonu SPM1423 dosahuje max. 3,25 MHz při 64× převzorkování (48 kHz × 64 = 3,072 MHz). BirdNET-Go nativně zpracovává až 15 kHz, takže 48 kHz poskytuje plné pokrytí bez artefaktů převzorkování.",
        help_gain:
          "Softwarové zesílení po I2S posunu. 1,0× je neutrální s výchozím posunem. Příliš vysoká hodnota způsobí ořez (zkreslení). Upravujte podle poslechu a spektra.",
        help_buf:
          "Počet vzorků v jednom síťovém paketu. Větší buffer zvyšuje latenci a zlepšuje stabilitu na slabším Wi-Fi; menší buffer snižuje latenci, ale může zvyšovat ztráty paketů. Výchozí hodnota 9600 odpovídá ~200 ms při 48 kHz. Větší buffer může také pomoci omezit periodické vysokofrekvenční klikání z PDM mikrofonu.",
        help_auto:
          "Při poklesu rychlosti odchozích paketů pod práh zařízení automaticky restartuje audio pipeline. Pomáhá zotavit se z výpadků bez zásahu.",
        help_tx:
          "Vysílací výkon Wi-Fi v dBm. Snížení může omezit vlastní RF šum u mikrofonu a spotřebu, ale zmenší dosah. Čip podporuje jen určité kroky. Pokud máte slabý signál, měňte opatrně.",
        help_shift:
          "Pravý bitový posun na 32bitových I2S vzorcích před převodem na 16bit audio. Vyšší posun snižuje hlasitost a brání klipování; nižší posun zvyšuje hlasitost, ale může klipovat.",
        help_thr:
          "Minimální rychlost paketů (paketů za sekundu), považovaná při streamování za zdravou. Pokud při kontrole klesne pod tuto hodnotu, automatická obnova restartuje I2S. V režimu Auto se práh odvozuje z frekvence a bufferu (asi 70 % očekávané hodnoty).",
        help_chk:
          "Jak často se kontroluje výkon (minuty). Kratší interval reaguje rychleji s malou zátěží CPU; delší interval snižuje počet kontrol.",
        help_sched:
          "Volitelný pravidelný restart zařízení pro dlouhodobou stabilitu na problematických sítích. Nechte VYP, pokud není nutné.",
        help_hours:
          "Počet hodin mezi plánovanými restarty. Platí pouze pokud je Plánovaný restart ZAP.",
        help_cpu:
          "Frekvence procesoru. Nižší MHz snižuje zahřívání a spotřebu; vyšší MHz pomůže při zátěži. 120 MHz je vyvážené výchozí nastavení.",
        help_thr_mode:
          "Auto: Práh restartu se počítá z Vzorkovací frekvence a Bufferu; doporučeno pro většinu uživatelů. Manuálně: Nastavíte přesný minimální počet paketů za sekundu; použijte, pokud znáte svou síť a požadavky na latenci.",
        level: "Úroveň signálu",
        help_level:
          "Zobrazuje nejvyšší špičku od poslední obnovy. Cíl je 60-80 % (asi -4 až -2 dBFS). Při CLIPPING zvyšte I2S posun nebo snižte Gain. Často pomůže zapnout High-pass (500-600 Hz).",
        clip_ok: "OK",
        clip_warn:
          "Vysoká úroveň — blízko klipu (snižte Gain nebo zvyšte I2S posun).",
        clip_bad:
          "CLIPPING! Zvyšte I2S posun nebo snižte Gain; zkuste High-pass 500-600 Hz.",
      };
      Object.assign(T.en, HELP_EXT_EN);
      Object.assign(T.cs, HELP_EXT_CS);
      let lang = localStorage.getItem("lang") || "en";
      const $ = (id) => document.getElementById(id);
      function applyLang() {
        const L = T[lang];
        const st = (id, t) => {
          const e = $(id);
          if (e) e.textContent = t;
        };
        const help = (k) => {
          const b = L[k] || "";
          return b;
        };
        st("t_title", L.title);
        st("t_status", L.status);
        st("t_ip", L.ip);
        st("t_wifi_rssi", L.wifi_rssi);
        st("t_wifi_tx", L.wifi_tx);
        st("t_heap", L.heap);
        st("t_uptime", L.uptime);
        st("t_rtsp_server", L.rtsp_server);
        st("t_client", L.client);
        st("t_streaming", L.streaming);
        st("t_pkt_rate", L.pkt_rate);
        st("t_last_connect", L.last_connect);
        st("t_last_play", L.last_play);
        st("t_audio", L.audio);
        st("t_rate", L.rate);
        st("t_gain", L.gain);
        st("t_buf", L.buf);
        st("t_latency", L.latency);
        st("t_level", L.level);
        st("t_profile", L.profile);
        st("t_perf", L.perf);
        st("t_auto", L.auto);
        st("t_wifi", L.wifi);
        st("t_wifi_tx2", L.wifi_tx2);
        st("t_thermal", L.thermal);
        st("t_therm_protect", L.therm_protect);
        st("t_therm_limit", L.therm_limit);
        st("t_therm_status", L.therm_status);
        st("t_therm_now", L.therm_now);
        st("t_therm_max", L.therm_max);
        st("t_therm_cpu", L.therm_cpu);
        st("t_therm_last", L.therm_last);
        st("t_logs", L.logs);
        st("b_srv_on", L.bsrvon);
        st("b_srv_off", L.bsrvoff);
        st("b_reset", L.breset);
        st("b_reboot", L.breboot);
        st("b_defaults", L.bdefaults);
        st("t_advanced_settings", L.advanced_settings);
        st("t_shift", L.shift);
        st("t_thr", L.thr);
        st("t_chk", L.chk);
        st("t_thr_mode", L.thr_mode);
        st("t_sched", L.sched);
        st("t_hours", L.hours);
        st("t_cpu", L.cpu);
        const hm = (id, k) => {
          const e = $(id);
          if (e) e.setAttribute("title", help(k));
        };
        hm("h_rate", "help_rate");
        hm("h_gain", "help_gain");
        hm("h_hpf", "help_hpf");
        hm("h_hpf_cut", "help_hpf_cut");
        hm("h_buf", "help_buf");
        hm("h_auto", "help_auto");
        hm("h_tx", "help_tx");
        hm("h_thr", "help_thr");
        hm("h_chk", "help_chk");
        hm("h_shift", "help_shift");
        hm("h_sched", "help_sched");
        hm("h_hours", "help_hours");
        hm("h_cpu", "help_cpu");
        hm("h_thr_mode", "help_thr_mode");
        hm("h_level", "help_level");
        hm("h_therm_protect", "help_therm_protect");
        hm("h_therm_limit", "help_therm_limit");
        st("btn_rate_set", L.set);
        st("btn_gain_set", L.set);
        st("btn_buf_set", L.set);
        st("btn_auto_set", L.set);
        st("btn_thrmode_set", L.set);
        st("btn_thr_set", L.set);
        st("btn_sched_set", L.set);
        st("btn_hours_set", L.set);
        st("btn_shift_set", L.set);
        st("btn_chk_set", L.set);
        st("btn_tx_set", L.set);
        st("btn_cpu_set", L.set);
        st("btn_oh_enable", L.set);
        st("btn_oh_limit", L.set);
        const sht = (id, k) => {
          const e = $(id);
          if (e) e.textContent = help(k);
        };
        sht("txt_rate_hint", "help_rate");
        sht("txt_gain_hint", "help_gain");
        sht("txt_hpf_hint", "help_hpf");
        sht("txt_hpf_cut_hint", "help_hpf_cut");
        sht("txt_buf_hint", "help_buf");
        sht("txt_auto_hint", "help_auto");
        sht("txt_thr_hint", "help_thr");
        sht("txt_thr_mode_hint", "help_thr_mode");
        sht("txt_sched_hint", "help_sched");
        sht("txt_hours_hint", "help_hours");
        sht("txt_shift_hint", "help_shift");
        sht("txt_chk_hint", "help_chk");
        sht("txt_tx_hint", "help_tx");
        sht("txt_cpu_hint", "help_cpu");
        sht("txt_level_hint", "help_level");
        sht("txt_therm_hint_protect", "help_therm_protect");
        sht("txt_therm_hint_limit", "help_therm_limit");
        st("t_dcb", L.dcb);
        hm("h_dcb", "help_dcb");
        sht("txt_dcb_hint", "help_dcb");
        st("t_hpf", L.hpf);
        st("t_hpf_cut", L.hpf_cut);
        st("t_agc", L.agc);
        hm("h_agc", "help_agc");
        st("btn_agc_set", L.set);
        sht("txt_agc_hint", "help_agc");
        st("t_led", L.led);
        hm("h_led", "help_led");
        st("btn_led_set", L.set);
        sht("txt_led_hint", "help_led");
        document.title = L.title;
      }
      function profileText(buf) {
        const L = T[lang];
        buf = parseInt(buf, 10) || 0;
        if (buf <= 256) return L.profile_ultra;
        if (buf <= 512) return L.profile_balanced;
        if (buf <= 1024) return L.profile_stable;
        return L.profile_high;
      }
      function fmtBool(b) {
        return b ? "<span class=ok>YES</span>" : "<span class=bad>NO</span>";
      }
      function fmtSrv(b) {
        return b
          ? "<span class=ok>ENABLED</span>"
          : "<span class=bad>DISABLED</span>";
      }
      function showOverlay(msg) {
        $("ovr_msg").textContent = msg;
        $("ovr").style.display = "flex";
      }
      function copyLogs() {
        const t = $("logs").textContent;
        const b = $("btn_copy_logs");
        const orig = b.innerHTML;
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          b.innerHTML =
            '<svg width=16 height=16 viewBox="0 0 16 16" fill="none" stroke="var(--acc2)" stroke-width="1.5"><path d="M3 9l3 3 7-7"/></svg>';
          setTimeout(() => {
            b.innerHTML = orig;
          }, 1500);
        } catch (e) {}
        document.body.removeChild(ta);
      }
      function rebootSequence(kind) {
        const L = T[lang];
        const msg = kind === "factory_reset" ? L.resetting : L.restarting;
        showOverlay(msg);
        function tick() {
          fetch("/api/status", { cache: "no-store" })
            .then((r) => {
              if (r.ok) {
                location.reload();
              } else {
                setTimeout(tick, 2000);
              }
            })
            .catch(() => setTimeout(tick, 2000));
        }
        setTimeout(tick, 4000);
      }
      function act(a) {
        fetch("/api/action/" + a, { cache: "no-store" })
          .then((r) => r.json())
          .then(loadAll);
      }
      function rebootNow() {
        rebootSequence("reboot");
        act("reboot");
      }
      function defaultsNow() {
        rebootSequence("factory_reset");
        act("factory_reset");
      }
      function reconfigWifiNow() {
        if (
          !confirm(
            "This will erase stored WiFi credentials and reboot into setup portal.\nConnect to 'ESP32-RTSP-Mic-AP' after reboot.",
          )
        )
          return;
        showOverlay(
          "Rebooting into WiFi setup...\nConnect to ESP32-RTSP-Mic-AP",
        );
        act("reconfigure_wifi");
      }
      const locks = {};
      const edits = {};
      function setv(k, v) {
        v = String(v ?? "")
          .trim()
          .replace(",", ".");
        if (v === "") return;
        locks[k] = Date.now() + 5000;
        delete edits[k];
        fetch(
          "/api/set?key=" +
            encodeURIComponent(k) +
            "&value=" +
            encodeURIComponent(v),
          { cache: "no-store" },
        )
          .then((r) => r.json())
          .then(loadAll);
      }
      function bindSaver(el, key) {
        if (!el) return;
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            setv(key, el.value);
          }
        });
      }
      function trackEdit(el, key) {
        if (!el) return;
        const bump = () => {
          edits[key] = Date.now() + 10000;
          toggleDirty(el, key);
        };
        el.addEventListener("input", bump);
        el.addEventListener("change", bump);
      }
      function toggleDirty(el, key) {
        if (!el) return;
        const now = Date.now();
        const d = edits[key] && now < edits[key];
        el.classList.toggle("dirty", !!d);
        if (!d) {
          delete edits[key];
        }
      }
      function setToggleState(on) {
        const onb = $("b_srv_on"),
          offb = $("b_srv_off");
        if (onb && offb) {
          onb.classList.toggle("active", on);
          offb.classList.toggle("active", !on);
          onb.disabled = on;
          offb.disabled = !on;
        }
      }
      function loadStatus() {
        fetch("/api/status", { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => {
            $("ip").textContent = j.ip;
            $("rssi").textContent = j.wifi_rssi + " dBm";
            $("wtx").textContent = j.wifi_tx_dbm.toFixed(1) + " dBm";
            $("heap").textContent =
              j.free_heap_kb + " KB (" + j.min_free_heap_kb + " KB)";
            $("uptime").textContent = j.uptime;
            $("srv").innerHTML = fmtSrv(j.rtsp_server_enabled);
            setToggleState(j.rtsp_server_enabled);
            $("client").textContent = j.client || "Waiting...";
            $("stream").innerHTML = fmtBool(j.streaming);
            $("rate").textContent = j.current_rate_pkt_s + " pkt/s";
            $("lcon").textContent = j.last_rtsp_connect;
            $("lplay").textContent = j.last_stream_start;
            const stx = $("sel_tx");
            const now = Date.now();
            if (stx) {
              const editing = edits["wifi_tx"] && now < edits["wifi_tx"];
              if (!(locks["wifi_tx"] && now < locks["wifi_tx"]) && !editing)
                stx.value = j.wifi_tx_dbm.toFixed(1);
              toggleDirty(stx, "wifi_tx");
            }
            const fv = $("fwv");
            if (fv && j.fw_version) {
              fv.textContent = "v" + j.fw_version;
            }
            const hn = $("in_hostname");
            if (hn && j.mdns_hostname && document.activeElement !== hn)
              hn.value = j.mdns_hostname;
            const rtsp = $("rtsp");
            if (rtsp && j.mdns_hostname)
              rtsp.textContent =
                "rtsp://" + j.mdns_hostname + ".local:8554/audio";
          });
      }
      function loadAudio() {
        fetch("/api/audio_status", { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => {
            const r = $("in_rate");
            const g = $("in_gain");
            const sb = $("sel_buf");
            const s = $("in_shift");
            const hp = $("sel_hp");
            const hpc = $("in_hp_cutoff");
            const now = Date.now();
            if (r) {
              const editing = edits["rate"] && now < edits["rate"];
              if (!(locks["rate"] && now < locks["rate"]) && !editing)
                r.value = j.sample_rate;
              toggleDirty(r, "rate");
            }
            if (g) {
              const editing = edits["gain"] && now < edits["gain"];
              if (!(locks["gain"] && now < locks["gain"]) && !editing)
                g.value = j.gain.toFixed(2);
              toggleDirty(g, "gain");
            }
            if (sb) {
              const editing = edits["buffer"] && now < edits["buffer"];
              if (!(locks["buffer"] && now < locks["buffer"]) && !editing)
                sb.value = j.buffer_size;
              toggleDirty(sb, "buffer");
            }
            if (s) {
              const editing = edits["shift"] && now < edits["shift"];
              if (!(locks["shift"] && now < locks["shift"]) && !editing)
                s.value = j.i2s_shift;
              toggleDirty(s, "shift");
            }
            const dcb = $("sel_dcb");
            if (dcb) {
              const editing = edits["dc_blocker"] && now < edits["dc_blocker"];
              if (
                !(locks["dc_blocker"] && now < locks["dc_blocker"]) &&
                !editing
              )
                dcb.value = j.dc_blocker_enable ? "on" : "off";
              toggleDirty(dcb, "dc_blocker");
            }
            if (hp) {
              const editing = edits["hp_enable"] && now < edits["hp_enable"];
              if (!(locks["hp_enable"] && now < locks["hp_enable"]) && !editing)
                hp.value = j.hp_enable ? "on" : "off";
              toggleDirty(hp, "hp_enable");
            }
            if (hpc) {
              const editing = edits["hp_cutoff"] && now < edits["hp_cutoff"];
              if (!(locks["hp_cutoff"] && now < locks["hp_cutoff"]) && !editing)
                hpc.value = j.hp_cutoff_hz;
              toggleDirty(hpc, "hp_cutoff");
            }
            const agc = $("sel_agc");
            if (agc) {
              const editing = edits["agc_enable"] && now < edits["agc_enable"];
              if (
                !(locks["agc_enable"] && now < locks["agc_enable"]) &&
                !editing
              )
                agc.value = j.agc_enable ? "on" : "off";
              toggleDirty(agc, "agc_enable");
            }
            const agi = $("agc_info");
            if (agi) {
              if (j.agc_enable)
                agi.textContent =
                  "x" +
                  j.agc_multiplier.toFixed(1) +
                  " (eff: " +
                  j.effective_gain.toFixed(1) +
                  "x)";
              else agi.textContent = "";
            }
            const led = $("sel_led");
            if (led) {
              const editing = edits["led_mode"] && now < edits["led_mode"];
              if (!(locks["led_mode"] && now < locks["led_mode"]) && !editing)
                led.value = String(j.led_mode || 0);
              toggleDirty(led, "led_mode");
            }
            $("lat").textContent = j.latency_ms.toFixed(1) + " ms";
            $("profile").textContent = profileText(j.buffer_size);
            const L = T[lang];
            const lvl = $("level");
            if (lvl) {
              const pct = j.peak_pct || 0,
                db = j.peak_dbfs || -90,
                clip = j.clip,
                cc = j.clip_count || 0;
              if (clip) {
                lvl.innerHTML = `<span class='bad'>${L.clip_bad}</span> Peak ${pct.toFixed(0)}% (${db.toFixed(1)} dBFS), clips: ${cc}`;
              } else if (pct >= 90) {
                lvl.innerHTML = `<span class='warn'>${L.clip_warn}</span> Peak ${pct.toFixed(0)}% (${db.toFixed(1)} dBFS)`;
              } else {
                lvl.textContent = `Peak ${pct.toFixed(0)}% (${db.toFixed(1)} dBFS) — ${L.clip_ok}`;
              }
            }
            updateAdvice(j);
          });
      }
      function updateAdvice(a) {
        const L = T[lang];
        let tips = [];
        if (a.buffer_size < 512) tips.push(L.adv_buf512);
        if (a.buffer_size < 1024) tips.push(L.adv_buf1024);
        if (a.gain > 20) tips.push(L.adv_gain);
        $("adv").textContent = tips.join(" ");
      }
      function loadPerf() {
        fetch("/api/perf_status", { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => {
            const thr = $("in_thr");
            const chk = $("in_chk");
            const mode = $("in_thr_mode");
            const sch = $("in_sched");
            const hrs = $("in_hours");
            const now = Date.now();
            const el = $("in_auto");
            if (el) {
              const editing =
                edits["auto_recovery"] && now < edits["auto_recovery"];
              if (
                !(locks["auto_recovery"] && now < locks["auto_recovery"]) &&
                !editing
              )
                el.value = j.auto_recovery ? "on" : "off";
              toggleDirty(el, "auto_recovery");
            }
            if (mode) {
              const editing = edits["thr_mode"] && now < edits["thr_mode"];
              if (!(locks["thr_mode"] && now < locks["thr_mode"]) && !editing)
                mode.value = j.auto_threshold ? "auto" : "manual";
              toggleDirty(mode, "thr_mode");
            }
            if (thr) {
              const editing = edits["min_rate"] && now < edits["min_rate"];
              if (!(locks["min_rate"] && now < locks["min_rate"]) && !editing)
                thr.value = j.restart_threshold_pkt_s;
              toggleDirty(thr, "min_rate");
            }
            if (chk) {
              const editing =
                edits["check_interval"] && now < edits["check_interval"];
              if (
                !(locks["check_interval"] && now < locks["check_interval"]) &&
                !editing
              )
                chk.value = j.check_interval_min;
              toggleDirty(chk, "check_interval");
            }
            if (sch) {
              const editing =
                edits["sched_reset"] && now < edits["sched_reset"];
              if (
                !(locks["sched_reset"] && now < locks["sched_reset"]) &&
                !editing
              )
                sch.value = j.scheduled_reset ? "on" : "off";
              toggleDirty(sch, "sched_reset");
            }
            if (hrs) {
              const editing =
                edits["reset_hours"] && now < edits["reset_hours"];
              if (
                !(locks["reset_hours"] && now < locks["reset_hours"]) &&
                !editing
              )
                hrs.value = j.reset_hours;
              toggleDirty(hrs, "reset_hours");
            }
            $("row_min_rate").style.display = j.auto_threshold ? "none" : "";
          });
      }
      function loadTherm() {
        fetch("/api/thermal", { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => {
            const now = Date.now();
            const L = T[lang];
            const en = $("sel_oh_enable");
            if (en) {
              const editing = edits["oh_enable"] && now < edits["oh_enable"];
              if (!(locks["oh_enable"] && now < locks["oh_enable"]) && !editing)
                en.value = j.protection_enabled ? "on" : "off";
              toggleDirty(en, "oh_enable");
            }
            const lim = $("sel_oh_limit");
            if (lim) {
              const editing = edits["oh_limit"] && now < edits["oh_limit"];
              if (!(locks["oh_limit"] && now < locks["oh_limit"]) && !editing)
                lim.value = (Number(j.shutdown_c) || 80).toFixed(0);
              toggleDirty(lim, "oh_limit");
            }
            const sc = $("sel_cpu");
            if (sc && !(locks["cpu_freq"] && now < locks["cpu_freq"])) {
              sc.value = j.cpu_mhz;
            }
            const currentValid =
              j.current_valid &&
              typeof j.current_c === "number" &&
              isFinite(j.current_c);
            const cur = $("therm_now");
            if (cur)
              cur.textContent = currentValid
                ? j.current_c.toFixed(1) + " °C"
                : "N/A";
            const max = $("therm_max");
            if (max) {
              const maxValid = typeof j.max_c === "number" && isFinite(j.max_c);
              max.textContent = maxValid ? j.max_c.toFixed(1) + " °C" : "N/A";
            }
            const cpu = $("therm_cpu");
            if (cpu) cpu.textContent = j.cpu_mhz + " MHz";
            const status = $("therm_status");
            if (status) {
              if (j.sensor_fault) {
                status.innerHTML =
                  "<span class=warn>" + L.therm_status_sensor_fault + "</span>";
              } else if (j.latched_persist) {
                status.innerHTML =
                  "<span class=warn>" +
                  L.therm_status_latched_persist +
                  "</span>";
              } else if (!j.protection_enabled) {
                status.innerHTML =
                  "<span class=bad>" + L.therm_status_disabled + "</span>";
              } else if (j.manual_restart || j.latched) {
                status.innerHTML =
                  "<span class=warn>" + L.therm_status_latched + "</span>";
              } else {
                status.innerHTML =
                  "<span class=ok>" + L.therm_status_ready + "</span>";
              }
            }
            const latchRow = $("row_therm_latch");
            const latchMsg = $("txt_therm_latch");
            const latchBtn = $("btn_therm_clear");
            if (latchRow) {
              if (j.latched_persist) {
                latchRow.style.display = "";
                if (latchMsg) latchMsg.textContent = L.therm_latch_notice;
                if (latchBtn) {
                  latchBtn.textContent = L.therm_clear_btn;
                  latchBtn.disabled = false;
                }
              } else {
                latchRow.style.display = "none";
                if (latchBtn) {
                  latchBtn.disabled = true;
                }
              }
            }
            const last = $("therm_last");
            if (last) {
              if (j.sensor_fault) {
                last.textContent = L.therm_last_sensor_fault;
              } else if (j.last_trip_ts && j.last_trip_ts.length) {
                let msg = L.therm_last_fmt;
                const temp =
                  typeof j.last_trip_c === "number" &&
                  isFinite(j.last_trip_c) &&
                  j.last_trip_c > 0
                    ? j.last_trip_c.toFixed(1)
                    : "0";
                const limit = (Number(j.shutdown_c) || 0).toFixed(0);
                const ts = j.last_trip_ts || L.therm_time_unknown;
                const ago = j.last_trip_since || L.therm_time_ago_unknown;
                msg = msg
                  .replace("%TEMP%", temp)
                  .replace("%LIMIT%", limit)
                  .replace("%TIME%", ts)
                  .replace("%AGO%", ago);
                last.textContent = msg;
                if (j.latched_persist) {
                  last.textContent += " — " + L.therm_status_latched_persist;
                } else if (j.manual_restart) {
                  last.textContent += " — " + L.therm_status_latched;
                }
              } else if (j.last_reason && j.last_reason.length) {
                last.textContent = j.last_reason;
              } else {
                last.textContent = L.therm_last_none;
              }
            }
          });
      }
      function loadLogs() {
        fetch("/api/logs", { cache: "no-store" })
          .then((r) => r.text())
          .then((t) => {
            const lg = $("logs");
            lg.textContent = t;
            lg.scrollTop = lg.scrollHeight;
          });
      }
      function setHostname() {
        const v = $("in_hostname").value.trim();
        if (!v) return;
        rebootSequence("reboot");
        fetch("/api/set?key=hostname&value=" + encodeURIComponent(v), {
          cache: "no-store",
        }).then(() => act("reboot"));
      }
      function loadAll() {
        loadStatus();
        loadAudio();
        loadPerf();
        loadTherm();
        loadLogs();
      }
      function clearThermalLatch() {
        const btn = $("btn_therm_clear");
        if (btn) btn.disabled = true;
        fetch("/api/thermal/clear", { method: "POST", cache: "no-store" })
          .then((r) => r.json())
          .then((j) => {
            if (!j.ok) {
              console.warn("Thermal latch clear rejected");
            }
            loadAll();
          })
          .catch(() => loadAll());
      }
      setInterval(loadAll, 3000);
      const sel = document.getElementById("langSel");
      sel.value = lang;
      sel.onchange = () => {
        lang = sel.value;
        localStorage.setItem("lang", lang);
        applyLang();
      };
      applyLang();
      bindSaver($("in_rate"), "rate");
      bindSaver($("in_gain"), "gain");
      bindSaver($("in_shift"), "shift");
      bindSaver($("in_thr"), "min_rate");
      bindSaver($("in_chk"), "check_interval");
      bindSaver($("in_hours"), "reset_hours");
      bindSaver($("in_hp_cutoff"), "hp_cutoff");
      trackEdit($("in_rate"), "rate");
      trackEdit($("in_gain"), "gain");
      trackEdit($("in_shift"), "shift");
      trackEdit($("in_thr"), "min_rate");
      trackEdit($("in_chk"), "check_interval");
      trackEdit($("in_hours"), "reset_hours");
      trackEdit($("in_hp_cutoff"), "hp_cutoff");
      trackEdit($("sel_led"), "led_mode");
      trackEdit($("in_auto"), "auto_recovery");
      trackEdit($("in_thr_mode"), "thr_mode");
      trackEdit($("in_sched"), "sched_reset");
      trackEdit($("sel_buf"), "buffer");
      trackEdit($("sel_tx"), "wifi_tx");
      trackEdit($("sel_dcb"), "dc_blocker");
      trackEdit($("sel_hp"), "hp_enable");
      trackEdit($("sel_agc"), "agc_enable");
      trackEdit($("sel_cpu"), "cpu_freq");
      trackEdit($("sel_oh_enable"), "oh_enable");
      trackEdit($("sel_oh_limit"), "oh_limit");
      const H = (hid, rid) => {
        const h = $(hid),
          r = $(rid);
        if (h && r) {
          h.onclick = () => {
            r.style.display =
              r.style.display === "none" || !r.style.display ? "block" : "none";
          };
        }
      };
      H("h_dcb", "row_dcb_hint");
      H("h_led", "row_led_hint");
      H("h_rate", "row_rate_hint");
      H("h_gain", "row_gain_hint");
      H("h_hpf", "row_hpf_hint");
      H("h_hpf_cut", "row_hpf_cut_hint");
      H("h_agc", "row_agc_hint");
      H("h_buf", "row_buf_hint");
      H("h_auto", "row_auto_hint");
      H("h_thr", "row_thr_hint");
      H("h_thr_mode", "row_thrmode_hint");
      H("h_chk", "row_chk_hint");
      H("h_sched", "row_sched_hint");
      H("h_hours", "row_hours_hint");
      H("h_tx", "row_tx_hint");
      H("h_shift", "row_shift_hint");
      H("h_cpu", "row_cpu_hint");
      H("h_level", "row_level_hint");
      H("h_therm_protect", "row_therm_hint_protect");
      H("h_therm_limit", "row_therm_hint_limit");
      loadAll();
