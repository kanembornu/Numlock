var TRANSACTION_OPERATIONAL_CONTRACT = Object.freeze({
  ORDER_TYPES: Object.freeze(["DINE_IN", "TAKE_AWAY"]),
  FULFILLMENT: Object.freeze(["OPEN", "PREPARING", "READY", "COMPLETED"]),
  PAYMENT_STATUS: Object.freeze(["UNPAID", "PAID"]),
  ITEM_POLICY: Object.freeze({ ItemName: "MUTABLE_DESCRIPTIVE", Classification: "IMMUTABLE_AFTER_REFERENCE",
    BaseUOM: "IMMUTABLE_AFTER_REFERENCE", IsActive: "INACTIVE_INSTEAD_OF_DELETE" }),
  CONVERSION_POLICY: Object.freeze({ ItemID: "IMMUTABLE_AFTER_REFERENCE", PurchaseUOM: "VERSION_REQUIRED_AFTER_REFERENCE",
    BaseUOM: "VERSION_REQUIRED_AFTER_REFERENCE", FactorToBase: "VERSION_REQUIRED_AFTER_REFERENCE",
    IsActive: "INACTIVE_INSTEAD_OF_DELETE" })
});

function transactionOperationalError_(code, field, message) {
  var error = new Error(message || code);
  error.code = code;
  error.field = field || null;
  return error;
}

function transactionOperationalText_(value, code, field, message) {
  var text = value == null ? "" : String(value).trim();
  if (!text) throw transactionOperationalError_(code, field, message);
  return text;
}

function transactionOperationalPositive_(value, code, field) {
  var number = Number(value);
  if (!isFinite(number) || number <= 0) throw transactionOperationalError_(code, field);
  return number;
}

function transactionOperationalMap_(rows, field) {
  var map = Object.create(null);
  (rows || []).forEach(function(row) {
    var key = String(row && row[field] || "").trim();
    if (!key) return;
    if (map[key]) throw transactionOperationalError_("DUPLICATE_AUTHORITY", field);
    map[key] = row;
  });
  return map;
}

function evaluateItemMasterMutation(request) {
  var req = request || {}, record = req.record || {};
  var gate = masterEvaluateMutation({ record: record, existingRecord: req.existingRecord,
    actor: req.actor, now: req.now, lifecycle: record.IsActive, field: req.field,
    context: { hasHistoricalReferences: req.hasHistoricalReferences === true, operation: req.operation } }, {
    requiredFields: ["ItemID", "ItemName", "Classification", "BaseUOM", "IsActive"], identityField: "ItemID",
    structuralPolicyMap: TRANSACTION_OPERATIONAL_CONTRACT.ITEM_POLICY
  });
  return gate.ok ? { ok: true, errors: [], writeCount: 0,
    audit: masterBuildAuditFields(req.actor, req.now, req.existingRecord) } : gate;
}

function evaluateUomConversionMutation(request) {
  var req = request || {}, record = req.record || {};
  var gate = masterEvaluateMutation({ record: record, existingRecord: req.existingRecord,
    actor: req.actor, now: req.now, lifecycle: record.IsActive, field: req.field,
    context: { hasHistoricalReferences: req.hasHistoricalReferences === true,
      versionToken: req.versionToken, operation: req.operation } }, {
    requiredFields: ["ConversionID", "ItemID", "PurchaseUOM", "BaseUOM", "FactorToBase", "EffectiveFrom", "IsActive"],
    identityField: "ConversionID", structuralPolicyMap: TRANSACTION_OPERATIONAL_CONTRACT.CONVERSION_POLICY
  });
  var factor = Number(record.FactorToBase);
  if (!isFinite(factor) || factor <= 0) {
    gate = { ok: false, errors: (gate.errors || []).concat([masterPolicyError("INVALID_CONVERSION", "FactorToBase")]), writeCount: 0 };
  }
  return gate;
}

function resolvePurchaseConversion_(itemID, purchaseUOM, at, items, conversions, requireActive) {
  var item = transactionOperationalMap_(items, "ItemID")[itemID];
  if (!item) throw transactionOperationalError_("ITEM_NOT_FOUND", "itemID", "Item wajib dipilih.");
  if (requireActive && !masterSelectionEligible(item.IsActive)) throw transactionOperationalError_("ITEM_INACTIVE", "itemID");
  var date = canonicalDate(at);
  if (!date) throw transactionOperationalError_("INVALID_DATE", "date");
  var matches = (conversions || []).filter(function(row) {
    var start = canonicalDate(row.EffectiveFrom), end = row.EffectiveTo ? canonicalDate(row.EffectiveTo) : null;
    return String(row.ItemID || "").trim() === itemID && String(row.PurchaseUOM || "").trim() === purchaseUOM &&
      String(row.BaseUOM || "").trim() === String(item.BaseUOM || "").trim() && isCanonicalActive(row.IsActive) &&
      start && start <= date && (!end || date <= end);
  });
  if (matches.length !== 1) throw transactionOperationalError_("INVALID_UOM", "purchaseUOM", "UOM tidak valid untuk item ini.");
  var factor = transactionOperationalPositive_(matches[0].FactorToBase, "INVALID_CONVERSION", "FactorToBase");
  return { item: item, conversion: matches[0], factorToBase: factor };
}

function prepareOperationalPurchase(payload, authority) {
  var p = payload || {}, a = authority || {};
  var supplierID = transactionOperationalText_(p.supplierID, "SUPPLIER_REQUIRED", "supplierID", "Supplier wajib dipilih.");
  var supplier = transactionOperationalMap_(a.suppliers, "SupplierID")[supplierID];
  if (!supplier) throw transactionOperationalError_("SUPPLIER_NOT_FOUND", "supplierID");
  if (!masterSelectionEligible(supplier.IsActive)) throw transactionOperationalError_("SUPPLIER_INACTIVE", "supplierID");
  var itemID = transactionOperationalText_(p.itemID, "ITEM_REQUIRED", "itemID", "Item wajib dipilih.");
  var uom = transactionOperationalText_(p.purchaseUOM, "UOM_REQUIRED", "purchaseUOM", "Pilih UOM.");
  var qty = transactionOperationalPositive_(p.qty, "INVALID_QTY", "qty");
  var total = transactionOperationalPositive_(p.purchasePrice, "INVALID_PURCHASE_PRICE", "purchasePrice");
  var paidVia = transactionOperationalText_(p.paidVia, "PAID_VIA_REQUIRED", "paidVia", "Metode pembayaran wajib dipilih.");
  var account = transactionOperationalMap_(a.paymentMethods, "code")[paidVia];
  if (!account || !masterSelectionEligible(account.IsActive)) throw transactionOperationalError_("INVALID_PAID_VIA", "paidVia");
  var resolved = resolvePurchaseConversion_(itemID, uom, p.purchaseDate, a.items, a.conversions, true);
  var baseQty = qty * resolved.factorToBase;
  return { purchaseDate: p.purchaseDate, supplierID: supplierID, itemID: itemID, qty: qty,
    purchaseUOM: uom, conversionID: resolved.conversion.ConversionID, factorToBaseSnapshot: resolved.factorToBase,
    baseUOM: resolved.item.BaseUOM, baseQty: baseQty, purchaseTotal: total,
    normalizedUnitCost: total / baseQty, paidVia: paidVia, paymentStatus: "PAID", receiptStatus: "RECEIVED" };
}

function prepareOperationalExpense(payload, authority) {
  var p = payload || {}, methods = transactionOperationalMap_((authority || {}).paymentMethods, "code");
  var paidVia = transactionOperationalText_(p.paidVia, "PAID_VIA_REQUIRED", "paidVia", "Metode pembayaran wajib dipilih.");
  if (!methods[paidVia] || !masterSelectionEligible(methods[paidVia].IsActive)) throw transactionOperationalError_("INVALID_PAID_VIA", "paidVia");
  return { date: transactionOperationalText_(p.date, "DATE_REQUIRED", "date"),
    category: transactionOperationalText_(p.category, "CATEGORY_REQUIRED", "category"),
    description: transactionOperationalText_(p.description, "DESCRIPTION_REQUIRED", "description"),
    amount: transactionOperationalPositive_(p.amount, "INVALID_AMOUNT", "amount"), paidVia: paidVia, paymentStatus: "PAID" };
}

function resolveOperationalProduct_(line, authority, at) {
  var productID = transactionOperationalText_(line.productID, "PRODUCT_REQUIRED", "productID");
  var product = transactionOperationalMap_(authority.products, "ProductID")[productID];
  if (!product || !masterSelectionEligible(product.IsActive)) throw transactionOperationalError_("PRODUCT_NOT_AVAILABLE", "productID");
  var variantID = transactionOperationalText_(line.productVariantID, "PRODUCT_VARIANT_REQUIRED", "productVariantID");
  var variant = transactionOperationalMap_(authority.productVariants, "ProductVariantID")[variantID];
  if (!variant || !masterSelectionEligible(variant.IsActive)) throw transactionOperationalError_("PRODUCT_VARIANT_NOT_AVAILABLE", "productVariantID");
  if (String(variant.ProductID || "").trim() !== productID) throw transactionOperationalError_("PRODUCT_VARIANT_MISMATCH", "productVariantID");
  var qty = transactionOperationalPositive_(line.qty, "INVALID_QTY", "qty");
  var recipes = (authority.recipeVersions || []).filter(function(recipe) {
    var start = canonicalDate(recipe.EffectiveFrom), end = recipe.EffectiveTo ? canonicalDate(recipe.EffectiveTo) : null;
    return String(recipe.ProductVariantID || "").trim() === variantID && isCanonicalActive(recipe.IsActive) && start && start <= at && (!end || at <= end);
  });
  if (recipes.length !== 1 || !Array.isArray(recipes[0].Components) || !recipes[0].Components.length) {
    throw transactionOperationalError_("RECIPE_VERSION_NOT_AVAILABLE", "productVariantID");
  }
  var prices = (authority.pricing || []).filter(function(priceRow) {
    var start = canonicalDate(priceRow.EffectiveFrom), end = priceRow.EffectiveTo ? canonicalDate(priceRow.EffectiveTo) : null;
    return String(priceRow.ID_Prod || "").trim() === productID && transactionVariantType_(priceRow.Tipe) === variant.Tipe &&
      isCanonicalActive(priceRow.IsActive) && start && start <= at && (!end || at <= end);
  });
  if (prices.length !== 1) throw transactionOperationalError_("SELLING_PRICE_NOT_AVAILABLE", "productVariantID");
  var itemMap = transactionOperationalMap_(authority.items, "ItemID"), totalHpp = 0;
  recipes[0].Components.forEach(function(component) {
    var item = itemMap[String(component.ItemID || "").trim()];
    var usage = transactionOperationalPositive_(component.QtyBase, "INVALID_RECIPE_QTY", "QtyBase");
    if (!item || String(component.UOM || "") !== String(item.BaseUOM || "")) throw transactionOperationalError_("INVALID_RECIPE_COMPONENT", "Components");
    var costs = (authority.standardCosts || []).filter(function(cost) {
      var start = canonicalDate(cost.EffectiveFrom), end = cost.EffectiveTo ? canonicalDate(cost.EffectiveTo) : null;
      return String(cost.ItemID || "").trim() === String(item.ItemID || "").trim() && isCanonicalActive(cost.IsActive) && start && start <= at && (!end || at <= end);
    });
    if (costs.length !== 1) throw transactionOperationalError_("STANDARD_COST_NOT_AVAILABLE", "productVariantID");
    totalHpp += usage * transactionOperationalPositive_(costs[0].StandardCost, "INVALID_STANDARD_COST", "StandardCost");
  });
  var price = transactionOperationalPositive_(prices[0].Harga, "INVALID_SELLING_PRICE", "productVariantID");
  return { productID: productID, productVariantID: variantID, tipe: variant.Tipe, productName: product.Name, qty: qty,
    sellingPriceSnapshot: price, recipeVersionID: recipes[0].RecipeVersionID, unitHppSnapshot: totalHpp,
    lineTotal: qty * price, lineHpp: qty * totalHpp };
}

function prepareOperationalOrder(payload, authority, runtime) {
  var p = payload || {}, type = String(p.orderType || "").trim();
  if (TRANSACTION_OPERATIONAL_CONTRACT.ORDER_TYPES.indexOf(type) === -1) throw transactionOperationalError_("INVALID_ORDER_TYPE", "orderType");
  if (!Array.isArray(p.lines) || !p.lines.length) throw transactionOperationalError_("ORDER_LINES_REQUIRED", "lines");
  var now = runtime.now(), lines = p.lines.map(function(line) { return resolveOperationalProduct_(line, authority, now); });
  var id = "ORD-" + runtime.uuid(), number = "ORD-" + runtime.orderSequence();
  return { OrderID: id, OrderNumber: number, OrderType: type, PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
    CreatedAt: now, CreatedBy: runtime.actor(), PreparingAt: "", ReadyAt: "", CompletedAt: "",
    UpdatedAt: now, UpdatedBy: runtime.actor(), Lines: lines,
    OrderTotal: lines.reduce(function(sum, line) { return sum + line.lineTotal; }, 0),
    HppTotalSnapshot: lines.reduce(function(sum, line) { return sum + line.lineHpp; }, 0) };
}

function transitionOperationalFulfillment(order, next, runtime) {
  var current = TRANSACTION_OPERATIONAL_CONTRACT.FULFILLMENT.indexOf(order.FulfillmentStatus);
  var target = TRANSACTION_OPERATIONAL_CONTRACT.FULFILLMENT.indexOf(next);
  if (current < 0 || target !== current + 1) throw transactionOperationalError_("INVALID_FULFILLMENT_TRANSITION", "FulfillmentStatus");
  var updated = Object.assign({}, order), now = runtime.now();
  updated.FulfillmentStatus = next;
  updated[next === "PREPARING" ? "PreparingAt" : next === "READY" ? "ReadyAt" : "CompletedAt"] = now;
  updated.UpdatedAt = now; updated.UpdatedBy = runtime.actor();
  return updated;
}

function operationalOrderClosed(order) {
  return order.PaymentStatus === "PAID" && order.FulfillmentStatus === "COMPLETED";
}

function buildOperationalPaymentSettlement_(order, payment) {
  return { SettlementID: "CSH-SAL-" + payment.PaymentID, Tanggal: payment.PaidAt,
    Direction: "INFLOW", AccountCode: payment.AccountCode, CounterAccountCode: "", Amount: payment.Amount,
    Currency: "IDR", SourceType: "SALE_SETTLEMENT", SourceID: payment.PaymentID,
    RelatedTransactionType: "Order", RelatedTransactionID: order.OrderID, TransferID: "", ExternalRef: "",
    Status: "POSTED", Keterangan: "", ReversalOf: "", IsActive: true,
    CreatedAt: payment.PaidAt, CreatedBy: payment.PaidBy, UpdatedAt: payment.PaidAt, UpdatedBy: payment.PaidBy,
    RevenueSnapshot: order.OrderTotal, HppSnapshot: order.HppTotalSnapshot };
}

function payOperationalOrder(order, payload, state, runtime) {
  if (!order || order.PaymentStatus !== "UNPAID") throw transactionOperationalError_("ORDER_NOT_PAYABLE", "OrderID");
  var existing = (state.payments || []).filter(function(payment) { return payment.OrderID === order.OrderID && payment.Status === "SUCCESS"; });
  var requestKey = transactionOperationalText_(payload && payload.requestKey, "REQUEST_KEY_REQUIRED", "requestKey");
  var retry = existing.filter(function(payment) { return payment.RequestKey === requestKey; });
  if (retry.length === 1) return { payment: retry[0], order: order, idempotent: true };
  if (existing.length) throw transactionOperationalError_("SECOND_PAYMENT_REFUSED", "OrderID");
  var receiveVia = transactionOperationalText_(payload && payload.receiveVia, "RECEIVE_VIA_REQUIRED", "receiveVia", "Metode pembayaran wajib dipilih.");
  var method = transactionOperationalMap_(state.paymentMethods, "code")[receiveVia];
  if (!method || !masterSelectionEligible(method.IsActive) || !String(method.AccountCode || "").trim()) throw transactionOperationalError_("INVALID_RECEIVE_VIA", "receiveVia");
  if (payload.amount !== undefined && Number(payload.amount) !== Number(order.OrderTotal)) throw transactionOperationalError_("PAYMENT_AMOUNT_MISMATCH", "amount");
  var now = runtime.now(), payment = { PaymentID: "PAY-" + runtime.uuid(), OrderID: order.OrderID,
    RequestKey: requestKey, ReceiveVia: receiveVia, AccountCode: method.AccountCode, Amount: order.OrderTotal,
    PaidAt: now, PaidBy: runtime.actor(), Status: "SUCCESS" };
  var settlementRequest = buildOperationalPaymentSettlement_(order, payment);
  var settlement = runtime.settle({ settlement: settlementRequest, order: order });
  if (!settlement || ["POSTED", "ALREADY_POSTED"].indexOf(settlement.status) === -1) throw transactionOperationalError_("PAYMENT_FINANCE_CUTOVER_BLOCKED", "settlement");
  var paidOrder = Object.assign({}, order, { PaymentStatus: "PAID", UpdatedAt: now, UpdatedBy: runtime.actor() });
  return { payment: payment, order: paidOrder, settlement: settlement, idempotent: false };
}

function createOperationalMemoryRepository(initial) {
  var state = initial || {}, writes = 0;
  var orders = (state.orders || []).slice(), payments = (state.payments || []).slice();
  var purchases = (state.purchases || []).slice(), expenses = (state.expenses || []).slice();
  function replace(rows, field, record) {
    var index = rows.map(function(row) { return row[field]; }).indexOf(record[field]);
    if (index < 0) throw transactionOperationalError_("RECORD_NOT_FOUND", field);
    rows[index] = record; writes++;
  }
  return {
    read: function() { return { orders: orders.slice(), payments: payments.slice(), purchases: purchases.slice(),
      expenses: expenses.slice(), paymentMethods: (state.paymentMethods || []).slice(), writeCount: writes }; },
    findOrder: function(id) { return orders.filter(function(order) { return order.OrderID === id; })[0] || null; },
    createOrder: function(order) {
      if (this.findOrder(order.OrderID) || orders.some(function(row) { return row.OrderNumber === order.OrderNumber; })) {
        throw transactionOperationalError_("DUPLICATE_ORDER", "OrderID");
      }
      orders.push(order); writes++; return order;
    },
    updateOrder: function(order) { replace(orders, "OrderID", order); return order; },
    createPayment: function(payment) {
      if (payments.some(function(row) { return row.PaymentID === payment.PaymentID ||
        row.OrderID === payment.OrderID && row.Status === "SUCCESS"; })) throw transactionOperationalError_("SECOND_PAYMENT_REFUSED", "OrderID");
      payments.push(payment); writes++; return payment;
    },
    createPurchase: function(purchase) { purchases.push(purchase); writes++; return purchase; },
    createExpense: function(expense) { expenses.push(expense); writes++; return expense; }
  };
}

function createOperationalOrderWithRepository(payload, authority, runtime, repository) {
  var order = prepareOperationalOrder(payload, authority, runtime);
  repository.createOrder(order);
  return { order: order, writeCount: 1 };
}

function transitionOperationalFulfillmentWithRepository(orderID, next, runtime, repository) {
  // U7: V2 cohort orders reject fulfillment transitions (Start Preparing /
  // Mark Ready / Complete, i.e. CLOSED lifecycle mutation) before any write.
  salesV2OperatorFulfillmentGuard_(orderID, repository, runtime && runtime.spreadsheet);
  var order = repository.findOrder(orderID);
  if (!order) throw transactionOperationalError_("ORDER_NOT_FOUND", "OrderID");
  var updated = transitionOperationalFulfillment(order, next, runtime);
  repository.updateOrder(updated);
  return { order: updated, writeCount: 1 };
}

function payOperationalOrderWithRepository(orderID, payload, runtime, repository) {
  // U7: V2 cohort orders reject payment submission / Receive Via / settlement
  // before any write; pre-V2 and legacy orders keep their historical contract.
  salesV2OperatorPaymentGuard_(orderID, repository, runtime && runtime.spreadsheet);
  var snapshot = repository.read(), order = repository.findOrder(orderID);
  if (!order) throw transactionOperationalError_("ORDER_NOT_FOUND", "OrderID");
  var result = payOperationalOrder(order, payload, snapshot, runtime);
  if (result.idempotent) return Object.assign(result, { writeCount: 0 });
  repository.createPayment(result.payment);
  repository.updateOrder(result.order);
  return Object.assign(result, { writeCount: 2 });
}

function createOperationalPurchaseWithRepository(payload, authority, repository) {
  var purchase = prepareOperationalPurchase(payload, authority);
  repository.createPurchase(purchase);
  return { purchase: purchase, writeCount: 1 };
}

function createOperationalExpenseWithRepository(payload, authority, repository) {
  var expense = prepareOperationalExpense(payload, authority);
  repository.createExpense(expense);
  return { expense: expense, writeCount: 1 };
}

// Owner-authorized prospective configuration only. No supplier/item allocation,
// inventory conversion, historical inference, policy registration, or writes.
var PURCHASE_BINDING_M3_SYRUPS = Object.freeze([
  ['OSR07', 'Blue Citrus'], ['OSR08', 'Caramel'], ['OSR09', 'Hazelnut'],
  ['OSR10', 'Lychee'], ['OSR11', 'Mango'], ['OSR12', 'Mojito'],
  ['OSR13', 'Passion'], ['OSR14', 'Peach'], ['OSR15', 'Peppermint'],
  ['OSR17', 'Vanilla'], ['', 'Cranberry'], ['', 'Kiwi'], ['', 'Apple']
].map(function(r) { return Object.freeze({ expenseItemId: r[0], flavor: r[1] }); }));

function purchaseBindingM3Fail_(code) { throw new Error(code); }

function purchaseBindingM3Date_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    purchaseBindingM3Fail_('M3_DATE_INVALID');
  }
  return value;
}

// IDs must already exist in their canonical masters. If Nocturn is absent,
// createSupplierWithRuntime_ is the existing canonical allocation path;
// this planner never calls it, guesses an ID, or falls back to a name lookup.
function buildPurchaseBindingM3Config_(request, suppliers, items) {
  var p = request || {}, allocated = p.allocatedExpenseIDs || {};
  var config = { version: 'PURCHASE-BINDING-M3-V1', effectiveFrom: p.effectiveFrom,
    evidenceRef: p.evidenceRef, rows: PURCHASE_BINDING_M3_SYRUPS.map(function(r) {
      var id = r.expenseItemId || allocated[r.flavor];
      if (typeof id !== 'string' || !id.trim()) purchaseBindingM3Fail_('M3_ITEM_ALLOCATION_REQUIRED');
      return { expenseItemId: id, flavor: r.flavor, SupplierID: p.supplierID,
        PurchaseUOM: r.flavor === 'Caramel' ? 'bottle' : 'pack',
        PackageMl: r.flavor === 'Caramel' ? 750 : 100, IsActive: true };
    }) };
  validatePurchaseBindingM3Config_(config, suppliers, items);
  return config;
}

function validatePurchaseBindingM3Config_(config, suppliers, items) {
  if (!config || config.version !== 'PURCHASE-BINDING-M3-V1' ||
      typeof config.evidenceRef !== 'string' || !config.evidenceRef.trim() ||
      !Array.isArray(config.rows) || [10, 13].indexOf(config.rows.length) === -1) purchaseBindingM3Fail_('M3_CONFIG_INVALID');
  if (purchaseBindingM3Date_(config.effectiveFrom) < '2026-10-16') purchaseBindingM3Fail_('M3_EFFECTIVE_DATE_INVALID');
  var seen = Object.create(null), flavors = Object.create(null), supplierID = null;
  config.rows.forEach(function(row) {
    if (!row || typeof row.expenseItemId !== 'string' || !row.expenseItemId ||
        row.expenseItemId.trim() !== row.expenseItemId || row.expenseItemId === 'OSR16' ||
        row.IsActive !== true) purchaseBindingM3Fail_('M3_BINDING_INVALID');
    if (seen[row.expenseItemId] || flavors[row.flavor]) purchaseBindingM3Fail_('M3_BINDING_DUPLICATE');
    seen[row.expenseItemId] = true; flavors[row.flavor] = true;
    var spec = PURCHASE_BINDING_M3_SYRUPS.filter(function(r) { return r.flavor === row.flavor; });
    if (spec.length !== 1 || spec[0].expenseItemId && spec[0].expenseItemId !== row.expenseItemId) purchaseBindingM3Fail_('M3_ITEM_AUTHORITY');
    var caramel = row.flavor === 'Caramel';
    if (row.PurchaseUOM !== (caramel ? 'bottle' : 'pack') || row.PackageMl !== (caramel ? 750 : 100)) purchaseBindingM3Fail_('M3_PACKAGE_AUTHORITY');
    if (typeof row.SupplierID !== 'string' || !row.SupplierID || row.SupplierID.trim() !== row.SupplierID ||
        supplierID !== null && row.SupplierID !== supplierID) purchaseBindingM3Fail_('M3_SUPPLIER_AUTHORITY');
    supplierID = row.SupplierID;
    var supplier = (suppliers || []).filter(function(r) { return r.SupplierID === supplierID; });
    if (supplier.length !== 1 || !isCanonicalActive(supplier[0].IsActive) || supplier[0].Name !== 'Nocturn') purchaseBindingM3Fail_('M3_SUPPLIER_AUTHORITY');
    var item = (items || []).filter(function(r) { return r.ID_Ops === row.expenseItemId; });
    if (item.length !== 1 || !isCanonicalActive(item[0].IsActive) || item[0].Item !== 'Sirup ' + row.flavor) purchaseBindingM3Fail_('M3_ITEM_AUTHORITY');
  });
  PURCHASE_BINDING_M3_SYRUPS.forEach(function(r) {
    if (r.expenseItemId && !seen[r.expenseItemId]) purchaseBindingM3Fail_('M3_BINDING_MISSING');
  });
  return config;
}

function validatePurchaseBindingM3Intent_(normalized, config, suppliers, items) {
  if (config === null || config === undefined) return null;
  // Even malformed prospective config refuses new intents; never falls back.
  validatePurchaseBindingM3Config_(config, suppliers, items);
  var effDate = purchaseBindingM3Date_(normalized.input.ExpenseDate);
  if (effDate < config.effectiveFrom) {
    var governed = config.rows.filter(function(r) { return r.expenseItemId === normalized.expenseItemId; })[0];
    if (governed) purchaseBindingM3Fail_('M3_POLICY_DATE_INVALID');
    return null;
  }
  var row = config.rows.filter(function(r) { return r.expenseItemId === normalized.expenseItemId; })[0];
  if (!row) return null; // OSR16 and other existing purchase identities retain V1.
  if (normalized.supplierID !== row.SupplierID) purchaseBindingM3Fail_('M3_SUPPLIER_MISMATCH');
  if (normalized.input.PurchaseUOM !== row.PurchaseUOM) purchaseBindingM3Fail_('M3_UOM_MISMATCH');
  return row; // PackageMl is configuration metadata, never a conversion factor.
}

// M3 COMBINED ACTIVATION provider supply (owner-authorized; SAME date as 46).
// Unfilled placeholder keeps the global null (V1 path, zero behavior change).
// Guard is shape-based (regex), NOT a literal comparison, so date substitution
// cannot neutralize it. Rows are literals against verified masters (Gate 4
// 13/13): Nocturn SUP-20261016-BRYVN8YPS72M, OSR07-OSR15 + OSR17 + OSR22/23/24.
// Per-intent preflight (95:386-391) revalidates every row against live masters.
// Release gate: valid only if production activation succeeds on 2026-10-19 Asia/Jakarta.
var M3_PROVIDER_EFFECTIVE_FROM_ = '2026-10-19';
var PURCHASE_BINDING_M3_CONFIG = /^\d{4}-\d{2}-\d{2}$/.test(M3_PROVIDER_EFFECTIVE_FROM_) ? Object.freeze({
  version: 'PURCHASE-BINDING-M3-V1', effectiveFrom: M3_PROVIDER_EFFECTIVE_FROM_,
  evidenceRef: 'docs/evidence/finance-phase-11v12/SPEC-M3-AMENDMENT.md',
  rows: Object.freeze([
    Object.freeze({ expenseItemId: 'OSR07', flavor: 'Blue Citrus', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR08', flavor: 'Caramel', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'bottle', PackageMl: 750, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR09', flavor: 'Hazelnut', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR10', flavor: 'Lychee', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR11', flavor: 'Mango', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR12', flavor: 'Mojito', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR13', flavor: 'Passion', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR14', flavor: 'Peach', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR15', flavor: 'Peppermint', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR17', flavor: 'Vanilla', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR22', flavor: 'Cranberry', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR23', flavor: 'Kiwi', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true }),
    Object.freeze({ expenseItemId: 'OSR24', flavor: 'Apple', SupplierID: 'SUP-20261016-BRYVN8YPS72M', PurchaseUOM: 'pack', PackageMl: 100, IsActive: true })
  ]) }) : null;
function readPurchaseBindingM3Config_() { return PURCHASE_BINDING_M3_CONFIG; }

// Fail-closed activation-date authority: Policy V2 (46) and this provider are
// ONE owner-substituted authoritative activation date; a divergent hand edit
// can never install mismatched policy/provider windows. Load-time only, zero
// business writes. typeof-skip: GAS loads 46 before 95 alphabetically; an
// isolated 95-only load has no policy-side constant and skips the check.
if (typeof M3_ACTIVATION_EFFECTIVE_FROM_ !== 'undefined' &&
    M3_ACTIVATION_EFFECTIVE_FROM_ !== M3_PROVIDER_EFFECTIVE_FROM_) {
  purchaseBindingM3Fail_('M3_ACTIVATION_DATE_DISAGREEMENT');
}

// Owner-authorized local config provider (SPEC-M3-AMENDMENT.md OP-4). Builds
// and validates a complete prospective config from caller-supplied verified
// canonical IDs without mutating the global: the global stays null (binding
// inactive) until a separately authorized activation supply. Never allocates
// IDs, never reads production, never falls back to name lookup. Approved
// reservation: Cranberry→OSR22, Kiwi→OSR23, Apple→OSR24 (pass via
// allocatedExpenseIDs after canonical master allocation).
function providePurchaseBindingM3Config_(request, suppliers, items) {
  var config = buildPurchaseBindingM3Config_(request, suppliers, items);
  return Object.freeze({ version: config.version, effectiveFrom: config.effectiveFrom,
    evidenceRef: config.evidenceRef, rows: Object.freeze(config.rows.slice()) });
}

// Called only for NEW Save/correction intent, after exact RequestKey replay.
function preflightPurchaseBindingM3_(normalized, runtime, items) {
  var config = runtime.readPurchaseBindingM3 ? runtime.readPurchaseBindingM3() : null;
  if (config === null) return null;
  var suppliers = readCanonicalTable(runtime.spreadsheet, SUPPLIER_MASTER_CONTRACT.SHEET, SUPPLIER_MASTER_CONTRACT.HEADERS);
  return validatePurchaseBindingM3Intent_(normalized, config, suppliers, items);
}

// =============================================================================
// UNIVERSAL PURCHASE AUTHORITY (Local Foundation)
// Owner-authorized binding for all 27 Purchase Items.
// Does not activate, deploy, or replace M3 V1/V2.
// =============================================================================

var PURCHASE_AUTHORITY_CODES = Object.freeze({
  BINDING_CONFIG_MISSING: 'BINDING_CONFIG_MISSING',
  BINDING_ROW_INACTIVE: 'BINDING_ROW_INACTIVE',
  BINDING_ROW_NOT_FOUND: 'BINDING_ROW_NOT_FOUND',
  SUPPLIER_NOT_FOUND: 'SUPPLIER_NOT_FOUND',
  SUPPLIER_INACTIVE: 'SUPPLIER_INACTIVE',
  INVALID_PACKAGE_CAPACITY: 'INVALID_PACKAGE_CAPACITY',
  BINDING_EXPIRED: 'BINDING_EXPIRED',
  BINDING_FUTURE_EFFECTIVE: 'BINDING_FUTURE_EFFECTIVE',
  CONFLICTING_BINDING: 'CONFLICTING_BINDING',
  DUPLICATE_BINDING_ROW: 'DUPLICATE_BINDING_ROW'
});

function purchaseAuthorityFail_(code, field) {
  var error = new Error(code);
  error.code = code;
  error.field = field || null;
  throw error;
}

function purchaseAuthorityDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    purchaseAuthorityFail_('INVALID_DATE', 'date');
  }
  return value;
}

function purchaseAuthorityIsActive_(value) {
  return value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1';
}

function purchaseAuthorityIsExpired_(row, date) {
  if (row.effectiveTo) {
    var end = purchaseAuthorityDate_(row.effectiveTo);
    return date > end;
  }
  return false;
}

function purchaseAuthorityIsFuture_(row, date) {
  if (row.effectiveFrom) {
    var start = purchaseAuthorityDate_(row.effectiveFrom);
    return date < start;
  }
  return false;
}

function validatePurchaseAuthorityConfig_(config) {
  if (!config || typeof config !== 'object') purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_CONFIG_MISSING, 'config');
  if (config.version !== 'PURCHASE-SUPPLIER-BINDING-V1') purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_CONFIG_MISSING, 'version');
  if (!config.evidenceRef || typeof config.evidenceRef !== 'string' || !config.evidenceRef.trim()) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_CONFIG_MISSING, 'evidenceRef');
  if (!Array.isArray(config.rows) || config.rows.length !== 27) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_CONFIG_MISSING, 'rows');
  var seen = Object.create(null);
  config.rows.forEach(function(row) {
    if (!row || typeof row.expenseItemId !== 'string' || !row.expenseItemId.trim()) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_NOT_FOUND, 'expenseItemId');
    var key = row.expenseItemId.trim();
    if (seen[key]) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.DUPLICATE_BINDING_ROW, key);
    seen[key] = true;
    if (!row.supplierId || typeof row.supplierId !== 'string' || !row.supplierId.trim()) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_NOT_FOUND, 'supplierId');
    if (!row.purchaseUOM || typeof row.purchaseUOM !== 'string' || !row.purchaseUOM.trim()) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_NOT_FOUND, 'purchaseUOM');
    var cap = Number(row.packageCapacity);
    if (!isFinite(cap) || cap <= 0) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.INVALID_PACKAGE_CAPACITY, 'packageCapacity');
    if (!row.usageUOM || typeof row.usageUOM !== 'string' || !row.usageUOM.trim()) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_NOT_FOUND, 'usageUOM');
    if (row.inventoryItemId !== null && row.inventoryItemId !== undefined && (typeof row.inventoryItemId !== 'string' || !row.inventoryItemId.trim())) {
      purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_NOT_FOUND, 'inventoryItemId');
    }
    if (row.inventoryItemId !== null && row.inventoryItemId !== undefined && (!row.packageIdentity || !row.packageIdentity.trim())) {
      purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_NOT_FOUND, 'packageIdentity');
    }
    if (row.inventoryItemId === null || row.inventoryItemId === undefined) {
      if (row.packageIdentity !== null && row.packageIdentity !== undefined && row.packageIdentity !== '') {
        purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_NOT_FOUND, 'packageIdentity must be null when inventoryItemId is null');
      }
    }
    if (!purchaseAuthorityIsActive_(row.isActive)) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_INACTIVE, 'isActive');
    if (row.effectiveFrom) purchaseAuthorityDate_(row.effectiveFrom);
    if (row.effectiveTo) purchaseAuthorityDate_(row.effectiveTo);
  });
  return config;
}

// Immutable, versioned binding configuration for all 27 owner-approved Purchase Items.
// Source of truth: docs/evidence/purchase-business-data-matrix-20261019.md
// Production SupplierIDs verified 2026-10-19.
var PURCHASE_SUPPLIER_BINDING_V1 = Object.freeze({
  version: 'PURCHASE-SUPPLIER-BINDING-V1',
  effectiveFrom: '2026-10-19',
  evidenceRef: 'docs/evidence/purchase-business-data-matrix-20261019.md',
  rows: Object.freeze([
    // DIRECT_HPP_COMPONENT (10)
    Object.freeze({ expenseItemId: 'OSK01', supplierId: 'SUP-20261019-4F990F51DDBE', purchaseUOM: 'gallon', packageCapacity: 19000, usageUOM: 'ml', inventoryItemId: 'ING-011', packageIdentity: 'ING-011|SUP-20261019-4F990F51DDBE|Air|NO-SKU|19 L gallon|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSK03', supplierId: 'SUP-20261019-43167539196F', purchaseUOM: 'bag', packageCapacity: 1000, usageUOM: 'gr', inventoryItemId: 'ING-020', packageIdentity: 'ING-020|SUP-20261019-43167539196F|Gula|NO-SKU|1 kg bag|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSK04', supplierId: 'SUP-20261019-FD04141B6410', purchaseUOM: 'pack', packageCapacity: 10000, usageUOM: 'gr', inventoryItemId: 'ING-021', packageIdentity: 'ING-021|SUP-20261019-FD04141B6410|Es|NO-SKU|10 kg pack|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR02', supplierId: 'SUP-20261019-03BE1BA08D9D', purchaseUOM: 'bag', packageCapacity: 1000, usageUOM: 'gr', inventoryItemId: 'ING-006', packageIdentity: 'ING-006|SUP-20261019-03BE1BA08D9D|Bean Robusta|NO-SKU|1 kg bag|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR04', supplierId: 'SUP-20261019-EA941F1BE483', purchaseUOM: 'bag', packageCapacity: 1000, usageUOM: 'gr', inventoryItemId: 'ING-018', packageIdentity: 'ING-018|SUP-20261019-EA941F1BE483|Lemon|NO-SKU|1 kg bag|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR05', supplierId: 'SUP-20261019-03BE1BA08D9D', purchaseUOM: 'bag', packageCapacity: 500, usageUOM: 'gr', inventoryItemId: 'ING-015', packageIdentity: 'ING-015|SUP-20261019-03BE1BA08D9D|Powder Choco|NO-SKU|500 gr bag|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR06', supplierId: 'SUP-20261019-03BE1BA08D9D', purchaseUOM: 'bag', packageCapacity: 100, usageUOM: 'gr', inventoryItemId: 'ING-016', packageIdentity: 'ING-016|SUP-20261019-03BE1BA08D9D|Powder Matcha|NO-SKU|100 gr bag|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR18', supplierId: 'SUP-20261019-43167539196F', purchaseUOM: 'carton', packageCapacity: 6000, usageUOM: 'ml', inventoryItemId: 'ING-019', packageIdentity: 'ING-019|SUP-20261019-43167539196F|Soda|NO-SKU|24x250ml carton|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR19', supplierId: 'SUP-20261019-43167539196F', purchaseUOM: 'carton', packageCapacity: 12000, usageUOM: 'ml', inventoryItemId: 'ING-009', packageIdentity: 'ING-009|SUP-20261019-43167539196F|UHT|NO-SKU|12x1L carton|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR20', supplierId: 'SUP-20261019-43167539196F', purchaseUOM: 'carton', packageCapacity: 11760, usageUOM: 'gr', inventoryItemId: 'ING-010', packageIdentity: 'ING-010|SUP-20261019-43167539196F|SKM|NO-SKU|24x490gr carton|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    // HPP_COST_POOL — single governing package per item (3)
    Object.freeze({ expenseItemId: 'OSR01', supplierId: 'SUP-20261019-03BE1BA08D9D', purchaseUOM: 'bag', packageCapacity: 1000, usageUOM: 'gr', inventoryItemId: 'ING-004', packageIdentity: 'ING-004|SUP-20261019-03BE1BA08D9D|Bean Ar 100%|NO-SKU|1 kg bag|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR03', supplierId: 'SUP-20261019-43167539196F', purchaseUOM: 'bag', packageCapacity: 880, usageUOM: 'gr', inventoryItemId: 'ING-007', packageIdentity: 'ING-007|SUP-20261019-43167539196F|Kopi Badau|NO-SKU|880 gr bag|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR21', supplierId: 'SUP-20261019-43167539196F', purchaseUOM: 'pack', packageCapacity: 1400, usageUOM: 'gr', inventoryItemId: 'ING-012', packageIdentity: 'ING-012|SUP-20261019-43167539196F|Teh Bendera|NO-SKU|1400 gr pack|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    // M3 SYRUPS — all bottle, distinct packageIdentity per flavor (13)
    Object.freeze({ expenseItemId: 'OSR07', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Blue Citrus|NO-SKU|100 ml syrup bottle|V02', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR08', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 750, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Caramel|NO-SKU|750 ml syrup bottle|V01', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR09', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Hazelnut|NO-SKU|100 ml syrup bottle|V03', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR10', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Lychee|NO-SKU|100 ml syrup bottle|V04', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR11', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Mango|NO-SKU|100 ml syrup bottle|V05', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR12', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Mojito|NO-SKU|100 ml syrup bottle|V06', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR13', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Passion|NO-SKU|100 ml syrup bottle|V07', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR14', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Peach|NO-SKU|100 ml syrup bottle|V08', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR15', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Peppermint|NO-SKU|100 ml syrup bottle|V09', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR17', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Vanilla|NO-SKU|100 ml syrup bottle|V10', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR22', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Cranberry|NO-SKU|100 ml syrup bottle|V11', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR23', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Kiwi|NO-SKU|100 ml syrup bottle|V12', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    Object.freeze({ expenseItemId: 'OSR24', supplierId: 'SUP-20261016-BRYVN8YPS72M', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: 'ING-017', packageIdentity: 'ING-017|SUP-20261016-BRYVN8YPS72M|Sirup Apple|NO-SKU|100 ml syrup bottle|V13', isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null }),
    // OSR16 — no InventoryItem, no conversion, no packageIdentity (1)
    Object.freeze({ expenseItemId: 'OSR16', supplierId: 'SUP-20261019-03BE1BA08D9D', purchaseUOM: 'bottle', packageCapacity: 100, usageUOM: 'ml', inventoryItemId: null, packageIdentity: null, isActive: true, effectiveFrom: '2026-10-19', effectiveTo: null })
  ])
});

validatePurchaseAuthorityConfig_(PURCHASE_SUPPLIER_BINDING_V1);

function readPurchaseSupplierBindingV1_() { return PURCHASE_SUPPLIER_BINDING_V1; }

// Pure resolver: ExpenseItemID + date + supplier master + binding config → authority DTO.
// Does not read production, does not mutate, does not require Inventory conversion when inventoryItemId is null.
function resolvePurchaseAuthority_(expenseItemId, transactionDate, bindingConfig, suppliers) {
  var config = validatePurchaseAuthorityConfig_(bindingConfig);
  var date = purchaseAuthorityDate_(transactionDate);
  
  if (purchaseAuthorityDate_(config.effectiveFrom) > date) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_FUTURE_EFFECTIVE, 'effectiveFrom');
  
  var row = null;
  config.rows.forEach(function(r) {
    if (r.expenseItemId === expenseItemId) {
      if (row) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.CONFLICTING_BINDING, expenseItemId);
      row = r;
    }
  });
  if (!row) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_NOT_FOUND, expenseItemId);
  if (!purchaseAuthorityIsActive_(row.isActive)) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_ROW_INACTIVE, expenseItemId);
  if (purchaseAuthorityIsFuture_(row, date)) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_FUTURE_EFFECTIVE, 'effectiveFrom');
  if (purchaseAuthorityIsExpired_(row, date)) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.BINDING_EXPIRED, 'effectiveTo');
  
  var supplierMap = transactionOperationalMap_(suppliers, 'SupplierID');
  var supplier = supplierMap[row.supplierId];
  if (!supplier) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.SUPPLIER_NOT_FOUND, row.supplierId);
  if (!masterSelectionEligible(supplier.IsActive)) purchaseAuthorityFail_(PURCHASE_AUTHORITY_CODES.SUPPLIER_INACTIVE, row.supplierId);
  
  return {
    expenseItemId: row.expenseItemId,
    supplierId: row.supplierId,
    supplierSource: supplier.Name,
    purchaseUOM: row.purchaseUOM,
    packageCapacity: Number(row.packageCapacity),
    usageUOM: row.usageUOM,
    packageIdentity: row.packageIdentity,
    inventoryIdentity: row.inventoryItemId == null ? null : row.inventoryItemId,
    authorityAsOfDate: date,
    authorityVersion: config.version,
    authorityRevision: 1
  };
}
