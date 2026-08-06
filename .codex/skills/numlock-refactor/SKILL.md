---
name: numlock-refactor
description: Apply evidence-based, behavior-preserving NUMLOCK code and CSS restructuring. Use only for proven dead code, duplicate render paths, helper consolidation, obsolete class or comment cleanup, ownership simplification, or measured structural debt where product behavior must remain unchanged.
---

# NUMLOCK Refactor

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-development` for repository safeguards, the owning domain skill for preserved behavior, and `$numlock-regression` for cross-feature verification when material.

## Workflow

1. Identify a concrete defect, duplication, obsolete owner, or measurable maintenance cost. Do not clean speculatively.
2. Record before-state ownership, callers, selectors, generated-class use, load-order dependencies, and applicable tests.
3. Prove every removal with repository-wide source search and focused contract evidence.
4. Make the smallest structural change that removes the proven debt while preserving public names, inputs, outputs, side effects, ordering, formulas, response fields, browser states, and Apps Script V8 compatibility.
5. Record after-state ownership and repeat source, syntax, focused, unified, diff, and rollback checks appropriate to the change.

## Ownership

- Remove proven-dead code and obsolete classes or comments.
- Consolidate helpers only when ownership and call equivalence are demonstrated.
- Remove duplicate render paths without changing visible output or interaction.
- Simplify structure while retaining flat clasp-source compatibility and a reviewable rollback boundary.
- Require before-and-after evidence for ownership, references, behavior, and validation.

## Stop conditions

Stop when evidence is ambiguous, a removal still has a caller, behavior equivalence is unproven, a response contract or formula would change, load order becomes unsafe, or rollback cannot remain bounded. Escalate any visual redesign, feature, schema, API, persistence, permission, or architecture rewrite to its owning task.

## Non-goals

Do not own feature development, visual redesign, speculative architecture cleanup, response or formula changes, or unbounded performance optimization.

## Token-saving mode

Inspect only the candidate owner, direct callers, source-search evidence, focused tests, and rollback boundary. State what was proven removable and what behavior remained unchanged.
