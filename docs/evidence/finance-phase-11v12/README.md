# Phase 11V.12A — local policy and PurchaseEvents foundation

Status: PASS for the narrowed foundation scope only. Phase 11V.12 UI integration is deferred.
The original request is preserved in SPEC.md; the subsequent user instruction limits this acceptance to the policy registry and PurchaseEvents foundation.

## Implemented authority

EXPENSE-PURCHASE-POLICY-V1 covers the 34 IDs in the existing local ExpenseItems snapshot: 5 FIXED_COST, 28 VARIABLE_COST, 1 OTHER_HOLD. ExpenseItems.Item is the label authority; each captured event retains that business label. OUU01 is ineligible. The registry and nested mappings are frozen. The effective boundary is 2026-10-01, Asia/Jakarta; production activation is false.

PURCHASE-EVENTS-V1 defines a 25-column append-only schema. It uses injected local runtime read/append/audit functions under the shared lock. There is no production store factory, schema migration or activation. The immutable event records request identity, normalized payload, business label, policy revision, cost, evidence, allocation status, receipt plan and audit metadata. Recovery progress is derived from existing event/receipt/movement records; the event is never updated or deleted by this foundation.

A stable request key binds one normalized business intent. Recovery rereads existing events and reuses a separate deterministic receipt recovery key. Event write uncertainty stops further work. Receipt and movement retries use the existing receipt orchestration under the same lock. Duplicate histories, payload conflicts and mismatched receipt plans refuse further writes. Unknown write counts remain UNKNOWN.

Only an approved DIRECT_HPP_COMPONENT mapping with explicit conversion confirmation and available purchase evidence can carry a receipt plan. Package normalization additionally requires exact package/supplier authority; the existing governed Lemon measured-mass rule is retained. Missing authority preserves cost without a receipt. Pools stay COST_POOL_ALLOCATION_UNDEFINED. Syrup flavor events remain separate; the generic conversion never creates a flavor receipt or pooled unit cost. Repack has no inferred component mapping or package size.

The operational projection is financialTotalsIncluded=false. No tabops, BalanceLedger, cash/AP or recipe-consumption writer exists in this foundation. No opening dependency is introduced.

## Validation

- `node docs/evidence/finance-phase-11v12/verify-local.cjs` — PASS; policy coverage plus 172 orchestration assertions, approved relationships, business labels, hold, cost-only capture and financial exclusion. See focused.log.
- `node --check` — PASS for 46.Expense.Purchase.Policy.js, 47.Purchase.Events.js, 96.Tests.Expense.Purchase.Cases.js, 21.Transaction.Entry.js, 98.Tests.Runner.js and this folder's verify-local.cjs.
- `git diff --check` — PASS.
- The first resumed invocation of the existing verifier also ran its synthetic dispatcher/Sales/history checks successfully. The verifier was then narrowed to foundation-only tests; no broader regression suite or browser test was run.

All evidence is local/synthetic using existing snapshots, not a current production authority read or Apps Script runtime acceptance. No production mutation, clasp push, deployment, staging, commit or push occurred.

## Source boundary

New foundation files: 46.Expense.Purchase.Policy.js, 47.Purchase.Events.js, 96.Tests.Expense.Purchase.Cases.js. Existing work from the initial 11V.12 portion also updated 21.Transaction.Entry.js, .claspignore and 98.Tests.Runner.js; it is retained, not reverted. Evidence files are SPEC.md, README.md, verify-local.cjs and focused.log in this folder.

No Transactions HTML/CSS file was edited during 11V.12 or 11V.12A. The pre-existing 11V.9 UI remains in the worktree and has not been adapted to the new policy options. Do not treat the full Transactions workflow as accepted or ready to upload. Next work is separately authorized Transactions UI integration and its validation.

Recommended Git commands: None. Pre-existing unrelated worktree changes remain present.
