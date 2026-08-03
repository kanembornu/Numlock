# NUMLOCK Release Workflow

This document owns the authoritative release process. NUMLOCK `1.0.0` is the current production release. Release actions are operator-controlled: no repository task automates Git commits, Apps Script versions, or deployments.

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
5. Run `runAllBackendTests()` locally with the documented Apps Script-compatible mocks; require `8/8` PASS.
6. Review the complete diff and confirm release metadata and changelog agree.

### 2. Apps Script upload

1. Run `clasp status` without exposing `.clasp.json` or its script ID.
2. Verify the exact production inventory, including `10.Config.js`, `189.View.Tailwind.html`, and `190.View.Index.html`.
3. After inventory review and explicit upload authorization, run `clasp push --force`. Upload is not runtime, deployment, or browser evidence.

### 3. Live validation

1. In the Apps Script editor, run `runAllBackendTests()` against the intended NUMLOCK project.
2. Require the final `8/8` PASS marker.
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
- [ ] Local `runAllBackendTests()` passed `8/8`.
- [ ] `clasp status` showed the exact reviewed production inventory.
- [ ] Authorized `clasp push --force` completed.
- [ ] Apps Script `runAllBackendTests()` passed `8/8`.
- [ ] The existing production deployment was updated to a new immutable version.
- [ ] The stable web-app URL was retained.
- [ ] Desktop and narrow-width browser acceptance passed.
- [ ] Console and Network checks passed with no Tailwind CDN request.
- [ ] Only the accepted Apps Script iframe sandbox warning remained.
- [ ] Approved paths were staged explicitly; no broad Git add was used.
- [ ] Commit and push occurred only with explicit authorization.
- [ ] The prior immutable Apps Script version was recorded for rollback.

## Legacy migration audit

### Reachability result

- Production path: `getDashboardData()` calls `buildAnalyticsCache()`, which calls `buildAggregate()` once and derives summary, revenue trend, expense breakdown, top products, profit trend, and Hot/Cold split through aggregate adapters. It does not call a legacy builder, migration validator, or test entry point.
- Test path: `runAllBackendTests()` reaches all seven test entry points. Six migration entry points call their matching validators; those validators call both the legacy comparison oracle and aggregate implementation. `testAggregate()` calls the diagnostic `validateAggregate()`.
- Unreachable functions: none.
- Functions safe to remove now: none. Every legacy builder and migration validator remains referenced by active regression coverage and documentation.
- Replacement coverage required before retirement: replace each legacy-oracle comparison with independent, deterministic expected-output fixtures covering its domain before removing its legacy builder, validator, and dedicated migration entry point. Keep the unified runner at equivalent or stronger coverage.

### Complete production-source function classification

Each declared production-source function appears exactly once below.

| Classification | Functions |
| --- | --- |
| Active production function | `getTransactionData`, `getPriceMap`, `processTransactions`, `buildAggregate`, `buildSummaryFromAggregate`, `buildRevenueTrendFromAggregate`, `buildProfitTrendFromAggregate`, `buildHotColdSplitFromAggregate`, `buildTopProductsFromAggregate`, `buildExpenseBreakdownFromAggregate`, `buildFinancial`, `buildTrendEngine`, `buildForecast`, `buildProductContribution`, `buildRevenueConcentration`, `buildParetoAnalysis`, `buildExpenseIntelligence`, `buildRevenueIntelligence`, `detectRevenueTrend`, `buildProfitIntelligence`, `buildBusinessScore`, `buildGrowthScore`, `buildKpiAchievement`, `buildBusinessMaturity`, `buildKPIStatus`, `buildInsights`, `buildDiagnosis`, `detectCategoryDominance`, `buildRecommendationEngine`, `buildPriorityAction`, `buildOpportunityEngine`, `buildActionRoadmap`, `buildExecutiveSummary`, `buildRiskEngine`, `buildBusinessFocus`, `buildExecutiveAlert`, `getDashboardData`, `buildRecentTransactions`, `buildAnalyticsCache`, `doGet` |
| Active regression test | `validateAggregate` |
| Legacy migration oracle | `buildSummary`, `buildRevenueTrend`, `buildExpenseBreakdown`, `buildTopProducts`, `buildProfitTrend`, `buildHotColdSplit` |
| Migration validator | `validateSummaryMigration`, `validateRevenueTrendMigration`, `validateExpenseBreakdownMigration`, `validateProductMigration`, `validateProfitTrendMigration`, `validateHotColdMigration` |
| Test entry point | `testAggregate`, `testSummaryMigration`, `testRevenueTrendMigration`, `testExpenseBreakdownMigration`, `testProductMigration`, `testProfitTrendMigration`, `testHotColdMigration`, `runAllBackendTests` |
| Dead/unreferenced function | None |

`validateAggregate` is classified as an active regression diagnostic rather than a migration validator because it logs comparisons but does not assert or throw on mismatches.
