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
  INVENTORY_ITEM_HEADERS: Object.freeze(["ItemID", "ItemName", "Classification", "BaseUOM", "EffectiveFrom",
    "EffectiveTo", "IsActive", "SourceIngredientID", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  INVENTORY_ITEM_CLASSIFICATIONS: Object.freeze(["RAW_MATERIAL", "PACKAGING"]),
  INVENTORY_BASE_UOMS: Object.freeze(["gr", "ml", "pcs", "slice"]),
  INVENTORY_UOM_CONVERSION_HEADERS: Object.freeze(["ConversionID", "ItemID", "FromUOM", "PackageIdentity",
    "SupplierRef", "ToUOM", "Numerator", "Denominator", "EffectiveFrom", "EffectiveTo", "EvidenceType",
    "EvidenceRef", "EvidenceDate", "PreparedBy", "PreparedAt", "ReviewedBy", "ReviewedAt", "ApprovalStatus",
    "ApprovalNote", "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  INVENTORY_CONVERSION_EVIDENCE_TYPES: Object.freeze(["PACKAGE_LABEL", "SUPPLIER_SPECIFICATION",
    "INVOICE_RECEIPT", "PHYSICAL_COUNT", "CONTROLLED_YIELD_TEST", "OPERATOR_ATTESTATION", "MANAGEMENT_OPERATIONAL_STANDARD"]),
  INVENTORY_CONVERSION_APPROVAL_STATUSES: Object.freeze(["DRAFT", "PENDING_REVIEW", "APPROVED",
    "SINGLE_OPERATOR_APPROVED", "REJECTED", "SUPERSEDED"]),
  INVENTORY_LEDGER_HEADERS: Object.freeze(["ID_Movement", "MovementTimestamp", "ItemID", "Location", "BaseUOM",
    "MovementType", "QtyIn", "QtyOut", "UnitCost", "TotalCost", "ValuationVariance", "SourceType", "SourceID",
    "TransferID", "ReversalOfMovementID", "AccountingJournalID", "ExternalRef", "Keterangan", "IsActive",
    "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  INVENTORY_MOVEMENT_TYPES: Object.freeze(["OPENING_IN", "PURCHASE_RECEIPT_IN", "CONSUMPTION_OUT",
    "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "TRANSFER_IN", "TRANSFER_OUT"]),
  INVENTORY_OPENING_HEADERS: Object.freeze(["OpeningEvidenceID", "CountDate", "CountBoundary", "ItemID",
    "Location", "BaseUOM", "Quantity", "UnitCost", "TotalValue", "CountDocumentRef", "CostEvidenceRef",
    "CountedBy", "ApprovedBy", "IsActive"]),
  INVENTORY_CUTOVER_DATE: "2026-09-30",
  INVENTORY_LEDGER_START_DATE: "2026-10-01",
  INVENTORY_DEFAULT_LOCATION: "MAIN",
  INVENTORY_ASSET_ACCOUNT: Object.freeze({ AccountCode: "1100", AccountName: "Inventory Asset",
    AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT" }),
  RECIPE_AUTO_CONSUMPTION_ENABLED: false,
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

function inventoryRoundRupiahHalfUp(value) {
  var amount = Number(value);
  if (!isFinite(amount) || amount < 0) throw new Error("Rupiah amount must be finite and non-negative");
  return Math.floor(amount + 0.5);
}

function inventoryTimestampMillis(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.getTime();
  var text = String(value == null ? "" : value).trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  var millis = Date.parse(text);
  return isNaN(millis) ? null : millis;
}

function inventoryItemIndex(items) {
  var index = {}, duplicates = {};
  (items || []).forEach(function(row) {
    var id = String(row && row.ItemID || "").trim();
    if (!id) return;
    if (index[id]) duplicates[id] = true;
    else index[id] = row;
  });
  return { items: index, duplicates: duplicates };
}

function validateInventoryItemCandidates(rows) {
  var ids = {}, sourceIds = {}, errors = [], activeRows = [];
  (rows || []).forEach(function(row, index) {
    var id = String(row && row.ItemID || "").trim(), sourceId = String(row && row.SourceIngredientID || "").trim();
    var rowErrors = balanceContractMissingFields(row, BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS);
    if (!id || ids[id]) rowErrors.push("DUPLICATE_OR_MISSING_ITEM_ID");
    if (!sourceId || sourceIds[sourceId]) rowErrors.push("DUPLICATE_OR_MISSING_SOURCE_INGREDIENT_ID");
    if (id !== sourceId) rowErrors.push("ITEM_ID_MUST_EQUAL_SOURCE_INGREDIENT_ID");
    ids[id] = true; sourceIds[sourceId] = true;
    if (!isCanonicalActive(row.IsActive)) {
      if (rowErrors.length) errors.push({ row: index + 1, id: id, errors: rowErrors });
      return;
    }
    activeRows.push(row);
    if (!String(row.ItemName || "").trim()) rowErrors.push("MISSING_ITEM_NAME");
    if (BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_CLASSIFICATIONS.indexOf(String(row.Classification || "").trim()) === -1) {
      rowErrors.push("INVALID_ITEM_CLASSIFICATION");
    }
    if (BALANCE_FOUNDATION_POLICY.INVENTORY_BASE_UOMS.indexOf(String(row.BaseUOM || "").trim()) === -1) {
      rowErrors.push("INVALID_BASE_UOM");
    }
    if (!capitalEquityDateKey(row.EffectiveFrom) || row.EffectiveTo && !capitalEquityDateKey(row.EffectiveTo)) {
      rowErrors.push("INVALID_ITEM_EFFECTIVE_DATES");
    }
    if (rowErrors.length) errors.push({ row: index + 1, id: id, errors: rowErrors });
  });
  return { status: errors.length ? "FAIL" : "PASS", errors: errors, activeRows: activeRows,
    excludedInactiveRows: (rows || []).length - activeRows.length };
}

function buildInventoryItemCandidates(ingredients, recipeRows) {
  var ingredientIndex = {}, duplicates = {}, used = {};
  (ingredients || []).forEach(function(row) {
    var id = String(row && row.ID_Ingredient || "").trim();
    if (!id) return;
    if (ingredientIndex[id]) duplicates[id] = true;
    else ingredientIndex[id] = row;
  });
  (recipeRows || []).forEach(function(row) {
    if (!isCanonicalActive(row.IsActive)) return;
    var id = String(row.ID_Ingredient || "").trim();
    if (!id || !ingredientIndex[id] || duplicates[id] || !isCanonicalActive(ingredientIndex[id].IsActive)) {
      throw new Error("Active recipe has unresolved Inventory item identity: " + id);
    }
    used[id] = true;
  });
  var rows = (ingredients || []).filter(function(row) {
    return isCanonicalActive(row.IsActive) && used[String(row.ID_Ingredient || "").trim()];
  }).map(function(row) {
    var category = String(row.Category || "").trim(), id = String(row.ID_Ingredient || "").trim();
    return { ItemID: id, ItemName: String(row.Ingredient || "").trim(),
      Classification: category === "Material" ? "RAW_MATERIAL" : category === "Support" ? "PACKAGING" : "",
      BaseUOM: String(row.BaseUnit || "").trim(), EffectiveFrom: row.EffectiveFrom, EffectiveTo: row.EffectiveTo,
      IsActive: row.IsActive, SourceIngredientID: id, CreatedAt: row.CreatedAt || "", CreatedBy: "",
      UpdatedAt: row.UpdatedAt || "", UpdatedBy: "" };
  });
  var validation = validateInventoryItemCandidates(rows);
  if (validation.status !== "PASS") throw new Error("Invalid InventoryItems candidates: " + JSON.stringify(validation.errors));
  return { status: "PASS", candidateOnly: true, readOnly: true, writeCount: 0, rows: rows };
}

function inventoryConversionDateRangeOverlaps(left, right) {
  var leftFrom = capitalEquityDateKey(left.EffectiveFrom), rightFrom = capitalEquityDateKey(right.EffectiveFrom);
  var leftTo = capitalEquityDateKey(left.EffectiveTo) || "9999-12-31";
  var rightTo = capitalEquityDateKey(right.EffectiveTo) || "9999-12-31";
  return leftFrom <= rightTo && rightFrom <= leftTo;
}

function inventoryOperatorAttestationDetails(row) {
  if (String(row && row.EvidenceType || "").trim() !== "OPERATOR_ATTESTATION") return null;
  var evidenceRef = String(row && row.EvidenceRef || "").trim();
  var note = String(row && row.ApprovalNote || "").trim();
  var noteMatch = note.match(/^BASIS=(DIRECTLY_OBSERVED|OPERATOR_KNOWN);\s*METHOD=([^;]+);\s*PLAUSIBILITY=CONFIRMED;\s*LIMITATIONS=([^;]+);\s*REVIEW=([^;]+)$/);
  var details = { evidenceRefValid: /^GDRIVE:[A-Za-z0-9_-]+:V\d{2}:SHA256:[a-f0-9]{64}$/.test(evidenceRef),
    noteValid: !!noteMatch, basis: noteMatch ? noteMatch[1] : "", method: noteMatch ? noteMatch[2].trim() : "",
    limitations: noteMatch ? noteMatch[3].trim() : "", review: noteMatch ? noteMatch[4].trim() : "" };
  var itemId = String(row && row.ItemID || "").trim(), supplierRef = String(row && row.SupplierRef || "").trim();
  var packageParts = String(row && row.PackageIdentity || "").trim().split("|");
  details.sourceIdentityValid = /^(?:SUP|INTERNAL)-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(supplierRef);
  details.packageIdentityValid = packageParts.length === 6 && packageParts[0] === itemId &&
    packageParts[1] === supplierRef && packageParts.slice(2, 5).every(function(value) { return !!value.trim(); }) &&
    /^V\d{2}$/.test(packageParts[5]);
  if (!details.noteValid) return details;
  var prohibited = /(?:^|[^A-Za-z0-9])(?:ESTIMAT\w*|INFER\w*|GUESS\w*|APPROX\w*|USABLE_?QTY|RECIPE|HPP|PURCHASE_?COST)/i;
  details.prohibitedBasis = prohibited.test(details.method) || prohibited.test(details.limitations) ||
    prohibited.test(details.review);
  details.materialVariability = /(?:^|[^A-Za-z0-9])(?:VARIABLE|VARIABILITY|VARIABLE_YIELD)(?:$|[^A-Za-z0-9])/i.test(details.method) ||
    /(?:^|[^A-Za-z0-9])(?:VARIABLE|VARIABILITY|VARIABLE_YIELD)(?:$|[^A-Za-z0-9])/i.test(details.limitations);
  return details;
}

function inventoryOperatorAttestationIsFixedPackagedIce(row, details) {
  var packageIdentity = String(row && row.PackageIdentity || "").trim();
  var supplierRef = String(row && row.SupplierRef || "").trim();
  var from = String(row && row.FromUOM || "").trim().toLowerCase();
  return !!details && !details.materialVariability && details.method.indexOf("FIXED_STANDARDIZED_PACKAGE") !== -1 &&
    packageIdentity.indexOf("ING-021") !== -1 && supplierRef && packageIdentity.indexOf(supplierRef) !== -1 &&
    /\b\d+(?:[.,]\d+)?\s*(?:gr|g|kg)\b/i.test(packageIdentity) && /\|V\d{2}$/.test(packageIdentity) &&
    ["container", "scoop", "batch", "lot", "purchase lot"].indexOf(from) === -1;
}

function inventoryOperatorAttestationRiskTier(row, details) {
  var itemId = String(row && row.ItemID || "").trim();
  var from = String(row && row.FromUOM || "").trim().toLowerCase();
  var packageIdentity = String(row && row.PackageIdentity || "").trim();
  var highRisk = /(?:^|[^A-Za-z0-9])(?:LOOSE|VARIABLE|VARIABILITY|VARIABLE_YIELD|SUBJECTIVE|NATURAL_VARIABILITY|ESTIMAT\w*|APPROX\w*)/i;
  if (itemId === "ING-018" || details && details.materialVariability || highRisk.test(packageIdentity) ||
      ["container", "scoop", "batch", "lot", "purchase lot"].indexOf(from) !== -1) return "HIGH";
  if (itemId === "ING-021" || from === "gallon") return "MODERATE";
  return ["bag", "carton", "bottle", "pack", "box"].indexOf(from) !== -1 ? "LOW" : "HIGH";
}

function inventorySingleOperatorGovernanceErrors(row, attestation, preparedAt, evidenceDate) {
  var errors = [], evidenceType = String(row && row.EvidenceType || "").trim();
  var preparedBy = String(row && row.PreparedBy || "").trim();
  var reviewedBy = String(row && row.ReviewedBy || "").trim();
  var reviewedAt = String(row && row.ReviewedAt || "").trim();
  var note = String(row && row.ApprovalNote || "").trim();
  var noteMatch = note.match(/^BASIS=(DIRECTLY_OBSERVED|OPERATOR_KNOWN);\s*METHOD=([^;]+);\s*PLAUSIBILITY=CONFIRMED;\s*LIMITATIONS=([^;]+);\s*REVIEW=([^;]+)$/);
  var method = noteMatch ? noteMatch[2].trim() : "", limitations = noteMatch ? noteMatch[3].trim() : "";
  var review = noteMatch ? noteMatch[4].trim() : "";
  var immutableRef = /^GDRIVE:[A-Za-z0-9_-]+:V\d{2}:SHA256:[a-f0-9]{64}$/.test(String(row && row.EvidenceRef || "").trim());
  var packageParts = String(row && row.PackageIdentity || "").trim().split("|");
  var sourceRef = String(row && row.SupplierRef || "").trim(), itemId = String(row && row.ItemID || "").trim();
  var identityValid = /^(?:SUP|INTERNAL)-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(sourceRef) &&
    packageParts.length === 6 && packageParts[0] === itemId && packageParts[1] === sourceRef &&
    packageParts.slice(2, 5).every(function(value) { return !!value.trim(); }) && /\d/.test(packageParts[4]) &&
    /^V\d{2}$/.test(packageParts[5]);
  var commonControls = noteMatch && method.indexOf("SIGNED_FIRST_PERSON_STATEMENT") !== -1 &&
    method.indexOf("DETERMINISTIC_ARITHMETIC") !== -1 && limitations.indexOf("NO_INDEPENDENT_REVIEW") !== -1 &&
    review.indexOf("SELF_APPROVAL_DISCLOSED") !== -1;
  var prohibited = /(?:^|[^A-Za-z0-9])(?:ESTIMAT\w*|INFER\w*|GUESS\w*|APPROX\w*|USABLE_?QTY|RECIPE|HPP|PURCHASE_?COST)/i;
  if (!preparedBy || preparedAt === null || reviewedBy || reviewedAt || !evidenceDate ||
      evidenceDate > inventoryTimestampDateKey(row.PreparedAt) ||
      capitalEquityDateKey(row && row.EffectiveFrom) < BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_START_DATE ||
      !immutableRef || !identityValid || !commonControls || prohibited.test(method) || prohibited.test(limitations) ||
      prohibited.test(review)) {
    errors.push("INVALID_SINGLE_OPERATOR_GOVERNANCE");
  }
  if (evidenceType === "OPERATOR_ATTESTATION") {
    var risk = inventoryOperatorAttestationRiskTier(row, attestation);
    if (!attestation || attestation.prohibitedBasis || risk === "HIGH" ||
        method.indexOf("SINGLE_OPERATOR_ATTESTATION") === -1 || method.indexOf("RISK_" + risk) === -1) {
      errors.push(risk === "HIGH" ? "HIGH_RISK_SINGLE_OPERATOR_ATTESTATION" : "INVALID_SINGLE_OPERATOR_GOVERNANCE");
    }
  } else if (evidenceType === "CONTROLLED_YIELD_TEST") {
    ["SINGLE_OPERATOR_CONTROLLED_YIELD", "MINIMUM_5_OBSERVATIONS", "OBSERVED_VARIATION_RECORDED",
      "MEDIAN_STANDARD_CONVERSION"].forEach(function(token) {
      if (method.indexOf(token) === -1) errors.push("INVALID_SINGLE_OPERATOR_CONTROLLED_YIELD");
    });
  } else {
    errors.push("INVALID_SINGLE_OPERATOR_EVIDENCE_TYPE");
  }
  return errors.filter(function(code, index, all) { return all.indexOf(code) === index; });
}

// Phase 11U: normative management authority, never a physical yield observation.
function inventoryLemonOperationalStandardErrors(row) {
  var note = "BASIS=MANAGEMENT_OPERATIONAL_STANDARD; " +
    "METHOD=1_KG_8_FRUITS_1_FRUIT_3_SLICES_SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC; " +
    "PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW_NOT_PHYSICAL_OBSERVATION_OPERATIONAL_VARIANCE; " +
    "REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED";
  var valid = row.ItemID === "ING-018" && row.EvidenceType === "MANAGEMENT_OPERATIONAL_STANDARD" &&
    row.FromUOM === "gr" && row.ToUOM === "slice" && Number(row.Numerator) === 24 &&
    Number(row.Denominator) === 1000 && capitalEquityDateKey(row.EffectiveFrom) === "2026-10-01" &&
    row.SupplierRef === "INTERNAL-NUMLOCK" &&
    row.PackageIdentity === "ING-018|INTERNAL-NUMLOCK|Lemon|OPERATIONAL-STANDARD|1000gr-24slice|V01" &&
    row.ApprovalStatus === "SINGLE_OPERATOR_APPROVED" && row.ApprovalNote === note &&
    !!String(row.PreparedBy || "").trim() && inventoryTimestampMillis(row.PreparedAt) !== null &&
    !!capitalEquityDateKey(row.EvidenceDate) &&
    capitalEquityDateKey(row.EvidenceDate) <= inventoryTimestampDateKey(row.PreparedAt) &&
    !String(row.ReviewedBy || "").trim() && !String(row.ReviewedAt || "").trim() &&
    /^GDRIVE:[A-Za-z0-9_-]+:V01:SHA256:[a-f0-9]{64}$/.test(String(row.EvidenceRef || ""));
  return valid ? [] : ["INVALID_LEMON_MANAGEMENT_STANDARD_AUTHORITY"];
}

function inventoryConversionHasAuthorityStatus(row) {
  var approval = String(row && row.ApprovalStatus || "").trim();
  return approval === "APPROVED" || approval === "SINGLE_OPERATOR_APPROVED";
}

function validateInventoryUomConversions(rows, items) {
  var itemMap = inventoryItemIndex(items), ids = {}, errors = [], activeRows = [], approvedByItem = {};
  (rows || []).forEach(function(row, index) {
    var id = String(row && row.ConversionID || "").trim(), itemId = String(row && row.ItemID || "").trim();
    var rowErrors = balanceContractMissingFields(row, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS);
    var from = String(row.FromUOM || "").trim(), packageIdentity = String(row.PackageIdentity || "").trim();
    var to = String(row.ToUOM || "").trim(), approval = String(row.ApprovalStatus || "").trim();
    var effectiveFrom = capitalEquityDateKey(row.EffectiveFrom), effectiveTo = capitalEquityDateKey(row.EffectiveTo);
    var evidenceDate = capitalEquityDateKey(row.EvidenceDate);
    var preparedAt = inventoryTimestampMillis(row.PreparedAt), reviewedAt = inventoryTimestampMillis(row.ReviewedAt);
    if (!id || ids[id]) rowErrors.push("DUPLICATE_OR_MISSING_CONVERSION_ID");
    if (!itemId || !itemMap.items[itemId] || itemMap.duplicates[itemId] || !isCanonicalActive(itemMap.items[itemId].IsActive)) {
      rowErrors.push("UNRESOLVED_ITEM_ID");
    }
    if (!from || from.toLowerCase() === "purchase lot" || !packageIdentity ||
        packageIdentity.toLowerCase() === "purchase lot") rowErrors.push("NON_CONCRETE_PACKAGE_IDENTITY");
    if (itemMap.items[itemId] && to !== String(itemMap.items[itemId].BaseUOM)) rowErrors.push("CONVERSION_TARGET_MUST_BE_BASE_UOM");
    if (!isFinite(Number(row.Numerator)) || !isFinite(Number(row.Denominator)) ||
        !(Number(row.Numerator) > 0) || !(Number(row.Denominator) > 0)) rowErrors.push("INVALID_CONVERSION_RATIO");
    if (!effectiveFrom || row.EffectiveTo && !effectiveTo || effectiveTo && effectiveTo < effectiveFrom) {
      rowErrors.push("INVALID_CONVERSION_DATES");
    }
    if (BALANCE_FOUNDATION_POLICY.INVENTORY_CONVERSION_EVIDENCE_TYPES.indexOf(String(row.EvidenceType || "").trim()) === -1 ||
        !String(row.EvidenceRef || "").trim() || !evidenceDate) rowErrors.push("INVALID_CONVERSION_EVIDENCE");
    if (itemId === "ING-018" || row.EvidenceType === "MANAGEMENT_OPERATIONAL_STANDARD") {
      rowErrors = rowErrors.concat(inventoryLemonOperationalStandardErrors(row));
    }
    var attestation = inventoryOperatorAttestationDetails(row);
    if (attestation) {
      if (!attestation.evidenceRefValid) rowErrors.push("INVALID_OPERATOR_ATTESTATION_EVIDENCE_REF");
      if (!attestation.sourceIdentityValid) rowErrors.push("INVALID_OPERATOR_ATTESTATION_SOURCE_IDENTITY");
      if (!attestation.packageIdentityValid) rowErrors.push("INVALID_OPERATOR_ATTESTATION_PACKAGE_IDENTITY");
      if (!attestation.noteValid || !attestation.method || !attestation.limitations || !attestation.review) {
        rowErrors.push("INVALID_OPERATOR_ATTESTATION_APPROVAL_NOTE");
      } else if (attestation.prohibitedBasis) rowErrors.push("PROHIBITED_OPERATOR_ATTESTATION_BASIS");
      if (itemId === "ING-018") rowErrors.push("LEMON_MANAGEMENT_STANDARD_REQUIRED");
      if (attestation.materialVariability) {
        rowErrors.push("OPERATOR_ATTESTATION_REQUIRES_CONTROLLED_YIELD_TEST");
      }
      if (itemId === "ING-021" && !inventoryOperatorAttestationIsFixedPackagedIce(row, attestation)) {
        rowErrors.push("AMBIGUOUS_FIXED_PACKAGE_ICE");
      }
    }
    if (BALANCE_FOUNDATION_POLICY.INVENTORY_CONVERSION_APPROVAL_STATUSES.indexOf(approval) === -1) {
      rowErrors.push("INVALID_APPROVAL_STATUS");
    }
    if (approval === "APPROVED" && (!String(row.PreparedBy || "").trim() || preparedAt === null ||
        !String(row.ReviewedBy || "").trim() || reviewedAt === null ||
        String(row.PreparedBy).trim() === String(row.ReviewedBy).trim() || reviewedAt <= preparedAt ||
        evidenceDate && evidenceDate > inventoryTimestampDateKey(row.ReviewedAt))) {
      rowErrors.push("INVALID_INDEPENDENT_APPROVAL");
    }
    if (approval === "SINGLE_OPERATOR_APPROVED" && row.EvidenceType !== "MANAGEMENT_OPERATIONAL_STANDARD") {
      rowErrors = rowErrors.concat(inventorySingleOperatorGovernanceErrors(row, attestation, preparedAt, evidenceDate));
    }
    if ((approval === "REJECTED" || approval === "SUPERSEDED") && !String(row.ApprovalNote || "").trim()) {
      rowErrors.push("MISSING_APPROVAL_NOTE");
    }
    ids[id] = true;
    if (isCanonicalActive(row.IsActive)) activeRows.push(row);
    if (isCanonicalActive(row.IsActive) && inventoryConversionHasAuthorityStatus(row) && effectiveFrom) {
      if (!approvedByItem[itemId]) approvedByItem[itemId] = [];
      approvedByItem[itemId].push({ row: row, rowNumber: index + 1, id: id });
    }
    if (rowErrors.length) errors.push({ row: index + 1, id: id, errors: rowErrors });
  });
  Object.keys(approvedByItem).forEach(function(itemId) {
    var approved = approvedByItem[itemId];
    for (var left = 0; left < approved.length; left++) for (var right = left + 1; right < approved.length; right++) {
      if (inventoryConversionDateRangeOverlaps(approved[left].row, approved[right].row)) {
        errors.push({ row: approved[right].rowNumber, id: approved[right].id,
          errors: ["OVERLAPPING_APPROVED_CONVERSION"] });
      }
    }
  });
  return { status: errors.length ? "FAIL" : "PASS", errors: errors, activeRows: activeRows };
}

function classifyInventoryConversionReadiness(itemId, postingDate, items, conversions) {
  var itemMap = inventoryItemIndex(items), item = itemMap.items[String(itemId || "").trim()];
  var date = capitalEquityDateKey(postingDate), relevant = (conversions || []).filter(function(row) {
    return String(row && row.ItemID || "").trim() === String(itemId || "").trim() && isCanonicalActive(row.IsActive);
  });
  if (!item || itemMap.duplicates[String(itemId || "").trim()] || !isCanonicalActive(item && item.IsActive)) {
    return { status: "INACTIVE", reasonCodes: ["INACTIVE_OR_UNRESOLVED_ITEM"], conversion: null };
  }
  var validation = validateInventoryUomConversions(relevant, items);
  if (!date) return { status: "CONFLICT", reasonCodes: ["INVALID_POSTING_DATE"], conversion: null };
  if (validation.status !== "PASS") {
    var reasonCodes = validation.errors.reduce(function(all, error) { return all.concat(error.errors); }, []);
    var evidenceOnly = reasonCodes.every(function(code) {
      return code === "NON_CONCRETE_PACKAGE_IDENTITY" || code === "INVALID_CONVERSION_EVIDENCE" ||
        /^MISSING_(FROMUOM|PACKAGEIDENTITY|SUPPLIERREF|EVIDENCETYPE|EVIDENCEREF|EVIDENCEDATE|PREPAREDBY|PREPAREDAT|REVIEWEDBY|REVIEWEDAT|APPROVALSTATUS|APPROVALNOTE)$/.test(code);
    });
    return { status: evidenceOnly ? "NEEDS_EVIDENCE" : "CONFLICT", reasonCodes: reasonCodes, conversion: null };
  }
  var applicable = relevant.filter(function(row) {
    var from = capitalEquityDateKey(row.EffectiveFrom), to = capitalEquityDateKey(row.EffectiveTo);
    return isCanonicalActive(row.IsActive) && inventoryConversionHasAuthorityStatus(row) &&
      from && from <= date && (!to || date <= to);
  });
  if (applicable.length > 1) return { status: "CONFLICT", reasonCodes: ["MULTIPLE_APPLICABLE_CONVERSIONS"], conversion: null };
  if (applicable.length === 0) return { status: "NEEDS_EVIDENCE", reasonCodes: ["NO_VERIFIED_CONVERSION"], conversion: null };
  return { status: String(applicable[0].ApprovalStatus || "").trim() === "SINGLE_OPERATOR_APPROVED" ?
    "SINGLE_OPERATOR_VERIFIED" : "VERIFIED", reasonCodes: [], conversion: applicable[0] };
}

function gateInventoryMovementConversion(row, items, conversions) {
  var itemId = String(row && row.ItemID || "").trim();
  var postingDate = inventoryTimestampDateKey(row && row.MovementTimestamp);
  var readiness = classifyInventoryConversionReadiness(itemId, postingDate, items, conversions || []);
  return { status: readiness.status === "VERIFIED" || readiness.status === "SINGLE_OPERATOR_VERIFIED" ?
    "ACCEPTED" : "REFUSED", itemId: itemId,
    postingDate: postingDate, readiness: readiness.status, reasonCodes: readiness.reasonCodes.slice(),
    conversionId: readiness.conversion ? String(readiness.conversion.ConversionID || "").trim() : null };
}

function inventoryMovementDirection(type) {
  if (["OPENING_IN", "PURCHASE_RECEIPT_IN", "ADJUSTMENT_IN", "TRANSFER_IN"].indexOf(type) !== -1) return "IN";
  if (["CONSUMPTION_OUT", "ADJUSTMENT_OUT", "TRANSFER_OUT"].indexOf(type) !== -1) return "OUT";
  return null;
}

function inventoryTimestampDateKey(value) {
  if (value instanceof Date) return capitalEquityDateKey(value);
  var match = String(value == null ? "" : value).trim().match(/^(\d{4}-\d{2}-\d{2})T/);
  return match && capitalEquityDateKey(match[1]);
}

function validateInventoryLedgerCandidates(rows, items, options) {
  options = options || {};
  var itemMap = inventoryItemIndex(items), ids = {}, sources = {}, activeById = {}, reversed = {}, transfers = {}, errors = [], activeRows = [];
  (rows || []).forEach(function(row) {
    if (isCanonicalActive(row.IsActive)) activeById[String(row.ID_Movement || "").trim()] = row;
  });
  (rows || []).forEach(function(row, index) {
    var id = String(row.ID_Movement || "").trim(), sourceKey = inventorySourceEventKey(row), rowErrors = [];
    rowErrors = rowErrors.concat(balanceContractMissingFields(row, BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS));
    if (!id || ids[id]) rowErrors.push("DUPLICATE_OR_MISSING_MOVEMENT_ID");
    if (!sourceKey || sources[sourceKey]) rowErrors.push("DUPLICATE_OR_MISSING_SOURCE_EVENT");
    ids[id] = true; if (sourceKey) sources[sourceKey] = true;
    if (!isCanonicalActive(row.IsActive)) { if (rowErrors.length) errors.push({ row: index + 1, id: id, errors: rowErrors }); return; }
    activeRows.push(row);
    var type = String(row.MovementType || "").trim(), direction = inventoryMovementDirection(type);
    var itemId = String(row.ItemID || "").trim(), item = itemMap.items[itemId];
    var qtyIn = Number(row.QtyIn), qtyOut = Number(row.QtyOut), unitCost = Number(row.UnitCost), totalCost = Number(row.TotalCost);
    var timestampMillis = inventoryTimestampMillis(row.MovementTimestamp), movementDate = inventoryTimestampDateKey(row.MovementTimestamp);
    if (timestampMillis === null) rowErrors.push("INVALID_MOVEMENT_TIMESTAMP");
    if (!movementDate || movementDate < BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_START_DATE ||
        type === "OPENING_IN" && movementDate !== BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_START_DATE) {
      rowErrors.push("INVALID_LEDGER_START_DATE");
    }
    if (!item || itemMap.duplicates[itemId] || !isCanonicalActive(item && item.IsActive)) rowErrors.push("UNRESOLVED_ITEM_ID");
    var operationalReceipt = typeof inventoryReceiptOperationalCandidateValid_ === "function" &&
      inventoryReceiptOperationalCandidateValid_(row, items, options.operationalReceipts);
    var conversionGate = operationalReceipt ? { status: "ACCEPTED" } : gateInventoryMovementConversion(row, items, options.conversions || []);
    if (conversionGate.status !== "ACCEPTED") rowErrors.push("CONVERSION_AUTHORITY_" + conversionGate.readiness);
    if (!String(row.Location || "").trim()) rowErrors.push("MISSING_LOCATION");
    else if (!options.enableMultipleLocations && String(row.Location).trim() !== BALANCE_FOUNDATION_POLICY.INVENTORY_DEFAULT_LOCATION) {
      rowErrors.push("LOCATION_AUTHORITY_DISABLED");
    }
    if (item && String(row.BaseUOM || "").trim() !== String(item.BaseUOM || "").trim()) rowErrors.push("BASE_UOM_SNAPSHOT_MISMATCH");
    if (!direction) rowErrors.push("INVALID_MOVEMENT_TYPE");
    if (!isFinite(qtyIn) || !isFinite(qtyOut) || qtyIn < 0 || qtyOut < 0 ||
        direction === "IN" && (!(qtyIn > 0) || qtyOut !== 0) || direction === "OUT" && (!(qtyOut > 0) || qtyIn !== 0)) {
      rowErrors.push("INVALID_ONE_SIDED_QUANTITY");
    }
    if (!isFinite(unitCost) || unitCost < 0 || !isFinite(totalCost) || totalCost < 0 || Math.floor(totalCost) !== totalCost) {
      rowErrors.push("INVALID_INTEGER_RUPIAH_COST");
    }
    if (Number(row.ValuationVariance) !== 0) rowErrors.push("UNSUPPORTED_VALUATION_VARIANCE");
    if (direction === "IN" && isFinite(qtyIn) && isFinite(unitCost) && isFinite(totalCost) &&
        inventoryRoundRupiahHalfUp(qtyIn * unitCost) !== totalCost) rowErrors.push("INBOUND_COST_MISMATCH");
    if (direction === "OUT" && totalCost !== 0) rowErrors.push("OUTBOUND_COST_MUST_BE_CANDIDATE_CALCULATED");
    if (!operationalReceipt && !String(row.AccountingJournalID || "").trim()) rowErrors.push("MISSING_ACCOUNTING_JOURNAL_LINK");
    if (row.SourceType === "INVENTORY_RECEIPT_OPERATIONAL_V1" && !operationalReceipt) rowErrors.push("INVALID_OPERATIONAL_RECEIPT_AUTHORITY");
    if ((type === "TRANSFER_IN" || type === "TRANSFER_OUT") && !options.enableTransfers) rowErrors.push("TRANSFER_AUTHORITY_DISABLED");
    if ((type === "TRANSFER_IN" || type === "TRANSFER_OUT") && !String(row.TransferID || "").trim()) rowErrors.push("MISSING_TRANSFER_LINK");
    if (type === "TRANSFER_IN" || type === "TRANSFER_OUT") {
      var transferId = String(row.TransferID || "").trim();
      if (!transfers[transferId]) transfers[transferId] = [];
      transfers[transferId].push(row);
    }
    var reversalId = String(row.ReversalOfMovementID || "").trim();
    if (reversalId) {
      var original = activeById[reversalId];
      if (!original || reversalId === id || reversed[reversalId] ||
          inventoryTimestampMillis(original && original.MovementTimestamp) >= timestampMillis) {
        rowErrors.push("INVALID_OR_DUPLICATE_REVERSAL_LINK");
      }
      else {
        reversed[reversalId] = true;
        if (String(original.ItemID) !== itemId || String(original.Location) !== String(row.Location) ||
            String(original.BaseUOM) !== String(row.BaseUOM) || Number(original.QtyIn) !== qtyOut ||
            Number(original.QtyOut) !== qtyIn) rowErrors.push("REVERSAL_NOT_EXACT_INVERSE");
      }
    }
    if (rowErrors.length) errors.push({ row: index + 1, id: id, errors: rowErrors });
  });
  if (options.enableTransfers) Object.keys(transfers).forEach(function(transferId) {
    var pair = transfers[transferId], incoming = pair.filter(function(row) { return row.MovementType === "TRANSFER_IN"; }),
      outgoing = pair.filter(function(row) { return row.MovementType === "TRANSFER_OUT"; });
    if (pair.length !== 2 || incoming.length !== 1 || outgoing.length !== 1 ||
        String(incoming[0] && incoming[0].ItemID) !== String(outgoing[0] && outgoing[0].ItemID) ||
        String(incoming[0] && incoming[0].BaseUOM) !== String(outgoing[0] && outgoing[0].BaseUOM) ||
        String(incoming[0] && incoming[0].Location) === String(outgoing[0] && outgoing[0].Location) ||
        Number(incoming[0] && incoming[0].QtyIn) !== Number(outgoing[0] && outgoing[0].QtyOut)) {
      errors.push({ row: 0, id: transferId, errors: ["INVALID_TRANSFER_PAIR"] });
    }
  });
  return { status: errors.length ? "FAIL" : "PASS", errors: errors, activeRows: activeRows,
    excludedInactiveRows: (rows || []).length - activeRows.length };
}

function buildMovingWeightedAverageCandidates(rows, items, options) {
  if ((rows || []).some(function(row) { return row.SourceType === "INVENTORY_RECEIPT_OPERATIONAL_V1"; })) {
    throw new Error("TRACKED_RECEIPTS_ARE_NOT_REMAINING_STOCK_VALUATION");
  }
  var validation = validateInventoryLedgerCandidates(rows, items, options);
  if (validation.status !== "PASS") throw new Error("Invalid InventoryLedger candidates: " + JSON.stringify(validation.errors));
  var state = {}, calculations = [], calculationById = {}, rowById = {};
  validation.activeRows.slice().sort(function(left, right) {
    var timestampDifference = inventoryTimestampMillis(left.MovementTimestamp) - inventoryTimestampMillis(right.MovementTimestamp);
    return timestampDifference || String(left.ID_Movement).localeCompare(String(right.ID_Movement));
  }).forEach(function(row) {
    var key = String(row.ItemID).trim() + "|" + String(row.Location).trim();
    var current = state[key] || { quantity: 0, value: 0, averageCost: 0 };
    var qtyIn = Number(row.QtyIn), qtyOut = Number(row.QtyOut), outboundCandidateCost = 0;
    var reversalId = String(row.ReversalOfMovementID || "").trim(), original = rowById[reversalId], originalCalculation = calculationById[reversalId];
    if (qtyOut > current.quantity) throw new Error("InventoryLedger candidate would create negative stock: " + row.ID_Movement);
    if (qtyIn > 0) {
      var inboundValue = original && Number(original.QtyOut) > 0 ? originalCalculation.outboundCandidateCost : Number(row.TotalCost);
      if (original && Number(original.QtyOut) > 0 && Number(row.TotalCost) !== inboundValue) {
        throw new Error("InventoryLedger reversal has non-inverse value: " + row.ID_Movement);
      }
      current.quantity += qtyIn; current.value += inboundValue;
    }
    else {
      outboundCandidateCost = original && Number(original.QtyIn) > 0 ? Number(original.TotalCost) :
        qtyOut === current.quantity ? current.value : inventoryRoundRupiahHalfUp(qtyOut * current.value / current.quantity);
      current.quantity -= qtyOut; current.value -= outboundCandidateCost;
    }
    if (current.quantity < 0 || current.value < 0) throw new Error("InventoryLedger candidate would create negative inventory: " + row.ID_Movement);
    current.averageCost = current.quantity ? current.value / current.quantity : 0;
    state[key] = current;
    var calculation = { ID_Movement: String(row.ID_Movement), quantity: current.quantity, inventoryValue: current.value,
      movingWeightedAverage: current.averageCost, outboundCandidateCost: outboundCandidateCost };
    calculations.push(calculation); calculationById[String(row.ID_Movement)] = calculation; rowById[String(row.ID_Movement)] = row;
  });
  return { status: "PASS", readOnly: true, writeCount: 0, candidateOnly: true,
    hppAuthority: BALANCE_FOUNDATION_POLICY.HPP_AUTHORITY, calculations: calculations, closingState: state };
}

function validateInventoryOpeningEvidence(rows, items) {
  var itemMap = inventoryItemIndex(items), ids = {}, scopes = {}, activeScopes = {}, errors = [], activeRows = [];
  (rows || []).forEach(function(row, index) {
    var id = String(row && row.OpeningEvidenceID || "").trim(), itemId = String(row && row.ItemID || "").trim();
    var scope = itemId + "|" + String(row.Location || "").trim(), rowErrors =
      balanceContractMissingFields(row, BALANCE_FOUNDATION_POLICY.INVENTORY_OPENING_HEADERS);
    if (!id || ids[id]) rowErrors.push("DUPLICATE_OR_MISSING_OPENING_EVIDENCE_ID");
    if (capitalEquityDateKey(row.CountDate) !== BALANCE_FOUNDATION_POLICY.INVENTORY_CUTOVER_DATE ||
        String(row.CountBoundary || "").trim() !== "EOD") rowErrors.push("INVALID_OPENING_CUTOVER");
    if (!itemMap.items[itemId] || itemMap.duplicates[itemId]) rowErrors.push("UNRESOLVED_ITEM_ID");
    if (!String(row.Location || "").trim() || scopes[scope]) rowErrors.push("DUPLICATE_OR_MISSING_OPENING_SCOPE");
    if (itemMap.items[itemId] && String(row.BaseUOM || "").trim() !== String(itemMap.items[itemId].BaseUOM)) rowErrors.push("BASE_UOM_MISMATCH");
    var quantity = Number(row.Quantity), unitCost = Number(row.UnitCost), totalValue = Number(row.TotalValue);
    if (!(quantity >= 0) || !isFinite(quantity) || !(unitCost >= 0) || !isFinite(unitCost) ||
        !isFinite(totalValue) || totalValue < 0 || Math.floor(totalValue) !== totalValue ||
        isFinite(quantity) && isFinite(unitCost) && isFinite(totalValue) &&
        inventoryRoundRupiahHalfUp(quantity * unitCost) !== totalValue) rowErrors.push("INVALID_OPENING_QUANTITY_OR_VALUE");
    ["CountDocumentRef", "CostEvidenceRef", "CountedBy", "ApprovedBy"].forEach(function(field) {
      if (!String(row[field] || "").trim()) rowErrors.push("MISSING_" + field.toUpperCase());
    });
    ids[id] = true; scopes[scope] = true;
    if (isCanonicalActive(row.IsActive)) { activeRows.push(row); activeScopes[scope] = true; }
    if (rowErrors.length) errors.push({ row: index + 1, id: id, errors: rowErrors });
  });
  Object.keys(itemMap.items).forEach(function(itemId) {
    if (isCanonicalActive(itemMap.items[itemId].IsActive) && !activeScopes[itemId + "|" + BALANCE_FOUNDATION_POLICY.INVENTORY_DEFAULT_LOCATION]) {
      errors.push({ row: 0, id: itemId, errors: ["MISSING_OPENING_EVIDENCE"] });
    }
  });
  return { status: errors.length ? "FAIL" : "PASS", errors: errors, activeRows: activeRows,
    cutoverDate: BALANCE_FOUNDATION_POLICY.INVENTORY_CUTOVER_DATE, ledgerStartDate: BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_START_DATE };
}

function validateInventoryAssetAccountCandidate(account) {
  var expected = BALANCE_FOUNDATION_POLICY.INVENTORY_ASSET_ACCOUNT, errors = [];
  Object.keys(expected).forEach(function(field) {
    var value = account && account[field] != null ? account[field] : "";
    if (String(value).trim() !== expected[field]) errors.push("INVALID_" + field.toUpperCase());
  });
  if (!isCanonicalActive(account && account.IsActive)) errors.push("INACTIVE_INVENTORY_ASSET_ACCOUNT");
  return { status: errors.length ? "FAIL" : "PASS", errors: errors, candidateOnly: true };
}

function reconcileInventorySubledgerToControl(closingState, controlAccountBalance, account) {
  var accountValidation = validateInventoryAssetAccountCandidate(account), subledgerValue = 0;
  Object.keys(closingState || {}).forEach(function(key) {
    var state = closingState[key] || {};
    if (!isFinite(Number(state.value)) || Number(state.value) < 0 || Math.floor(Number(state.value)) !== Number(state.value)) {
      throw new Error("Invalid Inventory subledger carrying value: " + key);
    }
    subledgerValue += Number(state.value);
  });
  var controlMissing = controlAccountBalance === "" || controlAccountBalance == null;
  var control = Number(controlAccountBalance), validControl = !controlMissing && isFinite(control) && control >= 0 && Math.floor(control) === control;
  var variance = validControl ? subledgerValue - control : null;
  return { status: accountValidation.status === "PASS" && validControl && variance === 0 ? "PASS" : "FAIL",
    candidateOnly: true, readOnly: true, writeCount: 0, subledgerValue: subledgerValue,
    controlAccountBalance: validControl ? control : null, variance: variance, accountErrors: accountValidation.errors };
}

var INVENTORY_SCHEMA_MIGRATION = Object.freeze({
  VERSION: "11F.1",
  MIGRATION_ID: "INVENTORY-SCHEMA-20260930",
  ACCOUNTS_SHEET: "Accounts",
  INGREDIENTS_SHEET: "COGSIngredients",
  RECIPES_SHEET: "COGSRecipes",
  ITEMS_SHEET: "InventoryItems",
  CONVERSIONS_SHEET: "InventoryUOMConversions",
  LEDGER_SHEET: "InventoryLedger",
  ACCOUNTS_HEADERS: Object.freeze(["AccountCode", "AccountName", "AccountType", "StatementGroup",
    "CashFlowGroup", "IsActive", "CreatedAt", "UpdatedAt", "NormalBalance"]),
  EXPECTED_ITEM_COUNT: 22,
  EXPECTED_ACTIVE_RECIPE_COUNT: 410,
  EXPECTED_CLASSIFICATIONS: Object.freeze({ RAW_MATERIAL: 18, PACKAGING: 4 }),
  EXPECTED_UOMS: Object.freeze({ gr: 13, ml: 4, pcs: 4, slice: 1 })
});

var INVENTORY_SCHEMA_RUNTIME = Object.freeze({
  PRODUCTION_MODE: "PRODUCTION",
  TEST_MODE: "LOCAL_TEST",
  DISPOSABLE_MODE: "DISPOSABLE_RUNTIME_PROOF",
  DISPOSABLE_NAME_PREFIX: "NUMLOCK Inventory Disposable Proof "
});

var INVENTORY_CONVERSION_SCHEMA_MIGRATION = Object.freeze({
  VERSION: "11K.1",
  MIGRATION_ID: "INVENTORY-CONVERSION-SCHEMA-20260904",
  SHEET: "InventoryUOMConversions",
  ITEMS_SHEET: "InventoryItems",
  LEDGER_SHEET: "InventoryLedger",
  LEGACY_HEADERS: Object.freeze(["ConversionID", "ItemID", "FromUOM", "ToUOM", "Numerator", "Denominator",
    "EffectiveFrom", "EffectiveTo", "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"])
});

function readInventoryConversionSchemaMigrationState(spreadsheet) {
  return { conversions: inventoryConversionSchemaMigrationSnapshot(
      spreadsheet.getSheetByName(INVENTORY_CONVERSION_SCHEMA_MIGRATION.SHEET)),
    items: inventoryMigrationSnapshot(spreadsheet.getSheetByName(INVENTORY_CONVERSION_SCHEMA_MIGRATION.ITEMS_SHEET)),
    ledger: inventoryMigrationSnapshot(spreadsheet.getSheetByName(INVENTORY_CONVERSION_SCHEMA_MIGRATION.LEDGER_SHEET)) };
}

function inventoryConversionSchemaMigrationSnapshot(sheet) {
  var snapshot = inventoryMigrationSnapshot(sheet);
  if (!snapshot.exists) return snapshot;
  var grid = sheet.getRange(1, 1, snapshot.maxRows, snapshot.maxColumns);
  snapshot.hasFormulas = grid.getFormulas().some(function(row) {
    return row.some(function(value) { return !!value; });
  });
  snapshot.hasNotes = grid.getNotes().some(function(row) {
    return row.some(function(value) { return !!value; });
  });
  return snapshot;
}

function inventoryConversionSchemaMigrationFingerprint(state) {
  if (!state || !state.conversions) return inventoryMigrationFingerprint(state);
  var conversions = {};
  Object.keys(state.conversions).forEach(function(key) {
    if (key !== "maxRows" && key !== "maxColumns") conversions[key] = state.conversions[key];
  });
  return inventoryMigrationFingerprint({ conversions: conversions, items: state.items, ledger: state.ledger });
}

function classifyInventoryConversionSchemaState(state) {
  var conversions = state && state.conversions;
  if (!conversions || !conversions.exists || !state.items || !state.items.exists || !state.ledger || !state.ledger.exists) {
    return "REFUSED_MISSING_STORAGE";
  }
  if (inventoryMigrationRows(conversions).length !== 0) return "REFUSED_BUSINESS_ROWS";
  if (conversions.hasFormulas) {
    return "REFUSED_FORMULAS";
  }
  if (conversions.hasNotes) return "REFUSED_NOTES";
  if (inventoryMigrationExactHeaders(conversions, INVENTORY_CONVERSION_SCHEMA_MIGRATION.LEGACY_HEADERS)) return "LEGACY_READY";
  if (inventoryMigrationExactHeaders(conversions, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS)) {
    return "POST_IMAGE";
  }
  return "REFUSED_HEADER_DRIFT";
}

function buildInventoryConversionSchemaMigrationPlan(state) {
  var classification = classifyInventoryConversionSchemaState(state);
  if (classification === "POST_IMAGE") return { status: "ALREADY_MIGRATED", writeCount: 0 };
  if (classification !== "LEGACY_READY") return { status: "REFUSED", reason: classification, writeCount: 0 };
  return { status: "READY", writeCount: 1,
    preservedItemsFingerprint: inventoryMigrationFingerprint(state.items),
    preservedLedgerFingerprint: inventoryMigrationFingerprint(state.ledger) };
}

function inventoryConversionWriteExactHeader(sheet, headers) {
  var difference = headers.length - sheet.getMaxColumns();
  if (difference > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), difference);
  if (difference < 0 && headers.length === INVENTORY_CONVERSION_SCHEMA_MIGRATION.LEGACY_HEADERS.length) {
    sheet.getRange(1, headers.length + 1, 1, -difference).clearContent();
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers.slice()]);
}

function validateInventoryConversionSchemaMigrationAcceptance(before, after) {
  return { status: classifyInventoryConversionSchemaState(after) === "POST_IMAGE" &&
      inventoryMigrationFingerprint(before.items) === inventoryMigrationFingerprint(after.items) &&
      inventoryMigrationFingerprint(before.ledger) === inventoryMigrationFingerprint(after.ledger) ? "PASS" : "FAIL",
    itemsPreserved: inventoryMigrationFingerprint(before.items) === inventoryMigrationFingerprint(after.items),
    ledgerPreserved: inventoryMigrationFingerprint(before.ledger) === inventoryMigrationFingerprint(after.ledger) };
}

function executeInventoryConversionSchemaMigrationWithRuntime(runtime) {
  inventoryMigrationRequireRuntime(runtime);
  var before = readInventoryConversionSchemaMigrationState(runtime.spreadsheet);
  var plan = buildInventoryConversionSchemaMigrationPlan(before);
  if (plan.status !== "READY") return plan;
  var sheet = runtime.spreadsheet.getSheetByName(INVENTORY_CONVERSION_SCHEMA_MIGRATION.SHEET), writes = 0;
  try {
    inventoryConversionWriteExactHeader(sheet, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS); writes = 1;
    runtime.flush();
    var after = readInventoryConversionSchemaMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    var acceptance = validateInventoryConversionSchemaMigrationAcceptance(before, after);
    if (acceptance.status !== "PASS") throw new Error("CONVERSION_SCHEMA_ACCEPTANCE_FAILED");
    return { status: "MIGRATED", writeCount: writes, acceptance: acceptance,
      migrationRecord: { migrationId: INVENTORY_CONVERSION_SCHEMA_MIGRATION.MIGRATION_ID,
        version: INVENTORY_CONVERSION_SCHEMA_MIGRATION.VERSION, preState: before,
        preStateFingerprint: inventoryConversionSchemaMigrationFingerprint(before), acceptedPostState: after,
        postStateFingerprint: inventoryConversionSchemaMigrationFingerprint(after), writeCount: writes } };
  } catch (error) {
    try {
      inventoryConversionWriteExactHeader(sheet, INVENTORY_CONVERSION_SCHEMA_MIGRATION.LEGACY_HEADERS);
      runtime.flush();
      var restored = readInventoryConversionSchemaMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
      if (inventoryConversionSchemaMigrationFingerprint(restored) !==
          inventoryConversionSchemaMigrationFingerprint(before)) throw new Error("RECOVERY_VERIFICATION_FAILED");
      return { status: "FAILED_ROLLED_BACK", reason: error.message, writeCount: writes };
    } catch (rollbackError) {
      return { status: "FAILED_ROLLBACK", reason: error.message, rollbackReason: rollbackError.message, writeCount: writes };
    }
  }
}

function executeInventoryConversionSchemaRecoveryWithRuntime(runtime, record) {
  inventoryMigrationRequireRuntime(runtime);
  if (!record || record.migrationId !== INVENTORY_CONVERSION_SCHEMA_MIGRATION.MIGRATION_ID ||
      record.version !== INVENTORY_CONVERSION_SCHEMA_MIGRATION.VERSION || !record.preState || !record.acceptedPostState ||
      record.preStateFingerprint !== inventoryConversionSchemaMigrationFingerprint(record.preState) ||
      record.postStateFingerprint !== inventoryConversionSchemaMigrationFingerprint(record.acceptedPostState)) {
    return { status: "REFUSED", reason: "INCOMPLETE_OR_UNIDENTIFIED_SNAPSHOT", writeCount: 0 };
  }
  var current = readInventoryConversionSchemaMigrationState(runtime.spreadsheet);
  if (inventoryConversionSchemaMigrationFingerprint(current) !== record.postStateFingerprint ||
      classifyInventoryConversionSchemaState(current) !== "POST_IMAGE") {
    return { status: "REFUSED", reason: "POST_IMAGE_CHANGED_OR_BUSINESS_DATA_PRESENT", writeCount: 0 };
  }
  inventoryConversionWriteExactHeader(runtime.spreadsheet.getSheetByName(INVENTORY_CONVERSION_SCHEMA_MIGRATION.SHEET),
    INVENTORY_CONVERSION_SCHEMA_MIGRATION.LEGACY_HEADERS);
  runtime.flush();
  var restored = readInventoryConversionSchemaMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  return inventoryConversionSchemaMigrationFingerprint(restored) === record.preStateFingerprint ?
    { status: "RECOVERED", writeCount: 1 } : { status: "FAILED_ROLLBACK", reason: "RECOVERY_VERIFICATION_FAILED", writeCount: 1 };
}

function runInventoryConversionSchemaMigration() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeInventoryConversionSchemaMigrationWithRuntime({ mode: INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE,
      spreadsheet: spreadsheet, freshSpreadsheet: function() {
        return resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
      }, flush: function() { SpreadsheetApp.flush(); } });
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function runInventoryConversionSchemaRecovery(record) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeInventoryConversionSchemaRecoveryWithRuntime({ mode: INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE,
      spreadsheet: spreadsheet, freshSpreadsheet: function() {
        return resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
      }, flush: function() { SpreadsheetApp.flush(); } }, record);
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function inventoryConversionDisposableCreateFixture(runtime, canonicalId, owned, label, sourceState, scenario) {
  var token = runtime.createToken(), name = INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_NAME_PREFIX + "Conversion " + label + " " + token;
  var spreadsheet = runtime.createSpreadsheet(name, 1000, INVENTORY_CONVERSION_SCHEMA_MIGRATION.LEGACY_HEADERS.length);
  var ownership = { token: token, spreadsheetId: String(spreadsheet.getId()), spreadsheetName: name };
  owned.push(ownership);
  inventoryDisposableRuntimeProofRequire(ownership.spreadsheetId && ownership.spreadsheetId !== canonicalId &&
    ownership.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
    "conversion disposable identity must differ from production");
  inventoryDisposableRuntimeProofRequire(spreadsheet.getName() === name && spreadsheet.getSheets().length === 1,
    "conversion disposable identity and initial sheet set");
  var conversions = spreadsheet.getSheets()[0];
  conversions.setName(INVENTORY_CONVERSION_SCHEMA_MIGRATION.SHEET);
  var headers = INVENTORY_CONVERSION_SCHEMA_MIGRATION.LEGACY_HEADERS.slice();
  if (scenario === "unexpected-header") headers[0] = "UnexpectedHeader";
  if (scenario === "drift") headers[headers.length - 1] = "UpdatedByDrift";
  if (scenario === "partial") headers = headers.slice(0, headers.length - 1);
  var width = headers.length;
  balanceFoundationResizeDisposableSheet(conversions, 1000, width);
  conversions.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (scenario === "rows") inventoryDisposableAppendValues(conversions, headers.map(function() { return "BUSINESS"; }));
  if (scenario === "formulas") conversions.getRange(1, 1, 1, 1).setFormula("=1");
  [sourceState.items, sourceState.ledger].forEach(function(snapshot, index) {
    var sheet = spreadsheet.insertSheet(index === 0 ? INVENTORY_CONVERSION_SCHEMA_MIGRATION.ITEMS_SHEET :
      INVENTORY_CONVERSION_SCHEMA_MIGRATION.LEDGER_SHEET);
    balanceFoundationResizeDisposableSheet(sheet, snapshot.maxRows, snapshot.maxColumns);
    sheet.getRange(1, 1, snapshot.values.length, snapshot.values[0].length).setValues(snapshot.values);
  });
  runtime.flush();
  return ownership;
}

function inventoryConversionDisposableContext(runtime, ownership) {
  return { mode: INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_MODE, disposableOwnership: ownership,
    spreadsheet: runtime.openById(ownership.spreadsheetId), flush: runtime.flush,
    freshSpreadsheet: function() { return runtime.openById(ownership.spreadsheetId); } };
}

function executeInventoryConversionDisposableRuntimeProofWithRuntime(runtime) {
  var owned = [], failure = null, cleanupFailures = [], result = null, productionBefore = null;
  try {
    var canonical = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
    inventoryDisposableRuntimeProofRequire(canonical && String(canonical.getId()) ===
      NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, "canonical production identity unavailable");
    var productionState = readInventoryConversionSchemaMigrationState(canonical);
    productionBefore = inventoryMigrationFingerprint(productionState);
    inventoryDisposableRuntimeProofRequire(productionState.items.exists && productionState.ledger.exists,
      "production InventoryItems and InventoryLedger unavailable");
    inventoryDisposableRuntimeProofRequire(!(productionState.items.formulas || []).some(function(row) {
      return row.some(function(value) { return !!value; });
    }) && !(productionState.ledger.formulas || []).some(function(row) {
      return row.some(function(value) { return !!value; });
    }), "preserved production storage contains formulas");

    var primary = inventoryConversionDisposableCreateFixture(runtime, canonical.getId(), owned, "Primary", productionState, "legacy");
    var context = inventoryConversionDisposableContext(runtime, primary);
    var before = readInventoryConversionSchemaMigrationState(context.spreadsheet);
    var first = executeInventoryConversionSchemaMigrationWithRuntime(context);
    var fresh = readInventoryConversionSchemaMigrationState(runtime.openById(primary.spreadsheetId));
    inventoryDisposableRuntimeProofRequire(first.status === "MIGRATED" && first.writeCount === 1 &&
      first.acceptance.status === "PASS", "conversion migration and fresh-read acceptance");
    inventoryDisposableRuntimeProofRequire(inventoryMigrationFingerprint(before.items) === inventoryMigrationFingerprint(fresh.items) &&
      inventoryMigrationFingerprint(before.ledger) === inventoryMigrationFingerprint(fresh.ledger),
      "InventoryItems and InventoryLedger preservation");
    var postFingerprint = inventoryMigrationFingerprint(fresh);
    var second = executeInventoryConversionSchemaMigrationWithRuntime(inventoryConversionDisposableContext(runtime, primary));
    inventoryDisposableRuntimeProofRequire(second.status === "ALREADY_MIGRATED" && second.writeCount === 0 &&
      inventoryMigrationFingerprint(readInventoryConversionSchemaMigrationState(runtime.openById(primary.spreadsheetId))) === postFingerprint,
      "conversion exact post-image idempotency");
    var recovery = executeInventoryConversionSchemaRecoveryWithRuntime(
      inventoryConversionDisposableContext(runtime, primary), first.migrationRecord);
    inventoryDisposableRuntimeProofRequire(recovery.status === "RECOVERED" && recovery.writeCount === 1 &&
      inventoryConversionSchemaMigrationFingerprint(
        readInventoryConversionSchemaMigrationState(runtime.openById(primary.spreadsheetId))) ===
        inventoryConversionSchemaMigrationFingerprint(before), "conversion guarded recovery");

    ["rows", "formulas", "drift", "partial", "unexpected-header"].forEach(function(scenario) {
      var invalid = inventoryConversionDisposableCreateFixture(runtime, canonical.getId(), owned,
        "Refusal " + scenario, productionState, scenario);
      var invalidContext = inventoryConversionDisposableContext(runtime, invalid);
      var invalidBefore = inventoryMigrationFingerprint(readInventoryConversionSchemaMigrationState(invalidContext.spreadsheet));
      var refused = executeInventoryConversionSchemaMigrationWithRuntime(invalidContext);
      inventoryDisposableRuntimeProofRequire(refused.status === "REFUSED" && refused.writeCount === 0 &&
        inventoryMigrationFingerprint(readInventoryConversionSchemaMigrationState(invalidContext.spreadsheet)) === invalidBefore,
        scenario + " conversion refusal must be zero-write");
    });

    var item = { ItemID: "ING-PROOF", ItemName: "Proof Item", Classification: "RAW_MATERIAL", BaseUOM: "gr",
      EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true, SourceIngredientID: "ING-PROOF",
      CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
    var conversion = { ConversionID: "CONV-PROOF", ItemID: "ING-PROOF", FromUOM: "bag",
      PackageIdentity: "Proof supplier SKU 1kg bag", SupplierRef: "SUP-PROOF", ToUOM: "gr", Numerator: 1000,
      Denominator: 1, EffectiveFrom: "2026-10-01", EffectiveTo: "", EvidenceType: "PACKAGE_LABEL",
      EvidenceRef: "LABEL-PROOF", EvidenceDate: "2026-09-20", PreparedBy: "PREPARER",
      PreparedAt: "2026-09-21T08:00:00+07:00", ReviewedBy: "REVIEWER",
      ReviewedAt: "2026-09-22T08:00:00+07:00", ApprovalStatus: "APPROVED", ApprovalNote: "",
      IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
    var movement = { ItemID: "ING-PROOF", MovementTimestamp: "2026-10-01T08:00:00+07:00" };
    var readiness = {
      INACTIVE: classifyInventoryConversionReadiness("ING-PROOF", "2026-10-01", [Object.assign({}, item, { IsActive: false })], [conversion]),
      CONFLICT: classifyInventoryConversionReadiness("ING-PROOF", "invalid", [item], [conversion]),
      NEEDS_EVIDENCE: classifyInventoryConversionReadiness("ING-PROOF", "2026-10-01", [item], []),
      VERIFIED: classifyInventoryConversionReadiness("ING-PROOF", "2026-10-01", [item], [conversion])
    };
    Object.keys(readiness).forEach(function(status) {
      inventoryDisposableRuntimeProofRequire(readiness[status].status === status, status + " readiness classification");
    });
    [
      { expected: "INACTIVE", items: [Object.assign({}, item, { IsActive: false })], conversions: [conversion] },
      { expected: "CONFLICT", items: [item], conversions: [Object.assign({}, conversion, { ReviewedBy: "PREPARER" })] },
      { expected: "NEEDS_EVIDENCE", items: [item], conversions: [] }
    ].forEach(function(scenario) {
      var gate = gateInventoryMovementConversion(movement, scenario.items, scenario.conversions);
      inventoryDisposableRuntimeProofRequire(gate.status === "REFUSED" && gate.readiness === scenario.expected,
        scenario.expected + " posting gate refusal");
    });
    var accepted = gateInventoryMovementConversion(movement, [item], [conversion]);
    inventoryDisposableRuntimeProofRequire(accepted.status === "ACCEPTED" && accepted.readiness === "VERIFIED",
      "VERIFIED posting gate acceptance");

    var mockHash = new Array(65).join("a");
    var singleNote = "BASIS=OPERATOR_KNOWN; METHOD=SINGLE_OPERATOR_ATTESTATION_SIGNED_FIRST_PERSON_STATEMENT_" +
      "DETERMINISTIC_ARITHMETIC_RISK_LOW; PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW; " +
      "REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED";
    var single = Object.assign({}, conversion, { ConversionID: "CONV-PROOF-SINGLE", EvidenceType: "OPERATOR_ATTESTATION",
      PackageIdentity: "ING-PROOF|SUP-PROOF|Proof Item|SKU-PROOF|1kg|V01",
      EvidenceRef: "GDRIVE:synthetic_runtime_manifest:V01:SHA256:" + mockHash, EvidenceDate: "2026-09-04",
      PreparedBy: "RUNTIME_OPERATOR", PreparedAt: "2026-09-04T16:00:00+07:00", ReviewedBy: "", ReviewedAt: "",
      ApprovalStatus: "SINGLE_OPERATOR_APPROVED", ApprovalNote: singleNote });
    inventoryDisposableRuntimeProofRequire(validateInventoryUomConversions([single], [item]).status === "PASS" &&
      classifyInventoryConversionReadiness("ING-PROOF", "2026-10-01", [item], [single]).status ===
        "SINGLE_OPERATOR_VERIFIED", "LOW single-operator readiness");
    var singleAccepted = gateInventoryMovementConversion(movement, [item], [single]);
    inventoryDisposableRuntimeProofRequire(singleAccepted.status === "ACCEPTED" &&
      singleAccepted.readiness === "SINGLE_OPERATOR_VERIFIED", "SINGLE_OPERATOR_VERIFIED posting gate acceptance");

    var moderateItem = Object.assign({}, item, { ItemID: "ING-MODERATE", ItemName: "Moderate Item",
      BaseUOM: "ml", SourceIngredientID: "ING-MODERATE" });
    var moderate = Object.assign({}, single, { ConversionID: "CONV-PROOF-MODERATE", ItemID: "ING-MODERATE",
      FromUOM: "gallon", PackageIdentity: "ING-MODERATE|SUP-PROOF|Moderate Item|SKU-PROOF|19L|V01",
      ToUOM: "ml", Numerator: 19000, ApprovalNote: singleNote.replace("RISK_LOW", "RISK_MODERATE") });
    inventoryDisposableRuntimeProofRequire(classifyInventoryConversionReadiness("ING-MODERATE", "2026-10-01",
      [moderateItem], [moderate]).status === "SINGLE_OPERATOR_VERIFIED", "MODERATE single-operator readiness");

    [
      { label: "missing self-approval disclosure", row: Object.assign({}, single, { ConversionID: "CONV-BAD-DISCLOSURE",
        ApprovalNote: singleNote.replace("SELF_APPROVAL_DISCLOSED_", "") }) },
      { label: "missing signed statement", row: Object.assign({}, single, { ConversionID: "CONV-BAD-SIGNATURE",
        ApprovalNote: singleNote.replace("SIGNED_FIRST_PERSON_STATEMENT_", "") }) },
      { label: "missing immutable reference", row: Object.assign({}, single, { ConversionID: "CONV-BAD-REF-MISSING",
        EvidenceRef: "" }) },
      { label: "invalid immutable reference", row: Object.assign({}, single, { ConversionID: "CONV-BAD-REF-INVALID",
        EvidenceRef: "GDRIVE:mutable" }) },
      { label: "invalid chronology", row: Object.assign({}, single, { ConversionID: "CONV-BAD-CHRONOLOGY",
        EvidenceDate: "2026-09-05" }) },
      { label: "same-person independent review", row: Object.assign({}, conversion, { ConversionID: "CONV-BAD-SELF-REVIEW",
        ReviewedBy: "PREPARER" }) }
    ].forEach(function(scenario) {
      var refusedGate = gateInventoryMovementConversion(movement, [item], [scenario.row]);
      inventoryDisposableRuntimeProofRequire(validateInventoryUomConversions([scenario.row], [item]).status === "FAIL" &&
        refusedGate.status === "REFUSED", scenario.label + " refusal");
    });

    var overlap = Object.assign({}, single, { ConversionID: "CONV-PROOF-SINGLE-OVERLAP", EffectiveFrom: "2026-10-15" });
    inventoryDisposableRuntimeProofRequire(classifyInventoryConversionReadiness("ING-PROOF", "2026-10-15",
      [item], [single, overlap]).status === "CONFLICT" && gateInventoryMovementConversion(
        { ItemID: "ING-PROOF", MovementTimestamp: "2026-10-15T08:00:00+07:00" },
        [item], [single, overlap]).status === "REFUSED", "overlapping authority refusal");

    var lemonItem = Object.assign({}, item, { ItemID: "ING-018", ItemName: "Lemon", BaseUOM: "slice",
      SourceIngredientID: "ING-018" });
    var lemon = Object.assign({}, single, { ConversionID: "CONV-PROOF-LEMON", ItemID: "ING-018", FromUOM: "bag",
      PackageIdentity: "ING-018|INTERNAL-FRUIT-SHOP|Lemon|NO-SKU|nominal 1 kg bag|V01",
      SupplierRef: "INTERNAL-FRUIT-SHOP", ToUOM: "slice", Numerator: 21 });
    var lemonReport = validateInventoryUomConversions([lemon], [lemonItem]);
    inventoryDisposableRuntimeProofRequire(lemonReport.status === "FAIL" && lemonReport.errors.some(function(entry) {
      return entry.errors.indexOf("LEMON_MANAGEMENT_STANDARD_REQUIRED") !== -1 &&
        entry.errors.indexOf("HIGH_RISK_SINGLE_OPERATOR_ATTESTATION") !== -1;
    }) && gateInventoryMovementConversion({ ItemID: "ING-018", MovementTimestamp: "2026-10-01T08:00:00+07:00" },
      [lemonItem], [lemon]).status === "REFUSED", "HIGH-risk Lemon attestation refusal");

    var draft = Object.assign({}, single, { ConversionID: "CONV-PROOF-DRAFT", ApprovalStatus: "DRAFT", IsActive: false });
    inventoryDisposableRuntimeProofRequire(gateInventoryMovementConversion(movement, [item], [draft]).status === "REFUSED",
      "DRAFT posting gate refusal");
    inventoryDisposableRuntimeProofRequire(BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED === false,
      "recipe-derived consumption must remain disabled");
    inventoryDisposableRuntimeProofRequire(inventoryMigrationFingerprint(readInventoryConversionSchemaMigrationState(
      resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage))) === productionBefore,
      "production fingerprint changed");
    result = { status: "PASS", productionMutation: false,
      migration: { status: first.status, writeCount: first.writeCount, freshReadAcceptance: first.acceptance.status },
      idempotency: { status: second.status, writeCount: second.writeCount }, recovery: "PASS",
      refusalCoverage: "PASS", readinessClassifier: "PASS", postingGate: "PASS",
      singleOperatorGovernance: { independent: "PASS", low: "PASS", moderate: "PASS", highRisk: "REFUSED",
        lemon: "MANAGEMENT_STANDARD_REQUIRED", incomplete: "REFUSED", conflicts: "REFUSED" },
      preservedStorage: "PASS", recipeAutoConsumption: false, cleanup: "PENDING" };
  } catch (error) { failure = error; }
  finally {
    owned.forEach(function(ownership) {
      try {
        inventoryDisposableRuntimeProofRequire(ownership.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
          "conversion cleanup refused production identity");
        runtime.trashOwnedSpreadsheet(ownership);
        if (!runtime.isOwnedSpreadsheetTrashed(ownership)) throw new Error("trash verification failed");
      } catch (cleanupError) { cleanupFailures.push(ownership.spreadsheetName + ": " + cleanupError.message); }
    });
    if (productionBefore !== null) {
      try {
        var productionAfter = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
        if (!productionAfter || inventoryMigrationFingerprint(readInventoryConversionSchemaMigrationState(productionAfter)) !== productionBefore) {
          throw new Error("production fingerprint changed during conversion proof");
        }
      } catch (productionError) { if (failure) failure.productionFingerprintFailure = productionError.message; else failure = productionError; }
    }
  }
  if (failure) { if (cleanupFailures.length) failure.cleanupFailure = cleanupFailures.join(" | "); throw failure; }
  if (cleanupFailures.length) throw new Error("Disposable conversion cleanup failed: " + cleanupFailures.join(" | "));
  result.cleanup = "PASS";
  return result;
}

function runInventoryConversionDisposableRuntimeProof() {
  var result = executeInventoryConversionDisposableRuntimeProofWithRuntime({
    storage: { openById: function(id) { return SpreadsheetApp.openById(id); } },
    createToken: function() { return new Date().getTime() + "-" + Utilities.getUuid(); },
    createSpreadsheet: function(name, rows, columns) { return SpreadsheetApp.create(name, rows, columns); },
    openById: function(id) { return SpreadsheetApp.openById(id); }, flush: function() { SpreadsheetApp.flush(); },
    trashOwnedSpreadsheet: function(ownership) { DriveApp.getFileById(ownership.spreadsheetId).setTrashed(true); },
    isOwnedSpreadsheetTrashed: function(ownership) { return DriveApp.getFileById(ownership.spreadsheetId).isTrashed(); }
  });
  Logger.log(JSON.stringify(result));
  return result;
}

function inventoryMigrationFingerprint(value) {
  var text = JSON.stringify(value), hash = 2166136261;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function inventoryMigrationSnapshot(sheet) {
  if (!sheet) return { exists: false };
  var values = balanceFoundationSheetSnapshot(sheet);
  var formulas = values.length ? sheet.getRange(1, 1, values.length, values[0].length).getFormulas() : [];
  return { exists: true, values: values, formulas: formulas,
    maxRows: sheet.getMaxRows(), maxColumns: sheet.getMaxColumns() };
}

function readInventorySchemaMigrationState(spreadsheet) {
  return {
    accounts: inventoryMigrationSnapshot(spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_SHEET)),
    ingredients: inventoryMigrationSnapshot(spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.INGREDIENTS_SHEET)),
    recipes: inventoryMigrationSnapshot(spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.RECIPES_SHEET)),
    items: inventoryMigrationSnapshot(spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.ITEMS_SHEET)),
    conversions: inventoryMigrationSnapshot(spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.CONVERSIONS_SHEET)),
    ledger: inventoryMigrationSnapshot(spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.LEDGER_SHEET))
  };
}

function inventoryMigrationRows(snapshot) {
  if (!snapshot || !snapshot.exists || !snapshot.values.length) return [];
  var headers = snapshot.values[0];
  return snapshot.values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== "" && value != null; });
  }).map(function(row) {
    var object = {};
    headers.forEach(function(header, index) { object[header] = row[index]; });
    return object;
  });
}

function inventoryMigrationExactHeaders(snapshot, headers) {
  return !!snapshot && snapshot.exists && snapshot.values.length > 0 &&
    JSON.stringify(snapshot.values[0]) === JSON.stringify(headers) &&
    !(snapshot.formulas || []).some(function(row) { return row.some(function(value) { return !!value; }); });
}

function inventoryMigrationValues(headers, rows) {
  return [headers.slice()].concat(rows.map(function(row) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  }));
}

function inventoryMigrationSourceCandidate(state) {
  var requiredIngredientHeaders = ["ID_Ingredient", "Ingredient", "Category", "BaseUnit", "EffectiveFrom",
    "EffectiveTo", "IsActive", "CreatedAt", "UpdatedAt"];
  var requiredRecipeHeaders = ["ID_Ingredient", "IsActive"];
  if (!state.ingredients.exists || !state.recipes.exists || !state.ingredients.values.length || !state.recipes.values.length ||
      requiredIngredientHeaders.some(function(header) { return state.ingredients.values[0].indexOf(header) === -1; }) ||
      requiredRecipeHeaders.some(function(header) { return state.recipes.values[0].indexOf(header) === -1; }) ||
      !inventoryMigrationExactHeaders(state.ingredients, state.ingredients.values[0]) ||
      !inventoryMigrationExactHeaders(state.recipes, state.recipes.values[0])) {
    return { status: "REFUSED", reason: "SOURCE_DRIFT" };
  }
  var ingredients = inventoryMigrationRows(state.ingredients), recipes = inventoryMigrationRows(state.recipes);
  var activeRecipes = recipes.filter(function(row) { return isCanonicalActive(row.IsActive); });
  var build;
  try { build = buildInventoryItemCandidates(ingredients, recipes); }
  catch (error) { return { status: "REFUSED", reason: "SOURCE_DRIFT", detail: error.message }; }
  var names = {}, duplicateName = false, classificationCounts = {}, uomCounts = {};
  build.rows.forEach(function(row) {
    var name = String(row.ItemName || "").trim().toLowerCase();
    if (!name || names[name]) duplicateName = true;
    names[name] = true;
    classificationCounts[row.Classification] = (classificationCounts[row.Classification] || 0) + 1;
    uomCounts[row.BaseUOM] = (uomCounts[row.BaseUOM] || 0) + 1;
  });
  function exactCounts(actual, expected) {
    var keys = Object.keys(expected);
    return Object.keys(actual).length === keys.length && keys.every(function(key) { return actual[key] === expected[key]; });
  }
  var exactShape = ingredients.length === INVENTORY_SCHEMA_MIGRATION.EXPECTED_ITEM_COUNT &&
    build.rows.length === INVENTORY_SCHEMA_MIGRATION.EXPECTED_ITEM_COUNT &&
    activeRecipes.length === INVENTORY_SCHEMA_MIGRATION.EXPECTED_ACTIVE_RECIPE_COUNT && !duplicateName &&
    exactCounts(classificationCounts, INVENTORY_SCHEMA_MIGRATION.EXPECTED_CLASSIFICATIONS) &&
    exactCounts(uomCounts, INVENTORY_SCHEMA_MIGRATION.EXPECTED_UOMS);
  return exactShape ? { status: "PASS", rows: build.rows } : { status: "REFUSED", reason: "SOURCE_DRIFT" };
}

function inventoryMigrationAccountState(state) {
  if (!inventoryMigrationExactHeaders(state.accounts, INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_HEADERS)) return "INVALID";
  var matches = inventoryMigrationRows(state.accounts).filter(function(row) {
    return String(row.AccountCode || "").trim() === BALANCE_FOUNDATION_POLICY.INVENTORY_ASSET_ACCOUNT.AccountCode;
  });
  if (!matches.length) return "ABSENT";
  return matches.length === 1 && validateInventoryAssetAccountCandidate(matches[0]).status === "PASS" ? "READY" : "CONFLICT";
}

function buildInventorySchemaMigrationPlan(state, timestamp) {
  var source = inventoryMigrationSourceCandidate(state);
  if (source.status !== "PASS") return { status: "REFUSED", reason: source.reason, writeCount: 0 };
  var accountClass = inventoryMigrationAccountState(state);
  if (accountClass === "INVALID" || accountClass === "CONFLICT") {
    return { status: "REFUSED", reason: "ACCOUNT_CONFLICT", writeCount: 0 };
  }
  var expectedItems = inventoryMigrationValues(BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS, source.rows);
  var itemClass = !state.items.exists ? "ABSENT" :
    inventoryMigrationExactHeaders(state.items, BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS) &&
    inventoryMigrationFingerprint(state.items.values) === inventoryMigrationFingerprint(expectedItems) ? "READY" : "COLLISION";
  function headerOnlyClass(snapshot, headers) {
    if (!snapshot.exists) return "ABSENT";
    if (!inventoryMigrationExactHeaders(snapshot, headers)) return "COLLISION";
    return inventoryMigrationRows(snapshot).length === 0 ? "READY" : "BUSINESS_DATA";
  }
  var conversionsClass = headerOnlyClass(state.conversions, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS);
  var ledgerClass = headerOnlyClass(state.ledger, BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS);
  var classes = { accounts: accountClass, inventoryItems: itemClass,
    inventoryUomConversions: conversionsClass, inventoryLedger: ledgerClass };
  if (itemClass === "COLLISION" || conversionsClass === "COLLISION" || ledgerClass === "COLLISION") {
    return { status: "REFUSED", reason: "STORAGE_COLLISION", classifications: classes, writeCount: 0 };
  }
  if (conversionsClass === "BUSINESS_DATA" || ledgerClass === "BUSINESS_DATA") {
    return { status: "REFUSED", reason: "UNEXPECTED_BUSINESS_DATA", classifications: classes, writeCount: 0 };
  }
  var absent = [accountClass, itemClass, conversionsClass, ledgerClass].filter(function(value) { return value === "ABSENT"; }).length;
  if (absent === 0) return { status: "ALREADY_MIGRATED", classifications: classes, writeCount: 0 };
  if (absent !== 4) return { status: "REFUSED", reason: "PARTIAL_OR_MIXED_STATE", classifications: classes, writeCount: 0 };
  var account = Object.assign({ IsActive: true, CreatedAt: timestamp, UpdatedAt: timestamp },
    BALANCE_FOUNDATION_POLICY.INVENTORY_ASSET_ACCOUNT);
  var accountValues = state.accounts.values.concat([INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.map(function(header) {
    return account[header] === undefined ? "" : account[header];
  })]);
  return { status: "READY", classifications: classes, writeCount: 4,
    targetAccounts: accountValues, targetItems: expectedItems };
}

function inventoryMigrationRequireRuntime(runtime) {
  if (!runtime || !runtime.spreadsheet || typeof runtime.spreadsheet.getId !== "function" || typeof runtime.flush !== "function") {
    throw new Error("Inventory migration requires explicit storage and runtime context");
  }
  var id = String(runtime.spreadsheet.getId() || "");
  if (runtime.mode === INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE) {
    if (id !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) throw new Error("Inventory production runtime requires canonical storage");
  } else if (runtime.mode === INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_MODE) {
    if (!runtime.disposableOwnership || id === NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID ||
        id !== String(runtime.disposableOwnership.spreadsheetId || "") ||
        runtime.spreadsheet.getName() !== runtime.disposableOwnership.spreadsheetName) {
      throw new Error("Inventory disposable runtime requires exact non-production ownership");
    }
  } else if (runtime.mode !== INVENTORY_SCHEMA_RUNTIME.TEST_MODE) {
    throw new Error("Inventory migration requires an explicit valid mode");
  }
}

function validateInventorySchemaMigrationAcceptance(before, after, targetItems) {
  var sourceSame = inventoryMigrationFingerprint(before.ingredients) === inventoryMigrationFingerprint(after.ingredients) &&
    inventoryMigrationFingerprint(before.recipes) === inventoryMigrationFingerprint(after.recipes);
  var plan = buildInventorySchemaMigrationPlan(after, "");
  return { status: sourceSame && plan.status === "ALREADY_MIGRATED" &&
    inventoryMigrationFingerprint(after.items.values) === inventoryMigrationFingerprint(targetItems) ? "PASS" : "FAIL",
    sourceUnchanged: sourceSame };
}

function inventoryMigrationRestoreSheet(sheet, snapshot) {
  balanceFoundationRestoreGridDimensions(sheet, snapshot);
  sheet.getDataRange().clearContent();
  if (snapshot.values.length) sheet.getRange(1, 1, snapshot.values.length, snapshot.values[0].length).setValues(snapshot.values);
  (snapshot.formulas || []).forEach(function(row, rowIndex) {
    row.forEach(function(formula, columnIndex) {
      if (formula) sheet.getRange(rowIndex + 1, columnIndex + 1).setFormula(formula);
    });
  });
}

function executeInventorySchemaRecoveryWithRuntime(runtime, record) {
  inventoryMigrationRequireRuntime(runtime);
  var expectedOwned = [INVENTORY_SCHEMA_MIGRATION.ITEMS_SHEET, INVENTORY_SCHEMA_MIGRATION.CONVERSIONS_SHEET,
    INVENTORY_SCHEMA_MIGRATION.LEDGER_SHEET];
  if (!record || record.migrationId !== INVENTORY_SCHEMA_MIGRATION.MIGRATION_ID ||
      record.version !== INVENTORY_SCHEMA_MIGRATION.VERSION || !record.snapshot || !record.acceptedPostState ||
      record.preStateFingerprint !== inventoryMigrationFingerprint(record.snapshot) ||
      record.postStateFingerprint !== inventoryMigrationFingerprint(record.acceptedPostState) ||
      !record.internalRollback && expectedOwned.some(function(name) {
        return !record.createdSheets || record.createdSheets[name] !== true;
      }) ||
      record.snapshot.items.exists || record.snapshot.conversions.exists || record.snapshot.ledger.exists) {
    return { status: "REFUSED", reason: "INCOMPLETE_OR_UNIDENTIFIED_SNAPSHOT", writeCount: 0 };
  }
  var current = readInventorySchemaMigrationState(runtime.spreadsheet);
  if (inventoryMigrationFingerprint(current) !== record.postStateFingerprint) {
    return { status: "REFUSED", reason: "POST_IMAGE_CHANGED_OR_BUSINESS_DATA_PRESENT", writeCount: 0 };
  }
  var writes = 0;
  try {
    inventoryMigrationRestoreSheet(runtime.spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_SHEET),
      record.snapshot.accounts); writes++;
    expectedOwned.forEach(function(name) {
      if (record.createdSheets && record.createdSheets[name]) {
        runtime.spreadsheet.deleteSheet(runtime.spreadsheet.getSheetByName(name)); writes++;
      }
    });
    runtime.flush();
    var restored = readInventorySchemaMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    if (inventoryMigrationFingerprint(restored) !== record.preStateFingerprint) throw new Error("RECOVERY_VERIFICATION_FAILED");
    return { status: "RECOVERED", writeCount: writes };
  } catch (error) { return { status: "FAILED_ROLLBACK", reason: error.message, writeCount: writes }; }
}

function executeInventorySchemaMigrationWithRuntime(runtime) {
  inventoryMigrationRequireRuntime(runtime);
  var before = readInventorySchemaMigrationState(runtime.spreadsheet);
  var plan = buildInventorySchemaMigrationPlan(before, runtime.timestamp);
  if (plan.status !== "READY") return plan;
  var writes = 0, created = {}, record = { migrationId: INVENTORY_SCHEMA_MIGRATION.MIGRATION_ID,
    version: INVENTORY_SCHEMA_MIGRATION.VERSION, timestamp: runtime.timestamp, snapshot: before,
    preStateFingerprint: inventoryMigrationFingerprint(before), writeCount: plan.writeCount };
  try {
    var accounts = runtime.spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_SHEET);
    if (accounts.getMaxRows() < plan.targetAccounts.length) accounts.insertRowsAfter(accounts.getMaxRows(), plan.targetAccounts.length - accounts.getMaxRows());
    balanceFoundationReplaceSheetValues(accounts, plan.targetAccounts); writes++;
    [[INVENTORY_SCHEMA_MIGRATION.ITEMS_SHEET, plan.targetItems],
      [INVENTORY_SCHEMA_MIGRATION.CONVERSIONS_SHEET, [BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.slice()]],
      [INVENTORY_SCHEMA_MIGRATION.LEDGER_SHEET, [BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.slice()]]]
      .forEach(function(target) {
        var sheet = runtime.spreadsheet.insertSheet(target[0]);
        created[target[0]] = true;
        sheet.getRange(1, 1, target[1].length, target[1][0].length).setValues(target[1]); writes++;
      });
    runtime.flush();
    var after = readInventorySchemaMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    var acceptance = validateInventorySchemaMigrationAcceptance(before, after, plan.targetItems);
    if (acceptance.status !== "PASS") throw new Error("INVENTORY_SCHEMA_ACCEPTANCE_FAILED");
    record.createdSheets = created; record.acceptedPostState = after;
    record.postStateFingerprint = inventoryMigrationFingerprint(after);
    return { status: "MIGRATED", writeCount: writes, classifications: plan.classifications,
      acceptance: acceptance, migrationRecord: record };
  } catch (error) {
    record.createdSheets = created; record.internalRollback = true;
    record.acceptedPostState = readInventorySchemaMigrationState(runtime.spreadsheet);
    record.postStateFingerprint = inventoryMigrationFingerprint(record.acceptedPostState);
    var recovery = executeInventorySchemaRecoveryWithRuntime(runtime, record);
    return { status: recovery.status === "RECOVERED" ? "FAILED_ROLLED_BACK" : "FAILED_ROLLBACK",
      reason: error.message, rollback: recovery, writeCount: writes };
  }
}

function inventoryDisposableRuntimeProofRequire(condition, message) {
  if (!condition) throw new Error("Disposable Inventory runtime proof failed: " + message);
}

function inventoryDisposableCreateFixture(runtime, canonicalId, owned, label, sourceState, mutate) {
  var token = runtime.createToken(), name = INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_NAME_PREFIX + label + " " + token;
  var spreadsheet = runtime.createSpreadsheet(name, 1000, INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.length);
  var ownership = { token: token, spreadsheetId: String(spreadsheet.getId()), spreadsheetName: name };
  owned.push(ownership);
  inventoryDisposableRuntimeProofRequire(ownership.spreadsheetId && ownership.spreadsheetId !== canonicalId &&
    ownership.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
    "disposable identity must differ from production");
  inventoryDisposableRuntimeProofRequire(spreadsheet.getName() === name && spreadsheet.getSheets().length === 1,
    "new disposable spreadsheet identity and initial sheet set");
  ["accounts", "ingredients", "recipes"].forEach(function(key, index) {
    var snapshot = sourceState[key], sheet = index === 0 ? spreadsheet.getSheets()[0] : spreadsheet.insertSheet(
      key === "ingredients" ? INVENTORY_SCHEMA_MIGRATION.INGREDIENTS_SHEET : INVENTORY_SCHEMA_MIGRATION.RECIPES_SHEET);
    if (index === 0) sheet.setName(INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_SHEET);
    balanceFoundationResizeDisposableSheet(sheet, snapshot.values.length, snapshot.values[0].length);
    sheet.getRange(1, 1, snapshot.values.length, snapshot.values[0].length).setValues(snapshot.values);
  });
  if (mutate) mutate(spreadsheet);
  runtime.flush();
  return ownership;
}

function inventoryDisposableExecutionContext(runtime, ownership) {
  return { mode: INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_MODE, disposableOwnership: ownership,
    spreadsheet: runtime.openById(ownership.spreadsheetId), timestamp: runtime.timestamp,
    flush: runtime.flush, freshSpreadsheet: function() { return runtime.openById(ownership.spreadsheetId); } };
}

function inventoryDisposableAppendValues(sheet, values) {
  var nextRow = sheet.getLastRow() + 1;
  if (sheet.getMaxRows() < nextRow) sheet.insertRowsAfter(sheet.getMaxRows(), nextRow - sheet.getMaxRows());
  sheet.getRange(nextRow, 1, 1, values.length).setValues([values]);
}

function executeInventoryDisposableRuntimeProofWithRuntime(runtime) {
  var owned = [], failure = null, cleanupFailures = [], result = null, productionBefore = null;
  try {
    var canonical = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
    inventoryDisposableRuntimeProofRequire(canonical && String(canonical.getId()) ===
      NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, "canonical production identity unavailable");
    var sourceState = readInventorySchemaMigrationState(canonical);
    productionBefore = inventoryMigrationFingerprint(sourceState);
    inventoryDisposableRuntimeProofRequire(buildInventorySchemaMigrationPlan(sourceState, runtime.timestamp).status === "READY",
      "production source is not the accepted READY pre-image");

    var primary = inventoryDisposableCreateFixture(runtime, canonical.getId(), owned, "Primary", sourceState);
    var primaryContext = inventoryDisposableExecutionContext(runtime, primary);
    var original = readInventorySchemaMigrationState(primaryContext.spreadsheet);
    var first = executeInventorySchemaMigrationWithRuntime(primaryContext);
    var fresh = readInventorySchemaMigrationState(runtime.openById(primary.spreadsheetId));
    var account1100 = inventoryMigrationRows(fresh.accounts).filter(function(row) {
      return String(row.AccountCode) === BALANCE_FOUNDATION_POLICY.INVENTORY_ASSET_ACCOUNT.AccountCode;
    });
    inventoryDisposableRuntimeProofRequire(first.status === "MIGRATED" && first.writeCount === 4 &&
      first.acceptance.status === "PASS", "first migration and fresh-read acceptance");
    inventoryDisposableRuntimeProofRequire(inventoryMigrationRows(fresh.items).length === 22,
      "InventoryItems exact accepted item count");
    inventoryDisposableRuntimeProofRequire(inventoryMigrationRows(fresh.conversions).length === 0 &&
      inventoryMigrationRows(fresh.ledger).length === 0, "conversion and ledger sheets must remain header-only");
    inventoryDisposableRuntimeProofRequire(account1100.length === 1 &&
      validateInventoryAssetAccountCandidate(account1100[0]).status === "PASS", "Account 1100 taxonomy");
    var beforeSecond = inventoryMigrationFingerprint(fresh);
    var second = executeInventorySchemaMigrationWithRuntime(inventoryDisposableExecutionContext(runtime, primary));
    inventoryDisposableRuntimeProofRequire(second.status === "ALREADY_MIGRATED" && second.writeCount === 0 &&
      inventoryMigrationFingerprint(readInventorySchemaMigrationState(runtime.openById(primary.spreadsheetId))) === beforeSecond,
      "exact second-run idempotency");
    var recovery = executeInventorySchemaRecoveryWithRuntime(
      inventoryDisposableExecutionContext(runtime, primary), first.migrationRecord);
    inventoryDisposableRuntimeProofRequire(recovery.status === "RECOVERED" && recovery.writeCount === 4 &&
      inventoryMigrationFingerprint(readInventorySchemaMigrationState(runtime.openById(primary.spreadsheetId))) ===
        inventoryMigrationFingerprint(original), "exact owned post-image recovery");

    [
      { name: "source drift", mutate: function(ss) { ss.getSheetByName(INVENTORY_SCHEMA_MIGRATION.INGREDIENTS_SHEET)
        .getRange(2, 6, 1, 1).setValues([["kg"]]); } },
      { name: "account conflict", mutate: function(ss) { inventoryDisposableAppendValues(
        ss.getSheetByName(INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_SHEET),
        ["1100", "Conflict", "Liability", "Current Liabilities", "Financing", true, "", "", "CREDIT"]); } },
      { name: "storage collision", mutate: function(ss) { ss.insertSheet(INVENTORY_SCHEMA_MIGRATION.ITEMS_SHEET)
        .getRange(1, 1, 1, 1).setValues([["WrongHeader"]]); } },
      { name: "partial state", mutate: function(ss) { ss.insertSheet(INVENTORY_SCHEMA_MIGRATION.CONVERSIONS_SHEET)
        .getRange(1, 1, 1, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.length)
        .setValues([BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.slice()]); } },
      { name: "business data", mutate: function(ss) { var sheet = ss.insertSheet(INVENTORY_SCHEMA_MIGRATION.LEDGER_SHEET);
        sheet.getRange(1, 1, 2, BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.length).setValues([
          BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.slice(),
          BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.map(function() { return "BUSINESS_DATA"; })]); } }
    ].forEach(function(scenario) {
      var invalid = inventoryDisposableCreateFixture(runtime, canonical.getId(), owned, "Refusal " + scenario.name,
        sourceState, scenario.mutate);
      var context = inventoryDisposableExecutionContext(runtime, invalid);
      var before = inventoryMigrationFingerprint(readInventorySchemaMigrationState(context.spreadsheet));
      var refused = executeInventorySchemaMigrationWithRuntime(context);
      inventoryDisposableRuntimeProofRequire(refused.status === "REFUSED" && refused.writeCount === 0 &&
        inventoryMigrationFingerprint(readInventorySchemaMigrationState(context.spreadsheet)) === before,
        scenario.name + " refusal must be zero-write");
    });

    ["business data", "post-image mutation"].forEach(function(scenario) {
      var changed = inventoryDisposableCreateFixture(runtime, canonical.getId(), owned, "Recovery " + scenario, sourceState);
      var context = inventoryDisposableExecutionContext(runtime, changed);
      var migration = executeInventorySchemaMigrationWithRuntime(context);
      if (scenario === "business data") {
        inventoryDisposableAppendValues(context.spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.LEDGER_SHEET),
          BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.map(function() { return "BUSINESS_DATA"; }));
      } else {
        context.spreadsheet.getSheetByName(INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_SHEET)
          .getRange(2, 2, 1, 1).setValues([["MUTATED"]]);
      }
      runtime.flush();
      var changedFingerprint = inventoryMigrationFingerprint(readInventorySchemaMigrationState(context.spreadsheet));
      var refusedRecovery = executeInventorySchemaRecoveryWithRuntime(context, migration.migrationRecord);
      inventoryDisposableRuntimeProofRequire(refusedRecovery.status === "REFUSED" && refusedRecovery.writeCount === 0 &&
        inventoryMigrationFingerprint(readInventorySchemaMigrationState(context.spreadsheet)) === changedFingerprint,
        scenario + " recovery refusal");
    });

    inventoryDisposableRuntimeProofRequire(inventoryMigrationFingerprint(readInventorySchemaMigrationState(
      resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage))) === productionBefore,
      "production fingerprint changed");
    result = { status: "PASS", productionMutation: false,
      migration: { status: first.status, writeCount: first.writeCount, freshReadAcceptance: first.acceptance.status },
      idempotency: { status: second.status, writeCount: second.writeCount }, recovery: "PASS",
      refusalCoverage: "PASS", inventoryItems: 22, conversions: "HEADER_ONLY", ledger: "HEADER_ONLY",
      account1100: "PASS", cleanup: "PENDING" };
  } catch (error) { failure = error; }
  finally {
    owned.forEach(function(ownership) {
      try {
        inventoryDisposableRuntimeProofRequire(ownership.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
          "cleanup refused production identity");
        runtime.trashOwnedSpreadsheet(ownership);
        if (!runtime.isOwnedSpreadsheetTrashed(ownership)) throw new Error("trash verification failed");
      } catch (cleanupError) { cleanupFailures.push(ownership.spreadsheetName + ": " + cleanupError.message); }
    });
    if (productionBefore !== null) {
      try {
        var productionAfter = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
        if (!productionAfter || inventoryMigrationFingerprint(readInventorySchemaMigrationState(productionAfter)) !== productionBefore) {
          throw new Error("production fingerprint changed during proof");
        }
      } catch (productionError) { if (failure) failure.productionFingerprintFailure = productionError.message; else failure = productionError; }
    }
  }
  if (failure) { if (cleanupFailures.length) failure.cleanupFailure = cleanupFailures.join(" | "); throw failure; }
  if (cleanupFailures.length) throw new Error("Disposable Inventory cleanup failed: " + cleanupFailures.join(" | "));
  result.cleanup = "PASS";
  return result;
}

function runInventoryDisposableRuntimeProof() {
  return runInventoryConversionDisposableRuntimeProof();
}

function runInventorySchemaMigration() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeInventorySchemaMigrationWithRuntime({ mode: INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE,
      spreadsheet: spreadsheet,
      freshSpreadsheet: function() { return resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } }); },
      flush: function() { SpreadsheetApp.flush(); }, timestamp: new Date() });
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function runInventorySchemaRecovery(migrationRecord) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeInventorySchemaRecoveryWithRuntime({ mode: INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE,
      spreadsheet: spreadsheet,
      freshSpreadsheet: function() { return resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } }); },
      flush: function() { SpreadsheetApp.flush(); } }, migrationRecord);
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

// Pure prospective quantity conversion; confers no opening, valuation, or posting permission.
function convertInventoryLemonOperationalQuantity(quantity, fromUom, postingDate, items, conversions) {
  var readiness = classifyInventoryConversionReadiness("ING-018", postingDate, items, conversions);
  if (readiness.status !== "SINGLE_OPERATOR_VERIFIED" || fromUom !== "gr" ||
      quantity === "" || quantity == null || typeof quantity === "boolean" ||
      !isFinite(Number(quantity)) || Number(quantity) < 0) {
    return { status: "REFUSED", readiness: readiness.status, quantity: null, writeCount: 0 };
  }
  return { status: "ACCEPTED", quantity: Number(quantity) * readiness.conversion.Numerator /
    readiness.conversion.Denominator, baseUom: "slice", evidenceClassification: "MANAGEMENT_OPERATIONAL_STANDARD",
    physicalObservation: false, writeCount: 0 };
}
