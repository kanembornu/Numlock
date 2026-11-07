// Run: node tests/logs-ui-removal.test.js (local fixtures; system Chrome; no production RPC).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const { chromium } = require('playwright');
const { assembleHtml } = require('./browser/harness/assemble-html');
const source = fs.readFileSync('190.View.Index.html', 'utf8');
const baseline = require('node:child_process').execFileSync('git', ['show', 'HEAD:190.View.Index.html'], { encoding: 'utf8' });
const destinations = s => [...s.matchAll(/<button[^>]*data-page="([^"]+)"[^>]*>/g)].map(m => m[0]);
assert.deepEqual(destinations(source), destinations(baseline).filter(s => !s.includes('data-page="logs"')));
for (const token of ['id="logs"', 'sessionLogs', 'hf-log-', 'function renderSessionClientLogs', 'function setClientLogFilter', 'function clearSessionClientLogs']) assert(!source.includes(token), token);
const html = assembleHtml();
for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
// Run the updated contract without Apps Script or the broad backend runner.
const box = { getAssembledFrontendSource: () => html, Logger: { log() {} } };
vm.createContext(box);
vm.runInContext(fs.readFileSync('94.Tests.Assertions.js', 'utf8'), box);
box.getAssembledFrontendSource = () => html;
vm.runInContext(fs.readFileSync('96.Tests.Frontend.Cases.js', 'utf8'), box);
assert(box.testLogsVisualContract().passed);
console.log('PASS: menu order, removed references, assembled JS syntax, retained logging contract');
(async () => {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      // Only local fixtures and static libraries; never Apps Script or production endpoints.
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        return ['127.0.0.1', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'].includes(url.hostname) ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/#logs`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => typeof stableDashboardElements !== 'undefined' && stableDashboardElements !== null);
      assert.equal(await page.locator('[data-page="logs"], #logs').count(), 0);
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      const buttons = await page.locator('#dashboardSidebar button[data-page]').evaluateAll(nodes => nodes.map(n => ({ page: n.dataset.page, destination: n.dataset.navigationDestination, label: n.getAttribute('aria-label') })));
      for (const button of buttons) {
        await page.evaluate(b => showPage(b.page, b.destination), button);
        assert.equal(await page.locator('.page.active').getAttribute('id'), button.page);
        assert.equal(await page.locator('#dashboardSidebar [aria-current="page"]').getAttribute('data-navigation-destination'), button.destination);
      }
      for (const tab of ['recent', 'sales', 'expenses', 'purchases']) {
        await page.evaluate(() => showPage('transactions'));
        await page.locator(`[data-transactions-tab="${tab}"]`).click();
        assert.equal(await page.locator(`[data-transactions-tab="${tab}"]`).getAttribute('aria-selected'), 'true');
      }
      await page.evaluate(() => showPage('logs'));
      assert.equal(await page.locator('.page.active').getAttribute('id'), 'dashboard');
      await page.evaluate(() => logClientEvent('Error', 'Navigation', 'Synthetic check'));
      assert.equal(await page.evaluate(() => sessionClientLogs[0].message), 'Synthetic check');
      await page.evaluate(() => setSidebarOpen(true, false));
      await page.evaluate(() => setSidebarOpen(false, false));
      assert.deepEqual(errors, []);
      console.log(`PASS: fixture navigation, stale Logs fallback, sidebar open/close, light theme, no page errors ${viewport.width}x${viewport.height}`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
