var TRANSACTION_LIFECYCLE = Object.freeze({
  MODULE: "TransactionLifecycle",
  MAX_REASON_LENGTH: 500
});

function requireLifecycleReason(value) {
  var reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < 3 || reason.length > TRANSACTION_LIFECYCLE.MAX_REASON_LENGTH || !/[A-Za-z0-9]/.test(reason)) {
    throw canonicalEntryError("INVALID_VOID_REASON", "Reason must be meaningful and no more than 500 characters.", "reason");
  }
  return reason;
}

function canonicalLifecycleLedgerSpec(transactionId) {
  var id = requireCanonicalEntryText(transactionId, "TRANSACTION_NOT_FOUND", "Transaction was not found.", "transactionId");
  if (id.indexOf("SAL-") === 0) return { type: "SALES", sheetName: "tabsal", headers: CANONICAL_ENTRY.SALES_HEADERS };
  if (id.indexOf("OPS-") === 0) return { type: "EXPENSE", sheetName: "tabops", headers: CANONICAL_ENTRY.EXPENSE_HEADERS };
  throw canonicalEntryError("TRANSACTION_NOT_FOUND", "Transaction was not found.", "transactionId");
}

function findCanonicalLifecycleRecord(ss, transactionId) {
  var spec = canonicalLifecycleLedgerSpec(transactionId), sheet = ss.getSheetByName(spec.sheetName);
  requireCanonicalHeaders(sheet, spec.headers);
  var values = sheet.getDataRange().getValues(), found = null;
  for (var index = 1; index < values.length; index++) {
    if (String(values[index][0]) !== String(transactionId)) continue;
    if (found) throw canonicalEntryError("WRITE_FAILED", "Duplicate canonical transaction ID detected.", null);
    found = { spec: spec, sheet: sheet, rowNumber: index + 1, values: values[index].slice() };
  }
  if (!found) throw canonicalEntryError("TRANSACTION_NOT_FOUND", "Transaction was not found.", "transactionId");
  return found;
}

function canonicalLifecycleMutability(record) {
  var source = String(record.values[record.spec.type === "SALES" ? 7 : 4] || "").trim();
  var active = isCanonicalActive(record.values[record.spec.type === "SALES" ? 8 : 5]);
  var reason = source !== CANONICAL_ENTRY.SOURCE
    ? (source === "LEGACY_GOOGLE" ? "LEGACY_TRANSACTION" : "HISTORICAL_TRANSACTION")
    : (!active ? "ALREADY_VOIDED" : null);
  return { source: source, isActive: active, canCorrect: !reason, canVoid: !reason, immutableReason: reason };
}

function requireMutableLifecycleRecord(record) {
  var mutability = canonicalLifecycleMutability(record);
  if (mutability.source !== CANONICAL_ENTRY.SOURCE) {
    throw canonicalEntryError("TRANSACTION_READ_ONLY", "Historical transactions are read-only.", "transactionId");
  }
  if (!mutability.isActive) {
    throw canonicalEntryError("TRANSACTION_ALREADY_VOIDED", "Transaction is already voided.", "transactionId");
  }
  return mutability;
}

function lifecycleAuditRelations(ss, transactionId) {
  var sheet = ss.getSheetByName("Logs"), relation = { originalId: null, replacementId: null };
  requireCanonicalHeaders(sheet, CANONICAL_ENTRY.LOG_HEADERS);
  sheet.getDataRange().getValues().slice(1).forEach(function(row) {
    if (String(row[3]) !== TRANSACTION_LIFECYCLE.MODULE) return;
    var metadata;
    try { metadata = JSON.parse(String(row[8] || "{}")); } catch (error) { return; }
    if (String(row[5]) === String(transactionId)) {
      if (metadata.originalId) relation.originalId = String(metadata.originalId);
      if (metadata.replacementId) relation.replacementId = String(metadata.replacementId);
    }
  });
  return relation;
}

function normalizeCanonicalLifecycleDetail(record, ss) {
  var row = record.values, sales = record.spec.type === "SALES", mutability = canonicalLifecycleMutability(record);
  var detail = sales ? {
    id: String(row[0]), date: row[1], source: mutability.source, isActive: mutability.isActive,
    productId: String(row[2]), type: String(row[3]), qty: Number(row[4]), unitHPP: Number(row[5]), unitPrice: Number(row[6]),
    cogs: Number(row[4]) * Number(row[5]), revenue: Number(row[4]) * Number(row[6]),
    margin: Number(row[4]) * (Number(row[6]) - Number(row[5])),
    createdAt: row[9] || null, createdBy: String(row[10] || ""), updatedAt: row[11] || null, updatedBy: String(row[12] || "")
  } : {
    id: String(row[0]), date: row[1], source: mutability.source, isActive: mutability.isActive,
    expenseItemId: String(row[2]), amount: Number(row[3]), createdAt: row[6] || null,
    createdBy: String(row[7] || ""), updatedAt: row[8] || null, updatedBy: String(row[9] || "")
  };
  var masters = sales
    ? readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"])
    : readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"]);
  var master = buildCanonicalMasterMap(masters, sales ? "ID_Prod" : "ID_Ops", sales ? "Products" : "ExpenseItems")[sales ? detail.productId : detail.expenseItemId];
  if (!master) throw canonicalEntryError("WRITE_FAILED", "Transaction master data could not be resolved.", null);
  if (sales) { detail.product = String(master.Produk); detail.category = String(master.Kategori); detail.kind = String(master.Kind); }
  else { detail.item = String(master.Item); detail.category = String(master.Kategori); detail.kind = String(master.Kind); detail.group = String(master.Group); }
  detail.status = mutability.isActive ? "ACTIVE" : "VOIDED";
  detail.canCorrect = mutability.canCorrect; detail.canVoid = mutability.canVoid; detail.immutableReason = mutability.immutableReason;
  var relation = lifecycleAuditRelations(ss, detail.id);
  detail.originalId = relation.originalId; detail.replacementId = relation.replacementId;
  return detail;
}

function serializeCanonicalLifecycleTransport(value) {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(function(item) { return serializeCanonicalLifecycleTransport(item); });
  }
  if (value && typeof value === "object") {
    var serialized = {};
    Object.keys(value).forEach(function(key) {
      serialized[key] = serializeCanonicalLifecycleTransport(value[key]);
    });
    return serialized;
  }
  if (typeof value === "undefined" || (typeof value === "number" && !isFinite(value))) return null;
  return value;
}

function canonicalLifecycleSuccess(data) {
  return { success: true, data: serializeCanonicalLifecycleTransport(data) };
}

function getCanonicalTransactionDetail(transactionId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    return canonicalLifecycleSuccess(normalizeCanonicalLifecycleDetail(findCanonicalLifecycleRecord(ss, transactionId), ss));
  } catch (error) { return canonicalEntryFailure(error); }
}

function getCanonicalTransactionDetails(transactionIds) {
  try {
    var ids = Array.isArray(transactionIds) ? transactionIds.slice(0, 50) : [];
    var unique = {}, ordered = [];
    ids.forEach(function(id) {
      var value = String(id || "").trim();
      if (!value || unique[value]) return;
      canonicalLifecycleLedgerSpec(value);
      unique[value] = true;
      ordered.push(value);
    });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var salesRows = ordered.some(function(id) { return id.indexOf("SAL-") === 0; })
      ? readCanonicalTable(ss, "tabsal", CANONICAL_ENTRY.SALES_HEADERS) : [];
    var expenseRows = ordered.some(function(id) { return id.indexOf("OPS-") === 0; })
      ? readCanonicalTable(ss, "tabops", CANONICAL_ENTRY.EXPENSE_HEADERS) : [];
    var products = salesRows.length
      ? buildCanonicalMasterMap(readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"]), "ID_Prod", "Products") : {};
    var expenses = expenseRows.length
      ? buildCanonicalMasterMap(readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"]), "ID_Ops", "ExpenseItems") : {};
    var ledgers = {};
    salesRows.concat(expenseRows).forEach(function(row) {
      var id = String(row.ID_Trx || "");
      if (unique[id]) ledgers[id] = row;
    });
    var relations = {};
    readCanonicalTable(ss, "Logs", CANONICAL_ENTRY.LOG_HEADERS).forEach(function(row) {
      var id = String(row.RecordID || "");
      if (!unique[id] || String(row.Module) !== TRANSACTION_LIFECYCLE.MODULE) return;
      var metadata;
      try { metadata = JSON.parse(String(row.Metadata || "{}")); } catch (error) { return; }
      relations[id] = relations[id] || { originalId: null, replacementId: null };
      if (metadata.originalId) relations[id].originalId = String(metadata.originalId);
      if (metadata.replacementId) relations[id].replacementId = String(metadata.replacementId);
    });
    var details = ordered.map(function(id) {
      var row = ledgers[id];
      if (!row) throw canonicalEntryError("TRANSACTION_NOT_FOUND", "Transaction was not found.", "transactionId");
      var sales = id.indexOf("SAL-") === 0;
      var source = String(row.Source || "").trim();
      var active = isCanonicalActive(row.IsActive);
      var mutable = source === CANONICAL_ENTRY.SOURCE && active;
      var master = sales ? products[String(row.ID_Prod)] : expenses[String(row.ID_Ops)];
      if (!master) throw canonicalEntryError("WRITE_FAILED", "Transaction master data could not be resolved.", null);
      var detail = sales ? {
        id: id, date: row.Tanggal, source: source, isActive: active,
        productId: String(row.ID_Prod), product: String(master.Produk), category: String(master.Kategori), kind: String(master.Kind),
        type: String(row.Tipe), qty: Number(row.Qty), unitHPP: Number(row.HPP), unitPrice: Number(row.HJ),
        cogs: Number(row.Qty) * Number(row.HPP), revenue: Number(row.Qty) * Number(row.HJ),
        margin: Number(row.Qty) * (Number(row.HJ) - Number(row.HPP)),
        createdAt: row.CreatedAt || null, createdBy: String(row.CreatedBy || ""), updatedAt: row.UpdatedAt || null, updatedBy: String(row.UpdatedBy || "")
      } : {
        id: id, date: row.Tanggal, source: source, isActive: active,
        expenseItemId: String(row.ID_Ops), item: String(master.Item), category: String(master.Kategori), kind: String(master.Kind), group: String(master.Group),
        amount: Number(row.Nilai), createdAt: row.CreatedAt || null, createdBy: String(row.CreatedBy || ""),
        updatedAt: row.UpdatedAt || null, updatedBy: String(row.UpdatedBy || "")
      };
      detail.status = active ? "ACTIVE" : "VOIDED";
      detail.canCorrect = mutable;
      detail.canVoid = mutable;
      detail.immutableReason = source !== CANONICAL_ENTRY.SOURCE ? (source === "LEGACY_GOOGLE" ? "LEGACY_TRANSACTION" : "HISTORICAL_TRANSACTION") : (!active ? "ALREADY_VOIDED" : null);
      var relation = relations[id] || { originalId: null, replacementId: null };
      detail.originalId = relation.originalId;
      detail.replacementId = relation.replacementId;
      return detail;
    });
    return canonicalLifecycleSuccess({ revision: typeof getDashboardCacheRevision === "function" ? getDashboardCacheRevision() : "0", details: details });
  } catch (error) { return canonicalEntryFailure(error); }
}

function buildLifecycleReplacement(payload, original, ss, timestamp) {
  var suppliedType = payload && typeof payload.transactionType === "string" ? payload.transactionType.trim() : original.spec.type;
  if (suppliedType !== original.spec.type) {
    throw canonicalEntryError("INVALID_TRANSACTION_TYPE", "Correction cannot change transaction type.", "transactionType");
  }
  var context = canonicalEntryContext(ss, timestamp, original.spec.type);
  return original.spec.type === "SALES" ? prepareCanonicalSalesEntry(payload, context) : prepareCanonicalExpenseEntry(payload, context);
}

function lifecycleFinancialSummary(type, detail) {
  return type === "SALES" ? { revenue: detail.revenue, cogs: detail.cogs, margin: detail.margin } : { amount: detail.amount };
}

function previewCanonicalTransactionCorrection(payload) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), original = findCanonicalLifecycleRecord(ss, payload && payload.transactionId);
    requireMutableLifecycleRecord(original); requireLifecycleReason(payload && payload.reason);
    var timestamp = new Date(), before = normalizeCanonicalLifecycleDetail(original, ss);
    var after = buildLifecycleReplacement(payload, original, ss, timestamp);
    var beforeFinancial = lifecycleFinancialSummary(original.spec.type, before);
    var afterFinancial = lifecycleFinancialSummary(original.spec.type, after), delta = {};
    Object.keys(afterFinancial).forEach(function(key) { delta[key] = afterFinancial[key] - beforeFinancial[key]; });
    return canonicalLifecycleSuccess({ transactionType: original.spec.type, before: before,
      after: after, delta: delta, requiredReason: true });
  } catch (error) { return canonicalEntryFailure(error); }
}

function appendLifecycleAudit(logs, timestamp, action, recordId, metadata, runtime) {
  var rowNumber = logs.getLastRow() + 1;
  var values = ["LOG-LIFECYCLE-" + runtime.uuid(), timestamp, "INFO", TRANSACTION_LIFECYCLE.MODULE,
    action, recordId, CANONICAL_ENTRY.USER, "Canonical transaction lifecycle recorded.", JSON.stringify(metadata)];
  logs.getRange(rowNumber, 1, 1, values.length).setValues([values]); runtime.flush();
  if (!canonicalEntryRowMatches(logs.getRange(rowNumber, 1, 1, values.length).getValues()[0], values)) {
    if (String(logs.getRange(rowNumber, 1).getValue()) === String(values[0])) logs.deleteRow(rowNumber);
    throw canonicalEntryError("WRITE_FAILED", "The transaction audit record could not be verified.", null);
  }
  return { rowNumber: rowNumber, id: values[0] };
}

function rollbackLifecycleLog(logs, audit) {
  if (audit && String(logs.getRange(audit.rowNumber, 1).getValue()) === audit.id) logs.deleteRow(audit.rowNumber);
}

function persistCanonicalVoid(ss, original, reason, timestamp, runtime) {
  var logs = ss.getSheetByName("Logs"), activeIndex = original.spec.type === "SALES" ? 8 : 5;
  var updatedAtIndex = original.spec.type === "SALES" ? 11 : 8, updatedByIndex = updatedAtIndex + 1;
  requireCanonicalHeaders(logs, CANONICAL_ENTRY.LOG_HEADERS);
  var before = original.values.slice(), after = before.slice(), audit = null;
  after[activeIndex] = false; after[updatedAtIndex] = timestamp; after[updatedByIndex] = CANONICAL_ENTRY.USER;
  try {
    original.sheet.getRange(original.rowNumber, 1, 1, after.length).setValues([after]); runtime.flush();
    if (!canonicalEntryRowMatches(original.sheet.getRange(original.rowNumber, 1, 1, after.length).getValues()[0], after)) {
      throw canonicalEntryError("WRITE_FAILED", "The void mutation could not be verified.", null);
    }
    audit = appendLifecycleAudit(logs, timestamp, original.spec.type === "SALES" ? "VOID_SALES" : "VOID_EXPENSE",
      String(before[0]), { reason: reason, source: CANONICAL_ENTRY.SOURCE, transactionType: original.spec.type,
        before: before, after: after }, runtime);
    return after;
  } catch (error) {
    rollbackLifecycleLog(logs, audit);
    original.sheet.getRange(original.rowNumber, 1, 1, before.length).setValues([before]); runtime.flush();
    if (!canonicalEntryRowMatches(original.sheet.getRange(original.rowNumber, 1, 1, before.length).getValues()[0], before)) {
      throw canonicalEntryError("ROLLBACK_FAILED", "Void rollback could not restore the original transaction.", null);
    }
    throw error;
  }
}

function voidCanonicalTransaction(payload) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    var reason = requireLifecycleReason(payload && payload.reason);
    lock.waitLock(30000); acquired = true;
    var ss = SpreadsheetApp.getActiveSpreadsheet(), original = findCanonicalLifecycleRecord(ss, payload && payload.transactionId);
    requireMutableLifecycleRecord(original);
    var timestamp = new Date(), runtime = { flush: function() { SpreadsheetApp.flush(); }, uuid: function() { return Utilities.getUuid(); } };
    persistCanonicalVoid(ss, original, reason, timestamp, runtime);
    invalidateDashboardCache();
    return canonicalLifecycleSuccess(normalizeCanonicalLifecycleDetail(findCanonicalLifecycleRecord(ss, payload.transactionId), ss));
  } catch (error) { return canonicalEntryFailure(error); }
  finally { if (acquired) lock.releaseLock(); }
}

function persistCanonicalCorrection(ss, original, replacement, reason, timestamp, runtime) {
  var ledger = original.sheet, logs = ss.getSheetByName("Logs"), before = original.values.slice();
  var activeIndex = original.spec.type === "SALES" ? 8 : 5, updatedAtIndex = original.spec.type === "SALES" ? 11 : 8;
  requireCanonicalHeaders(logs, CANONICAL_ENTRY.LOG_HEADERS);
  var id = generateCanonicalEntryId(original.spec.type === "SALES" ? "SAL-APP-" : "OPS-APP-", timestamp,
    runtime.uuid, function(candidate) { return canonicalSheetHasId(ledger, candidate); });
  var replacementValues = original.spec.type === "SALES"
    ? [id, timestamp, replacement.productId, replacement.type, replacement.qty, replacement.unitHPP, replacement.unitPrice,
      CANONICAL_ENTRY.SOURCE, true, timestamp, CANONICAL_ENTRY.USER, "", ""]
    : [id, timestamp, replacement.expenseItemId, replacement.amount, CANONICAL_ENTRY.SOURCE, true,
      timestamp, CANONICAL_ENTRY.USER, "", ""];
  var replacementRow = ledger.getLastRow() + 1, afterOriginal = before.slice(), audits = [];
  afterOriginal[activeIndex] = false; afterOriginal[updatedAtIndex] = timestamp; afterOriginal[updatedAtIndex + 1] = CANONICAL_ENTRY.USER;
  try {
    ledger.getRange(replacementRow, 1, 1, replacementValues.length).setValues([replacementValues]); runtime.flush();
    if (!canonicalEntryRowMatches(ledger.getRange(replacementRow, 1, 1, replacementValues.length).getValues()[0], replacementValues)) {
      throw canonicalEntryError("WRITE_FAILED", "The correction replacement could not be verified.", null);
    }
    ledger.getRange(original.rowNumber, 1, 1, afterOriginal.length).setValues([afterOriginal]); runtime.flush();
    if (!canonicalEntryRowMatches(ledger.getRange(original.rowNumber, 1, 1, afterOriginal.length).getValues()[0], afterOriginal)) {
      throw canonicalEntryError("WRITE_FAILED", "The original correction transaction could not be voided.", null);
    }
    audits.push(appendLifecycleAudit(logs, timestamp, "CORRECT_VOID_" + original.spec.type, String(before[0]),
      { reason: reason, replacementId: id, before: before }, runtime));
    audits.push(appendLifecycleAudit(logs, timestamp, "CORRECT_CREATE_" + original.spec.type, id,
      { reason: reason, originalId: String(before[0]), replacement: replacementValues }, runtime));
    return id;
  } catch (error) {
    for (var index = audits.length - 1; index >= 0; index--) rollbackLifecycleLog(logs, audits[index]);
    ledger.getRange(original.rowNumber, 1, 1, before.length).setValues([before]); runtime.flush();
    if (String(ledger.getRange(replacementRow, 1).getValue()) === id) ledger.deleteRow(replacementRow);
    runtime.flush();
    if (!canonicalEntryRowMatches(ledger.getRange(original.rowNumber, 1, 1, before.length).getValues()[0], before) || canonicalSheetHasId(ledger, id)) {
      throw canonicalEntryError("ROLLBACK_FAILED", "Correction rollback could not restore one active original.", null);
    }
    throw error;
  }
}

function correctCanonicalTransaction(payload) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    var reason = requireLifecycleReason(payload && payload.reason);
    lock.waitLock(30000); acquired = true;
    var ss = SpreadsheetApp.getActiveSpreadsheet(), original = findCanonicalLifecycleRecord(ss, payload && payload.transactionId);
    requireMutableLifecycleRecord(original);
    var timestamp = new Date(), replacement = buildLifecycleReplacement(payload, original, ss, timestamp);
    var runtime = { flush: function() { SpreadsheetApp.flush(); }, uuid: function() { return Utilities.getUuid(); } };
    var replacementId = persistCanonicalCorrection(ss, original, replacement, reason, timestamp, runtime);
    invalidateDashboardCache();
    return canonicalLifecycleSuccess({ original: normalizeCanonicalLifecycleDetail(findCanonicalLifecycleRecord(ss, payload.transactionId), ss),
      replacement: normalizeCanonicalLifecycleDetail(findCanonicalLifecycleRecord(ss, replacementId), ss) });
  } catch (error) { return canonicalEntryFailure(error); }
  finally { if (acquired) lock.releaseLock(); }
}
