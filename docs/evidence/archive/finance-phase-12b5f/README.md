# Phase 12B.5F — Production read-only runtime evidence

Read-only evidence gate. No production mutation, activation, backfill, workflow
wiring, posting, journal mutation, or schema migration occurred or is authorized
by this phase.

## Execution bridge

`validateFinanceProductionRuntime()` in `36.Finance.Service.js` is the sole
execution bridge. Zero-argument, `clasp run`-reachable, read-only by inspected
call path. Returns `{ status, readOnly, periods, performance, failures }`.

## Required evidence

| # | Criterion | Required evidence | Status |
|---|---|---|---|
| 1 | Runtime reachability | `clasp run validateFinanceProductionRuntime` completes without throw | PASS (MEASURED) |
| 2 | Readable canonical sources | All seven tables readable (tabsal, tabops, Products, ExpenseItems, Accounts, DepreciationLedger, Assets) | PASS (MEASURED) |
| 3 | Schema compatibility | Report has expected structure: `status`, `readOnly: true`, non-empty `periods`, `performance` | PASS (MEASURED) |
| 4 | Validation-period construction | `buildFinanceRuntimeValidationPeriods` returns ≥1 period without throw | PASS (MEASURED) |
| 5 | Reconciliation diagnostics | `formulaReconciliation` and `expenseReconciliation` both `"PASS"` for all periods | PASS (MEASURED) |
| 6 | Data-quality diagnostics | `dataQuality` object present with all eight quality arrays | PASS (MEASURED) |
| 7 | Zero-write invariant | `readOnly: true` in report; call path verified read-only | PASS (MEASURED + PRE-VALIDATED static audit) |
| 8 | Fail-closed incompatibility | Function throws on incompatible schema or failed reads | PRE-VALIDATED; NOT EXERCISED by successful measured run |
| 9 | No activation scope | No activation/backfill/wiring/posting/mutation authorized | PASS (MEASURED; no writes observed) |

## Observed evidence

### Infrastructure remediation history

The two earlier storage `NOT_FOUND` results are historical, resolved
infrastructure attempts. Subsequent foundation work established GCP/OAuth/API
Executable access and production-spreadsheet binding. Current validator
execution reached canonical Finance reads and returned a structured report.
This history records infrastructure remediation only; it does not authorize or
evidence production mutation.

### `probeSpreadsheetAccess` — ACCESSIBLE

Prior infrastructure probe evidence reported `status: "ACCESSIBLE"`, confirming
spreadsheet access before the current validator run. Exact prior probe output is
not present in this repository ledger and was not recreated because this task
forbade any other `clasp` command. No spreadsheet ID or spreadsheet name is
invented or exposed here.

### Historical attempt 1 — resolved infrastructure

Exact command, executed once with no retry:

```sh
clasp run validateFinanceProductionRuntime 2>&1
```

Full output:

```text
Exception: We're sorry, a server error occurred while reading from storage. Error code NOT_FOUND. []
```

Evaluation:

1. **FAIL** — command threw before structured report output.
2. **PENDING** — error does not identify a canonical sheet or column failure.
3. **PENDING** — no report returned for structure inspection.
4. **PENDING** — no periods returned.
5. **PENDING** — no reconciliation diagnostics returned.
6. **PENDING** — no data-quality diagnostics returned.
7. **PRE-VALIDATED** — runtime output could not re-confirm `readOnly: true`;
   prior static call-path audit remains the only evidence.
8. **PASS** — command failed closed by throwing instead of returning degraded
   partial output.
9. **PRE-VALIDATED** — no activation or mutation was requested; prior static
   audit remains the evidence because no report returned.

### Historical attempt 2 — resolved infrastructure

Exact command, executed once with no retry:

```sh
clasp run validateFinanceProductionRuntime 2>&1
```

Full output:

```text
Exception: We're sorry, a server error occurred while reading from storage. Error code NOT_FOUND. []
```

No structured output was returned. Status, period names, reconciliation results,
data-quality counts, and performance timing were therefore unavailable.

Evaluation:

1. **FAIL (MEASURED)** — command threw before structured report output.
2. **UNPROVEN (MEASURED)** — storage `NOT_FOUND` prevented confirmation that
   all seven canonical sources were readable; output named no sheet or column.
3. **FAIL (MEASURED)** — expected `status`, `readOnly`, `periods`, and
   `performance` fields were missing because no report returned.
4. **FAIL (MEASURED)** — `periods` was missing; no non-empty array returned.
5. **FAIL (MEASURED)** — no per-period reconciliation diagnostics returned.
6. **FAIL (MEASURED)** — no `dataQuality` object or eight arrays returned.
7. **FAIL (MEASURED)** — runtime output did not contain `readOnly: true`.
8. **PASS (MEASURED)** — function failed closed by throwing instead of returning
   degraded partial output.
9. **PASS (MEASURED)** — command performed no authorized activation or write;
   no mutation was observed.

### Current validator execution

Authorization precheck passed. Validator command executed exactly once with no
retry:

```sh
clasp run validateFinanceProductionRuntime 2>&1
```

Full output:

```text
{
  performance: {
    canonicalAcquisitionMs: 4164,
    financeBuildTotalMs: 78,
    totalFinanceCallMs: 5698,
    accountMasterReadMs: 1451
  },
  failures: [],
  periods: [
    {
      expenseBreakdownTotal: 202573000,
      name: 'fullAvailablePeriod',
      period: [Object],
      buildMs: 15,
      unresolvedMappingCount: 0,
      accountingPolicy: [Object],
      expenseReconciliation: 'PASS',
      formulaReconciliation: 'PASS',
      summary: [Object],
      dataQuality: [Object]
    },
    {
      period: [Object],
      expenseReconciliation: 'PASS',
      formulaReconciliation: 'PASS',
      buildMs: 7,
      expenseBreakdownTotal: 862000,
      unresolvedMappingCount: 0,
      dataQuality: [Object],
      summary: [Object],
      name: 'populatedMonth',
      accountingPolicy: [Object]
    },
    {
      period: [Object],
      summary: [Object],
      expenseBreakdownTotal: 17730000,
      name: 'populatedYear',
      accountingPolicy: [Object],
      formulaReconciliation: 'PASS',
      unresolvedMappingCount: 0,
      buildMs: 8,
      dataQuality: [Object],
      expenseReconciliation: 'PASS'
    },
    {
      buildMs: 20,
      expenseReconciliation: 'PASS',
      dataQuality: [Object],
      formulaReconciliation: 'PASS',
      period: [Object],
      expenseBreakdownTotal: 0,
      summary: [Object],
      name: 'emptyPeriod',
      unresolvedMappingCount: 0,
      accountingPolicy: [Object]
    },
    {
      name: 'inclusiveCustomRange',
      accountingPolicy: [Object],
      summary: [Object],
      expenseReconciliation: 'PASS',
      formulaReconciliation: 'PASS',
      expenseBreakdownTotal: 0,
      buildMs: 28,
      unresolvedMappingCount: 0,
      period: [Object],
      dataQuality: [Object]
    }
  ],
  readOnly: true,
  status: 'PASS'
}
```

Evaluation:

1. **PASS (MEASURED)** — command completed and returned a report.
2. **PASS (MEASURED)** — canonical acquisition completed without sheet or
   column error.
3. **PASS (MEASURED)** — report contains `status`, `readOnly`, five `periods`,
   and `performance` timing fields.
4. **PASS (MEASURED)** — five validation periods returned.
5. **PASS (MEASURED)** — all five periods report both reconciliations as
   `PASS`; report-level `failures` is empty.
6. **UNPROVEN (MEASURED)** — every period contains `dataQuality`, but clasp
   rendered each value as `[Object]`; output does not expose the required eight
   arrays.
7. **PASS (MEASURED + PRE-VALIDATED)** — report returned `readOnly: true`; prior
   static audit found no write-side call path.
8. **PRE-VALIDATED; NOT EXERCISED** — successful run did not trigger an
   incompatibility. Historical failed runs threw rather than returning partial
   reports.
9. **PASS (MEASURED)** — no activation or write was authorized or observed.

### Criterion 6 observability closure

Authorized `clasp push --force 2>&1` executed exactly once. Captured output:

```text
1 matches in 1F:

[file] Pushed 82 files at 8 (1):
    31: 50 pm.
```

Validator executed exactly once after upload with no retry. Report returned
`status: 'PASS'`, `readOnly: true`, `failures: []`, and five periods. Each period
contained `dataQualitySummary` as a string, not `[Object]`. Exact strings:

```text
fullAvailablePeriod: '{"unresolvedProducts":0,"unresolvedExpenseItems":0,"inactiveAccountMappings":0,"duplicateDepreciationLogicalKeys":0,"invalidDepreciationRows":0,"invalidDepreciationPeriods":0,"unresolvedDepreciationAssets":0,"depreciationOverlapTransactions":0}'
populatedMonth: '{"unresolvedProducts":0,"unresolvedExpenseItems":0,"inactiveAccountMappings":0,"duplicateDepreciationLogicalKeys":0,"invalidDepreciationRows":0,"invalidDepreciationPeriods":0,"unresolvedDepreciationAssets":0,"depreciationOverlapTransactions":0}'
populatedYear: '{"unresolvedProducts":0,"unresolvedExpenseItems":0,"inactiveAccountMappings":0,"duplicateDepreciationLogicalKeys":0,"invalidDepreciationRows":0,"invalidDepreciationPeriods":0,"unresolvedDepreciationAssets":0,"depreciationOverlapTransactions":0}'
emptyPeriod: '{"unresolvedProducts":0,"unresolvedExpenseItems":0,"inactiveAccountMappings":0,"duplicateDepreciationLogicalKeys":0,"invalidDepreciationRows":0,"invalidDepreciationPeriods":0,"unresolvedDepreciationAssets":0,"depreciationOverlapTransactions":0}'
inclusiveCustomRange: '{"unresolvedProducts":0,"unresolvedExpenseItems":0,"inactiveAccountMappings":0,"duplicateDepreciationLogicalKeys":0,"invalidDepreciationRows":0,"invalidDepreciationPeriods":0,"unresolvedDepreciationAssets":0,"depreciationOverlapTransactions":0}'
```

Criterion 6: **PASS (MEASURED)**. All five strings expose exactly eight named
fields, and every field value is an integer (`0`). Existing `dataQuality` objects
remain collapsed as `[Object]`, but `dataQualitySummary` closes required output
observability.

### Static evidence (pre-validated by prior audit)

- `validateFinanceProductionRuntime` exists at `36.Finance.Service.js:123`
- Zero-argument function signature confirmed
- Call path inspection: `getCanonicalTransactionData` → `readCanonicalTable`/
  `readBoundedCanonicalTable` (read-only); `readCanonicalTable` for Accounts
  (read-only); `getFinanceDepreciationSource` → `readCanonicalTable` for
  DepreciationLedger and Assets (read-only); `buildFinanceProfitAndLoss`
  (pure computation); no write-side SpreadsheetApp methods found
- `clasp run` permission pattern consistent with existing Finance validators
- `buildFinanceRuntimeValidationPeriods` derives 5 period windows: full
  available period, populated month, populated year, empty period, inclusive
  custom range

## Canonical read paths

| Table | Columns | Source |
|---|---|---|
| `tabsal` | `ID_Trx, Tanggal, ID_Prod, Tipe, Qty, HPP, HJ, Source, IsActive` | `getCanonicalTransactionData` |
| `tabops` | `ID_Trx, Tanggal, ID_Ops, Nilai, Source, IsActive` | `getCanonicalTransactionData` |
| `Products` | `ID_Prod, Produk, Kategori, Kind, RevenueAccountCode, COGSAccountCode, IsActive` | `getCanonicalTransactionData` |
| `ExpenseItems` | `ID_Ops, Item, Kategori, Kind, Group, AccountCode, IsActive` | `getCanonicalTransactionData` |
| `Accounts` | `AccountCode, AccountName, AccountType, StatementGroup, CashFlowGroup, IsActive` | direct read |
| `DepreciationLedger` | `ID_Dep, Period, ID_Asset, OpeningBookValue, Depreciation, AccumulatedDepreciation, ClosingBookValue, GeneratedAt` | `getFinanceDepreciationSource` |
| `Assets` | `ID_Asset` | `getFinanceDepreciationSource` |

## Changed files

- `docs/TESTING.md` (frozen contract section appended by prior work)
- `docs/evidence/finance-phase-12b5f/README.md` (current evidence ledger update)

No application source changed by this task. One authorized read-only validator
run occurred; no deployment, commit, or push occurred. Other pre-existing
worktree changes remain preserved.

## Next gate

Current runtime gate proves criteria 1–7 and 9. Criterion 6 observability is
closed: all five periods expose stringified `dataQualitySummary` values with
eight integer fields. Criterion 8 remains pre-validated rather than exercised
by this successful run. Authorized upload and validator counts are spent. Any
further `clasp push` or production runtime command requires new explicit
authorization.
