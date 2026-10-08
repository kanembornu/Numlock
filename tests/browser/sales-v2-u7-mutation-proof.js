// SALES_RECOGNITION_V2 U7 test-sensitivity proof (Node-only; executed via
// `_test_runner.js`). In-memory VM proof: reads the U7 production sources (and
// the operator controller source for client-side cases), injects exactly one
// contract bug at a time into a VM copy ONLY, and asserts the designated U7
// suite passes clean and FAILS at the expected marker under each injected bug.
// Covers: ACTIVE/PAUSED fail-closed routing (no legacy fallback), V2 payment
// and fulfillment retirement guards, UNKNOWN RequestKey retention, Done only
// after a confirmed status, ProductVariantID (no Tipe fallback), V2 Correct/
// Void -> U6 routing, cohort evidence binding (old Order never V2), and no
// fabricated payment method on V2 results. Never mutates tracked files.
var fs = require("fs");
var vm = require("vm");

// Dependency closure mirrors the local harness file list (plus the U7 module)
// so every fixture and helper resolves exactly as it does in `_test_runner.js`.
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
  "96.Tests.SalesRecognition.V2.Projection.Cases.js",
  "96.Tests.SalesRecognition.V2.U4.Cases.js",
  "96.Tests.SalesRecognition.V2.U5.Cases.js",
  "96.Tests.SalesRecognition.V2.U6.Cases.js",
  "96.Tests.SalesRecognition.V2.U7.Cases.js",
  "96.Tests.Transaction.Production.Readiness.Cases.js",
  "96.Tests.Cash.Foundation.Cases.js"
];

var U7_SUITES = ["testSalesRecognitionV2U7OperatorFlow",
  "testSalesRecognitionV2U7RetirementGuards",
  "testSalesRecognitionV2U7RequestIdentity",
  "testSalesRecognitionV2U7CorrectVoidRouting",
  "testSalesRecognitionV2U7UiContracts",
  "testSalesRecognitionV2U7SourceAudit"];

var HTML_SOURCES = ["190.View.Index.html", "193.View.Transactions.Render.html",
  "194.View.Transactions.Forms.html", "195.View.Transactions.Actions.html"];

var MUTATIONS = [
  { name: "ACTIVE routes new sales back to the legacy writer",
    file: "97D.SalesRecognition.V2.OperatorGuard.js",
    anchor: 'if (mode === "ACTIVE") return { mode: "ACTIVE", code: "", message: "" };',
    bug: 'if (mode === "ACTIVE") return { mode: "PREPARED", code: "", message: "" };',
    suite: "testSalesRecognitionV2U7OperatorFlow",
    marker: "SALES_V2_U7_OPERATOR_FLOW:" },
  { name: "PAUSED routes new sales back to the legacy writer",
    file: "97D.SalesRecognition.V2.OperatorGuard.js",
    anchor: 'if (mode === "PAUSED") return { mode: "PAUSED", code: codes.V2_MODE_PAUSED,',
    bug: 'if (mode === "PAUSED") return { mode: "PREPARED", code: "", message: "",',
    suite: "testSalesRecognitionV2U7OperatorFlow",
    marker: "SALES_V2_U7_OPERATOR_FLOW:" },
  { name: "V2 payment guard bypassed in the durable payment core",
    file: "95A.Transaction.Production.js",
    anchor: "salesV2OperatorPaymentGuard_(orderID, repository, runtime && runtime.spreadsheet);",
    bug: "if (false) salesV2OperatorPaymentGuard_(orderID, repository, runtime && runtime.spreadsheet);",
    suite: "testSalesRecognitionV2U7RetirementGuards",
    marker: "SALES_V2_U7_GUARDS:" },
  { name: "V2 fulfillment guard bypassed in the transition core",
    file: "95.Transaction.Operational.js",
    anchor: "salesV2OperatorFulfillmentGuard_(orderID, repository, runtime && runtime.spreadsheet);",
    bug: "if (false) salesV2OperatorFulfillmentGuard_(orderID, repository, runtime && runtime.spreadsheet);",
    suite: "testSalesRecognitionV2U7RetirementGuards",
    marker: "SALES_V2_U7_GUARDS:" },
  { name: "UNKNOWN mutation outcome discards the RequestKey",
    file: "195.View.Transactions.Actions.html",
    anchor: "// Possible-write outcome: keep the SAME RequestKey, never a new identity,",
    bug: "// Possible-write outcome: keep the SAME RequestKey, never a new identity,\n      salesV2MutationState.requestKey = salesV2MutationKey_(salesV2MutationState.mode);",
    suite: "testSalesRecognitionV2U7UiContracts",
    marker: "SALES_V2_U7_UI:" },
  { name: "Mutation Done rendered before a confirmed status",
    file: "195.View.Transactions.Actions.html",
    anchor: 'if (response.status === "DONE") { salesV2MutationOutcomeSuccess_(response); return; }',
    bug: 'if (response) { salesV2MutationOutcomeSuccess_(response); return; }',
    suite: "testSalesRecognitionV2U7UiContracts",
    marker: "SALES_V2_U7_UI:" },
  { name: "ProductVariantID normalization falls back to Tipe",
    file: "97A.SalesRecognition.V2.Save.js",
    anchor: 'productVariantID: String(line && line.productVariantID || "").trim(),',
    bug: 'productVariantID: String(line && line.tipe || "").trim(),',
    suite: "testSalesRecognitionV2U7RetirementGuards",
    marker: "SALES_V2_U7_GUARDS:" },
  { name: "V2 Correct/Void routed to the legacy lifecycle handlers",
    file: "195.View.Transactions.Actions.html",
    anchor: 'var method = salesV2MutationState.mode === "correct" ? "salesRecognitionV2DurableCorrect" : "salesRecognitionV2DurableVoid";',
    bug: 'var method = salesV2MutationState.mode === "correct" ? "correctCanonicalTransaction" : "voidCanonicalTransaction";',
    suite: "testSalesRecognitionV2U7UiContracts",
    marker: "SALES_V2_U7_UI:" },
  { name: "Old Order misclassified as V2 by unrelated persisted evidence",
    file: "97D.SalesRecognition.V2.OperatorGuard.js",
    anchor: 'if (SALES_V2_OPERATOR.V2_OPERATION_TYPES.indexOf(String(operation.OperationType)) === -1) continue;\n      if (String(operation.BusinessID === undefined || operation.BusinessID === null ? "" : operation.BusinessID).trim() !== id) continue;',
    bug: 'if (false) continue;\n      if (String(operation.BusinessID === undefined || operation.BusinessID === null ? "" : operation.BusinessID).trim() !== id) continue;',
    suite: "testSalesRecognitionV2U7RetirementGuards",
    marker: "SALES_V2_U7_GUARDS:" },
  { name: "Fabricated default payment method on the V2 save result",
    file: "97D.SalesRecognition.V2.OperatorGuard.js",
    anchor: 'dto.recognitionStatus = "RECOGNIZED";',
    bug: 'dto.recognitionStatus = "RECOGNIZED"; dto.paymentMethod = "CASH"; dto.ReceiveVia = "CASH";',
    suite: "testSalesRecognitionV2U7UiContracts",
    marker: "SALES_V2_U7_UI:" }
];

function u7ProofStubs_() {
  return {
    Logger: { log: function() {} },
    Utilities: {
      getUuid: function() { return "test-uuid-0000000000000000000000000"; },
      formatDate: function(d, tz, fmt) { return d.toISOString().slice(0, 19) + ".000Z"; }
    },
    LockService: {
      getScriptLock: function() {
        return { waitLock: function() {}, releaseLock: function() {}, hasLock: function() { return true; } };
      }
    },
    Session: { getScriptTimeZone: function() { return "Asia/Jakarta"; } },
    dateFormat: function() { return "yyyy-MM-dd"; },
    SpreadsheetApp: {
      getActiveSpreadsheet: function() { throw new Error("NO_SPREADSHEET_MOCK"); }
    },
    CacheService: {
      getScriptCache: function() { return { get: function() { return null; }, put: function() {} }; }
    },
    invalidateDashboardCache: function() {},
    getDashboardCacheRevision: function() { return "LOCAL_FIXTURE"; },
    sessionStorage: { getItem: function() { return null; }, setItem: function() {}, removeItem: function() {} },
    PURCHASE_RECOVERY_STORAGE_KEY: "numlock.purchase.mutationRecovery",
    savePurchaseRecoveryState: function() {},
    loadPurchaseRecoveryState: function() { return null; },
    clearPurchaseRecoveryState: function() {}
  };
}

function runU7Suites_(suites, overrides) {
  var ctx = vm.createContext({});
  var stubs = u7ProofStubs_();
  Object.keys(stubs).forEach(function(key) { ctx[key] = stubs[key]; });
  SOURCES.forEach(function(file) {
    var source = overrides && overrides[file] !== undefined ? overrides[file] :
      fs.readFileSync(file, "utf8");
    vm.runInContext(source, ctx, { filename: file });
  });
  ctx.invalidateDashboardCache = function() {};
  ctx.getDashboardCacheRevision = function() { return "LOCAL_FIXTURE"; };
  // HTML sources for the UI contract suite, mirroring `_test_runner.js`.
  HTML_SOURCES.forEach(function(file) {
    var variable = { "190.View.Index.html": "_htmlIndex",
      "193.View.Transactions.Render.html": "_htmlRender",
      "194.View.Transactions.Forms.html": "_htmlForms",
      "195.View.Transactions.Actions.html": "_htmlActions" }[file];
    ctx[variable] = overrides && overrides[file] !== undefined ? overrides[file] :
      fs.readFileSync(file, "utf8");
  });
  var failures = [];
  suites.forEach(function(name) {
    try { vm.runInContext(name + "()", ctx); }
    catch (error) { failures.push(String(error && error.message || error)); }
  });
  return failures;
}

function runSalesV2U7MutationProof() {
  var mutatedFiles = {};
  MUTATIONS.forEach(function(mutation) {
    if (mutatedFiles[mutation.file] === undefined) {
      mutatedFiles[mutation.file] = fs.readFileSync(mutation.file, "utf8");
    }
    var anchors = mutatedFiles[mutation.file].split(mutation.anchor).length - 1;
    if (anchors !== 1) {
      throw new Error("MUTATION_ANCHOR_UNEXPECTED:" + mutation.name + ":" + anchors);
    }
  });
  var clean = runU7Suites_(U7_SUITES, null);
  if (clean.length) throw new Error("PROOF_CLEAN_FAILED:" + clean[0]);
  var results = MUTATIONS.map(function(mutation) {
    var mutated = mutatedFiles[mutation.file].replace(mutation.anchor, mutation.bug);
    if (mutated === mutatedFiles[mutation.file]) {
      throw new Error("MUTATION_NOT_APPLIED:" + mutation.name);
    }
    var overrides = {};
    overrides[mutation.file] = mutated;
    var failures;
    try {
      failures = runU7Suites_([mutation.suite], overrides);
    } catch (error) {
      throw new Error("PROOF_MUTATION_ERROR:" + mutation.name + ":" +
        String(error && error.message || error));
    }
    if (!failures.length) throw new Error("PROOF_MUTATED_RUN_PASSED:" + mutation.name);
    var caught = failures.filter(function(failure) {
      return failure.indexOf(mutation.marker) !== -1;
    });
    if (!caught.length) {
      throw new Error("PROOF_WRONG_FAILURE_MARKER:" + mutation.name + ":" + mutation.marker +
        ":" + failures.join(" || "));
    }
    return { injected: mutation.name, suite: mutation.suite, caughtBy: caught[0] };
  });
  return { status: "SENSITIVITY_PROVEN", cleanSuites: U7_SUITES.length,
    mutations: results.length, results: results };
}

module.exports = runSalesV2U7MutationProof;
