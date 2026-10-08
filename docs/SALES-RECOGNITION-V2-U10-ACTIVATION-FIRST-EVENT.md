# SALES_RECOGNITION_V2 — U10 Activation + First Event Evidence

TASK_ID: U10-ACTIVATION-FIRST-EVENT-01 · Complexity L3 · Operational risk R4 · Reasoning high
Backend/model `9router/numlock-explore-free` (numlock-critical, executed in-session).

**STATUS: `BLOCKED` — exact code `BLOCKED_CAPABILITY`. Production state:
`PREPARED / disabled`.**

Activation could not be executed: the deployed production package contains **no
code path that can write the authoritative config Script Property**
`SALES_RECOGNITION_V2_CONFIG`, and the two remaining channels (a new writer
function via `clasp push`, an Apps Script editor UI write) are respectively
explicitly not authorized in this task and outside agent capability. Per the
task's environment-reality rule, everything possible was executed read-only and
the exact measured state is recorded below. **Zero production writes, zero
config writes, zero economic events, zero `clasp push`, zero Git push.** No
Sale was attempted (activation gate not passed).

## 1. U9 baseline re-verification (measured, fresh)

- Repo `/Users/azer/Documents/GitHub/Numlock`; required HEAD `dc7db0e` =
  actual `dc7db0ee7d1a44ee67912183edbd445d38eca780` ✓; worktree clean at start
  ✓ (only `tests/tmp/` probe scratch added during this task, removed before
  final validation).
- Deployment inventory: exactly **2** deployments — head deployment
  (`@HEAD`, no pinned version, `updateTime = 2026-10-08T18:07:02.529Z` = the
  single U9B push) plus pinned version **705**. No third deployment, no second
  push since U9 ✓.
- Deployed content (`projects.getContent`) = **67 files**, `missingOnDeploy =
  []`, `contentMismatch = []` against the local `dc7db0e` package (byte
  comparison, CRLF-normalized) ⇒ deployed runtime **matches the authorized
  67-file audited package** exactly, including all five V2 files
  (`97`, `97A`–`97D`) ✓.
- `clasp status` tracked manifest = **67 files** ✓ (upload-manifest gate
  satisfied read-only; no push attempted).
- Version **706** (description `list`, created 2026-10-08T18:03:07.025Z) exists;
  **no deployment references version 706** (deployments = head + 705) ✓.
  Inert audit note only — not deleted, not repointed, not used.

## 2. Immediate preflight (fresh read, MEASURED)

### 2.1 Config (Execution API, identity `numlock-run`)

- `salesRecognitionV2OperatorConfig()` → HTTP 200 →
  `{contractVersion:"SALES_RECOGNITION_V2", mode:"PREPARED", activationID:"",
  activatedAt:"", configVersion:1}` ✓ (T absent, ActivationID absent).
- `salesRecognitionV2DefaultConfig()` → HTTP 200 → the identical PREPARED
  default ⇒ observed config is the U1 default, nothing supersedes it.
- Discriminator probe `salesRecognitionV2OperatorConfig({mode:
  "SENTINEL_PROBE_NO_PROPERTY", …})` → sentinel returned **unchanged** ⇒ **no
  valid script-property config override exists** (0 config writes; the sentinel
  is never written anywhere).
- `salesV2OperatorResolvedRoute_` → HTTP 403 `PERMISSION_DENIED` (trailing
  underscore refused by the Execution API — same measured behavior as U9B-8);
  read-only, no side effect.
- Conclusion: `mode = PREPARED`, `activatedAt`/T empty, `ActivationID` empty,
  `contractVersion` exact, `configVersion = 1` — direct runtime observation.

### 2.2 Accounts (Sheets REST, read-only)

22 data rows, 9-col header exact, **no duplicate AccountCode**:

| Code | Result |
| --- | --- |
| 1030 | count=1 exact+unique, `Sales Settlement Clearing / Asset / Current Assets / Operating / TRUE / DEBIT` ✓ |
| 2010 | count=1 exact+unique, `Customer Refund and Credit Payable / Liability / Current Liabilities / Operating / TRUE / CREDIT` ✓ |
| 4000 | count=1, `Sales Revenue / Revenue / Operating Revenue / Operating / TRUE`, `NormalBalance` blank = frozen legacy convention, unchanged ✓ |
| 6210 | count=1 valid/active ✓ |
| 2000 | count=1, `CREDIT`, unchanged ✓ |

Accounts sheet SHA-256 prefix `f97cbe167e6a9364` (22 data rows) recorded as
first-event comparison baseline.

### 2.3 Companions

- `SalesRecognitionEvents`: 20-col header **exact** vs frozen contract, **0
  business rows** (SHA-256 prefix `68b0170fb583d752`) ✓.
- `SalesRecognitionAudits`: 10-col header **exact**, **0 business rows**
  (SHA-256 prefix `d166256b8be8f1d3`) ✓.
- Workbook sheet inventory = **38** (36 original + exactly the 2 authorized
  companions) ✓.

### 2.4 Business artifacts / V2 artifacts

- TransactionOperations 2 data rows — legacy `ORDER_CREATE` + `PAYMENT`, both
  `COMMITTED`; 0 V2 operations.
- Orders 1 (legacy), OrderLines 1 (legacy), BalanceLedger 6 (legacy),
  Payments 1, Settlements 2, InventoryLedger **0**, Logs 225,
  tabsal 10808, tabops 1976 — all **0 V2 markers** (`SRV2`/`SRV2J`/
  `SALES_RECOGNITION`/`V2_COMMITTED`) across 11 scanned surfaces ✓.
- V2 business artifacts = 0 everywhere (ops/orders/recognition events/journals/
  Correct-Void) → no unexpected artifact → no STOP condition.

### 2.5 Protected-surface pre-first-event baseline (for Phase 9 comparison)

| Surface | data rows | SHA-256 prefix |
| --- | --- | --- |
| Accounts | 22 | `f97cbe167e6a9364` |
| TransactionOperations | 2 | `f6a36c66d8810257` |
| Orders | 1 | `a9d6312610aa6ac7` |
| OrderLines | 1 | `65aeb1fa0d083e1b` |
| BalanceLedger | 6 | `adb94c73ee03e9fd` |
| Payments | 1 | `e357140d51acf6fc` |
| Settlements | 2 | `1b3a361e0f014464` |
| InventoryLedger | 0 | `b750a6c453934c23` |
| Logs | 225 | `5005a024663f4c56` |
| tabsal | 10808 | `db160e397fb80870` |
| tabops | 1976 | `c8754e64eca27628` |
| SalesRecognitionEvents | 0 | `68b0170fb583d752` |
| SalesRecognitionAudits | 0 | `d166256b8be8f1d3` |

## 3. Phase 2 — activation mutation: BLOCKED (0 attempts, 0 writes)

Activation semantics require writing Script Property
`SALES_RECOGNITION_V2_CONFIG` =
`{mode:"ACTIVE", contractVersion:"SALES_RECOGNITION_V2", activationID:"<new-id>",
activatedAt:"<server ISO-8601 instant ≠ 2026-10-01, ≠ 2026-10-06T18:50:05.328Z,
≠ commit/deploy/U9-prep time>", configVersion:1}` (U9R §9 step 6).

Measured channel analysis (read-only; no speculative write was attempted):

1. **Deployed-runtime writer — ABSENT.** Full source scan of the exact deployed
   67-file package: `setProperty(` occurs only in `90.Dashboard.Service`
   (`NUMLOCK_DASHBOARD_CACHE_REVISION`, fixed key, incremented counter);
   `SALES_RECOGNITION_V2_CONFIG` is referenced only by
   `97D.SalesRecognition.V2.OperatorGuard.js` as a **reader**
   (`salesV2OperatorConfigState_` — comment and code: "Never mutates
   properties, never writes T/ActivationID"). Therefore no callable Execution
   API function (the 403-on-trailing-underscore class notwithstanding) can
   perform the activation write.
2. **Platform REST — ABSENT.** Google exposes no Script Properties read/write
   surface over REST (Apps Script API covers projects/versions/deployments/
   executions only). Sheets/Drive scopes cannot touch script properties.
3. **New writer function — NOT AUTHORIZED.** Adding one would require another
   `clasp push --force`; this task explicitly forbids "another clasp push", and
   Rule 7 prohibits a second push without a NEW explicit task authorization.
4. **Apps Script editor UI write — outside agent capability.** The repository's
   browser contract is ephemeral contexts only (no persistent profile, no
   personal profile, no credentials); Chrome is running under the owner's
   session. Editor/Project-Settings property editing is a human action.

Consequence: **ActivationID not created, T not recorded, mode remains
`PREPARED`**, Phase 3 readback not applicable, Phases 4–9 not entered, first
Sale count = 0 (correct: the activation gate did not pass, so no Sale may be
created). No blind or speculative write was issued; no retry performed.

## 4. Failure classification (task §FAILURE/CONTAINMENT)

- **Case A does not apply** (activation was not attempted and did not partially
  fail) and **Case B does not apply** (production is not ACTIVE).
- Correct classification: **environment-reality capability blocker** —
  `BLOCKED_CAPABILITY`, production state confirmed **`PREPARED`** (measured
  readback, §2.1). No containment action required: no mutation exists to
  contain. `PAUSED` not used (no proven post-activation acceptance failure).
- Production config after this task: unchanged `PREPARED / "" / "" / 1`;
  protected surfaces unchanged from §2.5 (zero write endpoints called).

## 5. Acceptance criteria (29) — measured status

| # | Criterion | Result |
| --- | --- | --- |
| 1 | preflight passes | **PASS** (MEASURED, §2) |
| 2–6 | activation writes exactly once / ACTIVE readback / T / ActivationID / zero business event at activation | **NOT REACHED** (`BLOCKED_CAPABILITY`, 0 writes) |
| 7–23 | first Sale, Order, recognition, journal, audit, U3/U4/U5, parity, delta | **NOT REACHED** (no activation ⇒ no Sale permitted) |
| 24 | config stable | **PASS trivially** — config never mutated (readback = PREPARED/""/""/1) |
| 25 | no manual repair | **PASS** |
| 26 | no Treasury (1030/2010/Payments/Settlements untouched) | **PASS** (0 write endpoints) |
| 27 | no second Sale | **PASS** (0 Sales) |
| 28 | no additional `clasp push` | **PASS** (0 pushes; deployments still 2; `updateTime` unchanged) |
| 29 | no Git push | **PASS** (local evidence commit only) |

Verdict: 1/29 reached as acceptance; criteria 2–23 blocked. Status therefore
**BLOCKED**, not `COMPLETE`, and `SALES_RECOGNITION_V2` does **not** become
`PRODUCTION_ACTIVE_ACCEPTED`.

## 6. Deviations / limitations (honest residuals)

1. Deviation: activation authorization could not be exercised — capability
   absent (§3), not a refusal of authorization.
2. Version 706 remains (inert, unreferenced); no cleanup performed or proposed.
3. `salesV2OperatorResolvedRoute_`/other trailing-underscore entry points stay
   Execution-API-403; raw Script Property value cannot be displayed
   (structural proof: `SENTINEL` probe + no valid override ⇒ PREPARED default).
4. Local regression not re-run: HEAD `dc7db0e` unchanged from the U9-accepted
   artifact (91 PASS / 0 FAIL measured at U9); this task changed no source.

## 7. Reviewable proposal for the owner (next gate)

Choose exactly one channel; each needs its own explicit authorization:

- **Option A (recommended, contract-faithful):** NEW task authorizing exactly
  ONE additional `clasp push --force` of a minimal activation writer
  (pre-write `PREPARED`+no-T+no-ActivationID check, server-generated
  ActivationID + server `new Date()` T, single property write, post-write
  readback), then this task's Phases 3–9. Rule 7 exception must be explicit.
- **Option B (manual, deviates from "server-recorded T"):** owner writes the
  property in Apps Script editor → Project Settings → Script Properties:
  key `SALES_RECOGNITION_V2_CONFIG`, value
  `{"mode":"ACTIVE","contractVersion":"SALES_RECOGNITION_V2","activationID":"<owner-chosen-unique-id>","activatedAt":"<owner-chosen ISO-8601 instant ≠ 2026-10-01 and ≠ 2026-10-06T18:50:05.328Z>","configVersion":1}`
  — then a follow-up task performs readback and the first genuine Sale.
  T would be typed, not server-generated: record as a contract deviation.

No Treasury, no 2010 posting, no Correct/Void, no second Sale, no historical
rewrite, no version-706 cleanup, no Git push is implied by either option.

## 8. Validation and telemetry

- Validation performed: `git rev-parse HEAD` / `git log` (baseline) ·
  `clasp status` (67 tracked) · `clasp list-deployments` (2) · Apps Script
  REST `projects.get`, `versions.list`, `deployments.list`, `projects.getContent`
  (67 files, 0 mismatch) · Sheets REST metadata + value reads + marker scans
  (read-only) · Execution API 4 read-only invocations (3×200, 1×403) ·
  `git diff --check` clean · `git status --short` = evidence doc only.
  MEASURED.
- Local test runs this task: **0** (no source change; U9 baseline 91 PASS /
  0 FAIL at identical HEAD stands).
- Mutations: production data 0 · production schema 0 · config 0 · economic
  events 0 · `clasp push` 0 · Git push 0 · local evidence commit 1.
- Telemetry: agent numlock-critical (executed in-session); backend/model
  `9router/numlock-explore-free`; reasoning high; fallback not used;
  delegation none (no delegation tool in session); toolcalls UNKNOWN (not
  instrumented); elapsed UNKNOWN (not instrumented); files read: `AGENTS.md`,
  `97`/`97A`–`97D`, `95A`, `90`, `36`, `.claspignore`-driven manifest,
  `docs/SALES-RECOGNITION-V2-U9-*.md`, live workbook + script-project reads;
  files modified: this document only (+ temporary `tests/tmp/u10_probe.mjs`,
  deleted). No secrets, no scriptId, no tokens recorded.
