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
- `runAllBackendTests()` is the unified local/live backend gate and requires 8/8 PASS.
- Final validation completed: clasp upload, all backend test entry points, a new deployment version, and deployed-dashboard rendering passed without application runtime errors.

## Architecture and invariants

`buildAnalyticsCache()` builds Aggregate Engine once. Migrated production builders consume cached aggregate outputs; legacy builders remain validation-only. Preserve the `getDashboardData()` response, Apps Script globals, formulas, spreadsheet reads, case-sensitive categories, date behavior, and frontend contract.

All source uses the numbered ownership layout documented in `docs/ARCHITECTURE.md`; all 59 former-monolith function assignments are recorded in `docs/SOURCE-MIGRATION.md`.

## Workflow

Use VS Code and scoped Git diffs locally. Before an authorized upload, confirm the clasp account and `clasp status`; use force only when explicitly required. Run live functions in the Apps Script editor. Deployment and browser verification are separate approved steps.

Safe live entry points and known failure modes are documented in `docs/TESTING.md` and `docs/TROUBLESHOOTING.md`.

## Technical debt

- Legacy migration oracles remain intentionally; the Package 004 audit found none safe to remove before independent fixture coverage replaces them.
- Future releases must update `10.Config.js` and `docs/CHANGELOG.md` together.
- The Apps Script iframe emits its platform sandbox warning.

The iframe sandbox warning is known and non-blocking. It does not authorize frontend changes.
