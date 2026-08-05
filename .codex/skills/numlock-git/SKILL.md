---
name: numlock-git
description: Apply NUMLOCK Git review, staging, commit, and push safeguards. Use for status or diff review, staging plans, commit boundaries, branch or remote verification, or explicitly authorized Git completion.
---

# NUMLOCK Git

Treat `AGENTS.md` as the highest-priority repository contract. Git actions are separate from clasp upload, Apps Script versioning, and deployment.

## Ownership

- Inspect `git status --short` and scoped diffs before recommending or performing Git actions.
- Preserve unrelated changes and stage every approved path explicitly; never use `git add .`, `git add -A`, or broad globs.
- Separate implementation and documentation commits when they are materially distinct and independently reviewable.
- Review cached names, diff, and whitespace before commit.
- Provide ready-to-copy commit and push commands with explicit paths, branch, and remote when relevant.
- Verify the current branch and remote URL before a consequential push without exposing credentials.
- Never commit or push unless the user explicitly authorizes that exact action.

## Non-goals

Do not own clasp inventory, upload, deployment, release versions, or application validation.

## Token-saving mode

Inspect only status, approved diffs, branch, and remote facts needed for the requested Git step. Report exact task paths and exclude unrelated files.
