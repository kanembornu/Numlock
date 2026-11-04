'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const {
  NAMES, BASELINE, rule, overrides, match, evaluate,
  decision, frontmatter, inspect
} = require('./preflight');

const repo = path.resolve(__dirname, '../..');

function fixture(mutate, cli = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'numlock-preflight-test-'));
  try {
    fs.mkdirSync(path.join(dir, '.opencode', 'agents'), { recursive: true });
    fs.cpSync(path.join(repo, '.opencode', 'agents'),
      path.join(dir, '.opencode', 'agents'), { recursive: true });
    const cfg = JSON.parse(fs.readFileSync(path.join(repo, 'opencode.json'), 'utf8'));
    mutate(cfg, dir);
    fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify(cfg));
    if (!cli) return inspect(dir);
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.copyFileSync(path.join(repo, 'scripts/preflight/preflight.js'),
      path.join(dir, 'scripts/preflight.js'));
    return cp.spawnSync(process.execPath, ['scripts/preflight.js'], {
      cwd: dir, encoding: 'utf8', timeout: 5000
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function alterAgent(dir, name, mutate) {
  const file = path.join(dir, '.opencode', 'agents', name + '.md');
  const text = fs.readFileSync(file, 'utf8');
  const fm = frontmatter(text);
  mutate(fm.permissions);
  fs.writeFileSync(file, text.replace(/^permissions: .+$/m,
    'permissions: ' + JSON.stringify(fm.permissions)));
}

test('repository matches the complete policy contract', () => {
  assert.deepEqual(fixture(() => {}), []);
});

test('CLI preserves success and rejection exit contracts', () => {
  const good = fixture(() => {}, true);
  assert.equal(good.error, undefined);
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /STATIC PREFLIGHT: PASS/);
  const bad = fixture(cfg => {
    cfg.permissions.push(rule('shell', '*', 'allow'));
  }, true);
  assert.equal(bad.error, undefined);
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /FAIL shared-policy/);
});

for (const [name, mutate, failure] of [
  ['shared shell auto-allow', cfg => {
    cfg.permissions.push(rule('shell', '*', 'allow'));
  }, 'shared-policy'],
  ['broad interpreter auto-allow', cfg => {
    cfg.permissions.push(rule('shell', 'node *', 'allow'));
  }, 'shared-policy'],
  ['broad Git auto-allow', cfg => {
    cfg.permissions.push(rule('shell', 'git branch*', 'allow'));
  }, 'shared-policy'],
  ['obsolete substring denial', cfg => {
    cfg.permissions.push(rule('shell', '*clasp*', 'deny'));
  }, 'shared-policy'],
  ['missing sensitive edit denial', cfg => {
    cfg.permissions.pop();
  }, 'shared-policy'],
  ['sensitive read auto-allow', cfg => {
    cfg.permissions.push(rule('read', '*.env', 'allow'));
  }, 'shared-policy'],
  ['external access auto-allow', cfg => {
    cfg.permissions.push(rule('external_directory', '*', 'allow'));
  }, 'shared-policy'],
  ['legacy permission source', cfg => {
    cfg.permission = { bash: 'allow' };
  }, 'no-conflicting-sources'],
  ['extra inline agent override', cfg => {
    cfg.agents = { numlock: { permissions: [rule('shell', '*', 'allow')] } };
  }, 'no-conflicting-sources'],
  ['extra model route', cfg => {
    cfg.provider['9router'].models.extra = {};
  }, 'single-project-route']
]) {
  test('rejects ' + name, () => {
    assert.ok(fixture(mutate).includes(failure));
  });
}

for (const name of NAMES) {
  test('rejects auto-allow regression in ' + name, () => {
    const failures = fixture((cfg, dir) => {
      alterAgent(dir, name, rules => rules.push(rule('shell', '*', 'allow')));
    });
    assert.ok(failures.includes('profile-policy:' + name));
  });
}

test('rejects duplicate frontmatter', () => {
  assert.throws(() => frontmatter('---\nmode: primary\nmode: subagent\n---\n'));
});

test('wildcards match full text, slash, newline and optional arguments', () => {
  assert.equal(match('node file.js', 'node'), false);
  assert.equal(match('a/b\nc', '*'), true);
  assert.equal(match('abc', 'a?c'), true);
  assert.equal(match('clasp', 'clasp *'), true);
  assert.equal(match('CLASP push', 'clasp *', 'win32'), true);
});

test('filename collision removed without automatically allowing comparison', () => {
  const command = 'node -e \'JSON.parse(require("fs").readFileSync(".clasp.json"))\'';
  assert.equal(match(command, '*clasp*'), true);
  assert.equal(evaluate('shell', command, BASELINE), 'ask');
  assert.equal(evaluate('read', '.clasp.json', BASELINE), 'ask');
  assert.equal(evaluate('read', '10.Config.js', BASELINE), 'allow');
});

test('sensitive read resources match deny rules; no confidentiality proof', () => {
  for (const resource of [
    '.env', 'nested/.env.local', '.clasprc.json',
    'private/credentials.json', 'private/token.json',
    'private/auth.json', 'private/key.pem', 'private/client.key'
  ]) {
    assert.equal(evaluate('read', resource, BASELINE), 'deny', resource);
  }
});

test('primary retains local editing capability', () => {
  const failures = fixture((cfg, dir) => {
    alterAgent(dir, 'numlock',
      rules => rules.push(rule('edit', '*', 'deny')));
  });
  assert.ok(failures.includes('profile-policy:numlock'));
});

test('sensitive read and edit are denied; search has a separate resource contract', () => {
  assert.equal(evaluate('read', 'private/credentials.json', BASELINE), 'deny');
  assert.equal(evaluate('grep', 'example-pattern', BASELINE), 'allow');
  assert.equal(evaluate('glob', '**/*', BASELINE), 'allow');
  assert.equal(evaluate('edit', 'private/credentials.json', BASELINE), 'deny');
});

test('read-only clasp is allowed; writes and execution require approval', () => {
  for (const name of NAMES) {
    for (const command of [
      'clasp status', 'clasp deployments', 'clasp versions',
      'clasp status --json', 'clasp versions --json', 'clasp deployments --json',
      'clasp pull --projectDir /tmp/x', 'clasp push --force',
      'clasp version NUMLOCK', 'clasp deploy --help',
      'clasp run validateFinanceProductionRuntime', 'clasp logs --json'
    ]) {
      const expected = /^clasp (status|versions|deployments|logs)( |$)/.test(command) ? 'allow' : 'ask';
      assert.equal(evaluate('shell', command, BASELINE, overrides(name)), expected,
        name + ': ' + command);
    }
    const expected = 'ask';
    for (const command of [
      'clasp', 'clasp clone project',
      'clasp update-deployment example -V 1'
    ]) {
      assert.equal(evaluate('shell', command, BASELINE, overrides(name)),
        expected, name + ': ' + command);
    }
  }
});

test('wrapped text remains approval-gated without claiming scanner parity', () => {
  for (const command of [
    'npx clasp push', '/usr/local/bin/clasp push',
    'sh -c "clasp push"', 'env clasp push',
    'node -e "require(\'child_process\').spawnSync(\'clasp\',[\'push\'])"'
  ]) {
    for (const name of NAMES) {
      assert.equal(evaluate('shell', command, BASELINE, overrides(name)), 'ask');
    }
  }
});

test('Git mutations and mutable scripts never auto-allow', () => {
  for (const command of [
    'git add file.js', 'git commit -m example', 'git push',
    'git reset --hard', 'git clean -fd', 'git checkout other',
    'git stash', 'git branch new', 'npm install',
    'python example.py'
  ]) {
    for (const name of NAMES) {
      assert.equal(evaluate('shell', command, BASELINE, overrides(name)), 'ask');
    }
  }
});

test('routine read-only inspections auto-allow; writes remain gated', () => {
  const allows = [
    'pwd', 'git status', 'git status --short', 'git diff --check',
    'git rev-parse HEAD', 'git diff HEAD', 'git log --oneline',
    'git rev-parse --abbrev-ref HEAD',
    'node --check file.js', 'node --test scripts/preflight/test.js',
    'node _test_runner.js', 'node _test_runner.js --watch',
    'node scripts/preflight/index.js',
    'clasp status', 'clasp versions', 'clasp deployments',
    'clasp status --json', 'clasp versions --json',
    'clasp logs --json'
  ];
  for (const command of allows) {
    assert.equal(evaluate('shell', command, BASELINE), 'allow', command);
    for (const name of NAMES) {
      assert.equal(evaluate('shell', command, BASELINE, overrides(name)), 'allow',
        name + ': ' + command);
    }
  }
  // Least-privilege means bare clasp / unknown subcommands remain gated by overrides
  for (const command of [
    'clasp', 'clasp clone project',
    'clasp update-deployment example -V 1'
  ]) {
    assert.equal(evaluate('shell', command, BASELINE), 'ask', command);
  }
});

test('compound resource aggregation denies or asks without running commands', () => {
  assert.equal(decision('shell', ['pwd', 'clasp clone project'], BASELINE), 'ask');
  assert.equal(decision('shell', ['pwd', 'node example.js'], BASELINE), 'ask');
  assert.equal(decision('shell', ['pwd', 'git status'], BASELINE), 'allow');
  assert.equal(evaluate('shell', 'pwd && node example.js', BASELINE), 'ask');
});

test('edits, delegation and external boundaries are explicit', () => {
  for (const name of NAMES) {
    const readonly = ['numlock-explore', 'numlock-commit', 'numlock-ops',
      'numlock-browser'].includes(name);
    assert.equal(evaluate('edit', 'file.js', BASELINE, overrides(name)),
      readonly ? 'deny' : 'allow');
    assert.equal(evaluate('external_directory', '/outside/*',
      BASELINE, overrides(name)), 'deny');
    assert.equal(evaluate('subagent', 'numlock-light', BASELINE, overrides(name)),
      'deny');
  }
});

test('saved approvals cannot defeat configured credential or delegation denies', () => {
  const saved = [rule('*', '*', 'allow')];
  assert.equal(decision('read', ['private/credentials.json'], BASELINE, saved), 'deny');
  assert.equal(decision('edit', ['.clasp.json'], BASELINE, saved), 'deny');
  assert.equal(decision('subagent', ['numlock-heavy'], BASELINE, saved), 'deny');
  assert.equal(decision('shell', ['node example.js'], BASELINE, saved), 'allow');
});

test('rejects restoration of a retired project agent', () => {
  assert.ok(fixture((cfg, dir) => {
    fs.copyFileSync(path.join(dir, '.opencode/agents/numlock.md'),
      path.join(dir, '.opencode/agents/numlock-heavy.md'));
  }).includes('exact-registry'));
});

test('all former diagnostic entrypoints remain gated rather than removed', () => {
  for (const name of ['runInventoryPolicyEvidenceDiagnostic', 'runCashProductionDiagnostic',
    'validateFinanceProductionRuntime', 'runMonetaryOpeningBoundedReadDiagnostic',
    'runTabopsDictionaryBoundedReadDiagnostic', 'runMonetaryOpeningEvidenceCompletionDiagnostic']) {
    assert.equal(evaluate('shell', 'clasp run ' + name, BASELINE), 'ask');
  }
  assert.equal(evaluate('shell', 'clasp pull --projectDir /tmp/numlock-a --versionNumber 685', BASELINE), 'ask');
});
