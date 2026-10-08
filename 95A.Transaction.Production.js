var TRANSACTION_PRODUCTION_CONTRACT = Object.freeze({
  PRODUCT_VARIANTS: Object.freeze({ SHEET: "ProductVariants", HEADERS: Object.freeze(["ProductVariantID", "ProductID", "Tipe", "EffectiveFrom", "EffectiveTo", "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]) }),
  RECIPE_VERSIONS: Object.freeze({ SHEET: "RecipeVersions", HEADERS: Object.freeze(["RecipeVersionID", "ProductVariantID", "EffectiveFrom", "EffectiveTo", "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]) }),
  RECIPE_VERSION_LINES: Object.freeze({ SHEET: "RecipeVersionLines", HEADERS: Object.freeze(["RecipeVersionLineID", "RecipeVersionID", "ItemID", "QtyBase", "BaseUOM"]) }),
  ORDERS: Object.freeze({ SHEET: "Orders", HEADERS: Object.freeze(["OrderID", "OrderNumber", "OrderType", "PaymentStatus", "FulfillmentStatus", "OrderTotal", "HppTotalSnapshot", "CreatedAt", "CreatedBy", "PreparingAt", "ReadyAt", "CompletedAt", "UpdatedAt", "UpdatedBy"]) }),
  ORDER_LINES: Object.freeze({ SHEET: "OrderLines", HEADERS: Object.freeze(["OrderLineID", "OrderID", "ProductID", "ProductVariantID", "Tipe", "Qty", "SellingPriceSnapshot", "RecipeVersionID", "UnitHppSnapshot", "LineTotal", "LineHpp"]) }),
  PAYMENTS: Object.freeze({ SHEET: "Payments", HEADERS: Object.freeze(["PaymentID", "OrderID", "RequestKey", "ReceiveVia", "AccountCode", "Amount", "PaidAt", "PaidBy", "Status"]) }),
  OPERATIONS: Object.freeze({ SHEET: "TransactionOperations", HEADERS: Object.freeze(["OperationID", "OperationType", "BusinessID", "RequestKey", "State", "PayloadHash", "OperationPlan", "CreatedAt", "UpdatedAt", "LastError"]) })
});

function transactionVariantType_(value) {
  var type = String(value || "").trim().toUpperCase();
  if (type !== "HOT" && type !== "COLD") throw transactionOperationalError_("INVALID_VARIANT_TYPE", "Tipe");
  return type;
}

function transactionStableBootstrapId_(prefix, parts) {
  var text = parts.join("|").toUpperCase(), hash = 2166136261;
  for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24); }
  return prefix + (hash >>> 0).toString(16).toUpperCase() + "-" + text.replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function transactionEffectiveRows_(rows, productID, tipe, at) {
  return (rows || []).filter(function(row) {
    var start = canonicalDate(row.EffectiveFrom), end = row.EffectiveTo ? canonicalDate(row.EffectiveTo) : null;
    return String(row.ID_Prod || "").trim() === productID && transactionVariantType_(row.Tipe) === tipe &&
      isCanonicalActive(row.IsActive) && start && start <= at && (!end || at <= end);
  });
}

function buildProductVariantBootstrapPlan(input, activationBoundary) {
  var source = input || {}, at = canonicalDate(activationBoundary), blocked = [], rows = [], pairs = Object.create(null);
  if (!at) return { status: "REFUSED", reason: "INVALID_ACTIVATION_BOUNDARY", rows: [], blocked: [], planCount: 0, blockedCount: 1, writeCount: 0 };
  (source.products || []).filter(function(p) { return isCanonicalActive(p.IsActive); }).forEach(function(product) {
    var productID = String(product.ID_Prod || product.ProductID || "").trim();
    (source.pricing || []).forEach(function(price) {
      if (String(price.ID_Prod || "").trim() !== productID || !isCanonicalActive(price.IsActive)) return;
      var tipe;
      try { tipe = transactionVariantType_(price.Tipe); } catch (error) { blocked.push({ productID: productID, tipe: String(price.Tipe || ""), code: error.code }); return; }
      var key = productID + "|" + tipe;
      if (pairs[key]) return;
      pairs[key] = true;
      var prices = transactionEffectiveRows_(source.pricing, productID, tipe, at);
      var recipes = (source.recipes || []).filter(function(recipe) {
        return String(recipe.ID_Prod || "").trim() === productID && transactionVariantType_(recipe.Tipe) === tipe && isCanonicalActive(recipe.IsActive);
      });
      if (prices.length !== 1 || !(Number(prices[0].Harga) > 0)) blocked.push({ productID: productID, tipe: tipe, code: prices.length > 1 ? "AMBIGUOUS_PRICE" : "MISSING_PRICE" });
      else if (!recipes.length) blocked.push({ productID: productID, tipe: tipe, code: "MISSING_RECIPE" });
      else rows.push({ ProductVariantID: transactionStableBootstrapId_("PV-", [productID, tipe]), ProductID: productID, Tipe: tipe,
        EffectiveFrom: at, EffectiveTo: "", IsActive: true, CreatedAt: at, CreatedBy: "TRANSACTION_ACTIVATION", UpdatedAt: at, UpdatedBy: "TRANSACTION_ACTIVATION" });
    });
  });
  rows.sort(function(a, b) { return (a.ProductID + "|" + a.Tipe).localeCompare(b.ProductID + "|" + b.Tipe); });
  return { status: blocked.length ? "BLOCKED" : "READY", rows: rows, blocked: blocked.slice(0, 100), planCount: rows.length, blockedCount: blocked.length, writeCount: 0 };
}

function buildRecipeVersionBootstrapPlan(input, activationBoundary) {
  var source = input || {}, at = canonicalDate(activationBoundary), blocked = [], versions = [], lines = [];
  if (!at) return { status: "REFUSED", reason: "INVALID_ACTIVATION_BOUNDARY", versions: [], lines: [], planCount: 0, blockedCount: 1, writeCount: 0 };
  var items = transactionOperationalMap_(source.items, "ItemID"), variants = transactionOperationalMap_(source.productVariants, "ProductVariantID");
  (source.productVariants || []).filter(function(v) { return isCanonicalActive(v.IsActive); }).forEach(function(variant) {
    var productID = String(variant.ProductID || "").trim(), tipe = transactionVariantType_(variant.Tipe), variantID = String(variant.ProductVariantID || "").trim();
    var components = (source.recipes || []).filter(function(recipe) {
      return String(recipe.ID_Prod || "").trim() === productID && transactionVariantType_(recipe.Tipe) === tipe && isCanonicalActive(recipe.IsActive);
    });
    var errors = [];
    if (!variants[variantID]) errors.push("MISSING_PRODUCT_VARIANT");
    if (!components.length) errors.push("MISSING_RECIPE");
    components.forEach(function(component) {
      var item = items[String(component.ID_Ingredient || "").trim()], qty = Number(component.UsageQty);
      if (!item || !String(item.BaseUOM || "").trim()) errors.push("INVALID_INGREDIENT");
      if (!(qty > 0)) errors.push("INVALID_RECIPE_QTY");
      var costs = (source.standardCosts || []).filter(function(cost) {
        var start = canonicalDate(cost.EffectiveFrom), end = cost.EffectiveTo ? canonicalDate(cost.EffectiveTo) : null;
        return item && String(cost.ItemID || "").trim() === String(item.ItemID) && isCanonicalActive(cost.IsActive) && start && start <= at && (!end || at <= end);
      });
      if (costs.length !== 1 || !(Number(costs[0].StandardCost) >= 0)) errors.push("STANDARD_COST_NOT_AVAILABLE");
    });
    if (errors.length) { blocked.push({ productVariantID: variantID, codes: errors }); return; }
    var versionID = transactionStableBootstrapId_("RV-", [variantID, String(at.getTime())]);
    versions.push({ RecipeVersionID: versionID, ProductVariantID: variantID, EffectiveFrom: at, EffectiveTo: "", IsActive: true,
      CreatedAt: at, CreatedBy: "TRANSACTION_ACTIVATION", UpdatedAt: at, UpdatedBy: "TRANSACTION_ACTIVATION" });
    components.forEach(function(component, index) {
      var item = items[String(component.ID_Ingredient).trim()];
      lines.push({ RecipeVersionLineID: transactionStableBootstrapId_("RVL-", [versionID, String(index + 1), item.ItemID]),
        RecipeVersionID: versionID, ItemID: item.ItemID, QtyBase: Number(component.UsageQty), BaseUOM: item.BaseUOM });
    });
  });
  return { status: blocked.length ? "BLOCKED" : "READY", versions: versions, lines: lines, blocked: blocked.slice(0, 100),
    planCount: versions.length, blockedCount: blocked.length, effectiveFrom: at, writeCount: 0 };
}

function transactionSchemaState_(sheet, contract) {
  if (!sheet) return { sheetExists: false, headers: [], headersExact: false, businessRowCount: 0, formulaCount: 0, formulaPresence: false,
    noteCount: 0, notePresence: false, schemaCollision: false, activationDisposition: "READY_CREATE" };
  var lastRow = sheet.getLastRow(), lastColumn = sheet.getLastColumn();
  var headers = lastRow && lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String) : [];
  var exact = JSON.stringify(headers) === JSON.stringify(contract.HEADERS), cells = lastRow && lastColumn ? sheet.getRange(1, 1, lastRow, lastColumn) : null;
  var formulas = cells ? cells.getFormulas() : [], notes = cells && typeof cells.getNotes === "function" ? cells.getNotes() : [];
  var formulaCount = formulas.reduce(function(n, row) { return n + row.filter(Boolean).length; }, 0);
  var noteCount = notes.reduce(function(n, row) { return n + row.filter(Boolean).length; }, 0);
  return { sheetExists: true, headers: headers, headersExact: exact, businessRowCount: Math.max(0, lastRow - 1),
    formulaCount: formulaCount, formulaPresence: formulaCount > 0, noteCount: noteCount, notePresence: noteCount > 0,
    schemaCollision: !exact, activationDisposition: exact ? "READY_EXISTING" : lastRow === 0 ? "BLOCKED_SCHEMA_MISMATCH" : "BLOCKED_COLLISION" };
}

function buildTransactionSchemaActivationPlan(state) {
  var actions = [], blocked = [];
  Object.keys(TRANSACTION_PRODUCTION_CONTRACT).forEach(function(key) {
    var disposition = state[key].activationDisposition;
    if (disposition === "READY_CREATE") actions.push({ action: "CREATE_HEADER_ONLY", sheet: TRANSACTION_PRODUCTION_CONTRACT[key].SHEET,
      headers: TRANSACTION_PRODUCTION_CONTRACT[key].HEADERS.slice() });
    else if (disposition !== "READY_EXISTING") blocked.push({ sheet: TRANSACTION_PRODUCTION_CONTRACT[key].SHEET, disposition: disposition });
  });
  return { status: blocked.length ? "BLOCKED" : actions.length ? "READY" : "ALREADY_READY", actions: actions, blocked: blocked, writeCount: 0 };
}

function transactionReadRecipeVersions_(ss) {
  var versions = readCanonicalTable(ss, TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSIONS.SHEET, TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSIONS.HEADERS);
  var lines = readCanonicalTable(ss, TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSION_LINES.SHEET, TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSION_LINES.HEADERS);
  return versions.map(function(version) { return Object.assign({}, version, { Components: lines.filter(function(line) { return line.RecipeVersionID === version.RecipeVersionID; })
    .map(function(line) { return { ItemID: line.ItemID, QtyBase: line.QtyBase, UOM: line.BaseUOM }; }) }); });
}

function createTransactionSpreadsheetRepository(ss) {
  if (!ss || String(ss.getId()) !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) throw new Error("TRANSACTION_CANONICAL_STORAGE_REQUIRED");
  var contracts = TRANSACTION_PRODUCTION_CONTRACT, sheets = {};
  ["ORDERS", "ORDER_LINES", "PAYMENTS", "OPERATIONS"].forEach(function(key) { sheets[key] = ss.getSheetByName(contracts[key].SHEET); requireCanonicalHeaders(sheets[key], contracts[key].HEADERS); });
  function rows(key) { return readCanonicalTable(ss, contracts[key].SHEET, contracts[key].HEADERS); }
  function append(key, row) { var c = contracts[key], s = sheets[key]; s.getRange(s.getLastRow() + 1, 1, 1, c.HEADERS.length).setValues([c.HEADERS.map(function(h) { return row[h] === undefined ? "" : row[h]; })]); }
  function orderWithLines(row) { if (!row) return null; var order = Object.assign({}, row); order.Lines = rows("ORDER_LINES").filter(function(line) { return line.OrderID === order.OrderID; }); return order; }
  function exactMatches(row, expected, headers) { return headers.every(function(h) { return String(row[h] == null ? "" : row[h]) === String(expected[h] == null ? "" : expected[h]); }); }
  function update(key, existing, row) { var c = contracts[key]; sheets[key].getRange(existing.sourceRowIndex + 1, 1, 1, c.HEADERS.length)
    .setValues([c.HEADERS.map(function(h) { return row[h] === undefined ? "" : row[h]; })]); }
  return {
    readRows: rows,
    read: function() { return { orders: rows("ORDERS").map(orderWithLines), payments: rows("PAYMENTS"), operations: rows("OPERATIONS"), paymentMethods: transactionReadPaymentMethods_(ss) }; },
    findOperation: function(type, requestKey) { var found = rows("OPERATIONS").filter(function(row) { return row.OperationType === type && row.RequestKey === requestKey; }); if (found.length > 1) throw new Error("DUPLICATE_OPERATION"); return found[0] || null; },
    createOperation: function(row) { if (this.findOperation(row.OperationType, row.RequestKey)) throw new Error("DUPLICATE_OPERATION"); append("OPERATIONS", row); SpreadsheetApp.flush(); return row; },
    updateOperation: function(row) { var found = this.findOperation(row.OperationType, row.RequestKey); if (!found || found.OperationID !== row.OperationID) throw new Error("OPERATION_NOT_FOUND"); update("OPERATIONS", found, row); SpreadsheetApp.flush(); return row; },
    findPaymentByRequest: function(key) { var found = rows("PAYMENTS").filter(function(row) { return row.RequestKey === key; }); if (found.length > 1) throw new Error("DUPLICATE_PAYMENT_REQUEST"); return found[0] || null; },
    findOrder: function(id) { var matches = rows("ORDERS").filter(function(row) { return row.OrderID === id || row.OrderNumber === id; }); if (matches.length > 1) throw new Error("DUPLICATE_ORDER"); return orderWithLines(matches[0] || null); },
    listOpenOrders: function() { return rows("ORDERS").filter(function(row) { return row.PaymentStatus !== "PAID" || row.FulfillmentStatus !== "COMPLETED"; }).map(orderWithLines).slice(-20).reverse(); },
    createOrder: function(order) {
      if (!order.Lines || !order.Lines.length) throw transactionOperationalError_("ORDER_LINES_REQUIRED", "Lines");
      var orderRow = Object.assign({}, order); delete orderRow.Lines;
      var existingOrder = this.findOrder(order.OrderID);
      if (!existingOrder) append("ORDERS", orderRow);
      else if (!exactMatches(existingOrder, orderRow, contracts.ORDERS.HEADERS)) throw transactionOperationalError_("ORDER_IDENTITY_CONFLICT", "OrderID");
      var existingLines = transactionOperationalMap_(rows("ORDER_LINES"), "OrderLineID");
      order.Lines.forEach(function(line, index) { var planned = Object.assign({}, line, { OrderLineID: line.OrderLineID || "OL-" + order.OrderID + "-" + (index + 1), OrderID: order.OrderID,
        ProductID: line.productID, ProductVariantID: line.productVariantID, Tipe: line.tipe, Qty: line.qty, SellingPriceSnapshot: line.sellingPriceSnapshot,
        RecipeVersionID: line.recipeVersionID, UnitHppSnapshot: line.unitHppSnapshot, LineTotal: line.lineTotal, LineHpp: line.lineHpp });
        if (!existingLines[planned.OrderLineID]) append("ORDER_LINES", planned);
        else if (!exactMatches(existingLines[planned.OrderLineID], planned, contracts.ORDER_LINES.HEADERS)) throw transactionOperationalError_("ORDER_LINE_IDENTITY_CONFLICT", "OrderLineID"); });
      SpreadsheetApp.flush(); return order;
    },
    updateOrder: function(order) { var current = rows("ORDERS").filter(function(row) { return row.OrderID === order.OrderID; }); if (current.length !== 1) throw new Error("ORDER_NOT_FOUND");
      sheets.ORDERS.getRange(current[0].sourceRowIndex + 1, 1, 1, contracts.ORDERS.HEADERS.length).setValues([contracts.ORDERS.HEADERS.map(function(h) { return order[h]; })]); SpreadsheetApp.flush(); return order; },
    createPayment: function(payment) { var existing = rows("PAYMENTS"); if (existing.some(function(row) { return row.PaymentID === payment.PaymentID || row.OrderID === payment.OrderID && row.Status === "SUCCESS"; })) throw transactionOperationalError_("SECOND_PAYMENT_REFUSED", "OrderID"); append("PAYMENTS", payment); SpreadsheetApp.flush(); return payment; }
  };
}

function transactionReadPaymentMethods_(ss) {
  return readCanonicalTable(ss, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS).filter(function(row) {
    return CASH_FOUNDATION_POLICY.ACCOUNT_CODES.indexOf(String(row.AccountCode)) !== -1 && isCanonicalActive(row.IsActive);
  }).map(function(row) { return { code: row.AccountCode, label: row.AccountName, AccountCode: row.AccountCode, IsActive: true }; });
}

function transactionReadSuppliers_(ss) {
  return ss.getSheetByName(SUPPLIER_MASTER_CONTRACT.SHEET) ?
    readCanonicalTable(ss, SUPPLIER_MASTER_CONTRACT.SHEET, SUPPLIER_MASTER_CONTRACT.HEADERS) : [];
}

function transactionProductionAuthority_(ss) {
  var products = readCanonicalTable(ss, "Products", PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS).map(function(row) {
    return { ProductID: row.ID_Prod, Name: row.Produk, IsActive: row.IsActive };
  });
  return { products: products,
    productVariants: readCanonicalTable(ss, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.SHEET, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS),
    recipeVersions: transactionReadRecipeVersions_(ss), pricing: readCanonicalTable(ss, "ProductPricing", PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS),
    items: readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS),
    standardCosts: readCanonicalTable(ss, RECIPE_STANDARD_COST_CONTRACT.SHEET, RECIPE_STANDARD_COST_CONTRACT.HEADERS),
    suppliers: transactionReadSuppliers_(ss),
    conversions: readCanonicalTable(ss, "InventoryUOMConversions", BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS),
    paymentMethods: transactionReadPaymentMethods_(ss) };
}

function transactionProductionRuntime_() {
  var ss = requireNumlockProductionSpreadsheet(), runtime = { spreadsheet: ss, lock: LockService.getScriptLock(),
    now: function() { return new Date(); }, uuid: function() { return Utilities.getUuid(); }, flush: function() { SpreadsheetApp.flush(); },
    orderSequence: function() { return Utilities.formatDate(new Date(), CANONICAL_ENTRY.TIMEZONE, "yyyyMMddHHmmss") + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 4); },
    actor: function() { return Session.getActiveUser().getEmail() || CANONICAL_ENTRY.USER; },
    settle: function(request) { return runCashSettleAndPersist(request); } };
  Object.defineProperty(runtime, "repository", { configurable: true, enumerable: true, get: function() {
    var repository = createTransactionSpreadsheetRepository(ss);
    Object.defineProperty(runtime, "repository", { configurable: true, enumerable: true, value: repository });
    return repository;
  } });
  return runtime;
}

function transactionResponse_(operation) { try { return { success: true, data: operation() }; } catch (error) { return { success: false, error: { code: error.code || error.entryCode || "WRITE_FAILED", message: error.message, field: error.field || error.entryField || null } }; } }

function transactionPayloadHash_(value) {
  function canonical(v) { if (Array.isArray(v)) return v.map(canonical); if (v && typeof v === "object" && !(v instanceof Date)) { var out = {}; Object.keys(v).sort().forEach(function(k) { out[k] = canonical(v[k]); }); return out; } return v instanceof Date ? v.toISOString() : v; }
  return transactionStableBootstrapId_("H-", [JSON.stringify(canonical(value))]);
}
function transactionOperationID_(type, requestKey) { return transactionStableBootstrapId_("TXOP-", [type, requestKey]); }
function transactionOperation_(type, businessID, requestKey, hash, plan, now) { return { OperationID: transactionOperationID_(type, requestKey), OperationType: type,
  BusinessID: businessID, RequestKey: requestKey, State: "IN_PROGRESS", PayloadHash: hash, OperationPlan: JSON.stringify(plan), CreatedAt: now, UpdatedAt: now, LastError: "" }; }
function transactionResolveOperation_(repository, type, requestKey, hash, businessID, plan, now) {
  var existing = repository.findOperation(type, requestKey);
  if (existing) { if (existing.PayloadHash !== hash || existing.BusinessID !== businessID || existing.OperationPlan !== JSON.stringify(plan)) throw transactionOperationalError_("OPERATION_PAYLOAD_CONFLICT", "requestKey"); return existing; }
  return repository.createOperation(transactionOperation_(type, businessID, requestKey, hash, plan, now));
}
function transactionCommitOperation_(repository, operation, now) { operation.State = "COMMITTED"; operation.UpdatedAt = now; operation.LastError = ""; return repository.updateOperation(operation); }
function transactionStableBusinessID_(prefix) { return transactionStableBootstrapId_(prefix, Array.prototype.slice.call(arguments, 1)); }

function createDurableOperationalOrder_(payload, authority, runtime, repository) {
  var requestKey = transactionOperationalText_(payload && payload.requestKey, "REQUEST_KEY_REQUIRED", "requestKey");
  var normalized = { orderType: payload.orderType, lines: (payload.lines || []).map(function(line) { return { productID: line.productID, productVariantID: line.productVariantID, qty: line.qty }; }) };
  var hash = transactionPayloadHash_(normalized), orderID = transactionStableBusinessID_("ORD-", "ORDER_CREATE", requestKey), now = runtime.now();
  var deterministic = { now: function() { return now; }, uuid: function() { return orderID.slice(4); }, orderSequence: function() { return orderID.slice(4); }, actor: runtime.actor };
  var order = prepareOperationalOrder(normalized, authority, deterministic); order.OrderID = orderID; order.OrderNumber = orderID;
  order.Lines.forEach(function(line, index) { line.OrderLineID = transactionStableBusinessID_("OL-", orderID, String(index + 1)); });
  var operation = transactionResolveOperation_(repository, "ORDER_CREATE", requestKey, hash, orderID, order, now);
  if (runtime.crash) runtime.crash("ORDER_AFTER_INTENT");
  var committed = repository.findOrder(orderID); if (operation.State === "COMMITTED") { if (!committed) throw new Error("COMMITTED_ORDER_MISSING"); return committed; }
  order = JSON.parse(operation.OperationPlan);
  repository.createOrder(order);
  if (runtime.crash) runtime.crash("ORDER_AFTER_PERSIST");
  var readback = repository.findOrder(orderID), expected = transactionOperationalMap_(order.Lines, "OrderLineID"), actual = transactionOperationalMap_(readback && readback.Lines, "OrderLineID");
  if (!readback || Object.keys(actual).length !== order.Lines.length || Object.keys(expected).some(function(id) { return !actual[id] || actual[id].ProductVariantID !== expected[id].productVariantID || Number(actual[id].SellingPriceSnapshot) !== Number(expected[id].sellingPriceSnapshot) || actual[id].RecipeVersionID !== expected[id].recipeVersionID; })) throw new Error("ORDER_READBACK_INCOMPLETE");
  if (runtime.crash) runtime.crash("ORDER_BEFORE_COMMIT");
  transactionCommitOperation_(repository, operation, runtime.now()); return readback;
}

function transactionFinanceSettlementExists_(ss, paymentID) {
  return readCanonicalTable(ss, CASH_SCHEMA_MIGRATION.SETTLEMENTS_SHEET, CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS).filter(function(row) { return row.SettlementID === "CSH-SAL-" + paymentID && row.SourceID === paymentID && row.Status === "POSTED" && isCanonicalActive(row.IsActive); }).length === 1;
}
function createDurableOperationalPayment_(orderID, payload, runtime, repository) {
  // U7: V2 cohort orders are refused before the first write (payment intent,
  // Receive Via, settlement and PAID transition are retired for V2 sales).
  salesV2OperatorPaymentGuard_(orderID, repository, runtime && runtime.spreadsheet);
  var requestKey = transactionOperationalText_(payload && payload.requestKey, "REQUEST_KEY_REQUIRED", "requestKey"), hash = transactionPayloadHash_({ orderID: orderID, receiveVia: payload.receiveVia, amount: payload.amount });
  var paymentID = transactionStableBusinessID_("PAY-", "PAYMENT", requestKey), plan = { orderID: orderID, paymentID: paymentID, requestKey: requestKey,
    receiveVia: payload.receiveVia, amount: payload.amount }, operation = transactionResolveOperation_(repository, "PAYMENT", requestKey, hash, paymentID, plan, runtime.now());
  if (runtime.crash) runtime.crash("PAYMENT_AFTER_INTENT");
  plan = JSON.parse(operation.OperationPlan); orderID = plan.orderID; payload = { requestKey: plan.requestKey, receiveVia: plan.receiveVia, amount: plan.amount };
  var order = repository.findOrder(orderID); if (!order) throw transactionOperationalError_("ORDER_NOT_FOUND", "OrderID");
  var existing = repository.findPaymentByRequest(requestKey), successful = (repository.read().payments || []).filter(function(p) { return p.OrderID === orderID && p.Status === "SUCCESS"; });
  if (!existing && successful.length) throw transactionOperationalError_("SECOND_PAYMENT_REFUSED", "OrderID");
  if (operation.State === "COMMITTED") return { payment: existing, order: order, idempotent: true, writeCount: 0 };
  var method = transactionOperationalMap_(repository.read().paymentMethods, "code")[transactionOperationalText_(payload.receiveVia, "RECEIVE_VIA_REQUIRED", "receiveVia")];
  if (!method || !masterSelectionEligible(method.IsActive)) throw transactionOperationalError_("INVALID_RECEIVE_VIA", "receiveVia");
  if (Number(payload.amount) !== Number(order.OrderTotal)) throw transactionOperationalError_("PAYMENT_AMOUNT_MISMATCH", "amount");
  var payment = existing || { PaymentID: paymentID, OrderID: orderID, RequestKey: requestKey, ReceiveVia: payload.receiveVia, AccountCode: method.AccountCode,
    Amount: order.OrderTotal, PaidAt: operation.CreatedAt, PaidBy: runtime.actor(), Status: "SUCCESS" };
  var financeExists = runtime.financeExists ? runtime.financeExists(paymentID) : transactionFinanceSettlementExists_(runtime.spreadsheet, paymentID);
  if (!financeExists) {
    var settlement = runtime.settle({ settlement: buildOperationalPaymentSettlement_(order, payment), order: order });
    if (!settlement || ["POSTED", "ALREADY_POSTED"].indexOf(settlement.status) === -1) throw transactionOperationalError_("PAYMENT_FINANCE_CUTOVER_BLOCKED", "settlement");
  }
  if (runtime.crash) runtime.crash("PAYMENT_AFTER_FINANCE");
  if (!existing) repository.createPayment(payment);
  if (runtime.crash) runtime.crash("PAYMENT_AFTER_ROW");
  order = repository.findOrder(orderID); if (order.PaymentStatus !== "PAID") repository.updateOrder(Object.assign({}, order, { PaymentStatus: "PAID", UpdatedAt: runtime.now(), UpdatedBy: runtime.actor() }));
  if (runtime.crash) runtime.crash("PAYMENT_AFTER_ORDER_PAID");
  var paid = repository.findOrder(orderID), stored = repository.findPaymentByRequest(requestKey);
  financeExists = runtime.financeExists ? runtime.financeExists(paymentID) : transactionFinanceSettlementExists_(runtime.spreadsheet, paymentID);
  if (!stored || stored.PaymentID !== paymentID || paid.PaymentStatus !== "PAID" || !financeExists) throw new Error("PAYMENT_READBACK_INCOMPLETE");
  if (runtime.crash) runtime.crash("PAYMENT_BEFORE_COMMIT");
  transactionCommitOperation_(repository, operation, runtime.now()); return { payment: stored, order: paid, idempotent: !!existing, writeCount: existing ? 0 : 2 };
}

function transactionAuthorityTransportDate_(value, field) {
  if (value === "" || value === null) return value;
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) throw new Error("INVALID_AUTHORITY_TRANSPORT_DATE:" + field);
  return date.toISOString();
}
function transactionAuthorityTransportRequired_(value, field) {
  if (["string", "number", "boolean"].indexOf(typeof value) === -1 || String(value).trim() === "") throw new Error("MISSING_AUTHORITY_TRANSPORT_FIELD:" + field);
  if (typeof value === "number" && !isFinite(value)) throw new Error("INVALID_AUTHORITY_TRANSPORT_NUMBER:" + field);
  return value;
}
function transactionAuthorityTransportFinite_(value, field) {
  var number = Number(value);
  if (!isFinite(number)) throw new Error("INVALID_AUTHORITY_TRANSPORT_NUMBER:" + field);
  return number;
}
function validateTransactionAuthorityTransport_(value, path) {
  var type = typeof value;
  if (value === null || type === "string" || type === "boolean") return;
  if (type === "number") { if (!isFinite(value)) throw new Error("INVALID_AUTHORITY_TRANSPORT_VALUE:" + path); return; }
  if (Array.isArray(value)) { value.forEach(function(item, index) { validateTransactionAuthorityTransport_(item, path + "[" + index + "]"); }); return; }
  var prototype = type === "object" ? Object.getPrototypeOf(value) : null;
  if (type !== "object" || value instanceof Date || prototype && (!prototype.constructor || prototype.constructor.name !== "Object")) throw new Error("INVALID_AUTHORITY_TRANSPORT_VALUE:" + path);
  Object.keys(value).forEach(function(key) { validateTransactionAuthorityTransport_(value[key], path + "." + key); });
}
function transactionOperationalOrderTransportDto_(order) {
  if (!order) return null;
  var dto = {};
  TRANSACTION_PRODUCTION_CONTRACT.ORDERS.HEADERS.forEach(function(field) {
    dto[field] = ["CreatedAt", "PreparingAt", "ReadyAt", "CompletedAt", "UpdatedAt"].indexOf(field) !== -1
      ? transactionAuthorityTransportDate_(order[field], "Order." + field) : order[field];
  });
  dto.Lines = (order.Lines || []).map(function(line) {
    var projected = {};
    TRANSACTION_PRODUCTION_CONTRACT.ORDER_LINES.HEADERS.forEach(function(field) { projected[field] = line[field]; });
    return projected;
  });
  validateTransactionAuthorityTransport_(dto, "order");
  return dto;
}
function transactionAuthorityTransportDto_(authority, now) {
  var dto = {
    products: authority.products,
    productVariants: authority.productVariants.filter(function(row) { return isCanonicalActive(row.IsActive); }).map(function(row) {
      var prices = transactionEffectiveRows_(authority.pricing, row.ProductID, transactionVariantType_(row.Tipe), now);
      return { ProductVariantID: transactionAuthorityTransportRequired_(row.ProductVariantID, "ProductVariantID"),
        ProductID: transactionAuthorityTransportRequired_(row.ProductID, "ProductID"), Tipe: transactionAuthorityTransportRequired_(row.Tipe, "Tipe"),
        EffectiveFrom: transactionAuthorityTransportDate_(row.EffectiveFrom, "ProductVariant.EffectiveFrom"),
        EffectiveTo: transactionAuthorityTransportDate_(row.EffectiveTo, "ProductVariant.EffectiveTo"), IsActive: isCanonicalActive(row.IsActive),
        SellingPrice: prices.length === 1 ? transactionAuthorityTransportFinite_(prices[0].Harga, "SellingPrice") : null };
    }),
    suppliers: buildSupplierReadModel_(authority.suppliers, true),
    purchaseItems: authority.purchaseItems,
    expenseItems: authority.expenseItems,
    items: authority.items.filter(function(row) { return isCanonicalActive(row.IsActive); }).map(function(row) {
      return { ItemID: transactionAuthorityTransportRequired_(row.ItemID, "ItemID"), ItemName: transactionAuthorityTransportRequired_(row.ItemName, "ItemName"),
        Classification: transactionAuthorityTransportRequired_(row.Classification, "Classification"), BaseUOM: transactionAuthorityTransportRequired_(row.BaseUOM, "BaseUOM"),
        EffectiveFrom: transactionAuthorityTransportDate_(row.EffectiveFrom, "Item.EffectiveFrom"), EffectiveTo: transactionAuthorityTransportDate_(row.EffectiveTo, "Item.EffectiveTo"),
        IsActive: isCanonicalActive(row.IsActive) };
    }),
    conversions: authority.conversions.filter(function(row) { return isCanonicalActive(row.IsActive); }).map(function(row) {
      var purchaseUOM = row.PurchaseUOM || row.FromUOM, baseUOM = row.BaseUOM || row.ToUOM;
      var factor = row.FactorToBase !== undefined && row.FactorToBase !== "" ? row.FactorToBase : Number(row.Numerator) / Number(row.Denominator);
      return { ConversionID: transactionAuthorityTransportRequired_(row.ConversionID, "ConversionID"), ItemID: transactionAuthorityTransportRequired_(row.ItemID, "Conversion.ItemID"),
        PurchaseUOM: transactionAuthorityTransportRequired_(purchaseUOM, "PurchaseUOM"), BaseUOM: transactionAuthorityTransportRequired_(baseUOM, "Conversion.BaseUOM"),
        FactorToBase: transactionAuthorityTransportFinite_(factor, "FactorToBase"), EffectiveFrom: transactionAuthorityTransportDate_(row.EffectiveFrom, "Conversion.EffectiveFrom"),
        EffectiveTo: transactionAuthorityTransportDate_(row.EffectiveTo, "Conversion.EffectiveTo"), IsActive: isCanonicalActive(row.IsActive) };
    }),
    paymentMethods: authority.paymentMethods
  };
  validateTransactionAuthorityTransport_(dto, "authority");
  return dto;
}
function getOperationalTransactionAuthority() { return transactionResponse_(function() {
  var ss = requireNumlockProductionSpreadsheet(), authority = transactionProductionAuthority_(ss);
  var expenses = readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]);
  authority.purchaseItems = expenses.filter(function(e) {
    if (!isCanonicalActive(e.IsActive)) return false; try { var route = resolveExpensePurchasePolicy_(e.ID_Ops, [e]); return expensePolicyIsPurchase_(route) && route.inventoryItemIds.length === 1; } catch (error) { return false; }
  }).map(function(e) { var route = EXPENSE_PURCHASE_POLICY.rows.filter(function(r) { return r.expenseItemId === e.ID_Ops; })[0]; return { ExpenseItemID: e.ID_Ops, ItemID: route.inventoryItemIds[0], label: e.Item }; });
  authority.expenseItems = expenses.filter(function(e) {
    if (!isCanonicalActive(e.IsActive)) return false; try { return !expensePolicyIsPurchase_(resolveExpensePurchasePolicy_(e.ID_Ops, [e])); } catch (error) { return false; }
  }).map(function(e) { return { ExpenseItemID: e.ID_Ops, label: e.Item + " · " + e.Kategori }; });
  return transactionAuthorityTransportDto_(authority, new Date());
}); }
function submitOperationalOrder(payload) {
  // U7: config-aware routing for NEW Sales orders. PREPARED keeps the exact
  // legacy durable order writer; ACTIVE routes to the V2 durable Save only;
  // PAUSED/invalid refuse with no legacy fallback.
  var route = salesV2OperatorResolvedRoute_();
  if (route.mode !== "PREPARED") return salesV2OperatorModeCreateOrder_(payload, route);
  return transactionResponse_(function() { var r = transactionProductionRuntime_(), acquired = false; try { r.lock.waitLock(30000); acquired = true; return createDurableOperationalOrder_(payload, transactionProductionAuthority_(r.spreadsheet), r, r.repository); } finally { if (acquired) r.lock.releaseLock(); } });
}
function findOperationalOrder(identifier) { return transactionResponse_(function() { var id = transactionOperationalText_(identifier, "ORDER_IDENTIFIER_REQUIRED", "identifier"); var r = transactionProductionRuntime_(); var dto = transactionOperationalOrderTransportDto_(r.repository.findOrder(id)); return salesV2OperatorAnnotateOrder_(dto, r.repository, r.spreadsheet); }); }
function listOpenOperationalOrders() { return transactionResponse_(function() { return transactionProductionRuntime_().repository.listOpenOrders().map(transactionOperationalOrderTransportDto_); }); }
function findOperationalOperation(payload) { return transactionResponse_(function() { var p = payload || {}, type = transactionOperationalText_(p.operationType, "OPERATION_TYPE_REQUIRED", "operationType"), key = transactionOperationalText_(p.requestKey, "REQUEST_KEY_REQUIRED", "requestKey"), r = transactionProductionRuntime_(), operation = r.repository.findOperation(type, key);
  // U7: RequestKey identity is stable across mode routing — the same key may
  // be persisted under the routed V2 operation type; an exact single match is
  // authoritative, an ambiguous match fails closed (null below).
  if (!operation) operation = salesV2OperatorFindOperationByRequestKey_(r.repository, key);
  var order = operation && operation.BusinessID ? r.repository.findOrder(operation.BusinessID) : null;
  if (order) salesV2OperatorAnnotateOrder_(order, r.repository, r.spreadsheet);
  return { operation: operation, order: order, payment: type === "PAYMENT" || operation && operation.OperationType === "PAYMENT" ? r.repository.findPaymentByRequest(key) : null }; }); }
function submitOperationalFulfillment(payload) { return transactionResponse_(function() { var r = transactionProductionRuntime_(), acquired = false; try { r.lock.waitLock(30000); acquired = true; return transitionOperationalFulfillmentWithRepository(payload.orderID, payload.next, r, r.repository).order; } finally { if (acquired) r.lock.releaseLock(); } }); }
function submitOperationalPayment(payload) { return transactionResponse_(function() { var r = transactionProductionRuntime_(), acquired = false; try { r.lock.waitLock(30000); acquired = true; return createDurableOperationalPayment_(payload.orderID, payload, r, r.repository); } finally { if (acquired) r.lock.releaseLock(); } }); }
function submitOperationalPurchase(payload) { return transactionResponse_(function() {
  var r = transactionProductionRuntime_(), acquired = false;
  try {
    r.lock.waitLock(30000); acquired = true;
    var expenses = readCanonicalTable(r.spreadsheet, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]);
    var authority = transactionProductionAuthority_(r.spreadsheet); authority.expenses = expenses;
    var request = normalizeCanonicalTransactionPurchase_(payload, authority), history = readCanonicalTable(r.spreadsheet, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
    var matches = history.filter(function(row) { return row.RequestKey === request.requestKey; });
    if (matches.length > 1) throw new Error("DUPLICATE_PURCHASE_REQUEST");
    if (matches.length === 1) { if (matches[0].NormalizedPayload !== JSON.stringify(request)) throw new Error("PURCHASE_REQUEST_CONFLICT"); return projectPurchaseEventTransaction_(matches[0]); }
    var expense = transactionOperationalMap_(expenses, "ID_Ops")[request.expenseItemId], row = buildCanonicalTransactionPurchaseEvent_(request, expense, { actor: r.actor(), at: r.now().toISOString() });
    var sheet = r.spreadsheet.getSheetByName(PURCHASE_EVENT_POLICY.sheet); requireCanonicalHeaders(sheet, PURCHASE_EVENT_POLICY.headers);
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, PURCHASE_EVENT_POLICY.headers.length).setValues([PURCHASE_EVENT_POLICY.headers.map(function(h) { return row[h]; })]);
    SpreadsheetApp.flush();
    var purchaseRuntime = purchaseEventProductionRuntime_(r.spreadsheet, r.lock, expenses, r.now());
    var accounting = postPolicyCPurchaseEvent_(row, purchaseRuntime);
    if (["POSTED", "ALREADY_POSTED"].indexOf(accounting.status) === -1) throw transactionOperationalError_("PURCHASE_ACCOUNTING_BLOCKED", "expenseItemID");
    row = purchaseRuntime.readPurchaseEvent(row.EventID) || row;
    return Object.assign(projectPurchaseEventTransaction_(row), { paymentStatus: "PAID", receiptStatus: "RECEIVED", accountingStatus: row.AccountingStatus,
      inventoryWrites: 0, payableWrites: 0 });
  } finally { if (acquired) r.lock.releaseLock(); }
}); }
function submitOperationalExpense(payload) {
  return submitCanonicalTransaction({ transactionType: "EXPENSE", expenseItemId: payload && payload.expenseItemID,
    amount: Number(payload && payload.amount), expenseDate: payload && payload.date, cashAccountCode: payload && payload.paidVia });
}

function runTransactionProductionPreflightDiagnostic() {
  var ss = requireNumlockProductionSpreadsheet(), schema = {}, source = {};
  Object.keys(TRANSACTION_PRODUCTION_CONTRACT).forEach(function(key) { schema[key] = transactionSchemaState_(ss.getSheetByName(TRANSACTION_PRODUCTION_CONTRACT[key].SHEET), TRANSACTION_PRODUCTION_CONTRACT[key]); });
  schema.SUPPLIERS = transactionSchemaState_(ss.getSheetByName(SUPPLIER_MASTER_CONTRACT.SHEET), SUPPLIER_MASTER_CONTRACT);
  source.products = readCanonicalTable(ss, "Products", PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS);
  source.pricing = readCanonicalTable(ss, "ProductPricing", PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS);
  source.recipes = readCanonicalTable(ss, "COGSRecipes", PRODUCTS_DOMAIN_CONTRACT.RECIPE_HEADERS);
  source.items = readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS);
  source.standardCosts = readCanonicalTable(ss, RECIPE_STANDARD_COST_CONTRACT.SHEET, RECIPE_STANDARD_COST_CONTRACT.HEADERS);
  var boundary = new Date(), variantPlan = buildProductVariantBootstrapPlan(source, boundary);
  var existingVariants = schema.PRODUCT_VARIANTS.headersExact ? readCanonicalTable(ss, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.SHEET, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS) : [];
  var recipePlan = buildRecipeVersionBootstrapPlan(Object.assign({}, source, { productVariants: existingVariants.length ? existingVariants : variantPlan.rows }), boundary);
  var methods = transactionReadPaymentMethods_(ss);
  return { readOnly: true, writeCount: 0, schema: schema, schemaPlan: buildTransactionSchemaActivationPlan(schema),
    variantReadiness: { authoritativeProductCount: source.products.length, authoritativeVariantPairCount: variantPlan.planCount + variantPlan.blockedCount,
      eligibleProductVariantCount: variantPlan.planCount, blockedCount: variantPlan.blockedCount, blockers: variantPlan.blocked },
    recipeVersionReadiness: { existingRecipeVersionCount: schema.RECIPE_VERSIONS.businessRowCount, variantsRequiringBootstrap: recipePlan.planCount,
      bootstrapPlanCount: recipePlan.planCount, bootstrapBlockedCount: recipePlan.blockedCount, bootstrapReady: recipePlan.status === "READY", blockers: recipePlan.blocked },
    operationReadiness: { schema: schema.OPERATIONS, recoveryEntrypointPresent: typeof recoverTransactionOperation === "function",
      persistedPlanAuthority: TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS.indexOf("OperationPlan") !== -1 },
    purchaseReadiness: { ready: typeof normalizeCanonicalTransactionPurchase_ === "function" && typeof postPolicyCPurchaseEvent_ === "function",
      authority: "ExpenseItems.ID_Ops -> EXPENSE_PURCHASE_POLICY -> ItemID", evidenceRequired: false, attestationRequired: false },
    expenseReadiness: { ready: typeof submitCanonicalTransaction === "function", authority: "ExpenseItems.ID_Ops", paidAtRecognition: true },
    financePreimage: { receiveViaAuthorityReady: methods.length > 0, requiredCashAccountsReady: methods.length === CASH_FOUNDATION_POLICY.ACCOUNT_CODES.length,
      orderPaymentSettlementSourceReady: typeof runCashSettleAndPersist === "function", legacySalesPathPresent: !!ss.getSheetByName("tabsal"), paymentCorrelation: "PaymentID" } };
}

function executeTransactionSchemaActivationWithRuntime(runtime) {
  var lock = runtime.lock, acquired = false, ss = runtime.spreadsheet;
  try {
    lock.waitLock(30000); acquired = true;
    var state = {};
    Object.keys(TRANSACTION_PRODUCTION_CONTRACT).forEach(function(key) { state[key] = transactionSchemaState_(ss.getSheetByName(TRANSACTION_PRODUCTION_CONTRACT[key].SHEET), TRANSACTION_PRODUCTION_CONTRACT[key]); });
    var plan = buildTransactionSchemaActivationPlan(state);
    if (plan.status === "BLOCKED" || plan.status === "ALREADY_READY") return Object.assign({}, plan, { writeCount: 0 });
    var writes = 0;
    plan.actions.forEach(function(action) { var sheet = ss.insertSheet(action.sheet); sheet.getRange(1, 1, 1, action.headers.length).setValues([action.headers]); writes++; });
    runtime.flush();
    plan.actions.forEach(function(action) { requireCanonicalHeaders(ss.getSheetByName(action.sheet), action.headers); });
    return { status: "ACTIVATED", writeCount: writes, createdSheets: plan.actions.map(function(a) { return a.sheet; }) };
  } finally { if (acquired) lock.releaseLock(); }
}

function runTransactionSchemaActivation() {
  var runtime = transactionProductionRuntime_(), state = {};
  Object.keys(TRANSACTION_PRODUCTION_CONTRACT).forEach(function(key) { state[key] = transactionSchemaState_(runtime.spreadsheet.getSheetByName(TRANSACTION_PRODUCTION_CONTRACT[key].SHEET), TRANSACTION_PRODUCTION_CONTRACT[key]); });
  var plan = buildTransactionSchemaActivationPlan(state), evaluated = Object.keys(TRANSACTION_PRODUCTION_CONTRACT).map(function(key) { return TRANSACTION_PRODUCTION_CONTRACT[key].SHEET; });
  var ready = evaluated.filter(function(sheet) { return plan.actions.every(function(action) { return action.sheet !== sheet; }) && plan.blocked.every(function(conflict) { return conflict.sheet !== sheet; }); });
  var creating = plan.actions.map(function(action) { return action.sheet; }), conflicts = plan.blocked.slice();
  if (plan.status === "BLOCKED") return { status: "REFUSED", schemasEvaluated: evaluated, schemasReady: ready, schemasRequiringCreation: creating,
    schemasRefused: conflicts.map(function(conflict) { return conflict.sheet; }), createdSchemaCount: 0, writeCount: 0, errors: conflicts, conflicts: conflicts };
  var result = executeTransactionSchemaActivationWithRuntime(runtime);
  return { status: result.status, schemasEvaluated: evaluated, schemasReady: ready, schemasRequiringCreation: creating, schemasRefused: [],
    createdSchemaCount: (result.createdSheets || []).length, writeCount: result.writeCount || 0, errors: [], conflicts: [] };
}

function transactionBootstrapSource_(ss) {
  return { products: readCanonicalTable(ss, "Products", PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS),
    pricing: readCanonicalTable(ss, "ProductPricing", PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS),
    recipes: readCanonicalTable(ss, "COGSRecipes", PRODUCTS_DOMAIN_CONTRACT.RECIPE_HEADERS),
    items: readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS),
    standardCosts: readCanonicalTable(ss, RECIPE_STANDARD_COST_CONTRACT.SHEET, RECIPE_STANDARD_COST_CONTRACT.HEADERS) };
}

function transactionAppendExactRows_(sheet, headers, rows) {
  if (!rows.length) return 0;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows.map(function(row) { return headers.map(function(h) { return row[h] === undefined ? "" : row[h]; }); }));
  return rows.length;
}

function executeProductVariantBootstrapWithRuntime(runtime, activationBoundary) {
  var lock = runtime.lock, acquired = false, ss = runtime.spreadsheet;
  try {
    lock.waitLock(30000); acquired = true;
    var contract = TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS, sheet = ss.getSheetByName(contract.SHEET); requireCanonicalHeaders(sheet, contract.HEADERS);
    var plan = buildProductVariantBootstrapPlan(transactionBootstrapSource_(ss), activationBoundary);
    if (plan.status !== "READY" || runtime.requiredProductVariantCandidateCount != null && plan.planCount !== runtime.requiredProductVariantCandidateCount)
      return Object.assign({}, plan, { status: "REFUSED", reason: plan.status !== "READY" ? "PRODUCT_VARIANT_BOOTSTRAP_NOT_READY" : "PRODUCT_VARIANT_CANDIDATE_COUNT_MISMATCH", writeCount: 0 });
    var existing = readCanonicalTable(ss, contract.SHEET, contract.HEADERS), index = transactionOperationalMap_(existing, "ProductVariantID"), pending = [];
    plan.rows.forEach(function(row) { var found = index[row.ProductVariantID]; if (!found) pending.push(row); else if (String(found.ProductID) !== row.ProductID || transactionVariantType_(found.Tipe) !== row.Tipe) throw new Error("PRODUCT_VARIANT_IDENTITY_CONFLICT"); });
    var writes = transactionAppendExactRows_(sheet, contract.HEADERS, pending); runtime.flush();
    return { status: writes ? "APPLIED" : "ALREADY_APPLIED", rowCount: writes, writeCount: writes };
  } finally { if (acquired) lock.releaseLock(); }
}

function runProductVariantProductionBootstrap() {
  var expected = 53, boundary = new Date(), runtime = transactionProductionRuntime_();
  var contract = TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS;
  var schema = transactionSchemaState_(runtime.spreadsheet.getSheetByName(contract.SHEET), contract);
  var plan = schema.headersExact ? buildProductVariantBootstrapPlan(transactionBootstrapSource_(runtime.spreadsheet), boundary) :
    { status: "REFUSED", planCount: 0, blockedCount: 1, blocked: [{ code: "PRODUCT_VARIANTS_SCHEMA_NOT_EXACT" }] };
  if (plan.status !== "READY" || plan.planCount !== expected || plan.blockedCount !== 0) return { status: "REFUSED", eligibleCandidateCount: plan.planCount,
    blockedCount: plan.blockedCount, createdProductVariantCount: 0, writeCount: 0, errors: plan.blocked, conflicts: [], activationBoundary: boundary.toISOString() };
  runtime.requiredProductVariantCandidateCount = expected;
  var result = executeProductVariantBootstrapWithRuntime(runtime, boundary);
  return { status: result.status, eligibleCandidateCount: plan.planCount, blockedCount: plan.blockedCount,
    createdProductVariantCount: result.rowCount || 0, writeCount: result.writeCount || 0, errors: [], conflicts: [], activationBoundary: boundary.toISOString() };
}

function executeRecipeVersionBootstrapWithRuntime(runtime, activationBoundary) {
  var lock = runtime.lock, acquired = false, ss = runtime.spreadsheet;
  try {
    lock.waitLock(30000); acquired = true;
    var vc = TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSIONS, lc = TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSION_LINES;
    var vs = ss.getSheetByName(vc.SHEET), ls = ss.getSheetByName(lc.SHEET); requireCanonicalHeaders(vs, vc.HEADERS); requireCanonicalHeaders(ls, lc.HEADERS);
    var source = transactionBootstrapSource_(ss); source.productVariants = readCanonicalTable(ss, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.SHEET, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS);
    var plan = buildRecipeVersionBootstrapPlan(source, activationBoundary);
    if (plan.status !== "READY" || runtime.requiredRecipeVersionCandidateCount != null && plan.planCount !== runtime.requiredRecipeVersionCandidateCount)
      return Object.assign({}, plan, { status: "REFUSED", reason: plan.status !== "READY" ? "RECIPE_VERSION_BOOTSTRAP_NOT_READY" : "RECIPE_VERSION_CANDIDATE_COUNT_MISMATCH", writeCount: 0 });
    var existing = transactionOperationalMap_(readCanonicalTable(ss, vc.SHEET, vc.HEADERS), "RecipeVersionID"), pendingVersions = [], pendingLines = [];
    plan.versions.forEach(function(row) { if (!existing[row.RecipeVersionID]) pendingVersions.push(row); else if (existing[row.RecipeVersionID].ProductVariantID !== row.ProductVariantID) throw new Error("RECIPE_VERSION_IDENTITY_CONFLICT"); });
    var lineIndex = transactionOperationalMap_(readCanonicalTable(ss, lc.SHEET, lc.HEADERS), "RecipeVersionLineID");
    plan.lines.forEach(function(row) { if (!lineIndex[row.RecipeVersionLineID]) pendingLines.push(row); });
    var writes = transactionAppendExactRows_(vs, vc.HEADERS, pendingVersions) + transactionAppendExactRows_(ls, lc.HEADERS, pendingLines); runtime.flush();
    return { status: writes ? "APPLIED" : "ALREADY_APPLIED", versionRows: pendingVersions.length, lineRows: pendingLines.length, writeCount: writes };
  } finally { if (acquired) lock.releaseLock(); }
}

function runRecipeVersionProductionBootstrap() {
  var expected = 53, boundary = new Date(), runtime = transactionProductionRuntime_(), source = transactionBootstrapSource_(runtime.spreadsheet);
  source.productVariants = readCanonicalTable(runtime.spreadsheet, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.SHEET, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS);
  var plan = buildRecipeVersionBootstrapPlan(source, boundary);
  if (plan.status !== "READY" || plan.planCount !== expected || plan.blockedCount !== 0) return { status: "REFUSED", eligibleCandidateCount: plan.planCount,
    blockedCount: plan.blockedCount, createdRecipeVersionCount: 0, createdRecipeVersionLineCount: 0, writeCount: 0, errors: plan.blocked,
    conflicts: [], activationBoundary: boundary.toISOString() };
  runtime.requiredRecipeVersionCandidateCount = expected;
  var result = executeRecipeVersionBootstrapWithRuntime(runtime, boundary);
  return { status: result.status, eligibleCandidateCount: plan.planCount, blockedCount: plan.blockedCount,
    createdRecipeVersionCount: result.versionRows || 0, createdRecipeVersionLineCount: result.lineRows || 0, writeCount: result.writeCount || 0,
    errors: [], conflicts: [], activationBoundary: boundary.toISOString() };
}

function recoverTransactionOperationWithRuntime_(operationID, r) {
  var id = transactionOperationalText_(operationID, "OPERATION_ID_REQUIRED", "operationID");
  var stored = salesV2OperatorOperationRows_(r.repository) || [];
  var matches = stored.filter(function(row) { return row.OperationID === id; });
  if (matches.length !== 1) throw transactionOperationalError_("OPERATION_NOT_FOUND", "operationID");
  var operation = matches[0];
  if (operation.State === "COMMITTED") return operation;
  // U7: persisted V2 operations recover ONLY through the V2 cores (resume
  // from the frozen plan). The legacy dispatcher never reinterprets them as
  // ORDER_CREATE/PAYMENT work and never rewrites them into legacy results.
  if (salesV2OperatorIsRecoveryOperation_(operation.OperationType)) {
    return salesV2OperatorRecoverWithRuntime_(operation, r);
  }
  if (operation.OperationType === "ORDER_CREATE") {
    var orderPlan = JSON.parse(operation.OperationPlan); r.repository.createOrder(orderPlan);
    var order = r.repository.findOrder(operation.BusinessID);
    if (!order || order.Lines.length !== orderPlan.Lines.length) throw transactionOperationalError_("ORDER_RECOVERY_INCOMPLETE", "operationID");
    transactionCommitOperation_(r.repository, operation, r.now()); return operation;
  }
  if (operation.OperationType === "PAYMENT") {
    var plan = JSON.parse(operation.OperationPlan);
    createDurableOperationalPayment_(plan.orderID, { requestKey: plan.requestKey, receiveVia: plan.receiveVia, amount: plan.amount }, r, r.repository);
    return r.repository.findOperation("PAYMENT", plan.requestKey);
  }
  throw transactionOperationalError_("UNKNOWN_OPERATION_TYPE", "operationID");
}

function recoverTransactionOperation(operationID) {
  return transactionResponse_(function() {
    var r = transactionProductionRuntime_(), acquired = false;
    try { r.lock.waitLock(30000); acquired = true; return recoverTransactionOperationWithRuntime_(operationID, r); }
    finally { if (acquired) r.lock.releaseLock(); }
  });
}
