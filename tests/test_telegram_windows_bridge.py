import pytest
import asyncio
import json
import threading
from contextlib import nullcontext
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import telethon
import telethon.sessions
import telegram_third_party_callback
from telethon.tl import types
from telegram_selection_registry import SelectionRegistry, SelectionUnavailable
from telegram_import import Candidate

import telegram_windows_bridge as bridge


def test_bridge_url_is_configurable_and_validated(monkeypatch):
    monkeypatch.setenv('MUSIC_BRIDGE_API_URL', 'https://music.example.com/api/')
    assert bridge.bridge_base_url() == 'https://music.example.com/api'
    monkeypatch.setenv('MUSIC_BRIDGE_API_URL', 'http://user:secret@example.com/api')
    with pytest.raises(ValueError):
        bridge.bridge_base_url()
    monkeypatch.setenv('MUSIC_BRIDGE_API_URL', 'ftp://example.com/api')
    with pytest.raises(ValueError):
        bridge.bridge_base_url()


def test_idle_does_not_search(monkeypatch):
    monkeypatch.setattr(bridge, 'bridge_request', lambda *args: {'job': None})
    assert bridge.run_once('unused') == 'idle'


def test_success_reports_results_once(monkeypatch):
    calls = []

    def request(key, path, body):
        calls.append((path, body))
        if path.endswith('claim'):
            return {'job': {'id': 'job', 'query': 'canción'}}
        return {'accepted': True}

    async def search(query, *, search_id, registry):
        assert query == 'canción'
        assert search_id == 'job'
        return [{'id': 'a' * 43, 'label': '1', 'context': '1. Canción', 'relation': 'indeterminado'}]

    monkeypatch.setattr(bridge, 'bridge_request', request)
    monkeypatch.setattr(bridge, 'search_with_session', search)
    assert bridge.run_once('unused') == 'completed'
    assert calls[-1] == ('/telegram/bridge/finish', {'identifier': 'job', 'results': [{'id': 'a' * 43, 'label': '1', 'context': '1. Canción', 'relation': 'indeterminado'}]})
    assert len(calls) == 2


def test_search_failure_reports_failure_without_retry(monkeypatch):
    calls = []

    def request(key, path, body):
        calls.append((path, body))
        return {'job': {'id': 'job', 'query': 'canción'}} if path.endswith('claim') else {}

    async def search(query, *, search_id, registry):
        raise RuntimeError('sensitive error')

    monkeypatch.setattr(bridge, 'bridge_request', request)
    monkeypatch.setattr(bridge, 'search_with_session', search)
    assert bridge.run_once('unused') == 'failed'
    assert calls[-1] == ('/telegram/bridge/finish', {'identifier': 'job', 'failed': True})
    assert len(calls) == 2


def test_transport_rejects_bad_key_or_route_before_network():
    with pytest.raises(ValueError):
        bridge.bridge_request('bad', '/telegram/bridge/claim', {})
    with pytest.raises(ValueError):
        bridge.bridge_request('a' * 43, '/other', {})


def test_service_continues_after_failed_job_without_retrying(monkeypatch, tmp_path):
    states = iter(['completed', 'idle', 'failed'])
    calls = []

    class StopService(Exception):
        pass

    def wait(seconds):
        calls.append(seconds)
        if len(calls) >= 3:
            raise StopService

    monkeypatch.setattr(bridge, 'session_path', lambda: tmp_path / 'session')
    monkeypatch.setattr(bridge, 'bridge_request', lambda *args: {'accepted': True})
    monkeypatch.setattr(bridge, 'run_selection_once', lambda key: 'idle')
    monkeypatch.setattr(bridge, 'run_download_once', lambda key: 'idle')
    monkeypatch.setattr(bridge, 'run_delete_once', lambda key: 'idle')
    monkeypatch.setattr(bridge, 'run_once', lambda key: next(states, 'idle'))
    with pytest.raises(StopService):
        bridge.serve('key', wait=wait)
    # Un trabajo fallido espera y sigue con solicitudes nuevas; no se reintenta.
    assert calls == [2, 2, 2]


def test_selection_reports_callback_result_once(monkeypatch):
    calls = []

    def request(key, path, body):
        calls.append((path, body))
        if path.endswith('claim-selection'):
            return {'selection': {'search_id': 'search', 'result_id': 'option'}}
        return {'accepted': True, 'callback_sent': False}

    async def verify(search_id, result_id, *, registry, send_callback):
        assert (search_id, result_id) == ('search', 'option')
        assert send_callback is True

    monkeypatch.setenv('MUSIC_TELEGRAM_CALLBACK_ENABLED', '1')
    monkeypatch.setattr(bridge, 'bridge_request', request)
    monkeypatch.setattr(bridge, 'verify_selection', verify)
    monkeypatch.setattr(bridge, 'receipt_baseline', lambda: ('bot-token', []))
    monkeypatch.setattr(bridge, 'receipt_after', lambda *args: None)
    assert bridge.run_selection_once('unused', wait=lambda _: None) == 'confirmed'
    assert calls == [('/telegram/bridge/claim-selection', {}),
                     ('/telegram/bridge/callback-result', {'identifier': 'search', 'confirmed': True, 'receipt': None})]


def test_selection_verification_failure_stops_without_retry(monkeypatch):
    calls = []

    def request(key, path, body):
        calls.append((path, body))
        return {'selection': {'search_id': 'search', 'result_id': 'option'}} if path.endswith('claim-selection') else {}

    async def verify(*args, **kwargs):
        raise ValueError('changed message')

    monkeypatch.setenv('MUSIC_TELEGRAM_CALLBACK_ENABLED', '1')
    monkeypatch.setattr(bridge, 'bridge_request', request)
    monkeypatch.setattr(bridge, 'verify_selection', verify)
    monkeypatch.setattr(bridge, 'receipt_baseline', lambda: ('bot-token', []))
    assert bridge.run_selection_once('unused') == 'failed'
    assert calls[-1] == ('/telegram/bridge/callback-result', {'identifier': 'search', 'confirmed': False})
    assert len(calls) == 2


def test_callback_gate_does_not_claim_when_disabled(monkeypatch):
    monkeypatch.delenv('MUSIC_TELEGRAM_CALLBACK_ENABLED', raising=False)
    monkeypatch.setattr(bridge, 'bridge_request', lambda *args: pytest.fail('must not contact backend'))
    assert bridge.run_selection_once('unused') == 'disabled'


def test_result_reference_binds_message_coordinate_without_disclosing_payload():
    button = types.KeyboardInlineButton(text='2', type=types.InlineButtonTypeCallback(data=b'private-payload'))
    message = types.Message(id=33, peer_id=types.PeerChat(5498752855), from_id=types.PeerUser(bridge.BOT_ID),
                            date=datetime.now(timezone.utc), message='1. Otra\n2. Imitadora',
                            reply_markup=types.ReplyInlineMarkup(rows=[types.KeyboardButtonRow(buttons=[button])]))
    registry = SelectionRegistry(clock=lambda: 100)
    results = bridge.observed_results([message], search_id='search', sent_id=99, registry=registry)
    assert len(results) == 1
    assert results[0]['label'] == '2'
    assert results[0]['context'] == '1. Otra\n2. Imitadora'
    assert results[0]['relation'] == 'indeterminado'
    assert 'private-payload' not in str(results)
    with pytest.raises(SelectionUnavailable):
        registry.consume(results[0]['id'], operator='other-search')
    message_id, coordinate, snapshot = registry.consume(results[0]['id'], operator='search')
    assert (message_id, coordinate, snapshot) == (33, (0, 0), bridge.message_fingerprint(message))


def test_message_fingerprint_ignores_volatile_counters():
    button = types.KeyboardInlineButton(text='1', type=types.InlineButtonTypeCallback(data=b'payload'))
    markup = types.ReplyInlineMarkup(rows=[types.KeyboardButtonRow(buttons=[button])])
    base = dict(id=33, peer_id=types.PeerChat(5498752855), from_id=types.PeerUser(bridge.BOT_ID),
                date=datetime.now(timezone.utc), message='1. Canción',
                reply_markup=markup)
    first = bridge.message_fingerprint(types.Message(**base))
    with_views = bridge.message_fingerprint(types.Message(**base, views=1234, forwards=7))
    assert with_views == first
    changed = bridge.message_fingerprint(types.Message(**{**base, 'message': '1. Otra'}))
    assert changed != first


def test_receipt_baseline_compacts_bot_update_queue(monkeypatch):
    calls = []

    def bot_request(token, method, payload):
        calls.append((method, payload))
        if method == 'getMe':
            return {'username': 'mussicart_bot'}
        if method == 'getWebhookInfo':
            return {'url': ''}
        if method == 'getUpdates':
            return []
        raise AssertionError(method)

    monkeypatch.setattr(bridge, 'read_credentials', lambda: (1, 'a' * 32, '1:token'))
    monkeypatch.setattr(bridge, 'bot_request', bot_request)
    token, updates = bridge.receipt_baseline()
    assert token == '1:token'
    assert updates == []
    assert calls[-1] == ('getUpdates', {'offset': -50, 'limit': 100, 'timeout': 0})


def test_selection_revalidation_rejects_changed_message(monkeypatch):
    class Message:
        def __bytes__(self):
            return b'changed'

    class Client:
        async def connect(self): pass
        async def is_user_authorized(self): return True
        async def get_messages(self, group, ids): return Message()
        async def disconnect(self): pass

    async def identity(*args, **kwargs):
        return 'me', 'bot', 'group'

    registry = SelectionRegistry(clock=lambda: 100)
    option = registry.issue(operator='search', value=(33, (0, 0), b'original'))
    monkeypatch.setattr(bridge, 'read_credentials', lambda: (123, 'hash', 'token'))
    monkeypatch.setattr(bridge, 'session_path', lambda: Path('private/session'))
    monkeypatch.setattr(bridge, 'exclusive_account_lock', lambda path: nullcontext())
    monkeypatch.setattr(bridge, 'load_session', lambda path: 'session')
    monkeypatch.setattr(bridge, 'verify_identity', identity)
    monkeypatch.setattr(telethon.sessions, 'StringSession', lambda value: value)
    monkeypatch.setattr(telethon, 'TelegramClient', lambda *args, **kwargs: Client())
    monkeypatch.setattr(bridge, 'message_fingerprint', lambda message: b'changed')
    called = []
    monkeypatch.setattr(telegram_third_party_callback, 'prepare', lambda *args, **kwargs: called.append(True))
    with pytest.raises(ValueError):
        asyncio.run(bridge.verify_selection('search', option, registry=registry))
    assert called == []
    with pytest.raises(SelectionUnavailable):
        registry.consume(option, operator='search')


def test_callback_sent_once_after_revalidation(monkeypatch):
    class Message:
        def __bytes__(self): return b'original'

    calls = []

    class Client:
        async def connect(self): pass
        async def is_user_authorized(self): return True
        async def get_messages(self, group, ids): return Message()
        async def get_input_entity(self, group): return group
        async def __call__(self, request):
            calls.append(request)
            return object()
        async def disconnect(self): pass

    async def identity(*args, **kwargs): return 'me', 'bot', 'group'

    registry = SelectionRegistry(clock=lambda: 100)
    option = registry.issue(operator='search', value=(33, (0, 0), b'original'))
    monkeypatch.setattr(bridge, 'read_credentials', lambda: (123, 'hash', 'token'))
    monkeypatch.setattr(bridge, 'session_path', lambda: Path('private/session'))
    monkeypatch.setattr(bridge, 'exclusive_account_lock', lambda path: nullcontext())
    monkeypatch.setattr(bridge, 'load_session', lambda path: 'session')
    monkeypatch.setattr(bridge, 'verify_identity', identity)
    monkeypatch.setattr(telethon.sessions, 'StringSession', lambda value: value)
    monkeypatch.setattr(telethon, 'TelegramClient', lambda *args, **kwargs: Client())
    monkeypatch.setattr(bridge, 'message_fingerprint', lambda message: b'original')
    monkeypatch.setattr(telegram_third_party_callback, 'prepare', lambda *args, **kwargs: None)
    monkeypatch.setattr(telegram_third_party_callback, '_button', lambda *args: b'payload')
    asyncio.run(bridge.verify_selection('search', option, registry=registry, send_callback=True))
    assert len(calls) == 1
    with pytest.raises(SelectionUnavailable):
        asyncio.run(bridge.verify_selection('search', option, registry=registry, send_callback=True))
    assert len(calls) == 1


def test_bridge_transport_uses_local_http_and_sends_key_in_header(monkeypatch):
    observed = []
    key = 'a' * 43

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            observed.append((self.path, self.headers.get('X-Telegram-Bridge-Key'), payload))
            response = b'{"job": null}'
            self.send_response(200)
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)

        def log_message(self, *args):
            pass

    server = HTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        monkeypatch.setattr(bridge, 'BASE_URL', f'http://127.0.0.1:{server.server_port}/api')
        assert bridge.bridge_request(key, '/telegram/bridge/claim', {}) == {'job': None}
        assert observed == [('/api/telegram/bridge/claim', key, {})]
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


def test_receipt_observation_produces_reference_without_file_id(monkeypatch):
    registry = SelectionRegistry(clock=lambda: 100)
    message = {'update_id': 2, 'message': {'message_id': 9,
        'chat': {'id': bridge.GROUP_ID, 'type': 'group'}, 'from': {'id': bridge.BOT_ID},
        'audio': {'file_id': 'private_file_id', 'file_size': 42, 'mime_type': 'audio/mpeg', 'title': 'Imitadora'}}}
    monkeypatch.setattr(bridge, 'RECEIPTS', registry)
    monkeypatch.setattr(bridge, 'bot_request', lambda *args: [{'update_id': 1}, message])
    item = bridge.receipt_after('token', [{'update_id': 1}], 'search')
    assert item['title'] == 'Imitadora'
    assert 'private_file_id' not in str(item)
    candidate = registry.consume(item['id'], operator='search')
    assert candidate.file_id == 'private_file_id'


def test_ambiguous_receipts_are_not_accepted(monkeypatch):
    message = {'message': {'message_id': 9,
        'chat': {'id': bridge.GROUP_ID, 'type': 'group'}, 'from': {'id': bridge.BOT_ID},
        'audio': {'file_id': 'file_id', 'file_size': 42, 'mime_type': 'audio/mpeg'}}}
    monkeypatch.setattr(bridge, 'bot_request', lambda *args: [dict(message, update_id=1), dict(message, update_id=2)])
    assert bridge.receipt_after('token', [], 'search') is None


def test_download_gate_does_not_claim_when_disabled(monkeypatch):
    monkeypatch.delenv('MUSIC_TELEGRAM_DOWNLOAD_ENABLED', raising=False)
    monkeypatch.setattr(bridge, 'bridge_request', lambda *args: pytest.fail('must not contact backend'))
    assert bridge.run_download_once('unused') == 'disabled'


def test_download_result_is_reported_once(monkeypatch):
    calls = []
    def request(key, path, body):
        calls.append((path, body))
        return {'download': {'search_id': 'search', 'receipt_id': 'receipt'}} if path.endswith('claim-download') else {}
    def fake_download(*args, progress=None, **kwargs):
        progress(512 * 1024, 1024 * 1024)
        progress(1024 * 1024, 1024 * 1024)
        return 'quarantined'
    monkeypatch.setenv('MUSIC_TELEGRAM_DOWNLOAD_ENABLED', '1')
    monkeypatch.setattr(bridge, 'bridge_request', request)
    monkeypatch.setattr(bridge, 'download_receipt', fake_download)
    assert bridge.run_download_once('unused') == 'saved'
    assert calls == [('/telegram/bridge/claim-download', {}),
                     ('/telegram/bridge/download-progress', {'identifier': 'search', 'received': 512 * 1024, 'total': 1024 * 1024}),
                     ('/telegram/bridge/download-progress', {'identifier': 'search', 'received': 1024 * 1024, 'total': 1024 * 1024}),
                     ('/telegram/bridge/download-result', {'identifier': 'search', 'saved': True, 'validated': False, 'published': False})]


def test_download_revalidates_candidate_before_saving(monkeypatch, tmp_path):
    candidate = Candidate(9, 'private_file_id', 3, 'audio/mpeg')
    registry = SelectionRegistry(clock=lambda: 100)
    ref = registry.issue(operator='search', value=candidate)
    update = {'update_id': 1, 'message': {'message_id': 9,
        'chat': {'id': bridge.GROUP_ID, 'type': 'group'}, 'from': {'id': bridge.BOT_ID},
        'audio': {'file_id': 'private_file_id', 'file_size': 3, 'mime_type': 'audio/mpeg'}}}
    monkeypatch.setattr(bridge, 'receipt_baseline', lambda: ('token', [update]))
    monkeypatch.setattr(bridge, 'bot_request', lambda *args: {'file_size': 3, 'file_path': 'audio/file.mp3'})
    monkeypatch.setattr(bridge, 'get_chunks', lambda *args: [b'abc'])
    monkeypatch.setattr(bridge, 'DESTINATION', tmp_path)
    monkeypatch.setattr(bridge, 'validate_mp3', lambda path: b'abc')
    monkeypatch.delenv('MUSIC_TELEGRAM_PUBLISH_ENABLED', raising=False)
    seen = []
    assert bridge.download_receipt('search', ref, registry=registry,
                                   progress=lambda received, total: seen.append((received, total))) == 'validated'
    assert seen == [(3, 3)]
    files = list(tmp_path.iterdir())
    assert len(files) == 1 and files[0].suffix == '.bin' and files[0].read_bytes() == b'abc'


def test_download_accepts_m4a_and_validates_transcoded_bytes(monkeypatch, tmp_path):
    candidate = Candidate(9, 'private_file_id', 3, 'audio/m4a')
    registry = SelectionRegistry(clock=lambda: 100)
    ref = registry.issue(operator='search', value=candidate)
    update = {'update_id': 1, 'message': {'message_id': 9,
        'chat': {'id': bridge.GROUP_ID, 'type': 'group'}, 'from': {'id': bridge.BOT_ID},
        'audio': {'file_id': 'private_file_id', 'file_size': 3, 'mime_type': 'audio/m4a'}}}
    monkeypatch.setattr(bridge, 'receipt_baseline', lambda: ('token', [update]))
    monkeypatch.setattr(bridge, 'bot_request', lambda *args: {'file_size': 3, 'file_path': 'audio/file.m4a'})
    monkeypatch.setattr(bridge, 'get_chunks', lambda *args: [b'abc'])
    monkeypatch.setattr(bridge, 'DESTINATION', tmp_path)
    monkeypatch.setattr(bridge, 'validate_mp3', lambda path: b'ID3converted')
    monkeypatch.delenv('MUSIC_TELEGRAM_PUBLISH_ENABLED', raising=False)
    assert bridge.download_receipt('search', ref, registry=registry) == 'validated'


def test_changed_receipt_rejected_before_file_request(monkeypatch):
    candidate = Candidate(9, 'private_file_id', 3, 'audio/mpeg')
    registry = SelectionRegistry(clock=lambda: 100)
    ref = registry.issue(operator='search', value=candidate)
    monkeypatch.setattr(bridge, 'receipt_baseline', lambda: ('token', []))
    monkeypatch.setattr(bridge, 'bot_request', lambda *args: pytest.fail('must not request file'))
    with pytest.raises(ValueError):
        bridge.download_receipt('search', ref, registry=registry)


def test_delete_removes_only_selected_import_and_its_metadata(tmp_path):
    selected = tmp_path / ('telegram-' + 'a' * 32 + '.mp3')
    other = tmp_path / ('telegram-' + 'b' * 32 + '.mp3')
    selected.write_bytes(b'a')
    selected.with_suffix('.json').write_text('{}')
    selected.with_suffix('.jpg').write_bytes(b'cover')
    other.write_bytes(b'b')
    bridge.delete_imported(selected.name, directory=tmp_path)
    assert not selected.exists() and not selected.with_suffix('.json').exists() and not selected.with_suffix('.jpg').exists()
    assert other.read_bytes() == b'b'
    with pytest.raises(ValueError):
        bridge.delete_imported('../other.mp3', directory=tmp_path)
