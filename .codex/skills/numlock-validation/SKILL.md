---
name: numlock-validation
description: Run and report NUMLOCK validation gates and evidence boundaries. Use for syntax, JSON or JSONC, Markdown links, focused and unified tests, diff checks, status checks, or validation planning.
---

# NUMLOCK Validation

Treat `AGENTS.md` as the highest-priority repository contract. Use `$numlock-testing` to define test ownership, fixtures, suite membership, and runner semantics.

## Authoritative sequence

1. Run the narrowest relevant syntax or static check.
2. Parse changed JSON or JSONC and check changed Markdown links when applicable.
3. Run the focused test before the ordered unified suite.
4. Run `git diff --check` and `git status --short`.
5. Stop before any upload if a required local gate fails.

Classify evidence exactly as local/static, Apps Script live runtime, or deployed-browser acceptance. Upload is a separate evidence class owned by `$numlock-clasp`. Never infer or claim a check that did not run; report it as unverified or blocked with the reason.

## Non-goals

Do not redefine test ownership or runner composition, approve clasp upload, or perform deployment.

## Token-saving mode

Run only checks material to changed files plus required repository gates. Report command, result, and evidence level without narrating routine output; stop at the first gate that makes later work invalid.
