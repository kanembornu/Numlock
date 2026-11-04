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
const result = c.inventoryReceiptPersistenceProof_(authority);
assert.equal(result.status, 'PASS');
assert.equal(result.initialWriteCount, 1);
assert.equal(result.initialMutationCalls, 2);
console.log(JSON.stringify(result));
const state = { InventoryReceipts: { exists: false }, InventoryItems: { exists: true, values: [] }, InventoryUOMConversions: { exists: true, values: [] }, Accounts: { exists: true, values: [['AccountCode'], ['1100'], ['3200']] } };
for (const [key, rows] of [['InventoryItems', authority.items], ['InventoryUOMConversions', authority.conversions]]) {
  const headers = Object.keys(rows[0]);
  state[key].values = [headers, ...rows.map(row => headers.map(h => row[h]))];
}
let reads = 0;
c.inventoryReceiptProofProductionSnapshot_ = () => { reads++; return structuredClone(state); };
assert.equal(c.runInventoryReceiptDisposableRuntimeProof().preservation, 'PASS_PROSPECTIVE_VALUES_FORMULAS_NOTES_DIMENSIONS');
assert.equal(reads, 2);
reads = 0;
c.inventoryReceiptProofProductionSnapshot_ = () => { const s = structuredClone(state); if (++reads === 2) s.Accounts.values[1][0] = 'DRIFT'; return s; };
assert.throws(() => c.runInventoryReceiptDisposableRuntimeProof(), /PROSPECTIVE_PRODUCTION_PRESERVATION_FAILED/);
console.log('PASS: local wrapper prospective reread and drift refusal');
