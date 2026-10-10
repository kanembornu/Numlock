function normalizeLayoutDebugParameter(event) {

  return String(
    event && event.parameter
      ? event.parameter.debugLayout || ""
      : ""
  ) === "1";

}

function include(filename) {

  return HtmlService
    .createTemplateFromFile(filename)
    .getRawContent();

}

function recipeStandardCostWebResponse_(status) {

  var sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(RECIPE_STANDARD_COST_CONTRACT.SHEET);
  var headers = sheet
    ? sheet.getRange(1, 1, 1, RECIPE_STANDARD_COST_CONTRACT.HEADERS.length).getValues()[0]
    : [];
  var result = {
    status: status,
    sheetExists: !!sheet,
    headerCount: headers.length,
    headersExact: JSON.stringify(headers) === JSON.stringify(RECIPE_STANDARD_COST_CONTRACT.HEADERS),
    businessRowCount: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0
  };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);

}

function runApplyRecipeStandardCost() {

  if (!RECIPE_STANDARD_COST_CONTRACT.STANDARD_COST_APPLY_ACTIVATION) {
    return { status: "DISABLED", writeCount: 0, errors: [] };
  }
  return applyRecipeStandardCost(arguments[0], SpreadsheetApp.getActiveSpreadsheet());

}

function diagnoseCapitalEquityRuntime_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = { phase: "3B.2-R", timestamp: new Date().toISOString() };

  // 1. CapitalEquity sheet
  var ceSheet = ss.getSheetByName("CapitalEquity");
  result.capitalEquity = { exists: !!ceSheet };
  if (!ceSheet) return result;

  var ceHeaders = ceSheet.getLastColumn() > 0 ? ceSheet.getRange(1, 1, 1, ceSheet.getLastColumn()).getValues()[0].map(String) : [];
  result.capitalEquity.headerCount = ceHeaders.length;
  result.capitalEquity.headers = ceHeaders;
  result.capitalEquity.expectedHeaders = CAPITAL_EQUITY_POLICY.HEADERS;
  result.capitalEquity.headersExact = JSON.stringify(ceHeaders) === JSON.stringify(CAPITAL_EQUITY_POLICY.HEADERS);
  result.capitalEquity.rowCount = Math.max(0, ceSheet.getLastRow() - 1);

  if (result.capitalEquity.rowCount > 0) {
    var ceData = ceSheet.getRange(2, 1, result.capitalEquity.rowCount, ceHeaders.length).getValues();
    var ownerCounts = {}, typeCounts = {}, sourceValues = {}, ids = {}, invalidRows = [];
    ceData.forEach(function(row, index) {
      var id = String(row[0] || "").trim();
      var owner = String(row[2] || "").trim();
      var type = String(row[3] || "").trim();
      var nominal = Number(row[4]);
      var isActive = row[7];
      if (ids[id]) invalidRows.push({ row: index + 2, issue: "DUPLICATE_ID", value: id });
      ids[id] = true;
      ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      var source = String(row[6] || "").trim();
      sourceValues[source] = (sourceValues[source] || 0) + 1;
      if (owner !== "Dekker" && owner !== "Erway") invalidRows.push({ row: index + 2, issue: "INVALID_OWNER", value: owner });
      if (CAPITAL_EQUITY_POLICY.TYPES.indexOf(type) === -1) invalidRows.push({ row: index + 2, issue: "INVALID_TYPE", value: type });
      if (!isFinite(nominal)) invalidRows.push({ row: index + 2, issue: "INVALID_NOMINAL", value: nominal });
    });
    result.capitalEquity.idUniqueness = invalidRows.filter(function(r) { return r.issue === "DUPLICATE_ID"; }).length === 0;
    result.capitalEquity.ownerValidity = invalidRows.filter(function(r) { return r.issue === "INVALID_OWNER"; }).length === 0;
    result.capitalEquity.typeValidity = invalidRows.filter(function(r) { return r.issue === "INVALID_TYPE"; }).length === 0;
    result.capitalEquity.nominalValidity = invalidRows.filter(function(r) { return r.issue === "INVALID_NOMINAL"; }).length === 0;
    result.capitalEquity.ownerCounts = ownerCounts;
    result.capitalEquity.typeCounts = typeCounts;
    result.capitalEquity.sourceValues = sourceValues;
    result.capitalEquity.invalidRows = invalidRows.slice(0, 10);
  }

  // 2. FinanceOpeningBalances
  var fobSheet = ss.getSheetByName("FinanceOpeningBalances");
  result.financeOpeningBalances = { exists: !!fobSheet };
  if (fobSheet && fobSheet.getLastRow() > 1) {
    var fobHeaders = fobSheet.getRange(1, 1, 1, fobSheet.getLastColumn()).getValues()[0].map(String);
    var fobData = fobSheet.getRange(2, 1, fobSheet.getLastRow() - 1, fobHeaders.length).getValues();
    var account3200 = fobData.filter(function(row) { return String(row[2] || "").trim() === "3200"; });
    result.financeOpeningBalances.account3200Rows = account3200.length;
    if (account3200.length > 0) {
      result.financeOpeningBalances.account3200EffectiveDate = String(account3200[0][1] || "");
      result.financeOpeningBalances.account3200Amount = Number(account3200[0][3]);
    }
  }

  // 3. Accounts
  var accSheet = ss.getSheetByName("Accounts");
  result.accounts = { exists: !!accSheet };
  if (accSheet && accSheet.getLastRow() > 1) {
    var accData = accSheet.getRange(2, 1, accSheet.getLastRow() - 1, 4).getValues();
    var accountCodes = accData.map(function(row) { return String(row[0] || "").trim(); });
    result.accounts.has3000 = accountCodes.indexOf("3000") !== -1;
    result.accounts.has3100 = accountCodes.indexOf("3100") !== -1;
    result.accounts.has3200 = accountCodes.indexOf("3200") !== -1;
  }

  return result;
}

function doGet(e) {

  var adminRoute = String(e && e.parameter ? e.parameter.admin || "" : "");
  if (adminRoute === "bootstrapRecipeStandardCost") {
    return recipeStandardCostWebResponse_(runBootstrapRecipeStandardCost().status);
  }
  if (adminRoute === "verifyRecipeStandardCost") {
    return recipeStandardCostWebResponse_("VERIFIED");
  }
  if (adminRoute === "diagnoseCapitalEquity") {
    return ContentService.createTextOutput(JSON.stringify(diagnoseCapitalEquityRuntime_()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (adminRoute === "depreciationContinuationDryRun") {
    var depTarget = e && e.parameter && e.parameter.target ? e.parameter.target : "";
    return ContentService.createTextOutput(JSON.stringify(runDepreciationContinuationDryRun(depTarget)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (adminRoute === "depreciationContinuation") {
    var depTarget = e && e.parameter && e.parameter.target ? e.parameter.target : "";
    return ContentService.createTextOutput(JSON.stringify(runDepreciationContinuation(depTarget)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var template =
    HtmlService.createTemplateFromFile("190.View.Index");

  template.appName = PROJECT_CONFIG.APP_NAME;
  template.version = PROJECT_CONFIG.VERSION;
  template.releaseLabel = PROJECT_CONFIG.RELEASE_LABEL;
  template.environment = PROJECT_CONFIG.ENVIRONMENT;
  template.layoutDebugEnabled =
    normalizeLayoutDebugParameter(e);

  return template
    .evaluate()
    .setTitle("Numlock Dashboard")
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}

// ---------------------------------------------------------------------------
// Treasury T9 production preparation (admin/bootstrap surface).
//
// Lives here, NOT in the 99*/202-204 Treasury runtime: the frozen T3/T8 purity
// audits keep every Treasury runtime file free of `.setProperty(` and of any
// sheet-creation/write primitive, and this module already hosts the production
// admin bootstrap routes (doGet `admin` actions).
//
// Scope, exactly: (1) create-if-absent the three Treasury sheets with the
// frozen T3 headers and ZERO business rows — never overwrite an existing
// sheet; (2) establish TREASURY_RECEIPT_V1_CONFIG = PREPARED only after the
// schema readback validates, through the normal T3 reader. PREPARED only:
// this function never writes any other mode, never activates, and never
// touches receipts, operations, audits, the clearing ledger, Cash/Bank, 1030,
// Sales, Orders, Payments, Settlements, or Accounts. Idempotent: a correct
// PREPARED state re-runs as NOOP_ALREADY_PREPARED with zero writes.
// Authority: docs/TREASURY-T2-RECEIPT-AUTHORITY-AND-RECONCILIATION-CONTRACT.md
// (sections 5, 24), docs/TREASURY-T3-CONTRACT-SCHEMA-CONFIG-ACCOUNT-ELIGIBILITY.md.
// ---------------------------------------------------------------------------

var TREASURY_PRODUCTION_PREPARATION = Object.freeze({
  STATUS: Object.freeze({
    PREPARED: "PREPARED",
    NOOP_ALREADY_PREPARED: "NOOP_ALREADY_PREPARED",
    LOCK_TIMEOUT: "LOCK_TIMEOUT",
    RUNTIME_UNAVAILABLE: "RUNTIME_UNAVAILABLE",
    STOP_UNEXPECTED_MODE: "STOP_UNEXPECTED_MODE",
    STOP_CONFIG_MALFORMED: "STOP_CONFIG_MALFORMED",
    STOP_SCHEMA_CONFLICT: "STOP_SCHEMA_CONFLICT",
    STOP_ACCOUNT_READINESS: "STOP_ACCOUNT_READINESS",
    STOP_SHEET_CREATE_FAILED: "STOP_SHEET_CREATE_FAILED",
    STOP_CONFIG_READBACK_MISMATCH: "STOP_CONFIG_READBACK_MISMATCH"
  }),
  SCHEMA_KEYS: Object.freeze(["RECEIPTS", "OPERATIONS", "AUDITS"]),
  CONFIG_VERSION: 1
});

// Zero-write inspection: exact header validation + business-row count per
// Treasury surface, plus the normal T3 config reader state. Never repairs,
// never defaults, never interprets a missing config as any mode.
function treasuryPreparationInspect_(runtime) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT, prep = TREASURY_PRODUCTION_PREPARATION;
  var sheets = {};
  prep.SCHEMA_KEYS.forEach(function(key) {
    var schema = contract.SCHEMAS[key], sheet = null;
    try { sheet = runtime.spreadsheet.getSheetByName(schema.SHEET); }
    catch (error) { sheet = null; }
    var state = { sheet: schema.SHEET, exists: !!sheet, headers: [],
      headerValidation: "ABSENT", headersExact: false, businessRows: 0 };
    if (sheet) {
      try {
        var width = Math.max(Number(sheet.getLastColumn()) || 0, schema.HEADERS.length);
        state.headers = sheet.getRange(1, 1, 1, width).getValues()[0]
          .slice(0, schema.HEADERS.length).map(String);
        state.headerValidation = validateTreasurySchemaHeaders(key, state.headers).status;
        state.headersExact = state.headerValidation === "PASS";
        var lastRow = Number(sheet.getLastRow()) || 0;
        state.businessRows = lastRow > 1 ? lastRow - 1 : 0;
      } catch (error) { state.headerValidation = "UNREADABLE"; }
    }
    sheets[key] = state;
  });
  var raw = null, rawReadable = true;
  try { raw = runtime.properties.getProperty(contract.CONFIG_PROPERTY); }
  catch (error) { rawReadable = false; }
  return {
    sheets: sheets,
    raw: raw,
    rawReadable: rawReadable,
    rawPresent: raw !== null && raw !== undefined && String(raw).trim() !== "",
    configState: rawReadable ? treasuryReceiptConfigFromRaw(raw) :
      { status: "FAIL", config: null, errors: [{ field: "config",
        code: contract.ERROR_CODES.CONFIG_INVALID }] }
  };
}

function treasuryPreparationSnapshot_(result, inspection) {
  var prep = TREASURY_PRODUCTION_PREPARATION;
  prep.SCHEMA_KEYS.forEach(function(key) {
    var state = inspection.sheets[key];
    result.schemas[key] = { sheet: state.sheet, exists: state.exists,
      headerValidation: state.headerValidation, headersExact: state.headersExact,
      headerCount: state.headers.length };
    result.businessRows[state.sheet] = state.businessRows;
  });
  result.config = inspection.configState.status === "PASS" ?
    inspection.configState.config : null;
}

function treasuryPreparationResult_(status, detail) {
  return { status: status, detail: detail || "", writes: { sheets: 0, config: 0 },
    createdSheets: [], schemas: {}, businessRows: {}, config: null,
    readiness: null };
}

// Preparation core. Never acquires a lock (the public entry owns the single
// ScriptLock) and never writes anything except: (a) create-if-absent Treasury
// sheets with exact T3 headers, (b) the single PREPARED config property.
function treasuryProductionPreparationApplyWithRuntime_(runtime) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT, prep = TREASURY_PRODUCTION_PREPARATION;
  var result = treasuryPreparationResult_(prep.STATUS.PREPARED, "");
  var inspection = treasuryPreparationInspect_(runtime);
  treasuryPreparationSnapshot_(result, inspection);

  // 1) Property unreadable => fail closed, zero writes.
  if (!inspection.rawReadable) {
    result.status = prep.STATUS.STOP_CONFIG_MALFORMED;
    result.detail = "CONFIG_PROPERTY_UNREADABLE";
    return result;
  }
  // 2) A valid non-PREPARED mode is never downgraded, paused or activated here.
  if (inspection.configState.status === "PASS" &&
      String(inspection.configState.config.mode) !== "PREPARED") {
    result.status = prep.STATUS.STOP_UNEXPECTED_MODE;
    result.detail = "EXISTING_MODE_" + String(inspection.configState.config.mode);
    return result;
  }
  // 3) Present-but-invalid config: fail closed, never repaired, never defaulted.
  if (inspection.rawPresent && inspection.configState.status !== "PASS") {
    result.status = prep.STATUS.STOP_CONFIG_MALFORMED;
    result.detail = "EXISTING_CONFIG_INVALID";
    return result;
  }
  // 4) Existing sheet with wrong headers: STOP, never overwritten.
  var conflicts = prep.SCHEMA_KEYS.filter(function(key) {
    return inspection.sheets[key].exists &&
      inspection.sheets[key].headerValidation !== "PASS";
  });
  if (conflicts.length) {
    result.status = prep.STATUS.STOP_SCHEMA_CONFLICT;
    result.detail = conflicts.map(function(key) {
      return inspection.sheets[key].sheet;
    }).join(",");
    return result;
  }
  // 5) Account authority (destinations + 1030 clearing) BEFORE any write.
  var accountRows = null;
  try { accountRows = treasuryReceiptAccountRows_(runtime.spreadsheet); }
  catch (error) {
    result.status = prep.STATUS.STOP_ACCOUNT_READINESS;
    result.detail = "ACCOUNTS:" + String(error && error.message || error);
    return result;
  }
  var ineligible = contract.DESTINATION_ACCOUNT_CODES.filter(function(code) {
    return treasuryDestinationEligible(code, accountRows).eligible !== true;
  });
  var clearing = treasuryClearingPreflight(accountRows);
  result.readiness = { clearing: clearing.status, destinations:
    contract.DESTINATION_ACCOUNT_CODES.map(function(code) {
      return { accountCode: code,
        eligible: treasuryDestinationEligible(code, accountRows).eligible === true };
    }) };
  if (ineligible.length || clearing.status !== "PASS") {
    result.status = prep.STATUS.STOP_ACCOUNT_READINESS;
    result.detail = "DESTINATIONS:" + ineligible.join(",") + ";CLEARING:" + clearing.status;
    return result;
  }
  // 6) Create ONLY absent sheets (exact frozen headers, zero business rows).
  for (var i = 0; i < prep.SCHEMA_KEYS.length; i++) {
    var key = prep.SCHEMA_KEYS[i], schema = contract.SCHEMAS[key];
    if (inspection.sheets[key].exists) continue;
    try { runtime.createSheet(schema.SHEET, schema.HEADERS.slice()); }
    catch (error) {
      result.status = prep.STATUS.STOP_SHEET_CREATE_FAILED;
      result.detail = schema.SHEET + ":" + String(error && error.message || error);
      return result;
    }
    result.writes.sheets += 1;
    result.createdSheets.push(schema.SHEET);
  }
  // 7) Schema readback through the exact T3 validators; zero business rows.
  var verify = treasuryPreparationInspect_(runtime);
  treasuryPreparationSnapshot_(result, verify);
  var bad = prep.SCHEMA_KEYS.filter(function(key) {
    return !verify.sheets[key].headersExact || verify.sheets[key].businessRows !== 0;
  });
  if (bad.length) {
    result.status = prep.STATUS.STOP_SCHEMA_CONFLICT;
    result.detail = "READBACK:" + bad.map(function(key) {
      return verify.sheets[key].sheet + "(" + verify.sheets[key].headerValidation +
        ",rows=" + verify.sheets[key].businessRows + ")";
    }).join(",");
    return result;
  }
  // 8) PREPARED config only after the schemas validate. PREPARED is the first
  // frozen mode; no other mode literal exists in this function and no
  // activation metadata is ever produced here.
  var prepared = {
    contractVersion: contract.CONTRACT_VERSION,
    mode: contract.MODES[0],
    activationID: "",
    activatedAt: "",
    configVersion: prep.CONFIG_VERSION
  };
  if (String(prepared.mode) !== "PREPARED") {
    result.status = prep.STATUS.STOP_CONFIG_READBACK_MISMATCH;
    result.detail = "PREPARED_MODE_NOT_FIRST";
    return result;
  }
  if (verify.configState.status !== "PASS") {
    runtime.properties.setProperty(contract.CONFIG_PROPERTY, JSON.stringify(prepared));
    result.writes.config = 1;
  }
  // 9) Config readback through the normal T3 reader (classifies, never repairs).
  var readback = treasuryPreparationInspect_(runtime);
  var config = readback.configState.config;
  treasuryPreparationSnapshot_(result, readback);
  if (readback.configState.status !== "PASS" || !config ||
      String(config.mode) !== "PREPARED" ||
      config.contractVersion !== contract.CONTRACT_VERSION ||
      config.activationID !== "" || config.activatedAt !== "" ||
      config.configVersion !== prep.CONFIG_VERSION) {
    result.status = prep.STATUS.STOP_CONFIG_READBACK_MISMATCH;
    result.detail = "CONFIG_READBACK";
    return result;
  }
  result.status = (result.writes.sheets === 0 && result.writes.config === 0) ?
    prep.STATUS.NOOP_ALREADY_PREPARED : prep.STATUS.PREPARED;
  return result;
}

// Production runtime factory. Spreadsheet identity is the canonical resolver
// (never the active-spreadsheet guess); config is read-only until the single
// PREPARED write inside the core.
function treasuryProductionPreparationRuntime_() {
  var ss = requireNumlockProductionSpreadsheet();
  return {
    spreadsheet: ss,
    properties: PropertiesService.getScriptProperties(),
    createSheet: function(name, headers) {
      var sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      return sheet;
    }
  };
}

// Public entry (Apps Script editor / Execution API). The ONLY outer lock:
// acquired before any read or write, released exactly once in finally. Lock or
// runtime failure returns before any mutation. Never callable from a Treasury
// write path; never invoked by application load.
function prepareTreasuryReceiptV1Production() {
  var prep = TREASURY_PRODUCTION_PREPARATION;
  var runtime;
  try { runtime = treasuryProductionPreparationRuntime_(); }
  catch (error) {
    return treasuryPreparationResult_(prep.STATUS.RUNTIME_UNAVAILABLE,
      String(error && error.message || error));
  }
  var lock = null, acquired = false;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return treasuryPreparationResult_(prep.STATUS.LOCK_TIMEOUT,
      String(error && error.message || error));
  }
  try {
    return treasuryProductionPreparationApplyWithRuntime_(runtime);
  } finally {
    if (acquired) {
      try { lock.releaseLock(); } catch (lockError) { /* lock auto-expires */ }
    }
  }
}
