// SALES_RECOGNITION_V2 U10C ACTIVE operator surface (Node-only; executed via
// `_test_runner.js`). Loads the REAL transaction-entry dialog markup from
// `190.View.Index.html` into an id-resolved DOM registry and runs the real
// `195` controller + `194` forms in that composition, so the checks cover the
// shipped HTML/controller wiring — not source substrings alone.
//
// UI-A1..A14 acceptance: ACTIVE renders the V2 Sales surface only, one normal
// Save control routing to the U7 durable V2 route, PREPARED keeps the
// legacy-compatible surface, PAUSED and config-read failure fail closed with no
// operable legacy fallback. No production contact, no network, no clasp.
var fs = require("fs");
var vm = require("vm");

var INDEX_PATH = "190.View.Index.html";
var FORMS_PATH = "194.View.Transactions.Forms.html";
var ACTIONS_PATH = "195.View.Transactions.Actions.html";
var PRODUCTION_PATH = "95A.Transaction.Production.js";
var GUARD_PATH = "97D.SalesRecognition.V2.OperatorGuard.js";

// property -> element id, mirroring 190's `elements.transactionEntry` map.
var ENTRY_ELEMENT_IDS = {
  overlay: "transactionEntryOverlay", dialog: "transactionEntryDialog",
  closeButton: "closeTransactionEntryButton", optionsState: "transactionEntryOptionsState",
  salesOptionsStatus: "salesEntryOptionsStatus", expenseOptionsStatus: "expenseEntryOptionsStatus",
  form: "transactionEntryForm", salesFields: "salesEntryFields", expenseFields: "expenseEntryFields",
  typeSales: "transactionTypeSales", typeExpense: "transactionTypeExpense",
  productSearch: "productEntrySearch", productListbox: "productEntryListbox",
  productMeta: "productEntryMeta", productError: "productEntryError",
  expenseSearch: "expenseEntrySearch", expenseListbox: "expenseEntryListbox",
  expenseMeta: "expenseEntryMeta", expenseError: "expenseEntryError",
  typeHot: "salesTypeHot", typeCold: "salesTypeCold", salesTypeError: "salesTypeError",
  qty: "salesEntryQty", qtyError: "salesEntryQtyError", pricingPreview: "salesPricingPreview",
  pricingState: "salesPricingState", previewPrice: "salesPreviewPrice", previewHpp: "salesPreviewHpp",
  previewUnitMargin: "salesPreviewUnitMargin", previewQty: "salesPreviewQty",
  previewRevenue: "salesPreviewRevenue", previewCogs: "salesPreviewCogs",
  previewMargin: "salesPreviewMargin", amount: "expenseEntryAmount",
  amountError: "expenseEntryAmountError", submitRegion: "transactionEntrySubmitRegion",
  generalError: "transactionEntryGeneralError", submit: "submitTransactionEntryButton",
  submitLabel: "transactionEntrySubmitLabel", success: "transactionEntrySuccess",
  successDetails: "transactionEntrySuccessDetails", title: "transactionEntryTitle",
  description: "transactionEntryDescription", typeFieldset: "transactionTypeFieldset",
  correctionWorkspace: "transactionCorrectionWorkspace",
  correctionReasonRegion: "transactionCorrectionReasonRegion",
  correctionReason: "transactionCorrectionReason",
  correctionReasonError: "transactionCorrectionReasonError",
  correctionReview: "transactionCorrectionReview",
  correctionComparison: "transactionCorrectionComparison"
};

var RECEIPT_ELEMENT_IDS = {
  fields: "receiptEntryFields", controls: "receiptEntryControls", costType: "expenseCostType",
  expenseDate: "expenseDate", expenseDateError: "expenseDateError",
  policyFields: "expensePolicyFields", status: "receiptChoicesState",
  recovery: "receiptRecovery", retry: "receiptRetry"
};

function makeElement_(id, tagName, attrs, flat)
{
  attrs = attrs || "";
  var element = {
    id: id, tagName: tagName || "div", attributes: {}, dataset: {}, style: {},
    innerText: "", innerHTML: "", textContent: "", value: "", checked: false,
    hidden: /(?:^|\s)hidden(?:\s|=|>|$)/.test(attrs),
    disabled: /(?:^|\s)disabled(?:\s|=|>|$)/.test(attrs),
    setAttribute: function(key, value) { this.attributes[key] = String(value); },
    getAttribute: function(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    removeAttribute: function(key) { delete this.attributes[key]; },
    appendChild: function(child) { this.children = this.children || []; this.children.push(child); return child; },
    removeChild: function(child) {
      this.children = this.children || [];
      var at = this.children.indexOf(child);
      if (at !== -1) this.children.splice(at, 1);
      return child;
    },
    focus: function() {}, blur: function() {}, click: function() {}, scrollIntoView: function() {},
    addEventListener: function() {}, removeEventListener: function() {},
    querySelector: function(selector) {
      this.resolved = this.resolved || {};
      if (!this.resolved[selector]) this.resolved[selector] = makeElement_(id + ">" + selector, "div", "");
      return this.resolved[selector];
    },
    querySelectorAll: function() { return []; },
    reset: function() {},
    classList: { add: function() {}, remove: function() {}, toggle: function() {}, contains: function() { return false; } },
    _children: null
  };
  if (!flat) {
    var level1 = makeElement_(id + "^parent", "div", "", true);
    var level2 = makeElement_(id + "^parent^parent", "div", "", true);
    level1.parentElement = level2;
    element.parentElement = level1;
  }
  var valueMatch = /\svalue="([^"]*)"/.exec(attrs);
  if (valueMatch) element.value = valueMatch[1];
  var typeMatch = /\stype="([^"]*)"/.exec(attrs);
  if (typeMatch) element.type = typeMatch[1];
  return element;
}

// Build the entry-dialog element registry from the shipped 190 markup.
function parseEntryElements_(indexSource)
{
  var start = indexSource.indexOf('<div id="transactionEntryOverlay"');
  var end = indexSource.indexOf('<div id="transactionLifecycleOverlay"');
  if (start === -1 || end === -1 || end < start) throw new Error("U10C_DIALOG_NOT_FOUND");
  var markup = indexSource.slice(start, end);
  var elements = Object.create(null);
  var tagPattern = /<([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  var match;
  while ((match = tagPattern.exec(markup))) {
    var idMatch = /\bid="([^"]+)"/.exec(match[2]);
    if (!idMatch) continue;
    elements[idMatch[1]] = makeElement_(idMatch[1], match[1].toLowerCase(), match[2]);
  }
  return { markup: markup, elements: elements };
}

function baseAuthority_()
{
  return {
    products: [{ ProductID: "P1", Name: "Coffee", IsActive: true }],
    productVariants: [{ ProductVariantID: "PV1", ProductID: "P1", Tipe: "HOT", SellingPrice: 20000 }],
    suppliers: [], purchaseItems: [], expenseItems: [], items: [], conversions: [],
    paymentMethods: []
  };
}

function committedOrder_(requestKeySuffix)
{
  return {
    success: true, requestKey: "order-u10c-" + requestKeySuffix,
    data: {
      OrderID: "ORD-U10C-" + requestKeySuffix, OrderNumber: "ORD-U10C-" + requestKeySuffix,
      OrderType: "DINE_IN", OrderTotal: 20000, PaymentStatus: "UNPAID",
      FulfillmentStatus: "OPEN", salesCohort: "V2_COMMITTED", recognitionStatus: "RECOGNIZED",
      Lines: [{ OrderLineID: "OL-U10C", ProductID: "P1", ProductVariantID: "PV1",
        Tipe: "HOT", Qty: 1, SellingPriceSnapshot: 20000 }]
    }
  };
}

function operatorSurfaceHarness_()
{
  var index = fs.readFileSync(INDEX_PATH, "utf8");
  var parsed = parseEntryElements_(index);
  var elements = parsed.elements;
  var calls = [];
  var responders = {};
  var handlers = { success: null, failure: null };
  var googleRun = new Proxy({}, {
    get: function(target, property) {
      if (property === "withSuccessHandler") {
        return function(fn) { handlers.success = fn; return googleRun; };
      }
      if (property === "withFailureHandler") {
        return function(fn) { handlers.failure = fn; return googleRun; };
      }
      return function(payload) {
        var method = String(property);
        calls.push({ method: method, payload: payload });
        var success = handlers.success, failure = handlers.failure;
        handlers.success = null; handlers.failure = null;
        var responder = responders[method];
        if (!responder) throw new Error("U10C_NO_RESPONDER:" + method);
        var outcome = responder(payload, calls.length);
        if (outcome && outcome.__failure) { if (failure) failure(outcome.__failure); return; }
        if (success) success(outcome);
      };
    }
  });

  var storageMap = Object.create(null);
  function storage() {
    return {
      getItem: function(key) { return Object.prototype.hasOwnProperty.call(storageMap, key) ? storageMap[key] : null; },
      setItem: function(key, value) { storageMap[key] = String(value); },
      removeItem: function(key) { delete storageMap[key]; }
    };
  }

  function elementFor(id) {
    if (!elements[id]) elements[id] = makeElement_(id, "div", "");
    return elements[id];
  }

  var receiptEntry = { expenseDateError: elementFor("expenseDateError") };
  Object.keys(RECEIPT_ELEMENT_IDS).forEach(function(key) {
    receiptEntry[key] = elementFor(RECEIPT_ELEMENT_IDS[key]);
  });
  ["Date", "Qty", "Uom", "Cost", "Supplier", "Reference", "Unavailable", "Attested", "CashAccount"].forEach(function(key) {
    receiptEntry[key] = elementFor("receipt" + key);
    receiptEntry[key + "Error"] = elementFor("receipt" + key + "Error");
  });

  var transactionEntry = {};
  Object.keys(ENTRY_ELEMENT_IDS).forEach(function(key) {
    transactionEntry[key] = elementFor(ENTRY_ELEMENT_IDS[key]);
  });

  var elements_ = {
    appShell: { inert: false },
    transactionEntry: transactionEntry,
    receiptEntry: receiptEntry,
    lifecycle: { state: elementFor("lifecycleState"), content: elementFor("lifecycleContent"),
      footer: elementFor("lifecycleFooter"), title: elementFor("lifecycleTitle") }
  };

  var ctx = {
    console: { log: function() {}, error: function() {}, warn: function() {} },
    localStorage: storage(),
    sessionStorage: storage(),
    performance: { now: function() { return 0; } },
    document: {
      getElementById: function(id) { return elementFor(id); },
      createElement: function(tag) { return makeElement_(String(tag), String(tag), ""); },
      body: { appendChild: function() {}, removeChild: function() {},
        classList: { add: function() {}, remove: function() {} } },
      addEventListener: function() {}
    },
    google: { script: { run: googleRun } },
    transactionEntryState: null,
    createInitialTransactionEntryState: null,
    transactionDetailCache: {}, transactionDetailPending: {}, transactionDetailSources: {},
    transactionLifecycleRequestSequence: 0,
    transactionLifecycleState: { detail: null, mode: "detail", trigger: null, submitting: false },
    transactionDiagnosticPending: {},
    transactionDiagnostics: { newTransaction: { eventCount: 0 },
      actions: { viewEventCount: 0, correctEventCount: 0, voidEventCount: 0 } },
    transactionEntryLastFocus: null,
    transactionEntryOptionsDiagnosticSource: "master-cache",
    lastDashboardRequest: null, dashboardRequestSequence: 0, activeDashboardRequestToken: 0,
    dashboardRequestInFlight: false,
    initializeStableDashboardElements: function() { return elements_; },
    escapeUiHtml: function(value) { return String(value === undefined || value === null ? "" : value); },
    formatTransactionDate: function(value) { return String(value || ""); },
    invalidateTransactionsClientCaches: function() {},
    completeTransactionActionDiagnostic: function() {},
    completeTransactionEntryDiagnostic: function() {},
    invalidateFinanceCache: function() {},
    requestDashboardData: function() {},
    refreshTransactionsAfterPurchaseMutation: function() {},
    refreshTransactionEntryAfterSuccess: function() {},
    openTransactionDetail: function() {},
    transactionDetailIdentity: function(id) { return id ? String(id) : ""; },
    openPurchaseVoidDialog: function() {},
    openPurchaseCorrectDialog: function() {},
    openPurchaseResolveDialog: function() {},
    checkPendingPurchaseRecovery: function() { return null; },
    formatSignedCurrency: function() { return ""; }
  };

  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ACTIONS_PATH, "utf8"), ctx, { filename: ACTIONS_PATH });
  vm.runInContext(fs.readFileSync(FORMS_PATH, "utf8"), ctx, { filename: FORMS_PATH });

  // Composition guard: every id the controllers need must exist in the shipped
  // 190 dialog markup.
  Object.keys(ENTRY_ELEMENT_IDS).forEach(function(key) {
    if (!parsed.elements[ENTRY_ELEMENT_IDS[key]]) {
      throw new Error("U10C_MISSING_DIALOG_ELEMENT:" + ENTRY_ELEMENT_IDS[key]);
    }
  });

  ctx.transactionEntryState = ctx.createInitialTransactionEntryState();
  return {
    ctx: ctx, elements: elements, elements_: elements_, calls: calls,
    responders: responders, markup: parsed.markup, storage: storageMap,
    el: function(id) { return elementFor(id); },
    failed: function(error) { return { __failure: error }; }
  };
}

function configureMode_(harness, mode)
{
  harness.responders.getOperationalTransactionAuthority = function() {
    if (mode === null) return harness.failed(new Error("RPC_FAILURE"));
    var data = baseAuthority_();
    if (mode !== undefined) data.salesV2Mode = mode;
    return { success: true, data: data };
  };
  harness.ctx.loadOperationalTransactionAuthority();
}

function selectSalesDraft_(harness)
{
  var ctx = harness.ctx;
  ctx.setTransactionEntryType("SALES");
  ctx.transactionEntryState.optionsLoaded = true;
  ctx.transactionEntryState.entryOptions = {
    sales: [{ productId: "P1", product: "Coffee", category: "Drink", kind: "Menu",
      pricing: { Hot: { price: 20000, hpp: 8000, unitMargin: 12000 } } }],
    expenses: []
  };
  ctx.selectTransactionEntryOption("product", ctx.transactionEntryState.entryOptions.sales[0]);
  ctx.setSalesEntryType("Hot");
  harness.el("salesEntryQty").value = "1";
  ctx.updateSalesEntryQty();
}

// Server calls excluding the authority bootstrap used to resolve the mode.
function saveCalls_(harness)
{
  return harness.calls.filter(function(call) {
    return call.method !== "getOperationalTransactionAuthority";
  });
}

function u10cAssert(checks, id, value, detail) {
  if (!value) throw new Error("SALES_V2_U10C_OPERATOR_SURFACE:" + id +
    (detail === undefined ? "" : "|" + detail));
  checks.passed++;
}

function runSalesV2U10COperatorSurface() {
  var checks = { total: 0, passed: 0, failed: 0, ids: [] };
  function ok(id, value, detail) {
    checks.total++;
    u10cAssert(checks, id, value, detail);
    checks.ids.push(id);
  }

  var indexSource = fs.readFileSync(INDEX_PATH, "utf8");
  var formsSource = fs.readFileSync(FORMS_PATH, "utf8");
  var actionsSource = fs.readFileSync(ACTIONS_PATH, "utf8");
  var productionSource = fs.readFileSync(PRODUCTION_PATH, "utf8");
  var guardSource = fs.readFileSync(GUARD_PATH, "utf8");

  // A1 ACTIVE render: legacy normal-order controls hidden; V2 input surface up.
  var hA1 = operatorSurfaceHarness_();
  configureMode_(hA1, "ACTIVE");
  hA1.ctx.setTransactionEntryType("SALES");
  ok("A1-1", hA1.el("operationalOrderFields").hidden === false &&
    hA1.el("salesEntryFields").hidden === false, "V2 input surface visible");
  ok("A1-2", hA1.el("operationalOrderHeading").hidden === true &&
    hA1.el("operationalSaveOrder").hidden === true &&
    hA1.el("operationalOrderLookupControl").hidden === true &&
    hA1.el("operationalOpenOrders").hidden === true, "legacy order controls hidden");
  ok("A1-3", hA1.el("operationalPaymentFields").hidden === true &&
    hA1.el("operationalFulfillmentFields").hidden === true, "payment/fulfillment hidden");
  ok("A1-4", hA1.el("operationalOrderType").tagName === "select" &&
    hA1.el("operationalOrderLines") && hA1.el("operationalOrderTotal"), "Order Type/lines/total present");

  // A2 ACTIVE input: OrderType + ProductVariant + qty produce a committed draft
  // line carrying the authoritative ProductVariantID.
  selectSalesDraft_(hA1);
  hA1.el("operationalOrderType").value = "DINE_IN";
  hA1.ctx.addSelectedSalesOrderLine();
  var linesA2 = hA1.ctx.operationalTransactionState.lines;
  ok("A2-1", linesA2.length === 1 && linesA2[0].productID === "P1" &&
    linesA2[0].productVariantID === "PV1" && linesA2[0].qty === 1, JSON.stringify(linesA2));

  // A3/A4 Add Line enables the draft; Save is disabled before it and enabled
  // after a valid state.
  var hA4 = operatorSurfaceHarness_();
  configureMode_(hA4, "ACTIVE");
  hA4.ctx.setTransactionEntryType("SALES");
  hA4.ctx.updateTransactionEntrySubmitState();
  ok("A4-1", hA4.el("submitTransactionEntryButton").disabled === true, "no line yet");
  selectSalesDraft_(hA4);
  hA4.el("operationalOrderType").value = "DINE_IN";
  ok("A4-2", hA4.el("submitTransactionEntryButton").disabled === true, "selected but not committed");
  hA4.ctx.addSelectedSalesOrderLine();
  ok("A3-1", hA4.ctx.operationalTransactionState.lines.length === 1);
  ok("A4-3", hA4.el("submitTransactionEntryButton").disabled === false, "valid state enables Save");

  // A5 multiline: the first line is retained when a second line is added.
  hA4.ctx.transactionEntryState.selectedProduct = { productId: "P1", product: "Coffee",
    pricing: { Hot: { price: 20000, hpp: 8000, unitMargin: 12000 } } };
  hA4.ctx.transactionEntryState.selectedType = "Hot";
  hA4.ctx.transactionEntryState.pricing = { price: 20000 };
  hA4.ctx.transactionEntryState.qty = 2;
  hA4.ctx.addSelectedSalesOrderLine();
  ok("A5-1", hA4.ctx.operationalTransactionState.lines.length === 2 &&
    hA4.ctx.operationalTransactionState.lines[0].qty === 1 &&
    hA4.ctx.operationalTransactionState.lines[1].qty === 2,
    JSON.stringify(hA4.ctx.operationalTransactionState.lines));
  ok("A5-2", hA4.el("operationalOrderTotal").textContent ===
    "Total: " + hA4.ctx.formatEntryCurrency(60000),
    hA4.el("operationalOrderTotal").textContent);

  // A6 + A9 one Save -> U7 V2 route with one stable RequestKey; a duplicate
  // click never dispatches a second intent.
  var hA6 = operatorSurfaceHarness_();
  configureMode_(hA6, "ACTIVE");
  selectSalesDraft_(hA6);
  hA6.el("operationalOrderType").value = "DINE_IN";
  hA6.ctx.addSelectedSalesOrderLine();
  hA6.responders.submitOperationalOrder = function(payload) { return committedOrder_(String(payload.requestKey)); };
  var noopEvent = { preventDefault: function() {} };
  hA6.ctx.submitTransactionEntry(noopEvent);
  var a6Calls = saveCalls_(hA6);
  ok("A6-1", a6Calls.length === 1 && a6Calls[0].method === "submitOperationalOrder" &&
    a6Calls[0].payload.requestKey && a6Calls[0].payload.lines.length === 1 &&
    a6Calls[0].payload.orderType === "DINE_IN",
    JSON.stringify(a6Calls.map(function(c) { return c.method; })));
  ok("A6-2", !Object.prototype.hasOwnProperty.call(a6Calls[0].payload, "orderTotal") &&
    !Object.prototype.hasOwnProperty.call(a6Calls[0].payload, "price"), "no client price authority");
  hA6.ctx.submitTransactionEntry(noopEvent);
  hA6.ctx.submitTransactionEntry(noopEvent);
  ok("A9-1", saveCalls_(hA6).length === 1, String(saveCalls_(hA6).length));

  // A7 COMMITTED -> Done; no legacy continuation.
  ok("A7-1", hA6.ctx.transactionEntryState.submissionComplete === true &&
    hA6.ctx.operationalTransactionState.pending === null, "confirmed commit");
  ok("A7-2", hA6.el("transactionEntrySuccess").hidden === false &&
    hA6.el("transactionEntryForm").hidden === true &&
    hA6.el("transactionEntrySubmitRegion").hidden === true, "success surface");
  var doneMarkup = hA6.el("transactionEntrySuccess").querySelector(".transaction-entry-success-actions").innerHTML;
  ok("A7-3", doneMarkup.indexOf("Done") !== -1 && doneMarkup.indexOf("closeTransactionEntry()") !== -1, doneMarkup);
  ok("A7-4", hA6.ctx.operationalTransactionState.lines.length === 0, "draft cleared after commit");
  ok("A7-5", hA6.el("operationalOrderStatus").textContent.indexOf("Recognized") !== -1 &&
    hA6.el("operationalPaymentFields").hidden === true &&
    hA6.el("operationalFulfillmentFields").hidden === true, "recognition status only");
  ok("A7-6", hA6.calls.every(function(c) {
    return c.method !== "submitOperationalPayment" && c.method !== "submitOperationalFulfillment" &&
      c.method !== "submitCanonicalTransaction";
  }), JSON.stringify(hA6.calls.map(function(c) { return c.method; })));

  // A8 UNKNOWN: no Done, the RequestKey is retained, recovery reuses identity.
  var hA8 = operatorSurfaceHarness_();
  configureMode_(hA8, "ACTIVE");
  selectSalesDraft_(hA8);
  hA8.el("operationalOrderType").value = "DINE_IN";
  hA8.ctx.addSelectedSalesOrderLine();
  hA8.responders.submitOperationalOrder = function() { return hA8.failed(new Error("RPC_TIMEOUT")); };
  hA8.responders.findOperationalOperation = function() {
    return { success: true, data: { operation: { State: "IN_PROGRESS", RequestKey: "x" } } };
  };
  hA8.ctx.submitTransactionEntry({ preventDefault: function() {} });
  var pendingA8 = hA8.ctx.operationalTransactionState.pending;
  var a8Calls = saveCalls_(hA8);
  ok("A8-1", Boolean(pendingA8) && pendingA8.requestKey === a8Calls[0].payload.requestKey &&
    pendingA8.state === "UNKNOWN", JSON.stringify(pendingA8));
  ok("A8-2", hA8.ctx.transactionEntryState.submissionComplete !== true &&
    hA8.el("transactionEntrySuccess").hidden === true, "no Done on UNKNOWN");
  ok("A8-3", a8Calls.length === 2 && a8Calls[1].method === "findOperationalOperation" &&
    a8Calls[1].payload.requestKey === pendingA8.requestKey,
    JSON.stringify(a8Calls.map(function(c) { return c.method; })));
  hA8.responders.submitOperationalOrder = function(payload) {
    return committedOrder_(String(payload.requestKey));
  };
  hA8.ctx.submitTransactionEntry({ preventDefault: function() {} });
  var a8Retry = saveCalls_(hA8);
  ok("A8-4", a8Retry.length === 3 && a8Retry[2].method === "submitOperationalOrder" &&
    a8Retry[2].payload.requestKey === pendingA8.requestKey, "retry reuses identity");

  // A10 legacy controls are not actionable in ACTIVE (hidden + disabled).
  ok("A10-1", hA6.el("operationalSaveOrder").hidden === true &&
    hA6.el("operationalSaveOrder").disabled === true, "Save Order not actionable");
  ok("A10-2", hA6.el("operationalOrderLookupControl").hidden === true &&
    hA6.el("operationalOpenOrders").hidden === true &&
    hA6.el("operationalOrderHeading").hidden === true, "no Find Order / open-order requirement");
  ok("A10-3", hA6.markup.indexOf("id=\"operationalSaveOrder\"") !== -1 &&
    hA6.markup.indexOf("onclick=\"saveOperationalOrder()\"") !== -1,
    "legacy control still exists for PREPARED servicing");

  // A11 payment/fulfillment are never shown or actionable in ACTIVE.
  ok("A11-1", hA6.el("operationalPaymentFields").hidden === true &&
    hA6.el("operationalFulfillmentFields").hidden === true &&
    hA6.el("operationalFulfillmentNext").hidden === true, "hidden after commit");
  ok("A11-2", hA6.el("operationalReceiveVia") && hA6.el("operationalConfirmPayment") &&
    hA6.markup.indexOf("Receive Via") !== -1 && hA6.el("operationalPaymentFields").hidden,
    "payment controls exist only behind a hidden section");

  // A12 PREPARED legacy-compatible surface preserved.
  var hA12 = operatorSurfaceHarness_();
  configureMode_(hA12, "PREPARED");
  hA12.responders.listOpenOperationalOrders = function() { return { success: true, data: [] }; };
  hA12.ctx.setTransactionEntryType("SALES");
  ok("A12-1", hA12.el("operationalOrderHeading").hidden === false &&
    hA12.el("operationalSaveOrder").hidden === false &&
    hA12.el("operationalSaveOrder").disabled === false &&
    hA12.el("operationalOrderLookupControl").hidden === false, "legacy controls preserved");
  ok("A12-2", hA12.el("operationalOpenOrders").textContent === "No open orders.",
    hA12.el("operationalOpenOrders").textContent);
  ok("A12-3", hA12.el("submitTransactionEntryButton").disabled === true,
    "Save Transaction stays legacy-disabled for Sales");
  hA12.ctx.showOperationalOrder({ OrderID: "ORD-PRE-1", OrderNumber: "ORD-PRE-1",
    OrderType: "DINE_IN", OrderTotal: 20000, PaymentStatus: "UNPAID",
    FulfillmentStatus: "OPEN", Lines: [] });
  ok("A12-4", hA12.el("operationalPaymentFields").hidden === false &&
    hA12.el("operationalFulfillmentFields").hidden === false &&
    hA12.el("operationalOrderStatus").textContent.indexOf("UNPAID") !== -1,
    hA12.el("operationalOrderStatus").textContent);
  ok("A12-5", hA12.calls.some(function(c) { return c.method === "listOpenOperationalOrders"; }));

  // A13 PAUSED refuses new Sales with no operable fallback.
  var hA13 = operatorSurfaceHarness_();
  configureMode_(hA13, "PAUSED");
  hA13.responders.submitOperationalOrder = function() {
    throw new Error("U10C_PAUSED_MUST_NOT_DISPATCH");
  };
  selectSalesDraft_(hA13);
  hA13.el("operationalOrderType").value = "DINE_IN";
  hA13.ctx.addSelectedSalesOrderLine();
  ok("A13-1", hA13.el("operationalOrderError").innerText === "New sales are paused.",
    hA13.el("operationalOrderError").innerText);
  ok("A13-2", hA13.el("operationalSaveOrder").hidden === true &&
    hA13.el("operationalSaveOrder").disabled === true, "no legacy fallback");
  ok("A13-3", hA13.el("submitTransactionEntryButton").disabled === true, "no V2 save");
  var callsBeforeA13 = hA13.calls.length;
  hA13.ctx.submitTransactionEntry({ preventDefault: function() {} });
  ok("A13-4", hA13.calls.length === callsBeforeA13, JSON.stringify(hA13.calls.slice(callsBeforeA13)));

  // A14 config read failure -> fail closed for new Sales.
  var hA14 = operatorSurfaceHarness_();
  configureMode_(hA14, null);
  hA14.responders.submitOperationalOrder = function() {
    throw new Error("U10C_UNRESOLVED_MUST_NOT_DISPATCH");
  };
  hA14.ctx.setTransactionEntryType("SALES");
  hA14.ctx.updateTransactionEntrySubmitState();
  ok("A14-1", hA14.el("operationalOrderError").innerText ===
    "Sales configuration is unavailable. New sales are disabled.",
    hA14.el("operationalOrderError").innerText);
  ok("A14-2", hA14.el("submitTransactionEntryButton").disabled === true &&
    hA14.el("operationalSaveOrder").hidden === true &&
    hA14.el("operationalSaveOrder").disabled === true, "fail closed");
  var callsBeforeA14 = hA14.calls.length;
  hA14.ctx.submitTransactionEntry({ preventDefault: function() {} });
  ok("A14-3", hA14.calls.length === callsBeforeA14, JSON.stringify(hA14.calls.slice(callsBeforeA14)));

  // Source audit (18 items): every item maps to a concrete source check.
  var submitRegion = actionsSource.slice(actionsSource.indexOf("function submitTransactionEntry(event)"),
    actionsSource.indexOf("function previewTransactionCorrection(payload)"));
  var saveRegion = actionsSource.slice(actionsSource.indexOf("function saveOperationalOrder()"),
    actionsSource.indexOf("function salesV2OperatorVisibleOrder_"));
  var successRegion = actionsSource.slice(actionsSource.indexOf("function completeSalesV2OperatorSave_"),
    actionsSource.indexOf("function filterOperationalPurchaseUoms"));
  ok("AUD-1", actionsSource.indexOf("response.data.salesV2Mode") !== -1 &&
    [indexSource, formsSource, actionsSource].every(function(source) {
      return source.indexOf("SALES_RECOGNITION_V2_CONFIG") === -1 &&
        source.indexOf("salesV2OperatorResolvedRoute_") === -1 &&
        source.indexOf("activationID") === -1;
    }) && productionSource.indexOf("dto.salesV2Mode = salesV2OperatorResolvedRoute_().mode") !== -1);
  ok("AUD-2", formsSource.indexOf('operationalOrderFields").hidden = type !== "SALES"') !== -1 &&
    actionsSource.indexOf('salesV2ClientSurface_() === "PREPARED"') !== -1 &&
    actionsSource.indexOf("function saveOperationalOrder()") !== -1);
  ok("AUD-3", actionsSource.indexOf('if (state.mode !== "correction" && state.transactionType === "SALES")') !== -1 &&
    submitRegion.indexOf("if (!salesV2ActiveSurface_()) return;") !== -1 &&
    productionSource.indexOf('if (route.mode !== "PREPARED") return salesV2OperatorModeCreateOrder_(payload, route)') !== -1 &&
    guardSource.indexOf('if (route.mode !== "ACTIVE") {') !== -1 &&
    guardSource.indexOf("var result = salesRecognitionV2DurableSave(payload);") !== -1);
  ok("AUD-4", actionsSource.indexOf('element.hidden = sales ? !prepared : true') !== -1 &&
    actionsSource.indexOf("element.disabled = sales ? (!prepared || inFlight) : true") !== -1);
  ok("AUD-5", (indexSource.match(/id="submitTransactionEntryButton"/g) || []).length === 1 &&
    actionsSource.indexOf('element.hidden = sales ? !prepared : true') !== -1);
  ok("AUD-6", actionsSource.indexOf("if (!lines.length) return false;") !== -1 &&
    actionsSource.indexOf("if (!line || !line.productID || !line.productVariantID) return false;") !== -1);
  ok("AUD-7", actionsSource.indexOf("productVariantID: variant.ProductVariantID") !== -1 &&
    actionsSource.indexOf("line.productVariantID") !== -1);
  ok("AUD-8", actionsSource.indexOf("operationalTransactionState.lines.push") !== -1);
  ok("AUD-9", saveRegion.indexOf("requestKey: pending.requestKey") !== -1 &&
    actionsSource.indexOf('requestKey: operationalRequestKey_("order")') !== -1);
  ok("AUD-10", actionsSource.indexOf('operationalServerCall("submitOperationalOrder"') !== -1);
  ok("AUD-11", productionSource.indexOf("salesV2OperatorModeCreateOrder_") !== -1 &&
    guardSource.indexOf("function salesV2OperatorModeCreateOrder_") !== -1);
  ok("AUD-12", submitRegion.indexOf("saveOperationalOrder();") !== -1 &&
    submitRegion.indexOf("saveOperationalOrder();") < submitRegion.indexOf("submitCanonicalTransaction(payload)"));
  ok("AUD-13", actionsSource.indexOf("if (!prepared) payment.hidden = true;") !== -1 &&
    actionsSource.indexOf('payment.style.display = prepared ? "" : "none"') !== -1);
  ok("AUD-14", actionsSource.indexOf("if (!prepared) fulfillment.hidden = true;") !== -1 &&
    actionsSource.indexOf('fulfillment.style.display = prepared ? "" : "none"') !== -1);
  ok("AUD-4b", actionsSource.indexOf("element.style.display = element.hidden ? \"none\" : \"\";") !== -1,
    "hidden suppression out-specifies author CSS");
  ok("AUD-15", saveRegion.indexOf("productID: line.productID, productVariantID: line.productVariantID, qty: line.qty") !== -1 &&
    saveRegion.indexOf("hpp") === -1 && saveRegion.indexOf("SellingPrice") === -1);
  ok("AUD-16", actionsSource.indexOf("function operationalUnknown_") !== -1 &&
    actionsSource.indexOf('pending.state = "UNKNOWN"') !== -1);
  ok("AUD-17", (actionsSource.match(/completeSalesV2OperatorSave_\(/g) || []).length === 3 &&
    successRegion.indexOf("if (!salesV2ActiveSurface_()) return;") !== -1 &&
    successRegion.indexOf('successActions.innerHTML') !== -1);
  // T7: the 190 shell now hosts the dedicated Treasury module (nav + page),
  // so the Sales-surface isolation check is scoped to the Sales entry dialog
  // markup (not the whole shell) plus the Sales forms/actions/production.
  ok("AUD-18", [parseEntryElements_(indexSource).markup, formsSource, actionsSource, productionSource].every(function(source) {
    return source.indexOf("Treasury") === -1 && source.indexOf('"2010"') === -1;
  }));

  // One normal ACTIVE Save control: the dialog exposes exactly one submit
  // button and no second save affordance outside the hidden legacy section.
  var dialogMarkup = parseEntryElements_(indexSource).markup;
  ok("A1-5", (dialogMarkup.match(/type="submit"/g) || []).length === 1,
    String((dialogMarkup.match(/type="submit"/g) || []).length));

  checks.failed = checks.total - checks.passed;
  return checks;
}

module.exports = runSalesV2U10COperatorSurface;
