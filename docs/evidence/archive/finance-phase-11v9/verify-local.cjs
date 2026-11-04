// Local snapshot authority, synthetic services and browser RPC only. No network/business writes.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const prior = path.join(__dirname, '../finance-phase-11v8b/verify-local.cjs');
const scope = { require, __dirname: path.dirname(prior), console, process: {argv: []}, structuredClone };
vm.runInNewContext(fs.readFileSync(prior, 'utf8') + '\nglobalThis.fixture = { c, authority, expenses };', scope, {filename: prior});
const {c, authority, expenses} = scope.fixture;
const choices = JSON.parse(JSON.stringify(c.buildInventoryReceiptEntryChoices_(authority.items, authority.conversions, '2026-10-01')));
assert.equal(choices.length,22);
const lemon = choices.find(i=>i.itemId==='ING-018');
assert.deepEqual(lemon.choices.map(o=>o.uom),['gr','kg']);
for(const item of choices) {
  assert.ok(item.choices.length,item.item);
  for(const choice of item.choices) {
    const input={ReceiptDate:'2026-10-01',ItemID:item.itemId,PurchaseQty:'1',PurchaseUOM:choice.uom,AcquisitionValue:'1000',SupplierSource:'Fixture',ExternalRef:'TEST',ExternalDocumentStatus:'AVAILABLE',Attested:true};
    if(choice.packageIdentity) Object.assign(input,{PackageIdentity:choice.packageIdentity,SupplierRef:choice.supplierRef});
    assert.equal(c.deriveInventoryReceipt_(input,authority).row.Status,'READY',item.item+' '+choice.uom);
    assert.ok(!('conversionId' in choice));
  }
}
const dto={id:'receipt-test',date:'2026-10-01',dateKey:'2026-10-01',transactionType:'InventoryReceipt',item:'Lemon',itemId:'ING-018',purchaseQuantity:'2',purchaseUOM:'kg',acquisitionValue:20000,isActive:true,supplier:'Fixture source',reference:'TEST',financialTotalsIncluded:false};
assert.equal(c.filterTransactionsPeriodRows([dto],{},'recent').length,1);
assert.equal(c.filterTransactionsPeriodRows([dto],{},'sales').length,0);
assert.equal(c.filterTransactionsPeriodRows([dto],{},'expenses').length,0);
assert.equal(c.filterTransactionsPeriodRows([dto],{search:'Lemon'},'recent').length,1);
assert.equal(c.buildTransactionsSearchIndex([dto])[0].item,'Lemon');
const {chromium} = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true, executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 let html=fs.readFileSync(path.join(root,'190.View.Index.html'),'utf8')
  .replace(/<\?!= include\('([^']+)'\); \?>/g,(_,file)=>fs.readFileSync(path.join(root,file+'.html'),'utf8'))
  .replace(/<\?!= HtmlService.createHtmlOutputFromFile\('([^']+)'\).getContent\(\); \?>/g,(_,file)=>fs.readFileSync(path.join(root,file+'.html'),'utf8'))
  .replace(/<\?[\s\S]*?\?>/g,'LOCAL FIXTURE').replace('window.onload = function()','window.fixtureDisabledOnload = function()');
 await page.route('**/*',route=>route.request().url()==='http://numlock.local/'?route.fulfill({contentType:'text/html',body:html}):route.abort());
 await page.goto('http://numlock.local/');
 const installFixtures = ({choices,expenseOptions})=>{
  window.fixtureCalls=[];window.fixturePending=[];
  // Each RPC chain owns its handlers, matching google.script.run chaining.
  window.google={script:{get run(){let success,failure;const api=new Proxy({}, {get(_,name){
   if(name==='withSuccessHandler')return fn=>{success=fn;return api;};
   if(name==='withFailureHandler')return fn=>{failure=fn;return api;};
   return payload=>{fixtureCalls.push({name,payload:payload === undefined ? null : JSON.parse(JSON.stringify(payload))});
    if(name==='getInventoryReceiptEntryOptions')success({success:true,data:{date:payload,items:choices}});
    else if(name==='getTransactionEntryOptions')success({success:true,data:{sales:[],expenses:expenseOptions}});
    else fixturePending.push({success,failure});};}});return api;}}};
  openTransactionEntry();setTransactionEntryType('INVENTORY_RECEIPT');
 };
 const browserFixture = {choices,expenseOptions:JSON.parse(JSON.stringify(c.buildTransactionEntryOptions([],expenses,[],new Date()).expenses))};
 await page.evaluate(installFixtures,browserFixture);
 assert.equal(await page.locator('#transactionTypeFieldset button').count(),3);
 assert.equal(await page.locator('#receiptItem option').count(),23);
 await page.locator('#receiptDate').fill('2026-10-01');
 await page.locator('#receiptDate').dispatchEvent('change');
 for (const item of choices) {
   await page.locator('#receiptItem').selectOption(item.itemId);
   assert.deepEqual(await page.locator('#receiptUom option').allTextContents(),['Select unit or package',...item.choices.map(choice=>choice.label)]);
 }
 await page.locator('#receiptItem').selectOption('ING-018');
 assert.deepEqual(await page.locator('#receiptUom option').allTextContents(),['Select unit or package','gr','kg']);
 await page.locator('#submitTransactionEntryButton').click();
 for(const field of ['Qty','Uom','Cost','Supplier','Reference','Attested'])assert.notEqual(await page.locator('#receipt'+field+'Error').innerText(),'');
 await page.locator('#receiptQty').fill('2');await page.locator('#receiptUom').selectOption('1');await page.locator('#receiptCost').fill('20000');await page.locator('#receiptSupplier').fill('Fixture');await page.locator('#receiptUnavailable').check();await page.locator('#receiptAttested').check();
 assert.equal(await page.locator('#receiptReference').isDisabled(),true);
 await page.evaluate(()=>{submitTransactionEntry({preventDefault(){}});submitTransactionEntry({preventDefault(){}});});
 let calls=await page.evaluate(()=>fixtureCalls.filter(c=>c.name==='submitCanonicalTransaction'));
 assert.equal(calls.length,1);const payload=calls[0].payload;
 assert.equal(payload.transactionType,'INVENTORY_RECEIPT');assert.equal(payload.input.ItemID,'ING-018');assert.equal(payload.input.ExternalDocumentStatus,'EXTERNAL_DOCUMENT_UNAVAILABLE');assert.ok(!JSON.stringify(payload).includes('expenseItemId'));
 await page.evaluate(()=>{fixturePending.shift().failure();closeTransactionEntry();openTransactionEntry();setTransactionEntryType('EXPENSE');});
 assert.equal(await page.evaluate(()=>transactionEntryState.transactionType),'INVENTORY_RECEIPT');
 assert.match(await page.locator('#transactionEntryGeneralError').innerText(),/uncertain/);
 await page.reload();
 await page.evaluate(installFixtures,browserFixture);
 assert.equal(await page.evaluate(()=>transactionEntryState.receiptPayload.requestKey),payload.requestKey);
 await page.locator('#receiptRecovery').click();
 calls=await page.evaluate(()=>fixtureCalls.filter(c=>c.name==='submitCanonicalTransaction'));assert.deepEqual(calls[0].payload,payload);
 await page.evaluate(()=>fixturePending.shift().success({status:'RECEIPT_CAPTURED',writeCount:1}));
 assert.match(await page.locator('#transactionEntryGeneralError').innerText(),/tracking is pending/);
 await page.locator('#receiptRecovery').click();await page.evaluate(()=>fixturePending.shift().success({status:'CONFLICT',writeCount:0}));
 assert.match(await page.locator('#transactionEntryGeneralError').innerText(),/conflicts/);
 await page.locator('#receiptRecovery').click();await page.evaluate(()=>fixturePending.shift().success({status:'NOT_STARTED',reason:'PRODUCTION_OPERATIONAL_POSTING_DISABLED',writeCount:0}));
 assert.equal(await page.evaluate(()=>transactionEntryState.receiptUnresolved),true);
 await page.locator('#receiptRecovery').click();await page.evaluate(dto=>fixturePending.shift().success({success:true,status:'OPERATIONAL_POSTED',data:dto}),dto);
 assert.equal(await page.locator('#transactionEntrySuccess').isVisible(),true);
 await page.evaluate(()=>resetTransactionEntryForAnother());await page.locator('#transactionTypeExpense').click();
 assert.equal(await page.evaluate(()=>transactionEntryState.entryOptions.expenses.length),7);
 await page.evaluate(()=>{transactionEntryState.selectedExpense={expenseItemId:'OSS01'};transactionEntryState.amount=123;setTransactionEntryType('INVENTORY_RECEIPT');});
 assert.equal(await page.evaluate(()=>transactionEntryState.selectedExpense),null);
 await page.locator('#receiptItem').selectOption('ING-018');await page.locator('#receiptUom').selectOption('0');await page.locator('#receiptQty').fill('1');await page.locator('#receiptCost').fill('1000');await page.locator('#receiptSupplier').fill('Test');await page.locator('#receiptReference').fill('TEST');await page.locator('#receiptAttested').check();
 await page.locator('#submitTransactionEntryButton').click();await page.evaluate(()=>fixturePending.shift().success({status:'NOT_STARTED',reason:'PRODUCTION_OPERATIONAL_POSTING_DISABLED',writeCount:0}));
 assert.equal(await page.locator('#transactionEntryGeneralError').innerText(),'Inventory purchase tracking is not active yet.');
 assert.equal(await page.evaluate(()=>transactionEntryState.receiptUnresolved),false);
 assert.equal(await page.locator('#receiptRecovery').isVisible(),false);
 await page.evaluate(()=>document.getElementById('transactionEntryScroll').scrollTop=0);
 await page.screenshot({path:path.join(__dirname,'desktop-receipt.png')});
 await page.evaluate(dto=>{closeTransactionEntry();latestLifecycleTransactions=[dto];renderTransactionRows([dto]);openTransactionDetail(dto.id);},dto);
 assert.match(await page.locator('#transactionLifecycleContent').innerText(),/Lemon/);
 assert.doesNotMatch(await page.locator('#transactionLifecycleContent').innerText(),/Stock on Hand|Available Stock|Low Stock|AccountingJournalID/);
 assert.equal(await page.locator('.transactions-row-action--correct').count(),0);
 assert.match(await page.evaluate(()=>initializeStableDashboardElements().tableBody.innerText),/Buy & receive/);
 const ordinary=new Set(['OSS01','OSK02','OUR01','OUS01','OUS02','OUS03','OUS04']);
 const historical=JSON.parse(JSON.stringify(expenses.filter(e=>!ordinary.has(e.ID_Ops)).map((e,i)=>({id:'OPS-HIST-'+i,date:'2026-01-01',transactionType:'Expense',purchaseCategory:e.Item,expense:1000,isActive:true,source:'XLSM'}))));
 const historicalDisplay=await page.evaluate(rows=>{
   closeTransactionLifecycleDialog();renderTransactionRows(rows);
   return rows.map(row=>{const detail=buildLocalTransactionDetail(row);renderTransactionDetail(detail);return {item:detail.item,content:initializeStableDashboardElements().lifecycle.content.innerText};});
 },historical);
 assert.equal(historicalDisplay.length,27);
 historicalDisplay.forEach((result,i)=>{assert.equal(result.item,historical[i].purchaseCategory);assert.ok(result.content.includes(result.item));});
 await page.evaluate(()=>{closeTransactionLifecycleDialog();openTransactionEntry();setTransactionEntryType('SALES');});
 await page.evaluate(()=>{
   transactionEntryState.selectedProduct={productId:'P1'};transactionEntryState.selectedType='Hot';transactionEntryState.qty=2;
   transactionEntryState.pricing={price:10000,hpp:4000};updateTransactionEntrySubmitState();submitTransactionEntry({preventDefault(){}});
 });
 assert.deepEqual(await page.evaluate(()=>fixtureCalls.at(-1).payload),{transactionType:'SALES',productId:'P1',type:'Hot',qty:2});
 await page.evaluate(()=>fixturePending.shift().success({success:true,data:{id:'SAL-FIXTURE',product:'Coffee',type:'Hot',qty:2,revenue:20000}}));
 await page.evaluate(()=>{resetTransactionEntryForAnother();setTransactionEntryType('EXPENSE');transactionEntryState.selectedExpense={expenseItemId:'OSS01'};transactionEntryState.amount=15000;updateTransactionEntrySubmitState();submitTransactionEntry({preventDefault(){}});});
 assert.deepEqual(await page.evaluate(()=>fixtureCalls.at(-1).payload),{transactionType:'EXPENSE',expenseItemId:'OSS01',amount:15000});
 await page.evaluate(()=>fixturePending.shift().success({success:true,data:{id:'OPS-FIXTURE',item:'Ordinary expense',amount:15000}}));
 await page.evaluate(()=>{resetTransactionEntryForAnother();setTransactionEntryType('SALES');});
 assert.equal(await page.locator('#salesEntryFields').isVisible(),true);assert.equal(await page.locator('#receiptEntryFields').isVisible(),false);
 assert.equal(await page.locator('#receiptItem').inputValue(),'');
 await page.evaluate(()=>setTransactionEntryType('INVENTORY_RECEIPT'));
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:path.join(__dirname,'narrow-receipt.png')});
 assert.deepEqual(pageErrors,[]);
 console.log('PASS: local Chromium three modes, 22 items, 7 expenses, validation, evidence, stable identity, duplicate guard, canonical dispatch, disabled/conflict/pending/uncertain recovery, receipt detail, desktop and narrow containment');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
