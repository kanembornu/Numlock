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
console.log('PASS: frozen 22-authority validation, Lemon exact quantities and unrounded cost');
const receipt = c.testInventoryReceiptFoundationContracts(authority);
assert.equal(receipt.status, 'PASS');
console.log(`PASS: receipt foundation ${receipt.scenarios} scenarios`);
for (const name of ['testInventoryFoundationContracts', 'testInventorySchemaMigrationContract', 'testInventoryConversionAuthorityContracts', 'testInventoryOperatorAttestationContracts', 'testInventoryOpeningStagingContracts', 'testInventoryLemonOperationalStandardContracts', 'testInventoryLemonProductionFlowContracts']) {
  c[name]();
  console.log('PASS: ' + name + ' (local fixtures)');
}
assert.equal(JSON.stringify(authority), before);
assert.equal(c.BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED, false);
assert.equal(c.INVENTORY_OPENING_STAGING_POLICY.PROHIBITED_ITEM_ID, 'ING-018');
assert.equal(c.INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.length, 21);
assert.equal(c.INVENTORY_OPENING_REVIEW_POLICY.EXPECTED_COUNT, 21);
const source = fs.readFileSync(path.join(root, '42.Inventory.Receipt.Foundation.js'), 'utf8');
assert.ok(!/\b(SpreadsheetApp|DriveApp|UrlFetchApp|LockService|Utilities)\s*\./.test(source), 'no live service factory');
assert.ok(!/\b(?:tabsal|HPP|COGSIngredients|COGSRecipes)\b/.test(source), 'no costing or expense-derived acquisition authority');
assert.ok([...source.matchAll(/function\s+(\w+)\s*\(/g)].every(match => match[1].endsWith('_')), 'private foundation functions');
const claspignore = fs.readFileSync(path.join(root, '.claspignore'), 'utf8');
assert.ok(!claspignore.includes('!42.Inventory.Receipt.Foundation.js'));
assert.ok(!claspignore.includes('!96.Tests.Inventory.Receipt.Cases.js'));
console.log('PASS: opening scope, disabled recipe consumption, local-only source and upload exclusion');
