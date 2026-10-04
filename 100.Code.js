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
