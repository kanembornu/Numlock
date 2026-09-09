const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const c = { Logger: { log() {} }, console };
vm.createContext(c);
for (const file of fs.readdirSync(root).filter(f => /^\d.*\.js$/.test(f)).sort()) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file });
}
console.log(JSON.stringify(c.testInventoryReceiptMigrationContracts()));
console.log(JSON.stringify({ headers: c.inventoryReceiptMigrationContract_(), count: 31, duplicates: 0, blanks: 0 }));
const raw = fs.readFileSync(path.join(root, 'docs/evidence/finance-phase-11u2e/POST-11U.snapshot.json'));
const frozen = JSON.parse(raw);
const fingerprints = JSON.parse(fs.readFileSync(path.join(root, 'docs/evidence/finance-phase-11u2e/POST-11U.fingerprints.json')));
assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), fingerprints.snapshotFileSHA256);
const snapshot = structuredClone(frozen.metadata);
for (const sheet of snapshot.sheets) {
  sheet.data = [];
  for (const range of frozen.ranges) for (const source of range.data.sheets) {
    if (source.properties.title === sheet.properties.title) sheet.data.push(...source.data);
  }
}
const digest = value => crypto.createHash('sha256').update(c.inventoryReceiptMigrationCanonical_(value)).digest('hex');
for (const [name, hash] of Object.entries(fingerprints.sheets)) {
  assert.equal(digest(c.inventoryReceiptMigrationSheet_(snapshot.sheets.find(s => s.properties.title === name))), hash, name);
  assert.equal(c.INVENTORY_RECEIPT_POST11U[name], hash);
}
// Unrecorded sheets here are fixture-only empty grids, never claims about current production.
let state = structuredClone(snapshot), mutations = 0, reads = 0;
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
state.sheets.find(s => s.properties.title === 'tabops').data = [{ rowData: [{ values: [{ userEnteredValue: { stringValue: 'drift' } }] }] }];
assert.equal(c.inventoryReceiptMigrationEvaluate_(state, digest).reason, 'PROSPECTIVE_PRESERVATION_DRIFT');
assert.equal(c.executeInventoryReceiptProductionMigration_(runtime).status, 'REFUSE'); assert.equal(mutations, 1);
state = structuredClone(snapshot);
runtime.batch = () => { mutations++; throw Error('SYNTHETIC_TRANSPORT_UNCERTAINTY'); };
const uncertain = c.executeInventoryReceiptProductionMigration_(runtime);
assert.equal(uncertain.status, 'MIGRATION_UNCERTAIN'); assert.equal(uncertain.writeCount, 'UNKNOWN'); assert.equal(mutations, 2);
state.sheets.find(s => s.properties.title === 'InventoryItems').properties.gridProperties.columnCount++;
assert.equal(c.executeInventoryReceiptProductionMigration_(runtime).status, 'REFUSE'); assert.equal(mutations, 2);
console.log('PASS: original POST-11U hashes, fresh read, one batch, zero rows, read-only retry evaluation, isolation, drift refusal, uncertain write without retry');
