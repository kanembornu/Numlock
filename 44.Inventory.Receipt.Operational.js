// Phase 11V.5: private, injected local executor only. No production service factory.
var INVENTORY_RECEIPT_OPERATIONAL_POLICY = Object.freeze({
  PRODUCTION_ENABLED: false, EARLIEST_DATE: "2026-10-01", TIMEZONE: "Asia/Jakarta",
  SOURCE_TYPE: "INVENTORY_RECEIPT_OPERATIONAL_V1", ACCOUNTING_STATUS: "NOT_POSTED"
});

function inventoryReceiptOperationalActivation_(activation, date) {
  if (!activation || activation.enabled !== true) inventoryReceiptFail_("OPERATIONAL_ACTIVATION_DISABLED");
  if (activation.timezone !== "Asia/Jakarta" || !capitalEquityDateKey(activation.effectiveFrom) ||
      activation.effectiveFrom < "2026-10-01") inventoryReceiptFail_("INVALID_OPERATIONAL_BOUNDARY");
  if (date < activation.effectiveFrom) inventoryReceiptFail_("PRE_ACTIVATION_RECEIPT");
}

// Stored receipt evidence is the historical authority; never substitute today's conversion.
function inventoryReceiptOperationalMovement_(receipt, items, activation) {
  if (receipt.Status !== "READY" || receipt.IsActive !== true || receipt.Location !== "MAIN") inventoryReceiptFail_("CAPTURE_NOT_READY");
  var binding = JSON.parse(receipt.NormalizedPayload), attestation = JSON.parse(receipt.Attestation);
  var snapshot = JSON.parse(receipt.ConversionSnapshot);
  if (["CREATE", "CORRECT"].indexOf(binding.action) === -1 || !binding.input ||
      attestation.version !== "RECEIVED_GOODS_V1" || attestation.attested !== true ||
      attestation.statement !== "I attest actual goods received, item, quantity, package/UOM, receipt date, acquisition cost and supplier/source in this payload." ||
      attestation.actor !== receipt.UpdatedBy || attestation.timestamp !== receipt.UpdatedAt ||
      JSON.stringify(attestation.payload) !== JSON.stringify(binding.input) ||
      receipt.EvidenceRef !== "ATTEST:" + receipt.LineID + ":R" + receipt.Revision) inventoryReceiptFail_("INVALID_RECEIPT_ATTESTATION");
  var expected = deriveInventoryReceipt_(binding.input, { items: items, conversions: [snapshot.authority] }).row;
  Object.keys(expected).forEach(function(key) {
    // Legacy capture reasons do not confer operational or accounting authority.
    if (key !== "ReadinessReason" && expected[key] !== receipt[key]) inventoryReceiptFail_("RECEIPT_AUTHORITY_MISMATCH:" + key);
  });
  if (expected.Status !== "READY" || !(Number(receipt.AcquisitionValue) > 0)) inventoryReceiptFail_("ZERO_COST_OR_INCOMPLETE_RECEIPT");
  inventoryReceiptOperationalActivation_(activation, receipt.ReceiptDate);
  var source = JSON.stringify([receipt.ReceiptID, receipt.LineID, receipt.Revision]);
  var row = {};
  BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.forEach(function(key) { row[key] = ""; });
  var ratio = receipt.UnitCostRatio.split("/");
  Object.assign(row, { ID_Movement: "IR-" + source, MovementTimestamp: receipt.ReceiptDate + "T00:00:00+07:00",
    ItemID: receipt.ItemID, Location: receipt.Location, BaseUOM: receipt.BaseUOM, MovementType: "PURCHASE_RECEIPT_IN",
    QtyIn: receipt.BaseQtyReceived, QtyOut: 0, UnitCost: Number(ratio[0]) / Number(ratio[1]),
    TotalCost: Number(receipt.AcquisitionValue), ValuationVariance: 0,
    SourceType: INVENTORY_RECEIPT_OPERATIONAL_POLICY.SOURCE_TYPE, SourceID: source,
    ExternalRef: receipt.ExternalRef, Keterangan: JSON.stringify({ version: "11V.5", AccountingStatus: "NOT_POSTED",
      ConversionSnapshot: receipt.ConversionSnapshot, UnitCostRatio: receipt.UnitCostRatio }), IsActive: true,
    CreatedAt: receipt.UpdatedAt, UpdatedAt: receipt.UpdatedAt, CreatedBy: receipt.UpdatedBy, UpdatedBy: receipt.UpdatedBy });
  if (row.Keterangan.length > 45000) inventoryReceiptFail_("MOVEMENT_EVIDENCE_TOO_LONG");
  return row;
}

function inventoryReceiptOperationalExact_(left, right) {
  return BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.every(function(key) {
    return key === "AccountingJournalID" ? !left[key] && !right[key] : left[key] === right[key];
  });
}

// Explicit opt-in validation requires the latest receipt evidence, not just a source marker.
function inventoryReceiptOperationalCandidateValid_(row, items, context) {
  try {
    if (!context || row.SourceType !== INVENTORY_RECEIPT_OPERATIONAL_POLICY.SOURCE_TYPE) return false;
    var source = JSON.parse(row.SourceID), history = inventoryReceiptHistory_(context.receipts);
    var receipt = history.latest[source[1]];
    return !!receipt && receipt.ReceiptID === source[0] && receipt.Revision === source[2] &&
      inventoryReceiptOperationalExact_(row, inventoryReceiptOperationalMovement_(receipt, items, context.activation));
  } catch (error) { return false; }
}

function buildInventoryReceiptTracking_(rows, items, context) {
  var validation = validateInventoryLedgerCandidates(rows, items, { operationalReceipts: context });
  if (validation.status !== "PASS") inventoryReceiptFail_("INVALID_OPERATIONAL_LEDGER:" + JSON.stringify(validation.errors));
  var states = Object.create(null);
  items.forEach(function(item) {
    states[item.ItemID + "|MAIN"] = { TrackingState: "UNTRACKED", TrackingSince: null,
      CumulativeTrackedReceiptsQty: null, TrackedReceiptAcquisitionValue: null, AverageTrackedReceiptCost: null,
      AccountingStatus: "NOT_POSTED", accountingPostingAllowed: false };
  });
  validation.activeRows.forEach(function(row) {
    if (row.SourceType !== INVENTORY_RECEIPT_OPERATIONAL_POLICY.SOURCE_TYPE) inventoryReceiptFail_("NON_RECEIPT_TRACKING_AUTHORITY_UNSUPPORTED");
    var state = states[row.ItemID + "|" + row.Location];
    var prior = inventoryReceiptDecimal_(state.CumulativeTrackedReceiptsQty || "0", 6);
    var next = inventoryReceiptDecimal_(row.QtyIn, 6);
    var qty = inventoryReceiptRatio_(prior.n * next.d + next.n * prior.d, prior.d * next.d);
    var value = (state.TrackedReceiptAcquisitionValue || 0) + row.TotalCost;
    if (!Number.isSafeInteger(value) || value <= 0) inventoryReceiptFail_("PRECISION_OVERFLOW");
    var average = inventoryReceiptMultiply_({ n: value, d: 1 }, { n: qty.d, d: qty.n });
    state.TrackingState = "TRACKING_STARTED";
    if (!state.TrackingSince || inventoryTimestampMillis(row.MovementTimestamp) < inventoryTimestampMillis(state.TrackingSince)) state.TrackingSince = row.MovementTimestamp;
    state.CumulativeTrackedReceiptsQty = inventoryReceiptDecimalText_(qty);
    state.TrackedReceiptAcquisitionValue = value;
    state.AverageTrackedReceiptCost = average.n + "/" + average.d;
  });
  return { states: states, semantics: "Average Tracked Receipt Cost", accountingPostingAllowed: false };
}

function inventoryReceiptOperationalResult_(status, reason, writes, movement, tracking) {
  return { status: status, reason: reason || null, captureReady: !!movement,
    operationalPostingAllowed: !!movement, accountingPostingAllowed: false, AccountingStatus: "NOT_POSTED",
    writeCount: writes, movement: movement || null, tracking: tracking || null,
    InventoryReceiptsWrites: 0, InventoryOpeningsWrites: 0, BalanceLedgerWrites: 0, tabopsWrites: 0,
    accountMutations: false, productionMutation: false };
}

// Adapter contract: same repository ScriptLock as capture; read() freshly returns
// {receipts, ledger, items}. appendMovement(row) appends exactly one exact23 row.
// No adapter for production is supplied. Local fixtures explicitly opt in.
function postInventoryReceiptOperational_(request, runtime) {
  if (!runtime || runtime.environment !== "LOCAL_FIXTURE") {
    return inventoryReceiptOperationalResult_("REFUSED", "PRODUCTION_OPERATIONAL_POSTING_DISABLED", 0);
  }
  runtime.lock.waitLock(30000);
  var scope = { lock: runtime.lock, active: true };
  try { return postInventoryReceiptOperationalUnderLock_(request, runtime, scope); }
  finally { scope.active = false; runtime.lock.releaseLock(); }
}

function postInventoryReceiptOperationalUnderLock_(request, runtime, scope) {
  requireInventoryReceiptLock_(runtime, scope);
  if (runtime.environment !== "LOCAL_FIXTURE") {
    return inventoryReceiptOperationalResult_("REFUSED", "PRODUCTION_OPERATIONAL_POSTING_DISABLED", 0);
  }
  var attempted = false, movement = null;
  try {
    var state = runtime.read(), history = inventoryReceiptHistory_(state.receipts);
    var receipt = history.latest[request.lineId];
    if (!receipt || receipt.ReceiptID !== request.receiptId || receipt.Revision !== request.revision) inventoryReceiptFail_("STALE_RECEIPT_REVISION");
    movement = inventoryReceiptOperationalMovement_(receipt, state.items, runtime.activation);
    var context = { receipts: state.receipts, activation: runtime.activation };
    var matches = inventoryReceiptOperationalMatches_(state.ledger, receipt);
    if (matches.length) {
      if (matches.length !== 1 || !inventoryReceiptOperationalExact_(matches[0], movement)) inventoryReceiptFail_("CONFLICT");
      var existingTracking = buildInventoryReceiptTracking_(state.ledger, state.items, context);
      return inventoryReceiptOperationalResult_("EXISTING", null, 0, matches[0], existingTracking);
    }
    var tracking = buildInventoryReceiptTracking_(state.ledger.concat([movement]), state.items, context);
    attempted = true;
    runtime.appendMovement(inventoryReceiptClone_(movement));
    var after = runtime.read();
    if (JSON.stringify(after) !== JSON.stringify(Object.assign({}, state, { ledger: state.ledger.concat([movement]) }))) inventoryReceiptFail_("WRITE_READBACK_MISMATCH");
    return inventoryReceiptOperationalResult_("POSTED", null, 1, movement, tracking);
  } catch (error) {
    if (!attempted) {
      var refused = inventoryReceiptOperationalResult_(error.message === "CONFLICT" ? "CONFLICT" : "REFUSED", error.message, 0);
      refused.captureReady = !!movement || ["OPERATIONAL_ACTIVATION_DISABLED", "INVALID_OPERATIONAL_BOUNDARY", "PRE_ACTIVATION_RECEIPT"].indexOf(error.message) !== -1;
      return refused;
    }
    // Uncertain write: reread while still locked. Never append a second time here.
    try {
      var recovered = runtime.read(), source = JSON.parse(movement.SourceID);
      var found = inventoryReceiptOperationalMatches_(recovered.ledger, { ReceiptID: source[0], LineID: source[1] });
      if (!found.length) return inventoryReceiptOperationalResult_("RETRY_REQUIRED", "NO_EFFECT_RETRY_SAME_SOURCE", 0);
      if (found.length !== 1 || !inventoryReceiptOperationalExact_(found[0], movement)) return inventoryReceiptOperationalResult_("CONFLICT", "CONFLICT", "UNKNOWN");
      var recoveredTracking = buildInventoryReceiptTracking_(recovered.ledger, recovered.items,
        { receipts: recovered.receipts, activation: runtime.activation });
      return inventoryReceiptOperationalResult_("RECOVERED_EXISTING", null, 1, found[0], recoveredTracking);
    } catch (recoveryError) {
      return inventoryReceiptOperationalResult_("WRITE_UNCERTAIN", recoveryError.message, "UNKNOWN");
    }
  }
}

function inventoryReceiptOperationalMatches_(rows, receipt) {
  return rows.filter(function(row) {
    if (row.SourceType !== INVENTORY_RECEIPT_OPERATIONAL_POLICY.SOURCE_TYPE) return false;
    var source = JSON.parse(row.SourceID);
    if (!Array.isArray(source) || source.length !== 3 || !source[0] || !source[1] || !Number.isSafeInteger(source[2]) || source[2] < 1) inventoryReceiptFail_("CONFLICT");
    // Include inactive/revised effects: correction/reversal is not authorized here.
    return source[0] === receipt.ReceiptID || source[1] === receipt.LineID;
  });
}
