var FINANCE_ACCOUNTING_POLICY = Object.freeze({
  recognitionBasis: "TRANSACTION_DATE_OPERATING",
  depreciationIncluded: false,
  depreciationDisclosure: "Operating profit excludes depreciation because depreciation conventions are not approved.",
  cashBalanceAvailable: false,
  inventoryBalanceAvailable: false,
  balanceSheetAvailable: false,
  cashFlowAvailable: false
});

function getFinanceData(filter, customStart, customEnd) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var canonicalData = getCanonicalTransactionData(ss);
  var accounts = readCanonicalTable(ss, "Accounts", [
    "AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"
  ]);
  var period = resolveDashboardDateRange(filter, customStart, customEnd);
  return buildFinanceProfitAndLoss(canonicalData, accounts, period);
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
  var accountMasterReadMs = Date.now() - accountReadStartedAt;
  var periods = buildFinanceRuntimeValidationPeriods(canonicalData);
  var results = periods.map(function(period) {
    var buildStartedAt = Date.now();
    var finance = buildFinanceProfitAndLoss(canonicalData, accounts, period);
    var expenseTotal = finance.expenseBreakdown.reduce(function(total, item) {
      return total + Number(item.amount || 0);
    }, 0);
    var summary = finance.summary;
    var formulaReconciles = financeAmountsMatch(summary.grossProfit, summary.revenue - summary.cogs) &&
      financeAmountsMatch(summary.operatingNetProfit, summary.grossProfit - summary.operatingExpenses);
    var expenseReconciles = financeAmountsMatch(expenseTotal, summary.operatingExpenses);
    var quality = finance.dataQuality;
    var unresolvedCount = quality.unresolvedProducts.length + quality.unresolvedExpenseItems.length +
      quality.inactiveAccountMappings.length;

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

function buildFinanceProfitAndLoss(canonicalData, accounts, period) {
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
    operatingExpenses += amount;
    var accountCode = String(expenseAccount.AccountCode || "").trim();
    if (!expenseTotals[accountCode]) {
      expenseTotals[accountCode] = { AccountCode: accountCode,
        AccountName: String(expenseAccount.AccountName || "").trim(),
        StatementGroup: String(expenseAccount.StatementGroup || "").trim(), amount: 0 };
    }
    expenseTotals[accountCode].amount += amount;
  });

  var grossProfit = revenue - cogs;
  var operatingNetProfit = grossProfit - operatingExpenses;
  var excludedInactiveTransactions = scopedLifecycle.filter(function(row) { return row.isActive === false; }).length;
  var issueCount = unresolvedProducts.length + unresolvedExpenseItems.length +
    inactiveAccountMappings.length + excludedInactiveTransactions;

  return {
    period: { filter: period.filter, startDate: period.startDate, endDate: period.endDate, label: period.label },
    summary: { revenue: revenue, cogs: cogs, grossProfit: grossProfit,
      operatingExpenses: operatingExpenses, operatingNetProfit: operatingNetProfit,
      operatingProfitMargin: revenue === 0 ? 0 : operatingNetProfit / revenue },
    expenseBreakdown: Object.keys(expenseTotals).sort().map(function(code) { return expenseTotals[code]; }),
    dataQuality: { unresolvedProducts: unresolvedProducts, unresolvedExpenseItems: unresolvedExpenseItems,
      inactiveAccountMappings: inactiveAccountMappings,
      excludedInactiveTransactions: excludedInactiveTransactions,
      status: issueCount === 0 ? "GOOD" : "ATTENTION" },
    accountingPolicy: FINANCE_ACCOUNTING_POLICY
  };
}
