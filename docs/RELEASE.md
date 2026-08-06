# NUMLOCK Release Workflow

This document owns the authoritative release process. NUMLOCK `1.0.0` is the current production release. Release actions are operator-controlled: no repository task automates Git commits, Apps Script versions, or deployments.

## UI/UX 2.0 Package 022 candidate boundary

Package 022 remains a Closure Candidate until the exact candidate passes local 41/41 and Apps Script live 41/41, the reviewed 26-file source is uploaded, the existing production deployment alone is updated to one new immutable version without changing its stable URL, functional browser acceptance passes, all 80 required screenshots score 18/18, production health passes, and the previous immutable version is recorded as rollback. Version metadata remains `1.0.0`; static or upload evidence cannot substitute for any later gate.

## Semantic versioning

- **PATCH**: fixes and refactors that do not change public behavior.
- **MINOR**: backward-compatible dashboard capability additions.
- **MAJOR**: incompatible data-contract, deployment, or workflow changes.

Every release updates `10.Config.js` and `docs/CHANGELOG.md` together. Update README version references when applicable. The configuration object is the executable metadata authority; the changelog is the release-history authority.

## Authoritative release process

### 1. Pre-release checks

1. Require a clean `git status --short` before beginning release operations.
2. Run `npm ci`.
3. Run `npm run build:tailwind` when frontend classes or styling changed, and review the generated `189.View.Tailwind.html` diff.
4. Parse every numbered production JavaScript file and run applicable static checks.
5. Run `runAllBackendTests()` locally with the documented Apps Script-compatible mocks; require `25/25` PASS.
6. Review the complete diff and confirm release metadata and changelog agree.

### 2. Apps Script upload

1. Run `clasp status` without exposing `.clasp.json` or its script ID.
2. Verify the exact production inventory, including `10.Config.js`, `189.View.Tailwind.html`, and `190.View.Index.html`.
3. After inventory review and explicit upload authorization, run `clasp push --force`. Upload is not runtime, deployment, or browser evidence.

### 3. Live validation

1. In the Apps Script editor, run `runAllBackendTests()` against the intended NUMLOCK project.
2. Require the final `25/25` PASS marker.
3. If it fails, use the named targeted test function only to diagnose that failure. Stop on mismatches; do not deploy speculative fixes.

### 4. Deployment

1. Open **Manage deployments** for the existing production web app.
2. Edit the existing production deployment.
3. Select **New version**.
4. Deploy the validated version while retaining the stable production web-app URL.
5. Do not create a replacement production deployment accidentally.

### 5. Browser acceptance

1. Hard-refresh the production web app.
2. Check desktop and narrow-width layouts, navigation, dashboard cards, charts, transactions, filters, loading states, and generated Tailwind styling.
3. Inspect Console and Network: require no Tailwind CDN request and no unexpected application logs or failed assets.
4. The known Apps Script iframe sandbox warning is accepted and non-blocking.

### 6. Release metadata

1. Apply the semantic-versioning policy.
2. Update `PROJECT_CONFIG` in `10.Config.js`.
3. Update `docs/CHANGELOG.md` in the same change.
4. Update README/version references when applicable.
5. Confirm the rendered sidebar version matches `PROJECT_CONFIG.VERSION`.

### 7. Git completion

After upload, live validation, deployment, and browser acceptance are recorded, stage each approved file explicitly with `git add <path>`. Never use `git add .` or `git add -A`. Review `git diff --cached`, commit with the approved release message, and push only with explicit authorization.

### 8. Rollback

Production rollback means editing the existing production deployment to point back to the prior known-good immutable Apps Script version. A Git revert is a separate repository operation and does not roll back the served web app.

## Release checklist template

- [ ] Git status was clean before release operations.
- [ ] `10.Config.js` and `docs/CHANGELOG.md` agree.
- [ ] README/version references were updated when applicable.
- [ ] `npm ci` passed.
- [ ] Tailwind was rebuilt and reviewed when frontend classes or styling changed.
- [ ] Production JavaScript syntax/static checks passed.
- [ ] Local `runAllBackendTests()` passed `25/25`.
- [ ] `clasp status` showed the exact reviewed production inventory.
- [ ] Authorized `clasp push --force` completed.
- [ ] Apps Script `runAllBackendTests()` passed `25/25`.
- [ ] The existing production deployment was updated to a new immutable version.
- [ ] The stable web-app URL was retained.
- [ ] Desktop and narrow-width browser acceptance passed.
- [ ] Console and Network checks passed with no Tailwind CDN request.
- [ ] Only the accepted Apps Script iframe sandbox warning remained.
- [ ] Approved paths were staged explicitly; no broad Git add was used.
- [ ] Commit and push occurred only with explicit authorization.
- [ ] The prior immutable Apps Script version was recorded for rollback.

## v1.0 release closeout

NUMLOCK reached **Feature Complete v1.0** on 2026-08-05. Candidate `658f4ab1011633e86634f14ce838a514c5205df0` completed the required evidence chain:

1. Start from a clean, reviewed Git boundary; record the candidate commit and confirm `10.Config.js` and this changelog agree.
2. Run dependency installation, applicable Tailwind generation checks, production JavaScript parsing, focused contracts, Markdown links, `git diff --check`, and local `runAllBackendTests()`; require 25/25.
3. With explicit authorization, review `clasp status`, confirm the exact inventory, and upload that candidate. Upload alone proves no runtime behavior.
4. In the intended Apps Script project, run `runAllBackendTests()` and require 25/25. Stop if the source identity or result differs.
5. Before changing production, record the intended existing deployment and its current known-good immutable Apps Script version as the rollback target.
6. With explicit authorization, create a new immutable Apps Script version and update that existing deployment while retaining its stable URL.
7. Hard-refresh the deployed URL and pass desktop and narrow-width acceptance for dashboard states, filters, charts, accessibility, performance behavior, Print Report, CSV export, bounded drill-down, Console, and Network.
8. Confirm the served version/build, deployment identity, current response contract, and production health match the candidate; record each evidence level separately.
9. Only after all prior gates pass, explicitly stage the approved release files, review the cached diff, commit, create annotated tag `v1.0.0`, and push only with separate authorization.

All mandatory v1.0 gates passed. Roll back production by repointing the same stable deployment to immutable version 184.

The final v1.0 baseline should be the single reviewed commit that contains the complete bounded implementation, synchronized `1.0.0` production metadata and changelog, passing 25-entry runner, and final evidence record. Permission-, privacy-, governance-, consumer-, persistence-, pagination-, and payload-measurement-gated expansions are not part of this baseline.

After release, allow patch releases only for backward-compatible defect, security, dependency, documentation, or operational fixes. Require a minor release for additive approved capability and a major release for incompatible contracts. Preserve the full default dashboard response, retain rollback versions, keep release evidence by level, and route new feature work to UI/UX 2.0 or a separately approved backlog package.

### Current v1.0 candidate record — 2026-08-05

- **Candidate Git commit:** `658f4ab1011633e86634f14ce838a514c5205df0`; clean `main`, `origin/main`, and `HEAD` boundary before preflight.
- **Metadata:** `1.0.0`, Production; unchanged.
- **Local evidence:** dependency install passed; all numbered production JavaScript and extracted frontend JavaScript parsed; `appsscript.json` parsed; repository Markdown links passed; eight focused release contracts passed; `runAllBackendTests()` passed 25/25; `git diff --check` passed.
- **Tailwind:** not rebuilt because the candidate introduced no frontend, styling, build-input, configuration, or generated-CSS delta.
- **Clasp identity/inventory:** authorized account and configured project confirmed without recording the private script ID; exact expected 26-file inventory confirmed.
- **Upload:** `clasp push --force` completed with `Script is already up to date.`, confirming the remote source already matches the reviewed candidate inventory. This is upload/synchronization evidence only.
- **Apps Script live:** `runAllBackendTests()` PASS 25/25.
- **Production deployment:** existing stable deployment updated to immutable version 185; stable URL unchanged.
- **Browser acceptance:** PASS against immutable version 185.
- **Production health:** PASS with `1.0.0 — Production` metadata unchanged.
- **Known-good rollback:** immutable version 184 on the same stable deployment. The separate `@HEAD` deployment is not the production rollback reference.
- **Git completion:** release evidence commit, annotated `v1.0.0` tag, and push remain operator-controlled and were not performed by this documentation closeout.

### Post-release mode

Feature development is paused after release closeout. Accept only maintenance and demand-driven enhancements with explicit evidence and rollback boundaries. UI/UX 2.0 discovery is separately authorized work outside the v1.0 baseline. Editable KPI targets, API projection, and expanded drill-down remain non-blocking gated scopes.

## Legacy migration audit

### Reachability result

- Production path: `getDashboardData()` calls `buildAnalyticsCache()`, which calls `buildAggregate()` once and derives summary, revenue trend, expense breakdown, top products, profit trend, and Hot/Cold split through aggregate adapters. It does not call a legacy builder, migration validator, or test entry point.
- Test path: `runAllBackendTests()` reaches the production `getDashboardData()` check plus 24 named deterministic contract entries. The unified suite contains exactly 25 ordered checks, remains fail-fast, and contains no legacy migration oracle.
- Unreachable functions: none.
- Retired functions: all six legacy oracle chains were removed after their deterministic replacements passed live.
- Replacement coverage status: complete. Aggregate Engine is the sole production analytics source, source migration is complete, and Sprint 5.7 Package 005 is complete.

### Complete production-source function classification

Each declared production-source function appears exactly once below.

| Classification | Functions |
| --- | --- |
| Active production function | `getTransactionData`, `getPriceMap`, `processTransactions`, `buildAggregate`, `buildSummaryFromAggregate`, `buildRevenueTrendFromAggregate`, `buildProfitTrendFromAggregate`, `buildHotColdSplitFromAggregate`, `buildTopProductsFromAggregate`, `buildExpenseBreakdownFromAggregate`, `buildFinancial`, `buildTrendEngine`, `buildForecast`, `buildProductContribution`, `buildRevenueConcentration`, `buildParetoAnalysis`, `buildExpenseIntelligence`, `buildRevenueIntelligence`, `detectRevenueTrend`, `buildProfitIntelligence`, `buildBusinessScore`, `buildGrowthScore`, `buildKpiAchievement`, `buildBusinessMaturity`, `buildKPIStatus`, `buildInsights`, `buildDiagnosis`, `detectCategoryDominance`, `buildRecommendationEngine`, `buildPriorityAction`, `buildOpportunityEngine`, `buildActionRoadmap`, `buildExecutiveSummary`, `buildRiskEngine`, `buildBusinessFocus`, `buildExecutiveAlert`, `getDashboardData`, `normalizeDashboardDateFilter`, `createDashboardDateKey`, `shiftDashboardDateKey`, `validateDashboardDateKey`, `resolveDashboardDateRange`, `filterTransactionsByDateRange`, `buildDashboardResponse`, `buildRecentTransactions`, `buildAnalyticsCache`, `doGet` |
| Active regression support | `createSummaryFixtures`, `createRevenueTrendFixtures`, `createExpenseBreakdownFixtures`, `createTopProductsFixtures`, `createProfitTrendFixtures`, `createHotColdFixtures`, `createSparseDatasetFixtures`, `createDashboardDateFilterFixtures`, `assertFiniteNumbers`, `assertRequiredProperties`, `assertThrowsMessage`, `validateAggregate` |
| Legacy migration oracle | None |
| Migration validator | None |
| Test entry point | `runAllBackendTests` plus the 24 named contract entries currently listed in `98.Tests.Runner.js` |
| Dead/unreferenced function | None |

`validateAggregate` is classified as an active regression diagnostic rather than a migration validator because it logs comparisons but does not assert or throw on mismatches.

Test support is responsibility-split: deterministic data in `92.Tests.Fixtures.js`, reusable assertions in `94.Tests.Assertions.js`, analytics invariants in `95.Tests.Validators.js`, directly runnable cases in `96.Tests.Cases.js`, and the unified runner in `98.Tests.Runner.js`. Apps Script does not automatically display returned objects, so the sparse test logs its successful returned summary explicitly.

### Summary retirement status

Summary regression coverage uses deterministic processed-transaction fixtures with literal expected outputs. After `testSummaryFixtures()` and the unified `8/8` suite passed live in Apps Script, the legacy Summary oracle, validator, and test entry point were retired. `validateAggregate()` now checks Aggregate Engine invariants directly and does not depend on legacy Summary logic. `buildSummaryFromAggregate()` is the only production Summary builder.

### Revenue Trend retirement status

Revenue Trend regression coverage uses deterministic processed-transaction fixtures with literal completed-month labels and values. After `testRevenueTrendFixtures()` and the unified `8/8` suite passed live in Apps Script, the legacy Revenue Trend oracle, validator, and test entry point were retired. Production Revenue Trend is owned only by `buildRevenueTrendFromAggregate()`; forecast and Revenue Intelligence consume `cache.revenueTrend`.

### Expense Breakdown retirement status

Expense Breakdown regression coverage uses deterministic processed-transaction fixtures with literal ordered categories, amounts, and top expense. After `testExpenseBreakdownFixtures()` and the unified `8/8` suite passed live in Apps Script, the legacy Expense Breakdown oracle, validator, and test entry point were retired. Production Expense Breakdown is owned only by `buildExpenseBreakdownFromAggregate()`; Insights and Expense Intelligence consume `cache.expenseBreakdown`, and recommendations consume `cache.insights.topExpense`.

### Top Products retirement status

Top Products regression coverage uses deterministic processed-transaction fixtures with literal product order, quantity totals, revenue totals, stable ties, and top-ten truncation. After `testTopProductsFixtures()` and the unified `8/8` suite passed live in Apps Script, the legacy Top Products oracle, validator, and test entry point were retired. Production Top Products is owned only by `buildTopProductsFromAggregate()`; contribution consumes `cache.topProducts`, while concentration and Pareto consume cached product contribution.

### Profit Trend retirement status

Profit Trend regression coverage uses deterministic processed-transaction fixtures with literal cross-year labels and monthly profit values. After `testProfitTrendFixtures()`, the independent legacy comparison, and the unified `8/8` suite passed live in Apps Script, the legacy Profit Trend oracle, validator, and test entry point were retired. `buildProfitTrendFromAggregate()` is the sole production Profit Trend builder; `buildAnalyticsCache()` derives `cache.profitTrend` from `cache.aggregate`, and `buildTrendEngine()` consumes that cached result. Profit Intelligence remains based on `cache.financial`.

### Hot/Cold Split retirement status

Hot/Cold Split regression coverage uses deterministic processed-transaction fixtures with literal `hot` and `cold` totals. The fixtures assert Sales-only aggregation and exact case-sensitive matching while ignoring non-Sales rows and unknown or differently cased categories. After `testHotColdFixtures()` and the unified `8/8` suite passed live in Apps Script, the legacy Hot/Cold Split oracle, validator, and test entry point were retired. `buildHotColdSplitFromAggregate()` is the sole production builder; `buildAnalyticsCache()` derives `cache.hotColdSplit` from `cache.aggregate`, while `buildTrendEngine()` and `detectCategoryDominance()` consume the cached result.
