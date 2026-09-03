function testCapitalEquityMigrationContract() {
  testBalanceFoundationContracts();
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  function rejected(row, code) {
    return validateCapitalEquityRow(row).errors.indexOf(code) !== -1;
  }

  var report = buildCapitalEquityMigrationDryRun([], capitalEquityTestAccounts());
  check(report.status === "PASS" && report.readOnly === true && report.writeCount === 0,
    "read-only dry-run status");
  check(report.capitalEquityRows.length === 10 && report.openingBalanceRows.length === 1,
    "exact candidate row counts");
  check(report.totals.ownerContributions === 21270000 && report.totals.returnOfCapital === 21270000,
    "migration totals");
  check(report.totals.ownerDraws === 0 && report.totals.closingContributedCapital === 0,
    "draw and closing totals");
  check(report.byOwner.Dekker.ownerContributions === 10635000 &&
    report.byOwner.Erway.ownerContributions === 10635000, "equal contributions by owner");
  check(report.byOwner.Dekker.returnOfCapital === 10635000 &&
    report.byOwner.Erway.returnOfCapital === 10635000, "equal returns by owner");
  check(report.byOwner.Dekker.closingContributedCapital === 0 &&
    report.byOwner.Erway.closingContributedCapital === 0, "zero owner capital balances");
  check(report.capitalEquityRows.filter(function(row) {
    return row.Type === "OWNER_CONTRIBUTION" && row.Tanggal === "2021-01-01";
  }).length === 2, "opening contribution effective date");
  check(report.capitalEquityRows.filter(function(row) {
    return row.Type === "RETURN_OF_CAPITAL" && row.Tanggal === "2023-11-02" && row.Nominal === 5000000;
  }).length === 2, "2023 return rows");
  check(report.capitalEquityRows.filter(function(row) {
    return row.Type === "RETURN_OF_CAPITAL" && row.Tanggal === "2024-02-01" && row.Nominal === 135000;
  }).length === 2, "February 2024 return rows");
  check(report.capitalEquityRows.filter(function(row) {
    return row.Type === "RETURN_OF_CAPITAL" && row.Tanggal === "2024-04-01" && row.Nominal === 3000000;
  }).length === 2, "April 2024 return rows");
  check(report.capitalEquityRows.filter(function(row) {
    return row.Type === "RETURN_OF_CAPITAL" && row.Tanggal === "2024-07-01" && row.Nominal === 2500000;
  }).length === 2, "July 2024 return rows");
  check(report.capitalEquityRows.every(function(row) {
    return row.Source === "LEGACY_XLSM_MIGRATION" && row.IsActive === true;
  }), "recognized migration source and active candidates");
  check(report.capitalEquityRows.every(function(row) {
    return row.Owner === "Dekker" || row.Owner === "Erway";
  }), "canonical owners and no Hendy");
  check(report.capitalEquityRows.filter(function(row) {
    return row.Type === "OWNER_CONTRIBUTION";
  }).every(function(row) {
    return row.Keterangan.indexOf("historical payment date unavailable") !== -1;
  }), "opening-date disclosure");
  check(report.openingBalanceRows[0].AccountCode === "3200" &&
    report.openingBalanceRows[0].EffectiveDate === "2026-07-31" &&
    report.openingBalanceRows[0].Amount === 7407000, "retained earnings opening balance");
  check(report.openingBalanceRows[0].Source === "LEGACY_XLSM_MIGRATION" &&
    report.openingBalanceRows[0].IsActive === true, "opening balance authority metadata");
  check(report.accountingPolicy.profitAndLossEffect === "NONE" &&
    report.accountingPolicy.cashEffect === "NONE", "no P&L or cash effect");
  check(report.accountingPolicy.retainedEarningsLedger === "FinanceOpeningBalances" &&
    report.accountingPolicy.postCutoffProfitAndLossStarts === "2026-08-01", "opening cutoff semantics");
  check(report.capitalEquityRows.every(function(row) { return row.AccountCode !== "3200"; }),
    "retained earnings excluded from CapitalEquity");
  check(report.duplicateIds.length === 0 && report.duplicateLogicalKeys.length === 0,
    "candidate identity uniqueness");
  check(JSON.stringify(report.capitalEquityRows) ===
    JSON.stringify(buildCapitalEquityMigrationDryRun([], capitalEquityTestAccounts()).capitalEquityRows),
    "deterministic candidate IDs");
  var retained = buildRetainedEarningsBalance(report.openingBalanceRows, [
    { startDate: "2026-08-01", endDate: "2026-08-31", amount: 100000 }
  ], "2026-08-31");
  check(retained.openingAmount === 7407000 && retained.postCutoffProfitAndLoss === 100000 &&
    retained.retainedEarnings === 7507000, "opening plus post-cutoff P&L");
  var cutoffRejected = false;
  try {
    buildRetainedEarningsBalance(report.openingBalanceRows,
      [{ startDate: "2026-07-01", endDate: "2026-07-31", amount: 1 }], "2026-08-31");
  } catch (error) { cutoffRejected = error.message.indexOf("post-cutoff") !== -1; }
  check(cutoffRejected, "pre-cutoff P&L double count rejected");
  var retainedInactive = Object.assign({}, report.openingBalanceRows[0], { IsActive: false });
  check(buildRetainedEarningsBalance([retainedInactive], [], "2026-08-31").retainedEarnings === 0,
    "inactive opening balance excluded");

  var contribution = report.capitalEquityRows[0];
  check(capitalEquityAccountCode("OWNER_CONTRIBUTION") === "3000" &&
    capitalEquityAccountCode("RETURN_OF_CAPITAL") === "3100" &&
    capitalEquityAccountCode("OWNER_DRAW") === "3100", "type-to-account mapping");
  check(rejected(Object.assign({}, contribution, { Owner: "Hendy" }), "INVALID_OWNER"),
    "invalid owner rejected");
  check(rejected(Object.assign({}, contribution, { Type: "SALARY" }), "INVALID_TYPE"),
    "invalid type rejected");
  check(rejected(Object.assign({}, contribution, { Nominal: 0 }), "INVALID_NOMINAL"),
    "non-positive nominal rejected");
  check(rejected(Object.assign({}, contribution, { Tanggal: "2026-02-30" }), "INVALID_DATE"),
    "invalid date rejected");
  check(rejected(Object.assign({}, contribution, { Source: "MANUAL" }), "INVALID_SOURCE"),
    "unrecognized source rejected");

  var activity = report.capitalEquityRows.concat([
    { ID_Trx: "DRAW", Tanggal: "2024-08-01", Owner: "Dekker", Type: "OWNER_DRAW", Nominal: 50,
      Source: "LEGACY_XLSM_MIGRATION", IsActive: true },
    { ID_Trx: "INACTIVE", Tanggal: "2024-08-02", Owner: "Erway", Type: "OWNER_CONTRIBUTION", Nominal: 99,
      Source: "LEGACY_XLSM_MIGRATION", IsActive: false }
  ]);
  var scoped = buildCapitalEquitySummary(activity, { startDate: "2024-01-01", endDate: "2024-12-31" });
  check(scoped.ownerContributions === 0 && scoped.returnOfCapital === 11270000,
    "period-scoped movement summary");
  check(scoped.ownerDraws === 50 && scoped.netEquityMovement === -11270050,
    "draw remains distinct from returned capital");
  check(scoped.excludedInactiveRows === 1, "inactive rows excluded");

  var duplicateRows = [report.capitalEquityRows[0], Object.assign({}, report.capitalEquityRows[0])];
  var duplicateReport = buildCapitalEquityMigrationDryRun(duplicateRows, capitalEquityTestAccounts());
  check(duplicateReport.status === "FAIL" && duplicateReport.duplicateIds.length === 1 &&
    duplicateReport.duplicateLogicalKeys.length === 1, "existing duplicate detection");

  var readModelAtCutoff = buildCapitalEquityReadModel(report.capitalEquityRows,
    report.openingBalanceRows, capitalEquityTestAccounts(), "2026-07-31", 0);
  check(readModelAtCutoff.ownerContributions === 21270000 &&
    readModelAtCutoff.returnOfCapital === 21270000 && readModelAtCutoff.contributedCapital === 0,
    "physical-equivalent read-model reconciliation");
  check(readModelAtCutoff.owners[0].owner === "Dekker" &&
    readModelAtCutoff.owners[0].ownerContributions === 10635000 &&
    readModelAtCutoff.owners[0].returnOfCapital === 10635000 &&
    readModelAtCutoff.owners[1].owner === "Erway" &&
    readModelAtCutoff.owners[1].contributedCapital === 0, "per-owner read-model reconciliation");
  check(readModelAtCutoff.retainedEarningsOpening === 7407000 &&
    readModelAtCutoff.retainedEarningsPostCutoffProfit === 0 &&
    readModelAtCutoff.retainedEarnings === 7407000 && readModelAtCutoff.totalEquity === 7407000,
    "retained earnings and total equity at opening cutoff");
  var augustReadModel = buildCapitalEquityReadModel(report.capitalEquityRows,
    report.openingBalanceRows, capitalEquityTestAccounts(), "2026-08-31", -697100);
  check(augustReadModel.retainedEarnings === 6709900 && augustReadModel.totalEquity === 6709900 &&
    augustReadModel.dataQuality.preCutoffProfitAndLossIncluded === false,
    "August retained earnings without pre-cutoff double count");
  var preOpening = buildCapitalEquityReadModel(report.capitalEquityRows,
    report.openingBalanceRows, capitalEquityTestAccounts(), "2024-07-01", 0);
  check(preOpening.retainedEarningsStatus === "NOT_ESTABLISHED" && preOpening.retainedEarnings === null &&
    preOpening.totalEquity === null && preOpening.returnOfCapital === 21270000,
    "pre-opening retained earnings unavailable with as-of movements");
  var drawRows = report.capitalEquityRows.concat([{ ID_Trx: "DRAW-READ", Tanggal: "2026-08-15",
    Owner: "Dekker", Type: "OWNER_DRAW", Nominal: 100, Source: CAPITAL_EQUITY_POLICY.SOURCE, IsActive: true }]);
  var drawReadModel = buildCapitalEquityReadModel(drawRows, report.openingBalanceRows,
    capitalEquityTestAccounts(), "2026-08-31", -697100);
  check(drawReadModel.contributedCapital === 0 && drawReadModel.ownerDraws === 100 &&
    drawReadModel.totalEquity === 6709800, "owner draw separated from return of capital");
  var inactiveReadModel = buildCapitalEquityReadModel(report.capitalEquityRows.concat([
    { ID_Trx: "INACTIVE-READ", Tanggal: "2026-07-31", Owner: "Dekker", Type: "OWNER_CONTRIBUTION",
      Nominal: 1, Source: CAPITAL_EQUITY_POLICY.SOURCE, IsActive: false }
  ]), report.openingBalanceRows, capitalEquityTestAccounts(), "2026-07-31", 0);
  check(inactiveReadModel.ownerContributions === 21270000 &&
    inactiveReadModel.dataQuality.excludedInactiveRows === 1, "inactive read-model rows excluded");
  var missingOpeningRejected = false;
  try { buildCapitalEquityReadModel(report.capitalEquityRows, [], capitalEquityTestAccounts(), "2026-08-31", 0); }
  catch (error) { missingOpeningRejected = error.message.indexOf('"missingOpeningBalance":true') !== -1; }
  check(missingOpeningRejected, "missing active opening balance rejected when required");
  var duplicateOpeningRejected = false;
  try {
    buildCapitalEquityReadModel(report.capitalEquityRows,
      report.openingBalanceRows.concat([Object.assign({}, report.openingBalanceRows[0], { ID: "DUP" })]),
      capitalEquityTestAccounts(), "2026-08-31", 0);
  } catch (error) { duplicateOpeningRejected = error.message.indexOf("duplicateOpeningBalances") !== -1; }
  check(duplicateOpeningRejected, "duplicate active opening balance rejected");
  var invalidAuthorityRejected = false;
  try {
    buildCapitalEquityReadModel([Object.assign({}, report.capitalEquityRows[0], { Type: "BAD" })],
      report.openingBalanceRows, capitalEquityTestAccounts().filter(function(account) {
        return account.AccountCode !== "3000";
      }), "2026-08-31", 0);
  } catch (error) { invalidAuthorityRejected = error.message.indexOf("Invalid authoritative") !== -1; }
  check(invalidAuthorityRejected, "invalid type and unresolved account mapping rejected");
  var invalidOpeningRejected = false;
  try {
    buildCapitalEquityReadModel(report.capitalEquityRows,
      [Object.assign({}, report.openingBalanceRows[0], { AccountCode: "9999" })],
      capitalEquityTestAccounts(), "2026-08-31", 0);
  } catch (error) { invalidOpeningRejected = error.message.indexOf("ACCOUNT_CODE_MISMATCH") !== -1; }
  check(invalidOpeningRejected, "opening-balance account mismatch rejected");
  var financeIntegrationSource = getFinanceData.toString();
  check(financeIntegrationSource.indexOf("buildCapitalEquityReadModel") !== -1 &&
    financeIntegrationSource.indexOf("period.endDate") !== -1 &&
    financeIntegrationSource.indexOf("runCapitalEquityMigration") === -1,
    "Finance response integration is additive, as-of, and read-only");
  check(validateCapitalEquityMigrationDryRun.toString().indexOf("setValues") === -1 &&
    validateCapitalEquityMigrationDryRun.toString().indexOf("appendRow") === -1 &&
    validateCapitalEquityMigrationDryRun.toString().indexOf("setValue") === -1,
    "production diagnostic contains no spreadsheet writes");

  var otherSheet = capitalEquitySchemaTestSheet("Accounts", [["AccountCode"], ["3200"]]);
  var schemaSpreadsheet = capitalEquitySchemaTestSpreadsheet([otherSheet]);
  var flushes = 0;
  var initialized = initializeFinanceOpeningBalancesSchemaWithRuntime(schemaSpreadsheet, function() { flushes++; });
  check(initialized.status === "PASS" && initialized.created === true && initialized.dataRows === 0 &&
    initialized.writeCount === 1 && flushes === 1, "header-only schema initialization");
  check(JSON.stringify(schemaSpreadsheet.getSheetByName("FinanceOpeningBalances").values) ===
    JSON.stringify([FINANCE_OPENING_BALANCE_POLICY.HEADERS]), "exact opening-balance header");
  var rerun = initializeFinanceOpeningBalancesSchemaWithRuntime(schemaSpreadsheet, function() { flushes++; });
  check(rerun.created === false && rerun.writeCount === 0 && flushes === 1 &&
    schemaSpreadsheet.insertCount === 1, "schema initialization idempotency");
  var v2Schema = capitalEquitySchemaTestSpreadsheet([
    capitalEquitySchemaTestSheet("FinanceOpeningBalances", [BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS])
  ]);
  var v2Existing = initializeFinanceOpeningBalancesSchemaWithRuntime(v2Schema, function() {});
  check(v2Existing.created === false && v2Existing.writeCount === 0 &&
    JSON.stringify(v2Existing.headers) === JSON.stringify(BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS),
    "schema initializer accepts existing V2 without Amount");
  var incompatible = capitalEquitySchemaTestSpreadsheet([
    capitalEquitySchemaTestSheet("FinanceOpeningBalances", [["WrongHeader"]])
  ]), incompatibleRejected = false;
  try { initializeFinanceOpeningBalancesSchemaWithRuntime(incompatible, function() {}); }
  catch (error) { incompatibleRejected = true; }
  check(incompatibleRejected && incompatible.insertCount === 0, "incompatible schema rejected without write");
  var paddedHeader = FINANCE_OPENING_BALANCE_POLICY.HEADERS.slice();
  paddedHeader[0] = " ID";
  var paddedRejected = false;
  try {
    initializeFinanceOpeningBalancesSchemaWithRuntime(capitalEquitySchemaTestSpreadsheet([
      capitalEquitySchemaTestSheet("FinanceOpeningBalances", [paddedHeader])
    ]), function() {});
  } catch (error) { paddedRejected = true; }
  check(paddedRejected, "header comparison is physically exact");
  check(initializeFinanceOpeningBalancesSchema.toString().indexOf("LockService.getScriptLock()") !== -1 &&
    initializeFinanceOpeningBalancesSchema.toString().indexOf("lock.waitLock(30000)") !== -1,
    "schema initializer script lock");

  var migration = capitalEquityMigrationTestRuntime();
  var migrationResult = executeCapitalEquityMigrationWithRuntime(migration.runtime);
  check(migrationResult.status === "PASS" && migrationResult.writeCount === 11,
    "controlled migration succeeds");
  check(migration.capital.values.length === 11 && migration.opening.values.length === 2,
    "successful physical row counts");
  check(validateCapitalEquityMigrationAcceptance(
    migrationRowsToObjects(migration.capital, CAPITAL_EQUITY_POLICY.HEADERS),
    migrationRowsToObjects(migration.opening, FINANCE_OPENING_BALANCE_POLICY.HEADERS),
    capitalEquityTestAccounts()).status === "PASS", "successful physical acceptance");
  var physicalV2Opening = buildFinanceOpeningBalanceV2Candidates(
    migrationRowsToObjects(migration.opening, FINANCE_OPENING_BALANCE_POLICY.HEADERS),
    capitalEquityTestAccounts());
  check(validateCapitalEquityMigrationAcceptance(
    migrationRowsToObjects(migration.capital, CAPITAL_EQUITY_POLICY.HEADERS), physicalV2Opening,
    capitalEquityTestAccounts()).status === "PASS", "V2 physical acceptance has no Amount dependency");
  var secondRun = executeCapitalEquityMigrationWithRuntime(migration.runtime);
  check(secondRun.status === "REFUSED" && secondRun.writeCount === 0 &&
    migration.capital.values.length === 11 && migration.opening.values.length === 2,
    "second-run refusal has no duplicates");

  var populatedCapital = capitalEquityMigrationTestRuntime();
  populatedCapital.capital.values.push(new Array(CAPITAL_EQUITY_POLICY.HEADERS.length).fill("existing"));
  check(executeCapitalEquityMigrationWithRuntime(populatedCapital.runtime).status === "REFUSED" &&
    populatedCapital.writes().length === 0, "populated CapitalEquity refusal");
  var populatedOpening = capitalEquityMigrationTestRuntime();
  populatedOpening.opening.values.push(new Array(FINANCE_OPENING_BALANCE_POLICY.HEADERS.length).fill("existing"));
  check(executeCapitalEquityMigrationWithRuntime(populatedOpening.runtime).status === "REFUSED" &&
    populatedOpening.writes().length === 0, "populated FinanceOpeningBalances refusal");

  var invalidSchemaRuntime = capitalEquityMigrationTestRuntime();
  invalidSchemaRuntime.capital.values[0][0] = "Wrong";
  var invalidSchemaRefused = false;
  try { executeCapitalEquityMigrationWithRuntime(invalidSchemaRuntime.runtime); }
  catch (error) { invalidSchemaRefused = error.message.indexOf("incompatible schema") !== -1; }
  check(invalidSchemaRefused && invalidSchemaRuntime.writes().length === 0, "invalid schema refusal");

  var missingAccountRuntime = capitalEquityMigrationTestRuntime({ missingAccount: "3200" });
  var missingAccountRefused = false;
  try { executeCapitalEquityMigrationWithRuntime(missingAccountRuntime.runtime); }
  catch (error) { missingAccountRefused = error.message.indexOf("before write") !== -1; }
  check(missingAccountRefused && missingAccountRuntime.writes().length === 0, "missing account refusal");
  var duplicateCandidates = report.capitalEquityRows.concat([report.capitalEquityRows[0]]);
  check(validateCapitalEquityMigrationAcceptance(duplicateCandidates, report.openingBalanceRows,
    capitalEquityTestAccounts()).status === "FAIL", "duplicate candidate refusal");

  var firstWriteFailure = capitalEquityMigrationTestRuntime({ failSheet: "CapitalEquity" });
  var firstFailed = false;
  try { executeCapitalEquityMigrationWithRuntime(firstWriteFailure.runtime); }
  catch (error) { firstFailed = error.message.indexOf("simulated write failure") !== -1; }
  check(firstFailed && firstWriteFailure.capital.values.length === 1 &&
    firstWriteFailure.opening.values.length === 1, "simulated first-write failure restores boundaries");
  var secondWriteFailure = capitalEquityMigrationTestRuntime({ failSheet: "FinanceOpeningBalances" });
  var secondFailed = false;
  try { executeCapitalEquityMigrationWithRuntime(secondWriteFailure.runtime); }
  catch (error) { secondFailed = error.message.indexOf("simulated write failure") !== -1; }
  check(secondFailed && secondWriteFailure.capital.values.length === 1 &&
    secondWriteFailure.opening.values.length === 1, "simulated second-write failure rolls back first write");
  var acceptanceFailure = capitalEquityMigrationTestRuntime({ corruptAfterOpening: true });
  var acceptanceFailed = false;
  try { executeCapitalEquityMigrationWithRuntime(acceptanceFailure.runtime); }
  catch (error) { acceptanceFailed = error.message.indexOf("physical acceptance") !== -1; }
  check(acceptanceFailed && acceptanceFailure.capital.values.length === 1 &&
    acceptanceFailure.opening.values.length === 1, "post-write acceptance failure rolls back both writes");
  check(migrationRowsToObjects(migration.capital, CAPITAL_EQUITY_POLICY.HEADERS).every(function(row) {
    return row.Owner !== "Hendy" && row.Type !== "OWNER_DRAW";
  }), "physical Hendy and owner-draw exclusion");
  check(migration.writes().every(function(name) {
    return name === "CapitalEquity" || name === "FinanceOpeningBalances";
  }), "no unrelated sheet writes");
  check(runCapitalEquityMigration.toString().indexOf("LockService.getScriptLock()") !== -1 &&
    runCapitalEquityMigration.toString().indexOf("lock.waitLock(30000)") !== -1,
    "migration executor script lock");
  check(runBalanceFoundationSchemaMigration.toString().indexOf("LockService.getScriptLock()") !== -1 &&
    runBalanceFoundationSchemaMigration.toString().indexOf("lock.waitLock(30000)") !== -1,
    "balance schema migration executor script lock");
  check(runBalanceFoundationPartialAccountsRecovery.toString().indexOf("LockService.getScriptLock()") !== -1 &&
    runBalanceFoundationPartialAccountsRecovery.toString().indexOf("lock.waitLock(30000)") !== -1,
    "partial Accounts recovery script lock");

  Logger.log("PASS: testCapitalEquityMigrationContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function capitalEquitySchemaTestSheet(name, initialValues, writeLog, options) {
  options = options || {};
  var initial = (initialValues || []).map(function(row) { return row.slice(); });
  var initialFormulas = (options.formulas || []).map(function(row) { return row.slice(); });
  var initialColumns = initial.reduce(function(maximum, row) { return Math.max(maximum, row.length); }, 0);
  return {
    name: name, values: initial, formulas: initialFormulas,
    maxRows: options.maxRows || Math.max(initial.length, 1000),
    maxColumns: options.maxColumns || initialColumns,
    getName: function() { return this.name; },
    getLastRow: function() {
      var last = 0;
      this.values.forEach(function(row, index) {
        if (row.some(function(value) { return value !== "" && value != null; })) last = index + 1;
      });
      return last;
    },
    getLastColumn: function() {
      return this.values.reduce(function(last, row) {
        row.forEach(function(value, index) {
          if (value !== "" && value != null) last = Math.max(last, index + 1);
        });
        return last;
      }, 0);
    },
    getMaxRows: function() { return this.maxRows; },
    getMaxColumns: function() { return this.maxColumns; },
    getDataRange: function() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); },
    deleteRows: function(start, count) { this.values.splice(start - 1, count); this.maxRows -= count; },
    insertRowsAfter: function(after, count) {
      for (var index = 0; index < count; index++) this.values.splice(after, 0, []);
      this.maxRows += count;
    },
    deleteColumns: function(start, count) {
      if (writeLog) writeLog.push(this.name + ":deleteColumns:" + start + ":" + count);
      if (options.failDeleteColumns) throw new Error("simulated dimension rollback failure");
      this.values.forEach(function(row) { row.splice(start - 1, count); });
      this.formulas.forEach(function(row) { row.splice(start - 1, count); });
      this.maxColumns -= count;
    },
    insertColumnsAfter: function(after, count) {
      if (writeLog) writeLog.push(this.name + ":insertColumnsAfter:" + after + ":" + count);
      if (options.failInsertColumns) throw new Error("simulated structural mutation failure");
      this.values.forEach(function(row) {
        while (row.length < after) row.push("");
        for (var index = 0; index < count; index++) row.splice(after, 0, "");
      });
      this.formulas.forEach(function(row) {
        while (row.length < after) row.push("");
        for (var index = 0; index < count; index++) row.splice(after, 0, "");
      });
      this.maxColumns += count;
    },
    getRange: function(row, column, rowCount, columnCount) {
      var self = this;
      if (row < 1 || column < 1 || row + rowCount - 1 > self.maxRows ||
          column + columnCount - 1 > self.maxColumns) {
        throw new Error("Range exceeds sheet grid limits");
      }
      return {
        clearContent: function() {
          for (var rowIndex = row - 1; rowIndex < row - 1 + rowCount; rowIndex++) {
            if (!self.values[rowIndex]) continue;
            for (var columnIndex = column - 1; columnIndex < column - 1 + columnCount; columnIndex++) {
              self.values[rowIndex][columnIndex] = "";
            }
          }
        },
        getValues: function() {
          var result = [];
          for (var rowOffset = 0; rowOffset < rowCount; rowOffset++) {
            var source = self.values[row - 1 + rowOffset] || [], target = [];
            for (var columnOffset = 0; columnOffset < columnCount; columnOffset++) {
              var value = source[column - 1 + columnOffset];
              target.push(value === undefined ? "" : value);
            }
            result.push(target);
          }
          return result.map(function(source) {
            return source.map(function(value) {
              return value instanceof Date ? new Date(value.getTime()) : value;
            });
          });
        },
        getFormulas: function() {
          var result = [];
          for (var rowOffset = 0; rowOffset < rowCount; rowOffset++) {
            var source = self.formulas[row - 1 + rowOffset] || [], target = [];
            for (var columnOffset = 0; columnOffset < columnCount; columnOffset++) {
              target.push(source[column - 1 + columnOffset] || "");
            }
            result.push(target);
          }
          return result;
        },
        setValues: function(values) {
          if (writeLog) writeLog.push(self.name);
          if (options.failSheet === self.name && (!options.failOnce || !options.failureTriggered)) {
            options.failureTriggered = true;
            throw new Error("simulated write failure");
          }
          values.forEach(function(source, rowOffset) {
            while (self.values.length < row + rowOffset) self.values.push([]);
            source.forEach(function(value, columnOffset) {
              self.values[row - 1 + rowOffset][column - 1 + columnOffset] = value;
            });
          });
        }
      };
    }
  };
}

function capitalEquitySchemaTestSpreadsheet(initialSheets) {
  return {
    id: NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
    sheets: (initialSheets || []).slice(), insertCount: 0,
    getId: function() { return this.id; },
    getSheets: function() { return this.sheets.slice(); },
    getSheetByName: function(name) {
      return this.sheets.filter(function(sheet) { return sheet.getName() === name; })[0] || null;
    },
    insertSheet: function(name) {
      this.insertCount++;
      var sheet = capitalEquitySchemaTestSheet(name, [], null, { maxColumns: 26, maxRows: 1000 });
      this.sheets.push(sheet);
      return sheet;
    }
  };
}

function capitalEquityTestAccounts() {
  return [
    { AccountCode: "3000", AccountName: "Owner Capital", AccountType: "Equity", IsActive: true },
    { AccountCode: "3100", AccountName: "Owner Draw", AccountType: "Equity", IsActive: true },
    { AccountCode: "3200", AccountName: "Retained Earnings", AccountType: "Equity", IsActive: true }
  ];
}

function capitalEquityMigrationTestRuntime(options) {
  options = options || {};
  var writeLog = [];
  var accounts = capitalEquityTestAccounts().filter(function(account) {
    return account.AccountCode !== options.missingAccount;
  });
  var accountHeaders = ["AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"];
  var capital = capitalEquitySchemaTestSheet("CapitalEquity", [CAPITAL_EQUITY_POLICY.HEADERS], writeLog, options);
  var opening = capitalEquitySchemaTestSheet("FinanceOpeningBalances",
    [FINANCE_OPENING_BALANCE_POLICY.HEADERS], writeLog, options);
  var accountRows = [accountHeaders].concat(accounts.map(function(account) {
    return accountHeaders.map(function(header) { return account[header] === undefined ? "" : account[header]; });
  }));
  var accountSheet = capitalEquitySchemaTestSheet("Accounts", accountRows, writeLog, options);
  var spreadsheet = capitalEquitySchemaTestSpreadsheet([capital, opening, accountSheet]);
  return { capital: capital, opening: opening, writes: function() { return writeLog.slice(); },
    runtime: { spreadsheet: spreadsheet, timestamp: new Date(2026, 8, 1, 9, 0, 0), user: "admin@example.com",
      flush: function() {}, afterOpeningWrite: options.corruptAfterOpening ? function() {
        opening.values[1][3] = 1;
      } : null } };
}
