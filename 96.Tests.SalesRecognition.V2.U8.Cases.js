// SALES_RECOGNITION_V2 U8 integration/release-evidence tests: proves U1-U7
// compose as ONE coherent system across cross-module contracts, transport,
// lifecycle, read-after-write, Finance parity, failure/recovery, cohort
// isolation, mode transitions, forbidden side effects, preflights, and release
// packaging readiness. Fixture-only: real production functions executed over
// in-memory/disposable workbook + in-memory operations repository + injected
// batch/transport seams. No production contact, no network, no clasp, no
// writes outside fixture memory.

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function u8RowCounts_(fixture) { return u6RowCounts_(fixture); }
function u8SheetText_(fixture, names) { return u6SheetText_(fixture, names); }
function u8ProtectedText_(fixture) {
  return u8SheetText_(fixture, u6ProtectedSheets_().concat(["Settlements"]));
}
function u8OpRows_(repository, type) { return u6OpRows_(repository, type); }
function u8Throw_(fn) { return u7Throw_(fn); }
function u8CountsJSON_(fixture) { return JSON.stringify(u8RowCounts_(fixture)); }

// Fresh P&L-capable fixture (U4/U5 base + the 5000 COGS account used by
// legacy record resolution). Expense/depreciation rows are added only by
// u5FinishFinanceFixture_ in fixtures that assert Policy C numbers.
function u8FinanceFixture_() {
  var fixture = salesV2SaveFixture_(u5FinanceSheets_());
  u5FinishAccounts_(fixture);
  return fixture;
}

// ---------------------------------------------------------------------------
// A-D + Save transport: fresh E2E, deterministic replay, lost response,
// UNKNOWN/partial/conflict recovery, real mocked request shapes.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U8EndToEnd() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U8_E2E:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    t = TRANSACTION_PRODUCTION_CONTRACT, mutation = SALES_RECOGNITION_V2_MUTATION;

  // ---- A: Fresh V2 sale E2E through the operator boundary ----
  var fixture = u8FinanceFixture_();
  var rt = salesV2SaveRuntime_({ fixture: fixture, repository: u7Repo_() });
  var payload = salesV2SavePayload_("u8-e2e-1"); // two lines, 1+2 qty @ 20000
  var res = salesV2OperatorCreateWithRuntime_(payload, rt, u7Config_("ACTIVE"));
  // A1: response carries exactly the contract the controller consumes for Done.
  check("A1", res.success === true && res.requestKey === "u8-e2e-1" &&
    res.data && res.data.OrderID && res.data.salesCohort === "V2_COMMITTED" &&
    res.data.recognitionStatus === "RECOGNIZED", JSON.stringify(res));
  check("A2", ["ReceiveVia", "receiveVia", "paymentMethod", "PaidAt",
    "AccountCode", "paymentStatus"].every(function(key) {
      return !Object.prototype.hasOwnProperty.call(res.data, key); }),
    JSON.stringify(Object.keys(res.data)));

  var ops = rt.repository.rows();
  var orders = readCanonicalTable(fixture, "Orders", t.ORDERS.HEADERS);
  var orderLines = readCanonicalTable(fixture, "OrderLines", t.ORDER_LINES.HEADERS);
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents", contract.HEADERS);
  var audits = readCanonicalTable(fixture, "SalesRecognitionAudits", save.AUDIT_HEADERS);
  var plan = JSON.parse(ops[0].OperationPlan);
  var ledger = readCanonicalTable(fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var jrows = ledger.filter(function(row) {
    return String(row.JournalID) === String(plan.journalID);
  });
  // A3: exactly one Sale/event/journal/audit; one header; multiline detail.
  check("A3", ops.length === 1 && ops[0].OperationType === save.OPERATION_TYPE &&
    ops[0].State === "COMMITTED" && String(ops[0].BusinessID) === res.data.OrderID &&
    orders.length === 1 && orderLines.length === 2 && events.length === 1 &&
    audits.length === 1 && jrows.length === 2,
    JSON.stringify({ ops: ops.length, orders: orders.length, lines: orderLines.length,
      events: events.length, audits: audits.length, journal: jrows.length }));
  // A4: journal exactly Dr1030 / Cr4000 for the full OrderTotal.
  check("A4", jrows[0].AccountCode === "1030" &&
    Number(jrows[0].Debit) === 60000 && Number(jrows[0].Credit) === 0 &&
    jrows[1].AccountCode === "4000" && Number(jrows[1].Credit) === 60000 &&
    Number(jrows[1].Debit) === 0, JSON.stringify(jrows));
  // A5: NO Payment/Settlement/fulfillment/5000-1100/Inventory/fabricated method.
  check("A5", !fixture.getSheetByName("InventoryLedger") &&
    orders[0].PaymentStatus === "UNPAID" && orders[0].FulfillmentStatus === "OPEN" &&
    orders[0].CompletedAt === "" && orders[0].PreparingAt === "" &&
    ledger.filter(function(row) {
      return String(row.JournalID) === String(plan.journalID) &&
        ["5000", "1100", "2010", "1000"].indexOf(String(row.AccountCode)) !== -1;
    }).length === 0 &&
    ledger.every(function(row) { return String(row.AccountCode) !== "2010"; }) &&
    fixture.getSheetByName("Payments").getLastRow() === 1 &&
    fixture.getSheetByName("Settlements").getLastRow() === 1,
    JSON.stringify({ ledger: ledger.map(function(row) { return row.AccountCode; }) }));
  // Mirror the committed operation into the sheet evidence surface so the
  // sheet-based projection reader observes the same persisted state.
  u3MirrorOperations_(fixture, rt.repository);
  // A6: U3 projection read-after-write.
  var projection = buildRecognizedSalesProjectionFromSpreadsheet_(fixture);
  check("A6", projection.events.length === 1 &&
    projection.totals.recognizedRevenue === 60000 &&
    projection.activeView.totals.recognizedRevenue === 60000 &&
    projection.quality.issues.length === 0 && projection.quality.excluded.length === 0,
    JSON.stringify({ totals: projection.totals, issues: projection.quality.issues }));
  // A7: U4 Sales list sees the committed Sale once with full identity.
  var page = u4ActivePage_(fixture);
  var pageRows = u4RowsById_(page.rows);
  var rowA = pageRows["ORDER:" + res.data.OrderID];
  check("A7", Boolean(rowA) && rowA.revenue === 60000 && rowA.qty === 3 &&
    rowA.salesCohort === "V2_COMMITTED" &&
    rowA.salesSourceLabel === "SALES_RECOGNITION_V2" &&
    rowA.recognitionId === plan.recognitionID && rowA.revisionId === plan.revisionID,
    JSON.stringify(rowA));
  var recent = u4ActivePage_(fixture, { tab: "recent" });
  function salesShape(sourceRows) {
    return sourceRows.filter(function(row) { return row.transactionType === "Sales"; })
      .map(function(row) { return row.id + "|" + row.revenue; }).sort();
  }
  check("A7b", JSON.stringify(salesShape(page.rows)) ===
    JSON.stringify(salesShape(recent.rows)) &&
    JSON.stringify(salesShape(page.rows)) ===
      JSON.stringify(["ORDER:" + res.data.OrderID + "|60000"]),
    JSON.stringify({ sales: salesShape(page.rows), recent: salesShape(recent.rows) }));
  // A8: U4 detail reads the multiline Sale from persisted snapshots.
  var detail = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail("ORDER:" + res.data.OrderID);
  });
  check("A8", detail.success === true && detail.data.status === "ACTIVE" &&
    detail.data.revenue === 60000 && detail.data.lines.length === 2 &&
    detail.data.recognitionId === plan.recognitionID &&
    detail.data.revisionId === plan.revisionID &&
    detail.data.lines.every(function(line) { return line.fromSnapshot === true; }),
    JSON.stringify(detail.data && { status: detail.data.status,
      revenue: detail.data.revenue, lines: detail.data.lines.length }));
  // A9: U5 P&L Revenue = exact signed projection amount for the period.
  var pnlA = u5Pnl_(fixture, "2026-10-01", "2026-10-31");
  check("A9", pnlA.summary.revenue === 60000 &&
    pnlA.salesRecognition.recognizedRevenue === 60000 &&
    pnlA.salesRecognition.revenueAuthorityComplete === true &&
    pnlA.summary.cogs === null && pnlA.grossProfitAvailable === false &&
    u5EventsRevenue_(fixture, "2026-10-01", "2026-10-31") === 60000,
    JSON.stringify({ revenue: pnlA.summary.revenue,
      sr: pnlA.salesRecognition.recognizedRevenue }));

  // Write-surface proof for Save: authorized deltas only, protected byte-equal.
  var saveCounts = u8CountsJSON_(fixture);
  var protectedBefore = u8ProtectedText_(fixture);
  var counts = u8RowCounts_(fixture);
  check("A10", counts.Orders === 2 && counts.OrderLines === 3 &&
    counts.SalesRecognitionEvents === 2 && counts.BalanceLedger === 3 &&
    counts.SalesRecognitionAudits === 2 && counts.Payments === 1 &&
    counts.Settlements === 1, JSON.stringify(counts));

  // ---- B: duplicate submit same RequestKey x N -> one durable effect ----
  var replay1 = salesV2OperatorCreateWithRuntime_(payload, rt, u7Config_("ACTIVE"));
  var replay2 = salesRecognitionV2SaveWithRuntime_(payload, rt);
  var replay3 = salesV2OperatorCreateWithRuntime_(payload, rt, u7Config_("ACTIVE"));
  check("B1", replay1.success === true && replay3.success === true &&
    replay1.requestKey === "u8-e2e-1" && replay3.requestKey === "u8-e2e-1",
    JSON.stringify([replay1.requestKey, replay3.requestKey]));
  check("B2", replay2.status === "DONE" && replay2.replay === true &&
    replay2.writeCount === 0 && replay2.orderID === res.data.OrderID,
    JSON.stringify(replay2));
  check("B3", u8CountsJSON_(fixture) === saveCounts &&
    rt.repository.rows().length === 1 &&
    readCanonicalTable(fixture, "SalesRecognitionEvents", contract.HEADERS).length === 1 &&
    readCanonicalTable(fixture, "Orders", t.ORDERS.HEADERS).length === 1,
    JSON.stringify({ before: saveCounts, after: u8CountsJSON_(fixture) }));

  // ---- C: response lost after COMMITTED -> recovery discovers authority ----
  var cFixture = u8FinanceFixture_();
  var crt = salesV2SaveRuntime_({ fixture: cFixture, repository: u7Repo_(),
    crash: "V2_AFTER_COMMIT" });
  var cRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u8-lost-1"),
    crt, u7Config_("ACTIVE"));
  check("C1", cRes.success === false && cRes.unknown === true &&
    cRes.requestKey === "u8-lost-1" && cRes.error &&
    String(cRes.error.message).indexOf("CRASH:V2_AFTER_COMMIT") !== -1,
    JSON.stringify(cRes));
  var cOps = crt.repository.rows();
  check("C2", cOps.length === 1 && cOps[0].State === "COMMITTED" &&
    cOps[0].OperationType === save.OPERATION_TYPE &&
    readCanonicalTable(cFixture, "SalesRecognitionEvents", contract.HEADERS).length === 1 &&
    readCanonicalTable(cFixture, "Orders", t.ORDERS.HEADERS).length === 1,
    JSON.stringify(cOps.map(function(op) { return [op.State, op.OperationType]; })));
  var found = salesV2OperatorFindOperationByRequestKey_(crt.repository, "u8-lost-1");
  check("C3", Boolean(found) && found.State === "COMMITTED" &&
    String(found.BusinessID) === String(cOps[0].BusinessID) &&
    found.RequestKey === "u8-lost-1", JSON.stringify(found && { id: found.OperationID,
      state: found.State, key: found.RequestKey }));
  var cCounts = u8CountsJSON_(cFixture);
  var cRec = salesV2OperatorCreateWithRuntime_(u7Payload_("u8-lost-1"),
    crt, u7Config_("ACTIVE"));
  check("C4", cRec.success === true && cRec.requestKey === "u8-lost-1" &&
    cRec.data.OrderID === found.BusinessID &&
    u8CountsJSON_(cFixture) === cCounts && crt.repository.rows().length === 1,
    JSON.stringify({ res: cRec, before: cCounts, after: u8CountsJSON_(cFixture) }));
  var cReplay = salesRecognitionV2SaveWithRuntime_(u7Payload_("u8-lost-1"), crt);
  check("C5", cReplay.status === "DONE" && cReplay.replay === true &&
    cReplay.writeCount === 0 && cReplay.orderID === found.BusinessID,
    JSON.stringify(cReplay));
  // Recovery through the production recovery dispatcher, still one artifact set.
  var cRecovered = salesV2OperatorRecoverWithRuntime_(found, crt);
  check("C6", cRecovered.State === "COMMITTED" &&
    u8CountsJSON_(cFixture) === cCounts &&
    readCanonicalTable(cFixture, "SalesRecognitionEvents", contract.HEADERS).length === 1,
    JSON.stringify({ state: cRecovered.State, after: u8CountsJSON_(cFixture) }));

  // ---- D: UNKNOWN after possible write; identity retained; fail closed ----
  // D1: batch outcome unknown -> server UNKNOWN, client keeps the RequestKey.
  var dFixture = u8FinanceFixture_();
  var drt = salesV2SaveRuntime_({ fixture: dFixture, repository: u7Repo_() });
  var dFirst = true;
  var dInnerBatch = drt.batch;
  drt.batch = function(ranges) {
    if (dFirst) {
      dFirst = false;
      drt.events.batches.push(ranges);
      throw new Error("HTTP 429");
    }
    return dInnerBatch(ranges);
  };
  var dRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u8-unknown-1"),
    drt, u7Config_("ACTIVE"));
  var dBatchesAfterUnknown = drt.events.batches.length;
  check("D1", dRes.success === false && dRes.unknown === true &&
    dRes.requestKey === "u8-unknown-1" &&
    drt.repository.rows().length === 1 &&
    drt.repository.rows()[0].State === "IN_PROGRESS" &&
    readCanonicalTable(dFixture, "Orders", t.ORDERS.HEADERS).length === 0 &&
    dBatchesAfterUnknown === 1,
    JSON.stringify({ res: dRes,
      state: drt.repository.rows()[0] && drt.repository.rows()[0].State,
      batches: dBatchesAfterUnknown }));
  // D2: retry inspects identities and recovers exactly (same key, one Sale).
  var dRes2 = salesV2OperatorCreateWithRuntime_(u7Payload_("u8-unknown-1"),
    drt, u7Config_("ACTIVE"));
  check("D2", dRes2.success === true && dRes2.requestKey === "u8-unknown-1" &&
    drt.repository.rows()[0].State === "COMMITTED" &&
    readCanonicalTable(dFixture, "Orders", t.ORDERS.HEADERS).length === 1 &&
    readCanonicalTable(dFixture, "SalesRecognitionEvents", contract.HEADERS).length === 1,
    JSON.stringify({ key: dRes2.requestKey, order: dRes2.data && dRes2.data.OrderID }));

  // D3: partial write -> RECOVERY_REQUIRED, fail closed, no blind repair.
  var pFixture = u8FinanceFixture_();
  var prt = salesV2SaveRuntime_({ fixture: pFixture, repository: u7Repo_(),
    batch: function(ranges) {
      // First subrequest lands, then the transport dies: a partial set.
      var range = ranges[0];
      var sheet = pFixture.getSheetByName(range.range);
      sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length,
        range.values[0].length).setValues(range.values);
      throw new Error("HTTP 500 mid-batch");
    } });
  var pRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u8-partial-1"),
    prt, u7Config_("ACTIVE"));
  check("D3", pRes.success === false && pRes.unknown === true &&
    pRes.requestKey === "u8-partial-1" && prt.repository.rows().length === 1 &&
    prt.repository.rows()[0].State === "IN_PROGRESS",
    JSON.stringify(pRes));
  var pCounts = u8CountsJSON_(pFixture);
  var pRes2 = salesRecognitionV2SaveWithRuntime_(u7Payload_("u8-partial-1"), prt);
  check("D4", pRes2.status === "RECOVERY_REQUIRED" &&
    (pRes2.code === save.CODES.ARTIFACTS_INCOMPLETE ||
      pRes2.code === save.CODES.IDENTITY_CONFLICT) &&
    pRes2.requestKey === "u8-partial-1" &&
    u8CountsJSON_(pFixture) === pCounts,
    JSON.stringify({ res: pRes2, before: pCounts, after: u8CountsJSON_(pFixture) }));

  // D5: changed payload under the same RequestKey -> definite CONFLICT,
  // the original operation row (identity) is never discarded.
  var xFixture = u8FinanceFixture_();
  var xrt = salesV2SaveRuntime_({ fixture: xFixture, repository: u7Repo_() });
  var xFirst = salesRecognitionV2SaveWithRuntime_(
    { requestKey: "u8-conflict-1", orderType: "DINE_IN",
      lines: [{ productID: "P1", productVariantID: "PV1", qty: 1 }] }, xrt);
  check("D5a", xFirst.status === "DONE", JSON.stringify(xFirst));
  var xSecond = salesRecognitionV2SaveWithRuntime_(
    { requestKey: "u8-conflict-1", orderType: "DINE_IN",
      lines: [{ productID: "P1", productVariantID: "PV1", qty: 2 }] }, xrt);
  check("D5b", xSecond.status === "CONFLICT" && xSecond.unknown !== true &&
    xSecond.requestKey === "u8-conflict-1" &&
    xrt.repository.rows().length === 1 &&
    xrt.repository.rows()[0].State === "COMMITTED" &&
    readCanonicalTable(xFixture, "Orders", t.ORDERS.HEADERS).length === 1,
    JSON.stringify(xSecond));

  // ---- Transport contract: real mocked request shapes per mutation ----
  var originalTransport = inventoryReceiptMigrationRequest_;
  var recorded = [];
  function sheetIdsResponse_(titles) {
    return { spreadsheetId: NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
      sheets: titles.map(function(entry) {
        return { properties: { sheetId: entry[1], title: entry[0] } }; }) };
  }
  try {
    inventoryReceiptMigrationRequest_ = function(method, suffix, body) {
      recorded.push({ method: method, suffix: suffix, body: body });
      if (method === "get") {
        return sheetIdsResponse_(save.WRITE_SURFACES.map(function(name, index) {
          return [name, index + 1];
        }));
      }
      return { spreadsheetId: NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID };
    };
    // T1: sheetIds request shape (GET, fields projection, identity guard).
    var ids = salesRecognitionV2SaveSheetIdsRequest_();
    check("T1", recorded.length === 1 && recorded[0].method === "get" &&
      recorded[0].suffix.indexOf("fields=") !== -1 &&
      Object.keys(ids).length === save.WRITE_SURFACES.length &&
      save.WRITE_SURFACES.every(function(name) {
        return typeof ids[name] === "number";
      }), JSON.stringify({ method: recorded[0].method, suffix: recorded[0].suffix }));
    // T2: batchUpdate body = exactly five appendCells over the write surfaces.
    var planT = JSON.parse(rt.repository.rows()[0].OperationPlan);
    var rangesT = salesRecognitionV2SaveValueRanges_(planT);
    recorded = [];
    salesRecognitionV2SaveBatchRequest_(rangesT);
    var bodyT = recorded[recorded.length - 1];
    check("T2", bodyT.method === "post" && bodyT.suffix === ":batchUpdate" &&
      bodyT.body.requests.length === save.WRITE_SURFACES.length &&
      bodyT.body.requests.every(function(request) {
        var keys = Object.keys(request);
        return keys.length === 1 && keys[0] === "appendCells" &&
          request.appendCells.fields === "userEnteredValue" &&
          typeof request.appendCells.sheetId === "number" &&
          request.appendCells.rows.length >= 1;
      }) &&
      JSON.stringify(rangesT.map(function(range) { return range.range; })) ===
        JSON.stringify(save.WRITE_SURFACES),
      JSON.stringify(bodyT.body.requests.map(function(request) {
        return Object.keys(request); })));
    // T3: RAW CellData kinds only (never formulaValue).
    var cellKeys = {};
    bodyT.body.requests.forEach(function(request) {
      request.appendCells.rows.forEach(function(row) {
        row.values.forEach(function(cell) {
          Object.keys(cell.userEnteredValue).forEach(function(key) { cellKeys[key] = true; });
        });
      });
    });
    check("T3", !Object.prototype.hasOwnProperty.call(cellKeys, "formulaValue") &&
      Object.keys(cellKeys).length > 0 &&
      Object.keys(cellKeys).every(function(key) {
        return ["stringValue", "numberValue", "boolValue"].indexOf(key) !== -1;
      }), JSON.stringify(cellKeys));
    // T4: missing sheetId rejects the body BEFORE any request is issued.
    var threwT4 = u8Throw_(function() {
      salesRecognitionV2SaveBatchBody_(rangesT, { Orders: 1 });
    });
    check("T4", Boolean(threwT4) &&
      String(threwT4.message).indexOf("SHEET_ID_UNAVAILABLE") === 0,
      String(threwT4 && threwT4.message));
    // T5: identity mismatch on the metadata response fails closed.
    inventoryReceiptMigrationRequest_ = function() {
      return { spreadsheetId: "NOT_THE_PRODUCTION_ID", sheets: [] };
    };
    var threwT5 = u8Throw_(function() { salesRecognitionV2SaveSheetIdsRequest_(); });
    check("T5", Boolean(threwT5) && threwT5.message === "PRODUCTION_IDENTITY_MISMATCH",
      String(threwT5 && threwT5.message));
    // T6: cell/UTF-8/batch bounds evaluate and pass for the frozen plan.
    var bounds = salesRecognitionV2SaveBounds_(planT);
    var threwT6 = u8Throw_(function() {
      salesRecognitionV2SaveCellValue_(new Array(save.MAX_CELL_CHARS + 2).join("x"));
    });
    check("T6", bounds.ok === true && bounds.lineCount === 2 &&
      bounds.cells > 0 && bounds.bytes > 0 &&
      salesRecognitionV2SaveCellValue_("ok").stringValue === "ok" &&
      Boolean(threwT6) &&
      String(threwT6.message).indexOf("UNSAFE_CELL_CHARS") === 0,
      JSON.stringify(bounds));
    // T7: mutation transport (Void) = one batchUpdate over its own surfaces.
    inventoryReceiptMigrationRequest_ = function(method, suffix, body) {
      recorded.push({ method: method, suffix: suffix, body: body });
      if (method === "get") {
        return sheetIdsResponse_(save.WRITE_SURFACES.map(function(name, index) {
          return [name, index + 1];
        }));
      }
      return { spreadsheetId: NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID };
    };
    var t7Fixture = u3SaveFixture_("u8-t7-void");
    var t7rt = u6NovRuntime_({ fixture: t7Fixture.fixture,
      repository: t7Fixture.runtime.repository });
    var t7Res = salesRecognitionV2VoidWithRuntime_(
      u6VoidPayload_("u8-t7-void", t7Fixture.orderID), t7rt);
    var t7Plan = JSON.parse(u8OpRows_(t7rt.repository, mutation.VOID)[0].OperationPlan);
    var t7Ranges = salesRecognitionV2MutationValueRanges_(t7Plan);
    recorded = [];
    salesRecognitionV2MutationBatchRequest_(mutation.VOID, t7Ranges);
    var t7Body = recorded[recorded.length - 1];
    var t7Surfaces = mutation.WRITE_SURFACES[mutation.VOID];
    check("T7", t7Res.status === "DONE" && t7Body.method === "post" &&
      t7Body.suffix === ":batchUpdate" &&
      t7Body.body.requests.length === t7Surfaces.length &&
      t7Body.body.requests.every(function(request) {
        return Object.keys(request).length === 1 &&
          Object.keys(request)[0] === "appendCells" &&
          request.appendCells.fields === "userEnteredValue";
      }),
      JSON.stringify({ res: t7Res.status, suffix: t7Body.suffix,
        requests: t7Body.body.requests.length, surfaces: t7Surfaces }));
    // T8: transport HTTP error surfaces (the core classifies it UNKNOWN - D1).
    inventoryReceiptMigrationRequest_ = function() { throw new Error("HTTP 429"); };
    var threwT8 = u8Throw_(function() { salesRecognitionV2SaveBatchRequest_(rangesT); });
    check("T8", Boolean(threwT8) && threwT8.message === "HTTP 429",
      String(threwT8 && threwT8.message));
  } finally {
    inventoryReceiptMigrationRequest_ = originalTransport;
  }
  // T9: no autonomous in-call retry - the failed attempt issued ONE batch.
  check("T9", dBatchesAfterUnknown === 1, String(dBatchesAfterUnknown));
  // T10: protected surfaces untouched by the whole A-D sequence fixture.
  check("T10", u8ProtectedText_(fixture) === protectedBefore,
    "protected sheets changed during A-D");

  if (typeof console !== "undefined" && console.log) {
    console.log("U8_IDENTITY_MATRIX_SAVE " + JSON.stringify({
      requestKey: plan.requestKey, operationID: plan.operationID,
      orderID: plan.orderID, revisionID: plan.revisionID,
      recognitionID: plan.recognitionID, journalID: plan.journalID,
      auditID: plan.auditID }));
  }
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// E-G: Void E2E, Correct E2E (36,000 -> 41,000), Correct-vs-Void concurrency,
// lineage matrix, write-surface proofs for both mutations.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U8Lifecycle() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U8_LIFE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var contract = SALES_RECOGNITION_V2_CONTRACT, t = TRANSACTION_PRODUCTION_CONTRACT,
    mutation = SALES_RECOGNITION_V2_MUTATION;

  // ---- E: Void E2E ----
  var eFixture = u6PricedFixture_("u8-void", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }], u6FinanceExtend_);
  var eOriginalEvent = JSON.stringify(eFixture.eventRow);
  var eOriginalOrderRow = JSON.stringify(
    eFixture.fixture.getSheetByName("Orders").values[1]);
  var eProtected = u8ProtectedText_(eFixture.fixture);
  var eCounts = u8RowCounts_(eFixture.fixture);
  var ert = u6NovRuntime_({ fixture: eFixture.fixture,
    repository: eFixture.runtime.repository });
  var eRes = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u8-void", eFixture.orderID), ert);
  var eCountsAfter = u8RowCounts_(eFixture.fixture);
  u6MirrorOperations_(eFixture.fixture, eFixture.runtime.repository);
  check("E1", eRes.status === "DONE" && eRes.requestKey === "u8-void",
    JSON.stringify(eRes));
  // E2: original immutable; authorized deltas only (Events+1, Ledger+2, Audits+1).
  check("E2", eCountsAfter.Orders === eCounts.Orders &&
    eCountsAfter.OrderLines === eCounts.OrderLines &&
    eCountsAfter.SalesRecognitionEvents === eCounts.SalesRecognitionEvents + 1 &&
    eCountsAfter.BalanceLedger === eCounts.BalanceLedger + 2 &&
    eCountsAfter.SalesRecognitionAudits === eCounts.SalesRecognitionAudits + 1 &&
    eCountsAfter.Payments === eCounts.Payments &&
    eCountsAfter.Settlements === eCounts.Settlements,
    JSON.stringify({ before: eCounts, after: eCountsAfter }));
  var eEvents = readCanonicalTable(eFixture.fixture, "SalesRecognitionEvents",
    contract.HEADERS);
  check("E3", JSON.stringify(eEvents[0]) === eOriginalEvent &&
    JSON.stringify(eFixture.fixture.getSheetByName("Orders").values[1]) ===
      eOriginalOrderRow, "original event/order mutated");
  var voidPlan = JSON.parse(u8OpRows_(ert.repository, mutation.VOID)[0].OperationPlan);
  check("E4", eEvents.length === 2 && eEvents[1].EventType === "REVERSAL" &&
    eEvents[1].ReversalOfRecognitionID === eFixture.eventRow.RecognitionID &&
    String(eEvents[1].EconomicDate) === "2026-11-20" &&
    Number(eEvents[1].Amount) === 36000 &&
    voidPlan.reversalRecognitionID === eEvents[1].RecognitionID,
    JSON.stringify({ event: eEvents[1], plan: voidPlan.reversalRecognitionID }));
  // E5: negative reversal journal Dr4000 / Cr1030 in the action period only.
  var eLedger = readCanonicalTable(eFixture.fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var eJournal = eLedger.filter(function(row) {
    return String(row.JournalID) === String(voidPlan.reversalJournalID);
  });
  check("E5", eJournal.length === 2 && eJournal[0].AccountCode === "4000" &&
    Number(eJournal[0].Debit) === 36000 && Number(eJournal[0].Credit) === 0 &&
    eJournal[1].AccountCode === "1030" && Number(eJournal[1].Credit) === 36000 &&
    Number(eJournal[1].Debit) === 0 &&
    eJournal.every(function(row) { return String(row.Tanggal) === "2026-11-20"; }),
    JSON.stringify(eJournal));
  // E6: NO Cash/refund/2010/Inventory/HPP-COGS reversal; protected byte-equal.
  var eNewLedger = eLedger.slice(eCounts.BalanceLedger - 1);
  check("E6", eNewLedger.length === 2 &&
    eNewLedger.every(function(row) {
      return ["4000", "1030"].indexOf(String(row.AccountCode)) !== -1;
    }) && u8ProtectedText_(eFixture.fixture) === eProtected,
    JSON.stringify(eNewLedger.map(function(row) { return row.AccountCode; })));
  // E7: U3 original + reversal; active view drops the voided chain.
  var eProjection = u6Projection_(eFixture.fixture);
  check("E7", eProjection.events.length === 2 &&
    eProjection.events.filter(function(event) {
      return event.eventType === "REVERSAL"; }).length === 1 &&
    eProjection.events.some(function(event) {
      return event.eventType === "REVERSAL" && event.signedAmount === -36000; }) &&
    eProjection.activeView.events.length === 0 &&
    eProjection.quality.issues.length === 0 &&
    eProjection.totals.byPeriod["2026-10"] === 36000 &&
    eProjection.totals.byPeriod["2026-11"] === -36000,
    JSON.stringify({ totals: eProjection.totals }));
  // E8: U4 Voided lifecycle view; original never active again.
  var eIdentity = "ORDER:" + eFixture.orderID;
  var eActive = u4ActivePage_(eFixture.fixture);
  var eVoided = u4ActivePage_(eFixture.fixture, { lifecycleState: "voided" });
  var eVoidedRow = u4RowsById_(eVoided.rows)[eIdentity];
  check("E8", !u4RowsById_(eActive.rows)[eIdentity] && Boolean(eVoidedRow) &&
    eVoidedRow.isActive === false && eVoidedRow.revenue === 36000,
    JSON.stringify({ active: eActive.rows.map(function(row) { return row.id; }),
      voided: eVoided.rows.map(function(row) { return row.id; }) }));
  var eDetail = u4RunWithFixture_(eFixture.fixture, function() {
    return getCanonicalTransactionDetail(eIdentity);
  });
  check("E9", eDetail.success === true && eDetail.data.status === "VOIDED" &&
    eDetail.data.canVoid === false && eDetail.data.canCorrect === false &&
    eDetail.data.lineage.length === 2, JSON.stringify(eDetail.data && {
      status: eDetail.data.status, lineage: eDetail.data.lineage.length }));
  // E10: U5 original period unchanged + reversal period negative; no prior rewrite.
  var eOctBefore = u5Pnl_(eFixture.fixture, "2026-10-01", "2026-10-31");
  var eNov = u5Pnl_(eFixture.fixture, "2026-11-01", "2026-11-30");
  var eOctAfter = u5Pnl_(eFixture.fixture, "2026-10-01", "2026-10-31");
  check("E10", eOctBefore.summary.revenue === 36000 &&
    eOctAfter.summary.revenue === 36000 && eNov.summary.revenue === -36000,
    JSON.stringify({ oct: eOctAfter.summary.revenue, nov: eNov.summary.revenue }));

  // ---- F: Correct E2E 36,000 -> 41,000, multiline original ----
  var fFixture = u6PricedFixture_("u8-correct", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 1 },
     { productID: "P1", productVariantID: "PV1", qty: 1 }], u6FinanceExtend_);
  var fPlan0 = fFixture.plan;
  check("F0", Number(fPlan0.orderTotal) === 36000 && fPlan0.lineRows.length === 2,
    JSON.stringify({ total: fPlan0.orderTotal, lines: fPlan0.lineRows.length }));
  var fOriginalOrderRow = JSON.stringify(
    fFixture.fixture.getSheetByName("Orders").values[1]);
  var fProtected = u8ProtectedText_(fFixture.fixture);
  var fCounts = u8RowCounts_(fFixture.fixture);
  u6SetPrice_(fFixture.fixture, 41000);
  var frt = u6NovRuntime_({ fixture: fFixture.fixture,
    repository: fFixture.runtime.repository });
  var fRes = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u8-correct", fFixture.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 1 }]), frt);
  var fCountsAfter = u8RowCounts_(fFixture.fixture);
  u6MirrorOperations_(fFixture.fixture, fFixture.runtime.repository);
  check("F1", fRes.status === "DONE" && fRes.orderID !== fFixture.orderID,
    JSON.stringify(fRes));
  var correctPlan = JSON.parse(u8OpRows_(frt.repository, mutation.CORRECT)[0].OperationPlan);
  // F2: full replacement, never delta-only; authorized deltas only.
  check("F2", Number(correctPlan.replacement.orderTotal) === 41000 &&
    correctPlan.replacement.lineRows.length === 1 &&
    Number(correctPlan.amount) === 36000 &&
    fCountsAfter.Orders === fCounts.Orders + 1 &&
    fCountsAfter.OrderLines === fCounts.OrderLines + 1 &&
    fCountsAfter.SalesRecognitionEvents === fCounts.SalesRecognitionEvents + 2 &&
    fCountsAfter.BalanceLedger === fCounts.BalanceLedger + 4 &&
    fCountsAfter.SalesRecognitionAudits === fCounts.SalesRecognitionAudits + 2 &&
    fCountsAfter.Payments === fCounts.Payments &&
    u8ProtectedText_(fFixture.fixture) === fProtected &&
    JSON.stringify(fFixture.fixture.getSheetByName("Orders").values[1]) ===
      fOriginalOrderRow,
    JSON.stringify({ plan: { replacement: correctPlan.replacement.orderTotal,
      lines: correctPlan.replacement.lineRows.length, amount: correctPlan.amount },
      before: fCounts, after: fCountsAfter }));
  // F3: new Revision/Recognition/line IDs; never a 5,000 delta artifact.
  check("F3", correctPlan.replacement.recognitionID !== fPlan0.recognitionID &&
    correctPlan.replacement.revisionID !== fPlan0.revisionID &&
    correctPlan.reversalRecognitionID !== fPlan0.recognitionID &&
    correctPlan.replacement.lineRows[0].OrderLineID !== fPlan0.lineRows[0].OrderLineID &&
    correctPlan.replacement.orderID !== fFixture.orderID,
    JSON.stringify({ rep: correctPlan.replacement.recognitionID,
      orig: fPlan0.recognitionID }));
  var fLedger = readCanonicalTable(fFixture.fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var fNewLedger = fLedger.slice(fCounts.BalanceLedger - 1);
  check("F4", fNewLedger.length === 4 && fNewLedger.every(function(row) {
      return [36000, 41000].indexOf(Number(row.Debit)) !== -1 ||
        [36000, 41000].indexOf(Number(row.Credit)) !== -1;
    }) && fNewLedger.every(function(row) {
      return Number(row.Debit) !== 5000 && Number(row.Credit) !== 5000;
    }) && fNewLedger.every(function(row) {
      return ["4000", "1030"].indexOf(String(row.AccountCode)) !== -1;
    }),
    JSON.stringify(fNewLedger.map(function(row) {
      return [row.AccountCode, row.Debit, row.Credit]; })));
  // F5: replacement snapshots frozen once - post-intent master changes never
  // affect the persisted plan or its deterministic retry.
  var frozenPlanJSON = u8OpRows_(frt.repository, mutation.CORRECT)[0].OperationPlan;
  u6SetPrice_(fFixture.fixture, 99000);
  var fRetry = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u8-correct", fFixture.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 1 }]),
    u6NovRuntime_({ fixture: fFixture.fixture,
      repository: fFixture.runtime.repository }));
  var fReplacementOrders = readCanonicalTable(fFixture.fixture, "Orders",
    t.ORDERS.HEADERS).filter(function(order) {
      return String(order.OrderID) === fRes.orderID; });
  check("F5", fRetry.status === "DONE" && fRetry.replay === true &&
    fRetry.writeCount === 0 &&
    u8OpRows_(frt.repository, mutation.CORRECT)[0].OperationPlan === frozenPlanJSON &&
    fReplacementOrders.length === 1 && Number(fReplacementOrders[0].OrderTotal) === 41000,
    JSON.stringify({ retry: fRetry, total: fReplacementOrders.map(function(order) {
      return order.OrderTotal; }) }));
  // F6: U3 activeView replacement; signed history intact.
  var fProjection = u6Projection_(fFixture.fixture);
  var replacementIdentity = "ORDER:" + fRes.orderID;
  check("F6", fProjection.events.length === 3 &&
    fProjection.totals.recognizedRevenue === 41000 &&
    fProjection.totals.byPeriod["2026-10"] === 36000 &&
    fProjection.totals.byPeriod["2026-11"] === 5000 &&
    fProjection.activeView.events.length === 1 &&
    fProjection.activeView.events[0].namespace.indexOf(replacementIdentity + ":") === 0 &&
    fProjection.activeView.totals.recognizedRevenue === 41000 &&
    fProjection.quality.issues.length === 0,
    JSON.stringify({ totals: fProjection.totals,
      av: fProjection.activeView.events.map(function(event) { return event.namespace; }) }));
  // F7: U4 correct active transaction + detail; original shows Voided.
  var fActive = u4ActivePage_(fFixture.fixture);
  var fActiveIds = fActive.rows.map(function(row) { return row.id; });
  var fVoided = u4ActivePage_(fFixture.fixture, { lifecycleState: "voided" });
  var fReplacementRow = u4RowsById_(fActive.rows)[replacementIdentity];
  var fOriginalRow = u4RowsById_(fVoided.rows)["ORDER:" + fFixture.orderID];
  check("F7", Boolean(fReplacementRow) && fReplacementRow.revenue === 41000 &&
    fActiveIds.indexOf("ORDER:" + fFixture.orderID) === -1 &&
    Boolean(fOriginalRow) && fOriginalRow.revenue === 36000 &&
    fOriginalRow.isActive === false,
    JSON.stringify({ active: fActiveIds, voided: fVoided.rows.map(function(row) {
      return row.id + ":" + row.isActive; }) }));
  var fRepDetail = u4RunWithFixture_(fFixture.fixture, function() {
    return getCanonicalTransactionDetail(replacementIdentity);
  });
  check("F8", fRepDetail.success === true && fRepDetail.data.status === "ACTIVE" &&
    fRepDetail.data.revenue === 41000 &&
    fRepDetail.data.originalId === fFixture.eventRow.RecognitionID,
    JSON.stringify({ status: fRepDetail.data.status,
      revenue: fRepDetail.data.revenue, originalId: fRepDetail.data.originalId }));
  // F9: U5 signed events -36,000 & +41,000 in the correction period, never
  // a lone +5,000 event; original period unchanged.
  var fNovEvents = fProjection.events.filter(function(event) {
    return event.status === "RECOGNIZED" && event.dateKey === "2026-11-20";
  });
  var fOct = u5Pnl_(fFixture.fixture, "2026-10-01", "2026-10-31");
  var fNov = u5Pnl_(fFixture.fixture, "2026-11-01", "2026-11-30");
  check("F9", fNovEvents.length === 2 &&
    fNovEvents.some(function(event) { return event.signedAmount === -36000; }) &&
    fNovEvents.some(function(event) { return event.signedAmount === 41000; }) &&
    !fProjection.events.some(function(event) {
      return event.signedAmount === 5000; }) &&
    fOct.summary.revenue === 36000 && fNov.summary.revenue === 5000,
    JSON.stringify({ nov: fNov.summary.revenue, oct: fOct.summary.revenue,
      events: fNovEvents.map(function(event) { return event.signedAmount; }) }));

  // ---- G: Correct-vs-Void concurrency, different keys, one winner ----
  // G1: Void terminal first -> Correct fails closed, zero writes.
  var g1 = u6PricedFixture_("u8-race-a", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }], u6FinanceExtend_);
  var g1Void = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u8-race-a-v", g1.orderID),
    u6NovRuntime_({ fixture: g1.fixture, repository: g1.runtime.repository }));
  check("G1a", g1Void.status === "DONE", JSON.stringify(g1Void));
  u6MirrorOperations_(g1.fixture, g1.runtime.repository);
  var g1Counts = u8CountsJSON_(g1.fixture);
  var g1Correct = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u8-race-a-c", g1.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 1 }]),
    u6NovRuntime_({ fixture: g1.fixture, repository: g1.runtime.repository }));
  check("G1b", g1Correct.status === "REFUSED" &&
    u8CountsJSON_(g1.fixture) === g1Counts &&
    u8OpRows_(g1.runtime.repository, mutation.CORRECT).length === 0,
    JSON.stringify(g1Correct));
  var g1Projection = u6Projection_(g1.fixture);
  check("G1c", g1Projection.quality.issues.length === 0 &&
    g1Projection.activeView.events.length === 0 &&
    g1Projection.events.filter(function(event) {
      return event.eventType === "REVERSAL"; }).length === 1,
    JSON.stringify({ issues: g1Projection.quality.issues }));
  // G2: Correct terminal first -> Void fails closed, zero writes; lineage valid.
  var g2 = u6PricedFixture_("u8-race-b", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }], u6FinanceExtend_);
  u6SetPrice_(g2.fixture, 41000);
  var g2Correct = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u8-race-b-c", g2.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 1 }]),
    u6NovRuntime_({ fixture: g2.fixture, repository: g2.runtime.repository }));
  check("G2a", g2Correct.status === "DONE", JSON.stringify(g2Correct));
  u6MirrorOperations_(g2.fixture, g2.runtime.repository);
  var g2Counts = u8CountsJSON_(g2.fixture);
  var g2Void = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u8-race-b-v", g2.orderID),
    u6NovRuntime_({ fixture: g2.fixture, repository: g2.runtime.repository }));
  check("G2b", g2Void.status === "REFUSED" &&
    u8CountsJSON_(g2.fixture) === g2Counts &&
    u8OpRows_(g2.runtime.repository, mutation.VOID).length === 0,
    JSON.stringify(g2Void));
  var g2Projection = u6Projection_(g2.fixture);
  var g2Events = g2Projection.events;
  check("G2c", g2Projection.quality.issues.length === 0 &&
    g2Events.length === 3 && g2Projection.activeView.events.length === 1 &&
    g2Events.filter(function(event) { return event.eventType === "REVERSAL"; })
      .every(function(event) {
        return event.chainKey === "ORDER:" + g2.orderID &&
          event.signedAmount === -36000; }) &&
    g2Events.some(function(event) {
      return event.originalId === g2.eventRow.RecognitionID &&
        event.eventType === "RECOGNITION"; }),
    JSON.stringify({ issues: g2Projection.quality.issues,
      events: g2Events.map(function(event) {
        return [event.eventType, event.chainKey, event.originalId]; }) }));
  // G3: pending intent race - the competing key fails closed, zero batches.
  var g3 = u6PricedFixture_("u8-race-c", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }], u6FinanceExtend_);
  var g3PendingRt = u6NovRuntime_({ fixture: g3.fixture,
    repository: g3.runtime.repository, crash: "V2M_AFTER_INTENT" });
  var g3Threw = u8Throw_(function() {
    salesRecognitionV2CorrectWithRuntime_(
      u6CorrectPayload_("u8-race-c-c", g3.orderID,
        [{ productID: "P1", productVariantID: "PV1", qty: 1 }]), g3PendingRt);
  });
  var g3Counts = u8CountsJSON_(g3.fixture);
  var g3VoidRt = u6NovRuntime_({ fixture: g3.fixture,
    repository: g3.runtime.repository });
  var g3Void = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u8-race-c-v", g3.orderID), g3VoidRt);
  check("G3", Boolean(g3Threw) && g3Void.status === "REFUSED" &&
    g3Void.code === "SALES_V2_MUTATION_EXISTS" &&
    u8CountsJSON_(g3.fixture) === g3Counts &&
    g3VoidRt.events.batches.length === 0, JSON.stringify(g3Void));

  if (typeof console !== "undefined" && console.log) {
    console.log("U8_IDENTITY_MATRIX_LIFECYCLE " + JSON.stringify({
      void: { requestKey: voidPlan.requestKey, operationID: voidPlan.operationID,
        orderID: voidPlan.targetOrderID, reversalRecognitionID: voidPlan.reversalRecognitionID,
        reversalRevisionID: voidPlan.reversalRevisionID,
        reversalJournalID: voidPlan.reversalJournalID,
        reversalAuditID: voidPlan.reversalAuditID,
        targetRecognitionID: voidPlan.target.recognitionID },
      correct: { requestKey: correctPlan.requestKey,
        operationID: correctPlan.operationID,
        originalOrderID: correctPlan.targetOrderID,
        replacementOrderID: correctPlan.replacement.orderID,
        replacementRevisionID: correctPlan.replacement.revisionID,
        replacementRecognitionID: correctPlan.replacement.recognitionID,
        replacementJournalID: correctPlan.replacement.journalID,
        replacementAuditID: correctPlan.replacement.auditID,
        reversalRecognitionID: correctPlan.reversalRecognitionID,
        originalRecognitionID: correctPlan.target.recognitionID } }));
  }
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// H-J: historical pre-V2 orders, legacy TabSal isolation, mixed-cohort
// U3/U4/U5 parity with the active-total vs period-Revenue proof.
// ---------------------------------------------------------------------------
function u8GrandFixture_() {
  var fixture = salesV2SaveFixture_(u5FinanceSheets_());
  u5FinishFinanceFixture_(fixture);
  // Legacy cohort: one active + one voided canonical row.
  u3AppendSale_(fixture, { ID_Trx: "SAL-U8-L1", Tanggal: "2026-10-05T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 3000, HJ: 10000 });
  u3AppendSale_(fixture, { ID_Trx: "SAL-U8-L2", Tanggal: "2026-10-06T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 3000, HJ: 8000, IsActive: false });
  var tabsalSnapshot = JSON.stringify(fixture.getSheetByName("tabsal").values);
  // Historical pre-V2: unpaid (never Revenue) + paid once (historical HPP).
  u3AppendOrder_(fixture, { OrderID: "ORD-U8-UNPAID", OrderNumber: "ORD-U8-UNPAID",
    OrderType: "DINE_IN", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
    OrderTotal: 25000, HppTotalSnapshot: 0, CreatedAt: "2026-10-19T00:00:00Z",
    CreatedBy: "u8", PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "",
    UpdatedBy: "u8" }, [u3OrderLine_("ORD-U8-UNPAID", 25000, 1)]);
  u3PaidChain_(fixture, { orderID: "ORD-U8-PAID", amount: 36000, hpp: 15130.58,
    paymentID: "PAY-U8-1", paidAt: "2026-10-20T03:00:00.000Z",
    hppLines: true, withPaymentOp: true });
  // V2 cohort: committed, committed-then-voided, committed-then-corrected.
  var rt = salesV2SaveRuntime_({ fixture: fixture, repository: u7Repo_() });
  function saveKey_(key, payload) {
    var result = salesRecognitionV2SaveWithRuntime_(payload, rt);
    if (result.status !== "DONE") {
      throw new Error("U8_GRAND_SAVE_FAILED:" + key + ":" + result.status + ":" + result.code);
    }
    return result;
  }
  var orderA = saveKey_("u8-v2-a", salesV2SavePayload_("u8-v2-a")); // 60,000
  var orderB = saveKey_("u8-v2-b", u3Payload_("u8-v2-b")); // 40,000
  var orderC = saveKey_("u8-v2-c", u3Payload_("u8-v2-c")); // 40,000
  u6MirrorOperations_(fixture, rt.repository);
  var novRt = u6NovRuntime_({ fixture: fixture, repository: rt.repository });
  var voidRes = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u8-v2-b-void", orderB.orderID), novRt);
  if (voidRes.status !== "DONE") {
    throw new Error("U8_GRAND_VOID_FAILED:" + voidRes.status + ":" + voidRes.code);
  }
  u6SetPrice_(fixture, 41000);
  var correctRes = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u8-v2-c-correct", orderC.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 1 }]), novRt);
  if (correctRes.status !== "DONE") {
    throw new Error("U8_GRAND_CORRECT_FAILED:" + correctRes.status + ":" + correctRes.code);
  }
  u6MirrorOperations_(fixture, rt.repository);
  u4AppendPendingV2_(fixture);
  return { fixture: fixture, runtime: rt, orderA: orderA, orderB: orderB,
    orderC: orderC, voidRes: voidRes, correctRes: correctRes,
    tabsalSnapshot: tabsalSnapshot };
}

function testSalesRecognitionV2U8Cohorts() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U8_COHORT:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var contract = SALES_RECOGNITION_V2_CONTRACT, t = TRANSACTION_PRODUCTION_CONTRACT,
    iss = SALES_RECOGNITION_PROJECTION.ISSUES;

  // ---- H: historical pre-V2 orders under the V2 fixture ----
  var grand = u8GrandFixture_();
  var fixture = grand.fixture;
  var readNames = U4_READ_NAMES.concat(["Accounts", "DepreciationLedger", "Assets"]);
  var beforeH = u3SheetSnapshot_(fixture, readNames);
  // H1: unpaid old Order is never Revenue and is surfaced as excluded.
  var pnlUnpaidDay = u5Pnl_(fixture, "2026-10-19", "2026-10-19");
  check("H1", pnlUnpaidDay.summary.revenue === 0 &&
    pnlUnpaidDay.salesRecognition.excluded.some(function(entry) {
      return entry.sourceIdentity === "ORDER:ORD-U8-UNPAID:R0" &&
        entry.reason === "OLD_ORDER_UNPAID_EXCLUDED";
    }),
    JSON.stringify({ revenue: pnlUnpaidDay.summary.revenue,
      excluded: pnlUnpaidDay.salesRecognition.excluded }));
  // H2: paid old Order recognized exactly once; historical HPP ledger intact.
  var pnlPaidDay = u5Pnl_(fixture, "2026-10-20", "2026-10-20");
  var projectionH = buildRecognizedSalesProjectionFromSpreadsheet_(fixture);
  var ledgerH = readCanonicalTable(fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  check("H2", pnlPaidDay.summary.revenue === 36000 &&
    u5EventsRevenue_(fixture, "2026-10-20", "2026-10-20") === 36000 &&
    projectionH.totals.ledgerRevenueCredits > 0 &&
    ledgerH.filter(function(row) { return String(row.AccountCode) === "5000"; })
      .length === 1 &&
    ledgerH.filter(function(row) { return String(row.AccountCode) === "1100"; })
      .length === 1,
    JSON.stringify({ revenue: pnlPaidDay.summary.revenue,
      credits: projectionH.totals.ledgerRevenueCredits }));
  // H3: historical Payment/fulfillment servicing stays allowed (cohort-limited),
  // a V2 order in the SAME repository refuses, and no sheet row is rewritten.
  var hRepo = transactionReadinessMemoryRepository_(
    { orders: [u7OrderRow_("ORD-U8-PAID"), u7OrderRow_("ORD-U8-V2SERV")] });
  u7SeedOperation_(hRepo, "ORDER_CREATE", "ORD-U8-PAID", "u8-old-serv-op");
  u7SeedOperation_(hRepo, SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE,
    "ORD-U8-V2SERV", "u8-v2-serv-op");
  var hPayRuntime = { spreadsheet: {}, now: function() { return new Date("2026-10-15T02:03:04.000Z"); },
    actor: function() { return "u8@test"; }, financeExists: function() { return true; },
    settle: function() { throw new Error("SETTLE_MUST_NOT_RUN"); }, flush: function() {} };
  var hOldPaid = null;
  var hOldPayError = u8Throw_(function() {
    hOldPaid = createDurableOperationalPayment_("ORD-U8-PAID",
      { requestKey: "u8-pay-old", receiveVia: "CASH", amount: 20000 },
      hPayRuntime, hRepo);
  });
  var hOldTransition = transitionOperationalFulfillmentWithRepository("ORD-U8-PAID",
    "PREPARING", hPayRuntime, hRepo);
  var hV2PayError = u8Throw_(function() {
    createDurableOperationalPayment_("ORD-U8-V2SERV",
      { requestKey: "u8-pay-v2serv", receiveVia: "CASH", amount: 20000 },
      hPayRuntime, hRepo);
  });
  var hV2FulError = u8Throw_(function() {
    transitionOperationalFulfillmentWithRepository("ORD-U8-V2SERV", "COMPLETED",
      hPayRuntime, hRepo);
  });
  check("H3", hOldPayError === null && hOldPaid &&
    hOldPaid.order.PaymentStatus === "PAID" &&
    hOldTransition.order.FulfillmentStatus === "PREPARING" &&
    Boolean(hV2PayError) && hV2PayError.code === "SALES_V2_PAYMENT_RETIRED" &&
    Boolean(hV2FulError) && hV2FulError.code === "SALES_V2_FULFILLMENT_RETIRED" &&
    beforeH === u3SheetSnapshot_(fixture, readNames),
    JSON.stringify({ oldPay: hOldPayError && hOldPayError.code,
      oldFul: hOldTransition.order.FulfillmentStatus,
      v2Pay: hV2PayError && hV2PayError.code,
      v2Ful: hV2FulError && hV2FulError.code,
      sheetChanged: beforeH !== u3SheetSnapshot_(fixture, readNames) }));
  // H4: date never reclassifies; only persisted V2 evidence does.
  var dateOnlyOrder = { OrderID: "ORD-U8-DATEONLY", CreatedAt: "2027-01-01T00:00:00Z" };
  var dateVerdict = classifySalesRecognitionCohort(dateOnlyOrder, {});
  check("H4", dateVerdict.cohort !== contract.COHORTS.V2_COMMITTED &&
    dateVerdict.cohort !== contract.COHORTS.V2_PENDING &&
    salesV2OperatorOrderCohort_("ORD-U8-DATEONLY",
      transactionReadinessMemoryRepository_(), undefined) === "",
    JSON.stringify(dateVerdict));
  // H5: under fixture ACTIVE, old orders keep their cohort and servicing.
  u7WithConfig_(u7Config_("ACTIVE"), function() {
    check("H5", salesV2OperatorOrderCohort_("ORD-U8-PAID", hRepo, fixture) === "" &&
      salesV2OperatorOrderCohort_("ORD-U8-V2SERV", hRepo, undefined) === "V2_COMMITTED" &&
      salesV2OperatorResolvedRoute_().mode === "ACTIVE");
  });
  // H6: paid old detail is PRE_V2 with analytical HPP and no V2 actions.
  var paidDetail = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail("ORDER:ORD-U8-PAID");
  });
  check("H6", paidDetail.success === true &&
    paidDetail.data.salesCohort === "PRE_V2_ORDER" &&
    paidDetail.data.canCorrect === false && paidDetail.data.canVoid === false &&
    paidDetail.data.hppAnalytical === 15130.58,
    JSON.stringify({ cohort: paidDetail.data.salesCohort,
      hpp: paidDetail.data.hppAnalytical }));

  // ---- I: legacy TabSal lifecycle + namespace isolation ----
  // I1: reader sees the legacy active row once; voided stays in voided view;
  // the active Sales set is exactly {legacy active, paid, V2, replacement}.
  var iActive = u4ActivePage_(fixture);
  var iSalesRows = iActive.rows.filter(function(row) {
    return row.transactionType === "Sales";
  });
  var iSalesShape = iSalesRows.map(function(row) { return row.id; }).sort();
  check("I1", JSON.stringify(iSalesShape) === JSON.stringify([
      "ORDER:" + grand.correctRes.orderID,
      "ORDER:" + grand.orderA.orderID,
      "ORDER:ORD-U8-PAID", "SAL-U8-L1" ].sort()) &&
    iSalesShape.filter(function(id) { return id === "SAL-U8-L1"; }).length === 1 &&
    iSalesShape.indexOf("SAL-U8-L2") === -1,
    JSON.stringify(iSalesShape));
  var iVoided = u4ActivePage_(fixture, { lifecycleState: "voided" });
  check("I1b", iVoided.rows.map(function(row) { return row.id; })
    .indexOf("SAL-U8-L2") !== -1,
    JSON.stringify(iVoided.rows.map(function(row) { return row.id; })));
  // I2: Finance counts the legacy row once, via the shared projection.
  var iOct = u5Pnl_(fixture, "2026-10-05", "2026-10-05");
  check("I2", iOct.summary.revenue === 10000 &&
    u5EventsRevenue_(fixture, "2026-10-05", "2026-10-05") === 10000,
    JSON.stringify({ revenue: iOct.summary.revenue }));
  // I3: V2 Correct/Void reject legacy identities with zero writes.
  var iCounts = u8CountsJSON_(fixture);
  var iRt = u6NovRuntime_({ fixture: fixture, repository: grand.runtime.repository });
  var iVoid = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u8-i-legacy", "SAL-U8-L1"), iRt);
  var iCorrect = salesRecognitionV2CorrectWithRuntime_(
    { requestKey: "u8-i-legacy-c", orderID: "SAL-U8-L1", reason: "legacy probe",
      orderType: "DINE_IN",
      lines: [{ productID: "P1", productVariantID: "PV1", qty: 1 }] }, iRt);
  check("I3", iVoid.status === "REFUSED" &&
    iVoid.code === "SALES_V2_LEGACY_IDENTITY_REJECTED" &&
    iCorrect.status === "REFUSED" &&
    iCorrect.code === "SALES_V2_LEGACY_IDENTITY_REJECTED" &&
    u8CountsJSON_(fixture) === iCounts,
    JSON.stringify({ v: iVoid, c: iCorrect }));
  // I4: legacy canonical void/correct handlers reject V2 identities.
  var legacyVoidOnV2 = u4RunWithFixture_(fixture, function() {
    return voidCanonicalTransaction({ transactionId: "ORDER:" + grand.orderA.orderID,
      reason: "u8 legacy rejection probe" });
  });
  var legacyCorrectOnV2 = u4RunWithFixture_(fixture, function() {
    return previewCanonicalTransactionCorrection({
      transactionId: "ORDER:" + grand.orderA.orderID,
      reason: "u8 legacy rejection probe", qty: 1, productId: "P1", type: "Hot" });
  });
  check("I4", legacyVoidOnV2.success === false &&
    legacyVoidOnV2.error.code === "TRANSACTION_NOT_FOUND" &&
    legacyCorrectOnV2.success === false &&
    legacyCorrectOnV2.error.code === "TRANSACTION_NOT_FOUND",
    JSON.stringify({ v: legacyVoidOnV2, c: legacyCorrectOnV2 }));
  // I5: no migration - tabsal rows are byte-identical to the build-time state.
  check("I5", JSON.stringify(fixture.getSheetByName("tabsal").values) ===
    grand.tabsalSnapshot, "tabsal mutated");

  // ---- J: mixed-cohort fixture parity U3/U4/U5 ----
  var projection = buildRecognizedSalesProjectionFromSpreadsheet_(fixture);
  // J1: signed Revenue - Oct 186,000 / Nov -39,000, no duplicate Revenue.
  var oct = u5Pnl_(fixture, "2026-10-01", "2026-10-31");
  var nov = u5Pnl_(fixture, "2026-11-01", "2026-11-30");
  check("J1", projection.totals.byPeriod["2026-10"] === 186000 &&
    projection.totals.byPeriod["2026-11"] === -39000 &&
    oct.summary.revenue === 186000 && nov.summary.revenue === -39000 &&
    u5EventsRevenue_(fixture, "2026-10-01", "2026-10-31") === 186000 &&
    u5EventsRevenue_(fixture, "2026-11-01", "2026-11-30") === -39000,
    JSON.stringify({ oct: oct.summary.revenue, nov: nov.summary.revenue,
      tp: projection.totals.byPeriod }));
  // J2: U3 active view - void chain dropped, replacement + V2 + legacy + paid.
  var activeNamespaces = projection.activeView.events.map(function(event) {
    return event.namespace; });
  check("J2", projection.activeView.events.length === 4 &&
    projection.activeView.totals.recognizedRevenue === 147000 &&
    activeNamespaces.some(function(ns) {
      return ns.indexOf("ORDER:" + grand.correctRes.orderID + ":") === 0; }) &&
    activeNamespaces.some(function(ns) {
      return ns.indexOf("ORDER:" + grand.orderA.orderID + ":") === 0; }) &&
    !activeNamespaces.some(function(ns) {
      return ns.indexOf("ORDER:" + grand.orderB.orderID + ":") === 0; }) &&
    activeNamespaces.indexOf("LEGACY:SAL-U8-L1:R0") !== -1 &&
    projection.quality.recoveryIssues.length === 0 &&
    projection.quality.issues.length === 3 &&
    projection.quality.issues.every(function(issue) {
      return ["LEGACY_INACTIVE_EXCLUDED", "INCOMPLETE_V2_RECOGNITION",
        "OLD_ORDER_UNPAID_EXCLUDED"].indexOf(issue.code) !== -1;
    }),
    JSON.stringify({ ns: activeNamespaces,
      avTotal: projection.activeView.totals.recognizedRevenue,
      issues: projection.quality.issues,
      orderA: grand.orderA.orderID, orderB: grand.orderB.orderID,
      rep: grand.correctRes.orderID }));
  // J3: U4 Sales identities + All/recent parity (one row per economics).
  var salesShapeIds = iSalesRows.map(function(row) {
    return row.id + "|" + row.revenue; }).sort();
  var jRecent = u4ActivePage_(fixture, { tab: "recent" });
  var jRecentShape = jRecent.rows.filter(function(row) {
    return row.transactionType === "Sales";
  }).map(function(row) { return row.id + "|" + row.revenue; }).sort();
  check("J3", JSON.stringify(salesShapeIds) === JSON.stringify(jRecentShape) &&
    JSON.stringify(salesShapeIds) === JSON.stringify([
      "ORDER:" + grand.orderA.orderID + "|60000",
      "ORDER:" + grand.correctRes.orderID + "|41000",
      "ORDER:ORD-U8-PAID|36000",
      "SAL-U8-L1|10000" ].sort()),
    JSON.stringify({ sales: salesShapeIds, recent: jRecentShape }));
  // J4: unresolved quality counts surfaced, no false completeness.
  check("J4", oct.salesRecognition.unresolvedCount >= 2 &&
    oct.salesRecognition.integrityConflictCount === 0 &&
    oct.salesRecognition.recoveryRequiredCount === 0 &&
    oct.salesRecognition.revenueAuthorityComplete === true &&
    projection.quality.excluded.some(function(entry) {
      return entry.cohort === "V2_PENDING"; }) &&
    oct.dataQuality.excludedInactiveTransactions >= 1,
    JSON.stringify({ sr: oct.salesRecognition,
      dq: oct.dataQuality.excludedInactiveTransactions }));
  // J5: WHY U4 active total differs from U5 period Revenue under reversals/
  // replacements: U4 active shows current-state rows only, U5 sums signed
  // economic history. Oct difference = the voided original (40,000) + the
  // superseded original (40,000) = 80,000.
  var octActiveTotal = u5ActiveSalesTotal_(fixture, "2026-10-01", "2026-10-31");
  check("J5", octActiveTotal === 106000 && oct.summary.revenue === 186000 &&
    oct.summary.revenue - octActiveTotal === 80000,
    JSON.stringify({ active: octActiveTotal, revenue: oct.summary.revenue,
      diff: oct.summary.revenue - octActiveTotal }));
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// K-P: Policy C semantics on the composed fixture, period boundaries, mode
// transitions (fixtures only; production stays PREPARED/disabled).
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U8PolicyModes() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U8_POLICY:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var t = TRANSACTION_PRODUCTION_CONTRACT;

  // ---- K: Policy C (dates > 2026-10-01) on the composed fixture ----
  var grand = u8GrandFixture_();
  var fixture = grand.fixture;
  var oct = u5Pnl_(fixture, "2026-10-01", "2026-10-31");
  var s = oct.summary;
  // K1: net = Revenue - material - opex - depreciation; HPP never COGS.
  check("K1", oct.accountingRegime === "PROSPECTIVE_PURCHASE_EXPENSE" &&
    s.revenue === 186000 && s.materialPurchasesExpensed === 120000 &&
    s.operatingExpenses === 7000 && s.depreciationExpense === 5000 &&
    s.cogs === null && s.grossProfit === null && oct.grossProfit === null &&
    oct.grossProfitAvailable === false &&
    s.operatingNetProfit === s.revenue - s.materialPurchasesExpensed -
      s.operatingExpenses - s.depreciationExpense &&
    s.operatingNetProfit === 54000,
    JSON.stringify({ revenue: s.revenue, material: s.materialPurchasesExpensed,
      opex: s.operatingExpenses, dep: s.depreciationExpense, cogs: s.cogs,
      net: s.operatingNetProfit }));
  // K2: 6210 material expense present exactly once; opex counted once.
  var ledger = readCanonicalTable(fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var tabopsRows = readCanonicalTable(fixture, "tabops",
    CANONICAL_ENTRY.EXPENSE_HEADERS).filter(function(row) { return row.ID_Trx; });
  check("K2", ledger.filter(function(row) {
      return String(row.AccountCode) === "6210"; }).length === 1 &&
    tabopsRows.length === 1 && s.operatingExpenses === 7000,
    JSON.stringify({ rows6210: ledger.filter(function(row) {
      return String(row.AccountCode) === "6210"; }).length,
      tabops: tabopsRows.length }));
  // K3: no Sales HPP posting - V2 journal rows touch only 1030/4000; the
  // analytical HPP snapshot stays on the Order header; historical 5000/1100
  // rows are exactly the pre-V2 paid chain (untouched, non-additive).
  var orders = readCanonicalTable(fixture, "Orders", t.ORDERS.HEADERS);
  var orderA = orders.filter(function(order) {
    return String(order.OrderID) === grand.orderA.orderID; })[0];
  var srv2Journals = ledger.filter(function(row) {
    return String(row.JournalID).indexOf("SRV2J") === 0; });
  check("K3", orderA && Number(orderA.HppTotalSnapshot) === 6 &&
    srv2Journals.length === 12 && srv2Journals.every(function(row) {
      return ["1030", "4000"].indexOf(String(row.AccountCode)) !== -1; }) &&
    ledger.filter(function(row) {
      return ["5000", "1100"].indexOf(String(row.AccountCode)) !== -1; }).length === 2,
    JSON.stringify({ hpp: orderA && orderA.HppTotalSnapshot,
      srv2: srv2Journals.length,
      accounts: srv2Journals.map(function(row) { return row.AccountCode; }) }));
  // K4: analytical HPP reconstruction stays available without accounting COGS.
  var detailA = u4RunWithFixture_(fixture, function() {
    return getCanonicalTransactionDetail("ORDER:" + grand.orderA.orderID);
  });
  check("K4", detailA.success === true &&
    typeof detailA.data.hppAnalytical === "number" &&
    oct.summary.cogs === null && oct.grossProfitAvailable === false,
    JSON.stringify({ hppAnalytical: detailA.data.hppAnalytical }));
  // K5: historical behavior intact pre-transition (09-30 vs 10-01 boundary).
  var boundary = u5BoundaryFixture_();
  var sep30 = u5Pnl_(boundary, "2026-09-30", "2026-09-30");
  var oct01 = u5Pnl_(boundary, "2026-10-01", "2026-10-01");
  var cross = u5Pnl_(boundary, "2026-09-30", "2026-10-01");
  check("K5", sep30.accountingRegime === "LEGACY_PRE_TRANSITION" &&
    sep30.summary.revenue === 9000 && sep30.summary.cogs === 1000 &&
    sep30.grossProfitAvailable === true &&
    oct01.accountingRegime === "PROSPECTIVE_PURCHASE_EXPENSE" &&
    oct01.summary.revenue === 50000 && oct01.summary.cogs === null &&
    cross.summary.revenue === 59000 &&
    cross.regimeSections.legacy.summary.revenue === 9000 &&
    cross.regimeSections.prospective.summary.revenue === 50000,
    JSON.stringify({ sep: sep30.summary.revenue, oct: oct01.summary.revenue,
      cross: cross.summary.revenue }));

  // ---- P: period boundaries (dates, month, year, later reversal) ----
  // P1: 09-30/10-01 split has no off-by-one (cross = 9,000 + 50,000).
  check("P1", cross.summary.revenue === 59000, String(cross.summary.revenue));
  // P2: month boundary - Oct vs Nov on the composed fixture.
  var nov = u5Pnl_(fixture, "2026-11-01", "2026-11-30");
  check("P2", oct.summary.revenue === 186000 && nov.summary.revenue === -39000,
    JSON.stringify({ oct: oct.summary.revenue, nov: nov.summary.revenue }));
  // P3: year boundary - empty periods stay a true zero with complete authority.
  var dec = u5Pnl_(fixture, "2026-12-01", "2026-12-31");
  var jan = u5Pnl_(fixture, "2027-01-01", "2027-01-31");
  check("P3", dec.summary.revenue === 0 && jan.summary.revenue === 0 &&
    dec.salesRecognition.revenueAuthorityComplete === true &&
    jan.salesRecognition.revenueAuthorityComplete === true,
    JSON.stringify({ dec: dec.summary.revenue, jan: jan.summary.revenue }));
  // P4: later reversal/correction never rewrites the original period.
  var octAgain = u5Pnl_(fixture, "2026-10-01", "2026-10-31");
  check("P4", octAgain.summary.revenue === oct.summary.revenue &&
    oct.summary.revenue === 186000, String(octAgain.summary.revenue));

  // ---- L: mode transitions (fixtures only) ----
  // L1: PREPARED - legacy compatible, no V2 write, no T/ActivationID.
  var preparedFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var legacyRepo = u7Repo_();
  var preparedRt = { fixture: preparedFixture, spreadsheet: preparedFixture,
    repository: legacyRepo, now: function() { return new Date("2026-10-15T02:03:04.000Z"); },
    actor: function() { return "u8@test"; } };
  var preparedRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u8-prepared-1"),
    preparedRt, u7Config_("PREPARED"));
  var preparedState = legacyRepo.state();
  check("L1", preparedRes && preparedRes.OrderID &&
    preparedState.operations.length === 1 &&
    preparedState.operations[0].OperationType === "ORDER_CREATE" &&
    preparedState.operations[0].State === "COMMITTED" &&
    preparedState.operations.every(function(op) {
      return SALES_V2_OPERATOR.V2_OPERATION_TYPES.indexOf(op.OperationType) === -1; }) &&
    salesRecognitionV2DefaultConfig().mode === "PREPARED" &&
    salesRecognitionV2DefaultConfig().activationID === "" &&
    salesRecognitionV2DefaultConfig().activatedAt === "" &&
    salesRecognitionV2RequestGate(salesRecognitionV2DefaultConfig()).allowed === false,
    JSON.stringify({ ops: preparedState.operations.map(function(op) {
      return [op.OperationType, op.State]; }) }));
  // L2: ACTIVE -> V2 only; legacy writer refused; V2 failure never falls back.
  var guardRuntime = {
    lock: { waitLock: function() { throw new Error("LOCK_MUST_NOT_RUN"); },
      releaseLock: function() {} },
    spreadsheet: function() { throw new Error("SPREADSHEET_MUST_NOT_RUN"); },
    environment: "LOCAL_FIXTURE" };
  u7WithConfig_(u7Config_("ACTIVE"), function() {
    var refused = submitCanonicalTransactionWithRuntime_(
      { transactionType: "SALES", productId: "P1", type: "Hot", qty: 1,
        cashAccountCode: "1000" }, guardRuntime);
    check("L2", refused.success === false && refused.status === "REFUSED" &&
      refused.writeCount === 0 &&
      refused.error.code === "SALES_V2_LEGACY_SALES_RETIRED",
      JSON.stringify(refused));
    check("L2b", salesV2OperatorResolvedRoute_().mode === "ACTIVE" &&
      salesV2OperatorRoute_(u7Config_("ACTIVE")).mode === "ACTIVE");
  });
  var failing = u7FixtureRuntime_({ runtime: { batch: function() {
    throw new Error("BATCH_DOWN"); } } });
  var failRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u8-fail-1"),
    failing.runtime, u7Config_("ACTIVE"));
  check("L2c", failRes.success === false && failRes.unknown === true &&
    failRes.requestKey === "u8-fail-1" &&
    failing.runtime.repository.rows().every(function(op) {
      return op.OperationType === SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE; }) &&
    readCanonicalTable(failing.fixture, "Orders", t.ORDERS.HEADERS).length === 0,
    JSON.stringify({ res: failRes, ops: failing.runtime.repository.rows().length }));
  // L3: PAUSED - fail closed, zero writes; persisted V2 intents recoverable.
  var paused = u7FixtureRuntime_({ runtime: { config: u7Config_("PAUSED") } });
  var pausedRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u8-paused-1"),
    paused.runtime, u7Config_("PAUSED"));
  check("L3", pausedRes.success === false &&
    pausedRes.error.code === "V2_MODE_PAUSED" &&
    paused.runtime.repository.rows().length === 0 &&
    readCanonicalTable(paused.fixture, "Orders", t.ORDERS.HEADERS).length === 0,
    JSON.stringify(pausedRes));
  var sticky = u7FixtureRuntime_({ runtime: { crash: "V2_AFTER_INTENT_PERSIST",
    config: u7Config_("ACTIVE") } });
  var stickyThrow = u8Throw_(function() {
    salesRecognitionV2SaveWithRuntime_(u7Payload_("u8-sticky-1"), sticky.runtime);
  });
  check("L3b", Boolean(stickyThrow) && sticky.runtime.repository.rows().length === 1 &&
    sticky.runtime.repository.rows()[0].State === "IN_PROGRESS",
    JSON.stringify(sticky.runtime.repository.rows()));
  sticky.runtime.config = u7Config_("PAUSED");
  var stickyResume = salesRecognitionV2SaveWithRuntime_(
    u7Payload_("u8-sticky-1"), sticky.runtime);
  check("L3c", stickyResume.status === "DONE" &&
    sticky.runtime.repository.rows()[0].State === "COMMITTED" &&
    sticky.runtime.repository.rows()[0].OperationType ===
      SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE,
    JSON.stringify(stickyResume));
  // L4: no date-only switch - a date-signal-only order is never V2.
  u7WithConfig_(u7Config_("ACTIVE"), function() {
    var dated = classifySalesRecognitionCohort(
      { OrderID: "ORD-U8-DATED", PaymentStatus: "UNPAID",
        FulfillmentStatus: "OPEN", CreatedAt: "2027-01-01T00:00:00Z" }, {});
    check("L4", dated.cohort === "PRE_V2_ORDER" && dated.status === "OK",
      JSON.stringify(dated));
  });
  // L5: resolved production config stays PREPARED with empty activation
  // metadata after the whole sequence (no T, no ActivationID).
  var resolved = salesRecognitionV2OperatorConfig();
  check("L5", resolved.mode === "PREPARED" && resolved.activationID === "" &&
    resolved.activatedAt === "" &&
    !/\d{4}-\d{2}-\d{2}T/.test(JSON.stringify(resolved)),
    JSON.stringify(resolved));
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// M-O: forbidden V2 payment/fulfillment/cash paths, integrity conflicts,
// master changes after commit.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U8GuardsIntegrity() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U8_GUARD:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    t = TRANSACTION_PRODUCTION_CONTRACT, mutation = SALES_RECOGNITION_V2_MUTATION,
    iss = SALES_RECOGNITION_PROJECTION.ISSUES;

  // ---- M: EVERY discovered server mutation path refuses pre-mutation ----
  var mRt = u7FixtureRuntime_(); // repo has findOrder + V2 operation evidence
  var mRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u8-guard-1"),
    mRt.runtime, u7Config_("ACTIVE"));
  check("M0", mRes.success === true && mRt.runtime.repository.rows().length === 1,
    JSON.stringify(mRes));
  var mOrderID = mRes.data && mRes.data.OrderID;
  var mRepo = mRt.runtime.repository;
  // The servicing cores resolve the order DTO first; seed the repo order row
  // (repository state mirrors the order header surface for servicing tests).
  mRepo.state().orders.push(u7OrderRow_(mOrderID));
  var mStateBefore = JSON.stringify(mRepo.state());
  var mFixture = mRt.fixture;
  var mProtectedBefore = u8SheetText_(mFixture,
    ["Payments", "Settlements", "InventoryLedger", "tabsal", "tabops", "Logs"]);
  var payRuntime = { spreadsheet: mFixture,
    now: function() { return new Date("2026-10-15T02:03:04.000Z"); },
    actor: function() { return "u8@test"; }, financeExists: function() { return true; },
    settle: function() { throw new Error("SETTLE_MUST_NOT_RUN"); },
    flush: function() { throw new Error("FLUSH_MUST_NOT_RUN"); } };
  // M1/M2: Payment + Receive Via/settlement path.
  var mPay = u8Throw_(function() {
    createDurableOperationalPayment_(mOrderID,
      { requestKey: "u8-pay-1", receiveVia: "CASH", amount: 20000 },
      payRuntime, mRepo);
  });
  check("M1", Boolean(mPay) && mPay.code === "SALES_V2_PAYMENT_RETIRED",
    String(mPay && mPay.code));
  var mPay2 = u8Throw_(function() {
    payOperationalOrderWithRepository(mOrderID,
      { requestKey: "u8-pay-2", receiveVia: "CASH", amount: 20000 },
      payRuntime, mRepo);
  });
  check("M2", Boolean(mPay2) && mPay2.code === "SALES_V2_PAYMENT_RETIRED",
    String(mPay2 && mPay2.code));
  // M3: fulfillment ready/completed/closed transitions.
  ["PREPARING", "READY", "COMPLETED"].forEach(function(next) {
    var err = u8Throw_(function() {
      transitionOperationalFulfillmentWithRepository(mOrderID, next, payRuntime, mRepo);
    });
    check("M3-" + next, Boolean(err) &&
      err.code === "SALES_V2_FULFILLMENT_RETIRED", String(err && err.code));
  });
  // M4: cash posting candidate.
  var mSettlement = cashFoundationSettlement({ RelatedTransactionType: "Order",
    RelatedTransactionID: mOrderID, SourceID: "PAY-U8-CASH" });
  var mCash = buildCashPostingCandidate(mSettlement,
    { accounts: cashFoundationTestAccounts(), transactions: [], balanceLedgerRows: [],
      settlements: [],
      salesRecognitionOperations: [{ OperationType: save.OPERATION_TYPE,
        BusinessID: mOrderID, State: "COMMITTED" }] });
  check("M4", mCash.status === "REFUSED" &&
    mCash.reason === "SALES_V2_NO_CASH_POST" && mCash.writeCount === 0 &&
    mCash.readOnly === true, JSON.stringify(mCash));
  // M5: legacy lifecycle handlers reject the V2 identity end to end.
  var mLegacyVoid = u4RunWithFixture_(mFixture, function() {
    return voidCanonicalTransaction({ transactionId: "ORDER:" + mOrderID,
      reason: "u8 forbidden probe" });
  });
  var mLegacyCorrect = u4RunWithFixture_(mFixture, function() {
    return previewCanonicalTransactionCorrection({ transactionId: "ORDER:" + mOrderID,
      reason: "u8 forbidden probe", qty: 1, productId: "P1", type: "Hot" });
  });
  check("M5", mLegacyVoid.success === false &&
    mLegacyVoid.error.code === "TRANSACTION_NOT_FOUND" &&
    mLegacyCorrect.success === false &&
    mLegacyCorrect.error.code === "TRANSACTION_NOT_FOUND",
    JSON.stringify({ v: mLegacyVoid, c: mLegacyCorrect }));
  // M6: legacy Sales create refused under ACTIVE (no fallback).
  var mLegacyCreate = null;
  u7WithConfig_(u7Config_("ACTIVE"), function() {
    mLegacyCreate = submitCanonicalTransactionWithRuntime_(
      { transactionType: "SALES", productId: "P1", type: "Hot", qty: 1,
        cashAccountCode: "1000" },
      { lock: { waitLock: function() {}, releaseLock: function() {} },
        spreadsheet: function() { throw new Error("SPREADSHEET_MUST_NOT_RUN"); },
        environment: "LOCAL_FIXTURE" });
  });
  check("M6", mLegacyCreate && mLegacyCreate.success === false &&
    mLegacyCreate.writeCount === 0 &&
    mLegacyCreate.error.code === "SALES_V2_LEGACY_SALES_RETIRED",
    JSON.stringify(mLegacyCreate));
  // M7: production RPC wrappers route into the guarded cores (not UI-dependent).
  check("M7", submitOperationalPayment.toString()
      .indexOf("createDurableOperationalPayment_") !== -1 &&
    submitOperationalFulfillment.toString()
      .indexOf("transitionOperationalFulfillmentWithRepository") !== -1 &&
    createDurableOperationalPayment_.toString()
      .indexOf("salesV2OperatorPaymentGuard_") !== -1 &&
    payOperationalOrderWithRepository.toString()
      .indexOf("salesV2OperatorPaymentGuard_") !== -1 &&
    transitionOperationalFulfillmentWithRepository.toString()
      .indexOf("salesV2OperatorFulfillmentGuard_") !== -1,
    "RPC wrappers must route through guarded cores");
  // M8: protected surfaces + repository byte-identical after ALL attempts.
  check("M8", JSON.stringify(mRepo.state()) === mStateBefore &&
    u8SheetText_(mFixture, ["Payments", "Settlements", "InventoryLedger",
      "tabsal", "tabops", "Logs"]) === mProtectedBefore &&
    readCanonicalTable(mFixture, "SalesRecognitionEvents", contract.HEADERS).length === 1,
    JSON.stringify({ changed: JSON.stringify(mRepo.state()) !== mStateBefore }));

  // ---- N: integrity conflicts -> no false success, no auto-repair ----
  function tamperBase_(key) {
    var fixture = salesV2SaveFixture_(u5FinanceSheets_());
    u5FinishAccounts_(fixture);
    u3AppendSale_(fixture, { ID_Trx: "SAL-U8-OK", Tanggal: "2026-10-05T12:00:00Z",
      ID_Prod: "P1", Qty: 1, HPP: 3000, HJ: 10000 });
    var runtime = salesV2SaveRuntime_({ fixture: fixture });
    var result = salesRecognitionV2SaveWithRuntime_(
      { requestKey: key, orderType: "DINE_IN",
        lines: [{ productID: "P1", productVariantID: "PV1", qty: 2 }] }, runtime);
    if (result.status !== "DONE") {
      throw new Error("U8_TAMPER_BASE_FAILED:" + key + ":" + result.status);
    }
    u6MirrorOperations_(fixture, runtime.repository);
    return { fixture: fixture, runtime: runtime, orderID: result.orderID };
  }
  function legacyOk_(fixture, expected) {
    return u5Pnl_(fixture, "2026-10-01", "2026-10-31").summary.revenue === expected &&
      u4ActivePage_(fixture).rows.some(function(row) { return row.id === "SAL-U8-OK"; });
  }
  // N1: duplicate RecognitionID -> surfaced, never double-counted.
  var n1 = tamperBase_("u8-int-dup");
  var n1Events = n1.fixture.getSheetByName("SalesRecognitionEvents");
  n1Events.values.push(n1Events.values[1].slice());
  var n1p = buildRecognizedSalesProjectionFromSpreadsheet_(n1.fixture);
  check("N1", u3HasIssue_(n1p, iss.DUPLICATE_RECOGNITION_ID) &&
    n1p.totals.recognizedRevenue === 50000 && legacyOk_(n1.fixture, 50000),
    JSON.stringify({ issues: n1p.quality.issues,
      total: n1p.totals.recognizedRevenue }));
  // N2: missing event under a COMMITTED operation -> surfaced, replay fails
  // closed, no auto-repair, valid legacy records still usable.
  var n2 = tamperBase_("u8-int-missing");
  n2.fixture.getSheetByName("SalesRecognitionEvents").values.splice(1, 1);
  var n2Counts = u8CountsJSON_(n2.fixture);
  var n2p = buildRecognizedSalesProjectionFromSpreadsheet_(n2.fixture);
  var n2Replay = salesRecognitionV2SaveWithRuntime_(
    { requestKey: "u8-int-missing", orderType: "DINE_IN",
      lines: [{ productID: "P1", productVariantID: "PV1", qty: 2 }] }, n2.runtime);
  check("N2", u3HasIssue_(n2p, iss.COMMITTED_OPERATION_RECOGNITION_MISSING) &&
    n2Replay.status === "RECOVERY_REQUIRED" &&
    u8CountsJSON_(n2.fixture) === n2Counts && legacyOk_(n2.fixture, 10000),
    JSON.stringify({ issues: n2p.quality.issues, replay: n2Replay }));
  // N3: wrong journal account -> INTEGRITY_CONFLICT, Finance never claims it.
  var n3 = tamperBase_("u8-int-account");
  n3.fixture.getSheetByName("BalanceLedger").values[2][5] = 7;
  var n3p = buildRecognizedSalesProjectionFromSpreadsheet_(n3.fixture);
  var n3Oct = u5Pnl_(n3.fixture, "2026-10-01", "2026-10-31");
  check("N3", u3HasIssue_(n3p, iss.RECOGNITION_JOURNAL_MISMATCH) &&
    n3p.events.filter(function(event) { return event.cohort === "V2_COMMITTED"; })
      .length === 0 &&
    n3Oct.summary.revenue === 10000 &&
    n3Oct.salesRecognition.integrityConflictCount >= 1 &&
    legacyOk_(n3.fixture, 10000),
    JSON.stringify({ issues: n3p.quality.issues, revenue: n3Oct.summary.revenue,
      sr: n3Oct.salesRecognition }));
  // N4: wrong amount -> event rejected, no false Revenue.
  var n4 = tamperBase_("u8-int-amount");
  n4.fixture.getSheetByName("SalesRecognitionEvents").values[1][8] = 99999;
  var n4p = buildRecognizedSalesProjectionFromSpreadsheet_(n4.fixture);
  var n4Oct = u5Pnl_(n4.fixture, "2026-10-01", "2026-10-31");
  check("N4", u3HasIssue_(n4p, iss.RECOGNITION_AMOUNT_MISMATCH) &&
    n4p.events.filter(function(event) { return event.cohort === "V2_COMMITTED"; })
      .length === 0 &&
    n4Oct.summary.revenue === 10000 &&
    n4Oct.salesRecognition.integrityConflictCount >= 1,
    JSON.stringify({ issues: n4p.quality.issues, revenue: n4Oct.summary.revenue }));
  // N5: wrong owner (orphan recognition) -> surfaced, never routed.
  var n5 = salesV2SaveFixture_(u5FinanceSheets_());
  u3AppendEvent_(n5, { RecognitionID: "SCR-U8-GHOST",
    ContractVersion: contract.CONTRACT_VERSION, ActivationID: "ACT-U2",
    OrderID: "ORD-U8-GHOST", RevisionID: "REV-U8-GHOST", EventType: "RECOGNITION",
    RecognizedAt: "2026-10-10T00:00:00.000Z", EconomicDate: "2026-10-10",
    Amount: 1000, RecognitionJournalID: "", JournalSignature: "",
    PostingStatus: "COMMITTED", OperationID: "", AuditID: "", OriginalID: "",
    ReversalOfRecognitionID: "", ReplacementID: "", Reason: "", Actor: "u8",
    SnapshotJSON: "{}" });
  var n5p = buildRecognizedSalesProjectionFromSpreadsheet_(n5);
  check("N5", u3HasIssue_(n5p, iss.RECOGNITION_OWNER_MISSING) &&
    n5p.events.length === 0 && n5p.quality.issues.length === 1,
    JSON.stringify(n5p.quality.issues));
  // N6: tampered Save audit -> replay fails closed, zero writes.
  var n6 = tamperBase_("u8-int-audit");
  n6.fixture.getSheetByName("SalesRecognitionAudits").values[1][7] =
    "evil@intruder.test";
  var n6Counts = u8CountsJSON_(n6.fixture);
  var n6Replay = salesRecognitionV2SaveWithRuntime_(
    { requestKey: "u8-int-audit", orderType: "DINE_IN",
      lines: [{ productID: "P1", productVariantID: "PV1", qty: 2 }] }, n6.runtime);
  check("N6", n6Replay.status !== "DONE" &&
    u8CountsJSON_(n6.fixture) === n6Counts &&
    n6Replay.requestKey === "u8-int-audit",
    JSON.stringify(n6Replay));
  // N7: duplicate reversal -> both excluded, original revenue preserved.
  var n7 = tamperBase_("u8-int-dup-rev");
  var n7Target = readCanonicalTable(n7.fixture, "SalesRecognitionEvents",
    contract.HEADERS)[0];
  u3ReversalAppend_(n7.fixture, n7Target, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z" });
  var n7RevRow = readCanonicalTable(n7.fixture, "SalesRecognitionEvents",
    contract.HEADERS).filter(function(row) { return row.EventType === "REVERSAL"; })[0];
  u3AppendEvent_(n7.fixture, Object.assign({}, n7RevRow));
  var n7p = buildRecognizedSalesProjectionFromSpreadsheet_(n7.fixture);
  check("N7", u3HasIssue_(n7p, iss.MULTIPLE_TERMINAL_REVERSALS) &&
    u3HasIssue_(n7p, iss.DUPLICATE_RECOGNITION_ID) &&
    n7p.events.filter(function(event) {
      return event.eventType === "RECOGNITION" &&
        event.cohort === "V2_COMMITTED"; }).length === 1 &&
    n7p.totals.recognizedRevenue === 50000,
    JSON.stringify({ issues: n7p.quality.issues,
      total: n7p.totals.recognizedRevenue }));
  // N8: invalid reversal lineage -> excluded, revenue unchanged.
  var n8 = tamperBase_("u8-int-lineage");
  var n8Target = readCanonicalTable(n8.fixture, "SalesRecognitionEvents",
    contract.HEADERS)[0];
  u3ReversalAppend_(n8.fixture, n8Target, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z", targetRecognitionID: "" });
  var n8p = buildRecognizedSalesProjectionFromSpreadsheet_(n8.fixture);
  check("N8", u3HasIssue_(n8p, iss.INVALID_REVERSAL_LINEAGE) &&
    n8p.totals.recognizedRevenue === 50000 &&
    n8p.activeView.events.length === 2,
    JSON.stringify({ issues: n8p.quality.issues }));
  // N9: corrupted OperationPlan -> replay fails closed, identity retained.
  var n9 = tamperBase_("u8-int-plan");
  var n9Row = n9.runtime.repository.rows()[0];
  var n9Plan = JSON.parse(n9Row.OperationPlan);
  n9Plan.actor = "evil@intruder.test";
  n9Row.OperationPlan = JSON.stringify(n9Plan);
  var n9Counts = u8CountsJSON_(n9.fixture);
  var n9Replay = salesRecognitionV2SaveWithRuntime_(
    { requestKey: "u8-int-plan", orderType: "DINE_IN",
      lines: [{ productID: "P1", productVariantID: "PV1", qty: 2 }] }, n9.runtime);
  check("N9", n9Replay.status === "RECOVERY_REQUIRED" &&
    n9Replay.requestKey === "u8-int-plan" && n9Replay.operationID !== "" &&
    u8CountsJSON_(n9.fixture) === n9Counts,
    JSON.stringify(n9Replay));
  // N10: partial set (event present, journal missing) -> fail closed, no repair.
  var n10 = tamperBase_("u8-int-partial");
  var n10Ledger = n10.fixture.getSheetByName("BalanceLedger");
  n10Ledger.values.splice(n10Ledger.values.length - 2, 2);
  var n10Counts = u8CountsJSON_(n10.fixture);
  var n10Replay = salesRecognitionV2SaveWithRuntime_(
    { requestKey: "u8-int-partial", orderType: "DINE_IN",
      lines: [{ productID: "P1", productVariantID: "PV1", qty: 2 }] }, n10.runtime);
  check("N10", n10Replay.status === "RECOVERY_REQUIRED" &&
    u8CountsJSON_(n10.fixture) === n10Counts &&
    n10Replay.requestKey === "u8-int-partial",
    JSON.stringify(n10Replay));

  // ---- O: master changes after commit never rewrite persisted history ----
  var o = tamperBase_("u8-master");
  function oDetailSnapshot_() {
    return JSON.stringify(u4RunWithFixture_(o.fixture, function() {
      var detail = getCanonicalTransactionDetail("ORDER:" + o.orderID);
      var data = detail.success ? detail.data : null;
      return data && { status: data.status, revenue: data.revenue,
        recognitionId: data.recognitionId, revisionId: data.revisionId,
        hppAnalytical: data.hppAnalytical, lines: data.lines };
    }));
  }
  var oProjectionBefore = JSON.stringify(u6Projection_(o.fixture).totals) +
    JSON.stringify(u6Projection_(o.fixture).events);
  var oDetailBefore = oDetailSnapshot_();
  var oOctBefore = u5Pnl_(o.fixture, "2026-10-01", "2026-10-31").summary.revenue;
  // Change price, standard cost, and product/variant active flags AFTER the
  // commit.
  u6SetPrice_(o.fixture, 77000);
  o.fixture.getSheetByName("RecipeStandardCost").values[1][2] = 500;
  o.fixture.getSheetByName("Products").values[1][6] = false;
  o.fixture.getSheetByName("ProductVariants").values[1][5] = false;
  var oProjectionAfter = JSON.stringify(u6Projection_(o.fixture).totals) +
    JSON.stringify(u6Projection_(o.fixture).events);
  var oDetailAfter = oDetailSnapshot_();
  var oOctAfter = u5Pnl_(o.fixture, "2026-10-01", "2026-10-31").summary.revenue;
  check("O1", oProjectionBefore === oProjectionAfter &&
    oDetailBefore === oDetailAfter && oOctBefore === oOctAfter &&
    oOctAfter === 50000, JSON.stringify({ before: oOctBefore, after: oOctAfter,
      detailSame: oDetailBefore === oDetailAfter }));
  // Restore the master rows so the NEW Correction intent can freeze the
  // current (restored) authority exactly once.
  o.fixture.getSheetByName("Products").values[1][6] = true;
  o.fixture.getSheetByName("ProductVariants").values[1][5] = true;
  u6SetPrice_(o.fixture, 41000);
  // A NEW Correction intent freezes the CURRENT authority once; later master
  // changes never affect its deterministic retry.
  u6SetPrice_(o.fixture, 41000);
  var oPendingRt = u6NovRuntime_({ fixture: o.fixture,
    repository: o.runtime.repository, crash: "V2M_AFTER_INTENT_PERSIST" });
  var oCorrectPayload = u6CorrectPayload_("u8-master-correct", o.orderID,
    [{ productID: "P1", productVariantID: "PV1", qty: 1 }]);
  var oThrew = u8Throw_(function() {
    salesRecognitionV2CorrectWithRuntime_(oCorrectPayload, oPendingRt);
  });
  check("O2", Boolean(oThrew) &&
    u8OpRows_(oPendingRt.repository, mutation.CORRECT).length === 1,
    "correction intent did not persist");
  var oFrozenPlan = u8OpRows_(oPendingRt.repository,
    mutation.CORRECT)[0].OperationPlan;
  u6SetPrice_(o.fixture, 99000); // post-intent master change
  var oRetry = salesRecognitionV2CorrectWithRuntime_(oCorrectPayload,
    u6NovRuntime_({ fixture: o.fixture, repository: o.runtime.repository }));
  u6MirrorOperations_(o.fixture, o.runtime.repository);
  var oReplacementOrders = readCanonicalTable(o.fixture, "Orders", t.ORDERS.HEADERS)
    .filter(function(order) { return String(order.OrderID) === oRetry.orderID; });
  check("O3", oRetry.status === "DONE" && oRetry.writeCount > 0 &&
    u8OpRows_(oPendingRt.repository, mutation.CORRECT)[0].OperationPlan ===
      oFrozenPlan &&
    oReplacementOrders.length === 1 && Number(oReplacementOrders[0].OrderTotal) === 41000,
    JSON.stringify({ retry: oRetry, total: oReplacementOrders.map(function(order) {
      return order.OrderTotal; }) }));
  var oProjectionFinal = u6Projection_(o.fixture);
  check("O4", oProjectionFinal.quality.issues.length === 0 &&
    oProjectionFinal.activeView.totals.recognizedRevenue === 51000 &&
    oProjectionFinal.totals.byPeriod["2026-10"] === 50000 &&
    oProjectionFinal.totals.byPeriod["2026-11"] === 1000,
    JSON.stringify({ totals: oProjectionFinal.totals }));
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// Q-R: account preflight + schema preflight (zero-write, fail closed).
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U8Preflight() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U8_PREFLIGHT:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, t = TRANSACTION_PRODUCTION_CONTRACT,
    contract = SALES_RECOGNITION_V2_CONTRACT,
    codes = SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES;

  function accountRows_() {
    var core4000 = BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE["4000"];
    return [
      { AccountCode: "1000", AccountName: "Cash on Hand", AccountType: "Asset",
        StatementGroup: "Current Assets", CashFlowGroup: "Operating", IsActive: true,
        CreatedAt: "", UpdatedAt: "", NormalBalance: "DEBIT" },
      { AccountCode: "1030", AccountName: "Sales Settlement Clearing",
        AccountType: "Asset", StatementGroup: "Current Assets",
        CashFlowGroup: "Operating", IsActive: true, CreatedAt: "", UpdatedAt: "",
        NormalBalance: "DEBIT" },
      { AccountCode: "2010", AccountName: "Customer Refund and Credit Payable",
        AccountType: "Liability", StatementGroup: "Current Liabilities",
        CashFlowGroup: "Operating", IsActive: true, CreatedAt: "", UpdatedAt: "",
        NormalBalance: "CREDIT" },
      { AccountCode: "4000", AccountName: core4000[0], AccountType: core4000[1],
        StatementGroup: core4000[2], CashFlowGroup: core4000[3], IsActive: true,
        CreatedAt: "", UpdatedAt: "", NormalBalance: "CREDIT" } ];
  }
  // Q1: valid 1030 metadata (+4000/+2010 rows) -> PASS.
  var q1 = preflightSalesRecognitionAccounts(accountRows_());
  check("Q1", q1.status === "PASS" && q1.errors.length === 0, JSON.stringify(q1));
  // Q2: exact required 1030 metadata (name/type/group/normal balance/active).
  var q1030 = accountRows_().filter(function(row) {
    return row.AccountCode === "1030"; })[0];
  check("Q2", q1030.AccountName === "Sales Settlement Clearing" &&
    q1030.AccountType === "Asset" && q1030.StatementGroup === "Current Assets" &&
    q1030.NormalBalance === "DEBIT" && q1030.IsActive === true,
    JSON.stringify(q1030));
  function failCase_(mutate) {
    var rows = accountRows_();
    mutate(rows);
    return preflightSalesRecognitionAccounts(rows);
  }
  var qMissing = failCase_(function(rows) {
    rows.splice(rows.findIndex(function(row) {
      return row.AccountCode === "1030"; }), 1);
  });
  var qDuplicate = failCase_(function(rows) {
    rows.push(Object.assign({}, rows.filter(function(row) {
      return row.AccountCode === "1030"; })[0]));
  });
  var qWrong = failCase_(function(rows) {
    rows.filter(function(row) { return row.AccountCode === "1030"; })[0]
      .AccountName = "Wrong Name";
  });
  var qInactive = failCase_(function(rows) {
    rows.filter(function(row) { return row.AccountCode === "1030"; })[0].IsActive = false;
  });
  check("Q3", qMissing.status === "FAIL" &&
      qMissing.errors[0].code === codes.ACCOUNT_ABSENT &&
    qDuplicate.status === "FAIL" &&
      qDuplicate.errors[0].code === codes.ACCOUNT_DUPLICATE &&
    qWrong.status === "FAIL" &&
      qWrong.errors[0].code === codes.ACCOUNT_METADATA_MISMATCH &&
    qInactive.status === "FAIL" &&
      qInactive.errors[0].code === codes.ACCOUNT_INACTIVE,
    JSON.stringify({ m: qMissing, d: qDuplicate, w: qWrong, i: qInactive }));
  // Q4: Save fails closed on missing 1030 BEFORE any write; NO auto-create.
  var qFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var qAccounts = qFixture.getSheetByName("Accounts");
  var q1030Index = qAccounts.values.findIndex(function(row) {
    return String(row[0]) === "1030"; });
  qAccounts.values.splice(q1030Index, 1);
  var qAccountsText = JSON.stringify(qAccounts.values);
  var qRt = salesV2SaveRuntime_({ fixture: qFixture, repository: u7Repo_() });
  var qRes = salesRecognitionV2SaveWithRuntime_(u7Payload_("u8-preflight-1"), qRt);
  check("Q4", qRes.status === "REFUSED" &&
    qRes.code === codes.ACCOUNT_ABSENT &&
    qRt.repository.rows().length === 0 && qRt.events.batches.length === 0 &&
    JSON.stringify(qFixture.getSheetByName("Accounts").values) === qAccountsText,
    JSON.stringify({ res: qRes, accounts:
      qFixture.getSheetByName("Accounts").values.length }));
  // Q5: 2010 has NO accounting effect on Save - never written, never posted;
  // its row metadata is validated by the preflight (presence/active check).
  var qOkFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var qOkRt = salesV2SaveRuntime_({ fixture: qOkFixture, repository: u7Repo_() });
  var qOk = salesRecognitionV2SaveWithRuntime_(u7Payload_("u8-preflight-2"), qOkRt);
  var qLedger = readCanonicalTable(qOkFixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var qV2Text = salesRecognitionV2DurableSave.toString() +
    salesRecognitionV2SaveWithRuntime_.toString() +
    salesRecognitionV2SavePlan_.toString() +
    salesRecognitionV2MutationVoidPlan_.toString() +
    salesRecognitionV2MutationCorrectPlan_.toString();
  check("Q5", qOk.status === "DONE" &&
    qLedger.filter(function(row) { return String(row.AccountCode) === "2010"; })
      .length === 0 &&
    save.WRITE_SURFACES.indexOf("Accounts") === -1 &&
    qV2Text.indexOf('"2010"') === -1 && qV2Text.indexOf("'2010'") === -1,
    JSON.stringify({ status: qOk.status,
      ledger2010: qLedger.filter(function(row) {
        return String(row.AccountCode) === "2010"; }).length }));

  // ---- R: schema preflight ----
  function runSchema_(label, mutate) {
    var sheets = salesV2SaveBaseSheets_();
    mutate(sheets);
    var fixture = salesV2SaveFixture_(sheets);
    var before = JSON.stringify(fixture.getSheetByName("Orders").values);
    var runtime = salesV2SaveRuntime_({ fixture: fixture, repository: u7Repo_() });
    var result = salesRecognitionV2SaveWithRuntime_(u7Payload_("u8-schema-" + label),
      runtime);
    return { result: result, runtime: runtime, fixture: fixture, before: before };
  }
  // R1: correct schema passes.
  var rOk = runSchema_("ok", function() {});
  check("R1", rOk.result.status === "DONE" &&
    rOk.result.code === "" && rOk.runtime.events.batches.length === 1,
    JSON.stringify(rOk.result));
  // R2: missing sheet fails before mutation.
  var rMissing = runSchema_("missing", function(sheets) { delete sheets.Products; });
  // R3: missing column fails before mutation.
  var rColumn = runSchema_("column", function(sheets) {
    sheets.Orders[0][3] = "NotOrderType";
  });
  // R4: duplicate column fails before mutation.
  var rDuplicate = runSchema_("duplicate", function(sheets) {
    sheets.Orders[0][4] = sheets.Orders[0][3];
  });
  // R5: authoritative reorder fails before mutation.
  var rReorder = runSchema_("reorder", function(sheets) {
    var header = sheets.Orders[0];
    var last = header.pop();
    header.unshift(last);
  });
  // R6: incompatible legacy header shape fails before mutation.
  var rLegacy = runSchema_("legacy", function(sheets) {
    sheets.Orders = [["ID", "Tanggal", "ID_Prod", "Tipe", "Qty"]];
  });
  [rMissing, rColumn, rDuplicate, rReorder, rLegacy].forEach(function(run, index) {
    var label = ["missing", "column", "duplicate", "reorder", "legacy"][index];
    check("R-" + label, run.result.status === "REFUSED" &&
      run.result.code === save.CODES.SCHEMA_NOT_READY &&
      run.runtime.repository.rows().length === 0 &&
      run.runtime.events.batches.length === 0 &&
      JSON.stringify(run.fixture.getSheetByName("Orders").values) === run.before,
      JSON.stringify({ label: label, res: run.result }));
  });
  // R7: no auto-migration - refused fixtures gain no rows on any V2 surface.
  check("R7", readCanonicalTable(rMissing.fixture, "SalesRecognitionEvents",
      contract.HEADERS).length === 0 &&
    readCanonicalTable(rMissing.fixture, "TransactionOperations",
      t.OPERATIONS.HEADERS).length === 0 &&
    readCanonicalTable(rLegacy.fixture, "TransactionOperations",
      t.OPERATIONS.HEADERS).length === 0 &&
    rMissing.fixture.getSheetByName("BalanceLedger").getLastRow() === 1,
    "schema refusal must not migrate or write");
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// Release evidence: controller composition + the 26-item source audit.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U8ReleaseEvidence() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U8_EVIDENCE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    mutation = SALES_RECOGNITION_V2_MUTATION,
    proj = SALES_RECOGNITION_PROJECTION;

  // ---- Controller composition: the real client runs to Done in-process ----
  var controller = runSalesV2U7Controller();
  check(1, controller && controller.status === "CONTROLLER_PASS" &&
    controller.failed === 0 && controller.total > 0,
    JSON.stringify({ status: controller && controller.status,
      total: controller && controller.total, failed: controller && controller.failed }));

  // Concatenated production sources for the text-level audit below.
  var auditText = [
    salesRecognitionV2DurableSave.toString(),
    salesRecognitionV2SaveWithRuntime_.toString(),
    salesRecognitionV2SaveNewIntent_.toString(),
    salesRecognitionV2SaveResume_.toString(),
    salesRecognitionV2SaveApplyBatch_.toString(),
    salesRecognitionV2SaveBatchBody_.toString(),
    salesRecognitionV2SaveValueRanges_.toString(),
    salesRecognitionV2DurableMutation_.toString(),
    salesRecognitionV2MutationRun_.toString(),
    salesRecognitionV2MutationNewIntent_.toString(),
    salesRecognitionV2MutationResume_.toString(),
    salesRecognitionV2MutationValueRanges_.toString(),
    salesRecognitionV2MutationBatchBody_.toString(),
    salesRecognitionV2MutationVoidPlan_.toString(),
    salesRecognitionV2MutationCorrectPlan_.toString(),
    salesRecognitionV2NormalizeSave_.toString(),
    salesV2OperatorRoute_.toString(),
    salesV2OperatorCreateWithRuntime_.toString(),
    salesV2OperatorModeCreateOrder_.toString(),
    salesV2OperatorLegacySalesGuard_.toString(),
    salesV2OperatorSaveResponse_.toString(),
    salesV2OperatorConfigState_.toString(),
    salesV2OperatorPaymentGuard_.toString(),
    salesV2OperatorFulfillmentGuard_.toString(),
    salesV2OperatorCashPostBlocked_.toString(),
    salesV2OperatorRecoverWithRuntime_.toString(),
    submitOperationalOrder.toString(),
    createDurableOperationalPayment_.toString(),
    transitionOperationalFulfillmentWithRepository.toString(),
    submitCanonicalTransactionWithRuntime_.toString(),
    recoverTransactionOperationWithRuntime_.toString(),
    voidCanonicalTransaction.toString(),
    correctCanonicalTransaction.toString(),
    buildFinanceSalesRecognitionScope_.toString(),
    buildTransactionSalesReadRows_.toString(),
    buildSalesRecognitionOrderDetail_.toString(),
    JSON.stringify(SALES_V2_OPERATOR),
    JSON.stringify(SALES_RECOGNITION_V2_CONTRACT.DEFAULT_CONFIG),
    JSON.stringify(save.JOURNAL_ACCOUNTS)
  ].join("\n");

  // 1. U1-U7 compose without contradiction: one operation vocabulary shared by
  // Save/Void/Correct, projection, and operator routing.
  check(2, save.OPERATION_TYPE === "SALES_RECOGNITION_V2_SAVE" &&
    mutation.VOID === "SALES_V2_VOID" && mutation.CORRECT === "SALES_V2_CORRECT" &&
    [save.OPERATION_TYPE, mutation.VOID, mutation.CORRECT].every(function(type, index, all) {
      return all.indexOf(type) === index; }) &&
    SALES_RECOGNITION_V2_RECOGNITION_OPERATION_TYPES.indexOf(save.OPERATION_TYPE) !== -1 &&
    SALES_RECOGNITION_V2_RECOGNITION_OPERATION_TYPES.indexOf(mutation.CORRECT) !== -1 &&
    SALES_RECOGNITION_V2_MUTATION_OPERATION_TYPES.indexOf(mutation.VOID) !== -1 &&
    SALES_RECOGNITION_V2_MUTATION_OPERATION_TYPES.indexOf(mutation.CORRECT) !== -1,
    "operation vocabulary");
  // 2. ONE canonical V2 Save path.
  check(3, salesRecognitionV2DurableSave.toString()
      .indexOf("salesRecognitionV2SaveWithRuntime_") !== -1 &&
    salesV2OperatorActiveCreate_.toString()
      .indexOf("salesRecognitionV2SaveWithRuntime_") !== -1 &&
    salesV2OperatorModeCreateOrder_.toString()
      .indexOf("salesRecognitionV2DurableSave") !== -1 &&
    submitOperationalOrder.toString()
      .indexOf("salesV2OperatorModeCreateOrder_") !== -1,
    "canonical save path");
  // 3/4. ONE projection authority; readers use the projection.
  check(4, buildFinanceSalesRecognitionScope_.toString()
      .indexOf("salesProjection.events") !== -1 &&
    buildTransactionSalesReadRows_.toString()
      .indexOf("buildRecognizedSalesProjectionFromSpreadsheet_") !== -1 &&
    getTransactionsPeriodRows.toString()
      .indexOf("buildTransactionSalesReadRows_") !== -1 &&
    getTransactionsPage.toString().indexOf("getTransactionsPeriodRows") !== -1 &&
    buildSalesRecognitionOrderDetail_.toString()
      .indexOf("projection") !== -1,
    "projection authority");
  // 5/14. Finance uses signed events, never activeView, never ledger credits.
  check(5, buildFinanceSalesRecognitionScope_.toString()
      .indexOf("event.signedAmount") !== -1 &&
    buildFinanceSalesRecognitionScope_.toString().indexOf("activeView") === -1 &&
    buildFinanceSalesRecognitionScope_.toString().indexOf("BalanceLedger") === -1 &&
    buildFinanceSalesRecognitionScope_.toString().indexOf("Payments") === -1,
    "signed events only");
  // 6/7. Correct/Void are append-only; originals immutable (no update/delete
  // request kinds anywhere in the V2 transport builders).
  check(6, salesRecognitionV2SaveBatchBody_.toString().indexOf("appendCells") !== -1 &&
    salesRecognitionV2MutationBatchBody_.toString().indexOf("appendCells") !== -1 &&
    auditText.indexOf("updateCells") === -1 &&
    auditText.indexOf("deleteRange") === -1 &&
    auditText.indexOf("pasteData") === -1,
    "append-only transport");
  // 8. V2 Payment forbidden at the durable core.
  check(7, createDurableOperationalPayment_.toString()
      .indexOf("salesV2OperatorPaymentGuard_") !== -1 &&
    SALES_V2_OPERATOR.PAYMENT_CODE === "SALES_V2_PAYMENT_RETIRED",
    "payment retirement");
  // 9. V2 fulfillment forbidden at the transition core.
  check(8, transitionOperationalFulfillmentWithRepository.toString()
      .indexOf("salesV2OperatorFulfillmentGuard_") !== -1 &&
    SALES_V2_OPERATOR.FULFILLMENT_CODE === "SALES_V2_FULFILLMENT_RETIRED",
    "fulfillment retirement");
  // 10. Historical cohorts preserved: classifier keeps TabSal + PRE_V2 paths.
  check(9, String(classifySalesRecognitionCohort).indexOf("PRE_V2_ORDER") !== -1 &&
    String(classifySalesRecognitionCohort).indexOf("TABSAL_LEGACY") !== -1 &&
    String(classifySalesRecognitionCohort).indexOf("DATE_ONLY_NO_PERSISTED_EVIDENCE") !== -1,
    "cohort preservation");
  // 11. ProductVariantID authority; no Tipe fallback in normalization.
  check(10, salesRecognitionV2NormalizeSave_.toString()
      .indexOf("productVariantID: String(line && line.productVariantID") !== -1 &&
    salesRecognitionV2NormalizeSave_.toString().indexOf("line.tipe") === -1,
    "variant authority");
  // 12. No Sales HPP accounting: only 1030/4000 in the frozen journal spec;
  // the V2 cores never reference the 5000/1100 legacy HPP accounts.
  var v2CoreText = [
    salesRecognitionV2SavePlan_.toString(),
    salesRecognitionV2SaveApplyBatch_.toString(),
    salesRecognitionV2MutationVoidPlan_.toString(),
    salesRecognitionV2MutationCorrectPlan_.toString(),
    salesRecognitionV2MutationReversalJournalRows_.toString() ].join("\n");
  check(11, JSON.stringify(save.JOURNAL_ACCOUNTS) ===
      JSON.stringify({ SETTLEMENT: "1030", REVENUE: "4000" }) &&
    v2CoreText.indexOf('"5000"') === -1 && v2CoreText.indexOf("'5000'") === -1 &&
    v2CoreText.indexOf('"1100"') === -1 && v2CoreText.indexOf("'1100'") === -1,
    "journal accounts");
  // 13. No Revenue double-count: the scope sums one event list once.
  check(12, buildFinanceSalesRecognitionScope_.toString()
      .indexOf("revenue += Number(event.signedAmount) || 0;") !== -1 &&
    buildFinanceSalesRecognitionScope_.toString()
      .split("revenue += Number(event.signedAmount) || 0;").length - 1 === 1,
    "single revenue pass");
  // 15. UNKNOWN retains identity.
  check(13, salesV2OperatorSaveResponse_.toString().indexOf("unknown: true") !== -1 &&
    salesV2OperatorSaveResponse_.toString().indexOf("requestKey: requestKey") !== -1,
    "unknown identity");
  // 16. Retry uses the persisted plan.
  check(14, salesRecognitionV2SaveResume_.toString()
      .indexOf("salesRecognitionV2SaveVerifyPlan_") !== -1 &&
    salesRecognitionV2SaveResume_.toString().indexOf("plan.normalizedPayload") !== -1 &&
    salesRecognitionV2MutationResume_.toString().indexOf("OperationPlan") !== -1,
    "plan-driven retry");
  // 17. No blind repair: artifacts resume ONLY when the inspection is NONE.
  check(15, salesRecognitionV2SaveResume_.toString()
      .indexOf('inspection.state === "NONE"') !== -1 &&
    salesRecognitionV2SaveResume_.toString()
      .indexOf("salesRecognitionV2SaveApplyBatch_(plan, operation, runtime)") !== -1 &&
    salesRecognitionV2MutationResume_.toString().indexOf("RECOVERY_REQUIRED") !== -1,
    "no blind repair");
  // 18. ACTIVE routes V2-only (never a legacy fallback branch).
  check(16, salesV2OperatorModeCreateOrder_.toString()
      .indexOf('route.mode !== "ACTIVE"') !== -1 &&
    salesV2OperatorCreateWithRuntime_.toString()
      .indexOf('route.mode === "ACTIVE"') !== -1 &&
    salesV2OperatorModeCreateOrder_.toString().indexOf("createDurableOperationalOrder_") === -1,
    "active routing");
  // 19. PAUSED fails closed with no legacy fallback.
  check(17, salesV2OperatorRoute_.toString().indexOf("V2_MODE_PAUSED") !== -1 &&
    salesV2OperatorLegacySalesGuard_.toString().indexOf("PREPARED") !== -1 &&
    salesRecognitionV2RequestGate(salesV2SavePausedConfigForAudit_()).allowed === false,
    "paused routing");
  // 20. Sticky V2 recovery: resume paths carry no mode gate.
  check(18, salesRecognitionV2SaveResume_.toString()
      .indexOf("salesRecognitionV2RequestGate") === -1 &&
    salesRecognitionV2MutationResume_.toString()
      .indexOf("salesRecognitionV2RequestGate") === -1,
    "sticky recovery");
  // 21. Defaults PREPARED/disabled.
  check(19, contract.DEFAULT_CONFIG.mode === "PREPARED" &&
    contract.DEFAULT_CONFIG.activationID === "" &&
    contract.DEFAULT_CONFIG.activatedAt === "" &&
    salesRecognitionV2RequestGate(salesRecognitionV2DefaultConfig()).allowed === false &&
    salesRecognitionV2RequestGate(salesRecognitionV2DefaultConfig()).code === "V2_NOT_ACTIVATED",
    "default config");
  // 22. No production T / ActivationID written by the config layer.
  check(20, salesV2OperatorConfigState_.toString().indexOf("setProperty") === -1 &&
    salesRecognitionV2OperatorConfig.toString().indexOf("setProperty") === -1 &&
    salesV2OperatorResolvedRoute_.toString().indexOf("setProperty") === -1 &&
    contract.DEFAULT_CONFIG.activationID === "" &&
    contract.DEFAULT_CONFIG.activatedAt === "",
    "no activation writes");
  // 23. No unclassified Sales writer: every entrypoint is routed or guarded.
  check(21, submitOperationalOrder.toString()
      .indexOf("salesV2OperatorResolvedRoute_") !== -1 &&
    salesV2OperatorCreateWithRuntime_.toString()
      .indexOf("createDurableOperationalOrder_") !== -1 &&
    submitCanonicalTransactionWithRuntime_.toString()
      .indexOf("salesV2OperatorLegacySalesGuard_") !== -1 &&
    recoverTransactionOperationWithRuntime_.toString()
      .indexOf("salesV2OperatorIsRecoveryOperation_") !== -1 &&
    buildCashPostingCandidate.toString()
      .indexOf("salesV2OperatorCashPostBlocked_") !== -1 &&
    voidCanonicalTransaction.toString().indexOf("salesRecognitionV2Durable") === -1 &&
    correctCanonicalTransaction.toString().indexOf("salesRecognitionV2Durable") === -1,
    "writer classification");
  // 24. No Treasury surface in the V2/operator layer.
  check(22, auditText.indexOf("Treasury") === -1,
    "no treasury");
  // 25. No production fixture / debug bypass wired into V2/operator sources.
  var hygieneText = [
    salesRecognitionV2DurableSave.toString(),
    salesRecognitionV2SaveWithRuntime_.toString(),
    salesRecognitionV2DurableMutation_.toString(),
    salesRecognitionV2MutationRun_.toString(),
    salesV2OperatorCreateWithRuntime_.toString(),
    salesV2OperatorModeCreateOrder_.toString(),
    salesV2OperatorSaveResponse_.toString(),
    salesV2OperatorConfigState_.toString(),
    salesRecognitionV2OperatorConfig.toString(),
    salesRecognitionV2NormalizeSave_.toString() ].join("\n");
  check(23, hygieneText.indexOf("numlock.test") === -1 &&
    hygieneText.indexOf("LOCAL_FIXTURE") === -1 &&
    hygieneText.indexOf("__TEST__") === -1 &&
    hygieneText.indexOf("DEBUG_MUTATION") === -1 &&
    hygieneText.indexOf("allowLegacyFallback") === -1,
    "no debug bypass");
  // 26. No production mutation from this task: the production entrypoints
  // refuse before any write under the persisted default config, and the local
  // suites only ever ran against fixture runtimes.
  check(24, salesRecognitionV2RequestGate(salesRecognitionV2DefaultConfig()).allowed === false &&
    salesRecognitionV2SaveNewIntent_.toString()
      .indexOf("salesRecognitionV2RequestGate(config)") !== -1 &&
    salesRecognitionV2MutationNewIntent_.toString()
      .indexOf("salesRecognitionV2RequestGate(config)") !== -1,
    "default refusal");
  // Composition extra: cohort evidence binding is persisted-only (no dates).
  check(27, salesV2OperatorOrderCohort_.toString().indexOf("CreatedAt") === -1 &&
    salesV2OperatorOrderCohort_.toString().indexOf("new Date") === -1 &&
    salesV2OperatorOrderCohort_.toString().indexOf("V2_OPERATION_TYPES") !== -1,
    "evidence-only cohort binding");
  // Composition invariants: transport + preflights are shared across cores.
  check(25, typeof salesRecognitionV2SaveSheetIdsRequest_ === "function" &&
    typeof salesRecognitionV2MutationSheetIdsRequest_ === "function" &&
    typeof preflightSalesRecognitionAccounts === "function" &&
    typeof salesRecognitionV2SaveSchemaGate_ === "function" &&
    preflightSalesRecognitionAccounts([]).status === "FAIL",
    "shared preflights");
  // Read-only guarantee: projection composer never writes.
  check(26, String(buildRecognizedSalesProjectionFromSpreadsheet_)
      .indexOf("readRecognizedSalesProjectionSources_") !== -1 &&
    String(readRecognizedSalesProjectionSources_).indexOf("setValues") === -1 &&
    String(readRecognizedSalesProjectionSources_).indexOf("appendRow") === -1,
    "projection read-only");

  if (typeof console !== "undefined" && console.log) {
    console.log("U8_EVIDENCE_SUMMARY " + JSON.stringify({
      controller: { status: controller.status, total: controller.total,
        passed: controller.passed },
      sourceAuditItems: 26, checks: pass }));
  }
  return { total: pass, pass: pass, fail: 0 };
}
