# SALES_RECOGNITION_V2 — U9 Production Preparation Evidence

TASK_ID: U9-PROD-PREP-01 · Complexity L3 · Risk R4 · Reasoning high

**STATUS (U9-PROD-PREP-01, this section): BLOCKED (read-only preflight STOP).
Package gate COMPLETE. Zero production writes. No deployment. No activation.
No push.**

> Superseded by the resumed task — see **`# RESUMED U9B`** below:
> **STATUS: COMPLETE — 4 authorized preparation writes applied, ONE authorized
> PREPARED deployment pushed, runtime config verified `PREPARED / disabled`.**

## 1. Baseline gate (verified once)

- Repo `/Users/azer/Documents/GitHub/Numlock`. HEAD `7cc6e6d`
  (= required `7cc6e6d`), worktree clean at start. Never reset/checked out/
  cleaned/amended.
- U8 verdict: `COMPLETE — READY FOR U9 GATE`
  (`docs/SALES-RECOGNITION-V2-U8-RELEASE-EVIDENCE.md`).
- U8 verdict validity: `ccf42c6..7cc6e6d` contains only evidence/test files
  (5 files, +2701, no runtime source changes) → verdict stands.
- Environment: `clasp` 3.3.0 (authenticated), Node v24.18.0, live Google Sheets
  REST reachable through the stored `numlock-run` OAuth identity (scope
  `spreadsheets`). Apps Script Execution API (`clasp run` / `scripts:run`) is
  **not reachable** with either stored identity (see §7).

## 2. Phase 1 — Package gate (COMPLETE)

### 2.1 Upload manifest (`.claspignore`)

- Registered the five deferred runtime files (U8 limitation §10/U12-2 resolved):
  `!97.SalesRecognition.V2.Foundation.js`, `!97A.SalesRecognition.V2.Save.js`,
  `!97B.SalesRecognition.V2.Projection.js`, `!97C.SalesRecognition.V2.Correction.js`,
  `!97D.SalesRecognition.V2.OperatorGuard.js`.
- Deliberate, allowlist-style only — no include-all. `clasp status` after edit:
  **67 tracked files** (was 62; +5 V2), tests/docs/fixtures remain untracked.
  The five V2 files now appear under `Tracked files:` (verified by line position
  against the `Untracked files:` boundary).
- Excluded and verified untracked: `96.Tests.*`, `92/94/95.Tests.*`,
  `_test_runner.js`, `tests/**`, `.ai/`, `.codex/`, `docs/**`, `package*.json`,
  `index.html` (not needed: `doGet` serves `190.View.Index`).
- Retained pre-existing registrations (unchanged, pre-U9 behavior):
  `98.Tests.Runner.js` (production diagnostic bridge used by release runbooks),
  `97.Inventory.Receipt.*.Runtime.Proof.js`.

### 2.2 Dependency inventory derived FROM SOURCE (not filenames)

- All 118 top-level symbols referenced by the five V2 files resolve inside the
  registered production set (0 unresolved; includes `inventoryReceiptMigrationRequest_`
  transport, `preflightSalesRecognitionAccounts` inputs, projection/save/correction
  chains). Reverse direction: no registered production file references a symbol
  defined only in test/fixture files (6 regex fragments such as `INVALID_` are
  string literals, not symbols).
- V2 files are required by already-registered code: `95.Transaction.Operational.js`
  (payment/fulfillment guards), `95A.Transaction.Production.js`
  (`salesV2OperatorResolvedRoute_`, mode routing, annotation), `22`/`91`/`36`/`40`
  (cohort/projection readers) → without registration the current package was
  **not deployable**; registration is mandatory, not cosmetic.

### 2.3 Hygiene (V2 files under the now-active allowlist)

- Default `mode: "PREPARED"` (97 Foundation line 17); no `setProperty` in any
  V2 file; config layer never mutates properties (97D comment + code); no
  debug/bypass flag; no secret/token/key patterns; no fixture/disposable IDs;
  no hardcoded ActivationID/T (activation strings appear only as refusal codes).

### 2.4 Test assertion resolved (single deliberate test edit)

`tests/browser/sales-v2-u8-release-audit.js` asserted `V2_FILES_ALREADY_REGISTERED`
(U8-era placeholder deferring registration to this task). Updated to the
post-U9 state: all five V2 files **must** be registered
(`V2_FILES_NOT_REGISTERED` otherwise); `96.Tests.*` must stay excluded; hygiene
scan now covers the registered V2 files (secret scan passes). No other U1–U8
assertion touched.

## 3. Phase 2 — Read-only live preflight (fresh; MEASURED)

All reads are Sheets REST `values.get` / metadata `get` against the canonical
production workbook (identity = `NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID`
from `36.Finance.Service.js`). No write endpoint was called.

### 3.1 Accounts (full authoritative read, incl. inactive)

Header (9 cols) EXACT vs `CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS`:
`AccountCode, AccountName, AccountType, StatementGroup, CashFlowGroup, IsActive,
CreatedAt, UpdatedAt, NormalBalance`. 20 data rows. **No duplicate AccountCode
anywhere. All 10 required codes IsActive TRUE.**

| Code | Name | Type / Group | NormalBalance | Result |
| --- | --- | --- | --- | --- |
| 1030 | — (row absent) | — | — | **AVAILABLE_FOR_CREATION** |
| 2010 | — (row absent) | — | — | **AVAILABLE_FOR_CREATION** |
| 4000 | Sales Revenue | Revenue / Operating Revenue | **blank** (≠ frozen `CREDIT`) | **METADATA_MISMATCH** |
| 6210 | Raw Material Supplies Expense | Expense / Supplies Expense | blank (no frozen V2 expectation) | valid vs `ACCOUNT_CORE` (note) |
| 2000 | Accounts Payable | Liability / Current Liabilities | CREDIT | valid, untouched |
| 1000 | Cash on Hand | Asset / Current Assets | DEBIT | valid |
| 1010 | DANA Business | Asset / Current Assets | DEBIT | valid |
| 1020 | Cash in Owner Custody - BluBCA | Asset / Current Assets | DEBIT | valid |
| 1100 | Inventory Asset | Asset / Current Assets | DEBIT | valid |
| 5000 | Cost of Goods Sold | COGS / Cost of Goods Sold | blank (no frozen V2 expectation) | valid vs `ACCOUNT_CORE` (note) |

Production code executed against the LIVE rows (MEASURED):
`preflightSalesRecognitionAccounts(liveRows)` → **FAIL**
`[{1030, ACCOUNT_ABSENT}, {2010, ACCOUNT_ABSENT}, {4000, ACCOUNT_METADATA_MISMATCH}]`.
The 4000 mismatch alone makes the V2 Save account gate refuse in production
today, independent of any preparation write.

### 3.2 Companion + required schema (production gate, live)

Production code `salesRecognitionV2SaveSchemaGate_(live workbook adapter)`
→ **FAIL — badSheets: `SalesRecognitionEvents`, `SalesRecognitionAudits`,
`Products`, `ProductPricing`** (11 of 15 required sheets EXACT: Orders,
OrderLines, TransactionOperations, BalanceLedger, Accounts, ProductVariants,
RecipeVersions, RecipeVersionLines, InventoryItems, RecipeStandardCost,
InventoryUOMConversions).

- `SalesRecognitionEvents`: **ABSENT** (authorized creation target; frozen 20-col
  header from `SALES_RECOGNITION_V2_CONTRACT.HEADERS`).
- `SalesRecognitionAudits`: **ABSENT** — required by the same gate, but its
  creation is **not** in this task's AUTHORIZATION BOUNDARY.
- `Products`: actual header 10 cols (`…IsActive, CreatedAt, UpdatedAt, Notes`)
  vs frozen `PRODUCT_HEADERS` 7 cols → strict `requireCanonicalHeaders`
  (exact extent + order) fails. Reads elsewhere use the tolerant
  `readCanonicalTable` (required-subset), which is why current production
  readers work.
- `ProductPricing`: actual 11 cols (`ID_Price, …, Source, CreatedAt, UpdatedAt`)
  vs frozen `PRICING_HEADERS` 7 cols → same strict failure.

### 3.3 Config (ScriptProperties `SALES_RECOGNITION_V2_CONFIG`)

- **Direct live read: UNKNOWN — BLOCKED_PERMISSION.** Execution API is not
  callable: `clasp run validateFinanceProductionRuntime` → "Unable to run
  script function…"; direct `POST /v1/scripts/{id}:run` → `403
  PERMISSION_DENIED`. Stored identities grant `script.projects`/`script.deployments`
  but **no execution scope**; no sheet-backed config exists (Settings sheet
  scanned, no V2 markers).
- Source-based state (not a substitute for readback): the property key exists
  only in `97D` (never deployed), **no writer for it exists anywhere in the
  repository**, deployed project HEAD = commit `e934c6c` (ancestor, zero V2
  files). Local resolution with no PropertiesService:
  `salesV2OperatorResolvedRoute_()` → `{mode:"PREPARED"}`;
  `salesRecognitionV2RequestGate(DEFAULT_CONFIG)` → `V2_NOT_ACTIVATED`.
- Consequence: deployment pre-upload condition (4) `config PREPARED` is
  **unprovable in this environment** → deployment withheld (§5).

### 3.4 Existing V2 artifacts (expected: none) — CONFIRMED NONE

- `TransactionOperations`: 2 data rows, **0** with OperationType ∈
  {`SALES_RECOGNITION_V2_SAVE`, `SALES_V2_VOID`, `SALES_V2_CORRECT`}.
- `Orders`: 1 legacy row (`ORD-D0D68C09-…`), **0** V2 ContractVersion/ActivationID.
- `BalanceLedger`: 6 data rows, **0** containing `SRV2J`/`SALES_RECOGNITION_V2`.
- String scan (Settings, Logs, Payments, Settlements, InventoryLedger):
  no V2/recognition markers. `SalesRecognitionAudits`/`SalesRecognitionEvents`
  absent. → No backfill candidates; nothing unexpected found.

### 3.5 Protected-surface baselines (before-state, zero writes ⇒ identical after)

tabsal 10809 · tabops 1977 · Payments 2 · Settlements 3 · InventoryLedger 1 ·
BalanceLedger 7 · Accounts 21 (incl. header) · Logs 226 · TransactionOperations 3 ·
Orders 2 · OrderLines 2 (non-empty rows incl. header). Sheet IDs recorded for
companion-creation later (SalesRecognitionEvents: to be assigned).

## 4. Phase 3 / Production writes — NOT REACHED

Phase 3 requires **all** read-only gates PASS. Measured STOP triggers:

1. Accounts conflict: 4000 `METADATA_MISMATCH` (frozen production preflight
   FAIL) — "Any conflict → STOP before write; no auto-repair".
2. Required schema incompatible: `Products`, `ProductPricing` fail the strict
   U2 schema gate; `SalesRecognitionAudits` absent — "incompatible → STOP".
3. Config state unverifiable at runtime (§3.3).

**Exact production writes: Accounts = 0; schema = 0; config = 0; deployment
actions = 0.** No temporary ACTIVE, no T, no ActivationID, no V2 Sale, no
Correct/Void, no Treasury/1030/2010 posting, no migration, no synthetic Payment,
no PAID/COMPLETED, no U10, no Git push. Idempotency untested (no write issued;
readback before any future retry is mandatory per failure policy).

## 5. Deployment — NOT PERFORMED (conditions not met)

Pre-upload conditions: (1) local regression green ✓ · (2) package inventory
audited ✓ · (3) account/schema readback green ✗ (§3.1/§3.2 FAIL) ·
(4) config PREPARED ✗ (unprovable, BLOCKED_PERMISSION) · (5) no activation code
on load ✓ · (6) deploy cannot set ACTIVE ✓ (no writer; push only replaces
source) · (7) no first event emitted ✓ · (8) no auto migration/backfill ✓.
Two failures → no `clasp push`, no `clasp deploy`, no version created.
Pre-deploy HEAD for a future authorized push: `7cc6e6d` + this commit.

## 6. Local regression (MEASURED)

- After the last repository edit: `node _test_runner.js` → **91 PASS, 0 FAIL**
  (baseline ≥91 preserved; includes U8 suites, U7–U1 suites, mutation proofs,
  U8 release audit with the new registered-manifest assertion,
  controller/browser harness inside the runner).
- `node --check tests/browser/sales-v2-u8-release-audit.js` → OK.
- `git diff --check` → clean.

## 7. Environment capability record (exact states)

- Live Sheets REST read **and write**: AVAILABLE (identity `numlock-run`,
  scope `spreadsheets`) — preparation writes were executable; they were
  stopped by the preflight gates, not by capability.
- `clasp status`/`list-deployments` (read-only): AVAILABLE.
- Apps Script function execution (`clasp run`, `scripts:run`):
  **BLOCKED_PERMISSION** (403; no execution scope on either stored identity;
  both deployments do carry `EXECUTION_API` entry points).
- Direct Sheets REST via the `default` clasp identity: 403 (Sheets API not
  enabled for that OAuth client project) — superseded by the working identity.
- ScriptProperties live read: **BLOCKED_PERMISSION** (follows from execution
  block; no REST surface exists).

## 8. Limitations

1. Production preparation NOT completed: 1030/2010 rows not created,
   `SalesRecognitionEvents` not created (STOP before write).
2. 4000 `NormalBalance` is blank in production; the frozen V2 account gate
   requires `CREDIT`. Repairing an existing Accounts row is **outside** this
   task's authorization ("create ONLY missing rows").
3. `Products`/`ProductPricing` have extra trailing columns vs the frozen strict
   schema gate; reconciling headers (sheet edit) or any gate change (U1–U8 are
   frozen) requires separate owner decision.
4. `SalesRecognitionAudits` creation is required before any first V2 Save but is
   not authorized here.
5. Config/T/ActivationID: source-evidenced PREPARED/absent, runtime readback
   unavailable (BLOCKED_PERMISSION).
6. No live Apps Script runtime execution occurred at all (read or write) during
   this task.

## 9. Exact U10 prerequisites (each needs the stated separate authorization)

1. Owner remediation decisions + authorized writes for: 4000 `NormalBalance`
   (or an explicit authority change), Products/ProductPricing strict-schema
   reconciliation, `SalesRecognitionAudits` creation (frozen 10-col header).
2. Re-run this read-only preflight until `preflightSalesRecognitionAccounts`
   = PASS and `salesRecognitionV2SaveSchemaGate_` = PASS on live data.
3. Authorized preparation writes (if still missing): 1030 + 2010 rows (frozen
   metadata), `SalesRecognitionEvents` (0 business rows) with exact readback.
4. Config readback capability (Execution API scope) or equivalent authorized
   proof of `PREPARED/disabled`, T unset, no ActivationID.
5. Authorized `clasp push --force` (upload manifest gate: capture fresh
   `clasp status` = 67-file closure) — Rule 7 single-push; then post-deploy
   readback (§5 fields).
6. Separate activation authorization: mode `ACTIVE`, new ActivationID, NEW
   server T (never the forbidden `2026-10-06T18:50:05.328Z` instant), activation
   artifact readback.
7. First real V2 Sale + artifact readback, U3/U4/U5 parity checks, operator
   acceptance, rollback/pause decision record.

## 10. Telemetry

agent numlock-critical (executed in-session), backend/model
`9router/numlock-explore-free`, reasoning high, fallback not used, delegation
none, toolcalls UNKNOWN (not instrumented), elapsed UNKNOWN (not instrumented),
files read/modified: `.claspignore` (+5 lines),
`tests/browser/sales-v2-u8-release-audit.js` (manifest assertion), this document;
test runs: 1 × `node _test_runner.js` = 91 PASS / 0 FAIL after final source
edit (re-run as final audit). No secrets, no scriptId, no tokens recorded.

---

# RESUMED U9B — U9B Production Preparation (execution)

TASK_ID: U9B-PROD-PREP-02 · Complexity L3 · Operational risk R4 · Reasoning high
Backend/model `9router/numlock-explore-free` (numlock-critical, executed in-session).
Owner authorization: exactly items 1–8 (two Accounts appends, two companion sheet
creations, read-only preflight/readback, ONE `clasp push --force`, post-push
read-only verification, local evidence/commit).

**STATUS: COMPLETE — production ends `PREPARED / disabled`.**
All 18 completion gates measured PASS (details §U9B-11/U9B-13).
Residual limitations: §U9B-12. **No activation, no Sale, no Correct/Void, no
Treasury, no historical rewrite, no config write, no Git push, no second push.**

## U9B-1 Baseline gate (verified first)

- Repo `/Users/azer/Documents/GitHub/Numlock`; HEAD `d8e2568` = required
  `d8e2568`; `git status --short` empty (clean) at start. Never
  reset/checked out/cleaned/amended/discarded at any point this task.
- U9R baseline inherited: `docs/SALES-RECOGNITION-V2-U9-PREFLIGHT-RECONCILIATION.md`
  = COMPLETE (missing prerequisites exactly = Account 1030, Account 2010,
  SalesRecognitionEvents, SalesRecognitionAudits; package = 67 tracked files;
  V2 not deployed; production V2 business artifacts = 0).
- Deployment inventory: `clasp status` tracked = **67**, byte-identical to the
  `.claspignore` allowlist (67 `!` entries; `diff` = empty), including all five
  V2 runtime files (`97`, `97A`–`97D`) plus `98.Tests.Runner.js`;
  tests/docs/fixtures excluded. No unreviewed file in the clasp package.

## U9B-2 Phase 1 — fresh pre-mutation preflight (read-only, MEASURED)

Reads = Sheets REST `values.get` / metadata `get` against the canonical
production workbook (`NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID` from
`36.Finance.Service.js`) via stored identity `numlock-run` (refresh flow,
in-memory token; no credential file mutation). Zero write endpoints called.

- Sheets inventory: 36 sheets; `SalesRecognitionEvents` AND
  `SalesRecognitionAudits` **both absent** (range parse 400 on both) → create,
  do not classify as existing.
- Accounts (9-col exact header, 20 data rows): 1030 **ABSENT**
  (`AVAILABLE_FOR_CREATION`); 2010 **ABSENT** (`AVAILABLE_FOR_CREATION`);
  0 duplicate codes; 0 inactive rows; 2000 unchanged (CREDIT, active);
  6210 valid/active; 4000 present, `NormalBalance` blank = frozen legacy
  convention. Blank-`NormalBalance` set unchanged: 4000, 5000, 6100, 6200,
  6210, 6300, 6310, 6400, 6500.
- Frozen production gates executed against LIVE data in a VM harness loading
  the deployed sources (measured):
  - `preflightSalesRecognitionAccounts(liveRows)` → **FAIL**
    exactly `{1030 ACCOUNT_ABSENT, 2010 ACCOUNT_ABSENT}` (4000 valid under the
    reconciled U9R authority; no metadata mismatch).
  - `salesRecognitionV2SaveSchemaGate_(live adapter)` → **FAIL** badSheets =
    `{SalesRecognitionEvents, SalesRecognitionAudits}` only (other 13 sheets
    exact; Products prefix-7 and ProductPricing presence-7 pass the corrected
    additive gates).
- V2 artifacts: 0 markers (`SALES_RECOGNITION_V2`, `SRV2J`, `SALES_V2_VOID`,
  `SALES_V2_CORRECT`, `ContractVersion`, `ActivationID`, …) across tabsal,
  tabops, Payments, Settlements, InventoryLedger, BalanceLedger, Accounts,
  Logs, TransactionOperations, Orders, OrderLines, Settings, Products,
  ProductPricing. TransactionOperations 2 data rows, Orders 1, BalanceLedger 6,
  Payments 1, Settlements 2, InventoryLedger 0, tabsal 10808, tabops 1976 —
  all pre-V2. **No unexpected business artifact → no STOP.**
- Protected-surface baseline captured (non-empty row counts incl. header and
  SHA-256 of the canonical values matrix) for all 14 surfaces above.
- **Deviations:** none in Phase 1. One environment deviation occurred during
  deployment inventory (before any workbook write): the intended list command
  `clasp version list` was parsed by clasp 3.3.0 as *create-version* and
  created **Apps Script version `706` (description "list")**. Measured impact:
  an inert snapshot of the then-deployed (pre-push) source; the two deployments
  stayed exactly `@HEAD` and `@705`; no code served by the app changed; no
  workbook/config effect; no version-delete API exists (no cleanup attempted —
  a retry/fix loop is prohibited). Recorded here as an unauthorized artifact
  outside items 1–8 and as a limitation (§U9B-12).

## U9B-3 Phase 2 — Account mutation (items 1–2, EXACTLY_APPLIED)

Pre-write idempotency: fresh read immediately before the call re-proved
`1030 absent, 2010 absent` (dataRows=20).

Single controlled mutation: **one** `values.append` (`Accounts!A:I`,
`valueInputOption=RAW`, `insertDataOption=INSERT_ROWS`) carrying both rows →
`200`, `updatedRange Accounts!A22:I23`, `updatedRows 2`, `updatedColumns 9`,
`updatedCells 18`.

| Code | AccountName | AccountType | StatementGroup | CashFlowGroup | IsActive | NormalBalance |
| --- | --- | --- | --- | --- | --- | --- |
| 1030 | Sales Settlement Clearing | Asset | Current Assets | Operating | TRUE | DEBIT |
| 2010 | Customer Refund and Credit Payable | Liability | Current Liabilities | Operating | TRUE | CREDIT |

`CreatedAt`/`UpdatedAt` = `2026-10-09 01:03:50` (Asia/Jakarta, production text
convention). Readback (mandatory, before anything else): header byte-identical;
data rows 20 → 22 (**+2 exactly**); all 20 prior rows **byte-identical**;
`1030` count=1 active TRUE exact metadata; `2010` count=1 active TRUE exact
metadata; 0 duplicate codes; no existing-row modification; no 4000/2000 edit.

## U9B-4 Phase 3 — Companion schema creation (items 3–4, EXACTLY_APPLIED)

Headers generated **from the deployed contract objects in-process**
(`SALES_RECOGNITION_V2_CONTRACT.HEADERS` = 20, `SALES_RECOGNITION_V2_SAVE.
AUDIT_HEADERS` = 10) — no hand transcription. Pre-create re-read: both sheets
absent, sheet IDs `1200000018`/`1200000019` collision-free (36-sheet inventory).

One controlled mutation: **single** `spreadsheets.batchUpdate` with 4
subrequests (2 × `addSheet` + 2 × `updateCells` header row, `fields=
userEnteredValue`, RAW string cells) → `200`.

- `SalesRecognitionEvents`: sheetId 1200000018, grid 1000×20, index 36.
- `SalesRecognitionAudits`: sheetId 1200000019, grid 1000×10, index 37.

Readback: sheetCount 36 → 38; each title present exactly once; header row
exact (20 / 10 columns, names and order byte-equal to contract); **business
rows = 0** for both (full-sheet read = 1 row each). No sample/fake rows, no
second sheet, no duplicate name, no delete/recreate.

## U9B-5 Phase 4 — full pre-deploy live gates (MEASURED)

- Account gate: `preflightSalesRecognitionAccounts(fresh live rows)` →
  **PASS** (22 rows, errors []).
- Save schema gate vs LIVE adapter (all 15 gate sheets, live headers):
  **PASS**, badSheets [].
- V2 artifacts still 0 (post-write marker scan: 0 hits on all 14 protected
  surfaces; companion rows 0).
- Protected surfaces before → after writes: **only** `Accounts` hash changed
  (21 → 23 non-empty rows); Products, Orders, Settlements,
  TransactionOperations, Logs, tabops, Settings, ProductPricing, BalanceLedger,
  OrderLines, Payments, InventoryLedger, tabsal all SHA-identical.
- No gate FAIL → deployment preconditions satisfied.

## U9B-6 Phase 5 — local pre-push release check (MEASURED)

Immediately before the push, with no source edits this task (worktree clean):

- `clasp status` → **67 tracked files**, `diff` vs allowlist = empty
  (`PREPUSH_MANIFEST_MATCH_67`).
- `node _test_runner.js` → **91 PASS, 0 FAIL** (baseline ≥91 preserved; U1–U8
  suites, mutation proofs incl. VM source-injection, U8 release audit,
  controller/browser harness). MEASURED after the final source state.
- `node --check` on every tracked `.js` file → 0 failures.
- `git diff --check` → clean; `git status --short` → empty; HEAD `d8e2568`.
- Deployed HEAD recorded: local HEAD `d8e256838e24b891556c18306b38de394b21489c`.

## U9B-7 Phase 6 — single PREPARED deployment (item 6)

Exactly **ONE** `clasp push --force` executed by the agent (Rule 8). Outcome
verified **read-only afterwards** through the Apps Script Projects API
(`projects.get` + `projects.getContent`, identity `numlock-run`):

- `updateTime = 2026-10-08T18:07:02.529Z` (= push time, Asia/Jakarta
  2026-10-09 01:07); deployed `fileCount = 67`;
- `missingOnDeploy = []`, `contentMismatch = []`, `deployedOnlyExtra = []` —
  every deployed file SHA-256-equal to the local audited package; no stray
  file.
- Deployed code default state = `PREPARED/disabled`; push replaces source only
  (no activation, no Sale, no migration). **Rule 7 respected: no second push
  was issued, and none will be issued in U9B** (ambiguous result → STOP; none
  occurred).

## U9B-8 Phase 7 — post-push runtime config readback (HARD GATE, MEASURED)

Execution API is now reachable for read-only invocation with identity
`numlock-run` (direct `POST /v1/scripts/{scriptId}:run`, HTTP 200). The
deployed function that reads the authoritative `PropertiesService` key
`SALES_RECOGNITION_V2_CONFIG` was invoked repeatedly (read-only):

- `salesRecognitionV2OperatorConfig()` →
  `{contractVersion: "SALES_RECOGNITION_V2", mode: "PREPARED",
  activationID: "", activatedAt: "", configVersion: 1}` — HTTP 200,
  reproduced (2 separate no-arg calls + initial call = 3×200).
- Discriminator probe: `salesRecognitionV2OperatorConfig({mode:
  "SENTINEL_PROBE_NO_PROPERTY"})` → returned the sentinel unchanged (200) ⇒
  **no valid script-property override exists** (a present valid config would
  replace the fallback; the sentinel is never written anywhere — 0 config
  writes).
- `salesRecognitionV2DefaultConfig()` → same object as the no-arg result ⇒
  observed config **is** the PREPARED default; nothing supersedes it.
- Therefore: **`mode = PREPARED`, V2 disabled, `activatedAt`/T absent,
  `ActivationID` absent, no ACTIVE** — directly observed in the deployed
  runtime (not source fallback).
- Route-level cross-check attempted: `salesV2OperatorResolvedRoute_`,
  `salesV2OperatorConfigState_`, `salesV2OperatorRoute_`,
  `salesV2OperatorLegacySalesGuard_`, `transactionPayloadHash_` all return
  API-level `403 PERMISSION_DENIED` (5/5), while 7/7 non-underscore
  functions return 200 and a bogus name returns 200 `FUNCTION_NOT_FOUND` ⇒
  the 403 is an Execution API refusal for trailing-underscore entry points,
  not "not found". `clasp run …` also stays blocked (generic permission
  message). Consequence and residual risk: §U9B-12.
- Other read-only runtime invocations (all 200 unless noted, all read-only):
  `preflightSalesRecognitionAccounts(live 22 rows)` → **PASS at runtime**;
  `validateFinanceProductionRuntime` → 200; `runTransactionProductionPreflight
  Diagnostic` → 200 (`readOnly: true, writeCount: 0`); `canonicalDate` → 200;
  `salesRecognitionV2DefaultConfig` → 200; `getBackendTestRegistry` → 200
  (script error: test case files are intentionally not deployed); bogus name →
  200 `FUNCTION_NOT_FOUND`. One probe attempt failed with 401 (client token
  bug in the probe script, fixed locally, no server effect) — re-measured 200.

**No config write was performed. No ACTIVE/T/ActivationID was set.**

## U9B-9 Phase 8 — post-push zero-event proof (MEASURED)

Post-push fresh full reads of every protected surface + both companions:

- `SalesRecognitionEvents` business rows = **0** (header only, 20 cols);
  `SalesRecognitionAudits` business rows = **0** (header only, 10 cols).
- TransactionOperations 2 (0 V2/VOID/CORRECT operation rows), Orders 1 legacy
  (0 V2), OrderLines 1 legacy, BalanceLedger 6 legacy (0 `SRV2J`/`SRV2`-marked),
  Payments 1, Settlements 2, InventoryLedger 0, tabsal 10808, tabops 1976,
  Logs 225 — **SHA-256 identical to the pre-write baseline on every one**.
- Marker scan across all 14 protected surfaces: **0 hits** post-push.
- Deployment = **zero economic effect**: 0 Payment/Settlement changes, 0
  InventoryLedger changes, 0 historical Sales mutations, 0 V2 business events.

## U9B-10 Phase 9 — final readback

- Accounts: 22 data rows, 9-col header unchanged; `1030` count=1 exact
  (`Sales Settlement Clearing / Asset / Current Assets / Operating / TRUE /
  DEBIT`); `2010` count=1 exact (`Customer Refund and Credit Payable /
  Liability / Current Liabilities / Operating / TRUE / CREDIT`); `4000`
  unchanged (blank NormalBalance legacy), `2000` unchanged (CREDIT), `6210`
  valid; 0 duplicate codes; all 20 prior rows byte-identical.
- Schemas: Events 20 headers exact / 0 business rows; Audits 10 headers exact /
  0 business rows; Products (10-col additive prefix-7) and ProductPricing
  (11-col additive presence-7) unchanged (SHA-identical) → live save schema
  gate PASS; live account preflight PASS (re-run at runtime).
- Config (direct, post-push): `PREPARED`, `activatedAt = ""`,
  `activationID = ""` (§U9B-8).
- Sheets inventory: 38 = 36 original + exactly the 2 authorized companions.
- Artifacts: zero V2 business artifacts anywhere.
- Protected surfaces: unchanged **except the only 4 authorized differences**
  (+1 Accounts sheet rows for 1030, +1 for 2010, +SalesRecognitionEvents sheet,
  +SalesRecognitionAudits sheet). No other surface changed (hash comparison).

## U9B-11 Exact write accounting (measured, separate classes)

| Class | Unit | Count | Detail |
| --- | --- | --- | --- |
| Production data mutation | controlled `values.append` requests | **1** | Accounts, 2 rows, 18 cells (A22:I23) |
| Production schema mutation | controlled `batchUpdate` requests | **1** | 4 subrequests: 2 `addSheet` + 2 header `updateCells` |
| Production data/schema mutation units total | — | **2** | rows/sheets: +2 account rows, +2 sheets, +2 header rows |
| Deployment | `clasp push --force` | **1** | audited 67-file package; single-push rule kept |
| Config writes | Script Property writes | **0** | read-only probes only |
| Business/economic writes | Orders/OrderLines/Payments/Settlements/BalanceLedger/InventoryLedger/tabsal/tabops/Logs | **0** | all SHA-identical to baseline |
| Apps Script version artifacts | unintended | **1** | version `706` created by mistaken `clasp version list` before any workbook write (§U9B-2, §U9B-12); deployments unaffected |
| Git | commits (this task, evidence only) | 1 local commit | no Git push |

## U9B-12 Limitations (honest residuals)

1. **Unintended Apps Script version `706`** ("list") exists; created by clasp
   interpreting `clasp version list` as *create-version*. Inert (no deployment
   references it; deployments remain `@HEAD` + `@705`; snapshot predates this
   push so it contains no V2 code). No delete API → not removed; no further
   attempt made. This is outside the authorized item set and is reported as a
   deviation.
2. **Malformed-manual-property residual (config):** the authoritative resolver
   output is PREPARED/blank-T/blank-ActivationID and no *valid* property
   override exists (sentinel probe), but the raw property value cannot be
   displayed: the route/state entry points that would distinguish
   "property absent" from "property present-but-invalid" end in `_` and are
   refused by the Execution API (403, measured 5/5). A present-but-invalid
   property would fail closed to `REJECT` (V2 still disabled, no write path),
   and no repository code writes the key (U9R structural proof) — but the raw
   value itself is not directly displayed.
3. `clasp run …` remains blocked (generic permission message); the working
   mechanism is direct Execution API invocation with identity `numlock-run`.
4. `clasp versions` cannot delete version 706; if the owner wants it removed,
   that is an editor/UI action outside this contract.
5. 4000 `NormalBalance` stays blank by frozen convention (no repair performed
   or required); Products/ProductPricing stay additive (no sheet edit
   performed or required).

## U9B-13 Completion gates (18/18 MEASURED PASS)

1 1030 exact+unique · 2 2010 exact+unique · 3 Events 20 exact/0 rows ·
4 Audits 10 exact/0 rows · 5 live account preflight PASS (local + runtime) ·
6 live schema preflight PASS · 7 package audit PASS (67 = allowlist, content
hash match post-push) · 8 exactly one authorized PREPARED deployment ·
9 runtime config directly verified PREPARED/disabled · 10 `activatedAt`/T
absent · 11 `ActivationID` absent · 12 zero V2 business events ·
13 protected surfaces unchanged except the 4 authorized · 14 no historical
rewrite (tabsal/tabops/all protected SHA-identical; prior Accounts rows
byte-identical) · 15 no Treasury (Settlements/Payments/BalanceLedger
SHA-identical) · 16 local regression green (91 PASS / 0 FAIL) ·
17 worktree clean · 18 no Git push.

**PRODUCTION PREPARATION VERDICT: PREPARED / disabled — ready for
`U10 — Deployment / Activation / First Real Event` (separate authorization
required for mode ACTIVE, new ActivationID, new T, first V2 Sale, Correct/Void,
Treasury/1030/2010 postings, historical migration, U10 itself).**

## U9B-14 U10 prerequisites (unchanged from U9R, now satisfied)

Prerequisites 1–3 and 5 of U9R §9 are **satisfied** (accounts, companions,
live gates, single authorized push + manifest). Remaining for U10 (each needs
its own explicit authorization): Execution-API readback already working (keep
using `salesRecognitionV2OperatorConfig`); activation write (U9R step 6);
first production V2 Sale + artifact readback (U9R step 7); operator acceptance
and rollback/pause decision record.

## U9B-15 Validation and telemetry

- Local validation: `node _test_runner.js` → 91 PASS / 0 FAIL (1 run, after
  final source state; no source edits this task) · `node --check` all tracked
  `.js` → 0 failures · `git diff --check` → clean · `git status --short` →
  empty.
- Evidence classes: local/static = measured; clasp upload = measured
  (Projects API content hash match, 67/67); Apps Script runtime = measured
  (Execution API 200 read-only calls incl. config resolver + runtime account
  preflight); browser acceptance = not applicable (no UI change).
- Telemetry: agent numlock-critical (executed in-session), backend/model
  `9router/numlock-explore-free`, reasoning high, fallback not used, delegation
  none, toolcalls UNKNOWN (not instrumented), elapsed UNKNOWN (not
  instrumented), files read: repo sources/tests/docs + live workbook reads;
  files modified: this document only (source untouched); test runs: 1 ×
  `node _test_runner.js` = 91 PASS / 0 FAIL. No secrets, no scriptId, no
  tokens recorded.
