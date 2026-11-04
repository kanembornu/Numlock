# Treasury T5 — Canonical Clearing Projection and 1030 Reconciliation

**Phase:** NUMLOCK_TREASURY_IMPLEMENTATION
**Task:** T5_TREASURY_CANONICAL_CLEARING_PROJECTION_AND_1030_RECONCILIATION
**Classification:** COMPLEXITY L3 · OPERATIONAL_RISK R2 · REASONING_EFFORT high
**Scope:** READ ONLY. Single canonical read-side clearing projection + separate global 1030
reconciliation over the frozen T2 contract, T3 foundation, T4 durable artifacts, and the
canonical Sales Recognition V2 (U3) authority. Zero writes, zero mutations, zero recovery
execution, zero cache, zero deployment, zero Finance source changes, no UI.
**Evidence classes:** MEASURED = executed this session; SOURCE = repository source at HEAD
`67a4818`; PRIOR-MEASURED = accepted T1/T2/T3/T4 evidence (not re-proven); DERIVED = logical
consequence of stated evidence.

---

## 1. Baseline

- HEAD verified `67a4818` (T1 `0b2f05d` → T2 `360c95d` → T3 `a6f0075` → T4 `67a4818`) before
  any action. Index empty (zero staged); tracked worktree clean at start.
- Untracked inventory at start: exactly 27 `tests/tmp/u10e-*` files — never touched, staged,
  or modified (re-verified at completion: still exactly 27).
- KNOWN_PRIOR_EVIDENCE (not re-proven): regression 121 PASS / 0 FAIL at `67a4818`; T3
  foundation (`treasuryDateKey`, `treasuryJournalSignature`, `treasuryStableId_`,
  destination eligibility, 1030 preflight); T4 durable core (plan digest, IN_PROGRESS/
  COMMITTED, exact readback, signature-from-rows, pre-save resolver); T1 measured production
  1030 state (Dr 24,000 / Cr 0 / net 24,000); P&L = recognized-Sales projection (never
  ledger 4000).
- No frozen-contract contradiction materialized; `BLOCKED_CONTRACT_CONFLICT` not triggered.

## 2. Authority inputs

| Authority | Use in T5 | Reuse, never forked |
| --- | --- | --- |
| T2 contract doc | statuses (§19), reconciliation invariant (§20), clearing rule (§7), journal rules (§8), dates (§9), recovery semantics (§15) | contract text only |
| T3 `99.Treasury.Receipt.Foundation.js` | date validation, destination eligibility, journal signature, error codes | `treasuryValidateReceiptDate`, `treasuryDestinationEligible`, `treasuryJournalSignature`, `treasuryContractError_` |
| T4 `99A.Treasury.Receipt.Durable.Save.js` | durable artifact shapes; pre-save resolver (safety gate, unchanged); read helper | `treasuryReadExposureSources_` (six authority tables), `treasuryResolveExposure_`/`treasuryComputeOutstanding_` (parity only) |
| U3 `97B` Sales projection | Sales amount/integrity authority per event | `salesProjectionVerifyV2Event_`, `salesProjectionVerifyV2Reversal_` |
| BalanceLedger (39) | accounting evidence for 1030 | `BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS` via `readCanonicalTable` |

Sales amount comes ONLY from the canonical Sales Recognition V2 event row (`Amount`).
Order totals, order lines, Payment/Settlement rows, tabsal, ledger 4000, and the receipt
`SnapshotJSON` are never Sales amount authorities (snapshot = evidence; its numeric fields
are never read — source-scanned).

## 3. Projection row contract (frozen)

`TREASURY_CLEARING_PROJECTION.ROW_FIELDS`, exact order, asserted byte-equal to
`Object.keys(row)` (P1b):

`RecognitionID, OrderID, RevisionID, SalesEconomicDate, RecognizedAmount,
RecognitionIntegrity, ActiveReceiptCount, ActiveReceiptID, DestinationAccountCode,
ReceiptDate, ReceiptEconomicDate, ClearedAmount, ReversalAmount, OutstandingAmount,
ClearingStatus, JournalID, OperationID, QualityCodes`

- `RecognitionIntegrity` ∈ {`VALID`,`INVALID`}` — U3 verifier verdict.
- `ActiveReceiptID` — first active valid ordinary receipt (sorted); falls back to first
  valid ordinary, then first ordinary; `""` when none. Multiple active IDs join with `","`.
- Response envelopes: projection `{contract:"TREASURY_CLEARING_PROJECTION_V1", asOfDate,
  startDate, endDate, rows, voidedExposures, salesIssues, orphans{receipts,operations,
  audits,journals}, totals}`; single exposure `{contract, status: OK|VOIDED|NOT_FOUND, …}`;
  reconciliation `{contract:"TREASURY_1030_RECONCILIATION_V1", …}` (§14–16).

## 4. Status semantics (derived; no PARTIAL normal status)

Precedence, deterministic:

1. Any quality code, or `OutstandingAmount < 0` → `EXCEPTION`.
2. `OutstandingAmount > 0` with no code and no valid clearing → `UNCLEARED`.
   (`>0` with any valid clearing ⇒ `CLEARING_PARTIAL` code ⇒ EXCEPTION — a partial number
   is corruption, never healthy UNCLEARED.)
3. `OutstandingAmount == 0` with `recognizedActive > 0`, `ClearedAmount == recognizedActive`
   and ≥1 active valid ordinary receipt → `CLEARED`.
4. Anything else → `AMOUNT_RESIDUAL` + `EXCEPTION` (fail closed).

`STATUSES = ["UNCLEARED","CLEARED","EXCEPTION"]` — `PARTIAL` unreachable as a status.
A fully Sales-voided recognition with zero receipt history leaves the row set entirely and
is surfaced in `voidedExposures` (§9); it is not an exposure, so no status applies.

## 5. Receipt integrity

`treasuryClearingReceiptAssessment_` (phase 1, intrinsic) — a receipt counts as a clearing
ONLY if every check passes:

- exact contract version `TREASURY_RECEIPT_V1` + non-blank ReceiptID (`RECEIPT_UNVERIFIED`);
- `ReceiptType` ∈ {`SALES_RECEIPT`,`SALES_RECEIPT_REVERSAL`} (`UNKNOWN_RECEIPT_TYPE`);
- integer `GrossAmount > 0` (`AMOUNT_MISMATCH`);
- `PostingStatus == COMMITTED` (`RECEIPT_UNVERIFIED`);
- `ReceiptDate`/`EconomicDate` strict `YYYY-MM-DD` and byte-equal (`DATE_INCONSISTENT`);
- `SnapshotJSON` parses, is an object, and its `recognitionID` (when present) matches —
  its numbers are never read (`RECEIPT_UNVERIFIED`);
- Order/Revision lineage present and Order resolves (`LINEAGE_CONFLICT`);
- destination eligible under the frozen cash-universe rule (`DESTINATION_INVALID`);
- journal, signature, audit — §7/§8.

Phase 2 (exposure-scoped): receipt `EconomicDate` must not predate the recognition's
`EconomicDate` (`DATE_INCONSISTENT`, determined per contract: a clearing can never predate
its exposure — measured `Dbattery5`); receipt lineage must equal the event's lineage
(`LINEAGE_CONFLICT`); reversal targets resolve (`UNKNOWN_REVERSAL`, §9).
Malformed receipts never silently healthy AND never silently vanish: they stay on the row
(or in `orphans.receipts`) and their posted ledger effect is attributed (§15).

## 6. Operation integrity

- Receipt → exactly one `TreasuryOperations` row by `OperationID`: 0 ⇒
  `OPERATION_MISSING`, >1 ⇒ `OPERATION_DUPLICATE`; `RequestKey`/`RecognitionID`/type must
  match (`OPERATION_MISMATCH`).
- `State == IN_PROGRESS` ⇒ `OP_IN_PROGRESS` (never counts; recovery-needed quality,
  reported only — the reader never mutates or recovers); unknown state ⇒
  `OPERATION_NOT_COMMITTED`.
- `COMMITTED` ⇒ `OperationPlan` must parse as an object (`OPERATION_PLAN_MALFORMED`).
- Exposure-level op scan (all treasury operations): duplicate `(OperationType, RequestKey)`
  ⇒ `OPERATION_DUPLICATE`; non-COMMITTED ⇒ state codes; `COMMITTED` with no receipt row ⇒
  `RECEIPT_MISSING`; unknown `OperationType` ⇒ `OPERATION_MISMATCH`. All attach to the
  target exposure row as quality codes.

## 7. Journal integrity

Per receipt, over ACTIVE ledger lines with `SourceType=TREASURY_RECEIPT_V1` +
`SourceID=ReceiptID`:

- 0–1 lines ⇒ `JOURNAL_MISSING`; >2 ⇒ `JOURNAL_DUPLICATE`; identity (`JournalID`, `LineID`
  exact `-1`/`-2`) mismatch ⇒ `JOURNAL_IDENTITY_MISMATCH`;
- legs exactly `{destination, 1030}`; destination leg absent ⇒ `DESTINATION_LEDGER_MISMATCH`
  plus `JOURNAL_ACCOUNT_MISMATCH`; foreign account ⇒ `JOURNAL_ACCOUNT_MISMATCH`;
- 1030 leg direction exact (ordinary: `Cr amount, Dr 0`; reversal: `Dr amount, Cr 0`) ⇒
  else `JOURNAL_ACCOUNT_MISMATCH` (P10 wrong-1030-leg); destination leg amounts ⇒
  else `JOURNAL_AMOUNT_MISMATCH`;
- `MovementType` exact (`TREASURY_RECEIPT`/`TREASURY_RECEIPT_REVERSAL`) ⇒ else
  `JOURNAL_ACCOUNT_MISMATCH`;
- both `Tanggal` byte-equal receipt `EconomicDate` ⇒ else `JOURNAL_DATE_MISMATCH`;
- signature recomputed from persisted rows via T3 `treasuryJournalSignature` must equal
  the receipt's `JournalSignature` ⇒ else `SIGNATURE_MISMATCH` (P11).

## 8. Audit integrity

Exactly one `TreasuryAudits` row per receipt (0 ⇒ `AUDIT_MISSING`, >1 ⇒
`AUDIT_DUPLICATE`); all 11 columns cross-linked exactly (ContractVersion, OperationID,
RequestKey, RecognitionID, OrderID, JournalID, PayloadHash vs the operation's, Actor,
SavedAt vs `ReceivedAt`) ⇒ else `AUDIT_MISMATCH` (P13).

## 9. Sales reversal handling

- **Void before receipt (P16):** valid full `REVERSAL` (U3 `salesProjectionVerifyV2Reversal_`)
  with zero receipt history ⇒ recognition leaves the row set; surfaced in `voidedExposures`
  `{recognitionID, orderID, revisionID, salesEconomicDate, recognizedAmount,
  voidEconomicDate}` with `totals.outstandingTotal == 0`; as-of ordering respected both
  ways (UNCLEARED 24,000 before the void date, voided after); reconciliation residual 0 in
  both states; single-exposure read returns `status: VOIDED`. Never an exception, never
  omitted, never an uncleared ghost.
- **Cleared Sale voided (P17):** receipt history exists ⇒ row retained as `EXCEPTION` with
  `SALES_REVERSAL_CONFLICT` + `CLEARING_OVER` + `NEGATIVE_OUTSTANDING`
  (`OutstandingAmount = -24,000`, never clamped); `recognizedActive = 0`. Explicitly NO
  auto-refund/auto-transfer: source contains no `2010` token, ledger gains zero 2010 rows,
  residual 0 with an empty exception bucket (the canonical algebra already explains every
  line — the lifecycle conflict lives on the row).
- Invalid/partial void ⇒ `SALES_REVERSAL_CONFLICT`, void NOT applied to canonical algebra;
  its posted ledger line is attributed as `LIFECYCLE_CONFLICT` (§15).
- Unknown-target reversal event ⇒ `salesIssues[]` entry `UNKNOWN_REVERSAL`; reversal-shaped
  TREASURY receipt with unknown target ⇒ row `UNKNOWN_REVERSAL`, counted zero (M25).
- Committed receipt reversals (T6-shaped) add back via the formula (§12); >1 reversal per
  target ⇒ `RECEIPT_REVERSAL_CONFLICT`.

## 10. Orphan detection (surfaced separately, never omitted)

| Orphan | Condition | Surface |
| --- | --- | --- |
| Receipt w/o valid RecognitionID | RecognitionID unresolved to a V2 RECOGNITION event | `orphans.receipts` reason `RECOGNITION_UNRESOLVED`, code `ORPHAN_RECEIPT`; never attached to a row |
| Receipt w/ missing Order/Revision lineage | blank/unresolvable lineage | `orphans.receipts` reason `LINEAGE_MISSING` AND row `LINEAGE_CONFLICT` (counted zero) |
| Operation w/o receipt / recoverable intent | no receipt references it, or RecognitionID unresolved | `orphans.operations` reason `NO_RECEIPT`/`RECOGNITION_UNRESOLVED` with `State` (IN_PROGRESS reported, never executed) |
| Audit w/o receipt | `TreasuryReceiptID` absent | `orphans.audits` code `ORPHAN_AUDIT` |
| Treasury ledger journal w/o receipt | treasury-source lines with no receipt row (as-of bounded) | `orphans.journals` `{sourceID, journalIDs, lineCount, net1030Effect}` code `ORPHAN_JOURNAL` |

Orphan ledger effects are additionally attributed in reconciliation (§15) so residuals stay
explainable (P14/P15: residual 0 with attributed entries).

## 11. Quality codes (frozen catalog, 42)

`TREASURY_CLEARING_PROJECTION.QUALITY_CODES` — stable machine-readable strings, superset of
the T2 §19 start list (all 9 T2 start codes present: `OP_IN_PROGRESS`,
`RECEIPT_UNVERIFIED`, `DUPLICATE_ACTIVE_RECEIPTS`, `DESTINATION_LEDGER_MISMATCH`,
`SIGNATURE_MISMATCH`, `AMOUNT_RESIDUAL`, `UNKNOWN_RECEIPT_TYPE`, `DATE_INCONSISTENT`,
`ORPHAN_1030_MOVEMENT`). Full catalog grouped:

- **Sales/authority:** `SALES_AUTHORITY_INVALID`, `SALES_REVERSAL_CONFLICT`,
  `UNKNOWN_REVERSAL`, `LINEAGE_CONFLICT`
- **Operations:** `OPERATION_MISSING`, `OPERATION_MISMATCH`, `OPERATION_NOT_COMMITTED`,
  `OP_IN_PROGRESS`, `OPERATION_DUPLICATE`, `OPERATION_PLAN_MALFORMED`, `RECEIPT_MISSING`
- **Receipts:** `RECEIPT_ID_DUPLICATE`, `DUPLICATE_ACTIVE_RECEIPTS`, `RECEIPT_UNVERIFIED`,
  `UNKNOWN_RECEIPT_TYPE`, `AMOUNT_MISMATCH`, `DATE_INCONSISTENT`,
  `RECEIPT_REVERSAL_CONFLICT`, `DESTINATION_INVALID`, `DESTINATION_LEDGER_MISMATCH`
- **Clearing amounts:** `CLEARING_PARTIAL`, `CLEARING_OVER`, `NEGATIVE_OUTSTANDING`,
  `AMOUNT_RESIDUAL`
- **Journal:** `JOURNAL_MISSING`, `JOURNAL_DUPLICATE`, `JOURNAL_IDENTITY_MISMATCH`,
  `JOURNAL_AMOUNT_MISMATCH`, `JOURNAL_ACCOUNT_MISMATCH`, `JOURNAL_DATE_MISMATCH`,
  `SIGNATURE_MISMATCH`
- **Audit:** `AUDIT_MISSING`, `AUDIT_DUPLICATE`, `AUDIT_MISMATCH`
- **Orphans/attribution:** `ORPHAN_RECEIPT`, `ORPHAN_OPERATION`, `ORPHAN_AUDIT`,
  `ORPHAN_JOURNAL`, `ORPHAN_1030_MOVEMENT`, `NON_V2_1030_MOVEMENT`,
  `FUTURE_REFUND_CREDIT_STATE`, `FUTURE_CORRECTION_REVERSAL_STATE`

Any push outside the catalog throws (`TREASURY_T5_UNKNOWN_QUALITY_CODE`) — the catalog can
silently neither grow nor drift. Covers every task minimum (invalid Sales authority;
missing/non-COMMITTED/duplicate operation; missing/duplicate receipt; amount mismatch;
partial; over-clearing; invalid destination; missing/duplicate journal; journal
amount/account/date/signature mismatch; missing/mismatched audit; unknown reversal; Sales
reversal conflict; orphan receipt/operation/audit/journal).

## 12. Outstanding formula

```
OutstandingAmount = RecognizedActive − ActiveReceiptClearings + CommittedReversals
  RecognizedActive        = (U3-valid ? event.Amount : 0) − Σ(valid Sales voids)
  ActiveReceiptClearings  = Σ(integrity-full ordinary receipts) − Σ(integrity-full receipt reversals)
  ClearedAmount           = ActiveReceiptClearings (net)
  ReversalAmount          = Σ(integrity-full committed receipt reversals)
```

A later-reversed ordinary receipt remains in the subtracted sum while its reversal adds
back — the T2 §7.2 double-count trap (subtract-excluded-original AND add reversal) is
avoided; T4 parity (§17) proves the healthy-fixture equivalence with T4's view. Only
integrity-full receipts count (malformed receipts leave the exposure outstanding while
their ledger effect goes to the exception bucket). Negative results are surfaced verbatim,
never clamped (P5/P22: `-6000`; P17: `-24000`).

## 13. As-of / period semantics

- Every bound is an explicit `YYYY-MM-DD` **Asia/Jakarta business date key**; invalid bound
  ⇒ throw `TREASURY_DATE_INVALID`; `startDate > endDate` ⇒ throw. `asOfDate` defaults to
  `endDate` when only a period is given; reconciliation ignores period (global, as-of
  only).
- Inclusion rule: an event participates iff its economic date key ≤ `asOfDate`
  (`SalesRecognitionEvents.EconomicDate`, receipt `EconomicDate`, ledger `Tanggal`, void
  `EconomicDate`). Malformed date keys stay visible (fail visible) and raise their quality
  code.
- No host-local conversion exists anywhere in the module (source-scanned:
  `canonicalDateKey(`/`getMonth(`/`getFullYear(`/`getDate(` absent). `treasuryDateKey`
  (T3) remains the canonical instant→date authority, asserted in P19 with a Jakarta-patched
  `Utilities.formatDate`: `2026-09-30T17:00:00Z → 2026-10-01` while the host-UTC day stays
  `2026-09-30`; a receipt dated `2026-10-01` is excluded at `asOf 2026-09-30` (a host-UTC
  reader would wrongly include it) and included at `asOf 2026-10-01`.
- Period and as-of are independent axes (P18): September recognition + October receipt ⇒
  month-end `UNCLEARED` 24,000 (ledger 24,000, residual 0), later `CLEARED` (ledger 0,
  residual 0); a September period read with an October as-of shows `CLEARED` (no naive
  same-month filter). Date battery: same-day, next-day, month boundary (09-30→10-01), year
  boundary (2026-12-31→2027-01-01) all healthy; receipt-before-recognition ⇒
  `DATE_INCONSISTENT` EXCEPTION. No prior-period Sales rewrites (reads only).

## 14. 1030 ledger derivation (accounting evidence, independent)

```
LedgerNet1030 = Σ(active BalanceLedger debits to 1030, Tanggal ≤ asOf)
              − Σ(active BalanceLedger credits to 1030, Tanggal ≤ asOf)
```

- Source: `BalanceLedger` ONLY — never receipts, never the canonical projection.
- Debit-positive convention explicit and asserted (`Dr − Cr == Net`; P1).
- Inactive lines excluded (standard ledger semantics, same as all readers).
- Malformed lines (non-finite amounts, invalid `Tanggal`) are surfaced in
  `malformed1030Lines` `{lineID, journalID, detail}` and force
  `reconciliationStatus = "MALFORMED_1030_LINE"` — never silently ignored; non-finite lines
  are excluded from sums (their amount is unknowable) and the status stays fail-closed.
- Reported fields (T2 §20 frozen names): `ledgerDr1030, ledgerCr1030, ledgerNet1030,
  recognizedExposure, salesVoidAdjustment, activeClearings, outstandingTotal,
  explicitExceptionAmount, unexplainedResidual` + `exceptionEntries`,
  `malformed1030Lines`, `reconciliationStatus`, `asOfDate`.

## 15. Exception attribution (deterministic bucket)

`outstandingTotal` comes ONLY from the canonical projection; `ledgerNet1030` comes ONLY
from BalanceLedger; the two are compared, never derived from each other. Each visible 1030
ledger group (`SourceType|SourceID`) has an exact canonical expectation:

- `TREASURY_RECEIPT_V1` group → `−amount` if that receipt is attached, visible and
  integrity-full (reversals: `+amount`); otherwise `0`;
- `SALES_RECOGNITION_V2` group → `+amount`/`−amount` iff the event is included and
  U3-valid; otherwise `0`;
- otherwise → frozen matcher order: future refund/credit movement types →
  `FUTURE_REFUND_CREDIT_TRANSFER`; future correction/reversal movement types →
  `FUTURE_CORRECTION_REVERSAL_STATE`; non-blank `SourceType` + non-blank `SourceID` →
  `HISTORICAL_NON_V2_1030_MOVEMENT`; **no deterministic identity → no entry** (stays
  unexplained).

Group delta ≠ 0 ⇒ one `exceptionEntries[]` entry
`{category, identity, amount, qualityCode, provenance, sourceArtifact}` where
`sourceArtifact = "BalanceLedger:<LineIDs>"` and `qualityCode` is the attributed artifact's
first row code (`OPERATION_MISSING`, `AUDIT_MISSING`, `SIGNATURE_MISMATCH`,
`DESTINATION_LEDGER_MISMATCH`, `ORPHAN_RECEIPT`, …) or `ORPHAN_1030_MOVEMENT` /
`NON_V2_1030_MOVEMENT` / `SALES_REVERSAL_CONFLICT` by class. Categories (frozen 5):
`HISTORICAL_NON_V2_1030_MOVEMENT`, `TREASURY_INTEGRITY_EXCEPTION`, `LIFECYCLE_CONFLICT`,
`FUTURE_REFUND_CREDIT_TRANSFER`, `FUTURE_CORRECTION_REVERSAL_STATE`.
No generic catch-all exists: unattributable differences can never hide here (P20).

## 16. Unexplained residual

```
explicitExceptionAmount = Σ exceptionEntries.amount
UnexplainedResidual     = LedgerNet1030 − OutstandingTotal − ExplicitExceptionAmount
```

Target 0; ≠ 0 ⇒ `reconciliationStatus = "UNEXPLAINED_RESIDUAL"` (surfaced, never
auto-repaired). Measured fixtures: pre-receipt 24k ⇒ Dr 24,000 / Cr 0 / net 24,000 =
outstanding 24,000 + exceptions 0 ⇒ residual **0**; post-receipt ⇒ Dr 24,000 / Cr 24,000 /
net 0 = outstanding 0 + exceptions 0 ⇒ residual **0** (P1/P2, plus every P-suite asserts
residual 0 except the deliberately unexplained P20). Production was NOT mutated to
re-prove either fixture (in-memory T1-equivalent fixtures only).

## 17. T4/T5 parity

- P23 (suite `testTreasuryT5ParityFinance`, plus M23): for healthy fixtures the T4 pre-save
  resolver (`treasuryResolveExposure_` + `treasuryComputeOutstanding_`) and the T5 row agree
  exactly — uncleared `24,000/0` vs `24,000/0`; cleared `0/24,000` vs `0/24,000`.
- No T4-clearable/T5-EXCEPTION divergence: T4 saves only what T5 reports healthy; after
  `DONE` both views read 0 / `CLEARED` (P23c/d).
- Converse: a T5-EXCEPTION exposure (partial fixture) is refused by T4
  (`REFUSED`, P23e) — T4 never clears what T5 flags.
- T4 source unchanged; the shared formula semantics are proven equal on every supported
  healthy fixture rather than duplicated by assertion — divergence would fail P23/M23 and
  block acceptance. T4's resolver remains an internal safety gate; T5 is the canonical
  public read model (single formula, single projection, no second public formula).

## 18. Finance separation

- Treasury projection never feeds Revenue: source-scanned (`getFinanceData`,
  `buildFinanceProfitAndLoss`, `buildCashFlowStatement`, `revenue`, `4000` all absent from
  `99B`).
- P25 (`testTreasuryT5FinanceIsolation`): real `getFinanceDataWithRuntime` P&L over the
  fixture — Revenue `24,000` before the receipt and `24,000` after (byte-identical); ledger
  4000 debit/credit unchanged; the receipt moves only `1000 Dr +24,000` and `1030 net 0`.
- Receipt affects Cash/Bank + 1030 only (T4 batch surfaces unchanged); no Finance source
  file changed; UI/report integration deferred (out of T5 scope).

## 19. Cache decision

**No cache.** Correctness-first: every read is computed on demand over the bounded sheets;
at V1 receipt scale a cache adds staleness risk (post-COMMITTED staleness is the proven U4
defect class) with zero measured performance need. Source-scanned: `CacheService`,
`getScriptCache`, `invalidateDashboardCache`, `getDashboardCacheRevision` absent from
`99B` (W5). `ponytail:` if receipt volume later demands caching, key it by
`getDashboardCacheRevision()` with T4 post-COMMITTED invalidation and re-run the staleness
battery.

## 20. Tests (focused suites, MEASURED — all executed, 0 FAIL)

| Suite (runner entry) | Coverage |
| --- | --- |
| `testTreasuryT5ProjectionStatus` | P1 24k UNCLEARED + residual 0 + row contract + debit-positive + statuses; P2 valid receipt CLEARED/ledger zero/residual 0; P3 duplicate EXCEPTION; P4 partial EXCEPTION; P5 over-clear EXCEPTION; P22 negative not clamped |
| `testTreasuryT5Integrity` | P6 missing operation; P7 IN_PROGRESS-with-artifacts (reported, operation untouched); P8 missing journal (ledger independent); P9 wrong destination; P10 wrong 1030 leg; P11 signature; P12 missing audit (outstanding ≠ ledger); P13 audit mismatch; Sales-authority-invalid EXCEPTION |
| `testTreasuryT5OrphansReversal` | P14 orphan receipt + orphan operation; P15 orphan journal; P16 void-before-receipt (as-of both sides, VOIDED, residual 0, no exceptions); P17 cleared-then-voided lifecycle EXCEPTION, no 2010 row, residual 0 |
| `testTreasuryT5AsOf` | P18 cross-month as-of/period; P19 UTC/Jakarta boundary (Jakarta-patched `treasuryDateKey`, host-UTC divergence); same-day/next-day/month/year boundary; receipt-before-recognition EXCEPTION; invalid request bounds; P24 legacy Payment/Settlement noise byte-identical |
| `testTreasuryT5Reconciliation` | frozen category set; P20 unexplained 1030 line ⇒ residual 5,000 + empty bucket + `UNEXPLAINED_RESIDUAL`; P21 attributable historical entry ⇒ residual 0; malformed line surfaced; single-exposure OK/NOT_FOUND |
| `testTreasuryT5ParityFinance` | P23 T4/T5 parity (uncleared, cleared, save-agreement, exception-refusal) |
| `testTreasuryT5FinanceIsolation` | P25 Revenue isolation + 4000/1000/1030 sums + residual 0 |
| `testTreasuryT5ReadOnlyAudit` | W0–W11 source/call-graph/read-only/public-API audits |
| `testTreasuryT5MutationSensitivity` | M1–M25 (§21) |

Fixture architecture: in-memory sheets (`salesV2SaveFixture_` + `treasuryT4BaseSheets_`),
U3 artifact builders (`u3CommittedAppend_`, `u3ReversalAppend_`, `u3PaidChain_`), the real
T4 save runtime for valid receipts, and a surgical fabricator for every corruption shape.
No production access, no network, no clasp.

## 21. Mutation sensitivity (25/25 MEASURED, in-memory; nothing left in source)

| # | Mutation | Caught by |
| --- | --- | --- |
| M1 | Order-total authority | tampered `OrderTotal 999999` ⇒ `RecognizedAmount 24000`; source token absent |
| M2 | count non-COMMITTED | IN_PROGRESS fixture ⇒ cleared 0, outstanding 24,000, `OP_IN_PROGRESS` |
| M3 | ignore missing audit | `AUDIT_MISSING` + EXCEPTION |
| M4 | ignore missing journal | `JOURNAL_MISSING` + EXCEPTION |
| M5 | skip signature | `SIGNATURE_MISMATCH` + EXCEPTION |
| M6 | partial-as-UNCLEARED | status `EXCEPTION`, never `UNCLEARED` |
| M7 | clamp negative | raw `-6000` preserved |
| M8 | duplicate-as-CLEARED | status ≠ `CLEARED`, `DUPLICATE_ACTIVE_RECEIPTS` |
| M9 | snapshot-as-Sales-authority | lying `snapshot.recognizedAmount 999999` ⇒ row 24,000; source token absent |
| M10 | ledger-from-receipts | receipt-without-journal ⇒ `ledgerNet1030 24000` (ledger untouched) |
| M11 | outstanding-from-ledger | `outstanding 24000` vs `ledgerNet 0` — deliberately unequal, residual 0 |
| M12 | residual hidden in generic exception | residual 5,000 + empty bucket + `UNEXPLAINED_RESIDUAL` |
| M13 | omit orphan receipt | `orphans.receipts ≥ 1` |
| M14 | omit orphan journal | `orphans.journals ≥ 1` |
| M15 | ignore Sales reversal | post-void rows 0, voided 1, outstanding 0 |
| M16 | auto-2010 | no ledger 2010 row; source token absent; residual 0 |
| M17 | Payment-as-clearing | status `UNCLEARED`; source token absent |
| M18 | Settlement-as-clearing | status ≠ `CLEARED`; `Settlements`/`ReceiveVia` tokens absent |
| M19 | host-local date | no host-local conversion tokens; exact as-of boundary 10-10/10-11 |
| M20 | same-period filter breaks cross-month | Sept period + Oct as-of ⇒ `CLEARED` |
| M21 | reader performs T4 recovery | no writer symbols; full sheet snapshot byte-identical |
| M22 | receipt affects Revenue | Revenue 24,000 before == after; no Finance import in source |
| M23 | T4 parity broken | both healthy fixtures exact agreement |
| M24 | invalid destination healthy | `DESTINATION_INVALID` + EXCEPTION, cleared 0 |
| M25 | unknown reversal ignored | `UNKNOWN_REVERSAL` + EXCEPTION, outstanding unchanged 24,000; residual 0 |

All mutations are fixture-level or source-token assertions; no source file was mutated and
nothing mutated remains.

## 22. Regression (MEASURED)

- Run 1 (first integration after registration): 126 PASS, 4 FAIL — fabricator ignored
  `noJournal` (P8/M4 read an untouched journal), Finance sums indexed a missing pre-receipt
  account, W0 asserted a filename token absent from module text.
- One repair cycle (3 fixes in the TEST file only; **zero** production-module changes and no
  invariant weakened).
- **Final run: 130 PASS, 0 FAIL** (baseline 121 + 9 new T5 functions) — full
  `node _test_runner.js` covering Purchase, PolicyC/Cash, Depreciation, Finance, Master,
  Supplier, Transaction, Sales V2 U1–U10, Finance UI, Treasury T3/T4/T5.
- `node --check` clean: `99B.Treasury.Clearing.Projection.js`,
  `96.Tests.Treasury.Clearing.Projection.Cases.js`, `_test_runner.js`.
- `git diff --check` clean; `git status --short`: 1 modified (`_test_runner.js`,
  registration only) + untracked `99B…`, `96.Tests…`, this doc + the original 27
  `tests/tmp/u10e-*` (untouched).

## 23. Source audit (zero writes)

Suite `testTreasuryT5ReadOnlyAudit` (W0–W11), MEASURED:

1. **Zero write primitives** in module source: `setValues`, `appendRow`, `appendCells`,
   `batchUpdate`, `setProperty`, `insertRow`, `deleteRow`, `UrlFetchApp`,
   `SpreadsheetApp`, `LockService`, `.flush()` — all absent.
2. **No writer/recovery entrypoint reachable**: `treasuryReceiptSaveWithRuntime_`,
   `treasuryReceiptDurableSave`, `treasuryOperationAppend_`, `treasuryOperationUpdate_`,
   `treasuryReceiptApplyBatch_`, `treasuryReceiptCommit_`, `treasuryReceiptResume_`,
   `treasuryReceiptNewIntent_`, `treasuryReceiptPlan_` — all absent.
3. **No legacy dependency**: `Payments`, `Settlements`, `ReceiveVia`, `PaymentMethod`,
   `cashSettleAndPersist`, `attemptCashSettlement`, `tabsal`, `tabops`, `fallback` — all
   absent.
4. **No host-local date / no second date authority**; **no cache**; **no Finance/Revenue
   authority duplication** and no `OrderTotal`/`4000`/`2010`/`snapshot.recognizedAmount`
   tokens.
5. **Behavioral zero-write proof:** full read pass (projection + exposure + reconciliation,
   and again through the public entrypoints) leaves all 16 fixture sheets byte-identical;
   an IN_PROGRESS operation stays `IN_PROGRESS` after reads (recovery reported, never
   executed); public wrappers are thin read-only compositions over
   `requireNumlockProductionSpreadsheet` (stubbed in-test, restored).
6. **Call graph** = `readCanonicalTable`, `treasuryReadExposureSources_`,
   `treasuryDestinationEligible`, `treasuryValidateReceiptDate`,
   `treasuryJournalSignature`, `salesProjectionVerifyV2Event_`,
   `salesProjectionVerifyV2Reversal_`, `isCanonicalActive`, `requireNumlockProductionSpreadsheet`
   — all read-only or pure.

## 24. Package impact (`.claspignore` allowlist)

- `.claspignore` NOT modified (outside authorized files). Current allowlist: **68** `!`
  includes plus the `**` ignore.
- Expected future runtime package count at the (separately authorized) push gate: **71** =
  68 current + `!99.Treasury.Receipt.Foundation.js` + `!99A.Treasury.Receipt.Durable.Save.js`
  (T4's 70) + `!99B.Treasury.Clearing.Projection.js`. T4 noted 70 at its push gate; T5 adds
  exactly one future include.
- `tests/`, `docs/`, `_test_runner.js` remain excluded by the allowlist — deployed package
  unchanged by this task; no deployment action taken; no secrets/credentials/production
  identifiers in any new file.

## 25. Production safety

- Production writes = 0; deployment actions = 0; `clasp push`/deploy/version = 0; Git
  push/stage/commit = 0 (Heavy commit policy: worktree left ready for numlock-commit);
  production schema creation = 0; migration/backfill = 0; config/property writes = 0;
  production read = 0 (all evidence is local in-memory fixtures; the public entrypoints were
  exercised only against a stubbed resolver).
- No Receipt/Operation/Audit/BalanceLedger/Cash-Bank/1030-clearing/Sale/Correct-Void/
  Payment-Settlement/refund-2010/AP-Purchase/Accounts/config/schema mutation exists or ran.
- Blocking statuses (`BLOCKED_CONTRACT_CONFLICT`, `BLOCKED_RECONCILIATION_AUTHORITY`,
  `BLOCKED_SALES_AUTHORITY`, `BLOCKED_1030_LEDGER`, `BLOCKED_*`): **not triggered** — no
  frozen-contract contradiction materialized, U3 consumption is read-only and safe, 1030
  semantics agree with the journal model, and the BalanceLedger read path is unambiguous.
  No escalation required; no fallback used.
- Commit handoff: changed paths `99B.Treasury.Clearing.Projection.js`,
  `96.Tests.Treasury.Clearing.Projection.Cases.js`, `_test_runner.js`,
  `docs/TREASURY-T5-CANONICAL-CLEARING-PROJECTION-AND-1030-RECONCILIATION.md` — title
  `Treasury T5: canonical clearing projection and 1030 reconciliation`.

---

*Telemetry: agent numlock-explore-free (Free execution authority for this Heavy L3/R2 task);
backend `9router/numlock-explore-free`; reasoning high; fallback used none (no escalation —
no named `ESCALATION_REASON` materialized); toolcalls UNKNOWN (not instrumented); elapsed
UNKNOWN (not instrumented); files read ~25 (T1–T4 docs, 99/99A/99B, 97/97A/97B, 20/36/38/39,
U2/U3/U4/U5/T3/T4 test cases, `_test_runner.js`, `.claspignore`); files modified 4
(`99B.Treasury.Clearing.Projection.js` new, `96.Tests.Treasury.Clearing.Projection.Cases.js`
new, `_test_runner.js` registration, this doc new); test runs: 3 full `node _test_runner.js`
(run 1: 126 PASS / 4 FAIL → 1 repair cycle in the test file only → final MEASURED 130 PASS /
0 FAIL).*
