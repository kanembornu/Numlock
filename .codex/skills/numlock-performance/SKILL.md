---
name: numlock-performance
description: Protect NUMLOCK backend and frontend performance contracts. Use for spreadsheet-read counts, Aggregate Engine reuse, DOM-query budgets, response immutability, request races, deferred rendering, or Chart.js lifecycle performance.
---

# NUMLOCK Performance

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-analytics` for formulas and `$numlock-frontend` for general browser implementation.

## Ownership

- Preserve one spreadsheet read and one bounded processing pass per dashboard request.
- Reuse the single Aggregate Engine cache; do not rebuild row-derived analytics.
- Cache only stable DOM references and preserve the established query budget.
- Never mutate response objects or collections while rendering.
- Preserve request locking, duplicate-request prevention, and stale-callback rejection.
- Keep deferred rendering bounded, cancellable by request identity, and secondary to first-view content.
- Destroy prior Chart.js instances before clear/recreate work; avoid duplicate listeners and instances.
- Make no speculative optimization. Require comparable before/after measurements or contract evidence.

## Non-goals

Do not change analytics formulas or redefine UX, accessibility, or chart presentation.

## Token-saving mode

Inspect only the measured path and its contract tests. State the budget or metric, evidence before and after, and remaining uncertainty; omit generic tuning advice.
