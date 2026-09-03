var BALANCE_FOUNDATION_POLICY = Object.freeze({
  AUDIT_FIELDS: Object.freeze(["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  ACCOUNT_METADATA: Object.freeze({
    "1500": Object.freeze({ StatementGroup: "Non-current Assets", NormalBalance: "DEBIT" }),
    "1590": Object.freeze({ StatementGroup: "Contra Assets", NormalBalance: "CREDIT" }),
    "3000": Object.freeze({ StatementGroup: "Owner Equity", NormalBalance: "CREDIT", AccountName: "Owner Capital" }),
    "3100": Object.freeze({ StatementGroup: "Owner Equity", NormalBalance: "DEBIT", AccountName: "Owner Draw" }),
    "3200": Object.freeze({ StatementGroup: "Retained Earnings", NormalBalance: "CREDIT", AccountName: "Retained Earnings" }),
    "6900": Object.freeze({ StatementGroup: "Depreciation Expense", NormalBalance: "DEBIT" })
  }),
  REQUIRED_ACCOUNT_CODES: Object.freeze(["1500", "1590", "3000", "3100", "3200", "6900"]),
  OPENING_V2_HEADERS: Object.freeze(["ID", "EffectiveDate", "AccountCode", "Debit", "Credit", "Source",
    "ExternalRef", "Keterangan", "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  BALANCE_LEDGER_HEADERS: Object.freeze(["JournalID", "LineID", "Tanggal", "AccountCode", "Debit", "Credit",
    "MovementType", "SourceType", "SourceID", "ExternalRef", "Keterangan", "IsActive",
    "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  INVENTORY_LEDGER_HEADERS: Object.freeze(["ID_Movement", "Tanggal", "ItemID", "Location", "MovementType",
    "QtyIn", "QtyOut", "UnitCost", "TotalCost", "SourceType", "SourceID", "IsActive",
    "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  INVENTORY_MOVEMENT_TYPES: Object.freeze(["PURCHASE_IN", "SALE_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT",
    "TRANSFER_IN", "TRANSFER_OUT", "VALUATION_VARIANCE"]),
  HPP_AUTHORITY: "tabsal.HPP"
});

function buildBalanceAccountMetadata(accounts) {
  var source = {}, errors = [];
  (accounts || []).forEach(function(account) {
    var code = String(account && account.AccountCode || "").trim();
    if (code) source[code] = account;
  });
  var rows = BALANCE_FOUNDATION_POLICY.REQUIRED_ACCOUNT_CODES.map(function(code) {
    var account = source[code], metadata = BALANCE_FOUNDATION_POLICY.ACCOUNT_METADATA[code];
    if (!account || !isCanonicalActive(account.IsActive)) {
      errors.push({ accountCode: code, code: "INACTIVE_OR_UNRESOLVED_ACCOUNT" });
      return null;
    }
    if (metadata.AccountName && String(account.AccountName || "").trim() !== metadata.AccountName) {
      errors.push({ accountCode: code, code: "ACCOUNT_NAME_MISMATCH" });
    }
    if (String(account.StatementGroup || "").trim() !== metadata.StatementGroup) {
      errors.push({ accountCode: code, code: "STATEMENT_GROUP_MISMATCH" });
    }
    if (String(account.NormalBalance || "").trim() &&
        String(account.NormalBalance || "").trim().toUpperCase() !== metadata.NormalBalance) {
      errors.push({ accountCode: code, code: "NORMAL_BALANCE_MISMATCH" });
    }
    return Object.assign({}, account, { NormalBalance: metadata.NormalBalance });
  }).filter(function(row) { return row !== null; });
  return { status: errors.length ? "FAIL" : "PASS", rows: rows, errors: errors };
}

function financeOpeningBalanceAmount(row) {
  if (row && row.Amount !== undefined && row.Amount !== "") return Number(row.Amount);
  return Number(row && row.Credit || 0) - Number(row && row.Debit || 0);
}

function financeOpeningBalanceLogicalKey(row) {
  return capitalEquityDateKey(row && row.EffectiveDate) + "|" + String(row && row.AccountCode || "").trim();
}

function financeOpeningBalanceSideErrors(row) {
  if (!row || !Object.prototype.hasOwnProperty.call(row, "Debit") &&
      !Object.prototype.hasOwnProperty.call(row, "Credit")) return [];
  var debit = Number(row.Debit), credit = Number(row.Credit);
  if (!isFinite(debit) || !isFinite(credit) || debit < 0 || credit < 0) return ["INVALID_AMOUNT"];
  if ((debit > 0) === (credit > 0)) return [debit === 0 ? "ZERO_VALUE_OPENING" : "TWO_SIDED_OPENING"];
  return [];
}

function balanceContractMissingFields(row, headers) {
  return headers.filter(function(field) { return !Object.prototype.hasOwnProperty.call(row || {}, field); })
    .map(function(field) { return "MISSING_" + field.toUpperCase(); });
}

function validateFinanceOpeningBalanceCandidates(rows, accounts) {
  var accountMap = {}, ids = {}, keys = {}, errors = [], activeRows = [];
  (accounts || []).forEach(function(account) {
    if (isCanonicalActive(account.IsActive)) accountMap[String(account.AccountCode || "").trim()] = account;
  });
  (rows || []).forEach(function(row, index) {
    if (!isCanonicalActive(row.IsActive)) return;
    activeRows.push(row);
    var code = String(row.AccountCode || "").trim();
    var key = financeOpeningBalanceLogicalKey(row), rowErrors = [];
    rowErrors = rowErrors.concat(balanceContractMissingFields(row, BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS));
    var id = String(row.ID || "").trim();
    if (!id || ids[id]) rowErrors.push("DUPLICATE_OR_MISSING_ID");
    ids[id] = true;
    if (!capitalEquityDateKey(row.EffectiveDate)) rowErrors.push("INVALID_DATE");
    if (!accountMap[code]) rowErrors.push("INACTIVE_OR_UNRESOLVED_ACCOUNT");
    if (!String(row.Source || "").trim()) rowErrors.push("MISSING_SOURCE");
    rowErrors = rowErrors.concat(financeOpeningBalanceSideErrors(row));
    if (keys[key]) rowErrors.push("DUPLICATE_ACTIVE_DATE_ACCOUNT");
    keys[key] = true;
    if (rowErrors.length) errors.push({ row: index + 1, id: String(row.ID || ""), errors: rowErrors });
  });
  return { status: errors.length ? "FAIL" : "PASS", activeRows: activeRows,
    excludedInactiveRows: (rows || []).length - activeRows.length, errors: errors };
}

function buildFinanceOpeningBalanceV2Candidates(legacyRows, accounts) {
  var candidates = (legacyRows || []).map(function(row) {
    if (!Object.prototype.hasOwnProperty.call(row || {}, "Amount")) {
      throw new Error("FinanceOpeningBalances legacy candidate requires Amount");
    }
    var amount = Number(row.Amount);
    return { ID: String(row.ID || ""), EffectiveDate: capitalEquityDateKey(row.EffectiveDate),
      AccountCode: String(row.AccountCode || "").trim(), Debit: amount < 0 ? -amount : 0,
      Credit: amount > 0 ? amount : 0, Source: String(row.Source || "").trim(), ExternalRef: "",
      Keterangan: String(row.Keterangan || ""), IsActive: row.IsActive,
      CreatedAt: row.CreatedAt || "", CreatedBy: row.CreatedBy || "",
      UpdatedAt: row.UpdatedAt || "", UpdatedBy: row.UpdatedBy || "" };
  });
  var validation = validateFinanceOpeningBalanceCandidates(candidates, accounts);
  if (validation.status !== "PASS") throw new Error("Invalid FinanceOpeningBalances V2 candidates: " +
    JSON.stringify(validation.errors));
  return candidates;
}

var BALANCE_FOUNDATION_SCHEMA_MIGRATION = Object.freeze({
  ACCOUNTS_SHEET: "Accounts",
  ACCOUNTS_LEGACY_HEADERS: Object.freeze(["AccountCode", "AccountName", "AccountType", "StatementGroup",
    "CashFlowGroup", "IsActive", "CreatedAt", "UpdatedAt"]),
  NORMAL_BALANCE_HEADER: "NormalBalance"
});

var BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY = Object.freeze({
  ACCOUNT_CODES: Object.freeze(["1000", "1500", "1590", "3000", "3100", "3200", "4000", "5000",
    "6100", "6200", "6210", "6300", "6310", "6400", "6500", "6900"]),
  ACCOUNT_CORE: Object.freeze({
    "1000": Object.freeze(["Cash", "Asset", "Current Assets", "Operating"]),
    "1500": Object.freeze(["Fixed Assets", "Asset", "Non-current Assets", "Investing"]),
    "1590": Object.freeze(["Accumulated Depreciation", "Asset", "Contra Assets", "NonCash"]),
    "3000": Object.freeze(["Owner Capital", "Equity", "Owner Equity", "Financing"]),
    "3100": Object.freeze(["Owner Draw", "Equity", "Owner Equity", "Financing"]),
    "3200": Object.freeze(["Retained Earnings", "Equity", "Retained Earnings", "NonCash"]),
    "4000": Object.freeze(["Sales Revenue", "Revenue", "Operating Revenue", "Operating"]),
    "5000": Object.freeze(["Cost of Goods Sold", "COGS", "Cost of Goods Sold", "Operating"]),
    "6100": Object.freeze(["Salary Expense", "Expense", "Personnel Expense", "Operating"]),
    "6200": Object.freeze(["Kitchen Supplies Expense", "Expense", "Supplies Expense", "Operating"]),
    "6210": Object.freeze(["Raw Material Supplies Expense", "Expense", "Supplies Expense", "Operating"]),
    "6300": Object.freeze(["Repairs and Maintenance Expense", "Expense", "Maintenance Expense", "Operating"]),
    "6310": Object.freeze(["Equipment Upgrade Expense", "Expense", "Maintenance Expense", "Investing"]),
    "6400": Object.freeze(["Utilities and Occupancy Expense", "Expense", "Utilities Expense", "Operating"]),
    "6500": Object.freeze(["Event Expense", "Expense", "Event Expense", "Operating"]),
    "6900": Object.freeze(["Depreciation Expense", "Expense", "Depreciation Expense", "NonCash"])
  }),
  OPENING_ID: "FOB-3200-20260731",
  OPENING_DESCRIPTION: "Migrated retained earnings opening balance through 2026-07-31; post-cutoff P&L starts 2026-08-01.",
  OPENING_USER: "dekker.log@gmail.com"
});

var BALANCE_FOUNDATION_OPENING_WIDTH_RECOVERY = Object.freeze({
  RESIDUAL_START_COLUMN: 12,
  RESIDUAL_COLUMN_COUNT: 15,
  RESIDUAL_PHYSICAL_WIDTH: 26,
  LEGACY_PHYSICAL_WIDTH: 11
});

function balanceFoundationSheetSnapshot(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
}

function balanceFoundationPhysicalSnapshot(sheet) {
  return { values: balanceFoundationSheetSnapshot(sheet), maxRows: sheet.getMaxRows(),
    maxColumns: sheet.getMaxColumns() };
}

function balanceFoundationRowsFromValues(values) {
  var headers = (values[0] || []).map(function(value) { return String(value); });
  return values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== "" && value != null; });
  }).map(function(row) {
    var record = {};
    headers.forEach(function(header, index) { record[header] = row[index]; });
    return record;
  });
}

function balanceFoundationReplaceSheetValues(sheet, values) {
  sheet.getDataRange().clearContent();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
}

function balanceFoundationExpandSheetColumns(sheet, targetColumns) {
  var currentColumns = sheet.getMaxColumns();
  if (currentColumns > targetColumns) throw new Error("Unexpected physical sheet width before migration write");
  if (currentColumns < targetColumns) sheet.insertColumnsAfter(currentColumns, targetColumns - currentColumns);
}

function balanceFoundationWriteMigrationCandidate(sheet, values, afterStructure) {
  balanceFoundationExpandSheetColumns(sheet, values[0].length);
  if (afterStructure) afterStructure();
  balanceFoundationReplaceSheetValues(sheet, values);
}

function balanceFoundationRestoreGridDimensions(sheet, dimensions) {
  var currentColumns = sheet.getMaxColumns(), currentRows = sheet.getMaxRows();
  if (currentColumns > dimensions.maxColumns) {
    sheet.deleteColumns(dimensions.maxColumns + 1, currentColumns - dimensions.maxColumns);
  } else if (currentColumns < dimensions.maxColumns) {
    sheet.insertColumnsAfter(currentColumns, dimensions.maxColumns - currentColumns);
  }
  if (currentRows > dimensions.maxRows) {
    sheet.deleteRows(dimensions.maxRows + 1, currentRows - dimensions.maxRows);
  } else if (currentRows < dimensions.maxRows) {
    sheet.insertRowsAfter(currentRows, dimensions.maxRows - currentRows);
  }
}

function balanceFoundationPhysicalStateMatches(sheet, expected) {
  return sheet.getMaxRows() === expected.maxRows && sheet.getMaxColumns() === expected.maxColumns &&
    JSON.stringify(balanceFoundationSheetSnapshot(sheet)) === JSON.stringify(expected.values);
}

function buildBalanceFoundationSchemaMigrationCandidate(accountsValues, openingValues) {
  var accounts = balanceFoundationRowsFromValues(accountsValues);
  var taxonomy = buildBalanceAccountMetadata(accounts);
  if (taxonomy.status !== "PASS") throw new Error("Accounts taxonomy migration candidate invalid");
  var normalBalances = {};
  taxonomy.rows.forEach(function(row) { normalBalances[row.AccountCode] = row.NormalBalance; });
  var migratedAccounts = accountsValues.map(function(row, index) {
    if (index === 0) return row.concat([BALANCE_FOUNDATION_SCHEMA_MIGRATION.NORMAL_BALANCE_HEADER]);
    return row.concat([normalBalances[String(row[0] || "").trim()] || ""]);
  });
  var openingRows = balanceFoundationRowsFromValues(openingValues);
  var retainedOpening = openingRows[0] || {};
  if (openingRows.length !== 1 || String(retainedOpening.ID || "").trim() !== "FOB-3200-20260731" ||
      capitalEquityDateKey(retainedOpening.EffectiveDate) !== FINANCE_OPENING_BALANCE_POLICY.EFFECTIVE_DATE ||
      String(retainedOpening.AccountCode || "").trim() !== FINANCE_OPENING_BALANCE_POLICY.RETAINED_EARNINGS_ACCOUNT ||
      financeOpeningBalanceAmount(retainedOpening) !== FINANCE_OPENING_BALANCE_POLICY.AMOUNT ||
      String(retainedOpening.Source || "").trim() !== CAPITAL_EQUITY_POLICY.SOURCE ||
      !isCanonicalActive(retainedOpening.IsActive)) {
    throw new Error("FinanceOpeningBalances legacy migration candidate invalid");
  }
  var openingV2 = buildFinanceOpeningBalanceV2Candidates(openingRows, accounts);
  var migratedOpening = [BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.slice()].concat(openingV2.map(function(row) {
    return BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.map(function(header) {
      return row[header] === undefined ? "" : row[header];
    });
  }));
  return { accounts: migratedAccounts, opening: migratedOpening };
}

function balanceFoundationMigrationValueMatches(field, expected, actual) {
  if (field === "EffectiveDate") return capitalEquityDateKey(actual) === capitalEquityDateKey(expected);
  if (field === "AccountCode") {
    if (expected == null || actual == null || expected === "" || actual === "") return false;
    return String(actual) === String(expected);
  }
  if (expected instanceof Date || actual instanceof Date) {
    return expected instanceof Date && actual instanceof Date && !isNaN(expected.getTime()) &&
      !isNaN(actual.getTime()) && expected.getTime() === actual.getTime();
  }
  return actual === expected;
}

function balanceFoundationDiagnosticValue(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  if (value === undefined) return "<undefined>";
  if (value === null) return null;
  return value;
}

function balanceFoundationDiagnosticType(value) {
  if (value instanceof Date) return "Date";
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return typeof value;
}

function balanceFoundationAcceptanceMismatch(sheet, row, column, property, expected, actual, rule) {
  return { sheet: sheet, row: row, column: column, property: property,
    expectedType: balanceFoundationDiagnosticType(expected),
    expectedValue: balanceFoundationDiagnosticValue(expected),
    actualType: balanceFoundationDiagnosticType(actual),
    actualValue: balanceFoundationDiagnosticValue(actual), comparisonRule: rule };
}

function balanceFoundationFirstRecordMismatch(sheet, expectedRows, actualRows, fields, physicalHeaders) {
  if (expectedRows.length !== actualRows.length) {
    return balanceFoundationAcceptanceMismatch(sheet, 0, 0, "rowCount", expectedRows.length,
      actualRows.length, "EXACT_ROW_COUNT");
  }
  for (var rowIndex = 0; rowIndex < expectedRows.length; rowIndex++) {
    for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
      var field = fields[fieldIndex], expected = expectedRows[rowIndex][field], actual = actualRows[rowIndex][field];
      if (!balanceFoundationMigrationValueMatches(field, expected, actual)) {
        return balanceFoundationAcceptanceMismatch(sheet, rowIndex + 2, physicalHeaders.indexOf(field) + 1, field,
          expected, actual, field === "EffectiveDate" ? "DATE_KEY" :
            (expected instanceof Date || actual instanceof Date ? "DATE_TIMESTAMP" : "STRICT_VALUE"));
      }
    }
  }
  return null;
}

function balanceFoundationFirstMatrixMismatch(sheet, expected, actual) {
  if (expected.length !== actual.length) {
    return balanceFoundationAcceptanceMismatch(sheet, 0, 0, "rowCount", expected.length, actual.length,
      "EXACT_MATRIX_ROW_COUNT");
  }
  for (var rowIndex = 0; rowIndex < expected.length; rowIndex++) {
    if (expected[rowIndex].length !== actual[rowIndex].length) {
      return balanceFoundationAcceptanceMismatch(sheet, rowIndex + 1, 0, "columnCount",
        expected[rowIndex].length, actual[rowIndex].length, "EXACT_MATRIX_COLUMN_COUNT");
    }
    for (var columnIndex = 0; columnIndex < expected[rowIndex].length; columnIndex++) {
      if (JSON.stringify(expected[rowIndex][columnIndex]) !== JSON.stringify(actual[rowIndex][columnIndex])) {
        return balanceFoundationAcceptanceMismatch(sheet, rowIndex + 1, columnIndex + 1,
          rowIndex ? String(expected[0][columnIndex] || "column" + (columnIndex + 1)) : "header",
          expected[rowIndex][columnIndex], actual[rowIndex][columnIndex], "JSON_VALUE_IDENTITY");
      }
    }
  }
  return null;
}

function validateBalanceFoundationSchemaMigrationAcceptance(original, candidate, physical) {
  var originalAccounts = balanceFoundationRowsFromValues(original.accounts);
  var physicalAccounts = balanceFoundationRowsFromValues(physical.accounts);
  var originalOpening = balanceFoundationRowsFromValues(original.opening);
  var physicalOpening = balanceFoundationRowsFromValues(physical.opening);
  var accountFields = BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_LEGACY_HEADERS;
  var accountsPreserved = originalAccounts.length === physicalAccounts.length && originalAccounts.every(function(row, index) {
    return accountFields.every(function(field) {
      return balanceFoundationMigrationValueMatches(field, row[field], physicalAccounts[index][field]);
    });
  });
  var taxonomy = buildBalanceAccountMetadata(physicalAccounts);
  var openingPreserved = originalOpening.length === physicalOpening.length && originalOpening.every(function(row, index) {
    return ["ID", "EffectiveDate", "AccountCode", "Source", "Keterangan", "IsActive",
      "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"].every(function(field) {
      return balanceFoundationMigrationValueMatches(field, row[field], physicalOpening[index][field]);
    });
  });
  var openingValid = validateFinanceOpeningBalanceCandidates(physicalOpening, physicalAccounts).status === "PASS";
  var candidateOpening = balanceFoundationRowsFromValues(candidate.opening);
  var exactOpening = candidateOpening.length === physicalOpening.length && candidateOpening.every(function(row, index) {
    return BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.every(function(field) {
      return balanceFoundationMigrationValueMatches(field, row[field], physicalOpening[index][field]);
    });
  });
  var exactCandidate = JSON.stringify(candidate.accounts) === JSON.stringify(physical.accounts) && exactOpening;
  var firstMismatch = null;
  if (!accountsPreserved) firstMismatch = balanceFoundationFirstRecordMismatch("Accounts", originalAccounts,
    physicalAccounts, accountFields, physical.accounts[0] || []);
  if (!firstMismatch && taxonomy.status !== "PASS") {
    firstMismatch = balanceFoundationAcceptanceMismatch("Accounts", 0, 0, "taxonomyStatus", "PASS",
      taxonomy.status, "ACCOUNT_TAXONOMY_VALIDATION");
  }
  if (!firstMismatch && !openingPreserved) firstMismatch = balanceFoundationFirstRecordMismatch(
    "FinanceOpeningBalances", originalOpening, physicalOpening,
    ["ID", "EffectiveDate", "AccountCode", "Source", "Keterangan", "IsActive",
      "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"], physical.opening[0] || []);
  if (!firstMismatch && !openingValid) {
    firstMismatch = balanceFoundationFirstRecordMismatch("FinanceOpeningBalances", candidateOpening,
      physicalOpening, BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS, physical.opening[0] || []) ||
      balanceFoundationAcceptanceMismatch("FinanceOpeningBalances", 0, 0, "openingValidationStatus", "PASS",
        "FAIL", "OPENING_BALANCE_VALIDATION");
  }
  if (!firstMismatch && JSON.stringify(candidate.accounts) !== JSON.stringify(physical.accounts)) {
    firstMismatch = balanceFoundationFirstMatrixMismatch("Accounts", candidate.accounts, physical.accounts);
  }
  if (!firstMismatch && !exactOpening) firstMismatch = balanceFoundationFirstRecordMismatch(
    "FinanceOpeningBalances", candidateOpening, physicalOpening, BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS,
    physical.opening[0] || []);
  return { status: accountsPreserved && taxonomy.status === "PASS" && openingPreserved && openingValid &&
      exactCandidate ? "PASS" : "FAIL", accountsPreserved: accountsPreserved,
    taxonomyValid: taxonomy.status === "PASS", openingPreserved: openingPreserved, openingValid: openingValid,
    firstMismatch: firstMismatch };
}

function rollbackBalanceFoundationSchemaMigration(state, flush) {
  var failures = [];
  [{ sheet: state.accountsSheet, snapshot: state.original.accounts, name: "Accounts" },
    { sheet: state.openingSheet, snapshot: state.original.opening, name: "FinanceOpeningBalances" }]
    .forEach(function(target) {
      try {
        balanceFoundationReplaceSheetValues(target.sheet, target.snapshot.values);
        balanceFoundationRestoreGridDimensions(target.sheet, target.snapshot);
      }
      catch (error) { failures.push(target.name + ": " + error.message); }
    });
  try { flush(); } catch (error) { failures.push("flush: " + error.message); }
  if (!balanceFoundationPhysicalStateMatches(state.accountsSheet, state.original.accounts) ||
      !balanceFoundationPhysicalStateMatches(state.openingSheet, state.original.opening)) {
    failures.push("exact restoration verification failed");
  }
  if (failures.length) throw new Error("HARD FAILURE — schema migration rollback failed: " + failures.join("; "));
}

function balanceFoundationMigrationFailure(originalError, rollbackError) {
  if (rollbackError) {
    return new Error("HARD FAILURE — original migration error: " + originalError.message +
      "; rollback/restoration error: " + rollbackError.message);
  }
  originalError.message += " | rollback: SUCCESS";
  return originalError;
}

function executeBalanceFoundationSchemaMigrationWithRuntime(runtime) {
  var ss = runtime.spreadsheet;
  var accountsSheet = ss.getSheetByName(BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_SHEET);
  var openingSheet = ss.getSheetByName(FINANCE_OPENING_BALANCE_POLICY.SHEET);
  var originalPhysical = { accounts: balanceFoundationPhysicalSnapshot(accountsSheet),
    opening: balanceFoundationPhysicalSnapshot(openingSheet) };
  var original = { accounts: originalPhysical.accounts.values, opening: originalPhysical.opening.values };
  var accountHeaders = original.accounts[0] || [], openingHeaders = original.opening[0] || [];
  var legacyAccounts = JSON.stringify(accountHeaders) ===
    JSON.stringify(BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_LEGACY_HEADERS);
  var v2Accounts = JSON.stringify(accountHeaders) === JSON.stringify(
    BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_LEGACY_HEADERS.concat([
      BALANCE_FOUNDATION_SCHEMA_MIGRATION.NORMAL_BALANCE_HEADER]));
  var legacyOpening = JSON.stringify(openingHeaders) === JSON.stringify(FINANCE_OPENING_BALANCE_POLICY.HEADERS);
  var v2Opening = JSON.stringify(openingHeaders) === JSON.stringify(BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS);
  var exactLegacyDimensions = accountsSheet.getMaxColumns() ===
      BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_LEGACY_HEADERS.length &&
    openingSheet.getMaxColumns() === FINANCE_OPENING_BALANCE_POLICY.HEADERS.length;
  var exactV2Dimensions = accountsSheet.getMaxColumns() ===
      BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_LEGACY_HEADERS.length + 1 &&
    openingSheet.getMaxColumns() === BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.length;
  if (v2Accounts && v2Opening) {
    if (!exactV2Dimensions) return { status: "REFUSED", reason: "UNEXPECTED_V2_DIMENSIONS", writeCount: 0 };
    var existingAcceptance;
    try {
      var expectedExisting = buildBalanceFoundationSchemaMigrationCandidate(
        original.accounts.map(function(row) { return row.slice(0, row.length - 1); }),
        [FINANCE_OPENING_BALANCE_POLICY.HEADERS.slice()].concat(
          balanceFoundationRowsFromValues(original.opening).map(function(row) {
            var legacy = { ID: row.ID, EffectiveDate: row.EffectiveDate, AccountCode: row.AccountCode,
              Amount: financeOpeningBalanceAmount(row), Source: row.Source, Keterangan: row.Keterangan,
              IsActive: row.IsActive, CreatedAt: row.CreatedAt, CreatedBy: row.CreatedBy,
              UpdatedAt: row.UpdatedAt, UpdatedBy: row.UpdatedBy };
            return FINANCE_OPENING_BALANCE_POLICY.HEADERS.map(function(header) { return legacy[header]; });
          })));
      existingAcceptance = validateBalanceFoundationSchemaMigrationAcceptance(
        { accounts: original.accounts.map(function(row) { return row.slice(0, row.length - 1); }),
          opening: [FINANCE_OPENING_BALANCE_POLICY.HEADERS.slice()].concat(
            balanceFoundationRowsFromValues(original.opening).map(function(row) {
              return FINANCE_OPENING_BALANCE_POLICY.HEADERS.map(function(header) {
                return header === "Amount" ? financeOpeningBalanceAmount(row) : row[header];
              });
            })) }, expectedExisting, original);
    } catch (error) { existingAcceptance = { status: "FAIL" }; }
    return existingAcceptance.status === "PASS" ?
      { status: "ALREADY_MIGRATED", writeCount: 0 } :
      { status: "REFUSED", reason: "UNEXPECTED_V2_STATE", writeCount: 0 };
  }
  if (!legacyAccounts || !legacyOpening || !exactLegacyDimensions) {
    return { status: "REFUSED", reason: "MIXED_OR_UNEXPECTED_STATE", writeCount: 0 };
  }
  var candidate;
  try { candidate = buildBalanceFoundationSchemaMigrationCandidate(original.accounts, original.opening); }
  catch (error) { return { status: "REFUSED", reason: "INVALID_FRESH_STATE", writeCount: 0 }; }
  var state = { accountsSheet: accountsSheet, openingSheet: openingSheet, original: originalPhysical };
  try {
    balanceFoundationWriteMigrationCandidate(accountsSheet, candidate.accounts, runtime.afterAccountsStructure);
    if (runtime.afterAccountsWrite) runtime.afterAccountsWrite();
    balanceFoundationWriteMigrationCandidate(openingSheet, candidate.opening, runtime.afterOpeningStructure);
    if (runtime.afterOpeningWrite) runtime.afterOpeningWrite();
    runtime.flush();
    if (runtime.afterFlush) runtime.afterFlush();
    var physical = { accounts: balanceFoundationSheetSnapshot(accountsSheet),
      opening: balanceFoundationSheetSnapshot(openingSheet) };
    var acceptance = validateBalanceFoundationSchemaMigrationAcceptance(original, candidate, physical);
    if (acceptance.status !== "PASS") throw new Error("Balance foundation schema physical acceptance failed | firstMismatch=" +
      JSON.stringify(acceptance.firstMismatch));
    return { status: "PASS", writeCount: 2, accountsRows: candidate.accounts.length - 1,
      openingBalanceRows: candidate.opening.length - 1, physicalAcceptance: acceptance };
  } catch (error) {
    var rollbackError = null;
    try { rollbackBalanceFoundationSchemaMigration(state, runtime.flush); }
    catch (failure) { rollbackError = failure; }
    throw balanceFoundationMigrationFailure(error, rollbackError);
  }
}

function balanceFoundationRecoveryOpeningIsExact(values) {
  var headers = values[0] || [], rows = balanceFoundationRowsFromValues(values), row = rows[0] || {};
  return JSON.stringify(headers) === JSON.stringify(FINANCE_OPENING_BALANCE_POLICY.HEADERS) && rows.length === 1 &&
    String(row.ID || "") === BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_ID &&
    capitalEquityDateKey(row.EffectiveDate) === FINANCE_OPENING_BALANCE_POLICY.EFFECTIVE_DATE &&
    String(row.AccountCode || "").trim() === FINANCE_OPENING_BALANCE_POLICY.RETAINED_EARNINGS_ACCOUNT &&
    Number(row.Amount) === FINANCE_OPENING_BALANCE_POLICY.AMOUNT &&
    String(row.Source || "") === CAPITAL_EQUITY_POLICY.SOURCE &&
    String(row.Keterangan || "") === BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_DESCRIPTION &&
    isCanonicalActive(row.IsActive) && String(row.CreatedBy || "") === BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER &&
    String(row.UpdatedBy || "") === BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER &&
    balanceFoundationAuditDateKey(row.CreatedAt) === "2026-09-01" &&
    balanceFoundationAuditDateKey(row.UpdatedAt) === "2026-09-01";
}

function balanceFoundationAuditDateKey(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return canonicalDateKey(value);
  var match = String(value == null ? "" : value).trim().match(/^(\d{4}-\d{2}-\d{2})(?:\s|$)/);
  return match ? match[1] : null;
}

function balanceFoundationRecoveryAccountsAreExact(values) {
  var headers = values[0] || [], rows = balanceFoundationRowsFromValues(values), seen = {};
  if (JSON.stringify(headers) !== JSON.stringify(BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_LEGACY_HEADERS) ||
      rows.length !== 16) return false;
  if (rows.some(function(row) {
    var code = String(row.AccountCode || "").trim();
    var expected = BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE[code];
    if (!isCanonicalActive(row.IsActive) || !code || seen[code] ||
        balanceFoundationAuditDateKey(row.CreatedAt) !== "2026-08-13" ||
        balanceFoundationAuditDateKey(row.UpdatedAt) !== "2026-08-13") return true;
    seen[code] = true;
    return !expected || JSON.stringify([String(row.AccountName || ""), String(row.AccountType || ""),
      String(row.StatementGroup || ""), String(row.CashFlowGroup || "")]) !== JSON.stringify(expected);
  })) return false;
  if (JSON.stringify(Object.keys(seen).sort()) !== JSON.stringify(
      BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CODES.slice().sort())) return false;
  return buildBalanceAccountMetadata(rows).status === "PASS";
}

function balanceFoundationColumnIsBlank(sheet, column) {
  return sheet.getRange(1, column, sheet.getMaxRows(), 1).getValues().every(function(row) {
    return row[0] === "" || row[0] == null;
  });
}

function balanceFoundationOpeningResidualIsBlank(sheet) {
  var policy = BALANCE_FOUNDATION_OPENING_WIDTH_RECOVERY;
  var range = sheet.getRange(1, policy.RESIDUAL_START_COLUMN, sheet.getMaxRows(),
    policy.RESIDUAL_COLUMN_COUNT);
  var values = range.getValues();
  var formulas = range.getFormulas();
  return values.every(function(row) {
    return row.every(function(value) { return value === "" || value == null; });
  }) && formulas.every(function(row) {
    return row.every(function(formula) { return formula === "" || formula == null; });
  });
}

function executeBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime(runtime) {
  var ss = runtime.spreadsheet;
  var openingSheet = ss && ss.getSheetByName(FINANCE_OPENING_BALANCE_POLICY.SHEET);
  var openingValues = balanceFoundationSheetSnapshot(openingSheet);
  if (openingSheet && openingSheet.getMaxColumns() ===
      BALANCE_FOUNDATION_OPENING_WIDTH_RECOVERY.LEGACY_PHYSICAL_WIDTH &&
      balanceFoundationRecoveryOpeningIsExact(openingValues)) {
    return { status: "ALREADY_RECOVERED", writeCount: 0 };
  }
  if (!openingSheet || openingSheet.getMaxColumns() !==
      BALANCE_FOUNDATION_OPENING_WIDTH_RECOVERY.RESIDUAL_PHYSICAL_WIDTH ||
      !balanceFoundationRecoveryOpeningIsExact(openingValues) ||
      !balanceFoundationOpeningResidualIsBlank(openingSheet)) {
    return { status: "REFUSED", reason: "UNEXPECTED_OPENING_WIDTH_RECOVERY_STATE", writeCount: 0 };
  }
  var original = balanceFoundationPhysicalSnapshot(openingSheet);
  try {
    openingSheet.deleteColumns(BALANCE_FOUNDATION_OPENING_WIDTH_RECOVERY.RESIDUAL_START_COLUMN,
      BALANCE_FOUNDATION_OPENING_WIDTH_RECOVERY.RESIDUAL_COLUMN_COUNT);
    if (runtime.afterDelete) runtime.afterDelete();
    runtime.flush();
    var freshSpreadsheet = runtime.freshSpreadsheet();
    var freshSheet = freshSpreadsheet && freshSpreadsheet.getSheetByName(FINANCE_OPENING_BALANCE_POLICY.SHEET);
    if (!freshSheet || freshSheet.getMaxColumns() !==
        BALANCE_FOUNDATION_OPENING_WIDTH_RECOVERY.LEGACY_PHYSICAL_WIDTH ||
        !balanceFoundationRecoveryOpeningIsExact(balanceFoundationSheetSnapshot(freshSheet)) ||
        JSON.stringify(balanceFoundationSheetSnapshot(freshSheet)) !== JSON.stringify(original.values)) {
      throw new Error("FinanceOpeningBalances width recovery physical acceptance failed");
    }
    return { status: "PASS", writeCount: 1 };
  } catch (error) {
    var rollbackError = null;
    try {
      balanceFoundationRestoreGridDimensions(openingSheet, original);
      runtime.flush();
      var restoredSpreadsheet = runtime.freshSpreadsheet();
      var restoredSheet = restoredSpreadsheet &&
        restoredSpreadsheet.getSheetByName(FINANCE_OPENING_BALANCE_POLICY.SHEET);
      if (!restoredSheet || !balanceFoundationPhysicalStateMatches(restoredSheet, original)) {
        throw new Error("exact restoration verification failed");
      }
    } catch (failure) { rollbackError = failure; }
    if (rollbackError) {
      throw new Error("HARD FAILURE — original width recovery error: " + error.message +
        "; rollback/restoration error: " + rollbackError.message);
    }
    error.message += " | rollback: SUCCESS";
    throw error;
  }
}

function runBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime(runtime) {
  var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
  if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
  return executeBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime({
    spreadsheet: spreadsheet,
    flush: runtime.flush,
    freshSpreadsheet: function() {
      return resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
    },
    afterDelete: runtime.afterDelete
  });
}

function runBalanceFoundationFinanceOpeningBalancesWidthRecovery() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var result = runBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime({
      storage: { openById: function(id) { return SpreadsheetApp.openById(id); } },
      flush: function() { SpreadsheetApp.flush(); }
    });
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function executeBalanceFoundationPartialAccountsRecoveryWithRuntime(runtime) {
  var ss = runtime.spreadsheet;
  var accountsSheet = ss.getSheetByName(BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_SHEET);
  var openingSheet = ss.getSheetByName(FINANCE_OPENING_BALANCE_POLICY.SHEET);
  var accountsValues = balanceFoundationSheetSnapshot(accountsSheet);
  var openingValues = balanceFoundationSheetSnapshot(openingSheet);
  var validLogicalState = balanceFoundationRecoveryAccountsAreExact(accountsValues) &&
    balanceFoundationRecoveryOpeningIsExact(openingValues);
  if (validLogicalState && accountsSheet.getMaxColumns() === 8) {
    return { status: "ALREADY_RECOVERED", writeCount: 0 };
  }
  if (!validLogicalState || accountsSheet.getMaxColumns() !== 9 ||
      !balanceFoundationColumnIsBlank(accountsSheet, 9)) {
    return { status: "REFUSED", reason: "UNEXPECTED_RECOVERY_STATE", writeCount: 0 };
  }
  var originalAccounts = JSON.stringify(accountsValues), originalOpening = JSON.stringify(openingValues);
  accountsSheet.deleteColumns(9, 1);
  runtime.flush();
  if (accountsSheet.getMaxColumns() !== 8 ||
      JSON.stringify(balanceFoundationSheetSnapshot(accountsSheet)) !== originalAccounts ||
      JSON.stringify(balanceFoundationSheetSnapshot(openingSheet)) !== originalOpening) {
    throw new Error("HARD FAILURE — partial Accounts recovery physical acceptance failed");
  }
  return { status: "PASS", writeCount: 1 };
}

function runBalanceFoundationPartialAccountsRecoveryWithRuntime(runtime) {
  var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
  if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
  return executeBalanceFoundationPartialAccountsRecoveryWithRuntime({
    spreadsheet: spreadsheet, flush: runtime.flush
  });
}

function runBalanceFoundationPartialAccountsRecovery() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var result = runBalanceFoundationPartialAccountsRecoveryWithRuntime({
      storage: { openById: function(id) { return SpreadsheetApp.openById(id); } },
      flush: function() { SpreadsheetApp.flush(); }
    });
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function runBalanceFoundationSchemaMigrationWithRuntime(runtime) {
  var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
  if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
  return executeBalanceFoundationSchemaMigrationWithRuntime({
    spreadsheet: spreadsheet, flush: runtime.flush
  });
}

function runBalanceFoundationSchemaMigration() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var result = runBalanceFoundationSchemaMigrationWithRuntime({
      storage: { openById: function(id) { return SpreadsheetApp.openById(id); } },
      flush: function() { SpreadsheetApp.flush(); }
    });
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function balanceFoundationRequireDisposableSpreadsheetId(spreadsheetId) {
  var id = String(spreadsheetId || "").trim();
  if (!id || id === NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) {
    throw new Error("Disposable Balance Foundation runtime refuses production or missing spreadsheet identity");
  }
  return id;
}

function balanceFoundationDisposableLegacyValues() {
  var accountHeaders = BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_LEGACY_HEADERS.slice();
  var accountAudit = new Date(2026, 7, 13, 5, 0, 0);
  var accountRows = BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CODES.map(function(code) {
    var core = BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE[code];
    return [code, core[0], core[1], core[2], core[3], true,
      new Date(accountAudit.getTime()), new Date(accountAudit.getTime())];
  });
  var openingAudit = new Date(2026, 8, 1, 15, 40, 15);
  var openingRow = {
    ID: BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_ID,
    EffectiveDate: new Date(2026, 6, 31),
    AccountCode: FINANCE_OPENING_BALANCE_POLICY.RETAINED_EARNINGS_ACCOUNT,
    Amount: FINANCE_OPENING_BALANCE_POLICY.AMOUNT,
    Source: CAPITAL_EQUITY_POLICY.SOURCE,
    Keterangan: BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_DESCRIPTION,
    IsActive: true,
    CreatedAt: new Date(openingAudit.getTime()),
    CreatedBy: BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER,
    UpdatedAt: new Date(openingAudit.getTime()),
    UpdatedBy: BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER
  };
  return {
    accounts: [accountHeaders].concat(accountRows),
    opening: [FINANCE_OPENING_BALANCE_POLICY.HEADERS.slice()].concat([
      FINANCE_OPENING_BALANCE_POLICY.HEADERS.map(function(header) { return openingRow[header]; })
    ])
  };
}

function balanceFoundationResizeDisposableSheet(sheet, rowCount, columnCount) {
  var currentRows = sheet.getMaxRows(), currentColumns = sheet.getMaxColumns();
  if (currentRows > rowCount) sheet.deleteRows(rowCount + 1, currentRows - rowCount);
  else if (currentRows < rowCount) sheet.insertRowsAfter(currentRows, rowCount - currentRows);
  if (currentColumns > columnCount) sheet.deleteColumns(columnCount + 1, currentColumns - columnCount);
  else if (currentColumns < columnCount) {
    sheet.insertColumnsAfter(currentColumns, columnCount - currentColumns);
  }
}

function balanceFoundationCreateDisposableLegacySpreadsheetWithRuntime(name, runtime) {
  var fixture = balanceFoundationDisposableLegacyValues();
  var spreadsheet = runtime.spreadsheetApp.create(name, 1000,
    BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_LEGACY_HEADERS.length);
  balanceFoundationRequireDisposableSpreadsheetId(spreadsheet.getId());
  var accounts = spreadsheet.getSheets()[0];
  accounts.setName(BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_SHEET);
  balanceFoundationResizeDisposableSheet(accounts, fixture.accounts.length, fixture.accounts[0].length);
  accounts.getRange(1, 1, fixture.accounts.length, fixture.accounts[0].length).setValues(fixture.accounts);
  var opening = spreadsheet.insertSheet(FINANCE_OPENING_BALANCE_POLICY.SHEET);
  balanceFoundationResizeDisposableSheet(opening, fixture.opening.length, fixture.opening[0].length);
  opening.getRange(1, 1, fixture.opening.length, fixture.opening[0].length).setValues(fixture.opening);
  runtime.spreadsheetApp.flush();
  return spreadsheet.getId();
}

function balanceFoundationCreateDisposableLegacySpreadsheet(name) {
  return balanceFoundationCreateDisposableLegacySpreadsheetWithRuntime(name, {
    spreadsheetApp: SpreadsheetApp
  });
}

function balanceFoundationRuntimeProofRequire(condition, message) {
  if (!condition) throw new Error("Disposable Balance Foundation runtime proof failed: " + message);
}

function runBalanceFoundationDisposableRuntimeProof() {
  var disposableIds = [], result = null, failure = null, cleanup = "DELETED";
  try {
    var migratedId = balanceFoundationCreateDisposableLegacySpreadsheet(
      "NUMLOCK Balance Foundation Disposable Migration " + new Date().getTime());
    disposableIds.push(migratedId);
    var migratedSpreadsheet = SpreadsheetApp.openById(balanceFoundationRequireDisposableSpreadsheetId(migratedId));
    var original = {
      accounts: balanceFoundationPhysicalSnapshot(migratedSpreadsheet.getSheetByName("Accounts")),
      opening: balanceFoundationPhysicalSnapshot(migratedSpreadsheet.getSheetByName("FinanceOpeningBalances"))
    };
    var trace = [];
    var first = executeBalanceFoundationSchemaMigrationWithRuntime({
      spreadsheet: migratedSpreadsheet,
      flush: function() { SpreadsheetApp.flush(); },
      afterAccountsStructure: function() { trace.push("ACCOUNTS_STRUCTURE"); },
      afterAccountsWrite: function() { trace.push("ACCOUNTS_WRITE"); },
      afterOpeningStructure: function() { trace.push("OPENING_STRUCTURE"); },
      afterOpeningWrite: function() { trace.push("OPENING_WRITE"); }
    });
    var freshMigrated = SpreadsheetApp.openById(migratedId);
    var physical = {
      accounts: balanceFoundationSheetSnapshot(freshMigrated.getSheetByName("Accounts")),
      opening: balanceFoundationSheetSnapshot(freshMigrated.getSheetByName("FinanceOpeningBalances"))
    };
    var candidate = buildBalanceFoundationSchemaMigrationCandidate(original.accounts.values, original.opening.values);
    var acceptance = validateBalanceFoundationSchemaMigrationAcceptance({
      accounts: original.accounts.values, opening: original.opening.values
    }, candidate, physical);
    var physicalBeforeSecond = {
      accounts: balanceFoundationPhysicalSnapshot(freshMigrated.getSheetByName("Accounts")),
      opening: balanceFoundationPhysicalSnapshot(freshMigrated.getSheetByName("FinanceOpeningBalances"))
    };
    var second = executeBalanceFoundationSchemaMigrationWithRuntime({
      spreadsheet: SpreadsheetApp.openById(migratedId), flush: function() { SpreadsheetApp.flush(); }
    });
    var afterSecond = SpreadsheetApp.openById(migratedId);
    var secondUnchanged = balanceFoundationPhysicalStateMatches(afterSecond.getSheetByName("Accounts"),
      physicalBeforeSecond.accounts) && balanceFoundationPhysicalStateMatches(
      afterSecond.getSheetByName("FinanceOpeningBalances"), physicalBeforeSecond.opening);

    var rollbackId = balanceFoundationCreateDisposableLegacySpreadsheet(
      "NUMLOCK Balance Foundation Disposable Rollback " + new Date().getTime());
    disposableIds.push(rollbackId);
    var rollbackSpreadsheet = SpreadsheetApp.openById(balanceFoundationRequireDisposableSpreadsheetId(rollbackId));
    var rollbackOriginal = {
      accounts: balanceFoundationPhysicalSnapshot(rollbackSpreadsheet.getSheetByName("Accounts")),
      opening: balanceFoundationPhysicalSnapshot(rollbackSpreadsheet.getSheetByName("FinanceOpeningBalances"))
    };
    var rollbackError = "";
    try {
      executeBalanceFoundationSchemaMigrationWithRuntime({
        spreadsheet: rollbackSpreadsheet,
        flush: function() { SpreadsheetApp.flush(); },
        afterAccountsStructure: function() { throw new Error("DISPOSABLE_CONTROLLED_FAILURE_AFTER_ACCOUNTS_STRUCTURE"); }
      });
    } catch (error) { rollbackError = error.message; }
    var freshRollback = SpreadsheetApp.openById(rollbackId);
    var rollbackRestored = balanceFoundationPhysicalStateMatches(freshRollback.getSheetByName("Accounts"),
      rollbackOriginal.accounts) && balanceFoundationPhysicalStateMatches(
      freshRollback.getSheetByName("FinanceOpeningBalances"), rollbackOriginal.opening);

    balanceFoundationRuntimeProofRequire(first.status === "PASS" && first.writeCount === 2,
      "first migration result");
    balanceFoundationRuntimeProofRequire(JSON.stringify(trace) === JSON.stringify([
      "ACCOUNTS_STRUCTURE", "ACCOUNTS_WRITE", "OPENING_STRUCTURE", "OPENING_WRITE"
    ]), "structural operation trace");
    balanceFoundationRuntimeProofRequire(freshMigrated.getSheetByName("Accounts").getMaxColumns() === 9 &&
      freshMigrated.getSheetByName("FinanceOpeningBalances").getMaxColumns() === 13 &&
      acceptance.status === "PASS", "fresh physical acceptance");
    balanceFoundationRuntimeProofRequire(second.status === "ALREADY_MIGRATED" && second.writeCount === 0 &&
      secondUnchanged, "second-run idempotency");
    balanceFoundationRuntimeProofRequire(rollbackError.indexOf(
      "DISPOSABLE_CONTROLLED_FAILURE_AFTER_ACCOUNTS_STRUCTURE") !== -1 &&
      rollbackError.indexOf("rollback: SUCCESS") !== -1 && rollbackRestored,
      "controlled rollback restoration");
    result = {
      status: "PASS", runtime: "APPS_SCRIPT_SHEET", productionSpreadsheetUsed: false,
      productionIdentityRefused: true, firstMigration: first.status, firstWriteCount: first.writeCount,
      accountsColumns: "8->9", openingSchema: "LEGACY->V2", freshReadAcceptance: acceptance.status,
      secondMigration: second.status, secondWriteCount: second.writeCount,
      secondRunChanged: !secondUnchanged, rollbackRestored: rollbackRestored,
      originalRollbackErrorPreserved: rollbackError.indexOf(
        "DISPOSABLE_CONTROLLED_FAILURE_AFTER_ACCOUNTS_STRUCTURE") !== -1
    };
  } catch (error) { failure = error; }
  disposableIds.forEach(function(id) {
    try { DriveApp.getFileById(balanceFoundationRequireDisposableSpreadsheetId(id)).setTrashed(true); }
    catch (error) { cleanup = "MANUAL CLEANUP REQUIRED"; }
  });
  if (failure) throw failure;
  result.cleanup = cleanup;
  Logger.log(JSON.stringify(result));
  return result;
}

function readFinanceOpeningBalancesCompat(ss) {
  var sheet = ss.getSheetByName(FINANCE_OPENING_BALANCE_POLICY.SHEET);
  if (!sheet || sheet.getLastRow() < 1) throw new Error("FinanceOpeningBalances has incompatible schema");
  var width = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(function(value) { return String(value); });
  var supported = [FINANCE_OPENING_BALANCE_POLICY.HEADERS, BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS]
    .filter(function(candidate) { return JSON.stringify(candidate) === JSON.stringify(headers); })[0];
  if (!supported) throw new Error("FinanceOpeningBalances has incompatible schema");
  return readCanonicalTable(ss, FINANCE_OPENING_BALANCE_POLICY.SHEET, supported);
}

function balanceSourceEventKey(row) {
  var sourceType = String(row && row.SourceType || "").trim();
  var sourceId = String(row && row.SourceID || "").trim();
  return sourceType && sourceId ? sourceType + "|" + sourceId : null;
}

function validateBalanceLedgerCandidates(rows, accounts) {
  var accountMap = {}, lineIds = {}, sourceJournals = {}, journalSources = {}, journals = {}, errors = [];
  (accounts || []).forEach(function(account) {
    if (isCanonicalActive(account.IsActive)) accountMap[String(account.AccountCode || "").trim()] = true;
  });
  (rows || []).forEach(function(row, index) {
    var lineId = String(row.LineID || "").trim(), journalId = String(row.JournalID || "").trim();
    var sourceKey = balanceSourceEventKey(row), rowErrors = [];
    rowErrors = rowErrors.concat(balanceContractMissingFields(row, BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS));
    if (!lineId || lineIds[lineId]) rowErrors.push("DUPLICATE_OR_MISSING_LINE_ID");
    lineIds[lineId] = true;
    if (!journalId || !sourceKey) rowErrors.push("MISSING_JOURNAL_OR_SOURCE_EVENT");
    if (sourceKey && sourceJournals[sourceKey] && sourceJournals[sourceKey] !== journalId) {
      rowErrors.push("DUPLICATE_SOURCE_EVENT");
    }
    if (sourceKey) sourceJournals[sourceKey] = journalId;
    if (journalId && sourceKey && journalSources[journalId] && journalSources[journalId] !== sourceKey) {
      rowErrors.push("MULTIPLE_SOURCE_EVENTS_PER_JOURNAL");
    }
    if (journalId && sourceKey) journalSources[journalId] = sourceKey;
    if (!String(row.MovementType || "").trim()) rowErrors.push("MISSING_MOVEMENT_TYPE");
    if (!isCanonicalActive(row.IsActive)) {
      if (rowErrors.length) errors.push({ row: index + 1, lineId: lineId, errors: rowErrors });
      return;
    }
    var debit = Number(row.Debit), credit = Number(row.Credit), code = String(row.AccountCode || "").trim();
    if (!capitalEquityDateKey(row.Tanggal)) rowErrors.push("INVALID_DATE");
    if (!accountMap[code]) rowErrors.push("INACTIVE_OR_UNRESOLVED_ACCOUNT");
    if (!isFinite(debit) || !isFinite(credit) || debit < 0 || credit < 0 || (debit > 0) === (credit > 0)) {
      rowErrors.push("INVALID_ONE_SIDED_AMOUNT");
    }
    journals[journalId] = journals[journalId] || { debit: 0, credit: 0, activeLines: 0 };
    journals[journalId].debit += debit; journals[journalId].credit += credit; journals[journalId].activeLines++;
    if (rowErrors.length) errors.push({ row: index + 1, lineId: lineId, errors: rowErrors });
  });
  Object.keys(journals).sort().forEach(function(journalId) {
    var journal = journals[journalId];
    if (journal.debit !== journal.credit) errors.push({ journalId: journalId, errors: ["UNBALANCED_JOURNAL"] });
  });
  return { status: errors.length ? "FAIL" : "PASS", errors: errors, journals: journals,
    activeDebit: Object.keys(journals).reduce(function(total, id) { return total + journals[id].debit; }, 0),
    activeCredit: Object.keys(journals).reduce(function(total, id) { return total + journals[id].credit; }, 0) };
}

function buildBalanceLedgerCandidates(rows, accounts) {
  var candidates = (rows || []).map(function(row) { return Object.assign({}, row); });
  var validation = validateBalanceLedgerCandidates(candidates, accounts);
  if (validation.status !== "PASS") throw new Error("Invalid BalanceLedger candidates: " + JSON.stringify(validation.errors));
  return { status: "PASS", readOnly: true, writeCount: 0, sourceEventKeys: candidates.map(balanceSourceEventKey),
    rows: candidates, journals: validation.journals };
}

function inventorySourceEventKey(row) {
  var sourceType = String(row && row.SourceType || "").trim();
  var sourceId = String(row && row.SourceID || "").trim();
  return sourceType && sourceId ? sourceType + "|" + sourceId : null;
}

function validateInventoryLedgerCandidates(rows) {
  var ids = {}, sources = {}, errors = [], activeRows = [];
  (rows || []).forEach(function(row, index) {
    var id = String(row.ID_Movement || "").trim(), sourceKey = inventorySourceEventKey(row), rowErrors = [];
    rowErrors = rowErrors.concat(balanceContractMissingFields(row, BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS));
    if (!id || ids[id]) rowErrors.push("DUPLICATE_OR_MISSING_MOVEMENT_ID");
    if (!sourceKey || sources[sourceKey]) rowErrors.push("DUPLICATE_OR_MISSING_SOURCE_EVENT");
    ids[id] = true; if (sourceKey) sources[sourceKey] = true;
    if (!isCanonicalActive(row.IsActive)) {
      if (rowErrors.length) errors.push({ row: index + 1, id: id, errors: rowErrors });
      return;
    }
    activeRows.push(row);
    var type = String(row.MovementType || "").trim(), qtyIn = Number(row.QtyIn), qtyOut = Number(row.QtyOut);
    var unitCost = Number(row.UnitCost), totalCost = Number(row.TotalCost);
    if (!capitalEquityDateKey(row.Tanggal)) rowErrors.push("INVALID_DATE");
    if (!String(row.ItemID || "").trim() || !String(row.Location || "").trim()) rowErrors.push("MISSING_ITEM_OR_LOCATION");
    if (BALANCE_FOUNDATION_POLICY.INVENTORY_MOVEMENT_TYPES.indexOf(type) === -1) rowErrors.push("INVALID_MOVEMENT_TYPE");
    if (!isFinite(qtyIn) || !isFinite(qtyOut) || qtyIn < 0 || qtyOut < 0 ||
        type !== "VALUATION_VARIANCE" && (qtyIn > 0) === (qtyOut > 0) ||
        type === "VALUATION_VARIANCE" && (qtyIn !== 0 || qtyOut !== 0)) rowErrors.push("INVALID_ONE_SIDED_QUANTITY");
    if (!isFinite(unitCost) || !isFinite(totalCost) || unitCost < 0 || totalCost < 0) rowErrors.push("INVALID_COST");
    if (type === "VALUATION_VARIANCE" && !isFinite(Number(row.ValuationVariance))) {
      rowErrors.push("MISSING_VALUATION_VARIANCE");
    }
    if (qtyIn > 0 && totalCost !== qtyIn * unitCost) rowErrors.push("INBOUND_COST_MISMATCH");
    if (qtyOut > 0 && totalCost !== 0) rowErrors.push("OUTBOUND_COST_MUST_BE_CANDIDATE_CALCULATED");
    if (rowErrors.length) errors.push({ row: index + 1, id: id, errors: rowErrors });
  });
  return { status: errors.length ? "FAIL" : "PASS", errors: errors, activeRows: activeRows,
    excludedInactiveRows: (rows || []).length - activeRows.length };
}

function buildMovingWeightedAverageCandidates(rows) {
  var validation = validateInventoryLedgerCandidates(rows);
  if (validation.status !== "PASS") throw new Error("Invalid InventoryLedger candidates: " + JSON.stringify(validation.errors));
  var state = {}, calculations = [];
  validation.activeRows.slice().sort(function(left, right) {
    return (capitalEquityDateKey(left.Tanggal) + "|" + String(left.ID_Movement)).localeCompare(
      capitalEquityDateKey(right.Tanggal) + "|" + String(right.ID_Movement));
  }).forEach(function(row) {
    var key = String(row.ItemID).trim() + "|" + String(row.Location).trim();
    var current = state[key] || { quantity: 0, value: 0, averageCost: 0 };
    var qtyIn = Number(row.QtyIn), qtyOut = Number(row.QtyOut), type = String(row.MovementType).trim();
    var outboundCandidateCost = qtyOut * current.averageCost;
    if (qtyOut > current.quantity) throw new Error("InventoryLedger candidate would create negative stock: " + row.ID_Movement);
    if (type === "VALUATION_VARIANCE") current.value += Number(row.ValuationVariance);
    else if (qtyIn > 0) { current.quantity += qtyIn; current.value += Number(row.TotalCost); }
    else { current.quantity -= qtyOut; current.value -= outboundCandidateCost; }
    if (current.value < 0) throw new Error("InventoryLedger valuation variance would create negative value: " + row.ID_Movement);
    current.averageCost = current.quantity ? current.value / current.quantity : 0;
    state[key] = current;
    calculations.push({ ID_Movement: String(row.ID_Movement), quantity: current.quantity, inventoryValue: current.value,
      movingWeightedAverage: current.averageCost, outboundCandidateCost: outboundCandidateCost });
  });
  return { status: "PASS", readOnly: true, writeCount: 0, candidateOnly: true,
    hppAuthority: BALANCE_FOUNDATION_POLICY.HPP_AUTHORITY, calculations: calculations, closingState: state };
}
