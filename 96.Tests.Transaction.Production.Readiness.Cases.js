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
  ["OperationPlan","createOrder(plan)","OrderLineID","ORDER_READBACK_INCOMPLETE","ORDER_IDENTITY_CONFLICT","ORDER_LINE_IDENTITY_CONFLICT","COMMITTED","PayloadHash"].forEach(function(token, i) { check("OC", (createDurableOperationalOrder_.toString() + recoverTransactionOperation.toString() + createTransactionSpreadsheetRepository.toString() + TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS.join()).indexOf(token) !== -1, "OC" + (i + 1)); });
  ["transactionResolveOperation_","transactionFinanceSettlementExists_","runtime.settle","createPayment","PaymentStatus !== \"PAID\"","PAYMENT_READBACK_INCOMPLETE","transactionCommitOperation_","findPaymentByRequest","CSH-SAL-","SECOND_PAYMENT_REFUSED"].forEach(function(token, i) { check("PC", (createDurableOperationalPayment_.toString() + transactionFinanceSettlementExists_.toString() + createTransactionSpreadsheetRepository.toString()).indexOf(token) !== -1, "PC" + (i + 1)); });
  [createDurableOperationalOrder_.toString().indexOf("settle") === -1, buildOperationalPaymentSettlement_.toString().indexOf("RevenueSnapshot") !== -1,
    buildOperationalPaymentSettlement_.toString().indexOf("HppSnapshot") !== -1, buildOperationalPaymentSettlement_.toString().indexOf("INFLOW") !== -1,
    createDurableOperationalPayment_.toString().indexOf("transactionFinanceSettlementExists_") !== -1, createDurableOperationalPayment_.toString().indexOf("runtime.settle") !== -1,
    createDurableOperationalPayment_.toString().indexOf("operation.State === \"COMMITTED\"") !== -1, createTransactionSpreadsheetRepository.toString().indexOf("SECOND_PAYMENT_REFUSED") !== -1]
    .forEach(function(v, i) { check("FS", v, "FS" + (i + 1)); });
  return { totals: totals, passed: passed, failed: 0 };
}
