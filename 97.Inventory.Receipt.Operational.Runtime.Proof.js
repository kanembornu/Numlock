// Phase 11V.6: actual executor with function-local memory; production API reads only.
function inventoryReceiptOperationalProof_(authority) {
  function check(value, label) { if (!value) throw new Error("OPERATIONAL_PROOF:" + label); }
  var suite = testInventoryReceiptOperationalContracts(authority);
  var capture = inventoryReceiptTestRuntime_(authority), clone = inventoryReceiptClone_;
  migrateInventoryReceiptSchema_(capture);
  var input = { ReceiptDate: "2026-10-01", ItemID: "ING-009", PurchaseQty: "1", PurchaseUOM: "carton",
    AcquisitionValue: "12000", SupplierSource: "SYNTHETIC_PROOF", Attested: true,
    ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE" };
  var first = captureInventoryReceipt_({ idempotencyKey: "runtime-package-01", input: input }, capture).row;
  var second = captureInventoryReceipt_({ idempotencyKey: "runtime-package-02",
    input: Object.assign({}, input, { AcquisitionValue: "24000" }) }, capture).row;
  var state = { receipts: [first, second], ledger: [], items: clone(authority.items) }, locked = false, writes = 0;
  var activation = { enabled: true, effectiveFrom: "2026-10-01", timezone: "Asia/Jakarta" };
  var runtime = { environment: "LOCAL_FIXTURE", activation: activation,
    lock: { waitLock: function() { check(!locked, "exclusive lock"); locked = true; }, releaseLock: function() { locked = false; } },
    read: function() { check(locked, "read under lock"); return clone(state); },
    appendMovement: function(row) { check(locked, "append under lock"); writes++; state.ledger.push(clone(row)); } };
  function post(row) { return postInventoryReceiptOperational_({ receiptId: row.ReceiptID, lineId: row.LineID, revision: row.Revision }, runtime); }
  // No current conversion provider exists on this adapter: only the frozen capture snapshot is available.
  var result = post(first), movement = clone(result.movement);
  check(result.status === "POSTED" && writes === 1 && movement.QtyIn === "12000", "governed package executor");
  check(JSON.parse(movement.Keterangan).ConversionSnapshot === first.ConversionSnapshot, "package snapshot");
  check(result.captureReady && result.operationalPostingAllowed && !result.accountingPostingAllowed, "readiness separation");
  check(result.tracking.states["ING-009|MAIN"].TrackedReceiptAcquisitionValue === 12000, "first acquisition value");
  // Simulate another completed receipt while this invocation waits for the shared lock.
  state.ledger = []; writes = 0;
  runtime.lock.waitLock = function() { check(!locked, "exclusive lock"); locked = true; state.ledger.push(clone(movement)); };
  result = post(second);
  var tracked = result.tracking.states["ING-009|MAIN"];
  check(result.status === "POSTED" && writes === 1 && tracked.CumulativeTrackedReceiptsQty === "24000" &&
    tracked.TrackedReceiptAcquisitionValue === 36000 && tracked.AverageTrackedReceiptCost === "3/2", "post-lock weighted average");
  check(!result.reason && state.ledger.every(function(row) { return row.MovementType === "PURCHASE_RECEIPT_IN"; }), "no opening dependency");
  check(!("StockOnHand" in tracked) && !("AvailableStock" in tracked) && !("LowStock" in tracked) &&
    !("PhysicalRemainingInventoryValue" in tracked) && !("Account1100Balance" in tracked), "operational value is not physical or accounting balance");
  var refused = false;
  try { buildMovingWeightedAverageCandidates(state.ledger, state.items, { operationalReceipts: { receipts: state.receipts, activation: activation } }); }
  catch (error) { refused = /NOT_REMAINING/.test(error.message); }
  check(refused, "remaining valuation refused");
  check(INVENTORY_RECEIPT_OPERATIONAL_POLICY.PRODUCTION_ENABLED === false && BALANCE_FOUNDATION_POLICY.HPP_AUTHORITY === "tabsal.HPP" &&
    BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED === false, "production and COGS boundaries");
  testInventoryOpeningStagingContracts();
  return { status: "PASS", trackingModel: "RECEIPT_FIRST", method: "FUNCTION_LOCAL_SYNTHETIC_MEMORY",
    operationalChecks: suite.checks, readinessSeparation: "PASS", firstReceipt: "PASS", subsequentReceipt: "PASS",
    independentActivation: "PASS", openingRequired: false, openingMovementCreated: false,
    trackingSince: "2026-10-01T00:00:00+07:00", mwa: "PASS", accountingPostingAllowed: false,
    blankJournalOperationalReceipt: "PASS", conversionSnapshot: "PASS", lemon: "PASS", activationBoundary: "PASS",
    idempotentRetryWrites: 0, conflict: "PASS", locking: "PASS_SIMULATED_POST_LOCK_MWA", recovery: "PASS",
    postedReceiptGuard: "PASS", reporting: "PASS", stockOnHandAvailable: false, operationalValueIsAccount1100Balance: false,
    exclusiveTabopsRouting: "PASS_DISABLED", cogsAuthority: "tabsal.Qty * tabsal.HPP",
    inventoryReceiptsProductionWrites: 0, inventoryLedgerProductionWrites: 0, inventoryOpeningsWrites: 0,
    balanceLedgerWrites: 0, tabopsWrites: 0, cashWrites: 0, account1100Mutation: false, account3200Mutation: false,
    account3210Creation: false, recipeConsumption: false, productionMutation: false,
    cleanup: "PASS", externalResourcesCreated: 0, remainingProofBusinessResources: 0 };
}

function runInventoryReceiptOperationalDisposableRuntimeProof() {
  var before = inventoryReceiptMigrationRead_(), result, failure;
  try {
    var baseline = inventoryReceiptMigrationEvaluate_(before, inventoryReceiptMigrationDigest_);
    if (baseline.status !== "ALREADY_MIGRATED" || baseline.businessRows !== 0 || baseline.preservation !== "PASS_POST11U_AND_CURRENT_RECORDED_SURFACES") {
      throw new Error("PRODUCTION_BASELINE_REFUSED:" + (baseline.reason || baseline.status));
    }
    var sheets = {};
    before.sheets.forEach(function(sheet) { sheets[sheet.properties.title] = sheet; });
    var ledger = inventoryReceiptMigrationSheet_(sheets.InventoryLedger);
    if (Object.keys(ledger.cells).some(function(key) {
      var rc = key.split(",").map(Number), cell = ledger.cells[key];
      return rc[0] === 1 && rc[1] > 23 && (cell.effectiveValue || cell.userEnteredValue);
    }) || BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.some(function(h, i) {
      var cell = ledger.cells["1," + (i + 1)]; return !cell || !cell.effectiveValue || cell.effectiveValue.stringValue !== h;
    })) throw new Error("PRODUCTION_LEDGER_SCHEMA_MISMATCH");
    result = inventoryReceiptOperationalProof_({ items: inventoryReceiptMigrationRows_(sheets.InventoryItems),
      conversions: inventoryReceiptMigrationRows_(sheets.InventoryUOMConversions) });
  } catch (error) { failure = error; }
  var after = inventoryReceiptMigrationRead_();
  if (inventoryReceiptMigrationDigest_(before) !== inventoryReceiptMigrationDigest_(after)) throw new Error("PROSPECTIVE_PRODUCTION_PRESERVATION_FAILED");
  if (failure) throw failure;
  result.preservation = "PASS_POST11U_RECORDED_AND_PROSPECTIVE_API_SURFACES";
  result.conversionAuthorities = 22;
  result.productionBusinessRows = { InventoryReceipts: 0, InventoryLedger: 0, InventoryOpenings: 0 };
  result.account3210 = "ABSENT";
  Logger.log(JSON.stringify(result));
  return result;
}
