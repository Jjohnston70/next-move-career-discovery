#!/usr/bin/env python3
"""Offline O*NET v1.3 regression; only synthetic values and fake job records.

Run with /opt/pyvenv/bin/python. Never prints or stores personal responses.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'Next-Move.html').read_text(encoding='utf-8')

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1280,'height':800})
        failures=[]
        network=[]
        page.on('pageerror',lambda err:failures.append(str(err)))
        page.on('request',lambda req:network.append(req.url))
        page.set_content(HTML, wait_until='load')
        page.locator('button.nav-link[data-route="onet"]').click()
        # Wait for the synchronous route render to settle; avoid a race on slower Chromium builds.
        page.wait_for_function("document.querySelector('h1') && document.querySelector('h1').textContent.trim() === 'O*NET Mini Interest Profiler'")
        assert page.locator('h1').first.inner_text().strip()=='O*NET Mini Interest Profiler'
        assert 'published 2016' in page.locator('#main').inner_text()
        q=page.evaluate('window.NM_DATA.onetMini.items.map(x=>({id:x.id,area:x.area}))')
        assert len(q)==30 and set(x['area'] for x in q)==set('RIASEC')
        for block in range(5):
            for x in q[block*6:block*6+6]:
                rating=5 if x['area']=='R' else 1
                page.locator(f'button[data-onet-answer="{x["id"]}"][data-value="{rating}"]').click()
            if block<4:
                page.locator('button[data-action="onet-next"]').click()
        page.locator('#onet-results').wait_for()
        assert '20/20' in page.locator('#onet-results').inner_text()
        assert '0/20' in page.locator('#onet-results').inner_text()
        assert 'Realistic' in page.locator('#onet-results').inner_text()
        print('[PASS] Published 2016 Mini-IP 30 questions, 6 area scores, private 0-20 scoring')
        # Import only imaginary occupations using the exact optional JSON table structure.
        interest_names=['Realistic','Investigative','Artistic','Social','Enterprising','Conventional']
        interests={'table_id':'career_interest_types','row':[{'onetsoc_code':'49-9041.00','scale_id':'OI','element_name':name,'data_value':6.0 if name=='Realistic' else 1.0} for name in interest_names]}
        occupation={'table_id':'occupation_data','row':[{'onetsoc_code':'49-9041.00','title':'Synthetic Test Technician','description':'Artificial occupation data for local importer testing.'}]}
        files=[{'name':name,'mimeType':'application/json','buffer':json.dumps(obj).encode('utf-8')} for name,obj in [('career_interest_types.json',interests),('occupation_data.json',occupation)]]
        page.locator('#onet-files').set_input_files(files)
        page.wait_for_timeout(150)
        assert 'Synthetic Test Technician' in page.locator('#main').inner_text()
        print('[PASS] Synthetic occupation JSON imported in browser; no live O*NET API called')
        # Report includes published O*NET numeric scores and separate original exploration.
        page.locator('button.nav-link[data-route="report"]').click()
        report=page.locator('#main').inner_text()
        assert 'O*NET' in report and '20/20' in report
        print('[PASS] Official 2016 interest scores included in the private report')
        assert not failures, 'Browser errors: '+str(failures)
        assert not network, 'Unexpected network: '+str(network)
        print('[PASS] Zero scripts requesting any remote resource or transmitting responses')
        browser.close()

if __name__=='__main__':
    main()
