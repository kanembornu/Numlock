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
assert.equal(c.inventoryReceiptOperationalProof_(authority).status, 'PASS');
console.log('PASS: focused operational proof in local VM only');

const crypto = require("node:crypto");
const raw = fs.readFileSync(path.join(root, 'docs/evidence/finance-phase-11u2e/POST-11U.snapshot.json'));
const frozen = JSON.parse(raw);
const fingerprints = JSON.parse(fs.readFileSync(path.join(root, 'docs/evidence/finance-phase-11u2e/POST-11U.fingerprints.json')));
assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), fingerprints.snapshotFileSHA256);
const apiSnapshot = structuredClone(frozen.metadata);
for (const sheet of apiSnapshot.sheets) {
  sheet.data = [];
  for (const range of frozen.ranges) for (const source of range.data.sheets) {
    if (source.properties.title === sheet.properties.title) sheet.data.push(...source.data);
  }
}
const digest = value => crypto.createHash('sha256').update(c.inventoryReceiptMigrationCanonical_(value)).digest('hex');
for (const [name, hash] of Object.entries(fingerprints.sheets)) {
  assert.equal(digest(c.inventoryReceiptMigrationSheet_(apiSnapshot.sheets.find(s => s.properties.title === name))), hash, name);
  assert.equal(c.INVENTORY_RECEIPT_POST11U[name], hash);
}
// Unrecorded sheets here are fixture-only empty grids, never claims about current production.
let state = structuredClone(apiSnapshot), mutations = 0, reads = 0;
const runtime = { read() { reads++; return structuredClone(state); }, digest, batch(body) {
  mutations++;
  const [add, update, meta] = body.requests;
  state.sheets.push({ properties: { ...structuredClone(add.addSheet.properties), sheetType: 'GRID' },
    developerMetadata: [structuredClone(meta.createDeveloperMetadata.developerMetadata)], data: [{ rowData: structuredClone(update.updateCells.rows) }] });
} };
assert.equal(c.inventoryReceiptMigrationEvaluate_(state, digest).status, 'READY_CREATE');
const migrated = c.executeInventoryReceiptProductionMigration_(runtime);
assert.equal(migrated.status, 'MIGRATED'); assert.equal(migrated.writeCount, 1);
assert.equal(mutations, 1); assert.equal(reads, 1);
const acceptance = c.inventoryReceiptMigrationEvaluate_(state, digest);
assert.equal(acceptance.status, 'ALREADY_MIGRATED'); assert.equal(acceptance.businessRows, 0);
assert.equal(acceptance.writeCount, 0); assert.equal(acceptance.postingAllowed, false);
assert.equal(c.executeInventoryReceiptProductionMigration_(runtime).status, 'ALREADY_MIGRATED'); assert.equal(mutations, 1);

c.inventoryReceiptMigrationDigest_ = digest;
c.inventoryReceiptMigrationRead_ = () => { reads++; return structuredClone(state); };
let startReads = reads;
assert.equal(c.runInventoryReceiptOperationalDisposableRuntimeProof().status, 'PASS');
assert.equal(reads - startReads, 2);
startReads = reads;
c.inventoryReceiptMigrationRead_ = () => {
  reads++;
  const copy = structuredClone(state);
  if (reads - startReads === 2) copy.properties.title += 'DRIFT';
  return copy;
};
assert.throws(() => c.runInventoryReceiptOperationalDisposableRuntimeProof(), /PROSPECTIVE_PRODUCTION_PRESERVATION_FAILED/);
assert.equal(mutations, 1); // fixture schema setup only; wrapper never calls batch.
console.log('PASS: runtime wrapper, frozen hashes, prospective reread and drift refusal; no backend suite run');
