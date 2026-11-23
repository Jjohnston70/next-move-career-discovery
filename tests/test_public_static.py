#!/usr/bin/env python3
"""Verify public-source build invariants without loading any real user responses.

Comments and diagnostic output contain no personal questionnaire data.
"""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'Next-Move.html').read_text(encoding='utf-8')
source=(ROOT/'src/app.js').read_text(encoding='utf-8')
data=(ROOT/'src/data.js').read_text(encoding='utf-8')

checks={
 'Generic app has no pre-configured family recipient':'const REPORT_TO = "";' in source,
 'Network disabled in standalone app':"connect-src 'none'" in app,
 'Hosted email disabled':'emailApiEnabled: false' in app,
 'O*NET Mini-IP has 30 activities':len(re.findall(r'"id":\d+,"area":"[RIASEC]","text":"',data))==30,
 'O*NET source referenced': 'Mini-IP.pdf' in data,
 'O*NET Developer License linked in bundled app':'license_toolsdev.html' in app,
 'O*NET notice included':(ROOT/'THIRD_PARTY_NOTICES.md').exists(),
 'TNDS rights separated':(ROOT/'LICENSE.md').exists(),
 'GitHub publication guide present':(ROOT/'docs/GITHUB_PUBLISHING.md').exists(),
 'No family names in app':all(x not in app for x in ('Nicholas','Tristan','jacob@truenorthstrategyops.com')),
 'No optional sender included':not (ROOT/'optional-hosting').exists(),
 'No internal private catalog included':not (ROOT/'catalog').exists(),
}
for label,ok in checks.items():
    print(('[PASS] ' if ok else '[FAIL] ')+label)
if not all(checks.values()):
    raise SystemExit('Public release checks failed')
print('[PASS] All public release invariants passed; no personal answers processed')
