# NUMLOCK Testing

## Evidence levels

Report each level separately:

1. **Static/local:** syntax checks, source contracts, deterministic Codex mocks, migration comparisons, diffs, and Git status.
2. **Upload:** `clasp status` plus a successful `clasp push`; upload is not runtime execution.
3. **Apps Script runtime:** a named function actually completes in the configured NUMLOCK script project.
4. **Deployment:** an Apps Script version/deployment is created or updated.
5. **Browser:** the deployed dashboard is exercised and the browser console is checked.

Never infer a later evidence level from an earlier one.

## Local Codex mocks

Local validation may load the numbered server files into a Node `vm` context with bounded mocks for `SpreadsheetApp`, `Utilities`, `Session`, and `Logger`. Fixtures should cover normal data, empty data, ties, current-month filtering, purchase-only months, zero/negative expenses, product truncation, and case-sensitive Hot/Cold categories.

Mocks validate JavaScript execution and deterministic contracts; they do not prove Google authorization, live spreadsheet shape, Apps Script service behavior, or deployed-browser behavior. Run `node --check` on extracted JavaScript source, not on HTML without first extracting its scripts.

## Safe direct Apps Script runs

These functions are read-only with respect to spreadsheet data and are safe to run deliberately in the Apps Script editor:

- `runAllBackendTests()` — primary live backend validation entry point; runs the complete suite once in the documented order and stops on the first failure.
- `testSparseDatasetResilience()` — seven deterministic end-to-end dashboard-response fixtures covering empty, sales-only, purchase-only, one-row, sparse mixed, and populated data.
- `testDashboardDateFilter()` — 58 deterministic assertions covering normalization, preset/custom ranges, inclusivity, invalid inputs/dates, immutability, response equivalence, Revenue Trend scope/order, finite values, and empty results.
- `testPeriodComparison()` — 23 deterministic scenarios covering all six previous-equivalent ranges, shorter months, leap years, equal inclusive duration, empty and zero baselines, signed profit/loss transitions, finite rounding, immutability, one-read/one-process architecture, and accessible frontend statuses.
- `testBusinessPriorityContract()` — 20 deterministic scenarios covering every precedence branch, empty fallback, score/source tie-breaking, finite bounds, complete evidence, deterministic repeats, non-mutation, one authoritative response, first-viewport uniqueness, and preserved responsive/accessibility contracts.
- `testDashboardStateContract()` — five deterministic contract scenarios covering the state vocabulary plus empty, purchase-only, sales-only, and populated scoped-row semantics.
- `testAccessibilityContract()` — 22 deterministic/static scenarios covering document/landmark, form/validation, navigation, table, live-region, focus, keyboard, hidden-content, and reduced-motion contracts.
- `testExecutivePresentationContract()` — seven deterministic/static scenarios covering section order, first-position Executive Summary, heading and badge consistency, recommendation priority order, non-duplicated executive messages, responsive hierarchy, and preserved accessibility.
- `testPrintReportContract()` — 13 static scenarios covering the accessible Print Report button, single handler and `window.print()` call, print-only title/period/generated/version metadata, included executive sections and chart summaries, excluded controls/hidden pages, A4 layout, overflow/card-break protection, frontend-only scope, and preserved accessibility/responsive contracts.
- `testCsvExportContract()` — 14 static/behavioral scenarios covering the accessible Export CSV action, filename, header, visible row/column scope, displayed ordering, empty-state disabling, UTF-8 output, quote escaping, formula-prefix neutralization, numeric-value preservation, hidden-field exclusion, browser Blob download, and preserved accessibility/responsive contracts.
- `testClientRenderPerformanceContract()` — seven static contract scenarios covering stable DOM caching, reduced repeated queries, immediate first-visible rendering, one deferred phase, stale-work cancellation/guarding, response immutability, preserved output containers, and retained accessibility/state contracts.
- `testResponsiveShellContract()` — 12 source-contract scenarios covering the `lg` desktop boundary, drawer controls and accessibility, close paths, scroll lock, focus restoration, active navigation, table containment, and single controller initialization.
- `testChartPresentationContract()` — 16 deterministic/static scenarios covering chart source values, formatting, empty transitions, safe percentages, accessible summaries, instance lifecycle, and responsive containment.
- `testFrontendDependencyContract()` — 14 deterministic/static scenarios covering exact versions, unique HTTPS URLs, no floating dependencies, retained Font Awesome usage, Chart.js availability/fallback, summaries, diagnostics, and preserved chart/responsive contracts.
- `testReportingMetadata()` — deterministic scoped-row counts, earliest/latest dates, invalid-date handling, Current/Stale/No Data freshness, partial/complete period boundaries, project timezone, response presence, finite values, and frontend disclosure checks.
- `testDataQualityDiagnostics()` — 15 deterministic scenarios covering all six issues, Good/Attention/Critical status, multiple issues per row, mixed validity, scoped response output, source immutability, raw numeric provenance, and the accessible frontend disclosure contract.
- `getDashboardData()`
- `testSummaryFixtures()` — deterministic Summary regression fixtures with literal expected outputs.
- `testRevenueTrendFixtures()` — deterministic Revenue Trend fixtures with literal completed-month labels and values.
- `testExpenseBreakdownFixtures()` — deterministic ordered Expense Breakdown fixtures with literal amounts and top expense.
- `testTopProductsFixtures()` — deterministic Top Products fixtures with literal ranking, stable ties, and top-ten truncation.
- `testProfitTrendFixtures()` — deterministic Profit Trend fixtures with literal sorted month labels and monthly profit values.
- `testHotColdFixtures()` — deterministic Hot/Cold Split fixtures with literal case-sensitive Sales totals.
- `testAggregate()`
- `doGet()` (web output construction only; normally validate through the web app)

Deterministic tests must throw on mismatches. A returned `passed: true` or successful completion is runtime evidence only when it comes from the intended NUMLOCK Apps Script project.

`testSummaryFixtures()` is the authoritative Summary regression test. It covers mixed sales, purchases, multiple active days, repeated products, distinct quantity and revenue leaders, zero values, and an empty dataset. Its expected Summary fields are hardcoded independently. The former Summary oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testAggregate()` remains a live-data diagnostic. Its validator checks Aggregate Engine internal invariants for active-day count, total profit, best seller, and top-revenue product without depending on legacy Summary logic.

`testRevenueTrendFixtures()` is the authoritative Revenue Trend regression test. It covers unsorted and repeated rows across represented months, purchase-only and zero-revenue rows, cross-year sorting, an empty dataset, and current-period revenue that must be included. Expected labels and values are literal and independent. The former Revenue Trend oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testExpenseBreakdownFixtures()` is the authoritative Expense Breakdown regression test. It asserts exact category insertion order, repeated-category totals, zero and negative amounts, ignored missing-category and sales rows, top expense, and empty output. Expected arrays and top-expense values are literal and independent. The former Expense Breakdown oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testTopProductsFixtures()` is the authoritative Top Products regression test. It asserts repeated-product quantity and revenue totals, descending quantity ranking, stable tie order, the ten-product limit, zero values, ignored purchase-only rows, and empty output. Expected product arrays are literal and independent. The former Top Products oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testProfitTrendFixtures()` is the authoritative Profit Trend regression test. It asserts unsorted cross-year month ordering, repeated-row aggregation, revenue-minus-expense values, purchase-only and revenue-only months, zero-value months, negative-expense refund behavior, and empty output. Expected labels and values are literal and independent. The former Profit Trend oracle, validator, and migration entry point were retired after this test, the independent legacy comparison, and the unified suite passed live in Apps Script.

`testHotColdFixtures()` is the authoritative Hot/Cold Split regression test. It asserts repeated Hot and Cold Sales quantity totals, zero quantities, ignored non-Sales rows, ignored unknown categories, exact case-sensitive matching that excludes differently cased values, and empty output. Expected `hot` and `cold` totals are literal and independent. The former Hot/Cold Split oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testSparseDatasetResilience()` calls the same `buildDashboardResponse()` composition path used by `getDashboardData()`. It requires all 36 public response properties, recursively rejects `NaN` and infinite numbers, validates diagnosis/recommendation/risk/alert/roadmap structures, and compares every pre-existing populated output with a literal snapshot while treating additive metadata separately.

Backend test ownership is separated by responsibility:

- `92.Tests.Fixtures.js` constructs deterministic datasets and expected outputs.
- `94.Tests.Assertions.js` contains reusable test assertions.
- `95.Tests.Validators.js` checks analytics invariants and owns no runnable entry point.
- `96.Tests.Cases.js` contains all twenty-three directly runnable `test*` functions.
- `98.Tests.Runner.js` contains only the ordered, fail-fast unified 24-test suite.

Apps Script execution does not automatically display a function's returned object. On success, `testSparseDatasetResilience()` therefore emits exactly one explicit summary log: `PASS: testSparseDatasetResilience | fixtures=7 | requiredProperties=36 | populatedOutputUnchanged=true`. It still returns the same summary object and rethrows all original failures unchanged.

`testDashboardDateFilter()` uses fixed reference dates and project-timezone date keys. It covers missing/null/unknown normalization to `currentYear`; `today`; inclusive `last7days` within one month and across two months; month/year presets; custom single/multi-month and cross-year boundaries; invalid custom input; immutable filtering; ignored invalid row dates; parameterless equivalence; current partial-month Revenue Trend inclusion; ascending trend labels; finite values; and renderable empty or zero-revenue results. Its success log reports scenarios, Current Year rows, custom rows, and the resolved timezone.

`testPeriodComparison()` validates Today/previous-day, Last 7 Days/prior-seven-day, elapsed Current Month, full Previous Month, elapsed Current Year, and equal-duration Custom rules in the Apps Script project timezone. It covers shorter prior months, leap-day capping, inclusive boundaries, empty periods, zero baselines, profit-to-loss and loss-to-profit movement, finite one-decimal rounding, processed-array immutability, one raw read, one processing pass, one current analytics cache, additive response shape, and frontend Up/Down/Stable/No Comparison rendering. It logs `PASS: testPeriodComparison | scenarios=23 | presets=6 | finite=true`.

`testBusinessPriorityContract()` validates Critical Data Quality precedence, negative profit, critically low margin, High risk, material revenue decline, negative forecast, expense concentration, product opportunity, stable and empty fallbacks, descending score and fixed source tie-breaking, finite bounds, complete evidence, immutable existing intelligence objects, deterministic repeated inputs, one additive response result, accessible field rendering, first-viewport uniqueness, and responsive/accessibility preservation. It logs `PASS: testBusinessPriorityContract | scenarios=20 | levels=Critical,High,Medium,Low`.

`testKpiTargetContract()` validates exact centralized threshold values, deep immutability, unchanged below/equal/above boundaries, literal historical Business Score, Growth Score, KPI status and achievement, maturity, risk, recommendation ordering, and Business Priority output, plus complete unique public target metadata, system provenance, non-editability, and the accessible responsive disclosure contract. It logs `PASS: testKpiTargetContract | scenarios=20 | centralized=true | editable=false`.

`testDashboardStateContract()` validates the exact loading/success/empty/error/retry vocabulary and additive `dateFilter.rowCount` for empty, purchase-only, sales-only, and populated responses. It logs `PASS: testDashboardStateContract | scenarios=5 | states=loading,success,empty,error,retry`. Frontend lifecycle mocks separately validate request failure, render exceptions, retry request identity, duplicate blocking, stale-handler suppression, control recovery, filter retention, live-region semantics, and the no-raw-payload Console policy.

`testAccessibilityContract()` reads the production HTML partial and validates document language, viewport/title/main/navigation/headings, date-control labels and invalid state, associated live validation, active navigation, table caption/header scope, bounded status regions, focus-visible styling, drawer/page focus exclusion, Escape, native Retry and Data Quality buttons, reduced-motion CSS, and Chart.js animation reduction. It logs `PASS: testAccessibilityContract | scenarios=22 | keyboard=true | reducedMotion=true`.

`testExecutivePresentationContract()` reads the production HTML partial and validates the Executive Summary appears before KPIs and analytical detail, visible heading terminology is consistent, diagnosis and recommendation badges use standardized title case, recommendations preserve backend priority order, executive message containers are unique, responsive grid hierarchy remains intact, and every accessibility/responsive-shell fixture token is preserved. It logs `PASS: testExecutivePresentationContract | scenarios=7 | executiveSummaryFirst=true | accessibilityPreserved=true | responsiveHierarchy=true`.

`testPrintReportContract()` reads the production HTML partial and validates one accessible native print action, one print handler, browser-native `window.print()`, print-only title/active-period/generated/version metadata, inclusion of the active executive report sections and chart summaries, exclusion of navigation/controls/skeletons/disclosures/inactive pages, A4 portrait sizing, width/overflow/card-break protections, absence of backend/export dependencies, and preserved accessibility/responsive contracts. It logs `PASS: testPrintReportContract | scenarios=13 | printReady=true`.

`testCsvExportContract()` reads the production HTML partial and validates one accessible native CSV action beside Print Report, the exact timestamped filename contract, a header row, DOM-derived visible rows and columns in displayed order, empty-state disabling, UTF-8 BOM and MIME type, quote escaping, absence of backend/source-object/hidden-field access, browser Blob/object-URL download, and preserved accessibility/responsive contracts. It executes the production sanitizer against `=SUM(A1:A2)`, `+CMD`, `-CMD`, `@SUM(A1:A2)`, leading whitespace, normal text, a valid negative numeric value, and an already-neutralized value; unsafe cells receive exactly one apostrophe, while numeric-column `-12500` remains unchanged. It logs `PASS: testCsvExportContract | scenarios=14 | csvReady=true`.

`testClientRenderPerformanceContract()` reads the production HTML partial and validates the stable DOM cache, query-count budget, immediate first-visible render order, exactly one animation-frame phase, cancellation plus request-token stale protection, absence of in-place sorting/reversing/splicing, preserved populated-output containers, and retained accessibility/state source contracts. It logs `PASS: testClientRenderPerformanceContract | scenarios=7 | idQueries=72 | selectorQueries=2 | deferredPhases=1 | responseMutation=false`.

`testResponsiveShellContract()` reads the production HTML partial and validates the menu, labeled drawer, backdrop, ARIA controls, Escape/navigation close paths, body scroll lock, focus restoration, active-page semantics, table scroll wrapper, narrow full-width main content, retained desktop sidebar classes, and the single initialization guard. It logs `PASS: testResponsiveShellContract | scenarios=12 | breakpoint=lg | drawer=true`.

`testChartPresentationContract()` reads the production HTML partial and validates populated/empty contracts for all three charts, `MM/YYYY` and Rupiah/quantity formatting, zero baselines, no stale or duplicate instances, safe zero-total percentages, backend Expense ordering, long-label behavior, accessible titles/summaries, summary updates, and responsive containment. It logs `PASS: testChartPresentationContract | scenarios=16 | charts=revenue,hotCold,expense`.

`testFrontendDependencyContract()` reads the production HTML partial and validates that Tailwind remains local, Chart.js 4.5.1 and Font Awesome 6.0.0 appear exactly once over HTTPS, no floating runtime URL exists, Font Awesome matches active icon usage, the Chart.js available/unavailable paths preserve chart and responsive contracts, summaries remain present, the fallback has no alert or raw payload, and one actionable diagnostic is defined. It logs `PASS: testFrontendDependencyContract | scenarios=14 | chartPinned=true | fallback=true`.

`testReportingMetadata()` validates empty, sales-only, purchase-only, mixed, and invalid-date inputs; counts; earliest/latest dates and timestamp; all freshness statuses; today, rolling, month, year, previous-month, and custom completion rules; project timezone; additive response presence; finite numbers; and the compact responsive frontend contract. It logs `PASS: testReportingMetadata | scenarios=15 | freshness=Current,Stale,No Data`.

`testDataQualityDiagnostics()` validates empty and fully valid data; each fixed issue independently; negative and non-finite numeric inputs; multiple issues on one row; mixed valid/invalid rows; all status rules; scoped date-filter output; source-array immutability; preservation of raw numeric provenance through processing; additive response presence; and frontend accessibility/code-hiding tokens. It logs `PASS: testDataQualityDiagnostics | scenarios=15 | statuses=Good,Attention,Critical`.

`testSourceDataQualityPipeline()` validates valid, one-invalid, multiple-invalid, mixed source/scoped, out-of-period, all-invalid, empty, and header-only inputs; scope counts; source immutability; analytics isolation; empty analytics with Critical quality; stable row-identity deduplication; the single-read pipeline order; and frontend non-disclosure. It logs `PASS: testSourceDataQualityPipeline | scenarios=15 | invalidDateVisibility=true | analyticsIsolation=true`.

Use the individual functions for targeted debugging after `runAllBackendTests()` identifies a failure. The wrapper logs a start marker, one PASS per completed test, and a final `25/25` marker. On failure it logs the test name and error message, then immediately rethrows the original error.

## Helpers that must not be run directly

Do not select parameterized helpers in the Apps Script editor. They require constructed arguments and are exercised through the safe entry points or bounded local harnesses:

- data helpers taking `ss`, `transactions`, or `priceMap`;
- `buildAggregate(data)`;
- every `build*FromAggregate(aggregate)` adapter;
- cache consumers taking `cache`;
- `buildDiagnosis(data, cache)`; and
- all other builders requiring `data`, `summary`, or another argument.

Running a parameterized helper without its required value can produce a misleading failure and is not a valid acceptance result.

## Required validation sequence

`runAllBackendTests()` is the unified backend gate for local and Apps Script validation. It requires `25/25`, with deterministic fixtures covering Summary, Revenue Trend, Expense Breakdown, Top Products, Profit Trend, Hot/Cold Split, full sparse-dataset dashboard resilience, the dashboard date filter, period comparison, Business Priority, centralized KPI targets, scoped-row state metadata, accessibility, executive presentation, print reporting, CSV export, client-render performance, responsive-shell, chart-presentation, and frontend-dependency contracts, reporting metadata, scoped data-quality diagnostics, and source invalid-date visibility. The unified suite remains ordered and fail-fast.

## Frontend-dependency contract

Runtime dependency inventory is exactly two unique HTTPS URLs: Chart.js 4.5.1 and Font Awesome 6.0.0. Tailwind 3.4.17 is build-time only and its generated clasp-tracked CSS is local. Floating tags, unversioned package paths, duplicate includes, dynamic dependency injection, and unverified SRI hashes are prohibited.

The available-path mock constructs the same three Chart.js configurations and preserves source values. The unavailable-path mock removes `Chart`, renders twice, and requires three `Chart unavailable.` regions, retained external summaries, continued non-chart rendering, safe destruction of existing instances, and exactly one actionable console diagnostic with no response payload.

## Chart-presentation contract

The three chart renderers consume the existing response values without mutation or formula changes. Revenue labels are displayed as `MM/YYYY`, Revenue and Expense tooltips use Indonesian Rupiah, and Hot/Cold tooltips show quantities plus a finite percentage. Revenue and Expense use zero baselines; Revenue does not span absent values; Expense preserves backend category order and uses a horizontal layout for long labels.

Before every populated or empty render, the prior chart instance is destroyed and the canvas is cleared. Revenue, Hot/Cold, and Expense show their exact chart-specific empty messages independently; a zero-value chart never classifies the entire dashboard as empty. Each titled chart region owns an external text summary that updates with the date filter and exposes no internal metadata.

## Data-quality diagnostics contract

`dataQuality` is additive and observational. A pure inspection evaluates raw source dates before processing; the other issue types evaluate only rows admitted by the active date filter. The pipeline performs one transaction read and never mutates, repairs, writes, or changes analytics inclusion. Invalid source dates remain excluded from analytics but visible in diagnostics.

- `INVALID_DATE` (High): date cannot be interpreted as valid.
- `UNKNOWN_TRANSACTION_TYPE` (High): type is neither exactly `Sales` nor `Purchase`.
- `MISSING_SALES_PRODUCT` (Medium): Sales row has no product.
- `MISSING_PURCHASE_CATEGORY` (Medium): Purchase row has no purchase category.
- `INVALID_QUANTITY` (Medium): Sales quantity is non-finite or negative.
- `INVALID_PURCHASE_AMOUNT` (Medium): Purchase expense is non-finite.

`totalRows` and `scope.scopedRows` are the scoped row count. `scope.sourceRows` counts raw data rows and `scope.excludedInvalidDateRows` counts source invalid dates excluded from scoping. `validRows` counts scoped rows without a scoped issue; `issueRows` counts unique affected source or scoped rows; and `issueCount` counts every detected issue. Consequently, `issueRows` may exceed `totalRows`. Status is Good at zero issues, Attention when issues are exclusively Medium severity, and Critical when any High-severity issue exists. The frontend renders only status, issue-count and scope text, user-facing labels, and counts; its real disclosure button exposes `aria-expanded` and `aria-controls`, and internal codes, raw values, and row identities must not appear in HTML.

## Reporting metadata contract

`reportingScope` and `dataFreshness` are additive response fields derived from the filtered processed rows without another spreadsheet read. Row and transaction counts reflect that scoped array; sales and purchase counts use exact transaction types. Invalid dates do not participate in earliest/latest calculations. Freshness is No Data for zero scoped rows, Current when the latest scoped calendar date equals today, and Stale otherwise in the Apps Script project timezone. Current Month and Current Year are partial until their natural calendar end; Today, Last 7 Days, Previous Month, and Custom are complete.

The frontend renders `MM/YYYY` or `MM/YYYY – MM/YYYY`, `<n> transactions`, `Updated DD/MM/YYYY` or `No transaction data`, and a text-visible Current/Stale/No Data badge. It must not render ISO timestamps, `generatedAt`, timezone, or internal filter keys.

## Dashboard state contract

`dateFilter.rowCount` is the authoritative count of valid transaction rows inside the active inclusive date range. Only zero rows is empty; purchase-only and sales-only responses are successful even when one financial measure is zero.

The browser transitions through centralized loading, success, empty, and error presentation. Loading disables controls, blocks duplicate requests, announces progress, and de-emphasizes stale content. Empty preserves the active range and immediately restores filter controls. Request or render failure restores controls, retains the selected values, shows a sanitized error plus Retry, clears skeletons, and writes concise diagnostic context to `console.error` without logging business payloads. Retry submits the exact saved filter/start/end tuple, and request sequence tokens ignore stale callbacks.

## Dashboard date-filter contract

All transaction-derived sections use one filtered processed-row array before cache construction, diagnosis, or recent-transaction projection. Missing, null, empty, and unknown filters normalize to `currentYear`.

- `today`: the project-timezone calendar day.
- `last7days`: today plus the previous six calendar days, inclusive.
- `currentMonth`: month start through today.
- `previousMonth`: the complete prior calendar month.
- `currentYear`: January 1 through today; this is the default.
- `custom`: valid `YYYY-MM-DD` start/end values, inclusive. Both are required and start must not be after end.

The backend uses `Session.getScriptTimeZone()` as the authority. It ignores rows with invalid dates, never mutates the supplied row array, and throws descriptive errors for invalid custom input rather than swapping boundaries.

Revenue Trend uses the Aggregate Engine output for the filtered rows and does not remove the current calendar month. The visible frontend label is derived from the response `startDate` and `endDate` strings without constructing browser-local dates: one month renders as `MM/YYYY`, and multiple months render as `MM/YYYY – MM/YYYY`.

### During decomposition

After every function move:

1. Confirm the function exists exactly once across clasp-tracked source.
2. Confirm its name, parameters, and body are unchanged except for approved header comments.
3. Run JavaScript syntax checks on every changed `.js` file.
4. Run source-contract scans for duplicate or missing globals.
5. Run all six deterministic fixture regressions locally.
6. Run `getDashboardData()` locally with an Apps Script-compatible mock.
7. Run `git diff --check` and `git status --short`.

### Live validation and release

1. Confirm the active clasp account and configured NUMLOCK project without exposing the script ID.
2. From the VS Code terminal, run `clasp status` and verify only approved production files are tracked.
3. Run `clasp push` only when explicitly requested. Use `clasp push --force` only when a normal push cannot synchronize the complete reviewed source and force upload is explicitly required.
4. Run `runAllBackendTests()` in Apps Script as the primary backend validation. Use an individual test only for targeted debugging.
5. Stop on the first mismatch or runtime error; do not apply speculative fixes.
6. List the existing Apps Script deployments, create an immutable version, and update the intended deployment only when explicitly requested after backend tests pass.
7. Hard-refresh the deployed dashboard, verify visible cards/charts/transactions, and inspect the browser console.

Follow `RELEASE.md` for the complete authoritative release sequence and checklist.

## Safety

- Tests and dashboard reads must not alter spreadsheet data.
- Do not edit `.clasp.json` or expose its script ID.
- Do not treat `clasp push` as a test pass.
- Do not commit, push Git, deploy, or modify spreadsheet data unless the task explicitly authorizes it.
