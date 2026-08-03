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
- `getDashboardData()`
- `testSummaryFixtures()` — deterministic Summary regression fixtures with literal expected outputs.
- `testRevenueTrendFixtures()` — deterministic Revenue Trend fixtures with literal completed-month labels and values.
- `testExpenseBreakdownFixtures()` — deterministic ordered Expense Breakdown fixtures with literal amounts and top expense.
- `testTopProductsFixtures()` — deterministic Top Products fixtures with literal ranking, stable ties, and top-ten truncation.
- `testProfitTrendFixtures()` — deterministic Profit Trend fixtures with literal sorted month labels and monthly profit values.
- `testHotColdFixtures()` — deterministic Hot/Cold Split fixtures with literal case-sensitive Sales totals.
- `testAggregate()`
- `testHotColdMigration()`
- `doGet()` (web output construction only; normally validate through the web app)

Migration tests must throw on mismatches. A returned `passed: true` or successful completion is runtime evidence only when it comes from the intended NUMLOCK Apps Script project.

`testSummaryFixtures()` is the authoritative Summary regression test. It covers mixed sales, purchases, multiple active days, repeated products, distinct quantity and revenue leaders, zero values, and an empty dataset. Its expected Summary fields are hardcoded independently. The former Summary oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testAggregate()` remains a live-data diagnostic. Its validator checks Aggregate Engine internal invariants for active-day count, total profit, best seller, and top-revenue product without depending on legacy Summary logic.

`testRevenueTrendFixtures()` is the authoritative Revenue Trend regression test. It covers unsorted and repeated rows across completed months, purchase-only and zero-revenue rows, cross-year sorting, an empty dataset, and a current-month sentinel that must be excluded. Expected labels and values are literal and independent. The former Revenue Trend oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testExpenseBreakdownFixtures()` is the authoritative Expense Breakdown regression test. It asserts exact category insertion order, repeated-category totals, zero and negative amounts, ignored missing-category and sales rows, top expense, and empty output. Expected arrays and top-expense values are literal and independent. The former Expense Breakdown oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testTopProductsFixtures()` is the authoritative Top Products regression test. It asserts repeated-product quantity and revenue totals, descending quantity ranking, stable tie order, the ten-product limit, zero values, ignored purchase-only rows, and empty output. Expected product arrays are literal and independent. The former Top Products oracle, validator, and migration entry point were retired after this test and the unified suite passed live in Apps Script.

`testProfitTrendFixtures()` is the authoritative Profit Trend regression test. It asserts unsorted cross-year month ordering, repeated-row aggregation, revenue-minus-expense values, purchase-only and revenue-only months, zero-value months, negative-expense refund behavior, and empty output. Expected labels and values are literal and independent. The former Profit Trend oracle, validator, and migration entry point were retired after this test, the independent legacy comparison, and the unified suite passed live in Apps Script.

`testHotColdFixtures()` is the authoritative Hot/Cold Split regression test. It asserts repeated Hot and Cold Sales quantity totals, zero quantities, ignored non-Sales rows, ignored unknown categories, exact case-sensitive matching that excludes differently cased values, and empty output. Expected `hot` and `cold` totals are literal and independent. The legacy Hot/Cold Split oracle, validator, and migration entry point remain temporarily for independent live validation before retirement.

Use the individual functions for targeted debugging after `runAllBackendTests()` identifies a failure. The wrapper logs a start marker, one PASS per completed test, and a final `8/8` marker. On failure it logs the test name and error message, then immediately rethrows the original error.

## Helpers that must not be run directly

Do not select parameterized helpers in the Apps Script editor. They require constructed arguments and are exercised through the safe entry points or bounded local harnesses:

- data helpers taking `ss`, `transactions`, or `priceMap`;
- `buildAggregate(data)` and every legacy `build*(data)` analytics oracle;
- every `build*FromAggregate(aggregate)` adapter;
- every `validate*Migration(data)` validator;
- cache consumers taking `cache`;
- `buildDiagnosis(data, cache)`; and
- all other builders requiring `data`, `summary`, or another argument.

Running a parameterized helper without its required value can produce a misleading failure and is not a valid acceptance result.

## Required validation sequence

`runAllBackendTests()` is the unified backend gate for local and Apps Script validation. It remains `8/8`, with deterministic fixtures covering Summary, Revenue Trend, Expense Breakdown, Top Products, Profit Trend, and Hot/Cold Split. No unified-suite test depends on a legacy migration oracle. Targeted legacy functions are for failure diagnosis and explicitly documented retirement validation only.

### During decomposition

After every function move:

1. Confirm the function exists exactly once across clasp-tracked source.
2. Confirm its name, parameters, and body are unchanged except for approved header comments.
3. Run JavaScript syntax checks on every changed `.js` file.
4. Run source-contract scans for duplicate or missing globals.
5. Run all six deterministic fixture regressions locally; run the legacy Hot/Cold Split migration test independently while its retirement is pending.
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
