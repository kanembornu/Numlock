// Treasury T5 canonical clearing projection + 1030 reconciliation tests
// (P1–P25 status/integrity/orphan/reversal/as-of/reconciliation/parity suites +
// read-only source audit + 25-point mutation sensitivity) for
// 99B.Treasury.Clearing.Projection.js. In-memory fixture spreadsheets only:
// reuses the T3/T4 fixtures, the U2 save runtime, and the U3 artifact builders
// (same VM context). No production access, no network, no clasp, no writes
// outside fixture memory, no source mutation left behind.

function treasuryT5Check_(id, value, detail) {
  if (!value) throw new Error("TREASURY_T5:" + id + (detail === undefined ? "" : "|" + detail));
}

var TREASURY_T5_RID = "SCR-U3-ORD-T4-1";

function treasuryT5Projection_(fixture, request) {
  return buildTreasuryClearingProjection_(fixture, request || {});
}

function treasuryT5Reconciliation_(fixture, request) {
  return buildTreasury1030Reconciliation_(fixture, request || {});
}

function treasuryT5Row_(projection, recognitionID) {
  return projection.rows.filter(function(row) {
    return row.RecognitionID === recognitionID;
  })[0] || null;
}

function treasuryT5HasCode_(row, code) {
  return !!row && row.QualityCodes.indexOf(code) !== -1;
}

// Real T4 durable save into a fixture (shared safety gate, executed locally).
function treasuryT5SaveReceipt_(fixture, payloadOverrides, runtimeOptions) {
  var options = Object.assign({ fixture: fixture }, runtimeOptions || {});
  var runtime = treasuryT4Runtime_(options);
  var payload = treasuryT4Payload_("t5-key-001", payloadOverrides || {});
  var result = treasuryReceiptSaveWithRuntime_(payload, runtime);
  return { result: result, runtime: runtime };
}

// Deterministic in-memory corruption/fabrication builder: a structurally
// complete receipt + operation + audit + 2-line journal (all cross-linked) by
// default, with surgical opt-outs for every integrity dimension P6–P13 and
// M24–M25 exercise. Nothing here touches real storage.
function treasuryT5FabricateReceipt_(fixture, options) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  var o = options || {};
  var suffix = o.suffix || "F1";
  var receiptID = "TRC-T5-" + suffix;
  var operationID = "TROP-T5-" + suffix;
  var journalID = "TRJ-T5-" + suffix;
  var auditID = "TRA-T5-" + suffix;
  var requestKey = "t5-" + suffix;
  var recognitionID = o.recognitionID === undefined ? TREASURY_T5_RID : o.recognitionID;
  var orderID = o.orderID === undefined ? "ORD-T4-1" : o.orderID;
  var revisionID = o.revisionID === undefined ? "REV-U3-ORD-T4-1" : o.revisionID;
  var amount = o.amount === undefined ? 24000 : o.amount;
  var destination = o.destination === undefined ? "1000" : o.destination;
  var receiptDate = o.receiptDate === undefined ? "2026-10-13" : o.receiptDate;
  var receiptType = o.receiptType === undefined ? "SALES_RECEIPT" : o.receiptType;
  var opState = o.opState === undefined ? "COMMITTED" : o.opState;
  var receivedAt = o.receivedAt === undefined ? "2026-10-13T03:00:00.000Z" : o.receivedAt;
  var actor = "tester@numlock.test";
  var lines = [];
  if (o.journal !== "none" && o.noJournal !== true) {
    var journalDestination = o.journalDestination || destination;
    var ordinary = receiptType === "SALES_RECEIPT";
    var movement = ordinary ? contract.MOVEMENT_TYPE : contract.MOVEMENT_TYPE_REVERSAL;
    var destDebit = ordinary ? amount : 0;
    var destCredit = ordinary ? 0 : amount;
    var clearDebit = ordinary ? 0 : amount;
    var clearCredit = ordinary ? amount : 0;
    if (o.journal === "wrong1030") { clearDebit = amount; clearCredit = 0; }
    lines = [
      { JournalID: journalID, LineID: journalID + "-1", Tanggal: receiptDate,
        AccountCode: journalDestination, Debit: destDebit, Credit: destCredit,
        MovementType: movement, SourceType: contract.SOURCE_TYPE, SourceID: receiptID,
        ExternalRef: recognitionID, Keterangan: "", IsActive: true,
        CreatedAt: receivedAt, CreatedBy: actor, UpdatedAt: receivedAt, UpdatedBy: actor },
      { JournalID: journalID, LineID: journalID + "-2", Tanggal: receiptDate,
        AccountCode: contract.CLEARING_ACCOUNT_CODE, Debit: clearDebit, Credit: clearCredit,
        MovementType: movement, SourceType: contract.SOURCE_TYPE, SourceID: receiptID,
        ExternalRef: recognitionID, Keterangan: "", IsActive: true,
        CreatedAt: receivedAt, CreatedBy: actor, UpdatedAt: receivedAt, UpdatedBy: actor }
    ];
    u3AppendLedger_(fixture, lines);
  }
  var journalSignature = o.signature === undefined ?
    (lines.length ? treasuryJournalSignature(lines) : "") : o.signature;
  if (o.noOperation !== true) {
    u3AppendRow_(fixture, "TreasuryOperations", contract.SCHEMAS.OPERATIONS.HEADERS, {
      TreasuryOperationID: operationID, OperationType: "TREASURY_RECEIPT_SAVE",
      RecognitionID: recognitionID, RequestKey: requestKey, State: opState,
      PayloadHash: "H-" + suffix,
      OperationPlan: o.operationPlan === undefined ?
        JSON.stringify({ requestKey: requestKey }) : o.operationPlan,
      CreatedAt: receivedAt, UpdatedAt: receivedAt, LastError: "" });
  }
  var snapshot = Object.assign({ contractVersion: contract.CONTRACT_VERSION,
    recognitionID: recognitionID, recognizedAmount: 24000 }, o.snapshot || {});
  u3AppendRow_(fixture, "TreasuryReceipts", contract.SCHEMAS.RECEIPTS.HEADERS, {
    TreasuryReceiptID: receiptID, ContractVersion: contract.CONTRACT_VERSION,
    OperationID: operationID, RequestKey: requestKey, RecognitionID: recognitionID,
    OrderID: orderID, RevisionID: revisionID, ReceiptType: receiptType,
    DestinationAccountCode: destination, GrossAmount: amount,
    ReceiptDate: receiptDate,
    EconomicDate: o.economicDate === undefined ? receiptDate : o.economicDate,
    ReceivedAt: receivedAt, EvidenceType: contract.EVIDENCE_TYPE,
    EvidenceRef: "T5-FABRICATED-EVIDENCE", JournalID: journalID,
    JournalSignature: journalSignature,
    PostingStatus: o.postingStatus === undefined ?
      contract.POSTING_STATUS_COMMITTED : o.postingStatus,
    OriginalReceiptID: "", ReversalOfReceiptID: o.reversalOf || "",
    ReplacementReceiptID: "", Reason: "", Actor: actor,
    SnapshotJSON: JSON.stringify(snapshot) });
  if (o.noAudit !== true) {
    var audit = { AuditID: auditID, ContractVersion: contract.CONTRACT_VERSION,
      OperationID: operationID, RequestKey: requestKey,
      TreasuryReceiptID: receiptID, RecognitionID: recognitionID,
      OrderID: orderID, JournalID: journalID, PayloadHash: "H-" + suffix,
      Actor: actor, SavedAt: receivedAt };
    u3AppendRow_(fixture, "TreasuryAudits", contract.SCHEMAS.AUDITS.HEADERS,
      Object.assign(audit, o.auditOverride || {}));
  }
  return { receiptID: receiptID, operationID: operationID, journalID: journalID,
    auditID: auditID };
}

function treasuryT5LedgerLine_(fixture, row) {
  u3AppendLedger_(fixture, [row]);
}

// Finance fixture for Revenue isolation (P25 / M22): U5 Finance sheets +
// the three Treasury sheets + eligible cash accounts + one committed 24,000
// V2 recognition on 2026-10-11.
function treasuryT5FinanceFixture_() {
  var base = u5FinanceSheets_();
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  base.TreasuryReceipts = [contract.SCHEMAS.RECEIPTS.HEADERS.slice()];
  base.TreasuryOperations = [contract.SCHEMAS.OPERATIONS.HEADERS.slice()];
  base.TreasuryAudits = [contract.SCHEMAS.AUDITS.HEADERS.slice()];
  base.Accounts = treasuryT4Accounts_();
  var fixture = salesV2SaveFixture_(base);
  u5FinishAccounts_(fixture);
  u3CommittedAppend_(fixture, { orderID: "ORD-T5-FIN", amount: 24000,
    date: "2026-10-11", recognizedAt: "2026-10-11T03:00:00.000Z",
    requestKey: "u3-t5-fin" });
  return fixture;
}

// September-Sale-settled-October fixture (P18 / M20).
function treasuryT5CrossMonthFixture_() {
  var fixture = salesV2SaveFixture_(treasuryT4BaseSheets_());
  u3CommittedAppend_(fixture, { orderID: "ORD-T5-XM", amount: 24000,
    date: "2026-09-28", recognizedAt: "2026-09-28T03:00:00.000Z",
    requestKey: "u3-t5-xm" });
  treasuryT5SaveReceipt_(fixture, { recognitionID: "SCR-U3-ORD-T5-XM",
    receiptDate: "2026-10-05" });
  return fixture;
}

// T4 pre-save resolver vs T5 canonical projection (P23 parity contract).
function treasuryT5ParityView_(fixture, recognitionID, amount) {
  var t4Exposure = null, t4Error = null;
  try { t4Exposure = treasuryResolveExposure_(recognitionID, fixture); }
  catch (error) { t4Error = error; }
  var t4View = treasuryComputeOutstanding_(recognitionID, amount, fixture, "");
  var row = treasuryT5Row_(treasuryT5Projection_(fixture), recognitionID);
  return { t4Exposure: t4Exposure, t4Error: t4Error, t4View: t4View, row: row };
}

// ---------------------------------------------------------------------------
// Suite 1 — statuses + frozen row contract: P1, P2, P3, P4, P5, P22.
// ---------------------------------------------------------------------------
function testTreasuryT5ProjectionStatus() {
  var pass = 0;
  function check(id, value, detail) { treasuryT5Check_(id, value, detail); pass++; }
  var projection = TREASURY_CLEARING_PROJECTION;
  var statuses = projection.STATUSES;

  // P1 production-equivalent 24,000 UNCLEARED, residual 0.
  var f1 = treasuryT4SeededFixture_();
  var p1 = treasuryT5Projection_(f1);
  var r1 = treasuryT5Row_(p1, TREASURY_T5_RID);
  check("P1a", p1.contract === "TREASURY_CLEARING_PROJECTION_V1" &&
    p1.rows.length === 1 && !!r1 && p1.startDate === "" && p1.endDate === "",
    JSON.stringify(p1.rows));
  check("P1b", JSON.stringify(Object.keys(r1)) === JSON.stringify(projection.ROW_FIELDS),
    JSON.stringify(Object.keys(r1)));
  check("P1c", r1.ClearingStatus === "UNCLEARED" && r1.RecognizedAmount === 24000 &&
    r1.ClearedAmount === 0 && r1.ReversalAmount === 0 &&
    r1.OutstandingAmount === 24000 &&
    r1.RecognitionIntegrity === projection.INTEGRITY.VALID &&
    r1.QualityCodes.length === 0 && r1.ActiveReceiptCount === 0 &&
    r1.ActiveReceiptID === "", JSON.stringify(r1));
  check("P1d", p1.totals.recognizedExposure === 24000 &&
    p1.totals.outstandingTotal === 24000 && p1.totals.activeClearings === 0 &&
    p1.totals.unclearedCount === 1 && p1.totals.clearedCount === 0 &&
    p1.totals.exceptionCount === 0, JSON.stringify(p1.totals));
  var c1 = treasuryT5Reconciliation_(f1);
  check("P1e", c1.ledgerDr1030 === 24000 && c1.ledgerCr1030 === 0 &&
    c1.ledgerNet1030 === 24000 && c1.outstandingTotal === 24000 &&
    c1.explicitExceptionAmount === 0 && c1.unexplainedResidual === 0 &&
    c1.reconciliationStatus === "OK", JSON.stringify(c1));
  check("P1f", c1.ledgerDr1030 - c1.ledgerCr1030 === c1.ledgerNet1030 &&
    c1.contract === "TREASURY_1030_RECONCILIATION_V1");
  check("P1g", statuses.join(",") === "UNCLEARED,CLEARED,EXCEPTION" &&
    statuses.indexOf("PARTIAL") === -1 && projection.QUALITY_CODES.length >= 40,
    statuses.join(","));
  check("P1h", p1.orphans.receipts.length === 0 && p1.orphans.operations.length === 0 &&
    p1.orphans.audits.length === 0 && p1.orphans.journals.length === 0 &&
    p1.salesIssues.length === 0);

  // P2 one valid 24,000 receipt => CLEARED, ledger zero, residual 0.
  var f2 = treasuryT4SeededFixture_();
  var saved = treasuryT5SaveReceipt_(f2);
  check("P2a", saved.result.status === "DONE" && saved.result.code === "",
    JSON.stringify(saved.result));
  var p2 = treasuryT5Projection_(f2);
  var r2 = treasuryT5Row_(p2, TREASURY_T5_RID);
  check("P2b", r2.ClearingStatus === "CLEARED" && r2.RecognizedAmount === 24000 &&
    r2.ClearedAmount === 24000 && r2.OutstandingAmount === 0 &&
    r2.ActiveReceiptCount === 1 && r2.QualityCodes.length === 0 &&
    r2.RecognitionIntegrity === "VALID", JSON.stringify(r2));
  check("P2c", r2.ActiveReceiptID === saved.result.receiptID &&
    r2.DestinationAccountCode === "1000" && r2.ReceiptDate === "2026-10-12" &&
    r2.ReceiptEconomicDate === "2026-10-12" &&
    r2.JournalID === saved.result.journalID &&
    r2.OperationID === saved.result.operationID, JSON.stringify(r2));
  var c2 = treasuryT5Reconciliation_(f2);
  check("P2d", c2.ledgerDr1030 === 24000 && c2.ledgerCr1030 === 24000 &&
    c2.ledgerNet1030 === 0 && c2.outstandingTotal === 0 &&
    c2.activeClearings === 24000 && c2.explicitExceptionAmount === 0 &&
    c2.unexplainedResidual === 0 && c2.reconciliationStatus === "OK",
    JSON.stringify(c2));
  check("P2e", p2.totals.clearedCount === 1 && p2.totals.outstandingTotal === 0 &&
    p2.orphans.receipts.length === 0 && p2.orphans.journals.length === 0 &&
    p2.orphans.operations.length === 0 && p2.orphans.audits.length === 0);

  // P3 duplicate active receipts => EXCEPTION, ledger still reconciles.
  var f3 = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(f3);
  treasuryT5FabricateReceipt_(f3, { suffix: "DUP" });
  var r3 = treasuryT5Row_(treasuryT5Projection_(f3), TREASURY_T5_RID);
  check("P3a", r3.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(r3, "DUPLICATE_ACTIVE_RECEIPTS"), JSON.stringify(r3.QualityCodes));
  check("P3b", r3.OutstandingAmount === -24000 &&
    treasuryT5HasCode_(r3, "NEGATIVE_OUTSTANDING") &&
    treasuryT5HasCode_(r3, "CLEARING_OVER"), JSON.stringify(r3.QualityCodes));
  var c3 = treasuryT5Reconciliation_(f3);
  check("P3c", c3.unexplainedResidual === 0 && c3.reconciliationStatus === "OK" &&
    c3.exceptionEntries.length === 0, JSON.stringify(c3));

  // P4 partial clearing => EXCEPTION, never healthy UNCLEARED.
  var f4 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f4, { suffix: "PART", amount: 12000 });
  var r4 = treasuryT5Row_(treasuryT5Projection_(f4), TREASURY_T5_RID);
  check("P4a", r4.ClearingStatus === "EXCEPTION" &&
    r4.ClearingStatus !== "UNCLEARED" && treasuryT5HasCode_(r4, "CLEARING_PARTIAL"),
    JSON.stringify(r4.QualityCodes));
  check("P4b", r4.OutstandingAmount === 12000 && r4.ClearedAmount === 12000 &&
    r4.RecognizedAmount === 24000, JSON.stringify(r4));
  var c4 = treasuryT5Reconciliation_(f4);
  check("P4c", c4.ledgerNet1030 === 12000 && c4.outstandingTotal === 12000 &&
    c4.unexplainedResidual === 0 && c4.reconciliationStatus === "OK",
    JSON.stringify(c4));

  // P5 over-clear => EXCEPTION fail closed.
  var f5 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f5, { suffix: "OVER", amount: 30000 });
  var r5 = treasuryT5Row_(treasuryT5Projection_(f5), TREASURY_T5_RID);
  check("P5a", r5.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(r5, "CLEARING_OVER") &&
    treasuryT5HasCode_(r5, "NEGATIVE_OUTSTANDING"), JSON.stringify(r5.QualityCodes));
  check("P5b", r5.OutstandingAmount === -6000 && r5.ClearedAmount === 30000,
    JSON.stringify(r5));
  var c5 = treasuryT5Reconciliation_(f5);
  check("P5c", c5.ledgerNet1030 === -6000 && c5.outstandingTotal === -6000 &&
    c5.unexplainedResidual === 0 && c5.reconciliationStatus === "OK",
    JSON.stringify(c5));

  // P22 negative outstanding surfaces as EXCEPTION, never clamped to zero.
  check("P22a", r5.OutstandingAmount < 0 && r5.OutstandingAmount === -6000);
  check("P22b", r5.ClearingStatus === "EXCEPTION" &&
    projection.STATUSES.indexOf(r5.ClearingStatus) !== -1);
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// Suite 2 — receipt integrity gates: P6–P13. Each malformed receipt is
// excluded from clearing, surfaced with its exact quality code, and its
// posted ledger effect is attributed in reconciliation (residual stays 0).
// ---------------------------------------------------------------------------
function testTreasuryT5Integrity() {
  var pass = 0;
  function check(id, value, detail) { treasuryT5Check_(id, value, detail); pass++; }

  function exceptionRow(suffixOptions) {
    var fixture = treasuryT4SeededFixture_();
    var ids = treasuryT5FabricateReceipt_(fixture, suffixOptions);
    var row = treasuryT5Row_(treasuryT5Projection_(fixture), TREASURY_T5_RID);
    return { fixture: fixture, row: row, ids: ids };
  }

  // P6 missing operation => EXCEPTION, not counted, ledger effect attributed.
  var p6 = exceptionRow({ suffix: "NOOP", noOperation: true });
  check("P6a", p6.row.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(p6.row, "OPERATION_MISSING"), JSON.stringify(p6.row.QualityCodes));
  check("P6b", p6.row.OutstandingAmount === 24000 && p6.row.ClearedAmount === 0);
  var c6 = treasuryT5Reconciliation_(p6.fixture);
  check("P6c", c6.unexplainedResidual === 0 && c6.reconciliationStatus === "OK" &&
    c6.exceptionEntries.length === 1 &&
    c6.exceptionEntries[0].category === "TREASURY_INTEGRITY_EXCEPTION" &&
    c6.exceptionEntries[0].amount === -24000 &&
    c6.exceptionEntries[0].identity === p6.ids.receiptID &&
    c6.exceptionEntries[0].qualityCode === "OPERATION_MISSING" &&
    /^BalanceLedger:/.test(c6.exceptionEntries[0].sourceArtifact) &&
    c6.exceptionEntries[0].provenance !== "", JSON.stringify(c6.exceptionEntries));

  // P7 IN_PROGRESS with artifacts => EXCEPTION + recovery-needed quality;
  // the reader reports, never mutates the operation (T4 owns recovery).
  var f7 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f7, { suffix: "INPR", opState: "IN_PROGRESS" });
  var ops7Before = u3SheetSnapshot_(f7, ["TreasuryOperations"]);
  var p7 = treasuryT5Projection_(f7);
  var r7 = treasuryT5Row_(p7, TREASURY_T5_RID);
  check("P7a", r7.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(r7, "OP_IN_PROGRESS"), JSON.stringify(r7.QualityCodes));
  check("P7b", r7.OutstandingAmount === 24000 && r7.ClearedAmount === 0);
  var ops7 = readCanonicalTable(f7, TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.OPERATIONS.SHEET,
    TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.OPERATIONS.HEADERS);
  check("P7c", ops7.length === 1 && ops7[0].State === "IN_PROGRESS" &&
    u3SheetSnapshot_(f7, ["TreasuryOperations"]) === ops7Before);
  var c7 = treasuryT5Reconciliation_(f7);
  check("P7d", c7.unexplainedResidual === 0 && c7.reconciliationStatus === "OK");

  // P8 missing journal => EXCEPTION; ledger stays receipt-independent.
  var p8 = exceptionRow({ suffix: "NOJL", noJournal: true });
  check("P8a", p8.row.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(p8.row, "JOURNAL_MISSING"), JSON.stringify(p8.row.QualityCodes));
  check("P8b", p8.row.OutstandingAmount === 24000);
  var c8 = treasuryT5Reconciliation_(p8.fixture);
  check("P8c", c8.ledgerNet1030 === 24000 && c8.outstandingTotal === 24000 &&
    c8.exceptionEntries.length === 0 && c8.unexplainedResidual === 0 &&
    c8.reconciliationStatus === "OK", JSON.stringify(c8));

  // P9 wrong destination journal leg => EXCEPTION + attributed integrity entry.
  var p9 = exceptionRow({ suffix: "WDEST", journalDestination: "1020" });
  check("P9a", p9.row.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(p9.row, "DESTINATION_LEDGER_MISMATCH") &&
    treasuryT5HasCode_(p9.row, "JOURNAL_ACCOUNT_MISMATCH"),
    JSON.stringify(p9.row.QualityCodes));
  check("P9b", p9.row.OutstandingAmount === 24000);
  var c9 = treasuryT5Reconciliation_(p9.fixture);
  check("P9c", c9.unexplainedResidual === 0 && c9.exceptionEntries.length === 1 &&
    c9.exceptionEntries[0].qualityCode === "DESTINATION_LEDGER_MISMATCH" &&
    c9.exceptionEntries[0].amount === -24000, JSON.stringify(c9.exceptionEntries));

  // P10 wrong 1030 leg (debit instead of credit) => EXCEPTION, residual 0.
  var p10 = exceptionRow({ suffix: "W1030", journal: "wrong1030" });
  check("P10a", p10.row.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(p10.row, "JOURNAL_ACCOUNT_MISMATCH"),
    JSON.stringify(p10.row.QualityCodes));
  check("P10b", p10.row.OutstandingAmount === 24000);
  var c10 = treasuryT5Reconciliation_(p10.fixture);
  check("P10c", c10.ledgerNet1030 === 48000 && c10.outstandingTotal === 24000 &&
    c10.exceptionEntries.length === 1 && c10.exceptionEntries[0].amount === 24000 &&
    c10.unexplainedResidual === 0 && c10.reconciliationStatus === "OK",
    JSON.stringify(c10));

  // P11 signature mismatch => EXCEPTION, not counted.
  var p11 = exceptionRow({ suffix: "SIG", signature: "FORGED-SIGNATURE" });
  check("P11a", p11.row.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(p11.row, "SIGNATURE_MISMATCH"), JSON.stringify(p11.row.QualityCodes));
  check("P11b", p11.row.OutstandingAmount === 24000);
  var c11 = treasuryT5Reconciliation_(p11.fixture);
  check("P11c", c11.unexplainedResidual === 0 && c11.exceptionEntries.length === 1 &&
    c11.exceptionEntries[0].qualityCode === "SIGNATURE_MISMATCH",
    JSON.stringify(c11.exceptionEntries));

  // P12 missing audit => EXCEPTION; outstanding independent from the ledger.
  var p12 = exceptionRow({ suffix: "NOAU", noAudit: true });
  check("P12a", p12.row.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(p12.row, "AUDIT_MISSING"), JSON.stringify(p12.row.QualityCodes));
  check("P12b", p12.row.OutstandingAmount === 24000);
  var c12 = treasuryT5Reconciliation_(p12.fixture);
  check("P12c", c12.ledgerNet1030 === 0 && c12.outstandingTotal === 24000 &&
    c12.ledgerNet1030 !== c12.outstandingTotal &&
    c12.exceptionEntries.length === 1 &&
    c12.exceptionEntries[0].qualityCode === "AUDIT_MISSING" &&
    c12.exceptionEntries[0].amount === -24000 &&
    c12.unexplainedResidual === 0 && c12.reconciliationStatus === "OK",
    JSON.stringify(c12));

  // P13 audit mismatch => EXCEPTION, attributed, residual 0.
  var p13 = exceptionRow({ suffix: "AUM", auditOverride: { PayloadHash: "FORGED-HASH" } });
  check("P13a", p13.row.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(p13.row, "AUDIT_MISMATCH"), JSON.stringify(p13.row.QualityCodes));
  check("P13b", p13.row.OutstandingAmount === 24000);
  var c13 = treasuryT5Reconciliation_(p13.fixture);
  check("P13c", c13.unexplainedResidual === 0 && c13.reconciliationStatus === "OK" &&
    c13.exceptionEntries.length === 1 &&
    c13.exceptionEntries[0].qualityCode === "AUDIT_MISMATCH",
    JSON.stringify(c13.exceptionEntries));

  // Sales authority invalid stays EXCEPTION (quality catalog completeness).
  var fSA = treasuryT4SeededFixture_();
  var eventSheet = fSA.getSheetByName("SalesRecognitionEvents");
  var postingIdx = SALES_RECOGNITION_V2_CONTRACT.HEADERS.indexOf("PostingStatus");
  eventSheet.values[1][postingIdx] = "PENDING";
  var rSA = treasuryT5Row_(treasuryT5Projection_(fSA), TREASURY_T5_RID);
  check("P13d", rSA.ClearingStatus === "EXCEPTION" &&
    rSA.RecognitionIntegrity === "INVALID" &&
    treasuryT5HasCode_(rSA, "SALES_AUTHORITY_INVALID"), JSON.stringify(rSA.QualityCodes));
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Suite 3 — orphans + Sales reversal lifecycle: P14–P17.
// ---------------------------------------------------------------------------
function testTreasuryT5OrphansReversal() {
  var pass = 0;
  function check(id, value, detail) { treasuryT5Check_(id, value, detail); pass++; }

  // P14 orphan receipt (RecognitionID unresolved) surfaced separately; real
  // exposure untouched; its ledger effect attributed, residual 0.
  var f14 = treasuryT4SeededFixture_();
  var orphanIds = treasuryT5FabricateReceipt_(f14, { suffix: "ORPH",
    recognitionID: "SCR-NOPE-1" });
  var p14 = treasuryT5Projection_(f14);
  check("P14a", p14.orphans.receipts.length === 1 &&
    p14.orphans.receipts[0].treasuryReceiptID === orphanIds.receiptID &&
    p14.orphans.receipts[0].reason === "RECOGNITION_UNRESOLVED" &&
    p14.orphans.receipts[0].recognitionID === "SCR-NOPE-1" &&
    p14.orphans.receipts[0].codes.indexOf("ORPHAN_RECEIPT") !== -1,
    JSON.stringify(p14.orphans.receipts));
  var r14 = treasuryT5Row_(p14, TREASURY_T5_RID);
  check("P14b", p14.rows.length === 1 && !treasuryT5Row_(p14, "SCR-NOPE-1") &&
    r14.ClearingStatus === "UNCLEARED" && r14.OutstandingAmount === 24000,
    JSON.stringify(p14.rows));
  var c14 = treasuryT5Reconciliation_(f14);
  check("P14c", c14.unexplainedResidual === 0 && c14.reconciliationStatus === "OK" &&
    c14.exceptionEntries.length === 1 &&
    c14.exceptionEntries[0].qualityCode === "ORPHAN_RECEIPT" &&
    c14.exceptionEntries[0].amount === -24000, JSON.stringify(c14.exceptionEntries));
  check("P14d", p14.orphans.operations.length === 1 &&
    p14.orphans.operations[0].reason === "RECOGNITION_UNRESOLVED" &&
    p14.orphans.operations[0].codes.indexOf("ORPHAN_OPERATION") !== -1,
    JSON.stringify(p14.orphans.operations));

  // P15 orphan treasury journal (no receipt row) surfaced separately.
  var f15 = treasuryT4SeededFixture_();
  treasuryT5LedgerLine_(f15, { JournalID: "TRJ-T5-GONE",
    LineID: "TRJ-T5-GONE-1", Tanggal: "2026-10-14", AccountCode: "1030",
    Debit: 0, Credit: 24000, MovementType: "TREASURY_RECEIPT",
    SourceType: "TREASURY_RECEIPT_V1", SourceID: "TRC-GONE-1" });
  var p15 = treasuryT5Projection_(f15);
  check("P15a", p15.orphans.journals.length === 1 &&
    p15.orphans.journals[0].sourceID === "TRC-GONE-1" &&
    p15.orphans.journals[0].lineCount === 1 &&
    p15.orphans.journals[0].net1030Effect === -24000 &&
    p15.orphans.journals[0].codes.indexOf("ORPHAN_JOURNAL") !== -1,
    JSON.stringify(p15.orphans.journals));
  var c15 = treasuryT5Reconciliation_(f15);
  check("P15b", c15.ledgerNet1030 === 0 && c15.outstandingTotal === 24000 &&
    c15.exceptionEntries.length === 1 &&
    c15.exceptionEntries[0].qualityCode === "ORPHAN_1030_MOVEMENT" &&
    c15.exceptionEntries[0].amount === -24000 &&
    c15.unexplainedResidual === 0 && c15.reconciliationStatus === "OK",
    JSON.stringify(c15));

  // P16 Sales reversal BEFORE any receipt: lifecycle void, not an exposure,
  // not an exception, not omitted; as-of ordering respected both ways.
  var f16 = treasuryT4SeededFixture_();
  var events16 = readCanonicalTable(f16, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  u3ReversalAppend_(f16, events16[0], { date: "2026-10-15",
    recognizedAt: "2026-10-15T01:00:00.000Z" });
  var p16Early = treasuryT5Projection_(f16, { asOfDate: "2026-10-12" });
  var r16Early = treasuryT5Row_(p16Early, TREASURY_T5_RID);
  check("P16a", !!r16Early && r16Early.ClearingStatus === "UNCLEARED" &&
    r16Early.OutstandingAmount === 24000, JSON.stringify(p16Early.rows));
  var c16Early = treasuryT5Reconciliation_(f16, { asOfDate: "2026-10-12" });
  check("P16b", c16Early.ledgerNet1030 === 24000 &&
    c16Early.outstandingTotal === 24000 && c16Early.unexplainedResidual === 0 &&
    c16Early.reconciliationStatus === "OK", JSON.stringify(c16Early));
  var p16 = treasuryT5Projection_(f16, { asOfDate: "2026-10-31" });
  check("P16c", p16.rows.length === 0 && p16.voidedExposures.length === 1 &&
    p16.voidedExposures[0].recognitionID === TREASURY_T5_RID &&
    p16.voidedExposures[0].recognizedAmount === 24000 &&
    p16.voidedExposures[0].voidEconomicDate === "2026-10-15" &&
    p16.totals.outstandingTotal === 0 && p16.totals.unclearedCount === 0,
    JSON.stringify(p16));
  var c16 = treasuryT5Reconciliation_(f16, { asOfDate: "2026-10-31" });
  check("P16d", c16.ledgerDr1030 === 24000 && c16.ledgerCr1030 === 24000 &&
    c16.ledgerNet1030 === 0 && c16.outstandingTotal === 0 &&
    c16.explicitExceptionAmount === 0 && c16.exceptionEntries.length === 0 &&
    c16.unexplainedResidual === 0 && c16.reconciliationStatus === "OK",
    JSON.stringify(c16));
  var p16Open = treasuryT5Projection_(f16);
  check("P16e", p16Open.rows.length === 0 && p16Open.voidedExposures.length === 1 &&
    p16Open.totals.outstandingTotal === 0, JSON.stringify(p16Open.voidedExposures));
  var e16 = buildTreasuryClearingExposure_(f16,
    { recognitionID: TREASURY_T5_RID, asOfDate: "2026-10-31" });
  check("P16f", e16.status === "VOIDED" &&
    e16.voidedExposure.recognitionID === TREASURY_T5_RID, JSON.stringify(e16));
  var c16Open = treasuryT5Reconciliation_(f16);
  check("P16g", c16Open.ledgerNet1030 === 0 && c16Open.outstandingTotal === 0 &&
    c16Open.exceptionEntries.length === 0 && c16Open.unexplainedResidual === 0,
    JSON.stringify(c16Open));

  // P17 Sales reversal AFTER clearing = lifecycle EXCEPTION, no auto-refund,
  // no 2010 posting, reconciliation stays exact.
  var f17 = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(f17);
  var events17 = readCanonicalTable(f17, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  u3ReversalAppend_(f17, events17[0], { date: "2026-10-20",
    recognizedAt: "2026-10-20T01:00:00.000Z" });
  var r17 = treasuryT5Row_(treasuryT5Projection_(f17), TREASURY_T5_RID);
  check("P17a", r17.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(r17, "SALES_REVERSAL_CONFLICT") &&
    treasuryT5HasCode_(r17, "NEGATIVE_OUTSTANDING") &&
    treasuryT5HasCode_(r17, "CLEARING_OVER"), JSON.stringify(r17.QualityCodes));
  check("P17b", r17.OutstandingAmount === -24000 && r17.ClearedAmount === 24000 &&
    r17.ReversalAmount === 0, JSON.stringify(r17));
  var c17 = treasuryT5Reconciliation_(f17);
  check("P17c", c17.ledgerDr1030 === 24000 && c17.ledgerCr1030 === 48000 &&
    c17.ledgerNet1030 === -24000 && c17.outstandingTotal === -24000 &&
    c17.exceptionEntries.length === 0 && c17.explicitExceptionAmount === 0 &&
    c17.unexplainedResidual === 0 && c17.reconciliationStatus === "OK",
    JSON.stringify(c17));
  var ledger17 = treasuryT4LedgerRows_(f17);
  check("P17d", ledger17.every(function(line) {
    return String(line.AccountCode) !== "2010";
  }) && ledger17.length === 6, ledger17.length);
  var p17 = treasuryT5Projection_(f17);
  check("P17e", p17.totals.exceptionCount === 1 && p17.rows.length === 1);
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// Suite 4 — as-of / period semantics + Asia/Jakarta authority + legacy noise:
// P18, P19, same-day/next-day/month/year boundary, receipt-before-recognition,
// invalid request bounds, P24.
// ---------------------------------------------------------------------------
function testTreasuryT5AsOf() {
  var pass = 0;
  function check(id, value, detail) { treasuryT5Check_(id, value, detail); pass++; }
  var crossRid = "SCR-U3-ORD-T5-XM";

  // P18 cross-month: September Sale settled October.
  var f18 = treasuryT5CrossMonthFixture_();
  var early = treasuryT5Projection_(f18, { asOfDate: "2026-09-30" });
  var earlyRow = treasuryT5Row_(early, crossRid);
  check("P18a", !!earlyRow && earlyRow.ClearingStatus === "UNCLEARED" &&
    earlyRow.OutstandingAmount === 24000 && earlyRow.ClearedAmount === 0 &&
    earlyRow.ActiveReceiptCount === 0, JSON.stringify(early.rows));
  var earlyRecon = treasuryT5Reconciliation_(f18, { asOfDate: "2026-09-30" });
  check("P18b", earlyRecon.ledgerDr1030 === 24000 && earlyRecon.ledgerCr1030 === 0 &&
    earlyRecon.ledgerNet1030 === 24000 && earlyRecon.outstandingTotal === 24000 &&
    earlyRecon.unexplainedResidual === 0 && earlyRecon.reconciliationStatus === "OK",
    JSON.stringify(earlyRecon));
  var later = treasuryT5Projection_(f18, { asOfDate: "2026-10-05" });
  var laterRow = treasuryT5Row_(later, crossRid);
  check("P18c", !!laterRow && laterRow.ClearingStatus === "CLEARED" &&
    laterRow.OutstandingAmount === 0 && laterRow.ClearedAmount === 24000 &&
    laterRow.ReceiptEconomicDate === "2026-10-05", JSON.stringify(later.rows));
  var laterRecon = treasuryT5Reconciliation_(f18, { asOfDate: "2026-10-05" });
  check("P18d", laterRecon.ledgerNet1030 === 0 && laterRecon.outstandingTotal === 0 &&
    laterRecon.unexplainedResidual === 0 && laterRecon.reconciliationStatus === "OK",
    JSON.stringify(laterRecon));
  var open = treasuryT5Projection_(f18);
  check("P18e", treasuryT5Row_(open, crossRid).ClearingStatus === "CLEARED");
  // Naive same-month filtering would hide the October receipt from a September
  // period read; as-of + period are independent axes.
  var septPeriod = treasuryT5Projection_(f18, { startDate: "2026-09-01",
    endDate: "2026-09-30", asOfDate: "2026-10-31" });
  var septRow = treasuryT5Row_(septPeriod, crossRid);
  check("P18f", septPeriod.rows.length === 1 && !!septRow &&
    septRow.ClearingStatus === "CLEARED" && septRow.OutstandingAmount === 0,
    JSON.stringify(septPeriod.rows));
  var septPeriodEarly = treasuryT5Projection_(f18, { startDate: "2026-09-01",
    endDate: "2026-09-30", asOfDate: "2026-09-30" });
  check("P18g", treasuryT5Row_(septPeriodEarly, crossRid).ClearingStatus === "UNCLEARED");

  // P19 UTC/Jakarta boundary with the canonical treasuryDateKey authority.
  var originalFormatDate = Utilities.formatDate;
  Utilities.formatDate = function(date, timeZone, format) {
    if (timeZone !== "Asia/Jakarta" || format !== "yyyy-MM-dd") {
      throw new Error("T5_UNEXPECTED_FORMAT_ARGS:" + timeZone + ":" + format);
    }
    return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  };
  try {
    check("P19a", treasuryDateKey(new Date("2026-09-30T17:00:00Z")) === "2026-10-01" &&
      treasuryDateKey(new Date("2026-09-30T16:59:59Z")) === "2026-09-30");
    check("P19b", treasuryT3UtcHostDateKey_(new Date("2026-09-30T17:00:00Z")) ===
      "2026-09-30", "host UTC day must differ from Asia/Jakarta day");
    var f19 = salesV2SaveFixture_(treasuryT4BaseSheets_());
    u3CommittedAppend_(f19, { orderID: "ORD-T5-JKT", amount: 24000,
      date: "2026-09-28", recognizedAt: "2026-09-28T03:00:00.000Z",
      requestKey: "u3-t5-jkt" });
    var saved19 = treasuryT5SaveReceipt_(f19, { recognitionID: "SCR-U3-ORD-T5-JKT",
      receiptDate: "2026-10-01" },
      { now: function() { return new Date("2026-09-30T17:00:00.000Z"); } });
    check("P19c", saved19.result.status === "DONE", JSON.stringify(saved19.result));
    var tlines19 = treasuryT4LedgerRows_(f19).filter(function(line) {
      return String(line.SourceType) === "TREASURY_RECEIPT_V1";
    });
    check("P19d", tlines19.length === 2 &&
      tlines19.every(function(line) { return line.Tanggal === "2026-10-01"; }),
      JSON.stringify(tlines19.map(function(line) { return line.Tanggal; })));
    var jktRid = "SCR-U3-ORD-T5-JKT";
    var before19 = treasuryT5Row_(treasuryT5Projection_(f19, { asOfDate: "2026-09-30" }),
      jktRid);
    check("P19e", !!before19 && before19.ClearingStatus === "UNCLEARED" &&
      before19.ClearedAmount === 0,
      "the receipt is economically 2026-10-01 in Asia/Jakarta; a host-UTC reader would wrongly include it at 2026-09-30");
    var after19 = treasuryT5Row_(treasuryT5Projection_(f19, { asOfDate: "2026-10-01" }),
      jktRid);
    check("P19f", !!after19 && after19.ClearingStatus === "CLEARED");
    var c19a = treasuryT5Reconciliation_(f19, { asOfDate: "2026-09-30" });
    var c19b = treasuryT5Reconciliation_(f19, { asOfDate: "2026-10-01" });
    check("P19g", c19a.ledgerNet1030 === 24000 && c19a.unexplainedResidual === 0 &&
      c19b.ledgerNet1030 === 0 && c19b.unexplainedResidual === 0 &&
      c19b.reconciliationStatus === "OK", JSON.stringify({ a: c19a, b: c19b }));
  } finally {
    Utilities.formatDate = originalFormatDate;
  }

  // Same-day and next-day recognition->receipt ordering (both healthy).
  var fSame = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(fSame, { receiptDate: "2026-10-11" });
  check("Dbattery1", treasuryT5Row_(treasuryT5Projection_(fSame), TREASURY_T5_RID)
    .ClearingStatus === "CLEARED");
  var fNext = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(fNext, { receiptDate: "2026-10-12" });
  check("Dbattery2", treasuryT5Row_(treasuryT5Projection_(fNext), TREASURY_T5_RID)
    .ClearingStatus === "CLEARED");

  // Month boundary: recognition 09-30, receipt 10-01 => healthy, cross-month.
  var fMonth = salesV2SaveFixture_(treasuryT4BaseSheets_());
  u3CommittedAppend_(fMonth, { orderID: "ORD-T5-MB", amount: 24000,
    date: "2026-09-30", recognizedAt: "2026-09-30T03:00:00.000Z",
    requestKey: "u3-t5-mb" });
  treasuryT5SaveReceipt_(fMonth, { recognitionID: "SCR-U3-ORD-T5-MB",
    receiptDate: "2026-10-01" });
  var mbRow = treasuryT5Row_(treasuryT5Projection_(fMonth), "SCR-U3-ORD-T5-MB");
  check("Dbattery3", mbRow.ClearingStatus === "CLEARED" &&
    mbRow.QualityCodes.length === 0, JSON.stringify(mbRow.QualityCodes));

  // Year boundary: recognition 2026-12-31, receipt 2027-01-01 => healthy.
  var fYear = salesV2SaveFixture_(treasuryT4BaseSheets_());
  u3CommittedAppend_(fYear, { orderID: "ORD-T5-YB", amount: 24000,
    date: "2026-12-31", recognizedAt: "2026-12-31T03:00:00.000Z",
    requestKey: "u3-t5-yb" });
  treasuryT5SaveReceipt_(fYear, { recognitionID: "SCR-U3-ORD-T5-YB",
    receiptDate: "2027-01-01" });
  var ybRow = treasuryT5Row_(treasuryT5Projection_(fYear), "SCR-U3-ORD-T5-YB");
  check("Dbattery4", ybRow.ClearingStatus === "CLEARED" &&
    ybRow.QualityCodes.length === 0, JSON.stringify(ybRow.QualityCodes));

  // Receipt dated BEFORE its recognition => quality behavior is EXCEPTION
  // (determined per contract: a clearing can never predate its exposure).
  var fBad = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(fBad, { suffix: "EARLY", receiptDate: "2026-10-10" });
  var badRow = treasuryT5Row_(treasuryT5Projection_(fBad), TREASURY_T5_RID);
  check("Dbattery5", badRow.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(badRow, "DATE_INCONSISTENT") &&
    badRow.OutstandingAmount === 24000, JSON.stringify(badRow.QualityCodes));
  var badRecon = treasuryT5Reconciliation_(fBad);
  check("Dbattery6", badRecon.unexplainedResidual === 0 &&
    badRecon.reconciliationStatus === "OK", JSON.stringify(badRecon));

  // Invalid request bounds fail closed with the frozen date code.
  var threwDate = null;
  try { treasuryT5Projection_(fBad, { asOfDate: "2026-10-32" }); }
  catch (error) { threwDate = error; }
  check("Dbattery7", !!threwDate && threwDate.treasuryCode === "TREASURY_DATE_INVALID",
    String(threwDate));
  var threwOrder = null;
  try { treasuryT5Projection_(fBad, { startDate: "2026-11-01", endDate: "2026-10-01" }); }
  catch (error) { threwOrder = error; }
  check("Dbattery8", !!threwOrder && threwOrder.treasuryCode === "TREASURY_DATE_INVALID",
    String(threwOrder));

  // P24 legacy Payment/Settlement noise: zero effect on projection or
  // reconciliation; statuses unchanged; no legacy dependency in the module.
  var f24 = treasuryT4SeededFixture_();
  var baselineProjection = JSON.stringify(treasuryT5Projection_(f24));
  var baselineRecon = JSON.stringify(treasuryT5Reconciliation_(f24));
  u3PaidChain_(f24, { orderID: "ORD-T5-NOISE", amount: 50000,
    paymentID: "PAY-T5-NOISE", paidAt: "2026-10-20T03:00:00.000Z",
    withPaymentOp: true });
  u3AppendPayment_(f24, { OrderID: "ORD-T4-1", RequestKey: "t5-noise-order",
    PaymentID: "PAY-T5-ONORDER", Status: "SUCCESS", Amount: 24000,
    PaidAt: "2026-10-20T03:00:00.000Z" });
  u3AppendSettlement_(f24, { SettlementID: "CSH-SAL-PAY-T5-NOISE",
    Tanggal: "2026-10-20", Amount: 50000, SourceID: "PAY-T5-NOISE",
    RelatedTransactionID: "ORD-T5-NOISE" });
  var p24 = treasuryT5Projection_(f24);
  var c24 = treasuryT5Reconciliation_(f24);
  check("P24a", JSON.stringify(p24) === baselineProjection,
    "legacy money rows changed the projection");
  check("P24b", JSON.stringify(c24) === baselineRecon,
    "legacy money rows changed the reconciliation");
  check("P24c", treasuryT5Row_(p24, TREASURY_T5_RID).ClearingStatus === "UNCLEARED" &&
    p24.totals.outstandingTotal === 24000 && c24.unexplainedResidual === 0);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Suite 5 — global 1030 reconciliation: P20, P21, malformed-line fail-visible.
// ---------------------------------------------------------------------------
function testTreasuryT5Reconciliation() {
  var pass = 0;
  function check(id, value, detail) { treasuryT5Check_(id, value, detail); pass++; }
  var categories = TREASURY_CLEARING_PROJECTION.EXCEPTION_CATEGORIES;
  check("R0", categories.join(",") ===
    "HISTORICAL_NON_V2_1030_MOVEMENT,TREASURY_INTEGRITY_EXCEPTION,LIFECYCLE_CONFLICT,FUTURE_REFUND_CREDIT_TRANSFER,FUTURE_CORRECTION_REVERSAL_STATE",
    categories.join(","));

  // P20 unattributable 1030 line => residual != 0, nothing hidden in a
  // generic exception bucket.
  var f20 = treasuryT4SeededFixture_();
  treasuryT5LedgerLine_(f20, { JournalID: "J-T5-MYST", LineID: "J-T5-MYST-1",
    Tanggal: "2026-10-10", AccountCode: "1030", Debit: 5000, Credit: 0,
    MovementType: "WEIRD_MOVEMENT", SourceType: "UNKNOWN_WRITER", SourceID: "" });
  var c20 = treasuryT5Reconciliation_(f20);
  check("P20a", c20.ledgerNet1030 === 29000 && c20.outstandingTotal === 24000 &&
    c20.unexplainedResidual === 5000, JSON.stringify(c20));
  check("P20b", c20.reconciliationStatus === "UNEXPLAINED_RESIDUAL" &&
    c20.exceptionEntries.length === 0 && c20.explicitExceptionAmount === 0,
    JSON.stringify(c20.exceptionEntries));

  // P21 deterministically attributable historical movement => separated into
  // the exception bucket, residual returns to 0.
  var f21 = treasuryT4SeededFixture_();
  treasuryT5LedgerLine_(f21, { JournalID: "J-T5-HIST", LineID: "J-T5-HIST-1",
    Tanggal: "2026-10-10", AccountCode: "1030", Debit: 7000, Credit: 0,
    MovementType: "OPENING_BALANCE", SourceType: "LEGACY_OPENING",
    SourceID: "HIST-0001" });
  var c21 = treasuryT5Reconciliation_(f21);
  check("P21a", c21.exceptionEntries.length === 1 &&
    c21.exceptionEntries[0].category === "HISTORICAL_NON_V2_1030_MOVEMENT" &&
    c21.exceptionEntries[0].identity === "HIST-0001" &&
    c21.exceptionEntries[0].amount === 7000 &&
    c21.exceptionEntries[0].qualityCode === "NON_V2_1030_MOVEMENT" &&
    c21.exceptionEntries[0].provenance !== "" &&
    c21.exceptionEntries[0].sourceArtifact === "BalanceLedger:J-T5-HIST-1",
    JSON.stringify(c21.exceptionEntries));
  check("P21b", c21.explicitExceptionAmount === 7000 &&
    c21.ledgerNet1030 === 31000 && c21.outstandingTotal === 24000 &&
    c21.unexplainedResidual === 0 && c21.reconciliationStatus === "OK",
    JSON.stringify(c21));

  // Malformed 1030 line is surfaced, never silently ignored.
  var f22 = treasuryT4SeededFixture_();
  treasuryT5LedgerLine_(f22, { JournalID: "J-T5-BAD", LineID: "J-T5-BAD-1",
    Tanggal: "2026-10-10", AccountCode: "1030", Debit: "abc", Credit: 0,
    MovementType: "WEIRD_MOVEMENT", SourceType: "UNKNOWN_WRITER", SourceID: "" });
  var c22 = treasuryT5Reconciliation_(f22);
  check("R22a", c22.malformed1030Lines.length === 1 &&
    c22.malformed1030Lines[0].lineID === "J-T5-BAD-1" &&
    c22.malformed1030Lines[0].detail === "NON_FINITE_AMOUNT" &&
    c22.reconciliationStatus === "MALFORMED_1030_LINE", JSON.stringify(c22));
  check("R22b", c22.ledgerDr1030 === 24000 && c22.unexplainedResidual === 0,
    JSON.stringify({ dr: c22.ledgerDr1030, residual: c22.unexplainedResidual }));

  // Debit-positive convention stated and enforced on the fixtures.
  var f23 = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(f23);
  var c23 = treasuryT5Reconciliation_(f23);
  check("R23", c23.ledgerDr1030 - c23.ledgerCr1030 === c23.ledgerNet1030 &&
    c23.ledgerNet1030 === 0 && c23.unexplainedResidual === 0 &&
    c23.reconciliationStatus === "OK", JSON.stringify(c23));

  // Single-exposure read + NOT_FOUND fail closed.
  var e23 = buildTreasuryClearingExposure_(f23, { recognitionID: TREASURY_T5_RID });
  check("R24", e23.status === "OK" && e23.row.ClearingStatus === "CLEARED",
    JSON.stringify(e23));
  var e24 = buildTreasuryClearingExposure_(f23, { recognitionID: "SCR-MISSING-1" });
  check("R25", e24.status === "NOT_FOUND" && e24.recognitionID === "SCR-MISSING-1",
    JSON.stringify(e24));
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// Suite 6 — T4/T5 parity + Revenue isolation: P23, P25.
// ---------------------------------------------------------------------------
function testTreasuryT5ParityFinance() {
  var pass = 0;
  function check(id, value, detail) { treasuryT5Check_(id, value, detail); pass++; }

  // P23a healthy uncleared: T4 pre-save resolver and T5 agree exactly.
  var fU = treasuryT4SeededFixture_();
  var pu = treasuryT5ParityView_(fU, TREASURY_T5_RID, 24000);
  check("P23a", !pu.t4Error && pu.t4View.outstanding === 24000 &&
    pu.t4View.activeClearings === 0 && pu.row.OutstandingAmount === 24000 &&
    pu.row.ClearedAmount === 0 && pu.row.ClearingStatus === "UNCLEARED",
    JSON.stringify({ t4: pu.t4View, t5: pu.row }));

  // P23b healthy cleared: both views report 0 / 24,000 cleared.
  var fC = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(fC);
  var pc = treasuryT5ParityView_(fC, TREASURY_T5_RID, 24000);
  check("P23b", !pc.t4Error && pc.t4View.outstanding === 0 &&
    pc.t4View.activeClearings === 24000 && pc.row.OutstandingAmount === 0 &&
    pc.row.ClearedAmount === 24000 && pc.row.ClearingStatus === "CLEARED",
    JSON.stringify({ t4: pc.t4View, t5: pc.row }));

  // P23c no T4-clearable / T5-EXCEPTION divergence: T4 clears only what T5
  // reports healthy, and the committed result matches both views.
  var fD = treasuryT4SeededFixture_();
  var preD = treasuryT5ParityView_(fD, TREASURY_T5_RID, 24000);
  check("P23c", preD.row.ClearingStatus !== "EXCEPTION");
  var saveD = treasuryT5SaveReceipt_(fD);
  var postD = treasuryT5ParityView_(fD, TREASURY_T5_RID, 24000);
  check("P23d", saveD.result.status === "DONE" && postD.t4View.outstanding === 0 &&
    postD.row.OutstandingAmount === 0 && postD.row.ClearingStatus === "CLEARED",
    JSON.stringify(saveD.result));

  // P23e the converse gate: a T5-EXCEPTION exposure is not clearable by T4.
  var fX = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(fX, { suffix: "PARX", amount: 12000 });
  var px = treasuryT5ParityView_(fX, TREASURY_T5_RID, 24000);
  var saveX = treasuryT5SaveReceipt_(fX);
  check("P23e", px.row.ClearingStatus === "EXCEPTION" &&
    saveX.result.status === "REFUSED",
    JSON.stringify({ status: px.row.ClearingStatus, t4: saveX.result }));
  return { total: pass, pass: pass, fail: 0 };
}

function testTreasuryT5FinanceIsolation() {
  var pass = 0;
  function check(id, value, detail) { treasuryT5Check_(id, value, detail); pass++; }

  // P25 a Treasury receipt moves Cash/Bank + 1030 only; Revenue and 4000 are
  // byte-identical before vs after (Finance separation).
  var f = treasuryT5FinanceFixture_();
  var ledgerBefore = readCanonicalTable(f, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var sumsBefore = treasuryT5LedgerSums_(ledgerBefore);
  var pnlBefore = getFinanceDataWithRuntime({ spreadsheet: f }, "custom",
    "2026-10-01", "2026-10-31");
  var saved = treasuryT5SaveReceipt_(f, { recognitionID: "SCR-U3-ORD-T5-FIN" });
  check("P25a", saved.result.status === "DONE", JSON.stringify(saved.result));
  var pnlAfter = getFinanceDataWithRuntime({ spreadsheet: f }, "custom",
    "2026-10-01", "2026-10-31");
  check("P25b", pnlBefore.summary.revenue === 24000 &&
    pnlAfter.summary.revenue === 24000 &&
    pnlAfter.summary.revenue === pnlBefore.summary.revenue,
    JSON.stringify({ before: pnlBefore.summary.revenue,
      after: pnlAfter.summary.revenue }));
  var ledgerAfter = readCanonicalTable(f, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  var sumsAfter = treasuryT5LedgerSums_(ledgerAfter);
  function sumAt(sums, code) {
    return sums[code] || { debit: 0, credit: 0 };
  }
  check("P25c", sumAt(sumsAfter, "4000").debit === sumAt(sumsBefore, "4000").debit &&
    sumAt(sumsAfter, "4000").credit === sumAt(sumsBefore, "4000").credit &&
    sumAt(sumsAfter, "1000").debit === sumAt(sumsBefore, "1000").debit + 24000 &&
    sumAt(sumsAfter, "1030").debit === 24000 &&
    sumAt(sumsAfter, "1030").credit === 24000 &&
    sumAt(sumsAfter, "1030").debit - sumAt(sumsAfter, "1030").credit === 0,
    JSON.stringify({ before: sumsBefore, after: sumsAfter }));
  var recon = treasuryT5Reconciliation_(f);
  check("P25d", recon.unexplainedResidual === 0 && recon.reconciliationStatus === "OK" &&
    treasuryT5Row_(treasuryT5Projection_(f), "SCR-U3-ORD-T5-FIN")
      .ClearingStatus === "CLEARED", JSON.stringify(recon));
  return { total: pass, pass: pass, fail: 0 };
}

function treasuryT5LedgerSums_(rows) {
  var sums = {};
  rows.forEach(function(row) {
    if (!isCanonicalActive(row.IsActive)) return;
    var code = String(row.AccountCode);
    sums[code] = sums[code] || { debit: 0, credit: 0 };
    sums[code].debit += Number(row.Debit) || 0;
    sums[code].credit += Number(row.Credit) || 0;
  });
  return sums;
}

// ---------------------------------------------------------------------------
// Suite 7 — read-only source/call-graph audit + reader behavior guarantee.
// ---------------------------------------------------------------------------
function testTreasuryT5ReadOnlyAudit() {
  var pass = 0;
  function check(id, value, detail) { treasuryT5Check_(id, value, detail); pass++; }
  var source = typeof _treasuryClearingSource === "string" ?
    _treasuryClearingSource : "";
  check("W0", source.length > 1000 &&
    source.indexOf("TREASURY_CLEARING_PROJECTION") !== -1,
    String(source.length));

  // W1 zero write primitives anywhere in the T5 module source.
  ["setValues", "appendRow", "appendCells", "batchUpdate", "setProperty",
    "insertRow", "deleteRow", "UrlFetchApp", "SpreadsheetApp", "LockService",
    ".flush()"].forEach(function(token) {
    check("W1-" + token, source.indexOf(token) === -1, token);
  });

  // W2 no writer / recovery entrypoint is reachable from the reader.
  ["treasuryReceiptSaveWithRuntime_", "treasuryReceiptDurableSave",
    "treasuryOperationAppend_", "treasuryOperationUpdate_",
    "treasuryReceiptApplyBatch_", "treasuryReceiptCommit_",
    "treasuryReceiptResume_", "treasuryReceiptNewIntent_",
    "treasuryReceiptPlan_"].forEach(function(token) {
    check("W2-" + token, source.indexOf(token) === -1, token);
  });

  // W3 no legacy money-table or legacy settlement dependency.
  ["Payments", "Settlements", "ReceiveVia", "PaymentMethod",
    "cashSettleAndPersist", "attemptCashSettlement", "tabsal", "tabops",
    "fallback"].forEach(function(token) {
    check("W3-" + token, source.indexOf(token) === -1, token);
  });

  // W4 no host-local date conversion and no second date authority.
  check("W4a", source.indexOf("canonicalDateKey(") === -1);
  check("W4b", source.indexOf("getMonth(") === -1 &&
    source.indexOf("getFullYear(") === -1 && source.indexOf("getDate(") === -1);

  // W5 cache decision: NO cache layer exists in this module.
  ["CacheService", "getScriptCache", "invalidateDashboardCache",
    "getDashboardCacheRevision"].forEach(function(token) {
    check("W5-" + token, source.indexOf(token) === -1, token);
  });

  // W6 no Finance/Revenue authority duplication, no Sales amount shortcuts.
  ["getFinanceData", "buildFinanceProfitAndLoss", "buildCashFlowStatement",
    "buildRecognizedSalesProjectionFromSpreadsheet_", "OrderTotal",
    "revenue", "Revenue", "4000", "2010", "snapshot.recognizedAmount"].forEach(
    function(token) {
      check("W6-" + token, source.indexOf(token) === -1, token);
    });

  // W7 full read pass leaves every sheet byte-identical (zero write proof).
  var fixture = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(fixture);
  var names = ["TreasuryReceipts", "TreasuryOperations", "TreasuryAudits",
    "BalanceLedger", "Orders", "OrderLines", "SalesRecognitionEvents",
    "SalesRecognitionAudits", "TransactionOperations", "Payments",
    "Settlements", "tabsal", "tabops", "InventoryLedger", "PurchaseEvents",
    "Accounts"];
  var before = u3SheetSnapshot_(fixture, names);
  var projection = buildTreasuryClearingProjection_(fixture, {});
  var exposure = buildTreasuryClearingExposure_(fixture,
    { recognitionID: TREASURY_T5_RID });
  var reconciliation = buildTreasury1030Reconciliation_(fixture, {});
  check("W7a", u3SheetSnapshot_(fixture, names) === before,
    "a read path mutated a sheet");

  // W8 public entrypoints resolve the spreadsheet read-only and return the
  // same canonical answers (production resolver stubbed, restored after).
  var originalResolver = globalThis.requireNumlockProductionSpreadsheet;
  globalThis.requireNumlockProductionSpreadsheet = function() { return fixture; };
  try {
    var projectionPublic = getTreasuryClearingProjection({});
    var exposurePublic = getTreasuryClearingExposure(
      { recognitionID: TREASURY_T5_RID });
    var reconciliationPublic = getTreasury1030Reconciliation({});
    check("W8a", JSON.stringify(projectionPublic) === JSON.stringify(projection));
    check("W8b", JSON.stringify(reconciliationPublic) ===
      JSON.stringify(reconciliation));
    check("W8c", exposurePublic.status === "OK" &&
      exposurePublic.row.ClearingStatus === "CLEARED" &&
      JSON.stringify(exposurePublic.row) === JSON.stringify(exposure.row));
    check("W8d", u3SheetSnapshot_(fixture, names) === before,
      "the public API mutated a sheet");
  } finally {
    if (originalResolver) {
      globalThis.requireNumlockProductionSpreadsheet = originalResolver;
    } else {
      delete globalThis.requireNumlockProductionSpreadsheet;
    }
  }

  // W9 IN_PROGRESS recovery-needed is REPORTED, never executed: operation
  // state and every sheet stay untouched.
  var fRecovery = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(fRecovery, { suffix: "RCV", opState: "IN_PROGRESS" });
  var recoveryBefore = u3SheetSnapshot_(fRecovery, names);
  var recoveryProjection = buildTreasuryClearingProjection_(fRecovery, {});
  var recoveryRow = treasuryT5Row_(recoveryProjection, TREASURY_T5_RID);
  check("W9a", recoveryRow.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(recoveryRow, "OP_IN_PROGRESS"));
  check("W9b", u3SheetSnapshot_(fRecovery, names) === recoveryBefore,
    "the reader executed recovery/mutation");

  // W10 bounded read API surface is exactly the frozen entrypoint set.
  check("W10", TREASURY_CLEARING_PROJECTION.READ_ENTRYPOINTS.join(",") ===
    "getTreasuryClearingProjection,getTreasuryClearingExposure,getTreasury1030Reconciliation");
  // W11 public wrapper functions are thin read-only compositions.
  var wrapperSource = getTreasuryClearingProjection.toString() +
    getTreasuryClearingExposure.toString() +
    getTreasury1030Reconciliation.toString();
  check("W11", wrapperSource.indexOf("requireNumlockProductionSpreadsheet") !== -1 &&
    wrapperSource.indexOf("buildTreasuryClearingProjection_") !== -1 &&
    wrapperSource.indexOf("buildTreasuryClearingExposure_") !== -1 &&
    wrapperSource.indexOf("buildTreasury1030Reconciliation_") !== -1 &&
    wrapperSource.indexOf("setValues") === -1);
  return { total: pass, pass: pass, fail: 0 };
}
// ---------------------------------------------------------------------------
// Suite 8 — 25-point mutation sensitivity: every listed defect class is caught
// by a behavioral assertion and/or a source invariant. All fixture tampering
// is in-memory and local to the test; no mutation is left in any source file.
// ---------------------------------------------------------------------------
function testTreasuryT5MutationSensitivity() {
  var pass = 0;
  function check(id, value, detail) { treasuryT5Check_(id, value, detail); pass++; }
  var source = typeof _treasuryClearingSource === "string" ?
    _treasuryClearingSource : "";
  var rid = TREASURY_T5_RID;

  // M1 Order-total authority: recognized amount comes from the Sales event,
  // never the Order header total.
  var f1 = treasuryT4SeededFixture_();
  var orderSheet = f1.getSheetByName("Orders");
  var orderTotalIndex = TRANSACTION_PRODUCTION_CONTRACT.ORDERS.HEADERS.indexOf("OrderTotal");
  orderSheet.values.forEach(function(row, index) {
    if (index > 0) row[orderTotalIndex] = 999999;
  });
  var r1 = treasuryT5Row_(treasuryT5Projection_(f1), rid);
  check("M1", r1.RecognizedAmount === 24000 && r1.ClearingStatus === "UNCLEARED" &&
    r1.RecognitionIntegrity === "VALID" && source.indexOf("OrderTotal") === -1,
    JSON.stringify(r1));

  // M2 count non-COMMITTED operations: an IN_PROGRESS intent never clears.
  var f2 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f2, { suffix: "M2", opState: "IN_PROGRESS" });
  var r2 = treasuryT5Row_(treasuryT5Projection_(f2), rid);
  check("M2", r2.ClearedAmount === 0 && r2.OutstandingAmount === 24000 &&
    r2.ClearingStatus === "EXCEPTION" && treasuryT5HasCode_(r2, "OP_IN_PROGRESS"),
    JSON.stringify(r2));

  // M3 ignore missing audit: never healthy.
  var f3 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f3, { suffix: "M3", noAudit: true });
  var r3 = treasuryT5Row_(treasuryT5Projection_(f3), rid);
  check("M3", r3.ClearingStatus === "EXCEPTION" && treasuryT5HasCode_(r3, "AUDIT_MISSING") &&
    r3.OutstandingAmount === 24000, JSON.stringify(r3.QualityCodes));

  // M4 ignore missing journal: never healthy.
  var f4 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f4, { suffix: "M4", noJournal: true });
  var r4 = treasuryT5Row_(treasuryT5Projection_(f4), rid);
  check("M4", r4.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(r4, "JOURNAL_MISSING"), JSON.stringify(r4.QualityCodes));

  // M5 skip signature verification: tampered signature never clears.
  var f5 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f5, { suffix: "M5", signature: "FORGED" });
  var r5 = treasuryT5Row_(treasuryT5Projection_(f5), rid);
  check("M5", r5.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(r5, "SIGNATURE_MISMATCH"),
    JSON.stringify(r5.QualityCodes));

  // M6 partial-as-UNCLEARED: partial is never a healthy status.
  var f6 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f6, { suffix: "M6", amount: 12000 });
  var r6 = treasuryT5Row_(treasuryT5Projection_(f6), rid);
  check("M6", r6.ClearingStatus === "EXCEPTION" && r6.ClearingStatus !== "UNCLEARED" &&
    treasuryT5HasCode_(r6, "CLEARING_PARTIAL"), JSON.stringify(r6.QualityCodes));

  // M7 clamp negative: the raw negative outstanding is preserved verbatim.
  var f7 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f7, { suffix: "M7", amount: 30000 });
  var r7 = treasuryT5Row_(treasuryT5Projection_(f7), rid);
  check("M7", r7.OutstandingAmount === -6000 && r7.OutstandingAmount < 0 &&
    r7.ClearingStatus === "EXCEPTION", JSON.stringify(r7));

  // M8 duplicate-as-CLEARED: duplicates never collapse into CLEARED.
  var f8 = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(f8);
  treasuryT5FabricateReceipt_(f8, { suffix: "M8" });
  var r8 = treasuryT5Row_(treasuryT5Projection_(f8), rid);
  check("M8", r8.ClearingStatus !== "CLEARED" &&
    r8.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(r8, "DUPLICATE_ACTIVE_RECEIPTS"), JSON.stringify(r8.QualityCodes));

  // M9 snapshot-as-Sales-authority: a lying receipt snapshot never changes
  // the canonical recognized amount (snapshot = evidence only).
  var f9 = treasuryT4SeededFixture_();
  var saved9 = treasuryT5SaveReceipt_(f9);
  var receiptSheet9 = f9.getSheetByName("TreasuryReceipts");
  var snapshotIndex9 = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.RECEIPTS.HEADERS
    .indexOf("SnapshotJSON");
  var snapshot9 = JSON.parse(receiptSheet9.values[1][snapshotIndex9]);
  snapshot9.recognizedAmount = 999999;
  receiptSheet9.values[1][snapshotIndex9] = JSON.stringify(snapshot9);
  var r9 = treasuryT5Row_(treasuryT5Projection_(f9), rid);
  check("M9", saved9.result.status === "DONE" && r9.RecognizedAmount === 24000 &&
    source.indexOf("snapshot.recognizedAmount") === -1,
    JSON.stringify({ recognized: r9.RecognizedAmount, status: r9.ClearingStatus }));

  // M10 ledger-from-receipts: LedgerNet1030 comes from BalanceLedger only —
  // a receipt claiming a clearing with no journal leaves the ledger at 24,000.
  var f10 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f10, { suffix: "M10", noJournal: true });
  var c10 = treasuryT5Reconciliation_(f10);
  check("M10", c10.ledgerDr1030 === 24000 && c10.ledgerCr1030 === 0 &&
    c10.ledgerNet1030 === 24000 && c10.unexplainedResidual === 0,
    JSON.stringify(c10));

  // M11 outstanding-from-ledger: canonical outstanding is independent of the
  // ledger — they deliberately disagree while reconciliation still closes.
  var f11 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f11, { suffix: "M11", noAudit: true });
  var r11 = treasuryT5Row_(treasuryT5Projection_(f11), rid);
  var c11 = treasuryT5Reconciliation_(f11);
  check("M11", r11.OutstandingAmount === 24000 && c11.ledgerNet1030 === 0 &&
    r11.OutstandingAmount !== c11.ledgerNet1030 && c11.unexplainedResidual === 0,
    JSON.stringify({ outstanding: r11.OutstandingAmount, ledger: c11.ledgerNet1030 }));

  // M12 residual hidden in a generic exception: an unattributable 1030 line
  // stays a visible non-zero residual with an empty exception bucket.
  var f12 = treasuryT4SeededFixture_();
  treasuryT5LedgerLine_(f12, { JournalID: "J-T5-M20", LineID: "J-T5-M20-1",
    Tanggal: "2026-10-10", AccountCode: "1030", Debit: 5000, Credit: 0,
    MovementType: "WEIRD_MOVEMENT", SourceType: "UNKNOWN_WRITER", SourceID: "" });
  var c12 = treasuryT5Reconciliation_(f12);
  check("M12", c12.unexplainedResidual === 5000 &&
    c12.exceptionEntries.length === 0 &&
    c12.reconciliationStatus === "UNEXPLAINED_RESIDUAL", JSON.stringify(c12));

  // M13 omit orphan receipt.
  var f13 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f13, { suffix: "M13", recognitionID: "SCR-GHOST-1" });
  check("M13", treasuryT5Projection_(f13).orphans.receipts.length >= 1);

  // M14 omit orphan journal.
  var f14 = treasuryT4SeededFixture_();
  treasuryT5LedgerLine_(f14, { JournalID: "TRJ-T5-GONE2", LineID: "TRJ-T5-GONE2-1",
    Tanggal: "2026-10-14", AccountCode: "1030", Debit: 0, Credit: 9000,
    MovementType: "TREASURY_RECEIPT", SourceType: "TREASURY_RECEIPT_V1",
    SourceID: "TRC-GONE-2" });
  check("M14", treasuryT5Projection_(f14).orphans.journals.length >= 1);

  // M15 ignore Sales reversal: the void is respected at and after its as-of.
  var f15 = treasuryT4SeededFixture_();
  var events15 = readCanonicalTable(f15, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  u3ReversalAppend_(f15, events15[0], { date: "2026-10-15",
    recognizedAt: "2026-10-15T01:00:00.000Z" });
  var p15 = treasuryT5Projection_(f15, { asOfDate: "2026-10-31" });
  check("M15", p15.rows.length === 0 && p15.voidedExposures.length === 1 &&
    p15.totals.outstandingTotal === 0, JSON.stringify(p15));

  // M16 auto-2010: cleared-Sale void never posts or implies a 2010 movement.
  var f16 = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(f16);
  var events16 = readCanonicalTable(f16, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  u3ReversalAppend_(f16, events16[0], { date: "2026-10-20",
    recognizedAt: "2026-10-20T01:00:00.000Z" });
  var c16 = treasuryT5Reconciliation_(f16);
  var has2010 = treasuryT4LedgerRows_(f16).some(function(line) {
    return String(line.AccountCode) === "2010";
  });
  check("M16", !has2010 && source.indexOf("2010") === -1 &&
    c16.unexplainedResidual === 0, JSON.stringify(c16));

  // M17/M18 Payment/Settlement noise never clears and never enters the module.
  var f17 = treasuryT4SeededFixture_();
  u3PaidChain_(f17, { orderID: "ORD-T5-M17", amount: 50000,
    paymentID: "PAY-T5-M17", paidAt: "2026-10-20T03:00:00.000Z" });
  var r17 = treasuryT5Row_(treasuryT5Projection_(f17), rid);
  check("M17", r17.ClearingStatus === "UNCLEARED" && r17.ClearedAmount === 0 &&
    source.indexOf("Payments") === -1, JSON.stringify(r17.ClearingStatus));
  check("M18", r17.ClearingStatus !== "CLEARED" &&
    source.indexOf("Settlements") === -1 && source.indexOf("ReceiveVia") === -1);

  // M19 host-local date: no host-local conversion exists, and as-of compares
  // Asia/Jakarta date keys on exact boundaries.
  check("M19a", source.indexOf("canonicalDateKey(") === -1 &&
    source.indexOf("getMonth(") === -1 && source.indexOf("getFullYear(") === -1);
  var f19 = treasuryT4SeededFixture_();
  var beforeM19 = treasuryT5Projection_(f19, { asOfDate: "2026-10-10" });
  var afterM19 = treasuryT5Projection_(f19, { asOfDate: "2026-10-11" });
  check("M19b", beforeM19.rows.length === 0 &&
    afterM19.rows.length === 1 &&
    treasuryT5Row_(afterM19, rid).SalesEconomicDate === "2026-10-11",
    JSON.stringify({ before: beforeM19.rows.length, after: afterM19.rows.length }));

  // M20 same-period filter breaks cross-month: period and as-of are
  // independent, so a September period read with an October as-of still
  // shows the settled exposure as CLEARED.
  var f20 = treasuryT5CrossMonthFixture_();
  var p20 = treasuryT5Projection_(f20, { startDate: "2026-09-01",
    endDate: "2026-09-30", asOfDate: "2026-10-31" });
  var r20 = treasuryT5Row_(p20, "SCR-U3-ORD-T5-XM");
  check("M20", !!r20 && r20.ClearingStatus === "CLEARED" &&
    r20.OutstandingAmount === 0, JSON.stringify(p20.rows));

  // M21 reader performs T4 recovery: no writer symbol exists in the module
  // and a full read leaves every sheet byte-identical.
  var f21 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f21, { suffix: "M21", opState: "IN_PROGRESS" });
  var names21 = ["TreasuryReceipts", "TreasuryOperations", "TreasuryAudits",
    "BalanceLedger"];
  var before21 = u3SheetSnapshot_(f21, names21);
  buildTreasuryClearingProjection_(f21, {});
  buildTreasury1030Reconciliation_(f21, {});
  check("M21a", u3SheetSnapshot_(f21, names21) === before21);
  check("M21b", source.indexOf("treasuryReceiptSaveWithRuntime_") === -1 &&
    source.indexOf("treasuryReceiptDurableSave") === -1 &&
    source.indexOf("treasuryOperationAppend_") === -1);

  // M22 receipt affects Revenue: Revenue is byte-identical before/after a
  // committed receipt, and the reader never imports a Finance authority.
  var f22 = treasuryT5FinanceFixture_();
  var revBefore = getFinanceDataWithRuntime({ spreadsheet: f22 }, "custom",
    "2026-10-01", "2026-10-31").summary.revenue;
  treasuryT5SaveReceipt_(f22, { recognitionID: "SCR-U3-ORD-T5-FIN" });
  var revAfter = getFinanceDataWithRuntime({ spreadsheet: f22 }, "custom",
    "2026-10-01", "2026-10-31").summary.revenue;
  check("M22", revBefore === 24000 && revAfter === revBefore &&
    source.indexOf("getFinanceData") === -1,
    JSON.stringify({ before: revBefore, after: revAfter }));

  // M23 T4 parity broken: both healthy fixtures keep exact agreement.
  var f23a = treasuryT4SeededFixture_();
  var v23a = treasuryT5ParityView_(f23a, rid, 24000);
  var f23b = treasuryT4SeededFixture_();
  treasuryT5SaveReceipt_(f23b);
  var v23b = treasuryT5ParityView_(f23b, rid, 24000);
  check("M23", v23a.t4View.outstanding === v23a.row.OutstandingAmount &&
    v23a.row.ClearingStatus !== "EXCEPTION" &&
    v23b.t4View.outstanding === v23b.row.OutstandingAmount &&
    v23b.t4View.activeClearings === v23b.row.ClearedAmount &&
    v23b.row.ClearingStatus === "CLEARED",
    JSON.stringify({ a: v23a.t4View, b: v23b.t4View }));

  // M24 invalid destination healthy: an ineligible destination fails closed.
  var f24 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f24, { suffix: "M24", destination: "2010" });
  var r24 = treasuryT5Row_(treasuryT5Projection_(f24), rid);
  check("M24", r24.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(r24, "DESTINATION_INVALID") && r24.ClearedAmount === 0,
    JSON.stringify(r24.QualityCodes));

  // M25 unknown reversal ignored: a reversal-shaped receipt with an unknown
  // target is an EXCEPTION and changes nothing.
  var f25 = treasuryT4SeededFixture_();
  treasuryT5FabricateReceipt_(f25, { suffix: "M25",
    receiptType: "SALES_RECEIPT_REVERSAL", reversalOf: "TRC-GHOST-404" });
  var r25 = treasuryT5Row_(treasuryT5Projection_(f25), rid);
  check("M25", r25.ClearingStatus === "EXCEPTION" &&
    treasuryT5HasCode_(r25, "UNKNOWN_REVERSAL") &&
    r25.OutstandingAmount === 24000 && r25.ClearedAmount === 0,
    JSON.stringify(r25));
  var c25 = treasuryT5Reconciliation_(f25);
  check("M25b", c25.unexplainedResidual === 0 && c25.reconciliationStatus === "OK",
    JSON.stringify(c25));
  return { total: 25, pass: pass, fail: 25 - pass };
}
