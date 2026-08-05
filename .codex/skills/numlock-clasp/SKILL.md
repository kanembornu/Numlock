---
name: numlock-clasp
description: Apply NUMLOCK clasp identity, inventory, and upload safeguards. Use for .claspignore review, clasp status, Apps Script account or project checks, explicitly authorized upload, or clasp runtime limitations.
---

# NUMLOCK Clasp

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-validation` before upload and `$numlock-release` for deployment sequencing.

## Ownership

- Protect `.clasp.json`: never modify it without explicit instruction and never display, copy, or log its script ID.
- Confirm the authorized account and intended script identity without exposing private identifiers.
- Review `clasp status` against the exact `.claspignore` allowlist; `.codex/`, docs, build inputs, packages, and credentials must remain absent.
- Run `clasp push --force` only after all local gates pass, the inventory is exact, and the user explicitly authorizes upload.
- Stop on identity, authorization, inventory, or validation failure.
- Treat upload as source synchronization only, not deployment, Apps Script runtime, or browser evidence.
- Do not assume `clasp run` works unless the intended function is exposed through an API-executable deployment.

## Non-goals

Do not deploy, create Apps Script versions, or own Git commit or push.

## Token-saving mode

Inspect only identity-safe account state, `.claspignore`, inventory, and prerequisite evidence. Report unexpected files and the exact evidence boundary; do not narrate routine clasp output.
