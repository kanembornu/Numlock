# SALES_RECOGNITION_V2 — U10 Activation + First Event Evidence

TASK_ID: U10A-ACTIVATION-CLOSURE-01 (successor to U10-ACTIVATION-FIRST-EVENT-01) · Complexity L3 · Operational risk R4 · Reasoning high
Backend/model `9router/numlock-explore-free` (numlock-critical, executed in-session).

**STATUS: `ACTIVATED_WAITING_FOR_FIRST_REAL_EVENT` — production
`SALES_RECOGNITION_V2` is `PRODUCTION_ACTIVE` (activation accepted); first
genuine Sale not yet available.**

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
