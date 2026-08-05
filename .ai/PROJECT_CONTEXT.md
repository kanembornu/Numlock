# NUMLOCK Project Context

Read `AGENTS.md` first; it is the operating contract. This file provides continuity, not authorization.

## Project

NUMLOCK is a Google Apps Script V8 and Google Sheets business-intelligence dashboard for coffee-shop transactions. `100.Code.js#doGet()` serves `190.View.Index.html`; the browser calls `getDashboardData()` in `90.Dashboard.Service.js`.

## Current state

- Sprint 5.5 Dashboard Intelligence: complete.
- Sprint 5.6 backend refactor: complete.
- Aggregate migrations validated live: summary, revenue trend, expense breakdown, products, profit trend, and Hot/Cold split.
- Numbered source decomposition: complete and frozen as the verified production structure.
- Production hardening: complete.
- Semantic versioning begins at 1.0.0; `10.Config.js` is the authoritative release metadata source.
- Version 1.0.0 is currently in production; `docs/RELEASE.md` owns the release workflow.
- Tailwind 3.4.17 is compiled locally into the clasp-tracked HTML partial.
- `runAllBackendTests()` is the unified local/live backend gate and requires 25/25 PASS, including the CSV-export, print-report, client-render performance, KPI target, unified business priority, period comparison, executive presentation, sparse-dataset resilience, date filtering, dashboard-state metadata, accessibility, responsive-shell, chart-presentation, and frontend-dependency contracts, reporting metadata, scoped data-quality diagnostics, and source invalid-date visibility.
- Final validation completed: clasp upload, all backend test entry points, a new deployment version, and deployed-dashboard rendering passed without application runtime errors.
- Sprint 5.8 Package 001 product audit is complete. `docs/PRODUCT-BACKLOG.md` is the prioritized evidence inventory; `docs/ROADMAP.md` schedules only Packages 002–004.
- Sprint 5.8 Package 002 empty/sparse-data resilience and Package 003 date filtering are deployed. Populated response output remains snapshot-protected.
- Backend tests are responsibility-split across `92.Tests.Fixtures.js`, `94.Tests.Assertions.js`, `95.Tests.Validators.js`, `96.Tests.Cases.js`, and `98.Tests.Runner.js`; the sparse test explicitly logs its returned success summary for Apps Script execution visibility.
- Sprint 5.8 Package 003 implements one project-timezone date filter for every row-derived dashboard output. The parameterless default is `currentYear`; custom ranges require valid inclusive `YYYY-MM-DD` boundaries in start-to-end order. Revenue Trend includes every represented month in the filtered rows, including current partial-month revenue, while its visible scope uses month-only `MM/YYYY` formatting.
- Sprint 5.8 Package 004 adds an authoritative loading/success/empty/error/retry frontend state contract. Additive `dateFilter.rowCount` metadata defines empty as zero scoped transaction rows; retry preserves the exact last request, and stale callbacks are ignored.
- Sprint 5.9 Package 001 preserves the fixed desktop sidebar at `lg` and above while using an accessible overlay drawer, full-width content, stacked dense regions, responsive chart sizing, and an explicitly horizontally scrollable transactions table below `lg`.
- Sprint 5.9 Package 002 adds scoped reporting counts, earliest/latest dates, partial-period semantics, generated/latest timestamps, project-timezone freshness status, and a compact frontend reporting summary without changing analytics outputs.
- Sprint 5.9 Package 003 adds observational `dataQuality` diagnostics over the active filtered rows. It reports six fixed issue types with Good/Attention/Critical status and a compact accessible disclosure; it never changes, removes, repairs, or writes transaction data.
- Sprint 5.9 Package 004 inspects invalid dates once from the raw transaction read before processing and date scoping, then combines those source-only findings with the existing scoped diagnostics. Analytics still receive only valid scoped rows; no raw value or source-row identity is returned to the browser.
- Sprint 5.9 Package 005 gives Revenue, Hot/Cold, and Expense charts explicit per-chart empty states, accessible text summaries, unit-aware tooltips, `MM/YYYY` revenue labels, and safe instance destruction without changing analytics formulas, source values, response fields, or dashboard-level state semantics.
- Sprint 5.9 Package 006 retains locally compiled Tailwind 3.4.17, pins Chart.js to 4.5.1 and Font Awesome to 6.0.0, and makes Chart.js failure non-blocking: chart summaries remain, each chart says `Chart unavailable.`, one payload-free diagnostic is logged, and non-chart rendering continues.
- Sprint 5.10 Package 001 completes dashboard accessibility ownership: document/landmark and table semantics, labeled and validated date controls, keyboard-visible focus, hidden-content focus exclusion, bounded live announcements, and CSS/Chart.js reduced-motion behavior.
- Sprint 5.10 Package 002 places a concise Executive Summary before KPIs, standardizes visible dashboard terminology and badge capitalization, removes repeated executive message cards, tightens whitespace, and presents recommendations as prioritized actions without changing analytics, response fields, accessibility, or responsive behavior.
- Sprint 5.10 Package 003 adds additive `periodComparison` metrics for all six date filters. Current and previous rows come from the same once-processed transaction array; zero baselines, signed profit movement, shorter months, leap years, and unavailable comparisons have explicit finite semantics. The Executive Summary renders the comparison once without changing KPI values.
- Sprint 5.10 Package 004 adds one authoritative `businessPriority` selected from existing cached intelligence, Data Quality, and comparison evidence. Explicit precedence, score ordering, and fixed source tie-breaking produce one executable next action while every prior intelligence field and recommendation order remains backward compatible.
- Sprint 5.10 Package 005 centralizes existing KPI and business-status thresholds in immutable `KPI_TARGET_CONFIG`, exposes four system-defined KPI targets as additive `kpiTargets`, and adds a compact Business Performance disclosure. Existing calculations, classifications, recommendation logic, and target values remain unchanged.
- Sprint 5.10 is complete locally: accessibility and keyboard semantics, executive dashboard presentation, period comparison, unified business priority, and centralized explainable KPI targets are all implemented and covered by the ordered 22-test gate. The current runner requires 22/22; this closure audit did not rerun Apps Script or browser acceptance, so upload, live runtime, and deployed-browser status remain unverified.
- Sprint 5.11 Package 001 completes and uploads the bounded, frontend-only portion of P2-5: stable shell/control/state DOM references are cached once, response collections are consumed without in-place mutation, and one request-token-guarded animation-frame phase renders lower-priority detail after the immediate Executive Summary, KPIs, reporting metadata, comparison, targets, data quality, and charts. API projection remains excluded until external consumers are inventoried; Apps Script runtime and browser acceptance remain unverified.
- Sprint 5.11 is complete. Package 001 is committed at `46e42b1`; the ordered runner contains 23 entries and the latest verified gate is local 23/23 plus a successful 26-file clasp upload. Live Apps Script execution, deployment, and browser acceptance were not performed.
- Sprint 5.12 Package 001 is complete locally. One accessible Print Report action uses browser print for the active dashboard period; authored A4 portrait CSS retains visible executive content and chart summaries while excluding navigation, controls, skeletons, disclosures, and hidden pages. No analytics, backend response, release version, CSV/PDF library, or GitHub Pages content changed. `testPrintReportContract()` raises the ordered gate to 24/24; upload, live Apps Script, and browser print acceptance remain separate evidence.
- Sprint 5.12 is complete at verified commit `0e6dcdc`. The worktree was clean and local `main`, `origin/main`, and HEAD matched during the closure audit. The current ordered runner contains 24 entries and retains the latest verified local 24/24 gate; no clasp upload, Apps Script runtime, deployment, or browser print acceptance was performed during closure.
- Sprint 5.13 Package 001 is committed at `563a7e4` and uploaded. One accessible Export CSV action downloads UTF-8 CSV through the browser Blob path using only the current filter's already rendered recent-transaction rows and visible table columns in displayed order; the stable DOM-query budget remains 72 ID queries and two selector queries with no response mutation.
- Sprint 5.13 is complete. Package 001 CSV export and Package 002 formula-injection hardening passed live acceptance: `testCsvExportContract()` PASS, `testClientRenderPerformanceContract()` PASS, and `runAllBackendTests()` PASS 25/25. The accepted contracts preserve the UTF-8 BOM, five visible columns, ordering, filename, Blob download, accessibility, no response mutation, and the 72-ID/two-selector query budget.
- Sprint 5.14 is complete at commit `fe6c424`, with local `main`, `origin/main`, and HEAD aligned and the Apps Script source upload confirmed current. Package 001 filters only the active response's maximum ten `recentTransactions`, adds no backend/API or persistence behavior, and leaves CSV export bound to visible drill-down table rows. `testInteractiveDrilldownContract()` PASS and local `runAllBackendTests()` PASS 25/25 were reconfirmed; Apps Script runtime and deployed-browser acceptance remain unverified.
- The single recommended next package is Sprint 5.15 Package 001: a documentation-only external-consumer inventory for the requirement-gated dashboard API projection. It must not change payloads or production behavior.

## Architecture and invariants

`buildAnalyticsCache()` builds Aggregate Engine once. Aggregate Engine is the sole production analytics source for Summary, Revenue Trend, Expense Breakdown, Top Products, Profit Trend, and Hot/Cold Split. Deterministic fixtures are authoritative for all six domains, and no legacy migration oracle remains. Preserve the `getDashboardData()` response, Apps Script globals, formulas, spreadsheet reads, case-sensitive categories, date behavior, and frontend contract.

All source uses the numbered ownership layout documented in `docs/ARCHITECTURE.md`; all 59 former-monolith function assignments are recorded in `docs/SOURCE-MIGRATION.md`.

## Workflow

Use VS Code and scoped Git diffs locally. Before an authorized upload, confirm the clasp account and `clasp status`; use force only when explicitly required. Run live functions in the Apps Script editor. Deployment and browser verification are separate approved steps.

Safe live entry points and known failure modes are documented in `docs/TESTING.md` and `docs/TROUBLESHOOTING.md`.

## Technical debt

- All six legacy migration oracle chains are retired. The unified backend suite uses deterministic fixtures only, source migration is complete, and Sprint 5.7 Package 005 is complete.
- The former nonfunctional transaction-type control has been replaced by the authoritative dashboard date filter; transaction-type filtering is intentionally not implemented.
- Unified actionable recommendations and explainable system-defined KPI targets are complete. Target editing remains intentionally unsupported because persistence, governance, and validation requirements have not been approved.
- Root `index.html` is a separate GitHub Pages redirect/launcher to the Apps Script UI, not a duplicate dashboard.
- Future releases must update `10.Config.js` and `docs/CHANGELOG.md` together.
- The Apps Script iframe emits its platform sandbox warning.

The iframe sandbox warning is known and non-blocking. It does not authorize frontend changes.
