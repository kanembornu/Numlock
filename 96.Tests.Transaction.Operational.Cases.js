function testTransactionOperationalFoundationContracts(indexSource, actionSource) {
  var pass = 0, ids = [];
  function check(id, value) { if (!value) throw new Error(id); pass++; ids.push(id); }
  function refuses(code, operation) { try { operation(); } catch (error) { return error.code === code; } return false; }
  var date = new Date("2026-10-05T02:00:00Z"), sequence = 0;
  var authority = {
    products: [{ ProductID: "PROD-1", Name: "Coffee", IsActive: true }],
    productVariants: [{ ProductVariantID: "PV-1-HOT", ProductID: "PROD-1", Tipe: "HOT", IsActive: true }],
    pricing: [{ ID_Prod: "PROD-1", Tipe: "Hot", Harga: 25000, EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true }],
    items: [{ ItemID: "ING-1", ItemName: "Beans", BaseUOM: "gr", IsActive: true }],
    standardCosts: [{ ItemID: "ING-1", StandardCost: 100, EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true }],
    recipeVersions: [{ RecipeVersionID: "REC-1-V1", ProductVariantID: "PV-1-HOT", EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true,
      Components: [{ ItemID: "ING-1", QtyBase: 10, UOM: "gr" }] }]
  };
  var runtime = { now: function() { return date; }, uuid: function() { sequence++; return String(sequence); },
    orderSequence: function() { return "0001"; }, actor: function() { return "owner@example.com"; } };
  var repo = createOperationalMemoryRepository({ paymentMethods: [{ code: "CASH", AccountCode: "1000", IsActive: true }] });
  var order = createOperationalOrderWithRepository({ orderType: "DINE_IN", lines: [
    { productID: "PROD-1", productVariantID: "PV-1-HOT", qty: 2 }, { productID: "PROD-1", productVariantID: "PV-1-HOT", qty: 1 }] }, authority, runtime, repo).order;
  check("O1", order.PaymentStatus === "UNPAID" && !Object.prototype.hasOwnProperty.call(order, "ReceiveVia"));
  check("O2", order.FulfillmentStatus === "OPEN");
  check("O3", order.OrderType === "DINE_IN");
  check("O4", prepareOperationalOrder({ orderType: "TAKE_AWAY", lines: [{ productID: "PROD-1", productVariantID: "PV-1-HOT", qty: 1 }] }, authority, runtime).OrderType === "TAKE_AWAY");
  check("O5", order.Lines.length === 2);
  check("O6", order.Lines[0].sellingPriceSnapshot === 25000 && order.Lines[0].recipeVersionID === "REC-1-V1" &&
    order.Lines[0].productVariantID === "PV-1-HOT" && order.Lines[0].tipe === "HOT");
  check("O7", refuses("PRODUCT_NOT_AVAILABLE", function() { prepareOperationalOrder({ orderType: "DINE_IN", lines: [{ productID: "BAD", qty: 1 }] }, authority, runtime); }));
  check("O8", refuses("RECIPE_VERSION_NOT_AVAILABLE", function() { prepareOperationalOrder({ orderType: "DINE_IN", lines: [{ productID: "PROD-1", productVariantID: "PV-1-HOT", qty: 1 }] }, Object.assign({}, authority, { recipeVersions: [] }), runtime); }));
  check("O9", repo.read().payments.length === 0);
  check("O10", order.HppTotalSnapshot === 3000 && repo.read().writeCount === 1);
  var preparing = transitionOperationalFulfillmentWithRepository(order.OrderID, "PREPARING", runtime, repo).order;
  check("F1", preparing.FulfillmentStatus === "PREPARING");
  var ready = transitionOperationalFulfillmentWithRepository(order.OrderID, "READY", runtime, repo).order;
  check("F2", ready.FulfillmentStatus === "READY");
  var completed = transitionOperationalFulfillmentWithRepository(order.OrderID, "COMPLETED", runtime, repo).order;
  check("F3", completed.FulfillmentStatus === "COMPLETED");
  check("F4", refuses("INVALID_FULFILLMENT_TRANSITION", function() { transitionOperationalFulfillment(completed, "READY", runtime); }));
  check("F5", preparing.PreparingAt === date && ready.PreparingAt === date && completed.ReadyAt === date);
  check("F6", repo.read().payments.length === 0);
  check("F7", !Object.prototype.hasOwnProperty.call(completed, "InventoryMovement"));
  var paymentRepo = createOperationalMemoryRepository({ orders: [order], paymentMethods: [{ code: "CASH", AccountCode: "1000", IsActive: true }] });
  var settlements = [], paymentRuntime = Object.assign({}, runtime, { settle: function(request) { settlements.push(request); return { status: "POSTED" }; } });
  check("PM1", paymentRepo.findOrder(order.OrderID).PaymentStatus === "UNPAID");
  check("PM2", refuses("RECEIVE_VIA_REQUIRED", function() { payOperationalOrderWithRepository(order.OrderID, { requestKey: "R1" }, paymentRuntime, paymentRepo); }));
  check("PM3", refuses("PAYMENT_AMOUNT_MISMATCH", function() { payOperationalOrderWithRepository(order.OrderID, { requestKey: "R1", receiveVia: "CASH", amount: 1 }, paymentRuntime, paymentRepo); }));
  var paid = payOperationalOrderWithRepository(order.OrderID, { requestKey: "R1", receiveVia: "CASH" }, paymentRuntime, paymentRepo);
  check("PM4", paid.order.PaymentStatus === "PAID");
  check("PM5", paid.payment.PaidAt === date);
  check("PM6", settlements.length === 1 && settlements[0].settlement.Amount === order.OrderTotal);
  check("PM7", settlements[0].settlement.HppSnapshot === order.HppTotalSnapshot);
  var retryState = paymentRepo.read(), retry = payOperationalOrder(order, { requestKey: "R1", receiveVia: "CASH" }, retryState, paymentRuntime);
  check("PM8", retry.idempotent && settlements.length === 1);
  check("PM9", refuses("SECOND_PAYMENT_REFUSED", function() { payOperationalOrder(order, { requestKey: "R2", receiveVia: "CASH" }, retryState, paymentRuntime); }));
  check("PM10", refuses("PAYMENT_AMOUNT_MISMATCH", function() { payOperationalOrder(order, { requestKey: "R3", receiveVia: "CASH", amount: order.OrderTotal / 2 }, { payments: [], paymentMethods: retryState.paymentMethods }, paymentRuntime); }));
  check("C1", !operationalOrderClosed(preparing));
  check("C2", !operationalOrderClosed(completed));
  check("C3", operationalOrderClosed(Object.assign({}, completed, { PaymentStatus: "PAID" })));
  var purchaseAuthority = { suppliers: [{ SupplierID: "SUP-1", IsActive: true }, { SupplierID: "SUP-X", IsActive: false }], items: authority.items,
    conversions: [{ ConversionID: "CONV-1", ItemID: "ING-1", PurchaseUOM: "kg", BaseUOM: "gr", FactorToBase: 1000,
      EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true }], paymentMethods: retryState.paymentMethods };
  var purchaseRepo = createOperationalMemoryRepository(), purchasePayload = { purchaseDate: "2026-10-05", supplierID: "SUP-1", itemID: "ING-1", qty: 2,
    purchaseUOM: "kg", purchasePrice: 300000, paidVia: "CASH" };
  var purchase = createOperationalPurchaseWithRepository(purchasePayload, purchaseAuthority, purchaseRepo).purchase;
  check("P1", purchase.supplierID === "SUP-1");
  check("P2", refuses("SUPPLIER_INACTIVE", function() { prepareOperationalPurchase(Object.assign({}, purchasePayload, { supplierID: "SUP-X" }), purchaseAuthority); }));
  check("P3", transactionOperationalMap_(purchaseAuthority.suppliers, "SupplierID")["SUP-X"].SupplierID === "SUP-X");
  check("P4", purchase.itemID === "ING-1");
  check("P5", refuses("INVALID_UOM", function() { prepareOperationalPurchase(Object.assign({}, purchasePayload, { purchaseUOM: "box" }), purchaseAuthority); }));
  check("P6", purchase.baseQty === 2000 && purchase.normalizedUnitCost === 150);
  check("P7", purchase.paidVia === "CASH");
  check("P8", purchase.paymentStatus === "PAID" && purchase.receiptStatus === "RECEIVED");
  check("P9", !Object.prototype.hasOwnProperty.call(purchase, "payableID"));
  check("P10", !Object.prototype.hasOwnProperty.call(purchase, "inventoryReceiptID"));
  var expenseRepo = createOperationalMemoryRepository(), expenseAuthority = { paymentMethods: retryState.paymentMethods };
  var expense = createOperationalExpenseWithRepository({ date: "2026-10-05", category: "Utilities", description: "Power", amount: 1000, paidVia: "CASH" }, expenseAuthority, expenseRepo).expense;
  check("E1", refuses("PAID_VIA_REQUIRED", function() { prepareOperationalExpense({ date: "2026-10-05", category: "Utilities", description: "Power", amount: 1000 }, expenseAuthority); }));
  check("E2", expense.paymentStatus === "PAID");
  check("E3", !Object.prototype.hasOwnProperty.call(expense, "payableID"));
  check("E4", expense.amount === 1000 && expense.paidVia === "CASH");
  var ui = String(indexSource || ""), actions = String(actionSource || "");
  check("UX1", /<label[^>]*>Product<\/label>/.test(ui) && /<label[^>]*>Amount \(IDR\)<\/label>/.test(ui));
  check("UX2", ui.indexOf("Pilih supplier") !== -1 && ui.indexOf("Pilih item") !== -1 && ui.indexOf("Pilih UOM") !== -1 && ui.indexOf("Pilih metode pembayaran") !== -1);
  check("UX3", actions.indexOf("Supplier wajib dipilih.") !== -1 && actions.indexOf("Qty harus lebih besar dari 0.") !== -1 && actions.indexOf("UOM tidak valid untuk item ini.") !== -1);
  var orderRegion = ui.slice(ui.indexOf('id="operationalOrderFields"'), ui.indexOf('id="operationalPaymentFields"'));
  check("UX4", orderRegion.indexOf("Receive Via") === -1);
  check("UX5", ui.indexOf('id="operationalPaymentFields"') !== -1 && ui.indexOf("Receive Via") !== -1 &&
    actions.indexOf('operationalServerCall("submitOperationalOrder"') !== -1 &&
    actions.indexOf('operationalServerCall("submitOperationalPayment"') !== -1 &&
    actions.indexOf('operationalServerCall("submitOperationalFulfillment"') !== -1 &&
    actions.indexOf('operationalServerCall("submitOperationalPurchase"') !== -1 &&
    actions.indexOf('operationalServerCall("submitOperationalExpense"') !== -1);
  return { pass: pass, fail: 0, ids: ids };
}
