# NUMLOCK Changelog

This document records verified engineering milestones. Semantic versioning begins at `1.0.0`; future releases must update this changelog and `10.Config.js` together.

## Unreleased

- Closed Sprint 5.14 at committed and pushed implementation `fe6c424`. Reconfirmed `testInteractiveDrilldownContract()` PASS, local `runAllBackendTests()` PASS 25/25, the fixed 25-entry runner, active-response-only ownership, the ten-row recent-transaction bound, no backend/API/persistence change, and CSV export from visible drill-down rows. The Apps Script source is uploaded; live runtime and deployed-browser acceptance remain separate unverified evidence.
- Recommended exactly one next package: Sprint 5.15 Package 001, a documentation-only inventory of external consumers of the dashboard response before any API projection or payload reduction is authorized.
- Completed Sprint 5.14 Package 001 locally with bounded KPI and chart drill-down into filtered recent-transaction evidence already present in the active dashboard response. The interaction adds no backend/API call, persistence, spreadsheet access, response field, expanded history, or response mutation.
- Added accessible KPI and chart actions, point-specific Revenue-month and Expense-category filtering, a responsive transaction-view status with clear/reset behavior, and keyboard focus transfer. `testInteractiveDrilldownContract()` adds four deterministic scenarios while the ordered runner remains 25 entries; local focused, performance, chart, and unified 25/25 gates passed with 71 ID queries, two selector queries, and one deferred phase.
- Closed Sprint 5.13 after live `testCsvExportContract()` PASS, live `testClientRenderPerformanceContract()` PASS, and live `runAllBackendTests()` PASS 25/25. Package 001 CSV export and Package 002 formula-injection hardening are complete, with the 72-ID/two-selector query budget and no-response-mutation contract preserved.
- Completed Sprint 5.13 Package 002 locally by neutralizing first-non-whitespace `=`, `+`, `-`, and `@` CSV formula prefixes with exactly one apostrophe before normal CSV quoting. Numeric Qty/Amount values such as `-12500`, the `-` placeholder, ordinary text, dates, currency display, UTF-8 BOM, visible scope/order, filename, Blob download, and accessible state behavior remain unchanged.
- Expanded `testCsvExportContract()` from 12 to 14 scenarios with eight behavioral sanitizer cases, including leading whitespace and exactly-once handling. The ordered suite remains 25 tests; `testClientRenderPerformanceContract()` retains 72 ID queries, two selector queries, and no response mutation.
- Audited Sprint 5.13 closure at committed implementation `563a7e4`. Visible-row/column scope, displayed ordering, UTF-8 Blob download, accessible empty-state control, and the restored 72-ID/two-selector performance budget were present; the audit identified missing spreadsheet-formula neutralization and test coverage, which Package 002 subsequently addressed before the live 25/25 acceptance passed.
- Selected Sprint 5.13 Package 002 as the single bounded follow-up for CSV formula-injection hardening, focused contract coverage, and the missing 25/25 acceptance; it introduces no new exported data, backend/API behavior, spreadsheet access, permission, persistence, history, or layout scope.
- Completed Sprint 5.13 Package 001 with one accessible Export CSV button beside Print Report. The browser builds a UTF-8 CSV with a header row from only the currently rendered transaction table's visible rows and columns, preserving displayed order, and downloads `NUMLOCK_Transactions_YYYYMMDD_HHmm.csv` through Blob and object-URL APIs.
- Added `testCsvExportContract()` covering filename, header, visible row/column scope, ordering, empty-state disabling, UTF-8 output, hidden-field exclusion, browser Blob download, and preserved accessibility; raised the ordered fail-fast unified gate to 25/25 without backend/API, spreadsheet, history, GitHub Pages, or release-metadata changes.
- Closed Sprint 5.12 at verified commit `0e6dcdc` after confirming the print-ready filtered executive report, print metadata, authored A4 portrait contract, preserved accessibility contracts, and the ordered 24-entry runner with the latest verified local 24/24 gate. The closure audit was documentation-only and did not run clasp upload, Apps Script runtime, deployment, or browser print acceptance.
- Recommended Sprint 5.13 Package 001 as a bounded frontend-only CSV export of the current filter's already visible recent-transaction rows and columns, explicitly excluding hidden data, backend/API changes, expanded history, drill-down, and persistence.
- Completed Sprint 5.12 Package 001 with one accessible Print Report button, browser-native `window.print()`, and authored A4 portrait print CSS for the currently rendered dashboard period.
- Added a print-only NUMLOCK Executive Report header with active period, generated date, and unchanged release version; retained KPIs, Executive Summary, Business Priority, comparison, reporting metadata, freshness, Data Quality status, charts and their text summaries, and recommendations while excluding navigation, controls, skeletons, disclosures, and hidden pages.
- Added `testPrintReportContract()` with 13 static scenarios and raised the ordered fail-fast unified gate to 24/24 without changing analytics, backend responses, GitHub Pages, or release metadata.
- Closed Sprint 5.11 after confirming Package 001 stable DOM-reference caching, bounded deferred rendering, stale deferred-work cancellation, and frontend mutation safety in commit `46e42b1`. The latest verified gate remains local 23/23 plus the successful 26-file clasp upload; Apps Script runtime, deployment, and browser acceptance remain unverified.
- Completed Sprint 5.11 Package 001 bounded client-render performance without changing analytics, response contracts, visible output, filter/retry behavior, accessibility, responsive behavior, or chart lifecycle.
- Cached only stable shell, control, skeleton, and dashboard-state DOM references; retained dynamic generated children as uncached render output; and kept response collections immutable by copying or using non-mutating iteration.
- Added one request-token-guarded `requestAnimationFrame` phase for detailed intelligence, recommendations, decision support, product detail, roadmap, and recent transactions while keeping first-visible dashboard state, Executive Summary, KPIs, reporting metadata, comparison, targets, data quality, and charts immediate. Added `testClientRenderPerformanceContract()` and raised the ordered fail-fast unified gate to 23/23.
- Uploaded the reviewed 26-file clasp inventory after the local 23/23 gate passed; Apps Script runtime, deployment, and browser acceptance were not run.
- Closed Sprint 5.10 locally after confirming all five packages: accessibility and keyboard semantics, executive dashboard presentation, period comparison, unified Business Priority, and centralized explainable KPI targets. The ordered unified suite contains 22 checks and requires 22/22; this documentation-only closure audit did not rerun upload, Apps Script runtime, deployment, or browser acceptance.
- Completed Sprint 5.10 Package 005 by moving existing stable KPI and business-status thresholds into deeply immutable `KPI_TARGET_CONFIG` without changing formulas, boundaries, classifications, recommendations, or analytics.
- Added backward-compatible `kpiTargets` metadata for the existing Revenue, Profit, Units Sold, and Profit Margin targets with explicit system provenance and non-editable status, plus a compact accessible Business Performance disclosure.
- Added `testKpiTargetContract()` with 20 deterministic boundary, historical-output, immutability, public-contract, accessibility, and responsive scenarios; raised the ordered fail-fast unified gate to 22/22.
- Completed Sprint 5.10 Package 004 additive unified Business Priority without changing or removing recommendations, priorityAction, businessFocus, executiveAlert, riskEngine, diagnosis, analytics, or period comparison.
- Added deterministic precedence for Critical Data Quality, profitability, High risk, material revenue decline, negative forecast, expense concentration, product concentration, and stable/empty fallback; equal levels use finite score ordering and fixed source precedence.
- Replaced only the Executive Summary primary-action presentation with accessible Business Priority level, reason, action, and evidence; added `testBusinessPriorityContract()` with 20 scenarios and raised the ordered fail-fast unified gate to 21/21.
- Completed Sprint 5.10 Package 003 additive period-over-period comparison for Today, Last 7 Days, Current Month, Previous Month, Current Year, and Custom ranges in the Apps Script project timezone.
- Added finite one-decimal percentage and Up/Down/Stable/No Comparison semantics, including zero baselines, signed profit/loss transitions, shorter-month caps, leap-year safety, one raw read, and one processing pass without changing existing analytics or KPI values.
- Added one compact accessible Executive Summary comparison, `testPeriodComparison()` with 23 deterministic scenarios, and raised the ordered fail-fast unified gate to 20/20.
- Completed Sprint 5.10 Package 002 executive dashboard polish without changing analytics, backend responses, accessibility behavior, responsive behavior, the color palette, or animation.
- Moved the Executive Summary ahead of KPIs so performance, attention status, and the next action are visible first; standardized section terminology, card spacing, badge capitalization, and recommendation priority labels while reducing repeated executive cards and excess whitespace.
- Added `testExecutivePresentationContract()` and raised the ordered fail-fast unified backend gate to 19/19.
- Completed Sprint 5.10 Package 001 dashboard accessibility without changing analytics, layout hierarchy, visual design, or response contracts.
- Added document and landmark metadata, date-control labels and associated live validation, focus-visible styling, hidden-page focus exclusion, table naming/header scope, and reduced-motion handling for skeleton, drawer, roadmap, and Chart.js animation.
- Added `testAccessibilityContract()` with 22 deterministic/static scenarios and raised the ordered fail-fast unified backend gate to 18/18.
- Implemented Sprint 5.9 Package 006 deterministic frontend dependency ownership: retained local Tailwind 3.4.17, pinned Chart.js to 4.5.1, and retained the actively used Font Awesome 6.0.0 stylesheet.
- Added a non-blocking Chart.js failure path that safely destroys existing instances, preserves accessible summaries and non-chart rendering, displays `Chart unavailable.`, and logs one actionable diagnostic without business payloads.
- Added `testFrontendDependencyContract()` with 14 deterministic/static scenarios and raised the ordered fail-fast unified backend gate to 17/17 while preserving chart presentation and responsive contracts.
- Implemented Sprint 5.9 Package 005 chart comprehension and zero-data behavior for Revenue Trend, Hot/Cold Split, and Expense Breakdown without changing analytics formulas or response contracts.
- Added Rupiah/quantity tooltips, `MM/YYYY` revenue labels, safe Hot/Cold percentages, horizontal long-label Expense presentation, explicit chart-level empty messages, and filter-updated accessible summaries outside each canvas.
- Added `testChartPresentationContract()` with 16 deterministic/static scenarios and raised the ordered fail-fast unified backend gate to 16/16 while preserving chart source values.
- Implemented Sprint 5.9 Package 004 source-level invalid-date inspection before processing and date scoping while preserving one transaction read and keeping analytics restricted to valid scoped rows.
- Extended additive `dataQuality` with source/scoped/excluded row counts; source invalid dates now remain Critical and visible even when the selected period has no analytics rows, without exposing raw values or row identities.
- Added `testSourceDataQualityPipeline()` with 15 deterministic scenarios and raised the ordered fail-fast unified backend gate to 15/15 while preserving analytics output.
- Implemented Sprint 5.9 Package 003 additive scoped `dataQuality` diagnostics with total/valid/issue row counts, issue totals, six fixed issue definitions, and Good/Attention/Critical status without changing filtering or analytics.
- Added a compact responsive Data Quality badge, issue-count text, and accessible label-only details disclosure that never renders internal issue codes.
- Added `testDataQualityDiagnostics()` with 15 deterministic scenarios and raised the ordered fail-fast unified backend gate to 14/14 while preserving populated analytics output.
- Implemented Sprint 5.9 Package 002 additive `reportingScope` and `dataFreshness` response metadata from the already scoped transaction rows, including deterministic project-timezone freshness and partial-period semantics.
- Added a compact responsive reporting summary for active month range, transaction count, latest data date, and text-labeled Current/Stale/No Data status without exposing raw timestamps or internal metadata.
- Added `testReportingMetadata()` and raised the ordered fail-fast unified backend gate to 13/13 while retaining the populated analytics snapshot.
- Implemented Sprint 5.9 Package 001 responsive dashboard shell: preserved the fixed desktop sidebar at `lg`, added a narrow-screen overlay drawer with backdrop/Escape/navigation close behavior, body scroll locking, focus restoration, and active-page semantics.
- Added narrow-screen stacking, wrapping, `min-w-0` overflow guards, responsive chart heights, and an explicit horizontal-scroll container for the recent-transactions table.
- Added `testResponsiveShellContract()` and raised the ordered fail-fast unified backend gate to 12/12.
- Implemented Sprint 5.8 Package 004 recoverable dashboard states with an accessible live status region, explicit loading/empty/error messages, keyboard-operable Retry, duplicate-request locking, exact request reuse, render-error recovery, and stale-callback suppression.
- Added backward-compatible `dateFilter.rowCount` metadata so empty means zero scoped transaction rows; purchase-only and sales-only periods remain successful populated states.
- Added `testDashboardStateContract()` and deterministic frontend lifecycle mocks; the unified backend gate now requires 11/11.
- Implemented the Sprint 5.8 Package 003 date filter across every dashboard output with `today`, inclusive `last7days`, `currentMonth`, full `previousMonth`, default `currentYear`, and validated inclusive `custom` ranges in the Apps Script project timezone.
- Added backward-compatible `getDashboardData(filter, customStart, customEnd)` handling and additive `dateFilter` response metadata; invalid row dates are ignored and source arrays are not mutated.
- Corrected Revenue Trend to retain every represented month in the already filtered transaction set, including current partial-month revenue, and simplified the visible range to month-only `MM/YYYY` or `MM/YYYY – MM/YYYY` text.
- Expanded `testDashboardDateFilter()` with deterministic preset, cross-month, cross-year, current-period, zero-revenue, ordering, and finite-value assertions while preserving the unified backend gate at 10/10.
- Made the complete dashboard response and intelligence pipeline resilient to empty, sales-only, purchase-only, one-row, sparse mixed, and populated datasets while preserving the populated response snapshot and public response fields.
- Added `testSparseDatasetResilience()` with seven deterministic fixtures, finite-number and required-property checks, decision-output validation, and full populated-output equivalence; the unified backend gate is now 9/9.
- Added minimal frontend collection guards for charts, diagnosis, recommendations, roadmap, products, expenses, and recent transactions without redesigning empty states or changing Tailwind classes.
- Completed Sprint 5.8 Package 001 as a documentation-only product, UX, capability, consistency, and frontend-performance audit.
- Added the evidence-based P0/P1/P2/P3 product backlog and selected only the next three independently releasable packages: empty-data resilience, truthful transaction scope, and recoverable dashboard states.
- Classified GitHub Pages `index.html` as a separate redirect/launcher rather than a duplicate dashboard or documentation page.
- Added deterministic Hot/Cold Split fixtures covering repeated sales, quantity totals, zero quantities, non-Sales rows, unknown categories, exact case-sensitive matching, and empty data.
- Replaced the unified suite's final legacy migration comparison with deterministic Hot/Cold Split fixtures while retaining the legacy chain pending live validation.
- Retired the legacy Hot/Cold Split oracle, validator, and migration test after deterministic fixtures and the unified suite passed live, completing Sprint 5.7 Package 005 and the migration away from all legacy comparison builders.
- Added deterministic Profit Trend fixtures covering unsorted cross-year months, repeated rows, sales revenue, purchase expense, purchase-only and revenue-only months, zero values, negative-expense refunds, and empty data.
- Replaced the unified suite's Profit Trend migration comparison with deterministic fixtures while retaining the legacy chain pending live validation.
- Retired the legacy Profit Trend oracle, validator, and migration test after deterministic fixtures and the unified suite passed live.
- Added deterministic Top Products fixtures covering aggregation, ranking, stable ties, top-ten truncation, zero values, purchase-only rows, and empty data.
- Retired the legacy Top Products oracle, validator, and migration test after deterministic fixtures and the unified suite passed live.
- Added deterministic Expense Breakdown fixtures covering category order, repeated purchases, zero and negative amounts, ignored rows, top expense, and empty data.
- Retired the legacy Expense Breakdown oracle, validator, and migration test after deterministic fixtures and the unified suite passed live.
- Added deterministic Revenue Trend fixtures covering complete filtered-period aggregation, cross-year ordering, current-period inclusion, zero-revenue inputs, and empty data.
- Retired the legacy Revenue Trend oracle, validator, and migration test after deterministic fixtures and the unified suite passed live.
- Retired the legacy Summary oracle, validator, and migration test after deterministic Summary fixtures and the unified suite passed live.
- Replaced the aggregate diagnostic's legacy Summary comparison with direct Aggregate Engine invariant checks.
- Completed the initial production-source audit, which retained migration oracles until deterministic replacement coverage was proven.
- Established `docs/RELEASE.md` as the authoritative release workflow, semantic-versioning policy, and release-checklist owner.
- Added consistent VS Code tasks for Tailwind build, clasp inventory, clasp push, and local preflight.

## 1.0.0 — Production — 2026-08-03

- Established `10.Config.js` as the authoritative release and version metadata source.
- Completed and froze the verified production source structure.
- Completed production hardening while preserving dashboard behavior and data contracts.

### Documentation and workflow foundation

- Defined current and target architecture.
- Added an exact 59-function source migration map.
- Documented development, testing, deployment, Git, decisions, troubleshooting, and reference parity.
- Added concise AI project context and task/review templates.

### Sprint 5.6 — backend refactor

- Migrated summary, revenue trend, expense breakdown, product analytics, profit trend, and Hot/Cold split to a single Aggregate Engine cache.
- Retained throwing legacy-equivalence validators.
- Completed live Apps Script validation for `getDashboardData()` and all six dedicated migration test entry points.
- Decomposed the backend into numbered data, analytics, intelligence, orchestration, and test owners.
- Renamed the web entry point and frontend to `100.Code.js` and `190.View.Index.html`.
- Froze the completed numbered source architecture after confirming unique function ownership and the final clasp inventory.
- Completed a successful clasp upload and live Apps Script validation for `getDashboardData()`, `testAggregate()`, and all six migration tests.
- Created and activated a new deployment version; the dashboard rendered successfully with no application runtime errors.
- Recorded the non-blocking Tailwind CDN production warning and Apps Script iframe sandbox warning as frontend technical debt.

### Sprint 5.5 — Dashboard Intelligence

- Completed the current dashboard intelligence outputs and frontend consumption contract.

## Known technical debt

- All legacy migration oracle chains are retired; the unified backend suite uses deterministic fixtures only.
- The Apps Script runtime emits an iframe sandbox warning.
