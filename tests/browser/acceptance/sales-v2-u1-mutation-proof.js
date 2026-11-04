// SALES_RECOGNITION_V2 U1 test-sensitivity proof (Node-only; executed via
// `_test_runner.js`). In-memory VM proof: reads source text, re-injects the
// pre-fix trim-normalized mode enum bug into a VM copy ONLY, and asserts the
// Foundation regression suite passes clean and FAILS at the whitespace-mode
// assertion (F71) under the injected bug. Never mutates tracked files.
var fs = require("fs");
var vm = require("vm");

var PROOF_ANCHOR = "indexOf(mode)";
var PROOF_BUG = "indexOf(mode.trim())";
var PROOF_EXPECTED_MARKER = "SALES_V2_FOUNDATION:F71";
var FOUNDATION_PATH = "97.SalesRecognition.V2.Foundation.js";
var CASES_PATH = "96.Tests.Transaction.Operational.Cases.js";

function runFoundationSuite_(foundationSource, casesSource) {
  var ctx = vm.createContext({});
  vm.runInContext(foundationSource, ctx, { filename: FOUNDATION_PATH });
  vm.runInContext(casesSource, ctx, { filename: CASES_PATH });
  try {
    vm.runInContext("testSalesRecognitionV2FoundationContracts()", ctx);
    return { failed: false, marker: "" };
  } catch (error) {
    return { failed: true, marker: String(error && error.message || error) };
  }
}

function runSalesV2U1MutationProof() {
  var foundationSource = fs.readFileSync(FOUNDATION_PATH, "utf8");
  var casesSource = fs.readFileSync(CASES_PATH, "utf8");
  var anchors = foundationSource.split(PROOF_ANCHOR).length - 1;
  if (anchors !== 1) throw new Error("MUTATION_ANCHOR_UNEXPECTED:" + anchors);
  var clean = runFoundationSuite_(foundationSource, casesSource);
  if (clean.failed) throw new Error("PROOF_CLEAN_FAILED:" + clean.marker);
  var mutatedSource = foundationSource.replace(PROOF_ANCHOR, PROOF_BUG);
  if (mutatedSource === foundationSource) throw new Error("MUTATION_NOT_APPLIED");
  var mutated = runFoundationSuite_(mutatedSource, casesSource);
  if (!mutated.failed) throw new Error("PROOF_MUTATED_RUN_PASSED");
  if (mutated.marker.indexOf(PROOF_EXPECTED_MARKER) === -1) {
    throw new Error("PROOF_WRONG_FAILURE_MARKER:" + mutated.marker);
  }
  return { status: "SENSITIVITY_PROVEN", cleanAssertions: 80,
    injectedBug: PROOF_ANCHOR + " -> " + PROOF_BUG, injectedFailureMarker: mutated.marker };
}

module.exports = runSalesV2U1MutationProof;
