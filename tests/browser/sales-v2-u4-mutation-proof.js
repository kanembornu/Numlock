// SALES_RECOGNITION_V2 U4 test-sensitivity proof (Node-only; executed via
// `_test_runner.js`). In-memory VM proof: reads the canonical Transaction
// reader source, injects one contract bug at a time into a VM copy ONLY, and
// asserts the U4 suites pass clean and FAIL at the expected marker under each
// injected bug. Covers: U3 projection as the sole Sales authority (no direct
// Order reads), unpaid exclusion, one header per multiline order, Payment
// never a Sale, pending-V2 with no legacy fallback, and no legacy Correct/
// Void for V2. Never mutates tracked files.
var fs = require("fs");
var vm = require("vm");

var READER_PATH = "91.Transactions.Query.js";
// Dependency closure: canonical source/lifecycle, purchase/date/dashboard read
// chain, SalesRecognition V2 foundation/save/projection, shared fixtures.
var SOURCES = [
  "20.Data.Source.js",
  "22.Transaction.Lifecycle.js",
  "21.Transaction.Entry.js",
  "36.Finance.Service.js",
  "38.CapitalEquity.Service.js",
  "39.Balance.Foundation.js",
  "40.Cash.Foundation.js",
  "43.Inventory.Receipt.Migration.js",
  "47.Purchase.Events.js",
  "90.Dashboard.DateRange.js",
  "90.Dashboard.Service.js",
  "91.Transactions.Query.js",
  "92.Products.Domain.js",
  "93.Master.WritePolicy.js",
  "94.Supplier.Master.js",
  "95.Transaction.Operational.js",
  "95A.Transaction.Production.js",
  "97.SalesRecognition.V2.Foundation.js",
  "97A.SalesRecognition.V2.Save.js",
  "97B.SalesRecognition.V2.Projection.js",
  "96.Tests.SalesRecognition.V2.Save.Cases.js",
  "96.Tests.SalesRecognition.V2.Projection.Cases.js",
  "96.Tests.SalesRecognition.V2.U4.Cases.js"
];
var SUITES = ["testSalesRecognitionV2U4ReaderCohorts",
  "testSalesRecognitionV2U4ReaderList",
  "testSalesRecognitionV2U4ReaderDetail"];
var MUTATIONS = [
  { name: "bypass U3: read Orders directly as the Sales authority",
    anchor: "projection.transactions.forEach(function(header) {",
    bug: 'readCanonicalTable(ss, "Orders", []).map(function(order) { return { kind: "ORDER", headerId: String(order.OrderID || ""), sourceIdentity: "ORDER:" + String(order.OrderID || ""), cohort: "PRE_V2_ORDER", status: "RECOGNIZED", economicDateKey: salesProjectionDateKey_(order.CreatedAt), amount: Number(order.OrderTotal) || 0, orderType: String(order.OrderType || ""), recognitionId: "", revisionId: "" }; }).forEach(function(header) {',
    marker: "SALES_V2_U4_COHORTS:A3" },
  { name: "include the unpaid old Order as a Sale",
    anchor: "      var voidedEvent = salesRecognitionVoidedChainEvent_(projection, orderKey, header);\n      if (!voidedEvent) return;\n      claimed[orderKey] = true;\n      if (!withinRange(voidedEvent.dateKey)) return;\n      rows.push(buildTransactionSalesOrderRow_(header, voidedEvent, projection,\n        qualityIndex, { isActive: false, status: \"VOIDED\" }));",
    bug: '      var voidedEvent = (!activeEvent && header.status !== "RECOGNIZED") ? { dateKey: header.economicDateKey, signedAmount: header.amount, recognitionId: null, revisionId: null, snapshot: null, namespace: orderKey, eventType: "RECOGNITION", originalId: null, replacementId: null, recognizedAt: "" } : salesRecognitionVoidedChainEvent_(projection, orderKey, header);\n      if (!voidedEvent) return;\n      claimed[orderKey] = true;\n      if (!withinRange(voidedEvent.dateKey)) return;\n      rows.push(buildTransactionSalesOrderRow_(header, voidedEvent, projection,\n        qualityIndex, { isActive: true }));',
    marker: "SALES_V2_U4_COHORTS:A7" },
  { name: "one transaction per line instead of one header",
    anchor: "rows.push(buildTransactionSalesOrderRow_(header, activeEvent, projection, qualityIndex));",
    bug: "salesRecognitionDetailLines_(projection, header, activeEvent).forEach(function() { rows.push(buildTransactionSalesOrderRow_(header, activeEvent, projection, qualityIndex)); });",
    marker: "SALES_V2_U4_COHORTS:A10" },
  { name: "Payment rendered as a separate Sale",
    anchor: "return { rows: rows, projection: projection };",
    bug: 'readCanonicalTable(ss, "Payments", []).forEach(function(payment) { rows.push({ id: "PAY-" + payment.PaymentID, date: "2026-10-01", transactionType: "Sales", canonicalTransactionType: "Sales", product: "", productId: "", productVariantId: "", purchaseCategory: "", qty: 1, revenue: salesRecognitionNumber_(payment.Amount), expense: 0, source: "MUTATION", isActive: true, salesIdentity: "PAYMENT:" + payment.PaymentID, salesSourceLabel: "LEGACY_SALE", salesCohort: "TABSAL_LEGACY", recognitionId: null, revisionId: null, recognitionStatus: "RECOGNIZED", salesQuality: { issues: [], excluded: [] } }); }); return { rows: rows, projection: projection };',
    marker: "SALES_V2_U4_COHORTS:A6" },
  { name: "pending V2 falls back to a legacy-shaped Sale row",
    anchor: "      var voidedEvent = salesRecognitionVoidedChainEvent_(projection, orderKey, header);\n      if (!voidedEvent) return;\n      claimed[orderKey] = true;\n      if (!withinRange(voidedEvent.dateKey)) return;\n      rows.push(buildTransactionSalesOrderRow_(header, voidedEvent, projection,\n        qualityIndex, { isActive: false, status: \"VOIDED\" }));",
    bug: '      if (!activeEvent && header.cohort === "V2_PENDING") { claimed[orderKey] = true; rows.push({ id: orderKey, date: header.economicDateKey, transactionType: "Sales", canonicalTransactionType: "Sales", product: "", productId: "", productVariantId: "", purchaseCategory: "", qty: 0, revenue: 0, expense: 0, source: salesRecognitionSourceLabel_(header.cohort), isActive: true, salesIdentity: orderKey, salesSourceLabel: salesRecognitionSourceLabel_(header.cohort), salesCohort: header.cohort, recognitionId: null, revisionId: null, recognitionStatus: header.status, salesQuality: qualityIndex[orderKey] || { issues: [], excluded: [] } }); return; }\n      var voidedEvent = salesRecognitionVoidedChainEvent_(projection, orderKey, header);\n      if (!voidedEvent) return;\n      claimed[orderKey] = true;\n      if (!withinRange(voidedEvent.dateKey)) return;\n      rows.push(buildTransactionSalesOrderRow_(header, voidedEvent, projection,\n        qualityIndex, { isActive: false, status: "VOIDED" }));',
    marker: "SALES_V2_U4_COHORTS:A9" },
  { name: "legacy Correct/Void exposed for V2",
    anchor: "canCorrect: false, canVoid: false,",
    bug: "canCorrect: true, canVoid: true,",
    marker: "SALES_V2_U4_DETAIL:B5" }
];

function u4HarnessStubs_() {
  return {
    Logger: { log: function() {} },
    Utilities: {
      getUuid: function() { return "test-uuid-0000000000000000000000000"; },
      formatDate: function(d) { return d.toISOString().slice(0, 19) + ".000Z"; }
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
    getDashboardCacheRevision: function() { return "LOCAL_FIXTURE"; }
  };
}

function runU4Suites_(readerSource) {
  var ctx = vm.createContext({});
  SOURCES.forEach(function(file) {
    if (file === READER_PATH) return;
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  });
  vm.runInContext(readerSource, ctx, { filename: READER_PATH });
  var stubs = u4HarnessStubs_();
  Object.keys(stubs).forEach(function(key) { ctx[key] = stubs[key]; });
  var failures = [];
  SUITES.forEach(function(name) {
    try { vm.runInContext(name + "()", ctx); }
    catch (error) { failures.push(String(error && error.message || error)); }
  });
  return failures;
}

function runSalesV2U4MutationProof() {
  var readerSource = fs.readFileSync(READER_PATH, "utf8");
  MUTATIONS.forEach(function(mutation) {
    var anchors = readerSource.split(mutation.anchor).length - 1;
    if (anchors !== 1) {
      throw new Error("MUTATION_ANCHOR_UNEXPECTED:" + mutation.name + ":" + anchors);
    }
  });
  var clean = runU4Suites_(readerSource);
  if (clean.length) throw new Error("PROOF_CLEAN_FAILED:" + clean[0]);
  var results = MUTATIONS.map(function(mutation) {
    var mutatedSource = readerSource.replace(mutation.anchor, mutation.bug);
    if (mutatedSource === readerSource) {
      throw new Error("MUTATION_NOT_APPLIED:" + mutation.name);
    }
    var failures;
    try { failures = runU4Suites_(mutatedSource); }
    catch (error) {
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
    return { injected: mutation.name, caughtBy: mutation.marker };
  });
  return { status: "SENSITIVITY_PROVEN", cleanSuites: SUITES.length,
    mutations: results.length, results: results };
}

module.exports = runSalesV2U4MutationProof;
