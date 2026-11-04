#!/usr/bin/env node
// Read-only repository policy checks; no shell, network or writes.
// Contract model only: not OpenCode runtime, scanner or isolation proof.
'use strict';
const fs = require('fs');
const path = require('path');

const MODEL = '9router/numlock-explore-free';
const SPECIALISTS = [
  'numlock-explore', 'numlock-light', 'numlock-medium', 'numlock-heavy',
  'numlock-critical', 'numlock-commit', 'numlock-ops', 'numlock-browser'
];
const NAMES = ['numlock', ...SPECIALISTS];
const rule = (action, resource, effect) => ({ action, resource, effect });
const BASELINE = [
  rule('*', '*', 'ask'),
  ...['read', 'glob', 'grep', 'question', 'skill'].map(a => rule(a, '*', 'allow')),
  ...[
    '*.env', '*.env.*', '*.clasprc.json', '*credentials*',
    '*token*.json', '*auth.json', '*.pem', '*.key'
  ].map(p => rule('read', p, 'deny')),
  rule('read', '*.clasp.json', 'ask'),
  rule('external_directory', '*', 'deny'),
  rule('subagent', '*', 'deny'),
  rule('webfetch', '*', 'deny'),
  rule('websearch', '*', 'deny'),
  ...[
    'pwd', 'git status', 'git status --short',
    'git diff --check', 'git rev-parse HEAD',
    'git diff *', 'git log *', 'git rev-parse *',
    'node --check *', 'node --test *', 'node _test_runner.js',
    'node _test_runner.js *', 'node scripts/preflight.js',
    'node scripts/preflight.js *', 'node scripts/runtime-preflight.js',
    'node scripts/runtime-preflight.js *'
  ].map(p => rule('shell', p, 'allow')),
  rule('shell', 'clasp *', 'deny'),
  ...[
    'clasp status', 'clasp status *',
    'clasp versions', 'clasp versions *',
    'clasp deployments', 'clasp deployments *',
    'clasp pull *',
    'clasp push *', 'clasp version *', 'clasp deploy *',
    'clasp run *', 'clasp logs *'
  ].map(p => rule('shell', p, 'allow'))
];

function overrides(name) {
  if (name === 'numlock') return SPECIALISTS.map(n => rule('subagent', n, 'ask'));
  const result = [];
  if (['numlock-explore', 'numlock-commit', 'numlock-ops', 'numlock-browser'].includes(name)) {
    result.push(rule('edit', '*', 'deny'));
  }
  if (['numlock-critical', 'numlock-ops'].includes(name)) {
    result.push(rule('shell', 'clasp *', 'ask'));
    result.push(rule('shell', 'clasp status', 'allow'));
    result.push(rule('shell', 'clasp status *', 'allow'));
    result.push(rule('shell', 'clasp versions', 'allow'));
    result.push(rule('shell', 'clasp versions *', 'allow'));
    result.push(rule('shell', 'clasp deployments', 'allow'));
    result.push(rule('shell', 'clasp deployments *', 'allow'));
    result.push(rule('shell', 'clasp pull *', 'allow'));
    result.push(rule('shell', 'clasp push *', 'allow'));
    result.push(rule('shell', 'clasp version *', 'allow'));
    result.push(rule('shell', 'clasp deploy *', 'allow'));
    result.push(rule('shell', 'clasp run *', 'allow'));
    result.push(rule('shell', 'clasp logs *', 'allow'));
  }
  return result;
}

// Mirrors v2.0.30 util/wildcard.ts; does not parse shell commands.
function match(input, pattern, platform = process.platform) {
  const normalized = input.replaceAll('\\', '/');
  let escaped = pattern.replaceAll('\\', '/')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*').replace(/\?/g, '.');
  if (escaped.endsWith(' .*')) escaped = escaped.slice(0, -3) + '( .*)?';
  return new RegExp('^' + escaped + '$', platform === 'win32' ? 'si' : 's').test(normalized);
}

function evaluate(action, resource, ...sets) {
  const rules = sets.flat();
  for (let i = rules.length - 1; i >= 0; i--) {
    if (match(action, rules[i].action) && match(resource, rules[i].resource)) {
      return rules[i].effect;
    }
  }
  return 'ask';
}

// Models configured-deny protection against saved allow approvals.
// Omits hooks and hard policies; callers must not claim effective runtime parity.
function decision(action, resources, configured, saved = []) {
  if (resources.some(r => evaluate(action, r, configured) === 'deny')) return 'deny';
  return resources.some(r => evaluate(action, r, configured, saved) === 'ask')
    ? 'ask' : 'allow';
}

// Repository format guard: inline JSON permissions only, not a YAML validator.
function frontmatter(text) {
  const found = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!found) throw new Error('missing frontmatter');
  const result = {};
  for (const line of found[1].split('\n')) {
    const item = line.match(/^([a-z_]+): (.+)$/);
    if (!item || Object.prototype.hasOwnProperty.call(result, item[1])) {
      throw new Error('unsupported or duplicate frontmatter');
    }
    result[item[1]] = item[1] === 'permissions' ? JSON.parse(item[2]) : item[2];
  }
  return result;
}

function inspect(root) {
  const failures = [];
  const check = (name, ok) => { if (!ok) failures.push(name); };
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'opencode.json'), 'utf8'));
    check('shared-policy', JSON.stringify(cfg.permissions) === JSON.stringify(BASELINE));
    check('no-conflicting-sources', [
      'permission', 'tools', 'agent', 'agents', 'mode', 'policies'
    ].every(k => !Object.prototype.hasOwnProperty.call(cfg, k)));
    const models = Object.keys(((cfg.provider || {})['9router'] || {}).models || {});
    check('single-project-route', models.length === 1 &&
      models[0] === 'numlock-explore-free' && cfg.model === MODEL &&
      cfg.small_model === MODEL && cfg.default_agent === 'numlock' &&
      JSON.stringify(cfg.enabled_providers) === '["9router"]');
    const dir = path.join(root, '.opencode', 'agents');
    const files = fs.readdirSync(dir).filter(n => n.endsWith('.md')).sort();
    check('exact-registry', JSON.stringify(files) ===
      JSON.stringify(NAMES.map(n => n + '.md').sort()));
    for (const name of NAMES) {
      try {
        const fm = frontmatter(fs.readFileSync(path.join(dir, name + '.md'), 'utf8'));
        check('frontmatter:' + name, JSON.stringify(Object.keys(fm).sort()) ===
          JSON.stringify(['description', 'mode', 'model', 'permissions'].sort()));
        check('registry:' + name, fm.model === MODEL &&
          fm.mode === (name === 'numlock' ? 'primary' : 'subagent') &&
          typeof fm.description === 'string' && fm.description.length > 0);
        check('profile-policy:' + name,
          JSON.stringify(fm.permissions) === JSON.stringify(overrides(name)));
      } catch (e) {
        failures.push('agent:' + name + ':' + e.message);
      }
    }
  } catch (e) {
    failures.push('configuration:' + e.message);
  }
  return failures;
}

if (require.main === module) {
  const failures = inspect(path.resolve(__dirname, '..'));
  for (const failure of failures) console.log('FAIL ' + failure);
  console.log('STATIC PREFLIGHT: ' + (failures.length ? 'FAIL' : 'PASS'));
  console.log('Effective permissions, scanner, approvals and isolation: UNKNOWN.');
  process.exitCode = failures.length ? 1 : 0;
}

module.exports = {
  MODEL, SPECIALISTS, NAMES, BASELINE, rule, overrides,
  match, evaluate, decision, frontmatter, inspect
};
