# T11.5 U3 — Purchase Single-Commit Core

STATUS: COMPLETE (local acceptance only) · UNIT `T11_5_U3_PURCHASE_SINGLE_COMMIT_CORE`
AUTHORITIES: `AGENTS.md` · `docs/T11-2-SINGLE-COMMIT-TRANSACTION-CONTRACT.md` (§5 §6–8 §11 §17 §19 §20 D1 D2 D4 D8 D9 D11 D15) ·
precedents `docs/T11-3-U1-...`, `docs/T11-4-U2-EXPENSE-SINGLE-COMMIT-CORE.md`
BASELINE COMMIT: `6e39a03` · PRODUCTION: read-only, untouched · CONFIG: untouched (inert until authorized activation)

## 1. Previous Purchase call graph (pre-U3)

Dispatcher (ACTIVE or inert config alike, before U3):

```
submitCanonicalTransactionWithRuntime_ (21:258)
  └─ EXPENSE + purchase-routed item (21:349-366)
      ├─ cashAccountCode gate: must be 1000/1010/1020 else INVALID_CASH_ACCOUNT (21:317-322)
      ├─ purchaseEventProductionRuntime_ / LOCAL_FIXTURE seam (21:351-357)
      ├─ orchestratePurchaseEventUnderLock_ (47:292)
      │    ├─ WRITE #1: append PurchaseEvent row, AccountingStatus=PENDING (47:314)
      │    ├─ readback (47:316)
      │    └─ postPolicyCPurchaseEvent_ (47:322 → 39:309)
      │         ├─ WRITE #2: append ledger pair (47/39 writeLedger)
      │         └─ WRITE #3: update AccountingStatus cell (39:313)
      └─ optional runtime.postPurchaseAccounting (21:360-365) → accountingPending
```

Operational adapter `submitOperationalPurchase` (95A:390) ran the same split under its own lock:
event append → `postPolicyCPurchaseEvent_` → accounting status update.

## 2. Sequential-write hazard

Three separate write units (event → ledger → status cell) under one lock but not one batch:
- Crash after WRITE #1 leaves `AccountingStatus=PENDING` with no journal (multistep recovery,
  `PURCHASE_PENDING`, `WRITE_UNCERTAIN` states).
- Crash between WRITE #2 and WRITE #3 leaves a posted journal with a stale status cell.
- Legacy payment authority split: PAID → Cr cash (1000/1010/1020), UNPAID → Cr2000 AP +
  `SETTLEMENT_PENDING`, so the client-supplied channel could diverge from the journal.
- Each unit is individually read-verified but no atomic cross-surface commit exists; recovery
  must reconcile by re-reading three surfaces.

## 3. Prospective graph (U3, config ACTIVE)

```
submitCanonicalTransactionWithRuntime_ (21:258)
  ├─ expenseSingleCommitGate_ → REFUSE ⇒ zero-write refusal (21:297-298)
  ├─ ACTIVE + purchase-routed item (21:304-311)
  │    └─ purchaseSingleCommitDispatch_ (21:2914)
  │         └─ purchaseSingleCommitSaveWithRuntime_ (21:2840)
  │              ├─ purchaseSingleCommitNormalize_ — strict allowlist (21:1876)
  │              ├─ exact (OperationType, RequestKey) lookup (21:2850)
  │              ├─ resume: verify stored plan + inspect artifacts (21:2513)
  │              └─ new intent (21:2615): gate → schema → 1040 → 6210 → regime →
  │                   item/policy → SupplierID → foreign identity → plan freeze →
  │                   verify → bounds → intent row + exact readback →
  │                   purchaseSingleCommitApplyBatch_ (21:2454):
  │                   ONE batch [PurchaseEvents(1), BalanceLedger(2), Logs(1)] →
  │                   exact inspect → COMMITTED + ten-field readback → DONE
  └─ ABSENT/PREPARED ⇒ legacy path byte-identical (21:315+)
```

Adapter (95A:390-420): gate before any write; ACTIVE → `purchaseOperationalSingleCommit_`
(95A:431) under the call's own single outer lock; legacy modes keep today's writer.

## 4. Files changed

| File | Change |
| --- | --- |
| `21.Transaction.Entry.js` | Dispatcher ACTIVE routing for Purchase (21:304-311); `PURCHASE_SINGLE_COMMIT_V1` core (21:1668-2938): gate 1833, normalize 1876, schema gate 1951, plan 2010, verify 2123, value ranges 2244, batch body 2268, bounds 2288, inspect 2316, commit 2418, applyBatch 2454, resume 2513, newIntent 2615, save core 2840, sheetIds/batch transport 2880/2905, dispatch 2914 |
| `95A.Transaction.Production.js` | `submitOperationalPurchase` gate + ACTIVE branch (95A:390-420); `purchaseOperationalSingleCommit_` (431); `purchaseOperationalCorePayload_` (455) |
| `190.View.Index.html` | Cash-surface wrapper `id="receiptCashAccountField"` (190:3642) |
| `194.View.Transactions.Forms.html` | `purchaseIntentRequestKey_` (56); ACTIVE skips the legacy cash requirement (689-697) |
| `195.View.Transactions.Actions.html` | hide/clear cash surface on ACTIVE (95-108); operational Purchase payload drops `paidVia` on ACTIVE + stable requestKey (387-388); paidVia validation gated (410); receipt payload carries no payment fields on ACTIVE (1104-1109) |
| `96.Tests.SingleCommit.Expense.Cases.js` | U2 A5 re-anchored to the strict-allowlist refusal (`PURCHASE_SINGLE_COMMIT_FIELD_REFUSED`) |
| `96.Tests.Expense.Purchase.Cases.js` | U137/U137b re-anchored: no inline `paymentStatus: "PAID"` on ACTIVE; gated legacy attachment retained |
| `96.Tests.SingleCommit.Purchase.Cases.js` | NEW — U3 suite (140 checks) |
| `_test_runner.js` | suite registration (files +5 `run(...)` entries) |

## 5. Routing / gate (T11.2 §5/§20)

- One frozen config `SINGLE_COMMIT_TRANSACTION_V1` decides all three surfaces (dispatcher,
  adapter, client via server-resolved `singleCommitMode`).
- `ABSENT`/`PREPARED` → legacy writer byte-identical (measured: results and every sheet
  byte-identical, G2a/G2b).
- `ACTIVE` → new core exclusively; legacy cash gate, `postPolicyCPurchaseEvent_` step and
  `PURCHASE_PENDING` unreachable (G7, G9a: accounting-step spy = 0 calls).
- `PAUSED` → `SINGLE_COMMIT_MODE_PAUSED`, zero writes (G3). Invalid JSON/REJECT/bad
  `configVersion` → `SINGLE_COMMIT_CONFIG_INVALID`, zero writes, never a legacy fallback
  (G4-G6). Gate refuses before payload validation (G3-G6 use a canonical payload).
- Explicit `cashAccountCode`/`paidVia`/`paymentStatus` on ACTIVE → `…PAYMENT_FIELD_REFUSED`,
  zero writes, never silently dropped (G8, B8×19).

## 6. Minimum input (T11.2 §17)

Accepted keys only: `transactionType:"EXPENSE"`, `requestKey`, `expenseItemId`, `input`,
optional `supplierID`, tolerated-absent `cashAccountCode` (21:1687 ALLOWED_FIELDS).
`input` = ExpenseDate, ReceiptDate, PurchaseQty, PurchaseUOM, AcquisitionValue,
SupplierSource, ExternalRef, ExternalDocumentStatus, Attested (47:131-135 semantics reused
verbatim). `PurchaseQty` + `PurchaseUOM` REQUIRED (21:1930, `PURCHASE_QUANTITY_UOM_REQUIRED`);
quantity/UOM/cost/evidence pairing validated by the frozen normalizer. Unknown field →
`…FIELD_REFUSED` (B8z); all channel/payment fields → `…PAYMENT_FIELD_REFUSED` (B8×19).
Measured: minimal 4-key payload saves DONE (B7a/B7b).

## 7. SupplierID (D9)

- OPTIONAL metadata: absent → `SupplierID=""` on the event row, save DONE (B10); never a
  refusal reason; never persisted into the history-readable `NormalizedPayload` (B2c).
- Supplied → validated against `SUPPLIER_MASTER_CONTRACT` in the same intent, before any
  write: missing/inactive → `…SUPPLIER_INVALID`, zero writes (B11b/B11c); valid → preserved
  byte-exactly on the event row (B11a). Adapter derives `SupplierSource` from the master Name
  (95A:465-477).

## 8. Operation authority

- OperationType `PURCHASE_SINGLE_COMMIT_SAVE`; keyed `(OperationType, RequestKey)` in
  `TransactionOperations` via `transactionResolveOperation_` (95A:212).
- Deterministic `OperationID = TXOP-…` from (type, key) (95A:209, B4b).
- Intent row carries the full frozen plan JSON; exact ten-field readback before any business
  write (21:2755-2790); COMMITTED transition with exact ten-field readback (21:2418).
- One RequestKey owns the whole transaction end-to-end (client `purchaseIntentRequestKey_`,
  194:56; envelope/ops/business IDs all keyed by it, B4b/B5).

## 9. Immutable plan (T11.2 §7)

`purchaseSingleCommitPlan_` (21:2010) freezes once: event row (backend-derived final state),
2 journal rows, audit row, `payloadHash`, `journalSignature`, `planDigest`.
`purchaseSingleCommitVerifyPlan_` (21:2123) re-derives and fails closed on malformed shape or
any content disagreement — digest/amount/account/event-row/audit/journal/signature tamper →
`RECOVERY_REQUIRED`/`CONFLICT` with zero additional writes (D9-D11, D12).
No mutable master is re-read after freeze; bounds (cells/bytes/cell-chars) checked before the
intent write and re-checked on resume (21:2288).

## 10. Atomic batch (T11.2 §8)

- ONE `spreadsheets.batchUpdate` = exactly three `appendCells` subrequests over
  `["PurchaseEvents","BalanceLedger","Logs"]` (21:2268/2905); missing sheetId throws before
  the request (atomic rejection).
- Measured: exactly one batch `[{PurchaseEvents,1},{BalanceLedger,2},{Logs,1}]`, writeCount 4
  (B1a/B1b); frozen surface list asserted (B1c). Intent/batch/readback/commit remain
  multistep — only the batch is atomic (documented, 21:1668 header comment).
- RAW CellData only (`string/number/boolValue`), IsActive transported as boolValue (21:2268).

## 11. PurchaseEvent final state (D4/D8)

Written final inside the append, never updated afterwards: `PaymentStatus=PAID`,
`CashAccountCode=1040`, `AccountingStatus=POSTED`, `Lifecycle=CAPTURED_OPERATIONAL`,
`IsActive=true`, `RecoveryKey=pe-receipt-<key>` (B2b). No payment key ever present in
`NormalizedPayload` (B2c); `ReceiptPlan="null"`. No accountingPending / AP_PENDING /
SETTLEMENT_PENDING anywhere (B13a, I4a-c).

## 12. Journal / source identity

- JournalID `POLICYC-PEXP-PURCHASE-PE-<requestKey>`; lines `-1`/`-2` (B3d).
- Line 1: `AccountCode 6210`, Debit = amount, Credit 0 (B3b); Line 2: `AccountCode 1040`,
  Debit 0, Credit = amount (B3c); exactly 2 lines, balanced (B3a/B3f), `Tanggal` = economic
  date key (2026-10-05) (B3e).
- `MovementType=PURCHASE_RECOGNITION`, `SourceType=PURCHASE_EVENT`, `SourceID=PE-<key>`
  (B3e, I10a); signature = `policyCJournalSignature_(rows)` (B4a) and stable across storage
  (I7b).
- Audit row `Module=TransactionEntry`, `Action=CREATE_PURCHASE`, `RecordID=PE-<key>` (B6a).

## 13. RequestKey / replay / recovery

- Replay of COMMITTED + EXACT → DONE `replay:true`, writeCount 0, zero sheet/batch writes
  (D1a/D1b).
- Same key, different payload → `OPERATION_PAYLOAD_CONFLICT`, zero additional writes (D2).
- UNKNOWN before batch (`PURCHASE_BEFORE_BATCH`) → `unknown:true` + identity retained,
  intent-only state; resume completes with one batch (D3a-c).
- UNKNOWN after batch → artifacts present, resume finalizes without a second batch (D4a-c).
- Batch transport failure → `UNKNOWN` (never definite failure), one clean recovery (D5a-b).
- COMMITTED with missing event / missing ledger side → `RECOVERY_REQUIRED`
  `ARTIFACTS_INCOMPLETE`, no repair/rewrite (D6/D7); duplicate ledger line →
  `IDENTITY_CONFLICT` (D8); foreign event bound without operation row → `CONFLICT` zero
  writes (D13).

## 14. 1040 preflight (T11.2 §11)

`preflightSingleCommitMoneyAccount` over Accounts BEFORE any business mutation. Missing /
duplicate / inactive / wrong type / wrong CashFlowGroup / wrong NormalBalance →
`…ACCOUNT_PREFLIGHT_FAILED`, zero writes, zero batches, zero operation rows (P1-P6).
No fallback to 1000/1010/1020/1040-on-failure (P7a/P7b). Pure: Accounts sheet never mutated
(P12b). Exact §11 metadata → DONE (P12a).

## 15. 6210 preflight

Per existing account/master contract, before any write: exactly one `6210`, active,
`AccountType=Expense`, `NormalBalance=DEBIT` (21:2676-2700). Absent / duplicate / inactive /
wrong type / wrong balance → `…ACCOUNT_PREFLIGHT_FAILED`, `field:"6210"`, zero writes
(P8-P11b). Never created, never inferred (P12b row count fixed).

## 16. Policy C preservation

Prospective Policy C shape reused with credit frozen to 1040: measured equivalence with
`buildPolicyCPurchaseJournal(event, [])` — status READY and identical journal signature
(I7b); `POLICYC-PEXP-PURCHASE-` prefix, Dr6210 not Dr1100 (I7a). Regime gate: pre-transition
ExpenseDate → `REGIME_NOT_PROSPECTIVE` refusal (21:2702-2708). Policy C transition-date
resolver untouched.

## 17. AP / 2000 isolation

No Cr2000, no UNPAID, no `AP-` obligation identity, no `SETTLEMENT_PENDING`/`AP_PENDING` log
(B13b, I4b/I4c); 2000 exists in the fixture and is never written (I3b). Envelope never
carries `accountingPending` (B13a).

## 18. Inventory / HPP isolation

Write surfaces exclude every Inventory surface; `ReceiptPlan="null"`,
`AllocationStatus=QUANTITY_PACKAGE_UNRESOLVED` (cost-capture only, I6a/I6b); no Dr5000 /
Cr1100 / COGS rows (I3a/I6b); ordinary Expense surface (tabops) untouched (I3b). No Inventory
authority is read or written by the core.

## 19. Treasury isolation

`WRITE_SURFACES` exactly the three frozen surfaces (I5a); writer + normalizer source carry no
`TreasuryReceipt`/`TreasuryOperations`/`MANUAL_VERIFIED`/`EvidenceRef`/`SettlementID`/
`Settlements` token (I5b×6); no Treasury/Settlements surface in scope (I5c); journal rows use
only ledger headers with empty `ExternalRef`/`Keterangan` (I5d).

## 20. Cash Flow source semantics (U4 pre-read)

One money line touches 1040 exactly once (B12a); 1040 = Asset / DEBIT / `CashFlowGroup=
Operating` matching the frozen `SINGLE_COMMIT_MONEY_POLICY.ACCOUNT_EXPECTATION` (B12a/B12c);
debit counterpart 6210 = Expense / DEBIT / Operating (B12b); both lines carry
`PURCHASE_EVENT|PE-…|PURCHASE_RECOGNITION` deterministic source identity (I10a); regime
`PROSPECTIVE_PURCHASE_EXPENSE` recorded on the plan (B12c).

## 21. Reporting identity

DONE envelope: legacy DTO `success:true`, `status:"OPERATIONAL_POSTED"`,
`accountingStatus:"POSTED"`, `data.id=PE-<key>` projected via
`projectPurchaseEventTransaction_`, plus `singleCommit{status,replay,writeCount}`,
`requestKey`/`operationID`/`eventId`/`journalID` linkage (B5, B6b). One business identity
equal across envelope, event row, journal SourceIDs, audit RecordID, operation BusinessID and
plan entryID (B5); `canonicalTransactionType="PurchaseEvent"` (I8b).

## 22. Correction lineage readiness (U6)

Every identity recomputable from `PE-<requestKey>` alone: EventID, RecoveryKey, JournalID,
LineIDs, operation BusinessID, audit RecordID (I8a); append-only originals with stable
movement/source types for signed reversal (I8b); historical fixtures byte-identical (I1a);
plan digest + payload hash permit tamper-proof resume (B4c, D9-D11).

## 23. Historical compatibility (T11.2 §19)

- ABSENT/PREPARED behavior byte-identical to pre-U3 (G1/G2; legacy multistep preserved
  including its separate accounting step, G9b = exactly 1 call).
- Pre-existing PurchaseEvents/Logs/BalanceLedger/tabops/Accounts rows byte-identical after an
  ACTIVE save (I1a); headers unchanged (I1b).
- Whole store (historical + new row) round-trips `purchaseEventHistory_` byte-exactly (I2) —
  the frozen history-compatible normalize (47:111-161) reused with `allowLegacyPaymentStatus`.
- No historical rows rewritten, no backfill, no config/property write (I9×4, I9z).

## 24. Tests (MEASURED, local harness, fixture-only)

- Suite `96.Tests.SingleCommit.Purchase.Cases.js`: GATE 16 + PREFLIGHT 20 + PLAN 50 +
  DURABILITY 20 + ISOLATION 34 = **140 checks**, covering all 57 required items (gate
  ABSENT/PREPARED/PAUSED/invalid; ACTIVE success; event exactly once; PAID/1040/POSTED;
  exact Dr6210/Cr1040/2 lines/signature; ONE batch; no second `postPolicyCPurchaseEvent_`;
  one RequestKey; replay/conflict/UNKNOWN pre+post/artifact loss/duplicate/tamper;
  1040+6210 matrices; no channel fallbacks; SupplierID optional/validated; no AP/Treasury/
  Inventory; Policy C preserved; Operating metadata; lineage; historical fixtures; no
  production mutation).
- Registration: `_test_runner.js` files +5 `run(...)` entries after the U2 block.
- Full regression `node _test_runner.js` MEASURED: **196 PASS / 0 FAIL** (final run after
  last source+test modification). Baseline before repairs: 189 PASS / 2 FAIL (both U3
  contract alignments: U2 A5 strict-allowlist code; U137 no-inline-payment assertion).
- Sales U1 suites green (5/5 single-commit suites + full Sales V2 battery); Expense U2 green
  (22+14+43+22+31 checks); legacy Purchase suites green (policy/orchestration/dispatcher/
  wiring/lookup/migration/UI etc.); Treasury T3-T10.5 green; transitional-24k closure remains
  frozen/unexecuted (unchanged).
- `node --check` PASS: `21`, `95A`, `96.Tests.SingleCommit.Purchase.Cases.js`,
  `96.Tests.SingleCommit.Expense.Cases.js`, `96.Tests.Expense.Purchase.Cases.js`,
  `_test_runner.js`.

## 25. Production mutation count

**0.** No `clasp` command, no `clasp push/pull/deploy`, no PropertiesService/config write, no
spreadsheet write outside fixture memory, no network transport (fixture batch seam replaces
the production transport), no Git mutation. Source-token guards for
`setProperty(`/`requireNumlockProductionSpreadsheet(`/`clasp `/`SpreadsheetApp.
getActiveSpreadsheet` in the core (I9×4); core never acquires a lock (I9z).

## 26. Exact remaining U6 Purchase work + next units

U6 Purchase (not started, requires its own unit authorization):
1. `PURCHASE_EVENT_VOID` — durable append-only void: signed Policy C reversal pair
   (`POLICY_C_REVERSAL`, Dr1040/Cr6210 exact inverse of the original journal), lifecycle →
   VOIDED + IsActive=false, ONE atomic batch [reversal rows, event-status update, Logs],
   operation authority + replay/conflict/UNKNOWN recovery, refusal while U6 correction
   contract is absent.
2. `PURCHASE_EVENT_CORRECT` — durable correction: linked exact reversal + replacement
   recognition in ONE batch, original lifecycle → CORRECTED, deterministic linkage
   (ExternalRef = original JournalID), payment-status changes refused until an explicit
   contract exists.
3. U6 acceptance: cross-layer read integration with U4 readers, historical fixtures
   byte-identical, mutation-sensitivity battery.

Then (per roadmap): `T11_6_U4_CANONICAL_READERS_AND_AGGREGATE_FUNDS` (canonical Purchase
readers over the single-commit identity + aggregate funds), U5, U7-U10, and a separately
authorized activation unit before any config `ACTIVE` reaches production.
