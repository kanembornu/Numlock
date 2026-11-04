# SALES_RECOGNITION_V2 — U10 Activation + First Event Evidence

TASK_ID: U10A-ACTIVATION-CLOSURE-01 (successor to U10-ACTIVATION-FIRST-EVENT-01) · Complexity L3 · Operational risk R4 · Reasoning high
Backend/model `9router/numlock-explore-free` (numlock-critical, executed in-session).

**STATUS: `ACTIVE_UI_ACCEPTED_WAITING_FOR_FIRST_REAL_EVENT` — canonical
deployment **709** (display fix `ad4857f`) serves the ACTIVE V2 operator
surface; fresh-session production acceptance **27/27 PASS**; first genuine
Sale not yet available. Activation identity unchanged
(`b4791011-120e-4985-92da-a61c6311060c`, `2026-10-08T18:59:50.540Z`).**
(U10A activation acceptance `ACTIVATED_WAITING_FOR_FIRST_REAL_EVENT` remains
the activation-stage result.)

### 0.1 Activation-writer closure (implementation)

New file `97E.SalesRecognition.V2.Activation.js` (registered in
`.claspignore` upload manifest):

- Public entry `salesRecognitionV2Activate()` — zero parameters; acquires
  `LockService.getScriptLock()` before any read/write; releases once.
- Core `salesRecognitionV2ActivateWithRuntime_(runtime)` — fixture-injectable;
  never locks (outer owns lock).
- Exactly one logical Script Properties mutation:
  `setProperty("SALES_RECOGNITION_V2_CONFIG", JSON.stringify(activated))`.
- Preconditions (fail closed, no write): valid PREPARED (absent property → U1
  default); empty T; empty ActivationID; exact contractVersion; U2 schema gate
  (`salesRecognitionV2SaveSchemaGate_`); U1 account preflight
  (`preflightSalesRecognitionAccounts` on 1030/2010/4000); Events rows=0;
  Audits rows=0; 0 V2 operation rows.
- Server identity only: ActivationID from `runtime.uuid()` (`Utilities.getUuid`
  in production); T from `runtime.now()` (`new Date()` in production,
  `toISOString()`); never client-supplied; never version 706/commit/Order.
- Forbidden instant `2026-10-06T18:50:05.328Z` still rejected by U1 validator
  before write.
- Immediate readback + exact five-field equality; mismatch →
  `ACTIVATION_READBACK_MISMATCH`, no repair.
- Idempotent reinvocation after exact activation → `ALREADY_ACTIVE`, same
  identity, **zero** additional writes.
- Conflicting/malformed PAUSED/ACTIVE/PREPARED-with-metadata/wrong-contract →
  fail closed.
- No Sales/Order/journal/Payment/Settlement/InventoryLedger side effects.
- No generic config editor; no pause/resume/disable API. 97D reader path
  unchanged (still never calls `setProperty`).

### 0.2 Local tests + mutation proof (MEASURED)

- Suites: `testSalesRecognitionV2ActivationCore` (A1/A2/A3/A11/A12),
  `testSalesRecognitionV2ActivationFailClosed` (A4–A10 + PAUSED + forbidden T),
  `testSalesRecognitionV2ActivationSourceAudit` (15 items + pub-entry).
- Mutation proof `tests/browser/sales-v2-u10-activation-mutation-proof.js`:
  8/8 SENSITIVITY_PROVEN (M1 client ID, M2 client T, M3 regenerate ID,
  M4 regenerate T, M5 write before/without clean write-count, M6 skip account
  preflight, M7 skip schema preflight, M8 activation writes recognition event).
- Full local harness: **95 PASS / 0 FAIL** (`node _test_runner.js`),
  MEASURED after final source modification. Baseline ≥91 preserved; +4 new
  suites (3 activation + 1 proof).
- `node --check` on all new/changed JS: PASS.
- `git diff --check`: clean.

### 0.3 Upload-manifest edits (related only)

- `.claspignore`: `!97E.SalesRecognition.V2.Activation.js` registered.
- `tests/browser/sales-v2-u8-release-audit.js`: 97E added to ACTIVE-mode
  allowlist and V2 upload-registration list (otherwise U8 audit fails closed).
- `_test_runner.js`: load 97E + activation cases + U10 proof; register 4 runs.

### 0.4 Deployment candidate + authorized second push (MEASURED)

- Deployment candidate commit: **`56df101`** (`56df101c6b87f7779a476b19264eacef6fe50b9a`)
  — capability, tests, U8 audit allowlist, runner, upload-manifest, this doc.
- Worktree clean before push ✓. Explicit-path staging only ✓. No Git push.
- Fresh pre-push production (Execution API + Sheets REST, identity
  `numlock-run`): mode=`PREPARED`, T empty, ActivationID empty,
  contractVersion exact, configVersion=1; Events dataRows=0 (sha
  `68b0170fb583d752`); Audits dataRows=0 (sha `d166256b8be8f1d3`);
  TransactionOperations 2 legacy rows, **v2Ops=0** (sha `f6a36c66d8810257`);
  Accounts 22 rows, 1030/2010/4000 exact+unique+active (sha
  `f97cbe167e6a9364`); Orders 1; BalanceLedger 6. Deployed
  `salesRecognitionV2Activate` → `FUNCTION_NOT_FOUND` before push.
- `clasp status` tracked manifest: **68** files (includes 97E) ✓.
- Deployments before push: still 2 (head + 705).
- **Exactly ONE** `clasp push --force` executed by the agent (Rule 7 exception
  for this task only): **PUSHED 68 files**. No third push performed or
  permitted.
- Unintended side effect (recorded, not repaired): a exploratory
  `clasp version` invocation created inert version **707** (no deployment
  references it). Not deleted (destructive op not authorized); not used.

### 0.5 Post-push verification (MEASURED)

- `projects.getContent` (Execution API identity): **68 files**; 97E present as
  `97E.SalesRecognition.V2.Activation`; source **byte-match** local candidate
  (sha256 prefix `fcbd3404cadd756e` both sides).
- Deployed source contains `function salesRecognitionV2Activate(`.
- Config after push, before activation invocation:
  **`PREPARED / "" / "" / 1`** ✓ (deployment itself did not activate).
- Deployments still 2 (head + pinned 705).

### 0.6 Activation invocation (EXACTLY ONCE, MEASURED)

- Entry: Execution API `POST /v1/scripts/{id}:run` →
  `salesRecognitionV2Activate` (zero parameters). Identity `numlock-run`.
- Result HTTP 200:
  `{status:"ACTIVATED", code:"", config:{mode:"ACTIVE",
  contractVersion:"SALES_RECOGNITION_V2",
  activationID:"b4791011-120e-4985-92da-a61c6311060c",
  activatedAt:"2026-10-08T18:59:50.540Z", configVersion:1}}`
- **ActivationID** = `b4791011-120e-4985-92da-a61c6311060c` (server UUID).
- **T** = `2026-10-08T18:59:50.540Z` (server `new Date().toISOString()` at
  activation instant; ≠ forbidden `2026-10-06T18:50:05.328Z`; ≠ commit/deploy/
  U9-prep time; not client-supplied).
- No manual Script Property edit. No second invocation.

### 0.7 Post-activation hard gate (MEASURED) — ACCEPTED

- Three independent `salesRecognitionV2OperatorConfig` reads: field-canonical
  identity **stable**:
  `ACTIVE|SALES_RECOGNITION_V2|1|b4791011-…|2026-10-08T18:59:50.540Z`.
- `salesRecognitionV2DefaultConfig` still PREPARED (U1 default unchanged).
- Surfaces (Sheets REST, immediate post-activation):
  Events 0 (sha `68b0170fb583d752`); Audits 0 (sha `d166256b8be8f1d3`);
  TransactionOperations 2 / v2Ops 0 (sha `f6a36c66d8810257`); Orders 1 (sha
  `a9d6312610aa6ac7`); OrderLines 1; BalanceLedger 6 (sha
  `adb94c73ee03e9fd`); Payments 1; Settlements 2; InventoryLedger 0;
  Accounts 22. **No business artifact delta from activation.**
- `POST_ACTIVATION_ACCEPTED: true`.

### 0.8 First real event — WAITING

No genuine customer Sale was available to the operator in this session.
Per frozen U10 contract: **no dummy/test Sale created**. Status =
`ACTIVATED_WAITING_FOR_FIRST_REAL_EVENT`. Production remains ACTIVE with the
ActivationID/T above. Next step is a real operator flow
`Create → OrderType → ProductVariant line(s) → Save → Done` (no payment/
fulfillment continuation), then U10 acceptance (identity chain, Dr1030/Cr4000,
U3/U4/U5 parity, protected delta).

### 0.9 Confirmations

Exactly one additional `clasp push --force` · no third push · no manual
property edit · no Treasury · no 2010 posting · no fake Sale · no Correct/Void
test · no historical rewrite · no version-706 cleanup (707 created
accidentally inert, not cleaned) · no Git push.

### 0.10 Validation + telemetry

- Local: `node _test_runner.js` **95 PASS / 0 FAIL** MEASURED; `node --check`
  new/changed JS PASS; `git diff --check` clean.
- Production: 1 activation invocation (success); 0 economic events; 1
  authorized push; 0 Git push.
- Agent numlock-critical (in-session); backend/model
  `9router/numlock-explore-free`; reasoning high; fallback not used;
  delegation none.

---

## Predecessor evidence (U10-ACTIVATION-FIRST-EVENT-01, preserved)

Predecessor task U10-ACTIVATION-FIRST-EVENT-01 (HEAD `dc7db0e`/`11c35b0`
evidence) returned `BLOCKED_CAPABILITY`: deployed runtime had no authorized
mutation primitive for `PREPARED → ACTIVE`. Full predecessor measurement is
retained unchanged in §1–§8 below.

Owner Option A (this task) explicitly authorizes exactly:
1. minimal production activation writer implementation;
2. local tests;
3. **ONE** additional `clasp push --force` (explicit one-time Rule 7 exception);
4. invoke the writer **exactly once** to activate;
5. previously authorized U10 first-genuine-event acceptance.

No other deployment, no manual Script Property edit, no Treasury, no 2010,
no fake Sale, no Correct/Void test, no second Sale, no version-706 cleanup,
no Git push, no historical rewrite.

**STATUS at predecessor completion: `BLOCKED` — exact code `BLOCKED_CAPABILITY`.
Production state: `PREPARED / disabled`.**

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

---

## Operator Surface Mismatch (U10B-UI-DIAGNOSIS-01, 2026-10-09)

TASK U10B-UI-DIAGNOSIS-01 · L3/R2 read-only production diagnosis · local
tests/docs only. Repo HEAD `ea980c9`, worktree clean at baseline. Status:
`U10_FIRST_EVENT_ACCEPTANCE = BLOCKED_OPERATOR_SURFACE`. Production writes
this task: 0. First V2 Sale: 0. No deploy, no push, no PAUSE, no Sale.

### B1. Owner-observed UI (authoritative observation)

Production web app `/macros/s/.../exec` → New Transaction → Sales showed the
legacy lifecycle surface: `Order review`, `Order tidak ditemukan.`,
`Save Order`, `Continue existing order`, `Order number`, `Find Order`,
`No open orders.`, and **Save Transaction disabled** despite valid product/
type/qty/price/HPP preview and `Entry options ready`.

### B2. Served deployment identity

- Production entry `index.html` (repo root) redirects/links to canonical
  deployment `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q`
  = `docs/RELEASE.md` production deployment ID. Owner URL string was elided
  in the task; direct API confirmation (`clasp deployments` /
  `clasp status` / deployments REST) was **attempted once and denied
  (`BLOCKED_PERMISSION`)** this session — no retry.
- Recorded MEASURED state (U10A §0.5, after the single U10A push):
  deployments = exactly 2 — head deployment + canonical pinned **version
  705**; the push did NOT move the canonical pin.
- Conclusion: the canonical production `/exec` serves **immutable version
  705**. `clasp push --force` updates only the head deployment; pinned
  deployments keep serving their version snapshot. Residual UNKNOWN: exact
  owner URL string (if the owner used the head-deployment URL instead, served
  code would be current; documentary evidence points to canonical).

### B3. HEAD vs served artifact

Git ancestry: version-705 source = push at `ef8c4b5` ("sales: harden open
orders transport"); `ef8c4b5` is an ancestor of `294cbc9` (sales-v2 U1) and
of `ccf42c6` (U7). Therefore v705 contains **zero** sales-v2 code.

| Artifact | Project HEAD `ea980c9` | served canonical `/exec` @705 |
| --- | --- | --- |
| `97D` OperatorGuard (mode routing, guards) | present | **absent** |
| `97E` Activation writer | present | **absent** |
| `97`/`97A`–`97C` V2 save/projection/correction | present | **absent** |
| `193` Render U7 `salesV2Row` Correct/Void gate | present | pre-U7 |
| `195` Actions U7 (`salesV2OperatorVisibleOrder_`, V2 mutation routing, order transport DTO) | present | pre-U7 |
| `194` `var validSales = false;` (Save Transaction dead for Sales, since `37df7ee` 2026-10-06) | present | **same** |
| `190` dialog legacy controls (all 8 observed strings, since `37df7ee`) | present | **same** |
| ACTIVE UI routing | server-side, per call (97D) | **none — config never read** |

Divergence range: commits `294cbc9`..`ea980c9` (U1–U10A) absent from v705.

### B4. Legacy element source mapping

| element | source | PREPARED @HEAD | ACTIVE @HEAD | observed | match HEAD? |
| --- | --- | --- | --- | --- | --- |
| Order review | `190` `#operationalOrderHeading`; section unhidden by `setTransactionEntryType('SALES')` (`194:189`) | visible on Sales | visible on Sales (client mode-blind) | visible | yes |
| Save Order | `190` `#operationalSaveOrder` → `saveOperationalOrder()` (`195:119`) | visible/enabled; routes legacy | visible/enabled; routes **V2 via server** | visible | yes |
| Continue existing order / Order number / Find Order | `190:3505` → `lookupOperationalOrder()` | visible | visible | visible | yes |
| Order tidak ditemukan. | `195:133` (Find Order miss) | reachable | reachable | shown | yes |
| No open orders. | `195:137` (`listOpenOperationalOrders` empty) | reachable | reachable | shown | yes |
| Save Transaction | `190:3676` disabled attr + `194` `updateTransactionEntrySubmitState()` | **always disabled for Sales** | **always disabled for Sales** | disabled | yes |

All eight observed elements are reproducible from HEAD source — UI appearance
alone does NOT discriminate the served deployment (MEASURED by new harness
below).

### B5. Mode propagation trace (all 10 questions)

Client is mode-blind **by design** (`docs/SALES-RECOGNITION-V2-U7.md` §9):
1. mode embedded at initial load? **No** (no config/mode tokens in
   `190`/`193`/`194`/`195` — harness S2).
2. New Transaction fetches mode? **No** (loads entry options + operational
   authority only; neither carries config).
3. mode cached client-side? **No** — no client mode variable exists.
4. PREPARED embedded at HTML render? **No.**
5. default-PREPARED client fallback? **None client-side.** Server (≥U7):
   absent property → U1 default PREPARED; present-invalid → `REJECT`
   fail-closed, never legacy.
6. config-fetch failure silently selects legacy? **No** in ≥U7 source
   (`salesV2OperatorConfigState_` unresolved → `REJECT`). Served v705:
   config never consulted → legacy always, by **absence of code**.
7. client routes ACTIVE through U7? Client never routes by mode; server
   `submitOperationalOrder` → `salesV2OperatorModeCreateOrder_` → U2 save;
   client only adapts to response cohort (hides payment/fulfillment, renders
   "Recognized").
8. browser refresh obtains new mode? Mode re-resolved server-side on every
   call (≥U7); refresh is irrelevant to mode. On served v705 a refresh
   re-fetches the same stale artifact.
9. already-open tab retains pre-activation state? Client holds no mode, so no
   tab-stale mode state; on v705 every tab serves stale code regardless.
10. ACTIVE backend coexist with PREPARED-like client/server? **Yes — this is
    the measured current production state** (Script Property ACTIVE +
    served pre-mode artifact).

### B6. Save-disabled root cause (exact condition)

`194.View.Transactions.Forms.html` → `updateTransactionEntrySubmitState()`:
`var validSales = false;` (line 39) is **never reassigned** (exactly two
`validSales` occurrences in the file). For `transactionType === "SALES"`:
`validSales=false`, `validExpense=false`, `INVENTORY_RECEIPT` false ⇒
`!(false || false || false)` ⇒ `entry.submit.disabled = true`
**unconditionally**. Introduced by `37df7ee` (2026-10-06, ancestor of v705);
identical in HEAD and served artifact. Not Add Line, not OrderID, not
open-order, not payment state, not mode flag. Add Line gates only `Save
Order` (empty lines ⇒ "Pilih item." refusal, button stays enabled).

### B7. Browser/cache finding

`STALE_BROWSER_STATE_NOT_ROOT_CAUSE`. The canonical deployment pins an
immutable version: reload / hard reload / new tab / cache-bust all re-fetch
version-705 HTML+JS from the same URL. No client-side action can obtain
U7/U10A code from that deployment. (No owner "clear data" advice.)

### B8. Backend guard safety (source + local tests; zero production tests)

- **HEAD-served code: SAFE (MEASURED locally, part of 96/0).** ACTIVE →
  `salesV2OperatorLegacySalesGuard_` refuses canonical SALES pre-lock;
  `salesV2OperatorModeCreateOrder_` routes Save Order to U2 only, V2 failure
  never falls back to legacy; PAUSED/REJECT refuse before writes; payment/
  fulfillment guards refuse on V2 evidence (U7 suites T3a–T3i, G1–G3).
- **Served v705: NOT SAFE.** The artifact contains none of these guards and
  never reads `SALES_RECOGNITION_V2_CONFIG`; a Save Order against the served
  deployment would create a **legacy Order despite ACTIVE config**. No such
  mutation occurred (owner did not save; Save Transaction disabled; baseline
  Orders=1 / V2 ops=0 not re-measured this session, see B9).
- PAUSE would NOT contain the stale artifact (it ignores config entirely);
  effective containment = deployment remediation + owner not saving. No
  immediate containment action taken; PAUSE not used.

### B9. Production re-verification (read-only attempts, MEASURED denial)

Config/Sheets/Execution reads this session: `clasp status` → denied,
`clasp deployments` → denied, allowlisted deployments REST curl → denied —
**exact state `BLOCKED_PERMISSION`** (single attempt each, no retry). Last
MEASURED production state remains U10A §0.6–0.7 (2026-10-08): mode ACTIVE,
ActivationID `b4791011-120e-4985-92da-a61c6311060c`,
T `2026-10-08T18:59:50.540Z`, Events 0, Audits 0, v2Ops 0, Orders 1. This
task invoked zero production endpoints and performed zero writes; state is
presumed unchanged but **not re-measured this session**.

### B10. Local harness (MEASURED)

New suite `tests/browser/sales-v2-u10b-operator-surface.js` (registered in
`_test_runner.js`): loads real `194`+`195` into the in-memory DOM/`google.
script.run` harness; S1 all 8 observed strings present at HEAD; S2 client
mode-blind (no config/mode tokens in any view file); S3 `validSales`
constant-false; S4 **reproduces the observed disabled Save Transaction from
HEAD source with fully valid Sales input** + EXPENSE control enables; S5 Save
Order refuses empty lines and becomes eligible after a valid line state,
routing to `submitOperationalOrder`; S6 mode-routing + activation symbols
exist only in `97D`/`97E`. `node _test_runner.js` → **96 PASS / 0 FAIL**
(MEASURED after final source modification); `node --check` new/changed JS →
PASS.

### B11. Root-cause classification

**Primary: A `SERVED_WEBAPP_DEPLOYMENT_STALE`.** Production entry serves
canonical deployment pinned at **version 705**, whose tree predates all
sales-v2/U7/U10A code; activation changed only the Script Property
(deployment-independent), so the operator's web app runs a pre-mode legacy
artifact that can neither render/route the V2 flow nor produce a first V2
Sale, and lacks every ACTIVE guard. First-event acceptance is therefore
blocked at the served artifact, not at the browser.

Recorded contributing design factors (do not change the primary class):
- U7 deliberate limitation: client surface is legacy-shaped and mode-blind in
  ALL modes even at HEAD — after deployment remediation the owner will still
  see `Order review`/`Save Order`/`Find Order`; the operable V2 save control
  is `Save Order` (server-routed), not `Save Transaction`.
- `Save Transaction` is permanently disabled for Sales at HEAD (B6) —
  pre-existing since `37df7ee`, present in v705 too.
Not B (no client mode propagation exists to defect), not C (U7 routing works
locally, 96/0), not D (browser state cannot change a pinned artifact), not F.

### B12. Minimum remediation (DO NOT EXECUTE here)

- **Deployment (required):** move the canonical production deployment off
  version 705 onto a version containing the post-U10A code (e.g.
  `clasp update-deployment <canonical-id> -V <new-version>` after creating
  that version from the already-pushed HEAD tree; verify manifest first).
  This is a **deployment mutation → `NEW OWNER AUTHORIZATION REQUIRED`**; a
  third `clasp push` would also require new authorization (prior push
  authorization is not consumed/reused; Rule 7).
- **Source (optional, separate task):** additive client-visible mode signal
  per U7 §9 upgrade path + explicit decision on Sales `Save Transaction`
  enablement — only if the owner wants a visibly distinct V2 surface.
- **Browser-only action: NOT sufficient** (B7).
- Verification after authorized remediation: deployment version readback +
  fresh-session production page shows current artifact + operator performs
  the first genuine V2 Sale; then U10 first-event acceptance.

---

## U10C ACTIVE Operator Surface + Canonical Deployment Repair (2026-10-09)

TASK `U10C-SURFACE-CLOSURE-01` · L3 / **R4** · repo HEAD `1104ec9` clean at
baseline (verified first; mismatch would have stopped the task).
Production writes this task: **0**. First V2 Sale: **0**. No fourth push, no
Git push, no Treasury, no historical rewrite.

### C1. Root-cause closure (both defects)

| # | Defect | Closure |
| --- | --- | --- |
| 1 | `SERVED_WEBAPP_DEPLOYMENT_STALE` — canonical `/exec` pinned to version **705** (pre-U1 tree) | canonical deployment `AKfycbxyll…ZXAzPkkSEhbwZKxkX6q` re-pointed **705 → 708** (one existing deployment, no second URL) |
| 2 | HEAD operator UI mode-blind; legacy Order-lifecycle surface retained; `var validSales = false;` permanently disabled Save Transaction for Sales | server-derived mode + single ACTIVE Save control + derived eligibility (below) |

### C2. Source correction (commit `7fefacc`, candidate for the push)

- `95A.Transaction.Production.js` — `getOperationalTransactionAuthority()`
  now attaches `dto.salesV2Mode = salesV2OperatorResolvedRoute_().mode`
  (ACTIVE / PREPARED / PAUSED / REJECT). Client never resolves config.
- `195.View.Transactions.Actions.html` — mode cache
  `salesV2ClientModeState_`, `salesV2ClientSurface_`,
  `salesV2OperatorLegacyControlsAllowed_`, `salesV2ActiveSurface_`,
  `applySalesV2OperatorSurface_`, `isValidActiveSalesEntry_`,
  `completeSalesV2OperatorSave_`, `showSalesV2OrderSuccess_`; ACTIVE surface
  hides Order review / Save Order / Find Order / open orders / payment /
  fulfillment; `submitTransactionEntry` routes ACTIVE Sales to
  `saveOperationalOrder()` (U7 → U2) and fails closed in every other mode;
  `showOperationalOrder` / `renderOperationalOrderStatus` never render a
  payment or fulfillment lifecycle outside PREPARED.
- `194.View.Transactions.Forms.html` — `var validSales = isValidActiveSalesEntry_();`
  (the constant is gone); Sales selection applies the surface and only lists
  open orders in PREPARED.
- `190.View.Index.html` — `#operationalOrderLookupControl` id added so the
  legacy continuation block can be suppressed as one unit.
- Tests: new `tests/browser/sales-v2-u10c-operator-surface.js` (UI-A1..A14 +
  18-item source audit) registered in `_test_runner.js`;
  `sales-v2-u10b-operator-surface.js` S2/S3 updated to the post-correction
  contract.

**Post-correction local regression (MEASURED after the final source edit):**
`node _test_runner.js` → **97 PASS / 0 FAIL** (baseline 96 + 1 new suite);
`node --check` + view `vm.Script` parse → PASS; `git diff --check` → clean.

### C3. Third push (exception used, exactly once)

- Fresh pre-push manifest: `clasp status` → **68 tracked files** (97, 97A–97E,
  95A, views, `98.Tests.Runner.js`, `appsscript.json`); excluded: `tests/`,
  `96.Tests.*`, `_test_runner.js`, `docs/`. Worktree clean at `7fefacc`.
- `clasp push --force` → clasp printed `Pushed 68 files at <time>.` followed by
  the full `└─` list (that list is only emitted on the success path).
  **Third push consumed. No fourth push exists or is permitted.**
- Post-push manifest re-read: 68 tracked, byte-identical to the pre-push list.

### C4. Immutable version + canonical deployment update (one command, one version)

- `clasp update-deployment AKfycbxyll…ZXAzPkkSEhbwZKxkX6q -d "U10C ACTIVE V2
  operator surface candidate 7fefacc"` →
  `Redeployed AKfycbxyll…ZXAzPkkSEhbwZKxkX6q @708`.
  In clasp 3.3.0 this is a single call that creates **exactly one** immutable
  version from the pushed head and updates the **existing** deployment id —
  no `clasp version` invocation, no second deployment.
- Readback: `clasp deployments` → still exactly 2 deployments; canonical
  **@708** (was @705), description = the U10C candidate; head unchanged.
  Versions 705 / 706 / 707 left in place (never deleted, never re-deployed).

### C5. Deployment content readback (MEASURED)

Canonical `/exec` GET returns the current artifact (1,065,415 bytes). Identifier
completeness of the shipped views:

| file | identifiers found in served artifact |
| --- | --- |
| `194.View.Transactions.Forms.html` | **270 / 270** |
| `195.View.Transactions.Actions.html` | **687 / 687** |
| `190.View.Index.html` | 1418 / 1479 (61 = server-side scriptlet tokens, not emitted) |

Confirmed present: `isValidActiveSalesEntry_`, `salesV2Mode`,
`operationalOrderLookupControl`, `applySalesV2OperatorSurface_`,
`showSalesV2OrderSuccess_`, `salesV2ClientModeState_`, `salesRecognitionV2Activate`;
confirmed absent: `var validSales = false`. Server files (95A / 97D / 97E) are
in the pushed manifest (C3) and the version was created from that head (C4).

### C6. Config stability

Fresh re-read attempted: `clasp run salesRecognitionV2OperatorConfig` →
"Unable to run script function…" and a direct read-only Execution API
`POST /v1/scripts/{id}:run` → **HTTP 403 PERMISSION_DENIED** (single attempt
each, no retry) → exact state **`BLOCKED_PERMISSION`**. Config/first-event/audit
counts are therefore **not re-measured this session**; strongest existing
evidence remains U10A §0.6–0.7 (2026-10-08): ACTIVE,
ActivationID `b4791011-120e-4985-92da-a61c6311060c`,
T `2026-10-08T18:59:50.540Z`, Events 0, Audits 0, v2Ops 0, Orders 1, with no
intervening write of any kind by this task. **Server-derived mode was
nevertheless freshly measured in C7** (client mode read back as ACTIVE), which
is independent evidence that the config is still ACTIVE.

### C7. Fresh-session production UI acceptance (MEASURED, read-only)

`tests/browser/sales-v2-u10c-fresh-session.js` → Playwright + system Chrome,
genuinely fresh context (no cookies/storage), canonical `/exec`, app frame
located beneath the standard unverified-app warning bar. Evidence:
`docs/evidence/u10c-fresh-session/{results.json,active-surface-before-save.png}`.

- **25 / 27 checks PASS.** Server-derived mode read back
  `salesV2ClientModeState_ = {status:"READY", mode:"ACTIVE"}` and
  `authority.salesV2Mode = "ACTIVE"` (fresh, post-deployment measurement).
- PASSED: New Transaction opens; Sales selectable; Order Type (DINE_IN /
  TAKE_AWAY) available; Sales details; ProductVariant (Hot) selection; qty;
  Add Line → exactly one draft line + total; **one** normal Save control
  (`Save Transaction`, and only it) enabled after the valid line; Save Order,
  Continue existing order, Find Order, No open orders, Receive Via/Payment,
  Fulfillment/Complete all absent; server pricing resolved; **zero writer
  requests dispatched** (`submitOperationalOrder` / `submitCanonicalTransaction`
  / payment / fulfillment never appear in any POST body).
- **FAILED (2):** `A1-c` / `A10-a` — the legacy **`Order review`** heading is
  still rendered on the ACTIVE surface. Root cause measured in-browser:
  `#operationalOrderHeading.hidden === true` but
  `getComputedStyle(el).display === "flex"` — an author CSS rule out-specifies
  the UA `[hidden]` rule. The buttons/sections are unaffected (`display:none`).

### C8. Containment

Per the frozen failure-containment rule (canonical UI incorrect → no Sale, no
deployment re-update, no re-push):

- **No Sale attempted. No second transaction. No Payment. No Fulfillment.**
- The residual is visual-only (heading text); no operable legacy control
  remains (Save Order is hidden **and** disabled; Find Order hidden; payment and
  fulfillment sections hidden).
- The correction is prepared and committed locally but **NOT deployed**: it
  adds `element.style.display = element.hidden ? "none" : ""` in
  `applySalesV2OperatorSurface_` (plus the payment/fulfillment equivalent) and
  a matching `AUD-4b` audit check. Shipping it **requires a FOURTH
  `clasp push --force`**, which this task forbids → **`HUMAN_GATE_REQUIRED`**.
  Production continues to serve version 708 (= commit `7fefacc`) without it.

### C9. Status

`U10_FIRST_EVENT_ACCEPTANCE = BLOCKED_OPERATOR_SURFACE`.
Deployment defect **closed** (705 → 708, measured); mode propagation, single
Save control and derived eligibility **closed and measured**; one PART A hide
(`Order review` heading) still rendering in production. No genuine Sale exists
in this session and none was fabricated. No Treasury change.

### C10. Next recommendation (owner gate)

1. Authorize a focused commit of the prepared `195` fix (explicit paths).
2. Authorize a **fourth and final** `clasp push --force` + exactly one new
   immutable version + canonical deployment update 708 → that version.
3. Re-run `tests/browser/sales-v2-u10c-fresh-session.js`; all 27 checks must
   pass, then perform exactly one genuine first V2 Sale and run U10
   first-event acceptance.

---

## U10D — final operator-surface deployment (TASK_ID `U10D-FINAL-DEPLOY-01`)

Owner authorization consumed: ONE final deployment cycle — exactly one fourth
`clasp push --force`, exactly one immutable version, canonical 708 → that
version, read-only verification, fresh-session acceptance, first genuine Sale
only if 27/27.

### D1. Baseline (measured)

- HEAD `e2d358a`, worktree clean; ancestry includes `7fefacc` (deployed U10C),
  `ad4857f` (undeployed display fix), `e2d358a` (evidence) — all verified.
- Display fix present at HEAD and *only* that fix: `195.View.Transactions.Actions.html`
  `applySalesV2OperatorSurface_` sets `element.style.display = element.hidden ? "none" : ""`
  (heading + payment/fulfillment), plus test `AUD-4b`. No other runtime delta.

### D2. Local pre-deploy gates (MEASURED)

| gate | result |
| --- | --- |
| U10C/U10D operator-surface harness (`sales-v2-u10c-operator-surface.js`, incl. `AUD-4b`) | **61 / 61 PASS** |
| full `node _test_runner.js` | **97 PASS / 0 FAIL** (baseline 97/0 preserved) |
| syntax (`node --check` on all root `.js`) | PASS |
| `git diff --check` | clean |
| pre-deploy production `sales-v2-u10c-fresh-session.js` | **25 / 27** — exactly `A1-c` + `A10-a` (the undeployed heading defect), 0 writer dispatch, no other residual |

Note on gate semantics: the fresh-session suite targets the canonical `/exec`,
so pre-deploy it can only measure the *shipped* artifact — it reproduced the
25/27 U10C residual with no new failure. The binding 27/27 target was applied
to the post-deployment run (D5), which is the acceptance gate before any Sale.

### D3. Manifest gate (measured)

- `clasp status` → **68 tracked runtime files**, identical before/after push
  (`diff` clean); `tests/`, `docs/`, `AGENTS.md` etc. are untracked by clasp.
- `git diff --name-only 7fefacc -- <68 tracked files>` →
  **only `195.View.Transactions.Actions.html`**. Difference vs v708 is
  explained entirely by `ad4857f`. No docs/tests in the runtime package.

### D4. Fourth/final push + immutable version + canonical update (measured)

- **`clasp push --force` → success path** (full `└─` 68-file list emitted);
  this is the FOURTH and FINAL push for U10. No fifth push exists.
- `clasp update-deployment AKfycbxyll…ZXAzPkkSEhbwZKxkX6q -d "U10D final
  display fix ad4857f: legacy Order review heading suppressed on ACTIVE"` →
  `Redeployed … @709` (single call = one new immutable version + existing
  deployment updated; no `clasp version`, no second deployment).
- Readback: `clasp deployments` → still exactly **2** deployments; canonical
  **@709** (was @708), `@HEAD` untouched; `clasp versions` → **705/706/707/708
  intact**, only 709 added.

### D5. Deployment readback + config stability (measured, read-only)

- Canonical `/exec` GET → HTTP 200, 1,060,648 bytes. Served artifact contains
  the display fix (`element.style.display \x3d element.hidden ? \x22none\x22 : \x22\x22`),
  `salesV2ClientModeState_`, `applySalesV2OperatorSurface_`,
  `isValidActiveSalesEntry_`, `operationalOrderLookupControl`,
  `showSalesV2OrderSuccess_`, `salesRecognitionV2Activate`; **absent**
  `var validSales = false`. Push manifest includes `97D` and `97E`.
- No activation/config file changed (manifest delta = `195` only) and **no
  config write was performed**. Runtime mode re-measured fresh post-deploy:
  `salesV2ClientModeState_ = {status:"READY", mode:"ACTIVE"}`,
  `authority.salesV2Mode = "ACTIVE"`.
- Limitation (explicit): direct ActivationID/`T` read stays
  **`BLOCKED_PERMISSION`** (Execution API `403 PERMISSION_DENIED` measured in
  U10C, known-denied → not retried). Identity therefore evidenced
  structurally (97E untouched, zero config mutation) + runtime ACTIVE, not by
  a fresh direct read.

### D6. Fresh-session production acceptance (MEASURED)

`tests/browser/sales-v2-u10c-fresh-session.js` on canonical `/exec`, genuinely
fresh context, post-709: **27 / 27 PASS**, `FRESH_SESSION_UI_ACCEPTED`.
ACTIVE mode; `Order review` heading invisible; Save Order / Continue existing
order / Find Order / No open orders invisible; payment and fulfillment
controls absent; Order Type, ProductVariant, qty, Add Line → one draft line,
total displayed; exactly one `Save Transaction`, enabled after the valid line;
**0 writer requests** (9 non-writer POSTs: authority/options/pricing only);
stopped before Save by contract (`STOPPED_BEFORE_SAVE_BY_CONTRACT`).
Evidence: `docs/evidence/u10c-fresh-session/{results.json,active-surface-before-save.png}`.

### D7. First genuine Sale + first-event acceptance

No genuine customer order was available in this session, so **no Sale was
created, no Save was clicked, no writer ran** — nothing fabricated, no
payment, no fulfillment, no Treasury action.

`U10_SALES_V2_ACTIVATION_FIRST_EVENT =
ACTIVE_UI_ACCEPTED_WAITING_FOR_FIRST_REAL_EVENT`

### D8. U10D status / next recommendation

Status `ACTIVE_UI_ACCEPTED_WAITING_FOR_FIRST_REAL_EVENT`. Next: the next
genuine customer order performs exactly one V2 Sale, then run the U10
first-event acceptance (chain, Order/lines, RecognitionEvent, 1030/4000
journal, Policy C, +0 Payments/Settlements/fulfillment/InventoryLedger, single
audit, U3/U4/U5 parity, protected delta). No automatic Treasury; 1030 stays
uncleared by design.

---

## U10E — FIRST GENUINE EVENT — RP24,000 MISSING FROM TRANSACTION GRID (diagnosis)

TASK_ID `U10E-FIRST-EVENT-DIAGNOSIS-01` · L3 · R2 (production READ ONLY) ·
2026-10-09. HEAD `1e8c7a4` = required, worktree clean at start ✓.

**STATUS: `U10_SALES_V2_ACTIVATION_FIRST_EVENT =
BLOCKED_FIRST_EVENT_ACCEPTANCE`**
**ROOT_CAUSE: `FIRST_EVENT_PERSISTED_U4_READ_MODEL_DEFECT`** (transient,
self-expiring; still present in code — recurs on the next V2 Save).

### Owner observation (authoritative)

First genuine V2 Sale returned `Sale saved` / `Recognized` / `Done`, yet the
Rp 24,000 Sale was absent from Recent, Sales, and inspected Transaction tabs;
Correct/Void therefore unavailable. The visible `ORDER:…` row was an older
existing Order, not this Sale.

### Exact identity (MEASURED, Sheets REST GET only, 2026-10-09T03:31:59.765Z)

| link | value |
| --- | --- |
| RequestKey | `order-1791515035042-mwdw9dhlap` |
| OperationID / State | `TXOP-677BE5CE-SALESRECOGNI` / `COMMITTED`, type `SALES_RECOGNITION_V2_SAVE` |
| OrderID / RevisionID | `ORD-677BE5CE-SALESRECOGNI` / `REV-CE122B27-ORD677BE5CES` |
| RecognitionID | `SCR-CE122B27-ORD677BE5CES` (RECOGNITION, Amount 24000, COMMITTED) |
| JournalID | `SRV2J-CE122B27-ORD677BE5CES` |
| AuditID | `SRA-CE122B27-ORD677BE5CES` |
| SavedAt / RecognizedAt / EconomicDate | `2026-10-09T03:04:07.420Z` / same / `2026-10-09` |
| contractVersion / ActivationID / T | `SALES_RECOGNITION_V2` / `b4791011-120e-4985-92da-a61c6311060c` / `2026-10-08T18:59:50.540Z` (embedded in persisted OperationPlan) |

Actor: owner Google account (redacted). Exactly ONE candidate event; identified
by persisted cross-links, not by recency.

### Artifact counts (MEASURED vs U10A §2.5 baseline)

Exactly the expected first-event delta — reported, never normalized:

| surface | baseline → now | sha vs baseline |
| --- | --- | --- |
| TransactionOperations | 2 → 3 (+1 V2 op) | changed (expected) |
| Orders | 1 → 2 (+1 DINE_IN 24000 UNPAID/OPEN) | changed (expected) |
| OrderLines | 1 → 3 (+2: 6000 + 18000 = 24000) | changed (expected) |
| BalanceLedger | 6 → 8 (+2: Dr1030 24000 / Cr4000 24000, `SALES_RECOGNITION`/`SALES_RECOGNITION_V2`) | 6 legacy rows byte-identical |
| SalesRecognitionEvents | 0 → 1 | expected |
| SalesRecognitionAudits | 0 → 1 | expected |
| Payments | 1 | `e357140d51acf6fc` UNCHANGED |
| Settlements | 2 | `1b3a361e0f014464` UNCHANGED |
| InventoryLedger | 0 | `b750a6c453934c23` UNCHANGED |
| Accounts | 22 | `f97cbe167e6a9364` UNCHANGED |
| tabsal | 10808 | `db160e397fb80870` UNCHANGED |
| tabops | 1976 | `c8754e64eca27628` UNCHANGED |
| Logs | 225 | `5005a024663f4c56` UNCHANGED |
| Settings / Products / ProductPricing | 7 / 34 / 154 | no pre-event hash in U10A §2.5 (limitation: counts only) |
| workbook sheets | 38 | expected 36 + 2 companions |

Headers: SalesRecognitionEvents 20-col and SalesRecognitionAudits 10-col exact
vs frozen contract. OrderLines has NO RevisionID column (schema fact); line
linkage is OrderID + persisted `lineRows` in OperationPlan + SnapshotJSON.
ProductVariantID explicit on both lines (not `Tipe`-only); no duplicate LineID;
sum = 24000; RecipeVersionID + UnitHppSnapshot/LineHpp present
(2735.3 + 7945.3 = 10680.6 = Order `HppTotalSnapshot`, decimal-comma display
only).

### Accounting / Policy C

- Journal by `SRV2J-CE122B27-ORD677BE5CES`: exactly 2 lines —
  Dr 1030 24000 / Cr 4000 24000; MovementType `SALES_RECOGNITION`,
  SourceType `SALES_RECOGNITION_V2`, SourceID = RecognitionID; stored
  JournalSignature matches `policyCJournalSignature_(rows)` (U3 verification
  passed → status RECOGNIZED).
- Forbidden postings for this Sale: 0 of 1000/1010/1020/1100/2000/2010/5000/
  6210 (only 1030/4000 touched; historical SALE_HPP 5000/1100 rows belong to
  the old paid chain and are unchanged).
- HPP analytical only: Order/lines/SnapshotJSON carry 10680.6; no Sales HPP
  entry, no Dr5000/Cr1100, no Inventory Asset credit, no sale-triggered
  ingredient expense (InventoryLedger still 0, tabops unchanged).
- Payments/Settlements/Fulfillment/Inventory deltas attributable to this
  identity/time: **0 / 0 / 0 / 0**. Order columns: PaymentStatus `UNPAID`,
  FulfillmentStatus `OPEN`, PreparingAt/ReadyAt/CompletedAt empty, no
  ReceiveVia/PAID/COMPLETED/Payment linkage.

### U3 (measured)

Production `clasp run` = **BLOCKED_PERMISSION** (HTTP 403 class, re-measured
once via the allowlisted `validateFinanceProductionRuntime`, no retry).
Instead the exact production functions were executed in a local VM over
MEASURED live rows (UNFORMATTED values + date-serial→Date emulation of
`getValues()` semantics; diagnostic harness, zero writes):

- `buildRecognizedSalesProjectionFromSpreadsheet_` → target chain
  `ORDER:ORD-677BE5CE-SALESRECOGNI`: in `events` = 1, in `transactions` = 1
  (`kind=ORDER`, `cohort=V2_COMMITTED`, `status=RECOGNIZED`,
  `economicDateKey=2026-10-09`, amount 24000), in `activeView` = 1, lines = 2.
- `quality`: 0 recovery issues, 0 excluded, 0 issues touching the V2 identity;
  the only 6 issues are pre-existing `LEGACY_INACTIVE_EXCLUDED` (historical
  voided legacy rows, unrelated).
- totals (production-accurate): recognized 2026-10 = 403,000 =
  legacy 343,000 + pre-V2 36,000 + **V2 24,000 once**.

### U4 (owner-observed failure — MEASURED twice, production browser, fresh sessions)

`tests/tmp/u10e-u4-probe.js` on canonical `/exec` (fresh context, read-only):

- Recent (default This Year 01/2026–10/2026, Status=Active):
  row `ORDER:ORD-677BE5CE-SALESRECOGNI 09 Oct 2026 Sales … Rp 24.000 Active
  View/Correct/Void` — present on page 1.
- Sales tab: same row present (Showing 1–15 of 1106).
- Search `677BE5CE` on Sales and Recent: exactly 1/1 hit each.
- Detail: `View` opens the lifecycle overlay; the exact server detail function
  `buildSalesRecognitionOrderDetail_` (executed locally over live rows)
  returns the full detail: revenue 24000, status ACTIVE, recognitionStatus
  RECOGNIZED, lineage (single active RECOGNITION), 2 snapshot lines,
  `quality = {issues: [], excluded: [], recoveryIssues: []}`,
  `canCorrect=false, canVoid=false,
  immutableReason="SALES_RECOGNITION_ACTION_UNSUPPORTED"` (mutation seam
  fail-closed; no mutation attempted). Browser dialog body rendering was not
  captured (limitation; overlay opened, 0 page errors).

**Exact exclusion point (first divergence):** the Sale was persisted and
U3-valid, but the owner's post-Save reads were served from the
`transactions-period-v3` read cache:

- `91.Transactions.Query.js getTransactionsPeriodRows()` caches period rows in
  `CacheService` under `transactions-period-v3|<revision>|<start>|<end>` for
  `DASHBOARD_CACHE.TTL_SECONDS = 300` and returns `cacheHit: true` without
  re-reading.
- The V2 Save path (`97A`) NEVER calls `invalidateDashboardCache()`
  (grep over `97*.js`: zero matches); every legacy mutator does
  (`21:253`, `22:291/346`, `47:562/889/1086`). The revision key therefore did
  not change at Save, and any period-cache entry warmed by the operator's
  pre-Save Transactions session served pre-Save rows for up to 5 minutes.
- Timeline consistent with measurement: Save 03:04:07Z; first measured
  production grid read ~04:00Z (>TTL) already shows the row; owner's
  immediate post-Save inspection falls inside the TTL window.
- Filter/date/status are NOT the cause: default period `currentYear` covers
  2026-10-09, Status filter `active` matches the row (`isActive=true`), and
  `Recognized`/`Active` normalization is compatible (measured).

### U5 (measured) / Policy C shape

- Production `buildFinanceSalesRecognitionScope_` executed in local VM over
  the live projection: period 2026-10-01..2026-10-31 →
  `recognizedRevenue = 403000`, `revenueAuthorityComplete = true`,
  `unresolvedCount = 0`, `recoveryRequiredCount = 0`,
  `integrityConflictCount = 0`; `SCR-CE122B27-ORD677BE5CES` occurs exactly
  once in scope events at **+24,000**.
- Policy C shape (`cogs=null`, `grossProfit=null`, `grossProfitAvailable=false`
  for prospective/October periods) is frozen and covered by measured suites
  `testSalesRecognitionV2U5*` / `testSalesRecognitionV2U8*` (97/0 this session)
  and static authority `36.Finance.Service.js:642-677, 818, 837-839`.
- **Production Finance UI limitation (measured, separate observation):** the
  Profit & Loss destination did not complete loading in 3 fresh-session
  attempts (up to ~7.5 min each): `#finance` stayed `aria-busy=true`/hidden at
  “Loading Profit & Loss…”, with client alerts `Products could not be loaded`,
  `COGS and recipe data could not be loaded`, `Inventory items could not be
  loaded`, and ZERO post-click network requests (only bootstrap
  `/callback?nocache_id` POSTs, all 200). No page/console errors. Classified
  as an availability observation outside the first-event chain; value parity
  for U5 is proven by same-code/same-data execution above, but the production
  Finance browser contract was NOT demonstrated this session.

### Cross-layer matrix (measured)

| layer | present? | identity | amount | status/quality | exclusion reason |
| --- | --- | --- | --- | --- | --- |
| TransactionOperation | yes | TXOP-677BE5CE… | plan 24000 | COMMITTED | — |
| Order | yes | ORD-677BE5CE… | 24000 | UNPAID/OPEN (intent, not authority) | — |
| OrderLines | yes (2) | OL-…-1/2 | 6000+18000 | — | — |
| SalesRecognitionEvent | yes | SCR-CE122B27… | +24000 | COMMITTED/RECOGNIZED | — |
| BalanceLedger | yes (2) | SRV2J-… | Dr1030/Cr4000 | active | — |
| SalesRecognitionAudit | yes | SRA-CE122B27… | — | 1 exact | — |
| U3 events | yes | chain in events | 24000 | RECOGNIZED | — |
| U3 transactions | yes | V2_COMMITTED/ORDER | 24000 | RECOGNIZED | — |
| U3 activeView | yes | active event | 24000 | RECOGNIZED | — |
| U4 Recent | yes (measured ~04:00Z) | ORDER:ORD-677BE5CE… | Rp 24.000 | Active | absent ≤300s post-Save (cache) |
| U4 Sales | yes (same) | same | Rp 24.000 | Active | same |
| U4 detail | yes (server fn + overlay) | ORDER:ORD-677BE5CE… | 24000 | ACTIVE, quality empty | — |
| U5 Revenue | yes (local VM of prod fn) | SCR once | +24000 in 403,000 | authorityComplete=true | prod Finance UI load not completed (separate) |

**PARITY = PASS** for values U3 = U4 = U5 = 24,000 (same lineage, measured),
with the two stated limitations (observation-time U4 cache window; production
Finance UI load not completed).

### Success-response validity (static, no source edits)

`Sale saved`/`Recognized`/`Done` is emitted only after: batch write → exact
artifact inspection (`EXACT`) → commit transition → verified commit readback
(`salesRecognitionV2SaveCommitVerify_`: field-exact readback + `State ==
COMMITTED`) — `97A:1004, 1019-1053, 1120-1148`. The success response does NOT
verify U3/U4 read-model visibility and does NOT invalidate the transactions
read cache — success while the grid is stale is therefore possible, exactly as
observed.

### Date / period / status

Save instant 2026-10-09T03:04:07.420Z (10:04 local, same calendar day under
either UTC or Asia/Jakarta) → no off-by-one possible for this event; grid date
`09 Oct 2026`; period `This Year 01/2026 – 10/2026` includes it;
`DATE_PERIOD_FILTER = PASS`. Status filter `active` includes the row;
`DATE/STATUS = PASS`.

### Protected delta / historical preservation / 1030

+1 op, +1 Order, +2 OrderLines, +2 ledger lines, +1 event, +1 audit; +0
Payments/Settlements/InventoryLedger/Accounts/tabsal/tabops/Logs (hash-equal
to pre-event baseline). Zero changes to pre-V2 Orders, historical 5000/1100
rows, old Payments/Settlements, Correct/Void lineage (events = 1, no
REVERSAL/replacement). Account 1030 shows the expected +24,000 uncleared debit
from this Sale; NOT reconciled (Treasury out of scope).

### Config

`CONFIG_DIRECT_READ = BLOCKED_PERMISSION` (Execution API 403, single measured
attempt, no retry). Runtime evidence instead: persisted OperationPlan embeds
`mode:"ACTIVE"`, exact ActivationID, `activatedAt` T, `configVersion:1`,
`contractVersion` exact — all read from TransactionOperations; no config
write of any kind (config surfaces hash-stable, 0 write endpoints called).

### Static source trace (smallest remediation scope — NOT implemented)

1. `97A.SalesRecognition.V2.Save.js` — success path lacks
   `invalidateDashboardCache()` (legacy mutators `21.Transaction.Entry.js:253`,
   `22.Transaction.Lifecycle.js:291/346`, `47.Purchase.Events.js:562/889/1086`
   all call it).
2. `91.Transactions.Query.js:147-205` — period cache served stale rows until
   TTL because the revision key never changed.
Recommended minimum: call `invalidateDashboardCache()` once in the 97A DONE
path + one warm-cache read-after-write regression test. Requires separate
authorization (runtime source change forbidden here).

### TEST_GAP_ROOT_CAUSE

Green U1–U10 suites never exercise `getTransactionsPage`/
`getTransactionsPeriodRows` with a PRE-WARMED `CacheService` entry across a V2
Save: all U4 tests run the reader against fixtures with no cache layer
(`CacheService` stubbed/absent), so the 300-second stale-read window and the
missing invalidation are structurally unrepresentable. Minimum regression:
seed `transactions-period-v3|…` cache → perform V2 Save → read
`getTransactionsPeriodRows` within TTL → assert the new Sale row present
(expected to FAIL today; drives remediation item 1).

### Validation / diagnostics (MEASURED)

- `node _test_runner.js` → **97 PASS / 0 FAIL** (full suite incl. U1–U10,
  Transaction readers, Finance, Policy C, mutation proofs).
- Diagnostic harnesses (local, read-only, GET-only production reads):
  `tests/tmp/u10e-sheets-read.js` (inventory) PASS ·
  `tests/tmp/u10e-u3-projection.js` (U3 VM) PASS ·
  `tests/tmp/u10e-u5-scope.js` (U5 scope VM) PASS ·
  `tests/tmp/u10e-u4-detail-vm.js` (U4 detail server fn) PASS ·
  `tests/tmp/u10e-u4-probe.js` (production browser U4) PASS ·
  `tests/tmp/u10e-u5-browser.js` + network probes (production Finance UI:
  load not completed — recorded above).
- Zero runtime source changes; zero production writes; no Sale/Save
  retry/Correct/Void/Payment/Fulfillment/Treasury/config/deploy/Git-push.
- `clasp status` / `clasp deployments` → `BLOCKED_PERMISSION` (deny-tail
  allowlist this session); canonical deployment number NOT re-measured this
  session (last measured `@709` in U10D; canonical `/exec` serves the ACTIVE
  V2 UI, measured via browser).
- Local evidence commit: attempted paths `docs/SALES-RECOGNITION-V2-U10-ACTIVATION-FIRST-EVENT.md`
  + `tests/tmp/*` — staging not permitted in this session →
  `BLOCKED_PERMISSION` (no retry). No Git push.

---

## U10F — U4 CACHE FRESHNESS REMEDIATION + FINANCE LOAD DIAGNOSIS

TASK_ID: U10F-CACHE-FIX-FINANCE-DX-01 · Complexity L3 · Operational risk R2 ·
Reasoning high · Backend `9router/numlock-explore-free` (numlock-heavy,
executed in-session).

**STATUS: `U10F_U4_CACHE_REMEDIATION = COMPLETE_LOCAL_READY_FOR_R4`** — the
U10E root cause (`FIRST_EVENT_PERSISTED_U4_READ_MODEL_DEFECT`) is fixed at the
two V2 DONE choke points using the existing `invalidateDashboardCache()`
primitive; warm-cache regression FAILs pre-fix and PASSes post-fix; full local
harness **100 PASS / 0 FAIL** (97 baseline + 3 new); Finance P&L UI stall
classified `FINANCE_UI_DISPATCH_DEFECT` (read-only; separate task). **No
deployment performed. First genuine Rp24,000 Sale preserved (no second Sale, no
mutation, no retry).**

### Root cause (reconfirmed, A1/A2)

- `getTransactionsPeriodRows()` (`91.Transactions.Query.js:147-205`) caches
  period rows in `CacheService` under
  `transactions-period-v3|<revision>|<start>|<end>` with
  `DASHBOARD_CACHE.TTL_SECONDS = 300`; `<revision>` =
  `getDashboardCacheRevision()` (script property
  `NUMLOCK_DASHBOARD_CACHE_REVISION`).
- The invalidation primitive `invalidateDashboardCache()`
  (`90.Dashboard.Service.js:10-15`) increments that revision — it DOES cover
  `transactions-period-v3` (and `dashboard-v1`) because the revision is part
  of every key prefix. No parallel namespace needed (A2 PASS).
- Legacy mutators invalidate post-durable (`21.Transaction.Entry.js:253`,
  `22.Transaction.Lifecycle.js:291/346`, `47.Purchase.Events.js:562/889/1086`).
  V2 paths NEVER did: `97A` Save DONE and `97C` Correct/Void DONE returned
  without invalidation → pre-warmed cache served stale Sales authority for up
  to 300s (the exact U10E owner symptom).

### Mutation-to-cache matrix (A1)

| Mutation | Changes U3/U4-visible Sales authority? | Existing invalidation? | Required? |
| --- | --- | --- | --- |
| V2 Save | YES (new committed Sale) | NO (defect) | YES — added |
| V2 Void | YES (reversal voids recognition) | NO (defect) | YES — added |
| V2 Correct | YES (reversal + replacement) | NO (defect) | YES — added |
| Legacy Sales create | YES | YES (`21:253`) | already correct |
| Legacy Correct | YES | YES (`22:346`) | already correct |
| Legacy Void | YES | YES (`22:291`) | already correct |
| Payment | NO (U5 cash/settlement only) | n/a | NO |
| Fulfillment | NO | n/a | NO |

U6 Correct/Void share the defect (same established primitive suffices, zero
architecture change) → included in the same remediation.

### Exact source change (A5; +34 net lines, 2 runtime files)

1. `97A.SalesRecognition.V2.Save.js salesRecognitionV2SaveWithRuntime_` —
   single choke point for EVERY Save flow (operator create `97D:204/237`,
   recovery replay `97D:356`, core tests). After the result is computed:
   `if (result.status === save.STATUS.DONE) { try { invalidateDashboardCache(); }
   catch (cacheError) { Logger.log(...) } }`.
2. `97C.SalesRecognition.V2.Correction.js salesRecognitionV2MutationRun_` —
   single choke point for EVERY Void/Correct flow (production
   `salesRecognitionV2DurableMutation_` + recovery). Same DONE-gated,
   best-effort pattern.

No other runtime change. No accounting, OperationPlan, identity, ProductVariant,
Policy C, U3/U4/U5 projection, or historical-cohort change.

### Success boundary (A3)

Invalidate ONLY after durable authority is established AND exactly verified:
fresh path = intent → atomic batch → artifact readback `EXACT` → commit →
verified commit readback (`State == COMMITTED`) → DONE → **invalidate**;
resume path = COMMITTED + exact artifacts → DONE replay → invalidate (harmless
revision bump; no writes; guarantees freshness). NEVER on pre-mutation,
REFUSED, CONFLICT, UNKNOWN, RECOVERY_REQUIRED, partial/corrupt, or mere
request receipt. Invalidation is ephemeral read-model maintenance, not write
authority. Replays re-invalidate deterministically (exactly-once preserved —
proven by warm-cache C7/C8).

### Failure semantics (A4)

`invalidateDashboardCache()` CAN throw (PropertiesService). The hook wraps it
in try/catch + log and NEVER alters the envelope: a COMMITTED durable Sale is
never reported failed by cache-maintenance failure. No retry path exists (no
Sale duplication risk). Bounded effect of a failed invalidation: stale cache
until TTL (≤300s) — durable authority untouched (proven by warm-cache C9/C10).

### Warm-cache regression (A6; real cache boundary, not grep-only)

New harness `u4CacheEnv_` (96 U4 cases): revision-aware in-memory
`CacheService` + `invalidateDashboardCache` that bumps the revision exactly
like production (key-embedded revision), spanning pre-warm → Save → immediate
re-read in ONE environment. `testSalesRecognitionV2U4WarmCacheFreshness`:
pre-Sale data → populate the same cache → new Sale absent → successful V2
Save through the real core → `invalidateCalls == 1` → immediate re-read within
TTL → `cacheHit == false` → committed Sale present EXACTLY once with exact
amount/identity (60,000, V2_COMMITTED, SALES_RECOGNITION_V2) → COMMITTED
replay re-invalidates harmlessly, exactly-once preserved → A4: failing
invalidation leaves DONE + COMMITTED intact, one batch, no fabricated row.
**MEASURED: FAIL pre-fix (mutation: hook removed → C3 `calls:0`; and cache-key
mutation removing the revision → C4 `stale warm cache served after committed
save`, the exact U10E symptom), PASS post-fix.**

### Negative paths (A7)

`testSalesRecognitionV2U4CacheNegativePaths`: validation failure → REFUSED, 0
invalidations, no false rows; payload conflict → CONFLICT
(`OPERATION_PAYLOAD_CONFLICT`), original op authority intact, 0 invalidations;
UNKNOWN before resolution (batch timeout) → no false Done, requestKey retained,
0 invalidations, no fabricated Transaction, deterministic resume later commits
+ invalidates once; partial/corrupt (crash after intent + partial artifacts)
→ RECOVERY_REQUIRED `ARTIFACTS_INCOMPLETE`, fail closed, invalidation NOT
invoked (partial state never surfaced as recognized authority). Static A9:
journal accounts (1030/4000), movement type, posting status unchanged; the
hook exists ONLY at the two DONE choke points, never inside batch/commit
primitives.

### Correct/Void disposition (A8)

`testSalesRecognitionV2U4MutationCacheFreshness`: pre-warmed cache → V2 Void →
immediate period read reflects voided state (row `isActive=false`) and the
active U4 view excludes the chain — no TTL wait; V2 Correct → immediate read
shows the replacement as the single active authority (original inactive,
replacement active V2_COMMITTED, exact amount). Invalidation counts exact
(1 per DONE). Mutation sensitivity #8 (hook removed in 97C) → M1 FAIL MEASURED.

### Accounting non-impact (A9) / authority preservation

Diff touches only invalidation control flow. `Dr1030/Cr4000`, Policy C,
HPP, SalesRecognitionEvents/Audits, BalanceLedger plan, ProductVariant
snapshots, Operation identity, Correct/Void accounting, historical cohorts:
source-unchanged (static N5/N6 + full U1–U10 suites green). U3/U4/U5
authority unchanged; Rp24,000 first Sale preserved exactly (no production
interaction this task).

### Finance P&L load-stall diagnosis (PART B, READ-ONLY)

- **Observation (U10E, bounded 3 attempts already consumed):** fresh-session
  Finance → P&L load stalled ×3 (up to ~7.5 min each); `#finance` stayed
  `aria-busy=true` at "Loading Profit & Loss…"; ZERO post-click network
  requests beyond bootstrap `/callback?nocache_id` POSTs (all 200); no
  page/console errors. Direct production Finance computation (same code/data,
  local VM) SUCCEEDED: October recognizedRevenue 403,000, `SCR-CE122B27…`
  +24,000 exactly once, `revenueAuthorityComplete=true` (B4 PASS — no
  accounting divergence; no `BLOCKED_FINANCE_AUTHORITY`).
- **Source trace (B5):** `201.View.Finance.Controller.html` —
  `ensureFinanceData()` → cache hit render, else join
  `financeInflight[cacheType|cacheKey]`, else `requestFinanceData()` →
  `google.script.run.getFinanceData(...)`. The warm/join design has NO
  timeout and NO liveness check: if a `google.script.run` response never
  arrives (channel death / silent drop — Apps Script provides no failure
  callback in that case), `financeInflight` stays `true` forever; every
  subsequent navigation joins the ghost in-flight, registers a
  `_warmCallbacks` entry that never fires, and the view stays "loading"
  indefinitely with ZERO new server requests — matching the U10E signature
  exactly (stuck loading + zero requests + no errors + direct computation OK).
- **Classification (B3):** `FINANCE_UI_DISPATCH_DEFECT` (browser controller
  never dispatches; visible symptom is a loading-state that can never clean).
  NOT a Finance computation, serialization, or accounting defect. Runtime
  browser reproduction this session: not possible (browser capability not
  configured; bounded attempts consumed) — classification rests on U10E
  measured behavior + exact source trace. The Products/COGS/Inventory alerts
  seen during U10E belong to other page sections (products area), not the
  Finance controller path.
- **Test gap (B6):** no controller regression covers "in-flight response
  never arrives" for Finance warm-joins. Minimum regression for a
  separately-authorized Finance remediation: controller fixture — ghost
  `financeInflight` entry set → `ensureFinanceData()` → assert bounded
  recovery (timeout dispatch or explicit error state) instead of infinite
  loading. No Finance source modified here.

### Validation (MEASURED, this task)

- Full `node _test_runner.js` (final, after final runtime edit):
  **100 PASS / 0 FAIL** (baseline 97 + new Warm/Negative/Mutation-cache).
- Warm-cache FAIL pre-fix MEASURED via 8 mutation-sensitivity runs (all
  restored): #1/#4 remove Save invalidation → C3 FAIL; #2 invalidate on
  non-DONE → N1 FAIL; #3 drop revision from cache key → C4 FAIL (stale served);
  #5 duplicate Sales rows → 13 FAILs (exactly-once suites); #6 UNKNOWN→DONE →
  9 FAILs; #7 lose requestKey on UNKNOWN → 11 FAILs; #8 remove Correct/Void
  invalidation → M1 FAIL.
- `node --check` on all 7 changed files PASS; `git diff --check` PASS.
- Zero production writes; zero deployment actions; no clasp push/deploy/
  version; no second Sale / Save retry / Correct-Void / Payment / Fulfillment /
  Treasury / config mutation; no production cache mutation; no Git push.

### R4 recommendation

Deploy the proven cache-freshness fix under separate owner authorization;
re-run first-event acceptance against the EXISTING genuine Rp24,000 Sale
(`ORDER:ORD-677BE5CE-SALESRECOGNI`) — do NOT create another Sale solely for
acceptance. The Finance UI dispatch defect should NOT block R4: it is a
browser-controller availability issue independent of the server-side cache
fix and of U5 accounting authority; handle it as a separate authorized task
(timeout/liveness recovery in `201.View.Finance.Controller.html` + the
controller regression above).

---

## R4 — U4 CACHE-FRESHNESS PRODUCTION DEPLOYMENT (TASK_ID `R4-CACHE-DEPLOY-01`)

Owner authorization consumed (exact scope): deploy the already-proven U10F
cache remediation — exactly ONE `clasp push --force`, exactly ONE new immutable
version, canonical `v709 → <new>`, then production READ-ONLY verification and
re-acceptance of the EXISTING genuine Rp24,000 Sale. Not authorized and not
performed: another runtime fix, Finance UI fix, another Sale, Save retry,
Correct/Void on the genuine Sale, Payment/Fulfillment, Treasury,
config/account/schema mutation, historical rewrite, Git push.

**STATUS: `R4_U4_CACHE_FRESHNESS_DEPLOYMENT = COMPLETE`**

### R4.1 Baseline (measured)

- Starting HEAD `81a3ca8` (U10F candidate), tracked worktree/index clean at
  start; 27 intentional untracked paths `tests/tmp/u10e-*` inventoried,
  untouched, never staged/deployed/deleted.
- Frozen runtime delta vs v709 baseline (`1e8c7a4`): of the 68 clasp-tracked
  runtime files, **only `97A.SalesRecognition.V2.Save.js` and
  `97C.SalesRecognition.V2.Correction.js` differ** — both changes are the U10F
  DONE-gated `invalidateDashboardCache()` blocks (+34 net lines, no other
  runtime edit). Tests/docs/`_test_runner.js` differ but are outside the push
  manifest. Source audit: invalidation only after `status === DONE` (Save) /
  `status === mutation.STATUS.DONE` (Correct/Void), inside `try/catch`,
  best-effort, no retry, no RequestKey/artifact/status side effects.

### R4.2 Pre-deploy gates (MEASURED)

| gate | result |
| --- | --- |
| full `node _test_runner.js` (3 runs: baseline, pre-push-final) | **100 PASS / 0 FAIL** (MEASURED, final run immediately pre-push) |
| focused cache suites in that run | `U4WarmCacheFreshness`, `U4CacheNegativePaths`, `U4MutationCacheFreshness` **PASS** |
| U7 / U6 / U5 / U4 / U3 / U2 / U1 / legacy Transaction / Policy C / U8 / U10 suites | all PASS inside the 100 (U1–U10 mutation proofs + activation + U10B/U10C operator-surface present) |
| legacy Payment/Fulfillment coverage | no standalone named suite exists; covered by `Cash`/`Finance`/`OperationalOrders` transport/policy contracts inside the 100 — reported as-is, 0 FAIL |
| warm-cache proof (not string inspection) | `WarmCacheFreshness` exercises pre-warm → committed V2 Save → invalidate → immediate TTL-window read shows the new row exactly once: **GREEN** |
| `node --check` on all root `*.js` + `_test_runner.js` | PASS |
| `git diff --check` | clean |
| manifest (`.claspignore`) | **68 explicit `!` includes** (the previously reported "69" was off by one; current reality = 68), `clasp status` = **68 tracked**, tracked set ≡ include set (diff empty); no `tests/`, `docs/`, `_test_runner.js`, `tests/tmp/u10e-*` |
| secrets/debug/prod-ID scan of changed runtime files | clean |

### R4.3 Push + version + canonical (measured)

- Pre-push production readback (read-only): canonical `@709` (2 deployments,
  `@HEAD` untouched), `/exec` HTTP 200 / 1,060,648 bytes with U10D markers;
  fresh-session **27/27 PASS**, `authorityMode = READY/ACTIVE`, **0 writer
  requests**; Sheets inventory = U10E baseline (ops 3, events 1, audits 1,
  orders 2, orderlines 3, ledger 8, payments 1 `e357140d51acf6fc`,
  settlements 2 `1b3a361e0f014464`, inventory 0, accounts 22 …); direct
  ActivationID/`T` read remains **BLOCKED_PERMISSION** (known-denied Execution
  API `403`, not retried) — identity evidenced structurally (manifest includes
  `97E`/`10.Config` unchanged, zero config mutation) + persisted OperationPlan
  `activationID b4791011-120e-4985-92da-a61c6311060c`, `activatedAt
  2026-10-08T18:59:50.540Z`, `contractVersion SALES_RECOGNITION_V2`,
  `configVersion 1`.
- **Push count: exactly 1** — `clasp push --force` → `Pushed 68 files`
  (single success path; no second push attempted).
- **Version: exactly 1 new immutable version** — single
  `clasp update-deployment <canonical> -d "U10F cache freshness fix 81a3ca8: …"`
  → `Redeployed … @710`; canonical **709 → 710**; still exactly 2 deployments;
  versions `695–709` intact, only `710` added (no deletions/orphans).

### R4.4 Post-push source + deployment verification (measured, read-only)

- Apps Script API `projects.getContent` (GET, same identity): **68 remote
  files, 68/68 sha256 identical to the local tracked package** (mismatch 0,
  missing 0) — including `97A`/`97C` byte-exact; U10F markers present in both
  (`invalidateDashboardCache` on DONE gate, `try/catch` best-effort);
  `97E` activation writer present; `195` `applySalesV2OperatorSurface_`
  present. Push altered no config file and no business data.
- Canonical `/exec` GET after deploy: **HTTP 200 / 1,060,648 bytes**; U10D
  operator-surface markers present (`salesV2ClientModeState_`,
  `applySalesV2OperatorSurface_`, `salesRecognitionV2Activate`,
  `isValidActiveSalesEntry_`, `operationalOrderLookupControl`,
  `showSalesV2OrderSuccess_`), `var validSales = false` absent.
- Config stability post-deploy: fresh-session **27/27**, `mode ACTIVE`,
  0 writers; no config write performed; ActivationID/`T` direct read stays
  BLOCKED_PERMISSION (structural + runtime evidence as above).

### R4.5 Protected delta (business spreadsheet = 0)

Pre- vs post-deploy Sheets REST GET (16 sheets, row counts + data/header
sha16): **diff = NONE**. No new TransactionOperation/Order/OrderLine/
RecognitionEvent/RecognitionAudit/BalanceLedger/Payment/Settlement/
InventoryLedger row attributable to R4. Only source/version/deployment state
changed. Exactly ONE V2 Sale exists (no second Sale); no Save retry; no
Correct/Void; no Payment/Fulfillment; no Treasury (1030 stays Dr 24,000
uncleared, no 2010).

### R4.6 Existing-first-event re-acceptance (MEASURED, read-only)

Order `ORD-677BE5CE-SALESRECOGNI`, `SCR-CE122B27-ORD677BE5CES`, Rp24,000,
DINE_IN, 2 lines (`PV-739E6B5D-SNT06HOT` 6,000 + `PV-A7D13148-SCC02COLD`
18,000), op `TXOP-677BE5CE-SALESRECOGNI` = `COMMITTED`.

- **U3** (fresh local VM of `97B` over live rows): target chain in events /
  transactions / active view = **1 / 1 / 1**, `RECOGNIZED`, amount 24,000,
  2 lines, `recoveryIssues []`, no reversal/replacement/lineage break.
- **U4** (fresh production browser, post-710): Recent default row **once**;
  Sales default row **once**; exact-identity search `677BE5CE` → **exactly 1
  row**; detail opens and renders amount **Rp 24.000**, **DINE_IN**,
  Qty 2, both persisted ProductVariantIDs, `Status ACTIVE`,
  `localSnapshot:false` (canonical server record), `paymentStatus UNPAID` /
  `fulfillmentStatus OPEN` as data only, footer = `Close` only (no
  Correct/Void invoked), `lineCount 2` with both line IDs/amounts.
- **U5** (direct Finance computation — scope function of `36.Finance.Service`
  over the fresh U3 projection): Oct-2026 `recognizedRevenue 403000` =
  `expectedOctTotalFromEvents 403000`; target RecognitionID
  `occurrencesInEvents 1`, `signedAmount 24000` (**+24,000 exactly once**);
  `unresolvedCount 0`, `recoveryRequiredCount 0`, `integrityConflictCount 0`,
  `revenueAuthorityComplete true`.
- **PARITY = PASS**: U3 24,000 = U4 24,000 = U5 24,000, same lineage.
- **Accounting**: BalanceLedger unchanged (sha `ca572515a683c19c`); V2 journal
  still exactly `Dr 1030 24,000` / `Cr 4000 24,000` (`SRV2J-CE122B27-…`), no
  extra lines, no 5000/1100/2010/Cash-Bank/6210 attributable to this Sale;
  Policy C signature verified by the passing U3 projection.

### R4.7 Explicit limitation — original TTL window

The original defect was the immediate post-mutation **300 s stale-cache
window**; it has already expired and **R4 cannot recreate it without another
production mutation**. No Sale was fabricated, no Correct/Void used to force a
cache event, no production cache mutated for testing. Re-acceptance therefore
rests on: (1) deployed-source verification (68/68 sha match incl. U10F
logic), (2) measured local warm-cache regression against the exact defect
shape (`WarmCacheFreshness` PASS, FAIL pre-fix per U10F), (3) fresh
production U4 visibility of the existing Sale, (4) persisted U3/U4/U5 parity
for that Sale.

### R4.8 Carried-forward items (not fixed, not blocking R4)

- `FINANCE_UI_DISPATCH_DEFECT` — `ensureFinanceData()` ghost-in-flight join,
  `201.View.Finance.Controller.html:387-395`. Fresh U5 browser probe did not
  surface the Finance surface within the 420 s attempt window (terminated);
  classified as the known UI dispatch defect, NOT an accounting failure —
  direct Finance computation is correct (R4.6). Separate authorized fix
  later; final release-acceptance decision stays open.
- Observation (cosmetic, out of scope): when a transaction detail is served
  from the preload cache, `#transactionLifecycleState` keeps the
  `Loading transaction…` label after the canonical detail has rendered. Data
  is complete; no authorized fix in R4.

### R4.9 Status / next recommendation

`R4_U4_CACHE_FRESHNESS_DEPLOYMENT = COMPLETE` (19/19 success criteria).
`U10_SALES_V2_ACTIVATION_FIRST_EVENT = COMPLETE` is now justified by
accumulated evidence + deployed remediation (activation ACTIVE, operator
surface accepted, first genuine Sale accepted with U3/U4/U5 parity), subject
to the TTL-window limitation above. The Finance UI defect remains tracked
separately and is the remaining gate for overall release acceptance. No
automatic Treasury.
