// Parameterized, local fixtures only; no production services are invoked.
function testInventoryReceiptOrchestrationContracts(authority) {
  var count = 0, clone = inventoryReceiptClone_, baseline = JSON.stringify(authority);
  function check(value, label) { count++; if (!value) throw new Error("Orchestration: " + label); }
  function throws(fn, label) { var failed = false; try { fn(); } catch (error) { failed = true; } check(failed, label); }
  function fixture() {
    var capture = inventoryReceiptTestRuntime_(authority);
    migrateInventoryReceiptSchema_(capture); capture.calls.length = 0;
    var held = false, acquisitions = 0, releases = 0, delegate = capture.lock;
    var lock = { waitLock: function() { check(!held, "no nested lock"); delegate.waitLock(30000); held = true; acquisitions++; },
      hasLock: function() { return held; }, releaseLock: function() { check(held, "owned release"); held = false; releases++; delegate.releaseLock(); } };
    capture.lock = lock;
    var f = { capture: capture, ledger: [], movementAttempts: 0, failure: "", items: clone(authority.items), conversions: clone(authority.conversions),
      activation: { version: "11V.8", revision: 1, enabled: true, effectiveFrom: "2026-10-01", timezone: "Asia/Jakarta",
        routingVersion: "DIRECT-INVENTORY-ITEM-V1", activationEvent: { id: "TEST-ACTIVATION", actor: "TEST", at: "2026-10-01T00:00:00Z" }, evidenceFingerprint: Array(65).join("a") } };
    f.runtime = { environment: "LOCAL_FIXTURE", lock: lock, capture: capture,
      read: function() {
        check(held, "fresh read owns lock");
        if (f.failure === "UNREADABLE" && f.movementAttempts) throw new Error("UNREADABLE");
        return { receipts: inventoryReceiptReadSheet_(capture.spreadsheet).rows, ledger: clone(f.ledger),
          items: clone(f.items), conversions: clone(f.conversions), activation: clone(f.activation) };
      }, appendMovement: function(row) {
        check(held, "movement write owns lock"); f.movementAttempts++;
        if (f.failure === "BEFORE") throw new Error("BEFORE");
        f.ledger.push(clone(row));
        if (f.failure === "AFTER" || f.failure === "UNREADABLE") throw new Error("AFTER");
      } };
    f.request = { transactionType: "INVENTORY_RECEIPT", requestKey: "request-0001",
      input: { ItemID: "ING-018", ReceiptDate: "2026-10-01", PurchaseQty: "500", PurchaseUOM: "gr", AcquisitionValue: "10001",
        SupplierSource: "TEST", Attested: true, ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE" } };
    f.run = function(p) { var before = acquisitions, released = releases; var result = orchestrateInventoryReceipt_(p || f.request, f.runtime);
      check(acquisitions - before === releases - released && acquisitions - before <= 1, "one lock per valid orchestration; malformed refused before lock"); return result; };
    f.receiptCount = function() { return capture.sheets.InventoryReceipts.grid.length - 1; };
    return f;
  }
  var f = fixture(), result = f.run();
  check(result.status === "OPERATIONAL_POSTED" && f.receiptCount() === 1 && f.ledger.length === 1, "first capture/post");
  check(result.writeCount === 3 && result.sourceId === f.ledger[0].SourceID && result.movementId === f.ledger[0].ID_Movement, "identity binding and physical writes");
  check(JSON.parse(f.capture.sheets.InventoryReceipts.grid[1][24]).input.ItemID === "ING-018" && !JSON.parse(f.capture.sheets.InventoryReceipts.grid[1][24]).routing, "durable direct ItemID binding without Expense ID");
  result = f.run(); check(result.status === "OPERATIONAL_POSTED" && result.writeCount === 0 && f.movementAttempts === 1, "posted retry writes0");
  result = f.run(Object.assign({}, f.request, { input: Object.assign({}, f.request.input, { AcquisitionValue: "10002" }) }));
  check(result.status === "CONFLICT" && result.writeCount === 0 && f.receiptCount() === 1, "key payload conflict");
  f = fixture(); f.failure = "BEFORE"; result = f.run();
  check(result.status === "RECEIPT_CAPTURED" && f.receiptCount() === 1 && f.ledger.length === 0, "receipt survives movement failure");
  var receiptId = result.receiptId; f.failure = ""; result = f.run();
  check(result.status === "OPERATIONAL_POSTED" && result.receiptId === receiptId && result.writeCount === 1 && f.receiptCount() === 1, "resume existing receipt");
  f = fixture(); f.failure = "AFTER"; result = f.run();
  check(result.status === "OPERATIONAL_POSTED" && f.ledger.length === 1, "lost response reconciled");
  check(f.run().writeCount === 0, "lost response retry writes0");
  f = fixture(); f.failure = "UNREADABLE"; result = f.run();
  check(result.status === "WRITE_UNCERTAIN" && result.requestKey === f.request.requestKey && result.reconciliationRequired && f.movementAttempts === 1, "uncertain no blind append");
  f.failure = ""; check(f.run().writeCount === 0 && f.ledger.length === 1, "uncertain next call physical reconciliation");
  f = fixture(); f.capture.failure = "AFTER_WRITE"; result = f.run();
  check(result.status === "WRITE_UNCERTAIN" && result.receiptId && result.lineId && result.movementId && f.receiptCount() === 1 && f.movementAttempts === 0, "uncertain receipt stops posting");
  check(f.run().status === "OPERATIONAL_POSTED" && f.receiptCount() === 1, "uncertain receipt retry uses stored binding");
  function refused(mutator, label) {
    var x = fixture(); mutator(x); var r = x.run();
    check(!r.success && r.writeCount === 0 && x.receiptCount() === 0 && x.movementAttempts === 0 && r.tabopsWrites === 0, label);
  }
  refused(function(x) { x.runtime.environment = "PRODUCTION"; }, "production disabled");
  refused(function(x) { x.activation.enabled = false; }, "fixture disabled");
  refused(function(x) { x.activation.evidenceFingerprint = ""; }, "activation evidence required");
  refused(function(x) { x.activation.routingVersion = "STALE"; }, "routing config mismatch");
  refused(function(x) { x.request.requestKey = ""; }, "key before mutation");
  refused(function(x) { x.request.expenseItemId = "OSS01"; }, "Expense ID field not accepted on receipt");
  refused(function(x) { delete x.request.input.ItemID; }, "ItemID required");
  refused(function(x) { x.request.input.ItemID = "INVALID"; }, "invalid item");
  refused(function(x) { x.request.transactionType = "EXPENSE"; }, "Expense intent cannot create receipt");
  refused(function(x) { x.items.find(function(i) { return i.ItemID === "ING-018"; }).IsActive = false; }, "inactive item");
  refused(function(x) { x.items.find(function(i) { return i.ItemID === "ING-018"; }).EffectiveFrom = "2026-10-02"; }, "date applicable item");
  refused(function(x) { x.request.input.ItemID = "ING-001"; }, "client item mismatch");
  refused(function(x) { x.conversions = []; }, "missing conversion");
  refused(function(x) { x.request.input.PurchaseUOM = "bag"; }, "ungoverned conversion");
  refused(function(x) { x.request.input.ReceiptDate = "2026-09-30"; }, "preactivation");
  f = fixture(); result = f.run();
  check(result.status === "OPERATIONAL_POSTED" && result.tabopsWrites === 0, "direct inventory intent exclusively receipt without Expense registry");
  check(result.accountingPostingAllowed === false && result.BalanceLedgerWrites === 0 && result.Account1100Mutation === false &&
    result.cashAPInference === false && result.recipeConsumptionAllowed === false && result.openingRequired === false, "accounting isolation");
  var projected = result.data;
  check(projected.transactionType === "InventoryReceipt" && projected.financialTotalsIncluded === false &&
    !('expense' in projected) && !('revenue' in projected) && !('margin' in projected) && !('Attestation' in projected), "typed operational-only DTO");
  check(filterTransactionsPeriodRows([projected], {}, "expenses").length === 0 &&
    filterTransactionsPeriodRows([projected], {}, "sales").length === 0, "financial transaction tabs exclude receipt");
  var receiptRows; f.runtime.lock.waitLock(30000);
  try { receiptRows = inventoryReceiptReadSheet_(f.capture.spreadsheet).rows; } finally { f.runtime.lock.releaseLock(); }
  var context = { items: f.items, receipts: receiptRows, activation: f.activation }, original = clone(f.ledger[0]);
  var correction = { action: "VOID", requestKey: "correction-001", reason: "Wrong delivery", date: "2026-10-02" };
  var reversal = buildInventoryReceiptReversal_(correction, original, f.ledger, context);
  check(reversal.candidate.QtyOut === "12" && reversal.candidate.TotalCost === 10001 && reversal.candidate.UnitCost === original.UnitCost, "exact original quantity/value");
  check(reversal.candidate.ReversalOfMovementID === original.ID_Movement && reversal.mutationAllowed === false, "reversal linkage disabled");
  context.currentMWA = 999999;
  check(JSON.stringify(buildInventoryReceiptReversal_(correction, original, f.ledger, context)) === JSON.stringify(reversal), "current MWA irrelevant");
  var withReversal = f.ledger.concat([reversal.candidate]);
  check(buildInventoryReceiptReversal_(correction, original, withReversal, context).status === "EXISTING", "idempotent reversal candidate");
  throws(function() { buildInventoryReceiptReversal_(Object.assign({}, correction, { requestKey: "correction-002" }), original, withReversal, context); }, "one reversal maximum");
  throws(function() { buildInventoryReceiptReversal_(Object.assign({}, correction, { reason: "Changed" }), original, withReversal, context); }, "correction payload conflict");
  throws(function() { buildInventoryReceiptReversal_(Object.assign({}, correction, { action: "VOID_AND_REPLACE" }), original, f.ledger, context); }, "replacement identity required");
  check(buildInventoryReceiptReversal_(Object.assign({}, correction, { action: "VOID_AND_REPLACE", replacementRequestKey: "replacement-001" }), original, f.ledger, context).mutationAllowed === false, "void replace structural only");
  check(JSON.stringify(f.ledger[0]) === JSON.stringify(original), "immutable original");
  throws(function() { captureInventoryReceiptUnderLock_({}, f.capture, { active: true, lock: {} }); }, "invalid held lock refused");
  check(JSON.stringify(authority) === baseline, "authority preserved");
  Logger.log("PASS: testInventoryReceiptOrchestrationContracts | checks=" + count);
  return { status: "PASS", checks: count };
}
