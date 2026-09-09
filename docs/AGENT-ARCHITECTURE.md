# NUMLOCK agent architecture

Effective local contract: 2026-09-10. OpenCode + 9router is the sole agent execution path.

## Routing

User → OpenCode `numlock` classifier → NUMLOCK specialist → 9router on localhost:20128 → configured OpenCode model route.

| Class | Specialist | Execution |
|---|---|---|
| Read-only | numlock-explore | Inspect and report |
| L1/R1 | numlock-light | Trivial local edit |
| L2/R1-R2 | numlock-medium | Bounded local implementation |
| L3-L4/R1-R3 | numlock-heavy | Local implementation with explicit scope and meaningful validation |
| ANY/R4 | numlock-critical | Prepare locally, then execute only the specifically authorized risky action |
| Explicit local commit | numlock-commit | Exact named paths and message; no push/history rewrite |

R4 overrides complexity. Read-only financial analysis does not itself authorize financial changes. Production authority, deployment, migration, credentials and destructive actions retain their human gate. A valid explicit gate persists within its exact scope and operation count. Preserve uncertainty after a count-limited attempt.

## Configuration ownership

- `AGENTS.md`: authoritative scope, evidence and authorization policy.
- `opencode.json`: only enabled provider is 9router; main/small models both use the existing alias; default agent is numlock; explicitly loads AGENTS.md.
- `.opencode/agents/*.md`: the single project definition of each specialist's prompt and permissions. Avoid duplicating numlock in JSON and Markdown.
- CodeGraph: local structural code tool, available through allowed `codegraph explore` and `codegraph status`; no dependency on an OpenAI agent or MCP host. Source/runtime checks remain necessary for HTML and Apps Script boundaries.
- Generic Node/package commands require permission checks because they can execute arbitrary code. An allowed tool does not grant business authorization.

## Backend evidence

Read-only 9router database inspection on 2026-09-10 found one combo, `numlock-explore-free`, with `oc/mimo-v2.5-free` then `oc/big-pickle`. Local usage history grouped by model contained 1,115 and 7 requests respectively, last seen 2026-09-09 UTC. No provider connection records were present. This verifies the configured routes and recorded provider labels, not the undisclosed model provenance behind an opaque alias such as big-pickle.

`@ai-sdk/openai-compatible` implements a compatible HTTP protocol. It does not install an OpenAI agent or establish that requests go to OpenAI. Do not switch providers or add an external premium backend silently. Missing route => BACKEND_UNAVAILABLE. Routing levels do not certify model quality or sufficient reasoning capability; validation and scope checks remain mandatory.

## Audit findings corrected

The former Phase 1 HEAVY/CRITICAL rules could only collect context and returned PREMIUM_BACKEND_REQUIRED. No automatic premium handoff existed in the effective project configuration. Prior task classification alone does not prove which agent executed it or that those restrictions were followed. The old configuration loaded all seven NUMLOCK agents on the same 9router alias, with no CodeGraph MCP and no permitted CodeGraph shell commands.

This revision enables HEAVY local work, gives CRITICAL a concrete preparation/authorization flow, adds the missing L3/R3 and commit routing, enables read-only CodeGraph commands, removes duplicate classifier config and pins helper-model routing to 9router. No model account, global application installation, 9router combo, production source or business data is changed.

## Codex role

This maintenance was requested in Codex, so Codex is the temporary auditor/editor of this configuration. It is not a runtime dependency of NUMLOCK or a required specialist/backend in the resulting OpenCode architecture. Historical evidence naming Codex remains unchanged to preserve authorship and content hashes.

## Verification boundary

Check resolved OpenCode configuration and agent permissions after changes. Read-only CLI smoke checks establish configuration loading and CodeGraph reachability; they do not establish future model compliance, HEAVY implementation quality, or authorized R4 execution. No production proof is part of this cleanup.

References: https://opencode.ai/docs/agents/ ; https://opencode.ai/docs/permissions/ ; https://opencode.ai/docs/rules/
