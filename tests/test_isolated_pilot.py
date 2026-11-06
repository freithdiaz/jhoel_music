import asyncio
import socket
import threading
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import server
from isolated import ipc


def request(headers=(), peer='127.0.0.1', host=b'localhost'):
    return Request({'type': 'http', 'method': 'GET', 'path': '/stream_yt',
                    'scheme': 'http', 'server': ('localhost', 80),
                    'client': (peer, 1234), 'headers': [(b'host', host), *headers]})


@pytest.mark.parametrize('url', [
    'http://googlevideo.com/a', 'https://googlevideo.com.evil/a',
    'https://googlevideo.com@evil/a', 'https://googlevideo.com:444/a',
    'https://googlevideo.com/a\r\nsecret', 'https://googlevideo.com/a#x',
])
def test_worker_url_rejected(url):
    with pytest.raises(ValueError):
        ipc.validate_url(url)


def test_pilot_stream_only_uses_worker_and_pinned_transport(monkeypatch):
    monkeypatch.setenv('MUSIC_ISOLATED_PILOT', '1')
    upstream = Mock(status=206, headers={'Content-Range': 'bytes 0-2/3', 'Content-Length': '3'})
    upstream.read.side_effect = [b'abc', b'']
    with patch.object(server.worker_ipc, 'extract', return_value='https://r1.googlevideo.com/a?secret=x') as extract, \
         patch.object(server, 'open_stream_url', return_value=upstream) as open_url, \
         patch.object(server, 'get_stream_url', side_effect=AssertionError):
        response = server.stream_yt(request([(b'range', b'bytes=0-2')]), 'abcdefghijk')
        async def consume():
            return b''.join([chunk async for chunk in response.body_iterator])
        assert asyncio.run(consume()) == b'abc'
    assert response.headers['cache-control'] == 'no-store'
    assert 'secret' not in str(response.headers)
    extract.assert_called_once()
    open_url.assert_called_once_with('https://r1.googlevideo.com/a?secret=x', {'Range': 'bytes=0-2'})
    upstream.close.assert_called_once()


def test_pilot_bad_range_and_worker_data_fail_closed(monkeypatch):
    monkeypatch.setenv('MUSIC_ISOLATED_PILOT', '1')
    with patch.object(server.worker_ipc, 'extract', return_value='https://evil.test/secret') as extract, \
         patch.object(server, 'open_stream_url') as upstream:
        with pytest.raises(HTTPException) as exc:
            server.stream_yt(request([(b'range', b'bytes=0-1,3-4')]), 'abcdefghijk')
        assert exc.value.status_code == 416
        extract.assert_not_called()
        with pytest.raises(HTTPException) as exc:
            server.stream_yt(request(), 'abcdefghijk')
        assert exc.value.status_code == 502
        upstream.assert_not_called()
    with pytest.raises(HTTPException) as exc:
        server.prepare_stream('abcdefghijk')
    assert exc.value.status_code == 503


@pytest.mark.parametrize('peer,host,origin', [
    ('192.168.1.2', b'localhost', None), ('127.0.0.1', b'evil.test', None),
    ('127.0.0.1', b'localhost', b'https://evil.test'),
])
def test_pilot_denies_nonlocal_requests(monkeypatch, peer, host, origin):
    monkeypatch.setenv('MUSIC_ISOLATED_PILOT', '1')
    headers = [(b'origin', origin)] if origin else []
    async def next_handler(req):
        raise AssertionError('must not reach route')
    response = asyncio.run(server.restrict_pilot_to_loopback(request(headers, peer, host), next_handler))
    assert response.status_code == 403


def test_search_uses_worker(monkeypatch):
    monkeypatch.setenv('MUSIC_ISOLATED_PILOT', '1')
    result = {'status': 'ok', 'results': [{'video_id': 'abcdefghijk', 'title': 'Song', 'artist': 'Artist', 'duration': 10}]}
    with patch.object(server.worker_ipc, 'search', return_value=result) as search, \
         patch.object(server.yt_dlp, 'YoutubeDL', side_effect=AssertionError):
        assert server.search_online('song', 25)[0]['audioUrl'] == '/stream_yt?v=abcdefghijk'
        assert search.call_args.args == ('song', 10)


@pytest.mark.skipif(not hasattr(socket, 'AF_UNIX'), reason='Unix sockets required')
def test_extract_socket_validates_both_sides(tmp_path, monkeypatch):
    import sys
    sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[1] / 'isolated'))
    import worker
    path = str(tmp_path / 'pilot.sock')
    try:
        service = ipc.Server(path, ipc.Handler)
    except OSError as exc:
        pytest.skip(f'Unix socket unavailable: {exc}')
    monkeypatch.setattr(worker, 'extract', lambda _: 'https://r1.googlevideo.com/a?token=secret')
    thread = threading.Thread(target=service.serve_forever, daemon=True)
    thread.start()
    try:
        assert ipc.extract('abcdefghijk', path) == 'https://r1.googlevideo.com/a?token=secret'
        monkeypatch.setattr(worker, 'extract', lambda _: 'https://127.0.0.1/secret')
        with pytest.raises(ValueError, match='worker failed'):
            ipc.extract('abcdefghijk', path)
    finally:
        service.shutdown()
        service.server_close()
        thread.join()


def test_extractor_rejects_drm_and_non_audio(monkeypatch):
    import sys
    sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[1] / 'isolated'))
    import worker
    base = {'url': 'https://r1.googlevideo.com/audio', 'protocol': 'https',
            'vcodec': 'none', 'acodec': 'aac'}
    for change in ({'has_drm': True}, {'vcodec': 'h264'}, {'protocol': 'm3u8'}, {'acodec': 'none'}):
        monkeypatch.setattr(worker, 'bounded_output', lambda *args, change=change: dict(base, **change))
        with pytest.raises(ValueError):
            worker.extract('abcdefghijk')
