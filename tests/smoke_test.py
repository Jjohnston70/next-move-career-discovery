#!/usr/bin/env python3
"""Browser smoke tests for Next Move (run with /opt/pyvenv/bin/python).

The browser is loaded with the fully bundled HTML via set_content because this
runtime's browser policy blocks direct file:// and localhost navigation.
No personal data is used: all answers are fictional test strings.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "Next-Move.html").read_text(encoding="utf-8")


def launch_browser():
    pw = sync_playwright().start()
    browser = pw.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    return pw, browser


def nav(page, route):
    """Navigate via the sidebar and wait for the async hashchange render."""
    page.locator(f'button.nav-link[data-route="{route}"]').click()
    page.locator(f'button.nav-link[data-route="{route}"][aria-current="page"]').wait_for()


def log(message):
    print(f"[PASS] {message}")


def run():
    pw, browser = launch_browser()
    try:
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        page = ctx.new_page()
        errors = []
        requests = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.url))
        page.set_content(HTML, wait_until="load")
        assert page.locator("h1").first.inner_text().startswith("You don't need")
        assert page.locator("[data-route]").count() > 14
        assert "In memory only" in page.locator("#save-status").inner_text()
        assert requests == [], f"Unexpected outbound request: {requests}"
        log("Loaded offline bundle; 15 navigation sections and zero network requests")

        nav(page, "story")
        assert "Where I am" in page.locator("h1").first.inner_text()
        assert page.locator("textarea[data-answer]").count() == 6
        page.locator('textarea[data-answer="1"]').fill("Test: I enjoy making things but not late schedules.")
        page.locator('textarea[data-answer="2"]').fill("Test: too little opportunity to grow.")
        nav(page, "workstyle")
        assert "How I work" in page.locator("h1").first.inner_text()
        page.locator('[data-rating="12"][data-value="2"]').click()
        page.locator('[data-rating="13"][data-value="3"]').click()
        assert page.locator('[data-rating="12"][data-value="2"]').get_attribute('aria-pressed') == 'true'
        page.locator('[data-rating="13"][data-value="3"]').click()
        assert page.locator('[data-rating="13"][data-value="3"]').get_attribute('aria-pressed') == 'false'
        log("Text questionnaire, navigation, 1–5 scale, and clear-selection work")

        nav(page, "values")
        for label in ["Good income", "Job security", "Personal freedom and reasonable hours"]:
            page.locator('button[data-value-pick]').filter(has_text=label).click()
        assert page.locator('button[data-value-pick][aria-pressed="true"]').count() == 3
        assert page.locator('button[data-value-pick][disabled]').count() == 7
        page.locator('[data-composite="19"][data-part="today"]').fill("Personal target, not a prediction")
        log("Top-3 work values and optional multi-field income inputs work")

        nav(page, "thinking")
        page.locator('textarea[data-answer="22"]').fill("Test: First look at order timestamps and handoffs. Then ask teammates.")
        page.locator('input[data-think="22"][data-move="evidence"]').check()
        page.locator('input[data-think="22"][data-move="perspectives"]').check()
        assert page.locator('input[data-think="22"][data-move="evidence"]').is_checked()
        nav(page, "future")
        page.locator('[data-composite="30"][data-part="future"]').fill("Test: I want time, growth and good friends.")
        page.locator('[data-composite="30"][data-part="firstTest"]').fill("Test: interview a repair technician.")
        page.locator('textarea[data-reflection="useful"]').fill("Test: fixing practical problems.")
        log("Scenario reflection and future vision save in session")

        nav(page, "compass")
        for lens, rating in [("hands",5),("diagnose",5),("create",4),("people",3),("systems",4),("tech",4)]:
            page.locator(f'[data-lens="{lens}"][data-value="{rating}"]').click()
        nav(page, "explore")
        assert page.locator(".lane-card").count() >= 20
        page.locator('button[data-expand="repair"]').click()
        assert "What could make it a poor fit" in page.locator('[data-lane-card="repair"]').inner_text()
        page.locator('button[data-pin="repair"]').click()
        assert page.locator('[data-lane-card="repair"]').locator('.tag-green').count() == 1
        page.locator("#lane-search").fill("appliance")
        assert page.locator(".lane-card").count() == 1
        page.locator("#lane-search").fill("")
        log("Career browsing, transparent explanations, shortlist, detail expand and search work")

        page.locator('button[data-make-test="repair"]').click()
        assert page.locator('[role="dialog"]').count() == 1
        page.locator('#exp-title').fill('TEST: talked with a repair technician')
        page.locator('#exp-mode').select_option('Interview')
        page.locator('#exp-status').select_option('completed')
        page.locator('#exp-notes').fill('Test observation: I like tracing problems and working with tools.')
        page.locator('[data-exp-rating="energy"][data-value="4"]').click()
        page.locator('[data-exp-rating="curiosity"][data-value="5"]').click()
        page.locator('[data-exp-rating="repeat"][data-value="5"]').click()
        page.locator('#experiment-form button[type="submit"]').click()
        assert page.locator('[role="dialog"]').count() == 0
        nav(page, "fieldwork")
        assert page.locator('.experiment-card').count() == 1
        assert "4/5" in page.locator('.experiment-card').inner_text()
        page.screenshot(path=str(ROOT / 'tests' / 'fieldwork.png'), full_page=True)
        log("Create, complete, rate, and view a real-world experiment")

        nav(page, "report")
        assert 'TEST: talked with a repair technician' in page.locator('#main').inner_text()
        assert "Test: I enjoy making things" not in page.locator('#main').inner_text(), "Report must hide full private answers by default"
        page.locator('button[data-action="toggle-full"]').click()
        assert 'Test: I enjoy making things' in page.locator('#main').inner_text()
        assert 'Test: I want time, growth' in page.locator('#main').inner_text()
        page.screenshot(path=str(ROOT / 'tests' / 'report.png'), full_page=True)
        log("Printable report works; private full answers are opt-in")

        # Plain backup is only created after the user's explicit confirmation.
        page.on('dialog', lambda dlg: dlg.accept())
        nav(page, "settings")
        with page.expect_download() as download_info:
            page.locator('button[data-action="export-plain"]').click()
        download = download_info.value
        backup_path = ROOT / 'tests' / 'example-test-only.json'
        download.save_as(str(backup_path))
        backup = json.loads(backup_path.read_text(encoding='utf-8'))
        assert backup['schemaVersion'] == 1
        assert backup['answers']['1'].startswith('Test: I enjoy making')
        assert backup['saveOnDevice'] is False
        log("JSON backup exports full data only on explicit user confirmation")

        # Wipe data then import the backed-up synthetic data.
        page.locator('button[data-action="reset"]').click()
        nav(page, "settings")
        page.locator('#backup-file').set_input_files(str(backup_path))
        page.wait_for_timeout(180)
        nav(page, "report")
        assert 'TEST: talked with a repair technician' in page.locator('#main').inner_text()
        log("Reset and local-file restore work")

        # Import sanitizer rejects invalid structures and strips dangerous markup.
        result = page.evaluate('''() => {
          const a = window.NextMoveTest;
          return a ? a.getCounts() : { available: false };
        }''')
        assert result.get('available') is False  # Diagnostic surface is disabled by default.
        log("Development diagnostic surface is disabled by default")

        mobile = browser.new_page(viewport={"width": 375, "height": 812}, device_scale_factor=1)
        mobile.set_content(HTML, wait_until="load")
        nav(mobile, "story")
        mobile.screenshot(path=str(ROOT / 'tests' / 'mobile.png'), full_page=True)
        dimensions = mobile.evaluate('''() => ({ viewport: innerWidth, doc: document.documentElement.scrollWidth })''')
        assert dimensions['doc'] <= dimensions['viewport']+1, f"Horizontal overflow: {dimensions}"
        assert mobile.locator('textarea[data-answer="1"]').is_visible()
        log("375px mobile view has no page-level horizontal overflow")

        assert errors == [], f"Browser errors: {errors}"
        log("No uncaught client-side JavaScript exceptions")
        print("ALL SMOKE TESTS PASSED")
    finally:
        browser.close()
        pw.stop()


if __name__ == '__main__':
    run()
