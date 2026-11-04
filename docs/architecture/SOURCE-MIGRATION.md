# NUMLOCK Source Migration

## Scope and invariants

This record maps the 59 top-level functions formerly in `DashboardService.js` into the completed numbered flat-file architecture. The migration preserved function names, parameters, bodies, global visibility, formulas, response shapes, spreadsheet access, and Apps Script V8 compatibility.

The map is frozen as the historical decomposition record. It records the verified owners immediately after migration; later explicitly approved retirements are marked below and the current executable inventory is maintained in `RELEASE.md`.

The transitional `Code.js`, `DashboardService.js`, and `Index.html` files have been replaced by `100.Code.js`, the numbered backend files, and `190.View.Index.html`.

The historical table below retains the original `95.Tests.js` ownership recorded at decomposition time. Current tests are split by responsibility: `92.Tests.Fixtures.js` creates deterministic datasets, `94.Tests.Assertions.js` owns reusable assertions, `95.Tests.Validators.js` checks analytics invariants, `96.Tests.Cases.js` owns directly runnable Apps Script tests, and `98.Tests.Runner.js` owns the ordered unified 10-test suite. Every function from the former test monolith has exactly one current owner.

## Exact function map

Each former-monolith top-level function appears exactly once below.

| Target file | Function | Reason |
| --- | --- | --- |
| `20.Data.Source.js` | `getTransactionData(ss)` | Transaction sheet read. |
| `20.Data.Source.js` | `getPriceMap(ss)` | Helper-sheet price-map read. |
| `25.Data.Processor.js` | `processTransactions(transactions, priceMap)` | Raw-row normalization. |
| `30.Analytics.Aggregate.js` | `buildAggregate(data)` | Shared analytics source of truth. |
| `30.Analytics.Aggregate.js` | `buildSummaryFromAggregate(aggregate)` | Aggregate adapter. |
| `30.Analytics.Aggregate.js` | `buildRevenueTrendFromAggregate(aggregate)` | Aggregate adapter. |
| `30.Analytics.Aggregate.js` | `buildProfitTrendFromAggregate(aggregate)` | Aggregate adapter. |
| `30.Analytics.Aggregate.js` | `buildHotColdSplitFromAggregate(aggregate)` | Aggregate adapter. |
| `30.Analytics.Aggregate.js` | `buildTopProductsFromAggregate(aggregate)` | Aggregate adapter. |
| `30.Analytics.Aggregate.js` | `buildExpenseBreakdownFromAggregate(aggregate)` | Aggregate adapter. |
| `35.Analytics.Financial.js` | `buildFinancial(data)` | Financial Engine calculations. |
| `40.Analytics.Summary.js` | `buildSummary(data)` | Historical owner; retired after deterministic Summary fixture validation. |
| `40.Analytics.Summary.js` | `validateSummaryMigration(data)` | Historical owner; retired with the Summary oracle. |
| `45.Analytics.Trend.js` | `buildRevenueTrend(data)` | Historical owner; retired after deterministic Revenue Trend fixture validation. |
| `45.Analytics.Trend.js` | `validateRevenueTrendMigration(data)` | Historical owner; retired with the Revenue Trend oracle. |
| `45.Analytics.Trend.js` | `buildTrendEngine(cache)` | Cached trend response facade. |
| `45.Analytics.Trend.js` | `buildForecast(cache)` | Forecast from cached revenue trend. |
| `45.Analytics.Trend.js` | `buildProfitTrend(data)` | Historical owner; retired after deterministic Profit Trend fixture validation. |
| `45.Analytics.Trend.js` | `validateProfitTrendMigration(data)` | Historical owner; retired with the Profit Trend oracle. |
| `45.Analytics.Trend.js` | `buildHotColdSplit(data)` | Historical owner; retired after deterministic Hot/Cold Split fixture validation. |
| `45.Analytics.Trend.js` | `validateHotColdMigration(data)` | Historical owner; retired with the Hot/Cold Split oracle. |
| `50.Analytics.Product.js` | `buildTopProducts(data)` | Historical owner; retired after deterministic Top Products fixture validation. |
| `50.Analytics.Product.js` | `validateProductMigration(data)` | Historical owner; retired with the Top Products oracle. |
| `50.Analytics.Product.js` | `buildProductContribution(cache)` | Cached product contribution. |
| `50.Analytics.Product.js` | `buildRevenueConcentration(cache)` | Cached concentration calculation. |
| `50.Analytics.Product.js` | `buildParetoAnalysis(cache)` | Cached Pareto calculation. |
| `55.Analytics.Expense.js` | `buildExpenseIntelligence(cache)` | Cached expense intelligence. |
| `55.Analytics.Expense.js` | `buildExpenseBreakdown(data)` | Historical owner; retired after deterministic Expense Breakdown fixture validation. |
| `55.Analytics.Expense.js` | `validateExpenseBreakdownMigration(data)` | Historical owner; retired with the Expense Breakdown oracle. |
| `60.Intelligence.Revenue.js` | `buildRevenueIntelligence(cache)` | Revenue direction and momentum. |
| `60.Intelligence.Revenue.js` | `detectRevenueTrend(cache)` | Diagnosis-facing revenue detection. |
| `65.Intelligence.Profit.js` | `buildProfitIntelligence(cache)` | Profit-margin interpretation. |
| `70.Intelligence.Score.js` | `buildBusinessScore(cache)` | Business score. |
| `70.Intelligence.Score.js` | `buildGrowthScore(cache)` | Growth score. |
| `70.Intelligence.Score.js` | `buildKpiAchievement(cache)` | KPI achievement. |
| `70.Intelligence.Score.js` | `buildBusinessMaturity(cache)` | Maturity score. |
| `70.Intelligence.Score.js` | `buildKPIStatus(cache)` | KPI status. |
| `75.Intelligence.Diagnosis.js` | `buildInsights(cache)` | Cached summary/financial/expense insights. |
| `75.Intelligence.Diagnosis.js` | `buildDiagnosis(data, cache)` | Dashboard diagnosis composition. |
| `75.Intelligence.Diagnosis.js` | `detectCategoryDominance(cache)` | Cached Hot/Cold interpretation. |
| `80.Intelligence.Recommendation.js` | `buildRecommendationEngine(cache)` | Recommendations. |
| `80.Intelligence.Recommendation.js` | `buildPriorityAction(cache)` | Priority action. |
| `80.Intelligence.Recommendation.js` | `buildOpportunityEngine(cache)` | Opportunities. |
| `80.Intelligence.Recommendation.js` | `buildActionRoadmap(cache)` | Action roadmap. |
| `85.Intelligence.Decision.js` | `buildExecutiveSummary(cache)` | Executive summary. |
| `85.Intelligence.Decision.js` | `buildRiskEngine(cache)` | Risk assessment. |
| `85.Intelligence.Decision.js` | `buildBusinessFocus(cache)` | Business focus. |
| `85.Intelligence.Decision.js` | `buildExecutiveAlert(cache)` | Executive alert. |
| `90.Dashboard.Service.js` | `getDashboardData()` | Public response entry point. |
| `90.Dashboard.Service.js` | `buildRecentTransactions(data)` | Dashboard response projection. |
| `90.Dashboard.Service.js` | `buildAnalyticsCache(data)` | Single aggregate/cache orchestration. |
| `95.Tests.js` | `testAggregate()` | Manual aggregate test entry point. |
| `95.Tests.js` | `validateAggregate(data)` | Test-only aggregate invariant diagnostic helper. |
| `95.Tests.js` | `testSummaryMigration()` | Historical owner; retired after `testSummaryFixtures()` passed live. |
| `95.Tests.js` | `testRevenueTrendMigration()` | Historical owner; retired after `testRevenueTrendFixtures()` passed live. |
| `95.Tests.js` | `testProfitTrendMigration()` | Historical owner; retired after `testProfitTrendFixtures()` passed live. |
| `95.Tests.js` | `testHotColdMigration()` | Historical owner; retired after `testHotColdFixtures()` passed live. |
| `95.Tests.js` | `testProductMigration()` | Historical owner; retired after `testTopProductsFixtures()` passed live. |
| `95.Tests.js` | `testExpenseBreakdownMigration()` | Historical owner; retired after `testExpenseBreakdownFixtures()` passed live. |

`100.Code.js#doGet()` and `190.View.Index.html` are outside the 59-function former-monolith count.

## Shared constants and helpers

No top-level shared constants exist in the current source. Category names, sheet names, date formats, score thresholds, and display messages are inline behavioral literals. They must not be extracted into `10.Config.js` during a pure move because doing so would expand scope and risk behavior changes.

`10.Config.js` is therefore reserved until a separate, explicitly approved constant-extraction task identifies an immutable contract and proves equivalence. `00.Project.Spec.js` may contain comments only as specified; neither file should be created as an empty placeholder during incremental moves.

## Completed migration order

1. Add `00.Project.Spec.js` only with approved specification comments; defer `10.Config.js` until it has real immutable content.
2. Move spreadsheet reads to `20.Data.Source.js` and normalization to `25.Data.Processor.js`.
3. Move Aggregate Engine and adapters to `30.Analytics.Aggregate.js`.
4. Move financial and summary functions to `35.Analytics.Financial.js` and `40.Analytics.Summary.js`.
5. Move trend functions to `45.Analytics.Trend.js`.
6. Move product and expense functions to `50.Analytics.Product.js` and `55.Analytics.Expense.js`.
7. Move revenue, profit, scoring, diagnosis, recommendation, and decision functions in numeric order through `85.Intelligence.Decision.js`.
8. Move cache orchestration and response composition to `90.Dashboard.Service.js`.
9. Move manual test entry points to the historical `95.Tests.js`; they were later separated into the current `92`–`98` test ownership files without changing coverage.
10. Atomically renamed `Code.js` to `100.Code.js` and `Index.html` to `190.View.Index.html`, updating `doGet()` from `"Index"` to `"190.View.Index"` in the same change.
11. Removed the comment-only `DashboardService.js` after every global existed exactly once in numbered files.

At every step, update `.claspignore` in the same commit to allow the newly active production file while retaining files not yet migrated. Do not allow a new file before its functions are removed from the monolith, because duplicate global declarations can change runtime ownership.

## Validation after every move

- Compare the moved function’s name, parameter list, and normalized body with its pre-move source.
- Confirm every top-level global exists exactly once across clasp-tracked `.js` files.
- Run `node --check` on every changed JavaScript file.
- Run all six deterministic fixture tests with local Apps Script-compatible mocks.
- Run `getDashboardData()` with a local Apps Script-compatible mock.
- Run `git diff --check` and inspect `git status --short`.
- Before upload, verify `clasp status` contains exactly the intended transitional file set.
- When upload is explicitly authorized, run the relevant Apps Script migration tests plus `getDashboardData()`.
- Keep static, upload, runtime, deployment, and browser evidence separate.

## Rollback conditions

Stop and restore the last known-good file placement if any of the following occurs:

- a function is missing or declared more than once;
- a moved body, public name, parameters, or return shape differs;
- Apps Script reports a load-order, missing-global, or syntax error;
- any migration validator differs;
- `getDashboardData()` changes shape or value unexpectedly;
- `clasp status` contains an unexpected file;
- a live runtime test fails; or
- browser behavior changes after an explicitly authorized deployment.

Rollback must use the scoped task diff or an explicit inverse move. Do not use destructive broad resets when unrelated worktree changes exist.

## Completed commit sequence

1. **Commit 002 — data foundations:** add `00.Project.Spec.js`; move source and processor functions into `20` and `25`; update `.claspignore` explicitly.
2. **Commit 003 — core analytics:** move Aggregate, Financial, and Summary functions into `30`, `35`, and `40`; update `.claspignore`.
3. **Commit 004 — trend analytics:** move revenue/profit/Hot-Cold trend functions into `45`; update `.claspignore`.
4. **Commit 005 — product and expense analytics:** move functions into `50` and `55`; update `.claspignore`.
5. **Commit 006 — intelligence layers:** move functions into `60` through `85` in dependency order; update `.claspignore`.
6. **Commit 007 — dashboard and tests:** move response/cache functions into `90` and test entry points into `95`; update `.claspignore`.
7. **Entry point and view rename:** atomically moved `Code.js` to `100.Code.js`, moved `Index.html` to `190.View.Index.html`, updated the `HtmlService` filename literal, removed the comment-only monolith, and finalized `.claspignore`.

Each decomposition commit was independently validated locally. Final acceptance subsequently confirmed a successful clasp upload, `getDashboardData()`, `testAggregate()`, all six migration tests in Apps Script, a new deployment version, and successful dashboard rendering. No application runtime errors were found. Git actions and future external writes remain separately authorized operations.

All legacy comparison builders, validators, and migration test entry points were subsequently replaced by deterministic fixtures and retired after live validation. Aggregate Engine is now the sole production analytics source; source migration and Sprint 5.7 Package 005 are complete.

## Needs classification

None. All 59 decomposed top-level functions and `doGet()` have one production owner. The absence of a current immutable configuration symbol is a deferred file-population question, not an ambiguous function assignment.
