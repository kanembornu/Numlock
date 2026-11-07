// Run: node tests/sidebar-collapse-layout.test.js (local fixtures; system Chrome).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require('playwright');
const { assembleHtml } = require('./browser/harness/assemble-html');
const source = fs.readFileSync('190.View.Index.html', 'utf8');
const baseline = require('node:child_process').execFileSync('git', ['show', 'HEAD:190.View.Index.html'], { encoding: 'utf8' });
const handlers = s => s.slice(s.indexOf('    function setDesktopSidebarCollapsed('), s.indexOf('    function setSidebarOpen('));
assert.equal(handlers(source), handlers(baseline));
assert(source.includes('<div id="sidebarDataStatus" hidden></div>'));
assert(!source.includes('sidebar-status-region'));
const html = assembleHtml();
for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
(async () => {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      await context.route('**/*', route => ['127.0.0.1', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => typeof stableDashboardElements !== 'undefined' && stableDashboardElements !== null);
      await page.evaluate(() => setSidebarOpen(true, false));
      const button = page.locator('#sidebarCollapseButton');
      assert.equal(await button.count(), 1);
      for (let i = 0; i < 4; i++) {
        if (viewport.width >= 1024) { await button.focus(); await page.keyboard.press(i % 2 ? 'Space' : 'Enter'); }
        else await page.evaluate(() => setDesktopSidebarCollapsed(document.getElementById('appShell').getAttribute('data-sidebar-collapsed') !== 'true'));
        const collapsed = i % 2 === 0;
        assert.equal(await button.getAttribute('aria-expanded'), String(!collapsed));
        assert.equal(await button.getAttribute('aria-label'), collapsed ? 'Expand navigation' : 'Collapse navigation');
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => { initializeStableDashboardElements().sidebarDataStatus.innerText = 'Stale · synthetic rerender'; });
      assert.equal(await page.locator('#sidebarDataStatus').isVisible(), false);
      if (viewport.width >= 1024) {
        const geometry = await button.evaluate(b => { const r = b.getBoundingClientRect(), p = b.parentElement.getBoundingClientRect(); return { bottomGap: p.bottom - r.bottom, height: r.height, width: r.width, overflow: b.parentElement.scrollWidth > b.parentElement.clientWidth }; });
        assert(geometry.bottomGap <= 28 && geometry.bottomGap >= 0, JSON.stringify(geometry));
        assert(geometry.height >= 44 && geometry.width >= 40);
        assert.equal(geometry.overflow, false);
        console.log('Desktop footer geometry:', geometry);
      } else {
        assert.equal(await button.isVisible(), false); // Existing mobile close-menu behavior retained.
        await page.evaluate(() => setSidebarOpen(false, false));
        assert.equal(await page.locator('#dashboardSidebar').getAttribute('aria-hidden'), 'true');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${viewport.width}x${viewport.height}: repeated state/label toggles, hidden status after rerender, sidebar layout, zero page errors`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
