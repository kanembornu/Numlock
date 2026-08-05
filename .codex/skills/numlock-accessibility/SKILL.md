---
name: numlock-accessibility
description: Apply NUMLOCK accessibility contracts. Use for document semantics, landmarks, ARIA, keyboard behavior, focus, live regions, reduced motion, tables, charts, or non-color status communication.
---

# NUMLOCK Accessibility

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-frontend` for implementation structure and the relevant feature skill for domain behavior.

## Ownership

- Preserve valid document semantics, landmarks, headings, labels, and table relationships.
- Use ARIA only where native semantics are insufficient; keep expanded, busy, invalid, selected, and hidden states synchronized.
- Support complete keyboard navigation, visible focus, and focus restoration after drawers, dialogs, errors, and updates.
- Exclude hidden content from focus and accessibility navigation.
- Keep live-region announcements bounded, meaningful, and non-duplicative.
- Respect reduced-motion preferences in CSS and Chart.js behavior.
- Provide table and chart semantics and communicate status through text or icons as well as color.

## Non-goals

Do not redesign visual styling, alter business logic, or redefine chart, export, or dashboard ownership.

## Token-saving mode

Inspect only affected interaction paths and semantic contracts. Report keyboard, focus, announcement, and reduced-motion evidence concisely.
