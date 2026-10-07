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

function testSalesOperatorWorkflowContracts(indexSource, actionSource, productionSource, formsSource) {
  var ui = String(indexSource || ""), actions = String(actionSource || ""), production = String(productionSource || ""), forms = String(formsSource || ""), pass = 0;
  function check(id, value) { if (!value) throw new Error("SALES_OPERATOR:" + id); pass++; }
  [
    ["visible path", forms.indexOf('operationalOrderFields").hidden = type !== "SALES"') !== -1],
    ["desktop reachable", ui.indexOf('id="operationalOrderFields"') !== -1],
    ["mobile reachable", ui.indexOf('class="transaction-entry-scroll"') !== -1],
    ["multi-line", actions.indexOf("operationalTransactionState.lines.push") !== -1],
    ["variant explicit", actions.indexOf("Pilih variant yang tersedia.") !== -1],
    ["price non-editable", ui.indexOf('id="operationalSellingPrice"') === -1],
    ["request key once", actions.indexOf('pending = operationalTransactionState.pending = { type: "ORDER_CREATE", requestKey: operationalRequestKey_') !== -1],
    ["uncertain retry key", actions.indexOf("requestKey: pending.requestKey") !== -1],
    ["confirmed clears key", actions.indexOf('pending.state = "CONFIRMED"; operationalTransactionState.pending = null') !== -1],
    ["order in flight", actions.indexOf('setOperationalInFlight_("order", true)') !== -1],
    ["payment in flight", actions.indexOf('setOperationalInFlight_("payment", true)') !== -1],
    ["fulfillment in flight", actions.indexOf('setOperationalInFlight_("fulfillment", true)') !== -1],
    ["definite refusal", actions.indexOf('pending.state = "DEFINITE_FAILURE"') !== -1],
    ["unknown classified", actions.indexOf('pending.state = "UNKNOWN"') !== -1],
    ["no blind resubmit", actions.indexOf("jangan membuat transaksi baru") !== -1],
    ["committed reconciliation", actions.indexOf('result.operation.State === "COMMITTED"') !== -1],
    ["open lookup", production.indexOf("function findOperationalOrder") !== -1],
    ["refresh recovery", actions.indexOf('localStorage.setItem("numlock.sales.pending"') !== -1],
    ["paid no payment", actions.indexOf('order.PaymentStatus === "PAID"') !== -1],
    ["receive via payment only", ui.slice(ui.indexOf('id="operationalOrderFields"'), ui.indexOf('id="operationalPaymentFields"')).indexOf("Receive Via") === -1],
    ["amount order total", actions.indexOf("amount: order.OrderTotal") !== -1],
    ["duplicate payment", production.indexOf("SECOND_PAYMENT_REFUSED") !== -1],
    ["fulfillment exact next", actions.indexOf('READY: ["Complete", "COMPLETED"]') !== -1],
    ["fulfillment reread", actions.indexOf("loadOperationalOrder(order.OrderID)") !== -1],
    ["closed derived", String(operationalOrderClosed).indexOf('PaymentStatus === "PAID"') !== -1],
    ["no customer", ui.slice(ui.indexOf('id="operationalOrderFields"'), ui.indexOf('id="operationalPurchaseFields"')).indexOf("Customer") === -1],
    ["no supplier", ui.slice(ui.indexOf('id="operationalOrderFields"'), ui.indexOf('id="operationalPaymentFields"')).indexOf("Supplier") === -1],
    ["no inventory", actions.slice(actions.indexOf("function addSelectedSalesOrderLine"), actions.indexOf("function filterOperationalPurchaseUoms")).indexOf("Inventory") === -1],
    ["no rbac", actions.toUpperCase().indexOf("RBAC") === -1],
    ["no production mutation harness", ["clasp push", "createDeployment", "SpreadsheetApp"].every(function(token) { return actions.indexOf(token) === -1; })]
  ].forEach(function(test) { check(test[0], test[1]); });
  return { total: 30, pass: pass, fail: 30 - pass };
}

function testSalesRecognitionV2FoundationContracts() {
  var pass = 0, contract = SALES_RECOGNITION_V2_CONTRACT, codes = contract.REFUSAL_CODES;
  function check(id, value) { if (!value) throw new Error("SALES_V2_FOUNDATION:" + id); pass++; }
  function failsWith(config, code) { var r = validateSalesRecognitionV2Config(config); return r.status === "FAIL" && r.errors.some(function(error) { return error.code === code; }); }
  function cohort(order, context) { return classifySalesRecognitionCohort(order, context); }
  var config = salesRecognitionV2DefaultConfig();
  var activated = { mode: "ACTIVE", contractVersion: "SALES_RECOGNITION_V2", activationID: "ACT-1", activatedAt: "2026-11-01T00:00:00.000Z", configVersion: 1 };
  var paused = Object.assign({}, activated, { mode: "PAUSED" });
  var legacyOrder = { OrderID: "O-2", PaymentStatus: "PAID", FulfillmentStatus: "OPEN", CreatedAt: "2026-10-05T00:00:00Z" };
  var rawTabSal = { ID_Trx: "SAL-20261005-ABCDEF012345", Tanggal: "2026-10-05", ID_Prod: "P1", Tipe: "HOT", Qty: 1, HPP: 100, HJ: 20000, Source: "APP_ENTRY", IsActive: true };
  var pausedLegacy = { OrderID: "O-20", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN" };
  check("F01", JSON.stringify(contract.HEADERS) === JSON.stringify(["RecognitionID", "ContractVersion", "ActivationID", "OrderID", "RevisionID", "EventType", "RecognizedAt", "EconomicDate", "Amount", "RecognitionJournalID", "JournalSignature", "PostingStatus", "OperationID", "AuditID", "OriginalID", "ReversalOfRecognitionID", "ReplacementID", "Reason", "Actor", "SnapshotJSON"]));
  check("F02", contract.HEADERS.length === 20 && contract.SHEET === "SalesRecognitionEvents");
  check("F03", contract.CONTRACT_VERSION === "SALES_RECOGNITION_V2");
  check("F04", config.mode === "PREPARED" && config.contractVersion === "SALES_RECOGNITION_V2");
  check("F05", config.activationID === "" && config.activatedAt === "" && config.configVersion === 1);
  check("F06", !/\d{4}-\d{2}-\d{2}T/.test(JSON.stringify(config)));
  check("F07", validateSalesRecognitionV2Config(config).status === "PASS");
  check("F08", failsWith(Object.assign({}, config, { mode: "LIVE" }), codes.MODE_INVALID));
  check("F09", failsWith(Object.assign({}, config, { mode: 123 }), codes.MODE_INVALID));
  check("F10", failsWith(Object.assign({}, config, { contractVersion: "V1" }), codes.CONTRACT_VERSION_MISMATCH));
  check("F11", failsWith(Object.assign({}, config, { contractVersion: 123 }), codes.CONTRACT_VERSION_MISMATCH));
  check("F12", failsWith(Object.assign({}, config, { mode: "ACTIVE" }), codes.ACTIVATION_METADATA_MISSING));
  check("F13", failsWith(Object.assign({}, config, { activationID: "ACT-1" }), codes.ACTIVATION_METADATA_PRESENT));
  check("F14", validateSalesRecognitionV2Config(activated).status === "PASS");
  check("F15", failsWith(Object.assign({}, activated, { activatedAt: "2026-10-06T18:50:05.328Z" }), codes.ACTIVATION_TIMESTAMP_FORBIDDEN));
  check("F16", failsWith(Object.assign({}, activated, { activatedAt: "2026-10-06T21:50:05.328+03:00" }), codes.ACTIVATION_TIMESTAMP_FORBIDDEN));
  check("F17", failsWith(Object.assign({}, activated, { activatedAt: "2026-10-06T18:50:05.328+00:00" }), codes.ACTIVATION_TIMESTAMP_FORBIDDEN));
  check("F18", validateSalesRecognitionV2Config(null).status === "FAIL");
  check("F19", failsWith(Object.assign({}, activated, { activatedAt: "garbage" }), codes.ACTIVATION_TIMESTAMP_INVALID));
  check("F20", failsWith(Object.assign({}, activated, { activatedAt: "2026-11-01" }), codes.ACTIVATION_TIMESTAMP_INVALID));
  check("F21", failsWith(Object.assign({}, activated, { activatedAt: "2026-11-01T00:00:00" }), codes.ACTIVATION_TIMESTAMP_INVALID));
  check("F22", failsWith(Object.assign({}, activated, { activatedAt: "2026-02-30T00:00:00Z" }), codes.ACTIVATION_TIMESTAMP_INVALID));
  check("F23", failsWith(Object.assign({}, activated, { activatedAt: "2026-11-01T25:00:00Z" }), codes.ACTIVATION_TIMESTAMP_INVALID));
  check("F24", failsWith(Object.assign({}, activated, { activatedAt: "2026-11-01T00:61:00Z" }), codes.ACTIVATION_TIMESTAMP_INVALID));
  check("F25", failsWith(Object.assign({}, activated, { activatedAt: "2026-11-01T00:00:61Z" }), codes.ACTIVATION_TIMESTAMP_INVALID));
  check("F26", failsWith(Object.assign({}, activated, { activationID: 123 }), codes.ACTIVATION_METADATA_INVALID));
  check("F27", failsWith(Object.assign({}, activated, { activationID: {} }), codes.ACTIVATION_METADATA_INVALID));
  var missingActivationID = Object.assign({}, activated); delete missingActivationID.activationID;
  check("F28", failsWith(missingActivationID, codes.ACTIVATION_METADATA_INVALID));
  check("F29", failsWith(Object.assign({}, activated, { activatedAt: 20261101 }), codes.ACTIVATION_METADATA_INVALID));
  check("F30", failsWith(Object.assign({}, activated, { activatedAt: {} }), codes.ACTIVATION_METADATA_INVALID));
  var missingActivatedAt = Object.assign({}, activated); delete missingActivatedAt.activatedAt;
  check("F31", failsWith(missingActivatedAt, codes.ACTIVATION_METADATA_INVALID));
  check("F32", failsWith(Object.assign({}, config, { activationID: 123 }), codes.ACTIVATION_METADATA_INVALID));
  var preparedMissingAt = Object.assign({}, config); delete preparedMissingAt.activatedAt;
  check("F33", failsWith(preparedMissingAt, codes.ACTIVATION_METADATA_INVALID));
  check("F34", failsWith(Object.assign({}, config, { activatedAt: 123 }), codes.ACTIVATION_METADATA_INVALID));
  check("F35", failsWith(Object.assign({}, activated, { configVersion: "1" }), codes.CONFIG_VERSION_INVALID));
  check("F36", failsWith(Object.assign({}, activated, { configVersion: 0 }), codes.CONFIG_VERSION_INVALID));
  check("F37", failsWith(Object.assign({}, activated, { configVersion: 1.5 }), codes.CONFIG_VERSION_INVALID));
  check("F38", validateSalesRecognitionV2Config(Object.assign({}, activated, { activatedAt: "2026-11-01T07:00:00.000+07:00" })).status === "PASS");
  check("F39", salesRecognitionV2RequestGate(config).code === codes.V2_NOT_ACTIVATED && !salesRecognitionV2RequestGate(config).allowed);
  check("F40", validateSalesRecognitionV2Config(paused).status === "PASS");
  var pausedGate = salesRecognitionV2RequestGate(paused);
  check("F41", !pausedGate.allowed && pausedGate.code === codes.V2_MODE_PAUSED);
  check("F42", salesRecognitionV2RequestGate(activated).allowed === true);
  check("F43", salesRecognitionV2RequestGate({}).code === codes.CONFIG_INVALID);
  var legacyTabsal = { OrderID: "O-1", sourceSheet: "tabsal" };
  var pendingIntent = { OrderID: "O-3", ContractVersion: "SALES_RECOGNITION_V2", State: "IN_PROGRESS" };
  var legacyThenPending = { OrderID: "O-3", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN" };
  var committedEvent = { OrderID: "O-4", ContractVersion: "SALES_RECOGNITION_V2", PostingStatus: "COMMITTED" };
  check("F44", cohort(legacyTabsal, {}).cohort === contract.COHORTS.TABSAL_LEGACY);
  check("F45", cohort(legacyOrder, {}).cohort === contract.COHORTS.PRE_V2_ORDER && cohort(legacyOrder, {}).status === contract.STATUS.OK);
  var pending = cohort(legacyThenPending, { intents: [pendingIntent] });
  check("F46", pending.cohort === contract.COHORTS.V2_PENDING && pending.status === contract.STATUS.OK);
  var pausedPending = cohort(legacyThenPending, { intents: [pendingIntent], mode: "PAUSED", config: paused });
  check("F47", pausedPending.cohort === contract.COHORTS.V2_PENDING);
  check("F48", cohort({ OrderID: "O-4" }, { events: [committedEvent] }).cohort === contract.COHORTS.V2_COMMITTED);
  var dateOnly = cohort({ OrderID: "O-5", CreatedAt: "2026-10-07T00:00:00Z" }, { config: activated });
  check("F49", dateOnly.cohort === contract.COHORTS.INCONSISTENT && dateOnly.status === contract.STATUS.UNKNOWN && dateOnly.code === codes.DATE_ONLY_NO_PERSISTED_EVIDENCE);
  check("F50", cohort({ OrderID: "O-6" }, {}).status === contract.STATUS.UNKNOWN && cohort({ OrderID: "O-6" }, {}).cohort === contract.COHORTS.UNKNOWN);
  var unknownVersion = cohort({ OrderID: "O-7", ContractVersion: "SALES_RECOGNITION_V1" }, {});
  check("F51", unknownVersion.status === contract.STATUS.RECOVERY_REQUIRED && unknownVersion.cohort === contract.COHORTS.INCONSISTENT);
  var conflict = cohort({ OrderID: "O-8" }, { intents: [{ OrderID: "O-8", ContractVersion: "SALES_RECOGNITION_V2" }], operations: [{ OrderID: "O-8", ContractVersion: "OTHER_V1" }] });
  check("F52", conflict.status === contract.STATUS.RECOVERY_REQUIRED && conflict.code === codes.IDENTITY_CONFLICT);
  check("F53", cohort(null, {}).status === contract.STATUS.UNKNOWN);
  check("F54", cohort(legacyOrder, { config: activated }).cohort === contract.COHORTS.PRE_V2_ORDER);
  check("F55", cohort(rawTabSal, {}).cohort === contract.COHORTS.TABSAL_LEGACY && cohort(rawTabSal, {}).status === contract.STATUS.OK);
  check("F56", cohort({ ID_Trx: "TRX-77", Tanggal: "2026-01-01", ID_Prod: "P1" }, {}).cohort === contract.COHORTS.TABSAL_LEGACY);
  var unknownTrx = cohort({ ID_Trx: "XYZ" }, {});
  check("F57", unknownTrx.cohort === contract.COHORTS.UNKNOWN && unknownTrx.status === contract.STATUS.UNKNOWN);
  var rawBefore = JSON.stringify(rawTabSal); cohort(rawTabSal, { events: [{ OrderID: "OTHER", ContractVersion: "SALES_RECOGNITION_V2" }] });
  check("F58", JSON.stringify(rawTabSal) === rawBefore);
  var missingContract = cohort(pausedLegacy, { mode: "PAUSED", config: paused, events: [{ OrderID: "O-20", PostingStatus: "PENDING" }] });
  check("F59", missingContract.cohort === contract.COHORTS.INCONSISTENT && missingContract.status === contract.STATUS.RECOVERY_REQUIRED && missingContract.code === codes.EVIDENCE_CONTRACT_INVALID && missingContract.cohort !== contract.COHORTS.PRE_V2_ORDER);
  var unknownContract = cohort(pausedLegacy, { mode: "PAUSED", config: paused, events: [{ OrderID: "O-20", ContractVersion: "LEGACY_V1", PostingStatus: "PENDING" }] });
  check("F60", unknownContract.cohort === contract.COHORTS.INCONSISTENT && unknownContract.status === contract.STATUS.RECOVERY_REQUIRED && unknownContract.code === codes.IDENTITY_CONFLICT && unknownContract.cohort !== contract.COHORTS.PRE_V2_ORDER);
  var activationConflict = cohort({ OrderID: "O-21", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN" }, { mode: "PAUSED", config: paused, intents: [{ OrderID: "O-21", ContractVersion: "SALES_RECOGNITION_V2", ActivationID: "ACT-A" }], events: [{ OrderID: "O-21", ContractVersion: "SALES_RECOGNITION_V2", ActivationID: "ACT-B", PostingStatus: "PENDING" }] });
  check("F61", activationConflict.cohort === contract.COHORTS.INCONSISTENT && activationConflict.status === contract.STATUS.RECOVERY_REQUIRED && activationConflict.code === codes.IDENTITY_CONFLICT && activationConflict.cohort !== contract.COHORTS.PRE_V2_ORDER);
  var orderActivationMismatch = cohort({ OrderID: "O-22", ContractVersion: "SALES_RECOGNITION_V2", ActivationID: "ACT-1" }, { events: [{ OrderID: "O-22", ContractVersion: "SALES_RECOGNITION_V2", ActivationID: "ACT-2", PostingStatus: "PENDING" }] });
  check("F62", orderActivationMismatch.cohort === contract.COHORTS.INCONSISTENT && orderActivationMismatch.status === contract.STATUS.RECOVERY_REQUIRED && orderActivationMismatch.code === codes.IDENTITY_CONFLICT);
  var otherOrderIgnored = cohort({ OrderID: "O-23", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN" }, { mode: "PAUSED", config: paused, events: [{ OrderID: "O-999", ContractVersion: "SALES_RECOGNITION_V2", PostingStatus: "COMMITTED" }] });
  check("F63", otherOrderIgnored.cohort === contract.COHORTS.PRE_V2_ORDER && otherOrderIgnored.status === contract.STATUS.OK);
  var unboundEvidence = cohort({ OrderID: "O-24", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN" }, { mode: "PAUSED", config: paused, events: [{ ContractVersion: "SALES_RECOGNITION_V2", PostingStatus: "PENDING" }] });
  check("F64", unboundEvidence.cohort === contract.COHORTS.INCONSISTENT && unboundEvidence.status === contract.STATUS.RECOVERY_REQUIRED && unboundEvidence.code === codes.EVIDENCE_UNBOUND && unboundEvidence.cohort !== contract.COHORTS.PRE_V2_ORDER);
  check("F65", cohort({ OrderID: "O-25" }, { intents: {} }).status === contract.STATUS.RECOVERY_REQUIRED && cohort({ OrderID: "O-25" }, { intents: {} }).code === codes.EVIDENCE_MALFORMED);
  check("F66", cohort({ OrderID: "O-25" }, { events: "not-an-array" }).status === contract.STATUS.RECOVERY_REQUIRED && cohort({ OrderID: "O-25" }, { events: "not-an-array" }).code === codes.EVIDENCE_MALFORMED);
  check("F67", cohort({ OrderID: "O-25" }, { operations: [null] }).status === contract.STATUS.RECOVERY_REQUIRED && cohort({ OrderID: "O-25" }, { operations: [null] }).code === codes.EVIDENCE_MALFORMED);
  check("F68", cohort({ OrderID: "O-25" }, "junk").status === contract.STATUS.RECOVERY_REQUIRED && cohort({ OrderID: "O-25" }, "junk").code === codes.EVIDENCE_MALFORMED);
  check("F69", cohort({ ContractVersion: "SALES_RECOGNITION_V2" }, {}).status === contract.STATUS.RECOVERY_REQUIRED && cohort({ ContractVersion: "SALES_RECOGNITION_V2" }, {}).code === codes.EVIDENCE_UNBOUND);
  var evidenceContext = { mode: "PAUSED", events: [{ OrderID: "O-27", ContractVersion: "SALES_RECOGNITION_V2", PostingStatus: "COMMITTED" }] };
  var contextBefore = JSON.stringify(evidenceContext); cohort({ OrderID: "O-27", PaymentStatus: "PAID" }, evidenceContext);
  check("F70", JSON.stringify(evidenceContext) === contextBefore);
  check("F71", pass === 70);
  return { total: 71, pass: pass, fail: 71 - pass };
}

function testSalesV2CutoverPeriods() {
  var pass = 0, contract = SALES_RECOGNITION_V2_CONTRACT, codes = contract.REFUSAL_CODES;
  function check(value, label) { if (!value) throw new Error("SALES_V2_CUTOVER:" + label); pass++; }
  var prepared = salesRecognitionV2DefaultConfig();
  check(prepared.mode === "PREPARED" && prepared.activationID === "" && prepared.activatedAt === "",
    "pre-activation default disabled");
  var activated = { mode: "ACTIVE", contractVersion: "SALES_RECOGNITION_V2", activationID: "ACT-1",
    activatedAt: "2026-11-01T00:00:00.000Z", configVersion: 1 };
  var paused = Object.assign({}, activated, { mode: "PAUSED" });
  check(paused.activationID === activated.activationID && paused.activatedAt === activated.activatedAt,
    "pause does not change T");
  check(salesRecognitionV2RequestGate(paused).code === codes.V2_MODE_PAUSED,
    "PAUSED rejects new Sales");
  var pendingOrder = { OrderID: "O-10", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN" };
  var intents = [{ OrderID: "O-10", ContractVersion: "SALES_RECOGNITION_V2", State: "IN_PROGRESS" }];
  check(classifySalesRecognitionCohort(pendingOrder, { intents: intents, config: prepared }).cohort ===
    contract.COHORTS.V2_PENDING, "pre-T V2 intent retries stay V2");
  check(classifySalesRecognitionCohort(pendingOrder, { intents: intents, config: paused }).cohort ===
    contract.COHORTS.V2_PENDING, "paused retry stays V2");
  check(classifySalesRecognitionCohort(pendingOrder, { intents: intents, config: activated }).cohort ===
    contract.COHORTS.V2_PENDING, "sticky pending classification across mode changes");
  check(classifySalesRecognitionCohort(pendingOrder, { intents: intents, mode: "PAUSED" }).cohort !==
    contract.COHORTS.PRE_V2_ORDER && classifySalesRecognitionCohort(pendingOrder,
      { intents: intents, mode: "PAUSED" }).cohort !== contract.COHORTS.TABSAL_LEGACY,
    "no legacy cohort under pause");
  var resumed = Object.assign({}, activated, { mode: "ACTIVE" });
  check(salesRecognitionV2RequestGate(resumed).allowed && resumed.activatedAt === activated.activatedAt,
    "resume keeps contract and T");
  check(validateSalesRecognitionV2Config(resumed).status === "PASS" &&
    validateSalesRecognitionV2Config(paused).status === "PASS", "resume/pause configs valid");
  return { total: 9, pass: pass, fail: 9 - pass };
}
