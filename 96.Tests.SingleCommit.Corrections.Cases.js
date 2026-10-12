// T11.8/U6 — Corrections / Void / Cancel (LOCAL/INERT ONLY). Task matrix
// 1-109 over the durable correction cores: Sales Void (SV1-13), Sales Correct
// (SC14-26), Expense Cancel (EC27-36), Expense Correct (EK37-46), Purchase
// Cancel (PC47-56), Purchase Correct (PK57-65), Durability (DY66-79),
// Preflight (PF80-87), Reporting (RP88-94), Historical (HS95-100), Regression
// (GR101-109). In-memory fixtures only: no production access, no clasp, no
// config writes, no PropertiesService, no writes outside fixture memory.

// ---------------------------------------------------------------------------
// Shared fixtures / helpers
// ---------------------------------------------------------------------------
function u6fCheck_(suite, counter, id, value, detail) {
  counter.pass++;
  if (!value) {
    throw new Error("T11_8_U6_" + suite + ":" + id +
      (detail === undefined ? "" : "|" + detail));
  }
}

function u6fNet_(rows, code) {
  return (rows || []).reduce(function(sum, row) {
    if (String(row.AccountCode) !== code || !isCanonicalActive(row.IsActive)) return sum;
    return sum + Number(row.Debit || 0) - Number(row.Credit || 0);
  }, 0);
}

// A REAL composed Sale (U1 save core, ACTIVE single-commit config, exact §11
// 1040 row, SRV2M money leg) with the save repository retained for the
// correction runtime.
function u6fComposedSale_(key) {
  var fixture = salesV2SaveFixture_(u4cBaseSheets_());
  var runtime = t11Runtime_({ fixture: fixture, singleCommitConfig: t11ConfigRaw_("ACTIVE") });
  var result = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_(key), runtime);
  if (result.status !== "DONE") {
    throw new Error("U6F_COMPOSED_SAVE_FAILED:" + key + ":" + result.status + ":" + result.code);
  }
  u3MirrorOperations_(fixture, runtime.repository);
  var plan = JSON.parse(runtime.repository.rows()[0].OperationPlan);
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  return { fixture: fixture, runtime: runtime, repository: runtime.repository, plan: plan,
    result: result, event: events[events.length - 1], orderID: plan.orderID,
    recognitionID: plan.recognitionID, amount: Number(plan.orderTotal),
    moneyJournalID: plan.moneyJournalID };
}

function u6fSalesRuntime_(composed, options) {
  options = options || {};
  var runtimeOptions = {
    fixture: composed.fixture,
    repository: options.repository || composed.repository
  };
  // Only forward defined keys: salesV2SaveRuntime_ treats an OWN undefined
  // key as an explicit null config (PREPARED refusal).
  ["singleCommitConfig", "crash", "config", "now"].forEach(function(key) {
    if (options[key] !== undefined) runtimeOptions[key] = options[key];
  });
  return t11Runtime_(runtimeOptions);
}

function u6fSalesLedger_(fixture) {
  return readCanonicalTable(fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
}

function u6fSalesOps_(repository, operationType) {
  return repository.rows().filter(function(row) {
    return row.OperationType === operationType;
  });
}

function u6fWidePeriod_() {
  return { filter: "custom", startDate: "2026-01-01", endDate: "2026-12-31",
    label: "2026" };
}

// Void reversal JournalID lookup helper (plan-anchored, no global state).
function planVoidJournal_(runtime, requestKey) {
  var op = runtime.repository.findOperation("SALES_V2_VOID", requestKey);
  return JSON.parse(op.OperationPlan).reversalJournalID;
}

// Expense correction runtime over the U2 fixture: the correction batch seam
// understands the ONE-batch [updateCells lifecycle marker + appendCells]
// shape and records every batch on the fixture.
function u6fExpenseRuntime_(f, options) {
  options = options || {};
  var batch = function(ranges) {
    if (f.batchFailure) throw new Error(f.batchFailure);
    f.batches.push(ranges.map(function(range) {
      return { range: range.range, rows: range.values.length,
        update: range.updateRow !== undefined };
    }));
    ranges.forEach(function(range) {
      var sheet = f.sheets[range.range];
      if (!sheet) throw new Error("SHEET_MISSING:" + range.range);
      var values = range.values.map(function(row) { return row.map(t11u2TransportValue_); });
      if (range.updateRow !== undefined) {
        values.forEach(function(row, index) {
          sheet.getRange(range.updateRow + index, 1, 1, row.length).setValues([row]);
        });
      } else {
        values.forEach(function(row) { sheet.rows.push(row); });
      }
    });
  };
  return {
    spreadsheet: f.spreadsheet,
    now: options.now || f.runtime.now,
    uuid: f.runtime.uuid,
    flush: f.runtime.flush,
    invalidate: function() { f.invalidations++; },
    singleCommitConfig: options.singleCommitConfig !== undefined ?
      options.singleCommitConfig : f.runtime.singleCommitConfig,
    expenseSingleCommit: {
      batch: batch,
      crash: function(label) {
        if (f.crashAt === label) { f.crashAt = null; throw new Error("CRASH_" + label); }
      }
    }
  };
}

function u6fPurchaseRuntime_(f, options) {
  options = options || {};
  var batch = function(ranges) {
    if (f.batchFailure) throw new Error(f.batchFailure);
    f.batches.push(ranges.map(function(range) {
      return { range: range.range, rows: range.values.length,
        update: range.updateRow !== undefined };
    }));
    ranges.forEach(function(range) {
      var sheet = f.sheets[range.range];
      if (!sheet) throw new Error("SHEET_MISSING:" + range.range);
      var values = range.values.map(function(row) { return row.map(t11u3TransportValue_); });
      if (range.updateRow !== undefined) {
        values.forEach(function(row, index) {
          sheet.getRange(range.updateRow + index, 1, 1, row.length).setValues([row]);
        });
      } else {
        values.forEach(function(row) { sheet.rows.push(row); });
      }
    });
  };
  return {
    spreadsheet: f.spreadsheet,
    now: options.now || f.runtime.now,
    uuid: f.runtime.uuid,
    flush: f.runtime.flush,
    invalidate: function() { f.invalidations++; },
    singleCommitConfig: options.singleCommitConfig !== undefined ?
      options.singleCommitConfig : f.runtime.singleCommitConfig,
    purchaseSingleCommit: {
      batch: batch,
      crash: function(label) {
        if (f.crashAt === label) { f.crashAt = null; throw new Error("CRASH_" + label); }
      }
    }
  };
}

function u6fSheetRows_(f) {
  var out = {};
  Object.keys(f.sheets).forEach(function(name) {
    out[name] = JSON.stringify(f.sheets[name].rows);
  });
  return JSON.stringify(out);
}

function u6fExpenseSave_(f, key) {
  var result = f.run({ transactionType: "EXPENSE", expenseItemId: "OSS01",
    amount: 25000, expenseDate: "2026-10-05", requestKey: key });
  if (!result.success || !result.singleCommit || result.singleCommit.status !== "DONE") {
    throw new Error("U6F_EXPENSE_SAVE_FAILED:" + key + ":" + JSON.stringify(result));
  }
  return result;
}

function u6fExpenseCancel_(f, key, reason) {
  return expenseCorrectionDispatch_(EXPENSE_SINGLE_COMMIT_CORRECTION.VOID,
    { requestKey: key, transactionId: f.lastExpenseID, reason: reason || "u6f cancel reason" },
    f.spreadsheet(), u6fExpenseRuntime_(f), null);
}

function u6fPurchaseSave_(f, key) {
  var result = f.run(t11u3Payload_(key));
  if (!result.success || result.status !== "OPERATIONAL_POSTED") {
    throw new Error("U6F_PURCHASE_SAVE_FAILED:" + key + ":" + JSON.stringify(result));
  }
  return result;
}

// ---------------------------------------------------------------------------
// 1-13 SALES VOID (composed money lineage)
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsSalesVoid() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("SALES_VOID", counter, id, value, detail); }
  var mutation = SALES_RECOGNITION_V2_MUTATION, money = SINGLE_COMMIT_MONEY_POLICY;
  var composed = u6fComposedSale_("u6f-sv-save");
  var amount = composed.amount;
  var protectedBefore = u6SheetText_(composed.fixture, u6ProtectedSheets_());
  var eventBefore = JSON.stringify(
    composed.fixture.getSheetByName("SalesRecognitionEvents").values.slice(0, 2));
  var ledgerBeforeCount = u6fSalesLedger_(composed.fixture).length;
  var ledgerBeforeText = JSON.stringify(
    composed.fixture.getSheetByName("BalanceLedger").values.slice(0, ledgerBeforeCount));
  var rt = u6fSalesRuntime_(composed);
  var res = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6f-sv-1", composed.orderID, "u6f composed void"), rt);
  // Mirror the durable intent into the fixture sheet so every later read
  // path (projection eligibility, T5) observes exactly the committed state.
  u6MirrorOperations_(composed.fixture, composed.repository);
  // SV1: envelope + linkage + composed write count (event + 4 ledger + audit)
  check("SV1", res.status === "DONE" && res.code === "" && res.replay === false &&
    res.writeCount === 6 && res.requestKey === "u6f-sv-1" &&
    res.targetOrderID === composed.orderID && res.reversalRecognitionID !== "",
    JSON.stringify(res));
  // SV2: ONE batch over the frozen VOID surfaces
  check("SV2", rt.events.batches.length === 1 &&
    JSON.stringify(rt.events.batches[0].map(function(range) { return range.range; })) ===
      JSON.stringify(mutation.WRITE_SURFACES[mutation.VOID]),
    JSON.stringify(rt.events.batches[0] && rt.events.batches[0].map(function(r) { return r.range; })));
  var ledger = u6fSalesLedger_(composed.fixture);
  var newRows = ledger.slice(ledgerBeforeCount);
  var reversalJournal = transactionStableBootstrapId_(mutation.MONEY_REVERSAL_JOURNAL_PREFIX,
    [composed.orderID]);
  var moneyRows = newRows.filter(function(row) {
    return String(row.JournalID) === reversalJournal;
  });
  // SV3: money reversal identity SRV2MV-<OrderID>, Dr1030 / Cr1040, bound to
  // the reversal recognition (U4/T5 group), SALES_MONEY classification, action date.
  check("SV3", moneyRows.length === 2 &&
    moneyRows[0].AccountCode === "1030" && Number(moneyRows[0].Debit) === amount &&
    Number(moneyRows[0].Credit) === 0 &&
    moneyRows[1].AccountCode === "1040" && Number(moneyRows[1].Debit) === 0 &&
    Number(moneyRows[1].Credit) === amount &&
    moneyRows[0].SourceType === money.SALES_MONEY_SOURCE_TYPE &&
    moneyRows[1].SourceType === money.SALES_MONEY_SOURCE_TYPE &&
    moneyRows[0].SourceID === res.reversalRecognitionID &&
    moneyRows[0].MovementType === money.SALES_MONEY_MOVEMENT_TYPE &&
    moneyRows[0].Tanggal === "2026-10-15",
    JSON.stringify(moneyRows));
  // SV4: recognition reversal keeps the existing U6 semantics Dr4000/Cr1030.
  var recognitionRows = newRows.filter(function(row) {
    return String(row.JournalID) === planVoidJournal_(rt, "u6f-sv-1");
  });
  check("SV4", recognitionRows.length === 2 &&
    recognitionRows[0].AccountCode === "4000" &&
    Number(recognitionRows[0].Debit) === amount &&
    recognitionRows[1].AccountCode === "1030" && Number(recognitionRows[1].Credit) === amount,
    JSON.stringify(recognitionRows));
  // SV5: full lifecycle nets to zero for Revenue / 1030 / 1040.
  check("SV5", u6fNet_(ledger, "4000") === 0 && u6fNet_(ledger, "1030") === 0 &&
    u6fNet_(ledger, "1040") === 0,
    JSON.stringify({ r: u6fNet_(ledger, "4000"), c: u6fNet_(ledger, "1030"),
      m: u6fNet_(ledger, "1040") }));
  // SV6: original artifacts (events + original ledger prefix) byte-identical;
  // the original money rows are never edited.
  var originalEventRows = JSON.stringify(
    composed.fixture.getSheetByName("SalesRecognitionEvents").values.slice(0, 2));
  var originalLedgerText = JSON.stringify(
    composed.fixture.getSheetByName("BalanceLedger").values.slice(0, ledgerBeforeCount));
  check("SV6", eventBefore === originalEventRows && ledgerBeforeText === originalLedgerText,
    "original rows immutable");
  // SV7: durable COMMITTED operation with a verified composed plan.
  var voidOps = u6fSalesOps_(rt.repository, mutation.VOID);
  var voidPlan = JSON.parse(voidOps[0].OperationPlan);
  check("SV7", voidOps.length === 1 && voidOps[0].State === "COMMITTED" &&
    voidOps[0].BusinessID === composed.orderID && voidPlan.composedMoney === true &&
    voidPlan.reversalMoneyRows.length === 2 &&
    salesRecognitionV2MutationVerifyPlan_(voidPlan).ok === true,
    JSON.stringify({ state: voidOps[0] && voidOps[0].State }));
  // SV8: same key + same payload replay = zero-write DONE.
  var counts = JSON.stringify(u6RowCounts_(composed.fixture));
  var retry = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6f-sv-1", composed.orderID, "u6f composed void"),
    u6fSalesRuntime_(composed, { repository: rt.repository }));
  check("SV8", retry.status === "DONE" && retry.replay === true &&
    retry.writeCount === 0 && rt.events.batches.length === 1 &&
    JSON.stringify(u6RowCounts_(composed.fixture)) === counts,
    JSON.stringify(retry));
  // SV9: same key + different payload = CONFLICT, zero writes.
  var conflict = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6f-sv-1", composed.orderID, "changed reason"),
    u6fSalesRuntime_(composed, { repository: rt.repository }));
  check("SV9", conflict.status === "CONFLICT" &&
    conflict.code === "OPERATION_PAYLOAD_CONFLICT" && conflict.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(composed.fixture)) === counts,
    JSON.stringify(conflict));
  // SV10: new-key Void on the already-voided original = refused, zero writes.
  var second = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6f-sv-2", composed.orderID),
    u6fSalesRuntime_(composed, { repository: rt.repository }));
  check("SV10", second.status === "REFUSED" &&
    (second.code === "SALES_V2_TARGET_ALREADY_VOIDED" ||
      second.code === "SALES_V2_MUTATION_EXISTS") && second.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(composed.fixture)) === counts,
    JSON.stringify(second));
  // SV11: recognition-only lineage (no money rows) keeps the exact legacy
  // void shape — no money rows appear.
  var legacySale = u3SaveFixture_("u6f-sv-legacy");
  var legacyBefore = u6fSalesLedger_(legacySale.fixture).length;
  var legacyRt = u6NovRuntime_({ fixture: legacySale.fixture,
    repository: legacySale.runtime.repository });
  var legacyRes = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6f-sv-legacy-void", legacySale.orderID), legacyRt);
  var legacyLedger = u6fSalesLedger_(legacySale.fixture);
  check("SV11", legacyRes.status === "DONE" && legacyRes.writeCount === 4 &&
    legacyLedger.length === legacyBefore + 2 &&
    legacyLedger.slice(legacyBefore - 1).every(function(row) {
      return String(row.SourceType) !== money.SALES_MONEY_SOURCE_TYPE; }),
    JSON.stringify(legacyRes));
  // SV12: PAUSED single-commit config refuses the NEW composed intent with
  // zero writes (admission gate; eligibility of a fresh target passes and
  // the config preflight fails closed; recovery never re-evaluates it).
  var pausedSale = u6fComposedSale_("u6f-sv-paused-save");
  var pausedCounts = JSON.stringify(u6RowCounts_(pausedSale.fixture));
  var pausedRt = u6fSalesRuntime_(pausedSale,
    { singleCommitConfig: t11ConfigRaw_("PAUSED") });
  var paused = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6f-sv-paused", pausedSale.orderID), pausedRt);
  check("SV12", paused.status === "REFUSED" &&
    paused.code === "SINGLE_COMMIT_MODE_PAUSED" && paused.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(pausedSale.fixture)) === pausedCounts,
    JSON.stringify(paused));
  // SV13: no forbidden account/surface ever written by the composed void.
  check("SV13", newRows.every(function(row) {
      return ["4000", "1030", "1040"].indexOf(String(row.AccountCode)) !== -1; }) &&
    !newRows.some(function(row) {
      return ["2010", "2000", "1000", "1010", "1020", "1100", "5000", "6210"].indexOf(
        String(row.AccountCode)) !== -1; }) &&
    u6SheetText_(composed.fixture, u6ProtectedSheets_()) === protectedBefore,
    JSON.stringify(newRows));
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 14-26 SALES CORRECT (composed money lineage)
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsSalesCorrect() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("SALES_CORRECT", counter, id, value, detail); }
  var mutation = SALES_RECOGNITION_V2_MUTATION, money = SINGLE_COMMIT_MONEY_POLICY;
  var composed = u6fComposedSale_("u6f-sc-save");
  var amount = composed.amount;
  var replacementLines = [{ productID: "P1", productVariantID: "PV1", qty: 4 }];
  var replacementTotal = 80000;
  var protectedBefore = u6SheetText_(composed.fixture, u6ProtectedSheets_());
  var ledgerBeforeCount = u6fSalesLedger_(composed.fixture).length;
  var ledgerBeforeText = JSON.stringify(
    composed.fixture.getSheetByName("BalanceLedger").values.slice(0, ledgerBeforeCount));
  var eventBefore = JSON.stringify(
    composed.fixture.getSheetByName("SalesRecognitionEvents").values.slice(0, 2));
  var rt = u6fSalesRuntime_(composed);
  var res = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6f-sc-1", composed.orderID, replacementLines,
      "u6f composed correct"), rt);
  u6MirrorOperations_(composed.fixture, composed.repository);
  var correctOps = u6fSalesOps_(rt.repository, mutation.CORRECT);
  var plan = JSON.parse(correctOps[0].OperationPlan);
  // SC14: ONE intent/ONE batch; full composed shape — Orders 1 + OrderLines
  // + Events 2 + Ledger 8 (reversal recognition + reversal money +
  // replacement recognition + replacement money) + Audits 2.
  check("SC14", res.status === "DONE" &&
    res.writeCount === 13 + plan.replacement.lineRows.length &&
    res.orderID !== composed.orderID && res.replacementRecognitionID !== "" &&
    rt.events.batches.length === 1 &&
    JSON.stringify(rt.events.batches[0].map(function(range) { return range.range; })) ===
      JSON.stringify(mutation.WRITE_SURFACES[mutation.CORRECT]),
    JSON.stringify(res));
  // SC15: one immutable plan owns reversal + replacement money legs.
  check("SC15", plan.composedMoney === true &&
    plan.reversalMoneyRows.length === 2 && plan.replacementMoneyRows.length === 2 &&
    plan.replacementMoneyJournalID === transactionStableBootstrapId_(
      money.SALES_MONEY_JOURNAL_PREFIX, [plan.replacement.orderID]) &&
    salesRecognitionV2MutationVerifyPlan_(plan).ok === true,
    JSON.stringify({ money: plan.composedMoney }));
  var ledger = u6fSalesLedger_(composed.fixture);
  var newRows = ledger.slice(ledgerBeforeCount);
  // SC16: four journals appended: reversal recognition, reversal money,
  // replacement recognition, replacement money — exact directions.
  var revRecog = newRows.filter(function(row) {
    return String(row.JournalID) === plan.reversalJournalID; });
  var revMoney = newRows.filter(function(row) {
    return String(row.JournalID) === plan.reversalMoneyJournalID; });
  var repRecog = newRows.filter(function(row) {
    return String(row.JournalID) === plan.replacement.journalID; });
  var repMoney = newRows.filter(function(row) {
    return String(row.JournalID) === plan.replacementMoneyJournalID; });
  check("SC16", newRows.length === 8 && revRecog.length === 2 && revMoney.length === 2 &&
    repRecog.length === 2 && repMoney.length === 2 &&
    revRecog[0].AccountCode === "4000" && Number(revRecog[0].Debit) === amount &&
    revMoney[0].AccountCode === "1030" && Number(revMoney[0].Debit) === amount &&
    revMoney[1].AccountCode === "1040" && Number(revMoney[1].Credit) === amount &&
    repRecog[0].AccountCode === "1030" && Number(repRecog[0].Debit) === replacementTotal &&
    repRecog[1].AccountCode === "4000" && Number(repRecog[1].Credit) === replacementTotal &&
    repMoney[0].AccountCode === "1040" && Number(repMoney[0].Debit) === replacementTotal &&
    repMoney[1].AccountCode === "1030" && Number(repMoney[1].Credit) === replacementTotal,
    JSON.stringify(newRows));
  // SC17: final lifetime = Dr1040 Y / Cr4000 Y with 1030 net 0.
  check("SC17", u6fNet_(ledger, "4000") === -replacementTotal &&
    u6fNet_(ledger, "1040") === replacementTotal && u6fNet_(ledger, "1030") === 0,
    JSON.stringify({ r: u6fNet_(ledger, "4000"), m: u6fNet_(ledger, "1040"),
      c: u6fNet_(ledger, "1030") }));
  // SC18: replacement money identity + source binding (U1 lineage over the
  // NEW OrderID, SourceID = replacement recognition).
  check("SC18", plan.replacementMoneyJournalID.indexOf("SRV2M-") === 0 &&
    plan.replacementMoneyRows.every(function(row) {
      return row.SourceID === plan.replacement.recognitionID &&
        row.SourceType === money.SALES_MONEY_SOURCE_TYPE &&
        row.MovementType === money.SALES_MONEY_MOVEMENT_TYPE; }),
    plan.replacementMoneyJournalID);
  // SC19: original artifacts immutable (events + original ledger prefix).
  var eventAfter = JSON.stringify(
    composed.fixture.getSheetByName("SalesRecognitionEvents").values.slice(0, 2));
  var ledgerAfterText = JSON.stringify(
    composed.fixture.getSheetByName("BalanceLedger").values.slice(0, ledgerBeforeCount));
  check("SC19", eventBefore === eventAfter && ledgerBeforeText === ledgerAfterText,
    "original rows immutable");
  // SC20: single active branch — reversal lineage + replacement lineage.
  var events = readCanonicalTable(composed.fixture, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  var reversalEvent = events.filter(function(row) {
    return String(row.RecognitionID) === plan.reversalRecognitionID; })[0];
  var replacementEvent = events.filter(function(row) {
    return String(row.RecognitionID) === plan.replacement.recognitionID; })[0];
  check("SC20", Boolean(reversalEvent) && Boolean(replacementEvent) &&
    reversalEvent.ReversalOfRecognitionID === composed.recognitionID &&
    replacementEvent.OriginalID === composed.recognitionID &&
    Number(replacementEvent.Amount) === replacementTotal &&
    events.filter(function(row) { return String(row.EventType) === "RECOGNITION" &&
      String(row.OriginalID) === composed.recognitionID; }).length === 1,
    JSON.stringify(events.map(function(row) { return row.EventType; })));
  // SC21: replay zero-write.
  var counts = JSON.stringify(u6RowCounts_(composed.fixture));
  var retry = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6f-sc-1", composed.orderID, replacementLines,
      "u6f composed correct"),
    u6fSalesRuntime_(composed, { repository: rt.repository }));
  check("SC21", retry.status === "DONE" && retry.replay === true &&
    retry.writeCount === 0 && JSON.stringify(u6RowCounts_(composed.fixture)) === counts,
    JSON.stringify(retry));
  // SC22: same key + changed payload = CONFLICT, zero writes.
  var conflict = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6f-sc-1", composed.orderID, replacementLines,
      "changed reason now"),
    u6fSalesRuntime_(composed, { repository: rt.repository }));
  check("SC22", conflict.status === "CONFLICT" &&
    conflict.code === "OPERATION_PAYLOAD_CONFLICT" && conflict.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(composed.fixture)) === counts,
    JSON.stringify(conflict));
  // SC23: new-key Correct on the superseded ORIGINAL = ALREADY_CORRECTED,
  // zero writes (single active correction branch per original).
  var superseded = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6f-sc-2", composed.orderID, replacementLines),
    u6fSalesRuntime_(composed, { repository: rt.repository }));
  check("SC23", superseded.status === "REFUSED" &&
    superseded.code === "SALES_V2_TARGET_ALREADY_CORRECTED" &&
    superseded.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(composed.fixture)) === counts,
    JSON.stringify(superseded));
  // SC24: Correct after Void (terminal reversal) refuses zero-write.
  var voidedSale = u6fComposedSale_("u6f-sc-voided");
  var voidRt = u6fSalesRuntime_(voidedSale);
  salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6f-sc-void-1", voidedSale.orderID), voidRt);
  u6MirrorOperations_(voidedSale.fixture, voidedSale.repository);
  var voidCounts = JSON.stringify(u6RowCounts_(voidedSale.fixture));
  var afterVoid = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6f-sc-c-after-v", voidedSale.orderID, replacementLines),
    u6fSalesRuntime_(voidedSale, { repository: voidRt.repository }));
  check("SC24", afterVoid.status === "REFUSED" &&
    afterVoid.code === "SALES_V2_TARGET_ALREADY_VOIDED" && afterVoid.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(voidedSale.fixture)) === voidCounts,
    JSON.stringify(afterVoid));
  // SC25: invalid replacement input refuses zero-write before any intent.
  var invalidCounts = JSON.stringify(u6RowCounts_(composed.fixture));
  var invalid = salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6f-sc-bad", composed.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 0 }]),
    u6fSalesRuntime_(composed, { repository: rt.repository }));
  check("SC25", invalid.status === "REFUSED" && invalid.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(composed.fixture)) === invalidCounts,
    JSON.stringify(invalid));
  // SC26: Policy C / forbidden accounts never written; protected surfaces
  // byte-identical.
  check("SC26", !newRows.some(function(row) {
      return ["2010", "2000", "1000", "1010", "1020", "1100", "5000", "6210"].indexOf(
        String(row.AccountCode)) !== -1; }) &&
    !newRows.some(function(row) {
      return String(row.MovementType) === "SALE_HPP" ||
        String(row.MovementType) === "PAID_SALE"; }) &&
    u6SheetText_(composed.fixture, u6ProtectedSheets_()) === protectedBefore,
    JSON.stringify(newRows));
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 27-36 EXPENSE CANCEL
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsExpenseCancel() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("EXPENSE_CANCEL", counter, id, value, detail); }
  var save = EXPENSE_SINGLE_COMMIT_V1, c = EXPENSE_SINGLE_COMMIT_CORRECTION;
  var f = t11u2Fixture_();
  u6fExpenseSave_(f, "u6f-ec-save");
  var saveOp = t11u2Ops_(f)[0];
  var entryID = saveOp.BusinessID;
  f.lastExpenseID = entryID;
  var ledgerBeforeCount = t11u2Ledger_(f).length;
  var batchesBefore = f.batches.length;
  var res = u6fExpenseCancel_(f, "u6f-ec-1");
  // EC27: DONE + durable VOID operation bound to the target.
  check("EC27", res.status === "DONE" && res.targetID === entryID &&
    res.replay === false && res.writeCount === 4, JSON.stringify(res));
  var ops = t11u2Ops_(f).filter(function(row) {
    return row.OperationType === c.VOID; });
  // EC28: ONE atomic batch [tabops lifecycle update, ledger 2, Logs 1].
  check("EC28", ops.length === 1 && ops[0].State === "COMMITTED" &&
    ops[0].BusinessID === entryID &&
    f.batches.length === batchesBefore + 1 &&
    JSON.stringify(f.batches[f.batches.length - 1].map(function(range) { return range.range; })) ===
      JSON.stringify(["tabops", "BalanceLedger", "Logs"]) &&
    f.batches[f.batches.length - 1][0].update === true &&
    f.batches[f.batches.length - 1][1].update === false,
    JSON.stringify(f.batches[f.batches.length - 1]));
  var ledger = t11u2Ledger_(f);
  var reversal = ledger.filter(function(row) {
    return String(row.JournalID) === c.JOURNAL_ID_PREFIX + entryID; });
  // EC29: mirror journal EXPJV-<ID_Trx>, Dr1040 / Cr6100, exact lineage,
  // action date, signature valid, ExternalRef = original journal.
  check("EC29", reversal.length === 2 && ledger.length === ledgerBeforeCount + 2 &&
    reversal[0].AccountCode === "1040" && Number(reversal[0].Debit) === 25000 &&
    Number(reversal[0].Credit) === 0 &&
    reversal[1].AccountCode === "6100" && Number(reversal[1].Debit) === 0 &&
    Number(reversal[1].Credit) === 25000 &&
    reversal[0].MovementType === c.MOVEMENT_TYPE &&
    reversal[0].SourceType === c.SOURCE_TYPE && reversal[0].SourceID === entryID &&
    reversal[0].ExternalRef === save.JOURNAL_ID_PREFIX + entryID &&
    reversal[0].Tanggal === "2026-10-05" &&
    policyCJournalSignature_(reversal) !== "",
    JSON.stringify(reversal));
  // EC30: original tabops content immutable; only the canonical lifecycle
  // marker flipped; no replacement row appended.
  var tabopsRows = t11u2Tabops_(f);
  var originalRow = tabopsRows.filter(function(row) { return row.ID_Trx === entryID; })[0];
  var legacyRow = tabopsRows.filter(function(row) {
    return String(row.ID_Trx) === "OPS-APP-20260101-HISTORICAL01"; })[0];
  check("EC30", Boolean(originalRow) && originalRow.IsActive === false &&
    originalRow.ID_Ops === "OSS01" && Number(originalRow.Nilai) === 25000 &&
    String(originalRow.Source) === "APP_ENTRY" &&
    tabopsRows.length === 2 && legacyRow.IsActive === true,
    JSON.stringify(originalRow));
  // EC31: append-only cancel marker (Logs event authority) with lineage.
  var cancelLogs = t11u2Logs_(f).filter(function(row) {
    return String(row.Action) === c.AUDIT_ACTIONS.VOID; });
  var cancelMeta = cancelLogs.length ? JSON.parse(cancelLogs[0].Metadata) : {};
  check("EC31", cancelLogs.length === 1 &&
    cancelLogs[0].Module === c.AUDIT_MODULE &&
    cancelLogs[0].RecordID === entryID &&
    cancelMeta.requestKey === "u6f-ec-1" && cancelMeta.singleCommit === true &&
    cancelMeta.operationID === ops[0].OperationID &&
    cancelMeta.reversalJournalID === c.JOURNAL_ID_PREFIX + entryID,
    JSON.stringify(cancelLogs));
  // EC32: lifetime nets return to the exact pre-save baseline (expense
  // account + 1040) after cancel — no residue, no double count.
  var baselineLedger = t11u2Ledger_(t11u2Fixture_());
  check("EC32", u6fNet_(ledger, "6100") === u6fNet_(baselineLedger, "6100") &&
    u6fNet_(ledger, "1040") === u6fNet_(baselineLedger, "1040"),
    JSON.stringify({ e: u6fNet_(ledger, "6100"), m: u6fNet_(ledger, "1040"),
      baseE: u6fNet_(baselineLedger, "6100"), baseM: u6fNet_(baselineLedger, "1040") }));
  // EC33: same-key replay zero-write.
  var sheetCounts = u6fSheetRows_(f);
  var retry = u6fExpenseCancel_(f, "u6f-ec-1");
  check("EC33", retry.status === "DONE" && retry.replay === true &&
    retry.writeCount === 0 && u6fSheetRows_(f) === sheetCounts &&
    f.batches.length === batchesBefore + 1, JSON.stringify(retry));
  // EC34: same key + different payload = CONFLICT, zero writes.
  var conflict = expenseCorrectionDispatch_(c.VOID,
    { requestKey: "u6f-ec-1", transactionId: entryID, reason: "changed reason text" },
    f.spreadsheet(), u6fExpenseRuntime_(f), null);
  check("EC34", conflict.status === "CONFLICT" &&
    conflict.code === "OPERATION_PAYLOAD_CONFLICT" && conflict.writeCount === 0 &&
    u6fSheetRows_(f) === sheetCounts, JSON.stringify(conflict));
  // EC35: new-key Cancel on an already-cancelled target = refused, zero writes.
  var second = expenseCorrectionDispatch_(c.VOID,
    { requestKey: "u6f-ec-2", transactionId: entryID, reason: "second cancel try" },
    f.spreadsheet(), u6fExpenseRuntime_(f), null);
  check("EC35", second.status === "REFUSED" &&
    second.code === c.CODES.TARGET_ALREADY_VOIDED && second.writeCount === 0 &&
    u6fSheetRows_(f) === sheetCounts, JSON.stringify(second));
  // EC36: the legacy in-place writer refuses the single-commit cohort
  // (cohort routing; zero writes, original rows untouched).
  var originalSheet = SpreadsheetApp.getActiveSpreadsheet;
  var originalFlush = SpreadsheetApp.flush;
  SpreadsheetApp.getActiveSpreadsheet = function() { return f.spreadsheet(); };
  SpreadsheetApp.flush = function() {};
  var legacyResult;
  try {
    legacyResult = voidCanonicalTransaction({ transactionId: entryID,
      reason: "legacy void attempt" });
  } finally {
    SpreadsheetApp.getActiveSpreadsheet = originalSheet;
    SpreadsheetApp.flush = originalFlush;
  }
  check("EC36", legacyResult && legacyResult.success === false &&
    legacyResult.error && legacyResult.error.code === "SINGLE_COMMIT_COHORT_ROUTED" &&
    u6fSheetRows_(f) === sheetCounts, JSON.stringify(legacyResult));
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 37-46 EXPENSE CORRECT
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsExpenseCorrect() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("EXPENSE_CORRECT", counter, id, value, detail); }
  var save = EXPENSE_SINGLE_COMMIT_V1, c = EXPENSE_SINGLE_COMMIT_CORRECTION;
  var f = t11u2Fixture_();
  u6fExpenseSave_(f, "u6f-ek-save");
  var entryID = t11u2Ops_(f)[0].BusinessID;
  var ledgerBeforeCount = t11u2Ledger_(f).length;
  var batchesBefore = f.batches.length;
  var originalLedgerPrefix = JSON.stringify(f.sheets.BalanceLedger.rows.slice(1));
  var originalLedgerRowCount = f.sheets.BalanceLedger.rows.length;
  var payload = { requestKey: "u6fpcorr01", transactionId: entryID,
    reason: "u6f expense correct", expenseItemId: "OSS01", amount: 30000 };
  var res = expenseCorrectionDispatch_(c.CORRECT, payload, f.spreadsheet(),
    u6fExpenseRuntime_(f), null);
  var expectedReplacementID = transactionStableBusinessID_("OPS-APP-", c.CORRECT,
    "u6fpcorr01");
  // EK37: DONE + deterministic replacement identity + durable operation.
  check("EK37", res.status === "DONE" && res.targetID === entryID &&
    res.replacementID === expectedReplacementID &&
    res.replacementID.indexOf("OPS-APP-") === 0, JSON.stringify(res));
  var ops = t11u2Ops_(f).filter(function(row) {
    return row.OperationType === c.CORRECT; });
  // EK38: ONE atomic batch [lifecycle update, replacement append, ledger 4,
  // logs 2] — never reverse-then-save.
  check("EK38", ops.length === 1 && ops[0].State === "COMMITTED" &&
    ops[0].BusinessID === expectedReplacementID &&
    f.batches.length === batchesBefore + 1 &&
    JSON.stringify(f.batches[f.batches.length - 1].map(function(range) {
      return range.range + (range.update ? "*" : ""); })) ===
      JSON.stringify(["tabops*", "tabops", "BalanceLedger", "Logs"]),
    JSON.stringify(f.batches[f.batches.length - 1]));
  var ledger = t11u2Ledger_(f);
  var newRows = ledger.slice(ledgerBeforeCount);
  var reversal = newRows.filter(function(row) {
    return String(row.JournalID) === c.JOURNAL_ID_PREFIX + entryID; });
  var replacement = newRows.filter(function(row) {
    return String(row.JournalID) === save.JOURNAL_ID_PREFIX + expectedReplacementID; });
  // EK39: full reversal + complete replacement journals, exact directions.
  check("EK39", newRows.length === 4 && reversal.length === 2 && replacement.length === 2 &&
    reversal[0].AccountCode === "1040" && Number(reversal[0].Debit) === 25000 &&
    reversal[1].AccountCode === "6100" && Number(reversal[1].Credit) === 25000 &&
    replacement[0].AccountCode === "6100" && Number(replacement[0].Debit) === 30000 &&
    replacement[1].AccountCode === "1040" && Number(replacement[1].Credit) === 30000 &&
    replacement[0].SourceID === expectedReplacementID &&
    replacement[0].MovementType === save.MOVEMENT_TYPE,
    JSON.stringify(newRows));
  // EK40: original immutable except lifecycle; replacement row active with
  // lineage in the append-only Logs authority.
  var tabopsRows = t11u2Tabops_(f);
  var originalRow = tabopsRows.filter(function(row) { return row.ID_Trx === entryID; })[0];
  var replacementRow = tabopsRows.filter(function(row) {
    return row.ID_Trx === expectedReplacementID; })[0];
  var logs = t11u2Logs_(f);
  var voidLog = logs.filter(function(row) {
    return String(row.Action) === c.AUDIT_ACTIONS.CORRECT_VOID; })[0];
  var createLog = logs.filter(function(row) {
    return String(row.Action) === c.AUDIT_ACTIONS.CORRECT_CREATE; })[0];
  var voidMeta = voidLog ? JSON.parse(voidLog.Metadata) : {};
  var createMeta = createLog ? JSON.parse(createLog.Metadata) : {};
  check("EK40", Boolean(originalRow) && originalRow.IsActive === false &&
    Number(originalRow.Nilai) === 25000 && originalRow.ID_Ops === "OSS01" &&
    Boolean(replacementRow) && replacementRow.IsActive === true &&
    Number(replacementRow.Nilai) === 30000 &&
    replacementRow.ID_Ops === "OSS01" && tabopsRows.length === 3 &&
    Boolean(voidLog) && Boolean(createLog) &&
    voidMeta.replacementId === expectedReplacementID &&
    createMeta.originalId === entryID &&
    createLog.RecordID === expectedReplacementID, JSON.stringify(tabopsRows));
  // EK41: final lifetime = replacement only — baseline + replacement amount
  // on the expense account, baseline credit on 1040.
  var baselineLedger = t11u2Ledger_(t11u2Fixture_());
  check("EK41",
    u6fNet_(ledger, "6100") === u6fNet_(baselineLedger, "6100") + 30000 &&
    u6fNet_(ledger, "1040") === u6fNet_(baselineLedger, "1040") - 30000,
    JSON.stringify({ e: u6fNet_(ledger, "6100"), m: u6fNet_(ledger, "1040") }));
  // EK42: original journal rows byte-identical (append-only reversal).
  check("EK42", JSON.stringify(
      f.sheets.BalanceLedger.rows.slice(1, originalLedgerRowCount)) ===
    originalLedgerPrefix, "original ledger prefix untouched");
  // EK43: replay zero-write.
  var sheetCounts = u6fSheetRows_(f);
  var retry = expenseCorrectionDispatch_(c.CORRECT, payload, f.spreadsheet(),
    u6fExpenseRuntime_(f), null);
  check("EK43", retry.status === "DONE" && retry.replay === true &&
    retry.writeCount === 0 && u6fSheetRows_(f) === sheetCounts,
    JSON.stringify(retry));
  // EK44: new-key Correct on the superseded original = ALREADY_CORRECTED.
  var again = expenseCorrectionDispatch_(c.CORRECT,
    { requestKey: "u6fpcorr02", transactionId: entryID,
      reason: "second correct try", expenseItemId: "OSS01", amount: 40000 },
    f.spreadsheet(), u6fExpenseRuntime_(f), null);
  check("EK44", again.status === "REFUSED" &&
    again.code === c.CODES.TARGET_ALREADY_CORRECTED && again.writeCount === 0 &&
    u6fSheetRows_(f) === sheetCounts, JSON.stringify(again));
  // EK45: Cancel after Correct = ALREADY_CORRECTED, zero writes.
  var cancelAfter = expenseCorrectionDispatch_(c.VOID,
    { requestKey: "u6f-ec-after-c", transactionId: entryID,
      reason: "cancel after correct" },
    f.spreadsheet(), u6fExpenseRuntime_(f), null);
  check("EK45", cancelAfter.status === "REFUSED" &&
    cancelAfter.code === c.CODES.TARGET_ALREADY_CORRECTED &&
    cancelAfter.writeCount === 0 && u6fSheetRows_(f) === sheetCounts,
    JSON.stringify(cancelAfter));
  // EK46: legacy correct AND legacy preview both refuse the cohort.
  var originalSheet = SpreadsheetApp.getActiveSpreadsheet;
  var originalFlush = SpreadsheetApp.flush;
  SpreadsheetApp.getActiveSpreadsheet = function() { return f.spreadsheet(); };
  SpreadsheetApp.flush = function() {};
  var legacyCorrect, legacyPreview;
  try {
    legacyPreview = previewCanonicalTransactionCorrection({ transactionId: entryID,
      reason: "legacy preview attempt", expenseItemId: "OSS01", amount: 30000 });
    legacyCorrect = correctCanonicalTransaction({ transactionId: entryID,
      reason: "legacy correct attempt", expenseItemId: "OSS01", amount: 30000 });
  } finally {
    SpreadsheetApp.getActiveSpreadsheet = originalSheet;
    SpreadsheetApp.flush = originalFlush;
  }
  check("EK46", legacyPreview && legacyPreview.success === false &&
    legacyPreview.error.code === "SINGLE_COMMIT_COHORT_ROUTED" &&
    legacyCorrect && legacyCorrect.success === false &&
    legacyCorrect.error.code === "SINGLE_COMMIT_COHORT_ROUTED" &&
    u6fSheetRows_(f) === sheetCounts,
    JSON.stringify({ preview: legacyPreview, correct: legacyCorrect }));
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 47-56 PURCHASE CANCEL
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsPurchaseCancel() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("PURCHASE_CANCEL", counter, id, value, detail); }
  var c = PURCHASE_EVENT_CORRECTION, save = PURCHASE_SINGLE_COMMIT_V1;
  var f = t11u3Fixture_();
  u6fPurchaseSave_(f, "u6f-pc-save");
  var eventID = "PE-u6f-pc-save";
  var t11RowIndex = -1;
  for (var r = 1; r < f.sheets.PurchaseEvents.rows.length; r++) {
    if (String(f.sheets.PurchaseEvents.rows[r][0]) === eventID) { t11RowIndex = r; break; }
  }
  if (t11RowIndex < 0) throw new Error("U6F_PC_EVENT_ROW_NOT_FOUND");
  var beforeRow = f.sheets.PurchaseEvents.rows[t11RowIndex].slice();
  var ledgerBeforeCount = t11u3Ledger_(f).length;
  var batchesBefore = f.batches.length;
  var res = purchaseCorrectionDispatch_(c.VOID,
    { requestKey: "u6f-pc-1", transactionId: eventID, reason: "u6f purchase cancel" },
    f.spreadsheet(), u6fPurchaseRuntime_(f), null);
  // PC47: DONE + durable PURCHASE_EVENT_VOID operation bound to the event.
  check("PC47", res.status === "DONE" && res.targetID === eventID &&
    res.writeCount === 4 && res.replay === false, JSON.stringify(res));
  var ops = t11u3Ops_(f).filter(function(row) {
    return row.OperationType === c.VOID; });
  // PC48: ONE atomic batch [event lifecycle update, ledger 2, Logs 1].
  check("PC48", ops.length === 1 && ops[0].State === "COMMITTED" &&
    f.batches.length === batchesBefore + 1 &&
    JSON.stringify(f.batches[f.batches.length - 1].map(function(range) {
      return range.range + (range.update ? "*" : ""); })) ===
      JSON.stringify(["PurchaseEvents*", "BalanceLedger", "Logs"]),
    JSON.stringify(f.batches[f.batches.length - 1]));
  var ledger = t11u3Ledger_(f);
  var reversal = ledger.filter(function(row) {
    return String(row.JournalID) === c.VOID_JOURNAL_ID_PREFIX + eventID; });
  // PC49: Policy C reversal pair — exact inverse Dr1040 / Cr6210, frozen
  // movement/source identity, ExternalRef linkage, action date, signature.
  check("PC49", ledger.length === ledgerBeforeCount + 2 && reversal.length === 2 &&
    reversal[0].AccountCode === "6210" && Number(reversal[0].Debit) === 0 &&
    Number(reversal[0].Credit) === 150000 &&
    reversal[1].AccountCode === "1040" && Number(reversal[1].Debit) === 150000 &&
    Number(reversal[1].Credit) === 0 &&
    reversal[0].MovementType === c.REVERSAL_MOVEMENT_TYPE &&
    reversal[0].SourceType === c.REVERSAL_SOURCE_TYPE &&
    reversal[0].SourceID === eventID &&
    reversal[0].ExternalRef === save.JOURNAL_ID_PREFIX + eventID &&
    reversal[0].Tanggal === "2026-10-05" &&
    policyCJournalSignature_(reversal) !== "",
    JSON.stringify(reversal));
  // PC50: original event — lifecycle marker only; PAID/1040/POSTED and all
  // financial truth unchanged.
  var events = t11u3Events_(f);
  var originalRow = events.filter(function(row) { return row.EventID === eventID; })[0];
  var currentRow = f.sheets.PurchaseEvents.rows[t11RowIndex];
  var sameFinancialTruth = ["PaymentStatus", "CashAccountCode", "AccountingStatus",
    "AcquisitionValue", "ExpenseID", "NormalizedPayload", "RequestKey", "ExpenseDate",
    "SupplierID"]
    .every(function(header) {
      var index = PURCHASE_EVENT_POLICY.headers.indexOf(header);
      return String(currentRow[index]) === String(beforeRow[index]);
    });
  check("PC50", Boolean(originalRow) &&
    originalRow.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED &&
    originalRow.IsActive === false && sameFinancialTruth &&
    originalRow.PaymentStatus === "PAID" && originalRow.CashAccountCode === "1040" &&
    originalRow.AccountingStatus === "POSTED",
    JSON.stringify(originalRow));
  // PC51: lifetime nets zero after cancel (6210 + 1040).
  check("PC51", u6fNet_(ledger, "6210") === 0 && u6fNet_(ledger, "1040") === 0,
    JSON.stringify({ p: u6fNet_(ledger, "6210"), m: u6fNet_(ledger, "1040") }));
  // PC52: append-only cancel marker (Logs event authority) with lineage.
  var cancelLogs = t11u3Logs_(f).filter(function(row) {
    return String(row.Action) === c.AUDIT_ACTIONS.VOID; });
  var meta = cancelLogs.length ? JSON.parse(cancelLogs[0].Metadata) : {};
  check("PC52", cancelLogs.length === 1 &&
    cancelLogs[0].Module === c.AUDIT_MODULE &&
    cancelLogs[0].RecordID === eventID &&
    meta.requestKey === "u6f-pc-1" && meta.singleCommit === true &&
    meta.operationID === ops[0].OperationID &&
    meta.reversalJournalID === c.VOID_JOURNAL_ID_PREFIX + eventID,
    JSON.stringify(cancelLogs));
  // PC53: replay zero-write.
  var sheetCounts = u6fSheetRows_(f);
  var retry = purchaseCorrectionDispatch_(c.VOID,
    { requestKey: "u6f-pc-1", transactionId: eventID, reason: "u6f purchase cancel" },
    f.spreadsheet(), u6fPurchaseRuntime_(f), null);
  check("PC53", retry.status === "DONE" && retry.replay === true &&
    retry.writeCount === 0 && u6fSheetRows_(f) === sheetCounts,
    JSON.stringify(retry));
  // PC54: same key + different payload = CONFLICT, zero writes.
  var conflict = purchaseCorrectionDispatch_(c.VOID,
    { requestKey: "u6f-pc-1", transactionId: eventID, reason: "changed reason text" },
    f.spreadsheet(), u6fPurchaseRuntime_(f), null);
  check("PC54", conflict.status === "CONFLICT" &&
    conflict.code === "OPERATION_PAYLOAD_CONFLICT" && conflict.writeCount === 0 &&
    u6fSheetRows_(f) === sheetCounts, JSON.stringify(conflict));
  // PC55: new-key Cancel on the already-cancelled event = refused, zero writes.
  var second = purchaseCorrectionDispatch_(c.VOID,
    { requestKey: "u6f-pc-2", transactionId: eventID, reason: "second cancel try" },
    f.spreadsheet(), u6fPurchaseRuntime_(f), null);
  check("PC55", second.status === "REFUSED" &&
    second.code === c.CODES.TARGET_ALREADY_VOIDED && second.writeCount === 0 &&
    u6fSheetRows_(f) === sheetCounts, JSON.stringify(second));
  // PC56: the legacy in-place void refuses the single-commit cohort.
  var originalSheet = SpreadsheetApp.getActiveSpreadsheet;
  var originalFlush = SpreadsheetApp.flush;
  SpreadsheetApp.getActiveSpreadsheet = function() { return f.spreadsheet(); };
  SpreadsheetApp.flush = function() {};
  var legacy;
  try {
    legacy = voidPurchaseEvent({ eventOrRequestKey: eventID,
      reason: "legacy void attempt" });
  } finally {
    SpreadsheetApp.getActiveSpreadsheet = originalSheet;
    SpreadsheetApp.flush = originalFlush;
  }
  check("PC56", legacy && legacy.status === "REFUSED" &&
    legacy.reason === "SINGLE_COMMIT_COHORT_ROUTED" && legacy.writeCount === 0 &&
    u6fSheetRows_(f) === sheetCounts, JSON.stringify(legacy));
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 57-65 PURCHASE CORRECT
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsPurchaseCorrect() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("PURCHASE_CORRECT", counter, id, value, detail); }
  var c = PURCHASE_EVENT_CORRECTION, save = PURCHASE_SINGLE_COMMIT_V1;
  var f = t11u3Fixture_();
  u6fPurchaseSave_(f, "u6f-pk-save");
  var eventID = "PE-u6f-pk-save";
  var ledgerBeforeCount = t11u3Ledger_(f).length;
  var batchesBefore = f.batches.length;
  var replacementKey = "u6fpcorr05";
  var replacementEventID = "PE-corr-" + replacementKey;
  var input = {
    ExpenseDate: "2026-10-06", ReceiptDate: "2026-10-06", PurchaseQty: "12",
    PurchaseUOM: "KG", AcquisitionValue: "175000", SupplierSource: "PT Maju Jaya",
    ExternalRef: "", ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE",
    Attested: true, ConversionEvidenceConfirmed: false
  };
  var res = purchaseCorrectionDispatch_(c.CORRECT,
    { requestKey: replacementKey, transactionId: eventID,
      reason: "u6f purchase correct", expenseItemId: "OSK01", input: input },
    f.spreadsheet(), u6fPurchaseRuntime_(f), null);
  // PK57: DONE + corr- replacement identity with final PAID/1040/POSTED.
  check("PK57", res.status === "DONE" && res.targetID === eventID &&
    res.replacementID === replacementEventID, JSON.stringify(res));
  var ops = t11u3Ops_(f).filter(function(row) {
    return row.OperationType === c.CORRECT; });
  // PK58: ONE atomic batch [event update, event append, ledger 4, logs 2].
  check("PK58", ops.length === 1 && ops[0].State === "COMMITTED" &&
    ops[0].BusinessID === replacementEventID &&
    f.batches.length === batchesBefore + 1 &&
    JSON.stringify(f.batches[f.batches.length - 1].map(function(range) {
      return range.range + (range.update ? "*" : ""); })) ===
      JSON.stringify(["PurchaseEvents*", "PurchaseEvents", "BalanceLedger", "Logs"]),
    JSON.stringify(f.batches[f.batches.length - 1]));
  var ledger = t11u3Ledger_(f);
  var newRows = ledger.slice(ledgerBeforeCount);
  var reversal = newRows.filter(function(row) {
    return String(row.JournalID) === c.CORRECT_JOURNAL_ID_PREFIX + eventID; });
  var replacement = newRows.filter(function(row) {
    return String(row.JournalID) === save.JOURNAL_ID_PREFIX + replacementEventID; });
  // PK59: linked reversal + composed replacement journal, exact directions,
  // deterministic corr- lineage, no AP/Inventory/HPP.
  check("PK59", newRows.length === 4 && reversal.length === 2 && replacement.length === 2 &&
    reversal[0].AccountCode === "6210" && Number(reversal[0].Credit) === 150000 &&
    reversal[1].AccountCode === "1040" && Number(reversal[1].Debit) === 150000 &&
    reversal[0].ExternalRef === save.JOURNAL_ID_PREFIX + eventID &&
    replacement[0].AccountCode === "6210" && Number(replacement[0].Debit) === 175000 &&
    replacement[1].AccountCode === "1040" && Number(replacement[1].Credit) === 175000 &&
    replacement[0].SourceID === replacementEventID &&
    replacement[0].MovementType === save.MOVEMENT_TYPE &&
    newRows.every(function(row) {
      return ["6210", "1040"].indexOf(String(row.AccountCode)) !== -1; }),
    JSON.stringify(newRows));
  // PK60: original event -> CORRECTED + inactive, financial truth unchanged.
  var events = t11u3Events_(f);
  var originalRow = events.filter(function(row) { return row.EventID === eventID; })[0];
  var paymentIndex = PURCHASE_EVENT_POLICY.headers.indexOf("PaymentStatus");
  var originalSheetRow = null;
  for (var pr = 1; pr < f.sheets.PurchaseEvents.rows.length; pr++) {
    if (String(f.sheets.PurchaseEvents.rows[pr][0]) === eventID) {
      originalSheetRow = f.sheets.PurchaseEvents.rows[pr];
      break;
    }
  }
  check("PK60", Boolean(originalRow) &&
    originalRow.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED &&
    originalRow.IsActive === false &&
    originalRow.PaymentStatus === "PAID" && originalRow.CashAccountCode === "1040" &&
    originalRow.AccountingStatus === "POSTED" &&
    Boolean(originalSheetRow) &&
    String(originalSheetRow[paymentIndex]) === "PAID",
    JSON.stringify(originalRow));
  // PK61: final lifetime = replacement only (6210 net Y, 1040 credit Y).
  check("PK61", u6fNet_(ledger, "6210") === 175000 && u6fNet_(ledger, "1040") === -175000,
    JSON.stringify({ p: u6fNet_(ledger, "6210"), m: u6fNet_(ledger, "1040") }));
  // PK62: replacement event row is a complete, history-valid T11 event.
  var replacementRow = events.filter(function(row) {
    return row.EventID === replacementEventID; })[0];
  var normalized = replacementRow ? JSON.parse(replacementRow.NormalizedPayload) : {};
  check("PK62", Boolean(replacementRow) &&
    replacementRow.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL &&
    replacementRow.IsActive === true && replacementRow.PaymentStatus === "PAID" &&
    replacementRow.CashAccountCode === "1040" &&
    replacementRow.AccountingStatus === "POSTED" &&
    replacementRow.RequestKey === "corr-" + replacementKey &&
    replacementRow.RecoveryKey === save.RECOVERY_KEY_PREFIX + "corr-" + replacementKey &&
    normalized.requestKey === "corr-" + replacementKey &&
    Number(normalized.input.AcquisitionValue) === 175000,
    JSON.stringify(replacementRow));
  // PK63: replay zero-write.
  var sheetCounts = u6fSheetRows_(f);
  var retry = purchaseCorrectionDispatch_(c.CORRECT,
    { requestKey: replacementKey, transactionId: eventID,
      reason: "u6f purchase correct", expenseItemId: "OSK01", input: input },
    f.spreadsheet(), u6fPurchaseRuntime_(f), null);
  check("PK63", retry.status === "DONE" && retry.replay === true &&
    retry.writeCount === 0 && u6fSheetRows_(f) === sheetCounts,
    JSON.stringify(retry));
  // PK64: one active branch — Correct after Correct = ALREADY_CORRECTED;
  // Correct after Cancel = ALREADY_VOIDED; both zero-write.
  var again = purchaseCorrectionDispatch_(c.CORRECT,
    { requestKey: "u6fpcorr06", transactionId: eventID,
      reason: "second correct try", expenseItemId: "OSK01", input: input },
    f.spreadsheet(), u6fPurchaseRuntime_(f), null);
  var cancelFixture = t11u3Fixture_();
  u6fPurchaseSave_(cancelFixture, "u6fpcorr07");
  purchaseCorrectionDispatch_(c.VOID,
    { requestKey: "u6f-pc-v", transactionId: "PE-u6fpcorr07",
      reason: "cancel first" },
    cancelFixture.spreadsheet(), u6fPurchaseRuntime_(cancelFixture), null);
  var cancelCounts = u6fSheetRows_(cancelFixture);
  var correctAfterCancel = purchaseCorrectionDispatch_(c.CORRECT,
    { requestKey: "u6fpcorr08", transactionId: "PE-u6fpcorr07",
      reason: "correct after cancel", expenseItemId: "OSK01", input: input },
    cancelFixture.spreadsheet(), u6fPurchaseRuntime_(cancelFixture), null);
  check("PK64", again.status === "REFUSED" &&
    again.code === c.CODES.TARGET_ALREADY_CORRECTED && again.writeCount === 0 &&
    u6fSheetRows_(f) === sheetCounts &&
    correctAfterCancel.status === "REFUSED" &&
    correctAfterCancel.code === c.CODES.TARGET_ALREADY_VOIDED &&
    correctAfterCancel.writeCount === 0 &&
    u6fSheetRows_(cancelFixture) === cancelCounts,
    JSON.stringify({ again: again, after: correctAfterCancel }));
  // PK65: no AP/2000, no Inventory, no 5000/1100, no Treasury; Suppliers and
  // Accounts never written.
  check("PK65", !newRows.some(function(row) {
      return ["2000", "1100", "5000", "1000", "1010", "1020"].indexOf(
        String(row.AccountCode)) !== -1; }) &&
    !newRows.some(function(row) {
      return String(row.MovementType) === "AP_SETTLEMENT" ||
        String(row.MovementType) === "SALE_HPP"; }) &&
    JSON.stringify(f.sheets.Suppliers.rows) ===
      JSON.stringify(t11u3Fixture_().sheets.Suppliers.rows),
    JSON.stringify(newRows));
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 66-79 DURABILITY: replay/conflict/already-*, UNKNOWN pre/post, missing
// artifacts, duplicate evidence, digest/signature/account tamper, recovery
// while PAUSED.
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsDurability() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("DURABILITY", counter, id, value, detail); }
  var ec = EXPENSE_SINGLE_COMMIT_CORRECTION, pc = PURCHASE_EVENT_CORRECTION;

  // DY66: UNKNOWN before the durable intent (crash pre-intent) keeps identity
  // and a later SAME-key attempt completes with ONE batch total.
  var f66 = t11u2Fixture_();
  u6fExpenseSave_(f66, "u6f-dy66-save");
  var id66 = t11u2Ops_(f66)[0].BusinessID;
  f66.crashAt = "EXPENSE_CORR_BEFORE_INTENT";
  var batches66 = f66.batches.length;
  var unknown66 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy66", transactionId: id66, reason: "crash pre intent" },
    f66.spreadsheet(), u6fExpenseRuntime_(f66), null);
  check("DY66", unknown66.status === "UNKNOWN" &&
    unknown66.code === ec.CODES.CORRECTION_EXECUTION_UNKNOWN &&
    unknown66.requestKey === "u6f-dy66" &&
    t11u2Ops_(f66).filter(function(row) { return row.OperationType === ec.VOID; }).length === 0 &&
    f66.batches.length === batches66, JSON.stringify(unknown66));
  var retried66 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy66", transactionId: id66, reason: "crash pre intent" },
    f66.spreadsheet(), u6fExpenseRuntime_(f66), null);
  check("DY66b", retried66.status === "DONE" && retried66.writeCount === 4 &&
    f66.batches.length === batches66 + 1, JSON.stringify(retried66));

  // DY67: UNKNOWN after the durable IN_PROGRESS intent resumes from the
  // STORED plan (no re-plan, one batch, exact artifacts).
  var f67 = t11u2Fixture_();
  u6fExpenseSave_(f67, "u6f-dy67-save");
  var id67 = t11u2Ops_(f67)[0].BusinessID;
  f67.crashAt = "EXPENSE_CORR_AFTER_INTENT_PERSIST";
  var unknown67 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy67", transactionId: id67, reason: "crash post intent" },
    f67.spreadsheet(), u6fExpenseRuntime_(f67), null);
  var op67 = t11u2Ops_(f67).filter(function(row) {
    return row.OperationType === ec.VOID; })[0];
  check("DY67", unknown67.status === "UNKNOWN" && Boolean(op67) &&
    op67.State === "IN_PROGRESS", JSON.stringify({ res: unknown67, state: op67 && op67.State }));
  var resume67 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy67", transactionId: id67, reason: "crash post intent" },
    f67.spreadsheet(), u6fExpenseRuntime_(f67), null);
  check("DY67b", resume67.status === "DONE" && resume67.writeCount === 4 &&
    t11u2Ops_(f67).filter(function(row) {
      return row.OperationType === ec.VOID; })[0].State === "COMMITTED",
    JSON.stringify(resume67));

  // DY68: UNKNOWN AFTER the batch (artifacts applied, commit lost) finalizes
  // from the verified artifacts — zero second batch.
  var f68 = t11u2Fixture_();
  u6fExpenseSave_(f68, "u6f-dy68-save");
  var id68 = t11u2Ops_(f68)[0].BusinessID;
  f68.crashAt = "EXPENSE_CORR_AFTER_BATCH";
  var unknown68 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy68", transactionId: id68, reason: "crash post batch" },
    f68.spreadsheet(), u6fExpenseRuntime_(f68), null);
  var batches68 = f68.batches.length;
  var resume68 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy68", transactionId: id68, reason: "crash post batch" },
    f68.spreadsheet(), u6fExpenseRuntime_(f68), null);
  check("DY68", unknown68.status === "UNKNOWN" && resume68.status === "DONE" &&
    resume68.replay === true && resume68.writeCount === 0 &&
    f68.batches.length === batches68, JSON.stringify(resume68));

  // DY69: Purchase UNKNOWN pre-batch then resume completes (crash BEFORE_BATCH).
  var f69 = t11u3Fixture_();
  u6fPurchaseSave_(f69, "u6fpcorr10");
  f69.crashAt = "PURCHASE_CORR_BEFORE_BATCH";
  var unknown69 = purchaseCorrectionDispatch_(pc.VOID,
    { requestKey: "u6f-dy69", transactionId: "PE-u6fpcorr10",
      reason: "purchase crash pre batch" },
    f69.spreadsheet(), u6fPurchaseRuntime_(f69), null);
  var resume69 = purchaseCorrectionDispatch_(pc.VOID,
    { requestKey: "u6f-dy69", transactionId: "PE-u6fpcorr10",
      reason: "purchase crash pre batch" },
    f69.spreadsheet(), u6fPurchaseRuntime_(f69), null);
  check("DY69", unknown69.status === "UNKNOWN" && resume69.status === "DONE" &&
    resume69.writeCount === 4, JSON.stringify(resume69));

  // DY70: Purchase correct crash post-intent -> resume from stored plan.
  var f70 = t11u3Fixture_();
  u6fPurchaseSave_(f70, "u6fpcorr11");
  f70.crashAt = "PURCHASE_CORR_AFTER_INTENT";
  var payload70 = { requestKey: "u6fpcorr12", transactionId: "PE-u6fpcorr11",
    reason: "purchase correct crash", expenseItemId: "OSK01", input: {
      ExpenseDate: "2026-10-06", ReceiptDate: "2026-10-06", PurchaseQty: "3",
      PurchaseUOM: "KG", AcquisitionValue: "111000", SupplierSource: "PT Maju Jaya",
      ExternalRef: "", ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE",
      Attested: true, ConversionEvidenceConfirmed: false } };
  var unknown70 = purchaseCorrectionDispatch_(pc.CORRECT, payload70,
    f70.spreadsheet(), u6fPurchaseRuntime_(f70), null);
  var resume70 = purchaseCorrectionDispatch_(pc.CORRECT, payload70,
    f70.spreadsheet(), u6fPurchaseRuntime_(f70), null);
  check("DY70", unknown70.status === "UNKNOWN" && resume70.status === "DONE" &&
    resume70.replacementID === "PE-corr-u6fpcorr12",
    JSON.stringify(resume70));

  // DY71: batch failure = UNKNOWN with identity retained and ZERO artifacts;
  // retrying the SAME intent after the failure clears completes once.
  var f71 = t11u2Fixture_();
  u6fExpenseSave_(f71, "u6f-dy71-save");
  var id71 = t11u2Ops_(f71)[0].BusinessID;
  f71.batchFailure = "SIMULATED_BATCH_FAILURE";
  var failed71 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy71", transactionId: id71, reason: "batch fails" },
    f71.spreadsheet(), u6fExpenseRuntime_(f71), null);
  var ops71 = t11u2Ops_(f71).filter(function(row) {
    return row.OperationType === ec.VOID; })[0];
  var ledger71 = t11u2Ledger_(f71).filter(function(row) {
    return String(row.JournalID) === ec.JOURNAL_ID_PREFIX + id71; });
  check("DY71", failed71.status === "UNKNOWN" &&
    failed71.code === ec.CODES.BATCH_OUTCOME_UNKNOWN &&
    Boolean(ops71) && ops71.State === "IN_PROGRESS" && ledger71.length === 0,
    JSON.stringify(failed71));
  f71.batchFailure = null;
  var recovered71 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy71", transactionId: id71, reason: "batch fails" },
    f71.spreadsheet(), u6fExpenseRuntime_(f71), null);
  check("DY71b", recovered71.status === "DONE" && recovered71.writeCount === 4,
    JSON.stringify(recovered71));

  // DY72: recovery while PAUSED — a persisted IN_PROGRESS intent completes
  // from its frozen plan even after the config flips to PAUSED.
  var f72 = t11u2Fixture_();
  u6fExpenseSave_(f72, "u6f-dy72-save");
  var id72 = t11u2Ops_(f72)[0].BusinessID;
  f72.crashAt = "EXPENSE_CORR_AFTER_INTENT";
  expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy72", transactionId: id72, reason: "paused recovery" },
    f72.spreadsheet(), u6fExpenseRuntime_(f72), null);
  var pausedResume = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy72", transactionId: id72, reason: "paused recovery" },
    f72.spreadsheet(), u6fExpenseRuntime_(f72,
      { singleCommitConfig: t11u2ConfigRaw_("PAUSED") }), null);
  check("DY72", pausedResume.status === "DONE" && pausedResume.writeCount === 4,
    JSON.stringify(pausedResume));

  // DY73: NEW intent under PAUSED = refused, zero writes, no operation row.
  var f73 = t11u2Fixture_();
  u6fExpenseSave_(f73, "u6f-dy73-save");
  var id73 = t11u2Ops_(f73)[0].BusinessID;
  var rows73 = u6fSheetRows_(f73);
  var pausedNew = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy73", transactionId: id73, reason: "paused new intent" },
    f73.spreadsheet(), u6fExpenseRuntime_(f73,
      { singleCommitConfig: t11u2ConfigRaw_("PAUSED") }), null);
  check("DY73", pausedNew.status === "REFUSED" &&
    pausedNew.code === "SINGLE_COMMIT_MODE_PAUSED" && pausedNew.writeCount === 0 &&
    t11u2Ops_(f73).filter(function(row) {
      return row.OperationType === ec.VOID; }).length === 0 &&
    u6fSheetRows_(f73) === rows73, JSON.stringify(pausedNew));

  // DY74: NEW intent under PREPARED = refused fail-closed (no legacy
  // fallback for a single-commit target), zero writes.
  var f74 = t11u2Fixture_();
  u6fExpenseSave_(f74, "u6f-dy74-save");
  var id74 = t11u2Ops_(f74)[0].BusinessID;
  var rows74 = u6fSheetRows_(f74);
  var preparedNew = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy74", transactionId: id74, reason: "prepared new intent" },
    f74.spreadsheet(), u6fExpenseRuntime_(f74,
      { singleCommitConfig: t11u2ConfigRaw_("PREPARED") }), null);
  check("DY74", preparedNew.status === "REFUSED" &&
    preparedNew.code === ec.CODES.CORRECTION_NOT_ACTIVE &&
    preparedNew.writeCount === 0 && u6fSheetRows_(f74) === rows74,
    JSON.stringify(preparedNew));

  // DY75: missing artifact after intent (reversal row deleted) = fail-closed
  // RECOVERY_REQUIRED with zero additional writes.
  var f75 = t11u2Fixture_();
  u6fExpenseSave_(f75, "u6f-dy75-save");
  var id75 = t11u2Ops_(f75)[0].BusinessID;
  f75.crashAt = "EXPENSE_CORR_AFTER_BATCH";
  expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy75", transactionId: id75, reason: "missing artifact" },
    f75.spreadsheet(), u6fExpenseRuntime_(f75), null);
  var ledgerSheet = f75.sheets.BalanceLedger;
  var journalIndex = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf("JournalID");
  for (var i = ledgerSheet.rows.length - 1; i >= 1; i--) {
    if (String(ledgerSheet.rows[i][journalIndex]) === ec.JOURNAL_ID_PREFIX + id75) {
      ledgerSheet.rows.splice(i, 1);
    }
  }
  var rows75 = u6fSheetRows_(f75);
  var missing75 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy75", transactionId: id75, reason: "missing artifact" },
    f75.spreadsheet(), u6fExpenseRuntime_(f75), null);
  check("DY75", missing75.status === "RECOVERY_REQUIRED" &&
    missing75.writeCount === 0 && u6fSheetRows_(f75) === rows75,
    JSON.stringify(missing75));

  // DY76: stored-plan digest tamper fails closed on resume (zero writes).
  var f76 = t11u2Fixture_();
  u6fExpenseSave_(f76, "u6f-dy76-save");
  var id76 = t11u2Ops_(f76)[0].BusinessID;
  expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy76", transactionId: id76, reason: "digest tamper" },
    f76.spreadsheet(), u6fExpenseRuntime_(f76), null);
  tamperStoredPlan_(f76, ec.VOID, "u6f-dy76", function(plan) {
    plan.amount = plan.amount + 1; });
  var rows76 = u6fSheetRows_(f76);
  var tampered76 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy76", transactionId: id76, reason: "digest tamper" },
    f76.spreadsheet(), u6fExpenseRuntime_(f76), null);
  check("DY76", tampered76.status === "RECOVERY_REQUIRED" &&
    tampered76.writeCount === 0 && u6fSheetRows_(f76) === rows76,
    JSON.stringify(tampered76));

  // DY77: account tamper inside the stored plan fails closed.
  var f77 = t11u2Fixture_();
  u6fExpenseSave_(f77, "u6f-dy77-save");
  var id77 = t11u2Ops_(f77)[0].BusinessID;
  expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy77", transactionId: id77, reason: "account tamper" },
    f77.spreadsheet(), u6fExpenseRuntime_(f77), null);
  tamperStoredPlan_(f77, ec.VOID, "u6f-dy77", function(plan) {
    plan.accounts.expense = "9999"; plan.reversalJournalRows[1].AccountCode = "9999"; });
  var rows77 = u6fSheetRows_(f77);
  var tampered77 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy77", transactionId: id77, reason: "account tamper" },
    f77.spreadsheet(), u6fExpenseRuntime_(f77), null);
  check("DY77", tampered77.status === "RECOVERY_REQUIRED" &&
    tampered77.writeCount === 0 && u6fSheetRows_(f77) === rows77,
    JSON.stringify(tampered77));

  // DY78: journal-signature tamper inside the stored plan fails closed.
  var f78 = t11u2Fixture_();
  u6fExpenseSave_(f78, "u6f-dy78-save");
  var id78 = t11u2Ops_(f78)[0].BusinessID;
  expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy78", transactionId: id78, reason: "signature tamper" },
    f78.spreadsheet(), u6fExpenseRuntime_(f78), null);
  tamperStoredPlan_(f78, ec.VOID, "u6f-dy78", function(plan) {
    plan.reversalJournalSignature = "FORGED-" + plan.reversalJournalSignature; });
  var rows78 = u6fSheetRows_(f78);
  var tampered78 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy78", transactionId: id78, reason: "signature tamper" },
    f78.spreadsheet(), u6fExpenseRuntime_(f78), null);
  check("DY78", tampered78.status === "RECOVERY_REQUIRED" &&
    tampered78.writeCount === 0 && u6fSheetRows_(f78) === rows78,
    JSON.stringify(tampered78));

  // DY79: duplicate operation evidence fails closed before any write.
  var f79 = t11u2Fixture_();
  u6fExpenseSave_(f79, "u6f-dy79-save");
  var id79 = t11u2Ops_(f79)[0].BusinessID;
  expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy79", transactionId: id79, reason: "duplicate evidence" },
    f79.spreadsheet(), u6fExpenseRuntime_(f79), null);
  var opSheet79 = f79.sheets.TransactionOperations;
  opSheet79.rows.push(opSheet79.rows[opSheet79.rows.length - 1].slice());
  var rows79 = u6fSheetRows_(f79);
  var duplicate79 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-dy79", transactionId: id79, reason: "duplicate evidence" },
    f79.spreadsheet(), u6fExpenseRuntime_(f79), null);
  check("DY79", duplicate79.status === "RECOVERY_REQUIRED" &&
    duplicate79.code === ec.CODES.DUPLICATE_OPERATION_EVIDENCE &&
    duplicate79.writeCount === 0 && u6fSheetRows_(f79) === rows79,
    JSON.stringify(duplicate79));
  return { status: "PASS", checks: counter.pass };
}

// Rewrite a stored OperationPlan in the fixture sheet (test-only tamper).
function tamperStoredPlan_(f, operationType, requestKey, mutate) {
  var sheet = f.sheets.TransactionOperations;
  var headers = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS;
  var typeIndex = headers.indexOf("OperationType");
  var keyIndex = headers.indexOf("RequestKey");
  var planIndex = headers.indexOf("OperationPlan");
  for (var i = 1; i < sheet.rows.length; i++) {
    if (String(sheet.rows[i][typeIndex]) === operationType &&
        String(sheet.rows[i][keyIndex]) === requestKey) {
      var plan = JSON.parse(sheet.rows[i][planIndex]);
      mutate(plan);
      sheet.rows[i][planIndex] = JSON.stringify(plan);
      return;
    }
  }
  throw new Error("U6F_TAMPER_TARGET_NOT_FOUND:" + operationType + ":" + requestKey);
}

// ---------------------------------------------------------------------------
// 80-87 PREFLIGHT per domain (no fallback, zero writes)
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsPreflight() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("PREFLIGHT", counter, id, value, detail); }
  var ec = EXPENSE_SINGLE_COMMIT_CORRECTION, pc = PURCHASE_EVENT_CORRECTION;
  var refused = [];

  // PF80: Expense Cancel without 1040 -> ACCOUNT_PREFLIGHT_FAILED, zero
  // writes (the save needs 1040; it is removed only after the save).
  var f80 = t11u2Fixture_();
  u6fExpenseSave_(f80, "u6f-pf80-save");
  removeAccountInFixture_(f80, "1040");
  var id80 = t11u2Ops_(f80)[0].BusinessID;
  var rows80 = u6fSheetRows_(f80);
  var res80 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-pf80", transactionId: id80, reason: "no 1040 here" },
    f80.spreadsheet(), u6fExpenseRuntime_(f80), null);
  refused.push(res80);
  check("PF80", res80.status === "REFUSED" &&
    res80.code === ec.CODES.ACCOUNT_PREFLIGHT_FAILED &&
    res80.writeCount === 0 && u6fSheetRows_(f80) === rows80, JSON.stringify(res80));

  // PF81: original expense account inactive -> refused, zero writes.
  var f81 = t11u2Fixture_();
  u6fExpenseSave_(f81, "u6f-pf81-save");
  var id81 = t11u2Ops_(f81)[0].BusinessID;
  deactivateAccountInFixture_(f81, "6100");
  var rows81 = u6fSheetRows_(f81);
  var res81 = expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-pf81", transactionId: id81, reason: "account inactive" },
    f81.spreadsheet(), u6fExpenseRuntime_(f81), null);
  refused.push(res81);
  check("PF81", res81.status === "REFUSED" &&
    res81.code === ec.CODES.ACCOUNT_PREFLIGHT_FAILED &&
    res81.detail === "ORIGINAL_EXPENSE_ACCOUNT_INACTIVE" && res81.writeCount === 0 &&
    u6fSheetRows_(f81) === rows81, JSON.stringify(res81));

  // PF82: replacement expense item/account unusable -> refused, zero writes.
  var f82 = t11u2Fixture_();
  u6fExpenseSave_(f82, "u6f-pf82-save");
  var id82 = t11u2Ops_(f82)[0].BusinessID;
  var rows82 = u6fSheetRows_(f82);
  var res82 = expenseCorrectionDispatch_(ec.CORRECT,
    { requestKey: "u6fpcorr13", transactionId: id82, reason: "replacement dead",
      expenseItemId: "GONE01", amount: 1000 },
    f82.spreadsheet(), u6fExpenseRuntime_(f82), null);
  refused.push(res82);
  check("PF82", res82.status === "REFUSED" && res82.writeCount === 0 &&
    u6fSheetRows_(f82) === rows82, JSON.stringify(res82));

  // PF83: Purchase Cancel without 6210 -> PURCHASE_ACCOUNT_ABSENT.
  var f83 = t11u3Fixture_();
  u6fPurchaseSave_(f83, "u6f-pf83-save");
  removeAccountInFixture_(f83, "6210");
  var rows83 = u6fSheetRows_(f83);
  var res83 = purchaseCorrectionDispatch_(pc.VOID,
    { requestKey: "u6f-pf83", transactionId: "PE-u6f-pf83-save",
      reason: "no 6210 here" },
    f83.spreadsheet(), u6fPurchaseRuntime_(f83), null);
  refused.push(res83);
  check("PF83", res83.status === "REFUSED" &&
    res83.code === pc.CODES.ACCOUNT_PREFLIGHT_FAILED &&
    res83.detail === "PURCHASE_ACCOUNT_ABSENT" && res83.writeCount === 0 &&
    u6fSheetRows_(f83) === rows83, JSON.stringify(res83));

  // PF84: Purchase Cancel without 1040 -> MONEY_ACCOUNT_PREFLIGHT_FAILED.
  var f84 = t11u3Fixture_();
  u6fPurchaseSave_(f84, "u6f-pf84-save");
  removeAccountInFixture_(f84, "1040");
  var rows84 = u6fSheetRows_(f84);
  var res84 = purchaseCorrectionDispatch_(pc.VOID,
    { requestKey: "u6f-pf84", transactionId: "PE-u6f-pf84-save",
      reason: "no 1040 here" },
    f84.spreadsheet(), u6fPurchaseRuntime_(f84), null);
  refused.push(res84);
  check("PF84", res84.status === "REFUSED" &&
    res84.code === pc.CODES.ACCOUNT_PREFLIGHT_FAILED &&
    String(res84.detail).indexOf("MONEY_ACCOUNT_PREFLIGHT_FAILED") === 0 &&
    res84.writeCount === 0 && u6fSheetRows_(f84) === rows84, JSON.stringify(res84));

  // PF85: Purchase Correct with inactive 6210 -> PURCHASE_ACCOUNT_INACTIVE.
  var f85 = t11u3Fixture_();
  u6fPurchaseSave_(f85, "u6f-pf85-save");
  deactivateAccountInFixture_(f85, "6210");
  var rows85 = u6fSheetRows_(f85);
  var res85 = purchaseCorrectionDispatch_(pc.CORRECT,
    { requestKey: "u6fpcorr14", transactionId: "PE-u6f-pf85-save",
      reason: "purchase account dead", expenseItemId: "OSK01", input: {
        ExpenseDate: "2026-10-06", ReceiptDate: "2026-10-06", PurchaseQty: "2",
        PurchaseUOM: "KG", AcquisitionValue: "50000", SupplierSource: "PT Maju Jaya",
        ExternalRef: "", ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE",
        Attested: true, ConversionEvidenceConfirmed: false } },
    f85.spreadsheet(), u6fPurchaseRuntime_(f85), null);
  refused.push(res85);
  check("PF85", res85.status === "REFUSED" &&
    res85.detail === "PURCHASE_ACCOUNT_INACTIVE" && res85.writeCount === 0 &&
    u6fSheetRows_(f85) === rows85, JSON.stringify(res85));

  // PF86: composed Sales Void without 1040 -> money preflight refusal.
  var composed86 = u6fComposedSale_("u6f-pf86-save");
  var accounts86 = composed86.fixture.getSheetByName("Accounts");
  var codeIndex86 = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("AccountCode");
  for (var i86 = accounts86.values.length - 1; i86 >= 0; i86--) {
    if (String(accounts86.values[i86][codeIndex86]) === "1040") {
      accounts86.values.splice(i86, 1);
      break;
    }
  }
  var counts86 = JSON.stringify(u6RowCounts_(composed86.fixture));
  var res86 = salesRecognitionV2VoidWithRuntime_(
    u6VoidPayload_("u6f-pf86", composed86.orderID, "missing 1040"),
    u6fSalesRuntime_(composed86));
  refused.push({ status: res86.status, code: res86.code, writeCount: res86.writeCount });
  check("PF86", res86.status === "REFUSED" && res86.writeCount === 0 &&
    JSON.stringify(u6RowCounts_(composed86.fixture)) === counts86,
    JSON.stringify(res86));

  // PF87: every preflight refusal above wrote zero rows and zero batches —
  // no fallback ever substitutes another account.
  check("PF87", refused.length === 7 && refused.every(function(res) {
      return res.status === "REFUSED" && Number(res.writeCount) === 0; }),
    JSON.stringify(refused));
  return { status: "PASS", checks: counter.pass };
}

// Deactivate an AccountCode row in a fixture Accounts sheet (test-only).
function deactivateAccountInFixture_(f, accountCode) {
  var sheet = f.sheets.Accounts;
  var headers = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  var codeIndex = headers.indexOf("AccountCode");
  var activeIndex = headers.indexOf("IsActive");
  for (var i = 1; i < sheet.rows.length; i++) {
    if (String(sheet.rows[i][codeIndex]) === accountCode) {
      sheet.rows[i][activeIndex] = false;
      return;
    }
  }
  throw new Error("U6F_ACCOUNT_NOT_FOUND:" + accountCode);
}

function removeAccountInFixture_(f, accountCode) {
  var sheet = f.sheets.Accounts;
  var codeIndex = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("AccountCode");
  for (var i = sheet.rows.length - 1; i >= 1; i--) {
    if (String(sheet.rows[i][codeIndex]) === accountCode) {
      sheet.rows.splice(i, 1);
      return;
    }
  }
  throw new Error("U6F_ACCOUNT_NOT_FOUND:" + accountCode);
}

// ---------------------------------------------------------------------------
// 88-94 REPORTING: Cash Flow once, Revenue exact, T5, aggregate funds
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsReporting() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("REPORTING", counter, id, value, detail); }
  var ec = EXPENSE_SINGLE_COMMIT_CORRECTION, pc = PURCHASE_EVENT_CORRECTION;
  var period = { filter: "custom", startDate: "2026-10-01", endDate: "2026-10-31",
    label: "2026-10" };
  var wide = u6fWidePeriod_();
  var flowAccounts = ["1030", "4000", "1040", "6100", "6210"];

  // RP88: Sales Void — the composed money reversal counts EXACTLY ONCE and
  // reverses the original inflow (wide period: net 0, no ambiguity).
  var voidSale = u6fComposedSale_("u6f-rp88-save");
  salesRecognitionV2VoidWithRuntime_(u6VoidPayload_("u6f-rp88", voidSale.orderID),
    u6fSalesRuntime_(voidSale));
  var voidFlow = buildCashFlowStatement(u6fSalesLedger_(voidSale.fixture),
    u4cFlowAccounts_(flowAccounts), wide, { openingCash: 0 });
  check("RP88", voidFlow.operating === 0 && voidFlow.ambiguous.length === 0 &&
    voidFlow.netChange === 0, JSON.stringify(voidFlow));

  // RP89: Sales Correct — flow net equals the replacement economics ONLY.
  var correctSale = u6fComposedSale_("u6f-rp89-save");
  salesRecognitionV2CorrectWithRuntime_(
    u6CorrectPayload_("u6f-rp89", correctSale.orderID,
      [{ productID: "P1", productVariantID: "PV1", qty: 4 }], "reporting correct"),
    u6fSalesRuntime_(correctSale));
  var correctFlow = buildCashFlowStatement(u6fSalesLedger_(correctSale.fixture),
    u4cFlowAccounts_(flowAccounts), wide, { openingCash: 0 });
  check("RP89", correctFlow.operating === 80000 && correctFlow.ambiguous.length === 0,
    JSON.stringify(correctFlow));

  // RP90: Expense Cancel / Correct flows: cancel reverses the outflow once
  // (net 0); correct nets to the replacement outflow only.
  var f90a = t11u2Fixture_();
  u6fExpenseSave_(f90a, "u6f-rp90a-save");
  var id90a = t11u2Ops_(f90a)[0].BusinessID;
  expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-rp90a", transactionId: id90a, reason: "reporting cancel" },
    f90a.spreadsheet(), u6fExpenseRuntime_(f90a), null);
  var cancelFlow90 = buildCashFlowStatement(t11u2Ledger_(f90a),
    u4cFlowAccounts_(flowAccounts), period, { openingCash: 0 });
  var f90b = t11u2Fixture_();
  u6fExpenseSave_(f90b, "u6f-rp90b-save");
  var id90b = t11u2Ops_(f90b)[0].BusinessID;
  expenseCorrectionDispatch_(ec.CORRECT,
    { requestKey: "u6fpcorr15", transactionId: id90b, reason: "reporting correct",
      expenseItemId: "OSS01", amount: 30000 },
    f90b.spreadsheet(), u6fExpenseRuntime_(f90b), null);
  var correctFlow90 = buildCashFlowStatement(t11u2Ledger_(f90b),
    u4cFlowAccounts_(flowAccounts), period, { openingCash: 0 });
  check("RP90", cancelFlow90.operating === 0 && cancelFlow90.ambiguous.length === 0 &&
    correctFlow90.operating === -30000 && correctFlow90.ambiguous.length === 0,
    JSON.stringify({ cancel: cancelFlow90, correct: correctFlow90 }));

  // RP91: Purchase Cancel / Correct flows: cancel net 0; correct net = the
  // replacement outflow only.
  var f91a = t11u3Fixture_();
  u6fPurchaseSave_(f91a, "u6f-rp91a-save");
  purchaseCorrectionDispatch_(pc.VOID,
    { requestKey: "u6f-rp91a", transactionId: "PE-u6f-rp91a-save",
      reason: "reporting cancel" },
    f91a.spreadsheet(), u6fPurchaseRuntime_(f91a), null);
  var cancelFlow91 = buildCashFlowStatement(t11u3Ledger_(f91a),
    u4cFlowAccounts_(flowAccounts), period, { openingCash: 0 });
  var f91b = t11u3Fixture_();
  u6fPurchaseSave_(f91b, "u6f-rp91b-save");
  purchaseCorrectionDispatch_(pc.CORRECT,
    { requestKey: "u6fpcorr16", transactionId: "PE-u6f-rp91b-save",
      reason: "reporting correct", expenseItemId: "OSK01", input: {
        ExpenseDate: "2026-10-06", ReceiptDate: "2026-10-06", PurchaseQty: "5",
        PurchaseUOM: "KG", AcquisitionValue: "120000", SupplierSource: "PT Maju Jaya",
        ExternalRef: "", ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE",
        Attested: true, ConversionEvidenceConfirmed: false } },
    f91b.spreadsheet(), u6fPurchaseRuntime_(f91b), null);
  var correctFlow91 = buildCashFlowStatement(t11u3Ledger_(f91b),
    u4cFlowAccounts_(flowAccounts), period, { openingCash: 0 });
  check("RP91", cancelFlow91.operating === 0 && cancelFlow91.ambiguous.length === 0 &&
    correctFlow91.operating === -120000 && correctFlow91.ambiguous.length === 0,
    JSON.stringify({ cancel: cancelFlow91, correct: correctFlow91 }));

  // RP92: Revenue authority — voided sale contributes 0 recognized revenue;
  // the corrected sale's revenue is EXACTLY the replacement amount.
  u6MirrorOperations_(voidSale.fixture, voidSale.repository);
  var voidScope = buildFinanceSalesRecognitionScope_(
    buildRecognizedSalesProjectionFromSpreadsheet_(voidSale.fixture), period);
  u6MirrorOperations_(correctSale.fixture, correctSale.repository);
  var correctScope = buildFinanceSalesRecognitionScope_(
    buildRecognizedSalesProjectionFromSpreadsheet_(correctSale.fixture), period);
  check("RP92", voidScope.recognizedRevenue === 0 &&
    correctScope.recognizedRevenue === 80000,
    JSON.stringify({ void: voidScope.recognizedRevenue,
      correct: correctScope.recognizedRevenue }));

  // RP93: T5 — composed void leaves no false outstanding and no unexplained
  // residual; the corrected chain keeps 1030 net 0 and residual 0.
  var t5Void = treasuryT5Reconciliation_(voidSale.fixture);
  var t5Correct = treasuryT5Reconciliation_(correctSale.fixture);
  check("RP93", t5Void.reconciliationStatus === "OK" &&
    t5Void.outstandingTotal === 0 && t5Void.unexplainedResidual === 0 &&
    t5Void.ledgerNet1030 === 0 &&
    t5Correct.reconciliationStatus === "OK" &&
    t5Correct.ledgerNet1030 === 0 && t5Correct.unexplainedResidual === 0,
    JSON.stringify({ void: t5Void, correct: t5Correct }));

  // RP94: Balance / aggregate funds — Expense Cancel returns the aggregate
  // to the exact pre-save level (no double count, no residue).
  var f94 = t11u2Fixture_();
  var before94 = buildAggregateFundsReadModel_(t11u2Ledger_(f94)).totalFunds;
  u6fExpenseSave_(f94, "u6f-rp94-save");
  var id94 = t11u2Ops_(f94)[0].BusinessID;
  var mid94 = buildAggregateFundsReadModel_(t11u2Ledger_(f94)).totalFunds;
  expenseCorrectionDispatch_(ec.VOID,
    { requestKey: "u6f-rp94", transactionId: id94, reason: "reporting aggregate" },
    f94.spreadsheet(), u6fExpenseRuntime_(f94), null);
  var after94 = buildAggregateFundsReadModel_(t11u2Ledger_(f94));
  check("RP94", mid94 === before94 - 25000 && after94.totalFunds === before94 &&
    after94.status === "OK",
    JSON.stringify({ before: before94, mid: mid94, after: after94 }));
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 95-100 HISTORICAL: transitional 24k invariant, forbidden writers, legacy
// compatibility, untouched historical evidence
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsHistorical() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("HISTORICAL", counter, id, value, detail); }
  var ec = EXPENSE_SINGLE_COMMIT_CORRECTION;

  // HS95: transitional 24k invariant BEFORE this matrix: outstanding 24k,
  // ledgerNet1030 24k, residual 0 — never auto-closed, no EvidenceRef.
  var transitional = treasuryT4SeededFixture_();
  var trans = treasuryT5Reconciliation_(transitional);
  check("HS95", trans.reconciliationStatus === "OK" && trans.ledgerNet1030 === 24000 &&
    trans.outstandingTotal === 24000 && trans.unexplainedResidual === 0,
    JSON.stringify(trans));

  // HS96: no correction core ever writes 2010 / 2000 / 1100 / 5000.
  var forbidden = ["2010", "2000", "1100", "5000"];
  var coreSource = [expenseCorrectionPlan_, expenseCorrectionNewIntent_,
    expenseCorrectionInspect_, purchaseCorrectionPlan_,
    purchaseCorrectionNewIntent_, purchaseCorrectionInspect_].map(function(fn) {
      return fn.toString(); }).join("\n");
  check("HS96", forbidden.every(function(code) {
      return coreSource.indexOf('"' + code + '"') === -1 &&
        coreSource.indexOf("'" + code + "'") === -1; }),
    "correction cores contain no forbidden account literal");

  // HS97: no forbidden write surface anywhere in the correction contracts.
  check("HS97", ["Payments", "Settlements", "TreasuryReceipts", "InventoryLedger",
      "AccountsPayable", "FinanceOpeningBalances"].every(function(sheet) {
      return JSON.stringify(EXPENSE_SINGLE_COMMIT_CORRECTION.WRITE_SURFACES +
        PURCHASE_EVENT_CORRECTION.WRITE_SURFACES).indexOf(sheet) === -1; }) &&
    JSON.stringify(EXPENSE_SINGLE_COMMIT_CORRECTION.WRITE_SURFACES) ===
      JSON.stringify(["tabops", "BalanceLedger", "Logs"]) &&
    JSON.stringify(PURCHASE_EVENT_CORRECTION.WRITE_SURFACES) ===
      JSON.stringify(["PurchaseEvents", "BalanceLedger", "Logs"]),
    JSON.stringify(EXPENSE_SINGLE_COMMIT_CORRECTION.WRITE_SURFACES));

  // HS98: legacy rows keep the exact legacy lifecycle behavior (the cohort
  // guard never overfires on a row without a single-commit operation).
  var f98 = t11u2Fixture_();
  var legacyId = "OPS-APP-20260101-HISTORICAL01";
  var before98 = u6fSheetRows_(f98);
  var originalSheet = SpreadsheetApp.getActiveSpreadsheet;
  var originalFlush = SpreadsheetApp.flush;
  SpreadsheetApp.getActiveSpreadsheet = function() { return f98.spreadsheet(); };
  SpreadsheetApp.flush = function() {};
  var legacyVoid;
  try {
    legacyVoid = voidCanonicalTransaction({ transactionId: legacyId,
      reason: "legacy row void" });
  } finally {
    SpreadsheetApp.getActiveSpreadsheet = originalSheet;
    SpreadsheetApp.flush = originalFlush;
  }
  var legacyRow = t11u2Tabops_(f98).filter(function(row) {
    return row.ID_Trx === legacyId; })[0];
  check("HS98", legacyVoid && legacyVoid.success === true &&
    Boolean(legacyRow) && legacyRow.IsActive === false &&
    u6fSheetRows_(f98) !== before98, JSON.stringify(legacyVoid));

  // HS99: legacy Purchase void keeps working for a non-T11 event row.
  var f99 = t11u3Fixture_();
  var legacyEventID = "PE-purchase-hist-0001";
  var originalSheet99 = SpreadsheetApp.getActiveSpreadsheet;
  var originalFlush99 = SpreadsheetApp.flush;
  SpreadsheetApp.getActiveSpreadsheet = function() { return f99.spreadsheet(); };
  SpreadsheetApp.flush = function() {};
  var legacyPurchaseVoid;
  try {
    legacyPurchaseVoid = voidPurchaseEvent({ eventOrRequestKey: legacyEventID,
      reason: "legacy purchase void" });
  } finally {
    SpreadsheetApp.getActiveSpreadsheet = originalSheet99;
    SpreadsheetApp.flush = originalFlush99;
  }
  var legacyEvent = t11u3Events_(f99).filter(function(row) {
    return row.EventID === legacyEventID; })[0];
  check("HS99", legacyPurchaseVoid && legacyPurchaseVoid.status === "VOIDED" &&
    Boolean(legacyEvent) && legacyEvent.Lifecycle === "VOIDED" &&
    legacyEvent.IsActive === false, JSON.stringify(legacyPurchaseVoid));

  // HS100: seeded historical evidence in the fixtures stays byte-identical
  // through a full T11 cancel/correct cycle (append-only around it).
  var f100 = t11u2Fixture_();
  var historicalTabops = JSON.stringify(f100.sheets.tabops.rows[1]);
  var historicalLedger = JSON.stringify(f100.sheets.BalanceLedger.rows[1]);
  var historicalLog = JSON.stringify(f100.sheets.Logs.rows[1]);
  u6fExpenseSave_(f100, "u6f-hs100-save");
  var id100 = t11u2Ops_(f100)[0].BusinessID;
  expenseCorrectionDispatch_(ec.CORRECT,
    { requestKey: "u6fpcorr17", transactionId: id100, reason: "historical cycle",
      expenseItemId: "OSS01", amount: 27000 },
    f100.spreadsheet(), u6fExpenseRuntime_(f100), null);
  check("HS100", JSON.stringify(f100.sheets.tabops.rows[1]) === historicalTabops &&
    JSON.stringify(f100.sheets.BalanceLedger.rows[1]) === historicalLedger &&
    JSON.stringify(f100.sheets.Logs.rows[1]) === historicalLog,
    "seeded historical rows untouched");
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 101-109 REGRESSION / isolation: control plane, public surface, cohort
// routing both ways, namespaces, gates, package manifest, transitional re-check
// ---------------------------------------------------------------------------
function testSingleCommitCorrectionsRegression() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u6fCheck_("REGRESSION", counter, id, value, detail); }
  var ec = EXPENSE_SINGLE_COMMIT_CORRECTION, pc = PURCHASE_EVENT_CORRECTION;

  // GR101: control plane never routes through correction code (U5
  // prep/activation/pause writer isolation preserved).
  var controlSource = fs.readFileSync("101.SingleCommit.Config.Control.js", "utf8");
  check("GR101", controlSource.indexOf("EXPENSE_SINGLE_COMMIT_CORRECT") === -1 &&
    controlSource.indexOf("PURCHASE_EVENT_CORRECT") === -1 &&
    controlSource.indexOf("SALES_V2_VOID") === -1 &&
    controlSource.indexOf("expenseCorrection") === -1,
    "config control plane isolated from correction code");

  // GR102: the six operator entries exist; the outer lock lives ONLY in the
  // public wrappers (cores never lock -> no nested locks).
  var entries = [expenseSingleCommitDurableVoid, expenseSingleCommitDurableCorrect,
    purchaseEventDurableVoid, purchaseEventDurableCorrect,
    salesRecognitionV2DurableVoid, salesRecognitionV2DurableCorrect];
  var wrapperSource = [expenseCorrectionPublic_.toString(),
    purchaseCorrectionPublic_.toString(),
    salesRecognitionV2DurableMutation_.toString()].join("\n");
  var coreSource = [expenseCorrectionRun_.toString(), expenseCorrectionNewIntent_.toString(),
    expenseCorrectionResume_.toString(), purchaseCorrectionRun_.toString(),
    purchaseCorrectionNewIntent_.toString(), purchaseCorrectionResume_.toString(),
    salesRecognitionV2MutationNewIntent_.toString(),
    salesRecognitionV2MutationResume_.toString()].join("\n");
  check("GR102", entries.every(function(fn) { return typeof fn === "function"; }) &&
    wrapperSource.indexOf("waitLock") !== -1 &&
    wrapperSource.indexOf("releaseLock") !== -1 &&
    coreSource.indexOf("waitLock") === -1 && coreSource.indexOf("releaseLock") === -1,
    "outer lock only in public wrappers");

  // GR103: cores never touch production transport/config services directly
  // (runtime + gate are injected; local/inert execution only).
  check("GR103", coreSource.indexOf("SpreadsheetApp") === -1 &&
    coreSource.indexOf("PropertiesService") === -1 &&
    coreSource.indexOf("clasp") === -1,
    "cores are transport-injected and inert");

  // GR104: UI cohort routing exists in BOTH directions — the four durable
  // endpoints are wired, and every legacy endpoint token is preserved.
  var htmlActions = fs.readFileSync("195.View.Transactions.Actions.html", "utf8");
  check("GR104",
    htmlActions.indexOf(".expenseSingleCommitDurableVoid(") !== -1 &&
    htmlActions.indexOf(".expenseSingleCommitDurableCorrect(") !== -1 &&
    htmlActions.indexOf(".purchaseEventDurableVoid(") !== -1 &&
    htmlActions.indexOf(".purchaseEventDurableCorrect(") !== -1 &&
    htmlActions.indexOf(".voidCanonicalTransaction({ transactionId:") !== -1 &&
    htmlActions.indexOf(".correctCanonicalTransaction(payload);") !== -1 &&
    htmlActions.indexOf(".voidPurchaseEvent({ eventOrRequestKey:") !== -1 &&
    htmlActions.indexOf(".correctPurchaseEvent(payload);") !== -1 &&
    htmlActions.indexOf("singleCommitPendingKey_") !== -1 &&
    htmlActions.indexOf("checkSingleCommitPending") !== -1,
    "durable + legacy routing both present");

  // GR105: server cohort guards + detail flag present on both legacy writers.
  var lifecycleSource = fs.readFileSync("22.Transaction.Lifecycle.js", "utf8");
  var purchaseSource = fs.readFileSync("47.Purchase.Events.js", "utf8");
  check("GR105",
    lifecycleSource.indexOf("SINGLE_COMMIT_COHORT_ROUTED") !== -1 &&
    lifecycleSource.indexOf("singleCommitExpenseLifecycleTarget_") !== -1 &&
    lifecycleSource.indexOf("detail.singleCommit = true") !== -1 &&
    purchaseSource.indexOf("SINGLE_COMMIT_COHORT_ROUTED") !== -1 &&
    purchaseSource.indexOf("purchaseSingleCommitEventGuard_") !== -1 &&
    purchaseSource.indexOf("projection.singleCommit = true") !== -1,
    "cohort guards + detail flags present");

  // GR106: operation namespaces are exactly disjoint — one intent key per
  // operator action, one OperationType per action class.
  var namespaces = [SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE,
    SALES_RECOGNITION_V2_MUTATION.VOID, SALES_RECOGNITION_V2_MUTATION.CORRECT,
    EXPENSE_SINGLE_COMMIT_V1.OPERATION_TYPE, ec.VOID, ec.CORRECT,
    PURCHASE_SINGLE_COMMIT_V1.OPERATION_TYPE, pc.VOID, pc.CORRECT];
  var uniqueNamespaces = namespaces.filter(function(name, index) {
    return namespaces.indexOf(name) === index; });
  var uniqueIds = namespaces.map(function(name) {
    return transactionOperationID_(name, "u6f-ns-key"); });
  check("GR106", uniqueNamespaces.length === namespaces.length &&
    uniqueIds.filter(function(id, index) {
      return uniqueIds.indexOf(id) === index; }).length === namespaces.length,
    JSON.stringify(namespaces));

  // GR107: admission gates preserved — PAUSED refuses NEW work on every
  // domain; ABSENT/PREPARED keeps Sales recognition-only and Expense/
  // Purchase LEGACY routing (no silent fallback, reads/recovery unaffected).
  var salesPaused = singleCommitTransactionSalesGate_(
    JSON.parse(t11ConfigRaw_("PAUSED")));
  var salesAbsent = singleCommitTransactionSalesGate_(
    { state: "ABSENT", mode: "", detail: "", config: null });
  var expensePaused = expenseSingleCommitGate_({ singleCommitConfig:
    t11u2ConfigRaw_("PAUSED") });
  var purchasePaused = purchaseSingleCommitGate_({ singleCommitConfig:
    t11u3ConfigRaw_("PAUSED") });
  check("GR107", salesPaused.allowed === false &&
    salesPaused.code === "SINGLE_COMMIT_MODE_PAUSED" &&
    salesAbsent.allowed === true && salesAbsent.composedMoney === false &&
    expensePaused.mode === "REFUSE" &&
    expensePaused.code === "SINGLE_COMMIT_MODE_PAUSED" &&
    purchasePaused.mode === "REFUSE" &&
    purchasePaused.code === "SINGLE_COMMIT_MODE_PAUSED",
    JSON.stringify({ salesPaused: salesPaused, expensePaused: expensePaused }));

  // GR108: package manifest untouched — the allowlist still carries exactly
  // the 76 registered deployment files and never lists this test file.
  var allowlist = fs.readFileSync(".claspignore", "utf8").split(/\r?\n/)
    .filter(function(line) { return line.indexOf("!") === 0; });
  check("GR108", allowlist.length === 76 &&
    allowlist.indexOf("!96.Tests.SingleCommit.Corrections.Cases.js") === -1 &&
    allowlist.indexOf("!_test_runner.js") === -1,
    String(allowlist.length));

  // GR109: transitional 24k invariant AFTER the whole matrix — outstanding
  // 24k / ledgerNet1030 24k / residual 0, never auto-closed.
  var afterTransitional = treasuryT4SeededFixture_();
  var after = treasuryT5Reconciliation_(afterTransitional);
  check("GR109", after.reconciliationStatus === "OK" &&
    after.ledgerNet1030 === 24000 && after.outstandingTotal === 24000 &&
    after.unexplainedResidual === 0, JSON.stringify(after));
  return { status: "PASS", checks: counter.pass };
}
