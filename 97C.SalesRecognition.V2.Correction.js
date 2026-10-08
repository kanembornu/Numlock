// SALES_RECOGNITION_V2 U6 durable mutation core: append-only SALES_V2_VOID
// and SALES_V2_CORRECT over the frozen V2 recognition model. Reuses the U2
// durable-operation architecture (97A): outer lock (wrapper only) ->
// normalize -> exact (OperationType, RequestKey) lookup BEFORE any mutable
// target/master recalculation -> resume from the persisted plan or new intent
// (eligibility -> freeze plan once -> persist IN_PROGRESS -> exact readback ->
// ONE atomic spreadsheets.batchUpdate -> exact artifact verification ->
// verified COMMITTED readback -> DONE). Original recognized artifacts are
// immutable: the plan stores target digests and every inspect verifies them.
// VOID = one negative REVERSAL event + exactly two BalanceLedger lines
// (Dr4000/Cr1030 of the exact recognized amount) + one Void audit. CORRECT =
// full original reversal (Dr4000/Cr1030) + complete replacement recognition
// (Dr1030/Cr4000 of the replacement OrderTotal) in ONE intent and ONE batch;
// never delta-only, never split. Replacement receives a NEW OrderID (Orders is
// keyed by OrderID: a second header row for the same OrderID would be a
// DUPLICATE_ORDER and breaks U3 single-pass order processing), NEW RevisionID,
// NEW RecognitionID, NEW JournalID, NEW AuditID, NEW LineIDs; lineage travels
// on existing event fields (OriginalID / ReversalOfRecognitionID /
// ReplacementID). EconomicDate for both effects is the server-recorded
// ACTION-period date; original periods are never rewritten. Policy C frozen:
// no Cash/Bank/Payment/Settlement mutation, no automatic Dr1100/Cr5000, no
// COGS/HPP posting, no InventoryLedger movement, no automatic Dr1030/Cr2010.
// V2 stays PREPARED/disabled: the default config refuses with zero writes.
var SALES_RECOGNITION_V2_MUTATION = Object.freeze({
  VOID: "SALES_V2_VOID",
  CORRECT: "SALES_V2_CORRECT",
  OPERATION_TYPES: Object.freeze(["SALES_V2_VOID", "SALES_V2_CORRECT"]),
  PLAN_VERSION: 1,
  // The ONLY surfaces each mutation batch may ever touch. Everything else
  // (Payments, Settlements, Cash, InventoryLedger, tabsal, tabops, Logs) is a
  // forbidden artifact.
  WRITE_SURFACES: Object.freeze({
    "SALES_V2_VOID": Object.freeze(["SalesRecognitionEvents", "BalanceLedger",
      "SalesRecognitionAudits"]),
    "SALES_V2_CORRECT": Object.freeze(["Orders", "OrderLines",
      "SalesRecognitionEvents", "BalanceLedger", "SalesRecognitionAudits"])
  }),
  // Deterministic identity derivations (verified by plan shape checks). The
  // reversal side derives from (OperationType, RequestKey, target OrderID);
  // the replacement side derives from its own NEW OrderID exactly the way a
  // fresh U2 Save would derive its identities.
  REVERSAL_PREFIXES: Object.freeze({ recognition: "SCRV-", revision: "REVV-",
    journal: "SRV2JV-", audit: "SRAV-" }),
  MAX_ORDER_LINES: 50,
  MAX_BATCH_CELLS: 4000,
  MAX_REQUEST_BYTES: 1000000,
  MAX_CELL_CHARS: 45000,
  REQUEST_OVERHEAD_BYTES: 4096,
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
    EVIDENCE_READ_FAILED: "SALES_V2_EVIDENCE_READ_FAILED",
    TARGET_NOT_FOUND: "SALES_V2_TARGET_NOT_FOUND",
    TARGET_NOT_V2: "SALES_V2_TARGET_NOT_V2_COMMITTED",
    TARGET_NOT_CLEAN: "SALES_V2_TARGET_NOT_CLEAN",
    TARGET_AMBIGUOUS: "SALES_V2_TARGET_AMBIGUOUS",
    TARGET_ALREADY_VOIDED: "SALES_V2_TARGET_ALREADY_VOIDED",
    MUTATION_EXISTS: "SALES_V2_MUTATION_EXISTS",
    MUTATION_INTENT_MALFORMED: "SALES_V2_MUTATION_INTENT_MALFORMED",
    LEGACY_IDENTITY_REJECTED: "SALES_V2_LEGACY_IDENTITY_REJECTED",
    REASON_INVALID: "REASON_INVALID",
    ECONOMIC_DATE_INVALID: "ECONOMIC_DATE_INVALID",
    AUTHORITY_WINDOW_INVALID: "AUTHORITY_WINDOW_INVALID",
    PRODUCT_VARIANT_EFFECTIVE_WINDOW: "PRODUCT_VARIANT_EFFECTIVE_WINDOW",
    AUTHORITY_SNAPSHOT_MISMATCH: "AUTHORITY_SNAPSHOT_MISMATCH",
    OPERATION_PAYLOAD_CONFLICT: "OPERATION_PAYLOAD_CONFLICT",
    DUPLICATE_OPERATION_EVIDENCE: "DUPLICATE_OPERATION_EVIDENCE",
    BATCH_BOUNDS_EXCEEDED: "BATCH_BOUNDS_EXCEEDED",
    ARTIFACTS_INCOMPLETE: "ARTIFACTS_INCOMPLETE",
    IDENTITY_CONFLICT: "IDENTITY_CONFLICT",
    BATCH_OUTCOME_UNKNOWN: "BATCH_OUTCOME_UNKNOWN",
    READBACK_UNKNOWN: "READBACK_UNKNOWN",
    COMMIT_OUTCOME_UNKNOWN: "COMMIT_OUTCOME_UNKNOWN",
    PLAN_MALFORMED: "PLAN_MALFORMED",
    INTENT_READBACK_FAILED: "INTENT_READBACK_FAILED",
    INVALID_OPERATION_STATE: "INVALID_OPERATION_STATE",
    OUTER_LOCK_UNAVAILABLE: "OUTER_LOCK_UNAVAILABLE",
    MUTATION_RUNTIME_UNAVAILABLE: "SALES_V2_MUTATION_RUNTIME_UNAVAILABLE",
    MUTATION_EXECUTION_UNKNOWN: "SALES_V2_MUTATION_EXECUTION_UNKNOWN"
  })
});

// ---------------------------------------------------------------------------
// Normalize. Definite refusals (missing key/target/reason, legacy identity)
// fail here before any read or write. Legacy canonical identities (SAL-/OPS-)
// are rejected by the V2 path in both directions of the cross-guard.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationPayloadKey_(payload) {
  return payload && payload.requestKey !== undefined && payload.requestKey !== null ?
    String(payload.requestKey) : "";
}

function salesRecognitionV2MutationIsLegacyIdentity_(text) {
  var upper = String(text || "").trim().toUpperCase();
  return upper.indexOf("SAL-") === 0 || upper.indexOf("OPS-") === 0;
}

function salesRecognitionV2MutationTargetText_(payload) {
  var codes = SALES_RECOGNITION_V2_MUTATION.CODES;
  var target = String(payload && (payload.orderID !== undefined && payload.orderID !== null ?
    payload.orderID : payload.transactionId) || "").trim();
  if (target.indexOf("ORDER:") === 0) target = target.slice(6).trim();
  if (!target) {
    throw transactionOperationalError_("TARGET_ORDER_REQUIRED", "orderID");
  }
  if (salesRecognitionV2MutationIsLegacyIdentity_(target)) {
    throw transactionOperationalError_(codes.LEGACY_IDENTITY_REJECTED, "orderID");
  }
  return target;
}

function salesRecognitionV2MutationReason_(payload) {
  var codes = SALES_RECOGNITION_V2_MUTATION.CODES;
  var reason = typeof (payload && payload.reason) === "string" ? payload.reason.trim() : "";
  if (!reason) throw transactionOperationalError_("REASON_REQUIRED", "reason");
  if (reason.length < 3 || reason.length > 500 || !/[A-Za-z0-9]/.test(reason)) {
    throw transactionOperationalError_(codes.REASON_INVALID, "reason");
  }
  return reason;
}

function salesRecognitionV2MutationNormalizeVoid_(payload) {
  var codes = SALES_RECOGNITION_V2_MUTATION.CODES;
  var requestKey = transactionOperationalText_(payload && payload.requestKey,
    "REQUEST_KEY_REQUIRED", "requestKey");
  if (salesRecognitionV2MutationIsLegacyIdentity_(requestKey)) {
    throw transactionOperationalError_(codes.LEGACY_IDENTITY_REJECTED, "requestKey");
  }
  return { requestKey: requestKey, orderID: salesRecognitionV2MutationTargetText_(payload),
    reason: salesRecognitionV2MutationReason_(payload) };
}

function salesRecognitionV2MutationNormalizeCorrect_(payload) {
  var codes = SALES_RECOGNITION_V2_MUTATION.CODES;
  var requestKey = transactionOperationalText_(payload && payload.requestKey,
    "REQUEST_KEY_REQUIRED", "requestKey");
  if (salesRecognitionV2MutationIsLegacyIdentity_(requestKey)) {
    throw transactionOperationalError_(codes.LEGACY_IDENTITY_REJECTED, "requestKey");
  }
  // Replacement inputs normalize exactly like U2 Save economic inputs.
  var orderPart = salesRecognitionV2NormalizeSave_({ requestKey: requestKey,
    orderType: payload && payload.orderType, lines: payload && payload.lines });
  return { requestKey: requestKey, orderID: salesRecognitionV2MutationTargetText_(payload),
    reason: salesRecognitionV2MutationReason_(payload),
    orderType: orderPart.orderType, lines: orderPart.lines };
}

// ---------------------------------------------------------------------------
// Deterministic identity derivations.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationReversalId_(prefix, operationType, requestKey,
  targetOrderID) {
  return transactionStableBootstrapId_(prefix, [operationType, requestKey, targetOrderID]);
}

function salesRecognitionV2MutationReplacementIds_(operationType, requestKey) {
  var orderID = transactionStableBusinessID_("ORD-", operationType, requestKey);
  return { orderID: orderID, orderNumber: orderID,
    revisionID: transactionStableBootstrapId_("REV-", [orderID]),
    recognitionID: transactionStableBootstrapId_("SCR-", [orderID]),
    journalID: transactionStableBootstrapId_("SRV2J-", [orderID]),
    auditID: transactionStableBootstrapId_("SRA-", [orderID]) };
}

// ---------------------------------------------------------------------------
// Eligibility. Proven from the shared U3 projection authority (sticky V2
// cohort, committed target, clean chain, terminal lifecycle) plus the
// repository's own durable intents. Never infers from ID format or current
// masters; target identity comes only from persisted V2 evidence.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationCompetingGate_(repository, operationType,
  requestKey, targetOrderID) {
  var codes = SALES_RECOGNITION_V2_MUTATION.CODES,
    types = SALES_RECOGNITION_V2_MUTATION.OPERATION_TYPES;
  var rows = null;
  try {
    rows = typeof repository.readRows === "function" ? repository.readRows("OPERATIONS") :
      repository.rows();
  } catch (error) {
    return { status: "FAIL", code: codes.MUTATION_INTENT_MALFORMED,
      detail: "OPERATION_READ_FAILED:" + error.message };
  }
  var list = rows || [];
  for (var i = 0; i < list.length; i++) {
    var op = list[i];
    if (types.indexOf(String(op.OperationType)) === -1) continue;
    if (String(op.OperationType) === operationType && String(op.RequestKey) === requestKey) {
      continue; // this identity is handled by the exact lookup
    }
    var plan = null;
    try { plan = JSON.parse(op.OperationPlan); } catch (error) {
      return { status: "FAIL", code: codes.MUTATION_INTENT_MALFORMED,
        detail: String(op.OperationType) + ":" + String(op.RequestKey) };
    }
    if (!plan || String(plan.targetOrderID || "") !== String(targetOrderID)) continue;
    // Any other durable mutation intent already bound to this target: at most
    // one terminal winner exists; a second key fails closed here.
    return { status: "FAIL", code: codes.MUTATION_EXISTS,
      detail: String(op.OperationType) + ":" + String(op.RequestKey) + ":" +
        String(op.State) };
  }
  return { status: "PASS", code: "", detail: "" };
}

function salesRecognitionV2MutationResolveTarget_(operationType, normalized, runtime) {
  var codes = SALES_RECOGNITION_V2_MUTATION.CODES,
    contract = SALES_RECOGNITION_V2_CONTRACT;
  var sources = null, projection = null;
  try {
    sources = readRecognizedSalesProjectionSources_(runtime.spreadsheet);
    if (sources.issues.length) {
      return { ok: false, code: codes.EVIDENCE_READ_FAILED,
        detail: sources.issues[0].code + ":" + sources.issues[0].sourceIdentity };
    }
    projection = buildRecognizedSalesProjection_(sources);
  } catch (error) {
    return { ok: false, code: codes.EVIDENCE_READ_FAILED, detail: error.message };
  }
  var chainKey = "ORDER:" + normalized.orderID;
  var header = null;
  (projection.transactions || []).forEach(function(entry) {
    if (entry.kind === "ORDER" && String(entry.sourceIdentity) === chainKey) header = entry;
  });
  if (!header) return { ok: false, code: codes.TARGET_NOT_FOUND, detail: "ORDER" };
  if (String(header.cohort) !== contract.COHORTS.V2_COMMITTED) {
    return { ok: false, code: codes.TARGET_NOT_V2, detail: String(header.cohort) };
  }
  // Unresolved integrity/recovery evidence anywhere on this chain fails closed.
  var prefix = chainKey + ":";
  var unclean = (projection.quality.issues || []).concat(projection.quality.excluded || [])
    .filter(function(entry) {
      return String(entry.sourceIdentity || "").indexOf(prefix) === 0;
    });
  if (unclean.length) {
    return { ok: false, code: codes.TARGET_NOT_CLEAN, detail: String(unclean[0].code) };
  }
  var chainEvents = (projection.events || []).filter(function(event) {
    return event.chainKey === chainKey && event.status === "RECOGNIZED";
  });
  var reversals = chainEvents.filter(function(event) {
    return event.eventType === "REVERSAL";
  });
  var recognitions = chainEvents.filter(function(event) {
    return event.eventType === "RECOGNITION";
  });
  var replacements = recognitions.filter(function(event) {
    return String(event.originalId || "") !== "";
  });
  if (replacements.length > 1) {
    return { ok: false, code: codes.TARGET_AMBIGUOUS, detail: "MULTIPLE_REPLACEMENTS" };
  }
  // Current active revision: the replacement when one exists, otherwise the
  // sole recognition. Reversal events are never a target.
  var targetEvent = replacements.length === 1 ? replacements[0] :
    (recognitions.length === 1 ? recognitions[0] : null);
  if (!targetEvent) {
    return { ok: false, code: codes.TARGET_AMBIGUOUS,
      detail: "RECOGNITIONS=" + recognitions.length };
  }
  var terminal = reversals.some(function(reversal) {
    return String(reversal.reversalOfRecognitionId) === String(targetEvent.recognitionId);
  });
  if (terminal) {
    return { ok: false, code: codes.TARGET_ALREADY_VOIDED,
      detail: String(targetEvent.recognitionId) };
  }
  var gate = salesRecognitionV2MutationCompetingGate_(runtime.repository, operationType,
    normalized.requestKey, normalized.orderID);
  if (gate.status !== "PASS") {
    return { ok: false, code: gate.code, detail: gate.detail };
  }
  // Raw persisted rows for the frozen plan + immutability digests.
  var eventRows = (sources.rows.SalesRecognitionEvents || []).filter(function(row) {
    return String(row.RecognitionID) === String(targetEvent.recognitionId);
  });
  if (eventRows.length !== 1) {
    return { ok: false, code: codes.TARGET_NOT_CLEAN,
      detail: "EVENT_ROWS=" + eventRows.length };
  }
  var eventRow = eventRows[0];
  var journalRows = (sources.rows.BalanceLedger || []).filter(function(row) {
    return String(row.JournalID) === String(eventRow.RecognitionJournalID) &&
      String(row.SourceID) === String(eventRow.RecognitionID);
  });
  var auditRows = (sources.rows.SalesRecognitionAudits || []).filter(function(row) {
    return String(row.AuditID) === String(eventRow.AuditID);
  });
  var orderRows = (sources.rows.Orders || []).filter(function(row) {
    return String(row.OrderID) === normalized.orderID;
  });
  var lineRows = (sources.rows.OrderLines || []).filter(function(row) {
    return String(row.OrderID) === normalized.orderID;
  });
  if (orderRows.length !== 1 || !journalRows.length || auditRows.length !== 1 ||
      !lineRows.length) {
    return { ok: false, code: codes.TARGET_NOT_CLEAN, detail: "TARGET_EVIDENCE" };
  }
  var target = { orderID: normalized.orderID,
    revisionID: String(eventRow.RevisionID),
    recognitionID: String(eventRow.RecognitionID),
    journalID: String(eventRow.RecognitionJournalID),
    auditID: String(eventRow.AuditID),
    operationID: String(eventRow.OperationID),
    amount: Number(eventRow.Amount),
    economicDate: String(eventRow.EconomicDate),
    activationID: String(eventRow.ActivationID),
    contractVersion: String(eventRow.ContractVersion),
    identity: chainKey + ":" + String(eventRow.RevisionID) };
  if (!isFinite(target.amount) || target.amount <= 0) {
    return { ok: false, code: codes.TARGET_NOT_CLEAN, detail: "TARGET_AMOUNT" };
  }
  return { ok: true, target: target,
    targetEvidence: { event: transactionPayloadHash_(eventRow),
      journal: transactionPayloadHash_(journalRows),
      audit: transactionPayloadHash_(auditRows[0]),
      order: transactionPayloadHash_(orderRows[0]),
      orderLines: transactionPayloadHash_(lineRows) },
    projection: projection, sources: sources };
}

// ---------------------------------------------------------------------------
// Plan builders. Every identity, journal line, event row, audit row, snapshot,
// and linkage value is derived once here and persisted immutably in
// OperationPlan together with the canonical integrity digest.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationReversalJournalRows_(journalID, recognitionID,
  amount, economicDate, nowISO, actor) {
  var save = SALES_RECOGNITION_V2_SAVE;
  // Frozen accounting: Dr4000 / Cr1030 of the exact recognized amount.
  return [
    { JournalID: journalID, LineID: journalID + "-1", Tanggal: economicDate,
      AccountCode: save.JOURNAL_ACCOUNTS.REVENUE, Debit: amount, Credit: 0,
      MovementType: save.JOURNAL_MOVEMENT_TYPE, SourceType: save.JOURNAL_SOURCE_TYPE,
      SourceID: recognitionID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor },
    { JournalID: journalID, LineID: journalID + "-2", Tanggal: economicDate,
      AccountCode: save.JOURNAL_ACCOUNTS.SETTLEMENT, Debit: 0, Credit: amount,
      MovementType: save.JOURNAL_MOVEMENT_TYPE, SourceType: save.JOURNAL_SOURCE_TYPE,
      SourceID: recognitionID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor }
  ];
}

function salesRecognitionV2MutationReversalRows_(input) {
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    mutation = SALES_RECOGNITION_V2_MUTATION, prefixes = mutation.REVERSAL_PREFIXES;
  var operationType = input.operationType, requestKey = input.requestKey,
    target = input.target, nowISO = input.now.toISOString(), actor = input.actor,
    economicDate = input.economicDate, amount = target.amount;
  var recognitionID = salesRecognitionV2MutationReversalId_(prefixes.recognition,
    operationType, requestKey, target.orderID);
  var revisionID = salesRecognitionV2MutationReversalId_(prefixes.revision,
    operationType, requestKey, target.orderID);
  var journalID = salesRecognitionV2MutationReversalId_(prefixes.journal,
    operationType, requestKey, target.orderID);
  var auditID = salesRecognitionV2MutationReversalId_(prefixes.audit,
    operationType, requestKey, target.orderID);
  var journalRows = salesRecognitionV2MutationReversalJournalRows_(journalID,
    recognitionID, amount, economicDate, nowISO, actor);
  var journalSignature = policyCJournalSignature_(journalRows);
  var snapshot = { contractVersion: input.config.contractVersion,
    activationID: input.config.activationID, orderTotal: amount,
    journalSignature: journalSignature,
    target: { orderID: target.orderID, revisionID: target.revisionID,
      recognitionID: target.recognitionID, journalID: target.journalID,
      operationID: target.operationID, identity: target.identity },
    replacementRecognitionID: input.replacementRecognitionID || "" };
  var eventRow = { RecognitionID: recognitionID,
    ContractVersion: contract.CONTRACT_VERSION, ActivationID: input.config.activationID,
    OrderID: target.orderID, RevisionID: revisionID, EventType: "REVERSAL",
    RecognizedAt: nowISO, EconomicDate: economicDate, Amount: amount,
    RecognitionJournalID: journalID, JournalSignature: journalSignature,
    PostingStatus: save.POSTING_STATUS, OperationID: input.operationID,
    AuditID: auditID, OriginalID: "", ReversalOfRecognitionID: target.recognitionID,
    ReplacementID: input.replacementRecognitionID || "", Reason: input.reason,
    Actor: actor, SnapshotJSON: JSON.stringify(snapshot) };
  var auditRow = { AuditID: auditID, ContractVersion: contract.CONTRACT_VERSION,
    OperationID: input.operationID, RequestKey: requestKey, OrderID: target.orderID,
    RecognitionID: recognitionID, JournalID: journalID, PayloadHash: input.hash,
    Actor: actor, SavedAt: nowISO };
  return { recognitionID: recognitionID, revisionID: revisionID, journalID: journalID,
    auditID: auditID, journalRows: journalRows, journalSignature: journalSignature,
    eventRow: eventRow, auditRow: auditRow };
}

function salesRecognitionV2MutationVoidPlan_(input) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, save = SALES_RECOGNITION_V2_SAVE,
    contract = SALES_RECOGNITION_V2_CONTRACT;
  var reversal = salesRecognitionV2MutationReversalRows_(input);
  var plan = { planVersion: mutation.PLAN_VERSION,
    contractVersion: contract.CONTRACT_VERSION, mode: input.config.mode,
    activationID: input.config.activationID, activatedAt: input.config.activatedAt,
    configVersion: input.config.configVersion,
    operationType: mutation.VOID, operationID: input.operationID,
    requestKey: input.requestKey, payloadHash: input.hash,
    normalizedPayload: input.normalized, targetOrderID: input.target.orderID,
    businessID: input.target.orderID, target: input.target,
    targetEvidence: input.targetEvidence, reason: input.reason,
    actor: input.actor, actionAt: input.now.toISOString(),
    economicDate: input.economicDate, amount: input.target.amount,
    accounts: { settlement: save.JOURNAL_ACCOUNTS.SETTLEMENT,
      revenue: save.JOURNAL_ACCOUNTS.REVENUE },
    reversalRecognitionID: reversal.recognitionID,
    reversalRevisionID: reversal.revisionID,
    reversalJournalID: reversal.journalID,
    reversalAuditID: reversal.auditID,
    journalSignature: reversal.journalSignature,
    reversalEventRow: reversal.eventRow,
    reversalJournalRows: reversal.journalRows,
    reversalAuditRow: reversal.auditRow,
    replacement: null };
  plan.planDigest = transactionPayloadHash_(plan);
  return plan;
}

function salesRecognitionV2MutationCorrectPlan_(input) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, save = SALES_RECOGNITION_V2_SAVE,
    contract = SALES_RECOGNITION_V2_CONTRACT, t = TRANSACTION_PRODUCTION_CONTRACT;
  var order = input.order, nowISO = input.now.toISOString();
  var replacementIds = input.replacementIds;
  var orderTotal = Number(order.OrderTotal), hppTotal = Number(order.HppTotalSnapshot);
  var lineRows = (order.Lines || []).map(function(line, index) {
    return { OrderLineID: "OL-" + replacementIds.orderID + "-" + (index + 1),
      OrderID: replacementIds.orderID, ProductID: line.productID,
      ProductVariantID: line.productVariantID, Tipe: line.tipe, Qty: line.qty,
      SellingPriceSnapshot: line.sellingPriceSnapshot,
      RecipeVersionID: line.recipeVersionID, UnitHppSnapshot: line.unitHppSnapshot,
      LineTotal: line.lineTotal, LineHpp: line.lineHpp };
  });
  var lineAuthority = (order.Lines || []).map(function(line) {
    return salesRecognitionV2SaveLineAuthority_(line, input.authority, input.now);
  });
  var journalRows = [
    { JournalID: replacementIds.journalID, LineID: replacementIds.journalID + "-1",
      Tanggal: input.economicDate, AccountCode: save.JOURNAL_ACCOUNTS.SETTLEMENT,
      Debit: orderTotal, Credit: 0, MovementType: save.JOURNAL_MOVEMENT_TYPE,
      SourceType: save.JOURNAL_SOURCE_TYPE, SourceID: replacementIds.recognitionID,
      ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: input.actor, UpdatedAt: nowISO, UpdatedBy: input.actor },
    { JournalID: replacementIds.journalID, LineID: replacementIds.journalID + "-2",
      Tanggal: input.economicDate, AccountCode: save.JOURNAL_ACCOUNTS.REVENUE,
      Debit: 0, Credit: orderTotal, MovementType: save.JOURNAL_MOVEMENT_TYPE,
      SourceType: save.JOURNAL_SOURCE_TYPE, SourceID: replacementIds.recognitionID,
      ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: input.actor, UpdatedAt: nowISO, UpdatedBy: input.actor }
  ];
  var journalSignature = policyCJournalSignature_(journalRows);
  var snapshot = { contractVersion: contract.CONTRACT_VERSION,
    activationID: input.config.activationID, revisionID: replacementIds.revisionID,
    journalID: replacementIds.journalID, journalSignature: journalSignature,
    orderTotal: orderTotal, hppTotalSnapshot: hppTotal,
    lines: lineRows.map(function(row) {
      return { OrderLineID: row.OrderLineID, ProductVariantID: row.ProductVariantID,
        Qty: row.Qty, SellingPriceSnapshot: row.SellingPriceSnapshot,
        RecipeVersionID: row.RecipeVersionID, UnitHppSnapshot: row.UnitHppSnapshot,
        LineTotal: row.LineTotal, LineHpp: row.LineHpp };
    }),
    authority: lineAuthority };
  var replacementEventRow = { RecognitionID: replacementIds.recognitionID,
    ContractVersion: contract.CONTRACT_VERSION, ActivationID: input.config.activationID,
    OrderID: replacementIds.orderID, RevisionID: replacementIds.revisionID,
    EventType: "RECOGNITION", RecognizedAt: nowISO, EconomicDate: input.economicDate,
    Amount: orderTotal, RecognitionJournalID: replacementIds.journalID,
    JournalSignature: journalSignature, PostingStatus: save.POSTING_STATUS,
    OperationID: input.operationID, AuditID: replacementIds.auditID,
    OriginalID: input.target.recognitionID, ReversalOfRecognitionID: "",
    ReplacementID: "", Reason: input.reason, Actor: input.actor,
    SnapshotJSON: JSON.stringify(snapshot) };
  var orderRow = { OrderID: replacementIds.orderID,
    OrderNumber: replacementIds.orderNumber, OrderType: order.OrderType,
    PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN", OrderTotal: orderTotal,
    HppTotalSnapshot: hppTotal, CreatedAt: nowISO, CreatedBy: input.actor,
    PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: nowISO,
    UpdatedBy: input.actor };
  var replacementAuditRow = { AuditID: replacementIds.auditID,
    ContractVersion: contract.CONTRACT_VERSION, OperationID: input.operationID,
    RequestKey: input.requestKey, OrderID: replacementIds.orderID,
    RecognitionID: replacementIds.recognitionID,
    JournalID: replacementIds.journalID, PayloadHash: input.hash,
    Actor: input.actor, SavedAt: nowISO };
  // The reversal is frozen AFTER the replacement so its ReplacementID lineage
  // points at the replacement recognition inside the same intent.
  var reversal = salesRecognitionV2MutationReversalRows_(Object.assign({}, input,
    { replacementRecognitionID: replacementIds.recognitionID }));
  var plan = { planVersion: mutation.PLAN_VERSION,
    contractVersion: contract.CONTRACT_VERSION, mode: input.config.mode,
    activationID: input.config.activationID, activatedAt: input.config.activatedAt,
    configVersion: input.config.configVersion,
    operationType: mutation.CORRECT, operationID: input.operationID,
    requestKey: input.requestKey, payloadHash: input.hash,
    normalizedPayload: input.normalized, targetOrderID: input.target.orderID,
    businessID: replacementIds.orderID, target: input.target,
    targetEvidence: input.targetEvidence, reason: input.reason,
    actor: input.actor, actionAt: input.now.toISOString(),
    economicDate: input.economicDate, amount: input.target.amount,
    accounts: { settlement: save.JOURNAL_ACCOUNTS.SETTLEMENT,
      revenue: save.JOURNAL_ACCOUNTS.REVENUE },
    reversalRecognitionID: reversal.recognitionID,
    reversalRevisionID: reversal.revisionID,
    reversalJournalID: reversal.journalID,
    reversalAuditID: reversal.auditID,
    journalSignature: reversal.journalSignature,
    reversalEventRow: reversal.eventRow,
    reversalJournalRows: reversal.journalRows,
    reversalAuditRow: reversal.auditRow,
    replacement: { orderID: replacementIds.orderID,
      orderNumber: replacementIds.orderNumber,
      revisionID: replacementIds.revisionID,
      recognitionID: replacementIds.recognitionID,
      journalID: replacementIds.journalID,
      auditID: replacementIds.auditID,
      orderType: order.OrderType, orderTotal: orderTotal,
      hppTotalSnapshot: hppTotal,
      orderRow: orderRow, lineRows: lineRows, lineAuthority: lineAuthority,
      journalRows: journalRows, journalSignature: journalSignature,
      eventRow: replacementEventRow, auditRow: replacementAuditRow } };
  plan.planDigest = transactionPayloadHash_(plan);
  return plan;
}

// ---------------------------------------------------------------------------
// Plan integrity + shape invariants. Runs at freeze time (definite REFUSED,
// before any write) and on every resume (fail closed, ZERO additional writes).
// Distinguishes malformed shape (PLAN_MALFORMED) from tampered content
// (IDENTITY_CONFLICT).
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationVerifyPlan_(plan) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, save = SALES_RECOGNITION_V2_SAVE,
    contract = SALES_RECOGNITION_V2_CONTRACT, t = TRANSACTION_PRODUCTION_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS,
    prefixes = mutation.REVERSAL_PREFIXES;
  function malformed(reason) { return { ok: false, kind: "MALFORMED", reason: reason }; }
  function tampered(reason) { return { ok: false, kind: "TAMPERED", reason: reason }; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return malformed("PLAN_NOT_OBJECT");
  if (plan.planVersion !== mutation.PLAN_VERSION) return malformed("PLAN_VERSION_MISMATCH");
  if (plan.contractVersion !== contract.CONTRACT_VERSION) return malformed("CONTRACT_VERSION_MISMATCH");
  if (plan.operationType !== mutation.VOID && plan.operationType !== mutation.CORRECT) {
    return malformed("OPERATION_TYPE_MISMATCH");
  }
  if (typeof plan.requestKey !== "string" || !plan.requestKey) return malformed("REQUEST_KEY_MISSING");
  if (typeof plan.operationID !== "string" || !plan.operationID) return malformed("OPERATION_ID_MISSING");
  if (typeof plan.payloadHash !== "string" || !plan.payloadHash) return malformed("PAYLOAD_HASH_MISSING");
  if (typeof plan.targetOrderID !== "string" || !plan.targetOrderID) return malformed("TARGET_ORDER_ID_MISSING");
  if (!plan.target || typeof plan.target !== "object") return malformed("TARGET_MISSING");
  if (!plan.targetEvidence || typeof plan.targetEvidence !== "object") return malformed("TARGET_EVIDENCE_MISSING");
  if (!plan.normalizedPayload || typeof plan.normalizedPayload !== "object") {
    return malformed("NORMALIZED_PAYLOAD_MISSING");
  }
  if (plan.operationType === mutation.CORRECT &&
      !Array.isArray(plan.normalizedPayload.lines)) {
    return malformed("NORMALIZED_PAYLOAD_MISSING");
  }
  if (plan.operationType === mutation.VOID &&
      (String(plan.normalizedPayload.orderID) !== plan.targetOrderID ||
        typeof plan.normalizedPayload.reason !== "string" ||
        !plan.normalizedPayload.reason)) {
    return tampered("NORMALIZED_PAYLOAD_IDENTITY_MISMATCH");
  }
  if (!plan.accounts) return malformed("ACCOUNT_MAPPING_MISSING");
  if (plan.accounts.settlement !== save.JOURNAL_ACCOUNTS.SETTLEMENT ||
      plan.accounts.revenue !== save.JOURNAL_ACCOUNTS.REVENUE) {
    return tampered("ACCOUNT_MAPPING_MISMATCH");
  }
  // Deterministic identity derivations.
  if (plan.operationID !== transactionOperationID_(plan.operationType, plan.requestKey)) {
    return tampered("OPERATION_ID_DERIVATION_MISMATCH");
  }
  if (plan.targetOrderID !== plan.target.orderID) return tampered("TARGET_ORDER_MISMATCH");
  if (plan.reversalRecognitionID !== salesRecognitionV2MutationReversalId_(
      prefixes.recognition, plan.operationType, plan.requestKey, plan.targetOrderID)) {
    return tampered("REVERSAL_RECOGNITION_ID_DERIVATION_MISMATCH");
  }
  if (plan.reversalRevisionID !== salesRecognitionV2MutationReversalId_(
      prefixes.revision, plan.operationType, plan.requestKey, plan.targetOrderID)) {
    return tampered("REVERSAL_REVISION_ID_DERIVATION_MISMATCH");
  }
  if (plan.reversalJournalID !== salesRecognitionV2MutationReversalId_(
      prefixes.journal, plan.operationType, plan.requestKey, plan.targetOrderID)) {
    return tampered("REVERSAL_JOURNAL_ID_DERIVATION_MISMATCH");
  }
  if (plan.reversalAuditID !== salesRecognitionV2MutationReversalId_(
      prefixes.audit, plan.operationType, plan.requestKey, plan.targetOrderID)) {
    return tampered("REVERSAL_AUDIT_ID_DERIVATION_MISMATCH");
  }
  if (plan.operationType === mutation.VOID) {
    if (plan.businessID !== plan.targetOrderID) return tampered("BUSINESS_ID_MISMATCH");
    if (plan.replacement !== null && plan.replacement !== undefined) {
      return malformed("REPLACEMENT_IN_VOID");
    }
  } else {
    var ids = salesRecognitionV2MutationReplacementIds_(plan.operationType, plan.requestKey);
    var replacement = plan.replacement;
    if (!replacement || typeof replacement !== "object") return malformed("REPLACEMENT_MISSING");
    if (plan.businessID !== ids.orderID || replacement.orderID !== ids.orderID ||
        replacement.orderNumber !== ids.orderNumber) {
      return tampered("REPLACEMENT_ORDER_ID_DERIVATION_MISMATCH");
    }
    if (replacement.revisionID !== ids.revisionID) return tampered("REPLACEMENT_REVISION_ID_MISMATCH");
    if (replacement.recognitionID !== ids.recognitionID) return tampered("REPLACEMENT_RECOGNITION_ID_MISMATCH");
    if (replacement.journalID !== ids.journalID) return tampered("REPLACEMENT_JOURNAL_ID_MISMATCH");
    if (replacement.auditID !== ids.auditID) return tampered("REPLACEMENT_AUDIT_ID_MISMATCH");
  }
  // Target identity, amount, lineage fields.
  var target = plan.target;
  if (typeof target.recognitionID !== "string" || !target.recognitionID ||
      typeof target.revisionID !== "string" || !target.revisionID ||
      typeof target.journalID !== "string" || !target.journalID ||
      typeof target.auditID !== "string" || !target.auditID ||
      typeof target.identity !== "string" || !target.identity) {
    return malformed("TARGET_IDENTITY_INCOMPLETE");
  }
  if (!isFinite(Number(plan.amount)) || Number(plan.amount) <= 0 ||
      Number(target.amount) !== Number(plan.amount)) {
    return malformed("AMOUNT_INVALID");
  }
  if (typeof plan.economicDate !== "string" || !capitalEquityDateKey(plan.economicDate)) {
    return malformed("ECONOMIC_DATE_INVALID");
  }
  if (typeof plan.actor !== "string" || !plan.actor || typeof plan.actionAt !== "string" ||
      !plan.actionAt) {
    return malformed("ACTOR_OR_TIMESTAMP_MISSING");
  }
  if (typeof plan.reason !== "string" || plan.reason.length < 3 ||
      plan.reason.length > 500 || !/[A-Za-z0-9]/.test(plan.reason)) {
    return malformed("REASON_INVALID");
  }
  // Immutability digests for every original artifact class.
  var evidenceKeys = ["event", "journal", "audit", "order", "orderLines"];
  for (var e = 0; e < evidenceKeys.length; e++) {
    if (typeof plan.targetEvidence[evidenceKeys[e]] !== "string" ||
        !plan.targetEvidence[evidenceKeys[e]]) {
      return malformed("TARGET_EVIDENCE_" + evidenceKeys[e].toUpperCase() + "_MISSING");
    }
  }
  // Reversal journal: two lines, exact direction Dr4000/Cr1030, date, signature.
  var reversalJournal = plan.reversalJournalRows;
  if (!Array.isArray(reversalJournal) || reversalJournal.length !== 2) {
    return malformed("REVERSAL_JOURNAL_ROWS_INVALID");
  }
  var r0 = reversalJournal[0], r1 = reversalJournal[1];
  if (ledgerHeaders.some(function(header) {
      return r0[header] === undefined || r1[header] === undefined;
    })) {
    return malformed("REVERSAL_JOURNAL_ROW_INCOMPLETE");
  }
  if (r0.LineID === r1.LineID) return malformed("REVERSAL_JOURNAL_LINE_ID_DUPLICATE");
  if (r0.JournalID !== plan.reversalJournalID || r1.JournalID !== plan.reversalJournalID) {
    return tampered("REVERSAL_JOURNAL_ID_MISMATCH");
  }
  if (r0.LineID !== plan.reversalJournalID + "-1" ||
      r1.LineID !== plan.reversalJournalID + "-2") {
    return tampered("REVERSAL_JOURNAL_LINE_ID_MISMATCH");
  }
  if (r0.SourceID !== plan.reversalRecognitionID || r1.SourceID !== plan.reversalRecognitionID) {
    return tampered("REVERSAL_JOURNAL_SOURCE_MISMATCH");
  }
  if (r0.SourceType !== save.JOURNAL_SOURCE_TYPE || r1.SourceType !== save.JOURNAL_SOURCE_TYPE ||
      r0.MovementType !== save.JOURNAL_MOVEMENT_TYPE ||
      r1.MovementType !== save.JOURNAL_MOVEMENT_TYPE) {
    return tampered("REVERSAL_JOURNAL_CLASSIFICATION_MISMATCH");
  }
  if (r0.AccountCode !== save.JOURNAL_ACCOUNTS.REVENUE ||
      r1.AccountCode !== save.JOURNAL_ACCOUNTS.SETTLEMENT) {
    return tampered("REVERSAL_JOURNAL_ACCOUNT_MAPPING_MISMATCH");
  }
  if (Number(r0.Debit) !== Number(plan.amount) || Number(r0.Credit) !== 0 ||
      Number(r1.Debit) !== 0 || Number(r1.Credit) !== Number(plan.amount)) {
    return tampered("REVERSAL_JOURNAL_AMOUNT_MISMATCH");
  }
  if (r0.Tanggal !== plan.economicDate || r1.Tanggal !== plan.economicDate) {
    return tampered("REVERSAL_JOURNAL_DATE_MISMATCH");
  }
  if (typeof plan.journalSignature !== "string" || !plan.journalSignature ||
      policyCJournalSignature_(reversalJournal) !== plan.journalSignature) {
    return tampered("REVERSAL_JOURNAL_SIGNATURE_MISMATCH");
  }
  // Reversal event: complete header, lineage, amount, date, signature, snapshot.
  var reversalEvent = plan.reversalEventRow;
  if (!reversalEvent || typeof reversalEvent !== "object") return malformed("REVERSAL_EVENT_ROW_MISSING");
  if (contract.HEADERS.some(function(header) {
      return reversalEvent[header] === undefined;
    })) {
    return malformed("REVERSAL_EVENT_ROW_INCOMPLETE");
  }
  if (reversalEvent.RecognitionID !== plan.reversalRecognitionID ||
      reversalEvent.OrderID !== plan.targetOrderID ||
      reversalEvent.RevisionID !== plan.reversalRevisionID ||
      reversalEvent.OperationID !== plan.operationID ||
      reversalEvent.AuditID !== plan.reversalAuditID ||
      reversalEvent.ContractVersion !== contract.CONTRACT_VERSION ||
      reversalEvent.EventType !== "REVERSAL" ||
      reversalEvent.PostingStatus !== save.POSTING_STATUS ||
      reversalEvent.EconomicDate !== plan.economicDate ||
      reversalEvent.RecognitionJournalID !== plan.reversalJournalID ||
      reversalEvent.JournalSignature !== plan.journalSignature ||
      Number(reversalEvent.Amount) !== Number(plan.amount) ||
      reversalEvent.ReversalOfRecognitionID !== target.recognitionID ||
      reversalEvent.OriginalID !== "" || reversalEvent.Reason !== plan.reason) {
    return tampered("REVERSAL_EVENT_ROW_MISMATCH");
  }
  if (plan.operationType === mutation.CORRECT) {
    if (reversalEvent.ReplacementID !== plan.replacement.recognitionID) {
      return tampered("REVERSAL_REPLACEMENT_LINEAGE_MISMATCH");
    }
  } else if (reversalEvent.ReplacementID !== "") {
    return tampered("REVERSAL_REPLACEMENT_LINEAGE_UNEXPECTED");
  }
  var reversalSnapshot = null;
  try { reversalSnapshot = JSON.parse(reversalEvent.SnapshotJSON); }
  catch (error) { return malformed("REVERSAL_SNAPSHOT_JSON_INVALID"); }
  if (!reversalSnapshot || typeof reversalSnapshot !== "object" ||
      reversalSnapshot.journalSignature !== plan.journalSignature ||
      Number(reversalSnapshot.orderTotal) !== Number(plan.amount) ||
      !reversalSnapshot.target ||
      String(reversalSnapshot.target.recognitionID) !== target.recognitionID ||
      String(reversalSnapshot.target.identity) !== target.identity) {
    return tampered("REVERSAL_SNAPSHOT_CONTENT_MISMATCH");
  }
  // Reversal audit: complete header + all linkages.
  var reversalAudit = plan.reversalAuditRow;
  if (!reversalAudit || typeof reversalAudit !== "object") return malformed("REVERSAL_AUDIT_ROW_MISSING");
  if (save.AUDIT_HEADERS.some(function(header) {
      return reversalAudit[header] === undefined;
    })) {
    return malformed("REVERSAL_AUDIT_ROW_INCOMPLETE");
  }
  if (reversalAudit.AuditID !== plan.reversalAuditID ||
      reversalAudit.OperationID !== plan.operationID ||
      reversalAudit.RequestKey !== plan.requestKey ||
      reversalAudit.OrderID !== plan.targetOrderID ||
      reversalAudit.RecognitionID !== plan.reversalRecognitionID ||
      reversalAudit.JournalID !== plan.reversalJournalID ||
      reversalAudit.PayloadHash !== plan.payloadHash ||
      reversalAudit.ContractVersion !== contract.CONTRACT_VERSION ||
      reversalAudit.SavedAt !== plan.actionAt) {
    return tampered("REVERSAL_AUDIT_ROW_MISMATCH");
  }
  // Replacement sections (CORRECT only): mirror the frozen U2 Save invariants.
  if (plan.operationType === mutation.CORRECT) {
    var rep = plan.replacement;
    if (plan.normalizedPayload.orderType !== rep.orderType) {
      return tampered("REPLACEMENT_ORDER_TYPE_MISMATCH");
    }
    if (!rep.orderRow || typeof rep.orderRow !== "object") return malformed("REPLACEMENT_ORDER_ROW_MISSING");
    if (t.ORDERS.HEADERS.some(function(header) { return rep.orderRow[header] === undefined; })) {
      return malformed("REPLACEMENT_ORDER_ROW_INCOMPLETE");
    }
    if (rep.orderRow.OrderID !== rep.orderID || rep.orderRow.OrderNumber !== rep.orderNumber ||
        rep.orderRow.OrderType !== rep.orderType ||
        Number(rep.orderRow.OrderTotal) !== Number(rep.orderTotal) ||
        Number(rep.orderRow.HppTotalSnapshot) !== Number(rep.hppTotalSnapshot)) {
      return tampered("REPLACEMENT_ORDER_ROW_MISMATCH");
    }
    if (!Array.isArray(rep.lineRows) || !rep.lineRows.length) return malformed("REPLACEMENT_LINE_ROWS_MISSING");
    var seenLines = {}, sumTotal = 0, sumHpp = 0;
    for (var i = 0; i < rep.lineRows.length; i++) {
      var line = rep.lineRows[i];
      if (t.ORDER_LINES.HEADERS.some(function(header) { return line[header] === undefined; })) {
        return malformed("REPLACEMENT_ORDER_LINE_INCOMPLETE");
      }
      if (line.OrderLineID !== "OL-" + rep.orderID + "-" + (i + 1)) {
        return tampered("REPLACEMENT_ORDER_LINE_ID_MISMATCH");
      }
      if (seenLines[line.OrderLineID]) return malformed("REPLACEMENT_ORDER_LINE_ID_DUPLICATE");
      seenLines[line.OrderLineID] = true;
      if (line.OrderID !== rep.orderID) return tampered("REPLACEMENT_ORDER_LINE_OWNER_MISMATCH");
      var qty = Number(line.Qty), price = Number(line.SellingPriceSnapshot),
        unit = Number(line.UnitHppSnapshot), total = Number(line.LineTotal),
        hpp = Number(line.LineHpp);
      if (!isFinite(qty) || qty <= 0 || !isFinite(price) || price <= 0 ||
          !isFinite(unit) || unit < 0 || !isFinite(total) || !isFinite(hpp)) {
        return malformed("REPLACEMENT_ORDER_LINE_NUMBERS_INVALID");
      }
      if (Math.abs(qty * price - total) > 1e-9) return tampered("REPLACEMENT_ORDER_LINE_TOTAL_MISMATCH");
      if (Math.abs(qty * unit - hpp) > 1e-9) return tampered("REPLACEMENT_ORDER_LINE_HPP_MISMATCH");
      sumTotal += total;
      sumHpp += hpp;
    }
    if (Math.abs(sumTotal - Number(rep.orderTotal)) > 1e-9) {
      return tampered("REPLACEMENT_ORDER_TOTAL_SUM_MISMATCH");
    }
    if (Math.abs(sumHpp - Number(rep.hppTotalSnapshot)) > 1e-9) {
      return tampered("REPLACEMENT_HPP_TOTAL_SUM_MISMATCH");
    }
    if (!Array.isArray(rep.lineAuthority) || rep.lineAuthority.length !== rep.lineRows.length) {
      return malformed("REPLACEMENT_LINE_AUTHORITY_MISSING");
    }
    for (var a = 0; a < rep.lineAuthority.length; a++) {
      var authority = rep.lineAuthority[a], lineRow = rep.lineRows[a];
      if (!authority || !authority.variant || !authority.recipe || !authority.price ||
          !Array.isArray(authority.components) || !authority.components.length) {
        return malformed("REPLACEMENT_LINE_AUTHORITY_INCOMPLETE");
      }
      if (authority.variant.ProductVariantID !== lineRow.ProductVariantID) {
        return tampered("REPLACEMENT_AUTHORITY_VARIANT_MISMATCH");
      }
      if (authority.recipe.RecipeVersionID !== lineRow.RecipeVersionID) {
        return tampered("REPLACEMENT_AUTHORITY_RECIPE_MISMATCH");
      }
      if (Number(authority.price.Harga) !== Number(lineRow.SellingPriceSnapshot)) {
        return tampered("REPLACEMENT_AUTHORITY_PRICE_MISMATCH");
      }
      var reconstructed = 0;
      for (var c = 0; c < authority.components.length; c++) {
        var component = authority.components[c];
        if (!component || !component.ItemID || !Array.isArray(component.conversions) ||
            !component.standardCost || !isFinite(Number(component.standardCost.StandardCost)) ||
            Number(component.standardCost.StandardCost) < 0 ||
            !isFinite(Number(component.QtyBase)) || Number(component.QtyBase) <= 0) {
          return malformed("REPLACEMENT_LINE_AUTHORITY_COMPONENT_INVALID");
        }
        reconstructed += Number(component.QtyBase) * Number(component.standardCost.StandardCost);
      }
      if (Math.abs(reconstructed - Number(lineRow.UnitHppSnapshot)) > 1e-9) {
        return tampered("REPLACEMENT_AUTHORITY_HPP_MISMATCH");
      }
    }
    var replacementJournal = rep.journalRows;
    if (!Array.isArray(replacementJournal) || replacementJournal.length !== 2) {
      return malformed("REPLACEMENT_JOURNAL_ROWS_INVALID");
    }
    var j0 = replacementJournal[0], j1 = replacementJournal[1];
    if (ledgerHeaders.some(function(header) {
        return j0[header] === undefined || j1[header] === undefined;
      })) {
      return malformed("REPLACEMENT_JOURNAL_ROW_INCOMPLETE");
    }
    if (j0.LineID === j1.LineID) return malformed("REPLACEMENT_JOURNAL_LINE_ID_DUPLICATE");
    if (j0.JournalID !== rep.journalID || j1.JournalID !== rep.journalID) {
      return tampered("REPLACEMENT_JOURNAL_ID_MISMATCH");
    }
    if (j0.LineID !== rep.journalID + "-1" || j1.LineID !== rep.journalID + "-2") {
      return tampered("REPLACEMENT_JOURNAL_LINE_ID_MISMATCH");
    }
    if (j0.SourceID !== rep.recognitionID || j1.SourceID !== rep.recognitionID) {
      return tampered("REPLACEMENT_JOURNAL_SOURCE_MISMATCH");
    }
    if (j0.AccountCode !== save.JOURNAL_ACCOUNTS.SETTLEMENT ||
        j1.AccountCode !== save.JOURNAL_ACCOUNTS.REVENUE ||
        j0.MovementType !== save.JOURNAL_MOVEMENT_TYPE ||
        j1.MovementType !== save.JOURNAL_MOVEMENT_TYPE ||
        j0.SourceType !== save.JOURNAL_SOURCE_TYPE ||
        j1.SourceType !== save.JOURNAL_SOURCE_TYPE) {
      return tampered("REPLACEMENT_JOURNAL_CLASSIFICATION_MISMATCH");
    }
    if (Number(j0.Debit) !== Number(rep.orderTotal) || Number(j0.Credit) !== 0 ||
        Number(j1.Debit) !== 0 || Number(j1.Credit) !== Number(rep.orderTotal)) {
      return tampered("REPLACEMENT_JOURNAL_AMOUNT_MISMATCH");
    }
    if (j0.Tanggal !== plan.economicDate || j1.Tanggal !== plan.economicDate) {
      return tampered("REPLACEMENT_JOURNAL_DATE_MISMATCH");
    }
    if (typeof rep.journalSignature !== "string" || !rep.journalSignature ||
        policyCJournalSignature_(replacementJournal) !== rep.journalSignature) {
      return tampered("REPLACEMENT_JOURNAL_SIGNATURE_MISMATCH");
    }
    var replacementEvent = rep.eventRow;
    if (!replacementEvent || typeof replacementEvent !== "object") {
      return malformed("REPLACEMENT_EVENT_ROW_MISSING");
    }
    if (contract.HEADERS.some(function(header) {
        return replacementEvent[header] === undefined;
      })) {
      return malformed("REPLACEMENT_EVENT_ROW_INCOMPLETE");
    }
    if (replacementEvent.RecognitionID !== rep.recognitionID ||
        replacementEvent.OrderID !== rep.orderID ||
        replacementEvent.RevisionID !== rep.revisionID ||
        replacementEvent.OperationID !== plan.operationID ||
        replacementEvent.AuditID !== rep.auditID ||
        replacementEvent.ContractVersion !== contract.CONTRACT_VERSION ||
        replacementEvent.EventType !== "RECOGNITION" ||
        replacementEvent.PostingStatus !== save.POSTING_STATUS ||
        replacementEvent.EconomicDate !== plan.economicDate ||
        replacementEvent.RecognitionJournalID !== rep.journalID ||
        replacementEvent.JournalSignature !== rep.journalSignature ||
        Number(replacementEvent.Amount) !== Number(rep.orderTotal) ||
        replacementEvent.OriginalID !== target.recognitionID ||
        replacementEvent.ReversalOfRecognitionID !== "" ||
        replacementEvent.ReplacementID !== "" ||
        replacementEvent.Reason !== plan.reason) {
      return tampered("REPLACEMENT_EVENT_ROW_MISMATCH");
    }
    var replacementSnapshot = null;
    try { replacementSnapshot = JSON.parse(replacementEvent.SnapshotJSON); }
    catch (error) { return malformed("REPLACEMENT_SNAPSHOT_JSON_INVALID"); }
    if (!replacementSnapshot || typeof replacementSnapshot !== "object" ||
        replacementSnapshot.journalSignature !== rep.journalSignature ||
        !Array.isArray(replacementSnapshot.authority) ||
        replacementSnapshot.authority.length !== rep.lineRows.length ||
        Number(replacementSnapshot.orderTotal) !== Number(rep.orderTotal)) {
      return tampered("REPLACEMENT_SNAPSHOT_CONTENT_MISMATCH");
    }
    var replacementAudit = rep.auditRow;
    if (!replacementAudit || typeof replacementAudit !== "object") {
      return malformed("REPLACEMENT_AUDIT_ROW_MISSING");
    }
    if (save.AUDIT_HEADERS.some(function(header) {
        return replacementAudit[header] === undefined;
      })) {
      return malformed("REPLACEMENT_AUDIT_ROW_INCOMPLETE");
    }
    if (replacementAudit.AuditID !== rep.auditID ||
        replacementAudit.OperationID !== plan.operationID ||
        replacementAudit.RequestKey !== plan.requestKey ||
        replacementAudit.OrderID !== rep.orderID ||
        replacementAudit.RecognitionID !== rep.recognitionID ||
        replacementAudit.JournalID !== rep.journalID ||
        replacementAudit.PayloadHash !== plan.payloadHash ||
        replacementAudit.ContractVersion !== contract.CONTRACT_VERSION ||
        replacementAudit.SavedAt !== plan.actionAt) {
      return tampered("REPLACEMENT_AUDIT_ROW_MISMATCH");
    }
  }
  if (typeof plan.planDigest !== "string" || !plan.planDigest) return malformed("PLAN_DIGEST_MISSING");
  var copy = Object.assign({}, plan);
  delete copy.planDigest;
  if (transactionPayloadHash_(copy) !== plan.planDigest) return tampered("PLAN_DIGEST_MISMATCH");
  return { ok: true, kind: "", reason: "" };
}

// ---------------------------------------------------------------------------
// The ONE batch's logical ranges, in frozen plan order.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationRowValues_(row, headers) {
  return headers.map(function(header) {
    return row[header] === undefined ? "" : row[header];
  });
}

function salesRecognitionV2MutationValueRanges_(plan) {
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    mutation = SALES_RECOGNITION_V2_MUTATION, t = TRANSACTION_PRODUCTION_CONTRACT;
  var ranges;
  if (plan.operationType === mutation.VOID) {
    ranges = [
      { range: contract.SHEET, values: [salesRecognitionV2MutationRowValues_(
        plan.reversalEventRow, contract.HEADERS)] },
      { range: "BalanceLedger", values: plan.reversalJournalRows.map(function(row) {
        return salesRecognitionV2MutationRowValues_(row,
          BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS); }) },
      { range: save.AUDIT_SHEET, values: [salesRecognitionV2MutationRowValues_(
        plan.reversalAuditRow, save.AUDIT_HEADERS)] }
    ];
  } else {
    var rep = plan.replacement;
    ranges = [
      { range: t.ORDERS.SHEET, values: [salesRecognitionV2MutationRowValues_(
        rep.orderRow, t.ORDERS.HEADERS)] },
      { range: t.ORDER_LINES.SHEET, values: rep.lineRows.map(function(row) {
        return salesRecognitionV2MutationRowValues_(row, t.ORDER_LINES.HEADERS); }) },
      { range: contract.SHEET, values: [
        salesRecognitionV2MutationRowValues_(plan.reversalEventRow, contract.HEADERS),
        salesRecognitionV2MutationRowValues_(rep.eventRow, contract.HEADERS)] },
      { range: "BalanceLedger", values: plan.reversalJournalRows.concat(rep.journalRows)
        .map(function(row) {
          return salesRecognitionV2MutationRowValues_(row,
            BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS); }) },
      { range: save.AUDIT_SHEET, values: [
        salesRecognitionV2MutationRowValues_(plan.reversalAuditRow, save.AUDIT_HEADERS),
        salesRecognitionV2MutationRowValues_(rep.auditRow, save.AUDIT_HEADERS)] }
    ];
  }
  var expected = mutation.WRITE_SURFACES[plan.operationType];
  if (JSON.stringify(ranges.map(function(range) { return range.range; })) !==
      JSON.stringify(expected)) {
    throw new Error("MUTATION_SURFACE_MISMATCH");
  }
  return ranges;
}

// Safe RAW CellData only (reuses the U2 safe cell encoder), appendCells
// subrequests only, one batch per mutation, missing sheetId throws BEFORE the
// request so the batch is rejected atomically.
function salesRecognitionV2MutationBatchBody_(valueRanges, sheetIds) {
  var blocks = salesRecognitionV2SaveAppendBlocks_(valueRanges);
  var expected = valueRanges.length;
  if (blocks.length !== expected) throw new Error("MUTATION_SURFACE_MISMATCH");
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

// Cell / request safety bounds, evaluated before every persist and re-checked
// on resume against the STORED plan (no mutable master recomputation).
function salesRecognitionV2MutationBounds_(plan) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, ranges;
  try { ranges = salesRecognitionV2MutationValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "MUTATION_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var sentinel = {};
  mutation.WRITE_SURFACES[plan.operationType].forEach(function(name) {
    sentinel[name] = 2147483647;
  });
  var body;
  try { body = salesRecognitionV2MutationBatchBody_(ranges, sentinel); }
  catch (error) { return { ok: false, detail: "UNSAFE_BATCH:" + error.message }; }
  var bytes = salesRecognitionV2SaveUtf8Bytes_(JSON.stringify(body)) +
    mutation.REQUEST_OVERHEAD_BYTES;
  var planJson = "";
  try { planJson = JSON.stringify(plan); }
  catch (error) { return { ok: false, detail: "PLAN_JSON_INVALID" }; }
  if (planJson.length > mutation.MAX_CELL_CHARS) {
    return { ok: false, detail: "UNSAFE_PLAN_CELL_CHARS:" + planJson.length };
  }
  var lineCount = plan.replacement ? plan.replacement.lineRows.length : 0;
  var ok = lineCount <= mutation.MAX_ORDER_LINES && cells <= mutation.MAX_BATCH_CELLS &&
    bytes <= mutation.MAX_REQUEST_BYTES;
  return { ok: ok, cells: cells, bytes: bytes, lineCount: lineCount,
    planChars: planJson.length,
    detail: ok ? "" : "BATCH_BOUNDS lineCount=" + lineCount + " cells=" + cells +
      " bytes=" + bytes };
}

// ---------------------------------------------------------------------------
// Exact artifact verification against the frozen plan: original artifacts
// unchanged (digests), then every appended artifact present/complete/exact/
// correctly owned. States: NONE / EXACT / PARTIAL / CONFLICT / UNKNOWN.
// Identity deviation classifies and fails closed; never repairs.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationInspect_(plan, ss) {
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    mutation = SALES_RECOGNITION_V2_MUTATION, t = TRANSACTION_PRODUCTION_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var events, ledger, audits, orders, lines;
  try {
    events = readCanonicalTable(ss, contract.SHEET, contract.HEADERS);
    ledger = readCanonicalTable(ss, "BalanceLedger", ledgerHeaders);
    audits = readCanonicalTable(ss, save.AUDIT_SHEET, save.AUDIT_HEADERS);
    orders = readCanonicalTable(ss, t.ORDERS.SHEET, t.ORDERS.HEADERS);
    lines = readCanonicalTable(ss, t.ORDER_LINES.SHEET, t.ORDER_LINES.HEADERS);
  } catch (error) {
    return { state: "UNKNOWN", detail: "READBACK_FAILED:" + error.message };
  }
  var conflicts = [], missing = [];
  function rowExact(actual, expected, headers) {
    return salesRecognitionV2SaveRowExact_(actual, expected, headers);
  }
  // ---- Original recognized artifacts must be byte-identical ----
  var targetEventRows = events.filter(function(row) {
    return String(row.RecognitionID) === plan.target.recognitionID;
  });
  if (targetEventRows.length !== 1) {
    conflicts.push(targetEventRows.length ? "TARGET_EVENT_DUPLICATE" : "TARGET_EVENT_MISSING");
  } else if (transactionPayloadHash_(targetEventRows[0]) !== plan.targetEvidence.event) {
    conflicts.push("TARGET_EVENT_TAMPERED");
  }
  var targetJournalRows = ledger.filter(function(row) {
    return String(row.JournalID) === plan.target.journalID &&
      String(row.SourceID) === plan.target.recognitionID;
  });
  if (!targetJournalRows.length) conflicts.push("TARGET_JOURNAL_MISSING");
  else if (transactionPayloadHash_(targetJournalRows) !== plan.targetEvidence.journal) {
    conflicts.push("TARGET_JOURNAL_TAMPERED");
  }
  var targetAuditRows = audits.filter(function(row) {
    return String(row.AuditID) === plan.target.auditID;
  });
  if (targetAuditRows.length !== 1) conflicts.push("TARGET_AUDIT_TAMPERED");
  else if (transactionPayloadHash_(targetAuditRows[0]) !== plan.targetEvidence.audit) {
    conflicts.push("TARGET_AUDIT_TAMPERED");
  }
  var targetOrderRows = orders.filter(function(row) {
    return String(row.OrderID) === plan.target.orderID;
  });
  if (targetOrderRows.length !== 1) conflicts.push("TARGET_ORDER_TAMPERED");
  else if (transactionPayloadHash_(targetOrderRows[0]) !== plan.targetEvidence.order) {
    conflicts.push("TARGET_ORDER_TAMPERED");
  }
  var targetLineRows = lines.filter(function(row) {
    return String(row.OrderID) === plan.target.orderID;
  });
  if (transactionPayloadHash_(targetLineRows) !== plan.targetEvidence.orderLines) {
    conflicts.push("TARGET_ORDER_LINES_TAMPERED");
  }
  // ---- Cross-owner / double-claim scans ----
  var replacement = plan.replacement;
  var plannedLineIds = {};
  if (replacement) {
    replacement.lineRows.forEach(function(row) { plannedLineIds[row.OrderLineID] = true; });
    lines.forEach(function(row) {
      if (plannedLineIds[row.OrderLineID] && String(row.OrderID) !== replacement.orderID) {
        conflicts.push("ORDER_LINE_CROSS_OWNER");
      }
    });
    orders.forEach(function(row) {
      if (String(row.OrderNumber) === replacement.orderNumber &&
          String(row.OrderID) !== replacement.orderID) {
        conflicts.push("ORDER_NUMBER_CROSS_OWNER");
      }
    });
  }
  events.forEach(function(row) {
    var recognitionID = String(row.RecognitionID);
    if (recognitionID === plan.reversalRecognitionID &&
        String(row.OrderID) !== plan.target.orderID) {
      conflicts.push("RECOGNITION_IDENTITY_CROSSOVER");
    }
    if (replacement && recognitionID === replacement.recognitionID &&
        String(row.OrderID) !== replacement.orderID) {
      conflicts.push("RECOGNITION_IDENTITY_CROSSOVER");
    }
    if (String(row.OperationID) === plan.operationID) {
      var owner = String(row.OrderID);
      if (owner !== plan.target.orderID && (!replacement || owner !== replacement.orderID)) {
        conflicts.push("EVENT_OPERATION_CROSS_OWNER");
      }
    }
    // At most ONE reversal may ever claim the target recognition.
    if (String(row.EventType) === "REVERSAL" &&
        String(row.ReversalOfRecognitionID) === plan.target.recognitionID &&
        recognitionID !== plan.reversalRecognitionID) {
      conflicts.push("REVERSAL_TARGET_CLAIMED");
    }
    // At most ONE replacement may ever claim the target recognition.
    if (replacement && String(row.OriginalID) === plan.target.recognitionID &&
        recognitionID !== replacement.recognitionID) {
      conflicts.push("REPLACEMENT_IDENTITY_CLAIMED");
    }
  });
  var plannedJournalLineIds = {};
  plan.reversalJournalRows.forEach(function(row) {
    plannedJournalLineIds[row.LineID] = plan.reversalJournalID + "|" +
      plan.reversalRecognitionID;
  });
  if (replacement) {
    replacement.journalRows.forEach(function(row) {
      plannedJournalLineIds[row.LineID] = replacement.journalID + "|" +
        replacement.recognitionID;
    });
  }
  ledger.forEach(function(row) {
    var expected = plannedJournalLineIds[String(row.LineID)];
    if (!expected) return;
    if (expected !== String(row.JournalID) + "|" + String(row.SourceID)) {
      conflicts.push("JOURNAL_LINE_CROSS_OWNER");
    }
  });
  var plannedAuditIds = {};
  plannedAuditIds[plan.reversalAuditID] = true;
  if (replacement) plannedAuditIds[replacement.auditID] = true;
  audits.forEach(function(row) {
    var isPlanned = plannedAuditIds[String(row.AuditID)] === true;
    if (isPlanned && String(row.OperationID) !== plan.operationID) {
      conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    }
    if (!isPlanned && String(row.OperationID) === plan.operationID) {
      conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    }
  });
  if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
  // ---- Own artifacts: presence, count, exactness ----
  var reversalEventMatches = events.filter(function(row) {
    return String(row.RecognitionID) === plan.reversalRecognitionID;
  });
  var reversalJournalById = ledger.filter(function(row) {
    return String(row.JournalID) === plan.reversalJournalID;
  });
  var reversalJournalBySource = ledger.filter(function(row) {
    return String(row.JournalID) === plan.reversalJournalID &&
      String(row.SourceID) === plan.reversalRecognitionID;
  });
  var reversalAuditById = audits.filter(function(row) {
    return String(row.AuditID) === plan.reversalAuditID;
  });
  var replacementOrderMatches = replacement ? orders.filter(function(row) {
    return String(row.OrderID) === replacement.orderID;
  }) : [];
  var replacementLineMatches = replacement ? lines.filter(function(row) {
    return String(row.OrderID) === replacement.orderID;
  }) : [];
  var replacementEventMatches = replacement ? events.filter(function(row) {
    return String(row.RecognitionID) === replacement.recognitionID;
  }) : [];
  var replacementJournalById = replacement ? ledger.filter(function(row) {
    return String(row.JournalID) === replacement.journalID;
  }) : [];
  var replacementJournalBySource = replacement ? ledger.filter(function(row) {
    return String(row.JournalID) === replacement.journalID &&
      String(row.SourceID) === replacement.recognitionID;
  }) : [];
  var replacementAuditById = replacement ? audits.filter(function(row) {
    return String(row.AuditID) === replacement.auditID;
  }) : [];
  var present = reversalEventMatches.length || reversalJournalById.length ||
    reversalAuditById.length ||
    (replacement && (replacementOrderMatches.length || replacementLineMatches.length ||
      replacementEventMatches.length || replacementJournalById.length ||
      replacementAuditById.length));
  if (!present) return { state: "NONE", detail: "" };
  // Reversal event
  if (!reversalEventMatches.length) missing.push("EVENT");
  else if (reversalEventMatches.length > 1) conflicts.push("EVENT_DUPLICATE");
  else if (!rowExact(reversalEventMatches[0], plan.reversalEventRow, contract.HEADERS)) {
    conflicts.push("EVENT_TAMPERED");
  }
  // Reversal journal: source-set vs ID-set membership (equal counts included)
  if (reversalJournalById.length || reversalJournalBySource.length) {
    var revIdSet = reversalJournalById.map(function(row) { return String(row.LineID); })
      .sort().join("");
    var revSourceSet = reversalJournalBySource.map(function(row) {
      return String(row.LineID); }).sort().join("");
    if (revIdSet !== revSourceSet) conflicts.push("JOURNAL_IDENTITY_CROSSOVER");
    if (reversalJournalBySource.length === 2) {
      for (var j = 0; j < 2; j++) {
        if (!rowExact(reversalJournalBySource[j], plan.reversalJournalRows[j],
            ledgerHeaders)) {
          conflicts.push("JOURNAL_TAMPERED");
        }
      }
      if (policyCJournalSignature_(reversalJournalBySource) !== plan.journalSignature) {
        conflicts.push("JOURNAL_SIGNATURE_MISMATCH");
      }
      var debit = 0, credit = 0;
      reversalJournalBySource.forEach(function(row) {
        debit += Number(row.Debit); credit += Number(row.Credit);
      });
      if (!(debit === credit && debit === Number(plan.amount))) {
        conflicts.push("JOURNAL_BALANCE_MISMATCH");
      }
    } else if (reversalJournalBySource.length === 1) {
      var only = reversalJournalBySource[0], planned = null;
      plan.reversalJournalRows.forEach(function(row) {
        if (String(row.LineID) === String(only.LineID)) planned = row;
      });
      if (!planned || !rowExact(only, planned, ledgerHeaders)) conflicts.push("JOURNAL_TAMPERED");
      else missing.push("JOURNAL_LINE");
    } else if (reversalJournalBySource.length === 0) missing.push("JOURNAL_LINE");
    else conflicts.push("JOURNAL_DUPLICATE");
  } else missing.push("JOURNAL");
  // Reversal audit
  if (!reversalAuditById.length) missing.push("AUDIT");
  else if (reversalAuditById.length > 1) conflicts.push("AUDIT_DUPLICATE");
  else if (!rowExact(reversalAuditById[0], plan.reversalAuditRow, save.AUDIT_HEADERS)) {
    conflicts.push("AUDIT_TAMPERED");
  }
  // Replacement sections
  if (replacement) {
    if (!replacementOrderMatches.length) missing.push("ORDER");
    else if (replacementOrderMatches.length > 1) conflicts.push("ORDER_DUPLICATE");
    else if (!rowExact(replacementOrderMatches[0], replacement.orderRow, t.ORDERS.HEADERS)) {
      conflicts.push("ORDER_TAMPERED");
    }
    if (replacementLineMatches.length) {
      if (replacementLineMatches.length > replacement.lineRows.length) {
        conflicts.push("ORDER_LINE_EXTRA");
      }
      var seenLines = {};
      replacementLineMatches.forEach(function(row) {
        var expected = null;
        replacement.lineRows.forEach(function(candidate) {
          if (candidate.OrderLineID === row.OrderLineID) expected = candidate;
        });
        if (!expected) { conflicts.push("ORDER_LINE_EXTRA"); return; }
        if (seenLines[expected.OrderLineID]) { conflicts.push("ORDER_LINE_DUPLICATE"); return; }
        seenLines[expected.OrderLineID] = true;
        if (!rowExact(row, expected, t.ORDER_LINES.HEADERS)) {
          conflicts.push("ORDER_LINE_TAMPERED");
        }
      });
      if (replacementLineMatches.length < replacement.lineRows.length) {
        missing.push("ORDER_LINE");
      }
    } else missing.push("ORDER_LINE");
    if (!replacementEventMatches.length) missing.push("REPLACEMENT_EVENT");
    else if (replacementEventMatches.length > 1) conflicts.push("EVENT_DUPLICATE");
    else if (!rowExact(replacementEventMatches[0], replacement.eventRow, contract.HEADERS)) {
      conflicts.push("EVENT_TAMPERED");
    }
    if (replacementJournalById.length || replacementJournalBySource.length) {
      var repIdSet = replacementJournalById.map(function(row) { return String(row.LineID); })
        .sort().join("");
      var repSourceSet = replacementJournalBySource.map(function(row) {
        return String(row.LineID); }).sort().join("");
      if (repIdSet !== repSourceSet) conflicts.push("JOURNAL_IDENTITY_CROSSOVER");
      if (replacementJournalBySource.length === 2) {
        for (var k = 0; k < 2; k++) {
          if (!rowExact(replacementJournalBySource[k], replacement.journalRows[k],
              ledgerHeaders)) {
            conflicts.push("JOURNAL_TAMPERED");
          }
        }
        if (policyCJournalSignature_(replacementJournalBySource) !==
            replacement.journalSignature) {
          conflicts.push("JOURNAL_SIGNATURE_MISMATCH");
        }
      } else if (replacementJournalBySource.length === 1) {
        var repOnly = replacementJournalBySource[0], repPlanned = null;
        replacement.journalRows.forEach(function(row) {
          if (String(row.LineID) === String(repOnly.LineID)) repPlanned = row;
        });
        if (!repPlanned || !rowExact(repOnly, repPlanned, ledgerHeaders)) {
          conflicts.push("JOURNAL_TAMPERED");
        } else missing.push("REPLACEMENT_JOURNAL_LINE");
      } else if (replacementJournalBySource.length === 0) {
        missing.push("REPLACEMENT_JOURNAL_LINE");
      } else conflicts.push("JOURNAL_DUPLICATE");
    } else missing.push("REPLACEMENT_JOURNAL");
    if (!replacementAuditById.length) missing.push("REPLACEMENT_AUDIT");
    else if (replacementAuditById.length > 1) conflicts.push("AUDIT_DUPLICATE");
    else if (!rowExact(replacementAuditById[0], replacement.auditRow, save.AUDIT_HEADERS)) {
      conflicts.push("AUDIT_TAMPERED");
    }
  }
  // Audit ID-set vs operation-set membership (equal counts included). Runs
  // only when at least one of our audits is actually present; a fully absent
  // audit set is the PARTIAL/ARTIFACTS_INCOMPLETE path above, not a crossover.
  var auditByOperation = audits.filter(function(row) {
    return String(row.OperationID) === plan.operationID;
  });
  var expectedAuditCount = replacement ? 2 : 1;
  var plannedPresent = audits.filter(function(row) {
    return plannedAuditIds[String(row.AuditID)] === true;
  });
  var plannedIdSet = plannedPresent.map(function(row) { return String(row.AuditID); })
    .sort().join("");
  var opSet = auditByOperation.map(function(row) { return String(row.AuditID); })
    .sort().join("");
  if (plannedPresent.length || auditByOperation.length) {
    if (auditByOperation.length !== expectedAuditCount || plannedIdSet !== opSet) {
      conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    }
  }
  if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
  if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
  return { state: "EXACT", detail: "" };
}

// ---------------------------------------------------------------------------
// Batch -> exact verify -> verified COMMITTED readback. Never retries a failed
// batch inside one call; an unknown outcome is inspected once and, if
// unresolved, reported as UNKNOWN with the request identity preserved.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationOutcome_(plan, status, fields) {
  var base = { requestKey: plan.requestKey, operationID: plan.operationID,
    targetOrderID: plan.targetOrderID, orderID: plan.businessID,
    recognitionID: plan.target.recognitionID,
    reversalRecognitionID: plan.reversalRecognitionID,
    replacementRecognitionID: plan.replacement ? plan.replacement.recognitionID : "" };
  return salesRecognitionV2SaveResult_(status, Object.assign(base, fields || {}));
}

function salesRecognitionV2MutationCommitVerify_(operation, runtime) {
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

function salesRecognitionV2MutationApplyBatch_(plan, operation, runtime) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, codes = mutation.CODES;
  var ranges = null, batchError = null, rows = 0;
  try {
    ranges = salesRecognitionV2MutationValueRanges_(plan);
    ranges.forEach(function(range) { rows += range.values.length; });
  } catch (error) {
    return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  try { runtime.batch(ranges, plan.operationType); } catch (error) { batchError = error; }
  if (!batchError && runtime.crash) runtime.crash("V2M_AFTER_BATCH");
  var inspection = salesRecognitionV2MutationInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.UNKNOWN, {
      code: batchError ? codes.BATCH_OUTCOME_UNKNOWN : codes.READBACK_UNKNOWN,
      writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state !== "EXACT") {
    if (batchError && inspection.state === "NONE") {
      return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.UNKNOWN, {
        code: codes.BATCH_OUTCOME_UNKNOWN, writeCount: "UNKNOWN",
        detail: inspection.detail });
    }
    return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.RECOVERY_REQUIRED, {
      code: inspection.state === "CONFLICT" ? codes.IDENTITY_CONFLICT :
        codes.ARTIFACTS_INCOMPLETE,
      writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (runtime.crash) runtime.crash("V2M_AFTER_READBACK");
  if (runtime.crash) runtime.crash("V2M_BEFORE_COMMIT");
  try { transactionCommitOperation_(runtime.repository, operation, runtime.now()); }
  catch (error) {
    return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.UNKNOWN, {
      code: codes.COMMIT_OUTCOME_UNKNOWN, writeCount: rows, detail: error.message });
  }
  var commitCheck = salesRecognitionV2MutationCommitVerify_(operation, runtime);
  if (!commitCheck.ok) {
    return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.UNKNOWN, {
      code: codes.COMMIT_OUTCOME_UNKNOWN, writeCount: rows, detail: commitCheck.detail });
  }
  if (runtime.crash) runtime.crash("V2M_AFTER_COMMIT");
  return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.DONE, { writeCount: rows });
}

// ---------------------------------------------------------------------------
// Resume path: exact (OperationType, RequestKey) lookup hit. Compares BOTH the
// digest and the exact persisted normalized structure; verifies the stored
// plan integrity digest + shape invariants; validates State; re-checks stored
// bounds + schema (no mutable master recomputation). Tampered or partial state
// fails closed with ZERO additional writes.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationResume_(operationType, operation, hash, normalized,
  runtime) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, codes = mutation.CODES;
  var requestKey = normalized.requestKey;
  function outcome(status, fields) {
    return salesRecognitionV2SaveResult_(status, Object.assign({
      requestKey: requestKey, operationID: operation.OperationID || "",
      targetOrderID: normalized.orderID, orderID: operation.BusinessID || ""
    }, fields || {}));
  }
  if (operation.OperationType !== operationType || !operation.BusinessID ||
      operation.RequestKey !== requestKey || operation.PayloadHash !== hash) {
    return outcome(mutation.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT });
  }
  var plan = null;
  try { plan = JSON.parse(operation.OperationPlan); } catch (error) {
    return outcome(mutation.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  if (!plan || plan.requestKey !== requestKey || plan.payloadHash !== hash ||
      plan.operationID !== operation.OperationID ||
      plan.businessID !== operation.BusinessID ||
      plan.targetOrderID !== normalized.orderID) {
    return outcome(mutation.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT,
      detail: "PLAN_IDENTITY_MISMATCH" });
  }
  if (!plan.normalizedPayload ||
      JSON.stringify(plan.normalizedPayload) !== JSON.stringify(normalized)) {
    return outcome(mutation.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT,
      detail: "NORMALIZED_PAYLOAD_MISMATCH" });
  }
  var verify;
  try { verify = salesRecognitionV2MutationVerifyPlan_(plan); }
  catch (error) {
    return outcome(mutation.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  if (!verify.ok) {
    return outcome(mutation.STATUS.RECOVERY_REQUIRED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason });
  }
  if (operation.State !== "IN_PROGRESS" && operation.State !== "COMMITTED") {
    return outcome(mutation.STATUS.RECOVERY_REQUIRED, {
      code: codes.INVALID_OPERATION_STATE, detail: "STATE:" + String(operation.State) });
  }
  var schema = salesRecognitionV2SaveSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(mutation.STATUS.RECOVERY_REQUIRED, { code: codes.SCHEMA_NOT_READY,
      detail: schema.badSheets.join(",") });
  }
  var bounds = salesRecognitionV2MutationBounds_(plan);
  if (!bounds.ok) {
    return outcome(mutation.STATUS.RECOVERY_REQUIRED, { code: codes.BATCH_BOUNDS_EXCEEDED,
      detail: bounds.detail });
  }
  var inspection = salesRecognitionV2MutationInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(mutation.STATUS.UNKNOWN, { code: codes.READBACK_UNKNOWN,
      detail: inspection.detail });
  }
  var closedCode = inspection.state === "CONFLICT" ? codes.IDENTITY_CONFLICT :
    codes.ARTIFACTS_INCOMPLETE;
  if (inspection.state === "EXACT") {
    if (operation.State === "COMMITTED") {
      // COMMITTED verifies exact artifacts then replays DONE (response lost).
      if (runtime.crash) runtime.crash("V2M_AFTER_COMMIT");
      return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.DONE,
        { replay: true, writeCount: 0 });
    }
    if (runtime.crash) runtime.crash("V2M_AFTER_READBACK");
    if (runtime.crash) runtime.crash("V2M_BEFORE_COMMIT");
    try { transactionCommitOperation_(runtime.repository, operation, runtime.now()); }
    catch (error) {
      return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.UNKNOWN, {
        code: codes.COMMIT_OUTCOME_UNKNOWN, detail: error.message });
    }
    var commitCheck = salesRecognitionV2MutationCommitVerify_(operation, runtime);
    if (!commitCheck.ok) {
      return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.UNKNOWN, {
        code: codes.COMMIT_OUTCOME_UNKNOWN, detail: commitCheck.detail });
    }
    if (runtime.crash) runtime.crash("V2M_AFTER_COMMIT");
    return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.DONE,
      { replay: true, writeCount: 0 });
  }
  if (operation.State === "COMMITTED") {
    // COMMITTED without exact artifacts: fail closed, no repair.
    return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.RECOVERY_REQUIRED,
      { code: closedCode, detail: inspection.detail });
  }
  if (inspection.state === "NONE") {
    return salesRecognitionV2MutationApplyBatch_(plan, operation, runtime);
  }
  return salesRecognitionV2MutationOutcome_(plan, mutation.STATUS.RECOVERY_REQUIRED,
    { code: closedCode, detail: inspection.detail });
}

// ---------------------------------------------------------------------------
// New intent path. Lookup already returned null; config/schema/account gates,
// eligibility from persisted V2 authority, plan freeze (identities, snapshots,
// digests), bounds, intent persist + exact ten-field readback, then batch.
// Every gate refusal writes zero; an unsafe plan is never persisted.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationNewIntent_(operationType, normalized, hash, runtime) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, codes = mutation.CODES;
  function outcome(status, fields) {
    return salesRecognitionV2SaveResult_(status, Object.assign({
      requestKey: normalized.requestKey, targetOrderID: normalized.orderID
    }, fields || {}));
  }
  var config = runtime.config === undefined || runtime.config === null ?
    salesRecognitionV2DefaultConfig() : runtime.config;
  var gate = salesRecognitionV2RequestGate(config);
  if (!gate.allowed) return outcome(mutation.STATUS.REFUSED, { code: gate.code });
  var schema = salesRecognitionV2SaveSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(mutation.STATUS.REFUSED, { code: codes.SCHEMA_NOT_READY,
      detail: schema.badSheets.join(",") });
  }
  var accountRows;
  try {
    accountRows = readCanonicalTable(runtime.spreadsheet, "Accounts",
      CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  } catch (error) {
    return outcome(mutation.STATUS.REFUSED, { code: codes.SCHEMA_NOT_READY,
      detail: error.message });
  }
  var preflight = preflightSalesRecognitionAccounts(accountRows);
  if (preflight.status !== "PASS") {
    var first = preflight.errors[0] || {};
    return outcome(mutation.STATUS.REFUSED, {
      code: first.code || "ACCOUNT_ABSENT", field: first.accountCode || "",
      detail: "ACCOUNT_PREFLIGHT_FAILED" });
  }
  var resolved = salesRecognitionV2MutationResolveTarget_(operationType, normalized, runtime);
  if (!resolved.ok) {
    return outcome(mutation.STATUS.REFUSED, { code: resolved.code, detail: resolved.detail });
  }
  var target = resolved.target;
  var now = runtime.now();
  var economicDate = capitalEquityDateKey(now);
  if (!economicDate) {
    return outcome(mutation.STATUS.REFUSED, { code: codes.ECONOMIC_DATE_INVALID });
  }
  var operationID = transactionOperationID_(operationType, normalized.requestKey);
  var input = { operationType: operationType, requestKey: normalized.requestKey,
    normalized: normalized, hash: hash, target: target,
    targetEvidence: resolved.targetEvidence, config: config, actor: runtime.actor(),
    now: now, economicDate: economicDate, operationID: operationID,
    reason: normalized.reason };
  var plan;
  try {
    if (operationType === mutation.VOID) {
      plan = salesRecognitionV2MutationVoidPlan_(input);
    } else {
      // Replacement authority resolved ONCE for this new intent; after the
      // intent persists, retries use the frozen plan and never re-read masters.
      var authority;
      try {
        authority = typeof runtime.readAuthority === "function" ?
          runtime.readAuthority() : transactionProductionAuthority_(runtime.spreadsheet);
      } catch (error) {
        return outcome(mutation.STATUS.REFUSED, { code: codes.SCHEMA_NOT_READY,
          detail: error.message });
      }
      var windowGate = salesRecognitionV2SaveAuthorityGate_(authority);
      if (windowGate.status !== "PASS") {
        return outcome(mutation.STATUS.REFUSED, { code: codes.AUTHORITY_WINDOW_INVALID,
          detail: windowGate.detail });
      }
      var variantGate = salesRecognitionV2SaveVariantGate_(normalized.lines, authority, now);
      if (variantGate.status !== "PASS") {
        return outcome(mutation.STATUS.REFUSED, {
          code: codes.PRODUCT_VARIANT_EFFECTIVE_WINDOW, detail: variantGate.detail });
      }
      var replacementIds = salesRecognitionV2MutationReplacementIds_(operationType,
        normalized.requestKey);
      var order;
      try {
        order = prepareOperationalOrder({ orderType: normalized.orderType,
          lines: normalized.lines }, authority, {
            now: function() { return now; },
            uuid: function() { return replacementIds.orderID.slice(4); },
            orderSequence: function() { return replacementIds.orderID.slice(4); },
            actor: runtime.actor });
      } catch (error) {
        return outcome(mutation.STATUS.REFUSED, {
          code: error.code || codes.PAYLOAD_INVALID, field: error.field || "",
          detail: error.message });
      }
      order.OrderID = replacementIds.orderID;
      order.OrderNumber = replacementIds.orderNumber;
      input.order = order;
      input.authority = authority;
      input.replacementIds = replacementIds;
      plan = salesRecognitionV2MutationCorrectPlan_(input);
    }
  } catch (error) {
    return outcome(mutation.STATUS.REFUSED, {
      code: error.code || codes.AUTHORITY_SNAPSHOT_MISMATCH,
      field: error.field || "", detail: error.message });
  }
  var verify;
  try { verify = salesRecognitionV2MutationVerifyPlan_(plan); }
  catch (error) {
    return outcome(mutation.STATUS.REFUSED, { code: codes.PLAN_MALFORMED,
      detail: error.message });
  }
  if (!verify.ok) {
    return outcome(mutation.STATUS.REFUSED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason });
  }
  var bounds = salesRecognitionV2MutationBounds_(plan);
  if (!bounds.ok) {
    return outcome(mutation.STATUS.REFUSED, { code: codes.BATCH_BOUNDS_EXCEEDED,
      detail: bounds.detail });
  }
  if (runtime.crash) runtime.crash("V2M_BEFORE_INTENT");
  var operation;
  try {
    operation = transactionResolveOperation_(runtime.repository, operationType,
      normalized.requestKey, hash, plan.businessID, plan, now);
  } catch (error) {
    return outcome(error.code === "OPERATION_PAYLOAD_CONFLICT" ?
      mutation.STATUS.CONFLICT : mutation.STATUS.RECOVERY_REQUIRED,
      { code: error.code === "OPERATION_PAYLOAD_CONFLICT" ?
        codes.OPERATION_PAYLOAD_CONFLICT : codes.DUPLICATE_OPERATION_EVIDENCE,
        detail: error.message });
  }
  if (runtime.crash) runtime.crash("V2M_AFTER_INTENT_PERSIST");
  // Exact readback of all ten operation fields (Date-safe) before any write.
  var readback = null;
  try { readback = runtime.repository.findOperation(operationType, normalized.requestKey); }
  catch (error) {
    return outcome(mutation.STATUS.RECOVERY_REQUIRED, { code: codes.INTENT_READBACK_FAILED,
      detail: "INTENT_READBACK_FAILED:" + error.message });
  }
  if (!readback) {
    return outcome(mutation.STATUS.RECOVERY_REQUIRED, { code: codes.INTENT_READBACK_FAILED,
      detail: "INTENT_ROW_MISSING" });
  }
  if (readback.State !== "IN_PROGRESS" ||
      !salesRecognitionV2SaveFieldsExact_(readback, operation,
        TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS)) {
    var mismatch = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS.filter(function(header) {
      return !salesRecognitionV2SaveFieldEqual_(readback[header], operation[header]);
    });
    return outcome(mutation.STATUS.RECOVERY_REQUIRED, { code: codes.INTENT_READBACK_FAILED,
      detail: "INTENT_ROW_MISMATCH:" + mismatch.join(",") });
  }
  if (runtime.crash) runtime.crash("V2M_AFTER_INTENT");
  return salesRecognitionV2MutationApplyBatch_(plan, operation, runtime);
}

// Durable mutation core. Fixed order: normalize -> exact (OperationType,
// RequestKey) lookup BEFORE any mutable target or master read; then resume or
// new-intent. Never acquires a lock (outer wrapper owns it).
function salesRecognitionV2MutationRun_(operationType, normalized, runtime) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, codes = mutation.CODES;
  var repository;
  try { repository = runtime.repository; }
  catch (error) {
    return salesRecognitionV2SaveResult_(mutation.STATUS.UNKNOWN, {
      code: codes.MUTATION_EXECUTION_UNKNOWN,
      requestKey: normalized.requestKey, detail: error.message });
  }
  var existing;
  try { existing = repository.findOperation(operationType, normalized.requestKey); }
  catch (error) {
    return salesRecognitionV2SaveResult_(mutation.STATUS.RECOVERY_REQUIRED, {
      code: error && error.message === "DUPLICATE_OPERATION" ?
        codes.DUPLICATE_OPERATION_EVIDENCE : codes.IDENTITY_CONFLICT,
      requestKey: normalized.requestKey,
      detail: error && error.message ? error.message : "" });
  }
  var hash = transactionPayloadHash_(normalized);
  if (existing) {
    return salesRecognitionV2MutationResume_(operationType, existing, hash, normalized, runtime);
  }
  return salesRecognitionV2MutationNewIntent_(operationType, normalized, hash, runtime);
}

function salesRecognitionV2VoidWithRuntime_(payload, runtime) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, codes = mutation.CODES;
  var normalized;
  try { normalized = salesRecognitionV2MutationNormalizeVoid_(payload); }
  catch (error) {
    return salesRecognitionV2SaveResult_(mutation.STATUS.REFUSED, {
      code: error.code || codes.PAYLOAD_INVALID,
      requestKey: salesRecognitionV2MutationPayloadKey_(payload),
      field: error.field || "", detail: error.message });
  }
  return salesRecognitionV2MutationRun_(mutation.VOID, normalized, runtime);
}

function salesRecognitionV2CorrectWithRuntime_(payload, runtime) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, codes = mutation.CODES;
  var normalized;
  try { normalized = salesRecognitionV2MutationNormalizeCorrect_(payload); }
  catch (error) {
    return salesRecognitionV2SaveResult_(mutation.STATUS.REFUSED, {
      code: error.code || codes.PAYLOAD_INVALID,
      requestKey: salesRecognitionV2MutationPayloadKey_(payload),
      field: error.field || "", detail: error.message });
  }
  return salesRecognitionV2MutationRun_(mutation.CORRECT, normalized, runtime);
}

// ---------------------------------------------------------------------------
// Production runtime factory + sanitized Sheets REST transport (43). Never
// invoked by local tests; the default config is PREPARED, so even an
// accidental call refuses before any business write.
// ---------------------------------------------------------------------------
function salesRecognitionV2MutationSheetIdsRequest_(surfaces) {
  var response = inventoryReceiptMigrationRequest_("get",
    "?fields=" + encodeURIComponent("spreadsheetId,sheets.properties(sheetId,title)"));
  if (!response || response.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) {
    throw new Error("PRODUCTION_IDENTITY_MISMATCH");
  }
  var ids = {};
  (response.sheets || []).forEach(function(sheet) {
    var properties = sheet && sheet.properties;
    if (properties && surfaces.indexOf(properties.title) !== -1 &&
        typeof properties.sheetId === "number") {
      ids[properties.title] = properties.sheetId;
    }
  });
  var missing = surfaces.filter(function(name) { return typeof ids[name] !== "number"; });
  if (missing.length) throw new Error("SHEET_ID_UNAVAILABLE:" + missing.join(","));
  return ids;
}

// ONE spreadsheets.batchUpdate per mutation: appendCells subrequests only
// (safe RAW CellData) over the mutation's own write surfaces. The single
// batchUpdate is atomic; intent/batch/readback/commit remain multistep — no
// database-global atomicity is claimed.
function salesRecognitionV2MutationBatchRequest_(operationType, valueRanges) {
  var sheetIds = salesRecognitionV2MutationSheetIdsRequest_(
    SALES_RECOGNITION_V2_MUTATION.WRITE_SURFACES[operationType]);
  var body = salesRecognitionV2MutationBatchBody_(valueRanges, sheetIds);
  return inventoryReceiptMigrationRequest_("post", ":batchUpdate", body);
}

function salesRecognitionV2MutationRuntime_() {
  var ss = requireNumlockProductionSpreadsheet();
  var runtime = {
    spreadsheet: ss,
    lock: LockService.getScriptLock(),
    now: function() { return new Date(); },
    actor: function() { return Session.getActiveUser().getEmail() || CANONICAL_ENTRY.USER; },
    config: salesRecognitionV2DefaultConfig(),
    batch: function(valueRanges, operationType) {
      return salesRecognitionV2MutationBatchRequest_(operationType, valueRanges);
    }
  };
  Object.defineProperty(runtime, "repository", { configurable: true, enumerable: true,
    get: function() {
      var repository = createTransactionSpreadsheetRepository(ss);
      Object.defineProperty(runtime, "repository", { configurable: true, enumerable: true,
        value: repository });
      return repository;
    } });
  return runtime;
}

// Public entry: the ONLY outer lock, acquired BEFORE normalize/lookup and
// released exactly once. Lock or runtime failure happens before any durable
// intent, so it is a definite REFUSED (recovery-before-durable-intent); only
// post-intent execution uncertainty is UNKNOWN. The core never locks, so no
// nested locks are possible.
function salesRecognitionV2DurableMutation_(operationType, payload) {
  var mutation = SALES_RECOGNITION_V2_MUTATION, codes = mutation.CODES;
  var runtime = null, acquired = false, result;
  var requestKey = salesRecognitionV2MutationPayloadKey_(payload);
  try {
    runtime = salesRecognitionV2MutationRuntime_();
  } catch (error) {
    return salesRecognitionV2SaveResult_(mutation.STATUS.REFUSED, {
      code: codes.MUTATION_RUNTIME_UNAVAILABLE, requestKey: requestKey,
      detail: error && error.message ? error.message : "" });
  }
  try {
    runtime.lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return salesRecognitionV2SaveResult_(mutation.STATUS.REFUSED, {
      code: codes.OUTER_LOCK_UNAVAILABLE, requestKey: requestKey,
      detail: error && error.message ? error.message : "" });
  }
  try {
    result = operationType === mutation.VOID ?
      salesRecognitionV2VoidWithRuntime_(payload, runtime) :
      salesRecognitionV2CorrectWithRuntime_(payload, runtime);
  } catch (error) {
    // Unknown only after the durable intent may exist; identity preserved.
    result = salesRecognitionV2SaveResult_(mutation.STATUS.UNKNOWN, {
      code: codes.MUTATION_EXECUTION_UNKNOWN, requestKey: requestKey,
      detail: error && error.message ? error.message : "" });
  } finally {
    if (acquired) {
      try { runtime.lock.releaseLock(); } catch (lockError) { /* lock auto-expires */ }
    }
  }
  return result;
}

function salesRecognitionV2DurableVoid(payload) {
  return salesRecognitionV2DurableMutation_(SALES_RECOGNITION_V2_MUTATION.VOID, payload);
}

function salesRecognitionV2DurableCorrect(payload) {
  return salesRecognitionV2DurableMutation_(SALES_RECOGNITION_V2_MUTATION.CORRECT, payload);
}
