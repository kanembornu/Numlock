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
const crypto = require('node:crypto');
const expenseSnapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '../finance-phase-11v8/expense-items.snapshot.json')));
const expenses = expenseSnapshot.values.slice(1).map(row => Object.fromEntries(expenseSnapshot.values[0].map((h, i) => [h, row[i]])));
function formatDate(date, timezone, format) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date).map(p=>[p.type,p.value]));
  const d = fields;
  if (format === 'yyyyMMdd') return d.year+d.month+d.day;
  return format.replace(/yyyy|MM|dd|HH|mm|ss|XXX|'T'/g, token=>({yyyy:d.year,MM:d.month,dd:d.day,HH:d.hour,mm:d.minute,ss:d.second,XXX:'+07:00',"'T'":'T'})[token]);
}
c.Utilities = { formatDate, getUuid: () => crypto.randomUUID() };

const clone=x=>JSON.parse(JSON.stringify(x));
function check(v,label){assert.ok(v,label);}
let f=c.purchaseEventTestFixture_(authority,expenses,check,'OSK03');
f.request.input.PurchaseUOM='unsupported-package';
let result=f.run();assert.equal(result.status,'PURCHASE_CAPTURED');assert.equal(f.events[0].AllocationStatus,'QUANTITY_PACKAGE_UNRESOLVED');assert.equal(f.events[0].ReceiptPlan,'null');assert.equal(f.ledger.length,0);assert.equal(f.capture.sheets.InventoryReceipts.grid.length,1);assert.match(result.data.operationalNote,/not verified/);
assert.equal(f.run().writeCount,0);
f=c.purchaseEventTestFixture_(authority,expenses,check,'OSK03');
const conversion=authority.conversions.find(x=>x.ItemID==='ING-020');
Object.assign(f.request.input,{PurchaseUOM:conversion.FromUOM.toLowerCase(),PackageIdentity:conversion.PackageIdentity,SupplierRef:conversion.SupplierRef});
result=f.run();assert.equal(result.status,'OPERATIONAL_POSTED');assert.equal(f.events.length,1);assert.equal(f.ledger.length,1);assert.equal(f.capture.sheets.InventoryReceipts.grid.length,2);assert.equal(f.run().writeCount,0);
const dto=c.projectPurchaseEventTransaction_(f.events[0]);
assert.equal(dto.item,expenses.find(e=>e.ID_Ops==='OSK03').Item);assert.equal(dto.financialTotalsIncluded,false);
assert.equal(c.filterTransactionsPeriodRows([dto],{},'recent').length,1);
assert.equal(c.filterTransactionsPeriodRows([dto],{search:dto.item.toLowerCase()},'recent').length,1);
assert.equal(c.filterTransactionsPeriodRows([dto],{drilldownType:'purchase'},'recent').length,1);
assert.equal(c.filterTransactionsPeriodRows([dto],{drilldownType:'month',drilldownValue:'2026-10'},'recent').length,1);
assert.equal(c.filterTransactionsPeriodRows([dto],{},'expenses').length,0);
assert.equal(c.filterTransactionsPeriodRows([dto],{},'sales').length,0);
assert.equal(c.buildTransactionsSearchIndex([dto])[0].item,dto.item);
function sheet(headers,rows){return {getDataRange:()=>({getValues:()=>[Array.from(headers),...rows.map(r=>Array.from(headers,h=>r[h]))]})};}
const ss={getSheetByName:name=>({PurchaseEvents:sheet(c.PURCHASE_EVENT_POLICY.headers,f.events),InventoryReceipts:f.capture.sheets.InventoryReceipts,InventoryItems:sheet(c.BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS,authority.items)})[name]||null};
f.runtime.lock.waitLock(30000);
try {
assert.equal(c.readPurchaseEventTransactionRows_(ss)[0].item,dto.item);
assert.equal(c.readInventoryReceiptTransactionRows_(ss,[dto]).length,0);
assert.equal(c.readInventoryReceiptTransactionRows_(ss).length,1);
const cache=new Map();c.CacheService={getScriptCache:()=>({get:k=>cache.get(k),getAll:keys=>Object.fromEntries(keys.map(k=>[k,cache.get(k)])),put:(k,v)=>cache.set(k,v),putAll:o=>Object.entries(o).forEach(([k,v])=>cache.set(k,v))})};
c.SpreadsheetApp={getActiveSpreadsheet:()=>ss};c.getDashboardCacheRevision=()=> 'D1';
const originalCanonical=c.getCanonicalTransactionData;c.getCanonicalTransactionData=()=>({lifecycleRecords:[]});
const range={startDate:'2026-10-01',endDate:'2026-10-01'};
let page=c.getTransactionsPeriodRows(range);assert.equal(page.rows.length,1);assert.equal(page.rows[0].item,dto.item);assert.equal(page.rows[0].transactionType,'PurchaseEvent');assert.equal(c.getTransactionsPeriodRows(range).cacheHit,true);
assert.equal(c.getTransactionsPeriodRows({startDate:'2026-10-02',endDate:'2026-10-03'}).rows.length,0);
c.getCanonicalTransactionData=originalCanonical;
} finally { f.runtime.lock.releaseLock(); }
console.log('PASS: unresolved cost-only, governed package downstream, retry, PurchaseEvent reader/cache/date/search/filter integration, child receipt suppression and financial exclusion');
for(const name of ['testCanonicalTransactionAdapter','testProductPricingResolution','testCanonicalTransactionEntryService','testCanonicalTransactionLifecycleService','testCanonicalLifecycleTransportSerialization','testCanonicalHistoricalAndOverlapControls']){c[name]();console.log('PASS: '+name);}
console.log(c.testCanonicalPurchaseDispatcherContracts(authority,expenses));
