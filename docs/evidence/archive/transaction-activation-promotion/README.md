# Transaction Activation Promotion Attempt

Status: ACCEPTANCE_FAILED. Recorded 2026-10-06.

## Scope and identity

- Task: `NUMLOCK-G14-PROMOTION-20261006-C`
- Source HEAD: `b0e3d38b97f8905c71c9c7bd50ea4d0bcf97968e`
- Candidate version: 700
- Previous canonical version: 693
- Canonical deployment: `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q`
- Promotion result: `Redeployed AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q @700`
- Canonical URL returned HTTP 200 after promotion.
- Owner-text ID omitted the `_` after `Asy`. Two independent fresh inventories identified exactly one canonical @693 deployment with the `_`. Corrected owner authorization resolved the transcription variance in favor of that live-inventory ID.

## Evidence classification

### MEASURED in this task

- Baseline and pre-mutation inventory: seven deployments; corrected canonical ID @693; candidate ID @700; @HEAD present.
- Worktree: clean at baseline.
- Pre-promotion diagnostic: `readOnly=true`; `writeCount=0`; ProductVariants=53; RecipeVersions=53; RecipeVersionLines=410; Orders=0; OrderLines=0; Payments=0; TransactionOperations=0; Suppliers absent with `READY_CREATE`; Finance preimage, operation persistence, purchase and expense readiness true.
- Manifest gate: `clasp status`; 62 tracked production files, including `appsscript.json`; no diagnostic runner/endpoint, temporary evidence, or secret in upload set. No push performed.
- Promotion: one canonical deployment update, 693 to 700. No deployment creation.
- Pin verification: same canonical deployment ID @700. Canonical URL HTTP 200.
- Canonical Gate 13 probe: committed `tests/browser/transaction-entry-v697-probe.js`, unmodified.
  - Probe RPC: `SUCCESS_TRUE`
  - Authority counts: products=34, productVariants=53, suppliers=0, purchaseItems=20, expenseItems=9, items=22, conversions=22, paymentMethods=3
  - Application authority applied: false
  - Browser classification: `PROBE_RPC_SUCCESS_APPLICATION_NOT_APPLIED`
  - Assertions: A PASS; B PASS; C NOT_MEASURABLE; D NOT_MEASURABLE; E NOT_MEASURABLE; F FAIL; G FAIL; H FAIL; I FAIL; J FAIL; K PASS; L PASS
  - Totals: 12 total, 4 PASS, 5 FAIL, 3 NOT_MEASURABLE
  - Page errors: []
  - Console errors: []
- Production business writes: 0.
- Supplier writes: 0.
- Inventory writes: 0.
- Canonical deployment mutations: 1.
- Clasp pushes, new versions, new deployments: 0.

### FROZEN prior evidence

- Candidate Gate 13: 12/0/0, `SUCCESS_TRUE`, Transaction 8/8, Finance 9/9.
- Version 700 creation and prior 62-file push from source HEAD were supplied frozen evidence; not repeated.

### STATIC / CONSOLIDATED

- Gate numbering: repository has no numbered `GATE_1..14` ladder. `docs/roadmaps/NUMLOCK-IMPLEMENTATION-ROADMAP.md` defines 14 phases plus Acceptance Gates. Task Gate 13 approximates roadmap Phase 12 E2E plus Phase 13 preflight inputs. Task Gate 14 approximates roadmap Phase 13 Production Rollout.
- Role/Permission: `SUPERSEDED_NOT_REQUIRED`; no RBAC.

## Stop and preservation

Canonical acceptance failed. Per hard stop: Transaction runtime, Finance runtime, smoke, client repair marker checks, post-promotion preflight, and all deployment cleanup were not run. Canonical remains @700. Candidate and @696-@699 remain. No retry, source repair, second canonical update, deletion, push, version, or deployment occurred.

## Verdict

- Result: `ACCEPTANCE_FAILED`
- Gate 14: FAIL
- Transaction activation: INCOMPLETE
- Ready for normal operation: FALSE
- Scope remains Transaction Activation/Production Rollout only. Supplier activation remains separately governed. InventoryReceipt/Ledger remain dormant. No RBAC.

## Corrected-measurement closeout

Status: ACCEPTED. Recorded 2026-10-06. The original acceptance record above remains chronological evidence; its verdict is `SUPERSEDED_BY_CORRECTED_MEASUREMENT`, not erased or rewritten.

### MEASURED closeout evidence

- Lineage: baseline/evidence HEAD `ef9fc6e828c1bb49a7d2d21121807efe797848bc`; probe-repair commit `0852b8a9a3bf1eada5e7bd37b57a4a3945fa8ac4`.
- Probe sequencing repair validation: 12/12 focused contract checks; syntax and diff checks passed. Application observation now terminates independently at READY with applied authority, explicit UNAVAILABLE with reason, or the established 90-second timeout.
- Pre-reacceptance production diagnostic: `readOnly=true`; `writeCount=0`; Orders=0; OrderLines=0; Payments=0; TransactionOperations=0; schema plan `ALREADY_READY`; ProductVariants=53; RecipeVersions=53; RecipeVersionLines=410; Suppliers absent with `READY_CREATE`.
- Corrected canonical Gate 13 acceptance against canonical @700:
  - Probe RPC: `SUCCESS_TRUE`; independent probe latency 4423 ms.
  - Application terminal: `READY`; authority applied true; independent application-ready latency 6158 ms; reason null.
  - Authority counts: products=34, productVariants=53, suppliers=0, purchaseItems=20, expenseItems=9, items=22, conversions=22, paymentMethods=3.
  - Assertions A-L: 12 PASS, 0 FAIL, 0 NOT_MEASURABLE. C/D/E measured through the active Sales path.
  - Page errors: []; console errors: [].
- Canonical runtime: Transaction 8/8 PASS; Finance 9/9 PASS; smoke PASS. Served repair markers remained present through corrected Gate 13 client execution.
- Post-acceptance production diagnostic: `readOnly=true`; `writeCount=0`; Orders=0; OrderLines=0; Payments=0; TransactionOperations=0; no business, Supplier, or Inventory writes.
- Deployment cleanup: deployment objects @696, @697, @698, @699, then candidate @700 deleted once each. Versions were not deleted.
- Final deployment inventory: exactly canonical deployment `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` @700 and @HEAD deployment `AKfycbyK_7u3OT3tBNVeqEnRwI6sz7GIPlht6hFht8wYp7A`.

### FROZEN and diagnostic evidence

- FROZEN: original candidate v700 acceptance remains 12/0/0 with `SUCCESS_TRUE`, Transaction 8/8, and Finance 9/9.
- FROZEN: original canonical acceptance failure remains recorded above as 4 PASS, 5 FAIL, 3 NOT_MEASURABLE with probe success but application-not-applied observation.
- DIAGNOSTIC: `MEASUREMENT_WINDOW_RACE_CONFIRMED` at high confidence. Served-client parity matched with FNV `a7c19f25`; candidate and canonical each reached READY 3/3 under one alternating harness; application RPC dispatched and succeeded 3/3 for each; no stable deployment-context divergence existed.
- `SOURCE_REPAIR_REQUIRED=NO`.
- `DEPLOYMENT_REPAIR_REQUIRED=NO`.
- `PROBE_REPAIR_REQUIRED=YES_COMPLETED`.
- Measurement was repaired, not the application.
- Gate-numbering offset remains as documented above. Role/Permission remains `SUPERSEDED_NOT_REQUIRED`.

### Final closeout verdict

- Gate 13 canonical: PASS.
- Gate 14: PASS.
- Transaction activation: COMPLETE.
- Ready for normal operation: TRUE.

## Sales operator first-entry recovery closeout

Status: ACCEPTED. Recorded 2026-10-06. Task lineage: `NUMLOCK-703-TIMELINE-20261006` and `NUMLOCK-703-EVIDENCE-20261006`. This segment extends the chronology without changing any prior failure, corrected-measurement, or closeout record above.

### Classification chronology

- **MEASURED — PRODUCT DEFECT:** The @702-era first-entry Open Orders failure was `RPC_TRIGGER_DEFECT`. Sales entry while authority was `LOADING` reached `operationalServerCall`, which synchronously refused with `AUTHORITY_UNAVAILABLE`; the empty refusal handler swallowed that result, and no READY transition retriggered the request. Server control returned authoritative `PASS_EMPTY`; ready-state rendering was healthy. The defect was client trigger timing, not the server result or empty-state renderer.
- **STATIC — PRODUCT DEFECT REPAIR:** Commit `cd18be5a9aa3fb1eb96c3e050eedc9717f50703a` (`sales: defer open orders recovery until authority ready`) introduced `pendingOpenOrdersRecovery`. The READY hook at `195.View.Transactions.Actions.html:39-42` clears the pending flag before dispatch and consumes it once. Terminal authority-unavailable handling also clears it. `operationalServerCall` remained unchanged.
- **MEASURED — ACCEPTED PRODUCT BEHAVIOR:** Local post-repair suites passed 8/8, 30/30, 33/33, and 39/39.
- **FROZEN — ACCEPTED PRODUCT BEHAVIOR:** Candidate preparation pushed 62 files successfully, created version 703, then created immutable candidate deployment `AKfycbzHkmwJmUHToomHcmLAJOwj4BPk-1IUdzO506C58dOwi3nrqDhJkg7DqVUy25QG1DGZ` pinned at @703.
- **MEASURED — HARNESS DEFECT:** The initial @703 first-entry proof timed out with incomplete observability. That timeout was inconclusive and is not classified or rewritten as a product failure. No blocked attempt was rewritten.
- **STATIC — PROBE DRIFT:** Earlier probe sequencing/measurement drift remains preserved in the corrected-measurement record above. It is separate from the @702 product defect and from the incomplete-observability @703 harness timeout.

### Focused @703 timeline diagnostic

- **MEASURED — ACCEPTED PRODUCT BEHAVIOR:** Fresh page; no pre-wait for READY; one normal first Sales entry; no second Sales click, manual Open Orders refresh, reload, or harness-triggered RPC.
- `PAGE_READY_MS=2870`; `SALES_ENTRY_MS=4555`; `AUTHORITY_LOADING_MS=1069.8`; `PENDING_RECOVERY_SET_MS=1130.2`; `AUTHORITY_READY_MS=7890.7`; `PENDING_RECOVERY_CONSUMED_MS=7890.7`; `OPEN_ORDERS_RPC_DISPATCH_MS=7883.4`; `OPEN_ORDERS_RPC_SETTLED_MS=11244.4`; `OPEN_ORDERS_RENDER_MS=11244.9`.
- `OPEN_ORDERS_RPC_COUNT=1`; result `{success:true,data:[]}`; final text `No open orders.`; page errors `[]`; console errors `[]`.
- `FIRST_ENTRY_CLASSIFICATION=PASS_REPAIR_CONFIRMED`.
- Server control returned `{success:true,data:[]}` with writes 0.

### Candidate acceptance and promotion

- **MEASURED — ACCEPTED PRODUCT BEHAVIOR:** Candidate @703 Gate 13 passed 12/0/0. Desktop acceptance passed, including first-entry Open Orders, Find Order, Payment gating, and Fulfillment gating without submission. T1-T8 passed; F1-F9 passed; smoke passed; errors were `[]`.
- **FROZEN — ACCEPTED PRODUCT BEHAVIOR:** Candidate mobile acceptance remained PASS from retained responsive-pattern evidence. It was not freshly re-measured in this closeout.
- **MEASURED:** Pre-promotion preflight passed with `readOnly=true`, `writeCount=0`, no schema actions or blockers, and Orders/OrderLines/Payments/TransactionOperations counts `0/0/0/0`.
- **MEASURED:** One canonical mutation updated the same canonical deployment object `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` from @702 to @703. No replacement canonical deployment was created.

### Canonical acceptance and invariance

- **MEASURED — ACCEPTED PRODUCT BEHAVIOR:** Fresh canonical first entry passed: `LOADING` → pending set → `READY` → pending consumed → exactly one automatic Open Orders RPC → authoritative `[]` → visible `No open orders.`. No application errors occurred.
- **MEASURED:** Canonical desktop acceptance passed. Items 1-10 were retained; item 11 passed through repaired first-entry behavior; items 12 and 13 passed; item 14 retained `LOCAL_TEST_CITED` evidence. Canonical Gate 13 passed 12/0/0; T1-T8, F1-F9, and smoke passed; errors were `[]`.
- **FROZEN:** Canonical mobile acceptance remained PASS from retained responsive-pattern evidence; it was not freshly re-measured.
- **MEASURED:** Post-promotion preflight passed with `readOnly=true`, `writeCount=0`, no schema actions or blockers. Counts remained invariant at `0/0/0/0`.

### Cleanup and final inventory

- **MEASURED:** Temporary deployment objects @701, the separate @702 candidate, and the @703 candidate were deleted, 3/3 with one attempt each. Versions 701, 702, and 703 were preserved.
- **MEASURED:** Final deployment inventory contains only canonical `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` @703 and @HEAD. `TEMPORARY_DEPLOYMENTS_REMAINING=0`; `UNEXPECTED_DEPLOYMENTS=0`.

### Sales operator verdict

- `CANONICAL_SALES_OPERATOR_ACCEPTANCE=PASS`
- `OPERATOR_BLOCKERS_REMAINING=0`
- `SALES_CANONICAL_SOURCE_READY=TRUE`
- `TRANSACTION_TECHNICAL_WORK=COMPLETE`
- `SALES_GO_LIVE_READY=FALSE_PENDING_OWNER_CUTOVER`

## First real sale, existing-order transport repair, and activation closeout

Status: ACCEPTED. Recorded 2026-10-06. This append-only segment preserves all earlier attempts, failures, corrected measurements, and closeouts above.

### First real sale chronology

- **MEASURED:** The first canonical Order was created once through the normal @703 UI: Order `ORD-D0D68C09-ORDERCREATEO`, server `CreatedAt=2026-10-06T18:50:05.328Z`, `TAKE_AWAY`, Matcha Latte / COLD / qty 2, OrderTotal 36000, HppTotalSnapshot 15130.58, initially `UNPAID + OPEN`. No Order retry or duplicate was created.
- **MEASURED:** The single Payment UI action initially returned UNKNOWN. Read-only reconciliation proved operation `TXOP-B3EEB322-PAYMENTPAYME` COMMITTED and Payment `PAY-B3EEB322-PAYMENTPAYME` SUCCESS for AccountCode/ReceiveVia 1010 (DANA Business), Amount 36000, PaidAt `2026-10-06T18:53:10.509Z`. The Order read back PAID. No Payment retry occurred.
- **MEASURED + STATIC:** Automatic Finance settlement passed: settlement `CSH-SAL-PAY-B3EEB322-PAYMENTPAYME`, journal `CASH-SALE_SETTLEMENT-PAY-B3EEB322-PAYMENTPAYME`, SourceType SALE_SETTLEMENT, Payment source correlation, Revenue 36000, HPP 15130.58, AccountCode 1010, POSTED. Settlement count remained exactly one; manual Finance writes were zero.
- **MEASURED:** The first fulfillment attempt timed out, then authoritative readback proved OPEN with all fulfillment timestamps empty; no mutation persisted and no blind retry occurred. A later diagnostic could not surface the existing Order in normal UI; no fulfillment action was dispatched and production remained PAID + OPEN.

### Existing-order lookup defect and repair

- **MEASURED — PRODUCT DEFECT:** Normal browser Find Order dispatched the exact scalar OrderNumber to `findOperationalOrder`, but reached the unknown callback while the same identifier returned the Order through authenticated CLI readback. The success handler was not reached, `operationalTransactionState.order` remained null, and fulfillment UI could not bind.
- **MEASURED + STATIC — ROOT CAUSE:** The first failing boundary was Apps Script browser response transport. Repository rows retained raw Date values; the DATE serialization hypothesis was CONFIRMED when a transport DTO converting Order and line values to client-safe primitives restored browser delivery. The repair commit was `e934c6c85707c8b253dbbbedea2425b6acd32988` (`sales: repair existing order lookup transport`), adding `transactionOperationalOrderTransportDto_` to `findOperationalOrder` without changing lookup identity or mutation behavior.
- **FROZEN local evidence:** focused and regression suites passed 10/10, 40/40, 30/30, 8/8, and 33/33; Finance PASS; syntax and diff checks PASS.
- **MEASURED delivery:** one successful 62-file push; immutable version 704; candidate `AKfycbwjLzf1CYQNehp5wn4DRsdo5xlSwauqZLdQxZsFF-MLk0LhzB2z29pnnsPQ57Gc63Ke` pinned @704.
- **MEASURED candidate acceptance:** Find Order returned a client-safe Order DTO with ISO timestamp strings, reached the success handler, populated active Order state, rendered PAID + OPEN, exposed fulfillment controls, and set next=PREPARING; page/console errors were empty. Gate 13 passed 12/0/0; T1-T8, F1-F9, and smoke passed.
- **MEASURED promotion:** the existing canonical deployment `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` moved once from @703 to @704. Canonical Find Order then passed with the same rendered PAID + OPEN state and actionable PREPARING control.

### Fulfillment and final readback

- **MEASURED:** OPEN → PREPARING persisted once; `PreparingAt=2026-10-06T19:36:00.503Z`.
- **MEASURED:** PREPARING → READY persisted once; `ReadyAt=2026-10-06T19:36:43.935Z`.
- **MEASURED:** READY → COMPLETED persisted once; `CompletedAt=2026-10-06T19:37:34.169Z`.
- **MEASURED + STATIC:** Final Order is PAID + COMPLETED; CLOSED is derived by contract, with no separate CLOSED mutation.
- **MEASURED:** Final counts are Orders 1, OrderLines 1, Payments 1, TransactionOperations 2, settlements 1. Deltas from the 0/0/0/0 transaction baseline are +1/+1/+1/+2. Fulfillment transitions did not create operation records. No duplicate business records were found; manual Finance, Supplier, and Inventory writes were zero.

### Cutover and historical closure

- `FIRST_REAL_SALE_ACCEPTANCE=PASS`
- `SALES_OPERATIONAL_CUTOVER_TIMESTAMP=2026-10-06T18:50:05.328Z` (`2026-10-07 01:50:05.328 +07:00`), defined by Order server CreatedAt, not fulfillment completion.
- `SALES_GO_LIVE_READY=TRUE`
- `SALES_OPERATIONAL_CUTOVER=COMPLETE`
- `PAPER_OPERATIONAL_AUTHORITY=CLOSED`
- `LEGACY_SALES_ENTRY_AUTHORITY=CLOSED`
- `TRANSACTION_ACTIVATION=COMPLETE`
- Historical period: start `2026-10-05`; end `2026-10-07 01:50:05.328 +07:00`; `OPTION_C_RECONCILED`; `OPEN_PAPER_ORDERS=0`; `REMAINING_UNRECORDED_REAL_SALES=0`. Source date 2026-10-05 remains provenance; owner recognition is 2026-10-07. No backfill or transferred-Sales modification occurred.
- **MEASURED cleanup:** the single temporary @704 candidate was deleted once. Final deployment inventory is canonical @704 plus @HEAD; temporary and unexpected deployments are zero.

---

## POST-ACTIVATION MAINTENANCE — Open Orders transport repair @705

Status: ACCEPTED. Recorded 2026-10-07. APPEND-ONLY maintenance entry; it does not rewrite, reorder, or alter any activation chronology above. `TRANSACTION_ACTIVATION=COMPLETE` and `SALES_GO_LIVE_READY=TRUE` remained true throughout; neither status was reopened.

### Defect and repair

- **MEASURED — post-activation risk:** After activation, Open Orders carried a non-empty transport risk: a non-empty response could fail browser transport the same way the earlier Find Order lookup did.
- **STATIC — non-empty proof:** Repository source proved the non-empty transport path statically before any production mutation.
- **MEASURED + STATIC — ROOT CAUSE:** raw-Date transport defect CONFIRMED for the Open Orders list response.
- **Repair commit:** `ef8c4b56e1166b707e71dc4a9ed0718b7a73e86c`, reusing the existing `transactionOperationalOrderTransportDto_` via `listOpenOperationalOrders()` (reuse of the already-established transport DTO; no new DTO introduced).

### Local validation

- **FROZEN local evidence:** focused suite 10/10 PASS; Open Orders suite 8/8 PASS; relevant regression 41/41 PASS.

### Delivery and candidate acceptance

- **MEASURED delivery:** `clasp push` 1/1 success; Apps Script version 705 created; candidate `AKfycbxy1fB1jkpoJr7kTQkK5Aqg1gERAMOTUUVQWyxZJ1ZoBvyV6qBcnvqdKmUHveSznLdf` pinned @705.
- **MEASURED — HARNESS SEQUENCING DEFECT (not a product defect):** initial candidate browser acceptance stopped at `HARNESS_SEQUENCING_DEFECT`; the harness targeted `#operationalOrderLookup` while the control was hidden. No product defect was established by that stop.
- **Corrected operator entry flow:** Transactions → New Transaction → Sales → authority READY gate → Continue existing order / Find Order.
- **MEASURED — candidate acceptance PASS:** with the corrected flow — lookup visible and enabled; handler, RPC, and success dispatch observed; Order `ORD-D0D68C09-ORDERCREATEO` rendered PAID + COMPLETED; `PAGE_ERRORS=[]`; `CONSOLE_ERRORS=[]`; harness exit code 0.

### Promotion and canonical acceptance

- **MEASURED promotion:** canonical deployment `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` moved @704 → @705. Same object, 1 mutation; description preserved; no replacement canonical deployment created.
- **MEASURED — canonical post-acceptance PASS:** same corrected operator flow; PAID + COMPLETED rendered; 0 errors.

### Cleanup, inventory, and invariants

- **MEASURED cleanup:** candidate cleanup = 1 deletion. Final deployment inventory: canonical @705 plus @HEAD; `TEMPORARY=0`; `UNEXPECTED=0`.
- **MEASURED:** zero production business mutations in this maintenance entry — orders created 0, orders edited 0, payments 0, fulfillment transitions 0, finance 0, supplier 0, inventory 0.
- `TRANSACTION_ACTIVATION=COMPLETE` (not reopened).
- `SALES_GO_LIVE_READY=TRUE` (not reopened).
