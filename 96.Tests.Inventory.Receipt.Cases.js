// Fixture-only persistence. All sheet reads and writes are recorded; forbidden surfaces throw.
function inventoryReceiptTestRuntime_(authority) {
  var sheets = {}, calls = [], serial = 0, locked = false;
  var runtime = { calls: calls, sheets: sheets, failure: "", uuidCount: 0,
    lock: { waitLock: function() { if (locked) throw new Error("LOCK_BUSY"); locked = true; },
      releaseLock: function() { locked = false; } },
    now: function() { return "2026-10-01T12:00:00Z"; }, actor: function() { return "TEST_OPERATOR"; },
    uuid: function() { runtime.uuidCount++; return "TEST-UUID-000000-" + runtime.uuidCount; },
    authority: function() { return inventoryReceiptClone_(authority); } };
  function access(name) {
    if (!locked) throw new Error("LOCK_REQUIRED");
    if (name === "InventoryLedger") return;
    if (name !== "InventoryReceipts") throw new Error("FORBIDDEN_SURFACE:" + name);
  }
  runtime.makeSheet = function(name, grid) {
    var sheet = { grid: inventoryReceiptClone_(grid), columns: 26, id: ++serial,
      getSheetId: function() { return sheet.id; }, getMaxColumns: function() { return sheet.columns; },
      insertColumnsAfter: function(start, count) { access(name); calls.push([name, "columns"]); sheet.columns += count; },
      getLastRow: function() { return sheet.grid.length; },
      getDataRange: function() { return { getValues: function() {
        access(name); return inventoryReceiptClone_(sheet.grid);
      }, getFormulas: function() { return sheet.grid.map(function(row) { return row.map(function() { return sheet.formula ? "=1" : ""; }); }); } }; },
      getRange: function(row, column, count, width) { return { setNumberFormat: function(format) { access(name); if (format !== "@") throw new Error("TEXT_FORMAT_REQUIRED"); calls.push([name, "format", row]); }, setValues: function(values) {
        access(name); calls.push([name, "values", row]);
        if (runtime.failure === "BEFORE_WRITE") { runtime.failure = ""; throw new Error("SIMULATED_BEFORE_WRITE"); }
        if (column !== 1 || count !== 1 || width !== INVENTORY_RECEIPT_POLICY.HEADERS.length) throw new Error("INVALID_WRITE_RANGE");
        sheet.grid[row - 1] = inventoryReceiptClone_(values[0]);
        if (runtime.failure === "AFTER_WRITE") { runtime.failure = ""; throw new Error("SIMULATED_AFTER_WRITE"); }
      } }; } };
    sheets[name] = sheet; return sheet;
  };
  runtime.spreadsheet = {
    getSheetByName: function(name) { access(name); return sheets[name] || null; },
    insertSheet: function(name) { access(name); calls.push([name, "create"]); return runtime.makeSheet(name, []); }
  };
  return runtime;
}

function testInventoryReceiptFoundationContracts(authority) {
  if (!authority) throw new Error("LOCAL_FROZEN_AUTHORITY_FIXTURE_REQUIRED");
  var count = 0, baseline = JSON.stringify(authority);
  function check(value, label) { count++; if (!value) throw new Error("Receipt: " + label); }
  function clone(value) { return inventoryReceiptClone_(value); }
  var input = { ReceiptDate: "2026-10-01", ItemID: "ING-018", PurchaseQty: "500", PurchaseUOM: "gr",
    AcquisitionValue: "10001", SupplierSource: "TEST_SOURCE", Attested: true,
    ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE" };
  function derive(patch, source) { return deriveInventoryReceipt_(Object.assign({}, input, patch || {}), source || authority).row; }
  function throws(patch, code, source) {
    var message = ""; try { derive(patch, source); } catch (error) { message = error.message; }
    check(message.indexOf(code) !== -1, code);
  }
  check(authority.conversions.length === 22 && validateInventoryUomConversions(authority.conversions, authority.items).status === "PASS", "22 governed authorities");
  check(derive().BaseQtyReceived === "12", "Lemon 500 gr");
  check(derive({ PurchaseQty: "0.5", PurchaseUOM: "KG" }).BaseQtyReceived === "12", "Lemon 0.5 kg");
  check(derive({ PurchaseQty: "0.125" }).BaseQtyReceived === "0.003", "fractional slice exact");
  check(derive().UnitCostRatio === "10001/12", "unit cost not rounded");
  throws({ PurchaseUOM: "bag" }, "LEMON_MEASURED_MASS_REQUIRED");
  throws({ PurchaseUOM: "purchase lot" }, "UNSUPPORTED_PURCHASE_LOT");
  ["0", "-1", "NaN", "Infinity", true, "1e3"].forEach(function(q) { throws({ PurchaseQty: q }, q === "0" ? "INVALID_RECEIPT_QUANTITY" : "INVALID_DECIMAL"); });
  throws({ PurchaseQty: "0.0000001" }, "PRECISION_EXCEEDED");
  throws({ PurchaseQty: "0.000001" }, "BASE_QUANTITY_PRECISION_EXCEEDED");
  ["-1", "1.1", true, "NaN"].forEach(function(cost) { throws({ AcquisitionValue: cost }, cost === "1.1" ? "PRECISION_EXCEEDED" : "INVALID_DECIMAL"); });
  throws({ AcquisitionValue: "9007199254740992" }, "PRECISION_OVERFLOW");
  throws({ AcquisitionValue: "0" }, "ZERO_COST_EXCEPTION_REQUIRED");
  check(derive({ AcquisitionValue: "0", ZeroCostClassification: "GIFT", ZeroCostEvidence: "TEST:GIFT" }).Status === "PENDING", "zero cost exception stays pending");
  check(derive({ AcquisitionValue: "" }).ReadinessReason.indexOf("NEEDS_COST") !== -1, "missing cost");
  check(derive({ Attested: false }).ReadinessReason.indexOf("NEEDS_EVIDENCE") !== -1, "attestation required");
  check(derive({ SupplierSource: "" }).Status === "PENDING", "source required");
  check(derive({ ExternalDocumentStatus: "" }).Status === "PENDING", "unavailable must be explicit");
  check(derive({ ExternalRef: "TEST:INVOICE", ExternalDocumentStatus: "AVAILABLE" }).Status === "READY", "external evidence plus attestation");
  check(derive({ ExternalRef: "TEST:INVOICE", ExternalDocumentStatus: "AVAILABLE", Attested: false }).Status === "PENDING", "invoice alone not attestation");
  check(derive({ Draft: true }).Status === "DRAFT", "explicit draft");
  var missing = clone(authority); missing.conversions = [];
  check(derive({}, missing).ReadinessReason.indexOf("NEEDS_CONVERSION") !== -1, "missing conversion");
  var inactive = clone(authority); inactive.conversions.forEach(function(c) { c.IsActive = false; });
  check(derive({}, inactive).Status === "PENDING", "inactive conversion");
  check(derive({ ReceiptDate: "2026-09-30" }).ConversionID === "", "before effective date");
  var invalidItem = clone(authority); invalidItem.items.find(function(i) { return i.ItemID === "ING-018"; }).EffectiveFrom = "2026-10-02";
  throws({}, "ITEM_DATE_AUTHORITY_REQUIRED", invalidItem);
  throws({ ReceiptDate: "2026-02-30" }, "INVALID_RECEIPT_DATE");
  [["ING-009", "carton", "12000"], ["ING-006", "bag", "1000"], ["ING-032", "pack", "25"]].forEach(function(example) {
    check(derive({ ItemID: example[0], PurchaseUOM: example[1], PurchaseQty: "1" }).BaseQtyReceived === example[2], "independent package example " + example[0]);
  });
  var inactiveItem = clone(authority); inactiveItem.items.find(function(i) { return i.ItemID === "ING-018"; }).IsActive = false;
  throws({}, "ITEM_DATE_AUTHORITY_REQUIRED", inactiveItem);
  var ambiguous = clone(authority); ambiguous.conversions.push(clone(ambiguous.conversions.find(function(c) { return c.ItemID === "ING-018"; })));
  check(derive({}, ambiguous).ReadinessReason.indexOf("CONFLICT") !== -1, "ambiguous authority pending conflict");
  var metricMissing = clone(authority); metricMissing.conversions = [];
  check(derive({ ItemID: "ING-006", PurchaseUOM: "kg", PurchaseQty: "1" }, metricMissing).ConversionSnapshot === "", "metric cannot bypass conversion authority");
  var metricCovered = {};
  authority.conversions.forEach(function(conversion) {
    if (conversion.ItemID === "ING-018") return;
    var p = { ItemID: conversion.ItemID, PurchaseQty: "1", PurchaseUOM: conversion.FromUOM };
    var row = derive(p);
    check(Number(row.BaseQtyReceived) === Number(conversion.Numerator) / Number(conversion.Denominator), "governed package " + conversion.ItemID);
    check(JSON.parse(row.ConversionSnapshot).authority.PackageIdentity === conversion.PackageIdentity, "package identity snapshot");
    throws(Object.assign({}, p, { PackageIdentity: "WRONG" }), "PACKAGE_AUTHORITY_MISMATCH");
    if (["gr", "ml", "pcs"].indexOf(conversion.ToUOM) !== -1) {
      check(derive(Object.assign({}, p, { PurchaseUOM: conversion.ToUOM, PurchaseQty: "2" })).BaseQtyReceived === "2", "direct " + conversion.ToUOM);
      metricCovered[conversion.ToUOM] = true;
    }
    if (conversion.ToUOM === "gr") check(derive(Object.assign({}, p, { PurchaseUOM: "kg", PurchaseQty: "0.5" })).BaseQtyReceived === "500", "kg to gr");
  });
  check(metricCovered.gr && metricCovered.ml && metricCovered.pcs, "all direct metric families tested");
  var runtime = inventoryReceiptTestRuntime_(authority);
  check(migrateInventoryReceiptSchema_(runtime).status === "MIGRATED", "schema creation");
  var callCount = runtime.calls.length;
  check(migrateInventoryReceiptSchema_(runtime).status === "ALREADY_MIGRATED" && runtime.calls.length === callCount, "schema idempotency");
  function command(key, patch) { return Object.assign({ idempotencyKey: key, input: clone(input) }, patch || {}); }
  var original = captureInventoryReceipt_(command("capture-0001"), runtime);
  check(original.status === "CAPTURED" && original.row.Status === "READY" && original.captureReady, "valid capture");
  check(original.row.ReadinessReason === "NEEDS_OPENING|NEEDS_ACCOUNTING|ACTIVATION_PENDING" && !original.postingAllowed, "opening unresolved capture ready only");
  check(/^ATTEST:/.test(original.row.EvidenceRef) && JSON.parse(original.row.Attestation).payload.Attested, "immutable attestation not bare ID");
  callCount = runtime.calls.length;
  runtime.authority = function() { throw new Error("RETRY_MUST_NOT_REINTERPRET_AUTHORITY"); };
  var retry = captureInventoryReceipt_(command("capture-0001", { input: Object.assign({}, input, { PurchaseQty: "500.000" }) }), runtime);
  check(retry.status === "EXISTING" && runtime.uuidCount === 1 && runtime.calls.length === callCount, "normalized retry no write or ID");
  check(retry.row.ConversionSnapshot === original.row.ConversionSnapshot, "snapshot retained without live authority");
  check(captureInventoryReceipt_(command("capture-0001", { input: Object.assign({}, input, { AcquisitionValue: "99" }) }), runtime).status === "CONFLICT", "key payload conflict");
  check(runtime.calls.length === callCount, "conflict zero write");
  runtime.authority = function() { return clone(authority); };
  check(migrateInventoryReceiptSchema_(runtime).reason === "MIGRATION_BUSINESS_ROWS_PRESENT", "migration refuses receipt data");
  var pending = captureInventoryReceipt_(command("capture-0002", { input: Object.assign({}, input, { Attested: false }) }), runtime);
  var correction = { action: "CORRECT", lineId: pending.row.LineID, expectedRevision: 1, reason: "Correct measured weight", input: Object.assign({}, input, { PurchaseQty: "250" }) };
  var corrected = captureInventoryReceipt_(command("correct-0001", correction), runtime);
  check(corrected.status === "CAPTURED" && corrected.row.BaseQtyReceived === "6" && corrected.row.Revision === 2, "correction rederives");
  check(corrected.row.LineID === pending.row.LineID && corrected.row.ReceiptID === pending.row.ReceiptID && corrected.row.CreatedAt === pending.row.CreatedAt, "immutable IDs and creation audit");
  check(captureInventoryReceipt_(command("correct-0001", correction), runtime).status === "EXISTING", "correction retry");
  check(captureInventoryReceipt_(command("correct-0002", correction), runtime).reason === "STALE_RECEIPT_REVISION", "stale correction refusal");
  check(captureInventoryReceipt_(command("correct-0003", Object.assign({}, correction, { expectedRevision: 2 })), runtime).reason === "IMMUTABLE_RECEIPT", "READY corrections prohibited");
  var cancel = { action: "CANCEL", lineId: corrected.row.LineID, expectedRevision: 2, reason: "Duplicate actual receipt", idempotencyKey: "cancel-0001" };
  var cancelled = captureInventoryReceipt_(cancel, runtime);
  check(cancelled.status === "CANCELLED" && !cancelled.row.IsActive && cancelled.row.Status !== "REVERSED", "capture cancellation");
  check(!cancelled.captureReady && cancelled.row.ConversionSnapshot === corrected.row.ConversionSnapshot, "cancel snapshot retention");
  check(captureInventoryReceipt_(cancel, runtime).status === "EXISTING", "cancel retry");
  check(!captureInventoryReceipt_(command("correct-0001", correction), runtime).captureReady, "historical retry respects current cancellation");
  check(captureInventoryReceipt_(Object.assign({}, cancel, { idempotencyKey: "cancel-0002", expectedRevision: 3 }), runtime).reason === "IMMUTABLE_RECEIPT", "cancelled immutable");
  check(captureInventoryReceipt_(command("posting-0001", { action: "POST" }), runtime).reason === "POSTING_PROHIBITED", "posting prohibited");
  ["BEFORE_WRITE", "AFTER_WRITE"].forEach(function(failure, i) {
    var request = command("failure-000" + i); runtime.failure = failure;
    check(captureInventoryReceipt_(request, runtime).status === "WRITE_UNCERTAIN", failure + " uncertainty");
    var result = captureInventoryReceipt_(request, runtime);
    check(result.status === (i ? "EXISTING" : "CAPTURED"), failure + " retry recovery");
    var matches = runtime.sheets.InventoryReceipts.grid.filter(function(row) { return row[23] === request.idempotencyKey; });
    check(matches.length === 1, "one durable line after retry");
  });
  check(captureInventoryReceipt_(command("unsafe-0001", { input: Object.assign({}, input, { SupplierSource: "=IMPORTDATA(test)" }) }), runtime).reason === "UNSAFE_CELL_TEXT", "formula refusal");
  var draft = captureInventoryReceipt_(command("draft-000001", { input: Object.assign({}, input, { Draft: true }) }), runtime);
  var authorityChange = clone(authority); authorityChange.conversions = [];
  runtime.authority = function() { return authorityChange; };
  var redraft = captureInventoryReceipt_(command("draft-000002", { action: "CORRECT", lineId: draft.row.LineID,
    expectedRevision: 1, reason: "Recheck authority", input: clone(input) }), runtime);
  check(redraft.row.Status === "PENDING" && redraft.row.ConversionSnapshot === "", "correction revalidates changed authority");
  runtime.authority = function() { runtime.sheets.InventoryReceipts.grid[1][0] = "DRIFT"; return clone(authority); };
  var priorGrid = clone(runtime.sheets.InventoryReceipts.grid);
  check(captureInventoryReceipt_(command("drift-000001"), runtime).reason === "RECEIPT_CHANGED_BEFORE_WRITE", "fresh read detects drift");
  runtime.sheets.InventoryReceipts.grid = priorGrid;
  runtime.authority = function() { return clone(authority); };
  var durable = JSON.stringify(runtime.sheets.InventoryReceipts.grid);
  var persisted = runtime.sheets.InventoryReceipts.grid[1];
  var statusIndex = INVENTORY_RECEIPT_POLICY.HEADERS.indexOf("Status"); persisted[statusIndex] = "POSTED";
  check(captureInventoryReceipt_(Object.assign({}, cancel, { lineId: original.row.LineID, expectedRevision: 1, idempotencyKey: "posted-0001" }), runtime).reason === "IMMUTABLE_RECEIPT", "POSTED cannot mutate");
  runtime.sheets.InventoryReceipts.grid = JSON.parse(durable);
  check(runtime.calls.every(function(call) { return call[0] === "InventoryReceipts"; }), "only receipt storage touched");
  [original, corrected, cancelled, retry].forEach(function(result) {
    check(result.InventoryLedgerWrites === 0 && result.BalanceLedgerWrites === 0 && !result.Account1100Mutation && !result.MWAMutation && result.tabopsWrites === 0, "posting effects zero");
  });
  ["BEFORE_WRITE", "AFTER_WRITE"].forEach(function(failure) {
    var f = inventoryReceiptTestRuntime_(authority); f.failure = failure;
    var failed = migrateInventoryReceiptSchema_(f);
    check(failed.status === "MIGRATION_UNCERTAIN", "migration failure recorded");
    var recovered = migrateInventoryReceiptSchema_(f, failed.recovery);
    check(["MIGRATED", "ALREADY_MIGRATED"].indexOf(recovered.status) !== -1, "owned forward recovery");
  });
  var empty = inventoryReceiptTestRuntime_(authority); empty.makeSheet("InventoryReceipts", []);
  check(migrateInventoryReceiptSchema_(empty).reason === "UNOWNED_EMPTY_SHEET", "unowned empty refusal");
  check(migrateInventoryReceiptSchema_(empty, { migration: "11V.1", sheetId: 999 }).reason === "UNOWNED_EMPTY_SHEET", "wrong recovery ownership refusal");
  var drift = inventoryReceiptTestRuntime_(authority); drift.makeSheet("InventoryReceipts", [["WrongHeader"]]);
  check(migrateInventoryReceiptSchema_(drift).reason === "RECEIPT_SCHEMA_DRIFT", "header drift refusal");
  runtime.sheets.InventoryReceipts.formula = true;
  check(captureInventoryReceipt_(command("formula-0001"), runtime).reason === "RECEIPT_FORMULA_REFUSED", "formula storage refused");
  check(guardInventoryReceiptRoute_("INVENTORY_RECEIPT", ["InventoryReceipts"]).status === "PASS", "future route positive");
  [["InventoryReceipts", "tabops"], ["tabops"], ["BalanceLedger"], ["InventoryLedger"]].forEach(function(destinations) {
    check(guardInventoryReceiptRoute_("INVENTORY_RECEIPT", destinations).status === "REFUSED", "expense and posting route refused");
  });
  check(JSON.stringify(authority) === baseline, "all 22 authorities unchanged");
  Logger.log("testInventoryReceiptFoundationContracts: PASS (" + count + " scenarios)");
  return { status: "PASS", scenarios: count };
}
