---
name: numlock-appscript
description: Preserve NUMLOCK Google Apps Script V8 runtime and flat clasp-source compatibility. Use for server code, HtmlService templates, spreadsheet reads, timezone handling, Apps Script services, or runtime-bound processing.
---

# NUMLOCK Apps Script

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-development` for general implementation safeguards and `$numlock-clasp` for upload concerns.

## Ownership

- Keep production sources compatible with Apps Script V8 and the flat clasp deployment model: no ES modules, `import`, `export`, Node-only APIs, or unsupported server/browser assumptions.
- Preserve global entry points and avoid eager cross-file initialization; load order must not create hidden symbol dependencies.
- Use HtmlService templates and inject only explicitly approved, safely serialized values. Keep server values out of raw executable template contexts.
- Use `SpreadsheetApp`, the Apps Script project or Session timezone, `Utilities`, and `CacheService` according to their platform contracts.
- Read each spreadsheet dataset once per request when practical, process it in one bounded pass, and avoid unbounded service calls or execution-time growth.
- Account for quotas, execution limits, serialization boundaries, and unavailable Node/browser globals.

## Non-goals

Do not own Git, upload or deployment approval, or frontend visual design. Load the owning skill only when those concerns are material.

## Token-saving mode

Inspect only the affected Apps Script boundary. Do not restate platform basics, duplicate project context, or load unrelated skills. Stop when compatibility and task-specific validation are established.
