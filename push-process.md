# Numlock Push Process

Use [Deployment](docs/DEPLOYMENT.md) and [Release](docs/RELEASE.md) as the owning runbooks. This page is a short pointer, not independent authorization.

The supported CLI is Google `@google/clasp`. The existing `.clasp.json` is tracked; do not display its script ID, change the binding, or rewrite Git history during cleanup.

Local PurchaseEvent checks: `node _test_runner.js` (five synthetic contract groups). There is no `npm test` script. Existing local integrated verifiers live under `docs/evidence`; their private snapshots must be available. Local results are separate from authenticated Apps Script tests and production acceptance.

Before any explicitly authorized upload, prepare the exact clean deployment workspace and inspect its actual `clasp status` upload manifest, all required runtime/test files and exclusions. Review the full file count, not just changed files. `clasp push` replaces mutable source; it is not an immutable deployment. Never upload or deploy from this guide alone.

The legacy `_preflight_commands.sh` was archived byte-for-byte at `.local/maintenance/2026-09-10/_preflight_commands.sh`. It manually handled credentials and is not the active runbook; do not execute it automatically. Use the owning runbook's supported identity check instead.
