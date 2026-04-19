#!/usr/bin/env python3
"""
Persistent ESP32 serial logger. Appends to LOG_FILE forever, surviving device resets.

Usage:
    python3 scripts/serial_logger.py &          # start in background
    : > /tmp/esp32.log                          # empty the log
    kill $(cat /tmp/esp32_logger.pid)           # stop

NOTE: Stop this before flashing firmware — pio upload needs exclusive port access.
"""

import serial, sys, time, os, signal

PORT     = "/dev/cu.usbserial-E552C67239"
BAUD     = 115200
LOG_FILE = "/tmp/esp32.log"
PID_FILE = "/tmp/esp32_logger.pid"

with open(PID_FILE, "w") as f:
    f.write(str(os.getpid()))

def cleanup(sig=None, frame=None):
    try: os.unlink(PID_FILE)
    except: pass
    sys.exit(0)

signal.signal(signal.SIGTERM, cleanup)
signal.signal(signal.SIGINT, cleanup)

def open_port():
    while True:
        try:
            return serial.Serial(PORT, BAUD, timeout=0.5)
        except Exception:
            time.sleep(0.2)

print(f"Logging {PORT} → {LOG_FILE}  (PID {os.getpid()})", flush=True)

s = open_port()
log = open(LOG_FILE, "a")

while True:
    try:
        data = s.read(256)
        if data:
            text = data.decode("utf-8", errors="replace")
            sys.stdout.write(text)
            sys.stdout.flush()
            log.write(text)
            log.flush()
    except Exception:
        try: s.close()
        except: pass
        time.sleep(0.1)
        s = open_port()
