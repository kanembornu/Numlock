# Verified OpenCode startup

Use `python3 scripts/numlock-opencode.py --check-only` for readiness, then omit
`--check-only` to start the explicitly project-bound session. The launcher derives
the checkout path, uses the pinned OpenCode V2 binary, checks exactly one NUMLOCK
agent, and probes 16 permission decisions without executing any clasp/Git command.
Pending audit asks are rejected without approval. Failure exits 78 before
model execution. Readiness does not prove model availability or process isolation.

Use `--server <local-url>` when an explicit server is required. Server connection
authentication is runtime-specific; do not print or embed user credentials.
A cold server can briefly return a catalogue without project agents. The
launcher rechecks a valid catalogue for this checkout up to five times when no
NUMLOCK agent is present. It holds startup if the agent stays absent or a
registry, agent configuration, or permission check fails.
