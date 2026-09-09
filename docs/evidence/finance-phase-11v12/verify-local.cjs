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
console.log(c.testExpensePurchasePolicyContracts());
console.log(c.testPurchaseEventOrchestrationContracts(authority, expenses));
const routes=c.validateExpensePurchasePolicy_(expenses);
assert.equal(Object.keys(routes).length,34);
for(const [id,links] of Object.entries({OSR01:['ING-004','ING-005'],OSR03:['ING-007','ING-008'],OSR21:['ING-012','ING-013','ING-014'],OSR02:['ING-006'],OSR19:['ING-009'],OSR20:['ING-010']}))assert.deepEqual(Array.from(routes[id].inventoryItemIds),links);
console.log('PASS: focused policy coverage and approved component relationships');

for(const expense of expenses) {
 const route=routes[expense.ID_Ops];
 assert.equal(route.labelAuthority,'ExpenseItems.Item');
 if(!c.expensePolicyIsPurchase_(route))continue;
 const request=c.normalizePurchaseEventRequest_({transactionType:'EXPENSE',requestKey:'label-test-'+expense.ID_Ops,expenseItemId:expense.ID_Ops,input:{ExpenseDate:'2026-10-01',AcquisitionValue:'12345',SupplierSource:'TEST',ExternalDocumentStatus:'EXTERNAL_DOCUMENT_UNAVAILABLE',Attested:true}});
 const row=c.buildPurchaseEvent_(request,expenses,authority,{actor:'TEST',at:'2026-10-01T00:00:00Z'});
 assert.equal(row.BusinessLabel,expense.Item);assert.equal(row.ReceiptPlan,'null');
 assert.equal(c.projectPurchaseEventTransaction_(row).financialTotalsIncluded,false);
}
assert.equal(routes.OSS01.CostType,'FIXED_COST');
for(const id of ['OSK02','OSK05','OUR01','OEE01'])assert.equal(routes[id].PurchaseRelationship,'NON_HPP_VARIABLE_COST');
assert.equal(routes.OUU01.prospectiveEligible,false);
assert.equal(routes.OSR16.PurchaseRelationship,'HPP_COST_POOL_PACKAGE_UNRESOLVED');
console.log('PASS: business labels, hold, cost-only capture and non-financial projection');
