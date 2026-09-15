# NUMLOCK Browser Acceptance

Read-only production acceptance tooling for NUMLOCK.

## Executor

OpenCode — sole NUMLOCK execution and coordination application.

## Requirements

- **Chrome** — uses system Chrome via Playwright (`channel: 'chrome'`). No browser binary download.
- **playwright** — devDependency in `package.json`.

## Usage

```bash
node tests/browser/smoke.js <url>
NUMLOCK_SMOKE_URL=<url> node tests/browser/smoke.js
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `NUMLOCK_SMOKE_URL` | (none) | Target URL (CLI arg takes precedence) |
| `NUMLOCK_SMOKE_TIMEOUT` | `30000` | Navigation/ready timeout in ms |

## Exit codes

- `0` — all checks PASS
- `1` — any check FAIL
- `2` — usage error (no URL)

## Safety

- **Read-only** — no form submission, no business record creation/update/delete.
- Finance navigation and filter interaction allowed.
- No write endpoint invocation.

## Output

Structured JSON to stdout with per-check pass/fail and detail.
