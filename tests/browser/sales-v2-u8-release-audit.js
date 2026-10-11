// SALES_RECOGNITION_V2 U8 release audit (Node-only; executed via
// `_test_runner.js`). BROAD repository search + static routing audit +
// secret/env hygiene over the release surface. Throws on the first violation
// so `_test_runner.js` reports PASS only when every check holds. Read-only:
// no production contact, no network, no clasp, no writes.
var fs = require("fs");
var path = require("path");

var ROOT = ".";

function listRootCode_() {
  return fs.readdirSync(ROOT).filter(function(name) {
    return /\.(js|html|json)$/.test(name) &&
      [".clasp.json"].indexOf(name) === -1; // .clasp.json is never read (scriptId hygiene)
  }).sort();
}
function listTreeCode_(dir, out) {
  out = out || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function(entry) {
    if (entry.name === ".git" || entry.name === "node_modules" ||
        entry.name === "docs" || entry.name === ".codex" || entry.name === ".ai" ||
        entry.name === ".local") return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) listTreeCode_(full, out);
    else if (/\.(js|html|json|md)$/.test(entry.name)) out.push(full);
  });
  return out;
}
function read_(file) { return fs.readFileSync(file, "utf8"); }
function fail_(id, detail) {
  throw new Error("U8_RELEASE_AUDIT:" + id + (detail === undefined ? "" : "|" + detail));
}
function scan_(files, pattern, id) {
  var hits = [];
  files.forEach(function(file) {
    var text = read_(file);
    var match = pattern.exec(text);
    if (match) hits.push(file + ":" + (match.index));
  });
  if (hits.length) fail_(id, hits.join(","));
}

// Top-level function source: slice between "\nfunction " declarations so
// nested/indented helpers never split the region.
function functionSource_(name) {
  var candidates = listRootCode_().filter(function(file) { return /\.js$/.test(file); });
  for (var i = 0; i < candidates.length; i++) {
    var text = read_(candidates[i]);
    var idx = text.indexOf("\nfunction " + name + "(");
    if (idx === -1) continue;
    var start = idx + 1;
    var next = text.indexOf("\nfunction ", start + 10);
    var source = next === -1 ? text.slice(start) : text.slice(start, next);
    return { file: candidates[i], source: source };
  }
  fail_("FUNCTION_NOT_FOUND", name);
  return null;
}

function runSalesV2U8ReleaseAudit() {
  var checks = [];
  function record(id, value) { checks.push({ id: id, value: value }); }

  // ---- 1. Release config audit (broad repository search) ----
  var foundation = read_("97.SalesRecognition.V2.Foundation.js");
  var operator = read_("97D.SalesRecognition.V2.OperatorGuard.js");
  if (foundation.indexOf('mode: "PREPARED"') === -1 ||
      foundation.indexOf('activationID: ""') === -1 ||
      foundation.indexOf('activatedAt: ""') === -1) {
    fail_("DEFAULTS_NOT_PREPARED");
  }
  record("defaults PREPARED/disabled", "PASS");
  if (/setProperty\(/.test(operator)) fail_("OPERATOR_WRITES_CONFIG");
  record("no config persistence in operator guard", "PASS");

  var productionFiles = listRootCode_().filter(function(file) {
    return /^(9[0-9A-Z]|100|36|20|21|22|91|92|95)/.test(file) &&
      /^96\./.test(file) === false;
  });
  var productionJs = productionFiles.filter(function(file) { return /\.js$/.test(file); });
  // ACTIVE literal only inside the mode routing table / tests / proofs.
  // ACTIVE literal only inside a mode routing table / tests / proofs. 21 is
  // the Expense single-commit routing table (T11.2 §4, T11.4 U2): it resolves
  // SINGLE_COMMIT_TRANSACTION_V1 exactly like 97D resolves the Sales config.
  var activeAllowlist = ["97D.SalesRecognition.V2.OperatorGuard.js",
    "97E.SalesRecognition.V2.Activation.js",
    "21.Transaction.Entry.js"];
  listRootCode_().concat(listTreeCode_("tests")).forEach(function(file) {
    if (!/\.(js|html)$/.test(file)) return;
    var text = read_(file);
    if (!/mode: ?"ACTIVE"/.test(text) && !/mode = ?"ACTIVE"/.test(text)) return;
    var base = path.basename(file);
    var allowed = activeAllowlist.indexOf(base) !== -1 ||
      /^96\.Tests\./.test(base) || /^sales-v2-u\d-/.test(base);
    if (!allowed) fail_("ACTIVE_CONFIG_OUTSIDE_ROUTING", file);
  });
  record("ACTIVE only in routing table/tests/proofs", "PASS");

  scan_(productionJs, /activationID: ?"(ACT|T|U)-/, "HARDCODED_ACTIVATION_IN_PRODUCTION");
  scan_(productionJs, /activatedAt: ?"\d{4}-/, "HARDCODED_ACTIVATED_AT_IN_PRODUCTION");
  record("no hardcoded ActivationID/T in production", "PASS");

  scan_(productionJs, /DEBUG_MUTATION|allowLegacyFallback|forceActiveMode|__TEST_ONLY__|SKIP_GUARD/,
    "DEBUG_OR_BYPASS_FLAG");
  record("no debug mutation/bypass flag", "PASS");

  scan_(productionJs, /numlock\.test|ORD-U\d|ACT-U\d|"u[0-9]-key/, "FIXTURE_ID_IN_PRODUCTION");
  record("no hardcoded disposable/fixture IDs in production", "PASS");

  scan_(productionJs, /testOnly|TEST_ACCOUNT_OVERRIDE|TEST_SCHEMA_OVERRIDE|schemaOverride/,
    "TEST_ONLY_OVERRIDE");
  record("no test-only account/schema override in production", "PASS");

  // ---- 2. Upload manifest state (U9 resolved the U8 registration deferral) ----
  var claspignore = read_(".claspignore");
  var v2Files = ["97.SalesRecognition.V2.Foundation.js", "97A.SalesRecognition.V2.Save.js",
    "97B.SalesRecognition.V2.Projection.js", "97C.SalesRecognition.V2.Correction.js",
    "97D.SalesRecognition.V2.OperatorGuard.js", "97E.SalesRecognition.V2.Activation.js"];
  var v2Registered = v2Files.every(function(file) {
    return claspignore.indexOf("\n!" + file + "\n") !== -1 || claspignore.startsWith("!" + file + "\n");
  });
  var testsRegistered = /^!96\.Tests\./m.test(claspignore);
  if (!v2Registered) fail_("V2_FILES_NOT_REGISTERED",
    "All five 97/97A-97D runtime files must be registered (U9 upload manifest gate)");
  if (testsRegistered) fail_("TESTS_REGISTERED_FOR_UPLOAD");
  record("V2 runtime files registered; tests excluded", "REGISTERED_BY_U9");

  // ---- 3. Secret/env hygiene over clasp-allowlisted + U8 files ----
  var allowlisted = claspignore.split("\n")
    .filter(function(line) { return /^![\w.]+(js|html|json)$/.test(line.trim()); })
    .map(function(line) { return line.trim().slice(1); })
    .filter(function(file) { return fs.existsSync(file); });
  var u8Files = ["96.Tests.SalesRecognition.V2.U8.Cases.js", "_test_runner.js",
    "tests/browser/sales-v2-u8-mutation-proof.js",
    "tests/browser/sales-v2-u8-release-audit.js",
    "docs/SALES-RECOGNITION-V2-U8-RELEASE-EVIDENCE.md"]
    .filter(function(file) { return fs.existsSync(file); });
  var hygieneFiles = allowlisted.concat(u8Files).filter(function(file) {
    // The scanner itself contains the pattern literals; never scan the scanner.
    return path.resolve(file) !== path.resolve(__filename);
  });
  scan_(hygieneFiles,
    /Bearer [A-Za-z0-9._\-]{15,}|eyJ[A-Za-z0-9_\-]{20,}|AKfycb[A-Za-z0-9_\-]{15,}|BEGIN [A-Z ]*PRIVATE KEY|client_secret["']?\s*[:=]\s*["'][^"']{8,}/,
    "SECRET_PATTERN");
  record("no secret/token patterns in release files", "PASS");
  scan_(hygieneFiles, /\/Users\/[A-Za-z0-9_.-]+/, "ABSOLUTE_SHIPPING_PATH");
  record("no shipping absolute paths in release files", "PASS");
  scan_(hygieneFiles, /\.clasprc|password\s*[:=]\s*["'][^"']{4,}/, "CREDENTIAL_REFERENCE");
  record("no credential references in release files", "PASS");

  // ---- 4. Static routing audit: every Sales mutation entrypoint ----
  var routing = [
    { name: "submitOperationalOrder",
      require: ["salesV2OperatorResolvedRoute_", "salesV2OperatorModeCreateOrder_"] },
    { name: "salesV2OperatorModeCreateOrder_",
      require: ["salesRecognitionV2DurableSave", 'route.mode !== "ACTIVE"'] },
    { name: "salesRecognitionV2DurableSave",
      require: ["salesRecognitionV2SaveWithRuntime_", "waitLock"] },
    { name: "submitOperationalPayment",
      require: ["createDurableOperationalPayment_"] },
    { name: "createDurableOperationalPayment_",
      require: ["salesV2OperatorPaymentGuard_"] },
    { name: "payOperationalOrderWithRepository",
      require: ["salesV2OperatorPaymentGuard_"] },
    { name: "submitOperationalFulfillment",
      require: ["transitionOperationalFulfillmentWithRepository"] },
    { name: "transitionOperationalFulfillmentWithRepository",
      require: ["salesV2OperatorFulfillmentGuard_"] },
    { name: "buildCashPostingCandidate",
      require: ["salesV2OperatorCashPostBlocked_"] },
    { name: "submitCanonicalTransactionWithRuntime_",
      require: ["salesV2OperatorLegacySalesGuard_"] },
    { name: "recoverTransactionOperationWithRuntime_",
      require: ["salesV2OperatorIsRecoveryOperation_", "salesV2OperatorRecoverWithRuntime_"] },
    { name: "salesRecognitionV2DurableVoid",
      require: ["salesRecognitionV2DurableMutation_"] },
    { name: "salesRecognitionV2DurableCorrect",
      require: ["salesRecognitionV2DurableMutation_"] },
    { name: "voidCanonicalTransaction",
      require: ["persistCanonicalVoid"], forbid: ["salesRecognitionV2Durable"] },
    { name: "correctCanonicalTransaction",
      require: [], forbid: ["salesRecognitionV2Durable"] },
    { name: "salesV2OperatorCreateWithRuntime_",
      require: ['route.mode === "ACTIVE"', "createDurableOperationalOrder_",
        "salesV2OperatorActiveCreate_"] }
  ];
  routing.forEach(function(entry) {
    var found = functionSource_(entry.name);
    (entry.require || []).forEach(function(token) {
      if (found.source.indexOf(token) === -1) {
        fail_("ROUTING_TOKEN_MISSING", entry.name + "->" + token);
      }
    });
    (entry.forbid || []).forEach(function(token) {
      if (found.source.indexOf(token) !== -1) {
        fail_("ROUTING_FORBIDDEN_TOKEN", entry.name + "->" + token);
      }
    });
    record("routing:" + entry.name, found.file);
  });

  // ---- 5. U8 artifacts exist and stay out of the upload manifest ----
  ["96.Tests.SalesRecognition.V2.U8.Cases.js",
   "tests/browser/sales-v2-u8-mutation-proof.js"].forEach(function(file) {
    if (!fs.existsSync(file)) fail_("U8_ARTIFACT_MISSING", file);
    if (claspignore.indexOf("!" + file) !== -1) fail_("U8_ARTIFACT_REGISTERED", file);
  });
  record("U8 artifacts present, excluded from upload", "PASS");

  return { status: "AUDIT_PASS", checks: checks.length, routing: routing.length,
    details: checks };
}

module.exports = runSalesV2U8ReleaseAudit;
