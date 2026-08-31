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
  var financeSource = getFinanceData.toString() + buildFinanceProfitAndLoss.toString() +
    buildFinanceDepreciationSource.toString();
  ["getDashboardData(", "buildFinancial(", 'getSheetByName(\"Transaction\")', 'getSheetByName(\"Helper\")'].forEach(function(token) {
    if (financeSource.indexOf(token) !== -1) throw new Error("Finance forbidden dependency: " + token);
  });
  ["BiayaPerolehan", "UmurEkonomisBulan", "NilaiResidu", "calculateDepreciationSchedule"].forEach(function(token) {
    if (financeSource.indexOf(token) !== -1) throw new Error("Finance recalculates depreciation from Assets: " + token);
  });
  Logger.log("PASS: testFinanceCoreBackendContract | scenarios=35");
  return { passed: true, scenarios: 35 };
}
