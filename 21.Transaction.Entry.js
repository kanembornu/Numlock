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

function buildTransactionEntryOptions(products, expenseItems, pricingRows, referenceDate, registry) {
  var coverage = registry ? validateInventoryExpenseRouting_(expenseItems, registry).routes : validateExpensePurchasePolicy_(expenseItems);
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
  var expenses = expenseItems.filter(function(row) {
    return isCanonicalActive(row.IsActive) && (registry ? coverage[String(row.ID_Ops).trim()].classification === "ORDINARY_EXPENSE" : coverage[String(row.ID_Ops).trim()].prospectiveEligible);
  })
    .map(function(row) { return { expenseItemId: String(row.ID_Ops), item: String(row.Item), category: String(row.Kategori), kind: String(row.Kind), group: String(row.Group),
      costType: registry ? null : coverage[row.ID_Ops].CostType,
      purchaseRequired: registry ? false : expensePolicyIsPurchase_(coverage[row.ID_Ops]) }; })
    .sort(function(a, b) { return a.item.localeCompare(b.item) || a.expenseItemId.localeCompare(b.expenseItemId); });
  return { sales: sales, expenses: expenses };
}

function getTransactionEntryOptions() {
  try {
    var revision = typeof getDashboardCacheRevision === "function" ? getDashboardCacheRevision() : "0";
    var cache = CacheService.getScriptCache();
    var cacheKey = "transaction-entry-options-v4|" + EXPENSE_PURCHASE_POLICY.version + "|" + revision;
    var cached = cache.get(cacheKey);
    if (cached) return { success: true, data: JSON.parse(cached), cacheHit: true };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"]);
    var expenses = readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"]);
    var pricing = readCanonicalTable(ss, "ProductPricing", ["ID_Prod", "Tipe", "EffectiveFrom", "EffectiveTo", "HPP", "Harga", "IsActive"]);
    var data = buildTransactionEntryOptions(products, expenses, pricing, new Date());
    data.policyVersion = EXPENSE_PURCHASE_POLICY.version;
    data.purchaseEnabled = EXPENSE_PURCHASE_POLICY.enabled;
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

// The public boundary never accepts a client-supplied runtime or activation capability.
function submitCanonicalTransaction(payload) {
  return submitCanonicalTransactionWithRuntime_(payload, {
    environment: "PRODUCTION", lock: LockService.getScriptLock(),
    spreadsheet: function() { return SpreadsheetApp.getActiveSpreadsheet(); },
    now: function() { return new Date(); }, uuid: function() { return Utilities.getUuid(); },
    flush: function() { SpreadsheetApp.flush(); }, invalidate: function() { invalidateDashboardCache(); }
  });
}

// Private shared dispatcher: synthetic adapters exercise exactly the same routing and writer.
function submitCanonicalTransactionWithRuntime_(payload, runtime) {
  var type = payload && typeof payload.transactionType === "string" ? payload.transactionType : "";
  if (["SALES", "EXPENSE", "INVENTORY_RECEIPT"].indexOf(type) === -1) {
    var refused = canonicalEntryFailure(canonicalEntryError("INVALID_TRANSACTION_TYPE",
      "Transaction type must be SALES, EXPENSE or INVENTORY_RECEIPT.", "transactionType"));
    refused.status = "REFUSED"; refused.writeCount = 0; return refused;
  }
  if (type === "INVENTORY_RECEIPT") {
    try { validateInventoryReceiptRequest_(payload); }
    catch (error) { return inventoryReceiptOrchestrationResult_("NOT_STARTED", error.message, payload && payload.requestKey, null, 0); }
  }
  var lock = runtime.lock, acquired = false, scope = null;
  try {
    lock.waitLock(30000);
    acquired = true;
    scope = { lock: lock, active: true };
    var ss = runtime.spreadsheet(), timestamp = runtime.now();
    var context, entry, sheetName, headers, prefix, action, values;
    switch (type) {
      case "INVENTORY_RECEIPT":
        return orchestrateInventoryReceiptUnderLock_(payload, inventoryReceiptProductionRuntime_(ss, lock), scope);
      case "SALES":
        context = canonicalEntryContext(ss, timestamp, "SALES");
        entry = prepareCanonicalSalesEntry(payload, context);
        sheetName = "tabsal"; headers = CANONICAL_ENTRY.SALES_HEADERS; prefix = "SAL-APP-"; action = "CREATE_SALES";
        values = [null, timestamp, entry.productId, entry.type, entry.qty, entry.unitHPP, entry.unitPrice,
          CANONICAL_ENTRY.SOURCE, true, timestamp, CANONICAL_ENTRY.USER, "", ""];
        break;
      case "EXPENSE":
        context = { timestamp: timestamp, expenseItems: readCanonicalTable(ss, "ExpenseItems",
          ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]) };
        var route = resolveExpensePurchasePolicy_(payload.expenseItemId, context.expenseItems);
        if (expensePolicyIsPurchase_(route)) {
          var purchaseRuntime = purchaseEventProductionRuntime_(ss, lock, context.expenseItems, timestamp);
          if (runtime.environment === "LOCAL_FIXTURE" && runtime.purchase && runtime.purchase.environment === "LOCAL_FIXTURE") {
            purchaseRuntime = Object.assign({}, runtime.purchase, { lock: lock, read: function() {
              var state = runtime.purchase.read();
              return Object.assign({}, state, { expenses: context.expenseItems });
            } });
          }
          return orchestratePurchaseEventUnderLock_(payload, purchaseRuntime, scope);
        }
        Object.keys(payload).forEach(function(field) {
          if (["transactionType", "expenseItemId", "amount", "expenseDate"].indexOf(field) === -1) inventoryReceiptFail_("EXPENSE_ROUTE_UNKNOWN_FIELD");
        });
        context.accounts = readCanonicalTable(ss, "Accounts", ["AccountCode", "IsActive"]);
        if (payload.expenseDate !== undefined) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.expenseDate) || !capitalEquityDateKey(payload.expenseDate)) inventoryReceiptFail_("EXPENSE_ROUTE_INVALID_DATE");
          timestamp = new Date(payload.expenseDate + "T00:00:00+07:00");
          context.timestamp = timestamp;
        }
        entry = prepareCanonicalExpenseEntry(payload, context);
        sheetName = "tabops"; headers = CANONICAL_ENTRY.EXPENSE_HEADERS; prefix = "OPS-APP-"; action = "CREATE_EXPENSE";
        values = [null, timestamp, entry.expenseItemId, entry.amount, CANONICAL_ENTRY.SOURCE, true,
          timestamp, CANONICAL_ENTRY.USER, "", ""];
        break;
      default:
        throw canonicalEntryError("INVALID_TRANSACTION_TYPE", "Unsupported transaction type.", "transactionType");
    }
    var sheet = ss.getSheetByName(sheetName);
    var id = generateCanonicalEntryId(prefix, timestamp,
      runtime.uuid, function(candidate) { return canonicalSheetHasId(sheet, candidate); });
    values[0] = id;
    persistCanonicalEntry(ss, { sheetName: sheetName, headers: headers,
      values: values, timestamp: timestamp, id: id, action: action }, { flush: runtime.flush, uuid: runtime.uuid });
    runtime.invalidate();
    entry.id = id;
    entry.timestamp = Utilities.formatDate(timestamp, CANONICAL_ENTRY.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    return { success: true, data: entry };
  } catch (error) {
    var result = canonicalEntryFailure(error);
    // Only pre-persistence routing refusals carry a definite zero-write claim.
    if (/^(ROUTING_|EXPENSE_POLICY_|EXPENSE_ROUTE_|EXPENSE_ID_|EXPENSE_ITEM_NOT_ACTIVE_OR_MAPPED|INVALID_ROUTING_REGISTRY)/.test(error.message)) {
      result.status = "REFUSED"; result.writeCount = 0; result.tabopsWrites = 0;
      result.error.code = error.message;
    }
    return result;
  } finally { if (scope) scope.active = false; if (acquired) lock.releaseLock(); }
}
