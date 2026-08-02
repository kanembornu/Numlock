# NUMLOCK Roadmap

## Completed

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

Sprint 5.6 source decomposition is complete and frozen as the verified production structure. All backend functions now live in their approved numbered owners, tests live in `95.Tests.js`, `doGet()` lives in `100.Code.js`, and the frontend lives in `190.View.Index.html`. The transitional monolith and legacy filenames have been removed.

Final acceptance completed successfully:

- clasp upload;
- `getDashboardData()` and all seven backend test functions in Apps Script;
- creation and activation of a new deployment version; and
- deployed-dashboard rendering and application runtime verification.

No application runtime errors were found. The Tailwind CDN production warning and Apps Script iframe sandbox warning remain known, non-blocking frontend technical debt.

## Planned — Sprint 5.7 Package 001 production-safe styling

The audit is complete; implementation is intentionally deferred. Replace the Tailwind Play CDN with a pinned local Tailwind CLI build whose minified output is checked in as an Apps Script HTML partial. Preserve `190.View.Index.html` behavior, its inline custom CSS, all responsive and arbitrary-value utilities, and all JavaScript-selected state classes. Keep Chart.js and Font Awesome CDN usage unchanged; they are separate dependencies and outside this package.

Implementation acceptance requires deterministic build output, an explicit dynamic-class safelist, a clean clasp inventory containing the generated partial, source-level confirmation that the Tailwind CDN reference is gone, successful live backend checks, and deployed-browser visual and console verification. The Apps Script iframe sandbox warning remains out of scope.

## Later work

- Remove legacy migration builders only in a separately approved cleanup after live equivalence remains proven in the decomposed layout.
- Evolve release/version metadata only through a separately approved task.
- Select product or UI enhancements from verified business needs; this roadmap promises no unapproved feature work.
