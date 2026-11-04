// SALES_RECOGNITION_V2 U10 activation capability: single-purpose PREPARED ->
// ACTIVE config writer. Exactly one logical Script Properties mutation that
// atomically establishes server-generated ActivationID + server T. Reuses U1
// config validation, U2 schema gate, and U1 account preflight. Never creates
// Orders/OrderLines/RecognitionEvents/Audits/BalanceLedger/Payments/
// Settlements/InventoryLedger. No generic config editor, no pause/resume/
// disable API. Client cannot supply T or ActivationID. Idempotent reinvocation
// after exact activation returns ALREADY_ACTIVE without a write.
var SALES_V2_ACTIVATION = Object.freeze({
  ACTIVE_MODE: "ACTIVE",
  PREPARED_MODE: "PREPARED",
  STATUS: Object.freeze({
    ACTIVATED: "ACTIVATED",
    ALREADY_ACTIVE: "ALREADY_ACTIVE",
    REFUSED: "REFUSED"
  }),
  CODES: Object.freeze({
    RUNTIME_UNAVAILABLE: "ACTIVATION_RUNTIME_UNAVAILABLE",
    LOCK_UNAVAILABLE: "ACTIVATION_LOCK_UNAVAILABLE",
    PROPERTY_UNAVAILABLE: "ACTIVATION_PROPERTY_UNAVAILABLE",
    PROPERTY_MALFORMED: "ACTIVATION_PROPERTY_MALFORMED",
    NOT_PREPARED: "ACTIVATION_NOT_PREPARED",
    METADATA_PRESENT: "ACTIVATION_METADATA_PRESENT",
    WRONG_CONTRACT: "ACTIVATION_WRONG_CONTRACT",
    ACTIVE_MALFORMED: "ACTIVATION_ACTIVE_MALFORMED",
    CONFLICTING_STATE: "ACTIVATION_CONFLICTING_STATE",
    SCHEMA_NOT_READY: "SALES_V2_SCHEMA_NOT_READY",
    ACCOUNT_PREFLIGHT_FAILED: "ACCOUNT_PREFLIGHT_FAILED",
    UNEXPECTED_V2_ARTIFACTS: "ACTIVATION_UNEXPECTED_V2_ARTIFACTS",
    TIMESTAMP_INVALID: "ACTIVATION_TIMESTAMP_INVALID",
    WRITE_FAILED: "ACTIVATION_WRITE_FAILED",
    READBACK_FAILED: "ACTIVATION_READBACK_FAILED",
    READBACK_MISMATCH: "ACTIVATION_READBACK_MISMATCH"
  })
});

function salesRecognitionV2ActivationResult_(status, fields) {
  return Object.assign({
    status: status, code: "", detail: "", config: null
  }, fields || {});
}

// Read the authoritative Script Property without masking parse/validation
// failures. Absent/blank -> the U1 default PREPARED (nothing supersedes it).
function salesRecognitionV2ActivationReadPropertyState_(properties) {
  var raw;
  try { raw = properties.getProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY); }
  catch (error) {
    return { kind: "ERROR", code: SALES_V2_ACTIVATION.CODES.PROPERTY_UNAVAILABLE,
      detail: error && error.message ? String(error.message) : "" };
  }
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { kind: "ABSENT", config: salesRecognitionV2DefaultConfig() };
  }
  var parsed;
  try { parsed = JSON.parse(String(raw)); }
  catch (error) {
    return { kind: "MALFORMED", code: SALES_V2_ACTIVATION.CODES.PROPERTY_MALFORMED,
      detail: error && error.message ? String(error.message) : "" };
  }
  var validation = validateSalesRecognitionV2Config(parsed);
  if (validation.status !== "PASS") {
    var first = validation.errors[0] || {};
    var code = SALES_V2_ACTIVATION.CODES.CONFLICTING_STATE;
    if (first.code === SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES.CONTRACT_VERSION_MISMATCH) {
      code = SALES_V2_ACTIVATION.CODES.WRONG_CONTRACT;
    } else if (first.code === SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES.ACTIVATION_METADATA_PRESENT) {
      code = SALES_V2_ACTIVATION.CODES.METADATA_PRESENT;
    } else if (first.code === SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES.ACTIVATION_METADATA_MISSING) {
      code = SALES_V2_ACTIVATION.CODES.ACTIVE_MALFORMED;
    }
    return { kind: "INVALID", code: code, detail: first.code || "CONFIG_INVALID" };
  }
  return { kind: "VALID", config: parsed };
}

// Zero-write activation preflight: U2 schema gate, U1 account preflight, then
// Events/Audits/V2-operation emptiness. Any failure blocks the write.
function salesRecognitionV2ActivationPreflight_(runtime) {
  var contract = SALES_RECOGNITION_V2_CONTRACT, save = SALES_RECOGNITION_V2_SAVE,
    t = TRANSACTION_PRODUCTION_CONTRACT, act = SALES_V2_ACTIVATION;
  var schema = salesRecognitionV2SaveSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return { status: "FAIL", code: act.CODES.SCHEMA_NOT_READY,
      detail: (schema.badSheets || []).join(",") };
  }
  var accountRows;
  try {
    accountRows = readCanonicalTable(runtime.spreadsheet, "Accounts",
      CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  } catch (error) {
    return { status: "FAIL", code: act.CODES.ACCOUNT_PREFLIGHT_FAILED,
      detail: error && error.message ? String(error.message) : "" };
  }
  var accounts = preflightSalesRecognitionAccounts(accountRows);
  if (accounts.status !== "PASS") {
    var first = accounts.errors[0] || {};
    return { status: "FAIL", code: act.CODES.ACCOUNT_PREFLIGHT_FAILED,
      detail: first.code || "ACCOUNT_ABSENT",
      field: first.accountCode || "" };
  }
  var events, audits, operations;
  try {
    events = readCanonicalTable(runtime.spreadsheet, contract.SHEET, contract.HEADERS);
    audits = readCanonicalTable(runtime.spreadsheet, save.AUDIT_SHEET, save.AUDIT_HEADERS);
    operations = readCanonicalTable(runtime.spreadsheet, t.OPERATIONS.SHEET, t.OPERATIONS.HEADERS);
  } catch (error) {
    return { status: "FAIL", code: act.CODES.UNEXPECTED_V2_ARTIFACTS,
      detail: error && error.message ? String(error.message) : "" };
  }
  if (events.length !== 0) {
    return { status: "FAIL", code: act.CODES.UNEXPECTED_V2_ARTIFACTS,
      detail: "EVENTS_NOT_EMPTY:" + events.length };
  }
  if (audits.length !== 0) {
    return { status: "FAIL", code: act.CODES.UNEXPECTED_V2_ARTIFACTS,
      detail: "AUDITS_NOT_EMPTY:" + audits.length };
  }
  var v2Ops = operations.filter(function(row) {
    return row && SALES_V2_OPERATOR.V2_OPERATION_TYPES.indexOf(String(row.OperationType)) !== -1;
  });
  if (v2Ops.length !== 0) {
    return { status: "FAIL", code: act.CODES.UNEXPECTED_V2_ARTIFACTS,
      detail: "V2_OPERATIONS_NOT_EMPTY:" + v2Ops.length };
  }
  return { status: "PASS" };
}

// Core activation. Outer wrapper owns the ScriptLock. Never accepts client
// ActivationID/T; only the runtime clock and uuid factories produce identity.
function salesRecognitionV2ActivateWithRuntime_(runtime) {
  var act = SALES_V2_ACTIVATION, contract = SALES_RECOGNITION_V2_CONTRACT;
  function refused(code, detail, field) {
    return salesRecognitionV2ActivationResult_(act.STATUS.REFUSED, {
      code: code, detail: detail || "", field: field || "" });
  }
  if (!runtime || !runtime.properties || !runtime.spreadsheet) {
    return refused(act.CODES.RUNTIME_UNAVAILABLE, "RUNTIME_INCOMPLETE");
  }
  var state = salesRecognitionV2ActivationReadPropertyState_(runtime.properties);
  if (state.kind === "ERROR") return refused(state.code, state.detail);
  if (state.kind === "MALFORMED") return refused(state.code, state.detail);
  if (state.kind === "INVALID") return refused(state.code, state.detail);
  var current = state.config;
  if (state.kind === "VALID" && current.mode === act.ACTIVE_MODE) {
    // Exact activation already persisted: no new ID/T, no write.
    return salesRecognitionV2ActivationResult_(act.STATUS.ALREADY_ACTIVE, {
      config: { mode: current.mode, contractVersion: current.contractVersion,
        activationID: current.activationID, activatedAt: current.activatedAt,
        configVersion: current.configVersion } });
  }
  if (state.kind === "VALID" && current.mode !== act.PREPARED_MODE) {
    return refused(act.CODES.NOT_PREPARED, String(current.mode));
  }
  if (current.mode !== act.PREPARED_MODE) {
    return refused(act.CODES.NOT_PREPARED, String(current.mode));
  }
  if (current.activationID !== "" || current.activatedAt !== "") {
    return refused(act.CODES.METADATA_PRESENT, "PREPARED_WITH_EXISTING_METADATA");
  }
  if (current.contractVersion !== contract.CONTRACT_VERSION) {
    return refused(act.CODES.WRONG_CONTRACT, String(current.contractVersion));
  }
  var preflight = salesRecognitionV2ActivationPreflight_(runtime);
  if (preflight.status !== "PASS") {
    return refused(preflight.code, preflight.detail, preflight.field || "");
  }
  var now;
  try { now = runtime.now(); }
  catch (error) {
    return refused(act.CODES.TIMESTAMP_INVALID, error && error.message ? String(error.message) : "");
  }
  var activatedAt;
  try { activatedAt = now instanceof Date ? now.toISOString() : String(now); }
  catch (error) {
    return refused(act.CODES.TIMESTAMP_INVALID, "NOW_UNAVAILABLE");
  }
  var activationID;
  try { activationID = String(runtime.uuid()); }
  catch (error) {
    return refused(act.CODES.RUNTIME_UNAVAILABLE, "UUID_UNAVAILABLE");
  }
  if (!activationID || !activationID.trim()) {
    return refused(act.CODES.RUNTIME_UNAVAILABLE, "UUID_EMPTY");
  }
  var activated = {
    mode: act.ACTIVE_MODE,
    contractVersion: contract.CONTRACT_VERSION,
    activationID: activationID,
    activatedAt: activatedAt,
    configVersion: current.configVersion
  };
  var validation = validateSalesRecognitionV2Config(activated);
  if (validation.status !== "PASS") {
    var first = validation.errors[0] || {};
    if (first.code === contract.REFUSAL_CODES.ACTIVATION_TIMESTAMP_INVALID ||
        first.code === contract.REFUSAL_CODES.ACTIVATION_TIMESTAMP_FORBIDDEN) {
      return refused(act.CODES.TIMESTAMP_INVALID, first.code);
    }
    return refused(act.CODES.CONFLICTING_STATE, first.code || "CONFIG_INVALID");
  }
  var payload;
  try { payload = JSON.stringify(activated); }
  catch (error) {
    return refused(act.CODES.WRITE_FAILED, "SERIALIZE_FAILED");
  }
  try {
    runtime.properties.setProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY, payload);
  } catch (error) {
    return refused(act.CODES.WRITE_FAILED, error && error.message ? String(error.message) : "");
  }
  var readbackRaw;
  try { readbackRaw = runtime.properties.getProperty(SALES_V2_OPERATOR.CONFIG_PROPERTY); }
  catch (error) {
    return refused(act.CODES.READBACK_FAILED, error && error.message ? String(error.message) : "");
  }
  if (readbackRaw === null || readbackRaw === undefined || String(readbackRaw).trim() === "") {
    return refused(act.CODES.READBACK_FAILED, "READBACK_EMPTY");
  }
  var readback;
  try { readback = JSON.parse(String(readbackRaw)); }
  catch (error) {
    return refused(act.CODES.READBACK_FAILED, "READBACK_MALFORMED");
  }
  if (validateSalesRecognitionV2Config(readback).status !== "PASS") {
    return refused(act.CODES.READBACK_MISMATCH, "READBACK_INVALID");
  }
  var exact = readback.mode === activated.mode &&
    readback.contractVersion === activated.contractVersion &&
    readback.activationID === activated.activationID &&
    readback.activatedAt === activated.activatedAt &&
    readback.configVersion === activated.configVersion;
  if (!exact) return refused(act.CODES.READBACK_MISMATCH, "READBACK_FIELD_MISMATCH");
  return salesRecognitionV2ActivationResult_(act.STATUS.ACTIVATED, {
    config: { mode: readback.mode, contractVersion: readback.contractVersion,
      activationID: readback.activationID, activatedAt: readback.activatedAt,
      configVersion: readback.configVersion } });
}

// Production runtime factory. Never invoked by local tests (fixture-injected
// core covers every gate). Uses the authoritative production spreadsheet and
// the same ScriptLock class as the U2 durable save outer wrapper.
function salesRecognitionV2ActivateRuntime_() {
  var ss = requireNumlockProductionSpreadsheet();
  return {
    spreadsheet: ss,
    lock: LockService.getScriptLock(),
    now: function() { return new Date(); },
    uuid: function() { return String(Utilities.getUuid()); },
    properties: PropertiesService.getScriptProperties()
  };
}

// Public Execution-API entry: the ONLY outer lock, acquired before any config
// read/write. Takes no parameters — client cannot choose T or ActivationID.
function salesRecognitionV2Activate() {
  // ponytail: admin execution disabled; restore only with verified owner authorization.
  throw new Error("Administrative execution is disabled");

  var act = SALES_V2_ACTIVATION, runtime = null, acquired = false, result;
  try {
    runtime = salesRecognitionV2ActivateRuntime_();
  } catch (error) {
    return salesRecognitionV2ActivationResult_(act.STATUS.REFUSED, {
      code: act.CODES.RUNTIME_UNAVAILABLE,
      detail: error && error.message ? String(error.message) : "" });
  }
  try {
    runtime.lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return salesRecognitionV2ActivationResult_(act.STATUS.REFUSED, {
      code: act.CODES.LOCK_UNAVAILABLE,
      detail: error && error.message ? String(error.message) : "" });
  }
  try {
    result = salesRecognitionV2ActivateWithRuntime_(runtime);
  } finally {
    if (acquired) {
      try { runtime.lock.releaseLock(); } catch (ignoredRelease) { /* best effort */ }
    }
  }
  return result;
}
