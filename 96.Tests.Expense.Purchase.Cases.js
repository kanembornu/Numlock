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
  check(f.run().status === 'NOT_STARTED' && f.events.length === 0, 'prospective date boundary');
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
      setNumberFormat: function(format) { check(format === '@', 'text storage'); },
      setValues: function(values) {
        check(base.runtime.lock.hasLock() && column === 1 && height === 1 && width === 25 && row === f.rows.length + 2, 'locked exact append');
        f.writes++;
        if (f.failure === 'BEFORE') throw new Error('TEST_TRANSPORT');
        f.rows.push(Object.fromEntries(headers.map(function(h, i) { return [h, values[0][i]]; })));
        if (f.failure === 'AFTER') throw new Error('TEST_LOST_RESPONSE');
      }
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
