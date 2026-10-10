# T11.1 — Single-Commit Transaction Architecture: Production Discovery and Authority Baseline

STATUS: READ-ONLY DISCOVERY COMPLETE · NO SOURCE MUTATION · NO PRODUCTION MUTATION
TASK_ID: T11_1_PRODUCTION_DISCOVERY_AND_AUTHORITY_BASELINE
PHASE: NUMLOCK_SINGLE_COMMIT_TRANSACTION_ARCHITECTURE
BASELINE_COMMIT: c67f8a9d618b03093013971d56ad5778b8b1e01f (Treasury T10.5 production activation evidence)
CLASSIFICATION: L3 · R1 · CONTINUE

FROZEN OWNER REQUIREMENT (governs this analysis): NORMAL transactions = ONE
business input → ONE Save Transaction → DONE. No post-Save verify, receive
payment, settlement confirm, Treasury open, Paid/Unpaid, reconcile, EvidenceRef,
re-select, RecognitionID/ReceiptID/OperationID, or any second financial action —
for Sales, Expense, and Purchase. SIMPLE INPUT IN FRONT; STRICT ACCOUNTING IN
BACKEND. Payment timing (order vs after consumption) is not modeled as AR or a
settlement lifecycle. NUMLOCK does not know/store/select/report payment channels
for normal transactions; no fake `PaymentMethod=CASH`; no channel-level balances
for new normal transactions. Historical accounts/data are never rewritten.

---

## 1. Executive Finding

Single-commit is FEASIBLE for all three domains without breaking any durable
authority, and without a second operator action:

- **Sales (ACTIVE today)**: the Sales Recognition V2 Save (`97A`) already
  produces ONE atomic `spreadsheets.batchUpdate` (5 appendCells: Orders,
  OrderLines, SalesRecognitionEvents, BalanceLedger Dr1030/Cr4000,
  SalesRecognitionAudits) under one outer ScriptLock with one RequestKey,
  frozen immutable plan, exact readback, and COMMITTED/UNKNOWN recovery. The
  ONLY missing piece for single-commit is the **money leg**. It can be
  composed INSIDE the same frozen plan and the same atomic batch (a second
  BalanceLedger journal: Dr operational-money / Cr1030), which nets the 1030
  exposure to ZERO at DONE while leaving the recognition journal
  (Dr1030/Cr4000) byte-identical and U3/Treasury semantics intact.
- **Treasury T4 cannot be safely delegated** into the Sales Save as-is: it is
  a separate authority with its own RequestKey namespace, mandatory
  MANUAL_VERIFIED + `evidenceRef`, full-clearing exposure targeting, and its
  own lock/plan. Composition must extend the U2 plan (one authority owns the
  batch); Treasury remains the exception/manual-receipt authority.
- **Expense**: ordinary expense already writes business row + cash settlement
  under one outer lock, but in MULTISTEP writes with an `accountingPending`
  fallback (`SETTLEMENT_PENDING` log) — a real "second action" risk. It needs
  a durable plan+single-batch core modeled on U2/Treasury.
- **Purchase**: ordinary purchase = PurchaseEvent save + separate
  `postPolicyCPurchaseEvent_` ledger append (two writes). Policy C already
  produces the correct single-commit journal shape (Dr6210 / Cr cash-or-2000);
  it must be folded into ONE plan+batch, with the credit side becoming the
  aggregate operational-money account for normal flow. UNPAID/AP stays only
  for genuinely applicable supplier credit (owner-confirmed exception).
- **Operational-money authority**: recommend ONE NEW aggregate account
  (proposed `1040` "Operational Funds"; owner approves code/name in T11.2) as
  the sole destination/source for all NEW normal money movement. `1000/1010/1020`
  become frozen historical channel accounts; `1030` remains technical clearing
  (net-zero at Save for composed transactions).
- **Transitional Rp24,000 exposure** (`SCR-CE122B27-ORD677BE5CES`, UNCLEARED):
  closeable later by ONE owner-authorized transitional operation that mirrors
  the prospective money leg (Dr funds / Cr1030 bound to the recognition),
  justified by the owner's business fact recorded as internal attestation —
  never a manufactured external evidenceRef, and never the future normal
  workflow. No action in T11.1.
- Full local regression: **MEASURED 181 PASS / 0 FAIL** on this baseline with
  zero source mutation.

## 2. Exact Current Baseline (measured at discovery time)

| Fact | Value | Evidence class |
| --- | --- | --- |
| Local HEAD | `c67f8a9d618b03093013971d56ad5778b8b1e01f` | MEASURED (`git rev-parse HEAD`) |
| Worktree tracked changes | 0 modified/staged tracked files | MEASURED (`git status --short`) |
| Untracked files | 42, all under `tests/tmp/` (pre-existing T9/T10/T10.5/u10e artifacts; u10e-* untouched) | MEASURED (`git ls-files --others`) |
| `git diff --check` | clean | MEASURED |
| Sales | V2 ACTIVE (owner-confirmed production state; `SALES_RECOGNITION_V2_CONFIG` property; U10 activation evidence) | KNOWN_PRIOR_EVIDENCE |
| Treasury | V1 ACTIVE, ActivationID `TRACT-419e76da-f5aa-4cff-8ead-7a15019099eb`, activatedAt 2026-10-10T17:49:43.513Z, configVersion 1; Treasury business rows 0/0/0 | KNOWN_PRIOR_EVIDENCE |
| 1030 exposure | `SCR-CE122B27-ORD677BE5CES` 24,000 UNCLEARED; LedgerNet1030 Dr 24,000; residual 0 | KNOWN_PRIOR_EVIDENCE |
| Genuine receipt ever posted | none | KNOWN_PRIOR_EVIDENCE |
| Full regression | 181 PASS / 0 FAIL (`node _test_runner.js`) | MEASURED this session |
| Production writes / deploys / pushes / config writes / financial events this task | 0 / 0 / 0 / 0 / 0 | MEASURED (read-only session) |

No divergence from the task-supplied baseline was found; discovery continued.

## 3. Sales Call Graph (current, production: ACTIVE)

Operator UI (`194.View.Transactions.Forms.html`, `195.View.Transactions.Actions.html`):

1. Entry dialog → product combobox + Hot/Cold type + qty → `addSelectedSalesOrderLine()`
   resolves `productVariantID` client-side from `operationalTransactionState.authority.productVariants`
   (`195` line 208-211). Lines staged in `operationalTransactionState.lines`.
2. `saveOperationalOrder()` (`195` line 229-237): payload =
   `{ orderType, lines:[{productID, productVariantID, qty}] }` + client
   RequestKey → `google.script.run.submitOperationalOrder`.
3. Server `submitOperationalOrder` (`95A.Transaction.Production.js:366-371`):
   route = `salesV2OperatorResolvedRoute_()`; ACTIVE → `salesV2OperatorModeCreateOrder_`.
4. `salesV2OperatorModeCreateOrder_` (`97D:233-242`) → `salesRecognitionV2DurableSave(payload)`
   (`97A:1398`; outer `lock.waitLock(30000)`, `OUTER_LOCK_UNAVAILABLE` fail-closed).
5. U2 core (`97A`): normalize → exact (OperationType, RequestKey) lookup →
   schema/cohort/authority/variant gates → freeze immutable plan (order rows,
   line snapshots, analytical HPP authority, journal rows Dr1030/Cr4000, event
   row, audit row, planDigest) → persist `TransactionOperations` IN_PROGRESS +
   exact ten-field readback → ONE atomic `spreadsheets.batchUpdate` (5
   appendCells over exactly Orders, OrderLines, SalesRecognitionEvents,
   BalanceLedger, SalesRecognitionAudits) → exact artifact verification →
   COMMITTED readback → DONE. Statuses DONE/REFUSED/CONFLICT/UNKNOWN/RECOVERY_REQUIRED.
6. Response mapped by `salesV2OperatorSaveResponse_` (`97D:163-189`); UNKNOWN
   keeps requestKey for recheck of the SAME intent.

Mutations: `97C` U6 VOID (negative REVERSAL event + Dr4000/Cr1030 + audit) and
CORRECT (full reversal + complete replacement recognition, NEW OrderID, one
batch). Guards: `97D` refuses legacy `submitCanonicalTransaction` SALES when
ACTIVE (`SALES_V2_LEGACY_SALES_RETIRED`), retires Payment/ReceiveVia/
settlement/fulfillment/cash-posting for the V2 cohort, routes recovery ONLY
through V2 cores.

Money info requested from operator: NONE (no cashAccountCode on the V2 save
path). Second operator action today: NONE for normal sales — Save IS the
financial DONE (recognition Dr1030/Cr4000 committed in the same batch). The
1030 exposure for each sale is only cleared by a later (currently manual)
Treasury receipt — that is the single-commit gap for Sales.

Legacy PREPARED path (`createDurableOperationalOrder_`, payments, lifecycle)
remains in source but is unreachable for new sales while ACTIVE.

## 4. Expense Call Graph (current)

1. UI: expense combobox + amount + expenseDate + cash-account radio
   (`salesCashAccount1000/1010/1020` / `expenseCashAccount*`, `194` line 54-65)
   → `submitTransactionEntry` (`195:368-427`) payload =
   `{ transactionType:"EXPENSE", expenseItemId, amount, expenseDate, cashAccountCode }`
   → `submitCanonicalTransaction`.
2. Server `submitCanonicalTransactionWithRuntime_` (`21.Transaction.Entry.js:258`):
   validates cashAccountCode ∈ {1000,1010,1020} + Accounts active; ordinary
   expense route: `resolveExpensePurchasePolicy_` (`46`) → non-purchase route.
3. Writes business row to `tabops` via `persistCanonicalEntry` (append +
   readback + Logs audit row, manual rollback on mismatch) — write #1.
4. Then, when `dateKey > CASH_SETTLEMENT_CUTOVER` (2026-09-30):
   `attemptCashSettlement` (`21:191`) builds `EXPENSE_SETTLEMENT` with
   deterministic `SettlementID = CSH-EXP-<id>` → `runCashSettleAndPersist`
   (`40.Cash.Foundation.js:1126` → `cashSettleAndPersist:496`): own
   `runtime.lock.acquire()`, candidate `PAID_EXPENSE` journal
   Dr expenseAccount / Cr cashAccount (`40:317-333`), write #2 (Settlements
   row) + write #3 (BalanceLedger rows), post-write signature verification.
5. If settlement fails: response `success:true, accountingPending:true` +
   `logSettlementPending` (SETTLEMENT_PENDING) — the business transaction is
   committed but money is NOT; nothing in the normal operator flow re-drives
   this. This is exactly the "second action" hazard the owner requirement bans.

Correction/void: `22.Transaction.Lifecycle.js` (`voidCanonicalTransaction`,
`correctCanonicalTransaction`) — mutable-record guard, signed lifecycle rows,
append-only replacements in tabops/tabsal + Logs audits.

## 5. Purchase Call Graph (current)

1. UI receipt entry (`195:1031-1065`): expense item selected with
   `purchaseRequired` (Policy C route), supplier selection, qty, purchase UOM,
   paidVia (payment-method master → maps to AccountCode), acquisition value,
   expenseDate → `state.receiptPayload =
   { transactionType:"EXPENSE", expenseItemId, requestKey, input, cashAccountCode, paymentStatus:"PAID" }`
   → `submitCanonicalTransaction`.
2. Server: `21` EXPENSE branch detects `expensePolicyIsPurchase_(route)`
   (VARIABLE_COST with purchase relationship ≠ NON_HPP) →
   `orchestratePurchaseEventUnderLock_` (`47.Purchase.Events.js`) under the
   SAME outer lock.
3. Normalizer (`47:111-158`): PAID requires cashAccountCode; UNPAID requires
   supplierId; conflicting authority refused; unknown fields refused. Persists
   PurchaseEvent row (`AccountingStatus: PENDING`) + audit — write #1.
4. THEN `runtime.postPurchaseAccounting(eventId)` (`21:334-339`) →
   `postPolicyCPurchaseEvent_` (`39.Balance.Foundation.js:309`) →
   `buildPolicyCPurchaseJournal` (`39:152-174`):
   - prospective regime (ExpenseDate ≥ Policy C transition): **Dr6210 / Cr
     (cashAccountCode if PAID, else 2000)**, MovementType
     `PURCHASE_RECOGNITION`, SourceType `PURCHASE_EVENT` — write #2 (append +
   - signature readback), `AccountingStatus` update + readback — write #3.
5. Not a single atomic batch: event, ledger, and status are three sequential
   writes; failure leaves `accountingPending`.

Correction: `correctPurchaseEventUnderLock_` (96-tests confirm: original →
CORRECTED/IsActive=false + replacement CAPTURED_OPERATIONAL, deterministic
`corr-` keys, receipt linkage). Void: `voidPurchaseEvent` /
`persistPurchaseEventVoid_` (`47:789-873`). Legacy AP settlement
(`buildPolicyCApSettlementJournal`, `39:228`) and purchase adjustments
(`39:256`) exist for UNPAID history. Inventory implications: Policy C
prospective regime expenses materials (no Dr1100); no Inventory authority is
introduced or reactivated by T11.

## 6. Money-Writer Matrix (all writers touching 1000/1010/1020/1030/2000/2010/6210/4000 + active cash/bank/payable/expense accounts; name-matched from source, not inference)

| # | Writer (file:function) | Trigger | Journal pattern | Classification | UI-reachable today | Still authoritative |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | `97A:salesRecognitionV2SaveValueRanges_` / batch (Save) | Sales save (ACTIVE) | Dr1030 / Cr4000 (`SALES_RECOGNITION`) | CURRENT | Yes (Save Transaction → V2) | YES — sole new-sales money-recognition writer |
| W2 | `97C` U6 Void/Correct | Sales void/correct | Void: Dr4000/Cr1030; Correct: reversal + replacement Dr1030/Cr4000 | CURRENT | Yes (operator correct/void) | YES |
| W3 | `40:cashSettleAndPersist` → `buildCashPostingCandidate` (PAID_SALE) | Legacy settlement path (pre-cutover flows / PREPARED) | Dr cash(1000/1010/1020) / Cr4000 (+ optional legacy Dr5000/Cr1100 HPP lines for canonical orders) | LEGACY (V2 cohort hard-blocked `SALES_V2_NO_CASH_POST`, `40:241-247`) | No new V2 sale can reach it; legacy settlements only | Legacy history only — DEPRECATE_PROSPECTIVELY |
| W4 | `40` PAID_EXPENSE branch via `21:attemptCashSettlement` | Ordinary expense save | Dr expenseAccount(6210/61xx…) / Cr cash(1000/1010/1020) | CURRENT | Yes — normal expense flow | YES today; target of single-commit redesign |
| W5 | `40` AP_SETTLEMENT branch + `39:buildPolicyCApSettlementJournal` | Manual AP settlement of UNPAID purchase events | Dr2000 / Cr cash | CURRENT (exception path) | Yes (settlement ops) | YES for genuine legacy AP only |
| W6 | `39:postPolicyCPurchaseEvent_` → `buildPolicyCPurchaseJournal` | Purchase event save | Prospective: Dr6210 / Cr(cash or 2000); legacy regime: Dr1100 / Cr(cash or 2000) | CURRENT | Yes (purchase save) | YES — target of single-commit redesign |
| W7 | `39:buildPolicyCPurchaseAdjustmentJournal` | Purchase correction/refund ops | Dr(cash or 2000) / Cr6210 | CURRENT (exception) | Yes (purchase adjustments) | YES for genuine corrections |
| W8 | `39:buildPolicyCSalesHppJournal` | Sales HPP posting | Legacy pre-transition: Dr5000/Cr1100; prospective: NON_POSTING (analytical only) | CURRENT (frozen Policy C) | No (blocked in prospective regime) | YES as frozen analytical-HPP policy |
| W9 | `99A:treasuryReceiptSave` (T4) | Treasury operator receipt save | Dr destination(1000/1010/1020) / Cr1030 (`TREASURY_RECEIPT`) | CURRENT (ACTIVE, 0 rows) | Yes (T7 UI) | YES but operator model KNOWN INCOMPATIBLE with owner normal flow — exception/diagnostic only prospectively |
| W10 | `99C` T6 reversal/correction | Treasury reverse/correct | Reversal: Dr1030/Cr destination; replacement: Dr destination/Cr1030 | CURRENT | Yes (T7) | YES for genuine receipt corrections |
| W11 | `40:buildCashReversalCandidate` | Cash settlement reversal | Signed reverse of original cash journal (`SETTLEMENT_REVERSAL`) | CURRENT (legacy settlements) | Yes | YES for legacy settlement reversals |
| W12 | `40` CASH_TRANSFER branch | Cash transfer settlement | Dr counter / Cr account (1000↔1010↔1020) | CURRENT (channel transfer ops) | Yes | Prospectively KEEP only while legacy channel accounts remain meaningful (owner may retire with channel model) |
| W13 | `22` lifecycle void/correct | Legacy tabsal/tabops correction | No BalanceLedger journal of its own (business-row lifecycle + settlement interplay) | LEGACY | Yes for pre-V2/legacy rows | Legacy history only |
| W14 | `39:buildPolicyCMonetaryOpeningJournal` | Monetary opening (one-time) | Opening composition into ledger | MIGRATION-class | No (ops) | One-time historical |
| W15 | `12A` depreciation, `38` capital equity | Period close / equity migration | Depreciation & equity journals | OUTSIDE transaction domains | No | YES (unchanged by T11) |
| W16 | `45/42/43` inventory receipt orchestration | INVENTORY_RECEIPT submissions | Dr1100 / Cr(cash or 2000) per regime | CURRENT (separate domain) | Yes | YES — explicitly out of T11 normal-flow scope |

No other production writers of the listed accounts were found in the known
dependency closure. `2010` (Customer Refund and Credit Payable) has NO writer
today — frozen reference account only (no automatic refund/credit, per Policy C).

## 7. Treasury: Retain / Adapt / Bypass / Deprecate Matrix

| Treasury element | Verdict | Rationale |
| --- | --- | --- |
| Durable core architecture (normalize → exact RequestKey lookup → frozen plan → IN_PROGRESS intent + readback → ONE atomic batchUpdate → artifact verification → COMMITTED → DONE) | **RETAIN** (as the pattern all three domains adopt) | Exactly the single-commit machinery; proven by T4/T6/U2 |
| Outer ScriptLock + fail-closed statuses (DONE/REFUSED/CONFLICT/UNKNOWN/RECOVERY_REQUIRED) | **RETAIN** | Required atomicity/recovery model (workstream K) |
| RequestKey/idempotency/resume-from-plan | **RETAIN** | Prevents double money events + replay duplicates |
| Journal signature + audit rows + operation digests | **RETAIN** | Integrity evidence |
| T6 reversal/correction infra | **RETAIN** | Genuine corrections remain a real operator need |
| T5 clearing projection (`99B:buildTreasuryClearingProjection_`) | **ADAPT** (T11.2) | Must count the composed money leg as clearing so exposure = 0 at Save; residual/exception gate stays |
| T10.5 activation/config governance | **RETAIN** | Activation evidence discipline carries to T11.2 |
| MANUAL_VERIFIED `evidenceType` + mandatory `evidenceRef` (`99:23`, `99A:148-158`) | **NORMAL_FLOW_BYPASS** + **DEPRECATE_PROSPECTIVELY** for normal flow; **KEEP_FOR_EXCEPTION_DIAGNOSTIC** | Owner requirement: no external EvidenceRef for ordinary transactions; incompatible by design with one-tap Save |
| Destination account selection (`destinationAccountCode`, T7 picker) | **NORMAL_FLOW_BYPASS**; **DEPRECATE_PROSPECTIVELY** | Owner requirement: no channel selection; backend derives the aggregate account |
| Operator receipt model (open Treasury → pick exposure → enter receipt) | **NORMAL_FLOW_BYPASS**; **KEEP_FOR_EXCEPTION_DIAGNOSTIC** | Superseded by composed money leg; retained only for transitional/exception closure |
| T4 exposure targeting (exact outstanding, exact full clearing) | **ADAPT** | Normal flow clears inside Save; T4 keeps exact-clearing for exceptions |
| T4-as-delegate-inside-U2 | **DEPRECATE (rejected at design level)** | Separate RequestKey namespace, evidenceRef requirement, own lock — cannot nest safely; composition extends the U2 plan instead |

## 8. Operational-Money Account Options + Recommendation

Context: owner needs ONE operational-money authority; no channel-level
tracking; historical 1000 (Cash on Hand) / 1010 (DANA Business) / 1020 (Cash
in Owner Custody – BluBCA) never rewritten; 1030 stays technical clearing.

| Option | Semantics | Historical compat | Reporting impact | Migration | Misleading-balance risk |
| --- | --- | --- | --- | --- | --- |
| **Opt1 — reuse 1000 broadened** ("Cash on Hand" = aggregate operational funds) | Postings to a channel-named account; statement says physical cash while money may sit in DANA/BluBCA | History untouched; but new non-cash-channel money lands in a "Cash" account | No reader changes | None | HIGH — account name lies about substance |
| **Opt2 — new aggregate account (proposed `1040` "Operational Funds")** | Sole live operational-money account; Asset/Current Assets/Operating/DEBIT; 1000/1010/1020 frozen as historical channel accounts | Full; no rewrite | Mechanical enumerated-list extensions: `CASH_FOUNDATION_POLICY.ACCOUNT_CODES` consumers, `buildCashFlowStatement` cashAccountCodes (`36:73`, `36:155`), `buildCashBalanceReadModel` (`40:606`), Treasury `DESTINATION_ACCOUNT_CODES` (`99:31`), cash-opening readers | One Accounts row at T11.2 activation; opening 0 + total-funds presentation | LOW — name matches substance |
| **Opt3 — superior model from source** | No third model exists in source; the account universe is exactly this cash/clearing/AP/expense set | — | — | — | — |

**RECOMMENDATION: Opt2.** Semantic correctness and truthfulness beat least
code: Opt1 would make every new sale/expense/purchase money movement post
into an account whose name asserts a channel ("Cash on Hand"), directly
conflicting with the owner's channel-agnostic rule and creating
misleading-balance risk on Balance Position and statements. Opt2 keeps all
history intact, gives the backend exactly one account to derive (no operator
choice, no fake default), and every compatibility change is an enumerated,
mechanical list extension already exercised by prior migrations (1010/1020
were added the same way, `40:743-749`). 1030 nets to zero for composed
transactions; the aggregate account is the only live money balance; legacy
channel balances remain visible as frozen history, and "total operational
funds" = aggregate + legacy accounts is a derived report line, not a new
authority. Exact code/name are owner-approved in T11.2.

## 9. Minimum Operator-Input Matrix

| Input | Sales (V2) | Expense | Purchase | Classification |
| --- | --- | --- | --- | --- |
| Product selection (→ productID) | Required | — | — | REQUIRED_BUSINESS_FACT |
| Variant type Hot/Cold (→ productVariantID server-checked) | Required | — | — | REQUIRED_BUSINESS_FACT (variant attribute) |
| Qty | Required | — | Required (with UOM) | REQUIRED_BUSINESS_FACT |
| Purchase UOM | — | — | Required | REQUIRED_BUSINESS_FACT |
| Expense item (ID_Ops) | — | Required | Required | REQUIRED_BUSINESS_FACT |
| Amount / acquisition value | — | Required | Required | REQUIRED_BUSINESS_FACT |
| Expense/purchase date | — | Required | Required | REQUIRED_BUSINESS_FACT |
| Cash account radio (1000/1010/1020) | Not sent on V2 path ✓ | Required today — REMOVE | paidVia→AccountCode today — REMOVE | REMOVE_FROM_NORMAL_FLOW (channel selection; backend derives aggregate) |
| paidVia payment method | — | — | Required today — REMOVE | REMOVE_FROM_NORMAL_FLOW |
| paymentStatus PAID/UNPAID choice | — | — | Required today — normal flow IMPLIES paid-at-save; UNPAID only genuine supplier credit | LEGACY_ONLY for normal flow; OPTIONAL_EXCEPTION (owner-confirmed) for real AP |
| SupplierID | — | — | Required only when UNPAID | OPTIONAL_DESCRIPTION_METADATA for normal flow (owner decision: keep as recorded business fact?) |
| orderType (dine-in/etc.) | Sent as metadata | — | — | OPTIONAL_DESCRIPTION_METADATA (keep) |
| requestKey | Client-generated (idempotency) | Same | Same | DERIVABLE_BACKEND (technical identity; client may supply) |
| RecognitionID / ReceiptID / OperationID / journal IDs | Never asked ✓ | Never asked ✓ | Never asked ✓ | DERIVABLE_BACKEND |
| EvidenceRef / evidenceType | Never asked on V2 ✓ | — | — | REMOVE_FROM_NORMAL_FLOW (forbidden for ordinary transactions) |
| Account mapping, journals, HPP snapshot, signatures, audits, settlement, clearing | Backend | Backend | Backend | DERIVABLE_BACKEND |
| Correction reason | On correct/void only | On correct/void only | On correct/void only | REQUIRED_BUSINESS_FACT (genuine lifecycle actions) |

Goal achieved: minimum truthful input = business facts only; every money/
accounting/channel field either absent (Sales V2 already) or removable
(Expense cash radio, Purchase paidVia/paymentStatus/channel).

## 10. Prospective Single-Commit Boundary Analysis (per domain)

- **Sales**: boundary = the existing U2 Save operation. Composition = extend
  the frozen plan with money-leg journal rows (Dr aggregate / Cr1030,
  MovementType e.g. `SALES_MONEY`, SourceType bound to the same
  RecognitionID/OperationID) carried in the SAME BalanceLedger appendCells
  subrequest (surface already in WRITE_SURFACES). Recognition journal
  Dr1030/Cr4000 stays byte-identical → U3 totals, U6 reversal arithmetic,
  plan verification, and journal signature contracts are preserved. 1030
  residual = 0 at COMMITTED. No T4 delegation, no second lock, no second plan.
- **Expense**: boundary = NEW durable save core (plan + ONE batchUpdate over
  [expense business surface, BalanceLedger Dr expenseAccount/Cr aggregate,
  audit/Logs]) replacing persist-then-settle multistep. `SETTLEMENT_PENDING`
  and `accountingPending` disappear from the normal flow.
- **Purchase**: boundary = PurchaseEvent save core extended so the Policy C
  journal (Dr6210 / Cr aggregate) and AccountingStatus land in the SAME plan
  and batch as the event row. UNPAID/AP journaling remains only when a genuine
  supplier-credit fact is supplied (exception, not normal UI).
- Cross-domain: one orchestration seam (the existing
  `submitCanonicalTransactionWithRuntime_` dispatcher / `submitOperationalOrder`)
  remains the single operator entry; each route acquires ONE outer lock and
  executes ONE plan.

## 11. Atomicity / Idempotency / Recovery Analysis

| Domain | Transaction boundary | Lock | Plan | RequestKey | Atomic write | Replay | UNKNOWN recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sales | U2 Save op (+ composed money leg) | Outer ScriptLock (`97A:1409`) | Frozen immutable + planDigest | Exact (OperationType, RequestKey) lookup BEFORE any write | ONE batchUpdate (appendCells all surfaces) | Same key + same normalized payload → resume from IN_PROGRESS plan; payload hash conflict → CONFLICT | Client keeps requestKey; server resumes stored plan; operation row is outcome authority (`97D:342-367`) |
| Expense | NEW durable save op | Outer ScriptLock (reuse dispatcher scope) | NEW frozen plan (rows + journals + digest) | NEW namespace (e.g. EXPENSE_SAVE) exact lookup | ONE batchUpdate | Resume-from-plan | Same pattern: UNKNOWN keeps identity; never definite-failure |
| Purchase | PurchaseEvent save op (event + Policy C journal + status in one plan) | Existing outer lock | Extended purchase plan | Existing `requestKey`/`corr-` namespaces | ONE batchUpdate (event + ledger + status surfaces) | Existing recovery (`testPurchaseRecoveryContracts`) strengthened to batch | Same pattern |

Prevention analysis:
- committed business + missing money event: eliminated (same batch; appendCells
  is all-or-none).
- money event twice: eliminated (single SourceType/SourceID + journal
  signature dedupe already enforced by `cashExistingSourceRows`/
  `policyCExistingJournalState_` and plan-based artifact verification).
- replay duplicate journals: eliminated (exact operation lookup + stored plan;
  no recomputation from mutable masters on resume).
- UI timeout → new intent: eliminated (stable client requestKey +
  `persistOperationalRecovery_`; server treats same key as same intent).
- Finance seeing half a transaction: eliminated (one batch; readers already
  tolerate missing optional sheets/cohorts).
- What reuses Sales V2/Treasury: plan freeze, intent readback, single batch,
  artifact inspect, COMMITTED readback, UNKNOWN/RECOVERY_REQUIRED envelopes,
  journal signatures. What is NEW: the composed money-leg rows inside the U2
  plan; durable save cores for Expense/Purchase (same architecture, new
  namespaces); T5 adaptation to recognize composed clearing.

## 12. Correction / Void / Reversal Analysis (prospective)

- **Sales Correct/Void**: UNCHANGED contracts (`97C`) — append-only signed
  events, originals immutable, full-reversal + replacement (never delta),
  EconomicDate = action period. The composed money leg reverses with the same
  mutation batches (void: Cr1030 reversal leg becomes Dr1030; money reversal
  Dr1030/Cr aggregate), keeping 1030 net-zero through the lifecycle.
- **Expense**: single-commit void/correction = signed reversal journals (mirror
  of Dr expense/Cr aggregate) inside one mutation batch + append-only business
  lifecycle rows; replaces today's row-flip lifecycle without changing the
  audit principle.
- **Purchase**: RETAIN `correctPurchaseEventUnderLock_` / `voidPurchaseEvent`
  semantics; replacement carries the composed journal in the same batch.
- **Treasury T6**: RETAINED for genuine receipt corrections/exception flows.
- **Routine actions that DISAPPEAR** (not corrections): receive-payment,
  settlement confirm, Treasury open, Paid/Unpaid toggles, EvidenceRef entry,
  destination selection for normal transactions.
- **No automatic Dr1030/Cr2010 refund or customer credit** — Policy C frozen;
  2010 remains writer-less.

## 13. Reporting-Reader Impact Matrix

| Reader | Source today | Impact of single-commit | Required adaptation |
| --- | --- | --- | --- |
| Transaction list / U4 detail (`97B` U4 readers) | Orders + events + cohorts | None (money status not operator-facing for V2) | None |
| Revenue / U3 (`97B` projection) | Signed recognition events (Cr4000 authority) | None — recognition journal unchanged | None |
| P&L (`36:buildFinanceProfitAndLoss`) | Projection revenue + ledger 6210 material purchases + opex + depreciation | None — expense/purchase amounts identical | None |
| Expense analytics (`55`) | tabops rows | None | None |
| Cash/Bank-or-equivalent balance (`40:buildCashBalanceReadModel`) | Accounts 1000/1010/1020 + openings + ledger post-cutover | Aggregate account invisible → balance wrong | ADAPT: include aggregate; present legacy frozen + aggregate + total |
| Balance Position | Finance foundation + openings | Same as above | ADAPT (same list) |
| Cash Flow (`36:buildCashFlowStatement`) | Journals touching 1000/1010/1020; group from counterpart `CashFlowGroup` | Money-leg journal Dr aggregate/Cr1030: cash line found, counterpart 1030 has NO CashFlowGroup in the V2 account expectations (`97:331-332`) → UNCLASSIFIED_COUNTERPART | ADAPT: classify composed money journals (MovementType-based or 1030 group mapping) so composed flows land in Operating |
| Dashboard tiles | Analytics aggregates | Balance tiles must show aggregate-based funds | ADAPT (presentation only) |
| Treasury T5 clearing projection (`99B`) | Recognized Dr1030 vs TREASURY_RECEIPT Cr1030 | Composed leg Cr1030 rows must count as clearing; exposure 0 at Save | ADAPT (count composed clearing; residual gate retained) |
| Finance readiness/production validators (`36:validateFinanceProductionRuntime`) | Account metadata gates | Must accept/require the aggregate account | ADAPT at activation |
| CapitalEquity (`38`) | Equity + post-cutoff P&L | None | None |

Finance stays derived/read-only throughout; no Finance writer exists or is
introduced.

## 14. Transitional Rp24,000 Treatment Recommendation

Measured facts (prior accepted production evidence; not re-probed this task):
exposure `SCR-CE122B27-ORD677BE5CES` = 24,000 recognized (Dr1030 via U2 Save),
no Treasury receipt, T5 status UNCLEARED, LedgerNet1030 = Dr 24,000, residual
0, no genuine receipt ever posted. Owner business facts: the sale was real;
Rp24,000 was received; operationally cash; the receipt is part of that same
sale transaction; NO external receipt evidence exists or is expected.

Recommendation (prospective; NO action in T11.1):
1. Do NOT fabricate a Treasury receipt with an invented `evidenceRef` — that
   manufactures external evidence and corrupts the EvidenceRef authority.
2. Do NOT make transitional closure a normal workflow — the composed
   single-commit money leg makes future exposures zero at Save; this is a
   one-time pre-single-commit residue.
3. Close via ONE owner-authorized transitional operation in a dedicated
   future activation unit (T11.2+): a signed journal Dr aggregate-funds (or,
   if Opt1 were chosen, the live account) / Cr1030, SourceType
   `TRANSITIONAL_CLEARING_CLOSE`, SourceID bound to
   `SCR-CE122B27-ORD677BE5CES`, EconomicDate = action date (original periods
   never rewritten), justified by the owner's business fact recorded as
   internal attestation evidence (task authorization + this document), not an
   external artifact. T5 then shows CLEARED with the close visible as an
   explicit, auditable exception-class movement; the residual gate remains.
4. Alternative rejected: leave UNCLEARED indefinitely — misstates clearing
   metrics and contradicts the owner's stated business fact.

## 15. Historical Compatibility Constraints

- Historical rows in tabsal/tabops, Settlements, BalanceLedger, Orders,
  OrderLines, SalesRecognitionEvents, PurchaseEvents, TreasuryReceipts are
  append-only and never rewritten.
- Legacy channel balances on 1000/1010/1020 remain real money; reports must
  keep reading them (frozen) and add the aggregate for new activity.
- Pre-V2 sales keep their historical payment/settlement contract via
  evidence-based cohort guards (`97D`), unchanged by T11.
- Legacy UNPAID purchase events + 2000 obligations keep AP settlement and
  adjustment writers (W5/W7); no operational AP is reactivated for new normal
  purchases.
- Policy C transition-date regime split (`39:resolvePolicyCAccountingRegime_`)
  stays; T11 only changes the prospective normal-flow credit side (aggregate
  account) via owner-approved activation.
- Cutover discipline mirrors Sales V2 U7/Treasury T10.5: config-gated,
  fail-closed, PREPARED default, zero behavior change until separately
  authorized activation.

## 16. Explicit OUT-OF-SCOPE for T11 (must NOT be introduced)

- Payment-channel tracking, channel selection UI, channel-level balances for
  new normal transactions.
- Fake `PaymentMethod=CASH` or any default channel stamp.
- Routine Paid/Unpaid states, routine AR for dine-in timing, operator
  settlement workflow, routine Treasury open, EvidenceRef for ordinary
  transactions.
- Operational AP without a genuine supplier-credit business requirement.
- Inventory authority, recipe auto-consumption, HPP accounting reversal
  (Dr5000/Cr1100 stays frozen out of prospective regime), InventoryLedger
  movements from T11 flows.
- Automatic Dr1030/Cr2010 refunds or customer credits.
- RBAC of any kind (permanently out of scope; sole operator).
- Historical rewrites/backfills; production mutations; deploys/pushes;
  manufactured test business events.
- Nesting T4 inside U2 or creating a second plan/second batch for the same
  normal transaction.

## 17. Exact Source References for Authority Claims

- Dispatcher/locks/cash-account validation: `21.Transaction.Entry.js:248-405`
  (`submitCanonicalTransaction*`), `:191-245` (settlement bridge).
- Sales V2 routing/guards: `97D.SalesRecognition.V2.OperatorGuard.js:30-81`
  (config), `:201-255` (create/legacy guard), `:263-298` (retirement +
  cash-post block), `:342-367` (recovery).
- Sales V2 save core: `97A.SalesRecognition.V2.Save.js:14-67` (contract,
  WRITE_SURFACES, JOURNAL_ACCOUNTS {SETTLEMENT:1030, REVENUE:4000}),
  `:424-496` (plan freeze), `:501-567` (value ranges + ONE batch body),
  `:613-818` (plan verification), `:1398+` (outer lock).
- Sales V2 mutations: `97C.SalesRecognition.V2.Correction.js:24-88` (contract;
  Dr4000/Cr1030 void; full reversal + replacement correct; no Dr1030/Cr2010).
- Sales V2 projection (U3): `97B.SalesRecognition.V2.Projection.js:1-51`.
- V2 account metadata (1030 without CashFlowGroup): `97.SalesRecognition.V2.Foundation.js:325-338`.
- Cash foundation: `40.Cash.Foundation.js:1-21` (codes 1000/1010/1020 +
  metadata), `:213-369` (posting candidates incl. V2 block, PAID_SALE,
  PAID_EXPENSE, AP_SETTLEMENT), `:496-601` (settleAndPersist multistep +
  recovery), `:603-635` (balance read model over 1000/1010/1020),
  `:730-754` (accounts target incl. 1010/1020 additive pattern).
- Policy C: `39.Balance.Foundation.js:152-174` (purchase journal Dr6210 /
  Cr cash-or-2000), `:183-206` (sales HPP; prospective NON_POSTING),
  `:228-285` (AP settlement + adjustments), `:309-321` (post + status readback).
- Purchase events: `47.Purchase.Events.js:7-9` (headers/payment statuses),
  `:111-158` (normalizer PAID/UNPAID authority), `:815-873` (void).
- Expense/purchase policy: `46.Expense.Purchase.Policy.js:1-58`.
- Treasury: `99.Treasury.Receipt.Foundation.js:23-31` (MANUAL_VERIFIED,
  CLEARING 1030, DESTINATION = cash universe), `99A.Treasury.Receipt.Durable.Save.js:1-86`
  (one-batch contract), `:117-173` (normalize incl. evidenceRef mandatory),
  `:665-677` (Dr destination / Cr1030), `99B.Treasury.Clearing.Projection.js:808-877`
  (outstanding = recognized − cleared), `:1109-1120` (residual),
  `99C.Treasury.Receipt.Reversal.Correction.js:525-548` (reversal/replacement
  journals), `99D.Treasury.Operator.Api.js:227-239` (operator save/reverse/correct).
- Finance readers: `36.Finance.Service.js:34-70` (P&L composition + U3
  authority), `:72-169` (Cash Flow over 1000/1010/1020 + CashFlowGroup).
- Lifecycle: `22.Transaction.Lifecycle.js:257-336` (void/correction).
- Production entry: `95A.Transaction.Production.js:366-371`
  (`submitOperationalOrder` mode dispatch).
- UI: `194.View.Transactions.Forms.html:1-65` (state, cash radio),
  `195.View.Transactions.Actions.html:200-237` (V2 order payload, no money
  field), `:368-427` (submit routes), `:1031-1065` (purchase receipt payload).

## 18. Test Results (MEASURED)

- Command: `node _test_runner.js` (local synthetic-fixture harness; no
  production access, no `clasp`).
- Result: **181 PASS / 0 FAIL** (`===== NUMLOCK POLICY C LOCAL HARNESS: 181 PASS, 0 FAIL =====`) on unmodified baseline `c67f8a9`.
- Coverage relevant to this discovery: Sales V2 U1-U10 (save/recovery/guards/
  projection/U4/U5/U6/U7/U8/activation), Treasury T3-T10.5 (core/refusals/
  idempotency/concurrency/T5 projection/T6 lifecycle/T7 controller/T8 gate/
  T9 preparation/T10.5 activation), Expense/Purchase (policy, orchestration,
  correction, void, recovery), Cash Foundation, Finance (P&L, Cash Flow,
  Policy C integrated), operational readiness/production matrices.
- Read-only architectural probes this session: `git rev-parse HEAD`,
  `git status --short`, `git ls-files*`, `git diff --check`, `codegraph status`,
  targeted source reads/greps. Production writes 0; deploys 0; pushes 0;
  config writes 0; financial events 0.

## 19. Proposed T11.2 Contract Questions Requiring OWNER Approval

Only genuinely different BUSINESS semantics; all technical mechanics above are
source-resolved.

1. **Operational-money account**: approve Opt2 — new aggregate account
   (proposed code `1040`, name "Operational Funds", Asset/Current
   Assets/Operating/DEBIT) as the single live money authority, with
   1000/1010/1020 frozen historical? (Or explicitly choose Opt1 broadened 1000
   accepting the misleading "Cash on Hand" semantics.)
2. **Transitional Rp24,000 close**: approve the one-time transitional
   clearing close (Dr aggregate / Cr1030 bound to
   `SCR-CE122B27-ORD677BE5CES`, owner attestation as internal evidence) in a
   dedicated activation unit — or explicitly defer with exposure left UNCLEARED.
3. **Purchase normal flow**: confirm supplier identity is NOT required for
   ordinary purchases (recorded only when genuinely known), and that UNPAID/AP
   appears only when the owner deliberately records real supplier credit.
4. **Cash Flow classification**: confirm composed money movements are
   classified Operating by transaction substance (no channel-based grouping).
5. **Balance presentation**: confirm "Total operational funds" = aggregate +
   frozen legacy channel balances, with legacy balances labeled historical.
6. **Sales orderType metadata**: confirm keeping orderType as optional
   descriptive metadata on Orders (no accounting effect).

---

DISCOVERY COMPLETE. Next unit: T11.2 (single-commit contract design +
activation preparation) after owner decisions on section 19.
