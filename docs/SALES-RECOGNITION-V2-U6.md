# SALES_RECOGNITION_V2 U6 — Durable Correct / Void Mutations

Status: COMPLETE (local only; V2 stays PREPARED/disabled by default — no
activation, no deployment, no production access).

## Scope

`97C.SalesRecognition.V2.Correction.js` adds two deterministic, durable,
idempotent mutation paths over the frozen V2 recognition model:

| Path | OperationType | Artifacts (ONE atomic `spreadsheets.batchUpdate`) |
| --- | --- | --- |
| `salesRecognitionV2DurableVoid(payload)` | `SALES_V2_VOID` | 1 REVERSAL event + 2 BalanceLedger lines + 1 Void audit (3 surfaces) |
| `salesRecognitionV2DurableCorrect(payload)` | `SALES_V2_CORRECT` | reversal (event + 2 lines + audit) + replacement order header + replacement OrderLines + replacement RECOGNITION event + replacement journal (2 lines) + replacement audit (5 surfaces) |

Local/test entrypoints: `salesRecognitionV2VoidWithRuntime_`,
`salesRecognitionV2CorrectWithRuntime_` over the injected runtime (same seam
style as the U2 save core).

## Durability (U2 architecture, no weaker model)

Outer lock (public wrapper only, no nested locks) → normalize (legacy
identities `SAL-`/`OPS-` rejected) → exact `(OperationType, RequestKey)`
lookup BEFORE any target/master recalculation → resume from the persisted
plan, or new intent:

1. config gate (PREPARED/PAUSED refuse, zero writes) + schema gate +
   account preflight;
2. eligibility from the shared U3 projection authority (sticky
   `V2_COMMITTED` cohort, clean chain, current active revision, terminal
   lifecycle rule, competing-intent gate over the operations repository);
3. freeze the complete plan once (identities, journal rows, event rows,
   audit rows, analytical authority snapshots, target immutability digests,
   normalized payload, `planDigest`);
4. persist `IN_PROGRESS` + exact ten-field readback;
5. ONE atomic batch (`appendCells`, RAW CellData only);
6. exact artifact verification (`NONE/EXACT/PARTIAL/CONFLICT/UNKNOWN`);
7. `COMMITTED` + exact COMMITTED readback → `DONE`.

Retries use the persisted plan only: zero authority reads, zero master
recalculation, same effect for same key + payload, changed payload =
`CONFLICT` with zero writes. Timeout/unresolved readback stays `UNKNOWN`
(`BATCH_OUTCOME_UNKNOWN` / `READBACK_UNKNOWN` / `COMMIT_OUTCOME_UNKNOWN`).
Partial/conflicting/tampered artifacts fail closed — never repaired.

## Frozen accounting

- VOID: exact recognized amount, `Dr4000 / Cr1030`, `EconomicDate` =
  server-recorded ACTION-period date (never backdated).
- CORRECT: full original reversal (`Dr4000 / Cr1030`) + full replacement
  recognition (`Dr1030 / Cr4000` of the replacement OrderTotal) inside ONE
  intent and ONE batch. `36,000 → 41,000` persists `−36,000` and `+41,000`;
  a `+5,000` delta is never stored.
- Policy C: no Cash/Bank/Payment/Settlement mutation, no automatic
  `Dr1100 / Cr5000`, no COGS/HPP journal, no InventoryLedger movement, no
  automatic `Dr1030 / Cr2010`. HPP exists only as analytical snapshot data
  on the replacement.

## Identities and lineage

- Reversal side derives from `(OperationType, RequestKey, target OrderID)`
  with `SCRV- / REVV- / SRV2JV- / SRAV-` prefixes.
- Replacement derives from its own NEW OrderID exactly as a fresh U2 Save
  would (`ORD- / REV- / SCR- / SRV2J- / SRA- / OL-`), because `Orders` is
  keyed by OrderID: a second header for the same OrderID is a
  `DUPLICATE_ORDER` and breaks U3's single-pass order processing. The
  namespace stays `ORDER:<OrderID>:<new RevisionID>`.
- Lineage travels only on existing event fields: reversal carries
  `ReversalOfRecognitionID` (+ `ReplacementID` for Correct); replacement
  carries `OriginalID`. Original artifacts are never rewritten; the plan
  stores digests of the target event, journal, audit, order, and order lines,
  and every inspect verifies them (`TARGET_*_TAMPERED`).

## Cross-layer seams (narrow, additive, documented)

- `97B.SalesRecognition.V2.Projection.js`
  - `SALES_RECOGNITION_V2_RECOGNITION_OPERATION_TYPES`:
    a RECOGNITION event may be authored by `SALES_RECOGNITION_V2_SAVE` or
    `SALES_V2_CORRECT` (replacement keeps the correction OperationID and its
    new OrderID as BusinessID).
  - `SALES_RECOGNITION_V2_MUTATION_OPERATION_TYPES`: a REVERSAL event with a
    persisted `OperationID` must resolve to exactly one COMMITTED
    `SALES_V2_VOID`/`SALES_V2_CORRECT` operation (pending → recovery issue);
    a persisted `AuditID` must resolve to one bound audit. Read-side
    fixtures without linkage keep the frozen U3 behavior.
  - activeView rule: a chain carrying a REVERSAL has no active event
    (Voided/superseded) unless the same chain carries the replacement
    recognition via `OriginalID`; in that case the latest RECOGNITION of the
    chain stays active.
  - stalled mutation intents surface through the operations loop with the
    same rules as stalled SAVE intents.
- `91.Transactions.Query.js`: a reversed-only chain reads as a VOIDED
  Transaction row/detail (`isActive: false`, `status: "VOIDED"`,
  `immutableReason: "ALREADY_VOIDED"`) with the original amount and full
  lineage; any other shape stays fail-closed. Action flags remain
  `canCorrect/canVoid = false` (U7 owns the operator dispatch seam).
- U5 Finance needs no change: it consumes signed projection events by
  EconomicDate with no mutation-specific arithmetic.

## Tests (MEASURED, `node _test_runner.js`)

74 PASS / 0 FAIL (baseline 62 + 12 new U6 entries):

- `testSalesRecognitionV2U6VoidCore` — exact amount, `Dr4000/Cr1030`,
  signatures, action-period date, lineage, original immutability, idempotent
  replay, payload conflict, plan-controlled retry, PREPARED refusal,
  lookup-before-recalculation, outer-lock wrapper.
- `testSalesRecognitionV2U6VoidRecovery` — 7 crash boundaries, batch timeout
  (no apply / after apply), response-loss replay, partial, duplicate journal,
  tampered event, missing audit, tampered/corrupt plan, invalid state,
  commit readback failure, target tamper, committed-without-artifacts.
- `testSalesRecognitionV2U6VoidIntegrity` — missing/duplicate/wrong-amount/
  wrong-account/wrong-lineage/wrong-owner/tampered-audit/duplicate-target
  artifacts all fail closed with zero repair writes.
- `testSalesRecognitionV2U6CorrectCore` — 36,000 → 41,000, full reversal +
  replacement, new identities, both journals, ONE batch, two audits,
  snapshot freeze (masters mutated after intent → persisted plan wins,
  zero authority reads), no delta-only artifact.
- `testSalesRecognitionV2U6CorrectRecovery` — crash matrix + timeout +
  response loss for the full artifact set.
- `testSalesRecognitionV2U6Lifecycle` — double Void, double Correct,
  Void-after-Correct, Correct-after-Void, replacement targetable again,
  reversal never a target, pending competing keys fail closed
  (`SALES_V2_MUTATION_EXISTS`), committed loser observes the terminal state.
- `testSalesRecognitionV2U6CrossLayer` — U3 events/activeView/quality, U4
  active + voided list/detail, U5 period Revenue, PERIOD (Oct unchanged).
- `testSalesRecognitionV2U6PolicyC` — only 1030/4000 in new ledger rows;
  no 1100/5000/2010/1000, no `SALE_HPP`/`PAID_SALE`, protected surfaces
  untouched, analytical HPP only.
- `testSalesRecognitionV2U6Legacy` — cross-rejection both directions,
  legacy handlers reject V2 identities, legacy Void regression intact,
  source-level path separation.
- `testSalesRecognitionV2U6Transport` — exactly ONE batch per mutation,
  appendCells-only RAW body, missing sheetId rejected pre-request,
  timeout/HTTP error → `UNKNOWN`, sole-writer row-delta proof.
- `testSalesRecognitionV2U6SourceAudit` — 29-item structural audit.
- `testSalesV2U6MutationProof` — 10 injected contract bugs (Cr1100 swap,
  original-identity reuse, delta-only replacement, split batches,
  master re-read on retry, duplicate terminal allowed, timeout collapsed,
  legacy accepts V2, backdated EconomicDate, forged 2010 row) each caught
  by its designated suite; clean run passes first. Never mutates tracked
  files.

## Known boundaries

- Production wrappers (`salesRecognitionV2DurableVoid/Correct`) default to
  PREPARED and refuse with zero writes; no activation, no `clasp`, no live
  Apps Script execution in this unit.
- Legacy Correct/Void handlers are untouched; V2 identities never resolve
  through them and legacy identities never enter the V2 path.
