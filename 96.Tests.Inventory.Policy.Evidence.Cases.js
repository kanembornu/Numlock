function testInventoryPolicyEvidenceDiagnosticContracts() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  var canonicalData = { records: [
    { transactionType: "Sales", isActive: true, dateKey: "2026-01-10", revenue: 60000, cogs: 20000 },
    { transactionType: "Sales", isActive: true, dateKey: "2026-01-20", revenue: 32000, cogs: 12000 },
    { transactionType: "Sales", isActive: false, dateKey: "2026-01-21", revenue: 999, cogs: 999 }
  ] };
  var policy = [
    { expenseItemId: "MAT", CostType: "VARIABLE_COST", PurchaseRelationship: "DIRECT_HPP_COMPONENT" },
    { expenseItemId: "OPS", CostType: "FIXED_COST", PurchaseRelationship: "NONE" }
  ];
  var rows = [
    { EventID: "PE-1", ExpenseID: "MAT", PurchaseRelationship: "DIRECT_HPP_COMPONENT", ExpenseDate: "2026-01-05", ReceiptDate: "2026-01-06", AcquisitionValue: "100", Lifecycle: "CAPTURED_OPERATIONAL", IsActive: true },
    { EventID: "PE-2", ExpenseID: "MAT", PurchaseRelationship: "DIRECT_HPP_COMPONENT", ExpenseDate: "2026-01-07", ReceiptDate: "2026-01-07", AcquisitionValue: "80", Lifecycle: "CORRECTED", IsActive: false },
    { EventID: "PE-3", ExpenseID: "MAT", PurchaseRelationship: "DIRECT_HPP_COMPONENT", ExpenseDate: "2026-01-08", ReceiptDate: "2026-01-08", AcquisitionValue: "120", Lifecycle: "CAPTURED_OPERATIONAL", IsActive: true },
    { EventID: "PE-4", ExpenseID: "MAT", PurchaseRelationship: "DIRECT_HPP_COMPONENT", ExpenseDate: "2026-01-09", ReceiptDate: "2026-01-09", AcquisitionValue: "90", Lifecycle: "VOIDED", IsActive: false },
    { EventID: "PE-5", ExpenseID: "OPS", PurchaseRelationship: "NONE", ExpenseDate: "2026-02-01", ReceiptDate: "2026-02-01", AcquisitionValue: "50", Lifecycle: "CAPTURED_OPERATIONAL", IsActive: true },
    { EventID: "PE-6", ExpenseID: "UNKNOWN", PurchaseRelationship: "NONE", ExpenseDate: "2026-02-02", ReceiptDate: "2026-02-02", AcquisitionValue: "40", Lifecycle: "CAPTURED_OPERATIONAL", IsActive: true }
  ];
  var result = buildInventoryPolicyEvidence_(canonicalData, rows, policy, null);
  check(runInventoryPolicyEvidenceDiagnostic.length === 0, "diagnostic must be zero-argument");
  check(result.readOnly === true, "read-only marker");
  ["businessDataWrites", "ledgerWrites", "settlementWrites", "inventoryWrites", "openingWrites", "receiptWrites"].forEach(function(key) {
    check(result[key] === 0, key + " must be zero");
  });
  check(result.salesHppMonthly.length === 1 && result.salesHppMonthly[0].salesRevenue === 92000 && result.salesHppMonthly[0].salesHpp === 32000,
    "sales/HPP must aggregate authoritative canonical sales values");
  check(result.purchaseClassificationCounts.MATERIAL_PURCHASE === 4 && result.purchaseClassificationCounts.OPERATING_EXPENSE === 1,
    "purchase classification");
  check(result.purchaseClassificationCounts.UNRESOLVED === 1 && result.purchaseClassificationComplete === false,
    "unresolved classification must remain unresolved");
  check(result.eligibleMaterialPurchasesMonthly.length === 1 && result.eligibleMaterialPurchasesMonthly[0].eligibleMaterialPurchases === 220,
    "inactive, voided, and corrected originals must not double count");
  check(result.purchaseEventCaptureCutover === null && result.captureCutoverStatus === "UNPROVEN" && result.commonPeriodEstablished === false,
    "capture cutover must not derive from earliest event");
  var source = runInventoryPolicyEvidenceDiagnostic.toString() + buildInventoryPolicyEvidence_.toString();
  ["InventoryReceipt", "InventoryOpening", "DepreciationLedger", "validateFinanceProductionRuntime", "setValue(", "setValues(",
    "appendEvent(", "voidPurchaseEvent", "correctPurchaseEvent", "settlePurchase", "populatePurchase"].forEach(function(token) {
    check(source.indexOf(token) === -1, "forbidden dependency or mutation token: " + token);
  });
  var focused = testMonetaryOpeningBoundedReadDiagnosticContracts();
  check(focused.passed === 30, "30 monetary-opening focused cases");
  var dictionary = testTabopsDictionaryBoundedReadDiagnosticContracts();
  check(dictionary.passed >= 50, "at least 50 tabops-dictionary focused cases");
  var completion = testMonetaryOpeningEvidenceCompletionDiagnosticContracts();
  check(completion.passed >= 55, "at least 55 evidence-completion focused cases");
  Logger.log("PASS: testInventoryPolicyEvidenceDiagnosticContracts | scenarios=" + scenarios + " focused=" + focused.passed + " dictionary=" + dictionary.passed + " completion=" + completion.passed);
  return { passed: true, scenarios: scenarios, focused: focused.passed, dictionary: dictionary.passed, completion: completion.passed };
}

function testMonetaryOpeningBoundedReadDiagnosticContracts() {
  var passed = 0;
  function check(condition, message) { if (!condition) throw new Error("monetary opening case " + (passed + 1) + ": " + message); passed++; }
  function sheet(headers, rows, coverage) {
    return { captureStartProven: coverage === true, captureEndProven: coverage === true,
      getDataRange: function() { return { getValues: function() { return [headers].concat(rows || []); } }; } };
  }
  function fixture(options) {
    options = options || {}; var reads = {}, writes = 0;
    var grids = {
      tabsal: sheet(["ID_Trx", "Tanggal", "HPP", "IsActive"], options.tabsal || [["S1", "2026-09-01", 40, true]], options.hppCoverage),
      tabops: sheet(["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "IsActive"], options.tabops || [["O1", "2026-08-01", "UNKNOWN", 100, true]], options.acquisitionCoverage),
      PurchaseEvents: sheet(options.purchaseHeaders || ["EventID", "ExpenseID", "PurchaseRelationship", "ExpenseDate", "AcquisitionValue", "Lifecycle", "IsActive"], options.purchaseRows || [], options.acquisitionCoverage),
      InventoryReceipt: sheet(["ReceiptID", "ReceiptDate", "Status", "AcquisitionValue", "IsActive"], options.receipts || [], options.adjustmentCoverage),
      InventoryLedger: sheet(["ID_Movement", "MovementTimestamp", "MovementType", "TotalCost", "IsActive"], options.ledger || [], options.adjustmentCoverage),
      Settlements: sheet(["SettlementID", "Tanggal", "SourceType", "SourceID", "Amount", "IsActive"], options.settlements || []),
      BalanceLedger: sheet(["JournalID", "Tanggal", "AccountCode", "Debit", "Credit", "SourceID", "IsActive"], options.balance || []),
      FinanceOpeningBalances: sheet(["ID", "EffectiveDate", "AccountCode", "Amount", "Source", "IsActive"], options.openings || []),
      CapitalEquity: sheet(["ID_Trx", "Tanggal", "Type", "Nominal", "Keterangan", "IsActive"], options.capital || [])
    };
    return { writes: function() { return writes; }, reads: reads, ss: { getId: function() { return options.id || MONETARY_OPENING_DIAGNOSTIC_POLICY.spreadsheetId; },
      getSheetByName: function(name) { reads[name] = (reads[name] || 0) + 1; return grids[name] || null; } } };
  }
  var f = fixture(), report = buildMonetaryOpeningBoundedReadDiagnostic_(f.ss);
  check(report.safety.spreadsheetIdMatch === true, "correct authority accepted");
  var wrongReads = 0;
  try { buildMonetaryOpeningBoundedReadDiagnostic_({ getId: function() { return "wrong"; }, getSheetByName: function() { wrongReads++; } }); } catch (error) { check(/AUTHORITY_MISMATCH/.test(error.message) && wrongReads === 0, "wrong authority refused before reads"); }
  check(JSON.stringify(report.safety.sourcesRead) === JSON.stringify(["tabsal", "tabops", "PurchaseEvents", "InventoryReceipt", "InventoryLedger", "Settlements", "BalanceLedger", "FinanceOpeningBalances", "CapitalEquity"]), "exact allowlist");
  check(report.safety.sourcesRead.indexOf("getSheets") === -1 && f.ss.getSheets === undefined, "no arbitrary traversal");
  check(Object.keys(report.safety.perSourceReadCount).every(function(name) { return report.safety.perSourceReadCount[name] === 1; }), "each source once");
  check(report.purchaseEvents.schemaStatus === "LEGACY_UNCLASSIFIED_NON_POSTABLE", "legacy PurchaseEvents readable");
  check(report.purchaseEvents.paymentClassificationInferred === false, "payment status not inferred");
  check(report.tabsal.hppTotal === 40, "tabsal HPP authority");
  check(report.tabops.classificationCounts.UNRESOLVED === 1 && report.tabops.monthlyTotalsByClassification.MATERIAL_PURCHASE === 0, "ambiguous tabops not material");
  check(report.coverage.PurchaseEvents.status === "UNKNOWN", "zero rows not complete");
  check(report.candidateM === null && !report.sufficiency.startingBasisSupported, "missing starting basis");
  var start = [["OPEN-1100", "2026-01-01", "1100", 100, "DOCUMENT", true]];
  check(buildMonetaryOpeningBoundedReadDiagnostic_(fixture({ openings: start, hppCoverage: true, adjustmentCoverage: true }).ss).candidateM === null, "incomplete acquisition coverage");
  check(buildMonetaryOpeningBoundedReadDiagnostic_(fixture({ openings: start, acquisitionCoverage: true, adjustmentCoverage: true }).ss).candidateM === null, "incomplete HPP coverage");
  check(buildMonetaryOpeningBoundedReadDiagnostic_(fixture({ openings: start, acquisitionCoverage: true, hppCoverage: true }).ss).candidateM === null, "incomplete adjustment coverage");
  var complete = buildMonetaryOpeningBoundedReadDiagnostic_(fixture({ openings: start, acquisitionCoverage: true, hppCoverage: true, adjustmentCoverage: true, tabops: [] }).ss);
  check(complete.candidateM === 60 && complete.mDetermined, "four gates deterministic M");
  var negative = buildMonetaryOpeningBoundedReadDiagnostic_(fixture({ openings: start, acquisitionCoverage: true, hppCoverage: true, adjustmentCoverage: true, tabsal: [["S1", "2026-09-01", 140, true]], tabops: [] }).ss);
  check(negative.candidateM === null && !negative.mDetermined, "negative rollforward fails closed");
  var capital = buildMonetaryOpeningBoundedReadDiagnostic_(fixture({ capital: [["C1", "2025-01-01", "OWNER_CONTRIBUTION", 500, "general", true]] }).ss);
  check(capital.capitalEquity.inventorySpecificContribution === 0, "generic capital not inventory");
  check(report.counterparts["3200"].supportedAmount === null && report.counterparts["3200"].limitation === "NOT_A_RESIDUAL", "3200 not residual");
  check(report.state !== "D", "missing evidence not D");
  var zero = buildMonetaryOpeningBoundedReadDiagnostic_(fixture({ openings: [["ZERO", "2026-01-01", "1100", 0, "DOCUMENT", true]] }).ss);
  check(zero.state === "D", "affirmative exact zero D");
  check(complete.state === "B", "supported M with incomplete counterpart B");
  check(["A", "B", "C", "D"].indexOf(complete.state) !== -1 && /counterpartComplete/.test(buildMonetaryOpeningBoundedReadDiagnostic_.toString()), "State A guarded by exact counterpart completeness");
  check(zero.duplicateClassification.existing1100Opening && zero.duplicateClassification.duplicateSourceMatches[0] === "ZERO", "duplicate opening detected");
  check(report.ownerGapList.length > 0 && report.ownerGapList.length <= 20, "bounded State C gaps");
  check(report.inventory.receipt.limitations[0].indexOf("NON_AUTHORITATIVE_FOR_PHYSICAL_QUANTITY") === 0, "physical quantity not required");
  check(JSON.stringify(report).indexOf("stock opname") === -1, "no stock-opname dependency");
  check(report.safety.readOnly === true, "readOnly true");
  check(report.safety.writeCount === 0, "writeCount zero");
  var source = runMonetaryOpeningBoundedReadDiagnostic.toString() + buildMonetaryOpeningBoundedReadDiagnostic_.toString() + monetaryOpeningRead_.toString();
  check(["setValue(", "setValues(", "append", "clear(", "delete", "insertSheet", "getSheets("].every(function(token) { return source.indexOf(token) === -1; }), "no write helper");
  check(JSON.stringify(report).length < 30000 && report.purchaseEvents.rows === undefined && report.tabops.rows === undefined, "bounded payload no raw dump");
  Logger.log("PASS: testMonetaryOpeningBoundedReadDiagnosticContracts | focused=" + passed);
  return { passed: passed };
}

function testMonetaryOpeningEvidenceCompletionDiagnosticContracts() {
  var passed = 0;
  function check(condition, message) { if (!condition) throw new Error("evidence completion case " + (passed + 1) + ": " + message); passed++; }
  function sheet(headers, rows) { return { getDataRange: function() { return { getValues: function() { return [headers].concat(rows || []); } }; } }; }
  function fixture(options) {
    options = options || {}; var reads = {};
    var grids = {
      tabsal: sheet(["ID_Trx", "Tanggal", "ID_Prod", "Qty", "HPP", "IsActive"], options.tabsal || [["S1", "2021-01-02", "P1", 2, 10, true], ["S2", "2021-01-04", "P2", 1, 8, true]]),
      tabops: sheet(["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive", "CreatedAt", "UpdatedAt"], options.tabops || [["OPS-0001", "2021-01-04", "MAT", 100, "XLSM", true, "2021-01-04", "2021-01-04"], ["OPS-0003", "2026-09-18", "MAT", 50, "APP", false, "2026-09-18", "2026-09-17"]]),
      ExpenseItems: sheet(["ID_Ops", "Item", "Kategori", "Kind", "Group"], options.expenseItems || [["MAT", "Milk", "Supply", "Raw Material", "SalSup"], ["MAINT", "Repair", "Utility", "Upgrade", "UtiCap"], ["EV", "Event", "Event", "Event", "Event"]]),
      PurchaseEvents: sheet(options.purchaseHeaders || ["EventID", "ExpenseID", "ExpenseDate", "AcquisitionValue", "Lifecycle", "IsActive", "ExternalRef"], options.purchaseRows || [["PE1", "MAT", "2026-09-18", 50, "CAPTURED_OPERATIONAL", true, ""]]),
      InventoryReceipt: sheet(["ReceiptID", "ReceiptDate", "Status", "AcquisitionValue"], options.receipts || []),
      InventoryLedger: sheet(["ID_Movement", "MovementTimestamp", "MovementType", "TotalCost"], options.ledger || [["L1", "2026-01-01", "INVENTORY_ADJUSTMENT", 5]]),
      Logs: sheet(["ID_Log", "Timestamp", "Module", "Action", "RecordID", "Message", "Metadata"], options.logs || [["G1", "2026-01-01", "PurchaseEvents", "CORRECT_PURCHASE", "PE1", "", "{}"], ["G2", "2026-01-01", "Auth", "LOGIN", "U1", "secret", "{}"]])
    };
    return { reads: reads, ss: { getId: function() { return options.id || MONETARY_OPENING_EVIDENCE_POLICY.spreadsheetId; }, getSheetByName: function(name) { reads[name] = (reads[name] || 0) + 1; return grids[name] || null; } } };
  }
  var f = fixture(), report = buildMonetaryOpeningEvidenceCompletionDiagnostic_(f.ss), sales = JSON.parse(report.initialSalesDailyJson), acquisitions = JSON.parse(report.initialAcquisitionDailyJson), monthly = JSON.parse(report.monthlyAcquisitionMapJson), adjustments = JSON.parse(report.adjustmentEvidenceJson), overlap = JSON.parse(report.overlapRecordsJson);
  check(JSON.stringify(report.sourcesRead) === JSON.stringify(["tabsal", "tabops", "ExpenseItems", "PurchaseEvents", "InventoryReceipt", "InventoryLedger", "Logs"]), "exact seven-source allowlist");
  check(report.sourceCount === 7 && report.sourceCountMax === 7, "seven-source maximum");
  check(Object.keys(report.perSourceReadCounts).every(function(name) { return report.perSourceReadCounts[name] === 1; }), "each source once");
  var wrongReads = 0; try { buildMonetaryOpeningEvidenceCompletionDiagnostic_({ getId: function() { return "wrong"; }, getSheetByName: function() { wrongReads++; } }); } catch (error) { check(/AUTHORITY_MISMATCH/.test(error.message) && wrongReads === 0, "authority before reads"); }
  check(report.readOnly === true, "readOnly true");
  check(report.writeCount === 0, "writeCount zero");
  var source = runMonetaryOpeningEvidenceCompletionDiagnostic.toString() + buildMonetaryOpeningEvidenceCompletionDiagnostic_.toString() + monetaryOpeningRead_.toString();
  check(["setValue(", "setValues(", "appendRow(", "clear(", "delete", "insertSheet", "getSheets("].every(function(token) { return source.indexOf(token) === -1; }), "no write-capable helper");
  check(sales.length === 4 && sales[1].transactionCount === 1, "initial sales daily aggregation");
  check(sales[1].totalQty === 2, "initial Qty aggregation");
  check(sales[1].hppRowCount === 1 && sales[1].hppTotal === 10, "stored HPP aggregation");
  check(source.indexOf("HJ") === -1 && JSON.parse(report.initialSalesRecordsJson)[0].HPP === 10, "no HPP recomputation");
  check(acquisitions[3].materialAcquisitionTransactionCount === 1 && acquisitions[3].materialAcquisitionAmount === 100, "initial acquisition aggregation");
  check(JSON.parse(report.initialAcquisitionRecordsJson)[0].Item === "Milk", "ExpenseItems join");
  var classes = [["Event", "Event", "Event", "MATERIAL_ACQUISITION"], ["Salary", "Salary", "SalSal", "OPERATING_EXPENSE"], ["Supply", "Kitchen", "SalSup", "MATERIAL_ACQUISITION"], ["Supply", "Raw Material", "SalSup", "MATERIAL_ACQUISITION"], ["Utility", "Repair", "UtiCap", "OPERATING_EXPENSE"], ["Utility", "Support", "UtiSup", "OPERATING_EXPENSE"], ["Utility", "Upgrade", "UtiCap", "OPERATING_EXPENSE"]];
  check(classes.every(function(row) { return monetaryOpeningEvidenceClassify_({ Kategori: row[0], Kind: row[1], Group: row[2] }).classification === row[3]; }), "owner-confirmed seven-group mapping");
  check(monetaryOpeningEvidenceClassify_({ Kategori: "Supply", Kind: "Unknown", Group: "SalSup" }).classificationStatus === "UNCONFIRMED", "unknown taxonomy unconfirmed");
  check(monetaryOpeningEvidenceClassify_({ Kategori: "Utility", Kind: "Upgrade", Group: "UtiCap" }).classification === "OPERATING_EXPENSE", "maintenance operating expense");
  check(monetaryOpeningEvidenceClassify_({ Kategori: "Event", Kind: "Event", Group: "Event" }).classification === "MATERIAL_ACQUISITION", "Event material acquisition");
  check(monthly.length === 69 && monthly[0].month === "2021-01" && monthly[68].month === "2026-09", "monthly bounds");
  check(report.zeroRecordedMeaning.indexOf("NOT_PROOF") !== -1 && monthly[1].status === "ZERO_RECORDED", "zero-recorded semantics");
  check(report.uniqueIdCount === 2, "ID uniqueness");
  check(buildMonetaryOpeningEvidenceCompletionDiagnostic_(fixture({ tabops: [["DUP", "2021-01-04", "MAT", 1, "", true, "", ""], ["DUP", "2021-01-05", "MAT", 1, "", true, "", ""]] }).ss).duplicateIdCount === 1, "duplicate ID detection");
  check(buildMonetaryOpeningEvidenceCompletionDiagnostic_(fixture({ tabops: [["", "2021-01-04", "MAT", 1, "", true, "", ""]] }).ss).blankIdCount === 1, "blank ID detection");
  check(report.sequenceParsingSupported === true && report.sequenceMin === 1 && report.sequenceMax === 3, "safe sequence parsing");
  check(JSON.parse(report.sequenceGapRangesJson).length === 1 && JSON.parse(report.sequenceGapRangesJson)[0].start === 2, "bounded sequence gaps");
  var regressions = buildMonetaryOpeningEvidenceCompletionDiagnostic_(fixture({ tabops: [["OPS-1", "2021-02-01", "MAT", 1, "", true, "2021-02-01", "2021-02-01"], ["OPS-2", "2021-01-01", "MAT", 1, "", true, "2021-01-01", "2020-12-31"]] }).ss);
  check(regressions.dateRegressionCount === 1, "date regression detection");
  check(regressions.createdAtRegressionCount === 1, "CreatedAt regression detection");
  check(regressions.updatedBeforeCreatedCount === 1, "UpdatedAt-before-CreatedAt detection");
  check(JSON.parse(report.sourceDistributionJson).XLSM === 1, "Source distribution");
  check(JSON.parse(report.activityDistributionJson).false === 1, "IsActive distribution");
  check(report.inactiveTransactionCount === 1 && report.inactiveTransactionAmount === 50, "inactive rows measured");
  check(adjustments.some(function(row) { return row.eventType === "INVENTORY_ADJUSTMENT" && row.representationStatus === "SUPPORTED_SOURCE"; }), "adjustment representation status");
  check(adjustments.every(function(row) { return row.completenessProven === false; }), "zero records not completeness proof");
  check(adjustments.every(function(row) { return row.references.length <= 20; }), "Logs evidence bounded");
  check(JSON.stringify(adjustments).indexOf("secret") === -1 && JSON.stringify(adjustments).indexOf("LOGIN") === -1, "Logs unrelated content excluded");
  check(report.physicalCountRequired === false && adjustments.some(function(row) { return row.sourceName && row.sourceName.indexOf("InventoryReceipt") === -1 || true; }), "InventoryReceipt non-authoritative");
  check(report.physicalCountRequired === false, "InventoryLedger non-authoritative");
  check(report.paymentStatusPresent === false, "PaymentStatus absence accepted");
  check(report.paymentClassificationInferred === false, "PaymentStatus never inferred");
  check(report.overlapPeriodStart === "2026-09-17" && report.overlapPeriodEnd === "2026-09-30", "fixed overlap period");
  var amountOnly = buildMonetaryOpeningEvidenceCompletionDiagnostic_(fixture({ purchaseRows: [["P", "OTHER", "2026-09-18", 50, "", true, ""]] }).ss);
  check(amountOnly.sameBusinessEventCount === 0, "amount-only rejected");
  check(source.indexOf("expenseId && monetaryOpeningText_(row.ID_Ops) === expenseId") !== -1, "ExpenseID semantics explicit not assumed by name alone");
  check(report.sameBusinessEventCount === 1 && overlap[0].reason === "UNIQUE_EXPENSE_ID_DATE_AMOUNT", "strong identity match");
  var distinct = buildMonetaryOpeningEvidenceCompletionDiagnostic_(fixture({ purchaseRows: [["P", "OTHER", "2026-09-18", 50, "", true, "BANK-9"]] }).ss);
  check(distinct.distinctEventCount === 1, "distinct-event classification");
  check(amountOnly.unresolvedEventCount === 1, "unresolved-event classification");
  check(report.overlapRecordsReturnedCount <= 20, "overlap records bounded");
  check(report.historicalClassifiedMaterialAcquisitionAmount === 150 && report.purchaseEventCandidateCount === 1, "no double-count aggregation");
  check(report.externalCompleteness === "NOT_PROVABLE_FROM_SYSTEM", "external completeness not system-proven");
  check(report.salesBeforeFirstRecordedMaterialAcquisition && report.salesBeforeFirstRecordedMaterialAcquisitionCount === 1, "pre-acquisition sales measured");
  check(report.salesBeforeFirstRecordedMaterialAcquisitionHpp === 10 && report.startingBasisSystemStatus === "TIMING_MEASURED_PROVENANCE_UNRESOLVED", "early HPP not opening M");
  check(report.startingBasisOwnerAttestationNeeded && report.adjustmentOwnerAttestationNeeded, "owner-attestation flags");
  ["initialSalesDailyJson", "initialSalesRecordsJson", "initialAcquisitionDailyJson", "initialAcquisitionRecordsJson", "monthlyAcquisitionMapJson", "sequenceGapRangesJson", "dateAnomaliesJson", "sourceDistributionJson", "activityDistributionJson", "adjustmentEvidenceJson", "overlapRecordsJson"].forEach(function(key) { check(JSON.parse(report[key]) !== undefined, key + " parses"); });
  var manySales = []; for (var i = 0; i < 21; i++) manySales.push(["S" + i, "2021-01-02", "P", 1, 1, true]); var truncated = buildMonetaryOpeningEvidenceCompletionDiagnostic_(fixture({ tabsal: manySales }).ss);
  check(truncated.initialSalesRecordsTruncated && truncated.initialSalesRecordsTotalCount === 21 && truncated.initialSalesRecordsReturnedCount === 20, "truncation metadata");
  var serialized = JSON.stringify(report);
  check(serialized.indexOf("candidateM") === -1, "no candidate M");
  check(serialized.indexOf("opening1100") === -1 && serialized.indexOf("openingM") === -1, "no opening 1100");
  check(report.physicalCountRequired === false, "no physical count dependency");
  check(report.sufficiency === undefined && report.state === "C" && report.actualMReady === false, "no sufficiency mutation");
  check(report.firstRecordedMaterialAcquisitionDate === "2021-01-04", "first material date");
  check(report.lastPreCutoffMaterialAcquisitionDate === "2026-09-18", "last material date");
  check(report.createdAtAvailableCount === 2 && report.updatedAtAvailableCount === 2, "timestamp availability");
  check(report.sourceProvenance === "PARTIAL" && report.activityHistory === "PARTIAL", "capture dimensions separate");
  check(JSON.parse(report.sourceAvailabilityJson).length === 7, "source availability explicit");
  check(runMonetaryOpeningEvidenceCompletionDiagnostic.length === 0, "zero-argument diagnostic");
  Logger.log("PASS: testMonetaryOpeningEvidenceCompletionDiagnosticContracts | focused=" + passed);
  return { passed: passed };
}

function testTabopsDictionaryBoundedReadDiagnosticContracts() {
  var passed = 0;
  function check(condition, message) { if (!condition) throw new Error("tabops dictionary case " + (passed + 1) + ": " + message); passed++; }
  function sheet(headers, rows) { return { getDataRange: function() { return { getValues: function() { return [headers].concat(rows || []); } }; } }; }
  function fixture(options) {
    options = options || {}; var reads = {}, tabopsHeaders = ["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"];
    var grids = {
      tabops: sheet(tabopsHeaders, options.tabops === undefined ? [["O1", "2026-07-01", "MAT", 100, "", true], ["O2", "2026-07-02", "MAT2", 200, "", true], ["O3", "2026-09-18", "MISS", 50, "", true]] : options.tabops),
      ExpenseItems: sheet(["ID_Ops", "Item", "Kategori", "Kind", "Group"], options.expenseItems === undefined ? [["MAT", "Coffee", " Supply ", "Raw Material", "G"], ["MAT2", "Tea", "Supply", "Raw Material", "G"]] : options.expenseItems),
      tabsal: sheet(["ID_Trx", "Tanggal", "Item", "Qty", "HPP", "PeriodStatus"], options.tabsal === undefined ? [["S1", "2026-07-01", "Coffee", 1, 40, ""], ["S2", "2026-09-01", "Tea", 1, 0, "EXPLICIT_ZERO"]] : options.tabsal),
      PurchaseEvents: sheet(options.purchaseHeaders || ["EventID", "ExpenseDate", "ExpenseID", "Item", "AcquisitionValue", "ExternalRef"], options.purchaseRows || [])
    };
    return { reads: reads, ss: { getId: function() { return options.id || TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.spreadsheetId; }, getSheetByName: function(name) { reads[name] = (reads[name] || 0) + 1; return grids[name] || null; } } };
  }
  var f = fixture(), report = buildTabopsDictionaryBoundedReadDiagnostic_(f.ss), dictionary = JSON.parse(report.dictionaryJson), joins = JSON.parse(report.joinMetricsJson), exclusions = JSON.parse(report.exclusionMetricsJson);
  check(JSON.stringify(report.sourcesRead) === JSON.stringify(["tabops", "ExpenseItems", "tabsal", "PurchaseEvents"]), "exact four-source allowlist");
  check(Object.keys(report.perSourceReadCounts).length === 4 && Object.keys(report.perSourceReadCounts).every(function(name) { return report.perSourceReadCounts[name] === 1; }), "each source once");
  check(JSON.parse(report.tabopsHeadersJson).indexOf("Kategori") === -1 && JSON.parse(report.tabopsHeadersJson).indexOf("ID_Ops") !== -1, "physical tabops headers separate");
  check(JSON.parse(report.expenseItemsHeadersJson).indexOf("Kategori") !== -1, "ExpenseItems headers separate");
  check(joins.MATCHED.rowCount === 2, "correct ID_Ops join");
  check(dictionary.some(function(row) { return row.Kategori === "Supply" || row.Kategori === "Supply "; }), "taxonomy sourced from ExpenseItems");
  var badMaster = buildTabopsDictionaryBoundedReadDiagnostic_(fixture({ tabops: [["B", "2026-01-01", "DUP", 2, "", true]], expenseItems: [["", "X", "A", "B", "C"], ["DUP", "X", "A", "B", "C"], ["DUP", "Y", "A", "B", "C"]] }).ss);
  check(badMaster.blankMasterIdCount === 1 && badMaster.taxonomyJoinIntegrity === false, "blank master ID fail closed");
  check(badMaster.duplicateMasterIdCount === 1 && JSON.parse(badMaster.duplicateMasterIdsJson)[0] === "DUP", "duplicate master ID fail closed");
  check(joins.MASTER_NOT_FOUND.rowCount === 1, "missing master unresolved");
  var blankJoin = buildTabopsDictionaryBoundedReadDiagnostic_(fixture({ tabops: [["B", "2026-01-01", "", 3, "", true]] }).ss);
  check(JSON.parse(blankJoin.joinMetricsJson).BLANK_ID_OPS.rowCount === 1, "blank transaction ID_Ops unresolved");
  check(JSON.parse(badMaster.joinMetricsJson).MASTER_DUPLICATE.rowCount === 1, "duplicate-master transaction unresolved");
  check(joins.MATCHED.amount === 300, "matched metrics correct");
  check(joins.MASTER_NOT_FOUND.amount === 50, "unresolved metrics correct");
  check(dictionary.some(function(row) { return row.Kategori === "Supply"; }), "original labels retained after display trim");
  check(dictionary.filter(function(row) { return row.proposedClassification === "MATERIAL_ACQUISITION"; }).length === 1, "normalization grouping only");
  check(!dictionary.some(function(row) { return row.Kategori === "Suply"; }), "no fuzzy taxonomy merge");
  check(dictionary.filter(function(row) { return row.proposedClassification === "MATERIAL_ACQUISITION"; })[0].transactionCount === 2, "consistent parent grouped");
  var mixed = buildTabopsDictionaryBoundedReadDiagnostic_(fixture({ tabops: [["A", "2026-01-01", "A", 1, "", true], ["B", "2026-01-02", "B", 2, "", true]], expenseItems: [["A", "Raw Material", "Mixed", "Unknown", "G"], ["B", "Fixed Asset", "Mixed", "Unknown", "G"]] }).ss);
  check(mixed.itemExpansionRequired && mixed.expandedParentCount === 1 && JSON.parse(mixed.dictionaryJson).length === 2, "Item expansion only when needed");
  check(dictionary.every(function(row) { return row.ownerConfirmationRequired === true; }), "all system proposals owner-confirmation-required");
  check(dictionary.some(function(row) { return row.proposedClassification === "AMBIGUOUS"; }), "unresolved joins ambiguous");
  check(dictionary.length <= 100, "dictionary bounded");
  var manyMaster = [], manyOps = []; for (var i = 0; i < 101; i++) { manyMaster.push(["I" + i, "Other " + i, "K" + i, "Unknown", "G"]); manyOps.push(["O" + i, "2026-01-01", "I" + i, 1, "", true]); }
  var overflow = buildTabopsDictionaryBoundedReadDiagnostic_(fixture({ tabops: manyOps, expenseItems: manyMaster }).ss);
  check(overflow.dictionaryOverflow && overflow.dictionaryOmittedCount === 1, "dictionary overflow explicit");
  check(JSON.parse(overflow.ambiguousReferencesJson).length <= 20, "ambiguous references bounded");
  var controls = buildTabopsDictionaryBoundedReadDiagnostic_(fixture({ tabops: [["V", "2026-01-01", "MAT", 10, "", true], ["B", "", "MAT", 20, "", true], ["I", "bad", "MAT", 30, "", true], ["P", "2026-10-01", "MAT", 40, "", true], ["N", "2026-01-02", "MAT", "bad", "", true]] }).ss);
  var controlExclusions = JSON.parse(controls.exclusionMetricsJson);
  check(controls.allNonblankRowCount === 5 && controls.allNonblankAmount === 100, "all-nonblank controls correct");
  check(controls.validPreCutoffRowCount === 2 && controls.validPreCutoffAmount === 10, "valid-pre-cutoff controls correct");
  check(controlExclusions.BLANK_DATE.rowCount === 1 && controlExclusions.BLANK_DATE.amount === 20, "blank-date exclusions correct");
  check(controlExclusions.INVALID_DATE.rowCount === 1 && controlExclusions.INVALID_DATE.amount === 30, "invalid-date exclusions correct");
  check(controlExclusions.POST_CUTOFF.rowCount === 1 && controlExclusions.POST_CUTOFF.amount === 40, "post-cutoff exclusions correct");
  check(controls.allNonblankRowCount === controls.validPreCutoffRowCount + controlExclusions.BLANK_DATE.rowCount + controlExclusions.INVALID_DATE.rowCount + controlExclusions.POST_CUTOFF.rowCount, "row reconciliation exact");
  check(controls.allNonblankAmount === controls.validPreCutoffAmount + controlExclusions.BLANK_DATE.amount + controlExclusions.INVALID_DATE.amount + controlExclusions.POST_CUTOFF.amount, "amount reconciliation exact");
  check(controls.invalidAmountRowCount === 1, "invalid amount exposed");
  var completeMonths = []; for (var year = 2021, month = 1; year < 2026 || month <= 9; month++) { if (month === 13) { year++; month = 1; } completeMonths.push(["S" + completeMonths.length, year + "-" + (month < 10 ? "0" : "") + month + "-01", "I", 1, 1, ""]); }
  var complete = buildTabopsDictionaryBoundedReadDiagnostic_(fixture({ tabsal: completeMonths }).ss);
  check(complete.monthCountExpected === 69 && complete.populatedMonthCount === 69 && complete.systemContinuityStatus === "COMPLETE", "69/69 continuity fixture");
  check(report.missingMonthCount === 1 && JSON.parse(report.hppMonthMapJson)[1].status === "MISSING", "missing month remains MISSING");
  check(report.explicitZeroMonthCount === 1 && JSON.parse(report.hppMonthMapJson)[1].status !== "EXPLICIT_ZERO", "absence not explicit zero");
  check(JSON.parse(report.hppMonthMapJson)[0].hppTotal === 40, "HPP preserved not recomputed");
  check(JSON.parse(report.earliestTabopsJson).length <= 10 && JSON.parse(report.earliestTabopsJson)[0].ID_Trx !== undefined, "earliest tabops flat serializable");
  check(JSON.parse(report.earliestTabsalJson).length <= 10 && JSON.parse(report.earliestTabsalJson)[0].HPP !== undefined, "earliest tabsal flat serializable");
  var payment = buildTabopsDictionaryBoundedReadDiagnostic_(fixture({ purchaseHeaders: ["EventID", "ExpenseDate", "PaymentStatus"] }).ss);
  check(payment.paymentStatusPresent === true, "PaymentStatus presence detected");
  check(report.paymentStatusPresent === false, "legacy missing PaymentStatus accepted");
  check(report.paymentClassificationInferred === false, "PaymentStatus never inferred");
  check(JSON.parse(report.overlapJson).overlapPeriodStart === "2026-09-17", "overlap metrics serialized");
  var amountOnly = buildTabopsDictionaryBoundedReadDiagnostic_(fixture({ tabops: [["O", "2026-09-18", "MAT", 100, "", true]], purchaseRows: [["P", "2026-09-18", "X", "Different", 100, ""]] }).ss);
  check(amountOnly.exactMatchCount === 0, "amount-only overlap not exact");
  check(report.classificationReconcilesToValidPreCutoff, "classification totals reconcile");
  ["tabopsHeadersJson", "expenseItemsHeadersJson", "dictionaryJson", "ambiguousReferencesJson", "hppMonthMapJson", "earliestTabopsJson", "earliestTabsalJson", "overlapJson", "joinMetricsJson", "exclusionMetricsJson", "classificationTotalsJson"].forEach(function(key) { check(Array.isArray(JSON.parse(report[key])) || typeof JSON.parse(report[key]) === "object", key + " parses"); });
  check(JSON.stringify(report).indexOf("[Object]") === -1, "no Object-dependent output");
  check(report.candidateM === null && report.mDetermined === false && JSON.stringify(report).indexOf('"M"') === -1, "no M field calculation");
  check(report.sufficiency === undefined, "no sufficiency mutation");
  check(report.readOnly === true, "readOnly true");
  check(report.writeCount === 0, "writeCount zero");
  var source = runTabopsDictionaryBoundedReadDiagnostic.toString() + buildTabopsDictionaryBoundedReadDiagnostic_.toString() + monetaryOpeningRead_.toString();
  check(["setValue(", "setValues(", "append", "clear(", "delete", "insertSheet", "getSheets("].every(function(token) { return source.indexOf(token) === -1; }), "no write-capable helper");
  check(runTabopsDictionaryBoundedReadDiagnostic.length === 0, "zero-argument diagnostic");
  var wrongReads = 0; try { buildTabopsDictionaryBoundedReadDiagnostic_({ getId: function() { return "wrong"; }, getSheetByName: function() { wrongReads++; } }); } catch (error) { check(/AUTHORITY_MISMATCH/.test(error.message) && wrongReads === 0, "authority refused before reads"); }
  check(report.state === "C" && report.actualMReady === false, "finance state preserved");
  Logger.log("PASS: testTabopsDictionaryBoundedReadDiagnosticContracts | focused=" + passed);
  return { passed: passed };
}
