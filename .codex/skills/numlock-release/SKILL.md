---
name: numlock-release
description: Apply NUMLOCK release policy and evidence sequencing. Use for semantic versions, release metadata, changelog coordination, preflight, live validation, deployment, browser acceptance, or production rollback planning.
---

# NUMLOCK Release

Treat `AGENTS.md` as the highest-priority repository contract. Read `docs/RELEASE.md`; use `$numlock-validation`, `$numlock-clasp`, `$numlock-git`, and `$numlock-documentation` for their owned steps.

## Ownership

- Apply semantic versioning and keep authoritative release metadata synchronized with the changelog and applicable visible version references.
- Preserve the sequence: preflight, authorized upload, Apps Script live tests, explicitly authorized deployment, deployed-browser acceptance, then separately authorized Git completion.
- Record every evidence level separately and stop when a prerequisite fails.
- Roll production back by repointing the existing deployment to a known-good immutable Apps Script version.
- Treat Git revert as a separate repository action that does not change production.
- Never automate deployment, commit, push, tagging, or release publication.

## Non-goals

Do not own daily implementation details, test composition, clasp inventory rules, or Git staging mechanics.

## Token-saving mode

Load only release authorities and changed metadata. Report the current gate, exact evidence, authorization boundary, and rollback reference; avoid repeating implementation context.
