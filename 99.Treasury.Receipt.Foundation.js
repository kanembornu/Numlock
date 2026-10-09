// Treasury T3 foundation for TREASURY_RECEIPT_V1: contract constants, exact
// sheet schemas with strict header validation, fail-closed config reader and
// mode classifier, destination-account eligibility, 1030 readiness preflight,
// Asia/Jakarta date authority, deterministic identity helpers, canonical
// journal signature, and the T3 error-catalog subset. Pure/read-only only:
// no receipt/operation/audit writer, no ledger or cash mutation, no account
// mutation, no config property write, no sheet creation. Authority:
// docs/TREASURY-T2-RECEIPT-AUTHORITY-AND-RECONCILIATION-CONTRACT.md
// (sections 4, 5, 6, 8, 9, 10, 21, 24).
var TREASURY_RECEIPT_V1_CONTRACT = Object.freeze({
  CONTRACT_VERSION: "TREASURY_RECEIPT_V1",
  CONFIG_PROPERTY: "TREASURY_RECEIPT_V1_CONFIG",
  MODES: Object.freeze(["PREPARED", "ACTIVE", "PAUSED"]),
  OPERATION_TYPES: Object.freeze(["TREASURY_RECEIPT_SAVE", "TREASURY_RECEIPT_REVERSE",
    "TREASURY_RECEIPT_CORRECT"]),
  SIDES: Object.freeze(["PRIMARY", "REVERSAL", "REPLACEMENT"]),
  RECEIPT_TYPES: Object.freeze(["SALES_RECEIPT", "SALES_RECEIPT_REVERSAL"]),
  OPERATION_STATES: Object.freeze(["IN_PROGRESS", "COMMITTED"]),
  POSTING_STATUS_COMMITTED: "COMMITTED",
  // ReceiptStatus is derived by projection, never stored (T2 section 4.1).
  RECEIPT_STATUS_DERIVED: Object.freeze(["ACTIVE", "REVERSED"]),
  RESPONSE_STATUS: Object.freeze(["DONE", "REFUSED", "CONFLICT", "UNKNOWN", "RECOVERY_REQUIRED"]),
  EVIDENCE_TYPE: "MANUAL_VERIFIED",
  MOVEMENT_TYPE: "TREASURY_RECEIPT",
  MOVEMENT_TYPE_REVERSAL: "TREASURY_RECEIPT_REVERSAL",
  SOURCE_TYPE: "TREASURY_RECEIPT_V1",
  CLEARING_ACCOUNT_CODE: "1030",
  CLEARING_CASH_FLOW_GROUP: "Operating",
  // Frozen cash-universe authority (40.Cash.Foundation.js) — never copied,
  // never inferred from account names.
  DESTINATION_ACCOUNT_CODES: CASH_FOUNDATION_POLICY.ACCOUNT_CODES,
  FORBIDDEN_JOURNAL_ACCOUNTS: Object.freeze(["4000", "5000", "1100", "2000", "2010", "6210"]),
  ID_PREFIXES: Object.freeze({
    OPERATION: "TROP-", RECEIPT: "TRC-", JOURNAL: "TRJ-", AUDIT: "TRA-", ACTIVATION: "TRACT-"
  }),
  TIMEZONE: CANONICAL_ENTRY.TIMEZONE,
  DATE_PATTERN: "yyyy-MM-dd",
  RECEIPT_DATE_FORMAT: "YYYY-MM-DD",
  SCHEMAS: Object.freeze({
    RECEIPTS: Object.freeze({
      SHEET: "TreasuryReceipts",
      HEADERS: Object.freeze(["TreasuryReceiptID", "ContractVersion", "OperationID", "RequestKey",
        "RecognitionID", "OrderID", "RevisionID", "ReceiptType", "DestinationAccountCode",
        "GrossAmount", "ReceiptDate", "EconomicDate", "ReceivedAt", "EvidenceType", "EvidenceRef",
        "JournalID", "JournalSignature", "PostingStatus", "OriginalReceiptID",
        "ReversalOfReceiptID", "ReplacementReceiptID", "Reason", "Actor", "SnapshotJSON"])
    }),
    OPERATIONS: Object.freeze({
      SHEET: "TreasuryOperations",
      HEADERS: Object.freeze(["TreasuryOperationID", "OperationType", "RecognitionID", "RequestKey",
        "State", "PayloadHash", "OperationPlan", "CreatedAt", "UpdatedAt", "LastError"])
    }),
    AUDITS: Object.freeze({
      SHEET: "TreasuryAudits",
      HEADERS: Object.freeze(["AuditID", "ContractVersion", "OperationID", "RequestKey",
        "TreasuryReceiptID", "RecognitionID", "OrderID", "JournalID", "PayloadHash", "Actor",
        "SavedAt"])
    })
  }),
  // Frozen T2 section 24 catalog, T3-relevant subset only. Exact codes — no aliases.
  ERROR_CODES: Object.freeze({
    CONFIG_INVALID: "TREASURY_CONFIG_INVALID",
    NOT_ACTIVATED: "TREASURY_NOT_ACTIVATED",
    MODE_PAUSED: "TREASURY_MODE_PAUSED",
    CONTRACT_VERSION_MISMATCH: "TREASURY_CONTRACT_VERSION_MISMATCH",
    CONFIG_VERSION_INVALID: "TREASURY_CONFIG_VERSION_INVALID",
    ACTIVATION_METADATA_PRESENT: "TREASURY_ACTIVATION_METADATA_PRESENT",
    ACTIVATION_METADATA_MISSING: "TREASURY_ACTIVATION_METADATA_MISSING",
    ACTIVATION_METADATA_INVALID: "TREASURY_ACTIVATION_METADATA_INVALID",
    SCHEMA_NOT_READY: "TREASURY_SCHEMA_NOT_READY",
    INVALID_DESTINATION_ACCOUNT: "TREASURY_INVALID_DESTINATION_ACCOUNT",
    DESTINATION_ACCOUNT_INACTIVE: "TREASURY_DESTINATION_ACCOUNT_INACTIVE",
    DESTINATION_IS_CLEARING: "TREASURY_DESTINATION_IS_CLEARING",
    FORBIDDEN_JOURNAL_ACCOUNT: "TREASURY_FORBIDDEN_JOURNAL_ACCOUNT",
    DATE_INVALID: "TREASURY_DATE_INVALID",
    TIMEZONE_INVALID: "TREASURY_TIMEZONE_INVALID",
    ECONOMIC_DATE_MISMATCH: "TREASURY_ECONOMIC_DATE_MISMATCH",
    PAYLOAD_INVALID: "TREASURY_PAYLOAD_INVALID"
  })
});

function treasuryContractError_(code, message) {
  var error = new Error(message);
  error.treasuryCode = code;
  return error;
}

// ---------------------------------------------------------------------------
// Config contract (T2 section 5). Validation only — this module never writes
// the config property and never activates anything.
// ---------------------------------------------------------------------------
function treasuryIsoUtcEpoch_(value) {
  if (typeof value !== "string") return null;
  var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?Z$/.exec(value);
  if (!match) return null;
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]),
    hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  var fraction = match[7] ? match[7].slice(1) : "";
  var millisecond = fraction ? Number((fraction + "000").slice(0, 3)) : 0;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31 ||
      hour > 23 || minute > 59 || second > 59) return null;
  var utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 ||
      utc.getUTCDate() !== day) return null;
  return utc.getTime();
}

// Fail-closed validator mirroring validateSalesRecognitionV2Config with the
// frozen Treasury codes: invalid config is rejected, never repaired, never
// defaulted, and never interpreted as ACTIVE.
function validateTreasuryReceiptConfig(config) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT, codes = contract.ERROR_CODES, errors = [];
  function error(field, code) { errors.push({ field: field, code: code }); }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    error("config", codes.CONFIG_INVALID);
    return { status: "FAIL", errors: errors };
  }
  var modeTypeInvalid = typeof config.mode !== "string";
  var mode = modeTypeInvalid ? "" : String(config.mode).trim();
  if (modeTypeInvalid || contract.MODES.indexOf(mode) === -1) error("mode", codes.CONFIG_INVALID);
  if (typeof config.contractVersion !== "string" ||
      config.contractVersion !== contract.CONTRACT_VERSION) {
    error("contractVersion", codes.CONTRACT_VERSION_MISMATCH);
  }
  if (typeof config.configVersion !== "number" || !isFinite(config.configVersion) ||
      config.configVersion < 1 || Math.floor(config.configVersion) !== config.configVersion) {
    error("configVersion", codes.CONFIG_VERSION_INVALID);
  }
  var activationIDInvalid = typeof config.activationID !== "string";
  var activatedAtInvalid = typeof config.activatedAt !== "string";
  if (activationIDInvalid) error("activationID", codes.ACTIVATION_METADATA_INVALID);
  if (activatedAtInvalid) error("activatedAt", codes.ACTIVATION_METADATA_INVALID);
  if (contract.MODES.indexOf(mode) !== -1 && !activationIDInvalid && !activatedAtInvalid) {
    if (mode === "PREPARED") {
      if (config.activationID !== "" || config.activatedAt !== "") {
        error("activationID", codes.ACTIVATION_METADATA_PRESENT);
      }
    } else {
      if (config.activationID.trim() === "" || config.activatedAt.trim() === "") {
        error("activationID", codes.ACTIVATION_METADATA_MISSING);
      }
    }
  }
  if (!activatedAtInvalid && config.activatedAt.trim() !== "" &&
      treasuryIsoUtcEpoch_(config.activatedAt) === null) {
    error("activatedAt", codes.ACTIVATION_METADATA_INVALID);
  }
  return { status: errors.length ? "FAIL" : "PASS", errors: errors };
}

// Raw property reader. Missing property, blank value, invalid JSON, or any
// validation failure => deterministic FAIL with the frozen code. There is no
// default mode and no legacy fallback in any state.
function treasuryReceiptConfigFromRaw(raw) {
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { status: "FAIL", config: null, errors: [{ field: "config", code: codes.CONFIG_INVALID }] };
  }
  var parsed;
  try { parsed = JSON.parse(String(raw)); } catch (e) {
    return { status: "FAIL", config: null, errors: [{ field: "config", code: codes.CONFIG_INVALID }] };
  }
  var validation = validateTreasuryReceiptConfig(parsed);
  return {
    status: validation.status,
    config: validation.status === "PASS" ? parsed : null,
    errors: validation.errors
  };
}

// Read-only Script Properties reader. The config property is only ever read;
// without a Properties service the state is FAIL (config unavailable), never
// ACTIVE.
function treasuryReceiptConfigState() {
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  var unavailable = {
    status: "FAIL", config: null, errors: [{ field: "config", code: codes.CONFIG_INVALID }]
  };
  try {
    if (typeof PropertiesService === "undefined") return unavailable;
    var raw = PropertiesService.getScriptProperties()
      .getProperty(TREASURY_RECEIPT_V1_CONTRACT.CONFIG_PROPERTY);
    return treasuryReceiptConfigFromRaw(raw);
  } catch (e) {
    return unavailable;
  }
}

// Pure mode classifier: PREPARED refuses before any future write with
// TREASURY_NOT_ACTIVATED, PAUSED refuses with TREASURY_MODE_PAUSED, ACTIVE
// allows (all other gates stay with the T4 writer), invalid refuses with the
// specific frozen code. A refusal never becomes an alternate money path.
function treasuryReceiptModeGate(config) {
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  var validation = validateTreasuryReceiptConfig(config);
  if (validation.status !== "PASS") {
    return {
      allowed: false,
      mode: "REJECT",
      code: validation.errors.length ? validation.errors[0].code : codes.CONFIG_INVALID,
      errors: validation.errors
    };
  }
  var mode = String(config.mode).trim();
  if (mode === "PREPARED") return { allowed: false, mode: mode, code: codes.NOT_ACTIVATED, errors: [] };
  if (mode === "PAUSED") return { allowed: false, mode: mode, code: codes.MODE_PAUSED, errors: [] };
  if (mode === "ACTIVE") return { allowed: true, mode: mode, code: "", errors: [] };
  return { allowed: false, mode: "REJECT", code: codes.CONFIG_INVALID, errors: [] };
}

// Reader + classifier composition for future writer preflight.
function treasuryReceiptResolvedGate() {
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  var state = treasuryReceiptConfigState();
  if (state.status !== "PASS") {
    return {
      allowed: false,
      mode: "REJECT",
      code: state.errors.length ? state.errors[0].code : codes.CONFIG_INVALID,
      errors: state.errors
    };
  }
  return treasuryReceiptModeGate(state.config);
}

// ---------------------------------------------------------------------------
// Exact schema validation (T2 section 4). Strict frozen extent: every required
// column present exactly once at its frozen position, no missing, renamed,
// reordered, duplicated, or added columns (a stored Status column is refused).
// ---------------------------------------------------------------------------
function validateTreasurySchemaHeaders(schemaKey, headers) {
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  var schema = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS[schemaKey];
  function fail(detail, extra) {
    var error = { detail: detail, code: codes.SCHEMA_NOT_READY };
    if (extra) Object.keys(extra).forEach(function(key) { error[key] = extra[key]; });
    return { status: "FAIL", errors: [error] };
  }
  if (!schema) return fail("UNKNOWN_SCHEMA", { schemaKey: String(schemaKey) });
  if (!Array.isArray(headers)) return fail("HEADERS_NOT_AN_ARRAY");
  var required = schema.HEADERS, errors = [];
  if (headers.length !== required.length) {
    errors.push({ detail: "WIDTH_MISMATCH", code: codes.SCHEMA_NOT_READY,
      expected: required.length, actual: headers.length });
  }
  required.forEach(function(name, index) {
    var actual = headers[index];
    if (typeof actual !== "string" || actual !== name) {
      errors.push({ detail: "COLUMN_MISMATCH", code: codes.SCHEMA_NOT_READY, index: index,
        expected: name, actual: typeof actual === "string" ? actual : String(actual) });
    }
  });
  required.forEach(function(name) {
    var seen = 0;
    headers.forEach(function(actual) { if (actual === name) seen += 1; });
    if (seen > 1) {
      errors.push({ detail: "DUPLICATE_COLUMN", code: codes.SCHEMA_NOT_READY,
        expected: name, occurrences: seen });
    }
  });
  return errors.length ? { status: "FAIL", errors: errors } : { status: "PASS", errors: [] };
}

// ---------------------------------------------------------------------------
// Destination-account eligibility (T2 section 6). Deterministic on the frozen
// cash-universe code list plus Accounts master validation. Account names are
// never consulted. Fail closed on every path; the master is never mutated.
// ---------------------------------------------------------------------------
function treasuryDestinationEligible(destinationCode, accounts) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT, codes = contract.ERROR_CODES;
  function refuse(code, reason) { return { eligible: false, code: code, reason: reason }; }
  var code = String(destinationCode === undefined || destinationCode === null ?
    "" : destinationCode).trim();
  if (code === contract.CLEARING_ACCOUNT_CODE) {
    return refuse(codes.DESTINATION_IS_CLEARING, "CLEARING_ACCOUNT");
  }
  if (contract.DESTINATION_ACCOUNT_CODES.indexOf(code) === -1) {
    return refuse(codes.INVALID_DESTINATION_ACCOUNT, "NOT_IN_CASH_UNIVERSE");
  }
  if (!Array.isArray(accounts)) {
    return refuse(codes.INVALID_DESTINATION_ACCOUNT, "MALFORMED_MASTER");
  }
  var malformed = accounts.some(function(row) {
    return row === null || typeof row !== "object" || Array.isArray(row);
  });
  if (malformed) return refuse(codes.INVALID_DESTINATION_ACCOUNT, "MALFORMED_MASTER");
  var rows = accounts.filter(function(row) {
    return String(row.AccountCode === undefined || row.AccountCode === null ?
      "" : row.AccountCode).trim() === code;
  });
  if (rows.length === 0) return refuse(codes.INVALID_DESTINATION_ACCOUNT, "ABSENT");
  if (rows.length > 1) return refuse(codes.INVALID_DESTINATION_ACCOUNT, "DUPLICATE");
  var row = rows[0];
  if (!isCanonicalActive(row.IsActive)) {
    return refuse(codes.DESTINATION_ACCOUNT_INACTIVE, "INACTIVE");
  }
  if (String(row.AccountType === undefined || row.AccountType === null ?
      "" : row.AccountType).trim() !== "Asset" ||
      String(row.NormalBalance === undefined || row.NormalBalance === null ?
      "" : row.NormalBalance).trim() !== "DEBIT") {
    return refuse(codes.INVALID_DESTINATION_ACCOUNT, "METADATA_MISMATCH");
  }
  return { eligible: true, code: "", reason: "" };
}

// Centralized journal forbidden-account set (T2 section 8.1). Structural
// predicate for the T4 writer; 1030 is handled by the clearing rule, and
// ordinary receipts only ever journal {destination, 1030}.
function treasuryForbiddenJournalAccount(accountCode) {
  var code = String(accountCode === undefined || accountCode === null ? "" : accountCode).trim();
  return TREASURY_RECEIPT_V1_CONTRACT.FORBIDDEN_JOURNAL_ACCOUNTS.indexOf(code) !== -1;
}

// 1030 readiness preflight (T2 sections 21, 28): the clearing account must be
// structurally usable before any Treasury write exists. Read-only over the
// supplied master; blank or non-Operating CashFlowGroup fails closed. The
// frozen catalog has no clearing-specific runtime code, so structural
// unavailability surfaces as TREASURY_SCHEMA_NOT_READY with a precise reason.
function treasuryClearingPreflight(accounts) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT, codes = contract.ERROR_CODES;
  var code = contract.CLEARING_ACCOUNT_CODE, errors = [];
  function refuse(reason) { errors.push({ accountCode: code, reason: reason, code: codes.SCHEMA_NOT_READY }); }
  if (!Array.isArray(accounts)) { refuse("MALFORMED_MASTER"); return { status: "FAIL", errors: errors }; }
  var malformed = accounts.some(function(row) {
    return row === null || typeof row !== "object" || Array.isArray(row);
  });
  if (malformed) { refuse("MALFORMED_MASTER"); return { status: "FAIL", errors: errors }; }
  var rows = accounts.filter(function(row) {
    return String(row.AccountCode === undefined || row.AccountCode === null ?
      "" : row.AccountCode).trim() === code;
  });
  if (rows.length === 0) { refuse("ABSENT"); return { status: "FAIL", errors: errors }; }
  if (rows.length > 1) { refuse("DUPLICATE"); return { status: "FAIL", errors: errors }; }
  var row = rows[0];
  if (!isCanonicalActive(row.IsActive)) { refuse("INACTIVE"); return { status: "FAIL", errors: errors }; }
  if (String(row.AccountType === undefined || row.AccountType === null ?
      "" : row.AccountType).trim() !== "Asset" ||
      String(row.NormalBalance === undefined || row.NormalBalance === null ?
      "" : row.NormalBalance).trim() !== "DEBIT") {
    refuse("METADATA_MISMATCH");
    return { status: "FAIL", errors: errors };
  }
  if (String(row.CashFlowGroup === undefined || row.CashFlowGroup === null ?
      "" : row.CashFlowGroup).trim() !== contract.CLEARING_CASH_FLOW_GROUP) {
    refuse("CASH_FLOW_GROUP_UNCLASSIFIED");
    return { status: "FAIL", errors: errors };
  }
  return { status: "PASS", errors: [] };
}

// ---------------------------------------------------------------------------
// Date authority (T2 section 9). Explicit Asia/Jakarta normalization only;
// host-local getters are forbidden in every Treasury path (the proven
// boundary-defect class). EconomicDate must be byte-equal to ReceiptDate.
// ---------------------------------------------------------------------------
function treasuryIsoDateEpoch_(value) {
  if (typeof value !== "string") return null;
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  var utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 ||
      utc.getUTCDate() !== day) return null;
  return utc.getTime();
}

function treasuryDateKey(instant) {
  if (!(instant instanceof Date) || isNaN(instant.getTime())) {
    throw treasuryContractError_(TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES.DATE_INVALID,
      "treasuryDateKey requires a valid Date instant");
  }
  return Utilities.formatDate(instant, CANONICAL_ENTRY.TIMEZONE,
    TREASURY_RECEIPT_V1_CONTRACT.DATE_PATTERN);
}

function treasuryValidateReceiptDate(value) {
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  if (treasuryIsoDateEpoch_(value) === null) {
    return { status: "FAIL", code: codes.DATE_INVALID, field: "ReceiptDate" };
  }
  return { status: "PASS", code: "", field: "ReceiptDate" };
}

function treasuryValidateEconomicDate(receiptDate, economicDate) {
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  if (treasuryIsoDateEpoch_(receiptDate) === null) {
    return { status: "FAIL", code: codes.DATE_INVALID, field: "ReceiptDate" };
  }
  if (treasuryIsoDateEpoch_(economicDate) === null) {
    return { status: "FAIL", code: codes.DATE_INVALID, field: "EconomicDate" };
  }
  if (String(receiptDate) !== String(economicDate)) {
    return { status: "FAIL", code: codes.ECONOMIC_DATE_MISMATCH, field: "EconomicDate" };
  }
  return { status: "PASS", code: "", field: "EconomicDate" };
}

// ---------------------------------------------------------------------------
// Deterministic identity (T2 section 8.2). Same canonicalization class as
// transactionStableBootstrapId_ (95A) — byte-for-byte the same scheme under
// the Treasury namespace; no second digest scheme exists. Pure: no ID is
// persisted here, no server-uuid path is reachable for receipts/operations/
// journals/audits.
// ---------------------------------------------------------------------------
function treasuryStableId_(prefix, parts) {
  var text = parts.join("|").toUpperCase(), hash = 2166136261;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return prefix + (hash >>> 0).toString(16).toUpperCase() + "-" +
    text.replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function treasuryIdArgs_(operationType, requestKey, side, requireSide) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT, codes = contract.ERROR_CODES;
  var type = String(operationType === undefined || operationType === null ? "" : operationType).trim();
  var key = String(requestKey === undefined || requestKey === null ? "" : requestKey).trim();
  if (contract.OPERATION_TYPES.indexOf(type) === -1 || !key) {
    throw treasuryContractError_(codes.PAYLOAD_INVALID,
      "Treasury identity requires a known OperationType and a non-blank RequestKey");
  }
  var part = side === undefined || side === null ? "" : String(side).trim();
  if (requireSide && contract.SIDES.indexOf(part) === -1) {
    throw treasuryContractError_(codes.PAYLOAD_INVALID,
      "Treasury identity requires a known side");
  }
  return { type: type, key: key, side: part };
}

function treasuryOperationId(operationType, requestKey) {
  var args = treasuryIdArgs_(operationType, requestKey, undefined, false);
  return treasuryStableId_(TREASURY_RECEIPT_V1_CONTRACT.ID_PREFIXES.OPERATION,
    [args.type, args.key]);
}

function treasuryReceiptId(operationType, requestKey, side) {
  var args = treasuryIdArgs_(operationType, requestKey, side, true);
  return treasuryStableId_(TREASURY_RECEIPT_V1_CONTRACT.ID_PREFIXES.RECEIPT,
    [args.type, args.key, args.side]);
}

function treasuryJournalId(operationType, requestKey, side) {
  var args = treasuryIdArgs_(operationType, requestKey, side, true);
  return treasuryStableId_(TREASURY_RECEIPT_V1_CONTRACT.ID_PREFIXES.JOURNAL,
    [args.type, args.key, args.side]);
}

function treasuryAuditId(operationType, requestKey, side) {
  var args = treasuryIdArgs_(operationType, requestKey, side, true);
  return treasuryStableId_(TREASURY_RECEIPT_V1_CONTRACT.ID_PREFIXES.AUDIT,
    [args.type, args.key, args.side]);
}

// Canonical journal signature (T2 section 8.1): sorted-row digest of
// [AccountCode, Debit, Credit, MovementType, SourceType, SourceID,
// capitalEquityDateKey(Tanggal)] joined per row with "|" and across rows with
// "||" — the proven cashJournalSignature / policyCJournalSignature_ pattern
// under the Treasury namespace. Pure: in-memory rows only, verified at
// readback by the future writer; this module never appends ledger lines.
function treasuryJournalSignature(rows) {
  return (rows || []).map(function(row) {
    return [String(row.AccountCode), Number(row.Debit), Number(row.Credit), String(row.MovementType),
      String(row.SourceType), String(row.SourceID), capitalEquityDateKey(row.Tanggal)].join("|");
  }).sort().join("||");
}
