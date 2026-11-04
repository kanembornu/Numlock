// SALES_RECOGNITION_V2 U10 activation test-sensitivity proof (Node-only;
// executed via `_test_runner.js`). In-memory VM proof over 8 named mutations
// of the activation writer. Dependency closure mirrors `_test_runner.js`.
// Clean activation suites must pass; each injected mutation must fail at its
// named marker. Never mutates tracked files.
var fs = require("fs");
var vm = require("vm");

var ACTIVATION_PATH = "97E.SalesRecognition.V2.Activation.js";
var CASES_PATH = "96.Tests.SalesRecognition.V2.Activation.Cases.js";

// Same dependency closure as `_test_runner.js` (plus activation module + cases).
var SOURCES = [
  "20.Data.Source.js",
  "22.Transaction.Lifecycle.js",
  "38.CapitalEquity.Service.js",
  "39.Balance.Foundation.js",
  "40.Cash.Foundation.js",
  "41.Inventory.Opening.Staging.js",
  "42.Inventory.Receipt.Foundation.js",
  "43.Inventory.Receipt.Migration.js",
  "44.Inventory.Receipt.Operational.js",
  "45.Inventory.Receipt.Orchestration.js",
  "46.Expense.Purchase.Policy.js",
  "47.Purchase.Events.js",
  "48.Purchase.Events.Migration.js",
  "21.Transaction.Entry.js",
  "90.Dashboard.DateRange.js",
  "90.Dashboard.Service.js",
  "36.Finance.Service.js",
  "37.Depreciation.Service.js",
  "12A.Depreciation.Report.Service.js",
  "37.Inventory.Policy.Evidence.js",
  "91.Transactions.Query.js",
  "92.Products.Domain.js",
  "93.Master.WritePolicy.js",
  "94.Supplier.Master.js",
  "95.Transaction.Operational.js",
  "95A.Transaction.Production.js",
  "97.SalesRecognition.V2.Foundation.js",
  "97A.SalesRecognition.V2.Save.js",
  "97B.SalesRecognition.V2.Projection.js",
  "97C.SalesRecognition.V2.Correction.js",
  "97D.SalesRecognition.V2.OperatorGuard.js",
  "96.Tests.SalesRecognition.V2.Save.Cases.js",
  "96.Tests.Transaction.Production.Readiness.Cases.js"
];

var SUITES = [
  "testSalesRecognitionV2ActivationCore()",
  "testSalesRecognitionV2ActivationFailClosed()",
  "testSalesRecognitionV2ActivationSourceAudit()"
];

var MUTATIONS = [
  { id: "M1_CLIENT_ACTIVATION_ID",
    anchor: "var activationID;\n  try { activationID = String(runtime.uuid()); }",
    bug: "var activationID;\n  try { activationID = runtime.activationID || String(runtime.uuid()); }",
    marker: "SALES_V2_ACTIVATION:A11" },
  { id: "M2_CLIENT_TIMESTAMP",
    anchor: "try { activatedAt = now instanceof Date ? now.toISOString() : String(now); }",
    bug: "try { activatedAt = runtime.activatedAt || (now instanceof Date ? now.toISOString() : String(now)); }",
    marker: "SALES_V2_ACTIVATION:A11" },
  { id: "M3_REGENERATE_ID_ON_REINVOCATION",
    anchor: "return salesRecognitionV2ActivationResult_(act.STATUS.ALREADY_ACTIVE, {",
    bug: "runtime.properties.setProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY, JSON.stringify({ mode: act.ACTIVE_MODE, contractVersion: current.contractVersion, activationID: String(runtime.uuid()), activatedAt: current.activatedAt, configVersion: current.configVersion }));\n    return salesRecognitionV2ActivationResult_(act.STATUS.ALREADY_ACTIVE, {",
    marker: "SALES_V2_ACTIVATION:A3" },
  { id: "M4_REGENERATE_T_ON_REINVOCATION",
    anchor: "return salesRecognitionV2ActivationResult_(act.STATUS.ALREADY_ACTIVE, {",
    bug: "runtime.properties.setProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY, JSON.stringify({ mode: act.ACTIVE_MODE, contractVersion: current.contractVersion, activationID: current.activationID, activatedAt: String(runtime.now()), configVersion: current.configVersion }));\n    return salesRecognitionV2ActivationResult_(act.STATUS.ALREADY_ACTIVE, {",
    marker: "SALES_V2_ACTIVATION:A3" },
  { id: "M5_ACTIVE_WRITE_BEFORE_PREFLIGHT",
    anchor: "var preflight = salesRecognitionV2ActivationPreflight_(runtime);",
    bug: "runtime.properties.setProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY, \"{}\");\n  var preflight = salesRecognitionV2ActivationPreflight_(runtime);",
    marker: "SALES_V2_ACTIVATION:A1c" },
  { id: "M6_SKIP_ACCOUNT_PREFLIGHT",
    anchor: "var accounts = preflightSalesRecognitionAccounts(accountRows);",
    bug: "var accounts = { status: \"PASS\", errors: [] };",
    marker: "SALES_V2_ACTIVATION:A8" },
  { id: "M7_SKIP_SCHEMA_PREFLIGHT",
    anchor: "var schema = salesRecognitionV2SaveSchemaGate_(runtime.spreadsheet);",
    bug: "var schema = { status: \"PASS\", badSheets: [] };",
    marker: "SALES_V2_ACTIVATION:A9" },
  { id: "M8_ACTIVATION_WRITES_RECOGNITION_EVENT",
    anchor: "runtime.properties.setProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY, payload);",
    bug: "runtime.properties.setProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY, payload);\n  if (runtime.spreadsheet && runtime.spreadsheet.fixtureSheet) {\n    var _ev = runtime.spreadsheet.fixtureSheet(\"SalesRecognitionEvents\");\n    if (_ev) _ev.getRange(_ev.getLastRow() + 1, 1, 1, 1).setValues([[\"X\"]]);\n  }",
    marker: "SALES_V2_ACTIVATION:A12" }
];

function harnessGlobals_() {
  return {
    Logger: { log: function() {} },
    Utilities: {
      getUuid: function() { return "test-uuid-000000000000000000000000"; },
      formatDate: function(d) { return d.toISOString().slice(0, 19) + ".000Z"; }
    },
    LockService: {
      getScriptLock: function() {
        return { waitLock: function() {}, releaseLock: function() {}, hasLock: function() { return true; } };
      }
    },
    CacheService: {
      getScriptCache: function() {
        return { get: function() { return null; }, put: function() {} };
      }
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: function() { throw new Error("NO_SPREADSHEET_MOCK"); }
    },
    Session: { getScriptTimeZone: function() { return "Asia/Jakarta"; } },
    invalidateDashboardCache: function() {},
    getDashboardCacheRevision: function() { return "LOCAL_FIXTURE"; },
    dateFormat: function() { return "yyyy-MM-dd"; }
  };
}

function loadContext_(activationSource, casesSource) {
  var ctx = vm.createContext(harnessGlobals_());
  SOURCES.forEach(function(file) {
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  });
  // Runner re-stubs after 90.Dashboard.Service load.
  vm.runInContext(
    "invalidateDashboardCache = function() {}; getDashboardCacheRevision = function() { return 'LOCAL_FIXTURE'; };",
    ctx);
  vm.runInContext(activationSource, ctx, { filename: ACTIVATION_PATH });
  vm.runInContext(casesSource, ctx, { filename: CASES_PATH });
  return ctx;
}

function runSuites_(ctx) {
  var firstFailure = null;
  for (var i = 0; i < SUITES.length; i++) {
    try {
      vm.runInContext(SUITES[i], ctx);
    } catch (error) {
      if (!firstFailure) firstFailure = String(error && error.message || error);
    }
  }
  return firstFailure;
}

function runSalesV2U10ActivationMutationProof() {
  var activationSource = fs.readFileSync(ACTIVATION_PATH, "utf8");
  var casesSource = fs.readFileSync(CASES_PATH, "utf8");

  var cleanFailure = runSuites_(loadContext_(activationSource, casesSource));
  if (cleanFailure) throw new Error("PROOF_CLEAN_FAILED:" + cleanFailure);

  var proven = [];
  MUTATIONS.forEach(function(mutation) {
    var anchors = activationSource.split(mutation.anchor).length - 1;
    if (anchors !== 1) {
      throw new Error("MUTATION_ANCHOR_" + mutation.id + ":" + anchors);
    }
    var mutatedSource = activationSource.replace(mutation.anchor, mutation.bug);
    if (mutatedSource === activationSource) {
      throw new Error("MUTATION_NOT_APPLIED:" + mutation.id);
    }
    var failure = runSuites_(loadContext_(mutatedSource, casesSource));
    if (!failure) throw new Error("PROOF_MUTATION_PASSED:" + mutation.id);
    if (failure.indexOf(mutation.marker) === -1) {
      throw new Error("PROOF_WRONG_FAILURE_" + mutation.id + ":" + failure);
    }
    proven.push(mutation.id);
  });

  return { status: "SENSITIVITY_PROVEN", mutations: proven.length, ids: proven };
}

module.exports = runSalesV2U10ActivationMutationProof;
