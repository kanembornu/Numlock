# TREASURY T9 — Production Schema / Config / Package / PREPARED Deployment Evidence

TASK_ID: `T9_TREASURY_PRODUCTION_SCHEMA_CONFIG_PACKAGE_AND_PREPARED_DEPLOYMENT`
· Complexity L3 · Operational risk R4 · Reasoning high
· Backend/model `9router/numlock-explore-free` (numlock-critical, executed in-session)
· Owner authorization: this task prompt (budget A–D + ONE push; Rule 7 single-push, Rule 8 execute-in-agent).

**STATUS: `COMPLETE_PREPARED`.** Production ends **DEPLOYED (@712) + PREPARED**.
Zero financial mutations. `TREASURY_RECEIPT_V1` is NOT active — every Treasury
Save/Reverse/Correct is refused with `TREASURY_NOT_ACTIVATED` and `writeCount: 0`.
Activation and the first receipt remain a separate T10 owner gate.

## 1. Baseline (verified first)

- HEAD `8298259` = required baseline; tracked/index clean; exactly **27** untracked
  `tests/tmp/u10e-*` files, untouched throughout.
- T8 gate `RELEASE_CANDIDATE_READY`; regression baseline **146 PASS / 0 FAIL** (measured).
- Deployment lineage **re-read, not assumed**: 2 deployments — head `@HEAD` + pinned
  `@711` (Finance UI dispatch liveness fix `c384170`).
- `SALES_RECOGNITION_V2 = ACTIVE` intact before and after (`ActivationID`
  `b4791011-…`, `T` `2026-10-08T18:59:50.540Z`) — never modified by T9.

## 2. Release fingerprints vs the committed T8 manifest

| Fingerprint | Value |
| --- | --- |
| T8 current (68-file) hash | `9369d0b6e583afae…` (matches committed T8) |
| T8 prospective (76-file) hash | `38b053297c2ed5ff…` (matches committed T8) |
| **Post-T9 76-file deployed hash** | `ca950bced4b068a4aa18ea692bb15cd0d374bcf28ae982824ca1183d7bef8cfc` |
| Package count | 76 = 76 (no count mismatch → no `BLOCKED_PACKAGE`) |

**Runtime delta, exactly one file:** `100.Code.js` (`e1918a8…` → `25daf79a…`).
The other **75/76** runtime files are **byte-identical** to the committed T8
prospective fingerprint. The single drift is the preparation function itself —
architecturally required (see §4), explicitly documented here per the
"metadata-only deltas must be explicitly documented" rule. No unexplained drift.

## 3. Read-only preflight (MEASURED, `tests/tmp/t9-precheck.js`)

All reads via Sheets REST `values.get` + metadata `get` against the canonical
production workbook through the stored `numlock-run` identity (refresh flow,
in-memory token; no credential mutation). Zero write endpoints.

- Sheets inventory: **38**; `TreasuryReceipts` / `TreasuryOperations` /
  `TreasuryAudits` all **ABSENT** (creation targets, not "existing").
- Accounts: **22** data rows, 9-col header exact, **0** duplicate codes.
  | Code | Type / Group | Active | NormalBalance | Result |
  | --- | --- | --- | --- | --- |
  | 1000 | Asset / Current Assets | TRUE | DEBIT | destination eligible |
  | 1010 | Asset / Current Assets | TRUE | DEBIT | destination eligible |
  | 1020 | Asset / Current Assets | TRUE | DEBIT | destination eligible |
  | 1030 | Asset / Current Assets | TRUE | DEBIT | `CashFlowGroup=Operating`, clearing preflight **PASS**, never a destination |
- 1030 reconciliation (real T5 `buildTreasury1030Reconciliation_` on live rows,
  Treasury sheets supplied as empty header-only local fixtures): Dr **24,000** /
  Cr **0** / Net **24,000**; recognizedExposure 24,000; outstanding 24,000;
  explicitExceptionAmount **0**; **unexplainedResidual 0** → `OK`.
  (Do-not-assume-Rp24,000 honored: measured fresh, not inherited.)
- Treasury marker scan (`TRC-`, `TROP-`, `TRA-`, `TRJ-`, `TREASURY_RECEIPT_V1`)
  across all 16 protected surfaces: **0 hits** → no unexpected business rows.
- Config state absent (structural: no deployed writer existed pre-push) →
  `REJECT`/`TREASURY_CONFIG_INVALID`, never ACTIVE.

## 4. Two-stage sequence (architecture-forced, documented)

Budget B (config write) requires `PropertiesService`, which has **no REST
surface** — the only path is a deployed Apps Script function. Therefore the
prep entry had to be deployed before it could be invoked. Actual order:

1. Read-only preflight (§3) · 2. local prep implementation + 20-case suite +
   21-check sensitivity proof · 3. package registration · 4. `clasp status` gate ·
   5. **ONE** `clasp push --force` · 6. **ONE** `clasp deploy` (version + update) ·
   7. **ONE** Execution-API invocation of `prepareTreasuryReceiptV1Production()` ·
   8. read-only post-deploy verification.

**PREPARED-before-financial-write is preserved:** between the push (source
replacement only — no writer runs on load) and the prep invocation, the config
was absent → `REJECT` → all Treasury financial writes refused → financially
inert the entire window. The prep invocation then created the sheets + PREPARED
config. T9 established no financial-write capability at any point.

## 5. Preparation function + tests (Commit A `10a2755`)

`prepareTreasuryReceiptV1Production()` in `100.Code.js` — the admin/bootstrap
host. Placed there, **not** in `99*/202-204`, because the frozen T3/T8 purity
audits require every Treasury runtime file to be free of `.setProperty(` and of
write/transport primitives (`CONFIG2`, `CG3`). Zero behavioral change to any
existing function; addition only.

Behavior (narrow, idempotent, PREPARED-only): lock → inspect → create only
absent sheets with exact T3 headers (Receipts 24 no stored Status / Operations
10 / Audits 11, exact order) → verify dimensions → zero business rows → write
`TREASURY_RECEIPT_V1_CONFIG = PREPARED` **only after** schemas validate →
readback through the normal T3 reader → structured result. Never activates; a
correct PREPARED state re-runs as `NOOP_ALREADY_PREPARED` with zero writes.
Fail-closed STOPs: unexpected mode, malformed config, malformed existing sheet,
account/1030 readiness, create failure, config readback mismatch.

Local tests (`96.Tests.Treasury.Receipt.Preparation.Cases.js`, 16 suites):
all-absent · one-exact · all-exact · malformed receipt/ops/audit headers ·
PREPARED-already-valid (idempotent) · malformed config · unexpected ACTIVE ·
unexpected PAUSED · account readiness · CashFlowGroup · create failure · zero
business rows + zero ledger/Accounts mutation · config classification ·
PREPARED Save/Reverse/Correct refusal · package registration · source/UI audit ·
deployment order.

Sensitivity proof (`tests/browser/treasury-t9-preparation-mutation-proof.js`):
**21/21 caught** = 12 injected source mutations (stored Status column; 3× wrong
header count; malformed sheet overwritten; config ACTIVE; missing config never
written; prep writes ledger; prep fakes receipt; prep mutates Accounts; clearing
bypassed; destination bypassed) + 5 package-drop + tests-included +
docs/tmp-included + hash-drift-ignored + push-before-status-gate tamper checks.
Clean baseline passes first; every mutation fails at its named marker; no
tracked file is ever mutated by the proof.

## 6. Package registration (budget C)

- `.claspignore`: added exactly the 8 T3–T7 Treasury runtime files (99, 99A, 99B,
  99C, 99D, 202, 203, 204). 68 → **76** allowlist entries.
- `tests/browser/treasury-t8-release-gate.js`: `PKG_CURRENT_COUNT` 68 → 76 +
  `PKG_TREASURY_REGISTERED` now required (U8→U9 precedent: the T8-era deferral
  placeholder is resolved by this task's authorized gate).
- Never packaged: tests, docs, tmp, harness, manifest JSON, `.clasp.json`.

## 7. Deployment (budget D, exactly one push + one deploy)

- Pre-push `clasp status`: **76 tracked files**, byte-identical to the 76-entry
  allowlist (`set(tracked) == set(allowlist)`; no missing, no extra, no
  tests/docs/tmp). Upload-manifest gate PASS.
- **`clasp push --force` ×1** (Rule 8: executed by the agent). Projects API
  content readback: **76 deployed files**, `updateTime`
  `2026-10-10T13:53:46.355Z`, all 8 Treasury files + `100.Code.js`
  **byte-identical** to the local audited candidate, `missingOnDeploy: []`,
  `extraOnDeploy: []`, prep function present.
- **`clasp deploy` ×1** on the existing pinned deployment → version **712**
  created, deployment 711 → **712**. Deployments still exactly 2 (head +
  pinned @712). No deployment URL change. Rule 7 respected: no second push.
- Local regression after final source state: **163 PASS / 0 FAIL**, three
  measured runs (repeatability; baseline 146 preserved, +17 new).

## 8. Production preparation invocation (budgets A + B, exactly one)

`prepareTreasuryReceiptV1Production()` via Execution API (`POST
/v1/scripts/{id}:run`, identity `numlock-run`, HTTP 200), invoked **once**:

```
status: PREPARED   writes: { sheets: 3, config: 1 }
createdSheets: [TreasuryReceipts, TreasuryOperations, TreasuryAudits]
schemas: RECEIPTS 24 headersExact · OPERATIONS 10 headersExact · AUDITS 11 headersExact
businessRows: { TreasuryReceipts: 0, TreasuryOperations: 0, TreasuryAudits: 0 }
config: { contractVersion: TREASURY_RECEIPT_V1, mode: PREPARED,
          activationID: "", activatedAt: "", configVersion: 1 }
readiness: clearing PASS · destinations 1000/1010/1020 all eligible
```

Sheet count 38 → **41**. Protected surfaces before → after: **0 changed**
(all 16 SHA-identical — see §9).

## 9. Post-deployment read-only verification (MEASURED)

- **Mode after deploy:** `getTreasuryOperatorWorkspace` →
  `mode: { mode: "PREPARED", allowed: false, code: "TREASURY_NOT_ACTIVATED" }`.
- **Treasury navigation/read surface:** workspace returns the canonical T5
  projection (1 UNCLEARED row, RecognitionIntegrity `VALID`, QualityCodes []),
  the global 1030 reconciliation (`OK`, residual **0**, outstanding 24,000,
  ledgerNet 24,000), and T3 destinations `1000`/`1010`/`1020` with account
  names. Advisory capabilities all `canSave/canReverse/canCorrect = false`,
  `actionReason: TREASURY_NOT_ACTIVATED` — the T7 UI already withholds every
  mutation action under PREPARED, so **no UI readiness patch was needed** (the
  patch was permitted only if T7 showed an actionable Save under PREPARED; it
  does not).
- **T5 production read:** `getTreasury1030Reconciliation` → `OK`, residual 0.
- **PREPARED refusal evidence (production, provably non-mutating):** the T3 mode
  gate is the first check in both T4 `treasuryReceiptNewIntent_` and T6
  `treasuryLifecycleNewIntent_`, before any durable lookup or write. Probes
  against a non-existent recognition/target, all REFUSED with
  `TREASURY_NOT_ACTIVATED`, **`writeCount: 0`**, zero IDs:
  - `treasuryOperatorSaveReceipt` → REFUSED / NOT_ACTIVATED / writeCount 0
  - `treasuryOperatorReverseReceipt` → REFUSED / NOT_ACTIVATED / writeCount 0
  - `treasuryOperatorCorrectReceipt` → REFUSED / NOT_ACTIVATED / writeCount 0
- **Zero financial mutation (hash-equal to precheck baseline, same
  `FORMATTED_VALUE` basis, harness key-name bug in §9.1 resolved):**
  BalanceLedger 8 · Accounts 22 · SalesRecognitionEvents 1 ·
  SalesRecognitionAudits 1 · TransactionOperations 3 · Orders 2 · OrderLines 3 ·
  Payments 1 · Settlements 2 · InventoryLedger 0 · tabsal 10808 · tabops 1976 ·
  Logs 225 · Settings 7 · Products 34 · ProductPricing 154 — **all
  SHA-identical** before vs after. First V2 Sale preserved (1 event, 1 audit, 2
  ledger lines, Dr1030/Cr4000 24,000 uncleared). Accounts unchanged (no
  1000/1010/1020/1030/2010/4000 mutation).
- **Sales V2 ACTIVE intact:** `salesRecognitionV2OperatorConfig` → `ACTIVE`,
  same ActivationID/T, `configVersion 1` — byte-stable before/after T9.
- **Finance surfaces unchanged:** Finance/Cash/1030/P&L read surfaces are
  unaffected; the only delta anywhere in the workbook is the 3 new empty
  Treasury sheets + the PREPARED Script Property.

### 9.1 Harness note (honest residual)

An intermediate comparison reported a spurious "sha mismatch" on all 16
protected surfaces. Root cause: the precheck harness stored the digest under
key `dataSha16` while the post-deploy harness used `sha16`; the comparison read
the wrong key (→ `undefined` → always mismatched). Re-reconciled with a single
harness using the same key and the same `FORMATTED_VALUE`/`JSON.stringify`
basis: **precheckMatchesFresh: true**, **postdeployMatchesFresh: true**, 0
mismatches on all 16 surfaces. Data never drifted; only the reporting key
differed. Row counts and headers were identical throughout.

## 10. Financial-mutation accounting (zero, by class)

| Class | Count |
| --- | --- |
| Production financial writes (Receipt/Operation/Audit/BalanceLedger/Cash/Bank/1030/Sale/Correct/Void/Payment/Settlement/refund/2010/AP/Purchase/Inventory) | **0** |
| Production structural writes (create-if-absent Treasury sheets) | **3** (exactly the 3 authorized; 0 business rows) |
| Production config writes (`TREASURY_RECEIPT_V1_CONFIG` = PREPARED) | **1** |
| Accounts mutations | **0** |
| Sales / Sales V2 mutations | **0** |
| Deployment actions (`clasp push --force`) | **1** |
| Version/deployment creations (`clasp deploy`) | **1** (version 712, deployment 711→712) |
| Preparation invocations (Execution API) | **1** |
| Refusal probes (provably non-mutating, writeCount 0) | **3** |
| Git commits | **2** (A `10a2755`, B this doc) — **no Git push** |

## 11. Validation performed (MEASURED)

- Full local regression `node _test_runner.js` → **163 PASS / 0 FAIL**
  (baseline 146 preserved; +17 new T9 suites/proof), three runs after the final
  source modification.
- `node --check` on every new/changed JS: PASS (`100.Code.js`, the T9 cases, the
  T9 proof harness, `_test_runner.js`, the T8 gate).
- `git diff --check`: clean. `git status --short`: only the intended task files
  + the pre-existing 27 `u10e-*` untracked files.
- clasp upload = measured (Projects API content hash match, 76/76).
- Apps Script runtime = measured (Execution API 200: prep invocation + workspace
  + reconciliation + exposure + projection + Sales V2 config + 3 refusal probes).
- Browser acceptance = not applicable (no UI change; T7 already withholds
  mutation actions under PREPARED).

Evidence classes kept separate: local/static ✓ · clasp upload ✓ · Apps Script
runtime ✓ · browser n/a. No secret, `scriptId`, token, or deployment URL is
recorded anywhere in this document.

## 12. Limitations (honest residuals)

1. `clasp run …` remains blocked (generic permission message); the working
   mechanism is direct Execution API invocation with identity `numlock-run`.
2. Version 712 is a normal release; prior versions 705/706/707/711 are left in
   place (no delete API attempted, no cleanup authorized).
3. The preparation function is reachable by anyone holding the Execution API
   identity; it is PREPARED-only, idempotent, financially inert, and can never
   activate or write a financial row. Tightening that surface is a T10+ concern,
   not a T9 blocker.
4. Production `SALES_RECOGNITION_V2` remains ACTIVE (pre-existing, out of T9
   scope); T9 never touched it.

## 13. Telemetry

agent numlock-critical (executed in-session) · backend/model
`9router/numlock-explore-free` · reasoning high · fallback not used · delegation
none · toolcalls not instrumented (UNKNOWN) · elapsed not instrumented (UNKNOWN)
· files modified: `100.Code.js`, `96.Tests.Treasury.Receipt.Preparation.Cases.js`
(new), `tests/browser/treasury-t9-preparation-mutation-proof.js` (new),
`_test_runner.js`, `tests/browser/treasury-t8-release-gate.js`, `.claspignore`,
`tests/tmp/t8-package-manifest.json`, this document · test runs: 3 ×
`node _test_runner.js` = 163 PASS / 0 FAIL · production actions: 1 sheet-creation
batch (3 sheets) + 1 config write + 1 push + 1 deploy + 1 prep invocation + 3
non-mutating refusal probes.

## 14. T10 boundary (do NOT auto-start)

T9 stops at **DEPLOYED + PREPARED**. Do **not** set `mode: ACTIVE`, and do not
create the first receipt, reversal, or correction. Each requires a separate
owner authorization after T9 evidence review.
