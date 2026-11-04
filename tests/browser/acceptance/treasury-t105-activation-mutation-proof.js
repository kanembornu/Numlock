// Treasury T10.5 activation test-sensitivity proof (Node-only; executed via
// `_test_runner.js`). In-memory VM proof over 20 named mutations: 15 injected
// into the activation block of `100.Code.js` (caught by the A1-A16 suites)
// and 5 structural/tamper inputs fed to the pure call-graph/writer audit
// (caught without touching a tracked file). The clean activation suites must
// pass first; every mutation must fail at its named marker. Never mutates
// tracked files; tampered text stays in memory.
var fs = require("fs");
var vm = require("vm");

var CODE_PATH = "100.Code.js";
var CASES_PATH = "96.Tests.Treasury.Activation.Cases.js";
var UI_PATHS = ["202.View.Treasury.State.html", "203.View.Treasury.Render.html",
  "204.View.Treasury.Controller.html"];

// Same dependency closure as `_test_runner.js` (full fixture closure: U3/U5
// Sales fixtures, T4/T5/T9 Treasury fixtures), minus the host module and the
// T10.5 cases which load separately.
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
  "97E.SalesRecognition.V2.Activation.js",
  "99.Treasury.Receipt.Foundation.js", "99A.Treasury.Receipt.Durable.Save.js",
  "99B.Treasury.Clearing.Projection.js", "99C.Treasury.Receipt.Reversal.Correction.js",
  "99D.Treasury.Operator.Api.js",
  "96.Tests.SalesRecognition.V2.Save.Cases.js",
  "96.Tests.SalesRecognition.V2.Projection.Cases.js",
  "96.Tests.SalesRecognition.V2.U4.Cases.js",
  "96.Tests.SalesRecognition.V2.U5.Cases.js",
  "96.Tests.SalesRecognition.V2.U6.Cases.js",
  "96.Tests.SalesRecognition.V2.U7.Cases.js",
  "96.Tests.SalesRecognition.V2.U8.Cases.js",
  "96.Tests.SalesRecognition.V2.Activation.Cases.js",
  "96.Tests.Treasury.Receipt.Foundation.Cases.js",
  "96.Tests.Treasury.Receipt.Durable.Save.Cases.js",
  "96.Tests.Treasury.Clearing.Projection.Cases.js",
  "96.Tests.Treasury.Receipt.Lifecycle.Cases.js",
  "96.Tests.Treasury.Operator.Cases.js",
  "96.Tests.Treasury.Receipt.Preparation.Cases.js"
];

var SUITES = [
  "testTreasuryT105ActivationPreparedToActive()",
  "testTreasuryT105ActivationIdempotent()",
  "testTreasuryT105ActivationAbsentConfig()",
  "testTreasuryT105ActivationMalformedConfig()",
  "testTreasuryT105ActivationPausedRefused()",
  "testTreasuryT105ActivationSurfaceGates()",
  "testTreasuryT105ActivationAccountGate()",
  "testTreasuryT105ActivationClearingGate()",
  "testTreasuryT105ActivationResidualGate()",
  "testTreasuryT105ActivationOutstandingAllowed()",
  "testTreasuryT105ActivationConfigOnlyWrite()",
  "testTreasuryT105ActivationBusinessRowsUnchanged()",
  "testTreasuryT105ActivationLedgerUnchanged()",
  "testTreasuryT105ActivationSalesUnchanged()",
  "testTreasuryT105ActivationIdentityReadback()",
  "testTreasuryT105ActivationAmbiguousRecovery()"
];

// 15 behavioral source mutations over the activation block. The marker names
// the FIRST A-check that must fail for each mutation across the suite order.
var MUTATIONS = [
  { id: "M1_SCHEMA_VALIDATION_REMOVED",
    anchor: "return state.exists !== true || state.headersExact !== true;",
    bug: "return false;",
    marker: "TREASURY_T105:A6" },
  { id: "M2_BUSINESS_ROWS_IGNORED",
    anchor: "return inspection.sheets[key].businessRows !== 0;",
    bug: "return false;",
    marker: "TREASURY_T105:A6c" },
  { id: "M3_DESTINATION_VALIDATION_REMOVED",
    anchor: "if (treasuryDestinationEligible(code, accountRows).eligible !== true) {",
    bug: "if (false) {",
    marker: "TREASURY_T105:A7" },
  { id: "M4_CLEARING_VALIDATION_REMOVED",
    anchor: "if (ineligible.length !== 0 || clearing.status !== \"PASS\") {",
    bug: "if (ineligible.length !== 0) {",
    marker: "TREASURY_T105:A8" },
  { id: "M5_REQUIRE_1030_NET_ZERO",
    anchor: "if (Number(reconciliation.unexplainedResidual) !== 0 ||",
    bug: "if (reconciliation.ledgerNet1030 !== 0 ||",
    marker: "TREASURY_T105:A1" },
  { id: "M6_ALLOW_RESIDUAL_NONZERO",
    anchor: "if (Number(reconciliation.unexplainedResidual) !== 0 ||\n" +
      "      String(reconciliation.reconciliationStatus) !== \"OK\") {",
    bug: "if (false) {",
    marker: "TREASURY_T105:A9" },
  { id: "M7_CREATES_RECEIPT_ROW",
    anchor: "result.writes.config = 1;",
    bug: "result.writes.config = 1;\n" +
      "  var _m7sheet = runtime.spreadsheet.getSheetByName(\"TreasuryReceipts\");\n" +
      "  var _m7cols = _m7sheet.getLastColumn();\n" +
      "  var _m7row = new Array(_m7cols).fill(\"\");\n" +
      "  _m7row[0] = \"TRC-MUTATION\";\n" +
      "  _m7sheet.getRange(_m7sheet.getLastRow() + 1, 1, 1, _m7cols).setValues([_m7row]);",
    marker: "TREASURY_T105:A11c-TreasuryReceipts" },
  { id: "M8_WRITES_BALANCE_LEDGER",
    anchor: "result.writes.config = 1;",
    bug: "result.writes.config = 1;\n" +
      "  var _m8sheet = runtime.spreadsheet.getSheetByName(\"BalanceLedger\");\n" +
      "  var _m8cols = _m8sheet.getLastColumn();\n" +
      "  var _m8row = new Array(_m8cols).fill(\"\");\n" +
      "  _m8row[0] = \"J-MUTATION\";\n" +
      "  _m8sheet.getRange(_m8sheet.getLastRow() + 1, 1, 1, _m8cols).setValues([_m8row]);",
    marker: "TREASURY_T105:A11c-BalanceLedger" },
  { id: "M9_CHANGES_SALES",
    anchor: "result.writes.config = 1;",
    bug: "result.writes.config = 1;\n" +
      "  var _m9sheet = runtime.spreadsheet.getSheetByName(\"SalesRecognitionEvents\");\n" +
      "  var _m9cols = _m9sheet.getLastColumn();\n" +
      "  var _m9row = new Array(_m9cols).fill(\"\");\n" +
      "  _m9row[0] = \"SRE-MUTATION\";\n" +
      "  _m9sheet.getRange(_m9sheet.getLastRow() + 1, 1, 1, _m9cols).setValues([_m9row]);",
    marker: "TREASURY_T105:A11c-SalesRecognitionEvents" },
  { id: "M10_CHANGES_ACCOUNTS",
    anchor: "result.writes.config = 1;",
    bug: "result.writes.config = 1;\n" +
      "  var _m10sheet = runtime.spreadsheet.getSheetByName(\"Accounts\");\n" +
      "  var _m10cols = _m10sheet.getLastColumn();\n" +
      "  var _m10row = new Array(_m10cols).fill(\"\");\n" +
      "  _m10row[0] = \"9999\";\n" +
      "  _m10sheet.getRange(_m10sheet.getLastRow() + 1, 1, 1, _m10cols).setValues([_m10row]);",
    marker: "TREASURY_T105:A11c-Accounts" },
  { id: "M11_EMPTY_ACTIVATION_ID",
    anchor: "activationID = contract.ID_PREFIXES.ACTIVATION + String(runtime.uuid());",
    bug: "activationID = contract.ID_PREFIXES.ACTIVATION;",
    marker: "TREASURY_T105:A1" },
  { id: "M12_CLIENT_ACTIVATED_AT",
    anchor: "activatedAt = now instanceof Date ? now.toISOString() : String(now);",
    bug: "activatedAt = String(runtime.clientSuppliedAt || \"\");",
    marker: "TREASURY_T105:A1" },
  { id: "M13_SECOND_IDENTITY_ON_ACTIVE",
    anchor: "if (mode === contract.MODES[1]) {\n" +
      "    result.status = act.STATUS.NOOP_ALREADY_ACTIVE;\n" +
      "    result.config = treasuryActivationConfigFields_(current);\n" +
      "    return result;\n" +
      "  }",
    bug: "if (mode === contract.MODES[1]) {\n" +
      "    var _m13 = { contractVersion: current.contractVersion, mode: current.mode,\n" +
      "      activationID: contract.ID_PREFIXES.ACTIVATION + String(runtime.uuid()),\n" +
      "      activatedAt: String(runtime.now()), configVersion: current.configVersion };\n" +
      "    runtime.properties.setProperty(contract.CONFIG_PROPERTY, JSON.stringify(_m13));\n" +
      "    result.writes.config = 1;\n" +
      "    result.status = act.STATUS.ACTIVATED;\n" +
      "    result.config = treasuryActivationConfigFields_(_m13);\n" +
      "    return result;\n" +
      "  }",
    marker: "TREASURY_T105:A2b" },
  { id: "M14_BAD_CONFIG_VERSION",
    anchor: "var nextConfigVersion = current.configVersion;",
    bug: "var nextConfigVersion = current.configVersion + 1;",
    marker: "TREASURY_T105:A15f" },
  { id: "M15_ACTIVE_BEFORE_READBACK",
    anchor: "if (String(written.mode) !== activated.mode ||\n" +
      "      written.contractVersion !== activated.contractVersion ||\n" +
      "      written.activationID !== activated.activationID ||\n" +
      "      written.activatedAt !== activated.activatedAt ||\n" +
      "      written.configVersion !== activated.configVersion) {",
    bug: "if (false) {",
    marker: "TREASURY_T105:A15h" }
];

// 5 structural mutations over the whole host file, judged by the pure
// call-graph/writer audit (no tracked file is ever touched).
var STRUCTURAL = [
  { id: "M16_NO_SCRIPT_LOCK",
    anchor: "lock.waitLock(30000);",
    bug: "" },
  { id: "M17_PREPARED_CHECK_OUTSIDE_LOCK",
    anchor: "var lock = null, acquired = false;",
    bug: "var preLockConfig = runtime.properties.getProperty(\"TREASURY_RECEIPT_V1_CONFIG\");\n" +
      "  var lock = null, acquired = false;" },
  { id: "M18_BUNDLED_INTO_PREP",
    anchor: "return treasuryProductionPreparationApplyWithRuntime_(runtime);",
    bug: "treasuryActivationApplyWithRuntime_(runtime);\n" +
      "    return treasuryProductionPreparationApplyWithRuntime_(runtime);" },
  { id: "M19_CALLS_T4_SAVE",
    anchor: "result.writes.config = 1;",
    bug: "result.writes.config = 1;\n  treasuryReceiptSaveWithRuntime_({}, runtime);" },
  { id: "M20_CALLS_T6_REVERSE",
    anchor: "result.writes.config = 1;",
    bug: "result.writes.config = 1;\n  treasuryLifecycleReverseWithRuntime_({}, runtime);" }
];

function harnessGlobals_() {
  return {
    fs: require("fs"),
    Logger: { log: function() {} },
    Utilities: {
      getUuid: function() { return "7f3c1d20-4a5e-4b7a-9c11-0e5d2f8a6b41"; },
      formatDate: function(d, tz, fmt) { return d.toISOString().slice(0, 19) + ".000Z"; }
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
  SUITES.concat(["testTreasuryT105ActivationSourceAudit()"]).forEach(function(code) {
    vm.runInContext(code, ctx);
  });
}

function readUi_(uiTexts) {
  return UI_PATHS.map(function(path) { return uiTexts[path]; }).join("\n");
}

// Structural mutations are judged by the pure audit fed tampered source text.
function runStructuralChecks_(cleanCtx, uiTexts) {
  var codeSource = fs.readFileSync(CODE_PATH, "utf8");
  var uiText = readUi_(uiTexts);
  var failures = [];
  STRUCTURAL.forEach(function(mutation) {
    var mutated = codeSource.replace(mutation.anchor, mutation.bug);
    if (mutated === codeSource) {
      failures.push(mutation.id + ":ANCHOR_MISS");
      return;
    }
    try {
      vm.runInContext(
        "treasuryT105SourceAuditCheck_(" + JSON.stringify(mutated) + ", " +
        JSON.stringify(uiText) + ")", cleanCtx);
      failures.push(mutation.id + ":DID_NOT_FAIL");
    } catch (error) {
      var message = String(error && error.message || error);
      if (message.indexOf("TREASURY_T105:") !== 0) {
        failures.push(mutation.id + ":UNEXPECTED:" + message);
      }
    }
  });
  return failures;
}

function runTreasuryT105ActivationMutationProof() {
  var codeSource = fs.readFileSync(CODE_PATH, "utf8");
  var casesSource = fs.readFileSync(CASES_PATH, "utf8");
  var uiTexts = {};
  UI_PATHS.forEach(function(path) { uiTexts[path] = fs.readFileSync(path, "utf8"); });

  // Clean baseline: every A-suite + the source audit must pass untouched.
  var cleanCtx = loadContext_(codeSource, casesSource);
  var cleanFailure = null;
  try { runSuites_(cleanCtx); }
  catch (error) { cleanFailure = String(error && error.message || error); }
  if (cleanFailure) {
    throw new Error("TREASURY_T105_PROOF:CLEAN_BASELINE_FAILED|" + cleanFailure);
  }

  var structuralFailures = runStructuralChecks_(cleanCtx, uiTexts);
  if (structuralFailures.length) {
    throw new Error("TREASURY_T105_PROOF:STRUCTURAL_DID_NOT_FAIL|" +
      structuralFailures.join(","));
  }

  var caught = 0, results = [];
  MUTATIONS.forEach(function(mutation) {
    var mutated = codeSource.replace(mutation.anchor, mutation.bug);
    if (mutated === codeSource) {
      throw new Error("TREASURY_T105_PROOF:ANCHOR_MISS|" + mutation.id);
    }
    var outcome = { id: mutation.id, caught: false, marker: null };
    try {
      runSuites_(loadContext_(mutated, casesSource));
    } catch (error) {
      var message = String(error && error.message || error);
      outcome.marker = message.split("|")[0];
      outcome.caught = message.indexOf(mutation.marker) !== -1;
    }
    if (outcome.caught) caught += 1;
    results.push(outcome);
  });

  var total = MUTATIONS.length + STRUCTURAL.length;
  var missed = results.filter(function(r) { return !r.caught; }).map(function(r) {
    return r.id + "@" + String(r.marker);
  });
  // Fail closed: an uncaught mutation is a test gap, never a silent pass.
  if (missed.length) {
    throw new Error("TREASURY_T105_PROOF:NOT_CAUGHT|" + missed.join(","));
  }
  return {
    passed: caught === MUTATIONS.length,
    total: total,
    sourceMutations: MUTATIONS.length,
    structuralChecks: STRUCTURAL.length,
    caught: caught,
    failures: missed,
    structuralIds: STRUCTURAL.map(function(m) { return m.id; }),
    results: results
  };
}

module.exports = runTreasuryT105ActivationMutationProof;
