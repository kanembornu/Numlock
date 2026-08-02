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

### Sprint 5.5 — Dashboard Intelligence

- Completed the current dashboard intelligence outputs and frontend consumption contract.

## Next

- Validate the final numbered inventory in Apps Script and the deployed dashboard when explicitly authorized.
