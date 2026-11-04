# SALES_RECOGNITION_V2 — U8 Integration Release Evidence

TASK_ID: U8-INTEGRATION-RELEASE-EVIDENCE-01 · Complexity L3 · Risk R1 (local-only:
read + test + evidence) · Verdict: **COMPLETE — READY FOR U9 GATE**

## 1. Baseline and environment

- Baseline gate (verified once): HEAD `ccf42c65aff8269b3b3e66cf9cb96852af30fb45`
  (= required `ccf42c6`), worktree clean at start. Never reset/checked out/cleaned.
- Baseline harness before U8: `node _test_runner.js` → **82 PASS, 0 FAIL**.
- Environment: local Node VM harness only. Real production functions executed
  over an in-memory workbook fixture with the actual required schemas, an
  in-memory operations repository (fresh-readback semantics), an injected
  batch seam, and a mocked Sheets REST transport. No production contact, no
  network, no clasp, no Apps Script runtime, no browser process.

## 2. Scenarios A–R (measured)

All scenarios executed inside the seven new U8 suites; every row below is a
measured assertion that passed in the final regression (section 8).

| Scenario | Suite (marker) | Key measured evidence |
| --- | --- | --- |
| A Fresh V2 E2E | U8EndToEnd (`SALES_V2_U8_E2E`) | operator-boundary response (`salesCohort=V2_COMMITTED`, `recognitionStatus=RECOGNIZED`, no payment fields) → exactly 1 operation (COMMITTED, `SALES_RECOGNITION_V2_SAVE`), 1 Order header, 2 OrderLines, 1 event, 1 audit; journal = exactly Dr1030/Cr4000 for 60,000; no InventoryLedger sheet, Payments/Settlements header-only, no 5000/1100/2010/1000 journal row, no fabricated payment method; U3 projection (1 event, 60,000, 0 issues) → U4 Sales list/detail/All parity (60,000, snapshots) → U5 P&L Revenue 60,000 with `revenueAuthorityComplete=true`, `cogs=null`, `grossProfitAvailable=false` |
| B Duplicate submit ×N | U8EndToEnd B1–B3 | 2 operator replays + 1 core replay of the same RequestKey → all succeed; core replay `status=DONE, replay=true, writeCount=0`; row counts byte-identical; still 1 operation/order/event |
| C Lost response after COMMITTED | U8EndToEnd C1–C6 | crash at `V2_AFTER_COMMIT` → `{success:false, unknown:true, requestKey kept}`; persisted operation COMMITTED with exact artifacts; `salesV2OperatorFindOperationByRequestKey_` discovers the authority; retry verifies + replays DONE (`replay=true`, `writeCount=0`), same OrderID, zero duplicate appends; production recovery dispatcher (`salesV2OperatorRecoverWithRuntime_`) returns the same COMMITTED row |
| D Unknown/partial/conflict | U8EndToEnd D1–D5 | HTTP 429 → server UNKNOWN `BATCH_OUTCOME_UNKNOWN`, identity kept, one batch only (no in-call retry), operation IN_PROGRESS, no rows; retry recovers exactly (1 order, 1 event); partial mid-batch write → `RECOVERY_REQUIRED`/`ARTIFACTS_INCOMPLETE`, zero repairs on retry; changed payload under same key → definite `CONFLICT`, operation row (identity) never discarded |
| E Void E2E | U8Lifecycle E1–E10 | original event/order rows byte-identical after void; deltas exactly Events+1/Ledger+2/Audits+1; reversal `REVERSAL` event, `−36,000`, `EconomicDate=2026-11-20` (action period); reversal journal Dr4000/Cr1030 only; protected sheets byte-equal (no Cash/refund/2010/Inventory/HPP-COGS); U3 original+reversal signed, activeView empty, 0 issues; U4 voided view shows original inactive; detail `VOIDED`, canVoid/canCorrect false, lineage 2; U5 Oct unchanged 36,000 / Nov −36,000 |
| F Correct E2E 36,000→41,000 | U8Lifecycle F0–F9 | multiline original (2 lines); full replacement `orderTotal=41,000` (never delta-only); deltas Orders+1/OrderLines+1/Events+2/Ledger+4/Audits+2; new Revision/Recognition/journal/audit/line IDs; no 5,000 artifact anywhere; retry after post-freeze price change replays with `writeCount=0` and the frozen plan (Orders total stays 41,000); U3 activeView = replacement only (41,000); U4 active replacement + original Voided; U5 signed events −36,000 and +41,000 in Nov (never a lone +5,000 event), Oct 36,000, Nov 5,000 |
| G Correct-vs-Void concurrency | U8Lifecycle G1–G3 | Void-then-Correct → Correct `REFUSED`, zero writes, one reversal, no issues; Correct-then-Void → Void `REFUSED`, zero writes, lineage valid (reversal bound to original, replacement `OriginalID` = original RecognitionID); pending-intent race → loser `SALES_V2_MUTATION_EXISTS`, zero batches. Exactly one terminal winner, no dual terminal history |
| H Historical pre-V2 | U8Cohorts H1–H6 | unpaid old Order → Revenue 0 + `OLD_ORDER_UNPAID_EXCLUDED`; paid old Order → 36,000 exactly once (ledger 4000 credits non-additive), historical 5000/1100 rows intact (exactly 1 each); historical payment + fulfillment allowed on the old order while a V2 order in the SAME repository refuses both; sheet snapshot unchanged after servicing; date-only order never V2; under fixture ACTIVE old order stays `""` cohort while V2 order is `V2_COMMITTED`; paid detail = `PRE_V2_ORDER`, analytical HPP 15,130.58, canCorrect/canVoid false |
| I Legacy TabSal | U8Cohorts I1–I5 | active Sales = exactly {legacy active, paid old, V2, replacement}; voided legacy only in voided view; Finance counts legacy row once (10,000); V2 Correct/Void reject legacy identity (`SALES_V2_LEGACY_IDENTITY_REJECTED`, zero writes); legacy void/correct handlers reject V2 identity (`TRANSACTION_NOT_FOUND`); tabsal byte-identical to build state (no migration) |
| J Mixed-cohort parity | U8Cohorts J1–J5 | U3 signed Oct +186,000 / Nov −39,000 = U5 Revenue (events authority) = `u5EventsRevenue_`; activeView = 4 chains, 147,000, exactly the 3 expected informational issues, 0 recovery issues; U4 Sales identities exact + recent-parity; unresolved counts surfaced (`unresolvedCount>=2`, integrity 0, recovery 0, `revenueAuthorityComplete=true`); **why U4 active total ≠ U5 period Revenue**: Oct active = 106,000 vs Revenue 186,000, difference 80,000 = voided original (40,000) + superseded original (40,000) retained only in signed history |
| K Policy C | U8PolicyModes K1–K5 | Oct (prospective): Revenue 186,000 − material 120,000 − opex 7,000 − depreciation 5,000 = net 54,000; `cogs=null`, `grossProfit=null`, `grossProfitAvailable=false`; 6210 exactly once, tabops expense counted once; all 12 SRV2J* journal rows touch only 1030/4000 (no Sales HPP posting), historical 5000/1100 = the untouched paid chain; `hppAnalytical` available on detail; pre-transition behavior intact (09-30 legacy 9,000/cogs 1,000/GP available; 10-01 prospective; split 59,000) |
| L Mode transitions | U8PolicyModes L1–L5 | PREPARED → legacy writer only, no V2 operation, default config PREPARED with empty activation, request gate denied; ACTIVE → legacy dispatcher `SALES_V2_LEGACY_SALES_RETIRED`, V2 failure → unknown with zero legacy fallback; PAUSED → `V2_MODE_PAUSED`, zero writes, persisted intent recovers under PAUSED (COMMITTED); date-signal-only order never V2; resolved production config still PREPARED with no timestamp after the sequence (no date-only switch, no production T) |
| M Forbidden payment/fulfillment | U8GuardsIntegrity M0–M8 | every discovered server mutation path attempted against a committed V2 order, all refuse pre-mutation: `createDurableOperationalPayment_`, `payOperationalOrderWithRepository` → `SALES_V2_PAYMENT_RETIRED`; fulfillment PREPARING/READY/COMPLETED → `SALES_V2_FULFILLMENT_RETIRED`; `buildCashPostingCandidate` → `SALES_V2_NO_CASH_POST` (writeCount 0, readOnly); legacy void/correct on V2 identity → `TRANSACTION_NOT_FOUND`; legacy SALES create under ACTIVE → `SALES_V2_LEGACY_SALES_RETIRED`; RPC wrappers proven to route through the guarded cores (server-side, not UI-dependent); repository state + protected sheets byte-identical after ALL attempts |
| N Integrity conflicts | U8GuardsIntegrity N1–N10 | duplicate RecognitionID → surfaced, counted once; missing event under COMMITTED op → `COMMITTED_OPERATION_RECOGNITION_MISSING` + replay `RECOVERY_REQUIRED` + no repair; wrong journal account → `RECOGNITION_JOURNAL_MISMATCH`, event excluded, P&L `integrityConflictCount>=1`, Revenue only the valid legacy 10,000; wrong amount → `RECOGNITION_AMOUNT_MISMATCH`, no false Revenue; orphan owner → `RECOGNITION_OWNER_MISSING`, 0 events; tampered audit → replay not DONE, zero writes; duplicate reversal → `MULTIPLE_TERMINAL_REVERSALS` + `DUPLICATE_RECOGNITION_ID`, counted once; invalid lineage → `INVALID_REVERSAL_LINEAGE`, revenue preserved; corrupted OperationPlan → `RECOVERY_REQUIRED`, identity retained, zero writes; partial set → `RECOVERY_REQUIRED`, zero writes. Valid records usable throughout (legacy row stays visible/revenue-bearing where permitted) |
| O Master changes after commit | U8GuardsIntegrity O1–O4 | price/standard-cost/product+variant-active changes after commit → U3 totals+events, U4 detail (status/revenue/IDs/HPP/snapshots), U5 Revenue all byte-identical (50,000); new Correction intent freezes current authority once (persisted plan byte-identical on retry after a further post-intent price change; replacement total exactly the frozen 41,000); final projection clean, Oct 50,000 / Nov +1,000 |
| P Period boundaries | U8PolicyModes P1–P4 | 09-30/10-01 split exact (59,000 = 9,000 + 50,000, no off-by-one); month Oct 186,000 / Nov −39,000; year-end and 2027 empty periods are true zeros with complete authority; original period re-read unchanged after later reversal/correction (no prior-period rewrite) |
| Q Account preflight | U8Preflight Q1–Q5 | valid 1030 (`Sales Settlement Clearing`/Asset/Current Assets/DEBIT/active) + 4000 + 2010 rows → PASS; missing/duplicate/wrong-metadata/inactive 1030 → `ACCOUNT_ABSENT`/`ACCOUNT_DUPLICATE`/`ACCOUNT_METADATA_MISMATCH`/`ACCOUNT_INACTIVE`; Save refuses with zero operations/batches and zero auto-create (Accounts rows unchanged); 2010 never written or posted (`Accounts` not a write surface, no 2010 ledger row, no 2010 literal in the V2 cores) |
| R Schema preflight | U8Preflight R1–R7 | correct schema → DONE with one batch; missing sheet, missing column, duplicate column, authoritative header reorder, incompatible legacy header shape → `REFUSED/SCHEMA_NOT_READY` with zero operations and zero batches; Orders header unchanged; no auto-migration (no rows gained on any V2 surface) |

## 3. Cross-surface identity matrix (measured, deterministic IDs)

Save chain (`U8_IDENTITY_MATRIX_SAVE`):

| RequestKey | OperationID | OrderID | RevisionID | RecognitionID | JournalID | AuditID |
| --- | --- | --- | --- | --- | --- | --- |
| u8-e2e-1 | TXOP-B9FED2CC-SALESRECOGNI | ORD-B9FED2CC-SALESRECOGNI | REV-DAA28FB3-ORDB9FED2CCS | SCR-DAA28FB3-ORDB9FED2CCS | SRV2J-DAA28FB3-ORDB9FED2CCS | SRA-DAA28FB3-ORDB9FED2CCS |

Void lineage (`U8_IDENTITY_MATRIX_LIFECYCLE.void`):

| RequestKey | OperationID | Target OrderID | Target RecognitionID | Reversal RecognitionID | Reversal RevisionID | Reversal JournalID | Reversal AuditID |
| --- | --- | --- | --- | --- | --- | --- | --- |
| u8-void | TXOP-F28B5E65-SALESV2VOIDU | ORD-4866653E-SALESRECOGNI | SCR-5D859B4-ORD4866653ES | SCRV-B54D4692-SALESV2VOIDU | REVV-B54D4692-SALESV2VOIDU | SRV2JV-B54D4692-SALESV2VOIDU | SRAV-B54D4692-SALESV2VOIDU |

Correct lineage (`U8_IDENTITY_MATRIX_LIFECYCLE.correct`):

| RequestKey | OperationID | Original OrderID | Original RecognitionID | Replacement OrderID | Replacement RevisionID | Replacement RecognitionID | Replacement JournalID | Replacement AuditID | Reversal RecognitionID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| u8-correct | TXOP-922A0D31-SALESV2CORRE | ORD-8F2C0ADA-SALESRECOGNI | SCR-FF7C120-ORD8F2C0ADAS | ORD-922A0D31-SALESV2CORRE | REV-BB33101-ORD922A0D31S | SCR-BB33101-ORD922A0D31S | SRV2J-BB33101-ORD922A0D31S | SRA-BB33101-ORD922A0D31S | SCRV-B523DF76-SALESV2CORRE |

Linkage invariants asserted in-suite: audit↔event↔journal identity equality,
reversal `ReversalOfRecognitionID` = original RecognitionID, replacement
`OriginalID` = original RecognitionID, every ID unique per chain.

## 4. Write-surface matrix (byte-level before/after)

| Mutation | Orders | OrderLines | Events | BalanceLedger | Audits | Ops (sheet) | Protected (Payments/Settlements/InventoryLedger/tabsal/tabops/Logs) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Save | +1 | +lines | +1 | +2 (1030/4000) | +1 | +1 (mirrored) | byte-identical |
| Void | +0 | +0 | +1 | +2 (4000/1030) | +1 | +1 (mirrored) | byte-identical |
| Correct | +1 (replacement) | +1 | +2 | +4 (36,000/41,000 pairs) | +2 | +1 (mirrored) | byte-identical |

`Accounts`, `Payments`, `Settlements`, `InventoryLedger`, `tabsal`, `tabops`,
`Logs` never grow under any V2 mutation (asserted per mutation and after the
full M-suite attempt list).

## 5. Transport contract (mocked real request shapes)

- Metadata read: `GET ?fields=spreadsheetId,sheets.properties(sheetId,title)`,
  identity-checked against the production storage policy; mismatched id →
  `PRODUCTION_IDENTITY_MISMATCH` before any mutation.
- Save batch: `POST :batchUpdate` with exactly 5 `appendCells` subrequests over
  the frozen write surfaces, `fields=userEnteredValue`, numeric sheetIds in
  surface order, RAW CellData kinds only (stringValue/numberValue/boolValue,
  never formulaValue).
- Void batch: `POST :batchUpdate` with exactly 3 `appendCells` subrequests over
  the mutation's own surfaces.
- Missing sheetId → `SHEET_ID_UNAVAILABLE` thrown before any request.
- Bounds: cell count/line count/UTF-8 request bytes/plan cell all pass for the
  frozen plan; over-limit cell string → `UNSAFE_CELL_CHARS` pre-write.
- HTTP 429/500: surfaced by the transport; the core classifies exactly once —
  UNKNOWN with identity preserved, operation IN_PROGRESS, one batch attempt,
  no autonomous in-call retry; partial application → fail closed
  `RECOVERY_REQUIRED` with zero repair.

## 6. Static routing / config / hygiene audit (measured)

`testSalesV2U8ReleaseAudit` → `AUDIT_PASS` (28 checks, 16 routed entrypoints):

- Defaults still `PREPARED/disabled`; operator config layer has no
  `setProperty`; `mode:"ACTIVE"` appears only in the routing table, tests, and
  proofs; no hardcoded ActivationID/T or activation timestamp in production; no
  debug/bypass flag; no fixture/disposable IDs in production; no test-only
  account/schema override in production.
- Routing matrix (all require/forbid tokens present): `submitOperationalOrder`,
  `salesV2OperatorModeCreateOrder_`, `salesRecognitionV2DurableSave`,
  `submitOperationalPayment`, `createDurableOperationalPayment_`,
  `payOperationalOrderWithRepository`, `submitOperationalFulfillment`,
  `transitionOperationalFulfillmentWithRepository`, `buildCashPostingCandidate`,
  `submitCanonicalTransactionWithRuntime_`,
  `recoverTransactionOperationWithRuntime_`, `salesRecognitionV2DurableVoid`,
  `salesRecognitionV2DurableCorrect`, `voidCanonicalTransaction`,
  `correctCanonicalTransaction`, `salesV2OperatorCreateWithRuntime_`.
  No unguarded Sales writer found.
- Secret/env hygiene over clasp-allowlisted files + U8 artifacts: no
  token/JWT/key/credential patterns, no shipping absolute paths, no credential
  references. PASS (values never read or exposed).
- Upload manifest state: `97.SalesRecognition.V2.*` remains outside
  `.claspignore` (registration explicitly deferred to the authorized
  activation/upload task per `docs/SALES-RECOGNITION-V2-U2.md`); `96.Tests.*`
  remain excluded.

## 7. Source audit (26 items) — mapping to measured checks

All items verified in `testSalesRecognitionV2U8ReleaseEvidence` (26 source
checks + controller composition) plus the behavioral suites:

1 composition (shared operation vocabulary + projection op-type lists) ·
2 one canonical Save path (durable → core → operator → RPC) ·
3 one projection authority (Finance scope + reader chain) ·
4 readers use projection (`buildTransactionSalesReadRows_` → composer,
detail builder) ·
5 Finance uses signed events ·
6 Correct/Void append-only (`appendCells` only; no updateCells/deleteRange/
pasteData anywhere in V2 transport) ·
7 originals immutable (append-only transport + byte-equal originals) ·
8 V2 Payment forbidden (guard in durable core) ·
9 V2 fulfillment forbidden (guard in transition core) ·
10 historical cohorts preserved (PRE_V2/TABSAL/date-only classifier paths) ·
11 ProductVariantID authority (no Tipe fallback) ·
12 no Sales HPP accounting (`JOURNAL_ACCOUNTS` = 1030/4000 only; no 5000/1100
in V2 cores) ·
13 no Revenue double-count (single signed pass in the scope builder) ·
14 no activeView in P&L (scope never references activeView/BalanceLedger/
Payments) ·
15 UNKNOWN retains identity ·
16 retry uses persisted plan (verify + normalized-payload equality) ·
17 no blind repair (applyBatch only when inspection is NONE) ·
18 ACTIVE no legacy fallback ·
19 PAUSED no legacy fallback ·
20 sticky V2 recovery (resume paths carry no mode gate) ·
21 defaults PREPARED/disabled (gate denied `V2_NOT_ACTIVATED`) ·
22 no T/ActivationID written (no setProperty in config layer) ·
23 no unclassified writer (every entrypoint routed or guarded) ·
24 no Treasury surface ·
25 no production fixture/debug bypass in V2/operator sources ·
26 no production mutation (default refusal pre-write; fixture-only evidence).

Controller composition: `runSalesV2U7Controller()` → `CONTROLLER_PASS`
(28/28) inside the U8 evidence suite (client + server composed in one run).

## 8. Full regression (MEASURED, final)

`node _test_runner.js` after final source edit → **91 PASS, 0 FAIL**
(baseline 82 + 7 U8 case suites + U8 mutation proof + U8 release audit).
`node --check` clean on all four changed/new files. `git diff --check` clean.
No assertions weakened; no U1–U7 suite modified.

## 9. Integration mutation proof (12/12, VM-local, restore-by-copy)

`testSalesV2U8MutationProof` → `SENSITIVITY_PROVEN`, clean 7/7, 12/12 caught
by the designated suite marker:

| # | Injected bug (one at a time, VM copy only) | Caught by |
| --- | --- | --- |
| 1 | Save replay re-appends artifacts (duplicate recognition) | `SALES_V2_U8_E2E:B1` |
| 2 | Payment added to V2 (guard bypassed) | `SALES_V2_U8_GUARD:M1` |
| 3 | Fulfillment allowed for V2 (guard bypassed) | `SALES_V2_U8_GUARD:M3-PREPARING` |
| 4 | P&L Revenue reads activeView | `SALES_V2_U8_COHORT:J1` (Oct 106,000 ≠ 186,000) |
| 5 | Ledger Revenue double-counted | `SALES_V2_U8_COHORT:H1` (Revenue 217,000) |
| 6 | Void backdated to original date | `SALES_V2_U8_LIFE:E4` |
| 7 | Correct delta-only | `SALES_V2_U8_LIFE:F1` (REFUSED/IDENTITY_CONFLICT) |
| 8 | ACTIVE falls back to legacy | `SALES_V2_U8_POLICY:L2` |
| 9 | UNKNOWN loses RequestKey | `SALES_V2_U8_E2E:D1` |
| 10 | ProductVariantID → Tipe | `SALES_V2_U8_E2E:A1` |
| 11 | Prospective HPP as COGS | `SALES_V2_U8_POLICY:K1` (cogs 30,000) |
| 12 | Old Order reclassified by date | `SALES_V2_U8_COHORT:H4` |

Tracked files are never mutated: the proof injects bugs into VM string copies
only and asserts anchor uniqueness before each run.

## 10. Known limitations

- Local/static/browser-fixture evidence only: no live Apps Script runtime, no
  real Sheets transport (the REST layer is mocked at `inventoryReceiptMigrationRequest_`),
  no real browser process, no clasp execution. Transport HTTP semantics are
  proven at the request-shape/seam level, not against Google servers.
- The mixed-cohort fixture's three informational issues
  (`LEGACY_INACTIVE_EXCLUDED`, `INCOMPLETE_V2_RECOGNITION` for the pending
  intent, `OLD_ORDER_UNPAID_EXCLUDED`) are expected exclusions, not integrity
  failures; integrity failures are asserted separately (scenario N).
- The account preflight also validates the presence/activity of the 2010 row
  (frozen U1 behavior); scenario Q's "2010 irrelevant to Save" is proven as
  "2010 never written and never posted by any V2 path".
- `.claspignore` registration of `97.SalesRecognition.V2.*` files is
  intentionally deferred (U2 out-of-scope → U9 prerequisite).

## 11. Production actions explicitly NOT performed

No production mutation; no Apps Script runtime execution; no Accounts or
schema creation; no `clasp push/pull/deploy/run`; no activation, T, or
ActivationID; no backfill; no first real Sale; no Treasury; no U9/U10 scope;
no Git commit/push outside the authorized focused attempt; `.clasp.json`
untouched and never read.

## 12. U9 prerequisites (from this gate)

1. Authorized production preparation task (read-only diagnostics only) with the
   frozen contract for account/schema verification in the real workbook.
2. Explicit upload-manifest gate: register `97.SalesRecognition.V2.*` in
   `.claspignore`, capture `clasp status`, verify the full upload closure
   (U2-declared deferral ends here, under separate authorization).
3. Activation contract (mode ACTIVE + T + ActivationID) recorded out-of-band;
   defaults remain PREPARED/disabled until then.
4. Owner review of this evidence package; U9 must not reopen U1–U7 architecture
   without concrete failing evidence.

Telemetry: agent numlock-heavy, backend/model `9router/numlock-explore-free`,
reasoning high, fallback not used, delegation none, toolcalls UNKNOWN
(not instrumented), elapsed UNKNOWN (not instrumented), files read/modified:
bounded source+test inspection, 4 files modified/created
(`96.Tests.SalesRecognition.V2.U8.Cases.js`, `_test_runner.js`,
`tests/browser/sales-v2-u8-mutation-proof.js`,
`tests/browser/sales-v2-u8-release-audit.js`) + this document, test runs: 1
baseline + 6 repair iterations + 3 final measured full regressions + 2 isolated
proof/audit captures.
