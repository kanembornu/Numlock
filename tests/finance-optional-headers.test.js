// Run: node tests/finance-optional-headers.test.js (offline; no live RPC).
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const read = name => fs.readFileSync(name, 'utf8');
const index = read('190.View.Index.html');
const requiredIds = JSON.parse('[' + index.match(/var requiredIds = \[([\s\S]*?)\];/)[1] + ']');
const destinations = [
  ['profit-loss', 'Profit & Loss', 'Transaction-date operating statement', 'getFinanceData'],
  ['product-profitability', 'Product Profitability', 'Per-product revenue, COGS, and margin analysis', 'getProductProfitabilityData'],
  ['capital-equity', 'Capital & Equity', 'Owner capital and retained earnings as of the selected date', 'getFinanceData'],
  ['assets', 'Assets', 'Fixed-asset register and acquisition summary', 'getAssetsReadModel'],
  ['cash-flow', 'Cash Flow', 'Cash movements classified by activity type', 'getCashFlowData']
];
function fixture(title, context, missingHeading) {
  const nodes = Object.fromEntries(requiredIds.map(id => [id, {
    value: id === 'financeFilter' ? 'currentYear' : '', hidden: false,
    textContent: '', setAttribute() {}
  }]));
  if (title) nodes.utilityPageTitle = { textContent: '' };
  if (context) nodes.utilityPageContext = { textContent: '' };
  if (missingHeading) delete nodes.financeHeading;
  const calls = [];
  const sandbox = {
    nodes, console: { error() {} }, setTimeout() { return 1; }, clearTimeout() {},
    document: { getElementById: id => nodes[id] || null },
    google: { script: { run: { withSuccessHandler(success) {
      return { withFailureHandler(failure) {
        return new Proxy({}, { get: (_, method) => () => calls.push({ method, success, failure }) });
      } };
    } } } }
  };
  vm.createContext(sandbox);
  vm.runInContext(['199.View.Finance.State.html', '200.View.Finance.Render.html', '201.View.Finance.Controller.html'].map(read).join('\n'), sandbox);
  vm.runInContext('financeElementCache = nodes;', sandbox);
  return { nodes, calls, run: code => vm.runInContext(code, sandbox) };
}
let cases = 0;
for (const title of [false, true]) for (const context of [false, true]) {
  for (const [destination, heading, description, method] of destinations) {
    const f = fixture(title, context);
    f.run('setFinanceDestination(' + JSON.stringify(destination) + '); ensureFinanceData();');
    assert.equal(f.nodes.financeHeading.textContent, heading);
    if (title) assert.equal(f.nodes.utilityPageTitle.textContent, heading);
    if (context) assert.equal(f.nodes.utilityPageContext.textContent, description);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].method, method);
    assert.equal(f.run('financeState.loading'), true);
    f.calls[0].failure(new Error('synthetic RPC failure'));
    assert.equal(f.run('financeState.loading'), false);
    assert.equal(f.nodes.financeRetryButton.hidden, false);
    assert.match(f.run('financeState.error'), /Unable to load/);
    cases++;
  }
}
for (const [destination] of destinations) {
  const f = fixture(true, true, true);
  assert.throws(() => f.run('setFinanceDestination(' + JSON.stringify(destination) + '); ensureFinanceData();'), /Required Finance element missing: #financeHeading/);
  assert.equal(f.calls.length, 0);
  cases++;
}
console.log('PASS: ' + cases + ' optional-header/required-heading destination fixtures; real controller dispatch/loading/error paths.');
