function testDepreciationEngineContract() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  function asset(overrides) {
    var value = { ID_Asset: "AST-1", Jumlah: 7, TanggalPerolehan: "2024-08-30",
      BiayaPerolehan: 120000, UmurEkonomisBulan: 24, NilaiResidu: 0,
      DepreciationMethod: "StraightLine", DisposedAt: "" };
    Object.keys(overrides || {}).forEach(function(key) { value[key] = overrides[key]; });
    return value;
  }
  function invalidCode(overrides, code) {
    return validateDepreciationAsset(asset(overrides)).errors.indexOf(code) !== -1;
  }

  var single = calculateDepreciationSchedule(asset({ BiayaPerolehan: 1200, UmurEkonomisBulan: 12 }), "2025-07-01");
  check(single.length === 12 && single[0].Depreciation === 100, "single straight-line asset");
  check(single[0].Period === "2024-08-01", "acquisition month included");
  check(calculateDepreciationSchedule(asset({ TanggalPerolehan: "2024-08-01" }), "2024-08-01").length === 1,
    "first-day acquisition");
  check(calculateDepreciationSchedule(asset({ TanggalPerolehan: "2024-08-31" }), "2024-08-01").length === 1,
    "last-day acquisition");
  [24, 36, 60, 120].forEach(function(life) {
    check(calculateDepreciationSchedule(asset({ UmurEkonomisBulan: life }), "2040-01-01").length === life,
      life + "-month life");
  });
  var residual = calculateDepreciationSchedule(asset({ BiayaPerolehan: 1000, NilaiResidu: 100,
    UmurEkonomisBulan: 3 }), "2024-10-01");
  check(residual[2].ClosingBookValue === 100, "residual value respected");
  check(single[0].OpeningBookValue === 1200, "cost does not multiply by quantity");
  var rounded = calculateDepreciationSchedule(asset({ BiayaPerolehan: 100, UmurEkonomisBulan: 3 }), "2024-10-01");
  check(rounded[0].Depreciation === 33 && rounded[1].Depreciation === 33, "integer Rupiah rounding");
  check(rounded[2].Depreciation === 34 && rounded[2].ClosingBookValue === 0, "final-period true-up");
  check(rounded.every(function(row) { return row.ClosingBookValue >= 0; }), "no value below residual");
  check(rounded[2].AccumulatedDepreciation === 100, "accumulated depreciation cap");
  check(calculateDepreciationSchedule(asset(), "2024-09-01").length === 2, "target before maturity");
  check(calculateDepreciationSchedule(asset(), "2030-01-01").length === 24, "target after maturity");
  var disposed = calculateDepreciationSchedule(asset({ DisposedAt: "2024-10-17" }), "2025-01-01");
  check(disposed.length === 3 && disposed[2].Period === "2024-10-01", "disposal month included");
  check(disposed.every(function(row) { return row.Period <= "2024-10-01"; }), "no rows after disposal month");
  check(single[0].ID_Dep === "DEP-AST-1-202408", "deterministic ledger identity");
  check(JSON.stringify(calculateDepreciationSchedule(asset(), "2024-09-01")) ===
    JSON.stringify(calculateDepreciationSchedule(asset(), "2024-09-01")), "rerun idempotency semantics");
  var multiple = buildDepreciationDryRun([asset(), asset({ ID_Asset: "AST-2" })], "2024-08-01");
  check(multiple.assetCount === 2 && multiple.generatedRowCount === 2, "multiple assets");
  check(buildDepreciationDryRun([], "2024-08-01").generatedRowCount === 0, "empty asset input");
  check(invalidCode({ BiayaPerolehan: 0 }, "INVALID_COST"), "invalid cost");
  check(invalidCode({ NilaiResidu: 120001 }, "INVALID_RESIDUAL"), "invalid residual");
  check(invalidCode({ UmurEkonomisBulan: 0 }, "INVALID_USEFUL_LIFE"), "invalid useful life");
  check(invalidCode({ DepreciationMethod: "DecliningBalance" }, "UNSUPPORTED_METHOD"), "unsupported method");
  check(multiple.reconciliationFailures.length === 0 && multiple.duplicateLogicalKeys.length === 0,
    "dry-run reconciliation and logical uniqueness");
  var duplicate = buildDepreciationDryRun([asset(), asset()], "2024-08-01");
  check(duplicate.duplicateLogicalKeys.length === 1, "duplicate logical key detection");
  check(validateDepreciationDryRun.toString().indexOf("setValues") === -1 &&
    validateDepreciationDryRun.toString().indexOf("appendRow") === -1, "production diagnostic is read-only");

  function memoryLedger(initialRows, corruptWrite) {
    var rows = [DEPRECIATION_POLICY.LEDGER_HEADERS.slice()].concat((initialRows || []).map(function(row) { return row.slice(); }));
    return {
      getLastRow: function() {
        for (var index = rows.length - 1; index >= 0; index--) {
          if (rows[index].some(function(value) { return value !== "" && value != null; })) return index + 1;
        }
        return 1;
      },
      getLastColumn: function() { return DEPRECIATION_POLICY.LEDGER_HEADERS.length; },
      getDataRange: function() { return { getValues: function() { return rows.map(function(row) { return row.slice(); }); } }; },
      getRange: function(row, column, rowCount, columnCount) {
        return {
          setValues: function(values) {
            values.forEach(function(value, offset) {
              while (rows.length < row + offset) rows.push(new Array(DEPRECIATION_POLICY.LEDGER_HEADERS.length).fill(""));
              rows[row + offset - 1] = value.slice();
            });
            if (corruptWrite && row === 2) rows[1][6] += 1;
          },
          getValues: function() {
            var result = [];
            for (var offset = 0; offset < rowCount; offset++) {
              var source = rows[row + offset - 1] || [];
              result.push(source.slice(column - 1, column - 1 + columnCount));
            }
            return result;
          },
          clearContent: function() {
            for (var offset = 0; offset < rowCount; offset++) {
              var target = rows[row + offset - 1];
              if (!target) continue;
              for (var cell = column - 1; cell < column - 1 + columnCount; cell++) target[cell] = "";
            }
          }
        };
      }
    };
  }
  function memorySpreadsheet(ledger) {
    return { getSheetByName: function(name) { return name === "DepreciationLedger" ? ledger : null; } };
  }

  var emptyLedger = memoryLedger([]), emptySpreadsheet = memorySpreadsheet(emptyLedger);
  check(requireEmptyDepreciationLedger(emptySpreadsheet) === emptyLedger, "pre-write empty-ledger gate");
  var populatedLedger = memoryLedger([["DEP-X-202401", new Date(2024, 0, 1), "X", 1, 1, 1, 0, new Date()]]);
  var populatedRefused = false;
  try { requireEmptyDepreciationLedger(memorySpreadsheet(populatedLedger)); } catch (error) {
    populatedRefused = error.message.indexOf("rows=1") !== -1;
  }
  check(populatedRefused, "populated-ledger refusal");

  var accepted = {};
  Object.keys(DEPRECIATION_BACKFILL_ACCEPTANCE).forEach(function(key) { accepted[key] = DEPRECIATION_BACKFILL_ACCEPTANCE[key]; });
  accepted.rows = new Array(DEPRECIATION_BACKFILL_ACCEPTANCE.generatedRowCount);
  accepted.invalidAssets = []; accepted.duplicateLogicalKeys = []; accepted.reconciliationFailures = [];
  check(assertDepreciationBackfillCandidate(accepted) === accepted, "candidate exact expected count and aggregates");
  accepted.generatedRowCount--;
  var candidateRejected = false;
  try { assertDepreciationBackfillCandidate(accepted); } catch (error) { candidateRejected = true; }
  check(candidateRejected, "candidate mismatch rejected before write");

  var writeRows = depreciationRowsForWrite(multiple, new Date(2026, 7, 31));
  check(writeRows[0].length === 8 && writeRows[0][0] === multiple.rows[0].ID_Dep &&
    writeRows[0][1] instanceof Date && writeRows[0][1].getDate() === 1 && writeRows[0][7] instanceof Date,
    "write schema and column order");
  var persistedLedger = memoryLedger([]), persistedSpreadsheet = memorySpreadsheet(persistedLedger);
  var preWriteState = persistedLedger.getDataRange().getValues();
  var physical = persistDepreciationBackfill(persistedSpreadsheet,
    [asset(), asset({ ID_Asset: "AST-2" })], multiple, new Date(2026, 7, 31), preWriteState,
    { spreadsheet: persistedSpreadsheet, flush: function() {} });
  check(physical.physicalRows === 2 && physical.uniqueIds === 2 && physical.uniqueLogicalKeys === 2,
    "physical post-write reconstruction and reconciliation");
  var physicalRows = readCanonicalTable(persistedSpreadsheet, "DepreciationLedger", DEPRECIATION_POLICY.LEDGER_HEADERS);
  physicalRows[1].ID_Dep = physicalRows[0].ID_Dep;
  var duplicateRejected = false;
  try { assertPhysicalDepreciationLedger([asset(), asset({ ID_Asset: "AST-2" })], physicalRows, multiple); }
  catch (error) { duplicateRejected = true; }
  check(duplicateRejected, "physical duplicate rejection");

  var corruptLedger = memoryLedger([], true), corruptSpreadsheet = memorySpreadsheet(corruptLedger), rollbackPassed = false;
  try {
    persistDepreciationBackfill(corruptSpreadsheet, [asset(), asset({ ID_Asset: "AST-2" })], multiple,
      new Date(2026, 7, 31), corruptLedger.getDataRange().getValues(),
      { spreadsheet: corruptSpreadsheet, flush: function() {} });
  } catch (error) { rollbackPassed = error.message.indexOf("ROLLBACK — PASS") !== -1; }
  check(rollbackPassed, "post-write failure rollback path");
  check(readCanonicalTable(corruptSpreadsheet, "DepreciationLedger", DEPRECIATION_POLICY.LEDGER_HEADERS).length === 0,
    "rollback restores empty ledger");
  check(JSON.stringify(buildDepreciationDryRun([asset(), asset({ ID_Asset: "AST-2" })], "2024-08-01").rows) ===
    JSON.stringify(multiple.rows), "idempotent candidate after persistence");
  check(!Object.prototype.hasOwnProperty.call(depreciationReportSummary(multiple), "rows"),
    "runtime diagnostic excludes full ledger rows");
  check(FINANCE_ACCOUNTING_POLICY.depreciationIncluded === true &&
    FINANCE_ACCOUNTING_POLICY.depreciationSource === "DepreciationLedger" &&
    buildFinanceDepreciationSource.toString().indexOf("BiayaPerolehan") === -1,
    "Finance uses authoritative ledger without asset recalculation");

  Logger.log("PASS: testDepreciationEngineContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testDepreciationReportContract() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }

  function memorySheet(values) {
    var data = values.map(function(row) { return row.slice(); });
    return {
      getDataRange: function() {
        return { getValues: function() { return data.map(function(row) { return row.slice(); }); } };
      }
    };
  }
  function memorySpreadsheet(sheets) {
    return { getSheetByName: function(name) { return sheets[name] || null; } };
  }

  function makeAsset(overrides) {
    var value = { ID_Asset: "", Nama: "", Kategori: "", Jumlah: 1, TanggalPerolehan: "",
      BiayaPerolehan: 0, UmurEkonomisBulan: 1, NilaiResidu: 0,
      DepreciationMethod: "StraightLine", IsActive: true, DisposedAt: "",
      Notes: "", CreatedAt: "", UpdatedAt: "" };
    Object.keys(overrides || {}).forEach(function(key) { value[key] = overrides[key]; });
    return value;
  }

  function makeAccount(code) {
    return [code, "Account " + code, "Asset", "Non-Current Assets", "", true];
  }

  function buildFixture(assetList, extraAccounts) {
    var ah = DEPRECIATION_POLICY.ASSET_HEADERS;
    var lh = DEPRECIATION_POLICY.LEDGER_HEADERS;
    var acH = ["AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"];
    var accountRows = DEPRECIATION_POLICY.ACCOUNT_CODES.map(makeAccount);
    (extraAccounts || []).forEach(function(code) { accountRows.push(makeAccount(code)); });
    return memorySpreadsheet({
      Assets: memorySheet([ah].concat(assetList.map(function(a) {
        return [a.ID_Asset, a.Nama, a.Kategori, a.Jumlah, a.TanggalPerolehan,
          a.BiayaPerolehan, a.UmurEkonomisBulan, a.NilaiResidu, a.DepreciationMethod,
          a.IsActive, a.DisposedAt, a.Notes, a.CreatedAt, a.UpdatedAt];
      }))),
      DepreciationLedger: memorySheet([lh]),
      Accounts: memorySheet([acH].concat(accountRows))
    });
  }

  function rr(ss, filter, start, end) {
    return getDepreciationDataWithRuntime({ spreadsheet: ss }, filter, start, end);
  }

  // --- Scenario 1: CUSTOM period with 4 assets ---
  var a1 = makeAsset({ ID_Asset: "AST-1", Nama: "Machine", Kategori: "Equipment",
    TanggalPerolehan: "2026-01-01", BiayaPerolehan: 120000, UmurEkonomisBulan: 12 });
  var a2 = makeAsset({ ID_Asset: "AST-2", Nama: "Desk", Kategori: "Furniture",
    TanggalPerolehan: "2025-01-01", BiayaPerolehan: 60000, UmurEkonomisBulan: 6 });
  var a3 = makeAsset({ ID_Asset: "AST-3", Nama: "Shelf", Kategori: "Furniture",
    TanggalPerolehan: "2026-01-01", BiayaPerolehan: 36000, UmurEkonomisBulan: 12, NilaiResidu: 6000 });
  var a4 = makeAsset({ ID_Asset: "AST-4", Nama: "Cart", Kategori: "Equipment",
    TanggalPerolehan: "2026-01-01", BiayaPerolehan: 24000, UmurEkonomisBulan: 12,
    DisposedAt: "2026-04-15" });

  var fixture1 = buildFixture([a1, a2, a3, a4]);
  var r1 = rr(fixture1, "custom", "2026-01-01", "2026-06-30");

  check(r1.status === "AVAILABLE", "scenario 1: AVAILABLE status");
  check(r1.error === null, "scenario 1: no error");
  check(r1.period.filter === "custom", "custom filter preserved");
  check(typeof r1.asOfDate === "string", "scenario 1: asOfDate present");
  check(r1.summary.assetCount === 4, "4 assets counted");
  check(r1.summary.acquisitionCost === 240000, "total acquisition cost");
  check(r1.summary.residualValue === 6000, "total residual value");
  check(r1.summary.depreciableBase === 234000, "total depreciable base");
  // AST-1: 6×10000=60000, AST-2: fully depreciated before period=0,
  // AST-3: 6×2500=15000, AST-4: disposed, 4×2000=8000. Total: 83000
  check(r1.summary.periodDepreciation === 83000, "period depreciation scoped correctly");
  check(r1.reconciliation.netBookValue.status === "RECONCILED", "NBV reconciliation");
  check(r1.quality.status === "GOOD", "clean quality for valid assets");

  // --- Scenario 2: Full year period ---
  var fixture2 = buildFixture([a1, a2, a3, a4]);
  var r2 = rr(fixture2, "custom", "2026-01-01", "2026-12-31");
  // AST-1: acquired 2026-01, 12mo, through TARGET_PERIOD 2026-08-01 = 8 months × 10000 = 80000
  // AST-2: fully depreciated before period, 0
  // AST-3: 8 months × 2500 = 20000
  // AST-4: disposed 2026-04, 4 months × 2000 = 8000
  // Total period: 108000
  check(r2.summary.periodDepreciation === 108000, "full year scoped to target period");
  // NBV through TARGET_PERIOD: AST-1:40000 + AST-2:0 + AST-3:16000 + AST-4:16000 = 72000
  check(r2.summary.netBookValue === 72000, "full year NBV");
  check(r2.reconciliation.netBookValue.status === "RECONCILED", "full year NBV recon");

  // --- Scenario 3: Mid-year custom period ---
  var fixture3 = buildFixture([a1, a2, a3, a4]);
  var r3 = rr(fixture3, "custom", "2026-07-01", "2026-09-30");
  // AST-1: 2 rows (2026-07, 2026-08) × 10000 = 20000
  // AST-2: fully depreciated, 0. AST-3: 2×2500=5000. AST-4: disposed, 0.
  // Total: 25000
  check(r3.summary.periodDepreciation === 25000, "mid-year custom period depreciation");
  check(r3.reconciliation.netBookValue.status === "RECONCILED", "mid-year NBV recon");

  // --- Scenario 4: Asset acquired before period (fully depreciated) ---
  var aBefore = makeAsset({ ID_Asset: "AST-B", Nama: "Old", Kategori: "Equipment",
    TanggalPerolehan: "2024-08-01", BiayaPerolehan: 12000, UmurEkonomisBulan: 12 });
  var fixture4 = buildFixture([aBefore]);
  var r4 = rr(fixture4, "custom", "2026-01-01", "2026-06-30");
  // Fully depreciated by 2025-07-01. No rows in 2026.
  check(r4.summary.periodDepreciation === 0, "pre-period asset zero depreciation");
  check(r4.summary.netBookValue === 0, "fully depreciated NBV zero");
  check(r4.summary.acquisitionCost === 12000, "pre-period acquisition cost preserved");

  // --- Scenario 5: Asset acquired after asOf ---
  var aAfter = makeAsset({ ID_Asset: "AST-A", Nama: "New", Kategori: "Equipment",
    TanggalPerolehan: "2026-09-01", BiayaPerolehan: 18000, UmurEkonomisBulan: 12 });
  var fixture5 = buildFixture([aAfter]);
  var r5 = rr(fixture5, "custom", "2026-01-01", "2026-06-30");
  check(r5.status === "EMPTY", "post-asOf: EMPTY status");
  check(r5.summary.periodDepreciation === 0, "post-asOf zero period depreciation");
  // Asset row still shows in assets list
  check(r5.assets.length === 1, "post-asOf asset still in list");
  check(r5.assets[0].id === "AST-A", "post-asOf asset ID preserved");
  check(r5.assets[0].netBookValue === 18000, "post-asOf asset shows cost as NBV");

  // --- Scenario 6: Disposed asset ---
  var aDisp = makeAsset({ ID_Asset: "AST-D", Nama: "Sold", Kategori: "Equipment",
    TanggalPerolehan: "2026-01-01", BiayaPerolehan: 24000, UmurEkonomisBulan: 12,
    DisposedAt: "2026-04-15" });
  var fixture6 = buildFixture([aDisp]);
  var r6 = rr(fixture6, "custom", "2026-01-01", "2026-06-30");
  // 4 months depreciation: 8000. Accumulated: 8000. NBV: 16000.
  check(r6.summary.periodDepreciation === 8000, "disposed asset period depreciation");
  check(r6.assets[0].disposedAt === "2026-04-01", "disposed date normalized");

  // --- Scenario 7: Zero-period depreciation ---
  var aFuture = makeAsset({ ID_Asset: "AST-F", Nama: "Future", Kategori: "Equipment",
    TanggalPerolehan: "2026-09-01", BiayaPerolehan: 12000, UmurEkonomisBulan: 12 });
  var fixture7 = buildFixture([aFuture]);
  var r7 = rr(fixture7, "custom", "2026-01-01", "2026-06-30");
  check(r7.status === "EMPTY", "zero-period: EMPTY status");
  check(r7.summary.periodDepreciation === 0, "zero-period depreciation");

  // --- Scenario 8: Fully depreciated ---
  var aFull = makeAsset({ ID_Asset: "AST-FD", Nama: "Fully", Kategori: "Equipment",
    TanggalPerolehan: "2025-01-01", BiayaPerolehan: 60000, UmurEkonomisBulan: 12 });
  var fixture8 = buildFixture([aFull]);
  var r8 = rr(fixture8, "custom", "2026-01-01", "2026-06-30");
  // Fully depreciated by 2025-12-01. No depreciation in 2026.
  check(r8.summary.periodDepreciation === 0, "fully depreciated zero period dep");
  check(r8.summary.netBookValue === 0, "fully depreciated NBV zero");
  check(r8.assets[0].accumulatedDepreciation === 60000, "fully depreciated accumulated");

  // --- Scenario 9-11: Reconciliation ---
  var aRecon = makeAsset({ ID_Asset: "AST-R", Nama: "Recon", Kategori: "Equipment",
    TanggalPerolehan: "2026-01-01", BiayaPerolehan: 120000, UmurEkonomisBulan: 12,
    NilaiResidu: 12000 });
  var fixture9 = buildFixture([aRecon]);
  var r9 = rr(fixture9, "custom", "2026-01-01", "2026-06-30");
  // Monthly: (120000 - 12000) / 12 = 9000. 6 months = 54000.
  check(r9.summary.periodDepreciation === 54000, "recon period depreciation");
  check(r9.reconciliation.periodDepreciation.status === "RECONCILED", "period dep status");
  check(r9.reconciliation.netBookValue.status === "RECONCILED", "NBV recon status");
  check(r9.reconciliation.accumulatedDepreciation.status === "RECONCILED", "accum recon status");

  // --- Prove periodDepreciation reconciliation is NOT tautological ---
  var assetPeriodSum = r9.assets.reduce(function(s, a) { return s + a.periodDepreciation; }, 0);
  check(r9.reconciliation.periodDepreciation.reportValue === assetPeriodSum,
    "non-tautological: reportValue = sum of asset periodDepreciation");
  check(r9.reconciliation.periodDepreciation.referenceValue === r9.summary.periodDepreciation,
    "non-tautological: referenceValue = canonical scoped period depreciation");
  check(r9.reconciliation.periodDepreciation.difference === assetPeriodSum - r9.summary.periodDepreciation,
    "non-tautological: difference = reportValue - referenceValue");
  check(typeof assetPeriodSum === "number" && assetPeriodSum > 0,
    "non-tautological: asset aggregation produces non-zero sum");

  // --- Scenario 11b: Reconciliation enum unit tests ---
  // Exact integer comparison: equal values → RECONCILED
  var rc1 = buildDepreciationReconciliation(
    { totalGrossCost: 200, totalAccumulatedDepreciation: 50, totalNBV: 150 },
    { depreciationExpense: 100 }, { rows: [{ periodDepreciation: 100 }] });
  check(rc1.periodDepreciation.status === "RECONCILED", "enum: 100 vs 100 → RECONCILED");
  check(rc1.periodDepreciation.difference === 0, "enum: equal difference is 0");
  check(rc1.periodDepreciation.reportValue === 100, "enum: reportValue 100");
  check(rc1.periodDepreciation.referenceValue === 100, "enum: referenceValue 100");
  check(rc1.accumulatedDepreciation.status === "RECONCILED", "enum: accum equal → RECONCILED");
  check(rc1.netBookValue.status === "RECONCILED", "enum: NBV equal → RECONCILED");

  // Negative difference → DIFFERENCE
  var rc2 = buildDepreciationReconciliation(
    { totalGrossCost: 200, totalAccumulatedDepreciation: 60, totalNBV: 140 },
    { depreciationExpense: 100 }, { rows: [{ periodDepreciation: 90 }] });
  check(rc2.periodDepreciation.status === "DIFFERENCE", "enum: 90 vs 100 → DIFFERENCE");
  check(rc2.periodDepreciation.difference === -10, "enum: negative difference preserved");

  // Positive difference → DIFFERENCE
  var rc3 = buildDepreciationReconciliation(
    { totalGrossCost: 200, totalAccumulatedDepreciation: 40, totalNBV: 160 },
    { depreciationExpense: 100 }, { rows: [{ periodDepreciation: 110 }] });
  check(rc3.periodDepreciation.status === "DIFFERENCE", "enum: 110 vs 100 → DIFFERENCE");
  check(rc3.periodDepreciation.difference === 10, "enum: positive difference preserved");

  // Null reference → UNAVAILABLE
  var rc4 = buildDepreciationReconciliation(
    { totalGrossCost: 200, totalAccumulatedDepreciation: 50, totalNBV: 150 },
    { depreciationExpense: null }, { rows: [{ periodDepreciation: 100 }] });
  check(rc4.periodDepreciation.status === "UNAVAILABLE", "enum: null reference → UNAVAILABLE");
  check(rc4.periodDepreciation.reportValue === 100, "enum: UNAVAILABLE preserves reportValue");
  check(rc4.periodDepreciation.referenceValue === null, "enum: UNAVAILABLE preserves null ref");

  // Undefined reference → UNAVAILABLE
  var rc5 = buildDepreciationReconciliation(
    { totalGrossCost: 200, totalAccumulatedDepreciation: 50, totalNBV: 150 },
    {}, { rows: [] });
  check(rc5.periodDepreciation.status === "UNAVAILABLE", "enum: undefined reference → UNAVAILABLE");

  var validReconStatuses = { "RECONCILED": true, "DIFFERENCE": true, "UNAVAILABLE": true };
  // No MISMATCH anywhere in reconciliation output
  [rc1, rc2, rc3, rc4, rc5].forEach(function(rc) {
    ["periodDepreciation", "accumulatedDepreciation", "netBookValue"].forEach(function(field) {
      check(rc[field].status !== "MISMATCH", "enum: MISMATCH forbidden in " + field);
      check(validReconStatuses[rc[field].status], "enum: " + field + " status must be valid (got " + rc[field].status + ")");
    });
  });

  // --- Scenario 12: Empty no-assets ---
  var fixture12 = buildFixture([]);
  var r12 = rr(fixture12, "custom", "2026-01-01", "2026-06-30");
  check(r12.status === "EMPTY", "empty: EMPTY status");
  check(r12.summary.assetCount === 0, "empty asset count");
  check(r12.assets.length === 0, "empty asset rows");
  check(r12.summary.periodDepreciation === 0, "empty period depreciation");

  // --- Scenario 13: Deterministic sorting ---
  var d1 = makeAsset({ ID_Asset: "AST-Z", Nama: "Zed", Kategori: "A",
    TanggalPerolehan: "2026-01-01", BiayaPerolehan: 10000, UmurEkonomisBulan: 10 });
  var d2 = makeAsset({ ID_Asset: "AST-A", Nama: "Alpha", Kategori: "B",
    TanggalPerolehan: "2026-01-01", BiayaPerolehan: 20000, UmurEkonomisBulan: 10 });
  var d3 = makeAsset({ ID_Asset: "AST-M", Nama: "Middle", Kategori: "C",
    TanggalPerolehan: "2026-01-01", BiayaPerolehan: 30000, UmurEkonomisBulan: 10 });
  var fixture13 = buildFixture([d1, d2, d3]);
  var r13 = rr(fixture13, "custom", "2026-01-01", "2026-06-30");
  check(r13.assets.length === 3, "sorting: 3 assets");
  check(r13.assets[0].id === "AST-Z", "sorting: first asset preserves order");
  check(r13.assets[1].id === "AST-A", "sorting: second asset preserves order");
  check(r13.assets[2].id === "AST-M", "sorting: third asset preserves order");
  // Run again to verify idempotency
  var r13b = rr(fixture13, "custom", "2026-01-01", "2026-06-30");
  check(JSON.stringify(r13.assets) === JSON.stringify(r13b.assets), "sorting: deterministic across runs");

  // --- Scenario 14: Quality codes ---
  var bad1 = makeAsset({ ID_Asset: "BAD-1", BiayaPerolehan: 0, UmurEkonomisBulan: 12 });
  var bad2 = makeAsset({ ID_Asset: "BAD-2", BiayaPerolehan: -100, UmurEkonomisBulan: 12 });
  var good = makeAsset({ ID_Asset: "GOOD-1", TanggalPerolehan: "2026-01-01",
    BiayaPerolehan: 10000, UmurEkonomisBulan: 12 });
  var fixture14 = buildFixture([bad1, bad2, good]);
  var r14 = rr(fixture14, "custom", "2026-01-01", "2026-06-30");
  check(r14.quality.status === "ATTENTION", "quality: attention for invalid assets");
  check(r14.quality.issueCount >= 2, "quality: at least 2 issues for invalid assets");
  check(r14.quality.issues.length === r14.quality.issueCount, "quality: issues array matches count");
  check(typeof r14.quality.issues[0].code === "string", "quality: issue has code");
  check(typeof r14.quality.issues[0].severity === "string", "quality: issue has severity");
  check(typeof r14.quality.issues[0].domain === "string", "quality: issue has domain");
  check(r14.quality.issues[0].domain === "ASSET", "quality: invalid asset issues have ASSET domain");
  check(!r14.quality.hasOwnProperty("invalidAssets"), "quality: raw invalidAssets removed");
  check(!r14.quality.hasOwnProperty("ledgerQuality"), "quality: raw ledgerQuality removed");
  check(!r14.quality.hasOwnProperty("reconciliationFailures"), "quality: raw reconciliationFailures removed");
  check(!r14.quality.hasOwnProperty("duplicateLogicalKeys"), "quality: raw duplicateLogicalKeys removed");
  check(!r14.quality.hasOwnProperty("missingAccountCodes"), "quality: raw missingAccountCodes removed");
  // Valid asset still processed
  check(r14.assets.length === 3, "quality: all fixture assets remain visible in report");
  check(r14.assets.some(function (asset) { return asset.id === "GOOD-1"; }), "quality: valid asset ID present");

  // --- Verify 9 root keys ---
  var rootKeys = Object.keys(r1);
  check(rootKeys.length === 9, "root: exactly 9 keys (actual=" + rootKeys.length + ")");
  check(typeof r1.status === "string", "root: status present");
  check(r1.error === null, "root: error present");
  check(typeof r1.period === "object", "root: period present");
  check(typeof r1.asOfDate === "string", "root: asOfDate present");
  check(typeof r1.summary === "object", "root: summary present");
  check(Array.isArray(r1.assets), "root: assets present");
  check(typeof r1.reconciliation === "object", "root: reconciliation present");
  check(typeof r1.quality === "object", "root: quality present");
  check(typeof r1.policy === "object", "root: policy present");

  // --- Verify removed root keys are absent ---
  check(!r1.hasOwnProperty("fixedAssets"), "root: fixedAssets removed");
  check(!r1.hasOwnProperty("periodDepreciation"), "root: periodDepreciation removed");
  check(!r1.hasOwnProperty("dataQuality"), "root: dataQuality removed");
  check(!r1.hasOwnProperty("accountValidation"), "root: accountValidation removed");

  // --- Verify 11 summary keys ---
  var summaryKeys = Object.keys(r1.summary);
  check(summaryKeys.length === 11, "summary: exactly 11 keys (actual=" + summaryKeys.length + ")");
  check(typeof r1.summary.assetCount === "number", "summary: assetCount");
  check(typeof r1.summary.activeAssetCount === "number", "summary: activeAssetCount");
  check(typeof r1.summary.fullyDepreciatedAssetCount === "number", "summary: fullyDepreciatedAssetCount");
  check(typeof r1.summary.disposedAssetCount === "number", "summary: disposedAssetCount");
  check(typeof r1.summary.acquisitionCost === "number", "summary: acquisitionCost");
  check(typeof r1.summary.residualValue === "number", "summary: residualValue");
  check(typeof r1.summary.depreciableBase === "number", "summary: depreciableBase");
  check(typeof r1.summary.periodDepreciation === "number", "summary: periodDepreciation");
  check(typeof r1.summary.accumulatedDepreciation === "number", "summary: accumulatedDepreciation");
  check(typeof r1.summary.netBookValue === "number", "summary: netBookValue");
  check(typeof r1.summary.remainingDepreciableAmount === "number", "summary: remainingDepreciableAmount");

  // --- Verify 17 asset row fields ---
  check(r1.assets.length > 0, "assets: non-empty for scenario 1");
  var rowKeys = Object.keys(r1.assets[0]);
  check(rowKeys.length === 17, "asset row: exactly 17 fields (actual=" + rowKeys.length + ")");
  check(typeof r1.assets[0].id === "string", "asset row: id");
  check(typeof r1.assets[0].name === "string", "asset row: name");
  check(typeof r1.assets[0].category === "string", "asset row: category");
  check(typeof r1.assets[0].acquisitionDate === "string", "asset row: acquisitionDate");
  check(typeof r1.assets[0].cost === "number", "asset row: cost");
  check(typeof r1.assets[0].residualValue === "number", "asset row: residualValue");
  check(typeof r1.assets[0].usefulLife === "number", "asset row: usefulLife");
  check(typeof r1.assets[0].method === "string", "asset row: method");
  check(typeof r1.assets[0].disposedAt === "string" || r1.assets[0].disposedAt === null, "asset row: disposedAt");
  check(typeof r1.assets[0].accumulatedDepreciation === "number", "asset row: accumulatedDepreciation");
  check(typeof r1.assets[0].netBookValue === "number", "asset row: netBookValue");
  check(typeof r1.assets[0].periodDepreciation === "number", "asset row: periodDepreciation");
  check(typeof r1.assets[0].depreciableBase === "number", "asset row: depreciableBase");
  check(typeof r1.assets[0].elapsedLifeMonths === "number", "asset row: elapsedLifeMonths");
  check(typeof r1.assets[0].remainingLifeMonths === "number", "asset row: remainingLifeMonths");
  check(typeof r1.assets[0].fullyDepreciated === "boolean", "asset row: fullyDepreciated");
  check(r1.assets[0].latestDepreciationPeriod === null || typeof r1.assets[0].latestDepreciationPeriod === "string",
    "asset row: latestDepreciationPeriod");
  check(!r1.assets[0].hasOwnProperty("latestPeriod"), "asset row: latestPeriod removed");

  // --- Verify 3 reconciliation rows ---
  var reconKeys = Object.keys(r1.reconciliation);
  check(reconKeys.length === 3, "reconciliation: exactly 3 rows (actual=" + reconKeys.length + ")");
  check(typeof r1.reconciliation.periodDepreciation === "object", "reconciliation: periodDepreciation");
  check(typeof r1.reconciliation.accumulatedDepreciation === "object", "reconciliation: accumulatedDepreciation");
  check(typeof r1.reconciliation.netBookValue === "object", "reconciliation: netBookValue");
  check(!r1.reconciliation.hasOwnProperty("dryRunVsTarget"), "reconciliation: dryRunVsTarget removed");

  // --- Verify reconciliation row shapes: each has exactly 4 fields ---
  ["periodDepreciation", "accumulatedDepreciation", "netBookValue"].forEach(function(name) {
    var row = r1.reconciliation[name];
    var keys = Object.keys(row);
    check(keys.length === 4, "reconciliation." + name + ": exactly 4 fields (actual=" + keys.length + ")");
    check(typeof row.status === "string", "reconciliation." + name + ": has status");
    check(typeof row.reportValue === "number", "reconciliation." + name + ": has reportValue");
    check(typeof row.referenceValue === "number", "reconciliation." + name + ": has referenceValue");
    check(typeof row.difference === "number", "reconciliation." + name + ": has difference");
    check(validReconStatuses[row.status],
      "reconciliation." + name + ": status must be RECONCILED|DIFFERENCE|UNAVAILABLE (got " + row.status + ")");
    check(row.status !== "MISMATCH", "reconciliation." + name + ": MISMATCH forbidden");
  });

  // --- Verify quality structure: exactly 3 keys ---
  var qualityKeys = Object.keys(r1.quality);
  check(qualityKeys.length === 3, "quality: exactly 3 keys (actual=" + qualityKeys.length + ")");
  check(typeof r1.quality.status === "string", "quality: status key present");
  check(typeof r1.quality.issueCount === "number", "quality: issueCount key present");
  check(Array.isArray(r1.quality.issues), "quality: issues key present");
  check(!r1.quality.hasOwnProperty("invalidAssets"), "quality: invalidAssets removed from public");
  check(!r1.quality.hasOwnProperty("reconciliationFailures"), "quality: reconciliationFailures removed");
  check(!r1.quality.hasOwnProperty("duplicateLogicalKeys"), "quality: duplicateLogicalKeys removed");
  check(!r1.quality.hasOwnProperty("missingAccountCodes"), "quality: missingAccountCodes removed");
  check(!r1.quality.hasOwnProperty("ledgerQuality"), "quality: ledgerQuality removed");

  // --- Verify EMPTY status scenarios ---
  check(r5.status === "EMPTY", "EMPTY: post-asOfDate asset");
  check(r7.status === "EMPTY", "EMPTY: zero-period future asset");
  check(r12.status === "EMPTY", "EMPTY: no assets");
  check(r1.status === "AVAILABLE", "AVAILABLE: has applicable assets");

  // --- Verify asset field values for depreciableBase ---
  check(r1.assets[0].depreciableBase === r1.assets[0].cost - r1.assets[0].residualValue,
    "asset row: depreciableBase = cost - residualValue");
  check(r1.assets[0].elapsedLifeMonths >= 0, "asset row: elapsedLifeMonths >= 0");
  check(r1.assets[0].elapsedLifeMonths <= r1.assets[0].usefulLife, "asset row: elapsed capped at usefulLife");
  check(r1.assets[0].remainingLifeMonths === Math.max(r1.assets[0].usefulLife - r1.assets[0].elapsedLifeMonths, 0),
    "asset row: remainingLife = max(life - elapsed, 0)");

  // --- Verify policy structure ---
  check(r1.policy.method === "STRAIGHT_LINE", "policy method");
  check(r1.policy.granularity === "MONTHLY", "policy granularity");
  check(r1.policy.rounding === "INTEGER_RUPIAH_FINAL_TRUE_UP", "policy rounding");
  check(r1.policy.startRule === "ACQUISITION_MONTH", "policy startRule");
  check(r1.policy.residualTreatment === "PRESERVE_RESIDUAL_FLOOR", "policy residualTreatment");
  check(r1.policy.source === "DEPRECIATION_LEDGER", "policy source");
  var policyKeys = Object.keys(r1.policy);
  check(policyKeys.length === 6, "policy: exactly 6 keys (actual=" + policyKeys.length + ")");

  // --- Verify missing account codes ---
  var fixtureMissing = memorySpreadsheet({
    Assets: memorySheet([DEPRECIATION_POLICY.ASSET_HEADERS]),
    DepreciationLedger: memorySheet([DEPRECIATION_POLICY.LEDGER_HEADERS]),
    Accounts: memorySheet([["AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"],
      makeAccount("9999")])
  });
  var rMissing = rr(fixtureMissing, "custom", "2026-01-01", "2026-06-30");
  check(rMissing.quality.issueCount === 3, "missing accounts: 3 issues for 3 missing codes");
  check(rMissing.quality.issues.length === 3, "missing accounts: issues array length matches");
  check(rMissing.quality.issues.every(function(i) { return i.code === "MISSING_ACCOUNT_CODE"; }),
    "missing accounts: all issues have MISSING_ACCOUNT_CODE");

  Logger.log("PASS: testDepreciationReportContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}
