// SALES_RECOGNITION_V2 U8 integration test-sensitivity proof (Node-only;
// executed via `_test_runner.js`). In-memory VM proof: loads the production
// sources + the U1-U8 suites exactly as `_test_runner.js` does, injects
// exactly one contract bug at a time into a VM copy ONLY, and asserts the
// designated U8 suite passes clean and FAILS at the expected marker under each
// injected bug. The 12 mutations cover: duplicate Save recognition on replay,
// V2 Payment, V2 fulfillment, P&L reading activeView, ledger Revenue
// double-count, backdated Void, delta-only Correct, ACTIVE legacy fallback,
// UNKNOWN losing the RequestKey, ProductVariantID->Tipe fallback, prospective
// HPP as COGS, and date-based reclassification of old Orders. Never mutates
// tracked files.
var fs = require("fs");
var vm = require("vm");

// Dependency closure mirrors the local harness file list (plus the U8 module)
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
  "96.Tests.SalesRecognition.V2.U8.Cases.js",
  "96.Tests.Transaction.Production.Readiness.Cases.js",
  "96.Tests.Cash.Foundation.Cases.js"
];

var U8_SUITES = ["testSalesRecognitionV2U8EndToEnd",
  "testSalesRecognitionV2U8Lifecycle",
  "testSalesRecognitionV2U8Cohorts",
  "testSalesRecognitionV2U8PolicyModes",
  "testSalesRecognitionV2U8GuardsIntegrity",
  "testSalesRecognitionV2U8Preflight",
  "testSalesRecognitionV2U8ReleaseEvidence"];

var MUTATIONS = [
  { name: "Save replay re-appends artifacts (duplicate recognition)",
    file: "97A.SalesRecognition.V2.Save.js",
    anchor: "      // COMMITTED verifies exact artifacts then replays DONE (response lost).\n" +
      "      if (runtime.crash) runtime.crash(\"V2_AFTER_COMMIT\");\n" +
      "      return outcome(save.STATUS.DONE, { replay: true, writeCount: 0,\n" +
      "        recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });",
    bug: "      // COMMITTED verifies exact artifacts then replays DONE (response lost).\n" +
      "      if (runtime.crash) runtime.crash(\"V2_AFTER_COMMIT\");\n" +
      "      return salesRecognitionV2SaveApplyBatch_(plan, operation, runtime);",
    suite: "testSalesRecognitionV2U8EndToEnd",
    marker: "SALES_V2_U8_E2E:" },
  { name: "Payment added to V2 (guard bypassed)",
    file: "95A.Transaction.Production.js",
    anchor: "salesV2OperatorPaymentGuard_(orderID, repository, runtime && runtime.spreadsheet);",
    bug: "if (false) salesV2OperatorPaymentGuard_(orderID, repository, runtime && runtime.spreadsheet);",
    suite: "testSalesRecognitionV2U8GuardsIntegrity",
    marker: "SALES_V2_U8_GUARD:" },
  { name: "Fulfillment allowed for V2 (guard bypassed)",
    file: "95.Transaction.Operational.js",
    anchor: "salesV2OperatorFulfillmentGuard_(orderID, repository, runtime && runtime.spreadsheet);",
    bug: "if (false) salesV2OperatorFulfillmentGuard_(orderID, repository, runtime && runtime.spreadsheet);",
    suite: "testSalesRecognitionV2U8GuardsIntegrity",
    marker: "SALES_V2_U8_GUARD:" },
  { name: "P&L Revenue reads activeView instead of signed events",
    file: "36.Finance.Service.js",
    anchor: "var revenueEvents = salesProjection.events || [];",
    bug: "var revenueEvents = salesProjection.activeView.events || [];",
    suite: "testSalesRecognitionV2U8Cohorts",
    marker: "SALES_V2_U8_COHORT:" },
  { name: "Ledger Revenue double-counted into P&L Revenue",
    file: "36.Finance.Service.js",
    anchor: "revenue += Number(event.signedAmount) || 0;\n  });",
    bug: "revenue += Number(event.signedAmount) || 0;\n  });\n" +
      "  revenue += Number(salesProjection.totals && salesProjection.totals.ledgerRevenueCredits) || 0;",
    suite: "testSalesRecognitionV2U8Cohorts",
    marker: "SALES_V2_U8_COHORT:" },
  { name: "Void backdated to the original economic date",
    file: "97C.SalesRecognition.V2.Correction.js",
    anchor: "var economicDate = capitalEquityDateKey(now);",
    bug: "var economicDate = target && target.economicDate ? String(target.economicDate) " +
      "|| capitalEquityDateKey(now) : capitalEquityDateKey(now);",
    suite: "testSalesRecognitionV2U8Lifecycle",
    marker: "SALES_V2_U8_LIFE:" },
  { name: "Correct delta-only replacement (no full replacement)",
    file: "97C.SalesRecognition.V2.Correction.js",
    anchor: "var orderTotal = Number(order.OrderTotal), hppTotal = Number(order.HppTotalSnapshot);",
    bug: "var orderTotal = Number(order.OrderTotal) - (Number(input.target && input.target.amount) || 0), " +
      "hppTotal = Number(order.HppTotalSnapshot);",
    suite: "testSalesRecognitionV2U8Lifecycle",
    marker: "SALES_V2_U8_LIFE:" },
  { name: "ACTIVE routes new sales back to the legacy writer",
    file: "97D.SalesRecognition.V2.OperatorGuard.js",
    anchor: "if (mode === \"ACTIVE\") return { mode: \"ACTIVE\", code: \"\", message: \"\" };",
    bug: "if (mode === \"ACTIVE\") return { mode: \"PREPARED\", code: \"\", message: \"\" };",
    suite: "testSalesRecognitionV2U8PolicyModes",
    marker: "SALES_V2_U8_POLICY:" },
  { name: "UNKNOWN mutation outcome discards the RequestKey",
    file: "97D.SalesRecognition.V2.OperatorGuard.js",
    anchor: "return { success: false, unknown: true, requestKey: requestKey,\n" +
      "      error: { code: result && result.code ? String(result.code) : \"SAVE_EXECUTION_UNKNOWN\",",
    bug: "return { success: false, unknown: true, requestKey: \"\",\n" +
      "      error: { code: result && result.code ? String(result.code) : \"SAVE_EXECUTION_UNKNOWN\",",
    suite: "testSalesRecognitionV2U8EndToEnd",
    marker: "SALES_V2_U8_E2E:" },
  { name: "ProductVariantID normalization falls back to Tipe",
    file: "97A.SalesRecognition.V2.Save.js",
    anchor: "productVariantID: String(line && line.productVariantID || \"\").trim(),",
    bug: "productVariantID: String(line && line.tipe || \"\").trim(),",
    suite: "testSalesRecognitionV2U8EndToEnd",
    marker: "SALES_V2_U8_E2E:" },
  { name: "Prospective HPP reported as COGS",
    file: "36.Finance.Service.js",
    anchor: "result.summary.cogs = null; result.summary.grossProfit = null; result.grossProfit = null;",
    bug: "result.summary.cogs = result.summary.cogs; result.summary.grossProfit = null; " +
      "result.grossProfit = null;",
    suite: "testSalesRecognitionV2U8PolicyModes",
    marker: "SALES_V2_U8_POLICY:" },
  { name: "Old Order reclassified as V2 by a date signal",
    file: "97.SalesRecognition.V2.Foundation.js",
    anchor: "return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.UNKNOWN,\n" +
      "      codes.DATE_ONLY_NO_PERSISTED_EVIDENCE);",
    bug: "return salesRecognitionV2Result_(cohorts.V2_COMMITTED, status.OK, \"\");",
    suite: "testSalesRecognitionV2U8Cohorts",
    marker: "SALES_V2_U8_COHORT:" }
];

function u8ProofStubs_() {
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
    clearPurchaseRecoveryState: function() {},
    console: { log: function() {}, error: function() {}, warn: function() {} },
    runSalesV2U7Controller: require("./sales-v2-u7-controller.js")
  };
}

function runU8Suites_(suites, overrides) {
  var ctx = vm.createContext({});
  var stubs = u8ProofStubs_();
  Object.keys(stubs).forEach(function(key) { ctx[key] = stubs[key]; });
  SOURCES.forEach(function(file) {
    var source = overrides && overrides[file] !== undefined ? overrides[file] :
      fs.readFileSync(file, "utf8");
    vm.runInContext(source, ctx, { filename: file });
  });
  ctx.invalidateDashboardCache = function() {};
  ctx.getDashboardCacheRevision = function() { return "LOCAL_FIXTURE"; };
  var failures = [];
  suites.forEach(function(name) {
    try { vm.runInContext(name + "()", ctx); }
    catch (error) { failures.push(String(error && error.message || error)); }
  });
  return failures;
}

function runSalesV2U8MutationProof() {
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
  var clean = runU8Suites_(U8_SUITES, null);
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
      failures = runU8Suites_([mutation.suite], overrides);
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
  return { status: "SENSITIVITY_PROVEN", cleanSuites: U8_SUITES.length,
    mutations: results.length, results: results };
}

module.exports = runSalesV2U8MutationProof;
