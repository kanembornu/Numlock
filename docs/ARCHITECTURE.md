# NUMLOCK Architecture

## Current architecture

NUMLOCK is a Google Apps Script V8 web application backed by Google Sheets. Its server implementation uses the completed numbered source layout:

This layout is frozen as the production ownership model after successful clasp upload, live backend tests, deployment, and dashboard rendering verification. No application runtime errors were found during final acceptance.

```text
Google Sheets
  -> getTransactionData() / getPriceMap()
  -> processTransactions()
  -> buildAggregate()
  -> aggregate-based analytics adapters
  -> cached intelligence and decisions
  -> getDashboardData()
  -> google.script.run
  -> 190.View.Index.html
```

`100.Code.js#doGet()` evaluates `190.View.Index.html`. The browser calls the public server function `getDashboardData()` in `90.Dashboard.Service.js`, which returns a serializable dashboard response. Migration test entry points live in `95.Tests.js` and remain global because Apps Script editor execution requires global functions; they are not browser APIs.

## Aggregate Engine

`buildAggregate(data)` is the analytics source of truth for the migrated domains:

- summary;
- revenue trend;
- expense breakdown;
- top products;
- profit trend; and
- Hot/Cold split.

`buildAnalyticsCache(data)` constructs the aggregate exactly once. Production adapters derive those six outputs from `cache.aggregate`; legacy builders remain only as validation oracles. Higher intelligence layers consume cached outputs and must not rebuild migrated analytics from raw rows.

## Numbered architecture

| File | Ownership |
| --- | --- |
| `00.Project.Spec.js` | Project metadata, architecture map, and source-level specification comments only. |
| `10.Config.js` | Shared immutable configuration and constants. No current top-level constant is approved for extraction yet. |
| `20.Data.Source.js` | Spreadsheet reads. |
| `25.Data.Processor.js` | Transaction normalization. |
| `30.Analytics.Aggregate.js` | Aggregate construction and aggregate adapters. |
| `35.Analytics.Financial.js` | Financial calculations. |
| `40.Analytics.Summary.js` | Legacy summary oracle and summary migration validation. |
| `45.Analytics.Trend.js` | Revenue/profit trends, forecast, Hot/Cold split, trend cache facade, and migration validation. |
| `50.Analytics.Product.js` | Product ranking, contribution, concentration, Pareto, and product migration validation. |
| `55.Analytics.Expense.js` | Expense breakdown, expense intelligence, and migration validation. |
| `60.Intelligence.Revenue.js` | Revenue intelligence and revenue-direction detection. |
| `65.Intelligence.Profit.js` | Profit intelligence. |
| `70.Intelligence.Score.js` | Business, growth, KPI, and maturity scores. |
| `75.Intelligence.Diagnosis.js` | Insights, diagnosis, and category dominance. |
| `80.Intelligence.Recommendation.js` | Recommendations, opportunities, priorities, and action roadmap. |
| `85.Intelligence.Decision.js` | Risk, business focus, executive alert, and executive summary. |
| `90.Dashboard.Service.js` | Aggregate-cache orchestration and public dashboard response composition. |
| `95.Tests.js` | Manual migration/backend test entry points and their test-only diagnostics. |
| `100.Code.js` | Web entry points such as `doGet()`. |
| `190.View.Index.html` | Dashboard HTML and browser runtime. |
| `appsscript.json` | Apps Script manifest. |

Numeric filenames communicate ownership and give a dependency-safe Apps Script load order. No file may perform eager cross-file initialization; global function declarations must remain callable regardless of Apps Script source enumeration details.

## Dependency direction

```text
100.Code / 190.View
        -> 90.Dashboard.Service
        -> 75/80/85 Intelligence composition
        -> 60/65/70 Intelligence calculations
        -> 40/45/50/55 Analytics domains
        -> 30.Analytics.Aggregate + 35.Analytics.Financial
        -> 25.Data.Processor
        -> 20.Data.Source
        -> Google Sheets / Apps Script services

95.Tests -> the layer under test
00.Project.Spec and 10.Config -> may be read downward; never depend on higher layers
```

Dependencies flow toward data and foundational analytics. Lower-numbered data/analytics files must not call dashboard or decision layers. Cache-consuming functions may accept the plain cache object but must not call `buildAnalyticsCache()` themselves. Tests may depend on production layers; production code must never call tests or legacy validation entry points. This direction has no required circular symbol dependency.

## Public entry points

- `doGet()` — web-app HTTP entry point.
- `getDashboardData()` — browser-callable, read-only dashboard-data API.
- `testAggregate()` — manual aggregate diagnostic.
- `testSummaryMigration()`
- `testRevenueTrendMigration()`
- `testExpenseBreakdownMigration()`
- `testProductMigration()`
- `testProfitTrendMigration()`
- `testHotColdMigration()`

The migration test functions are editor-run validation entry points, not UI endpoints. Helper functions requiring parameters are internal even though Apps Script exposes global declarations in the editor.

## Architecture constraints

- Preserve the public `getDashboardData()` response shape.
- Build Aggregate Engine once per dashboard request.
- Production code must not call legacy migration oracles.
- Spreadsheet reads belong in `20.Data.Source.js`; normalized-row construction belongs in `25.Data.Processor.js`.
- Analytics functions must not render HTML or mutate spreadsheet data.
- Intelligence layers read cached analytics and do not rescan raw transactions unless their documented domain has not yet migrated.
- `90.Dashboard.Service.js` composes; it does not own formulas.
- The frontend remains isolated from spreadsheet access and internal test functions.
