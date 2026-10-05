var TRANSACTION_PRODUCTION_CONTRACT = Object.freeze({
  PRODUCT_VARIANTS: Object.freeze({ SHEET: "ProductVariants", HEADERS: Object.freeze(["ProductVariantID", "ProductID", "Tipe", "EffectiveFrom", "EffectiveTo", "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]) }),
  RECIPE_VERSIONS: Object.freeze({ SHEET: "RecipeVersions", HEADERS: Object.freeze(["RecipeVersionID", "ProductVariantID", "EffectiveFrom", "EffectiveTo", "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]) }),
  RECIPE_VERSION_LINES: Object.freeze({ SHEET: "RecipeVersionLines", HEADERS: Object.freeze(["RecipeVersionLineID", "RecipeVersionID", "ItemID", "QtyBase", "BaseUOM"]) }),
  ORDERS: Object.freeze({ SHEET: "Orders", HEADERS: Object.freeze(["OrderID", "OrderNumber", "OrderType", "PaymentStatus", "FulfillmentStatus", "OrderTotal", "HppTotalSnapshot", "CreatedAt", "CreatedBy", "PreparingAt", "ReadyAt", "CompletedAt", "UpdatedAt", "UpdatedBy"]) }),
  ORDER_LINES: Object.freeze({ SHEET: "OrderLines", HEADERS: Object.freeze(["OrderLineID", "OrderID", "ProductID", "ProductVariantID", "Tipe", "Qty", "SellingPriceSnapshot", "RecipeVersionID", "UnitHppSnapshot", "LineTotal", "LineHpp"]) }),
  PAYMENTS: Object.freeze({ SHEET: "Payments", HEADERS: Object.freeze(["PaymentID", "OrderID", "RequestKey", "ReceiveVia", "AccountCode", "Amount", "PaidAt", "PaidBy", "Status"]) }),
  OPERATIONS: Object.freeze({ SHEET: "TransactionOperations", HEADERS: Object.freeze(["OperationID", "OperationType", "BusinessID", "RequestKey", "State", "PayloadHash", "CreatedAt", "UpdatedAt", "LastError"]) })
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
  return {
    read: function() { return { orders: rows("ORDERS").map(orderWithLines), payments: rows("PAYMENTS"), paymentMethods: transactionReadPaymentMethods_(ss) }; },
    findOrder: function(id) { var matches = rows("ORDERS").filter(function(row) { return row.OrderID === id; }); if (matches.length > 1) throw new Error("DUPLICATE_ORDER"); return orderWithLines(matches[0] || null); },
    createOrder: function(order) {
      if (!order.Lines || !order.Lines.length) throw transactionOperationalError_("ORDER_LINES_REQUIRED", "Lines");
      if (this.findOrder(order.OrderID) || rows("ORDERS").some(function(row) { return row.OrderNumber === order.OrderNumber; })) throw transactionOperationalError_("DUPLICATE_ORDER", "OrderID");
      var orderRow = Object.assign({}, order); delete orderRow.Lines;
      append("ORDERS", orderRow);
      order.Lines.forEach(function(line, index) { append("ORDER_LINES", Object.assign({}, line, { OrderLineID: "OL-" + order.OrderID + "-" + (index + 1), OrderID: order.OrderID,
        ProductID: line.productID, ProductVariantID: line.productVariantID, Tipe: line.tipe, Qty: line.qty, SellingPriceSnapshot: line.sellingPriceSnapshot,
        RecipeVersionID: line.recipeVersionID, UnitHppSnapshot: line.unitHppSnapshot, LineTotal: line.lineTotal, LineHpp: line.lineHpp })); });
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

function transactionProductionAuthority_(ss) {
  var products = readCanonicalTable(ss, "Products", PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS).map(function(row) {
    return { ProductID: row.ID_Prod, Name: row.Produk, IsActive: row.IsActive };
  });
  return { products: products,
    productVariants: readCanonicalTable(ss, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.SHEET, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS),
    recipeVersions: transactionReadRecipeVersions_(ss), pricing: readCanonicalTable(ss, "ProductPricing", PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS),
    items: readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS),
    standardCosts: readCanonicalTable(ss, RECIPE_STANDARD_COST_CONTRACT.SHEET, RECIPE_STANDARD_COST_CONTRACT.HEADERS),
    suppliers: readCanonicalTable(ss, SUPPLIER_MASTER_CONTRACT.SHEET, SUPPLIER_MASTER_CONTRACT.HEADERS),
    conversions: readCanonicalTable(ss, "InventoryUOMConversions", BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS),
    paymentMethods: transactionReadPaymentMethods_(ss) };
}

function transactionProductionRuntime_() {
  var ss = requireNumlockProductionSpreadsheet();
  return { spreadsheet: ss, repository: createTransactionSpreadsheetRepository(ss), lock: LockService.getScriptLock(),
    now: function() { return new Date(); }, uuid: function() { return Utilities.getUuid(); },
    orderSequence: function() { return Utilities.formatDate(new Date(), CANONICAL_ENTRY.TIMEZONE, "yyyyMMddHHmmss") + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 4); },
    actor: function() { return Session.getActiveUser().getEmail() || CANONICAL_ENTRY.USER; },
    settle: function(request) { return runCashSettleAndPersist(request); } };
}

function transactionResponse_(operation) { try { return { success: true, data: operation() }; } catch (error) { return { success: false, error: { code: error.code || error.entryCode || "WRITE_FAILED", message: error.message, field: error.field || error.entryField || null } }; } }

function getOperationalTransactionAuthority() { return transactionResponse_(function() { var a = transactionProductionAuthority_(requireNumlockProductionSpreadsheet()), now = new Date(); return {
  products: a.products, productVariants: a.productVariants.filter(function(v) { return isCanonicalActive(v.IsActive); }).map(function(v) {
    var prices = transactionEffectiveRows_(a.pricing, v.ProductID, transactionVariantType_(v.Tipe), now);
    return Object.assign({}, v, { SellingPrice: prices.length === 1 ? Number(prices[0].Harga) : null });
  }), suppliers: buildSupplierReadModel_(a.suppliers, true),
  items: a.items.filter(function(i) { return isCanonicalActive(i.IsActive); }), conversions: a.conversions.filter(function(c) { return isCanonicalActive(c.IsActive); }), paymentMethods: a.paymentMethods }; }); }
function submitOperationalOrder(payload) { return transactionResponse_(function() { var r = transactionProductionRuntime_(), acquired = false; try { r.lock.waitLock(30000); acquired = true; return createOperationalOrderWithRepository(payload, transactionProductionAuthority_(r.spreadsheet), r, r.repository).order; } finally { if (acquired) r.lock.releaseLock(); } }); }
function submitOperationalFulfillment(payload) { return transactionResponse_(function() { var r = transactionProductionRuntime_(), acquired = false; try { r.lock.waitLock(30000); acquired = true; return transitionOperationalFulfillmentWithRepository(payload.orderID, payload.next, r, r.repository).order; } finally { if (acquired) r.lock.releaseLock(); } }); }
function submitOperationalPayment(payload) { return transactionResponse_(function() { var r = transactionProductionRuntime_(), acquired = false; try { r.lock.waitLock(30000); acquired = true; return payOperationalOrderWithRepository(payload.orderID, payload, r, r.repository); } finally { if (acquired) r.lock.releaseLock(); } }); }
function submitOperationalPurchase(payload) { return { success: false, error: { code: "PURCHASE_CANONICAL_PAYLOAD_REQUIRED", message: "Use canonical PurchaseEvent entry with expense and evidence authority.", field: null } }; }
function submitOperationalExpense(payload) { return { success: false, error: { code: "EXPENSE_ITEM_AUTHORITY_REQUIRED", message: "Use canonical Expense entry with ExpenseItem authority.", field: null } }; }

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
    operationReadiness: { schema: schema.OPERATIONS, recoveryEntrypointPresent: typeof recoverTransactionOperation === "function" },
    purchaseReadiness: { ready: false, reason: "PURCHASEEVENT_BUSINESS_CONTRACT_CONFLICT" },
    expenseReadiness: { ready: true, authority: "ExpenseItems.ID_Ops" },
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
    if (plan.status !== "READY") return Object.assign({}, plan, { writeCount: 0 });
    var existing = readCanonicalTable(ss, contract.SHEET, contract.HEADERS), index = transactionOperationalMap_(existing, "ProductVariantID"), pending = [];
    plan.rows.forEach(function(row) { var found = index[row.ProductVariantID]; if (!found) pending.push(row); else if (String(found.ProductID) !== row.ProductID || transactionVariantType_(found.Tipe) !== row.Tipe) throw new Error("PRODUCT_VARIANT_IDENTITY_CONFLICT"); });
    var writes = transactionAppendExactRows_(sheet, contract.HEADERS, pending); runtime.flush();
    return { status: writes ? "APPLIED" : "ALREADY_APPLIED", rowCount: writes, writeCount: writes };
  } finally { if (acquired) lock.releaseLock(); }
}

function executeRecipeVersionBootstrapWithRuntime(runtime, activationBoundary) {
  var lock = runtime.lock, acquired = false, ss = runtime.spreadsheet;
  try {
    lock.waitLock(30000); acquired = true;
    var vc = TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSIONS, lc = TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSION_LINES;
    var vs = ss.getSheetByName(vc.SHEET), ls = ss.getSheetByName(lc.SHEET); requireCanonicalHeaders(vs, vc.HEADERS); requireCanonicalHeaders(ls, lc.HEADERS);
    var source = transactionBootstrapSource_(ss); source.productVariants = readCanonicalTable(ss, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.SHEET, TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS);
    var plan = buildRecipeVersionBootstrapPlan(source, activationBoundary);
    if (plan.status !== "READY") return Object.assign({}, plan, { writeCount: 0 });
    var existing = transactionOperationalMap_(readCanonicalTable(ss, vc.SHEET, vc.HEADERS), "RecipeVersionID"), pendingVersions = [], pendingLines = [];
    plan.versions.forEach(function(row) { if (!existing[row.RecipeVersionID]) pendingVersions.push(row); else if (existing[row.RecipeVersionID].ProductVariantID !== row.ProductVariantID) throw new Error("RECIPE_VERSION_IDENTITY_CONFLICT"); });
    var lineIndex = transactionOperationalMap_(readCanonicalTable(ss, lc.SHEET, lc.HEADERS), "RecipeVersionLineID");
    plan.lines.forEach(function(row) { if (!lineIndex[row.RecipeVersionLineID]) pendingLines.push(row); });
    var writes = transactionAppendExactRows_(vs, vc.HEADERS, pendingVersions) + transactionAppendExactRows_(ls, lc.HEADERS, pendingLines); runtime.flush();
    return { status: writes ? "APPLIED" : "ALREADY_APPLIED", versionRows: pendingVersions.length, lineRows: pendingLines.length, writeCount: writes };
  } finally { if (acquired) lock.releaseLock(); }
}

function recoverTransactionOperation(operationID) {
  return transactionResponse_(function() {
    transactionOperationalText_(operationID, "OPERATION_ID_REQUIRED", "operationID");
    throw transactionOperationalError_("RECOVERY_NOT_IMPLEMENTED", "operationID");
  });
}
