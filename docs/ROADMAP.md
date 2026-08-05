# NUMLOCK Roadmap

This document owns project direction, sequencing, and milestone placement. [Project Status](PROJECT_STATUS.md) owns the current executive status; [Product Backlog](PRODUCT-BACKLOG.md) owns remaining work and blockers. Completed-change detail belongs in [CHANGELOG.md](CHANGELOG.md).

## Completed

### Sprint 5.7 Package 003 — release and version metadata

Semantic versioning begins at `1.0.0`. `10.Config.js` is the authoritative release metadata source, and future releases must update it together with `docs/CHANGELOG.md`. The verified source structure and production hardening are complete.

### Sprint 5.7 Package 004 — release workflow and migration-oracle audit

The authoritative release workflow is documented in `docs/RELEASE.md`. Version `1.0.0` is in production, the unified backend runner requires `8/8`, and Tailwind is compiled locally into the clasp-tracked partial. The audit found no dead functions and no safe migration-oracle deletion: all six legacy builders still provide active equivalence coverage and require independent fixture-based regression replacements before retirement.

### Sprint 5.5 — Dashboard Intelligence

Dashboard Intelligence is complete. The dashboard response includes financial, trend, product, expense, scoring, diagnosis, recommendation, risk, and executive decision outputs consumed by the current frontend.

### Sprint 5.6 — Aggregate Engine migrations

The following production outputs have been migrated to the single Aggregate Engine cache while retaining legacy validation oracles:

- summary;
- revenue trend;
- expense breakdown;
- product analytics;
- profit trend; and
- Hot/Cold split.

Dedicated migration tests compare legacy and aggregate outputs. Live Apps Script validation has passed for:

- `getDashboardData()`
- `testAggregate()`
- `testSummaryMigration()`
- `testRevenueTrendMigration()`
- `testExpenseBreakdownMigration()`
- `testProductMigration()`
- `testProfitTrendMigration()`
- `testHotColdMigration()`

Future reports must continue to distinguish live runtime evidence from local mocks and uploads.

## Completed and frozen source-file decomposition

Sprint 5.6 source decomposition is complete and frozen as the verified production structure. All backend functions now live in their approved numbered owners, tests use the responsibility-split `92`–`98` files, `doGet()` lives in `100.Code.js`, and the frontend lives in `190.View.Index.html`. The transitional monolith and legacy filenames have been removed.

Final acceptance completed successfully:

- clasp upload;
- `getDashboardData()` and all seven backend test functions in Apps Script;
- creation and activation of a new deployment version; and
- deployed-dashboard rendering and application runtime verification.

No application runtime errors were found. At that acceptance point, the Tailwind CDN warning and Apps Script iframe sandbox warning were known and non-blocking; Package 001 subsequently removed the Tailwind CDN dependency, while the platform iframe warning remains accepted.

## Completed — Sprint 5.7 Package 001 production-safe styling

Tailwind `3.4.17` is pinned locally and compiles the utilities used by `190.View.Index.html` into the checked-in `189.View.Tailwind.html` Apps Script partial. The Tailwind CDN reference has been removed while Chart.js and Font Awesome remain separate CDN dependencies.

The generated artifact, explicit dynamic-class safelist, clasp inventory, live backend checks, and deployed-browser parity were validated. The Apps Script iframe sandbox warning remains accepted non-blocking platform output.

## Sprint 5.8 — product value, UX, and performance

Sprint 5.8 Package 001 completed a repository-evidence audit without changing production source, frontend behavior, GitHub Pages, or release metadata. The prioritized implementation backlog is maintained in [Product Backlog](PRODUCT-BACKLOG.md).

The next three bounded, independently releasable packages are:

1. **Package 002 — Empty-data resilience: complete and deployed.** Empty, sales-only, purchase-only, one-row, sparse mixed, and populated fixtures traverse the full dashboard response pipeline without non-finite values. Populated output and the public response shape are preserved.
2. **Package 003 — Dashboard date filter: complete and deployed.** Every row-derived dashboard output uses the same project-timezone date range, parameterless calls default to Current Year, custom ranges are validated and inclusive, Revenue Trend includes current-period data, and the visible scope is month-only text.
3. **Package 004 — Recoverable dashboard states: complete locally; upload and live/browser validation pending.** Loading, success, empty, error, and retry use one accessible state controller; empty uses scoped row count, retry preserves the exact request, and stale callbacks are ignored.

No later backlog item is scheduled by this roadmap. Date periods, targets, export, and drill-down remain requirement-gated.

## Sprint 5.9 — responsive dashboard shell

### Package 001 — responsive dashboard shell

Completed locally. The desktop shell remains fixed and unchanged at `lg` and above. Below `lg`, navigation uses an accessible overlay drawer with deterministic close, body-lock, and focus-restoration behavior; content uses full width, dense grids and filters wrap or stack, charts retain responsive height, and the transactions table scrolls within its own container. `testResponsiveShellContract()` raises the unified requirement to 12/12. Upload and live/browser acceptance remain separate evidence.

### Package 002 — data freshness and reporting scope

Completed locally. Additive `reportingScope` and `dataFreshness` metadata is derived from the already scoped rows using one captured request time and the Apps Script project timezone. The frontend shows only the active month range, scoped transaction count, latest transaction date, and Current/Stale/No Data status. Analytics formulas, date-filter semantics, dashboard states, and populated output remain unchanged. `testReportingMetadata()` raises the unified requirement to 13/13; upload and live/browser acceptance remain separate evidence.

### Package 003 — scoped data-quality diagnostics

Completed locally. Additive `dataQuality` metadata observes the active filtered rows for invalid dates, unknown transaction types, missing Sales products, missing Purchase categories, invalid Sales quantities, and invalid Purchase amounts. It changes no source row, filtering rule, or analytics formula. The responsive frontend shows status and issue count with a real-button label/count disclosure; internal codes remain hidden. `testDataQualityDiagnostics()` raises the unified requirement to 14/14; upload and live/browser acceptance remain separate evidence.

### Package 004 — source-level data-quality visibility

Completed locally. A pure inspection of the single raw transaction read preserves invalid-date findings before processing and date scoping, while all other issue types remain scoped and analytics continue to receive only valid scoped rows. Additive scope counts distinguish source rows, scoped rows, and excluded invalid-date rows; no raw value or row identity reaches the frontend. `testSourceDataQualityPipeline()` raises the unified requirement to 15/15; upload and live/browser acceptance remain separate evidence.

### Package 005 — chart comprehension and zero-data behavior

Completed locally. Revenue Trend, Hot/Cold Split, and Expense Breakdown retain their backend source values while adding unit-aware tooltips, `MM/YYYY` revenue labels, finite percentages, readable long expense labels, accessible text summaries, and chart-specific empty messages. Every transition destroys the prior Chart.js instance and clears stale canvas output; chart emptiness does not change dashboard-level state. `testChartPresentationContract()` raises the unified requirement to 16/16; upload and live/browser acceptance remain separate evidence.

### Package 006 — deterministic frontend dependencies

Completed locally. Tailwind remains locally compiled at 3.4.17, Chart.js is pinned to the verified 4.5.1 UMD artifact, and the eight actively used Font Awesome icons retain the exact 6.0.0 stylesheet. If Chart.js is unavailable, existing instances are destroyed, accessible summaries remain, each chart reports `Chart unavailable.`, one payload-free diagnostic is logged, and non-chart rendering continues. `testFrontendDependencyContract()` raises the unified requirement to 17/17; upload and live/browser acceptance remain separate evidence.

## Sprint 5.10 — complete

Sprint 5.10 is complete locally. Its five packages establish dashboard accessibility and keyboard semantics, executive presentation, truthful period comparison, one unified business priority, and centralized explainable KPI targets. The ordered unified gate now contains 22 checks and requires 22/22. This closure audit did not perform upload, Apps Script runtime, deployment, or browser acceptance; those evidence classes remain unverified.

### Package 001 — document, keyboard, announcement, and reduced-motion contract

Completed locally. The dashboard now owns document and landmark semantics, labeled date controls with associated live validation, semantic navigation/page visibility, named and scoped transaction-table markup, visible keyboard focus, bounded status announcements, and reduced-motion behavior for authored CSS and Chart.js. `testAccessibilityContract()` raises the ordered fail-fast unified requirement to 18/18. Upload, Apps Script runtime, and browser/assistive-technology acceptance remain separate evidence.

### Package 002 — executive dashboard polish

Completed locally. The dashboard now begins with one concise Executive Summary that answers performance, attention status, and next action before consistently spaced KPI cards. Visible terminology, heading hierarchy, badge capitalization, recommendation priority labels, card rhythm, and section gaps are standardized; repeated executive summary/priority/alert cards were consolidated without changing analytics, backend responses, accessibility, responsive behavior, colors, or animation. `testExecutivePresentationContract()` raises the ordered fail-fast unified requirement to 19/19. Upload, Apps Script runtime, and browser acceptance remain separate evidence.

### Package 003 — truthful period-over-period comparison

Completed locally. Additive `periodComparison` compares each active filter with its approved previous equivalent using the Apps Script project timezone and the same once-processed transaction array. Current Month and Current Year cap shorter calendar equivalents safely; Custom preserves equal inclusive duration. Finite one-decimal changes and Up/Down/Stable/No Comparison statuses retain signed profit/loss movement and explicit zero-baseline behavior. One compact accessible Executive Summary presentation leaves KPI values and existing analytics unchanged. `testPeriodComparison()` raises the ordered fail-fast unified requirement to 20/20. Upload, Apps Script runtime, and browser acceptance remain separate evidence.

### Package 004 — unified business priority

Completed locally. Additive `businessPriority` deterministically ranks existing Data Quality, profitability, risk, revenue, forecast, expense, product, and stability signals into one complete actionable result. Level and finite score ordering use fixed source precedence for ties; Critical Data Quality remains distinct from business performance. The Executive Summary primary-action card alone consumes the new result, while all existing intelligence fields and backend recommendation ordering remain unchanged. `testBusinessPriorityContract()` raises the ordered fail-fast unified requirement to 21/21. Upload, Apps Script runtime, and browser acceptance remain separate evidence.

### Package 005 — centralized and explainable KPI targets

Completed locally. Existing KPI and business-status thresholds now have one immutable configuration owner, while calculation mechanics remain with their domains. Additive `kpiTargets` explains the four existing KPI Achievement targets with explicit system provenance and no editing claim; a compact accessible disclosure appears in Business Performance outside the first viewport. `testKpiTargetContract()` raises the ordered fail-fast unified requirement to 22/22. Upload, Apps Script runtime, and browser acceptance remain separate evidence.

## Sprint 5.11 — complete

Sprint 5.11 is complete. Package 001 is committed at `46e42b1` and confirms stable DOM-reference caching, one bounded deferred phase, cancellation plus request-token stale protection, and frontend response-mutation safety. The latest verified gate is local 23/23 followed by a successful 26-file clasp upload; Apps Script runtime, deployment, and browser acceptance remain unverified.

### Sprint 5.11 Package 001 — bounded client-render performance

Completed and uploaded. Stable shell, control, skeleton, and state nodes are cached once while generated children remain uncached. The immediate render retains dashboard state, Executive Summary, KPI cards, reporting metadata, comparison, KPI-target context, Data Quality, and charts. One cancellable, request-token-guarded animation-frame phase renders detailed intelligence, recommendations, decision support, product detail, roadmap, and recent transactions exactly once. Response arrays are never sorted or mutated in place, public payloads and visible output remain unchanged, and `testClientRenderPerformanceContract()` raises the ordered fail-fast unified requirement to 23/23. API projection remains excluded pending an external-consumer inventory; Apps Script runtime and browser acceptance remain separate unverified evidence.

## Sprint 5.12 — complete

Sprint 5.12 is complete at verified commit `0e6dcdc`. Package 001 delivers the bounded print-ready filtered executive report, including print metadata, an authored A4 portrait contract, preserved accessible summaries and interaction semantics, and the ordered 24-test gate. The latest verified result is local 24/24. This documentation-only closure audit did not run clasp upload, Apps Script runtime, deployment, or browser print acceptance.

### Sprint 5.12 Package 001 — print-ready filtered executive report

Completed locally. One accessible Print Report action invokes browser-native print for the successfully rendered active period. A print-only header includes report title, active period, generated date, and unchanged NUMLOCK version; authored A4 portrait CSS retains current KPIs, Executive Summary, Business Priority, comparison, reporting metadata, freshness, Data Quality status, charts and summaries, and recommendations. Navigation, controls, skeletons, disclosures, inactive pages, and hidden content are excluded. `testPrintReportContract()` raises the ordered gate to 24/24 without analytics, backend response, CSV/PDF library, GitHub Pages, or release-version changes. Upload, Apps Script runtime, and browser print acceptance remain separate evidence.

## Sprint 5.13 — complete

Sprint 5.13 is complete. Package 001 CSV export and Package 002 formula-injection hardening passed live `testCsvExportContract()`, live `testClientRenderPerformanceContract()`, and live `runAllBackendTests()` 25/25 while preserving the 72-ID/two-selector query budget and no-response-mutation contract.

### Sprint 5.13 Package 001 — visible recent-transactions CSV export

Completed, committed at `563a7e4`, and uploaded. One native Export CSV action beside Print Report exports the current filter's already rendered recent-transaction rows and visible columns in displayed order. It creates a UTF-8 CSV with a header row and deterministic `NUMLOCK_Transactions_YYYYMMDD_HHmm.csv` filename through browser Blob/object-URL APIs, remains disabled without visible rows, and preserves the verified 72-ID/two-selector client-render budget without response mutation. No backend response, spreadsheet read/export, hidden field, expanded history, API, drill-down, persistence, GitHub Pages, generated CSS, or release metadata changed.

Package 001's original closure gaps were spreadsheet-formula neutralization and a missing post-fix unified 25/25 result. Package 002 closed the implementation and focused-coverage gap, and the subsequent live 25/25 gate closed Sprint 5.13 acceptance.

### Sprint 5.13 Package 002 — CSV formula-injection hardening and acceptance closure

Complete. Before CSV quoting, the serializer inserts one apostrophe before a first non-whitespace `=`, `+`, `-`, or `@`. It preserves normal text, dates, currency display, the numeric-column `-` placeholder, valid negative numeric values such as `-12500`, and already-neutralized values without adding a second apostrophe. Eight behavioral cases raise `testCsvExportContract()` to 14 scenarios while the runner remains at 25 entries and the client-render contract remains exactly 72 ID queries, two selector queries, and no response mutation. The package adds no data, permission, backend/API, spreadsheet, history, persistence, or layout scope. Live `testCsvExportContract()` and `testClientRenderPerformanceContract()` passed, followed by live `runAllBackendTests()` PASS 25/25.

## Sprint 5.14 — complete

### Sprint 5.14 Package 001 — bounded recent-transaction evidence

Complete at commit `fe6c424`, pushed to `origin/main`, with the Apps Script source upload current. Existing KPI and chart summaries open filtered evidence from only the active response's maximum ten `recentTransactions`; no backend/API/persistence behavior was added, and CSV export reads the visible filtered table. The focused four-scenario drill-down contract and local unified 25/25 gate were reconfirmed with the runner fixed at 25 entries. Apps Script runtime, deployment, and browser acceptance were not performed during closure.

## Sprint 5.15 — complete

### Sprint 5.15 Package 001 — dashboard external-consumer inventory

Complete as a documentation/discovery sprint. The inventory is committed at `e373b9a`. [`DASHBOARD-CONSUMER-INVENTORY.md`](DASHBOARD-CONSUMER-INVENTORY.md) classifies the production frontend, test-only, documentation/example, and unknown/external consumers; inventories all 37 top-level response fields exactly once; and records ownership, permission, privacy, compatibility, projection, evidence, and rollback constraints. Thirty-one fields are consumed by the current view and six are opt-in projection candidates that remain contract-tested. Unknown external callers and deployment permission evidence cannot be resolved from Git, and permission review is incomplete, so API projection is not implementation-ready and the default full response must remain unchanged.

## Sprint 5.16 Package 001 — complete sparse response contract

Complete and uploaded. The sparse required-property oracle now covers exactly all 37 top-level dashboard response fields and structurally requires `dateFilter.filter`, `startDate`, `endDate`, `label`, and `rowCount`. Existing additive metadata checks, production behavior, response shape, targeted test entry points, and the ordered 25-entry runner remain unchanged. Focused local validation passed seven fixtures and the unified local gate passed 25/25; Apps Script runtime, deployment, and browser acceptance remain unverified.

## v1.0 release closeout — complete

NUMLOCK is **Feature Complete v1.0** as of 2026-08-05. Candidate `658f4ab1011633e86634f14ce838a514c5205df0` passed live 25/25, immutable deployment version 185, deployed-browser acceptance, and production-health acceptance at the unchanged stable URL. Immutable version 184 remains the rollback target.

Feature development is paused. Maintenance and demand-driven enhancements may proceed only through separately approved bounded work. Editable KPI targets, dashboard payload projection, and drill-down expansion remain optional requirement-gated work and do not block v1.0. **UI/UX 2.0 discovery** is the next planned phase, outside the v1.0 baseline and subject to separate authorization.

## Ongoing release obligations

- Keep `10.Config.js` and `docs/CHANGELOG.md` synchronized for every future release.
- Preserve the frozen numbered ownership model and Aggregate Engine production contract unless a separately approved change updates the governing documentation.

## UI/UX 2.0 — discovery

### Package 001 — information architecture and navigation strategy

Complete as documentation-only discovery. [UI/UX 2.0 Information Architecture](UIUX-2.0-INFORMATION-ARCHITECTURE.md) inventories the complete v1.0 user-facing capability set, compares the required two-, three-, and four-destination models, and selects Dashboard plus Transactions as the authoritative immediate menu. Reports remains contextual through Dashboard print and Transactions CSV; Settings remains deferred because no editable configuration or approved persistence/permission contract exists. No mockup, production source, Tailwind, API, data, deployment, or release behavior changed.

### Package 002 — low-fidelity wireframes

Complete as documentation-only discovery. [UI/UX 2.0 Low-Fidelity Wireframes](UIUX-2.0-WIREFRAMES.md) defines the approved Dashboard and Transactions destinations at desktop and mobile widths, including explicit content order, responsive behavior, interactions, accessibility, states, omissions, bounded drill-down, Dashboard Print, and Transactions CSV placement. It compares Executive-first and Analytical-first Dashboard layouts and recommends Executive-first for later high-fidelity mockups. Every block maps to current v1.0 capability IDs `V01`–`V35`; no Reports or Settings page, blocked capability, production source, Tailwind, API, data, clasp, deployment, or release behavior changed.

### Package 003 — visual direction system

Complete as documentation-only discovery. [UI/UX 2.0 Visual Direction System](UIUX-2.0-VISUAL-DIRECTIONS.md) defines exactly four Executive-first directions—Executive Minimal, Modern Financial, Analytical Workspace, and Operational Cockpit—against the approved v1.0 capability and responsive/accessibility contracts. A weighted decision matrix selects Executive Minimal as primary and Modern Financial as alternate; a controlled hybrid may combine only the primary's restrained hierarchy with the alternate's numeric, table, and chart precision. Preliminary token systems are recorded for both shortlisted directions. No production source, Tailwind, production HTML, dependency, API, data, clasp, deployment, or release behavior changed.

### Package 004 — component library and theme contract

Complete as documentation-only design definition. [UI/UX 2.0 Component Library and Theme Contract](UIUX-2.0-COMPONENT-LIBRARY.md) adopts the bounded Executive Minimal/Modern Financial hybrid; defines the one-viewport desktop shell, tab ownership, complete light/dark tokens, typography, geometry, visualization, state, and accessibility contracts; and approves Dashboard, Transactions, Settings, and Logs as primary destinations. Settings is bounded to Appearance/About, Logs is initially sanitized and session-local, and future financial modules remain absent until usable. No production source, Tailwind, mockup/image, API, data, clasp, deployment, or release behavior changed.

The next UI/UX 2.0 package may implement the shell and theme foundation as the first independently approved slice. Later packages follow the nine-slice sequence in Package 004. Visual and interaction completion requires deployed-browser acceptance and cannot be inferred from documentation or static checks.

### Package 005 — application shell and theme foundation

Implemented and uploaded. The bounded production delta adds the approved 240px/72px viewport-height sidebar, 64px utility bar, four primary destinations, Appearance/About Settings, sanitized session-local Logs, and exact Light/Dark/System theme foundation with validated browser-local persistence, pre-render resolution, Chart.js synchronization, and print-light behavior. Existing Dashboard and Transactions content, requests, response fields, filters, states, retry/stale protection, drill-down, CSV, print, Data Quality, and deferred rendering remain intact. The current local gate is 26/26 with 71 ID queries and two document selectors; the exact 26-file clasp inventory was uploaded. Apps Script runtime and deployed-browser acceptance remain pending.

Package 006 may implement the approved Dashboard tab framework only after separate authorization. Package 005 intentionally does not migrate dashboard content into tabs.

### Package 006 — Dashboard tab framework

Implemented and uploaded. Overview, Performance, Analytics, Intelligence, and Planning now form one accessible tablist with exactly one visible panel, automatic Left/Right/Home/End activation, native hidden-panel focus exclusion, and selected-tab persistence across refresh, retry, theme, and sidebar operations. Fourteen existing Dashboard regions move once into their approved owners without duplicating content or changing card/chart markup. Tab switching performs no backend request; print reveals all panels, and chart instances resize rather than rebuild. The local gate passes 27/27 with 71 ID queries, two document selectors, one deferred phase, and no response mutation; the exact 26-file clasp inventory was uploaded. Apps Script runtime and deployed-browser acceptance remain pending.

Package 007 may refine the Overview density and measurable first-viewport composition only after separate authorization. Transactions tabs remain deferred to their approved package.
