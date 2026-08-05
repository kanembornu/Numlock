# NUMLOCK Project Status

This is the living executive answer to “where is NUMLOCK now?” It summarizes current repository evidence without replacing the detailed owners linked in [Documentation status](#documentation-status).

## 1. Project identity

NUMLOCK is a Google Apps Script V8 and Google Sheets business-intelligence dashboard for coffee-shop transactions. The Apps Script web entry point serves the numbered HTML frontend, and the dashboard is backed by the Aggregate Engine and spreadsheet services.

## 2. Current status

**Feature Complete v1.0**

The documented bounded v1.0 feature baseline is implemented, stabilized, and accepted in production. Candidate `658f4ab1011633e86634f14ce838a514c5205df0` passed the repository preflight, Apps Script live 25/25 suite, immutable deployment, deployed-browser acceptance, and production-health verification.

## 3. Current version

**1.0.0 — Production**

`10.Config.js` owns executable version metadata. [CHANGELOG.md](CHANGELOG.md) owns release history, and [RELEASE.md](RELEASE.md) owns the release process.

## 4. Current phase

**Post-release maintenance and authorized UI/UX 2.0 discovery**

Feature development remains paused after v1.0 closeout. UI/UX 2.0 Packages 001–004 completed authorized documentation-only information architecture, low-fidelity wireframes, visual-direction discovery, and an implementation-ready component/theme contract without changing the v1.0 application, source, styling, data contracts, deployment, or release metadata.

## 5. Latest completed sprint/package

**UI/UX 2.0 Package 004 — component library and theme contract — complete on 2026-08-05.** The documentation-only package defines the approved one-viewport tabbed shell, four primary destinations, complete light/dark semantic tokens, component/state/accessibility contracts, bounded Settings and session-local Logs scopes, measurable responsive behavior, and nine independently reviewable implementation slices. It supersedes the earlier two-destination discovery decision only for later UI/UX 2.0 work; current v1.0 production remains unchanged. No production source, Tailwind, production HTML, clasp, deployment, release metadata, commit, or push changed.

## 6. Current test gate and evidence level

`runAllBackendTests()` contains exactly **25 ordered entries** and remains fail-fast.

| Evidence class | Current recorded evidence |
| --- | --- |
| Local/static | Release candidate `658f4ab1011633e86634f14ce838a514c5205df0`: dependency install, production/frontend syntax, manifest parse, Markdown links, eight focused release contracts, unified 25/25, runner count, and Git checks passed on 2026-08-05. |
| Upload | Authorized clasp identity and the exact 26-file inventory were confirmed; `clasp push --force` completed with `Script is already up to date.` for candidate `658f4ab1011633e86634f14ce838a514c5205df0`. |
| Apps Script runtime | Candidate `658f4ab1011633e86634f14ce838a514c5205df0`: live `runAllBackendTests()` PASS 25/25. |
| Deployment | Existing stable production deployment updated to immutable version 185; stable URL unchanged. Immutable version 184 retained for rollback. |
| Deployed browser | PASS for the version 185 production deployment. |
| Production health | PASS for version `1.0.0 — Production` on immutable deployment version 185. |

An upload is not runtime, deployment, or browser evidence.

## 7. Overall completion summary

The bounded dashboard capability set is implemented: Aggregate Engine analytics, resilient date-scoped states, responsive and accessible presentation, reporting metadata, data-quality visibility, charts, period comparison, Business Priority, explainable targets, bounded client performance, print, visible-row CSV, and bounded recent-transaction drill-down. Three expansion scopes remain blocked by missing requirements or external evidence. No remaining feature scope is implementation-ready.

## 8. Completed milestone matrix

| Milestone | Evidence-backed outcome |
| --- | --- |
| Sprint 5.5 | Dashboard Intelligence complete. |
| Sprint 5.6 | Aggregate Engine migration and numbered source decomposition complete. |
| Sprint 5.7 | Production styling, unified test workflow, release metadata/workflow, and migration-oracle retirement complete. |
| Sprint 5.8 | Product audit, sparse-data resilience, authoritative date filtering, and recoverable dashboard states complete. |
| Sprint 5.9 | Responsive shell, reporting scope/freshness, data-quality visibility, chart comprehension, and pinned dependencies complete. |
| Sprint 5.10 | Accessibility, executive hierarchy, period comparison, Business Priority, and explainable KPI targets complete locally. |
| Sprint 5.11 | Bounded client-render performance complete and uploaded. |
| Sprint 5.12 | Print-ready filtered executive report complete. |
| Sprint 5.13 | Visible-row CSV and formula-injection hardening complete with live unified 25/25 evidence. |
| Sprint 5.14 | Bounded recent-transaction drill-down complete, committed, pushed, and uploaded. |
| Sprint 5.15 | Dashboard-response consumer inventory complete as documentation/discovery work. |
| Sprint 5.16 and v1.0 closeout | Sparse 37-field response contract complete; candidate live 25/25, deployment version 185, browser acceptance, and production health passed with rollback version 184 retained. |

## 9. Implementation-ready backlog

**Count: 0.** The bounded v1.0 baseline is closed. New implementation work requires a demand-driven maintenance need or satisfaction and separate authorization of a blocked scope's prerequisites.

## 10. Blocked backlog

**Count: 3.** [PRODUCT-BACKLOG.md](PRODUCT-BACKLOG.md) owns the detailed entries and dependencies.

1. Editable KPI targets — blocked by unapproved persistence, validation, permissions, migration, governance, and business-target semantics.
2. Dashboard API projection or payload reduction — blocked by unknown external consumers, deployment-access evidence, permission review, payload measurement, and an additive compatibility design.
3. Drill-down expansion beyond the existing maximum-ten-row projection — blocked by authorization, pagination, privacy, and approved detail-field requirements.

## 11. Technical debt

- The Apps Script iframe sandbox warning remains accepted platform output, not an application defect.
- Historical milestone sections retain their original runner totals; the active release workflow and current gate now require exactly 25/25.
- Editable targets, payload projection, and expanded drill-down must not be implemented until their blocked prerequisites are resolved.

## 12. Documentation status

Documentation ownership is explicit and non-overlapping:

- `PROJECT_STATUS.md` answers where the project is now.
- [ROADMAP.md](ROADMAP.md) owns direction, sequencing, and milestone placement.
- [PRODUCT-BACKLOG.md](PRODUCT-BACKLOG.md) owns remaining work, readiness, blockers, and dependencies.
- [CHANGELOG.md](CHANGELOG.md) owns completed changes and release history.
- [DECISIONS.md](DECISIONS.md) owns durable engineering and product decisions.
- [TESTING.md](TESTING.md) owns validation contracts, runner semantics, and evidence levels.
- [RELEASE.md](RELEASE.md) owns release sequencing, deployment, browser acceptance, and rollback.
- `.ai/PROJECT_CONTEXT.md` provides concise session continuity and points here for executive status.

Historical evidence remains in its owning document; this file summarizes current conclusions only.

## 13. Release-readiness checklist

The v1.0 readiness audit on 2026-08-05 produced this criterion matrix. `PASS` means the criterion is supported at the stated evidence level; it does not imply a later evidence level.

| Release criterion | Status | Highest current evidence | Closeout requirement |
| --- | --- | --- | --- |
| Production architecture | PASS | Repository/static and production acceptance | Preserve the numbered Apps Script architecture and one Aggregate Engine build. |
| Analytics and intelligence | PASS | Apps Script live 25/25 and production acceptance | Maintain through the ordered unified gate. |
| Dashboard functionality | PASS | Deployed-browser and production acceptance | Maintain the accepted response and interaction contracts. |
| Responsive behavior | PASS | Deployed-browser acceptance | Recheck for any frontend maintenance release. |
| Accessibility | PASS | Deployed-browser acceptance | Preserve keyboard, focus, semantic, live-region, and reduced-motion contracts. |
| Performance | PASS | Local contract and deployed-browser acceptance | Preserve bounded DOM queries, deferred work, and response immutability. |
| Print and CSV export | PASS | Apps Script live contract and deployed-browser acceptance | Preserve visible-scope and CSV-safety contracts. |
| Drill-down | PASS | Local contract and deployed-browser acceptance | Preserve the existing maximum-ten-row boundary. |
| Response-contract coverage | PASS | Local and Apps Script live 25/25 | Preserve exactly 37 top-level fields and the five-member `dateFilter` contract. |
| Documentation | PASS | Repository/static | Record release completion and retain historical evidence. |
| Rollback readiness | PASS | Immutable version 184 retained | Repoint the same stable deployment to version 184 if rollback is required. |
| Dependency pinning | PASS | Repository/static and deployed-browser acceptance | Keep exact dependency versions and local Tailwind ownership. |
| Known technical debt | PASS | Repository/documentation | Keep the three gated expansions deferred; accept only the documented Apps Script iframe warning. |

**Mandatory v1.0 blockers: none.** Editable targets, payload projection, and expanded drill-down remain optional future work and are not v1.0 blockers.

- [x] Feature Complete v1.0 status is supported by explicit acceptance evidence.
- [x] Current runner membership is 25 and the latest local 25/25 result is recorded.
- [x] Remaining backlog is classified as zero ready and three blocked scopes.
- [x] Reconcile stale `10/10` and legacy runner references in `RELEASE.md` before executing a release.
- [x] Start release operations from a clean, reviewed Git worktree.
- [x] Run the current 25-entry unified gate locally against the exact release candidate.
- [x] Review clasp inventory and upload only with explicit authorization.
- [x] Run `runAllBackendTests()` successfully in the intended Apps Script project: 25/25 PASS.
- [x] Update the existing production deployment to immutable version 185 while retaining the stable URL.
- [x] Pass desktop and narrow-width browser acceptance, including Console and Network review.
- [x] Confirm `1.0.0 — Production`, deployment version 185, production health, and rollback version 184 agree.

## 14. Hold criteria

Hold release promotion and new feature implementation when any of these conditions is true:

- the current local unified gate is not exactly 25/25;
- the release candidate differs from the reviewed/uploaded inventory;
- Git status contains unexplained or unreviewed changes;
- Apps Script runtime, deployment, or browser evidence required by the release checklist is missing or failing;
- release metadata or current-status documents conflict;
- a proposed scope depends on unresolved permissions, privacy, persistence, external-consumer, pagination, payload-benefit, or business-rule decisions; or
- a change would alter the default dashboard response or expand data access without an approved compatibility and authorization contract.

## 15. Resume criteria

The v1.0 release is complete. Resume feature implementation only for approved demand-driven maintenance or a separately authorized enhancement whose acceptance and rollback boundaries are defined in advance.

Resume a blocked feature only when every dependency listed for that scope in [PRODUCT-BACKLOG.md](PRODUCT-BACKLOG.md) has an evidence-backed decision, acceptance contract, privacy/permission boundary, rollback approach, and independently releasable validation plan.

## 16. Future vision

After v1.0 stabilization, NUMLOCK may evolve from a bounded dashboard into a governed decision-support workspace with configurable goals, faster purpose-specific payloads, and authorized transaction exploration. Each capability remains optional and must preserve spreadsheet ownership, Apps Script compatibility, privacy, accessibility, and backward-compatible defaults.

## 17. UI/UX 2.0 roadmap

**Design contract complete; not implemented.** Package 001 records the historical [UI/UX 2.0 Information Architecture](UIUX-2.0-INFORMATION-ARCHITECTURE.md), Package 002 records the [Low-Fidelity Wireframes](UIUX-2.0-WIREFRAMES.md), Package 003 records the [Visual Direction System](UIUX-2.0-VISUAL-DIRECTIONS.md), and Package 004 records the approved [Component Library and Theme Contract](UIUX-2.0-COMPONENT-LIBRARY.md). Package 004's later product decisions supersede the two-destination discovery baseline for UI/UX 2.0: Dashboard, Transactions, Settings, and Logs are approved primary destinations, while future financial modules remain absent until usable. Existing analytics, intelligence, forecast, performance, and Data Quality capabilities remain bounded tab content, disclosures, or contextual actions.

1. Validate user roles, top decision journeys, device profiles, and measurable usability baselines.
2. Prototype a clearer task-oriented information architecture without replacing the current accessible responsive shell.
3. Define a versioned design system for tokens, components, states, tables, charts, focus, reduced motion, and print/export parity.
4. Test prototypes for executive scanning, data-quality triage, bounded evidence exploration, keyboard use, and narrow screens.
5. Ship only approved, independently releasable slices with preserved v1 contracts and explicit rollback.

UI/UX 2.0 must not imply editable targets, broader transaction access, API projection, or new persistence until the corresponding backlog blockers are resolved.

## 18. Next milestone

**UI/UX 2.0 implementation Package 005 — shell and theme foundation, pending separate authorization.** The component contract is complete enough to begin the first bounded implementation slice without new visual invention. No production implementation, high-fidelity mockup, or browser acceptance is currently authorized or complete.

## 19. Status-history log

| Date | Status | Evidence summary |
| --- | --- | --- |
| 2026-08-03 | Production 1.0.0 | Release history records production 1.0.0 and earlier deployment/browser acceptance. |
| 2026-08-04 | Stabilization expansion | Sprints 5.10–5.12 completed locally with evidence levels recorded separately. |
| 2026-08-05 | Release Candidate | Repository preflight and upload prerequisites passed for candidate `658f4ab1011633e86634f14ce838a514c5205df0`. |
| 2026-08-05 | Feature Complete v1.0 | Live suite passed 25/25; immutable deployment version 185, unchanged stable URL, deployed-browser acceptance, and production health passed; version 184 retained for rollback. |
| 2026-08-05 | UI/UX 2.0 discovery | Package 001 mapped all current capabilities, selected a two-destination Dashboard/Transactions architecture, and deferred Reports and Settings; documentation only, with no mockup or production change. |
| 2026-08-05 | UI/UX 2.0 discovery | Package 002 defined four low-fidelity desktop/mobile wireframes, compared two Dashboard variants, and recommended Executive-first for later high-fidelity work; documentation only, with no production or Tailwind change. |
| 2026-08-05 | UI/UX 2.0 discovery | Package 003 compared four visual directions, selected Executive Minimal and Modern Financial for later high-fidelity comparison, and defined preliminary shortlisted tokens; documentation only, with no production or Tailwind change. |
| 2026-08-05 | UI/UX 2.0 design contract | Package 004 defined the one-viewport tabbed shell, four approved destinations, full light/dark tokens, component/accessibility rules, truthful Settings and session-local Logs boundaries, and implementation slices; documentation only, with no production or Tailwind change. |
