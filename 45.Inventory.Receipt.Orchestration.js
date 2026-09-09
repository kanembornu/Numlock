// Phase 11V.8. Prospective routing only. No production enablement or correction writer.
var INVENTORY_RECEIPT_ACTIVATION = Object.freeze({
  version: "11V.8", revision: 2, enabled: false, effectiveFrom: "2026-10-01",
  timezone: "Asia/Jakarta", routingVersion: "DIRECT-INVENTORY-ITEM-V1",
  activationEvent: null, evidenceFingerprint: null
});

// Phase 11V.8B user-approved prospective Expense authority; no inventory crosswalk.
var INVENTORY_EXPENSE_ROUTING = Object.freeze({
  version: "EXPENSE-ROUTING-V2", revision: 2,
  evidenceRef: "docs/evidence/finance-phase-11v8b/README.md",
  rows: Object.freeze(["OSS01","OSK01","OSK02","OSK03","OSK04","OSK05","OSR01","OSR02","OSR03","OSR04","OSR05","OSR06","OSR07","OSR08","OSR09","OSR10","OSR11","OSR12","OSR13","OSR14","OSR15","OSR16","OSR17","OSR18","OSR19","OSR20","OSR21","OUR01","OUU01","OUS01","OUS02","OUS03","OUS04","OEE01"].map(function(id) {
    var ordinary = ["OSS01", "OSK02", "OUR01", "OUS01", "OUS02", "OUS03", "OUS04"].indexOf(id) !== -1;
    return Object.freeze({ expenseItemId: id,
      classification: ordinary ? "ORDINARY_EXPENSE" : "BLOCKED_FOR_PROSPECTIVE_EXPENSE",
      reason: "USER_APPROVED_11V8B" });
  }))
});

function validateInventoryExpenseRouting_(expenses, registry) {
  if (!registry || !registry.version || !Number.isSafeInteger(registry.revision) || registry.revision < 1 ||
      !registry.evidenceRef || !Array.isArray(registry.rows)) inventoryReceiptFail_("INVALID_ROUTING_REGISTRY");
  var routes = Object.create(null), active = Object.create(null);
  registry.rows.forEach(function(row) {
    var id = row.expenseItemId;
    if (typeof id !== "string" || !id || id !== id.trim() || routes[id] ||
        ["ORDINARY_EXPENSE", "BLOCKED_FOR_PROSPECTIVE_EXPENSE"].indexOf(row.classification) === -1 ||
        Object.prototype.hasOwnProperty.call(row, "itemId") ||
        !row.reason) inventoryReceiptFail_("ROUTING_CONFLICT");
    routes[id] = row;
  });
  var seen = Object.create(null);
  expenses.forEach(function(row) {
    var id = inventoryReceiptText_(row.ID_Ops);
    if (!id || seen[id]) inventoryReceiptFail_("EXPENSE_ID_CONFLICT");
    seen[id] = true;
    if (isCanonicalActive(row.IsActive)) {
      if (!routes[id]) inventoryReceiptFail_("ROUTING_COVERAGE_MISSING:" + id);
      active[id] = routes[id];
    }
  });
  return { status: "PASS", activeCount: Object.keys(active).length, routes: active, version: registry.version };
}

function resolveInventoryExpenseRoute_(id, expenses, registry) {
  if (typeof id !== "string" || !id || id !== id.trim()) inventoryReceiptFail_("EXPENSE_ID_MALFORMED");
  var coverage = validateInventoryExpenseRouting_(expenses, registry);
  var route = coverage.routes[inventoryReceiptText_(id)];
  if (!route) inventoryReceiptFail_("EXPENSE_ITEM_NOT_ACTIVE_OR_MAPPED");
  if (route.classification !== "ORDINARY_EXPENSE") inventoryReceiptFail_("EXPENSE_ROUTE_BLOCKED");
  return route;
}

function requireInventoryReceiptLock_(runtime, scope) {
  if (!scope || scope.active !== true || scope.lock !== runtime.lock ||
      typeof runtime.lock.hasLock === "function" && !runtime.lock.hasLock()) inventoryReceiptFail_("SHARED_LOCK_REQUIRED");
}

function inventoryReceiptOrchestrationResult_(status, reason, key, row, writes, movement) {
  return { success: status === "OPERATIONAL_POSTED", status: status, reason: reason || null,
    requestKey: key || null, receiptId: row ? row.ReceiptID : null, lineId: row ? row.LineID : null,
    revision: row ? row.Revision : null, sourceId: row ? JSON.stringify([row.ReceiptID, row.LineID, row.Revision]) : null,
    movementId: movement ? movement.ID_Movement : row ? "IR-" + JSON.stringify([row.ReceiptID, row.LineID, row.Revision]) : null,
    reconciliationRequired: status === "WRITE_UNCERTAIN", writeCount: writes,
    accountingPostingAllowed: false, BalanceLedgerWrites: 0, Account1100Mutation: false,
    tabopsWrites: 0, cashAPInference: false, recipeConsumptionAllowed: false, openingRequired: false,
    productionMutation: false, correctionWritesAllowed: false,
    data: row ? projectInventoryReceiptTransaction_(row, status) : null };
}

// Production can only return disabled. Enabling a fixture is never a production capability.
function inventoryReceiptProductionRuntime_(ss, lock) {
  return { environment: "PRODUCTION", lock: lock, read: function() {
    return { activation: inventoryReceiptClone_(INVENTORY_RECEIPT_ACTIVATION) };
  } };
}

function validateInventoryReceiptRequest_(payload) {
  if (!payload || payload.transactionType !== "INVENTORY_RECEIPT" ||
      typeof payload.requestKey !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(payload.requestKey) ||
      !payload.input || typeof payload.input !== "object" || Array.isArray(payload.input) || typeof payload.input.ItemID !== "string" ||
      !payload.input.ItemID || payload.input.ItemID !== payload.input.ItemID.trim()) inventoryReceiptFail_("INVALID_RECEIPT_REQUEST");
  Object.keys(payload).forEach(function(field) {
    if (["transactionType", "requestKey", "input"].indexOf(field) === -1) inventoryReceiptFail_("UNKNOWN_RECEIPT_REQUEST_FIELD");
  });
}

function orchestrateInventoryReceipt_(payload, runtime) {
  var scope = null;
  try {
    validateInventoryReceiptRequest_(payload);
    runtime.lock.waitLock(30000);
    scope = { lock: runtime.lock, active: true };
    return orchestrateInventoryReceiptUnderLock_(payload, runtime, scope);
  } catch (error) {
    return inventoryReceiptOrchestrationResult_("NOT_STARTED", error.message, payload && payload.requestKey, null, 0);
  } finally { if (scope) { scope.active = false; runtime.lock.releaseLock(); } }
}

function orchestrateInventoryReceiptUnderLock_(payload, runtime, scope) {
  var row = null, key = payload && payload.requestKey, writes = 0;
  try {
    requireInventoryReceiptLock_(runtime, scope);
    validateInventoryReceiptRequest_(payload);
    var state = runtime.read(), config = state.activation;
    if (runtime.environment !== "LOCAL_FIXTURE" || !config || config.enabled !== true) inventoryReceiptFail_("PRODUCTION_OPERATIONAL_POSTING_DISABLED");
    if (config.version !== "11V.8" || !Number.isSafeInteger(config.revision) || config.revision < 1 ||
        !config.activationEvent || !config.activationEvent.id || !config.activationEvent.actor ||
        inventoryTimestampMillis(config.activationEvent.at) === null || !/^[a-f0-9]{64}$/.test(config.evidenceFingerprint || "") ||
        config.routingVersion !== "DIRECT-INVENTORY-ITEM-V1") inventoryReceiptFail_("INVALID_ACTIVATION_CONFIG");
    var input = normalizeInventoryReceiptInput_(payload.input);
    inventoryReceiptOperationalActivation_(config, input.ReceiptDate);
    var history = inventoryReceiptHistory_(state.receipts), existing = history.keys[key];
    if (existing) {
      row = existing;
      var original = JSON.parse(existing.NormalizedPayload);
      if (original.routing ||
          JSON.stringify(original.input) !== JSON.stringify(input) || original.action !== "CREATE" ||
          history.latest[existing.LineID] !== existing || existing.IsActive !== true) inventoryReceiptFail_("CONFLICT");
    } else {
      var candidate = deriveInventoryReceipt_(input, { items: state.items, conversions: state.conversions });
      if (candidate.row.Status !== "READY") inventoryReceiptFail_("RECEIPT_AUTHORITY_NOT_READY");
      // Validate the entire ledger before durable capture, including existing source conflicts.
      buildInventoryReceiptTracking_(state.ledger, state.items, { receipts: state.receipts, activation: config });
      var captureRuntime = Object.assign({}, runtime.capture, { lock: runtime.lock,
        authority: function() { return { items: state.items, conversions: state.conversions }; } });
      var captured = captureInventoryReceiptUnderLock_({ idempotencyKey: key, input: input }, captureRuntime, scope);
      writes = captured.writeCount;
      if (captured.status === "WRITE_UNCERTAIN") return inventoryReceiptOrchestrationResult_("WRITE_UNCERTAIN", captured.reason, key, captured.row, "UNKNOWN");
      if (captured.status !== "CAPTURED" && captured.status !== "EXISTING") return inventoryReceiptOrchestrationResult_(captured.status, captured.reason, key, captured.row, writes);
      row = captured.row;
    }
    var postRuntime = { environment: runtime.environment, lock: runtime.lock, activation: config,
      read: function() {
        var fresh = runtime.read();
        if (JSON.stringify(fresh.activation) !== JSON.stringify(config)) inventoryReceiptFail_("AUTHORITY_CHANGED_RECONCILE");
        return { receipts: fresh.receipts, ledger: fresh.ledger, items: fresh.items };
      }, appendMovement: runtime.appendMovement };
    var posted = postInventoryReceiptOperationalUnderLock_({ receiptId: row.ReceiptID, lineId: row.LineID, revision: row.Revision }, postRuntime, scope);
    if (posted.writeCount === "UNKNOWN") writes = "UNKNOWN"; else writes += posted.writeCount;
    var status = ["POSTED", "EXISTING", "RECOVERED_EXISTING"].indexOf(posted.status) !== -1 ? "OPERATIONAL_POSTED" :
      posted.status === "CONFLICT" ? "CONFLICT" : posted.status === "WRITE_UNCERTAIN" ? "WRITE_UNCERTAIN" : "RECEIPT_CAPTURED";
    return inventoryReceiptOrchestrationResult_(status, posted.reason, key, row, writes, posted.movement);
  } catch (error) {
    return inventoryReceiptOrchestrationResult_(error.message === "CONFLICT" || /CONFLICT/.test(error.message) ? "CONFLICT" : row ? "RECEIPT_CAPTURED" : "NOT_STARTED",
      error.message, key, row, writes);
  }
}

// Typed operational DTO prepared for later Transactions integration. Never fed to
// getCanonicalTransactionData, Aggregate Engine, or Sales/Expense financial totals.
function projectInventoryReceiptTransaction_(row, recoveryState) {
  return { id: row.LineID, transactionType: "InventoryReceipt", canonicalTransactionType: "InventoryReceipt",
    receiptId: row.ReceiptID, revision: row.Revision, date: row.ReceiptDate, itemId: row.ItemID,
    location: row.Location, receivedQuantity: row.BaseQtyReceived, baseUOM: row.BaseUOM,
    acquisitionValue: row.AcquisitionValue, recoveryState: recoveryState, isActive: row.IsActive,
    accountingStatus: "NOT_POSTED", accountingPostingAllowed: false, financialTotalsIncluded: false,
    canEdit: false, canVoid: false };
}

// Pure future-correction contract only; no append method accepts this candidate.
function buildInventoryReceiptReversal_(request, original, ledger, context) {
  if (!request || ["VOID", "VOID_AND_REPLACE"].indexOf(request.action) === -1 ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(request.requestKey || "") ||
      !inventoryReceiptText_(request.reason) || !capitalEquityDateKey(request.date) ||
      request.date < String(original.MovementTimestamp).slice(0, 10) ||
      request.action === "VOID_AND_REPLACE" && (!request.replacementRequestKey || request.replacementRequestKey === request.requestKey ||
        !/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(request.replacementRequestKey))) inventoryReceiptFail_("INVALID_CORRECTION_REQUEST");
  if (!context || !inventoryReceiptOperationalCandidateValid_(original, context.items, context) ||
      original.IsActive !== true || original.MovementType !== "PURCHASE_RECEIPT_IN" || original.AccountingJournalID) inventoryReceiptFail_("INVALID_ORIGINAL_EFFECT");
  var originalMatches = ledger.filter(function(row) { return row.ID_Movement === original.ID_Movement; });
  if (originalMatches.length !== 1 || !inventoryReceiptOperationalExact_(originalMatches[0], original)) inventoryReceiptFail_("ORIGINAL_EFFECT_CONFLICT");
  var binding = JSON.stringify({ action: request.action, requestKey: request.requestKey, reason: request.reason.trim(),
    date: request.date, replacementRequestKey: request.replacementRequestKey || "", originalMovementId: original.ID_Movement });
  var candidate = { ID_Movement: "IR-REV-" + request.requestKey, MovementType: "ADJUSTMENT_OUT",
    ItemID: original.ItemID, Location: original.Location, BaseUOM: original.BaseUOM,
    MovementTimestamp: request.date + "T00:00:00+07:00", QtyIn: 0, QtyOut: original.QtyIn,
    UnitCost: original.UnitCost, TotalCost: original.TotalCost, ReversalOfMovementID: original.ID_Movement,
    CorrectionRequestKey: request.requestKey, NormalizedCorrection: binding,
    AccountingJournalID: "", accountingPostingAllowed: false, mutationAllowed: false };
  var matches = ledger.filter(function(row) { return row.ReversalOfMovementID === original.ID_Movement ||
    row.CorrectionRequestKey === request.requestKey || row.ID_Movement === candidate.ID_Movement; });
  if (matches.length) {
    if (matches.length !== 1 || Object.keys(candidate).some(function(key) { return candidate[key] !== matches[0][key]; })) inventoryReceiptFail_("REVERSAL_CONFLICT");
    return { status: "EXISTING", candidate: inventoryReceiptClone_(matches[0]), writeCount: 0, mutationAllowed: false };
  }
  return { status: "CANDIDATE_ONLY", candidate: candidate, writeCount: 0, mutationAllowed: false };
}

// Prospective read model only. Conversion/package eligibility is revalidated for
// the submitted receipt date; a selectable identity is not posting activation.
function buildInventoryPurchaseOptions_(items, receiptDate) {
  var date = capitalEquityDateKey(receiptDate);
  if (!date) inventoryReceiptFail_("INVALID_RECEIPT_DATE");
  var validation = validateInventoryItemCandidates(items);
  if (validation.status !== "PASS") inventoryReceiptFail_("INVALID_INVENTORY_SELECTION_AUTHORITY");
  return validation.activeRows.filter(function(item) {
    return capitalEquityDateKey(item.EffectiveFrom) <= date &&
      (!item.EffectiveTo || capitalEquityDateKey(item.EffectiveTo) >= date);
  }).map(function(item) {
    return { itemId: item.ItemID, item: item.ItemName, baseUOM: item.BaseUOM };
  }).sort(function(a, b) { return a.item.localeCompare(b.item) || a.itemId.localeCompare(b.itemId); });
}
