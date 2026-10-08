// SALES_RECOGNITION_V2 U2 durable save core: normalize -> exact
// (OperationType, RequestKey) lookup -> gates -> freeze plan once (rows,
// analytical authority snapshots, normalized payload, integrity digest) ->
// persist OperationPlan IN_PROGRESS + exact ten-field readback -> ONE atomic
// spreadsheets.batchUpdate (five appendCells subrequests, safe RAW CellData) ->
// exact artifact verification -> verified operation commit readback -> DONE.
// Reuses TransactionOperations (95A) interfaces and the sanitized Sheets REST
// transport (43); legacy behavior untouched. V2 stays disabled: default config
// is PREPARED, so the seam refuses with zero writes unless an explicit config is
// supplied to the injected runtime. No operator dispatch, no nested locks.
// Intent, batch, readback, and final commit are multistep: this adapter claims
// NO database-global atomicity; only the single batchUpdate is atomic (all five
// subrequests or none).
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
  // Conservative bounds under the real Sheets limits: 50000 chars per cell and
  // a bounded request payload. OperationPlan (one cell) and SnapshotJSON are
  // covered by MAX_CELL_CHARS as well.
  MAX_CELL_CHARS: 45000,
  REQUEST_OVERHEAD_BYTES: 4096,
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
    PRODUCT_VARIANT_EFFECTIVE_WINDOW: "PRODUCT_VARIANT_EFFECTIVE_WINDOW",
    AUTHORITY_WINDOW_INVALID: "AUTHORITY_WINDOW_INVALID",
    AUTHORITY_SNAPSHOT_MISMATCH: "AUTHORITY_SNAPSHOT_MISMATCH",
    INVALID_OPERATION_STATE: "INVALID_OPERATION_STATE",
    OUTER_LOCK_UNAVAILABLE: "OUTER_LOCK_UNAVAILABLE",
    SAVE_RUNTIME_UNAVAILABLE: "SAVE_RUNTIME_UNAVAILABLE"
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

function salesRecognitionV2SavePayloadKey_(payload) {
  return payload && payload.requestKey !== undefined && payload.requestKey !== null ?
    String(payload.requestKey) : "";
}

// Pure input normalization. Definite refusals (missing key, bad order type,
// empty lines) fail here, before any read or write. The exact normalized
// structure is persisted in the plan and compared verbatim on replay/conflict.
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

// UTF-8 byte count without Node APIs (Apps Script V8 safe). Surrogate pairs
// count as 4 bytes; lone surrogates conservatively as 3.
function salesRecognitionV2SaveUtf8Bytes_(text) {
  var bytes = 0;
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length &&
        text.charCodeAt(i + 1) >= 0xDC00 && text.charCodeAt(i + 1) <= 0xDFFF) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

// Date-safe single-field equality: Date instances compare by instant against
// Dates or ISO strings; everything else compares as normalized text.
function salesRecognitionV2SaveFieldEqual_(actual, expected) {
  if (actual instanceof Date || expected instanceof Date) {
    var av = actual instanceof Date ? actual.getTime() :
      (actual === undefined || actual === null || actual === "" ? NaN : new Date(actual).getTime());
    var ev = expected instanceof Date ? expected.getTime() :
      (expected === undefined || expected === null || expected === "" ? NaN : new Date(expected).getTime());
    return !isNaN(av) && !isNaN(ev) && av === ev;
  }
  return String(actual === undefined || actual === null ? "" : actual) ===
    String(expected === undefined || expected === null ? "" : expected);
}

// Exact comparison over every header in the supplied list (all ten operation
// fields, Date-safe). Used for the intent readback and the final commit
// readback; no field may drift.
function salesRecognitionV2SaveFieldsExact_(actual, expected, headers) {
  if (!actual || !expected) return false;
  return headers.every(function(header) {
    return salesRecognitionV2SaveFieldEqual_(actual[header], expected[header]);
  });
}

// Zero-write schema gate: every sheet the save reads or writes must exist with
// exact canonical headers before anything else is attempted. Header reads only;
// never recomputes mutable master rows. Also re-run on resume (stored plan) so a
// vanished or corrupted surface fails closed before any batch.
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

// Effective-window validation over one authority table: nonblank malformed
// dates fail closed, and reversed windows (start after end) are refused. Blank
// EffectiveTo means open-ended (legitimate); blank EffectiveFrom is rejected
// only where the caller requires a start (variant containment gate below).
function salesRecognitionV2SaveWindowScan_(rows, label, idField) {
  for (var i = 0; i < (rows || []).length; i++) {
    var row = rows[i];
    var id = String(row && row[idField] !== undefined && row[idField] !== null ? row[idField] : i);
    var from = row === null || row === undefined ? "" : row.EffectiveFrom;
    var to = row === null || row === undefined ? "" : row.EffectiveTo;
    var fromBlank = from === undefined || from === null || String(from).trim() === "";
    var toBlank = to === undefined || to === null || String(to).trim() === "";
    if (!fromBlank && !canonicalDate(from)) {
      return { status: "FAIL", detail: label + ":" + id + ":EFFECTIVE_FROM_INVALID" };
    }
    if (!toBlank && !canonicalDate(to)) {
      return { status: "FAIL", detail: label + ":" + id + ":EFFECTIVE_TO_INVALID" };
    }
    if (!fromBlank && !toBlank && canonicalDate(from).getTime() > canonicalDate(to).getTime()) {
      return { status: "FAIL", detail: label + ":" + id + ":EFFECTIVE_WINDOW_REVERSED" };
    }
  }
  return { status: "PASS", detail: "" };
}

// Full authority effective-window scan for every table the freeze depends on:
// variants, recipe versions, pricing, standard costs. Malformed nonblank ends
// and reversed windows refuse the new intent before any freeze or write.
function salesRecognitionV2SaveAuthorityGate_(authority) {
  var t = TRANSACTION_PRODUCTION_CONTRACT;
  var checks = [
    [authority.productVariants, "PRODUCT_VARIANT", "ProductVariantID"],
    [authority.recipeVersions, "RECIPE_VERSION", "RecipeVersionID"],
    [authority.pricing, "PRODUCT_PRICING", "ID_Prod"],
    [authority.standardCosts, "STANDARD_COST", "ID"]
  ];
  for (var i = 0; i < checks.length; i++) {
    var result = salesRecognitionV2SaveWindowScan_(checks[i][0], checks[i][1], checks[i][2]);
    if (result.status !== "PASS") return result;
  }
  return { status: "PASS", detail: "" };
}

// ProductVariant authority including applicable effective dates for the lines
// actually being frozen. Malformed, missing, reversed, or out-of-window variant
// rows fail closed before any freeze or write.
function salesRecognitionV2SaveVariantGate_(lines, authority, at) {
  var variants;
  try { variants = transactionOperationalMap_(authority.productVariants, "ProductVariantID"); }
  catch (error) { return { status: "FAIL", detail: "DUPLICATE_PRODUCT_VARIANT" }; }
  for (var i = 0; i < lines.length; i++) {
    var variant = variants[lines[i].productVariantID];
    if (!variant) continue; // prepareOperationalOrder refuses unknown variants.
    var from = variant.EffectiveFrom, to = variant.EffectiveTo;
    var start = from === undefined || from === null || String(from).trim() === "" ? null : canonicalDate(from);
    var endBlank = to === undefined || to === null || String(to).trim() === "";
    var end = endBlank ? null : canonicalDate(to);
    if (!start || (!endBlank && !end) || (start && end && start.getTime() > end.getTime()) ||
        at < start || (end && at > end)) {
      return { status: "FAIL", detail: lines[i].productVariantID };
    }
  }
  return { status: "PASS", detail: "" };
}
// Freeze-time refusal (pre-persist, definite): carries a refusal code.
function salesRecognitionV2SaveFreezeError_(code, detail) {
  var error = new Error(code + ":" + detail);
  error.code = code;
  return error;
}

// Freeze-once analytical HPP authority for one prepared line: recipe
// components + UOM + item metadata + standard-cost authority + applicable UOM
// conversion rows + price authority + variant/recipe effective metadata. With
// these rows the analytical HPP is fully reconstructable (components x standard
// costs) without touching inventory journals. Re-derivation self-checks against
// the prepared snapshots and refuses on any mismatch.
function salesRecognitionV2SaveLineAuthority_(line, authority, at) {
  var variants, itemMap;
  try {
    variants = transactionOperationalMap_(authority.productVariants, "ProductVariantID");
    itemMap = transactionOperationalMap_(authority.items, "ItemID");
  } catch (error) {
    throw salesRecognitionV2SaveFreezeError_("AUTHORITY_SNAPSHOT_MISMATCH", "DUPLICATE_AUTHORITY");
  }
  var variant = variants[line.productVariantID];
  if (!variant) {
    throw salesRecognitionV2SaveFreezeError_("AUTHORITY_SNAPSHOT_MISMATCH", "VARIANT_NOT_FOUND:" + line.productVariantID);
  }
  var recipes = (authority.recipeVersions || []).filter(function(recipe) {
    var start = canonicalDate(recipe.EffectiveFrom), end = recipe.EffectiveTo ? canonicalDate(recipe.EffectiveTo) : null;
    return String(recipe.ProductVariantID || "").trim() === line.productVariantID &&
      String(recipe.RecipeVersionID || "").trim() === line.recipeVersionID &&
      isCanonicalActive(recipe.IsActive) && start && start <= at && (!end || at <= end);
  });
  if (recipes.length !== 1) {
    throw salesRecognitionV2SaveFreezeError_("AUTHORITY_SNAPSHOT_MISMATCH", "RECIPE_SNAPSHOT_NOT_UNIQUE:" + line.recipeVersionID);
  }
  var recipe = recipes[0];
  var components = (recipe.Components || []).map(function(component) {
    var item = itemMap[String(component.ItemID || "").trim()];
    if (!item) throw salesRecognitionV2SaveFreezeError_("AUTHORITY_SNAPSHOT_MISMATCH", "ITEM_NOT_FOUND:" + component.ItemID);
    var costs = (authority.standardCosts || []).filter(function(cost) {
      var start = canonicalDate(cost.EffectiveFrom), end = cost.EffectiveTo ? canonicalDate(cost.EffectiveTo) : null;
      return String(cost.ItemID || "").trim() === String(item.ItemID) && isCanonicalActive(cost.IsActive) &&
        start && start <= at && (!end || at <= end);
    });
    if (costs.length !== 1) {
      throw salesRecognitionV2SaveFreezeError_("AUTHORITY_SNAPSHOT_MISMATCH", "STANDARD_COST_NOT_UNIQUE:" + item.ItemID);
    }
    var conversions = (authority.conversions || []).filter(function(row) {
      return String(row.ItemID || "").trim() === String(item.ItemID);
    }).map(function(row) {
      return { ConversionID: row.ConversionID, ItemID: row.ItemID, FromUOM: row.FromUOM,
        ToUOM: row.ToUOM, Numerator: row.Numerator, Denominator: row.Denominator,
        EffectiveFrom: row.EffectiveFrom, EffectiveTo: row.EffectiveTo,
        IsActive: isCanonicalActive(row.IsActive) };
    });
    return { ItemID: item.ItemID, QtyBase: Number(component.QtyBase), BaseUOM: component.UOM,
      item: { ItemID: item.ItemID, ItemName: item.ItemName, Classification: item.Classification,
        BaseUOM: item.BaseUOM, EffectiveFrom: item.EffectiveFrom, EffectiveTo: item.EffectiveTo,
        IsActive: isCanonicalActive(item.IsActive) },
      standardCost: { ID: costs[0].ID, ItemID: costs[0].ItemID, StandardCost: Number(costs[0].StandardCost),
        EffectiveFrom: costs[0].EffectiveFrom, EffectiveTo: costs[0].EffectiveTo,
        IsActive: isCanonicalActive(costs[0].IsActive) },
      conversions: conversions };
  });
  if (!components.length) {
    throw salesRecognitionV2SaveFreezeError_("AUTHORITY_SNAPSHOT_MISMATCH", "NO_COMPONENTS:" + line.recipeVersionID);
  }
  var prices = (authority.pricing || []).filter(function(price) {
    var start = canonicalDate(price.EffectiveFrom), end = price.EffectiveTo ? canonicalDate(price.EffectiveTo) : null;
    return String(price.ID_Prod || "").trim() === line.productID &&
      transactionVariantType_(price.Tipe) === line.tipe && isCanonicalActive(price.IsActive) &&
      start && start <= at && (!end || at <= end);
  });
  if (prices.length !== 1 || Number(prices[0].Harga) !== Number(line.sellingPriceSnapshot)) {
    throw salesRecognitionV2SaveFreezeError_("AUTHORITY_SNAPSHOT_MISMATCH", "PRICE_SNAPSHOT_NOT_UNIQUE:" + line.productVariantID);
  }
  var unitHpp = 0;
  components.forEach(function(component) {
    unitHpp += component.QtyBase * component.standardCost.StandardCost;
  });
  if (Math.abs(unitHpp - Number(line.unitHppSnapshot)) > 1e-9) {
    throw salesRecognitionV2SaveFreezeError_("AUTHORITY_SNAPSHOT_MISMATCH", "HPP_RECONSTRUCTION_MISMATCH:" + line.recipeVersionID);
  }
  if (Math.abs(Number(line.qty) * Number(line.sellingPriceSnapshot) - Number(line.lineTotal)) > 1e-9) {
    throw salesRecognitionV2SaveFreezeError_("AUTHORITY_SNAPSHOT_MISMATCH", "LINE_TOTAL_MISMATCH:" + line.productVariantID);
  }
  return {
    variant: { ProductVariantID: variant.ProductVariantID, ProductID: variant.ProductID,
      Tipe: variant.Tipe, EffectiveFrom: variant.EffectiveFrom, EffectiveTo: variant.EffectiveTo,
      IsActive: isCanonicalActive(variant.IsActive) },
    recipe: { RecipeVersionID: recipe.RecipeVersionID, ProductVariantID: recipe.ProductVariantID,
      EffectiveFrom: recipe.EffectiveFrom, EffectiveTo: recipe.EffectiveTo,
      IsActive: isCanonicalActive(recipe.IsActive) },
    components: components,
    price: { ID_Prod: prices[0].ID_Prod, Tipe: prices[0].Tipe, Harga: Number(prices[0].Harga),
      EffectiveFrom: prices[0].EffectiveFrom, EffectiveTo: prices[0].EffectiveTo,
      IsActive: isCanonicalActive(prices[0].IsActive) }
  };
}

// Freeze-once plan: every identity, snapshot, journal line, event row, audit
// row, exact normalized payload, analytical authority snapshot, and linkage
// value is derived once from the gated masters and persisted immutably inside
// OperationPlan together with a canonical integrity digest.
function salesRecognitionV2SavePlan_(input) {
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT;
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
  var lineAuthority = (order.Lines || []).map(function(line) {
    return salesRecognitionV2SaveLineAuthority_(line, input.authority, now);
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
    }),
    authority: lineAuthority };
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
  var plan = { planVersion: save.PLAN_VERSION, contractVersion: contract.CONTRACT_VERSION,
    mode: config.mode, activationID: config.activationID, activatedAt: config.activatedAt,
    configVersion: config.configVersion, operationType: save.OPERATION_TYPE,
    operationID: input.operationID, requestKey: input.normalized.requestKey,
    payloadHash: input.hash, normalizedPayload: input.normalized,
    orderID: order.OrderID, orderNumber: order.OrderNumber,
    revisionID: revisionID, recognitionID: recognitionID, journalID: journalID,
    auditID: auditID, actor: actor, savedAt: nowISO, economicDate: economicDate,
    orderType: order.OrderType, orderTotal: orderTotal, hppTotalSnapshot: hppTotal,
    accounts: { settlement: save.JOURNAL_ACCOUNTS.SETTLEMENT, revenue: save.JOURNAL_ACCOUNTS.REVENUE },
    journalSignature: journalSignature, orderRow: orderRow, lineRows: lineRows,
    lineAuthority: lineAuthority, journalRows: journalRows, eventRow: eventRow,
    auditRow: auditRow };
  // Canonical immutable integrity digest over the plan without the digest key.
  plan.planDigest = transactionPayloadHash_(plan);
  return plan;
}

// The ONE batch's logical ranges: five value ranges, exact write surfaces, in
// frozen plan order. Feeds both the injected runtime seam and the real
// spreadsheets.batchUpdate transport.
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

// Safe RAW CellData only: stringValue / numberValue / boolValue. Never
// formulaValue. Strings above the conservative cell bound are unsafe and throw
// before any request or persisted plan exists.
function salesRecognitionV2SaveCellValue_(value) {
  var save = SALES_RECOGNITION_V2_SAVE;
  if (typeof value === "number") {
    if (!isFinite(value)) throw new Error("UNSAFE_CELL_NUMBER");
    return { numberValue: value };
  }
  if (typeof value === "boolean") return { boolValue: value };
  var text = String(value === undefined || value === null ? "" : value);
  if (text.length > save.MAX_CELL_CHARS) throw new Error("UNSAFE_CELL_CHARS:" + text.length);
  return { stringValue: text };
}

function salesRecognitionV2SaveAppendBlocks_(valueRanges) {
  return valueRanges.map(function(range) {
    return { sheet: range.range, rows: range.values.map(function(row) {
      return row.map(salesRecognitionV2SaveCellValue_);
    }) };
  });
}

// ONE spreadsheets.batchUpdate body: exactly five appendCells subrequests
// (one per existing write surface, by sheetId), fields=userEnteredValue, RAW
// CellData only. Throws before issuing any request if a sheetId is missing, so
// the batch is rejected atomically rather than partially.
function salesRecognitionV2SaveBatchBody_(valueRanges, sheetIds) {
  var save = SALES_RECOGNITION_V2_SAVE;
  var blocks = salesRecognitionV2SaveAppendBlocks_(valueRanges);
  if (blocks.length !== save.WRITE_SURFACES.length) throw new Error("SAVE_SURFACE_MISMATCH");
  var requests = blocks.map(function(block) {
    var sheetId = sheetIds[block.sheet];
    if (typeof sheetId !== "number" || !isFinite(sheetId)) {
      throw new Error("SHEET_ID_UNAVAILABLE:" + block.sheet);
    }
    return { appendCells: { sheetId: sheetId, fields: "userEnteredValue",
      rows: block.rows.map(function(cells) {
        return { values: cells.map(function(cellData) {
          return { userEnteredValue: cellData };
        }) };
      }) } };
  });
  return { requests: requests };
}

// Cell / request safety bounds. Evaluated and refused BEFORE the intent write
// so an unsafe plan is never persisted, and re-evaluated on resume against the
// STORED plan (no mutable master recomputation): line count, cell count, every
// cell string length, the OperationPlan cell itself, and the actual UTF-8
// request bytes including body + fixed transport overhead.
function salesRecognitionV2SaveBounds_(plan) {
  var save = SALES_RECOGNITION_V2_SAVE, ranges;
  try { ranges = salesRecognitionV2SaveValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "SAVE_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var sentinel = {};
  save.WRITE_SURFACES.forEach(function(name) { sentinel[name] = 2147483647; });
  var body;
  try { body = salesRecognitionV2SaveBatchBody_(ranges, sentinel); }
  catch (error) { return { ok: false, detail: "UNSAFE_BATCH:" + error.message }; }
  var bytes = salesRecognitionV2SaveUtf8Bytes_(JSON.stringify(body)) + save.REQUEST_OVERHEAD_BYTES;
  var planJson = "";
  try { planJson = JSON.stringify(plan); }
  catch (error) { return { ok: false, detail: "PLAN_JSON_INVALID" }; }
  if (planJson.length > save.MAX_CELL_CHARS) {
    return { ok: false, detail: "UNSAFE_PLAN_CELL_CHARS:" + planJson.length };
  }
  var lineCount = (plan.lineRows || []).length;
  var ok = lineCount <= save.MAX_ORDER_LINES && cells <= save.MAX_BATCH_CELLS &&
    bytes <= save.MAX_REQUEST_BYTES;
  return { ok: ok, cells: cells, bytes: bytes, lineCount: lineCount,
    planChars: planJson.length,
    detail: ok ? "" : "BATCH_BOUNDS lineCount=" + lineCount + " cells=" + cells + " bytes=" + bytes };
}

function salesRecognitionV2SaveRowExact_(actual, expected, headers) {
  return headers.every(function(header) {
    return salesRecognitionV2SaveFieldEqual_(actual[header], expected[header]);
  });
}
// Plan integrity + shape invariants. Runs at freeze time (definite REFUSED on
// failure, before any write) and on every resume (fail closed, ZERO additional
// writes). Distinguishes malformed shape (PLAN_MALFORMED) from tampered content
// (IDENTITY_CONFLICT via kind=TAMPERED: digest, derivations, account mapping,
// economic totals, line identities/snapshots, linkages, journal signature,
// audit values). Any other persisted State is rejected, never committed.
function salesRecognitionV2SaveVerifyPlan_(plan) {
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    t = TRANSACTION_PRODUCTION_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  function malformed(reason) { return { ok: false, kind: "MALFORMED", reason: reason }; }
  function tampered(reason) { return { ok: false, kind: "TAMPERED", reason: reason }; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return malformed("PLAN_NOT_OBJECT");
  if (plan.planVersion !== save.PLAN_VERSION) return malformed("PLAN_VERSION_MISMATCH");
  if (plan.contractVersion !== contract.CONTRACT_VERSION) return malformed("CONTRACT_VERSION_MISMATCH");
  if (plan.operationType !== save.OPERATION_TYPE) return malformed("OPERATION_TYPE_MISMATCH");
  if (typeof plan.requestKey !== "string" || !plan.requestKey) return malformed("REQUEST_KEY_MISSING");
  if (typeof plan.operationID !== "string" || !plan.operationID) return malformed("OPERATION_ID_MISSING");
  if (typeof plan.payloadHash !== "string" || !plan.payloadHash) return malformed("PAYLOAD_HASH_MISSING");
  if (typeof plan.orderID !== "string" || !plan.orderID) return malformed("ORDER_ID_MISSING");
  if (!plan.normalizedPayload || typeof plan.normalizedPayload !== "object" ||
      !Array.isArray(plan.normalizedPayload.lines)) return malformed("NORMALIZED_PAYLOAD_MISSING");
  if (!plan.accounts) return malformed("ACCOUNT_MAPPING_MISSING");
  if (plan.accounts.settlement !== save.JOURNAL_ACCOUNTS.SETTLEMENT ||
      plan.accounts.revenue !== save.JOURNAL_ACCOUNTS.REVENUE) {
    return tampered("ACCOUNT_MAPPING_MISMATCH");
  }
  // Deterministic identity derivations (linkages must be self-consistent).
  if (plan.operationID !== transactionOperationID_(save.OPERATION_TYPE, plan.requestKey)) {
    return tampered("OPERATION_ID_DERIVATION_MISMATCH");
  }
  if (plan.orderID !== transactionStableBusinessID_("ORD-", save.OPERATION_TYPE, plan.requestKey)) {
    return tampered("ORDER_ID_DERIVATION_MISMATCH");
  }
  if (plan.revisionID !== transactionStableBootstrapId_("REV-", [plan.orderID])) {
    return tampered("REVISION_ID_DERIVATION_MISMATCH");
  }
  if (plan.recognitionID !== transactionStableBootstrapId_("SCR-", [plan.orderID])) {
    return tampered("RECOGNITION_ID_DERIVATION_MISMATCH");
  }
  if (plan.journalID !== transactionStableBootstrapId_("SRV2J-", [plan.orderID])) {
    return tampered("JOURNAL_ID_DERIVATION_MISMATCH");
  }
  if (plan.auditID !== transactionStableBootstrapId_("SRA-", [plan.orderID])) {
    return tampered("AUDIT_ID_DERIVATION_MISMATCH");
  }
  if (!isFinite(Number(plan.orderTotal)) || Number(plan.orderTotal) <= 0) {
    return malformed("ORDER_TOTAL_INVALID");
  }
  if (!isFinite(Number(plan.hppTotalSnapshot)) || Number(plan.hppTotalSnapshot) < 0) {
    return malformed("HPP_TOTAL_INVALID");
  }
  if (typeof plan.economicDate !== "string" || !capitalEquityDateKey(plan.economicDate)) {
    return malformed("ECONOMIC_DATE_INVALID");
  }
  if (typeof plan.actor !== "string" || !plan.actor || typeof plan.savedAt !== "string" || !plan.savedAt) {
    return malformed("ACTOR_OR_TIMESTAMP_MISSING");
  }
  // Order row: complete header + identity + economic totals.
  if (!plan.orderRow || typeof plan.orderRow !== "object") return malformed("ORDER_ROW_MISSING");
  if (t.ORDERS.HEADERS.some(function(header) { return plan.orderRow[header] === undefined; })) {
    return malformed("ORDER_ROW_INCOMPLETE");
  }
  if (plan.orderRow.OrderID !== plan.orderID || plan.orderRow.OrderNumber !== plan.orderNumber ||
      plan.orderRow.OrderType !== plan.orderType ||
      Number(plan.orderRow.OrderTotal) !== Number(plan.orderTotal) ||
      Number(plan.orderRow.HppTotalSnapshot) !== Number(plan.hppTotalSnapshot)) {
    return tampered("ORDER_ROW_MISMATCH");
  }
  // Line identities + per-line snapshot arithmetic + economic totals.
  // (Line-count ceiling is enforced by salesRecognitionV2SaveBounds_, which
  // runs before every persist and before every resume batch.)
  if (!Array.isArray(plan.lineRows) || !plan.lineRows.length) return malformed("LINE_ROWS_MISSING");
  var seen = {}, sumTotal = 0, sumHpp = 0;
  for (var i = 0; i < plan.lineRows.length; i++) {
    var line = plan.lineRows[i];
    if (t.ORDER_LINES.HEADERS.some(function(header) { return line[header] === undefined; })) {
      return malformed("ORDER_LINE_INCOMPLETE");
    }
    if (line.OrderLineID !== "OL-" + plan.orderID + "-" + (i + 1)) return tampered("ORDER_LINE_ID_MISMATCH");
    if (seen[line.OrderLineID]) return malformed("ORDER_LINE_ID_DUPLICATE");
    seen[line.OrderLineID] = true;
    if (line.OrderID !== plan.orderID) return tampered("ORDER_LINE_OWNER_MISMATCH");
    if (!line.ProductID || !line.ProductVariantID || !line.Tipe || !line.RecipeVersionID) {
      return malformed("ORDER_LINE_IDENTITY_INCOMPLETE");
    }
    var qty = Number(line.Qty), price = Number(line.SellingPriceSnapshot),
      unit = Number(line.UnitHppSnapshot), total = Number(line.LineTotal), hpp = Number(line.LineHpp);
    if (!isFinite(qty) || qty <= 0 || !isFinite(price) || price <= 0 ||
        !isFinite(unit) || unit < 0 || !isFinite(total) || !isFinite(hpp)) {
      return malformed("ORDER_LINE_NUMBERS_INVALID");
    }
    if (Math.abs(qty * price - total) > 1e-9) return tampered("ORDER_LINE_TOTAL_MISMATCH");
    if (Math.abs(qty * unit - hpp) > 1e-9) return tampered("ORDER_LINE_HPP_MISMATCH");
    sumTotal += total;
    sumHpp += hpp;
  }
  if (Math.abs(sumTotal - Number(plan.orderTotal)) > 1e-9) return tampered("ORDER_TOTAL_SUM_MISMATCH");
  if (Math.abs(sumHpp - Number(plan.hppTotalSnapshot)) > 1e-9) return tampered("HPP_TOTAL_SUM_MISMATCH");
  // Analytical authority snapshots: complete, mutually linked, reconstruct HPP.
  if (!Array.isArray(plan.lineAuthority) || plan.lineAuthority.length !== plan.lineRows.length) {
    return malformed("LINE_AUTHORITY_MISSING");
  }
  for (var a = 0; a < plan.lineAuthority.length; a++) {
    var authority = plan.lineAuthority[a], lineRow = plan.lineRows[a];
    if (!authority || !authority.variant || !authority.recipe || !authority.price ||
        !Array.isArray(authority.components) || !authority.components.length) {
      return malformed("LINE_AUTHORITY_INCOMPLETE");
    }
    if (authority.variant.ProductVariantID !== lineRow.ProductVariantID) {
      return tampered("AUTHORITY_VARIANT_MISMATCH");
    }
    if (authority.recipe.RecipeVersionID !== lineRow.RecipeVersionID) {
      return tampered("AUTHORITY_RECIPE_MISMATCH");
    }
    if (Number(authority.price.Harga) !== Number(lineRow.SellingPriceSnapshot)) {
      return tampered("AUTHORITY_PRICE_MISMATCH");
    }
    var reconstructed = 0;
    for (var c = 0; c < authority.components.length; c++) {
      var component = authority.components[c];
      if (!component || !component.ItemID || !Array.isArray(component.conversions) ||
          !component.standardCost || !isFinite(Number(component.standardCost.StandardCost)) ||
          Number(component.standardCost.StandardCost) < 0 || !isFinite(Number(component.QtyBase)) ||
          Number(component.QtyBase) <= 0) {
        return malformed("LINE_AUTHORITY_COMPONENT_INVALID");
      }
      reconstructed += Number(component.QtyBase) * Number(component.standardCost.StandardCost);
    }
    if (Math.abs(reconstructed - Number(lineRow.UnitHppSnapshot)) > 1e-9) {
      return tampered("AUTHORITY_HPP_MISMATCH");
    }
  }
  // Journal: two lines, derivations, account mapping, amounts, date, signature.
  if (!Array.isArray(plan.journalRows) || plan.journalRows.length !== 2) {
    return malformed("JOURNAL_ROWS_INVALID");
  }
  var j0 = plan.journalRows[0], j1 = plan.journalRows[1];
  if (ledgerHeaders.some(function(header) { return j0[header] === undefined || j1[header] === undefined; })) {
    return malformed("JOURNAL_ROW_INCOMPLETE");
  }
  if (j0.LineID === j1.LineID) return malformed("JOURNAL_LINE_ID_DUPLICATE");
  if (j0.JournalID !== plan.journalID || j1.JournalID !== plan.journalID) {
    return tampered("JOURNAL_ID_MISMATCH");
  }
  if (j0.LineID !== plan.journalID + "-1" || j1.LineID !== plan.journalID + "-2") {
    return tampered("JOURNAL_LINE_ID_MISMATCH");
  }
  if (j0.SourceID !== plan.recognitionID || j1.SourceID !== plan.recognitionID) {
    return tampered("JOURNAL_SOURCE_MISMATCH");
  }
  if (j0.SourceType !== save.JOURNAL_SOURCE_TYPE || j1.SourceType !== save.JOURNAL_SOURCE_TYPE ||
      j0.MovementType !== save.JOURNAL_MOVEMENT_TYPE || j1.MovementType !== save.JOURNAL_MOVEMENT_TYPE) {
    return tampered("JOURNAL_CLASSIFICATION_MISMATCH");
  }
  if (j0.AccountCode !== save.JOURNAL_ACCOUNTS.SETTLEMENT ||
      j1.AccountCode !== save.JOURNAL_ACCOUNTS.REVENUE) {
    return tampered("JOURNAL_ACCOUNT_MAPPING_MISMATCH");
  }
  if (Number(j0.Debit) !== Number(plan.orderTotal) || Number(j0.Credit) !== 0 ||
      Number(j1.Debit) !== 0 || Number(j1.Credit) !== Number(plan.orderTotal)) {
    return tampered("JOURNAL_AMOUNT_MISMATCH");
  }
  if (j0.Tanggal !== plan.economicDate || j1.Tanggal !== plan.economicDate) {
    return tampered("JOURNAL_DATE_MISMATCH");
  }
  if (typeof plan.journalSignature !== "string" || !plan.journalSignature ||
      policyCJournalSignature_(plan.journalRows) !== plan.journalSignature) {
    return tampered("JOURNAL_SIGNATURE_MISMATCH");
  }
  // Event row: complete 20-column header, linkages, signature, snapshot.
  if (!plan.eventRow || typeof plan.eventRow !== "object") return malformed("EVENT_ROW_MISSING");
  if (contract.HEADERS.some(function(header) { return plan.eventRow[header] === undefined; })) {
    return malformed("EVENT_ROW_INCOMPLETE");
  }
  var event = plan.eventRow;
  if (event.RecognitionID !== plan.recognitionID || event.OrderID !== plan.orderID ||
      event.RevisionID !== plan.revisionID || event.OperationID !== plan.operationID ||
      event.AuditID !== plan.auditID || event.RecognitionJournalID !== plan.journalID ||
      event.ContractVersion !== contract.CONTRACT_VERSION || event.EventType !== save.EVENT_TYPE ||
      event.PostingStatus !== save.POSTING_STATUS || event.EconomicDate !== plan.economicDate ||
      event.JournalSignature !== plan.journalSignature ||
      Number(event.Amount) !== Number(plan.orderTotal)) {
    return tampered("EVENT_ROW_MISMATCH");
  }
  var snapshot = null;
  try { snapshot = JSON.parse(event.SnapshotJSON); } catch (error) { return malformed("SNAPSHOT_JSON_INVALID"); }
  if (!snapshot || typeof snapshot !== "object" ||
      snapshot.journalSignature !== plan.journalSignature ||
      !Array.isArray(snapshot.authority) ||
      snapshot.authority.length !== plan.lineRows.length) {
    return tampered("SNAPSHOT_CONTENT_MISMATCH");
  }
  // Audit row: complete header + all linkages.
  if (!plan.auditRow || typeof plan.auditRow !== "object") return malformed("AUDIT_ROW_MISSING");
  if (save.AUDIT_HEADERS.some(function(header) { return plan.auditRow[header] === undefined; })) {
    return malformed("AUDIT_ROW_INCOMPLETE");
  }
  var audit = plan.auditRow;
  if (audit.AuditID !== plan.auditID || audit.OperationID !== plan.operationID ||
      audit.RequestKey !== plan.requestKey || audit.OrderID !== plan.orderID ||
      audit.RecognitionID !== plan.recognitionID || audit.JournalID !== plan.journalID ||
      audit.PayloadHash !== plan.payloadHash || audit.ContractVersion !== contract.CONTRACT_VERSION) {
    return tampered("AUDIT_ROW_MISMATCH");
  }
  // Canonical integrity digest over the plan without the digest key.
  if (typeof plan.planDigest !== "string" || !plan.planDigest) return malformed("PLAN_DIGEST_MISSING");
  var copy = Object.assign({}, plan);
  delete copy.planDigest;
  if (transactionPayloadHash_(copy) !== plan.planDigest) return tampered("PLAN_DIGEST_MISMATCH");
  return { ok: true, kind: "", reason: "" };
}
// Exact full verification of every business artifact against the frozen plan:
// complete header, line count/order/content/snapshots, event, both journal
// lines + signature + balance, audit, operation linkage. Cross-owner detection
// scans globally: a planned OrderLineID or journal LineID under a different
// owner, source-set vs ID-set membership differences even with equal counts,
// recognition/order/orderNumber crossovers, and audit-vs-operation set
// mismatches even with equal counts. Identity deviation never repairs; it
// classifies and fails closed. Unknown readbacks preserve identities.
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
  // ---- Cross-owner / crossover scans (global, before presence) ----
  var plannedLineIds = {};
  plan.lineRows.forEach(function(row) { plannedLineIds[row.OrderLineID] = true; });
  lines.forEach(function(row) {
    if (plannedLineIds[row.OrderLineID] && row.OrderID !== plan.orderID) {
      conflicts.push("ORDER_LINE_CROSS_OWNER");
    }
  });
  orders.forEach(function(row) {
    if (row.OrderNumber === plan.orderNumber && row.OrderID !== plan.orderID) {
      conflicts.push("ORDER_NUMBER_CROSS_OWNER");
    }
  });
  var plannedJournalLineIds = {};
  plan.journalRows.forEach(function(row) { plannedJournalLineIds[row.LineID] = true; });
  ledger.forEach(function(row) {
    if (plannedJournalLineIds[row.LineID] &&
        !(row.JournalID === plan.journalID &&
          row.SourceType === plan.journalRows[0].SourceType &&
          row.SourceID === plan.recognitionID)) {
      conflicts.push("JOURNAL_LINE_CROSS_OWNER");
    }
  });
  events.forEach(function(row) {
    if (row.RecognitionID === plan.recognitionID && row.OrderID !== plan.orderID) {
      conflicts.push("RECOGNITION_IDENTITY_CROSSOVER");
    }
    if (row.OperationID === plan.operationID && row.OrderID !== plan.orderID) {
      conflicts.push("EVENT_OPERATION_CROSS_OWNER");
    }
  });
  audits.forEach(function(row) {
    if (row.RecognitionID === plan.recognitionID && row.AuditID !== plan.auditID) {
      conflicts.push("AUDIT_RECOGNITION_CROSS_OWNER");
    }
    if (row.OperationID === plan.operationID && row.AuditID !== plan.auditID) {
      conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    }
    if (row.AuditID === plan.auditID && row.OperationID !== plan.operationID) {
      conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    }
  });
  // ---- Own-identity matches ----
  var orderMatches = orders.filter(function(row) { return row.OrderID === plan.orderID; });
  var lineMatches = lines.filter(function(row) { return row.OrderID === plan.orderID; });
  var eventMatches = events.filter(function(row) { return row.OrderID === plan.orderID; });
  var journalBySource = ledger.filter(function(row) {
    return row.SourceType === plan.journalRows[0].SourceType && row.SourceID === plan.recognitionID;
  });
  var journalById = ledger.filter(function(row) { return row.JournalID === plan.journalID; });
  var auditById = audits.filter(function(row) { return row.AuditID === plan.auditID; });
  var auditByOperation = audits.filter(function(row) { return row.OperationID === plan.operationID; });
  var present = orderMatches.length || lineMatches.length || eventMatches.length ||
    journalBySource.length || journalById.length || auditById.length || auditByOperation.length;
  if (!present) {
    // Our identities claimed elsewhere without any own artifacts: conflict,
    // not NONE (never re-append into a conflicting world).
    if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
    return { state: "NONE", detail: "NO_ARTIFACTS" };
  }

  // ---- Order ----
  if (orderMatches.length > 1) conflicts.push("ORDER_DUPLICATE");
  else if (orderMatches.length === 1 &&
      !salesRecognitionV2SaveRowExact_(orderMatches[0], plan.orderRow, t.ORDERS.HEADERS)) {
    conflicts.push("ORDER_TAMPERED");
  } else if (!orderMatches.length) missing.push("ORDER");

  // ---- Order lines ----
  if (lineMatches.length) {
    if (lineMatches.length > plan.lineRows.length) conflicts.push("ORDER_LINE_EXTRA");
    var seenLines = {};
    lineMatches.forEach(function(row, index) {
      var expected = null;
      plan.lineRows.forEach(function(candidate) {
        if (candidate.OrderLineID === row.OrderLineID) expected = candidate;
      });
      if (!expected) { conflicts.push("ORDER_LINE_EXTRA"); return; }
      if (seenLines[expected.OrderLineID]) { conflicts.push("ORDER_LINE_DUPLICATE"); return; }
      seenLines[expected.OrderLineID] = true;
      if (!salesRecognitionV2SaveRowExact_(row, expected, t.ORDER_LINES.HEADERS)) {
        conflicts.push("ORDER_LINE_TAMPERED");
      }
      if (!plan.lineRows[index] || plan.lineRows[index].OrderLineID !== row.OrderLineID) {
        conflicts.push("ORDER_LINE_ORDER");
      }
    });
    if (lineMatches.length < plan.lineRows.length) missing.push("ORDER_LINE");
  } else missing.push("ORDER_LINE");

  // ---- Event ----
  if (eventMatches.length > 1) conflicts.push("EVENT_DUPLICATE");
  else if (eventMatches.length === 1 &&
      !salesRecognitionV2SaveRowExact_(eventMatches[0], plan.eventRow, contract.HEADERS)) {
    conflicts.push("EVENT_TAMPERED");
  } else if (!eventMatches.length) missing.push("EVENT");

  // ---- Journal: source-set vs ID-set membership (equal counts included) ----
  if (journalBySource.length || journalById.length) {
    var sourceSet = journalBySource.map(function(row) { return String(row.LineID); }).sort().join("");
    var idSet = journalById.map(function(row) { return String(row.LineID); }).sort().join("");
    if (sourceSet !== idSet) conflicts.push("JOURNAL_IDENTITY_CROSSOVER");
    if (journalBySource.length === 1) {
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
      if (!(debit === credit && debit === Number(plan.orderTotal))) {
        conflicts.push("JOURNAL_BALANCE_MISMATCH");
      }
    } else conflicts.push("JOURNAL_DUPLICATE");
  } else missing.push("JOURNAL");

  // ---- Audit: content + ID-set vs operation-set membership ----
  if (auditById.length || auditByOperation.length) {
    if (auditById.length > 1) conflicts.push("AUDIT_DUPLICATE");
    else if (auditById.length === 1 &&
        !salesRecognitionV2SaveRowExact_(auditById[0], plan.auditRow, save.AUDIT_HEADERS)) {
      conflicts.push("AUDIT_TAMPERED");
    }
    var auditIdSet = auditById.map(function(row) { return String(row.AuditID); }).sort().join("");
    var auditOpSet = auditByOperation.map(function(row) { return String(row.AuditID); }).sort().join("");
    if (auditIdSet !== auditOpSet) conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    if (!auditById.length) missing.push("AUDIT");
  } else missing.push("AUDIT");

  if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
  if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
  return { state: "EXACT", detail: "" };
}

// Final commit verification: full raw readback of all ten operation fields
// against the just-committed in-memory row (Date-safe). Lost or mismatched
// readback after a successful update returns UNKNOWN (never DONE); the next
// retry verifies again.
function salesRecognitionV2SaveCommitVerify_(operation, runtime) {
  var t = TRANSACTION_PRODUCTION_CONTRACT;
  var committed = null;
  try {
    committed = runtime.repository.findOperation(operation.OperationType, operation.RequestKey);
  } catch (error) {
    return { ok: false, detail: "COMMIT_READBACK_FAILED:" + error.message };
  }
  if (!committed) return { ok: false, detail: "COMMIT_ROW_MISSING" };
  if (!salesRecognitionV2SaveFieldsExact_(committed, operation, t.OPERATIONS.HEADERS)) {
    var mismatch = t.OPERATIONS.HEADERS.filter(function(header) {
      return !salesRecognitionV2SaveFieldEqual_(committed[header], operation[header]);
    });
    return { ok: false, detail: "COMMIT_READBACK_MISMATCH:" + mismatch.join(",") };
  }
  if (committed.State !== "COMMITTED") return { ok: false, detail: "COMMIT_STATE_NOT_COMMITTED" };
  return { ok: true, detail: "" };
}

// Batch -> verify -> commit (with verified commit readback). Never retries a
// failed batch inside one call: an unknown batch outcome is inspected once and,
// if unresolved, reported as UNKNOWN with the request identity preserved.
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
  if (runtime.crash) runtime.crash("V2_AFTER_READBACK");
  if (runtime.crash) runtime.crash("V2_BEFORE_COMMIT");
  try { transactionCommitOperation_(runtime.repository, operation, runtime.now()); }
  catch (error) {
    return outcome(save.STATUS.UNKNOWN, { code: codes.COMMIT_OUTCOME_UNKNOWN,
      writeCount: rows, detail: error.message });
  }
  var commitCheck = salesRecognitionV2SaveCommitVerify_(operation, runtime);
  if (!commitCheck.ok) {
    return outcome(save.STATUS.UNKNOWN, { code: codes.COMMIT_OUTCOME_UNKNOWN,
      writeCount: rows, detail: commitCheck.detail });
  }
  if (runtime.crash) runtime.crash("V2_AFTER_COMMIT");
  return outcome(save.STATUS.DONE, { writeCount: rows });
}
// Resume path: exact (OperationType, RequestKey) lookup hit. Compares BOTH the
// digest and the exact persisted normalized structure; verifies the stored plan
// integrity digest + shape invariants; validates State (only IN_PROGRESS or
// COMMITTED proceed); re-checks stored bounds + schema (no mutable master
// recomputation) before touching artifacts. Tampered or partial state fails
// closed with ZERO additional writes. Same normalized payload replays or
// resumes from the persisted plan; a changed payload is a conflict.
function salesRecognitionV2SaveResume_(operation, hash, normalized, runtime) {
  var save = SALES_RECOGNITION_V2_SAVE, codes = save.CODES,
    t = TRANSACTION_PRODUCTION_CONTRACT;
  var requestKey = normalized.requestKey;
  function outcome(status, fields) {
    return salesRecognitionV2SaveResult_(status, Object.assign({
      requestKey: requestKey, operationID: operation.OperationID || "",
      orderID: operation.BusinessID || ""
    }, fields || {}));
  }
  if (operation.OperationType !== save.OPERATION_TYPE || !operation.BusinessID ||
      operation.RequestKey !== requestKey || operation.PayloadHash !== hash) {
    return outcome(save.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT });
  }
  var plan = null;
  try { plan = JSON.parse(operation.OperationPlan); } catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  if (!plan || plan.requestKey !== requestKey || plan.payloadHash !== hash ||
      plan.operationID !== operation.OperationID || plan.orderID !== operation.BusinessID) {
    return outcome(save.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT,
      detail: "PLAN_IDENTITY_MISMATCH" });
  }
  // Exact normalized structure comparison (digest alone is not sufficient).
  if (!plan.normalizedPayload ||
      JSON.stringify(plan.normalizedPayload) !== JSON.stringify(normalized)) {
    return outcome(save.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT,
      detail: "NORMALIZED_PAYLOAD_MISMATCH" });
  }
  // Plan integrity digest + shape invariants; tampered pending plan fails
  // closed with zero additional writes.
  var verify = salesRecognitionV2SaveVerifyPlan_(plan);
  if (!verify.ok) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason,
      recognitionID: plan.recognitionID || "", journalID: plan.journalID || "",
      auditID: plan.auditID || "" });
  }
  // Reject invalid persisted state rather than committing arbitrary state.
  if (operation.State !== "IN_PROGRESS" && operation.State !== "COMMITTED") {
    return outcome(save.STATUS.RECOVERY_REQUIRED, { code: codes.INVALID_OPERATION_STATE,
      detail: "STATE:" + String(operation.State),
      recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
  }
  // Stored bounds + schema re-check (headers/sizes only, no master rows).
  var schema = salesRecognitionV2SaveSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(save.STATUS.RECOVERY_REQUIRED, { code: codes.SCHEMA_NOT_READY,
      detail: schema.badSheets.join(","),
      recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
  }
  var bounds = salesRecognitionV2SaveBounds_(plan);
  if (!bounds.ok) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, { code: codes.BATCH_BOUNDS_EXCEEDED,
      detail: bounds.detail,
      recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
  }
  var inspection = salesRecognitionV2SaveInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(save.STATUS.UNKNOWN, { code: codes.READBACK_UNKNOWN, detail: inspection.detail,
      recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
  }
  var closedCode = inspection.state === "CONFLICT" ? codes.IDENTITY_CONFLICT : codes.ARTIFACTS_INCOMPLETE;
  if (inspection.state === "EXACT") {
    if (operation.State === "COMMITTED") {
      // COMMITTED verifies exact artifacts then replays DONE (response lost).
      if (runtime.crash) runtime.crash("V2_AFTER_COMMIT");
      return outcome(save.STATUS.DONE, { replay: true, writeCount: 0,
        recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
    }
    if (runtime.crash) runtime.crash("V2_AFTER_READBACK");
    if (runtime.crash) runtime.crash("V2_BEFORE_COMMIT");
    try { transactionCommitOperation_(runtime.repository, operation, runtime.now()); }
    catch (error) {
      return outcome(save.STATUS.UNKNOWN, { code: codes.COMMIT_OUTCOME_UNKNOWN, detail: error.message,
        recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
    }
    var commitCheck = salesRecognitionV2SaveCommitVerify_(operation, runtime);
    if (!commitCheck.ok) {
      return outcome(save.STATUS.UNKNOWN, { code: codes.COMMIT_OUTCOME_UNKNOWN,
        detail: commitCheck.detail,
        recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
    }
    if (runtime.crash) runtime.crash("V2_AFTER_COMMIT");
    return outcome(save.STATUS.DONE, { replay: true, writeCount: 0,
      recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (operation.State === "COMMITTED") {
    // COMMITTED without exact artifacts: fail closed, no repair.
    return outcome(save.STATUS.RECOVERY_REQUIRED, { code: closedCode, detail: inspection.detail,
      recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (inspection.state === "NONE") {
    return salesRecognitionV2SaveApplyBatch_(plan, operation, runtime);
  }
  // Partial or conflicting uncommitted artifacts: fail closed, never append/repair.
  return outcome(save.STATUS.RECOVERY_REQUIRED, { code: closedCode, detail: inspection.detail,
    recognitionID: plan.recognitionID, journalID: plan.journalID, auditID: plan.auditID });
}

// New intent path. Lookup already returned null; gates, master freeze (rows +
// analytical authority snapshots + normalized payload + integrity digest),
// bounds, intent persist + exact ten-field readback, then batch. Every gate
// refusal writes zero; an unsafe plan is never persisted.
function salesRecognitionV2SaveNewIntent_(normalized, hash, runtime) {
  var save = SALES_RECOGNITION_V2_SAVE, codes = save.CODES,
    t = TRANSACTION_PRODUCTION_CONTRACT;
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
  // Malformed nonblank effective dates and reversed windows fail closed.
  var windowGate = salesRecognitionV2SaveAuthorityGate_(authority);
  if (windowGate.status !== "PASS") {
    return outcome(save.STATUS.REFUSED, Object.assign({ code: codes.AUTHORITY_WINDOW_INVALID,
      detail: windowGate.detail }, base));
  }
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
  var plan;
  try {
    plan = salesRecognitionV2SavePlan_({ normalized: normalized, hash: hash, order: order,
      config: config, authority: authority, actor: runtime.actor(), now: now,
      economicDate: economicDate, operationID: operationID });
  } catch (error) {
    return outcome(save.STATUS.REFUSED, Object.assign({ code: error.code || codes.AUTHORITY_SNAPSHOT_MISMATCH,
      field: error.field || "", detail: error.message }, base));
  }
  // Freeze-time integrity + shape verification (definite, pre-write).
  var verify = salesRecognitionV2SaveVerifyPlan_(plan);
  if (!verify.ok) {
    return outcome(save.STATUS.REFUSED, Object.assign({
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason }, base));
  }
  var bounds = salesRecognitionV2SaveBounds_(plan);
  if (!bounds.ok) {
    return outcome(save.STATUS.REFUSED, Object.assign({ code: codes.BATCH_BOUNDS_EXCEEDED,
      detail: bounds.detail }, base));
  }
  if (runtime.crash) runtime.crash("V2_BEFORE_INTENT");
  var operation;
  try {
    operation = transactionResolveOperation_(runtime.repository, save.OPERATION_TYPE,
      normalized.requestKey, hash, orderID, plan, now);
  } catch (error) {
    return outcome(error.code === "OPERATION_PAYLOAD_CONFLICT" ? save.STATUS.CONFLICT : save.STATUS.RECOVERY_REQUIRED,
      Object.assign({ code: error.code === "OPERATION_PAYLOAD_CONFLICT" ?
        codes.OPERATION_PAYLOAD_CONFLICT : codes.DUPLICATE_OPERATION_EVIDENCE, detail: error.message }, base));
  }
  if (runtime.crash) runtime.crash("V2_AFTER_INTENT_PERSIST");
  // Exact readback of all ten operation fields (Date-safe) before any
  // business write.
  var readback = null;
  try { readback = runtime.repository.findOperation(save.OPERATION_TYPE, normalized.requestKey); }
  catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, Object.assign({ code: codes.INTENT_READBACK_FAILED,
      detail: "INTENT_READBACK_FAILED:" + error.message }, base));
  }
  if (!readback) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, Object.assign({ code: codes.INTENT_READBACK_FAILED,
      detail: "INTENT_ROW_MISSING" }, base));
  }
  if (readback.State !== "IN_PROGRESS" ||
      !salesRecognitionV2SaveFieldsExact_(readback, operation, t.OPERATIONS.HEADERS)) {
    var mismatch = t.OPERATIONS.HEADERS.filter(function(header) {
      return !salesRecognitionV2SaveFieldEqual_(readback[header], operation[header]);
    });
    return outcome(save.STATUS.RECOVERY_REQUIRED, Object.assign({ code: codes.INTENT_READBACK_FAILED,
      detail: "INTENT_ROW_MISMATCH:" + mismatch.join(",") }, base));
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
      requestKey: salesRecognitionV2SavePayloadKey_(payload),
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
  if (existing) return salesRecognitionV2SaveResume_(existing, hash, normalized, runtime);
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
    // U7: operator config resolver (fail-closed to the PREPARED default until
    // a future authorized activation records T + ActivationID).
    config: salesRecognitionV2OperatorConfig(salesRecognitionV2DefaultConfig()),
    batch: function(valueRanges) { return salesRecognitionV2SaveBatchRequest_(valueRanges); }
  };
  Object.defineProperty(runtime, "repository", { configurable: true, enumerable: true, get: function() {
    var repository = createTransactionSpreadsheetRepository(ss);
    Object.defineProperty(runtime, "repository", { configurable: true, enumerable: true, value: repository });
    return repository;
  } });
  return runtime;
}

// Resolve the five write-surface sheetIds from spreadsheet metadata (read-only)
// through the sanitized transport. Identity mismatch or any missing sheetId
// throws BEFORE the batchUpdate is issued: atomic rejection, no partial batch.
function salesRecognitionV2SaveSheetIdsRequest_() {
  var save = SALES_RECOGNITION_V2_SAVE;
  var response = inventoryReceiptMigrationRequest_("get",
    "?fields=" + encodeURIComponent("spreadsheetId,sheets.properties(sheetId,title)"));
  if (!response || response.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) {
    throw new Error("PRODUCTION_IDENTITY_MISMATCH");
  }
  var ids = {};
  (response.sheets || []).forEach(function(sheet) {
    var properties = sheet && sheet.properties;
    if (properties && save.WRITE_SURFACES.indexOf(properties.title) !== -1 &&
        typeof properties.sheetId === "number") {
      ids[properties.title] = properties.sheetId;
    }
  });
  var missing = save.WRITE_SURFACES.filter(function(name) { return typeof ids[name] !== "number"; });
  if (missing.length) throw new Error("SHEET_ID_UNAVAILABLE:" + missing.join(","));
  return ids;
}

// ONE Sheets REST mutation: spreadsheets.batchUpdate with exactly five
// appendCells subrequests (safe RAW CellData, userEnteredValue only) over the
// existing write surfaces. Reuses the sanitized migration transport
// (43.Inventory.Receipt.Migration.js signature: method, suffix, body); never
// logs tokens. The single batchUpdate is atomic (all five subrequests or none);
// intent/batch/readback/commit remain multistep — no database-global
// atomicity is claimed.
function salesRecognitionV2SaveBatchRequest_(valueRanges) {
  var sheetIds = salesRecognitionV2SaveSheetIdsRequest_();
  var body = salesRecognitionV2SaveBatchBody_(valueRanges, sheetIds);
  return inventoryReceiptMigrationRequest_("post", ":batchUpdate", body);
}

// Public entry: the ONLY outer lock, acquired BEFORE normalize/lookup and
// released exactly once. Lock or runtime failure happens before any durable
// intent, so it is a definite REFUSED (recovery-before-durable-intent); only
// post-intent execution uncertainty is UNKNOWN. The core never locks, so no
// nested locks are possible.
function salesRecognitionV2DurableSave(payload) {
  var save = SALES_RECOGNITION_V2_SAVE, runtime = null, acquired = false, result;
  var requestKey = salesRecognitionV2SavePayloadKey_(payload);
  try {
    runtime = salesRecognitionV2SaveRuntime_();
  } catch (error) {
    return salesRecognitionV2SaveResult_(save.STATUS.REFUSED, {
      code: save.CODES.SAVE_RUNTIME_UNAVAILABLE, requestKey: requestKey,
      detail: error && error.message ? error.message : "" });
  }
  try {
    runtime.lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return salesRecognitionV2SaveResult_(save.STATUS.REFUSED, {
      code: save.CODES.OUTER_LOCK_UNAVAILABLE, requestKey: requestKey,
      detail: error && error.message ? error.message : "" });
  }
  try {
    result = salesRecognitionV2SaveWithRuntime_(payload, runtime);
  } catch (error) {
    // Unknown only after the durable intent may exist; identity preserved.
    result = salesRecognitionV2SaveResult_(save.STATUS.UNKNOWN, {
      code: save.CODES.SAVE_EXECUTION_UNKNOWN, requestKey: requestKey,
      detail: error && error.message ? error.message : "" });
  } finally {
    if (acquired) {
      try { runtime.lock.releaseLock(); } catch (lockError) { /* lock auto-expires */ }
    }
  }
  return result;
}
