// Explicit schema-only operator entry point; never called by application flows or tests.
// Uses the existing canonical-storage Sheets transport, not the receipt migration executor.
function purchaseEventMigrationHeaders_() {
  var headers = PURCHASE_EVENT_POLICY.headers;
  if (PURCHASE_EVENT_POLICY.sheet !== 'PurchaseEvents' || headers.length !== 25 ||
      headers.some(function(h, i) { return !h || headers.indexOf(h) !== i; }) ||
      PURCHASE_EVENT_POLICY.enabled !== false || EXPENSE_PURCHASE_POLICY.enabled !== false) {
    throw new Error('PURCHASE_SCHEMA_OR_ACTIVATION_DRIFT');
  }
  return headers.slice();
}

function purchaseEventMigrationClassify_(snapshot) {
  var headers = purchaseEventMigrationHeaders_();
  var result = { status: 'READY_CREATE', writeCount: 0, headerCount: headers.length,
    businessRows: 0, postingAllowed: false };
  function blocked(reason) { result.status = 'BLOCKED'; result.reason = reason; return result; }
  if (!snapshot || !Array.isArray(snapshot.sheets)) return blocked('INVALID_SNAPSHOT');
  var matches = snapshot.sheets.filter(function(s) { return s.properties.title === PURCHASE_EVENT_POLICY.sheet; });
  if (!matches.length) return result;
  if (matches.length !== 1) return blocked('AMBIGUOUS_SHEET');
  var sheet = matches[0], grid = sheet.properties.gridProperties;
  if (sheet.properties.sheetType !== 'GRID' || !grid || grid.columnCount < headers.length) return blocked('MALFORMED_GRID');
  var cells = inventoryReceiptMigrationSheet_(sheet).cells, invalid = false, rows = {};
  headers.forEach(function(h, i) {
    var cell = cells['1,' + (i + 1)] || {}, value = cell.userEnteredValue || {};
    if (value.stringValue !== h || Object.keys(value).length !== 1 || cell.note) invalid = true;
  });
  Object.keys(cells).forEach(function(key) {
    var rc = key.split(',').map(Number), cell = cells[key];
    var populated = Object.keys(cell.userEnteredValue || {}).length || Object.keys(cell.effectiveValue || {}).length;
    if (rc[1] > headers.length && (populated || cell.note)) invalid = true;
    if (rc[0] > 1 && populated) rows[rc[0]] = true;
  });
  if (invalid) return blocked('INCOMPATIBLE_PURCHASE_SCHEMA');
  result.status = 'ALREADY_MIGRATED'; result.businessRows = Object.keys(rows).length;
  return result;
}

// Caller owns the lock. Tests inject only local snapshots/batches; no Google services.
function executePurchaseEventSchemaMigration_(runtime) {
  var before = runtime.read(), state = purchaseEventMigrationClassify_(before);
  if (state.status !== 'READY_CREATE') return state;
  var headers = purchaseEventMigrationHeaders_(), id = 0;
  var ids = before.sheets.map(function(s) { return s.properties.sheetId; });
  while (ids.indexOf(id) !== -1) id++;
  var body = { requests: [
    { addSheet: { properties: { sheetId: id, title: PURCHASE_EVENT_POLICY.sheet,
      gridProperties: { rowCount: 1000, columnCount: headers.length } } } },
    { updateCells: { start: { sheetId: id, rowIndex: 0, columnIndex: 0 },
      rows: [{ values: headers.map(function(h) { return { userEnteredValue: { stringValue: h } }; }) }],
      fields: 'userEnteredValue' } }
  ] };
  try {
    runtime.batch(body);
    var after = runtime.read(), accepted = purchaseEventMigrationClassify_(after);
    var preserved = after.sheets.filter(function(s) { return s.properties.title !== PURCHASE_EVENT_POLICY.sheet; });
    if (accepted.status !== 'ALREADY_MIGRATED' || accepted.businessRows !== 0 ||
        inventoryReceiptMigrationCanonical_(preserved) !== inventoryReceiptMigrationCanonical_(before.sheets)) {
      throw new Error('PURCHASE_SCHEMA_READBACK_FAILED');
    }
    return { status: 'MIGRATED', writeCount: 1, mutationUnit: 'ATOMIC_BATCH_UPDATE', subrequests: 2,
      headerCount: headers.length, businessRows: 0, postingAllowed: false, preservation: 'PASS' };
  } catch (error) {
    return { status: 'MIGRATION_UNCERTAIN', writeCount: 'UNKNOWN', attemptedBatchCount: 1,
      postingAllowed: false, reason: error.message, next: 'STOP_NO_RETRY_OR_RECOVERY' };
  }
}

// Future production execution requires separate explicit authorization. No activation writes.
function runPurchaseEventSchemaMigration() {
  var actor = Session.getActiveUser().getEmail();
  if (!actor || actor !== Session.getEffectiveUser().getEmail()) throw new Error('AUTHENTICATED_OPERATOR_REQUIRED');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var result = executePurchaseEventSchemaMigration_({ read: inventoryReceiptMigrationRead_,
      batch: function(body) { return inventoryReceiptMigrationRequest_('post', ':batchUpdate', body); } });
    Logger.log(JSON.stringify(result)); return result;
  } finally { lock.releaseLock(); }
}
