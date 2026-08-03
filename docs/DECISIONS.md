# Engineering Decisions

## Active decisions

### Aggregate Engine is the analytics source of truth

`buildAnalyticsCache(data)` constructs one aggregate per dashboard request. Summary, revenue trend, expense breakdown, top products, profit trend, and Hot/Cold split derive from it. Legacy builders remain only as migration oracles until a separately approved cleanup.

### Preserve the public dashboard contract

The frontend continues to call `getDashboardData()` and receive the existing property names and shapes. Structural decomposition must not change formulas, spreadsheet assumptions, UI behavior, or public globals.

### Use a numbered flat Apps Script layout

The completed structure is defined in `ARCHITECTURE.md` and recorded function-by-function in `SOURCE-MIGRATION.md`. It is frozen as the live-validated production architecture. Numeric names communicate ownership and load order. Duplicate globals remain forbidden; architecture changes require an explicitly approved task and synchronized documentation.

### Accept current browser warnings as non-blocking debt

The Tailwind CDN production warning and Apps Script iframe sandbox warning were present during successful deployed-dashboard verification. They are recorded technical debt, not application runtime failures, and do not authorize an incidental frontend change.

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

- Legacy migration oracles remain until independent deterministic regression fixtures replace their current equivalence coverage. The Package 004 audit found no safe deletion candidate.
