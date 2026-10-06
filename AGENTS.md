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

Primary entrypoint: `numlock` (read-only classifier/orchestrator/delegator).
Classify three independent dimensions:

- **Reasoning demand L1-L4:** L1 mechanical; L2 bounded work on established
  patterns; L3 substantial multi-step reasoning under established authorities;
  L4 novel or high-ambiguity reasoning that established contracts cannot resolve.
  Size, file count, gate count, test volume, browser work, production context,
  deployment, R3, and R4 do not alone make work L4.
- **Operational risk R1-R4:** controls permissions, human authorization,
  mutation budget, fail-closed behavior, and retry policy. Risk never directly
  selects a model.
- **Execution state:** `CONTINUE`, `ESCALATE`, or `BLOCK`.

### Specialist Agents

| Agent            | Scope                               | Implementation                                                           |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| numlock-explore  | Read-only exploration, audit, trace | No                                                                       |
| numlock-light    | L1 local work                       | Yes (bounded)                                                            |
| numlock-medium   | L2 local work                       | Yes (bounded)                                                            |
| numlock-heavy    | L3 local work                       | Yes (local implementation + validation)                                  |
| numlock-critical | ANY/R4                              | Local preparation; risky action only within explicit human authorization |
| numlock-commit   | Local Git staging/commit only       | No (explicit-path staging + commit)                                      |
| numlock-ops      | Deterministic operations            | Only within exact allowlist, authorization, and mutation budget           |

### Initial Routing

- Explicit read-only → numlock-explore on Free
- L1 → numlock-light on Free
- L2 → numlock-medium on Free
- L3 → numlock-heavy on Free
- Clearly intrinsic L4 → `9router/numlock-sol` directly; do not waste a
  mandatory Free attempt
- ANY/R4 → numlock-critical on Free unless independent L4 evidence selects Sol
- Explicitly authorized local commit → numlock-commit on Free

R4 overrides operational routing, not reasoning demand. L2+R4 means Free plus
strict permissions, explicit human gate, and bounded mutation budget—not Sol.

### Premium Model Routing

| Agent            | Initial Model                      | Sol use                                      |
| ---------------- | ---------------------------------- | -------------------------------------------- |
| numlock/explore/light/medium | `9router/numlock-explore-free` | Evidence-based escalation only               |
| numlock-heavy    | `9router/numlock-explore-free`      | L4 or measured reasoning blocker             |
| numlock-critical | `9router/numlock-explore-free`      | Independent L4 or measured reasoning blocker |
| numlock-commit/ops | `9router/numlock-explore-free`    | Never for deterministic execution            |

Premium reasoning authority: `9router/numlock-sol`. Free execution authority:
`9router/numlock-explore-free`. OpenCode remains sole execution and coordination
entrypoint through 9Router. Only configured OpenAI-compatible routes are used;
protocol compatibility does not make an external agent. No silent backend
substitution. Premium unavailability returns `PREMIUM_BACKEND_REQUIRED` only
when Sol was validly selected.

Free must escalate in the same task when measured evidence establishes one exact
reason:

1. `AUTHORITY_CONFLICT` — authoritative sources materially conflict and no deterministic precedence exists.
2. `ARCHITECTURAL_AMBIGUITY` — necessary design decision is absent from architecture/contracts.
3. `REASONING_INSUFFICIENCY` — bounded Free attempt cannot safely determine implementation or prove required invariant.
4. `CROSS_SUBSYSTEM_CONTRADICTION` — Transaction/Finance/Product interaction needs non-mechanical synthesis unresolved by established authorities.
5. `NOVEL_RECOVERY_REQUIRED` — production mutation outcome is uncertain and no predefined recovery safely determines next action.
6. `VALIDATION_CONTRADICTION` — implementation, authoritative tests, or runtime evidence materially contradict and deterministic tracing cannot establish correct state.
7. `OWNER_PREMIUM_REQUEST` — owner explicitly requests premium/Sol.

Escalation sends smallest sufficient context and exact `ESCALATION_REASON`, not
full task history. Sol resolves reasoning only. When remaining work is
mechanical, Sol returns a concise `RESOLUTION/EXECUTION CONTRACT`; primary hands
editing, tests, Git operations, exact authorized commands, browser probes, and
structured reconciliation back to Free. Do not retain Sol for convenience. Use
smallest supported orchestration pattern if direct model handoff is unavailable.

Infrastructure and capability failures never select Sol. Return exact state:

- `BLOCKED_AUTH`: invalid/expired/missing OAuth or external authentication
- `BLOCKED_PERMISSION`: denied or non-allowlisted command
- `BLOCKED_CAPABILITY`: unavailable shell, browser, file, or required tool
- `BLOCKED_NETWORK`: network, DNS, or unreachable deployment
- `BLOCKED_HUMAN_GATE`: required approval absent
- `BLOCKED_MUTATION_BUDGET`: authorized attempt count exhausted

For one parent objective, permit one primary Free attempt and at most one
predefined, materially different bounded recovery. No loops. After both fail,
reasoning insufficiency escalates to Sol; infrastructure blocks; uncertain
mutation follows existing recovery on Free or uses `NOVEL_RECOVERY_REQUIRED`
only when no contract determines a safe next action. No autonomous mutation
retry or recursive remediation.

### Routing Acceptance Examples

1. Read/search source → Free.
2. Large multi-file implementation following established pattern → Free.
3. Large task with many sequential gates and deterministic contracts → Free.
4. Read-only production diagnostic → Free, subject to command permission.
5. Known one-shot production mutation, explicit authorization, L2/R4 → Free + HUMAN_GATE.
6. `clasp invalid_grant` → `BLOCKED_AUTH`; no Sol.
7. Missing shell/command permission → `BLOCKED_CAPABILITY` or `BLOCKED_PERMISSION`; no Sol.
8. Network failure → `BLOCKED_NETWORK`; no Sol.
9. Materially contradictory authoritative accounting contracts without deterministic precedence → automatic Sol (`AUTHORITY_CONFLICT`).
10. Free implementation discovers architecture decision absent from frozen contract → automatic Sol (`ARCHITECTURAL_AMBIGUITY`).
11. Uncertain production mutation with fully determining recovery contract → deterministic recovery on Free where safe.
12. Uncertain production mutation without safe recovery contract → automatic Sol (`NOVEL_RECOVERY_REQUIRED`).
13. Sol resolves ambiguity; edit/test/commit remains → return to Free with resolution/execution contract.
14. Owner explicitly requests Sol → direct Sol permitted (`OWNER_PREMIUM_REQUEST`).
15. R4 simple predetermined command with explicit authorization → Free + HUMAN_GATE.
16. L4 non-production architecture problem → Sol despite low operational risk.

### Execution architecture

Use repository authorities plus concise task delta. Delegations carry exact
scope, blocker or escalation reason, and needed evidence; never duplicate full
NUMLOCK architecture or premium transcript. Reasoning effort is independent of
risk and model label.

HEAVY performs authorized deterministic L3 local implementation in small
validated steps. CRITICAL prepares exact files, target, operation count,
expected write footprint, checks, and reconciliation. If risky action lacks
exact authorization, return `HUMAN_GATE_REQUIRED`. Existing authorization
persists only within exact scope and count. Ambiguous or stale authorization is
not permission. Sol selection never widens operational authority.

Never downgrade financial semantics to evade a boundary. No deployment,
production write, migration, credential mutation, destructive Git operation,
or historical backfill is authorized by classification or model. Shell approval
is additional enforcement; generic shell/interpreter commands cannot bypass
business gates.

CodeGraph remains a local code tool. Use allowed `codegraph explore`/`codegraph
status` when no MCP is configured. Do not initialize/reindex during routine
exploration.

### Upload manifest gate

Before any separately authorized `clasp push --force`, capture actual `clasp status` from the exact clean deployment workspace. Verify the full upload manifest, required runtime/test inventory and exclusions before the human gate. File presence, an archive, and source diff alone are insufficient. An upload is not an immutable deployment or authenticated runtime proof.

### Clasp execution rules

**Rule 7 — Second push prohibition:** After one task-authorized `clasp push --force`, no second push may occur merely to retry, reconcile counts, normalize manifests, or resolve uncertainty. A second `clasp push --force` requires a NEW explicit task authorization.

**Rule 8 — No manual deferral:** When the active task explicitly authorizes a clasp command and OpenCode has technical capability to execute it, the agent must execute the command itself. It must not defer the command back to the user for manual shell execution. Human approval may be required before execution, but after approval the authorized command remains OpenCode's responsibility.

See `docs/AGENT-ARCHITECTURE.md` for the executable routing contract and evidence limits.
