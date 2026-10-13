# T11.10C — Production 6210 Metadata Repair (one Accounts cell)

| Field | Value |
| --- | --- |
| TASK_ID | `T11_10C_PRODUCTION_6210_METADATA_REPAIR` |
| Status | **COMPLETE** — one authorized Accounts cell repaired; readiness **READY / ALL_READY**; activation **not** invoked |
| Owner decision | `OPTION_1_APPROVED` (repair 6210 `NormalBalance` `""` → `"DEBIT"`) |
| Inherited finding | T11.10B `BLOCKED_AT_PRECHECK` — `6210:METADATA_MISMATCH` |
| Next boundary | `T11_10D_U8_FINAL_ACTIVATION` (separate authorization required) |
| Spreadsheet | `1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M` |
| Runtime | deployment `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` **@714**, 77 files, unchanged |
| T11 config | `SINGLE_COMMIT_TRANSACTION_V1` **PREPARED v1**, `activationID ""`, `activatedAt ""` — untouched |
| Activation invocations | **0** (cumulative across T11.10B and T11.10C) |
| Mutations | **1 cell**: `Accounts!I12` (`6210.NormalBalance`) |

---

## 1. Blocked T11.10B finding (authoritative input)

T11.10B stopped at its fresh production precheck with a deterministic, source-reproduced refusal prediction:

```
6210 row as runtime sees it: {"AccountCode":6210,"AccountType":"Expense",
  "StatementGroup":"Supplies Expense","CashFlowGroup":"Operating",
  "IsActive":true,"NormalBalance":""}
PREFLIGHT_6210_RESULT: STOP_ACCOUNT_NOT_READY detail=6210:METADATA_MISMATCH
```

Reproduced exactly against `101.SingleCommit.Config.Control.js:263-265` with
`20.Data.Source.js:16` padding semantics. T11.10B therefore did **not** invoke
`activateSingleCommitTransactionV1Production()` — invocation count stayed 0 and
the one-shot authorization stayed unconsumed.

## 2. Source authority proof (re-traced this unit, not inherited)

All four authorities were re-read in this unit and agree on `6210 / Expense / DEBIT`:

| # | Authority | Evidence |
| --- | --- | --- |
| A1 | `39.Balance.Foundation.js` `ACCOUNT_METADATA["6210"]` | `AccountName "Raw Material Supplies Expense"`, `AccountType "Expense"`, `StatementGroup "Supplies Expense"`, `CashFlowGroup "Operating"`, **`NormalBalance "DEBIT"`** |
| A2 | Activation writer `101.SingleCommit.Config.Control.js:252-266` | unique + active + `AccountType === "Expense"` + `NormalBalance === "DEBIT"`, else `6210:METADATA_MISMATCH` |
| A3 | U3 Purchase single-commit preflight `21.Transaction.Entry.js:2747-2771` | same shape; else `PURCHASE_ACCOUNT_METADATA_MISMATCH` |
| A4 | `BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE["6210"]` (`39:590`) | `["Raw Material Supplies Expense","Expense","Supplies Expense","Operating"]` — consistent |
| A5 | Tests / fixtures | `96.Tests.SingleCommit.Config.Cases.js:582-604` (`6210:METADATA_MISMATCH` case), `96.Tests.SingleCommit.Purchase.Cases.js:519` (`P11b_6210_wrongBalance`), `:719-725` (`B12b` requires `NormalBalance === "DEBIT"`) |

**No disagreement. writes=0 gate not triggered.** Note `4000` blank `NormalBalance`
is a *different, explicitly exempted* case (`97.SalesRecognition.V2.Foundation.js:351`)
and was deliberately left blank.

## 3. Exact before-state

`Accounts` sheet, row 12, read with `valueRenderOption=UNFORMATTED_VALUE`:

```
AccountCode   6210
AccountName   Raw Material Supplies Expense
AccountType   Expense
StatementGroup Supplies Expense
CashFlowGroup Operating
IsActive      true
CreatedAt     46247.20833333333
UpdatedAt     46247.20833333333
NormalBalance ""            <-- blank (sheet row width 8 of 9)
```

`Accounts` protected fingerprint pre-write: `sha16 dc6a0e074f655bc9`, 23 data rows.

## 4. Metadata-drift classification

**NOT drift.** `docs/T11-9-U7-PRODUCTION-PREREQUISITE-AND-1040-CREATION.md:90`
already recorded `6210 … (blank)` at U7 time, and T11.10A's precheck snapshot
(`/tmp/opencode/t1110a-precheck.json`) also captured `normal: undefined` for 6210.
This is a **prerequisite gap**, not a production change: the frozen authority has
always required `DEBIT`, the row never carried it, and no runtime writer existed
to set it.

## 5. Probe false-positive root cause

`tests/tmp/t1110a-postwrite-probe.js` gate **I4** asserted only:

```js
check("I4", report.accountAuthorities.every((a) => a.count === 1 && a.active) && …)
```

It *recorded* `type`/`normal` but never asserted them, so a blank
`6210.NormalBalance` produced `readiness: "ALL_READY"` while the deployed @714
activation writer would have refused with `STOP_ACCOUNT_NOT_READY /
6210:METADATA_MISMATCH`. The same gap applied to 1030/1040 metadata and to the
4000 blank exemption.

## 6. Hardening (local, narrow, not deployed)

`tests/tmp/t1110a-postwrite-probe.js` (untracked tmp harness):

- Added pure `activationAccountGate_(rows)` mirroring the deployed predicates
  exactly: 6210 unique/active/`Expense`/`DEBIT`; 1030 and 4000 per
  `salesRecognitionAccountExpectations_` + `salesRecognitionAccountFieldMismatch_`
  (4000 blank exemption preserved); 1040 per `preflightSingleCommitMoneyAccount`
  (`97:394-401`).
- Added `DEPLOYED_PREDICATE_TOKENS`, re-verified against the live @714
  `101.SingleCommit.Config.Control` source at every probe run, so the local
  mirror cannot silently drift from the authority it mirrors.
- I4 now requires: deployed tokens present **and** `accountGate.status === "READY"`
  **and** self-test pass **and** the original 1040 exactness **and** 9 header columns.
- Added `T1110A_PRECHECK_BASELINE` env override (default unchanged) so the H4
  fingerprint drift check can run against a current baseline instead of the
  original T11.10A snapshot.
- CLI `selftest` mode: fixture-only, no network, no production contact.
- Probe sha256 after hardening: `5c8d6a6ed4bfc924c1ac0c5214823106c6f9ec5108e3896893c6cb60a761278a`.

**Runtime delta vs @714: NONE.** The probe is an untracked `tests/tmp/` file, is
not in the 77-file clasp allowlist, and no `.js/.html/.json` in the package was
touched. `git status` shows no tracked delta. The activation writer is byte
identical to @714 and was not modified — production safety does not depend on
the probe, because @714 already enforces the invariant in-lock.

## 7. Focused tests

`node tests/tmp/t1110a-postwrite-probe.js selftest` → **8/8 PASS**:

| case | expected | actual | problem |
| --- | --- | --- | --- |
| `blank6210` | NOT_READY | NOT_READY | `6210:METADATA_MISMATCH` |
| `canonical` | READY | READY | — |
| `credit6210` | NOT_READY | NOT_READY | `6210:METADATA_MISMATCH` |
| `inactive6210` | NOT_READY | NOT_READY | `6210:INACTIVE` |
| `wrongType6210` | NOT_READY | NOT_READY | `6210:METADATA_MISMATCH` |
| `missing6210` | NOT_READY | NOT_READY | `6210:ABSENT` |
| `blank1030` | NOT_READY | NOT_READY | `1030:METADATA_MISMATCH` |
| `blank1040` | NOT_READY | NOT_READY | `1040:METADATA_MISMATCH` |

No test was deleted or weakened.

## 8. Regression

`node _test_runner.js` → **227 PASS / 0 FAIL** (MEASURED, after hardening).
`runSalesV2U8ReleaseAudit` → **AUDIT_PASS** (28 checks, 16 routing).
Package measurement: `current=77 currentHash=e7a1b36e89efeef512b99b51a3654a2e5a6fbae67603fe5e7faf36c8f397ef60 registered=77 registeredHash=<same>`.
`git diff --check` clean; no tracked delta.

## 9. Fresh production precheck (read-only, immediately before write)

`/tmp/opencode/t1110c-6210-repair.js pre` → **12/12 PASS**
(`/tmp/opencode/t1110c-pre.json`):

| Check | Result |
| --- | --- |
| D1 deployment | 2 deployments, pinned id @714, updateTime `2026-10-12T21:37:10.993Z` |
| D2 runtime | 77 files, 0 mismatch, 0 missing vs local allowlist |
| D3 config | `NOOP_ALREADY_PREPARED`, `writes {config:0,sheets:0}`, PREPARED v1, identity empty |
| D4 target | exactly one 6210, authority fields exact, `IsActive TRUE`, `NormalBalance ""` |
| D5 headers | 9 `Accounts` headers exact |
| D6 money | 1040 exactly once, `Operational Funds`/`Asset`/`DEBIT`, 0 ledger lines, net 0 |
| D7 Suppliers | 1 sheet, 11 headers exact, 0 rows |
| D8 Sales V2 | ACTIVE, configVersion 1 |
| D9 Treasury | ACTIVE/allowed, 0 rows on all three sheets |
| D10 transitional | `OK`, residual 0, `ledgerNet1030 24000`, outstanding 24000, 1 SCR row |
| D11 artifacts | no `SALES_MONEY_V2`/`SRV2M`/`EXPJV`/`TRANSITIONAL_CLEARING_CLOSE`/T11 saves |
| D12 fingerprints | 21 protected surfaces captured |

## 10. One-cell mutation mechanism

Sheets REST `values.update`, `valueInputOption=RAW`, body
`{"range":"Accounts!I12","majorDimension":"ROWS","values":[["DEBIT"]]}` —
a single-cell update, **no whole-row rewrite**, no append, no batch over other
ranges.

## 11. Lock / idempotency

`ScriptLock` was **not acquired** — no deployed runtime writer exists that takes
`ScriptLock` and writes a single Accounts metadata cell, and creating one would
require `clasp push`/deploy, which is forbidden in this unit. Compensating
controls:

1. Full re-read of `Accounts` inside the same execution immediately before the write.
2. Idempotency + conflict branches evaluated on that fresh read (below).
3. Immediate exact-cell, whole-row and whole-sheet read-back after the write.
4. Source search (`getSheetByName("Accounts")` + `appendRow|setValues|updateCells`)
   confirms **no runtime function writes Accounts**, so no concurrent in-product writer exists.
5. The @714 activation writer independently revalidates 6210 inside its own
   `ScriptLock` at activation time, so a wrong value can never be accepted.

Idempotency branches implemented in the write phase:

| pre-write state | action |
| --- | --- |
| `""` + authority exact | write once |
| `"DEBIT"` + authority exact | `ALREADY_REPAIRED`, zero write |
| duplicate 6210 / authority mismatch | `CONFLICT`, zero write |
| any other non-blank value | `STOP_CONFLICT`, zero write |

Authority was re-proven from `39.Balance.Foundation.js` immediately before the
write (`authorityReproof.match: true`).

## 12. Invocation count

`activateSingleCommitTransactionV1Production()` invocations this unit: **0**.
Cumulative (T11.10B + T11.10C): **0**. One-shot activation authorization remains
**unconsumed**.

## 13. Target cell

`Accounts!I12` — row 12, column I, header `NormalBalance` (verified: `D5` header
order + `headerAtColumn: "NormalBalance"`).

## 14. Before / after

| | Before | After |
| --- | --- | --- |
| `6210.NormalBalance` | `""` | `"DEBIT"` |
| `Accounts` sha16 | `dc6a0e074f655bc9` | `797f9f020ffa1f18` |
| HTTP | — | `200`, `updatedCells: 1`, `updatedRange: "Accounts!I12"`, `updatedRows: 1` |
| outcome | — | `REPAIRED`, `cellsWritten: 1` |

## 15. Other-6210-cells proof

Field-by-field diff of the 6210 row, write-phase re-read vs post-write:

```
changedFieldsOn6210: ["NormalBalance"]   (exactly one)
AccountCode/AccountName/AccountType/StatementGroup/CashFlowGroup/IsActive/CreatedAt/UpdatedAt: unchanged
```

## 16. Other-rows proof

`Accounts` data rows 23 → 23 (delta 0); non-6210 rows = 22; no row appended,
deleted or reordered. Protected-fingerprint comparison across all 21 surfaces
shows **only** `Accounts` changed, and its row count is unchanged (23 → 23).

## 17. Protected fingerprints

Pre → post, 21 surfaces. Delta = `{ Accounts }` only:

| surface | pre sha16 | post sha16 | rows |
| --- | --- | --- | --- |
| Accounts | `dc6a0e074f655bc9` | `797f9f020ffa1f18` | 23 → 23 |
| BalanceLedger, SalesRecognitionEvents, SalesRecognitionAudits, PurchaseEvents, TransactionOperations, Orders, OrderLines, Payments, Settlements, InventoryLedger, tabsal, tabops, Logs, Settings, Products, ProductPricing, TreasuryReceipts, TreasuryOperations, TreasuryAudits, Suppliers | unchanged | unchanged | unchanged |

Fresh post-repair baseline captured for the next unit:
`/tmp/opencode/t1110c-postrepair-baseline.json`.

## 18. PREPARED proof

Post-write readback (reviewed idempotent NOOP path, `writes {config:0,sheets:0}`):

```
mode "PREPARED", contractVersion "SINGLE_COMMIT_TRANSACTION_V1",
activationID "", activatedAt "", configVersion 1
```

No `ActivationID`, no `activatedAt`, no config mutation of any kind.

## 19. @714 proof

Post-write: 2 deployments; pinned id `AKfycbxyll_HUHO9…` `versionNumber 714`,
updateTime `2026-10-12T21:37:10.993Z` — identical to pre-write. No `clasp push`,
no deploy, no version transition, no runtime upload.

## 20. 1040 / Suppliers / Treasury / transitional proofs

| invariant | value |
| --- | --- |
| 1040 | exactly 1 row, `Operational Funds` / `Asset` / `Current Assets` / `Operating` / `DEBIT`, 0 ledger lines, net 0 |
| Suppliers | 1 sheet, 11 canonical headers, **0** business rows |
| Treasury | ACTIVE/allowed; `TreasuryReceipts` 0, `TreasuryOperations` 0, `TreasuryAudits` 0 |
| Transitional | `SCR-CE122B27-ORD677BE5CES` 1 row; `ledgerNet1030 24000`; `reconciliationStatus OK`; `unexplainedResidual 0` |
| T11 artifacts | none on PurchaseEvents / TransactionOperations / SalesRecognitionEvents / tabops / Logs |
| BalanceLedger | 8 rows, sha16 `b9e26e345d8eb877` — unchanged; **no ledger row created by a metadata repair** |

## 21. Deployed-authority readiness (probe H1)

Against live @714 content + current production rows → **READY**:

| gate | value |
| --- | --- |
| deployed predicate tokens (Expense / DEBIT / `6210:METADATA_MISMATCH` / `preflightSingleCommitMoneyAccount` / `salesRecognitionAccountExpectations_`) | all present |
| 6210 Expense + DEBIT | true |
| 1040 Asset + DEBIT | true |
| 1030 DEBIT | true |
| 4000 present (blank exemption) | true |

## 22. Hardened-probe readiness (probe H2)

`T1110A_PRECHECK_BASELINE=/tmp/opencode/t1110c-postrepair-baseline.json node tests/tmp/t1110a-postwrite-probe.js`
→ **`readiness: "ALL_READY"`, 15/15 PASS, 0 FAIL**

- `accountGate: { status: "READY", problems: [] }`
- `deployedPredicateTokens`: 3/3 present
- `accountAuthorities`: 6210 Expense/DEBIT, 1030 Asset/DEBIT, 4000 Revenue/blank(exempt), 1040 Asset/DEBIT
- `accountGateSelfTest`: 8/8 pass (embedded in the run)
- `fingerprintDelta: {}`
- `activationInvoked: false`

**Both readiness probes agree. No further blocker discovered.** Per instruction L,
activation was **not** performed.

## 23. Mutation accounting

| surface | count |
| --- | --- |
| Accounts cells | **1** (`Accounts!I12`) |
| Accounts row count delta | 0 |
| PropertiesService | 0 |
| Suppliers | 0 |
| BalanceLedger | 0 |
| transaction sheets (Orders/OrderLines/Payments/Settlements/tabops/TransactionOperations/PurchaseEvents/SalesRecognitionEvents/SalesRecognitionAudits) | 0 |
| Treasury (Receipts/Operations/Audits) | 0 |
| Settings / Logs / Products / ProductPricing / InventoryLedger / tabsal | 0 |
| deployment | 0 |
| runtime upload | 0 |
| Git push | 0 |
| financial events | 0 |
| activation invocations | 0 |

## 24. Inherited T11.10B blocked-attempt history (for continuity)

| attempt | outcome | production effect |
| --- | --- | --- |
| T11.10B attempt 1 | `BLOCKED_AUTH` — `numlock-run` refresh `invalid_grant` | 0 production calls, 0 writes, 0 invocations |
| OAuth reauth attempt 2 | `invalid_scope` — Google rejected `script.executions` | no token written; scope dropped and re-verified against Google's consent endpoint |
| OAuth reauth attempt 3 | `BLOCKED_AUTH_CALLBACK_LISTENER` — browser `ERR_CONNECTION_REFUSED` | code discarded, never exchanged; listener replaced with a detached (`setsid`) double-fork process, verified accepting via real HTTP probes before any new URL |
| OAuth reauth attempt 4 | **success** — `REAUTH_OK`, 9 scopes, new refresh token | identity `d***@gmail.com` |
| Owner decisions | `APPROVED_OPTION_1_REAUTHORIZE_NUMLOCK_RUN`, scope-fix, listener retry, resume-after-done, `OPTION_1_APPROVED` (this unit) | — |

## 25. Identity proof (no credential material disclosed)

Non-mutating: refresh HTTP 200 (in-memory only), `tokeninfo` email `d***@gmail.com`
matches the stored `id_token` claim, Projects API HTTP 200 / 2 deployments.
**`numlock-run auth = VALID`** — re-verified at the start of this unit.

## 26. Runtime delta vs @714

**NONE.** No file in the 77-file clasp allowlist was modified; `git status`
reports no tracked delta; the only source edit in this unit is the untracked
`tests/tmp/t1110a-postwrite-probe.js` harness, which is excluded from upload by
`.claspignore` and was not deployed. Production safety is independent of the
probe because the deployed @714 activation writer already enforces the 6210
invariant in-lock.

## 27. Next activation boundary

All activation prerequisites are now **READY** under both the deployed @714
authority and the hardened local probe. Stopping here per instruction L.

**Next unit: `T11_10D_U8_FINAL_ACTIVATION`** — separate, explicit authorization
required for exactly one `activateSingleCommitTransactionV1Production()`
invocation. No second ActivationID, no PREP, no deploy.

---

## Appendix — local artifacts (not committed)

| path | purpose |
| --- | --- |
| `/tmp/opencode/t1110c-6210-repair.js` | pre / write / post harness (lives outside the repo) |
| `/tmp/opencode/t1110c-pre.json` | fresh precheck report (12/12) |
| `/tmp/opencode/t1110c-write.json` | one-cell write report (`REPAIRED`, 1 cell) |
| `/tmp/opencode/t1110c-post.json` | post-write verification (11/11) |
| `/tmp/opencode/t1110c-postrepair-baseline.json` | post-repair protected-fingerprint baseline for the next unit |
| `/tmp/opencode/t1110a-postwrite-probe.json` | hardened probe run (`ALL_READY`, 15/15) |
| `tests/tmp/t1110a-postwrite-probe.js` | hardened local probe (untracked tmp harness, sha256 `5c8d6a6ed4bfc924c1ac0c5214823106c6f9ec5108e3896893c6cb60a761278a`) |
