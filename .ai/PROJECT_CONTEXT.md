# NUMLOCK Project Context

Read `AGENTS.md` first; it is the operating contract. This file provides continuity, not authorization.

## Project

NUMLOCK is a Google Apps Script V8 and Google Sheets business-intelligence dashboard for coffee-shop transactions. `100.Code.js#doGet()` serves `190.View.Index.html`; the browser calls `getDashboardData()` in `90.Dashboard.Service.js`.

## Current state

- Sprint 5.5 Dashboard Intelligence: complete.
- Sprint 5.6 backend refactor: complete.
- Aggregate migrations validated live: summary, revenue trend, expense breakdown, products, profit trend, and Hot/Cold split.
- Numbered source decomposition: complete and frozen as the verified production structure.
- Production hardening: complete.
- Semantic versioning begins at 1.0.0; `10.Config.js` is the authoritative release metadata source.
- Version 1.0.0 is currently in production; `docs/RELEASE.md` owns the release workflow.
- Tailwind 3.4.17 is compiled locally into the clasp-tracked HTML partial.
- `runAllBackendTests()` is the unified local/live backend gate and requires 9/9 PASS, including sparse-dataset resilience.
- Final validation completed: clasp upload, all backend test entry points, a new deployment version, and deployed-dashboard rendering passed without application runtime errors.
- Sprint 5.8 Package 001 product audit is complete. `docs/PRODUCT-BACKLOG.md` is the prioritized evidence inventory; `docs/ROADMAP.md` schedules only Packages 002–004.
- Sprint 5.8 Package 002 empty/sparse-data resilience is implemented and locally validated; populated response output is snapshot-protected and the public response shape is unchanged. Upload and live Apps Script validation remain pending.
- Backend tests are responsibility-split across `92.Tests.Fixtures.js`, `94.Tests.Assertions.js`, `95.Tests.Validators.js`, `96.Tests.Cases.js`, and `98.Tests.Runner.js`; the sparse test explicitly logs its returned success summary for Apps Script execution visibility.

## Architecture and invariants

`buildAnalyticsCache()` builds Aggregate Engine once. Aggregate Engine is the sole production analytics source for Summary, Revenue Trend, Expense Breakdown, Top Products, Profit Trend, and Hot/Cold Split. Deterministic fixtures are authoritative for all six domains, and no legacy migration oracle remains. Preserve the `getDashboardData()` response, Apps Script globals, formulas, spreadsheet reads, case-sensitive categories, date behavior, and frontend contract.

All source uses the numbered ownership layout documented in `docs/ARCHITECTURE.md`; all 59 former-monolith function assignments are recorded in `docs/SOURCE-MIGRATION.md`.

## Workflow

Use VS Code and scoped Git diffs locally. Before an authorized upload, confirm the clasp account and `clasp status`; use force only when explicitly required. Run live functions in the Apps Script editor. Deployment and browser verification are separate approved steps.

Safe live entry points and known failure modes are documented in `docs/TESTING.md` and `docs/TROUBLESHOOTING.md`.

## Technical debt

- All six legacy migration oracle chains are retired. The unified backend suite uses deterministic fixtures only, source migration is complete, and Sprint 5.7 Package 005 is complete.
- The remaining P0 product gap is the visible transaction filter that currently reloads the same unfiltered response. Purchase-only semantics require approval before filter implementation.
- High-value requirement-gated work includes reporting periods/comparisons, data freshness and quality, unified actionable recommendations, and configurable KPI targets.
- Root `index.html` is a separate GitHub Pages redirect/launcher to the Apps Script UI, not a duplicate dashboard.
- Future releases must update `10.Config.js` and `docs/CHANGELOG.md` together.
- The Apps Script iframe emits its platform sandbox warning.

The iframe sandbox warning is known and non-blocking. It does not authorize frontend changes.
