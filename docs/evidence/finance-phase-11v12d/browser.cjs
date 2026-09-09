// Real Chromium + current assembled frontend + current shared dispatcher; all persistence is synthetic.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const prior=path.join(__dirname,'../finance-phase-11v12c/verify-local.cjs');
const scope={require,__dirname:path.dirname(prior),console,structuredClone};
vm.runInNewContext(fs.readFileSync(prior,'utf8').split('console.log(c.testCanonicalPurchaseDispatcherContracts')[0]+'\nglobalThis.fixture={c,authority,expenses};',scope);
const {c,authority,expenses}=scope.fixture;
const factory=vm.runInContext('('+c.testCanonicalPurchaseDispatcherContracts.toString().replace('var registry = validateExpensePurchasePolicy_(expenses);','return fixture; var registry = validateExpensePurchasePolicy_(expenses);')+')',c)(authority,expenses);
const f=factory();f.dispatch.uuid=()=>require('node:crypto').randomUUID();const options=JSON.parse(JSON.stringify(c.buildTransactionEntryOptions(c.readCanonicalTable(f.dispatch.spreadsheet(),'Products',['ID_Prod']),expenses,c.readCanonicalTable(f.dispatch.spreadsheet(),'ProductPricing',['ID_Prod']),new Date())));
const output=process.env.NUMLOCK_ACCEPTANCE_OUTPUT || __dirname;
const results=[];function check(name,ok,detail){results.push({name,status:ok?'PASS':'BLOCKED',detail:detail||''});console.log(results.at(-1));}
const history=expenses.map((e,i)=>({id:'HIST-'+i,date:'2026-01-01',transactionType:'Expense',purchaseCategory:e.Item,expense:123,isActive:true,source:'XLSM'}));
let nextMode='',calls=[],gatePromise=null;
const ss=f.dispatch.spreadsheet();
f.sheets.PurchaseEvents={getDataRange:()=>({getValues:()=>[Array.from(c.PURCHASE_EVENT_POLICY.headers),...f.events.map(r=>Array.from(c.PURCHASE_EVENT_POLICY.headers,h=>r[h]))]})};
f.sheets.InventoryReceipts=f.capture.sheets.InventoryReceipts;
f.sheets.InventoryItems={getDataRange:()=>({getValues:()=>[Array.from(c.BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS),...authority.items.map(r=>Array.from(c.BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS,h=>r[h]))]})};
c.Session={getScriptTimeZone:()=> 'Asia/Jakarta'};c.SpreadsheetApp={getActiveSpreadsheet:()=>ss};c.CacheService={getScriptCache:()=>({get:()=>null,put(){},putAll(){}})};c.getDashboardCacheRevision=()=> 'synthetic';
function historyRows(){f.runtime.lock.waitLock(30000);try{return c.getTransactionsPeriodRows({startDate:'2026-01-01',endDate:'2026-12-31'}).rows;}finally{f.runtime.lock.releaseLock();}}

(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
let html=read('190.View.Index.html').replace(/<\?!= include\('([^']+)'\); \?>/g,(_,n)=>read(n+'.html')).replace(/<\?!= HtmlService.createHtmlOutputFromFile\('([^']+)'\).getContent\(\); \?>/g,(_,n)=>read(n+'.html')).replace(/<\?[\s\S]*?\?>/g,'LOCAL FIXTURE').replace('window.onload = function()','window.fixtureDisabledOnload = function()');
await page.route('**/*',route=>route.request().url()==='http://numlock.local/'?route.fulfill({contentType:'text/html',body:html}):route.abort());
await page.exposeFunction('fixtureRpc',async(name,p)=>{
 if(name==='getTransactionEntryOptions')return {success:true,data:options};
 if(name==='submitCanonicalTransaction'){
  calls.push(structuredClone(p));const mode=nextMode;nextMode='';
  if(mode==='wait')await new Promise(r=>gatePromise=r);
  if(mode==='conflict')return {status:'CONFLICT',writeCount:0};
  if(mode==='uncertain'){f.failure='AFTER_EVENT';const r=f.run(p);f.failure='';return r;}
  return f.run(p);
 }
 if(name==='getTransactionsPage'){const rows=historyRows();return Object.assign(c.buildTransactionsPageResult(c.filterTransactionsPeriodRows(rows,p,p.tab),1,50),{searchIndex:c.buildTransactionsSearchIndex(rows)});}
 return {success:true,data:{}};
});
async function install(){await page.evaluate(()=>{window.google={script:{get run(){let success,failure;const api=new Proxy({}, {get(_,name){if(name==='withSuccessHandler')return fn=>{success=fn;return api};if(name==='withFailureHandler')return fn=>{failure=fn;return api};return p=>window.fixtureRpc(name,p).then(r=>{if(success)success(r)},e=>{if(failure)failure(e)});}});return api;}}};openTransactionEntry();});await page.waitForFunction(()=>transactionEntryState.optionsLoaded);}
await page.goto('http://numlock.local/');await install();
check('Top-level choices',JSON.stringify(await page.locator('#transactionTypeFieldset button').allTextContents().then(x=>x.map(s=>s.trim())))===JSON.stringify(['Sales','Expense']));
async function choose(id){await page.evaluate(()=>resetTransactionEntryForAnother(false));await page.locator('#transactionTypeExpense').click();const option=options.expenses.find(e=>e.expenseItemId===id);await page.locator('#expenseCostType').selectOption(option.costType);await page.locator('#expenseDate').fill('2026-10-01');await page.locator('#expenseEntrySearch').fill(option.item);await page.locator('#expenseEntryListbox button').filter({hasText:option.item}).first().click();await page.evaluate(()=>document.getElementById('transactionEntryScroll').scrollTop=0);return option;}
await page.locator('#transactionTypeSales').click();await page.locator('#productEntrySearch').fill('Test coffee');await page.locator('#productEntryListbox button').first().click();await page.locator('#salesTypeHot').click();await page.locator('#submitTransactionEntryButton').click();await page.waitForFunction(()=>transactionEntryState.submissionComplete);check('Sales canonical routing',f.writes.tabsal===1 && f.sheets.tabsal.rows[1][5]===4000);
await choose('OSS01');check('Fixed selector',await page.evaluate(()=>getEntryCombobox('expense').options.length)===5);await page.screenshot({path:path.join(output,'fixed.png')});
check('Fixed ordinary fields',await page.locator('#expenseEntryAmount').isVisible() && !await page.locator('#receiptEntryFields').isVisible());
await page.locator('#expenseEntryAmount').fill('12345');await page.locator('#submitTransactionEntryButton').click();await page.waitForFunction(()=>transactionEntryState.submissionComplete);check('Fixed canonical routing',f.writes.tabops===1);
for(const id of ['OSK05','OSK02']){await choose(id);check('Non-HPP '+id,await page.locator('#expenseEntryAmount').isVisible() && !await page.locator('#receiptEntryFields').isVisible());if(id==='OSK05')await page.screenshot({path:path.join(output,'non-hpp.png')});await page.locator('#expenseEntryAmount').fill('1000');await page.locator('#submitTransactionEntryButton').click();await page.waitForFunction(()=>transactionEntryState.submissionComplete);}
check('Non-HPP routing',f.writes.tabops===3);
async function fillPurchase(uom=''){await page.locator('#receiptCost').fill('20000');await page.locator('#receiptSupplier').fill('Synthetic source');await page.locator('#receiptUnavailable').check();await page.locator('#receiptAttested').check();if(uom){await page.locator('#receiptQty').fill('1');await page.locator('#receiptUom').fill(uom);}}
async function save(){await page.locator('#submitTransactionEntryButton').click();await page.waitForFunction(()=>transactionEntryState.submissionComplete || transactionEntryState.receiptUnresolved);}
for(const id of ['OSK03','OSR04','OSR19','OSR03','OSR21','OSR07','OSR08','OSR16']){
 const option=await choose(id);check('Purchase form '+id,await page.locator('#receiptEntryFields').isVisible() && await page.locator('#expenseEntrySearch').inputValue()===option.item && !await page.locator('#expenseEntryAmount').isVisible());
 check('No technical selectors '+id,await page.locator('#receiptItem').count()===0 && !/ING-\d|CONV-|COST_POOL_ALLOCATION|Badau|Kingkong|Bendera|Poci|Zeppelin/.test(await page.locator('#transactionEntryDialog').innerText()));
 await fillPurchase(id==='OSK03'?'unsupported-package':'');
 if(id==='OSK03')await page.screenshot({path:path.join(output,'direct-hpp.png')});
 if(id==='OSR03')await page.screenshot({path:path.join(output,'cost-pool.png')});
 await save();const event=f.events.at(-1);check('One labeled event '+id,event.ExpenseID===id && event.BusinessLabel===option.item && event.ReceiptPlan==='null' && f.writes.tabops===3);
 if(id==='OSK03')check('Unresolved package cost-only',await page.evaluate(()=>transactionEntryState.submissionComplete) && event.AllocationStatus==='QUANTITY_PACKAGE_UNRESOLVED' && !f.ledger.length && f.capture.sheets.InventoryReceipts.grid.length===1 && /not verified/.test(await page.locator('#transactionEntrySuccessDetails').innerText()));
}
check('28 variable choices / hold absent',options.expenses.filter(e=>e.costType==='VARIABLE_COST').length===28&&!options.expenses.some(e=>e.expenseItemId==='OUU01'));
check('Sirup isolated',f.events.filter(e=>['OSR07','OSR08','OSR16'].includes(e.ExpenseID)).length===3 && !f.ledger.length);
await choose('OSR04');await fillPurchase();nextMode='wait';const before=calls.length;await page.evaluate(()=>{submitTransactionEntry({preventDefault(){}});submitTransactionEntry({preventDefault(){}});});await page.waitForTimeout(100);check('Double submit protection',calls.length===before+1);gatePromise();await page.waitForFunction(()=>transactionEntryState.submissionComplete);
await choose('OSR04');await fillPurchase();nextMode='uncertain';await save();const pending=calls.at(-1);check('WRITE_UNCERTAIN',await page.evaluate(()=>transactionEntryState.receiptUnresolved));await page.evaluate(()=>{closeTransactionEntry();openTransactionEntry();});check('Reopen identity',await page.evaluate(()=>transactionEntryState.receiptKey)===pending.requestKey);
await page.reload();await install();check('Reload frozen payload',JSON.stringify(await page.evaluate(()=>transactionEntryState.receiptPayload))===JSON.stringify(pending));nextMode='conflict';await page.locator('#receiptRecovery').click();await page.waitForFunction(()=>document.getElementById('transactionEntryGeneralError').innerText.includes('conflicts'));check('Conflict preserved',await page.evaluate(()=>transactionEntryState.receiptUnresolved));await page.locator('#receiptRecovery').click();await page.waitForFunction(()=>transactionEntryState.submissionComplete);check('Resume identity',JSON.stringify(calls.at(-1))===JSON.stringify(pending));
await choose('OSR03');await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'narrow.png')});check('Narrow no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.evaluate(rows=>{closeTransactionEntry();renderTransactionRows(rows);},history);check('Historical 34 labels',await page.evaluate(rows=>{return rows.every(row=>{renderTransactionDetail(buildLocalTransactionDetail(row));return initializeStableDashboardElements().lifecycle.content.innerText.includes(row.purchaseCategory)});},history));
const dto=c.projectPurchaseEventTransaction_(f.events[0]);check('Projection label',dto.item===f.events[0].BusinessLabel);check('PurchaseEvent reaches recent history',c.filterTransactionsPeriodRows([dto],{},'recent').length===1,'PurchaseEvent retained by current recent-history filter');check('Financial Expense exclusion',c.filterTransactionsPeriodRows([dto],{},'expenses').length===0 && dto.financialTotalsIncluded===false && f.writes.tabops===3);
await page.evaluate(row=>{renderTransactionRows([row]);},JSON.parse(JSON.stringify(dto)));check('PurchaseEvent renderer label',await page.evaluate(label=>initializeStableDashboardElements().tableBody.innerText.includes(label),dto.item),'Current renderer preserves the PurchaseEvent business label');
// Governed UOM through the unmodified UI remains an observation until explicit package evidence exists.
await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>openTransactionEntry());await choose('OSK03');const conversion=authority.conversions.find(r=>r.ItemID==='ING-020');await fillPurchase(conversion.FromUOM.toLowerCase());await save();check('Governed-UOM UI capture',f.events.at(-1).BusinessLabel==='Gula' && f.events.at(-1).ReceiptPlan==='null');
const governed={transactionType:'EXPENSE',expenseItemId:'OSK03',requestKey:'governed-acceptance-0001',input:{ExpenseDate:'2026-10-01',PurchaseQty:'1',PurchaseUOM:conversion.FromUOM.toLowerCase(),AcquisitionValue:'20000',SupplierSource:'Synthetic evidence',ExternalRef:'TEST',ExternalDocumentStatus:'AVAILABLE',Attested:true,ConversionEvidenceConfirmed:true,PackageIdentity:conversion.PackageIdentity,SupplierRef:conversion.SupplierRef}};
const downstream=f.run(governed);check('Evidence-qualified governed downstream',downstream.status==='OPERATIONAL_POSTED' && f.ledger.length===1 && f.capture.sheets.InventoryReceipts.grid.length===2);
const integrated=historyRows();check('Actual reader parent/child integration',integrated.filter(r=>r.transactionType==='PurchaseEvent').length===f.events.length && !integrated.some(r=>r.transactionType==='InventoryReceipt'));
const searchDto=integrated.find(r=>r.transactionType==='PurchaseEvent');
await page.evaluate(rows=>{closeTransactionEntry();latestLifecycleTransactions=rows;transactionsSearchIndex=rows;activeTransactionsTab='recent';activeTransactionDrilldown=null;transactionsSearchQuery='';renderTransactionRows(rows);},JSON.parse(JSON.stringify(integrated)));
check('History searchable/filterable',await page.evaluate(label=>{transactionsSearchQuery=label;const found=filterTransactionsSearchIndex();activeTransactionDrilldown={type:'purchase'};return found.length>0 && filterTransactionsSearchIndex().length>0;},searchDto.item));
await page.evaluate(id=>openTransactionDetail(id),searchDto.id);check('History detail',await page.locator('#transactionLifecycleContent').innerText().then(t=>t.includes(searchDto.item)) && !/ING-\d|CONV-|COST_POOL_ALLOCATION|pe-receipt-/.test(await page.locator('#transactionLifecycleDialog').innerText()));
await page.screenshot({path:path.join(output,'purchase-detail.png')});
check('Final financial-view exclusion',c.filterTransactionsPeriodRows(integrated,{},'expenses').length===3 && f.writes.tabops===3);
check('Activation disabled',c.EXPENSE_PURCHASE_POLICY.enabled===false && c.PURCHASE_EVENT_POLICY.enabled===false && c.INVENTORY_RECEIPT_ACTIVATION.enabled===false);
check('OTHER_HOLD writes0',f.run({transactionType:'EXPENSE',expenseItemId:'OUU01',amount:1}).status==='REFUSED');check('Browser errors',errors.length===0,errors.join('; '));
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({method:'local Chromium with shared canonical synthetic dispatcher',results,counts:{events:f.events.length,receipts:f.capture.sheets.InventoryReceipts.grid.length-1,movements:f.ledger.length,tabops:f.writes.tabops},productionWrites:0},null,2));
if(results.some(r=>r.status==='BLOCKED'))process.exitCode=1;
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
