# Deployment

`RELEASE.md` owns the complete release sequence. This document provides deployment-specific controls and must remain consistent with it.

## Artifact boundaries

- A Git commit records repository history.
- A GitHub push updates the remote repository.
- `clasp push` synchronizes local production files to Apps Script HEAD.
- An Apps Script version is an immutable source snapshot.
- A deployment selects the version served by the web app.

These are independent actions. Upload success is not runtime, deployment, or browser evidence.

## Pre-upload gate

1. Confirm the reviewed diff and `git status --short`.
2. For a release, update `10.Config.js` and `docs/CHANGELOG.md` together. Semantic versioning begins at `1.0.0`.
3. Confirm the authorized clasp account can access the configured NUMLOCK project without printing the script ID.
4. Run syntax and migration validation.
5. Run `clasp status`; it must show `appsscript.json` and only the approved numbered `.js` and `.html` production files, including `10.Config.js`.
6. Stop if the account or inventory is wrong.

### Sprint 5.7 styling build gate

The completed production-safe styling migration uses these artifacts:

- `package.json`, `package-lock.json`, `tailwind.config.js`, and `assets/tailwind.input.css` own the local build;
- generated `189.View.Tailwind.html` is a reviewed, Git- and clasp-tracked production artifact;
- `190.View.Index.html` includes the generated partial while preserving its authored CSS; and
- `node_modules/` and build-only files remain excluded from clasp.

Pin `tailwindcss` exactly to `3.4.17` in `devDependencies` and define this package script:

```json
"build:tailwind": "tailwindcss -c tailwind.config.js -i assets/tailwind.input.css -o 189.View.Tailwind.html --minify"
```

`assets/tailwind.input.css` contains the three Tailwind directives. `tailwind.config.js` scans `./190.View.Index.html` and contains the explicit runtime-class safelist recorded in `DECISIONS.md`. Run `npm ci`, then `npm run build:tailwind` before `clasp status`; confirm the partial contains minified CSS only and review its diff. Node.js is build-time tooling and is never uploaded or executed in Apps Script.

Before upload after relevant frontend changes, verify the Tailwind CDN reference remains absent while Chart.js and Font Awesome remain unchanged. Confirm all arbitrary utilities compile: `rounded-[24px]`, `rounded-[28px]`, `rounded-[32px]`, `text-[11px]`, `text-[15px]`, `text-[18px]`, `text-[24px]`, `text-[2rem]`, `tracking-[0.22em]`, `tracking-[0.25em]`, and `left-[14px]`. Confirm responsive `lg:` and `xl:` utilities and every safelisted state class exist in the generated artifact.

## Upload and live validation

Run `clasp push` only with explicit approval. The authoritative release workflow uses `clasp push --force` only after exact inventory review and upload authorization. After upload, run `runAllBackendTests()` in the Apps Script editor and require `8/8`; use these targeted functions only to diagnose failures:

1. `getDashboardData()`
2. `testSummaryFixtures()`
3. `testRevenueTrendFixtures()`
4. `testExpenseBreakdownFixtures()`
5. `testTopProductsFixtures()`
6. `testProfitTrendMigration()`
7. `testHotColdMigration()`

Stop on the first error or mismatch. Do not run parameterized helpers directly and do not apply speculative fixes to live-only failures.

## Version and deployment update

After live tests pass and deployment is explicitly authorized:

1. List existing deployments and identify the intended web-app deployment without publishing private identifiers.
2. Create a new immutable Apps Script version for the validated source.
3. Update the intended deployment to that version; do not create a second production deployment accidentally.
4. Verify manifest execute-as and access settings remain intentional.

Source structure and production hardening are complete. This repository contains no deployment or automated release scripts; release and deployment steps remain explicit operator actions.

## Browser verification

Hard-refresh the deployed dashboard so cached browser assets do not mask the new version. Verify dashboard loading, KPI cards, charts, recent transactions, filters, responsive layout, and the browser console. A browser check against an older deployment is not evidence for uploaded source.

For the styling migration, compare the candidate deployment with the current production deployment at desktop and narrow viewport widths. Exercise Analytics/Transactions navigation, loading skeletons, positive/neutral/negative data states, diagnosis cards, intelligence themes, recommendation priorities, risk/growth/concentration states, executive alert/focus states, KPI bar colors and widths, and the action roadmap. PASS requires visual parity, no missing utility styling, no Tailwind CDN request, and no Tailwind production warning. The Apps Script iframe sandbox warning neither passes nor fails this package.

## Rollback

Prefer updating the deployment back to the last known-good immutable Apps Script version. A Git revert alone does not change the served web app, and source control must not be used to improvise spreadsheet-data rollback.

For the styling migration, retain the pre-migration immutable Apps Script version and deployment identifier before changing production. If parity or console validation fails, immediately repoint the existing production deployment to that version; do not create a replacement production deployment. Repository rollback is a separately reviewed revert that restores the Tailwind CDN script in `190.View.Index.html` and removes the partial include and styling build files/allowlist entries. Rebuilding or reverting Git alone is not production rollback.
