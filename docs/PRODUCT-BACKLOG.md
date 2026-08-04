# NUMLOCK Sprint 5.8 Product Backlog

## Scope and evidence

This backlog is the documentation outcome of Sprint 5.8 Package 001. It is grounded in the production contracts in `10.Config.js`, `70.Intelligence.Score.js`, `75.Intelligence.Diagnosis.js`, `80.Intelligence.Recommendation.js`, `85.Intelligence.Decision.js`, `90.Dashboard.Service.js`, the responsibility-split `92`–`98` test files, and `190.View.Index.html`, plus the governing repository documentation. It proposes product work only; no production source, frontend, deployment, or release metadata changed during the audit.

The current dashboard already has a clear two-destination navigation model, a broad executive-to-operational information hierarchy, KPI cards, three Chart.js visualizations, skeletons for initial KPIs/charts, recent transactions, deterministic backend coverage, and explicit Chart destruction before recreation. Generated Tailwind CSS is approximately 18 KB and is not presently a size concern. No duplicated event-listener registration was found.

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

- **Problem:** one approximately 48 KB HTML file contains the full runtime, and success synchronously renders every hidden and below-the-fold section. It performs 41 ID lookups and 18 HTML replacements per render; expense sorting mutates the response array. Six response fields (`financial`, `profitIntelligence`, `profitTrend`, `opportunities`, `kpiStatus`, and `productContribution`) are not directly consumed by the current view.
- **User impact:** initial interaction can be delayed on slower devices, repeated loads rebuild all charts/markup, and oversized responses/renders do work that is not immediately visible.
- **Proposed solution:** cache stable element references, render the active/above-the-fold view first, defer lower sections/transactions, avoid response mutation, suppress stale responses, and evaluate additive API projection only after confirming no external consumers.
- **Files likely affected:** `190.View.Index.html`, possibly `90.Dashboard.Service.js` and contract tests if an optional projection is approved.
- **Implementation complexity:** M
- **Regression risk:** Medium
- **Validation required:** render-order/stale-response tests, Chart instance-count check, performance trace on representative payload, response-contract compatibility, desktop/narrow browser acceptance.
- **Dependency on other items:** P0-2 if reloads remain filter-driven; external-consumer inventory before payload reduction.

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

- **Problem:** there is no print stylesheet or export action for executive reporting.
- **User impact:** users must copy or screenshot dashboard content for meetings and archives.
- **Proposed solution:** after confirming audience and format, provide a print-optimized executive summary and optionally CSV export for visible transactions; do not export hidden spreadsheet data.
- **Files likely affected:** `190.View.Index.html`, `90.Dashboard.Service.js` only if a new bounded export is required, generated CSS.
- **Implementation complexity:** M
- **Regression risk:** Medium
- **Validation required:** print/PDF visual acceptance, CSV escaping and scope tests, permission/privacy review, filter/date consistency.
- **Dependency on other items:** P1-1 and P1-2; required format, fields, and access policy are currently uncertain.

### P3-2 — Add KPI and chart drill-down

- **Problem:** KPI cards, charts, risks, and recommendations are summaries with no path to supporting transactions.
- **User impact:** users cannot verify a conclusion or identify the rows/products/categories that require action.
- **Proposed solution:** after defining permitted detail, add scoped drill-down panels that preserve the active period/filter and disclose the evidence behind a metric or recommendation.
- **Files likely affected:** `90.Dashboard.Service.js`, `95.Tests.js`, `190.View.Index.html`, architecture/testing documentation.
- **Implementation complexity:** L
- **Regression risk:** High
- **Validation required:** scope/authorization tests, aggregation-to-detail reconciliation, large-result pagination, keyboard/modal behavior, privacy review.
- **Dependency on other items:** P1-1, P1-3, and P1-4; detail fields and authorization are unavailable requirements.

## Recommended next three implementation packages

### Sprint 5.8 Package 002 — Empty-data resilience

**Status: Completed and deployed.**

- **Objective:** make every valid empty or sparse dataset return and render a usable, explicit state.
- **Independent release:** yes; it preserves populated-data response fields and requires no filter/date contract.
- **Expected tests:** seven deterministic empty/sales-only/purchase-only/one-row/sparse/populated backend fixtures, local 11/11 gate, extracted frontend syntax, mocked sparse rendering, and live Apps Script validation. Empty-state redesign and browser acceptance remain Package 004 scope.
- **Scope:** P0-1 only.

### Sprint 5.8 Package 003 — Truthful transaction scope

**Status: Completed and deployed.**

- **Objective:** replace the misleading transaction-type control with the approved end-to-end date filter.
- **Independent release:** yes; parameterless `getDashboardData()` remains compatible and defaults to Current Year.
- **Expected tests:** deterministic date-range and Revenue Trend assertions, response compatibility, inclusive boundaries, custom validation, finite/empty outputs, frontend request locking, and every-visible-output scope checks.
- **Scope:** P0-2 only; transaction-type filtering was not implemented.

### Sprint 5.8 Package 004 — Recoverable dashboard states

**Status: Completed locally; upload and live/browser validation are pending.**

- **Objective:** replace indefinite loading with visible, accessible success/empty/error/retry states.
- **Independent release:** yes; it can consume existing response/error behavior and does not change analytics formulas.
- **Expected tests:** deterministic row-count semantics plus mocked success/failure/render exception/retry/stale response, skeleton cleanup, keyboard/live-region checks, Console policy verification, desktop and narrow browser acceptance.
- **Scope:** P2-3 only, reusing the empty-state vocabulary established by Package 002.

## Explicitly not prioritized as defects

- Chart lifecycle currently destroys all three known Chart.js instances before replacement; no duplicate-instance defect was found.
- Event handlers are inline assignments and `window.onload`; no accumulating listener registration was found.
- Generated Tailwind CSS is approximately 18 KB; size reduction is not justified by current evidence.
- `index.html` is a GitHub Pages redirect/launcher to the Apps Script web app, not a dashboard or documentation duplicate. It should remain separately hosted and unchanged unless the project later chooses to retire that stable entry URL.
