// SALES_RECOGNITION_V2 U6 test-sensitivity proof (Node-only; executed via
// `_test_runner.js`). In-memory VM proof: reads the U6 mutation source (and
// the legacy lifecycle source for the cross-guard case), injects one contract
// bug at a time into a VM copy ONLY, and asserts the designated U6 suite
// passes clean and FAILS at the expected marker under each injected bug.
// Covers: Void accounting direction, original-identity protection, full
// reversal+replacement (never delta-only), ONE atomic batch, plan-controlled
// retry (no master re-read), duplicate-terminal prevention, UNKNOWN preserved
// on timeout, legacy rejection of V2 identities, action-period EconomicDate,
// and the Policy C no-forged-journal rule. Never mutates tracked files.
var fs = require("fs");
var vm = require("vm");

var MUTATION_PATH = "97C.SalesRecognition.V2.Correction.js";
var LEGACY_PATH = "22.Transaction.Lifecycle.js";
// Dependency closure mirrors the local harness file list so every fixture and
// cross-layer helper resolves exactly as it does in `_test_runner.js`.
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
  "96.Tests.SalesRecognition.V2.Save.Cases.js",
  "96.Tests.SalesRecognition.V2.Projection.Cases.js",
  "96.Tests.SalesRecognition.V2.U4.Cases.js",
  "96.Tests.SalesRecognition.V2.U5.Cases.js",
  "96.Tests.SalesRecognition.V2.U6.Cases.js"
];
var ALL_U6_SUITES = ["testSalesRecognitionV2U6VoidCore",
  "testSalesRecognitionV2U6VoidRecovery",
  "testSalesRecognitionV2U6VoidIntegrity",
  "testSalesRecognitionV2U6CorrectCore",
  "testSalesRecognitionV2U6CorrectRecovery",
  "testSalesRecognitionV2U6Lifecycle",
  "testSalesRecognitionV2U6CrossLayer",
  "testSalesRecognitionV2U6PolicyC",
  "testSalesRecognitionV2U6Legacy",
  "testSalesRecognitionV2U6Transport",
  "testSalesRecognitionV2U6SourceAudit"];
var MUTATIONS = [
  { name: "Void credits Cr1100 instead of Cr1030",
    file: MUTATION_PATH,
    anchor: "AccountCode: save.JOURNAL_ACCOUNTS.SETTLEMENT, Debit: 0, Credit: amount,",
    bug: 'AccountCode: "1100", Debit: 0, Credit: amount,',
    suite: "testSalesRecognitionV2U6VoidCore",
    marker: "SALES_V2_U6_VOID_CORE:" },
  { name: "Void reuses the original recognition identity",
    file: MUTATION_PATH,
    anchor: "var eventRow = { RecognitionID: recognitionID,",
    bug: "var eventRow = { RecognitionID: target.recognitionID,",
    suite: "testSalesRecognitionV2U6VoidCore",
    marker: "SALES_V2_U6_VOID_CORE:" },
  { name: "Correct posts delta-only replacement amount",
    file: MUTATION_PATH,
    anchor: "Amount: orderTotal,",
    bug: "Amount: orderTotal - input.target.amount,",
    suite: "testSalesRecognitionV2U6CorrectCore",
    marker: "SALES_V2_U6_CORRECT_CORE:" },
  { name: "Correct splits the mutation across two batches",
    file: MUTATION_PATH,
    anchor: "try { runtime.batch(ranges, plan.operationType); } catch (error) { batchError = error; }",
    bug: "try { runtime.batch(ranges.slice(0, 2), plan.operationType); runtime.batch(ranges.slice(2), plan.operationType); } catch (error) { batchError = error; }",
    suite: "testSalesRecognitionV2U6Transport",
    marker: "SALES_V2_U6_TRANSPORT:" },
  { name: "Retry re-reads master authority instead of the persisted plan",
    file: MUTATION_PATH,
    anchor: "if (!plan || plan.requestKey !== requestKey || plan.payloadHash !== hash ||",
    bug: 'if (typeof runtime.readAuthority === "function") runtime.readAuthority();\n  if (!plan || plan.requestKey !== requestKey || plan.payloadHash !== hash ||',
    suite: "testSalesRecognitionV2U6CorrectCore",
    marker: "SALES_V2_U6_CORRECT_CORE:" },
  { name: "Duplicate terminal reversal allowed (eligibility bypass)",
    file: MUTATION_PATH,
    anchor: "if (terminal) {",
    bug: "if (false) {",
    suite: "testSalesRecognitionV2U6Lifecycle",
    marker: "SALES_V2_U6_LIFECYCLE:" },
  { name: "Batch timeout collapsed into a definite failure",
    file: MUTATION_PATH,
    anchor: "    if (batchError && inspection.state === \"NONE\") {\n      return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.UNKNOWN, {\n        code: codes.BATCH_OUTCOME_UNKNOWN, writeCount: \"UNKNOWN\",\n        detail: inspection.detail });\n    }",
    bug: "    if (batchError && inspection.state === \"NONE\") {\n      return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.RECOVERY_REQUIRED, {\n        code: codes.BATCH_OUTCOME_UNKNOWN, writeCount: \"UNKNOWN\",\n        detail: inspection.detail });\n    }",
    suite: "testSalesRecognitionV2U6VoidRecovery",
    marker: "SALES_V2_U6_VOID_RECOVERY:" },
  { name: "Legacy handler accepts V2 identities",
    file: LEGACY_PATH,
    anchor: "if (id.indexOf(\"OPS-\") === 0) return { type: \"EXPENSE\", sheetName: \"tabops\", headers: CANONICAL_ENTRY.EXPENSE_HEADERS };",
    bug: "if (id.indexOf(\"OPS-\") === 0) return { type: \"EXPENSE\", sheetName: \"tabops\", headers: CANONICAL_ENTRY.EXPENSE_HEADERS };\n  if (id.indexOf(\"ORD-\") === 0 || id.indexOf(\"ORDER:\") === 0) return { type: \"SALES\", sheetName: \"tabsal\", headers: CANONICAL_ENTRY.SALES_HEADERS };",
    suite: "testSalesRecognitionV2U6Legacy",
    marker: "SALES_V2_U6_LEGACY:" },
  { name: "Reversal EconomicDate backdated to the original period",
    file: MUTATION_PATH,
    anchor: "var economicDate = capitalEquityDateKey(now);",
    bug: "var economicDate = target.economicDate;",
    suite: "testSalesRecognitionV2U6CrossLayer",
    marker: "SALES_V2_U6_CROSS:" },
  { name: "Forged extra 2010 journal row inside the reversal plan",
    file: MUTATION_PATH,
    anchor: "      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor }\n  ];",
    bug: "      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor },\n    { JournalID: journalID, LineID: journalID + \"-3\", Tanggal: economicDate,\n      AccountCode: \"2010\", Debit: 0, Credit: amount,\n      MovementType: save.JOURNAL_MOVEMENT_TYPE, SourceType: save.JOURNAL_SOURCE_TYPE,\n      SourceID: recognitionID, ExternalRef: \"\", Keterangan: \"\", IsActive: true,\n      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor }\n  ];",
    suite: "testSalesRecognitionV2U6PolicyC",
    marker: "SALES_V2_U6_POLICYC:" }
];

function u6ProofStubs_() {
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
      getScriptCache: function() {
        return { get: function() { return null; }, put: function() {} };
      }
    },
    invalidateDashboardCache: function() {},
    getDashboardCacheRevision: function() { return "LOCAL_FIXTURE"; },
    sessionStorage: {
      getItem: function() { return null; },
      setItem: function() {},
      removeItem: function() {}
    },
    PURCHASE_RECOVERY_STORAGE_KEY: "numlock.purchase.mutationRecovery",
    savePurchaseRecoveryState: function() {},
    loadPurchaseRecoveryState: function() { return null; },
    clearPurchaseRecoveryState: function() {}
  };
}

function runU6Suites_(suites, overrides) {
  var ctx = vm.createContext({});
  var stubs = u6ProofStubs_();
  Object.keys(stubs).forEach(function(key) { ctx[key] = stubs[key]; });
  SOURCES.forEach(function(file) {
    var source = overrides && overrides[file] !== undefined ? overrides[file] :
      fs.readFileSync(file, "utf8");
    vm.runInContext(source, ctx, { filename: file });
  });
  // Harness-level stubs stay authoritative after the dashboard service load.
  ctx.invalidateDashboardCache = function() {};
  ctx.getDashboardCacheRevision = function() { return "LOCAL_FIXTURE"; };
  var failures = [];
  suites.forEach(function(name) {
    try { vm.runInContext(name + "()", ctx); }
    catch (error) { failures.push(String(error && error.message || error)); }
  });
  return failures;
}

function runSalesV2U6MutationProof() {
  var sources = {};
  sources[MUTATION_PATH] = fs.readFileSync(MUTATION_PATH, "utf8");
  sources[LEGACY_PATH] = fs.readFileSync(LEGACY_PATH, "utf8");
  MUTATIONS.forEach(function(mutation) {
    var target = sources[mutation.file];
    var anchors = target.split(mutation.anchor).length - 1;
    if (anchors !== 1) {
      throw new Error("MUTATION_ANCHOR_UNEXPECTED:" + mutation.name + ":" + anchors);
    }
  });
  var clean = runU6Suites_(ALL_U6_SUITES, null);
  if (clean.length) throw new Error("PROOF_CLEAN_FAILED:" + clean[0]);
  var results = MUTATIONS.map(function(mutation) {
    var mutated = sources[mutation.file].replace(mutation.anchor, mutation.bug);
    if (mutated === sources[mutation.file]) {
      throw new Error("MUTATION_NOT_APPLIED:" + mutation.name);
    }
    var overrides = {};
    overrides[mutation.file] = mutated;
    var failures;
    try {
      failures = runU6Suites_([mutation.suite], overrides);
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
  return { status: "SENSITIVITY_PROVEN", cleanSuites: ALL_U6_SUITES.length,
    mutations: results.length, results: results };
}

module.exports = runSalesV2U6MutationProof;
