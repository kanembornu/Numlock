# Phase 11V.12D2 — Integrated acceptance closure

PASS for current-source local browser/synthetic runtime acceptance and the existing integrated Transactions gate. Authenticated Apps Script execution remains unverified solely because of the known environment/transport limitation.

## Browser acceptance

Existing harness: docs/evidence/finance-phase-11v12d/browser.cjs. No new verifier script was created. Updated its superseded unsupported-package expectation to D1 authority, added missing Sales and actual reader/detail coverage, and allowed a separate evidence output directory. Two harness setup defects (reopening a closed modal and providing the synthetic Session timezone service) were corrected. No application source was changed.

Command: `NUMLOCK_ACCEPTANCE_OUTPUT=docs/evidence/finance-phase-11v12d2 node docs/evidence/finance-phase-11v12d/browser.cjs`.

Real local Chrome, current assembled HtmlService frontend, and current shared canonical dispatcher with in-memory adapters. All browser requests are intercepted; no production business API is called. External fonts/icon assets are blocked, so blank icon glyphs in captures are a fixture limitation.

56 acceptance checks PASS. Includes Sales, 5 Fixed and 28 Variable options, Salary, Kelontong/Gas, direct-HPP representatives, cost pools, distinct syrup flavors/Repack, unresolved cost-only capture with operator message, duplicate/reopen/reload/conflict/uncertain recovery, 34 historical labels, no operator-facing component/conversion/allocation identities, current reader/search/detail integration and financial exclusion.

Governed package evidence boundary: the unmodified browser form captures an observed governed UOM as a PurchaseEvent; it does not assert package equivalence. A separate synthetic request to the same canonical dispatcher supplies matching package/supplier authority plus explicit purchase evidence, producing exactly one receipt and movement. This is not claimed as an automatic browser conversion or authenticated Apps Script proof.

The actual getTransactionsPeriodRows reader returns parent PurchaseEvents and suppresses their child receipts. Recent search and purchase filtering retain the label; operational detail shows cost and reported quantity with non-financial context. The financial Expense view contains only the three synthetic ordinary Expense rows.

Final in-memory counts: one Sales business row, three tabops business rows, twelve PurchaseEvents, one InventoryReceipt and one operational InventoryLedger movement. Production acceptance writes: zero.

Six screenshots captured; the PurchaseEvent detail screenshot was visually inspected. It shows the Gula label, acquisition cost, reported unsupported package, unverified quantity/package message and financial exclusion without technical identities. No source patch was required.

## Authenticated runtime limitation

Exactly one attempt: `clasp run testExpensePurchasePolicyContracts`.

Result: `Exception: We're sorry, a server error occurred while reading from storage. Error code NOT_FOUND. []`

No startup evidence, retry, transport-driven source edit, push or deployment. Authenticated editor/browser fallback was unavailable in this environment. No claim is made that remote Apps Script contains the current locally reviewed source. Future synchronization or deployment requires explicit authorization; neither was performed implicitly.

## Final gate

After browser acceptance PASS, ran each existing integrated D1 verifier exactly once:

- `node docs/evidence/finance-phase-11v12d1/verify-local.cjs` — PASS: package/read-model integration, six Transactions regressions and 482 dispatcher assertions.
- `node docs/evidence/finance-phase-11v12d1/verify-ui.cjs` — PASS: three Transactions UI contracts, Expense/Sales/historical regressions, syntax and operational history/search/detail assertions.

See integrated-local.log, integrated-ui.log, browser.log and results.json. Application source hashes match the start-of-task snapshot (source-verification.json). Activation remains disabled. No production business rows, accounting/cash writes, clasp push, deployment or Git actions occurred.

Changed only the existing browser evidence harness and this D2 evidence directory. Recommended Git commands: None.

Next: authenticated current-source test-context evidence when transport/editor access is available. Local integrated acceptance is closed; production activation remains disabled.
