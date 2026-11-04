# T11.8 / U6 — Corrections, Void, Cancel (LOCAL / INERT ONLY)

STATUS: LOCAL IMPLEMENTATION COMPLETE · MEASURED GREEN · ZERO PRODUCTION MUTATION
TASK_ID: T11_8_U6_CORRECTIONS_VOID_CANCEL
PHASE: NUMLOCK_SINGLE_COMMIT_TRANSACTION_ARCHITECTURE (U1–U6 complete)
BASELINE_COMMIT: `d95dbd1` (T11.7/U5, verified `git rev-parse` this session)
CLASSIFICATION: L3 · R1 · REASONING_EFFORT high · Execution CONTINUE
AUTHORITIES: T11.2 §10 + D14 · T11.4 §16 · T11.5 §26 · T11.7 §3/§5 · U1–U5 docs
OPEN_OWNER_DECISIONS: **NONE** (§14 resolves the PAUSED-admission question from
existing frozen governance; no M-item required)

---

## 1. Status and baseline

- Baseline verified before edits: HEAD `d95dbd1`, worktree clean (only
  untracked `tests/tmp/` artifacts), `git diff --check` clean, 33×u10e temp
  files untouched, baseline harness **216 PASS / 0 FAIL** (MEASURED).
- Final harness after this unit: **227 PASS / 0 FAIL** (MEASURED,
  `node _test_runner.js` on final source) — 216 baseline suites + 11 new
  U6 suites, no baseline suite changed in result.
- This unit is local implementation + local tests only. No `clasp`, no
  push/pull/deploy, no PropertiesService/config mutation, no production
  spreadsheet access, no Git mutation. Mutations = 0 (§27).

## 2. Scope

Prospective T11 lifecycle for genuine operator correction of Sales /
Expense / Purchase: ORIGINAL IMMUTABLE + APPEND-ONLY REVERSAL + OPTIONAL
REPLACEMENT. One operator action → one durable intent → one outer lock →
ONE immutable plan → ONE atomic batch. No Treasury/payment workflow, no
automatic 2010, no historical rewrite, no second financial action after
the correction Save.

## 3. Lifecycle audit — BEFORE → AFTER (6 rows)

| # | Surface | BEFORE `d95dbd1` | AFTER (this unit) |
| --- | --- | --- | --- |
| 1 | Sales Void | `SALES_V2_VOID` append-only recognition reversal Dr4000/Cr1030 only; composed sale money leg (U1) never reversed | same + money reversal **Dr1030/Cr1040**, JournalID `SRV2MV-<OrderID>` (U1 bootstrap lineage), SourceType `SALES_MONEY_V2`, SourceID = void recognitionID, MovementType `SALES_MONEY`, inside the SAME plan/batch (writeCount 4→6) |
| 2 | Sales Correct | reversal + replacement recognition only (Dr1030/Cr4000) | + money reversal (as Void) + replacement money leg `SRV2M-<newOrderID>` Dr1040/Cr1030 bound to replacement recognition, same ONE plan/batch (writeCount 13+N) |
| 3 | Expense cancel/correct | no T11 path; legacy `voidCanonicalTransaction`/`correctCanonicalTransaction` did in-place business-row edits with NO ledger reversal; UI routed all `OPS-*` there | new `EXPENSE_SINGLE_COMMIT_VOID` / `EXPENSE_SINGLE_COMMIT_CORRECT` durable cores (ONE batch each); legacy endpoints now refuse the cohort (`SINGLE_COMMIT_COHORT_ROUTED`); detail carries `singleCommit` cohort flag; UI routes T11 rows to `expenseSingleCommitDurableVoid/Correct` |
| 4 | Purchase cancel/correct | legacy `voidPurchaseEvent`/`correctPurchaseEvent`: multi-step in-place lifecycle, NO Policy C reversal (finance-phase-13 gap) | new `PURCHASE_EVENT_VOID` / `PURCHASE_EVENT_CORRECT` durable cores (ONE batch each, `POLICY_C_REVERSAL` pair + corr- replacement); legacy endpoints refuse the cohort; projection exposes `singleCommit`; UI routes T11 rows to `purchaseEventDurableVoid/Correct` |
| 5 | RequestKey namespaces | SAVE + `SALES_V2_VOID/CORRECT` | + `EXPENSE_SINGLE_COMMIT_VOID/CORRECT`, `PURCHASE_EVENT_VOID/CORRECT` (disjoint OperationTypes → disjoint OperationIDs, GR106) |
| 6 | Readers | U4 §12–§15 + T5 pre-wired for U6 money reversals (99B:177-178) | unchanged; verified live by RP88–RP94 (Cash Flow once, Revenue, T5 residual 0, aggregate) |

## 4. Universal invariants (implemented)

- No in-place edit of BalanceLedger / SalesRecognitionEvent / PurchaseEvent
  financial truth / tabops accounting content / journals. Original business
  rows keep every content field byte-identical (verified: SV6, SC19, EK40,
  EK42, PC50, PK60, HS100); the ONLY original-row delta is the canonical
  lifecycle marker (tabops `IsActive/UpdatedAt/UpdatedBy`;
  PurchaseEvents `Lifecycle/IsActive`) written inside the same atomic batch
  per T11.4 §16 / T11.5 §26 (PAID/1040/POSTED and all financial truth stay
  frozen — PC50/PK60).
- Void/Cancel = append reversal. Correct = append FULL reversal + append
  replacement with own deterministic identity + linked lineage (Logs
  `originalId`/`replacementId`, `ExternalRef` = original JournalID,
  `OriginalID`/`ReversalOfRecognitionID`/`ReplacementID` event lineage).

## 5. Sales Void contract

`Dr1030 X / Cr1040 X`, identity `SRV2MV-<OrderID>` =
`transactionStableBootstrapId_("SRV2MV-", [OrderID])` (U1 lineage pattern),
bound to the reversal recognitionID so U4/T5 group it as its own clearing
group; recognition reversal stays Dr4000/Cr1030 (existing U6 authority).
Net lifetime after Void = 0 for Revenue/1030/1040 (SV5). Recognition-only
targets (no persisted money leg) keep the exact legacy 4-row void (SV11).
No Treasury receipt reversal, no automatic 2010, external refund stays a
separate business action. Evidence: SV1–SV13.

## 6. Sales Correct contract

Full reversal (recognition + money of the ORIGINAL X) + complete replacement
recognition + replacement money `SRV2M-<newOrderID>` Dr1040/Cr1030 of Y —
never delta-only, never partial (SC16/SC17). Final lifetime =
Dr1040 Y / Cr4000 Y, 1030 net 0. U3 signed-event semantics unchanged; the
original stays immutable; replacement money uses 1040. Money legs appear
only when the target carries persisted composed-money lineage
(`target.composedMoney` evidence, not config inference). Evidence: SC14–SC26.

## 7. Expense Cancel contract

Operation `EXPENSE_SINGLE_COMMIT_VOID`; mirror journal
`Dr1040 X / Cr <original expense acct>`, JournalID `EXPJV-<ID_Trx>`,
same MovementType `EXPENSE_SINGLE_COMMIT` / SourceType
`EXPENSE_SINGLE_COMMIT_V1` / SourceID `ID_Trx` (U2/T11.2 lineage),
`ExternalRef` = original `EXPJ-<ID_Trx>`, ACTION-period date (EC29).
Original tabops content immutable; the cancel marker is the append-only
Logs event authority (`VOID_EXPENSE_SINGLE_COMMIT`, Module
`TransactionLifecycle`, metadata {reason, requestKey, operationID,
reversalJournalID, singleCommit}) plus the committed operation plan
(EC30/EC31). No legacy settlement, no TreasuryReceipt/EvidenceRef/
PaymentMethod, no 2010/2000 (HS96/HS97). Lifetime nets return to the
pre-save baseline (EC32).

## 8. Expense Correct contract

Operation `EXPENSE_SINGLE_COMMIT_CORRECT` = full reversal (as cancel) +
complete replacement single-commit Expense (deterministic
`OPS-APP-` identity from (OperationType, RequestKey), own `EXPJ-` journal
Dr expense / Cr1040, replacement may change item/category/amount/date per
contract) in ONE plan/ONE batch; accounts re-derived at plan creation then
frozen (EK37–EK41). Final lifetime = replacement only (baseline + Y on the
expense account, baseline − Y on 1040). Original immutable except the
lifecycle marker; lineage in append-only Logs (originalId/replacementId).
Evidence: EK37–EK46.

## 9. Purchase Cancel contract

Operation `PURCHASE_EVENT_VOID` (T11.2 frozen). Append-only signed Policy C
reversal pair: MovementType `POLICY_C_REVERSAL` via the frozen
`policyCReverseJournal` shape — exact inverse `Dr1040 X / Cr6210 X`,
`SourceID` = original EventID, `ExternalRef` = original JournalID,
JournalID `POLICYC-PEXP-VOID-<EventID>`, ACTION date (PC49). Original
PurchaseEvent immutable except `Lifecycle=VOIDED + IsActive=false`;
PAID/1040/POSTED/amount/payload unchanged (PC50). No AP/2000, no
Inventory, no 5000/1100, no Treasury (PC51/PC65/HS96/HS97). Truth is
reader-resolvable from the append-only reversal journal + Logs marker +
committed operation plan.

## 10. Purchase Correct contract

Operation `PURCHASE_EVENT_CORRECT` = linked exact reversal (JournalID
`POLICYC-PEXP-CORRECT-<EventID>`) + replacement event with composed
Dr6210/Cr1040 journal in ONE batch; original lifecycle → `CORRECTED` +
inactive with financial truth unchanged; deterministic `corr-` replacement
keys retained (existing contract): replacement EventID
`PE-corr-<requestKey>`, final PaymentStatus=PAID / CashAccountCode=1040 /
AccountingStatus=POSTED (PK57–PK62). SupplierID optional; no
AP/Inventory/HPP (PK59/PK65).

## 11. Atomicity and durable sequence

Per domain per action: lock → normalize → exact (OperationType, RequestKey)
lookup → validate original immutable authority (committed SAVE lineage +
target evidence digests) → validate eligibility → config/schema/account
preflight → complete immutable reversal(+replacement) plan → planDigest →
IN_PROGRESS intent + exact ten-field readback → **ONE** atomic
`spreadsheets.batchUpdate` → artifact verification → COMMITTED → readback →
cache → DONE.

- Correct NEVER does reverse()→success then replacementSave()→maybe-fail:
  the replacement exists only as rows of the SAME frozen plan written by the
  SAME batch (EK38/PK58/SC14 batch-shape checks; crash tests DY66–DY71 prove
  no partial state survives).
- Batch composition: Expense Cancel `[tabops update, BalanceLedger 2,
  Logs 1]`; Expense Correct `[tabops update, tabops append, BalanceLedger 4,
  Logs 2]`; Purchase Cancel `[PurchaseEvents update, BalanceLedger 2,
  Logs 1]`; Purchase Correct `[PurchaseEvents update, PurchaseEvents append,
  BalanceLedger 4, Logs 2]`; Sales Void `[events 1, ledger 4, audits 1]`;
  Sales Correct `[Orders, OrderLines, events 2, ledger 8, audits 2]`.
  The lifecycle marker uses `updateCells` inside the same atomic
  `batchUpdate` (appendCells for appended rows); missing sheetId throws
  before any request.
- Op types: 6 correction OperationTypes (§3 row 5). Batch counts per action:
  exactly 1 (suite assertions EC28/EK38/PC48/PK58/SV2/SC14). Replay
  zero-write: 6/6 domains (SV8/SC21/EC33/EK43/PC53/PK63). Recovery from
  frozen plan only — no mutable-master re-plan (DY67/DY70, plan guards).

## 12. RequestKey / idempotency matrix

| Case | Result | Evidence |
| --- | --- | --- |
| same key + same payload | DONE `replay:true`, writeCount 0, zero new batches | SV8, SC21, EC33, EK43, PC53, PK63 |
| same key + different payload | CONFLICT `OPERATION_PAYLOAD_CONFLICT`, zero writes | SV9, SC22, EC34, PC54 |
| new-key Void on already-voided | REFUSED `ALREADY_VOIDED`-class, zero writes | SV10, EC35, PC55 |
| new-key Correct on superseded original | REFUSED `ALREADY_CORRECTED`, zero writes | SC23 (`SALES_V2_TARGET_ALREADY_CORRECTED`), EK44, PK64 |
| duplicate operation row | RECOVERY_REQUIRED `DUPLICATE_OPERATION_EVIDENCE`, zero writes | DY79 |
| UI key stability | one RequestKey per intent, persisted across UNKNOWN, same-key retry via `singleCommitPendingKey_` + `Check Status` (`findOperationalOperation`) | 195 §GR104 |

Namespaces distinguish original Save / Void / Correct (GR106 disjointness).
No multiple active correction branches from one original: single
successor check (SC20 length-1), competing-op gate, and supersession
refusal (§13).

## 13. Eligibility

Genuine committed domain artifact only: exact committed
`EXPENSE_SINGLE_COMMIT_SAVE` / `PURCHASE_SINGLE_COMMIT_SAVE` operation with
matching plan + validated journal pair + APP_ENTRY/PAID-1040-POSTED truth;
Sales = committed V2 lineage with clean projection chain (existing U6
authority). Not already voided/superseded (row lifecycle + committed
correction-op scan). Artifacts complete, signatures valid, identities
consistent. Historical/legacy rows fail closed with
`TARGET_NOT_SUPPORTED` (no operation row) — legacy correction behavior
stays separate and untouched (HS98/HS99 prove legacy rows still use the
legacy writers; EC36/EK46/PC56/PC56 prove T11 rows never enter them).

## 14. Config decision (PAUSED admission) — RESOLVED, no owner decision

Question: are NEW correction intents refused while PAUSED, or allowed as
safety/remediation?

Resolution (exhausted T11.2 + U5 governance first; no genuinely unresolved
residual → **OPEN_OWNER_DECISIONS: NONE**):

1. T11.7 §3: "PAUSED-after-authority → reject NEW writes"; §5 routing
   matrix: PAUSED → REFUSE on every domain; "RECOVERY (IN_PROGRESS op) →
   resumes from admission re-evaluation".
2. T11.7 §6/§7 state machine: PAUSED exists only after authority and never
   reverts; sticky intent.
3. Existing frozen correction precedents: Sales V2 U6/U7 (`V2_MODE_PAUSED`
   for new Correct/Void, persisted intents resume), Treasury T2 §5/T6 FI18
   (PAUSED refuses SAVE/REVERSE/CORRECT, IN_PROGRESS recovery completes).
4. T11.2 §22: "new saves refuse fail-closed" + errors corrected only via
   §10 signed correction — i.e., correction remains available when ACTIVE;
   PAUSED blocks new mutation admission, never recovery.

IMPLEMENTED: **NEW correction intents refuse while PAUSED**
(`SINGLE_COMMIT_MODE_PAUSED`, zero writes — SV12, DY73); ABSENT/PREPARED
refuses new correction intents fail-closed with no legacy fallback
(`EXPENSE_SINGLE_COMMIT_CORRECTION_NOT_ACTIVE` / purchase equivalent —
DY74); **IN_PROGRESS recovery is resumable regardless of later PAUSED**
(DY72, admission never re-evaluated on the resume path). Sales new-intent
admission keeps the pre-existing U6 gate order (V2 gate → schema/accounts →
eligibility → single-commit config preflight); Expense/Purchase keep the
U2/U3 save-core order (config admission first). Both orderings are
zero-write; the task's durable sequence governs plan→intent→batch order,
which is identical everywhere.

## 15. Preflight (no fallback, zero writes)

| Domain | Required | Refusal evidence |
| --- | --- | --- |
| Sales Void/Correct (composed target) | {1040, 1030, 4000} | SV12-adjacent + PF86 (`MONEY_ACCOUNT_PREFLIGHT_FAILED`), plus save-core `preflightSalesRecognitionAccounts` for 1030/4000 |
| Expense Cancel | {1040, original expense acct} | PF80 (`MONEY_ACCOUNT_PREFLIGHT_FAILED`), PF81 (`ORIGINAL_EXPENSE_ACCOUNT_INACTIVE`) |
| Expense Correct | {1040, original acct, replacement acct} | PF80, PF81, PF82 (replacement item/account unusable) |
| Purchase Cancel | {1040, 6210} | PF84 (1040), PF83 (`PURCHASE_ACCOUNT_ABSENT`) |
| Purchase Correct | {1040, 6210} + replacement route/authority | PF85 (`PURCHASE_ACCOUNT_INACTIVE`), PF83/PF84 |

PF87 aggregates: 7/7 preflight refusals carried `status=REFUSED` and
`writeCount=0`. Recovery from a frozen plan never re-plans against changed
masters (DY75–DY78).

## 16. Accounting

- Sales Void nets: 4000 → 0, 1030 → 0, 1040 → 0 (SV5).
- Sales Correct nets: 4000 → −Y, 1040 → +Y, 1030 → 0 (SC17).
- Expense Cancel → baseline (EC32); Correct → baseline ± replacement
  (EK41).
- Purchase Cancel → 6210 0 / 1040 0 (PC51); Correct → 6210 +Y / 1040 −Y
  (PK61).
- Zero 2010 writers: no correction core contains a `2010` literal (HS96);
  no 2000/1100/5000/1000/1010/1020/6210 foreign postings in Sales
  corrections (SV13/SC26); no AP/Inventory/HPP movement in Purchase
  corrections (PK65); no Settlements/TreasuryReceipts/Payments/Inventory
  surfaces in any correction contract (HS97).

## 17. Cash Flow (exactly once, no double count)

Fed the real post-correction ledgers through `buildCashFlowStatement`
(RP88–RP91): Sales Void wide-period operating net **0** (inflow reversed
once, ambiguous 0); Sales Correct net **= Y** (replacement economics only);
Expense Cancel **0** / Correct **−Y**; Purchase Cancel **0** / Correct
**−Y**. Recognition journals stay non-cash; composition classification
(D11) resolves the 1030 counterparts; no ambiguous entries.

## 18. Revenue / P&L

Void removes economically via signed recognition reversal: recognized
revenue 0 (RP92 void). Correct = reversed + replacement: recognized revenue
exactly Y (RP92 correct). Expense/Purchase cancel/correct economically
exact (§16). `cogs`/`grossProfit` stay null in the prospective regime; no
5000/1100 postings (HS96, PK65).

## 19. T5 / 1030

Composed Void: reconciliation `OK`, `ledgerNet1030 = 0`,
`outstandingTotal = 0`, `unexplainedResidual = 0` — no false outstanding,
no unexplained residual (RP93 void). Composed Correct: `OK`, net 0,
residual 0; the reversed `SALES_MONEY_V2` group never counts as active
clearing (its SourceID binds to the SCRV- reversal recognition —
pre-wired U4/99B path, exercised live by RP93). Malformed/missing reversal
lineage → EXCEPTION/RECOVERY_REQUIRED visible, never silent (DY75,
existing T5 integrity suites).

## 20. Transaction / UI / cohort routing

- Server: `detail.singleCommit` flag on T11 Expense rows (22); Purchase
  projection `singleCommit` for PAID/1040/POSTED rows (47). Legacy-shaped
  payloads only gain the flag when true (legacy transport byte-stable).
- Client (195): T11 cohort routes to `expenseSingleCommitDurableVoid/
  Correct` and `purchaseEventDurableVoid/Correct` with genuine inputs only
  (reason + business replacement fields — no account/payment/EvidenceRef/
  internal IDs beyond requestKey); legacy cohorts keep the exact legacy
  endpoints. UNKNOWN/RECOVERY_REQUIRED keeps the SAME RequestKey with a
  `Check Status` reconcile (`findOperationalOperation`) — never a definite
  failure, never a second financial action.
- Legacy preview/correct/void refuse the T11 cohort server-side
  (`SINGLE_COMMIT_COHORT_ROUTED`) — defense in depth under the client
  routing (EC36/EK46/PC56).
- Reversal ledger rows are never presented as business transactions (no
  reader maps them to transaction rows); audit detail exposes lineage
  through Logs metadata (originalId/replacementId).

## 21. Cache invalidation

DONE results invalidate the shared dashboard cache best-effort after the
COMMITTED readback, in all six flows (expense/purchase
`runtime.invalidate`, sales mutation `invalidateDashboardCache`); REFUSED/
CONFLICT never invalidate (zero writes). UI invalidates client caches on
confirmed outcomes only.

## 22. Recovery / failure matrix (DY66–DY79, MEASURED)

| Boundary | Observed | Recovery |
| --- | --- | --- |
| crash before intent | UNKNOWN `CORRECTION_EXECUTION_UNKNOWN`, 0 ops, 0 batches | same key re-plans → DONE, one batch total (DY66) |
| crash after IN_PROGRESS persist | UNKNOWN, op IN_PROGRESS | resume from STORED plan → DONE (DY67, DY70) |
| crash after batch | UNKNOWN | artifacts EXACT → commit → DONE replay writeCount 0, no second batch (DY68) |
| batch failure pre-write | UNKNOWN `BATCH_OUTCOME_UNKNOWN`, IN_PROGRESS, 0 artifacts | same key after fault clear → DONE (DY71) |
| missing artifact (reversal row deleted) | RECOVERY_REQUIRED, zero writes | fail closed, never re-append (DY75) |
| plan digest tamper | RECOVERY_REQUIRED, zero writes (DY76) |
| account tamper | RECOVERY_REQUIRED, zero writes (DY77) |
| signature tamper | RECOVERY_REQUIRED, zero writes (DY78) |
| duplicate op row | RECOVERY_REQUIRED `DUPLICATE_OPERATION_EVIDENCE` (DY79) |
| NEW intent under PAUSED / PREPARED | REFUSED, zero writes (DY73/DY74) |
| recovery while PAUSED | DONE from frozen plan (DY72) |

## 23. Legacy separation

`voidCanonicalTransaction` / `correctCanonicalTransaction` /
`previewCanonicalTransactionCorrection` (22) and `voidPurchaseEvent` /
`correctPurchaseEvent` (47) remain byte-functional for legacy rows (HS98,
HS99 + all pre-existing legacy suites) and refuse single-commit cohort
targets with `SINGLE_COMMIT_COHORT_ROUTED` (zero writes). The T11 cores
never call legacy writers; legacy writers never contain correction-core
symbols (GR101/GR105).

## 24. Historical compatibility + transitional 24k

- No historical Sales/Payments/Settlements/Expense/PurchaseEvents/AP/
  2000/1000-1010-1020/transitional Sale/Treasury receipt is rewritten:
  seeded fixture rows byte-identical through a full T11 correct cycle
  (HS100); protected sheets byte-identical (SV13/SC26).
- TRANSITIONAL 24k INVARIANT before AND after the matrix:
  `treasuryT5Reconciliation_` = OK, outstanding 24000, ledgerNet1030
  24000, unexplainedResidual 0 (HS95 before, GR109 after). No
  TRANSITIONAL_CLEARING_CLOSE / EvidenceRef / TreasuryReceipt / money
  reversal is produced for it by any code in this unit.

## 25. Tests (MEASURED)

Task matrix ≥109 → **112 checks across 11 new suites, all PASS**:

| Suite (runner) | Matrix range | Checks | Focus |
| --- | --- | --- | --- |
| `testSingleCommitCorrectionsSalesVoid` | SV1–SV13 | 13 | composed void, SRV2MV money reversal, nets, replay/conflict/already-voided, recognition-only parity, PAUSED |
| `testSingleCommitCorrectionsSalesCorrect` | SC14–SC26 | 13 | one plan/batch, both money legs, final lifetime, single branch ALREADY_CORRECTED/VOIDED, invalid input, forbidden accounts |
| `testSingleCommitCorrectionsExpenseCancel` | EC27–EC36 | 10 | EXPJV mirror, lifecycle marker, Logs authority, nets, replay/conflict/already, legacy guard |
| `testSingleCommitCorrectionsExpenseCorrect` | EK37–EK46 | 10 | deterministic replacement, ONE batch, lineage, lifetime=replacement, immutability, replay, already-corrected, legacy preview/correct guard |
| `testSingleCommitCorrectionsPurchaseCancel` | PC47–PC56 | 10 | POLICYC-VOID inverse pair, PAID/1040/POSTED truth, nets, replay/conflict/already, legacy guard |
| `testSingleCommitCorrectionsPurchaseCorrect` | PK57–PK65 | 9 | corr- replacement, ONE batch, lifetime, history-valid event, replay, both already-* directions, forbidden accounts |
| `testSingleCommitCorrectionsDurability` | DY66–DY79 | 17 | UNKNOWN pre/post/batch, resume-from-plan, PAUSED recovery, PAUSED/PREPARED admission, missing artifact, digest/account/signature tamper, duplicate evidence |
| `testSingleCommitCorrectionsPreflight` | PF80–PF87 | 8 | {1040, expense acct, replacement acct} / {1040, 6210} matrix, zero-write aggregate |
| `testSingleCommitCorrectionsReporting` | RP88–RP94 | 7 | Cash Flow once (6 flows), Revenue authority, T5 residual 0, aggregate funds |
| `testSingleCommitCorrectionsHistorical` | HS95–HS100 | 6 | 24k before, forbidden writers/surfaces, legacy compatibility, seeded history |
| `testSingleCommitCorrectionsRegression` | GR101–GR109 | 9 | control-plane isolation, outer-lock-only wrappers, inert cores, UI/guard wiring, namespaces, gates, manifest, 24k after |

MEASURED total: `node _test_runner.js` → **227 PASS / 0 FAIL** on final
source (baseline 216/0 + 11/11 new suites; every U1–U5, Treasury, Finance,
mutation-proof and controller suite still PASS).

## 26. Regression evidence

- Baseline (pre-change, MEASURED): 216 / 0.
- Final (post-change, MEASURED): 227 / 0.
- One prior test expectation updated with the change: U6 L4 double-Correct
  refusal code `SALES_V2_TARGET_ALREADY_VOIDED` →
  `SALES_V2_TARGET_ALREADY_CORRECTED` (task-contract label for the same
  zero-write single-branch rejection; strength unchanged — REFUSED, zero
  batches). Everything else in the 216 baseline is untouched.
- Mutation-proof anchors in `97C` preserved (proof suites pass 20/20-style
  batteries in the final run).

## 27. Mutations / production safety

| Class | Count |
| --- | --- |
| `clasp` commands (any) | 0 |
| `clasp push` / deploy / pull | 0 |
| Production spreadsheet reads/writes | 0 |
| Config / PropertiesService mutations | 0 |
| Git mutations (stage/commit/push/reset) | 0 |
| Accounts 1040 creation / PREP-ACTIVATE / 24k close / 1040 writers | 0 |
| Business/financial events outside fixture memory | 0 |

All execution was local Node (`node --check`, `node _test_runner.js`) over
in-memory fixtures.

## 28. Open owner decisions, deviations, deliberate simplifications

- **OPEN_OWNER_DECISIONS: NONE.** The PAUSED-admission question resolved
  deterministically from frozen governance (§14); no M-item needed.
- Deviation note (mapping, not weakening): the Sales label for
  "new-key Correct on superseded original" is
  `SALES_V2_TARGET_ALREADY_CORRECTED` (implemented in `97C` eligibility,
  ahead of the terminal check, correct-only). Expense/Purchase use their
  own `TARGET_ALREADY_CORRECTED` codes. The pre-existing U6 L4 expectation
  was updated to the task-contract label; refusal strength (zero writes,
  no second branch) is identical.
- Ordering note: Sales new-intent admission keeps the pre-existing U6 gate
  order (eligibility after schema/accounts); Expense/Purchase keep the U2/
  U3 order (config admission first). Zero-write either way (§14).
- `ponytail:` lifecycle-marker updates use `updateCells` inside the single
  atomic `batchUpdate` (row numbers frozen in the plan + pre-batch row
  guard); upgrade path if Sheets row stability is ever violated → fail
  closed `RECOVERY_REQUIRED` (already implemented), never re-plan.
- `ponytail:` correction plan sizes are bounded by the save-core
  `MAX_BATCH_CELLS/MAX_REQUEST_BYTES`; a future multi-line Sales Correct
  beyond 50 lines reuses the same bounds refusal.

## 29. Package impact, commit recommendation, telemetry, remaining

- `.claspignore` untouched (76 allowlist files, GR108); new files are
  test-only (`96.Tests.SingleCommit.Corrections.Cases.js` is NOT in the
  deployment allowlist). No `.clasp.json` change. No new runtime file →
  no manifest growth.
- Changed files (exact list for commit):
  - `97C.SalesRecognition.V2.Correction.js`
  - `21.Transaction.Entry.js`
  - `22.Transaction.Lifecycle.js`
  - `47.Purchase.Events.js`
  - `195.View.Transactions.Actions.html`
  - `96.Tests.SalesRecognition.V2.U6.Cases.js` (L4 label)
  - `96.Tests.SingleCommit.Corrections.Cases.js` (new, 112 checks)
  - `_test_runner.js` (registration)
  - `tests/tmp/t8-package-manifest.json` (regenerated hashes byproduct of
    the local harness; deterministic)
  - `docs/T11-8-U6-CORRECTIONS-VOID-CANCEL.md` (this evidence)
- Recommended commit title: `Treasury T11.8: U6 corrections void cancel`
  (Heavy does not run Git; staging is an explicit-path decision for
  numlock-commit).
- Remaining units: U7 (production prerequisite — Accounts 1040 creation),
  U8 (config PREPARED→ACTIVE activation), U9 (first-production acceptance
  via authorized read-only diagnostics), U10 (transitional 24k closure).
  NEXT: `T11_9_U7_PRODUCTION_PREREQUISITE_AND_1040_CREATION`.
- Telemetry: agent numlock-explore-free (Free execution, no fallback, no
  Sol); reasoning L3/R1; toolcalls UNKNOWN (not instrumented); elapsed
  UNKNOWN (not instrumented); files read ~40 (approximate, source/docs/
  tests); files modified 8 (7 source/test + 1 regenerated tracked harness
  artifact `tests/tmp/t8-package-manifest.json`) + 2 created (new test
  file + this doc); `node --check` on every changed JS file (all passed);
  `node _test_runner.js` run 10×; final MEASURED 227 PASS / 0 FAIL.

DISCOVERY + IMPLEMENTATION + LOCAL VALIDATION COMPLETE. ZERO production
actions: writes/deploys/pushes/config/financial mutations all 0.
