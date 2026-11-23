# v1.3.0 release QA - November 22, 2026

## Passed checks

- Python offline bundler rebuilt `Next-Move.html` deterministically from `src/`.
- JavaScript syntax checks passed for `src/data.js` and `src/app.js`.
- 30 published 2016 O*NET Mini-IP questions, six 0-20 interest scores, result display, and report inclusion tested using synthetic answers.
- O*NET 31.0 JSON import exercised using synthetic local occupational records; no live O*NET API was called.
- Questionnaire, values ranking, work preferences, reasoning scenarios, career browsing/shortlisting, real-world experiment log, report, backup/restore, and reset passed Chromium smoke tests.
- 375px mobile layout had no page-level horizontal overflow in browser checks.
- Browser tests observed zero remote network requests and no uncaught JavaScript errors.
- GitHub public-source package excludes `catalog/`, `optional-hosting/`, fixed family email recipients, participant names, and participant responses.
- Private catalog assertions passed (unpublished store, manual-review-only Revenue Recon adapter, no generic app recipient).

## Not tested or not claimed

- O*NET API live data access (not implemented), hosted email delivery (not activated), or official O*NET occupation career matching (not provided).
- Complete accessibility or penetration test, or a legal determination about a particular commercial distribution.
- The GitHub public repo **has not been created or pushed**; this package is upload-ready only.
- The user's local Mac Downloads folder has not been modified; installation requires user download and extraction.

## Rights

The Mini-IP content comes from the published **2016** O*NET Interest Profiler source. `THIRD_PARTY_NOTICES.md` documents the separate O*NET Tools Developer License. O*NET occupation files are not bundled; optional downloads are O*NET 31.0 Database / CC BY 4.0. TNDS-created source is currently source-visible and all rights reserved, not MIT-licensed.
