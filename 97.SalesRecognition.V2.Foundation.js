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
    ACTIVATION_TIMESTAMP_FORBIDDEN: "ACTIVATION_TIMESTAMP_FORBIDDEN",
    V2_NOT_ACTIVATED: "V2_NOT_ACTIVATED",
    V2_MODE_PAUSED: "V2_MODE_PAUSED",
    CONFIG_INVALID: "CONFIG_INVALID",
    IDENTITY_CONFLICT: "IDENTITY_CONFLICT",
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

function validateSalesRecognitionV2Config(config) {
  var contract = SALES_RECOGNITION_V2_CONTRACT, codes = contract.REFUSAL_CODES, errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { status: "FAIL", errors: [salesRecognitionConfigError_("config", codes.CONFIG_INVALID)] };
  }
  if (contract.MODES.indexOf(String(config.mode || "").trim()) === -1) {
    errors.push(salesRecognitionConfigError_("mode", codes.MODE_INVALID));
  }
  if (String(config.contractVersion || "") !== contract.CONTRACT_VERSION) {
    errors.push(salesRecognitionConfigError_("contractVersion", codes.CONTRACT_VERSION_MISMATCH));
  }
  if (typeof config.configVersion !== "number" || !isFinite(config.configVersion) ||
      config.configVersion < 1 || Math.floor(config.configVersion) !== config.configVersion) {
    errors.push(salesRecognitionConfigError_("configVersion", codes.CONFIG_VERSION_INVALID));
  }
  var activationID = String(config.activationID === undefined || config.activationID === null ?
    "" : config.activationID).trim();
  var activatedAt = String(config.activatedAt === undefined || config.activatedAt === null ?
    "" : config.activatedAt).trim();
  var mode = String(config.mode || "").trim();
  if (mode === "PREPARED") {
    if (activationID || activatedAt) {
      errors.push(salesRecognitionConfigError_("activationID", codes.ACTIVATION_METADATA_PRESENT));
    }
  } else if (mode === "ACTIVE" || mode === "PAUSED") {
    if (!activationID || !activatedAt) {
      errors.push(salesRecognitionConfigError_("activationID", codes.ACTIVATION_METADATA_MISSING));
    }
  }
  if (activatedAt && activatedAt === contract.FORBIDDEN_ACTIVATION_TIMESTAMP) {
    errors.push(salesRecognitionConfigError_("activatedAt", codes.ACTIVATION_TIMESTAMP_FORBIDDEN));
  }
  return { status: errors.length ? "FAIL" : "PASS", errors: errors };
}

// Pure gate for new Sales requests. Never converts a refusal into a legacy path:
// PREPARED and PAUSED refuse V2 work instead of falling back to legacy behavior.
function salesRecognitionV2RequestGate(config) {
  var codes = SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES;
  var validation = validateSalesRecognitionV2Config(config);
  if (validation.status !== "PASS") return { allowed: false, code: codes.CONFIG_INVALID };
  var mode = String(config.mode || "").trim();
  if (mode === "PREPARED") return { allowed: false, code: codes.V2_NOT_ACTIVATED };
  if (mode === "PAUSED") return { allowed: false, code: codes.V2_MODE_PAUSED };
  return { allowed: true, code: "" };
}

function salesRecognitionPersistedEvidenceRows_(order, context) {
  var rows = [];
  [context.intents, context.events, context.operations].forEach(function(list) {
    (list || []).forEach(function(row) { if (row && typeof row === "object") rows.push(row); });
  });
  var orderID = order && String(order.OrderID || "").trim();
  return rows.filter(function(row) {
    var rowOrderID = String(row.OrderID === undefined ? "" : row.OrderID).trim();
    return !rowOrderID || !orderID || rowOrderID === orderID;
  });
}

function salesRecognitionRowContractVersion_(row) {
  return String(row.ContractVersion === undefined || row.ContractVersion === null ?
    "" : row.ContractVersion).trim();
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
  return Object.prototype.hasOwnProperty.call(order, "ID_Trx");
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
// dates alone never classify; pending V2 is never legacy; unknown/conflicting
// persisted contract versions fail closed instead of falling to legacy.
function classifySalesRecognitionCohort(order, context) {
  var contract = SALES_RECOGNITION_V2_CONTRACT, cohorts = contract.COHORTS,
    status = contract.STATUS, codes = contract.REFUSAL_CODES;
  context = context || {};
  var orderID = order && String(order.OrderID === undefined ? "" : order.OrderID).trim();
  if (!order || typeof order !== "object" || !orderID) {
    return salesRecognitionV2Result_(cohorts.UNKNOWN, status.UNKNOWN, codes.NO_PERSISTED_EVIDENCE);
  }
  var evidence = salesRecognitionPersistedEvidenceRows_(order, context);
  var hasV2 = false, hasUnknownVersion = false, committed = false;
  var orderVersion = salesRecognitionRowContractVersion_(order);
  if (orderVersion) {
    if (orderVersion === contract.CONTRACT_VERSION) hasV2 = true;
    else hasUnknownVersion = true;
  }
  evidence.forEach(function(row) {
    var version = salesRecognitionRowContractVersion_(row);
    if (!version) return;
    if (version === contract.CONTRACT_VERSION) hasV2 = true;
    else hasUnknownVersion = true;
    if (salesRecognitionRowCommitted_(row)) committed = true;
  });
  if (hasV2 && hasUnknownVersion) {
    return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED, codes.IDENTITY_CONFLICT);
  }
  if (hasV2) {
    return salesRecognitionV2Result_(committed ? cohorts.V2_COMMITTED : cohorts.V2_PENDING, status.OK, "");
  }
  if (hasUnknownVersion) {
    return salesRecognitionV2Result_(cohorts.INCONSISTENT, status.RECOVERY_REQUIRED, codes.IDENTITY_CONFLICT);
  }
  if (salesRecognitionOrderIsTabSal_(order)) {
    return salesRecognitionV2Result_(cohorts.TABSAL_LEGACY, status.OK, "");
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
    return String(row[field] === undefined || row[field] === null ? "" : row[field]).trim() !==
      String(expected[field]);
  });
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
