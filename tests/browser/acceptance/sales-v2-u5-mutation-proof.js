// SALES_RECOGNITION_V2 U5 test-sensitivity proof (Node-only; executed via
// `_test_runner.js`). In-memory VM proof: reads the Finance P&L source,
// injects one contract bug at a time into a VM copy ONLY, and asserts the U5
// suites pass clean and FAIL at the expected marker under each injected bug.
// Covers: projection events as the sole Revenue authority (no TabSal read, no
// ledger 4000 credit, no unpaid Order, no activeView), EconomicDate period
// attribution (reversal never rewrites the original period), Policy C null
// COGS (never HPP-as-COGS, never 0), and pending-V2 surfaced quality.
// Never mutates tracked files.
var fs = require("fs");
var vm = require("vm");

var FINANCE_PATH = "36.Finance.Service.js";
// Dependency closure: canonical source/lifecycle, purchase/date/dashboard read
// chain, SalesRecognition V2 foundation/save/projection, shared U3/U4 fixtures.
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
  "96.Tests.SalesRecognition.V2.U4.Cases.js",
  "96.Tests.SalesRecognition.V2.U5.Cases.js"
];
var SUITES = ["testSalesRecognitionV2U5RevenueAuthority",
  "testSalesRecognitionV2U5LifecyclePeriods",
  "testSalesRecognitionV2U5PolicyCQuality",
  "testSalesRecognitionV2U5Parity"];
var MUTATIONS = [
  { name: "P&L reads TabSal records directly as Revenue",
    anchor: "var revenue = salesRecognition.recognizedRevenue;",
    bug: 'var revenue = 0; scopedRecords.forEach(function(row) { if (row.transactionType === "Sales" && row.isActive !== false) revenue += Number(row.revenue) || 0; });',
    marker: "SALES_V2_U5_AUTH:A2" },
  { name: "add BalanceLedger 4000 credits to Revenue",
    anchor: "recognizedRevenue: revenue,",
    bug: "recognizedRevenue: revenue + (Number(salesProjection.totals && salesProjection.totals.ledgerRevenueCredits) || 0),",
    marker: "SALES_V2_U5_AUTH:A1" },
  { name: "include unrecognized (unpaid) Order headers in Revenue",
    anchor: "var excluded = quality.excluded || [];",
    bug: 'var excluded = quality.excluded || []; (salesProjection.transactions || []).forEach(function(header) { if (header.status !== "RECOGNIZED") revenue += Number(header.amount) || 0; });',
    marker: "SALES_V2_U5_AUTH:A1" },
  { name: "read activeView instead of signed events",
    anchor: "var revenueEvents = salesProjection.events || [];",
    bug: "var revenueEvents = salesProjection.activeView.events || [];",
    marker: "SALES_V2_U5_LIFE:C1" },
  { name: "subtract V2 analytical HPP as COGS",
    anchor: "result.summary.cogs = null;",
    bug: "result.summary.cogs = (function() { var total = 0; (salesProjection.lines || []).forEach(function(line) { total += (Number(line.unitHpp) || 0) * (Number(line.qty) || 0); }); return total; })();",
    marker: "SALES_V2_U5_QUAL:B1" },
  { name: "fabricate unavailable COGS as 0",
    anchor: "result.summary.cogs = null;",
    bug: "result.summary.cogs = 0;",
    marker: "SALES_V2_U5_QUAL:B1" },
  { name: "attribute later-period reversal to the original period",
    anchor: "if (!dateKey || dateKey < period.startDate || dateKey > period.endDate) return;",
    bug: 'var attributionDate = dateKey; if ((Number(event.signedAmount) || 0) < 0) { var originalDate = ""; (salesProjection.events || []).forEach(function(candidate) { if (candidate.chainKey === event.chainKey && candidate.eventType === "RECOGNITION" && candidate.status === "RECOGNIZED" && candidate.dateKey && (!originalDate || candidate.dateKey < originalDate)) originalDate = candidate.dateKey; }); if (originalDate) attributionDate = originalDate; } if (!attributionDate || attributionDate < period.startDate || attributionDate > period.endDate) return;',
    marker: "SALES_V2_U5_LIFE:C1" },
  { name: "pending V2 reported as a zero-quality success",
    anchor: "unresolvedCount: excluded.length,",
    bug: 'unresolvedCount: excluded.filter(function(entry) { return entry.cohort !== "V2_PENDING"; }).length,',
    marker: "SALES_V2_U5_AUTH:A2" }
];

function u5HarnessStubs_() {
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
    getDashboardCacheRevision: function() { return "LOCAL_FIXTURE"; }
  };
}

function runU5Suites_(financeSource) {
  var ctx = vm.createContext({});
  SOURCES.forEach(function(file) {
    if (file === FINANCE_PATH) return;
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  });
  vm.runInContext(financeSource, ctx, { filename: FINANCE_PATH });
  var stubs = u5HarnessStubs_();
  Object.keys(stubs).forEach(function(key) { ctx[key] = stubs[key]; });
  var failures = [];
  SUITES.forEach(function(name) {
    try { vm.runInContext(name + "()", ctx); }
    catch (error) { failures.push(String(error && error.message || error)); }
  });
  return failures;
}

function runSalesV2U5MutationProof() {
  var financeSource = fs.readFileSync(FINANCE_PATH, "utf8");
  MUTATIONS.forEach(function(mutation) {
    var anchors = financeSource.split(mutation.anchor).length - 1;
    if (anchors !== 1) {
      throw new Error("MUTATION_ANCHOR_UNEXPECTED:" + mutation.name + ":" + anchors);
    }
  });
  var clean = runU5Suites_(financeSource);
  if (clean.length) throw new Error("PROOF_CLEAN_FAILED:" + clean[0]);
  var results = MUTATIONS.map(function(mutation) {
    var mutatedSource = financeSource.replace(mutation.anchor, mutation.bug);
    if (mutatedSource === financeSource) {
      throw new Error("MUTATION_NOT_APPLIED:" + mutation.name);
    }
    var failures;
    try { failures = runU5Suites_(mutatedSource); }
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

module.exports = runSalesV2U5MutationProof;
