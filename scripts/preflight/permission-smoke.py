#!/usr/bin/env python3
"""Runtime permission evaluation only; no provider, approval grants or production writes."""
import json
from pathlib import Path
import subprocess
from urllib.parse import urlencode
import uuid

ROOT = Path(__file__).resolve().parents[2]


def api(method, path, body=None, located=False):
    if located:
        path += '?' + urlencode({'location[directory]': str(ROOT)})
    command = ['opencode', 'api', method, path]
    if body is not None:
        command += ['--data', json.dumps(body)]
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError('OpenCode API failed; output suppressed')
    return json.loads(result.stdout) if result.stdout.strip() else None


def main():
    config = json.loads((ROOT / 'opencode.json').read_text())
    catalogue = api('get', '/api/agent', located=True)
    assert catalogue['location']['directory'] == str(ROOT)
    agent = next(a for a in catalogue['data'] if a['id'] == 'numlock')
    rules = agent['permissions']
    baseline = config['permissions']
    assert any(rules[i:i + len(baseline)] == baseline for i in range(len(rules)))
    document = api('get', '/openapi.json')
    schema = document['components']['schemas']['Permission.Rule']
    assert set(schema['required']) == {'action', 'resource', 'effect'}
    assert all(set(r) == set(schema['required']) and r['effect'] in ('allow', 'ask', 'deny')
               and all(isinstance(v, str) for v in r.values()) for r in baseline)
    session = api('post', '/api/session', {
        'title': 'NUMLOCK permission smoke ' + uuid.uuid4().hex,
        'agent': 'numlock', 'model': {'id': 'numlock-explore-free', 'providerID': '9router'},
        'location': {'directory': str(ROOT)}})['data']
    sid = session['id']
    assert session['location']['directory'] == str(ROOT) and not session.get('permissions')
    path = '/api/session/' + sid + '/permission'
    probes = [
        ('external_directory', '/usr/local/bin/*', 'allow'),
        ('external_directory', '/usr/local/lib/node_modules/@google/clasp/*', 'allow'),
        ('external_directory', '/Applications/Google Chrome.app/*', 'allow'),
        ('read', str(ROOT / 'AGENTS.md'), 'allow'),
        ('edit', str(ROOT / 'tests/tmp/permission-smoke/fixture.txt'), 'allow'),
        ('edit', '/usr/local/bin/clasp', 'deny'),
        ('edit', '/usr/local/lib/node_modules/@google/clasp/build/src/index.js', 'deny'),
        ('read', '/Users/azer/.clasprc.json', 'deny'),
        ('shell', 'clasp deployments', 'allow'),
        ('shell', 'git status --short', 'allow'),
        ('external_directory', '/unapproved-numlock-smoke/*', 'ask'),
        ('shell', 'clasp push --force', 'ask'),
        ('shell', 'rm -rf /unapproved-numlock-smoke', 'ask'),
    ]
    try:
        for action, resource, expected in probes:
            result = api('post', path, {'agent': 'numlock', 'action': action,
                                       'resources': [resource], 'save': []})['data']
            pending = api('get', path)['data']
            try:
                assert result['effect'] == expected, (action, resource, result['effect'])
                assert bool(pending) == (expected == 'ask')
                print(json.dumps({'action': action, 'resource': resource,
                                  'decision': result['effect'], 'pending_prompt': bool(pending),
                                  'operation_executed': False}))
            finally:
                for request in pending:
                    api('post', path + '/' + request['id'] + '/reply', {'decision': 'reject'})
        print('MEASURED: 13 runtime permission decisions; fresh numlock session; no grants.')
    finally:
        assert api('get', path)['data'] == []
        api('patch', '/api/session/' + sid, {'archived': True})


if __name__ == '__main__':
    main()
