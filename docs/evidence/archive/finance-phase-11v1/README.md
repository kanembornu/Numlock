# Finance Phase 11V.1 — Pending Receipt Capture Foundation

PASS — local implementation and focused fixture validation only. The accepted
Phase 11V design in the task request is the contract for this implementation.
No production schema migration, receipt rows, upload, deployment, or Git action
was executed. Existing worktree changes remain outside this task.

## Storage and schema

`InventoryReceipts` is a dedicated append-only capture authority. It is not stock,
valuation-ledger, accounting, expense, or cash authority. One normal Buy & receive
action captures one item line. No procurement header, supplier master, or purchase
order subsystem is introduced.

The exact 31-column order is owned by
[`INVENTORY_RECEIPT_POLICY.HEADERS`](../../../42.Inventory.Receipt.Foundation.js):

```text
ReceiptID, LineID, Revision, ReceiptDate, ItemID, Location,
PurchaseQty, PurchaseUOM, ConversionID, ConversionNumerator,
ConversionDenominator, ConversionSnapshot, BaseUOM, BaseQtyReceived,
AcquisitionValue, UnitCostRatio, SupplierSource, EvidenceRef, ExternalRef,
Attestation, ZeroCostClassification, Status, ReadinessReason, IdempotencyKey,
NormalizedPayload, ChangeReason, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy, IsActive
```

Additional fields beyond the requested minimum have specific purposes:
`Revision` and `ChangeReason` retain correction/cancellation history;
`NormalizedPayload` preserves the exact idempotency binding;
`ConversionSnapshot` preserves the whole authority and applied normalization;
`Attestation` stores the immutable signed-off payload, actor and timestamp;
`ZeroCostClassification` identifies the exceptional cost case (its evidence is
also retained in the payload); `UnitCostRatio` preserves exact unit-cost precision.

A logical receipt line is the latest revision for its immutable LineID. Earlier
rows are immutable history, not additional receipts. Consumers must never sum all
revision rows or interpret any receipt row as posted stock. History validation
refuses duplicate keys, revision gaps, identity collisions, invalid lifecycle,
and broken creation audit. External/manual edits are outside the writer contract;
future deployment must restrict direct editing and provide trusted actor, clock,
UUID, lock, spreadsheet, and authority readers. A document reference or UUID alone
is not an attestation.

## Inputs and derivation

Normal inputs remain receipt date, ItemID, received purchase quantity, selected
purchase UOM/package, total acquisition cost and supplier/source. The operator
also explicitly confirms the received-goods attestation and either supplies an
external reference or selects `EXTERNAL_DOCUMENT_UNAVAILABLE`. `AVAILABLE` requires
an external reference. No external document is fabricated.

The system derives MAIN location, stable receipt/line IDs, revision, conversion
identity and snapshot, BaseUOM, exact received base quantity, unit-cost ratio,
internal attestation reference, lifecycle/readiness, and trusted audit fields.
A future client must retain its operation idempotency key across retries; it
cannot generate a new key on each submit attempt. No client UI is activated here.

Quantities are strictly positive plain decimal strings, at most six significant
fractional places; insignificant trailing zeros normalize away. Exponent notation,
booleans, negatives, zero, unsafe integer arithmetic and nonrepresentable base
quantities are refused. UOM is trimmed/lowercased; names are not guessed or
pluralized. Base quantities must remain exactly representable at six places.
Dates use exact valid YYYY-MM-DD. Item activity and effective-date coverage are
checked independently of the active, approved, date-applicable conversion gate.

Governed package examples from the frozen baseline are UHT ING-009: one carton =
12000 ml; Bean Robusta ING-006: one bag = 1000 gr; Cup ING-032: one pack = 25 pcs.
Generic Purchase lot is refused. Selected package identity and SupplierRef, when
supplied, must exactly match the authority. The entire governed identity is always
snapshotted. `SupplierSource` remains reusable free text; it is not a replacement
for the governed package's SupplierRef. An ordinary package selection attests the
selected governed package, not an arbitrary package with the same informal name.

Direct gr→gr, ml→ml, pcs→pcs and kg→gr require the same ItemID/date/conversion
authority. Direct metric normalization is explicitly identified in the snapshot,
with its applied ratio; it does not pretend the package ratio was applied.
Lemon ING-018 accepts measured gr or kg only, using the approved 24/1000 gr-to-slice
standard. Thus 500 gr and 0.5 kg each yield exactly 12 slice. Arbitrary bags and
direct slice receipts are refused. The original management-standard provenance
and limitations remain in the snapshot. No physical observation is inferred from
that conversion. Before 2026-10-01 the Lemon conversion is unavailable.

Missing conversion can produce a PENDING capture with empty derived quantity and
snapshot. Missing/inactive/out-of-date item authority is refused. Conflicting
conversion authority is PENDING with NEEDS_CONVERSION and CONFLICT. Correction
must resolve these conditions before capture readiness.

## Cost, evidence, readiness and lifecycle

AcquisitionValue is a non-negative safe integer Rupiah amount. Ordinary capture
readiness requires a positive amount. Missing cost stays PENDING. Zero requires
explicit exceptional classification and evidence and always stays PENDING.
No HPP, recipe, ingredient cost, or historical expense is read to supply this cost.

UnitCostRatio is the reduced exact rational `AcquisitionValue / BaseQtyReceived`;
10001 Rupiah / 12 slice is stored as `10001/12`. It is not prematurely rounded to a
10-place decimal. It preserves the acquisition total for the existing eventual
integer-Rupiah/half-up valuation boundary. A future posting adapter must explicitly
reconcile that contract; this phase performs no MWA or ledger valuation.

Attestation version RECEIVED_GOODS_V1 explicitly covers actual goods received,
item, quantity, package/UOM, date, cost and source. It stores the complete normalized
payload, trusted actor and timestamp in the same append as the receipt revision.
`ATTEST:<LineID>:R<revision>` refers to that retained record. Without attestation,
EvidenceRef is empty and capture remains PENDING, even if an invoice is supplied.
Correction requires a new attestation for the complete replacement payload.

DRAFT is explicitly requested. Otherwise lifecycle derives PENDING or READY from
capture requirements. READY means **capture-ready only**. Every result retains
`postingAllowed=false` and NEEDS_OPENING, NEEDS_ACCOUNTING, ACTIVATION_PENDING.
No opening value, including zero, is inferred. Capture does not read openings or
claim they have been resolved. PENDING distinguishes NEEDS_CONVERSION, NEEDS_COST,
NEEDS_EVIDENCE and CONFLICT in deterministic order, followed by the posting blockers.

POSTED and REVERSED cannot be requested. Existing rows marked POSTED/REVERSED are
immutable. Conflicting retries return CONFLICT without overwriting the accepted
receipt or appending another line.

## Retry, correction and cancellation

An operation key binds to canonical action, target, expected revision, reason and
normalized complete input. Same key/same payload returns the original accepted
revision plus its current revision, with zero writes and no new UUID or conversion
lookup. Same key/different payload returns CONFLICT with zero writes. Current
cancellation governs captureReady even when retrying an earlier operation.

CORRECT is allowed only for active DRAFT/PENDING lines and requires expectedRevision
and a nonempty reason. It may change only the documented input fields: date, item,
quantity, UOM/package selection, acquisition cost, source, external evidence status
and reference, exceptional cost classification/evidence, attestation and draft
intent. Every correction revalidates authority and regenerates all derived fields;
IDs and original creation audit remain unchanged. READY corrections are refused;
a READY capture can be cancelled and separately recaptured if necessary.

CANCEL appends an inactive revision, retains its prior lifecycle/evidence/conversion,
and requires a reason and expectedRevision. It creates no reversal movement and
cannot be reactivated or corrected. The reason, actor, timestamp and operation key
constitute the cancellation audit.

The writer holds the injected lock across reads and append, rereads immediately
before writing, checks the exact schema and absence of formulas, sets the target
row's format to text to preserve decimal/date strings, then writes one complete
revision and verifies readback. Ordinary successful capture reports two mutation
calls (format plus one setValues); retries report zero. The fixture records every
write and refuses access to any sheet other than InventoryReceipts. Formula-like
cell text and oversized cells are refused. A failed/uncertain append returns
WRITE_UNCERTAIN: retry the same key, never compensate by deleting rows or issuing
a new key. Format-only failure leaves no business revision.

## Guarded future migration

`migrateInventoryReceiptSchema_` uses only an injected spreadsheet and lock. There
is no production factory, public RPC, executable migration wrapper or UI route.
Absent storage is created, widened to 31 columns, and receives the exact header.
Header-only exact storage returns ALREADY_MIGRATED with zero writes. Business rows,
schema drift, formulas and unowned empty sheets are refused without writes.

Failures preserve an uncertainty result and, when creation returned successfully,
the exact newly created sheet ID. Forward recovery requires that owned ID and an
empty sheet; a completed header is recognized idempotently. Recovery never deletes
or clears data. Partial/drifted headers refuse. If sheet creation itself has an
uncertain outcome before returning its ID, ownership cannot be inferred: manual
read-only investigation is required. No production recovery was attempted.

## Opening gap and smallest later remediation

The current scope is frozen in
[41.Inventory.Opening.Staging.js](../../../41.Inventory.Opening.Staging.js):
PROHIBITED_ITEM_ID=ING-018, a 21-item ELIGIBLE_ITEM_IDS list,
INVENTORY_OPENING_REVIEW_POLICY.EXPECTED_COUNT=21, explicit Lemon/ineligible refusal,
and hard-coded 21-candidate completion/proof expectations. The
[Phase 11R intake](../finance-phase-11r/README.md) was built for those 21 scopes;
its Lemon whole-fruit memo never maps to InventoryOpenings. The later
[Phase 11U closure](../finance-phase-11u2e/README.md) records 22 active conversion
authorities but leaves opening coverage unchanged. This is a retained opening
scope exclusion, not a current lack of Lemon conversion authority.

A later separately authorized remediation should:

1. Version the opening scope/intake package for all 22 active authorized items at
   MAIN; remove the ING-018 prohibition and replace every 21-only completion,
   review, proof and fixture expectation consistently. Retain the 27-column schema.
2. Add Lemon BaseUOM=slice and the exact approved conversion reference to the
   intake/mapping. Collect independently observed cutover quantity, valuation and
   economic-origin evidence; document measured-mass-to-slice basis if used. A
   conversion is not opening observation or credit-side accounting evidence.
3. Revalidate all 22 scopes, active date authority, immutable batch/version and
   evidence bindings, duplicate/missing rows, exact reconciliation and recoverability.
   Keep missing values unresolved, not zero. Preserve Account 3200 and do not invent
   Account 3210 or another balancing credit.
4. Obtain separate authorization for any production population after local and
   appropriate disposable runtime proof. This receipt phase changes none of those
   contracts and supplies no opening business rows.

## Routing, preservation and validation

`guardInventoryReceiptRoute_` is a prospective pure guard: only the sole destination
InventoryReceipts passes for INVENTORY_RECEIPT intent. Dual routing to tabops or a
ledger fails. It is not connected to existing transaction entry. tabops and
Finance's tabsal.HPP authority remain unchanged; recipe auto-consumption remains
disabled. InventoryLedger writes=0, BalanceLedger writes=0, Account1100 mutation=false,
MWA mutation=false. No production surface was read or written in this task.

Changed files are the new foundation, the new
[receipt cases](../../../96.Tests.Inventory.Receipt.Cases.js), this README and the
[local verification harness](verify-local.cjs). Existing .claspignore and unified
runner edits belong to earlier work. New receipt files intentionally remain
excluded by .claspignore, verified using `clasp status`. The new suite takes the
frozen local authority fixture and is not added to the live unified runner in this
local-only phase.

Executed local validation:

- `node --check 42.Inventory.Receipt.Foundation.js`
- `node --check 96.Tests.Inventory.Receipt.Cases.js`
- `node --check docs/evidence/finance-phase-11v1/verify-local.cjs`
- `node docs/evidence/finance-phase-11v1/verify-local.cjs`: PASS, 188 receipt scenarios;
  seven existing suites PASS: inventory foundation, schema migration, conversion
  authority, operator attestation, opening staging, Lemon operational standard,
  and Lemon production flow (all local fixtures).
- The harness validates the 22 authorities from the saved POST-11U snapshot,
  tests their preservation, and checks disabled recipe consumption, unchanged
  21-item opening scope, absence of live factories, and upload exclusion.
- `clasp status`: local inventory inspected; no upload.
- `git diff --check`, `git status --short`, and local Markdown target checks: PASS.

These are local/static results, not fresh production, Apps Script runtime, browser,
or deployment acceptance. The unified backend suite was not executed under the
requested impact-radius scope. Recommended Git commands: None; no commit/push
is authorized. Next: separately scoped disposable Apps Script persistence proof
and guarded schema activation authorization, followed by capture UI integration;
opening/accounting/posting remain separate gated work.
