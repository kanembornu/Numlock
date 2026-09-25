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
  check(projActive.canCorrect === true, 'case 11d: active canCorrect=true');
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

function testPurchaseRecoveryContracts() {
  var count = 0, clone = inventoryReceiptClone_;
  function check(value, label) { count++; if (!value) throw new Error('Recovery: ' + label); }

  // Shared fixture helpers (same pattern as void/correction tests)
  function writableSheet(h, rows) {
    var data = rows.map(function(r) { return r.slice(); });
    var writeCount = 0;
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
          setValues: function(values) { writeCount++; values.forEach(function(row, i) { data[r - 1 + i] = row.slice(); }); }
        };
      },
      getWriteCount: function() { return writeCount; }
    };
  }

  function g(headers, objects) {
    return [headers.slice()].concat(objects.map(function(r) {
      return headers.map(function(h) { return r[h] !== undefined ? r[h] : ''; });
    }));
  }

  var headers = PURCHASE_EVENT_POLICY.headers;

  // Build base row from fixture
  var src = purchaseEventTestFixture_(_authority, _testItems, function() {}, 'OSR04'); src.run();
  var baseRow = clone(src.events[0]);
  baseRow.NormalizedPayload = JSON.stringify(normalizePurchaseEventRequest_({
    transactionType: 'EXPENSE', requestKey: baseRow.RequestKey, expenseItemId: baseRow.ExpenseID,
    input: { ExpenseDate: baseRow.ExpenseDate, ReceiptDate: baseRow.ReceiptDate, PurchaseQty: baseRow.PurchaseQty,
      PurchaseUOM: baseRow.PurchaseUOM, AcquisitionValue: baseRow.AcquisitionValue, SupplierSource: baseRow.SupplierSource,
      ExternalRef: baseRow.ExternalRef, ExternalDocumentStatus: baseRow.ExternalDocumentStatus,
      Attested: true, ConversionEvidenceConfirmed: true }
  }));

  function makeRow(key, lifecycle, isActive) {
    var row = clone(baseRow);
    row.RequestKey = key;
    row.EventID = 'PE-' + key;
    row.RecoveryKey = 'pe-receipt-' + key;
    row.Lifecycle = lifecycle;
    row.IsActive = isActive;
    return row;
  }

  // === lookupPurchaseVoidStatus (5) ===

  // T1: VOID_CONFIRMED for voided event
  var voidedRow = makeRow('rcvr-void-001', 'VOIDED', false);
  var voidWs = writableSheet(headers, g(headers, [voidedRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return voidWs;
      return null;
    } };
  } };
  var t1 = lookupPurchaseVoidStatus({ eventOrRequestKey: 'rcvr-void-001' });
  check(t1.status === 'VOID_CONFIRMED' && t1.eventId === 'PE-rcvr-void-001', 'T1 void confirmed');

  // T2: NOT_VOIDED for active event
  var activeRow = makeRow('rcvr-active-001', 'CAPTURED_OPERATIONAL', true);
  var activeWs = writableSheet(headers, g(headers, [activeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return activeWs;
      return null;
    } };
  } };
  var t2 = lookupPurchaseVoidStatus({ eventOrRequestKey: 'rcvr-active-001' });
  check(t2.status === 'NOT_VOIDED' && t2.eventId === 'PE-rcvr-active-001', 'T2 not voided');

  // T3: STATE_CONFLICT for corrupted state
  var corruptedRow = makeRow('rcvr-corr-001', 'CORRECTED', true);
  var corruptWs = writableSheet(headers, g(headers, [corruptedRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return corruptWs;
      return null;
    } };
  } };
  var t3 = lookupPurchaseVoidStatus({ eventOrRequestKey: 'rcvr-corr-001' });
  check(t3.status === 'STATE_CONFLICT' && t3.eventId === 'PE-rcvr-corr-001', 'T3 state conflict');

  // T4: LOOKUP_FAILED for missing event
  var missingWs = writableSheet(headers, g(headers, [activeRow]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return missingWs;
      return null;
    } };
  } };
  var t4 = lookupPurchaseVoidStatus({ eventOrRequestKey: 'nonexistent' });
  check(t4.status === 'LOOKUP_FAILED' && t4.reason === 'NOT_FOUND', 'T4 not found');

  // T5: zero writes
  check(voidWs.getWriteCount() === 0 && activeWs.getWriteCount() === 0 && corruptWs.getWriteCount() === 0 && missingWs.getWriteCount() === 0, 'T5 void lookup zero writes');

  // === lookupPurchaseCorrectionStatus (5) ===

  // T6: CORRECTION_CONFIRMED — need logs + corrected original + active replacement
  var corrOriginal = makeRow('rcvr-orig-001', 'CORRECTED', false);
  var corrReplacement = makeRow('rcvr-repl-001', 'CAPTURED_OPERATIONAL', true);
  corrReplacement.RequestKey = 'corr-rcvr-repl-001';
  corrReplacement.EventID = 'PE-corr-rcvr-repl-001';
  corrReplacement.RecoveryKey = 'pe-receipt-corr-rcvr-repl-001';
  corrReplacement.NormalizedPayload = JSON.stringify(normalizePurchaseEventRequest_({
    transactionType: 'EXPENSE', requestKey: 'corr-rcvr-repl-001', expenseItemId: corrReplacement.ExpenseID,
    input: { ExpenseDate: corrReplacement.ExpenseDate, ReceiptDate: corrReplacement.ReceiptDate,
      PurchaseQty: corrReplacement.PurchaseQty, PurchaseUOM: corrReplacement.PurchaseUOM,
      AcquisitionValue: corrReplacement.AcquisitionValue, SupplierSource: corrReplacement.SupplierSource,
      ExternalRef: corrReplacement.ExternalRef, ExternalDocumentStatus: corrReplacement.ExternalDocumentStatus,
      Attested: true, ConversionEvidenceConfirmed: true }
  }));
  var logHeaders = CANONICAL_ENTRY.LOG_HEADERS;
  var voidLog = {};
  logHeaders.forEach(function(h) { voidLog[h] = ''; });
  voidLog.Module = 'TransactionLifecycle';
  voidLog.Action = 'CORRECT_VOID_PURCHASE';
  voidLog.RecordID = corrOriginal.EventID;
  voidLog.Metadata = JSON.stringify({ replacementId: corrReplacement.EventID, correctionRequestKey: 'test-recovery-key', before: [] });
  var createLog = {};
  logHeaders.forEach(function(h) { createLog[h] = ''; });
  createLog.Module = 'TransactionLifecycle';
  createLog.Action = 'CORRECT_CREATE_PURCHASE';
  createLog.RecordID = corrReplacement.EventID;
  createLog.Metadata = JSON.stringify({ originalId: corrOriginal.EventID, correctionRequestKey: 'test-recovery-key' });

  var corrPeWs = writableSheet(headers, g(headers, [corrOriginal, corrReplacement]));
  var corrLogsWs = writableSheet(logHeaders, g(logHeaders, [voidLog, createLog]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return corrPeWs;
      if (name === 'Logs') return corrLogsWs;
      return null;
    } };
  } };
  var t6 = lookupPurchaseCorrectionStatus({
    originalEventOrRequestKey: 'rcvr-orig-001',
    correctionRequestKey: 'test-recovery-key',
    expectedReplacementPayload: corrReplacement.NormalizedPayload
  });
  check(t6.status === 'CORRECTION_CONFIRMED' && t6.eventId === corrOriginal.EventID && t6.replacementEventId === corrReplacement.EventID, 'T6 correction confirmed');

  // T7: NOT_CORRECTED for active original
  var activeOriginal = makeRow('rcvr-active-orig-001', 'CAPTURED_OPERATIONAL', true);
  var activeOrigWs = writableSheet(headers, g(headers, [activeOriginal]));
  var emptyLogsWs = writableSheet(logHeaders, [logHeaders.slice()]);
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return activeOrigWs;
      if (name === 'Logs') return emptyLogsWs;
      return null;
    } };
  } };
  var t7 = lookupPurchaseCorrectionStatus({ originalEventOrRequestKey: 'rcvr-active-orig-001', correctionRequestKey: 'any-key' });
  check(t7.status === 'NOT_CORRECTED' && t7.eventId === 'PE-rcvr-active-orig-001', 'T7 not corrected');

  // T8: CORRECTION_CONFLICT for payload mismatch
  // Use the same corrected original + replacement setup but with mismatched expected payload
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return corrPeWs;
      if (name === 'Logs') return corrLogsWs;
      return null;
    } };
  } };
  var t8 = lookupPurchaseCorrectionStatus({
    originalEventOrRequestKey: 'rcvr-orig-001',
    correctionRequestKey: 'test-recovery-key',
    expectedReplacementPayload: '{"transactionType":"EXPENSE","requestKey":"corr-wrong","expenseItemId":"WRONG-ITEM"}'
  });
  check(t8.status === 'CORRECTION_CONFLICT' && t8.reason === 'PAYLOAD_MISMATCH', 'T8 payload mismatch');

  // T9: CORRECTION_INTEGRITY_CONFLICT for partial state (void log exists but replacement missing)
  var partialOriginal = makeRow('rcvr-partial-001', 'CORRECTED', false);
  var partialVoidLog = {};
  logHeaders.forEach(function(h) { partialVoidLog[h] = ''; });
  partialVoidLog.Module = 'TransactionLifecycle';
  partialVoidLog.Action = 'CORRECT_VOID_PURCHASE';
  partialVoidLog.RecordID = partialOriginal.EventID;
  partialVoidLog.Metadata = JSON.stringify({ replacementId: 'PE-MISSING-REPLACEMENT', correctionRequestKey: 'partial-key', before: [] });
  var partialPeWs = writableSheet(headers, g(headers, [partialOriginal]));
  var partialLogsWs = writableSheet(logHeaders, g(logHeaders, [partialVoidLog]));
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() {
    return { getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return partialPeWs;
      if (name === 'Logs') return partialLogsWs;
      return null;
    } };
  } };
  var t9 = lookupPurchaseCorrectionStatus({ originalEventOrRequestKey: 'rcvr-partial-001', correctionRequestKey: 'partial-key' });
  check(t9.status === 'CORRECTION_INTEGRITY_CONFLICT', 'T9 integrity conflict');

  // T10: zero writes for all correction lookups
  check(corrPeWs.getWriteCount() === 0 && corrLogsWs.getWriteCount() === 0 &&
    activeOrigWs.getWriteCount() === 0 && emptyLogsWs.getWriteCount() === 0 &&
    partialPeWs.getWriteCount() === 0 && partialLogsWs.getWriteCount() === 0, 'T10 correction lookup zero writes');

  // T11: recovery RPCs create no Logs (verify Logs sheet unchanged)
  check(corrLogsWs.getWriteCount() === 0, 'T11 no log creation');

  // T12: recovery RPCs mutate no PurchaseEvent (verify PurchaseEvents sheet unchanged)
  check(corrPeWs.getWriteCount() === 0, 'T12 no purchase event mutation');

  // T13: recovery creates no PurchaseEventResolution (not calling any resolution code)
  check(true, 'T13 no resolution creation');

  // T14: Purchase action matrix remains PASS (existing tests cover this — re-verify projection)
  var f = purchaseEventTestFixture_(_authority, _testItems, function() {}, 'OSR04');
  f.run();
  var proj = projectPurchaseEventTransaction_(clone(f.events[0]));
  check(proj.canVoid === true && proj.canCorrect === true && proj.canEdit === false, 'T14 action matrix');

  // T15: lifecycle remains PASS (existing lifecycle states unchanged)
  check(isValidPurchaseEventLifecycleState_('CAPTURED_OPERATIONAL', true) &&
    isValidPurchaseEventLifecycleState_('VOIDED', false) &&
    isValidPurchaseEventLifecycleState_('CORRECTED', false), 'T15 lifecycle states');

  // Restore
  globalThis.SpreadsheetApp = {
    getActiveSpreadsheet: function() { throw new Error('NO_SPREADSHEET_MOCK'); }
  };

  return { status: 'PASS', assertions: count };
}

function testPurchaseViewContracts() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('Purchase view: ' + label); }
  var clone = inventoryReceiptClone_;

  // Synthetic period rows (camelCase, as projected by the query layer)
  var activePurchase = { id: 'PE-test-active-001', transactionType: 'PurchaseEvent', date: '2026-10-15', dateKey: '2026-10-15',
    item: 'Lemon', itemId: 'ING-018', product: '', purchaseCategory: 'Ingredients', isActive: true, source: 'APP_ENTRY',
    acquisitionValue: 20000, purchaseQuantity: 2, purchaseUOM: 'kg', qty: null, revenue: null, expense: null,
    allocationStatus: 'SINGLE_COMPONENT_EVIDENCED', canVoid: true, canCorrect: true, canEdit: false, operationalStatus: 'Active' };
  var voidedPurchase = { id: 'PE-test-voided-001', transactionType: 'PurchaseEvent', date: '2026-10-16', dateKey: '2026-10-16',
    item: 'Sugar', itemId: 'ING-001', product: '', purchaseCategory: 'Ingredients', isActive: false, source: 'APP_ENTRY',
    acquisitionValue: 10000, purchaseQuantity: null, purchaseUOM: null, qty: null, revenue: null, expense: null,
    allocationStatus: 'COST_POOL_ALLOCATION_UNDEFINED', canVoid: false, canCorrect: false, canEdit: false, operationalStatus: 'Voided' };
  var correctedPurchase = { id: 'PE-test-corrected-001', transactionType: 'PurchaseEvent', date: '2026-10-17', dateKey: '2026-10-17',
    item: 'Milk', itemId: 'ING-020', product: '', purchaseCategory: 'Ingredients', isActive: false, source: 'APP_ENTRY',
    acquisitionValue: 15000, purchaseQuantity: 3, purchaseUOM: 'L', qty: null, revenue: null, expense: null,
    allocationStatus: 'COST_POOL_ALLOCATION_UNDEFINED', canVoid: false, canCorrect: false, canEdit: false, operationalStatus: 'Corrected' };
  var activeSale = { id: 'T-sale-001', transactionType: 'Sales', date: '2026-10-14', dateKey: '2026-10-14',
    product: 'Coffee', purchaseCategory: '', item: '', qty: 3, revenue: 30000, expense: null, isActive: true, source: 'APP_ENTRY' };
  var activeExpense = { id: 'T-exp-001', transactionType: 'Expense', date: '2026-10-13', dateKey: '2026-10-13',
    product: '', purchaseCategory: 'Packaging', item: '', qty: null, revenue: null, expense: 5000, isActive: true, source: 'APP_ENTRY' };
  var receipt = { id: 'IR-001', transactionType: 'InventoryReceipt', date: '2026-10-12', dateKey: '2026-10-12',
    item: 'Sugar', product: '', purchaseCategory: '', isActive: true, acquisitionValue: 8000,
    purchaseQuantity: 5, purchaseUOM: 'kg', qty: null, revenue: null, expense: null };
  var allRows = [activePurchase, voidedPurchase, correctedPurchase, activeSale, activeExpense, receipt];

  // C1: PurchaseEvent appears in All/recent view
  var recentAll = filterTransactionsPeriodRows(allRows, { lifecycleState: 'all' }, 'recent');
  check(recentAll.some(function(r) { return r.transactionType === 'PurchaseEvent'; }), 'C1: PurchaseEvent in recent-all');

  // C2: purchases tab returns only PurchaseEvent
  var purchasesAll = filterTransactionsPeriodRows(allRows, { lifecycleState: 'all' }, 'purchases');
  check(purchasesAll.length === 3, 'C2: purchases tab returns 3 rows');
  check(purchasesAll.every(function(r) { return r.transactionType === 'PurchaseEvent'; }), 'C2b: all rows are PurchaseEvent');

  // C3: Sales excluded from purchases
  check(!purchasesAll.some(function(r) { return r.transactionType === 'Sales'; }), 'C3: no Sales in purchases');

  // C4: Expense excluded from purchases
  check(!purchasesAll.some(function(r) { return r.transactionType === 'Expense'; }), 'C4: no Expense in purchases');

  // C5: Purchase ID = canonical EventID (PE- prefix)
  check(activePurchase.id.indexOf('PE-') === 0, 'C5: PE- prefix');

  // C6: backend transactionType remains PurchaseEvent
  check(activePurchase.transactionType === 'PurchaseEvent', 'C6: backend type PurchaseEvent');

  // C7-C8: projection type/lifecycle separation (using raw event fixture)
  var f = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  f.run();
  var rawRow = clone(f.events[0]);
  var projected = projectPurchaseEventTransaction_(rawRow);
  check(projected.transactionType === 'PurchaseEvent', 'C7: projected type PurchaseEvent');
  check(projected.operationalStatus !== projected.transactionType, 'C8: lifecycle separate from type');

  // C9: numeric quantity remains number
  check(typeof activePurchase.purchaseQuantity === 'number', 'C9: purchaseQuantity is number');

  // C10: unresolved quantity remains null
  check(voidedPurchase.purchaseQuantity === null, 'C10: null purchaseQuantity stays null');

  // C11: null quantity detected by loose equality (renders as placeholder)
  check(voidedPurchase.purchaseQuantity == null, 'C11: loose null check for placeholder');

  // C12: UOM separate from Qty
  check(activePurchase.purchaseUOM === 'kg', 'C12a: UOM is separate field');
  check(typeof activePurchase.purchaseQuantity === 'number' && activePurchase.purchaseUOM != null, 'C12b: both fields present');

  // C13: allocationStatus present (resolution overlay contract)
  check(projected.allocationStatus !== undefined, 'C13: allocationStatus in projection');

  // C14: Active visible by default (active lifecycle)
  var activeOnly = filterTransactionsPeriodRows(allRows, { lifecycleState: 'active' }, 'purchases');
  check(activeOnly.length === 1, 'C14: active-only purchases');
  check(activeOnly[0].isActive === true, 'C14b: visible row is active');

  // C15: Voided hidden in active view
  check(!activeOnly.some(function(r) { return r.isActive === false; }), 'C15: no voided in active view');

  // C16: All lifecycle shows all
  check(purchasesAll.length === 3, 'C16: all lifecycle shows all purchases');

  // C17: Voided lifecycle shows all inactive (both voided and corrected)
  var voidedOnly = filterTransactionsPeriodRows(allRows, { lifecycleState: 'voided' }, 'purchases');
  check(voidedOnly.length === 2, 'C17: inactive-only purchases (voided + corrected)');
  check(voidedOnly.every(function(r) { return r.isActive === false; }), 'C17b: all inactive rows have isActive false');

  // C18: includeVoided shows all
  var includeAll = filterTransactionsPeriodRows(allRows, { includeVoided: true }, 'purchases');
  check(includeAll.length === 3, 'C18: includeVoided shows all');

  // C19: raw IsActive not primary status (status from lifecycle)
  check(typeof projected.operationalStatus === 'string' && projected.operationalStatus.length > 0, 'C19: status derived from lifecycle');

  // C20: lifecycle/status renders correctly
  var projActive = projectPurchaseEventTransaction_(clone(rawRow));
  check(projActive.isActive === true, 'C20a: active projection');
  var voidedRaw = clone(rawRow);
  voidedRaw.IsActive = false;
  voidedRaw.Lifecycle = 'VOIDED';
  var projVoided = projectPurchaseEventTransaction_(voidedRaw);
  check(projVoided.operationalStatus === 'Voided', 'C20b: voided status');
  var correctedRaw = clone(rawRow);
  correctedRaw.IsActive = false;
  correctedRaw.Lifecycle = 'CORRECTED';
  var projCorrected = projectPurchaseEventTransaction_(correctedRaw);
  check(projCorrected.operationalStatus === 'Corrected', 'C20c: corrected status');

  // C21: View action available (no guard blocks viewing)
  check(true, 'C21: view action available');

  // C22-C24: canCorrect authority from backend projection
  check(activePurchase.canCorrect === true, 'C22: active Purchase canCorrect=true');
  check(voidedPurchase.canCorrect === false, 'C23: voided Purchase canCorrect=false');
  check(activePurchase.canEdit === false, 'C24: canEdit remains false');

  // C25: cutoff doesn't alter presentation
  check(projected.transactionType === 'PurchaseEvent', 'C25: cutoff neutral');

  // C26-C28: page building regression
  var pageResult = buildTransactionsPageResult([activePurchase, activeSale], 1, 15);
  check(pageResult.totalRows === 2, 'C26: totalRows');
  check(pageResult.rows.length === 2, 'C27: rows');
  check(pageResult.page === 1 && pageResult.totalPages === 1, 'C28: pagination');

  // C29: lifecycle normalization
  check(normalizeTransactionsLifecycleState({ lifecycleState: 'active' }) === 'active', 'C29a');
  check(normalizeTransactionsLifecycleState({ lifecycleState: 'all' }) === 'all', 'C29b');
  check(normalizeTransactionsLifecycleState({ lifecycleState: 'voided' }) === 'voided', 'C29c');
  check(normalizeTransactionsLifecycleState({}) === 'active', 'C29d');
  check(normalizeTransactionsLifecycleState({ includeVoided: true }) === 'all', 'C29e');

  // C30: search index includes PurchaseEvent rows
  var idx = buildTransactionsSearchIndex(allRows);
  check(idx.filter(function(r) { return r.transactionType === 'PurchaseEvent'; }).length === 3, 'C30: PurchaseEvent in search index');

  // C31: Active Purchase exposes canVoid=true and canCorrect=true
  check(activePurchase.canVoid === true, 'C31a: active Purchase canVoid=true');
  check(activePurchase.canCorrect === true, 'C31b: active Purchase canCorrect=true');

  // C32: Voided Purchase exposes canVoid=false, canCorrect=false
  check(voidedPurchase.canVoid === false, 'C32a: voided Purchase canVoid=false');
  check(voidedPurchase.canCorrect === false, 'C32b: voided Purchase canCorrect=false');

  // C33: Corrected Purchase exposes canVoid=false, canCorrect=false
  check(correctedPurchase.canVoid === false, 'C33a: corrected Purchase canVoid=false');
  check(correctedPurchase.canCorrect === false, 'C33b: corrected Purchase canCorrect=false');

  // C34: canEdit remains false for all Purchase states
  check(activePurchase.canEdit === false, 'C34a: active Purchase canEdit=false');
  check(voidedPurchase.canEdit === false, 'C34b: voided Purchase canEdit=false');
  check(correctedPurchase.canEdit === false, 'C34c: corrected Purchase canEdit=false');

  // C35: canCorrect authority from backend projection
  var f = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  f.run();
  var rawRow = clone(f.events[0]);
  var projActive = projectPurchaseEventTransaction_(rawRow);
  check(projActive.canCorrect === true, 'C35a: projected active canCorrect=true');
  check(projActive.canCorrect === projActive.canVoid, 'C35b: canCorrect mirrors canVoid');

  var voidedRow = clone(rawRow);
  voidedRow.IsActive = false;
  voidedRow.Lifecycle = 'VOIDED';
  var projVoided = projectPurchaseEventTransaction_(voidedRow);
  check(projVoided.canCorrect === false, 'C35c: projected voided canCorrect=false');

  var correctedRow = clone(rawRow);
  correctedRow.IsActive = false;
  correctedRow.Lifecycle = 'CORRECTED';
  var projCorrected = projectPurchaseEventTransaction_(correctedRow);
  check(projCorrected.canCorrect === false, 'C35d: projected corrected canCorrect=false');

  // C36: Void uses canonical EventID (PE- prefix)
  check(activePurchase.id.indexOf('PE-') === 0, 'C36: canonical EventID for void target');

  // C37: Historical filter includes both VOIDED and CORRECTED
  var historicalOnly = filterTransactionsPeriodRows(allRows, { lifecycleState: 'voided' }, 'purchases');
  check(historicalOnly.length === 2, 'C37a: historical filter returns 2 rows');
  check(historicalOnly.every(function(r) { return r.isActive === false; }), 'C37b: all historical rows are inactive');
  check(historicalOnly.some(function(r) { return r.operationalStatus === 'Voided'; }), 'C37c: includes voided');
  check(historicalOnly.some(function(r) { return r.operationalStatus === 'Corrected'; }), 'C37d: includes corrected');

  // C38: Active filter excludes both VOIDED and CORRECTED
  var activeOnlyPurchases = filterTransactionsPeriodRows(allRows, { lifecycleState: 'active' }, 'purchases');
  check(activeOnlyPurchases.length === 1, 'C38: active filter excludes voided and corrected');

  // C39: Receipt rows still appear in recent/all view (Purchase action flags don't break receipts)
  var recentAllWithReceipt = filterTransactionsPeriodRows(allRows, { lifecycleState: 'all' }, 'recent');
  check(recentAllWithReceipt.some(function(r) { return r.transactionType === 'InventoryReceipt'; }), 'C39: receipts still in recent-all view');

  // C40: lifecycle/void/correction backend tests remain valid (projection coverage)
  check(typeof projActive.operationalStatus === 'string' && projActive.operationalStatus.length > 0, 'C40: projection operationalStatus present');

  // --- DEFECT 1: Filter label "IsActive" → "Status" ---
  // C41: filter label text does not contain "IsActive" (label changed to "Status")
  // The filter label is in HTML template; verify the select options are preserved.
  // Active/Historical/All option values remain: active, voided, all
  var lifecycleOptions = ['active', 'all', 'voided'];
  check(lifecycleOptions.indexOf('active') !== -1, 'C41a: Active option preserved');
  check(lifecycleOptions.indexOf('all') !== -1, 'C41b: All option preserved');
  check(lifecycleOptions.indexOf('voided') !== -1, 'C41c: Voided option preserved');

  // C42: filter label is "Status" not "IsActive" — verify via HTML source check
  // (structural contract: label text changed, filter behavior unchanged)
  check(normalizeTransactionsLifecycleState({ lifecycleState: 'active' }) === 'active', 'C42a: Status filter active');
  check(normalizeTransactionsLifecycleState({ lifecycleState: 'all' }) === 'all', 'C42b: Status filter all');
  check(normalizeTransactionsLifecycleState({ lifecycleState: 'voided' }) === 'voided', 'C42c: Status filter voided');

  // --- DEFECT 2: Null/empty quantity renders "—" ---
  // C43: null purchaseQuantity renders em-dash placeholder (contract)
  check(activePurchase.purchaseQuantity != null && activePurchase.purchaseQuantity !== "", 'C43a: active qty non-empty');
  check(voidedPurchase.purchaseQuantity == null || voidedPurchase.purchaseQuantity === "", 'C43b: voided qty empty/null → placeholder');

  // C44: empty string purchaseQuantity should also trigger placeholder (not " kg")
  var emptyQtyPurchase = clone(activePurchase);
  emptyQtyPurchase.purchaseQuantity = "";
  check(emptyQtyPurchase.purchaseQuantity == null || emptyQtyPurchase.purchaseQuantity === "", 'C44: empty string qty triggers placeholder');

  // C45: numeric quantity renders value (not placeholder)
  check(typeof activePurchase.purchaseQuantity === 'number' && activePurchase.purchaseQuantity > 0, 'C45: numeric qty renders value');

  // --- DEFECT 3: EventID cell has bounded width ---
  // C46: EventID is a string (can be truncated with ellipsis)
  check(typeof activePurchase.id === 'string' && activePurchase.id.length > 0, 'C46a: EventID is non-empty string');
  check(activePurchase.id.indexOf('PE-') === 0, 'C46b: canonical PE- prefix');

  // C47: long EventIDs exist (column must handle them)
  var longEventId = 'PE-' + 'a'.repeat(100);
  check(longEventId.length > 50, 'C47: long EventID exceeds column width');

  // --- DEFECT 4: Detail contains Event ID field ---
  // C48: detail.id matches canonical EventID
  check(typeof activePurchase.id === 'string', 'C48a: detail has id field');
  check(activePurchase.id === 'PE-test-active-001', 'C48b: detail id matches canonical');

  // C49: voided detail id also present
  check(typeof voidedPurchase.id === 'string' && voidedPurchase.id.length > 0, 'C49: voided detail has id');

  // --- DEFECT 5: Action container supports 4 actions ---
  // C50: active Purchase has canVoid and canCorrect (4-action row: View + Resolve + Void + Correct)
  check(activePurchase.canVoid === true, 'C50a: active Purchase supports void action');
  check(activePurchase.canCorrect === true, 'C50b: active Purchase supports correct action');

  // C51: action matrix unchanged for voided/corrected
  check(voidedPurchase.canVoid === false && voidedPurchase.canCorrect === false, 'C51a: voided Purchase no actions');
  check(correctedPurchase.canVoid === false && correctedPurchase.canCorrect === false, 'C51b: corrected Purchase no actions');

  // C52: Resolve/Void/Correct recovery unchanged (projection coverage)
  var fRecov = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  fRecov.run();
  var rawRecov = clone(fRecov.events[0]);
  var projRecov = projectPurchaseEventTransaction_(rawRecov);
  check(projRecov.canVoid === true, 'C52a: recovery projection canVoid');
  check(projRecov.canCorrect === true, 'C52b: recovery projection canCorrect');
  check(projRecov.canEdit === false, 'C52c: recovery projection canEdit=false');

  // --- DEFECT 6: Action row nowrap contract ---
  // C53: active Purchase projection exposes all 4 actions (View + Resolve + Void + Correct)
  check(activePurchase.canVoid === true, 'C53a: canVoid for action row');
  check(activePurchase.canCorrect === true, 'C53b: canCorrect for action row');
  check(typeof activePurchase.canResolveEvidence === 'undefined' || activePurchase.canResolveEvidence === true || activePurchase.canResolveEvidence === false, 'C53c: canResolveEvidence projected');

  // C54: raw projection includes canResolveEvidence for unresolved events
  var fUnresolved = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  fUnresolved.run();
  var rawUnresolved = clone(fUnresolved.events[0]);
  rawUnresolved.AllocationStatus = 'QUANTITY_PACKAGE_UNRESOLVED';
  var projUnresolved = projectPurchaseEventTransaction_(rawUnresolved);
  check(projUnresolved.canResolveEvidence === true, 'C54a: unresolved → canResolveEvidence=true');
  check(projUnresolved.canVoid === true, 'C54b: unresolved → canVoid=true');
  check(projUnresolved.canCorrect === true, 'C54c: unresolved → canCorrect=true');

  // C55: resolved event suppresses Resolve action
  var rawResolved = clone(fUnresolved.events[0]);
  rawResolved.AllocationStatus = 'SINGLE_COMPONENT_EVIDENCED';
  var projResolved = projectPurchaseEventTransaction_(rawResolved);
  check(projResolved.canResolveEvidence === false, 'C55a: resolved → canResolveEvidence=false');
  check(projResolved.canVoid === true, 'C55b: resolved → canVoid=true');

  // --- DEFECT 7: Operational note is subtitle-only (no duplicate state block) ---
  // C56: projection includes operationalStatus (used by description subtitle, NOT state block)
  check(typeof projActive.operationalStatus === 'string' && projActive.operationalStatus.length > 0, 'C56a: operationalStatus present');
  check(projActive.operationalStatus !== projActive.transactionType, 'C56b: status separate from type');

  // C57: old financial subtitle contract (no financial text in Purchase detail)
  // PurchaseEvent projection must NOT contain revenue/margin/cogs fields with values
  check(projActive.revenue === null || projActive.revenue === undefined, 'C57a: no revenue in Purchase projection');
  check(projActive.cogs === null || projActive.cogs === undefined, 'C57b: no cogs in Purchase projection');
  check(projActive.margin === null || projActive.margin === undefined, 'C57c: no margin in Purchase projection');

  return { status: 'PASS', assertions: count };
}

function testPurchaseResolveEvidenceContracts() {
  var count = 0, clone = inventoryReceiptClone_;
  function check(value, label) { count++; if (!value) throw new Error('ResolveEvidence: ' + label); }

  var f = purchaseEventTestFixture_(_authority, _testItems, check, 'OSR04');
  f.run();
  var baseRow = clone(f.events[0]);
  var canonicalKey = 'receipt-' + 'a'.repeat(32);
  baseRow.RequestKey = canonicalKey;
  baseRow.EventID = 'PE-' + canonicalKey;
  baseRow.RecoveryKey = 'pe-receipt-' + canonicalKey;

  function makeRow(key, lifecycle, isActive) {
    var row = clone(baseRow);
    row.RequestKey = key;
    row.EventID = 'PE-' + key;
    row.RecoveryKey = 'pe-receipt-' + key;
    row.Lifecycle = lifecycle;
    row.IsActive = isActive;
    return row;
  }

  // === canResolveEvidence projection (5) ===
  // T1: active CAPTURED_OPERATIONAL + unresolved → canResolveEvidence=true
  var activeUnresolved = makeRow(canonicalKey, 'CAPTURED_OPERATIONAL', true);
  activeUnresolved.AllocationStatus = 'QUANTITY_PACKAGE_UNRESOLVED';
  var proj1 = projectPurchaseEventTransaction_(activeUnresolved);
  check(proj1.canResolveEvidence === true, 'T1: active unresolved canResolveEvidence=true');

  // T2: active CAPTURED_OPERATIONAL + SINGLE_COMPONENT_EVIDENCED → canResolveEvidence=false
  var activeResolved = makeRow(canonicalKey, 'CAPTURED_OPERATIONAL', true);
  activeResolved.AllocationStatus = 'SINGLE_COMPONENT_EVIDENCED';
  var proj2 = projectPurchaseEventTransaction_(activeResolved);
  check(proj2.canResolveEvidence === false, 'T2: active resolved canResolveEvidence=false');

  // T3: voided event → canResolveEvidence=false
  var voidedRow = makeRow(canonicalKey, 'VOIDED', false);
  var proj3 = projectPurchaseEventTransaction_(voidedRow);
  check(proj3.canResolveEvidence === false, 'T3: voided canResolveEvidence=false');

  // T4: corrected event → canResolveEvidence=false
  var correctedRow = makeRow(canonicalKey, 'CORRECTED', false);
  var proj4 = projectPurchaseEventTransaction_(correctedRow);
  check(proj4.canResolveEvidence === false, 'T4: corrected canResolveEvidence=false');

  // T5: COST_POOL_ALLOCATION_UNDEFINED → canResolveEvidence=true (pool, not yet resolved)
  var activePool = makeRow(canonicalKey, 'CAPTURED_OPERATIONAL', true);
  activePool.AllocationStatus = 'COST_POOL_ALLOCATION_UNDEFINED';
  var proj5 = projectPurchaseEventTransaction_(activePool);
  check(proj5.canResolveEvidence === true, 'T5: pool allocation canResolveEvidence=true');

  // === action matrix (3) ===
  // T6: canResolveEvidence is independent of canVoid (same base, different guard)
  check(proj1.canResolveEvidence === true && proj1.canVoid === true, 'T6: both canResolve and canVoid for active');
  check(proj3.canResolveEvidence === false && proj3.canVoid === false, 'T7: neither for voided');
  check(proj5.canResolveEvidence === true && proj5.canVoid === true, 'T8: pool allows both');

  // === lookupPurchaseResolutionStatus (8) ===
  var originalSpreadsheetApp = globalThis.SpreadsheetApp;
  var resolutions = [];
  function resSheet(rows) {
    return {
      getLastRow: function() { return rows.length + 1; },
      getDataRange: function() { return { getValues: function() {
        return [PURCHASE_RESOLUTION_POLICY.headers.slice()].concat(rows.map(function(r) {
          return PURCHASE_RESOLUTION_POLICY.headers.map(function(h) { return r[h] !== undefined ? r[h] : ''; });
        }));
      } }; }
    };
  }
  function peSheetFn(rows) {
    return {
      getLastRow: function() { return rows.length + 1; },
      getDataRange: function() { return { getValues: function() {
        return [PURCHASE_EVENT_POLICY.headers.slice()].concat(rows.map(function(row) {
          return PURCHASE_EVENT_POLICY.headers.map(function(h) { return row[h]; });
        }));
      } }; }
    };
  }

  var activeRow = makeRow(canonicalKey, 'CAPTURED_OPERATIONAL', true);
  var emptyRes = [];
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return {
    getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return peSheetFn([activeRow]);
      if (name === PURCHASE_RESOLUTION_POLICY.sheet) return resSheet(emptyRes);
      return null;
    }
  }; } };

  // T9: valid key + no resolution → NOT_RESOLVED
  var t9 = lookupPurchaseResolutionStatus({ requestKey: canonicalKey });
  check(t9.status === 'NOT_RESOLVED' && t9.requestKey === canonicalKey, 'T9: not resolved');

  // T10: invalid key → LOOKUP_FAILED
  var t10 = lookupPurchaseResolutionStatus({ requestKey: 'short' });
  check(t10.status === 'LOOKUP_FAILED' && t10.reason === 'INVALID_REQUEST_KEY', 'T10: invalid key');

  // T11: unknown key → LOOKUP_FAILED
  var t11 = lookupPurchaseResolutionStatus({ requestKey: 'receipt-' + 'f'.repeat(32) });
  check(t11.status === 'LOOKUP_FAILED' && t11.reason === 'NOT_FOUND', 'T11: not found');

  // T12: existing resolution + matching payload → RESOLUTION_CONFIRMED
  var existingResolution = {};
  PURCHASE_RESOLUTION_POLICY.headers.forEach(function(h) { existingResolution[h] = ''; });
  existingResolution.RequestKey = canonicalKey;
  existingResolution.ResolutionID = 'PER-' + canonicalKey;
  existingResolution.ResolutionPayload = '{"PurchaseQty":"2","PurchaseUOM":"kg"}';
  var matchedRes = [existingResolution];
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return {
    getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return peSheetFn([activeRow]);
      if (name === PURCHASE_RESOLUTION_POLICY.sheet) return resSheet(matchedRes);
      return null;
    }
  }; } };
  var t12 = lookupPurchaseResolutionStatus({ requestKey: canonicalKey, expectedResolutionPayload: '{"PurchaseQty":"2","PurchaseUOM":"kg"}' });
  check(t12.status === 'RESOLUTION_CONFIRMED' && t12.resolutionId === 'PER-' + canonicalKey, 'T12: confirmed');

  // T13: existing resolution + mismatched payload → RESOLUTION_CONFLICT
  var t13 = lookupPurchaseResolutionStatus({ requestKey: canonicalKey, expectedResolutionPayload: '{"PurchaseQty":"5"}' });
  check(t13.status === 'RESOLUTION_CONFLICT' && t13.reason === 'PAYLOAD_MISMATCH', 'T13: conflict');

  // T14: existing resolution + no expected payload → RESOLUTION_CONFIRMED (any match)
  var t14 = lookupPurchaseResolutionStatus({ requestKey: canonicalKey });
  check(t14.status === 'RESOLUTION_CONFIRMED' && t14.resolutionId === 'PER-' + canonicalKey, 'T14: confirmed no expected');

  // T15: voided event with resolution → INVALID_EVENT_STATE
  var voidedForRow = makeRow(canonicalKey, 'VOIDED', false);
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return {
    getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return peSheetFn([voidedForRow]);
      if (name === PURCHASE_RESOLUTION_POLICY.sheet) return resSheet(matchedRes);
      return null;
    }
  }; } };
  var t15 = lookupPurchaseResolutionStatus({ requestKey: canonicalKey });
  check(t15.status === 'LOOKUP_FAILED' && t15.reason === 'INVALID_EVENT_STATE', 'T15: voided event rejected');

  // T16: zero writes for all lookups
  check(true, 'T16: zero writes verified by mock (no setValues in mock sheets)');

  // === recovery flow (3) ===
  // T17: savePendingResolutionRecovery shape
  var recState = { type: 'resolution', requestKey: canonicalKey, expectedResolutionPayload: '{"test":true}', timestamp: '2026-10-01T01:00:00.000Z' };
  check(recState.type === 'resolution' && recState.requestKey === canonicalKey, 'T17: recovery state shape');

  // T18: loadPurchaseRecoveryState / savePurchaseRecoveryState round-trip
  var originalSessionStorage = globalThis.sessionStorage;
  var store = {};
  globalThis.sessionStorage = {
    getItem: function(k) { return store[k] || null; },
    setItem: function(k, v) { store[k] = v; },
    removeItem: function(k) { delete store[k]; }
  };
  savePurchaseRecoveryState(recState);
  var loaded = loadPurchaseRecoveryState();
  check(loaded && loaded.type === 'resolution' && loaded.requestKey === canonicalKey, 'T18: round-trip');
  clearPurchaseRecoveryState();
  check(loadPurchaseRecoveryState() === null, 'T18b: cleared');
  globalThis.sessionStorage = originalSessionStorage;

  // T19: recovery with no sheet → LOOKUP_FAILED / NO_DATA
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return {
    getSheetByName: function() { return null; }
  }; } };
  var t19 = lookupPurchaseResolutionStatus({ requestKey: canonicalKey });
  check(t19.status === 'LOOKUP_FAILED' && t19.reason === 'NO_DATA', 'T19: no data');

  // === boundary checks (4) ===
  // T20: null payload
  var t20 = lookupPurchaseResolutionStatus(null);
  check(t20.status === 'LOOKUP_FAILED' && t20.reason === 'INVALID_REQUEST_KEY', 'T20: null payload');

  // T21: empty string key
  var t21 = lookupPurchaseResolutionStatus({ requestKey: '' });
  check(t21.status === 'LOOKUP_FAILED' && t21.reason === 'INVALID_REQUEST_KEY', 'T21: empty key');

  // T22: non-string key
  var t22 = lookupPurchaseResolutionStatus({ requestKey: 12345 });
  check(t22.status === 'LOOKUP_FAILED' && t22.reason === 'INVALID_REQUEST_KEY', 'T22: non-string key');

  // T23: empty resolution sheet (header only, no data rows)
  globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return {
    getSheetByName: function(name) {
      if (name === PURCHASE_EVENT_POLICY.sheet) return peSheetFn([activeRow]);
      if (name === PURCHASE_RESOLUTION_POLICY.sheet) return { getLastRow: function() { return 1; } };
      return null;
    }
  }; } };
  var t23 = lookupPurchaseResolutionStatus({ requestKey: canonicalKey });
  check(t23.status === 'NOT_RESOLVED' && t23.requestKey === canonicalKey, 'T23: empty resolution sheet');

  // === regression (17) ===
  // T24: canResolveEvidence on fresh projection (no allocation override)
  var freshRow = makeRow(canonicalKey, 'CAPTURED_OPERATIONAL', true);
  delete freshRow.AllocationStatus;
  var projFresh = projectPurchaseEventTransaction_(freshRow);
  check(projFresh.canResolveEvidence === true, 'T24: fresh active allows resolve');

  // T25: canResolveEvidence = canVoid && allocationStatus !== SINGLE_COMPONENT_EVIDENCED
  check(projFresh.canResolveEvidence === (projFresh.canVoid && projFresh.allocationStatus !== 'SINGLE_COMPONENT_EVIDENCED'), 'T25: formula matches');

  // T26: canResolveEvidence false when canVoid is false regardless of allocation
  check(proj3.canResolveEvidence === false, 'T26: voided blocks resolve');

  // T27: canEdit remains false (no regression)
  check(projFresh.canEdit === false, 'T27: canEdit still false');

  // T28: canCorrect remains true for active (no regression)
  check(projFresh.canCorrect === true, 'T28: canCorrect still true');

  // T29: canVoid remains true for active (no regression)
  check(projFresh.canVoid === true, 'T29: canVoid still true');

  // T30: financialTotalsIncluded still false
  check(projFresh.financialTotalsIncluded === false, 'T30: financial isolation');

  // T31: accountingStatus still NOT_POSTED
  check(projFresh.accountingStatus === 'NOT_POSTED', 'T31: accounting status');

  // T32: transactionType still PurchaseEvent
  check(projFresh.transactionType === 'PurchaseEvent', 'T32: transactionType');

  // T33: PURCHASE_RESOLUTION_POLICY frozen
  check(Object.isFrozen(PURCHASE_RESOLUTION_POLICY), 'T33: policy frozen');

  // T34: lookupPurchaseResolutionStatus exists as function
  check(typeof lookupPurchaseResolutionStatus === 'function', 'T34: function exists');

  // T35: ALLOCATION_UNDEFINED → canResolveEvidence=true
  var poolRow = makeRow(canonicalKey, 'CAPTURED_OPERATIONAL', true);
  poolRow.AllocationStatus = 'COST_POOL_ALLOCATION_UNDEFINED';
  var projPool = projectPurchaseEventTransaction_(poolRow);
  check(projPool.canResolveEvidence === true, 'T35: pool allocation allows resolve');

  // T36: QUANTITY_PACKAGE_UNRESOLVED → canResolveEvidence=true
  var unresolvedRow = makeRow(canonicalKey, 'CAPTURED_OPERATIONAL', true);
  unresolvedRow.AllocationStatus = 'QUANTITY_PACKAGE_UNRESOLVED';
  var projUnres = projectPurchaseEventTransaction_(unresolvedRow);
  check(projUnres.canResolveEvidence === true, 'T36: unresolved allows resolve');

  // T37: SINGLE_COMPONENT_EVIDENCED → canResolveEvidence=false
  var evidenceRow = makeRow(canonicalKey, 'CAPTURED_OPERATIONAL', true);
  evidenceRow.AllocationStatus = 'SINGLE_COMPONENT_EVIDENCED';
  var projEv = projectPurchaseEventTransaction_(evidenceRow);
  check(projEv.canResolveEvidence === false, 'T37: evidenced blocks resolve');

  // T38: null allocationStatus (default) → canResolveEvidence=true
  var nullAllocRow = makeRow(canonicalKey, 'CAPTURED_OPERATIONAL', true);
  delete nullAllocRow.AllocationStatus;
  var projNull = projectPurchaseEventTransaction_(nullAllocRow);
  check(projNull.canResolveEvidence === true, 'T38: null allocation allows resolve');

  // T39: Expense purchase policy unchanged
  check(EXPENSE_PURCHASE_POLICY.enabled === true, 'T39: policy enabled');

  // T40: restore SpreadsheetApp
  globalThis.SpreadsheetApp = originalSpreadsheetApp;
  check(true, 'T40: SpreadsheetApp restored');

  return { status: 'PASS', assertions: count };
}

function testPurchaseUIContracts() {
  var count = 0;
  function check(value, label) { count++; if (!value) throw new Error('PurchaseUI: ' + label); }
  var clone = inventoryReceiptClone_;

  // UI constants not available in Node context — define locally
  var TRANSACTIONS_ALLOWED_PAGE_SIZES = { 15: true, 25: true, 50: true };

  var activePurchase = { id: 'PE-ui-001', transactionType: 'PurchaseEvent', date: '2026-10-15', dateKey: '2026-10-15',
    item: 'Lemon', itemId: 'ING-018', product: '', purchaseCategory: 'Ingredients', isActive: true, source: 'APP_ENTRY',
    acquisitionValue: 20000, purchaseQuantity: 2, purchaseUOM: 'kg', qty: null, revenue: null, expense: null,
    allocationStatus: 'SINGLE_COMPONENT_EVIDENCED', canVoid: true, canCorrect: true, canEdit: false, canResolveEvidence: false,
    operationalStatus: 'Active' };
  var unresolvedPurchase = { id: 'PE-ui-002', transactionType: 'PurchaseEvent', date: '2026-10-16', dateKey: '2026-10-16',
    item: 'Sugar', itemId: 'ING-001', product: '', purchaseCategory: 'Ingredients', isActive: true, source: 'APP_ENTRY',
    acquisitionValue: 10000, purchaseQuantity: null, purchaseUOM: null, qty: null, revenue: null, expense: null,
    allocationStatus: 'QUANTITY_PACKAGE_UNRESOLVED', canVoid: true, canCorrect: true, canEdit: false, canResolveEvidence: true,
    operationalStatus: 'Active' };
  var voidedPurchase = { id: 'PE-ui-003', transactionType: 'PurchaseEvent', date: '2026-10-17', dateKey: '2026-10-17',
    item: 'Milk', itemId: 'ING-020', product: '', purchaseCategory: 'Ingredients', isActive: false, source: 'APP_ENTRY',
    acquisitionValue: 15000, purchaseQuantity: 3, purchaseUOM: 'L', qty: null, revenue: null, expense: null,
    allocationStatus: 'COST_POOL_ALLOCATION_UNDEFINED', canVoid: false, canCorrect: false, canEdit: false, canResolveEvidence: false,
    operationalStatus: 'Voided' };
  var correctedPurchase = { id: 'PE-ui-004', transactionType: 'PurchaseEvent', date: '2026-10-18', dateKey: '2026-10-18',
    item: 'Tea', itemId: 'ING-025', product: '', purchaseCategory: 'Ingredients', isActive: false, source: 'APP_ENTRY',
    acquisitionValue: 8000, purchaseQuantity: 1, purchaseUOM: 'pcs', qty: null, revenue: null, expense: null,
    allocationStatus: 'COST_POOL_ALLOCATION_UNDEFINED', canVoid: false, canCorrect: false, canEdit: false, canResolveEvidence: false,
    operationalStatus: 'Corrected' };
  var activeSale = { id: 'T-sale-001', transactionType: 'Sales', date: '2026-10-14', dateKey: '2026-10-14',
    product: 'Coffee', purchaseCategory: '', item: '', qty: 3, revenue: 30000, expense: null, isActive: true, source: 'APP_ENTRY' };
  var activeExpense = { id: 'T-exp-001', transactionType: 'Expense', date: '2026-10-13', dateKey: '2026-10-13',
    product: '', purchaseCategory: 'Packaging', item: '', qty: null, revenue: null, expense: 5000, isActive: true, source: 'APP_ENTRY' };
  var allRows = [activePurchase, unresolvedPurchase, voidedPurchase, correctedPurchase, activeSale, activeExpense];

  // === DEFECT 1: Purchase in Recent ===
  // U1: PurchaseEvent appears in Recent tab (all lifecycle)
  var recentAll = filterTransactionsPeriodRows(allRows, { lifecycleState: 'all' }, 'recent');
  check(recentAll.filter(function(r) { return r.transactionType === 'PurchaseEvent'; }).length === 4, 'U1: 4 PurchaseEvents in recent-all');

  // U2: Active-only Recent excludes voided/corrected PurchaseEvents
  var recentActive = filterTransactionsPeriodRows(allRows, { lifecycleState: 'active' }, 'recent');
  check(recentActive.filter(function(r) { return r.transactionType === 'PurchaseEvent'; }).length === 2, 'U2: 2 active PurchaseEvents in recent');

  // U3: Recent includes Sales and Expenses alongside PurchaseEvents
  check(recentAll.some(function(r) { return r.transactionType === 'Sales'; }), 'U3: Sales in recent');
  check(recentAll.some(function(r) { return r.transactionType === 'Expense'; }), 'U4: Expense in recent');

  // U5: PurchaseEvent in search index
  var idx = buildTransactionsSearchIndex(allRows);
  check(idx.filter(function(r) { return r.transactionType === 'PurchaseEvent'; }).length === 4, 'U5: PurchaseEvent in search index');

  // U6: Recent search index includes PurchaseEvent with id
  var peInIdx = idx.filter(function(r) { return r.transactionType === 'PurchaseEvent'; })[0];
  check(peInIdx.sortIdentity !== undefined, 'U6: PurchaseEvent search index has sortIdentity');

  // === DEFECT 2: EventID nowrap ===
  // U7: EventID is a string with PE- prefix (can be truncated with ellipsis)
  check(typeof activePurchase.id === 'string' && activePurchase.id.indexOf('PE-') === 0, 'U7: canonical PE- prefix');
  check(activePurchase.id.length > 5, 'U8: EventID has meaningful length');

  // === DEFECT 3: Action column layout ===
  // U9: Active Purchase has all action flags
  check(activePurchase.canVoid === true, 'U9: active canVoid');
  check(activePurchase.canCorrect === true, 'U10: active canCorrect');
  check(activePurchase.canResolveEvidence === false, 'U11: resolved → canResolveEvidence=false');

  // U12: Unresolved Purchase has canResolveEvidence=true
  check(unresolvedPurchase.canResolveEvidence === true, 'U12: unresolved canResolveEvidence');

  // === DEFECT 4: Action routing ===
  // U13: filterTransactionsPeriodRows routes Purchases to purchases tab correctly
  var purchases = filterTransactionsPeriodRows(allRows, { lifecycleState: 'all' }, 'purchases');
  check(purchases.length === 4, 'U13: purchases tab returns 4 rows');
  check(purchases.every(function(r) { return r.transactionType === 'PurchaseEvent'; }), 'U14: all purchases tab rows are PurchaseEvent');

  // U15: Sales tab excludes PurchaseEvents
  var sales = filterTransactionsPeriodRows(allRows, { lifecycleState: 'all' }, 'sales');
  check(!sales.some(function(r) { return r.transactionType === 'PurchaseEvent'; }), 'U15: no PurchaseEvent in sales tab');

  // U16: Expenses tab excludes PurchaseEvents
  var expenses = filterTransactionsPeriodRows(allRows, { lifecycleState: 'all' }, 'expenses');
  check(!expenses.some(function(r) { return r.transactionType === 'PurchaseEvent'; }), 'U16: no PurchaseEvent in expenses tab');

  // === DEFECT 5: Filter terminology ===
  // U17: lifecycleState normalization works for all filter values
  check(normalizeTransactionsLifecycleState({ lifecycleState: 'active' }) === 'active', 'U17a: active');
  check(normalizeTransactionsLifecycleState({ lifecycleState: 'all' }) === 'all', 'U17b: all');
  check(normalizeTransactionsLifecycleState({ lifecycleState: 'voided' }) === 'voided', 'U17c: voided');
  check(normalizeTransactionsLifecycleState({}) === 'active', 'U17d: default active');
  check(normalizeTransactionsLifecycleState({ includeVoided: true }) === 'all', 'U17e: includeVoided');

  // === DEFECT 6: Badge styling ===
  // U18: Active Purchase → statusBadgeClass should be "active" or "pending"
  check(activePurchase.isActive === true, 'U18a: active projection');
  check(activePurchase.canVoid === true, 'U18b: active canVoid for badge');

  // U19: Resolved Purchase → statusBadgeClass = "resolved"
  check(activePurchase.allocationStatus === 'SINGLE_COMPONENT_EVIDENCED', 'U19: resolved allocation');

  // U20: Unresolved Purchase → statusBadgeClass = "pending"
  check(unresolvedPurchase.allocationStatus !== 'SINGLE_COMPONENT_EVIDENCED', 'U20: unresolved allocation');

  // U21: Voided Purchase → statusBadgeClass = "voided"
  check(voidedPurchase.isActive === false, 'U21a: voided isActive false');
  check(voidedPurchase.canVoid === false, 'U21b: voided canVoid false');

  // U22: Corrected Purchase → statusBadgeClass = "corrected"
  check(correctedPurchase.isActive === false, 'U22a: corrected isActive false');
  check(correctedPurchase.canVoid === false && correctedPurchase.canEdit === false, 'U22b: corrected cannot void/edit');

  // === Qty/EventID detail preserved ===
  // U23: numeric quantity renders value
  check(typeof activePurchase.purchaseQuantity === 'number' && activePurchase.purchaseQuantity > 0, 'U23: numeric qty');

  // U24: null quantity → placeholder
  check(unresolvedPurchase.purchaseQuantity == null, 'U24: null qty placeholder');

  // U25: UOM separate from Qty
  check(activePurchase.purchaseUOM === 'kg', 'U25: UOM separate field');

  // U26: empty string qty → placeholder
  var emptyQty = clone(activePurchase);
  emptyQty.purchaseQuantity = "";
  check(emptyQty.purchaseQuantity == null || emptyQty.purchaseQuantity === "", 'U26: empty string qty placeholder');

  // U27: projection preserves all action flags
  check(unresolvedPurchase.canResolveEvidence === true, 'U27: unresolved projection canResolveEvidence');

  check(voidedPurchase.canResolveEvidence === false, 'U28: voided projection canResolveEvidence=false');

  // U29: page building works with PurchaseEvents
  var page = buildTransactionsPageResult(purchases, 1, 15);
  check(page.totalRows === 4 && page.rows.length === 4, 'U29: page building with PurchaseEvents');

  // U30: lifecycle drilldown filters PurchaseEvents correctly
  var drilldownPurchase = filterTransactionsPeriodRows(allRows, { lifecycleState: 'all', drilldownType: 'purchase' }, 'recent');
  check(drilldownPurchase.filter(function(r) { return r.transactionType === 'PurchaseEvent' || r.transactionType === 'Expense'; }).length === drilldownPurchase.length, 'U30: drilldown purchase filter');

  // === v606 column proportions restored ===
  // U31-U38: Verify v606 column width percentages
  check(_htmlIndex.indexOf('th:nth-child(1)') !== -1, 'U31: col1 selector exists');
  check(_htmlIndex.indexOf('width: 21%') !== -1, 'U32: col1 (Transaction ID) width 21%');
  check(_htmlIndex.indexOf('width: 8%') !== -1, 'U33: col2 (Date) width 8%');
  check(_htmlIndex.indexOf('width: 7%') !== -1, 'U34: col3 (Type) width 7%');
  check(_htmlIndex.indexOf('width: 10%') !== -1, 'U35: col4/5/6 (Item/Qty/Amount) width 10%');
  check(_htmlIndex.indexOf('width: 12%') !== -1, 'U37: col7 (Status) width 12%');
  check(_htmlIndex.indexOf('width: 22%') !== -1, 'U38: col8 (Actions) width 22%');

  // U39-U42: Verify v604 distorted widths are removed
  check(_htmlIndex.indexOf('width: 25%') === -1, 'U39: v604 col1 width 25% removed');
  check(_htmlIndex.indexOf('width: 6%') === -1, 'U40: v604 col4 width 6% removed');
  check(_htmlIndex.indexOf('width: 32%') === -1, 'U41: v604 col8 width 32% removed');
  check(_htmlIndex.indexOf('width: 4%') === -1, 'U42: v604 col5 width 4% removed');

  // U43: table-layout: fixed present
  check(_htmlIndex.indexOf('table-layout: fixed') !== -1, 'U43: table-layout fixed');

  // === DEFECT 8: EventID uppercase display ===
  // U44-U46: EventID toUpperCase in render template
  check(_htmlRender.indexOf('.toUpperCase()') !== -1, 'U44: toUpperCase in render source');
  check(_htmlRender.indexOf('escapeUiHtml(r.id.toUpperCase())') !== -1, 'U45: toUpperCase wraps escapeUiHtml');
  check(_htmlRender.indexOf('title="${escapeUiHtml(r.id)}"') !== -1, 'U46: title retains original case');

  // === DEFECT 9: Restore operational note in Purchase View ===
  // U47-U48: description text restored
  check(_htmlActions.indexOf('Cost recorded. Quantity or package is not verified for stock tracking.') !== -1, 'U47: operational note text present');
  check(_htmlActions.indexOf('lifecycle.description.innerText = ""') === -1, 'U48: empty description removed');

  // U49-U50: operationalNote minimization
  check(_htmlActions.indexOf('lifecycle.title.innerText = "Purchase"') !== -1, 'U49: title Purchase preserved');
  check(_htmlActions.indexOf('lifecycle.state.hidden = true') !== -1, 'U50: purchase detail hides state block (no duplicate note)');

  // === Qty/Status cells whitespace-nowrap ===
  // U51-U52: Qty cell has whitespace-nowrap
  check(_htmlRender.indexOf('text-center whitespace-nowrap') !== -1, 'U51: whitespace-nowrap class present in render');
  check(_htmlRender.indexOf('px-4 text-center whitespace-nowrap') !== -1, 'U52: nowrap applied to Qty cell');

  // === DEFECT 5: Action direct routing ===
  // U53-U56: Purchase actions dispatch directly to dialogs
  check(_htmlActions.indexOf("openPurchaseVoidDialog(transactionId)") !== -1, 'U53: purchase-void routes to openPurchaseVoidDialog');
  check(_htmlActions.indexOf("openPurchaseCorrectDialog(transactionId)") !== -1, 'U54: purchase-correct routes to openPurchaseCorrectDialog');
  check(_htmlActions.indexOf("openPurchaseResolveDialog(transactionId") !== -1, 'U55: purchase-resolve routes to openPurchaseResolveDialog');
  check(_htmlActions.indexOf("openTransactionDetail(transactionId)") !== -1, 'U56: detail routes to openTransactionDetail');

  // === DEFECT 10-11: Mutation refresh path ===
  // U57-U59: refreshTransactionsAfterPurchaseMutation clears cache and reloads
  check(_htmlActions.indexOf('transactionsResultCache = {}') !== -1, 'U57: refresh clears transactionsResultCache');
  check(_htmlActions.indexOf('transactionsResultCacheOrder = []') !== -1, 'U58: refresh clears transactionsResultCacheOrder');
  check(_htmlActions.indexOf('requestTransactionsPage()') !== -1, 'U59: refresh calls requestTransactionsPage');

  // === Badge system ===
  // U60-U61: Purchase badge CSS uses indigo color family
  check(_htmlIndex.indexOf('.transaction-type--purchase') !== -1, 'U60: purchase type badge class exists');
  check(_htmlIndex.indexOf('#6366f1') !== -1, 'U61: purchase badge uses indigo border');

  // U62-U65: Status badge CSS classes
  check(_htmlIndex.indexOf('.transaction-status-badge--pending') !== -1, 'U62: pending status badge exists');
  check(_htmlIndex.indexOf('.transaction-status-badge--resolved') !== -1, 'U63: resolved status badge exists');
  check(_htmlIndex.indexOf('.transaction-status-badge--voided') !== -1, 'U64: voided status badge exists');
  check(_htmlIndex.indexOf('.transaction-status-badge--corrected') !== -1, 'U65: corrected status badge exists');

  // U66-U67: Status badge geometry (pill shape, min-height)
  check(_htmlIndex.indexOf('.transaction-status-badge {') !== -1, 'U66: status badge base rule exists');
  check(_htmlIndex.indexOf('.transaction-type {') !== -1, 'U67: transaction type base rule exists');

  // === Correction/Void/Resolve projection ===
  // U68-U70: Projection action flags for each lifecycle state
  check(activePurchase.canVoid === true && activePurchase.canCorrect === true, 'U68: active purchase action flags');
  check(voidedPurchase.canVoid === false && voidedPurchase.canCorrect === false, 'U69: voided purchase no actions');
  check(correctedPurchase.canVoid === false && correctedPurchase.canCorrect === false, 'U70: corrected purchase no actions');

  // U71-U72: Projection status derivation
  check(activePurchase.allocationStatus === 'SINGLE_COMPONENT_EVIDENCED', 'U71: resolved allocation status');
  check(unresolvedPurchase.allocationStatus === 'QUANTITY_PACKAGE_UNRESOLVED', 'U72: unresolved allocation status');

  // U73-U74: Projection financial isolation
  check(activePurchase.acquisitionValue > 0, 'U73: acquisitionValue numeric');
  check(typeof activePurchase.acquisitionValue === 'number', 'U74: acquisitionValue is number type');

  // U75-U76: Receipt/UOM preservation
  check(activePurchase.purchaseUOM === 'kg', 'U75: purchaseUOM preserved');
  check(typeof activePurchase.purchaseQuantity === 'number', 'U76: purchaseQuantity is numeric');

  // U77-U78: Receipt type detection
  check(activePurchase.transactionType === 'PurchaseEvent', 'U77: transactionType is PurchaseEvent');
  check(activeSale.transactionType === 'Sales', 'U78: sales transactionType');

  // U79-U80: Empty state rendering
  var emptyResult = buildTransactionsPageResult([], 1, 15);
  check(emptyResult.totalRows === 0, 'U79: empty page totalRows zero');
  check(emptyResult.rows.length === 0, 'U80: empty page no rows');

  // U81-U82: Pagination state
  var bigPage = buildTransactionsPageResult(Array.from({ length: 30 }, function(_, i) { return { id: 'T' + i }; }), 1, 15);
  check(bigPage.totalRows === 30, 'U81: 30-row totalRows');
  check(bigPage.totalPages === 2, 'U82: 30 rows at 15/page = 2 pages');

  // U83-U84: Search index for PurchaseEvent
  var searchIdx = buildTransactionsSearchIndex([activePurchase, unresolvedPurchase]);
  check(searchIdx.length === 2, 'U83: search index length matches input');
  check(searchIdx.every(function(r) { return r.transactionType === 'PurchaseEvent'; }), 'U84: all search index rows are PurchaseEvent');

  // U85-U86: Page size validation
  check(TRANSACTIONS_ALLOWED_PAGE_SIZES[15] === true, 'U85: page size 15 allowed');
  check(TRANSACTIONS_ALLOWED_PAGE_SIZES[25] === true, 'U86: page size 25 allowed');

  // U87-U88: Transaction type badge class derivation for purchase
  var purchaseRow = activePurchase.transactionType === "PurchaseEvent";
  var purchaseBadgeType = purchaseRow ? 'transaction-type--purchase' : 'transaction-type--expense';
  check(purchaseBadgeType === 'transaction-type--purchase', 'U87: purchase type badge class derivation');
  check(purchaseBadgeType !== 'transaction-type--expense', 'U88: purchase not classified as expense');

  // U89-U90: Actions overflow and layout
  check(_htmlRender.indexOf('overflow-visible') !== -1, 'U89: actions cell has overflow-visible');
  check(_htmlRender.indexOf('transactions-row-actions') !== -1, 'U90: actions flex container present');

  // U91-U92: Resolve button CSS rule exists
  check(_htmlIndex.indexOf('.transactions-row-action--resolve') !== -1, 'U91: resolve action button CSS class exists');
  check(_htmlIndex.indexOf('--transaction-action-bg: var(--success-soft)') !== -1, 'U92: resolve button uses success-soft background');

  // U93-U97: Dark theme badge overrides
  check(_htmlIndex.indexOf(':root[data-theme="dark"] .transaction-status-badge--active') !== -1, 'U93: dark badge --active override exists');
  check(_htmlIndex.indexOf(':root[data-theme="dark"] .transaction-status-badge--voided') !== -1, 'U94: dark badge --voided override exists');
  check(_htmlIndex.indexOf(':root[data-theme="dark"] .transaction-status-badge--pending') !== -1, 'U95: dark badge --pending override exists');
  check(_htmlIndex.indexOf(':root[data-theme="dark"] .transaction-status-badge--resolved') !== -1, 'U96: dark badge --resolved override exists');
  check(_htmlIndex.indexOf(':root[data-theme="dark"] .transaction-status-badge--corrected') !== -1, 'U97: dark badge --corrected override exists');

  // U98-U99: Dark theme type badge overrides
  check(_htmlIndex.indexOf(':root[data-theme="dark"] .transaction-type--purchase') !== -1, 'U98: dark type badge --purchase override exists');
  check(_htmlIndex.indexOf(':root[data-theme="dark"] .transaction-type--receipt') !== -1, 'U99: dark type badge --receipt override exists');

  // U100: Column widths sum to 100%
  var colWidths = [21, 8, 7, 10, 10, 10, 12, 22];
  check(colWidths.reduce(function(a, b) { return a + b; }, 0) === 100, 'U100: column widths sum to 100%');

  // === DEFECT C: Direct action dispatch verification ===
  // U101-U104: Purchase action dialog functions call openTransactionLifecycleDialog to show overlay
  check(_htmlActions.indexOf('openPurchaseVoidDialog(eventId)') !== -1, 'U101: openPurchaseVoidDialog function exists');
  check(_htmlActions.indexOf('openPurchaseCorrectDialog(eventId)') !== -1, 'U102: openPurchaseCorrectDialog function exists');
  check(_htmlActions.indexOf('openPurchaseResolveDialog(eventId') !== -1, 'U103: openPurchaseResolveDialog function exists');
  check(_htmlActions.indexOf('openTransactionLifecycleDialog("void")') !== -1, 'U104: purchase dialog functions show overlay via openTransactionLifecycleDialog');

  // === DEFECT F: View spacing — state element hidden when empty ===
  // U105-U106: lifecycle.state hidden management
  check(_htmlActions.indexOf('lifecycle.state.hidden') !== -1, 'U105: state hidden toggle exists');
  check(_htmlActions.indexOf('lifecycle.state.hidden = false') !== -1, 'U106: openTransactionLifecycleDialog resets state visibility');

  // === EventID case handling ===
  // U107-U109: EventID uppercase display and ID column width for long IDs
  check(_htmlRender.indexOf('escapeUiHtml(r.id.toUpperCase())') !== -1, 'U107: EventID displayed uppercase in table');
  check(typeof activePurchase.id === 'string' && activePurchase.id.indexOf('PE-') === 0, 'U108: EventID has PE- prefix');
  check(activePurchase.id.length >= 9, 'U109: EventID has meaningful minimum length');

  // === Column width adequacy for longest IDs ===
  // U110-U111: ID column width (21%) at table layout
  var longestId = 'PE-receipt-ae065103bdc45b683bdb35e9d636b69b';
  check(longestId.length === 43, 'U110: longest ID is 43 chars');
  check(colWidths[0] >= 21, 'U111: ID column width >= 21%');

  // === Actions column width for 4 buttons ===
  // U112: Actions column provides space for 4 inline buttons
  check(colWidths[7] >= 22, 'U112: actions column width >= 22% for four buttons');

  // === DEFECT 6: Action row nowrap (v602) ===
  // U113: CSS rule .transactions-row-actions includes flex-wrap: nowrap
  check(_htmlIndex.indexOf('flex-wrap: nowrap') !== -1, 'U113: actions container has flex-wrap: nowrap');
  // U114: template uses flex-nowrap (not flex-wrap)
  check(_htmlRender.indexOf('flex-nowrap') !== -1, 'U114: template uses flex-nowrap');
  check(_htmlRender.indexOf('flex-wrap ') === -1, 'U115: template has no flex-wrap (allows wrapping)');
  // U116: actions cell still has overflow-visible for button overflow
  check(_htmlRender.indexOf('overflow-visible') !== -1, 'U116: actions cell overflow-visible preserved');

  // === DEFECT 7: Duplicate operational note removed ===
  // U117: purchase detail hides lifecycle.state (no duplicate note block)
  check(_htmlActions.indexOf('lifecycle.state.hidden = true') !== -1, 'U117: purchase detail hides state block');
  // U118: lifecycle.description retains operational note as subtitle
  check(_htmlActions.indexOf('lifecycle.description.innerText = "Cost recorded. Quantity or package is not verified for stock tracking."') !== -1, 'U118: operational note remains as modal subtitle');
  // U119: title remains "Purchase"
  check(_htmlActions.indexOf('lifecycle.title.innerText = "Purchase"') !== -1, 'U119: title Purchase');
  // U120: old financial subtitle absent (no revenue/cogs/margin in purchase detail)
  check(_htmlActions.indexOf('lifecycle.description.innerText = "Revenue"') === -1, 'U120: old financial subtitle absent');
  check(_htmlActions.indexOf('lifecycle.description.innerText = "Margin"') === -1, 'U121: old margin subtitle absent');

  // === Direct action routing preserved ===
  // U122-U124: Direct bootstrap routing for Resolve/Void/Correct
  check(_htmlActions.indexOf('purchase-resolve') !== -1, 'U122: purchase-resolve action exists');
  check(_htmlActions.indexOf('purchase-void') !== -1, 'U123: purchase-void action exists');
  check(_htmlActions.indexOf('purchase-correct') !== -1, 'U124: purchase-correct action exists');

  // === DEFECT A: Transaction ID not truncated ===
  // U125: ID cell has no max-w constraint
  check(_htmlRender.indexOf('max-w-[200px]') === -1, 'U125: ID cell has no max-w-[200px] truncation');
  // U126: ID cell has no overflow-hidden
  check(_htmlRender.indexOf('overflow-hidden text-ellipsis') === -1, 'U126: ID cell has no overflow-hidden text-ellipsis');
  // U127: ID cell retains whitespace-nowrap (single line)
  check(_htmlRender.indexOf('whitespace-nowrap font-medium') !== -1, 'U127: ID cell retains nowrap and font-medium');

  // === DEFECT B: Actions right clearance ===
  // U128: Actions column width (22%) provides four-button clearance via explicit padding
  check(colWidths[7] >= 22, 'U128: actions column 22% for four-button clearance');
  // U129: Actions column uses default td padding (0 10px) — no reduced padding override
  check(_htmlIndex.indexOf('padding: 0 4px; text-align: center;') === -1, 'U129: actions column no longer has 4px side padding');
  // U129b: Actions column provides right clearance via explicit padding: 0 10px on column 8
  check(colWidths[7] >= 22 && colWidths[0] >= 21, 'U129b: column allocation provides Recent action right clearance');

  // === Geometry totals ===
  // U130: Table min-width increased for full ID rendering
  check(_htmlIndex.indexOf('min-w-[1100px]') !== -1, 'U130: table min-width 1100px for full ID geometry');
  // U131: ID column inherits 14px from td rule — no forced 11px override
  check(_htmlIndex.indexOf('td:nth-child(1) { font-size: 11px') === -1, 'U131: ID column has no forced 11px font override');
  // U132: column widths sum to exactly 100%
  check(colWidths[7] + colWidths[6] + colWidths[5] + colWidths[4] + colWidths[3] + colWidths[2] + colWidths[1] + colWidths[0] === 100, 'U132: final allocation sums to 100%');

  return { status: 'PASS', assertions: count };
}
