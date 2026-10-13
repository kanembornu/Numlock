# T11.10D — U8 Final Activation (SINGLE_COMMIT_TRANSACTION_V1 PREPARED → ACTIVE)

| Field | Value |
| --- | --- |
| TASK_ID | `T11_10D_U8_FINAL_ACTIVATION` |
| Status | **COMPLETE** — one invocation, `ACTIVATED`, full read-only acceptance green |
| ActivationID | `SCA-bcdddd57-7f46-4e88-a096-2be430605a3b` |
| activatedAt | `2026-10-13T12:10:59.372Z` |
| configVersion | `1` (carried forward, never bumped — frozen T10.5/97E scheme) |
| Invocations | **1** (cumulative successful transitions 0 → 1) |
| Writes | `PropertiesService = 1` (the activation); **all sheets 0** |
| Spreadsheet | `1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M` |
| Runtime | deployment `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` **@714**, 77 files, byte-identical to local allowlist |
| Next boundary | `T11_11_U9_FIRST_REAL_TRANSACTION_ACCEPTANCE` |

---

## 1. Migration history U7 → U10C (inherited evidence chain)

| Unit | Commit | Contribution |
| --- | --- | --- |
| T11.9 / U7 | `13dd460` | 1040 `Operational Funds` created; production prerequisite baseline |
| T11.10 / U8 | `1d07360` | @714 77-file runtime deployed; config PREPARED; activation attempt refused zero-write (`SCHEMA:PURCHASE:Suppliers`) |
| T11.10A | `bdc9f33` | Suppliers sheet created (11 canonical headers, 0 rows); probe `ALL_READY` |
| T11.10B | (uncommitted — blocked) | `BLOCKED_AT_PRECHECK` on `6210:METADATA_MISMATCH`; **no invocation** |
| T11.10C | `7f3ee4d` | 6210 `NormalBalance` `""` → `"DEBIT"` (one cell); dual readiness READY/ALL_READY; **no invocation** |
| T11.10D | this unit | **one activation invocation → ACTIVE** |

## 2. Authorization boundary

Owner-authorized: exactly one `activateSingleCommitTransactionV1Production()` invocation
after gates A–E pass. Not authorized and **not performed**: PREP, deploy, `clasp push`,
Accounts/Suppliers mutation, any transaction, Treasury receipt, transitional close,
Git push. Cumulative successful activation transitions before this unit: **0**.

## 3. Identity proof

Non-mutating, no credential material exposed: refresh HTTP 200 (in-memory),
`tokeninfo` email `d***@gmail.com` matches the stored `id_token` claim
(`identity_match true`), Projects API HTTP 200 / 2 deployments, Execution API
HTTP 200 on a read-only call. **`numlock-run auth = VALID`** — re-verified at
the start of this unit.

## 4. Local release gate

| check | result |
| --- | --- |
| tracked runtime delta vs @714 deploy commit `1d07360` | **NONE** (only `docs/T11-10A…` and `docs/T11-10C…`) |
| activation writer `101.SingleCommit.Config.Control.js` | byte-identical to deployed @714 (0 mismatch across the 77-file comparison) |
| package | exactly **77** files; `currentHash e7a1b36e89efeef512b99b51a3654a2e5a6fbae67603fe5e7faf36c8f397ef60` == `registeredHash` == @714 evidence |
| regression | **227 PASS / 0 FAIL** (MEASURED) |
| release audit | **AUDIT_PASS** (28 checks, 16 routing) |
| hardened probe selftest | 8/8 PASS |
| `git diff --check` | clean; no staged/modified tracked files |

Hardened probe remains an **untracked** `tests/tmp/` diagnostic, excluded from the
upload manifest by `.claspignore`; **not deployed**. Runtime drift: none.

## 5. Fresh production precheck (immediately before activation)

Not derived from the U10C baseline. `/tmp/opencode/t1110b-activation-gate.js pre`
→ **10/10 PASS**:

| gate | value |
| --- | --- |
| deployment | 2 deployments, pinned id **@714**, updateTime `2026-10-12T21:37:10.993Z` |
| runtime | 77 files, 0 mismatch, 0 missing; deployed aggregate `f5e6df2dd8efeb75325d9c3482b0d55a56e77add1a498e4f09082981170cf76c` == U8 post-deploy baseline |
| config | `NOOP_ALREADY_PREPARED`, `writes {config:0,sheets:0}`, **PREPARED**, contractVersion exact, `activationID ""`, `activatedAt ""`, configVersion 1 |
| 1040 | exactly 1, `Operational Funds`/`Asset`/`DEBIT`, 0 ledger lines, net 0 |
| 6210 | exactly 1, `Expense`/`Supplies Expense`/`Operating`, active, **`DEBIT`** |
| 1030 | `Sales Settlement Clearing`/`Asset`/`Current Assets`/`DEBIT`, active |
| 4000 | `Sales Revenue`/`Revenue`/`Operating Revenue`/`Operating`, active, NormalBalance blank (frozen exemption `97:351`) |
| Suppliers | 1 sheet, 11 canonical headers exact order, **0** business rows |
| Sales V2 | ACTIVE, configVersion 1 |
| Treasury | ACTIVE/allowed, 0 rows on all three sheets |
| transitional | `SCR-CE122B27-ORD677BE5CES` 1 row; `OK`; outstanding 24000; `ledgerNet1030 24000`; residual **0** |
| T11 artifacts | none |
| schema authorities | purchase/expense/sales exact-header gates all clean |

## 6. Fresh protected fingerprints (pre-activation baseline)

Captured `2026-10-13T12:02:42.407Z` → `/tmp/opencode/t1110b-pre.json`, **21 surfaces**:
BalanceLedger, Accounts, SalesRecognitionEvents, SalesRecognitionAudits, PurchaseEvents,
TransactionOperations, Orders, OrderLines, Payments, Settlements, InventoryLedger,
tabsal, tabops, Logs, Settings, Products, ProductPricing, TreasuryReceipts,
TreasuryOperations, TreasuryAudits, Suppliers.

## 7. Dual readiness gate (agreement required)

| probe | result |
| --- | --- |
| **(1) Deployed @714 authority** (`/tmp/opencode/t1110d-deployed-authority.js`) | **READY — 16/16**, 0 not-ready. Verifies the *actual* deployed predicates (`LockService.getScriptLock` + `waitLock(30000)`, exactly one `setProperty`, server-side uuid/now, PREPARED-only, 6210 Expense/DEBIT, money preflight, Sales V2 compatibility, T5 readers, aggregate 1040 constant, residual-0 gate, Treasury compatibility, configVersion carry, readback gate) **and** evaluates each against live data. |
| **(2) Hardened local probe** (`tests/tmp/t1110a-postwrite-probe.js`, Phase-C baseline) | **`ALL_READY` — 15/15**, 0 fail, `accountGate READY`, deployed predicate tokens 3/3 present, selftest 8/8 embedded, `fingerprintDelta {}`, `activationInvoked false`. |

**Agreement: yes.** No blocker. Proceeded to one invocation.

## 8. Invocation

`POST …/v1/scripts/{scriptId}:run` → `function: "activateSingleCommitTransactionV1Production"`,
`parameters: []` (zero parameters — the client can never choose the mode, the
ActivationID or the timestamp). HTTP 200. **invocationCount = 1.**
Output path `/tmp/opencode/t1110d-activation-invocation.json` (distinct from, and
does not overwrite, the historical U8 artifact `/tmp/opencode/u8-activation-invocation.json`,
sha256 `aac5a383fb89911b10ca4b75d0ffa85c7e6d119259deea4700bd1d73758be8cd`).

**No second invocation was made to "verify" anything.**

## 9. In-lock revalidation

The writer's own `ScriptLock` was authoritative and was not bypassed or weakened.
The structured result's `evidence` block is the in-lock preflight output, recorded
*after* the lock was acquired and *before* the single config write:

| gate evidence | value |
| --- | --- |
| `reconciliationStatus` | `OK` |
| `ledgerNet1030` | `24000` |
| `outstandingTotal` | `24000` |
| `recognizedExposure` | `24000` |
| `explicitExceptionAmount` | `0` |
| `unexplainedResidual` | **`0`** |
| `salesV2Mode` | `ACTIVE` |
| `aggregateMoneyAccounts` | `1000,1010,1020,1040` |

## 10. Structured result

```
httpStatus    200
status        ACTIVATED
code          ""
detail        ""
writes        { config: 1, sheets: 0 }
configVersion 1
```

## 11. ActivationID

`SCA-bcdddd57-7f46-4e88-a096-2be430605a3b` — server-generated, `SCA-` prefix
(`101:33 ACTIVATION_PREFIX`), produced from `Utilities.getUuid()` inside the
lock, never from a caller argument.

## 12. activatedAt

`2026-10-13T12:10:59.372Z` — server clock (`new Date()` inside the lock),
valid ISO 8601.

## 13. configVersion

`1` — carried forward unchanged, per the frozen scheme
(`101:406 var nextConfigVersion = current.configVersion;`). No version inflation.

## 14. ACTIVE config acceptance (independent readback)

Zero-write readback through the reviewed idempotent reader path
(`prepareSingleCommitTransactionV1Production`):

```
status  STOP_UNEXPECTED_MODE  detail  EXISTING_MODE_ACTIVE
writes  { config: 0, sheets: 0 }
config  { mode "ACTIVE", contractVersion "SINGLE_COMMIT_TRANSACTION_V1",
          activationID "SCA-bcdddd57-7f46-4e88-a096-2be430605a3b",
          activatedAt "2026-10-13T12:10:59.372Z", configVersion 1 }
```

Exactly one activation identity; PREPARED is no longer authoritative.

## 15. Routing acceptance (read-only, no Save, no synthetic data)

`/tmp/opencode/t1110d-routing-readers.js` → **16/16 PASS**.

Server-resolved routing (public entrypoint `getOperationalTransactionAuthority`):

| surface | resolved mode |
| --- | --- |
| Sale (`salesV2Mode`) | **ACTIVE** |
| Expense/Purchase (`singleCommitMode`) | **ACTIVE** |

Static invariants verified against the **deployed @714** sources:

| invariant | evidence |
| --- | --- |
| Sale routes T11 | `95A:375` `if (route.mode !== "PREPARED") return salesV2OperatorModeCreateOrder_(payload, route);`; `97D:234-237` ACTIVE → `salesRecognitionV2DurableSave(payload)` |
| no prospective legacy fallback | `97D:251` `route.mode === "ACTIVE" ? SALES_V2_OPERATOR.LEGACY_SALE_CODE`; package-wide scan for `allowLegacyFallback|forceActiveMode|SKIP_GUARD|DEBUG_MUTATION` → none |
| normal Sale needs no TreasuryReceipt | `97A` `WRITE_SURFACES ["Orders","OrderLines","SalesRecognitionEvents",…]`, no `TreasuryReceipts`, no `"Payments"` |
| Expense/Purchase do not request a payment channel | `EXPENSE_SINGLE_COMMIT_PAYMENT_FIELD_REFUSED` + `PURCHASE_SINGLE_COMMIT_PAYMENT_FIELD_REFUSED` present; payment fields are a refusal list, not an allowlist |
| SupplierID optional | `21` "supplierID is OPTIONAL business metadata (D9)"; `supplierID` sits in `ALLOWED_FIELDS`, `supplierId` in the refusal list |
| corrections admit under ACTIVE (U6) | `22` `requireSingleCommitCorrectionRoute_`; `salesV2SingleCommitGate_` present; U6 suite green in the 227/0 regression |

Note: `expenseSingleCommitGate_`, `purchaseSingleCommitGate_`,
`salesV2OperatorResolvedRoute_` and `singleCommitTransactionSalesGate_` are
underscore-prefixed globals; the Execution API refuses them with
`PERMISSION_DENIED`. Routing evidence therefore uses the public
server-resolved modes plus deployed-source predicates — no private-function
calls were attempted as evidence.

## 16. Transaction / Dashboard readers

| reader | result |
| --- | --- |
| `getTransactionsPage` | healthy, 15 rows, `salesRecognition` block present |
| `getDashboardData` | healthy, `summary` present |

## 17. Finance readers

`runFinanceFinalReadinessEvidenceDiagnostic` → `READ_ONLY true`, **`WRITE_COUNT 0`**,
accounts evidence includes **1040 found/active**, all four validation periods
**PASS** (`fullAvailablePeriod` revenue `252866000`, net profit `-93100700`;
`populatedMonth` revenue `391000`; `populatedYear` revenue `19498000`;
`inclusiveCustomRange`), regime **`PROSPECTIVE_PURCHASE_EXPENSE`**, Policy C
disclosure present. Revenue authority is U3-only; `cogs`/`grossProfit` semantics
unchanged (Policy C prospective: `materialPurchasesExpensed` from 6210, no
prospective inventory asset).

`getCashFlowData` → `status PASS`.

`getPartialBalanceData` (Balance Position) → responds; `1040` is inside the
aggregate-money authority (`AGGREGATE_MONEY_ACCOUNT_CODES ["1000","1010","1020","1040"]`,
verified in deployed `40.Cash.Foundation`). Its top-level status is
`ACCOUNTING_DATA_PENDING_RESOLUTION`, which is the **pre-existing Policy C
finalization gate over historical ledger state** — it is a pure function of
`BalanceLedger` + `Accounts`, both of which are byte-identical pre/post
activation (see §23), so activation cannot have caused or changed it. Historical
funds are retained; nothing was re-based.

## 18. T5

`getTreasuryClearingProjection` → HTTP 200, contains `SCR-CE122B27-ORD677BE5CES`,
`24000`, `UNCLEARED`. `getTreasury1030Reconciliation` → `OK`, `ledgerNet1030 24000`,
`unexplainedResidual 0`. Transitional exposure still outstanding; **no synthetic
composed money** was generated.

## 19. 1040

Exactly one row; `Operational Funds` / `Asset` / `Current Assets` / `Operating` /
`DEBIT`, active. `BalanceLedger`: **0 lines reference 1040**, net 0. Activation
did not seed, open or transfer funds.

## 20. 6210 / Suppliers

6210 still `Expense` / `Supplies Expense` / `Operating` / **`DEBIT`**, active,
exactly one row. Suppliers: 1 sheet, 11 canonical headers exact, **0** business rows.

## 21. Treasury

`TREASURY_RECEIPT_V1` remains **ACTIVE** (`mode.mode ACTIVE`, `allowed true`).
`TreasuryReceipts` 0, `TreasuryOperations` 0, `TreasuryAudits` 0. Eligible manual
destinations remain `["1000","1010","1020"]` — **1040 was not added** as a T7
manual destination. No receipt created, no destination mutation, no PAUSE.

## 22. Transitional

`SCR-CE122B27-ORD677BE5CES` exactly 1 row; `ledgerNet1030 24000` (Dr24,000);
`unexplainedResidual 0`. No `SALES_MONEY_V2` / `SRV2M` / `EXPJV` backfill, no
TreasuryReceipt, no EvidenceRef, no `TRANSITIONAL_CLEARING_CLOSE` in
TransactionOperations or Logs. U10 remains a separate unit.

## 23. Post-activation protected fingerprints

Pre (`2026-10-13T12:02:42.407Z`) vs post, **21 surfaces**:

```
FINGERPRINT_DELTA_KEYS []
```

Independently re-confirmed by the t1110b post run (`fingerprintDelta {}`) and by
the final standalone sweep. Accounts included and unchanged (the 6210 repair
happened in T11.10C, before this baseline).

## 24. Zero-financial-effect proof

`ZERO_FINANCIAL_EFFECT: CONFIRMED` — every protected financial/business surface is
byte-identical pre/post activation. The only mutation was one `PropertiesService`
key. Zero financial events of any kind.

## 25. Mutation accounting

| surface | count |
| --- | --- |
| activation invocations | **1** |
| PropertiesService | **1** (the ACTIVE transition) |
| deployment | 0 |
| runtime upload | 0 |
| Accounts | 0 |
| Suppliers | 0 |
| BalanceLedger | 0 |
| transaction/business sheets (Orders, OrderLines, Payments, Settlements, tabops, PurchaseEvents, SalesRecognitionEvents, SalesRecognitionAudits, TransactionOperations) | 0 |
| Treasury (Receipts/Operations/Audits) | 0 |
| transitional close | 0 |
| financial events | 0 |
| Git push | 0 |

## 26. Authorization consumption

**CONSUMED.** Exactly one invocation was made and it returned `ACTIVATED`.
No retry, no second ActivationID, no second invocation to verify. The one-shot
authorization for `PREPARED → ACTIVE` is now closed.

## 27. U9 hard boundary

Stopped at **T11 ACTIVE + zero new T11 financial events**. No Rp1, no dummy or
synthetic Sale/Expense/Purchase, no fake correction. The first genuine transaction
belongs to **`T11_11_U9_FIRST_REAL_TRANSACTION_ACCEPTANCE`** under separate
authorization.

## 28. Evidence limits (honest scope)

- Runtime execution, browser acceptance and a real business transaction were
  **not** exercised — by design (U9 boundary).
- Routing evidence for the three single-commit gates relies on public
  server-resolved modes + deployed-source predicates, because the Execution API
  refuses private globals. The gates themselves additionally re-validate inside
  the writer's lock on every real save.
- Balance Position's `ACCOUNTING_DATA_PENDING_RESOLUTION` is a pre-existing
  historical condition (§17), not a post-activation finding.

---

## Appendix — local artifacts (not committed)

| path | purpose |
| --- | --- |
| `/tmp/opencode/t1110d-deployed-authority.js` / `.json` | deployed @714 authority probe (16/16 READY) |
| `/tmp/opencode/t1110d-activate-once.js` | the single authorized invocation harness |
| `/tmp/opencode/t1110d-activation-invocation.json` | invocation result (ACTIVATED, writes config 1) |
| `/tmp/opencode/t1110d-routing-readers.js` / `.json` | routing + reader acceptance (16/16) |
| `/tmp/opencode/t1110b-pre.json` | pre-activation protected-fingerprint baseline |
| `/tmp/opencode/t1110b-post.json` | post-activation gate run (readback + readers + delta {}) |
| `/tmp/opencode/u8-activation-invocation.json` | historical U8 zero-write refusal — **preserved unmodified** |
| `tests/tmp/t1110a-postwrite-probe.js` | hardened local prerequisite probe (untracked, not deployed) |
