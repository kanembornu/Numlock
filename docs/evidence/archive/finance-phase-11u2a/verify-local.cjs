// Local-only: no network or Google services. Run from any directory with Node.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const context = { Logger: { log: console.log }, console };
vm.createContext(context);
for (const file of fs.readdirSync(root).filter(file => /^\d.*\.js$/.test(file)).sort()) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const prior = path.join(root, 'docs/evidence/finance-phase-11u1');
const identity = JSON.parse(fs.readFileSync(path.join(prior, 'drive-evidence-map.json'), 'utf8'));
assert.equal(identity.fileId, '1Gyv4scq6wm-VpEKcxcQg3iVxeHmmIiKV');
assert.equal(identity.version, 'V01');
assert.equal(identity.sha256, '7f3bf64c2678c0436beeadd317f1dbe0f638b3ee9aeedab6fe1d146f4f4b9ed0');
const bytes = { [identity.fileId]: fs.readFileSync(path.join(prior, identity.manifest)) };
const oldRoot = path.join(root, 'docs/evidence/finance-phase-11n8');
const oldMap = JSON.parse(fs.readFileSync(path.join(oldRoot, 'drive-evidence-map.json'), 'utf8'));
for (const entry of oldMap.Artifacts) bytes[entry.DriveFileID] = fs.readFileSync(path.join(oldRoot, 'manifests', entry.ManifestID + '.manifest'));
const evidenceRuntime = {
  readManifestBytes(id) { assert.ok(bytes[id], 'only frozen evidence identities'); return Array.from(bytes[id]); },
  sha256(data) { return Array.from(crypto.createHash('sha256').update(Buffer.from(data)).digest()); },
  bytesToString(data) { return Buffer.from(data).toString('utf8'); }
};
const evidence = context.buildInventoryLemonProductionEvidence(evidenceRuntime);
assert.equal(evidence.lemon.EvidenceRef, identity.evidenceRef);
assert.equal(evidence.lemon.Numerator, 24);
assert.equal(evidence.lemon.Denominator, 1000);
assert.equal(evidence.lemon.IsActive, false);
assert.equal(evidence.lemon.EffectiveFrom, '2026-10-01');
const expected21 = JSON.parse(fs.readFileSync(path.join(oldRoot, 'candidate-rows.json'), 'utf8'));
assert.deepEqual(JSON.parse(JSON.stringify(evidence.existing)), expected21.map(row => ({ ...row, IsActive: true })));
const altered = { ...evidenceRuntime, readManifestBytes(id) { const value = evidenceRuntime.readManifestBytes(id); return id === identity.fileId ? value.concat([32]) : value; } };
assert.throws(() => context.buildInventoryLemonProductionEvidence(altered), /LEMON_SHA256_MISMATCH/);
console.log('PASS: actual frozen local evidence bytes and 21-row package binding');
// Reconstructed in-memory storage also exercises the real evidence builder, never live Sheets.
const reconstructed = context.inventoryLemonProductionTestFixture();
Object.assign(reconstructed.runtime, evidenceRuntime);
evidence.existing.forEach((row, index) => {
  const values = context.BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.map(key => row[key]);
  reconstructed.sheets.InventoryUOMConversions.grid[index + 1].splice(0, 24, ...values);
  reconstructed.sheets.InventoryItems.grid[index + 1][3] = row.ToUOM;
});
assert.equal(context.preflightInventoryLemonProductionWithRuntime(reconstructed.runtime).status, 'READY');
assert.equal(context.executeInventoryLemonProductionWithRuntime(reconstructed.runtime, 'population').status, 'POPULATED');
assert.equal(context.executeInventoryLemonProductionWithRuntime(reconstructed.runtime, 'activation').status, 'ACTIVATED');
assert.equal(reconstructed.writes.length, 2);
console.log('PASS: frozen evidence population/activation in reconstructed local storage');

context.runInventoryLemonProductionDisposableRuntimeProof();
context.testInventoryFoundationContracts();
context.testInventorySchemaMigrationContract();
context.testInventoryConversionAuthorityContracts();
console.log('PASS: focused local validation; no production services or unified runtime execution');
