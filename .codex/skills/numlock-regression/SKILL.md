---
name: numlock-regression
description: Define NUMLOCK cross-feature regression coverage for releases, redesigns, migrations, refactors, and maintenance. Use when changes require a focused-to-unified test plan, browser viewport and theme matrices, navigation and state verification, response-contract checks, or exact evidence classification across local and live environments.
---

# NUMLOCK Regression

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-testing` for test ownership and runner semantics, `$numlock-validation` for execution order and reporting, and feature skills for domain expectations.

## Regression workflow

1. Map changed owners and consumers to the smallest focused contracts.
2. Run or require focused checks before the ordered unified gate.
3. Preserve current runner membership, order, fail-fast behavior, and original error identity unless the task explicitly adds or removes one contract.
4. Expand verification across affected Dashboard, Transactions, Settings, Logs, navigation, states, themes, viewports, charts, print, CSV, drill-down, and response fields.
5. Stop at the first invalidating failure; do not weaken assertions, skip required coverage, upload, or advance to a later evidence level.
6. Report only evidence actually produced.

## Matrix ownership

- Select the cross-feature regression matrix from change impact rather than running unrelated checks by default.
- Cover loading, success, empty, error, retry identity, stale responses, navigation, sidebar/drawer state, tab state, focus-sensitive behavior, and responsive containment when affected.
- Cover `1440×900`, `1280×768`, `768px`, and `375px` when full visual or responsive acceptance is required.
- Cover Light, Dark, and System behavior when theme resolution or themed surfaces are affected.
- Preserve Print Report, visible-row CSV safety/scope, three chart lifecycles and summaries, bounded drill-down, Appearance/About Settings, sanitized session-local Logs, and the public dashboard response contract when their consumers can be affected.

## Evidence classes

Report each class separately: static source review, local checks or mocks, Apps Script live runtime, upload, deployed-browser acceptance, and production health. Never infer a later PASS from an earlier class, and never claim unperformed validation.

## Stop conditions

Stop on syntax failure, focused-test failure, unified-gate failure, runner drift, response-contract drift, unexpected clasp inventory, wrong identity or authorization, browser-blocking regression, or missing required acceptance evidence. Upload, deployment, commit, and push remain separately authorized actions.

## Non-goals

Do not own test implementation, test execution policy, visual design decisions, feature behavior, clasp authorization, deployment, or Git completion.

## Token-saving mode

Select only impacted rows of the regression matrix, reuse the current documented gate, and report exact commands, results, evidence classes, stop conditions, and unverified later stages.
