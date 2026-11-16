// Local fixture acceptance only. System Chrome; ephemeral context; no production RPC.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require('playwright');
const { assembleHtml } = require('./harness/assemble-html');
const destinations = ['profit-loss', 'capital-equity', 'assets', 'balance-sheet', 'cash-flow'];
const panels = ['financeContent', 'financeCapitalEquityContent', 'financeAssetsContent', 'financeBalanceSheetContent', 'financeCashFlowContent'];
(async () => {
  const html = assembleHtml();
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const output = process.env.NUMLOCK_EVIDENCE_DIR;
  if (output) fs.mkdirSync(output, { recursive: true });
  try {
    for (const [width, height, zoom] of [[1440,900,1],[1280,800,1],[1024,768,1],[768,1024,1],[390,844,1],[375,812,1],[1440,900,1.25]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 480, hasTouch: width < 480 });
      const page = await context.newPage();
      const errors = [], calls = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.text().startsWith('[Shim] Call:')) calls.push(m.text()); });
      await page.route('**/*', route => {
        const u = new URL(route.request().url());
        return u.hostname === '127.0.0.1' || u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'cdnjs.cloudflare.com' ? route.continue() : route.abort();
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => typeof showPage === 'function' && typeof financeState !== 'undefined');
      if (zoom !== 1) await page.evaluate(z => { document.documentElement.style.zoom = z; }, zoom);
      assert.equal(await page.locator('#dashboardSidebar [data-page="finance"]').count(), 1);
      assert.equal(await page.locator('#dashboardSidebar #financialModulesGroup').count(), 0);
      assert.deepEqual(await page.locator('#financeTabList button').allTextContents(), ['Profit & Loss','Capital & Equity','Assets','Depreciation','Balance Position','Cash Flow']);
      await page.evaluate(() => showPage('finance'));
      await page.waitForTimeout(150);
      for (let i = 0; i < destinations.length; i++) {
        const tab = page.locator(`[data-finance-tab="${destinations[i]}"]`);
        await tab.click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => financeState.destination), destinations[i]);
        assert.equal(await tab.getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator(`#${panels[i]}`).isVisible(), true, panels[i]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `overflow ${width} ${destinations[i]}`);
      }
      const before = calls.length;
      await page.locator('[data-finance-tab="profit-loss"]').click();
      await page.locator('[data-finance-tab="cash-flow"]').click();
      await page.waitForTimeout(100);
      assert.equal(calls.length, before, 'cached tabs must not request again');
      await page.evaluate(() => { showPage('dashboard'); showPage('finance'); });
      assert.equal(await page.evaluate(() => financeState.destination), 'cash-flow');
      assert.equal(await page.locator('#financialModulesDisclosureButton').getAttribute('aria-current'), 'page');
      await page.locator('[data-finance-tab="cash-flow"]').focus();
      await page.keyboard.press('Home');
      assert.equal(await page.evaluate(() => financeState.destination), 'profit-loss');
      await page.selectOption('#financeFilter', 'custom');
      await page.fill('#financeCustomStart', '2026-01-01');
      await page.fill('#financeCustomEnd', '2026-01-31');
      await page.locator('#financeCustomEnd').dispatchEvent('change');
      await page.waitForTimeout(100);
      await page.locator('[data-finance-tab="capital-equity"]').click();
      assert.equal(await page.inputValue('#financeCustomStart'), '2026-01-01');
      assert.equal(await page.inputValue('#financeCustomEnd'), '2026-01-31');
      if (width < 1024) {
        await page.evaluate(() => setSidebarOpen(true, false));
        await page.locator('#financialModulesDisclosureButton').click();
        assert.equal(await page.locator('#dashboardSidebar').getAttribute('aria-hidden'), 'true');
      }
      assert.deepEqual(errors, []);
      if (output) await page.screenshot({ path: `${output}/finance-${width}x${height}-${zoom}.png`, fullPage: true });
      console.log(JSON.stringify({ viewport: `${width}x${height}`, zoom, result: 'PASS', url, calls: calls.length, pageErrors: errors }));
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
