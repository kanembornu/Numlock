---
name: numlock-documentation
description: Synchronize NUMLOCK documentation with verified repository evidence and correct ownership. Use for documentation-only audits, package or sprint status changes, test-gate updates, release notes, or documentation accompanying implementation.
---

# NUMLOCK Documentation

Treat `AGENTS.md` as the highest-priority repository contract. Update only documents relevant to the verified change and preserve unrelated edits and historical entries.

## Ownership

- `.ai/PROJECT_CONTEXT.md`: current continuity.
- `docs/CHANGELOG.md`: completed changes.
- `docs/ROADMAP.md`: package and sprint status.
- `docs/PRODUCT-BACKLOG.md`: backlog state and dependencies.
- `docs/DECISIONS.md`: durable decisions.
- `docs/TESTING.md`: test contracts and gates.
- `docs/ARCHITECTURE.md`: architecture changes only.
- `docs/DEPLOYMENT.md`: deployment-workflow changes only.
- `docs/RELEASE.md`: release-policy changes only.

## Workflow

1. Ground every statement in current source, tests, Git state, or actually performed validation.
2. Avoid copying the same narrative into every document; record only what each owner needs.
3. Keep historical entries historical. Do not rewrite old evidence as current.
4. Never claim live runtime, upload, deployment, browser acceptance, commit, or Git push unless it actually occurred.
5. Check Markdown links, then run `git diff --check` and `git status --short`.
6. For documentation-only work, do not run `clasp push`.
