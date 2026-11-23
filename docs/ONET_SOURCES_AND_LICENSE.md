# Third-party notices and content boundaries — Next Move v1.3.0

**Scope:** Reusable TNDS source template, published 2016 Mini Interest Profiler, and optional O*NET 31.0 occupation JSON import. This is a rights notice, not an endorsement or legal opinion.

## 1. O*NET Career Exploration Tools — Interest Profiler

This application includes information from the **O*NET Career Exploration Tools** by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the [O*NET Tools Developer License](https://www.onetcenter.org/license_toolsdev.html). **O*NET® is a trademark of USDOL/ETA.**

- Assessment source: [Development of an O*NET Mini Interest Profiler (Mini-IP) for Mobile Devices (2016)](https://www.onetcenter.org/dl_files/Mini-IP.pdf).
- This includes the **published 2016 set of 30 work activities, unchanged in wording/order** and the five-category-item sums for each of six RIASEC interest areas. UI ratings 1–5 are converted to 0–4 before adding them, yielding six scores of 0–20.
- TNDS controls only the presentation, offline storage, wording of accompanying **original** questions, privacy controls and illustrative career exploration. TNDS does not claim that its illustrative career suggestions are official O*NET matches.
- The official online assessment was updated in October 2025. **Do not describe the bundled 2016 items as the current official website question bank.** [Current online assessment](https://onetinterestprofiler.org/).
- The published source item bank and score method are **not covered by a TNDS-only software license**. Recipients receive rights to this third-party content under its applicable O*NET license.
- USDOL/ETA has **not approved, endorsed or tested** the TNDS Next Move application.

**Modification/validation condition:** The Developer License §3 requires validation studies for changes to assessment content or purpose. Software-only changes that integrate the tools are excluded from the specified content-modification validation rule. Anyone editing activity wording, response options, scoring, number of items, intended use, or using the profiler to screen candidates must stop and review the license and required validation before release.

References: [Career Exploration Tools License Options](https://www.onetcenter.org/license_tools.html) · [O*NET Tools Developer License](https://www.onetcenter.org/license_toolsdev.html)

## 2. O*NET 31.0 Database — optional, independently licensed

The app **does not bundle** the full O*NET 31.0 Database. Users may explicitly download selected official O*NET 31.0 JSON files and import them locally. The database is available under **Creative Commons Attribution 4.0 International (CC BY 4.0)**, subject to stated license exceptions and the obligation to credit USDOL/ETA, provide the license, and indicate alterations where made.

Sources:
- [O*NET 31.0 Database License](https://www.onetcenter.org/license_db.html)
- [Career Interest Types](https://www.onetcenter.org/dl_files/database/db_31_0_json/career_interest_types.json)
- [Occupation Data](https://www.onetcenter.org/dl_files/database/db_31_0_json/occupation_data.json)
- [Job Zones](https://www.onetcenter.org/dl_files/database/db_31_0_json/job_zones.json)

The local occupation sorter is a **TNDS-created illustrative cosine-similarity ordering**, not an O*NET career matching service, validated prediction, or official ranking. Scores for published 2016 Mini-IP are not guaranteed to be norm-equivalent to O*NET 31.0 occupational interest profiles.

## 3. O*NET Web Services — NOT included in the offline build

This version **does not call O*NET Web Services** and contains no O*NET API username, password, client key, secret, or cookie. A future developer who adds a live API connection must review [Web Services Terms](https://services.onetcenter.org/terms) and [Web Services Data License](https://services.onetcenter.org/help/license_data), register the application and keep keys out of public repository/browser source. Paid or registration-required applications require special attention to their free-public-access rule or permission condition.

## 4. TNDS-owned content and code

The original Next Move questionnaire, fictional examples, explanatory text, interface, email consent controls, and scripts are TNDS material. **No TNDS open-source software redistribution license has been selected for this public-source release.** A public GitHub repository can be made visible without selecting an open-source license, but third parties then receive no general permission to copy, modify, or redistribute TNDS code. If the owner chooses MIT or another license, the chosen license applies only to TNDS rights and must expressly exclude O*NET source assessment material and any other third-party content.

## 5. Privacy and presentation

- No family-specific profiles, private responses, personal backups, or configured recipient address are included in this generic catalog master.
- Browser storage is opt-in and **not encrypted** on-device; encrypted backups are a separate voluntary feature when supported.
- Local-mode email only prepares a draft; the participant must explicitly confirm and send it. Hosted email code is disabled and has not been penetration-tested.
- Do not state that TNDS, USDOL, or O*NET guarantees career outcomes, aptitude, hiring fitness, or placement.
- Report any suspected license or attribution issue before public or store distribution.

Owner: True North Data Strategies LLC
