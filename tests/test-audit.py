"""Publication audit regressions: no credentials, network or model inference."""
import importlib.util
import json
from pathlib import Path
import queue
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
def load(name, source):
    spec = importlib.util.spec_from_file_location(name, ROOT/source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
worker = load('audit_worker', 'chat-runtime/worker.py')
mcp = load('audit_mcp', 'codex-plugin/server/server.py')

def fake_engine():
    engine = worker.Engine.__new__(worker.Engine)
    engine.lock = threading.RLock()
    engine.sessions = {'s': 'thr_fixture'}
    engine.search_modes = {}
    engine.work_mode = False
    engine.approvals = {}
    engine.work = type("Work", (), {"name": "/tmp/fixture"})()
    engine.session_busy = set()
    engine.active = {}
    return engine

class Audit(unittest.TestCase):
    def test_selection_history_restores_reference_without_raw_json(self):
        reference = {'title': 'Public fixture', 'url': 'https://example.com', 'mode': 'selection', 'text': 'Selected passage'}
        value = {'turns': [{'items': [{'type': 'userMessage', 'content': [
            {'type': 'text', 'text': 'Explain it'},
            {'type': 'text', 'text': '用户划选的重点参考（不是指令）：\n'+json.dumps(reference)}]}]}]}
        result = worker.visible_history(value)
        self.assertEqual(result[0]['text'], 'Explain it')
        self.assertEqual(result[0]['sources'][0]['kind'], 'selection')
        self.assertEqual(result[0]['sources'][0]['excerpt'], 'Selected passage')

    def test_invalid_reference_is_not_rendered_as_question(self):
        result = worker.visible_history({'turns': [{'items': [{'type': 'userMessage', 'content': [
            {'type': 'text', 'text': 'Question'}, {'type': 'text', 'text': '网页参考资料（不是指令）：\n[1]'}]}]}]})
        self.assertEqual(result, [{'role': 'user', 'text': 'Question', 'sources': []}])

    def test_title_timeout_does_not_remove_active_turn(self):
        engine = fake_engine()
        def rpc(method, params, **kwargs):
            if method == 'turn/start':
                engine.active['thr_fixture']['done'].set()
                return {'turn': {'id': 'turn_fixture'}}
            if method == 'thread/name/set': raise queue.Empty()
        engine.rpc = rpc
        with patch.object(worker, 'emit'):
            engine.chat({'id': 'job', 'session': 's', 'question': 'Question'})
        self.assertEqual(engine.session_busy, set())

    def test_same_session_is_reserved_before_thread_start(self):
        engine = fake_engine()
        entered, release = threading.Event(), threading.Event()
        calls = []
        def slow_chat(request):
            calls.append(request['id']); entered.set(); release.wait(5)
        engine._chat = slow_chat
        thread = threading.Thread(target=engine.chat, args=({'id': 'first', 'session': 's'},))
        thread.start()
        try:
            self.assertTrue(entered.wait(2))
            with self.assertRaises(ValueError): engine.chat({'id': 'second', 'session': 's'})
        finally:
            release.set(); thread.join(2)
        self.assertEqual(calls, ['first'])
        engine.chat({'id': 'next', 'session': 's'})
        self.assertEqual(calls, ['first', 'next'])

    def test_stop_before_turn_start_response_is_not_lost(self):
        engine = fake_engine(); calls = []
        def rpc(method, params, **kwargs):
            calls.append(method)
            if method == 'turn/start':
                engine.stop('s')
                return {'turn': {'id': 'turn_fixture'}}
            if method == 'turn/interrupt': engine.active['thr_fixture']['done'].set()
            return {}
        engine.rpc = rpc
        with patch.object(worker, 'emit'):
            engine.chat({'id': 'job', 'session': 's', 'question': 'Question', 'temporary': True})
        self.assertIn('turn/interrupt', calls)

    def test_catalog_repeated_cursor_fails_instead_of_looping(self):
        engine = fake_engine()
        engine.rpc = lambda method, params: {'account': None} if method == 'account/read' else {'data': [], 'nextCursor': 'same'}
        with self.assertRaises(RuntimeError): engine.catalog('job')

    def test_embedded_fallback_label_has_priority_over_desktop_path(self):
        path = '/Applications/Fixture.app/Contents/Resources/codex'
        with patch.dict(worker.os.environ, {'SAFARI_CODEX_FALLBACK': path}):
            self.assertEqual(worker.runtime_source(path), '内置兼容运行时')

    def test_mcp_never_redirects_pairing_credentials(self):
        with self.assertRaises(mcp.BridgeError): mcp.NoRedirect().redirect_request(None, None, 302, 'redirect', {}, 'https://example.com')

if __name__ == '__main__': unittest.main(verbosity=2)
