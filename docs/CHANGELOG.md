# NUMLOCK Changelog

This document records verified engineering milestones. Semantic versioning begins at `1.0.0`; future releases must update this changelog and `10.Config.js` together.

## Unreleased

- Retired the legacy Summary oracle, validator, and migration test after deterministic Summary fixtures and the unified suite passed live.
- Replaced the aggregate diagnostic's legacy Summary comparison with direct Aggregate Engine invariant checks.
- Completed the initial production-source audit, which retained migration oracles until deterministic replacement coverage was proven.
- Established `docs/RELEASE.md` as the authoritative release workflow, semantic-versioning policy, and release-checklist owner.
- Added consistent VS Code tasks for Tailwind build, clasp inventory, clasp push, and local preflight.

## 1.0.0 — Production — 2026-08-03

- Established `10.Config.js` as the authoritative release and version metadata source.
- Completed and froze the verified production source structure.
- Completed production hardening while preserving dashboard behavior and data contracts.

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

- Five legacy migration oracles remain until independent deterministic regression fixtures replace their equivalence coverage.
- The Apps Script runtime emits an iframe sandbox warning.
