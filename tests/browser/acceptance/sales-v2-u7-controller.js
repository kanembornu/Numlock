// SALES_RECOGNITION_V2 U7 operator controller fixture (Node-only; executed via
// `_test_runner.js`). Loads the real 195.View.Transactions.Actions.html client
// controller into an in-memory DOM/`google.script.run` harness and drives the
// actual event/controller functions: Save button behavior, stable RequestKey
// reuse, duplicate-click single flight, UNKNOWN -> same-identity recovery,
// Done only after confirmed success, V2 status rendering (no payment/
// fulfillment continuation), and Correct/Void cohort routing (V2 -> U6,
// legacy -> legacy). No browser process, no network, no production runtime.
var fs = require("fs");
var vm = require("vm");

var ACTIONS_PATH = "195.View.Transactions.Actions.html";

function makeElement(id) {
  return {
    id: id, innerText: "", innerHTML: "", textContent: "", value: "", hidden: false,
    disabled: false, checked: false, dataset: {}, style: {}, attributes: {},
    setAttribute: function(key, value) { this.attributes[key] = String(value); },
    getAttribute: function(key) { return this.attributes[key]; },
    removeAttribute: function(key) { delete this.attributes[key]; },
    appendChild: function() {}, removeChild: function() {}, focus: function() {},
    blur: function() {}, click: function() {}, scrollIntoView: function() {},
    addEventListener: function() {}, removeEventListener: function() {},
    querySelector: function() { return makeElement("child"); },
    querySelectorAll: function() { return []; },
    classList: { add: function() {}, remove: function() {}, toggle: function() {},
      contains: function() { return false; } }
  };
}

function u7ControllerHarness_() {
  var elements = Object.create(null);
  var storageMap = Object.create(null);
  function storage() {
    return {
      getItem: function(key) {
        return Object.prototype.hasOwnProperty.call(storageMap, key) ? storageMap[key] : null;
      },
      setItem: function(key, value) { storageMap[key] = String(value); },
      removeItem: function(key) { delete storageMap[key]; }
    };
  }
  var calls = [];
  var pendingCall = null;
  var runnerHandlers = { success: null, failure: null };
  var googleRun;
  googleRun = new Proxy({}, {
    get: function(target, property) {
      if (property === "withSuccessHandler") {
        return function(fn) { runnerHandlers.success = fn; return googleRun; };
      }
      if (property === "withFailureHandler") {
        return function(fn) { runnerHandlers.failure = fn; return googleRun; };
      }
      return function(payload) {
        calls.push({ method: String(property), payload: payload });
        pendingCall = { method: String(property), payload: payload,
          success: runnerHandlers.success, failure: runnerHandlers.failure };
      };
    }
  });
  var elements_;
  var ctx = {
    console: { log: function() {}, error: function() {}, warn: function() {} },
    localStorage: storage(),
    sessionStorage: storage(),
    performance: { now: function() { return 0; } },
    document: {
      getElementById: function(id) {
        if (!elements[id]) elements[id] = makeElement(id);
        return elements[id];
      },
      createElement: function(tag) { return makeElement(tag); },
      body: { appendChild: function() {}, removeChild: function() {},
        classList: { add: function() {}, remove: function() {} } },
      addEventListener: function() {}
    },
    google: { script: { run: googleRun } },
    // State globals normally provided by 192/191/190/194.
    transactionEntryState: { selectedProduct: { productId: "P1", product: "Coffee",
      category: "Drink", kind: "Menu" }, selectedType: "Hot", qty: 1,
      pricing: { price: 20000 }, submitting: false, submissionComplete: false },
    createInitialTransactionEntryState: function() { return ctx.transactionEntryState; },
    transactionDetailCache: {}, transactionDetailPending: {}, transactionDetailSources: {},
    transactionLifecycleRequestSequence: 0,
    transactionLifecycleState: { detail: null, mode: "detail", trigger: null, submitting: false },
    transactionDiagnosticPending: {},
    transactionDiagnostics: { actions: { viewEventCount: 0, correctEventCount: 0,
      voidEventCount: 0 } },
    lastDashboardRequest: null, dashboardRequestSequence: 0, activeDashboardRequestToken: 0,
    dashboardRequestInFlight: false,
    initializeStableDashboardElements: function() { return elements_; },
    formatEntryCurrency: function(value) { return "Rp " + Number(value || 0); },
    escapeUiHtml: function(value) { return String(value === undefined || value === null ? "" : value); },
    formatTransactionDate: function(value) { return String(value || ""); },
    invalidateTransactionsClientCaches: function() {},
    completeTransactionActionDiagnostic: function() {},
    invalidateFinanceCache: function() {},
    requestDashboardData: function() {},
    refreshTransactionsAfterPurchaseMutation: function() {},
    openTransactionDetail: function() {},
    transactionDetailIdentity: function(id) { return id ? String(id) : ""; },
    openPurchaseVoidDialog: function() {},
    openPurchaseCorrectDialog: function() {},
    openPurchaseResolveDialog: function() {},
    checkPendingPurchaseRecovery: function() { return null; },
    formatSignedCurrency: function() { return ""; },
    escapeUiHtmlExists: true
  };
  function el(id) { return ctx.document.getElementById(id); }
  elements_ = {
    lifecycle: { overlay: el("overlay"), dialog: el("dialog"), title: el("title"),
      description: el("description"), state: el("state"), content: el("content"),
      footer: el("footer"), voidRegion: el("voidRegion"), voidReason: el("voidReason"),
      voidReasonError: el("voidReasonError") },
    appShell: { inert: false },
    transactionEntry: { overlay: el("entryOverlay"), dialog: el("entryDialog"),
      form: el("entryForm"), success: el("entrySuccess"),
      successDetails: el("entrySuccessDetails"), submitRegion: el("submitRegion"),
      generalError: el("generalError"), title: el("entryTitle"),
      description: el("entryDescription"), typeFieldset: el("typeFieldset"),
      typeSales: el("typeSales"), typeExpense: el("typeExpense"),
      correctionWorkspace: el("correctionWorkspace"),
      correctionReasonRegion: el("correctionReasonRegion"),
      correctionReview: el("correctionReview"),
      correctionReason: el("correctionReason"),
      correctionReasonError: el("correctionReasonError"),
      salesFields: el("salesFields"), expenseFields: el("expenseFields"),
      productSearch: el("productSearch"), productMeta: el("productMeta"),
      qty: el("qty"), typeHot: el("typeHot"), typeCold: el("typeCold"),
      expenseSearch: el("expenseSearch"), expenseMeta: el("expenseMeta"),
      amount: el("amount"), submit: el("submit") }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ACTIONS_PATH, "utf8"), ctx, { filename: ACTIONS_PATH });
  return { ctx: ctx, elements: elements, calls: calls,
    pendingCall: function() { return pendingCall; },
    driveSuccess: function(response) {
      var call = pendingCall; pendingCall = null;
      if (!call || typeof call.success !== "function") throw new Error("NO_SUCCESS_HANDLER");
      call.success(response);
    },
    driveFailure: function(error) {
      var call = pendingCall; pendingCall = null;
      if (!call || typeof call.failure !== "function") throw new Error("NO_FAILURE_HANDLER");
      call.failure(error || new Error("RPC_FAILURE"));
    },
    storage: storageMap };
}

function u7Assert(checks, id, value, detail) {
  if (!value) throw new Error("SALES_V2_U7_CONTROLLER:" + id +
    (detail === undefined ? "" : "|" + detail));
  checks.passed++;
}

function runSalesV2U7Controller() {
  var checks = { total: 0, passed: 0, failed: 0, ids: [] };
  function ok(id, value, detail) {
    checks.total++;
    u7Assert(checks, id, value, detail);
    checks.ids.push(id);
  }

  // C1: Save -> confirmed V2 Done; payment/fulfillment surfaces hidden; the
  // V2 status line shows recognition semantics, never Paid/Unpaid.
  var baseAuthority = { products: [{ ProductID: "P1", Name: "Coffee", IsActive: true },
      { ProductID: "P2", Name: "Tea", IsActive: true }],
    productVariants: [{ ProductVariantID: "PV1", ProductID: "P1", Tipe: "HOT",
        SellingPrice: 20000 },
      { ProductVariantID: "PV2-COLD", ProductID: "P2", Tipe: "COLD", SellingPrice: 15000 }],
    suppliers: [], purchaseItems: [], expenseItems: [], items: [], conversions: [],
    paymentMethods: [] };
  function primeAuthority(harness) {
    harness.ctx.operationalTransactionState.authorityStatus = "READY";
    harness.ctx.operationalTransactionState.authority = baseAuthority;
  }
  var h = u7ControllerHarness_();
  primeAuthority(h);
  h.ctx.operationalTransactionState.lines = [{ productID: "P1", productVariantID: "PV1",
    qty: 1, name: "Coffee · Hot", price: 20000 }];
  h.ctx.document.getElementById("operationalOrderType").value = "DINE_IN";
  h.ctx.saveOperationalOrder();
  ok("C1a", h.calls.length === 1 && h.calls[0].method === "submitOperationalOrder" &&
    h.calls[0].payload.requestKey && h.calls[0].payload.lines.length === 1 &&
    !Object.prototype.hasOwnProperty.call(h.calls[0].payload, "orderTotal"),
    JSON.stringify(h.calls.map(function(c) { return c.method; })));
  var savedKey = h.calls[0].payload.requestKey;
  h.driveSuccess({ success: true, requestKey: savedKey,
    data: { OrderID: "ORD-U7-C1", OrderNumber: "ORD-U7-C1", OrderType: "DINE_IN",
      OrderTotal: 20000, PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
      salesCohort: "V2_COMMITTED", recognitionStatus: "RECOGNIZED",
      Lines: [{ OrderLineID: "OL-1", ProductID: "P1", ProductVariantID: "PV1",
        Tipe: "HOT", Qty: 1, SellingPriceSnapshot: 20000 }] } });
  var order = h.ctx.operationalTransactionState.order;
  ok("C1b", h.ctx.operationalTransactionState.pending === null &&
    order && order.salesCohort === "V2_COMMITTED");
  ok("C1c", h.ctx.document.getElementById("operationalPaymentFields").hidden === true &&
    h.ctx.document.getElementById("operationalFulfillmentFields").hidden === true &&
    h.ctx.document.getElementById("operationalFulfillmentNext").hidden === true);
  var statusText = h.ctx.document.getElementById("operationalOrderStatus").textContent;
  ok("C1d", statusText.indexOf("Recognized") !== -1 &&
    statusText.indexOf("UNPAID") === -1 && statusText.indexOf("OPEN") === -1 &&
    statusText.indexOf("Receive Via") === -1, statusText);

  // C2: duplicate click -> one in-flight request (server idempotency is
  // authoritative; the controller never double-dispatches).
  var h2 = u7ControllerHarness_();
  primeAuthority(h2);
  h2.ctx.operationalTransactionState.lines = [{ productID: "P1", productVariantID: "PV1",
    qty: 1, name: "Coffee · Hot", price: 20000 }];
  h2.ctx.document.getElementById("operationalOrderType").value = "DINE_IN";
  h2.ctx.saveOperationalOrder();
  h2.ctx.saveOperationalOrder();
  h2.ctx.saveOperationalOrder();
  ok("C2a", h2.calls.length === 1, String(h2.calls.length));
  var key2 = h2.calls[0].payload.requestKey;

  // C3: UNKNOWN keeps the SAME RequestKey; retry reuses it; no new identity.
  // The unknown handler auto-reconciles once (findOperationalOperation).
  h2.driveFailure(new Error("RPC_TIMEOUT"));
  ok("C3a", h2.ctx.operationalTransactionState.pending !== null &&
    h2.ctx.operationalTransactionState.pending.requestKey === key2 &&
    h2.calls.length === 2 && h2.calls[1].method === "findOperationalOperation" &&
    h2.ctx.document.getElementById("operationalOrderError").innerText.indexOf("jangan membuat transaksi baru") !== -1,
    JSON.stringify({ pending: h2.ctx.operationalTransactionState.pending,
      calls: h2.calls.map(function(c) { return c.method; }) }));
  h2.driveSuccess({ success: true, data: { operation: { State: "IN_PROGRESS", RequestKey: key2 } } });
  ok("C3b", h2.ctx.operationalTransactionState.pending !== null &&
    h2.ctx.operationalTransactionState.pending.state === "UNKNOWN" &&
    h2.ctx.operationalTransactionState.pending.requestKey === key2 &&
    h2.storage["numlock.sales.pending"] !== undefined &&
    JSON.parse(h2.storage["numlock.sales.pending"]).requestKey === key2,
    JSON.stringify(h2.ctx.operationalTransactionState.pending));
  h2.ctx.saveOperationalOrder();
  ok("C3c", h2.calls.length === 3 && h2.calls[2].method === "submitOperationalOrder" &&
    h2.calls[2].payload.requestKey === key2, JSON.stringify(h2.calls[2] && h2.calls[2].payload));

  // C4: reconciliation of the SAME operation -> Done only after COMMITTED.
  h2.driveFailure(new Error("RPC_TIMEOUT_2"));
  ok("C4a0", h2.ctx.operationalTransactionState.pending !== null &&
    h2.ctx.operationalTransactionState.pending.requestKey === key2 &&
    h2.calls.length === 4 && h2.calls[3].method === "findOperationalOperation",
    JSON.stringify(h2.calls.map(function(c) { return c.method; })));
  h2.driveSuccess({ success: true, data: { operation: { State: "IN_PROGRESS", RequestKey: key2 } } });
  ok("C4b", h2.ctx.operationalTransactionState.pending !== null &&
    h2.ctx.operationalTransactionState.pending.state === "UNKNOWN" &&
    h2.ctx.operationalTransactionState.pending.requestKey === key2,
    JSON.stringify(h2.ctx.operationalTransactionState.pending));
  h2.ctx.reconcileOperationalUnknown();
  ok("C4c", h2.calls.length === 5 && h2.calls[4].method === "findOperationalOperation" &&
    h2.calls[4].payload.requestKey === key2 &&
    h2.calls[4].payload.operationType === "ORDER_CREATE",
    JSON.stringify(h2.calls[4] && h2.calls[4].payload));
  h2.driveSuccess({ success: true, data: { operation: { State: "COMMITTED", RequestKey: key2,
      BusinessID: "ORD-U7-C4" },
    order: { OrderID: "ORD-U7-C4", OrderNumber: "ORD-U7-C4", OrderType: "DINE_IN",
      OrderTotal: 20000, salesCohort: "V2_COMMITTED", Lines: [] } } });
  ok("C4d", h2.ctx.operationalTransactionState.pending === null &&
    (h2.ctx.operationalTransactionState.order || {}).OrderID === "ORD-U7-C4",
    JSON.stringify({ pending: h2.ctx.operationalTransactionState.pending,
      order: h2.ctx.operationalTransactionState.order,
      calls: h2.calls.map(function(c) { return c.method; }) }));

  // C5: payload immutable while pending; line add is locked until resolution.
  var h3 = u7ControllerHarness_();
  primeAuthority(h3);
  h3.ctx.operationalTransactionState.lines = [{ productID: "P1", productVariantID: "PV1",
    qty: 1, name: "Coffee · Hot", price: 20000 }];
  h3.ctx.document.getElementById("operationalOrderType").value = "DINE_IN";
  h3.ctx.transactionEntryState.selectedProduct = { productId: "P2", product: "Tea" };
  h3.ctx.transactionEntryState.selectedType = "Cold";
  h3.ctx.transactionEntryState.pricing = { price: 15000 };
  h3.ctx.transactionEntryState.qty = 2;
  h3.ctx.saveOperationalOrder();
  var frozenPayload = JSON.stringify(h3.pendingCall().payload);
  h3.ctx.addSelectedSalesOrderLine();
  ok("C5a", h3.ctx.operationalTransactionState.lines.length === 1 &&
    JSON.stringify(h3.pendingCall().payload) === frozenPayload &&
    h3.ctx.document.getElementById("operationalOrderError").innerText.indexOf("penyimpanan") !== -1);
  // Definite refusal (no write) resolves the intent -> corrected intent may
  // change lines and receive a NEW identity.
  h3.driveSuccess({ success: false, error: { code: "INVALID_QTY",
    message: "Quantity must be a positive whole number." } });
  ok("C5b", h3.ctx.operationalTransactionState.pending === null &&
    h3.calls.length === 1 && h3.calls[0].payload.requestKey.length > 0);
  h3.ctx.addSelectedSalesOrderLine();
  ok("C5c", h3.ctx.operationalTransactionState.lines.length === 2);
  h3.ctx.saveOperationalOrder();
  ok("C5d", h3.calls.length === 2 && h3.calls[1].payload.requestKey !==
    h3.calls[0].payload.requestKey && h3.calls[1].payload.lines.length === 2,
    JSON.stringify(h3.calls[1].payload));

  // C6: Correct/Void cohort routing. V2 -> U6 entrypoints only; legacy detail
  // -> legacy handlers only (spied), never cross-routed.
  var h4 = u7ControllerHarness_();
  primeAuthority(h4);
  var legacyCorrectCalls = 0, legacyVoidCalls = 0;
  h4.ctx.openTransactionCorrection = function(detail) { legacyCorrectCalls++; };
  h4.ctx.renderTransactionVoidConfirmation = function(detail) { legacyVoidCalls++; };
  h4.ctx.transactionDetailCache["ORDER:ORD-U7-CV"] = {
    id: "ORDER:ORD-U7-CV", orderId: "ORD-U7-CV", transactionType: "Sales",
    salesCohort: "V2_COMMITTED", orderType: "DINE_IN", canCorrect: false,
    canVoid: false, lines: [{ lineId: "l1", productId: "P1", productVariantID: "PV1",
      qty: 1, unitPrice: 20000, lineAmount: 20000 }] };
  h4.ctx.loadTransactionForMutation("ORDER:ORD-U7-CV", "correct");
  ok("C6a", legacyCorrectCalls === 0 &&
    h4.ctx.document.getElementById("title").innerText === "Correct Sale",
    h4.ctx.document.getElementById("title").innerText);
  h4.ctx.document.getElementById("salesV2MutationReason").value = "u7 correct reason";
  // The stub DOM does not parse innerHTML; prefill the qty input the real
  // dialog renders from value= attributes.
  h4.ctx.document.getElementById("salesV2LineQty0").value = "1";
  h4.ctx.submitSalesV2Mutation();
  ok("C6b", h4.calls.length === 1 && h4.calls[0].method === "salesRecognitionV2DurableCorrect" &&
    h4.calls[0].payload.orderID === "ORD-U7-CV" &&
    h4.calls[0].payload.reason === "u7 correct reason" &&
    h4.calls[0].payload.orderType === "DINE_IN" &&
    h4.calls[0].payload.lines[0].productVariantID === "PV1",
    JSON.stringify(h4.calls[0] && h4.calls[0].payload));
  var correctKey = h4.calls[0].payload.requestKey;
  h4.driveSuccess({ status: "DONE", requestKey: correctKey, orderID: "ORD-U7-REP" });
  ok("C6c", h4.ctx.document.getElementById("content").innerHTML.indexOf("Sale corrected") !== -1 &&
    h4.ctx.salesV2MutationState.requestKey === "");
  h4.ctx.transactionDetailCache["ORDER:ORD-U7-CV2"] = {
    id: "ORDER:ORD-U7-CV2", orderId: "ORD-U7-CV2", transactionType: "Sales",
    salesCohort: "V2_COMMITTED", orderType: "TAKE_AWAY", lines: [] };
  h4.ctx.loadTransactionForMutation("ORDER:ORD-U7-CV2", "void");
  h4.ctx.document.getElementById("salesV2MutationReason").value = "u7 void reason";
  h4.ctx.submitSalesV2Mutation();
  ok("C6d", h4.calls.length === 2 && h4.calls[1].method === "salesRecognitionV2DurableVoid" &&
    h4.calls[1].payload.reason === "u7 void reason" &&
    h4.calls[1].payload.orderID === "ORD-U7-CV2");
  var voidKey = h4.calls[1].payload.requestKey;
  h4.driveFailure(new Error("RPC_TIMEOUT"));
  ok("C6e", h4.ctx.salesV2MutationState.requestKey === voidKey &&
    h4.ctx.salesV2MutationState.mode === "void" &&
    h4.ctx.document.getElementById("state").innerText.indexOf("jangan membuat transaksi baru") !== -1,
    h4.ctx.document.getElementById("state").innerText);
  // Same identity is rechecked through the V2 operation type, never legacy.
  h4.ctx.reconcileSalesV2Mutation();
  ok("C6f", h4.calls.length === 3 && h4.calls[2].method === "findOperationalOperation" &&
    h4.calls[2].payload.operationType === "SALES_V2_VOID" &&
    h4.calls[2].payload.requestKey === voidKey);
  h4.driveSuccess({ success: true, data: { operation: { State: "IN_PROGRESS", RequestKey: voidKey } } });
  ok("C6g", h4.ctx.salesV2MutationState.requestKey === voidKey &&
    h4.ctx.document.getElementById("footer").innerHTML.indexOf("Check Status") !== -1);
  h4.ctx.reconcileSalesV2Mutation();
  h4.driveSuccess({ success: true, data: { operation: { State: "COMMITTED", RequestKey: voidKey,
      BusinessID: "ORD-U7-CV2" } } });
  ok("C6h", h4.ctx.document.getElementById("content").innerHTML.indexOf("Sale voided") !== -1 &&
    h4.ctx.salesV2MutationState.requestKey === "");
  // Legacy identities stay on the legacy handlers.
  h4.ctx.transactionDetailCache["SAL-APP-U7-1"] = {
    id: "SAL-APP-U7-1", transactionType: "Sales", canCorrect: true, canVoid: true,
    salesCohort: "TABSAL_LEGACY" };
  h4.ctx.loadTransactionForMutation("SAL-APP-U7-1", "correct");
  ok("C6i", legacyCorrectCalls === 1 && legacyVoidCalls === 0 &&
    h4.calls.length === 4, String(h4.calls.length));
  h4.ctx.loadTransactionForMutation("SAL-APP-U7-1", "void");
  ok("C6j", legacyVoidCalls === 1 && h4.calls.length === 4 &&
    h4.calls.every(function(c) { return c.method.indexOf("CanonicalTransaction") === -1; }),
    JSON.stringify(h4.calls.map(function(c) { return c.method; })));

  // C7: definite PAUSED refusal is definite (identity released, no fallback
  // call), while UNKNOWN never becomes Done.
  var h5 = u7ControllerHarness_();
  primeAuthority(h5);
  h5.ctx.operationalTransactionState.lines = [{ productID: "P1", productVariantID: "PV1",
    qty: 1, name: "Coffee · Hot", price: 20000 }];
  h5.ctx.document.getElementById("operationalOrderType").value = "DINE_IN";
  h5.ctx.saveOperationalOrder();
  h5.driveSuccess({ success: false, error: { code: "V2_MODE_PAUSED",
    message: "New sales are paused." } });
  ok("C7a", h5.ctx.operationalTransactionState.pending === null &&
    h5.ctx.document.getElementById("operationalOrderError").innerText === "New sales are paused." &&
    h5.calls.length === 1, JSON.stringify(h5.calls));

  // C8: unknown V2 save response is classified as UNKNOWN (kept identity),
  // never as Done and never as a definite failure.
  var h6 = u7ControllerHarness_();
  primeAuthority(h6);
  h6.ctx.operationalTransactionState.lines = [{ productID: "P1", productVariantID: "PV1",
    qty: 1, name: "Coffee · Hot", price: 20000 }];
  h6.ctx.document.getElementById("operationalOrderType").value = "DINE_IN";
  h6.ctx.saveOperationalOrder();
  var key6 = h6.calls[0].payload.requestKey;
  h6.driveSuccess({ success: false, unknown: true, requestKey: key6,
    error: { code: "BATCH_OUTCOME_UNKNOWN", message: "outcome pending" } });
  ok("C8a", h6.ctx.operationalTransactionState.pending !== null &&
    h6.ctx.operationalTransactionState.pending.requestKey === key6 &&
    h6.ctx.operationalTransactionState.pending.state === "RECONCILING" &&
    h6.ctx.operationalTransactionState.order === null &&
    h6.calls.length === 2 && h6.calls[1].method === "findOperationalOperation" &&
    h6.calls[1].payload.requestKey === key6,
    JSON.stringify({ pending: h6.ctx.operationalTransactionState.pending,
      calls: h6.calls.map(function(c) { return c.method; }) }));

  checks.failed = checks.total - checks.passed;
  return { status: checks.failed === 0 ? "CONTROLLER_PASS" : "CONTROLLER_FAIL",
    total: checks.total, passed: checks.passed, failed: checks.failed,
    ids: checks.ids };
}

module.exports = runSalesV2U7Controller;
