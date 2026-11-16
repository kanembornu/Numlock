// Local fixture regression only; system Chrome, ephemeral contexts. No live RPC.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright');
const { assembleHtml } = require('./harness/assemble-html');
const out = process.env.NUMLOCK_EVIDENCE_DIR || 'tests/tmp/expand-collapse/after';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const depreciation = JSON.parse(fs.readFileSync('tests/browser/fixtures/finance-depreciation.json'));
  const catalog = JSON.parse(fs.readFileSync('tests/browser/fixtures/products-catalog.json')).products;
  const treasuryRows = Array.from({length:30},(_,i)=>({RecognitionID:`REC-${i}`,OrderID:`ORD-${i}`,SalesEconomicDate:'2026-01-01',RecognizedAmount:250000,ClearedAmount:0,OutstandingAmount:250000,ClearingStatus:'OPEN',QualityCodes:[]}));
  const treasury = {receipts:{rows:treasuryRows},capabilities:{},destinations:[]};
  const treasuryDetail = {status:'OK',recognitionID:'REC-0',exposure:treasuryRows[0],receipts:[],capabilities:{}};
  const recipe = JSON.parse(fs.readFileSync('tests/browser/fixtures/products-cogs-recipe.json'));
  const inventory = catalog.slice(0,20).map((p,i) => ({ItemID:`ITEM-${i}`,ItemName:p.Produk,Classification:p.Kategori,BaseUOM:'g',IsActive:true,recipeUsageCount:2,standardCost:550}));
  const html = assembleHtml().replace("case 'getTransactionsPage':", "case 'getTreasuryOperatorWorkspace': result = " + JSON.stringify(treasury) + "; break; case 'getTreasuryOperatorReceiptDetail': result = " + JSON.stringify(treasuryDetail) + "; break; case 'getCogsRecipeReadModel': result = " + JSON.stringify(recipe) + "; break; case 'getInventoryItemsReadModel': result = " + JSON.stringify(inventory) + "; break; case 'getTransactionsPage':").replace("case 'getAssetsReadModel':", "case 'getProductCatalogReadModel': result = " + JSON.stringify(catalog) + "; break; case 'getDepreciationData': result = " + JSON.stringify(depreciation) + "; break; case 'getAssetsReadModel':");
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    for (const [width, height] of [[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[375,812]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 480, hasTouch: width < 480 });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
      await page.reload({waitUntil:'networkidle'});
      for (const name of ['dashboard', 'transactions', 'products', 'finance', 'treasury']) {
        await page.evaluate(name => showPage(name), name);
        if (name === 'dashboard' || name === 'transactions') {
          const attr = name === 'dashboard' ? 'data-dashboard-tab' : 'data-transactions-tab';
          for (const tab of await page.locator(`[${attr}]`).all()) {
            await tab.click(); await page.waitForTimeout(150);
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, `tab ${width} ${name}`);
          }
          await page.locator(`[${attr}]`).first().click();
        }
        if (name === 'dashboard') {
          await page.evaluate(() => {toggleDataQualityDetails();});
          assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
          await page.evaluate(() => closeDataQualityDetails());
        }
        for (const collapsed of [false, true, false]) {
          await page.evaluate(collapsed => setDesktopSidebarCollapsed(collapsed), collapsed);
          await page.waitForTimeout(250);
          const geometry = await page.evaluate(() => {
            const rect = id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, clientHeight:e.clientHeight, scrollHeight:e.scrollHeight, clientWidth:e.clientWidth, scrollWidth:e.scrollWidth, scrollTop:e.scrollTop, scrollLeft:e.scrollLeft }; };
            return { window:[innerWidth,innerHeight,scrollX,scrollY], document:[document.documentElement.clientWidth,document.documentElement.clientHeight,document.documentElement.scrollWidth,document.documentElement.scrollHeight], body:[document.body.scrollWidth,document.body.scrollHeight], shell:rect('appShell'), main:rect('mainContent'), header:rect('topUtilityBar'), sidebar:rect('dashboardSidebar'), content:rect('contentViewport') };
          });
          results.push({ width, height, name, collapsed, geometry });
          await page.screenshot({path:`${out}/${width}-${name}-${collapsed ? 'collapsed' : 'expanded'}.png`});
          // One CSS pixel tolerance for fractional transform/scroll-size rounding.
          assert.ok(geometry.document[2] <= width + 1, `horizontal ${width} ${name}`);
          assert.ok(geometry.document[3] <= height + 1, `vertical ${width} ${name}`);
          assert.ok(geometry.shell.height <= height + 1, `shell ${width} ${name}`);
          assert.ok(geometry.content.clientHeight > 0, `content ${width} ${name}`);
        }
        if (width >= 1024) for (let cycle=0;cycle<10;cycle++) {
          await page.locator('#sidebarCollapseButton').click(); await page.waitForTimeout(250);
          await page.locator('#sidebarCollapseButton').click(); await page.waitForTimeout(250);
          assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
        }
        await page.evaluate(() => { for(let i=0;i<10;i++){setDesktopSidebarCollapsed(true);setDesktopSidebarCollapsed(false);} });
        await page.waitForTimeout(250);
        if (name === 'finance') {
          for (const destination of ['capital-equity','assets','balance-sheet','cash-flow','profit-loss']) {
            await page.locator(`[data-finance-tab="${destination}"]`).click();
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, `${width} ${destination}`);
          }
          await page.locator('[data-finance-tab="assets"]').click();
          await page.locator('#assetsTabDepreciation').click();
          await page.waitForTimeout(100);
          assert.equal(await page.locator('#assetsPanelDepreciation').isVisible(), true);
          assert.equal(await page.locator('#contentViewport').evaluate(e=>e.scrollWidth<=e.clientWidth+1), true, 'Finance content width; wide tables scroll internally');
          await page.evaluate(() => {showPage('dashboard');showPage('finance');});
          assert.equal(await page.evaluate(() => financeState.destination), 'depreciation');
        }
        if (name === 'transactions') {
          await page.evaluate(() => openTransactionLifecycleDialog('detail'));
          assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
          await page.evaluate(() => closeTransactionLifecycleDialog());
        }
        if (name === 'treasury') {
          await page.evaluate(() => openTreasuryDetail('REC-0')); await page.waitForTimeout(150);
          assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
          await page.evaluate(() => closeTreasuryViews()); await page.waitForTimeout(150);
        }
        if (name === 'products') {
          for (const tab of ['recipe','profitability','catalog']) {
            await page.evaluate(tab => setProductsTab(tab), tab); await page.waitForTimeout(150);
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, `products ${tab} ${width}`);
          }
          await page.evaluate(() => renderProductDetail('PROD-001'));
          await page.evaluate(() => setProductsTab('inventory'));
          await page.waitForTimeout(100);
          await page.evaluate(() => renderInventoryItemDetail('ITEM-0'));
          assert.equal(await page.locator('#inventoryItemDetailContent').isVisible(), true);
          assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
        }
        const scroll = await page.locator('#contentViewport').evaluate(e => {e.scrollTop=e.scrollHeight;return {max:e.scrollHeight-e.clientHeight,end:e.scrollTop};});
        assert.ok(Math.abs(scroll.max-scroll.end)<=1, `scroll endpoint ${width} ${name}`);
        await page.evaluate(() => setDesktopSidebarCollapsed(true)); await page.waitForTimeout(250);
        await page.evaluate(() => setDesktopSidebarCollapsed(false)); await page.waitForTimeout(250);
        assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
        const tables = await page.locator(`#${name} table`).evaluateAll(tables => tables.filter(t=>t.getClientRects().length).map(t=>{
          let e=t.parentElement;while(e && !/auto|scroll/.test(getComputedStyle(e).overflowX))e=e.parentElement;
          if(!e)return {reachable:t.getBoundingClientRect().right<=innerWidth+1};
          e.scrollLeft=e.scrollWidth;const reachable=e.scrollLeft>=e.scrollWidth-e.clientWidth-1;e.scrollLeft=0;return {reachable};
        }));
        assert.ok(tables.every(t=>t.reachable), `table endpoints ${width} ${name}`);
        if (width < 1024) {
          for (let cycle=0;cycle<10;cycle++) {
            await page.locator('#sidebarMenuButton').click();
            await page.waitForTimeout(220);
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, `drawer open ${width} ${name}`);
            const closeRect = await page.locator('#sidebarCloseButton').boundingBox();
            assert.ok(closeRect && closeRect.x>=0 && closeRect.x+closeRect.width<=width+1, 'drawer close reachable');
            if (cycle===0) await page.screenshot({path:`${out}/${width}-${name}-drawer-open.png`});
            await page.locator('#sidebarCloseButton').click();
            await page.waitForTimeout(220);
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, `drawer closed ${width} ${name}`);
          }
          assert.equal(await page.locator('body').evaluate(e => e.classList.contains('overflow-hidden')), false);
        }
        await page.locator('#contentViewport').evaluate(e => {e.scrollLeft=0;e.scrollTop=e.scrollHeight;});
        await page.screenshot({ path:`${out}/${width}-${name}.png` });
      }
      await context.close();
    }
    console.log(`MEASURED: ${results.length} geometry samples passed; tolerance 1px`);
  } finally {
    fs.writeFileSync(`${out}/results.json`, JSON.stringify(results,null,2));
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
