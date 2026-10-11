# T11.3 U1 — Sales Composed Money Leg (local, inert)

STATUS: LOCAL IMPLEMENTATION COMPLETE · INERT UNTIL AUTHORIZED ACTIVATION · ZERO PRODUCTION MUTATION
TASK_ID: T11_3_U1_SALES_COMPOSED_MONEY_LEG
PHASE: NUMLOCK_SINGLE_COMMIT_TRANSACTION_ARCHITECTURE
BASELINE_COMMIT: `338efe8` (T11.2 contract; verified MEASURED this session)
CLASSIFICATION: L3 · R2 · REASONING_EFFORT high · Execution CONTINUE
AUTHORITY: `docs/T11-2-SINGLE-COMMIT-TRANSACTION-CONTRACT.md` §3/§6/§7/§8/§10/§11/§16/§20/§22 (frozen; OPEN_OWNER_DECISIONS=NONE)

---

## 1. Implementation summary

When — and only when — `SINGLE_COMMIT_TRANSACTION_V1` resolves to `ACTIVE`, one
U2 Save durably composes, in ONE immutable plan and ONE atomic
`spreadsheets.batchUpdate`:

- recognition journal Dr1030 / Cr4000 (byte-identical to today), and
- composed money journal Dr1040 / Cr1030 (new, `SALES_MONEY_V2`).

Net normal Sale = Dr1040 / Cr4000 (derived; never a third journal). Per-Sale
1030 net = 0 at DONE. When the config is absent or `PREPARED` (the default),
the Save is byte-identical to the T11.1/T11.2 baseline — current Sales V2
behavior preserved EXACTLY. The feature is explicitly gated; Sales V2
activation state (`SALES_RECOGNITION_V2_CONFIG`) and T11 single-commit state
(`SINGLE_COMMIT_TRANSACTION_V1`) are separate keys, read separately, never
overloaded.

## 2. Exact files changed

| File | Change |
| --- | --- |
| `97.SalesRecognition.V2.Foundation.js` | +`SINGLE_COMMIT_TRANSACTION_V1` (config key/modes/codes), +`SINGLE_COMMIT_MONEY_POLICY` (§11 metadata + §3 writer identities), +`singleCommitTransactionConfigState_` (pure parser), +`singleCommitTransactionSalesGate_` (pure mode gate), +`preflightSingleCommitMoneyAccount` (pure 1040 preflight). Existing functions untouched. |
| `97A.SalesRecognition.V2.Save.js` | +`salesV2SingleCommitGate_` (read-only resolver: injected raw or ScriptProperties read; NEVER writes); new-intent gate after the V2 request gate; 1040 precondition before business mutation; plan builder money context; value-range concat (BalanceLedger 4 rows); plan-verification money checks; artifact-inspection money group; apply-batch row count derived from frozen ranges. Resume path untouched (no mode gate). |
| `96.Tests.SingleCommit.SalesMoney.Cases.js` | NEW — 5 focused suites, 86 checks (task required ≥26). |
| `_test_runner.js` | Registration only: 1 file entry + 5 `run(...)` entries. |
| `tests/tmp/t8-package-manifest.json` | Regenerated artifact of the T8 gate (per-file sha256) because 97/97A content changed; written automatically by `treasury-t8-release-gate.js:106` on every run. No hand edit. |
| `docs/T11-3-U1-SALES-COMPOSED-MONEY-LEG.md` | This evidence document. |

Not modified: `97C` (correction = U6), `97B`/`99B`/`36`/`40` (readers = U4),
`97D`/`97E` (Sales V2 operator/activation), `194`/`195` (UI already
compliant), `.claspignore` (unchanged; 76 allowlist entries; tests remain
excluded), all `tests/tmp/u10e-*` (untouched).

## 3. Config / gating (A)

- Key (frozen §20): `SINGLE_COMMIT_TRANSACTION_V1`, JSON
  `{ mode: "PREPARED"|"ACTIVE"|"PAUSED"|"REJECT", configVersion, activationID?, activatedAt? }`.
- `configVersion` required (versioned); activation fields optional (U5 owns
  activation semantics/writer — no writer exists here).
- Resolution: absent/blank → `ABSENT` (= PREPARED, inert); invalid JSON /
  unknown mode / bad version → `UNRESOLVED` → refuse `SINGLE_COMMIT_CONFIG_INVALID`
  (never a fallback, §20). `PAUSED` → new saves refuse
  `SINGLE_COMMIT_MODE_PAUSED` (§22). `ACTIVE` → composed leg required.
- Scope: the gate runs ONLY in `salesRecognitionV2SaveNewIntent_`, after the
  existing `salesRecognitionV2RequestGate(config)` (V2 gate first: V2 PREPARED
  still refuses `V2_NOT_ACTIVATED` before T11 is consulted). Resume/replay
  paths never re-gate (sticky recovery, proven by test I8 and by D3/D4/D5/D6-D9
  resuming with NO config present).
- Resolver reads ScriptProperties at most once per new intent (read-only; no
  `setProperty` anywhere — test I6). Injected runtimes carry
  `singleCommitConfig` for local determinism; the local runner has no
  `PropertiesService`, so every legacy suite resolves ABSENT → inert.
- No production config writes; no activation writer (U5/U8 units own those).

## 4. Plan delta (B)

When ACTIVE, `salesRecognitionV2SavePlan_` adds EXACTLY (T11.2 §7):

- `composedMoney: true`
- `moneyJournalID` = `transactionStableBootstrapId_("SRV2M-", [OrderID])`
  (stable-bootstrap like `SRV2J-`; §3/§16)
- `moneyRows[2]`: line −1 Dr1040 X / Cr0, line −2 Dr0 / Cr1030 X
  (X = orderTotal), `Tanggal` = economicDate, `MovementType` = `SALES_MONEY`,
  `SourceType` = `SALES_MONEY_V2`, `SourceID` = recognitionID,
  `ExternalRef`/`Keterangan` empty, `IsActive` true, actor/timestamps frozen
  like the recognition rows
- `moneyJournalSignature` = `policyCJournalSignature_(moneyRows)`
- `accounts.money` = `"1040"`

Recognition rows, eventRow, auditRow, orderRow, lineRows, lineAuthority,
recognition `journalSignature`, normalizedPayload, payloadHash: byte-identical
to the inert plan (tests M5/M6: stripping money context + digest leaves
byte-equal plans for the same intent). Legacy plans gain NO new keys (test
G1/G2/G3). `planDigest` is computed over the full plan (money context
included) — tests I5 (digest breaks when money amount changes or money is
stripped), D6-D10 (stored-plan tamper of amount/signature/SourceType/account/
stripped-leg all fail closed with the exact frozen reason).

Plan verification additions (§7): money pair completeness, `SRV2M-`
derivation, LineIDs −1/−2, SourceType/MovementType/SourceID, 1040-debit /
1030-credit mapping, amounts = orderTotal, date = economicDate, signature
recompute, and `orderTotal Dr − Cr across 1030 lines = 0`
(`SALE_1030_NET_NONZERO`). Non-composed plans carrying money keys fail closed
(`MONEY_FIELDS_UNEXPECTED` / `MONEY_PLAN_INCOMPLETE`).

## 5. Batch delta (C)

ONE `salesRecognitionV2SaveValueRanges_` call, ONE batch, same five surfaces in
frozen order (§8): Orders 1 · OrderLines N · SalesRecognitionEvents 1 ·
BalanceLedger **4 rows (2 recognition + 2 money)** · SalesRecognitionAudits 1.
The BalanceLedger subrequest is built as `journalRows.concat(moneyRows)` — the
recognition pair is never separable from the money pair. Apply-batch `writeCount`
derives from the frozen ranges: 7 inert → 9 composed (test M1a/M2a; exact
delta vs inert baseline = **+2 BalanceLedger lines only**, all other surfaces
and the operation row equal — M1/M2 + inert/composed fixture comparison).
Bounds (`MAX_BATCH_CELLS`/`MAX_CELL_CHARS`/`MAX_REQUEST_BYTES`) re-evaluate
automatically over the larger ranges. No second ScriptLock, no second
RequestKey, no second batch, no T4 call.

## 6. SourceType / identity / signature

| Element | Frozen value (T11.2 §3/§7) |
| --- | --- |
| JournalID | `SRV2M-<OrderID>` (stable bootstrap) |
| LineIDs | `SRV2M-…-1` / `SRV2M-…-2` |
| MovementType | `SALES_MONEY` |
| SourceType | `SALES_MONEY_V2` |
| SourceID | recognitionID (`SCR-<OrderID>`) |
| Signature | `policyCJournalSignature_(moneyRows)` → `moneyJournalSignature` in plan |
| Recognition journal | `SRV2J-`/`SALES_RECOGNITION`/`SALES_RECOGNITION_V2` — unchanged |

Void/correct money reversals (`SRV2MV-…`, §10) are U6 scope, NOT implemented
here.

## 7. Replay / recovery (D)

Existing Sales RequestKey = sole operator intent key (test M9: one
`TransactionOperations` row, OperationType `SALES_RECOGNITION_V2_SAVE`,
plan/payload hashes equal). MEASURED:

- Replay of a committed T11 sale → DONE `replay:true`, `writeCount 0`,
  snapshot unchanged (D1).
- Same key + different payload → `CONFLICT/OPERATION_PAYLOAD_CONFLICT`,
  zero writes (D2).
- UNKNOWN before batch → IN_PROGRESS, zero artifacts; resume (WITHOUT any
  config) completes recognition + money together from the stored plan (D3).
- Crash after batch / after readback → resume verifies exact artifacts and
  commits; no second write (D4/D5).
- Stored-plan tamper: amount / signature / SourceType / account mapping →
  `RECOVERY_REQUIRED/IDENTITY_CONFLICT` with the exact reason, zero writes
  (D6-D9); stripped money leg → `PLAN_DIGEST_MISMATCH` (D10); legacy plan
  augmented with money → fail closed (D11/D12).
- Committed-artifact tamper → `MONEY_TAMPERED`; missing money rows →
  `ARTIFACTS_INCOMPLETE/MONEY_JOURNAL` (recognition-without-money can never
  verify complete); duplicate money row → `MONEY_DUPLICATE`; foreign money
  journal under our derived identity on a legacy plan → `MONEY_LEG_UNEXPECTED`
  (D13-D16).
- No internal new intent key anywhere; no intermediate "saved but money
  pending" state (DONE only after both ledger signatures/readbacks valid +
  COMMITTED readback + cache invalidation, inherited unchanged).

## 8. 1040 precondition (§11)

When ACTIVE, before any business mutation: `preflightSingleCommitMoneyAccount`
requires exactly one `1040` row, active, and exact metadata
(`Operational Funds` / `Asset` / `Current Assets` / `Operating` / `DEBIT`).
Absent → `ACCOUNT_ABSENT`; duplicate → `ACCOUNT_DUPLICATE`; inactive →
`ACCOUNT_INACTIVE`; wrong type/balance/name/flow group →
`ACCOUNT_METADATA_MISMATCH` (no blank-value tolerance). All refuse with zero
writes (operation rows 0, batches 0, authority reads 0, sheet snapshots
unchanged — tests P1-P5). **No fallback to 1000/1010/1020/1030 and no
name-inferred account is possible** (I3: composed ledger accounts ⊆
{1040, 1030, 4000}; legacy money accounts never touched). When disabled the
1040 check never runs (current Sales V2 exactly).

## 9. Accounting

- Recognition pair: Dr1030 X / Cr4000 X — unchanged byte-identically (M5).
- Money pair: Dr1040 X / Cr1030 X (M4).
- Net normal Sale: Dr1040 / Cr4000 derived (M7: ledger net 1040 = +X,
  4000 = −X, 1030 = 0).
- Per-Sale 1030 net = 0 (plan-level M8 + artifact-level
  `SALE_1030_NET_NONZERO` checks). Global 1030 may remain the transitional
  24,000; no test assumes global 1030 zero; transitional fixture untouched
  (I4: composed saves write only `SALES_RECOGNITION_V2`/`SALES_MONEY_V2`
  identities, never `TRANSITIONAL_CLEARING_CLOSE`, never `SCR-CE122B27…`).
- Revenue: money leg has ZERO Revenue effect — U3 projection over composed vs
  inert fixtures: identical events, `recognizedRevenue` = 60,000 both,
  `ledgerRevenueCredits` = 60,000 both, active-view revenue identical
  (M10a-c); U3/U4/U5 suites green without modification (no U3 reader change).

## 10. Treasury isolation (K) / payment-field absence (H)

- WRITE_SURFACES unchanged (5 surfaces; no TreasuryReceipts, no Payments, no
  Settlements, no InventoryLedger; Accounts never written) — I1.
- No sheet named TreasuryReceipts/TreasuryOperations appears; plan JSON has no
  `EvidenceRef`/`MANUAL_VERIFIED`/`TreasuryReceipt`/destination/receipt fields
  (I2).
- No payment/channel input: normalized payload keys remain exactly
  `requestKey, orderType, lines` (line keys unchanged) — I2b; Sales V2 UI
  untouched (already compliant); retired guards unaffected (U7 suites green).
- Source audits: new-intent/gate/range/transport sources carry no
  Treasury-receipt/evidence/surface tokens, append-only `appendCells`, no
  `formulaValue`, config layer has no `setProperty` (I6/I7).
- T4 is never reachable from the composed path: no T4 function is called, no
  destination selection, no second lock/RequestKey (source: only the existing
  outer lock + `SALES_RECOGNITION_V2_SAVE` identity).

## 11. Correction-lineage readiness (J) + remaining U6 work

Plumbed (inseparable lineage only): the composed leg is deterministically
locatable by U6 via `JournalID SRV2M-<OrderID>` (stable-bootstrap derivation
tested), `SourceType SALES_MONEY_V2`, `SourceID = RecognitionID`,
`MovementType SALES_MONEY`, all inside the committed operation's frozen plan
(`moneyJournalID`/`moneyRows`/`moneyJournalSignature` keys) (I9).

Remaining for U6 (NOT implemented here, per §10):

- `SALES_V2_VOID`: append money reversal Dr1030 / Cr1040 under
  `SRV2MV-<OrderID>`, SourceID = void recognitionID, inside the existing void
  batch; 1030 lifecycle net 0 through void.
- `SALES_V2_CORRECT`: money reversal of the original + replacement money leg
  `SRV2M-<newOrderID>` in the same mutation batch; never a delta.
- Void/correct plan verification + artifact inspection for money rows; T5
  (`99B`) composed-clearing expectation rules (§15) remain U4 scope.

## 12. Tests (L) — MEASURED

- Baseline (pre-change, MEASURED this session): `node _test_runner.js` →
  **181 PASS / 0 FAIL**.
- Focused U1 suites (new, MEASURED): 5 suites / **86 checks** —
  `testSalesComposedMoneyGateInert` (G1-G11: inert parity incl. byte-identical
  plan, config matrix PAUSED/invalid/REJECT/version/mode, pure parser/gate
  matrices, V2-vs-T11 gate order) ·
  `testSalesComposedMoneyPreflight1040` (P1-P7: missing/duplicate/inactive/
  wrong-type/wrong-balance all REFUSED zero-write, valid proceeds, pure
  preflight unit incl. blank-balance exactness) ·
  `testSalesComposedMoneyPlanBatch` (M1-M11: one batch [1,2,1,4,1], money pair
  exact, recognition byte-identical, stripped-plan parity, net Dr1040/Cr4000,
  per-Sale 1030 = 0, single RequestKey, U3 Revenue parity 60,000/60,000,
  recognition signature contract unchanged) ·
  `testSalesComposedMoneyDurability` (D1-D16: replay zero-write, payload
  conflict, UNKNOWN pre/post-batch recovery, readback crash, 4 plan-tamper
  reasons, stripped-leg digest, legacy-augment fail-closed, committed
  tamper/missing/duplicate/foreign-money fail-closed) ·
  `testSalesComposedMoneyIsolation` (I1-I9: surfaces, payment-field absence,
  no legacy fallback, transitional untouched, digest coverage, reader/writer
  purity, no-mode-gate-on-resume, correction lineage).
- Full regression after final source modification (MEASURED):
  `node _test_runner.js` → **186 PASS / 0 FAIL** (baseline 181 + 5 new;
  includes all pre-existing Sales durability/recovery, U1-U8 mutation proofs
  and source audits, Treasury T3-T10.5 incl. shared-ledger-fixture suites,
  Finance/Cash Flow).
- `node --check` on every changed/new `.js` file: PASS.
- `git diff --check`: clean.

## 13. Mutations this unit

| Class | Count |
| --- | --- |
| Production writes (sheets/properties/ledger) | **0** |
| `clasp` execution (any, incl. read) | **0** |
| Config writes / activation writer | **0** |
| Pushes / deploys | **0** |
| Financial events in production | **0** |
| Accounts 1040 created | **0** (prospective only) |
| Transitional 24k close | **0** (not executed) |
| Git commits (this unit) | 0 (commit pending; Heavy does not attempt git) |

## 14. Remaining / deferred

- **U6**: Sales Void/Correct money reversal + replacement semantics (§10) as
  listed in §11 above.
- **U2-U5, U7-U10 (T11)**: Expense core, Purchase core, T5/readers, activation
  plumbing, 1040 creation, activation, production acceptance, transitional
  close — all untouched/deferred per contract.
- **U4 readers**: Cash Flow `cashAccountCodes`+composition, Balance aggregate,
  T5 composed-clearing rules — not required for inert operation.
- Preconditions for future activation (U8): 1040 row per §11 must exist;
  until then ACTIVE mode refuses CLOSED (by design).

Local evidence this session: baseline `node _test_runner.js` 181/0 →
final `node _test_runner.js` **186 PASS / 0 FAIL** MEASURED; `git diff --check`
clean; `node --check` clean on 5 changed/new JS files.
