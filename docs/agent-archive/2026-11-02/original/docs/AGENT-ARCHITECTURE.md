# NUMLOCK agent architecture

Effective local contract: 2026-09-10. OpenCode + 9router is the sole agent execution path.

## Routing

User → OpenCode `numlock` classifier/orchestrator → NUMLOCK specialist → 9router on localhost:20128 → configured OpenCode model route.

Routing keeps three dimensions independent: reasoning demand L1-L4,
operational risk R1-R4, and execution state CONTINUE/ESCALATE/BLOCK.

| Class | Specialist | Initial execution |
|---|---|---|
| Read-only | numlock-explore | Free; inspect and report |
| L1 | numlock-light | Free; mechanical local work |
| L2 | numlock-medium | Free; bounded established-pattern work |
| L3 | numlock-heavy | Free; substantial deterministic implementation and validation |
| Intrinsic L4 | Sol reasoning | Direct Sol when strong evidence exists; deterministic execution returns to Free |
| ANY/R4 | numlock-critical | Free by default; prepare locally, then execute only specifically authorized risky action |
| Explicit local commit | numlock-commit | Free; exact named paths and message; no push/history rewrite |

R4 controls permission, human gate, mutation budget, fail-closed behavior, and
retry policy; it does not select Sol. L2+R4 remains Free + HUMAN_GATE. Read-only
financial analysis does not authorize financial changes. Production authority,
deployment, migration, credentials, and destructive actions retain human gate.
Valid explicit gate persists within exact scope and operation count. Preserve
uncertainty after count-limited attempt.

## Configuration ownership

- `AGENTS.md`: authoritative scope, evidence and authorization policy.
- `opencode.json`: enables only the project 9router provider; main and helper routing use `numlock-explore-free`, Sol uses `numlock-sol`, default agent is numlock, and AGENTS.md is loaded explicitly.
- `.opencode/agents/*.md`: the single project definition of each specialist's prompt and permissions. Avoid duplicating numlock in JSON and Markdown.
- CodeGraph: local structural code tool, available through allowed `codegraph explore` and `codegraph status`; no dependency on an OpenAI agent or MCP host. Source/runtime checks remain necessary for HTML and Apps Script boundaries.
- Generic Node/package commands require permission checks because they can execute arbitrary code. An allowed tool does not grant business authorization.

## Backend evidence

Current project configuration defines `numlock-explore-free` and `numlock-sol`.
Primary and specialists, including Heavy and Critical, initially select
`9router/numlock-explore-free`. `9router/numlock-sol` is premium reasoning
authority for intrinsic L4 or evidence-based escalation. This proves configured
selection only, not route contents, provider availability, successful usage, or
future runtime behavior.

Free escalation reasons are `AUTHORITY_CONFLICT`, `ARCHITECTURAL_AMBIGUITY`,
`REASONING_INSUFFICIENCY`, `CROSS_SUBSYSTEM_CONTRADICTION`,
`NOVEL_RECOVERY_REQUIRED`, `VALIDATION_CONTRADICTION`, and
`OWNER_PREMIUM_REQUEST`. Send smallest sufficient context. Sol returns a concise
resolution/execution contract; deterministic work returns to Free.

Authentication, permission, capability, network, human-gate, and mutation-budget
failures return their precise `BLOCKED_*` state, never Sol. One primary Free
attempt plus at most one predefined materially different recovery is allowed;
no loops or autonomous mutation retries.

`@ai-sdk/openai-compatible` implements a compatible HTTP protocol. It does not install an OpenAI agent or establish that requests go to OpenAI. Do not switch providers or add an external premium backend silently. Missing premium route after valid Sol selection => PREMIUM_BACKEND_REQUIRED. Routing levels do not certify model quality or sufficient reasoning capability; validation and scope checks remain mandatory.

## Audit findings corrected

The former Phase 1 HEAVY/CRITICAL rules could only collect context and returned PREMIUM_BACKEND_REQUIRED. No automatic premium handoff existed in the effective project configuration. Prior task classification alone does not prove which agent executed it or that those restrictions were followed. The old configuration loaded all seven NUMLOCK agents on the same 9router alias, with no CodeGraph MCP and no permitted CodeGraph shell commands.

This revision enables HEAVY local work, gives CRITICAL a concrete preparation/authorization flow, adds the missing L3/R3 and commit routing, enables read-only CodeGraph commands, removes duplicate classifier config and pins helper-model routing to 9router. No model account, global application installation, 9router combo, production source or business data is changed.

## Verification boundary

Check resolved OpenCode configuration and agent permissions after changes. Read-only CLI smoke checks establish configuration loading and CodeGraph reachability; they do not establish future model compliance, HEAVY implementation quality, or authorized R4 execution. No production proof is part of this cleanup.

References: https://opencode.ai/docs/agents/ ; https://opencode.ai/docs/permissions/ ; https://opencode.ai/docs/rules/
