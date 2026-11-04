// Phase 11V.12: prospective management authority, never historical accounting authority.
var EXPENSE_PURCHASE_POLICY = (function() {
  var rows = [];
  function add(ids, cost, relationship, links) {
    ids.split(' ').forEach(function(id, index) {
      rows.push(Object.freeze({ expenseItemId: id, CostType: cost, PurchaseRelationship: relationship,
        labelAuthority: 'ExpenseItems.Item', inventoryItemIds: Object.freeze(links ? links[index] : []),
        prospectiveEligible: cost !== 'OTHER_HOLD', effectiveFrom: '2026-10-01', effectiveTo: null }));
    });
  }
  add('OSS01 OUS01 OUS02 OUS03 OUS04', 'FIXED_COST', 'NONE');
  add('OSK02 OSK05 OUR01 OEE01', 'VARIABLE_COST', 'NON_HPP_VARIABLE_COST');
  add('OUU01', 'OTHER_HOLD', 'NONE');
  add('OSK01 OSK03 OSK04 OSR02 OSR04 OSR05 OSR06 OSR18 OSR19 OSR20', 'VARIABLE_COST', 'DIRECT_HPP_COMPONENT',
    [['ING-011'], ['ING-020'], ['ING-021'], ['ING-006'], ['ING-018'], ['ING-015'], ['ING-016'], ['ING-019'], ['ING-009'], ['ING-010']]);
  add('OSR01 OSR03 OSR21', 'VARIABLE_COST', 'HPP_COST_POOL',
    [['ING-004', 'ING-005'], ['ING-007', 'ING-008'], ['ING-012', 'ING-013', 'ING-014']]);
  add('OSR07 OSR08 OSR09 OSR10 OSR11 OSR12 OSR13 OSR14 OSR15 OSR17', 'VARIABLE_COST', 'DIRECT_HPP_COMPONENT_PACKAGE_UNRESOLVED',
    Array.from({ length: 10 }, function() { return ['ING-017']; }));
  add('OSR16', 'VARIABLE_COST', 'HPP_COST_POOL_PACKAGE_UNRESOLVED');
  return Object.freeze({ version: 'EXPENSE-PURCHASE-POLICY-V1', revision: 1, enabled: true,
    effectiveFrom: '2026-10-01', timezone: 'Asia/Jakarta', activationEvent: null,
    evidenceRef: 'docs/evidence/finance-phase-11v12/SPEC.md', rows: Object.freeze(rows) });
})();

function validateExpensePurchasePolicy_(expenses, policy) {
  policy = policy || EXPENSE_PURCHASE_POLICY;
  var routes = Object.create(null), seen = Object.create(null);
  if (!policy.version || !policy.revision || !Array.isArray(policy.rows)) inventoryReceiptFail_('EXPENSE_POLICY_INVALID');
  policy.rows.forEach(function(row) {
    if (!row.expenseItemId || routes[row.expenseItemId] || !Array.isArray(row.inventoryItemIds) ||
        ['FIXED_COST', 'VARIABLE_COST', 'OTHER_HOLD'].indexOf(row.CostType) === -1 ||
        ['NONE', 'NON_HPP_VARIABLE_COST', 'DIRECT_HPP_COMPONENT', 'HPP_COST_POOL',
          'DIRECT_HPP_COMPONENT_PACKAGE_UNRESOLVED', 'HPP_COST_POOL_PACKAGE_UNRESOLVED'].indexOf(row.PurchaseRelationship) === -1 ||
        row.labelAuthority !== 'ExpenseItems.Item') inventoryReceiptFail_('EXPENSE_POLICY_CONFLICT');
    routes[row.expenseItemId] = row;
  });
  expenses.forEach(function(item) {
    var id = item.ID_Ops;
    if (!id || seen[id]) inventoryReceiptFail_('EXPENSE_ID_CONFLICT');
    seen[id] = true;
    if (isCanonicalActive(item.IsActive) && !routes[id]) inventoryReceiptFail_('EXPENSE_POLICY_COVERAGE_MISSING');
  });
  return routes;
}

function resolveExpensePurchasePolicy_(id, expenses) {
  if (typeof id !== 'string' || !id || id.trim() !== id) inventoryReceiptFail_('EXPENSE_ID_MALFORMED');
  var routes = validateExpensePurchasePolicy_(expenses);
  var item = expenses.filter(function(row) { return row.ID_Ops === id && isCanonicalActive(row.IsActive); })[0];
  if (!item || !routes[id]) inventoryReceiptFail_('EXPENSE_ITEM_NOT_ACTIVE_OR_MAPPED');
  if (!routes[id].prospectiveEligible) inventoryReceiptFail_('EXPENSE_ROUTE_HOLD');
  return routes[id];
}

// Version-pinned historical registry. V1 Rev1 immutable; future versions
// register here without changing the active prospective pointer.
// Historical events interpret under stored Version+Revision; prospective
// resolution uses EXPENSE_PURCHASE_POLICY (active) only.
var EXPENSE_PURCHASE_POLICY_REGISTRY_ = Object.create(null);
EXPENSE_PURCHASE_POLICY_REGISTRY_[EXPENSE_PURCHASE_POLICY.version + '|' + EXPENSE_PURCHASE_POLICY.revision] = EXPENSE_PURCHASE_POLICY;

function getExpensePurchasePolicy_(version, revision) {
  if (typeof version !== 'string' || !version || !Number.isSafeInteger(revision)) inventoryReceiptFail_('EXPENSE_POLICY_UNKNOWN_VERSION');
  var pinned = EXPENSE_PURCHASE_POLICY_REGISTRY_[version + '|' + revision];
  if (!pinned) inventoryReceiptFail_('EXPENSE_POLICY_UNKNOWN_VERSION');
  return pinned;
}

function registerExpensePurchasePolicy_(policy) {
  if (!policy || typeof policy.version !== 'string' || !policy.version ||
      !Number.isSafeInteger(policy.revision) || policy.revision < 1 || !Array.isArray(policy.rows)) {
    inventoryReceiptFail_('EXPENSE_POLICY_INVALID');
  }
  var key = policy.version + '|' + policy.revision;
  if (EXPENSE_PURCHASE_POLICY_REGISTRY_[key]) inventoryReceiptFail_('EXPENSE_POLICY_CONFLICT');
  EXPENSE_PURCHASE_POLICY_REGISTRY_[key] = Object.freeze(policy);
  return policy;
}

function resolveExpensePurchasePolicyVersioned_(id, expenses, version, revision) {
  if (typeof id !== 'string' || !id || id.trim() !== id) inventoryReceiptFail_('EXPENSE_ID_MALFORMED');
  var policy = getExpensePurchasePolicy_(version, revision);
  var routes = validateExpensePurchasePolicy_(expenses, policy);
  var item = expenses.filter(function(row) { return row.ID_Ops === id && isCanonicalActive(row.IsActive); })[0];
  if (!item || !routes[id]) inventoryReceiptFail_('EXPENSE_ITEM_NOT_ACTIVE_OR_MAPPED');
  if (!routes[id].prospectiveEligible) inventoryReceiptFail_('EXPENSE_ROUTE_HOLD');
  return routes[id];
}

// M3 prospective Purchase Policy V2 (SPEC-M3-AMENDMENT.md M3-L). Inactive
// local candidate only: 34 V1 rows byte-identical + three reserved rows
// (OSR22/23/24 → ING-017, prospectiveEligible, effectiveFrom = activation
// date). Never registered here; EXPENSE_PURCHASE_POLICY stays V1|1 active.
// Registration + pointer switch are separately authorized activation acts.
var EXPENSE_PURCHASE_POLICY_V2_RESERVED_ = Object.freeze([
  Object.freeze({ expenseItemId: 'OSR22', flavor: 'Cranberry' }),
  Object.freeze({ expenseItemId: 'OSR23', flavor: 'Kiwi' }),
  Object.freeze({ expenseItemId: 'OSR24', flavor: 'Apple' })
]);

function buildExpensePurchasePolicyV2_(activationDate) {
  if (typeof activationDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(activationDate) ||
      !isFinite(Date.parse(activationDate)) ||
      new Date(activationDate).toISOString().slice(0, 10) !== activationDate) {
    inventoryReceiptFail_('EXPENSE_POLICY_INVALID');
  }
  // Idempotent: always base on V1|1 registry (frozen 34), not live pointer (37 after activation), so builder stays 37.
  var base = EXPENSE_PURCHASE_POLICY_REGISTRY_['EXPENSE-PURCHASE-POLICY-V1|1'] || EXPENSE_PURCHASE_POLICY;
  var rows = base.rows.map(function(r) {
    return Object.freeze({ expenseItemId: r.expenseItemId, CostType: r.CostType,
      PurchaseRelationship: r.PurchaseRelationship, labelAuthority: r.labelAuthority,
      inventoryItemIds: Object.freeze(r.inventoryItemIds.slice()),
      prospectiveEligible: r.prospectiveEligible, effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo === undefined ? null : r.effectiveTo });
  }).concat(EXPENSE_PURCHASE_POLICY_V2_RESERVED_.map(function(r) {
    return Object.freeze({ expenseItemId: r.expenseItemId, CostType: 'VARIABLE_COST',
      PurchaseRelationship: 'DIRECT_HPP_COMPONENT_PACKAGE_UNRESOLVED',
      labelAuthority: 'ExpenseItems.Item', inventoryItemIds: Object.freeze(['ING-017']),
      prospectiveEligible: true, effectiveFrom: activationDate, effectiveTo: null });
  }));
  return Object.freeze({ version: 'EXPENSE-PURCHASE-POLICY-V2', revision: 1, enabled: false,
    effectiveFrom: activationDate, timezone: 'Asia/Jakarta', activationEvent: null,
    evidenceRef: 'docs/evidence/finance-phase-11v12/SPEC-M3-AMENDMENT.md', rows: Object.freeze(rows) });
}

// M3 COMBINED ACTIVATION (owner-authorized; placeholder filled at execution).
// Unfilled placeholder is inert: V1|1 stays seeded alone, pointer stays V1.
// Guard is shape-based (regex), NOT a literal comparison, so date substitution
// cannot neutralize it. A filled-but-malformed date throws at load via the
// builder (fail-closed, never silent). V1 object never mutated; V1|1 never touched.
// Release gate: valid only if production activation succeeds on 2026-10-19 Asia/Jakarta.
var M3_ACTIVATION_EFFECTIVE_FROM_ = '2026-10-19';
if (/^\d{4}-\d{2}-\d{2}$/.test(M3_ACTIVATION_EFFECTIVE_FROM_)) {
  var M3_V2_BASE_ = buildExpensePurchasePolicyV2_(M3_ACTIVATION_EFFECTIVE_FROM_);
  // Active pointer requires enabled:true (47:40-41 gating, 21:174 UI flag).
  // Registry and pointer share ONE object: no version|revision divergence.
  var M3_V2_ACTIVE_ = Object.freeze({ version: M3_V2_BASE_.version, revision: M3_V2_BASE_.revision, enabled: true,
    effectiveFrom: M3_V2_BASE_.effectiveFrom, timezone: M3_V2_BASE_.timezone, activationEvent: null,
    evidenceRef: M3_V2_BASE_.evidenceRef, rows: M3_V2_BASE_.rows });
  registerExpensePurchasePolicy_(M3_V2_ACTIVE_);
  EXPENSE_PURCHASE_POLICY = M3_V2_ACTIVE_;
}

function expensePolicyIsPurchase_(route) {
  return route.CostType === 'VARIABLE_COST' && route.PurchaseRelationship !== 'NON_HPP_VARIABLE_COST';
}
