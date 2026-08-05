---
name: numlock-dashboard
description: Preserve NUMLOCK dashboard composition and user-state contracts. Use for response compatibility, Executive Summary, KPIs, Business Priority, reporting presentation, date-filter scope, dashboard states, or responsive shell hierarchy.
---

# NUMLOCK Dashboard

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-frontend` for browser implementation and `$numlock-intelligence` for decision formulas.

## Ownership

- Preserve the public dashboard response and existing fields unless an additive or breaking change is explicitly approved.
- Keep Executive Summary first, followed by KPI and reporting presentation, with one authoritative Business Priority.
- Apply the selected date filter consistently to all row-derived dashboard output.
- Preserve loading, success, empty, error, and retry states; empty means zero scoped transaction rows.
- Retry the exact last filter/custom-date request, block duplicates, and ignore stale callbacks.
- Preserve the responsive shell and avoid duplicating the same executive message in the first viewport.

## Non-goals

Do not own intelligence formulas, recommendation precedence, low-level chart configuration, or general accessibility rules.

## Token-saving mode

Inspect only response composition, affected state transitions, and their contracts. Do not reload analytics internals unless the task changes their interface.
