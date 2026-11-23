# Changelog

All notable changes to the public **Next Move - Career Discovery** application
are documented here. Version numbers follow semantic versioning conventions.

This log describes software releases and does not claim that O*NET, USDOL/ETA,
or another third party has reviewed, approved, or endorsed Next Move.

## [Unreleased]

### Planned / not released
- No new functionality has been approved. Ideas are tracked separately from releases.

## [1.3.0] - 2026-11-22

### Added
- Embedded the **published 2016 O*NET Mini Interest Profiler** with its 30
  activities, six RIASEC interest totals, attribution, and source/version labels.
- Optional local import of selected O*NET 31.0 occupation JSON files, with
  illustrative career exploration ordering rather than official job matching.
- Distinct licensing notices for the TNDS source code and O*NET material.
- Public-source packaging, release integrity checks, static test workflow,
  user guidance, security guidance, and contribution guidance.

### Notes
- Standalone app remains offline-capable and does not call O*NET Web Services.
- O*NET sources are separately licensed; see `THIRD_PARTY_NOTICES.md`.
- The publicly visible original TNDS code has no general open-source license.

## [1.2.0] - 2026-11-22

### Added
- Reusable, industry-neutral master template and edition generator.
- Catalog metadata and a manual-review integration proposal in the separate
  **private** TNDS master package (not included in public distributions).
- Standalone participant distribution packages and browser-friendly guides.

## [1.1.0] - 2026-11-22

### Added
- More detailed participant onboarding and usage guidance.
- Voluntary report-sharing flow with explicit consent and preview controls.
- Email-draft workflow, without automatic sending or a configured recipient
  in the generic master edition.

## [1.0.0] - 2026-11-22

### Added
- First offline-capable Next Move experience: original career reflections,
  reasoning scenarios, career browsing, short experiments, and personal report.
- Participant-controlled saving, reset, print, and export/import.
- Clear distinction between exploration prompts and validated assessments.

---

**Release integrity:** Refer to `RELEASE-MANIFEST.json` for the current
product version and `SHA256SUMS.txt` for packaged file hashes. Neither file
is proof of legal compliance or official O*NET validation.
