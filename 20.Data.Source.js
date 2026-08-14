function getTransactionData(ss) {
  return ss.getSheetByName("Transaction").getDataRange().getValues();
}

function readCanonicalTable(ss, name, required) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Missing canonical sheet: " + name);
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var indexes = {};
  headers.forEach(function(header, index) { indexes[String(header).trim()] = index; });
  required.forEach(function(header) {
    if (!Object.prototype.hasOwnProperty.call(indexes, header)) {
      throw new Error(name + " is missing required column: " + header);
    }
  });
  return values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== "" && value != null; });
  }).map(function(row, rowIndex) {
    var record = { sourceRowIndex: rowIndex + 1 };
    headers.forEach(function(header, index) {
      record[String(header).trim()] = row[index] === undefined ? "" : row[index];
    });
    return record;
  });
}

function isCanonicalActive(value) {
  return value === true || String(value).trim().toUpperCase() === "TRUE";
}

function buildCanonicalMasterMap(rows, idField, name) {
  var map = {};
  rows.forEach(function(row) {
    var id = String(row[idField] || "").trim();
    if (!id || map[id]) throw new Error(name + " invalid or duplicate " + idField + ": " + id);
    map[id] = row;
  });
  return map;
}

function canonicalDate(value) {
  var date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function canonicalDateKey(date) {
  return date.getFullYear() + "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) + "-" +
    ("0" + date.getDate()).slice(-2);
}

function buildProductPricingIndex(rows) {
  var index = {};
  rows.forEach(function(row) {
    var key = String(row.ID_Prod || "").trim() + "|" + String(row.Tipe || "").trim();
    if (key === "|") throw new Error("ProductPricing contains a blank product/type key");
    index[key] = index[key] || [];
    index[key].push(row);
  });
  return index;
}

function resolveProductPrice(index, productId, type, referenceDate, currentOnly) {
  var key = String(productId).trim() + "|" + String(type).trim();
  var reference = canonicalDate(referenceDate || new Date());
  if (!reference) throw new Error("ProductPricing requires a valid reference date");
  var matches = (index[key] || []).filter(function(row) {
    var start = canonicalDate(row.EffectiveFrom);
    var end = row.EffectiveTo === "" || row.EffectiveTo == null ? null : canonicalDate(row.EffectiveTo);
    return start && start <= reference && (!end || reference <= end) &&
      (!currentOnly || isCanonicalActive(row.IsActive));
  });
  if (matches.length !== 1) {
    throw new Error("ProductPricing expected exactly one effective record for " + key + "; found " + matches.length);
  }
  return matches[0];
}

function getPriceMap(ss, referenceDate) {
  var products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "IsActive"]);
  var pricing = readCanonicalTable(ss, "ProductPricing", [
    "ID_Prod", "Tipe", "EffectiveFrom", "EffectiveTo", "HPP", "Harga", "IsActive"
  ]);
  var index = buildProductPricingIndex(pricing);
  var map = {};
  products.forEach(function(product) {
    if (!isCanonicalActive(product.IsActive)) return;
    var id = String(product.ID_Prod).trim();
    map[id] = {};
    ["Hot", "Cold"].forEach(function(type) {
      if (!index[id + "|" + type]) return;
      var price = resolveProductPrice(index, id, type, referenceDate || new Date(), true);
      map[id][type] = { hpp: Number(price.HPP) || 0, price: Number(price.Harga) || 0 };
    });
  });
  return map;
}

function buildCanonicalTransactionData(source) {
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var expenseItems = buildCanonicalMasterMap(source.expenseItems, "ID_Ops", "ExpenseItems");
  var records = [], lifecycleRecords = [];
  var quality = { sourceRows: source.sales.length + source.expenses.length,
    invalidDateRowIndexes: [], inactiveLedgerRows: 0, malformedRows: 0, unresolvedForeignKeys: 0 };

  source.sales.forEach(function(row) {
    var active = isCanonicalActive(row.IsActive);
    if (!active) quality.inactiveLedgerRows++;
    var date = canonicalDate(row.Tanggal);
    var id = String(row.ID_Prod || "").trim();
    var master = products[id];
    var qty = Number(row.Qty), hpp = Number(row.HPP), price = Number(row.HJ);
    if (!date) { quality.invalidDateRowIndexes.push("tabsal:" + row.sourceRowIndex); return; }
    if (!master) { quality.unresolvedForeignKeys++; return; }
    if (!isFinite(qty) || !isFinite(hpp) || !isFinite(price)) { quality.malformedRows++; return; }
    var revenue = qty * price, cogs = qty * hpp;
    var dateKey = canonicalDateKey(date);
    var salesRecord = { id: String(row.ID_Trx || ""), timestamp: date, date: date, dateKey: dateKey,
      monthKey: dateKey.slice(0, 7),
      year: date.getFullYear(), month: date.getMonth() + 1,
      transactionType: "Sales", canonicalTransactionType: "Sales", type: String(row.Tipe || "").trim(),
      productId: id, product: String(master.Produk || "").trim(),
      productCategory: String(master.Kategori || "").trim(), category: String(row.Tipe || "").trim(),
      kind: String(master.Kind || "").trim(), group: null, purchaseCategory: "",
      qty: qty, hpp: hpp, price: price, revenue: revenue, cogs: cogs,
      margin: revenue - cogs, amount: revenue, expense: 0, source: String(row.Source || "").trim(), isActive: active,
      sourceRowIndex: row.sourceRowIndex, sourceSheet: "tabsal",
      dataQualitySource: { quantity: row.Qty, purchaseAmount: null } };
    lifecycleRecords.push(salesRecord);
    if (active) records.push(salesRecord);
  });

  source.expenses.forEach(function(row) {
    var active = isCanonicalActive(row.IsActive);
    if (!active) quality.inactiveLedgerRows++;
    var date = canonicalDate(row.Tanggal);
    var id = String(row.ID_Ops || "").trim();
    var master = expenseItems[id];
    var amount = Number(row.Nilai);
    if (!date) { quality.invalidDateRowIndexes.push("tabops:" + row.sourceRowIndex); return; }
    if (!master) { quality.unresolvedForeignKeys++; return; }
    if (!isFinite(amount)) { quality.malformedRows++; return; }
    var dateKey = canonicalDateKey(date);
    var expenseRecord = { id: String(row.ID_Trx || ""), timestamp: date, date: date, dateKey: dateKey,
      monthKey: dateKey.slice(0, 7),
      year: date.getFullYear(), month: date.getMonth() + 1,
      transactionType: "Purchase", canonicalTransactionType: "Expense", type: "Expense",
      productId: null, product: "", productCategory: "", category: String(master.Kategori || "").trim(),
      kind: String(master.Kind || "").trim(), group: String(master.Group || "").trim(),
      purchaseCategory: String(master.Item || "").trim(), expenseId: id,
      qty: 0, hpp: 0, price: 0, revenue: 0, cogs: 0, margin: -amount,
      amount: amount, expense: amount, source: String(row.Source || "").trim(), isActive: active,
      sourceRowIndex: row.sourceRowIndex, sourceSheet: "tabops",
      dataQualitySource: { quantity: null, purchaseAmount: row.Nilai } };
    lifecycleRecords.push(expenseRecord);
    if (active) records.push(expenseRecord);
  });
  records.sort(function(left, right) {
    return left.date.getTime() - right.date.getTime() || String(left.id).localeCompare(String(right.id));
  });
  lifecycleRecords.sort(function(left, right) {
    return left.date.getTime() - right.date.getTime() || String(left.id).localeCompare(String(right.id));
  });
  return { records: records, lifecycleRecords: lifecycleRecords, sourceQuality: quality };
}

function getCanonicalTransactionData(ss, performance) {
  function timedRead(key, name, required) {
    var startedAt = Date.now();
    var rows = readCanonicalTable(ss, name, required);
    if (performance) performance[key] = Date.now() - startedAt;
    return rows;
  }

  var source = {
    sales: timedRead("salesReadMs", "tabsal", ["ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ", "Source", "IsActive"]),
    expenses: timedRead("expenseReadMs", "tabops", ["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"]),
    products: timedRead("productReadMs", "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"]),
    expenseItems: timedRead("expenseItemReadMs", "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"])
  };
  var normalizeStartedAt = Date.now();
  var canonicalData = buildCanonicalTransactionData(source);
  if (performance) performance.normalizeMs = Date.now() - normalizeStartedAt;
  return canonicalData;
}

var CANONICAL_ENTRY = Object.freeze({
  TIMEZONE: "Asia/Jakarta",
  SOURCE: "APP_ENTRY",
  USER: "SYSTEM_APP_ENTRY",
  SALES_HEADERS: Object.freeze(["ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ",
    "Source", "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  EXPENSE_HEADERS: Object.freeze(["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive",
    "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  LOG_HEADERS: Object.freeze(["ID_Log", "Timestamp", "Level", "Module", "Action", "RecordID", "User", "Message", "Metadata"])
});

function canonicalEntryError(code, message, field) {
  var error = new Error(message);
  error.entryCode = code;
  error.entryField = field || null;
  return error;
}

function canonicalEntryFailure(error) {
  return { success: false, error: {
    code: error && error.entryCode ? error.entryCode : "WRITE_FAILED",
    message: error && error.entryCode ? error.message : "Transaction could not be completed.",
    field: error && error.entryField ? error.entryField : null
  } };
}

function requireCanonicalEntryText(value, code, message, field) {
  var normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw canonicalEntryError(code, message, field);
  return normalized;
}

function canonicalEntryMaster(rows, idField, id, missingCode, inactiveCode, field) {
  var map = buildCanonicalMasterMap(rows, idField, idField === "ID_Prod" ? "Products" : "ExpenseItems");
  var record = map[id];
  if (!record) throw canonicalEntryError(missingCode, "The selected record was not found.", field);
  if (!isCanonicalActive(record.IsActive)) {
    throw canonicalEntryError(inactiveCode, "The selected record is inactive.", field);
  }
  return record;
}

function resolveCanonicalEntryPrice(pricingRows, productId, type, timestamp) {
  var price;
  try {
    price = resolveProductPrice(buildProductPricingIndex(pricingRows), productId, type, timestamp, true);
  } catch (error) {
    var match = /found (\d+)$/.exec(error.message || "");
    var count = match ? Number(match[1]) : 0;
    throw canonicalEntryError(count > 1 ? "PRICE_AMBIGUOUS" : "PRICE_NOT_FOUND",
      count > 1 ? "Multiple effective prices were found." : "No effective price was found.", "type");
  }
  var hpp = price.HPP, sellingPrice = price.Harga;
  if (typeof hpp !== "number" || !isFinite(hpp) || hpp < 0) {
    throw canonicalEntryError("INVALID_HPP", "The effective HPP is invalid.", "productId");
  }
  if (typeof sellingPrice !== "number" || !isFinite(sellingPrice) || sellingPrice <= 0) {
    throw canonicalEntryError("INVALID_PRICE", "The effective selling price is invalid.", "productId");
  }
  return { hpp: hpp, price: sellingPrice };
}

function prepareCanonicalSalesEntry(payload, context) {
  var productId = requireCanonicalEntryText(payload && payload.productId,
    "PRODUCT_NOT_FOUND", "A product is required.", "productId");
  var type = requireCanonicalEntryText(payload && payload.type,
    "INVALID_SALES_TYPE", "Sales type must be Hot or Cold.", "type");
  if (type !== "Hot" && type !== "Cold") {
    throw canonicalEntryError("INVALID_SALES_TYPE", "Sales type must be Hot or Cold.", "type");
  }
  var qty = payload && payload.qty;
  if (typeof qty !== "number" || !isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
    throw canonicalEntryError("INVALID_QTY", "Quantity must be a positive whole number.", "qty");
  }
  var product = canonicalEntryMaster(context.products, "ID_Prod", productId,
    "PRODUCT_NOT_FOUND", "PRODUCT_INACTIVE", "productId");
  ["Produk", "Kategori", "Kind"].forEach(function(field) {
    if (!String(product[field] || "").trim()) {
      throw canonicalEntryError("INVALID_PRODUCT", "The selected product master is incomplete.", "productId");
    }
  });
  var resolved = resolveCanonicalEntryPrice(context.pricing, productId, type, context.timestamp);
  var cogs = qty * resolved.hpp, revenue = qty * resolved.price;
  return { timestamp: context.timestamp, productId: productId, product: String(product.Produk).trim(),
    category: String(product.Kategori).trim(), kind: String(product.Kind).trim(), type: type, qty: qty,
    unitHPP: resolved.hpp, unitPrice: resolved.price, cogs: cogs, revenue: revenue, margin: revenue - cogs };
}

function prepareCanonicalExpenseEntry(payload, context) {
  var expenseItemId = requireCanonicalEntryText(payload && payload.expenseItemId,
    "EXPENSE_ITEM_NOT_FOUND", "An expense item is required.", "expenseItemId");
  var amount = payload && payload.amount;
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    throw canonicalEntryError("INVALID_AMOUNT", "Amount must be a positive number.", "amount");
  }
  var item = canonicalEntryMaster(context.expenseItems, "ID_Ops", expenseItemId,
    "EXPENSE_ITEM_NOT_FOUND", "EXPENSE_ITEM_INACTIVE", "expenseItemId");
  ["Item", "Kategori", "Kind", "Group", "AccountCode"].forEach(function(field) {
    if (!String(item[field] || "").trim()) {
      throw canonicalEntryError(field === "AccountCode" ? "ACCOUNT_NOT_FOUND" : "INVALID_EXPENSE_ITEM",
        "The selected expense item master is incomplete.", "expenseItemId");
    }
  });
  var accounts = buildCanonicalMasterMap(context.accounts, "AccountCode", "Accounts");
  var account = accounts[String(item.AccountCode).trim()];
  if (!account) throw canonicalEntryError("ACCOUNT_NOT_FOUND", "The expense account was not found.", "expenseItemId");
  if (!isCanonicalActive(account.IsActive)) {
    throw canonicalEntryError("ACCOUNT_INACTIVE", "The expense account is inactive.", "expenseItemId");
  }
  return { timestamp: context.timestamp, expenseItemId: expenseItemId, item: String(item.Item).trim(),
    category: String(item.Kategori).trim(), kind: String(item.Kind).trim(), group: String(item.Group).trim(), amount: amount };
}

function generateCanonicalEntryId(prefix, timestamp, uuidFactory, exists) {
  var datePart = Utilities.formatDate(timestamp, CANONICAL_ENTRY.TIMEZONE, "yyyyMMdd");
  for (var attempt = 0; attempt < 5; attempt++) {
    var token = String(uuidFactory()).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
    var id = prefix + datePart + "-" + token;
    if (token.length === 12 && !exists(id)) return id;
  }
  throw canonicalEntryError("ID_COLLISION", "A unique transaction ID could not be allocated.", null);
}

function canonicalSheetHasId(sheet, id) {
  var rows = sheet.getLastRow() - 1;
  if (rows <= 0) return false;
  return sheet.getRange(2, 1, rows, 1).createTextFinder(id).matchEntireCell(true).findNext() !== null;
}

function requireCanonicalHeaders(sheet, expected) {
  if (!sheet) throw canonicalEntryError("WRITE_FAILED", "A required canonical sheet is missing.", null);
  if (sheet.getLastColumn() !== expected.length) {
    throw canonicalEntryError("WRITE_FAILED", "The canonical sheet schema does not match the verified contract.", null);
  }
  var actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0].map(function(value) { return String(value).trim(); });
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw canonicalEntryError("WRITE_FAILED", "The canonical sheet schema does not match the verified contract.", null);
  }
}

function canonicalEntryRowMatches(actual, expected) {
  return expected.every(function(value, index) {
    if (value instanceof Date) {
      var date = canonicalDate(actual[index]);
      return date && date.getTime() === value.getTime();
    }
    if (typeof value === "number") return Number(actual[index]) === value;
    if (typeof value === "boolean") return isCanonicalActive(actual[index]) === value;
    return String(actual[index]) === String(value);
  });
}

function persistCanonicalEntry(ss, specification, services) {
  var runtime = services || { flush: function() { SpreadsheetApp.flush(); }, uuid: function() { return Utilities.getUuid(); } };
  var sheet = ss.getSheetByName(specification.sheetName);
  var logs = ss.getSheetByName("Logs");
  requireCanonicalHeaders(sheet, specification.headers);
  requireCanonicalHeaders(logs, CANONICAL_ENTRY.LOG_HEADERS);
  var rowNumber = sheet.getLastRow() + 1;
  var logRowNumber = null;
  try {
    sheet.getRange(rowNumber, 1, 1, specification.values.length).setValues([specification.values]);
    runtime.flush();
    if (!canonicalEntryRowMatches(sheet.getRange(rowNumber, 1, 1, specification.values.length).getValues()[0], specification.values)) {
      throw canonicalEntryError("WRITE_FAILED", "The canonical transaction could not be verified.", null);
    }
    logRowNumber = logs.getLastRow() + 1;
    var logValues = ["LOG-ENTRY-" + runtime.uuid(), specification.timestamp, "INFO", "TransactionEntry",
      specification.action, specification.id, CANONICAL_ENTRY.USER, "Canonical transaction created.",
      JSON.stringify({ source: CANONICAL_ENTRY.SOURCE, ledger: specification.sheetName })];
    logs.getRange(logRowNumber, 1, 1, logValues.length).setValues([logValues]);
    runtime.flush();
    if (!canonicalEntryRowMatches(logs.getRange(logRowNumber, 1, 1, logValues.length).getValues()[0], logValues)) {
      throw canonicalEntryError("WRITE_FAILED", "The transaction audit record could not be verified.", null);
    }
  } catch (error) {
    if (logRowNumber !== null && String(logs.getRange(logRowNumber, 1).getValue()) === String(logValues[0])) {
      logs.deleteRow(logRowNumber);
    }
    if (String(sheet.getRange(rowNumber, 1).getValue()) === String(specification.id)) sheet.deleteRow(rowNumber);
    throw error;
  }
}

function canonicalEntryContext(ss, timestamp, transactionType) {
  var context = { timestamp: timestamp };
  if (transactionType === "SALES") {
    context.products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"]);
    context.pricing = readCanonicalTable(ss, "ProductPricing", ["ID_Prod", "Tipe", "EffectiveFrom", "EffectiveTo", "HPP", "Harga", "IsActive"]);
  } else {
    context.expenseItems = readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]);
    context.accounts = readCanonicalTable(ss, "Accounts", ["AccountCode", "IsActive"]);
  }
  return context;
}

function buildTransactionEntryOptions(products, expenseItems) {
  var sales = products.filter(function(row) { return isCanonicalActive(row.IsActive); })
    .map(function(row) { return { productId: String(row.ID_Prod), product: String(row.Produk), category: String(row.Kategori), kind: String(row.Kind) }; })
    .sort(function(a, b) { return a.product.localeCompare(b.product) || a.productId.localeCompare(b.productId); });
  var expenses = expenseItems.filter(function(row) { return isCanonicalActive(row.IsActive); })
    .map(function(row) { return { expenseItemId: String(row.ID_Ops), item: String(row.Item), category: String(row.Kategori), kind: String(row.Kind), group: String(row.Group) }; })
    .sort(function(a, b) { return a.item.localeCompare(b.item) || a.expenseItemId.localeCompare(b.expenseItemId); });
  return { sales: sales, expenses: expenses };
}

function getTransactionEntryOptions() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"]);
    var expenses = readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"]);
    return { success: true, data: buildTransactionEntryOptions(products, expenses) };
  } catch (error) { return canonicalEntryFailure(error); }
}

function getProductEntryPricing(productId, type) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), timestamp = new Date();
    var context = canonicalEntryContext(ss, timestamp, "SALES");
    var entry = prepareCanonicalSalesEntry({ productId: productId, type: type, qty: 1 }, context);
    return { success: true, data: { productId: entry.productId, product: entry.product, type: entry.type,
      hpp: entry.unitHPP, price: entry.unitPrice, unitMargin: entry.margin } };
  } catch (error) { return canonicalEntryFailure(error); }
}

function submitCanonicalTransaction(payload) {
  var type = payload && typeof payload.transactionType === "string" ? payload.transactionType.trim() : "";
  if (type !== "SALES" && type !== "EXPENSE") {
    return canonicalEntryFailure(canonicalEntryError("INVALID_TRANSACTION_TYPE",
      "Transaction type must be SALES or EXPENSE.", "transactionType"));
  }
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000);
    acquired = true;
    var ss = SpreadsheetApp.getActiveSpreadsheet(), timestamp = new Date();
    var context = canonicalEntryContext(ss, timestamp, type);
    var entry = type === "SALES" ? prepareCanonicalSalesEntry(payload, context) : prepareCanonicalExpenseEntry(payload, context);
    var sheetName = type === "SALES" ? "tabsal" : "tabops";
    var sheet = ss.getSheetByName(sheetName);
    var id = generateCanonicalEntryId(type === "SALES" ? "SAL-APP-" : "OPS-APP-", timestamp,
      function() { return Utilities.getUuid(); }, function(candidate) { return canonicalSheetHasId(sheet, candidate); });
    var values = type === "SALES"
      ? [id, timestamp, entry.productId, entry.type, entry.qty, entry.unitHPP, entry.unitPrice,
        CANONICAL_ENTRY.SOURCE, true, timestamp, CANONICAL_ENTRY.USER, "", ""]
      : [id, timestamp, entry.expenseItemId, entry.amount, CANONICAL_ENTRY.SOURCE, true,
        timestamp, CANONICAL_ENTRY.USER, "", ""];
    persistCanonicalEntry(ss, { sheetName: sheetName,
      headers: type === "SALES" ? CANONICAL_ENTRY.SALES_HEADERS : CANONICAL_ENTRY.EXPENSE_HEADERS,
      values: values, timestamp: timestamp, id: id, action: type === "SALES" ? "CREATE_SALES" : "CREATE_EXPENSE" });
    invalidateDashboardCache();
    entry.id = id;
    entry.timestamp = Utilities.formatDate(timestamp, CANONICAL_ENTRY.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    return { success: true, data: entry };
  } catch (error) { return canonicalEntryFailure(error); }
  finally { if (acquired) lock.releaseLock(); }
}

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
