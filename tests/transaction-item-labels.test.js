// Run: node tests/transaction-item-labels.test.js (synthetic DOM/RPC only).
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const baseline = cp.execFileSync('git', ['show', '58ae0c9:194.View.Transactions.Forms.html'], { encoding: 'utf8' });
const current = fs.readFileSync('194.View.Transactions.Forms.html', 'utf8');
const actions = fs.readFileSync('195.View.Transactions.Actions.html', 'utf8');
const removed = /        \/\/ U8B frozen contract:[\s\S]*?        button.addEventListener/;
assert.equal(current, baseline.replace(removed, '        button.addEventListener'));
function node() {
  return { value: '', innerText: '', children: [], attrs: {}, hidden: false,
    set innerHTML(v) { this.children = []; },
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(n) { this.children.push(n); },
    addEventListener(k, fn) { this[k] = fn; } };
}
function harness(source) {
  const entry = new Proxy({}, { get(o, k) { return o[k] || (o[k] = node()); } });
  const calls = [];
  const box = { console, document: { createElement: node, getElementById: () => node() },
    initializeStableDashboardElements: () => ({ transactionEntry: entry }),
    google: { script: { run: { withSuccessHandler() { return { withFailureHandler() {
      return { submitCanonicalTransaction: p => calls.push(JSON.parse(JSON.stringify(p))) };
    } }; } } } } };
  vm.createContext(box);
  vm.runInContext(source + '\n' + actions, box);
  vm.runInContext('transactionEntryState = createInitialTransactionEntryState();', box);
  for (const name of ['clearReceiptEntry', 'updateExpensePurchaseFields', 'updatePurchaseEntryFields', 'requestTransactionEntryPricing']) box[name] = () => {};
  box.receiptEntryElements = () => ({ expenseDate: { value: '2026-11-07' }, expenseDateError: node() });
  box.operationalRequestKey_ = () => 'synthetic-request';
  box.setSingleCommitClientMode_('ACTIVE');
  const options = [
    { expenseItemId: 'E1', item: 'Same name', category: 'Category A', group: 'Group A', kind: 'Kind A', costType: 'FIXED_COST', uom: 'kg', supplier: 'Supplier' },
    { expenseItemId: 'E2', item: 'Same name', category: 'Category B', group: 'Group B', kind: 'Kind B', costType: 'FIXED_COST' },
    { expenseItemId: 'E3', item: 'Other', category: 'Category A', group: 'Group A', kind: 'Kind A', costType: 'VARIABLE_COST' }
  ];
  box.transactionEntryState.entryOptions = { expenses: options, purchases: options, sales: [{ productId: 'P1', product: 'Coffee', category: 'Drink', kind: 'Sales' }] };
  return { box, entry, calls, options };
}
for (const source of [baseline, current]) {
  const { box: b, entry: e, calls, options } = harness(source);
  const before = JSON.stringify(options);
  for (const type of ['expense', 'purchase', 'product']) {
    b.renderEntryOptionList(type);
    const rows = e[type + 'Listbox'].children;
    assert.deepEqual(rows.map(x => x.innerText), type === 'product' ? ['Coffee'] : type === 'expense' ? ['Same name', 'Same name'] : ['Same name', 'Same name', 'Other']);
    assert.equal(rows[0].children.length, source === current || type === 'product' ? 0 : 1);
    rows[0].click();
    rows[1]?.click();
    assert.equal(b.transactionEntryState[type === 'product' ? 'selectedProduct' : type === 'purchase' ? 'selectedPurchase' : 'selectedExpense'], type === 'product' ? b.transactionEntryState.entryOptions.sales[0] : options[1]);
    b.renderEntryOptionList(type);
    assert.equal(e[type + 'Listbox'].children[type === 'product' ? 0 : 1].attrs['aria-selected'], 'true');
    if (type !== 'product') {
      e[type + 'Search'].value = 'Category B';
      assert.equal(b.getFilteredEntryOptions(type)[0], options[1]);
      e[type + 'Search'].value = '';
    }
  }
  assert.equal(JSON.stringify(options), before);
  const payloads = [];
  for (const type of ['EXPENSE', 'PURCHASE']) {
    const s = b.transactionEntryState;
    Object.assign(s, { transactionType: type, amount: 12000, purchaseQty: 2, purchaseTotal: 24000, purchaseUom: 'kg', purchaseSupplier: 'Supplier', submitting: false, submissionComplete: false });
    b.updateTransactionEntrySubmitState();
    assert.equal(e.submit.disabled, false);
    b.submitTransactionEntry({ preventDefault() {} });
    b.submitTransactionEntry({ preventDefault() {} });
    assert.equal(calls.length, payloads.length + 1, 'double submit blocked');
    payloads.push(calls.at(-1));
  }
  if (source === baseline) global.baselinePayloads = payloads;
  else assert.deepEqual(payloads, global.baselinePayloads);
  b.transactionEntryState.submitting = false;
  b.transactionEntryState.purchaseTotal = 0;
  b.updateTransactionEntrySubmitState();
  assert.equal(e.submit.disabled, true, 'zero total invalid');
  e.purchaseQty.value = '-1';
  b.updatePurchaseEntryQty();
  assert.equal(b.transactionEntryState.purchaseQty, null);
  e.purchaseTotal.value = '24.000';
  b.updatePurchaseEntryTotal();
  assert.equal(b.transactionEntryState.purchaseTotal, 24000);
}
console.log('PASS: name-only labels; Sales parity; duplicate IDs/selection; metadata/search/eligibility/order; calculation/validation; baseline-equal mocked Expense/Purchase payloads; double-submit guard.');
