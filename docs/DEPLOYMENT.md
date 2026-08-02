# Deployment

## Artifact boundaries

- A Git commit records repository history.
- A GitHub push updates the remote repository.
- `clasp push` synchronizes local production files to Apps Script HEAD.
- An Apps Script version is an immutable source snapshot.
- A deployment selects the version served by the web app.

These are independent actions. Upload success is not runtime, deployment, or browser evidence.

## Pre-upload gate

1. Confirm the reviewed diff and `git status --short`.
2. Confirm the authorized clasp account can access the configured NUMLOCK project without printing the script ID.
3. Run syntax and migration validation.
4. Run `clasp status`; the current layout must show only `appsscript.json`, `Code.js`, `DashboardService.js`, and `Index.html` as tracked production files.
5. Stop if the account or inventory is wrong.

## Upload and live validation

Run `clasp push` only with explicit approval. Use `clasp push --force` only when explicitly required to upload the complete reviewed source. After upload, execute in the Apps Script editor:

1. `getDashboardData()`
2. `testSummaryMigration()`
3. `testRevenueTrendMigration()`
4. `testExpenseBreakdownMigration()`
5. `testProductMigration()`
6. `testProfitTrendMigration()`
7. `testHotColdMigration()`

Stop on the first error or mismatch. Do not run parameterized helpers directly and do not apply speculative fixes to live-only failures.

## Version and deployment update

After live tests pass and deployment is explicitly authorized:

1. List existing deployments and identify the intended web-app deployment without publishing private identifiers.
2. Create a new immutable Apps Script version for the validated source.
3. Update the intended deployment to that version; do not create a second production deployment accidentally.
4. Verify manifest execute-as and access settings remain intentional.

This repository contains no deployment automation; these remain explicit operator actions.

## Browser verification

Hard-refresh the deployed dashboard so cached browser assets do not mask the new version. Verify dashboard loading, KPI cards, charts, recent transactions, filters, responsive layout, and the browser console. A browser check against an older deployment is not evidence for uploaded source.

## Rollback

Prefer updating the deployment back to the last known-good immutable Apps Script version. A Git revert alone does not change the served web app, and source control must not be used to improvise spreadsheet-data rollback.
