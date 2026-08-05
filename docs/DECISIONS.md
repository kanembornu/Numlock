# Engineering Decisions

### Keep Dashboard tab state client-local and migrate each existing section once

UI/UX 2.0 Package 006 uses exactly Overview, Performance, Analytics, Intelligence, and Planning. Overview is the default. Existing DOM regions are moved once during guarded frontend initialization into their approved panels; no response field, formula, request, or renderer is duplicated. Tab activation changes ARIA/hidden/roving-focus state and resizes already-created charts when necessary, but it does not call the backend, mutate the response, rebuild unrelated content, or reset during date refresh, retry, theme changes, or sidebar collapse. Print exposes all Dashboard panels while suppressing the tab controls, so the active browser tab does not narrow report content.

### Persist only the validated UI theme preference in browser-local storage

UI/UX 2.0 Package 005 uses the namespaced key `numlock.ui.theme` with exactly `light`, `dark`, and `system` values. Missing, invalid, or unavailable storage falls back to System; System follows `prefers-color-scheme`. A pre-style bootstrap resolves the valid preference before visible paint where HtmlService permits. Theme changes update semantic tokens and existing Chart.js instances without rebuilding dashboard sections or requesting backend data, while print forces the approved light presentation. No business setting, log entry, payload, identifier, or server state is persisted.

### Adopt the UI/UX 2.0 component, theme, and four-destination contract

UI/UX 2.0 Package 004 approves a one-viewport desktop Dashboard with secondary information organized through Overview, Performance, Analytics, Intelligence, and Planning tabs. Transactions uses Recent, Sales, Expenses, and Purchases taxonomy, but only Recent and truthful client-filtered views of the current bounded projection are initially implementable; migrated-data views stay disabled with an explanation or are omitted. The approved visual system combines Executive Minimal hierarchy/restraint with Modern Financial numeric, table, and chart precision, using complete semantic light and deep-navy dark themes.

Dashboard, Transactions, Settings, and Logs are the approved primary destinations for later v2 implementation. This later product decision supersedes the Package 001 two-destination discovery decision for UI/UX 2.0 planning without rewriting that historical record or changing current v1.0 production. Settings is limited to Appearance and authoritative About metadata. Logs is limited initially to sanitized, session-local client events and explicitly excludes raw payloads, credentials, identifiers, personal data, source rows, and fabricated history. Future financial modules remain absent until they have approved populated workflows. The complete implementation contract is owned by [UI/UX 2.0 Component Library and Theme Contract](UIUX-2.0-COMPONENT-LIBRARY.md).

This document owns durable engineering and product decisions. [Project Status](PROJECT_STATUS.md) owns the current executive state; decisions recorded here are constraints and rationale, not status claims or backlog scheduling.

## Active decisions

### Shortlist Executive Minimal and Modern Financial

UI/UX 2.0 Package 003 selects Executive Minimal as the primary visual direction and Modern Financial as the alternate after an explicit weighted comparison of executive clarity, daily usability, mobile usability, accessibility, implementation feasibility, maintainability, and visual distinctiveness. Executive Minimal best preserves decision-first calm, mobile readability, and low implementation risk. Modern Financial provides the strongest distinct comparison through precise numeric, chart, card, and table treatment without changing feature scope.

A controlled hybrid is justified only as Executive Minimal structure, whitespace, surface restraint, and status discipline combined with Modern Financial numeric alignment, table precision, and chart-axis clarity. Analytical Workspace density and Operational Cockpit alert saturation are not included. This decision authorizes later high-fidelity comparison only when separately requested; it does not authorize production or Tailwind changes. The scoring, direction definitions, preliminary tokens, and mockup scope are owned by [UI/UX 2.0 Visual Direction System](UIUX-2.0-VISUAL-DIRECTIONS.md).

### Advance the Executive-first low-fidelity direction

UI/UX 2.0 Package 002 compares two implementation-neutral Dashboard arrangements and selects Executive-first for later high-fidelity mockups. Performance, attention status, one authoritative Business Priority, and period comparison remain ahead of Key Metrics and secondary analytics. The Analytical-first alternative uses existing capabilities but is not advanced because it delays the synthesized conclusion and next action, particularly across multiple narrow-screen viewports.

The four desktop/mobile wireframes preserve one semantic order, explicit mobile behavior, current loading/empty/error/exact-request Retry semantics, accessible disclosures and chart summaries, bounded transaction drill-down, Dashboard-owned Print, and Transactions-owned visible-row CSV. This is a discovery direction, not implementation authorization. The detailed comparison and capability traceability are owned by [UI/UX 2.0 Low-Fidelity Wireframes](UIUX-2.0-WIREFRAMES.md).

### Use two evidence-backed destinations for UI/UX 2.0

UI/UX 2.0 begins with exactly two primary destinations: Dashboard and Transactions. Dashboard owns the reporting period, Executive Summary, KPIs, analytics, intelligence, Forecast, Performance, Data Quality, recommendations, decision support, risk/growth, product concentration, and Print Report. Transactions owns the bounded recent-transaction table, drill-down result state, clear action, and visible-row CSV export. Section labels and disclosures do not become primary navigation.

Reports is deferred because browser print and visible-row CSV are contextual actions with different source scopes, not an independent report library or workflow. Settings is deferred because KPI targets are system-defined and non-editable and no approved persistence, validation, permission, migration, governance, or audit contract exists. Neither destination may enter navigation merely as a placeholder.

Desktop and narrow layouts use the same destinations and semantic order. The first viewport retains Executive Summary before KPIs, with one Business Priority; secondary dashboard content follows through progressive disclosure and ordered sections. KPI/chart evidence actions continue to open only the already-loaded maximum-ten-row Transactions projection with focus transfer, bounded status, clear/reset, and visible-row export. The complete discovery baseline and journey traceability are owned by [UI/UX 2.0 Information Architecture](UIUX-2.0-INFORMATION-ARCHITECTURE.md).

### Bound drill-down to already-loaded recent transaction evidence

KPI and chart drill-down is frontend-only and filters a copied view of the response's existing `recentTransactions` collection, which remains capped at ten rows and scoped by the authoritative dashboard date filter. Revenue and sales KPIs select Sales rows, Expense selects Purchase rows, Profit and margin retain both types, Revenue chart points select a represented month, and Expense chart points select a purchase category. Product Distribution opens its available Sales evidence without claiming Hot/Cold row classification because that field is not present in the transaction projection.

The interaction preserves response fields, backend calls, spreadsheet reads, analytics, permissions, filter/retry state, and source ordering. It does not request expanded history, expose hidden fields, persist selection, or mutate the response. Accessible buttons provide keyboard equivalents for canvas interactions; the Transactions page receives focus, identifies the bounded ten-row evidence scope, announces the active filter and matching count, and provides a clear action.

### Keep filtered executive reporting browser-native and print-only

The active dashboard DOM is the sole print-report source. One native, labeled Print Report button is enabled only after a successful dashboard render, copies the already-rendered active period into a print-only header, records the browser-generated date, retains the injected NUMLOCK version, and invokes `window.print()` exactly once. It performs no server call, analytics calculation, export transformation, persistence, or response-field access.

Authored `@media print` and `@page` rules own an A4 portrait layout without altering screen styling. The print report retains the current Executive Summary, Business Priority, KPIs, period comparison, reporting scope, freshness, Data Quality status, charts, accessible chart summaries, and recommendations. Navigation, drawer controls, Retry, filter/disclosure controls, skeletons, inactive pages, and hidden content are excluded. Layout rules constrain widths, wrap text, bound chart dimensions, and avoid card breaks where practical; CSV, generated-PDF libraries, backend export, hidden fields, GitHub Pages, and release-version changes remain outside this package.

### Centralize system-defined KPI targets without implying editability

`KPI_TARGET_CONFIG` is the single immutable owner of stable KPI and business-status thresholds already used in production. Package 005 moves those literals without changing formulas or boundary behavior across Business Score, Growth Score, KPI Achievement, Business Maturity, Diagnosis, Recommendations, Risk, Business Focus, Executive Alert, and Business Priority. Deeply frozen nested definitions prevent accidental runtime mutation.

The response adds `kpiTargets` for Revenue, Profit, Units Sold, and Profit Margin only. Each entry has a stable key, label, unit, target, direction, source, and description; the collection also states system provenance and `editable: false`. Revenue, Profit, and Units targets remain dynamically derived by the existing KPI Achievement calculation, while the existing 15% margin target remains fixed. The frontend explains these targets in a closed, accessible Business Performance disclosure and provides no edit control.

No historical KPI, score, risk, recommendation, maturity, or priority result changes. Editable targets would require a separate approved product contract covering persistence, validation, permissions, migration, and the meaning of changed decision outcomes.

Score weights and penalties, candidate ranking scores and source tie-break order, arithmetic zero checks, list limits, and mechanical percentage caps remain local. They are calculation mechanics rather than KPI targets or business-status thresholds, and centralizing them would blur layer ownership without improving explainability.

### Own one authoritative Business Priority in the decision layer

The response adds exactly one `businessPriority` with level, title, factual reason, executable action, allowed source, finite 0–100 score, and complete metric/value/comparison evidence. Existing `recommendations`, `priorityAction`, `businessFocus`, `executiveAlert`, `riskEngine`, and `diagnosis` remain unchanged and backward compatible; their ordering, formulas, and messages are not inputs to mutation.

Candidate precedence is Critical Data Quality, negative profit or critically low margin, High risk, material revenue decline, negative forecast, excessive top-expense concentration, product/revenue concentration opportunity, then stable maintenance. Selection sorts by Critical/High/Medium/Low, then explicit descending score, then fixed Data Quality, Profitability, Risk, Revenue, Forecast, Expense, Product, Stability source order. Critical Data Quality is labeled only as Data Quality and never as a business-performance failure. Empty scope returns the mandated Low/Stability no-activity action unless Critical source quality requires attention.

`buildBusinessPriority()` consumes only the completed cache and already-built service metadata; it performs no spreadsheet read, processed-row scan, or analytics recomputation. The Executive Summary primary-action card is its sole first-viewport owner and renders status text, reason, action, and concise evidence without exposing score or relying on color. Supporting recommendations remain available and retain backend order.

### Compare active periods with one truthful prior-period contract

The dashboard response adds `periodComparison` without changing any existing KPI, formula, filter boundary, forecast, intelligence output, or response property. Today compares with the previous calendar day; Last 7 Days with the preceding seven days; Current Month with the same elapsed day count in the previous month capped at that month end; Previous Month with the full month before it; Current Year with equivalent prior-year-to-date capped safely across leap years; and Custom with the immediately preceding equal inclusive duration. All boundaries use the Apps Script project timezone.

`getDashboardData()` reads raw transactions once and processes them once. `buildDashboardResponse()` filters that same processed array into current and previous subsets, builds the normal analytics cache only for the current subset, and computes only row count, revenue, expense, signed profit, and units sold for the prior subset. It never recursively calls `getDashboardData()` or builds a second dashboard response.

When the previous value is positive, percentage change is `(current - previous) / previous * 100`. Two zero values produce `0.0 / Stable`; a zero prior baseline with a nonzero current value produces `null / No Comparison`. Profit keeps signed current and previous values; for a nonzero loss baseline, the percentage denominator uses its magnitude so profit-to-loss, loss-to-profit, and deeper-loss direction remains truthful. All finite percentages round to one decimal. The frontend presents this contract once in the Executive Summary with text and arrow direction, treats expense movement factually, and never relies on color alone.

### Own dashboard accessibility in the frontend contract

`190.View.Index.html` owns document language/title/viewport metadata, one primary main landmark, labeled primary navigation, logical page headings, form and table semantics, visible keyboard focus, and focus exclusion for the closed mobile drawer and inactive page. Native buttons and controls retain browser Enter/Space behavior; Escape closes the drawer and restores the menu-button focus; Retry and Data Quality remain native buttons.

Date validation is separate from reporting metadata. Both custom date controls reference one polite atomic validation region and expose `aria-invalid`; valid requests clear that state. Dashboard lifecycle, reporting freshness, and Data Quality use bounded text-only live regions, never raw payloads or internal metadata, and each region has one owner to prevent duplicate announcements.

Normal motion is preserved by default. Under `prefers-reduced-motion: reduce`, skeleton shimmer, drawer movement, roadmap transitions, and Chart.js animation are disabled while state changes and rendered content remain intact.

### Pin and own every runtime frontend dependency

Tailwind CSS remains locally compiled from exactly pinned `tailwindcss` 3.4.17 and is included through the clasp-tracked `189.View.Tailwind.html`; it has no runtime network dependency. Chart.js is required for the three dashboard charts and is retained at the exact verified version 4.5.1 from the single HTTPS jsDelivr UMD URL. Font Awesome remains required because eight active `fas` icons still render navigation, controls, and overview-card imagery; its single HTTPS cdnjs stylesheet remains pinned at 6.0.0. No floating, duplicate, dynamically injected, or replacement-library URL is allowed.

Chart.js is optional to completion of a dashboard response. The frontend checks that `Chart` is a function before chart creation. When unavailable, it destroys any existing instances, clears stale canvases, retains accessible summaries, shows `Chart unavailable.` in every chart region, logs the actionable payload-free diagnostic once, and continues KPI, intelligence, table, recommendation, filter, and state rendering. Font Awesome failure degrades icons only; text labels and controls remain usable.

Dependency updates require reviewing upstream release notes, choosing an exact version, verifying the exact CDN artifact, running extracted frontend parsing plus available/unavailable dependency mocks, chart/responsive/lifecycle contracts, and the full backend suite, then documenting the new version before upload. SRI must be omitted unless its hash is independently verified against the exact retained artifact.

### Keep chart presentation separate from analytics

Revenue Trend, Hot/Cold Split, and Expense Breakdown keep their existing backend labels, values, category ordering, and public response fields. Frontend-only helpers format Indonesian Rupiah, quantities, and `MM/YYYY` month labels; three separate renderers own their differing Chart.js configurations. Every renderer destroys its previous instance before clearing the canvas or creating a replacement, so a chart-level empty transition cannot retain stale output or create a duplicate instance.

Each chart card is an accessible titled region with a concise text summary outside its canvas. Summaries update on every dashboard render and own the non-canvas representation of represented months/totals/highest revenue, Hot/Cold totals/dominance, and expense categories/total/largest category. Empty messages are chart-specific and assistive-technology-readable. A chart with no values does not change the dashboard-level empty-state decision, which remains owned by `dateFilter.rowCount`.

Revenue and expense tooltips use Indonesian Rupiah formatting; Hot/Cold tooltips use quantities and finite percentages, with zero total handled before chart creation. Revenue uses a zero baseline, chronological backend order, `MM/YYYY` labels, and no gap spanning. Expense uses backend category order and a horizontal layout so long labels remain readable. These are presentation rules only and do not authorize analytics-formula or source-data changes.

### Separate source date quality from scoped analytics

Each dashboard request reads transaction rows once. A pure pre-processing inspection records invalid-date source-row indexes and the source row count; processing carries a stable internal source-row index so source and scoped findings can be deduplicated. Invalid dates remain excluded from date filtering, cache construction, and every analytic, but their `INVALID_DATE` findings remain visible in `dataQuality`. No raw source value or internal row identity is returned, logged, repaired, or written.

All other issue types remain scoped to the active filtered rows. `totalRows` and `validRows` retain scoped meaning, where `validRows` counts scoped rows without a scoped issue. `issueRows` and `issueCount` combine source invalid-date findings with scoped findings, so `issueRows` may exceed `totalRows`. `dataQuality.scope` reports `sourceRows`, `scopedRows`, and `excludedInvalidDateRows`. An all-invalid source therefore produces empty analytics and Critical data quality without changing the dashboard empty-state contract.

### Keep data-quality diagnostics scoped and observational

The final response adds `dataQuality` from the same already filtered processed-row array used by the dashboard. The builder is pure: it performs no spreadsheet read or write, does not mutate or repair rows, does not exclude additional rows, and does not affect analytics formulas. Raw source quantity and purchase-amount values are retained only as additive internal provenance on newly created processed-row objects so non-finite inputs remain observable after existing numeric normalization.

The six fixed issues are: `INVALID_DATE` when a raw source-row date cannot be interpreted as valid; `UNKNOWN_TRANSACTION_TYPE` unless type is exactly `Sales` or `Purchase`; `MISSING_SALES_PRODUCT` for Sales without product; `MISSING_PURCHASE_CATEGORY` for Purchase without purchase category; `INVALID_QUANTITY` for non-finite or negative Sales quantity; and `INVALID_PURCHASE_AMOUNT` for non-finite Purchase expense. Package 004 extends this decision only for source invalid-date visibility; the other five issues remain scoped and observational.

`totalRows` counts scoped evaluated rows, `validRows` counts scoped issue-free rows, and the source-aware meanings of `issueRows` and `issueCount` are defined above. Status is Good for zero issues, Attention for only Medium-severity issues, and Critical when any High-severity issue exists. The frontend displays status text, issue-count text, scope counts, and user-facing labels/counts only; internal codes, row identities, and raw row values remain undisclosed.

### Derive reporting transparency from the scoped rows

The final response adds `reportingScope` and `dataFreshness` without changing `dateFilter` or any analytics output. One service-layer builder receives the already filtered processed rows, the resolved range, and the request's captured execution time; it performs no spreadsheet read and does not mutate rows. Counts include the scoped rows, while invalid dates are ignored for earliest/latest timestamp calculation.

The Apps Script project timezone determines calendar dates, Current/Stale/No Data status, and current-month/current-year partial-period boundaries. The frontend displays only the month range, transaction count, latest date, and text-labeled freshness status; ISO timestamps, generation time, timezone, and internal filter keys remain undisclosed.

### Preserve desktop while using one responsive drawer below lg

At `lg` and above, the dashboard retains its fixed `w-72` sidebar, permanent `lg:ml-72` content offset, spacing, and visual hierarchy. Below `lg`, main content uses the full viewport and navigation is a hidden-by-default overlay drawer controlled by real menu and close buttons. Backdrop click, Escape, and navigation selection close it; closing unlocks body scrolling and restores focus to the menu control. The controller initializes once and remains separate from dashboard data rendering.

Dense grids stack where necessary, filter controls wrap, flex/grid children use bounded widths, chart containers retain usable responsive height, and the recent-transactions table scrolls inside its own horizontal container rather than widening the page. Active navigation exposes `aria-current="page"`.

### Use one recoverable dashboard state contract

The frontend has five explicit lifecycle states: `loading`, `success`, `empty`, `error`, and `retry`. Loading disables filter controls, prevents duplicate requests, visibly de-emphasizes stale content, and exposes busy status. Success restores the populated dashboard and active month-range label. Empty is defined only by additive `dateFilter.rowCount === 0`; zero revenue or zero expense alone never makes a period empty.

Error handling shows `Unable to load dashboard data.`, restores controls, retains the selected filter and custom dates, and exposes a real Retry button. Retry reuses the exact last request without reloading the page. Sequence tokens prevent stale success or failure callbacks from replacing a newer state. Request and render failures retain concise `console.error` context but never log raw dashboard payloads.

### Use one project-timezone dashboard date filter

Every transaction-derived dashboard section uses one processed-row subset resolved before analytics cache construction. The exact filters are `today`, inclusive `last7days`, `currentMonth`, full `previousMonth`, default `currentYear`, and inclusive `custom`. Missing, null, empty, or unknown input normalizes to `currentYear` for backward compatibility.

The Apps Script project timezone is authoritative. Custom boundaries must be exact, valid `YYYY-MM-DD` values and start must not be after end; invalid input throws a descriptive error and is never silently swapped. The response adds `dateFilter` metadata without removing or renaming existing fields. Transaction-type filtering is not part of this decision.

Revenue Trend is built only by `buildRevenueTrendFromAggregate()` from that already filtered row set. It retains all represented revenue months, including a partial current month, in ascending `YYYY-MM` order. The frontend derives month-only visible scope text directly from the backend ISO boundaries without browser-local `Date` parsing; the ISO metadata remains unchanged for internal use.

### Sprint 5.8 uses a product-evidence backlog

Sprint 5.8 Package 001 shifts planned work from internal restructuring to product correctness, decision value, UX, accessibility, and measured frontend performance. [The product backlog](PRODUCT-BACKLOG.md) is the single prioritized inventory. Its P0/P1/P2/P3 ordering is evidence-based, and only the next three packages are scheduled in `ROADMAP.md`.

Backlog entries that need business semantics, configuration ownership, export policy, or drill-down authorization remain explicitly requirement-gated. An audit recommendation does not authorize implementation or a public-contract change.

### Preserve GitHub Pages as a separate launcher

Root `index.html` is a GitHub Pages redirect/launcher to the Apps Script web app. It is not a second dashboard and not a documentation page. Keeping it separate preserves a lightweight stable entry point without duplicating Apps Script UI ownership.

### Aggregate Engine is the analytics source of truth

`buildAnalyticsCache(data)` constructs one aggregate per dashboard request. Summary, revenue trend, expense breakdown, top products, profit trend, and Hot/Cold split derive from it. Deterministic fixtures cover all six domains and no legacy migration oracle remains.

### Preserve the public dashboard contract

The frontend continues to call `getDashboardData()` and receive the existing property names and shapes. Structural decomposition must not change formulas, spreadsheet assumptions, UI behavior, or public globals.

### Use a numbered flat Apps Script layout

The completed structure is defined in `ARCHITECTURE.md` and recorded function-by-function in `SOURCE-MIGRATION.md`. It is frozen as the live-validated production architecture. Numeric names communicate ownership and load order. Duplicate globals remain forbidden; architecture changes require an explicitly approved task and synchronized documentation.

### Accept the current Apps Script browser warning as non-blocking debt

The Apps Script iframe sandbox warning was present during successful deployed-dashboard verification. It is recorded technical debt, not an application runtime failure, and does not authorize an incidental frontend change. The Tailwind CDN warning was eliminated by the compiled-CSS package.

### Keep production Console output actionable

Normal successful dashboard loading and rendering must not write application messages to the browser Console. Raw dashboard responses, business-data payloads, generic object dumps, and temporary state tracing must not be logged in production. Preserve concise `console.error` diagnostics for genuine server-load failures and invalid render inputs; actionable warnings may remain only when they intentionally identify a condition an operator or developer can address.

### Precompile Tailwind into a clasp-tracked HTML partial

Sprint 5.7 Package 001 pins Tailwind 3.4.17 as a local development dependency and compiles only the utilities used by `190.View.Index.html` into generated, minified `189.View.Tailwind.html`. The checked-in partial is included by the existing template and tracked by clasp; Apps Script runs no Node.js tooling. The Tailwind Play CDN script was removed after source, upload, live, and browser parity gates passed.

This is safer than placing generated CSS inside the hand-maintained view because generated and authored code remain separate, and safer than a handcrafted rewrite because it preserves Tailwind's current utility semantics and responsive variants. A standalone `.css` asset is not selected because HTML Service does not provide a conventional static-asset route and the current web entry point serves one evaluated HTML template.

The build must scan `190.View.Index.html` and explicitly safelist all runtime-selected utility tokens. Although the current tokens appear as complete string literals and are discoverable by Tailwind's scanner, the safelist is a regression guard for these indirections:

- text state: `text-emerald-600`, `text-amber-500`, `text-amber-600`, `text-red-600`;
- badge state: `bg-emerald-100`, `text-emerald-700`, `bg-amber-100`, `text-amber-700`, `bg-red-100`, `text-red-700`, `bg-green-100`, `text-green-700`;
- diagnosis and timeline state: `bg-red-50`, `border-red-100`, `bg-red-500`, `bg-amber-50`, `border-amber-100`, `bg-amber-500`, `bg-emerald-50`, `border-emerald-100`, `bg-emerald-500`, `bg-slate-400`, `bg-slate-100`, `text-slate-600`;
- intelligence themes: `bg-indigo-50`, `border-indigo-100`, `bg-indigo-100`, `bg-rose-50`, `border-rose-100`, `bg-rose-100`, `text-slate-900`;
- executive cards: `border-emerald-200`, `border-amber-200`, `border-red-200`, `border-indigo-200`;
- KPI bars: `bg-indigo-500`, `bg-emerald-500`, `bg-amber-500`, `bg-rose-500`.

The existing inline custom CSS (`.page`, `.page.active`, the body fallback, Action Roadmap hover/transition rules, `.skeleton`, and `@keyframes shimmer`) remains authored CSS and must be preserved exactly during the migration. The Apps Script iframe sandbox warning is explicitly outside this decision.

### Keep tests global and validation bounded

Migration test entry points remain global for manual Apps Script editor execution. Validators throw on mismatches. Parameterized helpers are not direct test entry points.

### Separate evidence and external writes

Static checks, local mocks, clasp upload, live Apps Script execution, deployment, and browser verification are reported separately. Git and Apps Script writes require explicit approval.

### Use one authoritative release workflow

`docs/RELEASE.md` owns release sequencing, semantic versioning, operator checks, deployment, browser acceptance, Git completion, and rollback. `10.Config.js` owns executable release metadata and `docs/CHANGELOG.md` owns release history. Version `1.0.0` is the current production release.

### Keep operating rules and context separate

`AGENTS.md` is the canonical operating contract. `.ai/` provides concise project context, templates, decisions, and routing without overriding or reproducing that contract.

## Deferred decisions

- KPI target values, storage location, and who may edit them.
- Export format, included fields, and access policy.
- Drill-down detail fields and authorization boundary.
