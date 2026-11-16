# NUMLOCK permission workspace

Root: `/Users/azer/Documents/GitHub/Numlock`. OpenCode 2.3.0, V2 permissions
array. Project policy: `opencode.json`; agent `.opencode/agents/numlock.md`
inherits it (`permissions: []`). Preserve release authorization and Rules 7/8.

Use `tests/tmp/<task>/` for packages, baselines, manifests, screenshots and
journals. Create a new task directory; never overwrite another task's artifacts.
`tests/tmp/` is ignored; already tracked files remain tracked. Explicitly review
any permanent evidence before adding it. Do not put credentials in artifacts.
Do not use `/private/var/folders/.../T/opencode/` for workflow evidence.
Historical @685 retrieval retains its separately authorized isolated
`/tmp/numlock-*` exception; never pull into repository source files.

For tools requiring temporary storage, set TMPDIR/TMP/TEMP only for the command
to an existing directory beneath that task workspace. Do not change Mac-wide
settings. Browser execution requires system Chrome, ephemeral context, explicit
local validation URL, no personal profile; stop at authentication barriers.

External-directory fallback is `ask`, not blanket `deny` or unrestricted allow.
Known executable resources: `/usr/local/bin/*`,
`/usr/local/lib/node_modules/@google/clasp/*`,
`/Applications/Google Chrome.app/*`. File-editing tools deny these same scopes.
Invoke `clasp` through shell; never read/copy executable bytes as a prerequisite.
Credential read/edit denies remain independent. Authorized CLI authentication
uses the CLI's existing configuration, never agent credential inspection.
Unknown shell/interpreter commands still require normal permission approval.
External-directory permission is not process isolation or business authority.

Runtime discovery is explicit-location: `opencode api get
'/api/agent?location%5Bdirectory%5D=%2FUsers%2Fazer%2FDocuments%2FGitHub%2FNumlock'`.
`/api/config` with that same query lists discovery sources low to high priority.
Never print full configuration responses: provider settings can contain secrets.
Global documents precede project documents; later matching rules win within
configured policy. Agent/session overrides, saved decisions and platform policies
must be measured separately. Config watches reload changes; verify the returned
agent policy rather than assuming the active session adopted them.

Preflight: `node scripts/preflight/preflight.js`, then
`python3 scripts/preflight/permission-smoke.py`. Static checks model policy only;
runtime smoke evaluates 13 requests in a fresh empty session, rejects its own
pending asks, archives the session. It grants nothing and executes no commands.
Actual screenshot creation, CLI metadata and file access are separate evidence.
The existing launcher probe now expects external fallback `ask`; its unrelated
mixed user changes remain outside this commit. Do not bypass any launcher hold.

New paths: inspect necessity, canonical destination and side effects; request
normal permission, never save blanket approval. Add only reviewed narrow rules.
If a later platform deny remains, report action/resource and owning source when
known; no alternate shell route to bypass it. Effective runtime observed
`browser: deny` and `skill/browser: deny` after project rules; source identity
not established. External Chrome allow does not override those action denies.
