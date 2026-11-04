// Treasury T2 design harness — read-only simulation of the frozen contract in
// docs/TREASURY-T2-RECEIPT-AUTHORITY-AND-RECONCILIATION-CONTRACT.md.
// Label: Treasury T2 design harness. No file writes, no network, no Apps
// Script services, no production access. Excluded from clasp via allowlist
// .claspignore (tests/ never included). Executes a 5-point Asia/Jakarta date
// battery plus the 20 frozen design-challenge cases (contract section 27).
"use strict";
var crypto = require("crypto");

var CONTRACT = "TREASURY_RECEIPT_V1";
var CASH_UNIVERSE = ["1000", "1010", "1020"];
var pass = 0, fail = 0;

function check(name, ok, detail) {
  if (ok) { pass++; console.log("  PASS " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}
function sha16(s) { return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 12).toUpperCase(); }
function payloadHash(v) {
  function canon(x) {
    if (Array.isArray(x)) return x.map(canon);
    if (x && typeof x === "object") { var o = {}; Object.keys(x).sort().forEach(function(k) { o[k] = canon(x[k]); }); return o; }
    return x;
  }
  return "H-" + sha16(JSON.stringify(canon(v)));
}
function stableId(prefix, parts) { return prefix + sha16(parts.join("|")); }
function opTypeKey(t, k) { return t + "|" + k; }

// Frozen date authority: explicit Asia/Jakarta normalization (contract 9).
function treasuryDateKey(instant) {
  var d = instant instanceof Date ? instant : new Date(instant);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta",
    year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function validDateKey(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
  var d = new Date(String(s) + "T00:00:00Z");
  return !isNaN(d.getTime()) && treasuryDateKey(d) === String(s);
}

function accountsFixture() {
  function a(code, name, type, sg, cfg, nb, active) {
    return { AccountCode: code, AccountName: name, AccountType: type,
      StatementGroup: sg, CashFlowGroup: cfg, NormalBalance: nb, IsActive: active };
  }
  return [
    a("1000", "Cash", "Asset", "Current Assets", "Operating", "DEBIT", true),
    a("1010", "DANA Business", "Asset", "Current Assets", "Operating", "DEBIT", true),
    a("1020", "Cash in Owner Custody - BluBCA", "Asset", "Current Assets", "Operating", "DEBIT", true),
    a("1030", "Sales Settlement Clearing", "Asset", "Current Assets", "Operating", "DEBIT", true),
    a("1100", "Inventory Asset", "Asset", "Current Assets", "Operating", "DEBIT", true),
    a("4000", "Sales Revenue", "Revenue", "Operating Revenue", "Operating", "CREDIT", true)
  ];
}

function freshState(opts) {
  opts = opts || {};
  var st = {
    config: { mode: opts.mode || "ACTIVE", contractVersion: CONTRACT,
      activationID: "TRACT-TEST000001", activatedAt: "2026-10-10T00:00:00.000Z", configVersion: 1 },
    accounts: accountsFixture(),
    recognitions: [], orders: {}, operations: [], receipts: [], ledger: [], audits: [],
    revision: 0, cache: null, failMode: null
  };
  var rec = opts.recognition === false ? null : {
    RecognitionID: opts.recognitionID || "SCR-CE122B27-ORD677BE5CES",
    ContractVersion: CONTRACT, EventType: "RECOGNITION",
    OrderID: opts.orderID || "ORD-677BE5CE-SALESRECOGNI",
    RevisionID: opts.revisionID || "REV-0001",
    Amount: opts.amount === undefined ? 24000 : opts.amount,
    IntegrityOK: opts.integrityOK !== false, voided: !!opts.voided
  };
  if (opts.contractVersion) rec.ContractVersion = opts.contractVersion;
  if (rec) {
    st.recognitions.push(rec);
    st.orders[rec.OrderID] = { OrderID: rec.OrderID, RevisionID: rec.RevisionID };
    // Production-equivalent V2 recognition journal (Dr1030 / Cr4000), so the
    // global reconciliation invariant (contract 20) holds from the baseline:
    var j = "SRV2J-FIXTURE-" + sha16(rec.RecognitionID);
    st.ledger.push(makeLedgerLine(st, j, 1, "2026-10-09", "1030", rec.Amount, 0,
      "SALES_RECOGNITION", "SALES_RECOGNITION_V2", rec.RecognitionID, rec.OrderID));
    st.ledger.push(makeLedgerLine(st, j, 2, "2026-10-09", "4000", 0, rec.Amount,
      "SALES_RECOGNITION", "SALES_RECOGNITION_V2", rec.RecognitionID, rec.OrderID));
  }
  return st;
}

function opByKeys(st, type, key) {
  return st.operations.find(function(o) { return o.OperationType === type && o.RequestKey === key; }) || null;
}
function opOf(st, receipt) { return st.operations.find(function(o) { return o.TreasuryOperationID === receipt.OperationID; }) || null; }
function opCommitted(st, o) { return !!o && o.State === "COMMITTED"; }
function findReceipt(st, id) { return st.receipts.find(function(r) { return r.TreasuryReceiptID === id; }) || null; }
function ledgerLines(st, journalID) { return st.ledger.filter(function(l) { return l.JournalID === journalID && l.IsActive; }); }

// Contract 8.1 canonical journal digest (same canonicalization class as
// cashJournalSignature / policyCJournalSignature_).
function journalSignature(rows) {
  return rows.map(function(r) {
    return [String(r.AccountCode), Number(r.Debit), Number(r.Credit), String(r.MovementType),
      String(r.SourceType), String(r.SourceID), String(r.Tanggal)].join("|");
  }).sort().join("||");
}

function isReversed(st, receipt) {
  return st.receipts.some(function(r) {
    return r.ReceiptType === "SALES_RECEIPT_REVERSAL" && r.ReversalOfReceiptID === receipt.TreasuryReceiptID &&
      opCommitted(st, opOf(st, r));
  });
}

// Contract 19: per-exposure authoritative projection (computed fresh on read).
function exposure(st, recognitionID) {
  var rec = st.recognitions.find(function(r) { return r.RecognitionID === recognitionID; });
  if (!rec) return null;
  var issues = [];
  var rows = st.receipts.filter(function(r) { return r.RecognitionID === recognitionID; });
  rows.forEach(function(r) {
    var op = opOf(st, r);
    if (!opCommitted(st, op)) issues.push("OP_IN_PROGRESS");
    if (r.ReceiptType !== "SALES_RECEIPT" && r.ReceiptType !== "SALES_RECEIPT_REVERSAL") issues.push("UNKNOWN_RECEIPT_TYPE");
    var lines = ledgerLines(st, r.JournalID);
    if (lines.length !== 2) issues.push("RECEIPT_UNVERIFIED");
    else if (journalSignature(lines) !== r.JournalSignature) issues.push("SIGNATURE_MISMATCH");
  });
  var activeOrdinary = rows.filter(function(r) {
    return r.ReceiptType === "SALES_RECEIPT" && !isReversed(st, r) && opCommitted(st, opOf(st, r));
  });
  if (activeOrdinary.length > 1) issues.push("DUPLICATE_ACTIVE_RECEIPTS");
  activeOrdinary.forEach(function(r) {
    var lines = ledgerLines(st, r.JournalID);
    var destLine = lines.find(function(l) { return String(l.AccountCode) === String(r.DestinationAccountCode); });
    var clearLine = lines.find(function(l) { return String(l.AccountCode) === "1030"; });
    if (!destLine || !clearLine || Number(destLine.Debit) !== Number(r.GrossAmount) ||
        Number(clearLine.Credit) !== Number(r.GrossAmount)) issues.push("DESTINATION_LEDGER_MISMATCH");
  });
  var pending = st.operations.some(function(o) {
    return o.RecognitionID === recognitionID && o.State === "IN_PROGRESS";
  });
  if (pending) issues.push("OP_IN_PROGRESS");
  var cleared = activeOrdinary.reduce(function(s, r) { return s + Number(r.GrossAmount); }, 0);
  var voided = rec.voided ? Number(rec.Amount) : 0;
  var outstanding = Number(rec.Amount) - voided - cleared;
  if (outstanding < 0) issues.push("AMOUNT_RESIDUAL");
  var status = issues.length ? "EXCEPTION" : (outstanding === 0 && (cleared > 0 || voided > 0) ? "CLEARED" :
    (outstanding > 0 ? "UNCLEARED" : outstanding === 0 ? "CLEARED" : "EXCEPTION"));
  return { RecognitionID: rec.RecognitionID, OrderID: rec.OrderID, RevisionID: rec.RevisionID,
    RecognizedAmount: Number(rec.Amount), ActiveCleared: cleared, OutstandingAmount: outstanding,
    Status: status, ActiveTreasuryReceiptID: activeOrdinary.length ? activeOrdinary[0].TreasuryReceiptID : "",
    QualityIssues: issues.slice().sort(), HasPendingOp: pending, voided: rec.voided };
}

// Contract 20: global reconciliation.
function reconcile(st) {
  var dr = 0, cr = 0, explicitException = 0;
  st.ledger.filter(function(l) { return l.IsActive && String(l.AccountCode) === "1030"; }).forEach(function(l) {
    dr += Number(l.Debit) || 0; cr += Number(l.Credit) || 0;
    var known = l.SourceType === "SALES_RECOGNITION_V2" || l.SourceType === "TREASURY_RECEIPT_V1" ||
      l.SourceType === "TREASURY_RECEIPT_REVERSAL";
    if (!known && l.ExplicitlyClassifiedException) explicitException += (Number(l.Debit) || 0) + (Number(l.Credit) || 0);
  });
  var ledgerNet = dr - cr;
  var outstandingTotal = st.recognitions.reduce(function(s, rec) {
    var ex = exposure(st, rec.RecognitionID);
    return s + (ex ? ex.OutstandingAmount : 0);
  }, 0);
  var residual = ledgerNet - outstandingTotal - explicitException;
  return { ledgerDr1030: dr, ledgerCr1030: cr, ledgerNet1030: ledgerNet,
    outstandingTotal: outstandingTotal, explicitExceptionAmount: explicitException,
    unexplainedResidual: residual, surfaced: residual !== 0 };
}

function bumpRevision(st) { st.revision += 1; st.cache = null; }
function cachedProjection(st) { // revision-keyed (contract 22)
  if (st.cache && st.cache.revision === st.revision) return st.cache.value;
  return null;
}

function destinationGate(st, code) {
  if (code === "1030") return "TREASURY_DESTINATION_IS_CLEARING";
  if (CASH_UNIVERSE.indexOf(String(code)) === -1) return "TREASURY_INVALID_DESTINATION_ACCOUNT";
  var rows = st.accounts.filter(function(a) { return a.AccountCode === String(code); });
  if (rows.length !== 1) return "TREASURY_INVALID_DESTINATION_ACCOUNT";
  if (!rows[0].IsActive) return "TREASURY_DESTINATION_ACCOUNT_INACTIVE";
  if (rows[0].AccountType !== "Asset" || rows[0].NormalBalance !== "DEBIT") return "TREASURY_INVALID_DESTINATION_ACCOUNT";
  return null;
}
function evidenceGate(ref) {
  var ev = String(ref === undefined || ref === null ? "" : ref).trim();
  if (ev.length < 3 || ev.length > 200 || /[\r\n]/.test(ev)) return "TREASURY_EVIDENCE_REF_INVALID";
  return null;
}

function persistPlan(st, type, requestKey, recognitionID, plan) {
  var op = { TreasuryOperationID: stableId("TROP-", [type, requestKey]), OperationType: type,
    RecognitionID: recognitionID, RequestKey: requestKey, State: "IN_PROGRESS",
    PayloadHash: plan.payloadHash, OperationPlan: JSON.stringify(plan), plan: plan,
    CreatedAt: plan.receivedAt, UpdatedAt: plan.receivedAt, LastError: "" };
  st.operations.push(op);
  return op;
}

function replayResult(op) {
  return { status: "DONE", code: "", replayed: true, writeCount: 0,
    receiptIDs: op.result.receiptIDs, journalIDs: op.result.journalIDs, operationID: op.TreasuryOperationID };
}

// Atomic-artifact phase (contract 16 boundary): receipt(s) + ledger + audit.
function commitArtifacts(st, op) {
  var plan = op.plan;
  plan.receiptRows.forEach(function(row) { st.receipts.push(row); });
  plan.ledgerRows.forEach(function(row) { st.ledger.push(row); });
  st.audits.push(plan.auditRow);
  op.result = { receiptIDs: plan.receiptRows.map(function(r) { return r.TreasuryReceiptID; }),
    journalIDs: plan.ledgerRows.map(function(l, i) { return i % 2 === 0 ? l.JournalID : null; })
      .filter(Boolean).reduce(function(acc, j) { return acc.indexOf(j) === -1 ? acc.concat(j) : acc; }, []) };
}

function finishOperation(st, op) {
  if (st.failMode === "afterArtifacts") { st.failMode = null;
    return { status: "UNKNOWN", code: "TREASURY_BATCH_OUTCOME_UNKNOWN",
      operationID: op.TreasuryOperationID, requestKey: op.RequestKey }; }
  op.State = "COMMITTED"; op.UpdatedAt = op.plan.receivedAt;
  bumpRevision(st);
  return { status: "DONE", code: "", replayed: false, writeCount: plan_writeCount(op),
    receiptIDs: op.result.receiptIDs, journalIDs: op.result.journalIDs, operationID: op.TreasuryOperationID };
}
function plan_writeCount(op) {
  var p = op.plan;
  return p.receiptRows.length + p.ledgerRows.length + 1;
}

function resumeOperation(st, op, hash) {
  if (op.PayloadHash !== hash) return { status: "CONFLICT", code: "TREASURY_REQUEST_KEY_CONFLICT" };
  if (op.State === "COMMITTED") return replayResult(op);
  var plan = op.plan;
  var present = plan.receiptRows.every(function(r) { return !!findReceipt(st, r.TreasuryReceiptID); });
  if (!present) {
    if (st.failMode === "beforeArtifacts") { st.failMode = null;
      return { status: "UNKNOWN", code: "TREASURY_SAVE_EXECUTION_UNKNOWN",
        operationID: op.TreasuryOperationID, requestKey: op.RequestKey }; }
    commitArtifacts(st, op);
    var ok = plan.receiptRows.every(function(r) { return !!findReceipt(st, r.TreasuryReceiptID); });
    if (!ok) return { status: "RECOVERY_REQUIRED", code: "TREASURY_ARTIFACTS_INCOMPLETE" };
    return finishOperation(st, op);
  }
  var verified = plan.receiptRows.every(function(r) {
    var got = findReceipt(st, r.TreasuryReceiptID);
    return got && got.GrossAmount === r.GrossAmount && got.DestinationAccountCode === r.DestinationAccountCode;
  });
  if (!verified) return { status: "RECOVERY_REQUIRED", code: "TREASURY_READBACK_INCOMPLETE" };
  if (!op.result) { // artifacts present, commit lost (late callback path)
    op.result = { receiptIDs: plan.receiptRows.map(function(r) { return r.TreasuryReceiptID; }),
      journalIDs: plan.ledgerRows.reduce(function(acc, l, i) {
        if (i % 2 === 0 && acc.indexOf(l.JournalID) === -1) acc.push(l.JournalID); return acc; }, []) };
  }
  op.State = "COMMITTED"; bumpRevision(st);
  return { status: "DONE", code: "", replayed: true, writeCount: 0,
    receiptIDs: op.result.receiptIDs, journalIDs: op.result.journalIDs, operationID: op.TreasuryOperationID };
}

function configGate(st) {
  var c = st.config;
  if (!c || c.contractVersion !== CONTRACT || ["PREPARED", "ACTIVE", "PAUSED"].indexOf(c.mode) === -1)
    return "TREASURY_CONFIG_INVALID";
  if (c.mode === "PREPARED") return "TREASURY_NOT_ACTIVATED";
  if (c.mode === "PAUSED") return "TREASURY_MODE_PAUSED";
  return null;
}

function normalizeSave(payload) {
  return { requestKey: String(payload && payload.requestKey || "").trim(),
    recognitionID: String(payload && payload.recognitionID || "").trim(),
    destination: String(payload && payload.destination || "").trim(),
    amount: payload && payload.amount, receiptDate: String(payload && payload.receiptDate || "").trim(),
    evidenceRef: String(payload && payload.evidenceRef || "") };
}

function makeLedgerLine(st, journalID, suffix, date, code, debit, credit, movement, sourceType, sourceID, externalRef) {
  return { JournalID: journalID, LineID: journalID + "-" + suffix, Tanggal: date, AccountCode: code,
    Debit: debit, Credit: credit, MovementType: movement, SourceType: sourceType, SourceID: sourceID,
    ExternalRef: externalRef, Keterangan: "", IsActive: true, CreatedAt: date, CreatedBy: "T2_HARNESS",
    UpdatedAt: "", UpdatedBy: "" };
}

// --- TREASURY_RECEIPT_SAVE (contract 7, 16) --------------------------------
function treasurySave(st, payload) {
  var cfgErr = configGate(st); if (cfgErr) return { status: "REFUSED", code: cfgErr };
  var n = normalizeSave(payload);
  if (!n.requestKey || !n.recognitionID) return { status: "REFUSED", code: "TREASURY_PAYLOAD_INVALID" };
  var type = "TREASURY_RECEIPT_SAVE";
  var hash = payloadHash({ type: type, requestKey: n.requestKey, recognitionID: n.recognitionID,
    destination: n.destination, amount: n.amount, receiptDate: n.receiptDate, evidenceRef: n.evidenceRef.trim() });
  var existing = opByKeys(st, type, n.requestKey);
  if (existing) return resumeOperation(st, existing, hash);

  var rec = st.recognitions.find(function(r) { return r.RecognitionID === n.recognitionID; });
  if (!rec) return { status: "REFUSED", code: "TREASURY_RECOGNITION_MISSING" };
  if (rec.ContractVersion !== CONTRACT) return { status: "REFUSED", code: "TREASURY_RECOGNITION_NOT_V2" };
  if (rec.EventType !== "RECOGNITION") return { status: "REFUSED", code: "TREASURY_NO_ELIGIBLE_EXPOSURE" };
  if (!rec.IntegrityOK) return { status: "REFUSED", code: "TREASURY_RECOGNITION_INTEGRITY_FAILURE" };
  if (!st.orders[rec.OrderID]) return { status: "REFUSED", code: "TREASURY_ORDER_LINEAGE_MISSING" };
  if (rec.voided) return { status: "REFUSED", code: "TREASURY_RECOGNITION_INACTIVE" };

  var ex = exposure(st, rec.RecognitionID);
  if (ex.Status === "EXCEPTION") return { status: "REFUSED", code: "TREASURY_EXPOSURE_EXCEPTION" };
  if (ex.HasPendingOp) return { status: "REFUSED", code: "TREASURY_EXPOSURE_BUSY" };
  if (!Number.isInteger(n.amount) || n.amount <= 0) return { status: "REFUSED", code: "TREASURY_AMOUNT_NOT_POSITIVE" };
  if (ex.OutstandingAmount <= 0) return { status: "REFUSED", code: "TREASURY_ALREADY_CLEARED" };
  if (n.amount !== ex.OutstandingAmount) return { status: "REFUSED", code: "TREASURY_AMOUNT_MISMATCH" };
  var dErr = destinationGate(st, n.destination); if (dErr) return { status: "REFUSED", code: dErr };
  var eErr = evidenceGate(n.evidenceRef); if (eErr) return { status: "REFUSED", code: eErr };
  if (!validDateKey(n.receiptDate)) return { status: "REFUSED", code: "TREASURY_DATE_INVALID" };

  var receivedAt = "2026-10-11T03:00:00.000Z";
  var receiptID = stableId("TRC-", [type, n.requestKey, "PRIMARY"]);
  var journalID = stableId("TRJ-", [type, n.requestKey, "PRIMARY"]);
  var auditID = stableId("TRA-", [type, n.requestKey, "PRIMARY"]);
  var destRow = st.accounts.find(function(a) { return a.AccountCode === n.destination; });
  var plan = { payloadHash: hash, receivedAt: receivedAt, recognitionID: n.recognitionID,
    receiptRows: [{ TreasuryReceiptID: receiptID, ContractVersion: CONTRACT, OperationID: stableId("TROP-", [type, n.requestKey]),
      RequestKey: n.requestKey, RecognitionID: n.recognitionID, OrderID: rec.OrderID, RevisionID: rec.RevisionID,
      ReceiptType: "SALES_RECEIPT", DestinationAccountCode: n.destination, GrossAmount: n.amount,
      ReceiptDate: n.receiptDate, EconomicDate: n.receiptDate, ReceivedAt: receivedAt,
      EvidenceType: "MANUAL_VERIFIED", EvidenceRef: n.evidenceRef.trim(), PostingStatus: "COMMITTED",
      JournalID: journalID, JournalSignature: "", OriginalReceiptID: "", ReversalOfReceiptID: "",
      ReplacementReceiptID: "", Reason: "", Actor: "T2_HARNESS",
      SnapshotJSON: JSON.stringify({ contractVersion: CONTRACT, activationID: st.config.activationID,
        configVersion: st.config.configVersion, operationType: type, side: "PRIMARY",
        recognitionID: n.recognitionID, orderID: rec.OrderID, revisionID: rec.RevisionID,
        recognizedAmount: rec.Amount, outstandingBefore: ex.OutstandingAmount, receiptAmount: n.amount,
        destination: { code: n.destination, name: destRow ? destRow.AccountName : "" },
        receiptDate: n.receiptDate, economicDate: n.receiptDate,
        evidence: { type: "MANUAL_VERIFIED", ref: n.evidenceRef.trim() }, journalID: journalID,
        targetReceiptID: "", reason: "" }) }],
    ledgerRows: [], auditRow: null };
  var l1 = makeLedgerLine(st, journalID, 1, n.receiptDate, n.destination, n.amount, 0, "TREASURY_RECEIPT",
    CONTRACT, receiptID, n.recognitionID);
  var l2 = makeLedgerLine(st, journalID, 2, n.receiptDate, "1030", 0, n.amount, "TREASURY_RECEIPT",
    CONTRACT, receiptID, n.recognitionID);
  plan.receiptRows[0].JournalSignature = journalSignature([l1, l2]);
  plan.ledgerRows = [l1, l2];
  plan.auditRow = { AuditID: auditID, ContractVersion: CONTRACT, OperationID: plan.receiptRows[0].OperationID,
    RequestKey: n.requestKey, TreasuryReceiptID: receiptID, RecognitionID: n.recognitionID,
    OrderID: rec.OrderID, JournalID: journalID, PayloadHash: hash, Actor: "T2_HARNESS", SavedAt: receivedAt };

  var op = persistPlan(st, type, n.requestKey, n.recognitionID, plan);
  if (st.failMode === "beforeArtifacts") { st.failMode = null;
    return { status: "UNKNOWN", code: "TREASURY_SAVE_EXECUTION_UNKNOWN",
      operationID: op.TreasuryOperationID, requestKey: n.requestKey }; }
  commitArtifacts(st, op);
  return finishOperation(st, op);
}

// --- TREASURY_RECEIPT_REVERSE (contract 12) --------------------------------
function treasuryReverse(st, payload) {
  var cfgErr = configGate(st); if (cfgErr) return { status: "REFUSED", code: cfgErr };
  var requestKey = String(payload && payload.requestKey || "").trim();
  var targetID = String(payload && payload.targetReceiptID || "").trim();
  var reason = String(payload && payload.reason || "").trim();
  if (!requestKey || !targetID) return { status: "REFUSED", code: "TREASURY_PAYLOAD_INVALID" };
  var type = "TREASURY_RECEIPT_REVERSE";
  var target = findReceipt(st, targetID);
  var recID = target ? target.RecognitionID : "";
  var hash = payloadHash({ type: type, requestKey: requestKey, targetReceiptID: targetID, reason: reason });
  var existing = opByKeys(st, type, requestKey);
  if (existing) return resumeOperation(st, existing, hash);

  if (!target) return { status: "REFUSED", code: "TREASURY_TARGET_NOT_FOUND" };
  if (target.ReceiptType !== "SALES_RECEIPT") return { status: "REFUSED", code: "TREASURY_TARGET_NOT_RECEIPT" };
  if (reason.length < 3) return { status: "REFUSED", code: "TREASURY_REASON_REQUIRED" };
  if (isReversed(st, target)) return { status: "REFUSED", code: "TREASURY_ALREADY_REVERSED" };
  var claimed = st.operations.some(function(o) {
    return o.OperationType === "TREASURY_RECEIPT_REVERSE" && o.State === "IN_PROGRESS" &&
      o.plan && o.plan.targetReceiptID === targetID; });
  if (claimed) return { status: "REFUSED", code: "TREASURY_REVERSAL_TARGET_CLAIMED" };
  if (!opCommitted(st, opOf(st, target))) return { status: "REFUSED", code: "TREASURY_EXPOSURE_BUSY" };
  var origLines = ledgerLines(st, target.JournalID);
  if (origLines.length !== 2 || journalSignature(origLines) !== target.JournalSignature)
    return { status: "REFUSED", code: "TREASURY_ORIGINAL_IMMUTABLE" };

  var receivedAt = "2026-10-12T03:00:00.000Z";
  var actionDate = treasuryDateKey(receivedAt);
  var receiptID = stableId("TRC-", [type, requestKey, "REVERSAL"]);
  var journalID = stableId("TRJ-", [type, requestKey, "REVERSAL"]);
  var auditID = stableId("TRA-", [type, requestKey, "REVERSAL"]);
  var l1 = makeLedgerLine(st, journalID, 1, actionDate, "1030", target.GrossAmount, 0,
    "TREASURY_RECEIPT_REVERSAL", CONTRACT, receiptID, target.TreasuryReceiptID);
  var l2 = makeLedgerLine(st, journalID, 2, actionDate, target.DestinationAccountCode, 0, target.GrossAmount,
    "TREASURY_RECEIPT_REVERSAL", CONTRACT, receiptID, target.TreasuryReceiptID);
  var plan = { payloadHash: hash, receivedAt: receivedAt, targetReceiptID: targetID,
    receiptRows: [{ TreasuryReceiptID: receiptID, ContractVersion: CONTRACT, OperationID: stableId("TROP-", [type, requestKey]),
      RequestKey: requestKey, RecognitionID: target.RecognitionID, OrderID: target.OrderID, RevisionID: target.RevisionID,
      ReceiptType: "SALES_RECEIPT_REVERSAL", DestinationAccountCode: target.DestinationAccountCode,
      GrossAmount: target.GrossAmount, ReceiptDate: actionDate, EconomicDate: actionDate, ReceivedAt: receivedAt,
      EvidenceType: "MANUAL_VERIFIED", EvidenceRef: "reversal", PostingStatus: "COMMITTED",
      JournalID: journalID, JournalSignature: journalSignature([l1, l2]), OriginalReceiptID: "",
      ReversalOfReceiptID: target.TreasuryReceiptID, ReplacementReceiptID: "", Reason: reason, Actor: "T2_HARNESS",
      SnapshotJSON: JSON.stringify({ contractVersion: CONTRACT, operationType: type, side: "REVERSAL",
        targetReceiptID: targetID, grossAmount: target.GrossAmount, destination: target.DestinationAccountCode,
        actionDate: actionDate, reason: reason }) }],
    ledgerRows: [l1, l2],
    auditRow: { AuditID: auditID, ContractVersion: CONTRACT, OperationID: stableId("TROP-", [type, requestKey]),
      RequestKey: requestKey, TreasuryReceiptID: receiptID, RecognitionID: target.RecognitionID,
      OrderID: target.OrderID, JournalID: journalID, PayloadHash: hash, Actor: "T2_HARNESS", SavedAt: receivedAt } };
  var op = persistPlan(st, type, requestKey, recID, plan);
  commitArtifacts(st, op);
  return finishOperation(st, op);
}

// --- TREASURY_RECEIPT_CORRECT (contract 13) --------------------------------
function treasuryCorrect(st, payload) {
  var cfgErr = configGate(st); if (cfgErr) return { status: "REFUSED", code: cfgErr };
  var requestKey = String(payload && payload.requestKey || "").trim();
  var targetID = String(payload && payload.targetReceiptID || "").trim();
  var reason = String(payload && payload.reason || "").trim();
  var rep = payload && payload.replacement || {};
  if (!requestKey || !targetID) return { status: "REFUSED", code: "TREASURY_PAYLOAD_INVALID" };
  var type = "TREASURY_RECEIPT_CORRECT";
  var hash = payloadHash({ type: type, requestKey: requestKey, targetReceiptID: targetID, reason: reason,
    replacement: { destination: rep.destination, amount: rep.amount, receiptDate: rep.receiptDate,
      evidenceRef: String(rep.evidenceRef || "").trim() } });
  var existing = opByKeys(st, type, requestKey);
  if (existing) return resumeOperation(st, existing, hash);

  var target = findReceipt(st, targetID);
  if (!target) return { status: "REFUSED", code: "TREASURY_TARGET_NOT_FOUND" };
  if (target.ReceiptType !== "SALES_RECEIPT") return { status: "REFUSED", code: "TREASURY_TARGET_NOT_RECEIPT" };
  if (reason.length < 3) return { status: "REFUSED", code: "TREASURY_REASON_REQUIRED" };
  if (isReversed(st, target)) return { status: "REFUSED", code: "TREASURY_ALREADY_REVERSED" };
  var claimed = st.operations.some(function(o) {
    return o.OperationType === "TREASURY_RECEIPT_CORRECT" && o.State === "IN_PROGRESS" &&
      o.plan && o.plan.targetReceiptID === targetID; });
  if (claimed) return { status: "REFUSED", code: "TREASURY_REPLACEMENT_TARGET_CLAIMED" };

  var ex = exposure(st, target.RecognitionID);
  var postReversalOutstanding = ex.OutstandingAmount + target.GrossAmount;
  if (!Number.isInteger(rep.amount) || rep.amount <= 0)
    return { status: "REFUSED", code: "TREASURY_AMOUNT_NOT_POSITIVE" };
  if (rep.amount !== postReversalOutstanding)
    return { status: "REFUSED", code: "TREASURY_AMOUNT_MISMATCH" };
  var dErr = destinationGate(st, rep.destination); if (dErr) return { status: "REFUSED", code: dErr };
  var eErr = evidenceGate(rep.evidenceRef); if (eErr) return { status: "REFUSED", code: eErr };
  if (!validDateKey(rep.receiptDate)) return { status: "REFUSED", code: "TREASURY_DATE_INVALID" };

  var receivedAt = "2026-10-13T03:00:00.000Z";
  var revID = stableId("TRC-", [type, requestKey, "REVERSAL"]);
  var repID = stableId("TRC-", [type, requestKey, "REPLACEMENT"]);
  var revJ = stableId("TRJ-", [type, requestKey, "REVERSAL"]);
  var repJ = stableId("TRJ-", [type, requestKey, "REPLACEMENT"]);
  var auditID = stableId("TRA-", [type, requestKey, "PRIMARY"]);
  var actionDate = treasuryDateKey(receivedAt);
  var rl1 = makeLedgerLine(st, revJ, 1, actionDate, "1030", target.GrossAmount, 0,
    "TREASURY_RECEIPT_REVERSAL", CONTRACT, revID, target.TreasuryReceiptID);
  var rl2 = makeLedgerLine(st, revJ, 2, actionDate, target.DestinationAccountCode, 0, target.GrossAmount,
    "TREASURY_RECEIPT_REVERSAL", CONTRACT, revID, target.TreasuryReceiptID);
  var pl1 = makeLedgerLine(st, repJ, 1, rep.receiptDate, rep.destination, rep.amount, 0,
    "TREASURY_RECEIPT", CONTRACT, repID, target.RecognitionID);
  var pl2 = makeLedgerLine(st, repJ, 2, rep.receiptDate, "1030", 0, rep.amount,
    "TREASURY_RECEIPT", CONTRACT, repID, target.RecognitionID);
  var destRow = st.accounts.find(function(a) { return a.AccountCode === rep.destination; });
  var plan = { payloadHash: hash, receivedAt: receivedAt, targetReceiptID: targetID,
    receiptRows: [
      { TreasuryReceiptID: revID, ContractVersion: CONTRACT, OperationID: stableId("TROP-", [type, requestKey]),
        RequestKey: requestKey, RecognitionID: target.RecognitionID, OrderID: target.OrderID, RevisionID: target.RevisionID,
        ReceiptType: "SALES_RECEIPT_REVERSAL", DestinationAccountCode: target.DestinationAccountCode,
        GrossAmount: target.GrossAmount, ReceiptDate: actionDate, EconomicDate: actionDate, ReceivedAt: receivedAt,
        EvidenceType: "MANUAL_VERIFIED", EvidenceRef: "correction-reversal", PostingStatus: "COMMITTED",
        JournalID: revJ, JournalSignature: journalSignature([rl1, rl2]), OriginalReceiptID: "",
        ReversalOfReceiptID: target.TreasuryReceiptID, ReplacementReceiptID: repID, Reason: reason,
        Actor: "T2_HARNESS", SnapshotJSON: JSON.stringify({ contractVersion: CONTRACT, side: "REVERSAL",
          targetReceiptID: targetID, replacementReceiptID: repID, reason: reason }) },
      { TreasuryReceiptID: repID, ContractVersion: CONTRACT, OperationID: stableId("TROP-", [type, requestKey]),
        RequestKey: requestKey, RecognitionID: target.RecognitionID, OrderID: target.OrderID, RevisionID: target.RevisionID,
        ReceiptType: "SALES_RECEIPT", DestinationAccountCode: rep.destination, GrossAmount: rep.amount,
        ReceiptDate: rep.receiptDate, EconomicDate: rep.receiptDate, ReceivedAt: receivedAt,
        EvidenceType: "MANUAL_VERIFIED", EvidenceRef: String(rep.evidenceRef || "").trim(), PostingStatus: "COMMITTED",
        JournalID: repJ, JournalSignature: journalSignature([pl1, pl2]), OriginalReceiptID: target.TreasuryReceiptID,
        ReversalOfReceiptID: "", ReplacementReceiptID: "", Reason: reason, Actor: "T2_HARNESS",
        SnapshotJSON: JSON.stringify({ contractVersion: CONTRACT, side: "REPLACEMENT",
          targetReceiptID: targetID, recognitionID: target.RecognitionID, destination: rep.destination,
          name: destRow ? destRow.AccountName : "", receiptDate: rep.receiptDate, economicDate: rep.receiptDate,
          receiptAmount: rep.amount }) }],
    ledgerRows: [rl1, rl2, pl1, pl2],
    auditRow: { AuditID: auditID, ContractVersion: CONTRACT, OperationID: stableId("TROP-", [type, requestKey]),
      RequestKey: requestKey, TreasuryReceiptID: repID, RecognitionID: target.RecognitionID,
      OrderID: target.OrderID, JournalID: repJ, PayloadHash: hash, Actor: "T2_HARNESS", SavedAt: receivedAt } };
  var op = persistPlan(st, type, requestKey, target.RecognitionID, plan);
  commitArtifacts(st, op);
  return finishOperation(st, op);
}

function baseSavePayload(st) {
  var ex = exposure(st, st.recognitions[0].RecognitionID);
  return { requestKey: "RK-OK-1", recognitionID: st.recognitions[0].RecognitionID,
    destination: "1010", amount: ex ? ex.OutstandingAmount : 24000,
    receiptDate: "2026-10-11", evidenceRef: "DANA transfer note VERIFIED-001" };
}
function writeCounts(st) {
  return { ops: st.operations.length, receipts: st.receipts.length,
    lines: st.ledger.length, audits: st.audits.length };
}

// ======================= DATE BATTERY (contract 9) =========================
console.log("Treasury T2 design harness — date battery (Asia/Jakarta)");
check("D1 23:59:59 Asia/Jakarta day attribution",
  treasuryDateKey("2026-12-31T16:59:59Z") === "2026-12-31",
  treasuryDateKey("2026-12-31T16:59:59Z"));
check("D2 midnight Asia/Jakarta rollover",
  treasuryDateKey("2026-12-31T17:00:00Z") === "2027-01-01",
  treasuryDateKey("2026-12-31T17:00:00Z"));
check("D3 UTC boundary (16:59:59Z vs 17:00:00Z = Jakarta midnight)",
  treasuryDateKey("2026-09-30T16:59:59Z") === "2026-09-30" &&
  treasuryDateKey("2026-09-30T17:00:00Z") === "2026-10-01");
check("D4 month boundary stays Jakarta day",
  treasuryDateKey("2026-10-31T16:59:59Z") === "2026-10-31" &&
  treasuryDateKey("2026-10-31T17:00:00Z") === "2026-11-01");
check("D5 EconomicDate == ReceiptDate on boundary date (ledger Tanggal)",
  (function() {
    var st = freshState();
    var p = baseSavePayload(st);
    p.receiptDate = "2026-10-01";
    var r1 = treasurySave(st, p);
    var row = st.receipts[0];
    var ownLines = ledgerLines(st, row.JournalID);
    return r1.status === "DONE" && row.EconomicDate === row.ReceiptDate &&
      row.ReceiptDate === "2026-10-01" && ownLines.length === 2 &&
      ownLines.every(function(l) { return l.Tanggal === "2026-10-01"; }) &&
      treasuryDateKey("2026-09-30T17:00:00Z") === "2026-10-01";
  })());
var batteryOk = fail === 0;

// ============================ 20 CHALLENGE CASES ===========================
console.log("Treasury T2 design harness — 20 design-challenge cases");

// 1 exact receipt
(function() {
  var st = freshState();
  var before = writeCounts(st), orderCount = Object.keys(st.orders).length;
  var res = treasurySave(st, baseSavePayload(st));
  var w = writeCounts(st), ex = exposure(st, st.recognitions[0].RecognitionID), rc = reconcile(st);
  var row = st.receipts[0], lines = ledgerLines(st, row.JournalID);
  check("C01 exact receipt",
    res.status === "DONE" &&
    w.ops === before.ops + 1 && w.receipts === before.receipts + 1 &&
    w.lines === before.lines + 2 && w.audits === before.audits + 1 &&
    lines.length === 2 && Number(lines[0].Debit) === 24000 && lines[0].AccountCode === "1010" &&
    Number(lines[1].Credit) === 24000 && lines[1].AccountCode === "1030" &&
    journalSignature(lines) === row.JournalSignature &&
    ex.Status === "CLEARED" && ex.OutstandingAmount === 0 &&
    rc.unexplainedResidual === 0 &&
    st.ledger.filter(function(l) { return l.SourceType === CONTRACT; })
      .every(function(l) { return l.AccountCode !== "4000" && l.AccountCode !== "2010"; }) &&
    Object.keys(st.orders).length === orderCount,
    JSON.stringify({ res: res, w: w, ex: ex.Status, rc: rc.unexplainedResidual }));
})();

// 2 duplicate RequestKey, same payload
(function() {
  var st = freshState();
  var p = baseSavePayload(st);
  var r1 = treasurySave(st, p);
  var w1 = writeCounts(st);
  var r2 = treasurySave(st, p);
  var w2 = writeCounts(st);
  check("C02 dup RequestKey same payload = exact replay",
    r1.status === "DONE" && r2.status === "DONE" && r2.replayed === true && r2.writeCount === 0 &&
    r2.receiptIDs[0] === r1.receiptIDs[0] && r2.operationID === r1.operationID &&
    w2.ops === w1.ops && w2.receipts === w1.receipts && w2.lines === w1.lines && w2.audits === w1.audits,
    JSON.stringify({ r1: r1, r2: r2, w1: w1, w2: w2 }));
})();

// 3 duplicate RequestKey, conflicting payload
(function() {
  var st = freshState();
  var p = baseSavePayload(st);
  var r1 = treasurySave(st, p);
  var p2 = Object.assign({}, p, { amount: 999, destination: "1000" });
  var r2 = treasurySave(st, p2);
  var w = writeCounts(st);
  check("C03 dup RequestKey conflicting payload = conflict",
    r1.status === "DONE" && r2.status === "CONFLICT" &&
    r2.code === "TREASURY_REQUEST_KEY_CONFLICT" &&
    w.receipts === 1 && exposure(st, st.recognitions[0].RecognitionID).Status === "CLEARED",
    JSON.stringify({ r2: r2, w: w }));
})();

// 4 new RequestKey on cleared exposure
(function() {
  var st = freshState();
  var p = baseSavePayload(st); // amount captured while exposure is uncleared
  treasurySave(st, p);
  var p2 = Object.assign({}, p, { requestKey: "RK-OK-2" });
  var r2 = treasurySave(st, p2);
  var w = writeCounts(st);
  check("C04 new RequestKey on cleared exposure refused",
    r2.status === "REFUSED" && r2.code === "TREASURY_ALREADY_CLEARED" &&
    w.receipts === 1 && w.lines === 4, JSON.stringify({ r2: r2, w: w }));
})();

// 5 simultaneous clears (both orders, serialized lock + in-lock re-read)
(function() {
  function attempt(winnerFirst) {
    var st = freshState();
    var a = baseSavePayload(st), b = baseSavePayload(st);
    b.requestKey = "RK-SIM-B";
    var first = winnerFirst ? treasurySave(st, a) : treasurySave(st, b);
    var second = winnerFirst ? treasurySave(st, b) : treasurySave(st, a);
    var ex = exposure(st, st.recognitions[0].RecognitionID);
    var done = [first, second].filter(function(r) { return r.status === "DONE"; }).length;
    var loser = [first, second].filter(function(r) {
      return r.status === "REFUSED" && r.code === "TREASURY_ALREADY_CLEARED"; }).length;
    return { done: done, loser: loser, receipts: st.receipts.length, lines: st.ledger.length, ex: ex };
  }
  var w1 = attempt(true), w2 = attempt(false);
  check("C05 simultaneous clears = exactly one active full clearing",
    w1.done === 1 && w1.loser === 1 && w1.receipts === 1 && w1.lines === 4 && w1.ex.Status === "CLEARED" &&
    w2.done === 1 && w2.loser === 1 && w2.receipts === 1 && w2.lines === 4 && w2.ex.Status === "CLEARED",
    JSON.stringify({ w1: w1, w2: w2 }));
})();

// 6 invalid destination account
(function() {
  var st = freshState();
  var p = baseSavePayload(st);
  p.destination = "7777";
  var r = treasurySave(st, p);
  check("C06 invalid destination account refused",
    r.status === "REFUSED" && r.code === "TREASURY_INVALID_DESTINATION_ACCOUNT" &&
    writeCounts(st).receipts === 0 && writeCounts(st).ops === 0 &&
    writeCounts(st).audits === 0 && writeCounts(st).lines === 2, JSON.stringify(r));
})();

// 7 destination = 1030
(function() {
  var st = freshState();
  var p = baseSavePayload(st);
  p.destination = "1030";
  var r = treasurySave(st, p);
  check("C07 destination 1030 refused",
    r.status === "REFUSED" && r.code === "TREASURY_DESTINATION_IS_CLEARING" &&
    writeCounts(st).receipts === 0, JSON.stringify(r));
})();

// 8 wrong amount
(function() {
  var st = freshState();
  var p = baseSavePayload(st);
  p.amount = 23999;
  var r = treasurySave(st, p);
  check("C08 wrong amount refused",
    r.status === "REFUSED" && r.code === "TREASURY_AMOUNT_MISMATCH" &&
    writeCounts(st).receipts === 0, JSON.stringify(r));
})();

// 9 zero amount
(function() {
  var st = freshState();
  var p = baseSavePayload(st);
  p.amount = 0;
  var r = treasurySave(st, p);
  check("C09 zero amount refused",
    r.status === "REFUSED" && r.code === "TREASURY_AMOUNT_NOT_POSITIVE" &&
    writeCounts(st).receipts === 0, JSON.stringify(r));
})();

// 10 negative amount
(function() {
  var st = freshState();
  var p = baseSavePayload(st);
  p.amount = -5;
  var r = treasurySave(st, p);
  check("C10 negative amount refused",
    r.status === "REFUSED" && r.code === "TREASURY_AMOUNT_NOT_POSITIVE" &&
    writeCounts(st).receipts === 0, JSON.stringify(r));
})();

// 11 missing / non-V2 / voided recognition
(function() {
  var a = freshState();
  var pa = baseSavePayload(a);
  pa.recognitionID = "SCR-DOES-NOT-EXIST";
  var ra = treasurySave(a, pa);
  var b = freshState({ contractVersion: "LEGACY_V1" });
  var rb = treasurySave(b, baseSavePayload(b));
  var c = freshState({ voided: true });
  var rc = treasurySave(c, baseSavePayload(c));
  var d = freshState({ integrityOK: false });
  var rd = treasurySave(d, baseSavePayload(d));
  check("C11 missing/non-V2/voided/integrity recognition refused",
    ra.status === "REFUSED" && ra.code === "TREASURY_RECOGNITION_MISSING" &&
    rb.status === "REFUSED" && rb.code === "TREASURY_RECOGNITION_NOT_V2" &&
    rc.status === "REFUSED" && rc.code === "TREASURY_RECOGNITION_INACTIVE" &&
    rd.status === "REFUSED" && rd.code === "TREASURY_RECOGNITION_INTEGRITY_FAILURE" &&
    writeCounts(a).receipts === 0 && writeCounts(b).receipts === 0 &&
    writeCounts(c).receipts === 0 && writeCounts(d).receipts === 0,
    JSON.stringify({ ra: ra, rb: rb, rc: rc, rd: rd }));
})();

// 12 UNKNOWN / late callback recovery (original RequestKey, both crash points)
(function() {
  // A: crash after IN_PROGRESS intent, before artifacts -> resume commits once.
  var a = freshState();
  var pa = baseSavePayload(a);
  a.failMode = "beforeArtifacts";
  var ra1 = treasurySave(a, pa);
  var ra2 = treasurySave(a, pa);
  var wa = writeCounts(a);
  // B: crash after atomic batch, before commit -> late callback verifies, no rewrite.
  var b = freshState();
  var pb = baseSavePayload(b);
  b.failMode = "afterArtifacts";
  var rb1 = treasurySave(b, pb);
  var rb2 = treasurySave(b, pb);
  var wb = writeCounts(b);
  var exA = exposure(a, a.recognitions[0].RecognitionID);
  var exB = exposure(b, b.recognitions[0].RecognitionID);
  check("C12 UNKNOWN/late-callback recovery = one committed receipt, no duplicates",
    ra1.status === "UNKNOWN" && ra2.status === "DONE" &&
    wa.ops === 1 && wa.receipts === 1 && wa.lines === 4 && wa.audits === 1 &&
    exA.Status === "CLEARED" && reconcile(a).unexplainedResidual === 0 &&
    rb1.status === "UNKNOWN" && rb2.status === "DONE" && rb2.replayed === true &&
    wb.ops === 1 && wb.receipts === 1 && wb.lines === 4 && wb.audits === 1 &&
    exB.Status === "CLEARED" && reconcile(b).unexplainedResidual === 0,
    JSON.stringify({ ra1: ra1, ra2: ra2, wa: wa, rb1: rb1, rb2: rb2, wb: wb }));
})();

// 13 reversal
(function() {
  var st = freshState();
  var save = treasurySave(st, baseSavePayload(st));
  var original = st.receipts[0];
  var frozen = JSON.stringify(original);
  var r = treasuryReverse(st, { requestKey: "RK-REV-1", targetReceiptID: save.receiptIDs[0],
    reason: "operator keyed wrong wallet" });
  var ex = exposure(st, st.recognitions[0].RecognitionID);
  var revRow = st.receipts.find(function(x) { return x.ReceiptType === "SALES_RECEIPT_REVERSAL"; });
  var revLines = ledgerLines(st, revRow.JournalID);
  check("C13 reversal restores exposure, original immutable",
    r.status === "DONE" && JSON.stringify(original) === frozen &&
    revLines.length === 2 && Number(revLines[0].Debit) === 24000 && revLines[0].AccountCode === "1030" &&
    Number(revLines[1].Credit) === 24000 && revLines[1].AccountCode === "1010" &&
    isReversed(st, original) === true && ex.OutstandingAmount === 24000 && ex.Status === "UNCLEARED" &&
    reconcile(st).unexplainedResidual === 0 &&
    st.ledger.filter(function(l) { return l.SourceType === CONTRACT; })
      .every(function(l) { return l.AccountCode !== "4000" && l.AccountCode !== "2010"; }),
    JSON.stringify({ r: r, ex: ex, residual: reconcile(st).unexplainedResidual }));
})();

// 14 double reversal
(function() {
  var st = freshState();
  var save = treasurySave(st, baseSavePayload(st));
  var r1 = treasuryReverse(st, { requestKey: "RK-REV-A", targetReceiptID: save.receiptIDs[0], reason: "first reversal" });
  var r2 = treasuryReverse(st, { requestKey: "RK-REV-B", targetReceiptID: save.receiptIDs[0], reason: "second reversal" });
  var reversalCount = st.receipts.filter(function(x) { return x.ReceiptType === "SALES_RECEIPT_REVERSAL"; }).length;
  check("C14 double reversal refused",
    r1.status === "DONE" && r2.status === "REFUSED" &&
    r2.code === "TREASURY_ALREADY_REVERSED" && reversalCount === 1,
    JSON.stringify({ r1: r1, r2: r2, reversalCount: reversalCount }));
})();

// 15 correction to a new destination
(function() {
  var st = freshState();
  var before = writeCounts(st);
  var save = treasurySave(st, baseSavePayload(st));
  var original = st.receipts[0];
  var frozen = JSON.stringify(original);
  var r = treasuryCorrect(st, { requestKey: "RK-COR-1", targetReceiptID: save.receiptIDs[0],
    reason: "mis-keyed destination", replacement: { destination: "1020", amount: 24000,
      receiptDate: "2026-10-11", evidenceRef: "BluBCA transfer VERIFIED-002" } });
  var w = writeCounts(st);
  var repRow = st.receipts.find(function(x) { return x.OriginalReceiptID === save.receiptIDs[0]; }) || {};
  var revRow = st.receipts.find(function(x) { return x.ReplacementReceiptID === repRow.TreasuryReceiptID; });
  var repLines = repRow.TreasuryReceiptID ? ledgerLines(st, repRow.JournalID) : [];
  var ex = exposure(st, st.recognitions[0].RecognitionID);
  check("C15 correction = reversal + replacement, original immutable, delta exact",
    r.status === "DONE" &&
    w.ops === before.ops + 2 && w.receipts === before.receipts + 3 &&
    w.lines === before.lines + 6 && w.audits === before.audits + 2 &&
    JSON.stringify(original) === frozen && !!revRow &&
    repLines.length === 2 && repLines[0].AccountCode === "1020" && Number(repLines[0].Debit) === 24000 &&
    repLines[1].AccountCode === "1030" && Number(repLines[1].Credit) === 24000 &&
    ex.Status === "CLEARED" && ex.OutstandingAmount === 0 &&
    reconcile(st).unexplainedResidual === 0,
    JSON.stringify({ r: r, w: w, ex: ex, residual: reconcile(st).unexplainedResidual }));
})();

// 16 correction with a new date
(function() {
  var st = freshState();
  var save = treasurySave(st, baseSavePayload(st));
  var original = st.receipts[0];
  var frozen = JSON.stringify(original);
  var r = treasuryCorrect(st, { requestKey: "RK-COR-2", targetReceiptID: save.receiptIDs[0],
    reason: "wrong receipt date", replacement: { destination: "1010", amount: 24000,
      receiptDate: "2026-10-12", evidenceRef: "corrected date evidence VERIFIED-003" } });
  var repRow = st.receipts.find(function(x) { return x.OriginalReceiptID === save.receiptIDs[0]; }) || {};
  var originalLines = ledgerLines(st, original.JournalID);
  var repLines = repRow.TreasuryReceiptID ? ledgerLines(st, repRow.JournalID) : [];
  check("C16 correction date: replacement dates valid, original untouched",
    r.status === "DONE" && JSON.stringify(original) === frozen &&
    repRow.ReceiptDate === "2026-10-12" && repRow.EconomicDate === repRow.ReceiptDate &&
    original.ReceiptDate === "2026-10-11" && original.EconomicDate === original.ReceiptDate &&
    repLines.length === 2 && repLines.every(function(l) { return l.Tanggal === "2026-10-12"; }) &&
    originalLines.length === 2 && originalLines.every(function(l) { return l.Tanggal === "2026-10-11"; }) &&
    reconcile(st).unexplainedResidual === 0,
    JSON.stringify({ r: r, rep: repRow.ReceiptDate, residual: reconcile(st).unexplainedResidual }));
})();

// 17 stale read model
(function() {
  var st = freshState();
  var stale = { value: exposure(st, st.recognitions[0].RecognitionID), revision: st.revision };
  st.cache = stale; // pre-warmed cache entry
  treasurySave(st, baseSavePayload(st));
  var cached = cachedProjection(st);
  var fresh = exposure(st, st.recognitions[0].RecognitionID);
  check("C17 no stale read model after DONE",
    cached === null && stale.value.Status === "UNCLEARED" && fresh.Status === "CLEARED" &&
    st.revision === stale.revision + 1,
    JSON.stringify({ cached: cached, before: stale.value.Status, after: fresh.Status, revision: st.revision }));
})();

// 18 UTC/Jakarta month + year boundary (date battery D1-D5)
check("C18 UTC/Jakarta boundary battery (D1-D5)", batteryOk, "date battery failed");

// 19 corrupted signature
(function() {
  var st = freshState();
  var save = treasurySave(st, baseSavePayload(st));
  var row = st.receipts[0];
  var lines = ledgerLines(st, row.JournalID);
  lines[0].Debit = 999999; // tamper after commit
  var ex = exposure(st, st.recognitions[0].RecognitionID);
  var retry = baseSavePayload(st);
  retry.requestKey = "RK-NEW-AFTER-TAMPER";
  var r = treasurySave(st, retry);
  check("C19 corrupted signature => EXCEPTION, fail-closed, no auto-repair",
    ex.Status === "EXCEPTION" && ex.QualityIssues.indexOf("SIGNATURE_MISMATCH") !== -1 &&
    r.status === "REFUSED" && r.code === "TREASURY_EXPOSURE_EXCEPTION" &&
    lines[0].Debit === 999999, JSON.stringify({ ex: ex, r: r }));
})();

// 20 unexplained residual
(function() {
  var st = freshState();
  var clean = reconcile(st);
  st.ledger.push(makeLedgerLine(st, "ORPHAN-J-1", 1, "2026-10-10", "1030", 5000, 0,
    "MYSTERY", "UNKNOWN_SOURCE", "X", ""));
  var dirty = reconcile(st);
  st.ledger.pop();
  var restored = reconcile(st);
  check("C20 unexplained residual surfaced, never auto-repaired",
    clean.unexplainedResidual === 0 && clean.surfaced === false &&
    dirty.unexplainedResidual === 5000 && dirty.surfaced === true &&
    restored.unexplainedResidual === 0,
    JSON.stringify({ clean: clean, dirty: dirty, restored: restored }));
})();

console.log("===== TREASURY T2 DESIGN HARNESS: " + pass + " PASS, " + fail + " FAIL =====");
process.exit(fail > 0 ? 1 : 0);
