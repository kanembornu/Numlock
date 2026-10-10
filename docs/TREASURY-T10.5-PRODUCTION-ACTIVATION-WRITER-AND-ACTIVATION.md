# TREASURY T10.5 — Production Activation Writer + Production Activation (ACTIVE)

TASK_ID: `T10_5_TREASURY_ACTIVATION_WRITER_AND_PRODUCTION_ACTIVATION`
· Complexity L3 · Operational risk R4 · Reasoning high
· Backend/model `9router/numlock-explore-free` (numlock-critical, executed in-session)

**STATUS: `COMPLETE_ACTIVE`** — business state
`PRODUCTION_ACTIVE_WAITING_FOR_FIRST_GENUINE_RECEIPT`. Stage A shipped ONE narrow
activation entry `activateTreasuryReceiptV1Production()` in `100.Code.js` (prep
function not overloaded), local-validated, package-gated, ONE `clasp push --force`,
ONE `clasp deploy` → version **713**. Stage B re-read every precondition, invoked
activation **EXACTLY ONCE**, and read back the exact ACTIVE identity. Zero financial
events. Gate B (first genuine receipt) remains **closed**: `GENUINE_RECEIPT_EVIDENCE_AVAILABLE = NO`,
`FIRST_RECEIPT_INVOCATION_COUNT = 0`, `TREASURY_RECEIPT_ROWS = 0`.

## 1. Baseline (verified first)

- HEAD `5453d97` (= required baseline); tracked clean; index clean; **38**
  untracked files, all pre-existing `tests/tmp/*` (27 × `u10e-*` + 11 × `t9-*`/`t10-*`),
  untouched.
- Full local regression before any source change: `node _test_runner.js` →
  **163 PASS / 0 FAIL** (MEASURED).
- Production baseline re-read at Stage B (all MEASURED): deployment 712; package
  76 files; `100.Code` sha16 `25daf79add9eacb2`; config **PREPARED**
  (`contractVersion TREASURY_RECEIPT_V1`, `activationID ""`, `configVersion 1`);
  schemas 24/10/11; business rows 0/0/0; Sales V2 ACTIVE `b4791011-120e-4985-92da-a61c6311060c`;
  exposure 24,000 UNCLEARED `SCR-CE122B27-ORD677BE5CES` VALID; LedgerNet1030
  24,000; explicit exceptions 0; residual 0 (`OK`); destinations 1000/1010/1020
  eligible; 1030 Operating preflight PASS.

Authority applied: T2 > `8bb0097` > T3 > T5 > T8 > T9 > T10 measured > T10.5
authorization. No config-semantics redesign.

## 2. Stage A — activation writer (`100.Code.js` only)

Added BEFORE the T9 preparation block, so the T9 source audit region
(`var TREASURY_PRODUCTION_PREPARATION` → EOF) is byte-affecting only by absence:
the prep block, its single `setProperty`, and its audits are untouched.

Frozen sequence inside the writer core (lock owned by the public entry):

1. `ScriptLock` (public entry, acquired before any read/write; released once in `finally`).
2. Re-read config + schemas + business rows **inside the lock** (`treasuryPreparationInspect_`).
3. Classify mode. `ACTIVE` (valid, durable identity) → `NOOP_ALREADY_ACTIVE`,
   readback returned untouched, **no second identity, zero writes**.
4. `PAUSED` / any non-`PREPARED` state → `STOP_UNEXPECTED_MODE` (no unauthorized
   first transition). Absent config → `STOP_CONFIG_ABSENT`. Malformed config →
   `STOP_CONFIG_MALFORMED` (never repaired, never defaulted).
5. Exact Treasury schemas via the T3 validators → else `STOP_SCHEMA_CONFLICT`.
6. Zero business rows on all three surfaces → else `STOP_BUSINESS_ROWS`.
7. Destination authority (T2 §6) + 1030 readiness incl. `CashFlowGroup == Operating`
   (T2 §21/28) → else `STOP_ACCOUNT_READINESS`. Accounts master read-only.
8. Canonical exposure authority (`buildTreasuryClearingProjection_`, read-only).
9. Global reconciliation (`buildTreasury1030Reconciliation_`, read-only).
10. **`UnexplainedResidual === 0` AND `reconciliationStatus === "OK"` required** —
    NOT `LedgerNet1030 = 0`; the outstanding 24,000 stays outstanding and is never
    cleared here → else `STOP_RECONCILIATION`.
11. Frozen activation plan (`contract.MODES[1]` must be `ACTIVE`).
12. Durable unique non-empty `ActivationID` = `TRACT-` + server uuid.
13. `activatedAt` = server instant (`runtime.now().toISOString()`); the public entry
    takes **zero parameters**, so no client can choose or backdate either value.
14. Next `configVersion` per the **existing frozen scheme**: carried forward from the
    validated current value (T2 §5 fixes the activation state at `configVersion 1`;
    the in-production 97E Sales activation carries `current.configVersion`). No second
    (bump) scheme is introduced — `configVersion + 1` is asserted absent by audit A22f.
15. `validateTreasuryReceiptConfig(activated)` must PASS → else `STOP_IDENTITY_INVALID`.
16. **ONE** `setProperty(contract.CONFIG_PROPERTY, …)` — the single config write.
17. Exact readback through the normal T3 reader; all five fields compared byte-exact;
    `result.config` stays `null` until the comparison passes → else
    `STOP_CONFIG_READBACK_MISMATCH`.
18. Classify `ACTIVATED` only after the exact readback; structured result returned.

No financial writer is reachable: no sheet writer, no ledger writer, no
receipt/operation/audit artifact, no transport. `prep` is not overloaded: the
activation call is absent from the preparation region (audit A23).

## 3. Local validation (MEASURED)

- Suites **A1–A16** (`96.Tests.Treasury.Activation.Cases.js`): PREPARED→ACTIVE ·
  ACTIVE idempotent (no second identity) · absent config fail · malformed config
  fail · PAUSED fail · schema/business-row gate fail · destination fail · 1030
  readiness fail · residual≠0 fail · 24,000 outstanding + residual 0 allowed ·
  config-only write (19 protected surfaces byte-identical) · business rows 0/0/0 ·
  BalanceLedger unchanged · Sales unchanged · exact identity readback + lying
  readback refused · ambiguous-response recovery without second identity.
- Call-graph/writer audit (A17–A25): lock-first ordering, PREPARED classification
  only inside the locked core (entry has no config read/write), exactly one
  `setProperty` in the activation block on `contract.CONFIG_PROPERTY`, frozen
  writer denylist (T4 Save / T6 reverse / Sales save+activation / prep entry /
  `appendRow` / `setValues` / `insertSheet` / `UrlFetchApp` / `batchUpdate`),
  no `LedgerNet1030 = 0` requirement, server-only identity, no `configVersion`
  bump, prep block not overloaded, Treasury UI untouched.
- Mutation sensitivity **20/20** (`tests/browser/treasury-t105-activation-mutation-proof.js`,
  fail-closed: an uncaught mutation throws): 15 in-memory source mutations caught
  at named A-markers + 5 structural/tamper inputs caught by the pure audit.
- Full regression from the final source tree: **181 PASS / 0 FAIL** (run 1) and
  **181 PASS / 0 FAIL** (run 2), identical totals (baseline 163 preserved, +18).
- `node --check` on every changed/added file: PASS. `git diff --check`: clean.

## 4. Package gate + deployment (ONE push, ONE deploy)

- `.claspignore` allowlist: **76** entries; unchanged. Path-set delta vs the
  @712 manifest (`tests/tmp/t8-package-manifest.json` at `5453d97`): **0**.
  Content delta: **`100.Code.js` only**. `99*` + all 17 HTML views: byte-identical
  to `5453d97` (22/22 files, sha256-measured). Package manifest recalculated by the
  existing T8 release gate (commit `c7aca33`).
- Pre-push `clasp status`: **76 tracked files**, set-equal to the allowlist, no
  tests/docs/tmp, no `.clasp.json`, all five Treasury runtime modules + `100.Code.js`
  + `appsscript.json` present. Upload-manifest gate PASS.
- **`clasp push --force` ×1** → Projects API content readback: 76 files, `missing []`,
  `extra []`, `localHashMismatch []`, deployed `100.Code` sha16 `e1f468ef9ebcbdab`
  = local, activation entry present. Rule 7 respected (no second push).
- **`clasp deploy` ×1** on the pinned deployment → **version 713**
  (`AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q`),
  still exactly 2 deployments, no new deployment URL. Content `?versionNumber=713`
  → HTTP 200, 76 files, activation entry present, `100.Code` sha16 `e1f468ef9ebcbdab`.
  Git push: 0.

## 5. Stage B — pre-activation recheck (read-only, all PASS)

| # | Item | Measured |
| --- | --- | --- |
| P1 | Deployment/version | pinned deployment present; `content?versionNumber=713` HTTP 200, 76 files (GET deployments omits `versionNumber` — T10-measured; live identity from `clasp deployments` @713 + versioned content) |
| P2 | Package identity | 76 files; deployed `100.Code` sha16 `e1f468ef9ebcbdab` = local; activation entry present |
| P3 | Config | `PASS` / exactly **PREPARED** |
| P4 | Schemas | Receipts 24 · Operations 10 · Audits 11, exact |
| P5 | Business rows | 0 / 0 / 0 |
| P6 | Sales V2 | `ACTIVE`, `b4791011-120e-4985-92da-a61c6311060c`, configVersion 1 |
| P7 | Destinations | 1000 / 1010 / 1020 single-occurrence, eligible |
| P8 | 1030 readiness | `treasuryClearingPreflight = PASS` |
| P9 | Canonical exposure | recognizedExposure **24,000**, 1 UNCLEARED `SCR-CE122B27-ORD677BE5CES`, integrity VALID |
| P10 | LedgerNet1030 | Dr 24,000 / Cr 0 / **Net 24,000** |
| P11 | Explicit exceptions | amount 0, entries 0, malformed 0 |
| P12 | Unexplained residual | **0** (`reconciliationStatus OK`) |

One earlier read-only precheck aborted with `BLOCKED_ACTIVATION_PRECHECK` at P1 only
(REST shape: no `versionNumber` field); **invocation count stayed 0**, zero writes.
The check was corrected to the authoritative evidence (versioned content HTTP 200 +
`clasp deployments` @713); no production state was touched and no mutation was retried.

## 6. Activation invocation — EXACTLY ONCE

```
status: ACTIVATED   writes: { sheets: 0, config: 1 }
config: { contractVersion: TREASURY_RECEIPT_V1, mode: ACTIVE,
          activationID: TRACT-419e76da-f5aa-4cff-8ead-7a15019099eb,
          activatedAt: 2026-10-10T17:49:43.513Z, configVersion: 1 }
schemas: 24 / 10 / 11 headersExact      businessRows: 0 / 0 / 0
readiness: destinations 1000/1010/1020 eligible · clearing PASS
exposure: recognizedExposure 24,000 · unclearedCount 1 · SCR-CE122B27-ORD677BE5CES
reconciliation: ledgerNet1030 24,000 · outstandingTotal 24,000 ·
                explicitExceptionAmount 0 · unexplainedResidual 0 · status OK
```

Invocation count **1** (HTTP 200). No receipt call in the same execution. No
ambiguous response.

## 7. Post-activation independent readback

- Config: `PASS`, `mode ACTIVE`, ActivationID
  `TRACT-419e76da-f5aa-4cff-8ead-7a15019099eb`, `activatedAt`
  `2026-10-10T17:49:43.513Z`, `configVersion 1`, `contractVersion TREASURY_RECEIPT_V1`
  — byte-identical to the invocation result.
- Operator workspace: `{ mode: "ACTIVE", allowed: true, code: "" }`; destinations
  readable (1000 Cash on Hand, 1010 DANA Business, 1020 Cash in Owner Custody -
  BluBCA); capability for `SCR-CE122B27-ORD677BE5CES` = `{ canSave: true,
  canCorrect: false, canReverse: false }` — Save capability now visible and
  deliberately **not** executed.
- Schemas unchanged 24/10/11; business rows still 0/0/0; sheet count 41 → 41.
- Protected surfaces (16): **0 changed** (sha256-identical before/after activation).
  BalanceLedger 8 rows, sha `ca572515a683c19c` — identical; Accounts 22 rows,
  identical; SalesRecognitionEvents/Audits identical; Sales V2 config identical.
- 1030 same state: net 24,000, outstanding 24,000, residual 0 (`OK`) — money is
  unverified and stays outstanding; no clearing, no Cash/Bank movement.
- Exposure still visible: 24,000 UNCLEARED, integrity VALID.

## 8. Gate B (first genuine receipt) — CLOSED

Owner supplied no genuine receipt evidence. Decision **NO**; not executed. No
synthetic receipt, no guessed destination, no placeholder EvidenceRef, no inferred
payment, no 1030 clearing. Counts held at zero: genuine-receipt invocations 0 ·
Treasury receipt rows 0 · operation/audit rows 0 · production financial writes 0.

## 9. Mutation accounting

| Class | Count |
| --- | --- |
| Activation invocations | **1** |
| Treasury config writes | **1** (PREPARED → ACTIVE; before ≠ after by exactly this one property) |
| Receipt / Operation / Audit rows | **0 / 0 / 0** |
| BalanceLedger / Sales / Accounts deltas | **0 / 0 / 0** (protected-surface delta 0) |
| `clasp push --force` | **1** |
| `clasp deploy` (version creation) | **1** (version 713) |
| Git push | **0** |
| Synthetic receipt / placeholder evidence | **0** |

## 10. Validation and evidence classes

Local/static ✓ (181 PASS ×2, syntax, `git diff --check`, call-graph audit) ·
clasp upload ✓ (status gate, push ×1, Projects API content hash match 76/76) ·
Apps Script runtime ✓ (Execution API: read-only precheck ×2, activation ×1 with
structured result, readback ×1) · browser n/a (no UI change; UI files
byte-identical).

## 11. Telemetry

agent numlock-critical (in-session) · backend/model `9router/numlock-explore-free`
· reasoning high · fallback not used · delegation none · toolcalls not
instrumented (UNKNOWN) · elapsed not instrumented (UNKNOWN) · files modified:
`100.Code.js` (activation block), `_test_runner.js` (registration),
`tests/tmp/t8-package-manifest.json` (recalculated by the T8 gate) · files added:
`96.Tests.Treasury.Activation.Cases.js`,
`tests/browser/treasury-t105-activation-mutation-proof.js`, this doc · untracked
harnesses (never staged): `tests/tmp/t105-*` · test runs: 1 × 163 PASS (baseline) +
2 × 181 PASS from the final tree · production actions: 0 writes before Stage B,
1 config write, 1 activation invocation, ~5 read-only API batches.

## 12. Next recommendation

Gate B — first genuine receipt — remains a **separately gated** task: it requires
owner-supplied genuine receipt evidence (amount, destination account, evidence ref,
dates), preview + owner inspection, and its own authorization. Nothing in this
task pre-authorizes it. PAUSED/RESUME likewise remains a separate, explicitly
authorized config mutation.
