// Append-only purchase foundation. Production execution remains independently guarded.
var PURCHASE_EVENT_POLICY = Object.freeze({ version: 'PURCHASE-EVENTS-V1', enabled: true, sheet: 'PurchaseEvents',
  headers: Object.freeze(['EventID', 'ExpenseID', 'BusinessLabel', 'PolicyVersion', 'PolicyRevision', 'CostType',
    'PurchaseRelationship', 'ExpenseDate', 'ReceiptDate', 'PurchaseQty', 'PurchaseUOM', 'AcquisitionValue',
    'SupplierSource', 'ExternalRef', 'ExternalDocumentStatus', 'Attestation', 'AllocationStatus', 'RequestKey',
    'NormalizedPayload', 'ReceiptPlan', 'Lifecycle', 'RecoveryKey', 'CreatedAt', 'CreatedBy', 'IsActive']) });

// Construction is lazy: disabled dispatch never reads or writes the purchase store.
function purchaseEventProductionRuntime_(ss, lock, expenses, timestamp, policies) {
  if (policies === undefined) policies = { expenseEnabled: EXPENSE_PURCHASE_POLICY.enabled, purchaseEnabled: PURCHASE_EVENT_POLICY.enabled };
  return { environment: 'PRODUCTION', enabled: !!policies && policies.expenseEnabled === true && policies.purchaseEnabled === true,
    lock: lock, receipt: inventoryReceiptProductionRuntime_(ss, lock),
    read: function() {
      requireInventoryReceiptLock_({ lock: lock }, { lock: lock, active: true });
      requireCanonicalHeaders(ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet), PURCHASE_EVENT_POLICY.headers);
      var events = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers).map(function(row) {
        delete row.sourceRowIndex; return row;
      });
      return { events: events, expenses: expenses,
        items: readCanonicalTable(ss, 'InventoryItems', BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS),
        conversions: readCanonicalTable(ss, 'InventoryUOMConversions', BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS) };
    },
    audit: function() { return { actor: CANONICAL_ENTRY.USER, at: timestamp.toISOString() }; },
    appendEvent: function(row) {
      requireInventoryReceiptLock_({ lock: lock }, { lock: lock, active: true });
      var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
      requireCanonicalHeaders(sheet, PURCHASE_EVENT_POLICY.headers);
      var target = sheet.getRange(sheet.getLastRow() + 1, 1, 1, PURCHASE_EVENT_POLICY.headers.length);
      target.setNumberFormat('@');
      target.setValues([PURCHASE_EVENT_POLICY.headers.map(function(header) { return row[header]; })]);
    }
  };
}

function normalizePurchaseEventRequest_(payload) {
  if (!payload || payload.transactionType !== 'EXPENSE' || typeof payload.requestKey !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,100}$/.test(payload.requestKey || '') ||
      typeof payload.expenseItemId !== 'string' || !payload.input || typeof payload.input !== 'object') inventoryReceiptFail_('INVALID_PURCHASE_REQUEST');
  Object.keys(payload).forEach(function(key) {
    if (['transactionType', 'requestKey', 'expenseItemId', 'input'].indexOf(key) === -1) inventoryReceiptFail_('UNKNOWN_PURCHASE_FIELD');
  });
  var fields = ['ExpenseDate', 'ReceiptDate', 'PurchaseQty', 'PurchaseUOM', 'AcquisitionValue', 'SupplierSource',
    'ExternalRef', 'ExternalDocumentStatus', 'PackageIdentity', 'SupplierRef'];
  var input = payload.input, p = {};
  Object.keys(input).forEach(function(key) {
    if (fields.indexOf(key) === -1 && ['Attested', 'ConversionEvidenceConfirmed'].indexOf(key) === -1) inventoryReceiptFail_('UNKNOWN_PURCHASE_INPUT');
  });
  fields.forEach(function(key) { p[key] = inventoryReceiptText_(input[key]); });
  p.PurchaseUOM = p.PurchaseUOM.toLowerCase();
  p.ReceiptDate = p.ReceiptDate || p.ExpenseDate;
  ['ExpenseDate', 'ReceiptDate'].forEach(function(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p[key]) || !capitalEquityDateKey(p[key]) || p[key] < EXPENSE_PURCHASE_POLICY.effectiveFrom) inventoryReceiptFail_('INVALID_PURCHASE_DATE');
  });
  if (p.PurchaseQty) {
    var qty = inventoryReceiptDecimal_(p.PurchaseQty, 6);
    if (qty.n <= 0 || !p.PurchaseUOM) inventoryReceiptFail_('INVALID_PURCHASE_QUANTITY');
    p.PurchaseQty = inventoryReceiptDecimalText_(qty);
  } else if (p.PurchaseUOM) inventoryReceiptFail_('INVALID_PURCHASE_QUANTITY');
  var cost = inventoryReceiptDecimal_(p.AcquisitionValue, 0);
  if (cost.n <= 0) inventoryReceiptFail_('INVALID_PURCHASE_COST');
  p.AcquisitionValue = inventoryReceiptDecimalText_(cost);
  if (!p.SupplierSource || input.Attested !== true ||
      p.ExternalRef && p.ExternalDocumentStatus !== 'AVAILABLE' ||
      !p.ExternalRef && p.ExternalDocumentStatus !== 'EXTERNAL_DOCUMENT_UNAVAILABLE') inventoryReceiptFail_('PURCHASE_EVIDENCE_REQUIRED');
  if (input.ConversionEvidenceConfirmed !== undefined && typeof input.ConversionEvidenceConfirmed !== 'boolean') inventoryReceiptFail_('INVALID_BOOLEAN');
  p.Attested = true; p.ConversionEvidenceConfirmed = input.ConversionEvidenceConfirmed === true;
  return { transactionType: 'EXPENSE', requestKey: payload.requestKey, expenseItemId: payload.expenseItemId, input: p };
}

function buildPurchaseEvent_(request, expenses, authority, audit) {
  var route = resolveExpensePurchasePolicy_(request.expenseItemId, expenses), p = request.input;
  if (!expensePolicyIsPurchase_(route)) inventoryReceiptFail_('NOT_PURCHASE_POLICY');
  var plan = null, allocation = route.PurchaseRelationship.indexOf('HPP_COST_POOL') === 0 ?
    'COST_POOL_ALLOCATION_UNDEFINED' : 'QUANTITY_PACKAGE_UNRESOLVED';
  // Generic syrup authority cannot establish flavor package equivalence or pooled unit cost.
  if (route.PurchaseRelationship === 'DIRECT_HPP_COMPONENT' && p.PurchaseQty &&
      p.ConversionEvidenceConfirmed && p.ExternalRef) {
    var input = { ItemID: route.inventoryItemIds[0], ReceiptDate: p.ReceiptDate, PurchaseQty: p.PurchaseQty,
      PurchaseUOM: p.PurchaseUOM, AcquisitionValue: p.AcquisitionValue, SupplierSource: p.SupplierSource,
      ExternalRef: p.ExternalRef, ExternalDocumentStatus: p.ExternalDocumentStatus, Attested: true,
      PackageIdentity: p.PackageIdentity, SupplierRef: p.SupplierRef };
    try {
      var derived = deriveInventoryReceipt_(input, authority);
      var snapshot = derived.row.ConversionSnapshot && JSON.parse(derived.row.ConversionSnapshot);
      var matching = snapshot && (snapshot.normalization === 'DIRECT_METRIC' ||
        input.ItemID === 'ING-018' && ['gr', 'kg'].indexOf(p.PurchaseUOM) !== -1 ||
        p.PackageIdentity && p.SupplierRef && p.PackageIdentity === snapshot.authority.PackageIdentity && p.SupplierRef === snapshot.authority.SupplierRef);
      if (derived.row.Status === 'READY' && matching) {
        plan = { input: input, conversionSnapshot: derived.row.ConversionSnapshot };
        allocation = 'SINGLE_COMPONENT_EVIDENCED';
      }
    } catch (error) {
      // Cost evidence remains useful when received quantity cannot be normalized truthfully.
      allocation = 'QUANTITY_PACKAGE_UNRESOLVED';
    }
  }
  if (!audit || !inventoryReceiptText_(audit.actor) || inventoryTimestampMillis(audit.at) === null) inventoryReceiptFail_('PURCHASE_AUDIT_REQUIRED');
  var item = expenses.filter(function(row) { return row.ID_Ops === request.expenseItemId; })[0];
  return { EventID: 'PE-' + request.requestKey, ExpenseID: request.expenseItemId, BusinessLabel: String(item.Item),
    PolicyVersion: EXPENSE_PURCHASE_POLICY.version, PolicyRevision: EXPENSE_PURCHASE_POLICY.revision,
    CostType: route.CostType, PurchaseRelationship: route.PurchaseRelationship, ExpenseDate: p.ExpenseDate,
    ReceiptDate: p.ReceiptDate, PurchaseQty: p.PurchaseQty, PurchaseUOM: p.PurchaseUOM, AcquisitionValue: p.AcquisitionValue,
    SupplierSource: p.SupplierSource, ExternalRef: p.ExternalRef, ExternalDocumentStatus: p.ExternalDocumentStatus,
    Attestation: JSON.stringify({ attested: true, conversionEvidenceConfirmed: p.ConversionEvidenceConfirmed }),
    AllocationStatus: allocation, RequestKey: request.requestKey, NormalizedPayload: JSON.stringify(request),
    ReceiptPlan: JSON.stringify(plan), Lifecycle: 'CAPTURED_OPERATIONAL', RecoveryKey: 'pe-receipt-' + request.requestKey,
    CreatedAt: audit.at, CreatedBy: audit.actor, IsActive: true };
}

function purchaseEventHistory_(rows) {
  var keys = Object.create(null), ids = Object.create(null);
  rows.forEach(function(row) {
    if (PURCHASE_EVENT_POLICY.headers.some(function(key) { return !Object.prototype.hasOwnProperty.call(row, key); }) ||
        !row.RequestKey || keys[row.RequestKey] || ids[row.EventID] || row.EventID !== 'PE-' + row.RequestKey ||
        row.RecoveryKey !== 'pe-receipt-' + row.RequestKey || row.Lifecycle !== 'CAPTURED_OPERATIONAL' || row.IsActive !== true) inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
    var request = normalizePurchaseEventRequest_(JSON.parse(row.NormalizedPayload));
    if (JSON.stringify(request) !== row.NormalizedPayload || request.requestKey !== row.RequestKey || request.expenseItemId !== row.ExpenseID ||
        ['ExpenseDate','ReceiptDate','PurchaseQty','PurchaseUOM','AcquisitionValue','SupplierSource','ExternalRef','ExternalDocumentStatus'].some(function(k) { return request.input[k] !== row[k]; })) inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
    var route = EXPENSE_PURCHASE_POLICY.rows.filter(function(r) { return r.expenseItemId === row.ExpenseID; })[0];
    if (!route || !expensePolicyIsPurchase_(route) || row.PolicyVersion !== EXPENSE_PURCHASE_POLICY.version ||
        row.PolicyRevision !== EXPENSE_PURCHASE_POLICY.revision || row.CostType !== route.CostType ||
        row.PurchaseRelationship !== route.PurchaseRelationship || !inventoryReceiptText_(row.BusinessLabel) ||
        !inventoryReceiptText_(row.CreatedBy) || inventoryTimestampMillis(row.CreatedAt) === null ||
        row.Attestation !== JSON.stringify({ attested: true, conversionEvidenceConfirmed: request.input.ConversionEvidenceConfirmed })) inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
    var plan = JSON.parse(row.ReceiptPlan), p = request.input;
    if (plan) {
      if (route.PurchaseRelationship !== 'DIRECT_HPP_COMPONENT' || !p.ConversionEvidenceConfirmed || !p.ExternalRef ||
          !plan.input || plan.input.ItemID !== route.inventoryItemIds[0] || row.AllocationStatus !== 'SINGLE_COMPONENT_EVIDENCED' ||
          ['ReceiptDate','PurchaseQty','PurchaseUOM','AcquisitionValue','SupplierSource','ExternalRef','ExternalDocumentStatus','PackageIdentity','SupplierRef','Attested'].some(function(k) {
            return plan.input[k] !== p[k];
          }) || !plan.conversionSnapshot) inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
    } else if (row.AllocationStatus !== (route.PurchaseRelationship.indexOf('HPP_COST_POOL') === 0 ?
        'COST_POOL_ALLOCATION_UNDEFINED' : 'QUANTITY_PACKAGE_UNRESOLVED')) inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
    keys[row.RequestKey] = row; ids[row.EventID] = true;
  });
  return keys;
}

function purchaseEventResult_(status, reason, row, key, writes, receipt) {
  return { success: status === 'PURCHASE_CAPTURED' || status === 'OPERATIONAL_POSTED', status: status, reason: reason || null,
    eventId: row ? row.EventID : null, requestKey: key, writeCount: writes, reconciliationRequired: status === 'WRITE_UNCERTAIN',
    tabopsWrites: 0, financialTotalsIncluded: false, accountingPostingAllowed: false, BalanceLedgerWrites: 0,
    Account1100Mutation: false, cashAPInference: false, recipeConsumptionAllowed: false, openingRequired: false,
    productionMutation: false, receipt: receipt || null, data: row ? projectPurchaseEventTransaction_(row) : null };
}

// Policy injection is private and test-only; the public dispatcher supplies no override.
function orchestratePurchaseEventUnderLock_(payload, runtime, scope, policies) {
  var row = null, writes = 0, key = payload && payload.requestKey;
  try {
    requireInventoryReceiptLock_(runtime, scope);
    if (policies === undefined) policies = { expenseEnabled: EXPENSE_PURCHASE_POLICY.enabled, purchaseEnabled: PURCHASE_EVENT_POLICY.enabled };
    if (['LOCAL_FIXTURE', 'PRODUCTION'].indexOf(runtime.environment) === -1 || runtime.enabled !== true ||
        runtime.environment === 'PRODUCTION' && (!policies || policies.expenseEnabled !== true || policies.purchaseEnabled !== true)) {
      inventoryReceiptFail_('PRODUCTION_PURCHASE_DISABLED');
    }
    if (['read', 'appendEvent', 'audit'].some(function(name) { return typeof runtime[name] !== 'function'; }) ||
        !runtime.receipt || runtime.receipt.lock !== runtime.lock || typeof runtime.receipt.read !== 'function' ||
        ['LOCAL_FIXTURE', 'PRODUCTION'].indexOf(runtime.receipt.environment) === -1) inventoryReceiptFail_('INVALID_PURCHASE_RUNTIME');
    var request = normalizePurchaseEventRequest_(payload), state = runtime.read();
    var history = purchaseEventHistory_(state.events);
    row = history[key] || null;
    if (row && row.NormalizedPayload !== JSON.stringify(request)) inventoryReceiptFail_('CONFLICT');
    if (!row) {
      row = buildPurchaseEvent_(request, state.expenses, state, runtime.audit());
      // Mark uncertainty before calling the append: exceptions cannot establish a zero write.
      writes = 'UNKNOWN';
      runtime.appendEvent(inventoryReceiptClone_(row));
      var stored = purchaseEventHistory_(runtime.read().events)[key];
      if (!stored || JSON.stringify(stored) !== JSON.stringify(row)) inventoryReceiptFail_('PURCHASE_READBACK_UNCERTAIN');
      row = stored; writes = 1;
    }
    var plan = JSON.parse(row.ReceiptPlan);
    if (!plan) return purchaseEventResult_('PURCHASE_CAPTURED', null, row, key, writes);
    // Reuse the receipt's own durable identity and movement recovery under the same lock.
    var current = runtime.receipt.read();
    if (runtime.receipt.environment !== 'LOCAL_FIXTURE' || !current.activation || current.activation.enabled !== true) {
      return purchaseEventResult_('PURCHASE_PENDING', 'PRODUCTION_OPERATIONAL_POSTING_DISABLED', row, key, writes);
    }
    var prior = inventoryReceiptHistory_(current.receipts).keys[row.RecoveryKey];
    if (!prior && deriveInventoryReceipt_(plan.input, current).row.ConversionSnapshot !== plan.conversionSnapshot) {
      return purchaseEventResult_('PURCHASE_PENDING', 'CONVERSION_AUTHORITY_CHANGED', row, key, writes);
    }
    var result = orchestrateInventoryReceiptUnderLock_({ transactionType: 'INVENTORY_RECEIPT', requestKey: row.RecoveryKey, input: plan.input }, runtime.receipt, scope);
    writes = result.writeCount === 'UNKNOWN' ? 'UNKNOWN' : writes + result.writeCount;
    return purchaseEventResult_(result.status === 'OPERATIONAL_POSTED' ? result.status :
      result.status === 'WRITE_UNCERTAIN' ? 'WRITE_UNCERTAIN' : 'PURCHASE_PENDING', result.reason, row, key, writes, result);
  } catch (error) {
    return purchaseEventResult_(writes === 'UNKNOWN' ? 'WRITE_UNCERTAIN' : /CONFLICT/.test(error.message) ? 'CONFLICT' :
      row ? 'PURCHASE_PENDING' : 'NOT_STARTED', error.message, row, key, writes);
  }
}

function orchestratePurchaseEvent_(payload, runtime, policies) {
  var scope;
  try {
    runtime.lock.waitLock(30000); scope = { active: true, lock: runtime.lock };
    return orchestratePurchaseEventUnderLock_(payload, runtime, scope, policies);
  } finally { if (scope) { scope.active = false; runtime.lock.releaseLock(); } }
}

function projectPurchaseEventTransaction_(row) {
  return { id: row.EventID, transactionType: 'PurchaseEvent', canonicalTransactionType: 'PurchaseEvent',
    date: row.ExpenseDate, dateKey: row.ExpenseDate, item: row.BusinessLabel, expenseId: row.ExpenseID,
    purchaseQuantity: row.PurchaseQty, purchaseUOM: row.PurchaseUOM, acquisitionValue: Number(row.AcquisitionValue),
    supplier: row.SupplierSource, reference: row.ExternalRef || 'Document unavailable', isActive: true,
    receiptDate: row.ReceiptDate, operationalStatus: 'Cost recorded',
    operationalNote: row.ReceiptPlan === 'null' ?
      'Cost recorded. Quantity or package is not verified for stock tracking.' :
      'Purchase recorded. Stock tracking requires separate verification.',
    financialTotalsIncluded: false, accountingStatus: 'NOT_POSTED', canEdit: false, canVoid: false };
}

function readPurchaseEventTransactionRows_(ss) {
  if (!ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet)) return [];
  var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
  purchaseEventHistory_(rows);
  return rows.map(projectPurchaseEventTransaction_);
}
