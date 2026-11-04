# Verified OpenCode startup

Use `python3 scripts/numlock-opencode.py --check-only` for readiness, then omit
`--check-only` to start the explicitly project-bound session. The launcher derives
the checkout path, uses the pinned OpenCode V2 binary, checks exactly one NUMLOCK
agent, and probes 16 permission decisions without executing any clasp/Git command.
Pending audit asks are interrupted without approval. Failure exits 78 before
model execution. Readiness does not prove model availability or process isolation.

Use `--server <local-url>` when an explicit server is required. Server connection
authentication is runtime-specific; do not print or embed user credentials.
A cold asynchronous catalogue may be incomplete: fail closed and wait for normal
registration before a new manual readiness check. Never change global services,
ports or permissions merely to pass readiness.
