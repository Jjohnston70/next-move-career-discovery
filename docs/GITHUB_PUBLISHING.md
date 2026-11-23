# GitHub publication — clean source repository

**Important:** This ZIP is **ready to put in a public GitHub repository**. No GitHub repository was created, edited or published by generating the ZIP.

## Web method (no terminal needed)

1. Download and **extract** the public-source ZIP. The ZIP itself is not the repository: its contents are.
2. On GitHub, create a **new PUBLIC repository** named `next-move-career-discovery` (or another name you prefer). Do not prepopulate it with a license that may mislicense O*NET content.
3. Upload the **files and folders inside** `next-move-career-discovery` (not your private master ZIP, participant editions, backups, or catalog).
4. Confirm the root shows `README.md`, `LICENSE.md`, `THIRD_PARTY_NOTICES.md`, `Next-Move.html`, `src/`, `scripts/`, `tests/`, and `.github/`.
5. Review the automatic GitHub Actions checks. Do not enable Issues for uploading completed assessments; remind contributors that real answers and secrets must never be posted.

## Command-line alternative (GitHub CLI installed and authorized)

```bash
cd "$HOME/Downloads/next-move-career-discovery"
git init
# Review which files will be made public before staging.
git status --short
# Commit only after manually reviewing README, license and contents.
git add .
git commit -m "Release Next Move v1.3.0 public source with O*NET notices"
git branch -M main
gh repo create Jjohnston70/next-move-career-discovery --public --source . --remote origin --push
```

That last command **makes the repository public**. Do not run until ready to publish; no future step can guarantee that already-published content was not copied.

## Upstream license boundaries

- TNDS-created source is currently source-visible and **all rights reserved**. This is not MIT, Apache or any other open-source grant.
- Published 2016 O*NET Mini-IP content is separately licensed under the O*NET Tools Developer License. Retain `THIRD_PARTY_NOTICES.md` and the in-app attribution. Changes to assessment content, purpose or scoring require a specific license and validation review.
- Optional O*NET 31.0 occupation files remain unbundled; separately licensed under CC BY 4.0.
- Current app is offline; no live O*NET API integration. Remote API keys must never be committed.

## Public GitHub Pages website (optional)

A public repo does not automatically publish a website. If you choose GitHub Pages, configure it separately. Public visitors will contact GitHub to load the site, although the app itself does not transmit responses. Read GitHub Pages' current privacy and deployment documentation before enabling public hosting.
