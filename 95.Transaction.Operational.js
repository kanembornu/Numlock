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
  var order = repository.findOrder(orderID);
  if (!order) throw transactionOperationalError_("ORDER_NOT_FOUND", "OrderID");
  var updated = transitionOperationalFulfillment(order, next, runtime);
  repository.updateOrder(updated);
  return { order: updated, writeCount: 1 };
}

function payOperationalOrderWithRepository(orderID, payload, runtime, repository) {
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
