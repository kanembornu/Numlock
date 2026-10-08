// SALES_RECOGNITION_V2 U7 operator guard: config-aware routing for NEW Sales
// creation (PREPARED -> legacy current behavior, ACTIVE -> V2 durable Save
// only, PAUSED -> reject, unresolved/invalid config -> reject), server-
// enforced V2 retirements (payment / Receive Via / settlement / fulfillment /
// CLOSED mutation / cash posting / recovery reinterpretation), and cohort
// annotation for operator reads. Fail closed everywhere: a refusal never
// becomes a legacy fallback. Cohort comes ONLY from persisted V2 evidence
// (TransactionOperations + SalesRecognitionEvents bound to the exact OrderID);
// dates, sheet presence, and current mode never classify an order. This file
// never writes activation metadata: with no configured script property the
// resolver returns the U1 default (PREPARED), so today's production behavior
// is byte-for-byte unchanged until a future, separately authorized activation
// records T + ActivationID outside this contract.
var SALES_V2_OPERATOR = Object.freeze({
  CONFIG_PROPERTY: "SALES_RECOGNITION_V2_CONFIG",
  LEGACY_SALE_CODE: "SALES_V2_LEGACY_SALES_RETIRED",
  PAYMENT_CODE: "SALES_V2_PAYMENT_RETIRED",
  FULFILLMENT_CODE: "SALES_V2_FULFILLMENT_RETIRED",
  CASH_POST_CODE: "SALES_V2_NO_CASH_POST",
  CONFIG_INVALID_CODE: "CONFIG_INVALID",
  // Every operation type that makes an Order a sticky V2 cohort member.
  V2_OPERATION_TYPES: Object.freeze(["SALES_RECOGNITION_V2_SAVE", "SALES_V2_VOID", "SALES_V2_CORRECT"])
});

// ---------------------------------------------------------------------------
// Config resolution. Reads the operator config from script properties when a
// PropertiesService exists; absent/blank -> the supplied fallback (U1 default,
// PREPARED). Never mutates properties, never writes T/ActivationID.
// ---------------------------------------------------------------------------
function salesV2OperatorConfigState_(fallback) {
  var base = fallback === undefined || fallback === null ?
    salesRecognitionV2DefaultConfig() : fallback;
  var state = { config: base, unresolved: false };
  try {
    if (typeof PropertiesService === "undefined") return state;
    var raw = PropertiesService.getScriptProperties().getProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY);
    if (raw === null || raw === undefined || String(raw).trim() === "") return state;
    var parsed = JSON.parse(String(raw));
    if (validateSalesRecognitionV2Config(parsed).status !== "PASS") {
      // Present but invalid: fail closed to REJECT instead of silently
      // re-enabling legacy creation for a misconfigured cohort.
      state.unresolved = true;
      return state;
    }
    state.config = parsed;
  } catch (error) {
    state.unresolved = true;
  }
  return state;
}

function salesRecognitionV2OperatorConfig(fallback) {
  return salesV2OperatorConfigState_(fallback).config;
}

// Pure mode -> route decision. Reuses the U1 validation contract so a route
// can never be wider than the validated config.
function salesV2OperatorRoute_(config) {
  var codes = SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES;
  var validation = validateSalesRecognitionV2Config(config);
  if (validation.status !== "PASS") {
    return { mode: "REJECT", code: SALES_V2_OPERATOR.CONFIG_INVALID_CODE,
      message: "Sales routing configuration is invalid." };
  }
  var mode = config.mode;
  if (mode === "PREPARED") return { mode: "PREPARED", code: "", message: "" };
  if (mode === "ACTIVE") return { mode: "ACTIVE", code: "", message: "" };
  if (mode === "PAUSED") return { mode: "PAUSED", code: codes.V2_MODE_PAUSED,
    message: "New sales are paused." };
  return { mode: "REJECT", code: SALES_V2_OPERATOR.CONFIG_INVALID_CODE,
    message: "Sales routing configuration is invalid." };
}

function salesV2OperatorResolvedRoute_() {
  var state = salesV2OperatorConfigState_();
  if (state.unresolved) {
    return { mode: "REJECT", code: SALES_V2_OPERATOR.CONFIG_INVALID_CODE,
      message: "Sales routing configuration is invalid." };
  }
  return salesV2OperatorRoute_(state.config);
}

// ---------------------------------------------------------------------------
// Persisted cohort evidence. Reads operation rows through any repository
// shape (readRows/rows/read) and, when a spreadsheet is available, the
// SalesRecognitionEvents rows. Returns "" (legacy/pre-V2), "V2_PENDING" or
// "V2_COMMITTED". Unreadable evidence is simply absent evidence; only rows
// bound to the exact OrderID ever classify.
// ---------------------------------------------------------------------------
function salesV2OperatorOperationRows_(repository) {
  if (!repository) return null;
  try {
    if (typeof repository.readRows === "function") {
      var rows = repository.readRows("OPERATIONS");
      return Array.isArray(rows) ? rows : null;
    }
  } catch (error) { /* fall through */ }
  try {
    if (typeof repository.rows === "function") {
      var own = repository.rows();
      return Array.isArray(own) ? own : null;
    }
  } catch (error) { /* fall through */ }
  try {
    var snapshot = typeof repository.read === "function" ? repository.read() : null;
    if (snapshot && Array.isArray(snapshot.operations)) return snapshot.operations;
  } catch (error) { /* fall through */ }
  return null;
}

function salesV2OperatorEventRows_(spreadsheet) {
  if (!spreadsheet || typeof spreadsheet.getSheetByName !== "function") return null;
  try {
    return readCanonicalTable(spreadsheet, "SalesRecognitionEvents",
      SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  } catch (error) { return null; }
}

function salesV2OperatorOrderCohort_(orderID, repository, spreadsheet) {
  var id = String(orderID === undefined || orderID === null ? "" : orderID).trim();
  if (!id) return "";
  var seen = false, committed = false;
  var operations = salesV2OperatorOperationRows_(repository);
  if (operations) {
    for (var i = 0; i < operations.length; i++) {
      var operation = operations[i];
      if (!operation || typeof operation !== "object") continue;
      if (SALES_V2_OPERATOR.V2_OPERATION_TYPES.indexOf(String(operation.OperationType)) === -1) continue;
      if (String(operation.BusinessID === undefined || operation.BusinessID === null ? "" : operation.BusinessID).trim() !== id) continue;
      seen = true;
      if (String(operation.State === undefined || operation.State === null ? "" : operation.State).toUpperCase() === "COMMITTED") committed = true;
    }
  }
  if (!seen) {
    // Defense in depth for replacement orders: a corrected replacement has no
    // own SAVE operation, but its recognition event is bound to its OrderID.
    var events = salesV2OperatorEventRows_(spreadsheet);
    if (events) {
      for (var j = 0; j < events.length; j++) {
        var event = events[j];
        if (!event || typeof event !== "object") continue;
        if (String(event.OrderID === undefined || event.OrderID === null ? "" : event.OrderID).trim() !== id) continue;
        if (String(event.ContractVersion === undefined || event.ContractVersion === null ? "" : event.ContractVersion).trim() !== SALES_RECOGNITION_V2_CONTRACT.CONTRACT_VERSION) continue;
        seen = true;
        if (String(event.PostingStatus === undefined || event.PostingStatus === null ? "" : event.PostingStatus).toUpperCase() === SALES_RECOGNITION_V2_CONTRACT.COMMITTED_STATE) committed = true;
      }
    }
  }
  if (!seen) return "";
  return committed ? "V2_COMMITTED" : "V2_PENDING";
}

// ---------------------------------------------------------------------------
// Operator response mapping. One stable requestKey travels on every outcome;
// UNKNOWN/RECOVERY_REQUIRED are flagged `unknown` so the client keeps the
// identity and rechecks the SAME operation instead of treating a possible
// write as a definite failure.
// ---------------------------------------------------------------------------
function salesV2OperatorRefusalResponse_(code, message, field) {
  return { success: false, error: { code: code, message: message || code, field: field || null } };
}

function salesV2OperatorSaveResponse_(result, lookupOrder) {
  var save = SALES_RECOGNITION_V2_SAVE;
  var status = result && result.status;
  var requestKey = result && result.requestKey ? String(result.requestKey) : "";
  if (status === save.STATUS.DONE) {
    var dto = null;
    try { dto = lookupOrder ? lookupOrder(result.orderID) : null; }
    catch (error) { dto = null; }
    if (!dto) {
      dto = { OrderID: result.orderID, OrderNumber: result.orderID, OrderType: "",
        OrderTotal: 0, Lines: [] };
    }
    dto.salesCohort = "V2_COMMITTED";
    dto.recognitionStatus = "RECOGNIZED";
    return { success: true, data: dto, requestKey: requestKey };
  }
  var message = result && result.detail ? String(result.detail) :
    (result && result.code ? String(result.code) : "Sales save did not complete.");
  if (status === save.STATUS.UNKNOWN || status === save.STATUS.RECOVERY_REQUIRED) {
    return { success: false, unknown: true, requestKey: requestKey,
      error: { code: result && result.code ? String(result.code) : "SAVE_EXECUTION_UNKNOWN",
        message: message, field: null } };
  }
  return { success: false, requestKey: requestKey,
    error: { code: result && result.code ? String(result.code) : "REFUSED",
      message: message, field: result && result.field ? String(result.field) : null } };
}

function salesV2OperatorRepositoryLookup_(repository) {
  return function(orderID) {
    if (!repository || typeof repository.findOrder !== "function") return null;
    return transactionOperationalOrderTransportDto_(repository.findOrder(orderID));
  };
}

// ---------------------------------------------------------------------------
// NEW Sales creation routing (server side, fail closed).
// ---------------------------------------------------------------------------
function salesV2OperatorActiveCreate_(payload, runtime) {
  var requestKey = salesRecognitionV2SavePayloadKey_(payload);
  try {
    var result = salesRecognitionV2SaveWithRuntime_(payload, runtime);
    return salesV2OperatorSaveResponse_(result, salesV2OperatorRepositoryLookup_(runtime.repository));
  } catch (error) {
    // Exception after a possible durable write is UNKNOWN, never a definite
    // failure; the caller keeps this requestKey and rechecks the same intent.
    return { success: false, unknown: true, requestKey: requestKey,
      error: { code: "SAVE_EXECUTION_UNKNOWN",
        message: error && error.message ? String(error.message) : "SAVE_EXECUTION_UNKNOWN",
        field: null } };
  }
}

// Fixture-injectable dispatcher: explicit config (tests) or resolved config.
// PREPARED keeps the exact legacy writer; ACTIVE is V2-only with no fallback;
// PAUSED/REJECT refuse before any write.
function salesV2OperatorCreateWithRuntime_(payload, runtime, config) {
  var route = config === undefined || config === null ?
    salesV2OperatorResolvedRoute_() : salesV2OperatorRoute_(config);
  if (route.mode === "ACTIVE") return salesV2OperatorActiveCreate_(payload, runtime);
  if (route.mode === "PREPARED") {
    return createDurableOperationalOrder_(payload,
      transactionProductionAuthority_(runtime.spreadsheet), runtime, runtime.repository);
  }
  return salesV2OperatorRefusalResponse_(route.code, route.message, "transactionType");
}

// Production non-PREPARED branch for submitOperationalOrder. ACTIVE saves only
// through U2 (lock + runtime inside salesRecognitionV2DurableSave); any V2
// failure is surfaced as-is and never retried through the legacy writer.
function salesV2OperatorModeCreateOrder_(payload, route) {
  if (route.mode !== "ACTIVE") {
    return salesV2OperatorRefusalResponse_(route.code, route.message, "transactionType");
  }
  var result = salesRecognitionV2DurableSave(payload);
  return salesV2OperatorSaveResponse_(result, function(orderID) {
    var r = transactionProductionRuntime_();
    return salesV2OperatorRepositoryLookup_(r.repository)(orderID);
  });
}

// ---------------------------------------------------------------------------
// Legacy Sales creation guard (submitCanonicalTransaction SALES). Called
// before the lock and before any read/write.
// ---------------------------------------------------------------------------
function salesV2OperatorLegacySalesGuard_() {
  var route = salesV2OperatorResolvedRoute_();
  if (route.mode === "PREPARED") return null;
  var code = route.mode === "ACTIVE" ? SALES_V2_OPERATOR.LEGACY_SALE_CODE : route.code;
  var message = route.mode === "ACTIVE" ?
    "New sales are recorded through Sales Recognition V2." : route.message;
  return canonicalEntryFailure(canonicalEntryError(code, message, "transactionType"));
}

// ---------------------------------------------------------------------------
// V2 retirement guards for servicing mutations. Evidence-based: a pre-V2
// Order (no persisted V2 evidence) keeps its historical payment and
// fulfillment contract in every mode; a V2 order is refused before the first
// write regardless of the current mode.
// ---------------------------------------------------------------------------
function salesV2OperatorPaymentGuard_(orderID, repository, spreadsheet) {
  var cohort = salesV2OperatorOrderCohort_(orderID, repository, spreadsheet);
  if (!cohort) return;
  throw transactionOperationalError_(SALES_V2_OPERATOR.PAYMENT_CODE, "orderID",
    "Payments, Receive Via and settlement are retired for V2 sales.");
}

function salesV2OperatorFulfillmentGuard_(orderID, repository, spreadsheet) {
  var cohort = salesV2OperatorOrderCohort_(orderID, repository, spreadsheet);
  if (!cohort) return;
  throw transactionOperationalError_(SALES_V2_OPERATOR.FULFILLMENT_CODE, "orderID",
    "Fulfillment transitions and completion are retired for V2 sales.");
}

// Pure cash-posting guard used by buildCashPostingCandidate: a V2 sale can
// never produce a Cash/DANA/Bank/Unknown posting candidate.
function salesV2OperatorCashPostBlocked_(transactionId, context) {
  var id = String(transactionId === undefined || transactionId === null ? "" : transactionId).trim();
  if (!id) return false;
  var operations = context && Array.isArray(context.salesRecognitionOperations) ?
    context.salesRecognitionOperations : [];
  for (var i = 0; i < operations.length; i++) {
    var operation = operations[i];
    if (!operation || typeof operation !== "object") continue;
    if (SALES_V2_OPERATOR.V2_OPERATION_TYPES.indexOf(String(operation.OperationType)) === -1) continue;
    if (String(operation.BusinessID === undefined || operation.BusinessID === null ? "" : operation.BusinessID).trim() === id) return true;
  }
  var events = context && Array.isArray(context.salesRecognitionEvents) ?
    context.salesRecognitionEvents : [];
  for (var j = 0; j < events.length; j++) {
    var event = events[j];
    if (!event || typeof event !== "object") continue;
    if (String(event.OrderID === undefined || event.OrderID === null ? "" : event.OrderID).trim() === id) return true;
  }
  return false;
}

// Optional sheet readers for the cash runtime (absent sheet/headers -> no
// evidence, never a throw, never a behavior change for legacy settlements).
function salesV2OperatorOptionalOperationRows_(spreadsheet) {
  if (!spreadsheet || typeof spreadsheet.getSheetByName !== "function") return [];
  try {
    return readCanonicalTable(spreadsheet, "TransactionOperations",
      TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS);
  } catch (error) { return []; }
}

function salesV2OperatorOptionalEventRows_(spreadsheet) {
  var rows = salesV2OperatorEventRows_(spreadsheet);
  return rows || [];
}

// ---------------------------------------------------------------------------
// Recovery routing. Persisted V2 operations are recovered ONLY through the
// V2 cores (resume semantics from the frozen plan); the legacy recovery
// dispatcher never reinterprets them as ORDER_CREATE/PAYMENT work.
// ---------------------------------------------------------------------------
function salesV2OperatorIsRecoveryOperation_(operationType) {
  return SALES_V2_OPERATOR.V2_OPERATION_TYPES.indexOf(String(operationType || "")) !== -1;
}

function salesV2OperatorV2Runtime_(runtime) {
  return {
    spreadsheet: runtime.spreadsheet,
    repository: runtime.repository,
    now: typeof runtime.now === "function" ? runtime.now : function() { return new Date(); },
    actor: typeof runtime.actor === "function" ? runtime.actor : function() { return CANONICAL_ENTRY.USER; },
    // Recovery always runs under the configured mode; a PAUSED config still
    // replays persisted intents because the cores gate only NEW intents.
    config: salesRecognitionV2OperatorConfig(salesRecognitionV2DefaultConfig()),
    batch: typeof runtime.batch === "function" ? runtime.batch :
      function(valueRanges, operationType) {
        return operationType ?
          salesRecognitionV2MutationBatchRequest_(operationType, valueRanges) :
          salesRecognitionV2SaveBatchRequest_(valueRanges);
      }
  };
}

function salesV2OperatorRecoverWithRuntime_(operation, runtime) {
  var plan = null;
  try { plan = JSON.parse(operation.OperationPlan); }
  catch (error) {
    throw transactionOperationalError_("SALES_V2_OPERATION_PLAN_MALFORMED", "operationID",
      "The persisted V2 operation plan could not be parsed.");
  }
  if (!plan || !plan.normalizedPayload || typeof plan.normalizedPayload !== "object") {
    throw transactionOperationalError_("SALES_V2_OPERATION_PLAN_MALFORMED", "operationID",
      "The persisted V2 operation plan has no normalized payload.");
  }
  var type = String(operation.OperationType);
  var v2runtime = salesV2OperatorV2Runtime_(runtime);
  if (type === SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE) {
    salesRecognitionV2SaveWithRuntime_(plan.normalizedPayload, v2runtime);
  } else {
    salesRecognitionV2MutationRun_(type, plan.normalizedPayload, v2runtime);
  }
  // The persisted operation row is the sole outcome authority: COMMITTED
  // means recovered, IN_PROGRESS keeps the caller in the unknown/retry loop.
  var rows = salesV2OperatorOperationRows_(runtime.repository) || [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].OperationID) === String(operation.OperationID)) return rows[i];
  }
  return operation;
}

// ---------------------------------------------------------------------------
// Operator read annotation (cohort-aware, additive, evidence-only).
// ---------------------------------------------------------------------------
function salesV2OperatorAnnotateOrder_(order, repository, spreadsheet) {
  if (!order || typeof order !== "object") return order;
  var cohort = salesV2OperatorOrderCohort_(order.OrderID, repository, spreadsheet);
  if (!cohort) return order;
  order.salesCohort = cohort;
  order.recognitionStatus = cohort === "V2_COMMITTED" ? "RECOGNIZED" : "PENDING_RECOGNITION";
  return order;
}

// RequestKey identity is stable across mode routing: a persisted operation
// under the routed type with the same RequestKey is the same intent.
function salesV2OperatorFindOperationByRequestKey_(repository, requestKey) {
  var rows = salesV2OperatorOperationRows_(repository) || [];
  var key = String(requestKey === undefined || requestKey === null ? "" : requestKey);
  var found = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].RequestKey) !== key) continue;
    if (found) return null; // ambiguous identity fails closed
    found = rows[i];
  }
  return found;
}
