// Treasury T6 lifecycle writer for TREASURY_RECEIPT_V1: durable APPEND-ONLY
// receipt reversal (Dr 1030 X / Cr original destination X) and financial
// correction (full reversal + full replacement, ONE operation, ONE atomic
// business batch) on top of the T3 foundation (99.Treasury.Receipt.
// Foundation.js) and the T4 durable core (99A.Treasury.Receipt.Durable.Save.js).
// Reuses the proven T4 machinery — RequestKey-first lookup, frozen immutable
// OperationPlan, durable IN_PROGRESS intent + exact ten-field readback, ONE
// spreadsheets.batchUpdate (appendCells) atomic boundary, exact artifact
// verification + journal signature recomputation from persisted rows,
// COMMITTED + exact readback, cache-on-DONE, outer-lock wrapper — and adds the
// T2 section 12/13 lifecycle gates (target resolution, original integrity,
// one-reversal-max, lineage claims) with the frozen T2 section 24
// reversal/correction codes. Originals are IMMUTABLE: no update/delete
// primitive against receipt rows exists here; lineage travels on appended rows.
// Reversal/correction dates: the reversal side's ReceiptDate/EconomicDate =
// server action day normalized to Asia/Jakarta (T2 section 9 — NO operator
// ReversalDate input); a correction's replacement receipt carries an operator
// ReceiptDate like any receipt. Audit granularity N = 1 per operation (T2
// section 17; the CORRECT audit carries the replacement receipt id). T5
// (99B.Treasury.Clearing.Projection.js) remains the canonical read side and
// consumes these artifacts through its generic semantics — no T6 special-case
// exists in the projection. Authority:
// docs/TREASURY-T2-RECEIPT-AUTHORITY-AND-RECONCILIATION-CONTRACT.md sections
// 4-18, 22, 24 on top of the frozen T2 reversal (section 12) and correction
// (section 13) contracts. LOCAL/fixture execution only from tests; the
// production wrappers are never invoked locally. NO UI, NO refund workflow, NO
// reversal-of-reversal, NO production mutation, NO Sales mutation.
var TREASURY_RECEIPT_V1_LIFECYCLE = Object.freeze({
  PLAN_VERSION: 1,
  REVERSE: Object.freeze({
    OPERATION_TYPE: "TREASURY_RECEIPT_REVERSE",
    SIDE: "REVERSAL",
    RECEIPT_TYPE: "SALES_RECEIPT_REVERSAL",
    MOVEMENT_TYPE: "TREASURY_RECEIPT_REVERSAL",
    FRESH_WRITE_COUNT: 4
  }),
  CORRECT: Object.freeze({
    OPERATION_TYPE: "TREASURY_RECEIPT_CORRECT",
    SIDE: "REPLACEMENT",
    REVERSAL_RECEIPT_TYPE: "SALES_RECEIPT_REVERSAL",
    REPLACEMENT_RECEIPT_TYPE: "SALES_RECEIPT",
    REVERSAL_MOVEMENT_TYPE: "TREASURY_RECEIPT_REVERSAL",
    REPLACEMENT_MOVEMENT_TYPE: "TREASURY_RECEIPT",
    FRESH_WRITE_COUNT: 7
  }),
  // The only surfaces a lifecycle batch may ever touch (identical to T4).
  WRITE_SURFACES: Object.freeze(["TreasuryReceipts", "BalanceLedger", "TreasuryAudits"]),
  MIN_REASON: 3,
  MAX_REASON: 200,
  MIN_EVIDENCE_REF: 3,
  MAX_EVIDENCE_REF: 200,
  // Deterministic server-derived evidence anchor for reversal rows: the
  // operator never supplies evidence facts for a reversal (T2 section 12), so
  // the row carries a non-secret, bounded, deterministic reference.
  REVERSAL_EVIDENCE_PREFIX: "REVERSAL:",
  STATUS: Object.freeze({
    DONE: "DONE", REFUSED: "REFUSED", CONFLICT: "CONFLICT",
    UNKNOWN: "UNKNOWN", RECOVERY_REQUIRED: "RECOVERY_REQUIRED"
  }),
  // Frozen T2 section 24 catalog used by T6. T3/T4-owned codes reference the
  // existing constants directly (single source); the reversal/correction codes
  // are the exact frozen T2 strings — no aliases, no invented codes.
  CODES: (function() {
    var t3 = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
    var t4 = TREASURY_RECEIPT_V1_SAVE.CODES;
    return Object.freeze({
      CONFIG_INVALID: t3.CONFIG_INVALID,
      NOT_ACTIVATED: t3.NOT_ACTIVATED,
      MODE_PAUSED: t3.MODE_PAUSED,
      SCHEMA_NOT_READY: t3.SCHEMA_NOT_READY,
      INVALID_DESTINATION_ACCOUNT: t3.INVALID_DESTINATION_ACCOUNT,
      DESTINATION_ACCOUNT_INACTIVE: t3.DESTINATION_ACCOUNT_INACTIVE,
      DESTINATION_IS_CLEARING: t3.DESTINATION_IS_CLEARING,
      FORBIDDEN_JOURNAL_ACCOUNT: t3.FORBIDDEN_JOURNAL_ACCOUNT,
      DATE_INVALID: t3.DATE_INVALID,
      ECONOMIC_DATE_MISMATCH: t3.ECONOMIC_DATE_MISMATCH,
      CONTRACT_VERSION_MISMATCH: t3.CONTRACT_VERSION_MISMATCH,
      PAYLOAD_INVALID: t3.PAYLOAD_INVALID,
      EVIDENCE_TYPE_INVALID: t4.EVIDENCE_TYPE_INVALID,
      EVIDENCE_REF_INVALID: t4.EVIDENCE_REF_INVALID,
      RECOGNITION_MISSING: t4.RECOGNITION_MISSING,
      RECOGNITION_NOT_V2: t4.RECOGNITION_NOT_V2,
      RECOGNITION_INTEGRITY_FAILURE: t4.RECOGNITION_INTEGRITY_FAILURE,
      ORDER_LINEAGE_MISSING: t4.ORDER_LINEAGE_MISSING,
      RECOGNITION_INACTIVE: t4.RECOGNITION_INACTIVE,
      NO_ELIGIBLE_EXPOSURE: t4.NO_ELIGIBLE_EXPOSURE,
      EXPOSURE_BUSY: t4.EXPOSURE_BUSY,
      EXPOSURE_EXCEPTION: t4.EXPOSURE_EXCEPTION,
      AMOUNT_NOT_POSITIVE: t4.AMOUNT_NOT_POSITIVE,
      AMOUNT_MISMATCH: t4.AMOUNT_MISMATCH,
      REQUEST_KEY_CONFLICT: t4.REQUEST_KEY_CONFLICT,
      DUPLICATE_RECEIPT_ID: t4.DUPLICATE_RECEIPT_ID,
      DUPLICATE_JOURNAL_SOURCE: t4.DUPLICATE_JOURNAL_SOURCE,
      JOURNAL_SIGNATURE_INVALID: t4.JOURNAL_SIGNATURE_INVALID,
      OPERATION_PLAN_MALFORMED: t4.OPERATION_PLAN_MALFORMED,
      OPERATION_STATE_CORRUPTED: t4.OPERATION_STATE_CORRUPTED,
      LOCK_TIMEOUT: t4.LOCK_TIMEOUT,
      INTENT_READBACK_FAILED: t4.INTENT_READBACK_FAILED,
      ARTIFACTS_INCOMPLETE: t4.ARTIFACTS_INCOMPLETE,
      BATCH_OUTCOME_UNKNOWN: t4.BATCH_OUTCOME_UNKNOWN,
      READBACK_INCOMPLETE: t4.READBACK_INCOMPLETE,
      SAVE_EXECUTION_UNKNOWN: t4.SAVE_EXECUTION_UNKNOWN,
      PAYLOAD_TOO_LARGE: t4.PAYLOAD_TOO_LARGE,
      RECOVERY_REQUIRED: t4.RECOVERY_REQUIRED,
      TARGET_NOT_FOUND: "TREASURY_TARGET_NOT_FOUND",
      TARGET_NOT_RECEIPT: "TREASURY_TARGET_NOT_RECEIPT",
      ALREADY_REVERSED: "TREASURY_ALREADY_REVERSED",
      REVERSAL_TARGET_CLAIMED: "TREASURY_REVERSAL_TARGET_CLAIMED",
      REPLACEMENT_TARGET_CLAIMED: "TREASURY_REPLACEMENT_TARGET_CLAIMED",
      REASON_REQUIRED: "TREASURY_REASON_REQUIRED",
      ORIGINAL_IMMUTABLE: "TREASURY_ORIGINAL_IMMUTABLE"
    });
  })()
});

function treasuryLifecycleError_(code, field, message) {
  var error = new Error(message || code);
  error.treasuryCode = code;
  error.field = field || "";
  return error;
}

// Envelope result — SAME class as the T4 envelope (never a { success: false }
// DTO) plus the lifecycle identity field. UNKNOWN / RECOVERY_REQUIRED always
// retain requestKey + operation + receipt identities.
function treasuryLifecycleResult_(status, fields) {
  var result = treasuryReceiptSaveResult_(status, fields);
  if (result.reversalReceiptID === undefined) result.reversalReceiptID = "";
  return result;
}

function treasuryLifecyclePayloadKey_(payload) {
  return payload && payload.requestKey !== undefined && payload.requestKey !== null ?
    String(payload.requestKey) : "";
}

// ---------------------------------------------------------------------------
// Pure input normalization (T2 sections 12, 13, 16 step 1; operator facts
// ONLY — the server derives every other fact). Definite refusals fail here
// before any read or write. The exact normalized structure is persisted in the
// plan and compared verbatim on replay/conflict.
// ---------------------------------------------------------------------------
function treasuryLifecycleNoteOk_(text, min, max) {
  return typeof text === "string" && text.length >= min && text.length <= max &&
    !/[\x00-\x1F\x7F]/.test(text) &&
    !/\d{13,19}/.test(text.replace(/[- ]/g, "")) &&
    !/(password|passwd|secret|token\s*[=:]|pin\s*[=:])/i.test(text);
}

function treasuryLifecycleRequestKey_(p, save) {
  var requestKey = p.requestKey === undefined || p.requestKey === null ?
    "" : String(p.requestKey).trim();
  if (!new RegExp("^[A-Za-z0-9][A-Za-z0-9._:-]{3,127}$").test(requestKey) ||
      requestKey.length > 128) {
    throw treasuryLifecycleError_(TREASURY_RECEIPT_V1_LIFECYCLE.CODES.PAYLOAD_INVALID,
      "requestKey", "REQUEST_KEY_INVALID");
  }
  return requestKey;
}

function treasuryLifecycleTargetId_(p) {
  var target = p.treasuryReceiptID === undefined || p.treasuryReceiptID === null ?
    "" : String(p.treasuryReceiptID).trim();
  if (!/^TRC-[A-Za-z0-9-]{3,127}$/.test(target)) {
    throw treasuryLifecycleError_(TREASURY_RECEIPT_V1_LIFECYCLE.CODES.PAYLOAD_INVALID,
      "treasuryReceiptID", "TREASURY_RECEIPT_ID_INVALID");
  }
  return target;
}

function treasuryLifecycleReason_(p) {
  var codes = TREASURY_RECEIPT_V1_LIFECYCLE.CODES;
  var reason = p.reason === undefined || p.reason === null ? "" : String(p.reason).trim();
  if (!treasuryLifecycleNoteOk_(reason, TREASURY_RECEIPT_V1_LIFECYCLE.MIN_REASON,
      TREASURY_RECEIPT_V1_LIFECYCLE.MAX_REASON)) {
    throw treasuryLifecycleError_(codes.REASON_REQUIRED, "reason", "REASON_INVALID");
  }
  return reason;
}

function treasuryLifecycleActor_(p) {
  var actor = p.actor === undefined || p.actor === null ? "" : String(p.actor).trim();
  if (actor && (actor.length > 200 || /[\x00-\x1F\x7F]/.test(actor))) {
    throw treasuryLifecycleError_(TREASURY_RECEIPT_V1_LIFECYCLE.CODES.PAYLOAD_INVALID,
      "actor", "ACTOR_INVALID");
  }
  return actor;
}

function treasuryNormalizeReversalRequest_(payload) {
  var p = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  return {
    requestKey: treasuryLifecycleRequestKey_(p),
    treasuryReceiptID: treasuryLifecycleTargetId_(p),
    reason: treasuryLifecycleReason_(p),
    actor: treasuryLifecycleActor_(p)
  };
}

function treasuryNormalizeCorrectionRequest_(payload) {
  var codes = TREASURY_RECEIPT_V1_LIFECYCLE.CODES;
  var p = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  var destinationAccountCode = p.destinationAccountCode === undefined ||
    p.destinationAccountCode === null ? "" : String(p.destinationAccountCode).trim();
  if (!destinationAccountCode || destinationAccountCode.length > 16 ||
      /[\x00-\x1F\x7F]/.test(destinationAccountCode)) {
    throw treasuryLifecycleError_(codes.PAYLOAD_INVALID, "destinationAccountCode",
      "DESTINATION_ACCOUNT_CODE_INVALID");
  }
  var receiptDate = typeof p.receiptDate === "string" ? p.receiptDate.trim() : "";
  if (treasuryValidateReceiptDate(receiptDate).status !== "PASS") {
    throw treasuryLifecycleError_(codes.DATE_INVALID, "receiptDate", "RECEIPT_DATE_INVALID");
  }
  var evidenceType = typeof p.evidenceType === "string" ? p.evidenceType.trim() : "";
  if (evidenceType !== TREASURY_RECEIPT_V1_CONTRACT.EVIDENCE_TYPE) {
    throw treasuryLifecycleError_(codes.EVIDENCE_TYPE_INVALID, "evidenceType",
      "EVIDENCE_TYPE_MUST_BE_MANUAL_VERIFIED");
  }
  var evidenceRef = typeof p.evidenceRef === "string" ? p.evidenceRef.trim() : "";
  if (!treasuryLifecycleNoteOk_(evidenceRef, TREASURY_RECEIPT_V1_LIFECYCLE.MIN_EVIDENCE_REF,
      TREASURY_RECEIPT_V1_LIFECYCLE.MAX_EVIDENCE_REF)) {
    throw treasuryLifecycleError_(codes.EVIDENCE_REF_INVALID, "evidenceRef",
      "EVIDENCE_REF_INVALID");
  }
  return {
    requestKey: treasuryLifecycleRequestKey_(p),
    treasuryReceiptID: treasuryLifecycleTargetId_(p),
    destinationAccountCode: destinationAccountCode,
    receiptDate: receiptDate,
    evidenceType: evidenceType,
    evidenceRef: evidenceRef,
    reason: treasuryLifecycleReason_(p),
    actor: treasuryLifecycleActor_(p)
  };
}

// ---------------------------------------------------------------------------
// Durable Treasury sheet reads (independent T3 sheets; never the Transaction
// repositories — T2 section 3).
// ---------------------------------------------------------------------------
function treasuryLifecycleReadRows_(ss, schemaKey) {
  var schema = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS[schemaKey];
  return readCanonicalTable(ss, schema.SHEET, schema.HEADERS);
}

function treasuryLifecycleLedgerRows_(ss) {
  return readCanonicalTable(ss, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
}

// ---------------------------------------------------------------------------
// Target resolution + ORIGINAL integrity (T2 section 12): the target must be
// a structurally valid committed ordinary receipt whose producing operation is
// COMMITTED and whose journal + audit artifacts verify. Any uninterpretable
// original state fails closed (EXPOSURE_EXCEPTION class) — never repaired,
// never treated as reversible.
// ---------------------------------------------------------------------------
function treasuryLifecycleResolveTarget_(ss, targetReceiptID) {
  var codes = TREASURY_RECEIPT_V1_LIFECYCLE.CODES;
  var receipts;
  try { receipts = treasuryLifecycleReadRows_(ss, "RECEIPTS"); }
  catch (error) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "TARGET_READ_FAILED:" + error.message);
  }
  var matches = receipts.filter(function(row) {
    return String(row.TreasuryReceiptID === undefined || row.TreasuryReceiptID === null ?
      "" : row.TreasuryReceiptID).trim() === targetReceiptID;
  });
  if (!matches.length) {
    throw treasuryLifecycleError_(codes.TARGET_NOT_FOUND, "treasuryReceiptID", "NO_TARGET_ROW");
  }
  if (matches.length > 1) {
    throw treasuryLifecycleError_(codes.TARGET_NOT_FOUND, "treasuryReceiptID",
      "DUPLICATE_TARGET_ROW:" + matches.length);
  }
  return matches[0];
}

function treasuryLifecycleOperationById_(ss, operationID) {
  var rows = treasuryLifecycleReadRows_(ss, "OPERATIONS");
  return rows.filter(function(row) {
    return String(row.TreasuryOperationID) === String(operationID);
  });
}

// Full ORIGINAL verification. Returns the producing COMMITTED operation row.
// Throws a treasuryLifecycleError_ (REFUSED class) on every failure path.
function treasuryLifecycleVerifyOriginal_(ss, target) {
  var codes = TREASURY_RECEIPT_V1_LIFECYCLE.CODES, contract = TREASURY_RECEIPT_V1_CONTRACT;
  var targetID = String(target.TreasuryReceiptID);
  if (String(target.ContractVersion || "") !== contract.CONTRACT_VERSION ||
      String(target.PostingStatus || "") !== contract.POSTING_STATUS_COMMITTED) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_UNVERIFIED");
  }
  if (String(target.ReceiptType || "") !== "SALES_RECEIPT") {
    throw treasuryLifecycleError_(codes.TARGET_NOT_RECEIPT, "treasuryReceiptID",
      "RECEIPT_TYPE:" + String(target.ReceiptType || ""));
  }
  var amount = Number(target.GrossAmount);
  if (!isFinite(amount) || amount <= 0 || Math.floor(amount) !== amount) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_AMOUNT_INVALID");
  }
  if (treasuryValidateReceiptDate(target.ReceiptDate).status !== "PASS" ||
      treasuryValidateReceiptDate(target.EconomicDate).status !== "PASS" ||
      String(target.ReceiptDate) !== String(target.EconomicDate)) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_DATE_INVALID");
  }
  if (!String(target.OrderID || "") || !String(target.RevisionID || "") ||
      !String(target.RecognitionID || "")) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_LINEAGE_MISSING");
  }
  var operations = treasuryLifecycleOperationById_(ss, target.OperationID);
  if (!operations.length) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_OPERATION_MISSING");
  }
  if (operations.length > 1) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_OPERATION_DUPLICATE");
  }
  var operation = operations[0];
  if (TREASURY_RECEIPT_V1_CONTRACT.OPERATION_TYPES.indexOf(String(operation.OperationType)) === -1 ||
      String(operation.RequestKey || "") !== String(target.RequestKey || "") ||
      String(operation.RecognitionID || "") !== String(target.RecognitionID || "")) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_OPERATION_MISMATCH");
  }
  var state = String(operation.State === undefined || operation.State === null ?
    "" : operation.State);
  if (state === "IN_PROGRESS") {
    throw treasuryLifecycleError_(codes.EXPOSURE_BUSY, "treasuryReceiptID",
      "ORIGINAL_OPERATION_PENDING:" + String(operation.TreasuryOperationID));
  }
  if (state !== "COMMITTED") {
    throw treasuryLifecycleError_(codes.OPERATION_STATE_CORRUPTED, "treasuryReceiptID",
      "ORIGINAL_OPERATION_STATE:" + state);
  }
  try { JSON.parse(String(operation.OperationPlan || "")); }
  catch (error) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_PLAN_MALFORMED");
  }
  var ledger = treasuryLifecycleLedgerRows_(ss);
  var lines = ledger.filter(function(row) {
    return String(row.SourceType) === contract.SOURCE_TYPE &&
      String(row.SourceID) === targetID;
  });
  if (lines.length !== 2) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_JOURNAL_LINES:" + lines.length);
  }
  var journalID = String(target.JournalID || "");
  var lineIds = lines.map(function(row) { return String(row.LineID); }).sort().join(",");
  if (lineIds !== [journalID + "-1", journalID + "-2"].sort().join(",") ||
      !lines.every(function(row) { return String(row.JournalID) === journalID; })) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_JOURNAL_IDENTITY");
  }
  var debit = 0, credit = 0;
  lines.forEach(function(row) { debit += Number(row.Debit); credit += Number(row.Credit); });
  if (!(debit === credit && debit === amount)) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_JOURNAL_BALANCE");
  }
  if (treasuryJournalSignature(lines) !== String(target.JournalSignature || "")) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_SIGNATURE_MISMATCH");
  }
  var audits = treasuryLifecycleReadRows_(ss, "AUDITS").filter(function(row) {
    return String(row.TreasuryReceiptID) === targetID;
  });
  if (audits.length > 1) {
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "ORIGINAL_AUDIT_DUPLICATE");
  }
  if (!audits.length) {
    // Op-audit fallback (T5 generic coverage): the single frozen audit of the
    // original's own COMMITTED operation may cover the original ONLY after
    // exact operation ownership and planned membership proven against its plan.
    var plan = null;
    try { plan = JSON.parse(String(operation.OperationPlan || "")); }
    catch (error) { plan = null; }
    var context = {
      operationRowsById: {}, auditsByOperationID: {}
    };
    context.operationRowsById[String(operation.TreasuryOperationID)] = [operation];
    treasuryLifecycleReadRows_(ss, "AUDITS").forEach(function(audit) {
      var key = String(audit.OperationID || "");
      (context.auditsByOperationID[key] = context.auditsByOperationID[key] || []).push(audit);
    });
    var covered = plan && treasuryClearingOperationAuditCovers_(target, context, contract,
      String(target.RecognitionID), String(target.OrderID), targetID);
    if (!covered) {
      throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
        "ORIGINAL_AUDIT_MISSING");
    }
  }
  return operation;
}

// One-reversal-max + lineage claim scan (T2 section 12). A committed reversal
// against the target refuses any further reversal/correction of that target;
// an IN_PROGRESS foreign lifecycle claim refuses with the frozen claimed code;
// any other foreign IN_PROGRESS operation on the same exposure is
// EXPOSURE_BUSY. Kind: "REVERSE" | "CORRECT".
function treasuryLifecycleClaimScan_(ss, target, kind) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES;
  var targetID = String(target.TreasuryReceiptID);
  var recognitionID = String(target.RecognitionID);
  var receipts = treasuryLifecycleReadRows_(ss, "RECEIPTS");
  var reversalRows = receipts.filter(function(row) {
    return String(row.ReversalOfReceiptID === undefined ||
      row.ReversalOfReceiptID === null ? "" : row.ReversalOfReceiptID) === targetID;
  });
  var operations = treasuryLifecycleReadRows_(ss, "OPERATIONS");
  var operationById = {};
  operations.forEach(function(op) {
    operationById[String(op.TreasuryOperationID)] = op;
  });
  var seen = {};
  reversalRows.forEach(function(row) {
    var id = String(row.TreasuryReceiptID);
    if (seen[id]) return;
    seen[id] = true;
    var op = operationById[String(row.OperationID)];
    if (!op) {
      throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
        "REVERSAL_OPERATION_MISSING:" + id);
    }
    var state = String(op.State === undefined || op.State === null ? "" : op.State);
    if (state === "COMMITTED") {
      throw treasuryLifecycleError_(codes.ALREADY_REVERSED, "treasuryReceiptID",
        "REVERSAL:" + id);
    }
    if (state === "IN_PROGRESS") {
      throw treasuryLifecycleError_(kind === "CORRECT" ?
        codes.REPLACEMENT_TARGET_CLAIMED : codes.REVERSAL_TARGET_CLAIMED,
        "treasuryReceiptID", "REVERSAL_IN_PROGRESS:" + id);
    }
    throw treasuryLifecycleError_(codes.EXPOSURE_EXCEPTION, "treasuryReceiptID",
      "REVERSAL_STATE:" + state);
  });
  operations.forEach(function(op) {
    if (String(op.State) !== "IN_PROGRESS") return;
    if (String(op.TreasuryOperationID) === "") return;
    var claimsTarget = false;
    try {
      var plan = JSON.parse(String(op.OperationPlan || ""));
      claimsTarget = String(plan && plan.targetReceiptID || "") === targetID ||
        (Array.isArray(plan && plan.plannedReceiptIds) &&
          plan.plannedReceiptIds.indexOf(targetID) !== -1) ||
        String(plan && plan.receiptID || "") === targetID;
    } catch (error) { claimsTarget = false; }
    if (!claimsTarget) {
      try {
        var normalized = JSON.parse(String(op.OperationPlan || "")).normalizedPayload;
        claimsTarget = String(normalized && normalized.treasuryReceiptID || "") === targetID;
      } catch (error2) { claimsTarget = false; }
    }
    if (claimsTarget) {
      throw treasuryLifecycleError_(kind === "CORRECT" ?
        codes.REPLACEMENT_TARGET_CLAIMED : codes.REVERSAL_TARGET_CLAIMED,
        "treasuryReceiptID", "OPERATION:" + String(op.TreasuryOperationID));
    }
    if (String(op.RecognitionID) === recognitionID) {
      throw treasuryLifecycleError_(codes.EXPOSURE_BUSY, "treasuryReceiptID",
        "OPERATION:" + String(op.TreasuryOperationID));
    }
  });
  return { reversalCount: reversalRows.length };
}

// Destination + clearing preflight for a lifecycle journal account (T2
// sections 6, 21): the account posting on either side must remain an eligible
// active cash/bank destination and 1030 must remain structurally usable.
function treasuryLifecycleAccountGate_(ss, destinationCode) {
  var codes = TREASURY_RECEIPT_V1_LIFECYCLE.CODES;
  var accountRows;
  try { accountRows = treasuryReceiptAccountRows_(ss); }
  catch (error) {
    throw treasuryLifecycleError_(codes.SCHEMA_NOT_READY, "destinationAccountCode",
      "ACCOUNTS:" + error.message);
  }
  var destinationCheck = treasuryDestinationEligible(destinationCode, accountRows);
  if (!destinationCheck.eligible) {
    throw treasuryLifecycleError_(destinationCheck.code, "destinationAccountCode",
      destinationCheck.reason);
  }
  var clearing = treasuryClearingPreflight(accountRows);
  if (clearing.status !== "PASS") {
    var clearingError = clearing.errors[0] || {};
    throw treasuryLifecycleError_(codes.SCHEMA_NOT_READY, "1030",
      "CLEARING_1030:" + String(clearingError.reason || "UNKNOWN"));
  }
  var row = accountRows.filter(function(entry) {
    return String(entry.AccountCode) === destinationCode;
  })[0];
  return { code: destinationCode,
    name: String(row && row.AccountName !== undefined && row.AccountName !== null ?
      row.AccountName : "") };
}

// ---------------------------------------------------------------------------
// Immutable plan rows (T2 sections 8, 12, 13, 17, 18). Every row, identity,
// signature, snapshot, and digest is derived ONCE at freeze; nothing is
// recomputed differently after a partial failure.
// ---------------------------------------------------------------------------
function treasuryLifecycleJournalRow_(journalID, lineNo, dateKey, accountCode,
    debit, credit, movementType, sourceID, externalRef, nowISO, actor) {
  return { JournalID: journalID, LineID: journalID + "-" + lineNo, Tanggal: dateKey,
    AccountCode: accountCode, Debit: debit, Credit: credit,
    MovementType: movementType, SourceType: TREASURY_RECEIPT_V1_CONTRACT.SOURCE_TYPE,
    SourceID: sourceID, ExternalRef: externalRef, Keterangan: "", IsActive: true,
    CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor };
}

// Reversal journal (T2 section 8.1 / 12): exactly Dr 1030 X / Cr original
// destination X. Revenue/HPP/Inventory/AP/refund-payable accounts stay
// structurally impossible; signature recomputed from the
// reversed-leg rows (≠ the original signature because the rows differ).
function treasuryLifecycleReversalJournalRows_(journalID, dateKey, destinationCode,
    amount, sourceID, externalRef, nowISO, actor) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  return [
    treasuryLifecycleJournalRow_(journalID, 1, dateKey, contract.CLEARING_ACCOUNT_CODE,
      amount, 0, "TREASURY_RECEIPT_REVERSAL", sourceID, externalRef, nowISO, actor),
    treasuryLifecycleJournalRow_(journalID, 2, dateKey, destinationCode, 0, amount,
      "TREASURY_RECEIPT_REVERSAL", sourceID, externalRef, nowISO, actor)
  ];
}

// Replacement journal (ordinary receipt shape): Dr corrected destination X /
// Cr 1030 X on the replacement's own economic date.
function treasuryLifecycleReplacementJournalRows_(journalID, dateKey, destinationCode,
    amount, sourceID, externalRef, nowISO, actor) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  return [
    treasuryLifecycleJournalRow_(journalID, 1, dateKey, destinationCode, amount, 0,
      "TREASURY_RECEIPT", sourceID, externalRef, nowISO, actor),
    treasuryLifecycleJournalRow_(journalID, 2, dateKey, contract.CLEARING_ACCOUNT_CODE,
      0, amount, "TREASURY_RECEIPT", sourceID, externalRef, nowISO, actor)
  ];
}

function treasuryLifecycleReceiptRow_(input) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  return {
    TreasuryReceiptID: input.receiptID,
    ContractVersion: contract.CONTRACT_VERSION,
    OperationID: input.operationID,
    RequestKey: input.requestKey,
    RecognitionID: input.recognitionID,
    OrderID: input.orderID,
    RevisionID: input.revisionID,
    ReceiptType: input.receiptType,
    DestinationAccountCode: input.destinationCode,
    GrossAmount: input.amount,
    ReceiptDate: input.receiptDate,
    EconomicDate: input.economicDate,
    ReceivedAt: input.savedAt,
    EvidenceType: input.evidenceType,
    EvidenceRef: input.evidenceRef,
    JournalID: input.journalID,
    JournalSignature: input.journalSignature,
    PostingStatus: contract.POSTING_STATUS_COMMITTED,
    OriginalReceiptID: input.originalReceiptID || "",
    ReversalOfReceiptID: input.reversalOfReceiptID || "",
    ReplacementReceiptID: input.replacementReceiptID || "",
    Reason: input.reason,
    Actor: input.actor,
    SnapshotJSON: JSON.stringify(input.snapshot)
  };
}

function treasuryLifecycleOriginalSnapshotPart_(target, targetHash) {
  return { receiptID: String(target.TreasuryReceiptID),
    journalID: String(target.JournalID || ""),
    journalSignature: String(target.JournalSignature || ""),
    receiptDate: String(target.ReceiptDate || ""),
    economicDate: String(target.EconomicDate || ""),
    grossAmount: Number(target.GrossAmount),
    destinationCode: String(target.DestinationAccountCode || ""),
    receiptHash: targetHash };
}

function treasuryLifecycleAuditRow_(input) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  return { AuditID: input.auditID, ContractVersion: contract.CONTRACT_VERSION,
    OperationID: input.operationID, RequestKey: input.requestKey,
    TreasuryReceiptID: input.primaryReceiptID, RecognitionID: input.recognitionID,
    OrderID: input.orderID, JournalID: input.primaryJournalID,
    PayloadHash: input.hash, Actor: input.actor, SavedAt: input.savedAt };
}

function treasuryLifecyclePlanDigest_(plan) {
  var copy = Object.assign({}, plan);
  copy.planDigest = transactionPayloadHash_(copy);
  return copy;
}

// Pure REVERSE plan freeze. side = REVERSAL; exactly one receipt row, two
// ledger lines, one audit; context + planned-membership fields per the frozen
// T6 plan-shape requirement.
function treasuryLifecycleReversalPlan_(input) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, contract = TREASURY_RECEIPT_V1_CONTRACT;
  var normalized = input.normalized, config = input.config, exposure = input.exposure;
  var target = input.target, nowISO = input.now.toISOString();
  var operationID = treasuryOperationId(life.REVERSE.OPERATION_TYPE, normalized.requestKey);
  var receiptID = treasuryReceiptId(life.REVERSE.OPERATION_TYPE, normalized.requestKey,
    life.REVERSE.SIDE);
  var journalID = treasuryJournalId(life.REVERSE.OPERATION_TYPE, normalized.requestKey,
    life.REVERSE.SIDE);
  var auditID = treasuryAuditId(life.REVERSE.OPERATION_TYPE, normalized.requestKey,
    life.REVERSE.SIDE);
  var amount = Number(target.GrossAmount);
  var reversalDate = input.reversalDate;
  var evidenceRef = life.REVERSAL_EVIDENCE_PREFIX + String(target.TreasuryReceiptID);
  var snapshot = {
    contractVersion: contract.CONTRACT_VERSION,
    activationID: config.activationID,
    configVersion: config.configVersion,
    operationType: life.REVERSE.OPERATION_TYPE,
    side: life.REVERSE.SIDE,
    recognitionID: exposure.recognitionID,
    orderID: exposure.orderID,
    revisionID: exposure.revisionID,
    recognizedAmount: exposure.recognizedAmount,
    outstandingBefore: input.outstanding,
    receiptAmount: amount,
    destination: { code: input.destination.code, name: input.destination.name },
    receiptDate: reversalDate,
    economicDate: reversalDate,
    evidence: { type: contract.EVIDENCE_TYPE, ref: evidenceRef },
    journalID: journalID,
    targetReceiptID: String(target.TreasuryReceiptID),
    reason: normalized.reason,
    replacementReceiptID: "",
    original: treasuryLifecycleOriginalSnapshotPart_(target, input.targetReceiptHash)
  };
  var journalRows = treasuryLifecycleReversalJournalRows_(journalID, reversalDate,
    input.destination.code, amount, receiptID, exposure.recognitionID, nowISO,
    input.actor);
  var journalSignature = treasuryJournalSignature(journalRows);
  var reversalRow = treasuryLifecycleReceiptRow_({
    receiptID: receiptID, operationID: operationID, requestKey: normalized.requestKey,
    recognitionID: exposure.recognitionID, orderID: exposure.orderID,
    revisionID: exposure.revisionID, receiptType: life.REVERSE.RECEIPT_TYPE,
    destinationCode: input.destination.code, amount: amount,
    receiptDate: reversalDate, economicDate: reversalDate, savedAt: nowISO,
    evidenceType: contract.EVIDENCE_TYPE, evidenceRef: evidenceRef,
    journalID: journalID, journalSignature: journalSignature,
    reversalOfReceiptID: String(target.TreasuryReceiptID),
    reason: normalized.reason, actor: input.actor, snapshot: snapshot
  });
  var auditRow = treasuryLifecycleAuditRow_({
    auditID: auditID, operationID: operationID, requestKey: normalized.requestKey,
    primaryReceiptID: receiptID, recognitionID: exposure.recognitionID,
    orderID: exposure.orderID, primaryJournalID: journalID, hash: input.hash,
    actor: input.actor, savedAt: nowISO
  });
  var plan = {
    planVersion: life.PLAN_VERSION,
    contractVersion: contract.CONTRACT_VERSION,
    operationType: life.REVERSE.OPERATION_TYPE,
    side: life.REVERSE.SIDE,
    receiptType: life.REVERSE.RECEIPT_TYPE,
    operationID: operationID,
    requestKey: normalized.requestKey,
    payloadHash: input.hash,
    normalizedPayload: normalized,
    config: { mode: config.mode, activationID: config.activationID,
      activatedAt: config.activatedAt, configVersion: config.configVersion },
    recognitionID: exposure.recognitionID,
    orderID: exposure.orderID,
    revisionID: exposure.revisionID,
    recognizedAmount: exposure.recognizedAmount,
    outstandingBefore: input.outstanding,
    targetReceiptID: String(target.TreasuryReceiptID),
    targetReceiptHash: input.targetReceiptHash,
    receiptAmount: amount,
    destination: { code: input.destination.code, name: input.destination.name },
    reversalDate: reversalDate,
    receiptDate: reversalDate,
    economicDate: reversalDate,
    evidence: { type: contract.EVIDENCE_TYPE, ref: evidenceRef },
    reason: normalized.reason,
    actor: input.actor,
    savedAt: nowISO,
    receiptID: receiptID,
    journalID: journalID,
    auditID: auditID,
    replacementReceiptID: "",
    replacementJournalID: "",
    plannedReceiptIds: [receiptID],
    plannedAuditIds: [auditID],
    contextReceiptIds: input.context.contextReceiptIds,
    contextReceiptHashes: input.context.contextReceiptHashes,
    contextAuditIds: input.context.contextAuditIds,
    contextAuditHashes: input.context.contextAuditHashes,
    journalSignatures: (function() { var map = {}; map[receiptID] = journalSignature; return map; })(),
    movementType: "TREASURY_RECEIPT_REVERSAL",
    sourceType: contract.SOURCE_TYPE,
    receiptRows: [reversalRow],
    reversalRow: reversalRow,
    replacementRow: null,
    journalRows: journalRows,
    auditRow: auditRow,
    snapshot: snapshot
  };
  return treasuryLifecyclePlanDigest_(plan);
}

// Pure CORRECT plan freeze (T2 section 13): ONE plan, ONE atomic batch —
// reversal row + replacement row + four ledger lines + ONE audit carrying the
// replacement receipt id + one Operation(CORRECT). Amount = full eligible
// exposure (already re-validated exactly against the post-reversal outstanding
// by the caller).
function treasuryLifecycleCorrectionPlan_(input) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, contract = TREASURY_RECEIPT_V1_CONTRACT;
  var normalized = input.normalized, config = input.config, exposure = input.exposure;
  var target = input.target, nowISO = input.now.toISOString();
  var operationID = treasuryOperationId(life.CORRECT.OPERATION_TYPE, normalized.requestKey);
  var reversalReceiptID = treasuryReceiptId(life.CORRECT.OPERATION_TYPE,
    normalized.requestKey, "REVERSAL");
  var replacementReceiptID = treasuryReceiptId(life.CORRECT.OPERATION_TYPE,
    normalized.requestKey, life.CORRECT.SIDE);
  var reversalJournalID = treasuryJournalId(life.CORRECT.OPERATION_TYPE,
    normalized.requestKey, "REVERSAL");
  var replacementJournalID = treasuryJournalId(life.CORRECT.OPERATION_TYPE,
    normalized.requestKey, life.CORRECT.SIDE);
  var auditID = treasuryAuditId(life.CORRECT.OPERATION_TYPE, normalized.requestKey,
    life.CORRECT.SIDE);
  var amount = Number(target.GrossAmount);
  var reversalDate = input.reversalDate;
  var replacementDate = normalized.receiptDate;
  var reversalEvidenceRef = life.REVERSAL_EVIDENCE_PREFIX + String(target.TreasuryReceiptID);
  var targetID = String(target.TreasuryReceiptID);
  var originalPart = treasuryLifecycleOriginalSnapshotPart_(target, input.targetReceiptHash);
  var reversalSnapshot = {
    contractVersion: contract.CONTRACT_VERSION,
    activationID: config.activationID,
    configVersion: config.configVersion,
    operationType: life.CORRECT.OPERATION_TYPE,
    side: "REVERSAL",
    recognitionID: exposure.recognitionID,
    orderID: exposure.orderID,
    revisionID: exposure.revisionID,
    recognizedAmount: exposure.recognizedAmount,
    outstandingBefore: input.outstanding,
    receiptAmount: amount,
    destination: { code: input.originalDestination.code, name: input.originalDestination.name },
    receiptDate: reversalDate,
    economicDate: reversalDate,
    evidence: { type: contract.EVIDENCE_TYPE, ref: reversalEvidenceRef },
    journalID: reversalJournalID,
    targetReceiptID: targetID,
    reason: normalized.reason,
    replacementReceiptID: replacementReceiptID,
    original: originalPart
  };
  var replacementSnapshot = {
    contractVersion: contract.CONTRACT_VERSION,
    activationID: config.activationID,
    configVersion: config.configVersion,
    operationType: life.CORRECT.OPERATION_TYPE,
    side: life.CORRECT.SIDE,
    recognitionID: exposure.recognitionID,
    orderID: exposure.orderID,
    revisionID: exposure.revisionID,
    recognizedAmount: exposure.recognizedAmount,
    outstandingBefore: input.outstanding,
    receiptAmount: amount,
    destination: { code: input.destination.code, name: input.destination.name },
    receiptDate: replacementDate,
    economicDate: replacementDate,
    evidence: { type: normalized.evidenceType, ref: normalized.evidenceRef },
    journalID: replacementJournalID,
    targetReceiptID: targetID,
    reason: normalized.reason,
    originalReceiptID: targetID,
    reversalReceiptID: reversalReceiptID,
    original: originalPart
  };
  var reversalJournalRows = treasuryLifecycleReversalJournalRows_(reversalJournalID,
    reversalDate, input.originalDestination.code, amount, reversalReceiptID,
    exposure.recognitionID, nowISO, input.actor);
  var replacementJournalRows = treasuryLifecycleReplacementJournalRows_(
    replacementJournalID, replacementDate, input.destination.code, amount,
    replacementReceiptID, exposure.recognitionID, nowISO, input.actor);
  var journalRows = reversalJournalRows.concat(replacementJournalRows);
  var reversalSignature = treasuryJournalSignature(reversalJournalRows);
  var replacementSignature = treasuryJournalSignature(replacementJournalRows);
  var reversalRow = treasuryLifecycleReceiptRow_({
    receiptID: reversalReceiptID, operationID: operationID,
    requestKey: normalized.requestKey, recognitionID: exposure.recognitionID,
    orderID: exposure.orderID, revisionID: exposure.revisionID,
    receiptType: life.CORRECT.REVERSAL_RECEIPT_TYPE,
    destinationCode: input.originalDestination.code, amount: amount,
    receiptDate: reversalDate, economicDate: reversalDate, savedAt: nowISO,
    evidenceType: contract.EVIDENCE_TYPE, evidenceRef: reversalEvidenceRef,
    journalID: reversalJournalID, journalSignature: reversalSignature,
    reversalOfReceiptID: targetID, replacementReceiptID: replacementReceiptID,
    reason: normalized.reason, actor: input.actor, snapshot: reversalSnapshot
  });
  var replacementRow = treasuryLifecycleReceiptRow_({
    receiptID: replacementReceiptID, operationID: operationID,
    requestKey: normalized.requestKey, recognitionID: exposure.recognitionID,
    orderID: exposure.orderID, revisionID: exposure.revisionID,
    receiptType: life.CORRECT.REPLACEMENT_RECEIPT_TYPE,
    destinationCode: input.destination.code, amount: amount,
    receiptDate: replacementDate, economicDate: replacementDate, savedAt: nowISO,
    evidenceType: normalized.evidenceType, evidenceRef: normalized.evidenceRef,
    journalID: replacementJournalID, journalSignature: replacementSignature,
    originalReceiptID: targetID,
    reason: normalized.reason, actor: input.actor, snapshot: replacementSnapshot
  });
  var auditRow = treasuryLifecycleAuditRow_({
    auditID: auditID, operationID: operationID, requestKey: normalized.requestKey,
    primaryReceiptID: replacementReceiptID, recognitionID: exposure.recognitionID,
    orderID: exposure.orderID, primaryJournalID: replacementJournalID,
    hash: input.hash, actor: input.actor, savedAt: nowISO
  });
  var plannedReceiptIds = [reversalReceiptID, replacementReceiptID].sort();
  var signatures = {};
  signatures[reversalReceiptID] = reversalSignature;
  signatures[replacementReceiptID] = replacementSignature;
  var plan = {
    planVersion: life.PLAN_VERSION,
    contractVersion: contract.CONTRACT_VERSION,
    operationType: life.CORRECT.OPERATION_TYPE,
    side: life.CORRECT.SIDE,
    receiptType: life.CORRECT.REPLACEMENT_RECEIPT_TYPE,
    operationID: operationID,
    requestKey: normalized.requestKey,
    payloadHash: input.hash,
    normalizedPayload: normalized,
    config: { mode: config.mode, activationID: config.activationID,
      activatedAt: config.activatedAt, configVersion: config.configVersion },
    recognitionID: exposure.recognitionID,
    orderID: exposure.orderID,
    revisionID: exposure.revisionID,
    recognizedAmount: exposure.recognizedAmount,
    outstandingBefore: input.outstanding,
    targetReceiptID: targetID,
    targetReceiptHash: input.targetReceiptHash,
    receiptAmount: amount,
    originalDestination: { code: input.originalDestination.code,
      name: input.originalDestination.name },
    destination: { code: input.destination.code, name: input.destination.name },
    reversalDate: reversalDate,
    replacementDate: replacementDate,
    receiptDate: replacementDate,
    economicDate: replacementDate,
    evidence: { type: normalized.evidenceType, ref: normalized.evidenceRef },
    reason: normalized.reason,
    actor: input.actor,
    savedAt: nowISO,
    receiptID: replacementReceiptID,
    journalID: replacementJournalID,
    auditID: auditID,
    reversalReceiptID: reversalReceiptID,
    replacementReceiptID: replacementReceiptID,
    replacementJournalID: replacementJournalID,
    reversalJournalID: reversalJournalID,
    plannedReceiptIds: plannedReceiptIds,
    plannedAuditIds: [auditID],
    contextReceiptIds: input.context.contextReceiptIds,
    contextReceiptHashes: input.context.contextReceiptHashes,
    contextAuditIds: input.context.contextAuditIds,
    contextAuditHashes: input.context.contextAuditHashes,
    journalSignatures: signatures,
    movementType: "TREASURY_RECEIPT",
    sourceType: contract.SOURCE_TYPE,
    receiptRows: [reversalRow, replacementRow],
    reversalRow: reversalRow,
    replacementRow: replacementRow,
    journalRows: journalRows,
    auditRow: auditRow,
    snapshot: replacementSnapshot
  };
  return treasuryLifecyclePlanDigest_(plan);
}

// ---------------------------------------------------------------------------
// Frozen plan integrity + shape invariants (T2 section 15). Runs at freeze
// time (definite REFUSED, pre-write) and on every resume (fail closed, ZERO
// additional writes). Malformed shape and derivational/content disagreement
// both fail closed with TREASURY_OPERATION_PLAN_MALFORMED; the reason string
// distinguishes them for evidence.
// ---------------------------------------------------------------------------
function treasuryLifecycleVerifyPlan_(plan) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  function fail(reason) { return { ok: false, kind: "MALFORMED", reason: reason }; }
  function drift(reason) { return { ok: false, kind: "TAMPERED", reason: reason }; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return fail("PLAN_NOT_OBJECT");
  if (plan.planVersion !== life.PLAN_VERSION) return fail("PLAN_VERSION_MISMATCH");
  if (plan.contractVersion !== contract.CONTRACT_VERSION) return fail("CONTRACT_VERSION_MISMATCH");
  var kind = plan.operationType === life.REVERSE.OPERATION_TYPE ? "REVERSE" :
    (plan.operationType === life.CORRECT.OPERATION_TYPE ? "CORRECT" : "");
  if (!kind) return fail("OPERATION_TYPE_MISMATCH");
  if (kind === "REVERSE") {
    if (plan.side !== life.REVERSE.SIDE || plan.receiptType !== life.REVERSE.RECEIPT_TYPE) {
      return fail("SIDE_OR_RECEIPT_TYPE_MISMATCH");
    }
    if (!Array.isArray(plan.receiptRows) || plan.receiptRows.length !== 1 ||
        !Array.isArray(plan.journalRows) || plan.journalRows.length !== 2) {
      return fail("REVERSE_SHAPE_MISMATCH");
    }
  } else {
    if (plan.side !== life.CORRECT.SIDE ||
        plan.receiptType !== life.CORRECT.REPLACEMENT_RECEIPT_TYPE) {
      return fail("SIDE_OR_RECEIPT_TYPE_MISMATCH");
    }
    if (!Array.isArray(plan.receiptRows) || plan.receiptRows.length !== 2 ||
        !Array.isArray(plan.journalRows) || plan.journalRows.length !== 4) {
      return fail("CORRECT_SHAPE_MISMATCH");
    }
  }
  if (typeof plan.requestKey !== "string" || !plan.requestKey) return fail("REQUEST_KEY_MISSING");
  if (typeof plan.operationID !== "string" || !plan.operationID) return fail("OPERATION_ID_MISSING");
  if (typeof plan.payloadHash !== "string" || !plan.payloadHash) return fail("PAYLOAD_HASH_MISSING");
  if (!plan.normalizedPayload || typeof plan.normalizedPayload !== "object") {
    return fail("NORMALIZED_PAYLOAD_MISSING");
  }
  if (!plan.config || typeof plan.config !== "object") return fail("CONFIG_IDENTITY_MISSING");
  if (plan.operationID !== treasuryOperationId(plan.operationType, plan.requestKey)) {
    return drift("OPERATION_ID_DERIVATION_MISMATCH");
  }
  if (typeof plan.recognitionID !== "string" || !plan.recognitionID) {
    return fail("RECOGNITION_ID_MISSING");
  }
  if (typeof plan.orderID !== "string" || !plan.orderID) return fail("ORDER_ID_MISSING");
  if (typeof plan.revisionID !== "string" || !plan.revisionID) return fail("REVISION_ID_MISSING");
  if (!isFinite(Number(plan.recognizedAmount)) || Number(plan.recognizedAmount) <= 0) {
    return fail("RECOGNIZED_AMOUNT_INVALID");
  }
  if (!isFinite(Number(plan.outstandingBefore))) return fail("OUTSTANDING_BEFORE_INVALID");
  if (typeof plan.targetReceiptID !== "string" ||
      !/^TRC-[A-Za-z0-9-]{3,127}$/.test(plan.targetReceiptID)) {
    return fail("TARGET_RECEIPT_ID_INVALID");
  }
  if (typeof plan.targetReceiptHash !== "string" || !plan.targetReceiptHash) {
    return fail("TARGET_RECEIPT_HASH_MISSING");
  }
  if (!isFinite(Number(plan.receiptAmount)) || Number(plan.receiptAmount) <= 0 ||
      Math.floor(Number(plan.receiptAmount)) !== Number(plan.receiptAmount)) {
    return fail("RECEIPT_AMOUNT_INVALID");
  }
  if (treasuryValidateReceiptDate(plan.reversalDate).status !== "PASS") {
    return fail("REVERSAL_DATE_INVALID");
  }
  if (typeof plan.reason !== "string" ||
      !treasuryLifecycleNoteOk_(plan.reason, life.MIN_REASON, life.MAX_REASON)) {
    return fail("REASON_INVALID");
  }
  if (typeof plan.actor !== "string" || !plan.actor || typeof plan.savedAt !== "string" ||
      !plan.savedAt) return fail("ACTOR_OR_TIMESTAMP_MISSING");
  if (!Array.isArray(plan.plannedReceiptIds) || !plan.plannedAuditIds ||
      !Array.isArray(plan.plannedAuditIds)) return fail("PLANNED_IDS_MISSING");
  if (plan.plannedAuditIds.length !== 1 || typeof plan.plannedAuditIds[0] !== "string" ||
      !plan.plannedAuditIds[0]) return fail("PLANNED_AUDIT_IDS_INVALID");
  if (!plan.journalSignatures || typeof plan.journalSignatures !== "object" ||
      Array.isArray(plan.journalSignatures)) return fail("JOURNAL_SIGNATURES_MISSING");
  if (!plan.auditRow || typeof plan.auditRow !== "object") return fail("AUDIT_ROW_MISSING");
  if (!plan.snapshot || typeof plan.snapshot !== "object") return fail("SNAPSHOT_MISSING");
  if (!Array.isArray(plan.contextReceiptIds) || !Array.isArray(plan.contextAuditIds)) {
    return fail("CONTEXT_MISSING");
  }

  // Per-receipt identities, lineage, and one journal pair each.
  var ledgerHeadersComplete = true;
  var receiptsByOrder = kind === "REVERSE" ? [plan.receiptRows[0]] : plan.receiptRows;
  var reversalRow = plan.receiptRows[0];
  var replacementRow = kind === "CORRECT" ? plan.receiptRows[1] : null;
  var expectedReversalID = treasuryReceiptId(plan.operationType, plan.requestKey, "REVERSAL");
  if (reversalRow.TreasuryReceiptID !== expectedReversalID) {
    return drift("REVERSAL_RECEIPT_ID_DERIVATION_MISMATCH");
  }
  if (reversalRow.ReceiptType !== "SALES_RECEIPT_REVERSAL" ||
      String(reversalRow.ReversalOfReceiptID) !== plan.targetReceiptID) {
    return drift("REVERSAL_LINEAGE_MISMATCH");
  }
  if (kind === "REVERSE") {
    if (String(reversalRow.ReplacementReceiptID) !== "" ||
        String(reversalRow.OriginalReceiptID) !== "") {
      return drift("REVERSAL_LINEAGE_MISMATCH");
    }
  } else {
    var expectedReplacementID = treasuryReceiptId(plan.operationType, plan.requestKey,
      life.CORRECT.SIDE);
    if (!replacementRow || replacementRow.TreasuryReceiptID !== expectedReplacementID) {
      return drift("REPLACEMENT_RECEIPT_ID_DERIVATION_MISMATCH");
    }
    if (String(plan.replacementReceiptID) !== expectedReplacementID ||
        String(reversalRow.ReplacementReceiptID) !== expectedReplacementID) {
      return drift("REVERSAL_LINEAGE_MISMATCH");
    }
    if (replacementRow.ReceiptType !== "SALES_RECEIPT" ||
        String(replacementRow.OriginalReceiptID) !== plan.targetReceiptID ||
        String(replacementRow.ReversalOfReceiptID) !== "" ||
        String(replacementRow.ReplacementReceiptID) !== "") {
      return drift("REPLACEMENT_LINEAGE_MISMATCH");
    }
    if (treasuryValidateReceiptDate(plan.replacementDate).status !== "PASS" ||
        replacementRow.ReceiptDate !== plan.replacementDate ||
        replacementRow.EconomicDate !== plan.replacementDate) {
      return fail("REPLACEMENT_DATE_INVALID");
    }
  }
  var sharedOk = receiptsByOrder.every(function(row) {
    return row.OperationID === plan.operationID && row.RequestKey === plan.requestKey &&
      row.RecognitionID === plan.recognitionID && row.OrderID === plan.orderID &&
      row.RevisionID === plan.revisionID &&
      Number(row.GrossAmount) === Number(plan.receiptAmount) &&
      row.ReceivedAt === plan.savedAt && row.Reason === plan.reason &&
      row.Actor === plan.actor && row.PostingStatus === contract.POSTING_STATUS_COMMITTED &&
      row.ContractVersion === contract.CONTRACT_VERSION;
  });
  if (!sharedOk) return drift("RECEIPT_ROW_MISMATCH");
  if (reversalRow.ReceiptDate !== plan.reversalDate ||
      reversalRow.EconomicDate !== plan.reversalDate ||
      reversalRow.DestinationAccountCode !== (kind === "REVERSE" ?
        plan.destination.code : plan.originalDestination.code) ||
      reversalRow.JournalID !== (kind === "REVERSE" ? plan.journalID : plan.reversalJournalID) ||
      reversalRow.EvidenceType !== contract.EVIDENCE_TYPE ||
      reversalRow.EvidenceRef !== life.REVERSAL_EVIDENCE_PREFIX + plan.targetReceiptID) {
    return drift("REVERSAL_ROW_MISMATCH");
  }
  if (kind === "CORRECT" && (replacementRow.DestinationAccountCode !== plan.destination.code ||
      replacementRow.JournalID !== plan.replacementJournalID ||
      replacementRow.EvidenceType !== plan.evidence.type ||
      replacementRow.EvidenceRef !== plan.evidence.ref)) {
    return drift("REPLACEMENT_ROW_MISMATCH");
  }
  if (contract.SCHEMAS.RECEIPTS.HEADERS.some(function(header) {
      return plan.receiptRows.some(function(row) { return row[header] === undefined; });
    })) return fail("RECEIPT_ROW_INCOMPLETE");

  // Journal pairs: structural {account, 1030} only; reversal leg direction is
  // exact (Dr 1030 / Cr destination); replacement leg is the ordinary shape.
  function verifyPair(rows, journalID, receiptID, dateKey, movementType, ordinary) {
    if (rows.length !== 2) return "JOURNAL_PAIR_SIZE";
    var j0 = rows[0], j1 = rows[1];
    if (ledgerHeaders.some(function(header) {
        return j0[header] === undefined || j1[header] === undefined;
      })) return "JOURNAL_ROW_INCOMPLETE";
    if (j0.LineID !== journalID + "-1" || j1.LineID !== journalID + "-2" ||
        j0.JournalID !== journalID || j1.JournalID !== journalID) {
      return "JOURNAL_LINE_ID_MISMATCH";
    }
    if (j0.SourceID !== receiptID || j1.SourceID !== receiptID ||
        j0.SourceType !== plan.sourceType || j1.SourceType !== plan.sourceType ||
        j0.MovementType !== movementType || j1.MovementType !== movementType) {
      return "JOURNAL_CLASSIFICATION_MISMATCH";
    }
    var clearingCode = contract.CLEARING_ACCOUNT_CODE;
    // Ordinary (replacement) legs always post the plan's own destination;
    // reversal legs post the ORIGINAL destination (frozen at plan level).
    var destinationCode = ordinary ? plan.destination.code :
      (kind === "REVERSE" ? plan.destination.code : plan.originalDestination.code);
    if (ordinary) {
      if (j0.AccountCode !== destinationCode || j1.AccountCode !== clearingCode) {
        return "JOURNAL_ACCOUNT_MAPPING_MISMATCH";
      }
    } else {
      if (j0.AccountCode !== clearingCode || j1.AccountCode !== destinationCode) {
        return "JOURNAL_ACCOUNT_MAPPING_MISMATCH";
      }
    }
    if (treasuryForbiddenJournalAccount(j0.AccountCode) ||
        treasuryForbiddenJournalAccount(j1.AccountCode)) {
      return "JOURNAL_FORBIDDEN_ACCOUNT";
    }
    if (Number(j0.Debit) !== Number(plan.receiptAmount) || Number(j0.Credit) !== 0 ||
        Number(j1.Debit) !== 0 || Number(j1.Credit) !== Number(plan.receiptAmount)) {
      return "JOURNAL_AMOUNT_MISMATCH";
    }
    if (j0.Tanggal !== dateKey || j1.Tanggal !== dateKey) return "JOURNAL_DATE_MISMATCH";
    if (!isCanonicalActive(j0.IsActive) || !isCanonicalActive(j1.IsActive)) {
      return "JOURNAL_INACTIVE";
    }
    var signature = treasuryJournalSignature(rows);
    if (typeof plan.journalSignatures[receiptID] !== "string" ||
        signature !== plan.journalSignatures[receiptID] ||
        (ordinary ? replacementRow : reversalRow).JournalSignature !== signature) {
      return "JOURNAL_SIGNATURE_MISMATCH";
    }
    return "";
  }
  var reversalPairError = verifyPair(kind === "REVERSE" ? plan.journalRows :
    plan.journalRows.slice(0, 2), kind === "REVERSE" ? plan.journalID : plan.reversalJournalID,
    reversalRow.TreasuryReceiptID, plan.reversalDate, "TREASURY_RECEIPT_REVERSAL", false);
  if (reversalPairError) return drift(reversalPairError);
  if (kind === "CORRECT") {
    var replacementPairError = verifyPair(plan.journalRows.slice(2), plan.replacementJournalID,
      replacementRow.TreasuryReceiptID, plan.replacementDate, "TREASURY_RECEIPT", true);
    if (replacementPairError) return drift(replacementPairError);
  }
  var plannedLineIds = {};
  plan.journalRows.forEach(function(row) { plannedLineIds[row.LineID] = true; });
  if (Object.keys(plannedLineIds).length !== plan.journalRows.length) {
    return fail("JOURNAL_LINE_ID_DUPLICATE");
  }

  // Planned membership shape.
  if (kind === "REVERSE") {
    if (plan.plannedReceiptIds.length !== 1 || plan.plannedReceiptIds[0] !== plan.receiptID ||
        plan.plannedAuditIds[0] !== plan.auditID) {
      return fail("PLANNED_IDS_MISMATCH");
    }
  } else {
    var expectedPlanned = [plan.reversalReceiptID, plan.replacementReceiptID].sort();
    if (JSON.stringify(plan.plannedReceiptIds) !== JSON.stringify(expectedPlanned) ||
        plan.plannedAuditIds[0] !== plan.auditID) {
      return fail("PLANNED_IDS_MISMATCH");
    }
  }
  if (plan.receiptID !== (kind === "REVERSE" ? plan.receiptRows[0].TreasuryReceiptID :
      plan.receiptRows[1].TreasuryReceiptID) ||
      plan.journalID !== (kind === "REVERSE" ? plan.journalRows[0].JournalID :
        plan.replacementJournalID)) {
    return drift("PRIMARY_IDENTITY_MISMATCH");
  }

  // Audit row: N = 1 per operation; CORRECT carries the replacement id.
  var audit = plan.auditRow;
  var expectedAuditID = treasuryAuditId(plan.operationType, plan.requestKey,
    kind === "REVERSE" ? "REVERSAL" : life.CORRECT.SIDE);
  if (audit.AuditID !== expectedAuditID || audit.AuditID !== plan.auditID ||
      contract.SCHEMAS.AUDITS.HEADERS.some(function(header) {
        return audit[header] === undefined;
      })) return fail("AUDIT_ROW_INCOMPLETE");
  var primaryRow = kind === "REVERSE" ? plan.receiptRows[0] : plan.receiptRows[1];
  var primaryJournalID = kind === "REVERSE" ? plan.journalRows[0].JournalID :
    plan.replacementJournalID;
  if (audit.ContractVersion !== contract.CONTRACT_VERSION ||
      audit.OperationID !== plan.operationID || audit.RequestKey !== plan.requestKey ||
      audit.TreasuryReceiptID !== primaryRow.TreasuryReceiptID ||
      audit.RecognitionID !== plan.recognitionID || audit.OrderID !== plan.orderID ||
      audit.JournalID !== primaryJournalID || audit.PayloadHash !== plan.payloadHash ||
      audit.Actor !== plan.actor || audit.SavedAt !== plan.savedAt) {
    return drift("AUDIT_ROW_MISMATCH");
  }

  // Snapshot content (T2 section 18 class): frozen once, verified against the
  // plan; the reversal snapshot carries the original identity; the replacement
  // snapshot adds corrected destination/date/evidence + original/reversal ids.
  function verifySnapshot(snapshot, row, side) {
    if (row.SnapshotJSON !== JSON.stringify(snapshot)) return "SNAPSHOT_JSON_MISMATCH";
    var parsed = null;
    try { parsed = JSON.parse(row.SnapshotJSON); }
    catch (error) { return "SNAPSHOT_JSON_INVALID"; }
    if (snapshot.contractVersion !== contract.CONTRACT_VERSION ||
        snapshot.operationType !== plan.operationType || snapshot.side !== side ||
        snapshot.recognitionID !== plan.recognitionID || snapshot.orderID !== plan.orderID ||
        snapshot.revisionID !== plan.revisionID ||
        Number(snapshot.recognizedAmount) !== Number(plan.recognizedAmount) ||
        Number(snapshot.outstandingBefore) !== Number(plan.outstandingBefore) ||
        Number(snapshot.receiptAmount) !== Number(plan.receiptAmount) ||
        !snapshot.destination || snapshot.journalID !== row.JournalID ||
        String(snapshot.targetReceiptID) !== plan.targetReceiptID ||
        String(snapshot.reason) !== plan.reason ||
        snapshot.destination.code !== String(row.DestinationAccountCode) ||
        snapshot.receiptDate !== String(row.ReceiptDate) ||
        snapshot.economicDate !== String(row.EconomicDate) ||
        !snapshot.evidence || snapshot.evidence.type !== String(row.EvidenceType) ||
        snapshot.evidence.ref !== String(row.EvidenceRef) ||
        !snapshot.original || snapshot.original.receiptID !== plan.targetReceiptID ||
        snapshot.original.receiptHash !== plan.targetReceiptHash ||
        Number(snapshot.original.grossAmount) !== Number(plan.receiptAmount)) {
      return "SNAPSHOT_CONTENT_MISMATCH";
    }
    return "";
  }
  var reversalSnapshot = kind === "REVERSE" ? plan.snapshot :
    JSON.parse(plan.receiptRows[0].SnapshotJSON);
  var reversalSnapshotError = verifySnapshot(reversalSnapshot, plan.receiptRows[0],
    "REVERSAL");
  if (reversalSnapshotError) return drift(reversalSnapshotError);
  if (kind === "REVERSE" && String(plan.snapshot.replacementReceiptID) !== "") {
    return drift("SNAPSHOT_CONTENT_MISMATCH");
  }
  if (kind === "CORRECT") {
    var replacementSnapshot = JSON.parse(plan.receiptRows[1].SnapshotJSON);
    var replacementSnapshotError = verifySnapshot(replacementSnapshot,
      plan.receiptRows[1], life.CORRECT.SIDE);
    if (replacementSnapshotError) return drift(replacementSnapshotError);
    if (String(replacementSnapshot.originalReceiptID) !== plan.targetReceiptID ||
        String(replacementSnapshot.reversalReceiptID) !==
          plan.receiptRows[0].TreasuryReceiptID ||
        String(reversalSnapshot.replacementReceiptID) !==
          plan.receiptRows[1].TreasuryReceiptID) {
      return drift("SNAPSHOT_CONTENT_MISMATCH");
    }
  }

  // Frozen sibling context: structural shape (sorted, unique, hash-complete).
  var contextShape = treasuryReceiptContextShape_(plan);
  if (!contextShape.ok) return fail(contextShape.reason);
  if (typeof plan.planDigest !== "string" || !plan.planDigest) return fail("PLAN_DIGEST_MISSING");
  var copy = Object.assign({}, plan);
  delete copy.planDigest;
  if (transactionPayloadHash_(copy) !== plan.planDigest) return fail("PLAN_DIGEST_MISMATCH");
  return { ok: true, kind: "", reason: "" };
}

// ---------------------------------------------------------------------------
// ONE atomic batch (T2 section 16): exactly THREE appendCells subrequests —
// receipt row(s) + 2 (or 4) BalanceLedger lines + 1 audit row — in ONE
// spreadsheets.batchUpdate, all or none.
// ---------------------------------------------------------------------------
function treasuryLifecycleValueRanges_(plan) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  function rowValues(row, headers) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  }
  var ranges = [
    { range: contract.SCHEMAS.RECEIPTS.SHEET,
      values: plan.receiptRows.map(function(row) {
        return rowValues(row, contract.SCHEMAS.RECEIPTS.HEADERS);
      }) },
    { range: "BalanceLedger",
      values: plan.journalRows.map(function(row) {
        return rowValues(row, BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
      }) },
    { range: contract.SCHEMAS.AUDITS.SHEET,
      values: [rowValues(plan.auditRow, contract.SCHEMAS.AUDITS.HEADERS)] }
  ];
  if (JSON.stringify(ranges.map(function(range) { return range.range; })) !==
      JSON.stringify(TREASURY_RECEIPT_V1_LIFECYCLE.WRITE_SURFACES)) {
    throw new Error("LIFECYCLE_SURFACE_MISMATCH");
  }
  return ranges;
}

function treasuryLifecycleBounds_(plan) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, save = TREASURY_RECEIPT_V1_SAVE, ranges;
  try { ranges = treasuryLifecycleValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "LIFECYCLE_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var sentinel = {};
  life.WRITE_SURFACES.forEach(function(name) { sentinel[name] = 2147483647; });
  var body;
  try { body = treasuryReceiptBatchBody_(ranges, sentinel); }
  catch (error) { return { ok: false, detail: "UNSAFE_BATCH:" + error.message }; }
  var bytes = treasuryReceiptUtf8Bytes_(JSON.stringify(body)) + save.REQUEST_OVERHEAD_BYTES;
  var planJson = "";
  try { planJson = JSON.stringify(plan); }
  catch (error) { return { ok: false, detail: "PLAN_JSON_INVALID" }; }
  if (planJson.length > save.MAX_CELL_CHARS) {
    return { ok: false, detail: "UNSAFE_PLAN_CELL_CHARS:" + planJson.length };
  }
  var ok = cells <= save.MAX_BATCH_CELLS && bytes <= save.MAX_REQUEST_BYTES;
  return { ok: ok, cells: cells, bytes: bytes, planChars: planJson.length,
    detail: ok ? "" : "BATCH_BOUNDS cells=" + cells + " bytes=" + bytes };
}

// ---------------------------------------------------------------------------
// Exact business-artifact verification against the frozen plan (T2 sections
// 15, 16). JournalSignature is excluded from the receipt content compare (the
// dedicated signature step owns that column). The ORIGINAL target row is
// re-hashed: any drift = ORIGINAL_IMMUTABLE conflict (originals never change).
// ---------------------------------------------------------------------------
function treasuryLifecycleInspect_(plan, ss) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT,
    receiptHeaders = contract.SCHEMAS.RECEIPTS.HEADERS,
    auditHeaders = contract.SCHEMAS.AUDITS.HEADERS,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var receipts, ledger, audits;
  try {
    receipts = treasuryLifecycleReadRows_(ss, "RECEIPTS");
    ledger = treasuryLifecycleLedgerRows_(ss);
    audits = treasuryLifecycleReadRows_(ss, "AUDITS");
  } catch (error) {
    return { state: "UNKNOWN", detail: "READBACK_FAILED:" + error.message };
  }
  var conflicts = [], missing = [];
  var context = treasuryReceiptContextOf_(plan);
  var plannedReceiptIds = {};
  plan.receiptRows.forEach(function(row) {
    plannedReceiptIds[String(row.TreasuryReceiptID)] = true;
  });
  var contextReceiptSeen = {}, contextAuditSeen = {};
  var plannedLineIds = {};
  plan.journalRows.forEach(function(row) { plannedLineIds[row.LineID] = true; });
  ledger.forEach(function(row) {
    if (plannedLineIds[row.LineID] &&
        !(String(row.SourceType) === plan.sourceType &&
          plannedReceiptIds[String(row.SourceID)] &&
          row.JournalID === plan.journalRows.filter(function(expected) {
            return expected.LineID === row.LineID;
          })[0].JournalID)) {
      conflicts.push("JOURNAL_LINE_CROSS_OWNER");
    }
    if (plannedReceiptIds[String(row.SourceID)] && String(row.SourceType) !== plan.sourceType) {
      conflicts.push("JOURNAL_SOURCE_CROSS_OWNER");
    }
  });
  receipts.forEach(function(row) {
    var rowReceiptID = String(row.TreasuryReceiptID);
    if (plannedReceiptIds[rowReceiptID] && row.OperationID !== plan.operationID) {
      conflicts.push("RECEIPT_CROSS_OWNER");
    }
    if (row.OperationID === plan.operationID && !plannedReceiptIds[rowReceiptID]) {
      conflicts.push("RECEIPT_OPERATION_CROSS_OWNER");
    }
    if (context.auditIds[rowReceiptID]) {
      conflicts.push("RECEIPT_CONTEXT_CLASS_MISMATCH");
    }
    if (!plannedReceiptIds[rowReceiptID] && context.receiptIds[rowReceiptID]) {
      contextReceiptSeen[rowReceiptID] = (contextReceiptSeen[rowReceiptID] || 0) + 1;
      if (treasuryReceiptContextHash_(row, receiptHeaders) !==
          context.receiptHashes[rowReceiptID]) {
        conflicts.push("RECOGNITION_CONTEXT_TAMPERED");
      }
    }
    if (String(row.RecognitionID) === plan.recognitionID &&
        !plannedReceiptIds[rowReceiptID] && !context.receiptIds[rowReceiptID]) {
      conflicts.push("RECOGNITION_DUPLICATE_RECEIPT");
    }
    if (rowReceiptID === plan.targetReceiptID) {
      if (treasuryReceiptContextHash_(row, receiptHeaders) !== plan.targetReceiptHash) {
        conflicts.push("ORIGINAL_IMMUTABLE");
      }
    }
  });
  Object.keys(context.receiptIds).forEach(function(id) {
    if (!plannedReceiptIds[id] && contextReceiptSeen[id] !== 1) {
      conflicts.push("RECOGNITION_CONTEXT_INCOMPLETE");
    }
  });
  var targetSeen = receipts.filter(function(row) {
    return String(row.TreasuryReceiptID) === plan.targetReceiptID;
  }).length;
  if (!targetSeen) conflicts.push("ORIGINAL_TARGET_MISSING");
  audits.forEach(function(row) {
    var rowAuditID = String(row.AuditID);
    if (rowAuditID === plan.auditID && row.OperationID !== plan.operationID) {
      conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    }
    if (row.OperationID === plan.operationID && rowAuditID !== plan.auditID) {
      conflicts.push("AUDIT_OPERATION_CROSS_OWNER");
    }
    if (context.receiptIds[rowAuditID]) {
      conflicts.push("AUDIT_CONTEXT_CLASS_MISMATCH");
    }
    if (rowAuditID !== plan.auditID && context.auditIds[rowAuditID]) {
      contextAuditSeen[rowAuditID] = (contextAuditSeen[rowAuditID] || 0) + 1;
      if (treasuryReceiptContextHash_(row, auditHeaders) !== context.auditHashes[rowAuditID]) {
        conflicts.push("AUDIT_CONTEXT_TAMPERED");
      }
    }
    if (String(row.RecognitionID) === plan.recognitionID &&
        rowAuditID !== plan.auditID && !context.auditIds[rowAuditID]) {
      conflicts.push("AUDIT_RECOGNITION_CROSS_OWNER");
    }
  });
  Object.keys(context.auditIds).forEach(function(id) {
    if (id !== plan.auditID && contextAuditSeen[id] !== 1) {
      conflicts.push("AUDIT_CONTEXT_INCOMPLETE");
    }
  });

  // Own artifact completeness + content.
  var journalBySource = ledger.filter(function(row) {
    return String(row.SourceType) === plan.sourceType &&
      plannedReceiptIds[String(row.SourceID)];
  });
  var journalById = ledger.filter(function(row) {
    return plannedLineIds[String(row.LineID)];
  });
  var auditById = audits.filter(function(row) { return row.AuditID === plan.auditID; });
  var auditByOperation = audits.filter(function(row) {
    return row.OperationID === plan.operationID;
  });
  var receiptMatches = receipts.filter(function(row) {
    return plannedReceiptIds[String(row.TreasuryReceiptID)];
  });
  var present = receiptMatches.length || journalBySource.length || journalById.length ||
    auditById.length || auditByOperation.length;
  if (!present) {
    if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
    return { state: "NONE", detail: "NO_ARTIFACTS" };
  }
  plan.receiptRows.forEach(function(expected) {
    var matches = receiptMatches.filter(function(row) {
      return row.TreasuryReceiptID === expected.TreasuryReceiptID;
    });
    if (matches.length > 1) conflicts.push("RECEIPT_DUPLICATE");
    else if (matches.length === 1) {
      if (!treasuryReceiptRowExact_(matches[0], expected, receiptHeaders,
          ["JournalSignature"])) {
        conflicts.push("RECEIPT_TAMPERED");
      }
    } else missing.push("RECEIPT:" + expected.TreasuryReceiptID);
  });
  if (journalBySource.length || journalById.length) {
    var sourceSet = journalBySource.map(function(row) { return String(row.LineID); }).sort().join("");
    var idSet = journalById.map(function(row) { return String(row.LineID); }).sort().join("");
    if (sourceSet !== idSet) conflicts.push("JOURNAL_IDENTITY_CROSSOVER");
    if (journalBySource.length !== plan.journalRows.length) {
      if (journalBySource.length < plan.journalRows.length) missing.push("JOURNAL");
      if (journalBySource.length > plan.journalRows.length) conflicts.push("JOURNAL_DUPLICATE");
    }
    var byLine = {};
    journalBySource.forEach(function(row) { byLine[String(row.LineID)] = row; });
    plan.journalRows.forEach(function(expected) {
      var actual = byLine[expected.LineID];
      if (!actual) return;
      if (!treasuryReceiptRowExact_(actual, expected, ledgerHeaders)) {
        conflicts.push("JOURNAL_TAMPERED");
      }
    });
    plan.receiptRows.forEach(function(row) {
      var lines = journalBySource.filter(function(entry) {
        return String(entry.SourceID) === String(row.TreasuryReceiptID);
      });
      if (lines.length !== 2) return;
      var debit = 0, credit = 0;
      lines.forEach(function(entry) { debit += Number(entry.Debit); credit += Number(entry.Credit); });
      if (!(debit === credit && debit === Number(plan.receiptAmount))) {
        conflicts.push("JOURNAL_BALANCE_MISMATCH");
      }
    });
  } else missing.push("JOURNAL");
  if (auditById.length || auditByOperation.length) {
    if (auditById.length > 1) conflicts.push("AUDIT_DUPLICATE");
    else if (auditById.length === 1 &&
        !treasuryReceiptRowExact_(auditById[0], plan.auditRow, auditHeaders)) {
      conflicts.push("AUDIT_TAMPERED");
    }
    var auditIdSet = auditById.map(function(row) { return String(row.AuditID); }).sort().join("");
    var auditOpSet = auditByOperation.map(function(row) { return String(row.AuditID); }).sort().join("");
    if (auditIdSet !== auditOpSet) conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    if (!auditById.length) missing.push("AUDIT");
  } else missing.push("AUDIT");
  if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
  if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
  return { state: "EXACT", detail: "" };
}

// Journal signature recomputed from the PERSISTED ledger rows for EVERY
// planned receipt and compared to the frozen per-receipt signature and the
// persisted receipt.JournalSignature cell. Mismatch => impossible DONE.
function treasuryLifecycleVerifySignatures_(plan, ss) {
  var codes = TREASURY_RECEIPT_V1_LIFECYCLE.CODES;
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  var ledger, receipts;
  try {
    ledger = treasuryLifecycleLedgerRows_(ss);
    receipts = treasuryLifecycleReadRows_(ss, "RECEIPTS");
  } catch (error) {
    return { status: "UNKNOWN", ok: false, code: codes.READBACK_INCOMPLETE,
      detail: "SIGNATURE_READ_FAILED:" + error.message };
  }
  for (var i = 0; i < plan.receiptRows.length; i++) {
    var expected = plan.receiptRows[i];
    var receiptID = String(expected.TreasuryReceiptID);
    var rows = ledger.filter(function(row) {
      return String(row.SourceType) === plan.sourceType && String(row.SourceID) === receiptID;
    });
    var receipt = receipts.filter(function(row) {
      return String(row.TreasuryReceiptID) === receiptID;
    });
    if (rows.length !== 2 || receipt.length !== 1) {
      return { status: "FAIL", ok: false, code: codes.JOURNAL_SIGNATURE_INVALID,
        detail: "SIGNATURE_INPUT_INCOMPLETE:" + receiptID };
    }
    var recomputed = treasuryJournalSignature(rows);
    if (recomputed !== plan.journalSignatures[receiptID]) {
      return { status: "FAIL", ok: false, code: codes.JOURNAL_SIGNATURE_INVALID,
        detail: "PLAN_SIGNATURE_MISMATCH:" + receiptID };
    }
    if (String(receipt[0].JournalSignature) !== recomputed) {
      return { status: "FAIL", ok: false, code: codes.JOURNAL_SIGNATURE_INVALID,
        detail: "RECEIPT_SIGNATURE_MISMATCH:" + receiptID };
    }
  }
  return { status: "PASS", ok: true, code: "", detail: "" };
}

// Batch -> exact inspect -> signature recomputation for every planned
// receipt -> COMMITTED + exact readback. Never retries a failed batch inside
// one call: an unknown batch outcome is inspected once and, if unresolved,
// reported as UNKNOWN with identity preserved (zero autonomous retry).
function treasuryLifecycleApplyBatch_(plan, operation, runtime) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES;
  var freshWrites = plan.operationType === life.REVERSE.OPERATION_TYPE ?
    life.REVERSE.FRESH_WRITE_COUNT : life.CORRECT.FRESH_WRITE_COUNT;
  function outcome(status, fields) {
    return treasuryLifecycleResult_(status, Object.assign({
      requestKey: plan.requestKey, operationID: plan.operationID,
      recognitionID: plan.recognitionID,
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID,
      reversalReceiptID: plan.receiptRows[0].TreasuryReceiptID
    }, fields || {}));
  }
  var ranges = null;
  try { ranges = treasuryLifecycleValueRanges_(plan); }
  catch (error) {
    return outcome(life.STATUS.RECOVERY_REQUIRED,
      { code: codes.OPERATION_PLAN_MALFORMED, detail: error.message, writeCount: "UNKNOWN" });
  }
  if (runtime.crash) runtime.crash("T6_BEFORE_BATCH");
  var batchError = null;
  try { runtime.batch(ranges); } catch (error) { batchError = error; }
  if (!batchError && runtime.crash) runtime.crash("T6_AFTER_BATCH");
  var inspection = treasuryLifecycleInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(life.STATUS.UNKNOWN,
      { code: codes.READBACK_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "NONE") {
    if (batchError) {
      return outcome(life.STATUS.UNKNOWN,
        { code: codes.BATCH_OUTCOME_UNKNOWN, writeCount: "UNKNOWN", detail: inspection.detail });
    }
    return outcome(life.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "PARTIAL") {
    return outcome(life.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "CONFLICT") {
    return outcome(life.STATUS.RECOVERY_REQUIRED, {
      code: String(inspection.detail).indexOf("ORIGINAL_IMMUTABLE") !== -1 ?
        codes.ORIGINAL_IMMUTABLE : codes.RECOVERY_REQUIRED,
      writeCount: "UNKNOWN", detail: inspection.detail });
  }
  var signature = treasuryLifecycleVerifySignatures_(plan, runtime.spreadsheet);
  if (signature.status === "UNKNOWN") {
    return outcome(life.STATUS.UNKNOWN,
      { code: signature.code, writeCount: "UNKNOWN", detail: signature.detail });
  }
  if (!signature.ok) {
    return outcome(life.STATUS.RECOVERY_REQUIRED,
      { code: signature.code, writeCount: "UNKNOWN", detail: signature.detail });
  }
  if (runtime.crash) runtime.crash("T6_AFTER_READBACK");
  if (runtime.crash) runtime.crash("T6_BEFORE_COMMIT");
  var commit = treasuryReceiptCommit_(operation, runtime);
  if (!commit.ok) {
    return outcome(commit.status,
      { code: commit.code, writeCount: freshWrites, detail: commit.detail });
  }
  if (runtime.crash) runtime.crash("T6_AFTER_COMMIT");
  return outcome(life.STATUS.DONE, { writeCount: freshWrites });
}

// Resume path: exact (OperationType, RequestKey) lookup hit. Payload hash AND
// exact persisted normalized structure compared; stored plan digest + shape
// verified; only IN_PROGRESS or COMMITTED proceed; schema + stored bounds
// re-checked. PAUSED/PREPARED never block this path (T2 section 5: operation
// recovery remains available in every mode).
function treasuryLifecycleResume_(operation, hash, normalized, runtime, operationType) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES;
  function outcome(status, fields) {
    return treasuryLifecycleResult_(status, Object.assign({
      requestKey: normalized.requestKey,
      operationID: operation.TreasuryOperationID || "",
      recognitionID: operation.RecognitionID || ""
    }, fields || {}));
  }
  if (operation.OperationType !== operationType ||
      operation.RequestKey !== normalized.requestKey ||
      operation.PayloadHash !== hash) {
    return outcome(life.STATUS.CONFLICT,
      { code: codes.REQUEST_KEY_CONFLICT, detail: "PAYLOAD_MISMATCH" });
  }
  var plan = null;
  try { plan = JSON.parse(operation.OperationPlan); }
  catch (error) {
    return outcome(life.STATUS.RECOVERY_REQUIRED,
      { code: codes.OPERATION_PLAN_MALFORMED, detail: "PLAN_JSON:" + error.message });
  }
  if (!plan || plan.requestKey !== normalized.requestKey || plan.payloadHash !== hash ||
      plan.operationID !== operation.TreasuryOperationID ||
      plan.operationType !== operationType) {
    return outcome(life.STATUS.CONFLICT,
      { code: codes.REQUEST_KEY_CONFLICT, detail: "PLAN_IDENTITY_MISMATCH" });
  }
  if (!plan.normalizedPayload ||
      JSON.stringify(plan.normalizedPayload) !== JSON.stringify(normalized)) {
    return outcome(life.STATUS.CONFLICT,
      { code: codes.REQUEST_KEY_CONFLICT, detail: "NORMALIZED_PAYLOAD_MISMATCH" });
  }
  if (String(operation.RecognitionID) !== String(plan.recognitionID)) {
    return outcome(life.STATUS.CONFLICT,
      { code: codes.REQUEST_KEY_CONFLICT, detail: "PLAN_RECOGNITION_MISMATCH" });
  }
  var verify = treasuryLifecycleVerifyPlan_(plan);
  if (!verify.ok) {
    return outcome(life.STATUS.RECOVERY_REQUIRED, {
      code: codes.OPERATION_PLAN_MALFORMED, detail: verify.reason,
      receiptID: plan.receiptID || "", journalID: plan.journalID || "",
      auditID: plan.auditID || "", reversalReceiptID: plan.receiptRows &&
        plan.receiptRows[0] ? String(plan.receiptRows[0].TreasuryReceiptID || "") : ""
    });
  }
  if (operation.State !== "IN_PROGRESS" && operation.State !== "COMMITTED") {
    return outcome(life.STATUS.RECOVERY_REQUIRED, {
      code: codes.OPERATION_STATE_CORRUPTED, detail: "STATE:" + String(operation.State),
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  var schemaGate = treasuryReceiptSchemaGate_(runtime.spreadsheet);
  if (schemaGate.status !== "PASS") {
    return outcome(life.STATUS.RECOVERY_REQUIRED, {
      code: codes.SCHEMA_NOT_READY, detail: schemaGate.badSheets.join(","),
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  var bounds = treasuryLifecycleBounds_(plan);
  if (!bounds.ok) {
    return outcome(life.STATUS.RECOVERY_REQUIRED, {
      code: codes.PAYLOAD_TOO_LARGE, detail: bounds.detail,
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  var inspection = treasuryLifecycleInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(life.STATUS.UNKNOWN, {
      code: codes.READBACK_INCOMPLETE, detail: inspection.detail,
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  if (inspection.state === "EXACT") {
    var signature = treasuryLifecycleVerifySignatures_(plan, runtime.spreadsheet);
    if (signature.status === "UNKNOWN") {
      return outcome(life.STATUS.UNKNOWN, {
        code: signature.code, detail: signature.detail,
        receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
      });
    }
    if (!signature.ok) {
      return outcome(life.STATUS.RECOVERY_REQUIRED, {
        code: signature.code, detail: signature.detail,
        receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
      });
    }
    if (operation.State === "COMMITTED") {
      if (runtime.crash) runtime.crash("T6_AFTER_COMMIT");
      return outcome(life.STATUS.DONE, {
        replay: true, writeCount: 0,
        receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID,
        reversalReceiptID: String(plan.receiptRows[0].TreasuryReceiptID)
      });
    }
    if (runtime.crash) runtime.crash("T6_AFTER_READBACK");
    if (runtime.crash) runtime.crash("T6_BEFORE_COMMIT");
    var commit = treasuryReceiptCommit_(operation, runtime);
    if (!commit.ok) {
      var freshWrites = plan.operationType === life.REVERSE.OPERATION_TYPE ?
        life.REVERSE.FRESH_WRITE_COUNT : life.CORRECT.FRESH_WRITE_COUNT;
      return outcome(commit.status, {
        code: commit.code, writeCount: freshWrites, detail: commit.detail,
        receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
      });
    }
    if (runtime.crash) runtime.crash("T6_AFTER_COMMIT");
    return outcome(life.STATUS.DONE, {
      replay: true, writeCount: 0,
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID,
      reversalReceiptID: String(plan.receiptRows[0].TreasuryReceiptID)
    });
  }
  if (operation.State === "COMMITTED") {
    return outcome(life.STATUS.RECOVERY_REQUIRED, {
      code: inspection.state === "CONFLICT" ?
        (String(inspection.detail).indexOf("ORIGINAL_IMMUTABLE") !== -1 ?
          codes.ORIGINAL_IMMUTABLE : codes.RECOVERY_REQUIRED) : codes.ARTIFACTS_INCOMPLETE,
      detail: inspection.detail,
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  if (inspection.state === "NONE") {
    return treasuryLifecycleApplyBatch_(plan, operation, runtime);
  }
  return outcome(life.STATUS.RECOVERY_REQUIRED, {
    code: inspection.state === "CONFLICT" ?
      (String(inspection.detail).indexOf("ORIGINAL_IMMUTABLE") !== -1 ?
        codes.ORIGINAL_IMMUTABLE : codes.RECOVERY_REQUIRED) : codes.ARTIFACTS_INCOMPLETE,
    detail: inspection.detail,
    receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
  });
}

// ---------------------------------------------------------------------------
// New-intent path (lock held, lookup returned absent). Mode gate first, then
// every lifecycle gate re-validated inside the lock immediately before plan
// freeze (T2 sections 12-14, 16); every gate refusal writes zero.
// ---------------------------------------------------------------------------
function treasuryLifecycleNewIntent_(normalized, hash, runtime, kind) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES;
  function outcome(status, fields) {
    return treasuryLifecycleResult_(status,
      Object.assign({ requestKey: normalized.requestKey }, fields || {}));
  }
  var gate = treasuryReceiptModeGate(runtime.config);
  if (!gate.allowed) return outcome(life.STATUS.REFUSED, { code: gate.code });
  var target = null;
  try {
    target = treasuryLifecycleResolveTarget_(runtime.spreadsheet, normalized.treasuryReceiptID);
  } catch (error) {
    return outcome(life.STATUS.REFUSED, {
      code: error.treasuryCode || codes.TARGET_NOT_FOUND,
      field: error.field || "treasuryReceiptID", detail: error.message
    });
  }
  try {
    treasuryLifecycleVerifyOriginal_(runtime.spreadsheet, target);
  } catch (error) {
    return outcome(life.STATUS.REFUSED, {
      code: error.treasuryCode || codes.EXPOSURE_EXCEPTION,
      field: error.field || "treasuryReceiptID", detail: error.message
    });
  }
  try {
    treasuryLifecycleClaimScan_(runtime.spreadsheet, target, kind);
  } catch (error) {
    return outcome(life.STATUS.REFUSED, {
      code: error.treasuryCode || codes.EXPOSURE_EXCEPTION,
      field: error.field || "treasuryReceiptID", detail: error.message
    });
  }
  var recognitionID = String(target.RecognitionID);
  var exposure = null;
  try { exposure = treasuryResolveExposure_(recognitionID, runtime.spreadsheet); }
  catch (error) {
    return outcome(life.STATUS.REFUSED, {
      code: error.treasuryCode || codes.RECOGNITION_INTEGRITY_FAILURE,
      field: error.field || "recognitionID", detail: error.message
    });
  }
  var outstandingView = null;
  try {
    outstandingView = treasuryComputeOutstanding_(recognitionID, exposure.recognizedAmount,
      runtime.spreadsheet, "");
  } catch (error) {
    return outcome(life.STATUS.REFUSED, {
      code: error.treasuryCode || codes.EXPOSURE_EXCEPTION,
      field: error.field || "recognitionID", detail: error.message
    });
  }
  var amount = Number(target.GrossAmount);
  if (!isFinite(amount) || amount <= 0 || Math.floor(amount) !== amount) {
    return outcome(life.STATUS.REFUSED, { code: codes.AMOUNT_NOT_POSITIVE, field: "grossAmount" });
  }
  if (kind === "CORRECT") {
    // Replacement must satisfy the ordinary full-clearing rule against the
    // POST-REVERSAL outstanding (T2 section 13): postReversal =
    // outstanding + amount must equal the replacement amount exactly. Any
    // exposure change (Sales amount drift, partial state) fails closed.
    var postReversal = outstandingView.outstanding + amount;
    if (postReversal !== amount) {
      return outcome(life.STATUS.REFUSED, {
        code: codes.AMOUNT_MISMATCH, field: "grossAmount",
        detail: "POST_REVERSAL_OUTSTANDING:" + outstandingView.outstanding
      });
    }
  }
  var destination = null, originalDestination = null;
  try {
    originalDestination = treasuryLifecycleAccountGate_(runtime.spreadsheet,
      String(target.DestinationAccountCode));
    if (kind === "CORRECT") {
      destination = treasuryLifecycleAccountGate_(runtime.spreadsheet,
        normalized.destinationAccountCode);
    } else {
      destination = originalDestination;
    }
  } catch (error) {
    return outcome(life.STATUS.REFUSED, {
      code: error.treasuryCode || codes.SCHEMA_NOT_READY,
      field: error.field || "destinationAccountCode", detail: error.message
    });
  }
  var now = runtime.now();
  var reversalDate = null;
  try { reversalDate = treasuryDateKey(now); }
  catch (error) {
    return outcome(life.STATUS.REFUSED, {
      code: error.treasuryCode || codes.DATE_INVALID, field: "actionDate",
      detail: String(error && error.message || error)
    });
  }
  var resolvedActor = normalized.actor || runtime.actor();
  var context = null;
  try {
    context = treasuryReceiptFrozenContext_(runtime.spreadsheet, recognitionID,
      kind === "CORRECT" ? treasuryReceiptId(life.CORRECT.OPERATION_TYPE,
        normalized.requestKey, life.CORRECT.SIDE) :
        treasuryReceiptId(life.REVERSE.OPERATION_TYPE, normalized.requestKey,
          life.REVERSE.SIDE),
      treasuryAuditId(kind === "CORRECT" ? life.CORRECT.OPERATION_TYPE :
        life.REVERSE.OPERATION_TYPE, normalized.requestKey,
        kind === "CORRECT" ? life.CORRECT.SIDE : life.REVERSE.SIDE));
  } catch (error) {
    return outcome(life.STATUS.REFUSED, {
      code: error.treasuryCode || codes.EXPOSURE_EXCEPTION,
      field: error.field || "recognitionID", detail: error.message
    });
  }
  var plan = null;
  try {
    var planInput = {
      normalized: normalized, hash: hash, config: runtime.config,
      exposure: { recognitionID: recognitionID, orderID: exposure.orderID,
        revisionID: exposure.revisionID, recognizedAmount: exposure.recognizedAmount },
      target: target,
      targetReceiptHash: treasuryReceiptContextHash_(target,
        TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.RECEIPTS.HEADERS),
      outstanding: outstandingView.outstanding,
      destination: destination, originalDestination: originalDestination,
      reversalDate: reversalDate, actor: resolvedActor, now: now, context: context
    };
    plan = kind === "CORRECT" ?
      treasuryLifecycleCorrectionPlan_(planInput) :
      treasuryLifecycleReversalPlan_(planInput);
  } catch (error) {
    return outcome(life.STATUS.REFUSED,
      { code: codes.PAYLOAD_INVALID, detail: "PLAN_BUILD:" + error.message });
  }
  var verify = treasuryLifecycleVerifyPlan_(plan);
  if (!verify.ok) {
    return outcome(life.STATUS.REFUSED, { code: codes.OPERATION_PLAN_MALFORMED,
      detail: verify.reason });
  }
  var bounds = treasuryLifecycleBounds_(plan);
  if (!bounds.ok) {
    return outcome(life.STATUS.REFUSED, { code: codes.PAYLOAD_TOO_LARGE, detail: bounds.detail });
  }
  if (runtime.crash) runtime.crash("T6_BEFORE_INTENT");
  var operation = {
    TreasuryOperationID: plan.operationID,
    OperationType: plan.operationType,
    RecognitionID: plan.recognitionID,
    RequestKey: plan.requestKey,
    State: "IN_PROGRESS",
    PayloadHash: hash,
    OperationPlan: JSON.stringify(plan),
    CreatedAt: now,
    UpdatedAt: now,
    LastError: ""
  };
  try { treasuryOperationAppend_(runtime.spreadsheet, operation, runtime); }
  catch (error) {
    return outcome(life.STATUS.RECOVERY_REQUIRED,
      { code: codes.DUPLICATE_RECEIPT_ID, operationID: plan.operationID,
        detail: "INTENT_APPEND_FAILED:" + error.message });
  }
  if (runtime.crash) runtime.crash("T6_AFTER_INTENT_PERSIST");
  var readback = null;
  var schema = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.OPERATIONS;
  try {
    readback = treasuryOperationFind_(runtime.spreadsheet, plan.operationType,
      normalized.requestKey);
  } catch (error) {
    return outcome(life.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, operationID: plan.operationID,
        detail: "INTENT_READBACK_FAILED:" + error.message });
  }
  if (!readback) {
    return outcome(life.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, operationID: plan.operationID,
        detail: "INTENT_ROW_MISSING" });
  }
  if (readback.State !== "IN_PROGRESS" ||
      !treasuryReceiptFieldsExact_(readback, operation, schema.HEADERS)) {
    var mismatch = schema.HEADERS.filter(function(header) {
      return !treasuryReceiptFieldEqual_(readback[header], operation[header]);
    });
    return outcome(life.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, operationID: plan.operationID,
        detail: "INTENT_ROW_MISMATCH:" + mismatch.join(",") });
  }
  if (runtime.crash) runtime.crash("T6_AFTER_INTENT");
  return treasuryLifecycleApplyBatch_(plan, operation, runtime);
}

// ---------------------------------------------------------------------------
// Lifecycle cores. Fixed order: normalize -> structural config -> schema ->
// EXACT (OperationType, RequestKey) lookup BEFORE any target planning ->
// resume or new intent. Never acquires a lock (the outer wrapper owns the
// single ScriptLock).
// ---------------------------------------------------------------------------
function treasuryLifecycleExecuteWithRuntime_(payload, runtime, kind) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, codes = life.CODES;
  var operationType = kind === "CORRECT" ? life.CORRECT.OPERATION_TYPE :
    life.REVERSE.OPERATION_TYPE;
  var normalized;
  try {
    normalized = kind === "CORRECT" ?
      treasuryNormalizeCorrectionRequest_(payload) :
      treasuryNormalizeReversalRequest_(payload);
  } catch (error) {
    return treasuryLifecycleResult_(life.STATUS.REFUSED, {
      code: error.treasuryCode || codes.PAYLOAD_INVALID,
      requestKey: treasuryLifecyclePayloadKey_(payload),
      field: error.field || "", detail: error.message
    });
  }
  var base = { requestKey: normalized.requestKey };
  var configValidation = validateTreasuryReceiptConfig(runtime.config);
  if (configValidation.status !== "PASS") {
    return treasuryLifecycleResult_(life.STATUS.REFUSED, Object.assign({
      code: configValidation.errors.length ? configValidation.errors[0].code :
        codes.CONFIG_INVALID,
      detail: "CONFIG_INVALID"
    }, base));
  }
  var schema = treasuryReceiptSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return treasuryLifecycleResult_(life.STATUS.REFUSED, Object.assign({
      code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(",")
    }, base));
  }
  var existing = null;
  try {
    existing = treasuryOperationFind_(runtime.spreadsheet, operationType,
      normalized.requestKey);
  } catch (error) {
    return treasuryLifecycleResult_(life.STATUS.RECOVERY_REQUIRED, Object.assign({
      code: error && error.message === "DUPLICATE_OPERATION" ?
        codes.DUPLICATE_RECEIPT_ID : codes.EXPOSURE_EXCEPTION,
      detail: error && error.message ? error.message : ""
    }, base));
  }
  var hash = transactionPayloadHash_(normalized);
  var result = existing ?
    treasuryLifecycleResume_(existing, hash, normalized, runtime, operationType) :
    treasuryLifecycleNewIntent_(normalized, hash, runtime, kind);
  // Post-commit freshness (U10F pattern): ONLY a DONE result (fresh commit or
  // COMMITTED replay) may bump the shared dashboard cache revision.
  if (result.status === life.STATUS.DONE && typeof runtime.invalidateCache === "function") {
    try { runtime.invalidateCache(); }
    catch (cacheError) {
      Logger.log("Treasury T6 post-commit cache invalidation skipped: " +
        String(cacheError && cacheError.message || cacheError));
    }
  }
  return result;
}

function treasuryLifecycleReverseWithRuntime_(payload, runtime) {
  return treasuryLifecycleExecuteWithRuntime_(payload, runtime, "REVERSE");
}

function treasuryLifecycleCorrectWithRuntime_(payload, runtime) {
  return treasuryLifecycleExecuteWithRuntime_(payload, runtime, "CORRECT");
}

// Production runtime factory. Never invoked by local tests. Config comes from
// the read-only T3 resolver; the batch transport reuses the T4 sanitized
// Sheets REST path (identical write surfaces).
function treasuryReceiptLifecycleRuntime_() {
  var ss = requireNumlockProductionSpreadsheet();
  var state = treasuryReceiptConfigState();
  return {
    spreadsheet: ss,
    lock: LockService.getScriptLock(),
    now: function() { return new Date(); },
    actor: function() { return Session.getActiveUser().getEmail() || CANONICAL_ENTRY.USER; },
    config: state.config,
    flush: function() { SpreadsheetApp.flush(); },
    batch: function(valueRanges) { return treasuryReceiptBatchRequest_(valueRanges); },
    invalidateCache: function() { invalidateDashboardCache_(); }
  };
}

// Public wrappers: the ONLY outer locks, acquired BEFORE normalize/lookup and
// released exactly once in finally. Lock or runtime failure happens before any
// durable intent => definite REFUSED with TREASURY_LOCK_TIMEOUT (zero writes);
// only post-intent execution uncertainty is UNKNOWN.
function treasuryReceiptDurableReverse(payload) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, runtime = null, acquired = false, result;
  var requestKey = treasuryLifecyclePayloadKey_(payload);
  try {
    runtime = treasuryReceiptLifecycleRuntime_();
  } catch (error) {
    return treasuryLifecycleResult_(life.STATUS.REFUSED, {
      code: life.CODES.SCHEMA_NOT_READY, requestKey: requestKey,
      detail: "RUNTIME_UNAVAILABLE:" + String(error && error.message || error)
    });
  }
  try {
    runtime.lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return treasuryLifecycleResult_(life.STATUS.REFUSED, {
      code: life.CODES.LOCK_TIMEOUT, requestKey: requestKey,
      detail: String(error && error.message || error)
    });
  }
  try {
    result = treasuryLifecycleReverseWithRuntime_(payload, runtime);
  } catch (error) {
    result = treasuryLifecycleResult_(life.STATUS.UNKNOWN, {
      code: life.CODES.SAVE_EXECUTION_UNKNOWN, requestKey: requestKey,
      detail: String(error && error.message || error)
    });
  } finally {
    if (acquired) {
      try { runtime.lock.releaseLock(); } catch (lockError) { /* lock auto-expires */ }
    }
  }
  return result;
}

function treasuryReceiptDurableCorrect(payload) {
  var life = TREASURY_RECEIPT_V1_LIFECYCLE, runtime = null, acquired = false, result;
  var requestKey = treasuryLifecyclePayloadKey_(payload);
  try {
    runtime = treasuryReceiptLifecycleRuntime_();
  } catch (error) {
    return treasuryLifecycleResult_(life.STATUS.REFUSED, {
      code: life.CODES.SCHEMA_NOT_READY, requestKey: requestKey,
      detail: "RUNTIME_UNAVAILABLE:" + String(error && error.message || error)
    });
  }
  try {
    runtime.lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return treasuryLifecycleResult_(life.STATUS.REFUSED, {
      code: life.CODES.LOCK_TIMEOUT, requestKey: requestKey,
      detail: String(error && error.message || error)
    });
  }
  try {
    result = treasuryLifecycleCorrectWithRuntime_(payload, runtime);
  } catch (error) {
    result = treasuryLifecycleResult_(life.STATUS.UNKNOWN, {
      code: life.CODES.SAVE_EXECUTION_UNKNOWN, requestKey: requestKey,
      detail: String(error && error.message || error)
    });
  } finally {
    if (acquired) {
      try { runtime.lock.releaseLock(); } catch (lockError) { /* lock auto-expires */ }
    }
  }
  return result;
}
