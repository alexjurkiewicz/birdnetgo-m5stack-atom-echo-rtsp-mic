#!/usr/bin/env python3
"""Serve src/web with a fake in-memory backend for frontend development."""

from __future__ import annotations

import argparse
import json
import math
import mimetypes
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = ROOT / "src" / "web"


def format_uptime(seconds: int) -> str:
    seconds = max(0, int(seconds))
    days, seconds = divmod(seconds, 86400)
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)

    parts = []
    if days:
        parts.append(f"{days}d")
    if hours or parts:
        parts.append(f"{hours}h")
    if minutes or parts:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    return " ".join(parts)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def truthy(value: str) -> bool:
    return value in {"1", "true", "on", "yes"}


class FakeDeviceState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.boot_at = time.monotonic()
        self.offline_until = 0.0
        self.logs: list[str] = []
        self.reset_to_defaults(initial=True)

    def reset_to_defaults(self, initial: bool = False) -> None:
        now = time.monotonic()
        self.boot_at = now
        self.fw_version = "dev-ui"
        self.ip = "192.168.4.42"
        self.wifi_rssi = -58
        self.wifi_tx_dbm = 19.5
        self.free_heap_kb = 246
        self.min_free_heap_kb = 231
        self.mdns_hostname = "birdnet-atomecho-dev"
        self.rtsp_server_enabled = True
        self.streaming = True
        self.client_ip = "192.168.4.23"
        self.sample_rate = 48000
        self.gain = 3.0
        self.buffer_size = 1024
        self.dc_blocker_enable = True
        self.hp_enable = True
        self.hp_cutoff_hz = 300
        self.agc_enable = False
        self.agc_multiplier = 1.0
        self.led_mode = 1
        self.restart_threshold_pkt_s = 33
        self.auto_recovery = True
        self.auto_threshold = True
        self.check_interval_min = 5
        self.scheduled_reset = False
        self.reset_hours = 24
        self.cpu_mhz = 120
        self.protection_enabled = True
        self.shutdown_c = 80.0
        self.current_temp_c = 46.0
        self.max_temp_c = 46.0
        self.latched = False
        self.latched_persist = False
        self.sensor_fault = False
        self.last_trip_c = 0.0
        self.last_reason = ""
        self.last_trip_timestamp = ""
        self.last_trip_uptime = ""
        self.manual_restart = False
        self.last_rtsp_connect_at = now - 320
        self.last_stream_start_at = now - 300
        self.clip_count = 0
        self.recompute_threshold_locked()
        if initial:
            self.logs = []
        self.log_locked("Development server ready")

    def log_locked(self, message: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        self.logs.append(f"[{stamp}] {message}")
        self.logs = self.logs[-200:]

    def mark_offline_locked(self, seconds: float) -> None:
        self.offline_until = time.monotonic() + seconds
        self.boot_at = self.offline_until

    def recompute_threshold_locked(self) -> None:
        if self.auto_threshold:
            self.restart_threshold_pkt_s = self.recommended_min_rate_locked()

    def expected_rate_locked(self) -> float:
        return self.sample_rate / max(1, self.buffer_size)

    def recommended_min_rate_locked(self) -> int:
        expected = self.expected_rate_locked()
        rec = int(expected * 0.5 + 0.5)  # 50% safety margin
        return max(5, rec)

    def effective_gain_locked(self) -> float:
        return self.gain * (self.agc_multiplier if self.agc_enable else 1.0)

    def update_dynamic_state_locked(self) -> None:
        now = time.monotonic()
        elapsed = max(0.0, now - self.boot_at)
        phase = elapsed / 6.0

        if self.rtsp_server_enabled and not self.latched_persist:
            self.streaming = True
            self.client_ip = "192.168.4.23"
        else:
            self.streaming = False
            self.client_ip = ""

        if self.agc_enable:
            self.agc_multiplier = 1.25 + 0.3 * math.sin(elapsed / 9.0)
        else:
            self.agc_multiplier = 1.0

        self.wifi_rssi = int(round(-61 + 6 * math.sin(elapsed / 12.0)))
        self.free_heap_kb = int(round(244 + 6 * math.sin(elapsed / 10.0)))
        self.min_free_heap_kb = min(self.min_free_heap_kb, self.free_heap_kb)

        temp = 43.5 + 2.8 * math.sin(elapsed / 11.0) + (6.0 if self.streaming else 1.0)
        temp += (self.cpu_mhz - 80) * 0.045
        self.current_temp_c = round(temp, 1)
        self.max_temp_c = max(self.max_temp_c, self.current_temp_c)

        if (
            self.protection_enabled
            and not self.sensor_fault
            and not self.latched_persist
            and self.current_temp_c >= self.shutdown_c
        ):
            self.latched = True
            self.latched_persist = True
            self.manual_restart = True
            self.rtsp_server_enabled = False
            self.streaming = False
            self.client_ip = ""
            self.last_trip_c = self.current_temp_c
            self.last_reason = "Thermal shutdown triggered in the development backend."
            self.last_trip_timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            self.last_trip_uptime = format_uptime(int(elapsed))
            self.log_locked(
                f"Thermal protection tripped at {self.current_temp_c:.1f} C"
            )

        peak_base = 28 + 18 * (math.sin(phase) + 1.0)
        gain_factor = clamp(self.effective_gain_locked() / 3.0, 0.6, 3.0)
        peak_pct = clamp(peak_base * gain_factor, 4.0, 100.0) if self.streaming else 0.0
        clip = peak_pct >= 98.0
        if clip:
            self.clip_count += 1

    def state_payload_locked(self) -> dict[str, object]:
        """Returns all device state as a flat JSON object."""
        self.update_dynamic_state_locked()
        elapsed = max(0.0, time.monotonic() - self.boot_at)
        current_rate = round(self.expected_rate_locked()) if self.streaming else 0
        
        # Audio metrics
        phase = elapsed / 6.0
        peak_base = 28 + 18 * (math.sin(phase) + 1.0)
        peak_pct = clamp(
            peak_base * clamp(self.effective_gain_locked() / 3.0, 0.6, 3.0),
            4.0,
            100.0,
        ) if self.streaming else 0.0
        clip = peak_pct >= 98.0
        peak_ratio = max(peak_pct / 100.0, 0.0001)
        
        return {
            # Status fields
            "fw_version": self.fw_version,
            "ip": self.ip,
            "wifi_rssi": self.wifi_rssi,
            "wifi_tx_dbm": round(self.wifi_tx_dbm, 1),
            "free_heap_kb": self.free_heap_kb,
            "min_free_heap_kb": self.min_free_heap_kb,
            "uptime": format_uptime(int(elapsed)),
            "rtsp_server_enabled": self.rtsp_server_enabled,
            "client": self.client_ip,
            "streaming": self.streaming,
            "dropped_packets": 0,
            "current_rate_pkt_s": current_rate,
            "last_rtsp_connect": f"{int(max(0, elapsed - 25))}s ago",
            "last_stream_start": f"{int(max(0, elapsed - 12))}s ago",
            "mdns_hostname": self.mdns_hostname,
            # Audio fields
            "sample_rate": self.sample_rate,
            "gain": round(self.gain, 2),
            "buffer_size": self.buffer_size,
            "i2s_shift": 0,
            "latency_ms": round(self.buffer_size / self.sample_rate * 1000.0, 1),
            "dc_blocker_enable": self.dc_blocker_enable,
            "hp_enable": self.hp_enable,
            "hp_cutoff_hz": self.hp_cutoff_hz,
            "agc_enable": self.agc_enable,
            "agc_multiplier": round(self.agc_multiplier, 2),
            "effective_gain": round(self.effective_gain_locked(), 2),
            "peak_pct": round(peak_pct, 1),
            "peak_dbfs": round(20.0 * math.log10(peak_ratio), 1),
            "clip": clip,
            "clip_count": self.clip_count,
            "led_mode": self.led_mode,
            # Perf fields
            "restart_threshold_pkt_s": self.restart_threshold_pkt_s,
            "expected_pkt_rate": int(round(self.expected_rate_locked())),
            "recommended_min_rate": self.recommended_min_rate_locked(),
            "check_interval_min": self.check_interval_min,
            "auto_recovery": self.auto_recovery,
            "auto_threshold": self.auto_threshold,
            "scheduled_reset": self.scheduled_reset,
            "reset_hours": self.reset_hours,
            # Thermal fields
            "current_c": self.current_temp_c,
            "current_valid": not self.sensor_fault,
            "max_c": round(self.max_temp_c, 1),
            "cpu_mhz": self.cpu_mhz,
            "protection_enabled": self.protection_enabled,
            "shutdown_c": int(self.shutdown_c),
            "latched": self.latched,
            "latched_persist": self.latched_persist,
            "sensor_fault": self.sensor_fault,
            "last_trip_c": self.last_trip_c,
            "last_reason": self.last_reason,
            "last_trip_ts": self.last_trip_timestamp,
            "last_trip_since": self.last_trip_uptime,
            "manual_restart": self.manual_restart,
            # Logs as array
            "logs": list(self.logs),
        }

    def clear_thermal_latch_locked(self) -> dict[str, object]:
        if not self.latched_persist:
            return {"ok": False}
        self.latched = False
        self.latched_persist = False
        self.manual_restart = False
        self.last_trip_c = 0.0
        self.last_reason = "Thermal latch cleared manually in development mode."
        self.last_trip_timestamp = ""
        self.last_trip_uptime = ""
        self.rtsp_server_enabled = True
        self.streaming = True
        self.client_ip = "192.168.4.23"
        self.log_locked("UI action: thermal_latch_clear")
        return {"ok": True}

    def handle_action_locked(self, action: str) -> tuple[int, dict[str, object]]:
        if action == "server_start":
            if self.latched_persist:
                self.log_locked("Server start blocked: thermal protection latched")
                return HTTPStatus.BAD_REQUEST, {"ok": False, "error": "thermal_latched"}
            self.rtsp_server_enabled = True
            self.streaming = True
            self.client_ip = "192.168.4.23"
            self.log_locked("UI action: server_start")
            return HTTPStatus.OK, {"ok": True}

        if action == "server_stop":
            self.rtsp_server_enabled = False
            self.streaming = False
            self.client_ip = ""
            self.log_locked("UI action: server_stop")
            return HTTPStatus.OK, {"ok": True}

        if action == "reset_i2s":
            self.log_locked("UI action: reset_i2s")
            return HTTPStatus.OK, {"ok": True}

        if action == "reboot":
            self.log_locked("UI action: reboot")
            self.mark_offline_locked(3.0)
            return HTTPStatus.OK, {"ok": True}

        if action == "factory_reset":
            self.log_locked("UI action: factory_reset")
            self.reset_to_defaults()
            self.mark_offline_locked(3.0)
            return HTTPStatus.OK, {"ok": True}

        if action == "reconfigure_wifi":
            self.log_locked("UI action: reconfigure_wifi")
            self.mark_offline_locked(3.0)
            return HTTPStatus.OK, {"ok": True}

        return HTTPStatus.BAD_REQUEST, {"ok": False, "error": "unknown action"}

    def handle_set_locked(self, key: str, value: str) -> tuple[int, dict[str, object]]:
        if not key:
            return HTTPStatus.BAD_REQUEST, {"ok": False, "error": "missing key"}

        def parse_float(low: float, high: float) -> float | None:
            try:
                parsed = float(value)
            except ValueError:
                return None
            if parsed < low or parsed > high:
                return None
            return parsed

        def parse_int(low: int, high: int) -> int | None:
            try:
                parsed = int(value)
            except ValueError:
                return None
            if parsed < low or parsed > high:
                return None
            return parsed

        valid = False

        if key == "gain":
            parsed = parse_float(0.1, 100.0)
            if parsed is not None:
                self.gain = parsed
                valid = True
        elif key == "rate":
            parsed = parse_int(8000, 48000)
            if parsed is not None:
                self.sample_rate = parsed
                self.recompute_threshold_locked()
                valid = True
        elif key == "buffer":
            parsed = parse_int(256, 9600)
            if parsed is not None:
                self.buffer_size = parsed
                self.recompute_threshold_locked()
                valid = True
        elif key == "wifi_tx":
            parsed = parse_float(-1.0, 19.5)
            if parsed is not None:
                self.wifi_tx_dbm = round(parsed, 1)
                valid = True
        elif key == "auto_recovery":
            if value in {"on", "off"}:
                self.auto_recovery = truthy(value)
                valid = True
        elif key == "thr_mode":
            if value in {"auto", "manual"}:
                self.auto_threshold = value == "auto"
                self.recompute_threshold_locked()
                valid = True
        elif key == "min_rate":
            parsed = parse_int(5, 200)
            if parsed is not None:
                self.restart_threshold_pkt_s = parsed
                valid = True
        elif key == "check_interval":
            parsed = parse_int(1, 60)
            if parsed is not None:
                self.check_interval_min = parsed
                valid = True
        elif key == "sched_reset":
            if value in {"on", "off"}:
                self.scheduled_reset = truthy(value)
                valid = True
        elif key == "reset_hours":
            parsed = parse_int(1, 168)
            if parsed is not None:
                self.reset_hours = parsed
                valid = True
        elif key == "cpu_freq":
            parsed = parse_int(40, 240)
            if parsed is not None:
                self.cpu_mhz = parsed
                valid = True
        elif key == "dc_blocker":
            if value in {"on", "off"}:
                self.dc_blocker_enable = truthy(value)
                valid = True
        elif key == "hp_enable":
            if value in {"on", "off"}:
                self.hp_enable = truthy(value)
                valid = True
        elif key == "hp_cutoff":
            parsed = parse_int(10, 10000)
            if parsed is not None:
                self.hp_cutoff_hz = parsed
                valid = True
        elif key == "agc_enable":
            if value in {"on", "off"}:
                self.agc_enable = truthy(value)
                valid = True
        elif key == "led_mode":
            parsed = parse_int(0, 2)
            if parsed is not None:
                self.led_mode = parsed
                valid = True
        elif key == "oh_enable":
            if value in {"on", "off"}:
                self.protection_enabled = truthy(value)
                if not self.protection_enabled:
                    self.latched = False
                    self.latched_persist = False
                    self.manual_restart = False
                valid = True
        elif key == "oh_limit":
            parsed = parse_int(30, 95)
            if parsed is not None:
                self.shutdown_c = float(parsed)
                self.latched = False
                valid = True
        elif key == "hostname":
            trimmed = value.strip()
            if 1 <= len(trimmed) <= 63:
                self.mdns_hostname = trimmed
                self.log_locked(f"UI set: hostname={trimmed}")
                self.mark_offline_locked(3.0)
                return HTTPStatus.OK, {"ok": True}
        else:
            return HTTPStatus.BAD_REQUEST, {"ok": False, "error": "unknown key"}

        if not valid:
            return HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid value"}

        self.log_locked(f"UI set: {key}={value}")
        return HTTPStatus.OK, {"ok": True}


class DevRequestHandler(BaseHTTPRequestHandler):
    server_version = "BirdNETGoDevHTTP/1.0"

    def log_message(self, _format: str, *_args: object) -> None:
        return

    @property
    def device(self) -> FakeDeviceState:
        return self.server.device  # type: ignore[attr-defined]

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        self.log_access("GET", parsed.path)

        if parsed.path.startswith("/api/"):
            self.handle_api_get(parsed)
            return

        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        self.log_access("POST", parsed.path)

        if parsed.path == "/api/thermal/clear":
            with self.device.lock:
                if time.monotonic() < self.device.offline_until:
                    self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"ok": False})
                    return
                payload = self.device.clear_thermal_latch_locked()
            self.send_json(HTTPStatus.OK, payload)
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def log_access(self, method: str, path: str) -> None:
        stamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{stamp}] {method} {path}")

    def handle_api_get(self, parsed) -> None:
        path = parsed.path
        with self.device.lock:
            if time.monotonic() < self.device.offline_until:
                self.send_json(
                    HTTPStatus.SERVICE_UNAVAILABLE,
                    {"ok": False, "error": "device rebooting"},
                )
                return

            if path == "/api/state":
                self.send_json(HTTPStatus.OK, self.device.state_payload_locked())
                return
            if path.startswith("/api/action/"):
                action = path.rsplit("/", 1)[-1]
                status, payload = self.device.handle_action_locked(action)
                self.send_json(status, payload)
                return
            if path == "/api/set":
                query = parse_qs(parsed.query, keep_blank_values=True)
                key = query.get("key", [""])[0]
                value = query.get("value", [""])[0]
                status, payload = self.device.handle_set_locked(key, value)
                self.send_json(status, payload)
                return

        self.send_error(HTTPStatus.NOT_FOUND)

    def serve_static(self, request_path: str) -> None:
        path = request_path or "/"
        if path == "/":
            path = "/index.html"

        safe_path = (WEB_ROOT / path.lstrip("/")).resolve()
        if WEB_ROOT not in safe_path.parents and safe_path != WEB_ROOT:
            self.send_error(HTTPStatus.FORBIDDEN)
            return

        if not safe_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content = safe_path.read_bytes()
        mime_type, _ = mimetypes.guess_type(str(safe_path))
        if safe_path.suffix == ".js":
            mime_type = "application/javascript; charset=utf-8"
        elif safe_path.suffix == ".css":
            mime_type = "text/css; charset=utf-8"
        elif safe_path.suffix == ".html":
            mime_type = "text/html; charset=utf-8"
        elif mime_type is None:
            mime_type = "application/octet-stream"

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, status: int, payload: dict[str, object]) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_text(self, status: int, payload: str) -> None:
        data = payload.encode("utf-8")
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Serve src/web with a fake backend for frontend development."
    )
    parser.add_argument(
        "--port",
        default=8000,
        type=int,
        help="Port to bind on 127.0.0.1. Defaults to 8000.",
    )
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), DevRequestHandler)
    server.device = FakeDeviceState()  # type: ignore[attr-defined]

    print(f"Serving frontend dev UI at http://127.0.0.1:{args.port}")
    print("Static root:", WEB_ROOT)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
