function testInventoryReceiptOperationalContracts(authority) {
  var count = 0, clone = inventoryReceiptClone_, baseline = JSON.stringify(authority);
  function check(condition, label) { count++; if (!condition) throw new Error("Operational receipt: " + label); }
  function throws(fn, label) { var failed = false; try { fn(); } catch (error) { failed = true; } check(failed, label); }
  var input = { ReceiptDate: "2026-10-01", ItemID: "ING-018", PurchaseQty: "500", PurchaseUOM: "gr",
    AcquisitionValue: "10001", SupplierSource: "TEST_SOURCE", Attested: true, ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE" };
  var capture = inventoryReceiptTestRuntime_(authority);
  migrateInventoryReceiptSchema_(capture);
  function receipt(key, patch) {
    var result = captureInventoryReceipt_({ idempotencyKey: key, input: Object.assign({}, input, patch || {}) }, capture);
    check(result.status === "CAPTURED", "capture fixture " + key); return result.row;
  }
  var first = receipt("operational-001"), second = receipt("operational-002", { PurchaseQty: "250", AcquisitionValue: "8000" });
  var locked = false, reads = 0, writes = 0, failure = "", state;
  var activation = { enabled: true, effectiveFrom: "2026-10-01", timezone: "Asia/Jakarta" };
  function reset() { state = { receipts: [clone(first), clone(second)], ledger: [], items: clone(authority.items) }; failure = ""; writes = 0; }
  var runtime = { environment: "LOCAL_FIXTURE", activation: activation,
    lock: { waitLock: function() { check(!locked, "lock acquired"); locked = true; }, releaseLock: function() { locked = false; } },
    read: function() { check(locked, "fresh read under lock"); reads++; if (failure === "READ" && writes) throw new Error("READ_UNAVAILABLE"); return clone(state); },
    appendMovement: function(row) { check(locked, "write under lock"); writes++;
      if (failure === "BEFORE") { failure = ""; throw new Error("BEFORE_WRITE"); }
      state.ledger.push(clone(row));
      if (failure === "CONFLICT") state.ledger[0].TotalCost++;
      if (failure) { if (failure !== "READ") failure = ""; throw new Error("AFTER_WRITE"); }
    } };
  function post(row) { return postInventoryReceiptOperational_({ receiptId: row.ReceiptID, lineId: row.LineID, revision: row.Revision }, runtime); }
  function context() { return { receipts: state.receipts, activation: activation }; }
  reset();
  var untracked = buildInventoryReceiptTracking_([], state.items, context()).states["ING-018|MAIN"];
  check(untracked.TrackingState === "UNTRACKED" && untracked.CumulativeTrackedReceiptsQty === null, "untracked is not physical zero");
  var result = post(first), movement = clone(result.movement), tracked = result.tracking.states["ING-018|MAIN"];
  check(result.status === "POSTED" && writes === 1, "first receipt writes one");
  check(movement.MovementType === "PURCHASE_RECEIPT_IN" && movement.QtyIn === "12", "first receipt no opening");
  check(tracked.TrackingState === "TRACKING_STARTED" && tracked.AverageTrackedReceiptCost === "10001/12", "first MWA");
  check(tracked.TrackingSince === "2026-10-01T00:00:00+07:00", "Jakarta tracking date");
  check(!("StockOnHand" in tracked) && !("AvailableStock" in tracked) && !("LowStock" in tracked), "truthful reporting names");
  check(result.tracking.states[authority.items.find(function(i) { return i.ItemID !== "ING-018"; }).ItemID + "|MAIN"].TrackingState === "UNTRACKED", "independent item state");
  check(result.accountingPostingAllowed === false && movement.AccountingJournalID === "", "no invented journal");
  check(JSON.parse(movement.Keterangan).ConversionSnapshot === first.ConversionSnapshot, "frozen snapshot");
  check(post(first).status === "EXISTING" && writes === 1, "retry writes0");
  result = post(second); tracked = result.tracking.states["ING-018|MAIN"];
  check(tracked.CumulativeTrackedReceiptsQty === "18" && tracked.TrackedReceiptAcquisitionValue === 18001 && tracked.AverageTrackedReceiptCost === "18001/18", "subsequent exact MWA");
  check(tracked.TrackingSince === movement.MovementTimestamp, "tracking since retained");
  check(result.InventoryReceiptsWrites === 0 && result.InventoryOpeningsWrites === 0 && result.BalanceLedgerWrites === 0 && result.tabopsWrites === 0 && !result.accountMutations, "forbidden writes zero");
  reset(); state.items = state.items.filter(function(i) { return i.ItemID === "ING-018"; });
  check(post(first).status === "POSTED", "no all22 or opening gate");
  reset(); state.ledger = [clone(movement)]; state.ledger[0].TotalCost++;
  check(post(first).status === "CONFLICT" && writes === 0, "conflicting existing effect");
  reset(); state.ledger = [clone(movement), clone(movement)];
  check(post(first).status === "CONFLICT" && writes === 0, "duplicate effects");
  reset(); state.ledger = [clone(movement)]; state.ledger[0].IsActive = false;
  check(post(first).status === "CONFLICT", "inactive effect needs correction authority");
  ["BEFORE", "AFTER", "CONFLICT", "READ"].forEach(function(mode) {
    reset(); failure = mode; result = post(first);
    check(result.status === ({ BEFORE: "RETRY_REQUIRED", AFTER: "RECOVERED_EXISTING", CONFLICT: "CONFLICT", READ: "WRITE_UNCERTAIN" })[mode], "recovery " + mode);
    check(writes === 1 && !locked, "no automatic retry and lock released");
    if (mode === "BEFORE" || mode === "AFTER") {
      result = post(first); check(result.status === (mode === "BEFORE" ? "POSTED" : "EXISTING"), "controlled retry " + mode);
      check(state.ledger.length === 1 && state.ledger[0].ID_Movement === movement.ID_Movement, "stable recovery identity");
    }
  });
  reset(); runtime.environment = "PRODUCTION";
  check(post(first).reason === "PRODUCTION_OPERATIONAL_POSTING_DISABLED" && writes === 0, "production disabled despite date and flag");
  runtime.environment = "LOCAL_FIXTURE"; activation.enabled = false;
  check(post(first).reason === "OPERATIONAL_ACTIVATION_DISABLED", "default activation refused");
  activation.enabled = true; activation.effectiveFrom = "2026-10-02";
  check(post(first).reason === "PRE_ACTIVATION_RECEIPT", "before configured boundary");
  activation.effectiveFrom = "2026-09-30";
  check(post(first).reason === "INVALID_OPERATIONAL_BOUNDARY", "earliest boundary enforced");
  activation.effectiveFrom = "2026-10-01";
  ["Status", "Attestation", "BaseQtyReceived", "AcquisitionValue", "ConversionSnapshot", "Location", "ReceiptDate"].forEach(function(field) {
    reset(); state.receipts[0][field] = ({Status:"PENDING", Attestation:"{}", BaseQtyReceived:"0", AcquisitionValue:"0", ConversionSnapshot:"{}", Location:"OTHER", ReceiptDate:"2026-09-30"})[field];
    check(post(first).status === "REFUSED" && writes === 0, "invalid authority " + field);
  });
  reset(); state.receipts[0].BaseQtyReceived = "-1";
  check(post(first).status === "REFUSED", "negative quantity");
  reset(); state.receipts[0].Revision = 2;
  check(post(first).status === "REFUSED", "invalid revision history");
  reset();
  var pending = receipt("operational-003", { AcquisitionValue: "0", ZeroCostClassification: "GIFT", ZeroCostEvidence: "TEST" });
  state.receipts.push(pending); check(post(pending).status === "REFUSED", "zero cost exception blocked");
  reset();
  var fractionalA = receipt("operational-frac1", { ItemID: "ING-006", PurchaseUOM: "gr", PurchaseQty: "0.1", AcquisitionValue: "1" });
  var fractionalB = receipt("operational-frac2", { ItemID: "ING-006", PurchaseUOM: "gr", PurchaseQty: "0.2", AcquisitionValue: "2" });
  state.receipts.push(fractionalA, fractionalB);
  check(post(fractionalA).status === "POSTED" && post(fractionalB).status === "POSTED", "independent second item starts");
  tracked = post(fractionalA).tracking.states["ING-006|MAIN"];
  check(tracked.CumulativeTrackedReceiptsQty === "0.3" && tracked.AverageTrackedReceiptCost === "10/1", "decimal accumulation exact");
  check(post(first).status === "POSTED", "two independent tracked items coexist");
  var pendingRevision = receipt("operational-rev1", { Attested: false });
  var correctedRevision = captureInventoryReceipt_({action:"CORRECT", idempotencyKey:"operational-rev2", lineId:pendingRevision.LineID,
    expectedRevision:1, reason:"Attested", input:input}, capture).row;
  reset(); state.receipts.push(pendingRevision, correctedRevision);
  check(post(pendingRevision).reason === "STALE_RECEIPT_REVISION", "only latest revision");
  check(post(correctedRevision).status === "POSTED", "valid corrected revision accepted");
  reset();
  var originalWait = runtime.lock.waitLock;
  runtime.lock.waitLock = function() { originalWait(); state.ledger.push(clone(movement)); };
  check(post(first).status === "EXISTING" && writes === 0, "fresh post-lock state wins");
  runtime.lock.waitLock = originalWait;
  reset(); activation.enabled = false;
  check(post(first).captureReady === true && post(first).operationalPostingAllowed === false, "capture and operational readiness independent");
  activation.enabled = true;
  var alteredStatement = clone(first); var evidence = JSON.parse(alteredStatement.Attestation); delete evidence.statement;
  alteredStatement.Attestation = JSON.stringify(evidence); state.receipts[0] = alteredStatement;
  check(post(first).reason === "INVALID_RECEIPT_ATTESTATION", "attestation statement required");
  reset(); state.ledger = [clone(movement)]; state.ledger[0].SourceID = "{}";
  check(post(first).status === "CONFLICT" && writes === 0, "malformed source fails closed");
  reset();
  var options = { operationalReceipts: context() };
  check(validateInventoryLedgerCandidates([movement], state.items, options).status === "PASS", "narrow operational journal exception");
  var nullJournal = clone(movement); nullJournal.AccountingJournalID = null;
  check(validateInventoryLedgerCandidates([nullJournal], state.items, options).status === "PASS", "null journal allowed");
  ["ADJUSTMENT_IN", "OPENING_IN", "CONSUMPTION_OUT"].forEach(function(type) {
    var row = clone(movement); row.MovementType = type;
    check(validateInventoryLedgerCandidates([row], state.items, options).status === "FAIL", "strict other movement " + type);
  });
  var fabricated = clone(movement); fabricated.AccountingJournalID = "FAKE";
  check(validateInventoryLedgerCandidates([fabricated], state.items, options).status === "FAIL", "fabricated journal refused");
  throws(function() { buildMovingWeightedAverageCandidates([movement], state.items, options); }, "remaining valuation guard");
  // Capture lifecycle reads the actual ledger under its existing shared lock.
  capture.makeSheet("InventoryLedger", [BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.slice(),
    BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.map(function(key) { return movement[key]; })]);
  ["CANCEL", "CORRECT"].forEach(function(action) {
    var command = { action: action, lineId: first.LineID, expectedRevision: 1, reason: "TEST", idempotencyKey: "posted-guard-" + action };
    if (action === "CORRECT") command.input = input;
    var beforeCalls = capture.calls.length;
    check(captureInventoryReceipt_(command, capture).reason === "OPERATIONAL_REVERSAL_OR_CORRECTION_REQUIRED" && capture.calls.length === beforeCalls, "posted lifecycle guarded " + action);
  });
  check(guardInventoryReceiptRoute_("INVENTORY_RECEIPT", ["InventoryReceipts", "tabops"]).status === "REFUSED", "exclusive routing");
  check(guardInventoryReceiptRoute_("INVENTORY_RECEIPT", ["InventoryReceipts"]).activated === false, "routing dormant");
  check(BALANCE_FOUNDATION_POLICY.HPP_AUTHORITY === "tabsal.HPP" && !BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED, "COGS and consumption unchanged");
  check(JSON.stringify(authority) === baseline, "22 authorities unchanged");
  Logger.log("testInventoryReceiptOperationalContracts: PASS (" + count + " checks)");
  return { status: "PASS", checks: count };
}
