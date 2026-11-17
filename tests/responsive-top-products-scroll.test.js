// Static responsive contract check for Dashboard Top Products.
// Cascades the two injected stylesheets in document order (189 base layer, then
// 190 bespoke layer). No browser, no rendering: this proves rule reachability,
// not visual acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.NUMLOCK_CANDIDATE_ROOT || path.resolve(__dirname, '..');
const FILES = ['189.View.Tailwind.html', '190.View.Index.html'];

function cssOf(file, root)
{
  const raw = fs.readFileSync(path.join(root || ROOT, file), 'utf8');
  const blocks = [...raw.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]);
  return blocks.length ? blocks.join('\n') : raw;
}

function parse(css)
{
  const rules = [];
  const stack = [];
  let prelude = '';
  let order = 0;

  for (let index = 0; index < css.length; index += 1)
  {
    const char = css[index];

    if (char === '{')
    {
      const head = prelude.trim();
      prelude = '';

      if (head.startsWith('@'))
      {
        stack.push(head);
        continue;
      }

      let depth = 1;
      let cursor = index + 1;
      while (cursor < css.length && depth > 0)
      {
        if (css[cursor] === '{') depth += 1;
        else if (css[cursor] === '}') depth -= 1;
        cursor += 1;
      }

      rules.push({order: order++, at: stack.slice(), selector: head, body: css.slice(index + 1, cursor - 1)});
      index = cursor - 1;
      continue;
    }

    if (char === '}')
    {
      stack.pop();
      prelude = '';
      continue;
    }

    if (char === ';' && !prelude.trim().startsWith('@')) { prelude = ''; continue; }
    prelude += char;
  }

  return rules;
}

// Width-only media queries are evaluated; height/print/prefers conditions are not
// viewport-width evidence, so such rules are excluded from this contract.
function widthApplies(rule, width)
{
  for (const condition of rule.at)
  {
    if (!condition.startsWith('@media')) continue;
    if (/(height|print|prefers|hover|orientation|resolution)/.test(condition)) return false;
    const min = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(condition);
    const max = /max-width:\s*(\d+(?:\.\d+)?)px/.exec(condition);
    if (min && width < Number(min[1])) return false;
    if (max && width > Number(max[1])) return false;
    if (!min && !max) return false;
  }
  return true;
}

function declarations(rule)
{
  return rule.body.split(';').map(part => part.trim()).filter(Boolean).map(part =>
  {
    const split = part.indexOf(':');
    if (split < 0) return null;
    return {
      prop: part.slice(0, split).trim().toLowerCase(),
      value: part.slice(split + 1).replace(/!important/i, '').trim().toLowerCase(),
      important: /!important/i.test(part)
    };
  }).filter(Boolean);
}

const rules = FILES.flatMap(file => parse(cssOf(file)));

function effective(prop, matches, width, isPhone)
{
  let winner = null;
  for (const rule of rules)
  {
    const phoneScoped = /numlock-phone/.test(rule.selector);
    if (isPhone === false && phoneScoped) continue;
    if (isPhone === true && !phoneScoped && /numlock-phone/.test(rule.selector)) continue;
    if (!matches(rule.selector)) continue;
    if (!widthApplies(rule, width)) continue;
    for (const decl of declarations(rule))
    {
      if (decl.prop !== prop) continue;
      if (winner && winner.important && !decl.important) continue;
      winner = {value: decl.value, important: decl.important, selector: rule.selector, order: rule.order, at: rule.at};
    }
  }
  return winner;
}

const isWrapper = selector => /#topProductWrapper/.test(selector);
const isTopProductsTable = selector => /\.hf-top-products-table/.test(selector);
const toPx = value => /^(\d+(?:\.\d+)?)px$/.exec(value) ? Number(RegExp.$1) : null;

// 1. Wherever a forced minimum width is applied at narrow widths, a scroll container
//    must be reachable without the phone class (375/390 are the mobile contract).
for (const width of [375, 390])
{
  const minWidth = toPx((effective('min-width', isTopProductsTable, width, false) || {}).value || '');
  assert.ok(minWidth && minWidth >= 320, `forced min-width present at ${width}px: ${minWidth}`);

  const overflow = effective('overflow-x', isWrapper, width, false);
  assert.ok(overflow, `scroll container declared for #topProductWrapper at ${width}px`);
  assert.ok(['auto', 'scroll'].includes(overflow.value), `scroll container available at ${width}px: ${overflow.value}`);
  assert.ok(!/numlock-phone/.test(overflow.selector), `scroll container independent of html.numlock-phone at ${width}px: ${overflow.selector}`);
}

// 2. Touch/phone devices keep the capability (no regression to the phone path).
for (const width of [375, 390])
{
  const overflow = effective('overflow-x', isWrapper, width, true);
  assert.ok(['auto', 'scroll'].includes(overflow.value), `phone-class scroll capability at ${width}px: ${overflow.value}`);
}

// 3. Base-layer tablet contract is preserved at 768-1023 (no phone class needed).
for (const width of [768, 820, 1023])
{
  const overflow = effective('overflow-x', isWrapper, width, false);
  assert.ok(overflow && ['auto', 'scroll'].includes(overflow.value), `tablet scroll container at ${width}px`);
}

// 4. No responsive change at >=1024: the wrapper must not become a scroll container,
//    and no forced minimum width may survive the desktop breakpoint.
const BASE_TABLE_MIN = 320;
for (const width of [1024, 1280, 1440])
{
  const overflow = effective('overflow-x', isWrapper, width, false);
  assert.ok(!overflow || overflow.value === 'visible', `desktop wrapper is not a scroll container at ${width}px: ${overflow && overflow.value}`);
  const minWidth = toPx(((effective('min-width', isTopProductsTable, width, false) || {}).value || '0px'));
  assert.ok(minWidth === null || minWidth <= BASE_TABLE_MIN, `no forced table width at ${width}px: ${minWidth}`);
}

// 5. No newly masked document-shell overflow: shell masking declarations must be a
//    subset of the immutable v808 baseline (asserted only when that baseline exists).
const BASELINE_ROOT = path.join(__dirname, 'tmp', 'v808-r02', 'candidate');

function shellMasking(list)
{
  const shell = /^(html|body|#appShell|#mainContent)$|^#appShell,#mainContent,body,html$/;
  return list
    .filter(rule => !/numlock-phone/.test(rule.selector))
    .filter(rule => shell.test(rule.selector.trim()))
    .flatMap(rule => declarations(rule)
      .filter(decl => decl.prop === 'overflow-x' && ['clip', 'hidden'].includes(decl.value))
      .map(decl => `${rule.selector}|${decl.value}|${rule.at.join(' ')}`));
}

if (fs.existsSync(path.join(BASELINE_ROOT, FILES[0])))
{
  const baselineRules = FILES.flatMap(file => parse(cssOf(file, BASELINE_ROOT)));
  const allowed = new Set(shellMasking(baselineRules));
  const added = shellMasking(rules).filter(entry => !allowed.has(entry));
  assert.deepEqual(added, [], `no new document-shell overflow masking: ${added.join('; ')}`);
}

// 6. Finance rules must not reach the Top Products contract.
const financeLeak = rules.find(rule =>
  /finance/i.test(rule.selector) && (isWrapper(rule.selector) || isTopProductsTable(rule.selector)));
assert.equal(financeLeak, undefined, `no Finance rule targeting Top Products: ${financeLeak && financeLeak.selector}`);

console.log('Top Products responsive scroll contract PASS: 375/390 forced width has a phone-independent scroll container, phone path preserved, 768-1023 tablet container intact, >=1024 unchanged, no shell masking, no Finance leak');
