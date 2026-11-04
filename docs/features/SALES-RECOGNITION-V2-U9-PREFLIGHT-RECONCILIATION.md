# SALES_RECOGNITION_V2 — U9 Preflight Reconciliation

TASK_ID: U9R-RECONCILIATION-01 · Complexity L3 · Risk R2 (read-only production; zero
production writes) · Reasoning high

**STATUS: COMPLETE — all four blockers factually dispositioned; complete resumed-U9
mutation plan below. Zero production writes. No deployment. No activation. No push.**

Baseline gate (verified once): repo `/Users/azer/Documents/GitHub/Numlock`, HEAD
`56ab5e90ba7376945e5940fb773a2ba65959978a` (= required `56ab5e9`), clean worktree at
start. Never reset/checked out/cleaned/amended.

Live evidence (MEASURED 2026-10-09): Sheets REST `values.get` / metadata `get` against
the canonical production workbook (`NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID`
from `36.Finance.Service.js`) through the stored `numlock-run` OAuth identity (refresh
flow; read-only calls only). Apps Script Execution API re-measured this session:
`clasp run validateFinanceProductionRuntime` → "Unable to run script function…"
(BLOCKED_PERMISSION, unchanged).

## 1. Decision table

| Blocker | Live fact (MEASURED) | Frozen requirement | Root cause | Resolution | Production write required? |
| --- | --- | --- | --- | --- | --- |
| 1. 4000 `NormalBalance` blank vs gate `CREDIT` | Accounts: 9-col exact header, 20 data rows, no duplicates, all active. `NormalBalance` blank on exactly 9 rows: 4000 (Revenue), 5000 (COGS), 6100/6200/6210/6300/6310/6400/6500 (Expense). Populated: all 6 Assets, all 3 Equity, 2000 (Liability), 6900 (only Expense with proven frozen metadata). 4000 follows the migration convention (not anomalous). | Frozen migration contracts never persist `NormalBalance` for 4000 (`ACCOUNT_CORE["4000"]` has no NormalBalance element; `ACCOUNT_METADATA` has no 4000 entry; `buildBalanceFoundationSchemaMigrationCandidate` writes blank for unproven codes; `buildBalanceAccountMetadata` and `classifyCashAccountsState`/`LEGACY_CASH_TAXONOMY` treat blank as valid legacy). No Finance/P&L/BalanceLedger/posting consumer reads `NormalBalance`. The V2 U1 preflight demanded persisted `CREDIT`; U1.md itself cites a test fixture (`96.Tests.Cash.Foundation.Cases.js`) as its NormalBalance source. | V2 U1 account gate stricter than its own cited authority: it required a persisted metadata value that no frozen producer ever writes for 4000. | `V2_ACCOUNT_GATE_TOO_STRICT_FOR_EXISTING_AUTHORITY` → smallest local correction in `97.SalesRecognition.V2.Foundation.js`: blank `NormalBalance` tolerated for 4000 only (legacy no-claim; derivable Revenue ⇒ CREDIT). Non-blank must still equal `CREDIT`; wrong type/name/group/cash-flow/inactive/duplicate/absent still fail; 1030/2010 stay exact (incl. NormalBalance). | No (gate corrected; optional cosmetic repair of the 4000 cell NOT required and NOT requested) |
| 2. Products 10 cols / ProductPricing 11 cols vs gate 7 | Products header = required 7 EXACT prefix in frozen order + trailing `CreatedAt, UpdatedAt, Notes`; 34 data rows; `RevenueAccountCode`="4000", `COGSAccountCode`="5000". ProductPricing header = `ID_Price` (extra, leading) + required 7 (each present exactly once; `Source` interleaved between `Harga` and `IsActive`; `CreatedAt, UpdatedAt` trailing); 154 data rows. | U2 schema gate used `requireCanonicalHeaders` (exact width+order) for all 15 sheets. But: V2 Save never writes Products/ProductPricing (batch = 5 appendCells surfaces only); all V2 authority reads use `readCanonicalTable` (header-name, required-subset — the tolerant reader that makes current production readers work); the only positional consumer is the frozen dashboard bounded read (`getCanonicalTransactionData` → `readBoundedCanonicalTable(Products, 7)`) which requires the required-7 prefix — satisfied by live layout. Transport does not depend on width; exact width is not genuinely frozen for these two read-only authorities. | Uniform strict extent check applied to two read-only master sheets whose frozen consumers are name-based (Pricing) or prefix-based (Products). | `U2_SCHEMA_GATE_TOO_STRICT_ADDITIVE_COLUMNS_SAFE` → smallest local correction in `97A.SalesRecognition.V2.Save.js`: `salesRecognitionV2SaveAuthoritySheetOk_` — required columns present exactly once by name; Products additionally requires the frozen 7-column prefix order (protects the positional bounded reader); extras allowed; all other 13 sheets stay strict exact. Tests C23–C33 cover the 10 required scenarios. | No (additive live columns proven safe) |
| 3. SalesRecognitionAudits absent | Sheet ABSENT (36-sheet inventory read; only `SalesRecognitionEvents` + `SalesRecognitionAudits` of the 15 gate sheets are absent; the other 13 EXACT-PASS live). | U2 freezes exactly one Save audit row per commit on `SalesRecognitionAudits` (10 columns); U6 VOID/CORRECT also append audit rows (`97C` WRITE_SURFACES). | Sheet never created; its creation was outside the prior task's authorization boundary. | `AUDIT_SCHEMA_CREATION_REQUIRED` — confirmed. Exact creation contract in §4. Do NOT create without authorization. | Yes — create `SalesRecognitionAudits` (and `SalesRecognitionEvents`, previously authorized) with 0 business rows |
| 4. Config live readback 403 | `clasp run validateFinanceProductionRuntime` → "Unable to run script function…" (re-measured). Deployed HEAD `e934c6c` contains ZERO V2 files and ZERO references to `SALES_RECOGNITION_V2_CONFIG` (key introduced only in `ccf42c6`/`56ab5e9`; both post-date e934c6c). Only Script Property used by deployed code: `NUMLOCK_DASHBOARD_CACHE_REVISION` (`90.Dashboard.Service.js`, unchanged since e934c6c) — unrelated key. No deployed code reads/writes any V2 config property; a runtime Script Property could only exist via manual editor action and would be inert on the deployed system. | U7 config: `salesV2OperatorConfigState_` reads Script Property `SALES_RECOGNITION_V2_CONFIG`; absent/blank → default PREPARED; invalid → REJECT. T (`activatedAt`) and `ActivationID` exist only inside that property (and in V2 rows — measured zero). | Runtime property absence cannot be proven with the current tooling: Execution API lacks scope on both stored identities, and the deployed project (e934c6c) contains no function that reads the V2 config key (so even an execution-scoped `clasp run` cannot read it until the V2 source is deployed). | `CONFIG_STATE_CANNOT_BE_PROVEN` (runtime). Structural proof recorded: deployed system cannot be ACTIVE via any code path; zero V2 artifacts; no property writer exists anywhere in the repository. Definitive readback becomes possible only post-push via `clasp run salesV2OperatorResolvedRoute_` (see §6). No config writes performed. | No (remediation is permission/deployment sequencing, not a data write) |

## 2. Exact required Products / ProductPricing fields

Products — required V2/master authority fields (all EXACT, present exactly once; live
status):

| Required field | Live column | Status |
| --- | --- | --- |
| `ID_Prod` | col 1 `ID_Prod` | EXACT (prefix position 1) |
| `Produk` | col 2 `Produk` | EXACT |
| `Kategori` | col 3 `Kategori` | EXACT |
| `Kind` | col 4 `Kind` | EXACT |
| `RevenueAccountCode` | col 5 `RevenueAccountCode` | EXACT (values "4000") |
| `COGSAccountCode` | col 6 `COGSAccountCode` | EXACT (values "5000") |
| `IsActive` | col 7 `IsActive` | EXACT |

Extras (harmless additive, trailing): `CreatedAt`, `UpdatedAt`, `Notes`.

ProductPricing — required fields:

| Required field | Live column | Status |
| --- | --- | --- |
| `ID_Prod` | col 2 | EXACT (name-based; once) |
| `Tipe` | col 3 | EXACT |
| `EffectiveFrom` | col 4 | EXACT |
| `EffectiveTo` | col 5 | EXACT |
| `HPP` | col 6 | EXACT |
| `Harga` | col 7 | EXACT |
| `IsActive` | col 9 | EXACT |

Extras (harmless additive): `ID_Price` (leading), `Source` (interleaved), `CreatedAt`,
`UpdatedAt` (trailing). No MISSING, DUPLICATE, or SEMANTIC_CONFLICT columns. Note: the
REST read renders date cells as serial numbers; Apps Script `getValues()` returns Date
objects (as proven by years of working production pricing resolution through the same
`canonicalDate` path) — a rendering artifact, not a schema defect.

## 3. Frozen U2 Save authority (traced)

- Required fields from Products: exactly the 7 above (semantic meaning: product
  identity/name/category/kind + revenue/COGS account mapping + active flag). Read by
  header name via `readCanonicalTable` (`95A.Transaction.Production.js`
  `transactionProductionAuthority_`, `92.Products.Domain.js`) and positionally-first-7
  by `getCanonicalTransactionData` (`20.Data.Source.js`).
- Required fields from ProductPricing: exactly the 7 above (price authority: product/type
  key, effective window, HPP, Harga, active). Name-based reads only.
- U2 Save never writes either sheet: `WRITE_SURFACES` = Orders, OrderLines,
  SalesRecognitionEvents, BalanceLedger, SalesRecognitionAudits; the single
  `batchUpdate` carries exactly five `appendCells` subrequests. Width-independent.
- Proof of dispositions: positional authority exists ONLY for Products first-7
  (satisfied by live prefix; now enforced by the corrected gate); exact width is NOT
  genuinely frozen for these two read-only masters (all frozen consumers are name-based
  or prefix-based); transport does NOT depend on their width.

## 4. `V2_REQUIRED_PRODUCTION_COMPANION_SURFACES` (complete inventory)

Derived from ALL V2 source reads (`97/97A/97B/97C/97D`) plus the full live sheet
inventory. Per-surface:

1. **SalesRecognitionEvents** — 20 columns, exact order:
   `RecognitionID, ContractVersion, ActivationID, OrderID, RevisionID, EventType,
   RecognizedAt, EconomicDate, Amount, RecognitionJournalID, JournalSignature,
   PostingStatus, OperationID, AuditID, OriginalID, ReversalOfRecognitionID,
   ReplacementID, Reason, Actor, SnapshotJSON`.
   Required-by: U2 Save (write + cohort/verify read), U6 Void/Correct (write + target
   evidence), U7 cohort annotation (read), U3/U4/U5 projection + Finance scope (read).
   Expected pre-activation business rows: **zero** (measured: sheet absent; zero V2
   artifacts anywhere). Present in production: **NO**. Required U9 action: create with
   exact header, 0 business rows (previously inside the preparation authorization
   boundary).
2. **SalesRecognitionAudits** — 10 columns, exact order:
   `AuditID, ContractVersion, OperationID, RequestKey, OrderID, RecognitionID,
   JournalID, PayloadHash, Actor, SavedAt`.
   Required-by: U2 Save (exactly one row per commit, same batch), U6 Void (Void audit),
   U6 Correct (Correct audit), U3 projection audit-set verification (read).
   Expected pre-activation business rows: **zero**. Present in production: **NO**.
   Required U9 action: create with exact header, 0 business rows — **creation requires
   explicit owner authorization** (was outside the prior boundary).
3. All other gate surfaces — Orders (14), OrderLines (11), TransactionOperations (10),
   BalanceLedger (16), Accounts (9), ProductVariants (10), RecipeVersions (9),
   RecipeVersionLines (5), InventoryItems (12), RecipeStandardCost (10),
   InventoryUOMConversions (24), Products (prefix-7 + additive), ProductPricing
   (presence-7 + additive): present live; 13 exact-PASS, 2 pass under the corrected
   semantic gate. No other required-but-unauthorized companion exists (broad search:
   the only sheet-name literals referenced by V2 runtime code are the 15 gate surfaces;
   97D optional reads of TransactionOperations/SalesRecognitionEvents tolerate absence).

Exact mutation authorization text needed for resumed U9 (owner to sign):

> AUTHORIZED: create exactly two new sheets in the canonical production workbook
> (`NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID`): (a) `SalesRecognitionEvents`
> with the exact frozen 20-column header in order and zero business rows; (b)
> `SalesRecognitionAudits` with the exact frozen 10-column header in order and zero
> business rows. Header-only append (one row each). No other sheet, no other row, no
> cell edits to existing sheets. Mandatory fresh readback of both headers and
> zero-row counts immediately after; uncertain result → STOP, no retry, reconcile
> read-only. Zero Accounts/ProductPricing/Products/config/deployment side effects.

## 5. Account metadata conclusion

`NormalBalance` decision: **C — optional legacy metadata** (with B as its semantic
derivation): blank = "no claim", derivable from `AccountType` (Revenue ⇒ CREDIT); any
non-blank value must exactly match the frozen metadata for proven codes; wrong
non-blank fails closed everywhere (`buildBalanceAccountMetadata`
`NORMAL_BALANCE_MISMATCH`, cash taxonomy exact match, V2 preflight). The persisted-CREDIT
requirement for 4000 was **D — only newly introduced by the V2 U1 strict gate**, anchored
on a test fixture rather than on `ACCOUNT_CORE`. Production is convention-following, not
violating: its blank set is exactly the frozen "unproven codes stay blank" contract.
Correction implemented (local, pure): blank `NormalBalance` passes preflight for 4000
only; 1030/2010 remain exact DEBIT/CREDIT; wrong explicit 4000 balance still fails.

## 6. Config conclusion

`CONFIG_STATE_CANNOT_BE_PROVEN` (runtime property absence). What IS proven:
deployed HEAD `e934c6c` has zero V2 code and zero references to the config key; no
repository code path anywhere writes `SALES_RECOGNITION_V2_CONFIG`; the only deployed
property key is the unrelated dashboard cache revision; zero V2 artifacts exist, so no
ActivationID/T is persisted anywhere; on the deployed system the V2 config property
would be inert (no reader). What cannot be proven with current tooling: that no
manually-created Script Property exists. Resolution path: (i) owner remediates
Execution API permission (an execution-capable identity for `clasp run`) OR accepts
post-push sequencing; (ii) after the single authorized `clasp run push --force` (source
upload only — no behavior change: 97D defaults PREPARED, no activation-on-load),
immediately run `clasp run salesV2OperatorResolvedRoute_` (or
`salesRecognitionV2OperatorConfig`) and require `{mode:"PREPARED"}` before ANY further
step; any other value or parse failure → STOP (no activation, no sale, no write).
No config writes performed or proposed before that readback.

## 7. Local corrections made (all purely local; production untouched)

1. `97.SalesRecognition.V2.Foundation.js` — `salesRecognitionAccountFieldMismatch_`:
   blank `NormalBalance` tolerated for 4000 only, with authority comment. Regression:
   `testSalesV2AccountPreflight` P08–P11 (legacy blank passes; wrong explicit DEBIT
   fails; blank 1030/2010 fail). All pre-existing per-field matrix scenarios unchanged.
2. `97A.SalesRecognition.V2.Save.js` — new
   `salesRecognitionV2SaveAuthoritySheetOk_` + schema-gate dispatch
   (`PREFIX_AUTHORITY` for Products, `NAME_AUTHORITY` for ProductPricing; other 13
   sheets unchanged strict). Regression: `testSalesRecognitionV2SaveGates` C23–C33 —
   (1) minimal exact passes; (2) production 10-col Products passes; (3) production
   11-col ProductPricing passes; (4) harmless extras pass; (5) missing required col
   fails; (6) duplicate required col fails; (7) renamed authority col fails;
   (8) reordered/renamed semantic authority fails; (9) historical name-based master
   reads byte-equal on additive fixtures; (10) full U2 Save over additive fixtures
   yields identical identities + identical frozen `OperationPlan` (deterministic
   snapshot). Mutation sensitivity: negative fixtures are the sensitivity proof for
   both changes; all five mutation-proof suites (U1–U8) remain green, including VM
   source-injection proofs over the edited files.
3. `96.Tests.Transaction.Production.Readiness.Cases.js` — P08–P11 + count guard
   (32 → 36). `96.Tests.SalesRecognition.V2.Save.Cases.js` — C23–C33 + total
   (40 → 51). No other suites touched; frozen U1–U8 architecture files otherwise
   unchanged.

## 8. Full re-preflight — COMPLETE remaining blocker set (resumed-U9)

Re-run of the complete READ-ONLY preflight after reconciliation (all MEASURED live):

- Missing companions: `SalesRecognitionEvents`, `SalesRecognitionAudits` (2 of 15) —
  creation authorization required (§4).
- Schema mismatches: **none remaining** under the corrected gate (Products/ProductPricing
  semantic authority validated; other 13 exact). No production migration needed.
- Account metadata: preflight replica = {1030 ABSENT, 2010 ABSENT} only (4000 mismatch
  eliminated by corrected gate). 1030 + 2010 creation still required (frozen rows).
- Unexpected account metadata: none (no duplicates; all active; blank pattern matches
  frozen convention; no unexpected V2-relevant codes).
- Unexpected V2 artifacts: none (0 V2 operation rows; 0 SRV2J/SALES_RECOGNITION markers
  in BalanceLedger/Orders/OrderLines/Settings/Payments/Settlements; TransactionOperations
  2 legacy rows; Orders 1 legacy row; BalanceLedger 6 legacy rows).
- Config uncertainty: runtime property absence unproven (§6) — post-push readback gate.
- Deployment dependency gaps: none in package closure (U9 prior evidence: 5 V2 files
  registered; 118 symbols resolve; re-verify `clasp status` = 67-file manifest at push
  time). Execution API scope still missing (permission remediation item).
- Upload-manifest / regression: local harness 91 PASS / 0 FAIL after final edit.

Remaining blocker set = {companion sheet creation (authorization), 1030/2010 creation
(authorization), config runtime readback (post-push sequencing + optional permission
remediation)}.

## 9. RESUMED-U9 PLAN (exact mutations; owner authorization per step)

Do NOT start without explicit owner authorization per numbered step. Order is mandatory;
each step ends with fresh readback; any mismatch → STOP, no retry, reconcile read-only.

1. **Accounts preparation (authorized append-only)**: append exactly two 9-column rows —
   `1030 | Sales Settlement Clearing | Asset | Current Assets | Operating | TRUE |
   <ts> | <ts> | DEBIT` and `2010 | Customer Refund and Credit Payable | Liability |
   Current Liabilities | Operating | TRUE | <ts> | <ts> | CREDIT`. Script lock; exact
   9-col header check; duplicate/blank-code refusal; exact-already-present zero-writes;
   conflict refusal without overwrite; flush + fresh readback of full Accounts matrix
   (22 rows incl. header, prior rows byte-identical). No 4000 edit.
2. **Companion creation (authorized header-only)**: create `SalesRecognitionEvents`
   (20-col header, 0 rows) and `SalesRecognitionAudits` (10-col header, 0 rows) per §4
   authorization text. Readback both.
3. **Read-only preflight re-run**: `preflightSalesRecognitionAccounts(liveRows)` → PASS;
   `salesRecognitionV2SaveSchemaGate_(live adapter)` → PASS; V2-artifact scans still
   zero; protected-surface baselines recorded (tabsal 10809 / tabops 1977 / Payments 1 /
   Settlements 2 / InventoryLedger 1 / BalanceLedger 6 / Logs grid 995 / Orders 1 /
   OrderLines 1 / TransactionOperations 2).
4. **Deployment (separately authorized; Rule 7 single push)**: upload-manifest gate —
   fresh `clasp status` must equal the 67-file closure before
   `clasp push --force` (one push only; a second push needs NEW authorization); then
   post-deploy version/deployment metadata readback.
5. **Config runtime readback (post-push, pre-activation)**: `clasp run
   salesV2OperatorResolvedRoute_` must return `{mode:"PREPARED"}` (or
   `salesRecognitionV2OperatorConfig()` PREPARED-shaped). Requires the owner to remediate
   Execution API permission for the chosen identity if still 403. Non-PREPARED → STOP.
6. **Activation (separate explicit authorization)**: write Script Property
   `SALES_RECOGNITION_V2_CONFIG` = validated config `{mode:"ACTIVE",
   contractVersion:"SALES_RECOGNITION_V2", activationID:"<new-id>",
   activatedAt:"<new ISO-8601 instant ≠ 2026-10-06T18:50:05.328Z in any offset>",
   configVersion:1}`; readback via step-5 call; pause/rollback = PAUSED via same
   property. Nothing before step 5 may set any property.
7. **First real V2 Sale + artifact readback**: one operator sale; verify Order/OrderLines/
   Event (COMMITTED)/2 BalanceLedger lines (Dr1030/Cr4000)/1 Audit row; U3/U4/U5 parity
   checks; operator acceptance; pause/rollback decision record.
8. Explicit owner-authorization checklist: (a) step 1 Accounts append; (b) step 2
   companion creation incl. Audits; (c) step 4 single `clasp push --force`; (d) Execution
   API permission remediation (or acceptance of post-push readback sequencing); (e) step 6
   activation write; (f) step 7 first production V2 sale.

Explicitly still forbidden/unchanged: no 4000 cell edit, no Products/ProductPricing sheet
edits, no config writes before step 6, no second push, no historical backfill, no
Treasury/1030/2010 postings, no T reuse, no production writes of any kind in this task
(this task performed zero).

## 10. Validation (MEASURED)

- Baseline before edits: `node _test_runner.js` → 91 PASS, 0 FAIL.
- After final edit: `node _test_runner.js` → **91 PASS, 0 FAIL** (includes
  `testSalesV2AccountPreflight` 36 assertions, `testSalesRecognitionV2SaveGates` 51
  assertions, U1–U8 suites, all U1–U8 mutation proofs incl. VM source-injection
  sensitivity over the edited 97/97A, U8 release audit, controller/browser harness).
- `node --check` on all four changed files → OK. `git diff --check` → clean.
- Live production reads: MEASURED via Sheets REST (read-only); Execution API:
  BLOCKED_PERMISSION (re-measured). Production writes this task: **0**.

## 11. Telemetry

agent numlock-heavy (executed in-session), backend/model
`9router/numlock-explore-free`, reasoning high, fallback not used, delegation none,
toolcalls UNKNOWN (not instrumented), elapsed UNKNOWN (not instrumented), files
read/modified: `97.SalesRecognition.V2.Foundation.js`,
`97A.SalesRecognition.V2.Save.js`, `96.Tests.Transaction.Production.Readiness.Cases.js`,
`96.Tests.SalesRecognition.V2.Save.Cases.js`, this document (+ read-only probe scripts
under `tests/tmp/`, deleted); test runs: 2 × `node _test_runner.js` (baseline + final)
= 91 PASS / 0 FAIL each. No secrets, no scriptId, no tokens recorded.
