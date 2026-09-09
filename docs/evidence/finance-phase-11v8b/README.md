# Finance Phase 11V.8B — simplified prospective routing authority

This phase implements the user's explicit business authority: prospective Expense creation
allows exactly OSS01, OSK02, OUR01, OUS01, OUS02, OUS03 and OUS04. Every other currently
selectable Expense ID is BLOCKED_FOR_PROSPECTIVE_EXPENSE. No Expense ID maps to InventoryItems.
This supersedes the crosswalk proposal and all-BLOCKED V1 design in Phase 11V.8/11V.8A.

## Approved registry V2

`INVENTORY_EXPENSE_ROUTING` is EXPENSE-ROUTING-V2, revision 2. Its object, rows array and
individual rows are frozen. Approval evidence is the user's Phase 11V.8B instruction;
identity coverage uses the [34-ID source snapshot](../finance-phase-11v8/expense-items.snapshot.json)
inspected against live ExpenseItems in the preceding read-only phase. No new live read or
production mutation was needed in this implementation phase.

| Status | Explicit Expense IDs |
| --- | --- |
| ORDINARY_EXPENSE (7) | OSS01, OSK02, OUR01, OUS01, OUS02, OUS03, OUS04 |
| BLOCKED_FOR_PROSPECTIVE_EXPENSE (27) | OSK01, OSK03, OSK04, OSK05, OSR01, OSR02, OSR03, OSR04, OSR05, OSR06, OSR07, OSR08, OSR09, OSR10, OSR11, OSR12, OSR13, OSR14, OSR15, OSR16, OSR17, OSR18, OSR19, OSR20, OSR21, OUU01, OEE01 |

Registry completeness checks every freshly read active ExpenseItem for one explicit
prospective Expense status. Missing coverage, duplicate IDs/routes and obsolete inventory
classification/crosswalk fields fail closed. Future new IDs need a reviewed registry revision.
Blocked, missing, unknown, malformed and inactive stale-client IDs return REFUSED with
`tabopsWrites=0`. Expense requests cannot enter inventory orchestration.

## Direct InventoryItem contract

The sole public creation dispatcher remains `submitCanonicalTransaction`. Receipt payloads
use only transactionType, requestKey and input. The mandatory `input.ItemID` is an exact
active governed InventoryItems identity. ExpenseID is neither required nor accepted.

```js
{
  transactionType: "INVENTORY_RECEIPT",
  requestKey: "<stable-key-before-first-write>",
  input: {
    ItemID: "<governed InventoryItems.ItemID>",
    ReceiptDate: "<receipt-date>", PurchaseQty: "<observed-quantity>",
    PurchaseUOM: "<governed-UOM>", AcquisitionValue: "<acquisition-cost>",
    SupplierSource: "<supplier/source>", Attested: true,
    ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE"
  }
}
```

Existing evidence, attestation, quantity, cost, package, supplier and date-applicable item/
conversion validation is preserved. No name/category inference, generic Purchase lot,
ExpenseItems data or Expense registry is used by receipt orchestration. Synthetic receipt
fixtures intentionally supply neither expenses nor a registry.

The normalized input binds ItemID and the full receipt payload to the existing stable key,
ReceiptID/LineID/revision and operational SourceID/ID_Movement. Shared-lock ownership,
physical reconciliation, receipt-first recovery, uncertain identities, conflicts, correction
guards and accounting isolation remain intact. Old synthetic crosswalk-bound rows fail
closed on retry; there are no production receipts to migrate, and no historical data is changed.

Activation stays disabled. Its configuration revision is 2; routingVersion now identifies
DIRECT-INVENTORY-ITEM-V1, independent of the prospective Expense registry. Activation evidence
remains null. The production adapter still has no business writer; enabled behavior is tested
only in explicit LOCAL_FIXTURE adapters.

## Selector and historical boundaries

`getTransactionEntryOptions()` returns the existing sales and expenses fields, with expenses
restricted to the seven approved active IDs. Its cache key now includes the new cache format
and Expense registry version, so previous all-ID cache entries are not reused. Save-time
checks still reject stale clients.

The additive `inventoryItems` read model contains only itemId, item and baseUOM from valid,
active, date-applicable InventoryItems. It currently yields 22 identities. Selection does not
imply purchase-package eligibility or posting permission: the submitted receipt date and
conversion authority are revalidated before capture. `routingVersion` and
`inventoryPostingEnabled=false` are included. No frontend redesign or Buy & receive UI
activation is included.

Historical canonical reads continue resolving every ExpenseItem independently of this
prospective registry. No tabops, ExpenseItems, inventory tables, Accounts, Cash or historical
reporting source was modified. COGS remains tabsal.Qty × tabsal.HPP; recipe consumption remains
disabled; InventoryOpenings is neither required nor activated.

## Validation

```sh
node docs/evidence/finance-phase-11v8b/verify-local.cjs --unified
```

The local VM verifier passed:

- 165 orchestration checks: direct ItemID validation, no Expense dependency, locking,
  capture/post recovery, idempotency/conflicts, uncertainty, projection and reversal guards.
- 34 approved-registry dispatcher cases: seven ordinary writes and 27 blocked refusals,
  plus malformed/unknown/inactive/stale-client IDs and forbidden crosswalk classification.
- Seven Expense choices, 22 direct inventory choices, inactive/expired/future/duplicate
  identity checks, and exclusion of old cached legacy Expense choices.
- All 27 blocked historical Expense identities resolve unchanged; synthetic historical
  amounts are preserved exactly and no input/master mutation occurs.
- Receipt foundation 188 scenarios, operational receipts 169 checks, persistence guards,
  transaction entry/lifecycle/history, Finance Core, Inventory conversion/opening and
  static transaction UI regressions.
- Existing unified backend suite 60/60. Runner membership is unchanged.

These are local/static results, not authenticated Apps Script or browser acceptance.
The prior Phase 11V.8 verifier describes the superseded V1 authority; use this verifier for
current-source validation.

## Task-changed files

- `21.Transaction.Entry.js`: prospective Expense selector/dispatcher and direct item read model.
- `45.Inventory.Receipt.Orchestration.js`: immutable V2 registry and direct receipt identity.
- `96.Tests.Inventory.Receipt.Orchestration.Cases.js`: direct-item recovery regression fixtures.
- `96.Tests.Transactions.Cases.js`: explicit synthetic selector authority and versioned cache contract.
- `docs/TESTING.md`: current verifier and supersession note.
- `docs/evidence/finance-phase-11v8b/verify-local.cjs`: focused and unified local verification.
- `docs/evidence/finance-phase-11v8b/README.md`: approved authority, contracts and evidence.

No clasp upload, deployment, Git staging/commit/push or production business write occurred.
Unrelated pre-existing worktree changes are preserved. Recommended Git commands: None.
Next: separately scope the Buy & receive UI and production adapter/runtime acceptance;
production operational activation remains disabled.
