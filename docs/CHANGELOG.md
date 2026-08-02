# NUMLOCK Changelog

This document records verified engineering milestones. NUMLOCK does not yet maintain formal semantic-version release metadata.

## Unreleased

### Documentation and workflow foundation

- Defined current and target architecture.
- Added an exact 59-function source migration map.
- Documented development, testing, deployment, Git, decisions, troubleshooting, and reference parity.
- Added concise AI project context and task/review templates.

### Sprint 5.6 — backend refactor

- Migrated summary, revenue trend, expense breakdown, product analytics, profit trend, and Hot/Cold split to a single Aggregate Engine cache.
- Retained throwing legacy-equivalence validators.
- Completed live Apps Script validation for `getDashboardData()` and all six dedicated migration test entry points.
- Decomposed the backend into numbered data, analytics, intelligence, orchestration, and test owners.
- Renamed the web entry point and frontend to `100.Code.js` and `190.View.Index.html`.
- Froze the completed numbered source architecture after confirming unique function ownership and the final clasp inventory.
- Completed a successful clasp upload and live Apps Script validation for `getDashboardData()`, `testAggregate()`, and all six migration tests.
- Created and activated a new deployment version; the dashboard rendered successfully with no application runtime errors.
- Recorded the non-blocking Tailwind CDN production warning and Apps Script iframe sandbox warning as frontend technical debt.

### Sprint 5.5 — Dashboard Intelligence

- Completed the current dashboard intelligence outputs and frontend consumption contract.

## Known technical debt

- Tailwind is currently loaded from its CDN and emits a production-use warning.
- The Apps Script runtime emits an iframe sandbox warning.
