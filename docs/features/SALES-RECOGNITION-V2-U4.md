# SALES_RECOGNITION_V2 — U4 Transaction Readers

Scope: U4 only. The canonical Transaction list / detail / query layer reads
Sales from the ONE shared U3 Recognized Sales Projection
(`buildRecognizedSalesProjection_`). Read authority change only: no writer, no
dispatcher, no activation, no schema change, no deployment. V2 stays
`PREPARED`/disabled.

Source of truth: `91.Transactions.Query.js` (U4 read adapter) with a narrow
`97B.SalesRecognition.V2.Projection.js` seam; detail routing in
`22.Transaction.Lifecycle.js`. Builds on: U3 projection (reused as-is), U1/U2
contracts (unchanged), canonical lifecycle authority (unchanged).

## Reader integration

- `getTransactionsPeriodRows(range)` — the single shared boundary. Expense /
  Purchase / InventoryReceipt rows keep their existing sources; Sales rows are
  replaced by `buildTransactionSalesReadRows_(ss, range, lifecycleSales)`, which
  performs ONE projection build per request. The period cache now also stores
  `salesRecognition` in its meta entry, so quality survives a cache hit.
- `getTransactionsPage(request)` — additive `response.salesRecognition`
  (`contract`, `reader`, `authority`, `activeChains`, `issues`,
  `recoveryIssues`, `excluded`). Rows carry additive `salesIdentity`,
  `salesSourceLabel`, `salesCohort`, `recognitionId`, `revisionId`,
  `recognitionStatus`, `orderType`, `productId`, `productVariantId`,
  `salesQuality`.
- `getTransactionsExport` / `buildTransactionsSearchIndex` — unchanged
  projections over the same authoritative rows (cross-reader parity by
  construction).
- `getCanonicalTransactionDetail(id)` / `getCanonicalTransactionDetails(ids)` —
  `ORDER:<OrderID>` identities resolve through
  `buildSalesRecognitionOrderDetail_(id, projection)`; `SAL-` identities keep the
  canonical lifecycle detail plus `attachSalesRecognitionLegacyMetadata_`;
  `OPS-` detail unchanged. Batch builds ONE projection for the whole request.

## Cohort visibility (active view)

| Cohort | Marker | Visible |
| --- | --- | --- |
| Legacy canonical (`TABSAL_LEGACY`) | `LEGACY_SALE` | identity `LEGACY:<SalesID>` via row `id = <SalesID>`; date/amount/lifecycle from canonical lifecycle + U3 active event |
| Voided/corrected legacy | `LEGACY_SALE` | only under `lifecycleState=voided|all`, `isActive=false`, quality attached; the replacement is the single active row |
| Pre-V2 paid Order | `PRE_V2_ORDER` | once, `id = ORDER:<OrderID>`, date = payment `PaidAt`, amount = recognized event |
| Pre-V2 unpaid Order | — | absent (no active-view event); reason in `salesRecognition.excluded` |
| V2 committed | `SALES_RECOGNITION_V2` | once from the active-view event; header amount, snapshot lines |
| V2 pending / UNKNOWN / partial / integrity-conflicted | — | absent, NO legacy fallback; `issues` + `excluded` surfaced |

Recognition gate is `projection.activeView` membership for the order chain —
an order with no RECOGNIZED active event is not a Sale. No reader reads Orders,
Payments, BalanceLedger or OrderLines to decide Sales truth (mutation proof M1).

## Ordering / filters / pagination

Date desc, then identity desc (`localeCompare`) — deterministic tie-breakers.
Type, date range, lifecycle, search and drilldown filters are applied AFTER
authority determination; Sales range uses the U3 economic date only. Pagination
public behavior (offset slicing, `rangeStart`/`rangeEnd`) unchanged.

## Detail model

Additive DTO only: `salesIdentity`, `salesSourceLabel`, `salesCohort`, `orderId`,
`salesId`, `revisionId`, `recognitionId`, `recognitionStatus`, `contractVersion`,
`orderType`, `productId`, `productVariantId`, `qty`, `revenue`/`amount`,
`hppAnalytical`, `hppAnalyticalLines`, `lines[]` (`lineId`, `productId`,
`productVariantId`, `tipe`, `qty`, `unitPrice`, `lineAmount`, `unitHpp`,
`lineHpp`, `recipeVersionId`, `fromSnapshot`), `lineage[]`, `quality`
(`issues`/`excluded`/`recoveryIssues`), `paymentStatus`, `fulfillmentStatus`.

- Multiline: one header transaction, amount = header; lines analytical only.
- V2 lines come from the persisted `SnapshotJSON` (immutable); master/order
  changes after recognition never rewrite history (B8).
- Legacy detail keeps historical HPP (`unitHPP`/`cogs`); order detail exposes
  analytical HPP only (`hppAnalytical`), never `Dr5000/Cr1100` and no COGS
  posting.
- Actions: legacy `SAL-`/`OPS-` keep their canonical action path
  (`canCorrect`/`canVoid` unchanged). Order-backed Sales set
  `canCorrect: false, canVoid: false` +
  `immutableReason: "SALES_RECOGNITION_ACTION_UNSUPPORTED"`; the server rejects
  `voidCanonicalTransaction` / `previewCanonicalTransactionCorrection` with
  `TRANSACTION_NOT_FOUND` (fail closed until U6).

## U3 seam (`97B`, additive only)

Header adapters now carry `recognitionId`/`revisionId` (legacy), plus
`orderType`, `hppTotalSnapshot`, `recognitionId`, `revisionId` (orders); line
entries carry `productVariantId`, `tipe`, `sellingPrice`, `unitHpp`,
`recipeVersionId`; V2 snapshot lines join `ProductID`/`Tipe` from the persisted
`OrderLines` row by `OrderLineID`; V2 events carry
`originalId`/`reversalOfRecognitionId`/`replacementId`. No counts, statuses,
dedup keys or totals changed (U3 suites still pass).

## Boundary

U4 changes READ authority only. Finance/Revenue/P&L (U5), U6 writers,
activation/config, and production writer/routing behavior are untouched.

## Tests (local Node runner, `node _test_runner.js`)

- `testSalesRecognitionV2U4ReaderCohorts` (5 assertions) — legacy parity,
  unpaid absent, paid once with no Payment/settlement/ledger row, pending V2
  excluded with quality, multiline one header.
- `testSalesRecognitionV2U4ReaderList` (11 assertions) — exact mixed-cohort
  count/identities, no duplicates, voided/all lifecycle views, committed V2
  once (total/qty/variant/recognition ids), deterministic ordering + identity
  tie-break, CROSS-READER PARITY (`recent` vs `sales` vs export), filters
  (ID/date/product/variant/range + no revival), quality surviving the cached
  read, read-only snapshot.
- `testSalesRecognitionV2U4ReaderDetail` (12 assertions) — legacy detail
  identity/line/lifecycle, voided + corrected linkage, legacy APP_ENTRY action
  path preserved, paid order detail (36,000 with `hppAnalytical` 15,130.58,
  `PRE_V2_ORDER`, fail-closed actions), V2 multiline snapshot lines, lineage
  (reversal + replacement active view), V2 Correct/Void fail closed, batch
  prefetch (one projection, fail closed on unknown), master-change snapshot
  authority, read-only.
- `testSalesV2U4MutationProof` — in-memory VM sensitivity proof, 6 injected
  bugs (one anchor each in `91.Transactions.Query.js`), tracked files never
  mutated: bypass U3 by reading Orders directly → `SALES_V2_U4_COHORTS:A3`;
  unpaid Order included → `SALES_V2_U4_COHORTS:A7`; one row per line →
  `SALES_V2_U4_COHORTS:A10`; Payment as a separate Sale →
  `SALES_V2_U4_COHORTS:A6`; pending V2 legacy fallback →
  `SALES_V2_U4_COHORTS:A9`; legacy Correct/Void exposed for V2 →
  `SALES_V2_U4_DETAIL:B5`.

MEASURED: `57 PASS, 0 FAIL` (53 baseline suites preserved + 3 U4 case suites
(28 assertions) + 1 U4 mutation proof (6 mutations)).

## Out of scope

U5 Finance/Revenue/P&L integration, U6 lineage write-side (Correct/Void for V2),
activation/config persistence, schema creation, deployment.
