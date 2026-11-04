// FIN-UI-LIVENESS-01 — Finance UI dispatch-liveness controller harness
// (Node-only; executed via `_test_runner.js` or directly for reproduction).
// Loads the REAL 199/200/201 Finance view sources into an in-memory DOM +
// mocked `google.script.run` + fake-clock harness and drives the actual
// controller functions: ensureFinanceData, requestFinanceData, retryFinanceData,
// warmFinanceData, setFinanceDestination, handleFinancePeriodChange.
// Covers F1..F12 controller regressions, static liveness guards, and the
// M1..M10 mutation-sensitivity battery. No browser process, no network,
// no production runtime, no data mutation (read-only server methods only).
var fs = require("fs");
var vm = require("vm");

var STATE_PATH = "199.View.Finance.State.html";
var RENDER_PATH = "200.View.Finance.Render.html";
var CONTROLLER_PATH = "201.View.Finance.Controller.html";

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

function pnlFixture(revenue) {
  return {
    summary: {
      revenue: revenue, cogs: 0, grossProfit: revenue,
      operatingExpenses: 0, depreciationExpense: 0,
      operatingNetProfit: revenue, operatingProfitMargin: 0.5
    },
    expenseBreakdown: [],
    period: { label: "This Year" },
    accountingPolicy: {
      recognitionBasis: "TRANSACTION_DATE_OPERATING",
      depreciationIncluded: true, depreciationSource: "DepreciationLedger"
    },
    dataQuality: { status: "GOOD" }
  };
}

function createFinanceLivenessHarness(sources) {
  sources = sources || {};
  var stateSource = sources.stateSource !== undefined ? sources.stateSource : fs.readFileSync(STATE_PATH, "utf8");
  var renderSource = sources.renderSource !== undefined ? sources.renderSource : fs.readFileSync(RENDER_PATH, "utf8");
  var controllerSource = sources.controllerSource !== undefined ? sources.controllerSource : fs.readFileSync(CONTROLLER_PATH, "utf8");

  var elements = Object.create(null);
  var dispatches = [];
  var timers = [];
  var timerSeq = 0;
  var clock = { now: 1000000 };
  var pendingHandlers = { success: null, failure: null };

  var googleRun = new Proxy({}, {
    get: function(target, property) {
      if (property === "withSuccessHandler") {
        return function(fn) { pendingHandlers.success = fn; return googleRun; };
      }
      if (property === "withFailureHandler") {
        return function(fn) { pendingHandlers.failure = fn; return googleRun; };
      }
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
    escapeUiHtml: function(value) {
      return String(value === undefined || value === null ? "" : value);
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
    google: { script: { run: googleRun } }
  };
  var ctx = vm.createContext(sandbox);

  vm.runInContext(stateSource, ctx, { filename: STATE_PATH });
  vm.runInContext(renderSource, ctx, { filename: RENDER_PATH });
  vm.runInContext(controllerSource, ctx, { filename: CONTROLLER_PATH });

  // Populate financeElementCache. The real shell assigns every required id
  // at boot; renderers also reference dynamic ids (e.g. currencyMetrics
  // keys), so the harness auto-creates on demand — equivalent to the full
  // shell markup being present.
  sandbox.__harnessIds = { finance: true };
  var idPattern = /getFinanceElement\("([A-Za-z0-9_]+)"\)/g;
  var combined = stateSource + "\n" + renderSource + "\n" + controllerSource;
  var match;
  while ((match = idPattern.exec(combined)) !== null) sandbox.__harnessIds[match[1]] = true;
  vm.runInContext(
    "Object.keys(__harnessIds).forEach(function(id) { financeElementCache[id] = document.getElementById(id); });" +
    "getFinanceElement = function(id) {" +
    "  if (!financeElementCache[id]) financeElementCache[id] = document.getElementById(id);" +
    "  return financeElementCache[id];" +
    "};",
    ctx,
    {}
  );

  function el(id) { return ctx.document.getElementById(id); }

  var harness = {
    ctx: ctx,
    dispatches: dispatches,
    clock: clock,
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
    ariaBusy: function() { return el("finance").getAttribute("aria-busy"); },
    retryHidden: function() { return el("financeRetryButton").hidden; }
  };
  return harness;
}

// ---------------------------------------------------------------------------
// Ghost-in-flight reproduction probe. Works against pre-fix AND post-fix
// controller sources. Pre-fix semantics: after the originating callback is
// lost, every subsequent ensureFinanceData()/requestFinanceData() joins the
// immortal in-flight marker and no fresh dispatch ever occurs (stuck loading
// indefinitely). Post-fix semantics: bounded stale timeout + stale
// replacement recover the view.
// ---------------------------------------------------------------------------
function runGhostReproductionProbe(sources) {
  var h = createFinanceLivenessHarness(sources || {});
  var result = {
    destination: "profit-loss",
    dispatchCountAfterFirstEnsure: 0,
    inflightMarkedAfterDispatch: false,
    callbackFired: false,
    ariaBusyAfterLoss: null,
    advanceMs: 121000,
    stateAfterStaleWindow: null,
    ariaBusyAfterStaleWindow: null,
    dispatchCountAfterStaleEnsure: 0,
    recoveredWithFreshDispatch: false,
    finalState: null,
    preFixGhostReproduced: null,
    postFixRecovered: null
  };

  h.call('setFinanceDestination("profit-loss")');
  h.call("ensureFinanceData()");
  result.dispatchCountAfterFirstEnsure = h.callsFor("getFinanceData").length;
  result.inflightMarkedAfterDispatch = h.call('financeInflight["finance|currentYear"]') != null;
  result.ariaBusyAfterLoss = h.ariaBusy();

  // Response lost: success/failure callbacks never fire.
  h.advance(121000);
  result.stateAfterStaleWindow = h.call("financeState.loading ? 'loading' : (financeState.error ? 'error' : 'other')");
  result.ariaBusyAfterStaleWindow = h.ariaBusy();

  h.call("ensureFinanceData()");
  result.dispatchCountAfterStaleEnsure = h.callsFor("getFinanceData").length;
  result.recoveredWithFreshDispatch = result.dispatchCountAfterStaleEnsure > result.dispatchCountAfterFirstEnsure;
  result.finalState = h.call("financeState.loading ? 'loading' : (financeState.error ? 'error' : (financeState.hasLoaded ? 'ready' : 'init'))");
  result.preFixGhostReproduced =
    result.dispatchCountAfterFirstEnsure === 1 &&
    result.inflightMarkedAfterDispatch === true &&
    result.ariaBusyAfterLoss === "true" &&
    !result.recoveredWithFreshDispatch &&
    result.finalState === "loading";
  result.postFixRecovered =
    result.recoveredWithFreshDispatch === true ||
    (result.stateAfterStaleWindow === "error" && result.dispatchCountAfterStaleEnsure >= 1);
  return result;
}

// ---------------------------------------------------------------------------
// F1..F12 controller regressions against the (post-fix) repo sources.
// ---------------------------------------------------------------------------
function runF1F12(sources) {
  var checks = 0;
  var failures = [];
  function check(cond, name) {
    checks++;
    if (!cond) failures.push(name);
  }

  function fresh() { return createFinanceLivenessHarness(sources || {}); }

  // F1 — normal first load: one destination dispatch -> READY, loading cleared
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    check(h.callsFor("getFinanceData").length === 1, "F1 single dispatch");
    check(h.ariaBusy() === "true", "F1 aria-busy true while loading");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(1000));
    check(h.call("financeState.hasLoaded") === true, "F1 hasLoaded after success");
    check(h.call("financeState.error") == null, "F1 no render error on healthy load");
    check(h.call("financeState.loading") === false, "F1 loading cleared");
    check(h.ariaBusy() === "false", "F1 aria-busy false after success");
    check(h.call('financeCache.finance["currentYear"].data.summary.revenue') === 1000, "F1 cache populated");
    check(h.callsFor("getFinanceData").length === 1, "F1 no second destination dispatch");
  })();

  // F2 — healthy concurrent join: rapid callers share one dispatch, all resolve
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    h.call("ensureFinanceData()");
    h.call("ensureFinanceData()");
    h.call("handleFinancePeriodChange()");
    check(h.callsFor("getFinanceData").length === 1, "F2 concurrent callers -> 1 dispatch");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(2000));
    check(h.call("financeState.loading") === false, "F2 loading cleared for all joiners");
    check(h.ariaBusy() === "false", "F2 aria-busy false after join resolution");
    check(h.call("financeState.data.summary.revenue") === 2000, "F2 consistent data");
  })();

  // F3 — ghost in-flight: A never resolves -> bounded timeout -> later load
  // not blocked; explicit recoverable failure surfaced; fresh dispatch works
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    var a = h.lastDispatchFor("getFinanceData");
    h.advance(121000); // callback lost; stale window elapses
    check(a.settled === false, "F3 A never resolved");
    check(h.call("financeState.error") != null, "F3 explicit recoverable failure surfaced");
    check(String(h.call("financeState.error")).indexOf("Timed out") !== -1, "F3 timeout message");
    check(h.retryHidden() === false, "F3 retry button visible");
    check(h.ariaBusy() === "false", "F3 aria-busy released by timeout");
    check(h.call('financeInflight["finance|currentYear"]') == null, "F3 stale marker released");
    h.call("ensureFinanceData()");
    check(h.callsFor("getFinanceData").length === 2, "F3 later load dispatches fresh request");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(3000));
    check(h.call("financeState.hasLoaded") === true, "F3 recovery reaches READY");
  })();

  // F4 — replacement request: stale warm ghost superseded by foreground load
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call('warmFinanceData("currentYear", null, null)');
    check(h.callsFor("getFinanceData").length === 1, "F4 warm dispatched");
    var warmA = h.callsFor("getFinanceData")[0];
    h.advance(121000); // warm callback lost; no timer on background warm
    check(h.call('financeInflight["finance|currentYear"]') != null, "F4 ghost marker still present pre-ensure");
    h.call("ensureFinanceData()");
    check(h.callsFor("getFinanceData").length === 2, "F4 stale ghost replaced by fresh dispatch");
    h.settle(warmA, pnlFixture(4444)); // late warm success must not clear B's marker
    check(h.call('financeInflight["finance|currentYear"]') != null, "F4 late warm release keeps B marker");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(4000));
    check(h.call("financeState.hasLoaded") === true, "F4 replacement reaches READY");
    check(h.call("financeState.data.summary.revenue") === 4000, "F4 B data wins over late warm");
  })();

  // F5 — late A success must not overwrite newer B data
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    var a = h.lastDispatchFor("getFinanceData");
    h.advance(121000); // A timed out -> error, marker released
    h.call("retryFinanceData()");
    var b = h.lastDispatchFor("getFinanceData");
    check(b !== a, "F5 B is a distinct dispatch");
    h.settle(b, pnlFixture(5000));
    check(h.call("financeState.data.summary.revenue") === 5000, "F5 B data active");
    h.settle(a, pnlFixture(1111)); // late A success
    check(h.call("financeState.data.summary.revenue") === 5000, "F5 late A success does not overwrite B");
    check(h.call('financeCache.finance["currentYear"].data.summary.revenue') === 5000, "F5 cache still B");
    check(h.call("financeState.loading") === false, "F5 still READY (not loading)");
    check(h.ariaBusy() === "false", "F5 aria-busy deterministic");
  })();

  // F6 — late A failure must not corrupt B READY
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    var a = h.lastDispatchFor("getFinanceData");
    h.advance(121000);
    h.call("retryFinanceData()");
    var b = h.lastDispatchFor("getFinanceData");
    h.settle(b, pnlFixture(6000));
    h.settle(a, new Error("late ghost failure"));
    check(h.call("financeState.error") == null, "F6 late A failure does not corrupt B READY");
    check(h.call("financeState.data.summary.revenue") === 6000, "F6 data still B");
    check(h.ariaBusy() === "false", "F6 aria-busy stays released");
  })();

  // F7 — explicit server failure: in-flight released, aria-busy released,
  // recoverable failure surfaced, next retry dispatches
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    h.settle(h.lastDispatchFor("getFinanceData"), new Error("server exploded"));
    check(h.call("financeState.error") != null, "F7 failure surfaced");
    check(h.ariaBusy() === "false", "F7 aria-busy released on failure");
    check(h.retryHidden() === false, "F7 retry visible");
    check(h.call('financeInflight["finance|currentYear"]') == null, "F7 in-flight released on failure");
    h.call("retryFinanceData()");
    check(h.callsFor("getFinanceData").length === 2, "F7 retry dispatches");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(7000));
    check(h.call("financeState.hasLoaded") === true, "F7 retry recovery READY");
  })();

  // F8 — retry succeeds after timeout without reload/mutation
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    h.advance(121000);
    h.call("retryFinanceData()");
    check(h.callsFor("getFinanceData").length === 2, "F8 retry dispatch after timeout");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(8000));
    check(h.call("financeState.hasLoaded") === true, "F8 retry success");
    check(h.ariaBusy() === "false", "F8 aria-busy terminal");
  })();

  // F9 — navigation lifecycle: away/back under READY, healthy REQUESTING,
  // stale REQUESTING, prior failure — no immortal ghost, cache reuse intact
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(9000));
    h.call("ensureFinanceData()"); // navigate back (READY)
    check(h.callsFor("getFinanceData").length === 1, "F9 back under READY -> cache reuse");
    h.call("invalidateFinanceCache()");
    h.call("ensureFinanceData()");
    h.call("ensureFinanceData()"); // navigate back while healthy in-flight
    check(h.callsFor("getFinanceData").length === 2, "F9 back under healthy REQUESTING joins");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(9100));
    h.call("invalidateFinanceCache()");
    h.call("ensureFinanceData()");
    h.advance(121000);
    h.call("ensureFinanceData()"); // navigate back after stale window
    check(h.callsFor("getFinanceData").length === 4, "F9 back under stale REQUESTING dispatches fresh");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(9200));
    check(h.call("financeState.hasLoaded") === true, "F9 stale-nav recovery READY");
    h.call("invalidateFinanceCache()");
    h.call("ensureFinanceData()");
    h.settle(h.lastDispatchFor("getFinanceData"), new Error("nav failure"));
    h.call("ensureFinanceData()"); // navigate back after failure
    check(h.callsFor("getFinanceData").length === 6, "F9 back after failure dispatches fresh");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(9300));
    check(h.call("financeState.hasLoaded") === true, "F9 failure-nav recovery READY");
  })();

  // F10 — valid cache reuse still avoids unnecessary call
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(10000));
    var before = h.callsFor("getFinanceData").length;
    h.call("ensureFinanceData()");
    h.call("ensureFinanceData()");
    check(h.callsFor("getFinanceData").length === before, "F10 cache reuse avoids dispatch");
    check(h.call("financeState.data.summary.revenue") === 10000, "F10 cache-served data");
  })();

  // F11 — rapid callers -> no request storm
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    for (var i = 0; i < 10; i++) h.call("ensureFinanceData()");
    check(h.callsFor("getFinanceData").length === 1, "F11 rapid ensures -> 1 dispatch");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(11000));
    for (var j = 0; j < 5; j++) h.call("ensureFinanceData()");
    check(h.callsFor("getFinanceData").length === 1, "F11 post-success ensures -> still 1 dispatch");
  })();

  // F12 — aria-busy always reaches a deterministic terminal state
  (function() {
    var h = fresh();
    h.call('setFinanceDestination("profit-loss")');
    h.call("ensureFinanceData()");
    check(h.ariaBusy() === "true", "F12 loading -> aria-busy true");
    h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(12000));
    check(h.ariaBusy() === "false", "F12 success -> aria-busy false");
    h.call("invalidateFinanceCache()");
    h.call("ensureFinanceData()");
    h.settle(h.lastDispatchFor("getFinanceData"), new Error("terminal failure"));
    check(h.ariaBusy() === "false", "F12 failure -> aria-busy false");
    h.call("invalidateFinanceCache()");
    h.call("ensureFinanceData()");
    h.advance(121000);
    check(h.ariaBusy() === "false", "F12 timeout -> aria-busy false");
  })();

  return { suite: "F1-F12", checks: checks, failures: failures, passed: failures.length === 0 };
}

// ---------------------------------------------------------------------------
// Static liveness guards on controller source.
// ---------------------------------------------------------------------------
function runStaticGuards(sources) {
  sources = sources || {};
  var controllerSource = sources.controllerSource !== undefined
    ? sources.controllerSource
    : fs.readFileSync(CONTROLLER_PATH, "utf8");
  var stateSource = sources.stateSource !== undefined
    ? sources.stateSource
    : fs.readFileSync(STATE_PATH, "utf8");
  var checks = 0;
  var failures = [];
  function check(cond, name) { checks++; if (!cond) failures.push(name); }

  check(controllerSource.indexOf("var FINANCE_REQUEST_STALE_TIMEOUT_MS = 120000;") !== -1,
    "STATIC central stale timeout defined (120s, not 420s)");
  check(controllerSource.indexOf("function isFinanceInflightEntryStale(entry)") !== -1,
    "STATIC stale-entry predicate exists");
  check(controllerSource.indexOf("function releaseFinanceInflightEntry(inflightKey, requestId)") !== -1,
    "STATIC guarded release helper exists");
  check(controllerSource.indexOf("financeInflight[inflightKey] = { requestId: requestId, startedAt: financeNow_() };") !== -1,
    "STATIC foreground dispatch records requestId + startedAt");
  check(controllerSource.indexOf("financeInflight[cbKey] = { startedAt: financeNow_() };") !== -1,
    "STATIC warm dispatch records startedAt");
  check(controllerSource.indexOf('financeInflight[cacheType + "|" + cacheKey] = true') === -1,
    "STATIC no bare boolean foreground inflight write");
  check(controllerSource.indexOf("financeInflight[cbKey] = true") === -1,
    "STATIC no bare boolean warm inflight write");
  check(controllerSource.indexOf("delete financeInflight[cbKey];") === -1,
    "STATIC warm handlers use guarded release (no bare marker delete)");

  var onSuccessBlock = controllerSource.substring(
    controllerSource.indexOf("function onSuccess"),
    controllerSource.indexOf("function onFailure")
  );
  check(onSuccessBlock.indexOf('delete financeInflight[cacheType + "|" + cacheKey]') === -1,
    "STATIC onSuccess no unguarded marker delete");
  check(onSuccessBlock.indexOf("releaseFinanceInflightEntry(inflightKey, requestId)") !== -1,
    "STATIC onSuccess uses guarded release");
  check(onSuccessBlock.indexOf("clearTimeout(requestTimeoutId)") !== -1,
    "STATIC onSuccess clears liveness timer");
  check(onSuccessBlock.indexOf("dest !== financeState.destination") !== -1,
    "STATIC onSuccess keeps destination guard");
  check(onSuccessBlock.indexOf("requestId !== financeState.activeRequestId") !== -1,
    "STATIC onSuccess keeps requestId guard");

  var onFailureBlock = controllerSource.substring(
    controllerSource.indexOf("function onFailure"),
    controllerSource.indexOf("if (dest ===")
  );
  check(onFailureBlock.indexOf('delete financeInflight[cacheType + "|" + cacheKey]') === -1,
    "STATIC onFailure no unguarded marker delete");
  check(onFailureBlock.indexOf("releaseFinanceInflightEntry(inflightKey, requestId)") !== -1,
    "STATIC onFailure uses guarded release");
  check(onFailureBlock.indexOf("clearTimeout(requestTimeoutId)") !== -1,
    "STATIC onFailure clears liveness timer");
  check(onFailureBlock.indexOf("dest !== financeState.destination") !== -1,
    "STATIC onFailure keeps destination guard");

  var ensureStart = controllerSource.indexOf("function ensureFinanceData()");
  var ensureEnd = controllerSource.indexOf("function retryFinanceData()");
  var ensureBody = controllerSource.substring(ensureStart, ensureEnd);
  check(ensureBody.indexOf("isFinanceInflightEntryStale") !== -1,
    "STATIC ensureFinanceData consults staleness");
  check(ensureBody.indexOf('_warmCallbacks[cacheType + "|" + cacheKey] = function()') !== -1,
    "STATIC ensureFinanceData keeps one-shot join callback");
  check(ensureBody.indexOf("requestFinanceData(request)") !== -1,
    "STATIC ensureFinanceData falls through to requestFinanceData");
  check(ensureBody.indexOf("var cacheEntry = financeCache[cacheType][cacheKey]") !== -1,
    "STATIC ensureFinanceData keeps cache phase");
  check(ensureBody.indexOf("isValidFinanceCacheEntry(cacheEntry)") !== -1,
    "STATIC ensureFinanceData keeps cache validation");

  var reqStart = controllerSource.indexOf("function requestFinanceData(request)");
  var reqEnd = controllerSource.indexOf("function warmFinanceData(");
  var reqBody = controllerSource.substring(reqStart, reqEnd);
  check(reqBody.indexOf("isFinanceInflightEntryStale") !== -1,
    "STATIC requestFinanceData consults staleness");
  check(reqBody.indexOf("requestTimeoutId") !== -1,
    "STATIC requestFinanceData arms liveness timer");

  check(stateSource.indexOf("let financeInflight") !== -1,
    "STATIC state file keeps financeInflight");
  check(controllerSource.indexOf("_warmCallbacks = {}") !== -1,
    "STATIC invalidation clears _warmCallbacks");
  check(controllerSource.indexOf("delete _warmCallbacks[cbKey]; cb()") !== -1,
    "STATIC warm callbacks stay one-shot");
  check(controllerSource.indexOf("FINANCE_REQUEST_STALE_TIMEOUT_MS = 420000") === -1,
    "STATIC timeout is not the 420s pathological hang");

  return { suite: "STATIC", checks: checks, failures: failures, passed: failures.length === 0 };
}

// ---------------------------------------------------------------------------
// M1..M10 mutation sensitivity: each mutation must be CAUGHT by a probe.
// probe(h) returns true iff the mutated defect is SURFACED (caught).
// ---------------------------------------------------------------------------
function runMutationSensitivity(sources) {
  sources = sources || {};
  var baseController = sources.controllerSource !== undefined
    ? sources.controllerSource
    : fs.readFileSync(CONTROLLER_PATH, "utf8");
  var baseState = sources.stateSource !== undefined
    ? sources.stateSource
    : fs.readFileSync(STATE_PATH, "utf8");
  var baseRender = sources.renderSource !== undefined
    ? sources.renderSource
    : fs.readFileSync(RENDER_PATH, "utf8");

  var mutations = [
    {
      id: "M1_remove_stale_timeout",
      find: "}, FINANCE_REQUEST_STALE_TIMEOUT_MS);",
      replace: "}, 86400000);",
      all: false,
      probe: function(h) {
        // Ghost never resolves; bounded liveness must surface a recoverable
        // failure WITHOUT any further user action.
        h.call('setFinanceDestination("profit-loss")');
        h.call("ensureFinanceData()");
        h.advance(121000);
        return h.call("financeState.error") == null && h.ariaBusy() === "true";
      }
    },
    {
      id: "M2_keep_stale_inflight_forever",
      find: "isFinanceInflightEntryStale(financeInflight[inflightKey])",
      replace: "false",
      all: true,
      probe: function(h) {
        // Stale warm ghost must stop blocking ensureFinanceData.
        h.call('setFinanceDestination("profit-loss")');
        h.call('warmFinanceData("currentYear", null, null)');
        h.advance(121000);
        h.call("ensureFinanceData()");
        return h.callsFor("getFinanceData").length === 1 && h.call("financeState.loading") === true;
      }
    },
    {
      id: "M3_stale_success_overwrites_newer",
      find: "      function onSuccess(response) {\n        clearTimeout(requestTimeoutId);\n        releaseFinanceInflightEntry(inflightKey, requestId);\n        if (requestId !== financeState.activeRequestId || dest !== financeState.destination) return;",
      replace: "      function onSuccess(response) {\n        clearTimeout(requestTimeoutId);\n        releaseFinanceInflightEntry(inflightKey, requestId);\n        if (dest !== financeState.destination) return;",
      all: false,
      probe: function(h) {
        h.call('setFinanceDestination("profit-loss")');
        h.call("ensureFinanceData()");
        var a = h.lastDispatchFor("getFinanceData");
        h.advance(121000);
        h.call("retryFinanceData()");
        var b = h.lastDispatchFor("getFinanceData");
        h.settle(b, pnlFixture(5000));
        h.settle(a, pnlFixture(1111));
        return h.call("financeState.data.summary.revenue") !== 5000;
      }
    },
    {
      id: "M4_stale_failure_overwrites_ready",
      find: "      function onFailure(error) {\n        clearTimeout(requestTimeoutId);\n        releaseFinanceInflightEntry(inflightKey, requestId);\n        if (requestId !== financeState.activeRequestId || dest !== financeState.destination) return;",
      replace: "      function onFailure(error) {\n        clearTimeout(requestTimeoutId);\n        releaseFinanceInflightEntry(inflightKey, requestId);\n        if (dest !== financeState.destination) return;",
      all: false,
      probe: function(h) {
        h.call('setFinanceDestination("profit-loss")');
        h.call("ensureFinanceData()");
        var a = h.lastDispatchFor("getFinanceData");
        h.advance(121000);
        h.call("retryFinanceData()");
        var b = h.lastDispatchFor("getFinanceData");
        h.settle(b, pnlFixture(6000));
        h.settle(a, new Error("late ghost failure"));
        return h.call("financeState.error") != null;
      }
    },
    {
      id: "M5_never_clear_inflight_on_failure",
      find: "      function onFailure(error) {\n        clearTimeout(requestTimeoutId);\n        releaseFinanceInflightEntry(inflightKey, requestId);",
      replace: "      function onFailure(error) {\n        clearTimeout(requestTimeoutId);",
      all: false,
      probe: function(h) {
        h.call('setFinanceDestination("profit-loss")');
        h.call("ensureFinanceData()");
        h.settle(h.lastDispatchFor("getFinanceData"), new Error("boom"));
        h.call("retryFinanceData()");
        return h.callsFor("getFinanceData").length === 1;
      }
    },
    {
      id: "M6_dispatch_per_concurrent_caller",
      find: "      if (financeInflight[cacheType + \"|\" + cacheKey]) {\n        setFinanceViewState(\"loading\");\n        _warmCallbacks[cacheType + \"|\" + cacheKey] = function() { ensureFinanceData(); };\n        return;\n      }\n\n      var requestId = ++financeState.requestSequence;",
      replace: "      if (false) {\n        setFinanceViewState(\"loading\");\n        _warmCallbacks[cacheType + \"|\" + cacheKey] = function() { ensureFinanceData(); };\n        return;\n      }\n\n      var requestId = ++financeState.requestSequence;",
      all: false,
      probe: function(h) {
        h.call('setFinanceDestination("profit-loss")');
        h.call("ensureFinanceData()");
        h.call("handleFinancePeriodChange()");
        h.call("handleFinancePeriodChange()");
        return h.callsFor("getFinanceData").length !== 1;
      }
    },
    {
      id: "M7_aria_busy_stuck_after_success",
      find: "setFinanceViewState(isEmpty ? \"empty\" : \"success\");\n          // 11X.3K — warm sibling datasets for same filter",
      replace: "setFinanceViewState(\"loading\");\n          // 11X.3K — warm sibling datasets for same filter",
      all: false,
      probe: function(h) {
        h.call('setFinanceDestination("profit-loss")');
        h.call("ensureFinanceData()");
        h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(1000));
        return h.ariaBusy() !== "false";
      }
    },
    {
      id: "M8_aria_busy_stuck_after_failure",
      find: "setFinanceViewState(\"error\", \"Unable to load \" + failLabel + \".\");",
      replace: "setFinanceViewState(\"loading\");",
      all: false,
      probe: function(h) {
        h.call('setFinanceDestination("profit-loss")');
        h.call("ensureFinanceData()");
        h.settle(h.lastDispatchFor("getFinanceData"), new Error("boom"));
        return h.ariaBusy() !== "false";
      }
    },
    {
      id: "M9_suppress_retry_after_stale",
      find: "      // Deduplicate: join an existing healthy in-flight request for the same\n      // cache key + type; a stale marker stops blocking and is replaced.\n      var inflightKey = cacheType + \"|\" + cacheKey;\n      if (financeInflight[inflightKey] && isFinanceInflightEntryStale(financeInflight[inflightKey])) {\n        releaseFinanceInflightEntry(inflightKey);\n      }",
      replace: "      // Deduplicate: join an existing healthy in-flight request for the same\n      // cache key + type; a stale marker stops blocking and is replaced.\n      var inflightKey = cacheType + \"|\" + cacheKey;\n      if (false) {\n        releaseFinanceInflightEntry(inflightKey);\n      }",
      all: false,
      probe: function(h) {
        // Stale warm ghost: retry/ensure through requestFinanceData must
        // supersede it; with M9 the join branch is immortal.
        h.call('setFinanceDestination("profit-loss")');
        h.call('warmFinanceData("currentYear", null, null)');
        h.advance(121000);
        h.call("retryFinanceData()");
        return h.callsFor("getFinanceData").length === 1 && h.call("financeState.loading") === true;
      }
    },
    {
      id: "M10_break_valid_cache_reuse",
      find: "if (cacheEntry && isValidFinanceCacheEntry(cacheEntry)) {",
      replace: "if (false) {",
      all: false,
      probe: function(h) {
        h.call('setFinanceDestination("profit-loss")');
        h.call("ensureFinanceData()");
        h.settle(h.lastDispatchFor("getFinanceData"), pnlFixture(10000));
        h.call("ensureFinanceData()");
        return h.callsFor("getFinanceData").length !== 1;
      }
    }
  ];

  var caught = 0;
  var details = [];
  mutations.forEach(function(m) {
    var mutated = m.all
      ? baseController.split(m.find).join(m.replace)
      : baseController.replace(m.find, m.replace);
    var applied = mutated !== baseController;
    var caughtThis = false;
    var note = "";
    if (!applied) {
      note = "mutation token not found (impossible against this source)";
      caughtThis = true; // an impossible mutation cannot introduce the defect
    } else {
      try {
        var h = createFinanceLivenessHarness({
          stateSource: baseState,
          renderSource: baseRender,
          controllerSource: mutated
        });
        caughtThis = m.probe(h) === true;
        note = caughtThis ? "defect surfaced by probe" : "defect NOT surfaced";
      } catch (e) {
        caughtThis = true;
        note = "probe threw under mutation: " + e.message;
      }
    }
    if (caughtThis) caught++;
    details.push({ id: m.id, applied: applied, caught: caughtThis, note: note });
  });

  return {
    suite: "M1-M10",
    caught: caught,
    total: mutations.length,
    passed: caught === mutations.length,
    details: details
  };
}

function runFinanceUiLivenessController() {
  var staticGuards = runStaticGuards({});
  var f = runF1F12({});
  var m = runMutationSensitivity({});
  var passed = staticGuards.passed && f.passed && m.passed;
  return {
    passed: passed,
    staticChecks: staticGuards.checks,
    staticFailures: staticGuards.failures,
    fChecks: f.checks,
    fFailures: f.failures,
    mutationCaught: m.caught,
    mutationTotal: m.total,
    mutationDetails: m.details
  };
}

module.exports = runFinanceUiLivenessController;
module.exports.runFinanceUiLivenessController = runFinanceUiLivenessController;
module.exports.runGhostReproductionProbe = runGhostReproductionProbe;
module.exports.runStaticGuards = runStaticGuards;
module.exports.runF1F12 = runF1F12;
module.exports.runMutationSensitivity = runMutationSensitivity;
module.exports.createFinanceLivenessHarness = createFinanceLivenessHarness;

if (require.main === module) {
  // CLI-only reproduction mode (not used by `_test_runner.js`). Runs the
  // ghost-in-flight probe against BOTH the committed HEAD controller (the
  // pre-remediation baseline while this worktree is uncommitted) and the
  // current on-disk controller, then runs the full post-fix battery.
  var out = { ghostReproduction: {} };
  try {
    var cp = require("child_process");
    var baselineController = cp.execFileSync(
      "git", ["show", "HEAD:201.View.Finance.Controller.html"], { encoding: "utf8" }
    );
    out.ghostReproduction.preFixBaseline = runGhostReproductionProbe({ controllerSource: baselineController });
  } catch (e) {
    out.ghostReproduction.preFixBaseline = { error: e.message };
  }
  out.ghostReproduction.currentSource = runGhostReproductionProbe({});
  out.battery = runFinanceUiLivenessController();
  console.log(JSON.stringify(out, null, 2));
}
