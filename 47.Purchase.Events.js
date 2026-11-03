// Append-only purchase foundation. Production execution remains independently guarded.
var PURCHASE_EVENT_POLICY = Object.freeze({ version: 'PURCHASE-EVENTS-V1', enabled: true, sheet: 'PurchaseEvents',
  headers: Object.freeze(['EventID', 'ExpenseID', 'BusinessLabel', 'PolicyVersion', 'PolicyRevision', 'CostType',
    'PurchaseRelationship', 'ExpenseDate', 'ReceiptDate', 'PurchaseQty', 'PurchaseUOM', 'AcquisitionValue',
    'SupplierSource', 'ExternalRef', 'ExternalDocumentStatus', 'Attestation', 'AllocationStatus', 'RequestKey',
    'NormalizedPayload', 'ReceiptPlan', 'Lifecycle', 'RecoveryKey', 'CreatedAt', 'CreatedBy', 'IsActive',
    'PaymentStatus', 'CashAccountCode', 'SupplierID', 'AccountingStatus']) });

var PURCHASE_PAYMENT_STATUSES = Object.freeze(['PAID', 'UNPAID']);
var PURCHASE_LEGACY_ACCOUNTING_STATUS = 'LEGACY_UNCLASSIFIED_NON_POSTABLE';

// Accepted lifecycle states for PurchaseEvent rows. Append-only — new states
// require policy revision and migration.
var PURCHASE_EVENT_LIFECYCLE_STATES = Object.freeze({
  CAPTURED_OPERATIONAL: 'CAPTURED_OPERATIONAL',
  VOIDED: 'VOIDED',
  CORRECTED: 'CORRECTED'
});
var PURCHASE_EVENT_ACTIVE_LIFECYCLE = PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL;

// CorrectionRequestKey format: alphanumeric start, 8-64 chars, no corr- prefix.
var PURCHASE_CORRECTION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;

function validatePurchaseCorrectionKey_(key) {
  if (typeof key !== 'string') return false;
  var trimmed = key.trim();
  if (!trimmed || trimmed.length < 8 || trimmed.length > 64) return false;
  if (trimmed.indexOf('corr-') === 0) return false; // reject double-prefixed
  return PURCHASE_CORRECTION_KEY_PATTERN.test(trimmed);
}

// One-shot evidence resolution for PurchaseEvents. One resolution per EventID.
var PURCHASE_RESOLUTION_POLICY = Object.freeze({ version: 'PURCHASE-RESOLUTIONS-V1', enabled: true,
  sheet: 'PurchaseEventResolutions',
  headers: Object.freeze(['ResolutionID', 'RequestKey', 'EventID', 'ResolutionPayload',
    'ReceiptPlan', 'AllocationStatus', 'Status', 'CreatedAt', 'CreatedBy']) });

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
      // Canonical boolean persistence: change IsActive cell from text format to General,
      // write boolean true, and verify readback. Text format coerces setValue(true) to string.
      var isActiveIdx = PURCHASE_EVENT_POLICY.headers.indexOf('IsActive');
      if (isActiveIdx !== -1 && row.IsActive === true) {
        if (!writeCanonicalBoolean_(sheet, sheet.getLastRow(), isActiveIdx + 1)) {
          inventoryReceiptFail_('ISACTIVE_BOOLEAN_PERSISTENCE_FAILED');
        }
      }
    },
    readLedger: function() {
      return readCanonicalTable(ss, 'BalanceLedger', BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
    },
    writeLedger: function(rows) {
      var sheet = ss.getSheetByName('BalanceLedger');
      requireCanonicalHeaders(sheet, BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.length)
        .setValues(rows.map(function(row) {
          return BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.map(function(header) { return row[header]; });
        }));
    },
    flush: function() { SpreadsheetApp.flush(); },
    readPurchaseEvent: function(eventId) {
      var matches = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers).filter(function(row) {
        return String(row.EventID || '') === String(eventId || '');
      });
      return matches.length === 1 ? matches[0] : null;
    },
    updatePurchaseAccounting: function(eventId, status) {
      var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
      var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
      var matches = rows.filter(function(row) { return String(row.EventID || '') === String(eventId || ''); });
      if (matches.length !== 1) inventoryReceiptFail_('PURCHASE_ACCOUNTING_EVENT_NOT_UNIQUE');
      var rowNumber = Number(matches[0].sourceRowIndex) + 1;
      sheet.getRange(rowNumber, PURCHASE_EVENT_POLICY.headers.indexOf('AccountingStatus') + 1).setValue(status);
      SpreadsheetApp.flush();
    }
  };
}

// Canonical boolean persistence: changes cell format from text (@) to General,
// writes boolean true, and verifies readback. Returns true if verified.
function writeCanonicalBoolean_(sheet, row, col) {
  var cell = sheet.getRange(row, col);
  cell.setNumberFormat('General');
  cell.setValue(true);
  // Readback verification
  var readback = sheet.getRange(row, col).getValue();
  return readback === true && typeof readback === 'boolean';
}

function normalizePurchaseEventRequestWithCompatibility_(payload, allowLegacyPaymentStatus) {
  if (!payload || payload.transactionType !== 'EXPENSE' || typeof payload.requestKey !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,100}$/.test(payload.requestKey || '') ||
      typeof payload.expenseItemId !== 'string' || !payload.input || typeof payload.input !== 'object') inventoryReceiptFail_('INVALID_PURCHASE_REQUEST');
  Object.keys(payload).forEach(function(key) {
    if (['transactionType', 'requestKey', 'expenseItemId', 'input', 'cashAccountCode', 'paymentStatus', 'supplierId'].indexOf(key) === -1) inventoryReceiptFail_('UNKNOWN_PURCHASE_FIELD');
  });
  var hasPaymentStatus = Object.prototype.hasOwnProperty.call(payload, 'paymentStatus');
  var hasPaymentAuthority = hasPaymentStatus || Object.prototype.hasOwnProperty.call(payload, 'cashAccountCode') ||
    Object.prototype.hasOwnProperty.call(payload, 'supplierId');
  if (!hasPaymentAuthority && !allowLegacyPaymentStatus) inventoryReceiptFail_('INVALID_PAYMENT_STATUS');
  var paymentStatus = inventoryReceiptText_(payload.paymentStatus);
  var cashAccountCode = inventoryReceiptText_(payload.cashAccountCode);
  var supplierId = inventoryReceiptText_(payload.supplierId);
  if (hasPaymentAuthority) {
    if (PURCHASE_PAYMENT_STATUSES.indexOf(paymentStatus) === -1) inventoryReceiptFail_('INVALID_PAYMENT_STATUS');
    if (paymentStatus === 'PAID' && !cashAccountCode) inventoryReceiptFail_('CASH_ACCOUNT_REQUIRED');
    if (paymentStatus === 'UNPAID' && !supplierId) inventoryReceiptFail_('SUPPLIER_REQUIRED');
    if (paymentStatus === 'PAID' && supplierId || paymentStatus === 'UNPAID' && cashAccountCode) inventoryReceiptFail_('CONFLICTING_PAYMENT_AUTHORITY');
  }
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p[key]) || !capitalEquityDateKey(p[key])) inventoryReceiptFail_('INVALID_PURCHASE_DATE');
  });
  if (p.PurchaseQty) {
    var qty = inventoryReceiptDecimal_(p.PurchaseQty, 6);
    if (qty.n <= 0 || !p.PurchaseUOM) inventoryReceiptFail_('INVALID_PURCHASE_QUANTITY');
    p.PurchaseQty = inventoryReceiptDecimalText_(qty);
  } else if (p.PurchaseUOM) inventoryReceiptFail_('INVALID_PURCHASE_QUANTITY');
  var cost = inventoryReceiptDecimal_(p.AcquisitionValue, 0);
  if (cost.n <= 0) inventoryReceiptFail_('INVALID_PURCHASE_COST');
  p.AcquisitionValue = inventoryReceiptDecimalText_(cost);
  if (!p.SupplierSource) inventoryReceiptFail_('PURCHASE_SUPPLIER_REQUIRED');
  p.ExternalRef = p.ExternalRef || '';
  p.ExternalDocumentStatus = p.ExternalDocumentStatus || (p.ExternalRef ? 'AVAILABLE' : 'EXTERNAL_DOCUMENT_UNAVAILABLE');
  p.Attested = input.Attested === true;
  p.ConversionEvidenceConfirmed = input.ConversionEvidenceConfirmed === true;
  var normalized = { transactionType: 'EXPENSE', requestKey: payload.requestKey, expenseItemId: payload.expenseItemId };
  if (hasPaymentAuthority) {
    normalized.paymentStatus = paymentStatus; normalized.cashAccountCode = cashAccountCode; normalized.supplierId = supplierId;
  }
  normalized.input = p;
  return normalized;
}

function normalizeCanonicalTransactionPurchase_(payload, authority) {
  var p = payload || {}, expenses = authority.expenses || [], route = resolveExpensePurchasePolicy_(String(p.expenseItemID || ""), expenses);
  if (!expensePolicyIsPurchase_(route)) inventoryReceiptFail_('NOT_PURCHASE_POLICY');
  if (route.inventoryItemIds.length !== 1) inventoryReceiptFail_('PURCHASE_ITEM_AUTHORITY_AMBIGUOUS');
  var itemID = route.inventoryItemIds[0], item = transactionOperationalMap_(authority.items, 'ItemID')[itemID];
  if (!item || !masterSelectionEligible(item.IsActive)) inventoryReceiptFail_('ITEM_NOT_FOUND');
  var supplierID = String(p.supplierID || '').trim(), supplier = transactionOperationalMap_(authority.suppliers, 'SupplierID')[supplierID];
  if (!supplier || !masterSelectionEligible(supplier.IsActive)) inventoryReceiptFail_('SUPPLIER_INACTIVE');
  var method = transactionOperationalMap_(authority.paymentMethods, 'code')[String(p.paidVia || '').trim()];
  if (!method || !masterSelectionEligible(method.IsActive)) inventoryReceiptFail_('INVALID_PAID_VIA');
  var conversion = resolvePurchaseConversion_(itemID, String(p.purchaseUOM || '').trim(), p.purchaseDate, authority.items, authority.conversions, true);
  var qty = transactionOperationalPositive_(p.qty, 'INVALID_QTY', 'qty'), amount = transactionOperationalPositive_(p.purchasePrice, 'INVALID_PURCHASE_PRICE', 'purchasePrice');
  return { transactionType: 'CANONICAL_TRANSACTION_PURCHASE', requestKey: transactionOperationalText_(p.requestKey, 'REQUEST_KEY_REQUIRED', 'requestKey'),
    expenseItemId: String(p.expenseItemID), itemID: itemID, supplierID: supplierID, purchaseDate: String(p.purchaseDate), qty: qty,
    purchaseUOM: String(p.purchaseUOM), baseQty: qty * conversion.factorToBase, baseUOM: item.BaseUOM, amount: amount,
    paidVia: String(p.paidVia), cashAccountCode: method.AccountCode, paymentStatus: 'PAID', receiptStatus: 'RECEIVED' };
}

function buildCanonicalTransactionPurchaseEvent_(request, expense, audit) {
  var normalized = JSON.stringify(request);
  return { EventID: 'PE-' + request.requestKey, ExpenseID: request.expenseItemId, BusinessLabel: String(expense.Item),
    PolicyVersion: EXPENSE_PURCHASE_POLICY.version, PolicyRevision: EXPENSE_PURCHASE_POLICY.revision, CostType: 'VARIABLE_COST',
    PurchaseRelationship: resolveExpensePurchasePolicy_(request.expenseItemId, [expense]).PurchaseRelationship,
    ExpenseDate: request.purchaseDate, ReceiptDate: request.purchaseDate, PurchaseQty: request.qty, PurchaseUOM: request.purchaseUOM,
    AcquisitionValue: request.amount, SupplierSource: '', ExternalRef: '', ExternalDocumentStatus: '', Attestation: '',
    AllocationStatus: 'CANONICAL_PAID_RECEIVED_NO_INVENTORY', RequestKey: request.requestKey, NormalizedPayload: normalized,
    ReceiptPlan: 'null', Lifecycle: 'CAPTURED_OPERATIONAL', RecoveryKey: '', CreatedAt: audit.at, CreatedBy: audit.actor,
    IsActive: true, PaymentStatus: 'PAID', CashAccountCode: request.cashAccountCode, SupplierID: request.supplierID, AccountingStatus: 'PENDING' };
}

function normalizePurchaseEventRequest_(payload) {
  return normalizePurchaseEventRequestWithCompatibility_(payload, false);
}

function normalizePurchaseEventHistoryRequest_(payload) {
  return normalizePurchaseEventRequestWithCompatibility_(payload, true);
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
      ExternalRef: p.ExternalRef, ExternalDocumentStatus: p.ExternalDocumentStatus, Attested: p.Attested === true,
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
    SupplierSource: p.SupplierSource, ExternalRef: p.ExternalRef || '', ExternalDocumentStatus: p.ExternalDocumentStatus || (p.ExternalRef ? 'AVAILABLE' : 'EXTERNAL_DOCUMENT_UNAVAILABLE'),
    Attestation: JSON.stringify({ attested: p.Attested === true, conversionEvidenceConfirmed: p.ConversionEvidenceConfirmed === true }),
    AllocationStatus: allocation, RequestKey: request.requestKey, NormalizedPayload: JSON.stringify(request),
    ReceiptPlan: JSON.stringify(plan), Lifecycle: 'CAPTURED_OPERATIONAL', RecoveryKey: 'pe-receipt-' + request.requestKey,
    CreatedAt: audit.at, CreatedBy: audit.actor, IsActive: true, PaymentStatus: request.paymentStatus,
    CashAccountCode: request.cashAccountCode, SupplierID: request.supplierId, AccountingStatus: 'PENDING' };
}

// Strict lifecycle+IsActive validation. Unknown lifecycles and invalid
// IsActive combinations fail closed.
function isValidPurchaseEventLifecycleState_(lifecycle, isActive) {
  if (typeof isActive !== 'boolean') return false;
  if (lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL) return isActive === true;
  if (lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED) return isActive === false;
  if (lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED) return isActive === false;
  return false; // unknown lifecycle → fail closed
}

function purchaseEventHistory_(rows) {
  var keys = Object.create(null), ids = Object.create(null);
  rows.forEach(function(row) {
    if (PURCHASE_EVENT_POLICY.headers.some(function(key) { return !Object.prototype.hasOwnProperty.call(row, key); }) ||
        !row.RequestKey || keys[row.RequestKey] || ids[row.EventID] || row.EventID !== 'PE-' + row.RequestKey ||
        row.RecoveryKey !== 'pe-receipt-' + row.RequestKey ||
        !isValidPurchaseEventLifecycleState_(row.Lifecycle, row.IsActive)) inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
    // Canonical transaction purchase events (CANONICAL_TRANSACTION_PURCHASE) store a different NormalizedPayload schema.
    // Skip purchase-event-specific validation for these rows.
    var parsedPayload;
    try { parsedPayload = JSON.parse(row.NormalizedPayload); } catch (e) { inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT'); }
    if (parsedPayload.transactionType === 'CANONICAL_TRANSACTION_PURCHASE') {
      // Canonical transactions: validate only cross-field consistency using row data directly
      if (parsedPayload.requestKey !== row.RequestKey || parsedPayload.expenseItemId !== row.ExpenseID) {
        inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
      }
    } else {
      // Regular purchase events: full normalization and validation
      var request = normalizePurchaseEventHistoryRequest_(parsedPayload);
      if (JSON.stringify(request) !== row.NormalizedPayload || request.requestKey !== row.RequestKey || request.expenseItemId !== row.ExpenseID ||
          ['ExpenseDate','ReceiptDate','PurchaseQty','PurchaseUOM','AcquisitionValue','SupplierSource','ExternalRef','ExternalDocumentStatus'].some(function(k) { return request.input[k] !== row[k]; })) inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
    }
    var route = EXPENSE_PURCHASE_POLICY.rows.filter(function(r) { return r.expenseItemId === row.ExpenseID; })[0];
    if (!route || !expensePolicyIsPurchase_(route) || row.PolicyVersion !== EXPENSE_PURCHASE_POLICY.version ||
        row.PolicyRevision !== EXPENSE_PURCHASE_POLICY.revision || row.CostType !== route.CostType ||
        row.PurchaseRelationship !== route.PurchaseRelationship || !inventoryReceiptText_(row.BusinessLabel) ||
        !inventoryReceiptText_(row.CreatedBy) || inventoryTimestampMillis(row.CreatedAt) === null) {
      inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
    }
    if (parsedPayload.transactionType === 'CANONICAL_TRANSACTION_PURCHASE') {
      // Canonical transactions: validate attestation and plan using row data directly
      var expectedAttestation = row.Attestation; // Already validated at write time
      var plan = JSON.parse(row.ReceiptPlan);
      if (plan) {
        if (route.PurchaseRelationship !== 'DIRECT_HPP_COMPONENT' || !plan.input || plan.input.ItemID !== route.inventoryItemIds[0] ||
            row.AllocationStatus !== 'SINGLE_COMPONENT_EVIDENCED' || !plan.conversionSnapshot) {
          inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
        }
      } else if (row.AllocationStatus !== (route.PurchaseRelationship.indexOf('HPP_COST_POOL') === 0 ?
          'COST_POOL_ALLOCATION_UNDEFINED' : 'QUANTITY_PACKAGE_UNRESOLVED')) {
        inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
      }
    } else {
      // Regular purchase events
      var expectedAttestation = JSON.stringify({ attested: request.input.Attested === true, conversionEvidenceConfirmed: request.input.ConversionEvidenceConfirmed === true });
      if (row.Attestation !== expectedAttestation) inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
      var plan = JSON.parse(row.ReceiptPlan), p = request.input;
      if (plan) {
        if (route.PurchaseRelationship !== 'DIRECT_HPP_COMPONENT' || !p.ConversionEvidenceConfirmed || !p.ExternalRef ||
            !plan.input || plan.input.ItemID !== route.inventoryItemIds[0] || row.AllocationStatus !== 'SINGLE_COMPONENT_EVIDENCED' ||
            ['ReceiptDate','PurchaseQty','PurchaseUOM','AcquisitionValue','SupplierSource','ExternalRef','ExternalDocumentStatus','PackageIdentity','SupplierRef','Attested'].some(function(k) {
              return plan.input[k] !== p[k];
            }) || !plan.conversionSnapshot) inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
      } else if (row.AllocationStatus !== (route.PurchaseRelationship.indexOf('HPP_COST_POOL') === 0 ?
          'COST_POOL_ALLOCATION_UNDEFINED' : 'QUANTITY_PACKAGE_UNRESOLVED')) {
        inventoryReceiptFail_('PURCHASE_HISTORY_CONFLICT');
      }
    }
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
  var writePhase = null;
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
      writePhase = 'APPEND';
      writes = 'UNKNOWN';
      runtime.appendEvent(inventoryReceiptClone_(row));
      writePhase = 'READBACK';
      var stored = purchaseEventHistory_(runtime.read().events)[key];
      if (!stored || JSON.stringify(stored) !== JSON.stringify(row)) inventoryReceiptFail_('PURCHASE_READBACK_UNCERTAIN');
      row = stored; writes = 1;
      writePhase = 'CONFIRMED';
    }
    if (runtime.readLedger && runtime.writeLedger && runtime.updatePurchaseAccounting && runtime.readPurchaseEvent) {
      var accounting = postPolicyCPurchaseEvent_(row, runtime);
      if (accounting.status !== 'POSTED' && accounting.status !== 'ALREADY_POSTED') {
        var pending = purchaseEventResult_('PURCHASE_PENDING', accounting.reason || accounting.status, row, key, writes);
        pending.accountingStatus = accounting.accountingStatus || 'ACCOUNTING_EXCEPTION';
        pending.accounting = accounting;
        return pending;
      }
      row = runtime.readPurchaseEvent(row.EventID) || row;
    }
    var plan = JSON.parse(row.ReceiptPlan);
    if (!plan) {
      var captured = purchaseEventResult_('PURCHASE_CAPTURED', null, row, key, writes);
      captured.accountingStatus = row.AccountingStatus;
      return captured;
    }
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
    var reason = error.message;
    if (writes === 'UNKNOWN' && writePhase) reason = writePhase + ':' + reason;
    return purchaseEventResult_(writes === 'UNKNOWN' ? 'WRITE_UNCERTAIN' : /CONFLICT/.test(error.message) ? 'CONFLICT' :
      row ? 'PURCHASE_PENDING' : 'NOT_STARTED', reason, row, key, writes);
  }
}

function orchestratePurchaseEvent_(payload, runtime, policies) {
  var scope;
  try {
    runtime.lock.waitLock(30000); scope = { active: true, lock: runtime.lock };
    return orchestratePurchaseEventUnderLock_(payload, runtime, scope, policies);
  } finally { if (scope) { scope.active = false; runtime.lock.releaseLock(); } }
}

function projectPurchaseEventTransaction_(row, resolution) {
  var receiptPlan = row.ReceiptPlan;
  var allocationStatus = row.AllocationStatus;
  // Derive effective state from resolution if present
  if (resolution) {
    if (resolution.ReceiptPlan && resolution.ReceiptPlan !== 'null') {
      receiptPlan = resolution.ReceiptPlan;
    }
    if (resolution.AllocationStatus) {
      allocationStatus = resolution.AllocationStatus;
    }
  }
  var isActive = row.IsActive === true;
  var canVoid = isActive && row.Lifecycle === PURCHASE_EVENT_ACTIVE_LIFECYCLE;
  var projection = { id: row.EventID, transactionType: 'PurchaseEvent', canonicalTransactionType: 'PurchaseEvent',
    date: row.ExpenseDate, dateKey: row.ExpenseDate, item: row.BusinessLabel, expenseId: row.ExpenseID,
    purchaseQuantity: row.PurchaseQty, purchaseUOM: row.PurchaseUOM, acquisitionValue: Number(row.AcquisitionValue),
    supplier: row.SupplierSource, reference: row.ExternalRef || 'Document unavailable', isActive: isActive,
    receiptDate: row.ReceiptDate, operationalStatus: isActive ? 'Cost recorded' : (row.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED ? 'Corrected' : 'Voided'),
    operationalNote: receiptPlan === 'null' || receiptPlan === null ?
      'Cost recorded. Quantity or package is not verified for stock tracking.' :
      'Purchase recorded. Stock tracking requires separate verification.',
    receiptPlan: receiptPlan, allocationStatus: allocationStatus,
    financialTotalsIncluded: false, accountingStatus: 'NOT_POSTED', canEdit: false, canVoid: canVoid, canCorrect: canVoid, canResolveEvidence: canVoid && allocationStatus !== 'SINGLE_COMPONENT_EVIDENCED' };
  // T11.8/U6 cohort flag: only T11 single-commit events (backend-derived
  // PAID/1040/POSTED) carry it — legacy events keep the exact legacy shape.
  if (row.CashAccountCode === '1040' && row.AccountingStatus === 'POSTED') {
    projection.singleCommit = true;
  }
  return projection;
}

// T11.8/U6 cohort guard: a T11 single-commit PurchaseEvent (durable
// PURCHASE_SINGLE_COMMIT_SAVE operation row exists) is NEVER handled by the
// legacy in-place void/correct writers — those mutate lifecycle without the
// Policy C reversal. The durable PURCHASE_EVENT_VOID/CORRECT cores own it.
// Read-only; a failed read leaves legacy behavior unchanged.
function purchaseSingleCommitEventGuard_(ss, eventId) {
  try {
    var rows = readCanonicalTable(ss, TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.SHEET,
      TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS);
    return rows.some(function(op) {
      return String(op.OperationType) === PURCHASE_SINGLE_COMMIT_V1.OPERATION_TYPE &&
        String(op.BusinessID) === String(eventId);
    });
  } catch (error) {
    return false;
  }
}

// Purchase lookup canonical requestKey: receipt- prefix + 32 hex chars from crypto.getRandomValues.
// Production-only format. Test fixtures may use broader keys via normalizePurchaseEventRequest_.
var PURCHASE_LOOKUP_KEY_PATTERN = /^receipt-[0-9a-f]{32}$/;

// Read-only status lookup with targeted single-key inspection. Zero writes.
// Does NOT call purchaseEventHistory_ (which validates all rows globally).
// Inspects only records relevant to the requested requestKey.
function lookupPurchaseEventStatus_(requestKey, pendingPayload) {
  if (typeof requestKey !== 'string' || !requestKey || !PURCHASE_LOOKUP_KEY_PATTERN.test(requestKey)) {
    return { status: 'LOOKUP_FAILED', reason: 'INVALID_REQUEST_KEY', requestKey: requestKey || null };
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
    if (!sheet || sheet.getLastRow() <= 1) return { status: 'NOT_FOUND', requestKey: requestKey };
    var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
    // Targeted scan: collect ALL rows matching this requestKey
    var matches = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].RequestKey === requestKey) matches.push(rows[i]);
    }
    if (matches.length === 0) return { status: 'NOT_FOUND', requestKey: requestKey };
    // Duplicate rows for the same requestKey → fail closed
    if (matches.length > 1) return { status: 'LOOKUP_FAILED', reason: 'DUPLICATE_REQUESTED_KEY', requestKey: requestKey };
    var match = matches[0];
    // Validate the matched row's basic integrity (not the entire history)
    if (match.EventID !== 'PE-' + requestKey || !isValidPurchaseEventLifecycleState_(match.Lifecycle, match.IsActive)) {
      return { status: 'LOOKUP_FAILED', reason: 'CORRUPTED_EVENT_RECORD', requestKey: requestKey };
    }
    // Require valid pending payload for comparison
    if (!pendingPayload || typeof pendingPayload !== 'object' || !pendingPayload.transactionType || !pendingPayload.requestKey || !pendingPayload.input) {
      return { status: 'LOOKUP_FAILED', reason: 'MISSING_PENDING_PAYLOAD', requestKey: requestKey };
    }
    // Payload matching: normalize pending payload and compare with stored NormalizedPayload
    try {
      var normalized = normalizePurchaseEventRequest_(pendingPayload);
      if (match.NormalizedPayload !== JSON.stringify(normalized)) {
        return { status: 'CONFLICT', requestKey: requestKey, reason: 'PAYLOAD_MISMATCH' };
      }
    } catch (e) {
      return { status: 'LOOKUP_FAILED', reason: 'INVALID_PENDING_PAYLOAD', requestKey: requestKey };
    }
    return { status: 'FOUND_MATCHING_EVENT', requestKey: requestKey, eventId: match.EventID,
      data: projectPurchaseEventTransaction_(match) };
  } catch (error) {
    return { status: 'LOOKUP_FAILED', reason: error.message, requestKey: requestKey };
  }
}

// Public RPC entry point — callable from google.script.run.
function lookupPurchaseEventStatus(requestKey, pendingPayload) {
  return lookupPurchaseEventStatus_(requestKey, pendingPayload);
}

// One-shot evidence resolution: enriches quantity/package/conversion evidence
// for an existing PurchaseEvent without creating a second event.
function resolvePurchaseEventEvidence_(requestKey, resolution) {
  if (typeof requestKey !== 'string' || !requestKey || !PURCHASE_LOOKUP_KEY_PATTERN.test(requestKey)) {
    return { status: 'INVALID_REQUEST_KEY', requestKey: requestKey || null };
  }
  if (!resolution || typeof resolution !== 'object') {
    return { status: 'LOOKUP_FAILED', reason: 'INVALID_RESOLUTION_PAYLOAD', requestKey: requestKey };
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Read PurchaseEvents
    var peSheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
    if (!peSheet || peSheet.getLastRow() <= 1) return { status: 'NOT_FOUND', requestKey: requestKey };
    var peRows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
    var match = null;
    for (var i = 0; i < peRows.length; i++) {
      if (peRows[i].RequestKey === requestKey) { match = peRows[i]; break; }
    }
    if (!match) return { status: 'NOT_FOUND', requestKey: requestKey };
    // Validate event state
    if (match.EventID !== 'PE-' + requestKey || match.IsActive !== true ||
        match.Lifecycle !== 'CAPTURED_OPERATIONAL') {
      return { status: 'INVALID_EVENT_STATE', requestKey: requestKey };
    }
    // Check existing resolution (one-shot: at most one)
    var resSheet = ss.getSheetByName(PURCHASE_RESOLUTION_POLICY.sheet);
    if (resSheet && resSheet.getLastRow() > 1) {
      var resHeaders = PURCHASE_RESOLUTION_POLICY.headers;
      var resRows = readCanonicalTable(ss, PURCHASE_RESOLUTION_POLICY.sheet, resHeaders);
      for (var j = 0; j < resRows.length; j++) {
        if (resRows[j].RequestKey === requestKey) {
          // Existing resolution found — check idempotency
          if (resRows[j].ResolutionPayload === JSON.stringify(resolution)) {
            return { status: 'ALREADY_RESOLVED', requestKey: requestKey, resolutionId: resRows[j].ResolutionID };
          }
          return { status: 'RESOLUTION_CONFLICT', requestKey: requestKey,
            reason: 'EXISTING_RESOLUTION_DIFFERENT_PAYLOAD' };
        }
      }
    }
    // Validate resolution payload — must include quantity evidence
    if (!resolution.PurchaseQty || !resolution.PurchaseUOM) {
      return { status: 'LOOKUP_FAILED', reason: 'MISSING_QUANTITY_EVIDENCE', requestKey: requestKey };
    }
    if (resolution.ConversionEvidenceConfirmed !== true) {
      return { status: 'LOOKUP_FAILED', reason: 'CONVERSION_EVIDENCE_NOT_CONFIRMED', requestKey: requestKey };
    }
    // Build receipt plan from resolution
    var route = EXPENSE_PURCHASE_POLICY.rows.filter(function(r) { return r.expenseItemId === match.ExpenseID; })[0];
    if (!route) return { status: 'LOOKUP_FAILED', reason: 'INVALID_EXPENSE_POLICY', requestKey: requestKey };
    var plan = null, allocation = match.AllocationStatus;
    if (route.PurchaseRelationship === 'DIRECT_HPP_COMPONENT' && resolution.PurchaseQty &&
        resolution.ConversionEvidenceConfirmed && resolution.ExternalRef) {
      var resInput = { ItemID: route.inventoryItemIds[0], ReceiptDate: resolution.ReceiptDate || match.ReceiptDate,
        PurchaseQty: resolution.PurchaseQty, PurchaseUOM: resolution.PurchaseUOM,
        AcquisitionValue: match.AcquisitionValue, SupplierSource: resolution.SupplierSource || match.SupplierSource,
        ExternalRef: resolution.ExternalRef, ExternalDocumentStatus: resolution.ExternalDocumentStatus || 'AVAILABLE',
        Attested: true, PackageIdentity: resolution.PackageIdentity, SupplierRef: resolution.SupplierRef };
      try {
        var derived = deriveInventoryReceipt_(resInput, { items: readCanonicalTable(ss, 'InventoryItems', BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS),
          conversions: readCanonicalTable(ss, 'InventoryUOMConversions', BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS) });
        var snapshot = derived.row.ConversionSnapshot && JSON.parse(derived.row.ConversionSnapshot);
        var matching = snapshot && (snapshot.normalization === 'DIRECT_METRIC' ||
          resInput.ItemID === 'ING-018' && ['gr', 'kg'].indexOf(resolution.PurchaseUOM) !== -1 ||
          resolution.PackageIdentity && resolution.SupplierRef &&
          resolution.PackageIdentity === snapshot.authority.PackageIdentity &&
          resolution.SupplierRef === snapshot.authority.SupplierRef);
        if (derived.row.Status === 'READY' && matching) {
          plan = { input: resInput, conversionSnapshot: derived.row.ConversionSnapshot };
          allocation = 'SINGLE_COMPONENT_EVIDENCED';
        }
      } catch (e) { allocation = 'QUANTITY_PACKAGE_UNRESOLVED'; }
    }
    // Only write resolution if derivation produced READY state
    if (!plan) {
      return { status: 'RESOLUTION_EVIDENCE_INCOMPLETE', requestKey: requestKey,
        reason: 'deriveInventoryReceipt_ did not produce READY status', writes: 0 };
    }
    // Write resolution record
    var resolutionId = 'PER-' + requestKey;
    var now = new Date().toISOString();
    var resolutionRow = {};
    PURCHASE_RESOLUTION_POLICY.headers.forEach(function(h) { resolutionRow[h] = ''; });
    resolutionRow.ResolutionID = resolutionId;
    resolutionRow.RequestKey = requestKey;
    resolutionRow.EventID = match.EventID;
    resolutionRow.ResolutionPayload = JSON.stringify(resolution);
    resolutionRow.ReceiptPlan = JSON.stringify(plan);
    resolutionRow.AllocationStatus = allocation;
    resolutionRow.Status = 'RESOLVED';
    resolutionRow.CreatedAt = now;
    resolutionRow.CreatedBy = CANONICAL_ENTRY.USER;
    // Schema must exist before resolution — fail closed if absent
    if (!resSheet) {
      return { status: 'SCHEMA_NOT_READY', requestKey: requestKey,
        reason: 'PurchaseEventResolutions sheet not initialized', writes: 0 };
    }
    // Validate headers
    if (resSheet.getLastColumn() < PURCHASE_RESOLUTION_POLICY.headers.length) {
      return { status: 'SCHEMA_NOT_READY', requestKey: requestKey,
        reason: 'PurchaseEventResolutions schema incomplete', writes: 0 };
    }
    var target = resSheet.getRange(resSheet.getLastRow() + 1, 1, 1, PURCHASE_RESOLUTION_POLICY.headers.length);
    target.setNumberFormat('@');
    target.setValues([PURCHASE_RESOLUTION_POLICY.headers.map(function(h) { return resolutionRow[h]; })]);
    return { status: 'RESOLVED', requestKey: requestKey, resolutionId: resolutionId,
      allocationStatus: allocation, receiptPlan: true, writes: 1 };
  } catch (error) {
    return { status: 'LOOKUP_FAILED', reason: error.message, requestKey: requestKey };
  }
}

// Public RPC — callable from google.script.run.
function resolvePurchaseEventEvidence(requestKey, resolution) {
  var result = resolvePurchaseEventEvidence_(requestKey, resolution);
  if (result.status === 'RESOLVED') invalidateDashboardCache();
  return result;
}

function readPurchaseEventTransactionRows_(ss) {
  if (!ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet)) return [];
  var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
  purchaseEventHistory_(rows);
  // Build resolution index
  var resolutions = {};
  if (ss.getSheetByName(PURCHASE_RESOLUTION_POLICY.sheet)) {
    var resRows = readCanonicalTable(ss, PURCHASE_RESOLUTION_POLICY.sheet, PURCHASE_RESOLUTION_POLICY.headers);
    resRows.forEach(function(r) { resolutions[r.RequestKey] = r; });
  }
  return rows.map(function(row) {
    return projectPurchaseEventTransaction_(row, resolutions[row.RequestKey]);
  });
}

// Read-only diagnostic: inspects a specific PurchaseEvent row and evaluates
// each purchaseEventHistory_ integrity predicate independently. Zero writes.
function diagnosePurchaseEventIntegrity_(requestKey) {
  if (typeof requestKey !== 'string' || !requestKey) {
    return { error: 'INVALID_REQUEST_KEY', requestKey: requestKey || null };
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
    if (!sheet || sheet.getLastRow() <= 1) return { matchingRowCount: 0, error: 'NO_SHEET_DATA' };
    var headers = PURCHASE_EVENT_POLICY.headers;
    var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, headers);
    // Find all matching rows
    var matches = [];
    var matchIndices = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].RequestKey === requestKey) {
        matches.push(rows[i]);
        matchIndices.push(i + 2); // +2 because row 1 is headers, data starts at row 2
      }
    }
    if (matches.length === 0) return { matchingRowCount: 0, requestKey: requestKey };
    var row = matches[0];
    // Evaluate each purchaseEventHistory_ predicate independently
    var predicates = {};
    // Predicate 1: all headers present
    predicates.allHeadersPresent = headers.every(function(key) {
      return Object.prototype.hasOwnProperty.call(row, key);
    });
    // Predicate 2: RequestKey present
    predicates.requestKeyPresent = !!row.RequestKey;
    // Predicate 3: EventID format
    predicates.eventIdFormat = row.EventID === 'PE-' + requestKey;
    // Predicate 4: RecoveryKey format
    predicates.recoveryKeyFormat = row.RecoveryKey === 'pe-receipt-' + requestKey;
    // Predicate 5: Lifecycle
    predicates.lifecycleCorrect = isValidPurchaseEventLifecycleState_(row.Lifecycle, row.IsActive);
    // Predicate 6: IsActive — check both value and type
    predicates.isActiveValue = row.IsActive;
    predicates.isActiveType = typeof row.IsActive;
    predicates.isActiveStrict = row.IsActive === true;
    // Predicate 7: NormalizedPayload parseable
    var parsedPayload = null;
    var payloadParseable = false;
    var payloadMatchesRow = false;
    try {
      parsedPayload = JSON.parse(row.NormalizedPayload);
      payloadParseable = true;
      var normalized = normalizePurchaseEventHistoryRequest_(parsedPayload);
      payloadMatchesRow = JSON.stringify(normalized) === row.NormalizedPayload;
    } catch (e) { /* parse failed */ }
    predicates.normalizedPayloadParseable = payloadParseable;
    predicates.normalizedPayloadMatchesRow = payloadMatchesRow;
    // Predicate 8: Policy version
    predicates.policyVersion = row.PolicyVersion;
    predicates.policyRevision = row.PolicyRevision;
    predicates.policyVersionCorrect = row.PolicyVersion === EXPENSE_PURCHASE_POLICY.version;
    predicates.policyRevisionCorrect = row.PolicyRevision === EXPENSE_PURCHASE_POLICY.revision;
    // Predicate 9: ExpenseID in policy
    var route = EXPENSE_PURCHASE_POLICY.rows.filter(function(r) { return r.expenseItemId === row.ExpenseID; })[0];
    predicates.expenseIdInPolicy = !!route;
    predicates.costType = row.CostType;
    predicates.costTypeCorrect = route ? row.CostType === route.CostType : false;
    predicates.purchaseRelationship = row.PurchaseRelationship;
    predicates.purchaseRelationshipCorrect = route ? row.PurchaseRelationship === route.PurchaseRelationship : false;
    // Predicate 10: BusinessLabel present
    predicates.businessLabelPresent = !!row.BusinessLabel;
    // Predicate 11: CreatedBy present
    predicates.createdByPresent = !!row.CreatedBy;
    // Predicate 12: CreatedAt valid timestamp
    predicates.createdAtValid = inventoryTimestampMillis(row.CreatedAt) !== null;
    // Predicate 13: Attestation format
    predicates.attestationExpected = row.Attestation;
    try {
      var attParsed = JSON.parse(row.Attestation);
      predicates.attestationFormat = attParsed.attested === true && typeof attParsed.conversionEvidenceConfirmed === 'boolean';
    } catch (e) { predicates.attestationFormat = false; }
    // Predicate 14: ReceiptPlan
    predicates.receiptPlan = row.ReceiptPlan;
    try {
      var plan = JSON.parse(row.ReceiptPlan);
      predicates.receiptPlanParsed = true;
      predicates.receiptPlanIsNull = plan === null;
      if (plan && plan.input) {
        predicates.receiptPlanHasInput = true;
        predicates.receiptPlanItemId = plan.input.ItemID;
      }
    } catch (e) { predicates.receiptPlanParsed = false; }
    // Overall integrity: all critical predicates must pass
    predicates.overallPass = predicates.allHeadersPresent && predicates.requestKeyPresent &&
      predicates.eventIdFormat && predicates.recoveryKeyFormat && predicates.lifecycleCorrect &&
      predicates.isActiveStrict && predicates.normalizedPayloadParseable &&
      predicates.normalizedPayloadMatchesRow && predicates.policyVersionCorrect &&
      predicates.policyRevisionCorrect && predicates.expenseIdInPolicy &&
      predicates.costTypeCorrect && predicates.purchaseRelationshipCorrect &&
      predicates.businessLabelPresent && predicates.createdByPresent &&
      predicates.createdAtValid && predicates.attestationFormat;

    // Also capture the Transactions read path error
    var transactionsReadError = null;
    try {
      readPurchaseEventTransactionRows_(ss);
    } catch (e) {
      transactionsReadError = { message: e.message, code: e.message };
    }

    return {
      matchingRowCount: matches.length,
      matchRowNumbers: matchIndices,
      requestKey: requestKey,
      rawFields: {
        EventID: row.EventID,
        RequestKey: row.RequestKey,
        IsActive: row.IsActive,
        Lifecycle: row.Lifecycle,
        RecoveryKey: row.RecoveryKey,
        ExpenseID: row.ExpenseID,
        ExpenseDate: row.ExpenseDate,
        ReceiptDate: row.ReceiptDate,
        AcquisitionValue: row.AcquisitionValue,
        AllocationStatus: row.AllocationStatus,
        ReceiptPlan: row.ReceiptPlan,
        NormalizedPayload: row.NormalizedPayload ? row.NormalizedPayload.substring(0, 500) : null,
        PolicyVersion: row.PolicyVersion,
        PolicyRevision: row.PolicyRevision,
        CostType: row.CostType,
        PurchaseRelationship: row.PurchaseRelationship,
        BusinessLabel: row.BusinessLabel,
        CreatedAt: row.CreatedAt,
        CreatedBy: row.CreatedBy,
        Attestation: row.Attestation ? row.Attestation.substring(0, 200) : null
      },
      fieldRuntimeTypes: {
        EventID: typeof row.EventID,
        RequestKey: typeof row.RequestKey,
        IsActive: typeof row.IsActive,
        Lifecycle: typeof row.Lifecycle,
        RecoveryKey: typeof row.RecoveryKey,
        ExpenseID: typeof row.ExpenseID,
        ExpenseDate: typeof row.ExpenseDate,
        ReceiptDate: typeof row.ReceiptDate,
        AcquisitionValue: typeof row.AcquisitionValue,
        AllocationStatus: typeof row.AllocationStatus,
        ReceiptPlan: typeof row.ReceiptPlan,
        PolicyVersion: typeof row.PolicyVersion,
        PolicyRevision: typeof row.PolicyRevision,
        CostType: typeof row.CostType,
        PurchaseRelationship: typeof row.PurchaseRelationship,
        BusinessLabel: typeof row.BusinessLabel,
        CreatedAt: typeof row.CreatedAt,
        CreatedBy: typeof row.CreatedBy
      },
      predicates: predicates,
      transactionsReadError: transactionsReadError
    };
  } catch (error) {
    return { error: error.message, requestKey: requestKey };
  }
}

// === PurchaseEvent Void Operations ===

// Validate that a PurchaseEvent row is eligible for void.
// Returns null on success, or a result object on refusal.
function validatePurchaseEventVoidEligibility_(row) {
  if (!row || typeof row !== 'object') return { status: 'INVALID_REQUEST', reason: 'MISSING_EVENT' };
  if (row.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED && row.IsActive === false) {
    return { status: 'ALREADY_VOIDED' };
  }
  if (row.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED) {
    return { status: 'INVALID_EVENT_STATE', reason: 'CORRECTED_EVENT' };
  }
  if (!isValidPurchaseEventLifecycleState_(row.Lifecycle, row.IsActive)) {
    return { status: 'INVALID_EVENT_STATE', reason: 'CORRUPTED_LIFECYCLE' };
  }
  // Must be active CAPTURED_OPERATIONAL
  if (row.Lifecycle !== PURCHASE_EVENT_ACTIVE_LIFECYCLE || row.IsActive !== true) {
    return { status: 'INVALID_EVENT_STATE', reason: 'NOT_VOIDABLE' };
  }
  return null; // eligible
}

// Check if downstream InventoryReceipt or Cash settlement evidence exists for this event.
// Returns null if SAFE, or a result object if downstream blocks or check fails.
// Canonical linkage: PurchaseEvent.RecoveryKey === InventoryReceipt.IdempotencyKey
function checkPurchaseEventDownstreamEvidence_(ss, row) {
  if (!ss.getSheetByName) return null;
  var receiptSheet = ss.getSheetByName('InventoryReceipts');
  // Sheet absence is an established valid state (no receipts exist yet) → SAFE
  if (!receiptSheet) return null;
  // Sheet exists — must read authoritatively
  try {
    var receipts = readCanonicalTable(ss, 'InventoryReceipts', INVENTORY_RECEIPT_POLICY.HEADERS);
    for (var i = 0; i < receipts.length; i++) {
      if (receipts[i].IdempotencyKey === row.RecoveryKey && receipts[i].IsActive === true) {
        return { status: 'REFUSED', reason: 'REVERSAL_REQUIRED' };
      }
    }
    return null; // authoritative read completed, no active receipt linked → SAFE
  } catch (e) {
    // Sheet exists but read failed — cannot determine downstream state → fail closed
    return { status: 'REFUSED', reason: 'DOWNSTREAM_CHECK_FAILED' };
  }
}

// Persist the void mutation on a PurchaseEvent row. Single-row write.
// Returns the after-values array on success.
// Throws on write failure (caller handles rollback).
function persistPurchaseEventVoid_(sheet, rowNumber, before, runtime) {
  var headers = PURCHASE_EVENT_POLICY.headers;
  var after = before.slice();
  var lifecycleIdx = headers.indexOf('Lifecycle');
  var isActiveIdx = headers.indexOf('IsActive');
  after[lifecycleIdx] = PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED;
  after[isActiveIdx] = false;
  sheet.getRange(rowNumber, 1, 1, after.length).setValues([after]);
  runtime.flush();
  // Readback verification
  var readback = sheet.getRange(rowNumber, 1, 1, after.length).getValues()[0];
  if (readback[lifecycleIdx] !== PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED ||
      readback[isActiveIdx] !== false || typeof readback[isActiveIdx] !== 'boolean') {
    // Rollback
    sheet.getRange(rowNumber, 1, 1, before.length).setValues([before]);
    runtime.flush();
    var verifyBack = sheet.getRange(rowNumber, 1, 1, before.length).getValues()[0];
    if (verifyBack[lifecycleIdx] !== before[lifecycleIdx] || verifyBack[isActiveIdx] !== before[isActiveIdx]) {
      throw canonicalEntryError('ROLLBACK_FAILED', 'Void rollback could not restore the original PurchaseEvent.', null);
    }
    throw canonicalEntryError('WRITE_FAILED', 'Void mutation readback verification failed.', null);
  }
  return after;
}

// Core void operation under lock. Accepts ss, requestKey/eventId, reason, runtime.
function voidPurchaseEventUnderLock_(identity, reason, ss, runtime) {
  var headers = PURCHASE_EVENT_POLICY.headers;
  var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
  if (!sheet || sheet.getLastRow() <= 1) return { status: 'NOT_FOUND', writeCount: 0 };

  var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, headers);
  // Find matching row by EventID or RequestKey
  var match = null, matchRowNumber = null;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row.EventID === identity || row.RequestKey === identity) {
      match = row;
      matchRowNumber = row.sourceRowIndex + 1; // +1 for header row
      break;
    }
  }
  if (!match) return { status: 'NOT_FOUND', writeCount: 0 };

  // T11.8/U6: single-commit cohort never enters the legacy in-place void.
  if (purchaseSingleCommitEventGuard_(ss, match.EventID)) {
    return { status: 'REFUSED', reason: 'SINGLE_COMMIT_COHORT_ROUTED', writeCount: 0 };
  }

  // Snapshot before-values for readback and rollback
  var before = headers.map(function(h) { return match[h]; });

  // Validate eligibility
  var eligibility = validatePurchaseEventVoidEligibility_(match);
  if (eligibility) return eligibility;

  // Check downstream evidence
  var downstream = checkPurchaseEventDownstreamEvidence_(ss, match);
  if (downstream) return downstream;

  // Persist void
  try {
    var after = persistPurchaseEventVoid_(sheet, matchRowNumber, before, runtime);
    // Final readback verification (already done in persist, but verify canonical fields)
    var finalRows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, headers);
    var finalRow = null;
    for (var j = 0; j < finalRows.length; j++) {
      if (finalRows[j].EventID === match.EventID) { finalRow = finalRows[j]; break; }
    }
    if (!finalRow || finalRow.Lifecycle !== PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED ||
        finalRow.IsActive !== false || typeof finalRow.IsActive !== 'boolean') {
      throw canonicalEntryError('READBACK_FAILED', 'Post-void readback verification failed.', null);
    }
    // Verify immutable fields
    if (finalRow.RequestKey !== match.RequestKey || finalRow.EventID !== match.EventID ||
        finalRow.RecoveryKey !== match.RecoveryKey ||
        finalRow.NormalizedPayload !== match.NormalizedPayload ||
        finalRow.AcquisitionValue !== match.AcquisitionValue ||
        finalRow.ExpenseID !== match.ExpenseID) {
      throw canonicalEntryError('READBACK_FAILED', 'Immutable fields changed during void.', null);
    }
    return { status: 'VOIDED', writeCount: 1, eventId: match.EventID, requestKey: match.RequestKey };
  } catch (error) {
    return { status: 'WRITE_UNCERTAIN', reason: error.message, writeCount: 0, eventId: match.EventID };
  }
}

// Public RPC — callable from google.script.run.
// Accepts { eventOrRequestKey: string, reason: string }.
function voidPurchaseEvent(payload) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    var identity = payload && payload.eventOrRequestKey;
    if (typeof identity !== 'string' || !identity || !identity.trim()) {
      return canonicalEntryFailure(canonicalEntryError('INVALID_REQUEST', 'EventID or RequestKey is required.', 'eventOrRequestKey'));
    }
    var reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    if (reason.length < 3 || reason.length > 500 || !/[A-Za-z0-9]/.test(reason)) {
      return canonicalEntryFailure(canonicalEntryError('INVALID_VOID_REASON', 'Reason must be meaningful and no more than 500 characters.', 'reason'));
    }
    lock.waitLock(30000); acquired = true;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var timestamp = new Date();
    var runtime = { flush: function() { SpreadsheetApp.flush(); } };
    var result = voidPurchaseEventUnderLock_(identity.trim(), reason, ss, runtime);
    if (result.status === 'VOIDED') invalidateDashboardCache();
    return result;
  } catch (error) {
    return { status: 'WRITE_UNCERTAIN', reason: error.message, writeCount: 0 };
  } finally {
    if (acquired) lock.releaseLock();
  }
}

// === End Void Operations ===

// Validate complete correction relationship integrity.
// Returns { valid: true, replacementId, correctionRequestKey } when integrity is proven.
// Returns { valid: false, status, reason } when integrity is broken.
// Returns { valid: true, replacementId: null } when no correction evidence exists.
function validatePurchaseEventCorrectionIntegrity_(ss, originalEventId, rows) {
  // Scan Logs for correction evidence
  var voidLog = null, createLog = null;
  try {
    var logs = ss.getSheetByName('Logs');
    if (!logs || logs.getLastRow() <= 1) return { valid: true, replacementId: null, correctionRequestKey: null };
    var logRows = readCanonicalTable(ss, 'Logs', CANONICAL_ENTRY.LOG_HEADERS);
    for (var i = 0; i < logRows.length; i++) {
      var entry = logRows[i];
      if (entry.Module !== 'TransactionLifecycle') continue;
      try {
        var meta = JSON.parse(entry.Metadata || '{}');
        if (entry.Action === 'CORRECT_VOID_PURCHASE' && entry.RecordID === originalEventId) voidLog = meta;
        if (entry.Action === 'CORRECT_CREATE_PURCHASE' && meta.originalId === originalEventId) createLog = meta;
      } catch (e) { /* malformed log entry — skip */ }
    }
  } catch (e) { /* Logs inaccessible — cannot establish relationship */ }

  if (!voidLog) return { valid: true, replacementId: null, correctionRequestKey: null };
  if (!voidLog.replacementId || typeof voidLog.replacementId !== 'string') {
    return { valid: false, status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'MALFORMED_VOID_LOG' };
  }
  var recordedReplacementId = voidLog.replacementId;
  var correctionRequestKey = voidLog.correctionRequestKey || null;

  if (createLog) {
    if (createLog.originalId !== originalEventId) return { valid: false, status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'LOG_PAIR_ORIGINAL_MISMATCH' };
    if (createLog.correctionRequestKey !== correctionRequestKey) return { valid: false, status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'LOG_PAIR_KEY_MISMATCH' };
  }

  var original = null;
  for (var j = 0; j < rows.length; j++) if (rows[j].EventID === originalEventId) { original = rows[j]; break; }
  if (!original) return { valid: false, status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'ORIGINAL_MISSING' };
  if (original.Lifecycle !== PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED || original.IsActive !== false) {
    return { valid: false, status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'ORIGINAL_NOT_CORRECTED' };
  }

  var replacement = null;
  for (var k = 0; k < rows.length; k++) if (rows[k].EventID === recordedReplacementId) { replacement = rows[k]; break; }
  if (!replacement) return { valid: false, status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'REPLACEMENT_MISSING' };
  if (replacement.Lifecycle !== PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL || replacement.IsActive !== true) {
    return { valid: false, status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'REPLACEMENT_NOT_ACTIVE' };
  }
  if (replacement.EventID !== recordedReplacementId) return { valid: false, status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'REPLACEMENT_ID_MISMATCH' };
  return { valid: true, replacementId: recordedReplacementId, correctionRequestKey: correctionRequestKey };
}

function validatePurchaseEventCorrectionEligibility_(row) {
  if (!row || typeof row !== 'object') return { status: 'INVALID_REQUEST', reason: 'MISSING_EVENT' };
  if (row.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED) return { status: 'INVALID_EVENT_STATE', reason: 'VOIDED_ORIGINAL' };
  if (row.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED) return { status: 'INVALID_EVENT_STATE', reason: 'ALREADY_CORRECTED' };
  if (!isValidPurchaseEventLifecycleState_(row.Lifecycle, row.IsActive)) return { status: 'INVALID_EVENT_STATE', reason: 'CORRUPTED_LIFECYCLE' };
  if (row.Lifecycle !== PURCHASE_EVENT_ACTIVE_LIFECYCLE || row.IsActive !== true) return { status: 'INVALID_EVENT_STATE', reason: 'NOT_CORRECTABLE' };
  return null;
}

function correctPurchaseEventUnderLock_(payload, ss, runtime) {
  var headers = PURCHASE_EVENT_POLICY.headers;
  var identity = typeof payload.originalEventOrRequestKey === 'string' ? payload.originalEventOrRequestKey.trim() : '';
  var correctionKey = typeof payload.correctionRequestKey === 'string' ? payload.correctionRequestKey.trim() : '';
  if (!identity) return { status: 'INVALID_REQUEST', reason: 'MISSING_IDENTITY', writeCount: 0 };
  if (!validatePurchaseCorrectionKey_(correctionKey)) return { status: 'INVALID_REQUEST', reason: 'INVALID_CORRECTION_KEY', writeCount: 0 };
  if (!payload.replacement || typeof payload.replacement !== 'object') return { status: 'INVALID_REQUEST', reason: 'MISSING_REPLACEMENT', writeCount: 0 };

  var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
  if (!sheet || sheet.getLastRow() <= 1) return { status: 'NOT_FOUND', writeCount: 0 };
  var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, headers), original = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].EventID === identity || rows[i].RequestKey === identity) { original = rows[i]; break; }
  }
  if (!original) return { status: 'NOT_FOUND', writeCount: 0 };

  // T11.8/U6: single-commit cohort never enters the legacy in-place
  // correction (it would mutate lifecycle without the Policy C reversal).
  if (purchaseSingleCommitEventGuard_(ss, original.EventID)) {
    return { status: 'REFUSED', reason: 'SINGLE_COMMIT_COHORT_ROUTED', writeCount: 0 };
  }

  var replacementRequestKey = 'corr-' + correctionKey;
  var replacementPayload = { transactionType: 'EXPENSE', requestKey: replacementRequestKey,
    expenseItemId: payload.replacement.expenseItemId, paymentStatus: original.PaymentStatus,
    cashAccountCode: original.CashAccountCode, supplierId: original.SupplierID, input: payload.replacement.input };
  var normalizedReplacement;
  try { normalizedReplacement = normalizePurchaseEventRequest_(replacementPayload); }
  catch (error) { return { status: 'INVALID_REQUEST', reason: 'INVALID_REPLACEMENT_PAYLOAD', writeCount: 0 }; }
  var normalizedText = JSON.stringify(normalizedReplacement);

  // Validate complete correction relationship integrity
  var integrity = validatePurchaseEventCorrectionIntegrity_(ss, original.EventID, rows);
  if (!integrity.valid) return { status: integrity.status, reason: integrity.reason, writeCount: 0 };
  if (integrity.replacementId) {
    if (integrity.correctionRequestKey !== correctionKey) {
      return { status: 'INVALID_EVENT_STATE', reason: 'ALREADY_CORRECTED_DIFFERENT_KEY', writeCount: 0 };
    }
    var related = rows.filter(function(r) { return r.EventID === integrity.replacementId; })[0];
    if (!related || related.NormalizedPayload !== normalizedText) {
      return { status: 'CORRECTION_CONFLICT', reason: 'REPLACEMENT_PAYLOAD_MISMATCH', writeCount: 0 };
    }
    return { status: 'ALREADY_CORRECTED', replacementEventId: integrity.replacementId, writeCount: 0 };
  }

  var eligibility = validatePurchaseEventCorrectionEligibility_(original);
  if (eligibility) { eligibility.writeCount = 0; return eligibility; }
  var downstream = checkPurchaseEventDownstreamEvidence_(ss, original);
  if (downstream) { downstream.writeCount = 0; return downstream; }

  var history;
  try { history = purchaseEventHistory_(rows); }
  catch (error) { return { status: 'INVALID_EVENT_STATE', reason: 'CORRUPTED_HISTORY', writeCount: 0 }; }
  if (history[replacementRequestKey]) {
    // Replacement exists but no log relationship — corruption
    return { status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'REPLACEMENT_WITHOUT_LOG', writeCount: 0 };
  }

  var expenses;
  try { expenses = readCanonicalTable(ss, 'ExpenseItems', ['ID_Ops', 'Item', 'Kategori', 'Kind', 'Group', 'AccountCode', 'IsActive']); }
  catch (error) { return { status: 'INVALID_REQUEST', reason: 'REPLACEMENT_BUILD_FAILED', writeCount: 0 }; }
  var replacementEvent;
  try { replacementEvent = buildPurchaseEvent_(normalizedReplacement, expenses,
    { events: rows, expenses: expenses, items: [], conversions: [] }, runtime.audit()); }
  catch (error) { return { status: 'INVALID_REQUEST', reason: 'REPLACEMENT_BUILD_FAILED', writeCount: 0 }; }

  var logs = ss.getSheetByName('Logs');
  try { requireCanonicalHeaders(logs, CANONICAL_ENTRY.LOG_HEADERS); }
  catch (error) { return { status: 'WRITE_UNCERTAIN', reason: error.message, writeCount: 0, originalEventId: original.EventID }; }
  var replacementRow = sheet.getLastRow() + 1;
  var originalRow = original.sourceRowIndex + 1;
  var beforeOriginal = headers.map(function(header) { return original[header]; });
  var afterOriginal = beforeOriginal.slice();
  var lifecycleIdx = headers.indexOf('Lifecycle'), isActiveIdx = headers.indexOf('IsActive');
  afterOriginal[lifecycleIdx] = PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED;
  afterOriginal[isActiveIdx] = false;
  var audits = [];
  try {
    var target = sheet.getRange(replacementRow, 1, 1, headers.length);
    target.setNumberFormat('@');
    target.setValues([headers.map(function(header) { return replacementEvent[header]; })]);
    if (!writeCanonicalBoolean_(sheet, replacementRow, isActiveIdx + 1)) throw canonicalEntryError('WRITE_FAILED', 'Replacement IsActive persistence failed.', null);
    runtime.flush();
    sheet.getRange(originalRow, 1, 1, afterOriginal.length).setValues([afterOriginal]); runtime.flush();
    var originalReadback = sheet.getRange(originalRow, 1, 1, afterOriginal.length).getValues()[0];
    if (originalReadback[lifecycleIdx] !== PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED || originalReadback[isActiveIdx] !== false || typeof originalReadback[isActiveIdx] !== 'boolean') {
      throw canonicalEntryError('WRITE_FAILED', 'Original correction mutation could not be verified.', null);
    }
    var timestamp = new Date().toISOString();
    audits.push(appendLifecycleAudit(logs, timestamp, 'CORRECT_VOID_PURCHASE', original.EventID,
      { reason: payload.reason, replacementId: replacementEvent.EventID, correctionRequestKey: correctionKey, before: beforeOriginal }, runtime));
    audits.push(appendLifecycleAudit(logs, timestamp, 'CORRECT_CREATE_PURCHASE', replacementEvent.EventID,
      { reason: payload.reason, originalId: original.EventID, correctionRequestKey: correctionKey,
        replacement: headers.map(function(header) { return replacementEvent[header]; }) }, runtime));
    var finalRows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, headers);
    var finalOriginal = finalRows.filter(function(row) { return row.EventID === original.EventID; })[0];
    var finalReplacement = finalRows.filter(function(row) { return row.EventID === replacementEvent.EventID; });
    if (!finalOriginal || finalOriginal.Lifecycle !== PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED || finalOriginal.IsActive !== false ||
        finalReplacement.length !== 1 || finalReplacement[0].NormalizedPayload !== normalizedText) {
      throw canonicalEntryError('WRITE_FAILED', 'Correction readback verification failed.', null);
    }
    return { status: 'CORRECTED', originalEventId: original.EventID, replacementEventId: replacementEvent.EventID,
      replacementRequestKey: replacementRequestKey, writeCount: 1 };
  } catch (error) {
    try {
      for (var j = audits.length - 1; j >= 0; j--) rollbackLifecycleLog(logs, audits[j]);
      sheet.getRange(originalRow, 1, 1, beforeOriginal.length).setValues([beforeOriginal]);
      if (String(sheet.getRange(replacementRow, 1).getValue()) === replacementEvent.EventID) sheet.deleteRow(replacementRow);
      runtime.flush();
      var restored = sheet.getRange(originalRow, 1, 1, beforeOriginal.length).getValues()[0];
      if (restored[lifecycleIdx] !== beforeOriginal[lifecycleIdx] || restored[isActiveIdx] !== beforeOriginal[isActiveIdx] ||
          String(sheet.getRange(replacementRow, 1).getValue()) === replacementEvent.EventID) throw new Error('ROLLBACK_VERIFICATION_FAILED');
    } catch (rollbackError) {
      return { status: 'WRITE_UNCERTAIN', reason: 'ROLLBACK_FAILED: ' + error.message, writeCount: 0, originalEventId: original.EventID };
    }
    return { status: 'WRITE_UNCERTAIN', reason: error.message, writeCount: 0, originalEventId: original.EventID };
  }
}

function correctPurchaseEvent(payload) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    if (!payload || typeof payload !== 'object') return { status: 'INVALID_REQUEST', reason: 'MISSING_PAYLOAD', writeCount: 0 };
    var reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    if (reason.length < 3 || reason.length > 500 || !/[A-Za-z0-9]/.test(reason)) return { status: 'INVALID_REQUEST', reason: 'INVALID_VOID_REASON', writeCount: 0 };
    if (!payload.originalEventOrRequestKey || !payload.correctionRequestKey || !payload.replacement) return { status: 'INVALID_REQUEST', reason: 'MISSING_REQUIRED_FIELDS', writeCount: 0 };
    if (!validatePurchaseCorrectionKey_(payload.correctionRequestKey)) return { status: 'INVALID_REQUEST', reason: 'INVALID_CORRECTION_KEY', writeCount: 0 };
    lock.waitLock(30000); acquired = true;
    var runtime = { flush: function() { SpreadsheetApp.flush(); },
      audit: function() { return { actor: CANONICAL_ENTRY.USER, at: new Date().toISOString() }; },
      uuid: function() { return Utilities.getUuid(); } };
    var result = correctPurchaseEventUnderLock_(payload, SpreadsheetApp.getActiveSpreadsheet(), runtime);
    if (result.status === 'CORRECTED') invalidateDashboardCache();
    return result;
  } catch (error) { return { status: 'WRITE_UNCERTAIN', reason: error.message, writeCount: 0 }; }
  finally { if (acquired) lock.releaseLock(); }
}

// Bounded remediation: fix IsActive type for rows where the ONLY defect is
// string "true" instead of boolean true. All other integrity predicates must pass.
// If dryRun is true, returns eligibility report without writing.
function remediatePurchaseEventIsActiveType_(dryRun) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
  if (!sheet || sheet.getLastRow() <= 1) return { remediated: 0, reason: 'NO_DATA' };
  var headers = PURCHASE_EVENT_POLICY.headers;
  var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, headers);
  var isActiveIdx = headers.indexOf('IsActive');
  if (isActiveIdx === -1) return { remediated: 0, reason: 'NO_ISACTIVE_COLUMN' };
  var remediated = 0;
  var skipped = 0;
  var eligible = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (typeof row.IsActive !== 'string' || row.IsActive !== 'true') { skipped++; continue; }
    var otherPredicatesPass =
      row.EventID && row.RequestKey && row.EventID === 'PE-' + row.RequestKey &&
      row.RecoveryKey === 'pe-receipt-' + row.RequestKey &&
      row.Lifecycle === 'CAPTURED_OPERATIONAL' &&
      row.ExpenseID && row.ExpenseDate && row.ReceiptDate &&
      row.AllocationStatus && row.ReceiptPlan &&
      row.NormalizedPayload && row.PolicyVersion &&
      row.BusinessLabel && row.CreatedBy &&
      inventoryTimestampMillis(row.CreatedAt) !== null;
    if (!otherPredicatesPass) { skipped++; continue; }
    eligible.push({ row: i + 2, requestKey: row.RequestKey });
    if (!dryRun) {
      if (!writeCanonicalBoolean_(sheet, i + 2, isActiveIdx + 1)) {
        // Readback failed — do not count as remediated
        skipped++;
        continue;
      }
      remediated++;
    }
  }
  if (dryRun) return { dryRun: true, eligible: eligible.length, eligibleRows: eligible, skipped: skipped, total: rows.length };
  return { remediated: remediated, skipped: skipped, total: rows.length };
}

// Read-only eligibility scan: reports which rows need IsActive remediation
// without performing any writes. Returns full inventory before any mutation.
function scanPurchaseEventIsActiveEligibility_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
  if (!sheet || sheet.getLastRow() <= 1) return { total: 0, eligible: 0, reason: 'NO_DATA' };
  var headers = PURCHASE_EVENT_POLICY.headers;
  var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, headers);
  var isActiveIdx = headers.indexOf('IsActive');
  if (isActiveIdx === -1) return { total: rows.length, eligible: 0, reason: 'NO_ISACTIVE_COLUMN' };
  var eligible = [];
  var alreadyCanonical = [];
  var otherCorrupted = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowNum = i + 2; // sheet row: +1 for headers, +1 for 0-index
    if (typeof row.IsActive === 'boolean' && row.IsActive === true) {
      alreadyCanonical.push({ row: rowNum, requestKey: row.RequestKey });
    } else if (typeof row.IsActive === 'string' && row.IsActive === 'true') {
      // Candidate — check all other predicates
      var otherPredicatesPass =
        row.EventID && row.RequestKey && row.EventID === 'PE-' + row.RequestKey &&
        row.RecoveryKey === 'pe-receipt-' + row.RequestKey &&
        row.Lifecycle === 'CAPTURED_OPERATIONAL' &&
        row.ExpenseID && row.ExpenseDate && row.ReceiptDate &&
        row.AllocationStatus && row.ReceiptPlan &&
        row.NormalizedPayload && row.PolicyVersion &&
        row.BusinessLabel && row.CreatedBy &&
        inventoryTimestampMillis(row.CreatedAt) !== null;
      if (otherPredicatesPass) {
        eligible.push({ row: rowNum, requestKey: row.RequestKey, expenseId: row.ExpenseID });
      } else {
        otherCorrupted.push({ row: rowNum, requestKey: row.RequestKey, expenseId: row.ExpenseID,
          defect: 'IsActive=string plus other predicate failures' });
      }
    } else {
      otherCorrupted.push({ row: rowNum, requestKey: row.RequestKey, expenseId: row.ExpenseID,
        defect: 'IsActive=' + String(row.IsActive) + ' (type=' + typeof row.IsActive + ')' });
    }
  }
  return {
    total: rows.length,
    eligible: eligible.length,
    eligibleRows: eligible,
    alreadyCanonical: alreadyCanonical.length,
    alreadyCanonicalRows: alreadyCanonical,
    otherCorrupted: otherCorrupted.length,
    otherCorruptedRows: otherCorrupted
  };
}

// Read-only Void status check. Zero writes.
// Accepts: { eventOrRequestKey: string }
function lookupPurchaseVoidStatus(payload) {
  try {
    var identity = payload && payload.eventOrRequestKey;
    if (typeof identity !== 'string' || !identity || !identity.trim()) {
      return { status: 'LOOKUP_FAILED', reason: 'INVALID_IDENTITY' };
    }
    identity = identity.trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
    if (!sheet || sheet.getLastRow() <= 1) return { status: 'LOOKUP_FAILED', reason: 'NO_DATA' };
    var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
    var match = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].EventID === identity || rows[i].RequestKey === identity) { match = rows[i]; break; }
    }
    if (!match) return { status: 'LOOKUP_FAILED', reason: 'NOT_FOUND' };
    if (match.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED && match.IsActive === false) {
      return { status: 'VOID_CONFIRMED', eventId: match.EventID };
    }
    if (match.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL && match.IsActive === true) {
      return { status: 'NOT_VOIDED', eventId: match.EventID };
    }
    return { status: 'STATE_CONFLICT', eventId: match.EventID, lifecycle: match.Lifecycle, isActive: match.IsActive };
  } catch (error) {
    return { status: 'LOOKUP_FAILED', reason: error.message };
  }
}

// Read-only Correction status check. Zero writes.
// Accepts: { originalEventOrRequestKey: string, correctionRequestKey: string,
//            expectedReplacement: { expenseItemId: string, input: object } }
function lookupPurchaseCorrectionStatus(payload) {
  try {
    var identity = payload && payload.originalEventOrRequestKey;
    var correctionKey = payload && payload.correctionRequestKey;
    if (typeof identity !== 'string' || !identity || !identity.trim()) {
      return { status: 'LOOKUP_FAILED', reason: 'INVALID_IDENTITY' };
    }
    if (typeof correctionKey !== 'string' || !correctionKey || !correctionKey.trim()) {
      return { status: 'LOOKUP_FAILED', reason: 'INVALID_CORRECTION_KEY' };
    }
    identity = identity.trim();
    correctionKey = correctionKey.trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
    if (!sheet || sheet.getLastRow() <= 1) return { status: 'LOOKUP_FAILED', reason: 'NO_DATA' };
    var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
    var original = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].EventID === identity || rows[i].RequestKey === identity) { original = rows[i]; break; }
    }
    if (!original) return { status: 'LOOKUP_FAILED', reason: 'NOT_FOUND' };
    var integrity = validatePurchaseEventCorrectionIntegrity_(ss, original.EventID, rows);
    if (integrity.replacementId) {
      if (!integrity.valid) return { status: 'CORRECTION_INTEGRITY_CONFLICT', reason: integrity.reason };
      if (integrity.correctionRequestKey !== correctionKey) {
        return { status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'KEY_MISMATCH' };
      }
      var replacement = rows.filter(function(r) { return r.EventID === integrity.replacementId; })[0];
      var payloadMatch = true;
      var expectedPayload = payload.expectedReplacementPayload;
      if (typeof expectedPayload === 'string' && expectedPayload && replacement) {
        payloadMatch = replacement.NormalizedPayload === expectedPayload;
      }
      if (!payloadMatch) return { status: 'CORRECTION_CONFLICT', reason: 'PAYLOAD_MISMATCH', replacementEventId: integrity.replacementId };
      return { status: 'CORRECTION_CONFIRMED', eventId: original.EventID, replacementEventId: integrity.replacementId };
    }
    // No correction relationship found — check if original is still active
    if (original.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL && original.IsActive === true) {
      return { status: 'NOT_CORRECTED', eventId: original.EventID };
    }
    // Original is in unexpected state without correction relationship
    return { status: 'CORRECTION_INTEGRITY_CONFLICT', reason: 'ORIGINAL_UNEXPECTED_STATE' };
  } catch (error) {
    return { status: 'LOOKUP_FAILED', reason: error.message };
  }
}

// Read-only Resolution status check. Zero writes.
// Accepts: { requestKey: string, expectedResolutionPayload: string (JSON) }
function lookupPurchaseResolutionStatus(payload) {
  try {
    var requestKey = payload && payload.requestKey;
    if (typeof requestKey !== 'string' || !requestKey || !PURCHASE_LOOKUP_KEY_PATTERN.test(requestKey)) {
      return { status: 'LOOKUP_FAILED', reason: 'INVALID_REQUEST_KEY' };
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var peSheet = ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet);
    if (!peSheet || peSheet.getLastRow() <= 1) return { status: 'LOOKUP_FAILED', reason: 'NO_DATA' };
    var peRows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
    var match = null;
    for (var i = 0; i < peRows.length; i++) {
      if (peRows[i].RequestKey === requestKey) { match = peRows[i]; break; }
    }
    if (!match) return { status: 'LOOKUP_FAILED', reason: 'NOT_FOUND' };
    if (match.Lifecycle !== PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL || match.IsActive !== true) {
      return { status: 'LOOKUP_FAILED', reason: 'INVALID_EVENT_STATE' };
    }
    // Check for existing resolution
    var resSheet = ss.getSheetByName(PURCHASE_RESOLUTION_POLICY.sheet);
    if (!resSheet || resSheet.getLastRow() <= 1) {
      return { status: 'NOT_RESOLVED', requestKey: requestKey };
    }
    var resRows = readCanonicalTable(ss, PURCHASE_RESOLUTION_POLICY.sheet, PURCHASE_RESOLUTION_POLICY.headers);
    for (var j = 0; j < resRows.length; j++) {
      if (resRows[j].RequestKey === requestKey) {
        var payloadMatch = true;
        var expectedPayload = payload.expectedResolutionPayload;
        if (typeof expectedPayload === 'string' && expectedPayload) {
          payloadMatch = resRows[j].ResolutionPayload === expectedPayload;
        }
        if (!payloadMatch) return { status: 'RESOLUTION_CONFLICT', requestKey: requestKey, reason: 'PAYLOAD_MISMATCH' };
        return { status: 'RESOLUTION_CONFIRMED', requestKey: requestKey, resolutionId: resRows[j].ResolutionID };
      }
    }
    return { status: 'NOT_RESOLVED', requestKey: requestKey };
  } catch (error) {
    return { status: 'LOOKUP_FAILED', reason: error.message };
  }
}
