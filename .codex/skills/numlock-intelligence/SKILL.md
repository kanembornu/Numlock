---
name: numlock-intelligence
description: Preserve NUMLOCK business-intelligence layer contracts. Use for Revenue, Profit, Score, Diagnosis, Recommendation, Decision, KPI thresholds, Business Priority precedence, or intelligence response fields.
---

# NUMLOCK Intelligence

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-analytics` for raw aggregation and `$numlock-dashboard` for presentation hierarchy.

## Ownership

- Keep Revenue, Profit, Score, Diagnosis, Recommendation, and Decision responsibilities in their documented numbered layers.
- Consume cached analytics; never rescan or mutate source rows or cached intelligence objects.
- Preserve deterministic precedence, finite scoring, fixed tie-breaking, and signed profit semantics.
- Keep Data Quality distinct from business performance even when it wins Business Priority.
- Preserve every existing intelligence response field and recommendation order unless explicitly changed.
- Use centralized KPI thresholds for classifications; do not scatter duplicate constants.

## Non-goals

Do not own raw transaction processing, aggregate formulas, dashboard layout, or chart rendering.

## Token-saving mode

Trace only the affected intelligence chain and its direct tests. State changed precedence, thresholds, or fields precisely; omit unaffected layers.
