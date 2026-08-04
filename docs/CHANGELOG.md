# NUMLOCK Changelog

This document records verified engineering milestones. Semantic versioning begins at `1.0.0`; future releases must update this changelog and `10.Config.js` together.

## Unreleased

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
