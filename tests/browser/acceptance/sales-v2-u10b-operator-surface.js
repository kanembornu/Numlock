// SALES_RECOGNITION_V2 U10B operator-surface suite (Node-only; executed via
// `_test_runner.js`). Loads the real 194 forms + 195 controller into an
// in-memory DOM/`google.script.run` harness. Originally written to reproduce
// the owner-observed legacy surface from HEAD source; since U10C it asserts the
// POST-CORRECTION contract of the same composition:
//   (S1) every legacy element string still exists in source, so UI appearance
//   alone never identifies the served deployment;
//   (S2) the client never resolves config: no config property, no server
//   resolver, no activation metadata in any view file, and the mode is read
//   only from the server authority response (`salesV2Mode`);
//   (S3-S4) Save eligibility for Sales is derived
//   (`isValidActiveSalesEntry_`) instead of the removed
//   `var validSales = false;` defect, so an unconfigured/unknown mode still
//   fails closed for Sales while a valid EXPENSE state enables;
//   (S5-S6) the durable save entrypoint and server mode routing remain the U7
//   path. UI-A1..A14 coverage lives in `sales-v2-u10c-operator-surface.js`.
// No browser process, no network, no production access.
var fs = require("fs");
var vm = require("vm");

var INDEX_PATH = "190.View.Index.html";
var RENDER_PATH = "193.View.Transactions.Render.html";
var FORMS_PATH = "194.View.Transactions.Forms.html";
var ACTIONS_PATH = "195.View.Transactions.Actions.html";
var GUARD_PATH = "97D.SalesRecognition.V2.OperatorGuard.js";
var ACTIVATION_PATH = "97E.SalesRecognition.V2.Activation.js";

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

function operatorSurfaceHarness_() {
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
    // State globals normally provided by 192/191/190.
    transactionEntryState: null,
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
  function el(id) { return ctx.document.getElementById(id); }
  elements_ = {
    appShell: { inert: false },
    transactionEntry: { overlay: el("entryOverlay"), dialog: el("entryDialog"),
      form: el("entryForm"), success: el("entrySuccess"),
      successDetails: el("entrySuccessDetails"), submitRegion: el("submitRegion"),
      generalError: el("generalError"), title: el("entryTitle"),
      description: el("entryDescription"), typeFieldset: el("typeFieldset"),
      typeSales: el("typeSales"), typeExpense: el("typeExpense"),
      optionsState: el("entryOptionsState"),
      correctionWorkspace: el("correctionWorkspace"),
      correctionReasonRegion: el("correctionReasonRegion"),
      correctionReview: el("correctionReview"),
      correctionReason: el("correctionReason"),
      correctionReasonError: el("correctionReasonError"),
      salesFields: el("salesFields"), expenseFields: el("expenseFields"),
      productSearch: el("productSearch"), productListbox: el("productListbox"),
      productMeta: el("productMeta"), productError: el("productError"),
      expenseSearch: el("expenseSearch"), expenseMeta: el("expenseMeta"),
      amount: el("amount"), typeHot: el("typeHot"), typeCold: el("typeCold"),
      salesTypeError: el("salesTypeError"), qty: el("qty"),
      salesOptionsStatus: el("salesEntryOptionsStatus"),
      expenseOptionsStatus: el("expenseEntryOptionsStatus"),
      submit: el("submit"), submitLabel: el("submitLabel") }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ACTIONS_PATH, "utf8"), ctx, { filename: ACTIONS_PATH });
  vm.runInContext(fs.readFileSync(FORMS_PATH, "utf8"), ctx, { filename: FORMS_PATH });
  ctx.transactionEntryState = ctx.createInitialTransactionEntryState();
  return { ctx: ctx, elements: elements, calls: calls, storage: storageMap };
}

function u10bAssert(checks, id, value, detail) {
  if (!value) throw new Error("SALES_V2_U10B_OPERATOR_SURFACE:" + id +
    (detail === undefined ? "" : "|" + detail));
  checks.passed++;
}

function runSalesV2U10BOperatorSurface() {
  var checks = { total: 0, passed: 0, failed: 0, ids: [] };
  function ok(id, value, detail) {
    checks.total++;
    u10bAssert(checks, id, value, detail);
    checks.ids.push(id);
  }

  var index = fs.readFileSync(INDEX_PATH, "utf8");
  var render = fs.readFileSync(RENDER_PATH, "utf8");
  var forms = fs.readFileSync(FORMS_PATH, "utf8");
  var actions = fs.readFileSync(ACTIONS_PATH, "utf8");
  var guard = fs.readFileSync(GUARD_PATH, "utf8");
  var activation = fs.readFileSync(ACTIVATION_PATH, "utf8");

  // S1: every owner-observed legacy element string exists in HEAD source.
  var observed = [
    ["Order review", index],
    ["Save Order", index],
    ["Continue existing order", index],
    ["Order number", index],
    ["Find Order", index],
    ["Save Transaction", index],
    ["Order tidak ditemukan.", actions],
    ["No open orders.", actions]
  ];
  observed.forEach(function(entry, i) {
    ok("S1-" + (i + 1), entry[1].indexOf(entry[0]) !== -1, entry[0]);
  });

  // S2: the client never resolves config itself (U10C). The mode arrives as a
  // plain server value on the authority bootstrap: view files hold no config
  // property name, no server resolver, no activation metadata, and the mode is
  // never computed on the client.
  [index, render, forms, actions].forEach(function(source, i) {
    ok("S2-" + (i + 1),
      source.indexOf("salesRecognitionV2OperatorConfig") === -1 &&
      source.indexOf("SALES_RECOGNITION_V2_CONFIG") === -1 &&
      source.indexOf("salesV2OperatorResolvedRoute_") === -1 &&
      source.indexOf("activationID") === -1 &&
      source.indexOf("activatedAt") === -1);
  });
  ok("S2-5", actions.indexOf("response.data.salesV2Mode") !== -1 &&
    index.indexOf("salesV2Mode") === -1 && render.indexOf("salesV2Mode") === -1 &&
    forms.indexOf("salesV2Mode") === -1,
    "mode is read from the server authority response only");
  var modeCalls = actions.match(/setSalesV2ClientMode_\(([^)]*)\)/g) || [];
  ok("S2-6", modeCalls.join("|").indexOf("response.data.salesV2Mode") !== -1 &&
    modeCalls.join("|").indexOf("null") !== -1 &&
    modeCalls.every(function(call) {
      return !/Date|getMonth|getTime|activatedAt|activationID|Math\./.test(call);
    }), modeCalls.join("|"));

  // S3: Save eligibility for Sales is derived from live V2 input state; the
  // unconditional `var validSales = false;` defect is gone.
  ok("S3-1", forms.indexOf("var validSales = false;") === -1);
  ok("S3-2", forms.indexOf("var validSales = isValidActiveSalesEntry_();") !== -1 &&
    (forms.match(/validSales/g) || []).length === 2,
    String((forms.match(/validSales/g) || []).length));

  // S4: with no resolved server mode the SALES Save stays fail-closed even
  // with fully valid input; control: a valid EXPENSE state enables it.
  var h = operatorSurfaceHarness_();
  var s = h.ctx.transactionEntryState;
  s.receiptUnresolved = false; s.submitting = false; s.submissionComplete = false;
  s.loadingOptions = false; s.mode = "create"; s.correctionReason = "";
  s.transactionType = "SALES";
  s.selectedProduct = { productId: "P1", product: "Coffee" };
  s.selectedType = "Hot"; s.qty = 1; s.pricing = { price: 20000 };
  s.cashAccountCode = "1000"; s.selectedExpense = null; s.amount = null;
  h.ctx.updateTransactionEntrySubmitState();
  ok("S4-1", h.ctx.document.getElementById("submit").disabled === true,
    "SALES with full valid input must reproduce observed disabled state");
  s.transactionType = "EXPENSE";
  s.selectedExpense = { expenseItemId: "E1", item: "Cups" };
  s.amount = 5000; s.selectedProduct = null; s.selectedType = null; s.pricing = null;
  h.ctx.updateTransactionEntrySubmitState();
  ok("S4-2", h.ctx.document.getElementById("submit").disabled === false,
    "EXPENSE control must enable, proving the Sales-disabled path is specific");

  // S5: the operable save at HEAD is Save Order: empty lines refused
  // client-side (button not disabled), a valid required line state makes the
  // save eligible and routes to the server mode dispatcher.
  h.ctx.operationalTransactionState.authorityStatus = "READY";
  h.ctx.operationalTransactionState.authority = {
    products: [{ ProductID: "P1", Name: "Coffee", IsActive: true }],
    productVariants: [{ ProductVariantID: "PV1", ProductID: "P1", Tipe: "HOT",
      SellingPrice: 20000 }],
    suppliers: [], purchaseItems: [], expenseItems: [], items: [], conversions: [],
    paymentMethods: [] };
  h.ctx.saveOperationalOrder();
  ok("S5-1", h.calls.length === 0 &&
    h.ctx.document.getElementById("operationalOrderError").innerText === "Pilih item.",
    JSON.stringify(h.calls.map(function(c) { return c.method; })));
  h.ctx.operationalTransactionState.lines.push({ productID: "P1",
    productVariantID: "PV1", qty: 1, name: "Coffee · Hot", price: 20000 });
  h.ctx.document.getElementById("operationalOrderType").value = "DINE_IN";
  h.ctx.saveOperationalOrder();
  ok("S5-2", h.calls.length === 1 && h.calls[0].method === "submitOperationalOrder" &&
    h.calls[0].payload.lines.length === 1 &&
    h.ctx.document.getElementById("operationalSaveOrder").disabled === true,
    JSON.stringify(h.calls.map(function(c) { return c.method; })));

  // S6: mode-routed V2 save capability exists only in server files at HEAD.
  ok("S6-1",
    guard.indexOf("function salesV2OperatorResolvedRoute_") !== -1 &&
    guard.indexOf("function salesV2OperatorModeCreateOrder_") !== -1 &&
    guard.indexOf("function salesV2OperatorCreateWithRuntime_") !== -1 &&
    guard.indexOf("function salesV2OperatorLegacySalesGuard_") !== -1);
  ok("S6-2", activation.indexOf("function salesRecognitionV2Activate(") !== -1);
  ok("S6-3",
    guard.indexOf("salesV2OperatorActiveCreate_") !== -1 &&
    guard.indexOf('route.mode === "PREPARED"') !== -1 &&
    guard.indexOf("createDurableOperationalOrder_") !== -1);

  return checks;
}

module.exports = runSalesV2U10BOperatorSurface;
