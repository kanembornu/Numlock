---
name: numlock-export
description: Preserve NUMLOCK browser Print Report and CSV export contracts. Use for active-filter exports, visible-column projection, CSV safety, filenames, Blob downloads, or A4 print behavior.
---

# NUMLOCK Export

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-frontend` for browser implementation and `$numlock-accessibility` for controls and print semantics.

## Ownership

- Export only the active filter and already visible data boundary; include no hidden fields or expanded history.
- Keep CSV columns in displayed order, encode UTF-8 with BOM, and quote fields correctly.
- Neutralize spreadsheet formula injection while preserving valid negative numeric values.
- Produce deterministic, filter-aware filenames.
- Use the browser Blob/download path only unless backend export is explicitly approved.
- Preserve the A4 print contract and include only the approved report content while excluding controls, navigation, skeletons, disclosures, and hidden pages.

## Non-goals

Do not add backend export, API projections, PDF libraries, or broader transaction history.

## Token-saving mode

Inspect only the export projection, control, print styles, and focused contracts. State exact visible fields and safety transformations without repeating dashboard internals.
