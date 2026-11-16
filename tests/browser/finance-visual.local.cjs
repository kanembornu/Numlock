// Workspace-only fixture screenshots. No application source changes.
const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { assembleHtml } = require('./harness/assemble-html');
const out = process.env.NUMLOCK_EVIDENCE_DIR || 'tests/tmp/finance-tabs-evidence';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const dep = JSON.parse(fs.readFileSync('tests/browser/fixtures/finance-depreciation.json'));
  let html = assembleHtml().replace("case 'getAssetsReadModel':", "case 'getDepreciationData': result = " + JSON.stringify(dep) + "; break; case 'getAssetsReadModel':");
  const server = http.createServer((req, res) => { res.setHeader('Content-Type','text/html'); res.end(html); });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  const results = [];
  try {
    for (const [width,height] of [[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[375,812]]) {
      const context = await browser.newContext({viewport:{width,height},isMobile:width<480,hasTouch:width<480});
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',r=> ['127.0.0.1','cdn.jsdelivr.net','cdnjs.cloudflare.com'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
      await page.goto(url,{waitUntil:'networkidle'});
      await page.evaluate(()=>{showPage('finance');setSidebarOpen(false,false);});
      const images=[];
      for (const dest of ['profit-loss','capital-equity','assets','balance-sheet','cash-flow','depreciation','products']) {
        if(dest==='products') await page.evaluate(()=>showPage('products'));
        else if(dest==='depreciation') { await page.locator('[data-finance-tab="assets"]').click(); await page.locator('#assetsTabDepreciation').click(); }
        else await page.locator(`[data-finance-tab="${dest}"]`).click();
        await page.waitForTimeout(200);
        if(dest==='depreciation') {
          assert.equal(await page.evaluate(()=>financeState.destination),'depreciation');
          assert.equal(await page.locator('#assetsPanelDepreciation').isVisible(),true);
          assert.match(await page.locator('#assetsPanelDepreciation').innerText(),/Espresso Machine/);
        }
        const geometry = await page.evaluate(() => {
          const selectors = ['.finance-kpi dd', '.finance-equity-bridge dd', '#financeDepPolicySource'];
          const metrics = Array.from(document.querySelectorAll(selectors.join(','))).filter(e => e.getClientRects().length).map(e => {
            const s = getComputedStyle(e), p = getComputedStyle(e.parentElement), r = e.getBoundingClientRect();
            const range = document.createRange(); range.selectNodeContents(e);
            return {id:e.id,text:e.textContent,width:r.width,scrollWidth:e.scrollWidth,overflowWrap:s.overflowWrap,wordBreak:s.wordBreak,whiteSpace:s.whiteSpace,minWidth:s.minWidth,parentDisplay:p.display,parentColumns:p.gridTemplateColumns,parentOverflow:p.overflow,lines:Array.from(range.getClientRects()).map(r=>({x:r.x,y:r.y,width:r.width}))};
          });
          const tables = Array.from(document.querySelectorAll('#finance table')).filter(t=>t.getClientRects().length).map(t=>{
            let c=t.parentElement;
            while(c && c!==document.body && !/auto|scroll/.test(getComputedStyle(c).overflowX)) c=c.parentElement;
            if(!c || c===document.body) return {caption:t.caption?.textContent,container:null};
            c.scrollLeft=0;
            const start=c.scrollLeft, max=c.scrollWidth-c.clientWidth;
            c.scrollLeft=max;
            const end=c.scrollLeft, last=t.rows[0]?.lastElementChild?.getBoundingClientRect(), box=c.getBoundingClientRect();
            const result={caption:t.caption?.textContent,container:c.id||c.className,clientWidth:c.clientWidth,scrollWidth:c.scrollWidth,start,max,end,lastColumnRight:last?.right,containerRight:box.right,lastColumnReachable:!last||last.right<=box.right+1,stickyCells:Array.from(t.querySelectorAll('th,td')).filter(e=>getComputedStyle(e).position==='sticky').length};
            c.scrollLeft=0; return result;
          });
          return {metrics,tables};
        });
        const file=`${out}/${width}x${height}-${dest}.png`;
        await page.screenshot({path:file,fullPage:true});
        // Viewport images form a labelled contact sheet for direct visual inspection.
        const image=await page.screenshot();
        images.push({dest,data:image.toString('base64')});
        results.push({width,height,destination:dest,screenshot:file,geometry,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)});
      }
      assert.deepEqual(errors,[]);
      const sheet=await context.newPage();
      await sheet.setViewportSize({width:Math.max(width,780),height:900});
      const cell=Math.max(width/2,390);
      await sheet.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(2,${cell}px);background:#ddd">${images.map(i=>`<div><h3 style="margin:4px;font:16px sans-serif">${width} × ${height} — ${i.dest}</h3><img style="width:${cell}px;display:block" src="data:image/png;base64,${i.data}"></div>`).join('')}</body>`);
      await sheet.screenshot({path:`${out}/${width}x${height}-contact.png`,fullPage:true});
      await context.close();
    }
    fs.writeFileSync(`${out}/results.json`,JSON.stringify({url,results,nativeZoom:'NOT_VERIFIED'},null,2));
    console.log(JSON.stringify({url,captures:results.length,viewports:6,depreciation:'6/6 PASS',overflow:results.filter(r=>r.overflow)}));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
