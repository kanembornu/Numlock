// ---------------------------------------------------------------------------
// T11.7 U5 — SINGLE_COMMIT_TRANSACTION_V1 control plane (T11.2 §20/§21/§22).
//
// THREE single-purpose config writers, each future-capable and INERT until a
// separately authorized production unit invokes it:
//   1. prepareSingleCommitTransactionV1Production  — establish PREPARED (idempotent),
//   2. activateSingleCommitTransactionV1Production — PREPARED -> ACTIVE once,
//   3. pauseSingleCommitTransactionV1Production    — ACTIVE -> PAUSED (§22 flip).
//
// Mutation authority is EXACTLY ONE Script Properties key
// (SINGLE_COMMIT_TRANSACTION_V1) — never a sheet write, never a ledger row,
// never an account row, never a transaction/event writer, never the
// transitional 24,000 close (U10), never Sales/Expense/Purchase/Treasury
// writers. Account creation (1040) belongs to U7 and is deliberately NOT
// reachable from here: there is no combined create-1040+activate function.
// Public entries take ZERO parameters (client can never choose the mode,
// the ActivationID or the timestamp), own the single ScriptLock, and are
// never called from any application load or business path. Reuses the frozen
// pure parser/validator from 97 (singleCommitTransactionConfigState_ /
// validateSingleCommitTransactionConfig_) — one authoritative schema.
//
// Idempotency/crash model: identity is generated server-side BEFORE the
// single setProperty, the write happens exactly once per legitimate
// transition, and the exact five-field readback decides the outcome.
// Re-invocation after any UNKNOWN converges to ALREADY_* with the SAME
// persisted identity and ZERO further mutation; configVersion follows the
// frozen scheme (carried forward, never inflated — T10.5/97E precedent).
// ---------------------------------------------------------------------------
var SINGLE_COMMIT_TRANSACTION_V1_CONTROL = Object.freeze({
  PREPARED_MODE: "PREPARED",
  ACTIVE_MODE: "ACTIVE",
  PAUSED_MODE: "PAUSED",
  ACTIVATION_PREFIX: "SCA-",
  STATUS: Object.freeze({
    PREPARED: "PREPARED",
    NOOP_ALREADY_PREPARED: "NOOP_ALREADY_PREPARED",
    ACTIVATED: "ACTIVATED",
    NOOP_ALREADY_ACTIVE: "NOOP_ALREADY_ACTIVE",
    PAUSED: "PAUSED",
    NOOP_ALREADY_PAUSED: "NOOP_ALREADY_PAUSED",
    LOCK_TIMEOUT: "LOCK_TIMEOUT",
    RUNTIME_UNAVAILABLE: "RUNTIME_UNAVAILABLE",
    STOP_CONFIG_ABSENT: "STOP_CONFIG_ABSENT",
    STOP_CONFIG_MALFORMED: "STOP_CONFIG_MALFORMED",
    STOP_UNEXPECTED_MODE: "STOP_UNEXPECTED_MODE",
    STOP_PREREQUISITE_NOT_READY: "STOP_PREREQUISITE_NOT_READY",
    STOP_ACCOUNT_NOT_READY: "STOP_ACCOUNT_NOT_READY",
    STOP_RECONCILIATION: "STOP_RECONCILIATION",
    STOP_IDENTITY_INVALID: "STOP_IDENTITY_INVALID",
    STOP_CONFIG_WRITE_FAILED: "STOP_CONFIG_WRITE_FAILED",
    STOP_CONFIG_READBACK_MISMATCH: "STOP_CONFIG_READBACK_MISMATCH"
  }),
  CODES: Object.freeze({
    PROPERTY_UNAVAILABLE: "CONFIG_PROPERTY_UNAVAILABLE",
    PROPERTY_MALFORMED: "CONFIG_PROPERTY_MALFORMED",
    TIMESTAMP_INVALID: "ACTIVATION_TIMESTAMP_INVALID",
    UUID_UNAVAILABLE: "ACTIVATION_UUID_UNAVAILABLE"
  })
});

function singleCommitControlResult_(status, fields) {
  return Object.assign({
    status: status, code: "", detail: "", writes: { sheets: 0, config: 0 },
    config: null, evidence: null
  }, fields || {});
}

// Exact five-field config surface reported on every classification.
function singleCommitControlConfigFields_(config) {
  return { contractVersion: config.contractVersion, mode: config.mode,
    activationID: config.activationID, activatedAt: config.activatedAt,
    configVersion: config.configVersion };
}

// Zero-write authoritative read of the one control-plane property, through
// the same frozen parser/validator the write gates use. Never repairs,
// never defaults, never classifies an unreadable/malformed value as a mode.
function singleCommitControlReadPropertyState_(properties) {
  var contract = SINGLE_COMMIT_TRANSACTION_V1, control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL;
  var raw;
  try { raw = properties.getProperty(contract.CONFIG_PROPERTY); }
  catch (error) {
    return { kind: "ERROR", code: control.CODES.PROPERTY_UNAVAILABLE,
      detail: error && error.message ? String(error.message) : "" };
  }
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { kind: "ABSENT", config: null };
  }
  var state = singleCommitTransactionConfigState_(raw);
  if (state.state === "VALID") return { kind: "VALID", config: state.config };
  return { kind: "INVALID", code: control.CODES.PROPERTY_MALFORMED,
    detail: String(state.detail || "CONFIG_INVALID") };
}

// ===========================================================================
// 1. PREP WRITER — establish the persisted PREPARED state. Config-only:
//    §20 freezes zero schema changes, so there are no sheets to create and
//    no account prerequisite here (§21 order: 1040 creation is step 4 and
//    activation is step 6 — PREP is legal before 1040 exists, while ACTIVE
//    stays impossible because the activation writer enforces 1040 itself).
//    Exactly one setProperty when legitimate; never downgrades a non-PREPARED
//    mode; never repairs a malformed value; never activates.
// ===========================================================================
function singleCommitPreparationApplyWithRuntime_(runtime) {
  var contract = SINGLE_COMMIT_TRANSACTION_V1, control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL,
    status = control.STATUS;
  if (!runtime || !runtime.properties) {
    return singleCommitControlResult_(status.RUNTIME_UNAVAILABLE, { detail: "RUNTIME_INCOMPLETE" });
  }
  var read = singleCommitControlReadPropertyState_(runtime.properties);
  if (read.kind === "ERROR" || read.kind === "MALFORMED" || read.kind === "INVALID") {
    return singleCommitControlResult_(status.STOP_CONFIG_MALFORMED, {
      code: read.code || "", detail: read.kind === "INVALID" ?
        "EXISTING_CONFIG_INVALID:" + String(read.detail) : String(read.detail || "") });
  }
  if (read.kind === "VALID") {
    // A valid non-PREPARED mode is never downgraded, paused or activated here.
    if (read.config.mode !== control.PREPARED_MODE) {
      return singleCommitControlResult_(status.STOP_UNEXPECTED_MODE, {
        detail: "EXISTING_MODE_" + String(read.config.mode),
        config: singleCommitControlConfigFields_(read.config) });
    }
    // Idempotent: a correct PREPARED state re-runs with ZERO writes (no
    // configVersion inflation, no identity ever produced here).
    return singleCommitControlResult_(status.NOOP_ALREADY_PREPARED, {
      config: singleCommitControlConfigFields_(read.config) });
  }
  // ABSENT -> write the frozen default exactly once.
  var prepared = { mode: control.PREPARED_MODE,
    contractVersion: contract.CONTRACT_VERSION,
    activationID: "", activatedAt: "",
    configVersion: contract.CONFIG_VERSION };
  var validation = validateSingleCommitTransactionConfig_(prepared);
  if (validation.status !== "PASS") {
    return singleCommitControlResult_(status.STOP_CONFIG_READBACK_MISMATCH, {
      detail: "PLAN_" + String((validation.errors[0] || {}).code || "CONFIG_INVALID") });
  }
  var payload;
  try { payload = JSON.stringify(prepared); }
  catch (error) {
    return singleCommitControlResult_(status.STOP_CONFIG_WRITE_FAILED, { detail: "SERIALIZE_FAILED" });
  }
  try {
    runtime.properties.setProperty(contract.CONFIG_PROPERTY, payload);
  } catch (error) {
    return singleCommitControlResult_(status.STOP_CONFIG_WRITE_FAILED, {
      detail: String(error && error.message || error) });
  }
  var result = singleCommitControlResult_(status.PREPARED);
  result.writes.config = 1;
  // Exact readback through the normal reader before any PREPARED claim.
  var verify = singleCommitControlReadPropertyState_(runtime.properties);
  var written = verify.kind === "VALID" ? verify.config : null;
  if (!written || written.mode !== prepared.mode ||
      written.contractVersion !== prepared.contractVersion ||
      written.activationID !== prepared.activationID ||
      written.activatedAt !== prepared.activatedAt ||
      written.configVersion !== prepared.configVersion) {
    result.status = status.STOP_CONFIG_READBACK_MISMATCH;
    result.detail = "CONFIG_READBACK";
    result.config = null;
    return result;
  }
  result.config = singleCommitControlConfigFields_(written);
  return result;
}

// ===========================================================================
// 2. ACTIVATION WRITER — the ONLY PREPARED -> ACTIVE transition. One
//    ScriptLock; every revalidation runs INSIDE the lock before the single
//    config write. Read-only preflight over the spreadsheet/properties; the
//    sole mutation is one setProperty of the frozen five-field object.
//    NEVER creates 1040, NEVER writes a ledger/business/event row, NEVER
//    clears the transitional 24,000 (§18/U10), NEVER invokes a transaction
//    writer, NEVER touches history.
// ===========================================================================

// Zero-write preflight (T11.2 §24 / task F): (3) T11 schema + operation
// authorities, (4)-(7) exact account authority, (8) compatible Sales V2
// state, (9)-(11) T5/reader prerequisites + unexplained 1030 residual 0,
// (12) transitional 24,000 explainable — LedgerNet1030 != 0 is ACCEPTABLE,
// (13) compatible Treasury config, (14) schema/config integrity (readbacks).
function singleCommitActivationPreflight_(runtime) {
  var control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL, status = control.STATUS;
  function stop(code, detail) { return { status: "FAIL", code: code, detail: detail }; }
  var ss = runtime.spreadsheet;
  // (3) T11 operation/schema authorities ready: the three domain schema gates
  // (pure header reads) + the operations store headers.
  var schemaProblems = [];
  try {
    var salesSchema = salesRecognitionV2SaveSchemaGate_(ss);
    if (salesSchema.status !== "PASS") {
      schemaProblems.push("SALES:" + (salesSchema.badSheets || []).join("|"));
    }
  } catch (error) { schemaProblems.push("SALES:" + String(error && error.message || error)); }
  try {
    var expenseSchema = expenseSingleCommitSchemaGate_(ss);
    if (expenseSchema.status !== "PASS") {
      schemaProblems.push("EXPENSE:" + (expenseSchema.badSheets || []).join("|"));
    }
  } catch (error) { schemaProblems.push("EXPENSE:" + String(error && error.message || error)); }
  try {
    var purchaseSchema = purchaseSingleCommitSchemaGate_(ss);
    if (purchaseSchema.status !== "PASS") {
      schemaProblems.push("PURCHASE:" + (purchaseSchema.badSheets || []).join("|"));
    }
  } catch (error) { schemaProblems.push("PURCHASE:" + String(error && error.message || error)); }
  try {
    var ops = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS;
    readCanonicalTable(ss, ops.SHEET, ops.HEADERS);
  } catch (error) { schemaProblems.push("OPERATIONS:" + String(error && error.message || error)); }
  if (schemaProblems.length) {
    return stop(status.STOP_PREREQUISITE_NOT_READY, "SCHEMA:" + schemaProblems.join(","));
  }
  // (4)-(7) Accounts authority: 1040 exact §11 (U5/U7 sequencing: row must
  // exist by activation), 6210 Policy C shape, 1030 clearing, 4000 Revenue.
  var accountRows;
  try {
    accountRows = readCanonicalTable(ss, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  } catch (error) {
    return stop(status.STOP_ACCOUNT_NOT_READY, "ACCOUNTS:" + String(error && error.message || error));
  }
  var money = preflightSingleCommitMoneyAccount(accountRows);
  if (money.status !== "PASS") {
    var moneyError = money.errors[0] || {};
    return stop(status.STOP_ACCOUNT_NOT_READY,
      "1040:" + String(moneyError.code || "ACCOUNT_INVALID"));
  }
  var expectations = salesRecognitionAccountExpectations_().filter(function(expected) {
    return expected.AccountCode === "1030" || expected.AccountCode === "4000";
  });
  var accountProblems = [];
  expectations.forEach(function(expected) {
    var matches = accountRows.filter(function(row) {
      return row && typeof row === "object" && !Array.isArray(row) &&
        String(row.AccountCode === undefined || row.AccountCode === null ? "" :
          row.AccountCode).trim() === expected.AccountCode;
    });
    if (matches.length !== 1) {
      accountProblems.push(expected.AccountCode + ":" +
        (matches.length ? "DUPLICATE" : "ABSENT"));
      return;
    }
    if (!isCanonicalActive(matches[0].IsActive)) {
      accountProblems.push(expected.AccountCode + ":INACTIVE");
      return;
    }
    if (salesRecognitionAccountFieldMismatch_(matches[0], expected)) {
      accountProblems.push(expected.AccountCode + ":METADATA_MISMATCH");
    }
  });
  // 6210 = Policy C prospective debit authority: unique, active, Expense/DEBIT
  // (exact shape frozen by the U3 preflight).
  var debitRows = accountRows.filter(function(row) {
    return row && typeof row === "object" &&
      String(row.AccountCode === undefined || row.AccountCode === null ? "" :
        row.AccountCode).trim() === "6210";
  });
  if (debitRows.length !== 1) {
    accountProblems.push("6210:" + (debitRows.length ? "DUPLICATE" : "ABSENT"));
  } else if (!isCanonicalActive(debitRows[0].IsActive)) {
    accountProblems.push("6210:INACTIVE");
  } else if (String(debitRows[0].AccountType || "").trim() !== "Expense" ||
      String(debitRows[0].NormalBalance || "").trim() !== "DEBIT") {
    accountProblems.push("6210:METADATA_MISMATCH");
  }
  if (accountProblems.length) {
    return stop(status.STOP_ACCOUNT_NOT_READY, accountProblems.join(","));
  }
  // (8) Sales V2 compatible state: the SEPARATE SALES_RECOGNITION_V2 config
  // must be VALID + ACTIVE (never overloaded with this key).
  var v2Raw = null;
  try { v2Raw = runtime.properties.getProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY); }
  catch (error) { return stop(status.STOP_PREREQUISITE_NOT_READY, "SALES_V2_UNREADABLE"); }
  var v2State = singleCommitV2ConfigCompatible_(v2Raw);
  if (v2State !== "ACTIVE") {
    return stop(status.STOP_PREREQUISITE_NOT_READY, "SALES_V2:" + v2State);
  }
  // (9) T5 / reader prerequisites: both projection builders must run clean.
  var reconciliation = null, exposure = null;
  try { exposure = buildTreasuryClearingProjection_(ss, {}); }
  catch (error) {
    return stop(status.STOP_PREREQUISITE_NOT_READY, "T5:" + String(error && error.message || error));
  }
  try { reconciliation = buildTreasury1030Reconciliation_(ss, {}); }
  catch (error) {
    return stop(status.STOP_PREREQUISITE_NOT_READY,
      "RECONCILIATION:" + String(error && error.message || error));
  }
  // (10) aggregate-money reader recognizes 1040 (§12 legacy ∪ {1040}).
  if (typeof AGGREGATE_MONEY_ACCOUNT_CODES === "undefined" ||
      AGGREGATE_MONEY_ACCOUNT_CODES.indexOf("1040") === -1) {
    return stop(status.STOP_PREREQUISITE_NOT_READY, "AGGREGATE_1040_MISSING");
  }
  // (11) unexplained 1030 residual MUST be 0. (12) A non-zero LedgerNet1030
  // (transitional 24,000) is explainable and NEVER a blocker — this gate
  // never compares ledgerNet1030 against 0.
  if (Number(reconciliation.unexplainedResidual) !== 0 ||
      String(reconciliation.reconciliationStatus) !== "OK") {
    return stop(status.STOP_RECONCILIATION,
      "RESIDUAL:" + String(reconciliation.unexplainedResidual) +
      ";STATUS:" + String(reconciliation.reconciliationStatus));
  }
  // (13) Treasury compatible config: absent or valid, never malformed.
  var treasuryRaw = null;
  try { treasuryRaw = runtime.properties.getProperty(TREASURY_RECEIPT_V1_CONTRACT.CONFIG_PROPERTY); }
  catch (error) { return stop(status.STOP_PREREQUISITE_NOT_READY, "TREASURY_UNREADABLE"); }
  if (treasuryRaw !== null && treasuryRaw !== undefined && String(treasuryRaw).trim() !== "") {
    var treasuryState = treasuryReceiptConfigFromRaw(treasuryRaw);
    if (!treasuryState || treasuryState.status !== "PASS") {
      return stop(status.STOP_PREREQUISITE_NOT_READY, "TREASURY_CONFIG_INVALID");
    }
  }
  return { status: "PASS", code: "", detail: "", evidence: {
    ledgerNet1030: Number(reconciliation.ledgerNet1030) || 0,
    outstandingTotal: Number(reconciliation.outstandingTotal) || 0,
    explicitExceptionAmount: Number(reconciliation.explicitExceptionAmount) || 0,
    unexplainedResidual: Number(reconciliation.unexplainedResidual) || 0,
    reconciliationStatus: String(reconciliation.reconciliationStatus),
    recognizedExposure: exposure && exposure.totals ?
      Number(exposure.totals.recognizedExposure) || 0 : 0,
    aggregateMoneyAccounts: AGGREGATE_MONEY_ACCOUNT_CODES.join(","),
    salesV2Mode: "ACTIVE"
  } };
}

// Sales V2 compatibility classifier (separate config key, read-only).
function singleCommitV2ConfigCompatible_(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return "ABSENT";
  var parsed;
  try { parsed = JSON.parse(String(raw)); }
  catch (error) { return "MALFORMED"; }
  if (validateSalesRecognitionV2Config(parsed).status !== "PASS") return "INVALID";
  return parsed.mode === "ACTIVE" ? "ACTIVE" : String(parsed.mode);
}

// Activation core. Never acquires a lock (the public entry owns the single
// ScriptLock) and never writes anything except the single ACTIVE config
// property, only after every revalidation above passed inside that lock.
function singleCommitActivationApplyWithRuntime_(runtime) {
  var contract = SINGLE_COMMIT_TRANSACTION_V1, control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL,
    status = control.STATUS;
  if (!runtime || !runtime.properties || !runtime.spreadsheet) {
    return singleCommitControlResult_(status.RUNTIME_UNAVAILABLE, { detail: "RUNTIME_INCOMPLETE" });
  }
  // (1) The ONLY config read in the activation path; runs under the lock.
  var read = singleCommitControlReadPropertyState_(runtime.properties);
  if (read.kind === "ERROR" || read.kind === "MALFORMED" || read.kind === "INVALID") {
    return singleCommitControlResult_(status.STOP_CONFIG_MALFORMED, {
      code: read.code || "",
      detail: read.kind === "INVALID" ? "EXISTING_CONFIG_INVALID:" + String(read.detail) :
        String(read.detail || "") });
  }
  if (read.kind === "ABSENT") {
    return singleCommitControlResult_(status.STOP_CONFIG_ABSENT, { detail: "CONFIG_ABSENT" });
  }
  var current = read.config;
  // Idempotency: an exact ACTIVE already carries a durable identity — return
  // it untouched, never a second ActivationID, never a version increment.
  if (current.mode === control.ACTIVE_MODE) {
    return singleCommitControlResult_(status.NOOP_ALREADY_ACTIVE, {
      config: singleCommitControlConfigFields_(current) });
  }
  // Only PREPARED may activate. PAUSED/REJECT fail closed; no re-activation
  // path exists (sticky intent: history is never re-authored).
  if (current.mode !== control.PREPARED_MODE) {
    return singleCommitControlResult_(status.STOP_UNEXPECTED_MODE, {
      detail: "EXISTING_MODE_" + String(current.mode),
      config: singleCommitControlConfigFields_(current) });
  }
  // (2)-(14) contractVersion exact (validated parser) + full revalidation.
  if (current.contractVersion !== contract.CONTRACT_VERSION) {
    return singleCommitControlResult_(status.STOP_UNEXPECTED_MODE, {
      detail: "WRONG_CONTRACT:" + String(current.contractVersion) });
  }
  var preflight = singleCommitActivationPreflight_(runtime);
  if (preflight.status !== "PASS") {
    return singleCommitControlResult_(preflight.code, { detail: preflight.detail });
  }
  // Server identity, generated BEFORE the mutation: uuid + now, never from a
  // caller argument (the public entry takes no parameters).
  var activationID = "";
  try { activationID = control.ACTIVATION_PREFIX + String(runtime.uuid()); }
  catch (error) {
    return singleCommitControlResult_(status.STOP_IDENTITY_INVALID, {
      detail: "UUID:" + String(error && error.message || error) });
  }
  if (activationID.length <= control.ACTIVATION_PREFIX.length || activationID.trim() === "") {
    return singleCommitControlResult_(status.STOP_IDENTITY_INVALID, { detail: "UUID_EMPTY" });
  }
  var activatedAt = "";
  try {
    var now = runtime.now();
    activatedAt = now instanceof Date ? now.toISOString() : String(now);
  } catch (error) {
    return singleCommitControlResult_(status.STOP_IDENTITY_INVALID, {
      detail: "NOW:" + String(error && error.message || error) });
  }
  if (!activatedAt || activatedAt.trim() === "" ||
      salesRecognitionIsoTimestampEpoch_(activatedAt) === null) {
    return singleCommitControlResult_(status.STOP_IDENTITY_INVALID, {
      code: control.CODES.TIMESTAMP_INVALID, detail: "TIMESTAMP_EMPTY_OR_INVALID" });
  }
  // configVersion follows the frozen scheme: carried forward, never bumped
  // (T10.5 §12 / 97E precedent — no second scheme introduced here).
  var nextConfigVersion = current.configVersion;
  if (typeof nextConfigVersion !== "number" || !isFinite(nextConfigVersion) ||
      nextConfigVersion < 1 || Math.floor(nextConfigVersion) !== nextConfigVersion) {
    return singleCommitControlResult_(status.STOP_IDENTITY_INVALID, {
      detail: "CONFIG_VERSION_INVALID" });
  }
  var activated = { mode: control.ACTIVE_MODE,
    contractVersion: contract.CONTRACT_VERSION,
    activationID: activationID, activatedAt: activatedAt,
    configVersion: nextConfigVersion };
  var validation = validateSingleCommitTransactionConfig_(activated);
  if (validation.status !== "PASS") {
    return singleCommitControlResult_(status.STOP_IDENTITY_INVALID, {
      detail: "PLAN_" + String((validation.errors[0] || {}).code || "CONFIG_INVALID") });
  }
  var payload;
  try { payload = JSON.stringify(activated); }
  catch (error) {
    return singleCommitControlResult_(status.STOP_CONFIG_WRITE_FAILED, { detail: "SERIALIZE_FAILED" });
  }
  // THE single config write of this function — one key, one time, only after
  // every frozen revalidation passed inside the lock.
  try {
    runtime.properties.setProperty(contract.CONFIG_PROPERTY, payload);
  } catch (error) {
    return singleCommitControlResult_(status.STOP_CONFIG_WRITE_FAILED, {
      detail: String(error && error.message || error) });
  }
  var result = singleCommitControlResult_(status.ACTIVATED);
  result.writes.config = 1;
  // Exact readback before any ACTIVE claim; the operation row of a later
  // crash converges here (ALREADY_ACTIVE) with the SAME identity.
  var verify = singleCommitControlReadPropertyState_(runtime.properties);
  var written = verify.kind === "VALID" ? verify.config : null;
  if (!written || written.mode !== activated.mode ||
      written.contractVersion !== activated.contractVersion ||
      written.activationID !== activated.activationID ||
      written.activatedAt !== activated.activatedAt ||
      written.configVersion !== activated.configVersion) {
    result.status = status.STOP_CONFIG_READBACK_MISMATCH;
    result.detail = "READBACK_FIELD_MISMATCH";
    result.config = null;
    return result;
  }
  if (written.mode !== control.ACTIVE_MODE) {
    result.status = status.STOP_CONFIG_READBACK_MISMATCH;
    result.detail = "MODE_NOT_ACTIVE";
    result.config = null;
    return result;
  }
  result.config = singleCommitControlConfigFields_(written);
  result.evidence = preflight.evidence || null;
  return result;
}

// ===========================================================================
// 3. PAUSE WRITER — the §22 behavioral rollback flip ACTIVE -> PAUSED.
//    Control-plane only: preserves the activation identity/history, carries
//    configVersion forward, never rolls back committed data, never touches a
//    transaction/ledger sheet, no RBAC. Reactivation from PAUSED is NOT
//    frozen by T11.2 (§21 defines one PREPARED -> ACTIVE activation) and is
//    deliberately deferred to a future owner-authorized unit — no resume
//    function exists here.
// ===========================================================================
function singleCommitPauseApplyWithRuntime_(runtime) {
  var contract = SINGLE_COMMIT_TRANSACTION_V1, control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL,
    status = control.STATUS;
  if (!runtime || !runtime.properties) {
    return singleCommitControlResult_(status.RUNTIME_UNAVAILABLE, { detail: "RUNTIME_INCOMPLETE" });
  }
  var read = singleCommitControlReadPropertyState_(runtime.properties);
  if (read.kind === "ERROR" || read.kind === "MALFORMED" || read.kind === "INVALID") {
    return singleCommitControlResult_(status.STOP_CONFIG_MALFORMED, {
      code: read.code || "",
      detail: read.kind === "INVALID" ? "EXISTING_CONFIG_INVALID:" + String(read.detail) :
        String(read.detail || "") });
  }
  if (read.kind === "ABSENT") {
    return singleCommitControlResult_(status.STOP_CONFIG_ABSENT, { detail: "CONFIG_ABSENT" });
  }
  var current = read.config;
  if (current.mode === control.PAUSED_MODE) {
    return singleCommitControlResult_(status.NOOP_ALREADY_PAUSED, {
      config: singleCommitControlConfigFields_(current) });
  }
  // Only ACTIVE may pause: PAUSED exists exclusively after activation
  // (sticky identity), and a never-activated PREPARED/REJECT is untouched.
  if (current.mode !== control.ACTIVE_MODE) {
    return singleCommitControlResult_(status.STOP_UNEXPECTED_MODE, {
      detail: "EXISTING_MODE_" + String(current.mode),
      config: singleCommitControlConfigFields_(current) });
  }
  // Preserve activation identity + version; only the mode flips (§22).
  var paused = { mode: control.PAUSED_MODE,
    contractVersion: current.contractVersion,
    activationID: current.activationID, activatedAt: current.activatedAt,
    configVersion: current.configVersion };
  var validation = validateSingleCommitTransactionConfig_(paused);
  if (validation.status !== "PASS") {
    return singleCommitControlResult_(status.STOP_IDENTITY_INVALID, {
      detail: "PLAN_" + String((validation.errors[0] || {}).code || "CONFIG_INVALID") });
  }
  var payload;
  try { payload = JSON.stringify(paused); }
  catch (error) {
    return singleCommitControlResult_(status.STOP_CONFIG_WRITE_FAILED, { detail: "SERIALIZE_FAILED" });
  }
  try {
    runtime.properties.setProperty(contract.CONFIG_PROPERTY, payload);
  } catch (error) {
    return singleCommitControlResult_(status.STOP_CONFIG_WRITE_FAILED, {
      detail: String(error && error.message || error) });
  }
  var result = singleCommitControlResult_(status.PAUSED);
  result.writes.config = 1;
  var verify = singleCommitControlReadPropertyState_(runtime.properties);
  var written = verify.kind === "VALID" ? verify.config : null;
  if (!written || written.mode !== paused.mode ||
      written.activationID !== paused.activationID ||
      written.activatedAt !== paused.activatedAt ||
      written.configVersion !== paused.configVersion) {
    result.status = status.STOP_CONFIG_READBACK_MISMATCH;
    result.detail = "READBACK_FIELD_MISMATCH";
    result.config = null;
    return result;
  }
  result.config = singleCommitControlConfigFields_(written);
  return result;
}

// ---------------------------------------------------------------------------
// Production runtime factories. Never invoked by local tests (fixture-injected
// cores cover every gate). Identity comes from the canonical resolver; the
// clock and uuid factories produce server-side activation identity.
// ---------------------------------------------------------------------------
function singleCommitPreparationRuntime_() {
  return { properties: PropertiesService.getScriptProperties() };
}

function singleCommitActivationRuntime_() {
  return {
    spreadsheet: requireNumlockProductionSpreadsheet(),
    properties: PropertiesService.getScriptProperties(),
    now: function() { return new Date(); },
    uuid: function() { return String(Utilities.getUuid()); }
  };
}

function singleCommitPauseRuntime_() {
  return { properties: PropertiesService.getScriptProperties() };
}

// Public entries (Apps Script editor / Execution API). Each is the ONLY outer
// lock: acquired before any config read/write, released exactly once in
// finally. Lock or runtime failure returns before any mutation. Zero
// parameters — no client can choose the mode, the ActivationID or the
// timestamp. Never callable from a business write path; never invoked by
// application load.
function singleCommitControlLockedRun_(runtimeFactory, core) {
  var control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL;
  var runtime;
  try { runtime = runtimeFactory(); }
  catch (error) {
    return singleCommitControlResult_(control.STATUS.RUNTIME_UNAVAILABLE,
      { detail: String(error && error.message || error) });
  }
  var lock = null, acquired = false;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return singleCommitControlResult_(control.STATUS.LOCK_TIMEOUT,
      { detail: String(error && error.message || error) });
  }
  try {
    return core(runtime);
  } finally {
    if (acquired) {
      try { lock.releaseLock(); } catch (lockError) { /* lock auto-expires */ }
    }
  }
}

function prepareSingleCommitTransactionV1Production() {
  return singleCommitControlLockedRun_(singleCommitPreparationRuntime_,
    singleCommitPreparationApplyWithRuntime_);
}

function activateSingleCommitTransactionV1Production() {
  return singleCommitControlLockedRun_(singleCommitActivationRuntime_,
    singleCommitActivationApplyWithRuntime_);
}

function pauseSingleCommitTransactionV1Production() {
  return singleCommitControlLockedRun_(singleCommitPauseRuntime_,
    singleCommitPauseApplyWithRuntime_);
}
