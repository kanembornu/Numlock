// SALES_RECOGNITION_V2 U2 durable save core: normalize -> exact
// (OperationType, RequestKey) lookup -> gates -> freeze plan once -> persist
// OperationPlan IN_PROGRESS + exact readback -> ONE atomic Sheets REST batch
// (values:batchAppend) -> exact artifact verification -> operation commit.
// Reuses TransactionOperations (95A) interfaces; legacy behavior untouched.
// V2 stays disabled: default config is PREPARED, so the seam refuses with zero
// writes unless an explicit config is supplied to the injected runtime. No
// operator dispatch, no nested locks. Intent, batch, readback, and final commit
// are multistep: this adapter claims NO database-global atomicity; the single
// batch is atomic only across its five value ranges.
var SALES_RECOGNITION_V2_SAVE = Object.freeze({
  OPERATION_TYPE: "SALES_RECOGNITION_V2_SAVE",
  AUDIT_SHEET: "SalesRecognitionAudits",
  AUDIT_HEADERS: Object.freeze(["AuditID", "ContractVersion", "OperationID", "RequestKey",
    "OrderID", "RecognitionID", "JournalID", "PayloadHash", "Actor", "SavedAt"]),
  JOURNAL_ACCOUNTS: Object.freeze({ SETTLEMENT: "1030", REVENUE: "4000" }),
  JOURNAL_MOVEMENT_TYPE: "SALES_RECOGNITION",
  JOURNAL_SOURCE_TYPE: "SALES_RECOGNITION_V2",
  EVENT_TYPE: "RECOGNITION",
  POSTING_STATUS: "COMMITTED",
  PLAN_VERSION: 1,
  MAX_ORDER_LINES: 50,
  MAX_BATCH_CELLS: 4000,
  MAX_REQUEST_BYTES: 1000000,
  // The ONLY surfaces the save batch may ever touch. Payments, Settlements,
  // InventoryLedger, Cash, and Fulfillment writes are forbidden artifacts.
  WRITE_SURFACES: Object.freeze(["Orders", "OrderLines", "SalesRecognitionEvents",
    "BalanceLedger", "SalesRecognitionAudits"]),
  STATUS: Object.freeze({
    DONE: "DONE",
    REFUSED: "REFUSED",
    CONFLICT: "CONFLICT",
    UNKNOWN: "UNKNOWN",
    RECOVERY_REQUIRED: "RECOVERY_REQUIRED"
  }),
  CODES: Object.freeze({
    PAYLOAD_INVALID: "PAYLOAD_INVALID",
    SCHEMA_NOT_READY: "SALES_V2_SCHEMA_NOT_READY",
    COHORT_NOT_CLEAR: "SALES_V2_COHORT_NOT_CLEAR",
    OPERATION_PAYLOAD_CONFLICT: "OPERATION_PAYLOAD_CONFLICT",
    DUPLICATE_OPERATION_EVIDENCE: "DUPLICATE_OPERATION_EVIDENCE",
    BATCH_BOUNDS_EXCEEDED: "BATCH_BOUNDS_EXCEEDED",
    ARTIFACTS_INCOMPLETE: "ARTIFACTS_INCOMPLETE",
    IDENTITY_CONFLICT: "IDENTITY_CONFLICT",
    BATCH_OUTCOME_UNKNOWN: "BATCH_OUTCOME_UNKNOWN",
    READBACK_UNKNOWN: "READBACK_UNKNOWN",
    COMMIT_OUTCOME_UNKNOWN: "COMMIT_OUTCOME_UNKNOWN",
    SAVE_EXECUTION_UNKNOWN: "SAVE_EXECUTION_UNKNOWN",
    PLAN_MALFORMED: "PLAN_MALFORMED",
    INTENT_READBACK_FAILED: "INTENT_READBACK_FAILED",
    ECONOMIC_DATE_INVALID: "ECONOMIC_DATE_INVALID",
    PRODUCT_VARIANT_EFFECTIVE_WINDOW: "PRODUCT_VARIANT_EFFECTIVE_WINDOW"
  })
});

// Envelope result, never a { success: false } DTO. UNKNOWN / RECOVERY_REQUIRED
// always retain requestKey and operation linkage so a domain or DTO unknown can
// never collapse into a definite failure that loses the request identity.
function salesRecognitionV2SaveResult_(status, fields) {
  return Object.assign({
    status: status, code: "", requestKey: "", operationID: "", orderID: "",
    recognitionID: "", journalID: "", auditID: "", writeCount: 0, replay: false,
    field: "", detail: ""
  }, fields || {});
}

// Pure input normalization. Definite refusals (missing key, bad order type,
// empty lines) fail here, before any read or write.
function salesRecognitionV2NormalizeSave_(payload) {
  var requestKey = transactionOperationalText_(payload && payload.requestKey,
    "REQUEST_KEY_REQUIRED", "requestKey");
  var orderType = String(payload && payload.orderType || "").trim();
  if (TRANSACTION_OPERATIONAL_CONTRACT.ORDER_TYPES.indexOf(orderType) === -1) {
    throw transactionOperationalError_("INVALID_ORDER_TYPE", "orderType");
  }
  var lines = payload && payload.lines;
  if (!Array.isArray(lines) || !lines.length) {
    throw transactionOperationalError_("ORDER_LINES_REQUIRED", "lines");
  }
  return {
    requestKey: requestKey,
    orderType: orderType,
    lines: lines.map(function(line) {
      return {
        productID: String(line && line.productID || "").trim(),
        productVariantID: String(line && line.productVariantID || "").trim(),
        qty: Number(line && line.qty)
      };
    })
  };
}

// Zero-write schema gate: every sheet the save reads or writes must exist with
// exact canonical headers before anything else is attempted.
function salesRecognitionV2SaveSchemaGate_(ss) {
  var t = TRANSACTION_PRODUCTION_CONTRACT, save = SALES_RECOGNITION_V2_SAVE,
    contract = SALES_RECOGNITION_V2_CONTRACT;
  var required = [
    [t.ORDERS.SHEET, t.ORDERS.HEADERS],
    [t.ORDER_LINES.SHEET, t.ORDER_LINES.HEADERS],
    [t.OPERATIONS.SHEET, t.OPERATIONS.HEADERS],
    [contract.SHEET, contract.HEADERS],
    [save.AUDIT_SHEET, save.AUDIT_HEADERS],
    ["BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS],
    ["Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS],
    ["Products", PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS],
    ["ProductPricing", PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS],
    [t.PRODUCT_VARIANTS.SHEET, t.PRODUCT_VARIANTS.HEADERS],
    [t.RECIPE_VERSIONS.SHEET, t.RECIPE_VERSIONS.HEADERS],
    [t.RECIPE_VERSION_LINES.SHEET, t.RECIPE_VERSION_LINES.HEADERS],
    ["InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS],
    [RECIPE_STANDARD_COST_CONTRACT.SHEET, RECIPE_STANDARD_COST_CONTRACT.HEADERS],
    ["InventoryUOMConversions", BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS]
  ];
  var bad = [];
  required.forEach(function(entry) {
    var sheet = ss.getSheetByName(entry[0]);
    if (!sheet) { bad.push(entry[0]); return; }
    try { requireCanonicalHeaders(sheet, entry[1]); } catch (error) { bad.push(entry[0]); }
  });
  return { status: bad.length ? "FAIL" : "PASS", badSheets: bad };
}

// Zero-write cohort gate over persisted V2 evidence for the deterministic
// OrderID. A new intent may only proceed when there is no persisted evidence at
// all; pending, committed, unbound, malformed, or conflicting evidence fails
// closed instead of opening a second intent.
function salesRecognitionV2SaveCohortGate_(orderID, ss) {
  var contract = SALES_RECOGNITION_V2_CONTRACT, save = SALES_RECOGNITION_V2_SAVE,
    t = TRANSACTION_PRODUCTION_CONTRACT;
  var events, operations;
  try {
    events = readCanonicalTable(ss, contract.SHEET, contract.HEADERS);
    operations = readCanonicalTable(ss, t.OPERATIONS.SHEET, t.OPERATIONS.HEADERS);
  } catch (error) {
    return { status: "FAIL", detail: "EVIDENCE_READ_FAILED" };
  }
  var intents = operations.filter(function(row) {
    return row.OperationType === save.OPERATION_TYPE &&
      String(row.BusinessID === undefined || row.BusinessID === null ? "" : row.BusinessID) === orderID;
  }).map(function(row) {
    var activationID = "";
    try { activationID = JSON.parse(row.OperationPlan).activationID || ""; } catch (ignored) { /* fail closed below */ }
    return { OrderID: orderID, ContractVersion: contract.CONTRACT_VERSION, State: row.State,
      ActivationID: activationID };
  });
  var verdict = classifySalesRecognitionCohort({ OrderID: orderID },
    { events: events, intents: intents });
  if (verdict.cohort === contract.COHORTS.UNKNOWN &&
      verdict.status === contract.STATUS.UNKNOWN &&
      verdict.code === contract.REFUSAL_CODES.NO_PERSISTED_EVIDENCE) {
    return { status: "PASS", detail: "" };
  }
  return { status: "FAIL", detail: verdict.cohort + "/" + verdict.code };
}

// ProductVariant authority including applicable effective dates. Malformed or
// out-of-window variant rows fail closed before any freeze or write.
function salesRecognitionV2SaveVariantGate_(lines, authority, at) {
  var variants;
  try { variants = transactionOperationalMap_(authority.productVariants, "ProductVariantID"); }
  catch (error) { return { status: "FAIL", detail: "DUPLICATE_PRODUCT_VARIANT" }; }
  for (var i = 0; i < lines.length; i++) {
    var variant = variants[lines[i].productVariantID];
    if (!variant) continue; // prepareOperationalOrder refuses unknown variants.
    var start = canonicalDate(variant.EffectiveFrom),
      end = variant.EffectiveTo ? canonicalDate(variant.EffectiveTo) : null;
    if (!start || at < start || (end && at > end)) {
      return { status: "FAIL", detail: lines[i].productVariantID };
    }
  }
  return { status: "PASS", detail: "" };
}
// Freeze-once plan: every identity, snapshot, journal line, event row, audit
// row, and linkage value is derived once from the gated masters and persisted
// immutably inside OperationPlan.
function salesRecognitionV2SavePlan_(input) {
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    t = TRANSACTION_PRODUCTION_CONTRACT;
  var order = input.order, config = input.config, now = input.now,
    nowISO = now.toISOString(), actor = input.actor, economicDate = input.economicDate;
  var orderTotal = Number(order.OrderTotal), hppTotal = Number(order.HppTotalSnapshot);
  var lineRows = (order.Lines || []).map(function(line, index) {
    return { OrderLineID: "OL-" + order.OrderID + "-" + (index + 1), OrderID: order.OrderID,
      ProductID: line.productID, ProductVariantID: line.productVariantID, Tipe: line.tipe,
      Qty: line.qty, SellingPriceSnapshot: line.sellingPriceSnapshot,
      RecipeVersionID: line.recipeVersionID, UnitHppSnapshot: line.unitHppSnapshot,
      LineTotal: line.lineTotal, LineHpp: line.lineHpp };
  });
  var recognitionID = transactionStableBootstrapId_("SCR-", [order.OrderID]);
  var revisionID = transactionStableBootstrapId_("REV-", [order.OrderID]);
  var journalID = transactionStableBootstrapId_("SRV2J-", [order.OrderID]);
  var auditID = transactionStableBootstrapId_("SRA-", [order.OrderID]);
  var journalRows = [
    { JournalID: journalID, LineID: journalID + "-1", Tanggal: economicDate,
      AccountCode: save.JOURNAL_ACCOUNTS.SETTLEMENT, Debit: orderTotal, Credit: 0,
      MovementType: save.JOURNAL_MOVEMENT_TYPE, SourceType: save.JOURNAL_SOURCE_TYPE,
      SourceID: recognitionID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor },
    { JournalID: journalID, LineID: journalID + "-2", Tanggal: economicDate,
      AccountCode: save.JOURNAL_ACCOUNTS.REVENUE, Debit: 0, Credit: orderTotal,
      MovementType: save.JOURNAL_MOVEMENT_TYPE, SourceType: save.JOURNAL_SOURCE_TYPE,
      SourceID: recognitionID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor }
  ];
  var journalSignature = policyCJournalSignature_(journalRows);
  var snapshot = { contractVersion: contract.CONTRACT_VERSION, activationID: config.activationID,
    revisionID: revisionID, journalID: journalID, journalSignature: journalSignature,
    orderTotal: orderTotal, hppTotalSnapshot: hppTotal,
    lines: lineRows.map(function(row) {
      return { OrderLineID: row.OrderLineID, ProductVariantID: row.ProductVariantID, Qty: row.Qty,
        SellingPriceSnapshot: row.SellingPriceSnapshot, RecipeVersionID: row.RecipeVersionID,
        UnitHppSnapshot: row.UnitHppSnapshot, LineTotal: row.LineTotal, LineHpp: row.LineHpp };
    }) };
  var eventRow = { RecognitionID: recognitionID, ContractVersion: contract.CONTRACT_VERSION,
    ActivationID: config.activationID, OrderID: order.OrderID, RevisionID: revisionID,
    EventType: save.EVENT_TYPE, RecognizedAt: nowISO, EconomicDate: economicDate,
    Amount: orderTotal, RecognitionJournalID: journalID, JournalSignature: journalSignature,
    PostingStatus: save.POSTING_STATUS, OperationID: input.operationID, AuditID: auditID,
    OriginalID: "", ReversalOfRecognitionID: "", ReplacementID: "", Reason: "",
    Actor: actor, SnapshotJSON: JSON.stringify(snapshot) };
  var orderRow = { OrderID: order.OrderID, OrderNumber: order.OrderNumber, OrderType: order.OrderType,
    PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN", OrderTotal: orderTotal,
    HppTotalSnapshot: hppTotal, CreatedAt: nowISO, CreatedBy: actor, PreparingAt: "",
    ReadyAt: "", CompletedAt: "", UpdatedAt: nowISO, UpdatedBy: actor };
  var auditRow = { AuditID: auditID, ContractVersion: contract.CONTRACT_VERSION,
    OperationID: input.operationID, RequestKey: input.normalized.requestKey,
    OrderID: order.OrderID, RecognitionID: recognitionID, JournalID: journalID,
    PayloadHash: input.hash, Actor: actor, SavedAt: nowISO };
  return { planVersion: save.PLAN_VERSION, contractVersion: contract.CONTRACT_VERSION,
    mode: config.mode, activationID: config.activationID, activatedAt: config.activatedAt,
    configVersion: config.configVersion, operationType: save.OPERATION_TYPE,
    operationID: input.operationID, requestKey: input.normalized.requestKey,
    payloadHash: input.hash, orderID: order.OrderID, orderNumber: order.OrderNumber,
    revisionID: revisionID, recognitionID: recognitionID, journalID: journalID,
    auditID: auditID, actor: actor, savedAt: nowISO, economicDate: economicDate,
    orderType: order.OrderType, orderTotal: orderTotal, hppTotalSnapshot: hppTotal,
    accounts: { settlement: save.JOURNAL_ACCOUNTS.SETTLEMENT, revenue: save.JOURNAL_ACCOUNTS.REVENUE },
    journalSignature: journalSignature, orderRow: orderRow, lineRows: lineRows,
    journalRows: journalRows, eventRow: eventRow, auditRow: auditRow };
}

// The ONE batch: five value ranges, exact write surfaces, in frozen plan order.
function salesRecognitionV2SaveValueRanges_(plan) {
  var save = SALES_RECOGNITION_V2_SAVE, t = TRANSACTION_PRODUCTION_CONTRACT,
    contract = SALES_RECOGNITION_V2_CONTRACT;
  function rowValues(row, headers) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  }
  var ranges = [
    { range: t.ORDERS.SHEET, values: [rowValues(plan.orderRow, t.ORDERS.HEADERS)] },
    { range: t.ORDER_LINES.SHEET, values: plan.lineRows.map(function(row) {
      return rowValues(row, t.ORDER_LINES.HEADERS); }) },
    { range: contract.SHEET, values: [rowValues(plan.eventRow, contract.HEADERS)] },
    { range: "BalanceLedger", values: plan.journalRows.map(function(row) {
      return rowValues(row, BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS); }) },
    { range: save.AUDIT_SHEET, values: [rowValues(plan.auditRow, save.AUDIT_HEADERS)] }
  ];
  if (JSON.stringify(ranges.map(function(range) { return range.range; })) !==
      JSON.stringify(save.WRITE_SURFACES)) {
    throw new Error("SAVE_SURFACE_MISMATCH");
  }
  return ranges;
}

// Cell / request-size safety bounds. Evaluated and refused BEFORE the intent
// write, so an unsafe payload never produces a persisted operation.
function salesRecognitionV2SaveBounds_(plan) {
  var save = SALES_RECOGNITION_V2_SAVE, ranges;
  try { ranges = salesRecognitionV2SaveValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "SAVE_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var bytes = JSON.stringify(ranges).length;
  var lineCount = (plan.lineRows || []).length;
  var ok = lineCount <= save.MAX_ORDER_LINES && cells <= save.MAX_BATCH_CELLS &&
    bytes <= save.MAX_REQUEST_BYTES;
  return { ok: ok, cells: cells, bytes: bytes, lineCount: lineCount,
    detail: ok ? "" : "BATCH_BOUNDS lineCount=" + lineCount + " cells=" + cells + " bytes=" + bytes };
}

function salesRecognitionV2SaveRowExact_(actual, expected, headers) {
  return headers.every(function(header) {
    var a = actual[header], e = expected[header];
    return String(a === undefined || a === null ? "" : a) ===
      String(e === undefined || e === null ? "" : e);
  });
}

// Exact full verification of every business artifact against the frozen plan:
// complete header, line count/order/content/snapshots, event, both journal
// lines + signature, audit, operation linkage. Identity deviation never repairs;
// it classifies and fails closed.
function salesRecognitionV2SaveInspect_(plan, ss) {
  var save = SALES_RECOGNITION_V2_SAVE, t = TRANSACTION_PRODUCTION_CONTRACT,
    contract = SALES_RECOGNITION_V2_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var orders, lines, events, ledger, audits;
  try {
    orders = readCanonicalTable(ss, t.ORDERS.SHEET, t.ORDERS.HEADERS);
    lines = readCanonicalTable(ss, t.ORDER_LINES.SHEET, t.ORDER_LINES.HEADERS);
    events = readCanonicalTable(ss, contract.SHEET, contract.HEADERS);
    ledger = readCanonicalTable(ss, "BalanceLedger", ledgerHeaders);
    audits = readCanonicalTable(ss, save.AUDIT_SHEET, save.AUDIT_HEADERS);
  } catch (error) {
    return { state: "UNKNOWN", detail: "READBACK_FAILED:" + error.message };
  }
  var conflicts = [], missing = [];
  var orderMatches = orders.filter(function(row) { return row.OrderID === plan.orderID; });
  var lineMatches = lines.filter(function(row) { return row.OrderID === plan.orderID; });
  var eventMatches = events.filter(function(row) { return row.OrderID === plan.orderID; });
  var recognitionElsewhere = events.filter(function(row) {
    return row.RecognitionID === plan.recognitionID && row.OrderID !== plan.orderID;
  });
  var journalBySource = ledger.filter(function(row) {
    return row.SourceType === plan.journalRows[0].SourceType && row.SourceID === plan.recognitionID;
  });
  var journalById = ledger.filter(function(row) { return row.JournalID === plan.journalID; });
  var auditById = audits.filter(function(row) { return row.AuditID === plan.auditID; });
  var auditByOperation = audits.filter(function(row) { return row.OperationID === plan.operationID; });
  var present = orderMatches.length || lineMatches.length || eventMatches.length ||
    journalBySource.length || journalById.length || auditById.length || auditByOperation.length;
  if (!present) return { state: "NONE", detail: "NO_ARTIFACTS" };

  if (orderMatches.length > 1) conflicts.push("ORDER_DUPLICATE");
  else if (orderMatches.length === 1 &&
      !salesRecognitionV2SaveRowExact_(orderMatches[0], plan.orderRow, t.ORDERS.HEADERS)) {
    conflicts.push("ORDER_TAMPERED");
  } else if (!orderMatches.length) missing.push("ORDER");

  if (lineMatches.length) {
    if (lineMatches.length > plan.lineRows.length) conflicts.push("ORDER_LINE_EXTRA");
    var seen = {};
    lineMatches.forEach(function(row, index) {
      var expected = null;
      plan.lineRows.forEach(function(candidate) {
        if (candidate.OrderLineID === row.OrderLineID) expected = candidate;
      });
      if (!expected) { conflicts.push("ORDER_LINE_EXTRA"); return; }
      if (seen[expected.OrderLineID]) { conflicts.push("ORDER_LINE_DUPLICATE"); return; }
      seen[expected.OrderLineID] = true;
      if (!salesRecognitionV2SaveRowExact_(row, expected, t.ORDER_LINES.HEADERS)) {
        conflicts.push("ORDER_LINE_TAMPERED");
      }
      if (!plan.lineRows[index] || plan.lineRows[index].OrderLineID !== row.OrderLineID) {
        conflicts.push("ORDER_LINE_ORDER");
      }
    });
    if (lineMatches.length < plan.lineRows.length) missing.push("ORDER_LINE");
  } else missing.push("ORDER_LINE");

  if (eventMatches.length > 1) conflicts.push("EVENT_DUPLICATE");
  else if (eventMatches.length === 1 &&
      !salesRecognitionV2SaveRowExact_(eventMatches[0], plan.eventRow, contract.HEADERS)) {
    conflicts.push("EVENT_TAMPERED");
  } else if (!eventMatches.length) missing.push("EVENT");
  if (recognitionElsewhere.length) conflicts.push("RECOGNITION_IDENTITY_CROSSOVER");

  if (journalBySource.length || journalById.length) {
    if (journalBySource.length !== journalById.length) conflicts.push("JOURNAL_IDENTITY_CROSSOVER");
    else if (journalBySource.length === 1) {
      var only = journalBySource[0], planLine = null;
      plan.journalRows.forEach(function(row) { if (row.LineID === only.LineID) planLine = row; });
      if (!planLine || !salesRecognitionV2SaveRowExact_(only, planLine, ledgerHeaders)) {
        conflicts.push("JOURNAL_TAMPERED");
      } else missing.push("JOURNAL_LINE");
    } else if (journalBySource.length === 2) {
      for (var j = 0; j < 2; j++) {
        if (!salesRecognitionV2SaveRowExact_(journalBySource[j], plan.journalRows[j], ledgerHeaders)) {
          conflicts.push("JOURNAL_TAMPERED");
        }
      }
      if (policyCJournalSignature_(journalBySource) !== plan.journalSignature) {
        conflicts.push("JOURNAL_SIGNATURE_MISMATCH");
      }
      var debit = 0, credit = 0;
      journalBySource.forEach(function(row) { debit += Number(row.Debit); credit += Number(row.Credit); });
      if (!(debit === credit && debit === Number(plan.orderTotal))) conflicts.push("JOURNAL_BALANCE_MISMATCH");
    } else conflicts.push("JOURNAL_DUPLICATE");
  } else missing.push("JOURNAL");

  if (auditById.length || auditByOperation.length) {
    if (auditById.length > 1) conflicts.push("AUDIT_DUPLICATE");
    else if (auditById.length === 1 &&
        !salesRecognitionV2SaveRowExact_(auditById[0], plan.auditRow, save.AUDIT_HEADERS)) {
      conflicts.push("AUDIT_TAMPERED");
    }
    if (auditById.length !== auditByOperation.length) conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    if (!auditById.length) missing.push("AUDIT");
  } else missing.push("AUDIT");

  if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
  if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
  return { state: "EXACT", detail: "" };
}
// Batch -> verify -> commit. Never retries a failed batch inside one call: an
// unknown batch outcome is inspected once and, if unresolved, reported as
// UNKNOWN with the request identity preserved.
function salesRecognitionV2SaveApplyBatch_(plan, operation, runtime) {
  var save = SALES_RECOGNITION_V2_SAVE, codes = save.CODES;
  function outcome(status, fields) {
    return salesRecognitionV2SaveResult_(status, Object.assign({
      requestKey: plan.requestKey, operationID: plan.operationID, orderID: plan.orderID,
      recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID
    }, fields || {}));
  }
  var rows = 1 + plan.lineRows.length + 1 + 2 + 1;
  var ranges = null, batchError = null;
  try { ranges = salesRecognitionV2SaveValueRanges_(plan); }
  catch (error) { return outcome(save.STATUS.RECOVERY_REQUIRED, { code: codes.PLAN_MALFORMED, detail: error.message }); }
  try { runtime.batch(ranges); } catch (error) { batchError = error; }
  if (!batchError && runtime.crash) runtime.crash("V2_AFTER_BATCH");
  var inspection = salesRecognitionV2SaveInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(save.STATUS.UNKNOWN, {
      code: batchError ? codes.BATCH_OUTCOME_UNKNOWN : codes.READBACK_UNKNOWN,
      writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state !== "EXACT") {
    if (batchError && inspection.state === "NONE") {
      return outcome(save.STATUS.UNKNOWN, { code: codes.BATCH_OUTCOME_UNKNOWN,
        writeCount: "UNKNOWN", detail: inspection.detail });
    }
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: inspection.state === "CONFLICT" ? codes.IDENTITY_CONFLICT : codes.ARTIFACTS_INCOMPLETE,
      writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (runtime.crash) runtime.crash("V2_BEFORE_COMMIT");
  try { transactionCommitOperation_(runtime.repository, operation, runtime.now()); }
  catch (error) {
    return outcome(save.STATUS.UNKNOWN, { code: codes.COMMIT_OUTCOME_UNKNOWN,
      writeCount: rows, detail: error.message });
  }
  return outcome(save.STATUS.DONE, { writeCount: rows });
}

// Resume path: exact (OperationType, RequestKey) lookup hit. Same normalized
// payload replays or resumes from the persisted plan without touching mutable
// masters; a changed payload is a conflict with zero additional writes.
function salesRecognitionV2SaveResume_(operation, hash, requestKey, runtime) {
  var save = SALES_RECOGNITION_V2_SAVE, codes = save.CODES;
  function outcome(status, fields) {
    return salesRecognitionV2SaveResult_(status, Object.assign({
      requestKey: requestKey, operationID: operation.OperationID || "",
      orderID: operation.BusinessID || ""
    }, fields || {}));
  }
  if (operation.OperationType !== save.OPERATION_TYPE || operation.PayloadHash !== hash ||
      !operation.BusinessID) {
    return outcome(save.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT });
  }
  var plan = null;
  try { plan = JSON.parse(operation.OperationPlan); } catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  if (!plan || plan.requestKey !== requestKey || plan.payloadHash !== hash ||
      plan.operationID !== operation.OperationID) {
    return outcome(save.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT,
      detail: "PLAN_IDENTITY_MISMATCH" });
  }
  var inspection = salesRecognitionV2SaveInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(save.STATUS.UNKNOWN, { code: codes.READBACK_UNKNOWN, detail: inspection.detail });
  }
  var closedCode = inspection.state === "CONFLICT" ? codes.IDENTITY_CONFLICT : codes.ARTIFACTS_INCOMPLETE;
  if (inspection.state === "EXACT") {
    if (operation.State === "COMMITTED") {
      return outcome(save.STATUS.DONE, { replay: true, writeCount: 0,
        recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
    }
    if (runtime.crash) runtime.crash("V2_BEFORE_COMMIT");
    try { transactionCommitOperation_(runtime.repository, operation, runtime.now()); }
    catch (error) {
      return outcome(save.STATUS.UNKNOWN, { code: codes.COMMIT_OUTCOME_UNKNOWN, detail: error.message,
        recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
    }
    return outcome(save.STATUS.DONE, { replay: true, writeCount: 0,
      recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (operation.State === "COMMITTED") {
    // COMMITTED verifies artifacts then replays; anything else fails closed.
    return outcome(save.STATUS.RECOVERY_REQUIRED, { code: closedCode, detail: inspection.detail,
      recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (inspection.state === "NONE") {
    return salesRecognitionV2SaveApplyBatch_(plan, operation, runtime);
  }
  // Partial or conflicting uncommitted artifacts: fail closed, no repair.
  return outcome(save.STATUS.RECOVERY_REQUIRED, { code: closedCode, detail: inspection.detail,
    recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
}

// New intent path. Lookup already returned null; gates, master freeze, bounds,
// intent persist + exact readback, then batch. Every gate refusal writes zero.
function salesRecognitionV2SaveNewIntent_(normalized, hash, runtime) {
  var save = SALES_RECOGNITION_V2_SAVE, codes = save.CODES,
    contract = SALES_RECOGNITION_V2_CONTRACT, t = TRANSACTION_PRODUCTION_CONTRACT;
  function outcome(status, fields) {
    return salesRecognitionV2SaveResult_(status, Object.assign({ requestKey: normalized.requestKey },
      fields || {}));
  }
  var config = runtime.config === undefined || runtime.config === null ?
    salesRecognitionV2DefaultConfig() : runtime.config;
  var gate = salesRecognitionV2RequestGate(config);
  if (!gate.allowed) return outcome(save.STATUS.REFUSED, { code: gate.code });
  var schema = salesRecognitionV2SaveSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(save.STATUS.REFUSED, { code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(",") });
  }
  var accountRows;
  try { accountRows = readCanonicalTable(runtime.spreadsheet, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS); }
  catch (error) { return outcome(save.STATUS.REFUSED, { code: codes.SCHEMA_NOT_READY, detail: error.message }); }
  var preflight = preflightSalesRecognitionAccounts(accountRows);
  if (preflight.status !== "PASS") {
    var first = preflight.errors[0] || {};
    return outcome(save.STATUS.REFUSED, { code: first.code || "ACCOUNT_ABSENT",
      field: first.accountCode || "", detail: "ACCOUNT_PREFLIGHT_FAILED" });
  }
  var orderID = transactionStableBusinessID_("ORD-", save.OPERATION_TYPE, normalized.requestKey);
  var operationID = transactionOperationID_(save.OPERATION_TYPE, normalized.requestKey);
  var base = { orderID: orderID, operationID: operationID };
  var cohort = salesRecognitionV2SaveCohortGate_(orderID, runtime.spreadsheet);
  if (cohort.status !== "PASS") {
    return outcome(save.STATUS.REFUSED, Object.assign({ code: codes.COHORT_NOT_CLEAR, detail: cohort.detail }, base));
  }
  var authority;
  try {
    authority = typeof runtime.readAuthority === "function" ?
      runtime.readAuthority() : transactionProductionAuthority_(runtime.spreadsheet);
  } catch (error) {
    return outcome(save.STATUS.REFUSED, Object.assign({ code: codes.SCHEMA_NOT_READY, detail: error.message }, base));
  }
  var now = runtime.now();
  var economicDate = capitalEquityDateKey(now);
  if (!economicDate) return outcome(save.STATUS.REFUSED, Object.assign({ code: codes.ECONOMIC_DATE_INVALID }, base));
  var variantGate = salesRecognitionV2SaveVariantGate_(normalized.lines, authority, now);
  if (variantGate.status !== "PASS") {
    return outcome(save.STATUS.REFUSED, Object.assign({ code: codes.PRODUCT_VARIANT_EFFECTIVE_WINDOW,
      detail: variantGate.detail }, base));
  }
  var order;
  try {
    order = prepareOperationalOrder(normalized, authority, {
      now: function() { return now; },
      uuid: function() { return orderID.slice(4); },
      orderSequence: function() { return orderID.slice(4); },
      actor: runtime.actor });
  } catch (error) {
    return outcome(save.STATUS.REFUSED, Object.assign({ code: error.code || codes.PAYLOAD_INVALID,
      field: error.field || "", detail: error.message }, base));
  }
  order.OrderID = orderID;
  order.OrderNumber = orderID;
  var plan = salesRecognitionV2SavePlan_({ normalized: normalized, hash: hash, order: order,
    config: config, actor: runtime.actor(), now: now, economicDate: economicDate,
    operationID: operationID });
  var bounds = salesRecognitionV2SaveBounds_(plan);
  if (!bounds.ok) {
    return outcome(save.STATUS.REFUSED, Object.assign({ code: codes.BATCH_BOUNDS_EXCEEDED,
      detail: bounds.detail }, base));
  }
  var operation;
  try {
    operation = transactionResolveOperation_(runtime.repository, save.OPERATION_TYPE,
      normalized.requestKey, hash, orderID, plan, now);
  } catch (error) {
    return outcome(error.code === "OPERATION_PAYLOAD_CONFLICT" ? save.STATUS.CONFLICT : save.STATUS.RECOVERY_REQUIRED,
      Object.assign({ code: error.code === "OPERATION_PAYLOAD_CONFLICT" ?
        codes.OPERATION_PAYLOAD_CONFLICT : codes.DUPLICATE_OPERATION_EVIDENCE, detail: error.message }, base));
  }
  var readback = null;
  try { readback = runtime.repository.findOperation(save.OPERATION_TYPE, normalized.requestKey); }
  catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, Object.assign({ code: codes.IDENTITY_CONFLICT,
      detail: error.message }, base));
  }
  var planJson = JSON.stringify(plan);
  if (!readback) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, Object.assign({ code: codes.INTENT_READBACK_FAILED,
      detail: "INTENT_ROW_MISSING" }, base));
  }
  if (readback.OperationID !== operationID || readback.State !== "IN_PROGRESS" ||
      readback.PayloadHash !== hash || readback.OperationPlan !== planJson) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, Object.assign({ code: codes.INTENT_READBACK_FAILED,
      detail: "INTENT_ROW_MISMATCH" }, base));
  }
  if (runtime.crash) runtime.crash("V2_AFTER_INTENT");
  return salesRecognitionV2SaveApplyBatch_(plan, operation, runtime);
}

// Durable save core. Order is fixed: normalize -> exact (OperationType,
// RequestKey) lookup BEFORE any mutable master, pricing, recipe, or HPP read;
// then resume or new-intent. Never acquires a lock (outer wrapper owns it).
function salesRecognitionV2SaveWithRuntime_(payload, runtime) {
  var save = SALES_RECOGNITION_V2_SAVE, codes = save.CODES;
  var normalized;
  try { normalized = salesRecognitionV2NormalizeSave_(payload); }
  catch (error) {
    return salesRecognitionV2SaveResult_(save.STATUS.REFUSED, {
      code: error.code || codes.PAYLOAD_INVALID,
      requestKey: payload && payload.requestKey !== undefined && payload.requestKey !== null ?
        String(payload.requestKey) : "",
      field: error.field || "", detail: error.message });
  }
  var repository;
  try { repository = runtime.repository; }
  catch (error) {
    return salesRecognitionV2SaveResult_(save.STATUS.UNKNOWN, { code: codes.SAVE_EXECUTION_UNKNOWN,
      requestKey: normalized.requestKey, detail: error.message });
  }
  var existing;
  try { existing = repository.findOperation(save.OPERATION_TYPE, normalized.requestKey); }
  catch (error) {
    return salesRecognitionV2SaveResult_(save.STATUS.RECOVERY_REQUIRED, {
      code: error && error.message === "DUPLICATE_OPERATION" ?
        codes.DUPLICATE_OPERATION_EVIDENCE : codes.IDENTITY_CONFLICT,
      requestKey: normalized.requestKey, detail: error && error.message ? error.message : "" });
  }
  var hash = transactionPayloadHash_(normalized);
  if (existing) return salesRecognitionV2SaveResume_(existing, hash, normalized.requestKey, runtime);
  return salesRecognitionV2SaveNewIntent_(normalized, hash, runtime);
}

// Production runtime factory. Never invoked by local tests; the default config
// is PREPARED, so even an accidental call refuses before any business write.
function salesRecognitionV2SaveRuntime_() {
  var ss = requireNumlockProductionSpreadsheet();
  var runtime = {
    spreadsheet: ss,
    lock: LockService.getScriptLock(),
    now: function() { return new Date(); },
    actor: function() { return Session.getActiveUser().getEmail() || CANONICAL_ENTRY.USER; },
    config: salesRecognitionV2DefaultConfig(),
    batch: function(valueRanges) { return salesRecognitionV2SaveBatchRequest_(valueRanges); }
  };
  Object.defineProperty(runtime, "repository", { configurable: true, enumerable: true, get: function() {
    var repository = createTransactionSpreadsheetRepository(ss);
    Object.defineProperty(runtime, "repository", { configurable: true, enumerable: true, value: repository });
    return repository;
  } });
  return runtime;
}

// Single Sheets REST batch adapter (values:batchAppend) over the five write
// surfaces. Reuses the sanitized migration transport; never logs tokens.
function salesRecognitionV2SaveBatchRequest_(valueRanges) {
  return inventoryReceiptMigrationRequest_("post",
    "/values:batchAppend?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
    { data: valueRanges });
}

// Public entry: the ONLY outer lock. Acquired once, released once; the core
// never locks, so no nested locks are possible.
function salesRecognitionV2DurableSave(payload) {
  var runtime = null, acquired = false;
  try {
    runtime = salesRecognitionV2SaveRuntime_();
    runtime.lock.waitLock(30000);
    acquired = true;
    return salesRecognitionV2SaveWithRuntime_(payload, runtime);
  } catch (error) {
    return salesRecognitionV2SaveResult_(SALES_RECOGNITION_V2_SAVE.STATUS.UNKNOWN, {
      code: SALES_RECOGNITION_V2_SAVE.CODES.SAVE_EXECUTION_UNKNOWN,
      requestKey: payload && payload.requestKey !== undefined && payload.requestKey !== null ?
        String(payload.requestKey) : "",
      detail: error && error.message ? error.message : "" });
  } finally {
    if (acquired && runtime) runtime.lock.releaseLock();
  }
}
