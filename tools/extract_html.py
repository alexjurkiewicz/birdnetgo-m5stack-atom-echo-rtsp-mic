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

# Doctype from web.send(..., F("<!doctype html>"))
segments = []
dt = re.search(r'F\("(<!doctype html>)"\)', func_body)
if dt:
    segments.append(dt.group(1))

# All PSTR blocks
for pstr_match in re.finditer(r'PSTR\s*\(\s*((?:"(?:[^"\\]|\\.)*"\s*\n?)+)\s*\)', func_body, re.DOTALL):
    block = pstr_match.group(1)
    for lit in re.finditer(r'"((?:[^"\\]|\\.)*)"', block):
        segments.append(unescape_c(lit.group(1)))

html = ''.join(segments)

# XHR change: the dynamic hostname injection split the HTML at the RTSP URL span.
# After joining PSTR blocks we get: <span id='rtsp' class='mono'>rtsp://:8554/audio</span>
# Replace with empty span — JS will populate it via loadStatus().
html = html.replace(
    "<span id='rtsp' class='mono'>rtsp://:8554/audio</span>",
    "<span id='rtsp' class='mono'></span>"
)

os.makedirs('src/web', exist_ok=True)
with open('src/web/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Extracted {len(html)} bytes -> src/web/index.html")
