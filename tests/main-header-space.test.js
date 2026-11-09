// Local fixtures only: node tests/main-header-space.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { assembleHtml } = require('./browser/harness/assemble-html');
const source = fs.readFileSync('190.View.Index.html', 'utf8');
const old = path => execFileSync('git', ['show', `10d177cbe51af1b1ff0d5007b21a08fe716c5ca0:${path}`], { encoding: 'utf8' });
const css = s => s.slice(s.indexOf('    <style>\n'), s.indexOf('    </style>') + 12);
const html = assembleHtml();
const baseline = html.replace(css(source), css(old('190.View.Index.html')))
  .replace(fs.readFileSync('189.View.Tailwind.html', 'utf8'), old('189.View.Tailwind.html'));
for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
(async () => {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(req.url === '/before' ? baseline : html); });
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
      const measurements = [];
      for (const path of ['/before', '/after']) {
        await page.goto(`http://127.0.0.1:${server.address().port}${path}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => showPage('transactions'));
        measurements.push(await page.evaluate(() => {
          const rect = id => document.getElementById(id).getBoundingClientRect().toJSON();
          return { tabs: rect('transactionsTabList'), button: rect('newTransactionButton'), sidebar: rect('dashboardSidebar'), card: rect('transactionsTableCard'), viewport: rect('contentViewport') };
        }));
      }
      const [before, after] = measurements;
      assert.equal(after.sidebar.width, before.sidebar.width);
      if (viewport.width === 1440) {
        assert.equal(before.tabs.top - after.tabs.top, 96);
        assert.equal(after.viewport.height - before.viewport.height, 96);
        assert.equal(before.card.top - after.card.top, 96);
        assert(Math.abs(after.tabs.top + after.tabs.height / 2 - after.button.top - after.button.height / 2) < 2);
        await page.locator('#sidebarCollapseButton').click();
        assert.equal(await page.locator('#appShell').getAttribute('data-sidebar-collapsed'), 'true');
        await page.locator('#sidebarCollapseButton').click();
      } else {
        assert.equal(after.tabs.top, before.tabs.top);
        await page.locator('#sidebarMenuButton').click();
        assert.equal(await page.locator('#sidebarMenuButton').getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#sidebarMenuButton').getAttribute('aria-expanded'), 'false');
      }
      for (const tab of ['recent', 'sales', 'expenses', 'purchases']) {
        await page.locator(`[data-transactions-tab="${tab}"]`).click();
        assert.equal(await page.locator(`[data-transactions-tab="${tab}"]`).getAttribute('aria-selected'), 'true');
      }
      const destinations = await page.locator('#dashboardSidebar button[data-page]').evaluateAll(ns => ns.map(n => [n.dataset.page, n.dataset.navigationDestination]));
      for (const [id, destination] of destinations) {
        await page.evaluate(([id, destination]) => showPage(id, destination), [id, destination]);
        assert.equal(await page.locator('.page.active').getAttribute('id'), id);
      }
      await page.evaluate(() => showPage('transactions'));
      await page.locator('#newTransactionButton').click();
      assert(await page.locator('#transactionEntryOverlay').isVisible());
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-page="logs"], #logs').count(), 0);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ viewport, before: before.tabs.top, after: after.tabs.top, reclaimed: before.tabs.top - after.tabs.top, errors }));
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
