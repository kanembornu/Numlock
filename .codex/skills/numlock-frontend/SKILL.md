---
name: numlock-frontend
description: Apply NUMLOCK's frontend, responsive UX, accessibility, rendering-performance, styling, and dependency safeguards. Use for changes to 190.View.Index.html, generated Tailwind CSS, browser behavior, charts, controls, or frontend contract tests.
---

# NUMLOCK Frontend

Treat `AGENTS.md` as the highest-priority repository contract. Inspect the relevant frontend, tests, and current generated-style ownership before editing.

## Preserve contracts

- Preserve desktop and narrow-width behavior unless explicitly changed.
- Preserve the responsive drawer, keyboard behavior, accessibility, focus visibility, reduced motion, disciplined live regions, dashboard state controller, retry identity, stale-response protection, chart lifecycle, reporting metadata, Data Quality disclosure, and date-filter semantics.
- Cache only stable DOM references. Avoid duplicate listeners and preserve query-budget contracts.
- Never mutate response arrays or objects.
- Never log raw dashboard payloads; retain concise actionable `console.error` diagnostics.
- Keep external dependencies exactly pinned.

## Styling and validation

- Use compiled Tailwind only; never restore the Tailwind CDN.
- Run `npm run build:tailwind` only when Tailwind classes, authored Tailwind input, or the safelist changes. Keep generated `189.View.Tailwind.html` tracked and reviewed.
- Validate extracted frontend JavaScript syntax and relevant accessibility, responsive, state, dependency, chart, and performance contracts.
- Require browser acceptance for visual or interaction changes; never infer it from static checks or upload.
