# Phase 11V.12B — Transactions Expense UI integration

PASS for focused local frontend/policy contracts. Browser and Apps Script runtime acceptance were not run.

New Transaction has two choices: Sales and Expense. Expense defaults to Fixed Cost and filters the policy options into 5 Fixed Cost or 28 Variable Cost labels. OUU01 is excluded. Labels come from the existing policy read model's ExpenseItems.Item values. The read model and backend foundation were not edited in this phase.

Fixed costs and the four non-HPP variable costs show ordinary Expense date/item/amount controls. Production-linked variable costs show acquisition cost, supplier, evidence or document-unavailable declaration, attestation, optional actual received quantity/UOM, and receipt date if different. Unknown quantity and UOM can both remain blank. No allocation, component, InventoryItem or conversion selector is present. Pools and syrup flavors retain their own business labels.

Purchase submission uses the existing EXPENSE PurchaseEvents payload with expenseItemId, a stable requestKey and input. The UI does not assert conversion/package authority or infer package normalization; it captures operator observations. Backend receipt evidence requirements remain unchanged. Production activation remains disabled and the UI explains a definitive disabled refusal.

The existing session key preserves request identity and payload across reloads. Uncertain, pending and conflicting outcomes freeze the intent and use the recovery action. Older INVENTORY_RECEIPT requests remain recoverable without restoring a top-level receipt choice. A session-storage failure prevents submission and clears the unsent payload so edited input can be revalidated. Sales submission remains unchanged. Historical detail rendering retains all 34 business labels.

## Validation

Command: `node docs/evidence/finance-phase-11v12b/verify-local.cjs`

PASS:
- Existing transaction entry, lifecycle and visual source contracts (source checks, not visual acceptance).
- Focused policy contract and 5/28 option counts, hold exclusion, all 33 selectable labels.
- VM UI fixtures: conditional fields, quantity validation, purchase payload, double-submit guard, stable request identity, session reload, pending/conflict/disabled outcomes, successful capture, legacy request recovery, storage failure and reset.
- Ordinary Fixed/Variable Expense and unchanged Sales payload regressions.
- All 34 historical Expense labels in detail rendering.
- Parsed assembled frontend and both changed script owners.
- `node --check 96.Tests.Transactions.Cases.js`.
- `git diff --check` and final `git status --short` inspection.

No browser, broad regression/runtime suite, production mutation, clasp push, deployment, staging, commit or push. No CSS changes or Tailwind build were needed.

Changed source files in this phase: 190.View.Index.html, 194.View.Transactions.Forms.html, 195.View.Transactions.Actions.html, 96.Tests.Transactions.Cases.js. Evidence: this README.md, verify-local.cjs and focused.log. All other pre-existing worktree changes were preserved.

Remaining boundary: browser/runtime acceptance and any activation require separate authorization. Recommended Git commands: None.
