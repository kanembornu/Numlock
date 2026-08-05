---
name: numlock-analytics
description: Protect NUMLOCK Aggregate Engine analytics ownership and deterministic outputs. Use for summary, financial, trend, Hot or Cold, product, expense, date-scoped analytics, or raw-row aggregation changes.
---

# NUMLOCK Analytics

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-testing` for deterministic fixtures and `$numlock-intelligence` for downstream decisions.

## Ownership

- Keep Aggregate Engine the sole production source for Summary, Revenue Trend, Expense Breakdown, Top Products, Profit Trend, and Hot/Cold Split.
- Build the aggregate once from valid date-scoped rows, then reuse cached outputs in downstream layers.
- Keep financial, trend, product, and expense analytics in their documented owners; do not duplicate raw-row loops outside the owning layer.
- Return finite numbers, deterministic ordering, stable tie behavior, and unchanged response shapes.
- Do not change formulas, category semantics, date behavior, or ordering unless explicitly requested.

## Non-goals

Do not own recommendation or decision precedence, dashboard rendering, chart formatting, or performance changes unrelated to analytics construction.

## Token-saving mode

Inspect only the affected analytics owner, consumers, and deterministic contracts. Avoid loading unrelated intelligence or frontend code; report formula changes explicitly or state that none occurred.
