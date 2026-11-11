#!/usr/bin/env python3
"""Reconstructed verified startup; permission API only, never command execution.

--check-only creates an empty audit session, rejects its pending audit requests,
then archives that session. No provider prompt, shell API or approval grant.
This is a documented-contract reconstruction, not historical source parity.
"""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid
from urllib.parse import urlencode, urlsplit

ROOT = Path(__file__).resolve().parent.parent
BINARY = Path.home() / '.opencode/bin/opencode'
MODEL = {'id': 'numlock-explore-free', 'providerID': '9router'}
PROBES = (
    ('shell', 'pwd', 'allow'),
    ('shell', 'git status --short', 'allow'),
    ('shell', 'clasp status', 'allow'),
    ('shell', 'clasp push --force', 'ask'),
    ('shell', 'clasp version NUMLOCK', 'ask'),
    ('shell', 'clasp deploy --help', 'ask'),
    ('shell', 'clasp run validateFinanceProductionRuntime', 'ask'),
    ('shell', 'clasp pull --projectDir /tmp/numlock-startup --versionNumber 685', 'ask'),
    ('shell', 'git add file.js', 'ask'),
    ('shell', 'node example.js', 'ask'),
    ('read', 'AGENTS.md', 'allow'),
    ('read', '.env', 'deny'),
    ('read', '.clasp.json', 'ask'),
    ('edit', '.clasp.json', 'deny'),
    ('external_directory', '/outside/*', 'deny'),
    ('subagent', 'numlock-heavy', 'deny'),
)


class Hold(Exception):
    pass


def require(ok, label):
    if not ok:
        error = Hold(label)
        error.safe_reason = label
        raise error


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise Hold('invalid arguments')


def arguments(argv):
    parser = Parser(description=__doc__, allow_abbrev=False)
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('--server')
    parser.add_argument('--session')
    args = parser.parse_args(argv)
    if args.server:
        url = urlsplit(args.server)
        require(url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1', '::1')
                and url.username is None and url.password is None
                and url.path in ('', '/') and not url.query and not url.fragment,
                'server must be a credential-free loopback HTTP origin')
        require(url.port is not None and 0 < url.port < 65536, 'server port required')
    if args.session:
        require(re.fullmatch(r'ses_[A-Za-z0-9]+', args.session), 'invalid session ID')
    return args


def run(command, root=ROOT):
    result = subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=30)
    require(result.returncode == 0, 'local command failed; inspect CLI/configuration locally (output suppressed)')
    return result.stdout.strip()


def cli_check(root):
    version = run([str(BINARY), '--version'], root)
    match = re.fullmatch(r'opencode v2\.2\.(0|[1-9][0-9]*)', version)
    require(match is not None and int(match[1]) >= 5,
            'CLI release unsupported; require stable 2.2.x patch >=5, otherwise review compatibility')
    # Release eligibility is not trust: loaded configuration and live probes must pass too.
    help_text = run([str(BINARY), '--help'], root)
    api_help = run([str(BINARY), 'api', '--help'], root)
    for text, tokens in ((help_text, ('api', '--server', '--session', 'directory')),
                         (api_help, ('--data', '--server', 'method', 'path'))):
        for token in tokens:
            require(re.search(r'(?<![\w-])' + re.escape(token) + r'(?![\w-])', text),
                    'CLI capability missing: ' + token + '; review CLI compatibility before startup')


class API:
    def __init__(self, root, server):
        self.root = root
        self.server = server

    def call(self, method, path, body=None, location=False):
        # CLI supplies its own authentication; launcher never reads credentials.
        command = [str(BINARY), 'api']
        if self.server:
            command += ['--server', self.server]
        if location:
            path += '?' + urlencode({'location[directory]': str(self.root)})
        command += [method, path]
        if body is not None:
            command += ['--data', json.dumps(body)]
        text = run(command, self.root)
        return json.loads(text) if text else None


def local_check(root):
    require(Path(run(['git', 'rev-parse', '--show-toplevel'], root)).resolve() == root,
            'repository root mismatch')
    for name in ('AGENTS.md', 'opencode.json', '.opencode/agents/numlock.md'):
        require((root / name).is_file() and (root / name).resolve().is_relative_to(root),
                'missing or external contract file')
    run(['node', 'scripts/preflight/preflight.js'], root)
    cli_check(root)
    return json.loads((root / 'opencode.json').read_text())


def session_check(session, root, project, session_id=None):
    require(isinstance(session, dict), 'invalid session response')
    sid = session.get('id', '')
    require(isinstance(sid, str) and re.fullmatch(r'ses_[A-Za-z0-9]+', sid),
            'invalid runtime session ID')
    require(session_id is None or sid == session_id, 'session ID mismatch')
    require(session.get('location') == {'directory': str(root)}
            and session.get('projectID') == project and not session.get('subpath')
            and not session.get('parentID'), 'session repository mismatch')
    model = session.get('model', {})
    require(session.get('agent') == 'numlock'
            and {k: model.get(k) for k in MODEL} == MODEL
            and model.get('variant', 'default') == 'default',
            'session agent/model mismatch')
    require(not session.get('permissions'), 'session permission overrides')
    require(not session.get('time', {}).get('busy'), 'session busy')
    return sid


def owned_session(api, sid, token, root, project):
    session = api.call('get', '/api/session/' + sid)['data']
    session_check(session, root, project, sid)
    require(session.get('metadata', {}).get('numlockStartupAudit') == token
            and session.get('title') == 'NUMLOCK verified startup audit ' + token,
            'audit session ownership mismatch')


def cleanup_pending(api, sid, token, root, project, owned):
    owned_session(api, sid, token, root, project)
    path = '/api/session/' + sid + '/permission'
    items = api.call('get', path)['data']
    # Validate the complete set before mutation; never reject another request.
    for item in items:
        require(item.get('sessionID') == sid and item.get('id') in owned
                and (item.get('action'), item.get('resources')) == owned[item['id']],
                'audit permission ownership mismatch')
    for item in items:
        # V2.2.5 OpenAPI Permission.Reply: once | always | reject.
        # reject is denial, never approval. /interrupt only affects executions,
        # not standalone permission.create requests; do not rely on it.
        api.call('post', path + '/' + item['id'] + '/reply', {'decision': 'reject'})
    require(api.call('get', path)['data'] == [], 'pending audit permission remains')


def probe(api, sid, token, root, project, owned, action, resource, expected):
    owned_session(api, sid, token, root, project)
    path = '/api/session/' + sid + '/permission'
    require(api.call('get', path)['data'] == [], 'unexpected pre-existing audit permission')
    request_id = 'per_' + uuid.uuid4().hex
    owned[request_id] = (action, [resource])
    print('AUDIT request=' + request_id + ' session=' + sid, flush=True)
    pending = False
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        request = pool.submit(api.call, 'post', path, {
            'id': request_id, 'agent': 'numlock', 'action': action,
            'resources': [resource], 'save': []})
        try:
            deadline = time.monotonic() + 8
            pending = False
            while time.monotonic() < deadline:
                items = api.call('get', path)['data']
                if items:
                    require(len(items) == 1 and items[0].get('id') == request_id
                            and items[0].get('sessionID') == sid
                            and items[0].get('action') == action
                            and items[0].get('resources') == [resource],
                            'unexpected pending permission')
                    pending = True
                    break
                if request.done():
                    break
                time.sleep(0.05)
            if pending:
                require(expected == 'ask', 'unexpected permission ask')
            else:
                require(request.done(), 'permission probe timeout')
                result = request.result()
                require(result.get('data', {}).get('effect') == expected and expected != 'ask',
                        'permission decision mismatch')
        finally:
            cleanup_pending(api, sid, token, root, project, owned)
            try:
                request.result(timeout=30)
            except Hold:
                # Denial may surface as a CLI error; pending-list proof is separate.
                require(pending, 'permission request failed without pending decision')
        require(api.call('get', path)['data'] == [], 'pending audit permission remains')


def registered_agent(api, root):
    # A cold server can return its built-ins before publishing project agents.
    # Retry only a well-formed catalogue for this checkout with no NUMLOCK IDs.
    for delay in (0, 0.25, 0.5, 1, 2, 2):
        if delay:
            time.sleep(delay)
        catalogue = api.call('get', '/api/agent', location=True)
        require(isinstance(catalogue, dict), 'invalid agent catalogue')
        require(catalogue.get('location') == {'directory': str(root)}, 'agent location mismatch')
        data = catalogue.get('data')
        require(isinstance(data, list) and all(
            isinstance(entry, dict) and isinstance(entry.get('id'), str) and entry['id']
            for entry in data), 'invalid agent catalogue')
        agents = [entry for entry in data if entry['id'].startswith('numlock')]
        if agents:
            require(len(agents) == 1 and agents[0]['id'] == 'numlock',
                    'NUMLOCK registry mismatch: unexpected or duplicate agent')
            return agents[0]
    require(False, 'NUMLOCK registry mismatch: agent absent after readiness checks')


def verify(api, root, config, requested=None):
    location = api.call('get', '/api/location', location=True)
    require(location.get('directory') == str(root)
            and location.get('project', {}).get('directory') == str(root)
            and location.get('project', {}).get('canonical') == str(root),
            'runtime repository mismatch')
    project = location['project']['id']
    agent = registered_agent(api, root)
    text = (root / '.opencode/agents/numlock.md').read_text()
    prompt = text.split('---', 2)[2].strip()
    require(agent.get('mode') == 'primary' and agent.get('model') == MODEL
            and agent.get('system', '').strip() == prompt, 'loaded agent mismatch')
    rules = agent.get('permissions', [])
    baseline = config['permissions']
    require(any(rules[i:i + len(baseline)] == baseline for i in range(len(rules))),
            'loaded policy missing baseline')
    # Unique metadata + returned ID prove this invocation's ownership.
    token = uuid.uuid4().hex
    audit = api.call('post', '/api/session', {
        'title': 'NUMLOCK verified startup audit ' + token, 'agent': 'numlock',
        'metadata': {'numlockStartupAudit': token},
        'model': MODEL, 'location': {'directory': str(root)}})['data']
    sid = audit.get('id')
    require(isinstance(sid, str) and re.fullmatch(r'ses_[A-Za-z0-9]+', sid),
            'invalid created audit ID')
    owned = {}
    print('AUDIT session=' + sid + ' ownership=' + token, flush=True)
    try:
        owned_session(api, sid, token, root, project)
        for action, resource, expected in PROBES:
            probe(api, sid, token, root, project, owned, action, resource, expected)
        owned_session(api, sid, token, root, project)
        if requested:
            session_check(api.call('get', '/api/session/' + requested)['data'],
                          root, project, requested)
        return requested
    finally:
        cleanup_pending(api, sid, token, root, project, owned)
        owned_session(api, sid, token, root, project)
        api.call('patch', '/api/session/' + sid, {'archived': True})
        require(api.call('get', '/api/session/' + sid + '/permission')['data'] == [],
                'audit cleanup failed after archive')


def main(argv=None):
    stage = 'arguments'
    try:
        args = arguments(argv)
        stage = 'local configuration / CLI compatibility'
        config = local_check(ROOT)
        api = API(ROOT, args.server)
        stage = 'runtime configuration / permission audit'
        verify(api, ROOT, config, args.session)
        print('VERIFIED STARTUP: 16/16 permission probes; no commands executed.', flush=True)
        if args.check_only:
            return 0
        # Create a separate clean session; audit asks never contaminate user work.
        stage = 'launch session'
        sid = args.session
        if not sid:
            project = api.call('get', '/api/location', location=True)['project']['id']
            session = api.call('post', '/api/session', {
                'agent': 'numlock', 'model': MODEL,
                'location': {'directory': str(ROOT)}})['data']
            sid = session_check(session, ROOT, project)
        command = [str(BINARY)]
        if args.server:
            command += ['--server', args.server]
        command += ['--session', sid, str(ROOT)]
        os.chdir(ROOT)
        os.execv(str(BINARY), command)
    except (Hold, OSError, ValueError, KeyError, TypeError, IndexError, AttributeError,
            OverflowError, subprocess.SubprocessError, concurrent.futures.TimeoutError) as error:
        reason = getattr(error, 'safe_reason',
                         'command unavailable, timeout or incompatible response; inspect locally, do not bypass checks')
        print('HOLD [' + stage + ']: ' + reason
              + '; startup stopped; no model prompt sent. Exit 78.', file=sys.stderr)
        return 78


if __name__ == '__main__':
    sys.exit(main())
