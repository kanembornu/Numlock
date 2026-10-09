// SALES_RECOGNITION_V2 U4 Transaction reader tests: the canonical Transaction
// list / detail / query layer reads Sales from the ONE shared U3 Recognized
// Sales Projection. In-memory fixtures only; read-only; no production access,
// no network, no clasp, no writes outside fixture memory.

var U4_RANGE = { startDate: "2026-10-01", endDate: "2026-12-31" };
var U4_READ_NAMES = ["tabsal", "tabops", "Logs", "Orders", "OrderLines", "Payments",
  "Settlements", "TransactionOperations", "BalanceLedger", "SalesRecognitionEvents",
  "SalesRecognitionAudits", "Products", "ProductPricing"];

function u4BaseSheets_() {
  var base = u3BaseSheets_();
  base.tabops = [CANONICAL_ENTRY.EXPENSE_HEADERS.slice()];
  base.ExpenseItems = [["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]];
  return base;
}

// One request-scope environment: SpreadsheetApp over the fixture, a working
// script-cache stub (so the cached read path is exercised), stable revision.
function u4RunWithFixture_(fixture, fn) {
  var names = ["SpreadsheetApp", "CacheService", "getDashboardCacheRevision",
    "invalidateDashboardCache"];
  var originals = names.map(function(name) {
    return Object.getOwnPropertyDescriptor(globalThis, name);
  });
  var store = {};
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return fixture; } };
  globalThis.CacheService = { getScriptCache: function() {
    return {
      get: function(key) { return store[key] || null; },
      getAll: function(keys) {
        var out = {};
        keys.forEach(function(key) { if (store[key]) out[key] = store[key]; });
        return out;
      },
      put: function(key, value) { store[key] = value; },
      putAll: function(entries) {
        Object.keys(entries).forEach(function(key) { store[key] = entries[key]; });
      }
    };
  } };
  globalThis.getDashboardCacheRevision = function() { return "U4_FIXTURE"; };
  globalThis.invalidateDashboardCache = function() {};
  try { return fn(fixture); }
  finally {
    names.forEach(function(name, index) {
      if (originals[index]) Object.defineProperty(globalThis, name, originals[index]);
      else delete globalThis[name];
    });
  }
}

function u4SaveV2_(fixture, requestKey, payload) {
  var runtime = salesV2SaveRuntime_({ fixture: fixture });
  var result = salesRecognitionV2SaveWithRuntime_(payload, runtime);
  if (result.status !== "DONE") {
    throw new Error("U4_V2_SAVE_FAILED:" + requestKey + ":" + result.status + ":" + result.code);
  }
  u3MirrorOperations_(fixture, runtime.repository);
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  return { orderID: result.orderID,
    plan: JSON.parse(runtime.repository.rows()[0].OperationPlan),
    eventRow: events[events.length - 1] };
}

function u4AppendPendingV2_(fixture) {
  u3AppendOrder_(fixture, { OrderID: "ORD-U4-PENDING", OrderNumber: "ORD-U4-PENDING",
    OrderType: "DINE_IN", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
    OrderTotal: 55000, HppTotalSnapshot: 0, CreatedAt: "2026-10-23T00:00:00.000Z",
    CreatedBy: "u4", PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "",
    UpdatedBy: "u4" }, [u3OrderLine_("ORD-U4-PENDING", 55000, 1)]);
  u3AppendEvent_(fixture, { RecognitionID: "SCR-U4-PEND",
    ContractVersion: SALES_RECOGNITION_V2_CONTRACT.CONTRACT_VERSION,
    ActivationID: "ACT-U2", OrderID: "ORD-U4-PENDING", RevisionID: "REV-U4-PEND",
    EventType: "RECOGNITION", RecognizedAt: "2026-10-23T01:00:00.000Z",
    EconomicDate: "2026-10-23", Amount: 55000, RecognitionJournalID: "SRV2J-U4-PEND",
    JournalSignature: "u4pending", PostingStatus: "PENDING", OperationID: "", AuditID: "",
    OriginalID: "", ReversalOfRecognitionID: "", ReplacementID: "", Reason: "",
    Actor: "u4", SnapshotJSON: "{}" });
}

// Mixed cohort fixture: legacy (active / voided / corrected / app-entry),
// pre-V2 (unpaid / paid 36,000 with 15,130.58 HPP / paid multiline),
// V2 committed multiline, V2 committed with reversal + replacement, pending V2.
function u4MixedFixture_() {
  var fixture = salesV2SaveFixture_(u4BaseSheets_());
  u3AppendSale_(fixture, { ID_Trx: "SAL-U4-L1", Tanggal: "2026-10-05T12:00:00Z",
    ID_Prod: "P1", Qty: 3, HPP: 5000, HJ: 10000 });
  u3AppendSale_(fixture, { ID_Trx: "SAL-U4-L2", Tanggal: "2026-10-06T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 8000, HJ: 20000, IsActive: false });
  u3AppendSale_(fixture, { ID_Trx: "SAL-U4-L3", Tanggal: "2026-10-07T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 4000, HJ: 10000, IsActive: false });
  u3AppendSale_(fixture, { ID_Trx: "SAL-U4-L4", Tanggal: "2026-10-08T12:00:00Z",
    ID_Prod: "P1", Qty: 2, HPP: 4000, HJ: 12000 });
  u3AppendSale_(fixture, { ID_Trx: "SAL-U4-L5", Tanggal: "2026-10-09T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 4500, HJ: 15000, Source: "APP_ENTRY" });
  u3AppendLog_(fixture, { RecordID: "SAL-U4-L3", Action: "CORRECT_VOID_SALES",
    Metadata: { replacementId: "SAL-U4-L4", reason: "u4" } });
  u3AppendLog_(fixture, { RecordID: "SAL-U4-L4", Action: "CORRECT_CREATE_SALES",
    Metadata: { originalId: "SAL-U4-L3", reason: "u4" } });

  u3AppendOrder_(fixture, { OrderID: "ORD-U4-UNPAID", OrderNumber: "ORD-U4-UNPAID",
    OrderType: "DINE_IN", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
    OrderTotal: 25000, HppTotalSnapshot: 0, CreatedAt: "2026-10-19T00:00:00.000Z",
    CreatedBy: "u4", PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "",
    UpdatedBy: "u4" }, [u3OrderLine_("ORD-U4-UNPAID", 25000, 1)]);
  u3PaidChain_(fixture, { orderID: "ORD-U4-PAID", amount: 36000, hpp: 15130.58,
    paymentID: "PAY-U4-1", paidAt: "2026-10-20T03:00:00.000Z", fulfillment: "OPEN",
    hppLines: true, withPaymentOp: true });
  u3PaidChain_(fixture, { orderID: "ORD-U4-ML", amount: 60000, paymentID: "PAY-U4-2",
    paidAt: "2026-10-20T03:00:00.000Z", fulfillment: "COMPLETED",
    lines: [u3OrderLine_("ORD-U4-ML", 30000, 1), u3OrderLine_("ORD-U4-ML", 30000, 2)] });

  var v2Multi = u4SaveV2_(fixture, "u4-v2-multi", salesV2SavePayload_("u4-v2-multi"));
  var v2Lineage = u4SaveV2_(fixture, "u4-v2-lineage", u3Payload_("u4-v2-lineage"));
  u3ReversalAppend_(fixture, v2Lineage.eventRow, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z" });
  u3CommittedAppend_(fixture, { orderID: v2Lineage.orderID,
    recognitionID: "SCR-U4REP-" + v2Lineage.orderID,
    revisionID: "REV-U4REP-" + v2Lineage.orderID, suffix: "-u4rep",
    amount: 81000, date: "2026-11-15", recognizedAt: "2026-12-01T00:00:00.000Z",
    originalID: v2Lineage.eventRow.RecognitionID });
  u4AppendPendingV2_(fixture);
  return { fixture: fixture, v2Multi: v2Multi, v2Lineage: v2Lineage };
}

function u4RowsById_(rows) {
  var index = {};
  rows.forEach(function(row) { index[row.id] = row; });
  return index;
}

function u4PageRequest_(overrides) {
  return Object.assign({ tab: "sales", page: 1, pageSize: 50, lifecycleState: "active",
    filter: "custom", customStart: U4_RANGE.startDate, customEnd: U4_RANGE.endDate },
    overrides || {});
}

function u4ActivePage_(fixture, overrides) {
  return u4RunWithFixture_(fixture, function() {
    return getTransactionsPage(u4PageRequest_(overrides));
  });
}

function u4FindRowIndex_(values, keyIndex, key) {
  for (var index = 1; index < values.length; index++) {
    if (String(values[index][keyIndex]) === String(key)) return index;
  }
  return -1;
}

// Cohort visibility: WHO may appear as recognized Sales, and who must not.
function testSalesRecognitionV2U4ReaderCohorts() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U4_COHORTS:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var built = u4MixedFixture_();
  var fixture = built.fixture;
  var page = u4ActivePage_(fixture);
  var rows = page.rows;
  var byId = u4RowsById_(rows);
  var ids = rows.map(function(row) { return row.id; });

  // A3: legacy parity — identity / date / amount / lifecycle / label, once.
  var legacy = byId["SAL-U4-L1"];
  check("A3", Boolean(legacy) && legacy.date === "2026-10-05" &&
    legacy.revenue === 30000 && legacy.isActive === true &&
    legacy.transactionType === "Sales" && legacy.salesIdentity === "LEGACY:SAL-U4-L1" &&
    legacy.salesSourceLabel === "LEGACY_SALE" && legacy.salesCohort === "TABSAL_LEGACY" &&
    legacy.recognitionId === "LEGACY:SAL-U4-L1:R0" && legacy.source === "LEGACY_GOOGLE",
    JSON.stringify(legacy));

  // A7: an unpaid old Order is absent from recognized Sales.
  check("A7", !ids.some(function(id) { return id.indexOf("ORD-U4-UNPAID") !== -1; }),
    JSON.stringify(ids));

  // A6: the paid order appears once; Payment / settlement / ledger evidence
  // is never additive and never its own Sale.
  var paidRows = rows.filter(function(row) { return row.id === "ORDER:ORD-U4-PAID"; });
  check("A6", paidRows.length === 1 && paidRows[0].revenue === 36000 &&
    !ids.some(function(id) { return String(id).indexOf("PAY-") === 0; }) &&
    !ids.some(function(id) { return String(id).indexOf("CSH-SAL-") === 0; }),
    JSON.stringify({ paid: paidRows.length, revenue: paidRows[0] && paidRows[0].revenue,
      ids: ids }));

  // A9: pending V2 is not a Sale, never falls back to legacy, quality surfaced.
  check("A9", !byId["ORDER:ORD-U4-PENDING"] &&
    page.salesRecognition.excluded.some(function(entry) {
      return entry.sourceIdentity === "ORDER:ORD-U4-PENDING:" &&
        entry.cohort === "V2_PENDING"; }) &&
    page.salesRecognition.issues.some(function(issue) {
      return issue.code === "INCOMPLETE_V2_RECOGNITION" &&
        issue.sourceIdentity === "ORDER:ORD-U4-PENDING:"; }) &&
    page.salesRecognition.excluded.some(function(entry) {
      return entry.sourceIdentity === "ORDER:ORD-U4-UNPAID:R0"; }),
    JSON.stringify({ page: ids, salesRecognition: page.salesRecognition }));

  // A10: one header transaction for a multiline order (header amount).
  var mlRow = byId["ORDER:ORD-U4-ML"];
  check("A10", Boolean(mlRow) && mlRow.revenue === 60000 && mlRow.qty === 2 &&
    rows.filter(function(row) { return row.id === "ORDER:ORD-U4-ML"; }).length === 1,
    JSON.stringify(mlRow));
  return { total: pass, pass: pass, fail: 0 };
}

// List/query layer: exact population, lifecycle views, ordering, parity,
// filters, cache quality, read-only.
function testSalesRecognitionV2U4ReaderList() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U4_LIST:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var built = u4MixedFixture_();
  var fixture = built.fixture;
  var before = u3SheetSnapshot_(fixture, U4_READ_NAMES);

  var page = u4ActivePage_(fixture);
  var rows = page.rows;
  var byId = u4RowsById_(rows);
  var ids = rows.map(function(row) { return row.id; });
  var orderMulti = "ORDER:" + built.v2Multi.orderID;
  var orderLineage = "ORDER:" + built.v2Lineage.orderID;

  // A1: exact visible count for the mixed cohort; A2: no duplicate identity.
  check("A1", rows.length === 7 && page.totalRows === 7,
    JSON.stringify({ n: rows.length, ids: ids }));
  check("A2", ids.filter(function(id, index) { return ids.indexOf(id) !== index; }).length === 0,
    JSON.stringify(ids));

  // A4: voided legacy rows keep their lifecycle in the voided view only.
  var voided = u4ActivePage_(fixture, { lifecycleState: "voided" });
  var voidedIds = voided.rows.map(function(row) { return row.id; }).sort();
  check("A4", voided.rows.length === 2 &&
    JSON.stringify(voidedIds) === JSON.stringify(["SAL-U4-L2", "SAL-U4-L3"]) &&
    voided.rows.every(function(row) { return row.isActive === false; }) &&
    voided.rows.filter(function(row) { return row.id === "SAL-U4-L2"; })[0]
      .salesQuality.issues.some(function(issue) {
        return issue.code === "LEGACY_INACTIVE_EXCLUDED"; }),
    JSON.stringify(voidedIds));

  // A5: all-lifecycle view keeps the corrected pair linked, never duplicated.
  var all = u4ActivePage_(fixture, { lifecycleState: "all" });
  check("A5", all.totalRows === 9 &&
    !all.rows.some(function(row) { return row.id === "SAL-U4-L3" && row.isActive !== false; }) &&
    Boolean(u4RowsById_(all.rows)["SAL-U4-L4"]),
    JSON.stringify(all.rows.map(function(row) { return row.id + ":" + row.isActive; })));

  // A8: committed V2 once — total, qty, variant/product identity, no Payment.
  var v2Row = byId[orderMulti];
  check("A8", Boolean(v2Row) && v2Row.revenue === 60000 && v2Row.qty === 3 &&
    v2Row.productVariantId === "PV1" && v2Row.productId === "P1" &&
    v2Row.salesSourceLabel === "SALES_RECOGNITION_V2" &&
    v2Row.salesCohort === "V2_COMMITTED" && v2Row.recognitionId ===
      built.v2Multi.plan.recognitionID && v2Row.revisionId === built.v2Multi.plan.revisionID,
    JSON.stringify(v2Row));

  // A11: deterministic ordering (date desc + identity tie-break), active states.
  var sorted = rows.every(function(row, index) {
    if (index === 0) return true;
    var previous = rows[index - 1];
    if (previous.date !== row.date) return previous.date > row.date;
    return String(previous.id).localeCompare(String(row.id)) >= 0;
  });
  check("A11", sorted && rows[1].id === "ORDER:ORD-U4-PAID" &&
    rows[2].id === "ORDER:ORD-U4-ML" &&
    byId[orderLineage].date === "2026-11-15" && byId[orderLineage].revenue === 81000 &&
    rows.every(function(row) { return row.isActive === true; }),
    JSON.stringify(rows.map(function(row) { return row.date + "|" + row.id; })));

  // Cross-reader parity: Transaction All and Transaction Sales agree exactly.
  var recent = u4ActivePage_(fixture, { tab: "recent" });
  function salesShape(sourceRows) {
    return sourceRows.filter(function(row) { return row.transactionType === "Sales"; })
      .map(function(row) { return row.id + "|" + row.revenue; }).sort();
  }
  var salesTabShape = salesShape(rows);
  var recentShape = salesShape(recent.rows);
  check("A12", JSON.stringify(salesTabShape) === JSON.stringify(recentShape) &&
    JSON.stringify(salesTabShape) === JSON.stringify([
      "ORDER:" + built.v2Lineage.orderID + "|81000",
      orderMulti + "|60000",
      "ORDER:ORD-U4-ML|60000",
      "ORDER:ORD-U4-PAID|36000",
      "SAL-U4-L1|30000",
      "SAL-U4-L4|24000",
      "SAL-U4-L5|15000"].sort()),
    JSON.stringify({ sales: salesTabShape, recent: recentShape }));

  var exported = u4RunWithFixture_(fixture, function() {
    return getTransactionsExport(u4PageRequest_());
  });
  check("A13", JSON.stringify(exported.data.rows.map(function(row) {
      return row.id + "|" + row.amount; }).sort()) === JSON.stringify(salesTabShape),
    JSON.stringify(exported.data.rows));

  // A14: type / date / search / product / variant / ID filters; no revival.
  var bySearchId = u4ActivePage_(fixture, { search: "ORD-U4-PAID" });
  var bySearchDate = u4ActivePage_(fixture, { search: "2026-10-20" });
  var byProduct = u4ActivePage_(fixture, { search: "P1" });
  var byVariant = u4ActivePage_(fixture, { search: "PV1" });
  var november = u4ActivePage_(fixture, { customStart: "2026-11-01",
    customEnd: "2026-11-30" });
  var revived = u4ActivePage_(fixture, { search: "UNPAID" });
  var expenses = u4ActivePage_(fixture, { tab: "expenses" });
  check("A14", bySearchId.totalRows === 1 && bySearchDate.totalRows === 2 &&
    byProduct.totalRows === 4 && byVariant.totalRows === 4 &&
    november.totalRows === 1 && november.rows[0].id === orderLineage &&
    revived.totalRows === 0 && expenses.totalRows === 0,
    JSON.stringify({ id: bySearchId.totalRows, date: bySearchDate.totalRows,
      product: byProduct.totalRows, variant: byVariant.totalRows,
      nov: november.totalRows, revived: revived.totalRows, expenses: expenses.totalRows }));

  // A15: structured quality survives the cached read path.
  var cached = u4RunWithFixture_(fixture, function() {
    getTransactionsPage(u4PageRequest_());
    return getTransactionsPage(u4PageRequest_());
  });
  check("A15", cached.cacheHit === true && Boolean(cached.salesRecognition) &&
    cached.salesRecognition.authority === "SALES_RECOGNITION_V2_PROJECTION" &&
    cached.salesRecognition.excluded.length === 2 &&
    Array.isArray(cached.salesRecognition.issues) &&
    Array.isArray(cached.salesRecognition.recoveryIssues),
    JSON.stringify({ cacheHit: cached.cacheHit, salesRecognition: cached.salesRecognition }));

  check("A16", before === u3SheetSnapshot_(fixture, U4_READ_NAMES),
    "list/query read mutated a source sheet");
  return { total: pass, pass: pass, fail: 0 };
}

// Detail model: identity, cohort, recognition, snapshots, lineage, actions.
function testSalesRecognitionV2U4ReaderDetail() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U4_DETAIL:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var built = u4MixedFixture_();
  var fixture = built.fixture;
  var before = u3SheetSnapshot_(fixture, U4_READ_NAMES);
  var orderMulti = "ORDER:" + built.v2Multi.orderID;
  var orderLineage = "ORDER:" + built.v2Lineage.orderID;

  var legacy = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail("SAL-U4-L1");
  });
  check("B1", legacy.success === true && legacy.data.id === "SAL-U4-L1" &&
    legacy.data.revenue === 30000 && legacy.data.status === "ACTIVE" &&
    legacy.data.salesIdentity === "LEGACY:SAL-U4-L1" &&
    legacy.data.recognitionId === "LEGACY:SAL-U4-L1:R0" &&
    legacy.data.revisionId === "R0" && legacy.data.salesCohort === "TABSAL_LEGACY" &&
    legacy.data.product === "Coffee" && legacy.data.lines.length === 1 &&
    legacy.data.lines[0].qty === 3 && legacy.data.lines[0].unitPrice === 10000 &&
    legacy.data.lines[0].lineAmount === 30000 &&
    legacy.data.contractVersion === "SALES_RECOGNITION_PROJECTION",
    JSON.stringify(legacy.data));

  var voidedLegacy = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail("SAL-U4-L2");
  });
  var corrected = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail("SAL-U4-L3");
  });
  var replacement = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail("SAL-U4-L4");
  });
  check("B2", voidedLegacy.success === true && voidedLegacy.data.status === "VOIDED" &&
    voidedLegacy.data.recognitionStatus === "NOT_RECOGNIZED" &&
    voidedLegacy.data.quality.issues.some(function(issue) {
      return issue.code === "LEGACY_INACTIVE_EXCLUDED"; }),
    JSON.stringify(voidedLegacy.data));
  check("B3", corrected.success === true && replacement.success === true &&
    corrected.data.replacementId === "SAL-U4-L4" &&
    replacement.data.originalId === "SAL-U4-L3" &&
    corrected.data.status === "VOIDED" && replacement.data.status === "ACTIVE",
    JSON.stringify({ corrected: corrected.data.originalId, replacement: replacement.data }));

  var appEntry = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail("SAL-U4-L5");
  });
  check("B4", appEntry.success === true && appEntry.data.canCorrect === true &&
    appEntry.data.canVoid === true && appEntry.data.immutableReason === null &&
    appEntry.data.salesSourceLabel === "LEGACY_SALE",
    JSON.stringify(appEntry.data));

  var paid = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail("ORDER:ORD-U4-PAID");
  });
  check("B5", paid.success === true && paid.data.id === "ORDER:ORD-U4-PAID" &&
    paid.data.orderId === "ORD-U4-PAID" && paid.data.revenue === 36000 &&
    paid.data.hppAnalytical === 15130.58 && paid.data.date === "2026-10-20" &&
    paid.data.salesSourceLabel === "PRE_V2_ORDER" && paid.data.salesCohort === "PRE_V2_ORDER" &&
    paid.data.recognitionId === "ORDER:ORD-U4-PAID:R0" && paid.data.revisionId === "R0" &&
    paid.data.orderType === "DINE_IN" && paid.data.productId === "P1" &&
    paid.data.productVariantId === "PV1" && paid.data.canCorrect === false &&
    paid.data.canVoid === false &&
    paid.data.immutableReason === "SALES_RECOGNITION_ACTION_UNSUPPORTED" &&
    paid.data.status === "ACTIVE" &&
    paid.data.contractVersion === "SALES_RECOGNITION_PROJECTION" &&
    paid.data.lines.length === 1 && paid.data.lines[0].lineAmount === 36000 &&
    paid.data.lines[0].recipeVersionId === "RV1" && paid.data.lines[0].unitHpp === 0,
    JSON.stringify(paid.data));

  var multiline = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail(orderMulti);
  });
  check("B6", multiline.success === true && multiline.data.revenue === 60000 &&
    multiline.data.qty === 3 && multiline.data.lines.length === 2 &&
    multiline.data.lines.every(function(line) { return line.fromSnapshot === true; }) &&
    multiline.data.lines[0].productVariantId === "PV1" &&
    multiline.data.lines[0].recipeVersionId === "RV1" &&
    multiline.data.revisionId === built.v2Multi.plan.revisionID &&
    multiline.data.recognitionId === built.v2Multi.plan.recognitionID &&
    multiline.data.salesSourceLabel === "SALES_RECOGNITION_V2",
    JSON.stringify(multiline.data));

  var lineage = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail(orderLineage);
  });
  check("B7", lineage.success === true && lineage.data.revenue === 81000 &&
    lineage.data.date === "2026-11-15" && lineage.data.lineage.length === 3 &&
    lineage.data.lineage.filter(function(entry) { return entry.active; }).length === 1 &&
    lineage.data.lineage.some(function(entry) {
      return entry.eventType === "REVERSAL" && entry.signedAmount === -40000; }) &&
    lineage.data.lineage.some(function(entry) {
      return entry.eventType === "RECOGNITION" && entry.signedAmount === 81000 &&
        entry.recognitionId === "SCR-U4REP-" + built.v2Lineage.orderID; }),
    JSON.stringify(lineage.data));

  // B9: legacy action path unchanged; V2 Correct/Void fail closed (no U6).
  var voidAttempt = u4RunWithFixture_(fixture, function() {
    return voidCanonicalTransaction({ transactionId: orderMulti, reason: "u4 fail closed probe" });
  });
  var correctAttempt = u4RunWithFixture_(fixture, function() {
    return previewCanonicalTransactionCorrection({ transactionId: orderMulti,
      reason: "u4 fail closed probe", qty: 1, productId: "P1", type: "Hot" });
  });
  check("B9", voidAttempt.success === false &&
    voidAttempt.error.code === "TRANSACTION_NOT_FOUND" &&
    correctAttempt.success === false &&
    correctAttempt.error.code === "TRANSACTION_NOT_FOUND",
    JSON.stringify({ voidAttempt: voidAttempt, correctAttempt: correctAttempt }));

  // Batch prefetch: one projection per request, mixed cohorts, fail closed.
  var batch = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetails(["SAL-U4-L1", "SAL-U4-L5", "ORDER:ORD-U4-PAID",
      orderMulti]);
  });
  var batchRejected = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetails([orderMulti, "ORDER:ORD-U4-UNPAID"]);
  });
  check("B10", batch.success === true && batch.data.details.length === 4 &&
    batch.data.details[0].id === "SAL-U4-L1" &&
    batch.data.details[0].salesIdentity === "LEGACY:SAL-U4-L1" &&
    batch.data.details[1].id === "SAL-U4-L5" && batch.data.details[1].canVoid === true &&
    batch.data.details[2].id === "ORDER:ORD-U4-PAID" &&
    batch.data.details[3].id === orderMulti &&
    batch.data.details[3].lines.length === 2 &&
    batchRejected.success === false &&
    batchRejected.error.code === "TRANSACTION_NOT_FOUND",
    JSON.stringify({ batch: batch.success, rejected: batchRejected }));

  check("B11", before === u3SheetSnapshot_(fixture, U4_READ_NAMES),
    "detail/batch read mutated a source sheet");

  // B8: master/source change after recognition never rewrites history.
  var orders = fixture.getSheetByName("Orders").values;
  var orderRow = u4FindRowIndex_(orders, 0, built.v2Multi.orderID);
  var lines = fixture.getSheetByName("OrderLines").values;
  var pricing = fixture.getSheetByName("ProductPricing").values;
  check("B8", orderRow > 0, "V2 order row missing");
  orders[orderRow][5] = 1;
  for (var index = 1; index < lines.length; index++) {
    if (String(lines[index][1]) !== built.v2Multi.orderID) continue;
    lines[index][6] = 999999;
    lines[index][9] = 999999;
  }
  for (var pricingIndex = 1; pricingIndex < pricing.length; pricingIndex++) {
    pricing[pricingIndex][5] = 1;
  }
  var afterTamper = u4RunWithFixture_(fixture, function() {
    return { detail: getCanonicalTransactionDetail(orderMulti),
      page: getTransactionsPage(u4PageRequest_()) };
  });
  var tamperedRow = u4RowsById_(afterTamper.page.rows)[orderMulti];
  check("B8", afterTamper.detail.success === true &&
    afterTamper.detail.data.revenue === 60000 &&
    afterTamper.detail.data.hppAnalytical === multiline.data.hppAnalytical &&
    afterTamper.detail.data.lines.length === 2 &&
    afterTamper.detail.data.lines[0].unitPrice === multiline.data.lines[0].unitPrice &&
    afterTamper.detail.data.lines[0].lineAmount === multiline.data.lines[0].lineAmount &&
    afterTamper.detail.data.lines[0].lineHpp === multiline.data.lines[0].lineHpp &&
    Boolean(tamperedRow) && tamperedRow.revenue === 60000,
    JSON.stringify({ before: multiline.data.lines, after: afterTamper.detail.data.lines }));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// U10F: U4 cache-freshness remediation tests. One request-scope environment
// with a REVISION-AWARE script cache mirroring the production
// invalidateDashboardCache() contract (revision embedded in the
// transactions-period-v3 key prefix). Exercises the REAL cache boundary in
// getTransactionsPeriodRows (key construction, chunk store, cacheHit) — never
// grep-only. MUST FAIL if the U2 DONE paths lack invalidateDashboardCache().
// ---------------------------------------------------------------------------
function u4CacheEnv_(fixture) {
  var names = ["SpreadsheetApp", "CacheService", "getDashboardCacheRevision",
    "invalidateDashboardCache"];
  var originals = names.map(function(name) {
    return Object.getOwnPropertyDescriptor(globalThis, name);
  });
  var env = { revision: 1, invalidateCalls: 0, invalidateAttempts: 0,
    failInvalidation: false, store: {} };
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return fixture; } };
  globalThis.CacheService = { getScriptCache: function() {
    return {
      get: function(key) { return env.store[key] || null; },
      getAll: function(keys) {
        var out = {};
        keys.forEach(function(key) { if (env.store[key]) out[key] = env.store[key]; });
        return out;
      },
      put: function(key, value) { env.store[key] = value; },
      putAll: function(entries) {
        Object.keys(entries).forEach(function(key) { env.store[key] = entries[key]; });
      }
    };
  } };
  globalThis.getDashboardCacheRevision = function() { return "U4WC-" + env.revision; };
  globalThis.invalidateDashboardCache = function() {
    env.invalidateAttempts += 1;
    if (env.failInvalidation) throw new Error("CACHE_REVISION_UNAVAILABLE");
    env.revision += 1;
    env.invalidateCalls += 1;
    return env.revision;
  };
  env.restore = function() {
    names.forEach(function(name, index) {
      if (originals[index]) Object.defineProperty(globalThis, name, originals[index]);
      else delete globalThis[name];
    });
  };
  return env;
}

function u4PeriodIds_(rows) {
  return rows.map(function(row) { return row.id; });
}

// Committed V2 save over the U4 base sheets (tabops + ExpenseItems present so
// the real period reader can run against the fixture).
function u4CacheSaveFixture_(key) {
  var fixture = salesV2SaveFixture_(u4BaseSheets_());
  var runtime = salesV2SaveRuntime_({ fixture: fixture });
  var result = salesRecognitionV2SaveWithRuntime_(u3Payload_(key), runtime);
  if (result.status !== "DONE") {
    throw new Error("U4_CACHE_SAVE_FAILED:" + key + ":" + result.status + ":" + result.code);
  }
  u3MirrorOperations_(fixture, runtime.repository);
  return { fixture: fixture, runtime: runtime, result: result, orderID: result.orderID };
}

// WARM-CACHE REGRESSION (A6): a pre-warmed transactions-period-v3 cache must
// reflect a committed V2 Sale immediately — no TTL wait. Steps: valid pre-Sale
// data -> populate the same cache the reader uses -> Sale absent -> successful
// V2 Save -> immediate re-read within TTL -> committed Sale present EXACTLY
// once with exact amount/identity. Also proves COMMITTED-replay re-invalidation
// is harmless (exactly-once preserved) and A4 failure semantics: an ephemeral
// invalidation failure never contradicts the durable DONE and is never retried.
function testSalesRecognitionV2U4WarmCacheFreshness() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U4_WARM:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var base = u4CacheSaveFixture_("u4wc-base"); // one committed V2 sale (40,000)
  var fixture = base.fixture;
  var env = u4CacheEnv_(fixture);
  try {
    // 1-2: valid pre-Sale data; populate the SAME cache getTransactionsPeriodRows uses.
    var pre = getTransactionsPeriodRows(U4_RANGE);
    check("C0", pre.cacheHit === false && pre.rows.filter(function(row) {
      return row.id === "ORDER:" + base.orderID && row.revenue === 40000 &&
        row.isActive === true; }).length === 1, JSON.stringify(u4PeriodIds_(pre.rows)));
    var warmed = getTransactionsPeriodRows(U4_RANGE);
    check("C0b", warmed.cacheHit === true, "period cache did not warm");
    // 3: the new Sale is absent while the cache is warm.
    var preIds = JSON.stringify(u4PeriodIds_(pre.rows).sort());
    check("C1", JSON.stringify(u4PeriodIds_(warmed.rows).sort()) === preIds,
      JSON.stringify(u4PeriodIds_(warmed.rows)));
    // 4: successful V2 Save through the real U2 core (runtime-injected).
    var runtime = salesV2SaveRuntime_({ fixture: fixture });
    var result = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u4wc-save-1"), runtime);
    check("C2", result.status === "DONE" && result.orderID !== "", JSON.stringify(result));
    u3MirrorOperations_(fixture, runtime.repository);
    check("C3", env.invalidateCalls === 1 && env.invalidateAttempts === 1 &&
      env.revision === 2, JSON.stringify({ calls: env.invalidateCalls,
        attempts: env.invalidateAttempts, revision: env.revision }));
    // 5-6: immediate re-read WITHIN TTL — committed Sale present EXACTLY once.
    var immediate = getTransactionsPeriodRows(U4_RANGE);
    check("C4", immediate.cacheHit === false,
      "stale warm cache served after committed save");
    var newRows = immediate.rows.filter(function(row) {
      return row.id === "ORDER:" + result.orderID; });
    check("C5", newRows.length === 1, JSON.stringify(u4PeriodIds_(immediate.rows)));
    // 7: amount + identity exact (salesV2SavePayload_: qty 1+2 @ 20,000 = 60,000).
    check("C6", newRows[0].revenue === 60000 && newRows[0].isActive === true &&
      newRows[0].transactionType === "Sales" &&
      newRows[0].salesCohort === "V2_COMMITTED" &&
      newRows[0].salesSourceLabel === "SALES_RECOGNITION_V2" &&
      newRows[0].salesIdentity === "ORDER:" + result.orderID &&
      newRows[0].recognitionId !== "" && newRows[0].revisionId !== "",
      JSON.stringify(newRows[0]));
    // COMMITTED replay: re-invalidation is harmless; exactly-once preserved.
    getTransactionsPeriodRows(U4_RANGE);
    var replay = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u4wc-save-1"),
      salesV2SaveRuntime_({ fixture: fixture, repository: runtime.repository }));
    check("C7", replay.status === "DONE" && replay.replay === true &&
      replay.writeCount === 0 && replay.orderID === result.orderID &&
      env.invalidateCalls === 2, JSON.stringify(replay));
    var afterReplay = getTransactionsPeriodRows(U4_RANGE);
    check("C8", afterReplay.cacheHit === false && afterReplay.rows.filter(function(row) {
      return row.id === "ORDER:" + result.orderID; }).length === 1 &&
      afterReplay.rows.filter(function(row) { return row.revenue === 60000; }).length === 1,
      JSON.stringify(u4PeriodIds_(afterReplay.rows)));
    // A4 failure semantics: ephemeral invalidation failure NEVER contradicts
    // the durable DONE, is never retried, and never fabricates a cache row.
    getTransactionsPeriodRows(U4_RANGE);
    env.failInvalidation = true;
    var rtFail = salesV2SaveRuntime_({ fixture: fixture });
    var failResult = salesRecognitionV2SaveWithRuntime_(
      salesV2SavePayload_("u4wc-fail-inv"), rtFail);
    check("C9", failResult.status === "DONE" && failResult.orderID !== "" &&
      rtFail.events.batches.length === 1 &&
      rtFail.repository.rows()[0].State === "COMMITTED" &&
      env.invalidateAttempts === 3 && env.invalidateCalls === 2,
      JSON.stringify(failResult));
    env.failInvalidation = false;
    var afterFail = getTransactionsPeriodRows(U4_RANGE);
    check("C10", afterFail.cacheHit === true && !afterFail.rows.some(function(row) {
      return row.id === "ORDER:" + failResult.orderID; }),
      "failed invalidation must leave the stale snapshot, never a fabricated row");
  } finally { env.restore(); }
  return { total: pass, pass: pass, fail: 0 };
}

// NEGATIVE CACHE PATHS (A7): invalidation fires ONLY on DONE. Validation
// failure / payload conflict / UNKNOWN before resolution / partial-corrupt
// never invalidate, never fabricate a Transaction, never surface partial
// state as recognized authority. Plus static A9 assertions: journal accounts
// unchanged and the hook lives only at the DONE choke points.
function testSalesRecognitionV2U4CacheNegativePaths() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U4_CACHE_NEG:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var base = u4CacheSaveFixture_("u4wc-neg-base");
  var fixture = base.fixture;
  var env = u4CacheEnv_(fixture);
  try {
    getTransactionsPeriodRows(U4_RANGE); // warm
    var baselineIds = JSON.stringify(
      u4PeriodIds_(getTransactionsPeriodRows(U4_RANGE).rows).sort());
    // N1: validation failure -> REFUSED, zero invalidation, zero false rows.
    var invalid = salesRecognitionV2SaveWithRuntime_(
      { requestKey: "u4wc-neg-invalid", orderType: "DINE_IN",
        lines: [{ productID: "P1", productVariantID: "PV1", qty: 0 }] },
      salesV2SaveRuntime_({ fixture: fixture }));
    check("N1", invalid.status === "REFUSED" && env.invalidateAttempts === 0 &&
      JSON.stringify(u4PeriodIds_(getTransactionsPeriodRows(U4_RANGE).rows).sort()) ===
        baselineIds, JSON.stringify(invalid));
    // N2: payload conflict -> CONFLICT, original op authority intact, no invalidation.
    var conflict = salesRecognitionV2SaveWithRuntime_(
      { requestKey: "u4wc-neg-base", orderType: "DINE_IN",
        lines: [{ productID: "P1", productVariantID: "PV1", qty: 9 }] },
      salesV2SaveRuntime_({ fixture: fixture, repository: base.runtime.repository }));
    check("N2", conflict.status === "CONFLICT" &&
      conflict.code === "OPERATION_PAYLOAD_CONFLICT" && env.invalidateAttempts === 0,
      JSON.stringify(conflict));
    // N3: UNKNOWN before resolution -> no false Done, no fabricated Transaction,
    // requestKey retained; a deterministic later resume commits and invalidates once.
    var rtUnknown = salesV2SaveRuntime_({ fixture: fixture });
    rtUnknown.batch = function(ranges) {
      rtUnknown.events.batches.push(ranges);
      throw new Error("ETIMEDOUT");
    };
    var unknown = salesRecognitionV2SaveWithRuntime_(
      salesV2SavePayload_("u4wc-neg-unknown"), rtUnknown);
    check("N3", unknown.status === "UNKNOWN" && unknown.requestKey === "u4wc-neg-unknown" &&
      unknown.writeCount === "UNKNOWN" && env.invalidateAttempts === 0 &&
      !u4PeriodIds_(getTransactionsPeriodRows(U4_RANGE).rows).some(function(id) {
        return id === "ORDER:" + unknown.orderID; }), JSON.stringify(unknown));
    var resumed = salesRecognitionV2SaveWithRuntime_(
      salesV2SavePayload_("u4wc-neg-unknown"),
      salesV2SaveRuntime_({ fixture: fixture, repository: rtUnknown.repository }));
    u3MirrorOperations_(fixture, rtUnknown.repository);
    check("N3b", resumed.status === "DONE" && env.invalidateCalls === 1 &&
      u4PeriodIds_(getTransactionsPeriodRows(U4_RANGE).rows).filter(function(id) {
        return id === "ORDER:" + resumed.orderID; }).length === 1, JSON.stringify(resumed));
    // N4: partial/corrupt -> fail closed RECOVERY_REQUIRED; invalidation must
    // NOT surface the partial state as recognized authority (no DONE, no bump).
    var rtPartial = salesV2SaveRuntime_({ fixture: fixture, crash: "V2_AFTER_INTENT" });
    try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u4wc-neg-partial"), rtPartial); }
    catch (error) {}
    var t = TRANSACTION_PRODUCTION_CONTRACT;
    var plan = JSON.parse(rtPartial.repository.rows()[0].OperationPlan);
    var orders = rtPartial.spreadsheet.getSheetByName("Orders");
    orders.getRange(2, 1, 1, t.ORDERS.HEADERS.length)
      .setValues([t.ORDERS.HEADERS.map(function(header) { return plan.orderRow[header]; })]);
    var partial = salesRecognitionV2SaveWithRuntime_(
      salesV2SavePayload_("u4wc-neg-partial"),
      salesV2SaveRuntime_({ fixture: rtPartial.spreadsheet, repository: rtPartial.repository }));
    check("N4", partial.status === "RECOVERY_REQUIRED" &&
      partial.code === "ARTIFACTS_INCOMPLETE" && partial.requestKey === "u4wc-neg-partial" &&
      env.invalidateAttempts === 1 && env.invalidateCalls === 1, JSON.stringify(partial));
    // N5 (static A9): journal accounts / movement type unchanged by the fix.
    var save = SALES_RECOGNITION_V2_SAVE;
    check("N5", save.JOURNAL_ACCOUNTS.SETTLEMENT === "1030" &&
      save.JOURNAL_ACCOUNTS.REVENUE === "4000" &&
      save.JOURNAL_MOVEMENT_TYPE === "SALES_RECOGNITION" &&
      save.POSTING_STATUS === "COMMITTED", JSON.stringify(save.JOURNAL_ACCOUNTS));
    // N6 (static A9): the hook lives ONLY at the DONE choke points — never in
    // the batch/commit primitives where it could contradict durability.
    var primitiveSource = salesRecognitionV2SaveApplyBatch_.toString() +
      salesRecognitionV2SaveCommitVerify_.toString() +
      salesRecognitionV2SaveResume_.toString() +
      salesRecognitionV2MutationApplyBatch_.toString() +
      salesRecognitionV2MutationCommitVerify_.toString() +
      salesRecognitionV2MutationResume_.toString();
    check("N6", primitiveSource.indexOf("invalidateDashboardCache") === -1 &&
      salesRecognitionV2SaveWithRuntime_.toString().indexOf("invalidateDashboardCache") !== -1 &&
      salesRecognitionV2MutationRun_.toString().indexOf("invalidateDashboardCache") !== -1,
      "invalidation hook must live only at the DONE choke points");
  } finally { env.restore(); }
  return { total: pass, pass: pass, fail: 0 };
}

// CORRECT/VOID CACHE REGRESSION (A8; U6 in scope: V2 mutations change
// U3/U4-visible Sales authority and shared the same missing-invalidation
// defect). Pre-warmed cache -> Void -> immediate U4 read reflects voided
// state per the frozen contract; Correct -> immediate U4 read reflects the
// replacement as the active lineage authority. No TTL wait.
function testSalesRecognitionV2U4MutationCacheFreshness() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U4_MUT_CACHE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var base = u4CacheSaveFixture_("u4wc-mut-void"); // committed V2 sale (40,000)
  var fixture = base.fixture;
  var env = u4CacheEnv_(fixture);
  try {
    var voidIdentity = "ORDER:" + base.orderID;
    var pre = getTransactionsPeriodRows(U4_RANGE);
    check("M0", pre.cacheHit === false && pre.rows.filter(function(row) {
      return row.id === voidIdentity && row.revenue === 40000 && row.isActive === true;
      }).length === 1, JSON.stringify(u4PeriodIds_(pre.rows)));
    getTransactionsPeriodRows(U4_RANGE); // warm
    // Void -> immediate period read reflects the voided state (inactive row).
    var voidRes = salesRecognitionV2VoidWithRuntime_(
      u6VoidPayload_("u4wc-void-1", base.orderID),
      u6NovRuntime_({ fixture: fixture, repository: base.runtime.repository }));
    u6MirrorOperations_(fixture, base.runtime.repository);
    check("M1", voidRes.status === "DONE" && env.invalidateCalls === 1,
      JSON.stringify(voidRes));
    var afterVoid = getTransactionsPeriodRows(U4_RANGE);
    var voidRows = afterVoid.rows.filter(function(row) { return row.id === voidIdentity; });
    check("M2", afterVoid.cacheHit === false && voidRows.length === 1 &&
      voidRows[0].isActive === false, JSON.stringify({ cacheHit: afterVoid.cacheHit,
        rows: voidRows }));
    // Active U4 view (same cache) immediately excludes the voided chain.
    var activeAfterVoid = getTransactionsPage(u4PageRequest_());
    check("M2b", activeAfterVoid.cacheHit === true &&
      activeAfterVoid.rows.filter(function(row) { return row.id === voidIdentity; })
        .length === 0, JSON.stringify(u4PeriodIds_(activeAfterVoid.rows)));
    // Second committed sale; its own DONE invalidates (count 2).
    var runtime2 = salesV2SaveRuntime_({ fixture: fixture });
    var sale2 = salesRecognitionV2SaveWithRuntime_(
      salesV2SavePayload_("u4wc-mut-correct"), runtime2);
    u3MirrorOperations_(fixture, runtime2.repository);
    check("M3", sale2.status === "DONE" && env.invalidateCalls === 2,
      JSON.stringify(sale2));
    var repop = getTransactionsPeriodRows(U4_RANGE);
    check("M3b", repop.cacheHit === false && repop.rows.filter(function(row) {
      return row.id === "ORDER:" + sale2.orderID && row.revenue === 60000 &&
        row.isActive === true; }).length === 1, JSON.stringify(u4PeriodIds_(repop.rows)));
    getTransactionsPeriodRows(U4_RANGE); // warm
    // Correct -> immediate U4 read shows the replacement as active authority.
    var correctRes = salesRecognitionV2CorrectWithRuntime_(
      u6CorrectPayload_("u4wc-correct-1", sale2.orderID,
        [{ productID: "P1", productVariantID: "PV1", qty: 1 }]),
      u6NovRuntime_({ fixture: fixture, repository: runtime2.repository }));
    u6MirrorOperations_(fixture, runtime2.repository);
    check("M4", correctRes.status === "DONE" && correctRes.orderID !== sale2.orderID &&
      env.invalidateCalls === 3, JSON.stringify(correctRes));
    var afterCorrect = getTransactionsPeriodRows(U4_RANGE);
    var replacementIdentity = "ORDER:" + correctRes.orderID;
    var originalRows = afterCorrect.rows.filter(function(row) {
      return row.id === "ORDER:" + sale2.orderID; });
    check("M5", afterCorrect.cacheHit === false && originalRows.length === 1 &&
      originalRows[0].isActive === false &&
      afterCorrect.rows.filter(function(row) {
        return row.id === replacementIdentity && row.revenue === 20000 &&
          row.isActive === true && row.salesCohort === "V2_COMMITTED"; }).length === 1,
      JSON.stringify(u4PeriodIds_(afterCorrect.rows)));
    var activeAfterCorrect = getTransactionsPage(u4PageRequest_());
    check("M6", activeAfterCorrect.rows.filter(function(row) {
        return row.id === replacementIdentity; }).length === 1 &&
      activeAfterCorrect.rows.filter(function(row) {
        return row.id === "ORDER:" + sale2.orderID; }).length === 0,
      JSON.stringify(u4PeriodIds_(activeAfterCorrect.rows)));
  } finally { env.restore(); }
  return { total: pass, pass: pass, fail: 0 };
}
