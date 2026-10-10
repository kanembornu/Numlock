// Treasury T7 operator API tests: thin endpoint contracts, U-scenario server
// flows (Save/Reverse/Correct through the PUBLIC endpoints with fixture-only
// resolver/config/transport stubs), post-mutation T5 parity, capability
// matrix, tamper rejection, and the source/call-graph audit for 99D + the
// Treasury UI sources. In-memory fixtures only: no production access, no
// network (the batch transport is replaced by a fixture writer and restored),
// no clasp, no writes outside fixture memory.

function treasuryT7Check_(id, value, detail) {
  if (!value) throw new Error("TREASURY_T7:" + id + (detail === undefined ? "" : "|" + detail));
}

// Fixture-server scope: production resolver + config + actor + flush + batch
// transport stubbed over ONE fixture, everything restored in finally. This is
// what lets the REAL public endpoints (treasuryReceiptDurableSave / Reverse /
// Correct, getTreasuryOperatorWorkspace / ReceiptDetail) execute locally.
function treasuryT7WithServerStubs_(fixture, config, fn) {
  var originalResolver = globalThis.requireNumlockProductionSpreadsheet;
  var originalProperties = globalThis.PropertiesService;
  var originalBatch = globalThis.treasuryReceiptBatchRequest_;
  var hadActiveUser = Object.prototype.hasOwnProperty.call(Session, "getActiveUser");
  var originalActiveUser = Session.getActiveUser;
  var hadFlush = Object.prototype.hasOwnProperty.call(SpreadsheetApp, "flush");
  var originalFlush = SpreadsheetApp.flush;
  globalThis.requireNumlockProductionSpreadsheet = function() { return fixture; };
  globalThis.PropertiesService = {
    getScriptProperties: function() {
      return { getProperty: function() {
        return config === undefined ? JSON.stringify(treasuryT4ActiveConfig_()) : config;
      } };
    }
  };
  Session.getActiveUser = function() {
    return { getEmail: function() { return "tester@numlock.test"; } };
  };
  SpreadsheetApp.flush = function() {};
  globalThis.treasuryReceiptBatchRequest_ = function(valueRanges) {
    valueRanges.forEach(function(range) {
      var sheet = fixture.getSheetByName(range.range);
      if (!sheet) throw new Error("Missing batch sheet: " + range.range);
      var cols = range.values[0] ? range.values[0].length : 0;
      sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length, cols).setValues(range.values);
    });
    return { spreadsheetId: "FIXTURE", replies: [] };
  };
  try {
    return fn();
  } finally {
    globalThis.treasuryReceiptBatchRequest_ = originalBatch;
    SpreadsheetApp.flush = originalFlush;
    if (!hadFlush) delete SpreadsheetApp.flush;
    Session.getActiveUser = originalActiveUser;
    if (!hadActiveUser) delete Session.getActiveUser;
    globalThis.PropertiesService = originalProperties;
    if (originalResolver) {
      globalThis.requireNumlockProductionSpreadsheet = originalResolver;
    } else {
      delete globalThis.requireNumlockProductionSpreadsheet;
    }
  }
}

function treasuryT7Payload_(key, overrides) {
  return Object.assign(treasuryT4Payload_(key, overrides), overrides || {});
}

// Seeded exposure dated EARLY in 2026: lifecycle operations stamp the server
// action day (wall clock), which must never predate the recognition date.
function treasuryT7SeededFixture_() {
  var fixture = salesV2SaveFixture_(treasuryT4BaseSheets_());
  u3CommittedAppend_(fixture, {
    orderID: "ORD-T4-1", amount: 24000, date: "2026-01-06",
    recognizedAt: "2026-01-06T03:00:00.000Z", requestKey: "u3-t7-ord-1"
  });
  return fixture;
}

function testTreasuryT7Endpoints() {
  var pass = 0;
  function check(id, value, detail) { treasuryT7Check_(id, value, detail); pass++; }
  var contract = TREASURY_RECEIPT_V1_CONTRACT;

  // --- E1: workspace load BEFORE save (U2 server side) + destinations + caps
  var fixture = treasuryT4SeededFixture_();
  var workspaceBefore = null, saveResult = null, workspaceAfter = null,
    detailBefore = null, detailAfter = null, replayResult = null;
  var beforeCounts = treasuryT4RowCounts_(fixture);
  treasuryT7WithServerStubs_(fixture, undefined, function() {
    workspaceBefore = getTreasuryOperatorWorkspace({});
    detailBefore = getTreasuryOperatorReceiptDetail({ recognitionID: "SCR-U3-ORD-T4-1" });
    saveResult = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7-key-001"));
    replayResult = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7-key-001"));
    workspaceAfter = getTreasuryOperatorWorkspace({});
    detailAfter = getTreasuryOperatorReceiptDetail({ recognitionID: "SCR-U3-ORD-T4-1" });
  });
  check("E1", workspaceBefore.contract === "TREASURY_OPERATOR_WORKSPACE_V1" &&
    workspaceBefore.receipts.contract === "TREASURY_CLEARING_PROJECTION_V1" &&
    workspaceBefore.reconciliation.contract === "TREASURY_1030_RECONCILIATION_V1" &&
    workspaceBefore.receipts.rows.length === 1 &&
    workspaceBefore.receipts.rows[0].ClearingStatus === "UNCLEARED" &&
    Number(workspaceBefore.receipts.rows[0].OutstandingAmount) === 24000,
    JSON.stringify(workspaceBefore && workspaceBefore.receipts && workspaceBefore.receipts.totals));
  check("E2", workspaceBefore.mode.allowed === true && workspaceBefore.mode.mode === "ACTIVE",
    JSON.stringify(workspaceBefore.mode));
  var destCodes = workspaceBefore.destinations.map(function(d) { return d.accountCode; });
  check("E3", destCodes.indexOf("1000") !== -1 && destCodes.indexOf("1010") !== -1 &&
    destCodes.indexOf("1020") !== -1 && destCodes.indexOf("1030") === -1 &&
    destCodes.length === contract.DESTINATION_ACCOUNT_CODES.length &&
    destCodes.every(function(code) {
      return contract.DESTINATION_ACCOUNT_CODES.indexOf(code) !== -1;
    }), destCodes.join(","));
  check("E4", workspaceBefore.destinations.every(function(d) {
    return typeof d.accountName === "string" && d.accountName !== "";
  }), JSON.stringify(workspaceBefore.destinations));
  var capsBefore = workspaceBefore.capabilities["SCR-U3-ORD-T4-1"];
  check("E5", capsBefore.canSave === true && capsBefore.canReverse === false &&
    capsBefore.canCorrect === false && capsBefore.actionReason === "", JSON.stringify(capsBefore));
  check("E6", detailBefore.status === "OK" && detailBefore.receipts.length === 0 &&
    detailBefore.capabilities.canReverse === false &&
    detailBefore.capabilities.actionReason === "NOT_CLEARED" &&
    detailBefore.exposure.ClearingStatus === "UNCLEARED", JSON.stringify(detailBefore.capabilities));

  // --- E7: Save through the PUBLIC endpoint -> DONE, idempotent replay
  check("E7", saveResult.status === "DONE" && saveResult.receiptID !== "" &&
    replayResult.status === "DONE" && replayResult.replay === true &&
    replayResult.receiptID === saveResult.receiptID, JSON.stringify({ s: saveResult, r: replayResult }));

  // --- E8: immediate T5 reread parity (U3 server): CLEARED, once, residual 0
  var rowAfter = workspaceAfter.receipts.rows[0];
  check("E8", rowAfter.ClearingStatus === "CLEARED" &&
    Number(rowAfter.OutstandingAmount) === 0 &&
    Number(rowAfter.ClearedAmount) === 24000 &&
    rowAfter.ActiveReceiptID === saveResult.receiptID &&
    workspaceAfter.reconciliation.unexplainedResidual === 0 &&
    workspaceAfter.reconciliation.reconciliationStatus === "OK",
    JSON.stringify({ row: rowAfter, recon: workspaceAfter.reconciliation }));
  var afterCounts = treasuryT4RowCounts_(fixture);
  check("E9", afterCounts.TreasuryReceipts === beforeCounts.TreasuryReceipts + 1,
    JSON.stringify({ before: beforeCounts.TreasuryReceipts, after: afterCounts.TreasuryReceipts }));

  // --- E10: detail after save — sanitized contract, lineage role, capabilities
  var receipt0 = detailAfter.receipts[0];
  check("E10", detailAfter.status === "OK" && detailAfter.receipts.length === 1 &&
    receipt0.treasuryReceiptID === saveResult.receiptID &&
    receipt0.lineageRole === "ORIGINAL" && receipt0.receiptStatus === "ACTIVE" &&
    receipt0.operationState === "COMMITTED" && receipt0.journalID !== "" &&
    receipt0.evidenceRef === "WALLET-TRX-001" && receipt0.destinationAccountCode === "1000" &&
    Object.prototype.hasOwnProperty.call(receipt0, "SnapshotJSON") === false &&
    Object.prototype.hasOwnProperty.call(receipt0, "JournalSignature") === false,
    JSON.stringify(receipt0));
  check("E11", detailAfter.capabilities.canReverse === true &&
    detailAfter.capabilities.canCorrect === true &&
    detailAfter.capabilities.canSave === undefined &&
    detailAfter.capabilities.actionReason === "" &&
    detailAfter.exposure.ClearingStatus === "CLEARED" &&
    detailAfter.exposure.QualityCodes.length === 0, JSON.stringify(detailAfter.capabilities));
  var capsAfter = workspaceAfter.capabilities["SCR-U3-ORD-T4-1"];
  check("E12", capsAfter.canSave === false && capsAfter.canReverse === true &&
    capsAfter.actionReason === "", JSON.stringify(capsAfter));

  // --- E13: EXCEPTION exposure stays visible and fail-closed (U11 server)
  // Seed a real receipt first, then a second structurally valid active receipt
  // => DUPLICATE_ACTIVE_RECEIPTS => canonical EXCEPTION row.
  var exceptionFixture = treasuryT4SeededFixture_();
  treasuryT7WithServerStubs_(exceptionFixture, undefined, function() {
    var seed = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7-exc-01"));
    if (seed.status !== "DONE") throw new Error("E13_SEED_FAILED:" + seed.status);
  });
  treasuryT5FabricateReceipt_(exceptionFixture, { suffix: "T7DUP" });
  var exceptionWorkspace = null;
  treasuryT7WithServerStubs_(exceptionFixture, undefined, function() {
    exceptionWorkspace = getTreasuryOperatorWorkspace({});
  });
  var exceptionRow = exceptionWorkspace.receipts.rows[0];
  var exceptionCap = exceptionWorkspace.capabilities["SCR-U3-ORD-T4-1"];
  check("E13", exceptionRow && exceptionRow.ClearingStatus === "EXCEPTION" &&
    exceptionRow.QualityCodes.length > 0 &&
    exceptionCap.canSave === false && exceptionCap.canReverse === false &&
    exceptionCap.canCorrect === false && exceptionCap.actionReason === "EXPOSURE_EXCEPTION",
    JSON.stringify({ status: exceptionRow && exceptionRow.ClearingStatus, cap: exceptionCap }));

  // --- E14: unavailable mode fails closed (no capability without activation)
  var pausedFixture = treasuryT4SeededFixture_();
  var pausedWorkspace = null;
  treasuryT7WithServerStubs_(pausedFixture, null, function() {
    pausedWorkspace = getTreasuryOperatorWorkspace({});
  });
  var pausedCap = pausedWorkspace.capabilities["SCR-U3-ORD-T4-1"];
  check("E14", pausedWorkspace.mode.allowed === false &&
    pausedCap.canSave === false && pausedCap.canReverse === false &&
    pausedCap.actionReason === "TREASURY_CONFIG_INVALID",
    JSON.stringify({ mode: pausedWorkspace.mode, cap: pausedCap }));

  // --- E15: U14 — 1030 destination tamper rejected SERVER-side, zero writes
  var tamperFixture = treasuryT4SeededFixture_();
  var tamperCounts = treasuryT4RowCounts_(tamperFixture);
  var tamperResult = null;
  treasuryT7WithServerStubs_(tamperFixture, undefined, function() {
    tamperResult = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7-tamper-1030",
      { destinationAccountCode: "1030" }));
  });
  var tamperAfter = treasuryT4RowCounts_(tamperFixture);
  check("E15", tamperResult.status === "REFUSED" &&
    tamperResult.code === "TREASURY_DESTINATION_IS_CLEARING" &&
    JSON.stringify(tamperAfter) === JSON.stringify(tamperCounts),
    JSON.stringify(tamperResult));

  // --- E16: U15 — partial-amount tamper rejected SERVER-side, zero writes
  var partialFixture = treasuryT4SeededFixture_();
  var partialCounts = treasuryT4RowCounts_(partialFixture);
  var partialResult = null;
  treasuryT7WithServerStubs_(partialFixture, undefined, function() {
    partialResult = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7-tamper-partial",
      { grossAmount: 20000 }));
  });
  var partialAfter = treasuryT4RowCounts_(partialFixture);
  check("E16", partialResult.status === "REFUSED" && partialResult.code !== "" &&
    partialResult.code.indexOf("TREASURY_") === 0 &&
    JSON.stringify(partialAfter) === JSON.stringify(partialCounts),
    JSON.stringify(partialResult));

  // --- E17: detail NOT_FOUND / invalid recognitionID fail closed
  var missingDetail = null, thrown = null;
  treasuryT7WithServerStubs_(fixture, undefined, function() {
    try {
      missingDetail = getTreasuryOperatorReceiptDetail({ recognitionID: "SCR-NOPE-9999" });
    } catch (error) { thrown = error; }
  });
  check("E17", !thrown && missingDetail && missingDetail.status === "NOT_FOUND" &&
    missingDetail.capabilities.canReverse === false &&
    missingDetail.capabilities.actionReason === "EXPOSURE_NOT_FOUND",
    JSON.stringify(missingDetail || (thrown && thrown.message)));

  return pass;
}

function testTreasuryT7IntegrationFlows() {
  var pass = 0;
  function check(id, value, detail) { treasuryT7Check_(id, value, detail); pass++; }

  // --- F1 (U7): endpoint Save -> endpoint Reverse -> immediate T5 reread
  var fixture = treasuryT7SeededFixture_();
  var saveResult = null, reverseResult = null, afterReverse = null, reconAfterReverse = null;
  treasuryT7WithServerStubs_(fixture, undefined, function() {
    saveResult = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7f-save-01"));
    reverseResult = treasuryT6WithJakartaDate_(function() {
      return treasuryOperatorReverseReceipt(treasuryT6ReversePayload_("t7f-rev-01",
        saveResult.receiptID));
    });
    afterReverse = getTreasuryOperatorReceiptDetail({ recognitionID: "SCR-U3-ORD-T4-1" });
    reconAfterReverse = getTreasuryOperatorWorkspace({}).reconciliation;
  });
  check("F1", saveResult.status === "DONE" && reverseResult.status === "DONE" &&
    reverseResult.receiptID !== saveResult.receiptID, JSON.stringify({ s: saveResult, r: reverseResult }));
  var reverseRow = afterReverse.exposure;
  check("F2", afterReverse.status === "OK" && reverseRow.ClearingStatus === "UNCLEARED" &&
    Number(reverseRow.OutstandingAmount) === 24000 &&
    Number(reverseRow.ReversalAmount) === 24000 &&
    afterReverse.receipts.length === 2 &&
    afterReverse.receipts.filter(function(r) { return r.lineageRole === "REVERSAL"; }).length === 1 &&
    afterReverse.receipts.filter(function(r) { return r.receiptStatus === "REVERSED"; }).length === 1,
    JSON.stringify({ status: afterReverse.status, clearing: reverseRow.ClearingStatus,
      outstanding: reverseRow.OutstandingAmount, reversal: reverseRow.ReversalAmount,
      quality: reverseRow.QualityCodes,
      receipts: afterReverse.receipts.map(function(r) { return [r.treasuryReceiptID, r.lineageRole, r.receiptStatus]; }) }));
  check("F3", reconAfterReverse.unexplainedResidual === 0 &&
    reconAfterReverse.reconciliationStatus === "OK",
    JSON.stringify(reconAfterReverse));
  // Post-reversal Save is a NEW sanctioned intent (new key) and clears again.
  var restoreSave = null, afterRestore = null;
  treasuryT7WithServerStubs_(fixture, undefined, function() {
    restoreSave = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7f-restore-01"));
    afterRestore = getTreasuryOperatorReceiptDetail({ recognitionID: "SCR-U3-ORD-T4-1" });
  });
  check("F4", restoreSave.status === "DONE" && afterRestore.exposure.ClearingStatus === "CLEARED" &&
    Number(afterRestore.exposure.OutstandingAmount) === 0,
    JSON.stringify({ s: restoreSave, status: afterRestore.exposure.ClearingStatus }));

  // --- F2 (U9): endpoint Correct -> T5 CLEARED with replacement active
  var correctFixture = treasuryT7SeededFixture_();
  var cSave = null, cCorrect = null, afterCorrect = null, originalBytesBefore = null,
    originalBytesAfter = null, reconAfterCorrect = null;
  treasuryT7WithServerStubs_(correctFixture, undefined, function() {
    cSave = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7f-c-save"));
    originalBytesBefore = treasuryT6OriginalBytes_(correctFixture, cSave.receiptID);
    cCorrect = treasuryT6WithJakartaDate_(function() {
      return treasuryOperatorCorrectReceipt(treasuryT6CorrectPayload_("t7f-c-corr", cSave.receiptID));
    });
    originalBytesAfter = treasuryT6OriginalBytes_(correctFixture, cSave.receiptID);
    afterCorrect = getTreasuryOperatorReceiptDetail({ recognitionID: "SCR-U3-ORD-T4-1" });
    reconAfterCorrect = getTreasuryOperatorWorkspace({}).reconciliation;
  });
  check("F5", cSave.status === "DONE" && cCorrect.status === "DONE" &&
    cCorrect.receiptID !== cSave.receiptID, JSON.stringify({ s: cSave, c: cCorrect }));
  var replacement = afterCorrect.receipts.filter(function(r) {
    return r.lineageRole === "REPLACEMENT";
  })[0];
  check("F6", afterCorrect.status === "OK" &&
    afterCorrect.exposure.ClearingStatus === "CLEARED" &&
    Number(afterCorrect.exposure.OutstandingAmount) === 0 &&
    afterCorrect.exposure.ActiveReceiptID === cCorrect.receiptID &&
    replacement && replacement.destinationAccountCode === "1010" &&
    replacement.receiptStatus === "ACTIVE" &&
    afterCorrect.receipts.length === 3, JSON.stringify({
      status: afterCorrect.exposure.ClearingStatus,
      active: afterCorrect.exposure.ActiveReceiptID,
      count: afterCorrect.receipts.length, replacement: replacement
    }));
  check("F7", originalBytesBefore !== null && originalBytesBefore === originalBytesAfter,
    "original receipt row rewritten");
  check("F8", reconAfterCorrect.unexplainedResidual === 0 &&
    reconAfterCorrect.reconciliationStatus === "OK", JSON.stringify(reconAfterCorrect));

  // --- F3 (U5): UNKNOWN at the intent boundary, SAME key recovery, one receipt
  var recoveryFixture = treasuryT4SeededFixture_();
  var crashError = null;
  try {
    treasuryReceiptSaveWithRuntime_(treasuryT7Payload_("t7f-unk-01"),
      treasuryT4Runtime_({ fixture: recoveryFixture, crash: "T4_AFTER_INTENT" }));
  } catch (error) { crashError = error; }
  var intentRow = treasuryT6OpByTypeKey_(recoveryFixture, "TREASURY_RECEIPT_SAVE", "t7f-unk-01");
  check("F9", !!crashError && crashError.message === "CRASH:T4_AFTER_INTENT" &&
    !!intentRow && intentRow.State === "IN_PROGRESS" && intentRow.RequestKey === "t7f-unk-01",
    JSON.stringify({ error: crashError && crashError.message,
      intent: intentRow && intentRow.State }));
  var resumed = null, afterResume = null;
  treasuryT7WithServerStubs_(recoveryFixture, undefined, function() {
    resumed = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7f-unk-01"));
    afterResume = getTreasuryOperatorReceiptDetail({ recognitionID: "SCR-U3-ORD-T4-1" });
  });
  var recoveryReceipts = treasuryT6Receipts_(recoveryFixture).filter(function(r) {
    return String(r.RecognitionID) === "SCR-U3-ORD-T4-1";
  });
  check("F10", resumed.status === "DONE" && resumed.requestKey === "t7f-unk-01" &&
    recoveryReceipts.length === 1 && afterResume.exposure.ClearingStatus === "CLEARED",
    JSON.stringify({ resumed: resumed, receipts: recoveryReceipts.length }));

  // --- F4 (U10): Correct UNKNOWN -> same-key resume -> exactly one lineage
  var corrUnknownFixture = treasuryT7SeededFixture_();
  var uSave = null, uCrashError = null, uResume = null;
  treasuryT7WithServerStubs_(corrUnknownFixture, undefined, function() {
    uSave = treasuryOperatorSaveReceipt(treasuryT7Payload_("t7f-u-save"));
  });
  try {
    treasuryT6WithJakartaDate_(function() {
      return treasuryLifecycleCorrectWithRuntime_(
        treasuryT6CorrectPayload_("t7f-u-corr", uSave.receiptID),
        treasuryT6Runtime_({ fixture: corrUnknownFixture, crash: "T6_AFTER_INTENT" }));
    });
  } catch (error) { uCrashError = error; }
  var corrIntent = treasuryT6OpByTypeKey_(corrUnknownFixture, "TREASURY_RECEIPT_CORRECT", "t7f-u-corr");
  check("F11", !!uCrashError && uCrashError.message === "CRASH:T6_AFTER_INTENT" &&
    !!corrIntent && corrIntent.State === "IN_PROGRESS" && corrIntent.RequestKey === "t7f-u-corr",
    JSON.stringify({ error: uCrashError && uCrashError.message,
      intent: corrIntent && corrIntent.State }));
  treasuryT7WithServerStubs_(corrUnknownFixture, undefined, function() {
    uResume = treasuryT6WithJakartaDate_(function() {
      return treasuryOperatorCorrectReceipt(treasuryT6CorrectPayload_("t7f-u-corr", uSave.receiptID));
    });
  });
  var uReceipts = treasuryT6Receipts_(corrUnknownFixture);
  var reversalTargets = uReceipts.filter(function(r) {
    return String(r.ReversalOfReceiptID) === String(uSave.receiptID);
  });
  var replacements = uReceipts.filter(function(r) {
    return String(r.OriginalReceiptID) === String(uSave.receiptID);
  });
  check("F12", uResume.status === "DONE" &&
    uReceipts.length === 3 && reversalTargets.length === 1 && replacements.length === 1,
    JSON.stringify({ resume: uResume, receipts: uReceipts.length,
      reversals: reversalTargets.length, replacements: replacements.length }));

  // --- F5 (U12): reconciliation residual 0 across the full chain workspace
  var chainWorkspace = null;
  treasuryT7WithServerStubs_(correctFixture, undefined, function() {
    chainWorkspace = getTreasuryOperatorWorkspace({});
  });
  check("F13", chainWorkspace.reconciliation.unexplainedResidual === 0 &&
    chainWorkspace.reconciliation.reconciliationStatus === "OK" &&
    chainWorkspace.receipts.rows[0].ClearingStatus === "CLEARED",
    JSON.stringify(chainWorkspace.reconciliation));

  return pass;
}

function testTreasuryT7SourceAudit() {
  var pass = 0;
  function check(id, value, detail) { treasuryT7Check_(id, value, detail); pass++; }
  var api = globalThis.__t7apiSource || "";
  var stateSrc = globalThis.__t7stateSource || "";
  var renderSrc = globalThis.__t7renderSource || "";
  var controllerSrc = globalThis.__t7controllerSource || "";
  var indexSrc = globalThis.__t7indexSource || "";
  var treasurySlice = "";
  var start = indexSrc.indexOf("<!-- TREASURY: RECEIPTS -->");
  var end = indexSrc.indexOf("<!-- PRODUCTS -->");
  if (start !== -1 && end > start) treasurySlice = indexSrc.slice(start, end);
  var uiSources = stateSrc + "\n" + renderSrc + "\n" + controllerSrc + "\n" + treasurySlice;

  // A1: 99D is a pure delegation module — no writers, no transport, no formula
  check("A1", !/setValues|appendRow|appendCells|batchUpdate|UrlFetchApp|SpreadsheetApp|PropertiesService|LockService/.test(api),
    "99D contains a write/transport primitive");
  check("A2", api.indexOf("treasuryReceiptDurableSave(payload)") !== -1 &&
    api.indexOf("treasuryReceiptDurableReverse(payload)") !== -1 &&
    api.indexOf("treasuryReceiptDurableCorrect(payload)") !== -1 &&
    api.indexOf("buildTreasuryClearingProjection_(ss") !== -1 &&
    api.indexOf("buildTreasury1030Reconciliation_(ss") !== -1 &&
    api.indexOf("buildTreasuryClearingExposure_(ss") !== -1 &&
    api.indexOf("treasuryDestinationEligible(code, accounts)") !== -1 &&
    api.indexOf("treasuryReceiptAccountRows_(ss)") !== -1 &&
    api.indexOf("treasuryReceiptResolvedGate()") !== -1,
    "99D delegation targets missing");
  check("A3", !/RecognizedAmount\s*[-+]|OutstandingAmount\s*[-+=]|ClearedAmount\s*[-+=]/.test(api),
    "99D computes an outstanding/cleared formula");
  check("A4", api.indexOf("TREASURY_OPERATOR_WORKSPACE_V1") !== -1 &&
    api.indexOf("TREASURY_OPERATOR_DETAIL_V1") !== -1, "99D contract labels missing");

  // A5: client transport reaches ONLY the five thin endpoints
  var endpointCalls = (controllerSrc.match(/run\.[A-Za-z0-9_]+\(/g) || [])
    .map(function(call) { return call.slice(4, -1); })
    .filter(function(name) { return name !== "withSuccessHandler" && name !== "withFailureHandler"; });
  var allowed = { "getTreasuryOperatorWorkspace": true, "getTreasuryOperatorReceiptDetail": true,
    "treasuryOperatorSaveReceipt": true, "treasuryOperatorReverseReceipt": true,
    "treasuryOperatorCorrectReceipt": true };
  check("A5", endpointCalls.length === 5 && endpointCalls.every(function(name) {
    return allowed[name] === true;
  }), endpointCalls.join(","));
  check("A5b", controllerSrc.indexOf("google.script.run") !== -1 &&
    !/cashSettleAndPersist|attemptCashSettlement|submitOperationalPayment|submitSettlementPayment|settleCash/.test(uiSources),
    "client reaches a legacy writer path");

  // A6: legacy vocabulary absent from the Treasury surface
  check("A6", !/ReceiveVia|Payment Method|PaymentMethod|Confirm Payment|\bPAID\b|Settlement|Unpaid|Un-Paid/i.test(uiSources),
    "legacy Payment/Settlement vocabulary present in Treasury surface");
  check("A6b", indexSrc.indexOf('data-page="treasury"') !== -1 &&
    treasurySlice.indexOf('id="treasury"') !== -1 &&
    indexSrc.indexOf("treasury: {") !== -1 &&
    indexSrc.indexOf('pageId === "treasury"') !== -1,
    "Treasury navigation contract missing from 190");
  check("A6c", indexSrc.indexOf("include('202.View.Treasury.State')") !== -1 &&
    indexSrc.indexOf("include('203.View.Treasury.Render')") !== -1 &&
    indexSrc.indexOf("include('204.View.Treasury.Controller')") !== -1,
    "Treasury view includes missing");

  // A7: no browser-side recomputation, no editable EconomicDate/ReversalDate
  // control, locked amount, no hardcoded destination codes, no 1030 option
  check("A7", !/RecognizedAmount\s*-|ClearedAmount\s*\+|OutstandingAmount\s*=/.test(renderSrc + controllerSrc),
    "client recomputes outstanding/cleared");
  check("A8", treasurySlice.indexOf('id="treasuryEconomicDate"') === -1 &&
    treasurySlice.indexOf('id="treasuryReversalDate"') === -1 &&
    !/getTreasuryElement\("treasury(EconomicDate|ReversalDate)"\)/.test(controllerSrc),
    "editable EconomicDate/ReversalDate control present");
  check("A9", treasurySlice.indexOf('<dd id="treasuryFormAmount"') !== -1 &&
    treasurySlice.indexOf('value="1030"') === -1 &&
    !/"1000"|"1010"|"1020"/.test(renderSrc),
    "amount not locked or destination codes hardcoded/1030 offered");
  check("A10", renderSrc.indexOf("workspace.destinations") !== -1 &&
    renderSrc.indexOf("renderTreasuryDestinationOptions_") !== -1,
    "destinations do not come from the server workspace");

  // A8: exact frozen T4/T6 payload shapes on the client
  check("A11", controllerSrc.indexOf("evidenceType: \"MANUAL_VERIFIED\"") !== -1 &&
    controllerSrc.indexOf("grossAmount: row.OutstandingAmount") !== -1 &&
    controllerSrc.indexOf("actor:") === -1,
    "client payload shape diverges (evidence/amount/actor)");
  check("A12", controllerSrc.indexOf("treasuryReceiptID") !== -1 &&
    controllerSrc.indexOf("reason: reason") !== -1 &&
    !/treasuryReversalDate/.test(treasurySlice + controllerSrc),
    "reversal payload carries a client date");

  // A9: RequestKey lifecycle — one generation site per intent, none on retry
  var newKeyCalls = (controllerSrc.match(/treasuryNewRequestKey_\(/g) || []).length;
  check("A13", newKeyCalls === 3, "treasuryNewRequestKey_ calls: " + newKeyCalls);
  var retryBody = controllerSrc.slice(controllerSrc.indexOf("function retryTreasuryMutation"));
  retryBody = retryBody.slice(0, retryBody.indexOf("function submitTreasurySaveReceipt"));
  check("A14", retryBody.indexOf("treasuryNewRequestKey_") === -1 &&
    retryBody.indexOf("treasurySendMutation_") !== -1,
    "retry regenerates a RequestKey or fails to replay");

  // A10: Review copy + forbidden confirmation vocabulary
  check("A15", treasurySlice.indexOf("Save records a verified receipt clearing 1030") !== -1 &&
    treasurySlice.indexOf("not Revenue creation") !== -1,
    "Review disclosure missing");
  check("A16", !/Confirm Payment|Receive Via|Received Via/i.test(treasurySlice),
    "forbidden confirmation copy in Treasury markup");

  // A11: reconciliation surface read-only (warning, never a fix action)
  check("A17", renderSrc.indexOf("treasuryReconciliationWarning") !== -1 &&
    renderSrc.indexOf("unexplainedResidual") !== -1 &&
    treasurySlice.indexOf('id="treasuryReconciliationWarning"') !== -1,
    "reconciliation warning missing");
  var reconStart = treasurySlice.indexOf('id="treasuryReconciliation"');
  var reconEnd = treasurySlice.indexOf('id="treasuryListView"');
  var reconSlice = reconStart !== -1 && reconEnd > reconStart ?
    treasurySlice.slice(reconStart, reconEnd) : "";
  check("A18", reconSlice !== "" && !/<button/i.test(reconSlice),
    "reconciliation surface contains a button");

  // A12: UI language checklist
  var required = ["Treasury", "Receipts", "Outstanding", "Destination", "Receipt Date",
    "Evidence Reference", "Save Receipt", "Reverse Receipt", "Correct Receipt",
    "Cleared", "Uncleared", "Exception"];
  check("A19", required.every(function(label) { return uiSources.indexOf(label) !== -1; }),
    required.filter(function(label) { return uiSources.indexOf(label) === -1; }).join(","));

  // A13: liveness constants + guards present in controller
  check("A20", controllerSrc.indexOf("TREASURY_READ_STALE_TIMEOUT_MS") !== -1 &&
    controllerSrc.indexOf("TREASURY_MUTATION_STALE_TIMEOUT_MS") !== -1 &&
    controllerSrc.indexOf("dispatchId") !== -1 &&
    controllerSrc.indexOf("retryTreasuryMutation") !== -1,
    "liveness machinery missing");

  // A14: no Finance/RBAC authority in the Treasury client
  check("A21", !/getFinanceData|buildFinanceProfitAndLoss|revenue\s*[:=]|isAdmin|requireRole|userRole|\bRBAC\b/i.test(uiSources),
    "Finance/RBAC authority leaked into Treasury client");

  return pass;
}
