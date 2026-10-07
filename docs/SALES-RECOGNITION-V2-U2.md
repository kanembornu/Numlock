# SALES_RECOGNITION_V2 — U2 Durable Save Core

Scope: U2 only. Durable idempotent Save over TransactionOperations, freeze-once
plan, one atomic Sheets REST batch, exact verification, operation commit.
No projection/readers, no Correct/Void, no activation execution, no accounts
creation, no schema creation, no operator dispatch, no U3+.

Source of truth: `97A.SalesRecognition.V2.Save.js`.
Builds on: `97.SalesRecognition.V2.Foundation.js` (U1, frozen),
`95A.Transaction.Production.js` (TransactionOperations reuse),
`43.Inventory.Receipt.Migration.js` (sanitized Sheets REST transport reuse).

## Flow (fixed order)

`Outer lock (wrapper only) → normalize → exact (OperationType, RequestKey)
lookup BEFORE any mutable master/pricing/recipe/HPP read → resume or new intent.`

- OperationType: `SALES_RECOGNITION_V2_SAVE` (distinct from legacy `ORDER_CREATE`;
  pending V2 never becomes legacy, legacy rows are never touched).
- Same normalized payload → replay/resume from the persisted plan, zero master
  recomputation. Changed payload → `CONFLICT / OPERATION_PAYLOAD_CONFLICT`,
  zero additional writes. Distinct keys → distinct intents. No date/product/amount
  dedup.
- New intent only: config gate → schema gate → account preflight → cohort gate →
  authority read → ProductVariant effective-date gate → `prepareOperationalOrder`
  freeze → bounds → persist `OperationPlan` `IN_PROGRESS` + exact readback →
  batch → exact verification → `COMMITTED`. Every gate refusal writes zero.
- Retry never recomputes mutable masters: the resume path reads only the
  persisted plan and the five artifact surfaces.

## Frozen plan (persisted once in `OperationPlan`)

`OperationID, OrderID, RevisionID, RecognitionID, JournalID, OrderLineIDs,
Journal LineIDs, AuditID, actor, savedAt, EconomicDate, ordered lines, prices,
recipe/HPP analytical snapshots (UnitHppSnapshot/LineHpp/HppTotalSnapshot +
SnapshotJSON), accounts (1030/4000), contract/activation metadata, journal
signature, audit row, event row, order row`.

Deterministic identities derive from `(OPERATION_TYPE, requestKey)` via the
reused `transactionStableBootstrapId_` / `transactionOperationID_` helpers.

## ONE atomic batch

Single `POST /v4/spreadsheets/{id}/values:batchAppend` (via the sanitized
`inventoryReceiptMigrationRequest_` transport) with exactly five value ranges,
in `SALES_RECOGNITION_V2_SAVE.WRITE_SURFACES` order:

1. `Orders` — one order header row (14 columns)
2. `OrderLines` — all ordered line rows (11 columns)
3. `SalesRecognitionEvents` — one 20-column RECOGNITION event (`PostingStatus=COMMITTED`)
4. `BalanceLedger` — exactly two lines: `Dr1030 Sales Settlement Clearing` /
   `Cr4000 Sales Revenue` for `OrderTotal`, `MovementType=SALES_RECOGNITION`,
   `SourceType=SALES_RECOGNITION_V2`, signature = `policyCJournalSignature_`
5. `SalesRecognitionAudits` — one Save audit row (10 columns)

No database-global atomicity is claimed: intent, batch, readback, and final
commit are multistep. The batch is atomic only across its five ranges. No nested
locks (`salesRecognitionV2DurableSave` acquires the single outer lock; the core
never locks). Bounds (`MAX_ORDER_LINES=50`, `MAX_BATCH_CELLS=4000`,
`MAX_REQUEST_BYTES=1000000`) are refused BEFORE the intent write.

Forbidden artifacts: zero writes to Payments, Settlements, Cash, InventoryLedger,
Fulfillment, and zero rows in 5000/1100 (HPP stays analytical only).

## Verification and recovery envelope

Envelope (never `{ success: false }`; UNKNOWN/RECOVERY_REQUIRED always retain
`requestKey` + operation linkage):

`{ status, code, requestKey, operationID, orderID, recognitionID, journalID,
auditID, writeCount, replay, field, detail }`
with `status ∈ DONE | REFUSED | CONFLICT | UNKNOWN | RECOVERY_REQUIRED`.

Exact verification compares every artifact field against the frozen plan:
complete header, line count/order/content/snapshots, event, both journal lines
+ signature + balance, audit, operation linkage. Deviations fail closed:

- duplicate/extra/tampered → `RECOVERY_REQUIRED / IDENTITY_CONFLICT`
- missing/partial → `RECOVERY_REQUIRED / ARTIFACTS_INCOMPLETE`
- no blind append, delete, or repair ever runs.

Recovery matrix:

| Situation | Outcome |
| --- | --- |
| pre-intent refusal (config/account/schema/cohort/bounds/input) | `REFUSED`, zero writes |
| intent-only (`IN_PROGRESS`, no artifacts) | resume persisted plan → batch → commit |
| batch timeout, zero artifacts observed | `UNKNOWN / BATCH_OUTCOME_UNKNOWN`, identity kept; next invocation inspects then resumes |
| batch timeout, exact artifacts observed | verify → commit same op → `DONE` |
| committed, response lost | verify exact → replay `DONE`, `writeCount 0` |
| committed, artifacts missing/tampered | `RECOVERY_REQUIRED` fail closed |
| partial/conflicting uncommitted artifacts | `RECOVERY_REQUIRED` fail closed |
| intent readback mismatch | `RECOVERY_REQUIRED / INTENT_READBACK_FAILED` |

## Disabled capability (U1 invariant preserved)

Default config is `PREPARED`; the seam refuses (`V2_NOT_ACTIVATED`) with zero
writes unless an explicit config is supplied to the injected runtime. No UI,
dispatcher, or `T`-dispatch changes. `PAUSED` refuses new intents; pending V2
resumes and classifies `V2_COMMITTED`/`V2_PENDING`, never legacy.

## Refusal codes (U2 additions; U1 codes reused as-is)

`SALES_V2_SCHEMA_NOT_READY`, `SALES_V2_COHORT_NOT_CLEAR`,
`OPERATION_PAYLOAD_CONFLICT`, `DUPLICATE_OPERATION_EVIDENCE`,
`BATCH_BOUNDS_EXCEEDED`, `ARTIFACTS_INCOMPLETE`, `IDENTITY_CONFLICT`,
`BATCH_OUTCOME_UNKNOWN`, `READBACK_UNKNOWN`, `COMMIT_OUTCOME_UNKNOWN`,
`SAVE_EXECUTION_UNKNOWN`, `PLAN_MALFORMED`, `INTENT_READBACK_FAILED`,
`ECONOMIC_DATE_INVALID`, `PRODUCT_VARIANT_EFFECTIVE_WINDOW`, `PAYLOAD_INVALID`
(plus reused `V2_NOT_ACTIVATED`, `V2_MODE_PAUSED`, `CONFIG_INVALID`,
`ACCOUNT_*`, `INVALID_ORDER_TYPE`, `REQUEST_KEY_REQUIRED`, ...).

## Tests (local Node runner, `node _test_runner.js`)

- `testSalesRecognitionV2SaveCore` (23 assertions) — success multiline journal,
  full artifact/linkage/signature/balance content, duplicate click, payload
  conflict, distinct keys, no content dedup, PAUSED refusal, legacy-type
  isolation, Date-safe envelope, variant effective-date refusal, outer-lock /
  no-nested-lock tokens, lookup-before-authority ordering.
- `testSalesRecognitionV2SaveRecovery` (47 assertions) — crashes at every
  boundary (`V2_AFTER_INTENT`, `V2_AFTER_BATCH`, `V2_BEFORE_COMMIT`), batch
  timeout (no artifacts → UNKNOWN; applied → commit), committed response loss,
  partial/extra/tampered/missing artifacts fail closed with zero repair writes,
  master-change snapshot freeze (zero authority reads on resume), PREPARED
  zero-write refusal, pending-under-PAUSED resume stays V2.
- `testSalesRecognitionV2SaveGates` (22 assertions) — schema/account/config/
  cohort zero-write gates, bounds (line/cell/byte) refused before any write,
  exact five-range batch shape, forbidden-surface token checks, seam defaults,
  legacy source unchanged, plan JSON round-trip.
- `testSalesV2U2MutationProof` — in-memory VM sensitivity proof (registered in
  `_test_runner.js`, source read via `tests/browser/sales-v2-u2-mutation-proof.js`,
  tracked files never mutated): clean run passes all three U2 suites; injecting
  `save.JOURNAL_ACCOUNTS.REVENUE, Debit: 0` → `"1100", Debit: 0` into the VM copy
  must make the suite FAIL at `SALES_V2_SAVE_CORE:A9` (forbidden credit account).

`node _test_runner.js` executes all of the above; all legacy + U1 assertions
preserved.
MEASURED: `49 PASS, 0 FAIL` (41 legacy suites + 3 U1 case suites + 1 U1
mutation proof + 3 U2 case suites + 1 U2 mutation proof).

## Out of scope (U3+)

Projection/readers, Correct/Void, activation/config persistence and activation
execution, account creation, `SalesRecognitionEvents`/`SalesRecognitionAudits`
schema creation, `.claspignore` registration, deployment, dispatch wiring.
