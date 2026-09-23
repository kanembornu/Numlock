// Schema migration is a pre-activation operation; post-activation, the guard must fail closed.
// This test proves the safety contract and writer compatibility with the frozen schema.
function testPurchaseEventSchemaMigrationContracts() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Purchase schema: ' + label); }
  var expected = ('EventID,ExpenseID,BusinessLabel,PolicyVersion,PolicyRevision,CostType,PurchaseRelationship,' +
    'ExpenseDate,ReceiptDate,PurchaseQty,PurchaseUOM,AcquisitionValue,SupplierSource,ExternalRef,ExternalDocumentStatus,' +
    'Attestation,AllocationStatus,RequestKey,NormalizedPayload,ReceiptPlan,Lifecycle,RecoveryKey,CreatedAt,CreatedBy,IsActive').split(',');

  // Schema structural invariants — validated directly from frozen constants.
  check(PURCHASE_EVENT_POLICY.sheet === 'PurchaseEvents', 'sheet name');
  check(PURCHASE_EVENT_POLICY.headers.length === 25, 'headers count');
  check(JSON.stringify(PURCHASE_EVENT_POLICY.headers) === JSON.stringify(expected), 'frozen exact 25 headers in order');
  check(!PURCHASE_EVENT_POLICY.headers.some(function(h, i) {
    return !h || PURCHASE_EVENT_POLICY.headers.indexOf(h) !== i;
  }), 'no duplicate or empty headers');

  // A+C. Migration guard: blocked post-activation, zero writes.
  var guardCaught = false;
  try { purchaseEventMigrationHeaders_(); } catch(e) { guardCaught = e.message === 'PURCHASE_SCHEMA_OR_ACTIVATION_DRIFT'; }
  check(guardCaught, 'migration headers guarded post-activation');
  var execGuardCaught = false, zeroWrites = true;
  try {
    executePurchaseEventSchemaMigration_({ read: function() { return { sheets: [] }; },
      batch: function() { zeroWrites = false; } });
  } catch(e) { execGuardCaught = e.message === 'PURCHASE_SCHEMA_OR_ACTIVATION_DRIFT'; }
  check(execGuardCaught, 'migration execute guarded post-activation');
  check(zeroWrites, 'guarded migration zero writes');

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
    PURCHASE_EVENT_POLICY.headers.length === 25, 'purchase policy immutable');
  check(EXPENSE_PURCHASE_POLICY.enabled === true && EXPENSE_PURCHASE_POLICY.activationEvent === null,
    'expense policy immutable');

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

  // Test 7: Existing PurchaseEvents migration behavior preserved
  var purchaseGuarded = false;
  try { purchaseEventMigrationHeaders_(); } catch (error) {
    purchaseGuarded = error.message === 'PURCHASE_SCHEMA_OR_ACTIVATION_DRIFT';
  }
  check(purchaseGuarded, 'PurchaseEvents post-activation guard unchanged');
  check(PURCHASE_EVENT_POLICY.headers.length === 25 && PURCHASE_EVENT_POLICY.headers[0] === 'EventID',
    'PurchaseEvents headers unchanged');

  return { status: 'PASS', assertions: count };
}
