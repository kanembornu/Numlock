# NUMLOCK Codex Operating Contract

## Project

NUMLOCK is a Google Apps Script V8 web application and business-intelligence dashboard. Preserve compatibility with Apps Script, `clasp`, spreadsheet services, and the existing HTML frontend.

## Task Classification

- At the start of every prompt, state whether it is a `NEW TASK` or a `CURRENT TASK`.
- Treat a prompt as a `NEW TASK` when it introduces a separate objective or explicitly labels itself that way.
- Treat a prompt as a `CURRENT TASK` when it continues, corrects, or narrows work already in progress.
- Use token-saving mode for simple tasks: inspect only what is relevant, communicate concisely, avoid unnecessary tooling, and stop immediately when the requested scope is complete.

## Required Workflow

1. Inspect the repository state, applicable instructions, and every relevant target or reference file before editing.
2. Confirm the requested scope and keep the task tightly bounded.
3. Preserve existing behavior unless the user explicitly requests a behavior change.
4. Make only the smallest complete change needed for the stated objective.
5. Validate the changed files and repository state before completion.
6. Stop immediately once the requested scope and validation are complete.

## Change Rules

- Never modify files unrelated to the current task.
- Do not refactor, rename, reorganize, or clean up adjacent code unless explicitly requested.
- Do not change application behavior, spreadsheet assumptions, APIs, permissions, schemas, or data contracts outside the stated scope.
- Prefer complete function replacement over ambiguous partial patches when changing a function. Preserve its public name, inputs, outputs, side effects, and surrounding contracts unless the task explicitly changes them.
- Preserve Apps Script V8 compatibility. Do not introduce Node-only APIs, unsupported modules, or runtime assumptions.
- Preserve `clasp` compatibility and the repository's flat Apps Script file structure.
- Do not modify `.clasp.json` unless explicitly requested. Never display, copy, log, or otherwise expose its `scriptId`.
- Never deploy or run `clasp push` unless the user explicitly requests it.
- Do not commit, push, reset, or discard changes unless explicitly requested.
- Preserve unrelated user changes already present in the worktree.

## Validation

- Run validation appropriate to the change and report exactly what was executed.
- Run `git diff --check` and `git status --short` before completing file-changing tasks unless the user sets a narrower validation boundary.
- Use syntax or static checks appropriate to each changed file.
- Treat local/static checks, `clasp` upload, Apps Script runtime execution, and browser acceptance as separate evidence classes.
- Never claim runtime, deployment, or browser PASS unless that validation actually ran successfully.
- If required validation cannot run, report it as blocked or unverified rather than guessing.

## Git Safety

- Git recommendations must list every file explicitly.
- Never recommend or run `git add .`, `git add -A`, or another broad staging command.
- Before recommending a commit, inspect the worktree and distinguish task changes from pre-existing changes.
- Do not include unrelated files in recommended Git commands.

## Required Completion Output

Every completed task must report:

1. Changed files
2. Validation performed and result
3. Remaining risks or blockers
4. Recommended Git commands, with every path listed explicitly; state `None` when no Git action is appropriate
