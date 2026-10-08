// SALES_RECOGNITION_V2 U3 Recognized Sales Projection: ONE canonical
// READ-ONLY future Sales economic authority for U4 Transaction readers and
// U5 P&L (not wired here). Pure builder over pre-read sources; the composer
// performs one bounded read per sheet and never writes. Cohorts: legacy tabSal
// (canonical lifecycle authority), pre-V2 order settlement evidence chain,
// V2 sticky classification with committed artifact verification. Dedup only by
// explicit identity/lineage/provenance — never date/amount/product/customer/
// timestamp. Totals come from signed events only; ledger revenue credits are a
// non-additive reference figure. Committed V2 history is driven by persisted
// SnapshotJSON, never current masters. V2 stays PREPARED/disabled: this file
// adds no writer, no dispatcher, no activation, no schema change.
var SALES_RECOGNITION_PROJECTION = Object.freeze({
  CONTRACT_VERSION: "SALES_RECOGNITION_PROJECTION",
  READER: "RECOGNIZED_SALES_PROJECTION",
  REVISION_PRE_V2: "R0",
  SHEETS: Object.freeze(["tabsal", "Products", "Logs", "Orders", "OrderLines",
    "Payments", "Settlements", "TransactionOperations", "BalanceLedger",
    "SalesRecognitionEvents", "SalesRecognitionAudits"]),
  STATUSES: Object.freeze(["RECOGNIZED", "PENDING", "RECOVERY_REQUIRED",
    "EXCLUDED_INCOMPLETE", "INTEGRITY_CONFLICT", "NOT_RECOGNIZED"]),
  EVENT_TYPES: Object.freeze(["RECOGNITION", "REVERSAL"]),
  // Machine-readable integrity codes; no UI prose.
  ISSUES: Object.freeze({
    DUPLICATE_RECOGNITION_ID: "DUPLICATE_RECOGNITION_ID",
    DUPLICATE_SOURCE_IDENTITY: "DUPLICATE_SOURCE_IDENTITY",
    RECOGNITION_OWNER_MISSING: "RECOGNITION_OWNER_MISSING",
    INCOMPLETE_V2_RECOGNITION: "INCOMPLETE_V2_RECOGNITION",
    RECOVERY_REQUIRED_V2: "RECOVERY_REQUIRED_V2",
    RECOGNITION_AMOUNT_MISMATCH: "RECOGNITION_AMOUNT_MISMATCH",
    RECOGNITION_JOURNAL_MISMATCH: "RECOGNITION_JOURNAL_MISMATCH",
    COMMITTED_OPERATION_RECOGNITION_MISSING: "COMMITTED_OPERATION_RECOGNITION_MISSING",
    OLD_ORDER_UNPAID_EXCLUDED: "OLD_ORDER_UNPAID_EXCLUDED",
    OLD_PAYMENT_DUPLICATE_SUCCESS: "OLD_PAYMENT_DUPLICATE_SUCCESS",
    OLD_PAYMENT_AMOUNT_CONFLICT: "OLD_PAYMENT_AMOUNT_CONFLICT",
    OLD_PAYMENT_SETTLEMENT_MISSING: "OLD_PAYMENT_SETTLEMENT_MISSING",
    OLD_PAYMENT_SETTLEMENT_INVALID: "OLD_PAYMENT_SETTLEMENT_INVALID",
    OLD_PAYMENT_OPERATION_PENDING: "OLD_PAYMENT_OPERATION_PENDING",
    OLD_PAYMENT_LEDGER_MISSING: "OLD_PAYMENT_LEDGER_MISSING",
    OLD_PAYMENT_LEDGER_MISMATCH: "OLD_PAYMENT_LEDGER_MISMATCH",
    INVALID_REVERSAL_LINEAGE: "INVALID_REVERSAL_LINEAGE",
    UNKNOWN_REVERSAL_TARGET: "UNKNOWN_REVERSAL_TARGET",
    MULTIPLE_TERMINAL_REVERSALS: "MULTIPLE_TERMINAL_REVERSALS",
    REPLACEMENT_LINEAGE_COLLISION: "REPLACEMENT_LINEAGE_COLLISION",
    INCOMPATIBLE_OWNER_PROVENANCE: "INCOMPATIBLE_OWNER_PROVENANCE",
    LEGACY_ROW_INELIGIBLE: "LEGACY_ROW_INELIGIBLE",
    LEGACY_INACTIVE_EXCLUDED: "LEGACY_INACTIVE_EXCLUDED",
    COHORT_OWNERSHIP_CONFLICT: "COHORT_OWNERSHIP_CONFLICT",
    LEGACY_ORDER_PROVENANCE_AMBIGUOUS: "LEGACY_ORDER_PROVENANCE_AMBIGUOUS",
    SOURCE_READ_FAILED: "SOURCE_READ_FAILED"
  })
});

// Deterministic YYYY-MM-DD extraction from a date-only string, an ISO
// datetime, or a Date (UTC components). Blank/invalid -> "".
function salesProjectionDateKey_(value) {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? "" :
      value.getUTCFullYear() + "-" + ("0" + (value.getUTCMonth() + 1)).slice(-2) +
      "-" + ("0" + value.getUTCDate()).slice(-2);
  }
  var text = String(value === undefined || value === null ? "" : value).trim();
  var match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (match) return match[1];
  if (text) {
    var parsed = new Date(text);
    if (!isNaN(parsed.getTime())) return salesProjectionDateKey_(parsed);
  }
  return "";
}

function salesProjectionIssue_(code, sourceIdentity, cohort, detail, recovery) {
  return { code: code, sourceIdentity: String(sourceIdentity || ""),
    cohort: String(cohort || ""), detail: String(detail || ""),
    recovery: recovery === true };
}

function salesProjectionNumber_(value) {
  var number = Number(value);
  return isFinite(number) ? number : 0;
}

// ONE bounded read per sheet. Absent optional sheet = empty rows + presence
// record; any read error becomes a SOURCE_READ_FAILED issue, never a throw.
function readRecognizedSalesProjectionSources_(ss) {
  var issues = [], presence = {}, rows = {};
  SALES_RECOGNITION_PROJECTION.SHEETS.forEach(function(name) {
    var sheet = null;
    try { sheet = ss && typeof ss.getSheetByName === "function" ? ss.getSheetByName(name) : null; }
    catch (error) { sheet = null; }
    if (!sheet) {
      presence[name] = { present: false, rowCount: 0 };
      rows[name] = [];
      return;
    }
    try {
      var table = readCanonicalTable(ss, name, []);
      presence[name] = { present: true, rowCount: table.length };
      rows[name] = table;
    } catch (error) {
      presence[name] = { present: true, readFailed: true, rowCount: 0 };
      rows[name] = [];
      issues.push(salesProjectionIssue_(SALES_RECOGNITION_PROJECTION.ISSUES.SOURCE_READ_FAILED,
        name, "", error.message, true));
    }
  });
  return { presence: presence, rows: rows, issues: issues };
}

// Legacy cohort: canonical transaction data is the single lifecycle authority
// (IsActive flip = Void, new ID_Trx + Logs linkage = Correct). No second
// lifecycle implementation, no historical mutation.
function salesProjectionBuildLegacy_(sources, context) {
  var iss = SALES_RECOGNITION_PROJECTION.ISSUES;
  var issues = context.issues, transactions = context.transactions, lines = context.lines,
    seen = context.seen;
  var legacyRows = sources.rows.tabsal || [];
  if (!legacyRows.length) return;
  var active = {}, inactiveIds = {};
  legacyRows.forEach(function(row) {
    var id = String(row.ID_Trx === undefined || row.ID_Trx === null ? "" : row.ID_Trx).trim();
    if (!isCanonicalActive(row.IsActive)) {
      if (id) inactiveIds[id] = true;
      return;
    }
    if (id) active[id] = (active[id] || 0) + 1;
  });
  var canonical = null;
  try {
    canonical = buildCanonicalTransactionData({
      sales: legacyRows,
      products: sources.rows.Products || [],
      expenses: [],
      expenseItems: []
    });
  } catch (error) {
    issues.push(salesProjectionIssue_(iss.LEGACY_ROW_INELIGIBLE, "tabsal", "TABSAL_LEGACY",
      "canonical build failed: " + error.message));
    return;
  }
  var issued = {};
  function issueOnce(code, identity, detail) {
    if (issued[code + "|" + identity]) return;
    issued[code + "|" + identity] = true;
    issues.push(salesProjectionIssue_(code, identity, "TABSAL_LEGACY", detail));
  }
  canonical.records.forEach(function(record) {
    var identity = "LEGACY:" + record.id;
    var id = String(record.id || "").trim();
    if (!id || !record.isActive) return;
    if (active[id] > 1) {
      issueOnce(iss.DUPLICATE_SOURCE_IDENTITY, identity, "duplicate active rows");
      if (seen.identity[identity]) delete seen.identity[identity];
      return;
    }
    if (inactiveIds[id]) {
      issueOnce(iss.LEGACY_INACTIVE_EXCLUDED, identity, "voided canonical sibling");
      return;
    }
    if (String(id).indexOf("ORD-") === 0) {
      issueOnce(iss.LEGACY_ORDER_PROVENANCE_AMBIGUOUS, identity,
        "order-shaped legacy identity");
    }
    if (seen.identity[identity]) {
      issueOnce(iss.DUPLICATE_SOURCE_IDENTITY, identity, "duplicate source identity");
      return;
    }
    seen.identity[identity] = true;
    seen.identityCohort[identity] = "TABSAL_LEGACY";
    var dateKey = salesProjectionDateKey_(record.dateKey);
    transactions.push({ sourceIdentity: identity, cohort: "TABSAL_LEGACY", kind: "LEGACY_SALE",
      headerId: id, economicDateKey: dateKey, amount: record.amount,
      status: "RECOGNIZED", recognitionStatus: "RECOGNIZED",
      recognitionId: identity + ":R0", revisionId: "R0" });
    lines.push({ sourceIdentity: identity, cohort: "TABSAL_LEGACY",
      lineId: identity + ":1", dateKey: dateKey, productId: record.productId,
      productVariantId: "", tipe: String(record.type || ""),
      sellingPrice: salesProjectionNumber_(record.price),
      unitHpp: salesProjectionNumber_(record.hpp), recipeVersionId: "",
      qty: record.qty, amount: record.amount });
    context.events.push({ recognitionId: identity + ":R0",
      namespace: identity + ":R0", chainKey: identity,
      cohort: "TABSAL_LEGACY", eventType: "RECOGNITION", signedAmount: record.amount,
      amount: record.amount, dateKey: dateKey, revisionId: "R0", sourceIdentity: identity,
      status: "RECOGNIZED", recognizedAt: "", snapshot: null, posted: true, recovery: false });
  });
  // Eligibility failures reported by the canonical authority become one
  // machine-readable issue; voided rows without an active sibling are
  // excluded individually.
  var missing = canonical.sourceQuality.unresolvedForeignKeys || 0;
  var badDates = (canonical.sourceQuality.invalidDateRowIndexes || []).length;
  var malformed = canonical.sourceQuality.malformedRows || 0;
  if (missing || badDates || malformed) {
    issues.push(salesProjectionIssue_(iss.LEGACY_ROW_INELIGIBLE, "tabsal", "TABSAL_LEGACY",
      "missing=" + missing + ",badDates=" + badDates + ",malformed=" + malformed));
  }
  Object.keys(inactiveIds).forEach(function(id) {
    var identity = "LEGACY:" + id;
    if (seen.identity[identity]) return;
    issueOnce(iss.LEGACY_INACTIVE_EXCLUDED, identity, "IsActive=false");
  });
}

// Pre-V2 evidence chain: SUCCESS payment + POSTED CSH-SAL- settlement +
// COMMITTED PAYMENT operation where present + active PAID_SALE revenue credit
// in BalanceLedger. Fulfillment is not a gate. Date = payment PaidAt,
// revision R0. Unpaid/pending/conflicting -> issue + excluded, never Revenue.
function salesProjectionBuildPreV2_(order, context) {
  var iss = SALES_RECOGNITION_PROJECTION.ISSUES;
  var issues = context.issues, excluded = context.excluded;
  var identity = "ORDER:" + order.OrderID + ":R0";
  function reject(code, detail, status) {
    issues.push(salesProjectionIssue_(code, identity, "PRE_V2_ORDER", detail, false));
    excluded.push({ sourceIdentity: identity, cohort: "PRE_V2_ORDER",
      status: status || "EXCLUDED_INCOMPLETE", reason: code });
  }
  var payments = (context.sources.rows.Payments || []).filter(function(row) {
    return String(row.OrderID || "") === order.OrderID;
  });
  var successful = payments.filter(function(row) {
    return row.Status === "SUCCESS";
  });
  if (!successful.length) return reject(iss.OLD_ORDER_UNPAID_EXCLUDED, "no successful payment");
  if (successful.length > 1) {
    return reject(iss.OLD_PAYMENT_DUPLICATE_SUCCESS, "count=" + successful.length,
      "INTEGRITY_CONFLICT");
  }
  var payment = successful[0];
  var paymentID = String(payment.PaymentID || "");
  var amount = salesProjectionNumber_(payment.Amount);
  var orderTotal = salesProjectionNumber_(order.OrderTotal);
  if (!paymentID || amount !== orderTotal || amount <= 0) {
    return reject(iss.OLD_PAYMENT_AMOUNT_CONFLICT,
      "payment=" + amount + ",order=" + orderTotal, "INTEGRITY_CONFLICT");
  }
  var operations = (context.sources.rows.TransactionOperations || []).filter(function(row) {
    return row.OperationType === "PAYMENT" && String(row.BusinessID || "") === paymentID;
  });
  if (operations.some(function(row) { return String(row.State || "").trim() !== "COMMITTED"; })) {
    return reject(iss.OLD_PAYMENT_OPERATION_PENDING, "payment operation not COMMITTED",
      "RECOVERY_REQUIRED");
  }
  var settlements = (context.sources.rows.Settlements || []).filter(function(row) {
    return String(row.SettlementID || "") === "CSH-SAL-" + paymentID &&
      String(row.SourceID || "") === paymentID;
  });
  if (settlements.length !== 1) {
    return reject(iss.OLD_PAYMENT_SETTLEMENT_MISSING, "count=" + settlements.length,
      "RECOVERY_REQUIRED");
  }
  var settlement = settlements[0];
  // RevenueSnapshot exists on the settlement request object but is not part
  // of the persisted 21-column Settlements schema; persisted evidence is
  // Amount + the active PAID_SALE revenue credit checked below.
  if (String(settlement.Status || "") !== "POSTED" || !isCanonicalActive(settlement.IsActive) ||
      salesProjectionNumber_(settlement.Amount) !== amount ||
      String(settlement.SourceType || "") !== "SALE_SETTLEMENT") {
    return reject(iss.OLD_PAYMENT_SETTLEMENT_INVALID, "settlement evidence mismatch",
      "INTEGRITY_CONFLICT");
  }
  var ledgerCredits = (context.sources.rows.BalanceLedger || []).filter(function(row) {
    return isCanonicalActive(row.IsActive) && String(row.MovementType || "") === "PAID_SALE" &&
      String(row.SourceType || "") === "SALE_SETTLEMENT" &&
      String(row.SourceID || "") === paymentID && salesProjectionNumber_(row.Credit) > 0;
  });
  if (!ledgerCredits.length) return reject(iss.OLD_PAYMENT_LEDGER_MISSING, "no PAID_SALE credit");
  var revenueCredit = 0;
  ledgerCredits.forEach(function(row) {
    if (String(row.AccountCode || "") === "4000") revenueCredit += salesProjectionNumber_(row.Credit);
  });
  if (revenueCredit !== amount) {
    return reject(iss.OLD_PAYMENT_LEDGER_MISMATCH, "credit=" + revenueCredit + ",amount=" + amount,
      "INTEGRITY_CONFLICT");
  }
  if (context.seen.identity[identity]) {
    issues.push(salesProjectionIssue_(iss.DUPLICATE_SOURCE_IDENTITY, identity, "PRE_V2_ORDER",
      "duplicate source identity"));
    return;
  }
  context.seen.identity[identity] = true;
  context.seen.identityCohort[identity] = "PRE_V2_ORDER";
  var dateKey = salesProjectionDateKey_(payment.PaidAt);
  (context.sources.rows.OrderLines || []).filter(function(line) {
    return String(line.OrderID || "") === order.OrderID;
  }).forEach(function(line) {
    context.lines.push({ sourceIdentity: identity, cohort: "PRE_V2_ORDER",
      lineId: String(line.OrderLineID || ""), dateKey: dateKey,
      productId: String(line.ProductID || ""),
      productVariantId: String(line.ProductVariantID || ""),
      tipe: String(line.Tipe || ""),
      sellingPrice: salesProjectionNumber_(line.SellingPriceSnapshot),
      unitHpp: salesProjectionNumber_(line.UnitHppSnapshot),
      recipeVersionId: String(line.RecipeVersionID || ""),
      qty: salesProjectionNumber_(line.Qty),
      amount: salesProjectionNumber_(line.LineTotal) });
  });
  context.events.push({ recognitionId: identity,
    namespace: identity, chainKey: "ORDER:" + order.OrderID, cohort: "PRE_V2_ORDER",
    eventType: "RECOGNITION", signedAmount: amount, amount: amount, dateKey: dateKey,
    revisionId: "R0", sourceIdentity: identity, status: "RECOGNIZED", recognizedAt: "",
    snapshot: null, posted: true, recovery: false });
}

// V2 committed verification: event + COMMITTED operation + audit + SRV2J-
// journal exact linkage. SnapshotJSON drives committed history amounts.
function salesProjectionVerifyV2Event_(row, context) {
  var iss = SALES_RECOGNITION_PROJECTION.ISSUES, contract = SALES_RECOGNITION_V2_CONTRACT,
    save = SALES_RECOGNITION_V2_SAVE;
  var identity = "ORDER:" + String(row.OrderID || "") + ":" + String(row.RevisionID || "");
  var complete = contract.HEADERS.every(function(header) {
    return row[header] !== undefined && row[header] !== null;
  });
  if (!complete) {
    return { status: "EXCLUDED_INCOMPLETE", issue: salesProjectionIssue_(
      iss.INCOMPLETE_V2_RECOGNITION, identity, "V2", "event row incomplete", false) };
  }
  if (String(row.ContractVersion || "") !== contract.CONTRACT_VERSION) {
    return { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
      iss.INCOMPLETE_V2_RECOGNITION, identity, "V2", "contract version mismatch", false) };
  }
  var amount = Number(row.Amount), dateKey = salesProjectionDateKey_(row.EconomicDate);
  if (!isFinite(amount) || amount <= 0 || !dateKey || !row.RecognitionID || !row.OrderID ||
      !row.RevisionID) {
    return { status: "EXCLUDED_INCOMPLETE", issue: salesProjectionIssue_(
      iss.INCOMPLETE_V2_RECOGNITION, identity, "V2", "identity/amount/date invalid", false) };
  }
  var snapshot = null;
  try { snapshot = JSON.parse(row.SnapshotJSON); } catch (error) { snapshot = null; }
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { status: "EXCLUDED_INCOMPLETE", issue: salesProjectionIssue_(
      iss.INCOMPLETE_V2_RECOGNITION, identity, "V2", "SnapshotJSON invalid", false) };
  }
  if (String(row.PostingStatus || "").trim() !== "COMMITTED") {
    return { status: "PENDING", issue: salesProjectionIssue_(
      iss.INCOMPLETE_V2_RECOGNITION, identity, "V2", "PostingStatus=" + row.PostingStatus,
      false) };
  }
  if (salesProjectionNumber_(snapshot.orderTotal) !== amount) {
    return { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
      iss.RECOGNITION_AMOUNT_MISMATCH, identity, "V2",
      "snapshot=" + snapshot.orderTotal + ",event=" + amount, false) };
  }
  var operations = (context.sources.rows.TransactionOperations || []).filter(function(op) {
    return String(op.OperationID || "") === String(row.OperationID || "");
  });
  if (operations.length !== 1) {
    return { status: "RECOVERY_REQUIRED", issue: salesProjectionIssue_(
      iss.COMMITTED_OPERATION_RECOGNITION_MISSING, identity, "V2",
      "operation count=" + operations.length, true) };
  }
  var operation = operations[0];
  if (String(operation.OperationType || "") !== save.OPERATION_TYPE ||
      String(operation.BusinessID || "") !== String(row.OrderID || "")) {
    return { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
      iss.INCOMPLETE_V2_RECOGNITION, identity, "V2", "operation linkage mismatch", false) };
  }
  if (String(operation.State || "").trim() !== "COMMITTED") {
    return { status: "RECOVERY_REQUIRED", issue: salesProjectionIssue_(
      iss.RECOVERY_REQUIRED_V2, identity, "V2",
      "operation State=" + operation.State, true) };
  }
  var audits = (context.sources.rows.SalesRecognitionAudits || []).filter(function(audit) {
    return String(audit.AuditID || "") === String(row.AuditID || "");
  });
  if (audits.length !== 1 ||
      String(audits[0].RecognitionID || "") !== String(row.RecognitionID || "") ||
      String(audits[0].OperationID || "") !== String(row.OperationID || "") ||
      String(audits[0].OrderID || "") !== String(row.OrderID || "") ||
      String(audits[0].JournalID || "") !== String(row.RecognitionJournalID || "")) {
    return { status: "EXCLUDED_INCOMPLETE", issue: salesProjectionIssue_(
      iss.INCOMPLETE_V2_RECOGNITION, identity, "V2", "audit linkage mismatch", false) };
  }
  if (!context.orderIds[String(row.OrderID || "")]) {
    return { status: "EXCLUDED_INCOMPLETE", issue: salesProjectionIssue_(
      iss.RECOGNITION_OWNER_MISSING, identity, "V2", "owner order missing", false) };
  }
  var journal = (context.sources.rows.BalanceLedger || []).filter(function(journalRow) {
    return isCanonicalActive(journalRow.IsActive) &&
      String(journalRow.JournalID || "") === String(row.RecognitionJournalID || "") &&
      String(journalRow.SourceType || "") === save.JOURNAL_SOURCE_TYPE &&
      String(journalRow.SourceID || "") === String(row.RecognitionID || "");
  });
  var journalValid = journal.length === 2 &&
    journal.every(function(journalRow) {
      return String(journalRow.MovementType || "") === save.JOURNAL_MOVEMENT_TYPE;
    }) &&
    journal.reduce(function(sum, journalRow) {
      return sum + salesProjectionNumber_(journalRow.Debit);
    }, 0) === amount &&
    journal.reduce(function(sum, journalRow) {
      return sum + salesProjectionNumber_(journalRow.Credit);
    }, 0) === amount &&
    policyCJournalSignature_(journal) === String(row.JournalSignature || "") &&
    (!snapshot.journalSignature || snapshot.journalSignature === String(row.JournalSignature || "")) &&
    salesProjectionNumber_(snapshot.orderTotal) === amount;
  if (!journalValid) {
    return { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
      iss.RECOGNITION_JOURNAL_MISMATCH, identity, "V2", "journal linkage/amount mismatch", false) };
  }
  return { status: "RECOGNIZED", issue: null, identity: identity, amount: amount,
    dateKey: dateKey, snapshot: snapshot };
}

// V2 reversal: lineage + balanced own journal + owner; terminal-reversal and
// target rules fail closed. Operation/audit write-side belongs to U6.
function salesProjectionVerifyV2Reversal_(row, context) {
  var iss = SALES_RECOGNITION_PROJECTION.ISSUES, save = SALES_RECOGNITION_V2_SAVE;
  var identity = "ORDER:" + String(row.OrderID || "") + ":" + String(row.RevisionID || "");
  var target = String(row.ReversalOfRecognitionID || "");
  if (!target || String(row.EventType || "") !== "REVERSAL") {
    return { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
      iss.INVALID_REVERSAL_LINEAGE, identity, "V2", "reversal lineage missing", false) };
  }
  var targetRow = (context.sources.rows.SalesRecognitionEvents || []).filter(function(eventRow) {
    return String(eventRow.RecognitionID || "") === target;
  });
  if (targetRow.length !== 1 || String(targetRow[0].EventType || "") !== "RECOGNITION") {
    return { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
      iss.UNKNOWN_REVERSAL_TARGET, identity, "V2", "target=" + target, false) };
  }
  var terminal = (context.sources.rows.SalesRecognitionEvents || []).filter(function(eventRow) {
    return String(eventRow.ReversalOfRecognitionID || "") === target &&
      String(eventRow.EventType || "") === "REVERSAL";
  });
  if (terminal.length > 1) {
    return { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
      iss.MULTIPLE_TERMINAL_REVERSALS, identity, "V2", "target=" + target, false) };
  }
  var normalized = { EconomicDate: row.EconomicDate };
  var amount = Number(row.Amount), dateKey = salesProjectionDateKey_(normalized.EconomicDate);
  if (!isFinite(amount) || amount <= 0 || !dateKey) {
    return { status: "EXCLUDED_INCOMPLETE", issue: salesProjectionIssue_(
      iss.INCOMPLETE_V2_RECOGNITION, identity, "V2", "reversal amount/date invalid", false) };
  }
  if (!context.orderIds[String(row.OrderID || "")]) {
    return { status: "EXCLUDED_INCOMPLETE", issue: salesProjectionIssue_(
      iss.RECOGNITION_OWNER_MISSING, identity, "V2", "owner order missing", false) };
  }
  var journal = (context.sources.rows.BalanceLedger || []).filter(function(journalRow) {
    return isCanonicalActive(journalRow.IsActive) &&
      String(journalRow.JournalID || "") === String(row.RecognitionJournalID || "") &&
      String(journalRow.SourceType || "") === save.JOURNAL_SOURCE_TYPE &&
      String(journalRow.SourceID || "") === String(row.RecognitionID || "");
  });
  var journalValid = journal.length === 2 &&
    journal.reduce(function(sum, journalRow) {
      return sum + salesProjectionNumber_(journalRow.Debit);
    }, 0) === amount &&
    journal.reduce(function(sum, journalRow) {
      return sum + salesProjectionNumber_(journalRow.Credit);
    }, 0) === amount &&
    policyCJournalSignature_(journal) === String(row.JournalSignature || "");
  if (!journalValid) {
    return { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
      iss.RECOGNITION_JOURNAL_MISMATCH, identity, "V2", "reversal journal mismatch", false) };
  }
  return { status: "RECOGNIZED", issue: null, identity: identity, amount: amount,
    dateKey: dateKey, snapshot: null };
}

// Sticky-classification evidence: raw V2 event rows plus SAVE operations
// mapped to the intent shape (same mapping as the U2 cohort gate). Raw
// operation rows are never passed directly: they carry no OrderID binding.
function salesProjectionEvidenceContext_(sources) {
  var contract = SALES_RECOGNITION_V2_CONTRACT;
  var intents = (sources.rows.TransactionOperations || []).filter(function(op) {
    return String(op.OperationType || "") === SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE;
  }).map(function(op) {
    var activationID = "";
    try { activationID = JSON.parse(op.OperationPlan).activationID || ""; }
    catch (ignoredActivation) { activationID = ""; }
    return { OrderID: String(op.BusinessID || ""),
      ContractVersion: contract.CONTRACT_VERSION, State: op.State,
      ActivationID: activationID };
  });
  return { events: sources.rows.SalesRecognitionEvents || [], intents: intents };
}

// V2 cohort: sticky classification reused as-is; IN_PROGRESS/UNKNOWN/partial/
// tampered -> issue + excluded, NEVER a legacy fallback.
function salesProjectionBuildV2_(orders, context) {
  var contract = SALES_RECOGNITION_V2_CONTRACT, iss = SALES_RECOGNITION_PROJECTION.ISSUES;
  var V2_COMMITTED = contract.COHORTS.V2_COMMITTED, V2_PENDING = contract.COHORTS.V2_PENDING;
  var evidence = context.evidence;
  orders.forEach(function(order) {
    // Full order row is passed so sticky classification sees the legacy
    // contract markers (PaymentStatus/FulfillmentStatus) exactly as U1
    // defines them; evidence carries persisted V2 rows only.
    var verdict = classifySalesRecognitionCohort(order, evidence);
    var routedV2 = verdict.cohort === V2_COMMITTED || V2_PENDING === verdict.cohort;
    if (!routedV2) return;
    context.routed[order.OrderID] = true;
    var identity = "ORDER:" + order.OrderID + ":";
    if (verdict.cohort === V2_PENDING) {
      // pending V2 is NEVER legacy: surfaced with its own identity, excluded
      // from totals, and only its persisted event row (when present) is
      // exposed. A stalled SAVE intent surfaces as RECOVERY_REQUIRED.
      var stalled = (context.sources.rows.TransactionOperations || []).some(function(op) {
        return String(op.OperationType || "") === SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE &&
          String(op.BusinessID || "") === order.OrderID &&
          String(op.State || "").trim() !== "COMMITTED";
      });
      var pendingRows = evidence.events.filter(function(eventRow) {
        return String(eventRow.OrderID || "") === order.OrderID;
      });
      context.issues.push(salesProjectionIssue_(stalled ?
        iss.RECOVERY_REQUIRED_V2 : iss.INCOMPLETE_V2_RECOGNITION,
        identity, "V2_PENDING", "verdict=" + verdict.code, stalled));
      context.excluded.push({ sourceIdentity: identity, cohort: "V2_PENDING",
        status: stalled ? "RECOVERY_REQUIRED" : "EXCLUDED_INCOMPLETE",
        reason: stalled ? iss.RECOVERY_REQUIRED_V2 : iss.INCOMPLETE_V2_RECOGNITION });
      pendingRows.forEach(function(pendingRow) {
        var pendingIdentity = "ORDER:" + String(pendingRow.OrderID || "") + ":" +
          String(pendingRow.RevisionID || "");
        context.seen.identity[pendingIdentity] = true;
        context.seen.identityCohort[pendingIdentity] = "V2_PENDING";
        var pendingRecognitionId = String(pendingRow.RecognitionID || "");
        if (pendingRecognitionId) context.seen.recognition[pendingRecognitionId] = true;
        context.pendingEvents.push({
          identity: pendingIdentity, signedAmount: 0,
          amount: salesProjectionNumber_(pendingRow.Amount),
          dateKey: salesProjectionDateKey_(pendingRow.EconomicDate),
          recognitionId: pendingRecognitionId,
          namespace: pendingIdentity, chainKey: "ORDER:" + order.OrderID,
          cohort: "V2_PENDING", eventType: String(pendingRow.EventType || "RECOGNITION"),
          revisionId: String(pendingRow.RevisionID || ""), sourceIdentity: pendingIdentity,
          status: stalled ? "RECOVERY_REQUIRED" : "PENDING",
          recognizedAt: String(pendingRow.RecognizedAt || ""),
          snapshot: null, posted: false, recovery: false });
      });
      return;
    }
    var rows = evidence.events.filter(function(eventRow) {
      return String(eventRow.OrderID || "") === order.OrderID;
    });
    var results = [];
    rows.forEach(function(eventRow) {
      var eventType = String(eventRow.EventType || "");
      var result = eventType === "REVERSAL" ?
        salesProjectionVerifyV2Reversal_(eventRow, context) :
        eventType === "RECOGNITION" ? salesProjectionVerifyV2Event_(eventRow, context) :
        { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
          iss.INCOMPLETE_V2_RECOGNITION, identity, "V2", "EventType=" + eventType, false) };
      var recognitionId = String(eventRow.RecognitionID || "");
      if (recognitionId && context.seen.recognition[recognitionId]) {
        result = { status: "INTEGRITY_CONFLICT", issue: salesProjectionIssue_(
          iss.DUPLICATE_RECOGNITION_ID, recognitionId, "V2", "duplicate RecognitionID", false) };
      }
      if (recognitionId) context.seen.recognition[recognitionId] = true;
      if (result.issue) {
        context.issues.push(result.issue);
        context.excluded.push({ sourceIdentity: result.identity || identity,
          cohort: "V2_COMMITTED", status: result.status, reason: result.issue.code });
      }
      results.push({ row: eventRow, result: result });
    });
    // Replacement lineage: exactly one replacement may claim an OriginalID.
    var originalIds = {};
    rows.forEach(function(eventRow) {
      var original = String(eventRow.OriginalID || "");
      if (!original) return;
      originalIds[original] = (originalIds[original] || 0) + 1;
    });
    Object.keys(originalIds).forEach(function(original) {
      if (originalIds[original] > 1) {
        context.issues.push(salesProjectionIssue_(iss.REPLACEMENT_LINEAGE_COLLISION,
          identity + original, "V2_COMMITTED", "multiple replacements", false));
      }
    });
    results.forEach(function(entry) {
      var result = entry.result;
      if (result.status !== "RECOGNIZED") return;
      var row = entry.row;
      var eventIdentity = result.identity;
      if (context.seen.identity[eventIdentity]) {
        context.issues.push(salesProjectionIssue_(iss.DUPLICATE_SOURCE_IDENTITY,
          eventIdentity, "V2_COMMITTED", "duplicate event identity"));
        return;
      }
      context.seen.identity[eventIdentity] = true;
      context.seen.identityCohort[eventIdentity] = "V2_COMMITTED";
      var signedAmount = String(row.EventType || "") === "REVERSAL" ? -result.amount :
        result.amount;
      var snapshotLines = result.snapshot && Array.isArray(result.snapshot.lines) ?
        result.snapshot.lines : [];
      snapshotLines.forEach(function(line, index) {
        var orderLineId = String(line.OrderLineID || "");
        // ProductID/Tipe live on the persisted OrderLines row, not inside
        // SnapshotJSON; join by OrderLineID so analytical product identity
        // survives without re-reading masters.
        var orderLine = null;
        (context.sources.rows.OrderLines || []).some(function(candidate) {
          if (String(candidate.OrderLineID || "") !== orderLineId || !orderLineId) return false;
          orderLine = candidate;
          return true;
        });
        context.lines.push({ sourceIdentity: eventIdentity, cohort: "V2_COMMITTED",
          lineId: orderLineId || eventIdentity + ":L" + (index + 1),
          dateKey: result.dateKey,
          productId: orderLine ? String(orderLine.ProductID || "") : "",
          productVariantId: String(line.ProductVariantID || ""),
          tipe: orderLine ? String(orderLine.Tipe || "") : "",
          sellingPrice: salesProjectionNumber_(line.SellingPriceSnapshot),
          unitHpp: salesProjectionNumber_(line.UnitHppSnapshot),
          recipeVersionId: String(line.RecipeVersionID || ""),
          qty: salesProjectionNumber_(line.Qty),
          amount: salesProjectionNumber_(line.LineTotal) });
      });
      context.events.push({ recognitionId: String(row.RecognitionID || ""),
        namespace: eventIdentity, chainKey: "ORDER:" + String(row.OrderID || ""),
        cohort: "V2_COMMITTED", eventType: String(row.EventType || ""),
        signedAmount: signedAmount, amount: result.amount, dateKey: result.dateKey,
        revisionId: String(row.RevisionID || ""), sourceIdentity: eventIdentity,
        originalId: String(row.OriginalID || ""),
        reversalOfRecognitionId: String(row.ReversalOfRecognitionID || ""),
        replacementId: String(row.ReplacementID || ""),
        status: "RECOGNIZED", recognizedAt: String(row.RecognizedAt || ""),
        snapshot: result.snapshot, posted: true, recovery: false });
    });
  });
  // COMMITTED SAVE operation with no recognition event -> recovery issue.
  (context.sources.rows.TransactionOperations || []).forEach(function(operation) {
    if (String(operation.OperationType || "") !== SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE) return;
    var businessID = String(operation.BusinessID || "");
    if (String(operation.State || "").trim() !== "COMMITTED") {
      // Persisted but uncommitted SAVE intent: recovery evidence surfaced even
      // when the Order row does not exist yet (crash before batch).
      if (!businessID || context.routed[businessID]) return;
      context.routed[businessID] = true;
      context.issues.push(salesProjectionIssue_(iss.RECOVERY_REQUIRED_V2,
        "ORDER:" + businessID + ":", "V2_PENDING",
        "State=" + operation.State, true));
      context.excluded.push({ sourceIdentity: "ORDER:" + businessID + ":",
        cohort: "V2_PENDING", status: "RECOVERY_REQUIRED",
        reason: iss.RECOVERY_REQUIRED_V2 });
      return;
    }
    var hasEvent = evidence.events.some(function(eventRow) {
      return String(eventRow.OrderID || "") === businessID &&
        String(eventRow.EventType || "") === "RECOGNITION";
    });
    if (!hasEvent) {
      context.issues.push(salesProjectionIssue_(
        iss.COMMITTED_OPERATION_RECOGNITION_MISSING, businessID, "V2_COMMITTED",
        String(operation.RequestKey || ""), true));
    }
  });
}

// Pure builder over pre-read sources. One header adapter (transactions) per
// source record; events are the ONLY additive economic surface.
function buildRecognizedSalesProjection_(sources) {
  var iss = SALES_RECOGNITION_PROJECTION.ISSUES, contract = SALES_RECOGNITION_V2_CONTRACT;
  var issues = [], excluded = [], events = [], transactions = [], lines = [];
  (sources.issues || []).forEach(function(issue) { issues.push(issue); });
  var context = { sources: sources, issues: issues, excluded: excluded, events: events,
    transactions: transactions, lines: lines, pendingEvents: [],
    seen: { identity: {}, identityCohort: {}, recognition: {} },
    routed: {}, orderIds: {},
    evidence: salesProjectionEvidenceContext_(sources) };
  var orders = sources.rows.Orders || [];
  orders.forEach(function(order) {
    if (order.OrderID) context.orderIds[String(order.OrderID)] = true;
  });
  salesProjectionBuildLegacy_(sources, context);
  // Cohort ownership conflict: a legacy identity reused as an order identity.
  orders.forEach(function(order) {
    var legacyIdentity = "LEGACY:" + String(order.OrderID || "");
    if (context.seen.identity[legacyIdentity]) {
      issues.push(salesProjectionIssue_(iss.COHORT_OWNERSHIP_CONFLICT,
        "ORDER:" + order.OrderID, "TABSAL_LEGACY", "legacy identity reused by order", false));
    }
  });
  salesProjectionBuildV2_(orders, context);
  orders.forEach(function(order) {
    var verdict = classifySalesRecognitionCohort(order, context.evidence);
    var cohort = verdict.cohort;
    var identity = "ORDER:" + order.OrderID + ":";
    if (cohort === contract.COHORTS.INCONSISTENT || cohort === contract.COHORTS.UNKNOWN) {
      issues.push(salesProjectionIssue_(iss.COHORT_OWNERSHIP_CONFLICT, identity, cohort,
        "verdict=" + verdict.code, cohort === contract.COHORTS.INCONSISTENT));
      excluded.push({ sourceIdentity: identity, cohort: cohort,
        status: cohort === contract.COHORTS.INCONSISTENT ? "RECOVERY_REQUIRED" :
          "EXCLUDED_INCOMPLETE", reason: verdict.code });
    }
    // Pre-V2 evidence chain runs BEFORE the header adapter so adapter status
    // reflects cohort recognition state.
    if (cohort === contract.COHORTS.PRE_V2_ORDER && !context.routed[order.OrderID]) {
      salesProjectionBuildPreV2_(order, context);
    }
    // ONE header adapter per order regardless of recognition state.
    if (!transactions.some(function(entry) {
      return entry.kind === "ORDER" && entry.headerId === order.OrderID;
    })) {
      var recognizedEvent = null;
      events.forEach(function(event) {
        if (!recognizedEvent && event.chainKey === "ORDER:" + order.OrderID &&
            event.status === "RECOGNIZED") recognizedEvent = event;
      });
      transactions.push({ sourceIdentity: "ORDER:" + order.OrderID,
        cohort: cohort, kind: "ORDER", headerId: order.OrderID,
        economicDateKey: recognizedEvent ? recognizedEvent.dateKey :
          salesProjectionDateKey_(order.CreatedAt),
        amount: salesProjectionNumber_(order.OrderTotal),
        hppTotalSnapshot: salesProjectionNumber_(order.HppTotalSnapshot),
        orderType: String(order.OrderType || ""),
        recognitionId: recognizedEvent ? recognizedEvent.recognitionId : "",
        revisionId: recognizedEvent ? recognizedEvent.revisionId : "",
        paymentStatus: order.PaymentStatus, fulfillmentStatus: order.FulfillmentStatus,
        status: recognizedEvent ? "RECOGNIZED" : "NOT_RECOGNIZED",
        recognitionStatus: recognizedEvent ? "RECOGNIZED" : "NOT_RECOGNIZED" });
    }
    (sources.rows.OrderLines || []).filter(function(line) {
      return String(line.OrderID || "") === order.OrderID;
    }).forEach(function(line) {
      if (lines.some(function(entry) {
        return entry.lineId === String(line.OrderLineID || "");
      })) return;
      lines.push({ sourceIdentity: "ORDER:" + order.OrderID, cohort: cohort,
        lineId: String(line.OrderLineID || ""),
        dateKey: salesProjectionDateKey_(order.CreatedAt),
        productId: String(line.ProductID || ""),
        productVariantId: String(line.ProductVariantID || ""),
        tipe: String(line.Tipe || ""),
        sellingPrice: salesProjectionNumber_(line.SellingPriceSnapshot),
        unitHpp: salesProjectionNumber_(line.UnitHppSnapshot),
        recipeVersionId: String(line.RecipeVersionID || ""),
        qty: salesProjectionNumber_(line.Qty),
        amount: salesProjectionNumber_(line.LineTotal) });
    });
  });
  // Pending V2 events surfaced after header adapters (never as revenue).
  context.pendingEvents.forEach(function(pending) {
    events.push(pending);
    context.seen.identity[pending.identity] = true;
  });
  // Events whose owner order does not exist: surfaced, never routed.
  (sources.rows.SalesRecognitionEvents || []).forEach(function(row) {
    var owner = String(row.OrderID || "");
    if (!owner || context.orderIds[owner]) return;
    var ghostIdentity = "ORDER:" + owner + ":" + String(row.RevisionID || "");
    if (context.seen.identity[ghostIdentity]) return;
    context.seen.identity[ghostIdentity] = true;
    issues.push(salesProjectionIssue_(iss.RECOGNITION_OWNER_MISSING, ghostIdentity,
      "V2", "owner order missing", false));
  });
  // Explicit provenance/ownership conflicts across cohorts.
  events.forEach(function(event) {
    if (event.cohort !== "V2_COMMITTED") return;
    var owner = String(event.chainKey || "").replace(/^ORDER:/, "");
    if (owner && context.seen.identityCohort["LEGACY:" + owner] === "TABSAL_LEGACY") {
      issues.push(salesProjectionIssue_(iss.INCOMPATIBLE_OWNER_PROVENANCE,
        event.namespace, "V2_COMMITTED", "owner claimed by legacy cohort", false));
    }
  });
  // Dedup happens ONLY through context.seen.identity / seen.recognition
  // (explicit sourceIdentity, namespace, and RecognitionID keys). Date,
  // amount, product, customer, and timestamp are never dedup keys: identical
  // economics under different identities are preserved as separate records.
  var totals = { recognizedRevenue: 0, eventCount: events.length, recognizedEventCount: 0,
    byPeriod: {}, periods: [], ledgerRevenueCredits: 0 };
  var ledgerCredits = 0;
  (sources.rows.BalanceLedger || []).forEach(function(row) {
    if (!isCanonicalActive(row.IsActive)) return;
    var movement = String(row.MovementType || "");
    if (movement !== "PAID_SALE" && movement !== "SALES_RECOGNITION") return;
    if (String(row.AccountCode || "") !== "4000") return;
    ledgerCredits += salesProjectionNumber_(row.Credit);
  });
  var projection = { events: events, lines: lines };
  projection.events.forEach(function(event) {
    if (event.status !== "RECOGNIZED") return;
    totals.recognizedEventCount += 1;
    totals.recognizedRevenue += event.signedAmount;
    var period = String(event.dateKey || "").slice(0, 7);
    if (!period) return;
    totals.byPeriod[period] = (totals.byPeriod[period] || 0) + event.signedAmount;
  });
  Object.keys(totals.byPeriod).sort().forEach(function(period) {
    totals.periods.push(period);
    if (totals.byPeriod[period] === 0) delete totals.byPeriod[period];
  });
  totals.ledgerRevenueCredits = ledgerCredits;
  // Active view: latest RECOGNIZED event per chain (ReadModel ordering);
  // economic history stays immutable.
  var byChain = {}, chainOrder = [];
  var economicEvents = events;
  economicEvents.forEach(function(event) {
    if (event.status !== "RECOGNIZED") return;
    if (!Object.prototype.hasOwnProperty.call(byChain, event.chainKey)) {
      byChain[event.chainKey] = event;
      chainOrder.push(event.chainKey);
      return;
    }
    var current = byChain[event.chainKey];
    var currentStamp = String(current.recognizedAt || "") + "|" + current.recognitionId;
    var candidateStamp = String(event.recognizedAt || "") + "|" + event.recognitionId;
    if (candidateStamp > currentStamp) byChain[event.chainKey] = event;
  });
  var activeEvents = chainOrder.map(function(chainKey) { return byChain[chainKey]; });
  var activeTotals = { recognizedRevenue: 0, eventCount: activeEvents.length, byPeriod: {} };
  activeEvents.forEach(function(event) {
    activeTotals.recognizedRevenue += event.signedAmount;
    var period = String(event.dateKey || "").slice(0, 7);
    if (!period) return;
    activeTotals.byPeriod[period] = (activeTotals.byPeriod[period] || 0) + event.signedAmount;
  });
  var recoveryIssues = issues.filter(function(issue) { return issue.recovery; });
  return {
    contract: SALES_RECOGNITION_PROJECTION.CONTRACT_VERSION,
    reader: SALES_RECOGNITION_PROJECTION.READER,
    sources: sources.presence || {},
    events: events,
    transactions: transactions,
    lines: lines,
    quality: { issues: issues, recoveryIssues: recoveryIssues, excluded: excluded },
    activeView: { events: activeEvents, totals: activeTotals },
    totals: totals
  };
}

// Read-only composer: one bounded read pass, then the pure builder. Never
// writes to any surface.
function buildRecognizedSalesProjectionFromSpreadsheet_(ss) {
  return buildRecognizedSalesProjection_(readRecognizedSalesProjectionSources_(ss));
}
