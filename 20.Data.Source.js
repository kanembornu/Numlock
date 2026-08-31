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
    invalidDateRowIndexes: [], inactiveLedgerRows: 0, malformedRows: 0, unresolvedForeignKeys: 0,
    unresolvedProducts: [], unresolvedExpenseItems: [] };

  source.sales.forEach(function(row) {
    var active = isCanonicalActive(row.IsActive);
    if (!active) quality.inactiveLedgerRows++;
    var date = canonicalDate(row.Tanggal);
    var id = String(row.ID_Prod || "").trim();
    var master = products[id];
    var qty = Number(row.Qty), hpp = Number(row.HPP), price = Number(row.HJ);
    if (!date) { quality.invalidDateRowIndexes.push("tabsal:" + row.sourceRowIndex); return; }
    if (!master) {
      quality.unresolvedForeignKeys++;
      quality.unresolvedProducts.push({ transactionId: String(row.ID_Trx || ""), productId: id,
        dateKey: canonicalDateKey(date), reason: "UNKNOWN_PRODUCT" });
      return;
    }
    if (!isFinite(qty) || !isFinite(hpp) || !isFinite(price)) { quality.malformedRows++; return; }
    var revenue = qty * price, cogs = qty * hpp;
    var dateKey = canonicalDateKey(date);
    var salesRecord = { id: String(row.ID_Trx || ""), timestamp: date, date: date, dateKey: dateKey,
      monthKey: dateKey.slice(0, 7),
      year: date.getFullYear(), month: date.getMonth() + 1,
      transactionType: "Sales", canonicalTransactionType: "Sales", type: String(row.Tipe || "").trim(),
      productId: id, product: String(master.Produk || "").trim(),
      productIsActive: isCanonicalActive(master.IsActive),
      revenueAccountCode: String(master.RevenueAccountCode || "").trim(),
      cogsAccountCode: String(master.COGSAccountCode || "").trim(),
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
    if (!master) {
      quality.unresolvedForeignKeys++;
      quality.unresolvedExpenseItems.push({ transactionId: String(row.ID_Trx || ""), expenseItemId: id,
        dateKey: canonicalDateKey(date), reason: "UNKNOWN_EXPENSE_ITEM" });
      return;
    }
    if (!isFinite(amount)) { quality.malformedRows++; return; }
    var dateKey = canonicalDateKey(date);
    var expenseRecord = { id: String(row.ID_Trx || ""), timestamp: date, date: date, dateKey: dateKey,
      monthKey: dateKey.slice(0, 7),
      year: date.getFullYear(), month: date.getMonth() + 1,
      transactionType: "Purchase", canonicalTransactionType: "Expense", type: "Expense",
      productId: null, product: "", productCategory: "", category: String(master.Kategori || "").trim(),
      kind: String(master.Kind || "").trim(), group: String(master.Group || "").trim(),
      purchaseCategory: String(master.Item || "").trim(), expenseId: id,
      expenseItemIsActive: isCanonicalActive(master.IsActive),
      expenseAccountCode: String(master.AccountCode || "").trim(),
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
