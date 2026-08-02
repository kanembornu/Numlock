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
