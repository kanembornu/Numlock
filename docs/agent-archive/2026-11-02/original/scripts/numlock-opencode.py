#!/usr/bin/env python3
"""Bind the NUMLOCK location and verify its catalogue before the first prompt."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

BINARY = '/Users/azer/.opencode/bin/opencode'
ROOT = '/Users/azer/Documents/GitHub/Numlock'
AGENTS = ['numlock', 'numlock-browser', 'numlock-commit', 'numlock-critical',
          'numlock-explore', 'numlock-heavy', 'numlock-light', 'numlock-medium',
          'numlock-ops', 'numlock-sol']
PROBES = [('clasp --version', 'allow'),
          ('clasp status -u numlock-run', 'allow'),
          ('clasp versions -u numlock-run', 'allow'),
          ('clasp deployments -u numlock-run', 'allow'),
          ('clasp push --force -u numlock-run', 'ask'),
          ('clasp pull -u numlock-run', 'ask')]


def prepare(api, root):
    # agent.get alone does not materialize the configured catalogue in V2 2.2.1.
    api('agent.list', params=['location[directory]=' + root], discard=True)
    for agent in AGENTS:
        info = api('agent.get', params=['agentID=' + agent,
                                      'location[directory]=' + root])
        if info.get('location', {}).get('directory') != root:
            raise RuntimeError('Agent location mismatch: ' + agent)
        if info.get('data', {}).get('id') != agent:
            raise RuntimeError('Agent identity mismatch: ' + agent)
    session = api('session.create', {'agent': 'numlock',
                  'title': 'NUMLOCK verified startup', 'location': {'directory': root}})
    if session['data'].get('location', {}).get('directory') != root:
        raise RuntimeError('Session location mismatch')
    if session['data'].get('agent') != 'numlock':
        raise RuntimeError('Session agent mismatch')
    sid = session['data']['id']
    try:
        for agent in AGENTS:
            for command, expected in PROBES:
                decision = api('session.permission.create',
                               {'action': 'shell', 'resources': [command], 'agent': agent},
                               ['sessionID=' + sid])
                if decision['data']['effect'] != expected:
                    raise RuntimeError('Readiness failed: ' + agent + ' / ' + command)
    finally:
        # Clear audit-only ask requests; never grant them.
        api('session.interrupt', params=['sessionID=' + sid])
    return sid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', help='Optional explicit V2 server URL')
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('prompt', nargs='*')
    args = parser.parse_args()
    binary = Path(BINARY)
    if not binary.is_file() or not Path(ROOT, 'opencode.json').is_file():
        parser.error('NUMLOCK project or pinned V2 binary is unavailable')
    connection = ['--server', args.server] if args.server else []

    def api(op, data=None, params=(), discard=False):
        command = [BINARY, 'api', *connection, op]
        for param in params:
            command += ['--param', param]
        if data is not None:
            command += ['--data', json.dumps(data)]
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
        if result.returncode:
            # Do not dump server responses, which may contain sensitive data.
            raise RuntimeError(op + ' failed, exit ' + str(result.returncode))
        if discard:
            return None
        return json.loads(result.stdout) if result.stdout.strip() else None

    try:
        sid = prepare(api, str(Path(ROOT).resolve()))
    except Exception as error:
        print('BLOCKED_READINESS: ' + str(error), file=sys.stderr)
        return 78
    print('READY: 10 agents, 60 permission checks; no CLASP command executed.', flush=True)
    if args.check_only:
        return 0
    # The session carries the explicit project location; no PATH-based binary selection.
    if args.prompt:
        command = [BINARY, 'run', *connection, '--session', sid, '--', ' '.join(args.prompt)]
    else:
        command = [BINARY, *connection, '--session', sid, ROOT]
    os.chdir(ROOT)
    os.execv(BINARY, command)


if __name__ == '__main__':
    sys.exit(main())
