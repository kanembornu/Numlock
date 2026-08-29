function getTransactionData(ss) {
  return ss.getSheetByName("Transaction").getDataRange().getValues();
}

function buildLegacyCanonicalId(transactionType, sourceRow) {
  var rowNumber = Number(sourceRow);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Legacy synchronization requires an absolute Transaction source row");
  }
  if (transactionType === "Sales") return "SAL-GLEG-" + String(rowNumber).padStart(8, "0");
  if (transactionType === "Purchase") return "OPS-GLEG-" + String(rowNumber).padStart(8, "0");
  throw new Error("Unsupported legacy transaction type at row " + rowNumber + ": " + transactionType);
}

function buildUniqueDisplayMap(rows, displayField, idField, name) {
  var map = {};
  rows.forEach(function(row) {
    var display = String(row[displayField] || "").trim();
    if (!display) return;
    if (map[display]) throw new Error(name + " contains ambiguous " + displayField + ": " + display);
    map[display] = String(row[idField] || "").trim();
  });
  return map;
}

function transformLegacyTransaction(row, sourceRow, context) {
  var timestamp = canonicalDate(row[0]);
  var type = String(row[1] || "").trim();
  var transactionType = String(row[2] || "").trim();
  var salesName = String(row[3] || "").trim();
  var expenseName = String(row[4] || "").trim();
  var qty = Number(row[5]);
  var amount = Number(row[6]);
  var id = buildLegacyCanonicalId(transactionType, sourceRow);

  if (!timestamp) throw new Error("Invalid Timestamp at Transaction row " + sourceRow);
  if (transactionType === "Sales") {
    if (!salesName) throw new Error("Blank Sales product at Transaction row " + sourceRow);
    if (type !== "Hot" && type !== "Cold") throw new Error("Invalid Sales Type at Transaction row " + sourceRow);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error("Invalid Sales Qty at Transaction row " + sourceRow);
    var productId = context.productIdsByName[salesName];
    if (!productId) throw new Error("Unresolved Sales product at Transaction row " + sourceRow + ": " + salesName);
    var pricing = resolveProductPrice(context.pricingIndex, productId, type, timestamp, false);
    var hpp = Number(pricing.HPP), price = Number(pricing.Harga);
    if (!isFinite(hpp) || !isFinite(price)) throw new Error("Invalid ProductPricing at Transaction row " + sourceRow);
    return { sheet: "tabsal", id: id, sourceRow: sourceRow, timestamp: timestamp,
      payload: [id, timestamp, productId, type, qty, hpp, price, "LEGACY_GOOGLE", true] };
  }
  if (!expenseName) throw new Error("Blank Purchase item at Transaction row " + sourceRow);
  if (!isFinite(amount) || amount < 0) throw new Error("Invalid Purchase Price at Transaction row " + sourceRow);
  var expenseId = context.expenseIdsByName[expenseName];
  if (!expenseId) throw new Error("Unresolved Purchase item at Transaction row " + sourceRow + ": " + expenseName);
  return { sheet: "tabops", id: id, sourceRow: sourceRow, timestamp: timestamp,
    payload: [id, timestamp, expenseId, amount, "LEGACY_GOOGLE", true] };
}

function canonicalPayloadMatches(candidate, existing) {
  var fields = candidate.sheet === "tabsal"
    ? ["ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ", "Source", "IsActive"]
    : ["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"];
  return fields.every(function(field, index) {
    var expected = candidate.payload[index];
    var actual = existing[field];
    if (field === "Tanggal") {
      var expectedDate = canonicalDate(expected), actualDate = canonicalDate(actual);
      return expectedDate && actualDate && expectedDate.getTime() === actualDate.getTime();
    }
    if (["Qty", "HPP", "HJ", "Nilai"].indexOf(field) !== -1) return Number(expected) === Number(actual);
    if (field === "IsActive") return isCanonicalActive(expected) === isCanonicalActive(actual);
    return String(expected) === String(actual);
  });
}

function classifyLegacySyncCandidates(candidates, existing) {
  var result = { inserts: { tabsal: [], tabops: [] }, skipped: [], conflicts: [] };
  candidates.forEach(function(candidate) {
    var current = existing[candidate.id];
    if (!current) result.inserts[candidate.sheet].push(candidate);
    else if (canonicalPayloadMatches(candidate, current)) result.skipped.push(candidate);
    else result.conflicts.push({ sourceRow: candidate.sourceRow, id: candidate.id,
      sourcePayload: candidate.payload.slice(), canonicalPayload: current });
  });
  return result;
}

function appendLegacySyncLog(ss, result, action) {
  var sheet = ss.getSheetByName("Logs");
  if (!sheet) return;
  sheet.appendRow([
    "LOG-SYNC-" + Utilities.getUuid(), new Date(), result.conflicts ? "ERROR" : "INFO",
    "TransactionSync", action, result.targetId || "BATCH", "SYSTEM_SYNC",
    result.message || ("inserted=" + result.inserted + "; skipped=" + result.skipped + "; rejected=" + result.rejected),
    JSON.stringify({ sourceRow: result.sourceRow || null, candidateRows: result.candidateRows })
  ]);
}

function syncLegacyTransactionsToCanonical(options) {
  var settings = options || {};
  var ss = settings.spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var transactionValues = getTransactionData(ss);
    var products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk"]);
    var expenses = readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item"]);
    var pricing = readCanonicalTable(ss, "ProductPricing", ["ID_Prod", "Tipe", "EffectiveFrom", "EffectiveTo", "HPP", "Harga"]);
    var salesRows = readCanonicalTable(ss, "tabsal", ["ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ", "Source", "IsActive"]);
    var expenseRows = readCanonicalTable(ss, "tabops", ["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"]);
    var context = {
      productIdsByName: buildUniqueDisplayMap(products, "Produk", "ID_Prod", "Products"),
      expenseIdsByName: buildUniqueDisplayMap(expenses, "Item", "ID_Ops", "ExpenseItems"),
      pricingIndex: buildProductPricingIndex(pricing)
    };
    var existing = {};
    salesRows.concat(expenseRows).forEach(function(row) { existing[String(row.ID_Trx)] = row; });
    var cutoff = new Date(2026, 7, 1, 0, 0, 0, 0);
    var candidates = [], rejected = [];
    for (var index = 1; index < transactionValues.length; index++) {
      var sourceRow = index + 1;
      if (settings.sourceRow && sourceRow !== Number(settings.sourceRow)) continue;
      var row = transactionValues[index] || [];
      var timestamp = canonicalDate(row[0]);
      if (!timestamp || timestamp < cutoff) continue;
      try { candidates.push(transformLegacyTransaction(row, sourceRow, context)); }
      catch (error) { rejected.push({ sourceRow: sourceRow, message: error.message }); }
    }
    var classification = classifyLegacySyncCandidates(candidates, existing);
    var inserts = classification.inserts, skipped = classification.skipped, conflicts = classification.conflicts;
    if (conflicts.length) {
      var conflictResult = { candidateRows: candidates.length, inserted: 0, skipped: skipped.length,
        rejected: rejected.length, conflicts: conflicts.length, conflictDetails: conflicts,
        message: "CONFLICT: canonical payload differs for " + conflicts[0].id };
      if (!settings.suppressLog) appendLegacySyncLog(ss, conflictResult, settings.action || "SYNC");
      throw new Error(conflictResult.message);
    }
    var now = new Date();
    ["tabsal", "tabops"].forEach(function(name) {
      var pending = inserts[name];
      if (!pending.length) return;
      var values = pending.map(function(candidate) {
        return candidate.payload.concat([now, "SYSTEM_SYNC", "", ""]);
      });
      var sheet = ss.getSheetByName(name);
      sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    });
    var allDates = candidates.map(function(candidate) { return candidate.timestamp; }).sort(function(a, b) { return a - b; });
    var result = { candidateRows: candidates.length,
      inserted: inserts.tabsal.length + inserts.tabops.length, skipped: skipped.length,
      rejected: rejected.length, conflicts: 0, sales: candidates.filter(function(x) { return x.sheet === "tabsal"; }).length,
      expense: candidates.filter(function(x) { return x.sheet === "tabops"; }).length,
      firstTimestamp: allDates.length ? allDates[0].toISOString() : null,
      lastTimestamp: allDates.length ? allDates[allDates.length - 1].toISOString() : null,
      rejectedDetails: rejected, sourceRow: settings.sourceRow || null,
      targetId: candidates.length === 1 ? candidates[0].id : null };
    if (result.inserted > 0) invalidateDashboardCache();
    if (!settings.suppressLog) appendLegacySyncLog(ss, result, settings.action || "SYNC");
    return result;
  } finally {
    lock.releaseLock();
  }
}

function syncLegacyTransactionOnFormSubmit(event) {
  if (!event || !event.range || event.range.getSheet().getName() !== "Transaction") return null;
  return syncLegacyTransactionsToCanonical({ sourceRow: event.range.getRow(), action: "FORM_SUBMIT" });
}

function installLegacyTransactionSyncTrigger() {
  var handler = "syncLegacyTransactionOnFormSubmit";
  var matches = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (matches.length > 1) throw new Error("Multiple TransactionSync triggers already exist");
  if (matches.length === 1) return { installed: false, status: "ALREADY_INSTALLED" };
  ScriptApp.newTrigger(handler).forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onFormSubmit().create();
  return { installed: true, status: "INSTALLED" };
}

function buildLegacySyncAcceptanceSnapshot(ss) {
  var products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk"]);
  var expenses = readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item"]);
  var pricing = readCanonicalTable(ss, "ProductPricing", [
    "ID_Prod", "Tipe", "EffectiveFrom", "EffectiveTo", "HPP", "Harga"
  ]);
  var salesRows = readCanonicalTable(ss, "tabsal", [
    "ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ", "Source", "IsActive"
  ]);
  var expenseRows = readCanonicalTable(ss, "tabops", [
    "ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"
  ]);
  var context = {
    productIdsByName: buildUniqueDisplayMap(products, "Produk", "ID_Prod", "Products"),
    expenseIdsByName: buildUniqueDisplayMap(expenses, "Item", "ID_Ops", "ExpenseItems"),
    pricingIndex: buildProductPricingIndex(pricing)
  };
  var canonicalById = {};
  var duplicateIds = [];
  salesRows.concat(expenseRows).forEach(function(row) {
    var id = String(row.ID_Trx || "");
    if (canonicalById[id]) duplicateIds.push(id);
    canonicalById[id] = row;
  });
  var sourceCandidates = [];
  var rejected = [];
  var transactionValues = getTransactionData(ss);
  var cutoff = new Date(2026, 7, 1, 0, 0, 0, 0);
  for (var index = 1; index < transactionValues.length; index++) {
    var sourceRow = index + 1;
    var row = transactionValues[index] || [];
    var timestamp = canonicalDate(row[0]);
    if (!timestamp || timestamp < cutoff) continue;
    try { sourceCandidates.push(transformLegacyTransaction(row, sourceRow, context)); }
    catch (error) { rejected.push({ sourceRow: sourceRow, message: error.message }); }
  }
  var missing = [], conflicts = [];
  sourceCandidates.forEach(function(candidate) {
    var existing = canonicalById[candidate.id];
    if (!existing) missing.push(candidate.id);
    else if (!canonicalPayloadMatches(candidate, existing)) conflicts.push(candidate.id);
  });
  function aggregateCandidates(candidates) {
    var aggregate = { sales: 0, expenses: 0, qty: 0, revenue: 0, cogs: 0,
      margin: 0, expense: 0, hot: 0, cold: 0, products: {}, expenseItems: {} };
    candidates.forEach(function(candidate) {
      if (candidate.sheet === "tabsal") {
        var quantity = Number(candidate.payload[4]), hpp = Number(candidate.payload[5]);
        var price = Number(candidate.payload[6]), productId = String(candidate.payload[2]);
        aggregate.sales++; aggregate.qty += quantity; aggregate.cogs += quantity * hpp;
        aggregate.revenue += quantity * price; aggregate.margin += quantity * (price - hpp);
        aggregate[String(candidate.payload[3]).toLowerCase()] += quantity;
        aggregate.products[productId] = (aggregate.products[productId] || 0) + quantity;
      } else {
        var amount = Number(candidate.payload[3]), expenseId = String(candidate.payload[2]);
        aggregate.expenses++; aggregate.expense += amount;
        aggregate.expenseItems[expenseId] = (aggregate.expenseItems[expenseId] || 0) + amount;
      }
    });
    return aggregate;
  }
  var canonicalCandidates = [];
  salesRows.forEach(function(row) {
    if (String(row.Source) === "LEGACY_GOOGLE") canonicalCandidates.push({ sheet: "tabsal",
      payload: [row.ID_Trx, row.Tanggal, row.ID_Prod, row.Tipe, row.Qty, row.HPP, row.HJ, row.Source, row.IsActive] });
  });
  expenseRows.forEach(function(row) {
    if (String(row.Source) === "LEGACY_GOOGLE") canonicalCandidates.push({ sheet: "tabops",
      payload: [row.ID_Trx, row.Tanggal, row.ID_Ops, row.Nilai, row.Source, row.IsActive] });
  });
  var sourceAggregate = aggregateCandidates(sourceCandidates);
  var canonicalAggregate = aggregateCandidates(canonicalCandidates);
  return {
    legacySales: canonicalCandidates.filter(function(row) { return row.sheet === "tabsal"; }).length,
    legacyExpenses: canonicalCandidates.filter(function(row) { return row.sheet === "tabops"; }).length,
    xlsmSales: salesRows.filter(function(row) { return String(row.Source) === "XLSM"; }).length,
    xlsmExpenses: expenseRows.filter(function(row) { return String(row.Source) === "XLSM"; }).length,
    xlsmFingerprint: JSON.stringify({
      sales: salesRows.filter(function(row) { return String(row.Source) === "XLSM"; }),
      expenses: expenseRows.filter(function(row) { return String(row.Source) === "XLSM"; })
    }),
    sourceAggregate: sourceAggregate,
    canonicalAggregate: canonicalAggregate,
    parityPass: JSON.stringify(sourceAggregate) === JSON.stringify(canonicalAggregate) &&
      missing.length === 0 && conflicts.length === 0 && rejected.length === 0,
    missing: missing,
    conflicts: conflicts,
    rejected: rejected,
    duplicateIds: duplicateIds
  };
}

function verifyLegacySyncRuntimeAcceptance() {
  var handler = "syncLegacyTransactionOnFormSubmit";
  var triggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  var triggerDetails = triggers.map(function(trigger) {
    return {
      uniqueId: typeof trigger.getUniqueId === "function" ? trigger.getUniqueId() : null,
      handlerFunction: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      triggerSource: String(trigger.getTriggerSource()),
      triggerSourceId: typeof trigger.getTriggerSourceId === "function" ? trigger.getTriggerSourceId() : null
    };
  });
  if (triggers.length !== 1) {
    throw new Error("Legacy sync runtime acceptance requires exactly one trigger; found " + triggers.length);
  }
  if (triggerDetails[0].eventType !== "ON_FORM_SUBMIT" || triggerDetails[0].triggerSource !== "SPREADSHEETS") {
    throw new Error("Legacy sync trigger source/type mismatch: " + JSON.stringify(triggerDetails[0]));
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var before = buildLegacySyncAcceptanceSnapshot(ss);
  if (before.duplicateIds.length || before.conflicts.length || before.rejected.length) {
    throw new Error("Legacy sync pre-acceptance validation failed");
  }
  var sync = syncLegacyTransactionsToCanonical({ spreadsheet: ss, action: "RUNTIME_ACCEPTANCE" });
  var after = buildLegacySyncAcceptanceSnapshot(ss);
  var historicalPass = before.xlsmSales === 10572 && before.xlsmExpenses === 1949 &&
    after.xlsmSales === 10572 && after.xlsmExpenses === 1949 &&
    before.xlsmFingerprint === after.xlsmFingerprint;
  var countsStable = before.legacySales === after.legacySales &&
    before.legacyExpenses === after.legacyExpenses;
  var overall = sync.conflicts === 0 && sync.rejected === 0 && after.parityPass &&
    after.duplicateIds.length === 0 && historicalPass &&
    (sync.inserted > 0 || countsStable);
  var result = {
    name: "LEGACY_SYNC_RUNTIME_ACCEPTANCE",
    triggerCount: triggers.length,
    triggers: triggerDetails,
    sync: { inserted: sync.inserted, skipped: sync.skipped, conflicts: sync.conflicts, rejected: sync.rejected },
    before: { sales: before.legacySales, expenses: before.legacyExpenses },
    after: { sales: after.legacySales, expenses: after.legacyExpenses },
    parity: { pass: after.parityPass, source: after.sourceAggregate, canonical: after.canonicalAggregate },
    historical: { pass: historicalPass, sales: after.xlsmSales, expenses: after.xlsmExpenses },
    overall: overall ? "PASS" : "FAIL"
  };
  Logger.log("LEGACY_SYNC_RUNTIME_ACCEPTANCE " + JSON.stringify(result));
  if (!overall) throw new Error("Legacy sync runtime acceptance failed: " + JSON.stringify(result));
  return result;
}
