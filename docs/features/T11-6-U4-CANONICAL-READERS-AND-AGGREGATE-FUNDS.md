# T11.6 — U4 Canonical Readers and Aggregate Funds (LOCAL / INERT-COMPATIBLE ONLY)

STATUS: LOCAL IMPLEMENTATION COMPLETE · READ AUTHORITIES ONLY · ZERO WRITES / ZERO DEPLOYS / ZERO CONFIG MUTATIONS
TASK_ID: T11_6_U4_CANONICAL_READERS_AND_AGGREGATE_FUNDS
PHASE: NUMLOCK_SINGLE_COMMIT_TRANSACTION_ARCHITECTURE
BASELINE_COMMIT: `8e76326` (T11.5 U3; verified HEAD, tracked-clean worktree, 27 pre-existing `tests/tmp/u10e-*` untouched)
CLASSIFICATION: L3 · R2 · REASONING_EFFORT high · Execution CONTINUE
AUTHORITY: `docs/T11-2-SINGLE-COMMIT-TRANSACTION-CONTRACT.md` §12–§15 + frozen D1/D11/D12; precedents U1/U2/U3.
REGRESSION: baseline **196 PASS / 0 FAIL** (MEASURED pre-edit) → final **207 PASS / 0 FAIL** (MEASURED post-edit, `node _test_runner.js`).

---

## 1. Purpose and Scope

Adapt every canonical READ authority so prospective single-commit Sales /
Expense / Purchase transactions are represented truthfully and exactly once,
preserving historical accounting. Writer semantics from U1/U2/U3 unchanged;
no writer defect encountered (no STOP condition). LOCAL only: no clasp, no
deploy, no production mutation, no 1040 creation, no T11 activation, no
transitional 24k execution, no U5/U6 config/correction writers, no historical
rewrites.

## 2. Reader Matrix (source-traced; no UI-label inference)

| Reader | Authority consumed | Change in U4 |
| --- | --- | --- |
| Transaction history (list/detail, `91`, `97B`) | Orders/tabops/PurchaseEvents + U3 projection (ledger only for verdicts) | NONE required — business-row construction never reads BalanceLedger (proved, test E36a); one business row per action proved on real composed artifacts (E33–E36) |
| Dashboard tiles (`90.Dashboard.Service/Reporting`, `196`) | `getCanonicalTransactionData` only | NONE required — no monetary-account/channel/funds tile exists (F37–F39); cannot present 1040 alone |
| Revenue / P&L (`36.buildFinanceProfitAndLoss`, U5 scope) | U3 projection events (Revenue) + ledger 6210 (material) | NONE required — money legs (1040/1030) provably zero P&L effect (D26–D32) |
| Balance Position (`39.buildPolicyCStatementReconciliation` → `36.getPartialBalanceDataWithRuntime`, UI `190:3291`/`200:317`) | BalanceLedger nets | ADAPTED: cash asset = aggregate over `AGGREGATE_MONEY_ACCOUNT_CODES` (`39:464`); label "Cash" → truthful "Total Funds" (`190:3291`) |
| Cash balance read model (`40.buildCashBalanceReadModel`) | CASH openings + ledger | ADAPTED: iterates aggregate universe (`40:648+`); 1040 starts at opening 0 when no opening row; per-account legacy rows preserved; aggregate TotalFunds line added (§12 presentation) |
| Cash Flow (`36.buildCashFlowStatement`/`getCashFlowData`) | ledger journals by JournalID | ADAPTED: money universe `["1000","1010","1020","1040"]` (`36:76`, `36:172`); §14.3 composition classification (`36:116+`) |
| T5 clearing (`99B`) | receipts + ledger + TransactionOperations plans | ADAPTED: composed SALES_MONEY_V2 (+ transitional-close shape) clearing, plan-expectation fail-visible validation, §15.3/§15.5 reconciliation expectations |
| Global 1030 (`99B.buildTreasury1030Reconciliation_`) | ledger 1030 + projection rows | ADAPTED per §15.3 (money/close groups expected = −recognition expectation); debit-positive preserved |
| Finance validators (`36.buildFinanceFinalReadinessEvidence_`) | Accounts evidence | ADAPTED: "1040" evidence demanded only while `SINGLE_COMMIT_TRANSACTION_V1` VALID+ACTIVE (`36:252+`, `36:275`); PREPARED/ABSENT/PAUSED/invalid never demands it |
| CapitalEquity (`38`) | unchanged | NONE (frozen) |

## 3. Account Sets (task A)

- `CASH_FOUNDATION_POLICY.ACCOUNT_CODES` stays `["1000","1010","1020"]` (`40:2`)
  — historical channel universe for openings/settlement validation/Treasury
  destination eligibility. NOT redefined. `DESTINATION_ACCOUNT_CODES` aliases
  it (`99:31`) — 1040 is NOT a manual T7 destination.
- NEW frozen `AGGREGATE_MONEY_ACCOUNT_CODES = ["1000","1010","1020","1040"]`
  (`40:31`) — READ-ONLY aggregation universe for TotalFunds.
- Behavioral proof that no normal T11 writer posts 1000/1010/1020 merely
  because readers aggregate them: real composed Sale fixture contains ZERO
  legacy monetary-account ledger rows (K66b); U2/U3 money account literal is
  exactly "1040" (`21:460`, `21:1702`, K66a).

## 4. Canonical Aggregate Funds Projection (task B)

`buildAggregateFundsReadModel_` (`40:40`) is the ONE TotalFunds definition:

```
TotalFunds = Σ over AGGREGATE_MONEY_ACCOUNT_CODES of (Σ active Debit − Σ active Credit)
```

- Debit-positive Asset semantics; journal pairs net out by construction; 1030 /
  1100 / 2000 / 4000 / 6210 never included.
- LEGACY compatibility: absent 1040 contributes 0; status `OK`.
- FAIL-VISIBLE: non-finite amounts → status `MALFORMED` + `malformedRows`
  (never silent). Readers remain config-independent (mode is a write gate, §17).
- Tests A1–A10 (each historical account alone, 1040-only, mixed, signs, pair
  netting, real composed sale = exactly orderTotal, missing-1040 tolerated,
  ACTIVE committed data, malformed visible, read-model legacy vs 1040 rows +
  aggregate line).

## 5. Balance Position (task D)

- `39:464`: cash asset = aggregate reduce (was `["1000","1010","1020"]`).
- UI (`190:3291`): label "Cash" → "Total Funds" (truthful generic label; the
  number is an aggregate). Renderer/element id unchanged.
- Equation coherence proved on 7+ fixtures (B11–B17): historical-only; 1040-only;
  mixed; real single-commit Sale; Expense; Purchase; combined — plus one
  end-to-end `getPartialBalanceDataWithRuntime` (FINAL, balanced, assets.cash
  equals self-computed aggregate, historical 2000 AP preserved). No rewrites.

## 6. Cash Flow — once-per-transaction, anti-double-count (task E)

- `36:76`/`36:172`: money universe + "1040" (mechanical §20 list extension;
  opening sum matches). Existing source-pin updated accordingly
  (`96.Tests.Treasury.Receipt.Durable.Save.Cases.js` I1a → new literal —
  contract-required adaptation, test strength retained).
- §14.3 composition (`36:116+`): ONLY a 1040 money line whose counterparts
  lack CashFlowGroup classifies by composition (Dr1040 → Operating inflow,
  Cr1040 → Operating outflow). Non-1040 journals keep the counterpart-group
  rule; anything else unresolvable stays `ambiguous` (fail-visible).
- Exactly-once per transaction (C18–C25): recognition journal (no money line)
  contributes zero; Sales money = ONE Operating inflow; Expense pair = ONE
  outflow; Purchase pair = ONE outflow; `MovementType=PURCHASE_RECOGNITION`
  with 1040 counterpart is an outflow (never non-cash); combined arithmetic is
  linear (each movement counted once); no clearing double count (1030 lines
  are never money lines); historical 1000/1010/1020 flows and legacy ambiguity
  preserved byte-for-byte in behavior.

## 7. Revenue / P&L — zero double counting (task F)

- Revenue remains U3-projection-only (`36` scope builder; authority metadata
  asserted D28/D30). Money legs are 1040/1030 rows: zero effect on Revenue,
  expense breakdown, material purchases, opex, depreciation (D26 deep-equal
  with/without money rows on identical canonical data).
- P&L = Revenue − material purchases (ledger 6210 only) − opex − depreciation;
  cogs = null, grossProfit = null, grossProfitAvailable = false; no 5000/1100
  account literals in Finance (D29/D31/K68). End-to-end: REAL composed Sale
  reads Revenue exactly once; stripping money rows changes nothing (D30).

## 8. Transaction history — one business row (task G)

Real composed Sale + historical committed Sale + one Expense row read through
`getTransactionsPage`: exactly ONE Sales row per action (recognition +
SALES_MONEY_V2 never two Sales; 4 ledger rows → 1 row), no journal-derived
rows, expense tab one row per tabops action, historical row preserved
(E33–E36). Source audit: business-row construction never reads BalanceLedger.

## 9. Dashboard (task H)

Source trace: Dashboard service/reporting/render consume canonical
transaction data only — no BalanceLedger, no monetary accounts, no cash-flow
or Balance Position fetch, no channel/payment fields, no funds tile at all
(F37–F39). Therefore no tile can present 1040 alone as "all funds"; no
dashboard change is truthful-necessary (narrowest adaptation = none). The one
aggregate presentation (Balance Position "Total Funds") is Finance-owned and
truthfully labelled (§5).

## 10. T5 clearing adaptation (task I)

- `99B:134` composed/close line index (as-of bounded, SourceType
  SALES_MONEY_V2 / TRANSITIONAL_CLEARING_CLOSE grouped by SourceID);
  `99B:153` plan index from committed SALES_RECOGNITION_V2_SAVE operation
  rows carrying `composedMoney:true`; `99B:179` per-exposure validation.
- VALID composed leg (exact 2-line journal, one 1040 + one 1030, balanced,
  MovementType SALES_MONEY, amount = event amount, plan journal identity +
  recomputed `policyCJournalSignature_` match, SRV2M-derived identity when no
  plan) = AUTHORITATIVE clearing: X recognized + X valid money → CLEARED,
  outstanding 0, ClearedAmount = X, ActiveReceiptCount 0, NO TreasuryReceipt,
  no synthesis (G41).
- FAIL-VISIBLE (each → EXCEPTION, clearing denied): missing leg (plan expects,
  ledger absent) → `JOURNAL_MISSING` (G42); wrong amount →
  `JOURNAL_AMOUNT_MISMATCH` (G43); wrong account → `JOURNAL_ACCOUNT_MISMATCH`
  (G44); duplicate active money journal → `JOURNAL_DUPLICATE` (G45); source/
  RecognitionID mismatch → `JOURNAL_MISSING` on the exposure + deterministic
  `LIFECYCLE_CONFLICT` reconciliation entry for the foreign group (G46);
  signature mismatch → `SIGNATURE_MISMATCH` (G47); impossible lineage/
  renamed journal identity → `JOURNAL_IDENTITY_MISMATCH` (G48). All codes are
  pre-existing frozen catalog entries (no invented codes).
- Void-lineage readiness: reversal-family SourceIDs are included in the
  exposure's clearing state so future U6 money reversals net correctly; a
  clean void still exits through the pre-existing voided path.
- Legacy/Treasury receipt semantics preserved: real T4 receipt save → CLEARED
  with ActiveReceiptCount ≥ 1, every existing rule intact; legacy reconciliation
  OK/residual 0 with zero composed-era codes (G49/G50).

## 11. Global 1030 (task J)

Debit-positive preserved. Healthy composed Sale: ledgerNet1030 = 0,
outstanding 0, residual 0, status OK (H51). Transitional fixture (24k
recognition, no money) remains VALID: outstanding 24k / net 24k / residual 0,
status OK — healthy is NOT redefined as net1030 = 0 (H52). MANDATORY combined
(transitional 24k + new composed Sale): outstanding 24k / net 24k / residual
0, composed sale CLEARED (H53). Corrupted ledger → nonzero visible exception
(H54). §15.3/§15.5: SALES_MONEY_V2 and TRANSITIONAL_CLEARING_CLOSE groups get
deterministic expectations (negative of the recognition-group expectation) —
healthy groups contribute zero residual; disagreements are attributed entries,
never unexplained.

## 12. Treasury compatibility (task K)

V1 ACTIVE baseline untouched: destination universe, T4/T6/T7 semantics, receipt
identity rules, T5 receipt-side quality codes, ROW_FIELDS contract all frozen
and asserted unchanged (K65, G49/G50, K70). 1040 is not a manual T7
destination. Normal composed Sales bypass TreasuryReceipt entirely; no
EvidenceRef.

## 13. Cache / read-after-write (task L)

- Server: U1 save core invalidates the dashboard revision on DONE
  (`97A:1572`); U2/U3 cores invalidate via `runtime.invalidate()`
  (`21:1592`, `21:2868`) (J64c).
- Client: Save success path invalidates Finance caches
  (`195:584 invalidateFinanceCache()`) and triggers dashboard refresh (J64d).
- T5, Finance, Balance Position, Cash Flow, aggregate projections: NO cache —
  computed on demand; structurally impossible staleness (J64d source audit).
- U4 Sales projection cache freshness already covered by existing U10F suites
  (unchanged, still green). DONE = no refresh needed for correct financial
  outputs.

## 14. Dates (task M)

Asia/Jakarta canonical date keys preserved end-to-end: composed money rows
carry `Tanggal` = recognition `EconomicDate` = "2026-10-15" as pure date keys
(no instant conversion); Cash Flow period filter uses canonical date keys
(in/out-of-period proved live via `getCashFlowData`); Balance Position
as-of = period end; T5 as-of bounded (pre-economic-date read shows no row,
as-of at economic date shows CLEARED); new T5 index contains no `new Date`/
instant conversion (I55–I59). No historical date rewrites.

## 15. Read vs Write mode (task N)

Readers carry zero config dependency (source-audited: no PropertiesService,
no `SINGLE_COMMIT_TRANSACTION_V1` inside `buildCashFlowStatement`,
`buildPolicyCStatementReconciliation`, `buildTreasuryClearingProjection_`,
`buildAggregateFundsReadModel_`). ABSENT/PREPARED → legacy reads; ACTIVE →
committed T11 data reads; PAUSED refuses writes (`singleCommitTransactionSalesGate_`)
but committed T11 data still reads identically (T5 CLEARED + Balance cash
effect intact); invalid config → writers refuse, readers unchanged, Finance
evidence gate falls back to legacy (no 1040 demanded) (J60–J64). Write
admission gates ≠ read/report authority.

## 16. Test Matrix (task O) — MEASURED

New suite file `96.Tests.SingleCommit.Readers.Cases.js` (registered in
`_test_runner.js`), 11 groups ≥ 100 individual checks covering the mandated
71-check matrix:

| Group | Function | Matrix map |
| --- | --- | --- |
| A (10) | `testSingleCommitAggregateFunds` | aggregate funds 1–10 |
| B (10) | `testSingleCommitBalancePosition` | Balance Position 11–17 |
| C (10) | `testSingleCommitCashFlow` | Cash Flow 18–25 |
| D (10) | `testSingleCommitRevenuePAndL` | Revenue/P&L 26–32 |
| E (5) | `testSingleCommitTransactionOneRow` | Transaction 33–36 |
| F (4) | `testSingleCommitDashboardSemantics` | Dashboard 37–40 |
| G (13) | `testSingleCommitT5ComposedClearing` | T5 41–50 |
| H (4) | `testSingleCommitGlobal1030` | 1030 51–54 |
| I (6) | `testSingleCommitDateAuthority` | Dates 55–59 |
| J (9) | `testSingleCommitReadModeCache` | Mode/read + cache 60–64 |
| K (10) | `testSingleCommitRegressionPins` | Regression 65–71 |

MEASURED: full harness `node _test_runner.js` → **207 PASS / 0 FAIL**
(196 baseline suites incl. U1/U2/U3, Finance, Transaction, Dashboard, Treasury
T3–T10.5, T5 — all green; existing tests not weakened; one source pin updated
to the T11.2 §20-listed literal, strength retained). No estimated counts.

## 17. Changed files

- `40.Cash.Foundation.js` — aggregate constant + projection + read model
  (`40:31`, `40:40`, `40:648+`)
- `39.Balance.Foundation.js` — Balance Position cash asset (`39:464`)
- `36.Finance.Service.js` — Cash Flow lists/composition (`36:76`, `36:116+`,
  `36:172`), validator gate (`36:252+`, `36:275`)
- `190.View.Index.html` — truthful label (`190:3291`)
- `99B.Treasury.Clearing.Projection.js` — composed clearing + expectations
  (`99B:134`, `99B:153`, `99B:179`, `99B:892`, `99B:973`, reconciliation/
  attribution branches)
- `96.Tests.Treasury.Receipt.Durable.Save.Cases.js` — I1a literal pin (§20)
- `96.Tests.SingleCommit.Readers.Cases.js` — NEW (11 suites)
- `_test_runner.js` — file registration + 11 run entries
- `docs/T11-6-U4-CANONICAL-READERS-AND-AGGREGATE-FUNDS.md` — this evidence

## 18. Safety / mutations

Writes: 0 · deploys/pushes: 0 · config writes: 0 · financial events: 0 ·
production reads: 0 · Git mutations: 0 · clasp invocations: 0 · u10e files
touched: 0. Reader-only source edits; no writer semantics modified.

## 19. Remaining work (out of U4 scope)

U5 config `SINGLE_COMMIT_TRANSACTION_V1` + activation plumbing · U6
corrections/voids (signed 1040 reversals; T5 reversal-money path is
pre-wired) · U7 Accounts 1040 creation · U8 activation · U9 first-production
acceptance · U10 transitional 24k execution. NEXT_RECOMMENDED_UNIT:
`T11_7_U5_CONFIG_AND_ACTIVATION_PLUMBING`.

## 20. Telemetry

agent: numlock-heavy (Free) · backend/model: 9router/numlock-explore-free ·
reasoning: high · fallback: none · toolcalls: ~60 · elapsed: ~35 min ·
files read: ~30 · files modified: 8 · test runs: 4 (1 pre-edit baseline
196/0; 2 repair cycles 203/4 → 206/1; final 207/0 MEASURED).
