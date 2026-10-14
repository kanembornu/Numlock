// ---------------------------------------------------------------------------
// T11.13/U10 — TRANSITIONAL_CLEARING_CLOSE historical authority
// (T11.2 §18/§21 step 8, FROZEN contract; D13 owner attestation).
//
// RETIRED WRITER (T11-13 retirement gate): the one authorized production
// invocation of this transition consumed the operation — the ZERO-argument
// public production entry, its lock wrapper, the production runtime factory,
// the production sheet-identity lookup and the REST batch transport have been
// REMOVED from this file. No callable path in this runtime can create another
// TRANSITIONAL_CLEARING_CLOSE financial write, independent of balances, T5
// state, RequestKey replay or operator behavior. The injected-runtime core
// below is retained solely as the in-memory construction/verification
// authority for tests and historical interpretation: it requires a caller-
// supplied spreadsheet fixture and batch function, which no remaining
// production composition or external invocation surface can supply.
//
// Historical transition (frozen, executed exactly once in production):
// close the transitional exposure SCR-CE122B27-ORD677BE5CES (Rp24,000,
// Dr1030 from the U2 transitional recognition, no genuine receipt) with the
// ONE authorized journal Dr1040 Operational Funds 24,000 / Cr1030 Sales
// Settlement Clearing 24,000, source classification
// TRANSITIONAL_CLEARING_CLOSE, JournalID TRCC-<RecognitionID>. The committed
// operation row, ledger journal and audit row remain readable and
// semantically valid; every projection/read path that classifies
// TRANSITIONAL_CLEARING_CLOSE / TRCC- artifacts must keep working unchanged.
//
// This is NOT a generic journal / clearing / adjustment / Treasury / payment
// / migration feature. Every business fact (amount, accounts, RecognitionID,
// OrderID, source key, journal identity, RequestKey) is FROZEN in the
// constants below; the former public entry took ZERO parameters, so no caller
// could choose or override any business input. It was never called from any
// application load or business path. The global control plane
// (101.SingleCommit.Config.Control.js) keeps its mutation authority EXACTLY
// the one Script Properties key and never performed this close.
//
// Durability model (§18 idempotency + established durable-operation
// conventions, retained as historical documentation of the committed
// artifacts): deterministic one-time identity derived from the frozen
// transition; the operation row (TransactionOperations, State=COMMITTED), the
// two BalanceLedger lines and the one Logs audit row traveled in ONE atomic
// batchUpdate (three appendCells subrequests). Replay-after-commit semantics
// (ALREADY_COMMITTED, zero writes, never a second journal) were covered by
// the test matrix; idempotency is defense-in-depth only and is NOT the
// retirement mechanism — the production write surface no longer exists.
//
// Evidence: truthful internal attestation only (owner-authorized internal
// architecture transition, source RecognitionID, frozen amount/accounts,
// server timestamp, this contract + D13 + task authorization in the audit
// Metadata). NO fabricated EvidenceRef, NO TreasuryReceipts row, NO
// payment / channel / destination / settlement artifact.
// ---------------------------------------------------------------------------
var TRANSITIONAL_CLEARING_CLOSE_V1 = Object.freeze({
  OPERATION_TYPE: "TRANSITIONAL_CLEARING_CLOSE",
  PLAN_VERSION: 1,
  // The frozen transition — every business identity below is a constant.
  RECOGNITION_ID: "SCR-CE122B27-ORD677BE5CES",
  ORDER_ID: "ORD-677BE5CE-SALESRECOGNI",
  AMOUNT: 24000,
  MONEY_ACCOUNT_CODE: "1040",
  CLEARING_ACCOUNT_CODE: "1030",
  JOURNAL_ID_PREFIX: "TRCC-",
  REQUEST_KEY_PREFIX: "TRCC-",
  MOVEMENT_TYPE: "TRANSITIONAL_CLEARING_CLOSE",
  SOURCE_TYPE: "TRANSITIONAL_CLEARING_CLOSE",
  AUDIT_ID_PREFIX: "TRCCA-",
  AUDIT_MODULE: "TransitionalClearingClose",
  AUDIT_ACTION: "TRANSITIONAL_CLEARING_CLOSE",
  ATTESTATION: "OWNER_AUTHORIZED_INTERNAL_ARCHITECTURE_TRANSITION",
  CONTRACT_REFERENCE: "docs/T11-2-SINGLE-COMMIT-TRANSACTION-CONTRACT.md#section-18",
  // The ONLY surfaces the single batch may ever touch. Accounts, Sales,
  // Treasury, Payments, Settlements, Inventory, tabops, PurchaseEvents and
  // config properties are forbidden artifacts for this operation.
  WRITE_SURFACES: Object.freeze(["TransactionOperations", "BalanceLedger", "Logs"]),
  MAX_CELL_CHARS: 45000,
  MAX_BATCH_CELLS: 500,
  MAX_REQUEST_BYTES: 1000000,
  REQUEST_OVERHEAD_BYTES: 4096,
  STATUS: Object.freeze({
    DONE: "DONE",
    ALREADY_COMMITTED: "ALREADY_COMMITTED",
    REFUSED: "REFUSED",
    CONFLICT: "CONFLICT",
    UNKNOWN: "UNKNOWN",
    RECOVERY_REQUIRED: "RECOVERY_REQUIRED",
    LOCK_TIMEOUT: "LOCK_TIMEOUT",
    RUNTIME_UNAVAILABLE: "RUNTIME_UNAVAILABLE"
  }),
  CODES: Object.freeze({
    RUNTIME_INCOMPLETE: "TRANSITIONAL_CLOSE_RUNTIME_INCOMPLETE",
    CONFIG_NOT_ACTIVE: "TRANSITIONAL_CLOSE_CONFIG_NOT_ACTIVE",
    SCHEMA_NOT_READY: "TRANSITIONAL_CLOSE_SCHEMA_NOT_READY",
    ACCOUNT_PREFLIGHT_FAILED: "TRANSITIONAL_CLOSE_ACCOUNT_PREFLIGHT_FAILED",
    RECOGNITION_AUTHORITY_FAILED: "TRANSITIONAL_CLOSE_RECOGNITION_AUTHORITY_FAILED",
    EXPOSURE_NOT_UNCLEARED: "TRANSITIONAL_CLOSE_EXPOSURE_NOT_UNCLEARED",
    AMOUNT_MISMATCH: "TRANSITIONAL_CLOSE_AMOUNT_MISMATCH",
    RECONCILIATION_NOT_CLEAN: "TRANSITIONAL_CLOSE_RECONCILIATION_NOT_CLEAN",
    TREASURY_RECEIPT_EXISTS: "TRANSITIONAL_CLOSE_TREASURY_RECEIPT_EXISTS",
    PRIOR_CLOSE_ARTIFACT_EXISTS: "TRANSITIONAL_CLOSE_PRIOR_CLOSE_ARTIFACT_EXISTS",
    DUPLICATE_OPERATION_EVIDENCE: "TRANSITIONAL_CLOSE_DUPLICATE_OPERATION_EVIDENCE",
    OPERATION_PAYLOAD_CONFLICT: "TRANSITIONAL_CLOSE_OPERATION_PAYLOAD_CONFLICT",
    INVALID_OPERATION_STATE: "TRANSITIONAL_CLOSE_INVALID_OPERATION_STATE",
    PLAN_MALFORMED: "TRANSITIONAL_CLOSE_PLAN_MALFORMED",
    IDENTITY_CONFLICT: "TRANSITIONAL_CLOSE_IDENTITY_CONFLICT",
    JOURNAL_SIGNATURE_INVALID: "TRANSITIONAL_CLOSE_JOURNAL_SIGNATURE_INVALID",
    BATCH_BOUNDS_EXCEEDED: "TRANSITIONAL_CLOSE_BATCH_BOUNDS_EXCEEDED",
    ARTIFACTS_INCOMPLETE: "TRANSITIONAL_CLOSE_ARTIFACTS_INCOMPLETE",
    BATCH_OUTCOME_UNKNOWN: "TRANSITIONAL_CLOSE_BATCH_OUTCOME_UNKNOWN",
    READBACK_UNKNOWN: "TRANSITIONAL_CLOSE_READBACK_UNKNOWN"
  })
});

function transitionalClearingCloseResult_(status, fields) {
  return Object.assign({
    status: status, code: "", detail: "", requestKey: "", operationID: "",
    journalID: "", auditID: "", recognitionID: "", orderID: "",
    amount: TRANSITIONAL_CLEARING_CLOSE_V1.AMOUNT, economicDate: "",
    writeCount: 0, replay: false
  }, fields || {});
}

// Frozen derivations — deterministic from the one transition, never from a
// caller argument and never from a clock.
function transitionalClearingCloseJournalID_() {
  return TRANSITIONAL_CLEARING_CLOSE_V1.JOURNAL_ID_PREFIX +
    TRANSITIONAL_CLEARING_CLOSE_V1.RECOGNITION_ID;
}
function transitionalClearingCloseRequestKey_() {
  return TRANSITIONAL_CLEARING_CLOSE_V1.REQUEST_KEY_PREFIX +
    TRANSITIONAL_CLEARING_CLOSE_V1.RECOGNITION_ID;
}
function transitionalClearingCloseOperationID_() {
  return transactionOperationID_(TRANSITIONAL_CLEARING_CLOSE_V1.OPERATION_TYPE,
    transitionalClearingCloseRequestKey_());
}
function transitionalClearingCloseAuditID_() {
  return transactionStableBootstrapId_(TRANSITIONAL_CLEARING_CLOSE_V1.AUDIT_ID_PREFIX,
    [transitionalClearingCloseRequestKey_()]);
}
// Deterministic payload hash over business content ONLY (identities, frozen
// amount/accounts, source keys) — timestamps never enter the hash, so a
// replay re-derives the exact persisted hash.
function transitionalClearingClosePayloadHash_() {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1;
  return transactionPayloadHash_({
    operationType: close.OPERATION_TYPE,
    requestKey: transitionalClearingCloseRequestKey_(),
    recognitionID: close.RECOGNITION_ID,
    orderID: close.ORDER_ID,
    amount: close.AMOUNT,
    journalID: transitionalClearingCloseJournalID_(),
    moneyAccountCode: close.MONEY_ACCOUNT_CODE,
    clearingAccountCode: close.CLEARING_ACCOUNT_CODE,
    movementType: close.MOVEMENT_TYPE,
    sourceType: close.SOURCE_TYPE
  });
}
// Asia/Jakarta is a fixed UTC+7 offset (no DST): derive the action date key
// deterministically from the server clock without host-timezone dependence.
function transitionalClearingCloseDateKey_(now) {
  var jakarta = new Date(now.getTime() + 7 * 3600000);
  return jakarta.toISOString().slice(0, 10);
}
function transitionalClearingCloseIsoTimestamp_(now) {
  return now instanceof Date ? now.toISOString() : String(now);
}

// ---------------------------------------------------------------------------
// Config gate (read-only): the T11.2 §20 SINGLE_COMMIT_TRANSACTION_V1 config
// must resolve VALID + ACTIVE (§18 precondition "config ACTIVE"). ABSENT /
// PREPARED / PAUSED / REJECT / unresolved all fail closed with zero writes.
// ---------------------------------------------------------------------------
function transitionalClearingCloseConfigActive_(runtime) {
  var raw = null;
  if (runtime && Object.prototype.hasOwnProperty.call(runtime, "singleCommitConfig")) {
    raw = runtime.singleCommitConfig;
  } else if (runtime && runtime.properties) {
    try {
      raw = runtime.properties.getProperty(SINGLE_COMMIT_TRANSACTION_V1.CONFIG_PROPERTY);
    } catch (error) {
      return { active: false, code: TRANSITIONAL_CLEARING_CLOSE_V1.CODES.CONFIG_NOT_ACTIVE,
        detail: "CONFIG_UNREADABLE" };
    }
  } else {
    return { active: false, code: TRANSITIONAL_CLEARING_CLOSE_V1.CODES.CONFIG_NOT_ACTIVE,
      detail: "CONFIG_SOURCE_UNAVAILABLE" };
  }
  var state = singleCommitTransactionConfigState_(raw);
  if (state.state === "VALID" &&
      state.mode === SINGLE_COMMIT_TRANSACTION_V1_CONTROL.ACTIVE_MODE) {
    return { active: true, code: "", detail: "" };
  }
  return { active: false, code: TRANSITIONAL_CLEARING_CLOSE_V1.CODES.CONFIG_NOT_ACTIVE,
    detail: "STATE:" + state.state + ";MODE:" + String(state.mode || "") };
}

// ---------------------------------------------------------------------------
// Schema gate: the four authority tables this writer reads and the three it
// writes must carry the exact canonical headers (pure header reads; a missing
// sheet or drifted header refuses before any mutable-state evaluation).
// ---------------------------------------------------------------------------
function transitionalClearingCloseSchemaGate_(ss) {
  var bad = [];
  try { readCanonicalTable(ss, "TransactionOperations",
    TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS); }
  catch (error) { bad.push("TransactionOperations"); }
  try { readCanonicalTable(ss, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS); }
  catch (error) { bad.push("BalanceLedger"); }
  try { readCanonicalTable(ss, "Logs", CANONICAL_ENTRY.LOG_HEADERS); }
  catch (error) { bad.push("Logs"); }
  try { readCanonicalTable(ss, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS); }
  catch (error) { bad.push("SalesRecognitionEvents"); }
  try { readCanonicalTable(ss, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS); }
  catch (error) { bad.push("Accounts"); }
  return { status: bad.length ? "FAIL" : "PASS", badSheets: bad };
}

// ---------------------------------------------------------------------------
// Full fail-closed preflight (§18 Preconditions + task Phase 3). Runs inside
// the lock immediately before plan freeze; ZERO WRITE on any failure. The
// target identities are frozen constants; "U9 not targeted" holds by
// construction (the only ledger keys this writer can ever emit are the
// frozen TRCC-/SCR-CE122B27 identities) and is proven by the test matrix.
// ---------------------------------------------------------------------------
function transitionalClearingClosePreflight_(runtime) {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1, codes = close.CODES, ss = runtime.spreadsheet;
  function refuse(code, detail) { return { status: "REFUSED", code: code, detail: detail }; }
  // (1) T11 config ACTIVE.
  var config = transitionalClearingCloseConfigActive_(runtime);
  if (!config.active) return refuse(config.code, config.detail);
  // (2) Schema authorities.
  var schema = transitionalClearingCloseSchemaGate_(ss);
  if (schema.status !== "PASS") {
    return refuse(codes.SCHEMA_NOT_READY, schema.badSheets.join(","));
  }
  // (3)-(4) Accounts authority: 1040 exact §11 expectation, 1030 valid Sales
  // Settlement Clearing once (same authority the activation preflight uses).
  var accountRows = readCanonicalTable(ss, "Accounts",
    CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  var money = preflightSingleCommitMoneyAccount(accountRows);
  if (money.status !== "PASS") {
    var moneyError = money.errors[0] || {};
    return refuse(codes.ACCOUNT_PREFLIGHT_FAILED,
      "1040:" + String(moneyError.code || "ACCOUNT_INVALID"));
  }
  var expected1030 = salesRecognitionAccountExpectations_().filter(function(expected) {
    return expected.AccountCode === close.CLEARING_ACCOUNT_CODE;
  })[0] || null;
  if (!expected1030) {
    return refuse(codes.ACCOUNT_PREFLIGHT_FAILED, "1030:EXPECTATION_UNAVAILABLE");
  }
  var matches1030 = accountRows.filter(function(row) {
    return row && typeof row === "object" && !Array.isArray(row) &&
      String(row.AccountCode === undefined || row.AccountCode === null ? "" :
        row.AccountCode).trim() === close.CLEARING_ACCOUNT_CODE;
  });
  if (matches1030.length !== 1) {
    return refuse(codes.ACCOUNT_PREFLIGHT_FAILED,
      "1030:" + (matches1030.length ? "DUPLICATE" : "ABSENT"));
  }
  if (!isCanonicalActive(matches1030[0].IsActive)) {
    return refuse(codes.ACCOUNT_PREFLIGHT_FAILED, "1030:INACTIVE");
  }
  if (salesRecognitionAccountFieldMismatch_(matches1030[0], expected1030)) {
    return refuse(codes.ACCOUNT_PREFLIGHT_FAILED, "1030:METADATA_MISMATCH");
  }
  // (5)-(6) Recognition authority: exists ONCE, RECOGNITION event, expected
  // order, amount exactly 24,000, and a valid V2 verdict (Revenue already
  // recognized — the Dr1030/Cr4000 journal and its lineage verified).
  var events = readCanonicalTable(ss, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  var recognitionRows = events.filter(function(row) {
    return String(row.RecognitionID || "") === close.RECOGNITION_ID;
  });
  if (recognitionRows.length !== 1) {
    return refuse(codes.RECOGNITION_AUTHORITY_FAILED,
      "RECOGNITION_COUNT:" + recognitionRows.length);
  }
  var recognition = recognitionRows[0];
  if (String(recognition.EventType || "") !== "RECOGNITION" ||
      String(recognition.OrderID || "") !== close.ORDER_ID) {
    return refuse(codes.RECOGNITION_AUTHORITY_FAILED, "EVENT_OR_ORDER_MISMATCH");
  }
  if (Number(recognition.Amount) !== close.AMOUNT) {
    return refuse(codes.AMOUNT_MISMATCH,
      "EVENT_AMOUNT:" + String(recognition.Amount));
  }
  // (10a) No TreasuryReceipt anywhere for the frozen exposure (checked
  // before the projection so the refusal code is exact).
  var receipts = null;
  try {
    receipts = readCanonicalTable(ss, "TreasuryReceipts",
      TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.RECEIPTS.HEADERS);
  } catch (error) {
    return refuse(codes.SCHEMA_NOT_READY, "TreasuryReceipts:" + error.message);
  }
  var receiptMatches = receipts.filter(function(receipt) {
    return String(receipt.RecognitionID || "") === close.RECOGNITION_ID;
  });
  if (receiptMatches.length) {
    return refuse(codes.TREASURY_RECEIPT_EXISTS, "RECEIPT_COUNT:" + receiptMatches.length);
  }
  // (11a) No prior close artifact — checked BEFORE the projection so a stray
  // close-shaped ledger fragment is attributed precisely (it would otherwise
  // surface as a CLEARED exposure): no close operation row (any RequestKey).
  var operations = null;
  try {
    operations = readCanonicalTable(ss, "TransactionOperations",
      TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS);
  } catch (error) {
    return refuse(codes.SCHEMA_NOT_READY, "TransactionOperations:" + error.message);
  }
  var priorOperations = operations.filter(function(op) {
    return String(op.OperationType || "") === close.OPERATION_TYPE;
  });
  if (priorOperations.length) {
    return refuse(codes.PRIOR_CLOSE_ARTIFACT_EXISTS,
      "OPERATION_COUNT:" + priorOperations.length);
  }
  // (11b) No prior close ledger line / TRCC- journal / close source key.
  var ledger = null;
  try {
    ledger = readCanonicalTable(ss, "BalanceLedger",
      BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  } catch (error) {
    return refuse(codes.SCHEMA_NOT_READY, "BalanceLedger:" + error.message);
  }
  var journalID = transitionalClearingCloseJournalID_();
  var priorCloseLines = ledger.filter(function(line) {
    return isCanonicalActive(line.IsActive) &&
      (String(line.SourceType || "") === close.SOURCE_TYPE ||
        String(line.JournalID || "") === journalID ||
        (String(line.SourceID || "") === close.RECOGNITION_ID &&
          String(line.MovementType || "") === close.MOVEMENT_TYPE));
  });
  if (priorCloseLines.length) {
    return refuse(codes.PRIOR_CLOSE_ARTIFACT_EXISTS,
      "LEDGER_LINE_COUNT:" + priorCloseLines.length);
  }
  // (7)-(9)+(13) Canonical T5 projection + global reconciliation over the
  // real sheets: exposure exactly once, UNCLEARED, outstanding exactly
  // 24,000, integrity VALID, no receipt identity, valid event verdict;
  // global 1030 consistent (LedgerNet1030 = outstanding = 24,000, exception
  // amount 0) and unexplained residual 0.
  var exposure = null;
  try { exposure = buildTreasuryClearingProjection_(ss, {}); }
  catch (error) {
    return refuse(codes.EXPOSURE_NOT_UNCLEARED,
      "T5_PROJECTION_FAILED:" + String(error && error.message || error));
  }
  var exposureRows = (exposure.rows || []).filter(function(row) {
    return String(row.RecognitionID || "") === close.RECOGNITION_ID;
  });
  if (exposureRows.length !== 1) {
    return refuse(codes.EXPOSURE_NOT_UNCLEARED, "EXPOSURE_COUNT:" + exposureRows.length);
  }
  var row = exposureRows[0];
  // Integrity attribution first: a broken recognition authority is never
  // misreported as a plain state mismatch.
  if ((row.QualityCodes || []).length) {
    return refuse(codes.RECOGNITION_AUTHORITY_FAILED,
      "QUALITY:" + row.QualityCodes.join(","));
  }
  if (String(row.ClearingStatus || "") !== "UNCLEARED") {
    return refuse(codes.EXPOSURE_NOT_UNCLEARED, "STATUS:" + String(row.ClearingStatus));
  }
  if (Number(row.RecognizedAmount) !== close.AMOUNT ||
      Number(row.OutstandingAmount) !== close.AMOUNT) {
    return refuse(codes.AMOUNT_MISMATCH,
      "EXPOSURE:recognized=" + String(row.RecognizedAmount) +
      ";outstanding=" + String(row.OutstandingAmount));
  }
  if (Number(row.ActiveReceiptCount) !== 0) {
    return refuse(codes.TREASURY_RECEIPT_EXISTS, "ATTACHED_RECEIPT_COUNT:" +
      String(row.ActiveReceiptCount));
  }
  // Revenue already recognized: the canonical projection row's integrity is
  // the same U3 verdict over the committed recognition artifacts (op + audit
  // + signed Dr1030/Cr4000 journal + order lineage), and the exposure must
  // belong to the expected frozen order.
  if (String(row.RecognitionIntegrity || "") !== "VALID" ||
      String(row.OrderID || "") !== close.ORDER_ID) {
    return refuse(codes.RECOGNITION_AUTHORITY_FAILED, "EXPOSURE_INTEGRITY_INVALID");
  }
  var reconciliation = null;
  try { reconciliation = buildTreasury1030Reconciliation_(ss, {}); }
  catch (error) {
    return refuse(codes.RECONCILIATION_NOT_CLEAN,
      "RECONCILIATION_FAILED:" + String(error && error.message || error));
  }
  if (String(reconciliation.reconciliationStatus) !== "OK" ||
      Number(reconciliation.unexplainedResidual) !== 0) {
    return refuse(codes.RECONCILIATION_NOT_CLEAN,
      "STATUS:" + String(reconciliation.reconciliationStatus) +
      ";RESIDUAL:" + String(reconciliation.unexplainedResidual));
  }
  if (Number(reconciliation.ledgerNet1030) !== close.AMOUNT ||
      Number(reconciliation.outstandingTotal) !== close.AMOUNT ||
      Number(reconciliation.explicitExceptionAmount) !== 0) {
    return refuse(codes.RECONCILIATION_NOT_CLEAN,
      "PRE_STATE:ledgerNet1030=" + String(reconciliation.ledgerNet1030) +
      ";outstanding=" + String(reconciliation.outstandingTotal) +
      ";exception=" + String(reconciliation.explicitExceptionAmount));
  }
  return { status: "PASS", code: "", detail: "", evidence: {
    recognitionID: close.RECOGNITION_ID, orderID: close.ORDER_ID,
    amount: close.AMOUNT, ledgerNet1030: Number(reconciliation.ledgerNet1030),
    outstandingTotal: Number(reconciliation.outstandingTotal),
    unexplainedResidual: Number(reconciliation.unexplainedResidual),
    clearingStatus: String(row.ClearingStatus)
  } };
}

// ---------------------------------------------------------------------------
// Immutable plan: the exact two ledger lines, the COMMITTED operation row and
// the truthful audit row, plus deterministic derivations and the digest.
// ---------------------------------------------------------------------------
function transitionalClearingClosePlan_(input) {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1,
    journalID = transitionalClearingCloseJournalID_();
  var lineBase = {
    JournalID: journalID,
    Tanggal: input.economicDate,
    MovementType: close.MOVEMENT_TYPE,
    SourceType: close.SOURCE_TYPE,
    SourceID: close.RECOGNITION_ID,
    ExternalRef: journalID,
    IsActive: true,
    CreatedAt: input.savedAt,
    CreatedBy: input.actor,
    UpdatedAt: "",
    UpdatedBy: ""
  };
  var journalRows = [
    Object.assign({}, lineBase, { LineID: journalID + "-1",
      AccountCode: close.MONEY_ACCOUNT_CODE, Debit: close.AMOUNT, Credit: 0,
      Keterangan: "Transitional clearing close (T11.2 section 18): operational funds recognized once." }),
    Object.assign({}, lineBase, { LineID: journalID + "-2",
      AccountCode: close.CLEARING_ACCOUNT_CODE, Debit: 0, Credit: close.AMOUNT,
      Keterangan: "Transitional clearing close (T11.2 section 18): clearing exposure SCR-CE122B27 closed once." })
  ];
  var metadata = {
    contract: close.CONTRACT_REFERENCE,
    attestation: close.ATTESTATION,
    operationType: close.OPERATION_TYPE,
    recognitionID: close.RECOGNITION_ID,
    orderID: close.ORDER_ID,
    amount: close.AMOUNT,
    debitAccountCode: close.MONEY_ACCOUNT_CODE,
    creditAccountCode: close.CLEARING_ACCOUNT_CODE,
    journalID: journalID,
    requestKey: input.requestKey,
    operationID: input.operationID,
    serverTimestamp: input.savedAt,
    evidence: "OWNER_ATTESTATION_INTERNAL_ARCHITECTURE_TRANSITION"
  };
  var auditRow = {
    ID_Log: input.auditID,
    Timestamp: input.savedAt,
    Level: "INFO",
    Module: close.AUDIT_MODULE,
    Action: close.AUDIT_ACTION,
    RecordID: journalID,
    User: input.actor,
    Message: "Transitional clearing close committed: Dr1040/Cr1030 24000 for SCR-CE122B27-ORD677BE5CES (T11.2 section 18, owner-authorized internal architecture transition).",
    Metadata: JSON.stringify(metadata)
  };
  var operationRow = {
    OperationID: input.operationID,
    OperationType: close.OPERATION_TYPE,
    BusinessID: close.RECOGNITION_ID,
    RequestKey: input.requestKey,
    State: "COMMITTED",
    PayloadHash: input.payloadHash,
    OperationPlan: "", // filled after digest freeze
    CreatedAt: input.savedAt,
    UpdatedAt: input.savedAt,
    LastError: ""
  };
  var plan = {
    planVersion: close.PLAN_VERSION,
    operationType: close.OPERATION_TYPE,
    requestKey: input.requestKey,
    operationID: input.operationID,
    businessID: close.RECOGNITION_ID,
    payloadHash: input.payloadHash,
    recognitionID: close.RECOGNITION_ID,
    orderID: close.ORDER_ID,
    amount: close.AMOUNT,
    journalID: journalID,
    lineID1: journalID + "-1",
    lineID2: journalID + "-2",
    accounts: { money: close.MONEY_ACCOUNT_CODE, clearing: close.CLEARING_ACCOUNT_CODE },
    economicDate: input.economicDate,
    savedAt: input.savedAt,
    actor: input.actor,
    movementType: close.MOVEMENT_TYPE,
    sourceType: close.SOURCE_TYPE,
    journalRows: journalRows,
    operationRow: operationRow,
    auditRow: auditRow,
    journalSignature: policyCJournalSignature_(journalRows)
  };
  plan.planDigest = transactionPayloadHash_(plan);
  plan.operationRow.OperationPlan = JSON.stringify(plan);
  return plan;
}

// Shape + derivation + tamper verification. Runs at freeze time (REFUSED
// before any write) and on every replay against the STORED plan (fail
// closed, ZERO additional writes).
function transitionalClearingCloseVerifyPlan_(plan) {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1;
  function malformed(reason) { return { ok: false, kind: "MALFORMED", reason: reason }; }
  function tampered(reason) { return { ok: false, kind: "TAMPERED", reason: reason }; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return malformed("PLAN_NOT_OBJECT");
  if (plan.planVersion !== close.PLAN_VERSION) return malformed("PLAN_VERSION_MISMATCH");
  if (plan.operationType !== close.OPERATION_TYPE) return malformed("OPERATION_TYPE_MISMATCH");
  if (plan.requestKey !== transitionalClearingCloseRequestKey_()) {
    return tampered("REQUEST_KEY_MISMATCH");
  }
  if (plan.operationID !== transitionalClearingCloseOperationID_()) {
    return tampered("OPERATION_ID_DERIVATION_MISMATCH");
  }
  if (plan.businessID !== close.RECOGNITION_ID || plan.recognitionID !== close.RECOGNITION_ID) {
    return tampered("RECOGNITION_ID_MISMATCH");
  }
  if (plan.orderID !== close.ORDER_ID) return tampered("ORDER_ID_MISMATCH");
  if (Number(plan.amount) !== close.AMOUNT) return tampered("AMOUNT_MISMATCH");
  if (plan.journalID !== transitionalClearingCloseJournalID_()) {
    return tampered("JOURNAL_ID_MISMATCH");
  }
  if (plan.lineID1 !== plan.journalID + "-1" || plan.lineID2 !== plan.journalID + "-2") {
    return tampered("LINE_ID_MISMATCH");
  }
  if (!plan.accounts || plan.accounts.money !== close.MONEY_ACCOUNT_CODE ||
      plan.accounts.clearing !== close.CLEARING_ACCOUNT_CODE) {
    return tampered("ACCOUNT_MAPPING_MISMATCH");
  }
  if (plan.movementType !== close.MOVEMENT_TYPE || plan.sourceType !== close.SOURCE_TYPE) {
    return tampered("SOURCE_MISMATCH");
  }
  if (typeof plan.economicDate !== "string" || !capitalEquityDateKey(plan.economicDate)) {
    return malformed("ECONOMIC_DATE_INVALID");
  }
  if (typeof plan.savedAt !== "string" || !plan.savedAt ||
      typeof plan.actor !== "string" || !plan.actor) {
    return malformed("ACTOR_OR_TIMESTAMP_MISSING");
  }
  if (plan.payloadHash !== transitionalClearingClosePayloadHash_()) {
    return tampered("PAYLOAD_HASH_MISMATCH");
  }
  // Journal rows: exact two-line frozen shape, balanced, canonical source.
  var rows = plan.journalRows;
  if (!Array.isArray(rows) || rows.length !== 2) return malformed("JOURNAL_ROW_COUNT");
  var debit = rows.filter(function(r) { return String(r.AccountCode) === close.MONEY_ACCOUNT_CODE; });
  var credit = rows.filter(function(r) { return String(r.AccountCode) === close.CLEARING_ACCOUNT_CODE; });
  if (debit.length !== 1 || credit.length !== 1) return tampered("JOURNAL_ACCOUNT_MISMATCH");
  if (Number(debit[0].Debit) !== close.AMOUNT || Number(debit[0].Credit) !== 0) {
    return tampered("DEBIT_LEG_MISMATCH");
  }
  if (Number(credit[0].Debit) !== 0 || Number(credit[0].Credit) !== close.AMOUNT) {
    return tampered("CREDIT_LEG_MISMATCH");
  }
  if (!rows.every(function(r) { return r.JournalID === plan.journalID; })) {
    return tampered("JOURNAL_ID_MISMATCH");
  }
  if (!rows.every(function(r) {
    return r.SourceType === close.SOURCE_TYPE && r.SourceID === close.RECOGNITION_ID &&
      r.MovementType === close.MOVEMENT_TYPE && r.IsActive === true &&
      r.ExternalRef === plan.journalID && String(r.Tanggal) === plan.economicDate;
  })) {
    return tampered("JOURNAL_SOURCE_MISMATCH");
  }
  if (!rows.every(function(r) { return r.LineID === plan.lineID1 || r.LineID === plan.lineID2; })) {
    return tampered("JOURNAL_LINE_ID_MISMATCH");
  }
  var totalDebit = 0, totalCredit = 0;
  rows.forEach(function(r) { totalDebit += Number(r.Debit || 0); totalCredit += Number(r.Credit || 0); });
  if (totalDebit !== close.AMOUNT || totalCredit !== close.AMOUNT || totalDebit !== totalCredit) {
    return tampered("JOURNAL_NOT_BALANCED");
  }
  if (policyCJournalSignature_(rows) !== plan.journalSignature) {
    return tampered("JOURNAL_SIGNATURE_MISMATCH");
  }
  // Operation row frozen shape.
  var op = plan.operationRow;
  if (!op || typeof op !== "object" || Array.isArray(op)) return malformed("OPERATION_ROW_MISSING");
  if (op.OperationID !== plan.operationID || op.OperationType !== close.OPERATION_TYPE ||
      op.BusinessID !== close.RECOGNITION_ID || op.RequestKey !== plan.requestKey ||
      op.State !== "COMMITTED" || op.PayloadHash !== plan.payloadHash ||
      String(op.LastError || "") !== "") {
    return tampered("OPERATION_ROW_MISMATCH");
  }
  // Audit row: truthful internal attestation only — never an external
  // evidence / payment / channel / destination claim.
  var audit = plan.auditRow;
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    return malformed("AUDIT_ROW_MISSING");
  }
  if (audit.ID_Log !== transitionalClearingCloseAuditID_() ||
      audit.Module !== close.AUDIT_MODULE || audit.Action !== close.AUDIT_ACTION ||
      audit.RecordID !== plan.journalID || String(audit.Level) !== "INFO" ||
      String(audit.User) !== plan.actor || String(audit.Timestamp) !== plan.savedAt) {
    return tampered("AUDIT_ROW_MISMATCH");
  }
  var metadata = null;
  try { metadata = JSON.parse(audit.Metadata); }
  catch (error) { return malformed("AUDIT_METADATA_INVALID"); }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return malformed("AUDIT_METADATA_INVALID");
  }
  if (metadata.attestation !== close.ATTESTATION ||
      metadata.recognitionID !== close.RECOGNITION_ID ||
      metadata.orderID !== close.ORDER_ID ||
      Number(metadata.amount) !== close.AMOUNT ||
      metadata.debitAccountCode !== close.MONEY_ACCOUNT_CODE ||
      metadata.creditAccountCode !== close.CLEARING_ACCOUNT_CODE ||
      metadata.journalID !== plan.journalID ||
      metadata.operationID !== plan.operationID ||
      metadata.serverTimestamp !== plan.savedAt) {
    return tampered("AUDIT_METADATA_MISMATCH");
  }
  if (Object.prototype.hasOwnProperty.call(metadata, "evidenceRef") ||
      Object.prototype.hasOwnProperty.call(metadata, "paymentMethod") ||
      Object.prototype.hasOwnProperty.call(metadata, "channel") ||
      Object.prototype.hasOwnProperty.call(metadata, "destination") ||
      Object.prototype.hasOwnProperty.call(metadata, "settlementID") ||
      Object.prototype.hasOwnProperty.call(metadata, "treasuryReceiptID")) {
    return tampered("AUDIT_METADATA_FORBIDDEN_CLAIM");
  }
  // Digest integrity.
  var digestInput = Object.assign({}, plan);
  delete digestInput.planDigest;
  // operationRow.OperationPlan embeds the plan JSON; recompute exactly as frozen.
  digestInput.operationRow = Object.assign({}, plan.operationRow, { OperationPlan: "" });
  if (plan.planDigest !== transactionPayloadHash_(digestInput)) {
    return tampered("PLAN_DIGEST_MISMATCH");
  }
  return { ok: true, kind: "", reason: "" };
}

// ---------------------------------------------------------------------------
// The ONE batch's logical ranges: exactly three value ranges over the frozen
// write surfaces (operation authority + two ledger lines + audit row).
// ---------------------------------------------------------------------------
function transitionalClearingCloseValueRanges_(plan) {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1;
  function rowValues(row, headers) {
    return headers.map(function(header) {
      return row[header] === undefined ? "" : row[header];
    });
  }
  var ranges = [
    { range: "TransactionOperations", values: [rowValues(plan.operationRow,
      TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS)] },
    { range: "BalanceLedger", values: plan.journalRows.map(function(row) {
      return rowValues(row, BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS); }) },
    { range: "Logs", values: [rowValues(plan.auditRow, CANONICAL_ENTRY.LOG_HEADERS)] }
  ];
  if (JSON.stringify(ranges.map(function(range) { return range.range; })) !==
      JSON.stringify(close.WRITE_SURFACES)) {
    throw new Error("SAVE_SURFACE_MISMATCH");
  }
  return ranges;
}

function transitionalClearingCloseCellValue_(value) {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1;
  if (typeof value === "number") {
    if (!isFinite(value)) throw new Error("UNSAFE_CELL_NUMBER");
    return { numberValue: value };
  }
  if (typeof value === "boolean") return { boolValue: value };
  var text = String(value === undefined || value === null ? "" : value);
  if (text.length > close.MAX_CELL_CHARS) throw new Error("UNSAFE_CELL_CHARS:" + text.length);
  return { stringValue: text };
}

function transitionalClearingCloseBatchBody_(valueRanges, sheetIds) {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1;
  if (valueRanges.length !== close.WRITE_SURFACES.length) {
    throw new Error("SAVE_SURFACE_MISMATCH");
  }
  var requests = valueRanges.map(function(range) {
    var sheetId = sheetIds[range.range];
    if (typeof sheetId !== "number" || !isFinite(sheetId)) {
      throw new Error("SHEET_ID_UNAVAILABLE:" + range.range);
    }
    return { appendCells: { sheetId: sheetId, fields: "userEnteredValue",
      rows: range.values.map(function(row) {
        return { values: row.map(function(cell) {
          return { userEnteredValue: transitionalClearingCloseCellValue_(cell) };
        }) };
      }) } };
  });
  return { requests: requests };
}

function transitionalClearingCloseUtf8Bytes_(text) {
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

function transitionalClearingCloseBounds_(plan) {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1, ranges;
  try { ranges = transitionalClearingCloseValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "SAVE_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var sentinel = {};
  close.WRITE_SURFACES.forEach(function(name) { sentinel[name] = 2147483647; });
  var body;
  try { body = transitionalClearingCloseBatchBody_(ranges, sentinel); }
  catch (error) { return { ok: false, detail: "UNSAFE_BATCH:" + error.message }; }
  var bytes = transitionalClearingCloseUtf8Bytes_(JSON.stringify(body)) +
    close.REQUEST_OVERHEAD_BYTES;
  var planJson = "";
  try { planJson = JSON.stringify(plan); }
  catch (error) { return { ok: false, detail: "PLAN_JSON_INVALID" }; }
  if (planJson.length > close.MAX_CELL_CHARS) {
    return { ok: false, detail: "UNSAFE_PLAN_CELL_CHARS:" + planJson.length };
  }
  var ok = cells <= close.MAX_BATCH_CELLS && bytes <= close.MAX_REQUEST_BYTES;
  return { ok: ok, cells: cells, bytes: bytes, planChars: planJson.length,
    detail: ok ? "" : "BATCH_BOUNDS cells=" + cells + " bytes=" + bytes };
}

// ---------------------------------------------------------------------------
// Exact artifact verification over the three surfaces (readback authority).
// NONE / PARTIAL / EXACT / CONFLICT / UNKNOWN. Any foreign close-shaped
// artifact (a second TRCC- journal, a second close operation) is a conflict
// that fails visible — never silently accepted, never repaired.
// ---------------------------------------------------------------------------
function transitionalClearingCloseRowExact_(actual, expected, headers) {
  return headers.every(function(header) {
    var a = actual[header] === undefined || actual[header] === null ? "" : actual[header];
    var e = expected[header] === undefined || expected[header] === null ? "" : expected[header];
    if (typeof e === "number" || typeof a === "number") {
      return Number(a) === Number(e);
    }
    if (typeof e === "boolean") return isCanonicalActive(a) === isCanonicalActive(e);
    return String(a) === String(e);
  });
}

function transitionalClearingCloseInspect_(plan, ss) {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1;
  var operations, ledger, logs;
  try {
    operations = readCanonicalTable(ss, "TransactionOperations",
      TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS);
    ledger = readCanonicalTable(ss, "BalanceLedger",
      BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
    logs = readCanonicalTable(ss, "Logs", CANONICAL_ENTRY.LOG_HEADERS);
  } catch (error) {
    return { state: "UNKNOWN", detail: "READBACK_FAILED:" + error.message };
  }
  var conflicts = [], missing = [];
  var opMatches = operations.filter(function(row) {
    return String(row.OperationType || "") === close.OPERATION_TYPE &&
      String(row.RequestKey || "") === plan.requestKey;
  });
  var foreignCloseOps = operations.filter(function(row) {
    return String(row.OperationType || "") === close.OPERATION_TYPE &&
      String(row.RequestKey || "") !== plan.requestKey;
  });
  if (foreignCloseOps.length) conflicts.push("FOREIGN_CLOSE_OPERATION");
  var plannedLineIds = {};
  plan.journalRows.forEach(function(row) { plannedLineIds[String(row.LineID)] = true; });
  var foreignCloseLines = ledger.filter(function(line) {
    return isCanonicalActive(line.IsActive) &&
      (String(line.SourceType || "") === close.SOURCE_TYPE ||
        String(line.JournalID || "") === plan.journalID) &&
      !plannedLineIds[String(line.LineID)];
  });
  if (foreignCloseLines.length) conflicts.push("FOREIGN_CLOSE_LEDGER_LINE");
  var journalById = ledger.filter(function(row) {
    return String(row.JournalID || "") === plan.journalID;
  });
  var auditById = logs.filter(function(row) {
    return String(row.ID_Log || "") === plan.auditRow.ID_Log;
  });
  var present = opMatches.length || journalById.length || auditById.length;
  if (!present) {
    if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
    return { state: "NONE", detail: "NO_ARTIFACTS" };
  }
  if (opMatches.length > 1) conflicts.push("OPERATION_DUPLICATE");
  else if (opMatches.length === 1) {
    // The persisted OperationPlan cell holds the frozen plan JSON whose
    // embedded operationRow.OperationPlan is the blank snapshot at freeze
    // time. A fresh plan carries the full JSON in the reference; a parsed
    // replay plan carries the blank snapshot — re-derive the exact expected
    // cell (parse+stringify roundtrip is byte-identical for this plan).
    var expectedOperationRow = Object.assign({}, plan.operationRow);
    if (!expectedOperationRow.OperationPlan) {
      expectedOperationRow.OperationPlan = JSON.stringify(plan);
    }
    if (!transitionalClearingCloseRowExact_(opMatches[0], expectedOperationRow,
        TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS)) {
      conflicts.push("OPERATION_TAMPERED");
    }
  } else missing.push("OPERATION");
  if (journalById.length === 2) {
    var byLine = {};
    journalById.forEach(function(row) { byLine[String(row.LineID)] = row; });
    plan.journalRows.forEach(function(expected) {
      var actual = byLine[String(expected.LineID)];
      if (!actual || !transitionalClearingCloseRowExact_(actual, expected,
          BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS)) {
        conflicts.push("JOURNAL_TAMPERED");
      }
    });
    if (policyCJournalSignature_(journalById) !== plan.journalSignature) {
      conflicts.push("JOURNAL_SIGNATURE_MISMATCH");
    }
  } else if (journalById.length === 0) missing.push("JOURNAL");
  else if (journalById.length === 1) missing.push("JOURNAL_LINE");
  else conflicts.push("JOURNAL_DUPLICATE");
  if (auditById.length === 1) {
    if (!transitionalClearingCloseRowExact_(auditById[0], plan.auditRow,
        CANONICAL_ENTRY.LOG_HEADERS)) {
      conflicts.push("AUDIT_TAMPERED");
    }
  } else if (auditById.length === 0) missing.push("AUDIT");
  else conflicts.push("AUDIT_DUPLICATE");
  if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
  if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
  return { state: "EXACT", detail: "" };
}

// ---------------------------------------------------------------------------
// Injected-runtime core (RETIRED from production; retained as the in-memory
// construction/verification authority for the test matrix and historical
// interpretation). It never acquires locks, reaches the network or touches
// production storage by itself: every storage and transport capability must
// be injected through the runtime argument, and no remaining runtime
// composition supplies one. Fixed order: exact (OperationType, RequestKey)
// lookup BEFORE any mutable-state evaluation -> replay or full preflight ->
// freeze plan -> bounds -> ONE atomic batch over the injected transport ->
// exact readback. Never retries a failed batch inside one call.
// ---------------------------------------------------------------------------
function transitionalClearingCloseWithRuntime_(runtime) {
  var close = TRANSITIONAL_CLEARING_CLOSE_V1, codes = close.CODES;
  function outcome(status, fields) {
    return transitionalClearingCloseResult_(status, Object.assign({
      requestKey: transitionalClearingCloseRequestKey_(),
      operationID: transitionalClearingCloseOperationID_(),
      journalID: transitionalClearingCloseJournalID_(),
      auditID: transitionalClearingCloseAuditID_(),
      recognitionID: close.RECOGNITION_ID,
      orderID: close.ORDER_ID
    }, fields || {}));
  }
  if (!runtime || !runtime.spreadsheet) {
    return outcome(close.STATUS.RUNTIME_UNAVAILABLE,
      { code: codes.RUNTIME_INCOMPLETE, detail: "RUNTIME_INCOMPLETE" });
  }
  var hash = transitionalClearingClosePayloadHash_();
  var requestKey = transitionalClearingCloseRequestKey_();
  // 1) Replay / recovery lookup before any mutable-state evaluation.
  var operations = null;
  try {
    operations = readCanonicalTable(runtime.spreadsheet, "TransactionOperations",
      TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS);
  } catch (error) {
    return outcome(close.STATUS.RECOVERY_REQUIRED,
      { code: codes.SCHEMA_NOT_READY, detail: "OPERATIONS_READ:" + error.message });
  }
  var matches = operations.filter(function(row) {
    return String(row.OperationType || "") === close.OPERATION_TYPE &&
      String(row.RequestKey || "") === requestKey;
  });
  if (matches.length > 1) {
    return outcome(close.STATUS.CONFLICT,
      { code: codes.DUPLICATE_OPERATION_EVIDENCE, detail: "OPERATION_COUNT:" + matches.length });
  }
  if (matches.length === 1) {
    var existing = matches[0];
    if (String(existing.State || "") !== "COMMITTED") {
      return outcome(close.STATUS.CONFLICT,
        { code: codes.INVALID_OPERATION_STATE, detail: "STATE:" + String(existing.State) });
    }
    if (String(existing.PayloadHash || "") !== hash) {
      return outcome(close.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT,
        detail: "PAYLOAD_HASH_MISMATCH" });
    }
    var storedPlan = null;
    try { storedPlan = JSON.parse(String(existing.OperationPlan || "")); }
    catch (error) {
      return outcome(close.STATUS.RECOVERY_REQUIRED,
        { code: codes.PLAN_MALFORMED, detail: "PLAN_JSON:" + error.message });
    }
    var verify = transitionalClearingCloseVerifyPlan_(storedPlan);
    if (!verify.ok) {
      return outcome(close.STATUS.RECOVERY_REQUIRED, {
        code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
        detail: verify.reason });
    }
    var replayBounds = transitionalClearingCloseBounds_(storedPlan);
    if (!replayBounds.ok) {
      return outcome(close.STATUS.RECOVERY_REQUIRED,
        { code: codes.BATCH_BOUNDS_EXCEEDED, detail: replayBounds.detail });
    }
    var replayInspect = transitionalClearingCloseInspect_(storedPlan, runtime.spreadsheet);
    if (replayInspect.state === "EXACT") {
      // COMMITTED + exactly verified artifacts => replay of a committed
      // close: the stored outcome, zero writes, never a second journal.
      if (runtime.crash) runtime.crash("TRANSITIONAL_CLOSE_AFTER_COMMIT");
      return outcome(close.STATUS.ALREADY_COMMITTED, {
        replay: true, writeCount: 0, economicDate: storedPlan.economicDate });
    }
    if (replayInspect.state === "UNKNOWN") {
      return outcome(close.STATUS.UNKNOWN,
        { code: codes.READBACK_UNKNOWN, detail: replayInspect.detail });
    }
    // COMMITTED operation without exact artifacts: fail closed, no repair,
    // no rewrite, no second batch (operation row is the authority).
    return outcome(close.STATUS.RECOVERY_REQUIRED, {
      code: replayInspect.state === "CONFLICT" ?
        (replayInspect.detail.indexOf("SIGNATURE") !== -1 ?
          codes.JOURNAL_SIGNATURE_INVALID : codes.IDENTITY_CONFLICT) :
        codes.ARTIFACTS_INCOMPLETE,
      detail: replayInspect.detail });
  }
  // 2) New path: full fail-closed preflight inside the lock (ZERO WRITE on
  // any failure), then freeze the immutable plan.
  var preflight = transitionalClearingClosePreflight_(runtime);
  if (preflight.status !== "PASS") {
    return outcome(close.STATUS.REFUSED,
      { code: preflight.code, detail: preflight.detail });
  }
  var now;
  try { now = runtime.now(); }
  catch (error) {
    return outcome(close.STATUS.REFUSED,
      { code: codes.RUNTIME_INCOMPLETE, detail: "NOW:" + error.message });
  }
  var savedAt = transitionalClearingCloseIsoTimestamp_(now);
  var economicDate = transitionalClearingCloseDateKey_(now);
  var actor = "";
  try { actor = runtime.actor(); }
  catch (error) {
    return outcome(close.STATUS.REFUSED,
      { code: codes.RUNTIME_INCOMPLETE, detail: "ACTOR:" + error.message });
  }
  var plan;
  try {
    plan = transitionalClearingClosePlan_({
      requestKey: requestKey,
      operationID: transitionalClearingCloseOperationID_(),
      auditID: transitionalClearingCloseAuditID_(),
      payloadHash: hash,
      economicDate: economicDate,
      savedAt: savedAt,
      actor: actor
    });
  } catch (error) {
    return outcome(close.STATUS.REFUSED,
      { code: codes.PLAN_MALFORMED, detail: "PLAN_BUILD:" + error.message });
  }
  var planVerify = transitionalClearingCloseVerifyPlan_(plan);
  if (!planVerify.ok) {
    return outcome(close.STATUS.REFUSED, {
      code: planVerify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: planVerify.reason });
  }
  var bounds = transitionalClearingCloseBounds_(plan);
  if (!bounds.ok) {
    return outcome(close.STATUS.REFUSED,
      { code: codes.BATCH_BOUNDS_EXCEEDED, detail: bounds.detail });
  }
  var ranges = null;
  try { ranges = transitionalClearingCloseValueRanges_(plan); }
  catch (error) {
    return outcome(close.STATUS.REFUSED, { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  var rows = 0;
  ranges.forEach(function(range) { rows += range.values.length; });
  if (runtime.crash) runtime.crash("TRANSITIONAL_CLOSE_BEFORE_BATCH");
  var batchError = null;
  try { runtime.batch(ranges); } catch (error) { batchError = error; }
  if (!batchError && runtime.crash) runtime.crash("TRANSITIONAL_CLOSE_AFTER_BATCH");
  // 3) Exact readback decides the outcome; a failed batch is inspected once
  // and never blindly retried inside this call.
  var inspection = transitionalClearingCloseInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(close.STATUS.UNKNOWN,
      { code: codes.READBACK_UNKNOWN, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "NONE") {
    if (batchError) {
      return outcome(close.STATUS.UNKNOWN, { code: codes.BATCH_OUTCOME_UNKNOWN,
        writeCount: "UNKNOWN",
        detail: String(batchError && batchError.message || batchError) });
    }
    return outcome(close.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "PARTIAL") {
    return outcome(close.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "CONFLICT") {
    return outcome(close.STATUS.RECOVERY_REQUIRED, {
      code: inspection.detail.indexOf("SIGNATURE") !== -1 ?
        codes.JOURNAL_SIGNATURE_INVALID : codes.IDENTITY_CONFLICT,
      writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (runtime.crash) runtime.crash("TRANSITIONAL_CLOSE_AFTER_READBACK");
  return outcome(close.STATUS.DONE, { writeCount: rows, economicDate: economicDate });
}

// ---------------------------------------------------------------------------
// RETIRED PRODUCTION SURFACE (T11-13): the zero-argument public production
// entry, its lock wrapper, the production runtime factory, the production
// sheet-identity lookup and the REST batch transport that committed the ONE
// authorized close were removed here after the transition was consumed and
// independently proven exactly-once (docs/T11-12-U10-TRANSITIONAL-24K-CLOSE.md).
// What remains above is: the frozen identity constants (historical READ
// authority for committed TRANSITIONAL_CLEARING_CLOSE / TRCC- artifacts),
// the read-only gates, the pure plan/verify/bounds builders, the read-only
// artifact inspector, and the injected-runtime core used exclusively by the
// in-memory test matrix. No production composition exists — and none can be
// externally supplied — that can reach a TRANSITIONAL_CLEARING_CLOSE
// financial write. Retirement is proven statically, by source audit and
// deployed-byte proof; the writer is never invoked to demonstrate it.
// ---------------------------------------------------------------------------

