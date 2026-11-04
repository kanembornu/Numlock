# Treasury T8 — Integration and Release Evidence Gate

Task: T8_TREASURY_INTEGRATION_AND_RELEASE_EVIDENCE · Phase: NUMLOCK_TREASURY_IMPLEMENTATION
Classification: L3 / R2 · Mode: DEFAULT EVIDENCE_ONLY (zero runtime source change required;
no repair commit needed) · Not a deployment.

## 1. Starting baseline

- HEAD: `dd4d4bf` ("Treasury T7: operator UI and application integration"), ancestry
  includes `8bb0097` (Sol correction), `df93982`/`360c95d..04c2149` chain (T2–T6) as
  required. Expected HEAD verified exactly.
- Tracked worktree clean, index clean (`git diff` / `git diff --cached` empty).
- Untracked at entry: exactly 27 files, all `tests/tmp/u10e-*` (prior U-phases
  artifacts); untouched throughout T8.
- Entering regression baseline: 145 PASS / 0 FAIL (prior-measured at `dd4d4bf`).

## 2. Authority stack (frozen, honored)

T2 > `8bb0097` > T3 > T4 > T5 > T6 > T7; Sales V2 = canonical U3 exposure authority;
BalanceLedger = evidence; Finance = reader. T8 added no writer, no formula, no
authority. All R-scenarios executed through the real T7 public endpoints
(`treasuryOperatorSaveReceipt/Reverse/Correct`, `getTreasuryOperatorWorkspace`,
`getTreasuryOperatorReceiptDetail`) over real T4/T6 writers and the T5 reread, with
fixture-only resolver/config/transport stubs (T7 `treasuryT7WithServerStubs_`
pattern), or through the real `*WithRuntime_` cores for crash injection.

## 3. Package manifest (release candidate)

Determined from the actual `.claspignore` allowlist (verified, not assumed):

- Current upload candidate: **68 files** (67 code + `appsscript.json`), all exist,
  no `tests/`, `docs/`, `_test_runner.js`, `.clasp.json`, or credential path included.
- T7's "76 runtime files" is the FUTURE push-gate count (68 + 8 Treasury files), not
  the current manifest — corrected here (T7 §23 documented exactly this).
- Treasury runtime/UI (99, 99A, 99B, 99C, 99D, 202, 203, 204; 190 already included
  with its Treasury sections) is **prospective**: registration in `.claspignore` is
  the T9 authorized upload-manifest gate, per the documented T3–T7 deferral and the
  U8→U9 precedent (`docs/SALES-RECOGNITION-V2-U8-RELEASE-EVIDENCE.md` §12).
- Prospective candidate (current + 8): **76 files**.
- Artifact: `tests/tmp/t8-package-manifest.json` (per-file sha256 + aggregate hash,
  written by the release harness on every run).

## 4. Package hash (release-candidate fingerprint)

- Current (68) aggregate sha256: `9369d0b6e583afae9a72bdc4325539e7b29eacd047797c5df2c4935286050aba`
- Prospective (76) aggregate sha256: `38b053297c2ed5ff3e70d97f499dc7eac125b2bd12a8d6d4bf28deaa3ffa4125`
- Both hashes identical across the two full regression runs (repeatability).
- No secrets/debug harness in either set; no push performed or implied.

## 5. R1–R20 results (all PASS, real authority paths)

| # | Scenario | Measured result |
| --- | --- | --- |
| R1 | Baseline exposure | 24,000 UNCLEARED, ledger net1030 24,000, residual 0, UI `canSave`, Revenue canonical |
| R2 | Save→1000 via T7/T4 | DONE; delta +1 op/+1 receipt/+2 ledger/+1 audit; Dr1000/Cr1030; T5 CLEARED; oracle cash 1000 +24,000; Revenue unchanged |
| R3 | Same-key replay | `replay=true`, same receiptID, row counts byte-identical (zero write) |
| R4 | UNKNOWN after persistence | Crash `T4_AFTER_INTENT` → op IN_PROGRESS with original key; same-key resume → DONE; exactly 1 receipt; COMMITTED; workspace terminal CLEARED |
| R5 | New key after clearing | REFUSED `TREASURY_ALREADY_CLEARED`, writeCount 0, zero row delta |
| R6 | Concurrent clearing | First DONE, second REFUSED ALREADY_CLEARED; 1 receipt; cash +24,000 once |
| R7 | Reversal | Dr1030/Cr1000 exact; original byte-immutability proven; UNCLEARED 24,000; residual 0; no 2010 line anywhere |
| R8 | Reversal replay/new key | Replay → DONE same ID zero write; new key → REFUSED `TREASURY_ALREADY_REVERSED`; zero row delta |
| R9 | Correction→1010 | DONE; 1000 net 0, 1010 net +24,000, 1030 net 0, CLEARED, active=replacement, history retained (3 receipt rows) |
| R10 | Correction UNKNOWN | Crash `T6_AFTER_INTENT` → same-key resume → exactly 1 reversal + 1 replacement (+ original) |
| R11 | As-of month boundary | 2026-09-30 UNCLEARED 24,000 → 2026-10-05 CLEARED; SalesRecognitionEvents byte-identical (no Sales rewrite) |
| R12 | Correction across period | as-of before receipt UNCLEARED; mid-period CLEARED by original; post-correction CLEARED by replacement; history reconstructible |
| R13 | Sales Void after receipt | EXCEPTION + `SALES_REVERSAL_CONFLICT`; zero auto Treasury writes; second Save REFUSED zero-write; residual 0; no 2010, no refund |
| R14 | Malformed artifact | Forged signature → EXCEPTION + `SIGNATURE_MISMATCH`; reconciliation `TREASURY_INTEGRITY_EXCEPTION` entry; UI capabilities all false (`EXPOSURE_EXCEPTION`); repeated reads write nothing (no auto-repair) |
| R15 | Unmatched 1030 line | residual 5,000 ≠ 0, status `UNEXPLAINED_RESIDUAL`, zero generic-exception entries, surfaced verbatim in operator workspace |
| R16 | Legacy Payment/Settlement noise | Projection + reconciliation byte-identical before/after noise |
| R17 | Destination tamper 1030 | REFUSED `TREASURY_DESTINATION_IS_CLEARING`, zero writes |
| R18 | Amount tamper 20000/25000/23999 | All REFUSED `TREASURY_*`, zero writes each |
| R19 | PAUSED | New Save/Reverse REFUSED `TREASURY_MODE_PAUSED` zero-write; persisted IN_PROGRESS recovery completes under PAUSED; no legacy fallback; ledger exactly 4 rows |
| R20 | UI liveness battery | Real T7 controller over real 202/203/204/190: U86 + L20 checks pass, static 0 failures, mutation 30/30, anchor misses 0 (no immortal spinner/storm/new key/duplicate money) |

## 6. Independent accounting oracle

`t8Oracle_` in the release harness computes, with its own formulas (never calls
`buildTreasury1030Reconciliation_` or T5 totals helpers): per-account debit/credit
sums from BalanceLedger rows; 1030 net; destination nets; Revenue(4000) net;
forbidden-account movement {5000, 1100, 6210, 2010, 2000}; treasury-journal (SourceType
`TREASURY_RECEIPT_V1`) Dr/Cr totals; recognizedNet from signed V2 events
(RECOGNITION + / REVERSAL −, COMMITTED only); clearedNet from receipt lineage where
only receipts whose durable Operation is COMMITTED count (ordinary +, reversal −);
outstanding = recognizedNet − clearedNet; audit coverage per COMMITTED operation.
Oracle was compared against T5 reconciliation/projection and Finance at every healthy
terminal (R1–R11, R13 recon, R19, all 27 crash cells, all healthy concurrency cells,
FIN1–FIN3) — agreement everywhere; circular validation eliminated.

## 7. Global 1030 invariant

At every healthy terminal: independent oracle net1030 == T5 `ledgerNet1030` (and
Dr/Cr totals equal), `unexplainedResidual == 0` / status OK, and
`ledgerNet1030 == outstandingTotal + explicitExceptionAmount`, with independent
outstanding == T5 outstandingTotal. R15 proves the nonzero+visible branch
(residual 5,000 carried to the operator surface). No check relies on T5's own
output alone.

## 8. Finance parity

On the real Finance fixture (`getFinanceDataWithRuntime` + real writers):
Receipt → Revenue unchanged (24,000 before = after), cash 1000 +24,000, 1030 net 0;
Reversal → exact inverse (cash 0 restored), Revenue unchanged; post-reversal Save +
Correction → destination composition moves (1000 net 0, 1010 net +24,000), 1030 net
0, Revenue unchanged at every stage.

## 9. Cash Flow

`buildCashFlowStatement` (real Finance source): receipt classifies Operating +24,000
exactly once (counterpart 1030 `CashFlowGroup=Operating` hard gate, T4 I-suite
re-proven in ACCT4 with blank-group refusal); reversal reverses exactly once
(operating returns to baseline); correction net zero double-count (operating =
baseline +24,000 after the full chain). Mutation M5 proves a duplicated cash line is
detected by the parity arithmetic.

## 10. Balance Position

Recognition 1030 +24,000; receipt dest+ / 1030− (net 0); reversal inverse (1030
restored); correction = reversal+replacement only (composition change, coherent
totals: ledger Dr1030 == Cr1030 == 48,000 across a correction chain, net 0).
Treasury never moved 5000/1100/6210/2010/2000 in any healthy scenario (oracle
forbidden-movement empty everywhere).

## 11. UI/server call graph

UI (204 controller) → exactly the five thin endpoints (regex whitelist, 5 calls,
CG2); no client formula, no client date/destination authority (T7 static S4–S15 pass
inside the gate, CG1). `99D` is delegation-only: no writer/transport/property
primitive (CG3), delegates Save/Reverse/Correct to the T4/T6 cores and workspace to
`buildTreasuryClearingProjection_` + `buildTreasury1030Reconciliation_` (CG4/CG5);
no direct BalanceLedger/Payment/Settlement access in the API or workspace path.

## 12. Authority duplication audit

Exactly one definition site in the prospective runtime set for each authority:
`treasuryDateKey`, `treasuryJournalSignature`, `treasuryDestinationEligible`,
`validateTreasuryReceiptConfig` (99); `treasuryComputeOutstanding_` (99A);
`buildTreasuryClearingProjection_`, `buildTreasury1030Reconciliation_`,
`buildTreasuryClearingExposure_` (99B). Outstanding formula, clearing status,
Revenue (U5 events), destination eligibility, date normalization, RequestKey
durability, journal signature — single authority each; T4's pre-save resolver is a
parity-checked mirror of T5 (P23 contract), not a second writer.

## 13. Forbidden legacy dependency audit

No `Payment`/`Settlement`/`ReceiveVia`/`PaymentMethod`/`Confirm Payment`/`PAID`/
`cashSettleAndPersist`/`attemptCashSettlement`/`submitOperationalPayment`/`RBAC`/
`isAdmin`/`requireRole` token in the Treasury runtime surface (99*, 202–204, 190
Treasury slice) — FORB1/FORB2. Legacy vocabulary proven present only in segregated
legacy runtime (95/95A) and tests — FORB3. Runtime vs docs/tests distinguished.

## 14. Schema / config / account audit

Schema: RECEIPTS 24 / OPERATIONS 10 / AUDITS 11 headers; no stored `Status` column;
sheet names exact; header drift (renamed column) → `SCHEMA_NOT_READY` zero-write
(SCHEMA3 + M10). Config: `validateTreasuryReceiptConfig` fails closed on
null/empty/partial (`mode` alone insufficient); no `.setProperty(` anywhere in the
Treasury runtime (no config mutation helper); missing config → workspace
`allowed=false` + `TREASURY_MODE_PAUSED`-class refusals (CONFIG3, R19/E14-class).
Accounts: destinations exactly {1000, 1010, 1020}, 1030 excluded, no name-based
destination resolution; 1030 readiness enforced (active + `CashFlowGroup=Operating`
+ Finance `UNCLASSIFIED_COUNTERPART` gate present) — blank group refuses pre-write.

## 15. Date/timezone audit

Asia/Jakarta explicit in the foundation/projection authorities; no host-local date
derivation (`toLocale*`/`getDate`/`getMonth`) in any Treasury runtime file; boundary
probe: `2026-09-30T17:00Z` → `2026-10-01`, `16:59:59Z` → `2026-09-30` under the
Jakarta-true stand-in (DATE3); R11/R12 month/period boundaries and T6 F4 Jakarta
month-end behavior re-proven through the T8 chains; `ReceivedAt`/`SavedAt` remain
server timestamps (allowed).

## 16. RequestKey / idempotency audit

Exactly 3 client key-generation sites (one per intent kind); retry path regenerates
nothing and replays the stored payload (KEY1/KEY2 + T7 A13/A14 + L-battery); server
echoes the key and persists it verbatim into Operation/Audit rows (KEY3); no server
path replaces the key (KEY4); UNKNOWN → same-key resume yields COMMITTED exactly-once
(R4/R10 + crash matrix); new-key-after-UNKNOWN produces a detectable inconsistency,
never a silent clean state (M8).

## 17. Error-contract audit

All SAVE + LIFECYCLE codes namespace `TREASURY_*` (ERR1); no value aliases within
either CODES object (ERR2; cross-object repeats are the inherited T3/T4 base strings);
status vocabulary exactly {DONE, REFUSED, UNKNOWN, RECOVERY_REQUIRED (+CONFLICT)} (ERR4);
UI retains distinct UNKNOWN / RECOVERY_REQUIRED handling — not flattened to a generic
error (ERR3 + T7 U/L batteries).

## 18. Cache audit

Fresh commit → exactly one invalidation; REFUSED → zero; committed replay →
re-invalidation with zero writes (T4 H-suite semantics re-proven: CACHE1–CACHE3);
post-COMMITTED cache failure is non-fatal (DONE preserved, CACHE2); UI authority is
the server workspace reread (no stale capability — M16 + T7 liveness); a refresh
failure can never repeat a mutation (retry replays the same key server-side).

## 19. Crash/recovery matrix (27 cells, all PASS)

Boundaries per operation: BEFORE_INTENT, AFTER_INTENT, BEFORE_BATCH, AFTER_BATCH,
AFTER_READBACK, BEFORE_COMMIT, AFTER_COMMIT, AMBIGUOUS_PARTIAL_BATCH, LOST_CALLBACK.

| Class | Cells | Measured behavior |
| --- | --- | --- |
| NO_MUTATION | `*_BEFORE_INTENT` ×3 | Nothing persisted; same-key retry = fresh intent → DONE |
| RECOVERABLE_SAME_KEY | AFTER_INTENT, BEFORE_BATCH, AFTER_BATCH, AFTER_READBACK, BEFORE_COMMIT ×3 ops | Op IN_PROGRESS (± artifacts); same-key resume → DONE; exactly-once lineage; residual 0 |
| COMMITTED (lost callback) | AFTER_COMMIT + LOST_CALLBACK ×3 ops | Op COMMITTED; same-key replay=true, zero writes, same IDs |
| RECOVERY_REQUIRED | AMBIGUOUS_PARTIAL_BATCH ×3 ops | Frozen fail-closed: partial artifacts → RECOVERY_REQUIRED; same-key retry stays RECOVERY_REQUIRED; zero blind repair; invariant holds (uncommitted artifacts never clear) |

Never a new-key retry at any boundary; every cell ends with the global 1030
invariant proven (except R15-class, not part of this matrix).

## 20. Concurrency matrix (6 rows, all PASS)

Save×Save → one owner, second REFUSED ALREADY_CLEARED, cash once. Reverse×Reverse →
one owner, second ALREADY_REVERSED. Correct×Correct → one owner, one lineage.
Reverse×Correct → first wins, counter-op REFUSED (both orders). Save×reversal-
exposure → post-reversal Save is a new sanctioned intent, ≤1 active per lineage.
Stale UI×newer server → server workspace is the sole capability authority (T7
controller battery composed inside the gate). ≤1 valid owner per lineage everywhere.

## 21. Release mutation sensitivity (20/20 caught)

| # | Injected defect/drift | Caught by |
| --- | --- | --- |
| M1 | Treasury module excluded from candidate package | Package manifest inclusion check |
| M2 | UI Save routes to `cashSettleAndPersist` | Endpoint whitelist / no-legacy-writers static guard |
| M3 | Residual warning surface removed | T8 UI audit (warning element required) |
| M4 | Phantom recognition event changes Revenue | Finance revenue isolation check (48,000 ≠ 24,000) |
| M5 | Duplicated receipt cash line | Cash Flow once-only arithmetic |
| M6 | Correction leaves 1030 nonzero (stray line) | Global 1030 invariant (oracle vs T5) |
| M7 | Reversal leaves exposure CLEARED | R7 terminal-status assertion (UNCLEARED required) |
| M8 | UNKNOWN retried with new RequestKey | Exactly-once/consistency probe (duplicate lineage detected) |
| M9 | 1030 destination accepted | Server refusal + zero-write guard |
| M10 | Schema header drift accepted | `SCHEMA_NOT_READY` zero-write guard |
| M11 | Missing config treated as ACTIVE | Fail-closed mode gate + zero-write guard |
| M12 | Host-local (UTC) date authority | Jakarta boundary assertion (2026-10-01 required) |
| M13 | Audit artifact omitted | Oracle per-operation audit coverage |
| M14 | Journal signature omitted/forged | `SIGNATURE_MISMATCH` EXCEPTION detection |
| M15 | Write primitive in a reader module | Reader purity scan |
| M16 | Stale UI capability | T7 liveness battery (controller re-fetch authority) |
| M17 | Legacy Payment/Settlement noise | Projection/reconciliation byte-identity |
| M18 | Reversal touches 2010 | Oracle forbidden-account movement set |
| M19 | Partial amount accepted | Server refusal + zero-write guard |
| M20 | Unexplained residual hidden | R15 residual assertion (suppressed value ≠ measured) |

Prior mutation suites (T3 15, T4 25, T5 25, T6 30, T7 30, U-series proofs) all
remain green in both full runs.

## 22. Full regression repeatability

- Run 1 (final tree): `node _test_runner.js` → **146 PASS, 0 FAIL** (baseline 145 +
  1 new T8 gate).
- Run 2 (same tree, no edits): **146 PASS, 0 FAIL** — identical totals, identical
  T8 evidence summary line, identical package aggregate hashes.
- Static: `node --check` clean on `tests/browser/treasury-t8-release-gate.js` and
  `_test_runner.js`; `git diff --check` clean; HTML/VM surfaces exercised by the
  T7 controller composition inside the gate (202/203/204/190 parse + run).
- No flaky financial test observed across the two runs.

## 23. Runtime source delta

**Zero** production/runtime source change since `dd4d4bf`. T8 added only test/
evidence artifacts: `tests/browser/treasury-t8-release-gate.js` (new), the
`_test_runner.js` registration (2 edits), this document, and the generated
`tests/tmp/t8-package-manifest.json`. No repair commit required. No frozen
semantics touched.

## 24. Production read-only result

Not performed (optional bounded read). No production contact of any kind: no
`clasp run/push/pull/deploy`, no Apps Script execution, no sheet access. Real-
workbook verification (v711 deployment state, V2 ACTIVE, absence of Treasury
schemas/config, current 1030 balance) is a T9 production-preparation activity under
its own command authorization; its unavailability here does not affect the local
release gate. Production writes = 0; deployment/version actions = 0.

## 25. Risk register and release verdict

**Closed (proven T3–T8):** contract/schema/config/eligibility; durable receipt core
with crash-safe same-key recovery; canonical clearing projection + exact 1030
reconciliation with independent-oracle agreement; append-only reversal/correction;
operator UI with liveness and no client authority; integrated chain R1–R20;
no second Revenue authority; no legacy coupling; no duplicate monetary event; no
unsafe retry; hidden-mutation surface = 0.

**Production-prep risks (T9):** (a) upload-manifest registration of the 8 Treasury
files + fresh `clasp status` closure (current candidate = 68; prospective = 76,
hashes above); (b) TREASURY_RECEIPT_V1 PREPARED config in the real workbook;
(c) Treasury sheets (Receipts/Operations/Audits) creation + schema readback;
(d) account recheck (1000/1010/1020 active, 1030 `CashFlowGroup=Operating`) in the
real workbook.

**Activation risks (T10):** mode ACTIVE switch; first genuine receipt; real
destination selection; post-event reconciliation run in production.

**Deferred scope (unchanged):** aggregate settlement, partial payment, fees/MDR,
statement import, auto-match, refunds/2010, AP/disbursement, RBAC, CSV export,
period filters, client caching.

**RELEASE GATE RESULT: `RELEASE_CANDIDATE_READY`** — all local release invariants
measured green (R1–R20, independent oracle, global 1030 invariant, Finance/Cash-Flow/
Balance parity, 41 audit checks, 27 crash cells, 6 concurrency rows, 20/20 release
mutation sensitivity, 146/0 ×2 repeatability, zero runtime source delta). Treasury
upload-manifest inclusion is the named T9 gate (documented deferral, fingerprinted
above), consistent with the U8→U9 production-preparation precedent. Recommend
advancing to T9 production preparation; do not treat this document as deployment
authorization.

---

*Telemetry: agent numlock-explore-free (Free execution authority, Heavy L3/R2 task);
backend `9router/numlock-explore-free`; reasoning high; fallback none (no named
ESCALATION_REASON materialized); delegation none (no downstream specialist needed);
toolcalls UNKNOWN (not instrumented); elapsed UNKNOWN (not instrumented); files
read ~25 (AGENTS/.claspignore/_test_runner, 96.Tests.Treasury.*, 96.Tests.SalesRecognition.V2.Projection/Save/U5,
99/99A/99B(sections)/99C, treasury-t7-operator-controller, sales-v2-u8-release-audit,
T3–T7 docs, U8 release-evidence doc); files modified 4 (`tests/browser/
treasury-t8-release-gate.js` new, `_test_runner.js` +2 registrations,
`docs/TREASURY-T8-INTEGRATION-AND-RELEASE-EVIDENCE.md` new, `tests/tmp/
t8-package-manifest.json` generated artifact); test runs: 6 full `node _test_runner.js`
(1 baseline verification + 4 repair iterations + 2 final measured repeatability runs;
final = 146 PASS / 0 FAIL twice).*