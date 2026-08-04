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

## Ongoing release obligations

- Keep `10.Config.js` and `docs/CHANGELOG.md` synchronized for every future release.
- Preserve the frozen numbered ownership model and Aggregate Engine production contract unless a separately approved change updates the governing documentation.
