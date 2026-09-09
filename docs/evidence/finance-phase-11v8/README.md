# Finance Phase 11V.8 — production orchestration and routing foundation

The foundation is implemented locally. Production operational posting and correction writes
remain disabled. No upload, deployment, production business mutation, or Git commit/push ran.

## Contract and ownership

`submitCanonicalTransaction(payload)` is the sole public creation dispatcher. Exact `SALES`,
`EXPENSE`, and `INVENTORY_RECEIPT` branches replace the binary selection. Malformed/unknown
types return `REFUSED`, writes0. Sales retains its existing validation, pricing, persistence,
audit and cache invalidation. Only explicitly `ORDINARY_EXPENSE` IDs may use the existing
Expense validation/persistence path. An inventory-linked Expense intent enters receipt
orchestration, and any failure ends there. Historical reporting and lifecycle writers are unchanged.

The private owner `45.Inventory.Receipt.Orchestration.js` provides registry validation,
activation configuration, request validation, shared-lock orchestration, an operational DTO,
and a pure future-reversal candidate builder. The production runtime is deliberately a
disabled configuration reader with no business writer. The enabled path is exercisable only
through explicitly injected `LOCAL_FIXTURE` adapters. A later enablement phase must supply
and verify the production storage adapter; changing `enabled` alone cannot activate writes.

Backend Buy & receive request:

```js
{
  transactionType: "INVENTORY_RECEIPT",
  expenseItemId: "<reviewed Expense ID>",
  requestKey: "<stable client key, 8-128 allowed characters>",
  input: {
    ReceiptDate: "2026-10-01", PurchaseQty: "500", PurchaseUOM: "gr",
    AcquisitionValue: "10001", SupplierSource: "<observed supplier/source>",
    Attested: true, ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE"
  }
}
```

This example is a contract shape, not a production instruction or business evidence. ItemID
is supplied by the registry. A client-supplied ItemID must match it exactly. Draft/incomplete
or ungoverned candidates fail before capture. Actual input evidence remains mandatory.

One key is required before mutation. `NormalizedPayload.routing` persists Expense ID,
ItemID and routing version alongside the normalized receipt input. Existing receipt history
binds the key to ReceiptID, LineID and revision; operational SourceID is their JSON tuple and
ID_Movement is its `IR-` prefix. Identical retries use the original routing version and stored
conversion snapshot. Different normalized input/Expense ID/ItemID returns `CONFLICT`.

The dispatcher acquires ScriptLock once. Standalone capture/post wrappers retain their own
lock acquisition; orchestration calls only their private `UnderLock_` implementations with
an active matching scope. Scope invalidation and lock release happen in `finally`. The
under-lock path freshly reads config, registry, selectable IDs, items, conversions, receipt
history and movement history before capture. Posting rereads receipt/movement state and
physically verifies the write; uncertain outcomes never trigger another append in that call.

| State | Meaning and next same-key request |
| --- | --- |
| NOT_STARTED | Validation/activation refused before business persistence |
| RECEIPT_CAPTURED | Existing receipt retained; retry reconciles/resumes its movement |
| OPERATIONAL_POSTED | Exact movement physically present; repeated request writes0 |
| WRITE_UNCERTAIN | Stable key/allocated identities returned; fresh reconciliation required |
| CONFLICT | Conflicting identity/payload/history; no automatic overwrite or fallback |

Capture formatting is counted as a write: normal fixture capture/post reports three writes
(format, receipt values, movement values). Unknown writes are `UNKNOWN`. There is no
cross-sheet atomicity claim. Receipt capture is never rolled back because movement creation
failed. Current posted edit/cancel guards remain enforced.

The activation model contains version, revision, enabled, effectiveFrom, timezone,
routingVersion, activation event metadata and an evidence fingerprint. Production defaults
are disabled with null activation evidence. Fixture activation metadata is explicitly synthetic.

## Reviewed routing artifact and unresolved mappings

The read-only connected source was **Numlock Transaction / ExpenseItems / A1:J1000**, on
2026-09-07, following metadata verification. Its complete ten-column values response is
[expense-items.snapshot.json](expense-items.snapshot.json). It contains 34 active/selectable
IDs. Existing notes say active status was retained for historical foreign-key continuity;
there is no explicit prospective routing authority or ItemID linkage in this source.

The local code-review decision is therefore **BLOCKED for all 34 IDs**. This is not a claim
of business approval. No name/category similarity, free-text label or account association
was promoted to routing authority. `INVENTORY_EXPENSE_ROUTING` is the explicit V1 local
configuration; each ID is listed and has `PROSPECTIVE_ROUTING_AUTHORITY_NOT_SUPPLIED`.

| IDs | Classification | Unresolved evidence |
| --- | --- | --- |
| OSS01 | BLOCKED | Explicit prospective classification |
| OSK01, OSK02, OSK03, OSK04, OSK05 | BLOCKED | Explicit prospective classification and ItemID if inventory |
| OSR01, OSR02, OSR03, OSR04, OSR05, OSR06, OSR07 | BLOCKED | Explicit prospective classification and ItemID if inventory |
| OSR08, OSR09, OSR10, OSR11, OSR12, OSR13, OSR14 | BLOCKED | Explicit prospective classification and ItemID if inventory |
| OSR15, OSR16, OSR17, OSR18, OSR19, OSR20, OSR21 | BLOCKED | Explicit prospective classification and ItemID if inventory |
| OUR01, OUU01, OUS01, OUS02, OUS03, OUS04, OEE01 | BLOCKED | Explicit prospective classification |

Coverage is deterministic against fresh active ExpenseItems. New/missing IDs, duplicate
masters, duplicate routes and conflicting classifications fail closed. Tests separately
exercise synthetic ordinary and inventory mappings. Historical `tabops`, ExpenseItems,
financial reports, Sales HPP and Accounts are untouched. If this source is later uploaded,
prospective Expense creation remains blocked until a reviewed registry revision resolves IDs.

## Correction and reporting boundaries

`buildInventoryReceiptReversal_` prepares VOID / VOID_AND_REPLACE identity and linkage
contracts only. It verifies the original effect against its receipt evidence and exact ledger
row, copies original tracked quantity/acquisition value/unit cost, records
`ReversalOfMovementID`, refuses a second reversal and reconciles identical candidate retries.
Current MWA is not consulted. VOID_AND_REPLACE requires a distinct replacement request key.
These candidates are not the current 23-column ledger schema and cannot be posted by the
operational executor. Production correction activation and a future governed persistence
representation remain out of scope; the original effect stays immutable.

`projectInventoryReceiptTransaction_` prepares a typed `InventoryReceipt` operational DTO in
the creation/status response. It excludes private attestation/supplier evidence and all
Sales/Expense amount/revenue/COGS/margin fields. It is not yet wired into Transactions list,
search or export. This is the requested backend preparation boundary for a later UI phase;
existing list/API behavior and financial aggregation remain unchanged.

Accounting posting remains false; BalanceLedger writes0; Account1100 mutation=false;
Cash/AP inference=false; recipe consumption disabled. COGS remains `tabsal.Qty × tabsal.HPP`.
InventoryOpenings is neither read nor required by orchestration.

## Validation and changed files

Run:

```sh
node docs/evidence/finance-phase-11v8/verify-local.cjs --unified
```

The 2026-09-07 run passed **179 orchestration checks**, all listed regressions and
**60/60 unified tests**. Final syntax checks passed for all 62 allowlisted JavaScript files
and the verifier; manifest/snapshot JSON, documentation links and `git diff --check` passed.
`clasp status --json` exactly matched the 76-file allowlist (74 prior files plus the new
orchestration source/test). This is inventory evidence only.

The verifier covers actual public dispatcher persistence in synthetic Sheets, routing
coverage, orchestration faults/retries, typed projection, reversal candidates, receipt
foundation (188 scenarios), operational receipt (169 checks), receipt persistence/posted
correction guards, transaction entry/lifecycle/history, Finance Core, Inventory foundation,
schema migration, conversion authority and opening staging. Transaction UI checks are
static source checks. The unified suite remains unchanged at **60/60**, all local VM evidence.
No authenticated Apps Script or browser acceptance is claimed.

Task-changed files (mixed prior-phase worktree retained):

- `.claspignore`: add orchestration source and its parameterized fixture tests.
- `21.Transaction.Entry.js`: explicit dispatcher and exclusive routing.
- `42.Inventory.Receipt.Foundation.js`: held-lock path, routing binding, uncertain identities.
- `44.Inventory.Receipt.Operational.js`: held-lock path, standalone guard preserved.
- `45.Inventory.Receipt.Orchestration.js`: new foundation owner and V1 routing artifact.
- `96.Tests.Inventory.Receipt.Orchestration.Cases.js`: new parameterized local contract suite.
- `docs/TESTING.md`: this phase's local validation entry.
- `docs/evidence/finance-phase-11v8/expense-items.snapshot.json`: read-only routing evidence.
- `docs/evidence/finance-phase-11v8/verify-local.cjs`: local service harness and regression gate.
- `docs/evidence/finance-phase-11v8/README.md`: contract, unresolved mappings and evidence.

Git recommendation: **None**. No staging, commit, push, upload or deployment is authorized.
Next phase: obtain explicit per-ID routing decisions, then separately scope production
adapter/runtime proof and UI integration while keeping enablement disabled.
