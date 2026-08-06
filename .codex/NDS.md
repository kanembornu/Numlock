# NUMLOCK Development System

## Principles

Read `AGENTS.md`; load only the task owner, current workspace note, and relevant playbook. Link authorities instead of copying history. Preserve behavior unless explicitly changed. Report evidence by level.

## Token budget

- Intake: one template, preferably ≤180 words.
- Context: `CURRENT.md` plus at most one playbook and two authority sections.
- Updates: only decisions, gaps, and next action; archive history in owning docs.
- Stop when scope and required validation are complete.

## Knowledge hierarchy

1. `AGENTS.md` and user scope.
2. Production source/tests.
3. `docs/PROJECT_STATUS.md` and domain authorities.
4. `.codex/workspace/` current state.
5. Skills, playbooks, templates, checklists.

Higher levels override lower ones. `CURRENT.md` never becomes history.

## Lifecycle

Template → inspect `CURRENT/NEXT/KNOWN_GAPS/DECISIONS` → execute one playbook → validate → update current-state pointers and owning docs → stop.

## Definition of Done

Scope is complete; preserved contracts are evidenced; required checks pass; later evidence is explicitly unverified; current/next/gaps are synchronized; Git status is reported; no unauthorized upload, deployment, commit, or push occurred.
