# Finance Phase 11V.5 — local receipt-first foundation

Local foundation PASS. Production operational activation remains disabled; accounting
posting is always false. The supplied Phase 11V.5 request is the implementation contract
and states Phase 11V.4 is accepted/frozen. No live state was inspected or mutated here.

## Contract and ownership

- `42.Inventory.Receipt.Foundation.js` retains exact31 capture and append-only revision
  history. Capture results now expose separate operational and accounting readiness.
  Legacy `postingAllowed` and historical reason strings remain compatibility fields;
  neither authorizes the operational executor. Operational reasons have no opening gate.
- `44.Inventory.Receipt.Operational.js` owns the private receipt-derived movement builder,
  receipt authority validation, tracked-receipt read model, and injected local executor.
  No production adapter or public Apps Script entry point exists. An adapter must provide
  `environment: LOCAL_FIXTURE`, `activation`, the same ScriptLock as capture, a fresh
  `read()` returning `{receipts, ledger, items}`, and `appendMovement(row)` which appends
  exactly one exact23 record. This phase exercises memory adapters only.
- Activation requires explicit `enabled: true`, `effectiveFrom >= 2026-10-01`, and
  `timezone: Asia/Jakarta`. Date alone does not enable posting. Production is refused
  regardless of fixture activation settings. Missing/invalid authority fails closed.
- Latest active READY receipt revision, attestation payload/actor/time/statement,
  normalized capture payload, and every derived receipt field must agree. The stored
  conversion snapshot is validated under its historical effective authority and reused;
  a current conversion lookup cannot reinterpret the receipt. Zero-cost exceptions block.
- Source identity is JSON `[ReceiptID, LineID, Revision]`; movement identity is deterministically
  derived from it. The exact23 `Keterangan` stores the conversion snapshot, exact unit-cost
  ratio, and `AccountingStatus: NOT_POSTED`. AccountingJournalID remains blank.
- `39.Balance.Foundation.js` permits that blank/null journal only with explicit receipt
  evidence context and an exact matching movement. All other movement validation remains
  strict. Its existing MWA builder refuses operational receipt rows to prevent remaining
  inventory/control-account valuation claims. CodeGraph found only test callers for that
  builder and control reconciliation; Finance reporting has no receipt-ledger consumer.
- Posting fresh-reads after acquiring the shared lock. Exact retries return EXISTING with
  zero writes; conflicting or inactive prior effects require correction. After uncertain
  writes, fresh-read exact effects return RECOVERED_EXISTING, absence returns RETRY_REQUIRED,
  conflicts return CONFLICT, and unavailable recovery reads return WRITE_UNCERTAIN with
  unknown write count. No automatic second append occurs. A caller retries the same source
  request; deterministic identity and a fresh state read remain mandatory.
- Capture CORRECT/CANCEL now reads InventoryLedger under its existing lock and refuses
  any matching operational source with OPERATIONAL_REVERSAL_OR_CORRECTION_REQUIRED.
  Malformed ledger schema/formulas/source identity fail closed. Reversal is not implemented.

## Reporting semantics

State derives solely from validated active operational receipts, independently per item
and MAIN. No movement means UNTRACKED with null quantity/value/cost; this does not assert
physical zero. First receipt starts TRACKING_STARTED without OPENING_IN. TrackingSince
is the earliest included receipt movement's date at Jakarta midnight. Subsequent inbound
receipts add exact decimal quantity and safe integer Rupiah acquisition value. The average
is returned as a reduced rational string, for example `18001/18`, avoiding cost rounding.

The read model exposes TrackingState, TrackingSince, CumulativeTrackedReceiptsQty,
TrackedReceiptAcquisitionValue, and AverageTrackedReceiptCost. Its meaning is **Average
Tracked Receipt Cost**. It exposes no StockOnHand, AvailableStock, LowStock, or physical
inventory valuation. Mixed accounting/outbound ledger history is refused by this foundation;
future outflows and optional opening integration require their own authority.

The existing exclusive receipt-route guard rejects tabops as a second or alternative
inventory purchase destination and remains disconnected from transaction entry. Existing
COGS remains tabsal.Qty × tabsal.HPP. Operational value is not Account1100 balance.
InventoryOpenings validation, conversions, accounts, P&L, and recipe consumption are unchanged.

## Validation

`node docs/evidence/finance-phase-11v5/verify-local.cjs`

Passed: 169 operational checks, 188 existing receipt scenarios, first-receipt integration,
inventory foundation, schema migration, conversion authority (including its nested Lemon
and operator tests), opening staging, receipt migration, and synthetic receipt persistence.
The verifier checks exact31/exact23, frozen 22-authority preservation, private entry points,
absence of production service factories, default production refusal, and upload exclusion.
The new fixture-requiring suite is local-only and does not change unified runner membership.

The unified local suite was attempted but stopped because PropertiesService is not defined
in this VM. `--unified` requests that broader gate and propagates failures. No unified PASS,
Apps Script runtime PASS, or browser PASS is claimed. JavaScript syntax and git diff checks
passed. `clasp status` confirmed both new numbered files are excluded; no upload occurred.

All task writes were local files or in-memory fixtures. Production InventoryReceipts,
InventoryLedger, InventoryOpenings, BalanceLedger, accounts, tabsal, and conversion writes
were zero. Production businessRows0 and other accepted live-state invariants were preserved
by non-access, not freshly verified. No deployment, Git staging, commit, or push. Git
recommendation: None; the worktree contains pre-existing Finance changes.

Next: separately scoped production adapter/recovery and disposable Apps Script runtime
proof before any activation decision. Production and accounting activation remain disabled.
