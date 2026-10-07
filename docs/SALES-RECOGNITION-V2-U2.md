# SALES_RECOGNITION_V2 — U2 Durable Save Core

Scope: U2 only. Durable idempotent Save over TransactionOperations, freeze-once
plan (rows + analytical authority + normalized payload + integrity digest), ONE
atomic `spreadsheets.batchUpdate`, exact verification, verified operation commit.
No projection/readers, no Correct/Void, no activation execution, no accounts
creation, no schema creation, no operator dispatch, no U3+.

Source of truth: `97A.SalesRecognition.V2.Save.js`.
Builds on: `97.SalesRecognition.V2.Foundation.js` (U1, frozen),
`95A.Transaction.Production.js` (TransactionOperations reuse),
`43.Inventory.Receipt.Migration.js` (sanitized Sheets REST transport reuse —
signature `(method, suffix, body)`).

## Audit companion contract (U2 prerequisite — documentation only)

The referenced architecture freezes a stable `AuditID` and exactly one Save audit
row but specifies no audit sheet/schema. U2 therefore documents the exact new
contract here; creating the sheet remains out of U2 scope (schema gate refuses
until it exists):

- Sheet: `SalesRecognitionAudits`, exactly 10 columns in order:
  `AuditID, ContractVersion, OperationID, RequestKey, OrderID, RecognitionID,
  JournalID, PayloadHash, Actor, SavedAt`
- Exactly one audit row per committed save, appended in the same batch as the
  other four surfaces; `AuditID` deterministic from `OrderID`
  (`SRA-` stable id), `OperationID`/`RecognitionID`/`JournalID`/`OrderID`/
  `RequestKey`/`PayloadHash`/`ContractVersion` are exact linkages back to the
  operation row and event row; `SavedAt` equals the event `RecognizedAt`.
- Append-only; verification treats duplicates, crossovers, or field drift as
  `IDENTITY_CONFLICT`.

Unchanged frozen surfaces: Orders 14 columns, OrderLines 11 columns,
TransactionOperations 10 columns, SalesRecognitionEvents 20 columns.

## Flow (fixed order)

`Outer lock (wrapper only, BEFORE normalize/lookup) → normalize → exact
(OperationType, RequestKey) lookup BEFORE any mutable master/pricing/recipe/HPP
read → resume or new intent.`

- OperationType: `SALES_RECOGNITION_V2_SAVE` (distinct from legacy
  `ORDER_CREATE`; pending V2 never becomes legacy).
- Same normalized payload (compared BOTH by `PayloadHash` digest AND by exact
  persisted `normalizedPayload` JSON structure) → replay/resume from the
  persisted plan, zero master recomputation. Changed payload →
  `CONFLICT / OPERATION_PAYLOAD_CONFLICT`, zero additional writes. Distinct keys
  → distinct intents. No date/product/amount dedup.
- New intent only: config gate → schema gate → account preflight → cohort gate →
  authority read → authority effective-window gate (malformed nonblank dates and
  reversed windows fail closed) → ProductVariant effective-date gate →
  `prepareOperationalOrder` freeze → plan build (rows, `lineAuthority`
  analytical snapshots, `normalizedPayload`, `planDigest`) →
  `salesRecognitionV2SaveVerifyPlan_` (shape + integrity) → bounds → crash
  boundary `V2_BEFORE_INTENT` → persist `OperationPlan` `IN_PROGRESS` →
  `V2_AFTER_INTENT_PERSIST` → exact ten-field (Date-safe) intent readback →
  `V2_AFTER_INTENT` → batch → verify → commit → verified ten-field commit
  readback → `V2_AFTER_COMMIT` → `DONE`. Every gate refusal writes zero; an
  unsafe plan is never persisted.
- Resume (same key): identity checks → plan parse → exact normalized compare →
  `VerifyPlan` (digest + invariants; tampered pending plan fails closed with
  ZERO additional writes) → State validation (`IN_PROGRESS`/`COMMITTED` only,
  anything else → `INVALID_OPERATION_STATE`, never committed) → stored bounds +
  schema re-check (headers/sizes only — no mutable master recomputation) →
  artifact inspection → replay / resume / fail closed.

## ONE atomic batch (corrected transport)

Nonexistent `:batchAppend` removed. The batch is:

1. Read-only metadata GET
   (`?fields=spreadsheetId,sheets.properties(sheetId,title)`) through the
   sanitized transport; spreadsheet identity must match
   `NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID`; all five write-surface
   `sheetId`s resolved or the batch is rejected BEFORE any mutation request
   (atomic rejection, zero POST).
2. ONE `POST .../v4/spreadsheets/{id}:batchUpdate` whose body contains exactly
   five `appendCells` subrequests (one per existing sheet id, in
   `WRITE_SURFACES` order), `fields: "userEnteredValue"`, safe RAW CellData
   only (`stringValue` / `numberValue` / `boolValue`, never `formulaValue`).

Surfaces (unchanged): `Orders` (1 header row), `OrderLines` (all ordered lines),
`SalesRecognitionEvents` (one 20-column RECOGNITION event,
`PostingStatus=COMMITTED`), `BalanceLedger` (exactly two lines:
`Dr1030 Sales Settlement Clearing` / `Cr4000 Sales Revenue` for `OrderTotal`,
signature = `policyCJournalSignature_`), `SalesRecognitionAudits` (one row).

No database-global atomicity is claimed: intent, batch, readback, and final
commit are multistep. Only the single `batchUpdate` is atomic (all five
subrequests or none). Server rejection is surfaced once — no transport retry.
No nested locks.

## Bounds (cell / bytes / plan)

Refused BEFORE the intent write and re-checked on resume against the STORED
plan (no master recomputation):

- `MAX_ORDER_LINES = 50`, `MAX_BATCH_CELLS = 4000`
- `MAX_CELL_CHARS = 45000` — conservative per-cell string bound (Sheets 50000);
  enforced on every batch cell AND on the `OperationPlan` cell itself
  (`SnapshotJSON` included)
- `MAX_REQUEST_BYTES = 1000000` — actual UTF-8 bytes of the full batchUpdate
  body (`salesRecognitionV2SaveUtf8Bytes_`, surrogate-aware) plus
  `REQUEST_OVERHEAD_BYTES = 4096` fixed transport overhead
- Unsafe cell types (non-finite numbers) reject with `UNSAFE_BATCH:*`.

## Frozen plan integrity

`OperationPlan` JSON persists: all ten identity classes (OperationID, OrderID,
RevisionID, RecognitionID, JournalID, OrderLineIDs, journal LineIDs, AuditID),
actor, timestamp, EconomicDate, ordered lines, prices, recipe/HPP analytical
snapshots, accounts (1030/4000), contract/activation metadata, journal
signature, event/audit rows, the EXACT `normalizedPayload` structure, and a
canonical `planDigest` (`transactionPayloadHash_` over the plan without the
digest key).

`salesRecognitionV2SaveVerifyPlan_` (freeze time → definite `REFUSED`;
resume → fail closed, zero writes) verifies: plan/contract/operation type
versions; identity derivations for operation/order/revision/recognition/journal/
audit ids; account mapping; economic totals (`sum LineTotal = OrderTotal`,
`sum LineHpp = HppTotalSnapshot`); line identities, arithmetic, snapshots;
`lineAuthority` completeness and HPP reconstruction
(`sum QtyBase x StandardCost = UnitHppSnapshot`, price/recipe/variant linkage);
two journal lines with derivations, account placement, amounts, date,
`policyCJournalSignature_`; complete event row + parsed `SnapshotJSON`
(authority embedded); complete audit row linkages; finally the `planDigest`.
Malformed shape → `PLAN_MALFORMED`; tampered content → `IDENTITY_CONFLICT`.

## Analytical recipe/cost snapshots (freeze once)

`plan.lineAuthority` (mirrored into the event `SnapshotJSON`) freezes, per
line: variant (id/product/tipe/effective window/active), recipe version
(effective window/active), every component (ItemID, QtyBase, BaseUOM, item
metadata incl. effective window), the standard-cost authority row used
(ID/StandardCost/effective window/active), applicable UOM conversion rows for
the component items, and the price authority row (effective window/active).
HPP is reconstructable from these rows alone. Freeze-time self-check recomputes
unit HPP and line totals and refuses on mismatch. Inventory journal untouched.

## Exact verifier (fail closed)

Beyond complete per-surface field verification, global scans detect:
planned `OrderLineID` under a different `OrderID`; journal `LineID`
collisions/cross-owner records; source-set vs ID-set membership differences
EVEN WHEN COUNTS EQUAL; recognition/order/orderNumber/operation crossovers;
audit ID-set vs operation-set mismatches EVEN WHEN COUNTS EQUAL. Outcomes:
duplicate/extra/tampered/cross-owner → `RECOVERY_REQUIRED / IDENTITY_CONFLICT`;
missing/partial → `RECOVERY_REQUIRED / ARTIFACTS_INCOMPLETE`; read failure →
`UNKNOWN / READBACK_UNKNOWN` (identities preserved). Missing entire artifacts
on `COMMITTED` → fail closed. Pending partial → never appended/repaired. No
blind append, delete, or repair ever runs.

## Recovery matrix

| Situation | Outcome |
| --- | --- |
| runtime factory / outer lock failure BEFORE intent | `REFUSED` (`SAVE_RUNTIME_UNAVAILABLE` / `OUTER_LOCK_UNAVAILABLE`), definite, identity kept |
| pre-intent gate refusal | `REFUSED`, zero writes |
| crash `V2_BEFORE_INTENT` | nothing persisted; next call = fresh intent |
| crash `V2_AFTER_INTENT_PERSIST` / `V2_AFTER_INTENT` | resume persisted plan → batch → commit |
| crash `V2_AFTER_BATCH` / `V2_AFTER_READBACK` / `V2_BEFORE_COMMIT` | verify exact → commit same op |
| crash `V2_AFTER_COMMIT` (response lost) | next call verifies → replay `DONE` |
| batch timeout, zero artifacts observed | `UNKNOWN / BATCH_OUTCOME_UNKNOWN`, identity kept; next invocation inspects then resumes |
| batch timeout, exact artifacts observed | verify → commit → `DONE` |
| commit update lost/failed | `UNKNOWN / COMMIT_OUTCOME_UNKNOWN`, stored state untouched; retry verifies+commits |
| duplicate operation rows | `RECOVERY_REQUIRED / DUPLICATE_OPERATION_EVIDENCE` |
| tampered pending plan | `RECOVERY_REQUIRED / IDENTITY_CONFLICT` (`PLAN_DIGEST_MISMATCH`), zero writes |
| invalid persisted State | `RECOVERY_REQUIRED / INVALID_OPERATION_STATE`, never committed |
| committed, artifacts missing/tampered | `RECOVERY_REQUIRED` fail closed |
| partial/conflicting uncommitted artifacts | `RECOVERY_REQUIRED` fail closed |

Envelope (never `{ success: false }`; UNKNOWN/RECOVERY_REQUIRED always retain
`requestKey` + operation linkage):
`{ status, code, requestKey, operationID, orderID, recognitionID, journalID,
auditID, writeCount, replay, field, detail }` with
`status ∈ DONE | REFUSED | CONFLICT | UNKNOWN | RECOVERY_REQUIRED`.

## Disabled capability (U1 invariant preserved)

Default config is `PREPARED`; the seam refuses (`V2_NOT_ACTIVATED`) with zero
writes unless an explicit config is supplied to the injected runtime. No UI,
dispatcher, or `T`-dispatch changes. `PAUSED` refuses new intents; pending V2
resumes and classifies `V2_COMMITTED`/`V2_PENDING`, never legacy.

## Refusal codes (U2; U1 codes reused as-is)

`SALES_V2_SCHEMA_NOT_READY`, `SALES_V2_COHORT_NOT_CLEAR`,
`OPERATION_PAYLOAD_CONFLICT`, `DUPLICATE_OPERATION_EVIDENCE`,
`BATCH_BOUNDS_EXCEEDED`, `ARTIFACTS_INCOMPLETE`, `IDENTITY_CONFLICT`,
`BATCH_OUTCOME_UNKNOWN`, `READBACK_UNKNOWN`, `COMMIT_OUTCOME_UNKNOWN`,
`SAVE_EXECUTION_UNKNOWN`, `PLAN_MALFORMED`, `INTENT_READBACK_FAILED`,
`ECONOMIC_DATE_INVALID`, `PRODUCT_VARIANT_EFFECTIVE_WINDOW`,
`AUTHORITY_WINDOW_INVALID`, `AUTHORITY_SNAPSHOT_MISMATCH`,
`INVALID_OPERATION_STATE`, `OUTER_LOCK_UNAVAILABLE`,
`SAVE_RUNTIME_UNAVAILABLE`, `PAYLOAD_INVALID` (plus reused
`V2_NOT_ACTIVATED`, `V2_MODE_PAUSED`, `CONFIG_INVALID`, `ACCOUNT_*`,
`INVALID_ORDER_TYPE`, `REQUEST_KEY_REQUIRED`, ...).

## Tests (local Node runner, `node _test_runner.js`)

- `testSalesRecognitionV2SaveCore` (27 assertions) — success multiline journal +
  full linkage/signature/balance content, duplicate click, payload conflict,
  distinct keys, no content dedup, PAUSED refusal, legacy-type isolation,
  Date-safe envelope, variant effective-date refusal, outer-lock/no-nested-lock
  tokens, lookup-before-authority ordering, exact `normalizedPayload` +
  `planDigest` + `VerifyPlan`, complete `lineAuthority` HPP reconstruction,
  Date-safe ten-field readback helper + all-ten-fields sensitivity.
- `testSalesRecognitionV2SaveRecovery` (88 assertions) — crashes at all seven
  boundaries (`V2_BEFORE_INTENT`, `V2_AFTER_INTENT_PERSIST`, `V2_AFTER_INTENT`,
  `V2_AFTER_BATCH`, `V2_AFTER_READBACK`, `V2_BEFORE_COMMIT`, `V2_AFTER_COMMIT`),
  batch timeout (no artifacts → UNKNOWN; applied → commit), committed response
  loss, partial/extra/tampered/missing artifacts fail closed with zero repair,
  master-change snapshot freeze (zero authority reads on resume), PREPARED
  zero-write refusal, pending-under-PAUSED stays V2, duplicate operation
  identities, commit-update failure → UNKNOWN → retry, tampered pending plan,
  invalid State, cross-owner OrderLineID/journal LineID, source-set vs ID-set
  equal-count crossover, audit set equal-count crossover,
  orderNumber/RecognitionID crossovers, COMMITTED with all artifacts missing.
- `testSalesRecognitionV2SaveGates` (40 assertions) — schema/account/config/
  cohort zero-write gates, line/cell/byte bounds refused before any write,
  exact five-range batch shape, forbidden-surface token checks, seam defaults,
  legacy source unchanged, plan JSON round-trip, **mocked-real-transport**
  (actual `inventoryReceiptMigrationRequest_` path: GET URL + `:batchUpdate`
  POST URL/method, five `appendCells` with sheetIds 101-105, RAW cells
  incl. `numberValue`/`boolValue`, no `formulaValue`, no forbidden surfaces or
  endpoints, atomic rejection on missing sheetId with ZERO POST, single POST on
  server rejection with no retry, save-level transport timeout → UNKNOWN →
  recovery → DONE), cell-char bound refusal (46000-char key) + UTF-8 byte
  helper checks, resume schema re-check with zero master reads, injected-wrapper
  lock phase tests (lock before lookup/normalize, definite pre-intent
  refusals, single release), authority effective-window gate (malformed
  nonblank end and reversed window → `AUTHORITY_WINDOW_INVALID`, zero writes).
- `testSalesV2U2MutationProof` — in-memory VM sensitivity proof, 5 injected
  bugs, tracked files never mutated; clean run passes all three U2 suites, each
  mutation must FAIL at its exact marker: forbidden revenue account
  (`REVENUE: "4000"` → `"1100"`) → `SALES_V2_SAVE_CORE:A9`; transport endpoint
  (`":batchUpdate"` → `":batchAppend"`) → `SALES_V2_SAVE_GATES:C11b`;
  cell bound (`MAX_CELL_CHARS: 45000` → `99999`) → `SALES_V2_SAVE_GATES:C19a`;
  plan digest check disabled → `SALES_V2_SAVE_RECOVERY:B17a`; cross-owner line
  check disabled → `SALES_V2_SAVE_RECOVERY:B19a`.

`node _test_runner.js` executes all of the above; all legacy + U1 assertions
preserved.
MEASURED: `49 PASS, 0 FAIL` (41 legacy suites + 3 U1 case suites + 1 U1
mutation proof + 3 U2 case suites (155 assertions) + 1 U2 mutation proof
(5 mutations)).

## Out of scope (U3+)

Projection/readers, Correct/Void, activation/config persistence and activation
execution, account creation, `SalesRecognitionEvents`/`SalesRecognitionAudits`
schema creation, `.claspignore` registration, deployment, dispatch wiring.
