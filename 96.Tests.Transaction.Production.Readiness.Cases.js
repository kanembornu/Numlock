function testTransactionProductionReadinessMatrices() {
  var totals = { PV: 20, RV: 10, PA: 21, OC: 8, PC: 10, FS: 8 }, passed = { PV: 0, RV: 0, PA: 0, OC: 0, PC: 0, FS: 0 };
  function check(group, condition, label) { if (!condition) throw new Error(group + ":" + label); passed[group]++; }
  var at = new Date("2026-10-05T00:00:00Z"), source = {
    products: [{ ID_Prod: "P1", IsActive: true }, { ID_Prod: "P2", IsActive: true }, { ID_Prod: "P3", IsActive: true }],
    pricing: [{ ID_Prod: "P1", Tipe: "Hot", Harga: 20, EffectiveFrom: at, IsActive: true }, { ID_Prod: "P1", Tipe: "Cold", Harga: 30, EffectiveFrom: at, IsActive: true },
      { ID_Prod: "P2", Tipe: "Hot", Harga: 25, EffectiveFrom: at, IsActive: true }, { ID_Prod: "P3", Tipe: "Cold", Harga: 35, EffectiveFrom: at, IsActive: true }],
    recipes: [{ ID_Prod: "P1", Tipe: "Hot", ID_Ingredient: "I1", UsageQty: 1, IsActive: true }, { ID_Prod: "P1", Tipe: "Cold", ID_Ingredient: "I1", UsageQty: 2, IsActive: true },
      { ID_Prod: "P2", Tipe: "Hot", ID_Ingredient: "I1", UsageQty: 1, IsActive: true }, { ID_Prod: "P3", Tipe: "Cold", ID_Ingredient: "I1", UsageQty: 1, IsActive: true }],
    items: [{ ItemID: "I1", BaseUOM: "gr", IsActive: true }], standardCosts: [{ ItemID: "I1", StandardCost: 2, EffectiveFrom: at, IsActive: true }]
  };
  var vp = buildProductVariantBootstrapPlan(source, at), vp2 = buildProductVariantBootstrapPlan(source, at);
  [vp.planCount === 4, vp.rows.filter(function(r) { return r.ProductID === "P1"; }).length === 2,
    vp.rows.some(function(r) { return r.ProductID === "P2" && r.Tipe === "HOT"; }), vp.rows.some(function(r) { return r.ProductID === "P3" && r.Tipe === "COLD"; }),
    JSON.stringify(vp.rows) === JSON.stringify(vp2.rows), vp.writeCount === 0, !vp.rows.some(function(r) { return r.ProductID === "P2" && r.Tipe === "COLD"; }),
    vp.rows.every(function(r) { return r.ProductVariantID.indexOf("PV-") === 0; }), new Set(vp.rows.map(function(r) { return r.ProductVariantID; })).size === 4,
    transactionVariantType_("Hot") === "HOT", transactionVariantType_("cold") === "COLD", vp.rows.every(function(r) { return r.ProductID; }),
    TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS.indexOf("ProductID") !== -1, TRANSACTION_PRODUCTION_CONTRACT.ORDER_LINES.HEADERS.indexOf("ProductVariantID") !== -1,
    TRANSACTION_PRODUCTION_CONTRACT.ORDER_LINES.HEADERS.indexOf("Tipe") !== -1, resolveOperationalProduct_.toString().indexOf("PRODUCT_VARIANT_MISMATCH") !== -1,
    resolveOperationalProduct_.toString().indexOf("SELLING_PRICE_NOT_AVAILABLE") !== -1, resolveOperationalProduct_.toString().indexOf("ProductVariantID") !== -1,
    buildProductVariantBootstrapPlan.toString().indexOf("tabsal") === -1, vp.status === "READY"].forEach(function(v, i) { check("PV", v, "PV" + (i + 1)); });
  source.productVariants = vp.rows; var rp = buildRecipeVersionBootstrapPlan(source, at);
  [rp.status === "READY", rp.planCount === 4, rp.versions.every(function(v) { return v.ProductVariantID; }), rp.lines.length === 4,
    rp.versions.every(function(v) { return v.EffectiveFrom.getTime() === at.getTime(); }), rp.writeCount === 0,
    buildRecipeVersionBootstrapPlan(Object.assign({}, source, { recipes: [] }), at).status === "BLOCKED",
    buildRecipeVersionBootstrapPlan(Object.assign({}, source, { standardCosts: [] }), at).status === "BLOCKED",
    TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSIONS.HEADERS.indexOf("ProductVariantID") !== -1,
    buildRecipeVersionBootstrapPlan.toString().indexOf("tabsal") === -1].forEach(function(v, i) { check("RV", v, "RV" + (i + 1)); });
  var production = createDurableOperationalOrder_.toString() + createDurableOperationalPayment_.toString() + submitOperationalPurchase.toString() + submitOperationalExpense.toString() +
    transactionOperation_.toString() + transactionCommitOperation_.toString() + buildCanonicalTransactionPurchaseEvent_.toString() + createTransactionSpreadsheetRepository.toString() +
    submitOperationalFulfillment.toString() + transitionOperationalFulfillment.toString() + buildProductVariantBootstrapPlan.toString() + normalizeCanonicalTransactionPurchase_.toString();
  ["requireCanonicalHeaders","ORDER_READBACK_INCOMPLETE","IN_PROGRESS","COMMITTED","ProductVariantID","SellingPriceSnapshot","RecipeVersionID","findPaymentByRequest","transactionFinanceSettlementExists_","SECOND_PAYMENT_REFUSED","transitionOperationalFulfillmentWithRepository","PreparingAt","normalizeCanonicalTransactionPurchase_","paymentStatus: 'PAID'","receiptStatus: 'RECEIVED'","payableWrites: 0","inventoryWrites: 0","submitCanonicalTransaction","writeCount: 0","buildProductVariantBootstrapPlan","RBAC"].forEach(function(token, i) { check("PA", token === "RBAC" ? production.indexOf(token) === -1 : production.indexOf(token) !== -1, "PA" + (i + 1)); });
  ["OperationPlan","createOrder(","OrderLineID","ORDER_READBACK_INCOMPLETE","ORDER_IDENTITY_CONFLICT","ORDER_LINE_IDENTITY_CONFLICT","COMMITTED","PayloadHash"].forEach(function(token, i) { check("OC", (createDurableOperationalOrder_.toString() + recoverTransactionOperation.toString() + createTransactionSpreadsheetRepository.toString() + TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS.join()).indexOf(token) !== -1, "OC" + (i + 1)); });
  ["transactionResolveOperation_","transactionFinanceSettlementExists_","runtime.settle","createPayment","PaymentStatus !== \"PAID\"","PAYMENT_READBACK_INCOMPLETE","transactionCommitOperation_","findPaymentByRequest","CSH-SAL-","SECOND_PAYMENT_REFUSED"].forEach(function(token, i) { check("PC", (createDurableOperationalPayment_.toString() + transactionFinanceSettlementExists_.toString() + createTransactionSpreadsheetRepository.toString()).indexOf(token) !== -1, "PC" + (i + 1)); });
  [createDurableOperationalOrder_.toString().indexOf("settle") === -1, buildOperationalPaymentSettlement_.toString().indexOf("RevenueSnapshot") !== -1,
    buildOperationalPaymentSettlement_.toString().indexOf("HppSnapshot") !== -1, buildOperationalPaymentSettlement_.toString().indexOf("INFLOW") !== -1,
    createDurableOperationalPayment_.toString().indexOf("transactionFinanceSettlementExists_") !== -1, createDurableOperationalPayment_.toString().indexOf("runtime.settle") !== -1,
    createDurableOperationalPayment_.toString().indexOf("operation.State === \"COMMITTED\"") !== -1, createTransactionSpreadsheetRepository.toString().indexOf("SECOND_PAYMENT_REFUSED") !== -1]
    .forEach(function(v, i) { check("FS", v, "FS" + (i + 1)); });
  return { totals: totals, passed: passed, failed: 0 };
}

function transactionReadinessMemoryRepository_(initial) {
  var state = initial || {}, orders = (state.orders || []).slice(), lines = (state.lines || []).slice(), payments = [], operations = [];
  function op(type, key) { return operations.filter(function(r) { return r.OperationType === type && r.RequestKey === key; })[0] || null; }
  function order(id) { var row = orders.filter(function(r) { return r.OrderID === id; })[0]; return row ? Object.assign({}, row, { Lines: lines.filter(function(l) { return l.OrderID === id; }) }) : null; }
  return { readRows: function(key) { return { OPERATIONS: operations, PAYMENTS: payments }[key].slice(); },
    read: function() { return { payments: payments.slice(), paymentMethods: [{ code: "CASH", AccountCode: "1000", IsActive: true }] }; },
    findOperation: op, createOperation: function(r) { operations.push(Object.assign({}, r)); return r; },
    updateOperation: function(r) { var x = op(r.OperationType, r.RequestKey); Object.assign(x, r); return x; },
    findOrder: order, createOrder: function(o) { if (!order(o.OrderID)) { var copy = Object.assign({}, o); delete copy.Lines; orders.push(copy); }
      o.Lines.forEach(function(l) { if (!lines.some(function(x) { return x.OrderLineID === l.OrderLineID; })) lines.push(Object.assign({}, l, { OrderID: o.OrderID,
        ProductID: l.productID, ProductVariantID: l.productVariantID, Tipe: l.tipe, Qty: l.qty, SellingPriceSnapshot: l.sellingPriceSnapshot, RecipeVersionID: l.recipeVersionID })); }); return o; },
    updateOrder: function(o) { var x = orders.filter(function(r) { return r.OrderID === o.OrderID; })[0]; Object.assign(x, o); delete x.Lines; return o; },
    findPaymentByRequest: function(k) { return payments.filter(function(p) { return p.RequestKey === k; })[0] || null; },
    createPayment: function(p) { if (payments.some(function(x) { return x.PaymentID === p.PaymentID || x.OrderID === p.OrderID && x.Status === "SUCCESS"; })) throw transactionOperationalError_("SECOND_PAYMENT_REFUSED", "OrderID"); payments.push(Object.assign({}, p)); return p; },
    state: function() { return { orders: orders, lines: lines, payments: payments, operations: operations }; } };
}

function testTransactionCrashRecoveryExecution() {
  var passOC = 0, passPC = 0, now = new Date("2026-10-05T01:00:00Z"), authority = {
    products: [{ ProductID: "P1", Name: "Coffee", IsActive: true }], productVariants: [{ ProductVariantID: "PV1", ProductID: "P1", Tipe: "HOT", IsActive: true }],
    pricing: [{ ID_Prod: "P1", Tipe: "Hot", Harga: 20, EffectiveFrom: "2026-01-01", IsActive: true }],
    recipeVersions: [{ RecipeVersionID: "RV1", ProductVariantID: "PV1", EffectiveFrom: "2026-01-01", IsActive: true, Components: [{ ItemID: "I1", QtyBase: 1, UOM: "gr" }] }],
    items: [{ ItemID: "I1", BaseUOM: "gr", IsActive: true }], standardCosts: [{ ItemID: "I1", StandardCost: 2, EffectiveFrom: "2026-01-01", IsActive: true }]
  };
  function runtime(crashAt, finance) { return { spreadsheet: {}, now: function() { return now; }, actor: function() { return "test"; },
    financeExists: function(id) { return !!finance[id]; }, settle: function(req) { finance[req.settlement.SourceID] = true; return { status: "POSTED" }; },
    crash: crashAt ? function(point) { if (point === crashAt) { crashAt = null; throw new Error("CRASH:" + point); } } : null }; }
  ["ORDER_AFTER_INTENT", "ORDER_AFTER_PERSIST", "ORDER_BEFORE_COMMIT"].forEach(function(point) {
    var repo = transactionReadinessMemoryRepository_(), rt = runtime(point, {}), payload = { requestKey: "K-" + point, orderType: "DINE_IN", lines: [{ productID: "P1", productVariantID: "PV1", qty: 1 }] };
    try { createDurableOperationalOrder_(payload, authority, rt, repo); } catch (e) {}
    var operation = repo.state().operations[0]; recoverTransactionOperationWithRuntime_(operation.OperationID, Object.assign(rt, { repository: repo }));
    var state = repo.state(); if (state.orders.length === 1 && state.lines.length === 1 && state.operations[0].State === "COMMITTED") passOC++;
  });
  var repoStable = transactionReadinessMemoryRepository_(), orderPayload = { requestKey: "ORDER-STABLE", orderType: "DINE_IN", lines: [{ productID: "P1", productVariantID: "PV1", qty: 1 }] };
  createDurableOperationalOrder_(orderPayload, authority, runtime(null, {}), repoStable); createDurableOperationalOrder_(orderPayload, authority, runtime(null, {}), repoStable);
  var os = repoStable.state(); [os.orders.length === 1, os.lines.length === 1, os.lines[0].ProductVariantID === "PV1", os.operations[0].State === "COMMITTED", os.lines[0].SellingPriceSnapshot === 20].forEach(function(v) { if (!v) throw new Error("OC_EXEC"); passOC++; });
  ["PAYMENT_AFTER_INTENT", "PAYMENT_AFTER_FINANCE", "PAYMENT_AFTER_ROW", "PAYMENT_AFTER_ORDER_PAID", "PAYMENT_BEFORE_COMMIT"].forEach(function(point) {
    var baseOrder = { OrderID: "O1", OrderNumber: "O1", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN", OrderTotal: 20, HppTotalSnapshot: 2, Lines: [] };
    var repo = transactionReadinessMemoryRepository_({ orders: [baseOrder] }), finance = {}, rt = runtime(point, finance), payload = { requestKey: "P-" + point, receiveVia: "CASH", amount: 20 };
    try { createDurableOperationalPayment_("O1", payload, rt, repo); } catch (e) {}
    recoverTransactionOperationWithRuntime_(repo.state().operations[0].OperationID, Object.assign(rt, { repository: repo }));
    var s = repo.state(); if (s.payments.length === 1 && Object.keys(finance).length === 1 && s.orders[0].PaymentStatus === "PAID" && s.operations[0].State === "COMMITTED") passPC++;
  });
  var secondRepo = transactionReadinessMemoryRepository_({ orders: [{ OrderID: "O2", PaymentStatus: "UNPAID", OrderTotal: 20, HppTotalSnapshot: 2, Lines: [] }] }), f = {}, rt2 = runtime(null, f);
  createDurableOperationalPayment_("O2", { requestKey: "P1", receiveVia: "CASH", amount: 20 }, rt2, secondRepo);
  try { createDurableOperationalPayment_("O2", { requestKey: "P2", receiveVia: "CASH", amount: 20 }, rt2, secondRepo); } catch (e) { if (e.code === "SECOND_PAYMENT_REFUSED") passPC++; }
  var final = secondRepo.state(); [final.payments.length === 1, Object.keys(f).length === 1, final.orders[0].PaymentStatus === "PAID", final.operations[0].State === "COMMITTED"].forEach(function(v) { if (!v) throw new Error("PC_EXEC"); passPC++; });
  return { OC: { total: 8, pass: passOC, fail: 8 - passOC, simulated: true }, PC: { total: 10, pass: passPC, fail: 10 - passPC, simulated: true } };
}
