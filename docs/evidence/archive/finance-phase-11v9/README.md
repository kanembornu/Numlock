# Finance Phase 11V.9 — Buy & receive UI integration

The existing New Transaction modal now offers Sales, Expense, and Buy & receive.
This phase is a local implementation and acceptance result. Production operational
posting remains disabled; no upload, deployment, production business write, or Git
staging/commit/push was performed.

## Operator workflow

Buy & receive collects receipt date, governed item, quantity, package/UOM, positive
whole-Rupiah acquisition cost, supplier/source, purchase evidence/reference or an
explicit document-unavailable declaration, and confirmation of what was received.
Internal conversion, ledger, costing-ratio, opening, and accounting fields are not
operator inputs. There is no Expense fallback or second creation endpoint.

The read-only `getInventoryReceiptEntryOptions(receiptDate)` adapter uses the frozen
`buildInventoryPurchaseOptions_` and conversion validator. The snapshot fixture
provides 22 governed items; every offered choice passes frozen receipt derivation.
Choices are item/date scoped. Lemon offers measured gr/kg only, without arbitrary
bag conversion. New Expense choices remain the seven approved V2 IDs: OSS01,
OSK02, OUR01, OUS01, OUS02, OUS03, OUS04. Historical rendering still resolves all
27 blocked prospective Expense IDs.

Receipt requests submit `INVENTORY_RECEIPT`, a stable request key, and `input.ItemID`
through `submitCanonicalTransaction`. Incompatible mode state is cleared. An
in-flight or unresolved purchase cannot be replaced by switching modes or resetting
the dialog. A frozen payload and key are saved in tab session storage before the
RPC; a real page reload restores them. Recovery reuses that payload and canonical
path. Definitive zero-write refusal permits editing; prior uncertainty is not
cleared by a later disabled response. Success allows a new purchase.

Disabled production displays “Inventory purchase tracking is not active yet.”
Uncertain, captured/pending, and conflict responses retain identity and expose the
check action. Field-level feedback covers date, item, quantity, unit/package,
cost, supplier, evidence, and attestation.

## Receipt history and reporting

Transactions queries read receipt rows separately from canonical Sales/Expense
sources. The typed `InventoryReceipt` projection appears as Buy & receive in list
and operational detail, with no correction/void actions. Search, pagination, and
CSV projection retain its own type. Receipts are excluded from Sales/Expense tabs
and financial totals; no receipt is fed to the Aggregate Engine or Finance source.
Receipt detail shows purchase quantity/unit, acquisition cost, supplier and evidence.
A captured receipt is not represented as verified operational posting, physical
stock, or an accounting inventory balance.

## Validation and evidence

Commands executed locally:

```sh
node docs/evidence/finance-phase-11v9/verify-local.cjs
node docs/evidence/finance-phase-11v8b/verify-local.cjs
node docs/evidence/finance-phase-11v8b/verify-local.cjs --unified
npm run build:tailwind
node --check docs/evidence/finance-phase-11v9/verify-local.cjs
git diff --check
git status --short
```

The final closure sequence ran the unified backend gate exactly once after the
browser and focused regressions. Earlier implementation/debugging runs are not
represented as this final gate. The final result and source hashes are recorded in
[validation.json](validation.json); logs are [browser.log](browser.log),
[focused.log](focused.log), and [backend.log](backend.log).

- Local Chrome with mocked Apps Script RPC: three modes, seven Expense choices,
  22 items and all item-specific menus, Lemon gr/kg, validation, both evidence paths,
  attestation, double-submit protection, canonical payload, close/reopen and real
  reload recovery, disabled/uncertain/captured/conflict/success states, recovery
  visibility, all 27 historical blocked Expense labels, typed receipt list/detail,
  and unchanged Sales/Expense submission payloads.
- Frozen backend fixture regressions: 165 orchestration checks, 188 receipt
  foundation scenarios, 169 operational checks; actual public dispatcher against
  synthetic Sheets; approved Expense routing, historical display, Sales HPP,
  lifecycle, conversion, opening, migration, and Finance Core contracts.
- Ordered unified backend suite: 60/60 local VM entries. Membership and query
  ceilings are unchanged; no tests were skipped or thresholds weakened.
- Syntax: seven changed JS/HTML sources and four assembled script blocks parsed;
  the local verifier parsed separately. Evidence JSON, local Markdown links, and
  source SHA-256 fingerprints were checked. Tailwind compilation passed; its
  existing Browserslist age notice did not prevent the build.
- Screenshot review: [desktop, 1440 × 1000](desktop-receipt.png) and
  [narrow modal, 390 × 844](narrow-receipt.png). The receipt grid is compact on
  desktop, narrows to one scrolling column, and the recovery button is hidden after
  definitive refusal. No additional layout patch was needed during closure.

## Evidence limits and preservation

Browser RPC and Google services are synthetic; all browser network requests are
intercepted. External font/icon assets are intentionally unavailable in screenshots.
This proves local browser behavior, not authenticated Apps Script runtime or deployed
browser acceptance. Recovery storage lasts for the tab session; cross-device or
closed-tab recovery is not claimed. Zero-cost exception entry is not part of this
compact positive-cost workflow. The history read model reports capture and requires
verification before claiming operational posting.

Production InventoryReceipts business writes=0, InventoryLedger movements=0,
BalanceLedger writes=0, Account1100 mutation=false, Cash mutation=false for this
work: no production business-data service was invoked. These are execution-scope
facts, not a newly captured before/after production snapshot. Operational activation
remains disabled and accountingPostingAllowed=false. There is no opening or
stock-opname dependency; tabsal.Qty × tabsal.HPP remains COGS authority and recipe
consumption remains disabled. Dashboard remains frozen; Mobile Finance remains HOLD.

## Phase-owned files

- `190.View.Index.html`: third choice, receipt controls and shared cached references.
- `194.View.Transactions.Forms.html`: item/date choices, mode clearing, validation,
  evidence state and reload restoration.
- `195.View.Transactions.Actions.html`: stable canonical receipt submission,
  deterministic responses/recovery and operational detail.
- `192.View.Transactions.State.html`: typed receipt search and detail prefetch isolation.
- `193.View.Transactions.Render.html`: receipt list labels, quantities and actions.
- `91.Transactions.Query.js`: read-only choices and typed receipt query/CSV projection.
- `assets/tailwind.input.css`, `189.View.Tailwind.html`: receipt-specific styling
  and its generated output.
- `96.Tests.Transactions.Cases.js`, `96.Tests.Frontend.Cases.js`: targeted search/CSV
  source assertions for additive receipt fields. Earlier routing/runner edits in
  these files predate this phase and were preserved.
- This evidence directory: local verifier, screenshots, result manifest and logs.

Unrelated pre-existing Finance worktree changes were preserved. Recommended Git
commands: None. No stage, commit, push, upload, deployment or activation is authorized
by this closure. A later authenticated runtime/upload phase requires separate scope.
