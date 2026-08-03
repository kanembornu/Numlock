# Engineering Decisions

## Active decisions

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

- Exact previous-period comparison rules beyond the implemented date scope.
- KPI target values, storage location, and who may edit them.
- Export format, included fields, and access policy.
- Drill-down detail fields and authorization boundary.
