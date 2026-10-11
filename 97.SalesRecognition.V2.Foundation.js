// SALES_RECOGNITION_V2 U1 foundation: companion contract, config semantics,
// sticky cohort classifier, account preflight. Pure functions only — no sheet
// access, no writer, no U2+ projection. Default mode is PREPARED (V2 disabled).
var SALES_RECOGNITION_V2_CONTRACT = Object.freeze({
  CONTRACT_VERSION: "SALES_RECOGNITION_V2",
  SHEET: "SalesRecognitionEvents",
  HEADERS: Object.freeze(["RecognitionID", "ContractVersion", "ActivationID", "OrderID",
    "RevisionID", "EventType", "RecognizedAt", "EconomicDate", "Amount",
    "RecognitionJournalID", "JournalSignature", "PostingStatus", "OperationID", "AuditID",
    "OriginalID", "ReversalOfRecognitionID", "ReplacementID", "Reason", "Actor", "SnapshotJSON"]),
  MODES: Object.freeze(["PREPARED", "ACTIVE", "PAUSED"]),
  EVENT_TYPES: Object.freeze(["RECOGNITION", "REVERSAL"]),
  COMMITTED_STATE: "COMMITTED",
  // V2 activation must never reuse the old operational T or a Policy C date.
  FORBIDDEN_ACTIVATION_TIMESTAMP: "2026-10-06T18:50:05.328Z",
  DEFAULT_CONFIG: Object.freeze({
    mode: "PREPARED",
    contractVersion: "SALES_RECOGNITION_V2",
    activationID: "",
    activatedAt: "",
    configVersion: 1
  }),
  COHORTS: Object.freeze({
    TABSAL_LEGACY: "TABSAL_LEGACY",
    PRE_V2_ORDER: "PRE_V2_ORDER",
    V2_PENDING: "V2_PENDING",
    V2_COMMITTED: "V2_COMMITTED",
    INCONSISTENT: "INCONSISTENT",
    UNKNOWN: "UNKNOWN"
  }),
  // Deterministic status vocabulary. UNKNOWN / RECOVERY_REQUIRED stay reachable
  // so no ambiguous input can produce a false OK.
  STATUS: Object.freeze({ OK: "OK", UNKNOWN: "UNKNOWN", RECOVERY_REQUIRED: "RECOVERY_REQUIRED" }),
  REFUSAL_CODES: Object.freeze({
    MODE_INVALID: "MODE_INVALID",
    CONTRACT_VERSION_MISMATCH: "CONTRACT_VERSION_MISMATCH",
    CONFIG_VERSION_INVALID: "CONFIG_VERSION_INVALID",
    ACTIVATION_METADATA_PRESENT: "ACTIVATION_METADATA_PRESENT",
    ACTIVATION_METADATA_MISSING: "ACTIVATION_METADATA_MISSING",
    ACTIVATION_METADATA_INVALID: "ACTIVATION_METADATA_INVALID",
    ACTIVATION_TIMESTAMP_INVALID: "ACTIVATION_TIMESTAMP_INVALID",
    ACTIVATION_TIMESTAMP_FORBIDDEN: "ACTIVATION_TIMESTAMP_FORBIDDEN",
    V2_NOT_ACTIVATED: "V2_NOT_ACTIVATED",
    V2_MODE_PAUSED: "V2_MODE_PAUSED",
    CONFIG_INVALID: "CONFIG_INVALID",
    IDENTITY_CONFLICT: "IDENTITY_CONFLICT",
    EVIDENCE_CONTRACT_INVALID: "EVIDENCE_CONTRACT_INVALID",
    EVIDENCE_UNBOUND: "EVIDENCE_UNBOUND",
    EVIDENCE_MALFORMED: "EVIDENCE_MALFORMED",
    NO_PERSISTED_EVIDENCE: "NO_PERSISTED_EVIDENCE",
    DATE_ONLY_NO_PERSISTED_EVIDENCE: "DATE_ONLY_NO_PERSISTED_EVIDENCE",
    ACCOUNT_ROW_INVALID: "ACCOUNT_ROW_INVALID",
    ACCOUNT_ABSENT: "ACCOUNT_ABSENT",
    ACCOUNT_DUPLICATE: "ACCOUNT_DUPLICATE",
    ACCOUNT_METADATA_MISMATCH: "ACCOUNT_METADATA_MISMATCH",
    ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE"
  })
});

function salesRecognitionV2DefaultConfig() {
  return SALES_RECOGNITION_V2_CONTRACT.DEFAULT_CONFIG;
}

function salesRecognitionV2Result_(cohort, status, code) {
  return { cohort: cohort, status: status, code: code || "" };
}

function salesRecognitionConfigError_(field, code) {
  return { field: field, code: code };
}

// Strict ISO 8601 date-time with explicit timezone designator. Returns the
// normalized epoch (ms) or null when the value is not an unambiguous, real
// calendar timestamp. Rejects missing/invalid offsets, impossible dates, and
// out-of-range hour/minute/second components.
function salesRecognitionIsoTimestampEpoch_(value) {
  if (typeof value !== "string") return null;
  var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
    .exec(value);
  if (!match) return null;
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]),
    hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]),
    offset = match[8];
  var fraction = match[7] ? match[7].slice(1) : "";
  var millisecond = fraction ? Number((fraction + "000").slice(0, 3)) : 0;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31 ||
      hour > 23 || minute > 59 || second > 59) return null;
  var offsetMillis = 0;
  if (offset !== "Z") {
    var sign = offset.charAt(0) === "-" ? -1 : 1;
    var offsetHour = Number(offset.slice(1, 3)), offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
    offsetMillis = sign * (offsetHour * 60 + offsetMinute) * 60000;
  }
  // Round-trip through Date.UTC catches impossible calendar days (e.g. Feb 30).
  var utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 ||
      utc.getUTCDate() !== day) return null;
  return utc.getTime() - offsetMillis;
}

function validateSalesRecognitionV2Config(config) {
  var contract = SALES_RECOGNITION_V2_CONTRACT, codes = contract.REFUSAL_CODES, errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { status: "FAIL", errors: [salesRecognitionConfigError_("config", codes.CONFIG_INVALID)] };
  }
  var mode = config.mode;
  if (typeof mode !== "string" || contract.MODES.indexOf(mode) === -1) {
    errors.push(salesRecognitionConfigError_("mode", codes.MODE_INVALID));
  }
  if (typeof config.contractVersion !== "string" ||
      config.contractVersion !== contract.CONTRACT_VERSION) {
    errors.push(salesRecognitionConfigError_("contractVersion", codes.CONTRACT_VERSION_MISMATCH));
  }
  if (typeof config.configVersion !== "number" || !isFinite(config.configVersion) ||
      config.configVersion < 1 || Math.floor(config.configVersion) !== config.configVersion) {
    errors.push(salesRecognitionConfigError_("configVersion", codes.CONFIG_VERSION_INVALID));
  }
  var activationID = config.activationID, activatedAt = config.activatedAt;
  var idTypeInvalid = typeof activationID !== "string";
  var atTypeInvalid = typeof activatedAt !== "string";
  if (idTypeInvalid) {
    errors.push(salesRecognitionConfigError_("activationID", codes.ACTIVATION_METADATA_INVALID));
  }
  if (atTypeInvalid) {
    errors.push(salesRecognitionConfigError_("activatedAt", codes.ACTIVATION_METADATA_INVALID));
  }
  if (typeof mode === "string" && !idTypeInvalid && !atTypeInvalid) {
    if (mode === "PREPARED") {
      // Activation fields must be actual blank strings; any value fails closed.
      if (activationID !== "" || activatedAt !== "") {
        errors.push(salesRecognitionConfigError_("activationID", codes.ACTIVATION_METADATA_PRESENT));
      }
    } else if (mode === "ACTIVE" || mode === "PAUSED") {
      if (activationID.trim() === "" || activatedAt.trim() === "") {
        errors.push(salesRecognitionConfigError_("activationID", codes.ACTIVATION_METADATA_MISSING));
      }
    }
  }
  if (!atTypeInvalid && activatedAt.trim() !== "") {
    var epoch = salesRecognitionIsoTimestampEpoch_(activatedAt);
    if (epoch === null) {
      errors.push(salesRecognitionConfigError_("activatedAt", codes.ACTIVATION_TIMESTAMP_INVALID));
    } else if (epoch === salesRecognitionIsoTimestampEpoch_(contract.FORBIDDEN_ACTIVATION_TIMESTAMP)) {
      // Same instant in any offset representation is also forbidden.
      errors.push(salesRecognitionConfigError_("activatedAt", codes.ACTIVATION_TIMESTAMP_FORBIDDEN));
    }
  }
  return { status: errors.length ? "FAIL" : "PASS", errors: errors };
}

// Pure gate for new Sales requests. Never converts a refusal into a legacy path:
// PREPARED and PAUSED refuse V2 work instead of falling back to legacy behavior.
function salesRecognitionV2RequestGate(config) {
  var codes = SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES;
  var validation = validateSalesRecognitionV2Config(config);
  if (validation.status !== "PASS") return { allowed: false, code: codes.CONFIG_INVALID };
  var mode = config.mode;
  if (mode === "PREPARED") return { allowed: false, code: codes.V2_NOT_ACTIVATED };
  if (mode === "PAUSED") return { allowed: false, code: codes.V2_MODE_PAUSED };
  if (mode === "ACTIVE") return { allowed: true, code: "" };
  return { allowed: false, code: codes.CONFIG_INVALID };
}

function salesRecognitionContextLists_(context) {
  // Returns { malformed: true } for typed-collection contract violations,
  // otherwise the validated evidence collections present on the context.
  var kinds = ["intents", "events", "operations"], lists = [];
  for (var i = 0; i < kinds.length; i++) {
    var value = context[kinds[i]];
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value)) return { malformed: true };
    for (var j = 0; j < value.length; j++) {
      var row = value[j];
      if (row === null || typeof row !== "object" || Array.isArray(row)) return { malformed: true };
    }
    lists.push({ kind: kinds[i], rows: value });
  }
  return { malformed: false, lists: lists };
}

function salesRecognitionRowOrderID_(row) {
  var value = row.OrderID === undefined || row.OrderID === null ? "" : row.OrderID;
  return typeof value === "string" ? value.trim() : "";
}

function salesRecognitionRowContractVersion_(row) {
  var value = row.ContractVersion === undefined || row.ContractVersion === null ?
    "" : row.ContractVersion;
  return typeof value === "string" ? value.trim() : "";
}

function salesRecognitionRowCommitted_(row) {
  var value = row.State !== undefined && row.State !== null ? row.State : row.PostingStatus;
  return String(value === undefined || value === null ? "" : value).trim().toUpperCase() ===
    SALES_RECOGNITION_V2_CONTRACT.COMMITTED_STATE;
}

function salesRecognitionOrderIsTabSal_(order) {
  if (!order || typeof order !== "object") return false;
  var marker = [order.sourceSheet, order.Source, order.sheet, order.SheetName].map(function(value) {
    return String(value === undefined || value === null ? "" : value).trim().toLowerCase();
  });
  if (marker.indexOf("tabsal") !== -1) return true;
  if (!Object.prototype.hasOwnProperty.call(order, "ID_Trx")) return false;
  // Historical tabSal identity prefixes ("SAL-", app entries "SAL-APP-...").
  var transactionID = String(order.ID_Trx === undefined || order.ID_Trx === null ?
    "" : order.ID_Trx).trim().toUpperCase();
  if (transactionID.indexOf("SAL-") === 0) return true;
  // Raw tabSal schema shape: ID_Trx + Tanggal + ID_Prod (no OrderID invented).
  return Object.prototype.hasOwnProperty.call(order, "Tanggal") &&
    Object.prototype.hasOwnProperty.call(order, "ID_Prod");
}

function salesRecognitionOrderHasLegacyContract_(order) {
  if (!order || typeof order !== "object") return false;
  return Object.prototype.hasOwnProperty.call(order, "PaymentStatus") ||
    Object.prototype.hasOwnProperty.call(order, "FulfillmentStatus");
}

function salesRecognitionOrderHasDateSignal_(order, context) {
  var config = context && context.config;
  var candidates = [order && order.CreatedAt, order && order.UpdatedAt,
    config && config.activatedAt, context && context.activatedAt];
  return candidates.some(function(value) {
    return String(value === undefined || value === null ? "" : value).trim() !== "";
  });
}

// Sticky cohort classifier. Precedence: persisted V2 evidence (intent, event,
// operation, order-level contract marker) outranks legacy fields and dates;
// dates alone never classify; pending V2 is never legacy; unknown, missing,
// unbound, or conflicting persisted evidence fails closed instead of falling
// to legacy. Never mutates inputs; never throws on malformed context.
function classifySalesRecognitionCohort(order, context) {
  var contract = SALES_RECOGNITION_V2_CONTRACT, cohorts = contract.COHORTS,
    status = contract.STATUS, codes = contract.REFUSAL_CODES;
  if (context === undefined || context === null) context = {};
  if (typeof context !== "object" || Array.isArray(context)) {
    return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED,
      codes.EVIDENCE_MALFORMED);
  }
  var collections = salesRecognitionContextLists_(context);
  if (collections.malformed) {
    return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED,
      codes.EVIDENCE_MALFORMED);
  }
  if (!order || typeof order !== "object" || Array.isArray(order)) {
    return salesRecognitionV2Result_(cohorts.UNKNOWN, status.UNKNOWN, codes.NO_PERSISTED_EVIDENCE);
  }
  var orderID = salesRecognitionRowOrderID_(order);
  var scoped = [], hasUnboundEvidence = false;
  collections.lists.forEach(function(list) {
    list.rows.forEach(function(row) {
      var rowOrderID = salesRecognitionRowOrderID_(row);
      if (!rowOrderID) { hasUnboundEvidence = true; return; }
      if (orderID && rowOrderID === orderID) scoped.push(row);
      // Rows bound to another OrderID are identified and ignored.
    });
  });
  var orderVersion = salesRecognitionRowContractVersion_(order);
  if (hasUnboundEvidence) {
    // Ambiguous evidence (missing OrderID) is refused, never attached to any order.
    return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED,
      codes.EVIDENCE_UNBOUND);
  }
  if (!orderID && orderVersion) {
    return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED,
      codes.EVIDENCE_UNBOUND);
  }
  var hasV2 = false, committed = false, activationIDs = {};
  function collectActivationID(value) {
    var id = String(value === undefined || value === null ? "" : value).trim();
    if (id) activationIDs[id] = true;
  }
  if (orderID && orderVersion) {
    if (orderVersion !== contract.CONTRACT_VERSION) {
      return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED,
        codes.IDENTITY_CONFLICT);
    }
    hasV2 = true;
    collectActivationID(order.ActivationID);
  }
  for (var i = 0; i < scoped.length; i++) {
    var row = scoped[i], version = salesRecognitionRowContractVersion_(row);
    if (!version) {
      // Scoped companion evidence with a missing ContractVersion is malformed
      // V2 evidence — never ignored, never a legacy fallthrough.
      return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED,
        codes.EVIDENCE_CONTRACT_INVALID);
    }
    if (version !== contract.CONTRACT_VERSION) {
      return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED,
        codes.IDENTITY_CONFLICT);
    }
    hasV2 = true;
    if (salesRecognitionRowCommitted_(row)) committed = true;
    collectActivationID(row.ActivationID);
  }
  if (hasV2) {
    if (Object.keys(activationIDs).length > 1) {
      // Contradictory ActivationID across related V2 records fails closed.
      return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED,
        codes.IDENTITY_CONFLICT);
    }
    return salesRecognitionV2Result_(committed ? cohorts.V2_COMMITTED : cohorts.V2_PENDING,
      status.OK, "");
  }
  if (salesRecognitionOrderIsTabSal_(order)) {
    return salesRecognitionV2Result_(cohorts.TABSAL_LEGACY, status.OK, "");
  }
  if (!orderID) {
    return salesRecognitionV2Result_(cohorts.UNKNOWN, status.UNKNOWN, codes.NO_PERSISTED_EVIDENCE);
  }
  if (salesRecognitionOrderHasLegacyContract_(order)) {
    return salesRecognitionV2Result_(cohorts.PRE_V2_ORDER, status.OK, "");
  }
  if (salesRecognitionOrderHasDateSignal_(order, context)) {
    return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.UNKNOWN,
      codes.DATE_ONLY_NO_PERSISTED_EVIDENCE);
  }
  return salesRecognitionV2Result_(cohorts.UNKNOWN, status.UNKNOWN, codes.NO_PERSISTED_EVIDENCE);
}

function salesRecognitionAccountExpectations_() {
  var codes = SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES;
  var core4000 = (typeof BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY !== "undefined" &&
    BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE["4000"]) || null;
  if (!core4000) throw new Error(codes.ACCOUNT_METADATA_MISMATCH + ":4000_AUTHORITY_UNAVAILABLE");
  return [
    { AccountCode: "1030", AccountName: "Sales Settlement Clearing", AccountType: "Asset",
      StatementGroup: "Current Assets", NormalBalance: "DEBIT" },
    { AccountCode: "2010", AccountName: "Customer Refund and Credit Payable", AccountType: "Liability",
      StatementGroup: "Current Liabilities", NormalBalance: "CREDIT" },
    // 4000 metadata authority: BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE["4000"].
    { AccountCode: "4000", AccountName: core4000[0], AccountType: core4000[1],
      StatementGroup: core4000[2], CashFlowGroup: core4000[3], NormalBalance: "CREDIT" }
  ];
}

function salesRecognitionAccountFieldMismatch_(row, expected) {
  return Object.keys(expected).some(function(field) {
    if (field === "AccountCode") return false;
    var actual = String(row[field] === undefined || row[field] === null ? "" : row[field]).trim();
    // 4000 legacy blank NormalBalance is the proven production convention: the
    // frozen Accounts migrations never persist NormalBalance for 4000 and
    // BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE["4000"] carries
    // no NormalBalance element. Blank means "no claim" (derivable: Revenue =>
    // CREDIT); any non-blank value must still match the required authority
    // exactly, and every other required field stays fail-closed.
    if (field === "NormalBalance" && expected.AccountCode === "4000" && actual === "") {
      return false;
    }
    return actual !== String(expected[field]);
  });
}

// ---------------------------------------------------------------------------
// T11.2 §20 single-commit transaction config (read-only semantics; the
// activation writer belongs to a later authorized unit). Key and mode names
// are frozen by T11.2 §20. Pure: no property access, no sheet access, no
// writer. Absent/blank raw value resolves to ABSENT (= PREPARED semantics:
// zero behavior change); invalid JSON/mode/configVersion resolves to
// UNRESOLVED (REJECT — never a fallback).
// ---------------------------------------------------------------------------
var SINGLE_COMMIT_TRANSACTION_V1 = Object.freeze({
  CONFIG_PROPERTY: "SINGLE_COMMIT_TRANSACTION_V1",
  MODES: Object.freeze(["PREPARED", "ACTIVE", "PAUSED", "REJECT"]),
  CODES: Object.freeze({
    SINGLE_COMMIT_CONFIG_INVALID: "SINGLE_COMMIT_CONFIG_INVALID",
    SINGLE_COMMIT_MODE_PAUSED: "SINGLE_COMMIT_MODE_PAUSED"
  })
});

// T11.2 §3/§11/§16 frozen composed-money policy: the dedicated
// composed-money representation is a BalanceLedger journal pair inside the
// domain plan/batch (never Treasury receipt rows, never payment/channel
// concepts). 1040 metadata is the exact §11 Accounts expectation.
var SINGLE_COMMIT_MONEY_POLICY = Object.freeze({
  ACCOUNT_CODE: "1040",
  ACCOUNT_EXPECTATION: Object.freeze({
    AccountCode: "1040",
    AccountName: "Operational Funds",
    AccountType: "Asset",
    StatementGroup: "Current Assets",
    CashFlowGroup: "Operating",
    NormalBalance: "DEBIT"
  }),
  SALES_MONEY_MOVEMENT_TYPE: "SALES_MONEY",
  SALES_MONEY_SOURCE_TYPE: "SALES_MONEY_V2",
  SALES_MONEY_JOURNAL_PREFIX: "SRV2M-"
});

// Pure parser for the raw SINGLE_COMMIT_TRANSACTION_V1 value (property string
// or already-parsed object for injected runtimes). Deterministic three-state
// result: ABSENT / VALID / UNRESOLVED. Never infers a mode, never repairs.
function singleCommitTransactionConfigState_(raw) {
  var contract = SINGLE_COMMIT_TRANSACTION_V1;
  if (raw === null || raw === undefined ||
      (typeof raw === "string" && raw.trim() === "")) {
    return { state: "ABSENT", mode: "PREPARED", detail: "" };
  }
  var config = raw;
  if (typeof raw === "string") {
    try { config = JSON.parse(raw); }
    catch (error) {
      return { state: "UNRESOLVED", mode: "", detail: "CONFIG_JSON_INVALID" };
    }
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { state: "UNRESOLVED", mode: "", detail: "CONFIG_SHAPE_INVALID" };
  }
  if (typeof config.mode !== "string" || contract.MODES.indexOf(config.mode) === -1) {
    return { state: "UNRESOLVED", mode: "", detail: "CONFIG_MODE_INVALID" };
  }
  if (typeof config.configVersion !== "number" || !isFinite(config.configVersion) ||
      config.configVersion < 1 || Math.floor(config.configVersion) !== config.configVersion) {
    return { state: "UNRESOLVED", mode: "", detail: "CONFIG_VERSION_INVALID" };
  }
  if ((config.activationID !== undefined && typeof config.activationID !== "string") ||
      (config.activatedAt !== undefined && typeof config.activatedAt !== "string")) {
    return { state: "UNRESOLVED", mode: "", detail: "CONFIG_ACTIVATION_INVALID" };
  }
  return { state: "VALID", mode: config.mode, detail: "" };
}

// Pure mode -> Sales U2 new-intent decision (T11.2 §3/§20/§22):
// ABSENT/PREPARED -> allowed, composed-money leg OFF (byte-identical legacy
// recognition save); ACTIVE -> allowed, composed-money leg REQUIRED (fail
// closed on the 1040 precondition); PAUSED -> new saves refuse fail-closed;
// REJECT mode or UNRESOLVED state -> refuse, never a fallback.
function singleCommitTransactionSalesGate_(state) {
  var codes = SINGLE_COMMIT_TRANSACTION_V1.CODES;
  if (state.state === "UNRESOLVED") {
    return { allowed: false, composedMoney: false, code: codes.SINGLE_COMMIT_CONFIG_INVALID,
      detail: state.detail };
  }
  if (state.state === "ABSENT" || state.mode === "PREPARED") {
    return { allowed: true, composedMoney: false, code: "", detail: "" };
  }
  if (state.mode === "ACTIVE") {
    return { allowed: true, composedMoney: true, code: "", detail: "" };
  }
  if (state.mode === "PAUSED") {
    return { allowed: false, composedMoney: false, code: codes.SINGLE_COMMIT_MODE_PAUSED,
      detail: "" };
  }
  return { allowed: false, composedMoney: false, code: codes.SINGLE_COMMIT_CONFIG_INVALID,
    detail: "MODE_REJECT" };
}

// Pure 1040 precondition over supplied logical Accounts rows (T11.2 §11),
// invoked only when the composed-money leg is ACTIVE. Fail closed on absent,
// duplicate, inactive, or any metadata mismatch (exact match, no blank-value
// tolerance). Zero writes; the existing 1030/2010/4000 preflight stays
// byte-identical and independent.
function preflightSingleCommitMoneyAccount(rows) {
  var codes = SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES, errors = [];
  var list = Array.isArray(rows) ? rows : [];
  var expected = SINGLE_COMMIT_MONEY_POLICY.ACCOUNT_EXPECTATION;
  var invalidRows = list.filter(function(row) {
    return row === null || typeof row !== "object" || Array.isArray(row);
  });
  if (invalidRows.length) {
    errors.push({ accountCode: expected.AccountCode, code: codes.ACCOUNT_ROW_INVALID });
  }
  var matches = list.filter(function(row) {
    return row && typeof row === "object" && !Array.isArray(row) &&
      String(row.AccountCode === undefined || row.AccountCode === null ? "" :
        row.AccountCode).trim() === expected.AccountCode;
  });
  if (matches.length === 0) {
    errors.push({ accountCode: expected.AccountCode, code: codes.ACCOUNT_ABSENT });
  } else if (matches.length > 1) {
    errors.push({ accountCode: expected.AccountCode, code: codes.ACCOUNT_DUPLICATE });
  } else {
    var row = matches[0];
    if (!isCanonicalActive(row.IsActive)) {
      errors.push({ accountCode: expected.AccountCode, code: codes.ACCOUNT_INACTIVE });
    } else {
      var mismatch = Object.keys(expected).some(function(field) {
        if (field === "AccountCode") return false;
        return String(row[field] === undefined || row[field] === null ? "" : row[field]).trim() !==
          String(expected[field]);
      });
      if (mismatch) {
        errors.push({ accountCode: expected.AccountCode, code: codes.ACCOUNT_METADATA_MISMATCH });
      }
    }
  }
  return { status: errors.length ? "FAIL" : "PASS", errors: errors };
}

// Pure activation preflight over supplied logical Accounts rows, including
// inactive rows for uniqueness. 2000 (supplier AP) is intentionally out of
// scope and untouched. Fail closed on absent, duplicate, wrong, or inactive.
function preflightSalesRecognitionAccounts(rows) {
  var codes = SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES, errors = [];
  var list = Array.isArray(rows) ? rows : [];
  var expectations = salesRecognitionAccountExpectations_();
  var invalidRows = list.filter(function(row) {
    return row === null || typeof row !== "object" || Array.isArray(row);
  });
  if (invalidRows.length) {
    errors.push({ accountCode: "", code: codes.ACCOUNT_ROW_INVALID });
  }
  expectations.forEach(function(expected) {
    var matches = list.filter(function(row) {
      return row && typeof row === "object" && !Array.isArray(row) &&
        String(row.AccountCode === undefined || row.AccountCode === null ? "" : row.AccountCode).trim() ===
          expected.AccountCode;
    });
    if (matches.length === 0) {
      errors.push({ accountCode: expected.AccountCode, code: codes.ACCOUNT_ABSENT });
      return;
    }
    if (matches.length > 1) {
      errors.push({ accountCode: expected.AccountCode, code: codes.ACCOUNT_DUPLICATE });
      return;
    }
    var row = matches[0];
    if (!isCanonicalActive(row.IsActive)) {
      errors.push({ accountCode: expected.AccountCode, code: codes.ACCOUNT_INACTIVE });
      return;
    }
    if (salesRecognitionAccountFieldMismatch_(row, expected)) {
      errors.push({ accountCode: expected.AccountCode, code: codes.ACCOUNT_METADATA_MISMATCH });
    }
  });
  return { status: errors.length ? "FAIL" : "PASS", errors: errors };
}
