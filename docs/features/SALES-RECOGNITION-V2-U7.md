# SALES_RECOGNITION_V2 U7 — Operator Flow and Legacy-Routing Guards

Status: implemented and locally measured. V2 stays **PREPARED / disabled** in
production; no activation metadata, no `T`, no `ActivationID` is written by
this contract. Source of truth: `97D.SalesRecognition.V2.OperatorGuard.js`
plus the guard seams listed below.

## 1. Activation-rule routing (server enforced, fail closed)

Config source: script property `SALES_RECOGNITION_V2_CONFIG` (JSON matching
the U1 config contract), resolved by `salesRecognitionV2OperatorConfig()`.
Absent/blank → U1 default (`PREPARED`, blank activation fields) → today's
production behavior unchanged. Present-but-invalid → route `REJECT`
(`CONFIG_INVALID`): new Sales fail closed instead of silently re-enabling
legacy creation. The resolver never writes properties.

| Mode | New Sales (Order/Save) | Canonical `submitCanonicalTransaction` SALES | V2 durable Save (U2) | U6 Correct/Void | Payment / fulfillment on V2 cohort | Payment / fulfillment on pre-V2 cohort |
| --- | --- | --- | --- | --- | --- | --- |
| PREPARED (production today) | legacy durable Order (`createDurableOperationalOrder_`) | legacy tabsal writer | new intent refused (`V2_NOT_ACTIVATED`) | new intent refused | refused (evidence guard, mode-independent) | allowed (historical contract) |
| ACTIVE (fixture-only today) | V2 Save only (`salesRecognitionV2DurableSave`) | refused `SALES_V2_LEGACY_SALES_RETIRED`, zero writes | allowed | allowed | refused (evidence guard) | allowed |
| PAUSED | refused `V2_MODE_PAUSED`, zero writes | refused `V2_MODE_PAUSED`, zero writes | new intent refused; persisted intents resume (sticky) | new intent refused; persisted intents resume | refused (evidence guard) | allowed |
| REJECT (invalid config) | refused `CONFIG_INVALID` | refused `CONFIG_INVALID` | refused | refused | refused only if V2 evidence exists | allowed |

- V2 failure never falls back to a legacy writer (`salesV2OperatorModeCreateOrder_`
  maps DONE / REFUSED / CONFLICT / UNKNOWN / RECOVERY_REQUIRED explicitly;
  `unknown: true` flags possible-write outcomes).
- Cohort = persisted evidence only: `TransactionOperations`
  (`SALES_RECOGNITION_V2_SAVE`/`SALES_V2_VOID`/`SALES_V2_CORRECT` with
  `BusinessID == OrderID`) plus `SalesRecognitionEvents` (`OrderID`) for
  corrected replacement orders. Never dates, never current mode, never sheet
  presence.
- Sticky: resume paths (`salesRecognitionV2SaveResume_`,
  `salesRecognitionV2MutationResume_`) have no mode gate, so persisted V2
  intents recover under PAUSED.

## 2. Target operator flow

`Create → Order Type → lines (ProductVariantID + qty, Add Line) → Save → Done`

- Line requests carry explicit `ProductID + ProductVariantID`; `Tipe` is
  display/attribute only (`salesRecognitionV2NormalizeSave_` drops any `tipe`
  field; missing variant → refused, zero writes).
- One stable `RequestKey` per Save intent; duplicate clicks reuse it; server
  idempotency (exact operation lookup + frozen plan) is authoritative.
- Line add/edit/remove is locked client-side while the intent is pending
  (`addSelectedSalesOrderLine` refusal); payload conflict under the same key →
  `OPERATION_PAYLOAD_CONFLICT` (definite), frozen original intent untouched.
- `Done` only after a confirmed durable success (`response.status === "DONE"`
  for U6 surfaces, `response.success === true` + server `DONE` for Save).
  UNKNOWN/RECOVERY_REQUIRED keep the RequestKey, show
  "Result belum dapat dipastikan…", and recheck the SAME operation
  (`findOperationalOperation` with exact operation type + RequestKey).
- No Payment Method / Receive Via / payment confirmation / Paid-Unpaid /
  fulfillment progression / manual Complete on the V2 path; the operator
  status line renders recognition semantics ("Recognized") and hides the
  payment and fulfillment sections for V2 orders.
- Client totals are display-only; server freezes price/recipe/HPP/total from
  authority (payload extras never reach `normalizedPayload`).

## 3. V2 retirement guards (reject before mutation)

| Seam | File | Guard |
| --- | --- | --- |
| `createDurableOperationalPayment_` | `95A.Transaction.Production.js` | `salesV2OperatorPaymentGuard_` (first line) |
| `payOperationalOrderWithRepository` | `95.Transaction.Operational.js` | same |
| `transitionOperationalFulfillmentWithRepository` (Start Preparing / Mark Ready / Complete / CLOSED) | `95.Transaction.Operational.js` | `salesV2OperatorFulfillmentGuard_` (first line) |
| `submitCanonicalTransactionWithRuntime_` SALES | `21.Transaction.Entry.js` | `salesV2OperatorLegacySalesGuard_` (pre-lock) |
| `buildCashPostingCandidate` (INFLOW sale branch) | `40.Cash.Foundation.js` | `salesV2OperatorCashPostBlocked_` → `REFUSED / SALES_V2_NO_CASH_POST`; production cash runtime forwards `salesRecognitionOperations` + `salesRecognitionEvents` |
| `recoverTransactionOperationWithRuntime_` | `95A.Transaction.Production.js` | V2 operation types route to `salesV2OperatorRecoverWithRuntime_` before the `ORDER_CREATE`/`PAYMENT` branches; legacy dispatcher never reinterprets V2 work |
| legacy Correct/Void | `22.Transaction.Lifecycle.js` | unchanged: `SAL-`/`OPS-` only, `ORDER:` identity → `TRANSACTION_NOT_FOUND`, zero writes |
| U6 Correct/Void | `97C.SalesRecognition.V2.Correction.js` | unchanged: `SALES_V2_LEGACY_IDENTITY_REJECTED` for `SAL-`/`OPS-` |

No synthetic Payment/COMPLETED, no fabricated Cash/DANA/Bank/Unknown payment
channel: the V2 Save result DTO carries only cohort/recognition fields
(`salesCohort`, `recognitionStatus`), and the V2 status renderer never reads
`PaymentStatus`, `FulfillmentStatus`, or `Receive Via`. No payment-channel
inference from 1030.

## 4. Correct / Void routing

- Row surfaces (`193.View.Transactions.Render.html`): `salesV2Row`
  (`salesCohort === "V2_COMMITTED"`, active) joins the existing APP_ENTRY
  gate so V2 rows expose Correct/Void buttons; all other rows unchanged.
- Controller (`195.View.Transactions.Actions.html`): `loadTransactionForMutation`
  routes by persisted cohort **before** the legacy handlers:
  - V2 identity (`ORDER:…` or `salesCohort V2_*`) → `openSalesV2MutationDialog`
    → `salesRecognitionV2DurableVoid` / `salesRecognitionV2DurableCorrect`
    (reason required, stable RequestKey, UNKNOWN keeps identity, Check Status
    reconciles through `SALES_V2_VOID`/`SALES_V2_CORRECT` operation types).
  - Legacy identities → legacy handlers only (`openTransactionCorrection`,
    `renderTransactionVoidConfirmation` → `voidCanonicalTransaction`).
- Exception actions only; U6 internals unchanged.

## 5. Status / quality UI

- V2 detail status = `ACTIVE`/`VOIDED` from recognition lineage; `RECOVERY_REQUIRED`,
  `INTEGRITY_CONFLICT`, `EXCLUDED_INCOMPLETE` remain fail-closed quality
  signals (no UI repair writes, no synthetic new Sale, never rendered as a
  normal successful Sale with payment meaning).
- V2 list rows keep the shared U4/U3 status vocabulary (Active/Voided); no
  Paid/Unpaid/Fulfillment status is used as V2 lifecycle authority.

## 6. Routing matrix (exhaustive create/mutate inventory)

| Path | File | Classification |
| --- | --- | --- |
| `submitCanonicalTransaction` SALES (tabsal writer) | 21 | legacy-only, mode-guarded (PREPARED only) |
| `submitCanonicalTransaction` EXPENSE / INVENTORY_RECEIPT | 21 / 45 | not Sales (unchanged) |
| `submitOperationalOrder` | 95A | mode-routed (legacy PREPARED / V2 ACTIVE / reject PAUSED) |
| `createDurableOperationalOrder_` | 95A | legacy order core, PREPARED only |
| `salesRecognitionV2DurableSave` | 97A | V2 Save |
| `salesV2OperatorCreateWithRuntime_` / `salesV2OperatorModeCreateOrder_` | 97D | U7 routing dispatcher (fixture / production) |
| `createOperationalOrderWithRepository` | 95 | in-memory test seam, no production caller |
| `submitOperationalPayment` → `createDurableOperationalPayment_` | 95A | forbidden-for-V2; pre-V2 historical servicing |
| `payOperationalOrderWithRepository` / `payOperationalOrder` | 95 | forbidden-for-V2; pre-V2 historical servicing |
| `submitOperationalFulfillment` → `transitionOperationalFulfillmentWithRepository` | 95A / 95 | forbidden-for-V2; pre-V2 historical servicing |
| `attemptCashSettlement` (SALE_SETTLEMENT for tabsal) | 21 | pre-V2/legacy (reachable only from the mode-guarded legacy SALES writer) |
| `buildCashPostingCandidate` / `cashSettle` / `cashSettleAndPersist` / `runCashSettleAndPersist` | 40 | shared posting engine; forbidden-for-V2 via persisted-evidence context |
| `voidCanonicalTransaction` / `correctCanonicalTransaction` / `previewCanonicalTransactionCorrection` | 22 | legacy-only (`SAL-`/`OPS-`) |
| `salesRecognitionV2DurableVoid` / `salesRecognitionV2DurableCorrect` | 97C | V2 Correct/Void (U6) |
| `recoverTransactionOperation` (+`WithRuntime_`) | 95A | dispatcher: legacy `ORDER_CREATE`/`PAYMENT` + V2 types → V2 recovery |
| `salesRecognitionV2SaveWithRuntime_` resume / `salesRecognitionV2MutationRun_` resume | 97A / 97C | V2 recovery (mode-gate free) |
| Purchase `voidPurchaseEvent` / `correctPurchaseEvent` / `resolvePurchaseEventEvidence` | 47 | separate Purchase cohort; forbidden for V2 Sales identities |
| Inventory receipt orchestration | 45 | not Sales |
| Schema/variant/recipe bootstrap + `executeTransactionSchemaActivation` | 95A | activation tooling; never records V2 `T`/`ActivationID` |
| repository `updateOrder` / `createPayment` | 95 / 95A | reachable only through the guarded payment/fulfillment seams |
| `getCanonicalTransactionDetail(s)`, `getTransactionsPage`, `listOpenOperationalOrders`, `findOperationalOrder`, `findOperationalOperation`, U3 projection, U5 Finance | 22 / 91 / 95A / 97B / 36 | shared read-only |
| `findOperationalOrder` / `findOperationalOperation` cohort annotation | 95A | additive, evidence-only (`salesCohort`/`recognitionStatus`) |

## 7. Tests (focused U7, MEASURED)

`node _test_runner.js` → **82 PASS / 0 FAIL** (baseline ≥74 PASS / 0 FAIL
preserved; all U1–U6 suites and legacy Payment/Fulfillment/Transaction/Finance
suites still pass).

| # | Requirement | U7 check(s) |
| --- | --- | --- |
| 1 | ACTIVE fixture: multiline → one U2 Save → Done, no payment/fulfillment step | `OPERATOR_FLOW:T1a–T1e` + `CONTROLLER:C1*` |
| 2 | PREPARED: legacy intact, V2 inactive, no T | `T2a–T2e` |
| 3 | ACTIVE: legacy writer rejected/not invoked, no fallback | `T3a–T3i` |
| 4 | PAUSED: reject, no fallback; persisted V2 recovery | `T4a–T4e` |
| 5 | ProductVariantID required, no Tipe fallback | `GUARDS:G5a–G5d` |
| 6 | Payment guards pre-mutation; pre-V2 intact | `G1a–G1d`, `G3a–G3c` |
| 7 | Fulfillment guards; pre-V2 compatible | `G2a–G2c`, `G3b` |
| 8 | Recovery dispatcher: V2 op → V2 recovery only | `G6a–G6d` |
| 9 | UNKNOWN keeps RequestKey, same-op recovery | `IDENTITY:I1a–I1c`, `I2a–I2b` + `C3*`, `C4*`, `C8` |
| 10 | Duplicate click, one effect | `T21a` + `C2a` |
| 11 | Payload immutable while pending | `I3a–I3d` + `C5a–C5d` |
| 12 | V2 Correct/Void → U6 only | `ROUTING:R1a–R1d`, `R2a–R2b` + `C6a–C6h` |
| 13 | Legacy Correct/Void → legacy only | `R3a–R3d` + `C6i–C6j` |
| 14 | Old Order servicing retained; never V2 by date | `G7a–G7c`, `R4a–R4b` |
| 15 | No Paid/Unpaid/Fulfillment as V2 lifecycle authority | `UI:U2a–U2b`, `U5a–U5b` + `C1c–C1d` |
| 16 | No fabricated payment method | `T1f`, `UI:U2c` |
| 17 | Multiline one Sale; add/edit/remove pre-submit | `T1d`, `C1a`, `C5c` |
| 18 | Client total not authority | `T22a` |
| 19 | PREPARED→ACTIVE→PAUSED sequence, no date fallback, sticky V2 | `T19a–T19d`, `T4c–T4e` |
| 20 | Historical preservation; no backfill | `R4a`, `R1c`, `R2a`, `G3a` |

**Browser/controller** (`tests/browser/sales-v2-u7-controller.js`, executed by
the runner): drives the real `195` controller in an in-memory DOM +
`google.script.run` harness — Save/duplicate-click/UNKNOWN/retry/Done,
V2 status rendering, Correct/Void cohort routing, PAUSED refusal.
Limitation: not a real browser process; HTML rendering and CSS are covered by
the source contracts, not by pixels.

**Mutation proof** (`tests/browser/sales-v2-u7-mutation-proof.js`, 10
mutations, ≥8 required, each anchored exactly once):

| Mutation | Caught by |
| --- | --- |
| 1 ACTIVE falls back to legacy writer | `OPERATOR_FLOW:T1a` |
| 2 PAUSED falls back | `OPERATOR_FLOW:T3c` |
| 3 V2 payment guard bypassed | `GUARDS:G1a` |
| 4 V2 fulfillment guard bypassed | `GUARDS:G2a` |
| 5 UNKNOWN discards RequestKey | `UI:U3e` |
| 6 Done before confirmed status | `UI:U3d` |
| 7 ProductVariantID omitted / Tipe fallback | `GUARDS:G5c` |
| 8 V2 Correct → legacy handler | `UI:U3b` |
| 9 old Order misclassified as V2 (evidence not bound to target) | `GUARDS:G3a` |
| 10 fabricated default payment method on V2 result | `UI:U2c` |

**Source audit (28 items):** `testSalesRecognitionV2U7SourceAudit` checks
1–28 map one-to-one to the audit list (flow, variant, payment/fulfillment
guards, cash post, recovery, ACTIVE/PAUSED/sticky, PREPARED default, RequestKey,
Done gate, idempotency, totals, no fabricated method, U4 status semantics, no
production T, no Treasury, V2 PREPARED, no U8+ scope).

## 8. Validation executed

- `node _test_runner.js` → 82 PASS / 0 FAIL (MEASURED after final edit).
- `node --check` on every changed/new `.js` file → PASS.
- Extracted frontend syntax (`node --check < 193…html`, `node --check < 195…html`) → PASS.
- `git diff --check` → clean; `git status --short` → only U7 files listed above.

## 9. Deliberate limitations (upgrade path noted)

- The legacy receipt/entry Sales form has no client mode signal by design
  (mode lives server-side); under ACTIVE it receives a definite server refusal.
  If a client-visible mode flag is ever wanted, add it as an additive field on
  an existing read endpoint.
- V2 Correct edits line quantities and reason only; full line add/remove for
  corrections can reuse the Add Line component if operators need it later.
- Activation (properties write, `T`, `ActivationID`) is intentionally out of
  scope and remains a future, separately authorized activation task.
