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

1. **Package 002 — Empty-data resilience: complete locally; upload and live validation pending.** Empty, sales-only, purchase-only, one-row, sparse mixed, and populated fixtures traverse the full dashboard response pipeline without non-finite values. Populated output and the public response shape are preserved.
2. **Package 003 — Dashboard date filter: complete locally; upload and live validation pending.** Every row-derived dashboard output uses the same project-timezone date range, parameterless calls default to Current Year, custom ranges are validated and inclusive, Revenue Trend includes current-period data, and the visible scope is month-only text.
3. **Package 004 — Recoverable dashboard states:** replace indefinite loading with visible, accessible success, empty, failure, and retry states.

No later backlog item is scheduled by this roadmap. Date periods, targets, export, and drill-down remain requirement-gated.

## Ongoing release obligations

- Keep `10.Config.js` and `docs/CHANGELOG.md` synchronized for every future release.
- Preserve the frozen numbered ownership model and Aggregate Engine production contract unless a separately approved change updates the governing documentation.
