var CAPITAL_EQUITY_POLICY = Object.freeze({
  OWNERS: Object.freeze(["Dekker", "Erway"]),
  OWNERSHIP_PERCENTAGES: Object.freeze({ Dekker: 50, Erway: 50 }),
  TYPES: Object.freeze(["OWNER_CONTRIBUTION", "RETURN_OF_CAPITAL", "OWNER_DRAW"]),
  SOURCE: "LEGACY_XLSM_MIGRATION",
  HEADERS: Object.freeze(["ID_Trx", "Tanggal", "Owner", "Type", "Nominal", "Keterangan", "Source",
    "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  TYPE_ACCOUNTS: Object.freeze({
    OWNER_CONTRIBUTION: "3000",
    RETURN_OF_CAPITAL: "3100",
    OWNER_DRAW: "3100"
  }),
  PROFIT_AND_LOSS_EFFECT: "NONE",
  CASH_EFFECT: "NONE"
});

var FINANCE_OPENING_BALANCE_POLICY = Object.freeze({
  SHEET: "FinanceOpeningBalances",
  HEADERS: Object.freeze(["ID", "EffectiveDate", "AccountCode", "Amount", "Source", "Keterangan",
    "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  RETAINED_EARNINGS_ACCOUNT: "3200",
  EFFECTIVE_DATE: "2026-07-31",
  POST_CUTOFF_PROFIT_AND_LOSS_START: "2026-08-01",
  AMOUNT: 7407000
});

function financeOpeningBalancesSheetMetadata(ss) {
  return ss.getSheets().map(function(sheet) {
    return { name: sheet.getName(), lastRow: sheet.getLastRow(), lastColumn: sheet.getLastColumn() };
  });
}

function requireExactFinanceOpeningBalancesHeaders(sheet) {
  if (!sheet || sheet.getLastColumn() !== FINANCE_OPENING_BALANCE_POLICY.HEADERS.length) {
    throw new Error("FinanceOpeningBalances has incompatible schema");
  }
  var actual = sheet.getRange(1, 1, 1, FINANCE_OPENING_BALANCE_POLICY.HEADERS.length)
    .getValues()[0].map(function(value) { return String(value); });
  if (JSON.stringify(actual) !== JSON.stringify(FINANCE_OPENING_BALANCE_POLICY.HEADERS)) {
    throw new Error("FinanceOpeningBalances has incompatible schema");
  }
}

function initializeFinanceOpeningBalancesSchemaWithRuntime(ss, flush) {
  var before = financeOpeningBalancesSheetMetadata(ss);
  var sheet = ss.getSheetByName(FINANCE_OPENING_BALANCE_POLICY.SHEET);
  var created = false;
  if (sheet) {
    requireExactFinanceOpeningBalancesHeaders(sheet);
    return { status: "PASS", sheet: FINANCE_OPENING_BALANCE_POLICY.SHEET,
      headers: FINANCE_OPENING_BALANCE_POLICY.HEADERS.slice(), dataRows: Math.max(0, sheet.getLastRow() - 1),
      created: false, writeCount: 0 };
  }

  sheet = ss.insertSheet(FINANCE_OPENING_BALANCE_POLICY.SHEET);
  sheet.getRange(1, 1, 1, FINANCE_OPENING_BALANCE_POLICY.HEADERS.length)
    .setValues([FINANCE_OPENING_BALANCE_POLICY.HEADERS.slice()]);
  created = true;
  flush();

  var after = financeOpeningBalancesSheetMetadata(ss);
  sheet = ss.getSheetByName(FINANCE_OPENING_BALANCE_POLICY.SHEET);
  requireExactFinanceOpeningBalancesHeaders(sheet);
  var dataRows = Math.max(0, sheet.getLastRow() - 1);
  if (!sheet || dataRows !== 0) throw new Error("FinanceOpeningBalances schema initialization verification failed");
  var unchangedBefore = before.filter(function(item) { return item.name !== FINANCE_OPENING_BALANCE_POLICY.SHEET; });
  var unchangedAfter = after.filter(function(item) { return item.name !== FINANCE_OPENING_BALANCE_POLICY.SHEET; });
  if (JSON.stringify(unchangedAfter) !== JSON.stringify(unchangedBefore)) {
    throw new Error("FinanceOpeningBalances schema initialization changed unrelated sheet metadata");
  }
  return { status: "PASS", sheet: FINANCE_OPENING_BALANCE_POLICY.SHEET,
    headers: FINANCE_OPENING_BALANCE_POLICY.HEADERS.slice(), dataRows: dataRows,
    created: created, writeCount: 1 };
}

function initializeFinanceOpeningBalancesSchema() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var result = initializeFinanceOpeningBalancesSchemaWithRuntime(
      SpreadsheetApp.getActiveSpreadsheet(), function() { SpreadsheetApp.flush(); });
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function capitalEquityDateKey(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return canonicalDateKey(value);
  var match = String(value == null ? "" : value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  var date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ?
    match[1] + "-" + match[2] + "-" + match[3] : null;
}

function capitalEquityAccountCode(type) {
  return CAPITAL_EQUITY_POLICY.TYPE_ACCOUNTS[String(type || "").trim()] || null;
}

function capitalEquityLogicalKey(row) {
  return capitalEquityDateKey(row && row.Tanggal) + "|" + String(row && row.Owner || "").trim() + "|" +
    String(row && row.Type || "").trim();
}

function validateCapitalEquityRow(row) {
  var owner = String(row && row.Owner || "").trim();
  var type = String(row && row.Type || "").trim();
  var nominal = Number(row && row.Nominal);
  var source = String(row && row.Source || "").trim();
  var errors = [];
  if (CAPITAL_EQUITY_POLICY.OWNERS.indexOf(owner) === -1) errors.push("INVALID_OWNER");
  if (CAPITAL_EQUITY_POLICY.TYPES.indexOf(type) === -1) errors.push("INVALID_TYPE");
  if (!isFinite(nominal) || nominal <= 0 || Math.round(nominal) !== nominal) errors.push("INVALID_NOMINAL");
  if (!capitalEquityDateKey(row && row.Tanggal)) errors.push("INVALID_DATE");
  if (source !== CAPITAL_EQUITY_POLICY.SOURCE) errors.push("INVALID_SOURCE");
  return { errors: errors, owner: owner, type: type, nominal: nominal,
    dateKey: capitalEquityDateKey(row && row.Tanggal), source: source };
}

function capitalEquityCandidate(id, date, owner, type, nominal, note) {
  return { ID_Trx: id, Tanggal: date, Owner: owner, Type: type, Nominal: nominal,
    Keterangan: note, Source: CAPITAL_EQUITY_POLICY.SOURCE, IsActive: true,
    CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "",
    AccountCode: capitalEquityAccountCode(type) };
}

function buildCapitalEquityMigrationCandidates() {
  var rows = [];
  CAPITAL_EQUITY_POLICY.OWNERS.forEach(function(owner) {
    rows.push(capitalEquityCandidate("CE-20210101-" + owner.toUpperCase() + "-CONTRIBUTION", "2021-01-01",
      owner, "OWNER_CONTRIBUTION", 10635000,
      "Migrated opening balance; historical payment date unavailable."));
  });
  [
    ["2023-11-02", 5000000],
    ["2024-02-01", 135000],
    ["2024-04-01", 3000000],
    ["2024-07-01", 2500000]
  ].forEach(function(movement) {
    CAPITAL_EQUITY_POLICY.OWNERS.forEach(function(owner) {
      rows.push(capitalEquityCandidate("CE-" + movement[0].replace(/-/g, "") + "-" + owner.toUpperCase() + "-RETURN",
        movement[0], owner, "RETURN_OF_CAPITAL", movement[1], "Migrated historical return of capital."));
    });
  });
  return rows;
}

function buildRetainedEarningsOpeningCandidate() {
  return { ID: "FOB-3200-20260731", EffectiveDate: FINANCE_OPENING_BALANCE_POLICY.EFFECTIVE_DATE,
    AccountCode: FINANCE_OPENING_BALANCE_POLICY.RETAINED_EARNINGS_ACCOUNT,
    Amount: FINANCE_OPENING_BALANCE_POLICY.AMOUNT, Source: CAPITAL_EQUITY_POLICY.SOURCE,
    Keterangan: "Migrated retained earnings opening balance through 2026-07-31; post-cutoff P&L starts 2026-08-01.",
    IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
}

function buildRetainedEarningsBalance(openingRows, profitAndLossPeriods, asOfDate) {
  var asOf = capitalEquityDateKey(asOfDate);
  if (!asOf) throw new Error("Retained earnings requires a valid as-of date");
  var openingAmount = 0, postCutoffProfitAndLoss = 0, excludedInactiveRows = 0;
  (openingRows || []).forEach(function(row) {
    if (!isCanonicalActive(row.IsActive)) { excludedInactiveRows++; return; }
    var effective = capitalEquityDateKey(row.EffectiveDate);
    if (!effective || String(row.AccountCode || "").trim() !== "3200" ||
        String(row.Source || "").trim() !== CAPITAL_EQUITY_POLICY.SOURCE ||
        !isFinite(Number(row.Amount)) || Math.round(Number(row.Amount)) !== Number(row.Amount)) {
      throw new Error("Invalid FinanceOpeningBalances retained earnings row");
    }
    if (effective <= asOf) openingAmount += Number(row.Amount);
  });
  (profitAndLossPeriods || []).forEach(function(period) {
    var start = capitalEquityDateKey(period.startDate), end = capitalEquityDateKey(period.endDate);
    var amount = Number(period.amount);
    if (!start || !end || start > end || start < FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START ||
        !isFinite(amount)) throw new Error("Invalid post-cutoff retained earnings P&L period");
    if (end <= asOf) postCutoffProfitAndLoss += amount;
  });
  return { openingAmount: openingAmount, postCutoffProfitAndLoss: postCutoffProfitAndLoss,
    retainedEarnings: openingAmount + postCutoffProfitAndLoss, excludedInactiveRows: excludedInactiveRows,
    asOfDate: asOf };
}

function buildCapitalEquitySummary(rows, period) {
  var start = capitalEquityDateKey(period && period.startDate);
  var end = capitalEquityDateKey(period && period.endDate);
  if (!start || !end || start > end) throw new Error("CapitalEquity requires a valid inclusive period");
  var summary = { ownerContributions: 0, returnOfCapital: 0, ownerDraws: 0,
    closingContributedCapital: 0, netEquityMovement: 0, excludedInactiveRows: 0, byOwner: {} };
  CAPITAL_EQUITY_POLICY.OWNERS.forEach(function(owner) {
    summary.byOwner[owner] = { ownerContributions: 0, returnOfCapital: 0, ownerDraws: 0,
      closingContributedCapital: 0, netEquityMovement: 0 };
  });
  (rows || []).forEach(function(row) {
    if (!isCanonicalActive(row.IsActive)) { summary.excludedInactiveRows++; return; }
    var valid = validateCapitalEquityRow(row);
    if (valid.errors.length) throw new Error("Invalid CapitalEquity row: " + valid.errors.join(","));
    if (valid.dateKey < start || valid.dateKey > end) return;
    var owner = summary.byOwner[valid.owner];
    if (valid.type === "OWNER_CONTRIBUTION") owner.ownerContributions += valid.nominal;
    if (valid.type === "RETURN_OF_CAPITAL") owner.returnOfCapital += valid.nominal;
    if (valid.type === "OWNER_DRAW") owner.ownerDraws += valid.nominal;
  });
  CAPITAL_EQUITY_POLICY.OWNERS.forEach(function(ownerName) {
    var owner = summary.byOwner[ownerName];
    owner.closingContributedCapital = owner.ownerContributions - owner.returnOfCapital;
    owner.netEquityMovement = owner.closingContributedCapital - owner.ownerDraws;
    summary.ownerContributions += owner.ownerContributions;
    summary.returnOfCapital += owner.returnOfCapital;
    summary.ownerDraws += owner.ownerDraws;
    summary.closingContributedCapital += owner.closingContributedCapital;
    summary.netEquityMovement += owner.netEquityMovement;
  });
  return summary;
}

function findCapitalEquityDuplicates(rows) {
  var ids = {}, keys = {}, duplicateIds = {}, duplicateKeys = {};
  (rows || []).forEach(function(row) {
    var id = String(row.ID_Trx || "").trim(), key = capitalEquityLogicalKey(row);
    if (ids[id]) duplicateIds[id] = true;
    if (keys[key]) duplicateKeys[key] = true;
    ids[id] = true; keys[key] = true;
  });
  return { ids: Object.keys(duplicateIds).sort(), logicalKeys: Object.keys(duplicateKeys).sort() };
}

function buildCapitalEquityReadModel(rows, openingRows, accounts, asOfDate, postCutoffProfit) {
  var asOf = capitalEquityDateKey(asOfDate);
  if (!asOf) throw new Error("Capital & Equity requires a valid as-of date");

  var activeRows = (rows || []).filter(function(row) { return isCanonicalActive(row.IsActive); });
  var duplicates = findCapitalEquityDuplicates(activeRows);
  var invalidRows = [], unresolvedAccountMappings = [];
  var accountMap = {};
  (accounts || []).forEach(function(account) {
    var code = String(account.AccountCode || "").trim();
    if (code) accountMap[code] = account;
  });
  activeRows.forEach(function(row) {
    var validation = validateCapitalEquityRow(row);
    if (validation.errors.length) {
      invalidRows.push({ id: String(row.ID_Trx || ""), errors: validation.errors.slice() });
      return;
    }
    var code = capitalEquityAccountCode(validation.type), account = accountMap[code];
    if (!account || !isCanonicalActive(account.IsActive) || String(account.AccountType || "").trim() !== "Equity") {
      unresolvedAccountMappings.push({ id: String(row.ID_Trx || ""), type: validation.type, accountCode: code });
    }
  });

  var activeOpenings = (openingRows || []).filter(function(row) { return isCanonicalActive(row.IsActive); });
  var invalidOpeningBalances = [];
  activeOpenings.forEach(function(row) {
    var errors = [], amount = Number(row.Amount);
    var effectiveDate = capitalEquityDateKey(row.EffectiveDate);
    if (!effectiveDate) errors.push("INVALID_DATE");
    else if (effectiveDate !== FINANCE_OPENING_BALANCE_POLICY.EFFECTIVE_DATE) errors.push("EFFECTIVE_DATE_MISMATCH");
    if (String(row.AccountCode || "").trim() !== FINANCE_OPENING_BALANCE_POLICY.RETAINED_EARNINGS_ACCOUNT) {
      errors.push("ACCOUNT_CODE_MISMATCH");
    }
    if (!isFinite(amount) || Math.round(amount) !== amount) errors.push("INVALID_AMOUNT");
    if (String(row.Source || "").trim() !== CAPITAL_EQUITY_POLICY.SOURCE) errors.push("INVALID_SOURCE");
    if (errors.length) invalidOpeningBalances.push({ id: String(row.ID || ""), errors: errors });
  });
  var retainedOpenings = activeOpenings.filter(function(row) {
    return String(row.AccountCode || "").trim() === FINANCE_OPENING_BALANCE_POLICY.RETAINED_EARNINGS_ACCOUNT;
  });
  var duplicateOpeningBalances = retainedOpenings.length > 1 ? retainedOpenings.map(function(row) {
    return String(row.ID || "");
  }) : [];
  var retainedAccount = accountMap[FINANCE_OPENING_BALANCE_POLICY.RETAINED_EARNINGS_ACCOUNT];
  if (!retainedAccount || !isCanonicalActive(retainedAccount.IsActive) ||
      String(retainedAccount.AccountType || "").trim() !== "Equity") {
    unresolvedAccountMappings.push({ type: "RETAINED_EARNINGS", accountCode: "3200" });
  }
  var retainedEstablished = asOf >= FINANCE_OPENING_BALANCE_POLICY.EFFECTIVE_DATE;

  var quality = {
    duplicateIds: duplicates.ids,
    duplicateLogicalKeys: duplicates.logicalKeys,
    invalidRows: invalidRows,
    unresolvedAccountMappings: unresolvedAccountMappings,
    duplicateOpeningBalances: duplicateOpeningBalances,
    missingOpeningBalance: retainedEstablished && retainedOpenings.length === 0,
    invalidOpeningBalances: invalidOpeningBalances,
    excludedInactiveRows: (rows || []).length - activeRows.length,
    excludedInactiveOpeningBalances: (openingRows || []).length - activeOpenings.length,
    preCutoffProfitAndLossIncluded: false
  };
  if (duplicates.ids.length || duplicates.logicalKeys.length || invalidRows.length ||
      unresolvedAccountMappings.length || duplicateOpeningBalances.length || invalidOpeningBalances.length ||
      quality.missingOpeningBalance) {
    throw new Error("Invalid authoritative Capital & Equity data: " + JSON.stringify(quality));
  }

  var movements = buildCapitalEquitySummary(activeRows, { startDate: "1000-01-01", endDate: asOf });
  var retainedOpening = retainedEstablished ? Number(retainedOpenings[0].Amount) : null;
  var retainedPostCutoffProfit = retainedEstablished ? Number(postCutoffProfit || 0) : null;
  if (retainedEstablished && (!isFinite(retainedPostCutoffProfit) ||
      asOf === FINANCE_OPENING_BALANCE_POLICY.EFFECTIVE_DATE && retainedPostCutoffProfit !== 0)) {
    throw new Error("Invalid post-cutoff Finance P&L for retained earnings");
  }
  var retainedEarnings = retainedEstablished ? retainedOpening + retainedPostCutoffProfit : null;
  var owners = CAPITAL_EQUITY_POLICY.OWNERS.map(function(ownerName) {
    var owner = movements.byOwner[ownerName];
    return { owner: ownerName, ownerContributions: owner.ownerContributions,
      returnOfCapital: owner.returnOfCapital, ownerDraws: owner.ownerDraws,
      contributedCapital: owner.closingContributedCapital };
  });
  return {
    asOfDate: asOf,
    owners: owners,
    ownerContributions: movements.ownerContributions,
    returnOfCapital: movements.returnOfCapital,
    ownerDraws: movements.ownerDraws,
    contributedCapital: movements.closingContributedCapital,
    retainedEarnings: retainedEarnings,
    totalEquity: retainedEstablished ? movements.closingContributedCapital + retainedEarnings - movements.ownerDraws : null,
    retainedEarningsOpening: retainedOpening,
    retainedEarningsPostCutoffProfit: retainedPostCutoffProfit,
    retainedEarningsStatus: retainedEstablished ? "ESTABLISHED" : "NOT_ESTABLISHED",
    accountingPolicy: { recognition: "AS_OF_TANGGAL", profitAndLossEffect: "NONE", cashEffect: "NONE",
      retainedEarningsOpeningDate: FINANCE_OPENING_BALANCE_POLICY.EFFECTIVE_DATE,
      postCutoffProfitAndLossStarts: FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START,
      totalEquityFormula: "CONTRIBUTED_CAPITAL_PLUS_RETAINED_EARNINGS_MINUS_OWNER_DRAW" },
    dataQuality: quality
  };
}

function buildCapitalEquityMigrationDryRun(existingRows, accounts) {
  var candidates = buildCapitalEquityMigrationCandidates();
  var opening = buildRetainedEarningsOpeningCandidate();
  var invalidRows = candidates.filter(function(row) { return validateCapitalEquityRow(row).errors.length; });
  var duplicates = findCapitalEquityDuplicates((existingRows || []).concat(candidates));
  var accountMap = {};
  (accounts || []).forEach(function(account) {
    if (isCanonicalActive(account.IsActive) && String(account.AccountType || "").trim() === "Equity") {
      accountMap[String(account.AccountCode || "").trim()] = true;
    }
  });
  var missingAccounts = ["3000", "3100", "3200"].filter(function(code) { return !accountMap[code]; });
  var totals = buildCapitalEquitySummary(candidates, { startDate: "2021-01-01", endDate: "2024-12-31" });
  var openingValid = opening.ID === "FOB-3200-20260731" && capitalEquityDateKey(opening.EffectiveDate) &&
    opening.AccountCode === "3200" && opening.Amount === 7407000 && opening.Source === CAPITAL_EQUITY_POLICY.SOURCE &&
    isCanonicalActive(opening.IsActive);
  var reconciliationPass = totals.ownerContributions === 21270000 && totals.returnOfCapital === 21270000 &&
    totals.ownerDraws === 0 && totals.closingContributedCapital === 0;
  var status = !(existingRows || []).length && !invalidRows.length && !duplicates.ids.length &&
    !duplicates.logicalKeys.length && !missingAccounts.length && openingValid && reconciliationPass ? "PASS" : "FAIL";
  return { status: status, readOnly: true, writeCount: 0, existingCapitalEquityRows: (existingRows || []).length,
    capitalEquityRows: candidates, openingBalanceRows: [opening], totals: totals, byOwner: totals.byOwner,
    ownershipPercentages: CAPITAL_EQUITY_POLICY.OWNERSHIP_PERCENTAGES,
    duplicateIds: duplicates.ids, duplicateLogicalKeys: duplicates.logicalKeys,
    invalidCandidateRows: invalidRows.length, missingAccountCodes: missingAccounts,
    reconciliationPass: reconciliationPass, openingBalanceValid: Boolean(openingValid), accountingPolicy: {
      recognition: "Tanggal", profitAndLossEffect: CAPITAL_EQUITY_POLICY.PROFIT_AND_LOSS_EFFECT,
      cashEffect: CAPITAL_EQUITY_POLICY.CASH_EFFECT,
      retainedEarningsLedger: FINANCE_OPENING_BALANCE_POLICY.SHEET,
      retainedEarningsCutoff: FINANCE_OPENING_BALANCE_POLICY.EFFECTIVE_DATE,
      postCutoffProfitAndLossStarts: FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START
    } };
}

function validateCapitalEquityMigrationDryRun() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = readCanonicalTable(ss, "CapitalEquity", CAPITAL_EQUITY_POLICY.HEADERS);
  var accounts = readCanonicalTable(ss, "Accounts", ["AccountCode", "AccountName", "AccountType",
    "StatementGroup", "CashFlowGroup", "IsActive"]);
  var report = buildCapitalEquityMigrationDryRun(existing, accounts);
  Logger.log(JSON.stringify({ status: report.status, readOnly: report.readOnly, writeCount: report.writeCount,
    existingCapitalEquityRows: report.existingCapitalEquityRows,
    capitalEquityCandidateRows: report.capitalEquityRows.length,
    openingBalanceCandidateRows: report.openingBalanceRows.length,
    totals: report.totals, duplicateIds: report.duplicateIds,
    duplicateLogicalKeys: report.duplicateLogicalKeys, missingAccountCodes: report.missingAccountCodes,
    reconciliationPass: report.reconciliationPass, openingBalanceValid: report.openingBalanceValid }));
  if (report.status !== "PASS") throw new Error("CapitalEquity migration dry-run validation failed");
  return report;
}

function requireExactMigrationSheetHeaders(sheet, name, headers) {
  if (!sheet || sheet.getLastColumn() !== headers.length || sheet.getLastRow() < 1) {
    throw new Error(name + " has incompatible schema");
  }
  var actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(function(value) {
    return String(value);
  });
  if (JSON.stringify(actual) !== JSON.stringify(headers)) {
    throw new Error(name + " has incompatible schema");
  }
}

function migrationRowsToObjects(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues().filter(function(row) {
    return row.some(function(value) { return value !== "" && value != null; });
  }).map(function(row) {
    var record = {};
    headers.forEach(function(header, index) { record[header] = row[index]; });
    return record;
  });
}

function migrationObjectsToRows(rows, headers, timestamp, user) {
  return rows.map(function(source) {
    var row = Object.assign({}, source, {
      CreatedAt: timestamp, CreatedBy: user, UpdatedAt: timestamp, UpdatedBy: user
    });
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  });
}

function validateCapitalEquityMigrationAcceptance(capitalRows, openingRows, accounts) {
  var dryRun = buildCapitalEquityMigrationDryRun([], accounts);
  var duplicates = findCapitalEquityDuplicates(capitalRows);
  var invalidRows = capitalRows.filter(function(row) {
    return validateCapitalEquityRow(row).errors.length;
  });
  var totals;
  try {
    totals = buildCapitalEquitySummary(capitalRows, { startDate: "2021-01-01", endDate: "2024-12-31" });
  } catch (error) {
    totals = null;
  }
  var contributions = capitalRows.filter(function(row) { return row.Type === "OWNER_CONTRIBUTION"; });
  var returns = capitalRows.filter(function(row) { return row.Type === "RETURN_OF_CAPITAL"; });
  var draws = capitalRows.filter(function(row) { return row.Type === "OWNER_DRAW"; });
  var hendy = capitalRows.filter(function(row) { return String(row.Owner || "").trim() === "Hendy"; });
  var opening = openingRows[0] || {};
  var candidateFields = ["ID_Trx", "Tanggal", "Owner", "Type", "Nominal", "Keterangan", "Source", "IsActive"];
  var physicalCandidates = capitalRows.map(function(row) {
    return candidateFields.map(function(field) {
      return field === "Tanggal" ? capitalEquityDateKey(row[field]) : row[field];
    });
  });
  var expectedCandidates = dryRun.capitalEquityRows.map(function(row) {
    return candidateFields.map(function(field) { return row[field]; });
  });
  var exactCandidates = JSON.stringify(physicalCandidates) === JSON.stringify(expectedCandidates);
  var openingValid = openingRows.length === 1 && String(opening.ID || "").trim() === "FOB-3200-20260731" &&
    capitalEquityDateKey(opening.EffectiveDate) === "2026-07-31" &&
    String(opening.AccountCode || "").trim() === "3200" && Number(opening.Amount) === 7407000 &&
    String(opening.Source || "").trim() === CAPITAL_EQUITY_POLICY.SOURCE && isCanonicalActive(opening.IsActive);
  var exact = exactCandidates && capitalRows.length === 10 && contributions.length === 2 && returns.length === 8 &&
    draws.length === 0 && hendy.length === 0 && invalidRows.length === 0 &&
    duplicates.ids.length === 0 && duplicates.logicalKeys.length === 0 && totals &&
    totals.ownerContributions === 21270000 && totals.returnOfCapital === 21270000 &&
    totals.ownerDraws === 0 && totals.closingContributedCapital === 0 &&
    totals.byOwner.Dekker.closingContributedCapital === 0 &&
    totals.byOwner.Erway.closingContributedCapital === 0 && openingValid;
  return { status: exact && dryRun.status === "PASS" ? "PASS" : "FAIL", totals: totals,
    duplicateIds: duplicates.ids, duplicateLogicalKeys: duplicates.logicalKeys,
    invalidRows: invalidRows.length, openingBalanceValid: openingValid };
}

function rollbackCapitalEquityMigrationAttempt(state, flush) {
  var failures = [];
  [{ sheet: state.capitalSheet, lastRow: state.capitalLastRow, name: "CapitalEquity" },
    { sheet: state.openingSheet, lastRow: state.openingLastRow, name: "FinanceOpeningBalances" }]
    .forEach(function(target) {
      try {
        var appended = target.sheet.getLastRow() - target.lastRow;
        if (appended > 0) target.sheet.deleteRows(target.lastRow + 1, appended);
      } catch (error) { failures.push(target.name + ": " + error.message); }
    });
  try { flush(); } catch (error) { failures.push("flush: " + error.message); }
  if (state.capitalSheet.getLastRow() !== state.capitalLastRow ||
      state.openingSheet.getLastRow() !== state.openingLastRow) failures.push("row boundary verification failed");
  if (failures.length) throw new Error("HARD FAILURE — migration rollback failed: " + failures.join("; "));
}

function executeCapitalEquityMigrationWithRuntime(runtime) {
  var ss = runtime.spreadsheet;
  var capitalSheet = ss.getSheetByName("CapitalEquity");
  var openingSheet = ss.getSheetByName(FINANCE_OPENING_BALANCE_POLICY.SHEET);
  requireExactMigrationSheetHeaders(capitalSheet, "CapitalEquity", CAPITAL_EQUITY_POLICY.HEADERS);
  requireExactMigrationSheetHeaders(openingSheet, FINANCE_OPENING_BALANCE_POLICY.SHEET,
    FINANCE_OPENING_BALANCE_POLICY.HEADERS);
  var state = { capitalSheet: capitalSheet, openingSheet: openingSheet,
    capitalLastRow: capitalSheet.getLastRow(), openingLastRow: openingSheet.getLastRow() };
  if (state.capitalLastRow !== 1 || state.openingLastRow !== 1) {
    return { status: "REFUSED", reason: "TARGET_ALREADY_POPULATED", writeCount: 0 };
  }
  var accounts = readCanonicalTable(ss, "Accounts", ["AccountCode", "AccountName", "AccountType",
    "StatementGroup", "CashFlowGroup", "IsActive"]);
  var report = buildCapitalEquityMigrationDryRun([], accounts);
  var preWrite = validateCapitalEquityMigrationAcceptance(
    report.capitalEquityRows, report.openingBalanceRows, accounts);
  if (report.status !== "PASS" || preWrite.status !== "PASS") {
    throw new Error("CapitalEquity migration refused before write");
  }
  var timestamp = runtime.timestamp;
  var user = String(runtime.user || "");
  var capitalValues = migrationObjectsToRows(report.capitalEquityRows, CAPITAL_EQUITY_POLICY.HEADERS, timestamp, user);
  var openingValues = migrationObjectsToRows(report.openingBalanceRows,
    FINANCE_OPENING_BALANCE_POLICY.HEADERS, timestamp, user);
  try {
    capitalSheet.getRange(state.capitalLastRow + 1, 1, capitalValues.length,
      CAPITAL_EQUITY_POLICY.HEADERS.length).setValues(capitalValues);
    if (runtime.afterCapitalWrite) runtime.afterCapitalWrite();
    openingSheet.getRange(state.openingLastRow + 1, 1, openingValues.length,
      FINANCE_OPENING_BALANCE_POLICY.HEADERS.length).setValues(openingValues);
    if (runtime.afterOpeningWrite) runtime.afterOpeningWrite();
    runtime.flush();
    var physical = validateCapitalEquityMigrationAcceptance(
      migrationRowsToObjects(capitalSheet, CAPITAL_EQUITY_POLICY.HEADERS),
      migrationRowsToObjects(openingSheet, FINANCE_OPENING_BALANCE_POLICY.HEADERS), accounts);
    if (physical.status !== "PASS") throw new Error("CapitalEquity physical acceptance failed");
    return { status: "PASS", writeCount: 11, capitalEquityRows: 10, openingBalanceRows: 1,
      physicalAcceptance: physical };
  } catch (error) {
    rollbackCapitalEquityMigrationAttempt(state, runtime.flush);
    throw error;
  }
}

function runCapitalEquityMigration() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var activeUser = Session.getActiveUser();
    var result = executeCapitalEquityMigrationWithRuntime({
      spreadsheet: SpreadsheetApp.getActiveSpreadsheet(),
      flush: function() { SpreadsheetApp.flush(); },
      timestamp: new Date(),
      user: activeUser && activeUser.getEmail ? activeUser.getEmail() : ""
    });
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    if (acquired) lock.releaseLock();
  }
}
