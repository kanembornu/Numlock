# NUMLOCK Roadmap

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

## Recommended next package

### Sprint 5.11 Package 001 — bounded client-render performance

Implement only the ready, compatibility-safe portion of P2-5: cache stable element references, avoid mutating response arrays during rendering, and defer below-the-fold sections until after the active executive view. This is the highest-value remaining P0/P1/P2 package that is not already complete or blocked on product requirements. Keep the public response contract unchanged and exclude payload projection until external consumers are inventoried. Validate render order, stale-response suppression, Chart instance counts, representative performance, and desktop/narrow browser behavior.

## Ongoing release obligations

- Keep `10.Config.js` and `docs/CHANGELOG.md` synchronized for every future release.
- Preserve the frozen numbered ownership model and Aggregate Engine production contract unless a separately approved change updates the governing documentation.
