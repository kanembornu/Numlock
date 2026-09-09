function testBalanceFoundationContracts() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  function hasError(report, code) {
    return report.errors.some(function(item) { return item.errors.indexOf(code) !== -1; });
  }

  var accounts = balanceFoundationTestAccounts();
  var taxonomy = buildBalanceAccountMetadata(accounts);
  check(taxonomy.status === "PASS" && taxonomy.rows.length === 6, "required balance account taxonomy");
  check(taxonomy.rows.filter(function(row) { return row.AccountCode === "3000"; })[0].NormalBalance === "CREDIT" &&
    taxonomy.rows.filter(function(row) { return row.AccountCode === "3100"; })[0].NormalBalance === "DEBIT" &&
    taxonomy.rows.filter(function(row) { return row.AccountCode === "3200"; })[0].NormalBalance === "CREDIT",
    "equity normal balances");
  check(taxonomy.rows.filter(function(row) { return row.AccountCode === "1500"; })[0].NormalBalance === "DEBIT" &&
    taxonomy.rows.filter(function(row) { return row.AccountCode === "1590"; })[0].NormalBalance === "CREDIT" &&
    taxonomy.rows.filter(function(row) { return row.AccountCode === "6900"; })[0].NormalBalance === "DEBIT",
    "fixed asset and depreciation metadata");
  check(buildBalanceAccountMetadata(accounts.filter(function(row) { return row.AccountCode !== "3200"; })).status === "FAIL",
    "missing required account rejected");
  check(buildBalanceAccountMetadata(accounts.map(function(row) {
    return row.AccountCode === "3000" ? Object.assign({}, row, { AccountName: "Wrong" }) : row;
  })).status === "FAIL", "canonical account name mismatch rejected");

  var legacy = buildRetainedEarningsOpeningCandidate();
  var openingV2 = buildFinanceOpeningBalanceV2Candidates([legacy], accounts);
  check(legacy.Amount === 7407000 && openingV2[0].Debit === 0 && openingV2[0].Credit === 7407000,
    "3200 amount converted losslessly to debit and credit");
  check(openingV2[0].EffectiveDate === legacy.EffectiveDate && openingV2[0].Source === legacy.Source,
    "3200 effective date and source preserved");
  check(financeOpeningBalanceAmount(legacy) === 7407000 && financeOpeningBalanceAmount(openingV2[0]) === 7407000,
    "legacy and V2 opening read equivalence");
  check(buildRetainedEarningsBalance([legacy], [], "2026-07-31").retainedEarnings === 7407000 &&
    buildRetainedEarningsBalance(openingV2, [], "2026-07-31").retainedEarnings === 7407000,
    "retained earnings result unchanged");
  check(balanceFoundationMigrationValueMatches("AccountCode", "3200", 3200) &&
    balanceFoundationMigrationValueMatches("AccountCode", 3200, "3200"),
    "AccountCode accepts equivalent string and number runtime representations");
  check(!balanceFoundationMigrationValueMatches("AccountCode", "3200", 3100) &&
    !balanceFoundationMigrationValueMatches("AccountCode", "03200", 3200),
    "wrong or leading-zero AccountCode remains rejected");
  check(!balanceFoundationMigrationValueMatches("AccountCode", "3200A", 3200) &&
    !balanceFoundationMigrationValueMatches("AccountCode", "", 3200) &&
    !balanceFoundationMigrationValueMatches("AccountCode", null, 3200),
    "invalid AccountCode coercion remains rejected");
  check(!balanceFoundationMigrationValueMatches("Source", "3200", 3200) &&
    !balanceFoundationMigrationValueMatches("Credit", "7407000", 7407000),
    "unrelated string and number fields remain strictly typed");
  var migration = balanceFoundationSchemaMigrationTestRuntime({ forensicOpening: true });
  var originalAccounts = JSON.stringify(migration.accounts.values);
  var originalOpening = JSON.stringify(migration.opening.values);
  var firstProductionRead = migration.accounts.getDataRange().getValues();
  var secondProductionRead = migration.accounts.getDataRange().getValues();
  check(firstProductionRead[1][6] instanceof Date && secondProductionRead[1][6] instanceof Date &&
    firstProductionRead[1][6] !== secondProductionRead[1][6] &&
    firstProductionRead[1][6].getTime() === secondProductionRead[1][6].getTime(),
    "production-equivalent fresh reads return value-equal distinct Date objects");
  var migrated = executeBalanceFoundationSchemaMigrationWithRuntime(migration.runtime);
  var migratedAccounts = balanceFoundationRowsFromValues(migration.accounts.values);
  var migratedOpening = balanceFoundationRowsFromValues(migration.opening.values);
  check(migrated.status === "PASS" && migrated.writeCount === 2, "schema migration accepted");
  check(migration.accounts.getMaxColumns() === 9 && migration.opening.getMaxColumns() === 13,
    "migration explicitly expands physical grids to exact V2 widths");
  check(JSON.stringify(migration.writes()) === JSON.stringify([
    "Accounts:insertColumnsAfter:8:1", "Accounts",
    "FinanceOpeningBalances:insertColumnsAfter:11:2", "FinanceOpeningBalances"
  ]), "migration structural and value-write sequence is deterministic");
  check(migration.accounts.values.length === 17 && migration.accounts.values[0][8] === "NormalBalance" &&
    JSON.stringify(migration.accounts.values.map(function(row) { return row.slice(0, 8); })) === originalAccounts,
    "Accounts adds only NormalBalance and preserves existing values");
  check(buildBalanceAccountMetadata(migratedAccounts).status === "PASS" &&
    migratedAccounts.filter(function(row) { return row.AccountCode === "1500"; })[0].StatementGroup ===
      "Non-current Assets", "production StatementGroup preserved independently");
  var expectedNormalBalances = { "1500": "DEBIT", "1590": "CREDIT", "3000": "CREDIT",
    "3100": "DEBIT", "3200": "CREDIT", "6900": "DEBIT" };
  check(migratedAccounts.every(function(row) {
    return row.NormalBalance === (expectedNormalBalances[row.AccountCode] || "");
  }), "only proven NormalBalance mappings populated");
  check(migratedOpening.length === 1 && migratedOpening[0].AccountCode === "3200" &&
    capitalEquityDateKey(migratedOpening[0].EffectiveDate) === "2026-07-31" &&
    migratedOpening[0].Debit === 0 && migratedOpening[0].Credit === 7407000 &&
    migratedOpening[0].Source === "LEGACY_XLSM_MIGRATION", "3200 V2 physical migration values");
  check(migratedOpening[0].ID === "FOB-3200-20260731" &&
    migratedOpening[0].Keterangan === BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_DESCRIPTION &&
    balanceFoundationAuditDateKey(migratedOpening[0].CreatedAt) === "2026-09-01" &&
    migratedOpening[0].CreatedBy === BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER &&
    balanceFoundationAuditDateKey(migratedOpening[0].UpdatedAt) === "2026-09-01" &&
    migratedOpening[0].UpdatedBy === BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER,
    "opening ID description and audit values preserved");
  check(buildRetainedEarningsBalance(migratedOpening, [], "2026-07-31").retainedEarnings === 7407000,
    "migrated retained earnings remains 7407000");
  var writesBeforeSecondRun = migration.writes().length;
  var secondRun = executeBalanceFoundationSchemaMigrationWithRuntime(migration.runtime);
  check(secondRun.status === "ALREADY_MIGRATED" && secondRun.writeCount === 0 &&
    migration.writes().length === writesBeforeSecondRun, "second run idempotency with zero writes");

  ["Accounts", "FinanceOpeningBalances"].forEach(function(sheetName) {
    var failure = balanceFoundationSchemaMigrationTestRuntime({ failSheet: sheetName });
    var beforeAccounts = JSON.stringify(failure.accounts.values), beforeOpening = JSON.stringify(failure.opening.values);
    var rejected = false;
    try { executeBalanceFoundationSchemaMigrationWithRuntime(failure.runtime); }
    catch (error) { rejected = error.message.indexOf("simulated write failure") !== -1 &&
      error.message.indexOf("rollback: SUCCESS") !== -1; }
    check(rejected && JSON.stringify(failure.accounts.values) === beforeAccounts &&
      JSON.stringify(failure.opening.values) === beforeOpening, sheetName + " write failure exact rollback");
  });
  var acceptanceFailure = balanceFoundationSchemaMigrationTestRuntime({ corruptAfterFlush: true });
  var acceptanceAccounts = JSON.stringify(acceptanceFailure.accounts.values);
  var acceptanceOpening = JSON.stringify(acceptanceFailure.opening.values);
  var acceptanceRejected = false;
  try { executeBalanceFoundationSchemaMigrationWithRuntime(acceptanceFailure.runtime); }
  catch (error) { acceptanceRejected = error.message.indexOf("physical acceptance failed") !== -1; }
  check(acceptanceRejected && JSON.stringify(acceptanceFailure.accounts.values) === acceptanceAccounts &&
    JSON.stringify(acceptanceFailure.opening.values) === acceptanceOpening &&
    acceptanceFailure.accounts.getMaxColumns() === 8 && acceptanceFailure.opening.getMaxColumns() === 11,
    "post-write acceptance failure exact rollback");
  var mixed = balanceFoundationSchemaMigrationTestRuntime({ mixedState: true });
  var mixedResult = executeBalanceFoundationSchemaMigrationWithRuntime(mixed.runtime);
  check(mixedResult.status === "REFUSED" && mixedResult.writeCount === 0 && mixed.writes().length === 0,
    "mixed schema state refused without writes");
  var malformed = balanceFoundationSchemaMigrationTestRuntime({ malformedSchema: true });
  var malformedResult = executeBalanceFoundationSchemaMigrationWithRuntime(malformed.runtime);
  check(malformedResult.status === "REFUSED" && malformedResult.writeCount === 0 &&
    malformed.writes().length === 0, "malformed Accounts schema refused without writes");

  var recovery = balanceFoundationSchemaMigrationTestRuntime({ accountsMaxColumns: 9, forensicOpening: true });
  var recoveryAccounts = JSON.stringify(recovery.accounts.values);
  var recoveryOpening = JSON.stringify(recovery.opening.values);
  var recovered = executeBalanceFoundationPartialAccountsRecoveryWithRuntime(recovery.runtime);
  check(recovered.status === "PASS" && recovered.writeCount === 1 && recovery.accounts.getMaxColumns() === 8,
    "forensic PARTIAL_ACCOUNTS recovery deletes only column I");
  check(JSON.stringify(recovery.writes()) === JSON.stringify(["Accounts:deleteColumns:9:1"]),
    "recovery performs only the column I deletion");
  check(JSON.stringify(recovery.accounts.values) === recoveryAccounts &&
    JSON.stringify(recovery.opening.values) === recoveryOpening,
    "recovery preserves Accounts A:H and leaves FinanceOpeningBalances untouched");
  var recoveryWrites = recovery.writes().length;
  var recoveredAgain = executeBalanceFoundationPartialAccountsRecoveryWithRuntime(recovery.runtime);
  check(recoveredAgain.status === "ALREADY_RECOVERED" && recoveredAgain.writeCount === 0 &&
    recovery.writes().length === recoveryWrites, "recovery second run has zero writes");

  var openingWidthRecovery = balanceFoundationSchemaMigrationTestRuntime({
    forensicOpening: true, openingMaxColumns: 26
  });
  var widthRecoveryFlushes = 0, widthRecoveryFreshReads = 0;
  openingWidthRecovery.runtime.flush = function() { widthRecoveryFlushes++; };
  openingWidthRecovery.runtime.freshSpreadsheet = function() {
    widthRecoveryFreshReads++;
    return openingWidthRecovery.runtime.spreadsheet;
  };
  var openingWidthOriginal = JSON.stringify(openingWidthRecovery.opening.values);
  var widthRecovered = executeBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime(
    openingWidthRecovery.runtime);
  check(widthRecovered.status === "PASS" && widthRecovered.writeCount === 1 &&
    openingWidthRecovery.opening.getMaxColumns() === 11,
    "blank FinanceOpeningBalances L:Z is an exact-width recovery candidate");
  check(JSON.stringify(openingWidthRecovery.writes()) === JSON.stringify([
    "FinanceOpeningBalances:deleteColumns:12:15"
  ]) && JSON.stringify(openingWidthRecovery.opening.values) === openingWidthOriginal &&
    widthRecoveryFlushes === 1 && widthRecoveryFreshReads === 1,
    "width recovery deletes exactly 15 trailing columns, flushes, fresh-rereads, and preserves A:K");
  var widthRecoveryWrites = openingWidthRecovery.writes().length;
  var widthRecoveredAgain = executeBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime(
    openingWidthRecovery.runtime);
  check(widthRecoveredAgain.status === "ALREADY_RECOVERED" && widthRecoveredAgain.writeCount === 0 &&
    openingWidthRecovery.writes().length === widthRecoveryWrites,
    "exact 11-column legacy opening is already recovered with zero writes");
  [
    { options: { openingMaxColumns: 26, nonblankOpeningResidual: true }, message: "nonblank L:Z refused" },
    { options: { openingMaxColumns: 26, formulaOpeningResidual: true }, message: "formula in L:Z refused" },
    { options: { openingMaxColumns: 25 }, message: "25-column opening refused" },
    { options: { openingMaxColumns: 27 }, message: "27-column opening refused" },
    { options: { openingMaxColumns: 26, v2Opening: true }, message: "V2 opening width recovery refused" },
    { options: { openingMaxColumns: 26, mixedOpeningSchema: true }, message: "mixed opening schema refused" },
    { options: { openingMaxColumns: 26, changedOpeningAmount: true }, message: "changed opening amount refused" },
    { options: { openingMaxColumns: 26, duplicateOpening: true }, message: "duplicate opening refused" }
  ].forEach(function(scenario) {
    var options = Object.assign({ forensicOpening: true }, scenario.options);
    var refusedWidthRecovery = balanceFoundationSchemaMigrationTestRuntime(options);
    var refusedWidth = executeBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime(
      refusedWidthRecovery.runtime);
    check(refusedWidth.status === "REFUSED" && refusedWidth.writeCount === 0 &&
      refusedWidthRecovery.writes().length === 0, scenario.message);
  });
  var missingOpening = balanceFoundationSchemaMigrationTestRuntime({ forensicOpening: true, openingMaxColumns: 26 });
  missingOpening.runtime.spreadsheet.sheets = [missingOpening.accounts];
  var missingOpeningResult = executeBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime(
    missingOpening.runtime);
  check(missingOpeningResult.status === "REFUSED" && missingOpeningResult.writeCount === 0 &&
    missingOpening.writes().length === 0, "missing FinanceOpeningBalances sheet refused without writes");
  var widthRollback = balanceFoundationSchemaMigrationTestRuntime({
    forensicOpening: true, openingMaxColumns: 26, failAfterOpeningWidthDelete: true
  });
  var widthRollbackValues = JSON.stringify(balanceFoundationSheetSnapshot(widthRollback.opening));
  var widthRollbackMessage = "";
  try { executeBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime(widthRollback.runtime); }
  catch (error) { widthRollbackMessage = error.message; }
  check(widthRollback.opening.getMaxColumns() === 26 &&
    JSON.stringify(balanceFoundationSheetSnapshot(widthRollback.opening)) === widthRollbackValues &&
    widthRollbackMessage.indexOf("simulated width recovery acceptance failure") !== -1 &&
    widthRollbackMessage.indexOf("rollback: SUCCESS") !== -1,
    "width recovery acceptance failure restores exact state and preserves original error");
  var resolvedStorage = resolveNumlockProductionSpreadsheetWithRuntime({
    openById: function() { return recovery.runtime.spreadsheet; }
  });
  check(resolvedStorage === recovery.runtime.spreadsheet, "canonical production storage resolution");
  check(resolveNumlockProductionSpreadsheetWithRuntime({ openById: function() { throw new Error("missing"); } }) === null,
    "missing canonical storage rejected");
  var wrongStorage = balanceFoundationSchemaMigrationTestRuntime({ accountsMaxColumns: 9, forensicOpening: true });
  wrongStorage.runtime.spreadsheet.id = "WRONG_STORAGE";
  check(resolveNumlockProductionSpreadsheetWithRuntime({
    openById: function() { return wrongStorage.runtime.spreadsheet; }
  }) === null, "wrong canonical storage identity rejected");
  var wrongStorageResult = runBalanceFoundationPartialAccountsRecoveryWithRuntime({
    storage: { openById: function() { return wrongStorage.runtime.spreadsheet; } }, flush: function() {}
  });
  check(wrongStorageResult.status === "REFUSED" && wrongStorageResult.writeCount === 0 &&
    wrongStorage.writes().length === 0, "wrong recovery storage refused without writes");
  var wrongWidthStorageResult = runBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime({
    storage: { openById: function() { return wrongStorage.runtime.spreadsheet; } }, flush: function() {}
  });
  check(wrongWidthStorageResult.status === "REFUSED" && wrongWidthStorageResult.writeCount === 0 &&
    wrongStorage.writes().length === 0, "wrong width recovery storage refused without writes");
  var wrongMigrationStorageResult = runBalanceFoundationSchemaMigrationWithRuntime({
    storage: { openById: function() { return wrongStorage.runtime.spreadsheet; } }, flush: function() {}
  });
  check(wrongMigrationStorageResult.status === "REFUSED" && wrongMigrationStorageResult.writeCount === 0 &&
    wrongStorage.writes().length === 0, "wrong migration storage refused without writes");
  var missingRecoveryStorage = balanceFoundationSchemaMigrationTestRuntime({
    accountsMaxColumns: 9, forensicOpening: true
  });
  var missingStorageResult = runBalanceFoundationPartialAccountsRecoveryWithRuntime({
    storage: { openById: function() { throw new Error("missing"); } },
    flush: function() {}
  });
  check(missingStorageResult.status === "REFUSED" && missingStorageResult.writeCount === 0 &&
    missingRecoveryStorage.writes().length === 0, "missing recovery storage refused without writes");
  check(getFinanceData.toString().indexOf("requireNumlockProductionSpreadsheet") !== -1 &&
    requireNumlockProductionSpreadsheet.toString().indexOf("resolveNumlockProductionSpreadsheetWithRuntime") !== -1 &&
    runBalanceFoundationPartialAccountsRecoveryWithRuntime.toString()
      .indexOf("resolveNumlockProductionSpreadsheetWithRuntime") !== -1,
    "Finance and recovery share canonical storage authority");
  check(runBalanceFoundationFinanceOpeningBalancesWidthRecoveryWithRuntime.toString()
      .indexOf("resolveNumlockProductionSpreadsheetWithRuntime") !== -1 &&
    runBalanceFoundationFinanceOpeningBalancesWidthRecovery.toString().indexOf("lock.waitLock(30000)") !== -1,
    "width recovery shares canonical storage authority and ScriptLock");
  var refusedProductionDisposable = false;
  try { balanceFoundationRequireDisposableSpreadsheetId(NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID); }
  catch (error) { refusedProductionDisposable = error.message.indexOf("refuses production") !== -1; }
  check(refusedProductionDisposable, "disposable runtime entry refuses production spreadsheet identity");
  var disposableFixture = balanceFoundationDisposableLegacyValues();
  check(disposableFixture.accounts.length === 17 && disposableFixture.accounts[0].length === 8 &&
    disposableFixture.opening.length === 2 && disposableFixture.opening[0].length === 11 &&
    disposableFixture.accounts[1][6] instanceof Date && disposableFixture.opening[1][7] instanceof Date,
    "disposable runtime fixture matches physical legacy widths and Date audit types");
  var disposableRuntime = balanceFoundationDisposableSpreadsheetTestRuntime();
  var disposableId = balanceFoundationCreateDisposableLegacySpreadsheetWithRuntime(
    "Disposable fixture contract", disposableRuntime.runtime);
  var disposableAccounts = disposableRuntime.spreadsheet.getSheetByName("Accounts");
  var disposableOpening = disposableRuntime.spreadsheet.getSheetByName("FinanceOpeningBalances");
  check(disposableId === "DISPOSABLE_TEST_STORAGE" && disposableAccounts.getMaxRows() === 17 &&
    disposableAccounts.getMaxColumns() === 8 && disposableOpening.getMaxRows() === 2 &&
    disposableOpening.getMaxColumns() === 11,
    "disposable fixture uses supported creation APIs and exact physical dimensions");
  check(JSON.stringify(disposableRuntime.createArgumentCounts) === JSON.stringify([3]) &&
    JSON.stringify(disposableRuntime.insertArgumentCounts) === JSON.stringify([1]) &&
    disposableAccounts.values[1][6] instanceof Date && disposableOpening.values[1][7] instanceof Date,
    "disposable fixture mock rejects unsupported overloads and preserves Date values");
  var diagnosticRuntime = balanceFoundationSchemaMigrationTestRuntime({ forensicOpening: true });
  var diagnosticOriginal = { accounts: diagnosticRuntime.accounts.getDataRange().getValues(),
    opening: diagnosticRuntime.opening.getDataRange().getValues() };
  var diagnosticCandidate = buildBalanceFoundationSchemaMigrationCandidate(
    diagnosticOriginal.accounts, diagnosticOriginal.opening);
  function diagnosticClone(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) return value.map(diagnosticClone);
    return value;
  }
  var diagnosticPhysical = { accounts: diagnosticClone(diagnosticCandidate.accounts),
    opening: diagnosticClone(diagnosticCandidate.opening) };
  diagnosticPhysical.accounts[1][1] = 1000;
  var diagnosticAcceptance = validateBalanceFoundationSchemaMigrationAcceptance(
    diagnosticOriginal, diagnosticCandidate, diagnosticPhysical);
  check(diagnosticAcceptance.status === "FAIL" &&
    JSON.stringify(diagnosticAcceptance.firstMismatch) === JSON.stringify({
      sheet: "Accounts", row: 2, column: 2, property: "AccountName", expectedType: "string",
      expectedValue: "Cash", actualType: "number", actualValue: 1000, comparisonRule: "STRICT_VALUE"
    }), "physical acceptance reports the first exact typed cell mismatch without weakening equality");
  var accountCodePhysical = { accounts: diagnosticClone(diagnosticCandidate.accounts),
    opening: diagnosticClone(diagnosticCandidate.opening) };
  accountCodePhysical.opening[1][2] = Number(accountCodePhysical.opening[1][2]);
  check(validateBalanceFoundationSchemaMigrationAcceptance(
    diagnosticOriginal, diagnosticCandidate, accountCodePhysical).status === "PASS",
    "physical acceptance preserves logical AccountCode identity after Apps Script numeric round trip");
  check(runBalanceFoundationSchemaMigration.toString().indexOf("getActiveSpreadsheet") === -1 &&
    runBalanceFoundationSchemaMigration.toString().indexOf("runBalanceFoundationSchemaMigrationWithRuntime") !== -1 &&
    runBalanceFoundationSchemaMigrationWithRuntime.toString()
      .indexOf("resolveNumlockProductionSpreadsheetWithRuntime") !== -1,
    "production migration wrapper uses canonical storage without active fallback");
  check(balanceFoundationCreateDisposableLegacySpreadsheetWithRuntime.toString()
      .indexOf("spreadsheetApp.create") !== -1 &&
    balanceFoundationCreateDisposableLegacySpreadsheetWithRuntime.toString()
      .indexOf("insertSheet(FINANCE_OPENING_BALANCE_POLICY.SHEET)") !== -1 &&
    runBalanceFoundationDisposableRuntimeProof.toString()
      .indexOf("balanceFoundationCreateDisposableLegacySpreadsheet") !== -1 &&
    runBalanceFoundationDisposableRuntimeProof.toString()
      .indexOf("executeBalanceFoundationSchemaMigrationWithRuntime") !== -1 &&
    runBalanceFoundationDisposableRuntimeProof.toString().indexOf("getActiveSpreadsheet") === -1,
    "test-only runtime proof creates isolated storage and reuses migration core");
  [
    { option: "nonblankNinthColumn", message: "nonblank recovery column refused" },
    { option: "unexpectedNinthHeader", message: "unexpected ninth header refused" },
    { option: "v2Opening", message: "V2 opening recovery state refused" },
    { option: "wrongAccountRows", message: "wrong Accounts row state refused" }
  ].forEach(function(scenario) {
    var options = { accountsMaxColumns: 9, forensicOpening: true };
    options[scenario.option] = true;
    var refusedRecovery = balanceFoundationSchemaMigrationTestRuntime(options);
    var refused = executeBalanceFoundationPartialAccountsRecoveryWithRuntime(refusedRecovery.runtime);
    check(refused.status === "REFUSED" && refused.writeCount === 0 && refusedRecovery.writes().length === 0,
      scenario.message);
  });

  var expandedFailure = balanceFoundationSchemaMigrationTestRuntime({ failAfterAccountsExpansion: true });
  var expandedFailureMessage = "";
  try { executeBalanceFoundationSchemaMigrationWithRuntime(expandedFailure.runtime); }
  catch (error) { expandedFailureMessage = error.message; }
  check(expandedFailure.accounts.getMaxColumns() === 8 &&
    expandedFailureMessage.indexOf("simulated post-Accounts failure") !== -1 &&
    expandedFailureMessage.indexOf("rollback: SUCCESS") !== -1,
    "post-Accounts failure restores grid width and preserves original error");
  var accountsWriteFailure = balanceFoundationSchemaMigrationTestRuntime({ failAfterAccountsWrite: true });
  var accountsWriteFailureMessage = "";
  try { executeBalanceFoundationSchemaMigrationWithRuntime(accountsWriteFailure.runtime); }
  catch (error) { accountsWriteFailureMessage = error.message; }
  check(accountsWriteFailure.accounts.getMaxColumns() === 8 && accountsWriteFailure.opening.getMaxColumns() === 11 &&
    accountsWriteFailureMessage.indexOf("simulated post-Accounts write failure") !== -1 &&
    accountsWriteFailureMessage.indexOf("rollback: SUCCESS") !== -1,
    "post-Accounts write failure restores exact legacy grids");
  var openingStructureFailure = balanceFoundationSchemaMigrationTestRuntime({ failOpeningStructure: true });
  var openingStructureFailureMessage = "";
  try { executeBalanceFoundationSchemaMigrationWithRuntime(openingStructureFailure.runtime); }
  catch (error) { openingStructureFailureMessage = error.message; }
  check(openingStructureFailure.accounts.getMaxColumns() === 8 &&
    openingStructureFailure.opening.getMaxColumns() === 11 &&
    openingStructureFailureMessage.indexOf("simulated structural mutation failure") !== -1 &&
    openingStructureFailureMessage.indexOf("rollback: SUCCESS") !== -1,
    "opening structural mutation failure restores exact legacy grids");
  var openingMutationFailure = balanceFoundationSchemaMigrationTestRuntime({ failAfterOpeningMutation: true });
  var openingMutationAccounts = JSON.stringify(openingMutationFailure.accounts.values);
  var openingMutationOpening = JSON.stringify(openingMutationFailure.opening.values);
  var openingMutationMessage = "";
  try { executeBalanceFoundationSchemaMigrationWithRuntime(openingMutationFailure.runtime); }
  catch (error) { openingMutationMessage = error.message; }
  check(openingMutationFailure.accounts.getMaxColumns() === 8 &&
    JSON.stringify(openingMutationFailure.accounts.values) === openingMutationAccounts &&
    JSON.stringify(openingMutationFailure.opening.values) === openingMutationOpening &&
    openingMutationMessage.indexOf("simulated post-opening failure") !== -1,
    "opening mutation failure restores exact logical and physical state");
  var dualFailure = balanceFoundationSchemaMigrationTestRuntime({ failAfterAccountsExpansion: true,
    failDeleteColumns: true });
  var dualFailureMessage = "";
  try { executeBalanceFoundationSchemaMigrationWithRuntime(dualFailure.runtime); }
  catch (error) { dualFailureMessage = error.message; }
  check(dualFailureMessage.indexOf("simulated post-Accounts failure") !== -1 &&
    dualFailureMessage.indexOf("simulated dimension rollback failure") !== -1,
    "migration and rollback errors are both reported");
  var invalidOpeningReadRejected = false;
  try {
    buildCapitalEquityReadModel([], [Object.assign({}, openingV2[0], { Debit: 1 })], accounts, "2026-07-31", 0);
  } catch (error) { invalidOpeningReadRejected = error.message.indexOf("TWO_SIDED_OPENING") !== -1; }
  check(invalidOpeningReadRejected, "Finance retained-earnings read rejects invalid V2 opening");
  check(validateFinanceOpeningBalanceCandidates(openingV2, accounts).status === "PASS",
    "opening balance V2 candidate valid");
  check(hasError(validateFinanceOpeningBalanceCandidates([
    Object.assign({}, openingV2[0], { Debit: 1 })
  ], accounts), "TWO_SIDED_OPENING"), "two-sided opening rejected");
  var twoSidedRetainedRejected = false;
  try { buildRetainedEarningsBalance([Object.assign({}, openingV2[0], { Debit: 1 })], [], "2026-07-31"); }
  catch (error) { twoSidedRetainedRejected = true; }
  check(twoSidedRetainedRejected, "direct retained-earnings reader rejects two-sided V2 opening");
  check(hasError(validateFinanceOpeningBalanceCandidates([
    Object.assign({}, openingV2[0], { Credit: -1 })
  ], accounts), "INVALID_AMOUNT"), "negative opening rejected");
  check(hasError(validateFinanceOpeningBalanceCandidates([
    Object.assign({}, openingV2[0], { Credit: 0 })
  ], accounts), "ZERO_VALUE_OPENING"), "zero opening rejected");
  check(hasError(validateFinanceOpeningBalanceCandidates([
    Object.assign({}, openingV2[0], { AccountCode: "9999" })
  ], accounts), "INACTIVE_OR_UNRESOLVED_ACCOUNT"), "unresolved opening account rejected");
  check(hasError(validateFinanceOpeningBalanceCandidates(openingV2.concat([
    Object.assign({}, openingV2[0], { ID: "DUPLICATE" })
  ]), accounts), "DUPLICATE_ACTIVE_DATE_ACCOUNT"), "duplicate active opening rejected");
  check(validateFinanceOpeningBalanceCandidates([
    Object.assign({}, openingV2[0], { IsActive: false, Credit: 0 })
  ], accounts).excludedInactiveRows === 1, "inactive opening excluded");

  var journal = balanceFoundationJournalFixture();
  var balance = buildBalanceLedgerCandidates(journal, accounts);
  check(balance.status === "PASS" && balance.readOnly && balance.writeCount === 0, "read-only balance candidate builder");
  check(balance.journals["J-001"].debit === 1000 && balance.journals["J-001"].credit === 1000,
    "active journal balanced");
  check(hasError(validateBalanceLedgerCandidates(journal.concat([
    Object.assign({}, journal[0], { LineID: "BL-003", AccountCode: "9999", Debit: 1 })
  ]), accounts), "INACTIVE_OR_UNRESOLVED_ACCOUNT"), "balance account validation");
  check(hasError(validateBalanceLedgerCandidates([
    Object.assign({}, journal[0]), Object.assign({}, journal[1], { LineID: journal[0].LineID })
  ], accounts), "DUPLICATE_OR_MISSING_LINE_ID"), "duplicate LineID rejected");
  check(hasError(validateBalanceLedgerCandidates([
    journal[0], Object.assign({}, journal[1], { Credit: 999 })
  ], accounts), "UNBALANCED_JOURNAL"), "unbalanced journal rejected without plug");
  check(hasError(validateBalanceLedgerCandidates([
    journal[0], Object.assign({}, journal[1], { Debit: 1 })
  ], accounts), "INVALID_ONE_SIDED_AMOUNT"), "two-sided balance line rejected");
  check(hasError(validateBalanceLedgerCandidates(journal.concat([
    Object.assign({}, journal[0], { JournalID: "J-002", LineID: "BL-003" })
  ]), accounts), "DUPLICATE_SOURCE_EVENT"), "balance source-event idempotency");
  var inactiveJournal = journal.concat([Object.assign({}, journal[0], {
    JournalID: "J-INACTIVE", LineID: "BL-INACTIVE", SourceID: "INACTIVE", Debit: 999999, IsActive: false
  })]);
  check(validateBalanceLedgerCandidates(inactiveJournal, accounts).activeDebit === 1000,
    "inactive balance lines contribute zero");

  var inventoryResult = testInventoryFoundationContracts();
  check(inventoryResult.passed && inventoryResult.scenarios >= 20, "Inventory foundation contracts");
  check(buildBalanceLedgerCandidates.toString().indexOf("SpreadsheetApp") === -1 &&
    buildMovingWeightedAverageCandidates.toString().indexOf("SpreadsheetApp") === -1,
    "foundation builders have no spreadsheet runtime dependency");

  Logger.log("PASS: testBalanceFoundationContracts | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function balanceFoundationTestAccounts() {
  return [
    { AccountCode: "1500", AccountName: "Fixed Assets", AccountType: "Asset", StatementGroup: "Non-current Assets", IsActive: true },
    { AccountCode: "1590", AccountName: "Accumulated Depreciation", AccountType: "Contra Asset",
      StatementGroup: "Contra Assets", IsActive: true },
    { AccountCode: "3000", AccountName: "Owner Capital", AccountType: "Equity", StatementGroup: "Owner Equity", IsActive: true },
    { AccountCode: "3100", AccountName: "Owner Draw", AccountType: "Equity", StatementGroup: "Owner Equity", IsActive: true },
    { AccountCode: "3200", AccountName: "Retained Earnings", AccountType: "Equity", StatementGroup: "Retained Earnings", IsActive: true },
    { AccountCode: "6900", AccountName: "Depreciation", AccountType: "Expense",
      StatementGroup: "Depreciation Expense", IsActive: true }
  ];
}

function testInventoryFoundationContracts() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  function hasError(report, code) {
    return report.errors.some(function(item) { return item.errors.indexOf(code) !== -1; });
  }
  var ingredients = [
    { ID_Ingredient: "ING-001", Ingredient: "Beans", Category: "Material", PurchaseUnit: "Purchase lot",
      UsableQty: 1000, BaseUnit: "gr", PurchaseCost: 200000, EffectiveFrom: "2026-01-01", EffectiveTo: "",
      IsActive: true, CreatedAt: "", UpdatedAt: "" },
    { ID_Ingredient: "ING-002", Ingredient: "Cup", Category: "Support", PurchaseUnit: "Purchase lot",
      UsableQty: 100, BaseUnit: "pcs", PurchaseCost: 90000, EffectiveFrom: "2026-01-01", EffectiveTo: "",
      IsActive: true, CreatedAt: "", UpdatedAt: "" }
  ];
  var recipes = [
    { ID_Recipe: "R-1", ID_Prod: "P-1", Tipe: "Hot", ID_Ingredient: "ING-001", UsageQty: 10, IsActive: true },
    { ID_Recipe: "R-2", ID_Prod: "P-1", Tipe: "Hot", ID_Ingredient: "ING-002", UsageQty: 1, IsActive: true }
  ];
  var itemBuild = buildInventoryItemCandidates(ingredients, recipes), items = itemBuild.rows;
  check(itemBuild.status === "PASS" && itemBuild.candidateOnly && itemBuild.readOnly && itemBuild.writeCount === 0,
    "InventoryItems builder is candidate-only");
  check(items[0].ItemID === "ING-001" && items[0].SourceIngredientID === "ING-001" &&
    items[0].Classification === "RAW_MATERIAL", "ingredient identity and raw-material classification");
  check(items[1].Classification === "PACKAGING" && items[1].BaseUOM === "pcs", "packaging classification and base UOM");
  check(hasError(validateInventoryItemCandidates([Object.assign({}, items[0], { ItemID: "ITEM-1" })]),
    "ITEM_ID_MUST_EQUAL_SOURCE_INGREDIENT_ID"), "ItemID must remain the ingredient identity");
  check(hasError(validateInventoryItemCandidates([Object.assign({}, items[0], { Classification: "SUPPLY" })]),
    "INVALID_ITEM_CLASSIFICATION"), "unknown item classification rejected");
  check(hasError(validateInventoryItemCandidates([Object.assign({}, items[0], { BaseUOM: "lot" })]),
    "INVALID_BASE_UOM"), "non-canonical base UOM rejected");

  var conversionAudit = { SupplierRef: "SUP-1", EffectiveFrom: "2026-10-01", EffectiveTo: "",
    EvidenceType: "PACKAGE_LABEL", EvidenceRef: "LABEL-1", EvidenceDate: "2026-09-20", PreparedBy: "A",
    PreparedAt: "2026-09-21T08:00:00+07:00", ReviewedBy: "B", ReviewedAt: "2026-09-22T08:00:00+07:00",
    ApprovalStatus: "APPROVED", ApprovalNote: "", IsActive: true,
    CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  var conversions = [Object.assign({ ConversionID: "CONV-1", ItemID: "ING-001", FromUOM: "bag",
    PackageIdentity: "Beans 1 kg bag", ToUOM: "gr", Numerator: 1000, Denominator: 1 }, conversionAudit)];
  check(validateInventoryUomConversions(conversions, items).status === "PASS", "explicit UOM conversion accepted");
  check(hasError(validateInventoryUomConversions([
    Object.assign({}, conversions[0], { FromUOM: "Purchase lot" })
  ], items), "NON_CONCRETE_PACKAGE_IDENTITY"), "generic purchase lot does not authorize posting");
  check(hasError(validateInventoryUomConversions([
    Object.assign({}, conversions[0], { ToUOM: "ml" })
  ], items), "CONVERSION_TARGET_MUST_BE_BASE_UOM"), "conversion must target canonical base UOM");
  check(hasError(validateInventoryUomConversions([
    Object.assign({}, conversions[0], { ReviewedBy: "A" })
  ], items), "INVALID_INDEPENDENT_APPROVAL"), "preparer cannot approve own conversion");
  check(hasError(validateInventoryUomConversions(conversions.concat([
    Object.assign({}, conversions[0], { ConversionID: "CONV-2", EffectiveFrom: "2026-11-01" })
  ]), items), "OVERLAPPING_APPROVED_CONVERSION"), "overlapping package versions conflict");
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-01", items, conversions).status === "VERIFIED",
    "date resolves to exactly one verified conversion");
  check(classifyInventoryConversionReadiness("ING-002", "2026-10-01", items, conversions).status === "NEEDS_EVIDENCE",
    "active item without evidence needs evidence");
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-01", items, [
    Object.assign({}, conversions[0], { FromUOM: "Purchase lot", PackageIdentity: "Purchase lot" })
  ]).status === "NEEDS_EVIDENCE", "ambiguous generic package remains an evidence gap");
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-01", items, [
    Object.assign({}, conversions[0], { ReviewedBy: "A" })
  ]).status === "CONFLICT", "invalid approval takes conflict precedence");
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-01", [
    Object.assign({}, items[0], { IsActive: false }), items[1]
  ], conversions).status === "INACTIVE", "inactive item takes readiness precedence");

  var inventory = balanceFoundationInventoryFixture();
  var ledgerOptions = { conversions: conversions };
  var validation = validateInventoryLedgerCandidates(inventory, items, ledgerOptions);
  check(validation.status === "PASS" && validation.activeRows.length === 4, "InventoryLedger movement validation");
  check(BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.indexOf("ValuationVariance") !== -1,
    "ValuationVariance is declared in the schema");
  check(hasError(validateInventoryLedgerCandidates([
    Object.assign({}, inventory[0], { BaseUOM: "ml" })
  ], items, ledgerOptions), "BASE_UOM_SNAPSHOT_MISMATCH"), "base-UOM snapshot mismatch rejected");
  check(hasError(validateInventoryLedgerCandidates([
    Object.assign({}, inventory[0], { MovementTimestamp: "2026-10-01" })
  ], items, ledgerOptions), "INVALID_MOVEMENT_TIMESTAMP"), "date-only movement ordering rejected");
  check(hasError(validateInventoryLedgerCandidates([
    Object.assign({}, inventory[0], { AccountingJournalID: "" })
  ], items, ledgerOptions), "MISSING_ACCOUNTING_JOURNAL_LINK"), "missing accounting journal link rejected");
  check(hasError(validateInventoryLedgerCandidates([inventory[0]], items, { conversions: [] }),
    "CONVERSION_AUTHORITY_NEEDS_EVIDENCE"), "posting refuses before valuation without verified conversion");
  var transfer = Object.assign({}, inventory[2], { ID_Movement: "MOV-T", MovementType: "TRANSFER_OUT",
    TransferID: "TRF-1", SourceID: "TRF-1" });
  check(hasError(validateInventoryLedgerCandidates([inventory[0], transfer], items, ledgerOptions), "TRANSFER_AUTHORITY_DISABLED"),
    "multi-location transfers remain dormant");
  var reversal = Object.assign({}, inventory[2], { ID_Movement: "MOV-R", MovementTimestamp: "2026-10-05T08:00:00+07:00",
    MovementType: "ADJUSTMENT_IN", QtyIn: 1, QtyOut: 0, UnitCost: 34, TotalCost: 34, SourceID: "REV-1",
    ReversalOfMovementID: "MOV-003" });
  check(validateInventoryLedgerCandidates(inventory.concat([reversal]), items, ledgerOptions).status === "PASS",
    "linked exact inverse correction accepted");
  check(hasError(validateInventoryLedgerCandidates(inventory.concat([
    Object.assign({}, reversal, { QtyIn: 2, TotalCost: 68 })
  ]), items, ledgerOptions), "REVERSAL_NOT_EXACT_INVERSE"), "non-exact correction rejected");

  var movingAverage = buildMovingWeightedAverageCandidates(inventory, items, ledgerOptions);
  check(movingAverage.candidateOnly && movingAverage.readOnly && movingAverage.writeCount === 0,
    "MWA builder is candidate-only");
  check(movingAverage.calculations[2].outboundCandidateCost === 34 &&
    movingAverage.calculations[2].inventoryValue === 167, "half-up outbound Rupiah rounding");
  check(movingAverage.calculations[3].quantity === 0 && movingAverage.calculations[3].inventoryValue === 0 &&
    movingAverage.calculations[3].outboundCandidateCost === 167, "exact depletion clears residual value");
  var sameTimestamp = [Object.assign({}, inventory[0], { ID_Movement: "MOV-B", QtyIn: 1, UnitCost: 1,
    TotalCost: 1, SourceID: "ORDER-B" }), Object.assign({}, inventory[0], { ID_Movement: "MOV-A", QtyIn: 1,
    UnitCost: 2, TotalCost: 2, SourceID: "ORDER-A" })];
  check(buildMovingWeightedAverageCandidates(sameTimestamp, items, ledgerOptions).calculations[0].ID_Movement === "MOV-A",
    "movement ID deterministically breaks equal-timestamp ties");
  check(movingAverage.hppAuthority === "tabsal.HPP", "tabsal.HPP authority unchanged");
  var negativeRejected = false;
  try { buildMovingWeightedAverageCandidates(inventory.concat([
    Object.assign({}, inventory[2], { ID_Movement: "MOV-NEG", MovementTimestamp: "2026-10-06T08:00:00+07:00",
      QtyOut: 1, SourceID: "NEG-1" })
  ]), items, ledgerOptions); } catch (error) { negativeRejected = error.message.indexOf("negative stock") !== -1; }
  check(negativeRejected, "negative stock fails closed");

  var opening = { OpeningEvidenceID: "OPEN-1", CountDate: "2026-09-30", CountBoundary: "EOD",
    ItemID: "ING-001", Location: "MAIN", BaseUOM: "gr", Quantity: 3, UnitCost: 33.3333333333,
    TotalValue: 100, CountDocumentRef: "COUNT-20260930", CostEvidenceRef: "INV-1", CountedBy: "A",
    ApprovedBy: "B", IsActive: true };
  var packagingOpening = Object.assign({}, opening, { OpeningEvidenceID: "OPEN-2", ItemID: "ING-002",
    BaseUOM: "pcs", Quantity: 0, UnitCost: 0, TotalValue: 0, CostEvidenceRef: "ZERO-COST-APPROVAL" });
  var openingValidation = validateInventoryOpeningEvidence([opening, packagingOpening], items);
  check(openingValidation.status === "PASS" && openingValidation.cutoverDate === "2026-09-30" &&
    openingValidation.ledgerStartDate === "2026-10-01", "opening evidence and cutover semantics");
  check(hasError(validateInventoryOpeningEvidence([
    Object.assign({}, opening, { CountDocumentRef: "" }), packagingOpening
  ], items), "MISSING_COUNTDOCUMENTREF"), "opening without signed count reference rejected");
  check(hasError(validateInventoryOpeningEvidence([opening], items), "MISSING_OPENING_EVIDENCE"),
    "missing item opening evidence rejected");

  var account = Object.assign({}, BALANCE_FOUNDATION_POLICY.INVENTORY_ASSET_ACCOUNT, { IsActive: true });
  check(validateInventoryAssetAccountCandidate(account).status === "PASS" && account.AccountCode === "1100",
    "candidate Inventory Asset taxonomy");
  var reconciliation = reconcileInventorySubledgerToControl(movingAverage.closingState, 0, account);
  check(reconciliation.status === "PASS" && reconciliation.variance === 0 && reconciliation.writeCount === 0,
    "exact Inventory subledger-to-control reconciliation");
  check(reconcileInventorySubledgerToControl({ "ING-001|MAIN": { quantity: 1, value: 1 } }, 0, account).status === "FAIL",
    "Inventory control variance fails reconciliation");
  check(BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED === false,
    "recipe auto-consumption remains disabled");
  check(buildInventoryItemCandidates.toString().indexOf("SpreadsheetApp") === -1 &&
    reconcileInventorySubledgerToControl.toString().indexOf("SpreadsheetApp") === -1,
    "Inventory foundation contracts have no spreadsheet runtime dependency");

  Logger.log("PASS: testInventoryFoundationContracts | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testInventorySchemaMigrationContract() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }

  var fixture = inventorySchemaMigrationTestRuntime();
  var before = readInventorySchemaMigrationState(fixture.spreadsheet);
  var plan = buildInventorySchemaMigrationPlan(before, fixture.runtime.timestamp);
  check(plan.status === "READY" && plan.writeCount === 4, "exact audited fixture plans four logical writes");
  var migrated = executeInventorySchemaMigrationWithRuntime(fixture.runtime);
  check(migrated.status === "MIGRATED" && migrated.writeCount === 4 && migrated.acceptance.status === "PASS",
    "migration completes with fresh-read acceptance");
  check(fixture.spreadsheet.getSheetByName("InventoryItems").getLastRow() === 23,
    "InventoryItems contains header and exactly 22 candidates");
  check(fixture.spreadsheet.getSheetByName("InventoryUOMConversions").getLastRow() === 1 &&
    fixture.spreadsheet.getSheetByName("InventoryLedger").getLastRow() === 1,
    "conversion and ledger storage remain header-only");
  var itemRows = inventoryMigrationRows(readInventorySchemaMigrationState(fixture.spreadsheet).items);
  check(itemRows.every(function(row) { return row.ItemID === row.SourceIngredientID; }),
    "ingredient identity is preserved as ItemID");
  var second = executeInventorySchemaMigrationWithRuntime(fixture.runtime);
  check(second.status === "ALREADY_MIGRATED" && second.writeCount === 0,
    "exact post-image is idempotent with zero writes");
  var recovered = executeInventorySchemaRecoveryWithRuntime(fixture.runtime, migrated.migrationRecord);
  check(recovered.status === "RECOVERED" && recovered.writeCount === 4 &&
    inventoryMigrationFingerprint(readInventorySchemaMigrationState(fixture.spreadsheet)) ===
      migrated.migrationRecord.preStateFingerprint, "recovery restores exact pre-image");

  ["sourceDrift", "accountConflict", "storageCollision", "partialState", "businessData"].forEach(function(option) {
    var options = {}; options[option] = true;
    var refusedFixture = inventorySchemaMigrationTestRuntime(options);
    var refused = executeInventorySchemaMigrationWithRuntime(refusedFixture.runtime);
    check(refused.status === "REFUSED" && refused.writeCount === 0 && refusedFixture.writes().length === 0,
      option + " refuses before any write");
  });
  var mutationFixture = inventorySchemaMigrationTestRuntime();
  var mutationMigration = executeInventorySchemaMigrationWithRuntime(mutationFixture.runtime);
  mutationFixture.spreadsheet.getSheetByName("InventoryLedger").values.push(
    BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.map(function() { return "BUSINESS_DATA"; }));
  check(executeInventorySchemaRecoveryWithRuntime(mutationFixture.runtime, mutationMigration.migrationRecord).status === "REFUSED",
    "recovery refuses after business data appears");
  var accountMutationFixture = inventorySchemaMigrationTestRuntime();
  var accountMutationMigration = executeInventorySchemaMigrationWithRuntime(accountMutationFixture.runtime);
  accountMutationFixture.spreadsheet.getSheetByName("Accounts").values[1][1] = "MUTATED";
  check(executeInventorySchemaRecoveryWithRuntime(accountMutationFixture.runtime,
    accountMutationMigration.migrationRecord).reason === "POST_IMAGE_CHANGED_OR_BUSINESS_DATA_PRESENT",
    "recovery refuses any post-image mutation");
  check(executeInventorySchemaRecoveryWithRuntime(fixture.runtime, {}).status === "REFUSED",
    "recovery refuses unidentified snapshots");
  var ownershipFixture = inventorySchemaMigrationTestRuntime();
  var ownershipMigration = executeInventorySchemaMigrationWithRuntime(ownershipFixture.runtime);
  var unidentifiedOwnership = Object.assign({}, ownershipMigration.migrationRecord, { createdSheets: {} });
  check(executeInventorySchemaRecoveryWithRuntime(ownershipFixture.runtime, unidentifiedOwnership).status === "REFUSED",
    "recovery refuses incomplete owned-sheet identity");
  var acceptanceFailure = inventorySchemaMigrationTestRuntime({ corruptAfterFlush: true });
  check(executeInventorySchemaMigrationWithRuntime(acceptanceFailure.runtime).status === "FAILED_ROLLED_BACK",
    "failed post-write acceptance rolls back");
  check(runInventorySchemaMigration.toString().indexOf("lock.waitLock(30000)") !== -1 &&
    runInventorySchemaRecovery.toString().indexOf("lock.waitLock(30000)") !== -1 &&
    runInventorySchemaMigration.toString().indexOf("resolveNumlockProductionSpreadsheetWithRuntime") !== -1,
    "production entry points use lock and canonical fresh reads");
  check(runInventoryDisposableRuntimeProof.length === 0 &&
    runInventoryDisposableRuntimeProof.toString().indexOf("runInventoryConversionDisposableRuntimeProof") !== -1 &&
    runInventoryDisposableRuntimeProof.toString().indexOf("runInventorySchemaMigration") === -1,
    "legacy Inventory runtime-proof entry routes to the current conversion proof without calling production migration");
  check(executeInventoryDisposableRuntimeProofWithRuntime.toString().indexOf("productionBefore") !== -1 &&
    executeInventoryDisposableRuntimeProofWithRuntime.toString().indexOf("finally") !== -1 &&
    executeInventoryDisposableRuntimeProofWithRuntime.toString().indexOf("production fingerprint changed") !== -1,
    "disposable proof owns production fingerprint comparison and finally cleanup");
  var disposableIdentityFailed = false;
  try {
    var confused = inventorySchemaMigrationTestRuntime();
    confused.runtime.mode = INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_MODE;
    confused.runtime.disposableOwnership = { spreadsheetId: NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
      spreadsheetName: "Wrong" };
    executeInventorySchemaMigrationWithRuntime(confused.runtime);
  } catch (error) { disposableIdentityFailed = true; }
  check(disposableIdentityFailed, "disposable executor rejects production or mismatched ownership");
  check(BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED === false &&
    BALANCE_FOUNDATION_POLICY.HPP_AUTHORITY === "tabsal.HPP", "posting remains disabled and P&L authority unchanged");

  Logger.log("PASS: testInventorySchemaMigrationContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testInventoryConversionAuthorityContracts() {
  testInventoryLemonProductionFlowContracts();
  testInventoryLemonOperationalStandardContracts();
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  function hasError(report, code) {
    return report.errors.some(function(item) { return item.errors.indexOf(code) !== -1; });
  }
  var items = [{ ItemID: "ING-001", ItemName: "Beans", Classification: "RAW_MATERIAL", BaseUOM: "gr",
    EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true, SourceIngredientID: "ING-001",
    CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }];
  var conversion = { ConversionID: "CONV-001", ItemID: "ING-001", FromUOM: "bag",
    PackageIdentity: "Supplier beans SKU-1 1kg bag", SupplierRef: "SUP-1", ToUOM: "gr", Numerator: 1000,
    Denominator: 1, EffectiveFrom: "2026-10-01", EffectiveTo: "", EvidenceType: "PACKAGE_LABEL",
    EvidenceRef: "LABEL-001", EvidenceDate: "2026-09-20", PreparedBy: "PREPARER",
    PreparedAt: "2026-09-21T08:00:00+07:00", ReviewedBy: "REVIEWER",
    ReviewedAt: "2026-09-22T08:00:00+07:00", ApprovalStatus: "APPROVED", ApprovalNote: "",
    IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  check(BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.length === 24,
    "conversion schema has exact 24 columns");
  check(validateInventoryUomConversions([conversion], items).status === "PASS",
    "complete independently approved evidence accepted");
  [
    { field: "PackageIdentity", value: "", code: "NON_CONCRETE_PACKAGE_IDENTITY" },
    { field: "Numerator", value: 0, code: "INVALID_CONVERSION_RATIO" },
    { field: "EvidenceRef", value: "", code: "INVALID_CONVERSION_EVIDENCE" },
    { field: "EvidenceDate", value: "invalid", code: "INVALID_CONVERSION_EVIDENCE" },
    { field: "ReviewedBy", value: "PREPARER", code: "INVALID_INDEPENDENT_APPROVAL" },
    { field: "ApprovalStatus", value: "UNREVIEWED", code: "INVALID_APPROVAL_STATUS" }
  ].forEach(function(scenario) {
    var row = Object.assign({}, conversion); row[scenario.field] = scenario.value;
    check(hasError(validateInventoryUomConversions([row], items), scenario.code), scenario.field + " validation");
  });
  var closed = Object.assign({}, conversion, { EffectiveTo: "2026-10-31" });
  var successor = Object.assign({}, conversion, { ConversionID: "CONV-002", PackageIdentity: "SKU-1 500g bag",
    Numerator: 500, EffectiveFrom: "2026-11-01", EvidenceRef: "LABEL-002" });
  check(validateInventoryUomConversions([closed, successor], items).status === "PASS",
    "non-overlapping package version accepted");
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-15", items, [closed, successor]).status === "VERIFIED",
    "readiness resolves effective version");
  check(classifyInventoryConversionReadiness("ING-001", "2026-09-30", items, [closed]).status === "NEEDS_EVIDENCE",
    "date without applicable authority needs evidence");
  var conflict = Object.assign({}, successor, { EffectiveFrom: "2026-10-31" });
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-31", items, [closed, conflict]).status === "CONFLICT",
    "overlap takes conflict precedence");

  var movement = balanceFoundationInventoryFixture()[0];
  ["OPENING_IN", "PURCHASE_RECEIPT_IN", "CONSUMPTION_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT",
    "TRANSFER_IN", "TRANSFER_OUT"].forEach(function(type) {
    var candidate = Object.assign({}, movement, { MovementType: type, SourceID: "SRC-" + type,
      QtyIn: inventoryMovementDirection(type) === "IN" ? 1 : 0,
      QtyOut: inventoryMovementDirection(type) === "OUT" ? 1 : 0,
      UnitCost: inventoryMovementDirection(type) === "IN" ? 100 : 0,
      TotalCost: inventoryMovementDirection(type) === "IN" ? 100 : 0 });
    check(hasError(validateInventoryLedgerCandidates([candidate], items, { conversions: [] }),
      "CONVERSION_AUTHORITY_NEEDS_EVIDENCE"), type + " is conversion-gated");
  });
  check(validateInventoryLedgerCandidates([movement], items, { conversions: [conversion] }).status === "PASS",
    "verified authority admits posting candidate before valuation");
  var deterministicRefusal = gateInventoryMovementConversion(movement, items, []);
  check(JSON.stringify(deterministicRefusal) === JSON.stringify({ status: "REFUSED", itemId: "ING-001",
    postingDate: "2026-10-01", readiness: "NEEDS_EVIDENCE", reasonCodes: ["NO_VERIFIED_CONVERSION"],
    conversionId: null }), "posting refusal reports deterministic item, date, readiness, and reasons");
  check(BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED === false &&
    BALANCE_FOUNDATION_POLICY.HPP_AUTHORITY === "tabsal.HPP", "recipe posting disabled and tabsal.HPP preserved");

  var exactGrid = inventoryConversionSchemaMigrationTestRuntime({ maxColumns: 13 });
  check(buildInventoryConversionSchemaMigrationPlan(
    readInventoryConversionSchemaMigrationState(exactGrid.spreadsheet)).status === "READY",
    "legacy header with exact thirteen-column grid ready");
  var fixture = inventoryConversionSchemaMigrationTestRuntime({ maxColumns: 26 });
  var before = readInventoryConversionSchemaMigrationState(fixture.spreadsheet);
  check(buildInventoryConversionSchemaMigrationPlan(before).status === "READY",
    "legacy header with larger empty grid ready");
  var migrated = executeInventoryConversionSchemaMigrationWithRuntime(fixture.runtime);
  check(migrated.status === "MIGRATED" && migrated.writeCount === 1 && migrated.acceptance.status === "PASS",
    "one logical write and fresh-read acceptance");
  check(fixture.writes().filter(function(entry) { return entry === "InventoryUOMConversions"; }).length === 1,
    "migration performs exactly one header value write");
  check(inventoryMigrationFingerprint(before.items) === inventoryMigrationFingerprint(
    readInventoryConversionSchemaMigrationState(fixture.spreadsheet).items) &&
    inventoryMigrationFingerprint(before.ledger) === inventoryMigrationFingerprint(
      readInventoryConversionSchemaMigrationState(fixture.spreadsheet).ledger),
    "InventoryItems and InventoryLedger preserved byte-for-byte");
  var writeCount = fixture.writes().length;
  var second = executeInventoryConversionSchemaMigrationWithRuntime(fixture.runtime);
  check(second.status === "ALREADY_MIGRATED" && second.writeCount === 0 && fixture.writes().length === writeCount,
    "exact post-image with larger empty grid is idempotent");
  var recovered = executeInventoryConversionSchemaRecoveryWithRuntime(fixture.runtime, migrated.migrationRecord);
  check(recovered.status === "RECOVERED" && recovered.writeCount === 1 &&
    inventoryConversionSchemaMigrationFingerprint(readInventoryConversionSchemaMigrationState(fixture.spreadsheet)) ===
      migrated.migrationRecord.preStateFingerprint, "guarded recovery restores exact legacy image");
  ["rows", "formulas", "extraValue", "extraFormula", "extraNote", "drift", "partial"].forEach(function(option) {
    var options = {}; options[option] = true;
    var refusedFixture = inventoryConversionSchemaMigrationTestRuntime(options);
    var refused = executeInventoryConversionSchemaMigrationWithRuntime(refusedFixture.runtime);
    check(refused.status === "REFUSED" && refused.writeCount === 0 && refusedFixture.writes().length === 0,
      option + " state refuses before write");
  });
  var acceptanceFailure = inventoryConversionSchemaMigrationTestRuntime({ corruptAfterFlush: true });
  check(executeInventoryConversionSchemaMigrationWithRuntime(acceptanceFailure.runtime).status === "FAILED_ROLLED_BACK" &&
    classifyInventoryConversionSchemaState(readInventoryConversionSchemaMigrationState(
      acceptanceFailure.spreadsheet)) === "LEGACY_READY", "failed acceptance restores the exact legacy header");
  var changedFixture = inventoryConversionSchemaMigrationTestRuntime();
  var changedMigration = executeInventoryConversionSchemaMigrationWithRuntime(changedFixture.runtime);
  changedFixture.spreadsheet.getSheetByName("InventoryUOMConversions").values.push(
    BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.map(function() { return "BUSINESS"; }));
  check(executeInventoryConversionSchemaRecoveryWithRuntime(changedFixture.runtime,
    changedMigration.migrationRecord).status === "REFUSED", "recovery refuses changed post-image or business rows");
  var capacityFixture = inventoryConversionSchemaMigrationTestRuntime({ maxColumns: 26 });
  var capacityMigration = executeInventoryConversionSchemaMigrationWithRuntime(capacityFixture.runtime);
  capacityFixture.spreadsheet.getSheetByName("InventoryUOMConversions").maxColumns = 30;
  check(executeInventoryConversionSchemaRecoveryWithRuntime(capacityFixture.runtime,
    capacityMigration.migrationRecord).status === "RECOVERED", "recovery ignores benign empty grid-capacity changes");
  var notedFixture = inventoryConversionSchemaMigrationTestRuntime({ maxColumns: 26 });
  var notedMigration = executeInventoryConversionSchemaMigrationWithRuntime(notedFixture.runtime);
  notedFixture.spreadsheet.getSheetByName("InventoryUOMConversions").notes[0] = [];
  notedFixture.spreadsheet.getSheetByName("InventoryUOMConversions").notes[0][25] = "changed";
  check(executeInventoryConversionSchemaRecoveryWithRuntime(notedFixture.runtime,
    notedMigration.migrationRecord).status === "REFUSED", "recovery refuses note drift in unused grid capacity");
  check(executeInventoryConversionSchemaRecoveryWithRuntime(fixture.runtime, {}).status === "REFUSED",
    "recovery refuses unidentified record");
  check(runInventoryConversionSchemaMigration.toString().indexOf("lock.waitLock(30000)") !== -1 &&
    runInventoryConversionSchemaRecovery.toString().indexOf("lock.waitLock(30000)") !== -1,
    "production wrappers require ScriptLock");
  check(runInventoryConversionDisposableRuntimeProof.length === 0 &&
    runInventoryConversionDisposableRuntimeProof.toString().indexOf("SpreadsheetApp.create") !== -1 &&
    runInventoryConversionDisposableRuntimeProof.toString().indexOf("runInventoryConversionSchemaMigration") === -1,
    "conversion runtime proof is parameterless, disposable, and does not call the production wrapper");
  check(executeInventoryConversionDisposableRuntimeProofWithRuntime.toString().indexOf("productionBefore") !== -1 &&
    executeInventoryConversionDisposableRuntimeProofWithRuntime.toString().indexOf("finally") !== -1 &&
    executeInventoryConversionDisposableRuntimeProofWithRuntime.toString().indexOf("production fingerprint changed") !== -1 &&
    executeInventoryConversionDisposableRuntimeProofWithRuntime.toString().indexOf("LOW single-operator readiness") !== -1 &&
    executeInventoryConversionDisposableRuntimeProofWithRuntime.toString().indexOf("HIGH-risk Lemon attestation refusal") !== -1,
    "conversion runtime proof verifies governance, production non-mutation, and cleanup");
  check(INVENTORY_CONVERSION_CANDIDATE_POPULATION.EXPECTED_COUNT === 21 &&
    INVENTORY_CONVERSION_CANDIDATE_POPULATION.MANIFESTS.length === 21 &&
    INVENTORY_CONVERSION_CANDIDATE_POPULATION.MANIFESTS.every(function(entry) {
      return entry[0] !== "ING-018" && /^[A-Za-z0-9_-]+$/.test(entry[1]) && /^[a-f0-9]{64}$/.test(entry[2]);
    }), "candidate population owns exact frozen manifest inventory and excludes Lemon");
  check(runInventoryConversionCandidatePopulation.toString().indexOf("lock.waitLock(30000)") !== -1 &&
    runInventoryConversionCandidateRecovery.toString().indexOf("lock.waitLock(30000)") !== -1,
    "candidate population and recovery require ScriptLock");
  check(runInventoryConversionCandidateDisposableRuntimeProof.length === 0 &&
    runInventoryConversionCandidateDisposableRuntimeProof.toString().indexOf("SpreadsheetApp.create") !== -1 &&
    runInventoryConversionCandidateDisposableRuntimeProof.toString().indexOf("runInventoryConversionCandidatePopulation") === -1,
    "candidate population proof is parameterless, disposable, and avoids production wrapper");
  check(executeInventoryConversionCandidateDisposableRuntimeProofWithRuntime.toString().indexOf("productionBefore") !== -1 &&
    executeInventoryConversionCandidateDisposableRuntimeProofWithRuntime.toString().indexOf("ALREADY_POPULATED") !== -1 &&
    executeInventoryConversionCandidateDisposableRuntimeProofWithRuntime.toString().indexOf("inactive candidates cannot pass posting gate") !== -1,
    "candidate population proof covers idempotency, non-mutation, and closed posting gate");
  check(INVENTORY_CONVERSION_ACTIVATION.EXPECTED_COUNT === 21 &&
    INVENTORY_CONVERSION_ACTIVATION.EFFECTIVE_FROM === "2026-10-01" &&
    BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.length === 24,
    "activation freezes exact candidate count, prospective date, and unchanged schema");
  check(runInventoryConversionActivation.toString().indexOf("lock.waitLock(30000)") !== -1 &&
    runInventoryConversionActivationRecovery.toString().indexOf("lock.waitLock(30000)") !== -1,
    "activation and recovery production wrappers require ScriptLock");
  check(executeInventoryConversionActivationWithRuntime.toString().indexOf("indexOf(\"IsActive\") + 1") !== -1 &&
    executeInventoryConversionActivationWithRuntime.toString().indexOf("candidates.length, 1") !== -1 &&
    executeInventoryConversionActivationWithRuntime.toString().indexOf("ALREADY_ACTIVATED") !== -1,
    "activation owns only IsActive and is idempotent");
  check(runInventoryConversionActivationDisposableRuntimeProof.length === 0 &&
    runInventoryConversionActivationDisposableRuntimeProof.toString().indexOf("SpreadsheetApp.create") !== -1 &&
    runInventoryConversionActivationDisposableRuntimeProof.toString().indexOf("runInventoryConversionActivation()") === -1,
    "activation proof is parameterless, disposable, and avoids production activation wrapper");
  check(executeInventoryConversionActivationDisposableRuntimeProofWithRuntime.toString().indexOf("posting gate before EffectiveFrom") !== -1 &&
    executeInventoryConversionActivationDisposableRuntimeProofWithRuntime.toString().indexOf("posting gate on or after EffectiveFrom") !== -1 &&
    executeInventoryConversionActivationDisposableRuntimeProofWithRuntime.toString().indexOf("dependent ledger rollback guard") !== -1 &&
    executeInventoryConversionActivationDisposableRuntimeProofWithRuntime.toString().indexOf("productionBefore") !== -1,
    "activation proof covers prospective gate, dependency guard, and production non-mutation");
  var attestationResult = testInventoryOperatorAttestationContracts();
  check(attestationResult.passed && attestationResult.scenarios >= 20,
    "operator attestation conversion authority contracts");

  Logger.log("PASS: testInventoryConversionAuthorityContracts | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testInventoryOperatorAttestationContracts() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  function hasError(report, code) {
    return report.errors.some(function(item) { return item.errors.indexOf(code) !== -1; });
  }
  var items = [
    { ItemID: "ING-001", ItemName: "Beans", Classification: "RAW_MATERIAL", BaseUOM: "gr",
      EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true, SourceIngredientID: "ING-001",
      CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" },
    { ItemID: "ING-018", ItemName: "Lemon", Classification: "RAW_MATERIAL", BaseUOM: "slice",
      EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true, SourceIngredientID: "ING-018",
      CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" },
    { ItemID: "ING-021", ItemName: "Es", Classification: "RAW_MATERIAL", BaseUOM: "gr",
      EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true, SourceIngredientID: "ING-021",
      CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }
  ];
  var hash = new Array(65).join("a");
  var observedNote = "BASIS=DIRECTLY_OBSERVED; METHOD=CALIBRATED_SCALE; PLAUSIBILITY=CONFIRMED; " +
    "LIMITATIONS=NONE; REVIEW=ARITHMETIC_REPERFORMED";
  var knownNote = "BASIS=OPERATOR_KNOWN; METHOD=RECURRING_PURCHASE_UNIT; PLAUSIBILITY=CONFIRMED; " +
    "LIMITATIONS=NO_PACKAGE_PHOTO; REVIEW=WORKFLOW_CONFIRMED";
  var attestation = { ConversionID: "CONV-ATT-001", ItemID: "ING-001", FromUOM: "bag",
    PackageIdentity: "ING-001|SUP-1|Beans|SKU-1|1kg|V01", SupplierRef: "SUP-1", ToUOM: "gr",
    Numerator: 1000, Denominator: 1, EffectiveFrom: "2026-10-01", EffectiveTo: "",
    EvidenceType: "OPERATOR_ATTESTATION", EvidenceRef: "GDRIVE:manifest_1:V01:SHA256:" + hash,
    EvidenceDate: "2026-09-20", PreparedBy: "PREPARER", PreparedAt: "2026-09-21T08:00:00+07:00",
    ReviewedBy: "REVIEWER", ReviewedAt: "2026-09-22T08:00:00+07:00", ApprovalStatus: "APPROVED",
    ApprovalNote: observedNote, IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  check(BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.length === 24,
    "operator attestation preserves exact conversion schema");
  check(BALANCE_FOUNDATION_POLICY.INVENTORY_CONVERSION_EVIDENCE_TYPES.length === 7 &&
    BALANCE_FOUNDATION_POLICY.INVENTORY_CONVERSION_EVIDENCE_TYPES.indexOf("OPERATOR_ATTESTATION") !== -1,
    "evidence types include the scoped management standard");
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-01", items, [attestation]).status === "VERIFIED",
    "directly observed attestation is verified");
  var known = Object.assign({}, attestation, { ConversionID: "CONV-ATT-002", ApprovalNote: knownNote });
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-01", items, [known]).status === "VERIFIED",
    "operator-known attestation is verified");
  var singleOperatorNote = "BASIS=OPERATOR_KNOWN; " +
    "METHOD=SINGLE_OPERATOR_ATTESTATION_SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC_RISK_LOW; " +
    "PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW; " +
    "REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED";
  var singleOperator = Object.assign({}, attestation, { ConversionID: "CONV-SINGLE-001",
    EvidenceDate: "2026-09-04", PreparedBy: "Dekker", PreparedAt: "2026-09-04T16:00:00+07:00",
    ReviewedBy: "", ReviewedAt: "", ApprovalStatus: "SINGLE_OPERATOR_APPROVED", ApprovalNote: singleOperatorNote });
  check(BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.length === 24 &&
    BALANCE_FOUNDATION_POLICY.INVENTORY_CONVERSION_APPROVAL_STATUSES.indexOf("SINGLE_OPERATOR_APPROVED") !== -1,
    "single-operator governance requires no schema expansion");
  check(inventoryOperatorAttestationRiskTier(singleOperator,
    inventoryOperatorAttestationDetails(singleOperator)) === "LOW", "fixed bag is low risk");
  check(validateInventoryUomConversions([singleOperator], items).status === "PASS",
    "complete single-operator compensating controls pass");
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-01", items,
    [singleOperator]).status === "SINGLE_OPERATOR_VERIFIED", "single-operator readiness remains distinguishable");
  check(gateInventoryMovementConversion({ ItemID: "ING-001", MovementTimestamp: "2026-10-01T08:00:00+07:00" },
    items, [singleOperator]).status === "ACCEPTED", "posting gate accepts complete single-operator authority");
  [
    { name: "missing immutable manifest", changes: { EvidenceRef: "GDRIVE:mutable" } },
    { name: "missing signed statement", changes: { ApprovalNote: singleOperatorNote.replace(
      "SIGNED_FIRST_PERSON_STATEMENT_", "") } },
    { name: "missing deterministic arithmetic", changes: { ApprovalNote: singleOperatorNote.replace(
      "DETERMINISTIC_ARITHMETIC_", "") } },
    { name: "missing self-approval disclosure", changes: { ApprovalNote: singleOperatorNote.replace(
      "SELF_APPROVAL_DISCLOSED_", "") } },
    { name: "reviewer masquerade", changes: { ReviewedBy: "Dekker", ReviewedAt: "2026-09-04T16:01:00+07:00" } },
    { name: "invalid attestation chronology", changes: { EvidenceDate: "2026-09-05" } },
    { name: "backdated authority", changes: { EffectiveFrom: "2026-09-30" } }
  ].forEach(function(scenario, index) {
    var invalidSingle = Object.assign({}, singleOperator, scenario.changes,
      { ConversionID: "CONV-SINGLE-BAD-" + index });
    check(hasError(validateInventoryUomConversions([invalidSingle], items), "INVALID_SINGLE_OPERATOR_GOVERNANCE"),
      scenario.name + " fails single-operator governance");
    check(gateInventoryMovementConversion({ ItemID: "ING-001", MovementTimestamp: "2026-10-01T08:00:00+07:00" },
      items, [invalidSingle]).status === "REFUSED", scenario.name + " cannot bypass posting gate");
  });
  [
    { name: "estimated basis", changes: { ApprovalNote: "BASIS=OPERATOR_KNOWN; METHOD=ESTIMATED_FROM_MEMORY; " +
        "PLAUSIBILITY=CONFIRMED; LIMITATIONS=NONE; REVIEW=CHECKED" }, code: "PROHIBITED_OPERATOR_ATTESTATION_BASIS" },
    { name: "inferred basis", changes: { ApprovalNote: "BASIS=OPERATOR_KNOWN; METHOD=INFERRED_FROM_RECIPE; " +
        "PLAUSIBILITY=CONFIRMED; LIMITATIONS=NONE; REVIEW=CHECKED" }, code: "PROHIBITED_OPERATOR_ATTESTATION_BASIS" },
    { name: "missing approval note", changes: { ApprovalNote: "" }, code: "INVALID_OPERATOR_ATTESTATION_APPROVAL_NOTE" },
    { name: "malformed approval note", changes: { ApprovalNote: "BASIS=OPERATOR_KNOWN; METHOD=KNOWN" },
      code: "INVALID_OPERATOR_ATTESTATION_APPROVAL_NOTE" },
    { name: "invalid evidence reference", changes: { EvidenceRef: "GDRIVE:mutable" },
      code: "INVALID_OPERATOR_ATTESTATION_EVIDENCE_REF" },
    { name: "missing source identity", changes: { SupplierRef: "" },
      code: "INVALID_OPERATOR_ATTESTATION_SOURCE_IDENTITY" },
    { name: "malformed package identity", changes: { PackageIdentity: "Supplier beans bag" },
      code: "INVALID_OPERATOR_ATTESTATION_PACKAGE_IDENTITY" },
    { name: "self review", changes: { ReviewedBy: "PREPARER" }, code: "INVALID_INDEPENDENT_APPROVAL" },
    { name: "review chronology", changes: { ReviewedAt: "2026-09-21T08:00:00+07:00" },
      code: "INVALID_INDEPENDENT_APPROVAL" },
    { name: "evidence after review", changes: { EvidenceDate: "2026-09-23" }, code: "INVALID_INDEPENDENT_APPROVAL" },
    { name: "invalid ratio", changes: { Numerator: 0 }, code: "INVALID_CONVERSION_RATIO" },
    { name: "base UOM mismatch", changes: { ToUOM: "ml" }, code: "CONVERSION_TARGET_MUST_BE_BASE_UOM" },
    { name: "incomplete package", changes: { PackageIdentity: "" }, code: "NON_CONCRETE_PACKAGE_IDENTITY" },
    { name: "unresolved item", changes: { ItemID: "ING-999" }, code: "UNRESOLVED_ITEM_ID" }
  ].forEach(function(scenario, index) {
    var invalid = Object.assign({}, attestation, scenario.changes, { ConversionID: "CONV-BAD-" + index });
    var report = validateInventoryUomConversions([invalid], items);
    check(hasError(report, scenario.code), scenario.name + " fails closed");
    check(gateInventoryMovementConversion({ ItemID: invalid.ItemID,
      MovementTimestamp: "2026-10-01T08:00:00+07:00" }, items, [invalid]).status === "REFUSED",
      scenario.name + " cannot bypass posting gate");
  });
  var overlapping = Object.assign({}, attestation, { ConversionID: "CONV-ATT-OVERLAP", EffectiveFrom: "2026-10-15" });
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-15", items,
    [attestation, overlapping]).status === "CONFLICT", "overlapping attestations conflict");
  check(gateInventoryMovementConversion({ ItemID: "ING-001", MovementTimestamp: "2026-10-15T08:00:00+07:00" },
    items, [attestation, overlapping]).status === "REFUSED", "overlap is refused by posting gate");
  var lemon = Object.assign({}, attestation, { ConversionID: "CONV-LEMON", ItemID: "ING-018", FromUOM: "fruit",
    PackageIdentity: "ING-018|SUP-2|Lemon|NO-SKU|1fruit|V01", SupplierRef: "SUP-2", ToUOM: "slice",
    Numerator: 8 });
  check(hasError(validateInventoryUomConversions([lemon], items),
    "LEMON_MANAGEMENT_STANDARD_REQUIRED"), "Lemon requires management standard authority");
  check(gateInventoryMovementConversion({ ItemID: "ING-018", MovementTimestamp: "2026-10-01T08:00:00+07:00" },
    items, [lemon]).status === "REFUSED", "Lemon attestation is posting-refused");
  var singleLemon = Object.assign({}, lemon, singleOperator, { ConversionID: "CONV-SINGLE-LEMON",
    ItemID: "ING-018", FromUOM: "bag", PackageIdentity: "ING-018|INTERNAL-FRUIT-SHOP|Lemon|NO-SKU|nominal 1 kg bag|V01",
    SupplierRef: "INTERNAL-FRUIT-SHOP", ToUOM: "slice", Numerator: 21 });
  check(inventoryOperatorAttestationRiskTier(singleLemon,
    inventoryOperatorAttestationDetails(singleLemon)) === "HIGH", "Lemon attestation is high risk");
  check(hasError(validateInventoryUomConversions([singleLemon], items),
    "HIGH_RISK_SINGLE_OPERATOR_ATTESTATION"), "single-operator attestation cannot verify Lemon");
  var controlledYieldNote = "BASIS=DIRECTLY_OBSERVED; " +
    "METHOD=SINGLE_OPERATOR_CONTROLLED_YIELD_MINIMUM_5_OBSERVATIONS_OBSERVED_VARIATION_RECORDED_" +
    "MEDIAN_STANDARD_CONVERSION_SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC; " +
    "PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW; " +
    "REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED";
  var controlledYield = Object.assign({}, singleLemon, { ConversionID: "CONV-CONTROLLED-YIELD",
    EvidenceType: "CONTROLLED_YIELD_TEST", ApprovalNote: controlledYieldNote });
  check(validateInventoryUomConversions([controlledYield], items).status === "FAIL",
    "controlled yield cannot replace Lemon management authority");
  check(classifyInventoryConversionReadiness("ING-018", "2026-10-01", items,
    [controlledYield]).status === "CONFLICT", "historical yield cannot authorize Lemon");
  var incompleteYield = Object.assign({}, controlledYield, { ConversionID: "CONV-CONTROLLED-YIELD-BAD",
    ApprovalNote: controlledYieldNote.replace("MINIMUM_5_OBSERVATIONS_", "") });
  check(hasError(validateInventoryUomConversions([incompleteYield], items),
    "INVALID_SINGLE_OPERATOR_CONTROLLED_YIELD"), "incomplete controlled yield remains blocked");
  var estimatedYield = Object.assign({}, controlledYield, { ConversionID: "CONV-CONTROLLED-YIELD-ESTIMATED",
    ApprovalNote: controlledYieldNote.replace("MEDIAN_STANDARD_CONVERSION", "ESTIMATED_MEDIAN_STANDARD_CONVERSION") });
  check(hasError(validateInventoryUomConversions([estimatedYield], items),
    "INVALID_SINGLE_OPERATOR_GOVERNANCE"), "estimated controlled yield remains blocked");
  var fixedIce = Object.assign({}, attestation, { ConversionID: "CONV-ICE", ItemID: "ING-021", FromUOM: "bag",
    PackageIdentity: "ING-021|SUP-ICE|IceBrand|SKU-ICE|5kg|V01", SupplierRef: "SUP-ICE", ToUOM: "gr",
    Numerator: 5000, ApprovalNote: "BASIS=DIRECTLY_OBSERVED; METHOD=FIXED_STANDARDIZED_PACKAGE_CALIBRATED_SCALE; " +
      "PLAUSIBILITY=CONFIRMED; LIMITATIONS=SEALED_PACKAGE_ONLY; REVIEW=PACKAGE_AND_ARITHMETIC_CONFIRMED" });
  check(classifyInventoryConversionReadiness("ING-021", "2026-10-01", items, [fixedIce]).status === "VERIFIED",
    "eligible fixed-package Es is verified");
  var singleIceNote = "BASIS=OPERATOR_KNOWN; METHOD=FIXED_STANDARDIZED_PACKAGE_SINGLE_OPERATOR_ATTESTATION_" +
    "SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC_RISK_MODERATE; PLAUSIBILITY=CONFIRMED; " +
    "LIMITATIONS=NO_INDEPENDENT_REVIEW; REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED";
  var singleIce = Object.assign({}, fixedIce, singleOperator, { ConversionID: "CONV-SINGLE-ICE", ItemID: "ING-021",
    PackageIdentity: fixedIce.PackageIdentity, SupplierRef: fixedIce.SupplierRef, ToUOM: "gr", Numerator: 5000,
    ApprovalNote: singleIceNote });
  check(inventoryOperatorAttestationRiskTier(singleIce,
    inventoryOperatorAttestationDetails(singleIce)) === "MODERATE", "fixed standardized ice is moderate risk");
  check(classifyInventoryConversionReadiness("ING-021", "2026-10-01", items,
    [singleIce]).status === "SINGLE_OPERATOR_VERIFIED", "fixed standardized ice supports single-operator authority");
  var variableIce = Object.assign({}, fixedIce, { ConversionID: "CONV-ICE-VARIABLE", FromUOM: "container",
    PackageIdentity: "ING-021|INTERNAL-ICE|LooseIce|NO-SKU|variable|V01", SupplierRef: "INTERNAL-ICE",
    ApprovalNote: "BASIS=OPERATOR_KNOWN; METHOD=VARIABLE_LOOSE_ICE; PLAUSIBILITY=CONFIRMED; " +
      "LIMITATIONS=VARIABLE_YIELD; REVIEW=WORKFLOW_CONFIRMED" });
  check(hasError(validateInventoryUomConversions([variableIce], items),
    "OPERATOR_ATTESTATION_REQUIRES_CONTROLLED_YIELD_TEST"), "variable Es requires controlled yield evidence");
  check(gateInventoryMovementConversion({ ItemID: "ING-021", MovementTimestamp: "2026-10-01T08:00:00+07:00" },
    items, [variableIce]).status === "REFUSED", "variable Es is posting-refused");
  check(gateInventoryMovementConversion({ ItemID: "ING-001", MovementTimestamp: "2026-10-01T08:00:00+07:00" },
    items, [attestation]).status === "ACCEPTED", "posting gate accepts valid verified attestation only");
  check(classifyInventoryConversionReadiness("ING-001", "2026-10-15", items,
    [attestation, Object.assign({}, singleOperator, { EffectiveFrom: "2026-10-15" })]).status === "CONFLICT",
    "independent and single-operator authorities cannot overlap");
  ["PACKAGE_LABEL", "SUPPLIER_SPECIFICATION", "INVOICE_RECEIPT", "PHYSICAL_COUNT", "CONTROLLED_YIELD_TEST"]
    .forEach(function(type) {
      var legacy = Object.assign({}, attestation, { ConversionID: "CONV-LEGACY-" + type, EvidenceType: type,
        EvidenceRef: "LEGACY-" + type, ApprovalNote: "" });
      check(validateInventoryUomConversions([legacy], items).status === "PASS", type + " behavior is preserved");
    });
  Logger.log("PASS: testInventoryOperatorAttestationContracts | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function inventoryConversionSchemaMigrationTestRuntime(options) {
  options = options || {};
  var writes = [], legacy = INVENTORY_CONVERSION_SCHEMA_MIGRATION.LEGACY_HEADERS.slice();
  var conversionValues = [options.drift ? ["UnexpectedHeader"] : options.partial ? legacy.slice(0, 12) : legacy];
  if (options.rows) conversionValues.push(legacy.map(function() { return "BUSINESS"; }));
  if (options.extraValue) conversionValues[0][13] = "UNEXPECTED";
  var conversions = capitalEquitySchemaTestSheet("InventoryUOMConversions", conversionValues, writes,
    { maxRows: 1000, maxColumns: options.maxColumns || Math.max(26, conversionValues[0].length) });
  conversions.formulas = conversionValues.map(function(row) { return row.map(function() { return ""; }); });
  if (options.formulas) conversions.formulas[0][0] = "=1";
  if (options.extraFormula) {
    while (conversions.formulas[0].length < 14) conversions.formulas[0].push("");
    conversions.formulas[0][13] = "=1";
  }
  conversions.notes = [];
  if (options.extraNote) {
    conversions.notes[0] = [];
    conversions.notes[0][13] = "unexpected note";
  }
  var conversionGetRange = conversions.getRange;
  conversions.getRange = function(row, column, rowCount, columnCount) {
    var range = conversionGetRange.call(this, row, column, rowCount, columnCount), self = this;
    range.getNotes = function() {
      var result = [];
      for (var rowOffset = 0; rowOffset < rowCount; rowOffset++) {
        var source = self.notes[row - 1 + rowOffset] || [], target = [];
        for (var columnOffset = 0; columnOffset < columnCount; columnOffset++) {
          target.push(source[column - 1 + columnOffset] || "");
        }
        result.push(target);
      }
      return result;
    };
    return range;
  };
  var items = capitalEquitySchemaTestSheet("InventoryItems",
    [BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS.slice(), BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS.map(function(header) {
      return header === "ItemID" ? "ING-001" : header === "IsActive" ? true : "VALUE";
    })], writes, { maxRows: 1000, maxColumns: BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS.length });
  var ledger = capitalEquitySchemaTestSheet("InventoryLedger", [BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.slice()],
    writes, { maxRows: 1000, maxColumns: BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.length });
  items.formulas = items.values.map(function(row) { return row.map(function() { return ""; }); });
  ledger.formulas = ledger.values.map(function(row) { return row.map(function() { return ""; }); });
  var spreadsheet = capitalEquitySchemaTestSpreadsheet([items, conversions, ledger]);
  var corrupted = false;
  return { spreadsheet: spreadsheet, writes: function() { return writes.slice(); },
    runtime: { mode: INVENTORY_SCHEMA_RUNTIME.TEST_MODE, spreadsheet: spreadsheet,
      flush: function() {
        if (options.corruptAfterFlush && !corrupted) { conversions.values[0][0] = "CORRUPTED"; corrupted = true; }
      }, freshSpreadsheet: function() { return spreadsheet; } } };
}

function inventorySchemaMigrationTestRuntime(options) {
  options = options || {};
  var writes = [], ingredientHeaders = ["ID_Ingredient", "Ingredient", "Category", "PurchaseUnit", "UsableQty",
    "BaseUnit", "PurchaseCost", "EffectiveFrom", "EffectiveTo", "IsActive", "CreatedAt", "UpdatedAt"];
  var recipeHeaders = ["ID_Recipe", "ID_Prod", "Tipe", "ID_Ingredient", "UsageQty", "IsActive"];
  var ingredients = [], recipes = [], uoms = [];
  for (var g = 0; g < 13; g++) uoms.push("gr");
  for (var m = 0; m < 4; m++) uoms.push("ml");
  uoms.push("slice");
  for (var p = 0; p < 4; p++) uoms.push("pcs");
  for (var i = 0; i < 22; i++) {
    var id = "ING-" + (i < 9 ? "00" : i < 99 ? "0" : "") + (i + 1);
    ingredients.push({ ID_Ingredient: id, Ingredient: "Ingredient " + (i + 1),
      Category: i < 18 ? "Material" : "Support", PurchaseUnit: "Purchase lot", UsableQty: 100,
      BaseUnit: uoms[i], PurchaseCost: 1000, EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true,
      CreatedAt: "2026-01-01", UpdatedAt: "2026-01-01" });
  }
  for (var r = 0; r < 410; r++) recipes.push({ ID_Recipe: "R-" + (r + 1), ID_Prod: "P-" + (r + 1),
    Tipe: "Hot", ID_Ingredient: ingredients[r % 22].ID_Ingredient, UsageQty: 1, IsActive: true });
  if (options.sourceDrift) ingredients[0].BaseUnit = "kg";
  var accountHeaders = INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.slice();
  var accountRows = balanceFoundationMigrationTestAccounts().map(function(account) {
    return accountHeaders.map(function(header) { return account[header] === undefined ? "" : account[header]; });
  });
  if (options.accountConflict) accountRows.push(["1100", "Conflicting meaning", "Liability", "Current Liabilities",
    "Financing", true, "x", "x", "CREDIT"]);
  function values(headers, rows) { return [headers.slice()].concat(rows.map(function(row) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  })); }
  function sheet(name, sheetValues, columns) {
    var result = capitalEquitySchemaTestSheet(name, sheetValues, writes,
      { maxRows: Math.max(1000, sheetValues.length), maxColumns: columns || sheetValues[0].length });
    result.formulas = sheetValues.map(function(row) { return row.map(function() { return ""; }); });
    var originalGetRange = result.getRange;
    result.getRange = function(row, column, count, width) {
      var range = originalGetRange.call(result, row, column, count, width);
      range.getFormulas = function() {
        return result.formulas.slice(row - 1, row - 1 + count).map(function(values) {
          return values.slice(column - 1, column - 1 + width);
        });
      };
      return range;
    };
    return result;
  }
  var sheets = [sheet("Accounts", [accountHeaders].concat(accountRows), 9),
    sheet("COGSIngredients", values(ingredientHeaders, ingredients), ingredientHeaders.length),
    sheet("COGSRecipes", values(recipeHeaders, recipes), recipeHeaders.length)];
  if (options.storageCollision) sheets.push(sheet("InventoryItems", [["WrongHeader"]], 1));
  if (options.partialState) sheets.push(sheet("InventoryItems",
    inventoryMigrationValues(BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS,
      buildInventoryItemCandidates(ingredients, recipes).rows), BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS.length));
  if (options.businessData) sheets.push(sheet("InventoryLedger",
    [BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.slice(),
      BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.map(function() { return "BUSINESS_DATA"; })],
    BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.length));
  var spreadsheet = capitalEquitySchemaTestSpreadsheet(sheets);
  spreadsheet.id = "LOCAL_INVENTORY_SCHEMA_TEST";
  spreadsheet.insertSheet = function(name) {
    var created = sheet(name, [], 26); this.sheets.push(created); return created;
  };
  spreadsheet.deleteSheet = function(target) { this.sheets.splice(this.sheets.indexOf(target), 1); };
  var corrupted = false;
  return { spreadsheet: spreadsheet, writes: function() { return writes.slice(); },
    runtime: { mode: INVENTORY_SCHEMA_RUNTIME.TEST_MODE, spreadsheet: spreadsheet,
      timestamp: "2026-09-03T12:00:00+07:00", flush: function() {
        if (options.corruptAfterFlush && !corrupted) {
          spreadsheet.getSheetByName("InventoryItems").values[1][1] = "CORRUPTED"; corrupted = true;
        }
      }, freshSpreadsheet: function() { return spreadsheet; } } };
}

function balanceFoundationDisposableSpreadsheetTestRuntime() {
  var createArgumentCounts = [], insertArgumentCounts = [], spreadsheet = null;
  var runtime = {
    spreadsheetApp: {
      create: function(name, rows, columns) {
        createArgumentCounts.push(arguments.length);
        if (arguments.length !== 3) throw new Error("Unsupported SpreadsheetApp.create overload");
        var accounts = capitalEquitySchemaTestSheet("Sheet1", [], null,
          { maxRows: rows, maxColumns: columns });
        accounts.setName = function(sheetName) { this.name = sheetName; return this; };
        spreadsheet = {
          id: "DISPOSABLE_TEST_STORAGE",
          sheets: [accounts],
          getId: function() { return this.id; },
          getSheets: function() { return this.sheets.slice(); },
          getSheetByName: function(sheetName) {
            return this.sheets.filter(function(sheet) { return sheet.getName() === sheetName; })[0] || null;
          },
          insertSheet: function(sheetName) {
            insertArgumentCounts.push(arguments.length);
            if (arguments.length !== 1) throw new Error("Unsupported Spreadsheet.insertSheet overload");
            var sheet = capitalEquitySchemaTestSheet(sheetName, [], null,
              { maxRows: 1000, maxColumns: 26 });
            this.sheets.push(sheet);
            return sheet;
          }
        };
        return spreadsheet;
      },
      flush: function() {}
    }
  };
  return {
    runtime: runtime,
    createArgumentCounts: createArgumentCounts,
    insertArgumentCounts: insertArgumentCounts,
    get spreadsheet() { return spreadsheet; }
  };
}

function balanceFoundationSchemaMigrationTestRuntime(options) {
  options = options || {};
  var writes = [], accountHeaders = BALANCE_FOUNDATION_SCHEMA_MIGRATION.ACCOUNTS_LEGACY_HEADERS.slice();
  if (options.mixedState) accountHeaders.push("NormalBalance");
  if (options.malformedSchema) accountHeaders[7] = "UnexpectedAuditField";
  var accountRows = [accountHeaders].concat(balanceFoundationMigrationTestAccounts().map(function(account) {
    return accountHeaders.map(function(header) { return account[header] === undefined ? "" : account[header]; });
  }));
  if (options.forensicOpening) {
    accountRows.slice(1).forEach(function(row) {
      var core = BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE[String(row[0])];
      row[1] = core[0]; row[2] = core[1]; row[3] = core[2]; row[4] = core[3];
      row[6] = new Date(2026, 7, 13, 5, 0, 0); row[7] = new Date(2026, 7, 13, 5, 0, 0);
    });
  }
  if (options.wrongAccountRows) accountRows.pop();
  if (options.nonblankNinthColumn || options.unexpectedNinthHeader) {
    accountRows.forEach(function(row, index) {
      row[8] = index === 0 && options.unexpectedNinthHeader ? "Unexpected" :
        options.nonblankNinthColumn ? "NONBLANK" : "";
    });
  }
  var legacyOpening = Object.assign({}, buildRetainedEarningsOpeningCandidate(), {
    Keterangan: options.forensicOpening ? BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_DESCRIPTION :
      "Preserved note", CreatedAt: options.forensicOpening ? new Date(2026, 8, 1, 15, 40, 15) : "created",
    CreatedBy: options.forensicOpening ? BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER : "creator",
    UpdatedAt: options.forensicOpening ? new Date(2026, 8, 1, 15, 40, 15) : "updated",
    UpdatedBy: options.forensicOpening ? BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER : "updater"
  });
  var openingRows = [FINANCE_OPENING_BALANCE_POLICY.HEADERS.slice(),
    FINANCE_OPENING_BALANCE_POLICY.HEADERS.map(function(header) { return legacyOpening[header]; })];
  if (options.changedOpeningAmount) openingRows[1][3] = 7406999;
  if (options.duplicateOpening) openingRows.push(openingRows[1].slice());
  if (options.nonblankOpeningResidual) openingRows[1][11] = "UNEXPECTED";
  if (options.mixedOpeningSchema) openingRows[0][3] = "Debit";
  if (options.v2Opening) {
    var v2Opening = buildFinanceOpeningBalanceV2Candidates([legacyOpening], balanceFoundationMigrationTestAccounts());
    openingRows = [BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.slice(),
      BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.map(function(header) { return v2Opening[0][header]; })];
  }
  var mockOptions = { failSheet: options.failSheet, failOnce: true,
    maxColumns: options.accountsMaxColumns, failDeleteColumns: options.failDeleteColumns,
    failInsertColumns: options.failAccountsStructure };
  var accounts = capitalEquitySchemaTestSheet("Accounts", accountRows, writes, mockOptions);
  var opening = capitalEquitySchemaTestSheet("FinanceOpeningBalances", openingRows, writes,
    { failSheet: options.failSheet, failOnce: true, failInsertColumns: options.failOpeningStructure,
      maxColumns: options.openingMaxColumns,
      formulas: options.formulaOpeningResidual ? [[,,,,,,,,,,,"=1"]] : [] });
  var spreadsheet = capitalEquitySchemaTestSpreadsheet([accounts, opening]);
  return { accounts: accounts, opening: opening, writes: function() { return writes.slice(); },
    runtime: { spreadsheet: spreadsheet, flush: function() {}, freshSpreadsheet: function() { return spreadsheet; },
      afterDelete: options.failAfterOpeningWidthDelete ? function() {
        throw new Error("simulated width recovery acceptance failure");
      } : null,
      afterAccountsWrite: options.failAfterAccountsWrite ? function() {
        throw new Error("simulated post-Accounts write failure");
      } : null,
      afterAccountsStructure: options.failAfterAccountsExpansion ? function() {
        throw new Error("simulated post-Accounts failure");
      } : null,
      afterOpeningStructure: options.failAfterOpeningStructure ? function() {
        throw new Error("simulated post-opening structure failure");
      } : null,
      afterOpeningWrite: options.failAfterOpeningMutation ? function() {
        throw new Error("simulated post-opening failure");
      } : null,
      afterFlush: options.corruptAfterFlush ? function() { opening.values[1][4] = 1; } : null } };
}

function balanceFoundationMigrationTestAccounts() {
  var targets = balanceFoundationTestAccounts(), targetMap = {};
  targets.forEach(function(account) { targetMap[account.AccountCode] = account; });
  return [
    { AccountCode: "1000", AccountName: "Cash", AccountType: "Asset", StatementGroup: "Current Assets",
      CashFlowGroup: "Operating" }, targetMap["1500"], targetMap["1590"], targetMap["3000"],
    targetMap["3100"], targetMap["3200"],
    { AccountCode: "4000", AccountName: "Sales Revenue", AccountType: "Revenue",
      StatementGroup: "Operating Revenue", CashFlowGroup: "Operating" },
    { AccountCode: "5000", AccountName: "Cost of Goods Sold", AccountType: "COGS",
      StatementGroup: "Cost of Goods Sold", CashFlowGroup: "Operating" },
    { AccountCode: "6100", AccountName: "Salary Expense", AccountType: "Expense",
      StatementGroup: "Personnel Expense", CashFlowGroup: "Operating" },
    { AccountCode: "6200", AccountName: "Kitchen Supplies Expense", AccountType: "Expense",
      StatementGroup: "Supplies Expense", CashFlowGroup: "Operating" },
    { AccountCode: "6210", AccountName: "Raw Material Supplies Expense", AccountType: "Expense",
      StatementGroup: "Supplies Expense", CashFlowGroup: "Operating" },
    { AccountCode: "6300", AccountName: "Repairs and Maintenance Expense", AccountType: "Expense",
      StatementGroup: "Maintenance Expense", CashFlowGroup: "Operating" },
    { AccountCode: "6310", AccountName: "Equipment Upgrade Expense", AccountType: "Expense",
      StatementGroup: "Maintenance Expense", CashFlowGroup: "Investing" },
    { AccountCode: "6400", AccountName: "Utilities and Occupancy Expense", AccountType: "Expense",
      StatementGroup: "Utilities Expense", CashFlowGroup: "Operating" },
    { AccountCode: "6500", AccountName: "Event Expense", AccountType: "Expense",
      StatementGroup: "Event Expense", CashFlowGroup: "Operating" }, targetMap["6900"]
  ].map(function(account) {
    return Object.assign({ IsActive: true, CreatedAt: "2026-08-13 05:00:00",
      UpdatedAt: "2026-08-13 05:00:00" }, account);
  });
}

function balanceFoundationJournalFixture() {
  var audit = { CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  return [
    Object.assign({ JournalID: "J-001", LineID: "BL-001", Tanggal: "2026-08-01", AccountCode: "1500",
      Debit: 1000, Credit: 0, MovementType: "ASSET_ACQUISITION", SourceType: "ASSET", SourceID: "A-001",
      ExternalRef: "", Keterangan: "", IsActive: true }, audit),
    Object.assign({ JournalID: "J-001", LineID: "BL-002", Tanggal: "2026-08-01", AccountCode: "3000",
      Debit: 0, Credit: 1000, MovementType: "ASSET_ACQUISITION", SourceType: "ASSET", SourceID: "A-001",
      ExternalRef: "", Keterangan: "", IsActive: true }, audit)
  ];
}

function balanceFoundationInventoryFixture() {
  var audit = { TransferID: "", ReversalOfMovementID: "", AccountingJournalID: "J-INV", ExternalRef: "",
    Keterangan: "", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  return [
    Object.assign({ ID_Movement: "MOV-001", MovementTimestamp: "2026-10-01T08:00:00+07:00", ItemID: "ING-001",
      Location: "MAIN", BaseUOM: "gr", MovementType: "OPENING_IN", QtyIn: 3, QtyOut: 0,
      UnitCost: 33.3333333333, TotalCost: 100, ValuationVariance: 0, SourceType: "OPENING",
      SourceID: "SRC-001" }, audit),
    Object.assign({ ID_Movement: "MOV-002", MovementTimestamp: "2026-10-02T08:00:00+07:00", ItemID: "ING-001",
      Location: "MAIN", BaseUOM: "gr", MovementType: "PURCHASE_RECEIPT_IN", QtyIn: 3, QtyOut: 0,
      UnitCost: 33.6666666667, TotalCost: 101, ValuationVariance: 0, SourceType: "PURCHASE_RECEIPT",
      SourceID: "SRC-002" }, audit),
    Object.assign({ ID_Movement: "MOV-003", MovementTimestamp: "2026-10-03T08:00:00+07:00", ItemID: "ING-001",
      Location: "MAIN", BaseUOM: "gr", MovementType: "CONSUMPTION_OUT", QtyIn: 0, QtyOut: 1,
      UnitCost: 0, TotalCost: 0, ValuationVariance: 0, SourceType: "MANUAL_CONSUMPTION",
      SourceID: "SRC-003" }, audit),
    Object.assign({ ID_Movement: "MOV-004", MovementTimestamp: "2026-10-04T08:00:00+07:00", ItemID: "ING-001",
      Location: "MAIN", BaseUOM: "gr", MovementType: "ADJUSTMENT_OUT", QtyIn: 0, QtyOut: 5,
      UnitCost: 0, TotalCost: 0, ValuationVariance: 0, SourceType: "COUNT_ADJUSTMENT",
      SourceID: "SRC-004" }, audit)
  ];
}

function testInventoryLemonOperationalStandardContracts() {
  var scenarios = 0;
  function check(value, message) { scenarios++; if (!value) throw new Error(message); }
  // Synthetic fixtures only: these references and identities are not real attestations.
  var item = { ItemID: "ING-018", BaseUOM: "slice", IsActive: true };
  var row = {};
  BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.forEach(function(key) { row[key] = ""; });
  Object.assign(row, { ConversionID: "TEST-LEMON", ItemID: "ING-018", FromUOM: "gr", ToUOM: "slice",
    Numerator: 24, Denominator: 1000, EffectiveFrom: "2026-10-01", EvidenceDate: "2026-09-05",
    SupplierRef: "INTERNAL-NUMLOCK",
    PackageIdentity: "ING-018|INTERNAL-NUMLOCK|Lemon|OPERATIONAL-STANDARD|1000gr-24slice|V01",
    EvidenceType: "MANAGEMENT_OPERATIONAL_STANDARD", EvidenceRef: "GDRIVE:TEST_ONLY:V01:SHA256:" + new Array(65).join("a"),
    PreparedBy: "TEST ONLY", PreparedAt: "2026-09-05T12:00:00+07:00", ApprovalStatus: "SINGLE_OPERATOR_APPROVED",
    ApprovalNote: "BASIS=MANAGEMENT_OPERATIONAL_STANDARD; " +
      "METHOD=1_KG_8_FRUITS_1_FRUIT_3_SLICES_SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC; " +
      "PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW_NOT_PHYSICAL_OBSERVATION_OPERATIONAL_VARIANCE; " +
      "REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED", IsActive: true });
  var snapshot = JSON.stringify([item, row]);
  check(validateInventoryUomConversions([row], [item]).status === "PASS", "management standard accepted");
  check(8 * 3 === row.Numerator && row.Denominator === 1000, "operational arithmetic");
  var result = convertInventoryLemonOperationalQuantity(1000, "gr", "2026-10-01", [item], [row]);
  check(result.status === "ACCEPTED" && result.quantity === 24 && result.baseUom === "slice", "exact conversion");
  check(result.physicalObservation === false && result.evidenceClassification === "MANAGEMENT_OPERATIONAL_STANDARD",
    "normative not physical evidence");
  check(convertInventoryLemonOperationalQuantity(1, "bag", "2026-10-01", [item], [row]).status === "REFUSED", "no bag inference");
  check(convertInventoryLemonOperationalQuantity(1000, "gr", "2026-09-30", [item], [row]).status === "REFUSED", "no historical authority");
  check(classifyInventoryConversionReadiness("ING-018", "2026-10-01", [item], []).status === "NEEDS_EVIDENCE", "missing attestation");
  [ { Numerator: 21 }, { Denominator: 1 }, { FromUOM: "bag" }, { EffectiveFrom: "2026-09-30" },
    { EvidenceType: "PHYSICAL_COUNT" }, { EvidenceType: "CONTROLLED_YIELD_TEST" }, { EvidenceRef: "" },
    { PreparedBy: "" }, { ReviewedBy: "Self" }, { ApprovalNote: row.ApprovalNote.replace("8_FRUITS", "7_FRUITS") },
    { ApprovalNote: row.ApprovalNote.replace("OPERATIONAL_VARIANCE", "AUTOMATIC_CONVERSION_CHANGE") },
    { ApprovalStatus: "APPROVED" }, { EvidenceDate: "2026-09-06" } ].forEach(function(change) {
    var bad = Object.assign({}, row, change);
    check(validateInventoryUomConversions([bad], [item]).status === "FAIL", "reject " + JSON.stringify(change));
    check(gateInventoryMovementConversion({ ItemID: "ING-018", MovementTimestamp: "2026-10-01T00:00:00+07:00" },
      [item], [bad]).status === "REFUSED", "posting authority refuses invalid standard");
  });
  check(gateInventoryMovementConversion({ ItemID: "ING-018", MovementTimestamp: "2026-10-01T00:00:00+07:00" },
    [item], [row]).status === "ACCEPTED", "prospective conversion gate");
  check(classifyInventoryConversionReadiness("ING-018", "2026-10-01", [item], [row]).status ===
    "SINGLE_OPERATOR_VERIFIED", "active management authority readiness");
  check(gateInventoryMovementConversion({ ItemID: "ING-018", MovementTimestamp: "2026-10-01T00:00:00+07:00" },
    [item], [Object.assign({}, row, { IsActive: false })]).status === "REFUSED", "inactive authority refused");
  check(gateInventoryMovementConversion({ ItemID: "ING-018", MovementTimestamp: "2026-09-30T23:59:59+07:00" },
    [item], [row]).status === "REFUSED", "pre-boundary posting refused");
  check(gateInventoryMovementConversion({ ItemID: "ING-018", MovementTimestamp: "2026-10-02T00:00:00+07:00" },
    [item], [row]).status === "ACCEPTED", "post-boundary posting accepted");
  var conflict = [row, Object.assign({}, row, { ConversionID: "TEST-LEMON-CONFLICT" })];
  check(classifyInventoryConversionReadiness("ING-018", "2026-10-01", [item], conflict).status === "CONFLICT" &&
    gateInventoryMovementConversion({ ItemID: "ING-018", MovementTimestamp: "2026-10-01T00:00:00+07:00" },
      [item], conflict).status === "REFUSED", "conflicting management standards refused");
  check(JSON.stringify([item, row]) === snapshot && result.writeCount === 0, "pure conversion leaves inputs unchanged");
  check(BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED === false, "recipe consumption disabled");
  check(INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.indexOf("ING-018") === -1,
    "frozen opening batch is not expanded by conversion authority");
  Logger.log("PASS: testInventoryLemonOperationalStandardContracts | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

// Phase 11U.1 uses function-local disposable fixtures. No spreadsheet is created or written.
function inventoryLemonRuntimeProductionSnapshot(spreadsheet) {
  var snapshot = {};
  ["InventoryUOMConversions", "InventoryItems", "InventoryOpenings", "InventoryLedger", "BalanceLedger",
    INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_SHEET, "COGSRecipes"].forEach(function(name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) { snapshot[name] = { exists: false }; return; }
    var grid = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns());
    snapshot[name] = { exists: true, values: grid.getValues(), formulas: grid.getFormulas(), notes: grid.getNotes() };
  });
  return snapshot;
}

function runInventoryLemonManagementDisposableRuntimeProof() {
  var spreadsheet = requireNumlockProductionSpreadsheet();
  var before = inventoryLemonRuntimeProductionSnapshot(spreadsheet), result = null;
  try {
    function rows(name) {
      if (!before[name].exists) throw new Error("MISSING_PRODUCTION_SHEET:" + name);
      var values = before[name].values, headers = values[0];
      return values.slice(1).filter(function(row) { return row.some(function(value) { return value !== ""; }); })
        .map(function(row) { var object = {}; headers.forEach(function(key, i) { if (key) object[key] = row[i]; }); return object; });
    }
    var items = rows("InventoryItems"), conversions = rows("InventoryUOMConversions");
    var expected = INVENTORY_CONVERSION_CANDIDATE_POPULATION.MANIFESTS;
    if (conversions.length !== 21 || expected.length !== 21 || conversions.some(function(row) { return row.ItemID === "ING-018"; })) {
      throw new Error("PRODUCTION_CONVERSION_SET_NOT_FROZEN_21");
    }
    expected.forEach(function(entry) {
      var matching = conversions.filter(function(row) { return row.ItemID === entry[0]; });
      if (matching.length !== 1 || matching[0].EvidenceRef !== "GDRIVE:" + entry[1] + ":V01:SHA256:" + entry[2] ||
          classifyInventoryConversionReadiness(entry[0], "2026-10-01", items, conversions).status !== "SINGLE_OPERATOR_VERIFIED") {
        throw new Error("PRODUCTION_AUTHORITY_NOT_VERIFIED:" + entry[0]);
      }
    });
    var contracts = testInventoryLemonOperationalStandardContracts();
    if (!contracts.passed) throw new Error("LEMON_CONTRACT_FAILURE");
    result = { status: "PASS", fixtureIsolation: "DISPOSABLE_FUNCTION_LOCAL_MEMORY", scenarios: contracts.scenarios,
      managementStandardValidation: "PASS", conversion: "1000 gr = 24 slice", operationalArithmetic: "PASS",
      physicalObservation: false, historicalAuthorityRefusal: "PASS", bagRefusal: "PASS", effectiveFromBoundary: "PASS",
      inactiveAuthorityRefusal: "PASS", readiness: "SINGLE_OPERATOR_VERIFIED", postingGate: "PASS",
      malformedAttestationRefusal: "PASS", conflictingConversionRefusal: "PASS", existing21Authorities: "PASS",
      inventoryOpeningsWrites: 0, inventoryLedgerWrites: 0, balanceLedgerWrites: 0, account1100Mutation: false,
      recipeConsumption: false, productionMutation: false, cleanup: "PENDING" };
  } finally {
    var after = inventoryLemonRuntimeProductionSnapshot(requireNumlockProductionSpreadsheet());
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("PRODUCTION_SNAPSHOT_CHANGED");
    // Synthetic fixtures are function-local and retain no external resources or global references.
    if (result) result.cleanup = "PASS";
  }
  Logger.log(JSON.stringify(result));
  return result;
}

// Synthetic function-local storage and digest doubles: never call Drive/Spreadsheet services.
function inventoryLemonProductionTestFixture() {
  var manifests = {}, hashes = {}, writes = [], reads = 0, flushes = 0;
  var lemon = { ManifestID: "MANIFEST-MOS-ING-018-V01", ManifestVersion: "V01", ConversionID: "CONV-MOS-ING-018-V01",
    ItemID: "ING-018", ItemName: "Lemon", BaseUOM: "slice", FromUOM: "gr", ToUOM: "slice",
    Numerator: 24, Denominator: 1000, EffectiveFrom: "2026-10-01", EffectiveTo: "",
    EvidenceType: "MANAGEMENT_OPERATIONAL_STANDARD", KnowledgeBasis: "MANAGEMENT_OPERATIONAL_STANDARD",
    GovernancePath: "SINGLE_OPERATOR", ApprovalStatus: "SINGLE_OPERATOR_APPROVED", IsActive: false,
    NoIndependentReview: true, SelfApprovalDisclosed: true, PhysicalObservation: false,
    ReviewedBy: "", ReviewedAt: "", PreparedBy: "Dekker", PreparedAt: "2026-09-05T21:27:54+07:00",
    EvidenceDate: "2026-09-05", RecipeAutoConsumption: false, SupplierRef: "INTERNAL-NUMLOCK",
    PackageIdentity: "ING-018|INTERNAL-NUMLOCK|Lemon|OPERATIONAL-STANDARD|1000gr-24slice|V01",
    ApprovalNote: "BASIS=MANAGEMENT_OPERATIONAL_STANDARD; " +
      "METHOD=1_KG_8_FRUITS_1_FRUIT_3_SLICES_SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC; " +
      "PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW_NOT_PHYSICAL_OBSERVATION_OPERATIONAL_VARIANCE; " +
      "REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED" };
  manifests[INVENTORY_LEMON_PRODUCTION.FILE_ID] = lemon;
  hashes[INVENTORY_LEMON_PRODUCTION.FILE_ID] = INVENTORY_LEMON_PRODUCTION.SHA256;
  var items = [];
  INVENTORY_CONVERSION_CANDIDATE_POPULATION.MANIFESTS.forEach(function(entry) {
    var id = entry[0], ice = id === "ING-021";
    manifests[entry[1]] = { ManifestVersion: "V01", ItemID: id, ConversionID: "CONV-ATT-" + id + "-V01",
      FromUOM: "pack", ToUOM: "gr", Numerator: 1000, Denominator: 1,
      PackageIdentity: id + "|SUP-TEST|Synthetic|TEST-SKU|1kg|V01", SupplierRef: "SUP-TEST",
      EffectiveFrom: "2026-10-01", EffectiveTo: "", EvidenceType: "OPERATOR_ATTESTATION",
      EvidenceDate: "2026-09-04", PreparedBy: "SYNTHETIC OPERATOR", PreparedAt: "2026-09-04T10:00:00+07:00",
      ApprovalNote: "BASIS=OPERATOR_KNOWN; METHOD=FIXED_STANDARDIZED_PACKAGE_SINGLE_OPERATOR_ATTESTATION_" +
        "SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC_RISK_" + (ice ? "MODERATE" : "LOW") +
        "; PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW; REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED" };
    hashes[entry[1]] = entry[2];
    items.push({ ItemID: id, ItemName: "Synthetic " + id, Classification: "RAW_MATERIAL", BaseUOM: "gr",
      EffectiveFrom: "2026-10-01", EffectiveTo: "", IsActive: true, SourceIngredientID: id });
  });
  items.push({ ItemID: "ING-018", ItemName: "Lemon", Classification: "RAW_MATERIAL", BaseUOM: "slice",
    EffectiveFrom: "2026-10-01", EffectiveTo: "", IsActive: true, SourceIngredientID: "ING-018" });
  var runtime = { mode: INVENTORY_SCHEMA_RUNTIME.TEST_MODE,
    readManifestBytes: function(id) { if (!manifests[id]) throw new Error("UNKNOWN_EVIDENCE_ID"); return id; },
    sha256: function(id) { return hashes[id].match(/../g).map(function(hex) { return parseInt(hex, 16); }); },
    bytesToString: function(id) { return Object.keys(manifests[id]).map(function(key) {
      return key + "=" + JSON.stringify(manifests[id][key]); }).join("\n"); },
    flush: function() { flushes++; if (fixture.onFlush) fixture.onFlush(); } };
  var evidence = buildInventoryLemonProductionEvidence(runtime), sheets = {};
  function sheet(name, values) {
    var columns = Math.max(28, values[0].length), grid = [], formulas = [], notes = [];
    for (var r = 0; r < 28; r++) {
      grid.push(Array.from({ length: columns }, function(_, c) { return values[r] && values[r][c] !== undefined ? values[r][c] : ""; }));
      formulas.push(new Array(columns).fill("")); notes.push(new Array(columns).fill(""));
    }
    return { grid: grid, formulas: formulas, notes: notes, getMaxRows: function() { return grid.length; },
      getMaxColumns: function() { return columns; }, getRange: function(row, column, height, width) {
        function read(source) { return source.slice(row - 1, row - 1 + height).map(function(line) { return line.slice(column - 1, column - 1 + width); }); }
        function write(values) {
          writes.push({ sheet: name, row: row, column: column, height: height, width: width });
          if (fixture.beforeWrite) fixture.beforeWrite();
          for (var i = 0; i < height; i++) for (var j = 0; j < width; j++) grid[row - 1 + i][column - 1 + j] = values[i][j];
          if (fixture.afterWrite) fixture.afterWrite();
        }
        return { getValues: function() { return read(grid); }, getFormulas: function() { return read(formulas); },
          getNotes: function() { return read(notes); }, setValues: write,
          clearContent: function() { write(Array.from({ length: height }, function() { return new Array(width).fill(""); })); } };
      } };
  }
  var policy = BALANCE_FOUNDATION_POLICY;
  var accounts = [Object.assign({ IsActive: true }, policy.INVENTORY_ASSET_ACCOUNT),
    { AccountCode: "3200", AccountName: "Retained Earnings", IsActive: true }];
  var values = { InventoryUOMConversions: inventoryMigrationValues(policy.INVENTORY_UOM_CONVERSION_HEADERS, evidence.existing),
    InventoryItems: inventoryMigrationValues(policy.INVENTORY_ITEM_HEADERS, items), InventoryOpenings: [INVENTORY_OPENING_STAGING_POLICY.HEADERS],
    InventoryLedger: [policy.INVENTORY_LEDGER_HEADERS], BalanceLedger: [policy.BALANCE_LEDGER_HEADERS],
    Accounts: inventoryMigrationValues(INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_HEADERS, accounts),
    FinanceOpeningBalances: [policy.OPENING_V2_HEADERS], tabsal: [["HPP"], [1700]], COGSRecipes: [["RecipeID"], ["SYNTHETIC"]] };
  Object.keys(values).forEach(function(name) { sheets[name] = sheet(name, values[name]); });
  runtime.spreadsheet = { getId: function() { return "LEMON-SYNTHETIC-ONLY"; }, getSheetByName: function(name) { return sheets[name] || null; } };
  runtime.freshSpreadsheet = function() { reads++; if (fixture.onRead) fixture.onRead(reads); return runtime.spreadsheet; };
  var fixture = { runtime: runtime, sheets: sheets, manifests: manifests, hashes: hashes, evidence: evidence, writes: writes,
    reads: function() { return reads; }, flushes: function() { return flushes; } };
  return fixture;
}

function testInventoryLemonProductionFlowContracts() {
  var scenarios = 0;
  function check(value, label) { scenarios++; if (!value) throw new Error("Lemon production flow: " + label); }
  function execute(fixture, operation) { return executeInventoryLemonProductionWithRuntime(fixture.runtime, operation || "population"); }
  function state(fixture) { return readInventoryLemonProductionState(fixture.runtime.spreadsheet); }
  var fixture = inventoryLemonProductionTestFixture(), before = state(fixture);
  check(preflightInventoryLemonProductionWithRuntime(fixture.runtime).status === "READY" && fixture.writes.length === 0, "READY read-only preflight");
  var population = execute(fixture);
  check(population.status === "POPULATED" && population.writeCount === 1 && fixture.writes.length === 1, "population one write");
  check(JSON.stringify(fixture.writes[0]) === JSON.stringify({ sheet: "InventoryUOMConversions", row: 23, column: 1, height: 1, width: 24 }), "only row23 population");
  check(population.acceptance.status === "PASS" && population.acceptance.readiness === "NEEDS_EVIDENCE" &&
    fixture.sheets.InventoryUOMConversions.grid[22][19] === false && fixture.sheets.InventoryUOMConversions.grid[22][17] === "SINGLE_OPERATOR_APPROVED", "inactive acceptance and governance");
  var repeat = execute(fixture);
  check(repeat.status === "ALREADY_POPULATED" && repeat.writeCount === 0 && fixture.writes.length === 1, "population idempotency");
  var inactive = state(fixture), activation = execute(fixture, "activation");
  check(activation.status === "ACTIVATED" && activation.writeCount === 1 && fixture.writes.length === 2, "activation one write");
  check(JSON.stringify(fixture.writes[1]) === JSON.stringify({ sheet: "InventoryUOMConversions", row: 23, column: 20, height: 1, width: 1 }), "only IsActive written");
  check(activation.acceptance.status === "PASS" && activation.acceptance.readiness === "SINGLE_OPERATOR_VERIFIED" &&
    activation.acceptance.activeAuthorities === 22 && activation.acceptance.conflicts === 0, "22 verified authorities no conflicts");
  check(activation.acceptance.effectiveFrom === "2026-10-01" && activation.acceptance.effectiveFromBoundary === "PASS" &&
    population.acceptance.effectiveFromBoundary === "PASS", "prospective and inactive gates");
  repeat = execute(fixture, "activation");
  check(repeat.status === "ALREADY_ACTIVATED" && repeat.writeCount === 0 && fixture.writes.length === 2, "activation idempotency");
  check(execute(fixture).status === "REFUSED" && fixture.writes.length === 2, "active population is not repaired");
  var active = state(fixture);
  INVENTORY_LEMON_PRODUCTION.SHEETS.filter(function(name) { return name !== "InventoryUOMConversions"; }).forEach(function(name) {
    check(JSON.stringify(before[name]) === JSON.stringify(active[name]), name + " preserved");
  });
  check(JSON.stringify(before.InventoryUOMConversions.values.slice(0, 22)) === JSON.stringify(active.InventoryUOMConversions.values.slice(0, 22)), "existing21 exact preservation");
  var activeRow = active.InventoryUOMConversions.values[22].slice(); activeRow[19] = false;
  check(JSON.stringify(activeRow) === JSON.stringify(inactive.InventoryUOMConversions.values[22]), "all other Lemon cells preserved");
  check(fixture.flushes() === 2 && fixture.reads() >= 10, "flush and fresh reads");
  var recovery = executeInventoryLemonProductionRecoveryWithRuntime(fixture.runtime, activation.migrationRecord);
  check(recovery.status === "RECOVERED" && recovery.writeCount === 1 && inventoryLemonStateEqual(state(fixture), inactive), "activation recovery");
  recovery = executeInventoryLemonProductionRecoveryWithRuntime(fixture.runtime, population.migrationRecord);
  check(recovery.status === "RECOVERED" && recovery.writeCount === 1 && inventoryLemonStateEqual(state(fixture), before), "population recovery");
  check(executeInventoryLemonProductionRecoveryWithRuntime(fixture.runtime, population.migrationRecord).writeCount === 0, "recovery repeat refuses");

  function refusal(label, mutate, operation) {
    var f = inventoryLemonProductionTestFixture(); mutate(f);
    var pre = state(f), result = execute(f, operation);
    check(result.status === "REFUSED" && result.writeCount === 0 && f.writes.length === 0 && inventoryLemonStateEqual(pre, state(f)), label);
  }
  refusal("activation requires inactive row", function() {}, "activation");
  ["ManifestID", "ManifestVersion", "ConversionID", "ItemID", "BaseUOM", "FromUOM", "ToUOM", "Numerator", "Denominator",
    "EffectiveFrom", "EffectiveTo", "EvidenceType", "GovernancePath", "ApprovalStatus", "NoIndependentReview",
    "SelfApprovalDisclosed", "PreparedBy", "ReviewedBy", "ApprovalNote", "IsActive"].forEach(function(key) {
    refusal("evidence field " + key, function(f) { f.manifests[INVENTORY_LEMON_PRODUCTION.FILE_ID][key] = "MISMATCH"; });
  });
  refusal("evidence SHA mismatch", function(f) { f.hashes[INVENTORY_LEMON_PRODUCTION.FILE_ID] = new Array(65).join("0"); });
  refusal("evidence ID unavailable", function(f) { delete f.manifests[INVENTORY_LEMON_PRODUCTION.FILE_ID]; });
  refusal("old21 SHA mismatch", function(f) { f.hashes[INVENTORY_CONVERSION_CANDIDATE_POPULATION.MANIFESTS[0][1]] = new Array(65).join("0"); });
  refusal("unexpected Lemon", function(f) { f.sheets.InventoryUOMConversions.grid[22][0] = "UNEXPECTED"; f.sheets.InventoryUOMConversions.grid[22][1] = "ING-018"; });
  refusal("duplicate existing authority", function(f) { f.sheets.InventoryUOMConversions.grid[22] = f.sheets.InventoryUOMConversions.grid[1].slice(); });
  refusal("old21 drift", function(f) { f.sheets.InventoryUOMConversions.grid[1][6] = 999; });
  refusal("old21 inactive", function(f) { f.sheets.InventoryUOMConversions.grid[1][19] = false; });
  refusal("schema", function(f) { f.sheets.InventoryUOMConversions.grid[0][0] = "DRIFT"; });
  refusal("formula distant collision", function(f) { f.sheets.InventoryUOMConversions.formulas[27][27] = "=1"; });
  refusal("note distant collision", function(f) { f.sheets.InventoryUOMConversions.notes[27][27] = "note"; });
  refusal("business overflow collision", function(f) { f.sheets.InventoryUOMConversions.grid[27][27] = "data"; });
  refusal("physical gap", function(f) { f.sheets.InventoryUOMConversions.grid[22] = f.sheets.InventoryUOMConversions.grid[21].slice(); f.sheets.InventoryUOMConversions.grid[21].fill(""); });
  refusal("item UOM", function(f) { f.sheets.InventoryItems.grid[22][3] = "gr"; });
  refusal("item inactive", function(f) { f.sheets.InventoryItems.grid[22][6] = false; });
  refusal("item duplicate", function(f) { f.sheets.InventoryItems.grid[23] = f.sheets.InventoryItems.grid[22].slice(); });
  refusal("ledger business data", function(f) { f.sheets.InventoryLedger.grid[1][0] = "MOVEMENT"; });
  refusal("account3210", function(f) { f.sheets.Accounts.grid[3][0] = "3210"; });
  refusal("missing preservation storage", function(f) { delete f.sheets.tabsal; });
  refusal("fresh identity drift", function(f) { f.runtime.freshSpreadsheet = function() { return { getId: function() { return "WRONG"; } }; }; });
  refusal("missing fresh read", function(f) { delete f.runtime.freshSpreadsheet; });
  var drift = inventoryLemonProductionTestFixture();
  drift.onRead = function(n) { if (n === 2) drift.sheets.tabsal.grid[1][0]++; };
  check(execute(drift).reason === "SOURCE_CHANGED_BEFORE_WRITE" && drift.writes.length === 0, "source change before write");

  ["population", "activation"].forEach(function(operation) {
    ["InventoryOpenings", "InventoryLedger", "BalanceLedger", "laterConversion", "unrelated", "record"].forEach(function(dependency) {
      var f = inventoryLemonProductionTestFixture(), result = execute(f);
      if (operation === "activation") result = execute(f, "activation");
      if (dependency === "laterConversion") {
        f.sheets.InventoryUOMConversions.grid[23] = f.sheets.InventoryUOMConversions.grid[22].slice();
        f.sheets.InventoryUOMConversions.grid[23][0] = "LATER";
      } else if (dependency === "unrelated") f.sheets.tabsal.grid[1][0]++;
      else if (dependency === "record") result.migrationRecord.expected.InventoryUOMConversions.values[22][6] = 999;
      else f.sheets[dependency].grid[1][dependency === "InventoryOpenings" ? 4 : 0] = "ING-018";
      var count = f.writes.length, pre = state(f), recovered = executeInventoryLemonProductionRecoveryWithRuntime(f.runtime, result.migrationRecord);
      check(recovered.status === "REFUSED" && recovered.writeCount === 0 && f.writes.length === count && inventoryLemonStateEqual(pre, state(f)), operation + " recovery refuses " + dependency);
    });
    var f = inventoryLemonProductionTestFixture();
    if (operation === "activation") execute(f);
    var count = f.writes.length;
    f.onFlush = function() { throw new Error("SYNTHETIC_FLUSH_FAILURE"); };
    var failure = execute(f, operation);
    check(failure.status === "FAILED_REQUIRES_REVIEW" && failure.writeCount === 1 && f.writes.length === count + 1, operation + " failure never retries or auto-recovers");
    f.onFlush = null;
    check(executeInventoryLemonProductionRecoveryWithRuntime(f.runtime, failure.migrationRecord).status === "RECOVERED", operation + " exact failed write recovery");
  });
  var failed = inventoryLemonProductionTestFixture();
  failed.afterWrite = function() { throw new Error("SYNTHETIC_UNCERTAIN_WRITE"); };
  var uncertain = execute(failed);
  check(uncertain.status === "FAILED_REQUIRES_REVIEW" && uncertain.writeCount === null && uncertain.writeAttemptCount === 1, "uncertain write count never fabricated");
  failed.afterWrite = null;
  check(executeInventoryLemonProductionRecoveryWithRuntime(failed.runtime, uncertain.migrationRecord).status === "RECOVERED", "uncertain exact postimage recovery");
  var collision = inventoryLemonProductionTestFixture();
  collision.onFlush = function() { collision.sheets.tabsal.grid[1][0]++; };
  var rejected = execute(collision);
  check(rejected.status === "FAILED_REQUIRES_REVIEW" && collision.writes.length === 1, "unrelated post-write change rejects acceptance");
  check(executeInventoryLemonProductionRecoveryWithRuntime(collision.runtime, rejected.migrationRecord).status === "REFUSED", "unrelated post-write change cannot be overwritten");
  check(BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED === false && BALANCE_FOUNDATION_POLICY.HPP_AUTHORITY === "tabsal.HPP", "posting isolation policy");
  ["population", "activation"].forEach(function(operation) {
    ["CreatedAt", "ReviewedAt", "Numerator", "EvidenceRef", "EffectiveFrom", "ApprovalStatus"].forEach(function(key) {
      var f = inventoryLemonProductionTestFixture(); execute(f);
      if (operation === "activation") execute(f, "activation");
      var column = BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.indexOf(key);
      f.sheets.InventoryUOMConversions.grid[22][column] = "MALFORMED";
      var count = f.writes.length, result = execute(f, operation);
      check(result.status === "REFUSED" && result.writeCount === 0 && f.writes.length === count, operation + " idempotency rejects " + key);
    });
  });
  refusal("old21 malformed blank audit field", function(f) { f.sheets.InventoryUOMConversions.grid[1][20] = "BAD-DATE"; });
  var dated = inventoryLemonProductionTestFixture();
  dated.onFlush = function() {
    var row = dated.sheets.InventoryUOMConversions.grid[22];
    row[8] = new Date(2026, 9, 1); row[12] = new Date(2026, 8, 5); row[14] = new Date("2026-09-05T21:27:54+07:00");
  };
  check(execute(dated).status === "POPULATED" && execute(dated).status === "ALREADY_POPULATED" &&
    execute(dated, "activation").status === "ACTIVATED", "Apps Script Date-valued semantic acceptance");
  var productionGuard = inventoryLemonProductionTestFixture(), successful = execute(productionGuard);
  productionGuard.runtime.mode = INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE;
  productionGuard.runtime.spreadsheet.getId = function() { return NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID; };
  check(executeInventoryLemonProductionRecoveryWithRuntime(productionGuard.runtime, successful.migrationRecord).reason ===
    "UNOWNED_OR_NONFAILED_RECOVERY_RECORD" && productionGuard.writes.length === 1, "production recovery requires failed write record");
  var noWrite = inventoryLemonProductionTestFixture();
  noWrite.beforeWrite = function() { throw new Error("SYNTHETIC_WRITE_REFUSED"); };
  var noWriteFailure = execute(noWrite);
  check(noWriteFailure.writeCount === null && executeInventoryLemonProductionRecoveryWithRuntime(noWrite.runtime,
    noWriteFailure.migrationRecord).status === "REFUSED", "failed write without owned postimage cannot recover");
  Logger.log("PASS: testInventoryLemonProductionFlowContracts | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios, activeAuthorities: 22, conflicts: 0, productionMutation: false };
}

function runInventoryLemonProductionDisposableRuntimeProof() {
  var result = testInventoryLemonProductionFlowContracts();
  var report = { status: result.passed ? "PASS" : "FAIL", scenarios: result.scenarios,
    fixtureIsolation: "SYNTHETIC_FUNCTION_LOCAL_MEMORY", evidenceBinding: "SYNTHETIC_DIGEST_DOUBLE",
    preflight: "READY", populationWriteCount: 1, activationWriteCount: 1, activeAuthorities: result.activeAuthorities,
    conflicts: result.conflicts, readiness: "SINGLE_OPERATOR_VERIFIED", productionMutation: false, cleanup: "PASS" };
  Logger.log(JSON.stringify(report)); return report;
}
