// SALES_RECOGNITION_V2 U2 test-sensitivity proof (Node-only; executed via
// `_test_runner.js`). In-memory VM proof: reads the U2 save source, injects a
// forbidden credit-account bug (4000 revenue -> 1100 inventory) into a VM copy
// ONLY, and asserts all three U2 suites pass clean and FAIL at the literal
// journal-account assertion (SALES_V2_SAVE_CORE:A9) under the injected bug.
// Never mutates tracked files.
var fs = require("fs");
var vm = require("vm");

var DOMAIN_PATH = "97A.SalesRecognition.V2.Save.js";
var CASES_PATH = "96.Tests.SalesRecognition.V2.Save.Cases.js";
var PROOF_ANCHOR = "save.JOURNAL_ACCOUNTS.REVENUE, Debit: 0";
var PROOF_BUG = '"1100", Debit: 0';
var PROOF_EXPECTED_MARKER = "SALES_V2_SAVE_CORE:A9";
// Minimal dependency closure for the U2 domain + suites (mirrors _test_runner
// load order for the shared sources the U2 suites reference).
var SOURCES = [
  "20.Data.Source.js",
  "38.CapitalEquity.Service.js",
  "39.Balance.Foundation.js",
  "40.Cash.Foundation.js",
  "92.Products.Domain.js",
  "93.Master.WritePolicy.js",
  "94.Supplier.Master.js",
  "95.Transaction.Operational.js",
  "95A.Transaction.Production.js",
  "97.SalesRecognition.V2.Foundation.js"
];
var SUITES = ["testSalesRecognitionV2SaveCore", "testSalesRecognitionV2SaveRecovery",
  "testSalesRecognitionV2SaveGates"];

function runU2Suites_(domainSource) {
  var ctx = vm.createContext({});
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
  var anchors = domainSource.split(PROOF_ANCHOR).length - 1;
  if (anchors !== 1) throw new Error("MUTATION_ANCHOR_UNEXPECTED:" + anchors);
  var clean = runU2Suites_(domainSource);
  if (clean.length) throw new Error("PROOF_CLEAN_FAILED:" + clean[0]);
  var mutatedSource = domainSource.replace(PROOF_ANCHOR, PROOF_BUG);
  if (mutatedSource === domainSource) throw new Error("MUTATION_NOT_APPLIED");
  var mutated = runU2Suites_(mutatedSource);
  if (!mutated.length) throw new Error("PROOF_MUTATED_RUN_PASSED");
  if (mutated[0].indexOf(PROOF_EXPECTED_MARKER) === -1) {
    throw new Error("PROOF_WRONG_FAILURE_MARKER:" + mutated[0]);
  }
  return { status: "SENSITIVITY_PROVEN", cleanSuites: SUITES.length,
    injectedBug: PROOF_ANCHOR + " -> " + PROOF_BUG, injectedFailureMarker: mutated[0] };
}

module.exports = runSalesV2U2MutationProof;
