# Git Workflow

## Branch and scope

`main` is the current permanent branch. Use a temporary branch only when the user explicitly requests it or a risky review workflow requires one. Always inspect status before editing and preserve unrelated worktree changes.

## Review and staging

Before recommending a commit:

```sh
git diff --check
git status --short
git diff -- path/to/approved-file
```

Stage every approved path explicitly:

```sh
git add path/to/approved-file another/approved-file
git diff --cached --name-only
git diff --cached --check
```

Never use `git add .`, `git add -A`, or broad glob staging. Do not include `.clasp.json`, credentials, `.DS_Store`, unrelated work, or unreviewed generated files.

## External actions

Commit, Git push, tag, GitHub release, clasp upload, Apps Script version creation, and deployment are separate actions. Each requires explicit authorization. A recommended command does not authorize execution.

## Documentation commits

Documentation-only work must remain separate from application behavior changes when practical. Source decomposition commits must list every moved/created/removed file, update `.claspignore` atomically, and prove each global exists exactly once.
