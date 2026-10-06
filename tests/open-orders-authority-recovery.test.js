'use strict';

var assert = require('assert');
var fs = require('fs');
var vm = require('vm');

var source = fs.readFileSync('195.View.Transactions.Actions.html', 'utf8');
var elements = Object.create(null), calls = [], authoritySuccess;
var context = {
  console: { error: function() {} },
  document: {
    getElementById: function(id) {
      if (!elements[id]) elements[id] = { innerText: '', textContent: '', value: '', appendChild: function() {} };
      return elements[id];
    },
    createElement: function() { return {}; }
  },
  google: { script: { run: {
    withSuccessHandler: function(handler) { this.success = handler; authoritySuccess = handler; return this; },
    withFailureHandler: function(handler) { this.failure = handler; return this; },
    getOperationalTransactionAuthority: function() {},
    listOpenOperationalOrders: function(payload) { calls.push(payload); this.success({ success: true, data: [] }); }
  } } },
  localStorage: { getItem: function() { return null; }, removeItem: function() {}, setItem: function() {} },
  Date: Date, Math: Math, JSON: JSON, Object: Object, Array: Array
};
vm.createContext(context);
vm.runInContext(source, context, { filename: '195.View.Transactions.Actions.html' });

function authority() {
  return { success: true, data: { products: [], productVariants: [], suppliers: [], purchaseItems: [], expenseItems: [], items: [], conversions: [], paymentMethods: [] } };
}

context.loadOperationalTransactionAuthority();
context.listOperationalOpenOrders();
assert.strictEqual(calls.length, 0, 'LOADING must not dispatch');
context.listOperationalOpenOrders();
assert.strictEqual(context.operationalTransactionState.pendingOpenOrdersRecovery, true, 'multiple requests coalesce');
authoritySuccess(authority());
assert.strictEqual(calls.length, 1, 'READY consumes once');
assert.strictEqual(elements.operationalOpenOrders.textContent, 'No open orders.', 'empty response renders');
authoritySuccess(authority());
assert.strictEqual(calls.length, 1, 'repeated READY does not duplicate');
context.listOperationalOpenOrders();
assert.strictEqual(calls.length, 2, 'READY refreshes immediately');
context.google.script.run.listOpenOperationalOrders = function() { calls.push({}); this.success({ success: false, error: { code: 'REFUSED', message: 'No' } }); };
context.listOperationalOpenOrders();
assert.strictEqual(calls.length, 3, 'post-READY refusal remains one dispatch');
context.loadOperationalTransactionAuthority();
context.listOperationalOpenOrders();
context.markOperationalAuthorityUnavailable('FAILURE_HANDLER');
assert.strictEqual(context.operationalTransactionState.pendingOpenOrdersRecovery, false, 'terminal unavailable clears pending');
assert.strictEqual(calls.length, 3, 'terminal unavailable does not retry');
context.operationalTransactionState.authority = authority().data;
context.operationalTransactionState.authorityStatus = 'READY';
context.google.script.run.listOpenOperationalOrders = function() { calls.push({}); this.success({ success: true, data: [{ OrderNumber: 'SO-1' }] }); };
context.listOperationalOpenOrders();
assert.strictEqual(elements.operationalOpenOrders.textContent, 'Open: SO-1', 'non-empty rendering preserved');
assert.ok(source.indexOf('submitOperational') !== -1 && source.indexOf('pendingOpenOrdersRecovery') !== -1, 'repair stays client-side; production mutation paths preserved');
console.log('PASS open-orders authority recovery: 8/8');
