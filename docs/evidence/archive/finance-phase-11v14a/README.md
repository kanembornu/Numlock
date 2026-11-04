# Phase 11V.14A — PurchaseEvents schema migration preparation

PASS — local preparation only. Production mutation, upload, deployment, authenticated
runtime acceptance, and Git mutation were not performed. Activation remains disabled.

## Canonical authority

`PURCHASE_EVENT_POLICY.headers` in [47.Purchase.Events.js](../../../47.Purchase.Events.js)
is the single runtime schema authority: exactly 25 headers in this order:

```text
EventID,ExpenseID,BusinessLabel,PolicyVersion,PolicyRevision,CostType,PurchaseRelationship,ExpenseDate,ReceiptDate,PurchaseQty,PurchaseUOM,AcquisitionValue,SupplierSource,ExternalRef,ExternalDocumentStatus,Attestation,AllocationStatus,RequestKey,NormalizedPayload,ReceiptPlan,Lifecycle,RecoveryKey,CreatedAt,CreatedBy,IsActive
```

`buildPurchaseEvent_` produces those 25 fields. `orchestratePurchaseEventUnderLock_`
persists through injected `runtime.appendEvent`; there is still no enabled production
PurchaseEvent writer. `purchaseEventHistory_` validates EventID/RequestKey uniqueness,
normalized payload, policy identity, lifecycle, recovery linkage and audit fields.
`readPurchaseEventTransactionRows_` reads the policy headers through `readCanonicalTable`,
validates history, and calls `projectPurchaseEventTransaction_`. The migration does not
redesign or revalidate existing business rows: canonical rows are left untouched.

## Migration boundary

[48.Purchase.Events.Migration.js](../../../48.Purchase.Events.Migration.js) provides the
separately callable `runPurchaseEventSchemaMigration()`. It checks operator identity,
holds the script lock, fresh-reads storage, and invokes the injected executor. It reuses
the existing InventoryReceipts migration transport, snapshot cell reader and canonical
comparison helper; it never invokes the receipt migration executor.

- Absent sheet: one atomic batch, two subrequests (`addSheet`, header-only `updateCells`),
  25 physical columns, zero business rows; reread verifies schema and all prior sheets.
- Existing exact logical headers: `ALREADY_MIGRATED`, `writeCount: 0`, with or without rows.
  Empty spare physical columns are harmless and remain untouched.
- Incompatible, reordered, duplicated, missing, formula-based or partial headers,
  undersized grid, or populated extra columns: `BLOCKED`, `writeCount: 0`.
- A batch exception, uncertain response or failed acceptance returns
  `MIGRATION_UNCERTAIN`, `writeCount: UNKNOWN`; no retry, repair or rollback is attempted.

The entry point has no startup, dashboard, submission, schema-initialization or test
callers. Tests invoke only `executePurchaseEventSchemaMigration_` with local fixtures.
The new source and focused Cases file remain excluded by the existing `.claspignore`
allowlist. Upload inventory changes and execution require a separately authorized task.

No mutation targets ExpenseItems, InventoryItems, InventoryConversions,
InventoryUOMConversions, InventoryReceipts, InventoryLedger, tabops, tabsal, Accounts,
BalanceLedger, Cash or production activation. The test preserves sentinel cells/notes
for every listed sheet and verifies the only mutation request targets PurchaseEvents.

## Focused validation

[testPurchaseEventSchemaMigrationContracts](../../../96.Tests.Purchase.Events.Migration.Cases.js)
passes 52 local checks. It reuses the existing PurchaseEvent orchestration fixture and
the existing migration suite's injected snapshot/batch pattern. Writer compatibility
means the current event builder/orchestrator persists through a synthetic sheet adapter;
it does not imply authenticated production writer acceptance.

Run only this focused suite using the repository's existing Node VM loading pattern:

```sh
node <<'NODE'
const fs = require('node:fs'), vm = require('node:vm');
const c = { Logger: { log() {} }, console };
vm.createContext(c);
for (const file of fs.readdirSync('.').filter(f => /^\d.*\.js$/.test(f)).sort()) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), c, { filename: file });
}
console.log(c.testPurchaseEventSchemaMigrationContracts());
NODE
```

JavaScript syntax, call-site isolation, Markdown links and `git diff --check` passed.
No unified suite or live service was run. No existing source, runner or configuration
file was changed. Recommended Git commands: None.

Next: separately authorize upload preparation and disposable Apps Script validation
before considering any production migration. Production execution remains unverified.
