# NUMLOCK OpenCode Operating Contract

## Project

NUMLOCK is a Google Apps Script V8 web application and business-intelligence dashboard. Preserve compatibility with Apps Script, `clasp`, spreadsheet services, and the existing HTML frontend.

## Task Classification

- At the start of every prompt, state whether it is a `NEW TASK` or a `CURRENT TASK`.
- Treat a prompt as a `NEW TASK` when it introduces a separate objective or explicitly labels itself that way.
- Treat a prompt as a `CURRENT TASK` when it continues, corrects, or narrows work already in progress.
- Use token-saving mode for simple tasks: inspect only what is relevant, communicate concisely, avoid unnecessary tooling, and stop immediately when the requested scope is complete.

## Task Prompt Minimality Contract

Task prompts are the authoritative delta layer over repository contracts.

- Task prompts contain only task-specific deltas. Existing repository contracts are inherited automatically.
- Routing, execution, safety, evidence, testing, recovery, Git/clasp policy, and other established rules must not be repeated unless the task introduces an exception or new boundary.
- COMPACT is the default task format. EXTENDED is used only when additional task-specific boundaries or acceptance semantics are not already authoritative. EXPLICIT/CRITICAL is reserved for new contracts, ambiguous/high-risk boundaries, activation/migration/destructive operations, or explicit operational exceptions.
- Technical complexity alone does not justify a longer prompt.
- Omit empty or non-applicable task sections.
- Reports request only fields needed to determine acceptance and the next gate.

### Default Compact Structure

````markdown
[TASK TYPE] — <Task Name>

OBJECTIVE
SCOPE
REQUIRED OUTCOME
TASK-SPECIFIC INVARIANTS   # omit when none
ACCEPTANCE
REPORT
````

## Required Workflow

1. Inspect the repository state, applicable instructions, and every relevant target or reference file before editing.
2. Confirm the requested scope and keep the task tightly bounded.
3. Preserve existing behavior unless the user explicitly requests a behavior change.
4. Make only the smallest complete change needed for the stated objective.
5. Validate the changed files and repository state before completion.
6. Stop immediately once the requested scope and validation are complete.

## Agent Skills Policy

- `AGENTS.md` is the sole authority for cross-cutting workflow, routing, escalation, recovery, safety, and evidence policy. User scope and this contract override generic skill guidance.
- Specialist agent contracts inherit this file. They must contain only role-specific behavior and overrides plus concise references to inherited authority; they must not duplicate cross-cutting policy.
- Route skills selectively; do not invoke them unnecessarily for simple isolated tasks. For small isolated patches, follow `AGENTS.md` alone unless extra workflow guidance is materially useful.
- For multi-file or non-trivial implementation, prefer `@incremental-implementation`.
- For bugs, failing tests, or unexpected runtime behavior, prefer `@debugging-and-error-recovery`; add `@test-driven-development` when the behavior can be covered by tests.
- For significant new features or architectural changes, use `@spec-driven-development` before implementation.
- For non-trivial completed changes, use `@code-review-and-quality` when an additional review gate is warranted.
- Use `@context-engineering` for complex session starts, major task switches, or when project constraints risk being lost.
- Skills must not broaden scope, modify frozen UI boundaries, trigger unrelated refactors, or introduce unrequested work.
- Existing NUMLOCK validation, Git, `clasp`, deployment, and completion rules remain authoritative.

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

## Autonomous Execution Contract

Owner decision: routine technical operations run fully automated inside the task scope. An approved task authorizes all necessary operations within its explicit boundaries. Do not request repetitive owner approval for routine operations already included in that scope.

### Automation Loop

For every authorized task: `PLAN → IMPLEMENT → TEST → DIAGNOSE → FIX → RETEST → VERIFY → COMPLETE`. Continue automatically through recoverable failures within scope and bounded recovery. Do not stop at the first fixable failure.

### Task-Gated Write Authorization

- Read-only inspection (`clasp status`, `clasp versions`, `clasp deployments`, `clasp pull` to isolated workspace for source-byte parity, `git diff/log/rev-parse`, `node --check/--test`, preflight scripts) is auto-allowed via `opencode.json`. Isolated pull never overwrites the primary repository.
- Source synchronization (`clasp push --force`), version creation (`clasp version`), deployment update/creation (`clasp deploy/redeploy`), rollback, provider/policy activation, business writes, and `git add/commit/push/reset` remain task-gated: they require that the *task* explicitly authorizes them. Shell allow alone is not business authorization. `AGENTS.md` Rules 7/8 still apply (one push per authorization; OpenCode executes after approval, no manual deferral).
- `numlock-critical` / `numlock-ops` additionally gate `clasp *` as `ask` for human-gated operations; `clasp status/versions/deployments` are `allow` for parity checks.

### Pre-Sync / Pre-Deploy / Post-Deploy Safety

Before source synchronization: verify `scriptId 1zQfkkcA7JPrzYqJAdtRaZGixmc1lQ7b7KyyOS3cpmmhanRvovQkyWsZc` project identity, read actual remote Editor HEAD (`clasp status` manifest gate), compare file inventory + `appsscript.json` hashes against reviewed package `efbeeabfae0dd27dcf64434097444c1bf59a7fec0b4f9f243756161cd8e0649c` aggregate, detect unreviewed remote changes, preserve recoverable baseline. Before deployment: verify existing deployment `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` identity, preserve Web App URL/executeAs/access, create immutable version, update existing deployment (never duplicate). After deployment: run authorized runtime verification, detect regressions, safe rollback to `721` when required (pointer move only, never reverse committed journals).

### Data Integrity

Preserve double-entry accounting, canonical workbook `1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M` authority (`requireNumlockProductionSpreadsheet()`), idempotency, single-commit integrity, durable `(OperationType,RequestKey)` identity, Correct/Void semantics, historical recovery, inventory metadata-only. Never fabricate success, replay uncertain commits, or rewrite historical records.

## Required Completion Output

Every completed task must report:

1. Changed files
2. Validation performed and result
3. Remaining risks or blockers
4. Recommended Git commands, with every path listed explicitly; state `None` when no Git action is appropriate

### Execution Performance

For bounded tasks, execute in phases:

1. Baseline verification (one batch)
2. Single batched discovery
3. Single primary implementation pass
4. Focused test cycle
5. Repair only if tests fail
6. Single combined final audit

Avoid repeated unchanged file reads, repeated git status without mutation,
re-running tests without code changes, broad scans after dependency closure,
and permission retries for known-denied commands.

Start from current state and supplied context. Inspect history only when the task
requires it or a concrete unresolved dependency points there. Keep discovery
bounded to the known dependency closure. Keep deterministic work with the
current specialist when its permissions cover the work.

Batch independent operations. Read files once unless changed. Combine
final verification where safe. Stop immediately on true blocker.

Record completion telemetry when available: agent, backend, model, reasoning,
fallback used, toolcalls, elapsed, files read/modified, test runs.

### Measured Evidence Contract

Source-changing tasks must not claim PASS, READY_FOR_SYNC, or ACCEPTED
from an estimated test count. Required acceptance evidence must distinguish:

- MEASURED: actual test execution after final source modification
- ESTIMATED: based on historical baseline + new test count (not sufficient)
- UNKNOWN: execution not possible in current session

Test acceptance requires MEASURED evidence. If final regression cannot run,
status must remain BLOCKED or UNPROVEN. Do not infer N passed from
historical baseline + new test count.

Telemetry must report actual measured values when available. Use UNKNOWN
when unavailable. Never fabricate "~N toolcalls" or "~N minutes" as
measured evidence.

### Primary execution and optional specialists

Primary owns local development, edits, debugging, tests, repair, and final
audit directly. Delegation is optional for a distinct capability, never a
prerequisite for shell or test execution. When delegated, give one specialist
a bounded scope and report why it was useful; do not repeat its work.

### Compact Context Package

When delegating to Heavy/Critical, construct a compact context package
containing:

- TASK_ID (unique identifier)
- COMPLEXITY and OPERATIONAL_RISK
- REASONING_EFFORT (medium/high)
- BASELINE_COMMIT and ORIGIN_COMMIT
- AUTHORIZED_FILES (exact list)
- DEPENDENCY_CLOSURE (known file relationships)
- BUSINESS_INVARIANTS (frozen contracts)
- TECHNICAL_INVARIANTS (schema, locking, persistence rules)
- FORBIDDEN_OPERATIONS (explicit prohibitions)
- REQUIRED_TESTS (specific test expectations)
- ACCEPTANCE_GATES (pass/fail criteria)
- KNOWN_PRIOR_EVIDENCE (accepted results, not to re-prove)
- BACKEND_AND_RECOVERY_POLICY

The specialist receives this compact contract instead of a full task
reconstruction. Repository/source remains authoritative on conflict.

### CodeGraph

For structural code inspection, check CodeGraph availability once. If available,
use it first, especially before modifying shared logic. If unavailable, move
immediately to targeted source discovery; do not retry availability checks.

Before editing shared Dashboard or Performance logic:

- inspect relevant symbols and callers/callees;
- check blast radius into frozen or out-of-scope sections;
- identify relevant tests.

CodeGraph is advisory. Source code, explicit scope/freeze rules,
runtime behavior, and tests remain authoritative. Use targeted source/runtime
inspection where CodeGraph is unavailable or cannot confidently establish
HTML/CSS, Apps Script client/server, or visual relationships.

## OpenCode Routing

Primary entrypoint: `numlock`, the local development executor. OpenCode +
9router remains the configured execution path. All project agents use
`9router/numlock-explore-free`; no alternate model dependency is configured.

Classify reasoning demand L1-L4 independently from operational risk R1-R4.
Primary can perform local development at every reasoning level. Complexity
alone does not require delegation or a different model. Unresolved reasoning
must be reported with evidence rather than silently changing backend.

Optional specialists: `numlock-explore` for read-only audit, `numlock-light`
for L1, `numlock-medium` for L2, `numlock-heavy` for L3, `numlock-browser` for
browser acceptance, `numlock-critical` for R4 preparation and exactly
owner-authorized controlled operations, `numlock-commit` for explicitly
requested local staging/commit, and `numlock-ops` for bounded authorized ops.
Neither classification nor delegation grants production or Git authorization.

### Development shell and production boundary

Normal compound/piped local commands are permitted by project policy.
Until process isolation is verified, unknown shell commands require approval
(`ask`), not automatic allowance or blanket denial. No unrestricted shell is
enabled. Do not use auto-approve mode to bypass this fallback.

The current checkout shares the user's home and has a production association;
credential-file presence is not evidence of isolation. OpenCode pattern rules
and `external_directory` checks are permission controls, not an OS sandbox.
An approved interpreter/package script can access credentials or network.
No command prefix denylist can establish production isolation for arbitrary code.
See `docs/LOCAL-EXECUTION-CONTRACT.md` for the required isolation evidence.

Production writes, deployment, migrations, credentials, destructive Git and
historical backfills still require exact owner authorization, role permissions,
and operation counts. Primary and development specialists cannot run clasp.
Shell approval alone never grants business authority.

### Bounded recovery and evidence

For one parent objective, allow one primary attempt and at most one predefined,
materially different bounded recovery. No loops or autonomous mutation retries.
Report unresolved reasoning with its sources and required decision. Return
precise infrastructure states: `BLOCKED_AUTH`, `BLOCKED_PERMISSION`,
`BLOCKED_CAPABILITY`, `BLOCKED_NETWORK`, `BLOCKED_HUMAN_GATE`, or
`BLOCKED_MUTATION_BUDGET`. A 401/expired token is `BLOCKED_AUTH`; do not retry
unchanged credentials or silently change backend.

Local config tests prove configuration only. Node shell probes prove only the
current Node process can execute those probes. Actual OpenCode permission,
model execution, optional delegation, Apps Script and browser acceptance each
need their own measured evidence. Never infer isolation from a missing allow rule.

CodeGraph remains a local code tool. Try it once when available; do not
initialize/reindex during routine exploration. Source and tests remain authority.

### Upload manifest gate

Before any separately authorized `clasp push --force`, capture actual `clasp status` from the exact clean deployment workspace. Verify the full upload manifest, required runtime/test inventory and exclusions before the human gate. File presence, an archive, and source diff alone are insufficient. An upload is not an immutable deployment or authenticated runtime proof.

### Clasp execution rules

**Rule 7 — Second push prohibition:** After one task-authorized `clasp push --force`, no second push may occur merely to retry, reconcile counts, normalize manifests, or resolve uncertainty. A second `clasp push --force` requires a NEW explicit task authorization.

**Rule 8 — No manual deferral:** When the active task explicitly authorizes a clasp command and OpenCode has technical capability to execute it, the agent must execute the command itself. It must not defer the command back to the user for manual shell execution. Human approval may be required before execution, but after approval the authorized command remains OpenCode's responsibility.

See `docs/AGENT-ARCHITECTURE.md` for the executable routing contract and evidence limits.
