# SALES_RECOGNITION_V2 — U9 Production Preparation Evidence

TASK_ID: U9-PROD-PREP-01 · Complexity L3 · Risk R4 · Reasoning high

**STATUS: BLOCKED (read-only preflight STOP). Package gate COMPLETE. Zero production
writes. No deployment. No activation. No push.**

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
