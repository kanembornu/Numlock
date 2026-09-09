// Phase 11V.3: schema only. One atomic batch; no business-row or recovery entry point.
var INVENTORY_RECEIPT_MIGRATION = Object.freeze({
  OWNER: "NUMLOCK_INVENTORY_RECEIPTS_11V3", SHEET_ID: 113310031,
  HEADERS: "ReceiptID,LineID,Revision,ReceiptDate,ItemID,Location,PurchaseQty,PurchaseUOM,ConversionID,ConversionNumerator,ConversionDenominator,ConversionSnapshot,BaseUOM,BaseQtyReceived,AcquisitionValue,UnitCostRatio,SupplierSource,EvidenceRef,ExternalRef,Attestation,ZeroCostClassification,Status,ReadinessReason,IdempotencyKey,NormalizedPayload,ChangeReason,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsActive"
});

function inventoryReceiptMigrationCanonical_(value) {
  if (Array.isArray(value)) return "[" + value.map(inventoryReceiptMigrationCanonical_).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(function(key) {
    return JSON.stringify(key) + ":" + inventoryReceiptMigrationCanonical_(value[key]);
  }).join(",") + "}";
  return JSON.stringify(value);
}

function inventoryReceiptMigrationContract_() {
  var headers = INVENTORY_RECEIPT_POLICY.HEADERS;
  if (headers.length !== 31 || headers.some(function(h, i) { return !h || headers.indexOf(h) !== i; }) ||
      headers.join(",") !== INVENTORY_RECEIPT_MIGRATION.HEADERS || INVENTORY_RECEIPT_POLICY.POSTING_ALLOWED !== false) {
    throw new Error("FROZEN_RECEIPT_SCHEMA_MISMATCH");
  }
  return headers.slice();
}

// Preserve API omission semantics and absolute coordinates from the POST-11U snapshot.
function inventoryReceiptMigrationSheet_(sheet) {
  var cells = {};
  (sheet.data || []).forEach(function(block) {
    (block.rowData || []).forEach(function(row, r) {
      (row.values || []).forEach(function(cell, c) {
        if (Object.keys(cell).length) cells[(r + (block.startRow || 0) + 1) + "," + (c + (block.startColumn || 0) + 1)] = cell;
      });
    });
  });
  return { properties: sheet.properties, cells: cells };
}

function inventoryReceiptMigrationClassify_(sheet) {
  var headers = inventoryReceiptMigrationContract_(), result = { status: "READY_CREATE", writeCount: 0,
    schemaColumns: 31, businessRows: 0, postingAllowed: false, recovery: "NOT_NEEDED" };
  if (!sheet) return result;
  function refuse(reason) { result.status = "REFUSE"; result.reason = reason; return result; }
  var metadata = sheet.developerMetadata || [], owner;
  if (metadata.length !== 1 || metadata[0].metadataKey !== INVENTORY_RECEIPT_MIGRATION.OWNER ||
      metadata[0].visibility !== "DOCUMENT" || !metadata[0].location ||
      metadata[0].location.sheetId !== sheet.properties.sheetId) return refuse("OWNERSHIP_AMBIGUOUS");
  try { owner = JSON.parse(metadata[0].metadataValue); } catch (error) { return refuse("OWNERSHIP_INVALID"); }
  if (owner.headers !== INVENTORY_RECEIPT_MIGRATION.HEADERS || owner.sheetId !== INVENTORY_RECEIPT_MIGRATION.SHEET_ID ||
      owner.sheetId !== sheet.properties.sheetId || !/^[a-f0-9]{64}$/.test(owner.preservation || "")) return refuse("OWNERSHIP_INVALID");
  if (sheet.properties.gridProperties.columnCount !== 31 || sheet.properties.sheetType !== "GRID") return refuse("UNEXPECTED_COLUMNS_OR_TYPE");
  var cells = inventoryReceiptMigrationSheet_(sheet).cells, grid = [], invalid = false;
  Object.keys(cells).forEach(function(key) {
    var rc = key.split(",").map(Number), cell = cells[key], value = cell.userEnteredValue || {};
    if (rc[1] > 31 || cell.note || value.formulaValue !== undefined || Object.keys(cell).some(function(k) {
      return ["userEnteredValue", "effectiveValue", "note"].indexOf(k) === -1;
    })) invalid = true;
    if (rc[0] > 1 && Object.keys(cell).length) result.businessRows = Math.max(result.businessRows, rc[0] - 1);
    if (Object.keys(value).length) {
      if (!grid[rc[0] - 1]) grid[rc[0] - 1] = [];
      grid[rc[0] - 1][rc[1] - 1] = value.stringValue !== undefined ? value.stringValue : value.numberValue !== undefined ? value.numberValue : value.boolValue;
    } else if (Object.keys(cell.effectiveValue || {}).length) invalid = true;
  });
  if (invalid) return refuse("UNEXPECTED_DATA_FORMULA_OR_NOTE");
  var header = grid[0] || [], exact = headers.every(function(h, i) { return header[i] === h; });
  if (!exact) {
    if (result.businessRows || header.some(function(h, i) { return h !== undefined && h !== "" && h !== headers[i]; })) return refuse("FOREIGN_PARTIAL_STATE");
    result.status = "RECOVERABLE"; result.recovery = "OWNED_EXACT_HEADER_COMPLETION_ONLY_NO_AUTOMATIC_RECOVERY"; return result;
  }
  try {
    var rows = [];
    for (var r = 1; r <= result.businessRows; r++) {
      var row = {}; headers.forEach(function(h, i) { row[h] = (grid[r] || [])[i] === undefined ? "" : grid[r][i]; }); rows.push(row);
    }
    inventoryReceiptHistory_(rows);
  } catch (error) { return refuse("INVALID_RECEIPT_ROWS"); }
  result.status = "ALREADY_MIGRATED"; result.owner = owner; return result;
}

// Derived from the frozen POST-11U snapshot; verified by the local harness.
var INVENTORY_RECEIPT_POST11U = Object.freeze({
  "tabsal": "01244ae74a057adccaee2a7b51d7fc1227c3805fe5b87aca3255cb68210be7bf",
  "InventoryOpenings": "33ed4e4628f473aae66bbabd607ecbcf721dbf098620b96b13b4f9c1ae1307f9",
  "InventoryItems": "c4e5e8140da3c0d36590dba392a4c8318f3752bf7d872b1f0f3178596fd0b027",
  "InventoryUOMConversions": "ec4fe8d781c8aeb8a06a718231bf0cc6e2e2774a01b150cc46dd668895d19217",
  "InventoryLedger": "0aa42e9d190890e726b0a7d536462ffbef7f24c2b37b5a961da17aca4d104f84",
  "BalanceLedger": "031b4d1d8da5430152ec222a3df1bd2d2c315f75eda21ea51f16ab27464e27bc",
  "FinanceOpeningBalances": "58dc60af03362659852155f40fbb86b33c697a7df795c9d6f3bc0554514fd781",
  "Accounts": "a5e284c82cbddf43258d8c66b9fb39614ef5ae12265dc8d701c4eff2b6d81aa1",
  "COGSRecipes": "605cee780d5262d1c22bb20d92d7de229197437ee5ec9b1b4114016ddf9d4d79"
});

function inventoryReceiptMigrationDigest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, inventoryReceiptMigrationCanonical_(value), Utilities.Charset.UTF_8)
    .map(function(b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join("");
}

function inventoryReceiptMigrationRequest_(method, suffix, body) {
  var token = ScriptApp.getOAuthToken();
  var options = { method: method, headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true };
  if (body) { options.contentType = "application/json"; options.payload = JSON.stringify(body); }
  var response = UrlFetchApp.fetch("https://sheets.googleapis.com/v4/spreadsheets/" +
    NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID + suffix, options);
  if (response.getResponseCode() !== 200) {
    // Diagnostic-only: retain Google error reasons, never tokens or arbitrary payload fields.
    var diagnostic = "UNPARSEABLE_ERROR_BODY";
    function sanitize(value) {
      if (typeof value !== "string") return "";
      return value.split(token).join("[REDACTED]")
        .replace(/Bearer\s+[^\s"',;]+/gi, "Bearer [REDACTED]")
        .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL_REDACTED]")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_REDACTED]")
        .replace(/[A-Za-z0-9_-]{40,}|\b\d{6,}\b/g, "[ID_REDACTED]")
        .replace(/[\r\n\t]/g, " ").slice(0, 1000);
    }
    try {
      var error = JSON.parse(response.getContentText()).error || {};
      diagnostic = JSON.stringify({ code: typeof error.code === "number" ? error.code : response.getResponseCode(),
        status: sanitize(error.status), message: sanitize(error.message),
        errors: (Array.isArray(error.errors) ? error.errors : []).slice(0, 5).map(function(e) {
          return { reason: sanitize(e.reason), domain: sanitize(e.domain), message: sanitize(e.message) };
        }),
        details: (Array.isArray(error.details) ? error.details : []).slice(0, 5).map(function(d) {
          return { reason: sanitize(d.reason), domain: sanitize(d.domain), service: sanitize((d.metadata || {}).service) };
        }) });
    } catch (ignored) { /* Never log a raw/non-JSON response body. */ }
    throw new Error("RECEIPT_SHEETS_HTTP_" + response.getResponseCode() + " " + diagnostic);
  }
  return JSON.parse(response.getContentText());
}

function inventoryReceiptMigrationRead_() {
  return inventoryReceiptMigrationRequest_("get", "?fields=" + encodeURIComponent(
    "spreadsheetId,properties,sheets(properties,developerMetadata,data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,note))))"));
}

function inventoryReceiptMigrationRows_(sheet) {
  if (!sheet) throw new Error("REQUIRED_PRESERVATION_SHEET_MISSING");
  var cells = inventoryReceiptMigrationSheet_(sheet).cells, grid = [];
  Object.keys(cells).forEach(function(key) {
    var rc = key.split(",").map(Number), v = cells[key].effectiveValue || cells[key].userEnteredValue || {};
    if (!grid[rc[0] - 1]) grid[rc[0] - 1] = [];
    grid[rc[0] - 1][rc[1] - 1] = v.stringValue !== undefined ? v.stringValue : v.numberValue !== undefined ? v.numberValue : v.boolValue !== undefined ? v.boolValue : "";
  });
  var headers = grid[0] || [];
  return grid.slice(1).filter(function(row) { return row && row.some(function(v) { return v !== ""; }); }).map(function(values) {
    var row = {}; headers.forEach(function(h, i) {
      if (!h) return;
      var v = values[i] === undefined ? "" : values[i];
      if (typeof v === "number" && /^(EffectiveFrom|EffectiveTo|EvidenceDate)$/.test(h)) v = new Date((v - 25569) * 86400000).toISOString().slice(0, 10);
      if (typeof v === "number" && /^(PreparedAt|ReviewedAt|CreatedAt|UpdatedAt)$/.test(h)) v = new Date(Math.round((v - 25569) * 86400000)).toISOString();
      row[h] = v;
    }); return row;
  });
}

function inventoryReceiptMigrationEvaluate_(snapshot, digest) {
  if (snapshot.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) throw new Error("PRODUCTION_IDENTITY_MISMATCH");
  var byName = {}, preserved = {}, result;
  (snapshot.sheets || []).forEach(function(sheet) {
    byName[sheet.properties.title] = sheet;
    if (sheet.properties.title !== "InventoryReceipts") {
      preserved[sheet.properties.title] = inventoryReceiptMigrationSheet_(sheet);
      preserved[sheet.properties.title].developerMetadata = sheet.developerMetadata || [];
    }
  });
  result = inventoryReceiptMigrationClassify_(byName.InventoryReceipts);
  result.headers = inventoryReceiptMigrationContract_();
  result.preservationFingerprint = digest({ properties: snapshot.properties, sheets: preserved });
  result.preservation = "UNVERIFIED";
  try {
    Object.keys(INVENTORY_RECEIPT_POST11U).forEach(function(name) {
      if (!byName[name] || digest(inventoryReceiptMigrationSheet_(byName[name])) !== INVENTORY_RECEIPT_POST11U[name]) {
        throw new Error("POST11U_PRESERVATION_DRIFT:" + name);
      }
    });
    var items = inventoryReceiptMigrationRows_(byName.InventoryItems), conversions = inventoryReceiptMigrationRows_(byName.InventoryUOMConversions);
    if (conversions.length !== 22 || validateInventoryUomConversions(conversions, items).status !== "PASS" ||
        conversions.some(function(row) { return !isCanonicalActive(row.IsActive); })) throw new Error("22_ACTIVE_AUTHORITIES_REQUIRED");
    var accounts = inventoryReceiptMigrationRows_(byName.Accounts);
    if (accounts.some(function(row) { return String(row.AccountCode) === "3210"; }) || ["1100", "3200"].some(function(code) {
      return accounts.filter(function(row) { return String(row.AccountCode) === code; }).length !== 1;
    })) throw new Error("ACCOUNT_BOUNDARY_FAILED");
    ["InventoryOpenings", "InventoryLedger", "BalanceLedger"].forEach(function(name) {
      if (inventoryReceiptMigrationRows_(byName[name]).length) throw new Error("DOWNSTREAM_ROWS_PRESENT:" + name);
    });
    if (!byName.tabops || !byName.Settlements || BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED !== false) throw new Error("ISOLATION_BOUNDARY_FAILED");
    if (result.status === "READY_CREATE" && snapshot.sheets.some(function(sheet) {
      return sheet.properties.sheetId === INVENTORY_RECEIPT_MIGRATION.SHEET_ID;
    })) throw new Error("RESERVED_SHEET_ID_OCCUPIED");
    if (result.owner && result.owner.preservation !== result.preservationFingerprint) throw new Error("PROSPECTIVE_PRESERVATION_DRIFT");
    result.preservation = "PASS_POST11U_AND_CURRENT_RECORDED_SURFACES";
    result.conversionAuthorities = 22; result.recipeConsumptionEnabled = false; result.Account3210 = "ABSENT";
  } catch (error) { result.status = "REFUSE"; result.reason = error.message; }
  delete result.owner;
  return result;
}

function inventoryReceiptMigrationBatch_(preflight) {
  if (preflight.status !== "READY_CREATE" || preflight.writeCount !== 0 || preflight.businessRows !== 0 ||
      preflight.postingAllowed !== false || !/^[a-f0-9]{64}$/.test(preflight.preservationFingerprint || "")) throw new Error("READY_CREATE_REQUIRED");
  var id = INVENTORY_RECEIPT_MIGRATION.SHEET_ID;
  return { requests: [
    { addSheet: { properties: { sheetId: id, title: "InventoryReceipts", gridProperties: { rowCount: 1000, columnCount: 31 } } } },
    { updateCells: { start: { sheetId: id, rowIndex: 0, columnIndex: 0 }, rows: [{ values: inventoryReceiptMigrationContract_().map(function(header) {
      return { userEnteredValue: { stringValue: header } };
    }) }], fields: "userEnteredValue" } },
    { createDeveloperMetadata: { developerMetadata: { metadataKey: INVENTORY_RECEIPT_MIGRATION.OWNER,
      metadataValue: JSON.stringify({ sheetId: id, headers: INVENTORY_RECEIPT_MIGRATION.HEADERS, preservation: preflight.preservationFingerprint }),
      location: { sheetId: id }, visibility: "DOCUMENT" } } }
  ] };
}

// Injected seam makes every attempted mutation visible to focused tests. Never retries.
function executeInventoryReceiptProductionMigration_(runtime) {
  var state = inventoryReceiptMigrationEvaluate_(runtime.read(), runtime.digest);
  if (state.status !== "READY_CREATE") return state;
  var batch = inventoryReceiptMigrationBatch_(state);
  try {
    runtime.batch(batch);
    return { status: "MIGRATED", writeCount: 1, mutationUnit: "ATOMIC_BATCH_UPDATE", subrequests: 3,
      schemaColumns: 31, businessRows: 0, postingAllowed: false, acceptance: "READ_ONLY_ACCEPTANCE_REQUIRED",
      productionMutation: true, preflightFingerprint: state.preservationFingerprint };
  } catch (error) {
    return { status: "MIGRATION_UNCERTAIN", writeCount: "UNKNOWN", attemptedBatchCount: 1,
      postingAllowed: false, productionMutation: "UNKNOWN", reason: error.message, next: "STOP_NO_RETRY_OR_RECOVERY" };
  }
}

function runInventoryReceiptProductionPreflight() {
  var result = inventoryReceiptMigrationEvaluate_(inventoryReceiptMigrationRead_(), inventoryReceiptMigrationDigest_);
  result.productionMutation = false;
  Logger.log(JSON.stringify(result)); return result;
}

function runInventoryReceiptProductionMigration() {
  var actor = Session.getActiveUser().getEmail();
  if (!actor || actor !== Session.getEffectiveUser().getEmail()) throw new Error("AUTHENTICATED_OPERATOR_REQUIRED");
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var result = executeInventoryReceiptProductionMigration_({ read: inventoryReceiptMigrationRead_, digest: inventoryReceiptMigrationDigest_,
      batch: function(body) { return inventoryReceiptMigrationRequest_("post", ":batchUpdate", body); } });
    Logger.log(JSON.stringify(result)); return result;
  } finally { lock.releaseLock(); }
}

function runInventoryReceiptProductionAcceptance() {
  var result = inventoryReceiptMigrationEvaluate_(inventoryReceiptMigrationRead_(), inventoryReceiptMigrationDigest_);
  result.migrationState = result.status;
  result.status = result.status === "ALREADY_MIGRATED" && result.businessRows === 0 ? "PASS" : "REFUSE";
  result.hypotheticalRetryWrites = result.status === "PASS" ? 0 : "UNVERIFIED";
  result.productionMutation = false;
  Logger.log(JSON.stringify(result)); return result;
}

function runInventoryReceiptMigrationDisposableRuntimeProof() {
  var result = testInventoryReceiptMigrationContracts();
  result.headers = inventoryReceiptMigrationContract_(); result.schemaColumns = 31;
  result.postingAllowed = false; result.cleanup = "PASS_FUNCTION_LOCAL_MEMORY";
  // A read-only transport probe establishes Sheets API access without evaluating production readiness.
  var identity = inventoryReceiptMigrationRequest_("get", "?fields=spreadsheetId");
  if (identity.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) throw new Error("PRODUCTION_IDENTITY_MISMATCH");
  result.transportRead = "PASS";
  Logger.log(JSON.stringify(result)); return result;
}
