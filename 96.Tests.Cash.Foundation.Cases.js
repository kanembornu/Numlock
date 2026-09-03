function testCashFoundationContracts() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  function hasError(report, code) {
    return report.errors.some(function(item) { return item.errors.indexOf(code) !== -1; });
  }
  function changed(row, changes) { return Object.assign({}, row, changes); }

  var accounts = cashFoundationTestAccounts();
  var taxonomy = buildCashAccountTaxonomyCandidates([
    { AccountCode: "1000", AccountName: "Cash", AccountType: "Asset", StatementGroup: "Current Assets",
      CashFlowGroup: "Operating", IsActive: true, CreatedAt: "kept" },
    { AccountCode: "4000", AccountName: "Sales Revenue", AccountType: "Revenue", IsActive: true, CreatedAt: "unchanged" }
  ]);
  check(taxonomy.status === "PASS" && taxonomy.readOnly && taxonomy.writeCount === 0, "taxonomy is read-only");
  check(taxonomy.rows.filter(function(row) { return row.AccountCode === "1000"; })[0].AccountName === "Cash on Hand" &&
    taxonomy.rows.filter(function(row) { return row.AccountCode === "1000"; })[0].NormalBalance === "DEBIT", "1000 rename and debit");
  check(taxonomy.rows.filter(function(row) { return row.AccountCode === "1010"; })[0].AccountName === "DANA Business" &&
    taxonomy.rows.filter(function(row) { return row.AccountCode === "1010"; })[0].StatementGroup === "Current Assets", "1010 metadata");
  check(taxonomy.rows.filter(function(row) { return row.AccountCode === "1020"; })[0].AccountName ===
    "Cash in Owner Custody - BluBCA" && taxonomy.rows.filter(function(row) { return row.AccountCode === "1020"; })[0].NormalBalance === "DEBIT", "1020 metadata");
  check(taxonomy.rows.filter(function(row) { return row.AccountCode === "4000"; })[0].CreatedAt === "unchanged", "unrelated account preserved");
  check(buildCashAccountTaxonomyCandidates([{ AccountCode: "1000" }, { AccountCode: "1000" }]).status === "FAIL",
    "duplicate account rejected");

  var inflow = cashFoundationSettlement({ SettlementID: "SET-SALE-1", Direction: "INFLOW", AccountCode: "1010",
    SourceType: "SALE_SETTLEMENT", SourceID: "SET-SALE-1", RelatedTransactionType: "Sales",
    RelatedTransactionID: "SALE-1" });
  var outflow = cashFoundationSettlement({ SettlementID: "SET-EXP-1", Direction: "OUTFLOW", AccountCode: "1000",
    SourceType: "EXPENSE_SETTLEMENT", SourceID: "SET-EXP-1", RelatedTransactionType: "Expense",
    RelatedTransactionID: "EXP-1" });
  var transfer = cashFoundationSettlement({ SettlementID: "SET-TR-1", Direction: "TRANSFER", AccountCode: "1000",
    CounterAccountCode: "1010", TransferID: "TR-1", SourceType: "CASH_TRANSFER", SourceID: "TR-1" });
  check(validateCashSettlements([inflow], accounts).status === "PASS", "valid inflow");
  check(validateCashSettlements([outflow], accounts).status === "PASS", "valid outflow");
  check(validateCashSettlements([transfer], accounts).status === "PASS", "valid transfer");
  check(hasError(validateCashSettlements([changed(inflow, { Direction: "SIDEWAYS" })], accounts), "INVALID_DIRECTION"), "invalid direction");
  check(hasError(validateCashSettlements([changed(inflow, { Status: "DONE" })], accounts), "INVALID_STATUS"), "invalid status");
  check(hasError(validateCashSettlements([changed(inflow, { Currency: "USD" })], accounts), "INVALID_CURRENCY"), "invalid currency");
  check(hasError(validateCashSettlements([changed(inflow, { Amount: 0 })], accounts), "INVALID_AMOUNT") &&
    hasError(validateCashSettlements([changed(inflow, { Amount: -1 })], accounts), "INVALID_AMOUNT"), "nonpositive amounts");
  check(hasError(validateCashSettlements([changed(inflow, { AccountCode: "4000" })], accounts), "INACTIVE_OR_INVALID_CASH_ACCOUNT"), "invalid cash account");
  check(hasError(validateCashSettlements([inflow], accounts.map(function(row) {
    return row.AccountCode === "1010" ? changed(row, { IsActive: false }) : row;
  })), "INACTIVE_OR_INVALID_CASH_ACCOUNT"), "inactive cash account");
  check(hasError(validateCashSettlements([changed(transfer, { CounterAccountCode: "1000" })], accounts), "TRANSFER_SAME_ACCOUNT"), "same-account transfer");
  check(hasError(validateCashSettlements([changed(transfer, { TransferID: "" })], accounts), "MISSING_TRANSFER_ID"), "missing transfer id");
  check(validateCashSettlements([changed(inflow, { IsActive: false })], accounts).activePostedRows.length === 0, "inactive settlement does not post");
  check(["PENDING", "FAILED", "CANCELLED"].every(function(status) {
    return buildCashPostingCandidate(changed(inflow, { Status: status }), { accounts: accounts }).status === "NO_POST";
  }), "non-posted statuses do not post");

  var transactions = cashFoundationTransactions();
  var salePosting = buildCashPostingCandidate(inflow, { accounts: accounts, transactions: transactions, balanceLedgerRows: [] });
  check(salePosting.status === "READY" && salePosting.rows[0].Debit === 1000 && salePosting.rows[1].Credit === 1000 &&
    salePosting.rows[1].AccountCode === "4000", "paid-at-recognition sale");
  check(buildCashPostingCandidate(inflow, { accounts: accounts, transactions: [], balanceLedgerRows: [] }).reason ===
    "REFUSED_UNSUPPORTED_ACCRUAL_SETTLEMENT", "unpaid sale refused");
  check(buildCashPostingCandidate(inflow, { accounts: accounts, transactions: [changed(transactions[0], { paymentTiming: "DELAYED" })] }).reason ===
    "REFUSED_UNSUPPORTED_ACCRUAL_SETTLEMENT", "delayed sale refused");
  check(buildCashPostingCandidate(changed(inflow, { Amount: 500 }), { accounts: accounts, transactions: transactions }).reason ===
    "REFUSED_UNSUPPORTED_ACCRUAL_SETTLEMENT", "partial sale refused");
  check(buildCashPostingCandidate(inflow, { accounts: accounts, transactions: transactions,
    balanceLedgerRows: salePosting.rows }).status === "ALREADY_POSTED", "sale revenue not posted twice");
  check(buildCashPostingCandidate(inflow, { accounts: accounts, transactions: transactions, balanceLedgerRows: [
    changed(salePosting.rows[1], { SourceType: "SALES_RECOGNITION", SourceID: "SALE-1" })
  ] }).reason === "TRANSACTION_EFFECT_ALREADY_POSTED", "prior sale recognition refused");

  var expensePosting = buildCashPostingCandidate(outflow, { accounts: accounts, transactions: transactions, balanceLedgerRows: [] });
  check(expensePosting.status === "READY" && expensePosting.rows[0].AccountCode === "6100" &&
    expensePosting.rows[0].Debit === 1000 && expensePosting.rows[1].Credit === 1000, "paid-at-recognition expense");
  check(buildCashPostingCandidate(outflow, { accounts: accounts, transactions: [], balanceLedgerRows: [] }).reason ===
    "REFUSED_UNSUPPORTED_ACCRUAL_SETTLEMENT", "unpaid expense refused");
  check(buildCashPostingCandidate(outflow, { accounts: accounts, transactions: [changed(transactions[1], { paymentTiming: "DELAYED" })] }).reason ===
    "REFUSED_UNSUPPORTED_ACCRUAL_SETTLEMENT", "delayed expense refused");
  check(buildCashPostingCandidate(changed(outflow, { Amount: 500 }), { accounts: accounts, transactions: transactions }).reason ===
    "REFUSED_UNSUPPORTED_ACCRUAL_SETTLEMENT", "partial expense refused");
  check(buildCashPostingCandidate(outflow, { accounts: accounts, transactions: transactions,
    balanceLedgerRows: expensePosting.rows }).status === "ALREADY_POSTED", "expense not posted twice");
  check(buildCashPostingCandidate(outflow, { accounts: accounts, transactions: transactions, balanceLedgerRows: [
    changed(expensePosting.rows[0], { SourceType: "EXPENSE_RECOGNITION", SourceID: "EXP-1" })
  ] }).reason === "TRANSACTION_EFFECT_ALREADY_POSTED", "prior expense recognition refused");

  [["1000", "1010"], ["1000", "1020"], ["1010", "1020"]].forEach(function(route, index) {
    var candidate = buildCashPostingCandidate(changed(transfer, { SettlementID: "SET-TR-" + index,
      AccountCode: route[0], CounterAccountCode: route[1], TransferID: "TR-" + index,
      SourceID: "TR-" + index }), { accounts: accounts, transactions: transactions, balanceLedgerRows: [] });
    check(candidate.status === "READY" && candidate.rows[0].AccountCode === route[1] && candidate.rows[0].Debit === 1000 &&
      candidate.rows[1].AccountCode === route[0] && candidate.rows[1].Credit === 1000, "supported transfer route " + index);
    check(candidate.externalCashFlowClassification === "EXCLUDED" && candidate.rows.every(function(row) {
      return ["4000", "6100", "3000", "3100", "3200"].indexOf(row.AccountCode) === -1;
    }), "transfer has no external cash flow, pnl, or equity " + index);
  });
  var transferPosting = buildCashPostingCandidate(transfer, { accounts: accounts, balanceLedgerRows: [] });
  check(buildCashPostingCandidate(transfer, { accounts: accounts, balanceLedgerRows: transferPosting.rows }).status === "ALREADY_POSTED",
    "identical transfer is idempotent");
  check(buildCashPostingCandidate(changed(transfer, { Amount: 2000 }), { accounts: accounts,
    balanceLedgerRows: transferPosting.rows }).reason === "REFUSED_DUPLICATE_SOURCE", "conflicting source refused");

  var reversal = cashFoundationSettlement({ SettlementID: "SET-REV-1", Direction: "OUTFLOW", AccountCode: "1010",
    Amount: 1000, SourceType: "SETTLEMENT_REVERSAL", SourceID: "SET-REV-1", ReversalOf: "SET-SALE-1" });
  var reversalContext = { accounts: accounts, settlements: [inflow], balanceLedgerRows: salePosting.rows };
  var reversed = buildCashReversalCandidate(reversal, reversalContext);
  check(reversed.status === "READY" && reversed.originalSettlementPreserved && reversed.rows[0].Credit === 1000 &&
    reversed.rows[1].Debit === 1000, "full equal-and-opposite reversal");
  check(buildCashReversalCandidate(changed(reversal, { Amount: 500 }), reversalContext).reason ===
    "REFUSED_UNSUPPORTED_PARTIAL_REVERSAL", "partial reversal refused");
  check(buildCashReversalCandidate(reversal, { accounts: accounts, settlements: [inflow, reversal],
    balanceLedgerRows: salePosting.rows }).reason === "ALREADY_REVERSED", "duplicate reversal refused");
  check(salePosting.rows.every(function(row) { return row.MovementType === "PAID_SALE"; }), "original journal preserved");

  var openings = cashFoundationOpeningRows();
  var balances = buildCashBalanceReadModel(accounts, openings, salePosting.rows.concat(expensePosting.rows),
    { "1000": 4000, "1010": 7000, "1020": 7000 });
  var byCode = {};
  balances.accounts.forEach(function(row) { byCode[row.AccountCode] = row; });
  check(byCode["1000"].OpeningBalance === 5000 && byCode["1000"].Debits === 0 && byCode["1000"].Credits === 1000 &&
    byCode["1000"].ClosingBalance === 4000, "cash account balance");
  check(byCode["1000"].ReconciliationStatus === "RECONCILED" && byCode["1010"].ReconciliationStatus === "RECONCILED",
    "reconciled status");
  check(buildCashBalanceReadModel(accounts, openings, [], { "1000": 1 }).accounts[0].ReconciliationStatus === "MISMATCH",
    "mismatch status");
  check(buildCashBalanceReadModel(accounts, openings, [], {}).accounts[0].ReconciliationStatus === "UNRECONCILED",
    "unreconciled status");
  var missingOpening = buildCashBalanceReadModel(accounts, openings.filter(function(row) { return row.AccountCode !== "1020"; }), [], {});
  check(missingOpening.status === "UNAVAILABLE" && missingOpening.accounts.filter(function(row) {
    return row.AccountCode === "1020";
  })[0].ClosingBalance === null, "missing opening unavailable without zero fabrication");
  check(buildCashBalanceReadModel(accounts, openings, salePosting.rows.map(function(row) {
    return changed(row, { IsActive: false });
  }), {}).accounts.filter(function(row) { return row.AccountCode === "1010"; })[0].Debits === 0, "inactive ledger rows excluded");

  var boundaryRows = [changed(salePosting.rows[0], { Tanggal: "2026-09-30", AccountCode: "1000", Debit: 50, Credit: 0 }),
    changed(salePosting.rows[0], { JournalID: "BOUNDARY-2", LineID: "BOUNDARY-2-1", Tanggal: "2026-10-01",
      AccountCode: "1000", Debit: 75, Credit: 0 })];
  var boundary = buildCashBalanceReadModel(accounts, openings, boundaryRows, {}).accounts.filter(function(row) {
    return row.AccountCode === "1000";
  })[0];
  check(boundary.Debits === 75 && boundary.ClosingBalance === 5075, "cutover excludes 2026-09-30 and includes 2026-10-01 once");
  check(CASH_FOUNDATION_POLICY.CUTOVER_DATE === "2026-09-30" &&
    FINANCE_OPENING_BALANCE_POLICY.EFFECTIVE_DATE === "2026-07-31", "cash and retained earnings cutovers remain distinct");

  var migrationFixture = cashSchemaMigrationFixture();
  check(classifyCashAccountsState(migrationFixture.state.accounts) === "LEGACY_CASH_TAXONOMY", "legacy Accounts classified");
  var target = buildCashAccountsTarget(migrationFixture.state.accounts, "2026-09-03T12:00:00+07:00");
  var readyAccounts = cashPhysicalTestState(target.values);
  check(classifyCashAccountsState(readyAccounts) === "CASH_TAXONOMY_READY", "ready Accounts classified");
  check(target.values.length === migrationFixture.state.accounts.values.length + 2 && target.values[1][6] === "created-1000" &&
    target.values[1][7] === "2026-09-03T12:00:00+07:00", "target preserves CreatedAt and updates changed 1000 only");
  check(target.values.slice(1).filter(function(row) { return ["1010", "1020"].indexOf(String(row[0])) !== -1; })
    .every(function(row) { return row[6] === row[7] && row[8] === "DEBIT"; }), "new Cash account timestamps consistent");
  check(target.values.slice(1).filter(function(row) { return row[0] === "4000"; })[0][7] === "updated-4000",
    "unrelated account metadata preserved");
  check(classifyCashAccountsState(cashPhysicalTestState(target.values.filter(function(row, index) {
    return index === 0 || row[0] !== "1020";
  }))) === "PARTIAL_CASH_TAXONOMY", "partial Accounts classified");
  check(classifyCashAccountsState(cashPhysicalTestState(target.values.filter(function(row, index) {
    return index === 0 || row[0] !== "1020";
  }))) === "PARTIAL_CASH_TAXONOMY" && classifyCashAccountsState(cashPhysicalTestState(target.values.filter(function(row, index) {
    return index === 0 || row[0] !== "1010";
  }))) === "PARTIAL_CASH_TAXONOMY", "1010-only and 1020-only partial states classified");
  check(classifyCashAccountsState(cashPhysicalTestState(target.values.concat([target.values[1].slice()]))) === "INVALID",
    "duplicate AccountCode invalid");
  check(classifyCashAccountsState(cashPhysicalTestState(migrationFixture.state.accounts.values.filter(function(row, index) {
    return index === 0 || row[0] !== "1000";
  }))) === "INVALID", "missing 1000 invalid");
  var inactive1000 = migrationFixture.state.accounts.values.map(function(row) { return row.slice(); }); inactive1000[1][5] = false;
  check(classifyCashAccountsState(cashPhysicalTestState(inactive1000)) === "INVALID", "inactive 1000 invalid");
  check(classifyCashAccountsState(cashPhysicalTestState(migrationFixture.state.accounts.values.map(function(row) {
    return row.slice(0, 8);
  }))) === "INVALID", "wrong Accounts schema invalid");
  var conflict1010 = target.values.map(function(row) { return row.slice(); }); conflict1010[conflict1010.length - 2][1] = "Conflict";
  check(classifyCashAccountsState(cashPhysicalTestState(conflict1010)) === "INVALID", "conflicting 1010 invalid");
  var conflict1020 = target.values.map(function(row) { return row.slice(); }); conflict1020[conflict1020.length - 1][2] = "Liability";
  check(classifyCashAccountsState(cashPhysicalTestState(conflict1020)) === "INVALID", "conflicting 1020 invalid");

  check(classifyCashTableState({ exists: false }, CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS,
    validateCashSettlements, cashRowsFromPhysical(readyAccounts)) === "ABSENT", "Settlements absent classified");
  check(classifyCashTableState(cashPhysicalTestState([CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.slice()]),
    CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS, validateCashSettlements, cashRowsFromPhysical(readyAccounts)) === "EMPTY_VALID",
    "Settlements empty valid");
  var settlementValues = [CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.slice(), CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.map(function(header) {
    return inflow[header] === undefined ? "" : inflow[header];
  })];
  check(classifyCashTableState(cashPhysicalTestState(settlementValues), CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS,
    validateCashSettlements, cashRowsFromPhysical(readyAccounts)) === "POPULATED_VALID", "Settlements populated valid");
  settlementValues[1][5] = 0;
  check(classifyCashTableState(cashPhysicalTestState(settlementValues), CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS,
    validateCashSettlements, cashRowsFromPhysical(readyAccounts)) === "INVALID", "invalid populated Settlements refused");
  check(classifyCashTableState(cashPhysicalTestState([CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.slice(0, 20)]),
    CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS, validateCashSettlements, cashRowsFromPhysical(readyAccounts)) === "INVALID",
    "invalid Settlements schema refused");

  var ledgerHeaders = CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS.slice();
  var validJournal = salePosting.rows.map(function(row) { return ledgerHeaders.map(function(header) { return row[header]; }); });
  check(classifyCashTableState(cashPhysicalTestState([ledgerHeaders]), ledgerHeaders, validateBalanceLedgerCandidates,
    cashRowsFromPhysical(readyAccounts)) === "EMPTY_VALID", "BalanceLedger empty valid");
  check(classifyCashTableState(cashPhysicalTestState([ledgerHeaders].concat(validJournal)), ledgerHeaders,
    validateBalanceLedgerCandidates, cashRowsFromPhysical(readyAccounts)) === "POPULATED_VALID", "BalanceLedger populated valid");
  var unbalanced = validJournal.map(function(row) { return row.slice(); }); unbalanced[1][5] = 999;
  check(classifyCashTableState(cashPhysicalTestState([ledgerHeaders].concat(unbalanced)), ledgerHeaders,
    validateBalanceLedgerCandidates, cashRowsFromPhysical(readyAccounts)) === "INVALID", "unbalanced ledger invalid");
  var duplicateLine = validJournal.map(function(row) { return row.slice(); }); duplicateLine[1][1] = duplicateLine[0][1];
  check(classifyCashTableState(cashPhysicalTestState([ledgerHeaders].concat(duplicateLine)), ledgerHeaders,
    validateBalanceLedgerCandidates, cashRowsFromPhysical(readyAccounts)) === "INVALID", "duplicate LineID invalid");
  check(classifyCashTableState(cashPhysicalTestState([ledgerHeaders.slice(0, 15)]), ledgerHeaders,
    validateBalanceLedgerCandidates, cashRowsFromPhysical(readyAccounts)) === "INVALID", "invalid BalanceLedger schema refused");

  var openingHeaders = BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.slice();
  var retained = cashOpeningTestRow("3200", 0, 7407000, "2026-07-31");
  var noCashOpening = cashPhysicalTestState([openingHeaders, openingHeaders.map(function(header) { return retained[header]; })]);
  check(classifyCashOpeningState(noCashOpening, cashRowsFromPhysical(readyAccounts)) === "READY_NO_CASH_OPENINGS",
    "FOB ready without Cash openings");
  var zeroOpening = cashOpeningTestRow("1000", 0, 0, "2026-09-30");
  check(validateCashOpeningRows([zeroOpening], cashRowsFromPhysical(readyAccounts)).status === "PASS", "verified zero Cash opening valid");
  check(validateCashOpeningRows([changed(zeroOpening, { ExternalRef: "" })], cashRowsFromPhysical(readyAccounts)).status === "FAIL",
    "zero Cash opening without ExternalRef invalid");
  check(validateCashOpeningRows([changed(zeroOpening, { Keterangan: "Verified zero" })], cashRowsFromPhysical(readyAccounts)).status === "FAIL",
    "zero Cash opening without evidence phrase invalid");
  var positiveOpening = cashOpeningTestRow("1000", 5000, 0, "2026-09-30");
  check(validateCashOpeningRows([positiveOpening], cashRowsFromPhysical(readyAccounts)).status === "PASS",
    "positive Cash opening with evidence valid");
  check(validateCashOpeningRows([changed(positiveOpening, { ExternalRef: "" })], cashRowsFromPhysical(readyAccounts)).status === "FAIL",
    "positive Cash opening without ExternalRef invalid");
  check(validateCashOpeningRows([changed(positiveOpening, { ExternalRef: "   " })], cashRowsFromPhysical(readyAccounts)).status === "FAIL",
    "positive Cash opening with whitespace ExternalRef invalid");
  check(validateCashOpeningRows([changed(positiveOpening, { Keterangan: "" })], cashRowsFromPhysical(readyAccounts)).status === "FAIL",
    "positive Cash opening without Keterangan invalid");
  check(validateCashOpeningRows([changed(positiveOpening, { Keterangan: "   " })], cashRowsFromPhysical(readyAccounts)).status === "FAIL",
    "positive Cash opening with whitespace Keterangan invalid");
  check(validateCashOpeningRows([changed(zeroOpening, { Debit: -1 })], cashRowsFromPhysical(readyAccounts)).status === "FAIL",
    "negative Cash opening debit invalid");
  check(validateCashOpeningRows([changed(zeroOpening, { Credit: 1 })], cashRowsFromPhysical(readyAccounts)).status === "FAIL",
    "positive Cash opening credit invalid");
  check(validateCashOpeningRows([changed(positiveOpening, { Credit: 1 })], cashRowsFromPhysical(readyAccounts)).status === "FAIL",
    "two-sided positive Cash opening invalid");
  var allCash = CASH_FOUNDATION_POLICY.ACCOUNT_CODES.map(function(code) { return cashOpeningTestRow(code, 0, 0, "2026-09-30"); });
  var completeOpeningValues = [openingHeaders].concat([retained].concat(allCash).map(function(row) {
    return openingHeaders.map(function(header) { return row[header]; });
  }));
  check(classifyCashOpeningState(cashPhysicalTestState(completeOpeningValues), cashRowsFromPhysical(readyAccounts)) ===
    "READY_WITH_CASH_OPENINGS", "complete same-date Cash openings ready");
  check(classifyCashOpeningState(cashPhysicalTestState(completeOpeningValues.slice(0, 3)), cashRowsFromPhysical(readyAccounts)) ===
    "PARTIAL_CASH_OPENINGS", "partial Cash openings classified");
  var mixedDates = completeOpeningValues.map(function(row) { return row.slice(); }); mixedDates[3][1] = "2026-09-29";
  check(classifyCashOpeningState(cashPhysicalTestState(mixedDates), cashRowsFromPhysical(readyAccounts)) === "INVALID",
    "mixed Cash dates invalid");
  check(classifyCashOpeningState(cashPhysicalTestState(completeOpeningValues.concat([completeOpeningValues[1].slice()])),
    cashRowsFromPhysical(readyAccounts)) === "INVALID", "duplicate active opening invalid");
  var invalidEvidenceValues = completeOpeningValues.map(function(row) { return row.slice(); });
  invalidEvidenceValues[2][6] = "";
  check(classifyCashOpeningState(cashPhysicalTestState(invalidEvidenceValues), cashRowsFromPhysical(readyAccounts)) === "INVALID",
    "invalid Cash opening evidence classifies invalid");
  check(buildCashBalanceReadModel(accounts, [positiveOpening].concat(openings.slice(1)), [], {}).accounts.filter(function(row) {
    return row.AccountCode === "1000";
  })[0].OpeningBalance === 5000, "valid positive Cash opening available in read model");
  check(buildCashBalanceReadModel(accounts, [zeroOpening].concat(openings.slice(1)), [], {}).accounts.filter(function(row) {
    return row.AccountCode === "1000";
  })[0].OpeningBalance === 0, "verified zero Cash opening available as zero");
  check(buildCashBalanceReadModel(accounts, [changed(positiveOpening, { ExternalRef: "" })].concat(openings.slice(1)), [], {}).status ===
    "UNAVAILABLE", "invalid Cash opening evidence makes read model unavailable");
  check(validateFinanceOpeningBalanceCandidates([retained], cashRowsFromPhysical(readyAccounts)).status === "PASS" &&
    retained.AccountCode === "3200" && retained.EffectiveDate === "2026-07-31" && retained.Debit === 0 && retained.Credit === 7407000,
    "existing retained earnings opening remains valid and unchanged");

  var plan = buildCashSchemaMigrationPlan(migrationFixture.state, "2026-09-03T12:00:00+07:00");
  check(plan.status === "READY" && plan.writeCount === 3 && plan.operations.writeAccounts &&
    plan.operations.createSettlements && plan.operations.createBalanceLedger, "exact production fixture plans three writes");
  var runtime = cashSchemaMigrationTestRuntime();
  var migrated = executeCashFoundationSchemaMigrationWithRuntime(runtime.runtime);
  check(migrated.status === "MIGRATED" && migrated.writeCount === 3 && migrated.acceptance.status === "PASS",
    "migration writes three logical operations with fresh-read acceptance");
  check(runtime.spreadsheet.getSheetByName("Settlements").getLastRow() === 1 &&
    runtime.spreadsheet.getSheetByName("BalanceLedger").getLastRow() === 1, "migration seeds zero business rows");
  check(runtime.spreadsheet.getSheetByName("Accounts").getMaxColumns() === 9, "Accounts physical width preserved");
  check(executeCashFoundationSchemaMigrationWithRuntime(runtime.runtime).status === "ALREADY_MIGRATED",
    "second migration is idempotent");
  var recovered = executeCashFoundationSchemaRecoveryWithRuntime(runtime.runtime, migrated.migrationRecord);
  check(recovered.status === "RECOVERED" && !runtime.spreadsheet.getSheetByName("Settlements") &&
    !runtime.spreadsheet.getSheetByName("BalanceLedger"), "controlled recovery restores Accounts and deletes owned empty sheets");
  check(cashFingerprint(readCashSchemaMigrationState(runtime.spreadsheet)) ===
    migrated.migrationRecord.preStateFingerprint, "recovery restores exact pre-image and dimensions");
  var preservedRuntime = cashSchemaMigrationTestRuntime({ preExistingPopulated: true });
  var preservedBefore = readCashSchemaMigrationState(preservedRuntime.spreadsheet);
  var preservedMigration = executeCashFoundationSchemaMigrationWithRuntime(preservedRuntime.runtime);
  check(preservedMigration.status === "MIGRATED" && preservedMigration.writeCount === 1 &&
    preservedMigration.acceptance.preExistingStoragePreserved, "valid populated ledgers preserved with one Accounts write");
  check(executeCashFoundationSchemaRecoveryWithRuntime(preservedRuntime.runtime, preservedMigration.migrationRecord).status === "RECOVERED" &&
    cashFingerprint(readCashSchemaMigrationState(preservedRuntime.spreadsheet)) === cashFingerprint(preservedBefore),
    "recovery preserves pre-existing Settlements and BalanceLedger exactly");
  var refusalRuntime = cashSchemaMigrationTestRuntime({ invalidAccounts: true });
  var refused = executeCashFoundationSchemaMigrationWithRuntime(refusalRuntime.runtime);
  check(refused.status === "REFUSED" && refused.writeCount === 0 && refusalRuntime.writes().length === 0,
    "invalid state refuses before writes");
  var businessRuntime = cashSchemaMigrationTestRuntime();
  var businessMigration = executeCashFoundationSchemaMigrationWithRuntime(businessRuntime.runtime);
  businessRuntime.spreadsheet.getSheetByName("Settlements").values.push(settlementValues[1].slice());
  check(executeCashFoundationSchemaRecoveryWithRuntime(businessRuntime.runtime, businessMigration.migrationRecord).status === "REFUSED",
    "recovery refuses business rows");
  var changedRuntime = cashSchemaMigrationTestRuntime();
  var changedMigration = executeCashFoundationSchemaMigrationWithRuntime(changedRuntime.runtime);
  changedRuntime.spreadsheet.getSheetByName("Accounts").values[1][1] = "Changed after migration";
  check(executeCashFoundationSchemaRecoveryWithRuntime(changedRuntime.runtime, changedMigration.migrationRecord).reason ===
    "ACCOUNTS_POST_IMAGE_CHANGED", "recovery refuses modified post-image");
  check(executeCashFoundationSchemaRecoveryWithRuntime(runtime.runtime, {}).status === "REFUSED", "recovery refuses incomplete snapshot");
  var rollbackRuntime = cashSchemaMigrationTestRuntime({ corruptAfterFlush: true });
  check(executeCashFoundationSchemaMigrationWithRuntime(rollbackRuntime.runtime).status === "FAILED_ROLLED_BACK",
    "failed acceptance rolls back exactly");
  var hardRollbackRuntime = cashSchemaMigrationTestRuntime({ corruptAfterFlush: true, failDelete: true });
  check(executeCashFoundationSchemaMigrationWithRuntime(hardRollbackRuntime.runtime).status === "FAILED_ROLLBACK",
    "failed rollback verification is hard failure");
  check(runCashFoundationSchemaMigration.toString().indexOf("lock.waitLock(30000)") !== -1 &&
    runCashFoundationSchemaRecovery.toString().indexOf("lock.waitLock(30000)") !== -1 &&
    runCashFoundationSchemaMigration.toString().indexOf("resolveNumlockProductionSpreadsheetWithRuntime") !== -1,
    "production runners use canonical storage and 30-second ScriptLock");
  var missingRuntimeFailed = false, wrongModeFailed = false, productionIdentityFailed = false;
  try { executeCashFoundationSchemaMigrationWithRuntime(); } catch (error) { missingRuntimeFailed = true; }
  try {
    var wrongMode = cashSchemaMigrationTestRuntime(); wrongMode.runtime.mode = "WRONG";
    executeCashFoundationSchemaMigrationWithRuntime(wrongMode.runtime);
  } catch (error) { wrongModeFailed = true; }
  try {
    var confused = cashSchemaMigrationTestRuntime();
    confused.runtime.disposableOwnership.spreadsheetId = NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID;
    executeCashFoundationSchemaMigrationWithRuntime(confused.runtime);
  } catch (error) { productionIdentityFailed = true; }
  check(missingRuntimeFailed && wrongModeFailed && productionIdentityFailed,
    "schema executors fail closed on missing, wrong, or confused contexts");
  check(executeCashFoundationSchemaMigrationWithRuntime.toString().indexOf("resolveNumlockProductionSpreadsheetWithRuntime") === -1 &&
    executeCashFoundationSchemaRecoveryWithRuntime.toString().indexOf("resolveNumlockProductionSpreadsheetWithRuntime") === -1,
    "storage-injected executors never resolve canonical storage");
  check(runCashFoundationSchemaMigration.toString().indexOf("PRODUCTION_MODE") !== -1 &&
    runCashFoundationSchemaRecovery.toString().indexOf("PRODUCTION_MODE") !== -1,
    "public production runners declare production mode");
  check(runCashFoundationDisposableRuntimeProof.length === 0 &&
    runCashFoundationDisposableRuntimeProof.toString().indexOf("SpreadsheetApp.create") !== -1,
    "disposable entry point is parameterless with no arbitrary ID surface");
  var disposableValues = cashDisposableFixtureValues();
  check(disposableValues.accounts.length === 17 && disposableValues.accounts[0].length === 9 &&
    disposableValues.accounts.filter(function(row) { return row[0] === "1000" && row[1] === "Cash" && row[8] === ""; }).length === 1 &&
    disposableValues.accounts.filter(function(row) { return row[0] === "1010" || row[0] === "1020"; }).length === 0,
    "disposable Accounts fixture is exact");
  check(disposableValues.opening.length === 2 && disposableValues.opening[0].length === 13 &&
    disposableValues.opening[1][2] === "3200" && disposableValues.opening[1][3] === 0 &&
    disposableValues.opening[1][4] === 7407000 && capitalEquityDateKey(disposableValues.opening[1][1]) === "2026-07-31",
    "disposable FinanceOpeningBalances fixture is exact");
  var proofRuntime = cashDisposableRuntimeProofTestRuntime();
  var proofResult = executeCashFoundationDisposableRuntimeProofWithRuntime(proofRuntime.runtime);
  check(proofResult.status === "PASS" && proofResult.firstMigration.status === "MIGRATED" &&
    proofResult.firstMigration.writeCount === 3 && proofResult.secondMigration.status === "ALREADY_MIGRATED" &&
    proofResult.secondMigration.writeCount === 0 && proofResult.recovery === "PASS",
    "disposable proof orchestrates migration, idempotency, recovery, and refusals");
  check(proofRuntime.createdIds().length >= 12 && proofRuntime.createdIds().every(function(id) {
    return proofRuntime.trashedIds().indexOf(id) !== -1;
  }), "disposable proof cleans only every owned spreadsheet");
  var failedProofRuntime = cashDisposableRuntimeProofTestRuntime({ wrongCreatedName: true }), proofFailure = null;
  try { executeCashFoundationDisposableRuntimeProofWithRuntime(failedProofRuntime.runtime); }
  catch (error) { proofFailure = error; }
  check(proofFailure && failedProofRuntime.createdIds().length === 1 &&
    failedProofRuntime.trashedIds()[0] === failedProofRuntime.createdIds()[0],
    "disposable proof cleans owned storage after an assertion failure");
  check(executeCashFoundationDisposableRuntimeProofWithRuntime.toString().indexOf("productionBefore") !== -1 &&
    executeCashFoundationDisposableRuntimeProofWithRuntime.toString().indexOf("production fingerprint changed") !== -1 &&
    executeCashFoundationDisposableRuntimeProofWithRuntime.toString().indexOf("finally") !== -1,
    "orchestrator owns production fingerprint comparison and finally cleanup");

  Logger.log("PASS: testCashFoundationContracts | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function cashFoundationTestAccounts() {
  return [
    { AccountCode: "1000", AccountName: "Cash on Hand", AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT", IsActive: true },
    { AccountCode: "1010", AccountName: "DANA Business", AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT", IsActive: true },
    { AccountCode: "1020", AccountName: "Cash in Owner Custody - BluBCA", AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT", IsActive: true },
    { AccountCode: "4000", AccountName: "Sales Revenue", AccountType: "Revenue", IsActive: true },
    { AccountCode: "6100", AccountName: "Salary Expense", AccountType: "Expense", IsActive: true }
  ];
}

function cashFoundationSettlement(overrides) {
  return Object.assign({ SettlementID: "SET-1", Tanggal: "2026-10-02", Direction: "INFLOW", AccountCode: "1000",
    CounterAccountCode: "", Amount: 1000, Currency: "IDR", SourceType: "SALE_SETTLEMENT", SourceID: "SET-1",
    RelatedTransactionType: "Sales", RelatedTransactionID: "SALE-1", TransferID: "", ExternalRef: "EXT-1",
    Status: "POSTED", Keterangan: "Cash foundation test", ReversalOf: "", IsActive: true,
    CreatedAt: "2026-10-02 10:00:00", CreatedBy: "test", UpdatedAt: "2026-10-02 10:00:00", UpdatedBy: "test" }, overrides || {});
}

function cashFoundationTransactions() {
  return [
    { id: "SALE-1", canonicalTransactionType: "Sales", dateKey: "2026-10-02", amount: 1000,
      approvedPaidAmount: 1000, paymentTiming: "AT_RECOGNITION", revenueAccountCode: "4000", isActive: true },
    { id: "EXP-1", canonicalTransactionType: "Expense", dateKey: "2026-10-02", amount: 1000,
      approvedPaidAmount: 1000, paymentTiming: "AT_RECOGNITION", expenseAccountCode: "6100", isActive: true }
  ];
}

function cashFoundationOpeningRows() {
  return CASH_FOUNDATION_POLICY.ACCOUNT_CODES.map(function(code, index) {
    return { ID: "OPEN-" + code, EffectiveDate: "2026-09-30", AccountCode: code, Debit: 5000 + index * 1000,
      Credit: 0, Source: "VERIFIED_OPENING", ExternalRef: "EXT-" + code, Keterangan: "Observed balance verified", IsActive: true,
      CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  });
}

function cashOpeningTestRow(code, debit, credit, date) {
  return { ID: "FOB-" + code + "-" + String(date).replace(/-/g, ""), EffectiveDate: date, AccountCode: code,
    Debit: debit, Credit: credit, Source: "VERIFIED_OBSERVATION", ExternalRef: "EVIDENCE-" + code,
    Keterangan: debit === 0 && credit === 0 ? "Verified observed balance = 0" : "Verified opening",
    IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
}

function cashPhysicalTestState(values, options) {
  options = options || {};
  return { exists: true, values: values.map(function(row) { return row.slice(); }),
    formulas: values.map(function(row) { return row.map(function() { return ""; }); }),
    maxRows: options.maxRows || Math.max(1000, values.length), maxColumns: options.maxColumns || values[0].length };
}

function cashSchemaMigrationFixture() {
  var headers = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.slice();
  var rows = balanceFoundationMigrationTestAccounts().map(function(account) {
    var copy = Object.assign({}, account, { NormalBalance: "", CreatedAt: "created-" + account.AccountCode,
      UpdatedAt: "updated-" + account.AccountCode });
    return headers.map(function(header) { return copy[header] === undefined ? "" : copy[header]; });
  });
  var retained = cashOpeningTestRow("3200", 0, 7407000, "2026-07-31");
  return { state: { accounts: cashPhysicalTestState([headers].concat(rows), { maxColumns: 9 }),
    opening: cashPhysicalTestState([BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.slice(),
      BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.map(function(header) { return retained[header]; })], { maxColumns: 13 }),
    settlements: { exists: false }, balanceLedger: { exists: false } } };
}

function cashSchemaMigrationTestRuntime(options) {
  options = options || {};
  var fixture = cashSchemaMigrationFixture(), writes = [], sheets = [];
  function sheetFromState(name, state) {
    var sheet = capitalEquitySchemaTestSheet(name, state.values, writes,
      { maxRows: state.maxRows, maxColumns: state.maxColumns });
    sheet.formulas = state.formulas;
    sheet.getRange = (function(original) { return function(row, column, count, width) {
      var range = original.call(sheet, row, column, count, width);
      range.getFormulas = function() {
        return sheet.formulas.slice(row - 1, row - 1 + count).map(function(values) {
          return values.slice(column - 1, column - 1 + width);
        });
      };
      range.setFormulas = function(formulas) { sheet.formulas = formulas.map(function(values) { return values.slice(); }); return range; };
      return range;
    };})(sheet.getRange);
    return sheet;
  }
  if (options.invalidAccounts) fixture.state.accounts.values[0][8] = "WrongHeader";
  if (options.preExistingPopulated) {
    var partialTarget = buildCashAccountsTarget(fixture.state.accounts, "seed").values;
    partialTarget[1][1] = "Cash"; partialTarget[1][7] = fixture.state.accounts.values[1][7]; partialTarget[1][8] = "";
    fixture.state.accounts = cashPhysicalTestState(partialTarget, { maxColumns: 9 });
  }
  sheets.push(sheetFromState("Accounts", fixture.state.accounts));
  sheets.push(sheetFromState("FinanceOpeningBalances", fixture.state.opening));
  if (options.preExistingPopulated) {
    var settlement = cashFoundationSettlement({ SettlementID: "PRE-SET", SourceID: "PRE-SET" });
    var settlementValues = [CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.slice(),
      CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.map(function(header) { return settlement[header] === undefined ? "" : settlement[header]; })];
    var posting = buildCashPostingCandidate(settlement, { accounts: cashRowsFromPhysical(fixture.state.accounts),
      transactions: cashFoundationTransactions(), balanceLedgerRows: [] });
    var ledgerValues = [CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS.slice()].concat(posting.rows.map(function(row) {
      return CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS.map(function(header) { return row[header] === undefined ? "" : row[header]; });
    }));
    sheets.push(sheetFromState("Settlements", cashPhysicalTestState(settlementValues,
      { maxColumns: CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.length })));
    sheets.push(sheetFromState("BalanceLedger", cashPhysicalTestState(ledgerValues,
      { maxColumns: CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS.length })));
  }
  var spreadsheet = capitalEquitySchemaTestSpreadsheet(sheets);
  spreadsheet.insertSheet = function(name) {
    var headers = name === "Settlements" ? CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS : CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS;
    var sheet = sheetFromState(name, cashPhysicalTestState([headers.slice()], { maxColumns: headers.length }));
    this.sheets.push(sheet); return sheet;
  };
  spreadsheet.deleteSheet = function(sheet) {
    if (options.failDelete) throw new Error("simulated delete failure");
    this.sheets.splice(this.sheets.indexOf(sheet), 1);
  };
  var corrupted = false;
  spreadsheet.id = "DISPOSABLE_CASH_SCHEMA_TEST";
  spreadsheet.name = CASH_SCHEMA_RUNTIME.DISPOSABLE_NAME_PREFIX + "Local Test";
  spreadsheet.getName = function() { return this.name; };
  var runtime = { mode: CASH_SCHEMA_RUNTIME.DISPOSABLE_MODE, spreadsheet: spreadsheet,
    disposableOwnership: { token: "LOCAL_TEST_TOKEN", spreadsheetId: spreadsheet.id, spreadsheetName: spreadsheet.name },
    timestamp: "2026-09-03T12:00:00+07:00", flush: function() {
    if (options.corruptAfterFlush && !corrupted) {
      spreadsheet.getSheetByName("Accounts").values[1][1] = "CORRUPTED"; corrupted = true;
    }
  }, freshSpreadsheet: function() { return spreadsheet; } };
  return { runtime: runtime, spreadsheet: spreadsheet, writes: function() { return writes.slice(); } };
}

function cashDisposableRuntimeProofTestRuntime(options) {
  options = options || {};
  var byId = {}, created = [], trashed = [], sequence = 0;
  var canonicalFixture = cashSchemaMigrationTestRuntime();
  canonicalFixture.spreadsheet.id = NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID;
  canonicalFixture.spreadsheet.name = "NUMLOCK Production Test Double";
  byId[canonicalFixture.spreadsheet.id] = canonicalFixture.spreadsheet;
  function newSheet(name, rows, columns) {
    var sheet = capitalEquitySchemaTestSheet(name, [], null, { maxRows: rows, maxColumns: columns });
    sheet.setName = function(nextName) { this.name = nextName; return this; };
    return sheet;
  }
  function newSpreadsheet(name, rows, columns) {
    var id = "DISPOSABLE_CASH_RUNTIME_" + (++sequence), first = newSheet("Sheet1", rows, columns);
    var spreadsheet = capitalEquitySchemaTestSpreadsheet([first]);
    spreadsheet.id = id;
    spreadsheet.name = options.wrongCreatedName && created.length === 0 ? "WRONG NAME" : name;
    spreadsheet.getName = function() { return this.name; };
    spreadsheet.insertSheet = function(sheetName) {
      var sheet = newSheet(sheetName, 1000, 26); this.sheets.push(sheet); return sheet;
    };
    spreadsheet.deleteSheet = function(sheet) { this.sheets.splice(this.sheets.indexOf(sheet), 1); };
    byId[id] = spreadsheet; created.push(id); return spreadsheet;
  }
  return { runtime: {
    storage: { openById: function(id) { return byId[id] || null; } },
    createToken: function() { return "TOKEN-" + (sequence + 1); },
    createSpreadsheet: newSpreadsheet,
    openById: function(id) { return byId[id]; }, flush: function() {},
    timestamp: "2026-09-03T12:00:00+07:00",
    trashOwnedSpreadsheet: function(ownership) { trashed.push(ownership.spreadsheetId); },
    isOwnedSpreadsheetTrashed: function(ownership) { return trashed.indexOf(ownership.spreadsheetId) !== -1; }
  }, createdIds: function() { return created.slice(); }, trashedIds: function() { return trashed.slice(); } };
}
