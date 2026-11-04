# Treasury T6 — Receipt Reversal and Correction

**Phase:** NUMLOCK_TREASURY_ARCHITECTURE_AND_RECONCILIATION_DESIGN
**Task:** T6_TREASURY_RECEIPT_REVERSAL_AND_CORRECTION
**Classification:** COMPLEXITY L3 · OPERATIONAL_RISK R2 · REASONING_EFFORT high
**Scope:** LOCAL ONLY. Durable APPEND-ONLY receipt reversal and financial
correction on the T3–T5 foundation including the Sol foundation fix. Zero
production writes, zero deployment actions, zero `clasp` execution, zero UI.
**Evidence classes:** MEASURED = executed this session; SOURCE = repository
source at HEAD `8bb0097` baseline. Baseline regression 132 PASS / 0 FAIL
MEASURED; final regression 141 PASS / 0 FAIL MEASURED (`node _test_runner.js`).

---

## 1. Baseline

- Baseline HEAD `8bb0097` verified (`git rev-parse`), ancestry
  0b2f05d T1 → 360c95d T2 → a6f0075 T3 → 67a4818 T4 → 04c2149 T5 → `8bb0097`
  foundation fix. Tracked worktree clean, index clean, `git diff --check`
  clean, exactly 27 untracked `tests/tmp/u10e-*` files untouched.
- Full regression baseline **132 PASS / 0 FAIL** MEASURED before any T6 edit.
- Authoritative inputs re-read this session: T2 §9/§12/§13/§15/§16/§17/§18/
  §24; post-fix `99.Treasury.Receipt.Foundation.js`,
  `99A.Treasury.Receipt.Durable.Save.js`, `99B.Treasury.Clearing.Projection.js`
  (foundation fix diff `04c2149..8bb0097` inspected: context machinery in 99A,
  op-audit coverage in 99B).

## 2. Source changes

| Path | Change |
| --- | --- |
| `99C.Treasury.Receipt.Reversal.Correction.js` | NEW — T6 lifecycle runtime module (~2.05k lines) |
| `96.Tests.Treasury.Receipt.Lifecycle.Cases.js` | NEW — suites A–H + injection + 30-point sensitivity |
| `_test_runner.js` | Registered `99C` module load, `_treasuryLifecycleSource` injection, 9 T6 test runs |
| `docs/TREASURY-T6-RECEIPT-REVERSAL-AND-CORRECTION.md` | NEW — this document |

No other file modified. `99A`/`99B` are byte-identical to baseline (reused,
never forked). `tests/tmp/u10e-*` untouched.

## 3. Reversal authority (T2 §12)

- Eligibility fail-closed, re-validated inside the lock immediately before
  plan freeze: target receipt exists and is unique (`TREASURY_TARGET_NOT_FOUND`);
  target `ReceiptType == SALES_RECEIPT` (`TREASURY_TARGET_NOT_RECEIPT` — a
  reversal row can never itself be reversed: reversal-of-reversal does not
  exist); producing operation exists, matches lineage, and is `COMMITTED`
  (`IN_PROGRESS` original ⇒ `TREASURY_EXPOSURE_BUSY`); original journal
  verifies (2 source-keyed lines, balanced, signature recomputed) and audit
  verifies (direct or op-audit coverage) else `TREASURY_EXPOSURE_EXCEPTION`;
  no committed reversal of the target (`TREASURY_ALREADY_REVERSED`); no
  IN_PROGRESS foreign lineage claim (`TREASURY_REVERSAL_TARGET_CLAIMED`);
  Sales exposure integrity-valid and not voided (T4 codes reused);
  Treasury state interpretable (T4 `treasuryComputeOutstanding_` reuse, incl.
  foreign IN_PROGRESS ⇒ `TREASURY_EXPOSURE_BUSY`); original destination still
  eligible + 1030 preflight (T3 codes reused).
- Request carries operator facts ONLY: `requestKey`, `treasuryReceiptID`,
  `reason`, `actor`. Server derives destination, amount, dates, IDs, journal,
  evidence anchor, context.
- `reason` required, trimmed 3–200 chars, no control characters, no
  card-digit sequences, no secret patterns (`TREASURY_REASON_REQUIRED`).
- Reversal evidence anchor is server-derived:
  `EvidenceRef = "REVERSAL:" + targetReceiptID` (deterministic, non-secret).

## 4. Correction authority (T2 §13)

- ONE operation `TREASURY_RECEIPT_CORRECT`, ONE immutable plan, ONE atomic
  batch: +2 receipts (reversal + replacement), +4 ledger lines (2 journals),
  +1 audit, +1 operation. Never split, never delta-only, never
  replacement-without-reversal (plan shape enforces both receipts + 4 lines).
- Request facts: `requestKey`, `treasuryReceiptID`, corrected
  `destinationAccountCode`, corrected `receiptDate`, `evidenceType`
  (literal `MANUAL_VERIFIED`), corrected `evidenceRef`, `reason`, `actor`.
- Amount = full eligible exposure: the replacement must clear the
  POST-REVERSAL outstanding exactly (`outstanding + amount == amount`); any
  exposure change fails closed with `TREASURY_AMOUNT_MISMATCH`
  (`POST_REVERSAL_OUTSTANDING:<n>` detail) or the T4 exposure exception class
  (duplicate active receipts etc.). No partial, no tolerance.
- Evidence-only change is still a full append-only correction (T2 froze no
  annotation authority). A correction of an already-reversed original is
  refused (`TREASURY_ALREADY_REVERSED`) — restoring clearing after a
  standalone reversal is a NEW receipt (T4 post-reversal Save), never a
  second reversal.

## 5. Immutable lineage

- Original receipt rows are IMMUTABLE: no update/delete primitive against
  receipt rows exists in `99C` (source-audited). Lineage travels on appended
  rows: reversal row `ReversalOfReceiptID = target` (+ `ReplacementReceiptID`
  on correction); replacement row `OriginalReceiptID = target`.
- The full 24-column digest of the original row is frozen into the plan as
  `targetReceiptHash` and re-hashed at every inspect/resume: any drift ⇒
  `TREASURY_ORIGINAL_IMMUTABLE` fail-closed; missing original row ⇒
  `ORIGINAL_TARGET_MISSING` conflict. Original dates never rewritten.

## 6. Request contracts

- REVERSE: `{ requestKey, treasuryReceiptID, reason, actor }`.
- CORRECT: `{ requestKey, treasuryReceiptID, destinationAccountCode,
  receiptDate, evidenceType, evidenceRef, reason, actor }`.
- `requestKey` pattern `[A-Za-z0-9][A-Za-z0-9._:-]{3,127}`;
  `treasuryReceiptID` pattern `^TRC-[A-Za-z0-9-]{3,127}$`.
- `payloadHash = transactionPayloadHash_(normalized)` over operator facts
  only; same-key/different-payload ⇒ `TREASURY_REQUEST_KEY_CONFLICT`.

## 7. Date authority (T2 §9)

- Reversal `ReceiptDate = EconomicDate = treasuryDateKey(runtime.now())` —
  the server action day normalized to Asia/Jakarta via
  `Utilities.formatDate(instant, "Asia/Jakarta", "yyyy-MM-dd")`. NO operator
  ReversalDate input exists on any path. `canonicalDateKey`/host-local getters
  are forbidden and source-audited.
- A correction's replacement receipt carries an operator `ReceiptDate`
  (validated calendar string); `EconomicDate = ReceiptDate` byte-equal.
- Original receipt dates are never rewritten (byte-identity proven).
- Local tests execute every writer call under a temporary Jakarta-true
  `Utilities.formatDate` stand-in (UTC+7) with argument capture; the harness
  stub is restored in `finally`.

## 8. Journals (T2 §8.1)

- Reversal journal: exactly `Dr 1030 X / Cr <original destination> X`,
  `MovementType TREASURY_RECEIPT_REVERSAL`, `SourceType TREASURY_RECEIPT_V1`,
  `SourceID = reversal receipt id`, `ExternalRef = RecognitionID`, `Tanggal =
  reversal EconomicDate`. New JournalID per side; signature recomputed from
  the reversed-leg rows (≠ original signature — proven) via the T3
  `treasuryJournalSignature`.
- Replacement journal: ordinary shape `Dr <corrected destination> X / Cr 1030 X`,
  `MovementType TREASURY_RECEIPT`, replacement's own economic date.
- Forbidden accounts structurally impossible: every pair is exactly
  {destination, 1030}; plan verification rejects any other account
  (`JOURNAL_ACCOUNT_MAPPING_MISMATCH` / `JOURNAL_FORBIDDEN_ACCOUNT`); a
  tampered persisted leg fails replay (`JOURNAL_TAMPERED`).
- Revenue (4000), HPP (5000/1100), AP (2000), refund payable, expense (6210),
  and Inventory are untouched (ledger-sum isolation proven in suite G).

## 9. Operation plans

- Immutable `OperationPlan` frozen once before the intent write, digest-
  covered (`planDigest`), verified at freeze and on every resume. Shapes:
  REVERSE = 1 receipt row / 2 journal rows / 1 audit; CORRECT = 2 receipt
  rows / 4 journal rows / 1 audit.
- Frozen T6 plan-shape requirement honored exactly: lifecycle plans always
  carry `plannedReceiptIds`, `plannedAuditIds`, `receiptRows`, plus
  `contextReceiptIds`/`contextAuditIds` (+ hashes) from the T4
  `treasuryReceiptFrozenContext_` sibling freeze. A lifecycle plan missing
  context is malformed (`CONTEXT_MISSING`, fail-closed at verify and resume).
- Plan fields include target identity (`targetReceiptID`, `targetReceiptHash`),
  per-receipt `journalSignatures`, `originalDestination` (CORRECT),
  `reversalDate`, `replacementDate`, lineage ids, config identity, normalized
  payload. Verifier re-derives all four identities from
  (OperationType, RequestKey, side) via the T3 helpers.

## 10. Atomicity

- ONE `spreadsheets.batchUpdate` (appendCells) per operation, reusing the T4
  sanitized transport (`treasuryReceiptBatchRequest_`, identical write
  surfaces `TreasuryReceipts / BalanceLedger / TreasuryAudits`). REVERSE
  batch = 3 subrequests / 4 rows; CORRECT = 3 subrequests / 7 rows.
  All or none; the batch is the only atomic boundary (T2 §16).
- Durable sequence mirrors T4: RequestKey-first lookup → resume or new
  intent → mode gate → lifecycle gates → freeze plan → IN_PROGRESS intent
  append + exact ten-field readback → batch → exact multi-artifact inspect +
  per-receipt signature recomputation → `COMMITTED` + exact readback → DONE.
- Crash hooks `T6_BEFORE_INTENT / T6_AFTER_INTENT_PERSIST / T6_AFTER_INTENT /
  T6_BEFORE_BATCH / T6_AFTER_BATCH / T6_AFTER_READBACK / T6_BEFORE_COMMIT /
  T6_AFTER_COMMIT` cover every durability boundary.

## 11. Audit N = 1 (T2 §17)

- Exactly ONE `TreasuryAudits` row per operation. REVERSE audit keys the
  reversal receipt id; CORRECT audit keys the REPLACEMENT receipt id and its
  journal (T2 §4.3; the reversal id travels in the plan and the reversal row).
- The correction's second receipt is covered at read time by the T5 generic
  op-audit fallback (`treasuryClearingOperationAuditCovers_`: exact op
  ownership + `plannedReceiptIds` membership + byte-exact planned audit) —
  no T6 special-case exists in T5.

## 12. Snapshots (T2 §18 class)

- Reversal snapshot: contract/config identity, operation type, side
  `REVERSAL`, exposure lineage + recognized/outstanding amounts, original
  destination/amount, action-day dates, evidence anchor, journal id,
  `targetReceiptID`, reason, and the frozen `original` part
  (receipt id, journal id, journal signature, dates, amount, destination,
  full row hash). CORRECT's reversal snapshot adds `replacementReceiptID`.
- Replacement snapshot: same base with side `REPLACEMENT`, corrected
  destination/date/evidence, plus `originalReceiptID` + `reversalReceiptID`
  (+ the `original` part). No HPP/recipe/product/cost/payment/settlement
  fields (source + key-set audited). Snapshots frozen with the plan and
  verified against plan + rows at every verify/resume.

## 13. Recovery (T2 §15)

- Intent-only → the frozen plan executes exactly once (fresh write count).
- Batch applied, COMMITTED lost → exact artifacts + signatures verify ⇒
  finalize COMMITTED ⇒ DONE (replay).
- Lost callback post-COMMITTED → same RequestKey ⇒ exact DONE, zero writes.
- Ambiguous batch (throw before apply) → `UNKNOWN`/`TREASURY_BATCH_OUTCOME_UNKNOWN`
  with identity preserved; no autonomous retry inside the call.
- Partial or conflicting artifacts → `RECOVERY_REQUIRED`
  (`TREASURY_ARTIFACTS_INCOMPLETE` / `TREASURY_RECOVERY_REQUIRED` /
  `TREASURY_ORIGINAL_IMMUTABLE`), fail closed, never blind-append.
- Corrupt plan/State → `TREASURY_OPERATION_PLAN_MALFORMED` /
  `TREASURY_OPERATION_STATE_CORRUPTED`.
- PAUSED/PREPARED never block recovery of a persisted IN_PROGRESS operation
  (T2 §5); they refuse only NEW intents (`TREASURY_MODE_PAUSED` /
  `TREASURY_NOT_ACTIVATED`).

## 14. Concurrency

- One outer `ScriptLock` per public wrapper
  (`treasuryReceiptDurableReverse` / `treasuryReceiptDurableCorrect`),
  `waitLock(30000)` + `releaseLock` in `finally`; cores never lock (exactly
  two lock sites source-audited).
- Lineage claims re-evaluated inside the lock: rev×rev, corr×corr, rev×corr
  (both orders) → exactly one owner; losers get the deterministic frozen
  codes (`TREASURY_ALREADY_REVERSED` after commit,
  `TREASURY_REVERSAL_TARGET_CLAIMED` / `TREASURY_REPLACEMENT_TARGET_CLAIMED`
  against an IN_PROGRESS claim). Claim scan reads persisted operation plans
  + receipt lineage, never advisory memory.
- New-receipt×reversal: post-reversal Save with a NEW key clears the restored
  outstanding (sanctioned restore path); stale amounts are re-read in-lock
  (T4 `treasuryComputeOutstanding_` reuse) so no stale eligibility survives.
- Sales state change between advisory read and execution → in-lock re-read
  refuses (`TREASURY_RECOGNITION_INACTIVE`).

## 15. T5 integration

- T5 remains the canonical read side; `99B` is byte-identical to baseline.
  T6 artifacts flow through the GENERIC T5 semantics prepared by the
  foundation fix (op-audit coverage + DUPLICATE_ACTIVE non-counting of
  reversed originals + one-reversal-max conflict).
- MEASURED status effects on the 24k chain: Save → `CLEARED`; Reversal →
  `UNCLEARED` (outstanding restored 24000, ReversalAmount 24000, zero quality
  codes); correction → `CLEARED` with `ActiveReceiptID = replacement`,
  `DestinationAccountCode = 1010`; healthy `unexplainedResidual == 0` and
  `reconciliationStatus == OK` at every stage; T4/T5 parity holds after both
  operations; ledger net-1030 tracks business outstanding (0 before reversal
  as-of, 24000 after; 0 net across the correction's 48000 Dr / 48000 Cr).

## 16. As-of

- MEASURED through the same canonical reader: sale day (UNCLEARED 24000) →
  receipt day (CLEARED) → later reversal day (UNCLEARED again); month-end
  before/after a Jakarta-boundary reversal (UTC 17:30 ⇒ Jakarta next day:
  reversal dated 2026-11-01, as-of 2026-10-31 stays CLEARED, as-of
  2026-11-01 flips UNCLEARED, residual 0 both sides); cross-period
  replacement (replacement dated next month: as-of before the replacement
  date sees reversal only ⇒ UNCLEARED; after ⇒ CLEARED); historical as-of
  reconstructs the original CLEARED state after the full chain.

## 17. Sales interaction

- Sales Void/Correct does NOT auto-mutate Treasury and vice versa: Treasury
  lifecycle operations never write Sales artifacts (sheet snapshots
  byte-identical across reversal and correction; no Sales writer symbol in
  the module source). A Sales void landing before the lifecycle call makes
  the in-lock exposure re-read refuse (`TREASURY_RECOGNITION_INACTIVE`) —
  the operator must act explicitly.

## 18. Refund boundary

- Reversal is `Dr1030 / Cr destination` — it restores exposure and never
  touches the refund-payable account, never issues money back. No refund or
  credit-transfer movement type, account literal, or code path exists in the
  module (source-audited: no refund vocabulary, no refund-payable account
  literal). Refund/credit remains a future frozen authority outside V1.

## 19. Cache

- Post-commit freshness (U10F pattern): ONLY a DONE result (fresh commit or
  COMMITTED replay) bumps the shared dashboard cache revision via
  best-effort `invalidateDashboardCache()`; refusals, conflicts, UNKNOWN,
  and RECOVERY_REQUIRED never touch the cache; a cache failure never
  converts a committed DONE into a retryable failure (all MEASURED in H18).

## 20. Exact deltas (T2 §17)

- `TREASURY_RECEIPT_REVERSE` fresh: +1 operation row (IN_PROGRESS →
  COMMITTED), +1 reversal receipt row, +2 BalanceLedger lines, +1 audit row
  — writeCount 4, one batch, three surfaces. NOTHING else.
- `TREASURY_RECEIPT_CORRECT` fresh: +1 operation row, +2 receipt rows,
  +4 ledger lines, +1 audit row — writeCount 7, one batch, three surfaces.
- Replays and COMMITTED recoveries append zero rows.
- Never mutated: Payments, Settlements, Orders, OrderLines,
  SalesRecognitionEvents, SalesRecognitionAudits, TransactionOperations,
  InventoryLedger, PurchaseEvents, tabsal, tabops, Logs, Accounts, Products,
  any existing journal line, any config/account/schema/header.

## 21. Failure injection (20 boundaries, MEASURED in suite D)

| # | Boundary | Measured outcome |
| --- | --- | --- |
| FI1 | Config invalid | REFUSED `TREASURY_CONFIG_INVALID`, zero writes |
| FI2 | RequestKey conflict | CONFLICT `TREASURY_REQUEST_KEY_CONFLICT`, state unchanged |
| FI3 | Original missing | REFUSED `TREASURY_TARGET_NOT_FOUND`, zero writes |
| FI4 | Original integrity invalid | REFUSED `TREASURY_EXPOSURE_EXCEPTION` (`ORIGINAL_SIGNATURE_MISMATCH`) |
| FI5 | T5 EXCEPTION state (duplicate actives) | REFUSED `TREASURY_EXPOSURE_EXCEPTION` |
| FI6 | Already reversed | REFUSED `TREASURY_ALREADY_REVERSED` |
| FI7 | Foreign IN_PROGRESS claim | REFUSED `TREASURY_REVERSAL_TARGET_CLAIMED` / `TREASURY_REPLACEMENT_TARGET_CLAIMED`; owner recovers once |
| FI8–FI15 | Crash at all 8 durability boundaries | identity preserved; same-key resume → DONE exactly once (fresh or replay per boundary) |
| FI8b | Intent readback mismatch | RECOVERY_REQUIRED `TREASURY_INTENT_READBACK_FAILED`, then recovery |
| FI9 | Ambiguous batch (throw-before-apply) | UNKNOWN `TREASURY_BATCH_OUTCOME_UNKNOWN`, no in-call retry; resume executes once |
| FI10 | Persisted-before-readback (crash after intent persist) | IN_PROGRESS row, zero artifacts; resume → DONE fresh |
| FI11 | Lost callback (apply-then-throw) | readback authority → COMMITTED → DONE |
| FI12 | Partial batch (reversal + correction) | RECOVERY_REQUIRED `TREASURY_ARTIFACTS_INCOMPLETE`; replay never appends |
| FI13 | Audit mismatch (tampered persisted audit) | RECOVERY_REQUIRED, `AUDIT_TAMPERED` detail |
| FI14 | Commit write failure | UNKNOWN `TREASURY_SAVE_EXECUTION_UNKNOWN`; replay finalizes |
| FI15 | COMMITTED with artifacts deleted | RECOVERY_REQUIRED fail-closed, no re-append |
| FI16 | Concurrent mutation post-freeze | RECOVERY_REQUIRED `RECOGNITION_DUPLICATE_RECEIPT`, zero new writes |
| FI17 | Sales state change pre-reread | REFUSED `TREASURY_RECOGNITION_INACTIVE` |
| FI18 | PAUSED new-vs-recovery | NEW refused `TREASURY_MODE_PAUSED`; persisted recovery completes DONE under PAUSED |
| FI19 | Cache failure | DONE preserved (non-fatal) |
| FI20 | Replacement signature tamper | RECOVERY_REQUIRED `TREASURY_JOURNAL_SIGNATURE_INVALID` |

No impossible partial-batch transport state was fabricated; ambiguity is
simulated only at the response boundary.

## 22. Mutation sensitivity (30/30, MEASURED in suite M)

All 30 listed defect classes are caught (in-memory tampering only, reverted
by fixture scope, none left in source): mutate original →
`TREASURY_ORIGINAL_IMMUTABLE`; delete original → fail-closed replay;
reversed journal direction → plan verify + persisted checks; 4000/2010 legs →
plan verify + replay tamper detection; double reversal → one row only;
in-place correction impossible (byte-identity + no update/delete primitive);
replacement-without-reversal → `CORRECT_SHAPE_MISMATCH`; non-atomic
correction impossible (ONE 3-range batch); partial correction fail-closed;
late RequestKey → CONFLICT; PAUSED new refused; PAUSED recovery allowed;
ScriptLock sites = 2 (cores none); stale claim scan refused;
concurrent-both-succeed impossible; journal readback enforced; original
signature reuse caught; audit verify enforced; DONE implies COMMITTED
(order-proven); callback-loss replays append zero rows (both kinds); T5 flips
UNCLEARED after reversal; CLEARED after correction; residual 0 exposed;
Asia/Jakarta date at UTC boundary (no host-local helpers); original dates
byte-stable; Sales never auto-mutated; no refund path; cache never touched
before commit.

## 23. Regression (MEASURED)

- Focused: all T3 (10), T4 (11), T5 (10) suites re-ran PASS; new T6 suites
  A–H + sensitivity (9) PASS.
- Full `node _test_runner.js`: **141 PASS / 0 FAIL** (baseline 132 + 9 new
  T6 suites; zero regressions). MEASURED after final source modification.
- `node --check` clean on `99C.Treasury.Receipt.Reversal.Correction.js`,
  `96.Tests.Treasury.Receipt.Lifecycle.Cases.js`, `_test_runner.js`.
- `git diff --check` clean; final `git status --short` audited (only the four
  T6 paths changed/added; 27 `u10e-*` untouched).

## 24. Package impact (`.claspignore` allowlist)

- `.claspignore` NOT modified (outside authorized files). Current allowlist:
  **68** `!` includes plus the `**` ignore — unchanged by T6 (the foundation
  fix landed without any new module and without allowlist changes).
- A future separately-authorized push of the Treasury stack would add
  `!99…` (69), `!99A…` (70), `!99B…` (71), `!99C…` (72) — the T6 module makes
  the allowlist **72** when that gate is authorized. `tests/`, `docs/`,
  `_test_runner.js` remain excluded. Upload-manifest gate per AGENTS.md
  applies; no deployment is implied or attempted.

## 25. Production safety

- Zero production mutations, zero `clasp` execution, zero deployment
  actions, zero Git mutations this task. Production wrappers
  (`treasuryReceiptDurableReverse` / `treasuryReceiptDurableCorrect`) exist
  but were never invoked locally (fixture runtimes only). No credential
  inspection. Reversal/correction remain unreachable in production until a
  separately authorized activation + UI task (T7/T10). `clasp push` remains
  R4/Critical and untouched.

---

## Acceptance summary (31 criteria → COMPLETE_LOCAL)

Baseline verified; scope kept to 4 paths; frozen T2 semantics honored
(reversal date = server action day, audit N=1, ONE-atomic-batch correction,
originals immutable, no reversal-of-reversal, no refund, no annotation);
T5 generic flow-through proven; 20-boundary injection + 30/30 mutation
sensitivity MEASURED; full regression 141/0 MEASURED; package impact stated;
production safety intact. No accounting semantics weakened.

*Local evidence this session: `node _test_runner.js` → 141 PASS / 0 FAIL;
`node --check` clean on all changed JS; `git diff --check` clean.*
