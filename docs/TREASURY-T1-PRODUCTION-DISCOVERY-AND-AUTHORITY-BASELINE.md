# Treasury T1 — Production Discovery and Authority Baseline

**Phase:** NUMLOCK_TREASURY_ARCHITECTURE_AND_RECONCILIATION_DESIGN
**Task:** T1_TREASURY_PRODUCTION_DISCOVERY_AND_AUTHORITY_BASELINE
**Classification:** COMPLEXITY L3 · OPERATIONAL_RISK R2 · REASONING_EFFORT high
**Scope:** ARCHITECTURE DISCOVERY ONLY. Zero Treasury implementation. No source edits.
**Evidence classes:** MEASURED = executed/observed in this session or sha-verified at HEAD;
SOURCE = repository source at HEAD; PRIOR-MEASURED = accepted in-repo evidence at/near HEAD;
NOT_ESTABLISHED = no determinable evidence (never inferred).

---

## 1. Frozen starting state

| Fact | Value | Evidence class |
| --- | --- | --- |
| Starting HEAD | `0cf8aba66b248da035a48c1008717fe5145b9196` (`0cf8aba`) — matches expected BASELINE_COMMIT | MEASURED (`git rev-parse HEAD`) |
| Tracked worktree delta at start | 0 (only 27 untracked `tests/tmp/u10e-*`) | MEASURED (`git status --short`) |
| Staged/index delta at start | 0 | MEASURED (`git diff --cached`) |
| Deployment | canonical **v711** (710 → 711, 68/68 sha verified), 2 deployments, `@HEAD` untouched | PRIOR-MEASURED (`docs/FINANCE-UI-DISPATCH-LIVENESS-REMEDIATION.md` §16.2) |
| Sales V2 state | `SALES_RECOGNITION_V2` = `PRODUCTION_ACTIVE_ACCEPTED`; ActivationID `b4791011-120e-4985-92da-a61c6311060c`; T `2026-10-08T18:59:50.540Z`; configVersion 1 | PRIOR-MEASURED (U10 activation doc §0.6–0.7) |
| First genuine V2 Sale | Rp24,000 DINE_IN → `Dr1030 24,000 / Cr4000 24,000`, journal `SRV2J-CE122B27-ORD677BE5CES`, event `SCR-CE122B27-ORD677BE5CES`, order `ORD-677BE5CE-SALESRECOGNI`, 2026-10-09 | PRIOR-MEASURED (U10 activation doc, Finance UI doc §16.1/16.4) |
| Finance | production accepted; Finance gate PASS (U5 `revenueAuthorityComplete=true`, first Sale +24,000 exactly once) | PRIOR-MEASURED (Finance UI doc §16.1) |
| Treasury | not implemented (no source, no sheet, no UI, no writer) | SOURCE (full-repo scan: zero `Treasury` tokens in runtime source) |
| Local regression baseline | expected 101 PASS / 0 FAIL | re-measured below (§ TEST / SOURCE AUDIT) |

## 2. Production safety (this task)

- **Production writes = 0.** No Sale, Payment, Settlement, Cash/Bank, refund, credit, config,
  account, schema, header, spreadsheet, or cache mutation was issued. Production = READ ONLY.
- **Deployment actions = 0.** No `clasp push`, `clasp deploy`, `clasp version`, `clasp pull`,
  deployment mutation, or Git push.
- **Fresh production reads: attempted, BLOCKED_PERMISSION.** Two allowlisted read-only commands
  were invoked once each:
  - `clasp run runCashProductionDiagnostic` → `Unable to run script function. Please make sure you have permission to run the script function.`
  - `clasp run validateFinanceProductionRuntime` → same error.
  This matches the known-denied state recorded at U9 (§7 "Apps Script function execution
  `clasp run`: BLOCKED_PERMISSION (403; no execution scope on either stored identity)") and U3
  (`clasp run` = BLOCKED_PERMISSION). **No retry, no workaround, no mutation to bypass the read gap.**
- Consequence: fresh row-level production re-measurement was impossible in this session.
  Data-level claims therefore rest on **PRIOR-MEASURED evidence committed at HEAD** (sha-verified
  sheet snapshots whose shas are re-confirmed unchanged at v711) plus **SOURCE** analysis.
  Every affected item below is labelled; nothing is presented as fresh MEASURED.
- **Local only:** one diagnostic script created (`tests/tmp/t1-source-authority-scan.js`,
  read-only fs scan), one full local regression run before documentation (final run in § TEST),
  this document. No tracked runtime source touched.

## 3. Account map (Investigation 1)

Production `Accounts` = **22 data rows**, 9-column header, no duplicate AccountCode,
sheet sha256 prefix `f97cbe167e6a9364` (unchanged from pre-first-event baseline through v711).
Row-level production metadata verified for `1000/1010/1020` (READY exact, finance-phase-13moe),
`1030`, `2010`, `4000`, `6210`, `2000` (U10 doc §2.2). The remaining rows are reconstructed from
source authorities (`BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE` = 16 codes,
`INVENTORY_ASSET_ACCOUNT` 1100); 16 + `1010/1020/1100/2000/1030/2010` = **exactly 22**, reconciling
the measured count. Reconstructed rows are marked SOURCE-RECONSTRUCTED (row-level production
metadata not exposed by any available read surface).

| Account | Name | Type | Normal balance | Active | Current usage | Prospective Treasury relevance |
| --- | --- | --- | --- | --- | --- | --- |
| 1000 | Cash / Cash on Hand | Asset | DEBIT | TRUE | legacy `PAID_SALE`/`PAID_EXPENSE`/AP/transfer postings; cash balance + cash-flow source | **Receipt target (cash)** |
| 1010 | DANA Business | Asset | DEBIT | TRUE | destination of the single production Payment (`PAY-B3EEB322…`, ReceiveVia 1010) | **Receipt target (wallet)** |
| 1020 | Cash in Owner Custody – BluBCA | Asset | DEBIT | TRUE | UI label "BluBCA"; bank-custody cash | **Receipt target (bank)** — owner must confirm BANK vs CASH classification |
| 1030 | Sales Settlement Clearing | Asset | DEBIT | TRUE | V2 recognition clearing; Dr 24,000 uncleared | **THE clearing account Treasury must clear (Dr Cash/Bank, Cr 1030)** |
| 1100 | Inventory Asset | Asset | DEBIT | TRUE (SOURCE-RECONSTRUCTED) | Policy C legacy inventory basis; HPP analytical target | none (out of Treasury scope) |
| 1500 | Fixed Assets | Asset | DEBIT | TRUE (SRC-REC) | acquisition basis | none |
| 1590 | Accumulated Depreciation | Asset (contra) | CREDIT | TRUE (SRC-REC) | depreciation | none |
| 2000 | Accounts Payable | Liability | CREDIT | TRUE (measured `MIGRATED`) | PurchaseEvent UNPAID credit; `AP_SETTLEMENT` debit | disbursement-side only (deferred) |
| 2010 | Customer Refund and Credit Payable | Liability | CREDIT | TRUE (measured) | **no writer — frozen future refund/credit authority** | future refund/credit (OUT of V1) |
| 3000 | Owner Capital | Equity | CREDIT | TRUE (SRC-REC) | capital equity | none |
| 3100 | Owner Draw | Equity | DEBIT | TRUE (SRC-REC) | capital equity | none |
| 3200 | Retained Earnings | Equity | CREDIT | TRUE (SRC-REC) | opening `FOB-3200-20260731` | none |
| 4000 | Sales Revenue | Revenue | CREDIT (`NormalBalance` blank = frozen legacy convention) | TRUE (measured) | legacy `PAID_SALE` credit + V2 `Cr4000` | **must NOT receive Treasury credits (Revenue authority is separate)** |
| 5000 | Cost of Goods Sold | COGS | DEBIT | TRUE (SRC-REC) | legacy `SALE_HPP` (pre-transition); analytical post-2026-10-01 | none (Policy C) |
| 6100 | Salary Expense | Expense | DEBIT | TRUE (SRC-REC) | expense postings | none |
| 6200 | Kitchen Supplies Expense | Expense | DEBIT | TRUE (SRC-REC) | expense postings | none |
| 6210 | Raw Material Supplies Expense | Expense | DEBIT | TRUE (measured) | Policy C prospective purchase expense | none (must not be Sale-triggered) |
| 6300 | Repairs and Maintenance Expense | Expense | DEBIT | TRUE (SRC-REC) | expense postings | none |
| 6310 | Equipment Upgrade Expense | Expense | DEBIT | TRUE (SRC-REC) | expense postings | none |
| 6400 | Utilities and Occupancy Expense | Expense | DEBIT | TRUE (SRC-REC) | expense postings | none |
| 6500 | Event Expense | Expense | DEBIT | TRUE (SRC-REC) | expense postings | none |
| 6900 | Depreciation Expense | Expense | DEBIT | TRUE (SRC-REC) | depreciation (NonCash) | none |

**Negative findings (SOURCE):** no QRIS account, no gateway/MDR/fee account, no suspense account,
no customer-receivable account, no dedicated bank ledger account beyond `1020`, no second clearing
account. Cash/Bank universe = **{1000, 1010, 1020}** (hard-coded in `CASH_FOUNDATION_POLICY.ACCOUNT_CODES`,
`buildCashFlowStatement`, `buildPolicyCStatementReconciliation`, UI cash selectors).

## 4. 1030 exact state (Investigation 2)

| Dimension | State | Evidence |
| --- | --- | --- |
| Account row | count=1, exact metadata, unique, active | PRIOR-MEASURED (U10 §2.2) |
| Opening balance | no opening evidence for 1030 (not in cash/opening account sets; account created in the V2 account-preparation step, i.e. after U9's blocked phase-3) | SOURCE + PRIOR-MEASURED (U9 §8: "1030/2010 rows not created" pre-preparation; later created) |
| Current balance | **Dr 24,000 / Cr 0 / net Dr 24,000** | PRIOR-MEASURED (U10 §post-first-event; Finance UI doc §16.4 "Account 1030 shows the expected +24,000 uncleared debit") |
| Journal count | 1 journal, 2 lines: `SRV2J-CE122B27-ORD677BE5CES` | PRIOR-MEASURED |
| Line detail | line1 Dr 1030 24,000; line2 Cr 4000 24,000; MovementType `SALES_RECOGNITION`; SourceType `SALES_RECOGNITION_V2`; SourceID `SCR-CE122B27-ORD677BE5CES`; JournalSignature verified at Save readback | PRIOR-MEASURED + SOURCE (97A) |
| Date range | single economic date **2026-10-09** | PRIOR-MEASURED |
| Source modules | SalesRecognition V2 only | SOURCE (T1-C: only 97A/97C write V2 journals; both frozen to 1030/4000 — T1-D) |
| Rp24,000 trace | `ORD-677BE5CE-SALESRECOGNI` DINE_IN, 2 OrderLines 6,000 + 18,000 = 24,000, HppTotalSnapshot 10,680.6 (analytical, never posted) → recognition event → 2-line journal | PRIOR-MEASURED (U10 artifact counts) |
| Movement classification | 100% = recognized V2 Sale exposure | MEASURED-by-classification over all 1030 rows (1 of 1) |
| Unexplained residual | **0** — full 24,000 attributable to recognized Sale awaiting settlement | derived from rows above |

## 5. CASH_BANK_WRITER_MATRIX (Investigation 3)

Every mechanism that can change Cash/Bank (1000/1010/1020) accounting. **Never invoked.**

| # | File/function | Trigger | Target accounts (Dr/Cr) | Journal semantics | Idempotency | Audit | UI-reachable | Class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | `40.Cash.Foundation.js` `cashSettleAndPersist` → `buildCashPostingCandidate` | legacy Payment (`submitOperationalPayment`), canonical SALES/EXPENSE entry settle (`21.Transaction.Entry`), settlement recovery | INFLOW: Dr cash / Cr 4000 (+Dr 5000 / Cr 1100 HPP snapshot); PAID_EXPENSE: Dr expense / Cr cash; AP_SETTLEMENT: Dr 2000 / Cr cash; TRANSFER: Dr counter / Cr cash | `CASH-<SourceType>-<SourceID>` journals, MovementType `PAID_SALE`/`SALE_HPP`/`PAID_EXPENSE`/`AP_SETTLEMENT`/`CASH_TRANSFER` | SettlementID payload signature → `ALREADY_POSTED` / `IDENTITY_CONFLICT`; ledger source-key signature → `REFUSED_DUPLICATE_SOURCE`; `cashVerifyPostWrite` readback | `Settlements` row + ledger rows; `21` logs `Logs/SETTLEMENT_PENDING` WARN on refusal | Yes (payment, expense, purchase, receipt flows) | LEGACY (blocked for V2 sales: `SALES_V2_NO_CASH_POST`) |
| W2 | `21.Transaction.Entry.js` `submitCanonicalTransaction` → `attemptCashSettlement` | SALES/EXPENSE entry with cash account, `dateKey > 2026-09-30` | delegates to W1 | `CSH-SAL-/CSH-EXP-/CSH-AP-<id>` settlement IDs | inherits W1 | `Logs` pending rows | Yes | LEGACY |
| W3 | `47.Purchase.Events.js` `postPolicyCPurchaseEvent_` → `writeLedger` | PurchaseEvent accounting (PAID purchase, AP recognition) | PAID: Dr 6210 (or 1100 pre-transition) / Cr **CashAccountCode**; UNPAID: Dr 6210/1100 / Cr 2000 | `POLICYC-PEXP-PURCHASE-<id>` / `POLICYC-PURCHASE-<id>`, MovementType `PURCHASE_RECOGNITION`, SourceType `PURCHASE_EVENT` | `policyCExistingJournalState_` COMPLETE → `ALREADY_POSTED`; CONFLICT → `ACCOUNTING_EXCEPTION` | AccountingStatus on event + ledger rows | Yes (Purchase / operational purchase) | PROSPECTIVE (Policy C) |
| W4 | `39.Balance.Foundation.js` `policyCSalesHppRuntime_.writeLedger` | legacy Sale HPP posting (pre-transition only) | Dr 5000 / Cr 1100 | `SALE_HPP` candidates; post-2026-10-01 → `NON_POSTING_ANALYTICAL_AUTHORITY` (no write) | existing-source check | `Logs` `PolicyCAccounting/ACCOUNTING_EXCEPTION` ERROR rows | No direct surface | LEGACY → obsolete-post-transition |
| W5 | `41.Inventory.Opening.Staging.js` (BalanceLedger row-2 seed) | controlled opening migration | opening components (e.g. Dr 1100 / Cr opening) | `MONETARY_INVENTORY_OPENING` | `ALREADY_POSTED` on existing source rows | staging migration record | No (migration-only) | HISTORICAL/migration |
| W6 | `40.Cash.Foundation.js` `cashBridgeCanonicalTransactions` / `cashBridgeCanonicalPurchaseEvents` | one-time historical bridge, cutoff 2026-09-30 | legacy transactions → settlements + ledger | bridge rows | source-existing checks | bridge record | No | HISTORICAL (dormant) |
| W7 | `97A`/`97C` Sales V2 Save/Void/Correct | V2 recognition / void / correct | **1030/4000 only — never cash** | `SRV2J*` journals | RequestKey + OperationID + signature + readback | `SalesRecognitionAudits` | Yes (Sales V2) | PROSPECTIVE (excluded from cash) |
| W8 | Manual Finance writes | — | **none exists**: `36/35/38/12A` are read-only builders | — | — | — | Finance UI is read-only | none |
| W9 | Treasury | not implemented | — | — | — | — | — | none |

BalanceLedger write surfaces (exact set, MEASURED by `T1-C`): `{39, 40, 41, 47, 97A, 97C}` — no other runtime file writes the ledger.

## 6. Legacy Payment analysis (Investigation 4)

- **Schema** (`TRANSACTION_PRODUCTION_CONTRACT.PAYMENTS`): `PaymentID, OrderID, RequestKey, ReceiveVia, AccountCode, Amount, PaidAt, PaidBy, Status` (9 columns).
- **Row count:** **1** (PRIOR-MEASURED, sheet sha `e357140d51acf6fc` UNCHANGED across U10 activation, first-event, and v711 Finance phases).
- **Date range:** single instant `PaidAt = 2026-10-06T18:53:10.509Z`.
- **Identity:** `PAY-B3EEB322-PAYMENTPAYME`; operation `TXOP-B3EEB322-PAYMENTPAYME` `COMMITTED`; `RequestKey` idempotency key.
- **Order linkage:** legacy pre-V2 Order, read back `PAID` (transaction-activation-promotion evidence).
- **Amount:** 36,000 = `OrderTotal` (exact match enforced: `PAYMENT_AMOUNT_MISMATCH` refusal otherwise).
- **Method/account:** `ReceiveVia = 1010` → `AccountCode = 1010` (DANA Business), resolved from the Accounts master (`transactionReadPaymentMethods_` = active cash accounts only).
- **Status lifecycle:** write-once `SUCCESS` (no transition machine; second Payment refused by `SECOND_PAYMENT_REFUSED`).
- **Writers:** `createDurableOperationalPayment_` (95A), `payOperationalOrder` (95, memory repository path). **Readers:** `findPaymentByRequest`, `repository.read()`, `transactionFinanceSettlementExists_`, Finance/inventory evidence allowlists.
- **Accounting effect:** **none direct** — Payment row posts nothing; accounting happens only through the derived Settlement (W1): journal `CASH-SALE_SETTLEMENT-PAY-B3EEB322-PAYMENTPAYME`, `Dr1010 36,000 / Cr4000 36,000` + `Dr5000 15,130.58 / Cr1100 15,130.58`.
- **BalanceLedger rows:** yes, 4 lines via that journal (PRIOR-MEASURED + SOURCE).
- **Customer intent vs verified money:** **intent only** — operator-selected ReceiveVia; no bank/processor/QRIS verification exists anywhere in source or data.
- **Historical Revenue gate:** yes for the legacy chain (Revenue recognized at Payment via `PAID_SALE Cr4000`); superseded by V2 (Revenue at recognition).
- **Can new V2 Sales still create Payment rows? NO — confirmed.** Source: `salesV2OperatorPaymentGuard_` throws `SALES_V2_OPERATOR.PAYMENT_CODE` before the first write for any V2-cohort Order; `submitOperationalOrder` routes ACTIVE config to V2 Save only; `buildCashPostingCandidate` additionally blocks V2 cash posts. Data: Payments count/sha unchanged (+0 Payment) across activation, first V2 Sale, and the v711 Finance phase.
- **Classification:** **B historical + D compatibility** — operational record for pre-V2 Orders only; **unsafe as money authority** (unverified intent); never accounting authority; prospective use forbidden for V2.

## 7. Legacy Settlement analysis (Investigation 5)

- **Schema** (`CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS`, 20 cols): `SettlementID, Tanggal, Direction, AccountCode, CounterAccountCode, Amount, Currency, SourceType, SourceID, RelatedTransactionType, RelatedTransactionID, TransferID, ExternalRef, Status, Keterangan, ReversalOf, IsActive, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy`.
- **Row count:** **2** (PRIOR-MEASURED, sha `1b3a361e0f014464` UNCHANGED through v711).
- **Known row 1:** `CSH-SAL-PAY-B3EEB322-PAYMENTPAYME` — `Direction INFLOW`, `AccountCode 1010`, `Amount 36,000`, `SourceType SALE_SETTLEMENT`, `SourceID = PaymentID`, `RelatedTransactionType Order`, `Status POSTED`, `CreatedAt/PaidAt 2026-10-06`.
- **Row 2:** **identity NOT_ESTABLISHED** — no in-repo evidence names it; fresh read BLOCKED_PERMISSION. (A consistent reconstruction is an `EXPENSE_SETTLEMENT`/`CASH_TRANSFER` row paired with the 2 unattributed legacy ledger lines, but this is a hypothesis, not evidence.)
- **Payment/Order linkage:** settlement→Payment via `SourceID`; Payment→Order via `OrderID`; correlation key `PaymentID` (confirmed in W1 evidence).
- **Provider/channel semantics:** none — no provider, no channel, no QRIS/gateway fields. `Currency` fixed `IDR`.
- **Status:** `PENDING/POSTED/FAILED/CANCELLED/REVERSED`; only `POSTED` posts; `SETTLEMENT_REVERSAL` rows reverse via sign-swapped lines.
- **Writers:** `cashPersistSettlement` (append) inside `cashSettleAndPersist` only. **Readers:** `transactionFinanceSettlementExists_`, `validateCashSettlements`, `cashEffectiveSaleSettlementAggregate`, Finance readiness diagnostic, Inventory Policy Evidence allowlist.
- **Accounting effect:** none on the row itself; effect only through its ledger journal (W1).
- **UI reachability:** no settlement surface; reachable only indirectly via Payment/Expense/Purchase actions.
- **Idempotency:** SettlementID + payload signature; source-key ledger signature; post-write verification.
- **Historical meaning of "Settlement":** the **cash-leg posting record** of a Payment/Expense/AP/Transfer after the 2026-09-30 cash cutover — i.e. "money moved into/out of a cash account", **not** a provider/acquirer settlement batch.
- **Classification:** **C accounting evidence + partially A (posting authority) for legacy cash movements**; explicitly forbidden for V2 sales; row-2 identity unresolved.

## 8. BalanceLedger analysis (Investigation 7)

- **Schema (16 cols):** `JournalID, LineID, Tanggal, AccountCode, Debit, Credit, MovementType, SourceType, SourceID, ExternalRef, Keterangan, IsActive, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy`.
- **Journal identity:** `JournalID` (family-prefixed, e.g. `SRV2J-…`, `CASH-<SourceType>-<SourceID>`, `POLICYC-…`); **line identity:** `LineID = JournalID + "-" + suffix`; business refs: `SourceType` + `SourceID` (+ `ExternalRef`), never row position.
- **Dr/Cr representation:** separate numeric columns, validated balanced (`validateBalanceLedgerCandidates`, and `buildPolicyCStatementReconciliation` refuses `debits !== credits`).
- **Integrity:** `cashJournalSignature` / `policyCJournalSignature_` computed over rows; duplicate source with different signature → `REFUSED_DUPLICATE_SOURCE`; identical → `ALREADY_POSTED`; V2 Save verifies the stored signature at readback before `RECOGNIZED`.
- **Append-only:** all writers append; corrections are **reversal + replacement rows**, never in-place edits (V2 Void/Correct; `SETTLEMENT_REVERSAL`). Exception: migration-time row seed (W5).
- **Posting status:** `IsActive` flag per row; inactive rows excluded from every balance/cash reader.
- **Production row count:** **8** = 6 legacy + 2 V2 (PRIOR-MEASURED, sha-verified across U10/v711 phases).
- **Journal families in production (code-supported + data):**
  - `SALES_RECOGNITION_V2` — 2 rows measured (`Dr1030/Cr4000`, 2026-10-09).
  - `SALE_SETTLEMENT` (MovementType `PAID_SALE` + `SALE_HPP`) — at least 4 rows: `Dr1010/Cr4000` 36,000 and `Dr5000/Cr1100` 15,130.58 for `CASH-SALE_SETTLEMENT-PAY-B3EEB322…` (PRIOR-MEASURED journal evidence).
  - Remaining ~2 legacy rows: composition **NOT_ESTABLISHED** (attributable candidate = second Settlement's journal; unverified).
  - Families present in source but with **0 production rows**: `EXPENSE_SETTLEMENT`, `AP_SETTLEMENT`, `CASH_TRANSFER`, `SETTLEMENT_REVERSAL`, `PURCHASE_RECOGNITION`, `MONETARY_INVENTORY_OPENING`, Policy-C `SALE_HPP` legacy rows.
- **Classification:** **C accounting evidence (ledger = accounting truth, not event authority); A posting authority only for the cash/purchase posting families; never event authority for money movement.**

## 9. Finance dependencies / readers (Investigation 9)

| Reader | Source | What it observes | Treasury impact check |
| --- | --- | --- | --- |
| P&L (`getFinanceDataWithRuntime`, `buildFinanceProfitAndLoss*`) | `36.Finance.Service.js` | Revenue **only** from recognized-Sales projection by EconomicDate — comment contract: "Never activeView, never BalanceLedger 4000 credits, Payments, Order headers…" | **Dr Cash/Bank / Cr 1030 creates no Revenue** ✓ (no 4000 credit; and ledger 4000 credits are not a Revenue source anyway) |
| Cash Flow (`getCashFlowData` → `buildCashFlowStatement`) | `36` | journal-grouped cash lines of 1000/1010/1020, classified by counterpart `CashFlowGroup`; opening from `FinanceOpeningBalances` cash rows | Treasury receipt journal counted **once** as an Operating inflow (counterpart 1030 = `CashFlowGroup Operating`) ✓; no double count provided Treasury writes only BalanceLedger |
| Balance Position (`getPartialBalanceDataWithRuntime` → `buildPolicyCStatementReconciliation`) | `36` + `39` | `cashChange` = Σ(1000,1010,1020) ledger balances; also 1100, 2000, 5000, 6210; refuses unbalanced ledger / prohibited 3210,5010 | Treasury journals must be balanced (they are) → automatically included ✓; refuses if unbalanced |
| Cash balance model (`buildCashBalanceReadModel`) | `40.Cash.Foundation.js` | opening (FinanceOpeningBalances) + ledger debits/credits after cutover 2026-09-30, vs optional observed balances (`RECONCILED/MISMATCH/UNAVAILABLE`) | same single ledger source → no double count ✓ |
| Revenue/recognized-sales (`buildFinanceSalesRecognitionScope_`, U4/U5 readers) | `36`/`97B` | recognition events only | untouched by Treasury ✓ |
| 1030 / 2010 surfaces | none dedicated | 1030 visible only through ledger/balance math; 2010 never appears | Treasury must not assume existing reader coverage |
| Capital & Equity / Depreciation / Product Profitability | `38`/`12A`/`50` | unrelated to cash/1030 | none |

**Future integration needs:** (a) a 1030 clearing balance/residual surface (does not exist);
(b) `RECONCILED/MISMATCH` observed-balance input for Treasury receipts (currently `UNRECONCILED`
unless an observed balance is supplied); (c) nothing else — no reader change is required for
`Dr Cash/Bank / Cr 1030` to be observed correctly.

## 10. Fee evidence (Investigation 10)

- SOURCE (MEASURED scan `T1-J`): **zero** occurrences of `QRIS`, `MDR`, `gateway`, `FeeAmount`,
  fee-code patterns in runtime source; no fee account among the 22 (§3).
- PRIOR-MEASURED: no fee row, fee amount, or net-settlement field appears in any recorded
  production settlement evidence (`Amount` = full 36,000; `RevenueSnapshot = OrderTotal`).
- **FEES = NOT_ESTABLISHED** (no production example, no code path, no account). No fee accounting
  may be invented for Treasury design; if off-system QRIS fees exist, that is an owner decision (§25).

## 11. Aggregate settlement evidence (Investigation 11)

- Production: exactly **one** settlement, tied 1:1 to one Payment and one Order, full amount.
- Source: multi-settlement aggregation **capability exists** for legacy sales —
  `cashEffectiveSaleSettlementAggregate` sums active non-reversed `SALE_SETTLEMENT` rows per
  RelatedTransaction and caps the next posting at `remaining` (split/refill tests `P-SPLIT-A/B/C`
  exist in `96.Tests.Cash.Foundation.Cases.js`); `RelatedTransactionType` accepts `Order` and `Sales`.
- **AGGREGATE_SETTLEMENT_PATTERN = NOT_ESTABLISHED** in production. Observed pattern = per-Order,
  exact amount, single receipt. No daily, batch, multi-day, partial, or mixed-channel example exists.

## 12. Partial / over / under evidence (Investigation 12)

| Case | Production evidence | Source behavior |
| --- | --- | --- |
| Partial payment | none | AP partial refused (`REFUSED_UNSUPPORTED_PARTIAL_AP_SETTLEMENT`); cash sale partial allowed only against remaining aggregate (never above OrderTotal) |
| Overpayment | none | refused (`SALE_OVER_SETTLEMENT`; `PAYMENT_AMOUNT_MISMATCH`) |
| Underpayment | none | refused (`PAYMENT_AMOUNT_MISMATCH` — amount must equal OrderTotal) |
| Rounding | none (integer IDR everywhere) | `financeAmountsMatch` epsilon only for reconciliation |
| Settlement difference | none | `REFUSED_UNSUPPORTED_PARTIAL_REVERSAL` (reversals must be full amount) |
| Unmatched money | none | `ambiguous` cash-flow entries exist only as reader metadata (`NO_COUNTERPART`, `UNCLASSIFIED_COUNTERPART`) |
| Duplicate receipt | none | `DUPLICATE_PAYMENT_REQUEST`, `SECOND_PAYMENT_REFUSED`, `REFUSED_DUPLICATE_SOURCE`, SettlementID signature |

**CLASSIFICATION: not established in production; structurally refused or capped by source.**

## 13. Refund / credit / 2010 analysis (Investigation 13)

- `2010` = `Customer Refund and Credit Payable`, exact+unique+active in production (measured §3).
- **No current writer posts 2010** — MEASURED by local diagnostic: `T1-A` (no runtime file builds a
  posting object for `"2010"` with Debit/Credit keys → 0 hits), `T1-B` (the `2010` token appears
  only in `97.SalesRecognition.V2.Foundation.js` expectations + tests/guards), `T1-K` (no refund
  journal writer of any kind).
- Ordinary Sale never touches 2010: V2 journals frozen to `{SETTLEMENT:"1030", REVENUE:"4000"}`
  (`T1-D`, `T1-E`); production first Sale touched only 1030/4000 (measured).
- Ordinary Void does **not** auto-create 2010: Void = reversal `Dr4000 / Cr1030` only
  (`97C` contract comment and `96.Tests…U6` A5/P2 checks).
- Frozen future semantics (contract, not code): transfer `Dr1030/Cr2010`; refund `Dr2010/CrCashBank`;
  credit use `Dr2010/Cr1030`.

## 14. AP / Purchase interaction (Investigation 14)

- `2000` AP exists (measured `MIGRATED`, NormalBalance CREDIT).
- `PurchaseEvent` (`47`, sheet `PurchaseEvents`, 9 legacy rows all `2026-09-17…2026-09-30`,
  `LEGACY_UNCLASSIFIED_NON_POSTABLE`, no PaymentStatus inference) → prospective posting:
  PAID → `Dr6210/1100 + Cr CashAccountCode`; UNPAID → `Dr6210/1100 + Cr 2000`;
  later payment → `AP_SETTLEMENT Dr2000 / Cr cash` (full amount only).
- Disbursement paths already deterministic and idempotent (W1/W3); they do **not** route through 1030.
- **Recommendation: `TREASURY_V1_SCOPE = RECEIPTS_ONLY`.** Evidence: (a) the only measured
  uncleared residual is receipts-side (1030 Dr 24,000); (b) outflows already have an accepted,
  idempotent, audited posting path (Policy C purchase + AP settlement + cash runtime); (c) 2010
  (refund/credit outflow) is frozen and unwritten; (d) minimum viable authority = clearing 1030
  without opening a second disbursement surface. Disbursements become a V2+ decision (§24).

## 15. Identity / idempotency patterns (Investigation 15)

| Pattern | Sales V2 | Cash/Settlement | PurchaseEvent | Fit for Treasury |
| --- | --- | --- | --- | --- |
| RequestKey client idempotency | yes (`TXOP-` operation per key) | Payment RequestKey | `RequestKey` + `NormalizedPayload` conflict refusal | **adopt** |
| OperationID + persisted intent (`OperationPlan`) | yes | no (direct settle) | partial (event row first) | **adopt** |
| Immutable event + append-only correction/reversal | yes (Void/Correct reversal rows) | reversal rows (`SETTLEMENT_REVERSAL`) | correction rows | **adopt** |
| ScriptLock / explicit lock | yes | `runtime.lock.acquire()` | orchestrator lock | **adopt** |
| Exact readback before COMMITTED | yes | `cashVerifyPostWrite` | AccountingStatus readback | **adopt** |
| Journal signature | `policyCJournalSignature_` | `cashJournalSignature` | source-state completeness | **adopt** |
| Audit event | `SalesRecognitionAudits` | `Logs` rows | event audit fields | **adopt** (Treasury audit table, not Logs-only) |
| Fail-closed account preflight | `preflightSalesRecognitionAccounts` (1030/2010/4000) | `validateCashSettlements` + account index | required accounts | **adopt** (add Treasury preflight) |
| Do NOT auto-copy | V2 Order/Receipt coupling, `SRV2J` naming, sales cohort guards | `CSH-SAL-` Payment-derived IDs (Payment is retired for V2) | expense-policy routing | design new keys: no PaymentID dependence |

## 16. Date / timezone authorities (Investigation 16)

| Authority | Basis | Evidence |
| --- | --- | --- |
| App entry tz | `CANONICAL_ENTRY.TIMEZONE = "Asia/Jakarta"` | SOURCE (`20.Data.Source.js:260`) |
| Date-key derivation | `canonicalDateKey` uses **host-local** Date getters → UTC on Apps Script production | SOURCE (`20.Data.Source.js:80`) |
| Measured basis divergence | same deployed code + same rows yields Oct Revenue 391,000 (UTC host) vs 403,000 (Asia/Jakarta); one boundary row `LEGACY:SAL-APP-20260930-8615DD463535` worth 12,000 flips 2026-09-30/2026-10-01 | PRIOR-MEASURED (Finance UI doc §16.3) |
| Recognition economic date | event `dateKey` (authoritative for Revenue) | SOURCE (`36`) |
| Legacy Payment date | `PaidAt` ISO-8601 UTC instant (e.g. `2026-10-06T18:53:10.509Z`) | PRIOR-MEASURED |
| Settlement date | `Tanggal` = `payment.PaidAt` (instant stored, date-keyed on read) | SOURCE (`95`) |
| Ledger economic date | `Tanggal` as `YYYY-MM-DD` via `capitalEquityDateKey` (string pass-through; Date → host-local key) | SOURCE (`38:95`) |
| Finance reporting basis | period bounds from `resolveDashboardDateRange`; host-tz-sensitive | SOURCE + PRIOR-MEASURED |
| Cutover boundaries | cash cutover `2026-09-30` (`CASH_SETTLEMENT_CUTOVER`, `CASH_FOUNDATION_POLICY.CUTOVER_DATE`); Policy C transition `2026-10-01`; inventory cutover `2026-09-30` | SOURCE |
| Spreadsheet tz | Sheets serial dates read as Date objects; day attribution follows host tz | SOURCE (U10 harness emulates `getValues()` semantics) |

**Risks for Treasury:** receipt-observed date (operator/host), bank-settlement date (external),
accounting economic date (1030 clearing period) and created-at timestamps must be **separate
fields**; the UTC-vs-Jakarta day boundary is a proven production phenomenon. **No date rewrites**
may be performed. Future decision in §25.

## 17. Current UI surfaces (Investigation 17)

| Surface | File | State |
| --- | --- | --- |
| Sales Payment (Receive Via select + Confirm Payment) | `190.View.Index.html:3510-3512`, `195.View.Transactions.Actions.html` | **Reachable but gated**: payment section appears only after a successful order save; for V2-cohort Orders the server refuses before any write (`salesV2OperatorPaymentGuard_`). Legacy-cohort orders keep the historical contract. |
| Expense/Purchase cash account radio (`1000/1010/1020` = "Cash on Hand"/"DANA"/"BluBCA") | `190.View.Index.html:3613-3615`, `194` | Visible, active, drives W1/W2 |
| Receipt "Paid via" select | `190:3634-3641` | Visible, active |
| Settlement surface | — | **Does not exist** (settlement is server-side only) |
| Cash/Bank ledger or reconciliation surface | — | **Does not exist** |
| Finance: P&L, Cash Flow, Balance Position (incl. `financeBSCash`), Capital & Equity, Depreciation, Product Profitability | `199/200/201` | Visible, read-only; "Reconciliation" sections exist only for Capital&Equity and Depreciation |
| Treasury surface | — | none (Treasury not implemented) |

Nothing exposed, nothing modified. Money-related UI is legacy-operational only.

## 18. TREASURY_DATA_QUALITY_BASELINE (Investigation 18)

| Check | Baseline state | Evidence |
| --- | --- | --- |
| Row counts (data rows) | Accounts 22 · TransactionOperations 3 · Orders 2 · OrderLines 3 · SalesRecognitionEvents 1 · SalesRecognitionAudits 1 · BalanceLedger 8 · Payments 1 · Settlements 2 · InventoryLedger 0 · Settings 7 · tabsal 10,808 · tabops 1,976 · Logs 225 · Products 34 · ProductPricing 154 · workbook sheets 38 | PRIOR-MEASURED (v711 non-regression snapshot, 16/16 sha-identical) |
| Missing Order linkage | none among Payments/Settlements (1 Payment ↔ 1 Order ↔ 1 Settlement, all COMMITTED) | PRIOR-MEASURED |
| Legacy coverage gap | 10,808 `tabsal` rows vs **1** Payment — legacy sales are not represented in Payments/Settlements/BalanceLedger except the single promoted chain; linkage `NOT_ESTABLISHED` for legacy history | derived from counts |
| Duplicate IDs | none (guards: `DUPLICATE_ORDER`, `DUPLICATE_PAYMENT_REQUEST`, `DUPLICATE_OPERATION`; duplicate AccountCode refused) | SOURCE + measured "no duplicate AccountCode" |
| Invalid account references | none observed (all measured account metadata exact; `inactiveAccountMappings` empty in Finance gate) | PRIOR-MEASURED |
| Amount mismatch | none (36,000 = OrderTotal; 24,000 = Σ OrderLines) | PRIOR-MEASURED |
| Missing dates | none in V2/legacy payment chain; `PurchaseEvents` lack `PaymentStatus` by design (`paymentStatusPresent=false`) | PRIOR-MEASURED |
| Ambiguous method | legacy `ReceiveVia` = account code only (no channel semantics); V2 has none | SOURCE |
| Orphan journals | none observed (all 8 rows belong to identifiable journals) | derived |
| Unsigned journal | none (V2 signature verified; cash journals signature-checked) | SOURCE + PRIOR-MEASURED |
| Duplicate signature | none observed | derived |
| Known accepted quirks | 4000 `NormalBalance` blank (frozen convention); Products/ProductPricing trailing columns vs strict U2 gate; Finance production loss vector `LOSS_MECHANISM_NOT_FULLY_OBSERVABLE`; unidentified Settlement row 2 | PRIOR-MEASURED |

## 19. AUTHORITY_CLASSIFICATION_TABLE (Investigation: synthesis)

| Structure | Class | Evidence |
| --- | --- | --- |
| `Orders` | **A prospective** (operational order authority; NOT money authority) | V2 Save creates/orders under persisted intent; carries no payment authority for V2 |
| `SalesRecognitionEvents` | **A prospective** (revenue-recognition event authority) | U5 single Revenue authority; one event measured |
| `Payments` | **B historical + D compatibility-display** (legacy cohort only; unsafe as money evidence) | 1 row, intent-only, retired for V2 (§6) |
| `Settlements` | **C accounting evidence + partial-A posting pipeline** (legacy cash only; row 2 unresolved → F for that row) | §7 |
| `BalanceLedger` | **C accounting evidence** (A only as posting surface for W1–W3 families) | §8 |
| `Accounts` | **A prospective** (master metadata authority; fail-closed preflights) | §3, preflights |
| `PurchaseEvent` | **A prospective** (AP/expense recognition authority) | W3, `ALREADY_POSTED` idempotency |
| `tabsal` | **B historical** (+ non-posting analytical authority for HPP after 2026-10-01) | `HPP_AUTHORITY: "tabsal.HPP"`; `TABSALE_HPP_LEDGER_ROLE=NON_POSTING_ANALYTICAL_AUTHORITY` |
| `tabops` | **B historical** (expense evidence for opening/legacy analysis) | monetary-opening diagnostics treat it as evidence source |
| Cash/Bank transaction table | **does not exist** (no separate cash-tx structure; cash truth = Settlements + BalanceLedger + openings) | §5, §8 |
| Treasury | none (not implemented) | full-repo scan |

**F (unresolved):** Settlements row 2 identity; ~2 legacy ledger rows composition; row-level
metadata of the 14 SOURCE-RECONSTRUCTED account rows.

## 20. CURRENT_MONEY_FLOW_MAP (evidence per arrow)

**Legacy Sale chain (pre-V2 cohort):**
1. Operator creates Order → `Orders`/`OrderLines` (`createDurableOperationalOrder_`, persisted intent + COMMITTED) — SOURCE.
2. Operator selects ReceiveVia → `submitOperationalPayment` → guard passes (non-V2 cohort) — SOURCE.
3. `createDurableOperationalPayment_` → resolves method from **Accounts** (1000/1010/1020) → amount must equal OrderTotal — SOURCE.
4. → `runCashSettleAndPersist({settlement: CSH-SAL-<PaymentID>, …})` → `Settlements` row (POSTED) — SOURCE; 1 row measured.
5. → `BalanceLedger` `CASH-SALE_SETTLEMENT-<PaymentID>`: `Dr cash / Cr 4000` (+ `Dr 5000 / Cr 1100`) — SOURCE + PRIOR-MEASURED journal.
6. → `Payments` row (SUCCESS) + Order → PAID, exact readback, operation COMMITTED — SOURCE; 1 row measured.
7. Readers: P&L Revenue comes from the projection, not step 5's Cr4000 (U5 contract) — SOURCE.
→ **NO Treasury anywhere.** Cash truth = steps 4–5.

**V2 Sale chain (ACTIVE cohort):**
1. `submitOperationalOrder` routes to V2 Save (config ACTIVE) — SOURCE.
2. Save persists intent → Order/OrderLines → recognition event + audit → journal `SRV2J-*` `Dr 1030 / Cr 4000` — SOURCE; 1 event/1 audit/2 lines measured.
3. `SalesRecognitionAudits` signature-verified readback → COMMITTED — SOURCE.
4. Payment/Settlement/Fulfillment **refused** for this cohort (`SALES_V2_OPERATOR.PAYMENT_CODE`) — SOURCE; +0 Payment measured.
5. 1030 accumulates Dr 24,000 **uncleared** — PRIOR-MEASURED.
→ **NO arrow reaches Cash/Bank. NO Treasury.** 1030 clearing is an open, unassigned authority.

## 21. Future boundary recommendation (propose only)

- **Treasury event candidate:** `RECEIPT` (observed incoming money) with optional
  `STATEMENT_LINE` and `RECONCILIATION` companions. Rejected as primaries: `Settlement` (legacy
  word with an existing incompatible meaning, §7), `Deposit`/`BankStatementLine` alone (cannot
  express wallet/cash), `Payment` (retired for V2, intent-only).
- **Authoritative object:** a Treasury **verified-receipt event** (operator-observed money
  arrival, exact amount, target cash account, evidence reference, date) — optionally paired with
  an aggregate batch reference and, later, an imported statement line for reconciliation.
  Legacy `Payments`/`Settlements` rows are **not** authoritative inputs.
- **Candidate 1030-clearing authority:** Treasury receipt posting `Dr 1000/1010/1020 · Cr 1030`
  in `BalanceLedger`, source-keyed (`TREASURY_RECEIPT`), signature-idempotent, lock-guarded,
  append-only, audited — the only V1 money-out-of-1030 writer besides Void/Correct reversals.
- **Explicit NON-authority list:** PaymentMethod/ReceiveVia label; Sales `Order` header or
  PaymentStatus; any UI selection; unverified legacy `Payment` row; legacy `Settlement` row without
  ledger proof; bank/wallet provider name; `tabops`/`tabsal` rows; `Logs` entries; Cash-flow
  classification metadata; an un-reconciled observed balance.

## 22. EXCEPTION-MODEL INPUT MATRIX (design input only)

| Exception input | Production evidence exists? | Basis |
| --- | --- | --- |
| exact receipt | **yes** | 1 exact Payment→Settlement 36,000; V2 24,000 exact |
| aggregate/batch | **no** | §11 NOT_ESTABLISHED |
| partial | **no** | §12 (source-capped) |
| over | **no** | §12 (refused `SALE_OVER_SETTLEMENT`) |
| under | **no** | §12 (refused `PAYMENT_AMOUNT_MISMATCH`) |
| duplicate | **no** (guards only) | source refusals; 0 production instances |
| unmatched | **partial** | reader `ambiguous`/`UNCLASSIFIED_COUNTERPART` metadata exists; no unmatched-money row |
| fee | **no** | §10 NOT_ESTABLISHED |
| refund | **no** | §13 no writer, no rows |
| credit | **no** | §13 |
| reversal | **no** (capability only) | `SETTLEMENT_REVERSAL` code + tests; 0 production rows |
| correction | **no in production** (source+tests yes) | V2 Correct machinery measured in tests, 0 production Corrects |
| wrong account | **no** | no observed instance |
| wrong date | **yes** | UTC-vs-Jakarta boundary row 12,000 (§16) |
| late settlement | **no** | no instance |
| period boundary | **yes** | cutover 2026-09-30 / 2026-10-01 boundaries + boundary row |

## 23. 1030 invariant (propose)

> Every 1030 residual at any reporting date must be attributable to exactly one of:
> (a) recognized Sale exposure awaiting settlement (V2 `Dr1030/Cr4000` not yet cleared),
> (b) pending/absent settlement of a legacy recognized exposure,
> (c) refund/credit transfer in flight (`Dr1030/Cr2010`),
> (d) correction/reversal rows, or
> (e) an explicit Treasury exception record.
> **No silent residual.** Residual not matching (a)–(e) = a reconciliation failure, surfaced, never auto-repaired.
> Measured conformance today: 1030 = Dr 24,000 → class (a) only; silent residual 0.

## 24. TREASURY_V1_SCOPE recommendation

**MUST HAVE (V1):**
- Treasury receipt event with RequestKey/OperationID intent, lock, exact readback, append-only rows, journal signature, audit event.
- Posting `Dr 1000/1010/1020 · Cr 1030` into `BalanceLedger` only, source-keyed `TREASURY_RECEIPT`, idempotent, fail-closed account preflight (reuse the 1030/4000 preflight pattern).
- Per-Order exact clearing of V2 recognized exposure (evidence-capped: never exceed the order's recognized amount, mirroring `SALE_OVER_SETTLEMENT` semantics).
- 1030 residual report classified per §23 (attributable / exception).
- Finance integration without edits: cash change, cash flow, and balance readers observe the ledger automatically; Revenue untouched (§9).

**DEFER:**
- Disbursements (`RECEIPTS_AND_DISBURSEMENTS`), AP/purchase Treasury leg (existing W1/W3 paths suffice).
- Aggregate/batch/multi-day settlement, partial/over/under handling (no production pattern, §11–12).
- Statement import, bank/wallet reconciliation against external feeds, observed-balance RECONCILED status.
- Fee/MDR accounting (no evidence, §10).

**OUT OF SCOPE:**
- 2010 refund/credit flows (frozen authority, §13).
- Any change to Sales authority (no payment-method authority back to Sales), Policy C/HPP/Inventory/COGS, legacy `Payments`/`Settlements` rows, historical dates, existing journals (no clearing, no backfill, no migration).

## 25. Unresolved owner decisions

1. **Fresh production read capability** — `clasp run` remains BLOCKED_PERMISSION; row-level
   re-measurement (Settlement row 2, ledger row composition, full 22-row account metadata) needs
   an owner-granted execution path or an accepted read-surface extension.
2. **1020 "Cash in Owner Custody – BluBCA"** — report as Cash or Bank? affects cash-flow wording only.
3. **Aggregate/partial receipt policy** — V1 caps at exact per-order receipts; owner must decide if
   real operations ever produce batch/partial receipts (no production evidence today).
4. **Fee policy** — if QRIS/gateway fees exist off-system, an expense account and net-vs-gross rule
   must be created by explicit decision (none exists, §10).
5. **Date authority for Treasury** — receipt-observed vs settlement vs accounting-economic date,
   and Asia/Jakarta vs host-UTC day attribution (proven 12,000 boundary effect, §16).
6. **Scope sign-off** — `RECEIPTS_ONLY` vs `RECEIPTS_AND_DISBURSEMENTS` (§14 recommendation).
7. **Legacy history gap** — whether legacy tabops/tabsal sales ever need Money-side reconstruction
   (today: not represented in Payments/Settlements/BalanceLedger).

---

## TEST / SOURCE AUDIT

- **Baseline run (post-verification, before any doc change):** `node _test_runner.js` →
  **101 PASS / 0 FAIL (MEASURED)** — includes Finance, U1–U10 Sales V2, Policy C, Transaction,
  PurchaseEvent, Cash/Bank (`testCashFoundationContracts`), Depreciation, CapitalEquity, Dashboard suites.
- **Local diagnostic:** `node tests/tmp/t1-source-authority-scan.js` → **12 checks, 0 FAIL (MEASURED)**
  (T1-A…T1-L; proves: no 2010 writer, exclusive BalanceLedger writer set {39,40,41,47,97A,97C},
  frozen 1030/4000 V2 journals, payment/cash retirement guards present, Revenue authority =
  projection, cash = ledger {1000,1010,1020}, zero fee/QRIS/MDR code, zero refund writers).
- **Syntax:** `node --check tests/tmp/t1-source-authority-scan.js` → OK.
- **Final regression (after the last doc change):** run recorded in the completion report (MEASURED).
- **Fresh production diagnostic execution:** BLOCKED_PERMISSION (§2) — reported as unverified,
  never guessed.
