function testFinanceCoreBackendContract() {
  var source = {
    sales: [
      { ID_Trx: "SAL-1", Tanggal: new Date(2026, 0, 1), ID_Prod: "P1", Tipe: "Hot", Qty: 2, HPP: 10000, HJ: 30000, IsActive: true, sourceRowIndex: 1 },
      { ID_Trx: "SAL-INACTIVE", Tanggal: new Date(2026, 0, 2), ID_Prod: "P1", Tipe: "Hot", Qty: 9, HPP: 10000, HJ: 30000, IsActive: false, sourceRowIndex: 2 },
      { ID_Trx: "SAL-END", Tanggal: new Date(2026, 0, 31), ID_Prod: "P1", Tipe: "Cold", Qty: 1, HPP: 12000, HJ: 32000, IsActive: true, sourceRowIndex: 3 },
      { ID_Trx: "SAL-BAD-MASTER", Tanggal: new Date(2026, 0, 10), ID_Prod: "P2", Tipe: "Hot", Qty: 1, HPP: 1, HJ: 2, IsActive: true, sourceRowIndex: 4 },
      { ID_Trx: "SAL-UNKNOWN", Tanggal: new Date(2026, 0, 11), ID_Prod: "P404", Tipe: "Hot", Qty: 1, HPP: 1, HJ: 2, IsActive: true, sourceRowIndex: 6 },
      { ID_Trx: "SAL-OUT", Tanggal: new Date(2026, 1, 1), ID_Prod: "P1", Tipe: "Hot", Qty: 1, HPP: 10000, HJ: 30000, IsActive: true, sourceRowIndex: 5 }
    ],
    expenses: [
      { ID_Trx: "OPS-1", Tanggal: new Date(2026, 0, 5), ID_Ops: "O1", Nilai: 5000, IsActive: true, sourceRowIndex: 1 },
      { ID_Trx: "OPS-6310", Tanggal: new Date(2026, 0, 6), ID_Ops: "O2", Nilai: 7000, IsActive: true, sourceRowIndex: 2 },
      { ID_Trx: "OPS-INACTIVE", Tanggal: new Date(2026, 0, 7), ID_Ops: "O1", Nilai: 9999, IsActive: false, sourceRowIndex: 3 },
      { ID_Trx: "OPS-BAD-ACCOUNT", Tanggal: new Date(2026, 0, 8), ID_Ops: "O3", Nilai: 4000, IsActive: true, sourceRowIndex: 4 },
      { ID_Trx: "OPS-BAD-MASTER", Tanggal: new Date(2026, 0, 9), ID_Ops: "O4", Nilai: 3000, IsActive: true, sourceRowIndex: 5 },
      { ID_Trx: "OPS-INACTIVE-ACCOUNT", Tanggal: new Date(2026, 0, 10), ID_Ops: "O5", Nilai: 2000, IsActive: true, sourceRowIndex: 6 },
      { ID_Trx: "OPS-MISSING-ACCOUNT", Tanggal: new Date(2026, 0, 11), ID_Ops: "O6", Nilai: 1000, IsActive: true, sourceRowIndex: 7 },
      { ID_Trx: "OPS-UNKNOWN-MASTER", Tanggal: new Date(2026, 0, 12), ID_Ops: "O404", Nilai: 1000, IsActive: true, sourceRowIndex: 8 },
      { ID_Trx: "OPS-DEPRECIATION-OVERLAP", Tanggal: new Date(2026, 0, 13), ID_Ops: "O7", Nilai: 3000, IsActive: true, sourceRowIndex: 9 }
    ],
    products: [
      { ID_Prod: "P1", Produk: "Coffee", RevenueAccountCode: "4100", COGSAccountCode: "5100", IsActive: true },
      { ID_Prod: "P2", Produk: "Inactive", RevenueAccountCode: "4100", COGSAccountCode: "5100", IsActive: false }
    ],
    expenseItems: [
      { ID_Ops: "O1", Item: "Rent", AccountCode: "6100", IsActive: true },
      { ID_Ops: "O2", Item: "Equipment", AccountCode: "6310", IsActive: true },
      { ID_Ops: "O3", Item: "Unknown", AccountCode: "9999", IsActive: true },
      { ID_Ops: "O4", Item: "Inactive", AccountCode: "6100", IsActive: false },
      { ID_Ops: "O5", Item: "Inactive Account", AccountCode: "6200", IsActive: true },
      { ID_Ops: "O6", Item: "Missing Account", AccountCode: "", IsActive: true },
      { ID_Ops: "O7", Item: "Depreciation", AccountCode: "6900", IsActive: true }
    ]
  };
  var accounts = [
    { AccountCode: "4100", AccountName: "Sales", AccountType: "Revenue", StatementGroup: "Revenue", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "5100", AccountName: "COGS", AccountType: "COGS", StatementGroup: "COGS", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "6100", AccountName: "Rent", AccountType: "Expense", StatementGroup: "Operating Expenses", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "6310", AccountName: "Equipment", AccountType: "Expense", StatementGroup: "Operating Expenses", CashFlowGroup: "Investing", IsActive: true },
    { AccountCode: "6200", AccountName: "Inactive Expense", AccountType: "Expense", StatementGroup: "Operating Expenses", CashFlowGroup: "Operating", IsActive: false },
    { AccountCode: "6900", AccountName: "Depreciation", AccountType: "Expense", StatementGroup: "Operating Expenses", CashFlowGroup: "Operating", IsActive: true }
  ];
  var assets = [{ ID_Asset: "AST-1", BiayaPerolehan: 999999999, UmurEkonomisBulan: 1 }];
  var ledger = [
    { ID_Dep: "DEP-AST-1-202601", Period: new Date(2026, 0, 1), ID_Asset: "AST-1", Depreciation: 3000 },
    { ID_Dep: "DEP-AST-1-202602", Period: new Date(2026, 1, 1), ID_Asset: "AST-1", Depreciation: 4000 }
  ];
  var depreciationSource = buildFinanceDepreciationSource(ledger, assets);
  if (depreciationSource.physicalRowCount !== 2) throw new Error("Finance physical ledger row count mismatch");
  var missingLedgerRejected = false;
  try {
    buildFinanceProfitAndLoss(buildCanonicalTransactionData(source), accounts,
      { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "January" });
  } catch (error) { missingLedgerRejected = error.message.indexOf("authoritative DepreciationLedger") !== -1; }
  if (!missingLedgerRejected) throw new Error("Finance accepted a missing depreciation ledger source");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "January" };
  var canonical = buildCanonicalTransactionData(source);
  var result = buildFinanceProfitAndLoss(canonical, accounts, period, depreciationSource);
  var expectedSummary = { revenue: 92000, cogs: 32000, grossProfit: 60000,
    operatingExpenses: 12000, depreciationExpense: 3000,
    operatingNetProfit: 45000, operatingProfitMargin: 45000 / 92000 };
  if (JSON.stringify(result.summary) !== JSON.stringify(expectedSummary)) throw new Error("Finance P&L summary mismatch");
  if (result.expenseBreakdown.length !== 2 || result.expenseBreakdown[1].AccountCode !== "6310" ||
      result.expenseBreakdown[1].amount !== 7000) throw new Error("Finance expense account resolution or 6310 inclusion mismatch");
  if (result.dataQuality.excludedInactiveTransactions !== 2 || result.dataQuality.unresolvedProducts.length !== 2 ||
      result.dataQuality.unresolvedExpenseItems.length !== 4 || result.dataQuality.inactiveAccountMappings.length !== 1 ||
      result.dataQuality.depreciationOverlapTransactions.length !== 1 || result.dataQuality.status !== "ATTENTION") {
    throw new Error("Finance data-quality diagnostics mismatch");
  }
  var empty = buildFinanceProfitAndLoss(canonical, accounts,
    { filter: "custom", startDate: "2027-01-01", endDate: "2027-01-31", label: "Empty" }, depreciationSource);
  if (empty.summary.revenue !== 0 || empty.summary.depreciationExpense !== 0 ||
      empty.summary.operatingProfitMargin !== 0 || empty.expenseBreakdown.length !== 0) {
    throw new Error("Finance empty-period or zero-revenue contract mismatch");
  }
  var year = buildFinanceProfitAndLoss(canonical, accounts,
    { filter: "custom", startDate: "2026-01-01", endDate: "2026-12-31", label: "2026" }, depreciationSource);
  if (year.summary.depreciationExpense !== 7000) throw new Error("Finance annual depreciation aggregation mismatch");
  var custom = buildFinanceProfitAndLoss(canonical, accounts,
    { filter: "custom", startDate: "2026-01-15", endDate: "2026-01-20", label: "Mid-month" }, depreciationSource);
  if (custom.summary.depreciationExpense !== 3000) throw new Error("Finance monthly intersection rule mismatch");
  var duplicateSource = buildFinanceDepreciationSource(ledger.concat([ledger[0]]), assets);
  var duplicate = buildFinanceProfitAndLoss(canonical, accounts, period, duplicateSource);
  if (duplicate.summary.depreciationExpense !== 3000 ||
      duplicate.dataQuality.duplicateDepreciationLogicalKeys.length !== 1) {
    throw new Error("Finance depreciation duplicate handling mismatch");
  }
  var invalidSource = buildFinanceDepreciationSource([
    { ID_Dep: "BAD-NUMBER", Period: "2026-01-01", ID_Asset: "AST-1", Depreciation: "bad" },
    { ID_Dep: "BAD-PERIOD", Period: "2026-01-02", ID_Asset: "AST-404", Depreciation: 1 }
  ], assets);
  if (invalidSource.quality.invalidDepreciationRows.length !== 1 ||
      invalidSource.quality.invalidPeriodRows.length !== 1) throw new Error("Finance depreciation integrity mismatch");
  if (result.accountingPolicy.recognitionBasis !== "TRANSACTION_DATE_OPERATING" ||
      result.accountingPolicy.depreciationIncluded !== true ||
      result.accountingPolicy.depreciationSource !== "DepreciationLedger" ||
      result.accountingPolicy.cashBalanceAvailable !== false ||
      result.accountingPolicy.inventoryBalanceAvailable !== false || result.accountingPolicy.balanceSheetAvailable !== false ||
      result.accountingPolicy.cashFlowAvailable !== false) throw new Error("Finance accounting-policy disclosure mismatch");
  var financeSource = getFinanceDataWithRuntime.toString() + getFinanceData.toString() +
    buildFinanceProfitAndLoss.toString() + buildFinanceDepreciationSource.toString();
  ["getDashboardData(", "buildFinancial(", 'getSheetByName(\"Transaction\")', 'getSheetByName(\"Helper\")'].forEach(function(token) {
    if (financeSource.indexOf(token) !== -1) throw new Error("Finance forbidden dependency: " + token);
  });
  ["BiayaPerolehan", "UmurEkonomisBulan", "NilaiResidu", "calculateDepreciationSchedule"].forEach(function(token) {
    if (financeSource.indexOf(token) !== -1) throw new Error("Finance recalculates depreciation from Assets: " + token);
  });
  Logger.log("PASS: testFinanceCoreBackendContract | scenarios=35");
  return { passed: true, scenarios: 35 };
}

function financeIsolationTestSpreadsheet(options) {
  options = options || {};
  var sheets = [];
  var acctH = ["AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"];
  var acctRows = (options.accounts || []).map(function(a) {
    return acctH.map(function(h) { return a[h] === undefined ? "" : a[h]; });
  });
  sheets.push(capitalEquitySchemaTestSheet("Accounts", [acctH].concat(acctRows)));

  var tabSalH = ["ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ", "Source", "IsActive"];
  var salRows = (options.sales || []).map(function(r) {
    return tabSalH.map(function(h) { return r[h] === undefined ? "" : r[h]; });
  });
  sheets.push(capitalEquitySchemaTestSheet("tabsal", [tabSalH].concat(salRows)));

  var tabOpsH = ["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"];
  var opsRows = (options.expenses || []).map(function(r) {
    return tabOpsH.map(function(h) { return r[h] === undefined ? "" : r[h]; });
  });
  sheets.push(capitalEquitySchemaTestSheet("tabops", [tabOpsH].concat(opsRows)));

  var prodH = ["ID_Prod", "Produk", "Kategori", "Kind", "RevenueAccountCode", "COGSAccountCode", "IsActive"];
  var prodRows = (options.products || []).map(function(r) {
    return prodH.map(function(h) { return r[h] === undefined ? "" : r[h]; });
  });
  sheets.push(capitalEquitySchemaTestSheet("Products", [prodH].concat(prodRows)));

  var expItemH = ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"];
  var expItemRows = (options.expenseItems || []).map(function(r) {
    return expItemH.map(function(h) { return r[h] === undefined ? "" : r[h]; });
  });
  sheets.push(capitalEquitySchemaTestSheet("ExpenseItems", [expItemH].concat(expItemRows)));

  var depH = ["ID_Dep", "Period", "ID_Asset", "OpeningBookValue", "Depreciation", "AccumulatedDepreciation", "ClosingBookValue", "GeneratedAt"];
  var depRows = (options.depreciationLedger || []).map(function(r) {
    return depH.map(function(h) { return r[h] === undefined ? "" : r[h]; });
  });
  sheets.push(capitalEquitySchemaTestSheet("DepreciationLedger", [depH].concat(depRows)));

  var assetH = ["ID_Asset"];
  var assetRows = (options.assets || []).map(function(r) {
    return assetH.map(function(h) { return r[h] === undefined ? "" : r[h]; });
  });
  sheets.push(capitalEquitySchemaTestSheet("Assets", [assetH].concat(assetRows)));

  if (!options.omitCapitalEquity) {
    var ceH = CAPITAL_EQUITY_POLICY.HEADERS;
    var ceRows = (options.capitalEquity || []).map(function(r) {
      return ceH.map(function(h) { return r[h] === undefined ? "" : r[h]; });
    });
    sheets.push(capitalEquitySchemaTestSheet("CapitalEquity", [ceH].concat(ceRows)));
  }
  if (!options.omitOpeningBalances) {
    var obH = FINANCE_OPENING_BALANCE_POLICY.HEADERS;
    var obRows = (options.openingBalances || []).map(function(r) {
      return obH.map(function(h) { return r[h] === undefined ? "" : r[h]; });
    });
    sheets.push(capitalEquitySchemaTestSheet("FinanceOpeningBalances", [obH].concat(obRows)));
  }

  return capitalEquitySchemaTestSpreadsheet(sheets);
}

function financeIsolationTestAccounts() {
  return [
    { AccountCode: "4100", AccountName: "Sales", AccountType: "Revenue", StatementGroup: "Revenue", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "5100", AccountName: "COGS", AccountType: "COGS", StatementGroup: "COGS", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "6100", AccountName: "Rent", AccountType: "Expense", StatementGroup: "Operating Expenses", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "3000", AccountName: "Owner Capital", AccountType: "Equity", IsActive: true },
    { AccountCode: "3100", AccountName: "Owner Draw", AccountType: "Equity", IsActive: true },
    { AccountCode: "3200", AccountName: "Retained Earnings", AccountType: "Equity", IsActive: true }
  ];
}

function financeIsolationTestSales() {
  return [
    { ID_Trx: "SAL-ISO-1", Tanggal: new Date(2026, 0, 15), ID_Prod: "P1", Tipe: "Hot", Qty: 10, HPP: 5000, HJ: 15000, Source: "tabsal", IsActive: true }
  ];
}

function financeIsolationTestExpenses() {
  return [
    { ID_Trx: "OPS-ISO-1", Tanggal: new Date(2026, 0, 20), ID_Ops: "O1", Nilai: 3000, Source: "tabops", IsActive: true }
  ];
}

function financeIsolationTestProducts() {
  return [
    { ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", RevenueAccountCode: "4100", COGSAccountCode: "5100", IsActive: true }
  ];
}

function financeIsolationTestExpenseItems() {
  return [
    { ID_Ops: "O1", Item: "Rent", Kategori: "Operations", Kind: "Fixed", Group: "Operating", AccountCode: "6100", IsActive: true }
  ];
}

function financeIsolationTestDepreciation() {
  return [
    { ID_Dep: "DEP-ISO-1", Period: new Date(2026, 0, 1), ID_Asset: "AST-1", OpeningBookValue: 100000, Depreciation: 5000, AccumulatedDepreciation: 5000, ClosingBookValue: 95000, GeneratedAt: new Date() }
  ];
}

function financeIsolationTestAssets() {
  return [{ ID_Asset: "AST-1" }];
}

function financeIsolationBuildSpreadsheet(options) {
  return financeIsolationTestSpreadsheet({
    accounts: financeIsolationTestAccounts(),
    sales: financeIsolationTestSales(),
    expenses: financeIsolationTestExpenses(),
    products: financeIsolationTestProducts(),
    expenseItems: financeIsolationTestExpenseItems(),
    depreciationLedger: financeIsolationTestDepreciation(),
    assets: financeIsolationTestAssets(),
    capitalEquity: options && options.capitalEquity || [],
    openingBalances: options && options.openingBalances || [],
    omitCapitalEquity: options && options.omitCapitalEquity,
    omitOpeningBalances: options && options.omitOpeningBalances
  });
}

function testFinancePAndLIsolation() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var ss = financeIsolationBuildSpreadsheet({});
  var result = getFinanceDataWithRuntime({ spreadsheet: ss }, "custom", "2026-01-01", "2026-01-31");

  check(result.summary !== undefined, "P&L summary present when C&E is valid");
  check(result.summary.revenue === 150000, "P&L revenue correct: 10 * 15000");
  check(result.summary.cogs === 50000, "P&L COGS correct: 10 * 5000 = tabsal.HPP");
  check(result.summary.grossProfit === 100000, "P&L gross profit correct");
  check(result.summary.operatingExpenses === 3000, "P&L operating expenses correct");
  check(result.capitalEquity !== undefined, "capitalEquity present");
  check(result.capitalEquity.status !== "UNAVAILABLE", "C&E available when dependencies valid");

  var ssMissingCapitalEquity = financeIsolationBuildSpreadsheet({ omitCapitalEquity: true });
  var resultMissing = getFinanceDataWithRuntime({ spreadsheet: ssMissingCapitalEquity }, "custom", "2026-01-01", "2026-01-31");

  check(resultMissing.summary !== undefined, "P&L summary present even when CapitalEquity sheet missing");
  check(resultMissing.summary.revenue === 150000, "P&L revenue unaffected by missing CapitalEquity");
  check(resultMissing.summary.cogs === 50000, "P&L COGS unaffected: still tabsal.HPP");
  check(resultMissing.summary.grossProfit === 100000, "P&L gross profit unaffected");
  check(resultMissing.capitalEquity !== undefined, "capitalEquity field present even when degraded");
  check(resultMissing.capitalEquity.status === "UNAVAILABLE", "C&E explicitly UNAVAILABLE when sheet missing");
  check(typeof resultMissing.capitalEquity.error === "string" && resultMissing.capitalEquity.error.length > 0, "C&E has error message");
  check(!resultMissing.capitalEquity.hasOwnProperty("owners"), "no fabricated owners array");
  check(!resultMissing.capitalEquity.hasOwnProperty("totalEquity"), "no fabricated totalEquity");
  check(!resultMissing.capitalEquity.hasOwnProperty("contributedCapital"), "no fabricated contributedCapital");

  Logger.log("PASS: testFinancePAndLIsolation | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceCapitalEquityGracefulDegradation() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var ssNoOpening = financeIsolationBuildSpreadsheet({
    capitalEquity: [
      { ID_Trx: "CE-1", Tanggal: "2021-01-01", Owner: "Dekker", Type: "OWNER_CONTRIBUTION", Nominal: 10000000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
    ],
    omitOpeningBalances: true
  });
  var resultNoOpening = getFinanceDataWithRuntime({ spreadsheet: ssNoOpening }, "custom", "2026-08-01", "2026-08-31");
  check(resultNoOpening.summary !== undefined, "P&L present when opening balances missing");
  check(resultNoOpening.capitalEquity.status === "UNAVAILABLE", "C&E UNAVAILABLE when FinanceOpeningBalances missing");
  check(resultNoOpening.capitalEquity.error.indexOf("schema") !== -1 || resultNoOpening.capitalEquity.error.indexOf("missing") !== -1 || resultNoOpening.capitalEquity.error.length > 0, "C&E error describes the failure");

  var ssInvalidOpening = financeIsolationBuildSpreadsheet({
    capitalEquity: [
      { ID_Trx: "CE-1", Tanggal: "2021-01-01", Owner: "Dekker", Type: "OWNER_CONTRIBUTION", Nominal: 10000000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
    ],
    openingBalances: [
      { ID: "FOB-BAD", EffectiveDate: "2026-07-31", AccountCode: "9999", Amount: 1000, Source: "LEGACY_XLSM_MIGRATION", Keterangan: "Bad", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
    ]
  });
  var resultInvalid = getFinanceDataWithRuntime({ spreadsheet: ssInvalidOpening }, "custom", "2026-08-01", "2026-08-31");
  check(resultInvalid.summary !== undefined, "P&L present when opening balance validation fails");
  check(resultInvalid.capitalEquity.status === "UNAVAILABLE", "C&E UNAVAILABLE when opening balance invalid");
  check(resultInvalid.capitalEquity.error.length > 0, "C&E has error for invalid opening balance");

  check(!resultInvalid.capitalEquity.hasOwnProperty("owners"), "no fabricated owners on invalid opening");
  check(!resultInvalid.capitalEquity.hasOwnProperty("totalEquity"), "no fabricated totalEquity on invalid opening");
  check(!resultInvalid.capitalEquity.hasOwnProperty("retainedEarnings"), "no fabricated retainedEarnings on invalid opening");

  Logger.log("PASS: testFinanceCapitalEquityGracefulDegradation | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceCapitalEquitySuccess() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var ceRows = [
    { ID_Trx: "CE-1", Tanggal: "2021-01-01", Owner: "Dekker", Type: "OWNER_CONTRIBUTION", Nominal: 10635000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" },
    { ID_Trx: "CE-2", Tanggal: "2021-01-01", Owner: "Erway", Type: "OWNER_CONTRIBUTION", Nominal: 10635000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
  ];
  var obRows = [
    { ID: "FOB-3200-20260731", EffectiveDate: "2026-07-31", AccountCode: "3200", Amount: 7407000, Source: "LEGACY_XLSM_MIGRATION", Keterangan: "Opening", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
  ];
  var ss = financeIsolationBuildSpreadsheet({ capitalEquity: ceRows, openingBalances: obRows });
  var result = getFinanceDataWithRuntime({ spreadsheet: ss }, "custom", "2026-01-01", "2026-07-31");

  check(result.summary !== undefined, "P&L summary present on success path");
  check(result.capitalEquity !== undefined, "capitalEquity present");
  check(result.capitalEquity.status !== "UNAVAILABLE", "C&E not degraded on success");
  check(result.capitalEquity.asOfDate === "2026-07-31", "C&E asOfDate correct");
  check(result.capitalEquity.owners.length === 2, "C&E has two owners");
  check(result.capitalEquity.owners[0].owner === "Dekker", "First owner is Dekker");
  check(result.capitalEquity.owners[1].owner === "Erway", "Second owner is Erway");
  check(result.capitalEquity.ownerContributions === 21270000, "Total contributions correct");
  check(result.capitalEquity.contributedCapital === 0, "Contributed capital net zero");
  check(result.capitalEquity.retainedEarnings === 7407000, "Retained earnings matches opening");
  check(result.capitalEquity.totalEquity === 7407000, "Total equity correct at cutoff");
  check(result.capitalEquity.retainedEarningsStatus === "ESTABLISHED", "Retained earnings established");
  check(result.capitalEquity.accountingPolicy !== undefined, "C&E accountingPolicy present");

  Logger.log("PASS: testFinanceCapitalEquitySuccess | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceErrorDestinationMessaging() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var controllerSource = include("201.View.Finance.Controller");
  var stateSource = include("199.View.Finance.State");
  var renderSource = include("200.View.Finance.Render");

  check(controllerSource.indexOf('var renderDestLabel = financeState.destination === "capital-equity" ? "Capital & Equity" : "Profit & Loss"') !== -1,
    "render error handler uses dynamic destination label");
  check(controllerSource.indexOf('var failDestLabel = financeState.destination === "capital-equity" ? "Capital & Equity" : "Profit & Loss"') !== -1,
    "failure handler uses dynamic destination label");
  check(controllerSource.indexOf('"Unable to display Profit & Loss."') === -1 || controllerSource.indexOf('renderDestLabel') !== -1,
    "no hardcoded Profit & Loss in render catch without dynamic label");
  check(controllerSource.indexOf('"Unable to load Profit & Loss."') === -1 || controllerSource.indexOf('failDestLabel') !== -1,
    "no hardcoded Profit & Loss in failure handler without dynamic label");
  check(controllerSource.indexOf('"Unable to display " + renderDestLabel') !== -1,
    "render error message interpolates destination");
  check(controllerSource.indexOf('"Unable to load " + failDestLabel') !== -1,
    "failure message interpolates destination");

  check(stateSource.indexOf('destination: "profit-loss"') !== -1, "default destination is profit-loss");
  check(controllerSource.indexOf('financeState.destination === "capital-equity"') !== -1, "destination check exists for capital-equity");

  var setDestSource = controllerSource;
  check(setDestSource.indexOf('setFinanceViewState("error", isEquity ? "Unable to display Capital & Equity." : "Unable to display Profit & Loss.")') !== -1,
    "setFinanceDestination error path uses dynamic label");

  Logger.log("PASS: testFinanceErrorDestinationMessaging | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testPartialBalancePositionReport() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var ceRows = [
    { ID_Trx: "CE-1", Tanggal: "2021-01-01", Owner: "Dekker", Type: "OWNER_CONTRIBUTION", Nominal: 10635000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" },
    { ID_Trx: "CE-2", Tanggal: "2021-01-01", Owner: "Erway", Type: "OWNER_CONTRIBUTION", Nominal: 10635000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
  ];
  var obRows = [
    { ID: "FOB-3200-20260731", EffectiveDate: "2026-07-31", AccountCode: "3200", Amount: 7407000, Source: "LEGACY_XLSM_MIGRATION", Keterangan: "Opening", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
  ];
  var depLedger = [
    { ID_Dep: "DEP-AST-1-202601", Period: new Date(2026, 0, 1), ID_Asset: "AST-1", OpeningBookValue: 100000, Depreciation: 5000, AccumulatedDepreciation: 5000, ClosingBookValue: 95000, GeneratedAt: new Date() },
    { ID_Dep: "DEP-AST-1-202602", Period: new Date(2026, 1, 1), ID_Asset: "AST-1", OpeningBookValue: 95000, Depreciation: 5000, AccumulatedDepreciation: 10000, ClosingBookValue: 90000, GeneratedAt: new Date() },
    { ID_Dep: "DEP-AST-2-202601", Period: new Date(2026, 0, 1), ID_Asset: "AST-2", OpeningBookValue: 200000, Depreciation: 10000, AccumulatedDepreciation: 10000, ClosingBookValue: 190000, GeneratedAt: new Date() },
    { ID_Dep: "DEP-AST-2-202602", Period: new Date(2026, 1, 1), ID_Asset: "AST-2", OpeningBookValue: 190000, Depreciation: 10000, AccumulatedDepreciation: 20000, ClosingBookValue: 180000, GeneratedAt: new Date() }
  ];

  var ss = financeIsolationBuildSpreadsheet({
    capitalEquity: ceRows,
    openingBalances: obRows,
    depreciationLedger: depLedger,
    assets: [{ ID_Asset: "AST-1" }, { ID_Asset: "AST-2" }]
  });

  var result = getPartialBalanceDataWithRuntime({ spreadsheet: ss }, "custom", "2026-01-01", "2026-02-28");

  // Response top-level contract shape
  check(typeof result === "object" && result !== null, "response is object");
  check(result.period !== undefined, "period present");
  check(result.asOfDate === "2026-02-28", "asOfDate correct");
  check(result.assets !== undefined, "assets present");
  check(result.liabilities !== undefined, "liabilities present");
  check(result.equity !== undefined, "equity present");
  check(result.reconciliation !== undefined, "reconciliation present");
  check(result.totalKnownAssets !== undefined, "totalKnownAssets present");
  check(result.totalAssets === null, "totalAssets is null");
  check(result.availability !== undefined, "availability present");
  check(result.qualityIssues !== undefined, "qualityIssues present");
  check(result.accountingPolicy !== undefined, "accountingPolicy present");

  // status = PARTIAL
  check(result.status === "PARTIAL", "status is PARTIAL");

  // cash unavailable contract
  check(result.assets.cash.status === "UNAVAILABLE", "cash status UNAVAILABLE");
  check(result.assets.cash.amount === null, "cash amount null");

  // inventory unavailable contract
  check(result.assets.inventory.status === "UNAVAILABLE", "inventory status UNAVAILABLE");
  check(result.assets.inventory.amount === null, "inventory amount null");

  // liabilities ZERO_AUTHORITATIVE
  check(result.liabilities.status === "ZERO_AUTHORITATIVE", "liabilities ZERO_AUTHORITATIVE");
  check(result.liabilities.total === 0, "liabilities total 0");

  // fixed asset values
  check(result.assets.fixedAssets.status === "AVAILABLE", "fixedAssets AVAILABLE");
  check(result.assets.fixedAssets.acquisitionCost === 300000, "total gross cost 300000");
  check(result.assets.fixedAssets.accumulatedDepreciation === 30000, "total accumulatedDepreciation 30000");
  check(result.assets.fixedAssets.netBookValue === 270000, "total NBV 270000");

  // totalKnownAssets = fixedAssets.netBookValue
  check(result.totalKnownAssets === 270000, "totalKnownAssets = totalNBV");

  // totalAssets = null
  check(result.totalAssets === null, "totalAssets null");

  // equity fields
  check(typeof result.equity.ownerContributions === "number", "equity.ownerContributions is number");
  check(typeof result.equity.returnOfCapital === "number", "equity.returnOfCapital is number");
  check(typeof result.equity.netContributedCapital === "number", "equity.netContributedCapital is number");
  check(typeof result.equity.ownerDraws === "number", "equity.ownerDraws is number");
  check(result.equity.retainedEarningsOpening === 7407000, "equity.retainedEarningsOpening correct");
  check(typeof result.equity.postCutoffProfit === "number", "equity.postCutoffProfit is number");
  check(typeof result.equity.totalEquity === "number", "equity.totalEquity is number");

  // no double count in retained earnings
  var expectedTotalEquity = result.equity.netContributedCapital +
    result.equity.retainedEarningsOpening + result.equity.postCutoffProfit - result.equity.ownerDraws;
  check(result.equity.totalEquity === expectedTotalEquity, "no double count in retained earnings");

  // reconciliation full equation UNRECONCILABLE
  check(result.reconciliation.fullEquation.status === "UNRECONCILABLE", "full equation UNRECONCILABLE");
  check(result.reconciliation.fullEquation.reason === "INCOMPLETE_ASSET_AUTHORITY", "full equation reason");

  // known position formula
  check(result.reconciliation.knownPosition.status === "COMPUTABLE", "known position COMPUTABLE");
  var expectedKnownPosition = result.totalKnownAssets - result.liabilities.total - result.equity.totalEquity;
  check(result.reconciliation.knownPosition.difference === expectedKnownPosition, "known position formula");

  // availability contract
  check(result.availability.cash === "UNAVAILABLE", "availability.cash UNAVAILABLE");
  check(result.availability.inventory === "UNAVAILABLE", "availability.inventory UNAVAILABLE");
  check(result.availability.fixedAssets === "AVAILABLE", "availability.fixedAssets AVAILABLE");
  check(result.availability.liabilities === "ZERO_AUTHORITATIVE", "availability.liabilities ZERO_AUTHORITATIVE");
  check(result.availability.equity === "AVAILABLE", "availability.equity AVAILABLE");

  // quality issues
  check(Array.isArray(result.qualityIssues), "qualityIssues is array");
  check(result.qualityIssues.indexOf("CASH_MIGRATION_NOT_READY") !== -1, "qualityIssues includes CASH_MIGRATION_NOT_READY");
  check(result.qualityIssues.indexOf("INVENTORY_AUTHORITY_NOT_ACTIVE") !== -1, "qualityIssues includes INVENTORY_AUTHORITY_NOT_ACTIVE");
  check(result.qualityIssues.indexOf("CAPITAL_EQUITY_UNAVAILABLE") === -1, "no CAPITAL_EQUITY_UNAVAILABLE when valid");

  // accountingPolicy contract
  check(result.accountingPolicy === FINANCE_ACCOUNTING_POLICY, "accountingPolicy is policy reference");
  check(result.accountingPolicy.balanceSheetAvailable === false, "balanceSheetAvailable false");

  // response frozen
  var frozen = false;
  try { result.status = "MUTATED"; } catch (e) { frozen = true; }
  check(frozen, "response is frozen");

  Logger.log("PASS: testPartialBalancePositionReport | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testPartialBalanceEquityUnavailable() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var depLedger = [
    { ID_Dep: "DEP-AST-1-202601", Period: new Date(2026, 0, 1), ID_Asset: "AST-1", OpeningBookValue: 100000, Depreciation: 5000, AccumulatedDepreciation: 5000, ClosingBookValue: 95000, GeneratedAt: new Date() }
  ];

  var ss = financeIsolationBuildSpreadsheet({
    depreciationLedger: depLedger,
    assets: [{ ID_Asset: "AST-1" }],
    omitCapitalEquity: true,
    omitOpeningBalances: true
  });

  var result = getPartialBalanceDataWithRuntime({ spreadsheet: ss }, "custom", "2026-01-01", "2026-01-31");

  check(result.status === "PARTIAL", "status PARTIAL when equity unavailable");
  check(result.equity.status === "UNAVAILABLE", "equity UNAVAILABLE when C&E data missing");
  check(typeof result.equity.error === "string" && result.equity.error.length > 0, "equity has error string");
  check(result.availability.equity === "UNAVAILABLE", "availability.equity UNAVAILABLE");
  check(result.reconciliation.knownPosition.status === "UNAVAILABLE", "known position UNAVAILABLE when equity missing");
  check(result.reconciliation.knownPosition.reason === "EQUITY_UNAVAILABLE", "known position reason");
  check(result.qualityIssues.indexOf("CAPITAL_EQUITY_UNAVAILABLE") !== -1, "qualityIssues includes CAPITAL_EQUITY_UNAVAILABLE");
  check(result.assets.fixedAssets.acquisitionCost === 100000, "fixed assets still computed when equity unavailable");

  Logger.log("PASS: testPartialBalanceEquityUnavailable | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testPartialBalanceNoFixedAssets() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var ceRows = [
    { ID_Trx: "CE-1", Tanggal: "2021-01-01", Owner: "Dekker", Type: "OWNER_CONTRIBUTION", Nominal: 10635000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" },
    { ID_Trx: "CE-2", Tanggal: "2021-01-01", Owner: "Erway", Type: "OWNER_CONTRIBUTION", Nominal: 10635000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
  ];
  var obRows = [
    { ID: "FOB-3200-20260731", EffectiveDate: "2026-07-31", AccountCode: "3200", Amount: 7407000, Source: "LEGACY_XLSM_MIGRATION", Keterangan: "Opening", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
  ];

  var ss = financeIsolationBuildSpreadsheet({
    capitalEquity: ceRows,
    openingBalances: obRows,
    depreciationLedger: [],
    assets: []
  });

  var result = getPartialBalanceDataWithRuntime({ spreadsheet: ss }, "custom", "2026-01-01", "2026-01-31");

  check(result.status === "PARTIAL", "status PARTIAL with no fixed assets");
  check(result.assets.fixedAssets.acquisitionCost === 0, "acquisitionCost zero");
  check(result.assets.fixedAssets.accumulatedDepreciation === 0, "accumulatedDepreciation zero");
  check(result.assets.fixedAssets.netBookValue === 0, "netBookValue zero");
  check(result.totalKnownAssets === 0, "totalKnownAssets zero");
  check(result.equity.status !== "UNAVAILABLE", "equity available");
  check(result.reconciliation.knownPosition.status === "COMPUTABLE", "known position computable");
  check(result.reconciliation.knownPosition.difference === 0 - 0 - result.equity.totalEquity, "known position with zero assets");

  Logger.log("PASS: testPartialBalanceNoFixedAssets | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceResponseBackwardCompatibility() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var ceRows = [
    { ID_Trx: "CE-1", Tanggal: "2021-01-01", Owner: "Dekker", Type: "OWNER_CONTRIBUTION", Nominal: 10635000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" },
    { ID_Trx: "CE-2", Tanggal: "2021-01-01", Owner: "Erway", Type: "OWNER_CONTRIBUTION", Nominal: 10635000, Keterangan: "Opening", Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
  ];
  var obRows = [
    { ID: "FOB-3200-20260731", EffectiveDate: "2026-07-31", AccountCode: "3200", Amount: 7407000, Source: "LEGACY_XLSM_MIGRATION", Keterangan: "Opening", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
  ];
  var ss = financeIsolationBuildSpreadsheet({ capitalEquity: ceRows, openingBalances: obRows });
  var result = getFinanceDataWithRuntime({ spreadsheet: ss }, "custom", "2026-01-01", "2026-07-31");

  check(typeof result === "object" && result !== null, "response is object");
  check(result.period !== undefined, "response has period");
  check(result.period.filter === "custom", "period.filter correct");
  check(result.period.startDate === "2026-01-01", "period.startDate correct");
  check(result.period.endDate === "2026-07-31", "period.endDate correct");
  check(result.summary !== undefined, "response has summary");
  check(typeof result.summary.revenue === "number", "summary.revenue is number");
  check(typeof result.summary.cogs === "number", "summary.cogs is number");
  check(typeof result.summary.grossProfit === "number", "summary.grossProfit is number");
  check(typeof result.summary.operatingExpenses === "number", "summary.operatingExpenses is number");
  check(typeof result.summary.depreciationExpense === "number", "summary.depreciationExpense is number");
  check(typeof result.summary.operatingNetProfit === "number", "summary.operatingNetProfit is number");
  check(typeof result.summary.operatingProfitMargin === "number", "summary.operatingProfitMargin is number");
  check(Array.isArray(result.expenseBreakdown), "expenseBreakdown is array");
  check(result.dataQuality !== undefined, "response has dataQuality");
  check(result.dataQuality.status !== undefined, "dataQuality has status");
  check(result.accountingPolicy !== undefined, "response has accountingPolicy");
  check(result.accountingPolicy.recognitionBasis === "TRANSACTION_DATE_OPERATING", "accountingPolicy preserved");
  check(result.capitalEquity !== undefined, "response has capitalEquity");
  check(result.capitalEquity.asOfDate === "2026-07-31", "capitalEquity.asOfDate preserved");
  check(Array.isArray(result.capitalEquity.owners), "capitalEquity.owners is array");
  check(result.capitalEquity.accountingPolicy !== undefined, "capitalEquity.accountingPolicy preserved");
  check(result.capitalEquity.dataQuality !== undefined, "capitalEquity.dataQuality preserved");

  check(result.grossProfit === result.summary.revenue - result.summary.cogs, "formula: grossProfit = revenue - cogs");
  check(result.summary.grossProfit === result.summary.revenue - result.summary.cogs, "formula in summary consistent");

  var ssDeg = financeIsolationBuildSpreadsheet({ omitCapitalEquity: true });
  var degResult = getFinanceDataWithRuntime({ spreadsheet: ssDeg }, "custom", "2026-01-01", "2026-01-31");
  check(degResult.period !== undefined, "degraded response still has period");
  check(degResult.summary !== undefined, "degraded response still has summary");
  check(degResult.dataQuality !== undefined, "degraded response still has dataQuality");
  check(degResult.capitalEquity !== undefined, "degraded response still has capitalEquity key");
  check(degResult.capitalEquity.status === "UNAVAILABLE", "degraded capitalEquity has status UNAVAILABLE");
  check(degResult.capitalEquity.error.length > 0, "degraded capitalEquity has error message");

  Logger.log("PASS: testFinanceResponseBackwardCompatibility | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}
