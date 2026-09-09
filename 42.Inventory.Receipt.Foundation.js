// Local foundation only. Private functions: no google.script.run entry point or live service factory.
var INVENTORY_RECEIPT_POLICY = Object.freeze({
  VERSION: "11V.1", SHEET: "InventoryReceipts", LOCATION: "MAIN", POSTING_ALLOWED: false,
  HEADERS: Object.freeze(["ReceiptID", "LineID", "Revision", "ReceiptDate", "ItemID", "Location",
    "PurchaseQty", "PurchaseUOM", "ConversionID", "ConversionNumerator", "ConversionDenominator",
    "ConversionSnapshot", "BaseUOM", "BaseQtyReceived", "AcquisitionValue", "UnitCostRatio",
    "SupplierSource", "EvidenceRef", "ExternalRef", "Attestation", "ZeroCostClassification",
    "Status", "ReadinessReason", "IdempotencyKey", "NormalizedPayload", "ChangeReason",
    "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy", "IsActive"])
});

function inventoryReceiptText_(value) { return String(value == null ? "" : value).trim(); }
function inventoryReceiptClone_(value) { return JSON.parse(JSON.stringify(value)); }
function inventoryReceiptFail_(code) { throw new Error(code); }

// Safe integer rational arithmetic: reject overflow rather than silently losing decimal authority.
function inventoryReceiptRatio_(n, d) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || n < 0 || d <= 0) inventoryReceiptFail_("PRECISION_OVERFLOW");
  var a = n, b = d;
  while (b) { var remainder = a % b; a = b; b = remainder; }
  return { n: n / a, d: d / a };
}
function inventoryReceiptDecimal_(value, places) {
  var text = inventoryReceiptText_(value);
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(text)) inventoryReceiptFail_("INVALID_DECIMAL");
  var parts = text.split("."), decimals = (parts[1] || "").replace(/0+$/, "");
  if (decimals.length > places) inventoryReceiptFail_("PRECISION_EXCEEDED");
  return inventoryReceiptRatio_(Number(parts[0] + decimals), Math.pow(10, decimals.length));
}
function inventoryReceiptMultiply_(a, b) {
  var left = inventoryReceiptRatio_(a.n, b.d), right = inventoryReceiptRatio_(b.n, a.d);
  return inventoryReceiptRatio_(left.n * right.n, left.d * right.d);
}
function inventoryReceiptDecimalText_(ratio) {
  var denominator = ratio.d, twos = 0, fives = 0;
  while (denominator % 2 === 0) { denominator /= 2; twos++; }
  while (denominator % 5 === 0) { denominator /= 5; fives++; }
  var places = Math.max(twos, fives);
  if (denominator !== 1 || places > 6) inventoryReceiptFail_("BASE_QUANTITY_PRECISION_EXCEEDED");
  var scaled = ratio.n * (Math.pow(10, places) / ratio.d);
  if (!Number.isSafeInteger(scaled)) inventoryReceiptFail_("PRECISION_OVERFLOW");
  var digits = String(scaled);
  while (digits.length <= places) digits = "0" + digits;
  return places ? (digits.slice(0, -places) + "." + digits.slice(-places)).replace(/0+$/, "").replace(/\.$/, "") : digits;
}

function normalizeInventoryReceiptInput_(input) {
  input = input || {};
  var fields = ["ReceiptDate", "ItemID", "PurchaseQty", "PurchaseUOM", "AcquisitionValue", "SupplierSource",
    "ExternalRef", "ExternalDocumentStatus", "ZeroCostClassification", "ZeroCostEvidence", "PackageIdentity", "SupplierRef"];
  var result = {};
  fields.forEach(function(key) { result[key] = inventoryReceiptText_(input[key]); });
  Object.keys(input).forEach(function(key) {
    if (fields.indexOf(key) === -1 && ["Attested", "Draft"].indexOf(key) === -1) inventoryReceiptFail_("UNKNOWN_INPUT_FIELD:" + key);
  });
  if (input.Attested !== undefined && typeof input.Attested !== "boolean" ||
      input.Draft !== undefined && typeof input.Draft !== "boolean") inventoryReceiptFail_("INVALID_BOOLEAN");
  result.Attested = input.Attested === true; result.Draft = input.Draft === true;
  result.PurchaseUOM = result.PurchaseUOM.toLowerCase();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.ReceiptDate) || !capitalEquityDateKey(result.ReceiptDate)) inventoryReceiptFail_("INVALID_RECEIPT_DATE");
  var quantity = inventoryReceiptDecimal_(result.PurchaseQty, 6);
  if (quantity.n <= 0) inventoryReceiptFail_("INVALID_RECEIPT_QUANTITY");
  result.PurchaseQty = inventoryReceiptDecimalText_(quantity);
  if (result.AcquisitionValue !== "") result.AcquisitionValue = inventoryReceiptDecimalText_(inventoryReceiptDecimal_(result.AcquisitionValue, 0));
  if (!result.ItemID || !result.PurchaseUOM) inventoryReceiptFail_("MISSING_ITEM_OR_UOM");
  if (result.PurchaseUOM === "purchase lot") inventoryReceiptFail_("UNSUPPORTED_PURCHASE_LOT");
  return result;
}

function deriveInventoryReceipt_(payload, authority) {
  var p = normalizeInventoryReceiptInput_(payload), items = authority.items || [], conversions = authority.conversions || [];
  var index = inventoryItemIndex(items), item = index.items[p.ItemID];
  if (!item || index.duplicates[p.ItemID] || !isCanonicalActive(item.IsActive) ||
      !capitalEquityDateKey(item.EffectiveFrom) || capitalEquityDateKey(item.EffectiveFrom) > p.ReceiptDate ||
      item.EffectiveTo && (!capitalEquityDateKey(item.EffectiveTo) || capitalEquityDateKey(item.EffectiveTo) < p.ReceiptDate)) {
    inventoryReceiptFail_("ITEM_DATE_AUTHORITY_REQUIRED");
  }
  var readiness = classifyInventoryConversionReadiness(p.ItemID, p.ReceiptDate, items, conversions);
  var conversion = readiness.conversion, reasons = [], ratio = null, snapshot = "";
  if (!conversion) reasons.push("NEEDS_CONVERSION");
  if (readiness.status === "CONFLICT") reasons.push("CONFLICT");
  if (p.ItemID === "ING-018" && ["gr", "kg"].indexOf(p.PurchaseUOM) === -1) inventoryReceiptFail_("LEMON_MEASURED_MASS_REQUIRED");
  if (conversion) {
    var metric = (p.PurchaseUOM === item.BaseUOM && ["gr", "ml", "pcs"].indexOf(p.PurchaseUOM) !== -1) ||
      p.PurchaseUOM === "kg" && item.BaseUOM === "gr";
    if (metric) ratio = { n: p.PurchaseUOM === "kg" ? 1000 : 1, d: 1 };
    else {
      var from = p.PurchaseUOM === "kg" && p.ItemID === "ING-018" ? "gr" : p.PurchaseUOM;
      if (from !== String(conversion.FromUOM).toLowerCase()) inventoryReceiptFail_("UNGOVERNED_PURCHASE_UOM");
      ratio = inventoryReceiptMultiply_(inventoryReceiptDecimal_(conversion.Numerator, 10),
        (function() { var d = inventoryReceiptDecimal_(conversion.Denominator, 10); return { n: d.d, d: d.n }; })());
      if (p.PurchaseUOM === "kg") ratio = inventoryReceiptMultiply_(ratio, { n: 1000, d: 1 });
    }
    // A selected governed package identifies its supplier independently of the free-text purchase source.
    if (p.PackageIdentity && p.PackageIdentity !== conversion.PackageIdentity || p.SupplierRef && p.SupplierRef !== conversion.SupplierRef) {
      inventoryReceiptFail_("PACKAGE_AUTHORITY_MISMATCH");
    }
    snapshot = JSON.stringify({ version: "11V.1", authority: inventoryReceiptClone_(conversion),
      normalization: metric ? "DIRECT_METRIC" : "GOVERNED_CONVERSION", inputUOM: p.PurchaseUOM,
      appliedNumerator: ratio.n, appliedDenominator: ratio.d });
  }
  var quantity = ratio ? inventoryReceiptMultiply_(inventoryReceiptDecimal_(p.PurchaseQty, 6), ratio) : null;
  var baseQty = quantity ? inventoryReceiptDecimalText_(quantity) : "";
  if (!p.AcquisitionValue || p.AcquisitionValue === "0") reasons.push("NEEDS_COST");
  if (p.AcquisitionValue === "0" && (!p.ZeroCostClassification || !p.ZeroCostEvidence)) inventoryReceiptFail_("ZERO_COST_EXCEPTION_REQUIRED");
  var external = !!p.ExternalRef;
  if (external && p.ExternalDocumentStatus !== "AVAILABLE" || !external && p.ExternalDocumentStatus !== "EXTERNAL_DOCUMENT_UNAVAILABLE" ||
      !p.Attested || !p.SupplierSource || p.AcquisitionValue === "") reasons.push("NEEDS_EVIDENCE");
  var unitCost = quantity && p.AcquisitionValue !== "" ? inventoryReceiptMultiply_(inventoryReceiptDecimal_(p.AcquisitionValue, 0),
    { n: quantity.d, d: quantity.n }) : null;
  return { payload: p, row: { ReceiptDate: p.ReceiptDate, ItemID: p.ItemID, Location: INVENTORY_RECEIPT_POLICY.LOCATION,
    PurchaseQty: p.PurchaseQty, PurchaseUOM: p.PurchaseUOM, ConversionID: conversion ? conversion.ConversionID : "",
    ConversionNumerator: conversion ? String(conversion.Numerator) : "", ConversionDenominator: conversion ? String(conversion.Denominator) : "",
    ConversionSnapshot: snapshot, BaseUOM: item.BaseUOM, BaseQtyReceived: baseQty, AcquisitionValue: p.AcquisitionValue,
    UnitCostRatio: unitCost ? unitCost.n + "/" + unitCost.d : "", SupplierSource: p.SupplierSource, ExternalRef: p.ExternalRef,
    ZeroCostClassification: p.ZeroCostClassification,
    Status: p.Draft ? "DRAFT" : reasons.length ? "PENDING" : "READY",
    ReadinessReason: reasons.concat(["NEEDS_OPENING", "NEEDS_ACCOUNTING", "ACTIVATION_PENDING"]).join("|"), IsActive: true } };
}

function inventoryReceiptResult_(status, row, writes) {
  return { status: status, row: row ? inventoryReceiptClone_(row) : null, writeCount: writes || 0,
    captureReady: !!row && row.Status === "READY" && row.IsActive === true,
    operationalPostingAllowed: false, operationalPostingReasons: ["ACTIVATION_PENDING"],
    accountingPostingAllowed: false, accountingPostingReasons: ["NEEDS_ACCOUNTING"],
    // Legacy postingAllowed/reasons remain capture-era compatibility fields only.
    postingAllowed: false, postingReasons: ["NEEDS_OPENING", "NEEDS_ACCOUNTING", "ACTIVATION_PENDING"],
    InventoryLedgerWrites: 0, BalanceLedgerWrites: 0, Account1100Mutation: false, MWAMutation: false, tabopsWrites: 0 };
}

function inventoryReceiptReadSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(INVENTORY_RECEIPT_POLICY.SHEET);
  if (!sheet) return { sheet: null, values: [], rows: [] };
  var range = sheet.getDataRange(), values = range.getValues(), formulas = range.getFormulas();
  if (formulas.some(function(row) { return row.some(function(cell) { return !!cell; }); })) inventoryReceiptFail_("RECEIPT_FORMULA_REFUSED");
  if (sheet.getLastRow() === 0) return { sheet: sheet, values: [], rows: [] };
  var headers = INVENTORY_RECEIPT_POLICY.HEADERS;
  if (JSON.stringify(values[0]) !== JSON.stringify(headers)) inventoryReceiptFail_("RECEIPT_SCHEMA_DRIFT");
  var rows = values.slice(1).map(function(values) {
    var row = {}; headers.forEach(function(key, index) { row[key] = values[index]; }); return row;
  });
  return { sheet: sheet, values: values, rows: rows };
}

// Injected spreadsheet/lock only. No production factory or executable migration wrapper exists.
// Recovery is forward-only, using the exact sheet ID returned after this migration created it.
function migrateInventoryReceiptSchema_(runtime, recovery) {
  runtime.lock.waitLock(30000);
  var writes = 0, createdId = null;
  try {
    var state = inventoryReceiptReadSheet_(runtime.spreadsheet);
    if (state.values.length) {
      if (state.rows.length) inventoryReceiptFail_("MIGRATION_BUSINESS_ROWS_PRESENT");
      return inventoryReceiptResult_("ALREADY_MIGRATED", null, 0);
    }
    if (state.sheet) {
      if (!recovery || recovery.migration !== "11V.1" || recovery.sheetId !== state.sheet.getSheetId()) inventoryReceiptFail_("UNOWNED_EMPTY_SHEET");
    } else {
      if (recovery) inventoryReceiptFail_("RECOVERY_TARGET_MISSING");
      writes++; state.sheet = runtime.spreadsheet.insertSheet(INVENTORY_RECEIPT_POLICY.SHEET);
      createdId = state.sheet.getSheetId();
    }
    var sheet = state.sheet, width = INVENTORY_RECEIPT_POLICY.HEADERS.length;
    if (sheet.getMaxColumns() < width) { writes++; sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns()); }
    writes++; sheet.getRange(1, 1, 1, width).setValues([INVENTORY_RECEIPT_POLICY.HEADERS.slice()]);
    var after = inventoryReceiptReadSheet_(runtime.spreadsheet);
    if (after.rows.length || after.values.length !== 1) inventoryReceiptFail_("MIGRATION_READBACK_FAILED");
    return inventoryReceiptResult_("MIGRATED", null, writes);
  } catch (error) {
    var result = inventoryReceiptResult_(writes ? "MIGRATION_UNCERTAIN" : "REFUSED", null, writes);
    result.reason = error.message;
    result.recovery = createdId !== null ? { migration: "11V.1", sheetId: createdId } : recovery || null;
    return result;
  } finally { runtime.lock.releaseLock(); }
}

function inventoryReceiptHistory_(rows) {
  var latest = Object.create(null), keys = Object.create(null), receiptIds = Object.create(null);
  rows.forEach(function(row) {
    var previous = latest[row.LineID];
    if (!row.ReceiptID || !row.LineID || !row.IdempotencyKey || keys[row.IdempotencyKey] ||
        !Number.isSafeInteger(row.Revision) || row.Revision !== (previous ? previous.Revision + 1 : 1) ||
        previous && (previous.ReceiptID !== row.ReceiptID || previous.IsActive !== true ||
          ["DRAFT", "PENDING", "READY"].indexOf(previous.Status) === -1) ||
        receiptIds[row.ReceiptID] && receiptIds[row.ReceiptID] !== row.LineID ||
        ["DRAFT", "PENDING", "READY", "POSTED", "REVERSED", "CONFLICT"].indexOf(row.Status) === -1 ||
        typeof row.IsActive !== "boolean" || !row.NormalizedPayload || !row.CreatedBy || !row.UpdatedBy ||
        inventoryTimestampMillis(row.CreatedAt) === null || inventoryTimestampMillis(row.UpdatedAt) === null ||
        previous && (row.CreatedAt !== previous.CreatedAt || row.CreatedBy !== previous.CreatedBy ||
          row.UpdatedAt < previous.UpdatedAt || !row.ChangeReason)) inventoryReceiptFail_("RECEIPT_HISTORY_CONFLICT");
    latest[row.LineID] = row; keys[row.IdempotencyKey] = row; receiptIds[row.ReceiptID] = row.LineID;
  });
  return { latest: latest, keys: keys, receiptIds: receiptIds };
}

function captureInventoryReceipt_(request, runtime) {
  runtime.lock.waitLock(30000);
  var scope = { lock: runtime.lock, active: true };
  try { return captureInventoryReceiptUnderLock_(request, runtime, scope); }
  finally { scope.active = false; runtime.lock.releaseLock(); }
}

function captureInventoryReceiptUnderLock_(request, runtime, scope) {
  requireInventoryReceiptLock_(runtime, scope);
  var attempted = false, writes = 0;
  try {
    request = request || {};
    Object.keys(request).forEach(function(key) {
      if (["action", "idempotencyKey", "lineId", "expectedRevision", "reason", "input", "routingBinding"].indexOf(key) === -1) inventoryReceiptFail_("UNKNOWN_REQUEST_FIELD");
    });
    var action = request.action || "CREATE", key = inventoryReceiptText_(request.idempotencyKey);
    if (["CREATE", "CORRECT", "CANCEL"].indexOf(action) === -1) inventoryReceiptFail_("POSTING_PROHIBITED");
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(key)) inventoryReceiptFail_("INVALID_IDEMPOTENCY_KEY");
    if (action === "CREATE" && (request.lineId || request.expectedRevision || request.reason)) inventoryReceiptFail_("INVALID_CREATE_TARGET");
    if (action === "CANCEL" && request.input !== undefined) inventoryReceiptFail_("CANCEL_INPUT_PROHIBITED");
    var normalized = { action: action, lineId: inventoryReceiptText_(request.lineId), expectedRevision: request.expectedRevision || 0,
      reason: inventoryReceiptText_(request.reason), input: action === "CANCEL" ? null : normalizeInventoryReceiptInput_(request.input) };
    if (request.routingBinding !== undefined) {
      var routing = request.routingBinding;
      if (action !== "CREATE" || !routing || !routing.expenseItemId || !routing.routingVersion ||
          routing.itemId !== normalized.input.ItemID) inventoryReceiptFail_("INVALID_ROUTING_BINDING");
      normalized.routing = { expenseItemId: routing.expenseItemId, routingVersion: routing.routingVersion, itemId: routing.itemId };
    }
    var binding = JSON.stringify(normalized);
    var state = inventoryReceiptReadSheet_(runtime.spreadsheet);
    if (!state.sheet || !state.values.length) inventoryReceiptFail_("RECEIPT_SCHEMA_REQUIRED");
    var history = inventoryReceiptHistory_(state.rows), existing = history.keys[key];
    if (existing) {
      var retry = inventoryReceiptResult_(existing.NormalizedPayload === binding ? "EXISTING" : "CONFLICT", existing, 0);
      retry.current = inventoryReceiptClone_(history.latest[existing.LineID]);
      retry.captureReady = retry.current.Status === "READY" && retry.current.IsActive === true;
      if (retry.status === "CONFLICT") { retry.reason = "CONFLICT"; retry.captureReady = false; }
      return retry;
    }
    var timestamp = runtime.now(), actor = inventoryReceiptText_(runtime.actor());
    if (inventoryTimestampMillis(timestamp) === null || !actor) inventoryReceiptFail_("TRUSTED_AUDIT_CONTEXT_REQUIRED");
    timestamp = new Date(timestamp).toISOString();
    var previous = history.latest[normalized.lineId], row;
    if (action !== "CREATE") {
      if (!previous || previous.Revision !== normalized.expectedRevision) inventoryReceiptFail_("STALE_RECEIPT_REVISION");
      inventoryReceiptRequireUnposted_(runtime.spreadsheet, previous);
      if (!normalized.reason || previous.IsActive !== true || ["DRAFT", "PENDING", "READY"].indexOf(previous.Status) === -1 ||
          action === "CORRECT" && previous.Status === "READY") inventoryReceiptFail_("IMMUTABLE_RECEIPT");
      if (timestamp < previous.UpdatedAt) inventoryReceiptFail_("AUDIT_CLOCK_REGRESSION");
    }
    if (action === "CANCEL") {
      row = inventoryReceiptClone_(previous); row.IsActive = false;
    } else {
      var derived = deriveInventoryReceipt_(normalized.input, runtime.authority()); row = derived.row;
      var attestation = { version: "RECEIVED_GOODS_V1", attested: derived.payload.Attested,
        statement: "I attest actual goods received, item, quantity, package/UOM, receipt date, acquisition cost and supplier/source in this payload.",
        payload: derived.payload, actor: actor, timestamp: timestamp };
      row.Attestation = JSON.stringify(attestation);
    }
    if (previous) {
      row.ReceiptID = previous.ReceiptID; row.LineID = previous.LineID; row.Revision = previous.Revision + 1;
      row.CreatedAt = previous.CreatedAt; row.CreatedBy = previous.CreatedBy;
    } else {
      var token = inventoryReceiptText_(runtime.uuid());
      if (!/^[A-Za-z0-9-]{12,64}$/.test(token) || history.receiptIds["RCPT-" + token] || history.latest["RLINE-" + token]) inventoryReceiptFail_("ID_COLLISION");
      row.ReceiptID = "RCPT-" + token; row.LineID = "RLINE-" + token; row.Revision = 1;
      row.CreatedAt = timestamp; row.CreatedBy = actor;
    }
    if (action !== "CANCEL") row.EvidenceRef = normalized.input.Attested ? "ATTEST:" + row.LineID + ":R" + row.Revision : "";
    row.UpdatedAt = timestamp; row.UpdatedBy = actor; row.ChangeReason = normalized.reason;
    row.IdempotencyKey = key; row.NormalizedPayload = binding;
    var values = INVENTORY_RECEIPT_POLICY.HEADERS.map(function(field) {
      var value = row[field];
      if (value === undefined) inventoryReceiptFail_("MISSING_STORED_FIELD:" + field);
      if (typeof value === "string" && (/^[=+@-]/.test(value) || value.length > 45000)) inventoryReceiptFail_("UNSAFE_CELL_TEXT");
      return value;
    });
    var fresh = inventoryReceiptReadSheet_(runtime.spreadsheet);
    if (fresh.sheet.getSheetId() !== state.sheet.getSheetId() || JSON.stringify(fresh.values) !== JSON.stringify(state.values)) {
      inventoryReceiptFail_("RECEIPT_CHANGED_BEFORE_WRITE");
    }
    var target = state.sheet.getRange(state.values.length + 1, 1, 1, values.length);
    // Preserve ISO dates and decimal strings through Sheets coercion. Revision remains a number.
    attempted = true; writes++; target.setNumberFormat("@");
    writes++; target.setValues([values]);
    var after = inventoryReceiptReadSheet_(runtime.spreadsheet);
    if (after.rows.length !== state.rows.length + 1 || JSON.stringify(after.values[after.values.length - 1]) !== JSON.stringify(values)) {
      inventoryReceiptFail_("RECEIPT_READBACK_FAILED");
    }
    return inventoryReceiptResult_(action === "CANCEL" ? "CANCELLED" : "CAPTURED", row, writes);
  } catch (error) {
    var result = inventoryReceiptResult_(attempted ? "WRITE_UNCERTAIN" : "REFUSED", attempted ? row : null, writes);
    result.reason = error.message; return result;
  }
}

// Prospective guard only; no call from existing expense entry/routing.
function guardInventoryReceiptRoute_(intent, destinations) {
  var valid = intent === "INVENTORY_RECEIPT" && Array.isArray(destinations) && destinations.length === 1 &&
    destinations[0] === INVENTORY_RECEIPT_POLICY.SHEET;
  return { status: valid ? "PASS" : "REFUSED", activated: false, expenseAllowed: false, postingAllowed: false };
}

// Runs under the same ScriptLock as capture. Missing ledger means no movement yet;
// malformed or unreadable ledger fails closed before any capture lifecycle write.
function inventoryReceiptRequireUnposted_(spreadsheet, receipt) {
  var sheet = spreadsheet.getSheetByName("InventoryLedger");
  if (!sheet) return;
  var range = sheet.getDataRange(), values = range.getValues();
  if (range.getFormulas().some(function(row) { return row.some(function(cell) { return !!cell; }); }) ||
      JSON.stringify(values[0]) !== JSON.stringify(BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS)) inventoryReceiptFail_("LEDGER_SCHEMA_OR_FORMULA_CONFLICT");
  var rows = balanceFoundationRowsFromValues(values);
  rows.forEach(function(row) {
    if (row.SourceType !== "INVENTORY_RECEIPT_OPERATIONAL_V1") return;
    var source = JSON.parse(row.SourceID);
    if (!Array.isArray(source) || source.length !== 3 || !source[0] || !source[1] || !Number.isSafeInteger(source[2]) || source[2] < 1) inventoryReceiptFail_("LEDGER_SOURCE_CONFLICT");
    if (source[0] === receipt.ReceiptID || source[1] === receipt.LineID) inventoryReceiptFail_("OPERATIONAL_REVERSAL_OR_CORRECTION_REQUIRED");
  });
}
