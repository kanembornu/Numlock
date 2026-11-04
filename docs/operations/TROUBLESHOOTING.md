# Troubleshooting

## clasp account or project mismatch

Symptoms include the configured project not appearing for the active account, authorization errors, or an unexpected upload inventory.

1. Stop before push.
2. Run `clasp show-authorized-user`.
3. Run `clasp list` and confirm the intended project is visible without copying IDs into reports.
4. If necessary, the operator runs `clasp logout`, `clasp login`, then repeats the checks.
5. Do not change `.clasp.json` merely to match the wrong account.

## Unexpected clasp files

Run `clasp status`. In the current layout, only the manifest and three application files should be tracked. If documentation, Git metadata, workspace files, or credentials appear, stop and inspect `.claspignore`; do not push.

## Syntax passes but Apps Script fails

Local Node checks do not provide Apps Script services. Record the exact live function and error, stop, and inspect V8 compatibility, missing globals, file inventory, and load-time initialization. Do not guess or claim runtime PASS from a local mock.

## A migration test differs

Stop on the first thrown mismatch. Record the validator, field/category/array involved, and legacy versus aggregate values. Do not delete the legacy oracle or adjust formulas until the difference is understood.

## `clasp run` cannot find a function

Editor-runnable globals are not automatically available through `clasp run`. That command requires a compatible Apps Script API executable deployment. Use the Apps Script editor for the documented live tests unless such an executable is deliberately configured.

## Browser appears unchanged

Confirm a new Apps Script version was created and the intended deployment points to it. Hard-refresh the dashboard and verify the URL/version before treating the browser as evidence.

## Dirty worktree

Use `git status --short` and scoped diffs. Preserve unrelated changes, stage explicit paths only, and never use destructive reset/checkout commands to clean a mixed worktree without clear authorization.
