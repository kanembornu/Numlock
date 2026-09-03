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

  var inventory = balanceFoundationInventoryFixture();
  var inventoryValidation = validateInventoryLedgerCandidates(inventory);
  check(inventoryValidation.status === "PASS" && inventoryValidation.activeRows.length === 4,
    "inventory movement validation");
  var movingAverage = buildMovingWeightedAverageCandidates(inventory);
  check(movingAverage.readOnly && movingAverage.writeCount === 0 && movingAverage.candidateOnly,
    "read-only inventory candidate builder");
  check(movingAverage.calculations[1].movingWeightedAverage === 150 &&
    movingAverage.calculations[2].outboundCandidateCost === 600,
    "deterministic moving weighted average candidate");
  check(movingAverage.calculations[3].inventoryValue === 950 &&
    movingAverage.calculations[3].movingWeightedAverage === 59.375,
    "explicit valuation variance support");
  check(movingAverage.hppAuthority === "tabsal.HPP", "tabsal HPP authority unchanged");
  check(hasError(validateInventoryLedgerCandidates(inventory.concat([
    Object.assign({}, inventory[0], { ID_Movement: "MOV-005", SourceID: "SRC-005", QtyOut: 1 })
  ])), "INVALID_ONE_SIDED_QUANTITY"), "two-sided inventory quantity rejected");
  check(hasError(validateInventoryLedgerCandidates(inventory.concat([
    Object.assign({}, inventory[0], { ID_Movement: "MOV-005", SourceID: "SRC-005", UnitCost: -1 })
  ])), "INVALID_COST"), "negative inventory cost rejected");
  check(hasError(validateInventoryLedgerCandidates(inventory.concat([
    Object.assign({}, inventory[0], { ID_Movement: "MOV-005", SourceID: "SRC-005", TotalCost: 999 })
  ])), "INBOUND_COST_MISMATCH"), "inbound inventory cost mismatch rejected");
  check(hasError(validateInventoryLedgerCandidates(inventory.concat([
    Object.assign({}, inventory[0], { ID_Movement: "MOV-005", SourceID: "SRC-005", MovementType: "UNKNOWN" })
  ])), "INVALID_MOVEMENT_TYPE"), "unsupported movement rejected");
  check(hasError(validateInventoryLedgerCandidates(inventory.concat([
    Object.assign({}, inventory[0], { ID_Movement: "MOV-005" })
  ])), "DUPLICATE_OR_MISSING_SOURCE_EVENT"), "inventory source-event idempotency");
  check(validateInventoryLedgerCandidates(inventory.concat([
    Object.assign({}, inventory[0], { ID_Movement: "MOV-INACTIVE", SourceID: "SRC-INACTIVE", IsActive: false })
  ])).excludedInactiveRows === 1, "inactive inventory movement excluded");
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
  var audit = { CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  return [
    Object.assign({ ID_Movement: "MOV-001", Tanggal: "2026-08-01", ItemID: "ITEM-1", Location: "MAIN",
      MovementType: "PURCHASE_IN", QtyIn: 10, QtyOut: 0, UnitCost: 100, TotalCost: 1000,
      SourceType: "PURCHASE", SourceID: "SRC-001", IsActive: true }, audit),
    Object.assign({ ID_Movement: "MOV-002", Tanggal: "2026-08-02", ItemID: "ITEM-1", Location: "MAIN",
      MovementType: "PURCHASE_IN", QtyIn: 10, QtyOut: 0, UnitCost: 200, TotalCost: 2000,
      SourceType: "PURCHASE", SourceID: "SRC-002", IsActive: true }, audit),
    Object.assign({ ID_Movement: "MOV-003", Tanggal: "2026-08-03", ItemID: "ITEM-1", Location: "MAIN",
      MovementType: "SALE_OUT", QtyIn: 0, QtyOut: 4, UnitCost: 0, TotalCost: 0,
      SourceType: "SALE", SourceID: "SRC-003", IsActive: true }, audit),
    Object.assign({ ID_Movement: "MOV-004", Tanggal: "2026-08-04", ItemID: "ITEM-1", Location: "MAIN",
      MovementType: "VALUATION_VARIANCE", QtyIn: 0, QtyOut: 0, UnitCost: 0, TotalCost: 0,
      ValuationVariance: -1450, SourceType: "VALUATION", SourceID: "SRC-004", IsActive: true }, audit)
  ];
}
