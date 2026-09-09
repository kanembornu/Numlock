# NUMLOCK Testing

## Finance Phase 10F.5 Cash cutover evidence contract — complete and frozen

Phase 10F.5 freezes the evidence package for the three physical Cash authorities. The cutover is the verified
end-of-day Cash position on **2026-09-30** in **Asia/Jakarta**, equivalent to the opening financial position for
2026-10-01. Operational Cash movements in `BalanceLedger` begin strictly on 2026-10-01: a movement dated
2026-09-30 is outside the post-cutover ledger, and a movement already reflected in the observed balance must not be
recreated. Pending or same-day items must be documented without a guessed timing adjustment or double counting.
Cash openings later use `EffectiveDate = 2026-09-30`; the independent retained-earnings opening for Account 3200
remains unchanged at `EffectiveDate = 2026-07-31`.

The account-specific primary-evidence requirements are:

- **1000 Cash on Hand:** a 2026-09-30 physical count, observation timestamp, denomination-level or equivalently
  auditable count sheet, observed total, preparer/count performer, reviewer, evidence reference, discrepancy note
  when applicable, and confirmation that the Cash belongs to NUMLOCK. Estimates are prohibited. A verified zero
  requires a physical count that explicitly produces Rp0.
- **1010 DANA Business:** the observable cutover balance with date/time, screenshot/export/report or equivalent
  primary evidence, identified available balance, separately reviewed pending/held/in-process items, confirmed
  NUMLOCK ownership, evidence identifier, and reviewer. The opening is the independently verified NUMLOCK DANA
  balance; inference is prohibited.
- **1020 Cash in Owner Custody - BluBCA:** a NUMLOCK-specific identifiable amount observed at cutover, supported by
  a dedicated NUMLOCK folder/sub-balance or equivalent evidence, with personal owner funds excluded, date/time,
  evidence identifier, same-day NUMLOCK-movement reconciliation, and reviewer. The owner's entire personal BluBCA
  balance must never be treated as business Cash.

The canonical evidence worksheet contains exactly these capture fields:
`AccountCode`, `AccountName`, `CutoverDate`, `ObservedAt`, `ObservedBalance`, `EvidenceType`, `EvidenceRef`,
`PreparedBy`, `ReviewedBy`, `VerificationStatus`, `PendingAdjustment`, `VerifiedOpeningBalance`, and `Notes`.
`VerificationStatus` is one of `VERIFIED`, `FAILED`, or `MISSING`. Future monetary values must not be populated
before the cutover evidence exists.

For each canonical Cash account, a positive opening requires `Debit > 0`, `Credit = 0`, a non-empty `ExternalRef`,
and a non-empty `Keterangan`. An explicit verified zero requires `Debit = 0`, `Credit = 0`, a non-empty
`ExternalRef`, and a `Keterangan` containing the accepted case-insensitive phrase `observed balance = 0`. Missing
evidence leaves the opening unavailable and is never converted to zero. Contradictory or contract-invalid evidence
is `INVALID` and blocks authority/readiness. The frozen opening-row contract requires one active
`FinanceOpeningBalances` row per `EffectiveDate + AccountCode`, an explicit AccountCode, a Source identifying the
verified Cash cutover, an `ExternalRef` to accepted evidence, and a `Keterangan` describing the observed opening.
One row per physical Cash authority is required; an aggregate Cash opening is prohibited.

Reconciliation is account-level and independent: 1000 equals the verified physical count, 1010 equals the verified
DANA Business balance, and 1020 equals the verified NUMLOCK BluBCA custody balance. A cross-account balancing plug
or movement of unexplained differences between Cash accounts is prohibited. Any unresolved discrepancy blocks
activation.

Cash posting and reporting remain fail-closed until all of these gates pass together: `CASH_TAXONOMY_READY`, valid
Settlements storage, valid BalanceLedger storage, accepted evidence, accepted Cash opening rows, fresh-read opening
validation, account-level reconciliation, and cutover-boundary validation. Partial activation is prohibited.

The future cutover runbook is fixed in this order:

1. Establish the end-of-day observation window.
2. Perform the 1000 physical count.
3. Capture 1010 DANA evidence.
4. Capture 1020 NUMLOCK BluBCA evidence.
5. Identify pending and same-day movements.
6. Review all evidence.
7. Classify each account `VERIFIED`, `FAILED`, or `MISSING`.
8. Determine the exact verified opening amounts.
9. Run the read-only opening preflight.
10. Obtain explicit production-write authorization.
11. Insert the accepted openings exactly once.
12. Fresh-read `FinanceOpeningBalances`.
13. Reconcile each account.
14. Validate the cutover boundary.
15. Only after every gate passes, authorize post-cutover Cash posting and reporting.

Any `FAILED` or `MISSING` required evidence stops the runbook; no opening may be guessed. As of the Phase 10F.5
freeze on 2026-09-03, the actual cutover evidence is not yet available, balances for 1000/1010/1020 are `UNKNOWN`,
opening insertion is prohibited, Cash posting is disabled, and Cash reporting is unavailable. Phase 10F.6 remains
`WAITING_FOR_2026-09-30_EVIDENCE`.

Phase 10F.5.2 supplied the live code evidence: `testCashFoundationContracts()` passed once in Apps Script runtime
with 121 scenarios and no production mutation, followed by one `runAllBackendTests()` pass at 57/57. That runtime
acceptance validated code only; it did not supply accounting evidence, authorize production writes, or activate Cash.

## Finance Phase 10F.5.1 Cash opening evidence validation

The existing 57-entry ordered suite retains `testCashFoundationContracts()` as its Cash owner. The focused test now
validates 121 scenarios covering the 2026-09-30 Cash cutover boundary, evidence-backed positive and explicit verified
zero openings, fail-closed Cash opening classification and read availability,
Accounts/Settlements/BalanceLedger/FinanceOpeningBalances classification, the exact three-write current-production
plan, header-only storage creation, populated-ledger preservation, fresh-read acceptance, idempotency, exact snapshots,
controlled recovery, hard rollback failure, and the parameterless disposable runtime harness's identity, fixture,
orchestration, production-fingerprint, and cleanup contracts. The test invokes only injected local runtimes; it does
not execute `runCashFoundationSchemaMigration()`, `runCashFoundationSchemaRecovery()`, or
`runCashFoundationDisposableRuntimeProof()`.

Run `testCashFoundationContracts()`, `testBalanceFoundationContracts()`,
`testCapitalEquityMigrationContract()`, `testFinanceCoreBackendContract()`,
`testFinanceProfitAndLossUiContract()`, `testCanonicalTransactionEntryService()`,
`testCanonicalTransactionLifecycleService()`, and `testUiUx2ClosureContract()` first, then
`runAllBackendTests()`; require 57/57.

## Finance Phase 10D Cash foundation contracts

Finance Phase 10D raises the ordered suite to 57 entries. The focused
`testCashFoundationContracts()` validates the read-only Accounts candidates for 1000/1010/1020, the canonical
Settlements contract, paid-at-recognition Sales and Expense journals, all supported Cash transfer routes,
`SourceType + SourceID` idempotency, append-only full reversals, verified-opening Cash balances, and account-level
reconciliation states. Candidate builders are pure and report `writeCount: 0`; they create no sheet, mutate no
production row, and refuse delayed or partial accrual settlement semantics.

Run `testCashFoundationContracts()`, `testBalanceFoundationContracts()`,
`testCapitalEquityMigrationContract()`, `testFinanceCoreBackendContract()`,
`testFinanceProfitAndLossUiContract()`, `testCanonicalTransactionEntryService()`, and
`testCanonicalTransactionLifecycleService()` first, then `runAllBackendTests()`; require 57/57.

## Finance Phase 9F.6 migration failure reproduction

`testBalanceFoundationContracts()` uses exact 8-column/11-column physical-grid fixtures whose fresh reads clone
Apps Script `Date` values and whose ranges refuse to exceed `getMaxColumns()`. The migration must explicitly expand
Accounts to 9 columns and FinanceOpeningBalances to 13 columns before writing. Physical acceptance compares audit
dates by timestamp rather than object identity. Forced failures after Accounts expansion, after Accounts write,
during opening-schema expansion, after opening write, and during acceptance must restore both logical values and
physical dimensions while preserving the original error and reporting any rollback error separately. This is
deterministic local evidence only; a disposable real Apps Script runtime test remains a separate evidence class.

## Finance Phase 11C Inventory foundation contracts

`testInventoryFoundationContracts()` is the focused, candidate-only Inventory gate. It validates stable
`COGSIngredients.ID_Ingredient` identity, raw-material and recipe-packaging classification, canonical base UOMs,
explicit effective-dated conversions, the post-cutover InventoryLedger schema and movement rules, linked inverse
corrections, dormant transfers, timestamp-plus-ID ordering, integer-Rupiah moving weighted average with half-up
outbound rounding and exact depletion, negative-stock refusal, 2026-09-30 EOD opening evidence, Account 1100
candidate taxonomy, and exact subledger-to-control reconciliation. Recipe auto-consumption remains disabled and
`tabsal.HPP` remains P&L COGS authority. The focused contract is nested under
`testBalanceFoundationContracts()` and the existing Capital Equity runner entry, while the Inventory migration and conversion-authority entries make the ordered suite 59
entries. No test creates a sheet, migrates Accounts, posts a journal, or writes production data.

Run `testInventoryFoundationContracts()`, `testBalanceFoundationContracts()`,
`testCapitalEquityMigrationContract()`, `testFinanceCoreBackendContract()`,
`testFinanceProfitAndLossUiContract()`, and `testDepreciationEngineContract()` first, then
`runAllBackendTests()`; require 59/59.

## Finance Phase 11F Inventory migration contracts

`testInventorySchemaMigrationContract()` is the focused local/mock migration and recovery gate. It requires the
audited 22-item and 410-active-recipe source shape, exact classification and canonical-UOM distributions, an
unused Account 1100, and all three target sheets to be absent. It validates four logical writes, header-only
conversion and ledger storage, fresh-read acceptance, exact second-run idempotency, zero-write refusal states,
and recovery only while the complete post-image remains unchanged. It creates no production data and does not
authorize Inventory posting. Run it with the Balance and Cash focused contracts, then run
`runAllBackendTests()`; require 59/59.

## Finance Phase 11K conversion authority contracts

`testInventoryConversionAuthorityContracts()` validates the exact 24-column conversion evidence schema,
independent approval, effective-date and package-version conflicts, readiness precedence, fail-closed coverage for
every Inventory movement type, and the dedicated one-write legacy-header migration, fresh-read acceptance,
idempotency, preservation, refusal, and guarded recovery contracts. These are local/mock checks only and do not
populate conversions or movements, execute Apps Script runtime, or authorize production migration.

## Finance Phase 11N.6 single-operator conversion governance

The unchanged 24-column `InventoryUOMConversions` schema represents the governance path through the explicit
`SINGLE_OPERATOR_APPROVED` approval status. It is never treated as independent review: `ReviewedBy` and
`ReviewedAt` must be blank, the immutable manifest reference must contain its version and SHA256, and the structured
ApprovalNote must disclose `NO_INDEPENDENT_REVIEW` and `SELF_APPROVAL_DISCLOSED`. Its method must record a signed
first-person statement, deterministic arithmetic, and the validator-derived `RISK_LOW` or `RISK_MODERATE` tier.
Eligible active rows classify `SINGLE_OPERATOR_VERIFIED`; the existing distinct-reviewer `APPROVED` path continues
to classify `VERIFIED`. The posting gate accepts either explicit readiness and refuses every other state.

Fixed bags, cartons, bottles, packs, and boxes are low risk. A standardized gallon and ING-021 fixed standardized
ice package are moderate risk. Loose, subjective, estimated, naturally variable, unknown-unit, and ING-018 Lemon
operator attestations are high risk and cannot use this path. A single-operator controlled-yield record requires an
immutable manifest for at least five actual observations, recorded variation, deterministic arithmetic, and a
predeclared median standard-conversion rule. This test-only contract does not supply observations or authorize a
Lemon conversion. Phase 11U supersedes the controlled-yield path for ING-018 with the management standard below.

`testInventoryOperatorAttestationContracts()` covers independent-review preservation, single-operator identity and
chronology, immutable-reference enforcement, control-token enforcement, deterministic risk classification,
self-review disclosure, overlap conflicts, controlled-yield requirements, distinct readiness, and posting-gate
behavior. It remains nested in `testInventoryConversionAuthorityContracts()` and does not change the 59-entry
ordered runner. `runInventoryConversionDisposableRuntimeProof()` additionally exercises both governance paths,
LOW and MODERATE single-operator acceptance, malformed and HIGH-risk refusal, Lemon refusal, authority conflicts,
posting-gate outcomes, production fingerprint preservation, and verified disposable cleanup in Apps Script.

## Finance Phase 11N.10 inactive conversion candidate population

`runInventoryConversionCandidatePopulation()` is the only production entry point for the frozen 21-row Phase 11N.9
candidate set. It rereads and hashes each immutable Drive manifest, validates the exact 24-column candidates against
the 22 authoritative InventoryItems, requires header-only conversion and ledger storage plus unchanged Account 1100,
and writes one deterministic 21-by-24 range under ScriptLock. Every populated row remains
`SINGLE_OPERATOR_APPROVED` and inactive, so readiness remains `NEEDS_EVIDENCE` and the posting gate remains closed.
Its exact post-image is idempotent as `ALREADY_POPULATED`; recovery accepts only the unchanged owned post-image.
`runInventoryConversionCandidateDisposableRuntimeProof()` proves the write, idempotency, refusal, recovery,
production-fingerprint, posting-gate, and cleanup contracts before the separately authorized one-time production run.

## Finance Phase 11N.11 prospective conversion activation

`runInventoryConversionActivation()` is the separately gated production activation entry point for the exact frozen
21-row candidate post-image. Under ScriptLock it requires a fresh semantic match to every Phase 11N.9 identity,
evidence reference, ratio, UOM, package, approval, and inactive state, then writes only the single `IsActive` column
from false to true in one logical write. The operation is idempotent only for the exact valid active post-image.
Effective authority remains prospective from 2026-10-01: posting before that date refuses, while posting on or after
that date accepts only rows that still validate as `SINGLE_OPERATOR_VERIFIED`.

`runInventoryConversionActivationDisposableRuntimeProof()` proves activation, idempotency, exact semantic post-image,
all required drift and evidence refusals, the prospective posting boundary, guarded recovery, refusal to recover after
a dependent InventoryLedger movement, production-fingerprint preservation, and verified disposable cleanup. It does
not call the production activation wrapper. Production activation remains prohibited until separately authorized.

## Finance Phase 11Q Inventory opening staging foundation

`testInventoryOpeningStagingContracts()` validates the exact 27-column append-only `InventoryOpenings` staging
schema, the frozen 21-item `MAIN` scope excluding ING-018, physical-count and explicit verified-zero evidence,
six-decimal quantity and ten-decimal unit-cost limits, integer-Rupiah half-up valuation, economic-origin and
source-classification readiness, all-or-nothing batch completeness, and a permanently refused Phase 11Q posting
plan. `UNRESOLVED` is accepted for evidence intake but remains `NEEDS_SOURCE_EVIDENCE`; even
`READY_FOR_ACCOUNTING_REVIEW` is not accounting authorization. Balancing authority remains `NONE`.
Corrections require a new `OpeningID`, explicit `SupersedesOpeningID`, unchanged batch/item/location/cutover/UOM
scope, and an explicit two-write correction plan; silent historical mutation is prohibited.

The guarded migration contract creates only the exact header under `ScriptLock`, fresh-rereads acceptance, refuses
collisions, drift, formulas, notes, and business rows, is idempotent for the exact header-only post-image, and permits
recovery only while that owned post-image is unchanged. Local tests do not call the production migration or recovery
wrappers, create `InventoryLedger` or `BalanceLedger` rows, modify Account 1100/3200/3210, post accounting, upload,
or deploy. Run `testInventoryOpeningStagingContracts()` first, then `runAllBackendTests()`; require 60/60.
`runInventoryOpeningStagingDisposableRuntimeProof()` is the isolated Apps Script runtime entry point: it validates
the focused contract, proves READY/MIGRATED/idempotent/refusal/recovery behavior only in owned temporary Sheets,
verifies the canonical production fingerprint is unchanged, and trashes every owned temporary Sheet.
The fresh-read migration classifier also requires Account 3210 to be completely absent: either an active or inactive
3210 row returns `REFUSED_ACCOUNT_3210_PRESENT` with `writeCount: 0`. Account 3210 remains a proposal only and is
never created, activated, or treated as balancing authority.

## Finance Phase 11S inventory opening evidence review and population readiness

`testInventoryOpeningStagingContracts()` also owns the Phase 11S local contract. It transforms the exact
`INV-OPEN-20261001-V01` 21-item `MAIN` intake into deterministic 27-column candidates, classifies incomplete,
count-verified, valuation-verified, unresolved-source, conflicting-source, and accounting-review-ready states, and
keeps every state non-posting. The population planner requires an exact empty 27-column production preimage, all 21
currently applicable active conversions, header-only InventoryLedger and BalanceLedger, unchanged Account 1100,
no Account 3210, and a separately trusted frozen filename/version/SHA-256 identity. It plans one logical 21-row
write, accepts only the exact semantic post-image, is idempotent only for that exact image, and refuses partial,
mixed, drifted, or duplicate rows. Recovery clears only the exact owned candidate batch and refuses after any
InventoryLedger or BalanceLedger dependency exists.

The checked-in Phase 11R workbook remains the blank operator intake template, not a completed reviewed artifact.
Accordingly, the production wrapper is deliberately fail-closed as `FROZEN_REVIEWED_ARTIFACT_NOT_CONFIGURED`.
Local fixtures prove the pipeline without supplying business evidence or authorizing a production write. No
InventoryOpenings population, InventoryLedger or BalanceLedger row, Account 1100 recognition, Account 3210 creation,
upload, runtime execution, deployment, or Git operation is part of this phase.

`runInventoryOpeningReviewDisposableRuntimeProof()` is the Phase 11S runtime-only acceptance entry point. It uses
synthetic reviewed evidence and owned disposable spreadsheets to prove review states, artifact refusal, population,
idempotency, partial/duplicate refusal, recovery, downstream-dependency refusal, production fingerprint preservation,
and verified cleanup. It never reads the Phase 11R template as evidence, never configures a reviewed production hash,
and verifies that the real production population wrapper remains disabled.

## Finance Phase 9E schema migration readiness

The existing Capital Equity runner entry also exercises the guarded Phase 9E schema executor. The deterministic
contract accepts only the exact eight-column production Accounts schema, preserves its `StatementGroup` and audit
columns while appending only `NormalBalance`, converts the single Account 3200 opening row from legacy `Amount` to
V2 `Debit`/`Credit`, preserves identity, description, and audit values, and proves the retained-earnings result remains
Rp7,407,000. It covers Accounts and opening-schema write
failures, post-write physical-acceptance failure, exact rollback, exact V2 `ALREADY_MIGRATED` with zero writes, and
mixed-state refusal. Production execution of `runBalanceFoundationSchemaMigration()` requires separate explicit
authorization; local tests must not invoke that runtime wrapper.

## Finance Phase 9C balance foundation contracts

Finance Phase 9C kept the ordered suite at 56 entries. The focused
`testBalanceFoundationContracts()` is invoked by the existing Capital Equity runner entry and validates the Accounts
taxonomy overlay, compatible FinanceOpeningBalances V2 candidates, lossless Account 3200 conversion, read-only
BalanceLedger journal candidates, and read-only InventoryLedger moving-weighted-average candidates. It creates no
sheet, writes no row, does not post journals, and preserves `tabsal.HPP` as the production COGS authority.

At that phase, run `testBalanceFoundationContracts()`, `testCapitalEquityMigrationContract()`,
`testFinanceCoreBackendContract()`, `testFinanceProfitAndLossUiContract()`, and `testDepreciationEngineContract()`
first, then `runAllBackendTests()`; the Phase 9C recorded requirement was 56/56.

## Finance Phase 8D capital and equity migration dry-run gate

Finance Phase 8D raises the ordered suite to 56 entries. The focused CapitalEquity contract validates canonical owners and movement types, account mapping, active/date/source validation, period summaries, deterministic migration identities, exact 10-row capital migration reconciliation, the dedicated retained-earnings opening authority, and the read-only zero-write diagnostic. Existing Finance, depreciation, Dashboard, Transactions, frontend, quality, and intelligence contracts remain unchanged.

Run `testCapitalEquityMigrationContract()`, `testFinanceCoreBackendContract()`, `testFinanceProfitAndLossUiContract()`, and `testDepreciationEngineContract()` first, then `runAllBackendTests()`; require 56/56. `validateCapitalEquityMigrationDryRun()` is the separate read-only production diagnostic and must find CapitalEquity empty; it creates no sheet or row. Production Finance depreciation totals remain owned by `validateFinanceDepreciationProductionRuntime()`.

Local/static PASS does not establish Apps Script live, upload, deployment, browser, screenshot, production-health, or rollback PASS. Visual acceptance requires real deployed-browser captures for Dashboard Overview, Dashboard Performance, Transactions, Settings, and Logs across all 16 required viewport/theme/sidebar-or-drawer states: 80 captures total, each scored exactly 18/18.

This document owns validation contracts, runner semantics, and evidence levels. [Project Status](PROJECT_STATUS.md) summarizes the latest recorded gate without replacing this contract; release sequencing belongs in [RELEASE.md](RELEASE.md).

## Evidence levels

Report each level separately:

1. **Static/local:** syntax checks, source contracts, deterministic Codex mocks, migration comparisons, diffs, and Git status.
2. **Upload:** `clasp status` plus a successful `clasp push`; upload is not runtime execution.
3. **Apps Script runtime:** a named function actually completes in the configured NUMLOCK script project.
4. **Deployment:** an Apps Script version/deployment is created or updated.
5. **Browser:** the deployed dashboard is exercised and the browser console is checked.

Never infer a later evidence level from an earlier one.

## Local Codex mocks

Local validation may load the numbered server files into a Node `vm` context with bounded mocks for `SpreadsheetApp`, `Utilities`, `Session`, and `Logger`. Fixtures should cover normal data, empty data, ties, current-month filtering, purchase-only months, zero/negative expenses, product truncation, and case-sensitive Hot/Cold categories.

Mocks validate JavaScript execution and deterministic contracts; they do not prove Google authorization, live spreadsheet shape, Apps Script service behavior, or deployed-browser behavior. Run `node --check` on extracted JavaScript source, not on HTML without first extracting its scripts.

## Safe direct Apps Script runs

These functions are read-only with respect to spreadsheet data and are safe to run deliberately in the Apps Script editor:

- `runAllBackendTests()` — primary live backend validation entry point; runs the complete suite once in the documented order and stops on the first failure.
- `testSparseDatasetResilience()` — seven deterministic end-to-end dashboard-response fixtures covering empty, sales-only, purchase-only, one-row, sparse mixed, and populated data.
- `testDashboardDateFilter()` — 58 deterministic assertions covering normalization, preset/custom ranges, inclusivity, invalid inputs/dates, immutability, response equivalence, Revenue Trend scope/order, finite values, and empty results.
- `testPeriodComparison()` — 23 deterministic scenarios covering all six previous-equivalent ranges, shorter months, leap years, equal inclusive duration, empty and zero baselines, signed profit/loss transitions, finite rounding, immutability, one-read/one-process architecture, and accessible frontend statuses.
- `testBusinessPriorityContract()` — 20 deterministic scenarios covering every precedence branch, empty fallback, score/source tie-breaking, finite bounds, complete evidence, deterministic repeats, non-mutation, one authoritative response, exact Overview-owned render target/renderer semantics, exclusion from Intelligence/Planning ownership, and preserved responsive/accessibility contracts.
- `testDashboardStateContract()` — five deterministic contract scenarios covering the state vocabulary plus empty, purchase-only, sales-only, and populated scoped-row semantics.
- `testAccessibilityContract()` — 22 deterministic/static scenarios covering document/landmark, form/validation, navigation, table, live-region, focus, keyboard, hidden-content, and reduced-motion contracts.
- `testExecutivePresentationContract()` — seven deterministic/static scenarios covering section order, first-position Executive Summary, heading and badge consistency, recommendation priority order, non-duplicated executive messages, responsive hierarchy, and preserved accessibility.
- `testDashboardOverviewStabilizationContract()` — focused static scenarios covering information-only KPI cards, deterministic trigger-owned reporting-period width, stable sortable Top Products, active-period source navigation, one-click combined Sales + Expense CSV export, Copy Summary canonical sources/order, retired chooser/Print/Data Summary actions, and preserved CSV security.
- `testCsvExportContract()` — 14 static/behavioral scenarios covering the accessible Export CSV action, filename, header, visible row/column scope, displayed ordering, empty-state disabling, UTF-8 output, quote escaping, formula-prefix neutralization, numeric-value preservation, hidden-field exclusion, browser Blob download, and preserved accessibility/responsive contracts.
- `testClientRenderPerformanceContract()` — seven static contract scenarios covering stable DOM caching, reduced repeated queries, immediate first-visible rendering, one deferred phase, stale-work cancellation/guarding, response immutability, preserved output containers, and retained accessibility/state contracts.
- `testResponsiveShellContract()` — 12 source-contract scenarios covering the `lg` desktop boundary, drawer controls and accessibility, close paths, scroll lock, focus restoration, active navigation, table containment, and single controller initialization.
- `testUiShellThemeContract()` — 17 static scenarios covering 232px/64px standard and 216px/64px compact desktop sidebar states, the 64px utility bar, nine truthful destination representations, restrained SaaS-decoration exclusions, Light/Dark/System selection, validated browser-local persistence, System fallback, pre-render theme application, exact dark tokens, print-light and Chart.js synchronization, mobile drawer/focus preservation, active-destination compatibility, single listener initialization, and the 73-ID/two-selector query ceiling.
- `testNineDestinationNavigationContract()` — 10 static scenario groups covering exactly nine represented destinations, four active pages, five non-activatable migration-gated items, exact labels and Financial modules disclosure ownership, absence of future pages/content/routes, expanded/collapsed/mobile parity, focus and hidden-content safety, theme parity, zero navigation backend requests, listener preservation, response immutability, and the query budget.
- `testFullShellVisualContract()` — 12 static scenario groups covering one authoritative utility row, single visible page identity, 52/48px utility and 40px tab geometry, desktop viewport binding, mobile drawer/flow preservation, nine-destination integrity, tab placement, bounded shell surfaces, forbidden SaaS-feature exclusion, Light/Dark/print parity, hidden-focus safety, zero shell-navigation requests, listener uniqueness, response immutability, one deferred phase, and the query budget.
- `testDashboardHighFidelityCompositionContract()` — 15 static scenario groups covering five exact Dashboard tabs, compact Overview hierarchy and five KPIs, the 4/8 Revenue Trend hero composition, two primary/two secondary Analytics regions, 4/5/3 Intelligence, action-oriented Planning, roadmap/Target Reference preservation, reduced surface nesting and decoration, desktop/mobile containment, theme/print parity, chart lifecycle, zero tab requests, response immutability, one deferred phase, and the 73-ID/two-selector ceiling.
- `testSecondaryDestinationsHighFidelityContract()` — 15 static scenario groups covering Transactions/Settings/Logs ownership; four bounded transaction views; one compact lifecycle-aware, maximum-ten-row, table-dominant workspace; visible-row CSV and drill-down semantics; compact 7/5 Appearance/About composition and metadata provenance; session-local Logs hierarchy and sanitization; unsupported-feature exclusions; reduced surface nesting; desktop/mobile, theme, print, and accessibility parity; zero navigation requests; response immutability; one deferred phase; and the 73-ID/two-selector ceiling.
- `testThemeParityTokenContract()` — 15 static scenario groups covering 45 paired Light/Dark semantic tokens, authoritative print-light tokens, no pure-black surfaces, stored/effective theme ownership, System listener attach/removal lifecycle, invalid-value fallback and pre-render resolution, computed Chart.js palette centralization, in-place chart updates, finite accessible chart containment, print-light isolation/restoration, destination/state screenshot hooks, focus and text-visible statuses, hardcoded production-color exclusion, zero theme requests/recreation/mutation, one deferred phase, and the 73-ID/two-selector ceiling.
- `testChartRuntimeThemeSynchronizationContract()` — 13 deterministic scenarios covering initial and repeated Light/Dark updates through authoritative Chart.js config, unchanged chart identity, grid/axis/tooltip/peak tokens, hover suppression, plugin uniqueness, and the shared System effective-theme path.
- `testBoundedUiRefactorContract()` — 15 static scenario groups covering zero-reference removal evidence, one shared Transactions presentation owner, unique regional renderers, comment-free structural boundaries, semantic metadata provenance, sole `PROJECT_CONFIG` template assignments, unique theme/chart/listener owners, listener guards, hidden-focus exclusion, request-free tab/navigation paths, response immutability, chart lifecycle, unchanged shell/table geometry, eleven destinations, Light/Dark/System/print preservation, one deferred phase, and the 71-ID/two-selector ceiling.
- `testDashboardTabFrameworkContract()` — 14 static scenarios covering the exact Overview/Performance/Analytics/Intelligence/Planning set, default Overview, 14 uniquely owned existing sections, tab/panel ARIA relationships, Left/Right/Home/End behavior, hidden-panel focus exclusion, selected-tab preservation, zero tab-switch backend requests, guarded listeners, cross-tab print visibility, chart resize/lifecycle preservation, responsive one-viewport rules, Dashboard state compatibility, and the 73-ID/two-selector query ceiling.
- `testTransactionsVisualContract()` — 11 deterministic/static scenarios covering four exact tabs, default Recent, ARIA/keyboard/hidden-panel behavior, immutable displayed-order filtering, maximum-ten-row scope, exact Sales/Purchase evidence, truthful Purchases limitation, one compact table with a lifecycle-action column, drill-down focus/reset, active rendered-row CSV, theme/responsive states, zero tab-switch requests, one deferred phase, and the 73-ID/two-selector ceiling.
- `testTransactionEntryUiContract()` — 21 deterministic/static scenario groups covering the responsive dialog/full-screen sheet, Sales/Expense mode switching, searchable identity-preserving selectors, segmented type and integer quantity controls, stale-safe pricing preview, normalized IDR amount, cached options/retry, minimal payloads, authoritative save-success ownership, post-save refresh isolation, duplicate-submit protection, structured error mapping, success/reset/history refresh, accessibility/focus, safe areas/touch sizing, and frontend/legacy isolation.
- `testTransactionLifecycleUiContract()` — 18 deterministic/static scenario groups covering immutable row actions, lifecycle availability, desktop/mobile menus, canonical Sales/Expense/voided detail, Show voided isolation, correction edit/reason/preview/confirmation/success, void impact/reason/confirmation/success, structured errors, concurrency refresh, source labels, accessibility, and responsive surfaces.
- `testCanonicalLifecycleTransportSerialization()` — 11 deterministic scenarios covering Date-bearing Sales, Expense, voided, correction-relation, preview, void-success, and correct-success payloads plus all four public lifecycle serialization boundaries; performs no spreadsheet writes.
- `testCanonicalHistoricalAndOverlapControls()` — deterministic `XLSM`, `LEGACY_GOOGLE`, and `APP_ENTRY` provenance controls covering exact-once canonical inclusion, historical preservation, inactive-row exclusion, canonical `tabsal`/`tabops` ownership, and absence of the retired Transaction/Helper ingestion path. Live workbook totals remain production-data evidence rather than a unified-suite fixture.
- `testSettingsVisualContract()` — 12 deterministic/static scenarios covering exactly one Settings destination, Appearance/About ownership, three labelled native radios, stored-preference/effective-theme separation, System media-query following, immediate chart synchronization, state preservation, print-light behavior, direct `PROJECT_CONFIG` About mappings, sensitive/unsupported-content exclusion, theme/responsive containment, zero Settings requests, one deferred phase, and the 73-ID/two-selector ceiling.
- `testLogsVisualContract()` — 12 deterministic/static scenarios covering exactly one session-local Logs destination, exact four-field entries, three severities, nine bounded contexts, pure redaction of URLs/emails/identifiers/paths/objects/long text, memory-only 100-entry oldest eviction, newest-first order, duplicate suppression, severity counts/filters, empty/clear behavior, accessible error/clear announcements, preserved console diagnostics, zero Logs requests, responsive/theme containment, one deferred phase, response immutability, and the 73-ID/two-selector ceiling.
- `testUiFinalStabilizationContract()` — 12 static scenario groups covering approved semantic tokens and disabled states, four unique destinations, two scoped tablists, duplicate-ID exclusion, hidden-content focus exclusion, dark/print parity, bounded and reduced motion, responsive/table containment, Chart.js lifecycle, truthful Settings/Logs scope, forbidden-decoration exclusion, proven dead-code removal, listener guards, response immutability, one deferred phase, and the 73-ID/two-selector ceiling.
- `testChartPresentationContract()` — 16 deterministic/static scenarios covering chart source values, formatting, empty transitions, safe percentages, accessible summaries, instance lifecycle, and responsive containment.
- `testInteractiveDrilldownContract()` — four deterministic/static scenarios covering accessible KPI/chart controls, Sales/Purchase/month/expense-category filtering, ordering and response immutability, maximum-ten-row scope, focus/clear behavior, and absence of backend/API, spreadsheet, storage, or expanded-history access. It is targeted directly for debugging and invoked by `testChartPresentationContract()` so the ordered runner remains 25 entries.
- `testFrontendDependencyContract()` — 14 deterministic/static scenarios covering exact versions, unique HTTPS URLs, no floating dependencies, retained Font Awesome usage, Chart.js availability/fallback, summaries, diagnostics, and preserved chart/responsive contracts.
- `testReportingMetadata()` — deterministic scoped-row counts, earliest/latest dates, invalid-date handling, Current/Stale/No Data freshness, partial/complete period boundaries, project timezone, response presence, finite values, and frontend disclosure checks.
- `testDataQualityDiagnostics()` — 15 deterministic scenarios covering all six issues, Good/Attention/Critical status, multiple issues per row, mixed validity, scoped response output, source immutability, raw numeric provenance, and the accessible frontend disclosure contract.
- `getDashboardData()`
- `testSummaryFixtures()` — deterministic Summary regression fixtures with literal expected outputs.
- `testRevenueTrendFixtures()` — deterministic Revenue Trend fixtures with literal completed-month labels and values.
- `testExpenseBreakdownFixtures()` — deterministic ordered Expense Breakdown fixtures with literal amounts and top expense.
- `testTopProductsFixtures()` — deterministic Top Products fixtures with literal ranking, stable ties, and top-ten truncation.
- `testProfitTrendFixtures()` — deterministic Profit Trend fixtures with literal sorted month labels and monthly profit values.
- `testHotColdFixtures()` — deterministic Hot/Cold Split fixtures with literal case-sensitive Sales totals.
- `testAggregate()`
- `doGet()` (web output construction only; normally validate through the web app)

Deterministic tests must throw on mismatches. A returned `passed: true` or successful completion is runtime evidence only when it comes from the intended NUMLOCK Apps Script project.

`testSummaryFixtures()` is the authoritative Summary regression test. It covers mixed sales, purchases, multiple active days, repeated products, distinct quantity and revenue leaders, zero values, and an empty dataset. Its expected Summary fields are hardcoded independently. The former Summary oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testAggregate()` remains a live-data diagnostic. Its validator checks Aggregate Engine internal invariants for active-day count, total profit, best seller, and top-revenue product without depending on legacy Summary logic.

`testRevenueTrendFixtures()` is the authoritative Revenue Trend regression test. It covers unsorted and repeated rows across represented months, purchase-only and zero-revenue rows, cross-year sorting, an empty dataset, and current-period revenue that must be included. Expected labels and values are literal and independent. The former Revenue Trend oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testExpenseBreakdownFixtures()` is the authoritative Expense Breakdown regression test. It asserts exact category insertion order, repeated-category totals, zero and negative amounts, ignored missing-category and sales rows, top expense, and empty output. Expected arrays and top-expense values are literal and independent. The former Expense Breakdown oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testTopProductsFixtures()` is the authoritative Top Products regression test. It asserts repeated-product quantity and revenue totals, descending quantity ranking, stable tie order, the ten-product limit, zero values, ignored purchase-only rows, and empty output. Expected product arrays are literal and independent. The former Top Products oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testProfitTrendFixtures()` is the authoritative Profit Trend regression test. It asserts unsorted cross-year month ordering, repeated-row aggregation, revenue-minus-expense values, purchase-only and revenue-only months, zero-value months, negative-expense refund behavior, and empty output. Expected labels and values are literal and independent. The former Profit Trend oracle, validator, and migration entry point were retired after this test, the independent legacy comparison, and the unified suite passed live in Apps Script.

`testHotColdFixtures()` is the authoritative Hot/Cold Split regression test. It asserts repeated Hot and Cold Sales quantity totals, zero quantities, ignored non-Sales rows, ignored unknown categories, exact case-sensitive matching that excludes differently cased values, and empty output. Expected `hot` and `cold` totals are literal and independent. The former Hot/Cold Split oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testSparseDatasetResilience()` calls the same `buildDashboardResponse()` composition path used by `getDashboardData()`. It requires all 36 public response properties, recursively rejects `NaN` and infinite numbers, validates diagnosis/recommendation/risk/alert/roadmap structures, and compares every pre-existing populated output with a literal snapshot while treating additive metadata separately.

Backend test ownership is separated by responsibility:

- `92.Tests.Fixtures.js` constructs deterministic datasets and expected outputs.
- `94.Tests.Assertions.js` contains reusable test assertions.
- `95.Tests.Validators.js` checks analytics invariants and owns no runnable entry point.
- `96.Tests.Cases.js` contains 40 directly runnable `test*` functions; the ordered runner selects 39 of them plus `getDashboardData()` for its fixed 40-entry gate, while `testInteractiveDrilldownContract()` is covered through `testChartPresentationContract()`.
- `98.Tests.Runner.js` contains only the ordered, fail-fast unified 40-entry suite.

Apps Script execution does not automatically display a function's returned object. On success, `testSparseDatasetResilience()` therefore emits exactly one explicit summary log: `PASS: testSparseDatasetResilience | fixtures=7 | requiredProperties=37 | populatedOutputUnchanged=true`. The oracle requires exactly all 37 top-level response fields and structurally requires `dateFilter.filter`, `startDate`, `endDate`, `label`, and `rowCount`; existing additive metadata checks remain unchanged. It still returns the same summary object and rethrows all original failures unchanged.

`testDashboardDateFilter()` uses fixed reference dates and project-timezone date keys. It covers missing/null/unknown normalization to `currentYear`; `today`; inclusive `last7days` within one month and across two months; month/year presets; custom single/multi-month and cross-year boundaries; invalid custom input; immutable filtering; ignored invalid row dates; parameterless equivalence; current partial-month Revenue Trend inclusion; ascending trend labels; finite values; and renderable empty or zero-revenue results. Its success log reports scenarios, Current Year rows, custom rows, and the resolved timezone.

`testPeriodComparison()` validates Today/previous-day, Last 7 Days/prior-seven-day, elapsed Current Month, full Previous Month, elapsed Current Year, and equal-duration Custom rules in the Apps Script project timezone. It covers shorter prior months, leap-day capping, inclusive boundaries, empty periods, zero baselines, profit-to-loss and loss-to-profit movement, finite one-decimal rounding, processed-array immutability, one raw read, one processing pass, one current analytics cache, additive response shape, and frontend Up/Down/Stable/No Comparison rendering. It logs `PASS: testPeriodComparison | scenarios=23 | presets=6 | finite=true`.

`testBusinessPriorityContract()` validates Critical Data Quality precedence, negative profit, critically low margin, High risk, material revenue decline, negative forecast, expense concentration, product opportunity, stable and empty fallbacks, descending score and fixed source tie-breaking, finite bounds, complete evidence, immutable existing intelligence objects, deterministic repeated inputs, one additive response result, exactly one stable Overview-owned render target, exclusion from Intelligence/Planning ownership, unique renderer targets, and responsive/accessibility preservation. It does not depend on raw-source comments or obsolete first-viewport ordering. It logs `PASS: testBusinessPriorityContract | scenarios=20 | levels=Critical,High,Medium,Low`.

`testKpiTargetContract()` validates exact centralized threshold values, deep immutability, unchanged below/equal/above boundaries, literal historical Business Score, Growth Score, KPI status and achievement, maturity, risk, recommendation ordering, and Business Priority output, plus complete unique public target metadata, system provenance, non-editability, and the accessible responsive disclosure contract. It logs `PASS: testKpiTargetContract | scenarios=20 | centralized=true | editable=false`.

`testDashboardStateContract()` validates the exact loading/success/empty/error/retry vocabulary and additive `dateFilter.rowCount` for empty, purchase-only, sales-only, and populated responses. It logs `PASS: testDashboardStateContract | scenarios=5 | states=loading,success,empty,error,retry`. Frontend lifecycle mocks separately validate request failure, render exceptions, retry request identity, duplicate blocking, stale-handler suppression, control recovery, filter retention, live-region semantics, and the no-raw-payload Console policy.

`testAccessibilityContract()` reads the production HTML partial and validates document language, viewport/title/main/navigation/headings, date-control labels and invalid state, associated live validation, active navigation, table caption/header scope, bounded status regions, focus-visible styling, drawer/page focus exclusion, Escape, native Retry and Data Quality buttons, reduced-motion CSS, and Chart.js animation reduction. It logs `PASS: testAccessibilityContract | scenarios=22 | keyboard=true | reducedMotion=true`.

`testExecutivePresentationContract()` reads the production HTML partial and validates the Executive Summary appears before KPIs and analytical detail, visible heading terminology is consistent, diagnosis and recommendation badges use standardized title case, recommendations preserve backend priority order, executive message containers are unique, responsive grid hierarchy remains intact, and every accessibility/responsive-shell fixture token is preserved. It logs `PASS: testExecutivePresentationContract | scenarios=7 | executiveSummaryFirst=true | accessibilityPreserved=true | responsiveHierarchy=true`.

`testPrintReportContract()` reads the production HTML partial and validates one accessible native print action, one print handler, browser-native `window.print()`, print-only title/active-period/generated/version metadata, inclusion of the active executive report sections and chart summaries, exclusion of navigation/controls/skeletons/disclosures/inactive pages, A4 portrait sizing, width/overflow/card-break protections, absence of backend/export dependencies, and preserved accessibility/responsive contracts. It logs `PASS: testPrintReportContract | scenarios=13 | printReady=true`.

`testCsvExportContract()` reads the production HTML partial and validates one accessible native CSV action beside Print Report, the exact timestamped filename contract, a header row, DOM-derived visible rows and columns in displayed order, empty-state disabling, UTF-8 BOM and MIME type, quote escaping, absence of backend/source-object/hidden-field access, browser Blob/object-URL download, and preserved accessibility/responsive contracts. It executes the production sanitizer against `=SUM(A1:A2)`, `+CMD`, `-CMD`, `@SUM(A1:A2)`, leading whitespace, normal text, a valid negative numeric value, and an already-neutralized value; unsafe cells receive exactly one apostrophe, while numeric-column `-12500` remains unchanged. It logs `PASS: testCsvExportContract | scenarios=14 | csvReady=true`.

`testClientRenderPerformanceContract()` reads the production HTML partial and validates the stable DOM cache, query-count budget, immediate first-visible render order, exactly one animation-frame phase, cancellation plus request-token stale protection, absence of in-place sorting/reversing/splicing, preserved populated-output containers, and retained accessibility/state source contracts. It logs `PASS: testClientRenderPerformanceContract | scenarios=7 | idQueries=71 | selectorQueries=2 | deferredPhases=1 | responseMutation=false`.

`testResponsiveShellContract()` reads the production HTML partial and validates the menu, labeled drawer, backdrop, ARIA controls, Escape/navigation close paths, body scroll lock, focus restoration, active-page semantics, table scroll wrapper, narrow full-width main content, retained desktop sidebar classes, and the single initialization guard. It logs `PASS: testResponsiveShellContract | scenarios=12 | breakpoint=lg | drawer=true`.

`testUiShellThemeContract()` reads the production HTML and generated Tailwind partials. It validates the approved shell dimensions, eleven-destination inventory, semantic theme options/tokens, validated `numlock.ui.theme` persistence with System default, theme application before compiled styles, print-light/chart synchronization, accessible mobile and collapsed navigation, retained active entry points, truthful unavailable modules, guarded listener initialization, response immutability, and the current 71-ID/two-selector count under the established ceiling. It logs `PASS: testUiShellThemeContract | scenarios=17 | destinations=11 | themes=3 | idQueries=71 | selectorQueries=2`.

`testNineDestinationNavigationContract()` retains its historical public entry-point name while validating the current exact active/unavailable counts and labels, one accessible Finance modules disclosure, semantic unavailable status, no unsupported future route/page/panel/content, non-activatable items, exact desktop widths, mobile parity, active/focus behavior preservation, light/dark treatment, no added backend/listener path, response immutability, and the query budget. It logs `PASS: testNineDestinationNavigationContract | scenarios=10 | destinations=11 | active=5 | unavailable=6 | backendRequests=0 | idQueries=71 | selectorQueries=2`.

`testFullShellVisualContract()` reads the production HTML partial and validates unified header ownership, exact shell/tab geometry, one-viewport desktop hooks, mobile flow/drawer semantics, truthful navigation, tab placement, restrained shell surfaces, forbidden-feature absence, theme/print parity, focus exclusion, request/listener/immutability safeguards, and the established query budget. It logs `PASS: testFullShellVisualContract | scenarios=12 | destinations=11 | active=5 | unavailable=6 | backendRequests=0 | idQueries=71 | selectorQueries=2`.

`testDashboardTabFrameworkContract()` reads the production HTML partial and verifies the Dashboard tablist and linked panels, roving focus and automatic keyboard activation, exact one-time ownership for 17 current regions after restoring Forecast and Product Concentration to Performance, retained selected state across unrelated UI/data operations, zero backend calls in the tab path, one guarded initializer, print-time revelation of every panel, chart resize without recreation, desktop/mobile overflow rules, Dashboard-level state ownership, and response immutability.

`testDashboardOverviewContract()` reads the production HTML partial and validates the six reporting periods plus custom controls, Print and quiet metadata, executive condition/attention/action hierarchy, score-free Business Priority evidence, five exact KPI cards with preserved drill-down and comparison data, the single existing Revenue Trend in the Overview `8/4` evidence row, compact four-metric comparison, collapsed Data Quality disclosure, `288px`/`240px`/`220px` plot containment, desktop/mobile overflow, light/dark/print parity, zero new requests, guarded state, response immutability, and the current query budget. It logs `PASS: testDashboardOverviewContract | scenarios=8 | kpiCards=5 | backendRequests=0 | idQueries=53 | selectorQueries=2`.

`testPerformanceAnalyticsVisualContract()` validates the Overview-owned Revenue Trend hero, Performance metric ownership, Analytics ownership, all three chart source/lifecycle/formatting contracts, Top Products ranking, contribution/dependency/concentration/Pareto evidence, accessible summaries, reduced motion, chart theme synchronization, finite `288px`/`240px`/`220px` Revenue containment, canvas-only fill, deterministic repeated activation height, one direct resize per revealed chart, absence of application resize observers/listeners or recursive theme scheduling, zero tab requests, response immutability, and the query budget. It logs `PASS: testPerformanceAnalyticsVisualContract | scenarios=9 | performanceMetrics=5 | charts=3 | backendRequests=0 | idQueries=53 | selectorQueries=2`.

`testIntelligencePlanningVisualContract()` reads the production HTML partial and validates exact Intelligence/Planning ownership and order, diagnosis plus alert hierarchy, unchanged recommendation iteration, risk/opportunity and Revenue/Profit evidence, Business Focus plus score-free Priority Action, roadmap order/final termination, KPI Achievement, Business Maturity, closed non-editable Target Reference, absence of duplicated Overview Business Priority, theme/accessibility/viewport containment, zero tab requests, response immutability, and the query budget. It logs `PASS: testIntelligencePlanningVisualContract | scenarios=9 | recommendationOrderPreserved=true | editableTargets=false | backendRequests=0 | idQueries=71 | selectorQueries=2`.

`testInteractiveDrilldownContract()` reads the production HTML partial and executes the pure transaction filter against literal Sales/Purchase/month/category cases. It verifies source order and response immutability, accessible controls and focus, the explicit maximum-ten-row disclosure, clear behavior, and frontend-only operation. It logs `PASS: testInteractiveDrilldownContract | scenarios=4 | boundedRows=10 | responseMutation=false`.

`testChartPresentationContract()` reads the production HTML partial, invokes the interactive drill-down contract, and validates populated/empty contracts for all three charts, `MM/YYYY` and Rupiah/quantity formatting, zero baselines, no stale or duplicate instances, safe zero-total percentages, backend Expense ordering, long-label behavior, accessible titles/summaries, summary updates, and responsive containment. It logs `PASS: testChartPresentationContract | scenarios=16 | charts=revenue,hotCold,expense`.

`testFrontendDependencyContract()` reads the production HTML partial and validates that Tailwind remains local, Chart.js 4.5.1 and Font Awesome 6.0.0 appear exactly once over HTTPS, no floating runtime URL exists, Font Awesome matches active icon usage, the Chart.js available/unavailable paths preserve chart and responsive contracts, summaries remain present, the fallback has no alert or raw payload, and one actionable diagnostic is defined. It logs `PASS: testFrontendDependencyContract | scenarios=14 | chartPinned=true | fallback=true`.

`testReportingMetadata()` validates empty, sales-only, purchase-only, mixed, and invalid-date inputs; counts; earliest/latest dates and timestamp; all freshness statuses; today, rolling, month, year, previous-month, and custom completion rules; project timezone; additive response presence; finite numbers; and the compact responsive frontend contract. It logs `PASS: testReportingMetadata | scenarios=15 | freshness=Current,Stale,No Data`.

`testDataQualityDiagnostics()` validates empty and fully valid data; each fixed issue independently; negative and non-finite numeric inputs; multiple issues on one row; mixed valid/invalid rows; all status rules; scoped date-filter output; source-array immutability; preservation of raw numeric provenance through processing; additive response presence; and frontend accessibility/code-hiding tokens. It logs `PASS: testDataQualityDiagnostics | scenarios=15 | statuses=Good,Attention,Critical`.

`testSourceDataQualityPipeline()` validates valid, one-invalid, multiple-invalid, mixed source/scoped, out-of-period, all-invalid, empty, and header-only inputs; scope counts; source immutability; analytics isolation; empty analytics with Critical quality; stable row-identity deduplication; the single-read pipeline order; and frontend non-disclosure. It logs `PASS: testSourceDataQualityPipeline | scenarios=15 | invalidDateVisibility=true | analyticsIsolation=true`.

`testFinanceCoreBackendContract()` validates 35 deterministic Finance scenarios covering the approved P&L formulas, authoritative DepreciationLedger aggregation, month-intersection semantics, master-to-account resolution, account 6900 overlap exclusion, ledger integrity signals, inactive and unresolved mappings, inclusive and empty periods, unavailable statements, and absence of Dashboard, Transaction, Helper, or asset-depreciation calculation coupling. It logs `PASS: testFinanceCoreBackendContract | scenarios=35`.

`testFinanceProfitAndLossUiContract()` validates 29 focused Finance UI scenarios covering route truthfulness, independent request/state ownership, six KPI cards, the depreciation statement row, all view states, formatting, authoritative-ledger disclosure, responsive/theme structure, and unsupported/legacy exclusions. It logs `PASS: testFinanceProfitAndLossUiContract | scenarios=29`.

`testDepreciationEngineContract()` validates the deterministic engine, read-only dry-run, and controlled Phase 7B persistence contract. It must run before the unified suite; the production write requires separate authorization for one Apps Script execution of `backfillDepreciationLedgerThrough202608()`.

`testCapitalEquityMigrationContract()` validates the approved Phase 8D capital, return-of-capital, owner-draw, retained-earnings opening-balance, cutoff, deterministic identity, duplicate, reconciliation, inactive-row, no-P&L, no-cash, and read-only diagnostic contracts.

Use the individual functions for targeted debugging after `runAllBackendTests()` identifies a failure. The wrapper logs a start marker, one PASS per completed test, and a final `60/60` marker. On failure it logs the test name and error message, then immediately rethrows the original error.

## Helpers that must not be run directly

Do not select parameterized helpers in the Apps Script editor. They require constructed arguments and are exercised through the safe entry points or bounded local harnesses:

- data helpers taking `ss`, `transactions`, or `priceMap`;
- `buildAggregate(data)`;
- every `build*FromAggregate(aggregate)` adapter;
- cache consumers taking `cache`;
- `buildDiagnosis(data, cache)`; and
- all other builders requiring `data`, `summary`, or another argument.

Running a parameterized helper without its required value can produce a misleading failure and is not a valid acceptance result.

## Required validation sequence

`runAllBackendTests()` is the unified backend gate for local and Apps Script validation. It requires `60/60`, including Inventory migration, conversion authority, and opening staging, Cash Foundation, CapitalEquity migration, depreciation, Finance Core and Profit & Loss UI plus the existing deterministic feature, response, accessibility, UI, chart, theme, performance, navigation, shell, composition, and data-quality coverage. The unified suite remains ordered and fail-fast.

## Frontend-dependency contract

Runtime dependency inventory is exactly two unique HTTPS URLs: Chart.js 4.5.1 and Font Awesome 6.0.0. Tailwind 3.4.17 is build-time only and its generated clasp-tracked CSS is local. Floating tags, unversioned package paths, duplicate includes, dynamic dependency injection, and unverified SRI hashes are prohibited.

The available-path mock constructs the same three Chart.js configurations and preserves source values. The unavailable-path mock removes `Chart`, renders twice, and requires three `Chart unavailable.` regions, retained external summaries, continued non-chart rendering, safe destruction of existing instances, and exactly one actionable console diagnostic with no response payload.

## Chart-presentation contract

The three chart renderers consume the existing response values without mutation or formula changes. Revenue labels are displayed as `MM/YYYY`, Revenue and Expense tooltips use Indonesian Rupiah, and Hot/Cold tooltips show quantities plus a finite percentage. Revenue and Expense use zero baselines; Revenue does not span absent values; Expense preserves backend category order and uses a horizontal layout for long labels.

Before every populated or empty render, the prior chart instance is destroyed and the canvas is cleared. Revenue, Hot/Cold, and Expense show their exact chart-specific empty messages independently; a zero-value chart never classifies the entire dashboard as empty. Each titled chart region owns an external text summary that updates with the date filter and exposes no internal metadata.

## Data-quality diagnostics contract

`dataQuality` is additive and observational. A pure inspection evaluates raw source dates before processing; the other issue types evaluate only rows admitted by the active date filter. The pipeline performs one transaction read and never mutates, repairs, writes, or changes analytics inclusion. Invalid source dates remain excluded from analytics but visible in diagnostics.

- `INVALID_DATE` (High): date cannot be interpreted as valid.
- `UNKNOWN_TRANSACTION_TYPE` (High): type is neither exactly `Sales` nor `Purchase`.
- `MISSING_SALES_PRODUCT` (Medium): Sales row has no product.
- `MISSING_PURCHASE_CATEGORY` (Medium): Purchase row has no purchase category.
- `INVALID_QUANTITY` (Medium): Sales quantity is non-finite or negative.
- `INVALID_PURCHASE_AMOUNT` (Medium): Purchase expense is non-finite.

`totalRows` and `scope.scopedRows` are the scoped row count. `scope.sourceRows` counts raw data rows and `scope.excludedInvalidDateRows` counts source invalid dates excluded from scoping. `validRows` counts scoped rows without a scoped issue; `issueRows` counts unique affected source or scoped rows; and `issueCount` counts every detected issue. Consequently, `issueRows` may exceed `totalRows`. Status is Good at zero issues, Attention when issues are exclusively Medium severity, and Critical when any High-severity issue exists. The frontend renders only status, issue-count and scope text, user-facing labels, and counts; its real disclosure button exposes `aria-expanded` and `aria-controls`, and internal codes, raw values, and row identities must not appear in HTML.

## Reporting metadata contract

`reportingScope` and `dataFreshness` are additive response fields derived from the filtered processed rows without another spreadsheet read. Row and transaction counts reflect that scoped array; sales and purchase counts use exact transaction types. Invalid dates do not participate in earliest/latest calculations. Freshness is No Data for zero scoped rows, Current when the latest scoped calendar date equals today, and Stale otherwise in the Apps Script project timezone. Current Month and Current Year are partial until their natural calendar end; Today, Last 7 Days, Previous Month, and Custom are complete.

The frontend renders `MM/YYYY` or `MM/YYYY – MM/YYYY`, `<n> transactions`, `Updated DD/MM/YYYY` or `No transaction data`, and a text-visible Current/Stale/No Data badge. It must not render ISO timestamps, `generatedAt`, timezone, or internal filter keys.

## Dashboard state contract

`dateFilter.rowCount` is the authoritative count of valid transaction rows inside the active inclusive date range. Only zero rows is empty; purchase-only and sales-only responses are successful even when one financial measure is zero.

The browser transitions through centralized loading, success, empty, and error presentation. Loading disables controls, blocks duplicate requests, announces progress, and de-emphasizes stale content. Empty preserves the active range and immediately restores filter controls. Request or render failure restores controls, retains the selected values, shows a sanitized error plus Retry, clears skeletons, and writes concise diagnostic context to `console.error` without logging business payloads. Retry submits the exact saved filter/start/end tuple, and request sequence tokens ignore stale callbacks.

## Dashboard date-filter contract

All transaction-derived sections use one filtered processed-row array before cache construction, diagnosis, or recent-transaction projection. Missing, null, empty, and unknown filters normalize to `currentYear`.

- `today`: the project-timezone calendar day.
- `last7days`: today plus the previous six calendar days, inclusive.
- `currentMonth`: month start through today.
- `previousMonth`: the complete prior calendar month.
- `currentYear`: January 1 through today; this is the default.
- `custom`: valid `YYYY-MM-DD` start/end values, inclusive. Both are required and start must not be after end.

The backend uses `Session.getScriptTimeZone()` as the authority. It ignores rows with invalid dates, never mutates the supplied row array, and throws descriptive errors for invalid custom input rather than swapping boundaries.

Revenue Trend uses the Aggregate Engine output for the filtered rows and does not remove the current calendar month. The visible frontend label is derived from the response `startDate` and `endDate` strings without constructing browser-local dates: one month renders as `MM/YYYY`, and multiple months render as `MM/YYYY – MM/YYYY`.

### During decomposition

After every function move:

1. Confirm the function exists exactly once across clasp-tracked source.
2. Confirm its name, parameters, and body are unchanged except for approved header comments.
3. Run JavaScript syntax checks on every changed `.js` file.
4. Run source-contract scans for duplicate or missing globals.
5. Run all six deterministic fixture regressions locally.
6. Run `getDashboardData()` locally with an Apps Script-compatible mock.
7. Run `git diff --check` and `git status --short`.

### Live validation and release

1. Confirm the active clasp account and configured NUMLOCK project without exposing the script ID.
2. From the VS Code terminal, run `clasp status` and verify only approved production files are tracked.
3. Run `clasp push` only when explicitly requested. Use `clasp push --force` only when a normal push cannot synchronize the complete reviewed source and force upload is explicitly required.
4. Run `runAllBackendTests()` in Apps Script as the primary backend validation. Use an individual test only for targeted debugging.
5. Stop on the first mismatch or runtime error; do not apply speculative fixes.
6. List the existing Apps Script deployments, create an immutable version, and update the intended deployment only when explicitly requested after backend tests pass.
7. Hard-refresh the deployed dashboard, verify visible cards/charts/transactions, and inspect the browser console.

Follow `RELEASE.md` for the complete authoritative release sequence and checklist.

## Safety

- Tests and dashboard reads must not alter spreadsheet data.
- Do not edit `.clasp.json` or expose its script ID.
- Do not treat `clasp push` as a test pass.
- Do not commit, push Git, deploy, or modify spreadsheet data unless the task explicitly authorizes it.

## Finance Phase 11U Lemon operational authority

`testInventoryLemonOperationalStandardContracts()` runs inside the existing conversion suite.
ING-018 retains BaseUOM `slice`. Its sole prospective conversion authority is
`MANAGEMENT_OPERATIONAL_STANDARD`: 1 kg = 8 fruits and 1 fruit = 3 slices,
therefore exactly 1000 gr = 24 slice, effective 2026-10-01. This is NUMLOCK management's
operational standard, not a physical assertion about each batch. Natural yield differences
are operational variance and never automatically change the conversion. Historical approximately
21 slices/kg and controlled-yield observations cannot authorize readiness, posting, openings,
or costing. No controlled-yield experiment is required.

The existing 24-column schema is preserved. The validator requires Numerator=24,
Denominator=1000, FromUOM=gr, ToUOM=slice, SupplierRef=INTERNAL-NUMLOCK and
PackageIdentity=`ING-018|INTERNAL-NUMLOCK|Lemon|OPERATIONAL-STANDARD|1000gr-24slice|V01`.
PackageIdentity identifies the normative standard here, not a measured package.
ApprovalStatus must be SINGLE_OPERATOR_APPROVED, with named PreparedBy, valid PreparedAt,
EvidenceDate no later than preparation, blank reviewer fields, and a versioned immutable
`GDRIVE:<file-id>:V01:SHA256:<64-lowercase-hex>` attestation reference.
The exact ApprovalNote is:

```text
BASIS=MANAGEMENT_OPERATIONAL_STANDARD; METHOD=1_KG_8_FRUITS_1_FRUIT_3_SLICES_SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC; PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW_NOT_PHYSICAL_OBSERVATION_OPERATIONAL_VARIANCE; REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED
```

A real signed management attestation must supply that reference; the local test reference is
synthetic and must never be populated. Validation checks the reference contract, not remote
file existence or signature authenticity. Future governed intake must retrieve and verify the
referenced artifact and hash. No evidence artifact or physical evidence is fabricated here.
A valid active row becomes SINGLE_OPERATOR_VERIFIED only within its effective date range.
`convertInventoryLemonOperationalQuantity()` is pure, accepts gr only, and returns slice.
Bag-to-weight conversion requires an explicitly governed purchase/receipt rule in a later phase.

Conversion eligibility does not expand the frozen 21-item InventoryOpenings intake or supply
count, valuation, economic-origin, or accounting approval evidence. The 21 conversion manifests
and population/activation code remain unchanged. No historical reconstruction, openings,
InventoryLedger movements, Account 1100 posting, or recipe auto-consumption is enabled.
Local focused regressions and syntax checks are separate from Apps Script runtime acceptance.

## Finance Phase 11U.1 management attestation and runtime acceptance

`runInventoryLemonManagementDisposableRuntimeProof()` runs 42 Lemon checks with disposable,
function-local synthetic fixtures. It creates no Sheets or Drive files and calls no production
writers. It reads full-grid values, formulas, and notes for InventoryUOMConversions,
InventoryItems, InventoryOpenings, InventoryLedger, BalanceLedger, Accounts, and COGSRecipes
before and after the proof. It requires exactly the frozen 21 production conversion references,
SINGLE_OPERATOR_VERIFIED readiness for each, no production Lemon row, and identical snapshots.
Cleanup PASS denotes disposal of in-memory fixtures; no external temporary resources exist.

The management manifest and version/SHA256 reference are in
[evidence/finance-phase-11u1](evidence/finance-phase-11u1/README.md).
The 2026-09-05 local proof and focused regressions passed. One authorized `clasp push --force`
synchronized 66 files. The CLI attempt returned storage `NOT_FOUND`. The user's Phase 11U.2A
correction supersedes that earlier blocked record: the authenticated editor subsequently ran
`runInventoryLemonManagementDisposableRuntimeProof()` exactly once with PASS, 42 scenarios,
existing21Authorities PASS, zero production writes, productionMutation=false, and cleanup PASS;
`runAllBackendTests()` then passed exactly once at 60/60. These are user-supplied accepted runtime
facts. Phase 11U.1 is COMPLETE/FROZEN and must not be rerun for Phase 11U.2A.

## Finance Phase 11U.2A guarded Lemon production flow

`testInventoryLemonProductionFlowContracts()` is nested under the existing conversion-authority
suite entry; the ordered backend suite remains 60 entries. Its 104 synthetic scenarios cover
fresh-read preflight, exact frozen evidence fields, single-row population and IsActive-only
activation, both idempotency states, 22 valid active authorities, the prospective posting gate,
full-grid preservation, schema/formula/note/row drift, uncertain write failures, and guarded
recovery with downstream and later-conversion refusals. A populated BalanceLedger conservatively
blocks recovery because it cannot prove the absence of a Lemon dependency.

`runInventoryLemonProductionDisposableRuntimeProof()` runs only those in-memory fixtures, with
synthetic digest doubles and no Google service access. Its cleanup PASS means function-local
fixture disposal. It does not establish current production preflight or live Drive access.
The separate local verifier checks the real frozen manifest files using Node SHA256:

```sh
node docs/evidence/finance-phase-11u2a/verify-local.cjs
```

The verifier runs the new proof and focused Inventory foundation, migration, conversion, and
nested governance/Lemon contracts. These additive executors do not change shared conversion
or posting logic; the impact-radius gate does not rerun the full backend suite. Syntax and
`git diff --check` are also required. See the [11U.2A execution notes](evidence/finance-phase-11u2a/README.md)
for entry points, recovery limitations, and the separate future upload/runtime/production gates.

## Finance Phase 11V.8 orchestration foundation

`testInventoryReceiptOrchestrationContracts(authority)` is a parameterized local-only
fixture suite. Run it through `node docs/evidence/finance-phase-11v8/verify-local.cjs --unified`,
which also tests the real public dispatcher against synthetic Sheets and runs the existing
ordered 60-entry backend suite. Receipt foundation (188 scenarios), operational receipt
(169 checks), conversion/opening, transaction entry/lifecycle and static UI regressions are
included. Suite membership remains unchanged. Production posting/correction remains disabled.
See the [11V.8 contract and routing review](evidence/finance-phase-11v8/README.md) for all 34
unresolved BLOCKED IDs, recovery states, changed files and evidence boundaries. Local PASS
does not establish authenticated runtime, browser, upload or deployment acceptance.

## Finance Phase 11V.8B simplified prospective routing

Phase 11V.8B supersedes the V1 crosswalk/all-BLOCKED routing contract. Current-source validation
uses `node docs/evidence/finance-phase-11v8b/verify-local.cjs --unified`; the preceding V1
verifier is historical. The updated parameterized orchestration suite passes 165 checks
without ExpenseItems/registry dependencies. The new verifier checks the seven approved
Expense IDs and 27 blocked IDs through actual synthetic dispatcher persistence, stale-client
refusals, selector cache-version isolation, 22 direct InventoryItem choices and historical
resolution for all 27 blocked IDs. Receipt foundation 188 and operational 169 regressions
pass. Ordered backend suite membership remains 60 entries, all passing in the local VM.
See the [approved V2 authority and evidence](evidence/finance-phase-11v8b/README.md).
Production operational posting remains disabled; no upload/runtime/browser PASS is implied.
