"""Pinned upstream transport and disabled public-route security tests."""
import socket
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import server


def addresses(*ips):
    return [(socket.AF_INET6 if ':' in ip else socket.AF_INET, socket.SOCK_STREAM, 6, '',
             (ip, 443, 0, 0) if ':' in ip else (ip, 443)) for ip in ips]


@pytest.mark.parametrize('ips', [
    ('8.8.8.8', '127.0.0.1'), ('10.0.0.1',), ('169.254.169.254',),
    ('::1',), ('fc00::1',), ('fe80::1',), ('::ffff:8.8.8.8',),
])
def test_non_public_or_mixed_dns_is_rejected_before_connect(ips):
    with patch('socket.getaddrinfo', return_value=addresses(*ips)), patch('socket.socket') as sock:
        with pytest.raises(ValueError):
            server.open_stream_url('https://r1.googlevideo.com/audio', {})
        sock.assert_not_called()


@pytest.mark.parametrize('ip', ['8.8.8.8', '2606:4700:4700::1111'])
def test_pinned_connection_tls_range_and_close(ip):
    response = Mock(status=206, headers={'Content-Range': 'bytes 0-10/100'})
    response.read.return_value = b'audio'
    raw, tls, connection = Mock(), Mock(), Mock()
    connection.getresponse.return_value = response
    context = Mock()
    context.wrap_socket.return_value = tls
    with patch('socket.getaddrinfo', return_value=addresses(ip)) as dns, \
         patch('socket.socket', return_value=raw), \
         patch('ssl.create_default_context', return_value=context), \
         patch('http.client.HTTPSConnection', return_value=connection), \
         patch('urllib.request.build_opener', side_effect=AssertionError('proxy used')):
        result = server.open_stream_url('https://r1.googlevideo.com/a?x=1', {'Range': 'bytes=0-10'})
        assert result.status == 206
        assert result.read() == b'audio'
        result.close()
    dns.assert_called_once()
    raw.connect.assert_called_once_with(addresses(ip)[0][4])
    raw.settimeout.assert_called_once_with(server.STREAM_TIMEOUT)
    context.wrap_socket.assert_called_once_with(raw, server_hostname='r1.googlevideo.com')
    connection.request.assert_called_once_with('GET', '/a?x=1', headers={
        'Host': 'r1.googlevideo.com', 'Accept-Encoding': 'identity', 'Range': 'bytes=0-10'})
    response.close.assert_called_once()
    connection.close.assert_called_once()


@pytest.mark.parametrize('url', ['http://googlevideo.com/', 'https://googlevideo.com.evil.test/',
    'https://googlevideo.com@evil.test/', 'https://googlevideo.com:444/',
    'https://googlevideo.com/\r\nX:bad', 'https://googlevideo.com/#fragment'])
def test_invalid_url_never_resolves(url):
    with patch('socket.getaddrinfo') as dns, pytest.raises(ValueError):
        server.open_stream_url(url, {})
    dns.assert_not_called()


@pytest.mark.parametrize('headers', [{'Cookie': 'secret'}, {'Range': 'bytes=0-1,3-4'}, {'Authorization': 'secret'}])
def test_forbidden_headers(headers):
    with patch('socket.getaddrinfo') as dns, pytest.raises(ValueError):
        server.open_stream_url('https://googlevideo.com/', headers)
    dns.assert_not_called()


def test_redirect_revalidates_and_closes_first_connection():
    response = Mock(status=302)
    response.getheader.return_value = 'https://evil.test/'
    connection = Mock()
    connection.getresponse.return_value = response
    with patch('socket.getaddrinfo', return_value=addresses('8.8.8.8')) as dns, \
         patch('socket.socket'), patch('ssl.create_default_context'), \
         patch('http.client.HTTPSConnection', return_value=connection):
        with pytest.raises(ValueError):
            server.open_stream_url('https://googlevideo.com/', {})
    dns.assert_called_once()
    response.close.assert_called_once()
    connection.close.assert_called_once()


def test_tls_failure_closes_socket():
    raw = Mock()
    with patch('socket.getaddrinfo', return_value=addresses('8.8.8.8')), \
         patch('socket.socket', return_value=raw), \
         patch('ssl.create_default_context') as context:
        context.return_value.wrap_socket.side_effect = OSError('TLS failure')
        with pytest.raises(OSError):
            server.open_stream_url('https://googlevideo.com/', {})
    raw.close.assert_called_once()


def test_redirect_resolves_and_pins_each_host():
    redirect = Mock(status=302)
    redirect.getheader.return_value = 'https://r2.googlevideo.com/next'
    final = Mock(status=200, headers={})
    first, second = Mock(), Mock()
    first.getresponse.return_value = redirect
    second.getresponse.return_value = final
    raw1, raw2 = Mock(), Mock()
    context = Mock()
    with patch('socket.getaddrinfo', side_effect=[addresses('8.8.8.8'), addresses('1.1.1.1')]) as dns, \
         patch('socket.socket', side_effect=[raw1, raw2]), \
         patch('ssl.create_default_context', return_value=context), \
         patch('http.client.HTTPSConnection', side_effect=[first, second]):
        result = server.open_stream_url('https://r1.googlevideo.com/start', {'Range': 'bytes=5-'})
        result.close()
    assert dns.call_count == 2
    raw1.connect.assert_called_once_with(('8.8.8.8', 443))
    raw2.connect.assert_called_once_with(('1.1.1.1', 443))
    assert [call.kwargs['server_hostname'] for call in context.wrap_socket.call_args_list] == ['r1.googlevideo.com', 'r2.googlevideo.com']
    first.close.assert_called_once()
    second.close.assert_called_once()
    assert second.request.call_args.kwargs['headers']['Range'] == 'bytes=5-'


def test_redirect_limit_closes_all_connections():
    response = Mock(status=302)
    response.getheader.return_value = '/again'
    connections = [Mock() for _ in range(server.STREAM_MAX_REDIRECTS + 1)]
    for connection in connections:
        connection.getresponse.return_value = response
    with patch('socket.getaddrinfo', return_value=addresses('8.8.8.8')), \
         patch('socket.socket'), patch('ssl.create_default_context'), \
         patch('http.client.HTTPSConnection', side_effect=connections):
        with pytest.raises(ValueError):
            server.open_stream_url('https://googlevideo.com/', {})
    assert all(connection.close.called for connection in connections)


def test_dns_timeout_and_connection_timeout_fail_closed():
    with patch('server.queue.Queue.get', side_effect=server.queue.Empty), patch('socket.getaddrinfo', return_value=addresses('8.8.8.8')), \
         patch('socket.socket') as sock, pytest.raises(TimeoutError):
        server.open_stream_url('https://googlevideo.com/', {})
    sock.assert_not_called()
    raw = Mock()
    raw.connect.side_effect = socket.timeout()
    with patch('socket.getaddrinfo', return_value=addresses('8.8.8.8')), \
         patch('socket.socket', return_value=raw), pytest.raises(socket.timeout):
        server.open_stream_url('https://googlevideo.com/', {})
    raw.close.assert_called_once()


@pytest.mark.parametrize('range_header', [None, 'bytes=0-10', 'bytes=5-', 'bytes=-50'])
def test_routes_remain_disabled(range_header):
    headers = [] if range_header is None else [(b'range', range_header.encode())]
    request = Request({'type': 'http', 'method': 'GET', 'path': '/stream_yt', 'headers': headers})
    with patch.object(server, 'get_stream_url') as extract, patch.object(server, 'open_stream_url') as upstream:
        with pytest.raises(HTTPException) as error:
            server.stream_yt(request, 'abcdefghijk')
        assert error.value.status_code == 503
        extract.assert_not_called()
        upstream.assert_not_called()


def test_search_and_spotify_resolution_do_not_access_network():
    with patch.object(server.yt_dlp, 'YoutubeDL') as extractor, \
         patch.object(server.urllib.request, 'urlopen') as urlopen:
        for operation in (lambda: server.search_online('music', 1),
                          lambda: server.resolve_spotify('https://open.spotify.com/track/test')):
            with pytest.raises(HTTPException) as error:
                operation()
            assert error.value.status_code == 503
        extractor.assert_not_called()
        urlopen.assert_not_called()
