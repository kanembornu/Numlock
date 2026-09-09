function inventoryOpeningStagingTestItems() {
  return INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.concat(["ING-018"]).map(function(id) {
    return { ItemID: id, ItemName: "Item " + id, Classification: "RAW_MATERIAL",
      BaseUOM: id === "ING-018" ? "slice" : "gr", EffectiveFrom: "2026-01-01", EffectiveTo: "",
      IsActive: true, SourceIngredientID: id, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  });
}

function inventoryOpeningStagingTestConversions(items) {
  return INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.map(function(id) {
    return { ConversionID: "CONV-" + id, ItemID: id, FromUOM: "bag",
      PackageIdentity: id + "|SUP-TEST|Brand|SKU|1kg|V01", SupplierRef: "SUP-TEST", ToUOM: "gr",
      Numerator: 1000, Denominator: 1, EffectiveFrom: "2026-10-01", EffectiveTo: "",
      EvidenceType: "OPERATOR_ATTESTATION",
      EvidenceRef: "GDRIVE:test" + id.replace("-", "") + ":V01:SHA256:" + new Array(65).join("a"),
      EvidenceDate: "2026-09-04", PreparedBy: "Operator", PreparedAt: "2026-09-04T10:00:00+07:00",
      ReviewedBy: "", ReviewedAt: "", ApprovalStatus: "SINGLE_OPERATOR_APPROVED",
      ApprovalNote: "BASIS=OPERATOR_KNOWN; METHOD=FIXED_STANDARDIZED_PACKAGE_SINGLE_OPERATOR_ATTESTATION_" +
        "SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC_RISK_" + (id === "ING-021" ? "MODERATE" : "LOW") +
        "; PLAUSIBILITY=CONFIRMED; " +
        "LIMITATIONS=NO_INDEPENDENT_REVIEW; REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED",
      IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  });
}

function inventoryOpeningStagingTestRow(itemId, index) {
  return { OpeningID: "OPEN-" + itemId + "-V01", SupersedesOpeningID: "", OpeningBatchID: "OPEN-BATCH-20260930",
    CutoverDate: "2026-09-30", ItemID: itemId, Location: "MAIN", BaseUOM: "gr", ObservedQty: "2.500000",
    ObservationTimestamp: "2026-09-30T23:00:00+07:00", QuantityEvidenceRef: "COUNT:" + itemId + ":V01",
    UnitCost: "40.4", TotalValue: 101, ValuationBasis: "SUPPORTED_ACQUISITION_COST",
    ValuationEvidenceRef: "VALUATION:" + itemId + ":V01", AcquisitionEvidenceRef: "ACQUISITION:" + itemId + ":V01",
    AccountingSourceRef: "EXPENSE:2026-09:" + itemId, EconomicOrigin: "CURRENT_PERIOD_EXPENSED",
    PreparedBy: "Preparer", PreparedAt: "2026-09-30T23:10:00+07:00", ReviewedBy: "Reviewer",
    ReviewedAt: "2026-10-01T09:00:00+07:00", ApprovalStatus: "READY_FOR_ACCOUNTING_REVIEW", IsActive: true,
    CreatedAt: "2026-10-01T09:01:00+07:00", CreatedBy: "Preparer", UpdatedAt: "2026-10-01T09:01:00+07:00",
    UpdatedBy: "Preparer", Sequence: index };
}

function inventoryOpeningStagingHasError(report, code) {
  return report.errors.some(function(error) { return error.errors.indexOf(code) !== -1; });
}

function inventoryOpeningStagingMigrationTestRuntime(options) {
  options = options || {};
  var writes = [], items = inventoryOpeningStagingTestItems(), conversions = inventoryOpeningStagingTestConversions(items);
  var accountHeaders = INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.slice();
  var accounts = balanceFoundationMigrationTestAccounts();
  accounts.push(Object.assign({ IsActive: true, CreatedAt: "", UpdatedAt: "" }, BALANCE_FOUNDATION_POLICY.INVENTORY_ASSET_ACCOUNT));
  if (options.account3210Active || options.account3210Inactive) accounts.push({ AccountCode: "3210",
    AccountName: "Unauthorized proposal", AccountType: "Equity", StatementGroup: "Owner Equity",
    CashFlowGroup: "Financing", IsActive: !!options.account3210Active, CreatedAt: "", UpdatedAt: "",
    NormalBalance: "CREDIT" });
  if (options.unrelatedAccount) accounts.push({ AccountCode: "9999", AccountName: "Unrelated",
    AccountType: "Expense", StatementGroup: "Operating Expenses", CashFlowGroup: "Operating",
    IsActive: true, CreatedAt: "", UpdatedAt: "", NormalBalance: "DEBIT" });
  function values(headers, rows) { return [headers.slice()].concat(rows.map(function(row) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  })); }
  function sheet(name, rows, headers) {
    var target = capitalEquitySchemaTestSheet(name, rows, writes,
      { maxRows: 1000, maxColumns: Math.max(26, headers ? headers.length : rows[0].length) });
    var getRange = target.getRange;
    target.getRange = function(row, column, rowCount, columnCount) {
      var range = getRange.call(target, row, column, rowCount, columnCount);
      range.getNotes = function() {
        var result = [];
        for (var r = 0; r < rowCount; r++) result.push(new Array(columnCount).fill(""));
        return result;
      };
      return range;
    };
    return target;
  }
  var sheets = [sheet("InventoryItems", values(BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS, items)),
    sheet("InventoryUOMConversions", values(BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS, conversions)),
    sheet("InventoryLedger", [BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.slice()]),
    sheet("BalanceLedger", [BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.slice()]),
    sheet("Accounts", values(accountHeaders, accounts))];
  if (options.openings) sheets.push(sheet("InventoryOpenings", options.openings, INVENTORY_OPENING_STAGING_POLICY.HEADERS));
  var spreadsheet = capitalEquitySchemaTestSpreadsheet(sheets);
  spreadsheet.id = "LOCAL_INVENTORY_OPENING_TEST";
  spreadsheet.insertSheet = function(name) {
    var created = sheet(name, [], INVENTORY_OPENING_STAGING_POLICY.HEADERS); this.sheets.push(created); return created;
  };
  spreadsheet.deleteSheet = function(target) { this.sheets.splice(this.sheets.indexOf(target), 1); };
  var corrupted = false;
  return { spreadsheet: spreadsheet, writes: function() { return writes.slice(); },
    runtime: { mode: INVENTORY_SCHEMA_RUNTIME.TEST_MODE, spreadsheet: spreadsheet, flush: function() {
      if (options.corruptAfterFlush && !corrupted) {
        spreadsheet.getSheetByName("InventoryOpenings").values[0][0] = "CORRUPTED"; corrupted = true;
      }
    }, freshSpreadsheet: function() { return spreadsheet; } } };
}

function inventoryOpeningReviewTestIdentity() {
  return { fileName: "inventory-opening-evidence-intake-reviewed.xlsx", version: "V01-REVIEWED",
    sha256: new Array(65).join("b"), frozen: true, reviewed: true };
}

function inventoryOpeningReviewTestRows(rows) {
  return rows.map(function(row) {
    var intake = Object.assign({}, row, { OpeningBatchID: INVENTORY_OPENING_REVIEW_POLICY.BATCH_ID });
    delete intake.ApprovalStatus; delete intake.IsActive; delete intake.CreatedAt; delete intake.CreatedBy;
    delete intake.UpdatedAt; delete intake.UpdatedBy; delete intake.SupersedesOpeningID;
    return intake;
  });
}

function testInventoryOpeningStagingContracts() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  var items = inventoryOpeningStagingTestItems(), conversions = inventoryOpeningStagingTestConversions(items);
  var rows = INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.map(inventoryOpeningStagingTestRow);
  check(INVENTORY_OPENING_STAGING_POLICY.HEADERS.length === 27 &&
    INVENTORY_OPENING_STAGING_POLICY.HEADERS[0] === "OpeningID" &&
    INVENTORY_OPENING_STAGING_POLICY.HEADERS[26] === "UpdatedBy", "exact 27-column staging schema");
  check(INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.length === 21 &&
    INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.indexOf("ING-018") === -1, "exact eligible scope excludes Lemon");
  check(validateInventoryOpeningStagingRows(rows, items, conversions).status === "PASS", "valid staging rows pass");
  var lemon = Object.assign({}, rows[0], { OpeningID: "OPEN-LEMON", ItemID: "ING-018", BaseUOM: "slice" });
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([lemon], items, conversions),
    "PROHIBITED_LEMON_ITEM"), "Lemon refused");
  check(classifyInventoryOpeningBatch("OPEN-BATCH-20260930", rows.slice(1), items, conversions).status === "INCOMPLETE",
    "missing item makes batch incomplete");
  var duplicate = Object.assign({}, rows[0], { OpeningID: "OPEN-DUPLICATE" });
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows(rows.concat([duplicate]), items, conversions),
    "DUPLICATE_ACTIVE_CANDIDATE"), "duplicate active scope fails closed");
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([
    Object.assign({}, rows[0], { BaseUOM: "ml" })], items, conversions), "BASE_UOM_MISMATCH"), "wrong BaseUOM refused");
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([
    Object.assign({}, rows[0], { ObservationTimestamp: "2026-10-01T00:00:00+07:00", ApprovalStatus: "DRAFT" })], items, conversions),
    "INVALID_OBSERVATION_TIMESTAMP"), "observation outside the cutover window refused");
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([
    Object.assign({}, rows[0], { ObservedQty: "", ApprovalStatus: "DRAFT" })], items, conversions),
    "MISSING_OBSERVATION"), "missing observation is not zero");
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([
    Object.assign({}, rows[0], { ObservedQty: "2.5000001", TotalValue: 101, ApprovalStatus: "DRAFT" })], items, conversions),
    "INVALID_OBSERVED_QUANTITY"), "quantity precision is capped at six decimals");
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([
    Object.assign({}, rows[0], { QuantityEvidenceRef: "", ApprovalStatus: "DRAFT" })], items, conversions),
    "MISSING_QUANTITY_EVIDENCE"), "missing count evidence refused");
  var falseZero = Object.assign({}, rows[0], { ObservedQty: 0, QuantityEvidenceRef: "", UnitCost: "", TotalValue: 0,
    ValuationBasis: "", ValuationEvidenceRef: "", ApprovalStatus: "DRAFT" });
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([falseZero], items, conversions),
    "FALSE_ZERO_WITHOUT_EVIDENCE"), "false zero refused");
  var verifiedZero = Object.assign({}, falseZero, { QuantityEvidenceRef: "COUNT:ZERO:OBSERVED", ApprovalStatus: "COUNT_VERIFIED" });
  check(validateInventoryOpeningStagingRows([verifiedZero], items, conversions).status === "PASS" &&
    classifyInventoryOpeningStagingRow(verifiedZero, items[0], conversions, items) === "COUNT_VERIFIED",
    "verified zero accepted without fabricated UnitCost");
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([
    Object.assign({}, rows[0], { UnitCost: "", ApprovalStatus: "COUNT_VERIFIED" })], items, conversions),
    "INVALID_UNIT_COST"), "positive quantity requires valuation");
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([
    Object.assign({}, rows[0], { UnitCost: "40.40000000001", ApprovalStatus: "COUNT_VERIFIED" })], items, conversions),
    "INVALID_UNIT_COST"), "unit-cost precision is capped at ten decimals");
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([
    Object.assign({}, rows[0], { TotalValue: 100 })], items, conversions), "INVALID_TOTAL_VALUE_ROUNDING"),
    "half-up rounding enforced");
  check(inventoryOpeningStagingHasError(validateInventoryOpeningStagingRows([
    Object.assign({}, rows[0], { ValuationEvidenceRef: "", ApprovalStatus: "COUNT_VERIFIED" })], items, conversions),
    "MISSING_VALUATION_EVIDENCE"), "valuation evidence required");
  var unresolved = Object.assign({}, rows[0], { AcquisitionEvidenceRef: "", AccountingSourceRef: "",
    EconomicOrigin: "UNRESOLVED", ApprovalStatus: "NEEDS_SOURCE_EVIDENCE" });
  check(validateInventoryOpeningStagingRows([unresolved], items, conversions).status === "PASS" &&
    classifyInventoryOpeningStagingRow(unresolved, items[0], conversions, items) === "NEEDS_SOURCE_EVIDENCE",
    "unresolved origin accepted only for staging");
  var conflict = Object.assign({}, rows[0], { EconomicOrigin: "UNPAID_SUPPLIER", AccountingSourceRef: "EXPENSE:2026-09",
    ApprovalStatus: "CLASSIFICATION_CONFLICT" });
  check(validateInventoryOpeningStagingRows([conflict], items, conversions).status === "PASS", "classification conflict is explicit");
  var unreviewed = Object.assign({}, rows[0], { ReviewedBy: "", ReviewedAt: "", ApprovalStatus: "VALUATION_VERIFIED" });
  check(validateInventoryOpeningStagingRows([unreviewed], items, conversions).status === "PASS" &&
    classifyInventoryOpeningStagingRow(unreviewed, items[0], conversions, items) === "VALUATION_VERIFIED",
    "evidence completeness does not imply reviewed readiness");
  var posting = buildInventoryOpeningPostingPlan();
  check(posting.status === "REFUSED" && posting.writeCount === 0 && posting.inventoryLedgerRows === 0 &&
    posting.balanceLedgerRows === 0 && posting.account1100Mutation === false, "posting isolation is fail closed");
  check(posting.balancingAuthority === "NONE" && INVENTORY_OPENING_STAGING_POLICY.BALANCING_AUTHORITY === "NONE",
    "no balancing authority");
  var complete = classifyInventoryOpeningBatch("OPEN-BATCH-20260930", rows, items, conversions);
  check(complete.status === "COMPLETE" && complete.eligibleCount === 21 && complete.candidateCount === 21 &&
    complete.conversionsApplicable, "all-or-nothing batch completeness");
  check(complete.accountingReadiness === "READY_FOR_ACCOUNTING_REVIEW" && !complete.accountingAuthorized &&
    !complete.postingAllowed, "readiness never authorizes accounting posting");
  var unresolvedBatch = rows.slice(); unresolvedBatch[0] = unresolved;
  check(classifyInventoryOpeningBatch("OPEN-BATCH-20260930", unresolvedBatch, items, conversions).accountingReadiness ===
    "NEEDS_SOURCE_EVIDENCE", "unresolved source blocks accounting readiness");
  var missingMigration = inventoryOpeningStagingMigrationTestRuntime();
  var plan = buildInventoryOpeningStagingMigrationPlan(readInventoryOpeningStagingMigrationState(missingMigration.spreadsheet));
  check(plan.status === "READY" && plan.writeCount === 1 && plan.productionMutation === false,
    "header-only migration preflight ready");
  [
    { option: "account3210Active", message: "active Account 3210" },
    { option: "account3210Inactive", message: "inactive Account 3210" }
  ].forEach(function(scenario) {
    var options = {}; options[scenario.option] = true;
    var account3210 = inventoryOpeningStagingMigrationTestRuntime(options);
    var refused3210 = executeInventoryOpeningStagingMigrationWithRuntime(account3210.runtime);
    check(refused3210.status === "REFUSED" && refused3210.reason === "REFUSED_ACCOUNT_3210_PRESENT" &&
      refused3210.writeCount === 0 && !account3210.spreadsheet.getSheetByName("InventoryOpenings") &&
      account3210.writes().length === 0, scenario.message + " refuses with zero writes");
  });
  var unrelated = inventoryOpeningStagingMigrationTestRuntime({ unrelatedAccount: true });
  check(buildInventoryOpeningStagingMigrationPlan(readInventoryOpeningStagingMigrationState(unrelated.spreadsheet)).status === "READY",
    "unrelated account does not weaken the exact Account 3210 guard");
  var migrated = executeInventoryOpeningStagingMigrationWithRuntime(missingMigration.runtime);
  check(migrated.status === "MIGRATED" && migrated.writeCount === 1 &&
    missingMigration.spreadsheet.getSheetByName("InventoryOpenings").getLastRow() === 1, "migration creates zero business rows");
  check(executeInventoryOpeningStagingMigrationWithRuntime(missingMigration.runtime).status === "ALREADY_MIGRATED",
    "migration is idempotent");
  var recovery = executeInventoryOpeningStagingRecoveryWithRuntime(missingMigration.runtime, migrated.migrationRecord);
  check(recovery.status === "RECOVERED" && recovery.writeCount === 1 &&
    !missingMigration.spreadsheet.getSheetByName("InventoryOpenings"), "guarded recovery removes owned header-only sheet");
  var drift = inventoryOpeningStagingMigrationTestRuntime({ openings: [["WrongHeader"]] });
  check(buildInventoryOpeningStagingMigrationPlan(readInventoryOpeningStagingMigrationState(drift.spreadsheet)).status === "REFUSED",
    "schema collision refused");
  var business = inventoryOpeningStagingMigrationTestRuntime({ openings: [INVENTORY_OPENING_STAGING_POLICY.HEADERS.slice(),
    INVENTORY_OPENING_STAGING_POLICY.HEADERS.map(function() { return "BUSINESS"; })] });
  check(buildInventoryOpeningStagingMigrationPlan(readInventoryOpeningStagingMigrationState(business.spreadsheet)).reason ===
    "REFUSED_BUSINESS_ROWS", "business rows refuse schema migration");
  var failed = inventoryOpeningStagingMigrationTestRuntime({ corruptAfterFlush: true });
  check(executeInventoryOpeningStagingMigrationWithRuntime(failed.runtime).status === "FAILED_ROLLED_BACK" &&
    !failed.spreadsheet.getSheetByName("InventoryOpenings"), "failed acceptance rolls back exactly");
  check(runInventoryOpeningStagingMigration.toString().indexOf("lock.waitLock(30000)") !== -1 &&
    runInventoryOpeningStagingRecovery.toString().indexOf("lock.waitLock(30000)") !== -1, "production wrappers require ScriptLock");
  check(typeof runInventoryOpeningStagingDisposableRuntimeProof === "function" &&
    runInventoryOpeningStagingDisposableRuntimeProof.toString().indexOf("SpreadsheetApp.create") !== -1 &&
    executeInventoryOpeningStagingDisposableRuntimeProofWithRuntime.toString().indexOf("testInventoryOpeningStagingContracts") !== -1,
    "disposable Apps Script runtime entry starts with the focused contract");
  check(executeInventoryOpeningStagingDisposableRuntimeProofWithRuntime.toString().indexOf("production fingerprint preserved") !== -1 &&
    executeInventoryOpeningStagingDisposableRuntimeProofWithRuntime.toString().indexOf("disposable cleanup verification") !== -1 &&
    executeInventoryOpeningStagingDisposableRuntimeProofWithRuntime.toString().indexOf("ACCOUNT_3210_ACTIVE") !== -1 &&
    executeInventoryOpeningStagingDisposableRuntimeProofWithRuntime.toString().indexOf("ACCOUNT_3210_INACTIVE") !== -1 &&
    typeof runInventoryOpeningReviewDisposableRuntimeProof === "function" &&
    executeInventoryOpeningReviewDisposableRuntimeProofWithRuntime.toString().indexOf("production fingerprint preserved") !== -1 &&
    executeInventoryOpeningReviewDisposableRuntimeProofWithRuntime.toString().indexOf("disposable cleanup verification") !== -1 &&
    executeInventoryOpeningReviewDisposableRuntimeProofWithRuntime.toString().indexOf("FROZEN_REVIEWED_ARTIFACT_NOT_CONFIGURED") !== -1,
    "disposable proof preserves production and verifies cleanup");
  var replacement = Object.assign({}, rows[0], { OpeningID: "OPEN-ING-004-V02",
    SupersedesOpeningID: rows[0].OpeningID, QuantityEvidenceRef: "COUNT:ING-004:V02" });
  var correction = buildInventoryOpeningStagingCorrectionPlan(rows[0], replacement);
  check(correction.status === "READY" && correction.writeCount === 2 && correction.appendOnlyEvidenceVersion &&
    !correction.silentHistoricalMutationAllowed && correction.productionMutation === false, "correction is explicit and versioned");
  check(buildInventoryOpeningStagingCorrectionPlan(rows[0], Object.assign({}, replacement,
    { ItemID: "ING-005" })).status === "REFUSED", "correction cannot change immutable scope");
  var identity = inventoryOpeningReviewTestIdentity();
  var intakeRows = inventoryOpeningReviewTestRows(rows);
  var reviewed = reviewInventoryOpeningIntakePackage(intakeRows, items, conversions, identity, identity);
  check(reviewed.status === "PASS" && reviewed.candidates.length === 21 && reviewed.exactColumnCount === 27 &&
    reviewed.batch.status === "COMPLETE" && reviewed.artifactIntegrity.status === "PASS",
    "complete frozen intake transforms to an exact 21-row candidate batch");
  check(INVENTORY_OPENING_STAGING_POLICY.HEADERS.every(function(header) {
    return Object.prototype.hasOwnProperty.call(reviewed.candidates[0], header);
  }) && Object.keys(reviewed.candidates[0]).filter(function(key) {
    return INVENTORY_OPENING_STAGING_POLICY.HEADERS.indexOf(key) !== -1;
  }).length === 27, "candidate mapping is exact27");
  check(reviewed.readiness.every(function(row) { return row.status === "READY_FOR_ACCOUNTING_REVIEW"; }) &&
    reviewed.accountingAuthorized === false && reviewed.postingAllowed === false && reviewed.balancingAuthority === "NONE",
    "review readiness remains non-posting and unauthorized");
  var mutableIdentity = Object.assign({}, identity, { frozen: false });
  check(reviewInventoryOpeningIntakePackage(intakeRows, items, conversions, mutableIdentity, identity).status === "BLOCKED",
    "mutable artifact is refused");
  var wrongHash = Object.assign({}, identity, { sha256: new Array(65).join("c") });
  check(reviewInventoryOpeningIntakePackage(intakeRows, items, conversions, wrongHash, identity).artifactIntegrity.status ===
    "REFUSED_MUTABLE_OR_UNFROZEN_ARTIFACT", "unreviewed artifact hash is refused");
  var incompleteReview = reviewInventoryOpeningIntakePackage(inventoryOpeningReviewTestRows(rows.slice(1)),
    items, conversions, identity, identity);
  check(incompleteReview.status === "BLOCKED" && incompleteReview.batch.missingItemIds.indexOf("ING-004") !== -1,
    "missing item blocks reviewed batch");
  var unresolvedIntake = inventoryOpeningReviewTestRows(rows);
  unresolvedIntake[0] = Object.assign({}, unresolvedIntake[0], { AcquisitionEvidenceRef: "", AccountingSourceRef: "",
    EconomicOrigin: "UNRESOLVED" });
  var unresolvedReview = reviewInventoryOpeningIntakePackage(unresolvedIntake, items, conversions, identity, identity);
  check(unresolvedReview.readiness[0].status === "NEEDS_SOURCE_EVIDENCE" && unresolvedReview.status === "PASS" &&
    unresolvedReview.accountingAuthorized === false, "unresolved positive source remains staging-valid and non-posting");
  var conflictIntake = inventoryOpeningReviewTestRows(rows);
  conflictIntake[0] = Object.assign({}, conflictIntake[0], { EconomicOrigin: "UNPAID_SUPPLIER",
    AccountingSourceRef: "EXPENSE:2026-09" });
  var conflictReview = reviewInventoryOpeningIntakePackage(conflictIntake, items, conversions, identity, identity);
  check(conflictReview.readiness[0].status === "CLASSIFICATION_CONFLICT" && conflictReview.status === "PASS",
    "conflicting provenance remains explicitly classified");
  var populationFixture = inventoryOpeningStagingMigrationTestRuntime({ openings: [INVENTORY_OPENING_STAGING_POLICY.HEADERS.slice()] });
  var populationPlan = buildInventoryOpeningPopulationPlan(readInventoryOpeningStagingMigrationState(populationFixture.spreadsheet), reviewed);
  check(populationPlan.status === "READY" && populationPlan.writeCount === 1 && populationPlan.targetValues.length === 22,
    "future population planner produces one deterministic logical write");
  var populated = executeInventoryOpeningPopulationWithRuntime(populationFixture.runtime, reviewed);
  check(populated.status === "POPULATED" && populated.writeCount === 1 && populated.acceptance.status === "PASS" &&
    populated.acceptance.inventoryLedgerRows === 0 && populated.acceptance.balanceLedgerRows === 0,
    "future population exact semantic post-image accepted without posting");
  check(executeInventoryOpeningPopulationWithRuntime(populationFixture.runtime, reviewed).status === "ALREADY_POPULATED",
    "future population is idempotent with writeCount zero");
  var recoveredPopulation = executeInventoryOpeningPopulationRecoveryWithRuntime(populationFixture.runtime, populated.migrationRecord);
  check(recoveredPopulation.status === "RECOVERED" && recoveredPopulation.writeCount === 1,
    "owned candidate batch recovery restores the exact preimage");
  var partialValues = inventoryMigrationValues(INVENTORY_OPENING_STAGING_POLICY.HEADERS, reviewed.candidates.slice(0, 1));
  var partialFixture = inventoryOpeningStagingMigrationTestRuntime({ openings: partialValues });
  var partialPlan = buildInventoryOpeningPopulationPlan(readInventoryOpeningStagingMigrationState(partialFixture.spreadsheet), reviewed);
  check(partialPlan.status === "REFUSED" && partialPlan.reason === "PARTIAL_MIXED_DRIFT_OR_DUPLICATE_ROWS" &&
    partialPlan.writeCount === 0, "partial production rows refuse with zero writes");
  var dependencyFixture = inventoryOpeningStagingMigrationTestRuntime({ openings: [INVENTORY_OPENING_STAGING_POLICY.HEADERS.slice()] });
  var dependencyPopulation = executeInventoryOpeningPopulationWithRuntime(dependencyFixture.runtime, reviewed);
  dependencyFixture.spreadsheet.getSheetByName("BalanceLedger").getRange(2, 1, 1,
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.length).setValues([
      BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.map(function(header) {
        return header === "JournalID" ? "DEPENDENCY" : "";
      })]);
  check(executeInventoryOpeningPopulationRecoveryWithRuntime(dependencyFixture.runtime,
    dependencyPopulation.migrationRecord).reason === "DOWNSTREAM_ACCOUNTING_DEPENDENCY_EXISTS",
    "recovery refuses after downstream accounting dependency");
  check(runInventoryOpeningPopulation.toString().indexOf("lock.waitLock(30000)") !== -1 &&
    runInventoryOpeningPopulation.toString().indexOf("FROZEN_REVIEWED_ARTIFACT_NOT_CONFIGURED") !== -1,
    "production wrapper remains disabled until a real frozen reviewed artifact is configured");
  check(INVENTORY_OPENING_STAGING_POLICY.PRODUCTION_MUTATION === false &&
    validateInventoryOpeningStagingRows([], items, conversions).productionMutation === false,
    "productionMutation remains false");
  Logger.log("PASS: testInventoryOpeningStagingContracts | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios, productionMutation: false };
}
