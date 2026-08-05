---
name: numlock-testing
description: Apply NUMLOCK's authoritative test ownership, deterministic contract, and unified-gate workflow. Use when adding, changing, diagnosing, running, or documenting NUMLOCK tests or suite membership.
---

# NUMLOCK Testing

Treat `AGENTS.md` as the highest-priority repository contract. Read current `docs/TESTING.md` and the relevant test owners before editing:

- `92.Tests.Fixtures.js`: deterministic datasets and expected values.
- `94.Tests.Assertions.js`: reusable assertion helpers.
- `95.Tests.Validators.js`: invariant checks; no runnable entries.
- `96.Tests.Cases.js`: directly runnable test functions.
- `98.Tests.Runner.js`: ordered, fail-fast `runAllBackendTests()`.

## Test workflow

1. Add deterministic expected values independent of the production implementation; do not duplicate a production oracle.
2. Keep reusable helpers in their owner and behavior tests in Cases.
3. Preserve runner order, fail-fast behavior, original error identity, and existing targeted entry points unless the task explicitly changes them.
4. Log one concise PASS summary for important results because Apps Script does not display returned objects automatically. Rethrow original failures.
5. Update suite membership and documented totals exactly. Do not weaken a contract to obtain PASS.
6. Prefer semantic assertions over brittle comments or incidental markup.
7. Run the focused test first, then `runAllBackendTests()`. Distinguish local mocks from Apps Script runtime evidence.

In the final result, state the exact suite total, actual evidence level, and exact live test functions still required.
