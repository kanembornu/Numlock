// Treasury T4 durable receipt Save core for TREASURY_RECEIPT_V1: normalize ->
// config/schema/account preflight -> exact (OperationType, RequestKey) lookup
// BEFORE exposure planning -> committed replay verify / conflict / IN_PROGRESS
// resume -> resolve V2 exposure (read-only reuse of the U3 verifier) -> exact
// outstanding -> exact full clearing -> freeze immutable OperationPlan once ->
// persist TreasuryOperation IN_PROGRESS + exact ten-field readback -> ONE
// atomic spreadsheets.batchUpdate (three appendCells subrequests: receipt row +
// 2 BalanceLedger lines + 1 audit row) -> exact artifact verification + journal
// signature recomputed from persisted rows -> COMMITTED + exact readback ->
// best-effort cache invalidation -> DONE. Authority:
// docs/TREASURY-T2-RECEIPT-AUTHORITY-AND-RECONCILIATION-CONTRACT.md (sections
// 4-10, 14-18, 22, 24) on top of the T3 foundation (99.Treasury.Receipt.
// Foundation.js) — schemas, config, eligibility, 1030 preflight, dates, IDs,
// and journal signature are REUSED, never forked. Reversal/correction (T6), the
// canonical projection (T5), UI, and activation are out of scope. NO production
// execution from tests; local/in-memory fixtures only. The single batchUpdate
// is the ONLY atomic boundary (all three subrequests or none); intent, batch,
// readback, and commit remain multistep with deterministic recovery.
var TREASURY_RECEIPT_V1_SAVE = Object.freeze({
  OPERATION_TYPE: "TREASURY_RECEIPT_SAVE",
  SIDE: "PRIMARY",
  RECEIPT_TYPE: "SALES_RECEIPT",
  PLAN_VERSION: 1,
  // The ONLY surfaces the Save batch may ever touch.
  WRITE_SURFACES: Object.freeze(["TreasuryReceipts", "BalanceLedger", "TreasuryAudits"]),
  MAX_CELL_CHARS: 45000,
  MAX_BATCH_CELLS: 4000,
  MAX_REQUEST_BYTES: 1000000,
  REQUEST_OVERHEAD_BYTES: 4096,
  MIN_REQUEST_KEY: 4,
  MAX_REQUEST_KEY: 128,
  MIN_EVIDENCE_REF: 3,
  MAX_EVIDENCE_REF: 200,
  FRESH_WRITE_COUNT: 4,
  STATUS: Object.freeze({
    DONE: "DONE", REFUSED: "REFUSED", CONFLICT: "CONFLICT",
    UNKNOWN: "UNKNOWN", RECOVERY_REQUIRED: "RECOVERY_REQUIRED"
  }),
  // Frozen T2 section 24 codes used by T4. T3-owned codes reference the T3
  // ERROR_CODES constants directly (single source); the remaining codes are
  // the exact frozen T2 strings — no aliases, no invented codes.
  CODES: (function() {
    var t3 = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
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
      PAYLOAD_TOO_LARGE: "TREASURY_PAYLOAD_TOO_LARGE",
      EVIDENCE_TYPE_INVALID: "TREASURY_EVIDENCE_TYPE_INVALID",
      EVIDENCE_REF_INVALID: "TREASURY_EVIDENCE_REF_INVALID",
      RECOGNITION_MISSING: "TREASURY_RECOGNITION_MISSING",
      RECOGNITION_NOT_V2: "TREASURY_RECOGNITION_NOT_V2",
      RECOGNITION_INTEGRITY_FAILURE: "TREASURY_RECOGNITION_INTEGRITY_FAILURE",
      ORDER_LINEAGE_MISSING: "TREASURY_ORDER_LINEAGE_MISSING",
      RECOGNITION_INACTIVE: "TREASURY_RECOGNITION_INACTIVE",
      NO_ELIGIBLE_EXPOSURE: "TREASURY_NO_ELIGIBLE_EXPOSURE",
      EXPOSURE_BUSY: "TREASURY_EXPOSURE_BUSY",
      EXPOSURE_EXCEPTION: "TREASURY_EXPOSURE_EXCEPTION",
      AMOUNT_NOT_POSITIVE: "TREASURY_AMOUNT_NOT_POSITIVE",
      AMOUNT_MISMATCH: "TREASURY_AMOUNT_MISMATCH",
      ALREADY_CLEARED: "TREASURY_ALREADY_CLEARED",
      REQUEST_KEY_CONFLICT: "TREASURY_REQUEST_KEY_CONFLICT",
      DUPLICATE_RECEIPT_ID: "TREASURY_DUPLICATE_RECEIPT_ID",
      DUPLICATE_JOURNAL_SOURCE: "TREASURY_DUPLICATE_JOURNAL_SOURCE",
      JOURNAL_SIGNATURE_INVALID: "TREASURY_JOURNAL_SIGNATURE_INVALID",
      OPERATION_PLAN_MALFORMED: "TREASURY_OPERATION_PLAN_MALFORMED",
      OPERATION_STATE_CORRUPTED: "TREASURY_OPERATION_STATE_CORRUPTED",
      LOCK_TIMEOUT: "TREASURY_LOCK_TIMEOUT",
      INTENT_READBACK_FAILED: "TREASURY_INTENT_READBACK_FAILED",
      ARTIFACTS_INCOMPLETE: "TREASURY_ARTIFACTS_INCOMPLETE",
      BATCH_OUTCOME_UNKNOWN: "TREASURY_BATCH_OUTCOME_UNKNOWN",
      READBACK_INCOMPLETE: "TREASURY_READBACK_INCOMPLETE",
      SAVE_EXECUTION_UNKNOWN: "TREASURY_SAVE_EXECUTION_UNKNOWN",
      RECOVERY_REQUIRED: "TREASURY_RECOVERY_REQUIRED"
    });
  })()
});

// Envelope result. NEVER a { success: false } DTO. UNKNOWN /
// RECOVERY_REQUIRED always retain requestKey + operation/exposure identity so
// an uncertain outcome can never collapse into a definite loss of identity.
function treasuryReceiptSaveResult_(status, fields) {
  return Object.assign({
    status: status, code: "", requestKey: "", operationID: "", recognitionID: "",
    receiptID: "", journalID: "", auditID: "", writeCount: 0, replay: false,
    field: "", detail: ""
  }, fields || {});
}

function treasuryReceiptSaveError_(code, field, message) {
  var error = new Error(message || code);
  error.treasuryCode = code;
  error.field = field || "";
  return error;
}

function treasuryReceiptSavePayloadKey_(payload) {
  return payload && payload.requestKey !== undefined && payload.requestKey !== null ?
    String(payload.requestKey) : "";
}

// ---------------------------------------------------------------------------
// Pure input normalization (T2 section 16 step 1; operator facts only).
// Definite refusals fail here before any read or write. The exact normalized
// structure is persisted in the plan and compared verbatim on replay/conflict.
// Never coerces invalid -> valid and never rounds partial -> full.
// ---------------------------------------------------------------------------
function treasuryNormalizeReceiptRequest_(payload) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES;
  var p = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  var requestKey = p.requestKey === undefined || p.requestKey === null ? "" : String(p.requestKey).trim();
  if (!new RegExp("^[A-Za-z0-9][A-Za-z0-9._:-]{3,127}$").test(requestKey) ||
      requestKey.length > save.MAX_REQUEST_KEY) {
    throw treasuryReceiptSaveError_(codes.PAYLOAD_INVALID, "requestKey", "REQUEST_KEY_INVALID");
  }
  var recognitionID = p.recognitionID === undefined || p.recognitionID === null ?
    "" : String(p.recognitionID).trim();
  if (!/^SCR-[A-Za-z0-9-]{3,127}$/.test(recognitionID)) {
    throw treasuryReceiptSaveError_(codes.PAYLOAD_INVALID, "recognitionID", "RECOGNITION_ID_INVALID");
  }
  var destinationAccountCode = p.destinationAccountCode === undefined ||
    p.destinationAccountCode === null ? "" : String(p.destinationAccountCode).trim();
  if (!destinationAccountCode || destinationAccountCode.length > 16 ||
      /[\x00-\x1F\x7F]/.test(destinationAccountCode)) {
    throw treasuryReceiptSaveError_(codes.PAYLOAD_INVALID, "destinationAccountCode",
      "DESTINATION_ACCOUNT_CODE_INVALID");
  }
  var rawAmount = p.grossAmount, grossAmount;
  if (typeof rawAmount === "number" && isFinite(rawAmount)) grossAmount = rawAmount;
  else if (typeof rawAmount === "string" && /^-?\d{1,15}$/.test(rawAmount.trim())) {
    grossAmount = Number(rawAmount.trim());
  } else {
    throw treasuryReceiptSaveError_(codes.PAYLOAD_INVALID, "grossAmount", "GROSS_AMOUNT_INVALID");
  }
  var receiptDate = typeof p.receiptDate === "string" ? p.receiptDate.trim() : "";
  if (treasuryValidateReceiptDate(receiptDate).status !== "PASS") {
    throw treasuryReceiptSaveError_(codes.DATE_INVALID, "receiptDate", "RECEIPT_DATE_INVALID");
  }
  var evidenceType = typeof p.evidenceType === "string" ? p.evidenceType.trim() : "";
  if (evidenceType !== TREASURY_RECEIPT_V1_CONTRACT.EVIDENCE_TYPE) {
    throw treasuryReceiptSaveError_(codes.EVIDENCE_TYPE_INVALID, "evidenceType",
      "EVIDENCE_TYPE_MUST_BE_MANUAL_VERIFIED");
  }
  var evidenceRef = typeof p.evidenceRef === "string" ? p.evidenceRef.trim() : "";
  if (evidenceRef.length < save.MIN_EVIDENCE_REF || evidenceRef.length > save.MAX_EVIDENCE_REF ||
      /[\x00-\x1F\x7F]/.test(evidenceRef) || /\d{13,19}/.test(evidenceRef.replace(/[- ]/g, "")) ||
      /(password|passwd|secret|token\s*[=:]|pin\s*[=:])/i.test(evidenceRef)) {
    throw treasuryReceiptSaveError_(codes.EVIDENCE_REF_INVALID, "evidenceRef", "EVIDENCE_REF_INVALID");
  }
  var actor = p.actor === undefined || p.actor === null ? "" : String(p.actor).trim();
  if (actor && (actor.length > 200 || /[\x00-\x1F\x7F]/.test(actor))) {
    throw treasuryReceiptSaveError_(codes.PAYLOAD_INVALID, "actor", "ACTOR_INVALID");
  }
  return {
    requestKey: requestKey,
    recognitionID: recognitionID,
    destinationAccountCode: destinationAccountCode,
    grossAmount: grossAmount,
    receiptDate: receiptDate,
    evidenceType: evidenceType,
    evidenceRef: evidenceRef,
    actor: actor
  };
}

// Date-safe single-field equality (same comparison class as the U2 ten-field
// readback: Date instances compare by instant against Dates or ISO strings).
function treasuryReceiptFieldEqual_(actual, expected) {
  if (actual instanceof Date || expected instanceof Date) {
    var av = actual instanceof Date ? actual.getTime() :
      (actual === undefined || actual === null || actual === "" ? NaN : new Date(actual).getTime());
    var ev = expected instanceof Date ? expected.getTime() :
      (expected === undefined || expected === null || expected === "" ? NaN : new Date(expected).getTime());
    return !isNaN(av) && !isNaN(ev) && av === ev;
  }
  return String(actual === undefined || actual === null ? "" : actual) ===
    String(expected === undefined || expected === null ? "" : expected);
}

function treasuryReceiptFieldsExact_(actual, expected, headers) {
  if (!actual || !expected) return false;
  return headers.every(function(header) {
    return treasuryReceiptFieldEqual_(actual[header], expected[header]);
  });
}

function treasuryReceiptRowExact_(actual, expected, headers, skip) {
  if (!actual || !expected) return false;
  return headers.every(function(header) {
    if (skip && skip.indexOf(header) !== -1) return true;
    return treasuryReceiptFieldEqual_(actual[header], expected[header]);
  });
}
// ---------------------------------------------------------------------------
// Zero-write schema gate: the three Treasury sheets must match the T3 strict
// frozen extent validators; every authority sheet the Save reads must match
// its canonical headers exactly. Header reads only; never writes.
// ---------------------------------------------------------------------------
function treasuryReceiptSchemaGate_(ss) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT, bad = [];
  var strict = ["RECEIPTS", "OPERATIONS", "AUDITS"];
  strict.forEach(function(key) {
    var schema = contract.SCHEMAS[key], sheet = null;
    try { sheet = ss.getSheetByName(schema.SHEET); } catch (error) { sheet = null; }
    if (!sheet) { bad.push(schema.SHEET); return; }
    var headers = null;
    try {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) {
        return String(value);
      });
    } catch (error) { bad.push(schema.SHEET); return; }
    if (validateTreasurySchemaHeaders(key, headers).status !== "PASS") bad.push(schema.SHEET);
  });
  var t = TRANSACTION_PRODUCTION_CONTRACT;
  var authority = [
    ["BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS],
    ["Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS],
    ["SalesRecognitionEvents", SALES_RECOGNITION_V2_CONTRACT.HEADERS],
    ["TransactionOperations", t.OPERATIONS.HEADERS],
    ["SalesRecognitionAudits", SALES_RECOGNITION_V2_SAVE.AUDIT_HEADERS],
    ["Orders", t.ORDERS.HEADERS],
    ["OrderLines", t.ORDER_LINES.HEADERS]
  ];
  authority.forEach(function(entry) {
    try { requireCanonicalHeaders(ss.getSheetByName(entry[0]), entry[1]); }
    catch (error) { bad.push(entry[0]); }
  });
  return { status: bad.length ? "FAIL" : "PASS", badSheets: bad };
}

function treasuryReceiptAccountRows_(ss) {
  return readCanonicalTable(ss, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
}

// ---------------------------------------------------------------------------
// TreasuryOperations durable access (independent T3 10-column sheet; the
// TransactionOperations repository is NEVER reused — T2 section 3).
// ---------------------------------------------------------------------------
function treasuryOperationFind_(ss, operationType, requestKey) {
  var schema = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.OPERATIONS;
  var rows = readCanonicalTable(ss, schema.SHEET, schema.HEADERS);
  var found = rows.filter(function(row) {
    return row.OperationType === operationType && String(row.RequestKey) === requestKey;
  });
  if (found.length > 1) throw new Error("DUPLICATE_OPERATION");
  return found[0] || null;
}

function treasuryOperationAppend_(ss, row, runtime) {
  var schema = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.OPERATIONS;
  var sheet = ss.getSheetByName(schema.SHEET);
  if (!sheet) throw new Error("OPERATION_SHEET_MISSING");
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, schema.HEADERS.length).setValues([
    schema.HEADERS.map(function(header) { return row[header] === undefined ? "" : row[header]; })
  ]);
  if (runtime && typeof runtime.flush === "function") runtime.flush();
}

function treasuryOperationUpdate_(ss, row, runtime) {
  var schema = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.OPERATIONS;
  var stored = treasuryOperationFind_(ss, row.OperationType, row.RequestKey);
  if (!stored || stored.TreasuryOperationID !== row.TreasuryOperationID) {
    throw new Error("OPERATION_NOT_FOUND");
  }
  var sheet = ss.getSheetByName(schema.SHEET);
  if (!sheet) throw new Error("OPERATION_SHEET_MISSING");
  sheet.getRange(stored.sourceRowIndex + 1, 1, 1, schema.HEADERS.length).setValues([
    schema.HEADERS.map(function(header) { return row[header] === undefined ? "" : row[header]; })
  ]);
  if (runtime && typeof runtime.flush === "function") runtime.flush();
}

// ---------------------------------------------------------------------------
// V2 exposure resolution — V2_ONLY (T2 section 7.1). NARROW read helper over
// the existing U3 verifier: this module READS Sales recognition artifacts and
// calls salesProjectionVerifyV2Event_ (97B) for integrity (journal exists,
// signature verifies, snapshot digests match, committed operation + audit
// linkage, owner order). CROSS-DOMAIN DEPENDENCY (documented): Treasury
// consumes Sales recognition authority read-only; it NEVER mutates Orders,
// OrderLines, SalesRecognitionEvents, or SalesRecognitionAudits and never
// clones the U3 projection.
// ---------------------------------------------------------------------------
function treasuryReadExposureSources_(ss) {
  var t = TRANSACTION_PRODUCTION_CONTRACT, contract = SALES_RECOGNITION_V2_CONTRACT,
    save = SALES_RECOGNITION_V2_SAVE;
  return {
    SalesRecognitionEvents: readCanonicalTable(ss, contract.SHEET, contract.HEADERS),
    TransactionOperations: readCanonicalTable(ss, t.OPERATIONS.SHEET, t.OPERATIONS.HEADERS),
    SalesRecognitionAudits: readCanonicalTable(ss, save.AUDIT_SHEET, save.AUDIT_HEADERS),
    BalanceLedger: readCanonicalTable(ss, "BalanceLedger",
      BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS),
    Orders: readCanonicalTable(ss, t.ORDERS.SHEET, t.ORDERS.HEADERS),
    OrderLines: readCanonicalTable(ss, t.ORDER_LINES.SHEET, t.ORDER_LINES.HEADERS)
  };
}

function treasuryResolveExposure_(recognitionID, ss) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES;
  var contract = SALES_RECOGNITION_V2_CONTRACT;
  var rows;
  try { rows = treasuryReadExposureSources_(ss); }
  catch (error) {
    throw treasuryReceiptSaveError_(codes.SCHEMA_NOT_READY, "recognitionID",
      "EXPOSURE_READ_FAILED:" + error.message);
  }
  var matches = rows.SalesRecognitionEvents.filter(function(row) {
    return String(row.RecognitionID === undefined || row.RecognitionID === null ?
      "" : row.RecognitionID).trim() === recognitionID;
  });
  if (!matches.length) {
    throw treasuryReceiptSaveError_(codes.RECOGNITION_MISSING, "recognitionID", "NO_EVENT_ROW");
  }
  if (matches.length > 1) {
    throw treasuryReceiptSaveError_(codes.RECOGNITION_INTEGRITY_FAILURE, "recognitionID",
      "DUPLICATE_RECOGNITION_ID");
  }
  var row = matches[0];
  if (String(row.ContractVersion || "") !== contract.CONTRACT_VERSION) {
    throw treasuryReceiptSaveError_(codes.RECOGNITION_NOT_V2, "recognitionID",
      "CONTRACT_VERSION:" + String(row.ContractVersion || ""));
  }
  if (String(row.EventType || "") !== "RECOGNITION") {
    throw treasuryReceiptSaveError_(codes.NO_ELIGIBLE_EXPOSURE, "recognitionID",
      "EVENT_TYPE:" + String(row.EventType || ""));
  }
  // Void/reversed exposures are never clearable (T2 section 7.1 rule 6): any
  // persisted V2 REVERSAL row targeting this recognition fails closed.
  var reversals = rows.SalesRecognitionEvents.filter(function(eventRow) {
    return String(eventRow.EventType || "") === "REVERSAL" &&
      String(eventRow.ReversalOfRecognitionID || "").trim() === recognitionID;
  });
  if (reversals.length) {
    throw treasuryReceiptSaveError_(codes.RECOGNITION_INACTIVE, "recognitionID",
      "REVERSAL_PRESENT:" + reversals.length);
  }
  // Integrity via the U3 committed-artifact verifier (read-only reuse).
  var orderIds = {};
  rows.Orders.forEach(function(order) { orderIds[String(order.OrderID)] = true; });
  var verdict = salesProjectionVerifyV2Event_(row, {
    sources: { rows: rows }, orderIds: orderIds
  });
  if (verdict.status !== "RECOGNIZED") {
    throw treasuryReceiptSaveError_(codes.RECOGNITION_INTEGRITY_FAILURE, "recognitionID",
      (verdict.issue && verdict.issue.code ? verdict.issue.code : verdict.status));
  }
  // Order + revision lineage resolves against Orders/OrderLines.
  if (!String(row.OrderID || "") || !orderIds[String(row.OrderID)] ||
      !String(row.RevisionID || "").trim() ||
      !rows.OrderLines.some(function(line) { return String(line.OrderID) === String(row.OrderID); })) {
    throw treasuryReceiptSaveError_(codes.ORDER_LINEAGE_MISSING, "recognitionID", "LINEAGE_UNRESOLVED");
  }
  var recognizedAmount = Number(row.Amount);
  if (!isFinite(recognizedAmount) || recognizedAmount <= 0) {
    throw treasuryReceiptSaveError_(codes.RECOGNITION_INTEGRITY_FAILURE, "recognitionID",
      "AMOUNT_INVALID");
  }
  return {
    row: row,
    orderID: String(row.OrderID),
    revisionID: String(row.RevisionID),
    recognizedAmount: recognizedAmount
  };
}
// ---------------------------------------------------------------------------
// Outstanding (T4 view; governing authorities: T2 section 12 > T5 projection >
// T4 implementation): cleared = committed ordinary - committed reversals;
// outstanding = recognized - cleared (a committed reversal contributes exactly
// once and restores the pre-receipt outstanding). Receipt activeness feeds the
// duplicate-active fail-closed gate ONLY — never the outstanding formula.
// Fail closed on uninterpretable Treasury state — unknown is NEVER treated as
// zero. Reads only the independent Treasury sheets; T5 owns the canonical
// projection.
// ---------------------------------------------------------------------------
function treasuryComputeOutstanding_(recognitionID, recognizedAmount, ss, ownOperationID) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  var receipts, operations;
  try {
    receipts = readCanonicalTable(ss, contract.SCHEMAS.RECEIPTS.SHEET,
      contract.SCHEMAS.RECEIPTS.HEADERS);
    operations = readCanonicalTable(ss, contract.SCHEMAS.OPERATIONS.SHEET,
      contract.SCHEMAS.OPERATIONS.HEADERS);
  } catch (error) {
    throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
      "TREASURY_STATE_READ_FAILED:" + error.message);
  }
  var seenOperations = {};
  operations.forEach(function(op) {
    var key = String(op.OperationType) + "|" + String(op.RequestKey);
    if (seenOperations[key]) {
      throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
        "DUPLICATE_OPERATION_ROW:" + key);
    }
    seenOperations[key] = true;
    var state = String(op.State === undefined || op.State === null ? "" : op.State);
    if (state !== "IN_PROGRESS" && state !== "COMMITTED") {
      throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
        "OPERATION_STATE:" + state);
    }
    if (state === "IN_PROGRESS" && String(op.RecognitionID) === recognitionID &&
        String(op.TreasuryOperationID) !== String(ownOperationID)) {
      throw treasuryReceiptSaveError_(codes.EXPOSURE_BUSY, "recognitionID",
        "OPERATION:" + String(op.TreasuryOperationID));
    }
  });
  var operationById = {};
  operations.forEach(function(op) { operationById[String(op.TreasuryOperationID)] = op; });
  var relevant = receipts.filter(function(receipt) {
    return String(receipt.RecognitionID) === recognitionID;
  });
  var classified = [];
  relevant.forEach(function(receipt) {
    var receiptType = String(receipt.ReceiptType === undefined || receipt.ReceiptType === null ?
      "" : receipt.ReceiptType);
    if (receiptType !== "SALES_RECEIPT" && receiptType !== "SALES_RECEIPT_REVERSAL") {
      throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
        "RECEIPT_TYPE:" + receiptType);
    }
    var op = operationById[String(receipt.OperationID)];
    if (!op || String(op.RequestKey) !== String(receipt.RequestKey) ||
        String(op.RecognitionID) !== recognitionID) {
      throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
        "RECEIPT_OPERATION_UNRESOLVED:" + String(receipt.TreasuryReceiptID));
    }
    if (String(op.State) === "IN_PROGRESS") {
      if (String(op.TreasuryOperationID) === String(ownOperationID)) return; // own intent, batch pending
      throw treasuryReceiptSaveError_(codes.EXPOSURE_BUSY, "recognitionID",
        "RECEIPT_OPERATION_PENDING:" + String(receipt.TreasuryReceiptID));
    }
    try { JSON.parse(op.OperationPlan); }
    catch (error) {
      throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
        "OPERATION_PLAN_MALFORMED:" + String(op.TreasuryOperationID));
    }
    var amount = Number(receipt.GrossAmount);
    if (!isFinite(amount) || amount <= 0) {
      throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
        "RECEIPT_AMOUNT_INVALID:" + String(receipt.TreasuryReceiptID));
    }
    classified.push({ receipt: receipt, kind: receiptType, amount: amount });
  });
  var receiptIdCounts = {}, reversedIds = {}, receiptIds = {};
  classified.forEach(function(entry) {
    var id = String(entry.receipt.TreasuryReceiptID);
    receiptIds[id] = true;
    if (entry.kind === "SALES_RECEIPT") {
      receiptIdCounts[id] = (receiptIdCounts[id] || 0) + 1;
    } else {
      var target = String(entry.receipt.ReversalOfReceiptID === undefined ||
        entry.receipt.ReversalOfReceiptID === null ? "" : entry.receipt.ReversalOfReceiptID);
      if (!target) {
        throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
          "REVERSAL_TARGET_MISSING:" + id);
      }
      if (reversedIds[target]) {
        // T2 section 12: one committed reversal max per target, fail closed.
        throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
          "REVERSAL_TARGET_MULTIPLE:" + target);
      }
      reversedIds[target] = true;
    }
  });
  Object.keys(receiptIdCounts).forEach(function(id) {
    if (receiptIdCounts[id] > 1) {
      throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
        "DUPLICATE_RECEIPT_ID:" + id);
    }
  });
  Object.keys(reversedIds).forEach(function(target) {
    if (!receiptIds[target]) {
      throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
        "REVERSAL_TARGET_UNKNOWN:" + target);
    }
  });
  var active = classified.filter(function(entry) {
    return entry.kind === "SALES_RECEIPT" && !reversedIds[String(entry.receipt.TreasuryReceiptID)];
  });
  if (active.length > 1) {
    throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
      "DUPLICATE_ACTIVE_RECEIPTS:" + active.length);
  }
  // T2 section 12 / T5 parity: EVERY committed ordinary receipt counts toward
  // cleared (including one later reversed — its committed reversal adds back
  // once). Never recognized - activeOrdinarySum + reversalSum.
  var ordinarySum = classified.filter(function(entry) {
    return entry.kind === "SALES_RECEIPT";
  }).reduce(function(total, entry) { return total + entry.amount; }, 0);
  var reversalSum = classified.filter(function(entry) {
    return entry.kind === "SALES_RECEIPT_REVERSAL";
  }).reduce(function(total, entry) { return total + entry.amount; }, 0);
  var cleared = ordinarySum - reversalSum;
  return {
    outstanding: recognizedAmount - cleared,
    activeClearings: cleared
  };
}

// ---------------------------------------------------------------------------
// Frozen sibling context (T2 sections 12, 16): same-recognition receipt and
// audit siblings observed under the lock IMMEDIATELY before plan freeze are
// recorded as sorted, unique, canonical IDs plus one content digest per row.
// A legitimate pre-existing sibling (e.g. a receipt already reversed before
// this replacement Save) never becomes a false cross-owner conflict, while a
// post-freeze sibling, a missing sibling, or an edited sibling (owner,
// recognition, or content change) still fails closed at readback. The own
// planned receipt/audit IDs are NEVER part of the context: they are derived
// and verified separately against the frozen plan rows.
// ---------------------------------------------------------------------------
function treasuryReceiptContextHash_(row, headers) {
  var canonicalRow = {};
  headers.forEach(function(header) {
    canonicalRow[header] = row[header] === undefined ? "" : row[header];
  });
  return transactionPayloadHash_(canonicalRow);
}

function treasuryReceiptFrozenContext_(ss, recognitionID, ownReceiptID, ownAuditID) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  var receipts, audits;
  try {
    receipts = readCanonicalTable(ss, contract.SCHEMAS.RECEIPTS.SHEET,
      contract.SCHEMAS.RECEIPTS.HEADERS);
    audits = readCanonicalTable(ss, contract.SCHEMAS.AUDITS.SHEET,
      contract.SCHEMAS.AUDITS.HEADERS);
  } catch (error) {
    throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
      "CONTEXT_READ_FAILED:" + error.message);
  }
  function collect(rows, idField, headers, ownID) {
    var digestById = {}, ids = [];
    rows.forEach(function(row) {
      if (String(row.RecognitionID) !== recognitionID) return;
      var id = String(row[idField] === undefined || row[idField] === null ? "" : row[idField]);
      if (!id || id === ownID) return;
      if (digestById[id]) {
        throw treasuryReceiptSaveError_(codes.EXPOSURE_EXCEPTION, "recognitionID",
          "CONTEXT_DUPLICATE_ID:" + id);
      }
      digestById[id] = treasuryReceiptContextHash_(row, headers);
      ids.push(id);
    });
    ids.sort();
    var hashes = {};
    ids.forEach(function(id) { hashes[id] = digestById[id]; });
    return { ids: ids, hashes: hashes };
  }
  var receiptContext = collect(receipts, "TreasuryReceiptID",
    contract.SCHEMAS.RECEIPTS.HEADERS, ownReceiptID);
  var auditContext = collect(audits, "AuditID", contract.SCHEMAS.AUDITS.HEADERS, ownAuditID);
  return {
    contextReceiptIds: receiptContext.ids,
    contextReceiptHashes: receiptContext.hashes,
    contextAuditIds: auditContext.ids,
    contextAuditHashes: auditContext.hashes
  };
}

// Normalized context view for readback. A legacy ordinary plan without context
// fields is interpreted as an EMPTY context (old fail-closed behavior); a
// multi-artifact plan without context never reaches readback (verify fails
// closed first).
function treasuryReceiptContextOf_(plan) {
  var context = { receiptIds: {}, receiptHashes: {}, auditIds: {}, auditHashes: {} };
  if (!plan || typeof plan !== "object") return context;
  if (!Array.isArray(plan.contextReceiptIds) || !Array.isArray(plan.contextAuditIds)) {
    return context;
  }
  plan.contextReceiptIds.forEach(function(id) {
    context.receiptIds[String(id)] = true;
  });
  plan.contextAuditIds.forEach(function(id) {
    context.auditIds[String(id)] = true;
  });
  if (plan.contextReceiptHashes && typeof plan.contextReceiptHashes === "object") {
    context.receiptHashes = plan.contextReceiptHashes;
  }
  if (plan.contextAuditHashes && typeof plan.contextAuditHashes === "object") {
    context.auditHashes = plan.contextAuditHashes;
  }
  return context;
}

// Structural shape of the frozen context fields, checked at plan verification
// (freeze-time REFUSED and every resume, fail closed, zero writes). Compatibility
// without persisted-plan rewrites: legacy ordinary pre-T6 plan missing BOTH
// context fields => empty context; a T6-era multi-artifact plan missing them
// => malformed.
function treasuryReceiptPlanMultiArtifact_(plan) {
  return [plan.plannedReceiptIds, plan.plannedAuditIds, plan.receiptRows].some(function(list) {
    return Array.isArray(list) && list.length > 1;
  });
}

function treasuryReceiptContextShape_(plan) {
  var hasReceipt = plan.contextReceiptIds !== undefined;
  var hasAudit = plan.contextAuditIds !== undefined;
  if (!hasReceipt && !hasAudit) {
    if (plan.contextReceiptHashes !== undefined || plan.contextAuditHashes !== undefined) {
      return { ok: false, reason: "CONTEXT_FIELDS_INCOMPLETE" };
    }
    if (treasuryReceiptPlanMultiArtifact_(plan)) return { ok: false, reason: "CONTEXT_MISSING" };
    return { ok: true };
  }
  if (!hasReceipt || !hasAudit) return { ok: false, reason: "CONTEXT_FIELDS_INCOMPLETE" };
  var idLists = [plan.contextReceiptIds, plan.contextAuditIds];
  var hashMaps = [plan.contextReceiptHashes, plan.contextAuditHashes];
  for (var i = 0; i < idLists.length; i++) {
    var ids = idLists[i];
    if (!Array.isArray(ids)) return { ok: false, reason: "CONTEXT_IDS_INVALID" };
    var previous = null;
    for (var j = 0; j < ids.length; j++) {
      var id = ids[j];
      if (typeof id !== "string" || !id) return { ok: false, reason: "CONTEXT_IDS_INVALID" };
      if (previous !== null && !(id > previous)) {
        return { ok: false, reason: "CONTEXT_IDS_INVALID" }; // sorted + unique
      }
      previous = id;
    }
    var hashes = hashMaps[i];
    if (!hashes || typeof hashes !== "object" || Array.isArray(hashes)) {
      return { ok: false, reason: "CONTEXT_HASHES_INVALID" };
    }
    var keys = Object.keys(hashes);
    if (keys.length !== ids.length) return { ok: false, reason: "CONTEXT_HASHES_INVALID" };
    for (var k = 0; k < keys.length; k++) {
      if (ids.indexOf(keys[k]) === -1 ||
          typeof hashes[keys[k]] !== "string" || !hashes[keys[k]]) {
        return { ok: false, reason: "CONTEXT_HASHES_INVALID" };
      }
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Immutable OperationPlan freeze (T2 sections 16, 18): every identity, row,
// snapshot, signature, payload hash, and contract/config identity derived once
// and persisted immutably with a canonical integrity digest. No business value
// is recomputed differently after a partial failure.
// ---------------------------------------------------------------------------
function treasuryReceiptPlan_(input) {
  var save = TREASURY_RECEIPT_V1_SAVE, contract = TREASURY_RECEIPT_V1_CONTRACT;
  var normalized = input.normalized, config = input.config, exposure = input.exposure;
  var destination = input.destination, nowISO = input.now.toISOString();
  var context = input.context;
  if (!context || !Array.isArray(context.contextReceiptIds) ||
      !Array.isArray(context.contextAuditIds)) {
    throw new Error("CONTEXT_MISSING"); // frozen sibling context is mandatory at freeze
  }
  var grossAmount = normalized.grossAmount;
  var operationID = treasuryOperationId(save.OPERATION_TYPE, normalized.requestKey);
  var receiptID = treasuryReceiptId(save.OPERATION_TYPE, normalized.requestKey, save.SIDE);
  var journalID = treasuryJournalId(save.OPERATION_TYPE, normalized.requestKey, save.SIDE);
  var auditID = treasuryAuditId(save.OPERATION_TYPE, normalized.requestKey, save.SIDE);
  var journalRows = [
    { JournalID: journalID, LineID: journalID + "-1", Tanggal: normalized.receiptDate,
      AccountCode: destination.code, Debit: grossAmount, Credit: 0,
      MovementType: contract.MOVEMENT_TYPE, SourceType: contract.SOURCE_TYPE, SourceID: receiptID,
      ExternalRef: normalized.recognitionID, Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: input.actor, UpdatedAt: nowISO, UpdatedBy: input.actor },
    { JournalID: journalID, LineID: journalID + "-2", Tanggal: normalized.receiptDate,
      AccountCode: contract.CLEARING_ACCOUNT_CODE, Debit: 0, Credit: grossAmount,
      MovementType: contract.MOVEMENT_TYPE, SourceType: contract.SOURCE_TYPE, SourceID: receiptID,
      ExternalRef: normalized.recognitionID, Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: input.actor, UpdatedAt: nowISO, UpdatedBy: input.actor }
  ];
  var journalSignature = treasuryJournalSignature(journalRows);
  var snapshot = {
    contractVersion: contract.CONTRACT_VERSION,
    activationID: config.activationID,
    configVersion: config.configVersion,
    operationType: save.OPERATION_TYPE,
    side: save.SIDE,
    recognitionID: normalized.recognitionID,
    orderID: exposure.orderID,
    revisionID: exposure.revisionID,
    recognizedAmount: exposure.recognizedAmount,
    outstandingBefore: input.outstanding,
    receiptAmount: grossAmount,
    destination: { code: destination.code, name: destination.name },
    receiptDate: normalized.receiptDate,
    economicDate: normalized.receiptDate,
    evidence: { type: normalized.evidenceType, ref: normalized.evidenceRef },
    journalID: journalID,
    targetReceiptID: "",
    reason: ""
  };
  var receiptRow = {
    TreasuryReceiptID: receiptID,
    ContractVersion: contract.CONTRACT_VERSION,
    OperationID: operationID,
    RequestKey: normalized.requestKey,
    RecognitionID: normalized.recognitionID,
    OrderID: exposure.orderID,
    RevisionID: exposure.revisionID,
    ReceiptType: save.RECEIPT_TYPE,
    DestinationAccountCode: destination.code,
    GrossAmount: grossAmount,
    ReceiptDate: normalized.receiptDate,
    EconomicDate: normalized.receiptDate,
    ReceivedAt: nowISO,
    EvidenceType: normalized.evidenceType,
    EvidenceRef: normalized.evidenceRef,
    JournalID: journalID,
    JournalSignature: journalSignature,
    PostingStatus: contract.POSTING_STATUS_COMMITTED,
    OriginalReceiptID: "",
    ReversalOfReceiptID: "",
    ReplacementReceiptID: "",
    Reason: "",
    Actor: input.actor,
    SnapshotJSON: JSON.stringify(snapshot)
  };
  var auditRow = {
    AuditID: auditID,
    ContractVersion: contract.CONTRACT_VERSION,
    OperationID: operationID,
    RequestKey: normalized.requestKey,
    TreasuryReceiptID: receiptID,
    RecognitionID: normalized.recognitionID,
    OrderID: exposure.orderID,
    JournalID: journalID,
    PayloadHash: input.hash,
    Actor: input.actor,
    SavedAt: nowISO
  };
  var plan = {
    planVersion: save.PLAN_VERSION,
    contractVersion: contract.CONTRACT_VERSION,
    operationType: save.OPERATION_TYPE,
    side: save.SIDE,
    receiptType: save.RECEIPT_TYPE,
    operationID: operationID,
    requestKey: normalized.requestKey,
    payloadHash: input.hash,
    normalizedPayload: normalized,
    config: { mode: config.mode, activationID: config.activationID,
      activatedAt: config.activatedAt, configVersion: config.configVersion },
    recognitionID: normalized.recognitionID,
    orderID: exposure.orderID,
    revisionID: exposure.revisionID,
    recognizedAmount: exposure.recognizedAmount,
    outstandingBefore: input.outstanding,
    receiptAmount: grossAmount,
    destination: { code: destination.code, name: destination.name },
    receiptDate: normalized.receiptDate,
    economicDate: normalized.receiptDate,
    evidence: { type: normalized.evidenceType, ref: normalized.evidenceRef },
    actor: input.actor,
    savedAt: nowISO,
    receiptID: receiptID,
    journalID: journalID,
    auditID: auditID,
    // Frozen sibling context: digest-covered immutable plan fields (the
    // planDigest below covers them like every other plan field).
    contextReceiptIds: context.contextReceiptIds,
    contextReceiptHashes: context.contextReceiptHashes,
    contextAuditIds: context.contextAuditIds,
    contextAuditHashes: context.contextAuditHashes,
    journalSignature: journalSignature,
    movementType: contract.MOVEMENT_TYPE,
    sourceType: contract.SOURCE_TYPE,
    receiptRow: receiptRow,
    journalRows: journalRows,
    auditRow: auditRow,
    snapshot: snapshot
  };
  plan.planDigest = transactionPayloadHash_(plan);
  return plan;
}
// Plan integrity + shape invariants. Runs at freeze time (definite REFUSED,
// pre-write) and on every resume (fail closed, ZERO additional writes).
// Malformed shape and derivational/content disagreement both fail closed with
// the frozen T2 code TREASURY_OPERATION_PLAN_MALFORMED (corrupted-plan class,
// T2 section 15); the reason string distinguishes them for evidence.
function treasuryReceiptVerifyPlan_(plan) {
  var save = TREASURY_RECEIPT_V1_SAVE, contract = TREASURY_RECEIPT_V1_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  function fail(reason) { return { ok: false, kind: "MALFORMED", reason: reason }; }
  function drift(reason) { return { ok: false, kind: "TAMPERED", reason: reason }; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return fail("PLAN_NOT_OBJECT");
  if (plan.planVersion !== save.PLAN_VERSION) return fail("PLAN_VERSION_MISMATCH");
  if (plan.contractVersion !== contract.CONTRACT_VERSION) return fail("CONTRACT_VERSION_MISMATCH");
  if (plan.operationType !== save.OPERATION_TYPE) return fail("OPERATION_TYPE_MISMATCH");
  if (plan.side !== save.SIDE) return fail("SIDE_MISMATCH");
  if (plan.receiptType !== save.RECEIPT_TYPE ||
      contract.RECEIPT_TYPES.indexOf(plan.receiptType) === -1) return fail("RECEIPT_TYPE_MISMATCH");
  if (typeof plan.requestKey !== "string" || !plan.requestKey) return fail("REQUEST_KEY_MISSING");
  if (typeof plan.operationID !== "string" || !plan.operationID) return fail("OPERATION_ID_MISSING");
  if (typeof plan.payloadHash !== "string" || !plan.payloadHash) return fail("PAYLOAD_HASH_MISSING");
  if (!plan.normalizedPayload || typeof plan.normalizedPayload !== "object") {
    return fail("NORMALIZED_PAYLOAD_MISSING");
  }
  if (!plan.config || typeof plan.config !== "object") return fail("CONFIG_IDENTITY_MISSING");
  if (plan.operationID !== treasuryOperationId(save.OPERATION_TYPE, plan.requestKey)) {
    return drift("OPERATION_ID_DERIVATION_MISMATCH");
  }
  if (plan.receiptID !== treasuryReceiptId(save.OPERATION_TYPE, plan.requestKey, save.SIDE)) {
    return drift("RECEIPT_ID_DERIVATION_MISMATCH");
  }
  if (plan.journalID !== treasuryJournalId(save.OPERATION_TYPE, plan.requestKey, save.SIDE)) {
    return drift("JOURNAL_ID_DERIVATION_MISMATCH");
  }
  if (plan.auditID !== treasuryAuditId(save.OPERATION_TYPE, plan.requestKey, save.SIDE)) {
    return drift("AUDIT_ID_DERIVATION_MISMATCH");
  }
  if (typeof plan.recognitionID !== "string" || !plan.recognitionID) return fail("RECOGNITION_ID_MISSING");
  if (typeof plan.orderID !== "string" || !plan.orderID) return fail("ORDER_ID_MISSING");
  if (typeof plan.revisionID !== "string" || !plan.revisionID) return fail("REVISION_ID_MISSING");
  if (!isFinite(Number(plan.recognizedAmount)) || Number(plan.recognizedAmount) <= 0) {
    return fail("RECOGNIZED_AMOUNT_INVALID");
  }
  if (!isFinite(Number(plan.outstandingBefore)) || Number(plan.outstandingBefore) <= 0) {
    return fail("OUTSTANDING_BEFORE_INVALID");
  }
  if (!isFinite(Number(plan.receiptAmount)) || Number(plan.receiptAmount) <= 0 ||
      Math.floor(Number(plan.receiptAmount)) !== Number(plan.receiptAmount)) {
    return fail("RECEIPT_AMOUNT_INVALID");
  }
  if (Number(plan.receiptAmount) !== Number(plan.outstandingBefore)) {
    return drift("EXACT_CLEARING_MISMATCH");
  }
  if (!plan.destination || typeof plan.destination !== "object" ||
      typeof plan.destination.code !== "string" || !plan.destination.code ||
      typeof plan.destination.name !== "string") return fail("DESTINATION_INVALID");
  if (contract.DESTINATION_ACCOUNT_CODES.indexOf(plan.destination.code) === -1 ||
      plan.destination.code === contract.CLEARING_ACCOUNT_CODE) {
    return drift("DESTINATION_ACCOUNT_MISMATCH");
  }
  if (treasuryValidateReceiptDate(plan.receiptDate).status !== "PASS") return fail("RECEIPT_DATE_INVALID");
  if (plan.economicDate !== plan.receiptDate) return fail("ECONOMIC_DATE_MISMATCH");
  if (!plan.evidence || plan.evidence.type !== contract.EVIDENCE_TYPE ||
      typeof plan.evidence.ref !== "string" ||
      plan.evidence.ref.length < save.MIN_EVIDENCE_REF ||
      plan.evidence.ref.length > save.MAX_EVIDENCE_REF) {
    return drift("EVIDENCE_MISMATCH");
  }
  if (typeof plan.actor !== "string" || !plan.actor || typeof plan.savedAt !== "string" || !plan.savedAt) {
    return fail("ACTOR_OR_TIMESTAMP_MISSING");
  }
  if (!Array.isArray(plan.journalRows) || plan.journalRows.length !== 2) {
    return fail("JOURNAL_ROWS_INVALID");
  }
  var j0 = plan.journalRows[0], j1 = plan.journalRows[1];
  if (ledgerHeaders.some(function(header) { return j0[header] === undefined || j1[header] === undefined; })) {
    return fail("JOURNAL_ROW_INCOMPLETE");
  }
  if (j0.LineID !== plan.journalID + "-1" || j1.LineID !== plan.journalID + "-2") {
    return drift("JOURNAL_LINE_ID_MISMATCH");
  }
  if (j0.JournalID !== plan.journalID || j1.JournalID !== plan.journalID) {
    return drift("JOURNAL_ID_MISMATCH");
  }
  if (j0.SourceID !== plan.receiptID || j1.SourceID !== plan.receiptID) {
    return drift("JOURNAL_SOURCE_MISMATCH");
  }
  if (j0.SourceType !== plan.sourceType || j1.SourceType !== plan.sourceType ||
      j0.MovementType !== plan.movementType || j1.MovementType !== plan.movementType) {
    return drift("JOURNAL_CLASSIFICATION_MISMATCH");
  }
  // Journal accounts are structurally {destination, 1030} — writing 4000 or any
  // forbidden account instead of 1030 is tampering, never a valid plan.
  if (j0.AccountCode !== plan.destination.code || j1.AccountCode !== contract.CLEARING_ACCOUNT_CODE) {
    return drift("JOURNAL_ACCOUNT_MAPPING_MISMATCH");
  }
  if (treasuryForbiddenJournalAccount(j0.AccountCode) ||
      treasuryForbiddenJournalAccount(j1.AccountCode)) {
    return drift("JOURNAL_FORBIDDEN_ACCOUNT");
  }
  if (Number(j0.Debit) !== Number(plan.receiptAmount) || Number(j0.Credit) !== 0 ||
      Number(j1.Debit) !== 0 || Number(j1.Credit) !== Number(plan.receiptAmount)) {
    return drift("JOURNAL_AMOUNT_MISMATCH");
  }
  if (j0.Tanggal !== plan.economicDate || j1.Tanggal !== plan.economicDate) {
    return drift("JOURNAL_DATE_MISMATCH");
  }
  if (!isCanonicalActive(j0.IsActive) || !isCanonicalActive(j1.IsActive)) {
    return drift("JOURNAL_INACTIVE");
  }
  if (typeof plan.journalSignature !== "string" || !plan.journalSignature ||
      treasuryJournalSignature(plan.journalRows) !== plan.journalSignature) {
    return drift("JOURNAL_SIGNATURE_MISMATCH");
  }
  if (!plan.receiptRow || typeof plan.receiptRow !== "object") return fail("RECEIPT_ROW_MISSING");
  if (contract.SCHEMAS.RECEIPTS.HEADERS.some(function(header) {
      return plan.receiptRow[header] === undefined;
    })) return fail("RECEIPT_ROW_INCOMPLETE");
  var receipt = plan.receiptRow;
  if (receipt.TreasuryReceiptID !== plan.receiptID || receipt.OperationID !== plan.operationID ||
      receipt.RequestKey !== plan.requestKey || receipt.RecognitionID !== plan.recognitionID ||
      receipt.OrderID !== plan.orderID || receipt.RevisionID !== plan.revisionID ||
      receipt.ReceiptType !== save.RECEIPT_TYPE ||
      receipt.DestinationAccountCode !== plan.destination.code ||
      Number(receipt.GrossAmount) !== Number(plan.receiptAmount) ||
      receipt.ReceiptDate !== plan.receiptDate || receipt.EconomicDate !== plan.economicDate ||
      receipt.ReceivedAt !== plan.savedAt || receipt.EvidenceType !== plan.evidence.type ||
      receipt.EvidenceRef !== plan.evidence.ref || receipt.JournalID !== plan.journalID ||
      receipt.JournalSignature !== plan.journalSignature ||
      receipt.PostingStatus !== contract.POSTING_STATUS_COMMITTED ||
      receipt.Actor !== plan.actor || receipt.ContractVersion !== contract.CONTRACT_VERSION) {
    return drift("RECEIPT_ROW_MISMATCH");
  }
  if (receipt.OriginalReceiptID !== "" || receipt.ReversalOfReceiptID !== "" ||
      receipt.ReplacementReceiptID !== "" || receipt.Reason !== "") {
    return drift("RECEIPT_LINEAGE_MISMATCH");
  }
  var snapshot = null;
  try { snapshot = JSON.parse(receipt.SnapshotJSON); }
  catch (error) { return fail("SNAPSHOT_JSON_INVALID"); }
  if (receipt.SnapshotJSON !== JSON.stringify(plan.snapshot) ||
      !plan.snapshot || snapshot.contractVersion !== contract.CONTRACT_VERSION ||
      snapshot.operationType !== save.OPERATION_TYPE || snapshot.side !== save.SIDE ||
      snapshot.recognitionID !== plan.recognitionID || snapshot.orderID !== plan.orderID ||
      snapshot.revisionID !== plan.revisionID ||
      Number(snapshot.recognizedAmount) !== Number(plan.recognizedAmount) ||
      Number(snapshot.outstandingBefore) !== Number(plan.outstandingBefore) ||
      Number(snapshot.receiptAmount) !== Number(plan.receiptAmount) ||
      !snapshot.destination || snapshot.destination.code !== plan.destination.code ||
      snapshot.destination.name !== plan.destination.name ||
      snapshot.receiptDate !== plan.receiptDate || snapshot.economicDate !== plan.economicDate ||
      !snapshot.evidence || snapshot.evidence.type !== plan.evidence.type ||
      snapshot.evidence.ref !== plan.evidence.ref || snapshot.journalID !== plan.journalID ||
      snapshot.targetReceiptID !== "" || snapshot.reason !== "") {
    return drift("SNAPSHOT_CONTENT_MISMATCH");
  }
  if (!plan.auditRow || typeof plan.auditRow !== "object") return fail("AUDIT_ROW_MISSING");
  if (contract.SCHEMAS.AUDITS.HEADERS.some(function(header) {
      return plan.auditRow[header] === undefined;
    })) return fail("AUDIT_ROW_INCOMPLETE");
  var audit = plan.auditRow;
  if (audit.AuditID !== plan.auditID || audit.ContractVersion !== contract.CONTRACT_VERSION ||
      audit.OperationID !== plan.operationID || audit.RequestKey !== plan.requestKey ||
      audit.TreasuryReceiptID !== plan.receiptID || audit.RecognitionID !== plan.recognitionID ||
      audit.OrderID !== plan.orderID || audit.JournalID !== plan.journalID ||
      audit.PayloadHash !== plan.payloadHash || audit.Actor !== plan.actor ||
      audit.SavedAt !== plan.savedAt) {
    return drift("AUDIT_ROW_MISMATCH");
  }
  // Frozen sibling context: legacy ordinary plan without context fields is an
  // empty context; a multi-artifact plan without context is malformed (T6-era
  // plan never resumes through the legacy interpretation).
  var contextShape = treasuryReceiptContextShape_(plan);
  if (!contextShape.ok) return fail(contextShape.reason);
  if (typeof plan.planDigest !== "string" || !plan.planDigest) return fail("PLAN_DIGEST_MISSING");
  var copy = Object.assign({}, plan);
  delete copy.planDigest;
  if (transactionPayloadHash_(copy) !== plan.planDigest) return fail("PLAN_DIGEST_MISMATCH");
  return { ok: true, kind: "", reason: "" };
}
// ---------------------------------------------------------------------------
// ONE atomic batch: exactly three appendCells subrequests (receipt row,
// 2 BalanceLedger lines, 1 audit row) in ONE spreadsheets.batchUpdate —
// all three or none. Safe RAW CellData only (never formulaValue).
// ---------------------------------------------------------------------------
function treasuryReceiptValueRanges_(plan) {
  var save = TREASURY_RECEIPT_V1_SAVE, contract = TREASURY_RECEIPT_V1_CONTRACT;
  function rowValues(row, headers) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  }
  var ranges = [
    { range: contract.SCHEMAS.RECEIPTS.SHEET,
      values: [rowValues(plan.receiptRow, contract.SCHEMAS.RECEIPTS.HEADERS)] },
    { range: "BalanceLedger",
      values: plan.journalRows.map(function(row) {
        return rowValues(row, BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
      }) },
    { range: contract.SCHEMAS.AUDITS.SHEET,
      values: [rowValues(plan.auditRow, contract.SCHEMAS.AUDITS.HEADERS)] }
  ];
  if (JSON.stringify(ranges.map(function(range) { return range.range; })) !==
      JSON.stringify(save.WRITE_SURFACES)) {
    throw new Error("SAVE_SURFACE_MISMATCH");
  }
  return ranges;
}

function treasuryReceiptCellValue_(value) {
  var save = TREASURY_RECEIPT_V1_SAVE;
  if (typeof value === "number") {
    if (!isFinite(value)) throw new Error("UNSAFE_CELL_NUMBER");
    return { numberValue: value };
  }
  if (typeof value === "boolean") return { boolValue: value };
  var text = String(value === undefined || value === null ? "" : value);
  if (text.length > save.MAX_CELL_CHARS) throw new Error("UNSAFE_CELL_CHARS:" + text.length);
  return { stringValue: text };
}

function treasuryReceiptBatchBody_(valueRanges, sheetIds) {
  var requests = valueRanges.map(function(range) {
    var sheetId = sheetIds[range.range];
    if (typeof sheetId !== "number" || !isFinite(sheetId)) {
      throw new Error("SHEET_ID_UNAVAILABLE:" + range.range);
    }
    return { appendCells: { sheetId: sheetId, fields: "userEnteredValue",
      rows: range.values.map(function(row) {
        return { values: row.map(function(cell) {
          return { userEnteredValue: treasuryReceiptCellValue_(cell) };
        }) };
      }) } };
  });
  return { requests: requests };
}

// UTF-8 byte count without Node APIs (Apps Script V8 safe).
function treasuryReceiptUtf8Bytes_(text) {
  var bytes = 0;
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length &&
        text.charCodeAt(i + 1) >= 0xDC00 && text.charCodeAt(i + 1) <= 0xDFFF) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

// Cell / request safety bounds, evaluated BEFORE the intent write (unsafe plan
// never persisted) and re-evaluated on resume against the STORED plan.
function treasuryReceiptBounds_(plan) {
  var save = TREASURY_RECEIPT_V1_SAVE, ranges;
  try { ranges = treasuryReceiptValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "SAVE_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var sentinel = {};
  save.WRITE_SURFACES.forEach(function(name) { sentinel[name] = 2147483647; });
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
// 15, 16). JournalSignature is intentionally excluded from the receipt content
// compare: the signature column's authority is the dedicated recomputation
// step (treasuryReceiptVerifySignature_) so a tampered signature cell is
// caught there, independently of row content equality.
// ---------------------------------------------------------------------------
function treasuryReceiptInspect_(plan, ss) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT,
    receiptHeaders = contract.SCHEMAS.RECEIPTS.HEADERS,
    auditHeaders = contract.SCHEMAS.AUDITS.HEADERS,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var receipts, ledger, audits;
  try {
    receipts = readCanonicalTable(ss, contract.SCHEMAS.RECEIPTS.SHEET, receiptHeaders);
    ledger = readCanonicalTable(ss, "BalanceLedger", ledgerHeaders);
    audits = readCanonicalTable(ss, contract.SCHEMAS.AUDITS.SHEET, auditHeaders);
  } catch (error) {
    return { state: "UNKNOWN", detail: "READBACK_FAILED:" + error.message };
  }
  var conflicts = [], missing = [];
  // Frozen context membership (T2 section 12/16): pre-existing siblings frozen
  // into the plan are allowed but must be present exactly once and byte-exact
  // (owner, recognition, and content covered by the frozen digest); anything
  // else under the same recognition stays a hard conflict.
  var context = treasuryReceiptContextOf_(plan);
  var contextReceiptSeen = {}, contextAuditSeen = {};
  var plannedLineIds = {};
  plan.journalRows.forEach(function(row) { plannedLineIds[row.LineID] = true; });
  ledger.forEach(function(row) {
    if (plannedLineIds[row.LineID] &&
        !(row.JournalID === plan.journalID && row.SourceType === plan.sourceType &&
          row.SourceID === plan.receiptID)) {
      conflicts.push("JOURNAL_LINE_CROSS_OWNER");
    }
    if (String(row.SourceID) === plan.receiptID && String(row.SourceType) !== plan.sourceType) {
      conflicts.push("JOURNAL_SOURCE_CROSS_OWNER");
    }
  });
  receipts.forEach(function(row) {
    var rowReceiptID = String(row.TreasuryReceiptID);
    if (row.TreasuryReceiptID === plan.receiptID && row.OperationID !== plan.operationID) {
      conflicts.push("RECEIPT_CROSS_OWNER");
    }
    if (row.OperationID === plan.operationID && row.TreasuryReceiptID !== plan.receiptID) {
      conflicts.push("RECEIPT_OPERATION_CROSS_OWNER");
    }
    if (context.auditIds[rowReceiptID]) {
      conflicts.push("RECEIPT_CONTEXT_CLASS_MISMATCH"); // artifact class violation
    }
    if (rowReceiptID !== plan.receiptID && context.receiptIds[rowReceiptID]) {
      contextReceiptSeen[rowReceiptID] = (contextReceiptSeen[rowReceiptID] || 0) + 1;
      if (treasuryReceiptContextHash_(row, receiptHeaders) !==
          context.receiptHashes[rowReceiptID]) {
        conflicts.push("RECOGNITION_CONTEXT_TAMPERED");
      }
    }
    if (String(row.RecognitionID) === plan.recognitionID &&
        row.TreasuryReceiptID !== plan.receiptID && !context.receiptIds[rowReceiptID]) {
      conflicts.push("RECOGNITION_DUPLICATE_RECEIPT"); // post-freeze unplanned sibling
    }
  });
  Object.keys(context.receiptIds).forEach(function(id) {
    if (id !== plan.receiptID && contextReceiptSeen[id] !== 1) {
      conflicts.push("RECOGNITION_CONTEXT_INCOMPLETE"); // frozen sibling vanished/duplicated
    }
  });
  audits.forEach(function(row) {
    var rowAuditID = String(row.AuditID);
    if (row.AuditID === plan.auditID && row.OperationID !== plan.operationID) {
      conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    }
    if (row.OperationID === plan.operationID && row.AuditID !== plan.auditID) {
      conflicts.push("AUDIT_OPERATION_CROSS_OWNER");
    }
    if (context.receiptIds[rowAuditID]) {
      conflicts.push("AUDIT_CONTEXT_CLASS_MISMATCH"); // artifact class violation
    }
    if (rowAuditID !== plan.auditID && context.auditIds[rowAuditID]) {
      contextAuditSeen[rowAuditID] = (contextAuditSeen[rowAuditID] || 0) + 1;
      if (treasuryReceiptContextHash_(row, auditHeaders) !== context.auditHashes[rowAuditID]) {
        conflicts.push("AUDIT_CONTEXT_TAMPERED");
      }
    }
    if (String(row.RecognitionID) === plan.recognitionID &&
        row.AuditID !== plan.auditID && !context.auditIds[rowAuditID]) {
      conflicts.push("AUDIT_RECOGNITION_CROSS_OWNER"); // post-freeze unplanned sibling
    }
  });
  Object.keys(context.auditIds).forEach(function(id) {
    if (id !== plan.auditID && contextAuditSeen[id] !== 1) {
      conflicts.push("AUDIT_CONTEXT_INCOMPLETE"); // frozen sibling vanished/duplicated
    }
  });
  var receiptMatches = receipts.filter(function(row) {
    return row.TreasuryReceiptID === plan.receiptID;
  });
  var journalBySource = ledger.filter(function(row) {
    return String(row.SourceType) === plan.sourceType && String(row.SourceID) === plan.receiptID;
  });
  var journalById = ledger.filter(function(row) { return row.JournalID === plan.journalID; });
  var auditById = audits.filter(function(row) { return row.AuditID === plan.auditID; });
  var auditByOperation = audits.filter(function(row) {
    return row.OperationID === plan.operationID;
  });
  var present = receiptMatches.length || journalBySource.length || journalById.length ||
    auditById.length || auditByOperation.length;
  if (!present) {
    if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
    return { state: "NONE", detail: "NO_ARTIFACTS" };
  }
  if (receiptMatches.length > 1) conflicts.push("RECEIPT_DUPLICATE");
  else if (receiptMatches.length === 1) {
    if (!treasuryReceiptRowExact_(receiptMatches[0], plan.receiptRow, receiptHeaders,
        ["JournalSignature"])) {
      conflicts.push("RECEIPT_TAMPERED");
    }
  } else missing.push("RECEIPT");
  if (journalBySource.length || journalById.length) {
    var sourceSet = journalBySource.map(function(row) { return String(row.LineID); }).sort().join("");
    var idSet = journalById.map(function(row) { return String(row.LineID); }).sort().join("");
    if (sourceSet !== idSet) conflicts.push("JOURNAL_IDENTITY_CROSSOVER");
    if (journalBySource.length === 1) missing.push("JOURNAL_LINE");
    else if (journalBySource.length === 2) {
      var byLine = {};
      journalBySource.forEach(function(row) { byLine[String(row.LineID)] = row; });
      plan.journalRows.forEach(function(expected) {
        var actual = byLine[expected.LineID];
        if (!actual || !treasuryReceiptRowExact_(actual, expected, ledgerHeaders)) {
          conflicts.push("JOURNAL_TAMPERED");
        }
      });
      var debit = 0, credit = 0;
      journalBySource.forEach(function(row) {
        debit += Number(row.Debit); credit += Number(row.Credit);
      });
      if (!(debit === credit && debit === Number(plan.receiptAmount))) {
        conflicts.push("JOURNAL_BALANCE_MISMATCH");
      }
    } else conflicts.push("JOURNAL_DUPLICATE");
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

// Journal signature recomputed from the PERSISTED ledger rows via the T3
// treasuryJournalSignature helper and compared to both the plan digest and
// the persisted receipt.JournalSignature cell. Mismatch => impossible DONE.
function treasuryReceiptVerifySignature_(plan, ss) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  var ledger, receipts;
  try {
    ledger = readCanonicalTable(ss, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
    receipts = readCanonicalTable(ss, contract.SCHEMAS.RECEIPTS.SHEET,
      contract.SCHEMAS.RECEIPTS.HEADERS);
  } catch (error) {
    return { status: "UNKNOWN", ok: false, code: codes.READBACK_INCOMPLETE,
      detail: "SIGNATURE_READ_FAILED:" + error.message };
  }
  var rows = ledger.filter(function(row) {
    return String(row.SourceType) === plan.sourceType && String(row.SourceID) === plan.receiptID;
  });
  var receipt = receipts.filter(function(row) {
    return row.TreasuryReceiptID === plan.receiptID;
  });
  if (rows.length !== 2 || receipt.length !== 1) {
    return { status: "FAIL", ok: false, code: codes.JOURNAL_SIGNATURE_INVALID,
      detail: "SIGNATURE_INPUT_INCOMPLETE" };
  }
  var recomputed = treasuryJournalSignature(rows);
  if (recomputed !== plan.journalSignature) {
    return { status: "FAIL", ok: false, code: codes.JOURNAL_SIGNATURE_INVALID,
      detail: "PLAN_SIGNATURE_MISMATCH" };
  }
  if (String(receipt[0].JournalSignature) !== recomputed) {
    return { status: "FAIL", ok: false, code: codes.JOURNAL_SIGNATURE_INVALID,
      detail: "RECEIPT_SIGNATURE_MISMATCH" };
  }
  return { status: "PASS", ok: true, code: "", detail: "" };
}
// COMMITTED transition: full ten-field readback of the committed operation
// against the in-memory expected row. Lost or mismatched readback after a
// successful update returns UNKNOWN (never DONE); the next retry verifies again.
function treasuryReceiptCommit_(operation, runtime) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    schema = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.OPERATIONS;
  var expected = Object.assign({}, operation, {
    State: "COMMITTED", UpdatedAt: runtime.now(), LastError: ""
  });
  try { treasuryOperationUpdate_(runtime.spreadsheet, expected, runtime); }
  catch (error) {
    return { ok: false, status: save.STATUS.UNKNOWN, code: codes.SAVE_EXECUTION_UNKNOWN,
      detail: "COMMIT_WRITE_FAILED:" + error.message };
  }
  var committed = null;
  try {
    committed = treasuryOperationFind_(runtime.spreadsheet, operation.OperationType,
      operation.RequestKey);
  } catch (error) {
    return { ok: false, status: save.STATUS.UNKNOWN, code: codes.READBACK_INCOMPLETE,
      detail: "COMMIT_READBACK_FAILED:" + error.message };
  }
  if (!committed) {
    return { ok: false, status: save.STATUS.UNKNOWN, code: codes.READBACK_INCOMPLETE,
      detail: "COMMIT_ROW_MISSING" };
  }
  if (committed.State !== "COMMITTED" ||
      !treasuryReceiptFieldsExact_(committed, expected, schema.HEADERS)) {
    return { ok: false, status: save.STATUS.UNKNOWN, code: codes.READBACK_INCOMPLETE,
      detail: "COMMIT_READBACK_MISMATCH" };
  }
  operation.State = "COMMITTED";
  operation.UpdatedAt = expected.UpdatedAt;
  operation.LastError = "";
  return { ok: true, status: save.STATUS.DONE, code: "", detail: "" };
}

// Batch -> exact inspect -> signature recomputation -> COMMITTED + exact
// readback. Never retries a failed batch inside one call: an unknown batch
// outcome is inspected once and, if unresolved, reported as UNKNOWN with the
// request identity preserved (zero autonomous retry).
function treasuryReceiptApplyBatch_(plan, operation, runtime) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES;
  function outcome(status, fields) {
    return treasuryReceiptSaveResult_(status, Object.assign({
      requestKey: plan.requestKey, operationID: plan.operationID,
      recognitionID: plan.recognitionID, receiptID: plan.receiptID,
      journalID: plan.journalID, auditID: plan.auditID
    }, fields || {}));
  }
  var ranges = null;
  try { ranges = treasuryReceiptValueRanges_(plan); }
  catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.OPERATION_PLAN_MALFORMED, detail: error.message, writeCount: "UNKNOWN" });
  }
  if (runtime.crash) runtime.crash("T4_BEFORE_BATCH");
  var batchError = null;
  try { runtime.batch(ranges); } catch (error) { batchError = error; }
  if (!batchError && runtime.crash) runtime.crash("T4_AFTER_BATCH");
  var inspection = treasuryReceiptInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(save.STATUS.UNKNOWN,
      { code: codes.READBACK_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "NONE") {
    if (batchError) {
      return outcome(save.STATUS.UNKNOWN,
        { code: codes.BATCH_OUTCOME_UNKNOWN, writeCount: "UNKNOWN", detail: inspection.detail });
    }
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "PARTIAL") {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "CONFLICT") {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.RECOVERY_REQUIRED, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  // EXACT: signature recomputed from persisted rows — mismatch => no DONE.
  var signature = treasuryReceiptVerifySignature_(plan, runtime.spreadsheet);
  if (signature.status === "UNKNOWN") {
    return outcome(save.STATUS.UNKNOWN,
      { code: signature.code, writeCount: "UNKNOWN", detail: signature.detail });
  }
  if (!signature.ok) {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: signature.code, writeCount: "UNKNOWN", detail: signature.detail });
  }
  if (runtime.crash) runtime.crash("T4_AFTER_READBACK");
  if (runtime.crash) runtime.crash("T4_BEFORE_COMMIT");
  var commit = treasuryReceiptCommit_(operation, runtime);
  if (!commit.ok) {
    return outcome(commit.status,
      { code: commit.code, writeCount: save.FRESH_WRITE_COUNT, detail: commit.detail });
  }
  if (runtime.crash) runtime.crash("T4_AFTER_COMMIT");
  return outcome(save.STATUS.DONE, { writeCount: save.FRESH_WRITE_COUNT });
}

// Resume path: exact (OperationType, RequestKey) lookup hit. Compares the
// payload hash AND the exact persisted normalized structure; verifies the
// stored plan digest + shape; validates State (only IN_PROGRESS or COMMITTED
// proceed); re-checks schema + stored bounds (no mutable master recomputation)
// before touching artifacts. PAUSED/PREPARED never block this path: T2 keeps
// operation recovery available in every mode (section 5).
function treasuryReceiptResume_(operation, hash, normalized, runtime) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  function outcome(status, fields) {
    return treasuryReceiptSaveResult_(status, Object.assign({
      requestKey: normalized.requestKey,
      operationID: operation.TreasuryOperationID || "",
      recognitionID: operation.RecognitionID || ""
    }, fields || {}));
  }
  if (operation.OperationType !== save.OPERATION_TYPE ||
      operation.RequestKey !== normalized.requestKey ||
      operation.PayloadHash !== hash ||
      String(operation.RecognitionID) !== normalized.recognitionID) {
    return outcome(save.STATUS.CONFLICT,
      { code: codes.REQUEST_KEY_CONFLICT, detail: "PAYLOAD_MISMATCH" });
  }
  var plan = null;
  try { plan = JSON.parse(operation.OperationPlan); }
  catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.OPERATION_PLAN_MALFORMED, detail: "PLAN_JSON:" + error.message });
  }
  if (!plan || plan.requestKey !== normalized.requestKey || plan.payloadHash !== hash ||
      plan.operationID !== operation.TreasuryOperationID) {
    return outcome(save.STATUS.CONFLICT,
      { code: codes.REQUEST_KEY_CONFLICT, detail: "PLAN_IDENTITY_MISMATCH" });
  }
  if (!plan.normalizedPayload ||
      JSON.stringify(plan.normalizedPayload) !== JSON.stringify(normalized)) {
    return outcome(save.STATUS.CONFLICT,
      { code: codes.REQUEST_KEY_CONFLICT, detail: "NORMALIZED_PAYLOAD_MISMATCH" });
  }
  var verify = treasuryReceiptVerifyPlan_(plan);
  if (!verify.ok) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.OPERATION_PLAN_MALFORMED, detail: verify.reason,
      receiptID: plan.receiptID || "", journalID: plan.journalID || "", auditID: plan.auditID || ""
    });
  }
  if (operation.State !== "IN_PROGRESS" && operation.State !== "COMMITTED") {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.OPERATION_STATE_CORRUPTED, detail: "STATE:" + String(operation.State),
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  var schemaGate = treasuryReceiptSchemaGate_(runtime.spreadsheet);
  if (schemaGate.status !== "PASS") {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.SCHEMA_NOT_READY, detail: schemaGate.badSheets.join(","),
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  var bounds = treasuryReceiptBounds_(plan);
  if (!bounds.ok) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.PAYLOAD_TOO_LARGE, detail: bounds.detail,
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  var inspection = treasuryReceiptInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(save.STATUS.UNKNOWN, {
      code: codes.READBACK_INCOMPLETE, detail: inspection.detail,
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  if (inspection.state === "EXACT") {
    var signature = treasuryReceiptVerifySignature_(plan, runtime.spreadsheet);
    if (signature.status === "UNKNOWN") {
      return outcome(save.STATUS.UNKNOWN, {
        code: signature.code, detail: signature.detail,
        receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
      });
    }
    if (!signature.ok) {
      return outcome(save.STATUS.RECOVERY_REQUIRED, {
        code: signature.code, detail: signature.detail,
        receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
      });
    }
    if (operation.State === "COMMITTED") {
      // COMMITTED + exactly verified artifacts => replay DONE (response lost).
      if (runtime.crash) runtime.crash("T4_AFTER_COMMIT");
      return outcome(save.STATUS.DONE, {
        replay: true, writeCount: 0,
        receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
      });
    }
    // Artifacts present, not COMMITTED: verify exact, then finish transition.
    if (runtime.crash) runtime.crash("T4_AFTER_READBACK");
    if (runtime.crash) runtime.crash("T4_BEFORE_COMMIT");
    var commit = treasuryReceiptCommit_(operation, runtime);
    if (!commit.ok) {
      return outcome(commit.status, {
        code: commit.code, writeCount: save.FRESH_WRITE_COUNT, detail: commit.detail,
        receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
      });
    }
    if (runtime.crash) runtime.crash("T4_AFTER_COMMIT");
    return outcome(save.STATUS.DONE, {
      replay: true, writeCount: 0,
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  if (operation.State === "COMMITTED") {
    // COMMITTED without exact artifacts: fail closed, no repair, no rewrite.
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: inspection.state === "CONFLICT" ? codes.RECOVERY_REQUIRED : codes.ARTIFACTS_INCOMPLETE,
      detail: inspection.detail,
      receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
    });
  }
  if (inspection.state === "NONE") {
    // Intent-only: recover from the frozen plan exactly once.
    return treasuryReceiptApplyBatch_(plan, operation, runtime);
  }
  // Partial/inconsistent uncommitted artifacts: fail closed, never append blindly.
  return outcome(save.STATUS.RECOVERY_REQUIRED, {
    code: inspection.state === "CONFLICT" ? codes.RECOVERY_REQUIRED : codes.ARTIFACTS_INCOMPLETE,
    detail: inspection.detail,
    receiptID: plan.receiptID, journalID: plan.journalID, auditID: plan.auditID
  });
}
// New-intent path (lock held, lookup returned absent). Mode gate first, then
// all business gates re-validated inside the lock immediately before plan
// freeze (T2 section 14); every gate refusal writes zero.
function treasuryReceiptNewIntent_(normalized, hash, runtime) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES;
  function outcome(status, fields) {
    return treasuryReceiptSaveResult_(status,
      Object.assign({ requestKey: normalized.requestKey }, fields || {}));
  }
  // Mode allows: ACTIVE only for new writes. PREPARED => NOT_ACTIVATED,
  // PAUSED => MODE_PAUSED. No legacy fallback exists on any refusal path.
  var gate = treasuryReceiptModeGate(runtime.config);
  if (!gate.allowed) return outcome(save.STATUS.REFUSED, { code: gate.code });
  // Destination eligibility re-validated at freeze time (no name trust).
  var accountRows;
  try { accountRows = treasuryReceiptAccountRows_(runtime.spreadsheet); }
  catch (error) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.SCHEMA_NOT_READY, detail: "ACCOUNTS:" + error.message });
  }
  var destinationCheck = treasuryDestinationEligible(normalized.destinationAccountCode, accountRows);
  if (!destinationCheck.eligible) {
    return outcome(save.STATUS.REFUSED, {
      code: destinationCheck.code, field: "destinationAccountCode",
      detail: destinationCheck.reason
    });
  }
  var destinationRow = accountRows.filter(function(row) {
    return String(row.AccountCode) === normalized.destinationAccountCode;
  })[0];
  var destination = {
    code: normalized.destinationAccountCode,
    name: String(destinationRow && destinationRow.AccountName !== undefined &&
      destinationRow.AccountName !== null ? destinationRow.AccountName : "")
  };
  // Resolve V2 exposure (V2_ONLY, integrity-verified, not voided).
  var exposure = null;
  try { exposure = treasuryResolveExposure_(normalized.recognitionID, runtime.spreadsheet); }
  catch (error) {
    return outcome(save.STATUS.REFUSED, {
      code: error.treasuryCode || codes.RECOGNITION_INTEGRITY_FAILURE,
      field: error.field || "recognitionID", detail: error.message
    });
  }
  // Outstanding re-read inside the lock; fail closed on uninterpretable state.
  var outstandingView = null;
  try {
    outstandingView = treasuryComputeOutstanding_(normalized.recognitionID,
      exposure.recognizedAmount, runtime.spreadsheet, "");
  } catch (error) {
    return outcome(save.STATUS.REFUSED, {
      code: error.treasuryCode || codes.EXPOSURE_EXCEPTION,
      field: error.field || "recognitionID", detail: error.message
    });
  }
  // Exact full clearing. Precedence (T2 section 7.2): AMOUNT_NOT_POSITIVE ->
  // ALREADY_CLEARED (outstanding <= 0) -> AMOUNT_MISMATCH. No tolerance,
  // no partial, no auto-substitution.
  var amount = normalized.grossAmount;
  if (typeof amount !== "number" || !isFinite(amount) || Math.floor(amount) !== amount ||
      amount <= 0) {
    return outcome(save.STATUS.REFUSED, { code: codes.AMOUNT_NOT_POSITIVE, field: "grossAmount" });
  }
  if (outstandingView.outstanding <= 0) {
    return outcome(save.STATUS.REFUSED, {
      code: codes.ALREADY_CLEARED, field: "grossAmount",
      detail: "OUTSTANDING:" + outstandingView.outstanding
    });
  }
  if (amount !== outstandingView.outstanding) {
    return outcome(save.STATUS.REFUSED, {
      code: codes.AMOUNT_MISMATCH, field: "grossAmount",
      detail: "EXPECTED:" + outstandingView.outstanding + ",ACTUAL:" + amount
    });
  }
  // Freeze the immutable OperationPlan once (identities, rows, snapshot,
  // signature, payload hash, contract/config identity). The same-recognition
  // sibling context is observed under the lock IMMEDIATELY before the freeze.
  var plan;
  var now = runtime.now();
  var resolvedActor = normalized.actor || runtime.actor();
  var context;
  try {
    context = treasuryReceiptFrozenContext_(runtime.spreadsheet, normalized.recognitionID,
      treasuryReceiptId(save.OPERATION_TYPE, normalized.requestKey, save.SIDE),
      treasuryAuditId(save.OPERATION_TYPE, normalized.requestKey, save.SIDE));
  } catch (error) {
    return outcome(save.STATUS.REFUSED, {
      code: error.treasuryCode || codes.EXPOSURE_EXCEPTION,
      field: error.field || "recognitionID", detail: error.message
    });
  }
  try {
    plan = treasuryReceiptPlan_({
      normalized: normalized, hash: hash, config: runtime.config, exposure: exposure,
      outstanding: outstandingView.outstanding, destination: destination,
      actor: resolvedActor, now: now, context: context
    });
  } catch (error) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.PAYLOAD_INVALID, detail: "PLAN_BUILD:" + error.message });
  }
  var verify = treasuryReceiptVerifyPlan_(plan);
  if (!verify.ok) {
    return outcome(save.STATUS.REFUSED, { code: codes.OPERATION_PLAN_MALFORMED,
      detail: verify.reason });
  }
  var bounds = treasuryReceiptBounds_(plan);
  if (!bounds.ok) {
    return outcome(save.STATUS.REFUSED, { code: codes.PAYLOAD_TOO_LARGE, detail: bounds.detail });
  }
  if (runtime.crash) runtime.crash("T4_BEFORE_INTENT");
  // Persist durable IN_PROGRESS intent (10-field TreasuryOperations row).
  var operation = {
    TreasuryOperationID: plan.operationID,
    OperationType: save.OPERATION_TYPE,
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
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.DUPLICATE_RECEIPT_ID, operationID: plan.operationID,
        detail: "INTENT_APPEND_FAILED:" + error.message });
  }
  if (runtime.crash) runtime.crash("T4_AFTER_INTENT_PERSIST");
  // Exact ten-field intent readback BEFORE any business write.
  var readback = null;
  var schema = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.OPERATIONS;
  try {
    readback = treasuryOperationFind_(runtime.spreadsheet, save.OPERATION_TYPE,
      normalized.requestKey);
  } catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, operationID: plan.operationID,
        detail: "INTENT_READBACK_FAILED:" + error.message });
  }
  if (!readback) {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, operationID: plan.operationID,
        detail: "INTENT_ROW_MISSING" });
  }
  if (readback.State !== "IN_PROGRESS" ||
      !treasuryReceiptFieldsExact_(readback, operation, schema.HEADERS)) {
    var mismatch = schema.HEADERS.filter(function(header) {
      return !treasuryReceiptFieldEqual_(readback[header], operation[header]);
    });
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, operationID: plan.operationID,
        detail: "INTENT_ROW_MISMATCH:" + mismatch.join(",") });
  }
  if (runtime.crash) runtime.crash("T4_AFTER_INTENT");
  return treasuryReceiptApplyBatch_(plan, operation, runtime);
}

// Durable save core. Fixed order: normalize -> structural config -> schema ->
// account/destination/1030 preflight -> EXACT (OperationType, RequestKey)
// lookup BEFORE any exposure planning -> resume or new intent. Never acquires
// a lock (the outer wrapper owns the single ScriptLock).
function treasuryReceiptSaveWithRuntime_(payload, runtime) {
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES;
  var normalized;
  try { normalized = treasuryNormalizeReceiptRequest_(payload); }
  catch (error) {
    return treasuryReceiptSaveResult_(save.STATUS.REFUSED, {
      code: error.treasuryCode || codes.PAYLOAD_INVALID,
      requestKey: treasuryReceiptSavePayloadKey_(payload),
      field: error.field || "", detail: error.message
    });
  }
  var base = { requestKey: normalized.requestKey };
  // Structural config validity (present-but-invalid never falls back).
  var configValidation = validateTreasuryReceiptConfig(runtime.config);
  if (configValidation.status !== "PASS") {
    return treasuryReceiptSaveResult_(save.STATUS.REFUSED, Object.assign({
      code: configValidation.errors.length ? configValidation.errors[0].code : codes.CONFIG_INVALID,
      detail: "CONFIG_INVALID"
    }, base));
  }
  // Zero-write schema gate: three Treasury sheets + every authority read.
  var schema = treasuryReceiptSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return treasuryReceiptSaveResult_(save.STATUS.REFUSED, Object.assign({
      code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(",")
    }, base));
  }
  // Accounts authority + destination eligibility (T2 section 6) + 1030
  // clearing preflight incl. the CashFlowGroup == Operating hard gate (the
  // Finance Cash Flow statement classifies a cash movement by its counterpart
  // account's CashFlowGroup; blank/wrong/malformed would drop or misclassify
  // the receipt -> fail closed before any durable lookup or write).
  var accountRows;
  try { accountRows = treasuryReceiptAccountRows_(runtime.spreadsheet); }
  catch (error) {
    return treasuryReceiptSaveResult_(save.STATUS.REFUSED, Object.assign({
      code: codes.SCHEMA_NOT_READY, detail: "ACCOUNTS:" + error.message
    }, base));
  }
  var destinationCheck = treasuryDestinationEligible(normalized.destinationAccountCode, accountRows);
  if (!destinationCheck.eligible) {
    return treasuryReceiptSaveResult_(save.STATUS.REFUSED, Object.assign({
      code: destinationCheck.code, field: "destinationAccountCode",
      detail: destinationCheck.reason
    }, base));
  }
  var clearing = treasuryClearingPreflight(accountRows);
  if (clearing.status !== "PASS") {
    var clearingError = clearing.errors[0] || {};
    return treasuryReceiptSaveResult_(save.STATUS.REFUSED, Object.assign({
      code: codes.SCHEMA_NOT_READY, field: "1030",
      detail: "CLEARING_1030:" + String(clearingError.reason || "UNKNOWN")
    }, base));
  }
  // FIRST durable lookup, before any exposure planning (T2 section 16).
  var existing = null;
  try {
    existing = treasuryOperationFind_(runtime.spreadsheet, save.OPERATION_TYPE,
      normalized.requestKey);
  } catch (error) {
    return treasuryReceiptSaveResult_(save.STATUS.RECOVERY_REQUIRED, Object.assign({
      code: error && error.message === "DUPLICATE_OPERATION" ?
        codes.DUPLICATE_RECEIPT_ID : codes.EXPOSURE_EXCEPTION,
      detail: error && error.message ? error.message : ""
    }, base));
  }
  var hash = transactionPayloadHash_(normalized);
  var result = existing ?
    treasuryReceiptResume_(existing, hash, normalized, runtime) :
    treasuryReceiptNewIntent_(normalized, hash, runtime);
  // Post-commit freshness (U10F lesson): ONLY a DONE result (fresh commit or
  // COMMITTED replay) may bump the shared dashboard cache revision. Ephemeral
  // best-effort maintenance: never retried, never allowed to contradict DONE.
  if (result.status === save.STATUS.DONE && typeof runtime.invalidateCache === "function") {
    try { runtime.invalidateCache(); }
    catch (cacheError) {
      Logger.log("Treasury T4 post-commit cache invalidation skipped: " +
        String(cacheError && cacheError.message || cacheError));
    }
  }
  return result;
}

// Production runtime factory. Never invoked by local tests. Config comes from
// the read-only T3 resolver: missing/invalid config is null => the mode gate
// refuses with the specific frozen code (never ACTIVE, no fallback).
function treasuryReceiptSaveRuntime_() {
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

// Resolve the three write-surface sheetIds from spreadsheet metadata
// (read-only) through the sanitized transport. Any missing sheetId throws
// BEFORE the batchUpdate is issued: atomic rejection, no partial batch.
function treasuryReceiptSheetIdsRequest_() {
  var save = TREASURY_RECEIPT_V1_SAVE;
  var response = inventoryReceiptMigrationRequest_("get",
    "?fields=" + encodeURIComponent("spreadsheetId,sheets.properties(sheetId,title)"));
  if (!response || response.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) {
    throw new Error("PRODUCTION_IDENTITY_MISMATCH");
  }
  var ids = {};
  (response.sheets || []).forEach(function(sheet) {
    var properties = sheet && sheet.properties;
    if (properties && save.WRITE_SURFACES.indexOf(properties.title) !== -1 &&
        typeof properties.sheetId === "number") {
      ids[properties.title] = properties.sheetId;
    }
  });
  var missing = save.WRITE_SURFACES.filter(function(name) { return typeof ids[name] !== "number"; });
  if (missing.length) throw new Error("SHEET_ID_UNAVAILABLE:" + missing.join(","));
  return ids;
}

// ONE Sheets REST mutation: spreadsheets.batchUpdate with exactly three
// appendCells subrequests (safe RAW CellData) over the Treasury write
// surfaces, reusing the sanitized migration transport (43) signature.
// The single batchUpdate is atomic (all three subrequests or none).
function treasuryReceiptBatchRequest_(valueRanges) {
  var sheetIds = treasuryReceiptSheetIdsRequest_();
  var body = treasuryReceiptBatchBody_(valueRanges, sheetIds);
  return inventoryReceiptMigrationRequest_("post", ":batchUpdate", body);
}

// Public entry: the ONLY outer lock, acquired BEFORE normalize/lookup and
// released exactly once in finally. Lock or runtime failure happens before
// any durable intent => definite REFUSED with TREASURY_LOCK_TIMEOUT (zero
// writes); only post-intent execution uncertainty is UNKNOWN. The core never
// locks, so no nested locks are possible.
function treasuryReceiptDurableSave(payload) {
  var save = TREASURY_RECEIPT_V1_SAVE, runtime = null, acquired = false, result;
  var requestKey = treasuryReceiptSavePayloadKey_(payload);
  try {
    runtime = treasuryReceiptSaveRuntime_();
  } catch (error) {
    return treasuryReceiptSaveResult_(save.STATUS.REFUSED, {
      code: save.CODES.SCHEMA_NOT_READY, requestKey: requestKey,
      detail: "RUNTIME_UNAVAILABLE:" + String(error && error.message || error)
    });
  }
  try {
    runtime.lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return treasuryReceiptSaveResult_(save.STATUS.REFUSED, {
      code: save.CODES.LOCK_TIMEOUT, requestKey: requestKey,
      detail: String(error && error.message || error)
    });
  }
  try {
    result = treasuryReceiptSaveWithRuntime_(payload, runtime);
  } catch (error) {
    // Unknown only after the durable intent may exist; identity preserved.
    result = treasuryReceiptSaveResult_(save.STATUS.UNKNOWN, {
      code: save.CODES.SAVE_EXECUTION_UNKNOWN, requestKey: requestKey,
      detail: String(error && error.message || error)
    });
  } finally {
    if (acquired) {
      try { runtime.lock.releaseLock(); } catch (lockError) { /* lock auto-expires */ }
    }
  }
  return result;
}
