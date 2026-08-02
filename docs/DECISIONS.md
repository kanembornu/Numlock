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

### Precompile Tailwind into a clasp-tracked HTML partial

For Sprint 5.7 Package 001, the recommended implementation direction is to pin Tailwind 3.4.17 as a local development dependency and compile only the utilities used by `190.View.Index.html` into a generated, minified HTML partial. The partial is a checked-in deployment artifact; Apps Script runs no Node.js tooling. A later, separately approved implementation must include that partial from the existing template, add it to the `.claspignore` allowlist, and remove the Tailwind Play CDN script only after source, upload, live, and browser parity gates pass.

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

### Keep operating rules and context separate

`AGENTS.md` is the canonical operating contract. `.ai/` provides concise project context, templates, decisions, and routing without overriding or reproducing that contract.

## Deferred decisions

- `10.Config.js` remains unpopulated until a real immutable configuration contract is approved; inline behavioral literals are not extracted during pure moves.
- Legacy migration oracles remain until a separately approved cleanup proves they are no longer required for regression coverage.
- No release/version metadata system is invented until the repository adopts one explicitly.
