// SALES_RECOGNITION_V2 U3 test-sensitivity proof (Node-only; executed via
// `_test_runner.js`). In-memory VM proof: reads the U3 projection source,
// injects one contract bug at a time into a VM copy ONLY, and asserts all
// three U3 suites pass clean and FAIL at the exact expected marker under each
// injected bug. Covers: events-vs-lines totals authority, SUCCESS payment
// gate, ledger non-additivity, pending-V2 routing (no legacy downgrade),
// legacy identity construction, and EconomicDate period attribution.
// Never mutates tracked files.
var fs = require("fs");
var vm = require("vm");

var DOMAIN_PATH = "97B.SalesRecognition.V2.Projection.js";
var CASES_PATH = "96.Tests.SalesRecognition.V2.Projection.Cases.js";
// Dependency closure: U2 proof sources + U2 save domain + U2 fixtures +
// lifecycle module (Log relations used by the legacy fixtures).
var SOURCES = [
  "20.Data.Source.js",
  "22.Transaction.Lifecycle.js",
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
  "97.SalesRecognition.V2.Foundation.js",
  "97A.SalesRecognition.V2.Save.js",
  "96.Tests.SalesRecognition.V2.Save.Cases.js"
];
var SUITES = ["testSalesRecognitionV2ProjectionCore",
  "testSalesRecognitionV2ProjectionLineage",
  "testSalesRecognitionV2ProjectionParity"];
var MUTATIONS = [
  { anchor: "projection.events.forEach(function(event) {",
    bug: "projection.lines.forEach(function(event) {",
    marker: "SALES_V2_U3_CORE:D1" },
  { anchor: '=== "SUCCESS"', bug: '=== "PENDING"',
    marker: "SALES_V2_U3_CORE:B1" },
  { anchor: "totals.ledgerRevenueCredits = ledgerCredits;",
    bug: "totals.recognizedRevenue = ledgerCredits;",
    marker: "SALES_V2_U3_CORE:E2" },
  { anchor: "V2_COMMITTED || V2_PENDING", bug: 'V2_COMMITTED || "LEGACY"',
    marker: "SALES_V2_U3_CORE:C2" },
  { anchor: '"LEGACY:" + record.id',
    bug: '"LEGACY:" + record.dateKey + ":" + record.amount',
    marker: "SALES_V2_U3_CORE:A1" },
  { anchor: "salesProjectionDateKey_(row.EconomicDate)",
    bug: "salesProjectionDateKey_(row.RecognizedAt)",
    marker: "SALES_V2_U3_CORE:F1" }
];

function runU3Suites_(domainSource) {
  // U10F: minimal harness stubs mirroring _test_runner.js — the U2 DONE path
  // (loaded here as a dependency) performs best-effort post-commit cache
  // invalidation (90.Dashboard.Service).
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

function runSalesV2U3MutationProof() {
  var domainSource = fs.readFileSync(DOMAIN_PATH, "utf8");
  MUTATIONS.forEach(function(mutation) {
    var anchors = domainSource.split(mutation.anchor).length - 1;
    if (anchors !== 1) throw new Error("MUTATION_ANCHOR_UNEXPECTED:" + mutation.anchor + ":" + anchors);
  });
  var clean = runU3Suites_(domainSource);
  if (clean.length) throw new Error("PROOF_CLEAN_FAILED:" + clean[0]);
  var results = MUTATIONS.map(function(mutation) {
    var mutatedSource = domainSource.replace(mutation.anchor, mutation.bug);
    if (mutatedSource === domainSource) throw new Error("MUTATION_NOT_APPLIED:" + mutation.anchor);
    var failures = runU3Suites_(mutatedSource);
    if (!failures.length) throw new Error("PROOF_MUTATED_RUN_PASSED:" + mutation.anchor);
    if (failures[0].indexOf(mutation.marker) === -1) {
      throw new Error("PROOF_WRONG_FAILURE_MARKER:" + mutation.anchor + ":" + failures[0]);
    }
    return { injected: mutation.anchor + " -> " + mutation.bug, marker: failures[0] };
  });
  return { status: "SENSITIVITY_PROVEN", cleanSuites: SUITES.length,
    mutations: results.length, results: results };
}

module.exports = runSalesV2U3MutationProof;
