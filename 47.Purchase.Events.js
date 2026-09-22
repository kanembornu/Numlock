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
      // Canonical boolean persistence: change IsActive cell from text format to General,
      // write boolean true, and verify readback. Text format coerces setValue(true) to string.
      var isActiveIdx = PURCHASE_EVENT_POLICY.headers.indexOf('IsActive');
      if (isActiveIdx !== -1 && row.IsActive === true) {
        if (!writeCanonicalBoolean_(sheet, sheet.getLastRow(), isActiveIdx + 1)) {
          inventoryReceiptFail_('ISACTIVE_BOOLEAN_PERSISTENCE_FAILED');
        }
      }
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
    if (match.EventID !== 'PE-' + requestKey || match.IsActive !== true || match.Lifecycle !== 'CAPTURED_OPERATIONAL') {
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

function readPurchaseEventTransactionRows_(ss) {
  if (!ss.getSheetByName(PURCHASE_EVENT_POLICY.sheet)) return [];
  var rows = readCanonicalTable(ss, PURCHASE_EVENT_POLICY.sheet, PURCHASE_EVENT_POLICY.headers);
  purchaseEventHistory_(rows);
  return rows.map(projectPurchaseEventTransaction_);
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
    predicates.lifecycleCorrect = row.Lifecycle === 'CAPTURED_OPERATIONAL';
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
      var normalized = normalizePurchaseEventRequest_(parsedPayload);
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
