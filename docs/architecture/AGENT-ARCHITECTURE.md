# NUMLOCK single-agent architecture

The sole project agent is `numlock`. OpenCode + 9router remains the execution
path; the provider URL, model catalogue, default model and helper model are unchanged.

`AGENTS.md` owns scope, business authorization, operation counts, recovery and
measured evidence. `opencode.json` owns the shared ordered permission rules.
`.opencode/agents/numlock.md` owns the executor prompt, with no policy overrides.
There are no project subagents or delegation. Built-in OpenCode agents can remain
in the runtime catalogue; they are not project agents and subagent invocation is denied.

The executor covers audit, local implementation, tests, browser acceptance,
reasoning and exact-authorized Git/critical/ops work. L1-L4 and R1-R4 remain
independent classifications. A role, model, shell approval or diagnostic name
never supplies business authorization.

## Permission migration

Local editing is allowed, with credential/association edits denied. Sensitive
read denials remain after broad read rules. Unknown shell/interpreter/package
commands require ask. No unrestricted shell or auto-approval is enabled.
Production-impacting clasp commands, run and pull require ask. Read-only
status/versions/deployments/logs are allowed by policy, subject to task scope.
All former clasp command capabilities remain expressible through the executor;
former role-specific effects are deliberately replaced by an explicit human gate,
not silently preserved as automatic execution. Six Heavy diagnostics and the
bounded historical @685 forensic workflow remain available with the same task,
destination, side-effect, external-directory and production authorization checks.
The @685 capability is historical; this task's production baseline is v749.

`scripts/preflight.js` checks exact project registry and policy. Its negative
tests reject broadened shell access, secret exposure and reintroduced agents.
`scripts/numlock-opencode.py` derives its project directory, validates the loaded
agent and session identity, and probes permissions without executing commands or
granting pending approvals. It fails closed before any model prompt.
`scripts/opencode-session-shell.mjs` retains its closed operational command registry
and now targets `numlock`; it does not authorize running those commands.

Historical evidence documents and recovery snapshots are retained unchanged.
Retired agent definitions are archived outside the active discovery directory
before any activation. Restore the complete reviewed configuration package to
roll back the local migration; never invoke clasp as part of config recovery.

## Evidence limits

Static policy tests are not runtime permission proof. OpenCode resolved rules,
permission probes, model execution, native shell and browser acceptance are
separate measured gates. Pattern rules are not an OS sandbox. There is no
production mutation authorization in this migration or dashboard task.
