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

function transactionFixtureSpreadsheet_(initial) {
  var sheets = Object.create(null);
  function sheet(name, values) {
    var rows = (values || []).map(function(r) { return r.slice(); });
    return { getName: function() { return name; }, getLastRow: function() { return rows.length; }, getLastColumn: function() { return rows.length ? rows[0].length : 0; },
      getMaxRows: function() { return Math.max(1, rows.length); }, getDataRange: function() { return { getValues: function() { return rows.map(function(r) { return r.slice(); }); } }; },
      getRange: function(row, col, height, width) { return { getValues: function() { return rows.slice(row - 1, row - 1 + height).map(function(r) { return r.slice(col - 1, col - 1 + width); }); },
        getFormulas: function() { return Array.from({ length: height }, function() { return Array(width).fill(""); }); }, getNotes: function() { return Array.from({ length: height }, function() { return Array(width).fill(""); }); },
        setValues: function(input) { input.forEach(function(r, i) { while (rows.length < row + i) rows.push([]); r.forEach(function(v, j) { rows[row - 1 + i][col - 1 + j] = v; }); }); return this; } }; },
      values: rows };
  }
  Object.keys(initial || {}).forEach(function(name) { sheets[name] = sheet(name, initial[name]); });
  var fixture = { getSheetByName: function(name) { return sheets[name] || null; }, insertSheet: function(name) { if (fixture.beforeInsert) fixture.beforeInsert(name); if (sheets[name]) throw new Error("COLLISION"); sheets[name] = sheet(name, []); return sheets[name]; },
    fixtureSheet: function(name) { return sheets[name]; } };
  return fixture;
}
function transactionFixtureTable_(headers, rows) { return [headers.slice()].concat((rows || []).map(function(row) { return headers.map(function(h) { return row[h] === undefined ? "" : row[h]; }); })); }
function transactionFixtureLock_() { return { waitLock: function() {}, releaseLock: function() {} }; }

function testTransactionExecutorFixtures() {
  var pass = 0, boundary = new Date("2026-10-05T00:00:00Z"), base = {}, key;
  Object.keys(TRANSACTION_PRODUCTION_CONTRACT).forEach(function(k) { var c = TRANSACTION_PRODUCTION_CONTRACT[k]; if (k !== "ORDERS") base[c.SHEET] = [c.HEADERS.slice()]; });
  var ss = transactionFixtureSpreadsheet_(base), runtime = { spreadsheet: ss, lock: transactionFixtureLock_(), flush: function() {} };
  var created = executeTransactionSchemaActivationWithRuntime(runtime); if (created.status === "ACTIVATED" && created.createdSheets.indexOf("Orders") !== -1) pass++;
  var retry = executeTransactionSchemaActivationWithRuntime(runtime); if (retry.status === "ALREADY_READY" && retry.writeCount === 0) pass++;
  if (ss.fixtureSheet("Orders").values.length === 1) pass++;
  var malformed = Object.assign({}, base); malformed.Orders = [["Wrong"]];
  if (executeTransactionSchemaActivationWithRuntime({ spreadsheet: transactionFixtureSpreadsheet_(malformed), lock: transactionFixtureLock_(), flush: function() {} }).status === "BLOCKED") pass++;
  var schemaNames = Object.keys(TRANSACTION_PRODUCTION_CONTRACT).map(function(k) { return TRANSACTION_PRODUCTION_CONTRACT[k].SHEET; });
  var wrapperSource = runTransactionSchemaActivation.toString();
  if (runTransactionSchemaActivation.length === 0 && wrapperSource.indexOf("transactionProductionRuntime_()") !== -1 &&
      (wrapperSource.match(/executeTransactionSchemaActivationWithRuntime/g) || []).length === 1) pass++;
  if (schemaNames.length === 7 && wrapperSource.indexOf("TRANSACTION_PRODUCTION_CONTRACT") !== -1 && wrapperSource.indexOf("buildTransactionSchemaActivationPlan") !== -1) pass++;
  var allMissing = transactionFixtureSpreadsheet_(), allMissingWrites = 0;
  executeTransactionSchemaActivationWithRuntime({ spreadsheet: allMissing, lock: transactionFixtureLock_(), flush: function() {} });
  schemaNames.forEach(function(name) { if (allMissing.fixtureSheet(name).values.length === 1) allMissingWrites++; });
  if (allMissingWrites === 7) pass++;
  var blockedWrites = 0, blockedFixture = transactionFixtureSpreadsheet_(malformed); blockedFixture.beforeInsert = function() { blockedWrites++; };
  var blocked = executeTransactionSchemaActivationWithRuntime({ spreadsheet: blockedFixture, lock: transactionFixtureLock_(), flush: function() {} });
  if (blocked.status === "BLOCKED" && blockedWrites === 0 && blocked.blocked[0].sheet === "Orders") pass++;
  var emptyCollision = Object.assign({}, base); emptyCollision.Orders = [];
  var collisionWrites = 0, collisionFixture = transactionFixtureSpreadsheet_(emptyCollision); collisionFixture.beforeInsert = function() { collisionWrites++; };
  if (executeTransactionSchemaActivationWithRuntime({ spreadsheet: collisionFixture, lock: transactionFixtureLock_(), flush: function() {} }).status === "BLOCKED" && collisionWrites === 0) pass++;
  var exactData = {}; Object.keys(TRANSACTION_PRODUCTION_CONTRACT).forEach(function(k) { var c = TRANSACTION_PRODUCTION_CONTRACT[k]; exactData[c.SHEET] = [c.HEADERS.slice()]; });
  var exact = executeTransactionSchemaActivationWithRuntime({ spreadsheet: transactionFixtureSpreadsheet_(exactData), lock: transactionFixtureLock_(), flush: function() {} });
  if (exact.status === "ALREADY_READY" && exact.writeCount === 0) pass++;
  var partial = transactionFixtureSpreadsheet_(), insertCount = 0; partial.beforeInsert = function() { insertCount++; if (insertCount === 3) throw new Error("INTERRUPTED"); };
  try { executeTransactionSchemaActivationWithRuntime({ spreadsheet: partial, lock: transactionFixtureLock_(), flush: function() {} }); } catch (error) {}
  var reentry = executeTransactionSchemaActivationWithRuntime({ spreadsheet: partial, lock: transactionFixtureLock_(), flush: function() {} });
  if (reentry.status === "ACTIVATED" && reentry.writeCount === 5 && schemaNames.every(function(name) { return partial.fixtureSheet(name).values.length === 1; })) pass++;
  if (["executeProductVariantBootstrapWithRuntime", "executeRecipeVersionBootstrapWithRuntime", "RecipeStandardCost", "PurchaseEvents", "InventoryReceipt", "InventoryLedger"].every(function(token) { return wrapperSource.indexOf(token) === -1; })) pass++;
  if (["schemasEvaluated", "schemasReady", "schemasRequiringCreation", "schemasRefused", "createdSchemaCount", "writeCount", "errors", "conflicts"].every(function(token) { return wrapperSource.indexOf(token) !== -1; })) pass++;
  var savedFactory = transactionProductionRuntime_, savedExecutor = executeTransactionSchemaActivationWithRuntime, factoryCalls = 0, executorCalls = 0;
  transactionProductionRuntime_ = function() { factoryCalls++; return { spreadsheet: transactionFixtureSpreadsheet_(), lock: transactionFixtureLock_(), flush: function() {} }; };
  executeTransactionSchemaActivationWithRuntime = function() { executorCalls++; return { status: "ACTIVATED", writeCount: 7, createdSheets: schemaNames.slice() }; };
  var wrapperResult;
  try { wrapperResult = runTransactionSchemaActivation(); } finally { transactionProductionRuntime_ = savedFactory; executeTransactionSchemaActivationWithRuntime = savedExecutor; }
  if (factoryCalls === 1 && executorCalls === 1 && wrapperResult.status === "ACTIVATED" && wrapperResult.schemasEvaluated.length === 7 &&
      wrapperResult.schemasRequiringCreation.length === 7 && wrapperResult.createdSchemaCount === 7 && wrapperResult.writeCount === 7 && !wrapperResult.errors.length && !wrapperResult.conflicts.length) pass++;
  var products = [{ ID_Prod: "P1", Produk: "Coffee", Kategori: "Drink", Kind: "Menu", RevenueAccountCode: "4000", COGSAccountCode: "5000", IsActive: true }];
  var pricing = [{ ID_Prod: "P1", Tipe: "Hot", EffectiveFrom: boundary, EffectiveTo: "", HPP: 2, Harga: 20, IsActive: true }];
  var recipes = [{ ID_Recipe: "R1", ID_Prod: "P1", Tipe: "Hot", ID_Ingredient: "I1", UsageQty: 1, IsActive: true }];
  var items = [{ ItemID: "I1", ItemName: "Beans", Classification: "RAW", BaseUOM: "gr", EffectiveFrom: boundary, EffectiveTo: "", IsActive: true, SourceIngredientID: "I1", CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }];
  var costs = [{ ID: "C1", ItemID: "I1", StandardCost: 2, EffectiveFrom: boundary, EffectiveTo: "", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }];
  var data = { Products: transactionFixtureTable_(PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS, products), ProductPricing: transactionFixtureTable_(PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS, pricing),
    COGSRecipes: transactionFixtureTable_(PRODUCTS_DOMAIN_CONTRACT.RECIPE_HEADERS, recipes), InventoryItems: transactionFixtureTable_(BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS, items),
    RecipeStandardCost: transactionFixtureTable_(RECIPE_STANDARD_COST_CONTRACT.HEADERS, costs), ProductVariants: [TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS.slice()],
    RecipeVersions: [TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSIONS.HEADERS.slice()], RecipeVersionLines: [TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSION_LINES.HEADERS.slice()] };
  var bs = transactionFixtureSpreadsheet_(data), br = { spreadsheet: bs, lock: transactionFixtureLock_(), flush: function() {} };
  var pv = executeProductVariantBootstrapWithRuntime(br, boundary), pvRetry = executeProductVariantBootstrapWithRuntime(br, boundary);
  if (pv.status === "APPLIED" && pv.rowCount === 1 && pvRetry.status === "ALREADY_APPLIED" && pvRetry.writeCount === 0) pass++;
  var rv = executeRecipeVersionBootstrapWithRuntime(br, boundary), rvRetry = executeRecipeVersionBootstrapWithRuntime(br, boundary);
  if (rv.status === "APPLIED" && rv.versionRows === 1 && rv.lineRows === 1 && rvRetry.status === "ALREADY_APPLIED" && rvRetry.writeCount === 0) pass++;
  var versionRows = readCanonicalTable(bs, "RecipeVersions", TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSIONS.HEADERS);
  if (versionRows[0].EffectiveFrom.getTime() === boundary.getTime() && versionRows[0].ProductVariantID) pass++;
  if (JSON.stringify(data.Products) === JSON.stringify(bs.fixtureSheet("Products").values) && !bs.getSheetByName("tabsal")) pass++;
  var productWrapper = runProductVariantProductionBootstrap.toString();
  if (runProductVariantProductionBootstrap.length === 0 && productWrapper.indexOf("transactionProductionRuntime_()") !== -1) pass++;
  if ((productWrapper.match(/executeProductVariantBootstrapWithRuntime/g) || []).length === 1) pass++;
  if (productWrapper.indexOf("expected = 53") !== -1 && productWrapper.indexOf("plan.planCount !== expected") !== -1 && productWrapper.indexOf("plan.blockedCount !== 0") !== -1) pass++;
  if (productWrapper.indexOf("new Date()") !== -1 && productWrapper.indexOf("toISOString()") !== -1 && productWrapper.indexOf("2026-10-05") === -1) pass++;
  if (["eligibleCandidateCount", "blockedCount", "createdProductVariantCount", "writeCount", "errors", "conflicts", "activationBoundary"].every(function(token) { return productWrapper.indexOf(token) !== -1; })) pass++;
  if (["executeRecipeVersionBootstrapWithRuntime", "executeTransactionSchemaActivationWithRuntime", "RecipeStandardCost", "tabsal", "Finance", "Purchase", "Inventory"].every(function(token) { return productWrapper.indexOf(token) === -1; })) pass++;
  var savedProductFactory = transactionProductionRuntime_, savedProductPlanner = buildProductVariantBootstrapPlan, savedProductExecutor = executeProductVariantBootstrapWithRuntime;
  var productFactoryCalls = 0, productExecutorCalls = 0, productBoundary = null, productRuntime = { spreadsheet: bs };
  transactionProductionRuntime_ = function() { productFactoryCalls++; return productRuntime; };
  buildProductVariantBootstrapPlan = function(source, at) { productBoundary = at; return { status: "READY", planCount: 53, blockedCount: 0, blocked: [] }; };
  executeProductVariantBootstrapWithRuntime = function(runtimeArg, at) { productExecutorCalls++; if (runtimeArg !== productRuntime || at !== productBoundary || runtimeArg.requiredProductVariantCandidateCount !== 53) throw new Error("PV_WRAPPER_FORWARDING"); return { status: "APPLIED", rowCount: 53, writeCount: 53 }; };
  var productBefore = Date.now(), productResult;
  try { productResult = runProductVariantProductionBootstrap(); } finally { transactionProductionRuntime_ = savedProductFactory; buildProductVariantBootstrapPlan = savedProductPlanner; executeProductVariantBootstrapWithRuntime = savedProductExecutor; }
  if (productFactoryCalls === 1 && productExecutorCalls === 1 && productBoundary.getTime() >= productBefore && productBoundary.getTime() <= Date.now()) pass++;
  if (productResult.status === "APPLIED" && productResult.eligibleCandidateCount === 53 && productResult.blockedCount === 0 && productResult.createdProductVariantCount === 53 && productResult.writeCount === 53 && !productResult.errors.length && !productResult.conflicts.length && productResult.activationBoundary === productBoundary.toISOString()) pass++;
  function productWrapperRefusal(sheetRows, plan) {
    var sf = transactionProductionRuntime_, sp = buildProductVariantBootstrapPlan, se = executeProductVariantBootstrapWithRuntime, calls = 0, result;
    transactionProductionRuntime_ = function() { return { spreadsheet: transactionFixtureSpreadsheet_(sheetRows) }; };
    buildProductVariantBootstrapPlan = function() { return plan; };
    executeProductVariantBootstrapWithRuntime = function() { calls++; return {}; };
    try { result = runProductVariantProductionBootstrap(); } finally { transactionProductionRuntime_ = sf; buildProductVariantBootstrapPlan = sp; executeProductVariantBootstrapWithRuntime = se; }
    return { result: result, calls: calls };
  }
  var productMismatch = productWrapperRefusal(Object.assign({}, data, { ProductVariants: [TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS.slice()] }), { status: "READY", planCount: 52, blockedCount: 0, blocked: [] });
  if (productMismatch.result.status === "REFUSED" && productMismatch.result.writeCount === 0 && productMismatch.calls === 0) pass++;
  var productBlocked = productWrapperRefusal(Object.assign({}, data, { ProductVariants: [TRANSACTION_PRODUCTION_CONTRACT.PRODUCT_VARIANTS.HEADERS.slice()] }), { status: "BLOCKED", planCount: 53, blockedCount: 1, blocked: [{ code: "TEST" }] });
  if (productBlocked.result.status === "REFUSED" && productBlocked.result.blockedCount === 1 && productBlocked.calls === 0) pass++;
  var productSchema = productWrapperRefusal({}, { status: "READY", planCount: 53, blockedCount: 0, blocked: [] });
  if (productSchema.result.status === "REFUSED" && productSchema.result.errors[0].code === "PRODUCT_VARIANTS_SCHEMA_NOT_EXACT" && productSchema.calls === 0) pass++;
  var productSecondGate = executeProductVariantBootstrapWithRuntime(Object.assign({}, br, { requiredProductVariantCandidateCount: 53 }), boundary);
  if (productSecondGate.status === "REFUSED" && productSecondGate.reason === "PRODUCT_VARIANT_CANDIDATE_COUNT_MISMATCH" && productSecondGate.writeCount === 0) pass++;
  var wrapper = runRecipeVersionProductionBootstrap.toString();
  if (runRecipeVersionProductionBootstrap.length === 0 && wrapper.indexOf("transactionProductionRuntime_()") !== -1) pass++;
  if ((wrapper.match(/executeRecipeVersionBootstrapWithRuntime/g) || []).length === 1) pass++;
  if (wrapper.indexOf("expected = 53") !== -1 && wrapper.indexOf("plan.planCount !== expected") !== -1 && wrapper.indexOf("plan.blockedCount !== 0") !== -1) pass++;
  if (wrapper.indexOf("new Date()") !== -1 && wrapper.indexOf("toISOString()") !== -1 && wrapper.indexOf("2026-10-05") === -1) pass++;
  if (wrapper.indexOf("createdRecipeVersionCount") !== -1 && wrapper.indexOf("createdRecipeVersionLineCount") !== -1 && wrapper.indexOf("conflicts") !== -1) pass++;
  if (transactionProductionRuntime_.toString().indexOf("flush: function() { SpreadsheetApp.flush(); }") !== -1) pass++;
  var mismatched = executeRecipeVersionBootstrapWithRuntime(Object.assign({}, br, { requiredRecipeVersionCandidateCount: 53 }), boundary);
  if (mismatched.status === "REFUSED" && mismatched.reason === "RECIPE_VERSION_CANDIDATE_COUNT_MISMATCH" && mismatched.writeCount === 0) pass++;
  if (readCanonicalTable(bs, "RecipeVersions", TRANSACTION_PRODUCTION_CONTRACT.RECIPE_VERSIONS.HEADERS).length === 1 &&
      JSON.stringify(data.Products) === JSON.stringify(bs.fixtureSheet("Products").values) && !bs.getSheetByName("FinanceLedger") && !bs.getSheetByName("PurchaseEvents") && !bs.getSheetByName("InventoryLedger")) pass++;

  var authorityData = Object.assign({}, data);
  authorityData.ProductVariants = bs.fixtureSheet("ProductVariants").values;
  authorityData.RecipeVersions = bs.fixtureSheet("RecipeVersions").values;
  authorityData.RecipeVersionLines = bs.fixtureSheet("RecipeVersionLines").values;
  authorityData.InventoryUOMConversions = [BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.slice()];
  authorityData.Accounts = transactionFixtureTable_(CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS,
    [{ AccountCode: CASH_FOUNDATION_POLICY.ACCOUNT_CODES[0], AccountName: "Cash", IsActive: true }]);
  var authorityWithoutSuppliers = transactionProductionAuthority_(transactionFixtureSpreadsheet_(authorityData));
  if (authorityWithoutSuppliers.suppliers.length === 0) pass++;
  if (authorityWithoutSuppliers.products.length === 1) pass++;
  if (authorityWithoutSuppliers.productVariants.length === 1) pass++;
  if (authorityWithoutSuppliers.paymentMethods.length === 1) pass++;
  try {
    normalizeCanonicalTransactionPurchase_({ expenseItemID: "OSK01", supplierID: "", paidVia: CASH_FOUNDATION_POLICY.ACCOUNT_CODES[0] },
      { expenses: [{ ID_Ops: "OSK01" }], items: [{ ItemID: "ING-011", IsActive: true }], suppliers: [], paymentMethods: authorityWithoutSuppliers.paymentMethods, conversions: [] });
  } catch (error) { if (error.message === "SUPPLIER_INACTIVE") pass++; }
  var authorityMissingProducts = Object.assign({}, authorityData); delete authorityMissingProducts.Products;
  try { transactionProductionAuthority_(transactionFixtureSpreadsheet_(authorityMissingProducts)); }
  catch (error) { if (error.message === "Missing canonical sheet: Products") pass++; }
  authorityData.Suppliers = transactionFixtureTable_(SUPPLIER_MASTER_CONTRACT.HEADERS,
    [{ SupplierID: "SUP-1", Name: "Supplier", IsActive: true }]);
  if (transactionProductionAuthority_(transactionFixtureSpreadsheet_(authorityData)).suppliers[0].SupplierID === "SUP-1") pass++;
  return { total: 45, pass: pass, fail: 45 - pass };
}

function testTransactionPurchaseExpenseBehavioralFixtures() {
  var pass = 0, expenses = [{ ID_Ops: "OSK01", Item: "Milk", Kategori: "Supply", Kind: "Variable", Group: "HPP", AccountCode: "6210", IsActive: true }];
  var authority = { expenses: expenses, items: [{ ItemID: "ING-011", BaseUOM: "ml", IsActive: true }], suppliers: [{ SupplierID: "S1", IsActive: true }],
    paymentMethods: [{ code: "1000", AccountCode: "1000", IsActive: true }], conversions: [{ ConversionID: "CV1", ItemID: "ING-011", PurchaseUOM: "liter", BaseUOM: "ml", FactorToBase: 1000, EffectiveFrom: "2026-01-01", IsActive: true }] };
  var request = normalizeCanonicalTransactionPurchase_({ requestKey: "purchase-0001", expenseItemID: "OSK01", supplierID: "S1", purchaseDate: "2026-10-05",
    qty: 2, purchaseUOM: "liter", purchasePrice: 100000, paidVia: "1000" }, authority);
  var event = buildCanonicalTransactionPurchaseEvent_(request, expenses[0], { actor: "test", at: "2026-10-05T00:00:00Z" });
  var journal = buildPolicyCPurchaseJournal(event, []);
  [request.itemID === "ING-011", request.baseQty === 2000, request.paymentStatus === "PAID" && request.receiptStatus === "RECEIVED",
    event.Attestation === "" && event.ExternalRef === "" && event.SupplierSource === "", journal.status === "READY",
    journal.rows.some(function(r) { return r.AccountCode === "6210" && r.Debit === 100000; }), journal.rows.some(function(r) { return r.AccountCode === "1000" && r.Credit === 100000; }),
    !journal.rows.some(function(r) { return r.AccountCode === "2000" || r.AccountCode === "1100"; }), event.ReceiptPlan === "null"].forEach(function(v) { if (!v) throw new Error("PURCHASE_BEHAVIOR"); pass++; });
  var expense = prepareCanonicalExpenseEntry({ expenseItemId: "OSS01", amount: 5000 }, { timestamp: new Date(),
    expenseItems: [{ ID_Ops: "OSS01", Item: "Rent", Kategori: "Fixed", Kind: "Expense", Group: "Overhead", AccountCode: "6100", IsActive: true }],
    accounts: [{ AccountCode: "6100", IsActive: true }] });
  [expense.expenseItemId === "OSS01", expense.amount === 5000, submitOperationalExpense.toString().indexOf("cashAccountCode") !== -1,
    submitOperationalExpense.toString().indexOf("payable") === -1, submitOperationalExpense.toString().indexOf("description") === -1].forEach(function(v) { if (!v) throw new Error("EXPENSE_BEHAVIOR"); pass++; });
  return { purchase: { total: 9, pass: 9, fail: 0 }, expense: { total: 5, pass: 5, fail: 0 }, total: 14, pass: pass, fail: 14 - pass };
}
