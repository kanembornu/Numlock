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
console.log(c.testCanonicalPurchaseDispatcherContracts(authority, expenses));
console.log(c.testPurchaseEventOrchestrationContracts(authority, expenses));
for(const name of ['testCanonicalTransactionAdapter','testProductPricingResolution','testCanonicalTransactionEntryService','testCanonicalTransactionLifecycleService','testCanonicalLifecycleTransportSerialization','testCanonicalHistoricalAndOverlapControls','testFinanceCoreBackendContract']) { c[name]();console.log('PASS: '+name); }
// Actual public wrapper under synthetic Google services. No real Google calls.
let held=false,attempts=0;
c.LockService={getScriptLock:()=>({waitLock(){assert.equal(held,false);held=true;},releaseLock(){held=false;},hasLock(){return held;}})};
c.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:name=>{
 assert.equal(name,'ExpenseItems');return {getDataRange:()=>({getValues:()=>expenseSnapshot.values})};
}}),flush(){attempts++;throw new Error('UNEXPECTED_WRITE');}};
const realPayload={transactionType:'EXPENSE',expenseItemId:'OSR04',requestKey:'public-test-0001',input:{ExpenseDate:'2026-10-01',AcquisitionValue:'10000',SupplierSource:'TEST',ExternalDocumentStatus:'EXTERNAL_DOCUMENT_UNAVAILABLE',Attested:true}};
const publicResult=c.submitCanonicalTransaction(realPayload,{environment:'LOCAL_FIXTURE',enabled:true,appendEvent(){attempts++;}});
assert.equal(publicResult.reason,'PRODUCTION_PURCHASE_DISABLED');assert.equal(publicResult.writeCount,0);assert.equal(attempts,0);assert.equal(held,false);
console.log('PASS: public wrapper ignores extra runtime argument; production purchase disabled, zero writes');
