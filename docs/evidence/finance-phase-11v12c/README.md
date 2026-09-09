# Phase 11V.12C — Expense submission and purchase orchestration

PASS for local synthetic submission/orchestration and relevant transaction regressions. Production activation remains disabled.

## Submission boundary

`submitCanonicalTransaction(payload)` remains the public creation dispatcher. It constructs a production runtime and delegates to private `submitCanonicalTransactionWithRuntime_`. An extra client argument cannot inject a runtime. Only the private path can receive a local fixture purchase adapter; a production runtime cannot use that adapter.

The shared dispatcher reads ExpenseItems under the same lock used by the purchase event and downstream receipt/movement path. Routing and business labels come from the server policy and master, not the client. Fixed Cost and the four non-HPP Variable Cost items use the existing canonical tabops writer and audit writer. Purchase-linked items use PurchaseEvents with tabopsWrites=0. The purchase path does not require an Accounts read. OUU01 refuses before persistence.

Ordinary Expense rejects fields outside transactionType, expenseItemId, amount and expenseDate. Purchase validation rejects client cost type, relationship, component and label fields. Request keys must be strings matching the existing key format.

The existing PurchaseEvents foundation retains its receipt boundary: approved direct mapping, truthful quantity, explicit conversion evidence confirmation, available purchase evidence and applicable conversion authority. Phase 11V.12B cost-capture payloads do not fabricate that additional authority. They persist an operational purchase event without receipt/movement. Pools retain COST_POOL_ALLOCATION_UNDEFINED; syrup flavors keep independent labels and costs without generic package normalization.

Recovery uses one normalized purchase request and a deterministic downstream receipt key. Same intent retries reuse existing records; changed payloads conflict. An event surviving a lost response or an incomplete receipt/movement is resumed, not duplicated. Completed retries write zero new rows.

## Evidence

`node docs/evidence/finance-phase-11v12c/verify-local.cjs` — PASS:

- 482 shared-dispatcher assertions, including all 34 IDs, exact event/receipt/movement/tabops counts, real Phase 11V.12B payload shape, hold, malformed authority, absent conversion, unknown quantity, isolated syrup costs, retries and partial-write recovery.
- 172 existing purchase orchestration assertions.
- Actual public wrapper with synthetic Google service objects: extra runtime argument ignored; production purchase refused, zero writes.
- Seven relevant regressions: canonical adapter, product pricing, canonical entry, lifecycle, lifecycle transport serialization, historical/overlap controls and Finance core.

The nine ordinary IDs each produce exactly one tabops business row and one existing Logs audit row. Direct evidence-qualified purchase produces one PurchaseEvent, one InventoryReceipt and one operational movement; receipt foundation metadata writes are separate from business-row counts. Pools and unresolved quantities produce one PurchaseEvent, zero receipts, zero movements and zero tabops writes.

`node --check` passed for 21.Transaction.Entry.js, 47.Purchase.Events.js, 96.Tests.Expense.Purchase.Cases.js, 96.Tests.Transactions.Cases.js and verify-local.cjs. `git diff --check` passed; final worktree status inspected.

All tests use synthetic adapters and existing local snapshots. No current production read, business-data mutation, clasp push, deployment, browser acceptance, broad runtime suite, staging, commit or push occurred. Historical read owners, P&L COGS authority (tabsal.Qty × tabsal.HPP), activation constants and Phase 11V.12B UI are unchanged.

## Changed files

- 21.Transaction.Entry.js
- 47.Purchase.Events.js (string request-key validation)
- 96.Tests.Expense.Purchase.Cases.js
- 96.Tests.Transactions.Cases.js (shared-dispatcher source contract)
- docs/evidence/finance-phase-11v12c/README.md
- docs/evidence/finance-phase-11v12c/verify-local.cjs
- docs/evidence/finance-phase-11v12c/focused.log

Other pre-existing worktree changes remain preserved. Recommended Git commands: None.

Next: separately authorized end-to-end/browser acceptance; production purchase activation remains disabled.
