# T11-12 — U10 Transitional Rp24,000 Clearing Close

TASK_ID: U10-FINAL-INVOCATION-2026-10-14 · Complexity L3 · Operational
risk R4 · Reasoning high

**STATUS: `U10_TRANSITIONAL_24K_CLOSE_COMPLETE` — the frozen §18 close was
executed in production with EXACTLY ONE authorized writer invocation and
independently proven exactly-once by authoritative readback.**

Evidence provenance rule:

- **[MEASURED THIS-SESSION]** — measured in this task session (read-only
  precheck, the single invocation, authoritative readback, local harness).
- **[PRIOR-MEASURED]** — accepted evidence from earlier T11 units; relied
  upon, not re-proved, not contradicted.

## 0. Blocker history (preserved)

- The original U10 execution task (same document, earlier session) returned
  **`BLOCKED_WRITER_NOT_AVAILABLE`**: Phase 1 discovery found no §18 close
  writer in the repository or deployed runtime (v717, 77 files). Zero
  invocations; authorization unconsumed. That record is retained here as
  history; its conclusion is superseded by the writer implementation unit
  below.
- Writer implementation unit: `102.Transitional.Clearing.Close.js`,
  implementation authority commit **`7feb33fd6abe45a2085cfb32277fd4fe9077289e`**
  ("finance: implement transitional clearing close writer"), registered into
  the runtime by `1c5eb0e474ed578536a351f6c1c62b9442e4a879` ("build:
  register transitional close writer runtime"), dedicated in-memory test
  matrix `96.Tests.SingleCommit.TransitionalClose.Cases.js` (5 suites, 55
  checks) green in full regression.
- Authorized upload unit produced immutable production **version 718**
  (78-file runtime). Writer invocation count at task start: **0** (TRCC
  artifacts 0 — re-verified, Phase 2 gate C).

## 1. Authority / rationale (unchanged)

- Owner authority (established real-world fact): the transitional Sale is
  genuine; Rp24,000 was received in the ordinary Sale lifecycle; no separate
  receipt evidence exists and none is fabricated; the money belongs to
  aggregate 1040 Operational Funds; exposure exists only because the Sale
  predates the T11 single-commit money-leg architecture.
- Approved close (frozen): **Dr 1040 Operational Funds Rp24,000 /
  Cr 1030 Sales Settlement Clearing Rp24,000**, event source
  `TRANSITIONAL_CLEARING_CLOSE`, linked to `SCR-CE122B27-ORD677BE5CES`,
  evidence = owner attestation / internal migration authority —
  **NO fabricated EvidenceRef, NO TreasuryReceipts row**.
- Frozen contract: `docs/T11-2-SINGLE-COMMIT-TRANSACTION-CONTRACT.md` §18;
  T11.2 §21 step 8. Steps 4–6 complete [PRIOR-MEASURED: U7/U8/U9].

## 2. Baseline [MEASURED THIS-SESSION]

- BASELINE_COMMIT verified: `git rev-parse HEAD` =
  `1c5eb0e474ed578536a351f6c1c62b9442e4a879` — exact match with the task
  baseline.
- Pre-existing worktree state (untouched, preserved, excluded from the
  evidence commit): modified `assets/tailwind.input.css`; untracked
  `tests/tmp/*` diagnostics.
- Production context [MEASURED THIS-SESSION]: immutable version **718**,
  `content?versionNumber=718` HTTP 200, **78 files**, version aggregate
  sha16 `4d914fb47268a087`; deployments unchanged.

## 3. PHASE 1 — Capability [MEASURED THIS-SESSION]

- A: deployment v718 immutable content HTTP 200, 78 files — PASS.
- B: writer bytes — deployed@718 sha256
  `9f7d9827d885a50e8c3d24e78d303ed8301771455f781f009f91a0bea5813ae6`
  == local file sha256 == git blob at authority commit
  `19255f14489fcf169ad179cfc3c4ad8b1eb36e89` — PASS; deployed bytes carry
  the zero-arg public entry `closeTransitionalClearingProduction()`.
- Execution mechanism: Apps Script Execution API `scripts.run` reachable
  with the established run identity (read-only surfaces answered before the
  invocation) — PASS.
- Config-only limitation (documented, never fabricated): the
  `SINGLE_COMMIT_TRANSACTION_V1` activation state lives only in Script
  Properties and is not provable by external read. Per task contract the
  writer's **embedded under-lock preflight** (gate `transitionalClearingCloseConfigActive_`,
  `102.Transitional.Clearing.Close.js:161`) is the authoritative config
  check; no second config reader was created. The committed outcome itself
  is runtime proof the gate resolved VALID+ACTIVE at invocation time.
- No automatic route had invoked the writer since deployment: TRCC
  operations 0, TRCC ledger lines 0, TRCCA audits 0 — PASS.

## 4. PHASE 2 — External precheck gates (all PASS, fresh PRE-CLOSE state)

| Gate | Measured pre-close state |
| --- | --- |
| A deployment | v718, 78 files, aggregate `4d914fb47268a087` |
| B writer authority | deployed == local == `7feb33f` blob |
| C TRCC artifacts | 0 operations / 0 ledger lines / 0 audits |
| D committed close op | none |
| E TRCC ledger pair | none |
| F 1030 | global ACTIVE net **Dr 24,000** (Dr 144,000 / Cr 120,000 across 3 lines: transitional Dr24,000 + U9 Dr120,000 recognition + U9 Cr120,000 money leg — the Rp24,000 debit arises solely from `SCR-CE122B27-ORD677BE5CES`) |
| G 1040 | net **120,000** (1 ACTIVE line; transitional 24,000 proven outstanding independently via T5/recon) |
| H exposure | outstandingTotal **24,000**; recognizedExposure 144,000 (24,000 transitional + 120,000 U9 already cleared) |
| I T5 | `SCR-CE122B27-ORD677BE5CES` **UNCLEARED**, OutstandingAmount 24,000, Integrity VALID, QualityCodes [] |
| J RecognitionID | exactly 1 RECOGNITION row, OrderID `ORD-677BE5CE-SALESRECOGNI`, amount 24,000 |
| K U9 separate | U9 sale (sheet identity `ORD-58D943AB-SALESRECOGNI`, business label SO-0003, Rp120,000) **CLEARED**, outstanding 0 — disjoint from transitional |
| L no receipt | 0 TreasuryReceipts rows reference the transitional RecognitionID |
| — recon | `reconciliationStatus OK`, ledgerNet1030 24,000 = outstanding 24,000, exception 0, residual 0 |

Fresh PRE-CLOSE full-fleet fingerprint: **42 sheets**, aggregate sha16
`5308657d020fa433` (per-sheet sha16 + row counts recorded in the precheck
report artifact).

## 5. PHASE 3 — Plan assertion from deployed bytes [MEASURED THIS-SESSION]

Extracted from the DEPLOYED v718 writer source: RecognitionID
`SCR-CE122B27-ORD677BE5CES`; OrderID `ORD-677BE5CE-SALESRECOGNI`; amount
24000; Dr1040 / Cr1030; source + movement type
`TRANSITIONAL_CLEARING_CLOSE`; JournalID/RequestKey prefix `TRCC-`;
WRITE_SURFACES exactly {TransactionOperations, BalanceLedger, Logs};
zero-arg entry. All 7 assertion checks PASS → invocation authorized.

## 6. PHASE 4 — Invocation (authorization consumed)

- **Invocation count = 1** (exactly one
  `closeTransitionalClearingProduction()` call, zero arguments,
  2026-10-14T03:39:13.482Z → 2026-10-14T03:39:30.778Z, HTTP 200).
- Structured return (as received):
  `status RECOVERY_REQUIRED`, `code TRANSITIONAL_CLOSE_ARTIFACTS_INCOMPLETE`,
  `detail "OPERATION,JOURNAL"`, `writeCount "UNKNOWN"`,
  `operationID TXOP-7DAFA86F-TRANSITIONAL`,
  `journalID TRCC-SCR-CE122B27-ORD677BE5CES`,
  `auditID TRCCA-323276D2-TRCCSCRCE122`,
  `requestKey TRCC-SCR-CE122B27-ORD677BE5CES`, `replay false`.
- **Incident (transport-level, resolved by contract):** the batch committed
  (operation CreatedAt `2026-10-14T03:39:28.622Z`), but the writer's
  in-call Sheets REST readback raced the append propagation and observed
  OPERATION+JOURNAL as missing, so the writer correctly refused to claim
  DONE and returned RECOVERY_REQUIRED with zero repair and zero retry.
  Per the frozen durability contract and the task's TECHNICAL_INVARIANTS,
  this is exactly the ambiguous-result path: **no second invocation**;
  Phase 5 authoritative readback (independent of the response) decided the
  outcome. No defect: the fail-closed behavior is the designed and
  test-covered durability semantics (`testTransitionalCloseDurability`).

## 7. PHASE 5 — Authoritative readback (independent of the response) [MEASURED THIS-SESSION]

- Exactly **1** `TRANSITIONAL_CLEARING_CLOSE` operation row,
  `State COMMITTED`, `OperationID TXOP-7DAFA86F-TRANSITIONAL`,
  `RequestKey TRCC-SCR-CE122B27-ORD677BE5CES`,
  `BusinessID SCR-CE122B27-ORD677BE5CES`,
  `PayloadHash H-C3C18058-AMOUNT24000C`, `LastError ""`,
  CreatedAt `2026-10-14T03:39:28.622Z`, actor `dekker.log@gmail.com`.
- Exactly **2** BalanceLedger lines under journal
  `TRCC-SCR-CE122B27-ORD677BE5CES`, balanced:
  - `…-1` AccountCode 1040, Debit 24,000, Credit 0
  - `…-2` AccountCode 1030, Debit 0, Credit 24,000
  both `SourceType/MovementType TRANSITIONAL_CLEARING_CLOSE`,
  `SourceID SCR-CE122B27-ORD677BE5CES`, IsActive TRUE; **0 foreign TRCC
  lines / 0 duplicate TRCC sources** anywhere in the ledger.
- Exactly **1** truthful internal attestation:
  `ID_Log TRCCA-323276D2-TRCCSCRCE122`, Level INFO,
  Module `TransitionalClearingClose`, RecordID = journal; metadata:
  attestation `OWNER_AUTHORIZED_INTERNAL_ARCHITECTURE_TRANSITION`,
  evidence `OWNER_ATTESTATION_INTERNAL_ARCHITECTURE_TRANSITION`;
  **no** evidenceRef / paymentMethod / channel / destination / settlementID /
  treasuryReceiptID claims (property-absence verified).
- Derived balances: **1030 → net 0** (Dr 144,000 / Cr 144,000 across 4
  ACTIVE lines); **1040 → 144,000** (120,000 → +24,000 exactly once).
- Live T5: transitional **CLEARED**, ClearedAmount 24,000, Outstanding 0,
  Integrity VALID; U9 **CLEARED** unchanged; totals outstandingTotal 0,
  unclearedCount 0, clearedCount 2.
- Live reconciliation: `OK`, ledgerNet1030 **0**, outstandingTotal **0**,
  unexplainedResidual **0**.

## 8. PHASE 6 — Negative evidence [MEASURED THIS-SESSION]

Full 42-sheet PRE vs POST fingerprint diff — mutated sheets exactly:
`TransactionOperations` (4→5 rows), `BalanceLedger` (12→14 rows),
`Logs` (225→226 rows). **No other sheet changed.** Therefore unchanged by
identity: SalesRecognitionEvents / SalesRecognitionAudits (Revenue
recognition, SalesRecognition principal), Orders / OrderLines (incl. U9
Sale), TreasuryReceipts / TreasuryOperations / TreasuryAudits, Payments,
Settlements, Expense/Purchase surfaces, AP, InventoryLedger, Accounts
(account master incl. 2010/2000/5000/1100), Suppliers, Settings
(T11 activation/config property lives outside sheets and was never
touched — this writer has no config path).

## 9. PHASE 7 — Reporting acceptance [MEASURED THIS-SESSION]

- A: 1040 +24,000 exactly once: 120,000 → **144,000** (no intervening
  events).
- B: global 1030 **→ 0**.
- C: Revenue unchanged (recognition surfaces fingerprint-identical).
- D: P&L unchanged (no Revenue/COGS/HPP mutation; only money-leg ledger
  rows added).
- E: sales count unchanged (Orders/OrderLines identical).
- F: Dashboard unchanged (cache invalidation is ephemeral best-effort;
  no persistent Dashboard artifact exists; derived data changes only via
  the closed ledger).
- G: U9 CLEARED + transitional CLEARED + zero unexplained exposure
  (outstandingTotal 0, unclearedCount 0, residual 0).
- H: residual **0**.
- I: Policy C intact — no COGS/Inventory/5000/1100 rows anywhere in the
  delta.
- J: Cash Flow — per frozen §12 semantics, the committed
  `TRANSITIONAL_CLEARING_CLOSE` group classifies as exactly **ONE Operating
  inflow** (Cr1030/Dr1040, money-leg shape) in the derived aggregate; no
  duplicate cash row, no Revenue row, no Sale. Cash Flow semantics were
  NOT changed (reader logic untouched; classification already tested by
  `testTransitionalCloseT5Readers`).

## 10. PHASE 8 — Protected fingerprint diff

PRE aggregate `5308657d020fa433` (42 sheets) → POST aggregate over the same
fleet. Expected mutation family ONLY, each explained by the single
transition: +1 COMMITTED operation; +2 ledger lines; +1 Logs attestation;
derived 1040 +24,000, 1030 −24,000, outstanding → 0, T5 → CLEARED, Cash
Flow one derived inflow. **Zero unexplained mutations.**

## 11. PHASE 9 — Idempotency proof (no second write)

Committed operation row (authority) + deterministic
RequestKey/JournalID `TRCC-SCR-CE122B27-ORD677BE5CES` + deployed contract
(102.Transitional.Clearing.Close.js: replay lookup of
(OperationType, RequestKey) precedes any mutable-state evaluation;
COMMITTED + verified stored plan + EXACT artifacts ⇒ `ALREADY_COMMITTED`,
writeCount 0, never a second batch) + source-key lookup (exactly one
operation, exactly two ledger lines, one audit; foreign-TRCC scan 0).
Conclusion: **SECOND FINANCIAL WRITE IMPOSSIBLE UNDER NORMAL WRITER
CONTRACT.**

## 12. PHASE 11 — Local validation [MEASURED THIS-SESSION]

- Full regression `node _test_runner.js`: **233 PASS / 0 FAIL**, exit 0 —
  includes the 5 dedicated transitional-close suites (55 checks: happy
  path, preflight refusals, durability, T5 readers, source audit), the
  release audit (`testSalesV2U8ReleaseAudit`), and package-measurement
  audits.
- Syntax/static: no runtime source modified this task (Markdown-only delta);
  `git diff --check` clean on the evidence document.
- Package integrity: v718 runtime 78 files verified against deployed
  immutable content (Phase 1 A/B); local worktree runtime files unmodified.
- Production defect posture: the RECOVERY_REQUIRED return is the designed
  ambiguous-transport durability behavior (§6), not a defect; **no
  production patch or deploy in this task**.

## 13. Incidents / deviations

- **Incident (resolved by contract, no impact):** single invocation returned
  `RECOVERY_REQUIRED / ARTIFACTS_INCOMPLETE / writeCount UNKNOWN` because
  the writer's in-call readback raced Sheets append propagation. Exactly-once
  was proven by independent authoritative readback (§7). No second
  invocation, no repair, no blind repeat.
- Precheck script iterations (local harness only): first precheck run used
  over-strict gate literals for F/G/H/K (gross-vs-net 1030, U9 sheet
  identity label vs OrderID column, global vs outstanding exposure); gates
  were corrected to the measured business identities and re-run read-only
  to PASS. Zero production effect.
- No U9 evidence rewritten. No Cash Flow semantics change. No finance
  cleanup beyond the close. No roadmap work.

## 14. Final conclusion and next gate

**RESULT = `U10_TRANSITIONAL_24K_CLOSE_COMPLETE`.** Production mutation
count this task: **1** (the single authorized close; 4 rows across 3
sheets). Pushes: **0**. Deployments: **0**. Second invocations: **0**.

STOP condition honored: no further finance cleanup, writer retirement,
Treasury/1030/1040 alteration, or roadmap work performed.

**Recommended next gate:** writer retirement / lock-down
(remove or freeze the public entry, keep the durable artifacts) as a
**separate task after owner evidence review of this document**.

U10 TRANSITIONAL Rp24,000 CLOSE: **PASS / CLOSED**
