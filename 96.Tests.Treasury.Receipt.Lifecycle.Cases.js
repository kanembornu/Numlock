// Treasury T6 lifecycle tests (suites A-H + 20-boundary failure injection +
// 30-point mutation sensitivity) for 99C.Treasury.Receipt.Reversal.
// Correction.js. In-memory fixture spreadsheets only: reuses the T3/T4/T5
// fixtures, runtimes, and builders (same VM context). Every writer call runs
// under a temporary Jakarta-true Utilities.formatDate stand-in (UTC+7, no DST
// for 2020s dates) so treasuryDateKey measures the frozen Asia/Jakarta
// authority; the original harness stub is restored in finally. No production
// access, no network, no clasp, no writes outside fixture memory, no source
// mutation left behind.

function treasuryT6Check_(id, value, detail) {
  if (!value) throw new Error("TREASURY_T6:" + id + (detail === undefined ? "" : "|" + detail));
}

var TREASURY_T6_RID = "SCR-U3-ORD-T4-1";

// Temporary Jakarta-true date stand-in around every lifecycle writer call.
function treasuryT6WithJakartaDate_(fn) {
  var originalFormatDate = Utilities.formatDate;
  Utilities.formatDate = function(date, timeZone, format) {
    if (format !== "yyyy-MM-dd") throw new Error("unexpected format " + format);
    var shifted = new Date(date.getTime() + 7 * 3600 * 1000);
    return shifted.toISOString().slice(0, 10);
  };
  try { return fn(); } finally { Utilities.formatDate = originalFormatDate; }
}

function treasuryT6Reverse_(payload, runtime) {
  return treasuryT6WithJakartaDate_(function() {
    return treasuryLifecycleReverseWithRuntime_(payload, runtime);
  });
}

function treasuryT6Correct_(payload, runtime) {
  return treasuryT6WithJakartaDate_(function() {
    return treasuryLifecycleCorrectWithRuntime_(payload, runtime);
  });
}

function treasuryT6Runtime_(options) {
  return treasuryT4Runtime_(options);
}

function treasuryT6SeededFixture_() {
  return treasuryT4SeededFixture_();
}

// Seeds ONE authoritative committed ordinary receipt through the real T4
// writer (original receipt id is deterministic for key "t6-orig-01").
function treasuryT6SeedReceipt_(fixture, key) {
  var result = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_(key || "t6-orig-01"),
    treasuryT4Runtime_({ fixture: fixture }));
  if (result.status !== "DONE") {
    throw new Error("T6_SEED_FAILED:" + result.status + ":" + result.code);
  }
  return result;
}

function treasuryT6ReversePayload_(key, target, overrides) {
  return Object.assign({
    requestKey: key || "t6-rev-001",
    treasuryReceiptID: target,
    reason: "WRONG WALLET ACCOUNT",
    actor: "tester@numlock.test"
  }, overrides || {});
}

function treasuryT6CorrectPayload_(key, target, overrides) {
  return Object.assign({
    requestKey: key || "t6-corr-001",
    treasuryReceiptID: target,
    destinationAccountCode: "1010",
    receiptDate: "2026-10-20",
    evidenceType: "MANUAL_VERIFIED",
    evidenceRef: "WALLET-TRX-CORR-001",
    reason: "MISKEYED DESTINATION ACCOUNT",
    actor: "tester@numlock.test"
  }, overrides || {});
}

function treasuryT6Receipts_(fixture) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  return readCanonicalTable(fixture, contract.SCHEMAS.RECEIPTS.SHEET,
    contract.SCHEMAS.RECEIPTS.HEADERS);
}

function treasuryT6Operations_(fixture) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  return readCanonicalTable(fixture, contract.SCHEMAS.OPERATIONS.SHEET,
    contract.SCHEMAS.OPERATIONS.HEADERS);
}

function treasuryT6Audits_(fixture) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  return readCanonicalTable(fixture, contract.SCHEMAS.AUDITS.SHEET,
    contract.SCHEMAS.AUDITS.HEADERS);
}

function treasuryT6OpByTypeKey_(fixture, operationType, requestKey) {
  var matches = treasuryT6Operations_(fixture).filter(function(row) {
    return String(row.OperationType) === operationType &&
      String(row.RequestKey) === requestKey;
  });
  return matches.length === 1 ? matches[0] : null;
}

function treasuryT6ReceiptById_(fixture, receiptID) {
  var matches = treasuryT6Receipts_(fixture).filter(function(row) {
    return String(row.TreasuryReceiptID) === receiptID;
  });
  return matches.length === 1 ? matches[0] : null;
}

function treasuryT6LedgerBySource_(fixture, receiptID) {
  return treasuryT4LedgerRows_(fixture).filter(function(row) {
    return String(row.SourceType) === "TREASURY_RECEIPT_V1" &&
      String(row.SourceID) === receiptID;
  });
}

// Full byte-level row snapshot of the ORIGINAL receipt (immutability proof).
function treasuryT6OriginalBytes_(fixture, receiptID) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  var row = treasuryT6ReceiptById_(fixture, receiptID);
  if (!row) return null;
  return JSON.stringify(contract.SCHEMAS.RECEIPTS.HEADERS.map(function(header) {
    return row[header];
  }));
}

// A structurally valid ordinary receipt with amount 20000 against the 24000
// recognition (used for the post-reversal outstanding mismatch gate).
function treasuryT6UnderClearingFixture_() {
  var fixture = treasuryT6SeededFixture_();
  treasuryT5FabricateReceipt_(fixture, { suffix: "UNDER", amount: 20000 });
  return { fixture: fixture, receiptID: "TRC-T5-UNDER" };
}

// ---------------------------------------------------------------------------
// Suite A — Reversal core: exact delta, journal shape, envelope, replay,
// conflict, double-reversal, reversal-of-reversal, mode gates, lock wrapper.
// ---------------------------------------------------------------------------
function testTreasuryT6ReversalCore() {
  var pass = 0;
  function check(id, value, detail) { treasuryT6Check_(id, value, detail); pass++; }
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, contract = TREASURY_RECEIPT_V1_CONTRACT,
    rid = TREASURY_T6_RID;
  var fixture = treasuryT6SeededFixture_();
  var seed = treasuryT6SeedReceipt_(fixture);
  var before = treasuryT4RowCounts_(fixture);
  var originalBytes = treasuryT6OriginalBytes_(fixture, seed.receiptID);
  var runtime = treasuryT6Runtime_({ fixture: fixture });
  var result = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-rev-001", seed.receiptID),
    runtime);

  // A1 envelope: DONE, exact identity surface, no Date objects.
  check("A1", result.status === "DONE" && result.code === "" && result.replay === false &&
    result.writeCount === life.REVERSE.FRESH_WRITE_COUNT &&
    result.requestKey === "t6-rev-001" && result.operationID !== "" &&
    result.receiptID !== "" && result.reversalReceiptID === result.receiptID &&
    result.journalID !== "" && result.auditID !== "" &&
    result.recognitionID === rid, JSON.stringify(result));
  check("A2", treasuryT4NoDate_(result));
  // A3 exact delta: +1 op / +1 receipt / +2 ledger / +1 audit; isolation
  // surfaces identical.
  var after = treasuryT4RowCounts_(fixture);
  check("A3", after.TreasuryOperations === before.TreasuryOperations + 1 &&
    after.TreasuryReceipts === before.TreasuryReceipts + 1 &&
    after.TreasuryAudits === before.TreasuryAudits + 1 &&
    after.BalanceLedger === before.BalanceLedger + 2 &&
    after.Orders === before.Orders && after.OrderLines === before.OrderLines &&
    after.SalesRecognitionEvents === before.SalesRecognitionEvents &&
    after.SalesRecognitionAudits === before.SalesRecognitionAudits &&
    after.TransactionOperations === before.TransactionOperations &&
    after.Payments === before.Payments && after.Settlements === before.Settlements &&
    after.tabsal === before.tabsal && after.tabops === before.tabops &&
    after.InventoryLedger === before.InventoryLedger &&
    after.PurchaseEvents === before.PurchaseEvents && after.Accounts === before.Accounts,
    JSON.stringify({ before: before, after: after }));
  // A4 operation row: REVERSE type, COMMITTED, in the frozen T3 enum.
  var op = treasuryT6OpByTypeKey_(fixture, life.REVERSE.OPERATION_TYPE, "t6-rev-001");
  check("A4", !!op && op.State === "COMMITTED" && op.LastError === "" &&
    op.RecognitionID === rid &&
    contract.OPERATION_TYPES.indexOf(String(op.OperationType)) !== -1,
    op ? JSON.stringify({ type: op.OperationType, state: op.State }) : "NO_OP");
  // A5 frozen plan verifies; planned/context membership present per the T6
  // plan-shape requirement.
  var plan = JSON.parse(op.OperationPlan);
  check("A5", treasuryLifecycleVerifyPlan_(plan).ok === true &&
    plan.plannedReceiptIds.length === 1 && plan.plannedAuditIds.length === 1 &&
    plan.contextReceiptIds.length === 1 && plan.contextAuditIds.length === 1 &&
    plan.contextReceiptIds[0] === seed.receiptID &&
    Object.keys(plan.contextReceiptHashes).length === 1 &&
    Object.keys(plan.contextAuditHashes).length === 1,
    JSON.stringify(treasuryLifecycleVerifyPlan_(plan)));
  // A6 reversal receipt row: frozen shape + lineage + action-day dates.
  var reversalRow = treasuryT6ReceiptById_(fixture, result.receiptID);
  check("A6", !!reversalRow && reversalRow.ReceiptType === "SALES_RECEIPT_REVERSAL" &&
    reversalRow.ReversalOfReceiptID === seed.receiptID &&
    reversalRow.ReplacementReceiptID === "" && reversalRow.OriginalReceiptID === "" &&
    reversalRow.DestinationAccountCode === "1000" &&
    Number(reversalRow.GrossAmount) === 24000 &&
    reversalRow.ReceiptDate === "2026-10-15" && reversalRow.EconomicDate === "2026-10-15" &&
    reversalRow.Reason === "WRONG WALLET ACCOUNT" &&
    reversalRow.Actor === "tester@numlock.test" &&
    reversalRow.PostingStatus === "COMMITTED" &&
    reversalRow.EvidenceType === "MANUAL_VERIFIED" &&
    reversalRow.EvidenceRef === "REVERSAL:" + seed.receiptID,
    reversalRow ? JSON.stringify(reversalRow) : "NO_ROW");
  var reversalSnapshot = JSON.parse(reversalRow.SnapshotJSON);
  check("A7", reversalSnapshot.side === "REVERSAL" &&
    reversalSnapshot.operationType === life.REVERSE.OPERATION_TYPE &&
    reversalSnapshot.targetReceiptID === seed.receiptID &&
    reversalSnapshot.receiptDate === "2026-10-15" &&
    reversalSnapshot.original.receiptID === seed.receiptID &&
    reversalSnapshot.original.receiptHash === plan.targetReceiptHash &&
    reversalSnapshot.original.grossAmount === 24000 &&
    reversalSnapshot.replacementReceiptID === "" &&
    reversalSnapshot.recognitionID === rid,
    JSON.stringify(reversalSnapshot));
  // A8 journal: exactly Dr 1030 / Cr original destination, reversal movement,
  // own source, action-day Tanggal, no forbidden accounts, balanced.
  var journal = treasuryT6LedgerBySource_(fixture, result.receiptID);
  check("A8", journal.length === 2 && journal[0].LineID === result.journalID + "-1" &&
    journal[1].LineID === result.journalID + "-2" &&
    journal[0].AccountCode === "1030" && Number(journal[0].Debit) === 24000 &&
    Number(journal[0].Credit) === 0 && journal[1].AccountCode === "1000" &&
    Number(journal[1].Debit) === 0 && Number(journal[1].Credit) === 24000 &&
    journal[0].MovementType === "TREASURY_RECEIPT_REVERSAL" &&
    journal[1].MovementType === "TREASURY_RECEIPT_REVERSAL" &&
    journal[0].SourceType === "TREASURY_RECEIPT_V1" &&
    journal[0].SourceID === result.receiptID && journal[1].SourceID === result.receiptID &&
    journal[0].ExternalRef === rid && journal[1].ExternalRef === rid &&
    journal[0].Tanggal === "2026-10-15" && journal[1].Tanggal === "2026-10-15" &&
    isCanonicalActive(journal[0].IsActive) && isCanonicalActive(journal[1].IsActive) &&
    journal.every(function(row) {
      return ["4000", "5000", "1100", "2000", "2010", "6210"].indexOf(String(row.AccountCode)) === -1;
    }), JSON.stringify(journal));
  // A9 signature recomputed from persisted rows, ≠ the original signature.
  var original = treasuryT6ReceiptById_(fixture, seed.receiptID);
  var recomputed = treasuryJournalSignature(journal);
  check("A9", recomputed === plan.journalSignatures[result.receiptID] &&
    reversalRow.JournalSignature === recomputed &&
    recomputed !== original.JournalSignature, recomputed);
  // A10 audit: exactly ONE new audit keyed to the reversal receipt (N = 1).
  var audits = treasuryT6Audits_(fixture);
  check("A10", audits.length === 2 && audits.some(function(row) {
    return row.AuditID === result.auditID && row.OperationID === result.operationID &&
      row.TreasuryReceiptID === result.receiptID && row.JournalID === result.journalID &&
      row.RecognitionID === rid && row.PayloadHash === op.PayloadHash;
  }), JSON.stringify(audits));
  // A11 ONE atomic batch: one call, three surfaces, four rows, one cache bump.
  check("A11", runtime.events.batches.length === 1 &&
    runtime.events.batches[0].length === 3 && runtime.events.appliedRows === 4 &&
    runtime.events.cacheCalls === 1 &&
    runtime.events.batches[0].map(function(range) { return range.range; }).join(",") ===
      life.WRITE_SURFACES.join(","), JSON.stringify(runtime.events.batches.length));
  // A12 original immutable: every original cell byte-identical after reversal.
  check("A12", treasuryT6OriginalBytes_(fixture, seed.receiptID) === originalBytes);
  // A13 exact replay: same key + same payload => DONE replay, zero writes.
  var replayRuntime = treasuryT6Runtime_({ fixture: fixture });
  var counts = JSON.stringify(treasuryT4RowCounts_(fixture));
  var replay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-rev-001", seed.receiptID),
    replayRuntime);
  check("A13a", replay.status === "DONE" && replay.replay === true &&
    replay.writeCount === 0 && replay.receiptID === result.receiptID &&
    replay.operationID === result.operationID && replay.auditID === result.auditID &&
    replay.reversalReceiptID === result.receiptID, JSON.stringify(replay));
  check("A13b", replayRuntime.events.batches.length === 0 &&
    replayRuntime.events.appliedRows === 0 && replayRuntime.events.cacheCalls === 1 &&
    JSON.stringify(treasuryT4RowCounts_(fixture)) === counts);
  // A14 same key + different payload => deterministic conflict, zero writes.
  var conflict = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-rev-001", seed.receiptID,
    { reason: "ANOTHER REASON" }), treasuryT6Runtime_({ fixture: fixture }));
  check("A14", conflict.status === "CONFLICT" &&
    conflict.code === life.CODES.REQUEST_KEY_CONFLICT && conflict.writeCount === 0 &&
    JSON.stringify(treasuryT4RowCounts_(fixture)) === counts, JSON.stringify(conflict));
  // A15 NEW key double reversal => TREASURY_ALREADY_REVERSED, zero writes.
  var doubleRev = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-rev-002", seed.receiptID),
    treasuryT6Runtime_({ fixture: fixture }));
  check("A15a", doubleRev.status === "REFUSED" &&
    doubleRev.code === life.CODES.ALREADY_REVERSED && doubleRev.writeCount === 0,
    JSON.stringify(doubleRev));
  check("A15b", JSON.stringify(treasuryT4RowCounts_(fixture)) === counts);
  // A16 reversal-of-reversal: the reversal receipt itself is not a target.
  var revOfRev = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-rev-003", result.receiptID),
    treasuryT6Runtime_({ fixture: fixture }));
  check("A16", revOfRev.status === "REFUSED" &&
    revOfRev.code === life.CODES.TARGET_NOT_RECEIPT &&
    String(revOfRev.detail).indexOf("SALES_RECEIPT_REVERSAL") !== -1 &&
    revOfRev.writeCount === 0, JSON.stringify(revOfRev));
  // A17 mode gates: PREPARED/PAUSED refuse NEW; zero writes.
  var prepared = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-rev-p", seed.receiptID),
    treasuryT6Runtime_({ config: { mode: "PREPARED", contractVersion: "TREASURY_RECEIPT_V1",
      activationID: "", activatedAt: "", configVersion: 1 } }));
  var paused = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-rev-q", seed.receiptID),
    treasuryT6Runtime_({ config: Object.assign(treasuryT4ActiveConfig_(),
      { mode: "PAUSED" }) }));
  check("A17", prepared.status === "REFUSED" && prepared.code === life.CODES.NOT_ACTIVATED &&
    paused.status === "REFUSED" && paused.code === life.CODES.MODE_PAUSED &&
    prepared.writeCount === 0 && paused.writeCount === 0,
    JSON.stringify({ prepared: prepared, paused: paused }));
  // A18 outer-lock wrappers own the single ScriptLock per entry; cores never.
  var wrapperReverse = treasuryReceiptDurableReverse.toString();
  var wrapperCorrect = treasuryReceiptDurableCorrect.toString();
  var coreSource = treasuryLifecycleReverseWithRuntime_.toString() +
    treasuryLifecycleCorrectWithRuntime_.toString() +
    treasuryLifecycleNewIntent_.toString() + treasuryLifecycleResume_.toString() +
    treasuryLifecycleApplyBatch_.toString();
  check("A18", wrapperReverse.indexOf("waitLock(30000)") !== -1 &&
    wrapperReverse.indexOf("releaseLock") !== -1 && wrapperReverse.indexOf("finally") !== -1 &&
    wrapperReverse.indexOf("treasuryLifecycleReverseWithRuntime_") !== -1 &&
    wrapperCorrect.indexOf("waitLock(30000)") !== -1 &&
    wrapperCorrect.indexOf("releaseLock") !== -1 && wrapperCorrect.indexOf("finally") !== -1 &&
    wrapperCorrect.indexOf("treasuryLifecycleCorrectWithRuntime_") !== -1 &&
    coreSource.indexOf("waitLock") === -1 && coreSource.indexOf("releaseLock") === -1);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Suite B — Correction core: ONE plan / ONE atomic batch / 7-row delta,
// dual lineage, evidence-only append-only correction, refusal gates.
// ---------------------------------------------------------------------------
function testTreasuryT6CorrectionCore() {
  var pass = 0;
  function check(id, value, detail) { treasuryT6Check_(id, value, detail); pass++; }
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, contract = TREASURY_RECEIPT_V1_CONTRACT,
    rid = TREASURY_T6_RID;
  var fixture = treasuryT6SeededFixture_();
  var seed = treasuryT6SeedReceipt_(fixture);
  var originalBytes = treasuryT6OriginalBytes_(fixture, seed.receiptID);
  var before = treasuryT4RowCounts_(fixture);
  var runtime = treasuryT6Runtime_({ fixture: fixture });
  var result = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-001", seed.receiptID),
    runtime);

  // B1 envelope: DONE, primary = replacement, reversal identity retained.
  check("B1", result.status === "DONE" && result.code === "" && result.replay === false &&
    result.writeCount === life.CORRECT.FRESH_WRITE_COUNT &&
    result.requestKey === "t6-corr-001" && result.operationID !== "" &&
    result.receiptID !== "" && result.reversalReceiptID !== "" &&
    result.receiptID !== result.reversalReceiptID && result.journalID !== "" &&
    result.auditID !== "" && result.recognitionID === rid &&
    treasuryT4NoDate_(result), JSON.stringify(result));
  // B2 exact delta: +1 op / +2 receipts / +4 ledger / +1 audit.
  var after = treasuryT4RowCounts_(fixture);
  check("B2", after.TreasuryOperations === before.TreasuryOperations + 1 &&
    after.TreasuryReceipts === before.TreasuryReceipts + 2 &&
    after.TreasuryAudits === before.TreasuryAudits + 1 &&
    after.BalanceLedger === before.BalanceLedger + 4 &&
    after.Orders === before.Orders &&
    after.SalesRecognitionEvents === before.SalesRecognitionEvents &&
    after.Payments === before.Payments && after.Settlements === before.Settlements &&
    after.InventoryLedger === before.InventoryLedger && after.Accounts === before.Accounts,
    JSON.stringify({ before: before, after: after }));
  // B3 operation: CORRECT, COMMITTED, in the frozen T3 enum.
  var op = treasuryT6OpByTypeKey_(fixture, life.CORRECT.OPERATION_TYPE, "t6-corr-001");
  check("B3", !!op && op.State === "COMMITTED" && op.RecognitionID === rid &&
    contract.OPERATION_TYPES.indexOf(String(op.OperationType)) !== -1);
  // B4 plan verifies with 2 planned receipts + 1 planned audit + context.
  var plan = JSON.parse(op.OperationPlan);
  check("B4", treasuryLifecycleVerifyPlan_(plan).ok === true &&
    plan.plannedReceiptIds.length === 2 &&
    plan.plannedReceiptIds[0] <= plan.plannedReceiptIds[1] &&
    plan.plannedAuditIds.length === 1 && plan.receiptRows.length === 2 &&
    plan.journalRows.length === 4 && plan.contextReceiptIds.length === 1 &&
    plan.contextAuditIds.length === 1,
    JSON.stringify(treasuryLifecycleVerifyPlan_(plan)));
  // B5 dual lineage: reversal row carries ReversalOf + Replacement; the
  // replacement row carries OriginalReceiptID; corrected facts on replacement.
  var reversalRow = treasuryT6ReceiptById_(fixture, result.reversalReceiptID);
  var replacementRow = treasuryT6ReceiptById_(fixture, result.receiptID);
  check("B5", !!reversalRow && !!replacementRow &&
    reversalRow.ReceiptType === "SALES_RECEIPT_REVERSAL" &&
    reversalRow.ReversalOfReceiptID === seed.receiptID &&
    reversalRow.ReplacementReceiptID === replacementRow.TreasuryReceiptID &&
    reversalRow.DestinationAccountCode === "1000" &&
    Number(reversalRow.GrossAmount) === 24000 &&
    reversalRow.ReceiptDate === "2026-10-15" && reversalRow.EconomicDate === "2026-10-15" &&
    replacementRow.ReceiptType === "SALES_RECEIPT" &&
    replacementRow.OriginalReceiptID === seed.receiptID &&
    replacementRow.ReversalOfReceiptID === "" &&
    replacementRow.ReplacementReceiptID === "" &&
    replacementRow.DestinationAccountCode === "1010" &&
    Number(replacementRow.GrossAmount) === 24000 &&
    replacementRow.ReceiptDate === "2026-10-20" &&
    replacementRow.EconomicDate === "2026-10-20" &&
    replacementRow.EvidenceRef === "WALLET-TRX-CORR-001",
    JSON.stringify({ reversal: reversalRow, replacement: replacementRow }));
  // B6 journals: reversal pair Dr1030/Cr1000 (action day) + replacement pair
  // Dr1010/Cr1030 (operator day); forbidden accounts absent; signatures.
  var revJournal = treasuryT6LedgerBySource_(fixture, result.reversalReceiptID);
  var replJournal = treasuryT6LedgerBySource_(fixture, result.receiptID);
  check("B6a", revJournal.length === 2 && revJournal[0].AccountCode === "1030" &&
    Number(revJournal[0].Debit) === 24000 && revJournal[1].AccountCode === "1000" &&
    Number(revJournal[1].Credit) === 24000 &&
    revJournal[0].MovementType === "TREASURY_RECEIPT_REVERSAL" &&
    revJournal[0].Tanggal === "2026-10-15" &&
    revJournal.every(function(row) { return row.ExternalRef === rid; }),
    JSON.stringify(revJournal));
  check("B6b", replJournal.length === 2 && replJournal[0].AccountCode === "1010" &&
    Number(replJournal[0].Debit) === 24000 && replJournal[1].AccountCode === "1030" &&
    Number(replJournal[1].Credit) === 24000 &&
    replJournal[0].MovementType === "TREASURY_RECEIPT" &&
    replJournal[0].Tanggal === "2026-10-20" &&
    replJournal.every(function(row) { return row.ExternalRef === rid; }),
    JSON.stringify(replJournal));
  check("B6c", revJournal.concat(replJournal).every(function(row) {
    return ["4000", "5000", "1100", "2000", "2010", "6210"].indexOf(String(row.AccountCode)) === -1;
  }) && treasuryJournalSignature(revJournal) === reversalRow.JournalSignature &&
    treasuryJournalSignature(replJournal) === replacementRow.JournalSignature &&
    reversalRow.JournalSignature !== replacementRow.JournalSignature);
  // B7 audit N = 1: exactly ONE new audit, carrying the REPLACEMENT id.
  var audits = treasuryT6Audits_(fixture);
  var newAudits = audits.filter(function(row) { return row.AuditID === result.auditID; });
  check("B7", audits.length === 2 && newAudits.length === 1 &&
    newAudits[0].TreasuryReceiptID === replacementRow.TreasuryReceiptID &&
    newAudits[0].JournalID === replacementRow.JournalID &&
    newAudits[0].OperationID === result.operationID &&
    newAudits[0].PayloadHash === op.PayloadHash, JSON.stringify(newAudits));
  // B8 ONE atomic batch: one call, three surfaces, seven rows, one cache.
  check("B8", runtime.events.batches.length === 1 &&
    runtime.events.batches[0].length === 3 && runtime.events.appliedRows === 7 &&
    runtime.events.cacheCalls === 1,
    JSON.stringify({ batches: runtime.events.batches.length, rows: runtime.events.appliedRows }));
  // B9 replacement snapshot: corrected facts + original/reversal ids.
  var replacementSnapshot = JSON.parse(replacementRow.SnapshotJSON);
  check("B9", replacementSnapshot.side === "REPLACEMENT" &&
    replacementSnapshot.destination.code === "1010" &&
    replacementSnapshot.receiptDate === "2026-10-20" &&
    replacementSnapshot.evidence.ref === "WALLET-TRX-CORR-001" &&
    replacementSnapshot.originalReceiptID === seed.receiptID &&
    replacementSnapshot.reversalReceiptID === result.reversalReceiptID &&
    replacementSnapshot.original.receiptHash === plan.targetReceiptHash,
    JSON.stringify(replacementSnapshot));
  // B10 original immutable through correction (byte-identical).
  check("B10", treasuryT6OriginalBytes_(fixture, seed.receiptID) === originalBytes);
  // B11 replay + conflict + double-correction refusals.
  var counts = JSON.stringify(treasuryT4RowCounts_(fixture));
  var replay = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-001", seed.receiptID),
    treasuryT6Runtime_({ fixture: fixture }));
  check("B11a", replay.status === "DONE" && replay.replay === true &&
    replay.writeCount === 0 && replay.receiptID === result.receiptID &&
    replay.reversalReceiptID === result.reversalReceiptID, JSON.stringify(replay));
  var conflict = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-001", seed.receiptID,
    { receiptDate: "2026-10-21" }), treasuryT6Runtime_({ fixture: fixture }));
  check("B11b", conflict.status === "CONFLICT" &&
    conflict.code === life.CODES.REQUEST_KEY_CONFLICT &&
    JSON.stringify(treasuryT4RowCounts_(fixture)) === counts, JSON.stringify(conflict));
  var doubleCorr = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-002", seed.receiptID),
    treasuryT6Runtime_({ fixture: fixture }));
  check("B11c", doubleCorr.status === "REFUSED" &&
    doubleCorr.code === life.CODES.ALREADY_REVERSED && doubleCorr.writeCount === 0 &&
    JSON.stringify(treasuryT4RowCounts_(fixture)) === counts, JSON.stringify(doubleCorr));
  // B12 evidence-only change is still an append-only correction (no
  // annotation authority in T2): same destination/date, new evidence — full
  // 7-row delta, never an in-place edit.
  var evidenceFixture = treasuryT6SeededFixture_();
  var evidenceSeed = treasuryT6SeedReceipt_(evidenceFixture);
  var evidenceBefore = treasuryT4RowCounts_(evidenceFixture);
  var evidenceBytes = treasuryT6OriginalBytes_(evidenceFixture, evidenceSeed.receiptID);
  var evidenceResult = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-ev",
    evidenceSeed.receiptID, { destinationAccountCode: "1000",
      receiptDate: "2026-10-12", evidenceRef: "WALLET-TRX-CORR-002" }),
    treasuryT6Runtime_({ fixture: evidenceFixture }));
  var evidenceAfter = treasuryT4RowCounts_(evidenceFixture);
  check("B12", evidenceResult.status === "DONE" &&
    evidenceResult.writeCount === life.CORRECT.FRESH_WRITE_COUNT &&
    evidenceAfter.TreasuryReceipts === evidenceBefore.TreasuryReceipts + 2 &&
    evidenceAfter.BalanceLedger === evidenceBefore.BalanceLedger + 4 &&
    treasuryT6OriginalBytes_(evidenceFixture, evidenceSeed.receiptID) === evidenceBytes,
    JSON.stringify(evidenceResult));
  // B13 destination refusals: clearing / unknown / inactive (fresh targets —
  // the main fixture's original is already claimed by B11c).
  var destFixture = treasuryT6SeededFixture_();
  var destSeed = treasuryT6SeedReceipt_(destFixture);
  var clearing = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-d1",
    destSeed.receiptID, { destinationAccountCode: "1030" }),
    treasuryT6Runtime_({ fixture: destFixture }));
  var unknown = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-d2",
    destSeed.receiptID, { destinationAccountCode: "1999" }),
    treasuryT6Runtime_({ fixture: destFixture }));
  var inactiveFixture = treasuryT6SeededFixture_();
  var inactiveSeed = treasuryT6SeedReceipt_(inactiveFixture);
  var accountSheet = inactiveFixture.getSheetByName("Accounts");
  var activeIdx = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("IsActive");
  accountSheet.values.forEach(function(row, index) {
    if (index > 0 && String(row[0]) === "1010") row[activeIdx] = false;
  });
  var inactive = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-d3",
    inactiveSeed.receiptID), treasuryT6Runtime_({ fixture: inactiveFixture }));
  check("B13", clearing.status === "REFUSED" &&
    clearing.code === life.CODES.DESTINATION_IS_CLEARING &&
    unknown.status === "REFUSED" && unknown.code === life.CODES.INVALID_DESTINATION_ACCOUNT &&
    inactive.status === "REFUSED" &&
    inactive.code === life.CODES.DESTINATION_ACCOUNT_INACTIVE &&
    clearing.writeCount === 0 && unknown.writeCount === 0 && inactive.writeCount === 0,
    JSON.stringify({ clearing: clearing, unknown: unknown, inactive: inactive }));
  // B14 exposure-change fail-closed: duplicate active receipts and an
  // under-clearing original both refuse the correction (no partial repair).
  var dupFixture = treasuryT6SeededFixture_();
  var dupSeed = treasuryT6SeedReceipt_(dupFixture);
  treasuryT5FabricateReceipt_(dupFixture, { suffix: "DUPB" });
  var dupCorr = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-dup",
    dupSeed.receiptID), treasuryT6Runtime_({ fixture: dupFixture }));
  check("B14a", dupCorr.status === "REFUSED" &&
    dupCorr.code === life.CODES.EXPOSURE_EXCEPTION &&
    String(dupCorr.detail).indexOf("DUPLICATE_ACTIVE_RECEIPTS") !== -1,
    JSON.stringify(dupCorr));
  var under = treasuryT6UnderClearingFixture_();
  var underCorr = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-corr-under",
    under.receiptID), treasuryT6Runtime_({ fixture: under.fixture }));
  check("B14b", underCorr.status === "REFUSED" &&
    underCorr.code === life.CODES.AMOUNT_MISMATCH &&
    String(underCorr.detail).indexOf("POST_REVERSAL_OUTSTANDING:4000") !== -1,
    JSON.stringify(underCorr));
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// Suite C — Integrity: deterministic identities, cross-link chain, snapshot
// contract, plan-shape/context requirements, tampered-plan fail-closed.
// ---------------------------------------------------------------------------
function testTreasuryT6Integrity() {
  var pass = 0;
  function check(id, value, detail) { treasuryT6Check_(id, value, detail); pass++; }
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, contract = TREASURY_RECEIPT_V1_CONTRACT;
  // C1 deterministic identities: identical key on identical fixtures => the
  // same four IDs, derived under the frozen namespaces.
  var fixtureA = treasuryT6SeededFixture_();
  var seedA = treasuryT6SeedReceipt_(fixtureA);
  var revA = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-int-001", seedA.receiptID),
    treasuryT6Runtime_({ fixture: fixtureA }));
  var fixtureB = treasuryT6SeededFixture_();
  var seedB = treasuryT6SeedReceipt_(fixtureB);
  var revB = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-int-001", seedB.receiptID),
    treasuryT6Runtime_({ fixture: fixtureB }));
  check("C1a", revA.status === "DONE" && revB.status === "DONE" &&
    revA.receiptID === revB.receiptID && revA.journalID === revB.journalID &&
    revA.auditID === revB.auditID && revA.operationID === revB.operationID,
    JSON.stringify({ a: revA, b: revB }));
  check("C1b", revA.receiptID === treasuryReceiptId(life.REVERSE.OPERATION_TYPE,
      "t6-int-001", "REVERSAL") &&
    revA.journalID === treasuryJournalId(life.REVERSE.OPERATION_TYPE, "t6-int-001",
      "REVERSAL") &&
    revA.auditID === treasuryAuditId(life.REVERSE.OPERATION_TYPE, "t6-int-001",
      "REVERSAL") &&
    revA.operationID === treasuryOperationId(life.REVERSE.OPERATION_TYPE, "t6-int-001"),
    JSON.stringify(revA));
  // C2 full cross-link chain: receipt -> operation -> journal -> audit ->
  // original -> recognition; operation plan digests verify.
  var op = treasuryT6OpByTypeKey_(fixtureA, life.REVERSE.OPERATION_TYPE, "t6-int-001");
  var receipt = treasuryT6ReceiptById_(fixtureA, revA.receiptID);
  var audit = treasuryT6Audits_(fixtureA).filter(function(row) {
    return row.AuditID === revA.auditID;
  })[0];
  var plan = JSON.parse(op.OperationPlan);
  check("C2", receipt.OperationID === op.TreasuryOperationID &&
    receipt.RequestKey === op.RequestKey && receipt.RecognitionID === op.RecognitionID &&
    audit.OperationID === op.TreasuryOperationID &&
    audit.TreasuryReceiptID === receipt.TreasuryReceiptID &&
    audit.JournalID === receipt.JournalID && audit.PayloadHash === op.PayloadHash &&
    receipt.ReversalOfReceiptID === seedA.receiptID &&
    plan.targetReceiptID === seedA.receiptID &&
    treasuryLifecycleVerifyPlan_(plan).ok === true, JSON.stringify({ receipt: receipt,
      audit: audit }));
  // C3 plan normalized payload round-trips operator facts only.
  check("C3", plan.normalizedPayload.requestKey === "t6-int-001" &&
    plan.normalizedPayload.treasuryReceiptID === seedA.receiptID &&
    plan.normalizedPayload.reason === "WRONG WALLET ACCOUNT" &&
    Object.keys(plan.normalizedPayload).sort().join(",") ===
      "actor,reason,requestKey,treasuryReceiptID", JSON.stringify(plan.normalizedPayload));
  // C4 snapshot contract: no HPP/order/product/payment fields on either
  // snapshot; replacement snapshot adds original/reversal ids.
  var reversalSnapshot = JSON.parse(receipt.SnapshotJSON);
  check("C4a", Object.keys(reversalSnapshot).every(function(key) {
    return !/hpp|recipe|product|cost|payment|settlement/i.test(key);
  }), Object.keys(reversalSnapshot).join(","));
  var corrFixture = treasuryT6SeededFixture_();
  var corrSeed = treasuryT6SeedReceipt_(corrFixture);
  var corr = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-int-corr", corrSeed.receiptID),
    treasuryT6Runtime_({ fixture: corrFixture }));
  var replacementSnapshot = JSON.parse(treasuryT6ReceiptById_(corrFixture,
    corr.receiptID).SnapshotJSON);
  check("C4b", corr.status === "DONE" && Object.keys(replacementSnapshot).every(function(key) {
    return !/hpp|recipe|product|cost|payment|settlement/i.test(key);
  }) && replacementSnapshot.originalReceiptID === corrSeed.receiptID &&
    replacementSnapshot.reversalReceiptID === corr.reversalReceiptID,
    JSON.stringify(replacementSnapshot));
  // C5 plan-shape requirement: planned ids + context fields present and
  // digest-covered on both operation kinds.
  var corrOp = treasuryT6OpByTypeKey_(corrFixture, life.CORRECT.OPERATION_TYPE,
    "t6-int-corr");
  var corrPlan = JSON.parse(corrOp.OperationPlan);
  check("C5a", Array.isArray(corrPlan.plannedReceiptIds) &&
    corrPlan.plannedReceiptIds.length === 2 && Array.isArray(corrPlan.plannedAuditIds) &&
    corrPlan.plannedAuditIds.length === 1 && Array.isArray(corrPlan.receiptRows) &&
    corrPlan.receiptRows.length === 2 && Array.isArray(corrPlan.contextReceiptIds) &&
    Array.isArray(corrPlan.contextAuditIds) && corrPlan.contextReceiptHashes &&
    corrPlan.contextAuditHashes && corrPlan.targetReceiptHash,
    JSON.stringify({ planned: corrPlan.plannedReceiptIds, context: corrPlan.contextReceiptIds }));
  check("C5b", treasuryLifecycleVerifyPlan_(corrPlan).ok === true &&
    corrPlan.auditRow.TreasuryReceiptID === corrPlan.replacementReceiptID);
  // C6 tampered plans fail closed on resume with ZERO new writes: actor
  // drift, journal account drift, missing context, target-hash drift, forged
  // signature.
  function tamperedResume(mutate, keySuffix) {
    var fx = treasuryT6SeededFixture_();
    var seedFx = treasuryT6SeedReceipt_(fx);
    var threw = null;
    try {
      treasuryT6Reverse_(treasuryT6ReversePayload_("t6-tamper-" + keySuffix,
        seedFx.receiptID),
        treasuryT6Runtime_({ fixture: fx, crash: "T6_BEFORE_BATCH" }));
    } catch (error) { threw = error; }
    var opRow = treasuryT6OpByTypeKey_(fx, life.REVERSE.OPERATION_TYPE,
      "t6-tamper-" + keySuffix);
    var tamperedPlan = JSON.parse(opRow.OperationPlan);
    mutate(tamperedPlan);
    treasuryT4WriteOpPlan_(fx, "t6-tamper-" + keySuffix, tamperedPlan);
    var counts = JSON.stringify(treasuryT4RowCounts_(fx));
    var runtime = treasuryT6Runtime_({ fixture: fx });
    var result = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-tamper-" + keySuffix,
      seedFx.receiptID), runtime);
    return { threw: threw, result: result, counts: counts, runtime: runtime, fixture: fx };
  }
  var actorTamper = tamperedResume(function(tamperedPlan) {
    tamperedPlan.actor = "evil@intruder.test";
  }, "actor");
  check("C6a", !!actorTamper.threw && actorTamper.result.status === "RECOVERY_REQUIRED" &&
    actorTamper.result.code === life.CODES.OPERATION_PLAN_MALFORMED &&
    String(actorTamper.result.detail) === "RECEIPT_ROW_MISMATCH" &&
    JSON.stringify(treasuryT4RowCounts_(actorTamper.fixture)) === actorTamper.counts,
    JSON.stringify(actorTamper.result));
  var accountTamper = tamperedResume(function(tamperedPlan) {
    tamperedPlan.journalRows[0].AccountCode = "4000";
  }, "acct");
  check("C6b", accountTamper.result.status === "RECOVERY_REQUIRED" &&
    String(accountTamper.result.detail) === "JOURNAL_ACCOUNT_MAPPING_MISMATCH",
    JSON.stringify(accountTamper.result));
  var contextTamper = tamperedResume(function(tamperedPlan) {
    delete tamperedPlan.contextReceiptIds;
    delete tamperedPlan.contextReceiptHashes;
    delete tamperedPlan.contextAuditIds;
    delete tamperedPlan.contextAuditHashes;
    tamperedPlan.plannedReceiptIds = [tamperedPlan.receiptID, "TRC-T6-SYNTHETIC"];
    delete tamperedPlan.planDigest;
    tamperedPlan.planDigest = transactionPayloadHash_(tamperedPlan);
  }, "ctx");
  check("C6c", contextTamper.result.status === "RECOVERY_REQUIRED" &&
    String(contextTamper.result.detail).indexOf("CONTEXT") !== -1,
    JSON.stringify(contextTamper.result));
  var targetHashTamper = tamperedResume(function(tamperedPlan) {
    tamperedPlan.targetReceiptHash = "FORGED-HASH";
    delete tamperedPlan.planDigest;
    tamperedPlan.planDigest = transactionPayloadHash_(tamperedPlan);
  }, "thash");
  check("C6d", targetHashTamper.result.status === "RECOVERY_REQUIRED" &&
    targetHashTamper.result.code === life.CODES.OPERATION_PLAN_MALFORMED &&
    String(targetHashTamper.result.detail) === "SNAPSHOT_CONTENT_MISMATCH" &&
    JSON.stringify(treasuryT4RowCounts_(targetHashTamper.fixture)) ===
      targetHashTamper.counts,
    JSON.stringify(targetHashTamper.result));
  var forgedSignature = tamperedResume(function(tamperedPlan) {
    tamperedPlan.journalSignatures[tamperedPlan.receiptID] = "ORIGINAL-SIG-FORGED";
    tamperedPlan.receiptRows[0].JournalSignature = "ORIGINAL-SIG-FORGED";
    delete tamperedPlan.planDigest;
    tamperedPlan.planDigest = transactionPayloadHash_(tamperedPlan);
  }, "sig");
  check("C6e", forgedSignature.result.status === "RECOVERY_REQUIRED" &&
    forgedSignature.result.code === life.CODES.OPERATION_PLAN_MALFORMED &&
    String(forgedSignature.result.detail) === "JOURNAL_SIGNATURE_MISMATCH",
    JSON.stringify(forgedSignature.result));
  // C7 CORRECT plan tamper: replacement journal account drift fails closed
  // on resume with zero writes.
  var corrTamperFx = treasuryT6SeededFixture_();
  var corrTamperSeed = treasuryT6SeedReceipt_(corrTamperFx);
  var corrThrew = null;
  try {
    treasuryT6Correct_(treasuryT6CorrectPayload_("t6-tamper-c", corrTamperSeed.receiptID),
      treasuryT6Runtime_({ fixture: corrTamperFx, crash: "T6_BEFORE_BATCH" }));
  } catch (error) { corrThrew = error; }
  var corrOpRow = treasuryT6OpByTypeKey_(corrTamperFx, life.CORRECT.OPERATION_TYPE,
    "t6-tamper-c");
  var corrTamperedPlan = JSON.parse(corrOpRow.OperationPlan);
  corrTamperedPlan.journalRows[3].AccountCode = "4000";
  treasuryT4WriteOpPlan_(corrTamperFx, "t6-tamper-c", corrTamperedPlan);
  var corrTamperCounts = JSON.stringify(treasuryT4RowCounts_(corrTamperFx));
  var corrTamperResult = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-tamper-c",
    corrTamperSeed.receiptID), treasuryT6Runtime_({ fixture: corrTamperFx }));
  check("C7", !!corrThrew && corrTamperResult.status === "RECOVERY_REQUIRED" &&
    String(corrTamperResult.detail) === "JOURNAL_ACCOUNT_MAPPING_MISMATCH" &&
    JSON.stringify(treasuryT4RowCounts_(corrTamperFx)) === corrTamperCounts,
    JSON.stringify(corrTamperResult));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Suite D — Recovery + 20-boundary failure injection matrix. Crash hooks at
// every durable boundary; response-boundary ambiguity is simulated by an
// injected batch (throw-before-apply / apply-then-throw / partial apply) —
// never fabricated as a real transport state. Every uncertain outcome
// preserves identity and recovers deterministically with the ORIGINAL key.
// ---------------------------------------------------------------------------
function testTreasuryT6Recovery() {
  var pass = 0;
  function check(id, value, detail) { treasuryT6Check_(id, value, detail); pass++; }
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  var receiptSheetRows = 3, ledgerRows = 7, auditSheetRows = 3;

  function artifactCounts(fixture) {
    return {
      receipts: fixture.getSheetByName("TreasuryReceipts").getLastRow(),
      ledger: fixture.getSheetByName("BalanceLedger").getLastRow(),
      audits: fixture.getSheetByName("TreasuryAudits").getLastRow()
    };
  }

  // FI1 config: invalid config refuses before any read/write.
  var fi1 = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi1", "TRC-X-1"),
    treasuryT6Runtime_({ config: null }));
  check("FI1", fi1.status === "REFUSED" && fi1.code === codes.CONFIG_INVALID &&
    fi1.writeCount === 0, JSON.stringify(fi1));
  // FI2 RequestKey conflict: same key, changed payload — state unchanged.
  var conflictFixture = treasuryT6SeededFixture_();
  var conflictSeed = treasuryT6SeedReceipt_(conflictFixture);
  var conflictFirst = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi2",
    conflictSeed.receiptID), treasuryT6Runtime_({ fixture: conflictFixture }));
  var conflictCounts = JSON.stringify(treasuryT4RowCounts_(conflictFixture));
  var fi2 = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi2", conflictSeed.receiptID,
    { reason: "DIFFERENT REASON" }), treasuryT6Runtime_({ fixture: conflictFixture }));
  check("FI2", conflictFirst.status === "DONE" && fi2.status === "CONFLICT" &&
    fi2.code === codes.REQUEST_KEY_CONFLICT &&
    JSON.stringify(treasuryT4RowCounts_(conflictFixture)) === conflictCounts,
    JSON.stringify(fi2));
  // FI3 original missing: target absent => TARGET_NOT_FOUND, zero writes.
  var missingFixture = treasuryT6SeededFixture_();
  treasuryT6SeedReceipt_(missingFixture);
  var missingBefore = JSON.stringify(treasuryT4RowCounts_(missingFixture));
  var fi3 = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi3", "TRC-NONE-0001"),
    treasuryT6Runtime_({ fixture: missingFixture }));
  check("FI3", fi3.status === "REFUSED" && fi3.code === codes.TARGET_NOT_FOUND &&
    fi3.writeCount === 0 && JSON.stringify(treasuryT4RowCounts_(missingFixture)) === missingBefore,
    JSON.stringify(fi3));
  // FI4 original integrity invalid: tampered original signature refuses.
  var integrityFixture = treasuryT6SeededFixture_();
  var integritySeed = treasuryT6SeedReceipt_(integrityFixture);
  var receiptSheet = integrityFixture.getSheetByName("TreasuryReceipts");
  receiptSheet.values[1][contract.SCHEMAS.RECEIPTS.HEADERS.indexOf("JournalSignature")] =
    "FORGED-ORIGINAL-SIG";
  var fi4 = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi4", integritySeed.receiptID),
    treasuryT6Runtime_({ fixture: integrityFixture }));
  check("FI4", fi4.status === "REFUSED" && fi4.code === codes.EXPOSURE_EXCEPTION &&
    String(fi4.detail).indexOf("ORIGINAL_SIGNATURE_MISMATCH") !== -1 && fi4.writeCount === 0,
    JSON.stringify(fi4));
  // FI5 T5 EXCEPTION state: duplicate active receipts refuse the reversal.
  var exceptionFixture = treasuryT6SeededFixture_();
  var exceptionSeed = treasuryT6SeedReceipt_(exceptionFixture);
  treasuryT5FabricateReceipt_(exceptionFixture, { suffix: "FI5DUP" });
  var fi5 = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi5", exceptionSeed.receiptID),
    treasuryT6Runtime_({ fixture: exceptionFixture }));
  check("FI5", fi5.status === "REFUSED" && fi5.code === codes.EXPOSURE_EXCEPTION &&
    String(fi5.detail).indexOf("DUPLICATE_ACTIVE_RECEIPTS") !== -1,
    JSON.stringify(fi5));
  // FI6 already reversed: committed sibling reversal refuses a new key.
  var reversedFixture = treasuryT6SeededFixture_();
  var reversedSeed = treasuryT6SeedReceipt_(reversedFixture);
  var reversedFirst = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi6a",
    reversedSeed.receiptID), treasuryT6Runtime_({ fixture: reversedFixture }));
  var fi6 = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi6b", reversedSeed.receiptID),
    treasuryT6Runtime_({ fixture: reversedFixture }));
  check("FI6", reversedFirst.status === "DONE" && fi6.status === "REFUSED" &&
    fi6.code === codes.ALREADY_REVERSED && fi6.writeCount === 0, JSON.stringify(fi6));
  // FI7 foreign claim: IN_PROGRESS reversal/correction claims the target.
  var claimFixture = treasuryT6SeededFixture_();
  var claimSeed = treasuryT6SeedReceipt_(claimFixture);
  var claimThrew = null;
  try {
    treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi7-owner", claimSeed.receiptID),
      treasuryT6Runtime_({ fixture: claimFixture, crash: "T6_AFTER_INTENT" }));
  } catch (error) { claimThrew = error; }
  check("FI7a", !!claimThrew && claimThrew.message === "CRASH:T6_AFTER_INTENT");
  var fi7a = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi7-lose", claimSeed.receiptID),
    treasuryT6Runtime_({ fixture: claimFixture }));
  var fi7b = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-fi7-c", claimSeed.receiptID),
    treasuryT6Runtime_({ fixture: claimFixture }));
  check("FI7b", fi7a.status === "REFUSED" && fi7a.code === codes.REVERSAL_TARGET_CLAIMED &&
    fi7b.status === "REFUSED" && fi7b.code === codes.REPLACEMENT_TARGET_CLAIMED &&
    fi7a.writeCount === 0 && fi7b.writeCount === 0,
    JSON.stringify({ rev: fi7a, corr: fi7b }));
  // Owner key still recovers deterministically (intent-only resume executes
  // the frozen plan once).
  var fi7recover = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi7-owner",
    claimSeed.receiptID), treasuryT6Runtime_({ fixture: claimFixture }));
  check("FI7c", fi7recover.status === "DONE" && fi7recover.replay === false &&
    fi7recover.writeCount === life.REVERSE.FRESH_WRITE_COUNT, JSON.stringify(fi7recover));
  // FI8-FI15 crash at every durability boundary, then resume with the SAME
  // RequestKey (reversal kind).
  [{ point: "T6_BEFORE_INTENT", ops: 0, state: "", artifacts: 0, write: 4, replay: false },
   { point: "T6_AFTER_INTENT_PERSIST", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 4, replay: false },
   { point: "T6_AFTER_INTENT", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 4, replay: false },
   { point: "T6_BEFORE_BATCH", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 4, replay: false },
   { point: "T6_AFTER_BATCH", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "T6_AFTER_READBACK", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "T6_BEFORE_COMMIT", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "T6_AFTER_COMMIT", ops: 1, state: "COMMITTED", artifacts: 1, write: 0, replay: true }
  ].forEach(function(scenario, index) {
    var id = "FI" + (8 + index) + "/" + (index + 1);
    var runtime = treasuryT6Runtime_({ crash: scenario.point });
    var fixture = runtime.spreadsheet;
    var seedResult = treasuryT6SeedReceipt_(fixture);
    var threw = null;
    try {
      treasuryT6Reverse_(treasuryT6ReversePayload_("t6-crash-" + scenario.point,
        seedResult.receiptID), runtime);
    } catch (error) { threw = error; }
    check(id + "a", !!threw && threw.message === "CRASH:" + scenario.point);
    var ops = treasuryT6Operations_(fixture).filter(function(row) {
      return String(row.RequestKey) === "t6-crash-" + scenario.point;
    });
    check(id + "b", scenario.ops === 0 ? ops.length === 0 : ops.length === 1);
    var counts = artifactCounts(fixture);
    check(id + "c", scenario.artifacts ?
      (counts.receipts === receiptSheetRows && counts.ledger === ledgerRows &&
        counts.audits === auditSheetRows) :
      (counts.receipts === 2 && counts.ledger === 5 && counts.audits === 2),
      JSON.stringify(counts));
    var resume = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-crash-" + scenario.point,
      seedResult.receiptID), treasuryT6Runtime_({ fixture: fixture }));
    check(id + "d", resume.status === "DONE" && resume.writeCount === scenario.write &&
      resume.replay === scenario.replay &&
      resume.requestKey === "t6-crash-" + scenario.point, JSON.stringify(resume));
    var finalCounts = artifactCounts(fixture);
    var finalOp = treasuryT6Operations_(fixture).filter(function(row) {
      return String(row.RequestKey) === "t6-crash-" + scenario.point;
    })[0];
    check(id + "e", finalCounts.receipts === receiptSheetRows &&
      finalCounts.ledger === ledgerRows && finalCounts.audits === auditSheetRows &&
      !!finalOp && finalOp.State === "COMMITTED");
  });
  // FI intent readback mismatch => INTENT_READBACK_FAILED, then recovery.
  var intentFixture = treasuryT6SeededFixture_();
  var intentSeed = treasuryT6SeedReceipt_(intentFixture);
  var originalFind = treasuryOperationFind_;
  var findCalls = 0;
  treasuryOperationFind_ = function(ss, operationType, requestKey) {
    findCalls++;
    var row = originalFind(ss, operationType, requestKey);
    if (findCalls === 2 && row) return Object.assign({}, row, { PayloadHash: "CORRUPT" });
    return row;
  };
  var intentResult;
  try {
    intentResult = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-intent",
      intentSeed.receiptID), treasuryT6Runtime_({ fixture: intentFixture }));
  } finally { treasuryOperationFind_ = originalFind; }
  check("FI_INTENTa", intentResult.status === "RECOVERY_REQUIRED" &&
    intentResult.code === codes.INTENT_READBACK_FAILED &&
    String(intentResult.detail).indexOf("INTENT_ROW_MISMATCH") !== -1 &&
    intentResult.writeCount === 0, JSON.stringify(intentResult));
  check("FI_INTENTb", artifactCounts(intentFixture).receipts === 2);
  var intentResume = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-intent",
    intentSeed.receiptID), treasuryT6Runtime_({ fixture: intentFixture }));
  check("FI_INTENTc", intentResume.status === "DONE" &&
    intentResume.writeCount === life.REVERSE.FRESH_WRITE_COUNT, JSON.stringify(intentResume));
  // FI ambiguous batch (throw before apply) => UNKNOWN, identity preserved,
  // NO autonomous retry inside the call; resume executes exactly once.
  var timeoutRuntime = treasuryT6Runtime_();
  var timeoutFixture = timeoutRuntime.spreadsheet;
  var timeoutSeed = treasuryT6SeedReceipt_(timeoutFixture);
  var timeoutEvents = timeoutRuntime.events;
  timeoutRuntime.batch = function(ranges) {
    timeoutEvents.batches.push(ranges);
    throw new Error("ETIMEDOUT");
  };
  var timeoutResult = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-timeout",
    timeoutSeed.receiptID), timeoutRuntime);
  check("FI_TIMEOUTa", timeoutResult.status === "UNKNOWN" &&
    timeoutResult.code === codes.BATCH_OUTCOME_UNKNOWN &&
    timeoutResult.writeCount === "UNKNOWN" &&
    timeoutResult.requestKey === "t6-fi-timeout" && timeoutResult.operationID !== "" &&
    timeoutResult.receiptID !== "" && timeoutResult.status !== "DONE",
    JSON.stringify(timeoutResult));
  check("FI_TIMEOUTb", timeoutEvents.batches.length === 1 && timeoutEvents.cacheCalls === 0 &&
    artifactCounts(timeoutFixture).receipts === 2 &&
    treasuryT6Operations_(timeoutFixture).filter(function(row) {
      return String(row.RequestKey) === "t6-fi-timeout";
    })[0].State === "IN_PROGRESS");
  var timeoutResume = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-timeout",
    timeoutSeed.receiptID), treasuryT6Runtime_({ fixture: timeoutFixture }));
  check("FI_TIMEOUTc", timeoutResume.status === "DONE" &&
    timeoutResume.writeCount === life.REVERSE.FRESH_WRITE_COUNT, JSON.stringify(timeoutResume));
  // FI lost callback (batch APPLIED, response lost) => readback authority:
  // exact artifacts win over the dispatch error -> COMMITTED -> DONE.
  var lostRuntime = treasuryT6Runtime_();
  var lostFixture = lostRuntime.spreadsheet;
  var lostSeed = treasuryT6SeedReceipt_(lostFixture);
  var innerBatch = lostRuntime.batch;
  lostRuntime.batch = function(ranges) {
    innerBatch(ranges);
    throw new Error("ETIMEDOUT_AFTER_APPLY");
  };
  var lostResult = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-lost",
    lostSeed.receiptID), lostRuntime);
  check("FI_LOST", lostResult.status === "DONE" &&
    lostResult.writeCount === life.REVERSE.FRESH_WRITE_COUNT &&
    artifactCounts(lostFixture).receipts === receiptSheetRows, JSON.stringify(lostResult));
  // FI partial batch => PARTIAL fail closed, never blind-append on replay.
  function partialBatchFor_(events, fixture, rangeCount) {
    return function(ranges) {
      events.batches.push(ranges);
      ranges.slice(0, rangeCount).forEach(function(range) {
        var sheet = fixture.getSheetByName(range.range);
        var cols = range.values[0] ? range.values[0].length : 0;
        sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length, cols)
          .setValues(range.values);
        events.appliedRows += range.values.length;
      });
      throw new Error("SIMULATED_PARTIAL_APPLY");
    };
  }
  var partialRuntime = treasuryT6Runtime_();
  var partialFixture = partialRuntime.spreadsheet;
  var partialSeed = treasuryT6SeedReceipt_(partialFixture);
  partialRuntime.batch = partialBatchFor_(partialRuntime.events, partialFixture, 1);
  var partialResult = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-partial",
    partialSeed.receiptID), partialRuntime);
  check("FI_PARTIALa", partialResult.status === "RECOVERY_REQUIRED" &&
    partialResult.code === codes.ARTIFACTS_INCOMPLETE &&
    String(partialResult.detail).indexOf("JOURNAL") !== -1 &&
    String(partialResult.detail).indexOf("AUDIT") !== -1, JSON.stringify(partialResult));
  var partialCounts = JSON.stringify(treasuryT4RowCounts_(partialFixture));
  var partialReplay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-partial",
    partialSeed.receiptID), treasuryT6Runtime_({ fixture: partialFixture }));
  check("FI_PARTIALb", partialReplay.status === "RECOVERY_REQUIRED" &&
    partialReplay.code === codes.ARTIFACTS_INCOMPLETE &&
    JSON.stringify(treasuryT4RowCounts_(partialFixture)) === partialCounts,
    JSON.stringify(partialReplay));
  // FI correction partial batch (subset of a 7-row batch) also fails closed.
  var corrPartialRuntime = treasuryT6Runtime_();
  var corrPartialFixture = corrPartialRuntime.spreadsheet;
  var corrPartialSeed = treasuryT6SeedReceipt_(corrPartialFixture);
  corrPartialRuntime.batch = partialBatchFor_(corrPartialRuntime.events, corrPartialFixture, 2);
  var corrPartialResult = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-fi-cpartial",
    corrPartialSeed.receiptID), corrPartialRuntime);
  check("FI_CPARTIAL", corrPartialResult.status === "RECOVERY_REQUIRED" &&
    corrPartialResult.code === codes.ARTIFACTS_INCOMPLETE, JSON.stringify(corrPartialResult));
  // FI audit mismatch: tampered persisted audit fails replay.
  var auditRuntime = treasuryT6Runtime_();
  var auditFixture = auditRuntime.spreadsheet;
  var auditSeed = treasuryT6SeedReceipt_(auditFixture);
  var auditFirst = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-audit",
    auditSeed.receiptID), auditRuntime);
  check("FI_AUDIT0", auditFirst.status === "DONE");
  auditFixture.getSheetByName("TreasuryAudits").values[2]
    [contract.SCHEMAS.AUDITS.HEADERS.indexOf("Actor")] = "evil@intruder.test";
  var auditCounts = JSON.stringify(treasuryT4RowCounts_(auditFixture));
  var fiAudit = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-audit",
    auditSeed.receiptID), treasuryT6Runtime_({ fixture: auditFixture }));
  check("FI_AUDIT1", fiAudit.status === "RECOVERY_REQUIRED" &&
    String(fiAudit.detail).indexOf("AUDIT_TAMPERED") !== -1 &&
    JSON.stringify(treasuryT4RowCounts_(auditFixture)) === auditCounts,
    JSON.stringify(fiAudit));
  // FI committed readback: commit write failure => UNKNOWN, then recovery.
  var commitWriteRuntime = treasuryT6Runtime_();
  var commitWriteFixture = commitWriteRuntime.spreadsheet;
  var commitWriteSeed = treasuryT6SeedReceipt_(commitWriteFixture);
  var originalUpdate = treasuryOperationUpdate_;
  treasuryOperationUpdate_ = function() {
    throw new Error("SIMULATED_UPDATE_TRANSPORT_FAILED");
  };
  var commitWriteResult;
  try {
    commitWriteResult = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-cw",
      commitWriteSeed.receiptID), commitWriteRuntime);
  } finally { treasuryOperationUpdate_ = originalUpdate; }
  check("FI_CWa", commitWriteResult.status === "UNKNOWN" &&
    commitWriteResult.code === codes.SAVE_EXECUTION_UNKNOWN &&
    commitWriteResult.writeCount === life.REVERSE.FRESH_WRITE_COUNT,
    JSON.stringify(commitWriteResult));
  var commitWriteResume = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-cw",
    commitWriteSeed.receiptID), treasuryT6Runtime_({ fixture: commitWriteFixture }));
  check("FI_CWb", commitWriteResume.status === "DONE" &&
    commitWriteResume.replay === true && commitWriteResume.writeCount === 0,
    JSON.stringify(commitWriteResume));
  // FI COMMITTED with artifacts deleted => fail closed, no re-append.
  var goneRuntime = treasuryT6Runtime_();
  var goneFixture = goneRuntime.spreadsheet;
  var goneSeed = treasuryT6SeedReceipt_(goneFixture);
  var goneFirst = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-gone",
    goneSeed.receiptID), goneRuntime);
  check("FI_GONE0", goneFirst.status === "DONE");
  life.WRITE_SURFACES.forEach(function(name) {
    goneFixture.getSheetByName(name).values.splice(2);
  });
  var goneCounts = JSON.stringify(treasuryT4RowCounts_(goneFixture));
  var fiGone = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-gone",
    goneSeed.receiptID), treasuryT6Runtime_({ fixture: goneFixture }));
  check("FI_GONE1", fiGone.status === "RECOVERY_REQUIRED" &&
    fiGone.requestKey === "t6-fi-gone" && fiGone.operationID !== "" &&
    JSON.stringify(treasuryT4RowCounts_(goneFixture)) === goneCounts,
    JSON.stringify(fiGone));
  // FI concurrent mutation after freeze: a post-freeze sibling fails closed.
  var concurrentFixture = treasuryT6SeededFixture_();
  var concurrentSeed = treasuryT6SeedReceipt_(concurrentFixture);
  var concurrentThrew = null;
  try {
    treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-conc", concurrentSeed.receiptID),
      treasuryT6Runtime_({ fixture: concurrentFixture, crash: "T6_BEFORE_BATCH" }));
  } catch (error) { concurrentThrew = error; }
  treasuryT5FabricateReceipt_(concurrentFixture, { suffix: "LATE6" });
  var concurrentCounts = JSON.stringify(treasuryT4RowCounts_(concurrentFixture));
  var concurrentRuntime = treasuryT6Runtime_({ fixture: concurrentFixture });
  var fiConc = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-conc",
    concurrentSeed.receiptID), concurrentRuntime);
  check("FI_CONCa", !!concurrentThrew && fiConc.status === "RECOVERY_REQUIRED" &&
    String(fiConc.detail).indexOf("RECOGNITION_DUPLICATE_RECEIPT") !== -1,
    JSON.stringify(fiConc));
  check("FI_CONCb", JSON.stringify(treasuryT4RowCounts_(concurrentFixture)) === concurrentCounts &&
    concurrentRuntime.events.batches.length === 0 && concurrentRuntime.events.cacheCalls === 0);
  // FI Sales state change pre-reread: advisory exposure valid, then a Sales
  // void lands before the lifecycle call => in-lock re-read refuses.
  var salesRaceFixture = treasuryT6SeededFixture_();
  var salesRaceSeed = treasuryT6SeedReceipt_(salesRaceFixture);
  var advisoryExposure = treasuryResolveExposure_(TREASURY_T6_RID, salesRaceFixture);
  check("FI_SALESa", !!advisoryExposure && advisoryExposure.recognizedAmount === 24000);
  u3ReversalAppend_(salesRaceFixture, { RecognitionID: TREASURY_T6_RID, OrderID: "ORD-T4-1",
    Amount: 24000, ActivationID: "ACT-U2" }, { date: "2026-10-14",
    recognizedAt: "2026-10-14T03:00:00.000Z", targetRecognitionID: TREASURY_T6_RID });
  var fiSales = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-sales",
    salesRaceSeed.receiptID), treasuryT6Runtime_({ fixture: salesRaceFixture }));
  check("FI_SALESb", fiSales.status === "REFUSED" &&
    fiSales.code === codes.RECOGNITION_INACTIVE && fiSales.writeCount === 0,
    JSON.stringify(fiSales));
  // FI PAUSED new-vs-recovery: PAUSED refuses NEW, completes persisted
  // IN_PROGRESS recovery (T2 section 5).
  var pausedFixture = treasuryT6SeededFixture_();
  var pausedSeed = treasuryT6SeedReceipt_(pausedFixture);
  var pausedThrew = null;
  try {
    treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-paused", pausedSeed.receiptID),
      treasuryT6Runtime_({ fixture: pausedFixture, crash: "T6_AFTER_INTENT" }));
  } catch (error) { pausedThrew = error; }
  var pausedNew = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-paused-new",
    pausedSeed.receiptID), treasuryT6Runtime_({ fixture: pausedFixture,
    config: Object.assign(treasuryT4ActiveConfig_(), { mode: "PAUSED" }) }));
  var pausedRecovery = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-paused",
    pausedSeed.receiptID), treasuryT6Runtime_({ fixture: pausedFixture,
    config: Object.assign(treasuryT4ActiveConfig_(), { mode: "PAUSED" }) }));
  check("FI_PAUSED", !!pausedThrew && pausedNew.status === "REFUSED" &&
    pausedNew.code === codes.MODE_PAUSED && pausedNew.writeCount === 0 &&
    pausedRecovery.status === "DONE" &&
    pausedRecovery.writeCount === life.REVERSE.FRESH_WRITE_COUNT,
    JSON.stringify({ pausedNew: pausedNew, recovery: pausedRecovery }));
  // FI cache failure: DONE survives a non-fatal cache error.
  var cacheFailRuntime = treasuryT6Runtime_({ cacheFail: true });
  var cacheFailSeed = treasuryT6SeedReceipt_(cacheFailRuntime.spreadsheet);
  var fiCache = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-fi-cache",
    cacheFailSeed.receiptID), cacheFailRuntime);
  check("FI_CACHE", fiCache.status === "DONE" &&
    fiCache.writeCount === life.REVERSE.FRESH_WRITE_COUNT &&
    cacheFailRuntime.events.cacheCalls === 1, JSON.stringify(fiCache));
  // FI replacement signature fail: persisted replacement signature tamper on
  // a correction fails replay with the frozen signature code.
  var replSigRuntime = treasuryT6Runtime_();
  var replSigFixture = replSigRuntime.spreadsheet;
  var replSigSeed = treasuryT6SeedReceipt_(replSigFixture);
  var replSigFirst = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-fi-rsig",
    replSigSeed.receiptID), replSigRuntime);
  check("FI_RSIG0", replSigFirst.status === "DONE");
  var replSigReceipts = replSigFixture.getSheetByName("TreasuryReceipts");
  var replIdx = replSigReceipts.values.length - 1;
  replSigReceipts.values[replIdx][contract.SCHEMAS.RECEIPTS.HEADERS
    .indexOf("JournalSignature")] = "FORGED-REPL-SIG";
  var fiReplSig = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-fi-rsig",
    replSigSeed.receiptID), treasuryT6Runtime_({ fixture: replSigFixture }));
  check("FI_RSIG1", fiReplSig.status === "RECOVERY_REQUIRED" &&
    fiReplSig.code === codes.JOURNAL_SIGNATURE_INVALID &&
    String(fiReplSig.detail).indexOf("RECEIPT_SIGNATURE_MISMATCH") !== -1,
    JSON.stringify(fiReplSig));
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// Suite E — Concurrency: the ScriptLock serializes whole executions; every
// lifecycle claim is re-evaluated inside the lock, so an advisory read can
// never produce two owners of one receipt lineage.
// ---------------------------------------------------------------------------
function testTreasuryT6Concurrency() {
  var pass = 0;
  function check(id, value, detail) { treasuryT6Check_(id, value, detail); pass++; }
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES;
  // E1 rev x rev: exactly one owner; loser is a deterministic refusal.
  var fixture = treasuryT6SeededFixture_();
  var seed = treasuryT6SeedReceipt_(fixture);
  var advisory = treasuryT6Receipts_(fixture);
  check("E1a", advisory.length === 1 && advisory[0].TreasuryReceiptID === seed.receiptID);
  var winner = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-e1-win", seed.receiptID),
    treasuryT6Runtime_({ fixture: fixture }));
  var loser = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-e1-lose", seed.receiptID),
    treasuryT6Runtime_({ fixture: fixture }));
  check("E1b", winner.status === "DONE" && loser.status === "REFUSED" &&
    loser.code === codes.ALREADY_REVERSED && loser.writeCount === 0,
    JSON.stringify({ winner: winner, loser: loser }));
  var reversalRows = treasuryT6Receipts_(fixture).filter(function(row) {
    return String(row.ReversalOfReceiptID) === seed.receiptID;
  });
  check("E1c", reversalRows.length === 1 &&
    treasuryT6LedgerBySource_(fixture, reversalRows[0].TreasuryReceiptID).length === 2);
  // E2 corr x corr: same one-owner rule.
  var corrFixture = treasuryT6SeededFixture_();
  var corrSeed = treasuryT6SeedReceipt_(corrFixture);
  var corrWinner = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-e2-win",
    corrSeed.receiptID), treasuryT6Runtime_({ fixture: corrFixture }));
  var corrLoser = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-e2-lose",
    corrSeed.receiptID), treasuryT6Runtime_({ fixture: corrFixture }));
  check("E2", corrWinner.status === "DONE" && corrLoser.status === "REFUSED" &&
    corrLoser.code === codes.ALREADY_REVERSED,
    JSON.stringify({ winner: corrWinner, loser: corrLoser }));
  // E3 rev x corr both directions: exactly one owner each way.
  var rcFixture = treasuryT6SeededFixture_();
  var rcSeed = treasuryT6SeedReceipt_(rcFixture);
  var rcReverse = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-e3-rev",
    rcSeed.receiptID), treasuryT6Runtime_({ fixture: rcFixture }));
  var rcCorr = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-e3-corr", rcSeed.receiptID),
    treasuryT6Runtime_({ fixture: rcFixture }));
  check("E3a", rcReverse.status === "DONE" && rcCorr.status === "REFUSED" &&
    rcCorr.code === codes.ALREADY_REVERSED, JSON.stringify(rcCorr));
  var crFixture = treasuryT6SeededFixture_();
  var crSeed = treasuryT6SeedReceipt_(crFixture);
  var crCorr = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-e3-c", crSeed.receiptID),
    treasuryT6Runtime_({ fixture: crFixture }));
  var crReverse = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-e3-r", crSeed.receiptID),
    treasuryT6Runtime_({ fixture: crFixture }));
  check("E3b", crCorr.status === "DONE" && crReverse.status === "REFUSED" &&
    crReverse.code === codes.ALREADY_REVERSED, JSON.stringify(crReverse));
  // E4 stale claim: an IN_PROGRESS claim (crash) blocks other keys with the
  // frozen claimed codes; the owner key recovers exactly once.
  var claimFixture = treasuryT6SeededFixture_();
  var claimSeed = treasuryT6SeedReceipt_(claimFixture);
  var advisoryClaims = treasuryT6Receipts_(claimFixture).filter(function(row) {
    return String(row.ReversalOfReceiptID) === claimSeed.receiptID;
  });
  check("E4a", advisoryClaims.length === 0);
  var claimThrew = null;
  try {
    treasuryT6Reverse_(treasuryT6ReversePayload_("t6-e4-owner", claimSeed.receiptID),
      treasuryT6Runtime_({ fixture: claimFixture, crash: "T6_AFTER_INTENT" }));
  } catch (error) { claimThrew = error; }
  var claimLoser = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-e4-lose",
    claimSeed.receiptID), treasuryT6Runtime_({ fixture: claimFixture }));
  check("E4b", !!claimThrew && claimLoser.status === "REFUSED" &&
    claimLoser.code === codes.REVERSAL_TARGET_CLAIMED, JSON.stringify(claimLoser));
  var claimRecovery = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-e4-owner",
    claimSeed.receiptID), treasuryT6Runtime_({ fixture: claimFixture }));
  check("E4c", claimRecovery.status === "DONE" && claimRecovery.replay === false &&
    claimRecovery.writeCount === life.REVERSE.FRESH_WRITE_COUNT, JSON.stringify(claimRecovery));
  // E5 new-receipt x reversal under the lock: a post-reversal Save with a NEW
  // key clears the restored outstanding (the sanctioned restore path); a
  // stale advisory amount cannot double-clear.
  var restoreFixture = treasuryT6SeededFixture_();
  var restoreSeed = treasuryT6SeedReceipt_(restoreFixture);
  var advisoryOutstanding = treasuryComputeOutstanding_(TREASURY_T6_RID, 24000,
    restoreFixture, "");
  check("E5a", advisoryOutstanding.outstanding === 0, JSON.stringify(advisoryOutstanding));
  var restoreReverse = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-e5-rev",
    restoreSeed.receiptID), treasuryT6Runtime_({ fixture: restoreFixture }));
  var restoredOutstanding = treasuryComputeOutstanding_(TREASURY_T6_RID, 24000,
    restoreFixture, "");
  var restoreSave = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t6-e5-save",
    { destinationAccountCode: "1010", grossAmount: restoredOutstanding.outstanding }),
    treasuryT4Runtime_({ fixture: restoreFixture }));
  check("E5b", restoreReverse.status === "DONE" &&
    restoredOutstanding.outstanding === 24000 && restoreSave.status === "DONE",
    JSON.stringify({ reverse: restoreReverse, outstanding: restoredOutstanding,
      save: restoreSave }));
  var staleSave = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t6-e5-stale",
    { destinationAccountCode: "1010", grossAmount: 24000 }),
    treasuryT4Runtime_({ fixture: restoreFixture }));
  check("E5c", staleSave.status === "REFUSED" && staleSave.code === "TREASURY_ALREADY_CLEARED",
    JSON.stringify(staleSave));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Suite F — T5 integration: canonical statuses, 1030 reconciliation, as-of /
// cross-period reconstruction, and the full 24k chain — all through T5
// GENERIC semantics (zero T6 special-case in the projection).
// ---------------------------------------------------------------------------
function testTreasuryT6T5Integration() {
  var pass = 0;
  function check(id, value, detail) { treasuryT6Check_(id, value, detail); pass++; }
  var rid = TREASURY_T6_RID;
  function row(fixture, asOf) {
    return treasuryT5Row_(treasuryT5Projection_(fixture, asOf ? { asOfDate: asOf } : {}), rid);
  }
  function reconcile(fixture, asOf) {
    return treasuryT5Reconciliation_(fixture, asOf ? { asOfDate: asOf } : {});
  }
  // F1 status chain: Save -> CLEARED; Reversal -> UNCLEARED (outstanding
  // restored); post-reversal Save restore -> CLEARED at the new destination.
  // Zero quality codes, residual 0 at every stage.
  var chainFixture = treasuryT6SeededFixture_();
  var chainSeed = treasuryT6SeedReceipt_(chainFixture);
  var rowAfterSave = row(chainFixture);
  check("F1a", rowAfterSave.ClearingStatus === "CLEARED" &&
    rowAfterSave.OutstandingAmount === 0 && rowAfterSave.QualityCodes.length === 0,
    JSON.stringify(rowAfterSave));
  var chainReverse = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-f1-rev",
    chainSeed.receiptID), treasuryT6Runtime_({ fixture: chainFixture }));
  var rowAfterReverse = row(chainFixture);
  check("F1b", chainReverse.status === "DONE" &&
    rowAfterReverse.ClearingStatus === "UNCLEARED" &&
    rowAfterReverse.OutstandingAmount === 24000 && rowAfterReverse.ClearedAmount === 0 &&
    rowAfterReverse.ReversalAmount === 24000 && rowAfterReverse.QualityCodes.length === 0,
    JSON.stringify(rowAfterReverse));
  var chainSave = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t6-f1-save",
    { destinationAccountCode: "1010" }), treasuryT4Runtime_({ fixture: chainFixture }));
  var rowAfterRestore = row(chainFixture);
  check("F1c", chainSave.status === "DONE" &&
    rowAfterRestore.ClearingStatus === "CLEARED" &&
    rowAfterRestore.OutstandingAmount === 0 && rowAfterRestore.ClearedAmount === 24000 &&
    rowAfterRestore.DestinationAccountCode === "1010" &&
    rowAfterRestore.ActiveReceiptCount === 1 && rowAfterRestore.QualityCodes.length === 0,
    JSON.stringify(rowAfterRestore));
  var chainRecon = reconcile(chainFixture);
  check("F1d", chainRecon.unexplainedResidual === 0 &&
    chainRecon.reconciliationStatus === "OK" && chainRecon.outstandingTotal === 0,
    JSON.stringify(chainRecon));
  // F2 correction chain: CLEARED(1000) -> correction -> CLEARED(1010) with
  // the replacement as the active receipt; residual 0; T4/T5 parity.
  var corrFixture = treasuryT6SeededFixture_();
  var corrSeed = treasuryT6SeedReceipt_(corrFixture);
  var corrResult = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-f2-corr",
    corrSeed.receiptID), treasuryT6Runtime_({ fixture: corrFixture }));
  var corrRow = row(corrFixture);
  check("F2a", corrResult.status === "DONE" && corrRow.ClearingStatus === "CLEARED" &&
    corrRow.OutstandingAmount === 0 && corrRow.ClearedAmount === 24000 &&
    corrRow.ActiveReceiptCount === 1 && corrRow.ActiveReceiptID === corrResult.receiptID &&
    corrRow.DestinationAccountCode === "1010" && corrRow.QualityCodes.length === 0,
    JSON.stringify(corrRow));
  var corrRecon = reconcile(corrFixture);
  check("F2b", corrRecon.unexplainedResidual === 0 &&
    corrRecon.reconciliationStatus === "OK", JSON.stringify(corrRecon));
  var corrParity = treasuryComputeOutstanding_(rid, 24000, corrFixture, "");
  check("F2c", corrParity.outstanding === corrRow.OutstandingAmount &&
    corrParity.activeClearings === corrRow.ClearedAmount,
    JSON.stringify({ t4: corrParity, t5: corrRow }));
  // F3 as-of: sale day, receipt day, later reversal day — historical states
  // reconstructible through the same canonical reader.
  var asOfFixture = treasuryT6SeededFixture_();
  var asOfSeed = treasuryT6SeedReceipt_(asOfFixture);
  check("F3a", row(asOfFixture, "2026-10-11").ClearingStatus === "UNCLEARED" &&
    row(asOfFixture, "2026-10-11").OutstandingAmount === 24000);
  check("F3b", row(asOfFixture, "2026-10-12").ClearingStatus === "CLEARED");
  treasuryT6Reverse_(treasuryT6ReversePayload_("t6-f3-rev", asOfSeed.receiptID),
    treasuryT6Runtime_({ fixture: asOfFixture,
      now: function() { return new Date("2026-10-16T04:00:00.000Z"); } }));
  check("F3c", row(asOfFixture, "2026-10-15").ClearingStatus === "CLEARED" &&
    row(asOfFixture, "2026-10-16").ClearingStatus === "UNCLEARED" &&
    row(asOfFixture, "2026-10-16").OutstandingAmount === 24000,
    JSON.stringify({ at15: row(asOfFixture, "2026-10-15"), at16: row(asOfFixture, "2026-10-16") }));
  // F4 month-end before/after a Jakarta-boundary reversal (UTC 17:30 =>
  // Jakarta next day): month-end before shows CLEARED, after shows UNCLEARED.
  var monthFixture = treasuryT6SeededFixture_();
  var monthSeed = treasuryT6SeedReceipt_(monthFixture, "t6-f4-orig");
  var monthReverse = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-f4-rev",
    monthSeed.receiptID), treasuryT6Runtime_({ fixture: monthFixture,
      now: function() { return new Date("2026-10-31T17:30:00.000Z"); } }));
  var monthReversalRow = treasuryT6ReceiptById_(monthFixture, monthReverse.receiptID);
  check("F4a", monthReverse.status === "DONE" &&
    monthReversalRow.ReceiptDate === "2026-11-01" &&
    monthReversalRow.EconomicDate === "2026-11-01",
    JSON.stringify(monthReversalRow));
  check("F4b", row(monthFixture, "2026-10-31").ClearingStatus === "CLEARED" &&
    row(monthFixture, "2026-11-01").ClearingStatus === "UNCLEARED",
    JSON.stringify({ oct: row(monthFixture, "2026-10-31"), nov: row(monthFixture, "2026-11-01") }));
  check("F4c", reconcile(monthFixture, "2026-10-31").unexplainedResidual === 0 &&
    reconcile(monthFixture, "2026-11-01").unexplainedResidual === 0 &&
    reconcile(monthFixture, "2026-11-01").outstandingTotal === 24000);
  // F5 cross-period replacement: correction replacement dated next month;
  // as-of before the replacement date sees the reversal only.
  var crossFixture = treasuryT6SeededFixture_();
  var crossSeed = treasuryT6SeedReceipt_(crossFixture, "t6-f5-orig");
  var crossResult = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-f5-corr",
    crossSeed.receiptID, { receiptDate: "2026-11-05" }),
    treasuryT6Runtime_({ fixture: crossFixture,
      now: function() { return new Date("2026-10-31T10:00:00.000Z"); } }));
  check("F5a", crossResult.status === "DONE" &&
    treasuryT6ReceiptById_(crossFixture, crossResult.receiptID).ReceiptDate === "2026-11-05" &&
    treasuryT6ReceiptById_(crossFixture, crossResult.reversalReceiptID).ReceiptDate === "2026-10-31",
    JSON.stringify({ replacement: treasuryT6ReceiptById_(crossFixture, crossResult.receiptID),
      reversal: treasuryT6ReceiptById_(crossFixture, crossResult.reversalReceiptID) }));
  var crossAtOct = row(crossFixture, "2026-10-31");
  var crossAtNov = row(crossFixture, "2026-11-05");
  check("F5b", crossAtOct.ClearingStatus === "UNCLEARED" &&
    crossAtOct.OutstandingAmount === 24000 &&
    crossAtNov.ClearingStatus === "CLEARED" && crossAtNov.OutstandingAmount === 0,
    JSON.stringify({ oct: crossAtOct, nov: crossAtNov }));
  check("F5c", reconcile(crossFixture, "2026-10-31").unexplainedResidual === 0 &&
    reconcile(crossFixture, "2026-11-05").unexplainedResidual === 0);
  // F6 historical reconstruction after the full chain: as-of the receipt day
  // still shows the original CLEARED state.
  var historyRow = row(corrFixture, "2026-10-12");
  check("F6", historyRow.ClearingStatus === "CLEARED" &&
    historyRow.ActiveReceiptID === corrSeed.receiptID &&
    historyRow.DestinationAccountCode === "1000",
    JSON.stringify(historyRow));
  // F7 T4/T5 parity after a standalone reversal (outstanding restored).
  var parityRow = row(asOfFixture, "2026-10-16");
  var parityT4 = treasuryComputeOutstanding_(rid, 24000, asOfFixture, "");
  check("F7", parityT4.outstanding === parityRow.OutstandingAmount &&
    parityT4.activeClearings === parityRow.ClearedAmount,
    JSON.stringify({ t4: parityT4, t5: parityRow }));
  // F8 ledger net 1030 follows business outstanding at every stage.
  check("F8a", reconcile(asOfFixture, "2026-10-15").ledgerNet1030 === 0 &&
    reconcile(asOfFixture, "2026-10-16").ledgerNet1030 === 24000,
    JSON.stringify({ before: reconcile(asOfFixture, "2026-10-15"),
      after: reconcile(asOfFixture, "2026-10-16") }));
  check("F8b", reconcile(corrFixture).ledgerDr1030 === 48000 &&
    reconcile(corrFixture).ledgerCr1030 === 48000 &&
    reconcile(corrFixture).ledgerNet1030 === 0, JSON.stringify(reconcile(corrFixture)));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Suite G — Isolation: Revenue/Sales/Payment/Settlement/2010/AP/Inventory
// unchanged, no legacy writer reachable, no Sales mutation, no receipt-row
// update/delete primitive, financial non-impact on the ledger.
// ---------------------------------------------------------------------------
function testTreasuryT6Isolation() {
  var pass = 0;
  function check(id, value, detail) { treasuryT6Check_(id, value, detail); pass++; }
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES;
  var isolated = ["Orders", "OrderLines", "SalesRecognitionEvents",
    "SalesRecognitionAudits", "TransactionOperations", "Payments", "Settlements",
    "tabsal", "tabops", "InventoryLedger", "PurchaseEvents", "Accounts", "Products",
    "ProductPricing", "Logs"];
  // G1 rev x corr ordering: a correction of an already-reversed original is
  // refused (no reversal-of-reversal), isolation surfaces untouched.
  var fixture = treasuryT6SeededFixture_();
  var seed = treasuryT6SeedReceipt_(fixture);
  var revResult = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-iso-rev", seed.receiptID),
    treasuryT6Runtime_({ fixture: fixture }));
  var corrResult = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-iso-corr", seed.receiptID),
    treasuryT6Runtime_({ fixture: fixture }));
  check("G1", revResult.status === "DONE" && corrResult.status === "REFUSED" &&
    corrResult.code === codes.ALREADY_REVERSED);
  // G2 correction alone leaves every non-Treasury authority sheet identical.
  var fixture2 = treasuryT6SeededFixture_();
  var seed2 = treasuryT6SeedReceipt_(fixture2);
  var before2 = u3SheetSnapshot_(fixture2, isolated);
  var sumsBefore2 = treasuryT4AccountSums_(fixture2);
  var corrOnly = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-iso-c", seed2.receiptID),
    treasuryT6Runtime_({ fixture: fixture2 }));
  check("G2", corrOnly.status === "DONE" &&
    u3SheetSnapshot_(fixture2, isolated) === before2,
    "isolated sheet snapshot changed");
  // G3 reversal alone leaves every non-Treasury authority sheet identical.
  var revFixture = treasuryT6SeededFixture_();
  var revSeed = treasuryT6SeedReceipt_(revFixture);
  var revOnly = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-iso-r", revSeed.receiptID),
    treasuryT6Runtime_({ fixture: revFixture }));
  check("G3", revOnly.status === "DONE" &&
    u3SheetSnapshot_(revFixture, isolated) === before2,
    "isolated sheet snapshot changed under reversal");
  // G4 correction financial non-impact: 4000/5000/1100/6210/2010/2000/1500
  // unchanged; only destination (1010) + 1030 move by exactly X.
  var sumsAfter2 = treasuryT4AccountSums_(fixture2);
  function unchanged(code) {
    var a = sumsBefore2[code] || { debit: 0, credit: 0 };
    var b = sumsAfter2[code] || { debit: 0, credit: 0 };
    return a.debit === b.debit && a.credit === b.credit;
  }
  check("G4", ["4000", "5000", "1100", "6210", "2010", "2000", "1500"].every(unchanged) &&
    sumsAfter2["1030"].debit === sumsBefore2["1030"].debit + 24000 &&
    sumsAfter2["1030"].credit === sumsBefore2["1030"].credit + 24000 &&
    sumsAfter2["1010"].debit === 24000,
    JSON.stringify({ before: sumsBefore2, after: sumsAfter2 }));
  // G5 reversal non-impact: Revenue/expense/2010/2000 untouched; only 1030
  // and the original destination move.
  var sumsAfterRev = treasuryT4AccountSums_(revFixture);
  check("G5", ["4000", "5000", "1100", "6210", "2010", "2000"].every(function(code) {
    var a = sumsBefore2[code] || { debit: 0, credit: 0 };
    var b = sumsAfterRev[code] || { debit: 0, credit: 0 };
    return a.debit === b.debit && a.credit === b.credit;
  }) && sumsAfterRev["1030"].debit === sumsBefore2["1030"].debit + 24000 &&
    sumsAfterRev["1000"].credit === 24000, JSON.stringify(sumsAfterRev));
  // G6 non-Treasury ledger rows untouched (Sales SRV2J recognition journal).
  var nonTreasury = treasuryT4LedgerRows_(revFixture).filter(function(row) {
    return String(row.SourceType) !== "TREASURY_RECEIPT_V1";
  });
  check("G6", nonTreasury.length === 2 && nonTreasury.every(function(row) {
    return String(row.MovementType) === "SALES_RECOGNITION";
  }));
  // Source/call-graph audit of the lifecycle module.
  var source = typeof _treasuryLifecycleSource === "string" ?
    _treasuryLifecycleSource : "";
  check("G7", source.length > 0, "source injection missing");
  var forbidden = ["cashSettleAndPersist", "attemptCashSettlement", "runCashSettleAndPersist",
    "ReceiveVia", "PaymentMethod", "canonicalDateKey(", "appendRow(", "getUuid",
    "UrlFetchApp", "clasp", "Payments", "Settlements", "tabsal", "tabops", "settlement",
    "setValue(", "deleteRange", "deleteRow", "createSheet", "insertSheet",
    "REFUND", "2010", "getMonth(", "getDate("];
  forbidden.forEach(function(token, index) {
    check("G8." + index, source.indexOf(token) === -1, "forbidden token: " + token);
  });
  var required = ["waitLock(30000)", "releaseLock", "treasuryDateKey(",
    "treasuryJournalSignature(", "treasuryReceiptFrozenContext_(",
    "treasuryReceiptCommit_", "transactionPayloadHash_", "invalidateDashboardCache",
    "treasuryReceiptBatchRequest_", "TREASURY_RECEIPT_REVERSE",
    "TREASURY_RECEIPT_CORRECT", "TREASURY_ALREADY_REVERSED", "TREASURY_REASON_REQUIRED",
    "TREASURY_ORIGINAL_IMMUTABLE", "IN_PROGRESS", "COMMITTED",
    "treasuryResolveExposure_", "treasuryComputeOutstanding_"];
  required.forEach(function(token, index) {
    check("G9." + index, source.indexOf(token) !== -1, "required token: " + token);
  });
  // G10 the durable mutation primitive is the ONE batch append + the
  // operation-row intent; no receipt-row update/delete path exists.
  check("G10", source.indexOf("treasuryOperationAppend_") !== -1 &&
    source.indexOf("treasuryReceiptBatchRequest_") !== -1 &&
    source.indexOf("deleteRange") === -1 && source.indexOf("setValue(") === -1);
  // G11 Sales Void/Correct never auto-mutates Treasury: no Sales writer
  // symbol is referenced (Sales artifacts stay byte-identical per G1-G3).
  check("G11", source.indexOf("salesRecognitionV2Save") === -1 &&
    source.indexOf("salesV2Correct") === -1 && source.indexOf("salesV2Void") === -1 &&
    source.indexOf("u3ReversalAppend_") === -1);
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// Suite H — Failure paths: normalization refusals, mode/config/schema gates,
// cache discipline. Every refusal writes zero and never touches the cache.
// ---------------------------------------------------------------------------
function testTreasuryT6FailurePaths() {
  var pass = 0;
  function check(id, value, detail) { treasuryT6Check_(id, value, detail); pass++; }
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  function assertRefused(id, invoke, runtime, statusCode) {
    var fixture = runtime.spreadsheet;
    var before = JSON.stringify(treasuryT4RowCounts_(fixture));
    var result = invoke();
    check(id + "a", result.status === "REFUSED" && result.code === statusCode,
      JSON.stringify(result));
    check(id + "b", result.writeCount === 0 && runtime.events.batches.length === 0 &&
      runtime.events.cacheCalls === 0 && runtime.events.appliedRows === 0 &&
      JSON.stringify(treasuryT4RowCounts_(fixture)) === before);
    return result;
  }
  var fixture = treasuryT6SeededFixture_();
  var seed = treasuryT6SeedReceipt_(fixture);
  var target = seed.receiptID;
  // H1-H6 reverse normalization refusals.
  var rtH1 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H1", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("ab", target), rtH1);
  }, rtH1, codes.PAYLOAD_INVALID);
  var rtH2 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H2", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h2", "NOT-A-TRC-ID"), rtH2);
  }, rtH2, codes.PAYLOAD_INVALID);
  var rtH3 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H3", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h3", target, { reason: "ab" }),
      rtH3);
  }, rtH3, codes.REASON_REQUIRED);
  var rtH4 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H4", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h4", target,
      { reason: "my password=abc" }), rtH4);
  }, rtH4, codes.REASON_REQUIRED);
  var rtH5 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H5", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h5", target,
      { reason: "card 4111111111111111 charged" }), rtH5);
  }, rtH5, codes.REASON_REQUIRED);
  var rtH6 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H6", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h6", target,
      { reason: "line\nbreak" }), rtH6);
  }, rtH6, codes.REASON_REQUIRED);
  // H7-H10 correction normalization refusals.
  var rtH7 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H7", function() {
    return treasuryT6Correct_(treasuryT6CorrectPayload_("t6-h7", target,
      { receiptDate: "2026-02-30" }), rtH7);
  }, rtH7, codes.DATE_INVALID);
  var rtH8 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H8", function() {
    return treasuryT6Correct_(treasuryT6CorrectPayload_("t6-h8", target,
      { evidenceType: "BANK_STATEMENT" }), rtH8);
  }, rtH8, codes.EVIDENCE_TYPE_INVALID);
  var rtH9 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H9", function() {
    return treasuryT6Correct_(treasuryT6CorrectPayload_("t6-h9", target,
      { evidenceRef: "ab" }), rtH9);
  }, rtH9, codes.EVIDENCE_REF_INVALID);
  var rtH10 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H10", function() {
    return treasuryT6Correct_(treasuryT6CorrectPayload_("t6-h10", target,
      { destinationAccountCode: "" }), rtH10);
  }, rtH10, codes.PAYLOAD_INVALID);
  // H11 config gate: contract-version mismatch refuses.
  var rtH11 = treasuryT6Runtime_({ fixture: fixture,
    config: Object.assign(treasuryT4ActiveConfig_(),
      { contractVersion: "SALES_RECOGNITION_V2" }) });
  assertRefused("H11", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h11", target), rtH11);
  }, rtH11, codes.CONTRACT_VERSION_MISMATCH);
  // H12/H13 schema gate: renamed Treasury column refuses both kinds.
  var schemaFixture = treasuryT6SeededFixture_();
  var schemaSeed = treasuryT6SeedReceipt_(schemaFixture);
  schemaFixture.getSheetByName("TreasuryReceipts").values[0][9] = "AmountRenamed";
  var rtH12 = treasuryT6Runtime_({ fixture: schemaFixture });
  assertRefused("H12", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h12", schemaSeed.receiptID), rtH12);
  }, rtH12, codes.SCHEMA_NOT_READY);
  var rtH13 = treasuryT6Runtime_({ fixture: schemaFixture });
  assertRefused("H13", function() {
    return treasuryT6Correct_(treasuryT6CorrectPayload_("t6-h13", schemaSeed.receiptID),
      rtH13);
  }, rtH13, codes.SCHEMA_NOT_READY);
  // H14-H16 target refusals: not found / not a receipt / already reversed.
  var rtH14 = treasuryT6Runtime_({ fixture: fixture });
  assertRefused("H14", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h14", "TRC-ABSENT-0001"), rtH14);
  }, rtH14, codes.TARGET_NOT_FOUND);
  var revFixture = treasuryT6SeededFixture_();
  var revSeed = treasuryT6SeedReceipt_(revFixture);
  var revDone = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h15a", revSeed.receiptID),
    treasuryT6Runtime_({ fixture: revFixture }));
  var rtH15 = treasuryT6Runtime_({ fixture: revFixture });
  assertRefused("H15", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h15b", revDone.receiptID), rtH15);
  }, rtH15, codes.TARGET_NOT_RECEIPT);
  var rtH16 = treasuryT6Runtime_({ fixture: revFixture });
  assertRefused("H16", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h16", revSeed.receiptID), rtH16);
  }, rtH16, codes.ALREADY_REVERSED);
  // H17 Sales-voided exposure refuses (RECOGNITION_INACTIVE).
  var voidFixture = treasuryT6SeededFixture_();
  var voidSeed = treasuryT6SeedReceipt_(voidFixture);
  u3ReversalAppend_(voidFixture, { RecognitionID: TREASURY_T6_RID, OrderID: "ORD-T4-1",
    Amount: 24000, ActivationID: "ACT-U2" }, { date: "2026-10-14",
    recognizedAt: "2026-10-14T03:00:00.000Z", targetRecognitionID: TREASURY_T6_RID });
  var rtH17 = treasuryT6Runtime_({ fixture: voidFixture });
  assertRefused("H17", function() {
    return treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h17", voidSeed.receiptID), rtH17);
  }, rtH17, codes.RECOGNITION_INACTIVE);
  // H18 cache discipline across outcome classes.
  var cacheFixture = treasuryT6SeededFixture_();
  var cacheSeed = treasuryT6SeedReceipt_(cacheFixture);
  var freshRuntime = treasuryT6Runtime_({ fixture: cacheFixture });
  var fresh = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h18a", cacheSeed.receiptID),
    freshRuntime);
  check("H18a", fresh.status === "DONE" && freshRuntime.events.cacheCalls === 1);
  var refusedRuntime = treasuryT6Runtime_({ fixture: cacheFixture });
  var refused = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h18b", cacheSeed.receiptID),
    refusedRuntime);
  check("H18b", refused.status === "REFUSED" && refusedRuntime.events.cacheCalls === 0);
  var conflictRuntime = treasuryT6Runtime_({ fixture: cacheFixture });
  var conflict = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h18a", cacheSeed.receiptID,
    { reason: "CHANGED REASON" }), conflictRuntime);
  check("H18c", conflict.status === "CONFLICT" && conflictRuntime.events.cacheCalls === 0);
  var unknownFixture = treasuryT6SeededFixture_();
  var unknownSeed = treasuryT6SeedReceipt_(unknownFixture);
  var unknownRuntime = treasuryT6Runtime_({ fixture: unknownFixture });
  var unknownEvents = unknownRuntime.events;
  unknownRuntime.batch = function(ranges) {
    unknownEvents.batches.push(ranges);
    throw new Error("ETIMEDOUT");
  };
  var unknown = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h18d",
    unknownSeed.receiptID), unknownRuntime);
  check("H18d", unknown.status === "UNKNOWN" && unknown.status !== "DONE" &&
    unknownRuntime.events.cacheCalls === 0, JSON.stringify(unknown));
  var replayRuntime = treasuryT6Runtime_({ fixture: cacheFixture });
  var replay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h18a", cacheSeed.receiptID),
    replayRuntime);
  check("H18e", replay.status === "DONE" && replay.replay === true &&
    replayRuntime.events.cacheCalls === 1 && replayRuntime.events.appliedRows === 0);
  var recoveryRuntime = treasuryT6Runtime_({ fixture: cacheFixture });
  recoveryRuntime.spreadsheet.getSheetByName("TreasuryReceipts").values[2]
    [contract.SCHEMAS.RECEIPTS.HEADERS.indexOf("GrossAmount")] = 1;
  var recovery = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-h18a", cacheSeed.receiptID),
    recoveryRuntime);
  check("H18f", recovery.status === "RECOVERY_REQUIRED" &&
    recoveryRuntime.events.cacheCalls === 0, JSON.stringify(recovery));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Suite M — 30-point mutation sensitivity: every listed defect class is
// caught by a behavioral assertion and/or a source invariant. All fixture
// tampering is in-memory and local to the test; no mutation is left in any
// source file.
// ---------------------------------------------------------------------------
function testTreasuryT6MutationSensitivity() {
  var pass = 0;
  function check(id, value, detail) { treasuryT6Check_(id, value, detail); pass++; }
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  var source = typeof _treasuryLifecycleSource === "string" ?
    _treasuryLifecycleSource : "";

  // M1 mutate original after DONE => replay fails ORIGINAL_IMMUTABLE.
  var m1Fixture = treasuryT6SeededFixture_();
  var m1Seed = treasuryT6SeedReceipt_(m1Fixture);
  var m1First = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m1", m1Seed.receiptID),
    treasuryT6Runtime_({ fixture: m1Fixture }));
  var m1Receipts = m1Fixture.getSheetByName("TreasuryReceipts");
  m1Receipts.values[1][contract.SCHEMAS.RECEIPTS.HEADERS.indexOf("GrossAmount")] = 1;
  var m1Replay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m1", m1Seed.receiptID),
    treasuryT6Runtime_({ fixture: m1Fixture }));
  check("M1", m1First.status === "DONE" && m1Replay.status === "RECOVERY_REQUIRED" &&
    m1Replay.code === codes.ORIGINAL_IMMUTABLE &&
    String(m1Replay.detail).indexOf("ORIGINAL_IMMUTABLE") !== -1, JSON.stringify(m1Replay));
  // M2 delete original => replay fails closed, never blind-appends.
  var m2Fixture = treasuryT6SeededFixture_();
  var m2Seed = treasuryT6SeedReceipt_(m2Fixture);
  treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m2", m2Seed.receiptID),
    treasuryT6Runtime_({ fixture: m2Fixture }));
  m2Fixture.getSheetByName("TreasuryReceipts").values.splice(1, 1);
  var m2Counts = JSON.stringify(treasuryT4RowCounts_(m2Fixture));
  var m2Replay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m2", m2Seed.receiptID),
    treasuryT6Runtime_({ fixture: m2Fixture }));
  check("M2", m2Replay.status === "RECOVERY_REQUIRED" &&
    String(m2Replay.detail).indexOf("ORIGINAL_TARGET_MISSING") !== -1 &&
    JSON.stringify(treasuryT4RowCounts_(m2Fixture)) === m2Counts, JSON.stringify(m2Replay));
  // M3 reversal uses the ORIGINAL direction (Dr 1030 / Cr destination): line
  // -1 is the 1030 debit leg; swapped legs fail the plan verifier.
  var m3Fixture = treasuryT6SeededFixture_();
  var m3Seed = treasuryT6SeedReceipt_(m3Fixture);
  var m3Result = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m3", m3Seed.receiptID),
    treasuryT6Runtime_({ fixture: m3Fixture }));
  var m3Journal = treasuryT6LedgerBySource_(m3Fixture, m3Result.receiptID);
  check("M3a", m3Journal[0].LineID === m3Result.journalID + "-1" &&
    m3Journal[0].AccountCode === "1030" && Number(m3Journal[0].Debit) === 24000 &&
    m3Journal[1].AccountCode === "1000" && Number(m3Journal[1].Credit) === 24000);
  var m3Op = treasuryT6OpByTypeKey_(m3Fixture, life.REVERSE.OPERATION_TYPE, "t6-m3");
  var m3Plan = JSON.parse(m3Op.OperationPlan);
  m3Plan.journalRows[0].AccountCode = "1000";
  m3Plan.journalRows[1].AccountCode = "1030";
  var m3Verdict = treasuryLifecycleVerifyPlan_(m3Plan);
  check("M3b", m3Verdict.ok === false &&
    m3Verdict.reason === "JOURNAL_ACCOUNT_MAPPING_MISMATCH", JSON.stringify(m3Verdict));
  // M4 reversal touches 4000 => plan verifier + persisted-row replay catch it.
  var m4Plan = JSON.parse(treasuryT6OpByTypeKey_(m3Fixture, life.REVERSE.OPERATION_TYPE,
    "t6-m3").OperationPlan);
  m4Plan.journalRows[0].AccountCode = "4000";
  var m4Verdict = treasuryLifecycleVerifyPlan_(m4Plan);
  check("M4a", m4Verdict.ok === false, JSON.stringify(m4Verdict));
  var m4Fixture = treasuryT6SeededFixture_();
  var m4Seed = treasuryT6SeedReceipt_(m4Fixture);
  treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m4", m4Seed.receiptID),
    treasuryT6Runtime_({ fixture: m4Fixture }));
  var m4Ledger = m4Fixture.getSheetByName("BalanceLedger");
  m4Ledger.values[m4Ledger.getLastRow() - 1]
    [BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf("AccountCode")] = "4000";
  var m4Replay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m4", m4Seed.receiptID),
    treasuryT6Runtime_({ fixture: m4Fixture }));
  check("M4b", m4Replay.status === "RECOVERY_REQUIRED" &&
    String(m4Replay.detail).indexOf("JOURNAL_TAMPERED") !== -1, JSON.stringify(m4Replay));
  // M5 reversal touches 2010 => same fail-closed class, never a refund path.
  var m5Plan = JSON.parse(treasuryT6OpByTypeKey_(m3Fixture, life.REVERSE.OPERATION_TYPE,
    "t6-m3").OperationPlan);
  m5Plan.journalRows[1].AccountCode = "2010";
  var m5Verdict = treasuryLifecycleVerifyPlan_(m5Plan);
  check("M5", m5Verdict.ok === false, JSON.stringify(m5Verdict));
  // M6 double reversal: new key refused, exactly one reversal row exists.
  var m6Fixture = treasuryT6SeededFixture_();
  var m6Seed = treasuryT6SeedReceipt_(m6Fixture);
  treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m6a", m6Seed.receiptID),
    treasuryT6Runtime_({ fixture: m6Fixture }));
  var m6Second = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m6b", m6Seed.receiptID),
    treasuryT6Runtime_({ fixture: m6Fixture }));
  check("M6", m6Second.status === "REFUSED" && m6Second.code === codes.ALREADY_REVERSED &&
    treasuryT6Receipts_(m6Fixture).filter(function(row) {
      return String(row.ReversalOfReceiptID) === m6Seed.receiptID;
    }).length === 1);
  // M7 correction never mutates in place: original bytes identical, module
  // has no receipt-row update/delete primitive.
  var m7Fixture = treasuryT6SeededFixture_();
  var m7Seed = treasuryT6SeedReceipt_(m7Fixture);
  var m7Bytes = treasuryT6OriginalBytes_(m7Fixture, m7Seed.receiptID);
  var m7Result = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-m7", m7Seed.receiptID),
    treasuryT6Runtime_({ fixture: m7Fixture }));
  check("M7", m7Result.status === "DONE" &&
    treasuryT6OriginalBytes_(m7Fixture, m7Seed.receiptID) === m7Bytes &&
    source.indexOf("deleteRange") === -1 && source.indexOf("setValue(") === -1);
  // M8 replacement-without-reversal: shaped-down CORRECT plan is malformed.
  var m8Op = treasuryT6OpByTypeKey_(m7Fixture, life.CORRECT.OPERATION_TYPE, "t6-m7");
  var m8Plan = JSON.parse(m8Op.OperationPlan);
  m8Plan.receiptRows = [m8Plan.receiptRows[1]];
  m8Plan.journalRows = m8Plan.journalRows.slice(2);
  delete m8Plan.planDigest;
  m8Plan.planDigest = transactionPayloadHash_(m8Plan);
  var m8Verdict = treasuryLifecycleVerifyPlan_(m8Plan);
  check("M8", m8Verdict.ok === false && m8Verdict.reason === "CORRECT_SHAPE_MISMATCH",
    JSON.stringify(m8Verdict));
  // M9 non-atomic correction impossible: ONE batch, three surfaces, 7 rows.
  var m9Fixture = treasuryT6SeededFixture_();
  var m9Seed = treasuryT6SeedReceipt_(m9Fixture);
  var m9Runtime = treasuryT6Runtime_({ fixture: m9Fixture });
  var m9Result = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-m9", m9Seed.receiptID),
    m9Runtime);
  check("M9", m9Result.status === "DONE" && m9Runtime.events.batches.length === 1 &&
    m9Runtime.events.batches[0].length === 3 && m9Runtime.events.appliedRows === 7 &&
    m9Runtime.events.batches[0].map(function(range) { return range.range; }).join(",") ===
      life.WRITE_SURFACES.join(","));
  // M10 partial correction fails closed and never appends on replay.
  var m10Fixture = treasuryT6SeededFixture_();
  var m10Seed = treasuryT6SeedReceipt_(m10Fixture);
  var m10Runtime = treasuryT6Runtime_({ fixture: m10Fixture });
  m10Runtime.batch = function(ranges) {
    m10Runtime.events.batches.push(ranges);
    var range = ranges[0];
    var sheet = m10Fixture.getSheetByName(range.range);
    sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length, range.values[0].length)
      .setValues(range.values);
    throw new Error("SIMULATED_PARTIAL_APPLY");
  };
  var m10Result = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-m10", m10Seed.receiptID),
    m10Runtime);
  var m10Counts = JSON.stringify(treasuryT4RowCounts_(m10Fixture));
  var m10Replay = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-m10", m10Seed.receiptID),
    treasuryT6Runtime_({ fixture: m10Fixture }));
  check("M10", m10Result.status === "RECOVERY_REQUIRED" &&
    m10Replay.status === "RECOVERY_REQUIRED" &&
    JSON.stringify(treasuryT4RowCounts_(m10Fixture)) === m10Counts,
    JSON.stringify({ first: m10Result, replay: m10Replay }));
  // M11 late RequestKey: changed payload under the same key => CONFLICT.
  var m11Conflict = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m1", m1Seed.receiptID,
    { reason: "LATE CHANGE" }), treasuryT6Runtime_({ fixture: m1Fixture }));
  check("M11", m11Conflict.status === "CONFLICT" &&
    m11Conflict.code === codes.REQUEST_KEY_CONFLICT && m11Conflict.writeCount === 0);
  // M12 PAUSED must not permit NEW lifecycle writes.
  var m12Runtime = treasuryT6Runtime_({ fixture: m1Fixture,
    config: Object.assign(treasuryT4ActiveConfig_(), { mode: "PAUSED" }) });
  var m12 = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m12", m1Seed.receiptID),
    m12Runtime);
  check("M12", m12.status === "REFUSED" && m12.code === codes.MODE_PAUSED &&
    m12.writeCount === 0);
  // M13 recovery must NOT be blocked under PAUSED.
  var m13Fixture = treasuryT6SeededFixture_();
  var m13Seed = treasuryT6SeedReceipt_(m13Fixture);
  var m13Threw = null;
  try {
    treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m13", m13Seed.receiptID),
      treasuryT6Runtime_({ fixture: m13Fixture, crash: "T6_AFTER_INTENT" }));
  } catch (error) { m13Threw = error; }
  var m13Recovery = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m13", m13Seed.receiptID),
    treasuryT6Runtime_({ fixture: m13Fixture,
      config: Object.assign(treasuryT4ActiveConfig_(), { mode: "PAUSED" }) }));
  check("M13", !!m13Threw && m13Recovery.status === "DONE" &&
    m13Recovery.writeCount === life.REVERSE.FRESH_WRITE_COUNT, JSON.stringify(m13Recovery));
  // M14 no ScriptLock removal: exactly two lock sites (the two wrappers); the
  // cores never lock.
  var coreSource = treasuryLifecycleReverseWithRuntime_.toString() +
    treasuryLifecycleCorrectWithRuntime_.toString() +
    treasuryLifecycleNewIntent_.toString() + treasuryLifecycleResume_.toString() +
    treasuryLifecycleApplyBatch_.toString();
  check("M14", (source.match(/waitLock/g) || []).length === 2 &&
    coreSource.indexOf("waitLock") === -1 && coreSource.indexOf("releaseLock") === -1 &&
    treasuryReceiptDurableReverse.toString().indexOf("finally") !== -1 &&
    treasuryReceiptDurableCorrect.toString().indexOf("finally") !== -1);
  // M15 stale claim scan: an advisory "no claim" pre-read cannot authorize a
  // second owner — the in-lock scan refuses the loser.
  var m15Fixture = treasuryT6SeededFixture_();
  var m15Seed = treasuryT6SeedReceipt_(m15Fixture);
  var m15Advisory = treasuryT6Receipts_(m15Fixture).filter(function(row) {
    return String(row.ReversalOfReceiptID) === m15Seed.receiptID;
  });
  check("M15a", m15Advisory.length === 0);
  var m15Threw = null;
  try {
    treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m15-owner", m15Seed.receiptID),
      treasuryT6Runtime_({ fixture: m15Fixture, crash: "T6_AFTER_INTENT" }));
  } catch (error) { m15Threw = error; }
  var m15Loser = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m15-lose",
    m15Seed.receiptID), treasuryT6Runtime_({ fixture: m15Fixture }));
  check("M15b", !!m15Threw && m15Loser.status === "REFUSED" &&
    m15Loser.code === codes.REVERSAL_TARGET_CLAIMED, JSON.stringify(m15Loser));
  // M16 concurrent both-succeed impossible: exactly one owner per lineage.
  var m16Fixture = treasuryT6SeededFixture_();
  var m16Seed = treasuryT6SeedReceipt_(m16Fixture);
  var m16a = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m16a", m16Seed.receiptID),
    treasuryT6Runtime_({ fixture: m16Fixture }));
  var m16b = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m16b", m16Seed.receiptID),
    treasuryT6Runtime_({ fixture: m16Fixture }));
  check("M16", m16a.status === "DONE" && m16b.status === "REFUSED" &&
    m16b.writeCount === 0);
  // M17 skip journal readback: a deleted reversal ledger line fails replay.
  var m17Fixture = treasuryT6SeededFixture_();
  var m17Seed = treasuryT6SeedReceipt_(m17Fixture);
  var m17First = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m17", m17Seed.receiptID),
    treasuryT6Runtime_({ fixture: m17Fixture }));
  m17Fixture.getSheetByName("BalanceLedger").values.splice(5, 1);
  var m17Replay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m17", m17Seed.receiptID),
    treasuryT6Runtime_({ fixture: m17Fixture }));
  check("M17", m17First.status === "DONE" && m17Replay.status === "RECOVERY_REQUIRED" &&
    m17Replay.code === codes.ARTIFACTS_INCOMPLETE, JSON.stringify(m17Replay));
  // M18 reuse the original signature on the reversal row => caught by the
  // dedicated recomputation step.
  var m18Fixture = treasuryT6SeededFixture_();
  var m18Seed = treasuryT6SeedReceipt_(m18Fixture);
  var m18First = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m18", m18Seed.receiptID),
    treasuryT6Runtime_({ fixture: m18Fixture }));
  var m18Receipts = m18Fixture.getSheetByName("TreasuryReceipts");
  var m18Original = treasuryT6ReceiptById_(m18Fixture, m18Seed.receiptID);
  m18Receipts.values[2][contract.SCHEMAS.RECEIPTS.HEADERS.indexOf("JournalSignature")] =
    m18Original.JournalSignature;
  var m18Replay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m18", m18Seed.receiptID),
    treasuryT6Runtime_({ fixture: m18Fixture }));
  check("M18", m18First.status === "DONE" && m18Replay.status === "RECOVERY_REQUIRED" &&
    m18Replay.code === codes.JOURNAL_SIGNATURE_INVALID, JSON.stringify(m18Replay));
  // M19 skip audit verification: tampered audit row fails replay.
  var m19Fixture = treasuryT6SeededFixture_();
  var m19Seed = treasuryT6SeedReceipt_(m19Fixture);
  treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m19", m19Seed.receiptID),
    treasuryT6Runtime_({ fixture: m19Fixture }));
  m19Fixture.getSheetByName("TreasuryAudits").values[2]
    [contract.SCHEMAS.AUDITS.HEADERS.indexOf("PayloadHash")] = "FORGED-HASH";
  var m19Replay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m19", m19Seed.receiptID),
    treasuryT6Runtime_({ fixture: m19Fixture }));
  check("M19", m19Replay.status === "RECOVERY_REQUIRED" &&
    String(m19Replay.detail).indexOf("AUDIT_TAMPERED") !== -1, JSON.stringify(m19Replay));
  // M20 DONE before COMMITTED impossible: the commit transition precedes the
  // DONE return, and DONE implies a COMMITTED operation row.
  var m20Fixture = treasuryT6SeededFixture_();
  var m20Seed = treasuryT6SeedReceipt_(m20Fixture);
  var m20Result = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m20", m20Seed.receiptID),
    treasuryT6Runtime_({ fixture: m20Fixture }));
  var m20Source = treasuryLifecycleApplyBatch_.toString();
  check("M20", m20Result.status === "DONE" &&
    treasuryT6OpByTypeKey_(m20Fixture, life.REVERSE.OPERATION_TYPE, "t6-m20").State ===
      "COMMITTED" &&
    m20Source.indexOf('runtime.crash("T6_BEFORE_COMMIT")') <
      m20Source.indexOf("treasuryReceiptCommit_") &&
    m20Source.indexOf("return outcome(life.STATUS.DONE") >
      m20Source.indexOf("treasuryReceiptCommit_"));
  // M21 callback-loss duplicates reversal impossible: COMMITTED replay
  // appends zero rows.
  var m21Counts = JSON.stringify(treasuryT4RowCounts_(m20Fixture));
  var m21Runtime = treasuryT6Runtime_({ fixture: m20Fixture });
  var m21Replay = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m20", m20Seed.receiptID),
    m21Runtime);
  check("M21", m21Replay.status === "DONE" && m21Replay.replay === true &&
    m21Replay.writeCount === 0 && m21Runtime.events.appliedRows === 0 &&
    JSON.stringify(treasuryT4RowCounts_(m20Fixture)) === m21Counts);
  // M22 callback-loss duplicates replacement impossible: correction replay
  // appends zero rows.
  var m22Fixture = treasuryT6SeededFixture_();
  var m22Seed = treasuryT6SeedReceipt_(m22Fixture);
  var m22First = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-m22", m22Seed.receiptID),
    treasuryT6Runtime_({ fixture: m22Fixture }));
  var m22Counts = JSON.stringify(treasuryT4RowCounts_(m22Fixture));
  var m22Runtime = treasuryT6Runtime_({ fixture: m22Fixture });
  var m22Replay = treasuryT6Correct_(treasuryT6CorrectPayload_("t6-m22", m22Seed.receiptID),
    m22Runtime);
  check("M22", m22First.status === "DONE" && m22Replay.status === "DONE" &&
    m22Replay.replay === true && m22Replay.writeCount === 0 &&
    m22Runtime.events.appliedRows === 0 &&
    JSON.stringify(treasuryT4RowCounts_(m22Fixture)) === m22Counts);
  // M23 T5 must NOT stay CLEARED after a reversal: status flips UNCLEARED.
  var m23Row = treasuryT5Row_(treasuryT5Projection_(m20Fixture, {}), TREASURY_T6_RID);
  check("M23", m23Row.ClearingStatus === "UNCLEARED" &&
    m23Row.OutstandingAmount === 24000 && m23Row.QualityCodes.length === 0,
    JSON.stringify(m23Row));
  // M24 correction must NOT leave UNCLEARED: status CLEARED with replacement.
  var m24Row = treasuryT5Row_(treasuryT5Projection_(m22Fixture, {}), TREASURY_T6_RID);
  check("M24", m24Row.ClearingStatus === "CLEARED" && m24Row.OutstandingAmount === 0 &&
    m24Row.ActiveReceiptID === m22First.receiptID && m24Row.QualityCodes.length === 0,
    JSON.stringify(m24Row));
  // M25 residual must not be hidden: reconciliation OK / residual 0 after
  // both operations.
  var m25Recon = treasuryT5Reconciliation_(m22Fixture, {});
  check("M25", m25Recon.unexplainedResidual === 0 &&
    m25Recon.reconciliationStatus === "OK", JSON.stringify(m25Recon));
  // M26 host-local date impossible: the reversal day is the Asia/Jakarta
  // business day even at the UTC boundary; no host-local helpers exist.
  var m26Fixture = treasuryT6SeededFixture_();
  var m26Seed = treasuryT6SeedReceipt_(m26Fixture);
  var m26Result = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m26", m26Seed.receiptID),
    treasuryT6Runtime_({ fixture: m26Fixture,
      now: function() { return new Date("2026-10-11T17:30:00.000Z"); } }));
  var m26Row = treasuryT6ReceiptById_(m26Fixture, m26Result.receiptID);
  check("M26", m26Result.status === "DONE" && m26Row.ReceiptDate === "2026-10-12" &&
    m26Row.ReceiptDate !== "2026-10-11" && m26Row.EconomicDate === "2026-10-12" &&
    source.indexOf("canonicalDateKey(") === -1 && source.indexOf("getMonth(") === -1 &&
    source.indexOf("getDate(") === -1, JSON.stringify(m26Row));
  // M27 original date rewritten impossible: original row bytes identical
  // across reversal and correction chains.
  var m27Fixture = treasuryT6SeededFixture_();
  var m27Seed = treasuryT6SeedReceipt_(m27Fixture);
  var m27Bytes = treasuryT6OriginalBytes_(m27Fixture, m27Seed.receiptID);
  treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m27r", m27Seed.receiptID),
    treasuryT6Runtime_({ fixture: m27Fixture }));
  var m27AfterReverse = treasuryT6OriginalBytes_(m27Fixture, m27Seed.receiptID);
  var m27CorrFixture = treasuryT6SeededFixture_();
  var m27CorrSeed = treasuryT6SeedReceipt_(m27CorrFixture);
  var m27CorrBytes = treasuryT6OriginalBytes_(m27CorrFixture, m27CorrSeed.receiptID);
  treasuryT6Correct_(treasuryT6CorrectPayload_("t6-m27c", m27CorrSeed.receiptID,
    { receiptDate: "2027-01-15" }), treasuryT6Runtime_({ fixture: m27CorrFixture }));
  check("M27", m27AfterReverse === m27Bytes &&
    treasuryT6OriginalBytes_(m27CorrFixture, m27CorrSeed.receiptID) === m27CorrBytes);
  // M28 Sales Void never auto-mutates Treasury: Sales artifacts stay
  // byte-identical across lifecycle operations; no Sales writer symbol.
  var m28Fixture = treasuryT6SeededFixture_();
  var m28Seed = treasuryT6SeedReceipt_(m28Fixture);
  var m28SalesBefore = u3SheetSnapshot_(m28Fixture, ["SalesRecognitionEvents",
    "SalesRecognitionAudits", "Orders", "OrderLines", "TransactionOperations"]);
  treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m28r", m28Seed.receiptID),
    treasuryT6Runtime_({ fixture: m28Fixture }));
  var m28CorrFixture = treasuryT6SeededFixture_();
  var m28CorrSeed = treasuryT6SeedReceipt_(m28CorrFixture);
  treasuryT6Correct_(treasuryT6CorrectPayload_("t6-m28c", m28CorrSeed.receiptID),
    treasuryT6Runtime_({ fixture: m28CorrFixture }));
  check("M28", u3SheetSnapshot_(m28Fixture, ["SalesRecognitionEvents",
    "SalesRecognitionAudits", "Orders", "OrderLines", "TransactionOperations"]) ===
      m28SalesBefore &&
    u3SheetSnapshot_(m28CorrFixture, ["SalesRecognitionEvents",
      "SalesRecognitionAudits", "Orders", "OrderLines", "TransactionOperations"]) ===
      m28SalesBefore &&
    source.indexOf("salesRecognitionV2Save") === -1);
  // M29 reversal auto-refund impossible: journals touch only {destination,
  // 1030}; no 2010/refund/credit-transfer vocabulary exists in the module.
  var m29Lines = treasuryT6LedgerBySource_(m20Fixture, m20Result.receiptID);
  check("M29", m29Lines.length === 2 && m29Lines.every(function(row) {
    return ["1030", "1000"].indexOf(String(row.AccountCode)) !== -1;
  }) && source.indexOf("2010") === -1 && source.indexOf("REFUND") === -1 &&
    source.indexOf("CUSTOMER_CREDIT") === -1);
  // M30 cache before commit impossible: UNKNOWN outcomes never invalidate.
  var m30Runtime = treasuryT6Runtime_();
  var m30Seed = treasuryT6SeedReceipt_(m30Runtime.spreadsheet);
  m30Runtime.batch = function() { throw new Error("ETIMEDOUT"); };
  var m30 = treasuryT6Reverse_(treasuryT6ReversePayload_("t6-m30", m30Seed.receiptID),
    m30Runtime);
  check("M30", m30.status === "UNKNOWN" && m30Runtime.events.cacheCalls === 0,
    JSON.stringify(m30));
  return { total: 30, pass: pass, fail: 30 - pass };
}
