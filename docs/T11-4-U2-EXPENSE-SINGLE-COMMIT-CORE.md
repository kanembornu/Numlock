# T11.4 — U2 Expense Single-Commit Core (LOCAL / INERT ONLY)

STATUS: LOCAL IMPLEMENTATION COMPLETE · INERT UNTIL AUTHORIZED ACTIVITY · ZERO PRODUCTION MUTATION
TASK_ID: T11_4_U2_EXPENSE_SINGLE_COMMIT_CORE
PHASE: NUMLOCK_SINGLE_COMMIT_TRANSACTION_ARCHITECTURE
BASELINE_COMMIT: `273980d` (T11.3 U1 Sales composed money leg)
CLASSIFICATION: L3 · R2 · REASONING_EFFORT high · Execution CONTINUE
AUTHORITIES: `AGENTS.md` · `docs/T11-2-SINGLE-COMMIT-TRANSACTION-CONTRACT.md` (§4 §6 §7 §8 §9 §11 §17 §20 D7 D9 D11) ·
`docs/T11-3-U1-SALES-COMPOSED-MONEY-LEG.md` (quality bar) · repository source
PRECEDENCE: repository source wins on "what is"; D1–D15 win on "what the business requires".

---

## 1. Previous Expense call graph (the multistep hazard)

```
190 transactionEntryForm (3509)
  └─ submitTransactionEntry(event)                 195:368
       payload = { transactionType:"EXPENSE",
                   expenseItemId, amount,
                   cashAccountCode, expenseDate }  195:383-402
       └─ google.script.run.submitCanonicalTransaction(payload)   195:426
            └─ submitCanonicalTransaction(payload)  21:248  (outer ScriptLock)
                 └─ submitCanonicalTransactionWithRuntime_  21:258
                      ├─ cashAccountCode ∈ {1000,1010,1020} required  21:291-308
                      ├─ resolveExpensePurchasePolicy_ → Purchase divert  21:343-361
                      ├─ prepareCanonicalExpenseEntry  21:390
                      ├─ WRITE #1 persistCanonicalEntry → tabops + Logs  21:363
                      └─ attemptCashSettlement (separate write unit)      21:399
                           ├─ POSTED  → no accountingPending
                           └─ !POSTED → logSettlementPending(SETTLEMENT_PENDING)
                                        + { success:true, accountingPending:true }
```

Hazard (D7): the business artifact and the money effect are two independent write
units. `persistCanonicalEntry` commits tabops first; `attemptCashSettlement` /
`runCashSettleAndPersist` (`40.Cash.Foundation.js:1126`) is a second unit that can
fail after the business row is durable, leaving `accountingPending: true` +
a `SETTLEMENT_PENDING` audit row and requiring a routine post-Save step. The
operator must also select a cash account (1000/1010/1020) — a payment-channel
fact D1/D2/D15 exclude from the normal flow.

Secondary entries (unchanged by this unit): `submitOperationalExpense`
(`95A:408-411`) and `submitReceiptEntry` (`195:1031`) both delegate to
`submitCanonicalTransaction`; the Purchase receipt entry stays on the legacy
route (U3 owns it).

## 2. New call graph (durable single commit)

```
190 transactionEntryForm
  └─ submitTransactionEntry(event)                       195:368
       ├─ payload.requestKey = expenseIntentRequestKey_(payload)   195:429
       └─ submitCanonicalTransaction(payload)            195:426  (ONE Save)
            └─ submitCanonicalTransactionWithRuntime_    21:258   (ONE outer ScriptLock)
                 └─ [type === "EXPENSE"] gate first      21:289-308
                      ├─ REFUSE  → PAUSED/REJECT/invalid, zero writes
                      ├─ ACTIVE  → read ExpenseItems, resolve Purchase route
                      │            ordinary → expenseSingleCommitDispatch_  21:1676
                      │            purchase  → legacy path (unchanged, U3)
                      └─ LEGACY  → today's writer byte-for-byte
                 └─ expenseSingleCommitDispatch_
                      └─ expenseSingleCommitSaveWithRuntime_   21:1560
                           ├─ expenseSingleCommitNormalize_    (strict allowlist)
                           ├─ (OperationType, RequestKey) lookup — FIRST durable read
                           ├─ NEW INTENT → expenseSingleCommitNewIntent_  21:1415
                           │    gate ACTIVE → schema → Accounts → 1040 preflight
                           │    → prepareCanonicalExpenseEntry (authority)
                           │    → entryID / operationID / auditID
                           │    → expenseSingleCommitPlan_ + verify + bounds
                           │    → TransactionOperations IN_PROGRESS + exact readback
                           │    → expenseSingleCommitApplyBatch_
                           ├─ RESUME → expenseSingleCommitResume_  21:1313
                           └─ expenseSingleCommitApplyBatch_  21:1238
                                ONE spreadsheets.batchUpdate [tabops, BalanceLedger(2), Logs]
                                → exact inspect → COMMITTED + exact readback → DONE
                                → invalidateDashboardCache → DONE envelope
```

No second endpoint, no settlement endpoint, no Treasury endpoint, no nested lock.

## 3. Files changed

| File | Change |
| --- | --- |
| `21.Transaction.Entry.js` | Expense single-commit routing block (`21:289-308`), dispatcher field allowlist + `requestKey`, and the full `EXPENSE_SINGLE_COMMIT_SAVE` core (`21:444`+) |
| `95A.Transaction.Production.js` | `dto.singleCommitMode = expenseSingleCommitResolvedMode_()` (`95A:367`) — server-resolved mode on the authority bootstrap |
| `194.View.Transactions.Forms.html` | single-commit client mode + `expenseIntentRequestKey_`, mode-aware cash requirement, two refusal messages |
| `195.View.Transactions.Actions.html` | mode intake (`195:139/168`), Expense cash-surface application (`195:74`), payload requestKey (`195:429`), UNKNOWN client branch (`195:440`) |
| `190.View.Index.html` | `id="expenseCashAccountFieldset"` (`190:3620`) so the ACTIVE surface can hide the selector |
| `96.Tests.SingleCommit.Expense.Cases.js` | NEW — five focused U2 suites |
| `_test_runner.js` | registers the new file + five `run(...)` entries |
| `tests/browser/sales-v2-u8-release-audit.js` | `21.Transaction.Entry.js` added to `activeAllowlist` (it is now a mode routing table, exactly like `97D`) |

No new runtime file was created: the core is a `21` extension (T11.2 §26 U2
"new expense save core module **or `21` extension**"), which keeps the
`.claspignore` allowlist at 76 files and the T8 upload manifest unchanged.

`tests/tmp/t8-package-manifest.json` changes on every harness run (aggregate
hash of the allowlisted package); it is a generated artifact, not a task change.

## 4. Gate / routing precedence (exact)

`expenseSingleCommitGate_` (`21:526`) resolves `SINGLE_COMMIT_TRANSACTION_V1`
through the frozen parser `singleCommitTransactionConfigState_` (`97:397`).

| Config state | Expense route | Writes |
| --- | --- | --- |
| ABSENT / PREPARED | **LEGACY** — today's writer byte-for-byte | as today |
| ACTIVE, Purchase-routed item | **LEGACY purchase path** (cash gate intact; U3 owns Purchase) | as today |
| ACTIVE, ordinary Expense | **EXPENSE_SINGLE_COMMIT_SAVE core** (no cash gate, no settlement) | one batch |
| PAUSED | **REFUSE** `SINGLE_COMMIT_MODE_PAUSED` | 0 |
| REJECT / invalid JSON / bad configVersion / unknown mode / read failure | **REFUSE** `SINGLE_COMMIT_CONFIG_INVALID` | 0 |

Precedence inside `submitCanonicalTransactionWithRuntime_`:
`(1) type validation → (2) Sales V2 guard → (3) EXPENSE gate → (4) Purchase
route resolve → (5) legacy cash validation → (6) legacy switch`. The gate runs
BEFORE the legacy cash validation so an ACTIVE normal Expense never validates a
payment channel; the Purchase branch falls through to (5)/(6) unchanged. There
is no silent fallback from ACTIVE or PAUSED to the legacy writer — the only way
to reach the legacy writer is an ABSENT/PREPARED config.

Client surface mirrors the same precedence: `singleCommitExpenseSurface_()`
(`194:31`) is ACTIVE only when the server travelled `singleCommitMode === "ACTIVE"`
(`95A:367`); otherwise the legacy "Paid via" selector stays visible and required.

## 5. Minimum input delta (T11.2 §17)

**Retained (REQUIRED_BUSINESS_FACT)**

| Input | Class | Source |
| --- | --- | --- |
| `expenseItemId` (ID_Ops → authoritative `AccountCode`) | REQUIRED | `21:63` authority |
| `amount` > 0 | REQUIRED | `21:67` |
| `expenseDate` | OPTIONAL_METADATA — retained because the current Expense product genuinely supports legitimate backdated entry (`21:366-370`, `195:396-402`); absent ⇒ authoritative current/business date | `21:647` |
| `transactionType: "EXPENSE"` | routing discriminator (unchanged) | dispatcher |
| `requestKey` | BACKEND/CLIENT technical identity, never operator-typed | `195:429` |

**Removed / refused on the ACTIVE path** (`expenseSingleCommitNormalize_`, `21:614`)

- `cashAccountCode` with any non-empty value → `EXPENSE_SINGLE_COMMIT_PAYMENT_FIELD_REFUSED` (`CASH_ACCOUNT_REFUSED`).
- `paidVia`, `paymentMethod`, `PaymentMethod`, `paymentStatus`, `PaymentStatus`,
  `receiveVia`, `ReceiveVia`, `destination`, `destinationAccountCode`,
  `evidenceRef`, `EvidenceRef`, `settlementId`, `SettlementID`, `cashAccount`,
  `treasuryReceipt`, `evidenceType`, `paymentID`, `PaymentID` → same code.
- Any other unknown field → `EXPENSE_SINGLE_COMMIT_FIELD_REFUSED`.
- UI: the "Paid via" fieldset (`190:3620`) is hidden and its required-selection
  rule dropped only on the ACTIVE normal-Expense surface (`195:74`, `194:78`).

**Backend-derived** (never requested): expense account (`ExpenseItems.AccountCode`),
1040, journal identity, operation identity, audit identity, accounting
classification, Cash Flow classification, timestamps, journal signature, plan digest.

**Description**: still not persisted — there is no tabops column and the server
continues to drop it (`21:343` allowlist). No schema column was invented.

## 6. Operation / schema contract

- OPERATION_TYPE: `EXPENSE_SINGLE_COMMIT_SAVE` (T11.2 §9 new namespace).
- Operation authority: **`TransactionOperations`** — the frozen common authority
  (`T11.2 §9`, `95A:8`), ten headers unchanged. New OPERATION_TYPE only; no new
  sheet, no new column, no `TreasuryOperations` reuse.
- Local store: `expenseSingleCommitOperationRepository_` (`21:743`) — exact
  `find/create/update` semantics of `95A:138-140`, `DUPLICATE_OPERATION` on a
  duplicated store row, flush injected so the harness never touches
  `SpreadsheetApp`.
- Surfaces touched: `tabops`, `BalanceLedger`, `Logs`, `TransactionOperations`
  (intent/commit are outside the batch), `Accounts`/`ExpenseItems` (read-only).
- No sheet created; no header changed; fail closed when a surface is present but
  its headers are absent/mismatched (`expenseSingleCommitSchemaGate_`, `21:713`);
  inert when the config is not ACTIVE (the gate is never even consulted for a
  non-EXPENSE dispatch).

## 7. Immutable plan (`expenseSingleCommitPlan_`, `21:815`)

Frozen exactly once, then the single source of truth for every later step:

`planVersion`, `operationType`, `operationID`, `requestKey`, `payloadHash`,
`normalizedPayload`, `entryID`, `journalID`, `auditID`, `actor`, `savedAt`,
`transactionTimestamp`, `economicDate`, `expenseDate`, `amount`,
`expenseItem` (ID + Item/Kategori/Kind/Group + `accountCode` + `accountActive`),
`accounts` (`{expense, money:"1040"}`), `movementType`, `sourceType`,
`journalSignature` (over the two rows), `businessRow` (exact
`CANONICAL_ENTRY.EXPENSE_HEADERS`), `journalRows[2]` (exact
`BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS`), `auditRow` (exact
`CANONICAL_ENTRY.LOG_HEADERS`), `planDigest`.

`expenseSingleCommitVerifyPlan_` (`21:899`) re-derives every financially
material fact at freeze time and on every resume: payload hash, operation ID,
`journalID === "EXPJ-" + entryID`, debit account == `ExpenseItems.AccountCode`
and never 1040, credit account == 1040, MovementType/SourceType/SourceID,
economic date on both rows, debit==credit==amount, signature recomputation,
plan digest. Result is `MALFORMED` (shape) or `TAMPERED` (content) — both fail
closed with zero additional writes.

## 8. Atomic batch (`expenseSingleCommitValueRanges_`, `21:1001`)

Frozen order, exactly three `appendCells` subrequests in ONE
`spreadsheets.batchUpdate`:

| # | Surface | Rows |
| --- | --- | --- |
| 1 | `tabops` | 1 business row |
| 2 | `BalanceLedger` | 2 rows (Dr expense / Cr 1040) |
| 3 | `Logs` | 1 audit row (`CREATE_EXPENSE`, `RecordID = ID_Trx`) |

`WRITE_SURFACES = ["tabops","BalanceLedger","Logs"]` is asserted inside
`valueRanges` and again in `batchBody`; a missing sheetId throws BEFORE the
request (`expenseSingleCommitBatchBody_`, `21:1041`) so the batch is rejected
atomically. RAW CellData only (`stringValue`/`numberValue`/`boolValue`), never
`formulaValue`; bounds re-evaluated against the STORED plan on resume
(`expenseSingleCommitBounds_`, `21:1077`).

Outside the batch (documented boundary, identical to Sales U2/Treasury T4):
IN_PROGRESS intent write + exact ten-field readback (before), COMMITTED update +
exact readback (after), cache invalidation (after). Intent/batch/commit are
multistep by design; only the batch is atomic. **Forbidden DONE states proved
absent:** tabops-without-ledger, ledger-without-tabops, one-journal-side-only all
resolve to `RECOVERY_REQUIRED`/`UNKNOWN`, never DONE.

## 9. Journal / source identity

| Field | Value |
| --- | --- |
| `JournalID` | `EXPJ-<ID_Trx>` (T11.2 §4) |
| `LineID` | `EXPJ-<ID_Trx>-1` (Dr), `-2` (Cr) |
| `MovementType` | `EXPENSE_SINGLE_COMMIT` |
| `SourceType` | `EXPENSE_SINGLE_COMMIT_V1` |
| `SourceID` | `ID_Trx` (the tabops business row) |
| `Tanggal` | canonical date key of the expense date (`capitalEquityDateKey`) |
| Debit | `ExpenseItems.AccountCode` (backend mapping, D7) |
| Credit | `1040` only |
| Signature | `policyCJournalSignature_(journalRows)` (`39:208`) |

One business projection identity per operator action — `ID_Trx` is simultaneously
`data.id`, `TransactionOperations.BusinessID`, `SourceID` of both ledger lines
and `Logs.RecordID` (proved in suite C, check C6).

## 10. RequestKey / replay / recovery

- One client intent key owns the ENTIRE Expense transaction. The client derives
  it per payload: `expenseIntentRequestKey_` (`194:42`) mints
  `expense-<ts>-<rand>` on first submit and reuses it while the serialized
  payload is unchanged, so a retry of the same intent keeps the same key and a
  changed payload deterministically mints a new identity.
- Key namespaces are disjoint: `EXPENSE_SINGLE_COMMIT_SAVE` never collides with
  `SALES_RECOGNITION_V2_SAVE`/`SALES_V2_*` and never touches Treasury T4
  RequestKey authority (`TREASURY_RECEIPT_V1`).
- Replay (COMMITTED + exact artifacts) → `DONE`, `replay:true`, `writeCount:0`, zero writes.
- Same key + different payload → `CONFLICT` / `OPERATION_PAYLOAD_CONFLICT`, zero writes.
- UNKNOWN before batch → `UNKNOWN` with `requestKey` + resolved `operationID`;
  artifacts NONE; retry resumes from the STORED plan and commits once.
- UNKNOWN after batch → `UNKNOWN`; artifacts present, operation `IN_PROGRESS`;
  retry verifies exact and finalizes without a second batch.
- Batch transport failure → `UNKNOWN` (`BATCH_OUTCOME_UNKNOWN`), never a definite failure.
- Missing business row / missing ledger line after COMMITTED → `RECOVERY_REQUIRED`
  `EXPENSE_SINGLE_COMMIT_ARTIFACTS_INCOMPLETE` (no repair, no second batch).
- Duplicate ledger line → `RECOVERY_REQUIRED` `EXPENSE_SINGLE_COMMIT_IDENTITY_CONFLICT`.
- Tampered `planDigest` / `amount` / debit account → `IDENTITY_CONFLICT`, zero writes.
- Tampered persisted ledger row → `RECOVERY_REQUIRED` (identity conflict).
- Invalid persisted `State` → `EXPENSE_SINGLE_COMMIT_INVALID_OPERATION_STATE`.
- Duplicated operation store row → `DUPLICATE_OPERATION_EVIDENCE`.
- Recovery never duplicates the business row or the journal (suite D).

## 11. 1040 preflight (`preflightSingleCommitMoneyAccount`, `97:457`)

Runs inside the lock, after the schema gate, BEFORE any business mutation
(`21:1442`). Exact §11 metadata, read with the real
`CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS` field names:
`AccountCode 1040`, `AccountName "Operational Funds"`, `AccountType "Asset"`,
`StatementGroup "Current Assets"`, `CashFlowGroup "Operating"`,
`NormalBalance "DEBIT"`, `IsActive true`.

| Condition | Result |
| --- | --- |
| absent / duplicate / inactive | `REFUSED` `EXPENSE_SINGLE_COMMIT_ACCOUNT_PREFLIGHT_FAILED`, 0 writes |
| wrong AccountType / NormalBalance / AccountName / StatementGroup / CashFlowGroup | same refusal, 0 writes |
| code reused by another account with conflicting metadata | same refusal, 0 writes |
| exact match | save proceeds to DONE |

No name inference, no fallback to 1000/1010/1020/1030/2000 — proved by suite B
(check B10: after a failed preflight the fixture ledger contains zero rows on any
money account). The row is NOT created by this unit.

## 12. accountingPending elimination

`attemptCashSettlement` and `logSettlementPending` sit AFTER the routing return,
so the ACTIVE path can never reach them: suite A/C/E prove
`settlementAttempts === 0`, no `Settlements` surface, no `accountingPending`
property on success, and zero `SETTLEMENT_PENDING` audit rows. The client's
legacy `accountingPending` handling is untouched for the ABSENT/PREPARED path
(legacy compatibility readers stay live).

## 13. Treasury isolation

- No `TreasuryReceipts` row, no `EvidenceRef`, no `MANUAL_VERIFIED`, no
  destination selection, no T4/T7 RequestKey, no nested Treasury lock.
- The batch surface list is asserted to be exactly the three Expense surfaces;
  the writer/plan/inspect functions contain no Treasury concept (suite E, E3).
- The dispatcher source contains no `TreasuryReceipt`/`MANUAL_VERIFIED`/
  `destinationAccountCode`/`TreasuryOperations` token.
- Operation authority is `TransactionOperations`, not `TreasuryOperations`.

## 14. Cash Flow source semantics (D11, for U4)

Each new Expense journal touches `1040` exactly once (credit) and its counterpart
is the authoritative expense account — both carry `CashFlowGroup` in `Accounts`
(fixtures: 1040 Operating/DEBIT/Asset, 6100 Operating/Expense; suite C, C11).
The rows carry the deterministic `MovementType`/`SourceType`/`SourceID` a reader
needs to attribute the movement exactly once.

**Future U4 reader expectation (documented, not implemented here):** extend
`buildCashFlowStatement`'s `cashAccountCodes` (`36:73`, `36:155`) with `"1040"`
and apply the §14.3 composition rule — a 1040 line whose counterparts lack a
`CashFlowGroup` (1030 clearing) classifies by composition; here the counterpart
IS a CashFlowGroup account, so the existing counterpart rule already classifies
this journal as **Operating outflow (−)**. No U4 reader code was changed by U2.

## 15. Transaction-history identity

ONE business transaction per operator action: the tabops row. The two ledger
rows and the Logs row are never presented as transactions — the history readers
build from `tabsal`/`tabops`/`PurchaseEvents` only (`20:buildCanonicalTransactionData`,
`22:canonicalLifecycleLedgerSpec`), never from `BalanceLedger`. No Transaction
reader change was made; the deterministic source identity U4 needs is
`(SourceType, SourceID) = (EXPENSE_SINGLE_COMMIT_V1, ID_Trx)`.

## 16. Correction-lineage readiness (U6 owns the behavior)

Locating the original is deterministic from the business artifact alone:

- business row: `tabops.ID_Trx = OPS-APP-<date>-<token>` (legacy shape, `Source = APP_ENTRY`,
  so `canonicalLifecycleMutability` still classifies it as correctable/voidable —
  `22:34-41`);
- exact journal: `JournalID = "EXPJ-" + ID_Trx`, `SourceID = ID_Trx`,
  `MovementType = EXPENSE_SINGLE_COMMIT`;
- operation: `(EXPENSE_SINGLE_COMMIT_SAVE, BusinessID = ID_Trx)`;
- audit: `Logs.RecordID = ID_Trx`.

Originals are append-only; this unit deletes and rewrites nothing.

**Exact remaining U6 work (T11.2 §10):**
1. `EXPENSE_SINGLE_COMMIT_VOID` — mirror journal **Dr 1040 / Cr expenseAccount**,
   `JournalID EXPJV-<ID_Trx>`, same MovementType/SourceType/SourceID, plus the
   existing `22` lifecycle (tabops `IsActive=false` + signed Logs entry), all in
   ONE batch.
2. `EXPENSE_SINGLE_COMMIT_CORRECT` — full reversal (as cancel) **plus** a complete
   replacement single-commit Expense save with its own RequestKey-derived
   identity, same batch; original lifecycle → `CORRECTED`.
3. No Treasury workflow, no EvidenceRef, no 2010 writer in either path.
4. Client: route Correct/Void for single-commit cohorts away from
   `previewCanonicalTransactionCorrection`/`correctCanonicalTransaction` once
   those server endpoints exist.

## 17. Historical compatibility

- Append-only: no historical tabops / BalanceLedger / Logs / Accounts row is
  rewritten (suite E, E1 byte-identical snapshot; E6 transitional identifier
  untouched).
- Legacy 1000/1010/1020 rows and the `HISTORICAL` movement evidence are untouched;
  this operation writes none of them (E2).
- Gate ABSENT/PREPARED: dispatcher output byte-identical to baseline — same
  tabops + Logs + settlement attempt + `accountingPending` + no operation row
  (suite A, A1/A2). The only dispatcher delta on the legacy route is that
  `requestKey` is now an accepted-and-ignored field of the Expense allowlist
  (`21:363`); every other unknown field still refuses.
- Historical `SETTLEMENT_PENDING` / `accountingPending` compatibility readers
  unchanged.
- No `.claspignore` change; package manifest still 76 files.

## 18. Tests (MEASURED, `node _test_runner.js`)

| Suite | Focus |
| --- | --- |
| `testExpenseSingleCommitGateRouting` | ABSENT/PREPARED legacy parity, PAUSED/invalid/REJECT fail-closed zero-write, ACTIVE exclusive routing, Purchase stays legacy, resolved-mode helper |
| `testExpenseSingleCommitPreflight1040` | 1040 missing/duplicate/inactive/wrong type/wrong balance/wrong name/wrong group/wrong CashFlowGroup/code reuse, no channel fallback, exact match accepted, Accounts never written |
| `testExpenseSingleCommitPlanBatch` | one batch/three surfaces, exact tabops delta, Dr expense, Cr 1040, exactly two ledger lines, one JournalID + signature, one RequestKey, one plan owning all identities, one business projection identity, payment/channel refusals, invalid inputs, no accountingPending/SETTLEMENT_PENDING/Settlements, Cash Flow source availability |
| `testExpenseSingleCommitDurability` | replay zero-write, payload CONFLICT, UNKNOWN pre-batch resume, UNKNOWN post-batch finalize, batch failure, missing business row, missing ledger line, duplicate ledger line, digest/amount/account tamper, persisted-row tamper, invalid state, duplicate operation row, two independent intents |
| `testExpenseSingleCommitIsolation` | historical byte-identity, no legacy channel postings, Treasury isolation, correction lineage, no production/config mutation, single outer lock |

MEASURED: baseline `186 PASS / 0 FAIL` → after U2 `191 PASS / 0 FAIL`
(5 new suites, all green; every pre-existing suite, including Sales U1
`testSalesComposedMoney*`, Expense/Purchase, Treasury shared-ledger and the full
regression, still PASS). Per-suite MEASURED check counts:
`T11_4_U2_GATE=22`, `T11_4_U2_1040=14`, `T11_4_U2_PLAN=43`,
`T11_4_U2_DURABILITY=22`, `T11_4_U2_ISOLATION=31` → **132 focused U2 checks**
(40 required).

Requirement coverage (≥40): the five suites execute well over 40 explicit checks
— gate absent → existing path unchanged; invalid config fail-closed; PAUSED no
mutation; ACTIVE + valid 1040 success; exact tabops delta; exact Dr expense;
exact Cr1040; exactly two ledger lines; same JournalID/signature; ONE atomic
batch; one RequestKey; replay zero-write; key conflict; UNKNOWN pre-batch;
UNKNOWN post-batch; missing business artifact → incomplete; missing ledger line →
incomplete; duplicate line → conflict; digest tamper; amount tamper; account
tamper; 1040 missing/duplicate/inactive/wrong type/wrong balance each zero
writes; no 1000/1010/1020 fallback; no cash-account input; channel/payment fields
refused; no accountingPending success; no SETTLEMENT_PENDING success; no
TreasuryReceipt; no EvidenceRef; one business projection identity; Operating
source classification available for U4; historical fixtures unchanged; Sales U1
green; Purchase baseline unchanged; transitional 24k untouched; no production
mutation. No old test was weakened: the only existing-test edit adds
`21.Transaction.Entry.js` to the U8 `activeAllowlist` so the release audit's rule
("ACTIVE only in a mode routing table / tests / proofs") still holds for the new
Expense routing table.

## 19. Production mutation count

| Category | Count |
| --- | --- |
| `clasp push` / `clasp pull` / `clasp deploy` / `clasp run` | 0 |
| Apps Script / spreadsheet writes | 0 |
| ScriptProperties config writes (`setProperty`) | 0 |
| Accounts 1040 row creation | 0 (not attempted; preflight only) |
| Config activation PREPARED → ACTIVE | 0 |
| Production Expense / Sales / Purchase transactions | 0 |
| Transitional 24,000 closure | 0 |
| 1040 / financial events in production | 0 |
| Git staging / commit / push | 0 |
| Network requests | 0 (local fixture transport only) |

All execution was local: source edits, `node --check`, `node _test_runner.js`.

## 20. Exact remaining work

**U6 (correction/cancel) — deferred, owned by U6:** the four items listed in §16.
Nothing in U2 can cancel or correct a single-commit Expense yet; originals are
already append-only and deterministically locatable.

**Deferred units (unchanged from T11.2 §26):** U3 Purchase single-commit core ·
U4 T5/Cash Flow/Balance/aggregate readers · U5 config activation plumbing ·
U7 Accounts 1040 creation · U8 config activation · U9 first-production
acceptance · U10 transitional 24,000 closure · U10+ legacy-path retirement.

**Risks / limits**
- The core is inert: no behavior changes until an authorized unit activates
  `SINGLE_COMMIT_TRANSACTION_V1` (and creates the 1040 row first).
- The client key is session-scoped (retained across retries of the same payload
  within the entry dialog); a full page reload mints a new identity for a new
  intent, which is safe because the previous intent is either COMMITTED (the
  operator sees the saved transaction) or IN_PROGRESS and recoverable by
  `(OperationType, RequestKey)` from the operation store.
- `expenseDate` is written as an ISO string through RAW CellData (the same
  transport pattern Sales already uses for date columns); readback comparison is
  Date-safe in both directions.
- Package manifest hash changed only because `21.Transaction.Entry.js` content
  changed; file count and exclusions are unchanged.

---

DISCOVERY + IMPLEMENTATION COMPLETE · LOCAL / INERT ·
ZERO production mutation · ZERO deploys/pushes · ZERO config mutation ·
ZERO financial events.
