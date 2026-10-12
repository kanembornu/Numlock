// T11.6/U4 — canonical readers + aggregate funds (T11.2 §12-§15, D1/D11/D12).
// Focused local suites over the read authorities only: aggregate-funds
// projection, Balance Position, Cash Flow, Revenue/P&L, Transaction history,
// Dashboard semantics, T5 composed clearing, global 1030, date authority,
// read-mode/cache coherence, and regression pins. In-memory fixtures only;
// real U1 composed save artifacts where stated; no production access, no
// clasp, no config writes, no PropertiesService, no writes outside fixture
// memory.

// ---- fixtures -------------------------------------------------------------

function u4cBaseSheets_() {
  var base = treasuryT4BaseSheets_();
  base.ExpenseItems = [["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]];
  t11PushAccount_(base, t11Account1040_());
  return base;
}

// One REAL composed Sale through the U1 save core (ACTIVE config + exact §11
// 1040 row): 5 surfaces, 4 BalanceLedger rows (SRV2J recognition pair +
// SRV2M money pair), committed operation plan carrying composedMoney.
function u4cComposedSale_(options) {
  options = options || {};
  var fixture = salesV2SaveFixture_(u4cBaseSheets_());
  var runtime = t11Runtime_({ fixture: fixture, singleCommitConfig: t11ConfigRaw_("ACTIVE") });
  var result = salesRecognitionV2SaveWithRuntime_(
    salesV2SavePayload_(options.key || "u4c-sale-1"), runtime);
  if (result.status !== "DONE") {
    throw new Error("U4C_COMPOSED_SAVE_FAILED:" + result.status + ":" + result.code);
  }
  u3MirrorOperations_(fixture, runtime.repository);
  var plan = JSON.parse(runtime.repository.rows()[0].OperationPlan);
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  return { fixture: fixture, plan: plan, result: result, event: events[events.length - 1],
    orderID: plan.orderID, recognitionID: plan.recognitionID, amount: plan.orderTotal,
    moneyJournalID: plan.moneyJournalID };
}

function u4cLedgerRows_(fixture) {
  return readCanonicalTable(fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
}

// Splice rows whose SourceType matches (live fixture sheet values array).
function u4cStripSourceType_(fixture, sourceType) {
  var sheet = fixture.getSheetByName("BalanceLedger");
  var idx = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf("SourceType");
  for (var i = sheet.values.length - 1; i >= 0; i--) {
    if (String(sheet.values[i][idx]) === sourceType) sheet.values.splice(i, 1);
  }
}

// Mutate every SALES_MONEY_V2 ledger row in place (column offsets resolved
// from the canonical headers). Used for wrong-amount / wrong-account /
// lineage tamper fixtures.
function u4cTamperMoney_(fixture, mutate) {
  var sheet = fixture.getSheetByName("BalanceLedger");
  var headers = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var at = {};
  ["SourceType", "AccountCode", "Debit", "Credit", "JournalID", "SourceID", "MovementType"]
    .forEach(function(name) { at[name] = headers.indexOf(name); });
  for (var i = 1; i < sheet.values.length; i++) {
    if (String(sheet.values[i][at.SourceType]) === "SALES_MONEY_V2") {
      mutate(sheet.values[i], at);
    }
  }
}

// Mutate the committed SALE plan JSON (TransactionOperations) in place —
// signature/identity tamper fixtures.
function u4cTamperSalePlan_(fixture, mutate) {
  var sheet = fixture.getSheetByName("TransactionOperations");
  var headers = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS;
  var typeIdx = headers.indexOf("OperationType"), planIdx = headers.indexOf("OperationPlan");
  for (var i = 1; i < sheet.values.length; i++) {
    if (String(sheet.values[i][typeIdx]) === SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE) {
      var plan = JSON.parse(String(sheet.values[i][planIdx]));
      mutate(plan);
      sheet.values[i][planIdx] = JSON.stringify(plan);
    }
  }
}

function u4cFlowLedger_(spec) {
  return spec.map(function(entry, index) {
    var journalID = entry.JournalID || ("JF-" + index);
    return { JournalID: journalID, LineID: journalID + "-1", Tanggal: "2026-10-15",
      AccountCode: entry.code, Debit: entry.debit || 0, Credit: entry.credit || 0,
      MovementType: entry.movement || "TEST", SourceType: entry.sourceType || "TEST",
      SourceID: entry.sourceID || "TEST", IsActive: true };
  });
}

function u4cFlowAccounts_(codes) {
  var definitions = {
    "1030": ["Sales Settlement Clearing", "Asset", ""],
    "4000": ["Revenue", "Revenue", ""],
    "4100": ["Sales", "Revenue", "Operating"],
    "6100": ["Rent Expense", "Expense", ""],
    "6210": ["Raw Material Supplies Expense", "Expense", ""]
  };
  return codes.map(function(code) {
    // Monetary accounts reuse the EXACT frozen metadata (cash-foundation
    // opening validation compares every field), so Cash Flow and read-model
    // fixtures carry production-true rows.
    if (CASH_FOUNDATION_POLICY.ACCOUNT_METADATA[code]) {
      return Object.assign({ AccountCode: code }, CASH_FOUNDATION_POLICY.ACCOUNT_METADATA[code]);
    }
    if (code === "1040") return t11Account1040_();
    var def = definitions[code] || [code, "Asset", ""];
    return { AccountCode: code, AccountName: def[0], AccountType: def[1],
      StatementGroup: "Test", CashFlowGroup: def[2], IsActive: true };
  });
}

function u4cFlowPeriod_() {
  return { filter: "custom", startDate: "2026-10-01", endDate: "2026-10-31",
    label: "2026-10" };
}

function u4cProspectiveGate_() {
  return { accountingRegime: "PROSPECTIVE_PURCHASE_EXPENSE" };
}

function u4cPair_(journalID, debitCode, creditCode, amount) {
  return [{ JournalID: journalID, LineID: journalID + "-1", Tanggal: "2026-10-15",
    AccountCode: debitCode, Debit: amount, Credit: 0, MovementType: "TEST",
    SourceType: "TEST", SourceID: "T", IsActive: true },
    { JournalID: journalID, LineID: journalID + "-2", Tanggal: "2026-10-15",
      AccountCode: creditCode, Debit: 0, Credit: amount, MovementType: "TEST",
      SourceType: "TEST", SourceID: "T", IsActive: true }];
}

function u4cCheck_(bucket, id, value, detail) {
  if (!value) {
    throw new Error("T11_6_U4_" + bucket + ":" + id +
      (detail === undefined ? "" : "|" + detail));
  }
}

// ---- 1-10 aggregate funds -------------------------------------------------

function testSingleCommitAggregateFunds() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("AGGREGATE", id, value, detail); pass++; }

  check("A1a", JSON.stringify(AGGREGATE_MONEY_ACCOUNT_CODES) ===
    JSON.stringify(["1000", "1010", "1020", "1040"]), JSON.stringify(AGGREGATE_MONEY_ACCOUNT_CODES));
  check("A1b", Object.isFrozen(AGGREGATE_MONEY_ACCOUNT_CODES));
  check("A1c", JSON.stringify(CASH_FOUNDATION_POLICY.ACCOUNT_CODES) ===
    JSON.stringify(["1000", "1010", "1020"]), "CASH_FOUNDATION universe untouched");

  function row(code, debit, credit) {
    return { JournalID: "AGG-J", LineID: "AGG-J-" + code, Tanggal: "2026-10-15",
      AccountCode: code, Debit: debit, Credit: credit, MovementType: "TEST",
      SourceType: "TEST", SourceID: "T", IsActive: true };
  }
  check("A2a", buildAggregateFundsReadModel_([row("1000", 7000, 0)]).totalFunds === 7000);
  check("A2b", buildAggregateFundsReadModel_([row("1010", 8000, 0)]).totalFunds === 8000);
  check("A2c", buildAggregateFundsReadModel_([row("1020", 9000, 0)]).totalFunds === 9000);
  check("A3", buildAggregateFundsReadModel_([row("1040", 4000, 0)]).totalFunds === 4000 &&
    buildAggregateFundsReadModel_([row("1040", 4000, 0)]).detail.filter(function(entry) {
      return entry.AccountCode === "1040";
    })[0].present === true, "1040-only projection");
  var mixed = buildAggregateFundsReadModel_([
    row("1000", 7000, 0), row("1010", 8000, 0),
    row("1020", 9000, 0), row("1040", 4000, 0)]);
  check("A4", mixed.totalFunds === 28000 && mixed.status === "OK", JSON.stringify(mixed));
  check("A5", buildAggregateFundsReadModel_([row("1040", 0, 6000)]).totalFunds === -6000,
    "debit-positive sign convention");
  var pairNet = buildAggregateFundsReadModel_([row("1000", 5000, 0),
    Object.assign(row("1010", 0, 5000), { JournalID: "AGG-J" })]);
  check("A6a", pairNet.totalFunds === 0, "journal pair nets to zero across aggregate accounts");

  var composed = u4cComposedSale_();
  var composedAgg = buildAggregateFundsReadModel_(u4cLedgerRows_(composed.fixture));
  check("A6b", composedAgg.status === "OK" && composedAgg.totalFunds === composed.amount,
    JSON.stringify({ amount: composed.amount, agg: composedAgg }));

  var legacyOnly = buildAggregateFundsReadModel_([row("1000", 7000, 0),
    row("1010", 8000, 0), row("1020", 9000, 0)]);
  check("A7", legacyOnly.status === "OK" && legacyOnly.totalFunds === 24000 &&
    legacyOnly.detail.filter(function(entry) { return entry.AccountCode === "1040"; })[0]
      .balance === 0, "legacy-absent 1040 tolerated as 0");

  check("A8", composedAgg.detail.filter(function(entry) {
    return entry.AccountCode === "1040";
  })[0].balance === composed.amount && composedAgg.malformedRows.length === 0,
    "ACTIVE committed data reads deterministically");

  var malformed = buildAggregateFundsReadModel_([row("1040", 0, 0),
    Object.assign(row("1040", 0, 0), { Debit: "abc" })]);
  check("A9", malformed.status === "MALFORMED" && malformed.malformedRows.length === 1,
    JSON.stringify(malformed));

  var legacyAccounts = u4cFlowAccounts_(["1000", "1010", "1020"]);
  var openings = cashFoundationOpeningRows();
  var legacyModel = buildCashBalanceReadModel(legacyAccounts, openings, [], {});
  check("A10a", legacyModel.status === "AVAILABLE" && legacyModel.accounts.length === 3 &&
    legacyModel.aggregate.totalFunds === 5000 + 6000 + 7000,
    JSON.stringify(legacyModel.aggregate));
  var with1040Accounts = legacyAccounts.concat(u4cFlowAccounts_(["1040"]));
  var model1040 = buildCashBalanceReadModel(with1040Accounts, openings,
    [row("1040", 12000, 0)], {});
  check("A10b", model1040.status === "AVAILABLE" && model1040.accounts.length === 4 &&
    model1040.accounts.filter(function(entry) { return entry.AccountCode === "1040"; })[0]
      .OpeningBalance === 0 &&
    model1040.aggregate.totalFunds === 5000 + 6000 + 7000 + 12000,
    JSON.stringify(model1040));

  Logger.log("T11_6_U4_AGGREGATE checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---- 11-17 Balance Position ----------------------------------------------

function testSingleCommitBalancePosition() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("BALANCE", id, value, detail); pass++; }
  var gate = u4cProspectiveGate_();

  var historical = buildPolicyCStatementReconciliation(
    u4cPair_("BJ-H", "1000", "4000", 100000), gate);
  check("B11", historical.status === "FINAL" && historical.finalValues.balanced === true &&
    historical.finalValues.cashChange === 100000, JSON.stringify(historical));

  var only1040 = buildPolicyCStatementReconciliation(
    u4cPair_("BJ-R", "1030", "4000", 50000)
      .concat(u4cPair_("BJ-M", "1040", "1030", 50000)), gate);
  check("B12", only1040.status === "FINAL" && only1040.finalValues.cashChange === 50000,
    JSON.stringify(only1040));

  var mixedRows = u4cPair_("BJ-H2", "1000", "4000", 100000)
    .concat(u4cPair_("BJ-R2", "1030", "4000", 50000))
    .concat(u4cPair_("BJ-M2", "1040", "1030", 50000));
  var mixed = buildPolicyCStatementReconciliation(mixedRows, gate);
  check("B13", mixed.status === "FINAL" && mixed.finalValues.cashChange === 150000,
    JSON.stringify(mixed));

  var composed = u4cComposedSale_();
  var saleBalance = buildPolicyCStatementReconciliation(
    u4cLedgerRows_(composed.fixture), gate);
  check("B14", saleBalance.status === "FINAL" && saleBalance.finalValues.balanced === true &&
    saleBalance.finalValues.cashChange === composed.amount,
    JSON.stringify({ amount: composed.amount, values: saleBalance.finalValues }));

  var expense = buildPolicyCStatementReconciliation(
    u4cPair_("BJ-E", "6100", "1040", 30000), gate);
  check("B15", expense.status === "FINAL" && expense.finalValues.cashChange === -30000,
    JSON.stringify(expense));

  var purchase = buildPolicyCStatementReconciliation(
    u4cPair_("BJ-P", "6210", "1040", 80000), gate);
  check("B16", purchase.status === "FINAL" && purchase.finalValues.cashChange === -80000 &&
    purchase.finalValues.materialPurchasesExpensed === 80000, JSON.stringify(purchase));

  var combinedRows = mixedRows
    .concat(u4cPair_("BJ-E2", "6100", "1040", 30000))
    .concat(u4cPair_("BJ-P2", "6210", "1040", 80000))
    .concat(u4cPair_("BJ-AP", "1500", "2000", 300000));
  var combined = buildPolicyCStatementReconciliation(combinedRows, gate);
  check("B17a", combined.status === "FINAL" && combined.finalValues.balanced === true &&
    combined.finalValues.cashChange === 100000 + 50000 - 30000 - 80000,
    JSON.stringify(combined));
  check("B17b", combined.finalValues.accountsPayable === 300000 &&
    combined.finalValues.materialPurchasesExpensed === 80000,
    "2000 historical AP preserved; no rewrite; material = 6210 only");

  var endToEndLedger = financePolicyCTestLedger().concat(combinedRows);
  var endToEnd = getPartialBalanceDataWithRuntime({
    spreadsheet: financeIsolationTestSpreadsheet({
      accounts: financeIsolationTestAccounts(), sales: financeIsolationTestSales(),
      expenses: financeIsolationTestExpenses(), products: financeIsolationTestProducts(),
      expenseItems: financeIsolationTestExpenseItems(),
      depreciationLedger: financeIsolationTestDepreciation(),
      assets: financeIsolationTestAssets(),
      capitalEquity: [
        { ID_Trx: "CE-U4C-1", Tanggal: "2021-01-01", Owner: "Dekker",
          Type: "OWNER_CONTRIBUTION", Nominal: 10000000, Keterangan: "Opening",
          Source: "LEGACY_XLSM_MIGRATION", IsActive: true, CreatedAt: "",
          CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }],
      openingBalances: [
        { ID: "FOB-3200-U4C", EffectiveDate: "2026-07-31", AccountCode: "3200",
          Amount: 7407000, Source: "LEGACY_XLSM_MIGRATION", Keterangan: "Opening",
          IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }],
      balanceLedger: endToEndLedger
    }) }, "custom", "2026-10-01", "2026-10-31");
  var selfTotal = endToEndLedger.reduce(function(sum, row) {
    var code = String(row.AccountCode || "");
    if (AGGREGATE_MONEY_ACCOUNT_CODES.indexOf(code) === -1) return sum;
    if (!isCanonicalActive(row.IsActive)) return sum;
    return sum + (Number(row.Debit) || 0) - (Number(row.Credit) || 0);
  }, 0);
  var selfAp = endToEndLedger.reduce(function(sum, row) {
    return String(row.AccountCode || "") === "2000" && isCanonicalActive(row.IsActive) ?
      sum + (Number(row.Credit) || 0) - (Number(row.Debit) || 0) : sum;
  }, 0);
  check("B17c", endToEnd.status === "FINAL" && endToEnd.asOfDate === "2026-10-31" &&
    endToEnd.assets !== null && endToEnd.assets.cash.amount === selfTotal &&
    endToEnd.liabilities.accountsPayable === selfAp,
    JSON.stringify({ status: endToEnd.status, cash: endToEnd.assets && endToEnd.assets.cash,
      selfTotal: selfTotal, issues: endToEnd.reconciliation && endToEnd.reconciliation.issues,
      equity: endToEnd.equity && endToEnd.equity.status }));

  Logger.log("T11_6_U4_BALANCE checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---- 18-25 Cash Flow ------------------------------------------------------

function testSingleCommitCashFlow() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("CASHFLOW", id, value, detail); pass++; }
  var period = u4cFlowPeriod_();

  // Recognition journal (Dr1030/Cr4000) touches no money line => zero flow.
  var recognitionOnly = buildCashFlowStatement(
    u4cFlowLedger_([{ code: "1030", debit: 50000, movement: "SALES_RECOGNITION",
      sourceType: "SALES_RECOGNITION_V2" },
      { code: "4000", credit: 50000, movement: "SALES_RECOGNITION",
        sourceType: "SALES_RECOGNITION_V2", JournalID: "JF-0" }]),
    u4cFlowAccounts_(["1030", "4000"]), period, { openingCash: 0 });
  check("C18", recognitionOnly.operating === 0 && recognitionOnly.netChange === 0 &&
    recognitionOnly.ambiguous.length === 0, JSON.stringify(recognitionOnly));

  // Money leg counts ONCE; 1030 CashFlowGroup must never be required (D11).
  var moneyNoGroup = buildCashFlowStatement(
    u4cFlowLedger_([{ code: "1040", debit: 50000, movement: "SALES_MONEY",
      sourceType: "SALES_MONEY_V2" },
      { code: "1030", credit: 50000, movement: "SALES_MONEY",
        sourceType: "SALES_MONEY_V2", JournalID: "JF-0" }]),
    u4cFlowAccounts_(["1040", "1030"]), period, { openingCash: 0 });
  check("C19a", moneyNoGroup.operating === 50000 && moneyNoGroup.ambiguous.length === 0,
    JSON.stringify(moneyNoGroup));
  var moneyBlankGroup = buildCashFlowStatement(
    u4cFlowLedger_([{ code: "1040", debit: 50000, movement: "SALES_MONEY",
      sourceType: "SALES_MONEY_V2" },
      { code: "1030", credit: 50000, movement: "SALES_MONEY",
        sourceType: "SALES_MONEY_V2", JournalID: "JF-0" }]),
    u4cFlowAccounts_(["1040", "1030", "4000"]), period, { openingCash: 0 });
  check("C19b", moneyBlankGroup.operating === 50000 && moneyBlankGroup.ambiguous.length === 0,
    "blank counterpart group still classifies by composition");

  // Expense pair => ONE Operating outflow (composition when account blank).
  var expensePair = buildCashFlowStatement(
    u4cFlowLedger_([{ code: "6100", debit: 30000, movement: "EXPENSE_SINGLE_COMMIT",
      sourceType: "EXPENSE_SINGLE_COMMIT_V1" },
      { code: "1040", credit: 30000, movement: "EXPENSE_SINGLE_COMMIT",
        sourceType: "EXPENSE_SINGLE_COMMIT_V1", JournalID: "JF-0" }]),
    u4cFlowAccounts_(["6100", "1040"]), period, { openingCash: 0 });
  check("C20", expensePair.operating === -30000 && expensePair.ambiguous.length === 0,
    JSON.stringify(expensePair));

  // Purchase pair => ONE Operating outflow.
  var purchasePair = buildCashFlowStatement(
    u4cFlowLedger_([{ code: "6210", debit: 80000, movement: "PURCHASE_RECOGNITION",
      sourceType: "PURCHASE_EVENT" },
      { code: "1040", credit: 80000, movement: "PURCHASE_RECOGNITION",
        sourceType: "PURCHASE_EVENT", JournalID: "JF-0" }]),
    u4cFlowAccounts_(["6210", "1040"]), period, { openingCash: 0 });
  check("C21", purchasePair.operating === -80000 && purchasePair.ambiguous.length === 0,
    JSON.stringify(purchasePair));

  // Combined arithmetic: recognition 0 + sale +X + expense -Y + purchase -Z.
  var combinedLedger = u4cFlowLedger_([
    { code: "1030", debit: 50000, movement: "SALES_RECOGNITION", sourceType: "SALES_RECOGNITION_V2" },
    { code: "4000", credit: 50000, movement: "SALES_RECOGNITION", sourceType: "SALES_RECOGNITION_V2" },
    { code: "1040", debit: 50000, movement: "SALES_MONEY", sourceType: "SALES_MONEY_V2", JournalID: "JM" },
    { code: "1030", credit: 50000, movement: "SALES_MONEY", sourceType: "SALES_MONEY_V2", JournalID: "JM" },
    { code: "6100", debit: 30000, movement: "EXPENSE_SINGLE_COMMIT", sourceType: "EXPENSE_SINGLE_COMMIT_V1", JournalID: "JE" },
    { code: "1040", credit: 30000, movement: "EXPENSE_SINGLE_COMMIT", sourceType: "EXPENSE_SINGLE_COMMIT_V1", JournalID: "JE" },
    { code: "6210", debit: 80000, movement: "PURCHASE_RECOGNITION", sourceType: "PURCHASE_EVENT", JournalID: "JP" },
    { code: "1040", credit: 80000, movement: "PURCHASE_RECOGNITION", sourceType: "PURCHASE_EVENT", JournalID: "JP" }
  ]);
  var combined = buildCashFlowStatement(combinedLedger,
    u4cFlowAccounts_(["1030", "4000", "1040", "6100", "6210"]), period, { openingCash: 0 });
  check("C22", combined.operating === 50000 - 30000 - 80000 &&
    combined.netChange === -60000 && combined.ambiguous.length === 0,
    JSON.stringify(combined));
  var saleOnly = buildCashFlowStatement(combinedLedger.slice(0, 4),
    u4cFlowAccounts_(["1030", "4000", "1040"]), period, { openingCash: 0 });
  check("C23", saleOnly.operating === 50000 &&
    combined.operating === saleOnly.operating + expensePair.operating + purchasePair.operating,
    "recognition + money legs count exactly once (linear sum, no double count)");

  // MovementType PURCHASE_RECOGNITION must not be treated as non-cash: the
  // 1040 counterpart line makes it an Operating outflow (task E).
  check("C24", purchasePair.operating === -80000 && purchasePair.investing === 0 &&
    purchasePair.financing === 0 && purchasePair.closingCash === -80000,
    JSON.stringify(purchasePair));

  // Historical flows preserved: legacy counterpart-group rule for non-1040
  // journals, ambiguous stays visible for blank-group legacy money lines.
  var legacyGrouped = buildCashFlowStatement(
    u4cFlowLedger_([{ code: "1000", debit: 40000, movement: "PAID_SALE",
      sourceType: "SALE_SETTLEMENT" },
      { code: "4100", credit: 40000, movement: "PAID_SALE",
        sourceType: "SALE_SETTLEMENT", JournalID: "JF-0" }]),
    u4cFlowAccounts_(["1000", "4100"]), period, { openingCash: 0 });
  check("C25a", legacyGrouped.operating === 40000 && legacyGrouped.ambiguous.length === 0,
    "historical1000 flow unchanged");
  var legacyAmbiguous = buildCashFlowStatement(
    u4cFlowLedger_([{ code: "1010", debit: 40000, movement: "PAID_SALE",
      sourceType: "SALE_SETTLEMENT" },
      { code: "1030", credit: 40000, movement: "PAID_SALE",
        sourceType: "SALE_SETTLEMENT", JournalID: "JF-0" }]),
    u4cFlowAccounts_(["1010", "1030"]), period, { openingCash: 0 });
  check("C25b", legacyAmbiguous.operating === 0 &&
    legacyAmbiguous.ambiguous.length === 1 &&
    legacyAmbiguous.ambiguous[0].reason === "UNCLASSIFIED_COUNTERPART",
    JSON.stringify(legacyAmbiguous));

  Logger.log("T11_6_U4_CASHFLOW checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---- 26-32 Revenue / P&L --------------------------------------------------

function testSingleCommitRevenuePAndL() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("PNL", id, value, detail); pass++; }

  var canonical = { records: [
    { transactionType: "Expense", dateKey: "2026-10-05", expenseItemIsActive: true,
      expenseAccountCode: "6100", expense: 3000 }
  ], lifecycleRecords: [], sourceQuality: { unresolvedProducts: [],
    unresolvedExpenseItems: [] } };
  var accounts = u4cFlowAccounts_(["6100", "6210"]);
  var depreciation = { rows: [], quality: { duplicateLogicalKeys: [],
    invalidDepreciationRows: [], invalidPeriodRows: [], unresolvedAssetReferences: [] } };
  var projection = buildRecognizedSalesProjection_({ rows: {}, presence: {}, issues: [] });
  var period = { filter: "custom", startDate: "2026-10-01", endDate: "2026-10-31",
    label: "2026-10" };
  var materialLedger = u4cPair_("PL-M", "6210", "1040", 120000);
  var moneyExtras = u4cPair_("PL-REC", "1030", "4000", 120000)
    .concat(u4cPair_("PL-MON", "1040", "1030", 120000))
    .concat(u4cPair_("PL-EXP", "6100", "1040", 3000));
  var withoutMoney = buildFinanceProfitAndLoss(canonical, accounts, period,
    depreciation, materialLedger, projection);
  var withMoney = buildFinanceProfitAndLoss(canonical, accounts, period,
    depreciation, materialLedger.concat(moneyExtras), projection);
  check("D26", JSON.stringify(withMoney.summary) === JSON.stringify(withoutMoney.summary) &&
    JSON.stringify(withMoney.expenseBreakdown) === JSON.stringify(withoutMoney.expenseBreakdown),
    "P&L economically identical with/without money legs for same events");
  check("D27", withMoney.summary.materialPurchasesExpensed === 120000,
    "money legs never add material purchases");
  check("D28a", withMoney.summary.revenue === 0 &&
    withMoney.salesRecognition.authority === "SALES_RECOGNITION_V2_PROJECTION",
    JSON.stringify(withMoney.salesRecognition));
  check("D28b", withMoney.summary.operatingExpenses === 3000,
    "expense counted once per canonical authority");
  check("D29", withMoney.summary.cogs === null && withMoney.summary.grossProfit === null &&
    withMoney.grossProfit === null && withMoney.grossProfitAvailable === false &&
    withMoney.expenseBreakdown.every(function(item) {
      return ["5000", "1100"].indexOf(item.AccountCode) === -1;
    }), JSON.stringify(withMoney.summary));
  check("D31", withMoney.summary.operatingNetProfit ===
    0 - 120000 - 3000 - withMoney.summary.depreciationExpense,
    "P&L = Revenue − material purchases − opex − depreciation");

  // End-to-end: REAL composed Sale reads Revenue ONCE (U3 events), and
  // stripping the money rows changes nothing.
  var fixture = u5MixedPnlFixture_();
  u3AppendRow_(fixture, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS,
    t11Account1040_());
  var runtime = t11Runtime_({ fixture: fixture, singleCommitConfig: t11ConfigRaw_("ACTIVE") });
  var saveResult = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u4c-pnl-1"),
    runtime);
  if (saveResult.status !== "DONE") throw new Error("U4C_PNL_SAVE_FAILED:" + saveResult.status);
  u3MirrorOperations_(fixture, runtime.repository);
  var plan = JSON.parse(runtime.repository.rows()[0].OperationPlan);
  var withLegs = getFinanceDataWithRuntime({ spreadsheet: fixture }, "custom",
    "2026-10-01", "2026-10-31");
  u4cStripSourceType_(fixture, "SALES_MONEY_V2");
  var stripped = getFinanceDataWithRuntime({ spreadsheet: fixture }, "custom",
    "2026-10-01", "2026-10-31");
  check("D30a", JSON.stringify(withLegs.summary) === JSON.stringify(stripped.summary) &&
    JSON.stringify(withLegs.expenseBreakdown) === JSON.stringify(stripped.expenseBreakdown),
    "composed money rows have zero P&L effect");
  check("D30b", withLegs.summary.revenue ===
    withLegs.salesRecognition.recognizedRevenue &&
    withLegs.salesRecognition.authority === "SALES_RECOGNITION_V2_PROJECTION",
    JSON.stringify({ revenue: withLegs.summary.revenue,
      projection: withLegs.salesRecognition.recognizedRevenue }));
  check("D32", plan.composedMoney === true && plan.moneyRows.length === 2 &&
    withLegs.salesRecognition.unresolvedCount >= 0 &&
    withLegs.grossProfitAvailable === false,
    "policy C quality metadata preserved");

  Logger.log("T11_6_U4_PNL checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---- 33-36 Transaction history -------------------------------------------

function testSingleCommitTransactionOneRow() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("TXN", id, value, detail); pass++; }

  var composed = u4cComposedSale_({ key: "u4c-txn-1" });
  var fixture = composed.fixture;
  u3CommittedAppend_(fixture, { orderID: "ORD-U4C-LEGACY", amount: 24000,
    date: "2026-10-10", recognizedAt: "2026-10-10T03:00:00.000Z",
    requestKey: "u4c-legacy-1" });
  u3AppendRow_(fixture, "ExpenseItems", U5_EXPENSE_ITEM_HEADERS, { ID_Ops: "O1",
    Item: "Rent", Kategori: "Operations", Kind: "Fixed", Group: "Operating",
    AccountCode: "6100", IsActive: true });
  u3AppendRow_(fixture, "tabops", CANONICAL_ENTRY.EXPENSE_HEADERS, { ID_Trx: "OPS-U4C-1",
    Tanggal: "2026-10-16T12:00:00Z", ID_Ops: "O1", Nilai: 9000, Source: "tabops",
    IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" });

  var page = u4RunWithFixture_(fixture, function() {
    return getTransactionsPage(u4PageRequest_());
  });
  var rows = page.rows;
  var composedRows = rows.filter(function(row) {
    return row.id === "ORDER:" + composed.orderID;
  });
  check("E33", composedRows.length === 1 && composedRows[0].revenue === composed.amount &&
    composedRows[0].transactionType === "Sales", JSON.stringify(composedRows));
  check("E34a", u4cLedgerRows_(fixture).length === 6 &&
    rows.filter(function(row) { return row.transactionType === "Sales"; }).length === 2,
    "4 ledger rows for the composed sale still yield ONE business row");
  check("E34b", !rows.some(function(row) {
    return String(row.id).indexOf("SRV2M") !== -1 || String(row.id).indexOf("SRV2J") !== -1;
  }), JSON.stringify(rows.map(function(row) { return row.id; })));

  var expensesPage = u4RunWithFixture_(fixture, function() {
    return getTransactionsPage(u4PageRequest_({ tab: "expenses" }));
  });
  var expenseRows = expensesPage.rows.filter(function(row) {
    return row.id === "OPS-U4C-1";
  });
  check("E35", expenseRows.length === 1 &&
    expensesPage.rows.filter(function(row) { return row.id === "OPS-U4C-1"; })[0]
      .transactionType === "Expense", JSON.stringify(expensesPage.rows));

  var source = fs.readFileSync("91.Transactions.Query.js", "utf8");
  check("E36a", source.indexOf('readCanonicalTable(ss, "BalanceLedger"') === -1 &&
    source.indexOf("BalanceLedger") !== -1,
    "business-row construction never reads BalanceLedger (comment-only mention)");
  var legacyRows = rows.filter(function(row) {
    return row.id === "ORDER:ORD-U4C-LEGACY";
  });
  check("E36b", legacyRows.length === 1 && legacyRows[0].revenue === 24000,
    "historical committed sale preserved exactly once");

  Logger.log("T11_6_U4_TXN checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---- 37-40 Dashboard semantics -------------------------------------------

function testSingleCommitDashboardSemantics() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("DASH", id, value, detail); pass++; }

  var service = fs.readFileSync("90.Dashboard.Service.js", "utf8") +
    fs.readFileSync("90.Dashboard.Reporting.js", "utf8");
  check("F37a", service.indexOf("BalanceLedger") === -1 &&
    service.indexOf("buildAggregateFundsReadModel_") === -1 &&
    service.indexOf("getCashFlowData") === -1 &&
    service.indexOf("getPartialBalanceData") === -1,
    "Dashboard never consumes monetary-account readers");
  check("F37b", service.indexOf("1040") === -1 && service.indexOf('"1000"') === -1,
    "no account-code presentation in Dashboard service");

  check("F38a", service.indexOf("paidVia") === -1 &&
    service.indexOf("DestinationAccountCode") === -1 &&
    service.indexOf("paymentMethod") === -1 &&
    service.indexOf("CashAccountCode") === -1,
    "no channel/payment fields anywhere in Dashboard");
  var dashRender = fs.readFileSync("196.View.Dashboard.Render.html", "utf8");
  check("F38b", dashRender.indexOf("financeBSCash") === -1 &&
    dashRender.indexOf("Total Funds") === -1 && dashRender.indexOf("getPartialBalance") === -1 &&
    dashRender.indexOf("financeCf") === -1,
    "Dashboard view renders no funds/cash/cashflow tile at all");

  // No tile can present 1040 alone as "all funds": there is no monetary tile,
  // and the one aggregate presentation (Balance Position) is Finance-owned.
  check("F39", service.indexOf("Total Funds") === -1 &&
    dashRender.indexOf("payment") === -1 && dashRender.indexOf("destination") === -1,
    "no aggregate-funds or channel surface on Dashboard");
  var financeIndex = fs.readFileSync("190.View.Index.html", "utf8");
  check("F40", financeIndex.indexOf('<dt>Total Funds</dt>') !== -1 &&
    financeIndex.indexOf('<dt>Cash</dt><dd id="financeBSCash"') === -1,
    "Balance Position aggregate uses a truthful generic label");

  Logger.log("T11_6_U4_DASH checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---- 41-50 T5 composed clearing ------------------------------------------

function testSingleCommitT5ComposedClearing() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("T5", id, value, detail); pass++; }
  function rowOf(fixture, recognitionID) {
    return treasuryT5Row_(treasuryT5Projection_(fixture), recognitionID);
  }

  // 41 valid composed sale => CLEARED without any receipt, no synthesis.
  var valid = u4cComposedSale_({ key: "u4c-t5-valid" });
  var row41 = rowOf(valid.fixture, valid.recognitionID);
  var receipts = readCanonicalTable(valid.fixture, "TreasuryReceipts",
    TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.RECEIPTS.HEADERS);
  check("G41a", row41 !== null && row41.ClearingStatus === "CLEARED" &&
    row41.OutstandingAmount === 0 && row41.ClearedAmount === valid.amount &&
    row41.QualityCodes.length === 0, JSON.stringify(row41));
  check("G41b", receipts.length === 0 && row41.ActiveReceiptCount === 0 &&
    row41.ActiveReceiptID === "" && row41.DestinationAccountCode === "",
    "no TreasuryReceipt synthesized");

  // 42 missing money leg (committed composed plan, ledger stripped) => EXCEPTION.
  var missing = u4cComposedSale_({ key: "u4c-t5-missing" });
  u4cStripSourceType_(missing.fixture, "SALES_MONEY_V2");
  var row42 = rowOf(missing.fixture, missing.recognitionID);
  check("G42", row42 !== null && row42.ClearingStatus === "EXCEPTION" &&
    row42.QualityCodes.indexOf("JOURNAL_MISSING") !== -1 &&
    row42.OutstandingAmount === missing.amount && row42.ClearedAmount === 0,
    JSON.stringify(row42));

  // 43 wrong amount on the money leg => EXCEPTION.
  var wrongAmount = u4cComposedSale_({ key: "u4c-t5-amount" });
  u4cTamperMoney_(wrongAmount.fixture, function(line, at) {
    if (String(line[at.AccountCode]) === "1040") line[at.Debit] = wrongAmount.amount - 1000;
  });
  var row43 = rowOf(wrongAmount.fixture, wrongAmount.recognitionID);
  check("G43", row43 !== null && row43.ClearingStatus === "EXCEPTION" &&
    row43.QualityCodes.indexOf("JOURNAL_AMOUNT_MISMATCH") !== -1 &&
    row43.OutstandingAmount === wrongAmount.amount, JSON.stringify(row43));

  // 44 wrong account on the money leg => EXCEPTION.
  var wrongAccount = u4cComposedSale_({ key: "u4c-t5-account" });
  u4cTamperMoney_(wrongAccount.fixture, function(line, at) {
    if (String(line[at.AccountCode]) === "1040") line[at.AccountCode] = "1050";
  });
  var row44 = rowOf(wrongAccount.fixture, wrongAccount.recognitionID);
  check("G44", row44 !== null && row44.ClearingStatus === "EXCEPTION" &&
    row44.QualityCodes.indexOf("JOURNAL_ACCOUNT_MISMATCH") !== -1,
    JSON.stringify(row44));

  // 45 duplicate active money journal for the same recognition => EXCEPTION.
  var duplicate = u4cComposedSale_({ key: "u4c-t5-dup" });
  u3AppendLedger_(duplicate.fixture, [
    { JournalID: "SRV2M-DUP-" + duplicate.orderID, LineID: "SRV2M-DUP-" + duplicate.orderID + "-1",
      Tanggal: "2026-10-15", AccountCode: "1040", Debit: duplicate.amount, Credit: 0,
      MovementType: "SALES_MONEY", SourceType: "SALES_MONEY_V2",
      SourceID: duplicate.recognitionID },
    { JournalID: "SRV2M-DUP-" + duplicate.orderID, LineID: "SRV2M-DUP-" + duplicate.orderID + "-2",
      Tanggal: "2026-10-15", AccountCode: "1030", Debit: 0, Credit: duplicate.amount,
      MovementType: "SALES_MONEY", SourceType: "SALES_MONEY_V2",
      SourceID: duplicate.recognitionID }]);
  var row45 = rowOf(duplicate.fixture, duplicate.recognitionID);
  check("G45", row45 !== null && row45.ClearingStatus === "EXCEPTION" &&
    row45.QualityCodes.indexOf("JOURNAL_DUPLICATE") !== -1 &&
    row45.OutstandingAmount === duplicate.amount, JSON.stringify(row45));

  // 46 source/RecognitionID mismatch: money bound to a foreign ID while the
  // committed plan expects it here => EXCEPTION + visible reconciliation entry.
  var sourceMismatch = u4cComposedSale_({ key: "u4c-t5-source" });
  u4cTamperMoney_(sourceMismatch.fixture, function(line, at) {
    line[at.SourceID] = "SCR-U4C-FOREIGN";
  });
  var row46 = rowOf(sourceMismatch.fixture, sourceMismatch.recognitionID);
  var recon46 = treasuryT5Reconciliation_(sourceMismatch.fixture);
  check("G46a", row46 !== null && row46.ClearingStatus === "EXCEPTION" &&
    row46.QualityCodes.indexOf("JOURNAL_MISSING") !== -1, JSON.stringify(row46));
  check("G46b", recon46.exceptionEntries.length >= 1 &&
    recon46.exceptionEntries.some(function(entry) {
      return entry.identity === "SCR-U4C-FOREIGN";
    }) && recon46.ledgerNet1030 === 0 && recon46.outstandingTotal === sourceMismatch.amount,
    JSON.stringify(recon46));

  // 47 plan signature mismatch => EXCEPTION.
  var signature = u4cComposedSale_({ key: "u4c-t5-sig" });
  u4cTamperSalePlan_(signature.fixture, function(plan) {
    plan.moneyJournalSignature = "tampered-signature";
  });
  var row47 = rowOf(signature.fixture, signature.recognitionID);
  check("G47", row47 !== null && row47.ClearingStatus === "EXCEPTION" &&
    row47.QualityCodes.indexOf("SIGNATURE_MISMATCH") !== -1 &&
    row47.OutstandingAmount === signature.amount, JSON.stringify(row47));

  // 48 impossible lineage: money journal identity renamed away from the plan
  // identity => EXCEPTION.
  var lineage = u4cComposedSale_({ key: "u4c-t5-lineage" });
  u4cTamperMoney_(lineage.fixture, function(line, at) {
    line[at.JournalID] = "SRV2M-RENAMED-" + String(line[at.JournalID]).slice(6);
  });
  var row48 = rowOf(lineage.fixture, lineage.recognitionID);
  check("G48", row48 !== null && row48.ClearingStatus === "EXCEPTION" &&
    row48.QualityCodes.indexOf("JOURNAL_IDENTITY_MISMATCH") !== -1, JSON.stringify(row48));

  // 49 legacy/Treasury pre-T11 semantics compatible: receipt-based clearing
  // keeps every existing rule (seeded exposure + real T4 receipt save).
  var legacyFixture = treasuryT4SeededFixture_();
  var receiptResult = treasuryT5SaveReceipt_(legacyFixture);
  var row49 = rowOf(legacyFixture, "SCR-U3-ORD-T4-1");
  check("G49a", receiptResult.result.status === "DONE" && row49 !== null &&
    row49.ClearingStatus === "CLEARED" && row49.ActiveReceiptCount >= 1 &&
    row49.ClearedAmount === 24000, JSON.stringify(row49));

  // 50 legacy receipt fixture reconciliation stays healthy with zero residual
  // and no composed-era quality codes introduced on the row.
  var recon50 = treasuryT5Reconciliation_(legacyFixture);
  check("G50", recon50.reconciliationStatus === "OK" && recon50.unexplainedResidual === 0 &&
    recon50.explicitExceptionAmount === 0 && row49.QualityCodes.length === 0,
    JSON.stringify(recon50));

  Logger.log("T11_6_U4_T5 checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---- 51-54 global 1030 ----------------------------------------------------

function testSingleCommitGlobal1030() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("1030", id, value, detail); pass++; }

  // 51 healthy T11 composed Sale: net 1030 contribution 0, residual 0.
  var composed = u4cComposedSale_({ key: "u4c-1030-healthy" });
  var healthy = treasuryT5Reconciliation_(composed.fixture);
  check("H51", healthy.reconciliationStatus === "OK" && healthy.ledgerNet1030 === 0 &&
    healthy.outstandingTotal === 0 && healthy.unexplainedResidual === 0,
    JSON.stringify(healthy));

  // 52 transitional fixture (24k recognition, no money): outstanding 24k,
  // net 24k, residual 0 — VALID; healthy is NOT redefined as net1030 === 0.
  var transitional = treasuryT4SeededFixture_();
  var trans = treasuryT5Reconciliation_(transitional);
  var transRow = treasuryT5Row_(treasuryT5Projection_(transitional), "SCR-U3-ORD-T4-1");
  check("H52", trans.reconciliationStatus === "OK" && trans.ledgerNet1030 === 24000 &&
    trans.outstandingTotal === 24000 && trans.unexplainedResidual === 0 &&
    transRow.ClearingStatus === "UNCLEARED", JSON.stringify(trans));

  // 53 MANDATORY combined: transitional 24k + new composed T11 Sale.
  var combinedFixture = treasuryT4SeededFixture_();
  var base = combinedFixture;
  var composedRuntime = t11Runtime_({ fixture: base,
    singleCommitConfig: t11ConfigRaw_("ACTIVE") });
  u4cPush1040Sheet_(base);
  var combinedSave = salesRecognitionV2SaveWithRuntime_(
    salesV2SavePayload_("u4c-1030-combined"), composedRuntime);
  if (combinedSave.status !== "DONE") {
    throw new Error("U4C_1030_COMBINED_SAVE_FAILED:" + combinedSave.status);
  }
  u3MirrorOperations_(base, composedRuntime.repository);
  var combinedPlan = JSON.parse(composedRuntime.repository.rows()[0].OperationPlan);
  var combined = treasuryT5Reconciliation_(base);
  var combinedRow = treasuryT5Row_(treasuryT5Projection_(base), combinedPlan.recognitionID);
  check("H53", combined.reconciliationStatus === "OK" &&
    combined.ledgerNet1030 === 24000 && combined.outstandingTotal === 24000 &&
    combined.unexplainedResidual === 0 && combinedRow.ClearingStatus === "CLEARED",
    JSON.stringify(combined));

  // 54 corrupted ledger => nonzero visible exception.
  var corrupted = u4cComposedSale_({ key: "u4c-1030-corrupt" });
  u4cTamperMoney_(corrupted.fixture, function(line, at) {
    if (String(line[at.AccountCode]) === "1030") line[at.Credit] = corrupted.amount + 777;
  });
  var bad = treasuryT5Reconciliation_(corrupted.fixture);
  check("H54", bad.reconciliationStatus !== "OK" &&
    (bad.unexplainedResidual !== 0 || bad.exceptionEntries.length > 0),
    JSON.stringify(bad));

  Logger.log("T11_6_U4_1030 checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// Accounts-sheet push helper for fixtures whose base already exists.
function u4cPush1040Sheet_(fixture) {
  var accounts = readCanonicalTable(fixture, "Accounts",
    CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  if (accounts.some(function(row) { return String(row.AccountCode) === "1040"; })) return;
  u3AppendRow_(fixture, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS,
    t11Account1040_());
}

// ---- 55-59 dates ----------------------------------------------------------

function testSingleCommitDateAuthority() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("DATE", id, value, detail); pass++; }

  var composed = u4cComposedSale_({ key: "u4c-date-1" });
  var moneyRows = u4cLedgerRows_(composed.fixture).filter(function(row) {
    return String(row.SourceType) === "SALES_MONEY_V2";
  });
  check("I55", moneyRows.length === 2 && moneyRows.every(function(row) {
    return String(row.Tanggal) === "2026-10-15" &&
      String(row.Tanggal).indexOf("T") === -1 && String(row.Tanggal).indexOf("Z") === -1;
  }) && String(composed.event.EconomicDate) === "2026-10-15" &&
    moneyRows.every(function(row) {
      return String(row.Tanggal) === String(composed.event.EconomicDate);
    }), JSON.stringify(moneyRows));

  var statement = u4RunWithFixture_(composed.fixture, function() {
    return getCashFlowData("custom", "2026-10-01", "2026-10-31");
  });
  var outOfPeriod = u4RunWithFixture_(composed.fixture, function() {
    return getCashFlowData("custom", "2026-09-01", "2026-09-30");
  });
  check("I56", statement.statement.operating === composed.amount &&
    outOfPeriod.statement.operating === 0 && outOfPeriod.statement.netChange === 0,
    JSON.stringify({ inPeriod: statement.statement, out: outOfPeriod.statement }));

  var partial = getPartialBalanceDataWithRuntime({
    spreadsheet: financeIsolationTestSpreadsheet({
      accounts: financeIsolationTestAccounts(), sales: financeIsolationTestSales(),
      expenses: financeIsolationTestExpenses(), products: financeIsolationTestProducts(),
      expenseItems: financeIsolationTestExpenseItems(),
      depreciationLedger: financeIsolationTestDepreciation(),
      assets: financeIsolationTestAssets(), capitalEquity: [], openingBalances: [],
      balanceLedger: financePolicyCTestLedger()
    }) }, "custom", "2026-10-01", "2026-10-20");
  check("I57", partial.asOfDate === "2026-10-20" &&
    partial.period.endDate === "2026-10-20",
    JSON.stringify({ asOfDate: partial.asOfDate, period: partial.period }));

  var beforeEconomic = treasuryT5Projection_(composed.fixture, { asOfDate: "2026-10-14" });
  var atEconomic = treasuryT5Projection_(composed.fixture, { asOfDate: "2026-10-15" });
  check("I58", beforeEconomic.rows.filter(function(row) {
    return row.RecognitionID === composed.recognitionID;
  }).length === 0 &&
    treasuryT5Row_(atEconomic, composed.recognitionID).ClearingStatus === "CLEARED",
    JSON.stringify({ before: beforeEconomic.rows.length, at: atEconomic.rows.length }));

  check("I59", Session.getScriptTimeZone() === "Asia/Jakarta" &&
    moneyRows.every(function(row) { return /^\d{4}-\d{2}-\d{2}$/.test(String(row.Tanggal)); }),
    "canonical Asia/Jakarta date keys; no instant conversion introduced");
  var t5Source = fs.readFileSync("99B.Treasury.Clearing.Projection.js", "utf8");
  var indexSource = t5Source.slice(t5Source.indexOf("function treasuryClearingMoneyIndex_"),
    t5Source.indexOf("function treasuryClearingComposedPlanIndex_"));
  check("I59b", indexSource.indexOf("new Date") === -1 &&
    indexSource.indexOf("getTime") === -1, "no UTC/local boundary conversion in the index");

  Logger.log("T11_6_U4_DATE checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---- 60-64 read mode + cache coherence -----------------------------------

function testSingleCommitReadModeCache() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("MODE", id, value, detail); pass++; }

  // 60 ABSENT -> read legacy: readers carry no config dependency at all.
  var readerSource = buildCashFlowStatement.toString() +
    buildPolicyCStatementReconciliation.toString() +
    buildTreasuryClearingProjection_.toString() +
    buildAggregateFundsReadModel_.toString();
  check("J60", readerSource.indexOf("PropertiesService") === -1 &&
    readerSource.indexOf("singleCommitTransactionConfigState_") === -1 &&
    readerSource.indexOf("SINGLE_COMMIT_TRANSACTION_V1") === -1,
    "read authorities are config-independent");

  // 61 PREPARED/ABSENT writer gate still legacy-compatible, and the composed
  // artifacts committed under ACTIVE stay readable regardless of writer mode.
  var composed = u4cComposedSale_({ key: "u4c-mode-1" });
  var gatePrepared = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_(t11ConfigRaw_("PREPARED")));
  var readPrepared = treasuryT5Row_(treasuryT5Projection_(composed.fixture),
    composed.recognitionID);
  check("J61", gatePrepared.allowed === true && gatePrepared.composedMoney === false &&
    readPrepared.ClearingStatus === "CLEARED", JSON.stringify(readPrepared));

  // 62 ACTIVE writer path produced the committed data the readers consume.
  var gateActive = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_(t11ConfigRaw_("ACTIVE")));
  check("J62", gateActive.allowed === true && gateActive.composedMoney === true &&
    composed.plan.composedMoney === true &&
    u4cLedgerRows_(composed.fixture).filter(function(row) {
      return String(row.SourceType) === "SALES_MONEY_V2";
    }).length === 2);

  // 63 PAUSED: writes refuse, committed T11 data still reads (mandatory
  // distinction — write-admission gates are not read authority).
  var gatePaused = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_(t11ConfigRaw_("PAUSED")));
  var readPaused = treasuryT5Row_(treasuryT5Projection_(composed.fixture),
    composed.recognitionID);
  var balancePaused = buildPolicyCStatementReconciliation(
    u4cLedgerRows_(composed.fixture), u4cProspectiveGate_());
  check("J63a", gatePaused.allowed === false, JSON.stringify(gatePaused));
  check("J63b", readPaused.ClearingStatus === "CLEARED" &&
    balancePaused.finalValues.cashChange === composed.amount,
    "PAUSED blocks writes only; committed reads intact");

  // 64 invalid write config never erases committed accounting truth.
  var gateInvalid = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_("{broken"));
  var readInvalid = buildAggregateFundsReadModel_(u4cLedgerRows_(composed.fixture));
  check("J64a", gateInvalid.allowed === false, JSON.stringify(gateInvalid));
  check("J64b", readInvalid.status === "OK" && readInvalid.totalFunds === composed.amount &&
    financeSingleCommitActive_() === false,
    "invalid config -> legacy evidence, committed truth unchanged");

  // Cache coherence (task L): U1/U2/U3 DONE paths invalidate the shared
  // dashboard revision; client Save success invalidates Finance caches;
  // Finance/Balance/Cash Flow/T5 have no cache at all.
  var saveSource = fs.readFileSync("97A.SalesRecognition.V2.Save.js", "utf8");
  var entrySource = fs.readFileSync("21.Transaction.Entry.js", "utf8");
  var clientSource = fs.readFileSync("195.View.Transactions.Actions.html", "utf8");
  check("J64c", saveSource.indexOf("invalidateDashboardCache();") !== -1 &&
    entrySource.indexOf("runtime.invalidate();") !== -1,
    "server commit invalidation present on U1/U2/U3 DONE paths");
  check("J64d", clientSource.indexOf("invalidateFinanceCache();") !== -1 &&
    fs.readFileSync("99B.Treasury.Clearing.Projection.js", "utf8")
      .indexOf("CacheService") === -1 &&
    fs.readFileSync("36.Finance.Service.js", "utf8").indexOf("CacheService") === -1,
    "client Save success invalidates Finance caches; T5/Finance are uncached reads");

  Logger.log("T11_6_U4_MODE checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---- 65-71 regression pins ------------------------------------------------

function testSingleCommitRegressionPins() {
  var pass = 0;
  function check(id, value, detail) { u4cCheck_("REGRESSION", id, value, detail); pass++; }

  // 65 CASH_FOUNDATION + Treasury destination universe untouched by U4.
  check("K65a", JSON.stringify(CASH_FOUNDATION_POLICY.ACCOUNT_CODES) ===
    JSON.stringify(["1000", "1010", "1020"]));
  check("K65b", JSON.stringify(TREASURY_RECEIPT_V1_CONTRACT.DESTINATION_ACCOUNT_CODES) ===
    JSON.stringify(["1000", "1010", "1020"]), "no 1040 manual T7 destination");
  var cashFoundation = fs.readFileSync("40.Cash.Foundation.js", "utf8");
  check("K65c", cashFoundation.indexOf('ACCOUNT_CODES: Object.freeze(["1000", "1010", "1020"])') !== -1 &&
    cashFoundation.indexOf("validateCashOpeningRows") !== -1,
    "legacy openings/destination validation still keyed to the legacy universe");

  // 66 no normal T11 writer posts 1000/1010/1020 prospectively.
  var entrySource = fs.readFileSync("21.Transaction.Entry.js", "utf8");
  check("K66a", entrySource.indexOf('MONEY_ACCOUNT_CODE: "1040"') !== -1 &&
    entrySource.indexOf('MONEY_ACCOUNT_CODE: "1000"') === -1,
    "U2/U3 money account is exactly 1040");
  var composedLegacyRows = u4cLedgerRows_(u4cComposedSale_({ key: "u4c-reg-1" }).fixture)
    .filter(function(row) {
      return ["1000", "1010", "1020"].indexOf(String(row.AccountCode)) !== -1;
    });
  check("K66b", composedLegacyRows.length === 0,
    "composed save writes zero legacy monetary-account rows");

  // 67 Revenue remains U3-only.
  var financeSource = fs.readFileSync("36.Finance.Service.js", "utf8");
  check("K67", financeSource.indexOf('authority: "SALES_RECOGNITION_V2_PROJECTION"') !== -1 &&
    financeSource.indexOf("ledgerRevenueCredits") === -1,
    "Finance Revenue reads the projection authority only");

  // 68 zero Revenue/P&L double counting: no 5000/1100 account literals, cogs null.
  var prospectiveSource = buildFinanceProfitAndLoss.toString();
  check("K68", prospectiveSource.indexOf("materialPurchasesExpensed") !== -1 &&
    prospectiveSource.indexOf("result.summary.cogs = null") !== -1 &&
    financeSource.indexOf('"5000"') === -1 && financeSource.indexOf('"1100"') === -1,
    "Policy C P&L shape unchanged; no HPP/inventory account literals in Finance");

  // 69 Cash Flow contract pins: extended literal + composition + ambiguity.
  var cashFlowSource = buildCashFlowStatement.toString();
  check("K69", cashFlowSource.indexOf('["1000", "1010", "1020", "1040"]') !== -1 &&
    cashFlowSource.indexOf("UNCLASSIFIED_COUNTERPART") !== -1 &&
    cashFlowSource.indexOf('"1040"') !== -1 &&
    getCashFlowData.toString().indexOf('["1000", "1010", "1020", "1040"]') !== -1,
    "§14 mechanical list extension + fail-visible ambiguity retained");

  // 70 T5 frozen contracts unchanged: row fields + quality catalog superset.
  check("K70a", JSON.stringify(TREASURY_CLEARING_PROJECTION.ROW_FIELDS) ===
    JSON.stringify(["RecognitionID", "OrderID", "RevisionID", "SalesEconomicDate",
      "RecognizedAmount", "RecognitionIntegrity", "ActiveReceiptCount",
      "ActiveReceiptID", "DestinationAccountCode", "ReceiptDate",
      "ReceiptEconomicDate", "ClearedAmount", "ReversalAmount", "OutstandingAmount",
      "ClearingStatus", "JournalID", "OperationID", "QualityCodes"]),
    "frozen row contract untouched");
  var quality = TREASURY_CLEARING_PROJECTION.QUALITY_CODES;
  check("K70b", ["AMOUNT_RESIDUAL", "DUPLICATE_ACTIVE_RECEIPTS", "SIGNATURE_MISMATCH",
    "JOURNAL_MISSING", "JOURNAL_DUPLICATE", "JOURNAL_AMOUNT_MISMATCH",
    "JOURNAL_ACCOUNT_MISMATCH", "JOURNAL_IDENTITY_MISMATCH"].every(function(code) {
      return quality.indexOf(code) !== -1;
    }) && quality.length >= 42, "quality catalog superset, no invented codes");

  // 71 read-only audit: new reader code paths contain no mutation tokens.
  var readers = buildAggregateFundsReadModel_.toString() +
    buildCashBalanceReadModel.toString() +
    treasuryClearingMoneyIndex_.toString() +
    treasuryClearingExposureClearingState_.toString();
  check("K71", ["setValue", "setValues", "batchUpdate", "appendCells", "postPolicyC",
    "invalidateDashboardCache"].every(function(token) {
      return readers.indexOf(token) === -1;
    }) && financeSingleCommitActive_.toString().indexOf("setProperty") === -1,
    "readers never write; config gate never mutates");

  Logger.log("T11_6_U4_REGRESSION checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}
