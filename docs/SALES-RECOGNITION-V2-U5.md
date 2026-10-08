# SALES_RECOGNITION_V2 — U5 Finance Revenue / P&L

Scope: U5 only. Finance Revenue / P&L consumes the SAME recognized-Sales
authority as U3: Transaction Sales authority == Revenue authority for the same
canonical events. No Sales write change, no U3 cohort logic duplicated in
Finance, no U6/U7, no activation, no schema change, no deployment. V2 stays
`PREPARED`/disabled.

Source of truth: `97B.SalesRecognition.V2.Projection.js` (`events`), consumed
at the lowest shared Finance boundary in `36.Finance.Service.js`.
Builds on: U4 seam reuse (`buildRecognizedSalesProjectionFromSpreadsheet_`),
existing Finance period helpers / timezone conventions, Policy C regime
routing (`resolvePolicyCAccountingRegime_`).

## Integration

- `buildFinanceSalesRecognitionScope_(salesProjection, period)` — the ONE
  Revenue input. Signed `projection.events`, `status === "RECOGNIZED"`,
  period attribution by each event's authoritative `EconomicDate`
  (`event.dateKey`) only. Never `activeView`, never BalanceLedger 4000
  credits, never Payments, Order headers, OrderLines, or a second legacy
  Sales reconstruction.
- `buildFinanceProfitAndLossLegacy_(…, salesProjection)` — Revenue now comes
  from the scope; the canonical Sales record path keeps Expense-side work
  only: historical pre-Policy-C COGS (`qty × HPP`, 5000/1100 contract) and
  account/product quality gates. Expense/Purchase input unchanged.
- `buildFinanceProfitAndLoss(…, ledgerRows, salesProjection)` — required
  parameter (fail-closed: missing projection throws
  `Finance requires the recognized Sales projection authority`, after the
  existing DepreciationLedger check). Threaded through legacy, prospective
  and split regime sections.
- `getFinanceDataWithRuntime`, `getPartialBalanceDataWithRuntime`,
  `buildFinanceFinalReadinessEvidence_`, `validateFinanceProductionRuntime`,
  `validateFinanceDepreciationProductionRuntime` each compose the projection
  ONCE per request and reuse it across Revenue, comparison (post-cutoff) and
  quality builds. One bounded read per sheet; no per-Sale reads; no N+1.
- Dashboard/report surfaces inherit through the shared P&L layer; no per-UI
  patches. DTO compatibility preserved: additive fields only.

## Report quality (additive `salesRecognition` on every P&L result)

- `authority`, `contract` — `SALES_RECOGNITION_V2_PROJECTION` /
  `SALES_RECOGNITION_PROJECTION`.
- `recognizedRevenue` — signed event sum for the period (equals
  `summary.revenue`).
- `unresolvedCount` — `quality.excluded.length` (unpaid, pending, UNKNOWN,
  partial, conflicted; excluded ≠ invented amount).
- `recoveryRequiredCount` / `integrityConflictCount` — explicit counts.
- `revenueAuthorityComplete` — false when any projection source read failed
  (`SOURCE_READ_FAILED`); also forces `dataQuality.status = "ATTENTION"`.
  Localized invalidity keeps valid Sales reportable with the quality state
  exposed; whole-source (tabsal) read failure throws via the existing
  canonical read path — never a silent authoritative Revenue = 0.

## Policy C (frozen)

Regime selection stays economic-date (`2026-09-30` legacy / `2026-10-01`
prospective). Prospective: `cogs = null`, `grossProfit = null`,
`grossProfitAvailable = false` (never 0 / fabricated margin); Revenue −
material purchases expensed (6210, BalanceLedger authority) − operating
expenses − depreciation. V2/analytical HPP is never COGS, never subtracted
from Revenue, never double-expensed against 6210. Historical pre-Policy-C
`5000/1100` COGS preserved per existing contract; no retroactive Policy C;
no account creation (1030/2010 stay non-existent); no PurchaseEvent
migration.

## Semantics

- Signed events: original `+`, Void later period `−`, Correct = reversal `−`
  + replacement `+`. Later reversal NEVER rewrites the original period
  (Oct +36,000 stays; Nov −36,000).
- Cohorts inherited exactly from U3 (legacy once; pre-V2 paid once; V2
  committed once; pending/UNKNOWN/partial/conflicted excluded + surfaced; no
  legacy fallback). Finance never reconstructs them.

## Parity

Same period/fixture: `sum(signed projection events) === P&L Revenue`.
Simple periods also reconcile with U4 recognized Transaction Sales totals.
Periods containing a later reversal: U4 active totals vs P&L period Revenue
intentionally differ (Oct active 225,000 vs events 265,000; Nov active
81,000 vs events 41,000) — the tests prove the distinction, not forced
equality.

## Tests (MEASURED, `node _test_runner.js`)

- `96.Tests.SalesRecognition.V2.U5.Cases.js`
  - `testSalesRecognitionV2U5RevenueAuthority` — central mixed-cohort fixture
    (adapted U3/U4 fixture + material purchase + operating expense +
    depreciation): exact Revenue 265,000 / material 120,000 / opex 7,000 /
    depreciation 5,000 / net 133,000 / `cogs = null` /
    `grossProfitAvailable = false` / quality metadata; legacy once, paid
    36,000 once (no Payment/ledger/lines/HPP), unpaid excluded, multiline
    V2 OrderTotal once, read-only.
  - `testSalesRecognitionV2U5LifecyclePeriods` — void next period
    (Oct +36,000 / Nov −36,000 / Oct not rewritten), correct next period
    (−original +replacement exact), transition boundary 2026-09-30 /
    2026-10-01 by economic date, empty period boundary.
  - `testSalesRecognitionV2U5PolicyCQuality` — Policy C prospective semantics,
    historical COGS fixture, pending V2 surfaced without fallback,
    localized source-read failure (valid Sales reportable + quality exposed),
    whole-source read failure (explicit throw), YTD from events.
  - `testSalesRecognitionV2U5Parity` — events-sum parity, U4 simple-period
    parity with identities, active-vs-events distinction, full-range parity.
- `tests/browser/sales-v2-u5-mutation-proof.js` — 8 injected bugs (VM-only,
  restored each run, one anchor each): TabSal direct Revenue, ledger 4000
  credit, unpaid Order included, activeView instead of events, V2 HPP as
  COGS, null COGS → 0, reversal attributed to original period, pending V2 as
  zero-quality success. Clean run must pass; each mutation must fail at its
  expected marker.

## Boundaries

No live Apps Script, no production mutation, no Accounts (1030/2010), no
companion sheets, no clasp/deploy/push, no activation/T, no backfill or
migration, no U6/U7, no Sales write routing change.
