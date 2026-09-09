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

function expensePolicyIsPurchase_(route) {
  return route.CostType === 'VARIABLE_COST' && route.PurchaseRelationship !== 'NON_HPP_VARIABLE_COST';
}
