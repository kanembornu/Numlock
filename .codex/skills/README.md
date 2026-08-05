# NUMLOCK project skills

`AGENTS.md` remains the highest-priority repository contract. These skills compress recurring workflow rules; task-specific instructions still control scope and behavior.

## Ownership

- `$numlock-development`: implementation scope, Apps Script compatibility, local validation, clasp inventory, and external-action safeguards.
- `$numlock-testing`: test-file ownership, deterministic coverage, runner semantics, suite totals, and evidence reporting.
- `$numlock-frontend`: responsive UI, accessibility, browser state, rendering performance, Tailwind, charts, and dependency contracts.
- `$numlock-documentation`: document ownership, evidence accuracy, history preservation, links, and documentation-only boundaries.

Invoke only the skills relevant to the task. Example:

```text
Use:
- $numlock-development
- $numlock-testing
- $numlock-frontend

CURRENT TASK — Sprint X Package Y: <title>

Objective:
<one paragraph>

Special requirements:
- <task-specific behavior only>

Acceptance:
- <task-specific checks only>
```

Short examples:

```text
Use $numlock-documentation. Audit the current sprint status and update only its owning documents.
```

```text
Use $numlock-testing. Add one deterministic contract test and preserve runner order.
```

## Safe updates

Keep each skill concise, use lowercase hyphenated names, retain only `name` and `description` in YAML frontmatter, and avoid copying large context already owned by `.ai/` or `docs/`. Revalidate every skill, Markdown links, `.claspignore`, `git diff --check`, and `git status --short`. Never relax `AGENTS.md` safeguards through a skill.
