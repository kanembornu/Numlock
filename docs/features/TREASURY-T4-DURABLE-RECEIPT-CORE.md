# Treasury T4 — Durable Receipt Core

**Phase:** NUMLOCK_TREASURY_IMPLEMENTATION
**Task:** T4_TREASURY_DURABLE_RECEIPT_CORE
**Classification:** COMPLEXITY L3 · OPERATIONAL_RISK R2 · REASONING_EFFORT high
**Scope:** Local durable `TREASURY_RECEIPT_V1` Save core per frozen T2 contract + T3
foundation: RequestKey → TreasuryOperation → V2 exposure validation → exact outstanding →
destination validation → immutable OperationPlan → durable IN_PROGRESS intent → atomic
business mutation (+1 receipt / +2 ledger lines / +1 audit) → TreasuryReceipt + DrCash/Cr1030
+ TreasuryAudit → exact readback/signature verify → COMMITTED → replay/recovery. Source +
local in-memory fixture tests only. NO production execution. NO reversal/correction (T6). NO
canonical T5 projection. NO UI. NO activation.
**Evidence classes:** MEASURED = executed this session; SOURCE = repository source at HEAD
`a6f0075`; PRIOR-MEASURED = accepted T1/T2/T3 evidence; DERIVED = logical consequence.

---

## 1. Starting baseline

- HEAD verified `a6f0075` (T1 `0b2f05d` → T2 `360c95d` → T3 `a6f0075`) before any action.
  Index empty (zero staged); tracked worktree clean.
- Untracked inventory at start: exactly 27 `tests/tmp/u10e-*` files — never touched, staged,
  or modified (re-verified in §22/§24).
- KNOWN_PRIOR_EVIDENCE (not re-proven): regression baseline 111 PASS / 0 FAIL at `a6f0075`;
  T3 foundation (`99.Treasury.Receipt.Foundation.js`) with `treasuryDateKey` /
  `treasuryJournalSignature` / `treasuryStableId_` / `treasuryClearingPreflight` /
  eligibility / config reader; 1030 CashFlowGroup preflight flagged as hard T4 gate; writer
  exclusivity set {39, 40, 41, 47, 97A, 97C}; idempotency pattern = source-key signature +
  readback.

## 2. Source changes

| File | Status | Role |
| --- | --- | --- |
| `99A.Treasury.Receipt.Durable.Save.js` | NEW | Durable Save core (module `TREASURY_RECEIPT_V1_SAVE` + normalize/preflight/lookup/exposure/outstanding/plan/intent/batch/inspect/signature/commit/replay/resume + production runtime factory + single outer-lock wrapper) |
| `96.Tests.Treasury.Receipt.Durable.Save.Cases.js` | NEW | Suites A–H + 1030 CashFlowGroup gate + 20-boundary failure injection + 25-point mutation sensitivity |
| `_test_runner.js` | MODIFIED (registration only) | Registered `99A…` + `96.Tests…` in the file list, injected `_treasuryDurableSource`, added 10 `run(...)` entries; zero behavior change to any existing test |
| `docs/TREASURY-T4-DURABLE-RECEIPT-CORE.md` | NEW | This evidence document |

Tracked runtime source outside `_test_runner.js` is byte-identical to `a6f0075`. No
existing runtime file was edited. `node --check` clean on all changed `.js` files.

## 3. T2/T3 dependency

- **T2** (`docs/TREASURY-T2-RECEIPT-AUTHORITY-AND-RECONCILIATION-CONTRACT.md`) is
  authoritative for schemas (§4), config/modes (§5), destination eligibility (§6), exposure +
  clearing (§7), journal + ID namespaces (§8), dates (§9), evidence (§10), concurrency (§14),
  idempotency/recovery (§15), write sequence (§16), delta (§17), snapshot (§18), cache (§22),
  error catalog (§24).
- **T3** (`99.Treasury.Receipt.Foundation.js`) is REUSED, never forked: contract constant,
  strict schema validators, config validator/classifier, `treasuryDestinationEligible`,
  `treasuryClearingPreflight` (incl. CashFlowGroup), `treasuryValidateReceiptDate` /
  `treasuryValidateEconomicDate`, ID helpers (`treasuryOperationId`/`treasuryReceiptId`/
  `treasuryJournalId`/`treasuryAuditId`), `treasuryJournalSignature`, error codes. The T4
  `CODES` map references T3 `ERROR_CODES` constants directly for every T3-owned code; the
  remaining codes are the exact frozen T2 §24 strings (no aliases, no invented codes).
- Other reuse: `readCanonicalTable` / `requireCanonicalHeaders` (20),
  `transactionPayloadHash_` (95A canonical hash class), `salesProjectionVerifyV2Event_`
  (97B U3 committed-artifact verifier — read-only cross-domain dependency, documented at the
  helper), `validateBalanceLedgerCandidates` shape contract (39 headers), sanitized transport
  `inventoryReceiptMigrationRequest_` (43) for the production `:batchUpdate`, and
  `invalidateDashboardCache` (90).
- No T2/T3 contradiction materialized; no `BLOCKED_CONTRACT_CONFLICT`.

## 4. Request payload

Operator facts only; the server derives everything else:

`{ requestKey, recognitionID, destinationAccountCode, grossAmount, receiptDate, evidenceType,
evidenceRef, actor? }`

Normalization (pure, before any read/write; never coerces invalid→valid, never partial→full):

- `requestKey`: trimmed, `^[A-Za-z0-9][A-Za-z0-9._:-]{3,127}$` → else `TREASURY_PAYLOAD_INVALID`.
- `recognitionID`: trimmed, `^SCR-[A-Za-z0-9-]{3,127}$` → else `TREASURY_PAYLOAD_INVALID`.
- `destinationAccountCode`: trimmed nonblank, ≤16, no control chars (eligibility later).
- `grossAmount`: finite number, or digit-only string (`/^-?\d{1,15}$/`) converted exactly;
  anything else `TREASURY_PAYLOAD_INVALID`. Non-integer/≤0 later → `TREASURY_AMOUNT_NOT_POSITIVE`.
- `receiptDate`: strict `YYYY-MM-DD` real calendar via T3 `treasuryValidateReceiptDate`
  → else `TREASURY_DATE_INVALID`.
- `evidenceType`: literal `MANUAL_VERIFIED` → else `TREASURY_EVIDENCE_TYPE_INVALID`.
- `evidenceRef`: trimmed, 3–200 chars, no control characters, no 13–19-digit run, no
  password/pin/token pattern → else `TREASURY_EVIDENCE_REF_INVALID`.
- `actor`: optional; when present nonblank ≤200, no control chars (audit identity only, no
  RBAC/roles). Server fallback `runtime.actor()` (`Session.getActiveUser().getEmail() ||
  CANONICAL_ENTRY.USER`, T2 §4.1) when omitted.
- Server-derived: `OrderID`, `RevisionID`, `EconomicDate ≡ ReceiptDate`, `ReceivedAt`
  (server ISO UTC at plan freeze), outstanding, recognized amount, `JournalID`,
  `ReceiptID`, `OperationID`, `AuditID`, destination account name, statuses.

## 5. Exposure resolution

`treasuryResolveExposure_` (V2_ONLY, T2 §7.1) over one bounded narrow read helper
(`treasuryReadExposureSources_`: SalesRecognitionEvents, TransactionOperations,
SalesRecognitionAudits, BalanceLedger, Orders, OrderLines):

1. 0 rows → `TREASURY_RECOGNITION_MISSING`; >1 → `TREASURY_RECOGNITION_INTEGRITY_FAILURE`.
2. `ContractVersion !== SALES_RECOGNITION_V2` → `TREASURY_RECOGNITION_NOT_V2`.
3. `EventType !== RECOGNITION` → `TREASURY_NO_ELIGIBLE_EXPOSURE`.
4. Any persisted V2 `REVERSAL` row targeting the recognition → `TREASURY_RECOGNITION_INACTIVE`
   (void/reversed never clearable).
5. Integrity via **read-only reuse** of `salesProjectionVerifyV2Event_` (U3): complete row,
   snapshot digests, `PostingStatus COMMITTED`, committed operation + audit linkage, owner
   order, journal exists (2 active lines, sums = amount, Sales signature verifies). Any
   non-`RECOGNIZED` verdict → `TREASURY_RECOGNITION_INTEGRITY_FAILURE`.
6. Lineage: OrderID resolves in Orders, ≥1 OrderLine, RevisionID nonblank →
   else `TREASURY_ORDER_LINEAGE_MISSING`.
7. Amount finite > 0 → else `TREASURY_RECOGNITION_INTEGRITY_FAILURE`.

NEVER uses Payment/Settlement/ReceiveVia/PaymentMethod/tabsal/UI facts. Cross-domain
dependency documented: Treasury consumes Sales authority read-only; Sales artifacts stay
byte-identical (suite G).

## 6. Outstanding computation

`treasuryComputeOutstanding_(recognitionID, recognizedAmount, ss, ownOperationID)` — T4 view.
Governing authorities (precedence): **T2 §12 > T5 projection > T4 implementation/docs**.
Formula (T2 §12, T5 parity): `cleared = committedOrdinary − committedReversals`;
`outstanding = recognized − cleared` (equivalently `recognized − (ordinarySum − reversalSum)`).
A committed reversal contributes **exactly once** and restores the pre-receipt outstanding
(receipt 24,000 + reversal 24,000 → outstanding 24,000, UNCLEARED); with no reversal,
`outstanding = recognized − ordinarySum`. Reversal rows are T6-compatible: classified,
target-validated (one committed reversal max per target, else `TREASURY_EXPOSURE_EXCEPTION`),
never produced by T4. Receipt activeness (no committed `SALES_RECEIPT_REVERSAL` targets the
receipt) feeds **only** the duplicate-active fail-closed gate — never the outstanding formula.
Fail closed (never treat unknown as zero):

- duplicate `(OperationType, RequestKey)` operation rows, unknown operation `State`,
  unparseable `OperationPlan`, receipt with unresolvable/mismatched operation linkage,
  unknown `ReceiptType`, duplicate receipt IDs, duplicate active receipts, reversal target
  missing/unknown → `TREASURY_EXPOSURE_EXCEPTION`.
- `IN_PROGRESS` operation on the exposure not owned by this request → `TREASURY_EXPOSURE_BUSY`.

Recompute happens inside the lock after RequestKey lookup, immediately before plan freeze.
T5 owns the canonical projection; no T5 projection is implemented here.

## 7. Durable operation

`TreasuryOperations` (independent T3 10-column sheet — `TransactionOperations` never reused):
`TreasuryOperationID (TROP-), OperationType=TREASURY_RECEIPT_SAVE, RecognitionID, RequestKey,
State ∈ {IN_PROGRESS, COMMITTED}, PayloadHash, OperationPlan, CreatedAt, UpdatedAt,
LastError`. Persisted AFTER all gates pass, BEFORE any business write; exact ten-field
readback (Date-safe) must match with `State === IN_PROGRESS` or the call fails with
`TREASURY_INTENT_READBACK_FAILED` (zero business writes). COMMITTED transition rewrites only
`State/UpdatedAt/LastError` and is read back exactly. `OperationPlan` cell is written once at
intent and never rewritten afterward.

## 8. Immutable OperationPlan

Frozen once (`treasuryReceiptPlan_`), persisted as one JSON cell, integrity-digested with
`transactionPayloadHash_` (`planDigest`). Contains: plan/contract version, operation type +
side, operationID/requestKey/payloadHash, exact normalized payload, contract/config identity
(`mode/activationID/activatedAt/configVersion`), recognitionID/orderID/revisionID,
recognizedAmount, outstandingBefore, receiptAmount, destination {code, name}, receiptDate,
economicDate, evidence {type, ref}, actor, savedAt (ReceivedAt), receiptID/journalID/auditID,
journalSignature, movement/source types, full `receiptRow`, both `journalRows`, full
`auditRow`, exact `snapshot` object. `treasuryReceiptVerifyPlan_` re-verifies shape,
derivation, exact clearing, destination ∈ cash universe ∧ ≠1030, evidence/date rules,
journal accounts == {destination, 1030}, amounts, signature, receipt/audit linkages, snapshot
byte-equality, and the digest — at freeze (definite REFUSED, pre-write) and on every resume
(fail closed, zero writes). No business-critical value is recomputed differently after a
partial failure (resume never re-reads mutable masters; suite D freeze evidence).

## 9. Mutation atomicity

ONE `spreadsheets.batchUpdate` with exactly three `appendCells` subrequests (fields
`userEnteredValue`, safe RAW CellData, never formulaValue) over the frozen surfaces
`[TreasuryReceipts, BalanceLedger, TreasuryAudits]` = 1 receipt row + 2 ledger lines + 1 audit
row = 4 rows. SheetIds resolved read-only before the request; a missing sheetId throws BEFORE
dispatch (atomic rejection). The single batchUpdate is the ONLY atomic boundary (all three
subrequests or none); intent, batch, readback, and commit are multistep with deterministic
recovery — no database-global atomicity is claimed. Production transport reuses the sanitized
`inventoryReceiptMigrationRequest_("post", ":batchUpdate", body)` (43). Bounds (cells ≤ 4000,
UTF-8 bytes ≤ 1,000,000 + 4096 overhead, plan cell ≤ 45,000 chars) are enforced BEFORE the
intent write and re-checked against the STORED plan on resume (`TREASURY_PAYLOAD_TOO_LARGE`).

## 10. Journal

Exactly 2 lines, one `JournalID (TRJ-…)`, `LineID = JournalID + "-1"/"-2"`:

| Line | Account | Debit | Credit |
| --- | --- | --- | --- |
| 1 | `DestinationAccountCode` | GrossAmount | 0 |
| 2 | `1030` | 0 | GrossAmount |

`MovementType = TREASURY_RECEIPT`, `SourceType = TREASURY_RECEIPT_V1`,
`SourceID = TreasuryReceiptID`, `ExternalRef = RecognitionID`, `Tanggal = EconomicDate`,
`IsActive = TRUE`, CreatedAt/By + UpdatedAt/By from server instant/actor. Any account outside
{destination, 1030} is structurally impossible: plan verification maps
`JOURNAL_ACCOUNT_MAPPING_MISMATCH` and `treasuryForbiddenJournalAccount` guards
{4000, 5000, 1100, 2000, 2010, 6210}. No 4000/Revenue/HPP/Inventory line can be produced.

## 11. Receipt

Exact 24-column T3 schema, order frozen, no stored `Status` column (`PostingStatus` = 18 =
write-once `COMMITTED` literal). Immutable after creation: never updated in place on any path
(the only writer is the batch append). `EconomicDate` byte-equal `ReceiptDate` (enforced in
plan verification). `SnapshotJSON` is the exact T2 §18 key set (18 keys), frozen with the plan,
byte-verified at readback.

## 12. Audit

Exactly one 11-column `TreasuryAudits` row per committed receipt, written in the same batch:
`AuditID (TRA-), ContractVersion, OperationID, RequestKey, TreasuryReceiptID, RecognitionID,
OrderID, JournalID, PayloadHash, Actor, SavedAt` — cross-linked to the operation, request,
receipt, exposure, order, journal, and payload hash. Replay/recovery never creates a second
audit (identity lookup; zero append on replay — suites C/D).

## 13. COMMITTED semantics

Sequence inside the lock: batch → exact business readback (`treasuryReceiptInspect_`:
receipt row exact (24 cols minus the signature column — see § below), journal source-set vs
id-set equality + content exact + balance == amount, audit content exact + id/op-set
equality, global cross-owner scans including “same RecognitionID under a different receipt”)
→ **signature recomputed from persisted rows** via T3 `treasuryJournalSignature` and compared
to plan + receipt cell (`TREASURY_JOURNAL_SIGNATURE_INVALID` on mismatch — mismatch makes
DONE impossible) → crash boundaries → `State = COMMITTED` write → exact ten-field COMMITTED
readback (`TREASURY_READBACK_INCOMPLETE` / `TREASURY_SAVE_EXECUTION_UNKNOWN` → UNKNOWN, never
DONE) → post-commit cache hook → DONE. `COMMITTED` is set only after receipt+ledger+audit
exact readback + valid signature + cross-linked IDs; DONE means durable + verified.

## 14. Replay

`RequestKey` lookup is the FIRST durable lookup, before any exposure planning (trace-proven,
suites A/M2):

- Same key + same normalized payload + `COMMITTED` → verify persisted artifacts + signature
  exactly, then DONE with `replay: true`, `writeCount: 0`, identical
  operationID/receiptID/journalID/auditID, zero new rows, cache re-invalidated. Disagreement
  (artifact drift, signature mismatch) → NOT DONE (`RECOVERY_REQUIRED`).
- Same key + different payload → deterministic `TREASURY_REQUEST_KEY_CONFLICT`
  (`CONFLICT`), state unchanged, zero writes. Pre-lookup refusals (config/schema/account/
  evidence/date syntax) precede lookup by contract order and are documented.
- New key + cleared exposure → `TREASURY_ALREADY_CLEARED`; never a second receipt.

## 15. Recovery

| Persisted state | Behavior |
| --- | --- |
| No operation row | fresh path (all gates, then intent) |
| `IN_PROGRESS`, no artifacts (intent-only) | re-verify stored plan + schema + bounds → execute frozen plan ONCE → inspect → signature → COMMITTED → DONE |
| `IN_PROGRESS`, exact artifacts (batch done, commit lost) | verify exact + signature → finish `COMMITTED` transition → DONE (no re-append) |
| `IN_PROGRESS`, partial/inconsistent artifacts | fail closed `RECOVERY_REQUIRED` (`TREASURY_ARTIFACTS_INCOMPLETE` / `TREASURY_RECOVERY_REQUIRED`), never append blindly |
| `COMMITTED`, exact artifacts | replay DONE (zero writes) |
| `COMMITTED`, non-exact artifacts | fail closed `RECOVERY_REQUIRED`, no repair |
| Corrupted `OperationPlan` | `TREASURY_OPERATION_PLAN_MALFORMED` (identity retained, replay refused) |
| Invalid persisted `State` | `TREASURY_OPERATION_STATE_CORRUPTED` |
| Artifact readback IO failure | `UNKNOWN` / `TREASURY_READBACK_INCOMPLETE`, identity preserved; later call recovers |
| Batch response lost, nothing applied | `UNKNOWN` / `TREASURY_BATCH_OUTCOME_UNKNOWN`; later call resumes |
| Commit write/readback failure | `UNKNOWN` (`TREASURY_SAVE_EXECUTION_UNKNOWN` / `TREASURY_READBACK_INCOMPLETE`); later call finishes or replays |
| Unexpected throw post-intent | `UNKNOWN` / `TREASURY_SAVE_EXECUTION_UNKNOWN`, requestKey retained |

UNKNOWN is recoverable ONLY with the ORIGINAL `RequestKey`; a new key is never generated and
blind retry is never performed inside the call (single batch attempt; no autonomous retry).
PAUSED/PREPARED never block recovery of a persisted operation (T2 §5) — proven in suite B/M4.

## 16. Concurrency

Single outer `ScriptLock` (`waitLock(30000)`, `releaseLock()` in `finally`, no nested locks)
covers RequestKey lookup → exposure reread → outstanding recompute → duplicate-clear check →
planning → mutation → readback → COMMITTED. Because the whole core runs under the lock and
outstanding is recomputed inside it immediately before plan freeze, a stale advisory read can
never authorize a second clearing (suite E): same RecognitionID with two keys → exactly one
`DONE`, loser `TREASURY_ALREADY_CLEARED`; same RequestKey → one operation/result (replay);
`IN_PROGRESS` claim by another key → `TREASURY_EXPOSURE_BUSY`; ledger ends with exactly one
Dr-destination / one Cr-1030 line and exactly one receipt.

## 17. Failure injection matrix (20 boundaries)

MEASURED via suite D (`testTreasuryT4Recovery`) + suite H; where the atomic batch prevents
intermediate storage states, response-boundary ambiguity is simulated by an injected batch
(partial apply / apply-then-throw) — no impossible storage state is fabricated as real.

| # | Boundary | Simulation | Result (MEASURED) |
| --- | --- | --- | --- |
| 1 | before lock | wrapper source + `TREASURY_LOCK_TIMEOUT` branch ordering (production runtime not invoked) | REFUSED, WRITE_COUNT 0 (A14/FI1) |
| 2 | config | `config: null` | REFUSED `TREASURY_CONFIG_INVALID`, 0 writes (FI2) |
| 3 | schema | renamed Treasury header | REFUSED `TREASURY_SCHEMA_NOT_READY`, 0 (FI3) |
| 4 | account | destination `2010` | REFUSED `TREASURY_INVALID_DESTINATION_ACCOUNT`, 0 (FI4) |
| 5 | 1030 CashFlowGroup | `1030.CashFlowGroup = "Investing"` | REFUSED `TREASURY_SCHEMA_NOT_READY` (`CASH_FLOW_GROUP_UNCLASSIFIED`), 0 (FI5) |
| 6 | recognition | missing `RecognitionID` | REFUSED `TREASURY_RECOGNITION_MISSING`, 0 (FI6) |
| 7 | outstanding/amount | wrong amount vs outstanding | REFUSED `TREASURY_AMOUNT_MISMATCH`, 0 (FI7) |
| 8 | after IN_PROGRESS | crash `T4_AFTER_INTENT` | op `IN_PROGRESS`, 0 artifacts → resume DONE, write 4 |
| 9 | after intent readback | injected intent-readback mismatch | `TREASURY_INTENT_READBACK_FAILED`, 0 business writes → resume DONE |
| 10 | before batch | crash `T4_BEFORE_BATCH` | op `IN_PROGRESS`, 0 artifacts → resume DONE |
| 11 | after batch dispatch | batch throws, nothing applied | `UNKNOWN` `TREASURY_BATCH_OUTCOME_UNKNOWN`, identity kept, 1 batch attempt → resume DONE |
| 12 | after receipt | injected partial apply (receipt only) + throw | `RECOVERY_REQUIRED` `TREASURY_ARTIFACTS_INCOMPLETE` (detail `JOURNAL,AUDIT`); replay fails closed, no append |
| 13 | after ledger | injected partial apply (receipt+ledger) + throw | `RECOVERY_REQUIRED` `TREASURY_ARTIFACTS_INCOMPLETE` (detail `AUDIT`); replay fails closed |
| 14 | after audit | batch applied, response lost (throw) | readback authority → exact → COMMITTED → DONE (write 4) |
| 15 | before business readback | crash `T4_AFTER_BATCH` | artifacts exact, op `IN_PROGRESS` → resume finishes → DONE, write 0, replay |
| 16 | signature verification | tampered receipt signature cell / tampered ledger leg | `RECOVERY_REQUIRED` `TREASURY_JOURNAL_SIGNATURE_INVALID` (`RECEIPT_SIGNATURE_MISMATCH`); ledger tamper → `JOURNAL_TAMPERED`; never DONE |
| 17 | before COMMITTED | crash `T4_BEFORE_COMMIT` | artifacts exact, `IN_PROGRESS` → resume commit → DONE, write 0 |
| 18 | after COMMITTED | crash `T4_AFTER_COMMIT` | op `COMMITTED` + exact → replay DONE, write 0 |
| 19 | COMMITTED readback | commit write failure; commit readback mismatch | `UNKNOWN` (`TREASURY_SAVE_EXECUTION_UNKNOWN` / `TREASURY_READBACK_INCOMPLETE`), sheet state preserved → later call DONE |
| 20 | cache | cache callback throws | status still `DONE` (never retried, never converts to retryable) |

Additional fail-closed boundaries proved: corrupt plan (`TREASURY_OPERATION_PLAN_MALFORMED`,
detail `RECEIPT_ROW_MISMATCH`), corrupted state (`TREASURY_OPERATION_STATE_CORRUPTED`,
`STATE:BOGUS`), COMMITTED with all artifacts deleted (`TREASURY_ARTIFACTS_INCOMPLETE`,
no re-append), tampered audit (`AUDIT_TAMPERED`), foreign journal LineID
(`JOURNAL_LINE_CROSS_OWNER`), IN_PROGRESS artifact readback IO failure (`UNKNOWN`, later
recovery), duplicate operation rows (`TREASURY_DUPLICATE_RECEIPT_ID`).

## 18. Cache invalidation

Server-side: `runtime.invalidateCache()` (production → `invalidateDashboardCache()`, the U10F
revision bump) is invoked ONLY when the result status is `DONE` — fresh commit or COMMITTED
replay/recovery-finish. REFUSED / CONFLICT / UNKNOWN / RECOVERY_REQUIRED never invalidate
(suite H: H2–H5, H9). A cache exception is caught + logged and never converts a committed
mutation into a retryable failure (H7, M23). Committed replay may re-invalidate (H6, zero
writes). Pre-mutation failure and UNKNOWN-before-commit do not (H4/H9, M22). Hooks only — no
Finance/Transactions reader redesign; client invalidation remains a T7 responsibility.

## 19. Isolation

- **Sales immutability:** Orders, OrderLines, SalesRecognitionEvents,
  SalesRecognitionAudits, TransactionOperations snapshots byte-identical across Save (G2, M21).
- **Legacy isolation:** Payments, Settlements, tabsal, tabops, InventoryLedger, PurchaseEvents,
  Accounts, Products, ProductPricing, Logs byte-identical (G2). Source audit (G8/G9/G10):
  no `cashSettleAndPersist` / `attemptCashSettlement` / `runCashSettleAndPersist`, no
  `ReceiveVia`/`PaymentMethod`, no `Payments`/`Settlements`/`tabsal`/`tabops` tokens, no
  `canonicalDateKey(`, no `appendRow`, no `UrlFetchApp`/`clasp` in the module; refusal
  envelopes carry no `fallback`/`legacy` route (M20). Batch surfaces exactly
  `TreasuryReceipts, BalanceLedger, TreasuryAudits` (G3, M11).
- **SUCCESSFUL DELTA** (MEASURED): exactly +1 TreasuryOperations, +1 TreasuryReceipts,
  +2 BalanceLedger, +1 TreasuryAudits; ZERO delta in every other fixture surface (A3).
- **Accounting non-impact** (MEASURED, G4/G5): before → `1030 Dr 24,000 / 4000 Cr 24,000`
  (Sales recognition); after → `1030 Dr 24,000, Cr 24,000 (net 0)`, `1000 Dr +24,000`;
  sums for 4000/5000/1100/6210/2010/2000/1500 unchanged; non-treasury ledger rows untouched
  (G6). 1030 exposure reduced by exactly X = 24,000 (F9: outstanding 24,000 → 0).

## 20. Tests (focused suites, MEASURED)

| Suite | Function | Coverage |
| --- | --- | --- |
| A | `testTreasuryT4SaveCore` | exact delta +1/+1/+2/+1, journal DrDest/Cr1030, 24-col receipt, 11-col audit cross-links, plan digest, SnapshotJSON keys, ONE atomic batch (3 ranges/4 rows), cache-on-DONE, wrapper-vs-core lock, lookup-before-exposure trace |
| B | `testTreasuryT4Refusals` | date/evidence/requestKey/amount normalization, amount precedence (NOT_POSITIVE → ALREADY_CLEARED → MISMATCH), PREPARED/PAUSED/invalid config, schema gate, destination eligibility (unknown/clearing/inactive/duplicate), 1030 CashFlowGroup blank, recognition missing/non-V2/voided/integrity/lineage — each REFUSED with WRITE_COUNT 0 and unchanged sheets |
| C | `testTreasuryT4Idempotency` | exact replay (same IDs, zero rows, no exposure read, re-invalidate), conflict (amount/recognition/date variants), already-cleared new key, duplicate operation rows |
| D | `testTreasuryT4Recovery` | crash-boundary table (8 points), 20-boundary failure-injection matrix, partial/ambiguous batch fail-closed, signature tamper, corrupt plan/state, COMMITTED-artifact loss, readback IO failures, commit write/readback failures, no-blind-retry |
| E | `testTreasuryT4Concurrency` | same-exposure two keys → one clearing; stale advisory read ignored; same key one result; `IN_PROGRESS` claim → `EXPOSURE_BUSY`; one Dr/Cr pair only |
| F | `testTreasuryT4Integrity` | deterministic T3 ID derivations, full cross-link chain, exact COMMITTED readback, signature from persisted rows, forbidden-account balance proof, post-commit outstanding = 0 |
| G | `testTreasuryT4Isolation` | isolated sheet snapshots, batch surface exactness, financial non-impact sums, source audit (forbidden/required tokens), no reversal/correct writer |
| H | `testTreasuryT4Cache` | post-commit only semantics, committed-replay re-invalidate, cache-failure non-fatal, pre-mutation/UNKNOWN none |
| I | `testTreasuryT4CashFlowGroupGate` | Finance source proof + functional `buildCashFlowStatement` classification (+24,000 Operating) + blank/wrong/malformed/inactive matrix |
| J | `testTreasuryT4MutationSensitivity` | 25/25 (§21) |

Fixture architecture: in-memory sheets (`salesV2SaveFixture_`), U3 artifact builder
(`u3CommittedAppend_`) seeding one authoritative committed V2 exposure (24,000),
injected runtime (now/actor/config/batch/flush/cache/crash), no production access.

## 21. Mutation sensitivity (25/25 MEASURED, in-memory; nothing left in source)

| # | Mutation | Caught by |
| --- | --- | --- |
| M1 | remove ScriptLock | wrapper owns `waitLock(30000)`+`releaseLock`+`finally`+`LOCK_TIMEOUT`; core functions lock-free; exactly one `waitLock` in module |
| M2 | lookup-after-planning | data-read trace: `TreasuryOperations` first, exposure read after lookup |
| M3 | allow PREPARED | REFUSED `TREASURY_NOT_ACTIVATED`, 0 writes |
| M4 | allow PAUSED | REFUSED `TREASURY_MODE_PAUSED` for new writes; persisted `IN_PROGRESS` still recovers under PAUSED (T2 §5 distinction) |
| M5 | bypass schema gate | renamed header → REFUSED `TREASURY_SCHEMA_NOT_READY` |
| M6 | bypass destination eligibility | destination `4000` → REFUSED `TREASURY_INVALID_DESTINATION_ACCOUNT` |
| M7 | bypass 1030 CashFlowGroup | blank group → REFUSED, 0 batch, 0 cache |
| M8 | allow partial | partial artifacts → `RECOVERY_REQUIRED`, never DONE |
| M9 | allow second receipt | cleared exposure → `TREASURY_ALREADY_CLEARED`, receipts stay 1 |
| M10 | remove IN_PROGRESS intent | `T4_BEFORE_BATCH` crash: op row exists with zero business artifacts |
| M11 | split atomic mutation | ONE batch call, exactly 3 surfaces / 4 rows |
| M12 | skip receipt readback | deleted receipt row → replay `RECOVERY_REQUIRED` |
| M13 | skip signature | tampered signature cell → `TREASURY_JOURNAL_SIGNATURE_INVALID` |
| M14 | skip audit verification | tampered audit → `AUDIT_TAMPERED` fail-closed |
| M15 | DONE before COMMITTED | DONE implies persisted `State = COMMITTED` + source order commit-before-DONE |
| M16 | replay append | replay `writeCount 0`, zero applied rows, counts unchanged |
| M17 | new-key double clear | `TREASURY_ALREADY_CLEARED`, 1 op / 1 receipt |
| M18 | stale outstanding under concurrency | advisory 24,000 reused after commit → refused |
| M19 | write 4000 not 1030 | plan verify `JOURNAL_ACCOUNT_MAPPING_MISMATCH`; persisted tamper → replay `JOURNAL_TAMPERED` |
| M20 | legacy Settlement path | no legacy tokens in source; no `fallback`/`legacy` field on refusals |
| M21 | mutate SalesRecognitionEvent | Sales artifact snapshots byte-identical after Save |
| M22 | invalidate before commit | UNKNOWN result → cache calls 0 |
| M23 | cache-failure → retryable | cache throws → status still `DONE` (write 4) |
| M24 | host-local date | `now = 2026-09-30T17:00:00Z`, `receiptDate 2026-10-01` → plan `economicDate`/`ReceiptDate` = `2026-10-01`; source free of `canonicalDateKey(`/`getMonth(` |
| M25 | blank EvidenceRef | REFUSED `TREASURY_EVIDENCE_REF_INVALID`, 0 writes |

## 22. Regression

MEASURED full `node _test_runner.js` after the final source modification:

- Run 1 (first integration): 117 PASS, 4 FAIL (missing `CONTRACT_VERSION_MISMATCH` CODES
  reference, missing `T4_BEFORE_BATCH` crash hook, invalid test requestKey length, over-strict
  M1 source token).
- One repair cycle (4 fixes, no invariant weakened).
- **Final run: 121 PASS, 0 FAIL** (baseline 111 + 10 new T4 functions).
- `node --check` clean: `99A.Treasury.Receipt.Durable.Save.js`,
  `96.Tests.Treasury.Receipt.Durable.Save.Cases.js`, `_test_runner.js`.
- `git diff --check` clean; `git status --short`: 1 modified (`_test_runner.js`) + untracked
  `99A…`, `96.Tests…`, this doc + the original 27 `tests/tmp/u10e-*` (untouched).

## 23. Package impact (`.claspignore` allowlist)

- `.claspignore` NOT modified (outside authorized files). Current allowlist: 68 `!` includes
  plus the `**` ignore; `tests/`, `docs/`, `tests/tmp/`, `_test_runner.js`, and both new T4
  files are excluded today → deployed package unchanged by this task.
- Expected future runtime package count at the (separately authorized) push gate: **70** =
  68 current includes + `!99.Treasury.Receipt.Foundation.js` (T3's planned 69) + `!99A.
  Treasury.Receipt.Durable.Save.js`. Upload-manifest gate per AGENTS.md applies; no deployment
  alteration here.
- No secrets, credentials, or production identifiers in any new file.

## 24. Production safety

- Production writes = 0; deployment actions = 0; `clasp push`/deploy/version = 0; Git
  push/stage/commit = 0; production schema creation = 0; migration/backfill = 0; config
  property writes = 0. Production read: not attempted (none required by local fixtures).
- The only production-reachable entrypoints added (`treasuryReceiptDurableSave`,
  `treasuryReceiptSaveRuntime_`, `treasuryReceiptBatchRequest_`) were NOT invoked: tests use
  the injected runtime exclusively. No Receipt/Operation/Audit/BalanceLedger/Cash-Bank/1030
  clearing/Sale/Payment-Settlement/Correct-Void/refund-2010/AP-Purchase/Accounts mutation of
  production exists or ran. Blocking statuses (`BLOCKED_ACCOUNT_AUTHORITY`,
  `BLOCKED_ACCOUNTING_CONTRACT`, `BLOCKED_ATOMICITY`, `BLOCKED_1030_AUTHORITY`,
  `BLOCKED_SALES_AUTHORITY`, `BLOCKED_CONTRACT_CONFLICT`): not triggered — the single
  batchUpdate primitive exists (43/97A precedent), U3 consumption is read-only and safe, 1030
  semantics agree with the journal model, and no frozen-contract contradiction materialized.
- Commit policy: Heavy cannot `git add`/`commit` (`BLOCKED_PERMISSION`, T1–T3 precedent) — no
  commit attempted; changed paths + suggested title handed to downstream numlock-commit.

## 25. T5/T6 deferred boundaries

- **T5 (deferred):** canonical 1030 per-exposure projection + global reconciliation report.
  T4 implements only the minimum in-lock resolver needed for safe Save (active committed
  clearings for ONE exposure, fail-closed); it never writes projection state and never claims
  global reconciliation.
- **T6 (deferred):** reversal + correction writers. The plan/journal/inspect code stays
  T6-compatible (reversal-shaped rows are classified and target-validated in the outstanding
  view; `original` lineage columns exist and are write-empty), but no reversal/correction
  operation type, writer, or UI exists in T4.
- **T7+ (deferred):** operator UI, client invalidation hooks, activation (`TRACT-` writer),
  production schema creation for the three Treasury sheets, release-integration gates (T9),
  first genuine receipt acceptance (T10).

---

*Telemetry: agent numlock-explore-free (Free execution authority for this Heavy L3/R2 task);
backend `9router/numlock-explore-free`; reasoning high; fallback used none (no escalation —
no named `ESCALATION_REASON` materialized); toolcalls UNKNOWN (not instrumented); elapsed
UNKNOWN (not instrumented); files read ~20 (T2/T3 docs, T3 foundation, 97A, 97B, 95A, 20, 36,
39, 40, 43, 97, U2/U3/T3 test cases, `_test_runner.js`, .claspignore, 21/22/38 excerpts);
files modified 4 (`99A.Treasury.Receipt.Durable.Save.js` new,
`96.Tests.Treasury.Receipt.Durable.Save.Cases.js` new, `_test_runner.js` registration,
`docs/TREASURY-T4-DURABLE-RECEIPT-CORE.md` new); test runs: 3 full `node _test_runner.js`
(run 1: 117 PASS / 4 FAIL → 1 repair cycle → final MEASURED 121 PASS / 0 FAIL).*
