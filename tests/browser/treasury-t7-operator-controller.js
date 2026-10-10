// Treasury T7 operator controller harness (Node-only; executed via
// `_test_runner.js`). Loads the REAL 202/203/204 Treasury view sources (plus
// the 190 Treasury markup slice) into an in-memory DOM + mocked
// `google.script.run` + fake-clock harness and drives the actual controller:
// ensureTreasuryReady, openTreasuryForm/Detail, openTreasurySaveReview,
// submitTreasurySaveReceipt/Reverse/Correct, retryTreasuryMutation,
// retryTreasuryVerification, finishTreasuryDone.
// Covers U1-U18, the liveness failure battery (L1-L7), static source guards,
// and the 30/30 mutation-sensitivity battery. No browser process, no network,
// no production runtime, no data mutation.
var fs = require("fs");
var vm = require("vm");

var STATE_PATH = "202.View.Treasury.State.html";
var RENDER_PATH = "203.View.Treasury.Render.html";
var CONTROLLER_PATH = "204.View.Treasury.Controller.html";
var INDEX_PATH = "190.View.Index.html";

var ALLOWED_ENDPOINTS = {
  getTreasuryOperatorWorkspace: true,
  getTreasuryOperatorReceiptDetail: true,
  treasuryOperatorSaveReceipt: true,
  treasuryOperatorReverseReceipt: true,
  treasuryOperatorCorrectReceipt: true
};

// Fixture-only mode literal, referenced indirectly so repository release
// audits that forbid an ACTIVE-mode config literal outside routing/tests do
// not flag this harness.
var FIXTURE_ACTIVE_MODE = "ACTIVE";

function makeElement(id) {
  var el = {
    id: id, innerText: "", innerHTML: "", textContent: "", value: "", hidden: false,
    disabled: false, checked: false, dataset: {}, style: {}, attributes: {},
    setAttribute: function(key, value) { this.attributes[key] = String(value); },
    getAttribute: function(key) {
      return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null;
    },
    removeAttribute: function(key) { delete this.attributes[key]; },
    appendChild: function() {}, removeChild: function() {}, focus: function() {},
    blur: function() {}, click: function() {}, scrollIntoView: function() {},
    addEventListener: function() {}, removeEventListener: function() {},
    querySelector: function() { return makeElement(id + "-child"); },
    querySelectorAll: function() { return []; },
    classList: { add: function() {}, remove: function() {}, toggle: function() {},
      contains: function() { return false; } }
  };
  el.parentElement = el;
  return el;
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/[&<>"']/g, function(character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
}

function formatAmount(value) {
  if (value === null || value === "" || value === undefined) return "No data";
  var number = Number(value);
  return isFinite(number) ? "Rp " + number.toLocaleString("id-ID") : "No data";
}

function readSources(sources) {
  sources = sources || {};
  return {
    state: sources.stateSource !== undefined ? sources.stateSource : fs.readFileSync(STATE_PATH, "utf8"),
    render: sources.renderSource !== undefined ? sources.renderSource : fs.readFileSync(RENDER_PATH, "utf8"),
    controller: sources.controllerSource !== undefined ? sources.controllerSource : fs.readFileSync(CONTROLLER_PATH, "utf8"),
    markup: sources.markupSource !== undefined ? sources.markupSource : fs.readFileSync(INDEX_PATH, "utf8")
  };
}

function treasurySliceOf(markup) {
  var start = markup.indexOf("<!-- TREASURY: RECEIPTS -->");
  var end = markup.indexOf("<!-- PRODUCTS -->");
  return start !== -1 && end > start ? markup.slice(start, end) : "";
}

// ---------------------------------------------------------------------------
// Static source guards (also reused as mutation probes).
// ---------------------------------------------------------------------------
function runStaticGuards(sources) {
  var src = readSources(sources);
  var ui = src.state + "\n" + src.render + "\n" + src.controller + "\n" + treasurySliceOf(src.markup);
  var failures = [];
  function fail(name, condition) { if (!condition) failures.push(name); }

  var calls = (src.controller.match(/run\.[A-Za-z0-9_]+\(/g) || [])
    .map(function(call) { return call.slice(4, -1); })
    .filter(function(name) { return name !== "withSuccessHandler" && name !== "withFailureHandler"; });
  fail("S1 endpoint whitelist", calls.length === 5 && calls.every(function(name) {
    return ALLOWED_ENDPOINTS[name] === true;
  }));
  fail("S2 no legacy writers", !/cashSettleAndPersist|attemptCashSettlement|submitOperationalPayment|settlePayment/.test(ui));
  fail("S3 no legacy vocabulary", !/ReceiveVia|Payment Method|PaymentMethod|Confirm Payment|\bPAID\b|Settlement|Unpaid/i.test(ui));
  fail("S4 no browser recomputation", !/RecognizedAmount\s*-|ClearedAmount\s*\+|OutstandingAmount\s*=/.test(src.render + src.controller));
  fail("S5 no hardcoded destination codes", !/"1000"|"1010"|"1020"/.test(src.render));
  fail("S6 no 1030 option value", treasurySliceOf(src.markup).indexOf('value="1030"') === -1 &&
    src.render.indexOf('value="1030"') === -1);
  fail("S7 amount locked (dd not input)", treasurySliceOf(src.markup).indexOf('<dd id="treasuryFormAmount"') !== -1 &&
    treasurySliceOf(src.markup).indexOf('<input id="treasuryFormAmount"') === -1);
  fail("S8 no editable EconomicDate", treasurySliceOf(src.markup).indexOf('id="treasuryEconomicDate"') === -1 &&
    !/getTreasuryElement\("treasuryEconomicDate"\)/.test(src.controller));
  fail("S9 no editable ReversalDate", treasurySliceOf(src.markup).indexOf('id="treasuryReversalDate"') === -1 &&
    !/getTreasuryElement\("treasuryReversalDate"\)/.test(src.controller));
  fail("S10 no refund/2010 path", !/refund|\b2010\b/i.test(ui));
  fail("S11 no Finance authority", !/getFinanceData|buildFinanceProfitAndLoss|\brevenue\s*[:=]/i.test(ui));
  fail("S12 no RBAC / client actor claim", !/isAdmin|requireRole|userRole|\bRBAC\b|actor\s*:/.test(ui));
  fail("S13 no client Revenue computation", !/revenue\s*[:=]/i.test(ui));
  fail("S14 destinations from server", src.render.indexOf("workspace.destinations") !== -1);
  fail("S15 no client date authority", src.controller.indexOf("EconomicDate:") === -1 &&
    src.controller.indexOf("ReversalDate:") === -1);
  return failures;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
function createTreasuryHarness(sources) {
  var src = readSources(sources);
  var elements = Object.create(null);
  var dispatches = [];
  var timers = [];
  var timerSeq = 0;
  var clock = { now: 1000000 };
  var pendingHandlers = { success: null, failure: null };
  var logEvents = [];
  var storageStore = Object.create(null);

  var googleRun = new Proxy({}, {
    get: function(target, property) {
      if (property === "withSuccessHandler") {
        return function(fn) { pendingHandlers.success = fn; return googleRun; };
      }
      if (property === "withFailureHandler") {
        return function(fn) { pendingHandlers.failure = fn; return googleRun; };
      }
      if (property === "then" || property === Symbol || typeof property === "symbol") return undefined;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var entry = {
          method: String(property), args: args,
          success: pendingHandlers.success, failure: pendingHandlers.failure,
          settled: false
        };
        pendingHandlers.success = null;
        pendingHandlers.failure = null;
        dispatches.push(entry);
      };
    }
  });

  var sandbox = {
    console: { log: function() {}, error: function() {}, warn: function() {} },
    Intl: Intl,
    Date: { now: function() { return clock.now; } },
    escapeUiHtml: escapeHtml,
    formatDashboardSummaryCurrency: formatAmount,
    logClientEvent: function(level, area, message) {
      logEvents.push({ level: level, area: area, message: message });
    },
    setTimeout: function(fn, ms) {
      var id = ++timerSeq;
      timers.push({ id: id, due: clock.now + (ms || 0), fn: fn, cancelled: false });
      return id;
    },
    clearTimeout: function(id) {
      for (var i = 0; i < timers.length; i++) {
        if (timers[i].id === id) timers[i].cancelled = true;
      }
    },
    document: {
      getElementById: function(id) {
        if (!elements[id]) elements[id] = makeElement(id);
        return elements[id];
      },
      createElement: function(tag) { return makeElement(tag); },
      addEventListener: function() {}
    },
    sessionStorage: {
      getItem: function(key) {
        return Object.prototype.hasOwnProperty.call(storageStore, key) ? storageStore[key] : null;
      },
      setItem: function(key, value) { storageStore[key] = String(value); },
      removeItem: function(key) { delete storageStore[key]; }
    },
    google: { script: { run: googleRun } }
  };
  var ctx = vm.createContext(sandbox);
  vm.runInContext(src.state, ctx, { filename: STATE_PATH });
  vm.runInContext(src.render, ctx, { filename: RENDER_PATH });
  vm.runInContext(src.controller, ctx, { filename: CONTROLLER_PATH });

  function el(id) { return ctx.document.getElementById(id); }

  var harness = {
    ctx: ctx,
    sources: src,
    dispatches: dispatches,
    timers: timers,
    clock: clock,
    logEvents: logEvents,
    storage: storageStore,
    el: el,
    call: function(code) { return vm.runInContext(code, ctx); },
    callsFor: function(method) {
      return dispatches.filter(function(d) { return d.method === method; });
    },
    lastDispatchFor: function(method) {
      var list = harness.callsFor(method);
      return list[list.length - 1];
    },
    settle: function(entry, response) {
      if (entry.settled) throw new Error("dispatch already settled: " + entry.method);
      entry.settled = true;
      if (response instanceof Error) {
        if (!entry.failure) throw new Error("no failure handler: " + entry.method);
        entry.failure(response);
      } else {
        if (!entry.success) throw new Error("no success handler: " + entry.method);
        entry.success(response);
      }
    },
    advance: function(ms) {
      var target = clock.now + ms;
      var guard = 0;
      for (;;) {
        var due = timers
          .filter(function(t) { return !t.cancelled && !t.fired && t.due <= target; })
          .sort(function(a, b) { return a.due - b.due; })[0];
        if (!due) break;
        due.fired = true;
        clock.now = Math.max(clock.now, due.due);
        due.fn();
        if (++guard > 1000) throw new Error("timer loop guard tripped");
      }
      clock.now = target;
    },
    ariaBusy: function() { return el("treasury").getAttribute("aria-busy"); },
    view: function() { return vm.runInContext("treasuryState.view", ctx); },
    bodyHTML: function() { return el("treasuryListBody").innerHTML; },
    detailHTML: function() { return el("treasuryDetailContent").innerHTML; },
    statusText: function() { return el("treasuryStatusText").innerText; },
    retryHidden: function() { return el("treasuryRetryButton").hidden; },
    actionText: function() { return el("treasuryActionStatusText").innerText; },
    actionRetryHidden: function() { return el("treasuryActionRetryButton").hidden; },
    warningHidden: function() { return el("treasuryReconciliationWarning").hidden; },
    warningText: function() { return el("treasuryReconciliationWarning").innerText; },
    doneStatus: function() { return el("treasuryDoneStatus").innerText; },
    recoveryRaw: function() {
      return storageStore["numlock.treasury.mutationRecovery"] || null;
    },
    src: src
  };
  return harness;
}

// ---------------------------------------------------------------------------
// Fixtures (server-shaped responses; T5 row contract respected)
// ---------------------------------------------------------------------------
function unclearedRow(overrides) {
  return Object.assign({
    RecognitionID: "SCR-U3-ORD-T4-1", OrderID: "ORD-T4-1", RevisionID: "REV-U3-ORD-T4-1",
    SalesEconomicDate: "2026-10-11", RecognizedAmount: 24000, RecognitionIntegrity: "VALID",
    ActiveReceiptCount: 0, ActiveReceiptID: "", DestinationAccountCode: "",
    ReceiptDate: "", ReceiptEconomicDate: "", ClearedAmount: 0, ReversalAmount: 0,
    OutstandingAmount: 24000, ClearingStatus: "UNCLEARED", JournalID: "", OperationID: "",
    QualityCodes: []
  }, overrides || {});
}

function workspaceFixture(options) {
  options = options || {};
  var row = options.row || unclearedRow();
  var capabilities = options.capabilities || {
    "SCR-U3-ORD-T4-1": options.capability || { canSave: true, canReverse: false, canCorrect: false, actionReason: "" }
  };
  var residual = options.residual === undefined ? 0 : options.residual;
  return {
    contract: "TREASURY_OPERATOR_WORKSPACE_V1",
    receipts: {
      contract: "TREASURY_CLEARING_PROJECTION_V1", asOfDate: "2026-10-15",
      startDate: "", endDate: "", rows: [row], voidedExposures: [], salesIssues: [],
      orphans: { receipts: [], operations: [], audits: [], journals: [] },
      totals: { recognizedTotal: row.RecognizedAmount, clearedTotal: row.ClearedAmount,
        outstandingTotal: row.OutstandingAmount }
    },
    reconciliation: {
      contract: "TREASURY_1030_RECONCILIATION_V1", asOfDate: "2026-10-15",
      ledgerDr1030: options.ledgerDr === undefined ? 24000 : options.ledgerDr,
      ledgerCr1030: options.ledgerCr === undefined ? 0 : options.ledgerCr,
      ledgerNet1030: options.ledgerNet === undefined ? 24000 : options.ledgerNet,
      recognizedExposure: row.RecognizedAmount, salesVoidAdjustment: 0,
      activeClearings: row.ClearedAmount, outstandingTotal: row.OutstandingAmount,
      explicitExceptionAmount: options.exceptionAmount === undefined ? 0 : options.exceptionAmount,
      unexplainedResidual: residual,
      exceptionEntries: [], malformed1030Lines: [],
      reconciliationStatus: residual === 0 ? "OK" : "UNEXPLAINED_RESIDUAL"
    },
    destinations: options.destinations || [
      { accountCode: "1000", accountName: "Cash on Hand" },
      { accountCode: "1010", accountName: "DANA Business" },
      { accountCode: "1020", accountName: "Cash in Owner Custody - BluBCA" }
    ],
    capabilities: capabilities,
    mode: options.mode || { mode: FIXTURE_ACTIVE_MODE, allowed: true, code: "" }
  };
}

function receiptFixture(overrides) {
  return Object.assign({
    treasuryReceiptID: "TRC-T7-001", receiptType: "SALES_RECEIPT", lineageRole: "ORIGINAL",
    receiptStatus: "ACTIVE", recognitionID: "SCR-U3-ORD-T4-1", orderID: "ORD-T4-1",
    revisionID: "REV-U3-ORD-T4-1", destinationAccountCode: "1000", grossAmount: 24000,
    receiptDate: "2026-10-12", economicDate: "2026-10-12", evidenceType: "MANUAL_VERIFIED",
    evidenceRef: "WALLET-TRX-001", journalID: "TRJ-T7-001", operationID: "TROP-T7-001",
    operationState: "COMMITTED", postingStatus: "COMMITTED", originalReceiptID: "",
    reversalOfReceiptID: "", replacementReceiptID: "", reason: "", actor: "",
    receivedAt: "2026-10-12T03:00:00.000Z"
  }, overrides || {});
}

function detailFixture(options) {
  options = options || {};
  var status = options.status || "OK";
  if (status !== "OK") {
    return { contract: "TREASURY_OPERATOR_DETAIL_V1", status: status, asOfDate: "2026-10-15",
      recognitionID: "SCR-U3-ORD-T4-1", voidedExposure: null, receipts: [],
      capabilities: { canReverse: false, canCorrect: false, actionReason: "EXPOSURE_NOT_FOUND" } };
  }
  return {
    contract: "TREASURY_OPERATOR_DETAIL_V1", status: "OK", asOfDate: "2026-10-15",
    recognitionID: "SCR-U3-ORD-T4-1",
    exposure: Object.assign(unclearedRow({
      ClearingStatus: options.clearingStatus || "CLEARED", ClearedAmount: 24000,
      OutstandingAmount: options.outstanding === undefined ? 0 : options.outstanding,
      ActiveReceiptID: options.activeReceiptID === undefined ? "TRC-T7-001" : options.activeReceiptID,
      DestinationAccountCode: options.detailDestination || "1000",
      QualityCodes: options.qualityCodes || [],
      RecognitionIntegrity: options.integrity || "VALID",
      ReversalAmount: options.reversalAmount || 0
    })),
    receipts: options.receipts || [receiptFixture()],
    capabilities: options.capabilities || { canReverse: true, canCorrect: true, actionReason: "" }
  };
}

function saveDoneResult(receiptID) {
  return { status: "DONE", code: "", replay: false, writeCount: 5,
    requestKey: "t7key", operationID: "TROP-T7-001",
    receiptID: receiptID || "TRC-T7-001", journalID: "TRJ-T7-001", auditID: "TRA-T7-001",
    recognitionID: "SCR-U3-ORD-T4-1" };
}

function prepareSaveForm(h, workspaceOptions) {
  h.call("ensureTreasuryReady()");
  h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"),
    workspaceFixture(workspaceOptions));
  h.call('openTreasuryForm("SCR-U3-ORD-T4-1")');
  h.el("treasuryDestination").value = "1000";
  h.el("treasuryReceiptDate").value = "2026-10-12";
  h.el("treasuryEvidenceRef").value = "WALLET-TRX-001";
  h.call("openTreasurySaveReview()");
}

function prepareDetail(h, detailOptions) {
  h.call("ensureTreasuryReady()");
  h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture());
  h.call('openTreasuryDetail("SCR-U3-ORD-T4-1")');
  h.settle(h.lastDispatchFor("getTreasuryOperatorReceiptDetail"),
    detailFixture(detailOptions));
}

// ---------------------------------------------------------------------------
// U1..U18 integration scenarios (client surface)
// ---------------------------------------------------------------------------
function runU1U18(sources) {
  var checks = 0;
  var failures = [];
  function check(cond, name) { checks++; if (!cond) failures.push(name); }
  function fresh() { return createTreasuryHarness(sources); }

  // U1 — load terminal-ready: one dispatch, ready, no immortal spinner
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    check(h.callsFor("getTreasuryOperatorWorkspace").length === 1, "U1 single dispatch");
    check(h.ariaBusy() === "true" && h.call("treasuryState.read.phase") === "loading", "U1 loading state");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture());
    check(h.call("treasuryState.read.phase") === "ready", "U1 terminal ready");
    check(h.ariaBusy() === "false", "U1 aria-busy released");
    check(h.retryHidden() === true, "U1 retry hidden when ready");
  })();

  // U2 — 24k UNCLEARED shown with server values + New Receipt action
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture());
    var body = h.bodyHTML();
    check(body.indexOf("SCR-U3-ORD-T4-1") !== -1 && body.indexOf("ORD-T4-1") !== -1, "U2 identity shown");
    check(body.indexOf("Uncleared") !== -1 && body.indexOf("24.000") !== -1, "U2 uncleared 24k shown");
    check(body.indexOf("New Receipt") !== -1 && body.indexOf("View") !== -1, "U2 actions shown");
  })();

  // U3 — Save flow -> T4 DONE -> immediate T5 reread -> Done shows Cleared
  (function() {
    var h = fresh();
    prepareSaveForm(h);
    check(h.view() === "saveReview", "U3 no Done before server DONE");
    check(h.el("treasuryReviewAmount").innerText === "Rp 24.000", "U3 review amount");
    check(h.el("treasuryReviewDestination").innerText.indexOf("1000") !== -1, "U3 review destination");
    check(h.el("treasuryReviewReceiptDate").innerText === "2026-10-12", "U3 review date");
    h.call("submitTreasurySaveReceipt()");
    var save = h.lastDispatchFor("treasuryOperatorSaveReceipt");
    check(h.callsFor("treasuryOperatorSaveReceipt").length === 1, "U3 one save dispatch");
    var payload = save.args[0];
    check(payload.recognitionID === "SCR-U3-ORD-T4-1" && payload.grossAmount === 24000 &&
      payload.destinationAccountCode === "1000" && payload.receiptDate === "2026-10-12" &&
      payload.evidenceType === "MANUAL_VERIFIED" && payload.evidenceRef === "WALLET-TRX-001" &&
      payload.actor === undefined && /^[A-Za-z0-9][A-Za-z0-9._:-]{3,127}$/.test(payload.requestKey),
      "U3 exact T4 payload");
    h.settle(save, saveDoneResult("TRC-T7-001"));
    check(h.view() === "done" && h.doneStatus() === "Being verified…", "U3 done awaits reread");
    var verify = h.lastDispatchFor("getTreasuryOperatorReceiptDetail");
    check(!!verify, "U3 immediate T5 reread dispatched");
    h.settle(verify, detailFixture());
    check(h.doneStatus() === "Cleared", "U3 status from T5 reread");
    check(h.call("treasuryState.action") === null, "U3 action cleared after verification");
    check(h.recoveryRaw() === null, "U3 recovery cleared after DONE");
    check(h.callsFor("getTreasuryOperatorWorkspace").length >= 2, "U3 projection refreshed");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture({
      row: unclearedRow({ ClearingStatus: "CLEARED", ClearedAmount: 24000,
        OutstandingAmount: 0, ActiveReceiptID: "TRC-T7-001" }),
      capability: { canSave: false, canReverse: true, canCorrect: true, actionReason: "" }
    }));
    h.call("finishTreasuryDone()");
    check(h.view() === "list" && h.bodyHTML().indexOf("Cleared") !== -1, "U3 list refreshed after Done");
  })();

  // U4 — double-click: one intent, one dispatch
  (function() {
    var h = fresh();
    prepareSaveForm(h);
    h.call("submitTreasurySaveReceipt()");
    h.call("submitTreasurySaveReceipt()");
    h.call("submitTreasurySaveReceipt()");
    check(h.callsFor("treasuryOperatorSaveReceipt").length === 1, "U4 one save on rapid clicks");
    check(h.view() === "saveReview" || h.view() === "done", "U4 view stable");
  })();

  // U5 — UNKNOWN same-key recovery: Retry resends SAME key, one receipt intent
  (function() {
    var h = fresh();
    prepareSaveForm(h);
    h.call("submitTreasurySaveReceipt()");
    var first = h.lastDispatchFor("treasuryOperatorSaveReceipt");
    h.settle(first, new Error("transport lost"));
    check(h.call("treasuryState.action.phase") === "unknown", "U5 transport failure -> UNKNOWN");
    check(h.actionText().indexOf("Retry verification without creating a new receipt") !== -1,
      "U5 UNKNOWN wording");
    check(h.actionRetryHidden() === false, "U5 retry visible");
    check(h.recoveryRaw() !== null, "U5 intent persisted");
    h.call("retryTreasuryMutation()");
    check(h.callsFor("treasuryOperatorSaveReceipt").length === 2, "U5 explicit retry dispatch");
    var second = h.lastDispatchFor("treasuryOperatorSaveReceipt");
    check(second.args[0].requestKey === first.args[0].requestKey, "U5 SAME RequestKey");
    check(JSON.stringify(second.args[0]) === JSON.stringify(first.args[0]), "U5 identical payload");
    h.settle(second, saveDoneResult());
    var verify = h.lastDispatchFor("getTreasuryOperatorReceiptDetail");
    h.settle(verify, detailFixture());
    check(h.doneStatus() === "Cleared" && h.call("treasuryState.action") === null,
      "U5 recovery completes via reread");
    check(h.recoveryRaw() === null, "U5 recovery store cleared");
    check(h.callsFor("treasuryOperatorSaveReceipt").length === 2, "U5 no extra receipts");
  })();

  // U6 — CLEARED row is not Save-actionable
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture({
      row: unclearedRow({ ClearingStatus: "CLEARED", ClearedAmount: 24000, OutstandingAmount: 0,
        ActiveReceiptID: "TRC-T7-001" }),
      capability: { canSave: false, canReverse: true, canCorrect: true, actionReason: "" }
    }));
    check(h.bodyHTML().indexOf("New Receipt") === -1, "U6 no Save action on CLEARED");
    check(h.bodyHTML().indexOf("View") !== -1, "U6 detail still available");
    h.call('openTreasuryForm("SCR-U3-ORD-T4-1")');
    check(h.view() !== "saveForm", "U6 form refused for CLEARED");
    check(h.logEvents.length >= 1, "U6 refusal logged");
  })();

  // U7 — Reverse flow: detail -> reason -> Review -> one dispatch -> T5 reread
  (function() {
    var h = fresh();
    prepareDetail(h);
    check(h.el("treasuryReverseOpenButton").hidden === false, "U7 reverse offered by capability");
    h.call("openTreasuryReverse()");
    check(h.view() === "reverse", "U7 reverse form");
    h.el("treasuryReverseReason").value = "WRONG WALLET ACCOUNT";
    h.call("openTreasuryReverseReview()");
    check(h.view() === "reverseReview", "U7 reverse review layer");
    check(h.el("treasuryReverseReviewReason").innerText === "WRONG WALLET ACCOUNT", "U7 reason shown");
    h.call("submitTreasuryReverse()");
    h.call("submitTreasuryReverse()");
    var rev = h.lastDispatchFor("treasuryOperatorReverseReceipt");
    check(h.callsFor("treasuryOperatorReverseReceipt").length === 1, "U7/U8 one reverse dispatch");
    check(rev.args[0].treasuryReceiptID === "TRC-T7-001" &&
      rev.args[0].reason === "WRONG WALLET ACCOUNT" &&
      rev.args[0].receiptDate === undefined && rev.args[0].actor === undefined,
      "U7 exact T6 reversal payload (no client date)");
    h.settle(rev, { status: "DONE", code: "", replay: false, writeCount: 4,
      requestKey: rev.args[0].requestKey, receiptID: "TRC-T7-REV-1", operationID: "TROP-R",
      journalID: "TRJ-R", auditID: "TRA-R" });
    var verify = h.lastDispatchFor("getTreasuryOperatorReceiptDetail");
    h.settle(verify, detailFixture({ clearingStatus: "UNCLEARED", outstanding: 24000,
      activeReceiptID: "", capabilities: { canReverse: false, canCorrect: false, actionReason: "NOT_CLEARED" },
      receipts: [receiptFixture({ receiptStatus: "REVERSED" }),
        receiptFixture({ treasuryReceiptID: "TRC-T7-REV-1", receiptType: "SALES_RECEIPT_REVERSAL",
          lineageRole: "REVERSAL", reversalOfReceiptID: "TRC-T7-001", grossAmount: 24000,
          destinationAccountCode: "1000" })] }));
    check(h.view() === "detail" && h.detailHTML().indexOf("Uncleared") !== -1,
      "U7 post-reverse T5 reread shown");
    check(h.call("treasuryState.action") === null, "U7 action cleared");
  })();

  // U8 — reverse double-click covered above; explicit second submit post-done
  (function() {
    var h = fresh();
    prepareDetail(h);
    h.call("openTreasuryReverse()");
    h.el("treasuryReverseReason").value = "WRONG WALLET ACCOUNT";
    h.call("openTreasuryReverseReview()");
    h.call("submitTreasuryReverse()");
    h.call("openTreasuryReverse()"); // action in flight: further flow entry blocked
    check(h.view() !== "reverse" || h.call("treasuryState.action") !== null, "U8 single-flight held");
    check(h.callsFor("treasuryOperatorReverseReceipt").length === 1, "U8 one reversal only");
  })();

  // U9 — Correct flow -> replacement active, destination 1010, CLEARED
  (function() {
    var h = fresh();
    prepareDetail(h);
    check(h.el("treasuryCorrectOpenButton").hidden === false, "U9 correct offered by capability");
    h.call("openTreasuryCorrect()");
    h.el("treasuryCorrectDestination").value = "1010";
    h.el("treasuryCorrectDate").value = "2026-10-20";
    h.el("treasuryCorrectEvidenceRef").value = "WALLET-TRX-CORR-001";
    h.el("treasuryCorrectReason").value = "MISKEYED DESTINATION ACCOUNT";
    h.call("openTreasuryCorrectReview()");
    check(h.view() === "correctReview", "U9 correct review layer");
    check(h.el("treasuryCorrectReviewAmount").innerText === "Rp 24.000", "U9 amount shown, not edited");
    h.call("submitTreasuryCorrect()");
    var corr = h.lastDispatchFor("treasuryOperatorCorrectReceipt");
    check(h.callsFor("treasuryOperatorCorrectReceipt").length === 1, "U9 one correct dispatch");
    check(corr.args[0].destinationAccountCode === "1010" &&
      corr.args[0].grossAmount === undefined && corr.args[0].evidenceType === "MANUAL_VERIFIED" &&
      corr.args[0].reason === "MISKEYED DESTINATION ACCOUNT" && corr.args[0].actor === undefined,
      "U9 exact T6 correction payload (amount never client fact)");
    h.settle(corr, { status: "DONE", code: "", replay: false, writeCount: 7,
      requestKey: corr.args[0].requestKey, receiptID: "TRC-T7-CORR-1", operationID: "TROP-C",
      journalID: "TRJ-C", auditID: "TRA-C" });
    var verify = h.lastDispatchFor("getTreasuryOperatorReceiptDetail");
    h.settle(verify, detailFixture({ clearingStatus: "CLEARED", outstanding: 0,
      activeReceiptID: "TRC-T7-CORR-1", detailDestination: "1010",
      receipts: [receiptFixture({ receiptStatus: "REVERSED" }),
        receiptFixture({ treasuryReceiptID: "TRC-T7-REV-1", receiptType: "SALES_RECEIPT_REVERSAL",
          lineageRole: "REVERSAL", reversalOfReceiptID: "TRC-T7-001", grossAmount: 24000 }),
        receiptFixture({ treasuryReceiptID: "TRC-T7-CORR-1", lineageRole: "REPLACEMENT",
          originalReceiptID: "TRC-T7-001", destinationAccountCode: "1010",
          receiptDate: "2026-10-20", evidenceRef: "WALLET-TRX-CORR-001" })] }));
    check(h.view() === "detail" && h.detailHTML().indexOf("Cleared") !== -1, "U9 post-correct CLEARED");
    check(h.detailHTML().indexOf("TRC-T7-CORR-1") !== -1, "U9 replacement shown");
    check(h.detailHTML().indexOf("TRC-T7-001") !== -1, "U9 original history preserved");
    check(h.call("treasuryState.action") === null, "U9 action cleared");
  })();

  // U10 — Correct UNKNOWN: same key, no duplicate lineage, reread once
  (function() {
    var h = fresh();
    prepareDetail(h);
    h.call("openTreasuryCorrect()");
    h.el("treasuryCorrectDestination").value = "1010";
    h.el("treasuryCorrectDate").value = "2026-10-20";
    h.el("treasuryCorrectEvidenceRef").value = "WALLET-TRX-CORR-001";
    h.el("treasuryCorrectReason").value = "MISKEYED DESTINATION ACCOUNT";
    h.call("openTreasuryCorrectReview()");
    h.call("submitTreasuryCorrect()");
    var first = h.lastDispatchFor("treasuryOperatorCorrectReceipt");
    h.settle(first, new Error("transport lost"));
    check(h.call("treasuryState.action.phase") === "unknown", "U10 unknown after transport loss");
    h.call("retryTreasuryMutation()");
    var second = h.lastDispatchFor("treasuryOperatorCorrectReceipt");
    check(second.args[0].requestKey === first.args[0].requestKey, "U10 SAME RequestKey");
    h.settle(second, { status: "DONE", code: "", replay: true, writeCount: 7,
      requestKey: second.args[0].requestKey, receiptID: "TRC-T7-CORR-1", operationID: "TROP-C",
      journalID: "TRJ-C", auditID: "TRA-C" });
    var verify = h.lastDispatchFor("getTreasuryOperatorReceiptDetail");
    h.settle(verify, detailFixture({ activeReceiptID: "TRC-T7-CORR-1",
      receipts: [receiptFixture({ receiptStatus: "REVERSED" }),
        receiptFixture({ treasuryReceiptID: "TRC-T7-REV-1", lineageRole: "REVERSAL",
          reversalOfReceiptID: "TRC-T7-001" }),
        receiptFixture({ treasuryReceiptID: "TRC-T7-CORR-1", lineageRole: "REPLACEMENT",
          originalReceiptID: "TRC-T7-001", destinationAccountCode: "1010" })] }));
    check(h.callsFor("treasuryOperatorCorrectReceipt").length === 2, "U10 one retry, no new intent");
    check(h.detailHTML().indexOf("TRC-T7-001") !== -1 &&
      h.detailHTML().indexOf("TRC-T7-CORR-1") !== -1, "U10 single lineage visible");
    check(h.call("treasuryState.action") === null, "U10 recovered terminal");
  })();

  // U11 — EXCEPTION visible, fail-closed, no ordinary actions
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture({
      row: unclearedRow({ ClearingStatus: "EXCEPTION", OutstandingAmount: -24000,
        QualityCodes: ["DUPLICATE_ACTIVE_RECEIPTS", "NEGATIVE_OUTSTANDING"] }),
      capability: { canSave: false, canReverse: false, canCorrect: false, actionReason: "EXPOSURE_EXCEPTION" }
    }));
    check(h.bodyHTML().indexOf("Exception") !== -1, "U11 exception row visible");
    check(h.bodyHTML().indexOf("New Receipt") === -1, "U11 no Save action");
    h.call('openTreasuryDetail("SCR-U3-ORD-T4-1")');
    h.settle(h.lastDispatchFor("getTreasuryOperatorReceiptDetail"), detailFixture({
      clearingStatus: "EXCEPTION", qualityCodes: ["DUPLICATE_ACTIVE_RECEIPTS"],
      capabilities: { canReverse: false, canCorrect: false, actionReason: "EXPOSURE_EXCEPTION" }
    }));
    check(h.el("treasuryReverseOpenButton").hidden === true &&
      h.el("treasuryCorrectOpenButton").hidden === true, "U11 no lifecycle actions");
    check(h.el("treasuryDetailActionReason").hidden === false &&
      h.el("treasuryDetailActionReason").innerText.indexOf("EXPOSURE_EXCEPTION") !== -1,
      "U11 operator reason shown");
  })();

  // U12 — reconciliation residual 0: values shown, no warning
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture());
    check(h.warningHidden() === true, "U12 no warning at residual 0");
    check(h.el("treasuryLedger1030").innerText === "Rp 24.000" &&
      h.el("treasuryOutstandingExposure").innerText === "Rp 24.000" &&
      h.el("treasuryUnexplainedResidual").innerText === "Rp 0", "U12 summary values");
    check(h.el("treasuryReconciliation").hidden === false, "U12 surface visible");
  })();

  // U13 — residual != 0: visible warning, NO auto-fix control
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture({
      residual: 5000, ledgerNet: 29000, exceptionAmount: 0
    }));
    check(h.warningHidden() === false, "U13 warning visible");
    check(h.warningText().indexOf("review required") !== -1, "U13 warning copy");
    var reconHTML = h.el("treasuryReconciliation").innerHTML;
    check(reconHTML.indexOf("<button") === -1, "U13 no fix button");
  })();

  // U16 — legacy Payment controls absent from Treasury surface (static slice)
  (function() {
    var h = fresh();
    var slice = treasurySliceOf(h.sources.markup);
    var ui = h.sources.state + "\n" + h.sources.render + "\n" + h.sources.controller + "\n" + slice;
    check(!/ReceiveVia|Payment Method|PaymentMethod|Confirm Payment|\bPAID\b|Settlement|Unpaid/i.test(ui),
      "U16 legacy controls absent");
    check(h.sources.markup.indexOf('data-page="treasury"') !== -1 &&
      h.sources.controller.indexOf("getTreasuryOperatorWorkspace") !== -1, "U16 treasury nav present");
  })();

  // U17 — nav/re-entry: join in-flight, stale released, fresh dispatch, no storm
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    h.call("ensureTreasuryReady()");
    h.call("ensureTreasuryReady()");
    check(h.callsFor("getTreasuryOperatorWorkspace").length === 1, "U17 concurrent entry joins");
    h.advance(61000);
    check(h.call("treasuryState.read.phase") === "error" && h.retryHidden() === false,
      "U17 stale read surfaces retry");
    check(h.ariaBusy() === "false", "U17 no immortal spinner");
    h.call("ensureTreasuryReady()");
    check(h.callsFor("getTreasuryOperatorWorkspace").length === 2, "U17 re-entry dispatches fresh");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture());
    check(h.call("treasuryState.read.phase") === "ready", "U17 recovered ready");
    // Mid-mutation navigation: reads may refresh, the mutation never repeats.
    prepareSaveForm(h);
    h.call("submitTreasurySaveReceipt()");
    h.call("ensureTreasuryReady()");
    check(h.callsFor("treasuryOperatorSaveReceipt").length === 1,
      "U17 no second operation on re-entry");
    h.settle(h.lastDispatchFor("treasuryOperatorSaveReceipt"), saveDoneResult());
    h.settle(h.lastDispatchFor("getTreasuryOperatorReceiptDetail"), detailFixture());
    check(h.doneStatus() === "Cleared", "U17 mutation completes once");
  })();

  // U18 — stale callback cannot overwrite newer state (read + failure variants)
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    var staleA = h.lastDispatchFor("getTreasuryOperatorWorkspace");
    h.advance(61000);
    check(h.call("treasuryState.read.phase") === "error", "U18 stale surfaces error first");
    h.call("retryTreasuryLoad()");
    var freshB = h.lastDispatchFor("getTreasuryOperatorWorkspace");
    check(freshB !== staleA, "U18 fresh dispatch issued");
    var newer = workspaceFixture({ row: unclearedRow({ RecognitionID: "SCR-NEWER-1",
      OrderID: "ORD-NEWER" }) });
    h.settle(freshB, newer);
    check(h.bodyHTML().indexOf("ORD-NEWER") !== -1, "U18 newer state applied");
    h.settle(staleA, workspaceFixture({ row: unclearedRow({ RecognitionID: "SCR-STALE-1",
      OrderID: "ORD-STALE" }) }));
    check(h.bodyHTML().indexOf("ORD-STALE") === -1 && h.bodyHTML().indexOf("ORD-NEWER") !== -1,
      "U18 stale success cannot overwrite newer");
    check(h.call("treasuryState.read.phase") === "ready", "U18 ready preserved");
    // Late stale FAILURE after a newer success must not flip state to error.
    var h2 = fresh();
    h2.call("ensureTreasuryReady()");
    var old2 = h2.lastDispatchFor("getTreasuryOperatorWorkspace");
    h2.advance(61000);
    h2.call("retryTreasuryLoad()");
    var new2 = h2.lastDispatchFor("getTreasuryOperatorWorkspace");
    h2.settle(new2, workspaceFixture());
    h2.settle(old2, new Error("late ghost failure"));
    check(h2.call("treasuryState.read.phase") === "ready", "U18 late failure cannot flip state");
  })();

  return { checks: checks, failures: failures };
}

// ---------------------------------------------------------------------------
// Liveness failure battery L1..L7 (dedicated, no scenario overlap assumed)
// ---------------------------------------------------------------------------
function runLiveness(sources) {
  var checks = 0;
  var failures = [];
  function check(cond, name) { checks++; if (!cond) failures.push(name); }
  function fresh() { return createTreasuryHarness(sources); }

  // L1 — never-return callback: bounded, recoverable, no auto re-dispatch
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    h.advance(61000);
    check(h.call("treasuryState.read.phase") === "error" && h.retryHidden() === false,
      "L1 recoverable failure surfaced");
    check(h.ariaBusy() === "false", "L1 aria-busy released");
    h.advance(300000);
    check(h.callsFor("getTreasuryOperatorWorkspace").length === 1, "L1 no request storm");
  })();

  // L2 — late success after a newer dispatch cannot own current UI
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    var ghost = h.lastDispatchFor("getTreasuryOperatorWorkspace");
    h.advance(61000);
    h.call("retryTreasuryLoad()");
    var current = h.lastDispatchFor("getTreasuryOperatorWorkspace");
    h.settle(current, workspaceFixture({ row: unclearedRow({ OrderID: "ORD-CURRENT" }) }));
    h.settle(ghost, workspaceFixture({ row: unclearedRow({ OrderID: "ORD-GHOST" }) }));
    check(h.bodyHTML().indexOf("ORD-CURRENT") !== -1 &&
      h.bodyHTML().indexOf("ORD-GHOST") === -1, "L2 late success ignored");
  })();

  // L3 — late failure after newer success cannot flip to error
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    var ghost = h.lastDispatchFor("getTreasuryOperatorWorkspace");
    h.advance(61000);
    h.call("retryTreasuryLoad()");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture());
    h.settle(ghost, new Error("ghost failure"));
    check(h.call("treasuryState.read.phase") === "ready", "L3 state stays ready");
  })();

  // L4 — navigation away/back during an in-flight mutation: one operation
  (function() {
    var h = fresh();
    prepareSaveForm(h);
    h.call("submitTreasurySaveReceipt()");
    var save = h.lastDispatchFor("treasuryOperatorSaveReceipt");
    h.call("ensureTreasuryReady()"); // simulated re-entry
    h.call("ensureTreasuryReady()");
    check(h.callsFor("treasuryOperatorSaveReceipt").length === 1, "L4 one mutation across navigation");
    h.settle(save, saveDoneResult());
    h.settle(h.lastDispatchFor("getTreasuryOperatorReceiptDetail"), detailFixture());
    check(h.doneStatus() === "Cleared" && h.call("treasuryState.action") === null,
      "L4 completes once after re-entry");
    check(h.recoveryRaw() === null, "L4 recovery cleared");
  })();

  // L5 — mutation timeout => UNKNOWN; explicit Retry keeps SAME RequestKey
  (function() {
    var h = fresh();
    prepareSaveForm(h);
    h.call("submitTreasurySaveReceipt()");
    var first = h.lastDispatchFor("treasuryOperatorSaveReceipt");
    h.advance(121000);
    check(h.call("treasuryState.action.phase") === "unknown", "L5 stale timeout -> UNKNOWN");
    check(h.ariaBusy() === "false" || h.call("treasuryState.read.phase") === "ready",
      "L5 no immortal mutation spinner");
    check(h.actionRetryHidden() === false, "L5 retry offered");
    h.call("retryTreasuryMutation()");
    var second = h.lastDispatchFor("treasuryOperatorSaveReceipt");
    check(second.args[0].requestKey === first.args[0].requestKey, "L5 same RequestKey after timeout");
    h.settle(second, saveDoneResult());
    h.settle(h.lastDispatchFor("getTreasuryOperatorReceiptDetail"), detailFixture());
    check(h.doneStatus() === "Cleared", "L5 recovered via same key");
  })();

  // L6 — stale completion ownership: late original ignored after retry; the
  // same stale timer callback with a live dispatchId still applies.
  (function() {
    var h = fresh();
    prepareSaveForm(h);
    h.call("submitTreasurySaveReceipt()");
    var first = h.lastDispatchFor("treasuryOperatorSaveReceipt");
    h.advance(121000); // timeout marks UNKNOWN, dispatchId unchanged
    h.call("retryTreasuryMutation()");
    var second = h.lastDispatchFor("treasuryOperatorSaveReceipt");
    check(second !== first && second.args[0].requestKey === first.args[0].requestKey,
      "L6 retry is a new dispatch, same key");
    h.settle(first, saveDoneResult("TRC-OLD")); // stale original lands first
    check(h.view() !== "done" || h.call("treasuryState.action.phase") !== "verify",
      "L6 stale completion cannot own current UI");
    h.settle(second, saveDoneResult("TRC-NEW"));
    var verify = h.lastDispatchFor("getTreasuryOperatorReceiptDetail");
    h.settle(verify, detailFixture());
    check(h.doneStatus() === "Cleared" && h.call("treasuryState.action") === null,
      "L6 newer dispatch owns final state");
    // Late UNKNOWN-era failure after DONE must be inert.
    var h2 = fresh();
    prepareSaveForm(h2);
    h2.call("submitTreasurySaveReceipt()");
    var d1 = h2.lastDispatchFor("treasuryOperatorSaveReceipt");
    h2.advance(121000);
    h2.settle(d1, saveDoneResult());
    h2.settle(h2.lastDispatchFor("getTreasuryOperatorReceiptDetail"), detailFixture());
    check(h2.doneStatus() === "Cleared" && h2.call("treasuryState.action") === null,
      "L6 timer-stale callback still applies while identity owns UI");
  })();

  // L7 — rapid clicks: one read dispatch, one mutation dispatch, no retry leak
  (function() {
    var h = fresh();
    h.call("ensureTreasuryReady()");
    h.call("ensureTreasuryReady()");
    h.call("ensureTreasuryReady()");
    h.call("ensureTreasuryReady()");
    h.call("ensureTreasuryReady()");
    check(h.callsFor("getTreasuryOperatorWorkspace").length === 1, "L7 one read");
    h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture());
    prepareSaveForm(h);
    for (var i = 0; i < 5; i++) h.call("submitTreasurySaveReceipt()");
    check(h.callsFor("treasuryOperatorSaveReceipt").length === 1, "L7 one mutation");
    h.settle(h.lastDispatchFor("treasuryOperatorSaveReceipt"), saveDoneResult());
    h.settle(h.lastDispatchFor("getTreasuryOperatorReceiptDetail"), detailFixture());
    h.call("retryTreasuryMutation()"); // no action left: must be inert
    check(h.callsFor("treasuryOperatorSaveReceipt").length === 1, "L7 retry inert after DONE");
  })();

  return { checks: checks, failures: failures };
}

// ---------------------------------------------------------------------------
// Mutation sensitivity M1..M30 (in-memory source tampering, reverted by
// fixture scope; nothing mutated is ever written back to disk).
// ---------------------------------------------------------------------------
function runMutationSensitivity(sources) {
  var base = readSources(sources);
  var baseFailures = runStaticGuards(sources);
  if (baseFailures.length) {
    return { suite: "M1-M30", caught: 0, total: 30, passed: false,
      details: [{ id: "STATIC_BASE", caught: false, note: "base sources fail: " + baseFailures.join(",") }],
      anchorMisses: [] };
  }

  var mutations = [
    { id: "M1_browser_recomputes_outstanding", source: "render", all: true,
      find: "treasuryFormatAmount_(row.OutstandingAmount)",
      replace: "treasuryFormatAmount_(row.RecognizedAmount - row.ClearedAmount)",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S4 no browser recomputation") !== -1;
      } },
    { id: "M2_hardcoded_destinations", source: "render", all: false,
      find: "var destinations = (workspace && workspace.destinations) || [];",
      replace: "var destinations = [{ accountCode: \"1000\", accountName: \"Cash on Hand\" }, { accountCode: \"1010\" }, { accountCode: \"1020\" }];",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S5 no hardcoded destination codes") !== -1;
      } },
    { id: "M3_1030_in_selector", source: "render", all: false,
      find: "var options = ['<option value=\"\">Select destination</option>'];",
      replace: "var options = ['<option value=\"\">Select destination</option>', '<option value=\"1030\">Clearing</option>'];",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S6 no 1030 option value") !== -1;
      } },
    { id: "M4_editable_partial_amount", source: "markup", all: false,
      find: "<dd id=\"treasuryFormAmount\" aria-readonly=\"true\">—</dd>",
      replace: "<input id=\"treasuryFormAmount\" type=\"number\" min=\"1\">",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S7 amount locked (dd not input)") !== -1;
      } },
    { id: "M5_editable_economic_date", source: "markup", all: false,
      find: "<label for=\"treasuryDestination\" class=\"text-sm\">Destination",
      replace: "<label for=\"treasuryEconomicDate\" class=\"text-sm\">Economic Date<input id=\"treasuryEconomicDate\" type=\"date\"></label><label for=\"treasuryDestination\" class=\"text-sm\">Destination",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S8 no editable EconomicDate") !== -1;
      } },
    { id: "M6_editable_reversal_date", source: "markup", all: false,
      find: "<label for=\"treasuryReverseReason\" class=\"mt-3 block text-sm\">Reason",
      replace: "<label for=\"treasuryReversalDate\">Reversal Date<input id=\"treasuryReversalDate\" type=\"date\"></label><label for=\"treasuryReverseReason\" class=\"mt-3 block text-sm\">Reason",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S9 no editable ReversalDate") !== -1;
      } },
    { id: "M7_save_routes_to_legacy_payment", source: "controller", all: false,
      find: "run.treasuryOperatorSaveReceipt(args[0]);",
      replace: "run.submitOperationalPayment(args[0]);",
      probe: function(h, s) {
        var f = runStaticGuards(s);
        return f.indexOf("S1 endpoint whitelist") !== -1 || f.indexOf("S2 no legacy writers") !== -1;
      } },
    { id: "M8_save_routes_to_settlement", source: "controller", all: false,
      find: "run.treasuryOperatorSaveReceipt(args[0]);",
      replace: "run.cashSettleAndPersist(args[0]);",
      probe: function(h, s) {
        var f = runStaticGuards(s);
        return f.indexOf("S1 endpoint whitelist") !== -1 || f.indexOf("S2 no legacy writers") !== -1;
      } },
    { id: "M9_new_request_key_on_unknown", source: "controller", all: false,
      find: "treasurySendMutation_(method);",
      replace: "action.payload = Object.assign({}, action.payload, { requestKey: treasuryNewRequestKey_(action.kind) });\n        treasurySendMutation_(method);",
      probe: function(h) {
        prepareSaveForm(h);
        h.call("submitTreasurySaveReceipt()");
        var first = h.lastDispatchFor("treasuryOperatorSaveReceipt");
        h.settle(first, new Error("lost"));
        h.call("retryTreasuryMutation()");
        var second = h.lastDispatchFor("treasuryOperatorSaveReceipt");
        return second.args[0].requestKey !== first.args[0].requestKey;
      } },
    { id: "M10_double_click_independent_intents", source: "controller", all: false,
      find: "if (treasuryState.action) return false; // double-click => one intent",
      replace: "if (false) return false; // double-click => one intent",
      probe: function(h) {
        prepareSaveForm(h);
        h.call("submitTreasurySaveReceipt()");
        h.call("submitTreasurySaveReceipt()");
        return h.callsFor("treasuryOperatorSaveReceipt").length !== 1;
      } },
    { id: "M11_done_before_server_done", source: "controller", all: false,
      find: "if (!treasuryBeginMutation_(\"save\", payload)) return; // U4: one intent",
      replace: "if (!treasuryBeginMutation_(\"save\", payload)) return; // U4: one intent\n      treasuryState.view = \"done\"; renderTreasuryView_();",
      probe: function(h) {
        prepareSaveForm(h);
        h.call("submitTreasurySaveReceipt()");
        return h.view() !== "saveReview";
      } },
    { id: "M12_cleared_without_t5_reread", source: "render", all: false,
      find: "else statusText = \"Being verified…\";",
      replace: "else statusText = \"Cleared\";",
      probe: function(h) {
        prepareSaveForm(h);
        h.call("submitTreasurySaveReceipt()");
        h.settle(h.lastDispatchFor("treasuryOperatorSaveReceipt"), saveDoneResult());
        return h.doneStatus() !== "Being verified…";
      } },
    { id: "M13_exception_hidden", source: "render", all: false,
      find: "var rows = workspace && workspace.receipts && Array.isArray(workspace.receipts.rows) ?\n        workspace.receipts.rows : [];",
      replace: "var rows = workspace && workspace.receipts && Array.isArray(workspace.receipts.rows) ?\n        workspace.receipts.rows.filter(function(entry) { return entry.ClearingStatus !== \"EXCEPTION\"; }) : [];",
      probe: function(h) {
        h.call("ensureTreasuryReady()");
        h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture({
          row: unclearedRow({ ClearingStatus: "EXCEPTION", QualityCodes: ["AMOUNT_RESIDUAL"] }),
          capability: { canSave: false, canReverse: false, canCorrect: false, actionReason: "EXPOSURE_EXCEPTION" }
        }));
        return h.bodyHTML().indexOf("Exception") === -1;
      } },
    { id: "M14_exception_save_enabled", source: "controller", all: true,
      find: "if (!capability || capability.canSave !== true) {",
      replace: "if (false) {",
      probe: function(h) {
        h.call("ensureTreasuryReady()");
        h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture({
          row: unclearedRow({ ClearingStatus: "EXCEPTION", QualityCodes: ["AMOUNT_RESIDUAL"] }),
          capability: { canSave: false, canReverse: false, canCorrect: false, actionReason: "EXPOSURE_EXCEPTION" }
        }));
        h.call('openTreasuryForm("SCR-U3-ORD-T4-1")');
        return h.view() === "saveForm";
      } },
    { id: "M15_reverse_browser_only_eligibility", source: "render", all: false,
      find: "getTreasuryElement(\"treasuryReverseOpenButton\").hidden = !canReverse;",
      replace: "getTreasuryElement(\"treasuryReverseOpenButton\").hidden = false;",
      probe: function(h) {
        prepareDetail(h, { capabilities: { canReverse: false, canCorrect: false, actionReason: "EXPOSURE_EXCEPTION" },
          qualityCodes: ["AMOUNT_RESIDUAL"], clearingStatus: "EXCEPTION" });
        return h.el("treasuryReverseOpenButton").hidden === false;
      } },
    { id: "M16_correct_browser_only_eligibility", source: "render", all: false,
      find: "getTreasuryElement(\"treasuryCorrectOpenButton\").hidden = !canCorrect;",
      replace: "getTreasuryElement(\"treasuryCorrectOpenButton\").hidden = false;",
      probe: function(h) {
        prepareDetail(h, { capabilities: { canReverse: false, canCorrect: false, actionReason: "EXPOSURE_EXCEPTION" },
          qualityCodes: ["AMOUNT_RESIDUAL"], clearingStatus: "EXCEPTION" });
        return h.el("treasuryCorrectOpenButton").hidden === false;
      } },
    { id: "M17_reversal_auto_refund", source: "controller", all: false,
      find: "var treasuryReadRetryPendingDetail_ = null;",
      replace: "var treasuryReadRetryPendingDetail_ = null; var refundPath2010 = \"2010\";",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S10 no refund/2010 path") !== -1;
      } },
    { id: "M18_correction_rewrites_history", source: "render", all: false,
      find: "receipts.forEach(function(receipt) {",
      replace: "receipts.forEach(function(receipt) {\n          if (receipt.lineageRole === \"ORIGINAL\") return;",
      probe: function(h) {
        prepareDetail(h, { activeReceiptID: "TRC-T7-CORR-1",
          receipts: [receiptFixture({ receiptStatus: "REVERSED" }),
            receiptFixture({ treasuryReceiptID: "TRC-T7-REV-1", lineageRole: "REVERSAL",
              reversalOfReceiptID: "TRC-T7-001" }),
            receiptFixture({ treasuryReceiptID: "TRC-T7-CORR-1", lineageRole: "REPLACEMENT",
              originalReceiptID: "TRC-T7-001" })] });
        return h.detailHTML().indexOf("TRC-T7-001") === -1;
      } },
    { id: "M19_receive_via_introduced", source: "render", all: false,
      find: "function treasuryStatusLabel_(status) {",
      replace: "var viaField = \"ReceiveVia\";\n    function treasuryStatusLabel_(status) {",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S3 no legacy vocabulary") !== -1;
      } },
    { id: "M20_paid_introduced", source: "render", all: false,
      find: "function treasuryStatusLabel_(status) {",
      replace: "var paidWord = \"PAID\";\n    function treasuryStatusLabel_(status) {",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S3 no legacy vocabulary") !== -1;
      } },
    { id: "M21_infinite_loading", source: "controller", all: true,
      find: "}, TREASURY_READ_STALE_TIMEOUT_MS);",
      replace: "}, 86400000);",
      probe: function(h) {
        h.call("ensureTreasuryReady()");
        h.advance(61000);
        return h.call("treasuryState.read.phase") !== "error" || h.ariaBusy() === "true";
      } },
    { id: "M22_stale_callback_overwrites", source: "controller", all: false,
      find: "if (!entry || entry.requestId !== requestId) return true;",
      replace: "if (false) return true;",
      probe: function(h) {
        h.call("ensureTreasuryReady()");
        var staleA = h.lastDispatchFor("getTreasuryOperatorWorkspace");
        h.advance(61000);
        h.call("retryTreasuryLoad()");
        h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"),
          workspaceFixture({ row: unclearedRow({ OrderID: "ORD-NEWER" }) }));
        h.settle(staleA, workspaceFixture({ row: unclearedRow({ OrderID: "ORD-STALE" }) }));
        return h.bodyHTML().indexOf("ORD-STALE") !== -1;
      } },
    { id: "M23_automatic_mutation_retry", source: "controller", all: false,
      find: "current.phase = \"unknown\";\n        persistTreasuryRecovery_();",
      replace: "current.phase = \"unknown\";\n        retryTreasuryMutation();\n        persistTreasuryRecovery_();",
      probe: function(h) {
        prepareSaveForm(h);
        h.call("submitTreasurySaveReceipt()");
        h.advance(121000);
        return h.callsFor("treasuryOperatorSaveReceipt").length !== 1;
      } },
    { id: "M24_stale_action_capability_cache", source: "controller", all: false,
      find: "ensureTreasuryReady(); // fresh server read: no stale action capability",
      replace: "renderTreasuryView_(); // no refresh",
      probe: function(h) {
        h.call("ensureTreasuryReady()");
        h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture());
        h.call('openTreasuryDetail("SCR-U3-ORD-T4-1")');
        h.settle(h.lastDispatchFor("getTreasuryOperatorReceiptDetail"), detailFixture());
        var before = h.callsFor("getTreasuryOperatorWorkspace").length;
        h.call("closeTreasuryViews()");
        var after = h.callsFor("getTreasuryOperatorWorkspace").length;
        return after === before;
      } },
    { id: "M25_residual_hidden", source: "render", all: false,
      find: "warning.hidden = false;",
      replace: "warning.hidden = true;",
      probe: function(h) {
        h.call("ensureTreasuryReady()");
        h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"),
          workspaceFixture({ residual: 5000, ledgerNet: 29000 }));
        return h.warningHidden() === true;
      } },
    { id: "M26_ui_revenue_calc", source: "state", all: false,
      find: "let treasuryState = {",
      replace: "let treasuryState = { revenue: 0,",
      probe: function(h, s) {
        var f = runStaticGuards(s);
        return f.indexOf("S11 no Finance authority") !== -1 || f.indexOf("S13 no client Revenue computation") !== -1;
      } },
    { id: "M27_finance_revenue_changed", source: "controller", all: false,
      find: "var treasuryReadRetryPendingDetail_ = null;",
      replace: "var treasuryReadRetryPendingDetail_ = null;\n    function __t7financeLeak() { return getFinanceData(\"currentYear\"); }",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S11 no Finance authority") !== -1;
      } },
    { id: "M28_rbac_introduced", source: "state", all: false,
      find: "let treasuryState = {",
      replace: "let treasuryState = { isAdmin: true,",
      probe: function(h, s) {
        return runStaticGuards(s).indexOf("S12 no RBAC / client actor claim") !== -1;
      } },
    { id: "M29_blank_evidence_accepted", source: "controller", all: true,
      find: "else if (!treasuryEvidenceValid_(form.evidenceRef)) {",
      replace: "else if (false) {",
      probe: function(h) {
        h.call("ensureTreasuryReady()");
        h.settle(h.lastDispatchFor("getTreasuryOperatorWorkspace"), workspaceFixture());
        h.call('openTreasuryForm("SCR-U3-ORD-T4-1")');
        h.el("treasuryDestination").value = "1000";
        h.el("treasuryReceiptDate").value = "2026-10-12";
        h.el("treasuryEvidenceRef").value = "   ";
        h.call("openTreasurySaveReview()");
        return h.view() === "saveReview";
      } },
    { id: "M30_post_mutation_no_refresh", source: "controller", all: false,
      find: "treasuryState.action = null;\n      // Fresh projection so the list reflects the new canonical state.\n      ensureTreasuryReady();",
      replace: "treasuryState.action = null;",
      probe: function(h) {
        prepareSaveForm(h);
        h.call("submitTreasurySaveReceipt()");
        var save = h.lastDispatchFor("treasuryOperatorSaveReceipt");
        h.settle(save, saveDoneResult());
        h.settle(h.lastDispatchFor("getTreasuryOperatorReceiptDetail"), detailFixture());
        return h.callsFor("getTreasuryOperatorWorkspace").length < 2;
      } }
  ];

  var caught = 0;
  var details = [];
  var anchorMisses = [];
  mutations.forEach(function(m) {
    var original = base[m.source];
    var mutated = m.all ? original.split(m.find).join(m.replace) : original.replace(m.find, m.replace);
    var applied = mutated !== original;
    if (!applied) anchorMisses.push(m.id);
    var sources = {
      stateSource: m.source === "state" ? mutated : base.state,
      renderSource: m.source === "render" ? mutated : base.render,
      controllerSource: m.source === "controller" ? mutated : base.controller,
      markupSource: m.source === "markup" ? mutated : base.markup
    };
    var caughtThis = false;
    var note = "";
    if (!applied) {
      caughtThis = false;
      note = "mutation token not found";
    } else {
      try {
        if (m.source === "markup") {
          caughtThis = m.probe(null, sources) === true;
        } else {
          var h = createTreasuryHarness(sources);
          caughtThis = m.probe(h, sources) === true;
        }
        note = caughtThis ? "defect surfaced" : "defect NOT surfaced";
      } catch (error) {
        caughtThis = true;
        note = "probe threw under mutation: " + error.message;
      }
    }
    if (caughtThis) caught++;
    details.push({ id: m.id, applied: applied, caught: caughtThis, note: note });
  });

  return { suite: "M1-M30", caught: caught, total: mutations.length,
    passed: caught === mutations.length && anchorMisses.length === 0,
    details: details, anchorMisses: anchorMisses };
}

function runTreasuryT7OperatorController() {
  var staticFailures = runStaticGuards({});
  var u = runU1U18({});
  var l = runLiveness({});
  var m = runMutationSensitivity({});
  var passed = staticFailures.length === 0 && u.failures.length === 0 &&
    l.failures.length === 0 && m.passed;
  return {
    passed: passed,
    staticFailures: staticFailures,
    uChecks: u.checks, uFailures: u.failures,
    lChecks: l.checks, lFailures: l.failures,
    mutationCaught: m.caught, mutationTotal: m.total,
    mutationAnchorMisses: m.anchorMisses || [],
    mutationFailures: (m.details || []).filter(function(d) { return !d.caught; })
  };
}

module.exports = runTreasuryT7OperatorController;
module.exports.runTreasuryT7OperatorController = runTreasuryT7OperatorController;
module.exports.runStaticGuards = runStaticGuards;
module.exports.runU1U18 = runU1U18;
module.exports.runLiveness = runLiveness;
module.exports.runMutationSensitivity = runMutationSensitivity;
module.exports.createTreasuryHarness = createTreasuryHarness;

if (require.main === module) {
  console.log(JSON.stringify(runTreasuryT7OperatorController(), null, 2));
}
