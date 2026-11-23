# Public GitHub release checklist

**Maintainer:** True North Data Strategies LLC  
**Project:** Next Move - Career Discovery  
**Current public-source release:** v1.3.0  
**Publication status:** Requires a deliberate owner action; packaging does not publish.

## Purpose

Confirm the release is safe to make public, reconstructable from source, and
correctly attributed. A public repository is **not** a claim of open-source
licensing or government endorsement.

## Overview

- Public repo: generic source only, no family-specific editions or user data.
- Source rights: TNDS original code remains all rights reserved unless owner
  explicitly selects a different license.
- O*NET: separate Developer License; preserve notices, version attribution,
  and assessment item/scoring controls.
- No hosted email service, secrets, real assessments, or TNDS private catalog.

## Process

### 1. Inspect the source and history

- Check the exact list of tracked files with `git status --short` and
  `git ls-files` before pushing. `git status` does not inspect all old commits.
- Review **every commit** intended for publication, not just the working tree.
  If older commits contain sensitive data, start with a clean public history
  rather than publishing and trying to remove them later.
- Do not add family-specific ZIPs, real participant backups, tokens,
  `.env` files, local report exports, or private TNDS catalog files.

### 2. Verify build and tests

```bash
python3 scripts/build.py
node --check src/data.js
node --check src/app.js
python3 tests/test_public_static.py
python3 -m json.tool RELEASE-MANIFEST.json > /dev/null
```

Optional (requires Python Playwright and Chromium):

```bash
python3 tests/smoke_test.py
python3 tests/test_onet_v130.py
```

The project GitHub Action performs offline build/source checks. The browser
checks need additional browser dependencies and do not run automatically.

### 3. Verify attribution and licensing

- Keep `LICENSE.md` and `THIRD_PARTY_NOTICES.md` unchanged unless reviewed.
- Ensure in-app O*NET credit and disclaimer display properly.
- Name the **published 2016 Mini Interest Profiler** accurately; do not claim
  that it is the same as the current official online questionnaire.
- Recheck any changes to assessment items, answer choices, scoring or purpose
  against the [O*NET Tools Developer License](https://www.onetcenter.org/license_toolsdev.html).
- Confirm no third-party occupation database was accidentally bundled.
- Assess commercial/store licensing separately before charging for access.

### 4. Verify privacy and security

- Verify saving is opt-in and participant data stays local by default.
- Test export, restore, deletion, and optional email draft with **fake data**.
- Verify the app does not send participant answers over a network.
- Enable GitHub secret scanning and push protection where available.
- Do not post security vulnerabilities or personal responses as public issues.
- Confirm any screenshots contain synthetic data only.

### 5. Release deliberately

- Update `CHANGELOG.md` when a behavior or interface changes.
- Update the product version in source, package metadata, and manifest for a
  real new software release; verify their consistency.
- Recompute `SHA256SUMS.txt` whenever packaged files change.
- Review GitHub Actions results before tagging a release.
- Publish a version tag (for example, `v1.3.0`) only when approved.
- A GitHub repository is not automatically a hosted site. GitHub Pages is a
  separate decision and would require a suitable entry page and review.

## Decision points

**If the TNDS license is not final:** Public source may still be visible, but
explicitly describe the project as 'source available, all rights reserved',
not an OSI-approved open-source project.

**If a real person's information enters a commit:** Stop publication and
remove it from the proposed history; do not rely on `.gitignore` or a later
commit to make previously committed information private.

**If O*NET assessment content has been changed:** Hold release pending a
license and validation review; do not assume it is an approved instrument.

## Tools and resources

- GitHub community profile: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories
- GitHub security settings: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository
- O*NET Tools licensing: https://www.onetcenter.org/license_tools.html
- O*NET Tools Developer License: https://www.onetcenter.org/license_toolsdev.html
