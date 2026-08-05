---
name: numlock-development
description: Apply NUMLOCK's authoritative implementation workflow and repository safeguards. Use for any production, configuration, refactor, maintenance, clasp-inventory, or general code change in the NUMLOCK repository.
---

# NUMLOCK Development

Treat `AGENTS.md` as the highest-priority repository contract. Read it first, classify the prompt as `NEW TASK` or `CURRENT TASK`, then inspect relevant owners and current Git state before editing.

## Workflow

1. Bound the approved files and behavior. Preserve unrelated worktree changes.
2. Make the smallest complete change. Never edit `.clasp.json` or expose its identifiers.
3. Preserve Apps Script V8 global-scope compatibility: use no module `import`/`export`, Node-only runtime API, or eager cross-file initialization.
4. Preserve formulas, public globals, response fields, APIs, spreadsheet assumptions, and data contracts unless explicitly changed.
5. Validate changed JavaScript syntax, then run `git diff --check` and `git status --short`.
6. After local validation, run `clasp status` and verify the exact numbered production inventory. Stop on a wrong account/project identity, unexpected inventory, or failed test.
7. Run `clasp push --force` only when explicitly authorized and every preceding gate passes. Never deploy, commit, or push Git.

Report static/local, inventory, upload, runtime, deployment, and browser evidence separately. Return only the concise structure requested by the user.

## Token-saving mode

- Do not repeat inspected source or project context.
- Do not narrate routine steps.
- Do not restate prompt requirements in the final response.
- Report only material changes, validation, remaining risks, and exact next live tests.
