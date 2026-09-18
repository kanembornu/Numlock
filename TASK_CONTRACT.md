# Task Contract

Reusable execution rules for every NUMLOCK task. References `AGENTS.md` for
project-level invariants, routing, and specialist contracts. When both files
conflict, the more specific source wins: task prompt > TASK_CONTRACT.md > AGENTS.md.

## Scope & Minimal Change

- Every task is a single bounded objective.
- Change only files listed in the task scope. Nothing else.
- Smallest complete change that satisfies the objective. No adjacent cleanup,
  refactoring, or speculative improvement.
- Preserve existing behavior unless the task explicitly changes it.

## Read-Only vs Mutation Boundary

Tasks declare their mutation boundary. Anything not explicitly authorized is
read-only.

- **Read-only tasks**: inspect, audit, trace, propose. No file writes. No git
  mutations. No shell mutations.
- **Mutating tasks**: state authorized files, permitted mutation types, and
  forbidden operations. Everything outside that list is forbidden.
- Agents must not implicitly widen a read-only task into a mutating one.

## Fail-Closed

- Unknown or ambiguous permission: deny.
- Task scope unclear: ask, do not guess.
- Validation fails: report failure, do not mask or retry silently.
- Blocker found: stop, do not work around.

## Production Safety

- No deployment, `clasp push`, or production state change unless the task
  explicitly authorizes it.
- No credential access, creation, rotation, or display.
- No production spreadsheet write, API call to external services, or
  third-party mutation.
- Financial authority changes (COGS, inventory, accounting) are always
  R4 / Critical floor. See AGENTS.md for R4 rules.

## Git Safety

- Never `git add .` or `git add -A`. Stage files explicitly.
- Never commit, push, reset, or discard unless the task explicitly authorizes it.
- Recommended Git commands list every file path. No broad patterns.
- Distinguish task changes from pre-existing worktree changes before staging.
- See AGENTS.md for agent-level git permissions.

## Testing & Evidence

- Test acceptance requires **MEASURED** evidence: actual test execution after
  final source modification.
- **ESTIMATED** (historical baseline + new test count) is never sufficient.
- **UNKNOWN**: report when execution is impossible in the current session.
- Never fabricate test counts, pass rates, or execution metrics.
- Distinguish evidence classes: local/static checks ≠ `clasp` upload ≠
  Apps Script runtime ≠ browser acceptance.

## Retry Policy

- One implementation pass. One validation pass. Repair only on failure.
- Do not repeat unchanged file reads, re-run tests without code changes, or
  retry known-denied commands.
- If the same failure recurs after one repair attempt: escalate, do not retry
  again.

## Infrastructure Blocker vs Source Failure

- **Infrastructure blocker**: `clasp` unavailable, GAS API unreachable,
  deployment auth failure. Report as BLOCKED. Do not retry. Do not change
  source to work around.
- **Source failure**: syntax error, logic error, contract violation. Fix and
  re-validate once.
- Never conflate infrastructure failures with source correctness.

## Acceptance & Reporting

Every completed task reports:

1. Changed files (explicit paths)
2. Validation performed and result (MEASURED / UNKNOWN / BLOCKED)
3. Remaining risks or blockers
4. Recommended Git commands with explicit file paths; `None` when no action

Statuses: PASS, FAIL, BLOCKED, UNPROVEN. No invented intermediate statuses.

## Human Authorization Gate

Required before:

- Destructive operations (delete, overwrite, destructive git)
- Production deployments or `clasp push` (unless task explicitly authorizes)
- Financial authority changes, schema migrations, backfills
- Credential mutations
- Any action where the cost of error is unrecoverable

Existing specific authorization persists within its stated scope and count.
Ambiguous or stale authorization is not permission.

## Escalation on Repeat Stall

If the same parent problem stalls twice under the current specialist:

1. Return `ESCALATION_REQUIRED` with reason, target class, modification
   status, and validation performed.
2. Do not attempt a third retry at the same complexity/risk level.

## Cleanup

- Remove temporary files, scratch directories, and debug artifacts before
  completion.
- Leave the worktree cleaner than you found it (within scope).
- No orphaned test files, mock data, or debugging logs.

---

## Default Task Prompt Format

```
CURRENT TASK — <name>

Objective:
<what must be achieved>

Scope:
<only task-specific scope>

Constraints:
<only constraints beyond AGENTS.md and TASK_CONTRACT.md>

Acceptance:
<observable result>
```

**Normal tasks** stay short. Only these sections when relevant.

**Long-form specifications** reserved for genuinely exceptional operations:
destructive changes, production migrations, accounting-authority changes,
irreversible operations, or other cases where additional explicit controls
are materially necessary.
