#!/usr/bin/env python3
"""Run: python3 -B scripts/numlock-opencode.test.py (stdlib only)."""
import concurrent.futures
import importlib.util
import io
import json
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('launcher', Path(__file__).with_name('numlock-opencode.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class FakeAPI:
    def __init__(self, effect=None, stuck=False, mismatch=False, fail=False):
        self.calls = []
        self.pending = []
        self.effect = effect
        self.stuck = stuck
        self.mismatch = mismatch
        self.fail = fail
        self.future = concurrent.futures.Future()

    def call(self, method, path, body=None, **kwargs):
        self.calls.append((method, path, body))
        if method == 'get' and path == '/api/session/ses_test':
            return {'data': {'id': 'ses_test', 'location': {'directory': str(m.ROOT)},
                            'projectID': 'project', 'agent': 'numlock', 'model': m.MODEL,
                            'title': 'NUMLOCK verified startup audit token',
                            'metadata': {'numlockStartupAudit': 'wrong' if self.mismatch else 'token'}}}
        if method == 'post' and path.endswith('/permission'):
            expected = next(e for a, r, e in m.PROBES
                            if a == body['action'] and r == body['resources'][0])
            effect = self.effect or expected
            if effect == 'ask':
                self.future = concurrent.futures.Future()
                self.pending = [{'id': body['id'], 'sessionID': 'ses_test',
                                 'action': body['action'], 'resources': body['resources']}]
                return self.future.result(timeout=1)
            return {'data': {'effect': effect}}
        if method == 'get' and path.endswith('/permission'):
            return {'data': self.pending}
        if path.endswith('/reply'):
            assert body == {'decision': 'reject'}
            if not self.stuck and not self.fail:
                self.pending = []
            if not self.future.done():
                self.future.set_result({'data': {'effect': 'deny'}})
            if self.fail:
                raise m.Hold('cleanup failed')
            return None
        raise AssertionError((method, path, body))


class VerificationAPI(FakeAPI):
    def __init__(self, config, catalogues=(), **kwargs):
        super().__init__(**kwargs)
        self.config = config
        self.catalogues = iter(catalogues)
        self.catalogue_reads = 0
        self.token = None
        self.archived = False

    def call(self, method, path, body=None, **kwargs):
        if path == '/api/location':
            return {'directory': str(m.ROOT), 'project': {
                'id': 'project', 'directory': str(m.ROOT), 'canonical': str(m.ROOT)}}
        if path == '/api/agent':
            self.catalogue_reads += 1
            assert kwargs.get('location') and self.token is None
            response = next(self.catalogues, None)
            if response is not None:
                return response
            prompt = (m.ROOT / '.opencode/agents/numlock.md').read_text().split('---', 2)[2].strip()
            return {'location': {'directory': str(m.ROOT)}, 'data': [{
                'id': 'numlock', 'mode': 'primary', 'model': m.MODEL,
                'system': prompt, 'permissions': self.config['permissions']}]}
        if path == '/api/session' and method == 'post':
            self.token = body['metadata']['numlockStartupAudit']
            return {'data': {'id': 'ses_test'}}
        if path == '/api/session/ses_test' and method == 'patch':
            assert body == {'archived': True}
            self.archived = True
            return None
        result = super().call(method, path, body, **kwargs)
        if method == 'get' and path == '/api/session/ses_test':
            result['data']['title'] = 'NUMLOCK verified startup audit ' + self.token
            result['data']['metadata']['numlockStartupAudit'] = self.token
        return result


class Tests(unittest.TestCase):
    def session(self):
        return {'id': 'ses_test', 'location': {'directory': str(m.ROOT)},
                'projectID': 'project', 'agent': 'numlock', 'model': m.MODEL,
                'time': {}, 'permissions': []}

    def test_sixteen_permission_calls_without_execution_or_approval(self):
        self.assertEqual(len(m.PROBES), 16)
        for action, resource, effect in m.PROBES:
            with self.subTest(action=action, resource=resource):
                api = FakeAPI()
                m.probe(api, 'ses_test', 'token', m.ROOT, 'project', {}, action, resource, effect)
                self.assertFalse(api.pending)
                self.assertTrue(all(method == 'get' or p.endswith(('/permission', '/reply'))
                                    for method, p, _ in api.calls))
                self.assertTrue(all(body == {'decision': 'reject'}
                                    for _, p, body in api.calls if p.endswith('/reply')))

    def test_unexpected_allow_rejected(self):
        with self.assertRaises(m.Hold):
            m.probe(FakeAPI('allow'), 'ses_test', 'token', m.ROOT, 'project', {},
                    'shell', 'node example.js', 'ask')

    def test_unexpected_ask_rejected(self):
        api = FakeAPI('ask')
        with self.assertRaises(m.Hold):
            m.probe(api, 'ses_test', 'token', m.ROOT, 'project', {}, 'read', '.env', 'deny')
        self.assertFalse(api.pending)

    def test_session_valid(self):
        self.assertEqual(m.session_check(self.session(), m.ROOT, 'project'), 'ses_test')

    def test_negative_session_contracts(self):
        for key, value in [('id', 'bad'), ('location', {'directory': '/outside'}),
                           ('projectID', 'wrong'), ('agent', 'build'),
                           ('model', {'id': 'other'}), ('permissions', [{}]),
                           ('parentID', 'ses_parent'), ('subpath', 'nested'),
                           ('time', {'busy': 123})]:
            with self.subTest(key=key), self.assertRaises(m.Hold):
                session = self.session()
                session[key] = value
                m.session_check(session, m.ROOT, 'project')

    def test_session_id_mismatch(self):
        with self.assertRaises(m.Hold):
            m.session_check(self.session(), m.ROOT, 'project', 'ses_other')

    def test_cli_rejects_bypass_and_remote(self):
        for args in [['--auto'], ['--prompt', 'hello'], ['--continue'],
                     ['--server', 'https://example.com:80'],
                     ['--server', 'http://user:password@localhost:80'],
                     ['--server', 'http://127.0.0.1:80/path'],
                     ['--session', '../../x'], ['--check']]:
            with self.subTest(args=args), self.assertRaises(m.Hold):
                m.arguments(args)

    def test_local_server(self):
        self.assertEqual(m.arguments(['--server', 'http://127.0.0.1:4096']).server,
                         'http://127.0.0.1:4096')

    def test_fail_closed_78_before_exec(self):
        for error in [m.Hold('bad'), OSError(), ValueError(), KeyError()]:
            with self.subTest(error=type(error)), patch.object(m, 'local_check', side_effect=error), \
                    patch.object(m.os, 'execv') as execute:
                self.assertEqual(m.main(['--check-only']), 78)
                execute.assert_not_called()

    def test_check_only_never_launches(self):
        with patch.object(m, 'local_check', return_value={}), \
                patch.object(m, 'verify') as verify, patch.object(m, 'API') as api, \
                patch.object(m.os, 'execv') as execute:
            self.assertEqual(m.main(['--check-only']), 0)
            verify.assert_called_once()
            api.return_value.call.assert_not_called()
            execute.assert_not_called()

    def test_invalid_args_exit_78(self):
        self.assertEqual(m.main(['--auto']), 78)

    def test_repository_mismatch(self):
        with patch.object(m, 'run', return_value='/outside'), self.assertRaises(m.Hold):
            m.local_check(m.ROOT)

    def test_runtime_repository_mismatch(self):
        with self.assertRaises(m.Hold):
            m.verify(type('API', (), {'call': lambda *a, **k: {}})(), m.ROOT, {})

    def test_compatible_patch_requires_cli_capabilities(self):
        for version in ['opencode v2.2.5', 'opencode v2.2.6', 'opencode v2.2.100']:
            with self.subTest(version=version), patch.object(m, 'run', side_effect=[
                    version, 'api --server --session directory', '--data --server method path']) as run:
                m.cli_check(m.ROOT)
                self.assertEqual(run.call_count, 3)

    def test_unsupported_release_stops_before_capabilities(self):
        for version in ['opencode v2.2.4', 'opencode v2.3.0', 'opencode v3.0.0',
                        'opencode v2.2.6-beta', 'opencode v2.2.6+build',
                        'opencode v2.2.06', 'opencode v9', '', '2.2.6']:
            with self.subTest(version=version), patch.object(m, 'run', return_value=version) as run:
                with self.assertRaisesRegex(m.Hold, 'release unsupported'):
                    m.cli_check(m.ROOT)
                self.assertEqual(run.call_count, 1)

    def test_missing_cli_capability_rejected(self):
        for token in ['api', '--server', '--session', 'directory', '--data', 'method', 'path']:
            for index in [1, 2]:
                output = ['opencode v2.2.6', 'api --server --session directory',
                          '--data --server method path']
                if token not in output[index].split():
                    continue
                output[index] = output[index].replace(token, token + '-unsupported')
                with self.subTest(token=token, index=index), patch.object(m, 'run', side_effect=output):
                    with self.assertRaisesRegex(m.Hold, 'CLI capability missing'):
                        m.cli_check(m.ROOT)

    def test_full_verification_and_configuration_rejection(self):
        config = json.loads((m.ROOT / 'opencode.json').read_text())
        api = VerificationAPI(config)
        with redirect_stdout(io.StringIO()):
            m.verify(api, m.ROOT, config)
        self.assertTrue(api.archived)
        self.assertFalse(api.pending)
        self.assertEqual(sum(method == 'post' and path.endswith('/permission')
                             for method, path, _ in api.calls), 16)
        api = VerificationAPI({'permissions': []})
        with self.assertRaisesRegex(m.Hold, 'loaded policy missing baseline'):
            m.verify(api, m.ROOT, config)
        self.assertIsNone(api.token)

    def test_cold_catalogue_waits_for_agent_then_runs_all_probes(self):
        config = json.loads((m.ROOT / 'opencode.json').read_text())
        partial = {'location': {'directory': str(m.ROOT)}, 'data': [{'id': 'build'}]}
        api = VerificationAPI(config, catalogues=[partial, partial])
        with patch.object(m.time, 'sleep'), redirect_stdout(io.StringIO()):
            m.verify(api, m.ROOT, config)
        self.assertEqual(api.catalogue_reads, 3)
        self.assertTrue(api.archived)
        self.assertFalse(api.pending)
        self.assertEqual(sum(method == 'post' and path.endswith('/permission')
                             for method, path, _ in api.calls), 16)

    def test_persistently_absent_agent_blocks_launch(self):
        partial = {'location': {'directory': str(m.ROOT)}, 'data': [{'id': 'build'}]}
        api = VerificationAPI({}, catalogues=[partial] * 6)
        output = io.StringIO()
        with patch.object(m.time, 'sleep') as sleep, patch.object(m, 'local_check'), \
                patch.object(m, 'API', return_value=api), patch.object(m.os, 'execv') as execute, \
                redirect_stderr(output):
            self.assertEqual(m.main([]), 78)
        self.assertIn('agent absent after readiness checks', output.getvalue())
        self.assertEqual(api.catalogue_reads, 6)
        self.assertEqual(sleep.call_count, 5)
        self.assertIsNone(api.token)
        execute.assert_not_called()

    def test_invalid_catalogues_stop_without_retry_or_audit(self):
        location = {'directory': str(m.ROOT)}
        for response, reason in [
            ({'location': location, 'data': [{'id': 'numlock-heavy'}]}, 'registry mismatch'),
            ({'location': location, 'data': [{'id': 'numlock'}] * 2}, 'registry mismatch'),
            ({'location': location, 'data': [{'id': 'numlock', 'mode': 'subagent'}]},
             'loaded agent mismatch'),
            ({'location': location, 'data': [{}]}, 'invalid agent catalogue'),
            ({'location': location, 'data': {}}, 'invalid agent catalogue'),
            ({'location': {'directory': '/other'}, 'data': []}, 'agent location mismatch'),
        ]:
            api = VerificationAPI({}, catalogues=[response])
            with self.subTest(reason=reason), patch.object(m.time, 'sleep') as sleep:
                with self.assertRaisesRegex(m.Hold, reason):
                    m.verify(api, m.ROOT, {})
                sleep.assert_not_called()
                self.assertEqual(api.catalogue_reads, 1)
                self.assertIsNone(api.token)

    def test_live_mismatch_or_cleanup_failure_blocks_launch(self):
        config = json.loads((m.ROOT / 'opencode.json').read_text())
        for options in [{'effect': 'allow'}, {'fail': True}]:
            api = VerificationAPI(config, **options)
            with self.subTest(options=options), patch.object(m, 'local_check', return_value=config), \
                    patch.object(m, 'API', return_value=api), patch.object(m.os, 'execv') as execute, \
                    redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                self.assertEqual(m.main([]), 78)
                execute.assert_not_called()

    def test_malformed_runtime_response_blocks_launch(self):
        for response in [None, [], {'directory': str(m.ROOT), 'project': []}]:
            with self.subTest(response=response), patch.object(m, 'local_check', return_value={}), \
                    patch.object(m.API, 'call', return_value=response), \
                    patch.object(m.os, 'execv') as execute, redirect_stderr(io.StringIO()):
                self.assertEqual(m.main([]), 78)
                execute.assert_not_called()

    def test_hold_reason_and_exception_redaction(self):
        errors = [m.Hold('SECRET'), OSError('SECRET'), ValueError('SECRET'),
                  AttributeError('SECRET'), m.subprocess.TimeoutExpired('SECRET', 30)]
        try:
            m.require(False, 'CLI capability missing: --data; review CLI compatibility before startup')
        except m.Hold as error:
            errors.append(error)
        for error in errors:
            output = io.StringIO()
            with self.subTest(error=type(error)), patch.object(m, 'local_check', side_effect=error), \
                    redirect_stderr(output):
                self.assertEqual(m.main(['--check-only']), 78)
            self.assertIn('HOLD [local configuration / CLI compatibility]', output.getvalue())
            self.assertNotIn('SECRET', output.getvalue())
            self.assertIn(getattr(error, 'safe_reason', 'inspect locally'), output.getvalue())

    def test_pending_cannot_be_cleaned(self):
        api = FakeAPI(stuck=True)
        with self.assertRaisesRegex(m.Hold, 'pending audit permission remains'):
            m.probe(api, 'ses_test', 'token', m.ROOT, 'project', {},
                    'shell', 'node example.js', 'ask')
        self.assertTrue(api.pending)

    def test_cleanup_failure(self):
        api = FakeAPI(fail=True)
        with self.assertRaisesRegex(m.Hold, 'cleanup failed'):
            m.probe(api, 'ses_test', 'token', m.ROOT, 'project', {},
                    'shell', 'node example.js', 'ask')

    def test_ownership_mismatch_never_mutates(self):
        api = FakeAPI(mismatch=True)
        with self.assertRaisesRegex(m.Hold, 'ownership mismatch'):
            m.cleanup_pending(api, 'ses_test', 'token', m.ROOT, 'project', {})
        self.assertTrue(all(method == 'get' for method, _, _ in api.calls))

    def test_unknown_permission_never_rejected(self):
        api = FakeAPI()
        api.pending = [{'id': 'per_foreign', 'sessionID': 'ses_test'}]
        with self.assertRaisesRegex(m.Hold, 'ownership mismatch'):
            m.cleanup_pending(api, 'ses_test', 'token', m.ROOT, 'project', {})
        self.assertTrue(all(method == 'get' for method, _, _ in api.calls))

    def test_partial_audit_cleanup_before_archive(self):
        api = FakeAPI()
        api.pending = [{'id': 'per_owned', 'sessionID': 'ses_test',
                        'action': 'shell', 'resources': ['node example.js']}]
        m.cleanup_pending(api, 'ses_test', 'token', m.ROOT, 'project',
                          {'per_owned': ('shell', ['node example.js'])})
        self.assertEqual(api.pending, [])
        self.assertEqual([body for _, p, body in api.calls if p.endswith('/reply')],
                         [{'decision': 'reject'}])


if __name__ == '__main__':
    unittest.main()
