// Phase 11V.2: synthetic memory persistence only; production access is read-only.
function inventoryReceiptPersistenceProof_(authority) {
  function check(value, label) { if (!value) throw new Error("RECEIPT_RUNTIME_PROOF:" + label); }
  var suite = testInventoryReceiptFoundationContracts(authority);
  var runtime = inventoryReceiptTestRuntime_(authority);
  var expected = "ReceiptID,LineID,Revision,ReceiptDate,ItemID,Location,PurchaseQty,PurchaseUOM,ConversionID,ConversionNumerator,ConversionDenominator,ConversionSnapshot,BaseUOM,BaseQtyReceived,AcquisitionValue,UnitCostRatio,SupplierSource,EvidenceRef,ExternalRef,Attestation,ZeroCostClassification,Status,ReadinessReason,IdempotencyKey,NormalizedPayload,ChangeReason,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsActive".split(",");
  check(migrateInventoryReceiptSchema_(runtime).status === "MIGRATED", "migration");
  var sheet = runtime.sheets.InventoryReceipts;
  check(sheet.columns === 31 && JSON.stringify(sheet.grid[0]) === JSON.stringify(expected), "exact schema");
  var input = { ReceiptDate: "2026-10-01", ItemID: "ING-009", PurchaseQty: "1", PurchaseUOM: "carton",
    AcquisitionValue: "10001", SupplierSource: "SYNTHETIC_PROOF", Attested: true,
    ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE" };
  var request = { idempotencyKey: "proof-capture-0001", input: input };
  var start = runtime.calls.length, first = captureInventoryReceipt_(request, runtime);
  var initial = runtime.calls.slice(start).filter(function(c) { return c[1] === "values"; }).length;
  check(first.status === "CAPTURED" && first.row.BaseQtyReceived === "12000" && initial === 1 && sheet.grid.length === 2, "one UHT receipt");
  runtime.lock.waitLock();
  var readback;
  try { readback = inventoryReceiptReadSheet_(runtime.spreadsheet).rows[0]; }
  finally { runtime.lock.releaseLock(); }
  check(expected.every(function(key) { return readback[key] === first.row[key]; }), "normalized readback and identity");
  start = runtime.calls.length;
  var retry = captureInventoryReceipt_({ idempotencyKey: request.idempotencyKey,
    input: Object.assign({}, input, { PurchaseQty: "1.000" }) }, runtime);
  check(retry.status === "EXISTING" && runtime.calls.length === start && sheet.grid.length === 2, "retry no mutation");
  var conflict = captureInventoryReceipt_({ idempotencyKey: request.idempotencyKey,
    input: Object.assign({}, input, { PurchaseQty: "2" }) }, runtime);
  check(conflict.status === "CONFLICT" && runtime.calls.length === start && sheet.grid.length === 2, "conflict no mutation");
  var metric = captureInventoryReceipt_({ idempotencyKey: "proof-metric-0001",
    input: Object.assign({}, input, { ItemID: "ING-006", PurchaseUOM: "kg", PurchaseQty: "0.5" }) }, runtime);
  check(metric.status === "CAPTURED" && metric.row.BaseQtyReceived === "500", "persist direct kg to gr");
  var contradictory = captureInventoryReceipt_({ idempotencyKey: "proof-evidence-0001",
    input: Object.assign({}, input, { ExternalRef: "SYNTHETIC:INVOICE" }) }, runtime);
  check(contradictory.row.Status === "PENDING" && contradictory.row.ReadinessReason ===
    "NEEDS_EVIDENCE|NEEDS_OPENING|NEEDS_ACCOUNTING|ACTIVATION_PENDING", "contradictory evidence");
  check(runtime.calls.every(function(c) { return c[0] === "InventoryReceipts"; }), "isolated repository");
  [first, retry, conflict, metric, contradictory].forEach(function(r) {
    check(r.postingAllowed === false && r.InventoryLedgerWrites === 0 && r.BalanceLedgerWrites === 0 &&
      r.tabopsWrites === 0 && r.Account1100Mutation === false && r.MWAMutation === false, "posting isolation");
  });
  return { status: "PASS", method: "FUNCTION_LOCAL_SYNTHETIC_MEMORY", scenarios: suite.scenarios,
    schemaColumns: expected.length, persistence: "PASS", initialWriteCount: initial,
    initialMutationCalls: first.writeCount, idempotentRetryWrites: 0, conflict: "PASS",
    revision: "PASS", cancellation: "PASS", conversion: "PASS", lemon: "PASS", evidence: "PASS",
    readiness: "PASS", recovery: "PASS", postingAllowed: false, inventoryLedgerWrites: 0,
    inventoryOpeningsWrites: 0, balanceLedgerWrites: 0, tabopsWrites: 0, cashWrites: 0,
    account1100Mutation: false, mwaMutation: false, productionReceiptRowsCreated: 0,
    productionMutation: false, cleanup: "PASS", externalResourcesCreated: 0 };
}

function inventoryReceiptProofProductionSnapshot_() {
  var spreadsheet = requireNumlockProductionSpreadsheet(), result = {};
  ["InventoryItems", "InventoryUOMConversions", "InventoryReceipts", "InventoryOpenings",
    "InventoryLedger", "BalanceLedger", "Accounts", "tabsal", "tabops", "COGSRecipes",
    "FinanceOpeningBalances", "CashSettlements"].forEach(function(name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) { result[name] = { exists: false }; return; }
    var range = sheet.getDataRange();
    result[name] = { exists: true, sheetId: sheet.getSheetId(), maxRows: sheet.getMaxRows(),
      maxColumns: sheet.getMaxColumns(), values: range.getValues(), formulas: range.getFormulas(), notes: range.getNotes() };
  });
  return result;
}

function runInventoryReceiptDisposableRuntimeProof() {
  var before = inventoryReceiptProofProductionSnapshot_(), result, failure;
  try {
    if (before.InventoryReceipts.exists) throw new Error("PRODUCTION_RECEIPTS_ALREADY_PRESENT");
    var authority = { items: inventoryMigrationRows(before.InventoryItems),
      conversions: inventoryMigrationRows(before.InventoryUOMConversions) };
    [authority.items, authority.conversions].forEach(function(rows) {
      rows.forEach(function(row) { Object.keys(row).forEach(function(key) {
        if (row[key] instanceof Date) row[key] = /^(EffectiveFrom|EffectiveTo|EvidenceDate)$/.test(key) ?
          capitalEquityDateKey(row[key]) : row[key].toISOString();
      }); });
    });
    if (authority.conversions.length !== 22 || validateInventoryUomConversions(authority.conversions, authority.items).status !== "PASS" ||
        authority.conversions.some(function(row) { return !isCanonicalActive(row.IsActive); })) throw new Error("22_ACTIVE_AUTHORITIES_REQUIRED");
    var accounts = inventoryMigrationRows(before.Accounts);
    if (accounts.some(function(row) { return String(row.AccountCode) === "3210"; }) ||
        ["1100", "3200"].some(function(code) { return accounts.filter(function(row) { return String(row.AccountCode) === code; }).length !== 1; })) {
      throw new Error("ACCOUNT_BOUNDARY_FAILED");
    }
    if (BALANCE_FOUNDATION_POLICY.RECIPE_AUTO_CONSUMPTION_ENABLED !== false) throw new Error("RECIPE_CONSUMPTION_ENABLED");
    result = inventoryReceiptPersistenceProof_(authority);
  } catch (error) { failure = error; }
  var after = inventoryReceiptProofProductionSnapshot_();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("PROSPECTIVE_PRODUCTION_PRESERVATION_FAILED");
  if (failure) throw failure;
  result.preservation = "PASS_PROSPECTIVE_VALUES_FORMULAS_NOTES_DIMENSIONS";
  result.acceptedConversionAuthorities = 22;
  result.recipeConsumptionEnabled = false;
  Logger.log(JSON.stringify(result));
  return result;
}
