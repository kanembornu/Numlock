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

Local validation may load `DashboardService.js` into a Node `vm` context with bounded mocks for `SpreadsheetApp`, `Utilities`, `Session`, and `Logger`. Fixtures should cover normal data, empty data, ties, current-month filtering, purchase-only months, zero/negative expenses, product truncation, and case-sensitive Hot/Cold categories.

Mocks validate JavaScript execution and deterministic contracts; they do not prove Google authorization, live spreadsheet shape, Apps Script service behavior, or deployed-browser behavior. Run `node --check` on extracted JavaScript source, not on HTML without first extracting its scripts.

## Safe direct Apps Script runs

These functions are read-only with respect to spreadsheet data and are safe to run deliberately in the Apps Script editor:

- `getDashboardData()`
- `testAggregate()`
- `testSummaryMigration()`
- `testRevenueTrendMigration()`
- `testExpenseBreakdownMigration()`
- `testProductMigration()`
- `testProfitTrendMigration()`
- `testHotColdMigration()`
- `doGet()` (web output construction only; normally validate through the web app)

Migration tests must throw on mismatches. A returned `passed: true` or successful completion is runtime evidence only when it comes from the intended NUMLOCK Apps Script project.

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

### During decomposition

After every function move:

1. Confirm the function exists exactly once across clasp-tracked source.
2. Confirm its name, parameters, and body are unchanged except for approved header comments.
3. Run JavaScript syntax checks on every changed `.js` file.
4. Run source-contract scans for duplicate or missing globals.
5. Run all six migration tests locally with deterministic fixtures.
6. Run `getDashboardData()` locally with an Apps Script-compatible mock.
7. Run `git diff --check` and `git status --short`.

### Live validation and release

1. Confirm the active clasp account and configured NUMLOCK project without exposing the script ID.
2. From the VS Code terminal, run `clasp status` and verify only approved production files are tracked.
3. Run `clasp push` only when explicitly requested. Use `clasp push --force` only when a normal push cannot synchronize the complete reviewed source and force upload is explicitly required.
4. Run `getDashboardData()` and all six migration tests in Apps Script.
5. Stop on the first mismatch or runtime error; do not apply speculative fixes.
6. List the existing Apps Script deployments, create an immutable version, and update the intended deployment only when explicitly requested after backend tests pass.
7. Hard-refresh the deployed dashboard, verify visible cards/charts/transactions, and inspect the browser console.

## Safety

- Tests and dashboard reads must not alter spreadsheet data.
- Do not edit `.clasp.json` or expose its script ID.
- Do not treat `clasp push` as a test pass.
- Do not commit, push Git, deploy, or modify spreadsheet data unless the task explicitly authorizes it.
