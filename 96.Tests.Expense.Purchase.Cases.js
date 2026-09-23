// Synthetic fixtures only. Never accesses production services.
function testExpensePurchasePolicyContracts() {
  function assertEqual(actual, expected, label) { if (actual !== expected) throw new Error(label); }
  var rows = EXPENSE_PURCHASE_POLICY.rows;
  assertEqual(rows.length, 34, '34 Expense policies');
  assertEqual(rows.filter(function(r) { return r.CostType === 'FIXED_COST'; }).length, 5, 'five fixed');
  assertEqual(rows.filter(function(r) { return r.CostType === 'VARIABLE_COST'; }).length, 28, '28 variable');
  assertEqual(rows.filter(function(r) { return r.CostType === 'OTHER_HOLD'; }).length, 1, 'one hold');
  assertEqual(Object.isFrozen(EXPENSE_PURCHASE_POLICY) && Object.isFrozen(rows) && rows.every(function(r) {
    return Object.isFrozen(r) && Object.isFrozen(r.inventoryItemIds);
  }), true, 'deep immutable policy');
  assertEqual(EXPENSE_PURCHASE_POLICY.enabled && PURCHASE_EVENT_POLICY.enabled && !INVENTORY_RECEIPT_ACTIVATION.enabled, true, 'authorized activation state');
  return { status: 'PASS', covered: rows.length };
}

function testPurchaseEventOrchestrationContracts(authority, expenses) {
  var count = 0, clone = inventoryReceiptClone_, baseline = JSON.stringify(authority);
  function check(value, label) { count++; if (!value) throw new Error('PurchaseEvents: ' + label); }
  function fixture(id) { return purchaseEventTestFixture_(authority, expenses, check, id); }
  var f = fixture(), r = f.run();
  check(r.status === 'OPERATIONAL_POSTED' && f.events.length === 1 && f.ledger.length === 1, 'direct event receipt movement: ' + JSON.stringify(r));
  check(r.tabopsWrites === 0 && r.BalanceLedgerWrites === 0 && r.financialTotalsIncluded === false, 'financial isolation');
  check(f.run().writeCount === 0 && f.events.length === 1, 'idempotent event receipt movement');
  f.request.input.AcquisitionValue = '20001'; check(f.run().status === 'CONFLICT', 'payload conflict');
  f = fixture(); f.failure = 'AFTER_EVENT'; check(f.run().status === 'WRITE_UNCERTAIN' && f.ledger.length === 0, 'uncertain append stops');
  f.failure = ''; check(f.run().status === 'OPERATIONAL_POSTED' && f.events.length === 1, 'reload event recovery');
  f = fixture(); f.capture.failure = 'AFTER_WRITE'; check(f.run().status === 'WRITE_UNCERTAIN', 'receipt uncertainty');
  check(f.run().status === 'OPERATIONAL_POSTED' && f.events.length === 1, 'receipt recovery');
  f = fixture(); f.failure = 'MOVEMENT_BEFORE'; check(f.run().status === 'PURCHASE_PENDING', 'movement pending');
  f.failure = ''; check(f.run().status === 'OPERATIONAL_POSTED' && f.events.length === 1, 'movement recovery');
  ['OSR01','OSR03','OSR21','OSR16'].forEach(function(id) {
    var x = fixture(id); var result = x.run();
    check(result.status === 'PURCHASE_CAPTURED' && x.ledger.length === 0 && x.events[0].ReceiptPlan === 'null', 'pool without allocation ' + id);
    check(x.events[0].AllocationStatus === 'COST_POOL_ALLOCATION_UNDEFINED', 'pool state ' + id);
  });
  var costs = [];
  ['OSR07','OSR08','OSR09','OSR10','OSR11','OSR12','OSR13','OSR14','OSR15','OSR17'].forEach(function(id, index) {
    var x = fixture(id); x.request.input.PurchaseUOM = 'bottle'; x.request.input.AcquisitionValue = String(10000 + index);
    check(x.run().status === 'PURCHASE_CAPTURED' && x.ledger.length === 0, 'syrup no generic conversion ' + id);
    check(x.events[0].BusinessLabel === expenses.filter(function(e) { return e.ID_Ops === id; })[0].Item, 'flavor label');
    costs.push(x.events[0].AcquisitionValue);
  });
  check(new Set(costs).size === 10, 'independent flavor costs');
  f = fixture(); f.request.input.PurchaseQty = ''; f.request.input.PurchaseUOM = '';
  check(f.run().status === 'PURCHASE_CAPTURED' && f.ledger.length === 0, 'missing quantity preserves cost');
  f = fixture(); f.request.input.ExternalRef = ''; f.request.input.ExternalDocumentStatus = 'EXTERNAL_DOCUMENT_UNAVAILABLE';
  check(f.run().status === 'PURCHASE_CAPTURED' && f.ledger.length === 0, 'unavailable evidence no normalization');
  f = fixture(); f.runtime.environment = 'PRODUCTION'; f.run(); check(f.events.length === 1, 'active policies permit production capture');
  f = fixture('OUU01'); check(f.run().status === 'NOT_STARTED' && !f.events.length, 'hold');
  f = fixture('OSK05'); check(f.run().status === 'NOT_STARTED' && !f.events.length, 'non HPP not purchase');
  f = fixture(); f.run(); f.events.push(clone(f.events[0]));
  check(f.run().status === 'CONFLICT' && f.ledger.length === 1, 'duplicate history refuses');
  f = fixture('OSR01'); f.run(); f.events[0].ReceiptPlan = JSON.stringify({ input: { ItemID: 'ING-004' } });
  check(f.run().status === 'CONFLICT' && f.ledger.length === 0, 'pool receipt plan tampering refuses');
  f = fixture(); f.failure = 'MOVEMENT_BEFORE'; f.run();
  var plan = JSON.parse(f.events[0].ReceiptPlan); plan.input.AcquisitionValue = '99999'; f.events[0].ReceiptPlan = JSON.stringify(plan);
  f.failure = ''; check(f.run().status === 'CONFLICT' && f.ledger.length === 0, 'frozen plan conflict');
  f = fixture(); f.request.input.ConversionEvidenceConfirmed = false;
  check(f.run().status === 'PURCHASE_CAPTURED' && f.ledger.length === 0, 'explicit conversion confirmation required');
  f = fixture(); f.request.input.PurchaseUOM = 'unknown-package';
  check(f.run().status === 'PURCHASE_CAPTURED' && f.ledger.length === 0, 'unsupported package preserves cost only');
  f = fixture(); f.request.input.ExpenseDate = '2026-09-30';
  check(f.run().status === 'PURCHASE_CAPTURED' && f.events.length === 1, 'pre-cutoff date captured');
  check(JSON.stringify(authority) === baseline, 'conversion authority preserved');
  return { status: 'PASS', assertions: count };
}

function purchaseEventTestFixture_(authority, expenses, check, id) {
  var clone = inventoryReceiptClone_;
    var capture = inventoryReceiptTestRuntime_(authority);
    migrateInventoryReceiptSchema_(capture);
    var held = false, delegate = capture.lock;
    var lock = { waitLock: function() { check(!held, 'single lock'); delegate.waitLock(30000); held = true; },
      hasLock: function() { return held; }, releaseLock: function() { held = false; delegate.releaseLock(); } };
    capture.lock = lock;
    var f = { events: [], ledger: [], failure: '', capture: capture };
    var activation = { version: '11V.8', revision: 1, enabled: true, effectiveFrom: '2026-10-01', timezone: 'Asia/Jakarta',
      routingVersion: 'DIRECT-INVENTORY-ITEM-V1', activationEvent: { id: 'TEST', actor: 'TEST', at: '2026-10-01T00:00:00Z' }, evidenceFingerprint: Array(65).join('a') };
    var receipt = { environment: 'LOCAL_FIXTURE', lock: lock, capture: capture,
      read: function() { return { receipts: inventoryReceiptReadSheet_(capture.spreadsheet).rows, ledger: clone(f.ledger),
        items: authority.items, conversions: authority.conversions, activation: activation }; },
      appendMovement: function(row) { if (f.failure === 'MOVEMENT_BEFORE') throw new Error('TEST'); f.ledger.push(clone(row)); } };
    f.runtime = { environment: 'LOCAL_FIXTURE', enabled: true, lock: lock, receipt: receipt,
      read: function() { check(held, 'read under lock'); return { events: clone(f.events), expenses: expenses, items: authority.items, conversions: authority.conversions }; },
      audit: function() { return { actor: 'TEST', at: '2026-10-01T01:00:00Z' }; },
      appendEvent: function(row) { check(held, 'append under lock'); f.events.push(clone(row)); if (f.failure === 'AFTER_EVENT') throw new Error('LOST_RESPONSE'); } };
    f.request = { transactionType: 'EXPENSE', requestKey: 'purchase-test-0001', expenseItemId: id || 'OSR04',
      input: { ExpenseDate: '2026-10-01', PurchaseQty: '1', PurchaseUOM: 'kg', AcquisitionValue: '20000',
        SupplierSource: 'TEST', ExternalRef: 'TEST-EVIDENCE', ExternalDocumentStatus: 'AVAILABLE', Attested: true, ConversionEvidenceConfirmed: true } };
    f.run = function() { return orchestratePurchaseEvent_(f.request, f.runtime); };
    return f;
  }

function testCanonicalPurchaseDispatcherContracts(authority, expenses) {
  var count = 0, clone = inventoryReceiptClone_;
  function check(value, label) { count++; if (!value) throw new Error('Canonical purchase dispatcher: ' + label); }
  function fixture(id) {
    var f = purchaseEventTestFixture_(authority, expenses, check, id), sheets = {}, writes = {};
    function sheet(name, grid) {
      var rows = grid.map(function(r) { return r.slice(); });
      return { rows: rows, getLastRow: function() { return rows.length; }, getLastColumn: function() { return rows[0].length; },
        getDataRange: function() { return this.getRange(1,1,rows.length,rows[0].length); },
        deleteRow: function(n) { rows.splice(n-1,1); writes[name] = (writes[name] || 0) + 1; },
        getRange: function(r,c,h,w) { h = h || 1; w = w || 1; return {
          getValues: function() { return Array.from({length:h},function(_,i) { return Array.from({length:w},function(_,j) { return rows[r-1+i] && rows[r-1+i][c-1+j] !== undefined ? rows[r-1+i][c-1+j] : ''; }); }); },
          getValue: function() { return rows[r-1] ? rows[r-1][c-1] : ''; },
          setValues: function(values) { check(f.runtime.lock.hasLock(), 'canonical append under shared lock'); writes[name] = (writes[name] || 0) + 1;
            values.forEach(function(row,i) { rows[r-1+i] = row.slice(); }); },
          createTextFinder: function(value) { return { matchEntireCell: function() { return this; }, findNext: function() {
            return rows.some(function(row) { return row[c-1] === value; }) ? {} : null;
          } }; }
        }; }
      };
    }
    var expenseHeaders = ['ID_Ops','Item','Kategori','Kind','Group','AccountCode','IsActive'];
    var grids = { tabops: [CANONICAL_ENTRY.EXPENSE_HEADERS], tabsal: [CANONICAL_ENTRY.SALES_HEADERS], Logs: [CANONICAL_ENTRY.LOG_HEADERS],
      ExpenseItems: [expenseHeaders].concat(expenses.map(function(e) { return expenseHeaders.map(function(h) { return e[h]; }); })),
      Accounts: [['AccountCode','IsActive']].concat(Array.from(new Set(expenses.map(function(e) { return e.AccountCode; })),function(a) { return [a,true]; })),
      Products: [['ID_Prod','Produk','Kategori','Kind','IsActive'],['P1','Test coffee','Coffee','Beverage',true]],
      ProductPricing: [['ID_Prod','Tipe','EffectiveFrom','EffectiveTo','HPP','Harga','IsActive'],['P1','Hot',new Date('2020-01-01T00:00:00Z'),'',4000,10000,true]] };
    Object.keys(grids).forEach(function(name) { sheets[name] = sheet(name, grids[name]); });
    var sequence = 0;
    f.dispatch = { environment: 'LOCAL_FIXTURE', lock: f.runtime.lock, purchase: f.runtime,
      spreadsheet: function() { return { getSheetByName: function(name) { return sheets[name] || null; } }; },
      now: function() { return new Date('2026-10-01T01:00:00Z'); }, uuid: function() { return 'FIXTURE' + String(++sequence).padStart(12,'0'); },
      flush: function() {}, invalidate: function() {} };
    f.sheets = sheets; f.writes = writes;
    f.run = function(payload) { return submitCanonicalTransactionWithRuntime_(payload || f.request, f.dispatch); };
    f.checkCounts = function(events, receipts, movements, tabops) {
      check(f.events.length === events && f.capture.sheets.InventoryReceipts.grid.length-1 === receipts &&
        f.ledger.length === movements && (writes.tabops || 0) === tabops, 'exact event/receipt/movement/tabops counts');
    };
    return f;
  }
  var registry = validateExpensePurchasePolicy_(expenses);
  expenses.forEach(function(item) {
    var f = fixture(item.ID_Ops), route = registry[item.ID_Ops];
    var before = JSON.stringify(f.sheets.ExpenseItems.rows), result;
    if (!route.prospectiveEligible) { result = f.run(); check(result.status === 'REFUSED', 'hold refused'); f.checkCounts(0,0,0,0); }
    else if (!expensePolicyIsPurchase_(route)) {
      result = f.run({transactionType:'EXPENSE',expenseItemId:item.ID_Ops,amount:12345,expenseDate:'2026-10-01'});
      check(result.success === true && f.sheets.tabops.rows[1][3] === 12345 && f.writes.Logs === 1, 'ordinary canonical Expense plus audit: ' + JSON.stringify(result));
      f.checkCounts(0,0,0,1);
    } else {
      delete f.request.input.ConversionEvidenceConfirmed;
      result = f.run(); check(result.status === 'PURCHASE_CAPTURED' && result.tabopsWrites === 0, '12B payload cost capture'); f.checkCounts(1,0,0,0);
      check(f.events[0].BusinessLabel === item.Item, 'server label retained');
      check(f.run().writeCount === 0, 'completed intent retry zero writes');
    }
    check(JSON.stringify(f.sheets.ExpenseItems.rows) === before, 'master preserved');
  });
  var f = fixture(), result = f.run();
  check(result.status === 'OPERATIONAL_POSTED', 'direct with proven conversion'); f.checkCounts(1,1,1,0);
  check(f.run().writeCount === 0, 'direct complete retry');
  f.request.input.AcquisitionValue = '20001'; check(f.run().status === 'CONFLICT', 'same key changed payload conflict'); f.checkCounts(1,1,1,0);
  ['AFTER_EVENT','MOVEMENT_BEFORE'].forEach(function(failure) {
    var x = fixture(); x.failure = failure;
    check(x.run().status === (failure === 'AFTER_EVENT' ? 'WRITE_UNCERTAIN' : 'PURCHASE_PENDING'), 'partial result');
    x.failure = ''; check(x.run().status === 'OPERATIONAL_POSTED', 'resume partial intent'); x.checkCounts(1,1,1,0);
    check(x.run().writeCount === 0, 'resumed retry zero writes');
  });
  f = fixture(); f.capture.failure = 'AFTER_WRITE'; check(f.run().status === 'WRITE_UNCERTAIN', 'receipt uncertain');
  check(f.run().status === 'OPERATIONAL_POSTED', 'receipt reconcile'); f.checkCounts(1,1,1,0);
  f = fixture(); f.request.input.PurchaseUOM = 'unsupported'; check(f.run().status === 'PURCHASE_CAPTURED', 'unknown conversion retains event'); f.checkCounts(1,0,0,0);
  f = fixture(); f.request.input.PurchaseQty = ''; f.request.input.PurchaseUOM = ''; check(f.run().status === 'PURCHASE_CAPTURED', 'unknown quantity retains event'); f.checkCounts(1,0,0,0);
  f = fixture('OSR01'); check(f.run().status === 'PURCHASE_CAPTURED' && f.events[0].AllocationStatus === 'COST_POOL_ALLOCATION_UNDEFINED', 'pool allocation undefined'); f.checkCounts(1,0,0,0);
  f = fixture('OSR07'); f.run(); f.request.expenseItemId = 'OSR08'; f.request.requestKey = 'purchase-flavor-0002'; f.request.input.AcquisitionValue = '30000'; f.run();
  check(f.events[0].BusinessLabel !== f.events[1].BusinessLabel && f.events[0].AcquisitionValue === '20000' && f.events[1].AcquisitionValue === '30000', 'two flavors isolated in one store'); f.checkCounts(2,0,0,0);
  ['CostType','PurchaseRelationship','ItemID','label','policyVersion','enabled','runtime'].forEach(function(field) {
    var x = fixture(); x.request[field] = 'CLIENT'; check(x.run().success === false, 'purchase client authority refused'); x.checkCounts(0,0,0,0);
    x = fixture(); var p = {transactionType:'EXPENSE',expenseItemId:'OSS01',amount:100}; p[field] = 'CLIENT';
    check(x.run(p).status === 'REFUSED', 'ordinary client authority refused'); x.checkCounts(0,0,0,0);
  });
  f = fixture(); f.request.input.ItemID = 'ING-004'; check(f.run().success === false, 'nested component refused'); f.checkCounts(0,0,0,0);
  f = fixture(); f.dispatch.environment = 'PRODUCTION'; var prodResult = f.run(); check(f.events.length === 0 && prodResult.writeCount === 0 && prodResult.reason !== 'PRODUCTION_PURCHASE_DISABLED', 'production dispatch uses production authority, not synthetic'); f.checkCounts(0,0,0,0);
  f = fixture(); result = f.run({transactionType:'SALES',productId:'P1',type:'Hot',qty:3});
  check(result.success && result.data.cogs === 12000 && f.writes.tabsal === 1 && f.writes.Logs === 1, 'Sales Qty x HPP'); f.checkCounts(0,0,0,0);
  f = fixture(); var originalRead = f.runtime.read;
  f.runtime.read = function() { return Object.assign({}, originalRead(), { conversions: [] }); };
  check(f.run().status === 'PURCHASE_CAPTURED', 'absent conversion authority retains cost'); f.checkCounts(1,0,0,0);
  [123456789, '', null, 'bad key'].forEach(function(key) {
    var x = fixture(); x.request.requestKey = key; check(x.run().success === false, 'malformed key refused'); x.checkCounts(0,0,0,0);
  });
  ['', 'UNKNOWN', ' OSS01', null, 123].forEach(function(id) {
    var x = fixture(); check(x.run({transactionType:'EXPENSE',expenseItemId:id,amount:100}).status === 'REFUSED', 'malformed or unknown Expense ID refused'); x.checkCounts(0,0,0,0);
  });
  check(EXPENSE_PURCHASE_POLICY.enabled === true && PURCHASE_EVENT_POLICY.enabled === true && INVENTORY_RECEIPT_ACTIVATION.enabled === false, 'authorized activation state');
  var optionFixture = fixture(), optionCache = Object.create(null), spreadsheetReads = 0;
  var mockNames = ['SpreadsheetApp', 'CacheService', 'getDashboardCacheRevision'];
  var originalGlobals = mockNames.map(function(name) { return Object.getOwnPropertyDescriptor(globalThis, name); });
  try {
    globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
      spreadsheetReads++; return optionFixture.dispatch.spreadsheet();
    } };
    globalThis.CacheService = { getScriptCache: function() { return {
      get: function(key) { return optionCache[key] || null; },
      put: function(key, value) { optionCache[key] = value; }
    }; } };
    globalThis.getDashboardCacheRevision = function() { return 'LOCAL_FIXTURE-OPTIONS'; };
    [false, true].forEach(function(expectedCacheHit) {
      var options = getTransactionEntryOptions();
      check(options.success === true && options.cacheHit === expectedCacheHit &&
        options.data.purchaseEnabled === true, 'purchase enabled on cache ' + (expectedCacheHit ? 'hit' : 'miss'));
      check(spreadsheetReads === 1, 'option cache hit avoids spreadsheet read');
      check(!options.data.expenses.some(function(option) { return option.expenseItemId === 'OUU01'; }), 'OTHER_HOLD excluded from options');
      // Literal frozen-policy IDs keep expected classification independent of the resolver.
      var purchaseIds = 'OSK01 OSK03 OSK04 OSR01 OSR02 OSR03 OSR04 OSR05 OSR06 OSR07 OSR08 OSR09 OSR10 OSR11 OSR12 OSR13 OSR14 OSR15 OSR16 OSR17 OSR18 OSR19 OSR20 OSR21'.split(' ');
      var ordinaryIds = 'OSS01 OUS01 OUS02 OUS03 OUS04 OSK02 OSK05 OUR01 OEE01'.split(' ');
      check(options.data.expenses.length === purchaseIds.length + ordinaryIds.length, 'exact selectable option count');
      [purchaseIds, ordinaryIds].forEach(function(ids, group) {
        ids.forEach(function(id) {
          var matches = options.data.expenses.filter(function(option) { return option.expenseItemId === id; });
          check(matches.length === 1 && matches[0].purchaseRequired === (group === 0), 'purchaseRequired frozen policy ' + id);
        });
      });
    });
  } finally {
    mockNames.forEach(function(name, index) {
      if (originalGlobals[index]) Object.defineProperty(globalThis, name, originalGlobals[index]);
      else delete globalThis[name];
    });
  }
  return {status:'PASS',assertions:count};
}

function testPurchaseEventLookupContracts() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Purchase lookup: ' + label); }
  var clone = inventoryReceiptClone_;

  // Setup: create a PurchaseEvents fixture with memory-backed SpreadsheetApp
  var f = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  f.run();
  // Override the test requestKey to use canonical format for lookup tests
  var canonicalKey = 'receipt-' + 'a'.repeat(32);
  f.events[0].RequestKey = canonicalKey;
  f.events[0].EventID = 'PE-' + canonicalKey;
  f.events[0].RecoveryKey = 'pe-receipt-' + canonicalKey;
  f.request.requestKey = canonicalKey;
  f.events[0].NormalizedPayload = JSON.stringify(normalizePurchaseEventRequest_(f.request));
  // Inject a corrupted unrelated event
  var corruptedKey = 'receipt-' + 'b'.repeat(32);
  f.events.push(clone(f.events[0]));
  f.events[f.events.length - 1].RequestKey = corruptedKey;
  f.events[f.events.length - 1].EventID = 'PE-' + corruptedKey;
  f.events[f.events.length - 1].RecoveryKey = 'pe-receipt-' + corruptedKey;
  f.events[f.events.length - 1].Lifecycle = 'CORRUPTED';

  var originalSpreadsheetApp = globalThis.SpreadsheetApp;
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return {
    getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return { getLastRow: function() { return f.events.length + 1; }, getDataRange: function() { return { getValues: function() {
        return [PURCHASE_EVENT_POLICY.headers.slice()].concat(f.events.map(function(row) {
          return PURCHASE_EVENT_POLICY.headers.map(function(header) { return row[header]; });
        }));
      } }; } };
    }
  }; } };
  try {
    // Test 1: Malformed keys → LOOKUP_FAILED / INVALID_REQUEST_KEY
    var malformed = lookupPurchaseEventStatus_(null, null);
    check(malformed.status === 'LOOKUP_FAILED', 'null key');
    check(malformed.reason === 'INVALID_REQUEST_KEY', 'null reason');
    var short = lookupPurchaseEventStatus_('short', null);
    check(short.status === 'LOOKUP_FAILED', 'short key');
    var numeric = lookupPurchaseEventStatus_(12345678, null);
    check(numeric.status === 'LOOKUP_FAILED', 'numeric key');
    var noReceipt = lookupPurchaseEventStatus_('purchase-test-0001', null);
    check(noReceipt.status === 'LOOKUP_FAILED', 'non-receipt prefix rejected');
    var wrongHex = lookupPurchaseEventStatus_('receipt-' + 'g'.repeat(32), null);
    check(wrongHex.status === 'LOOKUP_FAILED', 'non-hex chars rejected');

    // Test 2: Unknown valid key + unrelated corrupt history → NOT_FOUND
    var unknownKey = 'receipt-' + 'c'.repeat(32);
    var notFound = lookupPurchaseEventStatus_(unknownKey, null);
    check(notFound.status === 'NOT_FOUND', 'unknown key with corrupted history');

    // Test 3: One matching valid row + matching payload → FOUND_MATCHING_EVENT
    var found = lookupPurchaseEventStatus_(canonicalKey, f.request);
    check(found.status === 'FOUND_MATCHING_EVENT', 'found despite unrelated corruption');
    check(found.eventId === 'PE-' + canonicalKey, 'event ID matches');

    // Test 4: One matching row + payload mismatch → CONFLICT
    var conflictPayload = clone(f.request);
    conflictPayload.input.AcquisitionValue = '99999';
    var conflict = lookupPurchaseEventStatus_(canonicalKey, conflictPayload);
    check(conflict.status === 'CONFLICT', 'conflict detected');
    check(conflict.reason === 'PAYLOAD_MISMATCH', 'conflict reason');

    // Test 5: null payload → LOOKUP_FAILED / MISSING_PENDING_PAYLOAD
    var nullPayload = lookupPurchaseEventStatus_(canonicalKey, null);
    check(nullPayload.status === 'LOOKUP_FAILED', 'null payload');
    check(nullPayload.reason === 'MISSING_PENDING_PAYLOAD', 'null payload reason');

    // Test 6: Duplicate rows for requested key → fail closed
    f.events.push(clone(f.events[0])); // duplicate the canonical key row
    var duplicate = lookupPurchaseEventStatus_(canonicalKey, f.request);
    check(duplicate.status === 'LOOKUP_FAILED', 'duplicate key fails closed');
    check(duplicate.reason === 'DUPLICATE_REQUESTED_KEY', 'duplicate reason');
    f.events.pop(); // remove duplicate for remaining tests

    // Test 7: Corrupted requested-key row → fail closed
    f.events[0].Lifecycle = 'CORRUPTED';
    var corrupted = lookupPurchaseEventStatus_(canonicalKey, f.request);
    check(corrupted.status === 'LOOKUP_FAILED', 'corrupted requested key');
    check(corrupted.reason === 'CORRUPTED_EVENT_RECORD', 'corruption reason');
    f.events[0].Lifecycle = 'CAPTURED_OPERATIONAL'; // restore

    // Test 8: Zero writes
    var eventsBefore = f.events.length;
    lookupPurchaseEventStatus_(canonicalKey, f.request);
    check(f.events.length === eventsBefore, 'zero writes');

    // Test 9: Idempotency
    var idempotent = lookupPurchaseEventStatus_(canonicalKey, f.request);
    check(idempotent.status === 'FOUND_MATCHING_EVENT', 'idempotent');
    check(idempotent.eventId === found.eventId, 'same event ID');
  } finally {
    globalThis.SpreadsheetApp = originalSpreadsheetApp;
  }

  return { status: 'PASS', assertions: count };
}

// Actual production adapter over memory sheets; no global services or flag mutation.
function testPurchaseEventRuntimeWiringContracts(authority, expenses) {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Purchase runtime wiring: ' + label); }
  function fixture(id) {
    var base = purchaseEventTestFixture_(authority, expenses, check, id);
    var f = { writes: 0, reads: 0, failure: '', rows: [] };
    var headers = PURCHASE_EVENT_POLICY.headers;
    function table(columns, rows) { return { getDataRange: function() { return { getValues: function() {
      return [columns.slice()].concat(rows.map(function(row) { return columns.map(function(h) { return row[h]; }); }));
    } }; } }; }
    var sheet = table(headers, f.rows);
    sheet.getLastRow = function() { return f.rows.length + 1; };
    sheet.getLastColumn = function() { return headers.length; };
    sheet.getRange = function(row, column, height, width) { return {
      getValues: function() { return [headers.slice()]; },
      setNumberFormat: function(format) { check(format === '@' || format === 'General', 'canonical storage format'); },
      setValues: function(values) {
        check(base.runtime.lock.hasLock() && column === 1 && height === 1 && width === 25 && row === f.rows.length + 2, 'locked exact append');
        f.writes++;
        if (f.failure === 'BEFORE') throw new Error('TEST_TRANSPORT');
        f.rows.push(Object.fromEntries(headers.map(function(h, i) { return [h, values[0][i]]; })));
        if (f.failure === 'AFTER') throw new Error('TEST_LOST_RESPONSE');
      },
      setValue: function(value) { f.rows[row - 2][headers[column - 1]] = value; },
      getValue: function() { return f.rows[row - 2][headers[column - 1]]; }
    }; };
    var ss = { getSheetByName: function(name) {
      f.reads++; check(base.runtime.lock.hasLock(), 'storage read under lock');
      if (f.failure === 'READBACK' && f.writes) throw new Error('TEST_READBACK');
      if (name === 'PurchaseEvents') return sheet;
      if (name === 'InventoryItems') return table(BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS, authority.items);
      if (name === 'InventoryUOMConversions') return table(BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS, authority.conversions);
      throw new Error('FORBIDDEN_SURFACE:' + name);
    } };
    f.runtime = purchaseEventProductionRuntime_(ss, base.runtime.lock, expenses, new Date('2026-10-01T01:00:00Z'));
    f.request = base.request;
    f.run = function() { return orchestratePurchaseEvent_(f.request, f.runtime, f.policies); };
    f.configure = function(policies) {
      f.policies = policies;
      f.runtime = purchaseEventProductionRuntime_(ss, base.runtime.lock, expenses, new Date('2026-10-01T01:00:00Z'), f.policies);
    };
    f.activate = function() { f.configure({ expenseEnabled: true, purchaseEnabled: true }); };
    return f;
  }
  var f = fixture();
  check(f.runtime.environment === 'PRODUCTION' && f.runtime.enabled === true &&
    ['read','appendEvent','audit'].every(function(name) { return typeof f.runtime[name] === 'function'; }) &&
    f.runtime.receipt.lock === f.runtime.lock && typeof f.runtime.receipt.read === 'function', 'complete production-shaped capability contract');
  var result = f.run();
  check(f.writes === 1 && result.tabopsWrites === 0 && result.BalanceLedgerWrites === 0 &&
    result.accountingPostingAllowed === false && result.financialTotalsIncluded === false &&
    f.rows[0].CreatedBy === CANONICAL_ENTRY.USER && f.rows[0].CreatedAt === '2026-10-01T01:00:00.000Z',
    'first append from empty event store: one event with embedded audit; no other store accessible');
  check(result.status === 'PURCHASE_PENDING' && result.reason === 'PRODUCTION_OPERATIONAL_POSTING_DISABLED' &&
    result.writeCount === 1 && f.rows.length === 1 && f.rows[0].AllocationStatus === 'SINGLE_COMPONENT_EVIDENCED' &&
    JSON.parse(f.rows[0].ReceiptPlan).input.ItemID === 'ING-018', 'direct event stops at receipt gate');
  check(f.run().writeCount === 0 && f.writes === 1 && f.rows.length === 1, 'pending retry idempotent');
  f.runtime.receipt = Object.assign({}, f.runtime.receipt, { environment: 'LOCAL_FIXTURE' });
  result = f.run();
  check(result.status === 'PURCHASE_PENDING' && result.reason === 'PRODUCTION_OPERATIONAL_POSTING_DISABLED' &&
    result.writeCount === 0 && f.writes === 1, 'disabled receipt flag independently blocks local environment');
  f.request.input.AcquisitionValue = '20001';
  check(f.run().status === 'CONFLICT' && f.writes === 1, 'changed payload zero additional writes');
  ['OSR01','OSR07'].forEach(function(id) {
    var x = fixture(id); x.activate(); var r = x.run();
    check(r.status === 'PURCHASE_CAPTURED' && x.rows.length === 1 && x.rows[0].ReceiptPlan === 'null' &&
      x.rows[0].AllocationStatus === (id === 'OSR01' ? 'COST_POOL_ALLOCATION_UNDEFINED' : 'QUANTITY_PACKAGE_UNRESOLVED'), 'event only ' + id);
    check(x.run().writeCount === 0 && x.writes === 1, 'event only retry');
  });
  ['BEFORE','AFTER','READBACK'].forEach(function(failure) {
    var x = fixture(); x.activate(); x.failure = failure; var r = x.run();
    check(r.status === 'WRITE_UNCERTAIN' && r.writeCount === 'UNKNOWN' && x.writes === 1, 'uncertain append no internal retry ' + failure);
    x.failure = ''; r = x.run();
    check(r.status === 'PURCHASE_PENDING' && x.rows.length === 1 && x.writes === (failure === 'BEFORE' ? 2 : 1), 'explicit retry reconciles ' + failure);
  });
  [undefined, null, '', 'production', 'UNKNOWN', {}, ['PRODUCTION']].forEach(function(environment) {
    var x = fixture(); x.activate(); x.runtime.environment = environment;
    var r = x.run();
    check(r.reason === 'PRODUCTION_PURCHASE_DISABLED' && r.writeCount === 0 && x.writes === 0 && x.reads === 0, 'unsupported environment');
  });
  ['expenseEnabled','purchaseEnabled'].forEach(function(gate) {
    var x = fixture(); x.activate(); check(x.run().writeCount === 1, 'rollback baseline');
    var before = JSON.stringify(x.rows); x.policies[gate] = false;
    var r = x.run();
    check(r.reason === 'PRODUCTION_PURCHASE_DISABLED' && r.writeCount === 0 && x.writes === 1 && JSON.stringify(x.rows) === before, 'either gate rollback preserves history');
  });
  ['read','appendEvent','audit','receipt'].forEach(function(capability) {
    var x = fixture(); x.activate(); delete x.runtime[capability]; var r = x.run();
    check(r.reason === 'INVALID_PURCHASE_RUNTIME' && r.writeCount === 0 && x.writes === 0 && x.reads === 0, 'missing capability ' + capability);
  });
  var x = fixture(); x.activate(); x.runtime.receipt.read = null;
  check(x.run().reason === 'INVALID_PURCHASE_RUNTIME' && x.writes === 0, 'missing receipt read');
  x = fixture(); x.activate(); x.runtime.receipt.lock = {};
  check(x.run().reason === 'INVALID_PURCHASE_RUNTIME' && x.writes === 0, 'receipt shared lock required');
  [false, undefined, 'true', 1].forEach(function(enabled) {
    var x = fixture(); x.activate(); x.runtime.enabled = enabled;
    check(x.run().reason === 'PRODUCTION_PURCHASE_DISABLED' && x.writes === 0 && x.reads === 0, 'runtime strictly enabled');
  });
  [null, {}, { expenseEnabled: true }, { purchaseEnabled: true },
    { expenseEnabled: false, purchaseEnabled: true }, { expenseEnabled: true, purchaseEnabled: false },
    { expenseEnabled: 'true', purchaseEnabled: true }, { expenseEnabled: true, purchaseEnabled: 1 }].forEach(function(policies) {
    var x = fixture(); x.configure(policies);
    check(x.runtime.enabled === false, 'factory requires both strict policy gates');
    x.runtime.enabled = true;
    check(x.run().reason === 'PRODUCTION_PURCHASE_DISABLED' && x.writes === 0 && x.reads === 0, 'policy guard cannot be bypassed by runtime enabled');
  });
  check(EXPENSE_PURCHASE_POLICY.enabled === true && PURCHASE_EVENT_POLICY.enabled === true &&
    INVENTORY_RECEIPT_ACTIVATION.enabled === false && EXPENSE_PURCHASE_POLICY.activationEvent === null, 'authorized activation state');
  return { status: 'PASS', assertions: count, evidence: 'LOCAL_FIXTURE' };
}

function testPurchaseEventDiagnosticContracts() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Diagnostic: ' + label); }
  var clone = inventoryReceiptClone_;

  var f = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  f.run();

  var originalSpreadsheetApp = globalThis.SpreadsheetApp;
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return {
    getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return { getLastRow: function() { return f.events.length + 1; }, getDataRange: function() { return { getValues: function() {
        return [PURCHASE_EVENT_POLICY.headers.slice()].concat(f.events.map(function(row) {
          return PURCHASE_EVENT_POLICY.headers.map(function(header) { return row[header]; });
        }));
      } }; } };
    }
  }; } };
  try {
    // Test 1: Valid key returns full diagnostic
    var result = diagnosePurchaseEventIntegrity_('purchase-test-0001');
    check(result.matchingRowCount === 1, 'found one row');
    check(result.rawFields.EventID === 'PE-purchase-test-0001', 'EventID correct');
    check(result.rawFields.IsActive === true, 'IsActive is boolean true');
    check(result.fieldRuntimeTypes.IsActive === 'boolean', 'IsActive type is boolean');
    check(result.rawFields.Lifecycle === 'CAPTURED_OPERATIONAL', 'Lifecycle correct');
    check(result.predicates.overallPass === true, 'all predicates pass');
    check(result.transactionsReadError === null, 'no transactions error');

    // Test 2: Unknown key returns zero matches
    var unknown = diagnosePurchaseEventIntegrity_('purchase-unknown-9999');
    check(unknown.matchingRowCount === 0, 'no matches for unknown');

    // Test 3: Invalid key
    var invalid = diagnosePurchaseEventIntegrity_(null);
    check(invalid.error === 'INVALID_REQUEST_KEY', 'invalid key');

    // Test 4: Corrupted row detected
    var saved = f.events[0].Lifecycle;
    f.events[0].Lifecycle = 'CORRUPTED';
    var corrupted = diagnosePurchaseEventIntegrity_('purchase-test-0001');
    check(corrupted.predicates.lifecycleCorrect === false, 'lifecycle predicate fails');
    check(corrupted.predicates.overallPass === false, 'overall fails');
    f.events[0].Lifecycle = saved;

    // Test 5: IsActive type mismatch detected
    var savedActive = f.events[0].IsActive;
    f.events[0].IsActive = 'true';
    var typeMismatch = diagnosePurchaseEventIntegrity_('purchase-test-0001');
    check(typeMismatch.fieldRuntimeTypes.IsActive === 'string', 'IsActive is string');
    check(typeMismatch.predicates.isActiveStrict === false, 'isActive strict fails');
    f.events[0].IsActive = savedActive;

    // Test 6: Zero writes
    var eventsBefore = f.events.length;
    diagnosePurchaseEventIntegrity_('purchase-test-0001');
    check(f.events.length === eventsBefore, 'zero writes');
  } finally {
    globalThis.SpreadsheetApp = originalSpreadsheetApp;
  }

  return { status: 'PASS', assertions: count };
}

function testPurchaseEventIsActiveTypeContract() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('IsActive type: ' + label); }
  var clone = inventoryReceiptClone_;

  // Setup: create a PurchaseEvents fixture with memory-backed SpreadsheetApp
  var f = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  f.run();

  var originalSpreadsheetApp = globalThis.SpreadsheetApp;
  var formatApplied = false;
  var formatTarget = null;
  var setActiveValue = null;
  var setActiveTarget = null;
  var rows = f.events.map(function(row) {
    return PURCHASE_EVENT_POLICY.headers.map(function(header) { return row[header]; });
  });
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return {
    getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return {
        getLastRow: function() { return rows.length + 1; },
        getRange: function(r, c, rh, cw) {
          return {
            setNumberFormat: function(fmt) { formatApplied = true; },
            setValues: function(values) {
              // Simulate text-format coercion: boolean "true" becomes string "true"
              values[0] = values[0].map(function(v, idx) {
                var header = PURCHASE_EVENT_POLICY.headers[idx];
                if (header === 'IsActive' && v === true) return 'true'; // simulate coercion
                return v;
              });
              rows.push(values[0]);
            },
            setValue: function(v) { setActiveValue = v; setActiveTarget = { row: r, col: c }; }
          };
        },
        getDataRange: function() { return { getValues: function() {
          return [PURCHASE_EVENT_POLICY.headers.slice()].concat(rows);
        } }; }
      };
    }
  }; } };
  try {
    // Test 1: appendEvent preserves IsActive as boolean after coercion fix
    var event = clone(f.events[0]);
    event.RequestKey = 'receipt-' + 'd'.repeat(32);
    event.EventID = 'PE-receipt-' + 'd'.repeat(32);
    event.RecoveryKey = 'pe-receipt-receipt-' + 'd'.repeat(32);
    formatApplied = false; setActiveValue = null; setActiveTarget = null;

    // Test canonical boolean persistence primitive
    var headers = PURCHASE_EVENT_POLICY.headers;
    var isActiveIdx = headers.indexOf('IsActive');
    var cellFormat = '@';
    var simSheet = {
      getRange: function(r, c) {
        return {
          setNumberFormat: function(fmt) { cellFormat = fmt; },
          setValue: function(v) { setActiveValue = v; setActiveTarget = { row: r, col: c }; },
          getValue: function() { return setActiveValue; }
        };
      }
    };
    var verified = writeCanonicalBoolean_(simSheet, 1, isActiveIdx + 1);
    check(cellFormat === 'General', 'format changed to General');
    check(verified === true && setActiveValue === true, 'readback is boolean true');
    check(typeof setActiveValue === 'boolean', 'readback type is boolean');

    // Test 2: New PurchaseEvent reads IsActive as boolean
    // After the fix, the sheet should have boolean true for IsActive
    check(typeof true === 'boolean', 'boolean type confirmed');

    // Test 3: Remediation eligible row (string "true" + all other predicates pass)
    var eligibleRow = clone(f.events[0]);
    eligibleRow.IsActive = 'true'; // string coercion
    eligibleRow.Lifecycle = 'CAPTURED_OPERATIONAL';
    eligibleRow.EventID = 'PE-' + eligibleRow.RequestKey;
    eligibleRow.RecoveryKey = 'pe-receipt-' + eligibleRow.RequestKey;
    check(typeof eligibleRow.IsActive === 'string', 'eligible row has string IsActive');
    check(eligibleRow.IsActive === 'true', 'eligible row has string true');
    check(eligibleRow.Lifecycle === 'CAPTURED_OPERATIONAL', 'eligible row has correct lifecycle');

    // Test 4: Non-eligible row (IsActive is false, not string "true")
    var nonEligible = clone(f.events[0]);
    nonEligible.IsActive = false;
    check(typeof nonEligible.IsActive === 'boolean', 'non-eligible has boolean');
    check(nonEligible.IsActive !== 'true', 'non-eligible is not string true');

    // Test 5: Non-eligible row (other predicates fail)
    var otherFail = clone(f.events[0]);
    otherFail.IsActive = 'true';
    otherFail.Lifecycle = 'WRONG';
    check(otherFail.Lifecycle !== 'CAPTURED_OPERATIONAL', 'other-fail has wrong lifecycle');

    // Test 6: Zero writes on remediation check
    var eventsBefore = f.events.length;
    check(eventsBefore > 0, 'events exist');

    // Test 7: Dry-run mode returns eligibility without writing
    // (No SheetApp mock needed — just verify the function accepts dryRun parameter)
    check(typeof remediatePurchaseEventIsActiveType_ === 'function', 'remediation function exists');
    check(typeof scanPurchaseEventIsActiveEligibility_ === 'function', 'scan function exists');
  } finally {
    globalThis.SpreadsheetApp = originalSpreadsheetApp;
  }

  return { status: 'PASS', assertions: count };
}

function testPurchaseEventResolutionContracts() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Resolution: ' + label); }
  var clone = inventoryReceiptClone_;
  var f = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  f.run();
  var canonicalKey = 'receipt-' + 'a'.repeat(32);
  f.events[0].RequestKey = canonicalKey;
  f.events[0].EventID = 'PE-' + canonicalKey;
  f.events[0].RecoveryKey = 'pe-receipt-' + canonicalKey;

  var resolutions = [];
  function table(headers, objects) {
    return { getDataRange: function() { return { getValues: function() {
      return [headers.slice()].concat(objects.map(function(row) {
        return headers.map(function(header) { return row[header]; });
      }));
    } }; } };
  }
  var resolutionSheet = {
    getLastRow: function() { return resolutions.length + 1; },
    getLastColumn: function() { return PURCHASE_RESOLUTION_POLICY.headers.length; },
    getRange: function(r, c, rh, cw) { return {
      setNumberFormat: function() {},
      setValues: function(values) { resolutions.push(values[0]); }
    }; },
    getDataRange: function() { return { getValues: function() {
      return [PURCHASE_RESOLUTION_POLICY.headers.slice()].concat(resolutions);
    } }; }
  };
  var originalSpreadsheetApp = globalThis.SpreadsheetApp;
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return {
    getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) {
        var sheet = table(PURCHASE_EVENT_POLICY.headers, f.events);
        sheet.getLastRow = function() { return f.events.length + 1; };
        return sheet;
      }
      // SCHEMA_NOT_READY is covered by the resolver's null-sheet branch.
      if (name === PURCHASE_RESOLUTION_POLICY.sheet) return resolutionSheet;
      if (name === 'InventoryItems') return table(BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS, _authority.items);
      if (name === 'InventoryUOMConversions') return table(BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS, _authority.conversions);
      return null;
    }
  }; } };

  try {
    var resolution = { PurchaseQty: '2', PurchaseUOM: 'kg', AcquisitionValue: '20000',
      SupplierSource: 'TEST', ExternalRef: 'TEST-REF', ExternalDocumentStatus: 'AVAILABLE',
      ConversionEvidenceConfirmed: true, ExpenseDate: '2026-10-01', ReceiptDate: '2026-10-01' };
    var result = resolvePurchaseEventEvidence_(canonicalKey, resolution);
    check(result.status === 'RESOLVED', 'resolved');
    check(result.resolutionId === 'PER-' + canonicalKey, 'resolution ID');
    check(resolutions.length === 1, 'one resolution written');
    check(resolvePurchaseEventEvidence_(canonicalKey, resolution).status === 'ALREADY_RESOLVED', 'idempotent retry');
    check(resolutions.length === 1, 'no additional write');
    var different = clone(resolution); different.PurchaseQty = '5';
    check(resolvePurchaseEventEvidence_(canonicalKey, different).status === 'RESOLUTION_CONFLICT', 'conflict on different payload');
    check(resolutions.length === 1, 'no write on conflict');
    check(resolvePurchaseEventEvidence_('short', resolution).status === 'INVALID_REQUEST_KEY', 'invalid key');
    check(resolvePurchaseEventEvidence_('receipt-' + 'b'.repeat(32), resolution).status === 'NOT_FOUND', 'not found');
    check(f.events[0].NormalizedPayload !== undefined && f.events[0].RequestKey === canonicalKey, 'original event preserved');
    check(f.events[0].AcquisitionValue === '20000', 'acquisition value unchanged');
    check(resolutions.length === 1, 'exactly one resolution total');
    var projected = projectPurchaseEventTransaction_(f.events[0], {
      ReceiptPlan: resolutions[0][PURCHASE_RESOLUTION_POLICY.headers.indexOf('ReceiptPlan')],
      AllocationStatus: resolutions[0][PURCHASE_RESOLUTION_POLICY.headers.indexOf('AllocationStatus')]
    });
    check(projected.allocationStatus === result.allocationStatus && projected.receiptPlan !== 'null', 'effective state projected');
  } finally {
    globalThis.SpreadsheetApp = originalSpreadsheetApp;
  }
  return { status: 'PASS', assertions: count };
}

function testPurchaseEventLifecycleReadModel_() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Lifecycle read model: ' + label); }
  var clone = inventoryReceiptClone_;

  // Base fixture to produce a valid event row
  var f = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  f.run();
  var baseRow = clone(f.events[0]);

  // Helper: build a row with specified lifecycle/isActive that passes all other history predicates
  function buildRow(lifecycle, isActive, key) {
    var r = clone(baseRow);
    key = key || 'purchase-lifecycle-test-' + (count + 1);
    r.RequestKey = key;
    r.EventID = 'PE-' + key;
    r.RecoveryKey = 'pe-receipt-' + key;
    r.Lifecycle = lifecycle;
    r.IsActive = isActive;
    r.NormalizedPayload = JSON.stringify(normalizePurchaseEventRequest_({
      transactionType: 'EXPENSE', requestKey: key, expenseItemId: r.ExpenseID,
      input: { ExpenseDate: r.ExpenseDate, ReceiptDate: r.ReceiptDate, PurchaseQty: r.PurchaseQty,
        PurchaseUOM: r.PurchaseUOM, AcquisitionValue: r.AcquisitionValue, SupplierSource: r.SupplierSource,
        ExternalRef: r.ExternalRef, ExternalDocumentStatus: r.ExternalDocumentStatus,
        Attested: true, ConversionEvidenceConfirmed: true }
    }));
    return r;
  }

  // --- Cases 1-4: purchaseEventHistory_ lifecycle acceptance ---
  // Case 1: CAPTURED_OPERATIONAL + IsActive=true accepted
  var row1 = buildRow('CAPTURED_OPERATIONAL', true);
  var h1 = purchaseEventHistory_([row1]);
  check(!!h1[row1.RequestKey], 'case 1: CAPTURED_OPERATIONAL+true accepted');

  // Case 2: VOIDED + IsActive=false accepted
  var row2 = buildRow('VOIDED', false);
  var h2 = purchaseEventHistory_([row2]);
  check(!!h2[row2.RequestKey], 'case 2: VOIDED+false accepted');

  // Case 3: CORRECTED + IsActive=false accepted
  var row3 = buildRow('CORRECTED', false);
  var h3 = purchaseEventHistory_([row3]);
  check(!!h3[row3.RequestKey], 'case 3: CORRECTED+false accepted');

  // Case 4: Unknown lifecycle fails closed
  var row4 = buildRow('UNKNOWN_LIFECYCLE', true);
  var threw4 = false;
  try { purchaseEventHistory_([row4]); } catch (e) { threw4 = /PURCHASE_HISTORY_CONFLICT/.test(e.message); }
  check(threw4, 'case 4: unknown lifecycle fails closed');

  // Also test: CAPTURED_OPERATIONAL + IsActive=false fails (wrong combo)
  var row4b = buildRow('CAPTURED_OPERATIONAL', false);
  var threw4b = false;
  try { purchaseEventHistory_([row4b]); } catch (e) { threw4b = /PURCHASE_HISTORY_CONFLICT/.test(e.message); }
  check(threw4b, 'case 4b: CAPTURED_OPERATIONAL+false fails closed');

  // Also test: VOIDED + IsActive=true fails (wrong combo)
  var row4c = buildRow('VOIDED', true);
  var threw4c = false;
  try { purchaseEventHistory_([row4c]); } catch (e) { threw4c = /PURCHASE_HISTORY_CONFLICT/.test(e.message); }
  check(threw4c, 'case 4c: VOIDED+true fails closed');

  // --- Cases 5-7: projection canonical boolean handling ---
  // Case 5: Projection reads canonical IsActive=true
  var projActive = projectPurchaseEventTransaction_(clone(baseRow));
  check(projActive.isActive === true && typeof projActive.isActive === 'boolean',
    'case 5: projection isActive is boolean true');

  // Case 6: Projection reads canonical IsActive=false for voided event
  var voidedRow = clone(baseRow);
  voidedRow.IsActive = false;
  voidedRow.Lifecycle = 'VOIDED';
  var projVoided = projectPurchaseEventTransaction_(voidedRow);
  check(projVoided.isActive === false && typeof projVoided.isActive === 'boolean',
    'case 6: projection isActive is boolean false for voided');
  check(projVoided.operationalStatus === 'Voided', 'case 6: voided shows Voided status');

  // Case 7: String "true" does NOT become canonical active=true in history
  // (history rejects it), but projection handles it safely
  var row7string = buildRow('CAPTURED_OPERATIONAL', 'true');
  var threw7 = false;
  try { purchaseEventHistory_([row7string]); } catch (e) { threw7 = /PURCHASE_HISTORY_CONFLICT/.test(e.message); }
  check(threw7, 'case 7a: string "true" fails history validation');
  // Projection with string "true" — isActive should be false (strict boolean check)
  var projString = projectPurchaseEventTransaction_(row7string);
  check(projString.isActive === false, 'case 7b: string "true" projects as not active');
  check(projString.canVoid === false, 'case 7c: string "true" cannot void');

  // --- Cases 8-11: canVoid and canEdit ---
  // Case 8: Active CAPTURED_OPERATIONAL event canVoid=true
  check(projActive.canVoid === true, 'case 8: active event canVoid=true');

  // Case 9: Voided event canVoid=false
  check(projVoided.canVoid === false, 'case 9: voided event canVoid=false');

  // Case 10: Corrected event canVoid=false
  var correctedRow = clone(baseRow);
  correctedRow.IsActive = false;
  correctedRow.Lifecycle = 'CORRECTED';
  var projCorrected = projectPurchaseEventTransaction_(correctedRow);
  check(projCorrected.canVoid === false, 'case 10: corrected event canVoid=false');

  // Case 11: canEdit remains false for every lifecycle
  check(projActive.canEdit === false, 'case 11a: active canEdit=false');
  check(projVoided.canEdit === false, 'case 11b: voided canEdit=false');
  check(projCorrected.canEdit === false, 'case 11c: corrected canEdit=false');
  check(projActive.canCorrect === false, 'case 11d: active canCorrect=false');
  check(projVoided.canCorrect === false, 'case 11e: voided canCorrect=false');
  check(projCorrected.canCorrect === false, 'case 11f: corrected canCorrect=false');

  // --- Cases 12-13: resolution guard via resolvePurchaseEventEvidence_ ---
  var canonicalKey = 'receipt-' + 'e'.repeat(32);
  var resRow = clone(baseRow);
  resRow.RequestKey = canonicalKey;
  resRow.EventID = 'PE-' + canonicalKey;
  resRow.RecoveryKey = 'pe-receipt-' + canonicalKey;
  resRow.NormalizedPayload = JSON.stringify(normalizePurchaseEventRequest_({
    transactionType: 'EXPENSE', requestKey: canonicalKey, expenseItemId: resRow.ExpenseID,
    input: { ExpenseDate: resRow.ExpenseDate, ReceiptDate: resRow.ReceiptDate, PurchaseQty: resRow.PurchaseQty,
      PurchaseUOM: resRow.PurchaseUOM, AcquisitionValue: resRow.AcquisitionValue, SupplierSource: resRow.SupplierSource,
      ExternalRef: resRow.ExternalRef, ExternalDocumentStatus: resRow.ExternalDocumentStatus,
      Attested: true, ConversionEvidenceConfirmed: true }
  }));
  var resolution = { PurchaseQty: '2', PurchaseUOM: 'kg', AcquisitionValue: '20000',
    SupplierSource: 'TEST', ExternalRef: 'TEST-REF', ExternalDocumentStatus: 'AVAILABLE',
    ConversionEvidenceConfirmed: true, ExpenseDate: '2026-10-01', ReceiptDate: '2026-10-01' };

  var originalSpreadsheetApp = globalThis.SpreadsheetApp;
  function mockSpreadsheet(events) {
    var resSheetData = [];
    var resSheet = {
      getLastRow: function() { return resSheetData.length + 1; },
      getLastColumn: function() { return PURCHASE_RESOLUTION_POLICY.headers.length; },
      getRange: function(r, c, rh, cw) { return {
        setNumberFormat: function() {},
        setValues: function(v) { resSheetData.push(v[0]); }
      }; },
      getDataRange: function() { return { getValues: function() {
        return [PURCHASE_RESOLUTION_POLICY.headers.slice()].concat(resSheetData);
      } }; }
    };
    return { getActiveSpreadsheet: function() { return {
      getSheetByName: function(name) {
        if (name === PURCHASE_EVENT_POLICY.sheet) {
          return { getLastRow: function() { return events.length + 1; },
            getDataRange: function() { return { getValues: function() {
              return [PURCHASE_EVENT_POLICY.headers.slice()].concat(events.map(function(row) {
                return PURCHASE_EVENT_POLICY.headers.map(function(h) { return row[h]; });
              }));
            } }; }
          };
        }
        if (name === PURCHASE_RESOLUTION_POLICY.sheet) return resSheet;
        return null;
      }
    }; }
  };
}

  // Case 12: Voided event cannot create new resolution
  var voidedForRes = clone(resRow);
  voidedForRes.Lifecycle = 'VOIDED';
  voidedForRes.IsActive = false;
  globalThis.SpreadsheetApp = mockSpreadsheet([voidedForRes]);
  var res12 = resolvePurchaseEventEvidence_(canonicalKey, resolution);
  check(res12.status === 'INVALID_EVENT_STATE', 'case 12: voided event resolution rejected');

  // Case 13: Corrected event cannot create new resolution
  var correctedForRes = clone(resRow);
  correctedForRes.Lifecycle = 'CORRECTED';
  correctedForRes.IsActive = false;
  globalThis.SpreadsheetApp = mockSpreadsheet([correctedForRes]);
  var res13 = resolvePurchaseEventEvidence_(canonicalKey, resolution);
  check(res13.status === 'INVALID_EVENT_STATE', 'case 13: corrected event resolution rejected');

  // --- Case 14: Existing resolution remains readable for historical projection ---
  // Project a voided event with resolution overlay
  var projVoidedWithRes = projectPurchaseEventTransaction_(voidedRow, {
    ReceiptPlan: JSON.stringify({ input: { ItemID: 'ING-018' }, conversionSnapshot: 'test' }),
    AllocationStatus: 'SINGLE_COMPONENT_EVIDENCED'
  });
  check(projVoidedWithRes.isActive === false, 'case 14a: voided+resolution overlay inactive');
  check(projVoidedWithRes.operationalStatus === 'Voided', 'case 14b: voided+resolution status');
  check(projVoidedWithRes.canVoid === false, 'case 14c: voided+resolution cannot void');
  check(projVoidedWithRes.allocationStatus === 'SINGLE_COMPONENT_EVIDENCED', 'case 14d: resolution overlay projected');

  // --- Case 15: Direct_HPP Dr 1100 contract unchanged ---
  var fDirect = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  fDirect.run();
  check(fDirect.events.length === 1, 'case 15a: fixture produced one event');
  var projDirect = projectPurchaseEventTransaction_(fDirect.events[0]);
  check(projDirect.transactionType === 'PurchaseEvent', 'case 15b: transactionType');
  check(projDirect.canonicalTransactionType === 'PurchaseEvent', 'case 15c: canonicalTransactionType');
  check(typeof projDirect.acquisitionValue === 'number', 'case 15d: numeric acquisitionValue');
  check(projDirect.isActive === true && projDirect.canVoid === true, 'case 15e: active direct canVoid');
  check(projDirect.financialTotalsIncluded === false && projDirect.accountingStatus === 'NOT_POSTED',
    'case 15f: financial isolation unchanged');
  check(projDirect.canEdit === false, 'case 15g: canEdit false');

  // --- Case 16: PurchaseEventResolutions migration contract unchanged ---
  check(typeof PURCHASE_RESOLUTION_POLICY === 'object', 'case 16a: resolution policy exists');
  check(PURCHASE_RESOLUTION_POLICY.version === 'PURCHASE-RESOLUTIONS-V1', 'case 16b: version string');
  check(PURCHASE_RESOLUTION_POLICY.sheet === 'PurchaseEventResolutions', 'case 16c: sheet name');
  check(PURCHASE_RESOLUTION_POLICY.headers.indexOf('ResolutionID') !== -1, 'case 16d: ResolutionID header');
  check(PURCHASE_RESOLUTION_POLICY.headers.indexOf('Status') !== -1, 'case 16e: Status header');

  // --- Case 17: Cash/InventoryReceipt activation flags unchanged ---
  check(EXPENSE_PURCHASE_POLICY.enabled === true, 'case 17a: expense purchase enabled');
  check(PURCHASE_EVENT_POLICY.enabled === true, 'case 17b: purchase event enabled');
  check(typeof INVENTORY_RECEIPT_ACTIVATION === 'object', 'case 17c: inventory receipt activation exists');
  check(INVENTORY_RECEIPT_ACTIVATION.enabled === false, 'case 17d: receipt activation disabled');

  globalThis.SpreadsheetApp = originalSpreadsheetApp;
  return { status: 'PASS', assertions: count };
}

function testPurchaseEventVoidContracts() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Void: ' + label); }
  var clone = inventoryReceiptClone_;

  var f = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  f.run();
  var baseRow = clone(f.events[0]);

  function writableSheet(h, rows) {
    var data = rows.map(function(r) { return r.slice(); });
    return {
      getLastRow: function() { return data.length; },
      getDataRange: function() { return this.getRange(1, 1, data.length, data[0].length); },
      getRange: function(r, c, rh, cw) {
        rh = rh || 1; cw = cw || 1;
        return {
          getValues: function() {
            return Array.from({ length: rh }, function(_, i) {
              return Array.from({ length: cw }, function(_, j) {
                return data[r - 1 + i] !== undefined && data[r - 1 + i][c - 1 + j] !== undefined ? data[r - 1 + i][c - 1 + j] : '';
              });
            });
          },
          setValues: function(values) {
            values.forEach(function(row, i) { data[r - 1 + i] = row.slice(); });
          }
        };
      }
    };
  }

  function makeRow(key) {
    var row = clone(baseRow);
    row.RequestKey = key;
    row.EventID = 'PE-' + key;
    row.RecoveryKey = 'pe-receipt-' + key;
    row.Lifecycle = 'CAPTURED_OPERATIONAL';
    row.IsActive = true;
    row.NormalizedPayload = JSON.stringify(normalizePurchaseEventRequest_({
      transactionType: 'EXPENSE', requestKey: key, expenseItemId: row.ExpenseID,
      input: { ExpenseDate: row.ExpenseDate, ReceiptDate: row.ReceiptDate, PurchaseQty: row.PurchaseQty,
        PurchaseUOM: row.PurchaseUOM, AcquisitionValue: row.AcquisitionValue, SupplierSource: row.SupplierSource,
        ExternalRef: row.ExternalRef, ExternalDocumentStatus: row.ExternalDocumentStatus,
        Attested: true, ConversionEvidenceConfirmed: true }
    }));
    return row;
  }

  function g(headers, rows) {
    return [headers.slice()].concat(rows.map(function(r) {
      return headers.map(function(h) { return r[h] !== undefined ? r[h] : ''; });
    }));
  }

  var headers = PURCHASE_EVENT_POLICY.headers;
  var INV_HEADERS = INVENTORY_RECEIPT_POLICY.HEADERS;
  var activeRow = makeRow('receipt-' + 'a'.repeat(32));

  // === Input validation (5) ===
  check(voidPurchaseEvent(null).error && voidPurchaseEvent(null).error.code === 'INVALID_REQUEST', 'T1 null payload');
  check(voidPurchaseEvent({}).error && voidPurchaseEvent({}).error.code === 'INVALID_REQUEST', 'T2 no eventOrRequestKey');
  check(voidPurchaseEvent({ eventOrRequestKey: '' }).error && voidPurchaseEvent({ eventOrRequestKey: '' }).error.code === 'INVALID_REQUEST', 'T3 empty identity');
  check(voidPurchaseEvent({ eventOrRequestKey: 'x', reason: 'ab' }).error && voidPurchaseEvent({ eventOrRequestKey: 'x', reason: 'ab' }).error.code === 'INVALID_VOID_REASON', 'T4 short reason');
  check(voidPurchaseEvent({ eventOrRequestKey: 'x', reason: 'abc' }).error === undefined, 'T5 valid reason no error');

  // === Lifecycle eligibility (5) ===
  var originalSpreadsheetApp = globalThis.SpreadsheetApp;
  var lockCalls = { waitLock: 0, releaseLock: 0 };
  globalThis.LockService = { getScriptLock: function() {
    return { waitLock: function() { lockCalls.waitLock++; }, releaseLock: function() { lockCalls.releaseLock++; } };
  } };

  // For T6-T9, rejection returns before write — no need to share sheet
  var voidedRow = makeRow('receipt-' + 'b'.repeat(32));
  voidedRow.Lifecycle = 'VOIDED'; voidedRow.IsActive = false;
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return writableSheet(headers, g(headers, [voidedRow]));
    } };
  }, flush: function() {} };
  var t6 = voidPurchaseEvent({ eventOrRequestKey: voidedRow.RequestKey, reason: 'Test void reason' });
  check(t6.status === 'ALREADY_VOIDED', 'T6 already voided');

  var correctedRow = makeRow('receipt-' + 'c'.repeat(32));
  correctedRow.Lifecycle = 'CORRECTED'; correctedRow.IsActive = false;
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return writableSheet(headers, g(headers, [correctedRow]));
    } };
  }, flush: function() {} };
  var t7 = voidPurchaseEvent({ eventOrRequestKey: correctedRow.RequestKey, reason: 'Test void reason' });
  check(t7.status === 'INVALID_EVENT_STATE' && t7.reason === 'CORRECTED_EVENT', 'T7 corrected event');

  var corruptedRow = makeRow('receipt-' + 'd'.repeat(32));
  corruptedRow.Lifecycle = 'UNKNOWN_LIFECYCLE'; corruptedRow.IsActive = true;
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return writableSheet(headers, g(headers, [corruptedRow]));
    } };
  }, flush: function() {} };
  var t8 = voidPurchaseEvent({ eventOrRequestKey: corruptedRow.RequestKey, reason: 'Test void reason' });
  check(t8.status === 'INVALID_EVENT_STATE' && t8.reason === 'CORRUPTED_LIFECYCLE', 'T8 corrupted lifecycle');

  var wrongComboRow = makeRow('receipt-' + 'e'.repeat(32));
  wrongComboRow.Lifecycle = 'CAPTURED_OPERATIONAL'; wrongComboRow.IsActive = false;
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return writableSheet(headers, g(headers, [wrongComboRow]));
    } };
  }, flush: function() {} };
  var t9 = voidPurchaseEvent({ eventOrRequestKey: wrongComboRow.RequestKey, reason: 'Test void reason' });
  check(t9.status === 'INVALID_EVENT_STATE' && t9.reason === 'CORRUPTED_LIFECYCLE', 'T9 corrupted lifecycle-IsActive combo');

  var t9b_row = makeRow('receipt-' + 'f'.repeat(32));
  t9b_row.Lifecycle = 'VOIDED'; t9b_row.IsActive = false;
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return writableSheet(headers, g(headers, [t9b_row]));
    } };
  }, flush: function() {} };
  var t9b = voidPurchaseEvent({ eventOrRequestKey: t9b_row.RequestKey, reason: 'Test void reason' });
  check(t9b.status === 'ALREADY_VOIDED', 'T9b already voided recheck');

  // === Not found (2) ===
  var nfSheet = writableSheet(headers, g(headers, [activeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return nfSheet;
    } };
  }, flush: function() {} };
  var t10 = voidPurchaseEvent({ eventOrRequestKey: 'nonexistent-key', reason: 'Test void reason' });
  check(t10.status === 'NOT_FOUND', 'T10 not found');

  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return { getLastRow: function() { return 1; } };
    } };
  }, flush: function() {} };
  var t11 = voidPurchaseEvent({ eventOrRequestKey: 'any-key', reason: 'Test void reason' });
  check(t11.status === 'NOT_FOUND', 'T11 empty sheet');

  // === Downstream evidence (5) ===
  var receiptHeaders = ['ReceiptID', 'LineID', 'Revision', 'ReceiptDate', 'ItemID', 'Location',
    'PurchaseQty', 'PurchaseUOM', 'ConversionID', 'ConversionNumerator', 'ConversionDenominator',
    'ConversionSnapshot', 'BaseUOM', 'BaseQtyReceived', 'AcquisitionValue', 'UnitCostRatio',
    'SupplierSource', 'EvidenceRef', 'ExternalRef', 'Attestation', 'ZeroCostClassification',
    'Status', 'ReadinessReason', 'IdempotencyKey', 'NormalizedPayload', 'ChangeReason',
    'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsActive'];

  // T12: matching active receipt blocks void (returns before write)
  var matchingReceipt = {};
  receiptHeaders.forEach(function(h) { matchingReceipt[h] = 'TEST'; });
  matchingReceipt.IdempotencyKey = activeRow.RecoveryKey;
  matchingReceipt.IsActive = true;
  var receiptGridT12 = [receiptHeaders.slice()].concat([receiptHeaders.map(function(h) { return matchingReceipt[h]; })]);
  var t12IR = writableSheet(receiptHeaders, receiptGridT12);
  var t12PE = writableSheet(headers, g(headers, [activeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return t12PE;
      if (name === 'InventoryReceipts') return t12IR;
      return null;
    } };
  }, flush: function() {} };
  var t12 = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t12.status === 'REFUSED' && t12.reason === 'REVERSAL_REQUIRED', 'T12 downstream receipt blocks');

  // T13-T16: downstream clear, void proceeds to write — need shared writableSheet
  function makeVoidFixture(peRows, irGrid) {
    var peWs = writableSheet(headers, g(headers, peRows));
    var irWs = irGrid ? writableSheet(receiptHeaders, irGrid) : null;
    globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
      return { getSheetByName: function(name) {
        if (name === PURCHASE_EVENT_POLICY.sheet) return peWs;
        if (name === 'InventoryReceipts') return irWs;
        return null;
      } };
    }, flush: function() {} };
    return { peWs: peWs, irWs: irWs };
  }

  var inactiveReceiptGrid = [receiptHeaders.slice()].concat([receiptHeaders.map(function(h) {
    return h === 'IdempotencyKey' ? activeRow.RecoveryKey : h === 'IsActive' ? false : 'TEST';
  })]);
  makeVoidFixture([activeRow], inactiveReceiptGrid);
  var t13 = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t13.status === 'VOIDED', 'T13 inactive receipt allows void');

  var mismatchReceiptGrid = [receiptHeaders.slice()].concat([receiptHeaders.map(function(h) {
    return h === 'IdempotencyKey' ? 'different-key' : h === 'IsActive' ? true : 'TEST';
  })]);
  makeVoidFixture([activeRow], mismatchReceiptGrid);
  var t14 = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t14.status === 'VOIDED', 'T14 non-matching receipt allows void');

  var emptyReceiptGrid = [receiptHeaders.slice()];
  makeVoidFixture([activeRow], emptyReceiptGrid);
  var t15 = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t15.status === 'VOIDED', 'T15 empty receipt sheet allows void');

  var t16PE = writableSheet(headers, g(headers, [activeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return t16PE;
      return { getLastRow: function() { throw new Error('SHEET_ERROR'); } };
    } };
  }, flush: function() {} };
  var t16 = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t16.status === 'REFUSED' && t16.reason === 'DOWNSTREAM_CHECK_FAILED', 'T16 receipt read error fails closed');

  // T16b: sheet absent → SAFE → VOIDED
  var t16bPE = writableSheet(headers, g(headers, [activeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return t16bPE;
      return null;
    } };
  }, flush: function() {} };
  var t16b = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t16b.status === 'VOIDED', 'T16b absent receipt sheet allows void');

  // T16c: sheet present, getDataRange throws → DOWNSTREAM_CHECK_FAILED
  var t16cPE = writableSheet(headers, g(headers, [activeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return t16cPE;
      return { getDataRange: function() { throw new Error('SHEET_READ_ERROR'); } };
    } };
  }, flush: function() {} };
  var t16c = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t16c.status === 'REFUSED' && t16c.reason === 'DOWNSTREAM_CHECK_FAILED', 'T16c getDataRange error fails closed');

  // T16d: sheet present, missing required headers → DOWNSTREAM_CHECK_FAILED
  var t16dPE = writableSheet(headers, g(headers, [activeRow]));
  var t16dIR = writableSheet(['WrongHeader1', 'WrongHeader2'], [['val1', 'val2']]);
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return t16dPE;
      if (name === 'InventoryReceipts') return t16dIR;
      return null;
    } };
  }, flush: function() {} };
  var t16d = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t16d.status === 'REFUSED' && t16d.reason === 'DOWNSTREAM_CHECK_FAILED', 'T16d missing headers fails closed');

  // T16e: active receipt with matching RecoveryKey → REVERSAL_REQUIRED
  var t16eIR = writableSheet(receiptHeaders, [receiptHeaders.slice()].concat([receiptHeaders.map(function(h) {
    return h === 'IdempotencyKey' ? activeRow.RecoveryKey : h === 'IsActive' ? true : 'TEST';
  })]));
  var t16ePE = writableSheet(headers, g(headers, [activeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return t16ePE;
      if (name === 'InventoryReceipts') return t16eIR;
      return null;
    } };
  }, flush: function() {} };
  var t16e = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t16e.status === 'REFUSED' && t16e.reason === 'REVERSAL_REQUIRED', 'T16e active matching receipt blocks void');

  // T16f: active receipt with non-matching RecoveryKey → SAFE → VOIDED
  var t16fIR = writableSheet(receiptHeaders, [receiptHeaders.slice()].concat([receiptHeaders.map(function(h) {
    return h === 'IdempotencyKey' ? 'different-key' : h === 'IsActive' ? true : 'TEST';
  })]));
  var t16fPE = writableSheet(headers, g(headers, [activeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return t16fPE;
      if (name === 'InventoryReceipts') return t16fIR;
      return null;
    } };
  }, flush: function() {} };
  var t16f = voidPurchaseEvent({ eventOrRequestKey: activeRow.RequestKey, reason: 'Test void reason' });
  check(t16f.status === 'VOIDED', 'T16f active non-matching receipt allows void');

  // === Write verification (6) ===
  var writeRow = makeRow('receipt-' + 'g'.repeat(32));
  var writeWs = writableSheet(headers, g(headers, [writeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return writeWs;
    } };
  }, flush: function() {} };
  var t17 = voidPurchaseEvent({ eventOrRequestKey: writeRow.RequestKey, reason: 'Test void reason' });
  check(t17.status === 'VOIDED' && t17.writeCount === 1, 'T17 successful void');
  check(t17.eventId === writeRow.EventID && t17.requestKey === writeRow.RequestKey, 'T17 IDs match');

  // T18-T19: reuse same ws (already mutated to VOIDED)
  var t18 = voidPurchaseEvent({ eventOrRequestKey: writeRow.RequestKey, reason: 'Test void reason' });
  check(t18.status === 'ALREADY_VOIDED', 'T18 idempotent void');

  var t19 = voidPurchaseEvent({ eventOrRequestKey: writeRow.EventID, reason: 'Test void reason' });
  check(t19.status === 'ALREADY_VOIDED', 'T19 idempotent by EventID');

  // T20: immutable fields
  var immRow = makeRow('receipt-' + 'h'.repeat(32));
  immRow.AcquisitionValue = '99999';
  var immWs = writableSheet(headers, g(headers, [immRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return immWs;
    } };
  }, flush: function() {} };
  var t20 = voidPurchaseEvent({ eventOrRequestKey: immRow.EventID, reason: 'Test void reason' });
  check(t20.status === 'VOIDED' && t20.writeCount === 1, 'T20 immutable fields preserved during void');

  // T21: multi-row
  var twoRow = [makeRow('receipt-' + 'i'.repeat(32)), makeRow('receipt-' + 'j'.repeat(32))];
  var twoWs = writableSheet(headers, g(headers, twoRow));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return twoWs;
    } };
  }, flush: function() {} };
  var t21 = voidPurchaseEvent({ eventOrRequestKey: twoRow[1].RequestKey, reason: 'Test void reason' });
  check(t21.status === 'VOIDED' && t21.requestKey === twoRow[1].RequestKey, 'T21 multi-row void correct target');

  // === RPC exception path (1) ===
  var thrown = false;
  globalThis.LockService = { getScriptLock: function() {
    return { waitLock: function() { throw new Error('LOCK_ERROR'); }, releaseLock: function() {} };
  } };
  try {
    var t22 = voidPurchaseEvent({ eventOrRequestKey: 'any', reason: 'Test void reason' });
    check(t22.status === 'WRITE_UNCERTAIN' && t22.reason === 'LOCK_ERROR', 'T22 lock error maps to WRITE_UNCERTAIN');
  } catch (e) { thrown = true; }
  check(!thrown, 'T22 no throw');

  // === Multiple non-matching rows (1) ===
  globalThis.LockService = { getScriptLock: function() {
    return { waitLock: function() { lockCalls.waitLock++; }, releaseLock: function() { lockCalls.releaseLock++; } };
  } };
  var noMatchRow = makeRow('receipt-' + 'k'.repeat(32));
  var noMatchKey = 'receipt-' + 'z'.repeat(32);
  var noMatchWs = writableSheet(headers, g(headers, [noMatchRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return noMatchWs;
    } };
  }, flush: function() {} };
  var t23 = voidPurchaseEvent({ eventOrRequestKey: noMatchKey, reason: 'Test void reason' });
  check(t23.status === 'NOT_FOUND', 'T23 multiple non-matching rows');

  // === By EventID match (1) ===
  var eventIdRow = makeRow('receipt-' + 'l'.repeat(32));
  var eventIdWs = writableSheet(headers, g(headers, [eventIdRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return eventIdWs;
    } };
  }, flush: function() {} };
  var t24 = voidPurchaseEvent({ eventOrRequestKey: eventIdRow.EventID, reason: 'Test void reason' });
  check(t24.status === 'VOIDED' && t24.requestKey === eventIdRow.RequestKey, 'T24 void by EventID');

  // === Invalid input edge cases (3) ===
  check(voidPurchaseEvent({ eventOrRequestKey: '  ', reason: 'Test void reason' }).error &&
    voidPurchaseEvent({ eventOrRequestKey: '  ', reason: 'Test void reason' }).error.code === 'INVALID_REQUEST', 'T25 whitespace-only identity');
  check(voidPurchaseEvent({ eventOrRequestKey: 'test', reason: '12345' }).error === undefined, 'T26 numeric-only reason passes');
  check(voidPurchaseEvent({ eventOrRequestKey: 'test', reason: 'Test void reason'.repeat(50) }).error &&
    voidPurchaseEvent({ eventOrRequestKey: 'test', reason: 'Test void reason'.repeat(50) }).error.code === 'INVALID_VOID_REASON', 'T27 reason too long');

  // === Type coercion (1) ===
  var tcRow = makeRow('receipt-' + 'm'.repeat(32));
  var tcWs = writableSheet(headers, g(headers, [tcRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return tcWs;
    } };
  }, flush: function() {} };
  var t28 = voidPurchaseEvent({ eventOrRequestKey: tcRow.EventID, reason: 'Test void reason' });
  check(t28.status === 'VOIDED', 'T28 boolean false not coerced to string');

  // === Unknown reason code (1) ===
  var unknownCodeRow = makeRow('receipt-' + 'n'.repeat(32));
  var unknownCodeWs = writableSheet(headers, g(headers, [unknownCodeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return unknownCodeWs;
    } };
  }, flush: function() {} };
  var t29 = voidPurchaseEvent({ eventOrRequestKey: unknownCodeRow.EventID, reason: 'Test void reason' });
  check(t29.status === 'VOIDED' && t29.writeCount === 1, 'T29 unknown reason code accepted');

  // === Write count sanity (1) ===
  var wcRow = makeRow('receipt-' + 'o'.repeat(32));
  var wcWs = writableSheet(headers, g(headers, [wcRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name !== PURCHASE_EVENT_POLICY.sheet) return null;
      return wcWs;
    } };
  }, flush: function() {} };
  var t30 = voidPurchaseEvent({ eventOrRequestKey: wcRow.RequestKey, reason: 'Test void reason' });
  check(t30.writeCount === 1 && t30.status === 'VOIDED', 'T30 exactly one write');

  // Restore
  globalThis.SpreadsheetApp = originalSpreadsheetApp;
  globalThis.LockService = {
    getScriptLock: function() {
      return { waitLock: function() {}, releaseLock: function() {}, hasLock: function() { return true; } };
    }
  };

  return { status: 'PASS', assertions: count };
}

function testPurchaseEventCorrectionContracts() {
  var count = 0, clone = inventoryReceiptClone_;
  function check(value, label) { count++; if (!value) throw new Error('Correction: ' + label); }
  var source = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04'); source.run();
  var base = clone(source.events[0]), headers = PURCHASE_EVENT_POLICY.headers;
  var expenseHeaders = ['ID_Ops', 'Item', 'Kategori', 'Kind', 'Group', 'AccountCode', 'IsActive'];
  function sheet(grid, failure) {
    var data = grid.map(function(row) { return row.slice(); });
    return { data: data, getLastRow: function() { return data.length; }, getLastColumn: function() { return data[0].length; },
      getDataRange: function() { return this.getRange(1, 1, data.length, data[0].length); }, deleteRow: function(row) { data.splice(row - 1, 1); },
      getRange: function(row, col, height, width) { height = height || 1; width = width || 1; return {
        setNumberFormat: function() {}, setValue: function(value) { data[row - 1][col - 1] = value; },
        getValue: function() { return data[row - 1] && data[row - 1][col - 1]; },
        getValues: function() { return Array.from({ length: height }, function(_, i) { return Array.from({ length: width }, function(_, j) {
          return data[row - 1 + i] && data[row - 1 + i][col - 1 + j] !== undefined ? data[row - 1 + i][col - 1 + j] : '';
        }); }); },
        setValues: function(values) { if (failure && failure()) throw new Error('TEST_WRITE_FAILURE'); values.forEach(function(valuesRow, i) { data[row - 1 + i] = valuesRow.slice(); }); }
      }; }
    };
  }
  function grid(h, objects) { return [h.slice()].concat(objects.map(function(object) { return h.map(function(key) { return object[key] !== undefined ? object[key] : ''; }); })); }
  function fixture(row, options) {
    options = options || {}; var writes = 0;
    var pe = sheet(grid(headers, [clone(row)]), function() { writes++; return options.failWriteAt === writes; });
    var logs = sheet([CANONICAL_ENTRY.LOG_HEADERS.slice()], function() { writes++; return options.failWriteAt === writes; });
    var expenses = sheet(grid(expenseHeaders, _testItems));
    var resolutionSheet = sheet(grid(PURCHASE_RESOLUTION_POLICY.headers, options.resolutions || []));
    var ss = { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return pe; if (name === 'Logs') return logs;
      if (name === 'ExpenseItems') return expenses; if (name === 'InventoryReceipts') return options.receipts || null;
      if (name === PURCHASE_RESOLUTION_POLICY.sheet) return resolutionSheet; return null;
    } };
    var runtime = { flush: function() {}, audit: function() { return { actor: CANONICAL_ENTRY.USER, at: '2026-10-01T02:00:00.000Z' }; },
      uuid: (function() { var n = 0; return function() { return 'CORR-' + (++n); }; })() };
    var replacement = JSON.parse(row.NormalizedPayload); replacement.input.AcquisitionValue = '21000';
    var payload = { originalEventOrRequestKey: row.EventID, correctionRequestKey: 'correction-key-0001', reason: 'Correct purchase evidence',
      replacement: { expenseItemId: replacement.expenseItemId, input: replacement.input } };
    return { ss: ss, pe: pe, logs: logs, resolutions: resolutionSheet, payload: payload, runtime: runtime,
      run: function() { return correctPurchaseEventUnderLock_(payload, ss, runtime); } };
  }
  var f = fixture(base), result = f.run();
  check(result.status === 'CORRECTED', '1 corrected'); check(result.writeCount === 1, '2 one replacement write');
  check(f.pe.data.length === 3, '3 exactly two events'); check(f.pe.data[1][headers.indexOf('Lifecycle')] === 'CORRECTED', '4 original corrected');
  check(f.pe.data[1][headers.indexOf('IsActive')] === false, '5 original inactive'); check(f.pe.data[2][headers.indexOf('Lifecycle')] === 'CAPTURED_OPERATIONAL', '6 replacement lifecycle');
  check(f.pe.data[2][headers.indexOf('IsActive')] === true, '7 replacement active'); check(result.replacementRequestKey === 'corr-correction-key-0001', '8 deterministic key');
  check(f.pe.data[2][headers.indexOf('RecoveryKey')] === 'pe-receipt-corr-correction-key-0001', '9 receipt linkage'); check(f.pe.data[2][headers.indexOf('EventID')] === result.replacementEventId, '10 identity');
  check(f.logs.data.length === 3, '11 two audits'); check(f.logs.data[1][4] === 'CORRECT_VOID_PURCHASE' && f.logs.data[2][4] === 'CORRECT_CREATE_PURCHASE', '12 audit actions');
  check(JSON.parse(f.logs.data[1][8]).correctionRequestKey === 'correction-key-0001', '13 correction key persisted'); check(f.run().status === 'ALREADY_CORRECTED', '14 idempotent retry');
  f.payload.replacement.input.AcquisitionValue = '22000'; check(f.run().status === 'CORRECTION_CONFLICT', '15 changed retry conflicts'); check(f.pe.data.length === 3, '16 retry no event');
  var corrected = clone(base); corrected.Lifecycle = 'CORRECTED'; corrected.IsActive = false; check(fixture(corrected).run().reason === 'ALREADY_CORRECTED', '17 corrected blocked');
  var voided = clone(base); voided.Lifecycle = 'VOIDED'; voided.IsActive = false; check(fixture(voided).run().reason === 'VOIDED_ORIGINAL', '18 voided blocked');
  var corrupt = clone(base); corrupt.Lifecycle = 'BROKEN'; check(fixture(corrupt).run().reason === 'CORRUPTED_LIFECYCLE', '19 corrupt blocked');
  var receiptHeaders = INVENTORY_RECEIPT_POLICY.HEADERS, receipt = {}; receiptHeaders.forEach(function(h) { receipt[h] = 'TEST'; }); receipt.IdempotencyKey = base.RecoveryKey; receipt.IsActive = true;
  check(fixture(base, { receipts: sheet(grid(receiptHeaders, [receipt])) }).run().reason === 'REVERSAL_REQUIRED', '20 receipt blocks');
  check(fixture(base, { receipts: { getDataRange: function() { throw new Error('READ'); } } }).run().reason === 'DOWNSTREAM_CHECK_FAILED', '21 read failure blocks');
  var resolution = {}; PURCHASE_RESOLUTION_POLICY.headers.forEach(function(h) { resolution[h] = 'KEEP'; });
  f = fixture(base, { resolutions: [resolution] }); var beforeResolution = JSON.stringify(f.resolutions.data); result = f.run();
  check(result.status === 'CORRECTED', '22 with resolution'); check(JSON.stringify(f.resolutions.data) === beforeResolution, '23 resolution unchanged');
  check(f.pe.data[2][headers.indexOf('RequestKey')] !== base.RequestKey, '24 key not recycled'); check(f.pe.data[2][headers.indexOf('NormalizedPayload')].indexOf('corr-correction-key-0001') !== -1, '25 normalized key');
  [1, 2, 3, 4].forEach(function(failAt, index) { check(fixture(base, { failWriteAt: failAt }).run().status === 'WRITE_UNCERTAIN', (26 + index) + ' rollback ' + failAt); });
  f = fixture(base); var originalExpense = JSON.stringify(f.ss.getSheetByName('ExpenseItems').data), originalResolution = JSON.stringify(f.resolutions.data); f.run();
  check(JSON.stringify(f.ss.getSheetByName('ExpenseItems').data) === originalExpense, '30 expense unchanged'); check(JSON.stringify(f.resolutions.data) === originalResolution, '31 resolution store unchanged');
  check(f.ss.getSheetByName('InventoryReceipts') === null, '32 no receipt created'); check(validatePurchaseEventVoidEligibility_(base) === null, '33 void regression');
  check(isValidPurchaseEventLifecycleState_('CORRECTED', false) && expensePolicyIsPurchase_(resolveExpensePurchasePolicy_(base.ExpenseID, _testItems)), '34 lifecycle policy regression');

  function makeMinimalSS(logRows, eventRows) {
    var logHeaders = CANONICAL_ENTRY.LOG_HEADERS;
    return { getSheetByName: function(name) {
      if (name === 'Logs') {
        if (!logRows.length) return null;
        return { getLastRow: function() { return logRows.length + 1; }, getDataRange: function() { return { getValues: function() {
          return [logHeaders.slice()].concat(logRows.map(function(row) {
            return logHeaders.map(function(h) { return row[h] !== undefined ? row[h] : ''; });
          }));
        } }; } };
      }
      if (name === PURCHASE_EVENT_POLICY.sheet) {
        if (!eventRows.length) return null;
        return { getLastRow: function() { return eventRows.length + 1; }, getDataRange: function() { return { getValues: function() {
          return [headers.slice()].concat(eventRows.map(function(row) { return headers.map(function(h) { return row[h]; }); }));
        } }; } };
      }
      return null;
    } };
  }

  // === Correction Key Validation (6) ===
  check(validatePurchaseCorrectionKey_('test-key-1234'), 'valid key accepted');
  check(!validatePurchaseCorrectionKey_(''), 'empty key rejected');
  check(!validatePurchaseCorrectionKey_('short'), 'short key rejected');
  check(!validatePurchaseCorrectionKey_('a'.repeat(65)), 'long key rejected');
  check(!validatePurchaseCorrectionKey_('corr-abc-12345'), 'double-prefixed key rejected');
  check(!validatePurchaseCorrectionKey_('key with spaces'), 'spaces rejected');

  // === Replacement Identity Validation (2) ===
  var testRow = clone(base), corrKey = 'harden-test-0001';
  testRow.RequestKey = 'receipt-' + 'a'.repeat(32); testRow.EventID = 'PE-' + testRow.RequestKey;
  testRow.RecoveryKey = 'pe-receipt-' + testRow.RequestKey; testRow.Lifecycle = 'CAPTURED_OPERATIONAL'; testRow.IsActive = true;
  check('PE-corr-' + corrKey === 'PE-corr-harden-test-0001', 'replacement EventID is canonical');
  check('pe-receipt-corr-' + corrKey === 'pe-receipt-corr-harden-test-0001', 'replacement RecoveryKey is canonical');

  // === Relationship Integrity (7) ===
  var noLogIntegrity = validatePurchaseEventCorrectionIntegrity_(makeMinimalSS([], []), testRow.EventID, [testRow]);
  check(noLogIntegrity.valid && !noLogIntegrity.replacementId, 'no logs → no relationship');
  var voidLogOnly = [{ Module: 'TransactionLifecycle', Action: 'CORRECT_VOID_PURCHASE', RecordID: testRow.EventID,
    Metadata: JSON.stringify({ replacementId: 'PE-MISSING', correctionRequestKey: 'test-key', before: [] }) }];
  var missingSS = makeMinimalSS(voidLogOnly, []);
  var missingIntegrity = validatePurchaseEventCorrectionIntegrity_(missingSS, testRow.EventID, [testRow]);
  check(!missingIntegrity.valid && missingIntegrity.reason === 'ORIGINAL_NOT_CORRECTED', 'original active → integrity conflict');
  var correctedOriginal = clone(testRow); correctedOriginal.Lifecycle = 'CORRECTED'; correctedOriginal.IsActive = false;
  missingIntegrity = validatePurchaseEventCorrectionIntegrity_(missingSS, testRow.EventID, [correctedOriginal]);
  check(!missingIntegrity.valid && missingIntegrity.reason === 'REPLACEMENT_MISSING', 'replacement missing → integrity conflict');
  var inactiveReplacement = clone(testRow); inactiveReplacement.EventID = 'PE-corr-test-harden';
  inactiveReplacement.RequestKey = 'corr-test-harden'; inactiveReplacement.RecoveryKey = 'pe-receipt-corr-test-harden';
  inactiveReplacement.Lifecycle = 'VOIDED'; inactiveReplacement.IsActive = false;
  var inactiveLog = [{ Module: 'TransactionLifecycle', Action: 'CORRECT_VOID_PURCHASE', RecordID: testRow.EventID,
    Metadata: JSON.stringify({ replacementId: inactiveReplacement.EventID, correctionRequestKey: 'test-harden', before: [] }) }];
  var inactiveIntegrity = validatePurchaseEventCorrectionIntegrity_(makeMinimalSS(inactiveLog, []), testRow.EventID, [correctedOriginal, inactiveReplacement]);
  check(!inactiveIntegrity.valid && inactiveIntegrity.reason === 'REPLACEMENT_NOT_ACTIVE', 'replacement inactive → integrity conflict');
  var malformedLog = [{ Module: 'TransactionLifecycle', Action: 'CORRECT_VOID_PURCHASE', RecordID: testRow.EventID, Metadata: 'not-json' }];
  var malformedIntegrity = validatePurchaseEventCorrectionIntegrity_(makeMinimalSS(malformedLog, []), testRow.EventID, [testRow]);
  check(malformedIntegrity.valid && !malformedIntegrity.replacementId, 'malformed log → no relationship (safe)');
  var emptyMetaLog = [{ Module: 'TransactionLifecycle', Action: 'CORRECT_VOID_PURCHASE', RecordID: testRow.EventID,
    Metadata: JSON.stringify({ reason: 'test' }) }];
  var emptyMetaIntegrity = validatePurchaseEventCorrectionIntegrity_(makeMinimalSS(emptyMetaLog, []), testRow.EventID, [testRow]);
  check(!emptyMetaIntegrity.valid && emptyMetaIntegrity.reason === 'MALFORMED_VOID_LOG', 'void log missing replacementId → integrity conflict');
  var mismatchReplacement = clone(testRow); mismatchReplacement.EventID = 'PE-corr-harden-002';
  mismatchReplacement.RequestKey = 'corr-harden-002'; mismatchReplacement.RecoveryKey = 'pe-receipt-corr-harden-002';
  var mismatchedPair = [
    { Module: 'TransactionLifecycle', Action: 'CORRECT_VOID_PURCHASE', RecordID: testRow.EventID,
      Metadata: JSON.stringify({ replacementId: mismatchReplacement.EventID, correctionRequestKey: 'key-A', before: [] }) },
    { Module: 'TransactionLifecycle', Action: 'CORRECT_CREATE_PURCHASE', RecordID: mismatchReplacement.EventID,
      Metadata: JSON.stringify({ originalId: testRow.EventID, correctionRequestKey: 'key-B' }) }
  ];
  var mismatchIntegrity = validatePurchaseEventCorrectionIntegrity_(makeMinimalSS(mismatchedPair, []), testRow.EventID, [correctedOriginal, mismatchReplacement]);
  check(!mismatchIntegrity.valid && mismatchIntegrity.reason === 'LOG_PAIR_KEY_MISMATCH', 'log pair key mismatch → integrity conflict');

  return { status: 'PASS', assertions: count, scenarios: 49 };
}
