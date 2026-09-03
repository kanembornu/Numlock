var FINANCE_ACCOUNTING_POLICY = Object.freeze({
  recognitionBasis: "TRANSACTION_DATE_OPERATING",
  depreciationIncluded: true,
  depreciationSource: "DepreciationLedger",
  depreciationDisclosure: "Monthly depreciation is included from the authoritative DepreciationLedger.",
  cashBalanceAvailable: false,
  inventoryBalanceAvailable: false,
  balanceSheetAvailable: false,
  cashFlowAvailable: false
});

var NUMLOCK_PRODUCTION_STORAGE_POLICY = Object.freeze({
  SPREADSHEET_ID: "1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M"
});

function resolveNumlockProductionSpreadsheetWithRuntime(runtime) {
  var spreadsheet;
  try { spreadsheet = runtime.openById(NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID); }
  catch (error) { return null; }
  if (!spreadsheet || typeof spreadsheet.getId !== "function" ||
      String(spreadsheet.getId()) !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) return null;
  return spreadsheet;
}

function requireNumlockProductionSpreadsheet() {
  var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({
    openById: function(id) { return SpreadsheetApp.openById(id); }
  });
  if (!spreadsheet) throw new Error("NUMLOCK canonical production storage is unavailable");
  return spreadsheet;
}

var FINANCE_DEPRECIATION_EXPECTED_ROWS = 2679;

function getFinanceData(filter, customStart, customEnd) {
  var ss = requireNumlockProductionSpreadsheet();
  var canonicalData = getCanonicalTransactionData(ss);
  var accounts = readCanonicalTable(ss, "Accounts", [
    "AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"
  ]);
  var depreciationSource = getFinanceDepreciationSource(ss);
  var period = resolveDashboardDateRange(filter, customStart, customEnd);
  var finance = buildFinanceProfitAndLoss(canonicalData, accounts, period, depreciationSource);
  var capitalRows = readCanonicalTable(ss, "CapitalEquity", CAPITAL_EQUITY_POLICY.HEADERS);
  var openingRows = readFinanceOpeningBalancesCompat(ss);
  var postCutoffProfit = 0;
  if (period.endDate >= FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START) {
    postCutoffProfit = buildFinanceProfitAndLoss(canonicalData, accounts, {
      filter: "custom",
      startDate: FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START,
      endDate: period.endDate,
      label: FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START + " to " + period.endDate
    }, depreciationSource).summary.operatingNetProfit;
  }
  finance.capitalEquity = buildCapitalEquityReadModel(
    capitalRows, openingRows, accounts, period.endDate, postCutoffProfit);
  return finance;
}

function financeDepreciationPeriodKey(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return canonicalDateKey(value).slice(0, 7) + "-01";
  var match = String(value == null ? "" : value).trim().match(/^(\d{4})-(\d{2})-01$/);
  if (!match) return null;
  var year = Number(match[1]), month = Number(match[2]), date = new Date(year, month - 1, 1);
  return date.getFullYear() === year && date.getMonth() === month - 1 ? match[1] + "-" + match[2] + "-01" : null;
}

function buildFinanceDepreciationSource(ledgerRows, assets) {
  var assetIds = {}, logicalKeys = {}, rows = [];
  var quality = { duplicateLogicalKeys: [], invalidDepreciationRows: [],
    invalidPeriodRows: [], unresolvedAssetReferences: [] };
  (assets || []).forEach(function(asset) {
    var id = String(asset.ID_Asset || "").trim();
    if (id) assetIds[id] = true;
  });
  (ledgerRows || []).forEach(function(row) {
    var id = String(row.ID_Asset || "").trim(), period = financeDepreciationPeriodKey(row.Period);
    var depreciation = Number(row.Depreciation), rowIdentity = String(row.ID_Dep || row.sourceRowIndex || "UNKNOWN");
    if (!period) { quality.invalidPeriodRows.push({ row: rowIdentity, value: row.Period }); return; }
    if (!isFinite(depreciation) || depreciation < 0 || Math.round(depreciation) !== depreciation) {
      quality.invalidDepreciationRows.push({ row: rowIdentity, value: row.Depreciation }); return;
    }
    if (!id || !assetIds[id]) quality.unresolvedAssetReferences.push({ row: rowIdentity, assetId: id });
    var key = id + "|" + period;
    if (logicalKeys[key]) { quality.duplicateLogicalKeys.push(key); return; }
    logicalKeys[key] = true;
    rows.push({ ID_Dep: String(row.ID_Dep || ""), ID_Asset: id, Period: period, Depreciation: depreciation });
  });
  return { physicalRowCount: (ledgerRows || []).length, rows: rows, quality: quality };
}

function getFinanceDepreciationSource(ss) {
  var ledger = readCanonicalTable(ss, "DepreciationLedger", ["ID_Dep", "Period", "ID_Asset",
    "OpeningBookValue", "Depreciation", "AccumulatedDepreciation", "ClosingBookValue", "GeneratedAt"]);
  var assets = readCanonicalTable(ss, "Assets", ["ID_Asset"]);
  return buildFinanceDepreciationSource(ledger, assets);
}

function scopeFinanceDepreciation(source, period) {
  var depreciationExpense = (source.rows || []).reduce(function(total, row) {
    var parts = row.Period.split("-"), year = Number(parts[0]), month = Number(parts[1]);
    var monthEnd = financeDateKey(year, month, new Date(year, month, 0).getDate());
    return row.Period <= period.endDate && monthEnd >= period.startDate ? total + row.Depreciation : total;
  }, 0);
  var quality = source.quality || {};
  return { depreciationExpense: depreciationExpense, quality: {
    duplicateLogicalKeys: quality.duplicateLogicalKeys || [],
    invalidDepreciationRows: quality.invalidDepreciationRows || [],
    invalidPeriodRows: quality.invalidPeriodRows || [],
    unresolvedAssetReferences: quality.unresolvedAssetReferences || [] } };
}

function validateFinanceProductionRuntime() {
  var totalStartedAt = Date.now();
  var acquisitionStartedAt = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var canonicalData = getCanonicalTransactionData(ss);
  var canonicalAcquisitionMs = Date.now() - acquisitionStartedAt;
  var accountReadStartedAt = Date.now();
  var accounts = readCanonicalTable(ss, "Accounts", [
    "AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"
  ]);
  var depreciationSource = getFinanceDepreciationSource(ss);
  var accountMasterReadMs = Date.now() - accountReadStartedAt;
  var periods = buildFinanceRuntimeValidationPeriods(canonicalData);
  var results = periods.map(function(period) {
    var buildStartedAt = Date.now();
    var finance = buildFinanceProfitAndLoss(canonicalData, accounts, period, depreciationSource);
    var expenseTotal = finance.expenseBreakdown.reduce(function(total, item) {
      return total + Number(item.amount || 0);
    }, 0);
    var summary = finance.summary;
    var formulaReconciles = financeAmountsMatch(summary.grossProfit, summary.revenue - summary.cogs) &&
      financeAmountsMatch(summary.operatingNetProfit,
        summary.grossProfit - summary.operatingExpenses - summary.depreciationExpense);
    var expenseReconciles = financeAmountsMatch(expenseTotal, summary.operatingExpenses);
    var quality = finance.dataQuality;
    var unresolvedCount = quality.unresolvedProducts.length + quality.unresolvedExpenseItems.length +
      quality.inactiveAccountMappings.length + quality.duplicateDepreciationLogicalKeys.length +
      quality.invalidDepreciationRows.length + quality.invalidDepreciationPeriods.length +
      quality.unresolvedDepreciationAssets.length + quality.depreciationOverlapTransactions.length;

    return {
      name: period.validationName,
      period: finance.period,
      summary: summary,
      expenseBreakdownTotal: expenseTotal,
      expenseReconciliation: expenseReconciles ? "PASS" : "FAIL",
      formulaReconciliation: formulaReconciles ? "PASS" : "FAIL",
      accountingPolicy: finance.accountingPolicy,
      dataQuality: quality,
      unresolvedMappingCount: unresolvedCount,
      buildMs: Date.now() - buildStartedAt
    };
  });
  var failures = [];
  if (depreciationSource.physicalRowCount !== FINANCE_DEPRECIATION_EXPECTED_ROWS) {
    failures.push("LEDGER_ROWS:expected=" + FINANCE_DEPRECIATION_EXPECTED_ROWS +
      ",actual=" + depreciationSource.physicalRowCount);
  }

  results.forEach(function(result) {
    if (result.expenseReconciliation !== "PASS" || result.formulaReconciliation !== "PASS") {
      failures.push(result.name + ":RECONCILIATION");
    }
    result.dataQuality.unresolvedProducts.forEach(function(item) {
      failures.push(result.name + ":PRODUCT:" + String(item.productId || item.masterId || "UNKNOWN") +
        ":" + String(item.accountCode || item.reason || "UNRESOLVED"));
    });
    result.dataQuality.unresolvedExpenseItems.forEach(function(item) {
      failures.push(result.name + ":EXPENSE_ITEM:" + String(item.expenseItemId || item.masterId || "UNKNOWN") +
        ":" + String(item.accountCode || item.reason || "UNRESOLVED"));
    });
    result.dataQuality.inactiveAccountMappings.forEach(function(item) {
      failures.push(result.name + ":INACTIVE_ACCOUNT:" + String(item.accountCode || "UNKNOWN"));
    });
    ["duplicateDepreciationLogicalKeys", "invalidDepreciationRows", "invalidDepreciationPeriods",
      "unresolvedDepreciationAssets", "depreciationOverlapTransactions"].forEach(function(key) {
      if (result.dataQuality[key].length) failures.push(result.name + ":" + key + ":" + result.dataQuality[key].length);
    });
  });

  var report = {
    status: failures.length ? "FAIL" : "PASS",
    readOnly: true,
    periods: results,
    performance: {
      totalFinanceCallMs: Date.now() - totalStartedAt,
      canonicalAcquisitionMs: canonicalAcquisitionMs,
      accountMasterReadMs: accountMasterReadMs,
      financeBuildTotalMs: results.reduce(function(total, result) { return total + result.buildMs; }, 0)
    },
    failures: failures
  };

  Logger.log(JSON.stringify(report));
  if (failures.length) {
    throw new Error("Finance production validation failed: " + failures.join(", "));
  }
  return report;
}

function validateFinanceDepreciationProductionRuntime() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var canonicalData = getCanonicalTransactionData(ss);
  var accounts = readCanonicalTable(ss, "Accounts", [
    "AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"
  ]);
  var depreciationSource = getFinanceDepreciationSource(ss);
  var periods = [
    { validationName: "august2026", filter: "custom", startDate: "2026-08-01", endDate: "2026-08-31", label: "2026-08" },
    { validationName: "full2026", filter: "custom", startDate: "2026-01-01", endDate: "2026-12-31", label: "2026" },
    { validationName: "historical2025", filter: "custom", startDate: "2025-01-01", endDate: "2025-12-31", label: "2025" },
    { validationName: "empty2027", filter: "custom", startDate: "2027-01-01", endDate: "2027-12-31", label: "2027" }
  ];
  var failures = [];
  var results = periods.map(function(period) {
    var finance = buildFinanceProfitAndLoss(canonicalData, accounts, period, depreciationSource);
    var summary = finance.summary, quality = finance.dataQuality;
    if (!financeAmountsMatch(summary.operatingNetProfit,
        summary.grossProfit - summary.operatingExpenses - summary.depreciationExpense)) {
      failures.push(period.validationName + ":FORMULA");
    }
    ["duplicateDepreciationLogicalKeys", "invalidDepreciationRows", "invalidDepreciationPeriods",
      "unresolvedDepreciationAssets", "depreciationOverlapTransactions"].forEach(function(key) {
      if (quality[key].length) failures.push(period.validationName + ":" + key + ":" + quality[key].length);
    });
    return { name: period.validationName, period: finance.period, summary: summary,
      depreciationQuality: {
        duplicateLogicalKeys: quality.duplicateDepreciationLogicalKeys.length,
        invalidRows: quality.invalidDepreciationRows.length,
        invalidPeriods: quality.invalidDepreciationPeriods.length,
        unresolvedAssets: quality.unresolvedDepreciationAssets.length,
        transactionalOverlap: quality.depreciationOverlapTransactions.length
      } };
  });
  var report = { status: failures.length ? "FAIL" : "PASS", readOnly: true,
    depreciationSource: FINANCE_ACCOUNTING_POLICY.depreciationSource,
    depreciationIncluded: FINANCE_ACCOUNTING_POLICY.depreciationIncluded,
    ledgerRows: depreciationSource.physicalRowCount, periods: results, failures: failures };
  Logger.log(JSON.stringify(report));
  if (failures.length) throw new Error("Finance depreciation production validation failed: " + failures.join(", "));
  return report;
}

function buildFinanceRuntimeValidationPeriods(canonicalData) {
  var dateKeys = [];
  var populatedDateKeys = [];
  (canonicalData.records || []).forEach(function(row) {
    if (row.dateKey) {
      dateKeys.push(row.dateKey);
      populatedDateKeys.push(row.dateKey);
    }
  });
  (canonicalData.lifecycleRecords || []).forEach(function(row) { if (row.dateKey) dateKeys.push(row.dateKey); });
  var sourceQuality = canonicalData.sourceQuality || {};
  (sourceQuality.unresolvedProducts || []).forEach(function(item) { if (item.dateKey) dateKeys.push(item.dateKey); });
  (sourceQuality.unresolvedExpenseItems || []).forEach(function(item) { if (item.dateKey) dateKeys.push(item.dateKey); });
  dateKeys.sort();
  if (!dateKeys.length) throw new Error("Finance production validation requires at least one dated transaction");
  populatedDateKeys.sort();
  if (!populatedDateKeys.length) throw new Error("Finance production validation requires at least one resolved active transaction");

  var firstDate = dateKeys[0];
  var lastDate = dateKeys[dateKeys.length - 1];
  var populatedDate = populatedDateKeys[populatedDateKeys.length - 1];
  var year = Number(populatedDate.slice(0, 4));
  var month = Number(populatedDate.slice(5, 7));
  var monthEnd = new Date(year, month, 0).getDate();
  var emptyYear = Number(lastDate.slice(0, 4)) + 1;

  return [
    { validationName: "fullAvailablePeriod", filter: "custom", startDate: firstDate,
      endDate: lastDate, label: firstDate + " to " + lastDate },
    { validationName: "populatedMonth", filter: "custom", startDate: financeDateKey(year, month, 1),
      endDate: financeDateKey(year, month, monthEnd), label: populatedDate.slice(0, 7) },
    { validationName: "populatedYear", filter: "custom", startDate: financeDateKey(year, 1, 1),
      endDate: financeDateKey(year, 12, 31), label: String(year) },
    { validationName: "emptyPeriod", filter: "custom", startDate: financeDateKey(emptyYear, 1, 1),
      endDate: financeDateKey(emptyYear, 1, 31), label: String(emptyYear) + "-01" },
    { validationName: "inclusiveCustomRange", filter: "custom", startDate: populatedDate,
      endDate: populatedDate, label: populatedDate }
  ];
}

function financeDateKey(year, month, day) {
  return String(year) + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function financeAmountsMatch(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.000001;
}

function buildFinanceAccountMap(accounts) {
  return buildCanonicalMasterMap(accounts || [], "AccountCode", "Accounts");
}

function buildFinanceProfitAndLoss(canonicalData, accounts, period, depreciationSource) {
  if (!depreciationSource) throw new Error("Finance requires the authoritative DepreciationLedger read model");
  var accountMap = buildFinanceAccountMap(accounts);
  var scopedRecords = filterTransactionsByDateRange(canonicalData.records || [], period);
  var scopedLifecycle = filterTransactionsByDateRange(canonicalData.lifecycleRecords || [], period);
  var sourceQuality = canonicalData.sourceQuality || {};
  var unresolvedProducts = (sourceQuality.unresolvedProducts || []).filter(function(item) {
    return item.dateKey >= period.startDate && item.dateKey <= period.endDate;
  }).slice();
  var unresolvedExpenseItems = (sourceQuality.unresolvedExpenseItems || []).filter(function(item) {
    return item.dateKey >= period.startDate && item.dateKey <= period.endDate;
  }).slice();
  var inactiveAccountMappings = [];
  var expenseTotals = {};
  var revenue = 0;
  var cogs = 0;
  var operatingExpenses = 0;
  var depreciationOverlapTransactions = [];
  var depreciation = scopeFinanceDepreciation(depreciationSource, period);

  function resolveAccount(code, mappingType, row, unresolvedTarget) {
    var normalizedCode = String(code || "").trim();
    var account = normalizedCode ? accountMap[normalizedCode] : null;
    if (!account) {
      unresolvedTarget.push({ transactionId: String(row.id || ""), masterId: String(row.productId || row.expenseId || ""),
        accountCode: normalizedCode, mappingType: mappingType,
        reason: normalizedCode ? "UNKNOWN_ACCOUNT" : "MISSING_ACCOUNT_CODE" });
      return null;
    }
    if (!isCanonicalActive(account.IsActive)) {
      inactiveAccountMappings.push({ transactionId: String(row.id || ""), masterId: String(row.productId || row.expenseId || ""),
        accountCode: normalizedCode, mappingType: mappingType });
      return null;
    }
    return account;
  }

  scopedRecords.forEach(function(row) {
    if (row.transactionType === "Sales") {
      if (!row.productIsActive) {
        unresolvedProducts.push({ transactionId: String(row.id || ""), productId: String(row.productId || ""),
          reason: "INACTIVE_PRODUCT" });
        return;
      }
      var revenueAccount = resolveAccount(row.revenueAccountCode, "REVENUE", row, unresolvedProducts);
      var cogsAccount = resolveAccount(row.cogsAccountCode, "COGS", row, unresolvedProducts);
      if (!revenueAccount || !cogsAccount) return;
      revenue += Number(row.revenue) || 0;
      cogs += Number(row.cogs) || 0;
      return;
    }

    if (!row.expenseItemIsActive) {
      unresolvedExpenseItems.push({ transactionId: String(row.id || ""), expenseItemId: String(row.expenseId || ""),
        reason: "INACTIVE_EXPENSE_ITEM" });
      return;
    }
    var expenseAccount = resolveAccount(row.expenseAccountCode, "EXPENSE", row, unresolvedExpenseItems);
    if (!expenseAccount || String(expenseAccount.AccountType || "").trim() !== "Expense") return;
    var amount = Number(row.expense) || 0;
    var accountCode = String(expenseAccount.AccountCode || "").trim();
    if (accountCode === "6900") {
      depreciationOverlapTransactions.push({ transactionId: String(row.id || ""), accountCode: accountCode });
      return;
    }
    operatingExpenses += amount;
    if (!expenseTotals[accountCode]) {
      expenseTotals[accountCode] = { AccountCode: accountCode,
        AccountName: String(expenseAccount.AccountName || "").trim(),
        StatementGroup: String(expenseAccount.StatementGroup || "").trim(), amount: 0 };
    }
    expenseTotals[accountCode].amount += amount;
  });

  var grossProfit = revenue - cogs;
  var depreciationExpense = depreciation.depreciationExpense;
  var operatingNetProfit = grossProfit - operatingExpenses - depreciationExpense;
  var excludedInactiveTransactions = scopedLifecycle.filter(function(row) { return row.isActive === false; }).length;
  var issueCount = unresolvedProducts.length + unresolvedExpenseItems.length +
    inactiveAccountMappings.length + excludedInactiveTransactions + depreciationOverlapTransactions.length +
    depreciation.quality.duplicateLogicalKeys.length + depreciation.quality.invalidDepreciationRows.length +
    depreciation.quality.invalidPeriodRows.length + depreciation.quality.unresolvedAssetReferences.length;

  return {
    period: { filter: period.filter, startDate: period.startDate, endDate: period.endDate, label: period.label },
    summary: { revenue: revenue, cogs: cogs, grossProfit: grossProfit,
      operatingExpenses: operatingExpenses, depreciationExpense: depreciationExpense,
      operatingNetProfit: operatingNetProfit,
      operatingProfitMargin: revenue === 0 ? 0 : operatingNetProfit / revenue },
    expenseBreakdown: Object.keys(expenseTotals).sort().map(function(code) { return expenseTotals[code]; }),
    dataQuality: { unresolvedProducts: unresolvedProducts, unresolvedExpenseItems: unresolvedExpenseItems,
      inactiveAccountMappings: inactiveAccountMappings,
      duplicateDepreciationLogicalKeys: depreciation.quality.duplicateLogicalKeys,
      invalidDepreciationRows: depreciation.quality.invalidDepreciationRows,
      invalidDepreciationPeriods: depreciation.quality.invalidPeriodRows,
      unresolvedDepreciationAssets: depreciation.quality.unresolvedAssetReferences,
      depreciationOverlapTransactions: depreciationOverlapTransactions,
      excludedInactiveTransactions: excludedInactiveTransactions,
      status: issueCount === 0 ? "GOOD" : "ATTENTION" },
    accountingPolicy: FINANCE_ACCOUNTING_POLICY
  };
}
