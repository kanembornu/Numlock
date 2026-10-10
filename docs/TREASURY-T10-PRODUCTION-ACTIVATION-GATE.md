# TREASURY T10 — Production Activation Gate Evidence (STOP: no deployed activation entry)

TASK_ID: `T10_TREASURY_ACTIVATION_AND_FIRST_GENUINE_RECEIPT`
· Complexity L3 · Operational risk R4 · Reasoning high
· Backend/model `9router/numlock-explore-free` (numlock-critical, executed in-session)

**STATUS: `BLOCKED_CAPABILITY`** — exact limitation: **the already-deployed
package contains no Treasury activation entry**, and T10 forbids `clasp push`,
new versions, and deploy actions. Gate A could not be invoked. Production ends
**DEPLOYED (@712, unchanged) + PREPARED (unchanged)**. Gate B: not executed (no
genuine receipt evidence supplied; synthesis forbidden). Expected terminal state
`PRODUCTION_ACTIVE_WAITING_FOR_FIRST_GENUINE_RECEIPT` is **not reachable in this
task** — activation itself is blocked.

## 1. Exact limitation for owner review

- Deployment-time config write (`PropertiesService`) has no REST surface; the
  only path is a deployed Apps Script function (T9 §4, architecture-forced).
- Local + deployed audit (both measured): the **only** function that writes
  `TREASURY_RECEIPT_V1_CONFIG` anywhere in the 76-file package is
  `prepareTreasuryReceiptV1Production()` in `100.Code` — and it is provably
  PREPARED-only:
  - `MODES[0] === "PREPARED"`; the config literal it writes is
    `mode: contract.MODES[0]` with `activationID: ""`, `activatedAt: ""`.
  - Deployed source scan: `setActiveModeLiteral: false`,
    `anyActivationNamedFn: false`; no `mode: "ACTIVE"` literal and no
    activation-named function exists in deployed `100.Code`.
  - Guard comment/behavior: a valid non-PREPARED mode is never downgraded,
    paused or activated by the prep path (`STOP_UNEXPECTED_MODE`).
  - Package-wide `setProperty` + config-key writers: only `100.Code` (prep) and
    `97E.SalesRecognition.V2.Activation` (Sales V2 property, out of scope).
- Therefore no authorized mechanism exists to perform `PREPARED → ACTIVE` under
  T10. Remediation requires a **separate owner task** that authorizes: authoring
  the narrow activation writer (per frozen T2 activation contract), local
  regression, `clasp status` manifest gate, ONE `clasp push --force`, ONE
  `clasp deploy`, then activation + readback. **No such source change, push, or
  version action was taken here.**

## 2. Baseline (verified first)

- HEAD `a8fe46d` (= required `a8fe46d`; ancestry `10a2755` → `a8fe46d`);
  tracked clean; index clean; **33** untracked files, all pre-existing
  `tests/tmp/*` (including the 27 × `u10e-*`), untouched.
- Full local regression before any production read: `node _test_runner.js` →
  **163 PASS / 0 FAIL** (MEASURED; matches baseline 163/0, no divergence).

## 3. Gate A precheck (14 items, MEASURED, read-only — `tests/tmp/t10-precheck.js`)

| # | Item | Measured value |
| --- | --- | --- |
| 1 | Deployment/version | 2 deployments (HEAD + pinned); pinned `updateTime 2026-10-10T14:13:35.263Z`; project `updateTime 2026-10-10T13:53:46.355Z` (T9 push, unchanged). `versionNumber` not returned by GET deployments this session; T9 deploy response recorded version **712**. 0 version/deploy actions under T10. |
| 2 | Package identity | deployed **76** files; package sha256 `f8a0dc05511d0f9f…`; deployed `100.Code` sha16 `25daf79add9eacb2` = local `100.Code.js` sha16 (byte-identical) |
| 3 | Treasury config | workspace `mode: { mode: "PREPARED", allowed: false, code: "TREASURY_NOT_ACTIVATED" }` — exactly PREPARED |
| 4 | Schemas exact | Receipts **24** / Operations **10** / Audits **11** headers, exact counts |
| 5 | Business rows | 0 / 0 / 0; marker scan (`TRC-`,`TROP-`,`TRA-`,`TRJ-`,`TREASURY_RECEIPT_V1`) across all **41** sheets = **0 hits** |
| 6 | Sales V2 | `ACTIVE`, ActivationID `b4791011-120e-4985-92da-a61c6311060c`, T `2026-10-08T18:59:50.540Z`, configVersion 1 (T9-identical) |
| 7 | Destinations | 1000 Cash on Hand / 1010 DANA Business / 1020 Cash in Owner Custody - BluBCA — each single-occurrence, `IsActive TRUE`, `NormalBalance DEBIT`, `treasuryDestinationEligible.eligible = true` |
| 8 | 1030 readiness | 1030 Sales Settlement Clearing, CashFlowGroup `Operating`, `treasuryClearingPreflight = PASS`, never a destination (`TREASURY_DESTINATION_IS_CLEARING`) |
| 9 | CashFlowGroup | Operating for 1000/1010/1020/1030 |
| 10 | Canonical V2 exposure | projection `recognizedExposure 24,000`, 1 UNCLEARED row `SCR-CE122B27-ORD677BE5CES`, integrity `VALID`, QualityCodes [], orphans all empty |
| 11 | LedgerNet1030 | Dr 24,000 / Cr 0 / **Net 24,000** |
| 12 | Explicit exceptions | `explicitExceptionAmount 0`, `exceptionEntries []`, `malformed1030Lines []` |
| 13 | Unexplained residual | **0** (`reconciliationStatus OK`) |
| 14 | Application liveness | Execution API HTTP 200 on workspace/reconciliation/projection/sales-config (run twice) |

**Verdict:** all 14 precheck items PASS. The blocking finding is separate and
prior: **no deployed activation entry exists** (§1) → activation invocation
**not attempted** (0 invocations, 0 config writes).

## 4. Zero-mutation proof (two identical read-only runs)

Run 1 and run 2 (`t10-precheck-out.json` / `t10-precheck-out2.json`):

- mode: `PREPARED` both runs; protected-surface fingerprint (16 surfaces,
  sha256 of `JSON.stringify(values)`): **identical**; Treasury schemas:
  **identical**; project `updateTime` unchanged.
- Protected row counts (unchanged vs T9): BalanceLedger 8 · Accounts 22 ·
  SalesRecognitionEvents 1 · SalesRecognitionAudits 1 · TransactionOperations 3
  · Orders 2 · OrderLines 3 · Payments 1 · Settlements 2 · InventoryLedger 0 ·
  tabsal 10808 · tabops 1976 · Logs 225 · Settings 7 · Products 34 ·
  ProductPricing 154.
- Outstanding 1030 = 24,000, residual 0 — correctly left outstanding; money
  unverified, no receipt synthesized.

## 5. Mutation accounting (zero, by class)

| Class | Count |
| --- | --- |
| Activation invocations | **0** (no entry exists; not attempted) |
| Treasury config writes | **0** (before = after = PREPARED) |
| Production financial writes (any class) | **0** |
| Production structural writes | **0** |
| Receipt / Operation / Audit rows | **0 / 0 / 0** |
| `clasp push` | **0** |
| Version/deploy actions (`clasp deploy`) | **0** |
| New versions created | **0** |
| Git push | **0** |
| Synthetic receipt / guessed destination / placeholder evidence | **0** (forbidden; Gate B N/A) |

## 6. Gate B

Owner supplied **no** genuine receipt evidence → decision **NO**; not executed.
Uncleared exposure availability is not evidence of received money; synthesis
(force transfer, test receipt, placeholder EvidenceRef, assumed cash/bank,
inferred payment from Sales/Payment/Settlement, clearing 1030 to zero) is
forbidden. Report items 34–72: N/A (no receipt). If genuine evidence is supplied
later it requires preview + owner inspection + a separate authorization.

## 7. Validation performed (MEASURED)

- `node _test_runner.js` → **163 PASS / 0 FAIL** (before any production read).
- `node --check tests/tmp/t10-precheck.js` → PASS.
- Two independent read-only production runs, zero delta (§4).
- `git diff --check` clean; `git status --short` = this doc only (task change)
  + pre-existing 33 untracked `tests/tmp/*` (never staged).
- Evidence classes: local/static ✓ · clasp upload n/a (0 pushes) · Apps Script
  runtime = read-only REST/Execution-API GETs ✓ · browser n/a (no UI change;
  no activation → no ACTIVE readback possible).

## 8. Telemetry

agent numlock-critical (in-session) · backend/model
`9router/numlock-explore-free` · reasoning high · fallback not used ·
delegation none · toolcalls not instrumented (UNKNOWN) · elapsed not
instrumented (UNKNOWN) · files modified: this doc (new),
`tests/tmp/t10-precheck.js` (new harness, untracked), `tests/tmp/t10-precheck-out*.json`
(new evidence, untracked) · test runs: 1 × `_test_runner.js` = 163 PASS / 0 FAIL
· production actions: 0 writes, 0 invocations, ~6 read-only API batches.

## 9. Next recommendation

Owner task T10.5 (separate authorization): author the narrow activation writer
per frozen T2 contract (ScriptLock → re-read PREPARED → schema/Accounts/1030/
reconciliation validation → durable ActivationID + activatedAt → PREPARED→ACTIVE →
configVersion bump → single write → exact readback), local regression, `clasp
status` manifest gate, ONE push + ONE deploy, then activation, readback, and
only then — with separately supplied genuine receipt evidence — Gate B.
