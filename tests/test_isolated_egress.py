import importlib.util
from pathlib import Path
import socket
import socketserver
import os
import subprocess
import threading

import pytest

spec = importlib.util.spec_from_file_location('isolated_egress', Path(__file__).resolve().parents[1] / 'isolated' / 'egress.py')
egress = importlib.util.module_from_spec(spec)
spec.loader.exec_module(egress)


def record(ip):
    return (socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, 443))


def client_hello(host=b'www.youtube.com', ech=False, fragment=False):
    def vec(data, width):
        return len(data).to_bytes(width, 'big') + data
    names = b'\x00' + vec(host, 2)
    extensions = b'\x00\x00' + vec(vec(names, 2), 2) if host else b''
    if ech:
        extensions += b'\xfe\x0d\x00\x00'
    body = b'\x03\x03' + bytes(32) + vec(b'', 1) + vec(b'\x13\x01', 2) + vec(b'\x00', 1) + vec(extensions, 2)
    handshake = b'\x01' + vec(body, 3)
    def tls_record(data):
        return b'\x16\x03\x01' + vec(data, 2)
    return tls_record(handshake[:7]) + tls_record(handshake[7:]) if fragment else tls_record(handshake)


@pytest.mark.parametrize('hello,valid', [
    (client_hello(), True),
    (client_hello(fragment=True), True),
    (client_hello(b'other.youtube.com'), False),
    (client_hello(b''), False),
    (client_hello(ech=True), False),
    (b'\x17\x03\x03\x00\x01x', False),
])
def test_client_hello_validation(hello, valid):
    left, right = socket.socketpair()
    try:
        left.sendall(hello)
        left.shutdown(socket.SHUT_WR)
        if valid:
            assert egress.read_client_hello(right, 'www.youtube.com') == hello
        else:
            with pytest.raises(ValueError):
                egress.read_client_hello(right, 'www.youtube.com')
    finally:
        left.close()
        right.close()


@pytest.mark.parametrize('host', ['youtube.com.evil.com', 'evil.com', '127.0.0.1', 'YOUTUBE.COM', 'youtube.com.'])
def test_denies_unapproved_host(host):
    with pytest.raises(ValueError):
        egress.connect_public(host, resolver=lambda *a, **kw: [record('8.8.8.8')])


@pytest.mark.parametrize('ip', ['127.0.0.1', '169.254.169.254', '10.0.0.1', '224.0.0.1', '192.0.2.1'])
def test_denies_mixed_dns_answers(ip):
    with pytest.raises(ValueError):
        egress.connect_public('youtube.com', resolver=lambda *a, **kw: [record('8.8.8.8'), record(ip)])


def test_denies_mixed_ipv6_dns_answers():
    private = (socket.AF_INET6, socket.SOCK_STREAM, 6, '', ('::1', 443, 0, 0))
    with pytest.raises(ValueError):
        egress.connect_public('youtube.com', resolver=lambda *a, **kw: [record('8.8.8.8'), private])


def test_connects_exactly_to_validated_address():
    calls = []

    class FakeSocket:
        def settimeout(self, timeout):
            pass

        def connect(self, address):
            calls.append(address)

    egress.connect_public('youtube.com', resolver=lambda *a, **kw: [record('8.8.8.8')], connector=lambda *a: FakeSocket())
    assert calls == [('8.8.8.8', 443)]


@pytest.mark.skipif(not hasattr(socket, 'AF_UNIX'), reason='Unix sockets required')
def test_connect_protocol_over_real_socket(tmp_path, monkeypatch):
    path = str(tmp_path / 'proxy.sock')
    try:
        server = egress.Server(path, egress.Handler)
    except OSError as exc:
        pytest.skip(f'Unix socket unavailable: {exc}')
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    remote, peer = socket.socketpair()
    monkeypatch.setattr(egress, 'connect_public', lambda host: remote)
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(3)
            client.connect(path)
            client.sendall(b'CONNECT www.youtube.com:443 HTTP/1.1\r\nHost: www.youtube.com\r\n\r\n')
            assert b'200 Connection Established' in client.recv(1024)
            hello = client_hello()
            client.sendall(hello)
            received = b''
            while len(received) < len(hello):
                received += peer.recv(len(hello) - len(received))
            assert received == hello
            peer.sendall(b'world')
            assert client.recv(5) == b'world'
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(3)
            client.connect(path)
            client.sendall(b'GET http://youtube.com/ HTTP/1.1\r\nHost: youtube.com\r\n\r\n')
            assert b'403 Forbidden' in client.recv(1024)
    finally:
        peer.close()
        server.shutdown()
        server.server_close()
        server_thread.join()


@pytest.mark.skipif(not hasattr(socket, 'AF_UNIX'), reason='Unix sockets required')
def test_mismatched_sni_never_connects_upstream(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(egress, 'connect_public', lambda host: calls.append(host))
    try:
        server = egress.Server(str(tmp_path / 'proxy.sock'), egress.Handler)
    except OSError as exc:
        pytest.skip(f'Unix socket unavailable: {exc}')
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(3)
            client.connect(str(tmp_path / 'proxy.sock'))
            client.sendall(b'CONNECT www.youtube.com:443 HTTP/1.1\r\nHost: www.youtube.com\r\n\r\n')
            assert b'200 Connection Established' in client.recv(1024)
            client.sendall(client_hello(b'other.youtube.com'))
            assert client.recv(1024) == b''
        assert calls == []
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def test_concurrency_limit_releases_slots(monkeypatch):
    monkeypatch.setattr(egress, 'MAX_CONNECTIONS', 1)
    entered = threading.Event()
    release = threading.Event()

    class Blocking(socketserver.BaseRequestHandler):
        def handle(self):
            entered.set()
            release.wait(3)

    class Server(egress.LimitedThreads, socketserver.TCPServer):
        allow_reuse_address = True

    with Server(('127.0.0.1', 0), Blocking) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with socket.create_connection(server.server_address, timeout=3) as first:
                assert entered.wait(3)
                with socket.create_connection(server.server_address, timeout=3) as second:
                    second.settimeout(3)
                    assert second.recv(1) == b''
                release.set()
            server.shutdown()
        finally:
            release.set()
            thread.join()
        assert server._slots.acquire(blocking=False)
        server._slots.release()


@pytest.mark.skipif(os.environ.get('TEST_ISOLATED_EGRESS') != '1', reason='requires running experimental Docker proxy')
def test_real_container_relay_connect_and_tls():
    script = r'''
import socket, ssl, threading
from worker import Relay, Server
for address in [('1.1.1.1', 443), ('169.254.169.254', 80)]:
    try:
        socket.create_connection(address, timeout=2)
    except OSError:
        pass
    else:
        raise AssertionError('direct connection succeeded')
try:
    socket.getaddrinfo('youtube.com', 443)
except OSError:
    pass
else:
    raise AssertionError('direct DNS succeeded')
with Server(('127.0.0.1', 0), Relay) as relay:
    t = threading.Thread(target=relay.serve_forever, daemon=True)
    t.start()
    def request(host):
        s = socket.create_connection(relay.server_address, timeout=15)
        s.sendall(('CONNECT ' + host + ':443 HTTP/1.1\r\nHost: ' + host + '\r\n\r\n').encode())
        data = b''
        while not data.endswith(b'\r\n\r\n'):
            part = s.recv(1)
            if not part: raise AssertionError('proxy closed')
            data += part
        return s, data
    denied, response = request('example.com')
    assert b'403' in response, response
    denied.close()
    s, response = request('www.youtube.com')
    assert b'200' in response, response
    with ssl.create_default_context().wrap_socket(s, server_hostname='www.youtube.com') as tls:
        assert tls.version()
        print('verified TLS:', tls.version())
    relay.shutdown()
    t.join()
'''
    result = subprocess.run(['docker', 'compose', '-f', 'compose.isolated.yaml', '--profile', 'isolated-experiment',
                             'run', '--rm', '-T', '--no-deps', '--entrypoint', 'python', 'isolated-worker', '-'],
                            input=script, capture_output=True, text=True, timeout=90)
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'verified TLS:' in result.stdout
