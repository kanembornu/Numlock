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

### Sprint 5.5 — Dashboard Intelligence

- Completed the current dashboard intelligence outputs and frontend consumption contract.

## Next

- Decompose the monolithic server source into the approved numbered files without behavior changes.
