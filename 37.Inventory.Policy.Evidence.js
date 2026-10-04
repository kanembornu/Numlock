var INVENTORY_POLICY_EVIDENCE_ALLOWED_CLASSIFICATIONS = Object.freeze([
  "MATERIAL_PURCHASE", "OPERATING_EXPENSE", "FIXED_ASSET", "OWNER_TRANSACTION",
  "OTHER_NON_INVENTORY", "UNRESOLVED"
]);

function classifyInventoryPolicyPurchaseEvent_(row, policyRows) {
  var route = null;
  (policyRows || []).some(function(candidate) {
    if (candidate.expenseItemId === String(row.ExpenseID || "").trim()) { route = candidate; return true; }
    return false;
  });
  if (!route || route.PurchaseRelationship !== row.PurchaseRelationship) return "UNRESOLVED";
  if (["DIRECT_HPP_COMPONENT", "HPP_COST_POOL", "DIRECT_HPP_COMPONENT_PACKAGE_UNRESOLVED",
      "HPP_COST_POOL_PACKAGE_UNRESOLVED"].indexOf(route.PurchaseRelationship) !== -1) return "MATERIAL_PURCHASE";
  if (route.PurchaseRelationship === "NON_HPP_VARIABLE_COST" || route.CostType === "FIXED_COST") return "OPERATING_EXPENSE";
  if (route.CostType === "OTHER_HOLD" && route.PurchaseRelationship === "NONE") return "OTHER_NON_INVENTORY";
  return "UNRESOLVED";
}

function buildInventoryPolicyEvidence_(canonicalData, purchaseRows, policyRows, captureCutover) {
  var salesMonths = {}, purchaseMonths = {}, salesDates = [], purchaseDates = [];
  (canonicalData.records || []).forEach(function(row) {
    if (row.transactionType !== "Sales" || row.isActive !== true || !row.dateKey) return;
    var month = row.dateKey.slice(0, 7);
    salesMonths[month] = salesMonths[month] || { month: month, salesRevenue: 0, salesHpp: 0 };
    salesMonths[month].salesRevenue += Number(row.revenue) || 0;
    salesMonths[month].salesHpp += Number(row.cogs) || 0;
    salesDates.push(row.dateKey);
  });

  var classificationCounts = {}, unresolvedSummaries = [], eventSample = [], activeCount = 0;
  INVENTORY_POLICY_EVIDENCE_ALLOWED_CLASSIFICATIONS.forEach(function(value) { classificationCounts[value] = 0; });
  (purchaseRows || []).forEach(function(row) {
    var date = canonicalDate(row.ExpenseDate), dateKey = date ? canonicalDateKey(date) : null;
    if (dateKey) purchaseDates.push(dateKey);
    var classification = classifyInventoryPolicyPurchaseEvent_(row, policyRows);
    classificationCounts[classification]++;
    var active = row.Lifecycle === PURCHASE_EVENT_ACTIVE_LIFECYCLE && row.IsActive === true;
    if (active) {
      activeCount++;
      if (classification === "MATERIAL_PURCHASE" && dateKey) {
        var month = dateKey.slice(0, 7);
        purchaseMonths[month] = purchaseMonths[month] || { month: month, eligibleMaterialPurchases: 0 };
        purchaseMonths[month].eligibleMaterialPurchases += Number(row.AcquisitionValue) || 0;
      }
    }
    if (classification === "UNRESOLVED" && unresolvedSummaries.length < 100) {
      unresolvedSummaries.push({ EventID: String(row.EventID || ""), ExpenseID: String(row.ExpenseID || ""),
        PurchaseRelationship: String(row.PurchaseRelationship || "") });
    }
    if (eventSample.length < 100 && (classification === "UNRESOLVED" || !active)) {
      eventSample.push({ EventID: String(row.EventID || ""), ExpenseID: String(row.ExpenseID || ""),
        PurchaseRelationship: String(row.PurchaseRelationship || ""), ExpenseDate: dateKey,
        ReceiptDate: row.ReceiptDate || null, AcquisitionValue: Number(row.AcquisitionValue) || 0,
        Lifecycle: row.Lifecycle, IsActive: row.IsActive, correctedEventId: null, replacementEventId: null,
        eligibilityClassification: classification });
    }
  });
  salesDates.sort(); purchaseDates.sort();
  var salesStart = salesDates.length ? salesDates[0] : null, salesEnd = salesDates.length ? salesDates[salesDates.length - 1] : null;
  var purchaseStart = purchaseDates.length ? purchaseDates[0] : null, purchaseEnd = purchaseDates.length ? purchaseDates[purchaseDates.length - 1] : null;
  var cutoverProven = typeof captureCutover === "string" && /^\d{4}-\d{2}-\d{2}$/.test(captureCutover);
  var commonStart = cutoverProven && salesStart && purchaseStart ? [salesStart, purchaseStart, captureCutover].sort().pop() : null;
  var commonEnd = commonStart && salesEnd && purchaseEnd ? [salesEnd, purchaseEnd].sort()[0] : null;
  if (commonEnd && commonEnd < commonStart) { commonStart = null; commonEnd = null; }
  return {
    readOnly: true, businessDataWrites: 0, ledgerWrites: 0, settlementWrites: 0,
    inventoryWrites: 0, openingWrites: 0, receiptWrites: 0,
    salesHppReadable: true, purchaseEventsReadable: true,
    purchaseClassificationComplete: classificationCounts.UNRESOLVED === 0,
    unresolvedPurchaseEventCount: classificationCounts.UNRESOLVED,
    commonPeriodEstablished: commonStart !== null && commonEnd !== null,
    salesHppEarliestObservedDate: salesStart, salesHppLatestObservedDate: salesEnd,
    purchaseEventEarliestObservedDate: purchaseStart, purchaseEventLatestObservedDate: purchaseEnd,
    purchaseEventCaptureCutover: cutoverProven ? captureCutover : null,
    captureCutoverStatus: cutoverProven ? "PROVEN" : "UNPROVEN",
    commonReliableStart: commonStart, commonReliableEnd: commonEnd,
    salesHppMonthly: Object.keys(salesMonths).sort().map(function(key) { return salesMonths[key]; }),
    eligibleMaterialPurchasesMonthly: Object.keys(purchaseMonths).sort().map(function(key) { return purchaseMonths[key]; }),
    purchaseEventCount: (purchaseRows || []).length, activePurchaseEventCount: activeCount,
    purchaseClassificationCounts: classificationCounts, unresolvedPurchaseEventSummaries: unresolvedSummaries,
    purchaseEventValidationSample: eventSample
  };
}

function runInventoryPolicyEvidenceDiagnostic() {
  var ss = requireNumlockProductionSpreadsheet();
  var canonicalData = getCanonicalTransactionData(ss);
  var purchaseRows = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet) ?
    readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers) : [];
  purchaseEventHistory_(purchaseRows);
  var captureCutover = EXPENSE_PURCHASE_POLICY.activationEvent || null;
  var report = buildInventoryPolicyEvidence_(canonicalData, purchaseRows, EXPENSE_PURCHASE_POLICY.rows, captureCutover);
  Logger.log(JSON.stringify(report));
  return report;
}

var MONETARY_OPENING_DIAGNOSTIC_POLICY = Object.freeze({
  spreadsheetId: "1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M",
  cutoff: "2026-09-30", effectiveDate: "2026-10-01",
  sources: Object.freeze(["tabsal", "tabops", "PurchaseEvents", "InventoryReceipt", "InventoryLedger",
    "Settlements", "BalanceLedger", "FinanceOpeningBalances", "CapitalEquity"]),
  maxReferences: 20
});

function monetaryOpeningText_(value) { return String(value == null ? "" : value).trim(); }
function monetaryOpeningNumber_(row, names) {
  for (var i = 0; i < names.length; i++) if (row[names[i]] !== "" && row[names[i]] != null) {
    var value = Number(row[names[i]]); if (isFinite(value)) return value;
  }
  return null;
}
function monetaryOpeningDate_(row, names) {
  for (var i = 0; i < names.length; i++) { var value = capitalEquityDateKey(row[names[i]]); if (value) return value; }
  return null;
}
function monetaryOpeningActive_(row) { return row.IsActive === undefined || row.IsActive === "" || isCanonicalActive(row.IsActive); }
function monetaryOpeningRead_(ss, name, counts) {
  counts[name] = (counts[name] || 0) + 1;
  var sheet = ss.getSheetByName(name);
  if (!sheet) return { headers: [], rows: [], missing: true, captureStartProven: false, captureEndProven: false };
  var values = sheet.getDataRange().getValues(), headers = (values[0] || []).map(monetaryOpeningText_);
  return { headers: headers, missing: false, captureStartProven: sheet.captureStartProven === true,
    captureEndProven: sheet.captureEndProven === true, rows: values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== "" && value != null; });
  }).map(function(row, index) {
    var result = { sourceRowIndex: index + 2 };
    headers.forEach(function(header, column) { if (header) result[header] = row[column] === undefined ? "" : row[column]; });
    return result;
  }) };
}
function monetaryOpeningMonthly_(rows, dateNames, amountNames, predicate) {
  var totals = {};
  rows.forEach(function(row) {
    var date = monetaryOpeningDate_(row, dateNames), amount = monetaryOpeningNumber_(row, amountNames);
    if (date && date <= MONETARY_OPENING_DIAGNOSTIC_POLICY.cutoff && amount !== null && (!predicate || predicate(row))) {
      totals[date.slice(0, 7)] = (totals[date.slice(0, 7)] || 0) + amount;
    }
  });
  return Object.keys(totals).sort().map(function(month) { return { month: month, amount: totals[month] }; });
}
function monetaryOpeningRange_(rows, dateNames) {
  var dates = rows.map(function(row) { return monetaryOpeningDate_(row, dateNames); }).filter(function(date) {
    return date && date <= MONETARY_OPENING_DIAGNOSTIC_POLICY.cutoff;
  }).sort();
  return { earliestDate: dates.length ? dates[0] : null, latestPreCutoffDate: dates.length ? dates[dates.length - 1] : null };
}
function monetaryOpeningCoverage_(name, data, dates, amount) {
  var range = monetaryOpeningRange_(data.rows, dates);
  return { source: name, status: data.missing ? "UNKNOWN" : data.rows.length ? "PARTIAL" : "UNKNOWN",
    earliestDate: range.earliestDate, latestPreCutoffDate: range.latestPreCutoffDate, rowCount: data.rows.length,
    amountIfRelevant: amount == null ? null : amount, continuousCoverage: "UNKNOWN", cutoffCoverage: "UNKNOWN",
    limitations: data.missing ? ["SOURCE_NOT_FOUND"] : data.rows.length ? ["CAPTURE_START_AND_CONTINUITY_NOT_PROVEN"] : ["ZERO_ROWS_DOES_NOT_PROVE_COVERAGE"] };
}
function monetaryOpeningId_(row) {
  var names = ["ID_Trx", "EventID", "ID_Movement", "ReceiptID", "SettlementID", "JournalID", "ID"];
  for (var i = 0; i < names.length; i++) if (monetaryOpeningText_(row[names[i]])) return monetaryOpeningText_(row[names[i]]);
  return "ROW-" + row.sourceRowIndex;
}
function buildMonetaryOpeningBoundedReadDiagnostic_(ss) {
  if (!ss || typeof ss.getId !== "function" || String(ss.getId()) !== MONETARY_OPENING_DIAGNOSTIC_POLICY.spreadsheetId) {
    throw new Error("MONETARY_OPENING_SPREADSHEET_AUTHORITY_MISMATCH");
  }
  var counts = {}, data = {};
  MONETARY_OPENING_DIAGNOSTIC_POLICY.sources.forEach(function(name) { data[name] = monetaryOpeningRead_(ss, name, counts); });
  var cutoff = MONETARY_OPENING_DIAGNOSTIC_POLICY.cutoff;
  var tabsalRows = data.tabsal.rows.filter(function(row) { return monetaryOpeningActive_(row); });
  var hppRows = tabsalRows.filter(function(row) { var d = monetaryOpeningDate_(row, ["Tanggal"]); return d && d <= cutoff; });
  var hppTotal = hppRows.reduce(function(sum, row) { var n = monetaryOpeningNumber_(row, ["HPP"]); return sum + (n === null ? 0 : n); }, 0);
  var hppRange = monetaryOpeningRange_(hppRows, ["Tanggal"]);
  var policyRows = typeof EXPENSE_PURCHASE_POLICY === "undefined" ? [] : EXPENSE_PURCHASE_POLICY.rows;
  var tabopsCounts = {}, tabopsAmbiguous = [], tabopsTotals = {};
  INVENTORY_POLICY_EVIDENCE_ALLOWED_CLASSIFICATIONS.forEach(function(key) { tabopsCounts[key] = 0; tabopsTotals[key] = 0; });
  data.tabops.rows.forEach(function(row) {
    var classification = classifyInventoryPolicyPurchaseEvent_({ ExpenseID: row.ID_Ops,
      PurchaseRelationship: row.PurchaseRelationship || "" }, policyRows);
    tabopsCounts[classification]++; var amount = monetaryOpeningNumber_(row, ["Nilai"]);
    if (amount !== null) tabopsTotals[classification] += amount;
    if (classification === "UNRESOLVED" && tabopsAmbiguous.length < MONETARY_OPENING_DIAGNOSTIC_POLICY.maxReferences) {
      tabopsAmbiguous.push({ id: monetaryOpeningId_(row), date: monetaryOpeningDate_(row, ["Tanggal"]), amount: amount });
    }
  });
  var purchaseHeaders = data.PurchaseEvents.headers, paymentPresent = purchaseHeaders.indexOf("PaymentStatus") !== -1;
  var purchaseActive = data.PurchaseEvents.rows.filter(monetaryOpeningActive_), materialRows = [];
  purchaseActive.forEach(function(row) { if (classifyInventoryPolicyPurchaseEvent_(row, policyRows) === "MATERIAL_PURCHASE") materialRows.push(row); });
  var materialTotal = materialRows.reduce(function(sum, row) { return sum + (monetaryOpeningNumber_(row, ["AcquisitionValue"]) || 0); }, 0);
  var correctionRefs = data.PurchaseEvents.rows.filter(function(row) {
    return ["CORRECTED", "VOIDED", "REVERSED"].indexOf(monetaryOpeningText_(row.Lifecycle || row.Status).toUpperCase()) !== -1;
  }).slice(0, 20).map(function(row) { return monetaryOpeningId_(row); });
  var inventoryRows = data.InventoryReceipt.rows.concat(data.InventoryLedger.rows), adjustmentRows = inventoryRows.filter(function(row) {
    return /ADJUST|RETURN|REVERS|WRITE.?OFF|LOSS|DISPOS|CONSUM/.test(monetaryOpeningText_(row.MovementType || row.Status).toUpperCase());
  });
  var settlementRelevant = data.Settlements.rows.filter(function(row) {
    return /PURCHASE|AP/.test(monetaryOpeningText_(row.SourceType || row.RelatedTransactionType).toUpperCase());
  });
  var accounts = {}, accountCodes = ["1100", "2000", "3000", "3200"];
  accountCodes.forEach(function(code) { accounts[code] = { debits: 0, credits: 0, net: 0, rowCount: 0,
    earliestDate: null, latestDate: null, provenance: [] }; });
  data.BalanceLedger.rows.forEach(function(row) {
    var code = monetaryOpeningText_(row.AccountCode), target = accounts[code], date = monetaryOpeningDate_(row, ["Tanggal"]);
    if (!target || !monetaryOpeningActive_(row) || !date) return;
    target.debits += monetaryOpeningNumber_(row, ["Debit"]) || 0; target.credits += monetaryOpeningNumber_(row, ["Credit"]) || 0;
    target.rowCount++; target.earliestDate = !target.earliestDate || date < target.earliestDate ? date : target.earliestDate;
    target.latestDate = !target.latestDate || date > target.latestDate ? date : target.latestDate;
    if (target.provenance.length < 20) target.provenance.push({ journalId: monetaryOpeningText_(row.JournalID), sourceId: monetaryOpeningText_(row.SourceID), date: date });
  });
  accountCodes.forEach(function(code) { accounts[code].net = accounts[code].debits - accounts[code].credits; });
  var openingByAccount = {}, duplicateMatches = [], existingPolicyId = null;
  accountCodes.forEach(function(code) { openingByAccount[code] = []; });
  data.FinanceOpeningBalances.rows.forEach(function(row) {
    var code = monetaryOpeningText_(row.AccountCode); if (!openingByAccount[code]) return;
    var amount = monetaryOpeningNumber_(row, ["Amount"]);
    if (amount === null) amount = (monetaryOpeningNumber_(row, ["Debit"]) || 0) - (monetaryOpeningNumber_(row, ["Credit"]) || 0);
    var item = { id: monetaryOpeningId_(row), amount: amount, effectiveDate: monetaryOpeningDate_(row, ["EffectiveDate"]),
      source: monetaryOpeningText_(row.Source), status: monetaryOpeningText_(row.Status), evidence: monetaryOpeningText_(row.ExternalRef),
      review: monetaryOpeningText_(row.ApprovalStatus || row.ReviewStatus) };
    openingByAccount[code].push(item);
    if (code === "1100") { duplicateMatches.push(item.id); if (/POLICY.?C/i.test(item.source + " " + item.id)) existingPolicyId = item.id; }
  });
  var capital = { contributions: 0, drawsDistributions: 0, netCapitalMovement: 0, inventorySpecificContribution: 0, provenance: [] };
  data.CapitalEquity.rows.forEach(function(row) {
    if (!monetaryOpeningActive_(row)) return; var amount = monetaryOpeningNumber_(row, ["Nominal", "Amount"]); if (amount === null) return;
    var type = monetaryOpeningText_(row.Type).toUpperCase(), inventorySpecific = /INVENTORY/.test(monetaryOpeningText_(row.Keterangan || row.Attribution).toUpperCase());
    if (type === "OWNER_CONTRIBUTION") capital.contributions += amount; else if (/DRAW|RETURN|DISTRIBUT/.test(type)) capital.drawsDistributions += amount;
    if (inventorySpecific && type === "OWNER_CONTRIBUTION") capital.inventorySpecificContribution += amount;
    if (capital.provenance.length < 20) capital.provenance.push({ id: monetaryOpeningId_(row), type: type, inventorySpecific: inventorySpecific });
  }); capital.netCapitalMovement = capital.contributions - capital.drawsDistributions;
  var captureStart = false, captureEnd = false;
  var startingRows = openingByAccount["1100"].filter(function(row) { return row.effectiveDate && row.effectiveDate <= cutoff && row.amount !== null; });
  var startingSupported = startingRows.length === 1;
  var acquisitionSufficient = data.tabops.captureStartProven === true || data.PurchaseEvents.captureStartProven === true;
  var hppSufficient = data.tabsal.captureStartProven === true;
  var adjustmentSufficient = data.InventoryReceipt.captureStartProven === true && data.InventoryLedger.captureStartProven === true;
  var gates = { startingBasisSupported: startingSupported, acquisitionCoverageSufficient: acquisitionSufficient,
    hppCoverageSufficient: hppSufficient, materialAdjustmentCoverageSufficient: adjustmentSufficient };
  var determined = gates.startingBasisSupported && gates.acquisitionCoverageSufficient && gates.hppCoverageSufficient && gates.materialAdjustmentCoverageSufficient;
  var acquisitions = materialTotal + tabopsTotals.MATERIAL_PURCHASE;
  var adjustments = adjustmentRows.reduce(function(sum, row) { return sum + (monetaryOpeningNumber_(row, ["TotalCost", "Amount", "AcquisitionValue"]) || 0); }, 0);
  var candidate = determined ? startingRows[0].amount + acquisitions - hppTotal + adjustments : null;
  if (candidate !== null && candidate < 0) { candidate = null; determined = false; }
  var counterparts = {};
  ["2000", "3000", "3200"].forEach(function(code) { counterparts[code] = { supportedAmount: null, source: null, period: null,
    attribution: "UNSUPPORTED", limitation: code === "3200" ? "NOT_A_RESIDUAL" : "DOCUMENTARY_ATTRIBUTION_REQUIRED" }; });
  var counterpartComplete = ["2000", "3000", "3200"].every(function(code) { return counterparts[code].supportedAmount !== null; });
  var duplicateStatus = duplicateMatches.length ? "DUPLICATE_EXISTS" : data.FinanceOpeningBalances.missing ? "INSUFFICIENT" : "PARTIAL";
  var exactZero = startingSupported && startingRows[0].amount === 0;
  var state = exactZero ? "D" : !determined ? "C" : counterpartComplete && duplicateStatus === "SUPPORTED_NO_DUPLICATE" ? "A" : "B";
  var gaps = [];
  if (state === "B" || state === "C") Object.keys(gates).forEach(function(key) { if (!gates[key] && gaps.length < 20) gaps.push({
    source: key === "hppCoverageSufficient" ? "tabsal" : key === "acquisitionCoverageSufficient" ? "tabops/PurchaseEvents" : key === "materialAdjustmentCoverageSufficient" ? "InventoryReceipt/InventoryLedger" : "FinanceOpeningBalances",
    fieldOrEvidence: key, dateRange: "inception through " + cutoff, measuredCoverage: "UNKNOWN", missingGap: "CAPTURE_COVERAGE_NOT_PROVEN",
    whyRequired: "Policy C monetary rollforward gate", acceptableExternalEvidence: "dated documentary source register with capture start, continuity, and cutoff reconciliation" }); });
  var coverages = {};
  MONETARY_OPENING_DIAGNOSTIC_POLICY.sources.forEach(function(name) { coverages[name] = monetaryOpeningCoverage_(name, data[name],
    name === "tabsal" || name === "tabops" ? ["Tanggal"] : ["Tanggal", "ExpenseDate", "EffectiveDate", "MovementTimestamp"], null); });
  return { tabsal: { earliestHppDate: hppRange.earliestDate, latestPreCutoffHppDate: hppRange.latestPreCutoffDate,
      hppRows: hppRows.length, hppTotal: hppTotal, monthlyHppTotals: monetaryOpeningMonthly_(hppRows, ["Tanggal"], ["HPP"]),
      dateCoverage: coverages.tabsal.status, cutoffCoverage: coverages.tabsal.cutoffCoverage, missingPeriods: null },
    tabops: { earliestDate: monetaryOpeningRange_(data.tabops.rows, ["Tanggal"]).earliestDate,
      latestPreCutoffDate: monetaryOpeningRange_(data.tabops.rows, ["Tanggal"]).latestPreCutoffDate, rowCount: data.tabops.rows.length,
      total: data.tabops.rows.reduce(function(s, r) { return s + (monetaryOpeningNumber_(r, ["Nilai"]) || 0); }, 0),
      monthlyTotalsByClassification: tabopsTotals, classificationCounts: tabopsCounts, ambiguityCount: tabopsAmbiguous.length,
      ambiguityReferences: tabopsAmbiguous, coverageAssessment: coverages.tabops.status },
    purchaseEvents: { headers: purchaseHeaders, schemaColumnCount: purchaseHeaders.length, paymentStatusPresent: paymentPresent,
      paymentClassificationInferred: false, schemaStatus: paymentPresent ? "CANONICAL" : "LEGACY_UNCLASSIFIED_NON_POSTABLE",
      earliestEventDate: monetaryOpeningRange_(data.PurchaseEvents.rows, ["ExpenseDate"]).earliestDate,
      latestPreCutoffEventDate: monetaryOpeningRange_(data.PurchaseEvents.rows, ["ExpenseDate"]).latestPreCutoffDate,
      rowCount: data.PurchaseEvents.rows.length, activeRows: purchaseActive.length, materialPurchaseRows: materialRows.length,
      materialPurchaseTotal: materialTotal, captureStartProven: captureStart, captureEndProven: captureEnd,
      correctionReversalSummary: { count: correctionRefs.length, sourceIdentifiers: correctionRefs } },
    inventory: { receipt: { rowCount: data.InventoryReceipt.rows.length, dateRange: monetaryOpeningRange_(data.InventoryReceipt.rows, ["ReceiptDate", "Tanggal"]), limitations: ["NON_AUTHORITATIVE_FOR_PHYSICAL_QUANTITY_AND_FINANCIAL_STATEMENTS"] },
      ledger: { rowCount: data.InventoryLedger.rows.length, dateRange: monetaryOpeningRange_(data.InventoryLedger.rows, ["MovementTimestamp", "Tanggal"]), limitations: ["NON_AUTHORITATIVE_FOR_PHYSICAL_QUANTITY_AND_FINANCIAL_STATEMENTS"] },
      relevantMonetaryAdjustmentTotal: adjustments, relevantCorrectionSourceIdentifiers: adjustmentRows.slice(0, 20).map(monetaryOpeningId_) },
    settlements: { rowCount: data.Settlements.rows.length, dateRange: monetaryOpeningRange_(data.Settlements.rows, ["Tanggal"]),
      relevantPurchaseApSettlementTotal: settlementRelevant.reduce(function(s, r) { return s + (monetaryOpeningNumber_(r, ["Amount"]) || 0); }, 0),
      sourceIdentifiers: settlementRelevant.slice(0, 20).map(monetaryOpeningId_), limitation: "NO_LEGACY_PAYMENT_INFERENCE" },
    balanceLedger: { accounts: accounts }, financeOpeningBalances: { accounts: openingByAccount,
      existing1100Opening: duplicateMatches.length > 0, existingPolicyCOpeningId: existingPolicyId, duplicateSourceMatches: duplicateMatches },
    capitalEquity: capital, returnsAdjustments: { purchaseReturns: "NOT_FOUND_IN_READ_SOURCES", supplierCredits: "NOT_FOUND_IN_READ_SOURCES",
      spoilageWriteoffsLosses: adjustmentRows.length ? "FOUND" : "NOT_FOUND_IN_READ_SOURCES", internalConsumption: "NOT_EXPOSED",
      inventoryAdjustment: adjustmentRows.length ? "FOUND" : "NOT_FOUND_IN_READ_SOURCES", purchaseCorrection: correctionRefs.length ? "FOUND" : "NOT_FOUND_IN_READ_SOURCES" },
    coverage: coverages, startingBasis: { supported: startingSupported, amount: startingSupported ? startingRows[0].amount : null,
      date: startingSupported ? startingRows[0].effectiveDate : null, source: startingSupported ? startingRows[0].source : null,
      provenance: startingSupported ? startingRows[0].id : null, limitation: startingSupported ? null : "DOCUMENTARY_STARTING_BASIS_NOT_SUPPORTED" },
    sufficiency: gates, candidateM: candidate, mDetermined: determined, counterparts: counterparts, state: state,
    duplicateClassification: { status: duplicateStatus, existing1100Opening: duplicateMatches.length > 0,
      existingPolicyCOpeningId: existingPolicyId, duplicateSourceMatches: duplicateMatches,
      postCutoffRelevantJournalCount: data.BalanceLedger.rows.filter(function(row) { var d = monetaryOpeningDate_(row, ["Tanggal"]); return d && d > cutoff && ["1100", "2000", "3000", "3200"].indexOf(monetaryOpeningText_(row.AccountCode)) !== -1; }).length },
    ownerGapList: gaps, safety: { readOnly: true, writeCount: 0, spreadsheetIdMatch: true, cutoff: cutoff,
      effectiveDate: MONETARY_OPENING_DIAGNOSTIC_POLICY.effectiveDate, sourcesRead: MONETARY_OPENING_DIAGNOSTIC_POLICY.sources.slice(),
      sourcesReadCount: MONETARY_OPENING_DIAGNOSTIC_POLICY.sources.length, perSourceReadCount: counts, bounded: true,
      purchaseEventsSchemaDrift: !paymentPresent, migrationExecuted: false, paymentStatusInferred: false } };
}

var TABOPS_DICTIONARY_DIAGNOSTIC_POLICY = Object.freeze({
  spreadsheetId: "1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M", cutoff: "2026-09-30", effectiveDate: "2026-10-01",
  sources: Object.freeze(["tabops", "ExpenseItems", "tabsal", "PurchaseEvents"]), maxDictionary: 100, maxReferences: 20,
  ownerFirstAcquisitionDate: "2021-01-01", overlapStart: "2026-09-17"
});

function tabopsDictionaryNormalize_(value) { return monetaryOpeningText_(value).toUpperCase(); }
function tabopsDictionaryClassify_(row) {
  var text = [row.Kategori, row.Kind, row.Group, row.Item].map(tabopsDictionaryNormalize_).join(" ");
  if (!text.trim()) return { value: "AMBIGUOUS", basis: "TAXONOMY_BLANK", confidence: "LOW" };
  if (/RAW MATERIAL|BAHAN BAKU|DIRECT_HPP|MATERIAL/.test(text)) return { value: "MATERIAL_ACQUISITION", basis: "TAXONOMY_MATERIAL", confidence: "HIGH" };
  if (/FIXED ASSET|PERALATAN|EQUIPMENT|FURNITURE/.test(text)) return { value: "FIXED_ASSET", basis: "TAXONOMY_FIXED_ASSET", confidence: "HIGH" };
  if (/OWNER|CAPITAL|EQUITY|DRAW/.test(text)) return { value: "OWNER_OR_EQUITY", basis: "TAXONOMY_OWNER_EQUITY", confidence: "HIGH" };
  if (/SALARY|RENT|UTILITY|OPERATING|KITCHEN|SUPPLY/.test(text)) return { value: "OPERATING_EXPENSE", basis: "TAXONOMY_OPERATING", confidence: "MEDIUM" };
  if (/OTHER|NON.?INVENTORY/.test(text)) return { value: "OTHER_NON_INVENTORY", basis: "TAXONOMY_NON_INVENTORY", confidence: "MEDIUM" };
  return { value: "AMBIGUOUS", basis: "TAXONOMY_NOT_DETERMINISTIC", confidence: "LOW" };
}
function tabopsDictionaryMonths_(first, last) {
  var result = [], parts = first.split("-").map(Number), end = last.split("-").map(Number), year = parts[0], month = parts[1];
  while (year < end[0] || (year === end[0] && month <= end[1])) {
    result.push(year + "-" + (month < 10 ? "0" : "") + month); month++; if (month === 13) { month = 1; year++; }
  }
  return result;
}
function tabopsDictionaryEarliest_(rows, dateName, fields) {
  return rows.map(function(row) { return { row: row, date: monetaryOpeningDate_(row, [dateName]) }; }).filter(function(item) {
    return item.date && item.date <= TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.cutoff;
  }).sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).slice(0, 10).map(function(item) {
    var out = {}; fields.forEach(function(field) { out[field] = item.row[field] == null ? null : item.row[field]; }); return out;
  });
}
function buildTabopsDictionaryBoundedReadDiagnostic_(ss) {
  if (!ss || typeof ss.getId !== "function" || String(ss.getId()) !== TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.spreadsheetId) throw new Error("TABOPS_DICTIONARY_SPREADSHEET_AUTHORITY_MISMATCH");
  var counts = {}, data = {};
  TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.sources.forEach(function(name) { data[name] = monetaryOpeningRead_(ss, name, counts); });
  var tabopsHeaders = data.tabops.headers.slice(), expenseItemsHeaders = data.ExpenseItems.headers.slice();
  ["ID_Ops", "Tanggal", "Nilai"].forEach(function(name) { if (tabopsHeaders.indexOf(name) === -1) throw new Error("TABOPS_REQUIRED_HEADER_MISSING:" + name); });
  ["ID_Ops", "Item", "Kategori", "Kind", "Group"].forEach(function(name) { if (expenseItemsHeaders.indexOf(name) === -1) throw new Error("EXPENSEITEMS_REQUIRED_HEADER_MISSING:" + name); });
  var masterBuckets = {}, blankMasterIdCount = 0;
  data.ExpenseItems.rows.forEach(function(row) { var id = monetaryOpeningText_(row.ID_Ops); if (!id) blankMasterIdCount++; else (masterBuckets[id] || (masterBuckets[id] = [])).push(row); });
  var duplicateMasterIdsAll = Object.keys(masterBuckets).filter(function(id) { return masterBuckets[id].length > 1; }).sort();
  var lookup = {}; Object.keys(masterBuckets).forEach(function(id) { if (masterBuckets[id].length === 1) lookup[id] = masterBuckets[id][0]; });
  var joinMetrics = {}, statuses = ["MATCHED", "BLANK_ID_OPS", "MASTER_NOT_FOUND", "MASTER_DUPLICATE"];
  statuses.forEach(function(status) { joinMetrics[status] = { rowCount: 0, amount: 0 }; });
  var exclusions = { BLANK_DATE: { rowCount: 0, amount: 0 }, INVALID_DATE: { rowCount: 0, amount: 0 }, POST_CUTOFF: { rowCount: 0, amount: 0 } };
  var allNonblankAmount = 0, validPreCutoffAmount = 0, invalidAmountRowCount = 0, joinedRows = [];
  data.tabops.rows.forEach(function(row) {
    var amount = monetaryOpeningNumber_(row, ["Nilai"]); if (amount === null) invalidAmountRowCount++; else allNonblankAmount += amount;
    var rawDate = monetaryOpeningText_(row.Tanggal), date = monetaryOpeningDate_(row, ["Tanggal"]), excluded = !rawDate ? "BLANK_DATE" : !date ? "INVALID_DATE" : date > TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.cutoff ? "POST_CUTOFF" : null;
    if (excluded) { exclusions[excluded].rowCount++; if (amount !== null) exclusions[excluded].amount += amount; return; }
    if (amount !== null) validPreCutoffAmount += amount;
    var id = monetaryOpeningText_(row.ID_Ops), status = !id ? "BLANK_ID_OPS" : duplicateMasterIdsAll.indexOf(id) !== -1 ? "MASTER_DUPLICATE" : lookup[id] ? "MATCHED" : "MASTER_NOT_FOUND";
    joinMetrics[status].rowCount++; if (amount !== null) joinMetrics[status].amount += amount;
    var master = status === "MATCHED" ? lookup[id] : {};
    var joined = {}; Object.keys(row).forEach(function(key) { joined[key] = row[key]; });
    ["Item", "Kategori", "Kind", "Group"].forEach(function(key) { joined[key] = status === "MATCHED" ? master[key] : null; });
    joined.joinStatus = status; joined.parsedAmount = amount; joinedRows.push(joined);
  });
  var parents = {};
  joinedRows.forEach(function(row) {
    var parentKey = [row.Kategori, row.Kind, row.Group].map(tabopsDictionaryNormalize_).join("\u001f"), itemKey = tabopsDictionaryNormalize_(row.Item), classification = row.joinStatus === "MATCHED" ? tabopsDictionaryClassify_(row).value : "AMBIGUOUS";
    var parent = parents[parentKey] || (parents[parentKey] = { rows: [], itemClasses: {} }); parent.rows.push(row); parent.itemClasses[itemKey] = classification;
  });
  var all = [], expandedParents = 0;
  Object.keys(parents).sort().forEach(function(parentKey) {
    var parent = parents[parentKey], classes = {}, itemKeys = Object.keys(parent.itemClasses); itemKeys.forEach(function(key) { classes[parent.itemClasses[key]] = true; });
    var expand = Object.keys(classes).length > 1 || (Object.keys(classes)[0] === "AMBIGUOUS" && itemKeys.length > 1); if (expand) expandedParents++;
    var groups = {}; parent.rows.forEach(function(row) { var key = expand ? tabopsDictionaryNormalize_(row.Item) : ""; (groups[key] || (groups[key] = [])).push(row); });
    Object.keys(groups).sort().forEach(function(key) {
      var rows = groups[key], representative = rows[0], proposed = representative.joinStatus === "MATCHED" ? tabopsDictionaryClassify_(representative) : { value: "AMBIGUOUS", basis: representative.joinStatus, confidence: "LOW" }, dates = monetaryOpeningRange_(rows, ["Tanggal"]);
      all.push({ Kategori: monetaryOpeningText_(representative.Kategori), Kind: monetaryOpeningText_(representative.Kind), Group: monetaryOpeningText_(representative.Group), ItemPatternOrNull: expand ? monetaryOpeningText_(representative.Item) : null,
        normalizedGroupingKey: parentKey + (expand ? "\u001f" + key : ""), transactionCount: rows.length, earliestDate: dates.earliestDate, latestPreCutoffDate: dates.latestPreCutoffDate,
        totalAmount: rows.reduce(function(sum, row) { return sum + (row.parsedAmount === null ? 0 : row.parsedAmount); }, 0), proposedClassification: proposed.value,
        classificationBasis: proposed.basis, confidence: proposed.confidence, ownerConfirmationRequired: true, sourceRows: rows });
    });
  });
  var dictionaryOverflow = all.length > TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.maxDictionary, dictionary = all.slice(0, 100).map(function(combo) { var copy = {}; Object.keys(combo).forEach(function(key) { if (key !== "sourceRows") copy[key] = combo[key]; }); return copy; });
  var ambiguousAll = []; all.forEach(function(combo) { if (combo.proposedClassification === "AMBIGUOUS") combo.sourceRows.forEach(function(row) { ambiguousAll.push({ ID_Trx: monetaryOpeningText_(row.ID_Trx), Tanggal: monetaryOpeningDate_(row, ["Tanggal"]), ID_Ops: monetaryOpeningText_(row.ID_Ops), Item: row.Item, Kategori: row.Kategori, Kind: row.Kind, Group: row.Group, Nilai: row.parsedAmount, joinStatus: row.joinStatus }); }); });
  var hppRows = data.tabsal.rows.filter(function(row) { var date = monetaryOpeningDate_(row, ["Tanggal"]); return date && date <= TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.cutoff; }), hppByMonth = {};
  hppRows.forEach(function(row) { var month = monetaryOpeningDate_(row, ["Tanggal"]).slice(0, 7), amount = monetaryOpeningNumber_(row, ["HPP"]), item = hppByMonth[month] || (hppByMonth[month] = { count: 0, total: 0, explicitZero: false }); item.count++; item.total += amount || 0; if (row.ExplicitZero === true || String(row.PeriodStatus || "").toUpperCase() === "EXPLICIT_ZERO") item.explicitZero = true; });
  var months = Object.keys(hppByMonth).sort(), firstMonth = months.length ? months[0] : null, monthly = (firstMonth ? tabopsDictionaryMonths_(firstMonth, "2026-09") : []).map(function(month) { var item = hppByMonth[month]; return item ? { month: month, status: item.explicitZero ? "EXPLICIT_ZERO" : "POPULATED", hppRowCount: item.count, hppTotal: item.total } : { month: month, status: "MISSING", hppRowCount: 0, hppTotal: null }; });
  var missing = monthly.filter(function(item) { return item.status === "MISSING"; }).map(function(item) { return item.month; }), explicitZero = monthly.filter(function(item) { return item.status === "EXPLICIT_ZERO"; }).length;
  var purchaseRows = data.PurchaseEvents.rows.filter(function(row) { var date = monetaryOpeningDate_(row, ["ExpenseDate"]); return date && date >= TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.overlapStart && date <= TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.cutoff; });
  var overlapTabops = joinedRows.filter(function(row) { return monetaryOpeningDate_(row, ["Tanggal"]) >= TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.overlapStart; }), exact = 0, probable = 0, unresolved = 0, duplicateRisk = 0;
  purchaseRows.forEach(function(event) { var date = monetaryOpeningDate_(event, ["ExpenseDate"]), amount = monetaryOpeningNumber_(event, ["AcquisitionValue"]), item = tabopsDictionaryNormalize_(event.Item || event.Material || event.ExpenseID), ref = monetaryOpeningText_(event.ExternalRef || event.SourceID); var amountMatches = overlapTabops.filter(function(row) { return monetaryOpeningDate_(row, ["Tanggal"]) === date && row.parsedAmount === amount; }); var strong = amountMatches.filter(function(row) { return (ref && monetaryOpeningText_(row.ExternalRef || row.SourceID) === ref) || (item && tabopsDictionaryNormalize_(row.Item || row.ID_Ops) === item); }); if (strong.length === 1) exact++; else if (strong.length > 1) { probable++; duplicateRisk += amount || 0; } else { unresolved++; if (amountMatches.length) duplicateRisk += amount || 0; } });
  var overlap = { overlapPeriodStart: TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.overlapStart, overlapPeriodEnd: TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.cutoff, tabopsCandidateCount: overlapTabops.length, purchaseEventCandidateCount: purchaseRows.length, exactMatchCount: exact, probableMatchCount: probable, unresolvedMatchCount: unresolved, duplicateRiskAmount: duplicateRisk, overlapStatus: purchaseRows.length && exact === purchaseRows.length ? "SUPPORTED_NO_DOUBLE_COUNT" : exact || probable ? "PARTIAL" : "UNRESOLVED" };
  var classes = ["MATERIAL_ACQUISITION", "OPERATING_EXPENSE", "FIXED_ASSET", "OWNER_OR_EQUITY", "OTHER_NON_INVENTORY", "AMBIGUOUS"], classificationTotals = {}; classes.forEach(function(value) { classificationTotals[value] = { combinationCount: 0, transactionCount: 0, amount: 0 }; }); all.forEach(function(combo) { var total = classificationTotals[combo.proposedClassification]; total.combinationCount++; total.transactionCount += combo.transactionCount; total.amount += combo.totalAmount; });
  var earliestTabops = tabopsDictionaryEarliest_(joinedRows, "Tanggal", ["ID_Trx", "Tanggal", "ID_Ops", "Item", "Kategori", "Kind", "Group", "Nilai", "joinStatus"]), earliestTabsal = tabopsDictionaryEarliest_(hppRows, "Tanggal", ["ID_Trx", "Tanggal", "Item", "Qty", "HPP"]);
  return { readOnly: true, writeCount: 0, spreadsheetIdMatch: true, sourcesRead: TABOPS_DICTIONARY_DIAGNOSTIC_POLICY.sources.slice(), sourcesReadCount: 4, perSourceReadCounts: counts,
    tabopsHeadersJson: JSON.stringify(tabopsHeaders), expenseItemsHeadersJson: JSON.stringify(expenseItemsHeaders), expenseItemsRowCount: data.ExpenseItems.rows.length, uniqueExpenseItemIdCount: Object.keys(lookup).length,
    blankMasterIdCount: blankMasterIdCount, duplicateMasterIdCount: duplicateMasterIdsAll.length, duplicateMasterIdsJson: JSON.stringify(duplicateMasterIdsAll.slice(0, 20)), duplicateMasterIdsOverflow: duplicateMasterIdsAll.length > 20, taxonomyJoinIntegrity: blankMasterIdCount === 0 && duplicateMasterIdsAll.length === 0,
    allNonblankRowCount: data.tabops.rows.length, allNonblankAmount: allNonblankAmount, validPreCutoffRowCount: joinedRows.length, validPreCutoffAmount: validPreCutoffAmount, invalidAmountRowCount: invalidAmountRowCount,
    dictionaryJson: JSON.stringify(dictionary), distinctCombinationCount: all.length, dictionaryOverflow: dictionaryOverflow, dictionaryOmittedCount: Math.max(0, all.length - dictionary.length), ambiguousReferencesJson: JSON.stringify(ambiguousAll.slice(0, 20)), ambiguousReferenceOverflow: ambiguousAll.length > 20, ambiguousReferenceOmittedCount: Math.max(0, ambiguousAll.length - 20),
    itemExpansionRequired: expandedParents > 0, expandedParentCount: expandedParents, itemExpansionReason: expandedParents ? "PARENT_ITEMS_HAVE_DIFFERENT_OR_UNRESOLVED_CLASSIFICATIONS" : "PARENT_CLASSIFICATION_CONSISTENT",
    joinMetricsJson: JSON.stringify(joinMetrics), exclusionMetricsJson: JSON.stringify(exclusions), classificationTotalsJson: JSON.stringify(classificationTotals), classificationReconcilesToValidPreCutoff: classes.reduce(function(sum, value) { return sum + classificationTotals[value].transactionCount; }, 0) === joinedRows.length,
    hppMonthMapJson: JSON.stringify(monthly), firstHppMonth: firstMonth, lastPreCutoffHppMonth: months.length ? months[months.length - 1] : null, monthCountExpected: monthly.length, populatedMonthCount: monthly.length - missing.length - explicitZero, explicitZeroMonthCount: explicitZero, missingMonthCount: missing.length, missingMonthsJson: JSON.stringify(missing), systemContinuityStatus: !monthly.length ? "UNKNOWN" : missing.length ? "PARTIAL" : "COMPLETE",
    earliestTabopsJson: JSON.stringify(earliestTabops), earliestTabsalJson: JSON.stringify(earliestTabsal), overlapPeriodStart: overlap.overlapPeriodStart, overlapPeriodEnd: overlap.overlapPeriodEnd, tabopsCandidateCount: overlap.tabopsCandidateCount, purchaseEventCandidateCount: overlap.purchaseEventCandidateCount, exactMatchCount: exact, probableMatchCount: probable, unresolvedMatchCount: unresolved, duplicateRiskAmount: duplicateRisk, overlapStatus: overlap.overlapStatus, overlapJson: JSON.stringify(overlap),
    paymentStatusPresent: data.PurchaseEvents.headers.indexOf("PaymentStatus") !== -1, paymentClassificationInferred: false, ownerAttestationStatus: "SEPARATE_OWNER_ATTESTED_NOT_SYSTEM_MEASURED", state: "C", candidateM: null, mDetermined: false, actualMReady: false };
}

function runTabopsDictionaryBoundedReadDiagnostic() {
  var report = buildTabopsDictionaryBoundedReadDiagnostic_(requireNumlockProductionSpreadsheet());
  Logger.log(JSON.stringify(report));
  return report;
}

var MONETARY_OPENING_EVIDENCE_POLICY = Object.freeze({
  spreadsheetId: MONETARY_OPENING_DIAGNOSTIC_POLICY.spreadsheetId,
  sources: Object.freeze(["tabsal", "tabops", "ExpenseItems", "PurchaseEvents", "InventoryReceipt", "InventoryLedger", "Logs"]),
  initialStart: "2021-01-01", initialEnd: "2021-01-04", monthStart: "2021-01", monthEnd: "2026-09",
  overlapStart: "2026-09-17", cutoff: "2026-09-30", maxReferences: 20
});

function monetaryOpeningEvidenceClassify_(row) {
  var key = [row.Kategori, row.Kind, row.Group].map(function(value) { return monetaryOpeningText_(value).toUpperCase(); }).join("\u001f");
  var map = {};
  map["EVENT\u001fEVENT\u001fEVENT"] = "MATERIAL_ACQUISITION";
  map["SALARY\u001fSALARY\u001fSALSAL"] = "OPERATING_EXPENSE";
  map["SUPPLY\u001fKITCHEN\u001fSALSUP"] = "MATERIAL_ACQUISITION";
  map["SUPPLY\u001fRAW MATERIAL\u001fSALSUP"] = "MATERIAL_ACQUISITION";
  map["UTILITY\u001fREPAIR\u001fUTICAP"] = "OPERATING_EXPENSE";
  map["UTILITY\u001fSUPPORT\u001fUTISUP"] = "OPERATING_EXPENSE";
  map["UTILITY\u001fUPGRADE\u001fUTICAP"] = "OPERATING_EXPENSE";
  return map[key] ? { classification: map[key], classificationStatus: "OWNER_CONFIRMED" } :
    { classification: null, classificationStatus: "UNCONFIRMED" };
}

function monetaryOpeningEvidenceBound_(rows, maximum) {
  return { rows: rows.slice(0, maximum), truncated: rows.length > maximum, totalCount: rows.length,
    returnedCount: Math.min(rows.length, maximum) };
}

function monetaryOpeningEvidenceSequence_(rows) {
  var parsed = [], supported = rows.length > 0;
  rows.forEach(function(row) {
    var id = monetaryOpeningText_(row.ID_Trx), match = /^(.*?)(\d+)$/.exec(id);
    if (!match) { supported = false; return; }
    parsed.push({ prefix: match[1], number: Number(match[2]) });
  });
  if (!supported || !parsed.length || parsed.some(function(item) { return item.prefix !== parsed[0].prefix; })) {
    return { supported: false, min: null, max: null, ranges: [] };
  }
  var present = {}; parsed.forEach(function(item) { present[item.number] = true; });
  var numbers = parsed.map(function(item) { return item.number; }), min = Math.min.apply(null, numbers), max = Math.max.apply(null, numbers), ranges = [];
  for (var cursor = min; cursor <= max && ranges.length < 20;) {
    if (present[cursor]) { cursor++; continue; }
    var start = cursor; while (cursor <= max && !present[cursor]) cursor++;
    ranges.push({ start: start, end: cursor - 1 });
  }
  return { supported: true, min: min, max: max, ranges: ranges };
}

function monetaryOpeningEvidenceAdjustment_(data) {
  var definitions = [
    ["RETURNS", /RETURN/], ["SUPPLIER_CREDITS", /SUPPLIER[_ ]?CREDIT|CREDIT[_ ]?NOTE/], ["REFUNDS", /REFUND/],
    ["SPOILAGE", /SPOIL/], ["LOSS", /(^|[_ ])LOSS($|[_ ])/], ["WRITE_OFF", /WRITE[_ -]?OFF/], ["DISPOSAL", /DISPOS/],
    ["INTERNAL_CONSUMPTION", /INTERNAL[_ ]?CONSUM|CONSUMPTION/], ["INVENTORY_ADJUSTMENT", /INVENTORY[_ ]?ADJUST|ADJUSTMENT/],
    ["PURCHASE_CORRECTION", /CORRECT|VOID|REVERS/]
  ];
  return definitions.map(function(definition) {
    var matches = [];
    ["PurchaseEvents", "InventoryReceipt", "InventoryLedger", "Logs"].forEach(function(source) {
      data[source].rows.forEach(function(row) {
        var semantic = source === "Logs" ? [row.Module, row.Action].join(" ") :
          [row.MovementType, row.Type, row.Status, row.Lifecycle, row.Action, row.SourceType].join(" ");
        if (!definition[1].test(monetaryOpeningText_(semantic).toUpperCase())) return;
        matches.push({ sourceName: source, id: monetaryOpeningId_(row), date: monetaryOpeningDate_(row,
          ["Tanggal", "ExpenseDate", "ReceiptDate", "MovementTimestamp", "Timestamp"]),
          amount: monetaryOpeningNumber_(row, ["Amount", "AcquisitionValue", "TotalCost", "Nilai"]) });
      });
    });
    var bounded = monetaryOpeningEvidenceBound_(matches, 20), amountValid = matches.some(function(row) { return row.amount !== null; });
    var explicitlySupported = definition[0] === "INVENTORY_ADJUSTMENT" || definition[0] === "PURCHASE_CORRECTION";
    return { eventType: definition[0], representationStatus: explicitlySupported ? "SUPPORTED_SOURCE" : matches.length ? "AMBIGUOUS" : "NOT_REPRESENTED",
      observedRecordCount: matches.length, observedAmount: amountValid ? matches.reduce(function(sum, row) { return sum + (row.amount || 0); }, 0) : null,
      sourceName: matches.length ? matches.map(function(row) { return row.sourceName; }).filter(function(value, index, all) { return all.indexOf(value) === index; }).join(",") : null,
      references: bounded.rows, truncated: bounded.truncated, totalCount: bounded.totalCount, returnedCount: bounded.returnedCount,
      completenessProven: false };
  });
}

function buildMonetaryOpeningEvidenceCompletionDiagnostic_(ss) {
  if (!ss || typeof ss.getId !== "function" || String(ss.getId()) !== MONETARY_OPENING_EVIDENCE_POLICY.spreadsheetId) {
    throw new Error("MONETARY_OPENING_EVIDENCE_SPREADSHEET_AUTHORITY_MISMATCH");
  }
  var counts = {}, data = {};
  MONETARY_OPENING_EVIDENCE_POLICY.sources.forEach(function(name) { data[name] = monetaryOpeningRead_(ss, name, counts); });
  var masters = {}, duplicateMasters = {};
  data.ExpenseItems.rows.forEach(function(row) { var id = monetaryOpeningText_(row.ID_Ops); if (!id) return; if (masters[id]) duplicateMasters[id] = true; else masters[id] = row; });
  var joined = data.tabops.rows.map(function(row) {
    var copy = {}; Object.keys(row).forEach(function(key) { copy[key] = row[key]; });
    var masterId = monetaryOpeningText_(row.ID_Ops), master = duplicateMasters[masterId] ? null : masters[masterId];
    ["Item", "Kategori", "Kind", "Group"].forEach(function(key) { copy[key] = master ? master[key] : null; });
    var result = master ? monetaryOpeningEvidenceClassify_(copy) : { classification: null, classificationStatus: "UNCONFIRMED" };
    copy.classification = result.classification; copy.classificationStatus = result.classificationStatus;
    copy.parsedDate = monetaryOpeningDate_(copy, ["Tanggal"]); copy.parsedAmount = monetaryOpeningNumber_(copy, ["Nilai"]); return copy;
  });
  var dates = ["2021-01-01", "2021-01-02", "2021-01-03", "2021-01-04"], salesDaily = {}, acquisitionDaily = {};
  dates.forEach(function(date) { salesDaily[date] = { date: date, transactionCount: 0, totalQty: 0, hppRowCount: 0, hppTotal: 0 };
    acquisitionDaily[date] = { date: date, materialAcquisitionTransactionCount: 0, materialAcquisitionAmount: 0 }; });
  var initialSales = [], allSales = [];
  data.tabsal.rows.forEach(function(row) {
    if (!monetaryOpeningActive_(row)) return; var date = monetaryOpeningDate_(row, ["Tanggal"]); if (!date) return;
    var qty = monetaryOpeningNumber_(row, ["Qty"]), hpp = monetaryOpeningNumber_(row, ["HPP"]);
    allSales.push({ date: date, qty: qty || 0, hpp: hpp || 0 });
    if (!salesDaily[date]) return; salesDaily[date].transactionCount++; salesDaily[date].totalQty += qty || 0;
    if (hpp !== null) { salesDaily[date].hppRowCount++; salesDaily[date].hppTotal += hpp; }
    initialSales.push({ transactionId: monetaryOpeningText_(row.ID_Trx), date: date,
      productId: row.ID_Prod == null || row.ID_Prod === "" ? null : row.ID_Prod,
      productName: row.Item == null || row.Item === "" ? null : row.Item, Qty: qty, HPP: hpp });
  });
  var initialAcquisitions = [], materialRows = [];
  joined.forEach(function(row) {
    if (row.classification !== "MATERIAL_ACQUISITION" || !row.parsedDate || row.parsedDate > MONETARY_OPENING_EVIDENCE_POLICY.cutoff) return;
    materialRows.push(row); if (!acquisitionDaily[row.parsedDate]) return;
    acquisitionDaily[row.parsedDate].materialAcquisitionTransactionCount++; acquisitionDaily[row.parsedDate].materialAcquisitionAmount += row.parsedAmount || 0;
    initialAcquisitions.push({ ID_Trx: monetaryOpeningText_(row.ID_Trx), Tanggal: row.parsedDate, ID_Ops: monetaryOpeningText_(row.ID_Ops),
      Item: row.Item, Kategori: row.Kategori, Kind: row.Kind, Group: row.Group, Nilai: row.parsedAmount, Source: row.Source, IsActive: row.IsActive });
  });
  var monthlyBuckets = {}; materialRows.forEach(function(row) { var month = row.parsedDate.slice(0, 7), item = monthlyBuckets[month] || (monthlyBuckets[month] = { count: 0, amount: 0 }); item.count++; item.amount += row.parsedAmount || 0; });
  var monthly = tabopsDictionaryMonths_(MONETARY_OPENING_EVIDENCE_POLICY.monthStart, MONETARY_OPENING_EVIDENCE_POLICY.monthEnd).map(function(month) {
    var item = monthlyBuckets[month]; return { month: month, transactionCount: item ? item.count : 0, amount: item ? item.amount : 0, status: item ? "POPULATED" : "ZERO_RECORDED" };
  }), zeroMonths = monthly.filter(function(row) { return row.status === "ZERO_RECORDED"; }).map(function(row) { return row.month; });
  var ids = {}, blankIds = 0, duplicateIds = 0; data.tabops.rows.forEach(function(row) { var id = monetaryOpeningText_(row.ID_Trx); if (!id) blankIds++; else { ids[id] = (ids[id] || 0) + 1; if (ids[id] === 2) duplicateIds++; } });
  var sequence = monetaryOpeningEvidenceSequence_(data.tabops.rows), dateRegressions = [], createdRegressions = [], createdBeforeDate = [], updatedBeforeCreated = [], previousDate = null, previousCreated = null;
  data.tabops.rows.forEach(function(row) {
    var date = monetaryOpeningDate_(row, ["Tanggal"]), created = monetaryOpeningDate_(row, ["CreatedAt"]), updated = monetaryOpeningDate_(row, ["UpdatedAt"]), id = monetaryOpeningText_(row.ID_Trx);
    if (date && previousDate && date < previousDate) dateRegressions.push({ id: id, date: date, previousDate: previousDate }); if (date) previousDate = date;
    if (created && previousCreated && created < previousCreated) createdRegressions.push({ id: id, createdAt: created, previousCreatedAt: previousCreated }); if (created) previousCreated = created;
    if (date && created && created < date) createdBeforeDate.push({ id: id, date: date, createdAt: created });
    if (created && updated && updated < created) updatedBeforeCreated.push({ id: id, createdAt: created, updatedAt: updated });
  });
  function distribution(field) { var result = {}; data.tabops.rows.forEach(function(row) { var key = monetaryOpeningText_(row[field]) || "BLANK"; result[key] = (result[key] || 0) + 1; }); return result; }
  var inactiveRows = data.tabops.rows.filter(function(row) { return !monetaryOpeningActive_(row); }), firstAcquisition = materialRows.map(function(row) { return row.parsedDate; }).sort()[0] || null;
  var preSales = firstAcquisition ? allSales.filter(function(row) { return row.date < firstAcquisition; }) : allSales.slice();
  var purchaseRows = data.PurchaseEvents.rows.filter(function(row) { var date = monetaryOpeningDate_(row, ["ExpenseDate"]); return date && date >= MONETARY_OPENING_EVIDENCE_POLICY.overlapStart && date <= MONETARY_OPENING_EVIDENCE_POLICY.cutoff; });
  var tabopsCandidates = materialRows.filter(function(row) { return row.parsedDate >= MONETARY_OPENING_EVIDENCE_POLICY.overlapStart; }), overlapRows = [], overlapTotals = { SAME_BUSINESS_EVENT: 0, DISTINCT_EVENT: 0, UNRESOLVED: 0 }, overlapAmounts = { SAME_BUSINESS_EVENT: 0, DISTINCT_EVENT: 0, UNRESOLVED: 0 }, duplicateRisk = 0;
  purchaseRows.forEach(function(event) {
    var date = monetaryOpeningDate_(event, ["ExpenseDate"]), amount = monetaryOpeningNumber_(event, ["AcquisitionValue"]), expenseId = monetaryOpeningText_(event.ExpenseID);
    var identity = tabopsCandidates.filter(function(row) { return expenseId && monetaryOpeningText_(row.ID_Ops) === expenseId; });
    var exact = identity.filter(function(row) { return row.parsedDate === date && row.parsedAmount === amount; });
    var classification = exact.length === 1 ? "SAME_BUSINESS_EVENT" : "UNRESOLVED", reason = exact.length === 1 ? "UNIQUE_EXPENSE_ID_DATE_AMOUNT" : "NO_UNIQUE_AUTHORITATIVE_CROSS_SOURCE_MATCH";
    if (!identity.length && monetaryOpeningText_(event.ExternalRef) && tabopsCandidates.every(function(row) { return monetaryOpeningText_(row.Source) !== monetaryOpeningText_(event.ExternalRef); })) { classification = "DISTINCT_EVENT"; reason = "AUTHORITATIVE_EXTERNAL_REFERENCE_CONFLICT"; }
    overlapTotals[classification]++; overlapAmounts[classification] += amount || 0; if (classification === "UNRESOLVED") duplicateRisk += amount || 0;
    overlapRows.push({ EventID: monetaryOpeningText_(event.EventID), ExpenseID: expenseId, expenseDate: date, amount: amount,
      classification: classification, reason: reason, matchedTabopsId: exact.length === 1 ? monetaryOpeningText_(exact[0].ID_Trx) : null });
  });
  var adjustment = monetaryOpeningEvidenceAdjustment_(data), boundedSales = monetaryOpeningEvidenceBound_(initialSales, 20), boundedAcquisitions = monetaryOpeningEvidenceBound_(initialAcquisitions, 20), boundedOverlap = monetaryOpeningEvidenceBound_(overlapRows, 20);
  var firstMaterialDates = materialRows.map(function(row) { return row.parsedDate; }).sort(), json = JSON.stringify;
  return { readOnly: true, writeCount: 0, spreadsheetIdMatch: true, sourcesRead: MONETARY_OPENING_EVIDENCE_POLICY.sources.slice(), sourceCount: 7, sourceCountMax: 7, perSourceReadCounts: counts,
    sourceAvailabilityJson: json(MONETARY_OPENING_EVIDENCE_POLICY.sources.map(function(name) { return { source: name, available: !data[name].missing, status: data[name].missing ? "UNAVAILABLE" : "AVAILABLE", rowCount: data[name].rows.length }; })),
    initialSalesDailyJson: json(dates.map(function(date) { return salesDaily[date]; })), initialSalesRecordsJson: json(boundedSales.rows), initialSalesRecordsTruncated: boundedSales.truncated, initialSalesRecordsTotalCount: boundedSales.totalCount, initialSalesRecordsReturnedCount: boundedSales.returnedCount,
    initialAcquisitionDailyJson: json(dates.map(function(date) { return acquisitionDaily[date]; })), initialAcquisitionRecordsJson: json(boundedAcquisitions.rows), initialAcquisitionRecordsTruncated: boundedAcquisitions.truncated, initialAcquisitionRecordsTotalCount: boundedAcquisitions.totalCount, initialAcquisitionRecordsReturnedCount: boundedAcquisitions.returnedCount,
    ownerClassificationStatus: joined.every(function(row) { return row.classificationStatus === "OWNER_CONFIRMED"; }) ? "SUPPORTED" : "PARTIAL", historicalClassifiedMaterialAcquisitionAmount: materialRows.reduce(function(sum, row) { return sum + (row.parsedAmount || 0); }, 0),
    monthlyAcquisitionMapJson: json(monthly), expectedMonthCount: monthly.length, populatedMonthCount: monthly.length - zeroMonths.length, zeroRecordedMonthCount: zeroMonths.length, zeroRecordedMonthsJson: json(zeroMonths), zeroRecordedMeaning: "NO_RECORDED_OWNER_CONFIRMED_MATERIAL_ACQUISITION;NOT_PROOF_OF_NO_REAL_WORLD_PURCHASE",
    firstRecordedMaterialAcquisitionDate: firstMaterialDates.length ? firstMaterialDates[0] : null, lastPreCutoffMaterialAcquisitionDate: firstMaterialDates.length ? firstMaterialDates[firstMaterialDates.length - 1] : null,
    tabopsRowCount: data.tabops.rows.length, uniqueIdCount: Object.keys(ids).length, blankIdCount: blankIds, duplicateIdCount: duplicateIds,
    sequenceParsingSupported: sequence.supported, sequenceMin: sequence.min, sequenceMax: sequence.max, sequenceGapCount: sequence.ranges.length, sequenceGapRangesJson: json(sequence.ranges), sequenceGapRangesTruncated: sequence.supported && sequence.ranges.length === 20,
    dateRegressionCount: dateRegressions.length, createdAtRegressionCount: createdRegressions.length, createdBeforeBusinessDateCount: createdBeforeDate.length, updatedBeforeCreatedCount: updatedBeforeCreated.length,
    dateAnomaliesJson: json({ dateRegressionExamples: dateRegressions.slice(0, 20), createdAtRegressionExamples: createdRegressions.slice(0, 20), createdBeforeBusinessDateExamples: createdBeforeDate.slice(0, 20), updatedBeforeCreatedExamples: updatedBeforeCreated.slice(0, 20) }),
    sourceDistributionJson: json(distribution("Source")), activityDistributionJson: json(distribution("IsActive")), inactiveTransactionCount: inactiveRows.length, inactiveTransactionAmount: inactiveRows.reduce(function(sum, row) { return sum + (monetaryOpeningNumber_(row, ["Nilai"]) || 0); }, 0),
    createdAtAvailableCount: data.tabops.rows.filter(function(row) { return monetaryOpeningText_(row.CreatedAt); }).length, updatedAtAvailableCount: data.tabops.rows.filter(function(row) { return monetaryOpeningText_(row.UpdatedAt); }).length,
    adjustmentEvidenceJson: json(adjustment), paymentStatusPresent: data.PurchaseEvents.headers.indexOf("PaymentStatus") !== -1, paymentClassificationInferred: false,
    overlapPeriodStart: MONETARY_OPENING_EVIDENCE_POLICY.overlapStart, overlapPeriodEnd: MONETARY_OPENING_EVIDENCE_POLICY.cutoff, tabopsMaterialCandidateCount: tabopsCandidates.length, purchaseEventCandidateCount: purchaseRows.length,
    sameBusinessEventCount: overlapTotals.SAME_BUSINESS_EVENT, distinctEventCount: overlapTotals.DISTINCT_EVENT, unresolvedEventCount: overlapTotals.UNRESOLVED,
    sameBusinessEventAmount: overlapAmounts.SAME_BUSINESS_EVENT, distinctEventAmount: overlapAmounts.DISTINCT_EVENT, unresolvedEventAmount: overlapAmounts.UNRESOLVED, duplicateRiskAmount: duplicateRisk,
    overlapRecordsJson: json(boundedOverlap.rows), overlapRecordsTruncated: boundedOverlap.truncated, overlapRecordsTotalCount: boundedOverlap.totalCount, overlapRecordsReturnedCount: boundedOverlap.returnedCount,
    taxonomyCoverage: joined.every(function(row) { return row.classificationStatus === "OWNER_CONFIRMED"; }) ? "SUPPORTED" : "PARTIAL", monthlyPresenceCoverage: monthly.length === 69 ? "SUPPORTED" : "PARTIAL",
    idIntegrity: blankIds || duplicateIds ? "PARTIAL" : "SUPPORTED", dateIntegrity: dateRegressions.length || updatedBeforeCreated.length ? "PARTIAL" : "SUPPORTED", sourceProvenance: "PARTIAL", activityHistory: "PARTIAL", externalCompleteness: "NOT_PROVABLE_FROM_SYSTEM",
    salesBeforeFirstRecordedMaterialAcquisition: preSales.length > 0, salesBeforeFirstRecordedMaterialAcquisitionCount: preSales.length, salesBeforeFirstRecordedMaterialAcquisitionQty: preSales.reduce(function(sum, row) { return sum + row.qty; }, 0), salesBeforeFirstRecordedMaterialAcquisitionHpp: preSales.reduce(function(sum, row) { return sum + row.hpp; }, 0),
    startingBasisSystemStatus: preSales.length ? "TIMING_MEASURED_PROVENANCE_UNRESOLVED" : "NO_PRE_ACQUISITION_SALES",
    startingBasisOwnerAttestationNeeded: preSales.length > 0, acquisitionAnomalyOwnerReviewNeeded: blankIds > 0 || duplicateIds > 0 || zeroMonths.length > 0 || dateRegressions.length > 0,
    adjustmentOwnerAttestationNeeded: true, overlapOwnerReviewNeeded: overlapTotals.UNRESOLVED > 0,
    physicalCountRequired: false, state: "C", mDetermined: false, actualMReady: false };
}

function runMonetaryOpeningEvidenceCompletionDiagnostic() {
  var report = buildMonetaryOpeningEvidenceCompletionDiagnostic_(requireNumlockProductionSpreadsheet());
  Logger.log(JSON.stringify(report));
  return report;
}

function runMonetaryOpeningBoundedReadDiagnostic() {
  var report = buildMonetaryOpeningBoundedReadDiagnostic_(requireNumlockProductionSpreadsheet());
  Logger.log(JSON.stringify(report));
  return report;
}
