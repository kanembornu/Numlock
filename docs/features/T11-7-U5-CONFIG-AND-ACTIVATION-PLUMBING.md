# T11.7 — U5 Config and Activation Plumbing (LOCAL / INERT ONLY)

STATUS: LOCAL IMPLEMENTATION COMPLETE · ZERO PRODUCTION MUTATIONS · WRITERS NEVER INVOKED
TASK_ID: T11_7_U5_CONFIG_AND_ACTIVATION_PLUMBING
PHASE: NUMLOCK_SINGLE_COMMIT_TRANSACTION_ARCHITECTURE
BASELINE_COMMIT: `6b70040` (T11.6 U4; verified HEAD, tracked-clean worktree, 27 pre-existing `tests/tmp/u10e-*` untouched)
CLASSIFICATION: L3 · R2 · REASONING_EFFORT high · Execution CONTINUE
AUTHORITY: `docs/T11-2-SINGLE-COMMIT-TRANSACTION-CONTRACT.md` §20–§22 + frozen D1/D11/D12; precedents U1/U2/U3/U4.
REGRESSION: baseline **207 PASS / 0 FAIL** (MEASURED pre-edit) → final **216 PASS / 0 FAIL** (MEASURED post-edit, `node _test_runner.js`).

---

## 1. Purpose and Scope

Local control-plane for `SINGLE_COMMIT_TRANSACTION_V1` enabling the later U7/U8
production sequence (1040 create → prepare → deploy → activate once → atomic
writer switch). Zero production actions, props, sheets, writer invocations, or
config mutations executed. All three writers (prep/activation/pause) are
INERT: they exist, are callable, and are never invoked from any business path.

## 2. Config Schema

Single authoritative schema, frozen by T11.2 §20, implemented in
`97.SalesRecognition.V2.Foundation.js` as `SINGLE_COMMIT_TRANSACTION_V1`:

| Field | Type | PREPARED | ACTIVE | PAUSED |
| --- | --- | --- | --- | --- |
| mode | `"PREPARED"\|"ACTIVE"\|"PAUSED"` | `"PREPARED"` | `"ACTIVE"` | `"PAUSED"` |
| contractVersion | `"SINGLE_COMMIT_TRANSACTION_V1"` | ✓ | ✓ | ✓ |
| activationID | `""` | `""` | `"SCA-<uuid>"` | `"SCA-<uuid>"` (preserved) |
| activatedAt | `""` (ISO 8601) | `""` | server ISO | server ISO (preserved) |
| configVersion | integer ≥ 1 | 1 | 1 (carried forward) | 1 (carried forward) |

Independent from `SALES_RECOGNITION_V2` and `TREASURY_RECEIPT_V1` configs.
`ABSENT` = valid pre-migration, not persisted. `REJECT` = explicit fail-closed
mode with no identity constraint. `PREPARED`-with-identity = `UNRESOLVED`
(sticky: once-activated can never pose as PREPARED). `ACTIVE`-without-identity
= `UNRESOLVED`.

## 3. State Machine

```
ABSENT ──PREP──▶ PREPARED ──ACTIVATE──▶ ACTIVE ──PAUSE──▶ PAUSED
                   │                      │                   │
                   │ (repeat: NOOP)       │ (repeat: NOOP)    │ (repeat: NOOP)
                   ▼                      ▼                   ▼
               PREPARED               ACTIVE               PAUSED
                   │                      │                   │
                   └──── REFUSE ──────────┴──── REFUSE ───────┘
                        (no re-activation, no re-prep from non-PREPARED)
```

- ABSENT/PREPARED-never-activated → legacy routing (no composed money leg).
- ACTIVE → T11 routing (composed money leg required).
- PAUSED-after-authority → reject NEW writes, NO legacy fallback.
- INVALID/UNRESOLVED → fail-closed admission, never erase reader truth.
- RECOVERY (IN_PROGRESS operation) → resumes without admission re-evaluation.

## 4. Sticky Intent

Ever-activated ⇒ PAUSED ≠ legacy. ActivationID/configVersion are sufficient;
no invented fields. A PREPARED config carrying activation identity is
UNRESOLVED (refused on every domain), not routed to legacy.

## 5. Routing Matrix (identical across Sales/Expense/Purchase)

| Config state | Sales | Expense | Purchase |
| --- | --- | --- | --- |
| ABSENT | allowed, no composed leg | LEGACY | LEGACY |
| PREPARED (never-activated) | allowed, no composed leg | LEGACY | LEGACY |
| ACTIVE | allowed, composed required | ACTIVE | ACTIVE |
| PAUSED | refused (SINGLE_COMMIT_MODE_PAUSED) | REFUSE | REFUSE |
| UNRESOLVED/invalid | refused (SINGLE_COMMIT_CONFIG_INVALID) | REFUSE | REFUSE |
| REJECT | refused (SINGLE_COMMIT_CONFIG_INVALID) | REFUSE | REFUSE |
| RECOVERY (IN_PROGRESS op) | resumes from stored plan | resumes | resumes |

No legacy fallback on PAUSED/REJECT/UNRESOLVED for any domain (zero writes).

## 6. PREP Writer

`prepareSingleCommitTransactionV1Production` (`101.SingleCommit.Config.Control.js`)

- Lock: `LockService.getScriptLock()`, 30s timeout.
- In-lock read: `singleCommitControlReadPropertyState_` (zero-write).
- Refuse unsafe overwrite: ABSENT → write; PREPARED → `NOOP_ALREADY_PREPARED`;
  ACTIVE/PAUSED/REJECT/INVALID → `STOP_*`, never downgrade.
- Validate prerequisites per future stage: §20 freezes zero schema changes,
  so no sheets to create, no account prerequisite. PREP is legal before 1040
  exists; ACTIVE is impossible until 1040 exists (activation writer enforces).
- ONE config write: `properties.setProperty(CONFIG_PROPERTY, payload)`.
- Readback: exact five-field comparison before claiming success.
- Never creates 1040/rows/activates. Runtime carries properties only.

## 7. ACTIVATION Writer

`activateSingleCommitTransactionV1Production`

- ONE `LockService.getScriptLock()`, 30s timeout.
- In-lock revalidate (every gate inside the lock before any write):
  1. PREPARED-eligible (config state machine).
  2. contractVersion exact.
  3. T11 schema/op authorities: `salesRecognitionV2SaveSchemaGate_`,
     `expenseSingleCommitSchemaGate_`, `purchaseSingleCommitSchemaGate_`,
     `readCanonicalTable(ops)`.
  4–7. Accounts: 1040 exact §11 (row must exist by activation), 6210 Policy C
     shape (Expense/DEBIT), 1030 clearing, 4000 Revenue.
  8. Sales V2 compatible: separate `SALES_RECOGNITION_V2` config VALID+ACTIVE.
  9. T5/reader prerequisites: `buildTreasuryClearingProjection_`,
     `buildTreasury1030Reconciliation_` run clean.
  10. Aggregate reader recognizes 1040 (`AGGREGATE_MONEY_ACCOUNT_CODES`).
  11. UNEXPLAINED 1030 RESIDUAL == 0 (NOT net1030 == 0 — transitional 24k net
      acceptable, explainable, not blocker).
  12. Transitional 24k explainable (residual 0).
  13. Treasury compatible config (absent or valid, never malformed).
  14. Schema/config integrity (readbacks).
- Server ActivationID/At: `runtime.uuid()` + `runtime.now()`, both server-side.
- ONE config write: `properties.setProperty(CONFIG_PROPERTY, payload)`.
- Readback: exact five-field comparison; mismatch → `STOP_CONFIG_READBACK_MISMATCH`.
- Never creates 1040/ledger/transactions/clears 24k/invokes domain writers.

## 8. PAUSE Writer

`pauseSingleCommitTransactionV1Production` — control-plane only.

- Lock + in-lock read (same reader).
- Preserve activation identity + version; only mode flips ACTIVE→PAUSED.
- No RBAC. No reactivation path exists (deferred to future owner-authorized unit).
- ONE config write + readback.

## 9. Idempotency

- PREP repeat: `NOOP_ALREADY_PREPARED`, zero-mutation, no version inflation.
- ACTIVATION repeat/concurrent: same ActivationID, zero mutation, one winner.
- PAUSE repeat: `NOOP_ALREADY_PAUSED`, zero-mutation.

## 10. Crash Model

- Identity generated BEFORE setProperty.
- UNKNOWN-after-write replays converge to same ID.
- Lock timeout: `LOCK_TIMEOUT`, zero mutation.
- setProperty failure: `STOP_CONFIG_WRITE_FAILED`, store untouched.
- Readback mismatch: `STOP_CONFIG_READBACK_MISMATCH`, persisted identity remains
  authoritative for retry.

## 11. Activation Prerequisites (frozen revalidation list)

See §7 steps 3–14. All gates run inside the lock before any write. Each gate
returns a specific `STOP_*` code on failure.

## 12. 1030 Residual-vs-Net

- UNEXPLAINED 1030 RESIDUAL must be exactly 0.
- LedgerNet1030 (transitional 24k net) is acceptable and NOT a blocker as long
  as residual is 0. The transitional 24,000 is explainable and owned by U10.
- Activation never compares LedgerNet1030 against 0.

## 13. Isolation Proof

Call-graph proof that prep/activation/pause cannot reach:
Sales/Expense/Purchase saves, ledger append, T4/T6, PurchaseEvent/tabops/
Order/Recognition append, transitional close, account-creation.

Static isolation (test 49): no financial writer, ledger writer, sheet writer,
transport, or transitional-close concept is reachable from the control plane.
Forbidden tokens checked: `batchUpdate`, `appendCells`, `appendRow`,
`setValues`, `setValue(`, `insertSheet`, `UrlFetchApp`, `SpreadsheetApp`,
`TRANSITIONAL_CLEARING_CLOSE`, `EvidenceRef`, `MANUAL_VERIFIED`,
`saveOperationalOrder`, `salesRecognitionV2SaveWithRuntime_`,
`expenseSingleCommitApplyBatch_`, `purchaseSingleCommitApplyBatch_`,
`submitCanonicalTransaction`, `postPolicyCPurchaseEvent_`,
`runCashSettleAndPersist`, `TreasuryReceipts`, `BalanceLedger`.

## 14. Account-Creation Separation (U7)

Account creation (1040) belongs to U7 and is deliberately NOT reachable from
the control plane. There is no combined create-1040+activate function.
The activation writer enforces 1040 exists by activation; it never creates it.

## 15. Reader-vs-Write

Control plane is config-only. Every reader path (Balance Position, Cash
balance, Cash Flow, T5 clearing, Global 1030, Finance validators, aggregate
funds) is independent of the write-mode gate. PAUSED readers stay truthful;
committed T11 data remains fully readable.

## 16. Exact Future Production Sequence

Frozen order for the U7/U8 production activation:

1. U1–U6 done (Sales/Expense/Purchase single-commit cores + corrections +
   canonical readers green).
2. Precheck: validate all 14 activation prerequisites (read-only).
3. 1040 create (U7, separate unit).
4. 1040 readback: row exists, unique, active, correct metadata.
5. PREP (`prepareSingleCommitTransactionV1Production`).
6. Deploy (`clasp push --force` — R4/Critical, explicit authorization).
7. Post-deploy validation: verify deployed code matches local source.
8. ONE activation (`activateSingleCommitTransactionV1Production`).
9. Activation readback: exact five-field config.
10. Zero financial events: verify no ledger/transaction mutations from
    activation itself.
11. First genuine tx acceptance (real business write routed to T11).
12. Separate U10 24k close (transitional close, separate authorization).

No ACTIVE-without-runtime window. No 1040-forced-before-exists window. No
accidental T11 event during prep. Deploy-before-invoke enforced.

## 17. Package Measurement

Current allowlist manifest: **76 files** (T8/T9/T10.5 precedent).
Prospective manifest (current + control plane): **77 files**.
`101.SingleCommit.Config.Control.js` EXCLUDED today (not allowlisted).
Registration belongs to the future authorized upload unit.

Measured hashes:
- Current: `d91716f49040a0bb507e38fe3d2dbe633aa5f7d0c2a7aee27f4d1fd09555584c`
- Prospective (77): `88a317e03444e2b9e67539f9f70356a37ffd4e68444f95114aa17faae7470de0`
- Control plane SHA256: `cd052ff2b4fb59037c82baf4b13d45fa6512c8a686270c8a61d9f34dd9e1fb2c`

## 18. 24k Isolation

The control plane only READS T5/reconciliation projections; no close writer,
no receipt crafting, no fake evidence. Transition 24k (LedgerNet1030 = 24000,
residual = 0) is explainable and does NOT block activation.

## 19. Tests (MEASURED)

| Suite | Checks | Function |
| --- | --- | --- |
| Reader | 9 | `testSingleCommitConfigReader` |
| Routing | 9 | `testSingleCommitRoutingMatrix` |
| PREP | 4 | `testSingleCommitPreparationWriter` |
| ACTIVATION | 15 | `testSingleCommitActivationWriter` |
| FAILURE | 5 | `testSingleCommitControlFailures` |
| PAUSE | 6 | `testSingleCommitPauseWriter` |
| ISOLATION | 6 | `testSingleCommitControlIsolation` |
| COMPAT | 9 | `testSingleCommitCompatibility` |
| PACKAGE | 3 | `testSingleCommitPackageMeasurement` |
| **Total** | **66** | **All PASS** |

Full regression: **216 PASS / 0 FAIL** (MEASURED, `node _test_runner.js`).

## 20. Mutation Count

**0** — zero production actions, zero config mutations, zero sheet writes,
zero ledger writes, zero account creations, zero 24k closes, zero writer
invocations. All test activity is in-memory fixtures / property stubs.

## 21. Remaining U6–U10

- **U6**: Corrections/Void core (T11.2 §19) — separate unit.
- **U7**: 1040 account creation + activation precheck + deploy + ONE
  activation (production sequence, R4/Critical).
- **U8**: Atomic writer switch (Sales/Expense/Purchase dispatchers).
- **U9**: Production post-activation validation.
- **U10**: Transitional 24k close (separate authorization).

---

## Telemetry

- Agent: numlock-heavy (Free)
- Backend: 9router/numlock-explore-free
- Model: numlock-explore-free
- Reasoning: high
- Fallback: none
- Tool calls: ~120
- Elapsed: ~25 min
- Files read: 12
- Files modified: 8
- Test runs: 3
