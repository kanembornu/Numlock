// SALES_RECOGNITION_V2 U2 test-sensitivity proof (Node-only; executed via
// `_test_runner.js`). In-memory VM proof: reads the U2 save source, injects one
// contract bug at a time into a VM copy ONLY, and asserts all three U2 suites
// pass clean and FAIL at the exact expected marker under each injected bug.
// Covers: forbidden journal account, batchUpdate transport endpoint, cell-char
// bound, plan integrity digest, cross-owner line detection, and bypass of exact
// event artifact verification. Never mutates tracked files.
var fs = require("fs");
var vm = require("vm");

var DOMAIN_PATH = "97A.SalesRecognition.V2.Save.js";
var CASES_PATH = "96.Tests.SalesRecognition.V2.Save.Cases.js";
// Minimal dependency closure for the U2 domain + suites (mirrors _test_runner
// load order for the shared sources the U2 suites reference, including the
// sanitized Sheets transport (43) and storage policy (36) used by the mocked
// real-transport tests).
var SOURCES = [
  "20.Data.Source.js",
  "36.Finance.Service.js",
  "38.CapitalEquity.Service.js",
  "39.Balance.Foundation.js",
  "40.Cash.Foundation.js",
  "43.Inventory.Receipt.Migration.js",
  "92.Products.Domain.js",
  "93.Master.WritePolicy.js",
  "94.Supplier.Master.js",
  "95.Transaction.Operational.js",
  "95A.Transaction.Production.js",
  "97.SalesRecognition.V2.Foundation.js"
];
var SUITES = ["testSalesRecognitionV2SaveCore", "testSalesRecognitionV2SaveRecovery",
  "testSalesRecognitionV2SaveGates"];
var MUTATIONS = [
  { anchor: 'REVENUE: "4000"', bug: 'REVENUE: "1100"',
    marker: "SALES_V2_SAVE_CORE:A9" },
  { anchor: '":batchUpdate"', bug: '":batchAppend"',
    marker: "SALES_V2_SAVE_GATES:C11b" },
  { anchor: "MAX_CELL_CHARS: 45000", bug: "MAX_CELL_CHARS: 99999",
    marker: "SALES_V2_SAVE_GATES:C19a" },
  { anchor: "transactionPayloadHash_(copy) !== plan.planDigest", bug: "false",
    marker: "SALES_V2_SAVE_RECOVERY:B17a" },
  { anchor: "plannedLineIds[row.OrderLineID] && row.OrderID !== plan.orderID", bug: "false",
    marker: "SALES_V2_SAVE_RECOVERY:B19a" },
  { anchor: "salesRecognitionV2SaveRowExact_(eventMatches[0], plan.eventRow, contract.HEADERS)",
    bug: "true",
    marker: "SALES_V2_SAVE_RECOVERY:B9a" }
];

function runU2Suites_(domainSource) {
  // U10F: minimal harness stubs mirroring _test_runner.js — the U2 DONE path
  // performs best-effort post-commit cache invalidation (90.Dashboard.Service).
  var ctx = vm.createContext({
    Logger: { log: function() {} },
    invalidateDashboardCache: function() {},
    getDashboardCacheRevision: function() { return "LOCAL_FIXTURE"; }
  });
  SOURCES.forEach(function(file) {
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  });
  vm.runInContext(domainSource, ctx, { filename: DOMAIN_PATH });
  vm.runInContext(fs.readFileSync(CASES_PATH, "utf8"), ctx, { filename: CASES_PATH });
  var failures = [];
  SUITES.forEach(function(name) {
    try { vm.runInContext(name + "()", ctx); }
    catch (error) { failures.push(String(error && error.message || error)); }
  });
  return failures;
}

function runSalesV2U2MutationProof() {
  var domainSource = fs.readFileSync(DOMAIN_PATH, "utf8");
  MUTATIONS.forEach(function(mutation) {
    var anchors = domainSource.split(mutation.anchor).length - 1;
    if (anchors !== 1) throw new Error("MUTATION_ANCHOR_UNEXPECTED:" + mutation.anchor + ":" + anchors);
  });
  var clean = runU2Suites_(domainSource);
  if (clean.length) throw new Error("PROOF_CLEAN_FAILED:" + clean[0]);
  var results = MUTATIONS.map(function(mutation) {
    var mutatedSource = domainSource.replace(mutation.anchor, mutation.bug);
    if (mutatedSource === domainSource) throw new Error("MUTATION_NOT_APPLIED:" + mutation.anchor);
    var failures = runU2Suites_(mutatedSource);
    if (!failures.length) throw new Error("PROOF_MUTATED_RUN_PASSED:" + mutation.anchor);
    if (failures[0].indexOf(mutation.marker) === -1) {
      throw new Error("PROOF_WRONG_FAILURE_MARKER:" + mutation.anchor + ":" + failures[0]);
    }
    return { injected: mutation.anchor + " -> " + mutation.bug, marker: failures[0] };
  });
  return { status: "SENSITIVITY_PROVEN", cleanSuites: SUITES.length,
    mutations: results.length, results: results };
}

module.exports = runSalesV2U2MutationProof;
