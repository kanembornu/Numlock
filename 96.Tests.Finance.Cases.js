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
      { ID_Trx: "OPS-UNKNOWN-MASTER", Tanggal: new Date(2026, 0, 12), ID_Ops: "O404", Nilai: 1000, IsActive: true, sourceRowIndex: 8 }
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
      { ID_Ops: "O6", Item: "Missing Account", AccountCode: "", IsActive: true }
    ]
  };
  var accounts = [
    { AccountCode: "4100", AccountName: "Sales", AccountType: "Revenue", StatementGroup: "Revenue", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "5100", AccountName: "COGS", AccountType: "COGS", StatementGroup: "COGS", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "6100", AccountName: "Rent", AccountType: "Expense", StatementGroup: "Operating Expenses", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "6310", AccountName: "Equipment", AccountType: "Expense", StatementGroup: "Operating Expenses", CashFlowGroup: "Investing", IsActive: true },
    { AccountCode: "6200", AccountName: "Inactive Expense", AccountType: "Expense", StatementGroup: "Operating Expenses", CashFlowGroup: "Operating", IsActive: false }
  ];
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "January" };
  var result = buildFinanceProfitAndLoss(buildCanonicalTransactionData(source), accounts, period);
  var expectedSummary = { revenue: 92000, cogs: 32000, grossProfit: 60000,
    operatingExpenses: 12000, operatingNetProfit: 48000, operatingProfitMargin: 48000 / 92000 };
  if (JSON.stringify(result.summary) !== JSON.stringify(expectedSummary)) throw new Error("Finance P&L summary mismatch");
  if (result.expenseBreakdown.length !== 2 || result.expenseBreakdown[1].AccountCode !== "6310" ||
      result.expenseBreakdown[1].amount !== 7000) throw new Error("Finance expense account resolution or 6310 inclusion mismatch");
  if (result.dataQuality.excludedInactiveTransactions !== 2 || result.dataQuality.unresolvedProducts.length !== 2 ||
      result.dataQuality.unresolvedExpenseItems.length !== 4 || result.dataQuality.inactiveAccountMappings.length !== 1 ||
      result.dataQuality.status !== "ATTENTION") {
    throw new Error("Finance data-quality diagnostics mismatch");
  }
  var empty = buildFinanceProfitAndLoss(buildCanonicalTransactionData(source), accounts,
    { filter: "custom", startDate: "2025-01-01", endDate: "2025-01-31", label: "Empty" });
  if (empty.summary.revenue !== 0 || empty.summary.operatingProfitMargin !== 0 || empty.expenseBreakdown.length !== 0) {
    throw new Error("Finance empty-period or zero-revenue contract mismatch");
  }
  if (result.accountingPolicy.recognitionBasis !== "TRANSACTION_DATE_OPERATING" ||
      result.accountingPolicy.depreciationIncluded !== false || result.accountingPolicy.cashBalanceAvailable !== false ||
      result.accountingPolicy.inventoryBalanceAvailable !== false || result.accountingPolicy.balanceSheetAvailable !== false ||
      result.accountingPolicy.cashFlowAvailable !== false) throw new Error("Finance accounting-policy disclosure mismatch");
  var financeSource = getFinanceData.toString() + buildFinanceProfitAndLoss.toString();
  ["getDashboardData(", "buildFinancial(", 'getSheetByName(\"Transaction\")', 'getSheetByName(\"Helper\")'].forEach(function(token) {
    if (financeSource.indexOf(token) !== -1) throw new Error("Finance forbidden dependency: " + token);
  });
  Logger.log("PASS: testFinanceCoreBackendContract | scenarios=18");
  return { passed: true, scenarios: 18 };
}
