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
assert.equal(authority.conversions.length, 22);
assert.equal(c.validateInventoryUomConversions(authority.conversions, authority.items).status, 'PASS');
const before = JSON.stringify(authority);
const conversion = authority.conversions.find(r => r.ItemID === 'ING-018');
const p = { ReceiptDate: '2026-10-01', ItemID: 'ING-018', PurchaseQty: '500', PurchaseUOM: 'gr', AcquisitionValue: '10001', SupplierSource: 'Test source', Attested: true, ExternalDocumentStatus: 'EXTERNAL_DOCUMENT_UNAVAILABLE' };
assert.equal(c.deriveInventoryReceipt_(p, authority).row.BaseQtyReceived, '12');
assert.equal(c.deriveInventoryReceipt_({ ...p, PurchaseQty: '0.5', PurchaseUOM: 'kg' }, authority).row.BaseQtyReceived, '12');
assert.equal(c.deriveInventoryReceipt_(p, authority).row.UnitCostRatio, '10001/12');
assert.throws(() => c.deriveInventoryReceipt_({ ...p, PurchaseUOM: 'bag' }, authority), /LEMON_MEASURED/);
assert.equal(JSON.stringify(authority), before);

const r = c.inventoryReceiptTestRuntime_(authority);
c.migrateInventoryReceiptSchema_(r);
const receipt = c.captureInventoryReceipt_({idempotencyKey: 'tracking-0001', input:p}, r).row;
const activation = {enabled:true, effectiveFrom:'2026-10-01', timezone:'Asia/Jakarta'};
const context = {receipts:[receipt], activation};
const movement = c.inventoryReceiptOperationalMovement_(receipt, authority.items, activation);
assert.equal(movement.QtyIn, '12');
assert.equal(movement.AccountingJournalID, '');
assert.equal(c.validateInventoryLedgerCandidates([movement], authority.items, {operationalReceipts:context}).status, 'PASS');
assert.equal(c.validateInventoryLedgerCandidates([movement], authority.items).status, 'FAIL');
const tracked = c.buildInventoryReceiptTracking_([movement], authority.items, context);
assert.equal(tracked.states['ING-018|MAIN'].AverageTrackedReceiptCost, '10001/12');
assert.equal(tracked.states[authority.items.find(i=>i.ItemID !== 'ING-018').ItemID + '|MAIN'].TrackingState, 'UNTRACKED');
assert.throws(()=>c.buildMovingWeightedAverageCandidates([movement], authority.items, {operationalReceipts:context}), /NOT_REMAINING/);
console.log('PASS: first-receipt authority, narrow journal exception, tracked receipt read model');
console.log(JSON.stringify(c.testInventoryReceiptOperationalContracts(authority)));
console.log(JSON.stringify(c.testInventoryReceiptFoundationContracts(authority)));
for (const name of ['testInventoryFoundationContracts', 'testInventorySchemaMigrationContract', 'testInventoryConversionAuthorityContracts', 'testInventoryOpeningStagingContracts', 'testInventoryReceiptMigrationContracts']) {
  c[name](); console.log('PASS: ' + name);
}
assert.equal(c.inventoryReceiptPersistenceProof_(authority).status, 'PASS');
const operationalSource = fs.readFileSync(path.join(root, '44.Inventory.Receipt.Operational.js'), 'utf8');
assert.ok(!/\b(SpreadsheetApp|DriveApp|UrlFetchApp|LockService)\s*\./.test(operationalSource));
assert.ok([...operationalSource.matchAll(/function\s+(\w+)\s*\(/g)].every(m => m[1].endsWith('_')));
assert.equal(c.INVENTORY_RECEIPT_OPERATIONAL_POLICY.PRODUCTION_ENABLED, false);
assert.equal(c.INVENTORY_RECEIPT_POLICY.HEADERS.length, 31);
assert.equal(c.BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.length, 23);
assert.ok(!fs.readFileSync(path.join(root, '.claspignore'), 'utf8').includes('!44.Inventory.Receipt.Operational.js'));
assert.equal(JSON.stringify(authority), before);
console.log('PASS: receipt persistence regression, exact schemas, authority preservation, production disabled and upload excluded');
// Optional broad gate requires an Apps Script service harness; failures remain failures.
if (process.argv.includes('--unified')) c.runAllBackendTests();
