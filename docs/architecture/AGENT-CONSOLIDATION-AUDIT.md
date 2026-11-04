# NUMLOCK agent consolidation audit — 2026-11-02

Scope: current NUMLOCK checkout; production baseline v749 supplied by owner, not independently queried. No deploy, clasp execution, Git mutation or credential inspection is authorized or performed.

## Source and reference closure

Inspected AGENTS.md, opencode.json, all 10 project agent definitions, preflight and its tests, verified-startup launcher, SessionShell adapter, active architecture/startup/isolation docs, package scripts and clasp exclusions. CodeGraph was queried first. A source manifest records 19 audited files; the bounded reference inventory records 138 matching lines in 38 files. node_modules, .git, .codegraph, .tmp, .release, evidence and test-result trees are excluded from active reference scanning. Recovery/evidence material remains historical. There is no .github workflow directory; package.json contains only the Tailwind build script. Config archival documents are excluded from clasp upload by its positive root-file allowlist.

| Former role | Replacement responsibility |
|---|---|
| numlock | Direct executor and final audit |
| numlock-explore | Source/Git audit, isolated forensic comparison |
| numlock-light | Small local edits |
| numlock-medium | Bounded multi-file changes/debugging |
| numlock-heavy | Complex local implementation/tests and six diagnostic capabilities |
| numlock-critical | Exact-authorized risky preparation/execution |
| numlock-ops | Bounded operational execution |
| numlock-commit | Explicit-path, exact-message local commits only when authorized |
| numlock-browser | Ephemeral Chrome acceptance and measured geometry |
| numlock-sol | Reasoning responsibility; no missing premium route dependency |

## Findings before changes

1. OpenCode v2.2.5 accepts the mixed legacy and V2 definitions, but repository preflight only accepts inline JSON permissions. Seven definitions use legacy YAML; three use V2 arrays. This is validator/config drift, not proof that OpenCode rejects every legacy definition.
2. Ten agent definitions exist, while preflight NAMES expects nine and omits Sol. Baseline measured tests: 34 tests, 24 pass, 10 fail; static preflight fails.
3. Primary prompt says read-only/delegate, whereas AGENTS.md says primary executes local development. Its final wildcard shell denial also defeats earlier CodeGraph allows.
4. Seven resolved legacy profiles append broad read allow after shared sensitive-read denies. Their effective rule evaluation allows .env and credential reads. Browser/Critical/Ops retain shared denials. This is a configuration-rule finding, not a claim that a credential was accessed.
5. Critical/Ops append clasp allow patterns after clasp ask. Push/version/deploy/run/pull therefore evaluate allow despite prose requiring explicit business authorization. Their preserved business gates do not equal tool-level asks.
6. Sol requests an unconfigured model. Architecture docs still describe former routing and model availability. Launcher expects identical six shell decisions on all ten agents despite role-specific denials.
7. Runtime-preflight.js is allowlisted but absent. The old rollback baseline 721 and frozen package checksum are stale for this v749 task; task-authorized baseline and reviewed-package identity must govern.
8. SessionShell adapter hardcodes numlock-ops; it must target numlock. Its legacy SDK compatibility remains a separate unexecuted operational integration gate; no operational test command was invoked.

The OpenCode model performed a read-only audit using the authorized 9router route. Its prose contained factual mistakes (including asserting all definitions were legacy and misidentifying Critical/Ops parser failures). The source, resolved runtime catalogue and measured tests take precedence over that prose.

## Consolidation and explicit permission changes

One project agent, numlock, owns the former responsibilities. Keep provider URL, model catalogue, default/small model and instructions unchanged. No project subagent delegation. OpenCode built-ins can remain in the catalogue; they are not NUMLOCK project agents and subagent invocation is denied.

Keep functional clasp capabilities, including Heavy's six named diagnostics and the historical isolated @685 forensic workflow, but deliberately change formerly automatic production-impacting/run/pull decisions to ask. Read-only status/versions/deployments/logs remain allow. Unknown shell/interpreter/package commands remain ask. Local edits are allow; sensitive and association edits are deny. Sensitive reads remain deny because primary has no later broad override. External directories remain deny pending exact separate authorization. No auto-approve, blanket shell allowance or implicit production/Git authority.

This is an intentional, documented permission-effect migration, not a union of automatic rights. Current task authorizes zero deploy/push/commit. The historical @685 capability is retained but is not this task's v749 baseline.

Update AGENTS.md, opencode.json, the primary definition, preflight/tests, launcher/tests, SessionShell role reference and active architecture/startup docs together. Preserve historical evidence wording. Archive all ten original definitions before retiring nine from active discovery. Verify original hashes before applying, and preserve existing Dashboard worktree changes.

## Measured candidate evidence

- Static preflight PASS; Node policy tests 28/28 PASS. Eight redundant per-profile generated cases collapse with the nine-to-one validator registry; two new guardrail cases verify retired-agent rejection and all former diagnostic capabilities.
- Launcher unit tests 6/6 PASS: exact registry, agent/session binding, unexpected write allowance, interruption after failure, and no executable shell/approval calls.
- OpenCode runtime: exactly one NUMLOCK agent; 16 permission probes PASS, including writes ask and sensitive/subagent/external denies. Probe requests are interrupted without approval. No clasp command executes.
- OpenCode model and native shell: preflight PASS and Node policy tests 28/28 PASS inside isolated candidate. No alternate backend used.
- JavaScript and Python syntax checks PASS.

These results establish configuration readiness; they do not prove OS isolation, future model compliance, Apps Script behavior, production state, or operational adapter compatibility.

## Recovery

The original source manifest and archived definitions are retained. Restore the complete original configuration/contract/scripts/docs package together, rather than restoring only agent markdown. This is local configuration recovery; it never calls clasp or mutates production.

Git recommendation: None. No stage/commit/push is authorized.
