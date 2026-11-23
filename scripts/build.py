#!/usr/bin/env python3
"""Create a bundled Next Move app from source without outside libraries.

Usage:
    python3 scripts/build.py                 # Offline-safe standalone HTML
    python3 scripts/build.py --hosted-email  # Optional Vercel public/index.html

This script never reads or logs questionnaire answers or makes network calls.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
hosted = "--hosted-email" in sys.argv[1:]
OUTPUT = ROOT / "public" / "index.html" if hosted else ROOT / "Next-Move.html"

html = (SRC / "index.html").read_text(encoding="utf-8")
css = (SRC / "styles.css").read_text(encoding="utf-8")
data_js = (SRC / "data.js").read_text(encoding="utf-8")
app_js = (SRC / "app.js").read_text(encoding="utf-8")

# Single-file bundle loads scripts at end of <body>, after UI elements exist.
html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}\n</style>')
html = html.replace('  <script src="data.js" defer></script>\n', '')
html = html.replace('  <script src="app.js" defer></script>\n', '')
if hosted:
    # Network requests remain blocked by default in the offline build.
    html = html.replace('emailApiEnabled: false', 'emailApiEnabled: true')
    html = html.replace("connect-src 'none'", "connect-src 'self'")
html = html.replace('</body>', f'<script>\n{data_js}\n</script>\n<script>\n{app_js}\n</script>\n</body>')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(html, encoding='utf-8')

print(f"[Next Move] Built {'hosted opt-in email' if hosted else 'offline'} app: {OUTPUT}")
print(f"[Next Move] Output bytes: {OUTPUT.stat().st_size}")
