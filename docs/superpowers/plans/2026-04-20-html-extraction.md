# HTML Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract embedded HTML/CSS/JS from `WebUI.cpp` into a standalone `src/web/index.html`, with a PlatformIO pre-build Python script that regenerates a C header at build time; simultaneously remove the server-side hostname injection by populating the RTSP URL span via the existing XHR status call.

**Architecture:** A one-time extraction script produces `src/web/index.html` from the current C string literals. An ongoing `tools/embed_html.py` pre-build script reads that file and writes `src/webui_html.h` as a C raw-string-literal constant. `WebUI.cpp`'s `httpIndex()` includes the generated header and serves it in a single `sendContent_P` call. The `mdnsHostname` dynamic injection is removed; `loadStatus()` in JS populates the RTSP URL span from `j.mdns_hostname` instead.

**Tech Stack:** Python 3, PlatformIO `extra_scripts`, C++11 raw string literals, ESP32 Arduino WebServer

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `tools/extract_html.py` | One-time: parse C string literals from WebUI.cpp → `src/web/index.html` |
| Create | `src/web/index.html` | Canonical editable HTML source (output of extraction) |
| Create | `tools/embed_html.py` | Pre-build: `src/web/index.html` → `src/webui_html.h` |
| Create (generated) | `src/webui_html.h` | Build artifact: `static const char WEBUI_HTML[] PROGMEM = R"WEBUI(...)WEBUI";` |
| Modify | `platformio.ini` | Add `extra_scripts = pre:tools/embed_html.py` |
| Modify | `src/WebUI.cpp` | `#include "webui_html.h"`, simplify `httpIndex()`, add RTSP URL to `loadStatus()` JS |
| Modify | `.gitignore` | Add `src/webui_html.h` |

---

## Task 1: Write and run the one-time HTML extraction script

**Files:**
- Create: `tools/extract_html.py`
- Create (output): `src/web/index.html`

- [ ] **Step 1: Create tools/ directory and write extraction script**

```python
# tools/extract_html.py
#!/usr/bin/env python3
"""One-time: extract embedded HTML from WebUI.cpp -> src/web/index.html"""
import re, os

with open('src/WebUI.cpp', 'r', encoding='utf-8') as f:
    source = f.read()

def unescape_c(s):
    result, i = [], 0
    while i < len(s):
        if s[i] == '\\' and i + 1 < len(s):
            c = s[i+1]
            mapping = {'n': '\n', 't': '\t', '"': '"', "'": "'", '\\': '\\', '?': '?', 'r': '\r'}
            result.append(mapping.get(c, s[i] + c))
            i += 2
        else:
            result.append(s[i])
            i += 1
    return ''.join(result)

# Find httpIndex() body
match = re.search(r'static void httpIndex\(\)\s*\{(.+?)\n\}', source, re.DOTALL)
func_body = match.group(1)

# Extract content from PSTR(...) blocks (the HTML) — skip dynamic sendContent(mdnsHostname...)
# Also capture the <!doctype html> from the F("<!doctype html>") send call
segments = []

# Doctype from web.send(..., F("<!doctype html>"))
dt = re.search(r'F\("(<!doctype html>)"\)', func_body)
if dt:
    segments.append(dt.group(1))

# All PSTR blocks
for pstr_match in re.finditer(r'PSTR\s*\(\s*((?:"(?:[^"\\]|\\.)*"\s*\n?)+)\s*\)', func_body, re.DOTALL):
    block = pstr_match.group(1)
    for lit in re.finditer(r'"((?:[^"\\]|\\.)*)"', block):
        segments.append(unescape_c(lit.group(1)))

html = ''.join(segments)

# XHR change: the dynamic hostname injection split the HTML around the RTSP URL.
# After joining PSTR blocks we get: rtsp://:8554/audio
# Replace the split artifact with an empty span (JS will populate it).
html = html.replace(
    "<span id='rtsp' class='mono'>rtsp://:8554/audio</span>",
    "<span id='rtsp' class='mono'></span>"
)

os.makedirs('src/web', exist_ok=True)
with open('src/web/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Extracted {len(html)} bytes -> src/web/index.html")
```

- [ ] **Step 2: Run the extraction script**

```bash
cd /Users/alex.jurkiewicz/personal/birdnetgo-m5stack-atom-echo-rtsp-mic
python3 tools/extract_html.py
```

Expected output: `Extracted NNNNN bytes -> src/web/index.html`

- [ ] **Step 3: Verify the RTSP span is correctly simplified**

```bash
grep "id='rtsp'" src/web/index.html
```

Expected: `<span id='rtsp' class='mono'></span>` — no URL content inline.

- [ ] **Step 4: Verify doctype is present**

```bash
head -c 20 src/web/index.html
```

Expected: starts with `<!doctype html>`

---

## Task 2: Add RTSP URL population to loadStatus() in the HTML

**Files:**
- Modify: `src/web/index.html` (the `loadStatus` JS function)

The current `loadStatus()` already has `j.mdns_hostname` at the end:
```js
const hn=$('in_hostname'); if(hn && j.mdns_hostname && document.activeElement!==hn) hn.value=j.mdns_hostname;
```

- [ ] **Step 1: Add RTSP URL update inside loadStatus()**

In `src/web/index.html`, find the line:
```
const hn=$('in_hostname'); if(hn && j.mdns_hostname && document.activeElement!==hn) hn.value=j.mdns_hostname;
```

Add immediately after it (still inside the `.then(j=>{...})` callback, before `})`):
```js
const rtsp=$('rtsp'); if(rtsp && j.mdns_hostname) rtsp.textContent='rtsp://'+j.mdns_hostname+'.local:8554/audio';
```

The resulting end of `loadStatus()` should look like:
```js
...const hn=$('in_hostname'); if(hn && j.mdns_hostname && document.activeElement!==hn) hn.value=j.mdns_hostname; const rtsp=$('rtsp'); if(rtsp && j.mdns_hostname) rtsp.textContent='rtsp://'+j.mdns_hostname+'.local:8554/audio'; })}
```

- [ ] **Step 2: Verify the change looks correct**

```bash
grep -o "rtsp.*local:8554/audio" src/web/index.html
```

Expected: `rtsp://'+j.mdns_hostname+'.local:8554/audio`

---

## Task 3: Write the ongoing embed pre-build script

**Files:**
- Create: `tools/embed_html.py`

- [ ] **Step 1: Write embed_html.py**

```python
# tools/embed_html.py
Import("env")
import os

proj = env["PROJECT_DIR"]
html_path = os.path.join(proj, "src", "web", "index.html")
out_path  = os.path.join(proj, "src", "webui_html.h")

with open(html_path, "r", encoding="utf-8") as f:
    content = f.read()

# Safety check: raw string delimiter must not appear in content
delimiter = "WEBUI"
assert f"){delimiter}\"" not in content, f'HTML contains raw-string-closing delimiter ){delimiter}"'

with open(out_path, "w", encoding="utf-8") as f:
    f.write("#pragma once\n")
    f.write(f'static const char WEBUI_HTML[] PROGMEM = R"{delimiter}(\n')
    f.write(content)
    f.write(f'\n){delimiter}";\n')

print(f"embed_html: wrote {len(content)} bytes -> {os.path.relpath(out_path, proj)}")
```

Note: `Import("env")` is the PlatformIO SConstruct API — this is required for `extra_scripts`.

- [ ] **Step 2: Verify the script is syntactically valid**

```bash
python3 -c "
import ast, sys
with open('tools/embed_html.py') as f:
    src = f.read()
# Strip PlatformIO-specific Import() line before checking syntax
src = src.replace('Import(\"env\")', 'env={\"PROJECT_DIR\":\".\"}')
ast.parse(src)
print('syntax OK')
"
```

Expected: `syntax OK`

---

## Task 4: Update platformio.ini

**Files:**
- Modify: `platformio.ini`

- [ ] **Step 1: Add extra_scripts to [env:m5stack-atom]**

In `platformio.ini`, add after `lib_deps`:
```ini
extra_scripts = pre:tools/embed_html.py
```

Final `platformio.ini` should look like:
```ini
[env:m5stack-atom]
platform = espressif32@6.13.0
board = m5stack-atom
framework = arduino
monitor_speed = 115200
upload_speed = 115200
build_flags =
    -DCORE_DEBUG_LEVEL=4
board_build.partitions = partitions.csv
lib_deps =
    tzapu/WiFiManager @ ^2.0.17
    m5stack/M5Atom @ ^0.1.3
    fastled/FastLED @ ^3.10.3
extra_scripts = pre:tools/embed_html.py
```

---

## Task 5: Update WebUI.cpp

**Files:**
- Modify: `src/WebUI.cpp` lines 1-10 (add include), lines 137-310 (replace httpIndex)

- [ ] **Step 1: Add include for generated header**

After `#include "WebUI.h"` (line 6), add:
```cpp
#include "webui_html.h"
```

- [ ] **Step 2: Replace httpIndex() body**

Replace the entire `httpIndex()` function (lines 137–310) with:
```cpp
static void httpIndex() {
    lastNetworkActivity = millis();
    web.setContentLength(CONTENT_LENGTH_UNKNOWN);
    web.send(200, "text/html; charset=utf-8", "");
    web.sendContent_P(WEBUI_HTML);
    web.sendContent("", 0);
}
```

- [ ] **Step 3: Run a test build to confirm compilation**

```bash
pio run 2>&1 | tail -20
```

Expected: `SUCCESS` with no errors. The pre-build script will auto-generate `src/webui_html.h` before compiling.

---

## Task 6: Update .gitignore and commit

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add generated header to .gitignore**

Add to `.gitignore`:
```
src/webui_html.h
```

- [ ] **Step 2: Commit everything except the generated file**

```bash
git add src/web/index.html tools/extract_html.py tools/embed_html.py platformio.ini src/WebUI.cpp .gitignore
git commit -m "refactor: extract embedded HTML to src/web/index.html with pre-build embed script"
```

---

## Self-Review

**Spec coverage:**
- ✅ HTML extracted to standalone file
- ✅ XHR hostname (no server-side injection)
- ✅ Python preprocessing step generates C header
- ✅ PlatformIO `extra_scripts` integration
- ✅ `src/webui_html.h` is a gitignored build artifact
- ✅ Minimal complexity — no new dependencies, ~25-line embed script

**Placeholder scan:** No TBDs or vague steps found.

**Type consistency:** `WEBUI_HTML` used in Task 3 (embed script) and Task 5 (WebUI.cpp) consistently.

**Edge case — raw string delimiter:** The embed script asserts `)WEBUI"` is absent from the HTML content. The JavaScript in the HTML has no such sequence.

**Edge case — `??` trigraph:** Raw string literals (`R"WEBUI(...)WEBUI"`) do not process trigraphs, so `??` in the JS nullish coalescing operator passes through correctly.
