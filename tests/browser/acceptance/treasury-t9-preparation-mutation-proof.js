// Treasury T9 production-preparation test-sensitivity proof (Node-only;
// executed via `_test_runner.js`). In-memory VM proof over 20 named mutations:
// 12 injected into the `100.Code.js` preparation block, 5 package-manifest
// tamper inputs, 2 package-inclusion tamper inputs, and 1 deployment-order
// tamper input. The clean preparation suites must pass; every mutation must
// fail. Never mutates tracked files; tampered text stays in memory.
var fs = require("fs");
var vm = require("vm");

var CODE_PATH = "100.Code.js";
var CASES_PATH = "96.Tests.Treasury.Receipt.Preparation.Cases.js";

// Same dependency closure as `_test_runner.js` (Treasury runtime + cases) plus
// the preparation host module and the T9 cases.
var SOURCES = [
  "20.Data.Source.js", "22.Transaction.Lifecycle.js", "38.CapitalEquity.Service.js",
  "39.Balance.Foundation.js", "40.Cash.Foundation.js", "41.Inventory.Opening.Staging.js",
  "42.Inventory.Receipt.Foundation.js", "43.Inventory.Receipt.Migration.js",
  "44.Inventory.Receipt.Operational.js", "45.Inventory.Receipt.Orchestration.js",
  "46.Expense.Purchase.Policy.js", "47.Purchase.Events.js", "48.Purchase.Events.Migration.js",
  "21.Transaction.Entry.js", "90.Dashboard.DateRange.js", "90.Dashboard.Service.js",
  "36.Finance.Service.js", "37.Depreciation.Service.js", "12A.Depreciation.Report.Service.js",
  "37.Inventory.Policy.Evidence.js", "91.Transactions.Query.js", "92.Products.Domain.js",
  "93.Master.WritePolicy.js", "94.Supplier.Master.js", "95.Transaction.Operational.js",
  "95A.Transaction.Production.js", "97.SalesRecognition.V2.Foundation.js",
  "97A.SalesRecognition.V2.Save.js", "97B.SalesRecognition.V2.Projection.js",
  "97C.SalesRecognition.V2.Correction.js", "97D.SalesRecognition.V2.OperatorGuard.js",
  "99.Treasury.Receipt.Foundation.js", "99A.Treasury.Receipt.Durable.Save.js",
  "99B.Treasury.Clearing.Projection.js", "99C.Treasury.Receipt.Reversal.Correction.js",
  "99D.Treasury.Operator.Api.js",
  "96.Tests.SalesRecognition.V2.Save.Cases.js",
  "96.Tests.SalesRecognition.V2.Projection.Cases.js",
  "96.Tests.Treasury.Receipt.Foundation.Cases.js",
  "96.Tests.Treasury.Receipt.Durable.Save.Cases.js",
  "96.Tests.Treasury.Clearing.Projection.Cases.js",
  "96.Tests.Treasury.Receipt.Lifecycle.Cases.js",
  "96.Tests.Treasury.Operator.Cases.js"
];

var SUITES = [
  "testTreasuryT9PreparationCore()",
  "testTreasuryT9PreparationPartial()",
  "testTreasuryT9PreparationConfigOnly()",
  "testTreasuryT9PreparationSchemaConflict()",
  "testTreasuryT9PreparationIdempotent()",
  "testTreasuryT9PreparationMalformedConfig()",
  "testTreasuryT9PreparationUnexpectedMode()",
  "testTreasuryT9PreparationAccountReadiness()",
  "testTreasuryT9PreparationCashFlowGroupGate()",
  "testTreasuryT9PreparationCreateFailure()",
  "testTreasuryT9PreparationZeroBusinessRows()",
  "testTreasuryT9PreparationConfigClassification()",
  "testTreasuryT9PreparationPreparedRefusal()",
  "testTreasuryT9PackageRegistration()",
  "testTreasuryT9PreparationSourceAudit()",
  "testTreasuryT9DeploymentOrder()"
];

// 12 source mutations over the preparation block in 100.Code.js. Markers name
// the FIRST check that fires for each mutation across the suite sequence.
var MUTATIONS = [
  { id: "M1_STORED_STATUS_COLUMN",
    anchor: "try { runtime.createSheet(schema.SHEET, schema.HEADERS.slice()); }",
    bug: "try { runtime.createSheet(schema.SHEET, key === \"RECEIPTS\" ?\n" +
      "        schema.HEADERS.concat([\"Status\"]) : schema.HEADERS.slice()); }",
    marker: "TREASURY_T9:T9A4-TreasuryReceipts" },
  { id: "M2_WRONG_RECEIPTS_HEADER_COUNT",
    anchor: "state.headers = sheet.getRange(1, 1, 1, width).getValues()[0]",
    bug: "state.headers = schema.HEADERS.slice(1)",
    marker: "TREASURY_T9:T9A1" },
  { id: "M3_WRONG_OPERATIONS_HEADER_COUNT",
    anchor: "state.headerValidation = validateTreasurySchemaHeaders(key, state.headers).status;",
    bug: "state.headerValidation = validateTreasurySchemaHeaders(key, key === \"OPERATIONS\" ?\n" +
      "      schema.HEADERS.concat([\"Extra\"]) : state.headers).status;",
    marker: "TREASURY_T9:T9A1" },
  { id: "M4_WRONG_AUDITS_HEADER_COUNT",
    anchor: "try { runtime.createSheet(schema.SHEET, schema.HEADERS.slice()); }",
    bug: "try { runtime.createSheet(schema.SHEET, key === \"AUDITS\" ?\n" +
      "        schema.HEADERS.slice(0, 10) : schema.HEADERS.slice()); }",
    marker: "TREASURY_T9:T9A1" },
  { id: "M5_MALFORMED_SHEET_OVERWRITTEN",
    anchor: "if (conflicts.length) {",
    bug: "if (false) {",
    marker: "TREASURY_T9:T9D2-TreasuryReceipts" },
  { id: "M6_CONFIG_ACTIVE",
    anchor: "mode: contract.MODES[0],",
    bug: "mode: contract.MODES[1],",
    marker: "TREASURY_T9:T9A1" },
  { id: "M7_MISSING_CONFIG_NEVER_WRITTEN",
    anchor: "runtime.properties.setProperty(contract.CONFIG_PROPERTY, JSON.stringify(prepared));",
    bug: "/* mutation: preparation never establishes the PREPARED config */",
    marker: "TREASURY_T9:T9A1" },
  { id: "M8_PREP_WRITES_LEDGER",
    anchor: "result.writes.sheets += 1;",
    bug: "result.writes.sheets += 1;\n" +
      "    if (schema.SHEET === \"TreasuryReceipts\") {\n" +
      "      var _ledger = runtime.spreadsheet.getSheetByName(\"BalanceLedger\");\n" +
      "      var _cols = _ledger.getLastColumn();\n" +
      "      _ledger.getRange(_ledger.getLastRow() + 1, 1, 1, _cols)\n" +
      "        .setValues([new Array(_cols).fill(\"T9-MUTATION\")]);\n" +
      "    }",
    marker: "TREASURY_T9:T9N2" },
  { id: "M9_PREP_FAKES_RECEIPT",
    anchor: "result.writes.sheets += 1;",
    bug: "result.writes.sheets += 1;\n" +
      "    if (schema.SHEET === \"TreasuryReceipts\") {\n" +
      "      var _receipts = runtime.spreadsheet.getSheetByName(\"TreasuryReceipts\");\n" +
      "      var _rcols = _receipts.getLastColumn();\n" +
      "      var _fake = new Array(_rcols).fill(\"\");\n" +
      "      _fake[0] = \"TRC-FAKE\";\n" +
      "      _receipts.getRange(_receipts.getLastRow() + 1, 1, 1, _rcols).setValues([_fake]);\n" +
      "    }",
    marker: "TREASURY_T9:T9A1" },
  { id: "M10_PREP_MUTATES_ACCOUNTS",
    anchor: "result.writes.sheets += 1;",
    bug: "result.writes.sheets += 1;\n" +
      "    if (schema.SHEET === \"TreasuryReceipts\") {\n" +
      "      var _accounts = runtime.spreadsheet.getSheetByName(\"Accounts\");\n" +
      "      var _acols = _accounts.getLastColumn();\n" +
      "      _accounts.getRange(_accounts.getLastRow() + 1, 1, 1, _acols)\n" +
      "        .setValues([new Array(_acols).fill(\"T9-MUTATION\")]);\n" +
      "    }",
    marker: "TREASURY_T9:T9N3" },
  { id: "M11_CLEARING_READINESS_BYPASSED",
    anchor: "if (ineligible.length || clearing.status !== \"PASS\") {",
    bug: "if (false) {",
    marker: "TREASURY_T9:T9K1" },
  { id: "M12_DESTINATION_READINESS_BYPASSED",
    anchor: "var ineligible = contract.DESTINATION_ACCOUNT_CODES.filter(function(code) {\n" +
      "    return treasuryDestinationEligible(code, accountRows).eligible !== true;\n" +
      "  });",
    bug: "var ineligible = [];",
    marker: "TREASURY_T9:T9K1" }
];

function harnessGlobals_() {
  return {
    fs: require("fs"),
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
      getScriptCache: function() { return { get: function() { return null; }, put: function() {} }; }
    },
    SpreadsheetApp: { getActiveSpreadsheet: function() { throw new Error("NO_SPREADSHEET_MOCK"); } },
    Session: { getScriptTimeZone: function() { return "Asia/Jakarta"; } },
    invalidateDashboardCache: function() {},
    getDashboardCacheRevision: function() { return "LOCAL_FIXTURE"; },
    dateFormat: function() { return "yyyy-MM-dd"; }
  };
}

function loadContext_(codeSource, casesSource) {
  var ctx = vm.createContext(harnessGlobals_());
  SOURCES.forEach(function(file) {
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  });
  vm.runInContext(
    "globalThis.invalidateDashboardCache = function() {};" +
    "globalThis.getDashboardCacheRevision = function() { return 'LOCAL_FIXTURE'; };",
    ctx);
  vm.runInContext(codeSource, ctx, { filename: CODE_PATH });
  vm.runInContext(casesSource, ctx, { filename: CASES_PATH });
  return ctx;
}

function runSuites_(ctx) {
  SUITES.forEach(function(code) { vm.runInContext(code, ctx); });
}

// Tampered-input checks that never touch tracked files (package + process).
function runTamperedInputChecks_(cleanCtx) {
  var fs2 = require("fs");
  var allowlistText = fs2.readFileSync(".claspignore", "utf8");
  var t8Text = fs2.readFileSync("tests/tmp/t8-package-manifest.json", "utf8");
  var failures = [];
  function expectThrow(id, fn) {
    try { fn(); failures.push(id + ":DID_NOT_FAIL"); }
    catch (error) { /* expected */ }
  }
  // M13-M17: the package closure must fail when any one Treasury runtime file
  // is dropped from the upload allowlist.
  ["99.Treasury.Receipt.Foundation.js", "99A.Treasury.Receipt.Durable.Save.js",
   "99B.Treasury.Clearing.Projection.js", "99C.Treasury.Receipt.Reversal.Correction.js",
   "99D.Treasury.Operator.Api.js"].forEach(function(file, index) {
    expectThrow("M" + (13 + index), function() {
      vm.runInContext(
        "treasuryT9PackageCheck_(" + JSON.stringify(
          allowlistText.split("\n").filter(function(line) {
            return line.trim() !== "!" + file;
          }).join("\n")) + ", " + JSON.stringify(t8Text) + ")",
        cleanCtx);
    });
  });
  // M18: a test file in the allowlist must fail.
  expectThrow("M18", function() {
    vm.runInContext(
      "treasuryT9PackageCheck_(" + JSON.stringify(allowlistText +
        "\n!96.Tests.Treasury.Receipt.Preparation.Cases.js\n") + ", " +
      JSON.stringify(t8Text) + ")", cleanCtx);
  });
  // M19: docs/tmp in the allowlist must fail.
  expectThrow("M19", function() {
    vm.runInContext(
      "treasuryT9PackageCheck_(" + JSON.stringify(allowlistText +
        "\n!docs/TREASURY-T9-PRODUCTION-PREPARATION.md\n") + ", " +
      JSON.stringify(t8Text) + ")", cleanCtx);
  });
  // M20: hash/manifest drift (a prospective fingerprint that lost a Treasury
  // file) must fail — drift is never ignored.
  var drifted = JSON.parse(t8Text);
  drifted.prospective.count = 75;
  drifted.prospective.files = drifted.prospective.files.filter(function(entry) {
    return entry.path !== "99.Treasury.Receipt.Foundation.js";
  });
  expectThrow("M20", function() {
    vm.runInContext(
      "treasuryT9PackageCheck_(" + JSON.stringify(allowlistText) + ", " +
      JSON.stringify(JSON.stringify(drifted)) + ")", cleanCtx);
  });
  // Push-before-status-gate ordering must fail.
  expectThrow("M21_ORDER", function() {
    vm.runInContext(
      "treasuryT9DeploymentOrderCheck_(['local_validation', 'clasp_push', " +
      "'clasp_status_gate', 'version_and_deployment', 'production_preparation_invoke', " +
      "'production_readback', 'package_manifest_recalc'])", cleanCtx);
  });
  return failures;
}

function runTreasuryT9PreparationMutationProof() {
  var codeSource = fs.readFileSync(CODE_PATH, "utf8");
  var casesSource = fs.readFileSync(CASES_PATH, "utf8");

  // Clean baseline: every suite must pass on the untouched sources.
  var cleanCtx = loadContext_(codeSource, casesSource);
  var cleanFailure = null;
  try { runSuites_(cleanCtx); }
  catch (error) { cleanFailure = String(error && error.message || error); }
  if (cleanFailure) {
    throw new Error("TREASURY_T9_PROOF:CLEAN_BASELINE_FAILED|" + cleanFailure);
  }

  var tamperFailures = runTamperedInputChecks_(cleanCtx);
  if (tamperFailures.length) {
    throw new Error("TREASURY_T9_PROOF:TAMPER_CHECKS_DID_NOT_FAIL|" + tamperFailures.join(","));
  }

  var caught = 0, results = [];
  MUTATIONS.forEach(function(mutation) {
    var mutated = mutation.replace === undefined ?
      codeSource.replace(mutation.anchor, mutation.bug) :
      codeSource.replace(mutation.anchor, mutation.replace);
    if (mutated === codeSource) {
      throw new Error("TREASURY_T9_PROOF:ANCHOR_MISS|" + mutation.id);
    }
    var outcome = { id: mutation.id, caught: false, marker: null };
    try {
      runSuites_(loadContext_(mutated, casesSource));
    } catch (error) {
      var message = String(error && error.message || error);
      outcome.marker = message.split("|")[0];
      outcome.caught = message.indexOf(mutation.marker) === 0 ||
        message.indexOf(mutation.marker) !== -1;
    }
    if (outcome.caught) caught += 1;
    results.push(outcome);
  });

  return {
    passed: caught === MUTATIONS.length,
    total: MUTATIONS.length + 9,
    sourceMutations: MUTATIONS.length,
    caught: caught,
    tamperChecks: 9,
    failures: results.filter(function(r) { return !r.caught; }).map(function(r) { return r.id; }),
    results: results
  };
}

module.exports = runTreasuryT9PreparationMutationProof;
