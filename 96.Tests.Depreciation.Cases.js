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
