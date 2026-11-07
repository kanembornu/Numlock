// Run: node tests/transaction-form-css.test.js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const css = fs.readFileSync('189.View.Tailwind.html', 'utf8');
const source = fs.readFileSync('assets/tailwind.input.css', 'utf8');
const root = postcss.parse(css);
for (const selector of ['#salesEntryFields>.transaction-sales-layout', '.transaction-sales-add-line', '.transaction-order-line', '.transaction-price-row', '#expenseEntryFields>.transaction-expense-layout', '#purchaseEntryFields>.transaction-purchase-layout', '.transaction-purchase-layout .transaction-entry-compact-value']) {
  assert(source.includes(selector), 'missing source: ' + selector);
  let found = false;
  root.walkRules(r => { if (r.selector === selector) found = true; });
  assert(found, 'missing generated rule: ' + selector);
}
const layouts = [];
root.walkRules(r => {
  if (r.selector === '#salesEntryFields>.transaction-sales-layout') layouts.push(r);
});
assert(layouts.some(r => r.parent.name === 'media' && r.parent.params.includes('1024px') && r.nodes.some(d => d.prop === 'grid-template-columns' && d.value.includes('1.2fr'))));
assert(!/data-theme\s*=\s*["']?dark/.test(css));
console.log('PASS: transaction layout source/generated selectors, Sales responsive grid, light-only CSS parse.');
