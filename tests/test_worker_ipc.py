import io
import json
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'isolated'))
import ipc
import worker
import egress


@pytest.mark.skipif(not hasattr(socket, 'AF_UNIX'), reason='Unix sockets required')
def test_private_ipc_end_to_end(tmp_path, monkeypatch):
    path = str(tmp_path / 'worker.sock')
    calls = []
    monkeypatch.setattr(worker, 'main', lambda video_id: calls.append(video_id) or 0)
    try:
        server = ipc.Server(path, ipc.Handler)
    except OSError as exc:
        pytest.skip(f'Unix socket unavailable: {exc}')
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        assert ipc.invoke('abcdefghijk', path) == {'status': 'ok'}
        with pytest.raises(ValueError):
            ipc.invoke('../invalid!', path)
        for payload in (b'{"video_id":"abcdefghijk","extra":1}\n', b'x' * 258 + b'\n'):
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                client.settimeout(3)
                client.connect(path)
                client.sendall(payload)
                try:
                    assert client.recv(256) == b''
                except ConnectionResetError:
                    pass
        assert calls == ['abcdefghijk']
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def test_dns_timeout_fails_closed(monkeypatch):
    real_run = subprocess.run
    def blocked(*args, **kwargs):
        return real_run([sys.executable, '-c', 'import time; time.sleep(10)'], **kwargs)
    monkeypatch.setattr(egress, 'DNS_TIMEOUT', 0.2)
    monkeypatch.setattr(egress.subprocess, 'run', blocked)
    started = time.monotonic()
    with pytest.raises(ValueError, match='DNS resolution failed'):
        egress.connect_public('youtube.com')
    assert time.monotonic() - started < 5


@pytest.mark.skipif(not hasattr(socket, 'AF_UNIX'), reason='Unix sockets required')
def test_search_ipc_and_validation(tmp_path, monkeypatch):
    path = str(tmp_path / 'search.sock')
    entry = {'video_id': 'abcdefghijk', 'title': 'Song', 'artist': 'Artist', 'duration': 123}
    monkeypatch.setattr(worker, 'search', lambda query, limit: [entry])
    try:
        server = ipc.Server(path, ipc.Handler)
    except OSError as exc:
        pytest.skip(f'Unix socket unavailable: {exc}')
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        assert ipc.search('song', 1, path) == {'status': 'ok', 'results': [entry]}
        for query, limit in [('', 1), ('x' * 161, 1), ('https://example.com', 1), ('song', True), ('song', 51)]:
            with pytest.raises(ValueError):
                ipc.search(query, limit, path)
        monkeypatch.setattr(worker, 'search', lambda query, limit: [dict(entry, url='https://example.com/?secret=x')])
        assert ipc.search('song', 1, path) == {'status': 'failed'}
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.mark.parametrize('entry', [
    {'video_id': 'abcdefghijk', 'title': 'https://example.com/?token=secret', 'artist': 'A', 'duration': 1},
    {'video_id': 'abcdefghijk', 'title': 'A', 'artist': 'A', 'duration': True},
    {'video_id': 'abcdefghijk', 'title': 'A', 'artist': 'A', 'duration': 86401},
    {'video_id': 'invalid', 'title': 'A', 'artist': 'A', 'duration': 1},
])
def test_search_response_rejects_invalid_fields(entry):
    with pytest.raises(ValueError):
        ipc.validate_results({'status': 'ok', 'results': [entry]}, 1)


def test_worker_search_strips_untrusted_fields(monkeypatch):
    data = {'entries': [{'id': 'abcdefghijk', 'title': 'Song', 'uploader': 'Artist',
                         'duration': 123, 'url': 'https://example.com/?secret=secret'}]}
    class Process:
        returncode = 0
        stdout = io.BytesIO(json.dumps(data).encode())
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def wait(self, timeout=None): return 0
        def kill(self): self.returncode = -1
    monkeypatch.setattr(worker.subprocess, 'Popen', lambda *args, **kwargs: Process())
    assert worker.search('song', 1) == [
        {'video_id': 'abcdefghijk', 'title': 'Song', 'artist': 'Artist', 'duration': 123}]
