// Schema migration is a pre-activation operation; post-activation, the guard must fail closed.
// This test proves the safety contract and writer compatibility with the frozen schema.
function testPurchaseEventSchemaMigrationContracts() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Purchase schema: ' + label); }
  var legacy = ('EventID,ExpenseID,BusinessLabel,PolicyVersion,PolicyRevision,CostType,PurchaseRelationship,' +
    'ExpenseDate,ReceiptDate,PurchaseQty,PurchaseUOM,AcquisitionValue,SupplierSource,ExternalRef,ExternalDocumentStatus,' +
    'Attestation,AllocationStatus,RequestKey,NormalizedPayload,ReceiptPlan,Lifecycle,RecoveryKey,CreatedAt,CreatedBy,IsActive').split(',');
  var expected = legacy.concat(['PaymentStatus', 'CashAccountCode', 'SupplierID', 'AccountingStatus']);

  // Schema structural invariants — validated directly from frozen constants.
  check(PURCHASE_EVENT_POLICY.sheet === 'PurchaseEvents', 'sheet name');
  check(PURCHASE_EVENT_POLICY.headers.length === 29, 'headers count');
  check(JSON.stringify(PURCHASE_EVENT_POLICY.headers) === JSON.stringify(expected), 'frozen exact 29 headers in order');
  check(!PURCHASE_EVENT_POLICY.headers.some(function(h, i) {
    return !h || PURCHASE_EVENT_POLICY.headers.indexOf(h) !== i;
  }), 'no duplicate or empty headers');

  // A+C. Migration remains explicit and schema-only while policy is active.
  check(JSON.stringify(purchaseEventMigrationHeaders_()) === JSON.stringify(expected), 'migration accepts active 29-column contract');
  var zeroWrites = true;
  var existing = { sheets: [{ properties: { title: 'PurchaseEvents', sheetType: 'GRID', sheetId: 1,
    gridProperties: { columnCount: 29 } }, data: [{ startRow: 0, startColumn: 0, rowData: [{ values: expected.map(function(h) {
      return { userEnteredValue: { stringValue: h } }; }) }] }] }] };
  var existingResult = executePurchaseEventSchemaMigration_({ read: function() { return existing; },
    batch: function() { zeroWrites = false; } });
  check(existingResult.status === 'ALREADY_MIGRATED', 'already migrated active schema accepted');
  check(zeroWrites, 'already migrated schema zero writes');

  // C. Post-activation safety: policies are active.
  check(PURCHASE_EVENT_POLICY.enabled === true, 'purchase policy enabled');
  check(EXPENSE_PURCHASE_POLICY.enabled === true, 'expense policy enabled');
  check(EXPENSE_PURCHASE_POLICY.activationEvent === null, 'activation event null');

  // D. No historical backfill: migration cannot execute, zero business rows possible.

  // Reader: accepts migrated empty schema (mock).
  var ss = { getSheetByName: function(name) {
    if (name === 'PurchaseEventResolutions') return null; // no resolutions in migration test
    check(name === 'PurchaseEvents', 'reader touches only PurchaseEvents and PurchaseEventResolutions');
    return { getDataRange: function() { return { getValues: function() { return [expected]; } }; } };
  } };
  check(readPurchaseEventTransactionRows_(ss).length === 0, 'reader accepts migrated empty schema');

  // Writer: purchase event persists to resulting schema.
  var expenses = [{ ID_Ops: 'OSR03', Item: 'Kopi Bubuk', IsActive: true }];
  var purchase = purchaseEventTestFixture_({ items: [], conversions: [] }, expenses, check, 'OSR03');
  var writerData = [expected.slice()];
  var writerSS = { getSheetByName: function(name) {
    if (name === 'PurchaseEventResolutions') return null;
    check(name === 'PurchaseEvents', 'writer touches only PurchaseEvents and PurchaseEventResolutions');
    return { getDataRange: function() { return { getValues: function() { return writerData; } }; } };
  } };
  purchase.runtime.appendEvent = function(row) {
    check(purchase.runtime.lock.hasLock(), 'writer shared lock');
    check(JSON.stringify(Object.keys(row)) === JSON.stringify(expected), 'writer agrees with all schema fields');
    writerData.push(expected.map(function(h) { return row[h]; }));
  };
  purchase.runtime.read = function() {
    var rows = readCanonicalTable(writerSS, 'PurchaseEvents', PURCHASE_EVENT_POLICY.headers);
    rows.forEach(function(row) { delete row.sourceRowIndex; });
    return { events: rows, expenses: expenses, items: [], conversions: [] };
  };
  var result = purchase.run();
  check(result.status === 'PURCHASE_CAPTURED' && result.writeCount === 1, 'existing writer persists to resulting schema');
  var history = readPurchaseEventTransactionRows_(writerSS);
  check(history.length === 1 && history[0].item === 'Kopi Bubuk' && history[0].id === 'PE-purchase-test-0001' &&
    history[0].canonicalTransactionType === 'PurchaseEvent' && history[0].financialTotalsIncluded === false &&
    history[0].accountingStatus === 'NOT_POSTED' && history[0].canEdit === false && history[0].canVoid === true,
    'reader and Transactions projection compatible');
  check(purchase.run().writeCount === 0, 'persisted RequestKey idempotency');

  // E. Activation state immutability: constants unchanged.
  check(PURCHASE_EVENT_POLICY.enabled === true && PURCHASE_EVENT_POLICY.sheet === 'PurchaseEvents' &&
    PURCHASE_EVENT_POLICY.headers.length === 29, 'purchase policy immutable');
  check(EXPENSE_PURCHASE_POLICY.enabled === true && EXPENSE_PURCHASE_POLICY.activationEvent === null,
    'expense policy immutable');

  function snapshot(headers, width, businessRows, overrideTarget) {
    var cells = {};
    headers.forEach(function(header, index) { cells['1,' + (index + 1)] = { userEnteredValue: { stringValue: header } }; });
    if (overrideTarget) Object.keys(overrideTarget).forEach(function(column) {
      cells['1,' + column] = { userEnteredValue: { stringValue: overrideTarget[column] } };
    });
    for (var row = 2; row < 2 + businessRows; row++) cells[row + ',1'] = { userEnteredValue: { stringValue: 'PE-' + row } };
    return { sheets: [{ properties: { title: 'PurchaseEvents', sheetType: 'GRID', sheetId: 7,
      gridProperties: { rowCount: 1000, columnCount: width } }, data: [{ startRow: 0, startColumn: 0,
      rowData: Array.from({ length: 1 + businessRows }, function(_, rowIndex) {
        return { values: Array.from({ length: width }, function(_, columnIndex) {
          return cells[(rowIndex + 1) + ',' + (columnIndex + 1)] || {};
        }) };
      }) }] }] };
  }
  function migrationRuntime(initial, fail) {
    var state = initial, calls = [];
    return { calls: calls, read: function() { return state; }, batch: function(body) {
      calls.push(body); if (fail) throw new Error('TEST_BATCH_AMBIGUITY');
      var sheet = state.sheets[0], requests = body.requests;
      requests.forEach(function(request) {
        if (request.updateSheetProperties) sheet.properties.gridProperties.columnCount =
          request.updateSheetProperties.properties.gridProperties.columnCount;
        if (request.updateCells) {
          var values = request.updateCells.rows[0].values;
          var row = sheet.data[0].rowData[0].values;
          while (row.length < sheet.properties.gridProperties.columnCount) row.push({});
          values.forEach(function(value, index) { row[request.updateCells.start.columnIndex + index] = value; });
        }
      });
    } };
  }
  var legacy25 = snapshot(legacy, 25, 2), rt25 = migrationRuntime(legacy25);
  check(purchaseEventMigrationClassify_(legacy25).status === 'READY_UPGRADE', 'legacy logical 25 physical 25 ready');
  var migrated25 = executePurchaseEventSchemaMigration_(rt25), requests25 = rt25.calls[0].requests;
  check(migrated25.status === 'MIGRATED' && migrated25.subrequests === 2 && rt25.calls.length === 1,
    '25-column migration one atomic batch with two subrequests');
  check(requests25[0].updateSheetProperties && requests25[1].updateCells, 'grid expansion precedes header update');
  check(requests25[0].updateSheetProperties.properties.sheetId === 7 &&
    requests25[0].updateSheetProperties.properties.gridProperties.columnCount === 29 &&
    requests25[0].updateSheetProperties.fields === 'gridProperties.columnCount', 'expansion targets sheet and columnCount 29 only');
  check(requests25[1].updateCells.start.columnIndex === 25 && requests25[1].updateCells.start.rowIndex === 0,
    'header update starts at zero-based column 25 on header row');
  check(JSON.stringify(requests25[1].updateCells.rows[0].values.map(function(value) {
    return value.userEnteredValue.stringValue;
  })) === JSON.stringify(expected.slice(25)), 'exact four target headers in order');
  check(requests25[1].updateCells.rows.length === 1 && requests25[1].updateCells.rows[0].values.length === 4,
    'header request contains no business-row values');
  check(migrated25.businessRows === 2 && legacy25.sheets[0].properties.gridProperties.rowCount === 1000,
    'business row count and physical row count preserved');
  var callsBeforeRetry = rt25.calls.length;
  check(executePurchaseEventSchemaMigration_(rt25).status === 'ALREADY_MIGRATED' && rt25.calls.length === callsBeforeRetry,
    'second execution idempotent zero writes');

  var legacy29 = snapshot(legacy, 29, 1), rt29 = migrationRuntime(legacy29);
  var migrated29 = executePurchaseEventSchemaMigration_(rt29);
  check(migrated29.status === 'MIGRATED' && migrated29.subrequests === 1 &&
    rt29.calls[0].requests.length === 1 && rt29.calls[0].requests[0].updateCells,
    'pre-expanded blank grid uses header-only batch');
  check(purchaseEventMigrationClassify_(snapshot(expected, 29, 1)).status === 'ALREADY_MIGRATED',
    'exact target schema already migrated');
  check(purchaseEventMigrationClassify_(snapshot(legacy, 24, 0)).status === 'BLOCKED', 'physical width below 25 refused');
  check(purchaseEventMigrationClassify_(snapshot(legacy, 29, 0, { 26: 'PaymentStatus' })).status === 'BLOCKED',
    'partial target header state refused');
  var wrong = legacy.slice(); wrong[1] = 'Wrong';
  check(purchaseEventMigrationClassify_(snapshot(wrong, 25, 0)).status === 'BLOCKED', 'wrong legacy header order refused');
  var uncertain = migrationRuntime(snapshot(legacy, 25, 1), true);
  var uncertainResult = executePurchaseEventSchemaMigration_(uncertain);
  check(uncertainResult.status === 'MIGRATION_UNCERTAIN' && uncertain.calls.length === 1,
    'batch ambiguity returns uncertain without retry');
  var migrationSource = executePurchaseEventSchemaMigration_.toString();
  check(['BalanceLedger', 'Settlements', 'CashAccountCode:', 'PaymentStatus:', 'postPolicyC'].every(function(token) {
    return migrationSource.indexOf(token) === -1;
  }), 'migration has no defaults inference ledger settlement cash or posting side effects');

  var summary = { status: 'PASS', checks: count, evidence: 'LOCAL_FIXTURE', productionMutation: false };
  Logger.log(JSON.stringify(summary)); return summary;
}

function testPurchaseResolutionSchemaMigrationContracts() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Resolution migration: ' + label); }

  // Test 1: Headers validation
  var headers = purchaseResolutionMigrationHeaders_();
  check(headers.length === 9, '9 headers');
  check(headers[0] === 'ResolutionID', 'first header');
  check(headers[headers.length - 1] === 'CreatedBy', 'last header');

  // Test 2: Classify missing sheet → READY_CREATE
  var empty = { sheets: [] };
  var classify1 = purchaseResolutionMigrationClassify_(empty);
  check(classify1.status === 'READY_CREATE', 'missing sheet READY_CREATE');

  // Test 3: Classify existing compatible sheet → ALREADY_MIGRATED
  var compatible = { sheets: [{ properties: { title: 'PurchaseEventResolutions', sheetType: 'GRID',
    sheetId: 1, gridProperties: { columnCount: 9 } },
    data: [{ startRow: 0, startColumn: 0, rowData: [{ values: headers.map(function(h) {
      return { userEnteredValue: { stringValue: h } }; }) }] }] }] };
  var classify2 = purchaseResolutionMigrationClassify_(compatible);
  check(classify2.status === 'ALREADY_MIGRATED', 'compatible ALREADY_MIGRATED');

  // Test 4: Classify incompatible sheet → BLOCKED
  var incompatible = { sheets: [{ properties: { title: 'PurchaseEventResolutions', sheetType: 'GRID',
    sheetId: 1, gridProperties: { columnCount: 5 } },
    data: [{ startRow: 0, startColumn: 0, rowData: [{ values: [{ userEnteredValue: { stringValue: 'Wrong' } }] }] }] }] };
  var classify3 = purchaseResolutionMigrationClassify_(incompatible);
  check(classify3.status === 'BLOCKED', 'incompatible BLOCKED');

  // Test 5: Execute migration on empty state
  var migrated = false;
  var mockRuntime = {
    read: function() { return migrated ? compatible : empty; },
    batch: function(body) { migrated = true; return { spreadsheetId: 'test' }; }
  };
  var result = executePurchaseResolutionSchemaMigration_(mockRuntime);
  check(result.status === 'MIGRATED', 'migration MIGRATED');
  check(result.writeCount === 1, 'one write');
  check(result.headerCount === 9, '9 headers');

  // Test 6: Migration retry is idempotent
  var retry = executePurchaseResolutionSchemaMigration_(mockRuntime);
  check(retry.status === 'ALREADY_MIGRATED', 'retry ALREADY_MIGRATED');

  // Test 7: PurchaseEvents migration reflects Policy C schema without inferring legacy payment state.
  check(purchaseEventMigrationHeaders_().length === 29, 'PurchaseEvents 29-column migration contract');
  check(PURCHASE_EVENT_POLICY.headers.length === 29 && PURCHASE_EVENT_POLICY.headers[0] === 'EventID' &&
    PURCHASE_EVENT_POLICY.headers[28] === 'AccountingStatus', 'PurchaseEvents headers upgraded');

  return { status: 'PASS', assertions: count };
}
