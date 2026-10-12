var FINANCE_ACCOUNTING_POLICY = Object.freeze({
  recognitionBasis: "TRANSACTION_DATE_OPERATING",
  depreciationIncluded: true,
  depreciationSource: "DepreciationLedger",
  depreciationDisclosure: "Monthly depreciation is included from the authoritative DepreciationLedger.",
  cashBalanceAvailable: false,
  inventoryBalanceAvailable: false,
  balanceSheetAvailable: false,
  cashFlowAvailable: true
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


function getFinanceDataWithRuntime(runtime, filter, customStart, customEnd) {
  var ss = runtime.spreadsheet;
  var canonicalData = getCanonicalTransactionData(ss);
  // U5: ONE recognized-Sales authority. Composed once per Finance request and
  // reused across the P&L, the post-cutoff comparison build, and quality.
  var salesProjection = buildRecognizedSalesProjectionFromSpreadsheet_(ss);
  var accounts = readCanonicalTable(ss, "Accounts", [
    "AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"
  ]);
  var depreciationSource = getFinanceDepreciationSource(ss);
  var period = resolveDashboardDateRange(filter, customStart, customEnd);
  var balanceLedger = [];
  try { balanceLedger = readCanonicalTable(ss, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS); }
  catch (ledgerError) {
    if (period.endDate >= BALANCE_FOUNDATION_POLICY.POLICY_C_TRANSITION_DATE) throw ledgerError;
  }
  var finance = buildFinanceProfitAndLoss(canonicalData, accounts, period, depreciationSource,
    balanceLedger, salesProjection);
  try {
    var capitalRows = readCanonicalTable(ss, "CapitalEquity", CAPITAL_EQUITY_POLICY.HEADERS);
    var openingRows = readFinanceOpeningBalancesCompat(ss);
    var postCutoffProfit = 0;
    if (period.endDate >= FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START) {
      postCutoffProfit = buildFinanceProfitAndLoss(canonicalData, accounts, {
        filter: "custom",
        startDate: FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START,
        endDate: period.endDate,
        label: FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START + " to " + period.endDate
      }, depreciationSource, null, salesProjection).summary.operatingNetProfit;
    }
    finance.capitalEquity = buildCapitalEquityReadModel(
      capitalRows, openingRows, accounts, period.endDate, postCutoffProfit);
  } catch (equityError) {
    finance.capitalEquity = { status: "UNAVAILABLE", error: String(equityError && equityError.message || equityError) };
  }
  return finance;
}

function buildCashFlowStatement(ledgerRows, accounts, period, openingContext) {
  // T11.2 §14.1 mechanical list extension: 1040 joins the money-line universe
  // (1040 opening starts at 0 and legacy rows never carry the code, so
  // pre-activation outputs are unchanged).
  var cashAccountCodes = ["1000", "1010", "1020", "1040"];
  var accountMap = {};
  (accounts || []).forEach(function(account) {
    var code = String(account.AccountCode || "").trim();
    if (code) accountMap[code] = account;
  });
  var journalLines = {};
  (ledgerRows || []).forEach(function(row) {
    if (!isCanonicalActive(row.IsActive)) return;
    var jid = String(row.JournalID || "").trim();
    if (!jid) return;
    journalLines[jid] = journalLines[jid] || [];
    journalLines[jid].push(row);
  });
  var operating = 0, investing = 0, financing = 0, ambiguous = [];
  Object.keys(journalLines).forEach(function(jid) {
    var lines = journalLines[jid];
    var cashLines = lines.filter(function(r) {
      return cashAccountCodes.indexOf(String(r.AccountCode || "").trim()) !== -1;
    });
    if (!cashLines.length) return;
    var counterpartLines = lines.filter(function(r) {
      return cashAccountCodes.indexOf(String(r.AccountCode || "").trim()) === -1;
    });
    if (!counterpartLines.length) { ambiguous.push({ JournalID: jid, reason: "NO_COUNTERPART" }); return; }
    cashLines.forEach(function(cashLine) {
      var debit = Number(cashLine.Debit) || 0;
      var credit = Number(cashLine.Credit) || 0;
      var cashMovement = debit - credit;
      if (cashMovement === 0) return;
      var group = null;
      counterpartLines.forEach(function(cp) {
        var cpCode = String(cp.AccountCode || "").trim();
        var cpAccount = accountMap[cpCode];
        if (cpAccount && isCanonicalActive(cpAccount.IsActive)) {
          var g = String(cpAccount.CashFlowGroup || "").trim();
          if (g && !group) group = g;
        }
      });
      if (!group) {
        // T11.2 §14.3 composition classification (D11): ONLY a 1040 money
        // line with no counterpart CashFlowGroup classifies by composition —
        // 1040 debit → Operating inflow, 1040 credit → Operating outflow.
        // 1030/counterpart CashFlowGroup is never required; all non-1040
        // journals keep today's counterpart-group rule and anything else
        // unresolvable stays ambiguous (fail-visible, no silent guessing).
        if (String(cashLine.AccountCode || "").trim() === "1040") {
          operating += cashMovement;
          return;
        }
        ambiguous.push({ JournalID: jid, amount: cashMovement, reason: "UNCLASSIFIED_COUNTERPART" }); return;
      }
      if (group === "Operating") operating += cashMovement;
      else if (group === "Investing") investing += cashMovement;
      else if (group === "Financing") financing += cashMovement;
      else ambiguous.push({ JournalID: jid, amount: cashMovement, group: group, reason: "UNKNOWN_GROUP" });
    });
  });
  var netChange = operating + investing + financing;
  var openingCashAvailable = false;
  var openingCash = null;
  if (openingContext && openingContext.openingCash !== null && openingContext.openingCash !== undefined &&
      Number.isFinite(Number(openingContext.openingCash))) {
    openingCash = Number(openingContext.openingCash);
    openingCashAvailable = true;
  }
  var closingCash = openingCashAvailable ? openingCash + netChange : null;
  return {
    openingCash: openingCash,
    operating: operating,
    investing: investing,
    financing: financing,
    netChange: netChange,
    closingCash: closingCash,
    openingCashAvailable: openingCashAvailable,
    ambiguous: ambiguous,
    period: period
  };
}

function getCashFlowData(filter, customStart, customEnd) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var period = resolveDashboardDateRange(filter, customStart, customEnd);
  var accounts = readCanonicalTable(ss, "Accounts", ["AccountCode", "AccountName", "AccountType",
    "StatementGroup", "CashFlowGroup", "IsActive"]);
  var ledger = readCanonicalTable(ss, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var filteredLedger = ledger.filter(function(row) {
    if (!isCanonicalActive(row.IsActive)) return false;
    var tanggal = canonicalDate(row.Tanggal);
    return tanggal && tanggal >= canonicalDate(period.startDate) && tanggal <= canonicalDate(period.endDate);
  });
  var openingContext = null;
  try {
    var openingRows = readFinanceOpeningBalancesCompat(ss);
    // T11.2 §14.1: opening-cash sum matches the statement money universe
    // (the 1040 opening row starts at 0; absent row contributes nothing).
    var cashAccountCodes = ["1000", "1010", "1020", "1040"];
    var sum = 0;
    (openingRows || []).forEach(function(row) {
      var code = String(row.AccountCode || "").trim();
      if (cashAccountCodes.indexOf(code) !== -1 && isCanonicalActive(row.IsActive)) {
        sum += Number(row.Amount) || 0;
      }
    });
    openingContext = { openingCash: sum };
  } catch (e) {
    // openingContext stays null → openingCash unavailable
  }
  var statement = buildCashFlowStatement(filteredLedger, accounts, period, openingContext);
  return { statement: statement, period: period, status: "PASS" };
}

function getFinanceData(filter, customStart, customEnd) {
  return getFinanceDataWithRuntime({
    spreadsheet: requireNumlockProductionSpreadsheet()
  }, filter, customStart, customEnd);
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

// T11.2 §13 Finance validator gate (read side): 1040 evidence is demanded
// from the readiness reader ONLY while SINGLE_COMMIT_TRANSACTION_V1 resolves
// VALID+ACTIVE. ABSENT/PREPARED/PAUSED or an unreadable/invalid config never
// demands the row — read/report authority is mode-independent (PAUSED blocks
// writes, never committed-data reads), and this helper never throws.
function financeSingleCommitActive_() {
  try {
    if (typeof PropertiesService === "undefined" || typeof SINGLE_COMMIT_TRANSACTION_V1 === "undefined") {
      return false;
    }
    var state = singleCommitTransactionConfigState_(
      PropertiesService.getScriptProperties().getProperty(SINGLE_COMMIT_TRANSACTION_V1.CONFIG_PROPERTY));
    return state.state === "VALID" && state.mode === "ACTIVE";
  } catch (error) {
    return false;
  }
}

function buildFinanceFinalReadinessEvidence_(runtime) {
  var ss = runtime.spreadsheet;
  var canonicalData = getCanonicalTransactionData(ss);
  var salesProjection = buildRecognizedSalesProjectionFromSpreadsheet_(ss);
  var accountHeaders = ["AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"];
  var accounts = readCanonicalTable(ss, "Accounts", accountHeaders);
  var ledger = readCanonicalTable(ss, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var settlements = readCanonicalTable(ss, "Settlements", CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS);
  var depreciation = getFinanceDepreciationSource(ss);
  var wanted = ["6210", "2000", "1000", "1010", "1020"], accountMap = {};
  // §13: extend account evidence with 1040 only under ACTIVE config.
  if (financeSingleCommitActive_()) wanted.push("1040");
  accounts.forEach(function(row) { accountMap[String(row.AccountCode || "").trim()] = row; });
  var accountEvidence = {};
  wanted.forEach(function(code) {
    var row = accountMap[code];
    accountEvidence[code] = row ? { found: true, AccountCode: code, AccountName: String(row.AccountName || ""),
      Type: String(row.AccountType || ""), StatementGroup: String(row.StatementGroup || ""),
      CashFlowGroup: String(row.CashFlowGroup || ""), IsActive: isCanonicalActive(row.IsActive) } :
      { found: false, AccountCode: code, AccountName: null, Type: null, StatementGroup: null,
        CashFlowGroup: null, IsActive: null };
  });
  var cases = {};
  buildFinanceRuntimeValidationPeriods(canonicalData).forEach(function(period) {
    if (period.validationName === "emptyPeriod") return;
    var finance = buildFinanceProfitAndLoss(canonicalData, accounts, period, depreciation, ledger, salesProjection);
    var summary = finance.summary;
    var breakdown = finance.expenseBreakdown.reduce(function(total, item) { return total + Number(item.amount || 0); }, 0);
    var predicateAExpected = Number(summary.operatingExpenses || 0), predicateADifference = breakdown - predicateAExpected;
    var formulaExpected = summary.grossProfit === null ? null : Number(summary.grossProfit) -
      Number(summary.operatingExpenses || 0) - Number(summary.depreciationExpense || 0);
    var predicateBDifference = formulaExpected === null ? null : Number(summary.operatingNetProfit) - formulaExpected;
    var failed = [];
    if (!financeAmountsMatch(breakdown, predicateAExpected)) failed.push("EXPENSE_BREAKDOWN_EQUALS_OPERATING_EXPENSES");
    if (formulaExpected !== null && !financeAmountsMatch(summary.operatingNetProfit, formulaExpected)) failed.push("NET_PROFIT_FORMULA");
    cases[period.validationName] = { requestedPeriod: finance.period, sourceRevenue: Number(summary.revenue || 0),
      relevantSourceExpenses: breakdown, materialPurchasesExpensed: summary.materialPurchasesExpensed === undefined ? null : summary.materialPurchasesExpensed,
      statementNetProfit: summary.operatingNetProfit, reconciliationPredicateA: { actual: breakdown, expected: predicateAExpected,
        difference: predicateADifference }, reconciliationPredicateB: { actual: summary.operatingNetProfit, expected: formulaExpected,
        difference: predicateBDifference }, failedPredicate: failed, difference: failed.length === 1 ?
        (failed[0] === "EXPENSE_BREAKDOWN_EQUALS_OPERATING_EXPENSES" ? predicateADifference : predicateBDifference) : null,
      status: failed.length ? "FAIL" : "PASS", reason: failed.length ? failed.join(",") : null };
  });
  var dates = (canonicalData.records || []).map(function(row) { return row.dateKey; }).filter(Boolean).sort();
  var lastDate = dates.length ? dates[dates.length - 1] : BALANCE_FOUNDATION_POLICY.POLICY_C_TRANSITION_DATE;
  var prospectiveEnd = lastDate < BALANCE_FOUNDATION_POLICY.POLICY_C_TRANSITION_DATE ?
    BALANCE_FOUNDATION_POLICY.POLICY_C_TRANSITION_DATE : lastDate;
  var prospectivePeriod = { filter: "custom", startDate: BALANCE_FOUNDATION_POLICY.POLICY_C_TRANSITION_DATE,
    endDate: prospectiveEnd, label: BALANCE_FOUNDATION_POLICY.POLICY_C_TRANSITION_DATE + " to " + prospectiveEnd };
  var prospective = buildFinanceProfitAndLoss(canonicalData, accounts, prospectivePeriod, depreciation, ledger,
    salesProjection);
  var balance = buildPolicyCStatementReconciliation(ledger, { accountingRegime: "PROSPECTIVE_PURCHASE_EXPENSE" });
  var cashFlow = buildCashFlowStatement(ledger, accounts, prospectivePeriod, null);
  var firstDate = dates.length ? dates[0] : "2026-09-30";
  var split = buildFinanceProfitAndLoss(canonicalData, accounts, { filter: "custom", startDate: firstDate,
    endDate: prospectiveEnd, label: firstDate + " to " + prospectiveEnd }, depreciation, ledger, salesProjection);
  var purchaseSheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet), purchaseValues = purchaseSheet ?
    purchaseSheet.getDataRange().getValues() : [];
  var purchaseHeaders = (purchaseValues[0] || []).map(function(value) { return String(value || "").trim(); });
  var expenseDateIndex = purchaseHeaders.indexOf("ExpenseDate"), purchaseRows = purchaseValues.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== "" && value != null; });
  });
  var postBoundary = purchaseRows.filter(function(row) {
    var date = expenseDateIndex < 0 ? null : capitalEquityDateKey(row[expenseDateIndex]);
    return date && date >= BALANCE_FOUNDATION_POLICY.POLICY_C_TRANSITION_DATE;
  }).length;
  return { READ_ONLY: true, WRITE_COUNT: 0, accounts: accountEvidence, financeCases: cases,
    prospectiveFinance: { accountingRegime: prospective.accountingRegime,
      materialPurchasesExpensed: prospective.summary.materialPurchasesExpensed, cogs: prospective.summary.cogs,
      grossProfit: prospective.summary.grossProfit, grossProfitAvailable: prospective.grossProfitAvailable,
      inventoryPresentation: balance.finalValues ? { status: balance.finalValues.inventoryStatus,
        amount: balance.finalValues.inventoryBookValue } : null, cashFlowAvailable: true,
      openingCashAvailable: cashFlow.openingCashAvailable, openingCash: cashFlow.openingCash,
      regimeSections: split.regimeSections ? { legacy: true, prospective: true } : null,
      policyDisclosurePresent: (prospective.policyDisclosures || []).length > 0 &&
        (balance.policyDisclosures || []).length > 0 }, balanceLedgerRowCount: ledger.length,
    settlementRowCount: settlements.length, purchaseEventRowCount: purchaseRows.length,
    postBoundaryPurchaseEventCount: postBoundary };
}

function runFinanceFinalReadinessEvidenceDiagnostic() {
  var report = buildFinanceFinalReadinessEvidence_({ spreadsheet: requireNumlockProductionSpreadsheet() });
  Logger.log(JSON.stringify(report));
  return report;
}

function buildFinanceRuntimeReconciliation_(finance) {
  var summary = finance.summary;
  var expenseTotal = finance.expenseBreakdown.reduce(function(total, item) {
    return total + Number(item.amount || 0);
  }, 0);
  var formulaReconciles = summary.grossProfit === null ||
    (financeAmountsMatch(summary.grossProfit, summary.revenue - summary.cogs) &&
      financeAmountsMatch(summary.operatingNetProfit,
        summary.grossProfit - summary.operatingExpenses - summary.depreciationExpense));
  return { expenseTotal: expenseTotal, expenseReconciles: financeAmountsMatch(expenseTotal, summary.operatingExpenses),
    formulaReconciles: formulaReconciles };
}

function validateFinanceProductionRuntime() {
  var totalStartedAt = Date.now();
  var acquisitionStartedAt = Date.now();
  var ss = requireNumlockProductionSpreadsheet();
  var canonicalData = getCanonicalTransactionData(ss);
  var canonicalAcquisitionMs = Date.now() - acquisitionStartedAt;
  var accountReadStartedAt = Date.now();
  var salesProjection = buildRecognizedSalesProjectionFromSpreadsheet_(ss);
  var accounts = readCanonicalTable(ss, "Accounts", [
    "AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"
  ]);
  var depreciationSource = getFinanceDepreciationSource(ss);
  var accountMasterReadMs = Date.now() - accountReadStartedAt;
  var periods = buildFinanceRuntimeValidationPeriods(canonicalData);
  var results = periods.map(function(period) {
    var buildStartedAt = Date.now();
    var finance = buildFinanceProfitAndLoss(canonicalData, accounts, period, depreciationSource, null,
      salesProjection);
    var reconciliation = buildFinanceRuntimeReconciliation_(finance);
    var expenseTotal = reconciliation.expenseTotal;
    var summary = finance.summary;
    var formulaReconciles = reconciliation.formulaReconciles;
    var expenseReconciles = reconciliation.expenseReconciles;
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
      dataQualitySummary: JSON.stringify({
        unresolvedProducts: quality.unresolvedProducts.length,
        unresolvedExpenseItems: quality.unresolvedExpenseItems.length,
        inactiveAccountMappings: quality.inactiveAccountMappings.length,
        duplicateDepreciationLogicalKeys: quality.duplicateDepreciationLogicalKeys.length,
        invalidDepreciationRows: quality.invalidDepreciationRows.length,
        invalidDepreciationPeriods: quality.invalidDepreciationPeriods.length,
        unresolvedDepreciationAssets: quality.unresolvedDepreciationAssets.length,
        depreciationOverlapTransactions: quality.depreciationOverlapTransactions.length
      }),
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
  var salesProjection = buildRecognizedSalesProjectionFromSpreadsheet_(ss);
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
    var finance = buildFinanceProfitAndLoss(canonicalData, accounts, period, depreciationSource, null,
      salesProjection);
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

function buildPartialBalanceFixedAssetPosition(ledgerRows, asOfDate) {
  var assetRows = {};
  (ledgerRows || []).forEach(function(row) {
    var id = String(row.ID_Asset || "").trim();
    var period = financeDepreciationPeriodKey(row.Period);
    if (!id || !period) return;
    if (!assetRows[id]) assetRows[id] = [];
    assetRows[id].push({ period: period, openingBookValue: Number(row.OpeningBookValue) || 0,
      accumulatedDepreciation: Number(row.AccumulatedDepreciation) || 0,
      closingBookValue: Number(row.ClosingBookValue) || 0 });
  });
  var assetPositions = {};
  Object.keys(assetRows).forEach(function(id) {
    var sorted = assetRows[id].sort(function(a, b) { return a.period < b.period ? -1 : a.period > b.period ? 1 : 0; });
    var earliest = sorted[0];
    var grossCost = earliest.openingBookValue;
    var latest = sorted[0];
    for (var i = 1; i < sorted.length; i++) {
      if (sorted[i].period <= asOfDate) latest = sorted[i];
    }
    if (sorted[0].period > asOfDate) return;
    assetPositions[id] = {
      grossCost: grossCost,
      accumulatedDepreciation: latest.accumulatedDepreciation,
      netBookValue: latest.closingBookValue,
      latestPeriod: latest.period
    };
  });
  var totalGrossCost = 0;
  var totalAccumulatedDepreciation = 0;
  var totalNBV = 0;
  Object.keys(assetPositions).forEach(function(id) {
    totalGrossCost += assetPositions[id].grossCost;
    totalAccumulatedDepreciation += assetPositions[id].accumulatedDepreciation;
    totalNBV += assetPositions[id].netBookValue;
  });
  return {
    assetCount: Object.keys(assetPositions).length,
    totalGrossCost: totalGrossCost,
    totalAccumulatedDepreciation: totalAccumulatedDepreciation,
    totalNBV: totalNBV,
    positions: assetPositions
  };
}

function getPartialBalanceDataWithRuntime(runtime, filter, customStart, customEnd) {
  var ss = runtime.spreadsheet;
  var period = resolveDashboardDateRange(filter, customStart, customEnd);
  var asOfDate = period.endDate;
  var depreciationRows = readCanonicalTable(ss, "DepreciationLedger", [
    "ID_Dep", "Period", "ID_Asset", "OpeningBookValue", "Depreciation",
    "AccumulatedDepreciation", "ClosingBookValue", "GeneratedAt"
  ]);
  var fixedAssets = buildPartialBalanceFixedAssetPosition(depreciationRows, asOfDate);
  var capitalEquity = { status: "UNAVAILABLE" };
  try {
    var canonicalData = getCanonicalTransactionData(ss);
    var salesProjection = buildRecognizedSalesProjectionFromSpreadsheet_(ss);
    var accounts = readCanonicalTable(ss, "Accounts", [
      "AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"
    ]);
    var depreciationSource = getFinanceDepreciationSource(ss);
    var capitalRows = readCanonicalTable(ss, "CapitalEquity", CAPITAL_EQUITY_POLICY.HEADERS);
    var openingRows = readFinanceOpeningBalancesCompat(ss);
    var postCutoffProfit = 0;
    if (asOfDate >= FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START) {
      postCutoffProfit = buildFinanceProfitAndLoss(canonicalData, accounts, {
        filter: "custom", startDate: FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START,
        endDate: asOfDate, label: FINANCE_OPENING_BALANCE_POLICY.POST_CUTOFF_PROFIT_AND_LOSS_START + " to " + asOfDate
      }, depreciationSource, null, salesProjection).summary.operatingNetProfit;
    }
    capitalEquity = buildCapitalEquityReadModel(capitalRows, openingRows, accounts, asOfDate, postCutoffProfit);
  } catch (equityError) {
    capitalEquity = { status: "UNAVAILABLE", error: String(equityError && equityError.message || equityError) };
  }

  var policyState = Object.assign({}, runtime.policyCFinalizationState || {});
  var balanceRows = [];
  try {
    balanceRows = readCanonicalTable(ss, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  } catch (balanceError) {
    policyState.apInconsistencies = Number(policyState.apInconsistencies || 0) + 1;
    policyState.balanceLedgerError = String(balanceError && balanceError.message || balanceError);
  }
  if (capitalEquity.status === "UNAVAILABLE") policyState.apInconsistencies = Number(policyState.apInconsistencies || 0) + 1;
  var reconciliation = buildPolicyCStatementReconciliation(balanceRows, policyState);
  var values = reconciliation.finalValues;
  var assets = values ? {
    cash: { status: "FINAL", amount: values.cashChange },
    inventory: { status: "FINAL", amount: values.inventoryBookValue },
    fixedAssets: { status: "FINAL", acquisitionCost: fixedAssets.totalGrossCost,
      accumulatedDepreciation: fixedAssets.totalAccumulatedDepreciation, netBookValue: fixedAssets.totalNBV }
  } : null;
  var liabilities = values ? { status: "FINAL", accountsPayable: values.accountsPayable,
    total: values.accountsPayable } : null;
  var equity = values && capitalEquity.status !== "UNAVAILABLE" ? {
    ownerContributions: capitalEquity.ownerContributions, returnOfCapital: capitalEquity.returnOfCapital,
    netContributedCapital: capitalEquity.contributedCapital, ownerDraws: capitalEquity.ownerDraws,
    retainedEarningsOpening: capitalEquity.retainedEarningsOpening,
    postCutoffProfit: capitalEquity.retainedEarningsPostCutoffProfit, totalEquity: capitalEquity.totalEquity
  } : null;
  return Object.freeze({
    status: reconciliation.status,
    finalValues: values,
    period: { filter: period.filter, startDate: period.startDate, endDate: period.endDate, label: period.label },
    asOfDate: asOfDate,
    assets: assets,
    liabilities: liabilities,
    equity: equity,
    reconciliation: reconciliation,
    availability: { fixedAssets: "AVAILABLE", capitalEquity: capitalEquity.status,
      balanceLedger: policyState.balanceLedgerError ? "ERROR" : "AVAILABLE" },
    qualityIssues: reconciliation.issues.slice(),
    supplemental: { fixedAssets: fixedAssets, capitalEquity: capitalEquity },
    accountingPolicy: FINANCE_ACCOUNTING_POLICY
  });
}

function getPartialBalanceData(filter, customStart, customEnd) {
  return getPartialBalanceDataWithRuntime({
    spreadsheet: requireNumlockProductionSpreadsheet()
  }, filter, customStart, customEnd);
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

// SALES_RECOGNITION_V2 U5 Revenue scope. ONE Revenue authority: signed U3
// projection `events`, attributed ONLY by each event's authoritative
// EconomicDate (event.dateKey). Never activeView, never BalanceLedger 4000
// credits, Payments, Order headers, OrderLines, or a second legacy Sales
// reconstruction. Excluded cohorts stay excluded and are surfaced through
// machine-readable quality metadata; a source-read failure makes the Revenue
// authority incomplete for the period instead of silently authoritative zero.
function buildFinanceSalesRecognitionScope_(salesProjection, period) {
  if (!salesProjection) throw new Error("Finance requires the recognized Sales projection authority");
  var revenue = 0;
  var revenueEvents = salesProjection.events || [];
  revenueEvents.forEach(function(event) {
    if (event.status !== "RECOGNIZED") return;
    var dateKey = String(event.dateKey || "");
    if (!dateKey || dateKey < period.startDate || dateKey > period.endDate) return;
    revenue += Number(event.signedAmount) || 0;
  });
  var quality = salesProjection.quality || {};
  var excluded = quality.excluded || [];
  var sourceReadFailed = (quality.issues || []).some(function(issue) {
    return issue.code === SALES_RECOGNITION_PROJECTION.ISSUES.SOURCE_READ_FAILED;
  });
  return {
    authority: "SALES_RECOGNITION_V2_PROJECTION",
    contract: String(salesProjection.contract || ""),
    recognizedRevenue: revenue,
    unresolvedCount: excluded.length,
    recoveryRequiredCount: (quality.recoveryIssues || []).length,
    integrityConflictCount: excluded.filter(function(entry) {
      return entry.status === "INTEGRITY_CONFLICT";
    }).length,
    revenueAuthorityComplete: !sourceReadFailed,
    issues: quality.issues || [],
    excluded: excluded
  };
}

function buildFinanceProfitAndLossLegacy_(canonicalData, accounts, period, depreciationSource, salesProjection) {
  if (!depreciationSource) throw new Error("Finance requires the authoritative DepreciationLedger read model");
  if (!salesProjection) throw new Error("Finance requires the recognized Sales projection authority");
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
  var salesRecognition = buildFinanceSalesRecognitionScope_(salesProjection, period);
  var revenue = salesRecognition.recognizedRevenue;
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
      // Expense-side authority only: Revenue comes from the U3 projection
      // above; the canonical Sales row still resolves historical COGS
      // (pre-Policy-C 5000/1100 contract) and account-mapping quality.
      if (!row.productIsActive) {
        unresolvedProducts.push({ transactionId: String(row.id || ""), productId: String(row.productId || ""),
          reason: "INACTIVE_PRODUCT" });
        return;
      }
      var revenueAccount = resolveAccount(row.revenueAccountCode, "REVENUE", row, unresolvedProducts);
      var cogsAccount = resolveAccount(row.cogsAccountCode, "COGS", row, unresolvedProducts);
      if (!revenueAccount || !cogsAccount) return;
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
    depreciation.quality.invalidPeriodRows.length + depreciation.quality.unresolvedAssetReferences.length +
    (salesRecognition.revenueAuthorityComplete ? 0 : 1);

  return {
    period: { filter: period.filter, startDate: period.startDate, endDate: period.endDate, label: period.label },
    grossProfit: grossProfit,
    summary: { revenue: revenue, cogs: cogs, grossProfit: grossProfit,
      operatingExpenses: operatingExpenses, depreciationExpense: depreciationExpense,
      operatingNetProfit: operatingNetProfit,
      operatingProfitMargin: revenue === 0 ? 0 : operatingNetProfit / revenue },
    expenseBreakdown: Object.keys(expenseTotals).sort().map(function(code) { return expenseTotals[code]; }),
    // U5 machine-readable Revenue report metadata (additive DTO surface).
    salesRecognition: salesRecognition,
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

function buildFinanceProfitAndLoss(canonicalData, accounts, period, depreciationSource, ledgerRows,
  salesProjection) {
  var start = resolvePolicyCAccountingRegime_(period && period.startDate);
  var end = resolvePolicyCAccountingRegime_(period && period.endDate);
  if (start.status !== "RESOLVED" || end.status !== "RESOLVED") throw new Error("Finance economic period required");
  if (start.regime === "LEGACY_PRE_TRANSITION" && end.regime === "LEGACY_PRE_TRANSITION") {
    var legacy = buildFinanceProfitAndLossLegacy_(canonicalData, accounts, period, depreciationSource,
      salesProjection);
    legacy.contractVersion = "POLICY_C_PE_V1"; legacy.accountingRegime = "LEGACY_PRE_TRANSITION";
    legacy.grossProfitAvailable = true; legacy.regimeSections = null; legacy.policyDisclosures = [];
    return legacy;
  }
  function buildProspective(prospectivePeriod) {
    var result = buildFinanceProfitAndLossLegacy_(canonicalData, accounts, prospectivePeriod, depreciationSource,
      salesProjection);
    var material = (ledgerRows || []).reduce(function(total, row) {
      var date = capitalEquityDateKey(row.Tanggal);
      return isCanonicalActive(row.IsActive) && String(row.AccountCode || "") === "6210" &&
        date >= prospectivePeriod.startDate && date <= prospectivePeriod.endDate ?
        total + Number(row.Debit || 0) - Number(row.Credit || 0) : total;
    }, 0);
    result.summary.materialPurchasesExpensed = material;
    result.summary.cogs = null; result.summary.grossProfit = null; result.grossProfit = null;
    result.summary.operatingNetProfit = result.summary.revenue - material - result.summary.operatingExpenses -
      result.summary.depreciationExpense;
    result.summary.operatingProfitMargin = result.summary.revenue === 0 ? 0 :
      result.summary.operatingNetProfit / result.summary.revenue;
    result.contractVersion = "POLICY_C_PE_V1"; result.accountingRegime = "PROSPECTIVE_PURCHASE_EXPENSE";
    result.grossProfitAvailable = false; result.regimeSections = null;
    result.policyDisclosures = ["Ordinary materials are expensed on purchase; tabsal.HPP remains non-ledger analytics."];
    return result;
  }
  if (start.regime === "PROSPECTIVE_PURCHASE_EXPENSE") return buildProspective(period);
  var legacyPeriod = Object.assign({}, period, { endDate: "2026-09-30", label: period.startDate + " to 2026-09-30" });
  var prospectivePeriod = Object.assign({}, period, { startDate: "2026-10-01", label: "2026-10-01 to " + period.endDate });
  var legacySection = buildFinanceProfitAndLossLegacy_(canonicalData, accounts, legacyPeriod, depreciationSource,
    salesProjection);
  var prospectiveSection = buildProspective(prospectivePeriod);
  var combinedExpenses = {};
  legacySection.expenseBreakdown.concat(prospectiveSection.expenseBreakdown).forEach(function(item) {
    var code = String(item.AccountCode || "").trim();
    if (!combinedExpenses[code]) combinedExpenses[code] = { AccountCode: code,
      AccountName: String(item.AccountName || "").trim(), StatementGroup: String(item.StatementGroup || "").trim(), amount: 0 };
    combinedExpenses[code].amount += Number(item.amount || 0);
  });
  return { contractVersion: "POLICY_C_PE_V1", accountingRegime: "SPLIT_PRESENTATION_BY_ACCOUNTING_REGIME",
    period: { filter: period.filter, startDate: period.startDate, endDate: period.endDate, label: period.label },
    grossProfit: null, grossProfitAvailable: false,
    summary: { revenue: legacySection.summary.revenue + prospectiveSection.summary.revenue, cogs: null,
      grossProfit: null, materialPurchasesExpensed: null,
      operatingExpenses: legacySection.summary.operatingExpenses + prospectiveSection.summary.operatingExpenses,
      depreciationExpense: legacySection.summary.depreciationExpense + prospectiveSection.summary.depreciationExpense,
      operatingNetProfit: legacySection.summary.operatingNetProfit + prospectiveSection.summary.operatingNetProfit,
      operatingProfitMargin: null },
    expenseBreakdown: Object.keys(combinedExpenses).sort().map(function(code) { return combinedExpenses[code]; }),
    // Same events authority across both regime sections; recognized Revenue
    // is the sum of each section's event-scoped amount.
    salesRecognition: Object.assign({}, legacySection.salesRecognition, {
      recognizedRevenue: legacySection.salesRecognition.recognizedRevenue +
        prospectiveSection.salesRecognition.recognizedRevenue }),
    dataQuality: prospectiveSection.dataQuality, accountingPolicy: FINANCE_ACCOUNTING_POLICY,
    regimeSections: { legacy: legacySection, prospective: prospectiveSection },
    policyDisclosures: ["Accounting regime changes on 2026-10-01.",
      "Legacy HPP and prospective purchase-expense timing are not like-for-like and are not combined."] };
}
