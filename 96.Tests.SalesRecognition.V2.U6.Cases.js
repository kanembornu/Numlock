// SALES_RECOGNITION_V2 U6 durable mutation tests: focused local suites over
// the injected runtime (fixture spreadsheet + in-memory operations repository
// + injected batch). No production access, no network, no clasp, no writes
// outside fixture memory. Covers SALES_V2_VOID / SALES_V2_CORRECT durability,
// idempotency, recovery, integrity, lifecycle, concurrency, Policy C, legacy
// cross-rejection, transport, cross-layer (U3/U4/U5), and the 29-item source
// audit.

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function u6VoidPayload_(key, orderID, reason) {
  return { requestKey: key, orderID: orderID, reason: reason || "u6 void reason" };
}

function u6CorrectPayload_(key, orderID, lines, reason) {
  return { requestKey: key, orderID: orderID, reason: reason || "u6 correct reason",
    orderType: "DINE_IN",
    lines: lines || [{ productID: "P1", productVariantID: "PV1", qty: 1 }] };
}

function u6NovRuntime_(options) {
  var runtime = salesV2SaveRuntime_(options);
  var baseNow = options && options.now;
  if (!baseNow) {
    runtime.now = function() { return new Date("2026-11-20T03:00:00.000Z"); };
  }
  return runtime;
}

// Mirror only operation rows the fixture sheet does not know yet, so the
// sheet-based projection reader observes exactly the persisted state.
function u6MirrorOperations_(fixture, repository) {
  var t = TRANSACTION_PRODUCTION_CONTRACT;
  var sheet = fixture.getSheetByName("TransactionOperations");
  var known = {};
  readCanonicalTable(fixture, "TransactionOperations", t.OPERATIONS.HEADERS)
    .forEach(function(row) { known[String(row.OperationID)] = true; });
  repository.rows().forEach(function(operation) {
    if (known[String(operation.OperationID)]) return;
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, t.OPERATIONS.HEADERS.length)
      .setValues([t.OPERATIONS.HEADERS.map(function(header) {
        return operation[header] === undefined ? "" : operation[header];
      })]);
    known[String(operation.OperationID)] = true;
  });
}

// Committed U2 fixture under a custom selling price (authoritative at save
// time) with a single-line or multiline payload. `extend` may add sheets
// before the fixture is built (e.g. Finance runtime sheets).
function u6PricedFixture_(key, price, lines, extend) {
  var sheets = u3BaseSheets_();
  sheets.ProductPricing = salesV2SaveTable_(PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS, [
    { ID_Prod: "P1", Tipe: "Hot", EffectiveFrom: "2026-01-01", EffectiveTo: "",
      HPP: 2, Harga: price, IsActive: true }]);
  if (typeof extend === "function") extend(sheets);
  var fixture = salesV2SaveFixture_(sheets);
  var runtime = salesV2SaveRuntime_({ fixture: fixture });
  var result = salesRecognitionV2SaveWithRuntime_(
    { requestKey: key, orderType: "DINE_IN", lines: lines }, runtime);
  if (result.status !== "DONE") {
    throw new Error("U6_FIXTURE_SAVE_FAILED:" + key + ":" + result.status + ":" + result.code);
  }
  u3MirrorOperations_(fixture, runtime.repository);
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  return { fixture: fixture, runtime: runtime, result: result,
    plan: JSON.parse(runtime.repository.rows()[0].OperationPlan),
    orderID: result.orderID, eventRow: events[0] };
}

function u6SetPrice_(fixture, harga) {
  var rows = fixture.getSheetByName("ProductPricing").values;
  var index = rows[0].map(String).indexOf("Harga");
  rows[1][index] = harga;
}

function u6ProtectedSheets_() {
  return ["Payments", "Settlements", "InventoryLedger", "tabsal", "tabops", "Logs"];
}

function u6RowCounts_(fixture) {
  var names = ["Orders", "OrderLines", "SalesRecognitionEvents", "BalanceLedger",
    "SalesRecognitionAudits", "TransactionOperations"].concat(u6ProtectedSheets_());
  var counts = {};
  names.forEach(function(name) {
    var sheet = fixture.getSheetByName(name);
    counts[name] = sheet ? sheet.getLastRow() : -1;
  });
  return counts;
}

function u6SheetText_(fixture, names) {
  return JSON.stringify(names.map(function(name) {
    var sheet = fixture.getSheetByName(name);
    return sheet ? sheet.values : null;
  }));
}

function u6OpRows_(repository, operationType) {
  return repository.rows().filter(function(row) {
    return row.OperationType === operationType;
  });
}

function u6Projection_(fixture) {
  return buildRecognizedSalesProjectionFromSpreadsheet_(fixture);
}

// ---------------------------------------------------------------------------
// VOID CORE: committed V2 void, exact amount, Dr4000/Cr1030, balanced,
// signatures, action-period date, lineage, original immutability, Policy C
// surfaces, idempotency, conflict, plan-controlled retry, PREPARED refusal.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6VoidCore() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_VOID_CORE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var contract = SALES_RECOGNITION_V2_CONTRACT, save = SALES_RECOGNITION_V2_SAVE,
    mutation = SALES_RECOGNITION_V2_MUTATION, t = TRANSACTION_PRODUCTION_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var fixture_ = u3SaveFixture_("u6-void-core");
  var fixture = fixture_.fixture, orderID = fixture_.orderID;
  var targetRecognition = fixture_.eventRow.RecognitionID;
  var originalEventEconomicDate = fixture_.eventRow.EconomicDate;
  var protectedBefore = u6SheetText_(fixture, u6ProtectedSheets_());
  var originalRows = JSON.stringify([
    fixture.getSheetByName("SalesRecognitionEvents").values.slice(0, 2),
    fixture.getSheetByName("BalanceLedger").values.slice(0, 3),
    fixture.getSheetByName("SalesRecognitionAudits").values.slice(0, 2),
    fixture.getSheetByName("Orders").values.slice(0, 2),
    fixture.getSheetByName("OrderLines").values.slice(0, 2)]);
  var ledgerBefore = fixture.getSheetByName("BalanceLedger").getLastRow();
  var rt = u6NovRuntime_({ fixture: fixture, repository: fixture_.runtime.repository });
  var res = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-void-1", orderID), rt);
  // V1: envelope + linkage
  check("V1", res.status === "DONE" && res.code === "" && res.replay === false &&
    res.writeCount === 4 && res.requestKey === "u6-void-1" && res.operationID !== "" &&
    res.targetOrderID === orderID && res.orderID === orderID &&
    res.recognitionID === targetRecognition && res.reversalRecognitionID !== "",
    JSON.stringify(res));
  // V2: exactly ONE batch over exactly the VOID surfaces
  check("V2", rt.events.batches.length === 1 && rt.events.appliedRows === 4 &&
    JSON.stringify(rt.events.batches[0].map(function(range) { return range.range; })) ===
      JSON.stringify(mutation.WRITE_SURFACES[mutation.VOID]),
    JSON.stringify(rt.events.batches[0] && rt.events.batches[0].map(function(r) { return r.range; })));
  // V3: durable operation COMMITTED with frozen plan linkage
  var voidOps = u6OpRows_(rt.repository, mutation.VOID);
  check("V3", voidOps.length === 1 && voidOps[0].State === "COMMITTED" &&
    voidOps[0].BusinessID === orderID &&
    voidOps[0].PayloadHash === transactionPayloadHash_(
      u6VoidPayload_("u6-void-1", orderID, "u6 void reason")) &&
    fixture_.runtime.repository.rows().filter(function(row) {
      return row.OperationType === save.OPERATION_TYPE; }).length === 1);
  var plan = JSON.parse(voidOps[0].OperationPlan);
  check("V3b", plan.targetOrderID === orderID && plan.target.recognitionID === targetRecognition &&
    plan.amount === fixture_.plan.orderTotal &&
    salesRecognitionV2MutationVerifyPlan_(plan).ok === true);
  // V4: exact reversal event, action-period EconomicDate, lineage
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents", contract.HEADERS);
  check("V4", events.length === 2 && events[1].EventType === "REVERSAL" &&
    events[1].RecognitionID === res.reversalRecognitionID &&
    Number(events[1].Amount) === Number(fixture_.plan.orderTotal) &&
    events[1].EconomicDate === "2026-11-20" &&
    events[1].OrderID === orderID && events[1].ContractVersion === contract.CONTRACT_VERSION &&
    events[1].PostingStatus === "COMMITTED" &&
    events[1].ReversalOfRecognitionID === targetRecognition &&
    events[1].OriginalID === "" && events[1].ReplacementID === "" &&
    events[1].Reason === "u6 void reason" &&
    events[1].OperationID === voidOps[0].OperationID &&
    events[1].AuditID === salesRecognitionV2MutationReversalId_("SRAV-", mutation.VOID,
      "u6-void-1", orderID) &&
    events[0].EventType === "RECOGNITION" &&
    events[0].EconomicDate === originalEventEconomicDate,
    JSON.stringify(events[1]));
  // V5: exactly two new ledger lines Dr4000/Cr1030, balanced, classified
  var ledger = readCanonicalTable(fixture, "BalanceLedger", ledgerHeaders);
  var reversalRows = ledger.slice(ledgerBefore - 1);
  var debit = 0, credit = 0;
  reversalRows.forEach(function(row) { debit += Number(row.Debit); credit += Number(row.Credit); });
  check("V5", ledger.length === 4 && reversalRows.length === 2 &&
    reversalRows[0].AccountCode === "4000" && Number(reversalRows[0].Debit) === 40000 &&
    Number(reversalRows[0].Credit) === 0 &&
    reversalRows[1].AccountCode === "1030" && Number(reversalRows[1].Debit) === 0 &&
    Number(reversalRows[1].Credit) === 40000 &&
    debit === 40000 && credit === 40000 &&
    reversalRows[0].MovementType === save.JOURNAL_MOVEMENT_TYPE &&
    reversalRows[0].SourceType === save.JOURNAL_SOURCE_TYPE &&
    reversalRows[0].SourceID === res.reversalRecognitionID &&
    reversalRows[0].Tanggal === "2026-11-20" &&
    reversalRows[0].JournalID === reversalRows[1].JournalID &&
    reversalRows[0].LineID === reversalRows[0].JournalID + "-1" &&
    reversalRows[1].LineID === reversalRows[0].JournalID + "-2" &&
    isCanonicalActive(reversalRows[0].IsActive) && isCanonicalActive(reversalRows[1].IsActive),
    JSON.stringify(reversalRows));
  check("V6", events[1].JournalSignature === policyCJournalSignature_(reversalRows) &&
    events[1].JournalSignature === plan.journalSignature &&
    events[1].RecognitionJournalID === reversalRows[0].JournalID,
    events[1].JournalSignature);
  // V7: Void audit row with exact linkages
  var audits = readCanonicalTable(fixture, "SalesRecognitionAudits", save.AUDIT_HEADERS);
  check("V7", audits.length === 2 && audits[1].OperationID === voidOps[0].OperationID &&
    audits[1].RequestKey === "u6-void-1" && audits[1].OrderID === orderID &&
    audits[1].RecognitionID === res.reversalRecognitionID &&
    audits[1].JournalID === reversalRows[0].JournalID &&
    audits[1].PayloadHash === voidOps[0].PayloadHash &&
    audits[1].ContractVersion === contract.CONTRACT_VERSION,
    JSON.stringify(audits[1]));
  // V8: ORIGINAL recognized artifacts are immutable
  var originalRowsAfter = JSON.stringify([
    fixture.getSheetByName("SalesRecognitionEvents").values.slice(0, 2),
    fixture.getSheetByName("BalanceLedger").values.slice(0, 3),
    fixture.getSheetByName("SalesRecognitionAudits").values.slice(0, 2),
    fixture.getSheetByName("Orders").values.slice(0, 2),
    fixture.getSheetByName("OrderLines").values.slice(0, 2)]);
  check("V8", originalRows === originalRowsAfter &&
    events[0].Amount === fixture_.eventRow.Amount &&
    events[0].EconomicDate === originalEventEconomicDate);
  // V9: no forbidden surface mutated; no Policy C forbidden account touched
  check("V9", u6SheetText_(fixture, u6ProtectedSheets_()) === protectedBefore);
  var newLedger = ledger.slice(2);
  var newAccounts = newLedger.map(function(row) { return String(row.AccountCode); });
  check("V10", newAccounts.every(function(code) {
      return code === "4000" || code === "1030"; }) &&
    !newLedger.some(function(row) {
      return ["1100", "5000", "2010", "1000", "6210", "6100"].indexOf(
        String(row.AccountCode)) !== -1; }) &&
    !newLedger.some(function(row) {
      return String(row.MovementType) === "SALE_HPP" ||
        String(row.MovementType) === "PAID_SALE"; }),
    JSON.stringify(newLedger));
  // V11: duplicate click — same key + same payload = one effect
  var counts = JSON.stringify(u6RowCounts_(fixture));
  var retry = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-void-1", orderID),
    u6NovRuntime_({ fixture: fixture, repository: rt.repository }));
  check("V11", retry.status === "DONE" && retry.replay === true && retry.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(fixture)) === counts &&
    rt.events.batches.length === 1,
    JSON.stringify(retry));
  // V12: changed payload, same key -> conflict, zero writes
  var conflict = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-void-1", orderID, "changed reason text"),
    u6NovRuntime_({ fixture: fixture, repository: rt.repository }));
  check("V12", conflict.status === "CONFLICT" &&
    conflict.code === "OPERATION_PAYLOAD_CONFLICT" && conflict.writeCount === 0 &&
    conflict.requestKey === "u6-void-1" &&
    JSON.stringify(u6RowCounts_(fixture)) === counts &&
    u6OpRows_(rt.repository, mutation.VOID).length === 1,
    JSON.stringify(conflict));
  // V13: retry after master change uses the persisted plan (no authority read)
  u6SetPrice_(fixture, 99999);
  var masterRetryRt = u6NovRuntime_({ fixture: fixture, repository: rt.repository });
  var masterRetry = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-void-1", orderID), masterRetryRt);
  check("V13", masterRetry.status === "DONE" && masterRetry.writeCount === 0 &&
    masterRetryRt.events.authorityReads === 0 && masterRetryRt.events.batches.length === 0,
    JSON.stringify(masterRetry));
  // V14: PREPARED default config refuses with zero writes
  var preparedRt = u6NovRuntime_({ fixture: fixture, repository: rt.repository,
    config: salesRecognitionV2DefaultConfig() });
  var preparedCounts = JSON.stringify(u6RowCounts_(fixture));
  var prepared = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-void-prepared", orderID), preparedRt);
  check("V14", prepared.status === "REFUSED" && prepared.code === "V2_NOT_ACTIVATED" &&
    preparedRt.repository.rows().length === 2 &&
    JSON.stringify(u6RowCounts_(fixture)) === preparedCounts &&
    preparedRt.events.batches.length === 0,
    JSON.stringify(prepared));
  // V15: envelope is Date-safe and never a { success: false } DTO
  check("V15", !("success" in res) && salesV2SaveNoDate_(res) && salesV2SaveNoDate_(conflict));
  // V16: outer lock wrapper only; cores never lock (no nested locks)
  var wrapperSource = salesRecognitionV2DurableMutation_.toString();
  var coreSource = salesRecognitionV2VoidWithRuntime_.toString() +
    salesRecognitionV2CorrectWithRuntime_.toString() +
    salesRecognitionV2MutationNewIntent_.toString() +
    salesRecognitionV2MutationResume_.toString() +
    salesRecognitionV2MutationApplyBatch_.toString();
  check("V16", wrapperSource.indexOf("waitLock") !== -1 &&
    wrapperSource.indexOf("releaseLock") !== -1 &&
    wrapperSource.indexOf("salesRecognitionV2VoidWithRuntime_") !== -1 &&
    coreSource.indexOf("waitLock") === -1 && coreSource.indexOf("releaseLock") === -1);
  // V17: exact (OperationType, RequestKey) lookup happens before any target or
  // master recalculation; VOID reads no master authority at all.
  var trace = [];
  var baseRepo = salesV2SaveOpsRepository_();
  var tracedRepo = {
    findOperation: function(type, key) { trace.push("lookup"); return baseRepo.findOperation(type, key); },
    createOperation: function(row) { trace.push("create"); return baseRepo.createOperation(row); },
    updateOperation: function(row) { trace.push("update"); return baseRepo.updateOperation(row); },
    rows: function() { return baseRepo.rows(); }
  };
  var tracedFixture = u3SaveFixture_("u6-void-trace");
  var tracedRt = u6NovRuntime_({ fixture: tracedFixture.fixture, repository: tracedRepo });
  var tracedRes = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-void-trace", tracedFixture.orderID), tracedRt);
  check("V17", tracedRes.status === "DONE" && trace[0] === "lookup" &&
    trace.indexOf("lookup") < trace.indexOf("create") &&
    tracedRt.events.authorityReads === 0,
    JSON.stringify({ trace: trace, res: tracedRes }));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// VOID RECOVERY: crash at every durability boundary, batch timeout (with and
// without applied artifacts), response-loss replay, partial/conflict states,
// corrupted plan, invalid state, commit readback failure, committed-without-
// artifacts. All fail closed or recover deterministically; never repair.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6VoidRecovery() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_VOID_RECOVERY:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var contract = SALES_RECOGNITION_V2_CONTRACT,
    mutation = SALES_RECOGNITION_V2_MUTATION, ledgerHeaders =
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var voidKey = "u6-rec-1";
  // Crash at every durability boundary, then resume with the same key.
  [{ point: "V2M_BEFORE_INTENT", ops: 0, state: "", artifacts: 0, write: 4, replay: false },
   { point: "V2M_AFTER_INTENT_PERSIST", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 4, replay: false },
   { point: "V2M_AFTER_INTENT", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 4, replay: false },
   { point: "V2M_AFTER_BATCH", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "V2M_AFTER_READBACK", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "V2M_BEFORE_COMMIT", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "V2M_AFTER_COMMIT", ops: 1, state: "COMMITTED", artifacts: 1, write: 0, replay: true }
  ].forEach(function(scenario, index) {
    var id = "BC" + (index + 1);
    var fixture_ = u3SaveFixture_("crash-" + scenario.point);
    var fixture = fixture_.fixture, orderID = fixture_.orderID;
    var runtime = u6NovRuntime_({ fixture: fixture,
      repository: fixture_.runtime.repository, crash: scenario.point });
    var threw = null;
    try {
      salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("crash-" + scenario.point, orderID),
        runtime);
    } catch (error) { threw = error; }
    check(id + "a", !!threw && threw.message === "CRASH:" + scenario.point, String(threw));
    var ops = u6OpRows_(runtime.repository, mutation.VOID);
    check(id + "b", ops.length === scenario.ops &&
      (scenario.ops === 0 || ops[0].State === scenario.state));
    check(id + "c",
      fixture.getSheetByName("SalesRecognitionEvents").getLastRow() ===
        (scenario.artifacts ? 3 : 2) &&
      fixture.getSheetByName("BalanceLedger").getLastRow() ===
        (scenario.artifacts ? 5 : 3) &&
      fixture.getSheetByName("SalesRecognitionAudits").getLastRow() ===
        (scenario.artifacts ? 3 : 2));
    var resume = salesRecognitionV2VoidWithRuntime_(
      u6VoidPayload_("crash-" + scenario.point, orderID),
      u6NovRuntime_({ fixture: fixture, repository: runtime.repository }));
    check(id + "d", resume.status === "DONE" && resume.writeCount === scenario.write &&
      resume.replay === scenario.replay && resume.requestKey === "crash-" + scenario.point,
      JSON.stringify(resume));
    check(id + "e", u6OpRows_(runtime.repository, mutation.VOID).length === 1 &&
      u6OpRows_(runtime.repository, mutation.VOID)[0].State === "COMMITTED" &&
      fixture.getSheetByName("SalesRecognitionEvents").getLastRow() === 3 &&
      fixture.getSheetByName("BalanceLedger").getLastRow() === 5 &&
      fixture.getSheetByName("SalesRecognitionAudits").getLastRow() === 3);
  });
  // B8: batch timeout with NO applied artifacts -> UNKNOWN, identity preserved,
  // no autonomous retry inside the call; a later invocation resumes.
  var f8 = u3SaveFixture_("u6-timeout-1");
  var rt8 = u6NovRuntime_({ fixture: f8.fixture, repository: f8.runtime.repository });
  var events8 = rt8.events;
  rt8.batch = function(ranges) { events8.batches.push(ranges); throw new Error("ETIMEDOUT"); };
  var res8 = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-timeout-1", f8.orderID), rt8);
  check("B8a", res8.status === "UNKNOWN" && res8.code === "BATCH_OUTCOME_UNKNOWN" &&
    res8.requestKey === "u6-timeout-1" && res8.operationID !== "" &&
    res8.writeCount === "UNKNOWN", JSON.stringify(res8));
  check("B8b", !("success" in res8) && salesV2SaveNoDate_(res8));
  check("B8c", u6OpRows_(rt8.repository, mutation.VOID)[0].State === "IN_PROGRESS" &&
    rt8.events.batches.length === 1 &&
    f8.fixture.getSheetByName("SalesRecognitionEvents").getLastRow() === 2);
  var later8 = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-timeout-1", f8.orderID),
    u6NovRuntime_({ fixture: f8.fixture, repository: rt8.repository }));
  check("B8d", later8.status === "DONE" && later8.writeCount === 4 &&
    u6OpRows_(rt8.repository, mutation.VOID)[0].State === "COMMITTED");
  // B9: timeout AFTER the batch applied -> exact artifacts prove the effect;
  // commit still completes inside the same call.
  var f9 = u3SaveFixture_("u6-timeout-2");
  var rt9 = u6NovRuntime_({ fixture: f9.fixture, repository: f9.runtime.repository });
  var inner9 = rt9.batch;
  rt9.batch = function(ranges) { inner9(ranges); throw new Error("ETIMEDOUT_AFTER_APPLY"); };
  var res9 = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-timeout-2", f9.orderID), rt9);
  check("B9a", res9.status === "DONE" && res9.writeCount === 4,
    JSON.stringify(res9));
  check("B9b", u6OpRows_(rt9.repository, mutation.VOID)[0].State === "COMMITTED" &&
    f9.fixture.getSheetByName("SalesRecognitionEvents").getLastRow() === 3);
  // B10: committed response lost -> replay verifies exact artifacts, DONE.
  var f10 = u3SaveFixture_("u6-lost-1");
  var rt10 = u6NovRuntime_({ fixture: f10.fixture, repository: f10.runtime.repository });
  var first10 = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-lost-1", f10.orderID), rt10);
  var counts10 = JSON.stringify(u6RowCounts_(f10.fixture));
  var replay10 = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-lost-1", f10.orderID),
    u6NovRuntime_({ fixture: f10.fixture, repository: rt10.repository }));
  check("B10a", first10.status === "DONE" && replay10.status === "DONE" &&
    replay10.replay === true && replay10.writeCount === 0 &&
    replay10.requestKey === "u6-lost-1" && replay10.orderID === first10.orderID);
  check("B10b", JSON.stringify(u6RowCounts_(f10.fixture)) === counts10);
  // B11: partial artifacts (reversal event only) -> fail closed, zero repair.
  var f11 = u3SaveFixture_("u6-partial-1");
  var rt11 = u6NovRuntime_({ fixture: f11.fixture, repository: f11.runtime.repository,
    crash: "V2M_AFTER_INTENT" });
  try {
    salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-partial-1", f11.orderID), rt11);
  } catch (error) {}
  var plan11 = JSON.parse(u6OpRows_(rt11.repository, mutation.VOID)[0].OperationPlan);
  f11.fixture.getSheetByName("SalesRecognitionEvents")
    .getRange(3, 1, 1, contract.HEADERS.length)
    .setValues([contract.HEADERS.map(function(header) {
      return plan11.reversalEventRow[header]; })]);
  var counts11 = JSON.stringify(u6RowCounts_(f11.fixture));
  var res11 = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-partial-1", f11.orderID),
    u6NovRuntime_({ fixture: f11.fixture, repository: rt11.repository }));
  check("B11a", res11.status === "RECOVERY_REQUIRED" &&
    res11.code === "ARTIFACTS_INCOMPLETE", JSON.stringify(res11));
  check("B11b", JSON.stringify(u6RowCounts_(f11.fixture)) === counts11 &&
    u6OpRows_(rt11.repository, mutation.VOID)[0].State === "IN_PROGRESS");
  // B12: extra foreign ledger line under the reversal JournalID -> fail closed.
  var f12 = u3SaveFixture_("u6-dupe-journal-1");
  var rt12 = u6NovRuntime_({ fixture: f12.fixture, repository: f12.runtime.repository });
  var res12a = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-dupe-journal-1", f12.orderID), rt12);
  var plan12 = JSON.parse(u6OpRows_(rt12.repository, mutation.VOID)[0].OperationPlan);
  var extraJournal = Object.assign({}, plan12.reversalJournalRows[0],
    { LineID: plan12.reversalJournalID + "-X" });
  f12.fixture.getSheetByName("BalanceLedger")
    .getRange(6, 1, 1, ledgerHeaders.length)
    .setValues([ledgerHeaders.map(function(header) { return extraJournal[header]; })]);
  var counts12 = JSON.stringify(u6RowCounts_(f12.fixture));
  var res12b = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-dupe-journal-1", f12.orderID),
    u6NovRuntime_({ fixture: f12.fixture, repository: rt12.repository }));
  check("B12a", res12a.status === "DONE" && res12b.status === "RECOVERY_REQUIRED" &&
    res12b.code === "IDENTITY_CONFLICT", JSON.stringify(res12b));
  check("B12b", JSON.stringify(u6RowCounts_(f12.fixture)) === counts12);
  // B13: tampered reversal event -> IDENTITY_CONFLICT, no repair.
  var f13 = u3SaveFixture_("u6-tamper-1");
  var rt13 = u6NovRuntime_({ fixture: f13.fixture, repository: f13.runtime.repository });
  var res13a = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-tamper-1", f13.orderID), rt13);
  f13.fixture.getSheetByName("SalesRecognitionEvents").values[2][8] = 999999;
  var counts13 = JSON.stringify(u6RowCounts_(f13.fixture));
  var res13b = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-tamper-1", f13.orderID),
    u6NovRuntime_({ fixture: f13.fixture, repository: rt13.repository }));
  check("B13a", res13a.status === "DONE" && res13b.status === "RECOVERY_REQUIRED" &&
    res13b.code === "IDENTITY_CONFLICT" &&
    res13b.detail.indexOf("EVENT_TAMPERED") !== -1, JSON.stringify(res13b));
  check("B13b", JSON.stringify(u6RowCounts_(f13.fixture)) === counts13);
  // B14: missing reversal audit -> ARTIFACTS_INCOMPLETE, no blind append.
  var f14 = u3SaveFixture_("u6-missing-audit-1");
  var rt14 = u6NovRuntime_({ fixture: f14.fixture, repository: f14.runtime.repository });
  var res14a = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-missing-audit-1", f14.orderID), rt14);
  f14.fixture.getSheetByName("SalesRecognitionAudits").values.pop();
  var res14b = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-missing-audit-1", f14.orderID),
    u6NovRuntime_({ fixture: f14.fixture, repository: rt14.repository }));
  check("B14a", res14a.status === "DONE" && res14b.status === "RECOVERY_REQUIRED" &&
    res14b.code === "ARTIFACTS_INCOMPLETE" &&
    res14b.detail.indexOf("AUDIT") !== -1, JSON.stringify(res14b));
  // B15: TAMPERED pending plan (digest broken) -> fail closed, zero writes.
  var f15 = u3SaveFixture_("u6-tampered-plan-1");
  var rt15 = u6NovRuntime_({ fixture: f15.fixture, repository: f15.runtime.repository,
    crash: "V2M_AFTER_INTENT" });
  try {
    salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-tampered-plan-1", f15.orderID), rt15);
  } catch (error) {}
  var stored15 = u6OpRows_(rt15.repository, mutation.VOID)[0];
  var tampered15 = JSON.parse(stored15.OperationPlan);
  tampered15.actor = "evil@intruder.test";
  stored15.OperationPlan = JSON.stringify(tampered15);
  var counts15 = JSON.stringify(u6RowCounts_(f15.fixture));
  var res15 = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-tampered-plan-1", f15.orderID),
    u6NovRuntime_({ fixture: f15.fixture, repository: rt15.repository }));
  check("B15a", res15.status === "RECOVERY_REQUIRED" && res15.code === "IDENTITY_CONFLICT" &&
    res15.detail.indexOf("PLAN_DIGEST_MISMATCH") !== -1 &&
    res15.operationID !== "", JSON.stringify(res15));
  check("B15b", JSON.stringify(u6RowCounts_(f15.fixture)) === counts15 &&
    u6OpRows_(rt15.repository, mutation.VOID)[0].State === "IN_PROGRESS");
  // B16: corrupt (unparseable) plan -> PLAN_MALFORMED, fail closed.
  var f16 = u3SaveFixture_("u6-corrupt-plan-1");
  var rt16 = u6NovRuntime_({ fixture: f16.fixture, repository: f16.runtime.repository,
    crash: "V2M_AFTER_INTENT" });
  try {
    salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-corrupt-plan-1", f16.orderID), rt16);
  } catch (error) {}
  u6OpRows_(rt16.repository, mutation.VOID)[0].OperationPlan = "{not json";
  var res16 = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-corrupt-plan-1", f16.orderID),
    u6NovRuntime_({ fixture: f16.fixture, repository: rt16.repository }));
  check("B16a", res16.status === "RECOVERY_REQUIRED" && res16.code === "PLAN_MALFORMED",
    JSON.stringify(res16));
  // B17: invalid persisted State is rejected, never committed.
  var f17 = u3SaveFixture_("u6-bad-state-1");
  var rt17 = u6NovRuntime_({ fixture: f17.fixture, repository: f17.runtime.repository,
    crash: "V2M_AFTER_INTENT" });
  try {
    salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-bad-state-1", f17.orderID), rt17);
  } catch (error) {}
  u6OpRows_(rt17.repository, mutation.VOID)[0].State = "BOGUS";
  var res17 = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-bad-state-1", f17.orderID),
    u6NovRuntime_({ fixture: f17.fixture, repository: rt17.repository }));
  check("B17a", res17.status === "RECOVERY_REQUIRED" &&
    res17.code === "INVALID_OPERATION_STATE" && res17.detail === "STATE:BOGUS",
    JSON.stringify(res17));
  // B18: commit update fails -> UNKNOWN with identities preserved; next retry
  // verifies + commits.
  var commitInner = salesV2SaveOpsRepository_();
  var f18 = u3SaveFixture_("u6-commit-flaky-1");
  // Rebuild: committed SAVE artifacts live in f18.fixture; mutation ops use a
  // flaky wrapper over a fresh repository seeded with the SAVE row.
  var saveOp18 = f18.runtime.repository.rows()[0];
  commitInner.createOperation(saveOp18);
  var commitState = { failUpdate: true };
  var flakyRepo = {
    findOperation: function(type, key) { return commitInner.findOperation(type, key); },
    createOperation: function(row) { return commitInner.createOperation(row); },
    updateOperation: function(row) {
      if (commitState.failUpdate) throw new Error("UPDATE_TRANSPORT_FAILED");
      return commitInner.updateOperation(row);
    },
    rows: function() { return commitInner.rows(); }
  };
  var rt18 = u6NovRuntime_({ fixture: f18.fixture, repository: flakyRepo });
  var res18a = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-commit-flaky-1", f18.orderID), rt18);
  check("B18a", res18a.status === "UNKNOWN" && res18a.code === "COMMIT_OUTCOME_UNKNOWN" &&
    res18a.requestKey === "u6-commit-flaky-1" && res18a.operationID !== "" &&
    commitInner.rows().filter(function(row) {
      return row.OperationType === mutation.VOID; })[0].State === "IN_PROGRESS" &&
    f18.fixture.getSheetByName("SalesRecognitionEvents").getLastRow() === 3,
    JSON.stringify(res18a));
  commitState.failUpdate = false;
  var res18b = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-commit-flaky-1", f18.orderID),
    u6NovRuntime_({ fixture: f18.fixture, repository: flakyRepo }));
  check("B18b", res18b.status === "DONE" && res18b.writeCount === 0 &&
    commitInner.rows().filter(function(row) {
      return row.OperationType === mutation.VOID; })[0].State === "COMMITTED",
    JSON.stringify(res18b));
  // B19: tampered ORIGINAL artifact after COMMITTED void -> fail closed.
  var f19 = u3SaveFixture_("u6-target-tamper-1");
  var rt19 = u6NovRuntime_({ fixture: f19.fixture, repository: f19.runtime.repository });
  var res19a = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-target-tamper-1", f19.orderID), rt19);
  f19.fixture.getSheetByName("SalesRecognitionEvents").values[1][18] = "tampered@actor";
  var res19b = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-target-tamper-1", f19.orderID),
    u6NovRuntime_({ fixture: f19.fixture, repository: rt19.repository }));
  check("B19a", res19a.status === "DONE" && res19b.status === "RECOVERY_REQUIRED" &&
    res19b.code === "IDENTITY_CONFLICT" &&
    res19b.detail.indexOf("TARGET_EVENT_TAMPERED") !== -1, JSON.stringify(res19b));
  // B20: COMMITTED with the entire artifact set removed -> fail closed.
  var f20 = u3SaveFixture_("u6-gone-1");
  var rt20 = u6NovRuntime_({ fixture: f20.fixture, repository: f20.runtime.repository });
  var res20a = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-gone-1", f20.orderID), rt20);
  f20.fixture.getSheetByName("SalesRecognitionEvents").values.splice(2);
  f20.fixture.getSheetByName("BalanceLedger").values.splice(3);
  f20.fixture.getSheetByName("SalesRecognitionAudits").values.splice(2);
  var counts20 = JSON.stringify(u6RowCounts_(f20.fixture));
  var res20b = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-gone-1", f20.orderID),
    u6NovRuntime_({ fixture: f20.fixture, repository: rt20.repository }));
  check("B20a", res20a.status === "DONE" && res20b.status === "RECOVERY_REQUIRED" &&
    res20b.code === "ARTIFACTS_INCOMPLETE", JSON.stringify(res20b));
  check("B20b", JSON.stringify(u6RowCounts_(f20.fixture)) === counts20 &&
    u6OpRows_(rt20.repository, mutation.VOID)[0].State === "COMMITTED");
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// VOID INTEGRITY: missing/duplicate/wrong-owner/wrong-amount/wrong-account/
// wrong-lineage/tampered artifacts and duplicate-reversal claims all fail
// closed with zero repair writes.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6VoidIntegrity() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_VOID_INTEGRITY:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var contract = SALES_RECOGNITION_V2_CONTRACT,
    mutation = SALES_RECOGNITION_V2_MUTATION, ledgerHeaders =
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  function freshVoid_(key) {
    var fixture_ = u3SaveFixture_(key);
    var runtime = u6NovRuntime_({ fixture: fixture_.fixture,
      repository: fixture_.runtime.repository });
    var result = salesRecognitionV2VoidWithRuntime_(
      u6VoidPayload_(key, fixture_.orderID), runtime);
    if (result.status !== "DONE") {
      throw new Error("U6_VOID_FIXTURE_FAILED:" + key + ":" + result.status + ":" + result.code);
    }
    var plan = JSON.parse(u6OpRows_(runtime.repository, mutation.VOID)[0].OperationPlan);
    return { fixture: fixture_.fixture, runtime: runtime, plan: plan, key: key,
      orderID: fixture_.orderID };
  }
  function resumeVoid_(fixture_, runtime, key) {
    return salesRecognitionV2VoidWithRuntime_(u6VoidPayload_(key, fixture_.orderID),
      u6NovRuntime_({ fixture: fixture_.fixture, repository: runtime.repository }));
  }
  function expectClosed_(label, fixture_, runtime, key, code, needle) {
    var counts = JSON.stringify(u6RowCounts_(fixture_.fixture));
    var result = resumeVoid_(fixture_, runtime, key);
    check(label, result.status === "RECOVERY_REQUIRED" && result.code === code &&
      (!needle || result.detail.indexOf(needle) !== -1) &&
      JSON.stringify(u6RowCounts_(fixture_.fixture)) === counts,
      JSON.stringify(result));
  }
  // I1: missing reversal event -> ARTIFACTS_INCOMPLETE
  var f1 = freshVoid_("u6-int-missing-event");
  f1.fixture.getSheetByName("SalesRecognitionEvents").values.pop();
  expectClosed_("I1", f1, f1.runtime, "u6-int-missing-event", "ARTIFACTS_INCOMPLETE", "EVENT");
  // I2: duplicate reversal event -> IDENTITY_CONFLICT
  var f2 = freshVoid_("u6-int-dupe-event");
  var events2 = f2.fixture.getSheetByName("SalesRecognitionEvents");
  events2.getRange(4, 1, 1, contract.HEADERS.length).setValues([events2.values[2].slice()]);
  expectClosed_("I2", f2, f2.runtime, "u6-int-dupe-event", "IDENTITY_CONFLICT", "EVENT_DUPLICATE");
  // I3: wrong amount on the reversal event -> IDENTITY_CONFLICT
  var f3 = freshVoid_("u6-int-wrong-amount");
  f3.fixture.getSheetByName("SalesRecognitionEvents").values[2][8] = 1;
  expectClosed_("I3", f3, f3.runtime, "u6-int-wrong-amount", "IDENTITY_CONFLICT", "EVENT_TAMPERED");
  // I4: wrong account on a reversal journal line -> IDENTITY_CONFLICT
  var f4 = freshVoid_("u6-int-wrong-account");
  var ledger4 = f4.fixture.getSheetByName("BalanceLedger");
  var accountIndex4 = ledger4.values[0].map(String).indexOf("AccountCode");
  ledger4.values[3][accountIndex4] = "1100";
  expectClosed_("I4", f4, f4.runtime, "u6-int-wrong-account", "IDENTITY_CONFLICT", "JOURNAL_TAMPERED");
  // I5: one reversal journal line missing -> ARTIFACTS_INCOMPLETE
  var f5 = freshVoid_("u6-int-missing-line");
  f5.fixture.getSheetByName("BalanceLedger").values.pop();
  expectClosed_("I5", f5, f5.runtime, "u6-int-missing-line", "ARTIFACTS_INCOMPLETE", "JOURNAL_LINE");
  // I6: extra journal line under the reversal JournalID -> IDENTITY_CONFLICT
  var f6 = freshVoid_("u6-int-extra-line");
  var ledger6 = f6.fixture.getSheetByName("BalanceLedger");
  ledger6.getRange(6, 1, 1, ledgerHeaders.length).setValues([
    ledgerHeaders.map(function(header) {
      return Object.assign({}, f6.plan.reversalJournalRows[1],
        { LineID: f6.plan.reversalJournalID + "-9" })[header]; })]);
  expectClosed_("I6", f6, f6.runtime, "u6-int-extra-line", "IDENTITY_CONFLICT");
  // I7: wrong lineage (ReversalOfRecognitionID retargeted) -> IDENTITY_CONFLICT
  var f7 = freshVoid_("u6-int-wrong-lineage");
  var lineageIndex7 = f7.fixture.getSheetByName("SalesRecognitionEvents").values[0]
    .map(String).indexOf("ReversalOfRecognitionID");
  f7.fixture.getSheetByName("SalesRecognitionEvents").values[2][lineageIndex7] = "SCR-NOPE";
  expectClosed_("I7", f7, f7.runtime, "u6-int-wrong-lineage", "IDENTITY_CONFLICT");
  // I8: wrong owner (reversal event bound to a foreign OrderID)
  var f8 = freshVoid_("u6-int-wrong-owner");
  f8.fixture.getSheetByName("SalesRecognitionEvents").values[2][3] = "ORD-FOREIGN-1";
  expectClosed_("I8", f8, f8.runtime, "u6-int-wrong-owner", "IDENTITY_CONFLICT", "CROSSOVER");
  // I9: tampered Void audit -> IDENTITY_CONFLICT
  var f9 = freshVoid_("u6-int-tampered-audit");
  f9.fixture.getSheetByName("SalesRecognitionAudits").values[2][2] = "TXOP-FOREIGN";
  expectClosed_("I9", f9, f9.runtime, "u6-int-tampered-audit", "IDENTITY_CONFLICT", "AUDIT");
  // I10: second reversal claiming the SAME target (foreign key artifact)
  var f10 = freshVoid_("u6-int-second-reversal");
  var foreignReversal = Object.assign({}, f10.plan.reversalEventRow,
    { RecognitionID: "SCRV-FOREIGN-1", JournalID: "SRV2JV-FOREIGN-1" });
  f10.fixture.getSheetByName("SalesRecognitionEvents")
    .getRange(4, 1, 1, contract.HEADERS.length)
    .setValues([contract.HEADERS.map(function(header) {
      return foreignReversal[header]; })]);
  expectClosed_("I10", f10, f10.runtime, "u6-int-second-reversal", "IDENTITY_CONFLICT",
    "REVERSAL_TARGET_CLAIMED");
  // I11: replacement OriginalID claimed by a foreign event is impossible for
  // Void (ReplacementID stays empty) — plan invariant proof.
  check("I11", f10.plan.replacement === null &&
    f10.plan.reversalEventRow.ReplacementID === "");
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// CORRECT CORE: multiline->replacement under the 36,000 -> 41,000 example,
// original immutable, full reversal + complete replacement in ONE batch, new
// identities, exact totals both directions, lineage, snapshot freeze, no
// delta-only artifact, no Cash/Payment/Inventory/HPP accounting artifacts.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6CorrectCore() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_CORRECT_CORE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var contract = SALES_RECOGNITION_V2_CONTRACT, save = SALES_RECOGNITION_V2_SAVE,
    mutation = SALES_RECOGNITION_V2_MUTATION, t = TRANSACTION_PRODUCTION_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  // Original: 36,000 (qty 2 @ 18,000) recognized 2026-10-15.
  var fixture_ = u6PricedFixture_("u6-correct-core", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }]);
  var fixture = fixture_.fixture, orderID = fixture_.orderID;
  var targetRecognition = fixture_.eventRow.RecognitionID;
  check("C0", fixture_.result.orderID === orderID && Number(fixture_.plan.orderTotal) === 36000,
    JSON.stringify(fixture_.plan.orderTotal));
  // Current authority at correction time: price 41,000 (legitimate new intent).
  u6SetPrice_(fixture, 41000);
  var protectedBefore = u6SheetText_(fixture, u6ProtectedSheets_());
  var originalRows = JSON.stringify([
    fixture.getSheetByName("SalesRecognitionEvents").values.slice(0, 2),
    fixture.getSheetByName("BalanceLedger").values.slice(0, 3),
    fixture.getSheetByName("SalesRecognitionAudits").values.slice(0, 2),
    fixture.getSheetByName("Orders").values.slice(0, 2),
    fixture.getSheetByName("OrderLines").values.slice(0, 2)]);
  var rt = u6NovRuntime_({ fixture: fixture, repository: fixture_.runtime.repository });
  var payload = u6CorrectPayload_("u6-correct-1", orderID,
    [{ productID: "P1", productVariantID: "PV1", qty: 1 }]);
  var res = salesRecognitionV2CorrectWithRuntime_(payload, rt);
  // C1: DONE + ONE atomic batch over exactly the CORRECT surfaces
  check("C1", res.status === "DONE" && res.code === "" && res.replay === false &&
    res.writeCount === 10 && res.targetOrderID === orderID &&
    res.replacementRecognitionID !== "", JSON.stringify(res));
  check("C2", rt.events.batches.length === 1 && rt.events.appliedRows === 10 &&
    JSON.stringify(rt.events.batches[0].map(function(range) { return range.range; })) ===
      JSON.stringify(mutation.WRITE_SURFACES[mutation.CORRECT]),
    JSON.stringify(rt.events.batches[0] && rt.events.batches[0].map(function(r) { return r.range; })));
  // C3: durable operation COMMITTED, BusinessID = replacement order
  var correctOps = u6OpRows_(rt.repository, mutation.CORRECT);
  check("C3", correctOps.length === 1 && correctOps[0].State === "COMMITTED" &&
    correctOps[0].BusinessID === res.orderID && res.orderID !== orderID);
  var plan = JSON.parse(correctOps[0].OperationPlan);
  check("C4", salesRecognitionV2MutationVerifyPlan_(plan).ok === true &&
    plan.targetOrderID === orderID && plan.target.recognitionID === targetRecognition &&
    plan.replacement.orderID === res.orderID &&
    plan.normalizedPayload.lines[0].qty === 1 &&
    plan.reason === "u6 correct reason");
  // C5: three events — +36,000 (Oct), -36,000 reversal, +41,000 replacement;
  // NEVER a +5,000 delta anywhere.
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents", contract.HEADERS);
  var replacement = events[2];
  check("C5", events.length === 3 &&
    events[0].EventType === "RECOGNITION" && Number(events[0].Amount) === 36000 &&
    events[0].EconomicDate === "2026-10-15" &&
    events[1].EventType === "REVERSAL" && Number(events[1].Amount) === 36000 &&
    events[1].EconomicDate === "2026-11-20" &&
    events[1].ReversalOfRecognitionID === targetRecognition &&
    events[1].ReplacementID === res.replacementRecognitionID &&
    replacement.EventType === "RECOGNITION" && Number(replacement.Amount) === 41000 &&
    replacement.EconomicDate === "2026-11-20" &&
    replacement.OrderID === res.orderID && replacement.OriginalID === targetRecognition &&
    replacement.OperationID === correctOps[0].OperationID,
    JSON.stringify(events));
  var ledger = readCanonicalTable(fixture, "BalanceLedger", ledgerHeaders);
  var amounts = [];
  events.forEach(function(row) { amounts.push(Number(row.Amount)); });
  ledger.forEach(function(row) {
    amounts.push(Number(row.Debit)); amounts.push(Number(row.Credit));
  });
  check("C6", amounts.every(function(value) { return value !== 5000; }) &&
    !events.some(function(row) { return Number(row.Amount) === 5000; }),
    JSON.stringify(amounts));
  // C7: new identities everywhere + deterministic derivations
  var repIds = salesRecognitionV2MutationReplacementIds_(mutation.CORRECT, "u6-correct-1");
  check("C7", res.orderID === repIds.orderID && plan.replacement.recognitionID === repIds.recognitionID &&
    plan.replacement.revisionID === repIds.revisionID &&
    plan.replacement.journalID === repIds.journalID &&
    plan.replacement.auditID === repIds.auditID &&
    plan.replacement.orderID !== orderID &&
    plan.reversalRecognitionID !== targetRecognition &&
    plan.replacement.recognitionID !== targetRecognition &&
    plan.replacement.lineRows[0].OrderLineID === "OL-" + repIds.orderID + "-1" &&
    plan.replacement.lineRows[0].OrderLineID !== fixture_.plan.lineRows[0].OrderLineID);
  // C8: four new ledger lines — reversal Dr4000/Cr1030 36,000, replacement
  // Dr1030/Cr4000 41,000 — balanced, signed, action-period dated, classified.
  var reversalRows = ledger.slice(2, 4), replacementRows = ledger.slice(4, 6);
  check("C8", ledger.length === 6 &&
    reversalRows[0].AccountCode === "4000" && Number(reversalRows[0].Debit) === 36000 &&
    reversalRows[1].AccountCode === "1030" && Number(reversalRows[1].Credit) === 36000 &&
    replacementRows[0].AccountCode === "1030" && Number(replacementRows[0].Debit) === 41000 &&
    replacementRows[1].AccountCode === "4000" && Number(replacementRows[1].Credit) === 41000 &&
    ledger.slice(2).every(function(row) {
      return row.Tanggal === "2026-11-20" &&
        row.MovementType === save.JOURNAL_MOVEMENT_TYPE &&
        row.SourceType === save.JOURNAL_SOURCE_TYPE; }) &&
    events[1].JournalSignature === policyCJournalSignature_(reversalRows) &&
    replacement.JournalSignature === policyCJournalSignature_(replacementRows),
    JSON.stringify(ledger.slice(2)));
  // C9: replacement order header + line under the NEW OrderID, exact totals
  var orders = readCanonicalTable(fixture, "Orders", t.ORDERS.HEADERS);
  var orderLines = readCanonicalTable(fixture, "OrderLines", t.ORDER_LINES.HEADERS);
  var repOrder = orders.filter(function(row) { return row.OrderID === res.orderID; });
  var repLines = orderLines.filter(function(row) { return row.OrderID === res.orderID; });
  check("C9", orders.length === 2 && repOrder.length === 1 &&
    Number(repOrder[0].OrderTotal) === 41000 && repOrder[0].OrderType === "DINE_IN" &&
    repLines.length === 1 && Number(repLines[0].SellingPriceSnapshot) === 41000 &&
    Number(repLines[0].LineTotal) === 41000 &&
    Number(repLines[0].UnitHppSnapshot) === 2 && Number(repLines[0].LineHpp) === 2 &&
    repLines[0].ProductVariantID === "PV1" && repLines[0].RecipeVersionID === "RV1",
    JSON.stringify(repLines));
  // C10: replacement audits — two audits under ONE correction operation
  var audits = readCanonicalTable(fixture, "SalesRecognitionAudits", save.AUDIT_HEADERS);
  check("C10", audits.length === 3 &&
    audits[1].OperationID === correctOps[0].OperationID &&
    audits[1].RecognitionID === res.reversalRecognitionID &&
    audits[1].OrderID === orderID &&
    audits[2].OperationID === correctOps[0].OperationID &&
    audits[2].RecognitionID === res.replacementRecognitionID &&
    audits[2].OrderID === res.orderID &&
    audits[1].RequestKey === "u6-correct-1" && audits[2].RequestKey === "u6-correct-1",
    JSON.stringify(audits));
  // C11: ORIGINAL artifacts immutable; protected surfaces untouched
  var originalRowsAfter = JSON.stringify([
    fixture.getSheetByName("SalesRecognitionEvents").values.slice(0, 2),
    fixture.getSheetByName("BalanceLedger").values.slice(0, 3),
    fixture.getSheetByName("SalesRecognitionAudits").values.slice(0, 2),
    fixture.getSheetByName("Orders").values.slice(0, 2),
    fixture.getSheetByName("OrderLines").values.slice(0, 2)]);
  check("C11", originalRows === originalRowsAfter &&
    u6SheetText_(fixture, u6ProtectedSheets_()) === protectedBefore);
  // C12: Policy C — analytical HPP only on the replacement snapshot; no HPP /
  // COGS / Cash / Payment / Inventory artifact in the new ledger rows.
  var newLedger = ledger.slice(2);
  check("C12", newLedger.every(function(row) {
      return ["4000", "1030"].indexOf(String(row.AccountCode)) !== -1; }) &&
    !newLedger.some(function(row) {
      return ["1100", "5000", "2010", "1000"].indexOf(String(row.AccountCode)) !== -1 ||
        String(row.MovementType) === "SALE_HPP"; }) &&
    JSON.parse(replacement.SnapshotJSON).hppTotalSnapshot === 2 &&
    Array.isArray(JSON.parse(replacement.SnapshotJSON).authority) &&
    JSON.parse(replacement.SnapshotJSON).authority.length === 1,
    JSON.stringify(newLedger));
  // C13: duplicate click — same key + same payload = one effect
  var counts = JSON.stringify(u6RowCounts_(fixture));
  var retry = salesRecognitionV2CorrectWithRuntime_(payload,
    u6NovRuntime_({ fixture: fixture, repository: rt.repository }));
  check("C13", retry.status === "DONE" && retry.replay === true && retry.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(fixture)) === counts &&
    u6OpRows_(rt.repository, mutation.CORRECT).length === 1,
    JSON.stringify(retry));
  // C14: changed payload, same key -> conflict, zero writes
  var conflict = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6-correct-1", orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 2 }]),
    u6NovRuntime_({ fixture: fixture, repository: rt.repository }));
  check("C14", conflict.status === "CONFLICT" &&
    conflict.code === "OPERATION_PAYLOAD_CONFLICT" && conflict.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(fixture)) === counts, JSON.stringify(conflict));
  // C15: SNAPSHOT FREEZE — intent persisted, masters mutated, retry uses the
  // persisted plan with ZERO authority reads and ONE batch total.
  var frozen = u6PricedFixture_("u6-correct-freeze", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }]);
  u6SetPrice_(frozen.fixture, 41000);
  var frozenRt = u6NovRuntime_({ fixture: frozen.fixture,
    repository: frozen.runtime.repository, crash: "V2M_AFTER_INTENT" });
  var freezePayload = u6CorrectPayload_("u6-correct-freeze", frozen.orderID,
    [{ productID: "P1", productVariantID: "PV1", qty: 1 }]);
  var threw = null;
  try { salesRecognitionV2CorrectWithRuntime_(freezePayload, frozenRt); }
  catch (error) { threw = error; }
  u6SetPrice_(frozen.fixture, 99999);
  frozen.fixture.getSheetByName("RecipeStandardCost").values[1][2] = 77;
  var resumeRt = u6NovRuntime_({ fixture: frozen.fixture,
    repository: frozen.runtime.repository });
  var resume = salesRecognitionV2CorrectWithRuntime_(freezePayload, resumeRt);
  check("C15", !!threw && resume.status === "DONE" && resume.writeCount === 10 &&
    resumeRt.events.authorityReads === 0 && resumeRt.events.batches.length === 1 &&
    frozenRt.events.batches.length === 0,
    JSON.stringify({ resume: resume, auth: resumeRt.events.authorityReads }));
  var frozenLines = readCanonicalTable(frozen.fixture, "OrderLines", t.ORDER_LINES.HEADERS);
  var frozenRepLine = frozenLines.filter(function(row) {
    return String(row.OrderID) === resume.orderID; })[0];
  check("C16", Boolean(frozenRepLine) &&
    Number(frozenRepLine.SellingPriceSnapshot) === 41000 &&
    Number(frozenRepLine.UnitHppSnapshot) === 2 &&
    JSON.parse(u6OpRows_(frozen.runtime.repository, mutation.CORRECT)[0].OperationPlan)
      .replacement.lineAuthority[0].price.Harga === 41000,
    JSON.stringify(frozenRepLine));
  // C17: envelope Date-safe, never a { success: false } DTO
  check("C17", !("success" in res) && salesV2SaveNoDate_(res) && salesV2SaveNoDate_(conflict));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// CORRECT RECOVERY: crash matrix, batch timeout (no applied artifacts),
// timeout after apply, committed-response-loss replay — same durability
// semantics as Void with the full reversal+replacement artifact set.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6CorrectRecovery() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_CORRECT_RECOVERY:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var contract = SALES_RECOGNITION_V2_CONTRACT,
    mutation = SALES_RECOGNITION_V2_MUTATION;
  function correctFixture_(key) {
    return u6PricedFixture_(key, 18000,
      [{ productID: "P1", productVariantID: "PV1", qty: 2 }]);
  }
  function correctPayloadFor_(fixture_, key) {
    return u6CorrectPayload_(key, fixture_.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 1 }]);
  }
  [{ point: "V2M_BEFORE_INTENT", ops: 0, state: "", artifacts: 0, write: 10, replay: false },
   { point: "V2M_AFTER_INTENT_PERSIST", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 10, replay: false },
   { point: "V2M_AFTER_INTENT", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 10, replay: false },
   { point: "V2M_AFTER_BATCH", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "V2M_AFTER_READBACK", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "V2M_BEFORE_COMMIT", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "V2M_AFTER_COMMIT", ops: 1, state: "COMMITTED", artifacts: 1, write: 0, replay: true }
  ].forEach(function(scenario, index) {
    var id = "BC" + (index + 1);
    var fixture_ = correctFixture_("ccrash-" + scenario.point);
    u6SetPrice_(fixture_.fixture, 41000);
    var payload = correctPayloadFor_(fixture_, "ccrash-" + scenario.point);
    var runtime = u6NovRuntime_({ fixture: fixture_.fixture,
      repository: fixture_.runtime.repository, crash: scenario.point });
    var threw = null;
    try { salesRecognitionV2CorrectWithRuntime_(payload, runtime); }
    catch (error) { threw = error; }
    check(id + "a", !!threw && threw.message === "CRASH:" + scenario.point, String(threw));
    var ops = u6OpRows_(runtime.repository, mutation.CORRECT);
    check(id + "b", ops.length === scenario.ops &&
      (scenario.ops === 0 || ops[0].State === scenario.state));
    check(id + "c",
      fixture_.fixture.getSheetByName("Orders").getLastRow() ===
        (scenario.artifacts ? 3 : 2) &&
      fixture_.fixture.getSheetByName("SalesRecognitionEvents").getLastRow() ===
        (scenario.artifacts ? 4 : 2) &&
      fixture_.fixture.getSheetByName("BalanceLedger").getLastRow() ===
        (scenario.artifacts ? 7 : 3) &&
      fixture_.fixture.getSheetByName("SalesRecognitionAudits").getLastRow() ===
        (scenario.artifacts ? 4 : 2));
    var resume = salesRecognitionV2CorrectWithRuntime_(payload,
      u6NovRuntime_({ fixture: fixture_.fixture, repository: runtime.repository }));
    check(id + "d", resume.status === "DONE" && resume.writeCount === scenario.write &&
      resume.replay === scenario.replay, JSON.stringify(resume));
    check(id + "e", u6OpRows_(runtime.repository, mutation.CORRECT).length === 1 &&
      u6OpRows_(runtime.repository, mutation.CORRECT)[0].State === "COMMITTED" &&
      fixture_.fixture.getSheetByName("SalesRecognitionEvents").getLastRow() === 4 &&
      fixture_.fixture.getSheetByName("Orders").getLastRow() === 3 &&
      fixture_.fixture.getSheetByName("BalanceLedger").getLastRow() === 7 &&
      fixture_.fixture.getSheetByName("SalesRecognitionAudits").getLastRow() === 4);
  });
  // T8: batch timeout with NO applied artifacts -> UNKNOWN, identity kept.
  var fT = correctFixture_("ccrash-timeout");
  u6SetPrice_(fT.fixture, 41000);
  var payloadT = correctPayloadFor_(fT, "ccrash-timeout");
  var rtT = u6NovRuntime_({ fixture: fT.fixture, repository: fT.runtime.repository });
  var eventsT = rtT.events;
  rtT.batch = function(ranges) { eventsT.batches.push(ranges); throw new Error("ETIMEDOUT"); };
  var resT = salesRecognitionV2CorrectWithRuntime_(payloadT, rtT);
  check("T8a", resT.status === "UNKNOWN" && resT.code === "BATCH_OUTCOME_UNKNOWN" &&
    resT.requestKey === "ccrash-timeout" && resT.writeCount === "UNKNOWN" &&
    salesV2SaveNoDate_(resT), JSON.stringify(resT));
  var laterT = salesRecognitionV2CorrectWithRuntime_(payloadT,
    u6NovRuntime_({ fixture: fT.fixture, repository: rtT.repository }));
  check("T8b", laterT.status === "DONE" && laterT.writeCount === 10 &&
    u6OpRows_(rtT.repository, mutation.CORRECT)[0].State === "COMMITTED",
    JSON.stringify(laterT));
  // T9: committed response lost -> replay verifies + returns DONE, zero writes.
  var fL = correctFixture_("ccrash-lost");
  u6SetPrice_(fL.fixture, 41000);
  var payloadL = correctPayloadFor_(fL, "ccrash-lost");
  var rtL = u6NovRuntime_({ fixture: fL.fixture, repository: fL.runtime.repository });
  var firstL = salesRecognitionV2CorrectWithRuntime_(payloadL, rtL);
  var countsL = JSON.stringify(u6RowCounts_(fL.fixture));
  var replayL = salesRecognitionV2CorrectWithRuntime_(payloadL,
    u6NovRuntime_({ fixture: fL.fixture, repository: rtL.repository }));
  check("T9a", firstL.status === "DONE" && replayL.status === "DONE" &&
    replayL.replay === true && replayL.writeCount === 0);
  check("T9b", JSON.stringify(u6RowCounts_(fL.fixture)) === countsL);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// LIFECYCLE + CONCURRENCY: terminal rules, single winner, targetability,
// reversal never a target, competing-key fail-closed.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6Lifecycle() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_LIFECYCLE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var mutation = SALES_RECOGNITION_V2_MUTATION;
  function correctFixture_(key) {
    var fixture_ = u6PricedFixture_(key, 18000,
      [{ productID: "P1", productVariantID: "PV1", qty: 2 }]);
    u6SetPrice_(fixture_.fixture, 41000);
    return fixture_;
  }
  function correct_(fixture_, key, targetOrderID) {
    var runtime = u6NovRuntime_({ fixture: fixture_.fixture,
      repository: fixture_.runtime.repository });
    var result = salesRecognitionV2CorrectWithRuntime_(
      u6CorrectPayload_(key, targetOrderID || fixture_.orderID,
        [{ productID: "P1", productVariantID: "PV1", qty: 1 }]), runtime);
    u6MirrorOperations_(fixture_.fixture, fixture_.runtime.repository);
    return { result: result, runtime: runtime };
  }
  function voidOn_(fixture_, key, targetOrderID) {
    var runtime = u6NovRuntime_({ fixture: fixture_.fixture,
      repository: fixture_.runtime.repository });
    return { result: salesRecognitionV2VoidWithRuntime_(
      u6VoidPayload_(key, targetOrderID || fixture_.orderID), runtime),
      runtime: runtime };
  }
  // L1: double Void — second key fails closed, zero writes, one reversal.
  var f1 = u3SaveFixture_("u6-life-double-void");
  var first1 = voidOn_(f1, "u6-life-void-1");
  check("L1a", first1.result.status === "DONE");
  u6MirrorOperations_(f1.fixture, f1.runtime.repository);
  var counts1 = JSON.stringify(u6RowCounts_(f1.fixture));
  var second1 = voidOn_(f1, "u6-life-void-2");
  check("L1b", second1.result.status === "REFUSED" &&
    second1.result.code === "SALES_V2_TARGET_ALREADY_VOIDED" &&
    second1.runtime.events.batches.length === 0 &&
    JSON.stringify(u6RowCounts_(f1.fixture)) === counts1 &&
    u6OpRows_(f1.runtime.repository, mutation.VOID).length === 1 &&
    readCanonicalTable(f1.fixture, "SalesRecognitionEvents",
      SALES_RECOGNITION_V2_CONTRACT.HEADERS).length === 2,
    JSON.stringify(second1.result));
  // L2: Void after Correct on the ORIGINAL fails closed (terminal reversal).
  var f2 = correctFixture_("u6-life-void-after-correct");
  var correct2 = correct_(f2, "u6-life-c-1");
  check("L2a", correct2.result.status === "DONE", JSON.stringify(correct2.result));
  var void2 = voidOn_(f2, "u6-life-v-2");
  check("L2b", void2.result.status === "REFUSED" &&
    void2.result.code === "SALES_V2_TARGET_ALREADY_VOIDED" &&
    void2.runtime.events.batches.length === 0, JSON.stringify(void2.result));
  // L3: Correct after Void on the ORIGINAL fails closed.
  var f3 = u3SaveFixture_("u6-life-correct-after-void");
  var void3 = voidOn_(f3, "u6-life-v-3");
  check("L3a", void3.result.status === "DONE");
  u6MirrorOperations_(f3.fixture, f3.runtime.repository);
  var correct3 = correct_(f3, "u6-life-c-3");
  check("L3b", correct3.result.status === "REFUSED" &&
    correct3.result.code === "SALES_V2_TARGET_ALREADY_VOIDED" &&
    correct3.runtime.events.batches.length === 0, JSON.stringify(correct3.result));
  // L4: double Correct on the superseded ORIGINAL fails closed.
  var f4 = correctFixture_("u6-life-double-correct");
  var c4a = correct_(f4, "u6-life-c-4a");
  check("L4a", c4a.result.status === "DONE");
  var c4b = correct_(f4, "u6-life-c-4b");
  check("L4b", c4b.result.status === "REFUSED" &&
    c4b.result.code === "SALES_V2_TARGET_ALREADY_VOIDED" &&
    c4b.runtime.events.batches.length === 0, JSON.stringify(c4b.result));
  // L5: the corrected REPLACEMENT is targetable again — Void succeeds.
  var f5 = correctFixture_("u6-life-void-replacement");
  var c5 = correct_(f5, "u6-life-c-5");
  var replacementOrderID = c5.result.orderID;
  var v5 = voidOn_(f5, "u6-life-v-5", replacementOrderID);
  check("L5", c5.result.status === "DONE" && v5.result.status === "DONE" &&
    v5.result.targetOrderID === replacementOrderID &&
    v5.runtime.events.batches.length === 1, JSON.stringify(v5.result));
  // L6: the corrected REPLACEMENT is targetable again — Correct succeeds.
  var f6 = correctFixture_("u6-life-correct-replacement");
  var c6a = correct_(f6, "u6-life-c-6a");
  var c6b = correct_(f6, "u6-life-c-6b", c6a.result.orderID);
  check("L6", c6a.result.status === "DONE" && c6b.result.status === "DONE" &&
    c6b.result.targetOrderID === c6a.result.orderID &&
    c6b.result.orderID !== c6a.result.orderID,
    JSON.stringify({ a: c6a.result, b: c6b.result }));
  // L7: a reversal event is never a target — U3/U4 expose no active Sale and
  // the mutation path refuses a non-order identity.
  var f7 = u3SaveFixture_("u6-life-reversal-target");
  var v7 = voidOn_(f7, "u6-life-v-7");
  check("L7a", v7.result.status === "DONE");
  u6MirrorOperations_(f7.fixture, f7.runtime.repository);
  var projection7 = u6Projection_(f7.fixture);
  check("L7b", projection7.activeView.events.length === 0 &&
    projection7.events.filter(function(event) {
      return event.eventType === "REVERSAL"; }).length === 1,
    JSON.stringify(projection7.activeView));
  var reversalProbe = voidOn_(f7, "u6-life-v-7b", v7.result.reversalRecognitionID);
  check("L7c", reversalProbe.result.status === "REFUSED" &&
    reversalProbe.result.code === "SALES_V2_TARGET_NOT_FOUND",
    JSON.stringify(reversalProbe.result));
  // L8: concurrent Correct (pending) vs Void — Correct owns the target until
  // terminal; the Void key fails closed with zero writes, then observes the
  // committed terminal state.
  var f8 = correctFixture_("u6-life-race-a");
  var pendingRt = u6NovRuntime_({ fixture: f8.fixture,
    repository: f8.runtime.repository, crash: "V2M_AFTER_INTENT" });
  var pendingPayload = u6CorrectPayload_("u6-life-c-8", f8.orderID,
    [{ productID: "P1", productVariantID: "PV1", qty: 1 }]);
  var threw8 = null;
  try { salesRecognitionV2CorrectWithRuntime_(pendingPayload, pendingRt); }
  catch (error) { threw8 = error; }
  var raceCounts = JSON.stringify(u6RowCounts_(f8.fixture));
  var raceVoid = voidOn_(f8, "u6-life-v-8");
  check("L8a", !!threw8 && raceVoid.result.status === "REFUSED" &&
    raceVoid.result.code === "SALES_V2_MUTATION_EXISTS" &&
    raceVoid.result.detail.indexOf("SALES_V2_CORRECT") !== -1 &&
    raceVoid.runtime.events.batches.length === 0 &&
    JSON.stringify(u6RowCounts_(f8.fixture)) === raceCounts,
    JSON.stringify(raceVoid.result));
  var resume8 = salesRecognitionV2CorrectWithRuntime_(pendingPayload,
    u6NovRuntime_({ fixture: f8.fixture, repository: pendingRt.repository }));
  u6MirrorOperations_(f8.fixture, f8.runtime.repository);
  check("L8b", resume8.status === "DONE", JSON.stringify(resume8));
  var raceVoid2 = voidOn_(f8, "u6-life-v-8b");
  check("L8c", raceVoid2.result.status === "REFUSED" &&
    raceVoid2.result.code === "SALES_V2_TARGET_ALREADY_VOIDED",
    JSON.stringify(raceVoid2.result));
  // L9: concurrent Void (pending) vs Correct — symmetric single winner.
  var f9 = u3SaveFixture_("u6-life-race-b");
  var pendingVoidRt = u6NovRuntime_({ fixture: f9.fixture,
    repository: f9.runtime.repository, crash: "V2M_AFTER_INTENT" });
  var threw9 = null;
  try {
    salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-life-v-9", f9.orderID),
      pendingVoidRt);
  } catch (error) { threw9 = error; }
  var raceCorrect = correct_(f9, "u6-life-c-9");
  check("L9", !!threw9 && raceCorrect.result.status === "REFUSED" &&
    raceCorrect.result.code === "SALES_V2_MUTATION_EXISTS" &&
    raceCorrect.result.detail.indexOf("SALES_V2_VOID") !== -1 &&
    raceCorrect.runtime.events.batches.length === 0,
    JSON.stringify(raceCorrect.result));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// CROSS-LAYER: U3 events/activeView/quality, U4 list/detail lifecycle, U5
// period Revenue, and PERIOD attribution (original period never rewritten).
// ---------------------------------------------------------------------------
function u6FinanceExtend_(sheets) {
  sheets.tabops = [CANONICAL_ENTRY.EXPENSE_HEADERS.slice()];
  sheets.ExpenseItems = [["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]];
  return u5WithFinanceSheets_(sheets);
}

function testSalesRecognitionV2U6CrossLayer() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_CROSS:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  // ---- VOID fixture: original 36,000 Oct, Void Nov ----
  var voidFixture_ = u6PricedFixture_("u6-cross-void", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }], u6FinanceExtend_);
  var voidRuntime = u6NovRuntime_({ fixture: voidFixture_.fixture,
    repository: voidFixture_.runtime.repository });
  var voidRes = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-cross-void", voidFixture_.orderID), voidRuntime);
  u6MirrorOperations_(voidFixture_.fixture, voidFixture_.runtime.repository);
  check("X0", voidRes.status === "DONE", JSON.stringify(voidRes));
  // X1: U3 consumes original + reversal as signed events; activeView drops
  // the voided chain; zero quality issues; both events recognized.
  var projectionVoid = u6Projection_(voidFixture_.fixture);
  check("X1", projectionVoid.events.length === 2 &&
    projectionVoid.totals.recognizedEventCount === 2 &&
    projectionVoid.totals.recognizedRevenue === 0 &&
    projectionVoid.totals.byPeriod["2026-10"] === 36000 &&
    projectionVoid.totals.byPeriod["2026-11"] === -36000 &&
    projectionVoid.activeView.events.length === 0 &&
    projectionVoid.quality.issues.length === 0 &&
    projectionVoid.quality.excluded.length === 0,
    JSON.stringify({ totals: projectionVoid.totals, av: projectionVoid.activeView,
      issues: projectionVoid.quality.issues }));
  // X2: U4 active list has no Sale for the voided chain; the voided view
  // shows the original as an inactive row; no duplicate active Sales.
  var voidIdentity = "ORDER:" + voidFixture_.orderID;
  var activeVoidPage = u4ActivePage_(voidFixture_.fixture);
  var voidedVoidPage = u4ActivePage_(voidFixture_.fixture, { lifecycleState: "voided" });
  var voidedRow = u4RowsById_(voidedVoidPage.rows)[voidIdentity];
  check("X2", !u4RowsById_(activeVoidPage.rows)[voidIdentity] &&
    activeVoidPage.rows.filter(function(row) { return row.id === voidIdentity; }).length === 0 &&
    Boolean(voidedRow) && voidedRow.isActive === false &&
    voidedRow.revenue === 36000 && voidedRow.date === "2026-10-15",
    JSON.stringify({ active: activeVoidPage.rows.map(function(row) { return row.id; }),
      voided: voidedVoidPage.rows.map(function(row) { return row.id + ":" + row.isActive; }) }));
  // X3: U4 detail reads the original as VOIDED with full lineage, never active.
  var voidDetail = u4RunWithFixture_(voidFixture_.fixture, function() {
    return getCanonicalTransactionDetail(voidIdentity);
  });
  check("X3", voidDetail.success === true && voidDetail.data.id === voidIdentity &&
    voidDetail.data.status === "VOIDED" && voidDetail.data.isActive === false &&
    voidDetail.data.immutableReason === "ALREADY_VOIDED" &&
    voidDetail.data.revenue === 36000 && voidDetail.data.recognitionStatus === "RECOGNIZED" &&
    voidDetail.data.lineage.length === 2 &&
    voidDetail.data.lineage.every(function(entry) { return entry.active === false; }) &&
    voidDetail.data.lineage.some(function(entry) {
      return entry.eventType === "REVERSAL" && entry.signedAmount === -36000; }) &&
    voidDetail.data.canCorrect === false && voidDetail.data.canVoid === false,
    JSON.stringify(voidDetail.data));
  // X4/PER: U5 period Revenue — Oct unchanged after the Nov Void; Nov holds
  // the exact reversal; October is never rewritten.
  var voidPnlOctBefore = u5Pnl_(voidFixture_.fixture, "2026-10-01", "2026-10-31");
  var voidPnlNov = u5Pnl_(voidFixture_.fixture, "2026-11-01", "2026-11-30");
  var voidPnlOctAfter = u5Pnl_(voidFixture_.fixture, "2026-10-01", "2026-10-31");
  check("PER1", voidPnlOctBefore.summary.revenue === 36000 &&
    voidPnlOctAfter.summary.revenue === 36000 &&
    voidPnlNov.summary.revenue === -36000,
    JSON.stringify({ octBefore: voidPnlOctBefore.summary.revenue,
      nov: voidPnlNov.summary.revenue, octAfter: voidPnlOctAfter.summary.revenue }));
  check("X4", voidPnlOctAfter.salesRecognition.recognizedRevenue === 36000 &&
    u5EventsRevenue_(voidFixture_.fixture, "2026-11-01", "2026-11-30") === -36000);
  // ---- CORRECT fixture: original 36,000 Oct, Correct Nov -> 41,000 ----
  var correctFixture_ = u6PricedFixture_("u6-cross-correct", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }], u6FinanceExtend_);
  u6SetPrice_(correctFixture_.fixture, 41000);
  var correctRuntime = u6NovRuntime_({ fixture: correctFixture_.fixture,
    repository: correctFixture_.runtime.repository });
  var correctRes = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6-cross-correct", correctFixture_.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 1 }]), correctRuntime);
  u6MirrorOperations_(correctFixture_.fixture, correctFixture_.runtime.repository);
  check("X5", correctRes.status === "DONE", JSON.stringify(correctRes));
  // X5: U3 — +/−/+ signed events, replacement active, original chain inactive,
  // zero quality issues (no heuristic reconstruction).
  var projectionCorrect = u6Projection_(correctFixture_.fixture);
  var originalIdentity = "ORDER:" + correctFixture_.orderID;
  var replacementIdentity = "ORDER:" + correctRes.orderID;
  check("X6", projectionCorrect.events.length === 3 &&
    projectionCorrect.totals.recognizedRevenue === 41000 &&
    projectionCorrect.totals.byPeriod["2026-10"] === 36000 &&
    projectionCorrect.totals.byPeriod["2026-11"] === 5000 &&
    projectionCorrect.activeView.events.length === 1 &&
    projectionCorrect.activeView.events[0].namespace.indexOf(replacementIdentity + ":") === 0 &&
    projectionCorrect.activeView.totals.recognizedRevenue === 41000 &&
    !projectionCorrect.activeView.events.some(function(event) {
      return event.namespace.indexOf(originalIdentity + ":") === 0; }) &&
    projectionCorrect.quality.issues.length === 0 &&
    projectionCorrect.quality.excluded.length === 0,
    JSON.stringify({ totals: projectionCorrect.totals, av: projectionCorrect.activeView,
      issues: projectionCorrect.quality.issues }));
  // X7: U4 — replacement is the ONLY active Sale for this economics; the
  // original shows as Voided; no duplicate active Sales.
  var activeCorrectPage = u4ActivePage_(correctFixture_.fixture);
  var activeCorrectIds = activeCorrectPage.rows.map(function(row) { return row.id; });
  var voidedCorrectPage = u4ActivePage_(correctFixture_.fixture,
    { lifecycleState: "voided" });
  var originalVoidedRow = u4RowsById_(voidedCorrectPage.rows)[originalIdentity];
  var replacementRow = u4RowsById_(activeCorrectPage.rows)[replacementIdentity];
  check("X7", Boolean(replacementRow) && replacementRow.revenue === 41000 &&
    replacementRow.isActive === true &&
    activeCorrectIds.indexOf(originalIdentity) === -1 &&
    activeCorrectIds.filter(function(id) { return id === replacementIdentity; }).length === 1 &&
    Boolean(originalVoidedRow) && originalVoidedRow.isActive === false &&
    originalVoidedRow.revenue === 36000,
    JSON.stringify({ active: activeCorrectIds,
      voided: voidedCorrectPage.rows.map(function(row) { return row.id; }) }));
  // X8: U4 detail — replacement active with OriginalID lineage; original
  // VOIDED with the reversal lineage.
  var replacementDetail = u4RunWithFixture_(correctFixture_.fixture, function() {
    return getCanonicalTransactionDetail(replacementIdentity);
  });
  var originalDetail = u4RunWithFixture_(correctFixture_.fixture, function() {
    return getCanonicalTransactionDetail(originalIdentity);
  });
  check("X8", replacementDetail.success === true &&
    replacementDetail.data.status === "ACTIVE" &&
    replacementDetail.data.isActive === true &&
    replacementDetail.data.revenue === 41000 &&
    replacementDetail.data.originalId === correctFixture_.eventRow.RecognitionID &&
    originalDetail.success === true && originalDetail.data.status === "VOIDED" &&
    originalDetail.data.isActive === false && originalDetail.data.revenue === 36000 &&
    originalDetail.data.lineage.length === 2,
    JSON.stringify({ rep: replacementDetail.data, orig: originalDetail.data }));
  // X9/PER2: U5 — Oct unchanged (36,000); Nov = -36,000 + 41,000 = 5,000;
  // both correction effects live in the action period only.
  var correctPnlOct = u5Pnl_(correctFixture_.fixture, "2026-10-01", "2026-10-31");
  var correctPnlNov = u5Pnl_(correctFixture_.fixture, "2026-11-01", "2026-11-30");
  check("PER2", correctPnlOct.summary.revenue === 36000 &&
    correctPnlNov.summary.revenue === 5000,
    JSON.stringify({ oct: correctPnlOct.summary.revenue, nov: correctPnlNov.summary.revenue }));
  check("X9", correctPnlNov.salesRecognition.recognizedRevenue === 5000 &&
    u5EventsRevenue_(correctFixture_.fixture, "2026-11-01", "2026-11-30") === 5000);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// POLICY C: no COGS/HPP/Cash/Inventory posting from either mutation; the only
// new ledger accounts are 4000 and 1030; HPP exists as analytical snapshot
// data only; write surfaces stay frozen.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6PolicyC() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_POLICYC:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var mutation = SALES_RECOGNITION_V2_MUTATION;
  // P1: both mutations succeed on their committed fixtures (mutation-proof
  // anchor for forged extra journal rows).
  var voidFixture_ = u3SaveFixture_("u6-policyc-void");
  var voidRuntime = u6NovRuntime_({ fixture: voidFixture_.fixture,
    repository: voidFixture_.runtime.repository });
  var voidRes = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6-policyc-void", voidFixture_.orderID), voidRuntime);
  var correctFixture_ = u6PricedFixture_("u6-policyc-correct", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }]);
  u6SetPrice_(correctFixture_.fixture, 41000);
  var correctRuntime = u6NovRuntime_({ fixture: correctFixture_.fixture,
    repository: correctFixture_.runtime.repository });
  var correctRes = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6-policyc-correct", correctFixture_.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 1 }]), correctRuntime);
  check("P1", voidRes.status === "DONE" && correctRes.status === "DONE",
    JSON.stringify({ v: voidRes, c: correctRes }));
  // P2: new ledger rows use ONLY 1030/4000 — never 1100, 5000, 2010, 1000.
  var voidLedger = readCanonicalTable(voidFixture_.fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var correctLedger = readCanonicalTable(correctFixture_.fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var newVoidRows = voidLedger.slice(2);
  var newCorrectRows = correctLedger.slice(2);
  check("P2", newVoidRows.concat(newCorrectRows).every(function(row) {
      return ["1030", "4000"].indexOf(String(row.AccountCode)) !== -1; }) &&
    newVoidRows.length === 2 && newCorrectRows.length === 4,
    JSON.stringify({ v: newVoidRows, c: newCorrectRows }));
  // P3: no COGS/HPP/Cash/Payment/Settlement/Inventory movement anywhere in
  // the new rows; no account 2010 (no automatic refund payable).
  check("P3", newVoidRows.concat(newCorrectRows).every(function(row) {
      var movement = String(row.MovementType);
      return ["SALES_RECOGNITION"].indexOf(movement) !== -1 &&
        ["SALE_HPP", "PAID_SALE", "PURCHASE_EXPENSE", "COGS"].indexOf(movement) === -1 &&
        String(row.SourceType) === "SALES_RECOGNITION_V2"; }),
    JSON.stringify(newVoidRows.concat(newCorrectRows)));
  // P4: protected surfaces never grow from either mutation.
  check("P4", u6RowCounts_(voidFixture_.fixture).Payments === 1 &&
    u6RowCounts_(voidFixture_.fixture).Settlements === 1 &&
    u6RowCounts_(voidFixture_.fixture).Logs === 1 &&
    u6RowCounts_(voidFixture_.fixture).tabsal === 1 &&
    u6RowCounts_(correctFixture_.fixture).Payments === 1 &&
    u6RowCounts_(correctFixture_.fixture).Logs === 1);
  // P5: HPP is analytical only — present on the replacement snapshot, absent
  // from every ledger row.
  var correctEvents = readCanonicalTable(correctFixture_.fixture,
    "SalesRecognitionEvents", SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  var replacementSnapshot = JSON.parse(correctEvents[2].SnapshotJSON);
  check("P5", typeof replacementSnapshot.hppTotalSnapshot === "number" &&
    replacementSnapshot.hppTotalSnapshot >= 0 &&
    newCorrectRows.every(function(row) {
      return String(row.AccountCode) !== "5000" && String(row.AccountCode) !== "1100"; }));
  // P6: WRITE_SURFACES never include Cash/Payment/Settlement/Inventory tabs.
  var allSurfaces = mutation.WRITE_SURFACES[mutation.VOID]
    .concat(mutation.WRITE_SURFACES[mutation.CORRECT]);
  check("P6", allSurfaces.every(function(name) {
      return ["Payments", "Settlements", "InventoryLedger", "Cash", "tabsal",
        "tabops", "Logs"].indexOf(name) === -1; }) &&
    JSON.stringify(mutation.WRITE_SURFACES[mutation.VOID]) ===
      JSON.stringify(["SalesRecognitionEvents", "BalanceLedger", "SalesRecognitionAudits"]));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// LEGACY: cross-rejection both directions, legacy handler rejects V2
// identities, legacy Void regression intact, source-level path separation.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6Legacy() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_LEGACY:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  // G1: the legacy ledger spec never resolves V2 identities.
  var specError1 = null, specError2 = null;
  try { canonicalLifecycleLedgerSpec("ORD-U6-VOID"); } catch (error) { specError1 = error; }
  try { canonicalLifecycleLedgerSpec("ORDER:ORD-U6-VOID"); } catch (error) { specError2 = error; }
  check("G1", Boolean(specError1) && specError1.entryCode === "TRANSACTION_NOT_FOUND" &&
    Boolean(specError2) && specError2.entryCode === "TRANSACTION_NOT_FOUND",
    JSON.stringify({ a: specError1 && specError1.entryCode,
      b: specError2 && specError2.entryCode }));
  // G2-G4: the V2 mutation path refuses legacy identities with zero writes.
  var fixture_ = u3SaveFixture_("u6-legacy-guard");
  function refusePayload_(label, payload) {
    var runtime = u6NovRuntime_({ fixture: fixture_.fixture,
      repository: fixture_.runtime.repository });
    var counts = JSON.stringify(u6RowCounts_(fixture_.fixture));
    var opsBefore = runtime.repository.rows().length;
    var result = String(payload.orderType || "") !== "" ?
      salesRecognitionV2CorrectWithRuntime_(payload, runtime) :
      salesRecognitionV2VoidWithRuntime_(payload, runtime);
    check(label, result.status === "REFUSED" &&
      result.code === "SALES_V2_LEGACY_IDENTITY_REJECTED" &&
      result.writeCount === 0 && runtime.events.batches.length === 0 &&
      runtime.repository.rows().length === opsBefore &&
      JSON.stringify(u6RowCounts_(fixture_.fixture)) === counts,
      JSON.stringify(result));
  }
  refusePayload_("G2", u6VoidPayload_("u6-legacy-1", "SAL-U6-1"));
  refusePayload_("G3", { requestKey: "SAL-LEGACY-KEY", orderID: fixture_.orderID,
    reason: "legacy key probe" });
  refusePayload_("G4", u6VoidPayload_("u6-legacy-2", "OPS-U6-1"));
  var correctLegacy = { requestKey: "u6-legacy-correct", orderID: "ORDER:SAL-U6-9",
    reason: "legacy target probe", orderType: "DINE_IN",
    lines: [{ productID: "P1", productVariantID: "PV1", qty: 1 }] };
  refusePayload_("G5", correctLegacy);
  // G6: legacy Correct/Void handlers reject V2 identities end to end.
  var legacyVoid = u4RunWithFixture_(fixture_.fixture, function() {
    return voidCanonicalTransaction({ transactionId: "ORDER:" + fixture_.orderID,
      reason: "u6 legacy rejection probe" });
  });
  var legacyPreview = u4RunWithFixture_(fixture_.fixture, function() {
    return previewCanonicalTransactionCorrection({ transactionId: fixture_.orderID,
      reason: "u6 legacy rejection probe", qty: 1, productId: "P1", type: "Hot" });
  });
  check("G6", legacyVoid.success === false &&
    legacyVoid.error.code === "TRANSACTION_NOT_FOUND" &&
    legacyPreview.success === false &&
    legacyPreview.error.code === "TRANSACTION_NOT_FOUND",
    JSON.stringify({ v: legacyVoid, p: legacyPreview }));
  // G7: legacy Void regression — APP_ENTRY canonical row still voids through
  // the legacy path (legacy behavior untouched).
  var legacyFixture = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendSale_(legacyFixture, { ID_Trx: "SAL-U6-LG", Tanggal: "2026-10-05T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 1000, HJ: 5000, Source: CANONICAL_ENTRY.SOURCE });
  var originalSpreadsheetApp = globalThis.SpreadsheetApp;
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return legacyFixture; },
    flush: function() {} };
  var legacyResult;
  try {
    legacyResult = voidCanonicalTransaction({ transactionId: "SAL-U6-LG",
      reason: "legacy void regression" });
  } finally {
    globalThis.SpreadsheetApp = originalSpreadsheetApp;
  }
  var legacyRows = readCanonicalTable(legacyFixture, "tabsal", CANONICAL_ENTRY.SALES_HEADERS);
  var logRows = readCanonicalTable(legacyFixture, "Logs", CANONICAL_ENTRY.LOG_HEADERS);
  check("G7", legacyResult.success === true && legacyRows.length === 1 &&
    isCanonicalActive(legacyRows[0].IsActive) === false &&
    logRows.some(function(row) { return String(row.Action) === "VOID_SALES" &&
      String(row.RecordID) === "SAL-U6-LG"; }),
    JSON.stringify({ result: legacyResult, logs: logRows.length }));
  // G8: path separation at source level — V2 cores never call legacy
  // lifecycle writers; legacy cores never reference V2 mutation entrypoints.
  var v2Source = salesRecognitionV2VoidWithRuntime_.toString() +
    salesRecognitionV2CorrectWithRuntime_.toString() +
    salesRecognitionV2MutationNewIntent_.toString() +
    salesRecognitionV2MutationResume_.toString() +
    salesRecognitionV2DurableMutation_.toString();
  var legacySource = voidCanonicalTransaction.toString() +
    correctCanonicalTransaction.toString() + canonicalLifecycleLedgerSpec.toString() +
    persistCanonicalVoid.toString();
  check("G8", v2Source.indexOf("voidCanonicalTransaction") === -1 &&
    v2Source.indexOf("correctCanonicalTransaction") === -1 &&
    v2Source.indexOf("appendLifecycleAudit") === -1 &&
    legacySource.indexOf("SALES_V2_VOID") === -1 &&
    legacySource.indexOf("SALES_V2_CORRECT") === -1 &&
    legacySource.indexOf("salesRecognitionV2Durable") === -1);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// TRANSPORT: exactly ONE spreadsheets.batchUpdate per mutation over the frozen
// append surfaces (appendCells only, RAW CellData), missing sheetId rejected
// before any request, timeout/API error -> UNKNOWN, sole-writer proof.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6Transport() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_TRANSPORT:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var mutation = SALES_RECOGNITION_V2_MUTATION;
  function rowCounts_(fixture) {
    return { Orders: fixture.getSheetByName("Orders").getLastRow(),
      OrderLines: fixture.getSheetByName("OrderLines").getLastRow(),
      Events: fixture.getSheetByName("SalesRecognitionEvents").getLastRow(),
      Ledger: fixture.getSheetByName("BalanceLedger").getLastRow(),
      Audits: fixture.getSheetByName("SalesRecognitionAudits").getLastRow(),
      Payments: fixture.getSheetByName("Payments").getLastRow() };
  }
  // T1: Void = exactly ONE batch; the batch is the sole writer (row deltas
  // match the batch's applied rows exactly; nothing else grows).
  var f1 = u3SaveFixture_("u6-transport-void");
  var before1 = rowCounts_(f1.fixture);
  var rt1 = u6NovRuntime_({ fixture: f1.fixture, repository: f1.runtime.repository });
  var res1 = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-transport-void", f1.orderID), rt1);
  var after1 = rowCounts_(f1.fixture);
  check("T1", res1.status === "DONE" && rt1.events.batches.length === 1 &&
    rt1.events.appliedRows === 4 &&
    after1.Orders === before1.Orders && after1.OrderLines === before1.OrderLines &&
    after1.Events === before1.Events + 1 && after1.Ledger === before1.Ledger + 2 &&
    after1.Audits === before1.Audits + 1 && after1.Payments === before1.Payments,
    JSON.stringify({ before: before1, after: after1, batches: rt1.events.batches.length }));
  // T2: Correct = exactly ONE batch over five surfaces, ten rows.
  var f2 = u6PricedFixture_("u6-transport-correct", 18000,
    [{ productID: "P1", productVariantID: "PV1", qty: 2 }]);
  u6SetPrice_(f2.fixture, 41000);
  var before2 = rowCounts_(f2.fixture);
  var rt2 = u6NovRuntime_({ fixture: f2.fixture, repository: f2.runtime.repository });
  var res2 = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6-transport-correct", f2.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 1 }]), rt2);
  var after2 = rowCounts_(f2.fixture);
  check("T2", res2.status === "DONE" && rt2.events.batches.length === 1 &&
    rt2.events.appliedRows === 10 &&
    after2.Orders === before2.Orders + 1 && after2.OrderLines === before2.OrderLines + 1 &&
    after2.Events === before2.Events + 2 && after2.Ledger === before2.Ledger + 4 &&
    after2.Audits === before2.Audits + 2 && after2.Payments === before2.Payments,
    JSON.stringify({ before: before2, after: after2, batches: rt2.events.batches.length }));
  // T3/T4: batch body = appendCells subrequests only over the frozen surfaces,
  // RAW CellData kinds only (never formulaValue).
  var voidPlan = JSON.parse(u6OpRows_(rt1.repository, mutation.VOID)[0].OperationPlan);
  var voidRanges = salesRecognitionV2MutationValueRanges_(voidPlan);
  var voidBody = salesRecognitionV2MutationBatchBody_(voidRanges, {
    SalesRecognitionEvents: 1, BalanceLedger: 2, SalesRecognitionAudits: 3 });
  check("T3", voidBody.requests.length === 3 &&
    voidBody.requests.every(function(request) {
      var keys = Object.keys(request);
      return keys.length === 1 && keys[0] === "appendCells" &&
        request.appendCells.fields === "userEnteredValue" &&
        typeof request.appendCells.sheetId === "number"; }),
    JSON.stringify(voidBody.requests.map(function(request) { return Object.keys(request); })));
  var correctPlan = JSON.parse(u6OpRows_(rt2.repository, mutation.CORRECT)[0].OperationPlan);
  var correctRanges = salesRecognitionV2MutationValueRanges_(correctPlan);
  var correctBody = salesRecognitionV2MutationBatchBody_(correctRanges, {
    Orders: 1, OrderLines: 2, SalesRecognitionEvents: 3, BalanceLedger: 4,
    SalesRecognitionAudits: 5 });
  var cellKinds = ["stringValue", "numberValue", "boolValue"];
  var safeCells = correctBody.requests.every(function(request) {
    return request.appendCells.rows.every(function(row) {
      return row.values.every(function(cell) {
        var keys = Object.keys(cell.userEnteredValue);
        return keys.length === 1 && cellKinds.indexOf(keys[0]) !== -1;
      });
    });
  });
  check("T4", correctBody.requests.length === 5 && safeCells,
    JSON.stringify(correctBody.requests.length));
  // T5: a missing sheetId rejects the batch body BEFORE any request.
  var threw5 = null;
  try {
    salesRecognitionV2MutationBatchBody_(voidRanges,
      { SalesRecognitionEvents: 1, BalanceLedger: 2 });
  } catch (error) { threw5 = error; }
  check("T5", Boolean(threw5) && String(threw5.message).indexOf("SHEET_ID_UNAVAILABLE") === 0,
    String(threw5));
  // T6: transport timeout / HTTP error -> UNKNOWN with the request identity,
  // operation stays IN_PROGRESS, no autonomous in-call retry.
  var f6 = u3SaveFixture_("u6-transport-timeout");
  var rt6 = u6NovRuntime_({ fixture: f6.fixture, repository: f6.runtime.repository });
  var events6 = rt6.events;
  rt6.batch = function(ranges) { events6.batches.push(ranges); throw new Error("HTTP 429"); };
  var res6 = salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6-transport-timeout", f6.orderID), rt6);
  check("T6", res6.status === "UNKNOWN" && res6.code === "BATCH_OUTCOME_UNKNOWN" &&
    res6.requestKey === "u6-transport-timeout" && res6.operationID !== "" &&
    rt6.events.batches.length === 1 &&
    u6OpRows_(rt6.repository, mutation.VOID)[0].State === "IN_PROGRESS",
    JSON.stringify(res6));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// SOURCE AUDIT (29 items): structural proof over loaded function sources and
// frozen constants. Behavioral items are covered by the suites above; this
// suite pins the source-level invariants the mutation proof depends on.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U6SourceAudit() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U6_AUDIT:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var mutation = SALES_RECOGNITION_V2_MUTATION, contract = SALES_RECOGNITION_V2_CONTRACT;
  var v2CoreSource = salesRecognitionV2VoidWithRuntime_.toString() +
    salesRecognitionV2CorrectWithRuntime_.toString() +
    salesRecognitionV2MutationRun_.toString() +
    salesRecognitionV2MutationNewIntent_.toString() +
    salesRecognitionV2MutationResume_.toString() +
    salesRecognitionV2MutationApplyBatch_.toString() +
    salesRecognitionV2MutationInspect_.toString() +
    salesRecognitionV2MutationVerifyPlan_.toString() +
    salesRecognitionV2MutationResolveTarget_.toString() +
    salesRecognitionV2MutationCompetingGate_.toString() +
    salesRecognitionV2MutationVoidPlan_.toString() +
    salesRecognitionV2MutationCorrectPlan_.toString() +
    salesRecognitionV2MutationReversalJournalRows_.toString() +
    salesRecognitionV2MutationValueRanges_.toString() +
    salesRecognitionV2MutationBatchBody_.toString() +
    salesRecognitionV2DurableMutation_.toString() +
    salesRecognitionV2DurableVoid.toString() +
    salesRecognitionV2DurableCorrect.toString();
  var legacyCoreSource = voidCanonicalTransaction.toString() +
    correctCanonicalTransaction.toString() + canonicalLifecycleLedgerSpec.toString() +
    persistCanonicalVoid.toString() + persistCanonicalCorrection.toString();
  // A1: V2 mutation path never calls legacy lifecycle writers.
  check("A1", v2CoreSource.indexOf("voidCanonicalTransaction") === -1 &&
    v2CoreSource.indexOf("correctCanonicalTransaction") === -1 &&
    v2CoreSource.indexOf("persistCanonicalVoid") === -1 &&
    v2CoreSource.indexOf("appendLifecycleAudit") === -1);
  // A2: legacy path never references V2 mutation entrypoints.
  check("A2", legacyCoreSource.indexOf("SALES_V2_VOID") === -1 &&
    legacyCoreSource.indexOf("SALES_V2_CORRECT") === -1 &&
    legacyCoreSource.indexOf("salesRecognitionV2Durable") === -1 &&
    legacyCoreSource.indexOf("salesRecognitionV2Mutation") === -1);
  // A3: originals immutable — target digests frozen in the plan and verified
  // on every inspect.
  check("A3", v2CoreSource.indexOf("targetEvidence") !== -1 &&
    salesRecognitionV2MutationInspect_.toString().indexOf("TARGET_EVENT_TAMPERED") !== -1 &&
    salesRecognitionV2MutationInspect_.toString().indexOf("TARGET_JOURNAL_TAMPERED") !== -1);
  // A4: Void reverses the EXACT recognized amount (plan.amount drives both
  // journal lines and the reversal event).
  check("A4", salesRecognitionV2MutationReversalJournalRows_.toString()
      .indexOf("Debit: amount, Credit: 0") !== -1 &&
    salesRecognitionV2MutationReversalJournalRows_.toString()
      .indexOf("Debit: 0, Credit: amount") !== -1 &&
    salesRecognitionV2MutationVerifyPlan_.toString()
      .indexOf("REVERSAL_JOURNAL_AMOUNT_MISMATCH") !== -1);
  // A5: Void accounting direction Dr4000 / Cr1030 only.
  var reversalSource = salesRecognitionV2MutationReversalJournalRows_.toString();
  check("A5", reversalSource.indexOf("JOURNAL_ACCOUNTS.REVENUE, Debit: amount") !== -1 &&
    reversalSource.indexOf("JOURNAL_ACCOUNTS.SETTLEMENT, Debit: 0, Credit: amount") !== -1);
  // A6: Correct freezes reversal AND replacement into ONE ranges builder.
  var rangesSource = salesRecognitionV2MutationValueRanges_.toString();
  check("A6", rangesSource.indexOf("reversalJournalRows.concat(rep.journalRows)") !== -1 &&
    rangesSource.indexOf("plan.reversalEventRow") !== -1 &&
    rangesSource.indexOf("rep.eventRow") !== -1 &&
    rangesSource.indexOf("MUTATION_SURFACE_MISMATCH") !== -1);
  // A7: no delta-only arithmetic anywhere in the correct plan builder.
  var correctPlanSource = salesRecognitionV2MutationCorrectPlan_.toString();
  check("A7", correctPlanSource.indexOf("orderTotal - ") === -1 &&
    correctPlanSource.indexOf("- Number(plan.amount)") === -1 &&
    correctPlanSource.indexOf("- input.target.amount") === -1);
  // A8: new identity derivations are type-scoped and deterministic.
  var reversalVoid = salesRecognitionV2MutationReversalId_(
    mutation.REVERSAL_PREFIXES.recognition, mutation.VOID, "audit-key", "ORD-AUDIT-1");
  var reversalCorrect = salesRecognitionV2MutationReversalId_(
    mutation.REVERSAL_PREFIXES.recognition, mutation.CORRECT, "audit-key", "ORD-AUDIT-1");
  var replacementIds = salesRecognitionV2MutationReplacementIds_(mutation.CORRECT, "audit-key");
  check("A8", reversalVoid.indexOf("SCRV-") === 0 && reversalCorrect.indexOf("SCRV-") === 0 &&
    reversalVoid !== reversalCorrect &&
    replacementIds.recognitionID.indexOf("SCR-") === 0 &&
    replacementIds.orderID.indexOf("ORD-") === 0 &&
    replacementIds.recognitionID !== reversalVoid);
  // A9: the persisted plan is the only retry authority (no master re-read in
  // the resume path).
  check("A9", salesRecognitionV2MutationResume_.toString()
      .indexOf("JSON.parse(operation.OperationPlan)") !== -1 &&
    salesRecognitionV2MutationResume_.toString().indexOf("readAuthority") === -1 &&
    salesRecognitionV2MutationResume_.toString().indexOf("transactionProductionAuthority_") === -1);
  // A10: exact (OperationType, RequestKey) lookup precedes any target or
  // master recalculation.
  var runSource = salesRecognitionV2MutationRun_.toString();
  check("A10", runSource.indexOf("findOperation") !== -1 &&
    runSource.indexOf("findOperation") < runSource.indexOf("salesRecognitionV2MutationNewIntent_") &&
    runSource.indexOf("findOperation") < runSource.indexOf("salesRecognitionV2MutationResume_"));
  // A11: exactly ONE runtime.batch call per mutation execution.
  var applySource = salesRecognitionV2MutationApplyBatch_.toString();
  var batchCalls = applySource.split("runtime.batch(").length - 1;
  check("A11", batchCalls === 1, String(batchCalls));
  // A12: exact artifact verification runs BEFORE the COMMITTED transition.
  check("A12", applySource.indexOf("salesRecognitionV2MutationInspect_") !== -1 &&
    applySource.indexOf("salesRecognitionV2MutationInspect_") <
      applySource.indexOf("transactionCommitOperation_"));
  // A13: verified COMMITTED readback runs BEFORE any success return.
  check("A13", applySource.indexOf("salesRecognitionV2MutationCommitVerify_") <
    applySource.lastIndexOf("STATUS.DONE"));
  // A14: UNKNOWN outcomes are preserved, never collapsed into a failure.
  check("A14", applySource.indexOf("STATUS.UNKNOWN") !== -1 &&
    applySource.indexOf("BATCH_OUTCOME_UNKNOWN") !== -1 &&
    applySource.indexOf("READBACK_UNKNOWN") !== -1 &&
    applySource.indexOf("COMMIT_OUTCOME_UNKNOWN") !== -1 &&
    salesRecognitionV2MutationResume_.toString().indexOf("STATUS.UNKNOWN") !== -1);
  // A15: duplicate / partial / conflict states exist and fail closed.
  var inspectSource = salesRecognitionV2MutationInspect_.toString();
  check("A15", inspectSource.indexOf('"CONFLICT"') !== -1 &&
    inspectSource.indexOf('"PARTIAL"') !== -1 &&
    inspectSource.indexOf('"NONE"') !== -1 &&
    inspectSource.indexOf('"EXACT"') !== -1 &&
    inspectSource.indexOf('"UNKNOWN"') !== -1 &&
    salesRecognitionV2MutationResume_.toString().indexOf("IDENTITY_CONFLICT") !== -1 &&
    salesRecognitionV2MutationResume_.toString().indexOf("ARTIFACTS_INCOMPLETE") !== -1);
  // A16: duplicate terminal reversal is prevented at eligibility.
  check("A16", salesRecognitionV2MutationResolveTarget_.toString()
      .indexOf("TARGET_ALREADY_VOIDED") !== -1 &&
    salesRecognitionV2MutationInspect_.toString().indexOf("REVERSAL_TARGET_CLAIMED") !== -1);
  // A17: competing keys on one target fail closed (single winner).
  check("A17", salesRecognitionV2MutationCompetingGate_.toString()
      .indexOf("MUTATION_EXISTS") !== -1 &&
    salesRecognitionV2MutationResolveTarget_.toString()
      .indexOf("salesRecognitionV2MutationCompetingGate_") !== -1);
  // A18: EconomicDate comes from the server-recorded action time, never the
  // target's original period.
  var newIntentSource = salesRecognitionV2MutationNewIntent_.toString();
  check("A18", newIntentSource.indexOf("capitalEquityDateKey(now)") !== -1 &&
    newIntentSource.indexOf("target.economicDate") === -1);
  // A19: no row rewrite/delete primitives anywhere in the mutation path —
  // appends happen only through the injected batch.
  check("A19", v2CoreSource.indexOf("deleteRow(") === -1 &&
    v2CoreSource.indexOf("setValues(") === -1 &&
    v2CoreSource.indexOf("setValue(") === -1);
  // A20: frozen write surfaces — no Cash / Payment / Settlement / Inventory.
  var surfaces = JSON.stringify(mutation.WRITE_SURFACES);
  check("A20", surfaces.indexOf("Payments") === -1 &&
    surfaces.indexOf("Settlements") === -1 &&
    surfaces.indexOf("InventoryLedger") === -1 &&
    surfaces.indexOf("Cash") === -1);
  // A21: no automatic 2010 (refund payable) posting.
  check("A21", v2CoreSource.indexOf('"2010"') === -1 &&
    v2CoreSource.indexOf("'2010'") === -1 &&
    JSON.stringify(mutation.CODES).indexOf("2010") === -1);
  // A22: no HPP / COGS posting primitive in the mutation path.
  check("A22", v2CoreSource.indexOf("SALE_HPP") === -1 &&
    v2CoreSource.indexOf('"5000"') === -1 && v2CoreSource.indexOf("'5000'") === -1);
  // A23: no InventoryLedger reference in the mutation path.
  check("A23", v2CoreSource.indexOf("InventoryLedger") === -1);
  // A24: U3 activeView derives lifecycle from persisted lineage fields, never
  // reconstructed heuristics.
  var projectionSource = buildRecognizedSalesProjection_.toString();
  check("A24", projectionSource.indexOf("chainReversed") !== -1 &&
    projectionSource.indexOf("chainReplaced") !== -1 &&
    projectionSource.indexOf("event.originalId") !== -1);
  // A25: U4 consumes the shared projection with the voided-chain seam.
  check("A25", buildSalesRecognitionOrderDetail_.toString()
      .indexOf("salesRecognitionVoidedChainEvent_") !== -1 &&
    buildTransactionSalesReadRows_.toString().indexOf("salesRecognitionVoidedChainEvent_") !== -1);
  // A25b: U3 <-> U6 operation-type contracts stay in sync.
  var projectionTypes = SALES_RECOGNITION_V2_MUTATION_OPERATION_TYPES.slice().sort();
  var mutationTypes = mutation.OPERATION_TYPES.slice().sort();
  check("A25b", JSON.stringify(projectionTypes) === JSON.stringify(mutationTypes) &&
    SALES_RECOGNITION_V2_RECOGNITION_OPERATION_TYPES.indexOf(mutation.CORRECT) !== -1 &&
    SALES_RECOGNITION_V2_RECOGNITION_OPERATION_TYPES.indexOf(
      SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE) !== -1);
  // A26: U5 Revenue stays signed-event based with no mutation arithmetic.
  check("A26", buildFinanceSalesRecognitionScope_.toString().indexOf("signedAmount") !== -1);
  // A27: legacy lifecycle guards intact (SAL-/OPS- only).
  check("A27", canonicalLifecycleLedgerSpec.toString().indexOf('indexOf("SAL-")') !== -1 &&
    canonicalLifecycleLedgerSpec.toString().indexOf('indexOf("OPS-")') !== -1);
  // A28: V2 (and every mutation) stays PREPARED/disabled by default.
  var gate = salesRecognitionV2RequestGate(salesRecognitionV2DefaultConfig());
  check("A28", contract.DEFAULT_CONFIG.mode === "PREPARED" &&
    gate.allowed === false && gate.code === "V2_NOT_ACTIVATED" &&
    salesRecognitionV2MutationRuntime_.toString()
      .indexOf("salesRecognitionV2DefaultConfig") !== -1);
  // A29: no U7 operator-flow surface — no action flags, no dispatch/UI hooks.
  check("A29", v2CoreSource.indexOf("canCorrect: true") === -1 &&
    v2CoreSource.indexOf("canVoid: true") === -1 &&
    v2CoreSource.indexOf("getTransactionsPage") === -1 &&
    v2CoreSource.indexOf("google.script.run") === -1);
  return { total: pass, pass: pass, fail: 0 };
}




