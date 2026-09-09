// Local VM and frozen POST-11U snapshot only; no network or Google services.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const c = { Logger: { log() {} }, console };
vm.createContext(c);
for (const file of fs.readdirSync(root).filter(f => /^\d.*\.js$/.test(f)).sort()) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file });
}
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'docs/evidence/finance-phase-11u2e/POST-11U.snapshot.json')));
function table(name) {
  const entry = snapshot.ranges.find(r => r.range.startsWith(name + '!'));
  const sheet = entry.data.sheets[0];
  const grid = sheet.data[0].rowData.map(r => (r.values || []).map(cell => {
    const value = cell.effectiveValue || {};
    return value.stringValue ?? value.numberValue ?? value.boolValue ?? '';
  }));
  const headers = grid[0];
  return grid.slice(1).filter(r => r.some(v => v !== '')).map(row => Object.fromEntries(headers.filter(Boolean).map((h, i) => {
    let value = row[i] ?? '';
    if (typeof value === 'number' && /^(EffectiveFrom|EffectiveTo|EvidenceDate)$/.test(h)) value = new Date((value - 25569) * 86400000).toISOString().slice(0, 10);
    if (typeof value === 'number' && /^(PreparedAt|ReviewedAt|CreatedAt|UpdatedAt)$/.test(h)) value = new Date(Math.round((value - 25569) * 86400000)).toISOString();
    return [h, value];
  })));
}
const authority = { items: table('InventoryItems'), conversions: table('InventoryUOMConversions') };
console.log(JSON.stringify(c.testInventoryReceiptOrchestrationContracts(authority)));
const crypto = require('node:crypto');
const expenseSnapshot = JSON.parse(fs.readFileSync(path.join(__dirname, 'expense-items.snapshot.json')));
const expenses = expenseSnapshot.values.slice(1).map(row => Object.fromEntries(expenseSnapshot.values[0].map((h, i) => [h, row[i]])));
assert.equal(c.validateInventoryExpenseRouting_(expenses, c.INVENTORY_EXPENSE_ROUTING).activeCount, 34);
assert.ok(c.INVENTORY_EXPENSE_ROUTING.rows.every(row => row.classification === 'BLOCKED'));
console.log('PASS: live-read snapshot coverage, 34/34 IDs; all unresolved mappings explicitly BLOCKED');
function formatDate(date, timezone, format) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date).map(p=>[p.type,p.value]));
  const d = fields;
  if (format === 'yyyyMMdd') return d.year+d.month+d.day;
  return format.replace(/yyyy|MM|dd|HH|mm|ss|XXX|'T'/g, token=>({yyyy:d.year,MM:d.month,dd:d.day,HH:d.hour,mm:d.minute,ss:d.second,XXX:'+07:00',"'T'":'T'})[token]);
}
c.Utilities = { formatDate, getUuid: () => crypto.randomUUID() };
let held = false, acquisitions = 0, mutations = [], tables = {};
const lock = {waitLock() { assert.equal(held,false); held=true; acquisitions++; }, hasLock() { return held; }, releaseLock() { assert.equal(held,true); held=false; }};
function sheet(name, grid) {
  return {grid:structuredClone(grid), getLastRow() { return this.grid.length; }, getLastColumn() { return this.grid[0].length; },
    getDataRange() { return this.getRange(1,1,this.grid.length,this.grid[0].length); },
    deleteRow(n) { mutations.push([name,'delete']); this.grid.splice(n-1,1); },
    getRange(row,col,height=1,width=1) { const self=this; return {
      getValues() { return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>self.grid[row-1+i]?.[col-1+j]??'')); },
      getValue() { return self.grid[row-1]?.[col-1]??''; },
      setValues(values) { assert.equal(held,true); mutations.push([name,'write']); for(let i=0;i<height;i++) { self.grid[row-1+i]??=[]; for(let j=0;j<width;j++)self.grid[row-1+i][col-1+j]=values[i][j]; } }
    }; }
  };
}
const ss = {getSheetByName(name) { return tables[name] || null; }};
c.LockService = {getScriptLock:()=>lock};
c.SpreadsheetApp = {getActiveSpreadsheet:()=>ss, flush() {}};
const originalInvalidator = c.invalidateDashboardCache;
c.invalidateDashboardCache = ()=>{};
const productionRegistry = c.INVENTORY_EXPENSE_ROUTING;
function resetDispatcher(classification='ORDINARY_EXPENSE') {
  mutations=[]; tables={};
  for (const [name,grid] of Object.entries({
    tabsal:[Array.from(c.CANONICAL_ENTRY.SALES_HEADERS)],tabops:[Array.from(c.CANONICAL_ENTRY.EXPENSE_HEADERS)],Logs:[Array.from(c.CANONICAL_ENTRY.LOG_HEADERS)],
    Products:[['ID_Prod','Produk','Kategori','Kind','IsActive'],['P1','Test','Test','Test',true]],
    ProductPricing:[['ID_Prod','Tipe','EffectiveFrom','EffectiveTo','HPP','Harga','IsActive'],['P1','Hot',new Date('2020-01-01'),'',4000,10000,true]],
    ExpenseItems:[['ID_Ops','Item','Kategori','Kind','Group','AccountCode','IsActive'],['E1','Test','Test','Test','Test','6100',true]],
    Accounts:[['AccountCode','IsActive'],['6100',true]]
  })) tables[name]=sheet(name,grid);
  c.INVENTORY_EXPENSE_ROUTING={version:'TEST',revision:1,evidenceRef:'SYNTHETIC',rows:[{expenseItemId:'E1',classification,itemId:classification==='INVENTORY_ITEM'?'ING-018':'',reason:'TEST'}]};
}
resetDispatcher();
let r=c.submitCanonicalTransaction({transactionType:'SALES',productId:'P1',type:'Hot',qty:3});
assert.equal(r.success,true); assert.equal(r.data.cogs,12000);assert.equal(tables.tabsal.grid[1][5],4000);
assert.deepEqual(mutations.map(m=>m[0]),['tabsal','Logs']);
resetDispatcher();r=c.submitCanonicalTransaction({transactionType:'EXPENSE',expenseItemId:'E1',amount:75000});
assert.equal(r.success,true);assert.equal(tables.tabops.grid[1][3],75000);assert.deepEqual(mutations.map(m=>m[0]),['tabops','Logs']);
for(const type of [undefined,null,{},'','BOGUS',' SALES ']) { resetDispatcher();const before=acquisitions;r=c.submitCanonicalTransaction({transactionType:type});assert.equal(r.status,'REFUSED');assert.equal(r.writeCount,0);assert.equal(acquisitions,before);assert.equal(mutations.length,0); }
for (const classification of ['BLOCKED','INVENTORY_ITEM']) {
  resetDispatcher(classification);r=c.submitCanonicalTransaction({transactionType:'EXPENSE',expenseItemId:'E1',requestKey:'request-0001',input:{}});
  assert.equal(r.success,false);assert.equal(r.writeCount,0);assert.equal(mutations.length,0);
}
resetDispatcher();c.INVENTORY_EXPENSE_ROUTING.rows=[];r=c.submitCanonicalTransaction({transactionType:'EXPENSE',expenseItemId:'E1',amount:1});assert.equal(r.status,'REFUSED');assert.equal(mutations.length,0);
resetDispatcher();c.INVENTORY_EXPENSE_ROUTING.rows.push(c.INVENTORY_EXPENSE_ROUTING.rows[0]);r=c.submitCanonicalTransaction({transactionType:'EXPENSE',expenseItemId:'E1',amount:1});assert.equal(r.status,'REFUSED');assert.equal(mutations.length,0);
resetDispatcher();r=c.submitCanonicalTransaction({transactionType:'INVENTORY_RECEIPT',expenseItemId:'E1',requestKey:'request-0001',input:{}});
assert.equal(r.reason,'PRODUCTION_OPERATIONAL_POSTING_DISABLED');assert.equal(r.writeCount,0);assert.equal(mutations.length,0);
c.INVENTORY_EXPENSE_ROUTING=productionRegistry;c.invalidateDashboardCache=originalInvalidator;
console.log('PASS: actual public dispatcher, Sales HPP, ordinary Expense persistence, explicit types, exclusive inventory routing, disabled zero writes');
for (const name of ['testCanonicalTransactionAdapter','testProductPricingResolution','testCanonicalTransactionEntryService','testCanonicalTransactionLifecycleService','testCanonicalLifecycleTransportSerialization','testCanonicalHistoricalAndOverlapControls','testInventoryFoundationContracts','testInventorySchemaMigrationContract','testInventoryConversionAuthorityContracts','testInventoryOpeningStagingContracts','testInventoryReceiptMigrationContracts','testFinanceCoreBackendContract']) {
  c[name]();console.log('PASS: '+name);
}
for(const name of ['testInventoryReceiptFoundationContracts','testInventoryReceiptOperationalContracts']) console.log(name, JSON.stringify(c[name](authority)));
assert.equal(c.inventoryReceiptPersistenceProof_(authority).status,'PASS');
assert.equal(c.BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED,false);
assert.equal(c.INVENTORY_RECEIPT_ACTIVATION.enabled,false);
assert.equal(c.INVENTORY_RECEIPT_OPERATIONAL_POLICY.PRODUCTION_ENABLED,false);
console.log('PASS: receipt persistence and posted correction guards; production, accounting and recipe activation remain disabled');
const html = name => fs.readFileSync(path.join(root,name+'.html'),'utf8');
c.HtmlService = {createHtmlOutputFromFile:name=>({getContent:()=>html(name)}),createTemplateFromFile:name=>({getRawContent:()=>html(name)})};
c.Session={getScriptTimeZone:()=> 'Asia/Jakarta'};
for(const name of ['testTransactionEntryUiContract','testTransactionLifecycleUiContract','testTransactionsVisualContract']) { c[name]();console.log('PASS: '+name+' (static source only)'); }
if (process.argv.includes('--unified')) {
  const cache = new Map(), properties = new Map();
  c.CacheService={getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),getAll:keys=>Object.fromEntries(keys.map(k=>[k,cache.get(k)])),putAll:values=>Object.entries(values).forEach(([k,v])=>cache.set(k,v))})};
  c.PropertiesService={getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v)})};
  c.Logger={log:message=>{if(/PASS:|FAIL|SUMMARY|passed/i.test(String(message))) console.log(message);}};
  c.runAllBackendTests();
}
