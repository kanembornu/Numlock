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

Dedicated migration tests compare legacy and aggregate outputs. The task context records successful live Apps Script runs for `getDashboardData()` and all six dedicated migration tests; future reports must continue to distinguish that runtime evidence from local mocks and uploads.

## In progress

Sprint 5.6 backend refactoring remains in progress. The monolithic `DashboardService.js` still owns unrelated data, analytics, intelligence, orchestration, and test functions. Documentation and the migration blueprint are the current structural-refactor deliverable.

## Next phase — source-file decomposition

Move functions incrementally into the approved numbered flat-file architecture described in [Source Migration](SOURCE-MIGRATION.md). Each move must preserve function bodies and public globals, update `.claspignore` deliberately, pass local checks, upload only with explicit authorization, and pass the relevant live Apps Script tests before the next slice.

## Later work

- Complete source decomposition and final entry-point/frontend renames.
- Remove legacy migration builders only in a separately approved cleanup after live equivalence remains proven in the decomposed layout.
- Add release/deployment procedures only when a deployment task is explicitly approved.
- Select product or UI enhancements from verified business needs; this roadmap promises no unapproved feature work.
