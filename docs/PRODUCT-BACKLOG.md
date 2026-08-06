# NUMLOCK Sprint 5.8 Product Backlog

This document owns remaining work, readiness, blockers, dependencies, and acceptance needs. [Project Status](PROJECT_STATUS.md) owns the current executive summary; [Roadmap](ROADMAP.md) owns direction and sequencing. Historical implementation detail belongs in [CHANGELOG.md](CHANGELOG.md).

## Current closure classification

The v1.0 feature/backend baseline is stable, but UI/UX 2.0 is reopened for the ordered visual and navigation work in the [UI/UX 2.0 Gap Audit](UIUX-2.0-GAP-AUDIT.md). Historical item narratives remain historical.

| Classification | Count | Items | Resume boundary |
| --- | ---: | --- | --- |
| Active UI/UX completion | 9 packages | Packages 014–022: skills, specification, navigation, reconstruction, parity, refactor, regression/visual acceptance | Preserve the stable backend and authorize each package separately. |
| Blocked by requirements, governance, privacy, or permissions | 3 | Editable KPI targets; API projection/payload reduction; expanded transaction history/drill-down | Resolve every documented persistence, governance, consumer, permission, privacy, pagination, measurement, compatibility, and rollback prerequisite. |
| Future major capability | 5 | Migrated Products module; Capital & Equity; Assets; Depreciation; Financial Statements | Sidebar entries may be unavailable; usable pages require approved architecture, migration, calculations, permissions, acceptance, versioning, and rollback. |
| Maintenance-only | Demand-driven | Defect, security, dependency, accessibility, documentation, operational, monitoring, or behavior-preserving performance work | Require a reproducible need, bounded scope, preserved contracts, validation, and release evidence appropriate to risk. |

The blocked and future-major items are not current defects. Their supporting data, permissions, governance, or migration contracts do not yet exist.

## Scope and evidence

This backlog is the documentation outcome of Sprint 5.8 Package 001. It is grounded in the production contracts in `10.Config.js`, `70.Intelligence.Score.js`, `75.Intelligence.Diagnosis.js`, `80.Intelligence.Recommendation.js`, `85.Intelligence.Decision.js`, `90.Dashboard.Service.js`, the responsibility-split `92`–`98` test files, and `190.View.Index.html`, plus the governing repository documentation. It proposes product work only; no production source, frontend, deployment, or release metadata changed during the audit.

The current dashboard already has a clear two-destination navigation model, a broad executive-to-operational information hierarchy, KPI cards, three Chart.js visualizations, skeletons for initial KPIs/charts, recent transactions, deterministic backend coverage, and explicit Chart destruction before recreation. Generated Tailwind CSS is approximately 18 KB and is not presently a size concern. No duplicated event-listener registration was found.

Sprint 5.10 is complete locally. All P0 items and the implemented portions of P1 and P2 are covered by the ordered 22-test gate established at that closure. Upload, Apps Script runtime, deployment, and browser acceptance were not rerun during that audit and remain separate evidence. P1-5 target editing remains requirement-gated; the bounded P2-5 frontend scope was subsequently completed in Sprint 5.11.

Sprint 5.11 is complete. Its bounded P2-5 frontend scope is committed at `46e42b1`, covered by the ordered local 23/23 gate, and uploaded in the reviewed 26-file clasp inventory. Live Apps Script, deployment, and browser evidence remain unverified. Remaining gated work includes editable KPI targets, API projection, CSV export, and drill-down; each requires additional product, consumer, permission, or privacy decisions.

Sprint 5.12 is complete at verified commit `0e6dcdc`. Its print-ready filtered executive report includes print metadata, an authored A4 portrait contract, and preserved accessibility, and the latest verified ordered gate is local 24/24. Upload, Apps Script runtime, deployment, and browser print acceptance remain unverified. Remaining backlog is editable KPI targets, API projection, CSV export beyond the completed print capability, and KPI/chart drill-down.

Sprint 5.13 is complete. Package 001 CSV export and Package 002 formula-injection hardening passed live `testCsvExportContract()`, live `testClientRenderPerformanceContract()`, and live `runAllBackendTests()` 25/25. The accepted client-render contract preserves 72 ID queries, two selector queries, and no response mutation.

Sprint 5.14 is complete at commit `fe6c424`, pushed to `origin/main`, with the Apps Script source upload current. Its bounded drill-down uses only the active response's maximum ten recent transactions, introduces no backend/API/persistence behavior, and leaves CSV export scoped to the visible filtered table. Focused drill-down and local unified 25/25 validation were reconfirmed during closure; live Apps Script and deployed-browser acceptance remain unverified.

Sprint 5.15 is complete as a documentation/discovery sprint; its 37-field inventory is committed at `e373b9a`. The six non-rendered, contract-tested fields are opt-in projection candidates only, and the default response must remain unchanged. The remaining feature backlog is editable KPI targets, dashboard API projection or payload reduction, and drill-down expansion beyond the existing recent-transaction projection. Editable targets remain blocked by persistence and governance requirements; API projection remains blocked by unknown external consumers, deployment access evidence, permission review, payload measurement, and an additive compatibility design; expanded drill-down remains blocked by authorization, pagination, and privacy requirements.

Sprint 5.16 Package 001 completes and uploads bounded response-contract completeness. The sparse oracle now includes `dateFilter`, requires exactly all 37 top-level fields, and structurally validates its five required members without changing production source, response behavior, existing additive metadata checks, targeted entry points, or ordered 25-entry runner. Focused local validation passed seven fixtures and the unified local gate passed 25/25; Apps Script runtime remains unverified. Editable targets, API projection, and expanded drill-down remain requirement-gated as recorded above.

## v1.0 backlog disposition

- **Implementation-ready:** 0 items.
- **Blocked optional work:** 3 scopes — editable KPI targets; additive dashboard projection/payload reduction; drill-down expansion beyond the current maximum-ten-row projection.
- **Mandatory v1.0 blockers:** none. Release evidence is complete and owned by [`RELEASE.md`](RELEASE.md).

The v1.0 release evidence is complete. The three blocked scopes remain non-blocking because v1.0 does not require editable configuration, a reduced payload, expanded transaction access, new persistence, or pagination. Resume any one only after all of its documented governance, consumer, permission/privacy, measurement, compatibility, and rollback prerequisites are approved and measurable. Feature development is otherwise paused; maintenance and demand-driven enhancements require explicit bounded authorization. UI/UX 2.0 discovery must not silently absorb these scopes.

## Priority rules

- **P0:** a current control is misleading, a valid state can break the dashboard, or the user can be blocked.
- **P1:** a high-value product capability materially improves decision quality or trust.
- **P2:** usability, accessibility, readability, or performance improves without changing core business capability.
- **P3:** useful optional capability whose exact product requirements are not yet established.

## P0 — correctness or user-blocking issues

### P0-1 — Make empty and sparse datasets safe end to end

**Status: Completed locally in Sprint 5.8 Package 002; upload and live Apps Script validation are pending.**

- **Problem:** `buildInsights()` returns `topExpense: null` when there are no expenses, but `buildDiagnosis()` unconditionally reads `insights.topExpense.category` and `.amount`. Several frontend regions also render empty arrays as blank space rather than an explained state.
- **User impact:** a new, cleared, or sales-only sheet can fail the dashboard request or leave charts, recommendations, and transactions unexplained.
- **Proposed solution:** define compatibility-safe empty outputs for diagnosis and every visible collection; guard missing top expense/product values; render explicit no-data states without changing populated-data shapes.
- **Files likely affected:** `75.Intelligence.Diagnosis.js`, `90.Dashboard.Service.js`, `95.Tests.js`, `190.View.Index.html`, `docs/TESTING.md`.
- **Implementation complexity:** M
- **Regression risk:** Medium
- **Validation required:** deterministic no-row, sales-only, purchase-only, and sparse-data fixtures; local `runAllBackendTests()` 11/11; extracted frontend script syntax; browser acceptance for empty and populated data at desktop and narrow widths.
- **Dependency on other items:** None.

### P0-2 — Make the transaction filter truthful

**Status: Completed locally in Sprint 5.8 Package 003 by replacing the unsupported transaction-type control with the approved authoritative date filter. Upload and live validation are pending.**

- **Problem:** the UI offers All, Sales Only, and Purchase Only, but `onchange="loadData()"` calls parameterless `getDashboardData()` and never reads or applies `#filter`.
- **User impact:** users believe the dashboard has changed scope when every KPI, chart, intelligence output, and transaction remains unfiltered.
- **Proposed solution:** implemented one date-range contract across the entire response and removed the unsupported transaction-type choices. Transaction-type filtering remains out of scope.
- **Files likely affected:** `90.Dashboard.Service.js`, `95.Tests.js`, `190.View.Index.html`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`.
- **Implementation complexity:** M
- **Regression risk:** High
- **Validation required:** deterministic All/Sales/Purchase contracts; backward-compatible parameterless call; filter transition and stale-response browser tests; confirmation that every displayed metric uses the same scope.
- **Dependency on other items:** None.

## P1 — high-value product improvements

### P1-1 — Add a date range and explicit period comparison contract

**Status: Completed locally in Sprint 5.10 Package 003; upload and live/browser validation pending.**

- **Problem:** the dashboard now has an authoritative visible date range, but labels that imply comparison still lack an explicit previous-period contract and forecast interpretation remains implicit.
- **User impact:** executives cannot tell which dates a KPI covers or confidently interpret growth comparisons.
- **Implemented solution:** retained the shared active range and added `periodComparison` for the immediately equivalent prior period. Both subsets reuse the once-processed rows; the prior period computes only required metrics, and one compact accessible comparison appears in the Executive Summary.
- **Files affected:** `90.Dashboard.Service.js`, `92.Tests.Fixtures.js`, `96.Tests.Cases.js`, `98.Tests.Runner.js`, `190.View.Index.html`, generated Tailwind CSS, and architecture/testing documentation.
- **Implementation complexity:** L
- **Regression risk:** High
- **Validation required:** 23 deterministic scenarios covering every preset, timezone-safe boundaries, shorter months, leap years, empty/zero periods, signed profit transitions, finite values, one-read/one-process architecture, and frontend status rendering; unified 20/20 plus browser filter acceptance.
- **Dependency on other items:** P0-2 complete; the exact comparison semantics are now approved and implemented.

### P1-2 — Display data freshness and reporting scope

**Status: Completed locally in Sprint 5.9 Package 002; upload and live/browser validation are pending.**

- **Problem:** the response has no generated-at timestamp, latest source transaction date, row count, or visible reporting scope, although the header claims a real-time overview.
- **User impact:** users cannot distinguish current data from a stale or incomplete sheet and may act on an old snapshot.
- **Proposed solution:** add backward-compatible metadata containing generation time, source maximum date, included-row count, and active scope; display a concise “updated/data through” indicator.
- **Files likely affected:** `30.Analytics.Aggregate.js`, `90.Dashboard.Service.js`, `95.Tests.js`, `190.View.Index.html`.
- **Implementation complexity:** M
- **Regression risk:** Low
- **Validation required:** empty and populated metadata fixtures, time-zone formatting, response serialization, browser display at desktop/narrow widths.
- **Dependency on other items:** P0-2; should share the later P1-1 scope object but can ship first with All-data metadata.

### P1-3 — Add data-quality diagnostics

**Status: Completed locally in Sprint 5.9 Packages 003–004; Package 004 preserves source invalid-date visibility while keeping analytics scoped. Upload and live/browser validation are pending.**

- **Problem:** users receive business conclusions without visible counts for ignored, incomplete, unpriced, invalid-date, or unknown-category rows. Existing deterministic tests validate analytics outputs but not an operator-facing quality summary.
- **User impact:** apparently precise scores and recommendations can conceal incomplete inputs.
- **Proposed solution:** implemented additive observational diagnostics with source-level invalid-date inspection, five other issue types over active scoped rows, deterministic severity/status, source/scoped/excluded counts, and a compact accessible disclosure. No rows are modified and analytics exclusion rules are unchanged.
- **Files likely affected:** `25.Data.Processor.js`, `30.Analytics.Aggregate.js`, `90.Dashboard.Service.js`, `95.Tests.js`, `190.View.Index.html`.
- **Implementation complexity:** M
- **Regression risk:** Medium
- **Validation required:** fixtures for missing price/category/date/product and ignored rows; invariant that valid-row metrics do not change; browser warning and clean-state acceptance.
- **Dependency on other items:** P1-2 for placement and shared metadata presentation.

### P1-4 — Unify decision priority and make recommendations executable

**Status: Completed locally in Sprint 5.10 Package 004; upload and live/browser validation pending.**

- **Problem:** diagnosis sorts by `level`, recommendations sort by independent numeric scores, business focus uses a separate ordered rule set, risk uses a count, and the executive summary uses direction/status. The UI repeats recommendations across several sections, while actions lack owner, due date, measurable outcome, evidence link, or completion state.
- **User impact:** users can see multiple “top” messages with unclear precedence and cannot turn advice into accountable work.
- **Implemented solution:** added one backward-compatible `businessPriority` with level, title, reason, executable action, source, finite score, and evidence. It ranks existing signals without mutating them, uses score plus fixed source tie-breaking, keeps Critical Data Quality distinct, and replaces only the first-viewport primary-action presentation.
- **Files likely affected:** `75.Intelligence.Diagnosis.js`, `80.Intelligence.Recommendation.js`, `85.Intelligence.Decision.js`, `90.Dashboard.Service.js`, `95.Tests.js`, `190.View.Index.html`.
- **Implementation complexity:** L
- **Regression risk:** High
- **Validation required:** 20 deterministic scenarios spanning all precedence branches, empty fallback, tie-breaking, finite bounds, evidence completeness, non-mutation, deterministic repeats, single first-viewport ownership, responsive/accessibility preservation, and unified 21/21; browser hierarchy/content review remains required.
- **Dependency on other items:** P1-1 is complete and provides additive comparison evidence.

### P1-5 — Make KPI targets configurable and explainable

**Status: Explainability completed locally in Sprint 5.10 Package 005; editing remains intentionally out of scope. Upload and live/browser validation are pending.**

- **Implemented solution:** centralize all stable existing KPI and business-status thresholds in deeply immutable `KPI_TARGET_CONFIG`; preserve dynamic Revenue, Profit, and Units targets from KPI Achievement; expose additive system-defined target metadata; and render a compact accessible Business Performance disclosure with no editing affordance.
- **Classification boundary:** score weights/penalties, candidate scores/tie-breaks, arithmetic zero guards, collection limits, and mechanical percentage caps remain local because they are formula mechanics rather than target or status thresholds.
- **Files affected:** `10.Config.js`, intelligence consumers, `90.Dashboard.Service.js`, `190.View.Index.html`, deterministic test fixtures/cases/runner, and governing documentation.
- **Validation required:** exact historical boundary/output preservation, deep immutability, public metadata completeness and uniqueness, accessible/responsive disclosure behavior, unified 22/22, deterministic Tailwind build, clasp inventory/upload, live Apps Script tests, and browser acceptance.

- **Problem:** revenue, profit, and unit targets are derived from current actuals, the margin target is hard-coded to 15%, and Business Score uses other hard-coded thresholds. Users cannot see target provenance or set business-specific goals.
- **User impact:** KPI achievement can appear authoritative while moving with actual performance and may not match management goals.
- **Proposed solution:** define validated configuration storage and fallback defaults, expose actual/target/provenance, and document how targets influence scoring and recommendations.
- **Files likely affected:** `10.Config.js` or an approved spreadsheet configuration source, `70.Intelligence.Score.js`, `80.Intelligence.Recommendation.js`, `90.Dashboard.Service.js`, `95.Tests.js`, `190.View.Index.html`.
- **Implementation complexity:** L
- **Regression risk:** High
- **Validation required:** default-equivalence tests, configured-target fixtures, invalid/missing configuration fallback, authorization/read behavior, browser target labeling.
- **Dependency on other items:** P1-4; storage location, editable roles, and approved default targets are unavailable product requirements and must be decided before implementation.

## P2 — UX and performance improvements

### P2-0 — Improve executive presentation hierarchy

**Status: Completed locally in Sprint 5.10 Package 002; upload and live Apps Script validation pending.**

- **Problem:** executive conclusions, attention signals, priorities, KPIs, and decision-support cards were separated across a long page with inconsistent terminology, spacing, and badge capitalization.
- **User impact:** a business owner had to scan multiple repeated executive regions before understanding performance, urgency, and the next action.
- **Implemented solution:** placed a three-part Executive Summary first, followed by consistently spaced KPIs; retained factual performance detail, distinct business signals, prioritized recommendations, decision support, risk/growth, and product performance while removing duplicate executive cards and tightening vertical rhythm.
- **Files affected:** `190.View.Index.html`, `96.Tests.Cases.js`, `98.Tests.Runner.js`, and governing documentation.
- **Regression risk:** Low; presentation-only markup, copy, spacing, and ordered static contract changes.
- **Validation required:** `testExecutivePresentationContract()`, accessibility, frontend-dependency, chart-presentation, unified 19/19 suite, generated Tailwind build, clasp inventory/upload, and live Apps Script execution.
- **Dependency on other items:** P2-1 and P2-2 responsive/accessibility contracts are preserved and rechecked.

### P2-1 — Establish a responsive narrow-width shell and table

**Status: Completed locally in Sprint 5.9 Package 001; upload and live/browser validation are pending.**

- **Problem:** the sidebar is fixed at `w-72`, main content always uses `ml-72 p-10`, the intelligence subgrid remains two columns, and the transactions table has no horizontal overflow wrapper. Responsive rules primarily start at large/extra-large widths.
- **User impact:** narrow screens lose substantial viewport width and may clip dense cards or transaction columns.
- **Proposed solution:** add a keyboard-operable compact navigation pattern, responsive main spacing/typography, single-column intelligence cards, and a deliberate mobile table treatment.
- **Files likely affected:** `190.View.Index.html`, `tailwind.config.js`, generated `189.View.Tailwind.html`.
- **Implementation complexity:** M
- **Regression risk:** Medium
- **Validation required:** compiled CSS build, representative 320/375/768/1280px browser acceptance, navigation/table interaction, no horizontal page overflow.
- **Dependency on other items:** None.

### P2-2 — Add accessible semantics and keyboard state

**Status: Completed locally in Sprint 5.10 Package 001; upload and live/browser validation are pending.**

- **Problem:** the document has no language/title metadata, the filter has no label, navigation state is communicated only by initial styling, inline SVGs lack accessibility treatment, chart canvases have no text alternative, and loading/error changes are not announced.
- **User impact:** screen-reader and keyboard users receive incomplete state and chart information; focus/active navigation is unclear.
- **Proposed solution:** implemented document/landmark semantics, labeled and validated date controls, active-state and focus management, bounded live regions, hidden-content focus exclusion, reduced-motion handling, accessible chart summaries, and table caption/header scope.
- **Files likely affected:** `190.View.Index.html`, `tailwind.config.js`, generated `189.View.Tailwind.html`.
- **Implementation complexity:** M
- **Regression risk:** Low
- **Validation required:** keyboard-only flow, automated accessibility scan, screen-reader spot check, contrast/focus/reduced-motion review, compiled CSS validation.
- **Dependency on other items:** P2-1 for the final navigation interaction.

### P2-3 — Replace indefinite loading with recoverable error states

**Status: Completed locally in Sprint 5.8 Package 004; upload and live/browser validation are pending.**

- **Problem:** the failure handler writes only two console errors; skeletons and “Loading…” content remain, with no visible explanation or retry. Invalid responses similarly stop after console output.
- **User impact:** server/network/contract failures look like endless loading and provide no recovery path.
- **Proposed solution:** use one visible status region with loading, success, empty, and sanitized failure states; always clear skeletons; add retry and retain concise developer diagnostics.
- **Files likely affected:** `190.View.Index.html`, optionally `90.Dashboard.Service.js` for additive diagnostic codes, `95.Tests.js`.
- **Implementation complexity:** S
- **Regression risk:** Low
- **Validation required:** mocked success, server failure, null response, missing-summary, and retry flows; console policy check; keyboard and live-region verification.
- **Dependency on other items:** P0-1 for shared empty-state language.

### P2-4 — Improve chart comprehension and zero-data behavior

**Status: Completed locally in Sprint 5.9 Package 005; upload and live/browser validation are pending.**

- **Problem:** month labels discard the year, the doughnut relies on color/legend, expense labels can crowd, canvases have no visible empty state, and all charts use fixed 24rem height. Revenue and expense axes abbreviate values without an explicit currency/unit label.
- **User impact:** cross-year trends can be ambiguous, color-dependent interpretation is harder, and zero-data charts can look broken.
- **Proposed solution:** implemented `MM/YYYY` Revenue labels, unit-aware tooltips, finite Hot/Cold percentages, accessible titled regions and filter-updated summaries, readable horizontal Expense labels, strict Chart destruction, and intentional per-chart zero-data placeholders.
- **Files likely affected:** `190.View.Index.html`, generated CSS if new classes are used.
- **Implementation complexity:** M
- **Regression risk:** Low
- **Validation required:** cross-year, single-point, long-category, all-zero, and normal chart fixtures; desktop/narrow browser visual and accessibility review.
- **Dependency on other items:** P0-1; P1-1 for authoritative period labels.

### P2-5 — Defer noncritical rendering and reduce avoidable client work

**Status: Bounded frontend-only scope completed and uploaded in Sprint 5.11 Package 001; live Apps Script and browser validation are pending. Sprint 5.15 Package 001 completed the repository inventory, but API projection remains blocked by unknown external consumers, deployment/permission evidence, payload measurement, and an additive compatibility design.**

- **Problem:** one approximately 48 KB HTML file contains the full runtime, and success synchronously renders every hidden and below-the-fold section. It performs 41 ID lookups and 18 HTML replacements per render; expense sorting mutates the response array. Six response fields (`financial`, `profitIntelligence`, `profitTrend`, `opportunities`, `kpiStatus`, and `productContribution`) are not directly consumed by the current view.
- **User impact:** initial interaction can be delayed on slower devices, repeated loads rebuild all charts/markup, and oversized responses/renders do work that is not immediately visible.
- **Proposed solution:** cache stable element references, render the active/above-the-fold view first, defer lower sections/transactions, avoid response mutation, suppress stale responses, and evaluate additive API projection only after confirming no external consumers.
- **Files likely affected:** `190.View.Index.html`, possibly `90.Dashboard.Service.js` and contract tests if an optional projection is approved.
- **Implementation complexity:** M
- **Regression risk:** Medium
- **Validation required:** render-order/stale-response tests, Chart instance-count check, performance trace on representative payload, response-contract compatibility, desktop/narrow browser acceptance.
- **Dependency on other items:** P0-2 if reloads remain filter-driven; the repository inventory is complete in [`DASHBOARD-CONSUMER-INVENTORY.md`](DASHBOARD-CONSUMER-INVENTORY.md), but external discovery, permission verification, payload measurement, and an additive full-response fallback remain required before payload reduction.

### P2-6 — Pin and resilience-test external frontend dependencies

**Status: Completed locally in Sprint 5.9 Package 006; upload and live/browser validation are pending.**

- **Problem:** Chart.js is loaded from an unversioned jsDelivr URL; Font Awesome is pinned to 6.0.0 but remains a CDN dependency. Either CDN failure can remove charts or icons, and Chart.js availability is not checked before rendering.
- **User impact:** third-party drift or outage can break core visualization without a useful message.
- **Proposed solution:** retained locally compiled Tailwind, pinned Chart.js 4.5.1 and the actively used Font Awesome 6.0.0, prohibited floating/duplicate URLs, and added graceful Chart.js failure behavior that preserves non-chart content and accessible summaries.
- **Files likely affected:** `190.View.Index.html`, optionally a new clasp-tracked generated asset and build configuration if vendoring is approved.
- **Implementation complexity:** S for pin/fallback; M for vendoring.
- **Regression risk:** Low
- **Validation required:** dependency version/source inventory, blocked-CDN browser test, chart compatibility suite, production Console/Network acceptance.
- **Dependency on other items:** P2-3 for the shared visible failure pattern.

## P3 — optional enhancements

### P3-1 — Add print/export views

**Status: Print completed in Sprint 5.12 Package 001; visible-transactions CSV and formula-injection hardening completed with live 25/25 acceptance in Sprint 5.13 Packages 001–002.**

- **Problem:** there is no print stylesheet or export action for executive reporting.
- **User impact:** users must copy or screenshot dashboard content for meetings and archives.
- **Proposed solution:** provide the completed print-optimized executive summary and browser-only CSV export of the currently rendered transaction rows and visible columns; do not export hidden spreadsheet data.
- **Files affected:** `190.View.Index.html` only for production behavior; no backend service or generated CSS change was required.
- **Implementation complexity:** M
- **Regression risk:** Medium
- **Validation required:** print visual acceptance; CSV filename, UTF-8, quote escaping, formula-injection neutralization, visible row/column scope, displayed ordering, empty state, Blob download, keyboard access, filter/date consistency, preserved 72/2 query budget, and unified 25/25.
- **Dependency on other items:** No dependency for bounded hardening of the already approved visible-field export; expanded fields or history remain separately permission-gated.

### P3-2 — Add KPI and chart drill-down

**Status: Bounded frontend scope completed, committed, pushed, and uploaded in Sprint 5.14 Package 001; expanded detail, authorization, pagination, Apps Script runtime, and browser acceptance remain separate.**

- **Problem:** KPI cards, charts, risks, and recommendations are summaries with no path to supporting transactions.
- **User impact:** users cannot verify a conclusion or identify the rows/products/categories that require action.
- **Implemented solution:** KPI and chart actions preserve the active period and filter the already-loaded maximum ten recent transaction rows. The Transactions view identifies this bound, announces the active drill-down and result count, and provides a keyboard-accessible clear action. No hidden detail, expanded history, backend/API call, persistence, or response change is introduced.
- **Files likely affected:** `90.Dashboard.Service.js`, `95.Tests.js`, `190.View.Index.html`, architecture/testing documentation.
- **Implementation complexity:** L
- **Regression risk:** High
- **Validation required:** scope/authorization tests, aggregation-to-detail reconciliation, large-result pagination, keyboard/modal behavior, privacy review.
- **Dependency on other items:** P1-1, P1-3, and P1-4 are complete. Any expansion beyond the existing recent transaction projection remains requirement- and authorization-gated.

## Completed implementation package

### Sprint 5.11 Package 001 — Bounded client-render performance

**Status: Completed and uploaded; live Apps Script and browser validation are pending.**

- **Objective:** implement the ready portion of P2-5 by caching stable DOM references, avoiding response-array mutation, and rendering the active executive view before below-the-fold sections.
- **User value:** improves initial interaction and repeat-filter responsiveness without removing business detail.
- **Implementation risk:** Medium, bounded by preserving the public response, current filter lifecycle, stale-response suppression, chart summaries, and Chart instance destruction.
- **Dependency readiness:** Ready for frontend-only work. API payload projection is explicitly excluded until external consumers are inventoried.
- **Expected validation:** render-order and stale-response tests, response immutability, Chart instance counts, representative performance trace, ordered unified 23/23 gate, and desktop/narrow browser acceptance.
- **Scope:** P2-5 only.

## Completed implementation package

### Sprint 5.12 Package 001 — Print-ready filtered executive report

**Status: Completed locally; upload, Apps Script runtime, and browser print acceptance remain separate evidence.**

- **Objective:** provide one accessible Print action and a print/PDF layout for the current filtered Executive Summary, visible supporting KPIs, reporting scope, freshness, and period comparison.
- **User value:** enables meeting handouts and archival reporting without screenshots or manual copying.
- **Dependency readiness:** Ready; authoritative date scope, reporting metadata, period comparison, and executive hierarchy are complete.
- **Implementation risk:** Medium and frontend-bounded; preserve on-screen behavior and print only data already visible for the active filter.
- **Expected validation:** current/custom filter consistency, print/PDF visual acceptance, keyboard-accessible action, no hidden-data disclosure, unchanged screen styles, and the full unified gate.
- **Scope:** bounded print portion of P3-1 only; exclude CSV, backend payload changes, hidden spreadsheet fields, drill-down, and persistence.

The implemented package uses one accessible browser-print action and authored A4 portrait rules. It prints only the active dashboard's visible executive content and reporting context, preserves chart summaries, adds title/period/generated/version metadata, and suppresses navigation, controls, skeletons, disclosures, inactive pages, and hidden content. `testPrintReportContract()` adds 13 scenarios and raises the ordered gate to 24/24 without changing analytics or backend contracts.

## Completed implementation package

### Sprint 5.13 Package 002 — CSV formula-injection hardening and acceptance closure

**Status: Complete; focused CSV and client-render contracts passed live, and the unified live gate passed 25/25.**

- **Objective:** neutralize leading `=`, `+`, `-`, and `@` spreadsheet-formula characters in exported cells and close the missing acceptance evidence.
- **User value:** makes the existing portable reconciliation artifact safe to open in spreadsheet software without changing which transactions or fields users receive.
- **Dependency readiness:** Ready; the export path, active-filter ownership, visible DOM projection, filename, UTF-8 encoding, accessibility, and performance budget already exist.
- **Implementation risk:** Low; the change is isolated to CSV cell serialization and its contract test, with no new data or authorization surface.
- **Verified validation:** live `testCsvExportContract()` PASS, live `testClientRenderPerformanceContract()` PASS with the 72-ID/two-selector query budget and no response mutation preserved, and live `runAllBackendTests()` PASS 25/25.
- **Scope:** bounded CSV serialization hardening and acceptance only; exclude new fields, expanded history, backend/API changes, spreadsheet access/export, permissions, persistence, drill-down, editable targets, layout changes, and deployment.

## Completed implementation package

### Sprint 5.14 Package 001 — bounded interactive KPI drill-down

**Status: Complete at committed and pushed implementation `fe6c424`; Apps Script source is uploaded, while live runtime and deployed-browser acceptance remain unverified.**

- **Objective:** connect existing KPI and chart summaries to supporting transaction views without expanding the public response or data-access surface.
- **User value:** lets users move from a summary to the available recent Sales, Purchase, month, or expense-category evidence while retaining the active reporting period.
- **Scope:** frontend filtering over a copied view of the existing maximum ten `recentTransactions`; no backend/API, spreadsheet access, persistence, permissions, hidden fields, expanded history, analytics, or response changes.
- **Accessibility and responsive behavior:** labeled buttons provide keyboard equivalents for canvas interactions, focus moves to the Transactions heading, an accessible status announces filter/count, clear restores all loaded recent rows, and the existing horizontally scrollable table remains authoritative.
- **Verified local validation:** focused four-scenario drill-down contract, client-render performance at 71 ID/two selector queries and one deferred phase, chart-presentation regression, extracted frontend syntax, and ordered `runAllBackendTests()` PASS 25/25.

## Explicitly not prioritized as defects

- Chart lifecycle currently destroys all three known Chart.js instances before replacement; no duplicate-instance defect was found.
- Event handlers are inline assignments and `window.onload`; no accumulating listener registration was found.
- Generated Tailwind CSS is approximately 18 KB; size reduction is not justified by current evidence.
- `index.html` is a GitHub Pages redirect/launcher to the Apps Script web app, not a dashboard or documentation duplicate. It should remain separately hosted and unchanged unless the project later chooses to retire that stable entry URL.
