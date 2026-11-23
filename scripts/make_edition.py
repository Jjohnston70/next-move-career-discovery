#!/usr/bin/env python3
"""Create an isolated private Next Move edition from this generic source.

Example:
  python3 scripts/make_edition.py --name "Alex" --recipient-name "Coach" \
    --email "coach@example.org" --slug "alex" --output-dir "./dist"

No personal answers or remote services are involved. This script prints only paths.
"""
from pathlib import Path
import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT=Path(__file__).resolve().parents[1]
VERSION="1.3.0"


def main():
    p=argparse.ArgumentParser(description="Create a participant-specific, offline Next Move ZIP")
    p.add_argument('--name',required=True,help='Name shown on participant workbook')
    p.add_argument('--recipient-name',required=True,help='Trusted person label')
    p.add_argument('--email',required=True,help='Recipient email address for optional mail draft')
    p.add_argument('--slug',required=True,help='Unique lower-case edition identifier')
    p.add_argument('--output-dir',default='./dist')
    p.add_argument('--track',choices=['general','culinary'],default='general',help='Optional industry-specific reflection wording; does not constrain career exploration')
    opt=p.parse_args()
    if not re.fullmatch(r'[A-Za-z][A-Za-z -]{0,39}',opt.name) or not re.fullmatch(r'[A-Za-z][A-Za-z -]{0,39}',opt.recipient_name):
        p.error('Name and recipient label must use plain letters, spaces or hyphens (max 40 chars).')
    if not re.fullmatch(r'[a-z][a-z0-9-]{1,38}',opt.slug):
        p.error('Slug must be lower-case letters, digits, hyphens, 2–39 characters.')
    if not re.fullmatch(r'[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+',opt.email):
        p.error('Provide a valid recipient email address.')
    output=Path(opt.output_dir).resolve(); output.mkdir(parents=True,exist_ok=True)
    folder=output/f'Next-Move-{opt.slug}-v{VERSION}'
    if folder.exists():
        p.error(f'Folder already exists: {folder} (choose a new output directory)')
    (folder/'src').mkdir(parents=True)
    (folder/'scripts').mkdir()
    for f in (ROOT/'src').glob('*'):
        shutil.copy2(f,folder/'src'/f.name)
    shutil.copy2(ROOT/'scripts'/'build.py',folder/'scripts'/'build.py')
    app_path=folder/'src'/'app.js'
    app=app_path.read_text(encoding='utf-8')
    required={
        'const REPORT_TO = "";':f'const REPORT_TO = {json.dumps(opt.email)};',
        'const STORAGE = "next-move-template-v3";':f'const STORAGE = "next-move-{opt.slug}-v3";',
        'displayName: "Participant"':f'displayName: {json.dumps(opt.name)}',
        ' : "Participant";':f' : {json.dumps(opt.name)};',
        'There is no right answer.':f'{opt.name}, there is no right answer.',
        'someone you trust':opt.recipient_name,
        'a trusted person':opt.recipient_name,
        'placeholder="Your name"':f'placeholder="{html.escape(opt.name)}"',
    }
    for before,after in required.items():
        if before not in app:
            p.error(f'Expected source text missing: {before}')
        app=app.replace(before,after)
    app_path.write_text(app,encoding='utf-8')
    # Do not change, shorten, or reword the official O*NET Mini-IP items.
    if opt.track=='culinary':
        data_path=folder/'src'/'data.js'
        data=data_path.read_text(encoding='utf-8')
        edits={
          'If your current line of work paid well, respected your time, and gave you room to grow, would you still consider changing fields? Why?': 'If restaurant kitchens paid fairly, gave you reasonable hours, and offered room to grow, would you still want to change fields? Why?',
          'What parts of past jobs, training, school, volunteering, or personal projects did you genuinely enjoy, even if you no longer do them?': 'Thinking about culinary school, kitchen work, and any other experience: which activities did you actually enjoy, even if you would not choose that job again?'
        }
        for before,after in edits.items():
            if before not in data: p.error('Expected original reflection text is missing for culinary track.')
            data=data.replace(before,after)
        data_path.write_text(data,encoding='utf-8')
    index=folder/'src'/'index.html'
    index.write_text(index.read_text(encoding='utf-8').replace('General Edition',f'{html.escape(opt.name)} Edition'),encoding='utf-8')
    subprocess.run([sys.executable,str(folder/'scripts'/'build.py')],cwd=folder,check=True)
    # Participant ZIP intentionally ships no developer tools or code folders.
    (folder/'src').rename(folder/'_temp_src')
    shutil.rmtree(folder/'_temp_src'); shutil.rmtree(folder/'scripts')
    # Attach upstream assessment rights and 2016-versus-current-version explanation.
    shutil.copy2(ROOT/'THIRD_PARTY_NOTICES.md',folder/'THIRD_PARTY_NOTICES.md')
    (folder/'README.md').write_text(f'# Next Move - {opt.name} v{VERSION}\n\nStart with START-HERE.html. Everything runs locally. The 30-item O*NET Mini-IP is the published 2016 version, not the latest online site. The official materials have their own license; see THIRD_PARTY_NOTICES.md.\n\nSharing is optional and opens an email draft to a trusted recipient. The participant presses Send.\n',encoding='utf-8')
    (folder/'START-HERE.txt').write_text(f"""NEXT MOVE - {opt.name.upper()}\n\n1. Extract this ZIP to your computer.\n2. Open Next-Move.html in Chrome, Edge or Safari.\n3. Read the Read this first section.\n4. Decide if you want device saving; it is off by default.\n5. Answer questions and explore careers at your own pace.\n6. Finish & share is OPTIONAL. Review summary vs full report, approve, then your email application opens an email draft to {opt.email}. You must click Send. Full reports need manual attachment.\n7. Take the published 2016 O*NET Mini Interest Profiler inside the app to see your six interest-area scores. The current official online assessment may be different.
8. Optional: download and import official O*NET 31.0 JSON files to browse occupations. These files are not bundled.
9. Don't enter sensitive records or passwords. The custom workbook is not a professional aptitude or psychological test.\n""",encoding='utf-8')
    guide = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Next Move - Start Here</title><style>body{{background:#081521;color:#eaf4f9;font:17px/1.6 system-ui,sans-serif;margin:0;padding:30px}}main{{max-width:720px;margin:auto}}h1{{color:#8bd1ea}}a{{color:#8bd1ea}}.go{{display:inline-block;background:#3d8eb9;color:#081521;padding:12px 18px;border-radius:9px;font-weight:bold}}</style></head><body><main><h1>Next Move - {html.escape(opt.name)}</h1><p>Private career discovery, no grades or assigned career. You choose what to share.</p><p><a class="go" href="Next-Move.html">Open my workbook</a></p><ol><li>Read the Read this first menu.</li><li>Decide whether to turn on local device saving. It is off by default.</li><li>Answer questions, explore careers and test small ideas at your own pace.</li><li>Take the published 2016 O*NET Mini Interest Profiler inside the app and see your six interest-area results. This is not the current online item bank.</li><li>You may optionally import official O*NET 31.0 occupation JSON files using the links in the app.</li><li>Review your report. You do not have to share it.</li><li>If you want, choose Finish &amp; share, read the preview, confirm consent and prepare an email draft to {html.escape(opt.recipient_name)}. You still press Send in your email app. Full reports need manual attachment.</li></ol><p>Do not enter passwords, health records, government IDs or confidential employer data. The app does not assign you a career. It contains the research-based 2016 O*NET Mini Interest Profiler and separate, informal TNDS prompts. See THIRD_PARTY_NOTICES.md for O*NET terms.</p><p>Also see START-HERE.txt for a plain-text guide.</p></main></body></html>"""
    (folder/'START-HERE.html').write_text(guide,encoding='utf-8')
    zip_path=output/(folder.name+'.zip')
    with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for f in folder.rglob('*'):
            if f.is_file(): z.write(f,folder.name+'/'+f.relative_to(folder).as_posix())
    print(f'[Next Move] Generated private edition: {zip_path}')
    print(f'[Next Move] Recipient: configured, not contacted. No responses processed.')

if __name__=='__main__': main()
