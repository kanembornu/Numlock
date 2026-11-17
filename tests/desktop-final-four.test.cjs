// Static regression only; rendered geometry/focus still requires external Chrome.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.env.NUMLOCK_INDEX || '190.View.Index.html', 'utf8');
const patch = source.split('/* Desktop reference parity; keep Dashboard and narrow-screen contracts unchanged. */')[1]?.split('@media (max-width: 767px)')[0];
assert(patch, 'Scoped desktop corrections missing');
for (const requirement of [
  'height: 44px !important; min-height: 44px !important;',
  'height: 42px !important;',
  'overflow-x: auto !important;',
  'outline: 2px solid var(--focus) !important;',
  'padding: 8px 20px;',
  'width: 38px; height: 38px; flex-basis: 38px;',
  'width: 50px; height: 50px; flex-basis: 50px;',
  'width: 32px; height: 32px; flex-basis: 32px;',
  'grid-template-rows: 18px minmax(32px, 1fr) auto;',
  'white-space: normal; overflow-wrap: anywhere;',
  'grid-template-columns: minmax(0, 1fr) max-content;',
  'flex: 1;'
]) assert(patch.includes(requirement), requirement);
assert(!patch.includes('#dashboardPanel'), 'Dashboard must remain unchanged');
assert(!patch.includes('position: absolute'), 'No absolute comparison placement');
const region = source.split('role="region" aria-label="Product Profitability KPIs"')[1].split('<div class="pp-toolbar')[0];
assert.equal((region.match(/class="hf-kpi-card /g) || []).length, 6);
assert.equal(new Set([...region.matchAll(/class="fas ([^"]+)"/g)].map(x => x[1])).size, 6);
assert.equal((region.match(/class="hf-kpi-comparison"/g) || []).length, 6);
console.log('Desktop final four static invariants PASS (not visual acceptance)');
