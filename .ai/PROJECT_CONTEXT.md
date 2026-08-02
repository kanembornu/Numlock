# NUMLOCK Project Context

Read `AGENTS.md` first; it is the operating contract. This file provides continuity, not authorization.

## Project

NUMLOCK is a Google Apps Script V8 and Google Sheets business-intelligence dashboard for coffee-shop transactions. `Code.js#doGet()` serves `Index.html`; the browser calls `getDashboardData()` in `DashboardService.js`.

## Current state

- Sprint 5.5 Dashboard Intelligence: complete.
- Sprint 5.6 backend refactor: in progress.
- Aggregate migrations validated live: summary, revenue trend, expense breakdown, products, profit trend, and Hot/Cold split.
- Next approved phase: behavior-preserving numbered source decomposition.

## Architecture and invariants

`buildAnalyticsCache()` builds Aggregate Engine once. Migrated production builders consume cached aggregate outputs; legacy builders remain validation-only. Preserve the `getDashboardData()` response, Apps Script globals, formulas, spreadsheet reads, case-sensitive categories, date behavior, and frontend contract.

Current source remains `DashboardService.js`, `Code.js`, and `Index.html`. Target ownership and all 59 function moves are documented in `docs/SOURCE-MIGRATION.md`.

## Workflow

Use VS Code and scoped Git diffs locally. Before an authorized upload, confirm the clasp account and `clasp status`; use force only when explicitly required. Run live functions in the Apps Script editor. Deployment and browser verification are separate approved steps.

Safe live entry points and known failure modes are documented in `docs/TESTING.md` and `docs/TROUBLESHOOTING.md`.

## Technical debt

- `DashboardService.js` is monolithic.
- Legacy migration oracles remain intentionally.
- Inline configuration literals have not been classified for `10.Config.js`.
- No formal release/version metadata system exists.
