# T11.2 — NUMLOCK Single-Commit Transaction Contract (Sales / Expense / Purchase)

STATUS: CONTRACT FROZEN · DESIGN ONLY · ZERO RUNTIME IMPLEMENTATION · NO PRODUCTION MUTATION
TASK_ID: T11_2_SINGLE_COMMIT_TRANSACTION_CONTRACT
PHASE: NUMLOCK_SINGLE_COMMIT_TRANSACTION_ARCHITECTURE
BASELINE_COMMIT: `7c2cc52` (T11.1 evidence commit; verified MEASURED this session)
CLASSIFICATION: L3 · R1 · REASONING_EFFORT high · Execution CONTINUE
PREDECESSOR: `docs/T11-1-SINGLE-COMMIT-PRODUCTION-DISCOVERY-AND-AUTHORITY-BASELINE.md` (19 sections, file:line refs §17)
OPEN_OWNER_DECISIONS: **NONE** — all business semantics resolve from frozen D1–D15 (§2); all technical mechanics resolve from source (file:line refs inline).

---

## 1. Purpose and Precedence

Purpose: freeze the prospective NUMLOCK Single-Commit Transaction Contract for
Sales, Expense, and Purchase. The invariant that this document fixes:

> ONE BUSINESS TRANSACTION INPUT → ONE Save Transaction → DONE FOR THE
> OPERATOR. No routine post-Save financial workflow.

Scope of authority of this document:

1. It is a DESIGN/CONTRACT FREEZE only. It creates no runtime behavior, no
   config mutation, no schema change, no business/financial event, no
   production write, no `clasp` activity, no deployment.
2. It is the authoritative design contract for all subsequent T11
   implementation units, until superseded by an explicit later contract freeze.

Precedence (highest first):

1. `AGENTS.md` (workflow, safety, validation, Git, escalation policy).
2. Active task prompt delta (this unit's scope, safety, commit policy).
3. **Frozen owner decisions D1–D15 (§2)** — business semantics; owner-authoritative.
4. This contract's technical freezes (§3–§26) — prospective design; must not
   contradict D1–D15 or source reality.
5. Repository source (`*.js`, HTML) — current mechanical truth; wins on any
   conflict about what exists today (per Compact Context Package).
6. T11.1 discovery document — accepted prior evidence (file:line §17); not
   re-proven here.

Conflict rule: where this contract and source disagree, source wins on
"what is"; D1–D15 win on "what the business requires"; the divergence is
resolved by implementation bounded to §26 units, never by silent redesign.

## 2. Frozen Owner Decisions (D1–D15 — verbatim, authoritative)

- **D1**: new aggregate account **1040 Operational Funds** = sole LIVE operational-money authority for new normal Sales/Expense/Purchase money movements. Do NOT broaden 1000 semantics. No channel selection, no inference, no fake PaymentMethod=CASH. 1000/1010/1020 = historical authority/evidence; no ledger/transaction rewrites. 1040 semantically aggregate Operational Funds, not physical cash.
- **D2**: payment channel NOT an operational dimension; normal UI never requests Cash/DANA/BluBCA/paidVia/payment method/destination; no channel-level reporting.
- **D3**: Save is terminal; no routine Receive/Verify Payment, Settlement, Paid/Unpaid, Treasury action, EvidenceRef, RecognitionID selection, second financial Save.
- **D4**: pay-before/pay-after-consumption not modeled (no AR/Paid-Unpaid/settlement lifecycle); Save = authoritative accounting boundary.
- **D5**: Sales recognition preserved Dr1030/Cr4000; compose money leg in SAME durable transaction: Dr1040/Cr1030; net normal Sale = Dr1040/Cr4000; 1030 = internal technical clearing; zero unexplained 1030 exposure per new Sale; Revenue = U3 canonical; ledger never second Revenue authority.
- **D6**: RETAIN durable ops/RequestKey/immutable plans/readback/signature/COMMITTED-UNKNOWN recovery/audit/T5 concepts/T6 concepts/governance. Normal flow must NOT require T4/T7 manual receipt workflow (MANUAL_VERIFIED/EvidenceRef/destination selection/operator receipt Save). T4 must NOT be nested from Sales U2 (independent lock/RequestKey/lifecycle). FREEZE whether normal composed money events reuse Treasury schemas/event concepts or get a dedicated composed-money representation — decide on authority clarity + durability, justify.
- **D7**: normal Expense = ONE durable Save; eliminate `submitCanonicalTransaction`→tabops→separate-cash multistep `accountingPending` hazard; business event + expense leg + money leg = one immutable plan + one atomic mutation unit where Sheets permits; no cash-account radio; debit authoritative expense account / credit 1040 via backend mapping; operator never selects ledger accounts unless business category itself is the input.
- **D8**: Policy C authoritative; ordinary Purchase: Dr6210/Cr1040 in same durable Save. NO routine operational AP, NO Inventory, NO Dr5000/Cr1100, NO recipe auto-consume, NO historical AP/Purchase rewrite. 2000 remains historical/legitimate where existing authority requires; normal prospective Purchase = paid-at-Save.
- **D9**: SupplierID OPTIONAL business metadata for normal Purchase; never fail solely on absence.
- **D10**: KEEP orderType (DINE_IN/TAKE_AWAY) as business metadata.
- **D11**: Cash Flow by economic substance: Sales composed inflow Operating; Expense outflow Operating; Purchase outflow Operating. Do NOT require 1030 to carry CashFlowGroup for normal composed classification. Future Investing/Financing outside this rule.
- **D12**: no channel-level balances required; 1040 = live aggregate authority; historical 1000/1010/1020 balances must remain visible to accounting and in total-funds reporting; freeze canonical aggregate-funds projection incorporating historical monetary balances + prospective 1040 WITHOUT double-counting; Dashboard presents useful aggregate, no channel breakdown.
- **D13**: transitional close of `SCR-CE122B27-ORD677BE5CES` (24,000) authorized semantically: Dr1040/Cr1030 24,000, source classification `TRANSITIONAL_CLEARING_CLOSE`, owner attestation = sufficient internal evidence, NO fabricated EvidenceRef. DO NOT EXECUTE in T11.2 — freeze only.
- **D14**: routine payment/settlement actions disappear; genuine correction remains; freeze exact signed correction semantics for Sales Correct, Sales Void, Expense correction/cancel, Purchase correction/cancel — correction reverses/replaces ALL accounting consequences of the original single-commit transaction INCLUDING its 1040 money effect, no routine Treasury workflow; no automatic 2010.
- **D15**: UI principle — if backend can determine it from authority/rules, do not ask operator; no internal concepts leak (account codes, RecognitionID, ReceiptID, OperationID, RequestKey, EvidenceRef, destination, journal, clearing, settlement).

## 3. Authority Graph — Sales (prospective, config-gated)

Seam (unchanged): operator UI (`194`/`195`) → `saveOperationalOrder` (`195:229-237`) →
`submitOperationalOrder` (`95A:366-371`) → `salesV2OperatorResolvedRoute_` /
`salesV2OperatorModeCreateOrder_` (`97D:233-242`) → `salesRecognitionV2DurableSave`
(`97A:1398+`, outer ScriptLock, `OUTER_LOCK_UNAVAILABLE` fail-closed).

```
Operator business input (product, variant, qty, orderType)
  → U2 Save op (SALES_RECOGNITION_V2_SAVE)  [one lock, one RequestKey, one plan]
      ├─ recognition journal  Dr1030 / Cr4000   (byte-identical to today; U3 revenue authority)
      ├─ money journal        Dr1040 / Cr1030   (NEW; composed in SAME plan+batch; D5)
      └─ net normal Sale      Dr1040 / Cr4000   (derived; never a third journal)
  → DONE  (1030 exposure for this sale = 0 at commit)
```

- Authority chain: config (U7 fail-closed) → schema/cohort/variant/authority
  preflight → frozen immutable plan + planDigest → IN_PROGRESS intent +
  readback → ONE atomic `spreadsheets.batchUpdate` → artifact verification →
  COMMITTED readback → DONE (`97A:424-567`, `97A:613-818`).
- Writer identity (frozen): money journal = JournalID `SRV2M-<OrderID>`
  (stable-bootstrap like existing `SRV2J-`), LineID `-1`/`-2`, MovementType
  `SALES_MONEY`, SourceType `SALES_MONEY_V2`, SourceID = RecognitionID,
  Tanggal = economicDate, signed `journalSignature` over the money rows.
- Recognition journal (`SALES_RECOGNITION` / `SALES_RECOGNITION_V2`) stays
  byte-identical (`97A:443-454`) → U3 totals, U6 reversal arithmetic, journal
  signature contracts, and cohort semantics unchanged.
- T4 is never nested: no Treasury RequestKey namespace, no destination, no
  evidenceRef, no second lock inside U2 (D6).
- Config gate: the money leg activates under `SINGLE_COMMIT_TRANSACTION_V1`
  (§20). While PREPARED, the U2 save is byte-identical to the T11.1 baseline
  (recognition only) — zero behavior change until authorized activation.
- Payment fields requested from operator: NONE (unchanged, `195:208-237`).

## 4. Authority Graph — Expense (prospective)

Seam (unchanged entry, redesigned core): `submitTransactionEntry`/
`submitOperationalExpense` (`195:368-427`, `95A:408-411`) →
`submitCanonicalTransactionWithRuntime_` (`21:258`) → EXPENSE non-purchase
route (`21:320-355`) → **NEW durable single-commit expense save core** replacing
the persist-then-settle multistep.

```
Operator business input (expenseItemID, amount, date)
  → preflight: ExpenseItems authority (ID_Ops → AccountCode, IsActive),
    amount>0, date valid, schema ready, 1040 active   [zero writes on refusal]
  → EXPENSE_SINGLE_COMMIT_SAVE op  [one lock, one RequestKey, one plan]
      ├─ business row   tabops (EXPENSE_HEADERS, OPS-APP-<ts>-<n>)
      ├─ expense leg    Dr <ExpenseItems.AccountCode>   (backend mapping; D7)
      ├─ money leg      Cr 1040                          (backend-derived; D1/D2)
      └─ audit row      Logs (LOG_HEADERS, action CREATE_EXPENSE)
  → ONE atomic batchUpdate [tabops, BalanceLedger(2), Logs] → DONE
```

- The legacy path (`persistCanonicalEntry` write #1 → `attemptCashSettlement`
  write #2/#3 → `accountingPending`/`SETTLEMENT_PENDING`, `21:377-389`) is the
  hazard D7 removes. Under `SINGLE_COMMIT_TRANSACTION_V1` ACTIVE, the normal
  expense route never enters `attemptCashSettlement`,
  `logSettlementPending`, or any `Settlements` write.
- Writer identity (frozen): JournalID `EXPJ-<ID_Trx>`, MovementType
  `EXPENSE_SINGLE_COMMIT`, SourceType `EXPENSE_SINGLE_COMMIT_V1`,
  SourceID = ID_Trx, Tanggal = canonical date key of the expense date.
- `cashAccountCode` is no longer accepted as a normal-flow input (dispatcher
  field allowlist `21:342-344` becomes the enforcement point); the credit
  account 1040 is backend-derived, never operator-derived.
- Purchase-routed expense items are NOT handled here — they divert to §5 before
  any expense-core write (existing `resolveExpensePurchasePolicy_` gate,
  `21:323-341`).

## 5. Authority Graph — Purchase (prospective)

Seam (unchanged entry, one core): both operator adapters
(`submitOperationalPurchase` `95A:386-407` and receipt entry
`195:1031-1065` → `submitCanonicalTransaction`) normalize into ONE
**PURCHASE_SINGLE_COMMIT_SAVE** core. The current split (business row write +
separate `postPolicyCPurchaseEvent_` ledger append + status update = three
writes, `21:334-339`, `39:309-321`) collapses into one plan+batch.

```
Operator business input (expenseItemID/item, qty+UOM, price, date,
                          [SupplierID optional], [reference/evidence fields as source requires])
  → preflight: Policy C route (purchase), regime = PROSPECTIVE_PURCHASE_EXPENSE,
    conversion/qty/amount authority, schema ready, 1040 active
  → PURCHASE_SINGLE_COMMIT_SAVE op  [one lock, one RequestKey, one plan]
      ├─ event row      PurchaseEvents (PaymentStatus=PAID, CashAccountCode=1040,
      │                 AccountingStatus=POSTED written directly in the append; D8/D9)
      ├─ expense leg    Dr 6210            (Policy C prospective; unchanged)
      ├─ money leg      Cr 1040            (replaces Cr cashAccountCode; D1/D8)
      └─ audit row      Logs (CREATE purchase action, existing shape)
  → ONE atomic batchUpdate [PurchaseEvents, BalanceLedger(2), Logs] → DONE
```

- Journal identity reuses Policy C verbatim: MovementType
  `PURCHASE_RECOGNITION`, SourceType `PURCHASE_EVENT`, SourceID = EventID,
  JournalID `POLICYC-PEXP-PURCHASE-<EventID>` (prospective regime), via the
  `buildPolicyCPurchaseJournal` shape (`39:152-174`) with credit side frozen to
  `1040` for normal flow. `policyCExistingJournalState_` dedupe
  (`39:160-162`) remains as preflight defense.
- Payment authority fields (`paidVia`, operator `paymentStatus`,
  `cashAccountCode`) are removed from the normal payload
  (`47:111-161` field allowlist + `95A:408-411`); backend writes
  PaymentStatus=`PAID`, CashAccountCode=`1040` (paid-at-Save, D4/D8).
- SupplierID (D9): recorded when supplied; absence never refuses the normal save.
  UNPAID/AP journaling (credit 2000) remains only for genuine supplier-credit
  entries outside the normal UI (existing `normalizePurchaseEventRequest_`
  compatibility path), never the normal flow.
- Legacy regime (ExpenseDate before Policy C transition, `39:resolvePolicyCAccountingRegime_`)
  and Inventory receipts (W16, `45/42/43`) are untouched authority, outside this
  contract's normal flow.

## 6. Common Durable Single-Commit Protocol

The frozen protocol (outermost → DONE). Exactly one outer lock, one
RequestKey lookup, one immutable plan, one atomic batch:

1. **Outer ScriptLock** — `lock.waitLock(30000)`; unavailable → `REFUSED
   OUTER_LOCK_UNAVAILABLE`, zero writes. Lock owned by the save core entry;
   nested lock acquisition inside an active scope is forbidden; T4/T7 locks are
   never nested (D6).
2. **Normalize** — strict field allowlist; unknown fields refused; channel/payment
   fields refused on normal flow (D2/D15).
3. **RequestKey lookup** — exact `(OperationType, RequestKey)` in
   `TransactionOperations` (`95A:138-140`) BEFORE any write.
   - Found + COMMITTED + same PayloadHash → replay: return stored outcome, `replay: true`.
   - Found + same hash + IN_PROGRESS → resume from stored plan (never recompute
     from mutable masters).
   - Found + different PayloadHash → `CONFLICT` (`OPERATION_PAYLOAD_CONFLICT`).
   - Not found → continue.
4. **Authority/config/schema/account preflight** — config mode gate
   (PREPARED→refuse for new cores; ACTIVE→proceed; invalid→REJECT, never
   fallback — `97D:30-50` pattern); schema headers exact; business authority
   (variants/recipes/prices, ExpenseItems, Policy C route/regime); account 1040
   present + Active + metadata matches §11. Any failure → `REFUSED`, zero writes.
5. **Immutable plan freeze** — all rows (business + ledger + audit),
   normalized payload, payloadHash, derived identities, journal signatures,
   `planDigest` computed over the plan without the digest key
   (`97A:480-495`). Plan is the single source of truth for every later step.
6. **Durable IN_PROGRESS intent** — `TransactionOperations` row (OperationPlan =
   JSON plan) + exact readback of all ten headers (`95A:8`). Intent write and
   commit write are multistep by design; only the batch is atomic — the
   adapter claims no database-global atomicity (`97A:11-13`, inherited claim).
7. **ONE atomic `spreadsheets.batchUpdate`** — `appendCells` subrequests, one
   per frozen write surface, RAW CellData only (stringValue/numberValue/
   boolValue), missing sheetId → throw before any request (all-or-none),
   bounded by `MAX_BATCH_CELLS`/`MAX_CELL_CHARS`/`MAX_REQUEST_BYTES`
   re-evaluated against the STORED plan on resume (`97A:501-567`, `97A:569+`).
8. **Artifact verification** — re-read every surface; every row must match the
   plan exactly (counts, identities, amounts, signatures, dates). Any mismatch
   → `RECOVERY_REQUIRED` (never a second write attempt).
9. **COMMITTED readback** — operation row State=COMMITTED + digest/outcome
   fields verified (`97D:342-367` recovery contract: the operation row is the
   outcome authority).
10. **Cache invalidation** → **DONE** envelope (statuses `DONE / REFUSED /
    CONFLICT / UNKNOWN / RECOVERY_REQUIRED`; UNKNOWN/RECOVERY_REQUIRED always
    retain requestKey + operation linkage, never collapse to definite failure —
    `97A:69-71`).

Proven-equivalent domain variations (documented, not alternatives):

| Aspect | Sales | Expense | Purchase |
| --- | --- | --- | --- |
| Surfaces in batch | 5 (Orders, OrderLines, SalesRecognitionEvents, BalanceLedger, SalesRecognitionAudits) | 3 (tabops, BalanceLedger, Logs) | 3 (PurchaseEvents, BalanceLedger, Logs) |
| Envelope | U2 save core (`97A`) | same envelope, new OPERATION_TYPE | same envelope, new OPERATION_TYPE |
| Identity derivation | `(OperationType, RequestKey)` → OperationID/OrderID (`97A:1191-1192`) | same pattern → `OPS-APP-<ts>-<n>` | same pattern → `PE-<requestKey>` (existing `EventID` derivation retained as business identity) |
| Existing recovery | `97D:342-367` | same pattern (new entrypoint) | same pattern; `testPurchaseRecoveryContracts` extended to batch |

Never solve atomicity via multiple independent Save endpoints from the UI
(frozen prohibition).

## 7. Per-Domain Immutable Plan Contents

All plans: `planVersion`, `contractVersion`, `operationType`, `operationID`,
`requestKey`, `payloadHash`, `normalizedPayload`, `actor`, `savedAt`,
`economicDate`, derived IDs, complete row objects, journal signatures,
`planDigest`.

- **Sales plan** = today's U2 plan (`97A:480-495`: orderRow, lineRows,
  lineAuthority, journalRows[2] recognition, eventRow, auditRow,
  journalSignature) **+ `moneyJournalID` (`SRV2M-<OrderID>`), `moneyRows[2]`
  (Dr1040/Cr1030), `moneyJournalSignature`**. Recognition rows and their
  signature remain byte-identical. Plan verification (`97A:740-776`) keeps every
  existing recognition check unchanged and adds the money-pair checks: LineIDs
  `-1`/`-2` of moneyJournalID, SourceType `SALES_MONEY_V2`, SourceID =
  recognitionID, MovementType `SALES_MONEY`, AccountCode 1040 debit /
  1030 credit, amounts = orderTotal, date = economicDate, signature valid,
  and `orderTotal Dr − Cr across 1030 lines = 0`.
- **Expense plan** = OPERATION_TYPE `EXPENSE_SINGLE_COMMIT_SAVE`; business row
  (exact `CANONICAL_ENTRY.EXPENSE_HEADERS`, `20:265-266`); `expenseAccount`
  (snapshot of `ExpenseItems.AccountCode` + IsActive evidence); `journalRows[2]`
  (Dr expenseAccount / Cr1040); `auditRow` (`CANONICAL_ENTRY.LOG_HEADERS`,
  `20:267`, RecordID = entry ID); journal signature over the money pair;
  planDigest.
- **Purchase plan** = OPERATION_TYPE `PURCHASE_SINGLE_COMMIT_SAVE`; eventRow
  (exact `PURCHASE_EVENT_POLICY.headers`, `47:3-7`, with backend-derived
  PaymentStatus=`PAID`, CashAccountCode=`1040`, AccountingStatus=`POSTED`,
  SupplierID as supplied or empty); `journalRows[2]` (Dr6210 / Cr1040 per
  Policy C prospective shape); `auditRow` (Logs); journal signature
  (`policyCJournalSignature_`); planDigest; regime + conversion authority
  snapshots.

## 8. Per-Domain Atomic Batch Contents

Exact `appendCells` subrequests of the ONE batch (frozen order):

| # | Sales | Expense | Purchase |
| --- | --- | --- | --- |
| 1 | Orders: 1 row | tabops: 1 row | PurchaseEvents: 1 row |
| 2 | OrderLines: N rows (≤50) | BalanceLedger: 2 rows | BalanceLedger: 2 rows |
| 3 | SalesRecognitionEvents: 1 row | Logs: 1 audit row | Logs: 1 audit row |
| 4 | BalanceLedger: **4 rows** (2 recognition + 2 money) | — | — |
| 5 | SalesRecognitionAudits: 1 row | — | — |

- Outside the batch (pre/post, inherited U2 claim): IN_PROGRESS intent write +
  readback (before), COMMITTED readback (after), cache invalidation (after).
- Forbidden artifacts in every batch: Payments, Settlements, InventoryLedger,
  TreasuryReceipts, Cash, Fulfillment, Accounts, FinanceOpeningBalances
  (WRITE_SURFACES semantics inherited: `97A:33-36`; expense/purchase lists are
  the 3-surface equivalents).
- Sheets permits this atomicity: all surfaces are append-only rows via one
  `spreadsheets.batchUpdate` (all-or-none), the proven U2/Treasury pattern.

## 9. RequestKey / Idempotency / Recovery

| Concern | Frozen rule |
| --- | --- |
| Ownership | `TransactionOperations` (OperationType, RequestKey) exact unique lookup; duplicate row in store → `DUPLICATE_OPERATION` fail-closed (`95A:138-140`). The operation row is the outcome authority. |
| Namespaces (OperationType) | Sales: `SALES_RECOGNITION_V2_SAVE`, `SALES_V2_VOID`, `SALES_V2_CORRECT` (existing). NEW: `EXPENSE_SINGLE_COMMIT_SAVE`, `EXPENSE_SINGLE_COMMIT_VOID`, `EXPENSE_SINGLE_COMMIT_CORRECT`, `PURCHASE_SINGLE_COMMIT_SAVE`, `PURCHASE_EVENT_VOID`, `PURCHASE_EVENT_CORRECT`, `TRANSITIONAL_CLEARING_CLOSE`. |
| RequestKey origin | Client-generated technical identity (DERIVABLE_BACKEND class per T11.1 §9; never operator-typed, D15); retained by client across retry of the SAME intent. |
| Idempotency | Same key + same normalized payload hash → replay/resume; same key + different payload → `CONFLICT`; key uniqueness enforced before any write. |
| Replay from IN_PROGRESS | Re-execute from STORED plan only (no recomputation from mutable masters); bounds re-checked against stored plan; artifact verification decides DONE vs RECOVERY_REQUIRED. |
| Replay from COMMITTED | Return stored DONE outcome with `replay: true`; no writes. |
| UNKNOWN | Batch/readback/commit outcome unknown → status `UNKNOWN` (or `RECOVERY_REQUIRED` per envelope rules); requestKey + operationID retained; client re-checks the SAME intent; never a definite failure, never a second independent intent. |
| Double money prevention | Plan-based artifact verification + single SourceType/SourceID per journal group + signature dedupe (`policyCExistingJournalState_`, receipt/source-state checks); a money event can exist at most once per operation identity. |
| Cross-domain | One operation row per intent; corrections/voids are their own operations keyed to target business ID + their own RequestKey. |

## 10. Correction / Void / Cancel (exact signed semantics)

Correction NEVER deletes; it appends signed reversals/replacements at
ACTION-period dating; originals immutable; accounting consequence reversed in
FULL including the 1040 money effect; no Treasury workflow; no automatic 2010
(D14, Policy C frozen).

| Action | Signed ledger semantics (accounts × sign) | Business rows | Batch |
| --- | --- | --- | --- |
| **Sales Void** (`SALES_V2_VOID`, `97C` extended) | Existing: void event + Dr4000/Cr1030 (recognition reversal). **+ NEW money reversal: Dr1030 / Cr1040**, JournalID `SRV2MV-<OrderID>`, MovementType `SALES_MONEY`, SourceType `SALES_MONEY_V2`, SourceID = void recognitionID (`SCRV-` family). Net effect of void = Dr1040/Cr4000 fully reversed; 1030 net 0 across lifecycle. | void event + audit (existing `97C` surfaces) | ONE batch (existing `SALES_V2_VOID` WRITE_SURFACES already include BalanceLedger) |
| **Sales Correct** (`SALES_V2_CORRECT`) | Existing full reversal + complete replacement recognition (new OrderID) **+ money reversal of the original (as void) + replacement money leg `SRV2M-<newOrderID>` Dr1040/Cr1030** inside the same mutation batch. Never a delta. | reversal + replacement events, replacement order/lines, audits (existing surfaces) | ONE batch (existing WRITE_SURFACES) |
| **Expense Cancel** (`EXPENSE_SINGLE_COMMIT_VOID`) | Mirror journal: **Dr1040 / Cr expenseAccount**, JournalID `EXPJV-<ID_Trx>`, MovementType `EXPENSE_SINGLE_COMMIT`, SourceType `EXPENSE_SINGLE_COMMIT_V1`, SourceID = ID_Trx. | append-only lifecycle row (existing `22` guard: IsActive=false + signed lifecycle entry in Logs) | ONE batch [tabops lifecycle update, BalanceLedger 2, Logs] |
| **Expense Correct** (`EXPENSE_SINGLE_COMMIT_CORRECT`) | Full reversal journal (as cancel) **+ complete replacement expense save** (new business row + Dr expense/Cr1040) with its own RequestKey-derived identity, same batch. | original lifecycle → CORRECTED + replacement row + signed audit | ONE batch |
| **Purchase Cancel** (`PURCHASE_EVENT_VOID`) | Mirror journal: **Dr1040 / Cr6210** (prospective regime), Policy C adjustment shape (`39:256` family) with credit side 1040. | existing `47:789-873` void lifecycle (VOIDED + IsActive=false + audit) | ONE batch |
| **Purchase Correct** (`PURCHASE_EVENT_CORRECT`) | Full reversal (as cancel) + replacement event with its composed Dr6210/Cr1040 journal; existing `corr-` deterministic keys retained (`47:111+`, `correctPurchaseEventUnderLock_`). | existing CORRECTED + replacement CAPTURED_OPERATIONAL | ONE batch |

Invariants for every row of this table:

- Reversal credit/debit on 1040 exactly offsets the original money leg;
  aggregate-funds returns to the pre-transaction level after cancel; the
  replacement carries a fresh 1040 effect (never netted by mutation trickery).
- No `Settlements`, no `TreasuryReceipts`, no EvidenceRef, no destination, no
  Paid/Unpaid toggle, no second Save anywhere in corrections.
- 2010 (Customer Refund and Credit Payable) remains writer-less; no automatic
  refund/credit journals (D14, W16-refusal parity).
- Reversal journals bind to the original SourceID/EventID for dedupe and T5/T6
  attribution; `MovementType` for reversals = original movement type (matching
  existing `97C`/`99C` reversal-verification patterns, `97C:665-666`).

## 11. Account 1040 Contract (frozen; row NOT created in T11.2)

Exact Accounts row (headers `CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS`,
`40:30-31`; additive-row pattern precedent: 1010/1020 at `40:743-749`):

| Header | Value |
| --- | --- |
| AccountCode | `1040` |
| AccountName | `Operational Funds` |
| AccountType | `Asset` |
| StatementGroup | `Current Assets` |
| CashFlowGroup | `Operating` |
| IsActive | `TRUE` |
| CreatedAt | (creation timestamp — set only at the future authorized creation unit) |
| UpdatedAt | (creation timestamp) |
| NormalBalance | `DEBIT` |

Frozen rules:

- 1040 = sole LIVE operational-money authority for new normal Sales/Expense/
  Purchase money movements (D1). Semantically aggregate Operational Funds,
  explicitly NOT physical cash; no channel inference ever derived from it.
- Uniqueness: exactly one `AccountCode=1040` row; creation preflight refuses if
  the code exists with conflicting metadata, and is idempotent if the row
  already matches.
- `CASH_FOUNDATION_POLICY.ACCOUNT_CODES` (`40:2`) stays `["1000","1010","1020"]`
  — it is the historical channel-universe constant (openings classification,
  legacy settlement validation, Treasury destination universe). 1040 is NOT
  added to it. Aggregation uses a NEW enumerable list
  (`AGGREGATE_MONEY_ACCOUNT_CODES = legacy ∪ {1040}`) in readers only (§12).
- Historical 1000/1010/1020: frozen, never rewritten, balances remain visible
  to accounting and in total-funds reporting (D1/D12).
- 1030 stays technical clearing (D5); 2000 stays historical AP authority (D8);
  2010 stays writer-less.
- This task creates NO row, NO config, NO ledger entry for 1040.

## 12. Aggregate-Funds Projection (frozen)

Canonical aggregate (D12), one definition, used by Dashboard and Balance
Position:

```
TotalFunds(period) =
    Σ (active BalanceLedger net of 1000, 1010, 1020 — historical channel accounts)
  + Σ (active BalanceLedger net of 1040 — live aggregate authority)
  − (openings handled exactly as today's cash-balance math, `40:603-635`,
     extended only by the 1040 opening row which starts at 0)
```

Frozen properties:

- No double-counting: (a) legacy channel accounts receive no NEW normal-flow
  postings after activation (their net changes only by legacy/exception writers
  already in authority); (b) 1040 receives ONLY normal composed money legs and
  the one transitional close (§18); (c) no journal writes to both a legacy
  channel account and 1040 for the same business event in normal flow;
  (d) 1030/1100/2000/4000/6210 are never part of TotalFunds.
- Transitional close adds exactly +24,000 to 1040 once (§18), with no
  counterpart in the legacy list → aggregate rises by exactly the closed
  exposure, once.
- Presentation: one useful aggregate total (Dashboard), no channel breakdown
  (D2/D12); historical channel balances remain visible to accounting and
  total-funds math but are not offered as selectable/live money.

## 13. Transaction / Dashboard / Finance Reader Contract

| Reader | Frozen contract | Adaptation required |
| --- | --- | --- |
| Transaction history (list + U4/U5 detail, `97B`) | ONE understandable business transaction per operator action: one Order header (Sales), one tabops row (Expense), one PurchaseEvent row (Purchase). Ledger/journal rows, money legs, clearing, and recognition internals are NEVER presented as separate transactions or second legs. No payment/settlement status workflow shown for single-commit transactions. | None for Sales (money leg invisible by construction). Expense/Purchase detail read models must render the single business row without exposing journal internals (D15). |
| Dashboard tiles | Correct Revenue (U3), Expense, Purchase, Operational Funds (= §12 aggregate), no channel breakdown. | Presentation-level aggregation over §12; no writer change. |
| P&L (`36:buildFinanceProfitAndLoss`) | U3 canonical Revenue + Policy C expense/purchase amounts; NO COGS/gross-profit resurrection (Policy C prospective regime stays NON_POSTING for HPP). | None (amounts identical). |
| Balance Position / cash balance (`40:buildCashBalanceReadModel`, Finance foundation) | 1040 shown as Asset; historical monetary accounts preserved; TotalFunds = §12, mathematically correct. | Extend account enumeration to `AGGREGATE_MONEY_ACCOUNT_CODES` (legacy + 1040); keep legacy rows visible, aggregate line added. |
| Cash Flow (`36:buildCashFlowStatement`, `36:72-169`) | Each normal single-commit appears exactly ONCE by substance (§14). | `cashAccountCodes` extended + composition classification rule (§14). |
| Treasury T5 clearing (`99B`) | Composed Sales clears own exposure at Save; exceptions detectable; global unexplained residual = 0 healthy. | Count composed money Cr1030 as clearing; status rules adapted (§15). |
| Finance validators (`36` readiness/production gates, `validateFinanceProductionRuntime`) | Must accept and require 1040 when single-commit config is ACTIVE; PREPARED state must not require it. | Account metadata gate extended at activation (§20/§24). |
| CapitalEquity (`38`) | Unchanged. | None. |

Finance remains derived/read-only; no Finance writer is introduced.

## 14. Cash Flow Anti-Double-Count (frozen rules)

Current mechanics (`36:72-139`): journals grouped by JournalID; a journal counts
only if it touches `cashAccountCodes` (`36:73` = `["1000","1010","1020"]`
today); classification = counterpart accounts' `CashFlowGroup`
(`36:104-112`), else `ambiguous` (`UNCLASSIFIED_COUNTERPART`).

Frozen prospective rules (activation-gated):

1. `cashAccountCodes := ["1000","1010","1020","1040"]` in
   `buildCashFlowStatement` (`36:73`) AND in the opening-cash sum
   (`36:155`) — 1040 opening starts at 0, so pre-activation outputs are
   unchanged (mechanical list extension only).
2. **Exactly-once per single-commit:** a normal Sale contributes via its money
   journal only (`SRV2M-…`: Dr1040/Cr1030) — the recognition journal
   (Dr1030/Cr4000) touches no money account and is skipped by rule "no cash
   line → not counted". Expense/Purchase journals touch 1040 exactly once each.
   Historical settlements on 1000/1010/1020 count exactly once each, as today.
3. **Composition classification (D11):** when a journal's cash line is 1040 and
   every counterpart line lacks a `CashFlowGroup` (counterparts are 1030
   clearing), classify by composition: cash line 1040 debit → Operating inflow;
   cash line 1040 credit → Operating outflow. 1030 is NEVER required to carry
   CashFlowGroup (D11). Composition classification applies ONLY when the
   journal has a 1040 line; all other journals keep today's counterpart-group
   rule; anything still unresolvable stays `ambiguous` (fail-visible, no silent
   guessing).
4. Direction: Sales composed inflow Operating (+); Expense outflow (−);
   Purchase outflow (−); transitional close (§18) inflow Operating (+), counted
   once, action date.
5. Internal clearing legs can never double-count: 1030 lines are never money
   lines; a Cr1030 without a 1040/legacy money line in the same journal is not
   a cash movement at all.
6. Investing/Financing: out of scope for this contract (D11 tail).

## 15. T5 / 1030 Reconciliation (frozen adaptation)

Current mechanics: exposure `cleared` = net TreasuryReceipts bound to the
recognition (`99B:757-805`), status `CLEARED` requires `cleared == recognized`
AND ≥1 ordinary receipt (`99B:845-847`); global residual
`LedgerNet1030 − OutstandingTotal − ExplicitExceptionAmount == 0` (`99B:1110`).
Groups keyed `(SourceType, SourceID)` with expectations from receipts/events
(`99B:1051-1105`).

Frozen prospective rules:

1. **Composed clearing counts:** active BalanceLedger lines with SourceType
   `SALES_MONEY_V2` (Credit to 1030, bound SourceID = RecognitionID) count as
   clearing for that exposure: `cleared := treasuryReceiptNet + composedNet`
   (composed reversal lines Dr1030 subtract accordingly).
2. **Status:** an exposure with `composedNet == recognizedAmount` and no
   receipt/exception conflicts is `CLEARED` without requiring
   `ActiveReceiptCount ≥ 1` (the receipt-identity clause is relaxed ONLY for
   composed-cleared rows; receipt-based rows keep every existing rule).
   `UNCLEARED`/`EXCEPTION`/voided paths and all quality codes are retained.
3. **Reconciliation expectation:** a `(SALES_MONEY_V2, SourceID)` group's
   expected 1030 net = **negative of the expected 1030 net of the
   (`SALES_RECOGNITION_V2`, same SourceID) group** (recognition +amount ⇒
   money −amount; void reversal −amount ⇒ money reversal +amount). Group net
   minus expected = 0 ⇒ never an explicit exception, residual contribution 0.
   The recognition group keeps its existing expectation untouched.
4. **Per-sale invariant:** after every normal Sale DONE, that sale's 1030
   lifecycle net = 0 (Dr from recognition, Cr from money leg). Global
   `LedgerNet1030` = sum of un-cleared historical/legacy exposures only;
   `unexplainedResidual` stays 0 (healthy), same `RECONCILIATION_STATUS` gates.
5. **Transitional close (§18):** SourceType `TRANSITIONAL_CLEARING_CLOSE`,
   SourceID = `SCR-CE122B27-ORD677BE5CES`, expected net = −24,000 against that
   exposure's recognized +24,000 ⇒ exposure CLEARED, residual still 0, movement
   visible as an explicit auditable exception-class entry (never unexplained).
6. Ledger-group checks (`99B:620-640` orphan handling, receipt-source-set
   membership) must treat `SALES_MONEY_V2` and `TRANSITIONAL_CLEARING_CLOSE`
   as known writer identities (not orphan movements).

## 16. Treasury: Retained / Adapted / Bypassed / Deprecated

| Element | Verdict (frozen) | Basis |
| --- | --- | --- |
| Durable core envelope (normalize → lookup → plan → intent → one batch → readback → COMMITTED → DONE) | **RETAIN — adopted as THE protocol** (§6) | D6; proven by U2/T4/T6 |
| Outer lock + DONE/REFUSED/CONFLICT/UNKNOWN/RECOVERY_REQUIRED | **RETAIN** | D6 |
| RequestKey/idempotency/resume-from-plan | **RETAIN** | D6 |
| Journal signature + audit rows + digests | **RETAIN** | D6 |
| T6 reversal/correction infrastructure | **RETAIN** (genuine corrections) | D14 |
| T8/T9/T10.5 activation governance discipline | **RETAIN** (applies to §21) | D6 |
| T5 clearing projection + residual gate | **ADAPT** per §15 | D5/D6 |
| T4 exact-clearing exposure targeting | **RETAIN for exceptions only**; normal flow clears inside Save | D3/D6 |
| MANUAL_VERIFIED + mandatory `evidenceRef` (`99:23`, `99A:148-158`) | **NORMAL_FLOW_BYPASS; DEPRECATE_PROSPECTIVELY for normal flow; KEEP for exception/diagnostic** | D3/D6 |
| Destination account selection / T7 picker | **NORMAL_FLOW_BYPASS; DEPRECATE_PROSPECTIVELY** (backend derives 1040) | D1/D2/D15 |
| Operator receipt model (open Treasury → pick exposure → enter receipt) | **NORMAL_FLOW_BYPASS; KEEP for exception diagnostics only** | D3/D6 |
| T4-as-delegate-nested-inside-U2 | **REJECTED permanently** (independent lock/RequestKey/lifecycle; D6) | D6 |
| Composed-money representation (D6 freeze) | **DEDICATED composed-money representation: BalanceLedger journal pair inside the domain plan/batch — NOT TreasuryReceipts rows, NOT Treasury event concepts** | Justification: (a) authority clarity — one authority (the domain save core) owns the entire transaction; no second schema, second RequestKey namespace, second lifecycle, or second reader contract to reconcile; (b) durability — the money leg gets the same atomic batch, plan digest, signature, and artifact verification as every other row, so it is either fully present or absent; TreasuryReceipts would import mandatory evidenceRef/MANUAL_VERIFIED/destination semantics that directly contradict D1/D2/D3 and would force a T4-shaped second step; (c) T5 adapts deterministically (§15) without importing receipt-authority concepts into normal flow. |

## 17. Minimum Input Matrix (frozen)

Legend: REQUIRED_BUSINESS_FACT (operator enters) · BACKEND_DERIVED ·
REMOVE_FROM_NORMAL_FLOW (must no longer be requested) · OPTIONAL_METADATA.

**Sales (V2, already compliant — unchanged):**

| Input | Classification | Source |
| --- | --- | --- |
| Product → productVariantID (Hot/Cold) | REQUIRED_BUSINESS_FACT | `195:208-211` |
| Qty | REQUIRED_BUSINESS_FACT | `195:229-237` |
| orderType (DINE_IN/TAKE_AWAY) | REQUIRED_BUSINESS_FACT (business metadata, D10) | `195` payload |
| requestKey | BACKEND/CLIENT technical identity (never typed, D15) | `195:233` |
| money account, payment method, destination, evidence | never requested (already true) | `97A` path |

**Expense:**

| Input | Classification | Source |
| --- | --- | --- |
| Expense item (ID_Ops) — category/type | REQUIRED_BUSINESS_FACT (drives backend AccountCode mapping, D7) | `21:321-323` |
| Amount | REQUIRED_BUSINESS_FACT | `21:342-350` |
| Date (expenseDate) | OPTIONAL_METADATA — only for legitimate operator-controlled historical entry; defaults to now (source supports optional `expenseDate`, `21:346-350`) | source-proven |
| Description | OPTIONAL client note — NOT persisted (no tabops column; server drops it today, `95A:408-411` + readiness test `96.Readiness:335`); no schema column invented | source-proven |
| Cash account radio (1000/1010/1020) / paidVia | **REMOVE_FROM_NORMAL_FLOW** (backend derives 1040) | D1/D2/D7 |
| ReceiptID/RecognitionID/OperationID/RequestKey/journal/signature/account codes | BACKEND_DERIVED, never asked | D15 |

**Purchase:**

| Input | Classification | Source |
| --- | --- | --- |
| Item/material (expenseItemID + policy route) | REQUIRED_BUSINESS_FACT | `46`, `47` |
| Qty + purchase UOM | REQUIRED_BUSINESS_FACT | `47:143-147` |
| Unit price / acquisition value (amount) | REQUIRED_BUSINESS_FACT | `47:148-150` |
| Date (purchaseDate/ExpenseDate) | REQUIRED for source-valid capture; OPTIONAL only where source already permits (receipt path default ReceiptDate := ExpenseDate, `47:139`) — legitimate business date, not payment timing (D4) | source-proven |
| SupplierID | OPTIONAL_METADATA — recorded when known; NEVER fails solely on absence (D9; supersedes today's `SUPPLIER_INACTIVE`-on-absence for normal flow) | D9 |
| Reference/description (ExternalRef, ExternalDocumentStatus, PackageIdentity, SupplierRef, SupplierSource, Attested) | OPTIONAL/evidence metadata exactly as source already requires for the receipt path (`47:151-155`); unchanged semantics | source-proven |
| paidVia / paymentStatus / cashAccountCode / destination | **REMOVE_FROM_NORMAL_FLOW** (backend writes PaymentStatus=PAID, CashAccountCode=1040 — paid-at-Save) | D1/D2/D4/D8 |
| requestKey | technical identity (client, never typed) | `47:112` |

No field outside these tables is invented for any domain.

## 18. Transitional 24,000 Closure Contract (FROZEN — NOT EXECUTED)

Facts (prior accepted production evidence, not re-probed): exposure
`SCR-CE122B27-ORD677BE5CES` recognized 24,000 (Dr1030 via U2), no genuine
receipt, T5 UNCLEARED, LedgerNet1030 Dr 24,000, residual 0. Owner facts: sale
real, Rp24,000 received, part of that same sale, no external receipt evidence
exists (D13).

Frozen operation (to run in a future, separately authorized unit — ZERO
execution in T11.2):

| Field | Value |
| --- | --- |
| OperationType | `TRANSITIONAL_CLEARING_CLOSE` (TransactionOperations intent, one-time RequestKey) |
| Batch | ONE atomic `spreadsheets.batchUpdate`: BalanceLedger 2 rows + Logs 1 audit row |
| Journal | JournalID `TRCC-<RecognitionID>`; line1: AccountCode `1040`, Debit 24000, Credit 0; line2: AccountCode `1030`, Debit 0, Credit 24000 |
| MovementType / SourceType | `TRANSITIONAL_CLEARING_CLOSE` / `TRANSITIONAL_CLEARING_CLOSE` |
| SourceID | `SCR-CE122B27-ORD677BE5CES` |
| Tanggal / EconomicDate | action date of the future authorized execution (original periods never rewritten) |
| Evidence | owner attestation recorded in the audit row metadata (this contract §18 + D13 + active task authorization) = sufficient internal evidence; **NO fabricated EvidenceRef, NO TreasuryReceipts row** |
| Preconditions | T5 adaptation (§15) live; 1040 exists per §11; exposure still UNCLEARED at exactly 24,000; residual 0 pre-state; config ACTIVE |
| Idempotency | one RequestKey; replay returns stored outcome; refusal if exposure already cleared or amount mismatched |
| Post-state | exposure CLEARED (exception-class, visible); LedgerNet1030 = 0; residual 0; TotalFunds +24,000 exactly once (§12) |
| Rejected alternatives | fabricated Treasury receipt with invented evidenceRef; leaving exposure UNCLEARED forever; making this a normal workflow |

## 19. Historical Compatibility

- Append-only everywhere: tabsal/tabops, Settlements, BalanceLedger, Orders,
  OrderLines, SalesRecognitionEvents, PurchaseEvents, TreasuryReceipts — never
  rewritten (T11.1 §15).
- 1000/1010/1020 balances stay real and visible; legacy channel settlement
  writers (W3/W5/W11/W12) keep their authority for historical/exception flows;
  no historical Sales/Payment/Settlement/AP/PurchaseEvent/Expense/Policy C
  evidence is altered.
- Pre-V2 sales cohort guards (`97D`) unchanged; Policy C transition-date regime
  split (`39:resolvePolicyCAccountingRegime_`) unchanged.
- Prospective activation is config-gated (`SINGLE_COMMIT_TRANSACTION_V1`,
  §20): PREPARED default ⇒ byte-identical behavior until authorized activation
  (mirrors Sales V2 U7 / Treasury T10.5 discipline).
- Normal-flow input removals (cash radio, paidVia, paymentStatus choice) apply
  only to NEW transactions after activation; historical rows keep their stored
  values.

## 20. Schema / Config / Migration Requirements (exact)

Schema (all existing sheets — header-stable, no new sheets, no column drops):

1. Accounts: +1 row exactly per §11 (additive only; no header change).
2. All plan/batch surfaces (§8): zero header changes; new rows only use
   existing headers.
3. No sheet creation, no column rename, no data migration, no backfill.

Config (new, ScriptProperties, `97D:30-50` fail-closed pattern):

- Key: `SINGLE_COMMIT_TRANSACTION_V1` JSON:
  `{ mode: "PREPARED"|"ACTIVE"|"PAUSED"|"REJECT", configVersion, activationID?, activatedAt? }`.
- Default when absent = PREPARED (zero behavior change; new cores refuse with
  zero writes). Invalid JSON/mode → unresolved → REJECT (never fallback,
  never legacy re-enable).

Code-level enumerations changed at implementation time (mechanical, listed for
auditability):

- `36:73` and `36:155`: `cashAccountCodes` + `"1040"`.
- `40:606` `buildCashBalanceReadModel`: iterate `AGGREGATE_MONEY_ACCOUNT_CODES`
  (legacy ∪ 1040); presentations add aggregate line (§12).
- Treasury T5: §15 rules (`99B` known-writer identities + composed clearing +
  expectation rule).
- Finance readiness/production gates: require 1040 metadata when config ACTIVE.
- New constants: composed-money writer identities (§3/§4/§5), new
  OPERATION_TYPEs (§9), `SINGLE_COMMIT_MONEY_POLICY` (accounts + metadata per §11).
- `CASH_FOUNDATION_POLICY.ACCOUNT_CODES` NOT modified (§11).
- UI: remove cash-account radio / paidVia / paymentStatus controls from normal
  flows; Sales V2 UI already compliant.

## 21. Deployment / Activation Sequence (frozen order)

Each step is a separate bounded unit with its own gate; no step may run
without its own task authorization. `clasp push` is R4 and outside this
contract's execution entirely.

1. **Implementation units** (§26 U1–U6): code lands PREPARED/disabled defaults;
   full local regression green; ZERO runtime behavior change.
2. **Local evidence commit** for T11.2 doc (this unit) and per-unit commits
   (numlock-commit, explicit paths only).
3. **Authorized upload** (`clasp push --force`, R4 + human gate, separate task;
   upload manifest gate per AGENTS.md) — not part of T11.2.
4. **Accounts 1040 creation** (separate authorized mutation unit): preflight
   uniqueness/metadata → write row §11 → exact readback evidence.
5. **Reader/T5 adaptations** verified live in read-only diagnostics (§24
   pre-activation checks): Cash Flow/Balance/T5 outputs byte-identical while
   PREPARED (1040 balance 0 / absent).
6. **Config activation** PREPARED → ACTIVE (separate authorized unit;
   activation evidence recorded like T10.5: ActivationID, configVersion,
   activatedAt, readback).
7. **First-production acceptance** (§24) via authorized read-only diagnostics.
8. **Transitional 24,000 closure** (§18) — separate explicit authorization,
   after steps 4–6.
9. Legacy-path retirement/deprecation (optional later unit; W3/W5 legacy
   writers stay for history regardless).

Fail-closed at every step: missing account, invalid config, schema mismatch →
REFUSED with zero writes.

## 22. Rollback / Fail-Closed

- **Behavioral rollback = config flip** `ACTIVE → PAUSED` (new saves refuse
  fail-closed) or `→ PREPARED` (new cores inert). No code re-deploy required
  for PAUSE. Already-committed single-commit transactions remain valid,
  append-only history — NEVER rolled back, never rewritten.
- **Data rollback does not exist**: no deletion, no ledger unpost, no history
  mutation. Errors are corrected only via §10 signed correction/void.
- **Atomicity rollback**: batch is all-or-none; intent IN_PROGRESS + missing
  artifacts → resume from stored plan or `RECOVERY_REQUIRED` (human/diagnostic
  gated, no autonomous retry loops, mutation budget respected).
- **Partial-failure matrix**: preflight fail → REFUSED 0 writes; intent fail →
  UNKNOWN with requestKey retained, no batch issued; batch unknown → UNKNOWN,
  artifact inspection decides; artifact mismatch → RECOVERY_REQUIRED (no
  second batch); COMMITTED readback fail → UNKNOWN/RECOVERY_REQUIRED, operation
  row is authority.
- **Activation rollback after acceptance**: same config flip; readers remain
  dual-eras safe (legacy + composed rows coexist; §14/§15 handle both).
- No second `clasp push` for count reconciliation (AGENTS Rule 7); no autonomous
  mutation retry; infrastructure failures → `BLOCKED_*`, never escalation.

## 23. Test Matrix

Baseline (MEASURED this unit): `node _test_runner.js` → **181 PASS / 0 FAIL**
(read-only, synthetic fixtures, no production access).

Required coverage per implementation unit (local, read-only/synthetic; each
unit adds its cases to the harness before any activation):

| Area | Required checks |
| --- | --- |
| Sales money leg | plan contains 4 ledger rows; recognition rows byte-identical to baseline; money pair signature/derivations; per-sale 1030 net 0 at DONE; net = Dr1040/Cr4000 |
| Sales PREPARED neutrality | config absent → save output byte-identical to baseline (181 parity) |
| Expense core | ONE batch [tabops, ledger(2), Logs]; no Settlements write; no `accountingPending`/`SETTLEMENT_PENDING` possible; account mapping refusal; date/idempotency/replay/UNKNOWN envelopes |
| Purchase core | ONE batch [PurchaseEvents, ledger(2), Logs]; AccountingStatus=POSTED in append; SupplierID absence accepted (D9); paidVia/paymentStatus fields refused; legacy UNPAID/AP path intact |
| Idempotency/recovery | same-key replay, payload-hash CONFLICT, IN_PROGRESS resume, lock-busy REFUSED, artifact mismatch → RECOVERY_REQUIRED (all three domains) |
| Corrections | signed reversal incl. 1040 effect for Sales void/correct, Expense void/correct, Purchase void/correct; 1030 net 0 through lifecycle; no 2010 writer |
| Readers | Cash Flow counts each single-commit exactly once, composition → Operating, ambiguous stays visible; Balance/aggregate math (no double-count); P&L/U3 unchanged |
| T5 | composed-cleared exposure = CLEARED without receipt; residual 0 with composed legs; transitional-close fixture row CLEARED + residual 0 (synthetic only); receipt-based rules unchanged |
| 1040 preflight | missing/inactive/mismatched 1040 → REFUSED zero writes; exact metadata match accepted |
| Historical compatibility | legacy fixtures (settlements, AP, pre-V2 sales) byte-stable |
| Minimum input | channel/payment fields refused on normal flow (D1–D3); Sales inputs unchanged |

Contract harness (this unit): optional non-runtime doc-consistency check only;
no runtime behavior touched; excluded from any package.

## 24. Production Acceptance Gates (first-production criteria)

All must hold before normal operation is declared single-commit:

1. Config `SINGLE_COMMIT_TRANSACTION_V1` ACTIVE with activation evidence
   (ActivationID/configVersion/activatedAt readback) — or PREPARED with proof
   of zero behavior change if activation not yet performed.
2. Accounts 1040 row readback exactly matches §11; uniqueness = 1.
3. One normal Sale → DONE in one batch; artifacts = 5 surfaces; that sale's
   1030 lifecycle net = 0; T5 exposure CLEARED at Save; global residual = 0.
4. One normal Expense → DONE; exactly one batch; zero Settlements rows for it;
   zero SETTLEMENT_PENDING logs.
5. One normal Purchase → DONE; single batch; AccountingStatus POSTED in append;
   Dr6210/Cr1040 present; SupplierID absent accepted.
6. Cash Flow: each of the three transactions appears exactly ONCE, classified
   Operating; ambiguous list unchanged from pre-activation for legacy journals.
7. Balance Position/Dashboard: TotalFunds = §12; no channel breakdown; P&L
   revenue still U3 canonical.
8. Corrections (one Sales, one Expense or Purchase) reverse the full original
   consequence including the 1040 effect; no Treasury step available or needed.
9. Operator UI for all three domains shows no payment/channel/destination/
   settlement controls; Save → DONE ends the workflow (D3/D15).
10. Full local regression ≥ 181 PASS / 0 FAIL on the deployed source;
    read-only production diagnostics (`validateFinanceProductionRuntime`,
    `runCashProductionDiagnostic`, T5 clearing projection) report expected
    states through the authorized bounded-read commands only.
11. Historical rows/ledger untouched: byte-level no-diff on legacy fixtures and
    production historical counts unchanged.

## 25. OUT OF SCOPE (must NOT be introduced by this contract or its units)

- Channel tracking / channel selection UI / channel-level balances for new
  normal transactions.
- Fake `PaymentMethod=CASH` or any default channel stamp.
- Paid/Unpaid lifecycle, ordinary AR, pay-before/pay-after modeling.
- Routine operational AP (2000 credit only where existing authority already
  requires genuine supplier credit).
- Post-Save payment verification, Receive Payment, Settlement confirm, routine
  Treasury open, EvidenceRef for normal transactions, destination selection.
- Inventory authority / recipe auto-consumption / HPP (Dr5000/Cr1100)
  resurrection / InventoryLedger movements from T11 flows.
- Automatic 2010 refunds or customer credits.
- RBAC.
- Historical rewrites/backfills; production financial execution in this unit;
  transitional 24k execution in this unit; `clasp push`/deploy/config mutation;
  account creation in this unit.

## 26. Proposed Implementation-Unit Decomposition (ordered, bounded)

| Unit | Scope (bounded) | Primary files (proposed) | Gate |
| --- | --- | --- | --- |
| U0 | This contract doc + local evidence (current unit) | `docs/T11-2-…md` | regression 181/0 + doc checks |
| U1 | Sales money leg: plan/batch/verification extension, PREPARED-gated, money identities + tests | `97A`, `97C`, `97`, tests | regression green; PREPARED parity byte-identical |
| U2 | Expense durable single-commit core + dispatcher field-allowlist change + UI input trim (cash radio/paidVia removed) | `21`, new expense save core module or `21` extension, `194`/`195` | no accountingPending path exists; regression green |
| U3 | Purchase single-commit core (event+ledger+status one batch) + payment-field removal + SupplierID optional + both adapters converge | `47`, `39`, `95A`, `195` | regression green; legacy UNPAID/AP tests intact |
| U4 | T5 adaptation (§15) + Cash Flow/Balance/aggregate reader extensions (§12/§14) + Finance validator gate | `99B`, `36`, `40` | residual 0 + exactly-once tests green; PREPARED outputs unchanged |
| U5 | Config `SINGLE_COMMIT_TRANSACTION_V1` + activation/preflight plumbing + 1040 account preflight (read-only until authorized) | config module, `97D`-style guard | PREPARED default proven inert |
| U6 | Corrections/void/cancel single-commit semantics per §10 + tests | `97C`, `21`/`22` lifecycle, `47`, `39` | full-reversal incl. 1040 tests green |
| U7 | Accounts 1040 creation (authorized mutation unit, §11) | Accounts sheet (production) | readback exact match §11 |
| U8 | Config activation PREPARED→ACTIVE (authorized) + activation evidence | ScriptProperties (production) | T10.5-style evidence captured |
| U9 | First-production acceptance (§24) via authorized read-only diagnostics | read-only diagnostics | all §24 gates |
| U10 | Transitional 24,000 closure (authorized execution of §18) | one-time op | exposure CLEARED, residual 0 |

Units U1–U6 are local implementation + test only (PREPARED/inert until U8).
U7–U10 each require separate explicit authorization; none is executed by this
contract freeze.

---

DISCOVERY/DESIGN COMPLETE. CONTRACT FROZEN. OPEN_OWNER_DECISIONS: NONE.
ZERO runtime implementation · ZERO production writes · ZERO deploys/pushes ·
ZERO config mutations · ZERO business/financial events this unit.
