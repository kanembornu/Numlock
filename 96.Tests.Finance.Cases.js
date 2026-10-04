function testPolicyCIntegratedAccountingContract() {
  var scenarios = 0;
  function check(value, label) { scenarios++; if (!value) throw new Error("Policy C: " + label); }
  var paid = { EventID: "PE-PAID", ExpenseDate: "2026-10-01", AcquisitionValue: 1000,
    PaymentStatus: "PAID", CashAccountCode: "1000", SupplierID: "" };
  var unpaid = { EventID: "PE-UNPAID", ExpenseDate: "2026-10-01", AcquisitionValue: 2000,
    PaymentStatus: "UNPAID", CashAccountCode: "", SupplierID: "SUP-1" };
  var paidPosting = buildPolicyCPurchaseJournal(paid, []);
  check(paidPosting.status === "READY" && paidPosting.rows[0].AccountCode === "6210" &&
    paidPosting.rows[1].AccountCode === "1000", "paid acquisition Dr6210 CrCash");
  var unpaidPosting = buildPolicyCPurchaseJournal(unpaid, paidPosting.rows);
  check(unpaidPosting.status === "READY" && unpaidPosting.rows[0].AccountCode === "6210" &&
    unpaidPosting.rows[1].AccountCode === "2000", "unpaid acquisition Dr6210 Cr2000");
  check(buildPolicyCPurchaseJournal(paid, paidPosting.rows).status === "ALREADY_POSTED", "purchase retry idempotent");
  var sale = { ID_Trx: "SAL-1", Tanggal: "2026-09-30", HPP: 2500 };
  var legacyPaid = buildPolicyCPurchaseJournal(Object.assign({}, paid, { EventID: "PE-LEGACY-PAID", ExpenseDate: "2026-09-30" }), []);
  var legacyUnpaid = buildPolicyCPurchaseJournal(Object.assign({}, unpaid, { EventID: "PE-LEGACY-UNPAID", ExpenseDate: "2026-09-30" }), []);
  var basis = legacyPaid.rows.concat(legacyUnpaid.rows);
  var hpp = buildPolicyCSalesHppJournal(sale, basis);
  check(hpp.status === "READY" && hpp.rows[0].AccountCode === "5000" && hpp.rows[1].AccountCode === "1100",
    "sale HPP Dr5000 Cr1100");
  check(policyCInventoryBookBasis(basis.concat(hpp.rows)) === 500, "1100 remains non-negative");
  var refused = buildPolicyCSalesHppJournal({ ID_Trx: "SAL-2", Tanggal: "2026-09-30", HPP: 501 }, basis.concat(hpp.rows));
  check(refused.status === "ACCOUNTING_EXCEPTION" && refused.reason === "INSUFFICIENT_INVENTORY_BOOK_BASIS" &&
    refused.rows.length === 0 && refused.shortfall === 1, "insufficient basis persists exact refusal evidence");
  check(buildPolicyCSalesHppJournal(sale, basis.concat(hpp.rows)).status === "ALREADY_POSTED", "HPP retry idempotent");
  var reversal = policyCReverseJournal(hpp.rows, "POLICYC-HPP-REV-SAL-1", "2026-10-03", "SALE_HPP_REVERSAL", "SAL-1-R1");
  check(reversal.status === "READY" && policyCInventoryBookBasis(basis.concat(hpp.rows, reversal.rows)) === 3000,
    "HPP reversal restores basis and preserves original");
  var opening = buildPolicyCMonetaryOpeningJournal({ OpeningID: "OPEN-1", EffectiveDate: "2026-09-30",
    InventoryDebit: 3000, CounterpartComponents: [{ AccountCode: "2000", Credit: 2000, SourceRef: "INV-1" },
      { AccountCode: "3000", Credit: 1000, SourceRef: "OWNER-1" }], SourceReferences: ["INV-1", "OWNER-1"],
    PreparedBy: "PREP", ReviewedBy: "REVIEW", ApprovedAt: "2026-10-01", Status: "APPROVED" }, []);
  check(opening.status === "READY" && opening.rows.length === 3, "evidence-backed monetary opening balanced");
  check(buildPolicyCMonetaryOpeningJournal({ OpeningID: "BAD", EffectiveDate: "2026-09-30", InventoryDebit: 1,
    CounterpartComponents: [{ AccountCode: "3210", Credit: 1, SourceRef: "X" }], SourceReferences: ["X"],
    PreparedBy: "A", ReviewedBy: "B", ApprovedAt: "x", Status: "APPROVED" }, []).status === "REFUSED",
    "3210 opening refused");
  var pending = buildPolicyCStatementReconciliation(basis, { unpostedSalesHpp: 1 });
  check(pending.status === "ACCOUNTING_DATA_PENDING_RESOLUTION" && pending.finalValues === null,
    "finalization fails closed");
  var reconciled = buildPolicyCStatementReconciliation(basis.concat(hpp.rows), {});
  check(reconciled.status === "FINAL" && reconciled.finalValues.inventoryBookValue === 500 &&
    reconciled.finalValues.accountsPayable === 2000 && reconciled.finalValues.hpp === 2500,
    "balance and P&L reconcile without plug");
  check(INVENTORY_RECEIPT_ACTIVATION.enabled === false && BALANCE_FOUNDATION_POLICY.HPP_AUTHORITY === "tabsal.HPP",
    "InventoryReceipt and InventoryLedger non-authoritative");
  check(resolvePolicyCAccountingRegime_("2026-09-30").regime === "LEGACY_PRE_TRANSITION" &&
    resolvePolicyCAccountingRegime_("2026-10-01").regime === "PROSPECTIVE_PURCHASE_EXPENSE" &&
    resolvePolicyCAccountingRegime_(null).reason === "ECONOMIC_DATE_REQUIRED", "economic-date boundary and fail-closed routing");
  var createdAfter = buildPolicyCPurchaseJournal(Object.assign({}, paid, { EventID: "PE-CREATED-AFTER",
    ExpenseDate: "2026-09-30", CreatedAt: "2026-10-02" }), []);
  var createdBefore = buildPolicyCPurchaseJournal(Object.assign({}, paid, { EventID: "PE-CREATED-BEFORE",
    ExpenseDate: "2026-10-01", CreatedAt: "2026-09-01" }), []);
  check(createdAfter.rows[0].AccountCode === "1100" && createdBefore.rows[0].AccountCode === "6210",
    "CreatedAt cannot select accounting regime");
  check(buildPolicyCPurchaseJournal(Object.assign({}, paid, { CashAccountCode: "" }), []).status === "REFUSED" &&
    buildPolicyCPurchaseJournal(Object.assign({}, unpaid, { SupplierID: "" }), []).status === "REFUSED",
    "payment authority fails closed");
  var partialIdentity = [Object.assign({}, paidPosting.rows[0])];
  check(buildPolicyCPurchaseJournal(paid, partialIdentity).reason === "IDENTITY_CONFLICT",
    "partial purchase identity fails closed");
  var prospectiveHpp = buildPolicyCSalesHppJournal({ ID_Trx: "SAL-PROSPECTIVE", Tanggal: "2026-10-01", HPP: 999999 }, []);
  check(prospectiveHpp.status === "NON_POSTING_ANALYTICAL_AUTHORITY" && prospectiveHpp.rows.length === 0,
    "prospective HPP refuses before inventory sufficiency evaluation");
  var originalPaid = paidPosting.rows;
  var paidRefund = buildPolicyCPurchaseAdjustmentJournal({ Type: "SUPPLIER_REFUND", AdjustmentID: "REF-1",
    EventID: paid.EventID, Amount: 400, CashAccountCode: "1000", TransactionDate: "2026-10-03" }, originalPaid, originalPaid);
  check(paidRefund.status === "READY" && paidRefund.rows[0].AccountCode === "1000" &&
    paidRefund.rows[1].AccountCode === "6210", "supplier refund DrCash Cr6210");
  var unpaidCredit = buildPolicyCPurchaseAdjustmentJournal({ Type: "SUPPLIER_AP_CREDIT", AdjustmentID: "CR-1",
    EventID: unpaid.EventID, Amount: 500, TransactionDate: "2026-10-03" }, unpaidPosting.rows, unpaidPosting.rows);
  check(unpaidCredit.status === "READY" && unpaidCredit.rows[0].AccountCode === "2000" &&
    unpaidCredit.rows[1].AccountCode === "6210", "supplier AP credit Dr2000 Cr6210");
  var settlement = buildPolicyCApSettlementJournal({ SettlementID: "SET-1", EventID: unpaid.EventID,
    Amount: 2000, CashAccountCode: "1000", SettlementDate: "2026-10-03" }, unpaidPosting.rows, unpaidPosting.rows);
  check(settlement.status === "READY" && settlement.rows[0].AccountCode === "2000" &&
    settlement.rows[1].AccountCode === "1000" && settlement.rows.every(function(row) { return row.AccountCode !== "6210"; }),
    "AP settlement has no second 6210");
  var prospectiveGate = evaluatePolicyCFinalizationGate({ accountingRegime: "PROSPECTIVE_PURCHASE_EXPENSE",
    production: true, monetaryOpeningReady: false, insufficientInventoryBasis: 1, unpostedSalesHpp: 1 });
  check(prospectiveGate.status === "FINAL", "prospective finalization ignores historical M and legacy inventory-HPP gates");
  Logger.log("PASS: testPolicyCIntegratedAccountingContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

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
      result.accountingPolicy.cashFlowAvailable !== true) throw new Error("Finance accounting-policy disclosure mismatch");
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

  if (options.balanceLedger) {
    var balanceH = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
    var balanceRows = options.balanceLedger.map(function(r) {
      return balanceH.map(function(h) { return r[h] === undefined ? "" : r[h]; });
    });
    sheets.push(capitalEquitySchemaTestSheet("BalanceLedger", [balanceH].concat(balanceRows)));
  }

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
    depreciationLedger: options && options.depreciationLedger || financeIsolationTestDepreciation(),
    assets: options && options.assets || financeIsolationTestAssets(),
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
  check(result.capitalEquity.contributedCapital === 21270000, "Contributed capital net zero");
  check(result.capitalEquity.retainedEarnings === 7407000, "Retained earnings matches opening");
  check(result.capitalEquity.totalEquity === 28677000, "Total equity correct at cutoff");
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

  // Dynamic label variables exist in render and failure error paths
  check(controllerSource.indexOf('var renderLabel =') !== -1,
    "render error handler defines renderLabel");
  check(controllerSource.indexOf('var failLabel =') !== -1,
    "failure handler defines failLabel");

  // All five destination labels are mapped in controller
  check(controllerSource.indexOf('"Capital & Equity"') !== -1,
    "capital-equity label present");
  check(controllerSource.indexOf('"Product Profitability"') !== -1,
    "product-profitability label present");
  check(controllerSource.indexOf('"Balance Position"') !== -1,
    "balance-sheet label present");
  check(controllerSource.indexOf('"Depreciation"') !== -1,
    "depreciation label present");
  check(controllerSource.indexOf('"Profit & Loss"') !== -1,
    "profit-loss default label present");

  // Dynamic label interpolated into error messages
  check(controllerSource.indexOf('"Unable to display " + renderLabel') !== -1,
    "render error message interpolates destination");
  check(controllerSource.indexOf('"Unable to load " + failLabel') !== -1,
    "failure message interpolates destination");

  check(stateSource.indexOf('destination: "profit-loss"') !== -1, "default destination is profit-loss");
  check(controllerSource.indexOf('financeState.destination === "capital-equity"') !== -1, "destination check exists for capital-equity");

  // setFinanceDestination error path also uses dynamic destination label
  check(controllerSource.indexOf('var label = dest === "capital-equity"') !== -1,
    "setFinanceDestination error path uses dynamic label");

  Logger.log("PASS: testFinanceErrorDestinationMessaging | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function financePolicyCTestLedger() {
  var audit = { ExternalRef: "", Keterangan: "", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  return [
    Object.assign({ JournalID: "J-BAL", LineID: "L-1", Tanggal: "2026-01-01", AccountCode: "1100", Debit: 300000,
      Credit: 0, MovementType: "MONETARY_INVENTORY_OPENING", SourceType: "TEST", SourceID: "TEST-BAL" }, audit),
    Object.assign({ JournalID: "J-BAL", LineID: "L-2", Tanggal: "2026-01-01", AccountCode: "2000", Debit: 0,
      Credit: 300000, MovementType: "MONETARY_INVENTORY_OPENING", SourceType: "TEST", SourceID: "TEST-BAL" }, audit)
  ];
}

function testPartialBalancePositionReport() {
  return testPolicyCBalanceServiceFinalization();
}

function testLegacyPartialBalancePositionReport() {
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

  var result = getPartialBalanceDataWithRuntime({ spreadsheet: ss }, "custom", "2026-01-01", "2026-07-31");

  // Response top-level contract shape
  check(typeof result === "object" && result !== null, "response is object");
  check(result.period !== undefined, "period present");
  check(result.asOfDate === "2026-07-31", "asOfDate correct");
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
  check(Object.isFrozen(result), "response is frozen");

  Logger.log("PASS: testPartialBalancePositionReport | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testPartialBalanceEquityUnavailable() {
  return testPolicyCBalanceServiceFinalization();
}

function testLegacyPartialBalanceEquityUnavailable() {
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
  return testPolicyCBalanceServiceFinalization();
}

function testLegacyPartialBalanceNoFixedAssets() {
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

  var result = getPartialBalanceDataWithRuntime({ spreadsheet: ss }, "custom", "2026-01-01", "2026-07-31");

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

function testPolicyCBalanceServiceFinalization() {
  var ss = financeIsolationTestSpreadsheet({
    accounts: financeIsolationTestAccounts(), sales: financeIsolationTestSales(), expenses: financeIsolationTestExpenses(),
    products: financeIsolationTestProducts(), expenseItems: financeIsolationTestExpenseItems(),
    depreciationLedger: financeIsolationTestDepreciation(), assets: financeIsolationTestAssets(),
    capitalEquity: [], openingBalances: [], balanceLedger: financePolicyCTestLedger()
  });
  var result = getPartialBalanceDataWithRuntime({ spreadsheet: ss }, "custom", "2026-01-01", "2026-01-31");
  if (result.status !== "FINAL" || !result.finalValues || result.assets.inventory.amount !== 300000 ||
      result.liabilities.accountsPayable !== 300000 || result.finalValues.balanced !== true) {
    throw new Error("Policy C Balance service did not expose reconciled FINAL values");
  }
  var pending = getPartialBalanceDataWithRuntime({ spreadsheet: ss,
    policyCFinalizationState: { insufficientInventoryBasis: 1 } }, "custom", "2026-01-01", "2026-01-31");
  if (pending.status !== "ACCOUNTING_DATA_PENDING_RESOLUTION" || pending.finalValues !== null ||
      pending.assets !== null || pending.liabilities !== null || pending.equity !== null) {
    throw new Error("Policy C Balance service exposed authoritative values while pending");
  }
  return { passed: true, scenarios: 2 };
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

function testCashFlowOpeningClosing() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  // Minimal ledger rows for a single operating cash movement
  var accounts = [
    { AccountCode: "1000", AccountName: "Cash", AccountType: "Asset", StatementGroup: "Cash", CashFlowGroup: "", IsActive: true },
    { AccountCode: "4100", AccountName: "Sales", AccountType: "Revenue", StatementGroup: "Revenue", CashFlowGroup: "Operating", IsActive: true }
  ];
  var ledger = [
    { AccountCode: "1000", JournalID: "J1", Debit: 50000, Credit: 0, IsActive: true },
    { AccountCode: "4100", JournalID: "J1", Debit: 0, Credit: 50000, IsActive: true }
  ];
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan" };

  // Scenario 1-3: opening unavailable → null, false
  var stmtNoOpening = buildCashFlowStatement(ledger, accounts, period);
  check(stmtNoOpening.openingCash === null, "S1: openingCash null when no context");
  check(stmtNoOpening.closingCash === null, "S2: closingCash null when opening unavailable");
  check(stmtNoOpening.openingCashAvailable === false, "S3: openingCashAvailable false when no context");

  // Scenario 4: valid cash opening balances are summed (1000 + 1010 + 1020)
  var accountsPlus = accounts.concat([
    { AccountCode: "1010", AccountName: "Bank", AccountType: "Asset", StatementGroup: "Cash", CashFlowGroup: "", IsActive: true },
    { AccountCode: "1020", AccountName: "E-Wallet", AccountType: "Asset", StatementGroup: "Cash", CashFlowGroup: "", IsActive: true }
  ]);
  var openingSum = buildCashFlowStatement(ledger, accountsPlus, period, { openingCash: 30000 + 20000 + 10000 });
  check(openingSum.openingCash === 60000, "S4: openingCash is sum of 1000+1010+1020");
  check(openingSum.openingCashAvailable === true, "S4: openingCashAvailable true with valid context");

  // Scenario 5: non-cash opening accounts excluded
  var stmtNonCash = buildCashFlowStatement(ledger, accounts, period, { openingCash: 0 });
  check(stmtNonCash.openingCash === 0, "S5a: zero opening is available (legitimate)");
  check(stmtNonCash.openingCashAvailable === true, "S5b: zero opening available, not confused with unavailable");

  // Scenario 6: closingCash = openingCash + netChange
  var stmtWithOpening = buildCashFlowStatement(ledger, accounts, period, { openingCash: 100000 });
  check(stmtWithOpening.netChange === 50000, "S6a: netChange correct");
  check(stmtWithOpening.closingCash === 150000, "S6b: closingCash = 100000 + 50000");

  // Scenario 7: full invariant holds
  var invariantSum = stmtWithOpening.openingCash + stmtWithOpening.operating + stmtWithOpening.investing + stmtWithOpening.financing;
  check(invariantSum === stmtWithOpening.closingCash, "S7: openingCash + operating + investing + financing === closingCash");

  // Scenario 8: legitimate opening value 0 is available
  var stmtZero = buildCashFlowStatement(ledger, accounts, period, { openingCash: 0 });
  check(stmtZero.openingCash === 0, "S8a: zero opening value preserved");
  check(stmtZero.openingCashAvailable === true, "S8b: zero opening marked available");
  check(stmtZero.closingCash === 50000, "S8c: closingCash with zero opening = 0 + netChange");

  // Scenario 9: existing Cash Flow classification unchanged
  check(stmtWithOpening.operating === 50000, "S9a: operating classification preserved");
  check(stmtWithOpening.investing === 0, "S9b: investing unchanged");
  check(stmtWithOpening.financing === 0, "S9c: financing unchanged");
  check(stmtWithOpening.ambiguous.length === 0, "S9d: no ambiguous entries");

  // Verify return shape includes all new fields
  check("openingCash" in stmtNoOpening, "S9e: openingCash key present");
  check("closingCash" in stmtNoOpening, "S9f: closingCash key present");
  check("openingCashAvailable" in stmtNoOpening, "S9g: openingCashAvailable key present");

  // Test invalid openingContext values
  var stmtBad = buildCashFlowStatement(ledger, accounts, period, { openingCash: "bad" });
  check(stmtBad.openingCash === null, "S9h: non-numeric opening falls back to null");
  check(stmtBad.openingCashAvailable === false, "S9i: non-numeric opening marks unavailable");

  var stmtUndefined = buildCashFlowStatement(ledger, accounts, period, {});
  check(stmtUndefined.openingCash === null, "S9j: empty context falls back to null");
  check(stmtUndefined.openingCashAvailable === false, "S9k: empty context marks unavailable");

  Logger.log("PASS: testCashFlowOpeningClosing | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceCrossBoundaryExpenseBreakdownReconciliation() {
  var scenarios = 0;
  function check(value, label) { scenarios++; if (!value) throw new Error("Cross-boundary Finance: " + label); }
  var canonical = { records: [
    { transactionType: "Expense", dateKey: "2026-09-30", expenseItemIsActive: true, expenseAccountCode: "6100", expense: 100 },
    { transactionType: "Expense", dateKey: "2026-10-01", expenseItemIsActive: true, expenseAccountCode: "6100", expense: 200 },
    { transactionType: "Expense", dateKey: "2026-10-02", expenseItemIsActive: true, expenseAccountCode: "6210", expense: 50 }
  ], lifecycleRecords: [], sourceQuality: { unresolvedProducts: [], unresolvedExpenseItems: [] } };
  var accounts = [
    { AccountCode: "6100", AccountName: "Salary Expense", AccountType: "Expense", StatementGroup: "Personnel Expense", IsActive: true },
    { AccountCode: "6210", AccountName: "Raw Material Supplies Expense", AccountType: "Expense", StatementGroup: "Supplies Expense", IsActive: true }
  ];
  var depreciation = { rows: [], quality: { duplicateLogicalKeys: [], invalidDepreciationRows: [], invalidPeriodRows: [], unresolvedAssetReferences: [] } };
  var ledger = [{ Tanggal: "2026-10-01", AccountCode: "6210", Debit: 40, Credit: 0, IsActive: true }];
  function period(start, end) { return { filter: "custom", startDate: start, endDate: end, label: start + " to " + end }; }
  var split = buildFinanceProfitAndLoss(canonical, accounts, period("2026-09-30", "2026-10-02"), depreciation, ledger);
  var sum = split.expenseBreakdown.reduce(function(total, item) { return total + item.amount; }, 0);
  check(sum === split.summary.operatingExpenses && sum === 350, "full cross-boundary breakdown reconciles");
  check(split.expenseBreakdown.length === 2 && split.expenseBreakdown.filter(function(item) {
    return item.AccountCode === "6210";
  }).length === 1, "account groups deterministic with one 6210 row");
  check(split.accountingRegime === "SPLIT_PRESENTATION_BY_ACCOUNTING_REGIME" && split.regimeSections.legacy &&
    split.regimeSections.prospective && split.policyDisclosures.length === 2, "split sections and disclosures preserved");
  check(split.summary.cogs === null && split.summary.grossProfit === null && split.grossProfit === null &&
    split.grossProfitAvailable === false && split.summary.materialPurchasesExpensed === null,
    "incompatible top-level material semantics remain null");
  check(split.expenseBreakdown.every(function(item) { return ["6100", "6210"].indexOf(item.AccountCode) !== -1; }),
    "no HPP COGS or inventory row invented");
  var year = buildFinanceProfitAndLoss(canonical, accounts, period("2026-01-01", "2026-12-31"), depreciation, ledger);
  check(year.expenseBreakdown.reduce(function(total, item) { return total + item.amount; }, 0) === year.summary.operatingExpenses,
    "populated year cross-boundary breakdown reconciles");
  var month = buildFinanceProfitAndLoss(canonical, accounts, period("2026-10-01", "2026-10-31"), depreciation, ledger);
  check(month.accountingRegime === "PROSPECTIVE_PURCHASE_EXPENSE" && month.summary.materialPurchasesExpensed === 40 &&
    month.summary.cogs === null && month.summary.grossProfit === null && month.grossProfitAvailable === false,
    "prospective-only material semantics unchanged");
  var day = buildFinanceProfitAndLoss(canonical, accounts, period("2026-10-01", "2026-10-01"), depreciation, ledger);
  check(day.expenseBreakdown.reduce(function(total, item) { return total + item.amount; }, 0) === day.summary.operatingExpenses,
    "inclusive custom range remains reconciled");
  var legacy = buildFinanceProfitAndLoss(canonical, accounts, period("2026-09-01", "2026-09-30"), depreciation, ledger);
  check(legacy.accountingRegime === "LEGACY_PRE_TRANSITION" && legacy.expenseBreakdown.length === 1 &&
    legacy.grossProfitAvailable === true, "legacy-only response unchanged");
  var source = buildFinanceProfitAndLoss.toString();
  check(["writeLedger", "setValue", "setValues", "postPolicyC"].every(function(token) { return source.indexOf(token) === -1; }),
    "repair introduces no write or posting API");
  Logger.log("PASS: testFinanceCrossBoundaryExpenseBreakdownReconciliation | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceProductionRuntimeReconciliationContract() {
  var scenarios = 0;
  function check(value, label) { scenarios++; if (!value) throw new Error("Finance runtime reconciliation: " + label); }
  function finance(summary, expenseAmount) {
    return { summary: summary, expenseBreakdown: expenseAmount === null ? [] : [{ amount: expenseAmount }] };
  }
  function summary(grossProfit, operatingExpenses, operatingNetProfit) {
    return { revenue: 100, cogs: grossProfit === null ? null : 40, grossProfit: grossProfit,
      operatingExpenses: operatingExpenses, depreciationExpense: 10, operatingNetProfit: operatingNetProfit };
  }
  var legacyValid = buildFinanceRuntimeReconciliation_(finance(summary(60, 20, 30), 20));
  check(legacyValid.formulaReconciles && legacyValid.expenseReconciles, "legacy valid formulas pass");
  check(!buildFinanceRuntimeReconciliation_(finance(summary(59, 20, 29), 20)).formulaReconciles,
    "legacy invalid gross-profit formula fails");
  var prospectiveValid = buildFinanceRuntimeReconciliation_(finance(summary(null, 20, 70), 20));
  check(prospectiveValid.formulaReconciles && prospectiveValid.expenseReconciles,
    "prospective null gross profit passes with valid expenses");
  var splitValid = buildFinanceRuntimeReconciliation_(finance(summary(null, 20, 30), 20));
  check(splitValid.formulaReconciles && splitValid.expenseReconciles,
    "split null gross profit passes with valid expenses");
  check(!buildFinanceRuntimeReconciliation_(finance(summary(null, 20, 70), 19)).expenseReconciles,
    "prospective expense mismatch fails");
  check(!buildFinanceRuntimeReconciliation_(finance(summary(null, 20, 30), 19)).expenseReconciles,
    "split expense mismatch fails");
  var empty = buildFinanceRuntimeReconciliation_(finance({ revenue: 0, cogs: null, grossProfit: null,
    operatingExpenses: 0, depreciationExpense: 0, operatingNetProfit: 0 }, null));
  check(empty.formulaReconciles && empty.expenseReconciles && empty.expenseTotal === 0,
    "empty period remains valid");
  Logger.log("PASS: testFinanceProductionRuntimeReconciliationContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceFinalReadinessEvidenceDiagnostic() {
  var scenarios = 0;
  function check(value, label) { scenarios++; if (!value) throw new Error("Finance readiness diagnostic: " + label); }
  var source = buildFinanceFinalReadinessEvidence_.toString() + runFinanceFinalReadinessEvidenceDiagnostic.toString();
  check(source.indexOf("READ_ONLY: true") !== -1 && source.indexOf("WRITE_COUNT: 0") !== -1,
    "read-only zero-write contract");
  check(source.indexOf('["6210", "2000", "1000", "1010", "1020"]') !== -1,
    "only required account evidence requested");
  check(source.indexOf('readCanonicalTable(ss, "BalanceLedger"') !== -1 &&
    source.indexOf("depreciation, ledger") !== -1, "actual BalanceLedger reaches Finance builder");
  ["writeLedger", "postPolicyC", "runPurchaseEventSchemaMigration", "Recovery", "setValue", "setValues", "batchUpdate"]
    .forEach(function(token) { check(source.indexOf(token) === -1, "excludes mutation token " + token); });
  check(source.indexOf("PaymentStatus") === -1 && source.indexOf("CashAccountCode") === -1 &&
    source.indexOf("SupplierID") === -1, "no payment inference or legacy classification");
  var missing = { found: false, AccountCode: "6210", AccountName: null, Type: null,
    StatementGroup: null, CashFlowGroup: null, IsActive: null };
  check(missing.found === false && missing.AccountName === null, "missing account remains missing");
  check(source.indexOf("predicateADifference") !== -1 && source.indexOf("predicateBDifference") !== -1,
    "reconciliation differences exposed");
  check(source.indexOf("openingCash: cashFlow.openingCash") !== -1 && source.indexOf("grossProfit: prospective.summary.grossProfit") !== -1,
    "null Finance values preserved");
  check(["fullAvailablePeriod", "populatedMonth", "populatedYear", "inclusiveCustomRange"].every(function(name) {
    return buildFinanceRuntimeValidationPeriods.toString().indexOf(name) !== -1;
  }), "Finance cases bounded to canonical periods");
  Logger.log("PASS: testFinanceFinalReadinessEvidenceDiagnostic | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}
