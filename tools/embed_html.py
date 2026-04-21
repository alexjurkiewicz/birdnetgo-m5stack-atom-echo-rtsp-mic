Import("env")
import os
import re


proj = env["PROJECT_DIR"]
web_dir = os.path.join(proj, "src", "web")
html_path = os.path.join(web_dir, "index.html")
css_path = os.path.join(web_dir, "style.css")
js_path = os.path.join(web_dir, "app.js")
out_path = os.path.join(proj, "src", "webui_html.h")


def read_text(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def inline_web_assets(html, css, js):
    html, css_count = re.subn(
        r'<link\s+rel="stylesheet"\s+href="style\.css"\s*/>',
        lambda _: "<style>\n" + css.rstrip() + "\n    </style>",
        html,
        count=1,
    )
    html, js_count = re.subn(
        r'<script\s+src="app\.js"></script>',
        lambda _: "<script>\n" + js.rstrip() + "\n    </script>",
        html,
        count=1,
    )
    if css_count != 1:
        raise AssertionError("embed_html: expected one stylesheet link for style.css")
    if js_count != 1:
        raise AssertionError("embed_html: expected one script tag for app.js")
    return html


content = inline_web_assets(
    read_text(html_path),
    read_text(css_path),
    read_text(js_path),
)

delimiter = "WEBUI"
assert f"){delimiter}\"" not in content, f'HTML contains raw-string-closing delimiter ){delimiter}"'

with open(out_path, "w", encoding="utf-8") as f:
    f.write("#pragma once\n")
    f.write(f'static const char WEBUI_HTML[] PROGMEM = R"{delimiter}(\n')
    f.write(content)
    f.write(f'\n){delimiter}";\n')

print(
    "embed_html: wrote "
    f"{len(content)} bytes with inlined CSS/JS -> {os.path.relpath(out_path, proj)}"
)
