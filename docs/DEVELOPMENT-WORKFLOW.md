# Development Workflow

## Prerequisites

- Git and GitHub access for the repository.
- VS Code using `Numlock.code-workspace`.
- Node.js for local JavaScript syntax and mock execution.
- Google `clasp` authenticated to an account with access to the configured NUMLOCK Apps Script project.
- Authorized access to the backing spreadsheet for live tests.

Credential files, OAuth tokens, script IDs, and spreadsheet exports containing business data must not be committed or printed.

## Safe loop

1. Read `AGENTS.md` and `.ai/PROJECT_CONTEXT.md`.
2. Classify the prompt as `NEW TASK` or `CURRENT TASK` and establish an explicit file scope.
3. Run `git status --short`; preserve unrelated changes.
4. Inspect the owning source and documentation before editing.
5. Make the smallest complete change and preserve Apps Script V8/global-function contracts.
6. Run focused syntax, mock, source-contract, link, and diff validation.
7. Review `git diff` and `git diff --check`.
8. If upload is explicitly authorized, confirm the active clasp account and run `clasp status` before pushing.
9. Run live functions in the Apps Script editor, then deploy and browser-test only when separately authorized.
10. Report each evidence level separately and stop when scope is complete.

## Current source transition

The application uses the completed numbered source layout. Every function must continue to exist in exactly one clasp-tracked file, `.claspignore` must remain aligned with the numbered inventory, and every migration test must remain global and runnable.

## GitHub and clasp separation

Git commits and GitHub pushes record repository history. `clasp push` updates mutable Apps Script source. Apps Script versions and deployments publish executable snapshots. None implies another; each external write requires explicit approval.

See [Git Workflow](GIT-WORKFLOW.md), [Testing](TESTING.md), and [Deployment](DEPLOYMENT.md).
