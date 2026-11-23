## What changed?

Explain the change and how to verify it. Use fictional input data only.

## Safety and release checks

- [ ] Changes contain no real participant answers, reports, contact details, or secrets.
- [ ] Original TNDS questions remain distinct from O*NET assessment material.
- [ ] No O*NET item wording, order, scoring, response options, or intended use was
      changed without separate licensing and validation review.
- [ ] `python3 scripts/build.py` completed.
- [ ] `node --check src/data.js` and `node --check src/app.js` passed.
- [ ] `python3 tests/test_public_static.py` passed.
- [ ] If user-facing behavior changed, `CHANGELOG.md` and relevant docs were updated.
- [ ] Permissions and data flows were checked; no unexpected network or analytics calls.

**Contribution rights:** Original TNDS source is currently all rights reserved.
Proposing a patch does not grant permission to republish or redistribute it.
Please contact the owner before making substantial source changes.
