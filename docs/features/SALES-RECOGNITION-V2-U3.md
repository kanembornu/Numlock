# SALES_RECOGNITION_V2 — U3 Recognized Sales Projection

Scope: U3 only. ONE canonical READ-ONLY future Sales economic authority for U4
Transaction readers and U5 P&L (not wired here). No writer, no dispatcher, no
activation, no schema change, no deployment. V2 stays `PREPARED`/disabled.

Source of truth: `97B.SalesRecognition.V2.Projection.js`.
Builds on: `97.SalesRecognition.V2.Foundation.js` (U1 sticky classifier,
reused as-is), `97A.SalesRecognition.V2.Save.js` (contract constants only),
`20.Data.Source.js` (`buildCanonicalTransactionData`, `isCanonicalActive`),
`22.Transaction.Lifecycle.js` (single lifecycle authority — reused, never
re-implemented), `95A`/`95` (Operational schema shapes),
`40.Cash.Foundation.js` (Settlements/PAID_SALE semantics), `39` policy C
journal signature.

## API

- `SALES_RECOGNITION_PROJECTION` — contract constant (sheets inventory,
  status vocabulary, machine-readable integrity codes; no UI prose).
- `readRecognizedSalesProjectionSources_(ss)` — ONE bounded read per sheet.
  Absent optional sheet = empty rows + presence record. Read error →
  `SOURCE_READ_FAILED` issue (recovery) + presence `readFailed`; never throws.
- `buildRecognizedSalesProjection_(sources)` — pure builder.
- `buildRecognizedSalesProjectionFromSpreadsheet_(ss)` — composer (reads
  only; no writes anywhere).

## Surfaces

- `events` — signed economic history. Positive = recognition, negative =
  reversal (`ReversalOfRecognitionID`), replacement = positive with its own
  identity/revision. Status per event:
  `RECOGNIZED | PENDING | RECOVERY_REQUIRED | EXCLUDED_INCOMPLETE |
  INTEGRITY_CONFLICT | NOT_RECOGNIZED`.
- `transactions` — header adapters: one `LEGACY_SALE` adapter per canonical
  record, one `ORDER` adapter per Orders row (regardless of recognition
  state). Never additive.
- `lines` — analytical only (legacy rows, OrderLines, committed V2
  `SnapshotJSON` lines). Never additive.
- `quality` — `issues[]`, `recoveryIssues[]` (recovery flag), `excluded[]`.
- `activeView` — latest RECOGNIZED event per chain (ReadModel ordering) +
  its totals; economic history stays immutable.
- `totals` — from events ONLY: `recognizedRevenue` (signed sum),
  `recognizedEventCount`, `eventCount`, `byPeriod`, `periods`,
  `ledgerRevenueCredits` (non-additive reference figure: active `4000`
  credits from `PAID_SALE` + `SALES_RECOGNITION`; `SALE_HPP` lines never
  touch it).

## Cohort rules

- **Legacy (`TABSAL_LEGACY`)** — `buildCanonicalTransactionData({sales,
  products, expenses: [], expenseItems: []})`; identity `LEGACY:<ID_Trx>`,
  namespace `LEGACY:<ID_Trx>:R0`. `isCanonicalActive` + canonical lifecycle
  are the single authority (Void = `IsActive` flip, Correct = new `ID_Trx` +
  Logs linkage); no second lifecycle, no historical mutation. Inactive →
  excluded + `LEGACY_INACTIVE_EXCLUDED`; rejected rows →
  `LEGACY_ROW_INELIGIBLE`; duplicate active `ID_Trx` → fail-closed
  `DUPLICATE_SOURCE_IDENTITY`; order-shaped IDs →
  `LEGACY_ORDER_PROVENANCE_AMBIGUOUS`.
- **Pre-V2 (`PRE_V2_ORDER`)** — evidence chain, in order: SUCCESS payment
  (exactly one; none → `OLD_ORDER_UNPAID_EXCLUDED`, never Revenue; many →
  `OLD_PAYMENT_DUPLICATE_SUCCESS`) → amount vs order
  (`OLD_PAYMENT_AMOUNT_CONFLICT`) → PAYMENT operation `COMMITTED` where
  present (`OLD_PAYMENT_OPERATION_PENDING`) → exactly one POSTED active
  `CSH-SAL-<PaymentID>` settlement (`OLD_PAYMENT_SETTLEMENT_MISSING` /
  `_INVALID`; persisted 21-column schema has no `RevenueSnapshot`, so
  persisted evidence = settlement `Amount` + ledger) → active `PAID_SALE`
  `4000` credit (`OLD_PAYMENT_LEDGER_MISSING` / `_MISMATCH`). Fulfillment is
  NOT a gate. Date = payment `PaidAt`, revision `R0`, namespace
  `ORDER:<OrderID>:R0`.
- **V2** — sticky `classifySalesRecognitionCohort` reused with raw event rows
  + SAVE operations mapped to intent shape (same mapping as the U2 cohort
  gate). Routing:
  `V2_COMMITTED || V2_PENDING` → V2 handler; `PRE_V2_ORDER` → evidence
  chain; `INCONSISTENT`/`UNKNOWN` → `COHORT_OWNERSHIP_CONFLICT` + excluded,
  NO legacy fallback. Committed verification per event: full 20-column row,
  `SnapshotJSON` parse, `snapshot.orderTotal === Amount`
  (`RECOGNITION_AMOUNT_MISMATCH`), COMMITTED `SALES_RECOGNITION_V2_SAVE`
  operation linked by OperationID/BusinessID
  (`COMMITTED_OPERATION_RECOGNITION_MISSING`, `RECOVERY_REQUIRED_V2`),
  audit linkage, owner order (`RECOGNITION_OWNER_MISSING`), two-line
  `SRV2J-` journal (Dr1030/Cr4000, `MovementType SALES_RECOGNITION`,
  `SourceType SALES_RECOGNITION_V2`, `SourceID = RecognitionID`, balanced =
  Amount, `policyCJournalSignature_` match) → else
  `RECOGNITION_JOURNAL_MISMATCH`. Reversal: valid target
  (`INVALID_REVERSAL_LINEAGE` / `UNKNOWN_REVERSAL_TARGET`), single terminal
  reversal (`MULTIPLE_TERMINAL_REVERSALS`), balanced own journal, owner.
  Replacement: own `RecognitionID`/`RevisionID`, single claim per
  `OriginalID` (`REPLACEMENT_LINEAGE_COLLISION`). Pending → surfaced
  (`PENDING` event row when present) + `INCOMPLETE_V2_RECOGNITION`;
  uncommitted SAVE intent (even pre-Order-row) → `RECOVERY_REQUIRED_V2`
  (recovery). Tampered/partial → issue + excluded. Post-Save master changes
  never alter committed history (snapshot authority).

## Namespaces / dedup

`ORDER:<OrderID>:<RevisionID>` (`R0` adapter for pre-V2 and legacy adapter
namespace `LEGACY:<ID_Trx>:R0`); order adapters/lines use `ORDER:<OrderID>`.
Dedup ONLY by explicit identity (`seen.identity`), RecognitionID, and
lineage/provenance — never date/amount/product/customer/timestamp; identical
economics under different identities are preserved (proven by tests).

## Period attribution

Each event carries its own `EconomicDate` (`salesProjectionDateKey_`);
`byPeriod` derives from signed RECOGNIZED events only. Never backdate: a
Nov reversal cannot alter the Oct period. Zero-sum periods are dropped from
`byPeriod` but their events remain in history. `activeView` is a
latest-per-chain derivation, never a rewrite.

## Quality / recovery

All 26 integrity codes are machine-readable issue records
(`code, sourceIdentity, cohort, detail, recovery`). Anomalies are localized:
excluded records surface reasons, valid records stay usable, and a bad
record never poisons unrelated periods or cohorts. Excluded amounts are
never presented as confirmed zero. `recoveryIssues` carries recovery-class
records (`SOURCE_READ_FAILED`, `RECOVERY_REQUIRED_V2`,
`COMMITTED_OPERATION_RECOGNITION_MISSING`).

## U4/U5 boundary

U3 exposes the projection only. Transaction readers (U4) and P&L (U5) are
NOT wired: no production reader (`91.Transactions.Query`, Finance/P&L
services) was modified. Read-only contract: source contains no sheet write,
no `batchUpdate`, no `SpreadsheetApp` mutation.

## Tests (local Node runner, `node _test_runner.js`)

- `testSalesRecognitionV2ProjectionCore` (35 assertions) — legacy identity/
  eligibility/lifecycle/read-only; pre-V2 chain matrix (unpaid excluded,
  paid once, fulfillment not a gate, PaidAt date, duplicate/conflicting
  payments, missing/invalid settlement, pending operation, missing/mismatched
  ledger, Matcha-like 36,000 with HPP 15,130.58 → Revenue 36,000 once);
  V2 committed/pending/IN_PROGRESS/partial/tampered/master-change/
  committed-op-missing; multiline (1 header, 1 amount, N lines); no-heuristic
  dedup; period attribution (Oct + / Nov −, immutable Oct); totals from
  events only + ledger non-additive + read-only.
- `testSalesRecognitionV2ProjectionLineage` (17 assertions) — original,
  next-period reversal, replacement revision, active-vs-economic views,
  duplicate terminal reversal, unknown target, impossible lineage,
  replacement collision, duplicate RecognitionID, missing owner, amount
  mismatch, journal mismatch, incompatible owner provenance, duplicate legacy
  identity, `SOURCE_READ_FAILED`, order-shaped legacy ID, cohort conflict
  with no legacy fallback.
- `testSalesRecognitionV2ProjectionParity` (9 assertions) — CROSS-COHORT
  PARITY: legacy 30,000 + unpaid pre-V2 + paid pre-V2 40,000 + committed V2
  40,000 + pending V2 + V2 reversal −40,000 + V2 replacement 81,000 →
  events 6 (recognized 5), signed total 151,000, transactions 5, lines 6,
  issues exactly {`OLD_ORDER_UNPAID_EXCLUDED`, `INCOMPLETE_V2_RECOGNITION`},
  recovery 0, `2026-10 = 110,000`, `2026-11 = 41,000`, ledger credits
  161,000 ≠ 151,000, activeView = 3 chains / 151,000 (replacement latest).
  Fixture math: 30,000 + 40,000 + 40,000 = 110,000 (Oct);
  81,000 − 40,000 = 41,000 (Nov); sum 151,000 — matches the specified
  expectations exactly; Matcha HPP excluded (Core fixture).
- `testSalesV2U3MutationProof` — in-memory VM sensitivity proof, 6 injected
  bugs, tracked files never mutated, exactly-one anchor per mutation
  verified: lines-as-revenue (`projection.events.forEach` →
  `projection.lines.forEach`) → `SALES_V2_U3_CORE:D1`; SUCCESS gate →
  `PENDING` → `SALES_V2_U3_CORE:B1`; ledger assigned into
  `recognizedRevenue` → `SALES_V2_U3_CORE:E2`; pending V2 routing downgraded
  → `SALES_V2_U3_CORE:C2`; legacy identity from date+amount →
  `SALES_V2_U3_CORE:A1`; `EconomicDate` → `RecognizedAt` →
  `SALES_V2_U3_CORE:F1`.

MEASURED: `53 PASS, 0 FAIL` (49 baseline suites preserved + 3 U3 case
suites (61 assertions) + 1 U3 mutation proof (6 mutations)).

## Out of scope (U4+)

U4 Transaction readers integration, U5 P&L, U6 lineage write-side
(Correct/Void for V2), activation/config persistence, schema creation,
deployment.
