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

function buildTransactionEntryOptions(products, expenseItems, pricingRows, referenceDate) {
  var pricingIndex = buildProductPricingIndex(pricingRows || []);
  var sales = products.filter(function(row) { return isCanonicalActive(row.IsActive); })
    .map(function(row) {
      var productId = String(row.ID_Prod);
      var pricing = {};
      ["Hot", "Cold"].forEach(function(type) {
        if (!pricingIndex[productId.trim() + "|" + type]) return;
        var price = resolveProductPrice(pricingIndex, productId, type, referenceDate || new Date(), true);
        pricing[type] = { productId: productId, product: String(row.Produk), type: type,
          hpp: Number(price.HPP) || 0, price: Number(price.Harga) || 0,
          unitMargin: (Number(price.Harga) || 0) - (Number(price.HPP) || 0) };
      });
      return { productId: productId, product: String(row.Produk), category: String(row.Kategori), kind: String(row.Kind), pricing: pricing };
    })
    .sort(function(a, b) { return a.product.localeCompare(b.product) || a.productId.localeCompare(b.productId); });
  var expenses = expenseItems.filter(function(row) { return isCanonicalActive(row.IsActive); })
    .map(function(row) { return { expenseItemId: String(row.ID_Ops), item: String(row.Item), category: String(row.Kategori), kind: String(row.Kind), group: String(row.Group) }; })
    .sort(function(a, b) { return a.item.localeCompare(b.item) || a.expenseItemId.localeCompare(b.expenseItemId); });
  return { sales: sales, expenses: expenses };
}

function getTransactionEntryOptions() {
  try {
    var revision = typeof getDashboardCacheRevision === "function" ? getDashboardCacheRevision() : "0";
    var cache = CacheService.getScriptCache();
    var cacheKey = "transaction-entry-options-v2|" + revision;
    var cached = cache.get(cacheKey);
    if (cached) return { success: true, data: JSON.parse(cached), cacheHit: true };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"]);
    var expenses = readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"]);
    var pricing = readCanonicalTable(ss, "ProductPricing", ["ID_Prod", "Tipe", "EffectiveFrom", "EffectiveTo", "HPP", "Harga", "IsActive"]);
    var data = buildTransactionEntryOptions(products, expenses, pricing, new Date());
    data.revision = revision;
    cache.put(cacheKey, JSON.stringify(data), 300);
    return { success: true, data: data, cacheHit: false };
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
