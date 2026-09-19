# NUMLOCK OpenCode Operating Contract

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

### One Specialist Principle

After classification and context packaging, delegate once to the selected
specialist. For Heavy tasks, numlock-heavy owns implementation, local
commands, focused tests, repair, and final audit within its permission
boundary.

Do NOT delegate to numlock-medium merely for Node execution, test harness
execution, Git status, diff audit, or ordinary file inspection. A downstream
delegation is allowed only when a genuinely distinct capability is required.
If delegation occurs, telemetry must state WHY.

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
- PREMIUM_FALLBACK_POLICY

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

Primary entrypoint: `numlock` (read-only classifier/delegator).

### Specialist Agents

| Agent            | Scope                               | Implementation                                                           |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| numlock-explore  | Read-only exploration, audit, trace | No                                                                       |
| numlock-light    | L1/R1 trivial local                 | Yes (bounded)                                                            |
| numlock-medium   | L2/R1-R2 bounded multi-file         | Yes (bounded)                                                            |
| numlock-heavy    | L3-L4/R1-R3                         | Yes (local implementation + validation)                                  |
| numlock-critical | ANY/R4                              | Local preparation; risky action only within explicit human authorization |
| numlock-commit   | Local Git staging/commit only       | No (explicit-path staging + commit)                                      |

### Routing

- Explicit read-only → numlock-explore
- L1/R1 → numlock-light
- L2/R1-R2 → numlock-medium
- L3/R1-R3 → numlock-heavy
- L4/R1-R3 → numlock-heavy
- ANY/R4 → numlock-critical
- Explicitly authorized local commit → numlock-commit

### Premium Model Routing

| Agent            | Default Model        | Premium Model  | Fallback   |
| ---------------- | -------------------- | -------------- | ---------- |
| numlock-explore  | numlock-explore-free | —              | -          |
| numlock-light    | numlock-explore-free | —              | -          |
| numlock-medium   | numlock-explore-free | —              | -          |
| numlock-heavy    | numlock-sol          | cx/gpt-5.6-sol | NONE       |
| numlock-critical | numlock-sol          | cx/gpt-5.6-sol | NONE       |
| numlock-commit   | numlock-explore-free | —              | -          |
| numlock-ops      | numlock-explore-free | —              | -          |

Premium route: OpenCode → 9Router → Codex OAuth → GPT-5.6 Sol
Free route: OpenCode → 9Router → numlock-explore-free → oc/mimo-v2.5-free → oc/big-pickle

Primary, helper, and ordinary specialists use the 9router free combo. Heavy and
Critical use the strict Sol-only route through 9router. Reasoning effort
(medium/high) is a request parameter, not a model selector.
Escalate to HIGH reasoning only when:

- Architecture must be derived
- Multiple modules have non-trivial invariants
- Competing designs require resolution
- Production-safe migration reasoning is substantial

Critical uses Sol by default. Reasoning effort (medium/high) is a request parameter.
Escalate to HIGH when complexity/risk requires it. Do not automatically choose HIGH because classification = Critical.

Fallback policy:

- Primary/Explore/Light/Medium/Commit/Ops: `9router/numlock-explore-free`
- Heavy/Critical: premium-only route; no proxy fallback to OpenCode free tier
- If premium unavailable: PREMIUM_BACKEND_REQUIRED
- Auth/config errors surface as configuration failures, not quota exhaustion

SUBSCRIPTION_PROXY_RISK_NOTICE_PRESENT: 9Router subscription/OAuth proxy use may not be officially licensed for this use and may risk account restriction.

R4 overrides complexity. Heavy floor applies when the task may CHANGE (not merely inspect or reason about): financial architecture, transaction semantics, accounting authority, COGS authority, inventory authority, atomicity, concurrency, idempotency/recovery semantics, locking design, cross-core-module production state behavior, or schema/data model affecting financial meaning. Reading or reasoning about financial modules to repair tests, fixtures, or assertions is MEDIUM-eligible provided production source mutation is prohibited, financial authority is unchanged, no production action occurs, and no architectural redesign is requested. Dynamic escalation remains: MEDIUM must return ESCALATION_REQUIRED if inspection reveals the task actually requires changing production financial semantics.

### Escalation

Specialists must return `ESCALATION_REQUIRED` with reason, target class, modification status, and validation performed when task exceeds assigned scope.

For one parent objective, allow one normal Free execution and at most one bounded Free recovery. Recovery must use current-state evidence, address a concrete failure with a changed approach or repair, and stay within existing scope and permissions. After both fail, prohibit more Free retries. Escalate to Heavy/Sol only when the unresolved objective warrants L3-L4/R1-R3; otherwise stop and report the blocker. Routine Light/Medium work must not auto-route to Sol. R4 always routes to Critical and retains the exact human authorization gate.

### Execution architecture

OpenCode is the sole execution and agent coordination application. Primary and
ordinary specialist requests use the project 9router free combo; Heavy and
Critical use the project 9router provider for Sol. Codex, ChatGPT, and OpenAI
agents are not required handoff targets, reviewers, or coordinators. An
OpenAI-compatible HTTP client is a protocol adapter, not an OpenAI agent.

The project config selects `9router/numlock-explore-free` for Primary, helper,
and ordinary specialists, and `9router/numlock-sol` for Heavy/Critical. Config
selection does not prove route contents or runtime availability. Unavailable
premium routes return `PREMIUM_BACKEND_REQUIRED`.

HEAVY performs authorized local implementation in small validated steps. CRITICAL prepares the exact files, target, operation count, expected write footprint, checks and reconciliation first. If the risky action is not already explicitly authorized, return `HUMAN_GATE_REQUIRED` for that concrete action. Existing specific authorization persists within its stated scope and count; do not ask again merely because the class is CRITICAL. Ambiguous or stale authorization is not permission.

Never downgrade financial semantics to MEDIUM to evade a boundary. No deployment, production write, migration, credential mutation, destructive Git operation, or historical backfill is authorized by classification alone. Shell approval is an additional enforcement layer; generic shell/interpreter commands must not bypass these rules.

CodeGraph remains a local code tool. Use the allowed `codegraph explore`/`codegraph status` commands when no MCP is configured. Do not initialize/reindex as part of routine exploration.

### Upload manifest gate

Before any separately authorized `clasp push --force`, capture actual `clasp status` from the exact clean deployment workspace. Verify the full upload manifest, required runtime/test inventory and exclusions before the human gate. File presence, an archive, and source diff alone are insufficient. An upload is not an immutable deployment or authenticated runtime proof.

### Clasp execution rules

**Rule 7 — Second push prohibition:** After one task-authorized `clasp push --force`, no second push may occur merely to retry, reconcile counts, normalize manifests, or resolve uncertainty. A second `clasp push --force` requires a NEW explicit task authorization.

**Rule 8 — No manual deferral:** When the active task explicitly authorizes a clasp command and OpenCode has technical capability to execute it, the agent must execute the command itself. It must not defer the command back to the user for manual shell execution. Human approval may be required before execution, but after approval the authorized command remains OpenCode's responsibility.

See `docs/AGENT-ARCHITECTURE.md` for the executable routing contract and evidence limits.
