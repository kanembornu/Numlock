---
name: numlock-chart
description: Maintain NUMLOCK Chart.js rendering contracts. Use for chart dependencies, the Revenue, Hot or Cold, or Expense renderers, chart lifecycle, formatting, empty states, summaries, or responsive chart containment.
---

# NUMLOCK Chart

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-frontend` for shared browser rules, `$numlock-accessibility` for semantics, and `$numlock-analytics` for source values.

## Ownership

- Keep Chart.js pinned to the documented exact version and preserve its non-blocking failure contract.
- Maintain three separate renderer owners for Revenue, Hot/Cold, and Expense charts.
- Destroy the prior instance, clear owned state, then recreate; do not leak instances or listeners.
- Format currency, quantity, percentage, and month labels according to their units and project conventions.
- Provide chart-level empty and unavailable states plus accessible external summaries.
- Preserve responsive containment and never mutate source arrays or values for presentation.

## Non-goals

Do not generate analytics, change dashboard-wide states, or redesign unrelated frontend regions.

## Token-saving mode

Inspect only the affected renderer, dependency contract, summary, and focused tests. Avoid loading other chart domains unless shared lifecycle code changes.
