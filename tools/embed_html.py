Import("env")
import os

proj = env["PROJECT_DIR"]
html_path = os.path.join(proj, "src", "web", "index.html")
out_path  = os.path.join(proj, "src", "webui_html.h")

with open(html_path, "r", encoding="utf-8") as f:
    content = f.read()

delimiter = "WEBUI"
assert f"){delimiter}\"" not in content, f'HTML contains raw-string-closing delimiter ){delimiter}"'

with open(out_path, "w", encoding="utf-8") as f:
    f.write("#pragma once\n")
    f.write(f'static const char WEBUI_HTML[] PROGMEM = R"{delimiter}(\n')
    f.write(content)
    f.write(f'\n){delimiter}";\n')

print(f"embed_html: wrote {len(content)} bytes -> {os.path.relpath(out_path, proj)}")
