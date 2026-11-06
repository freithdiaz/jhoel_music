"""Experimental CONNECT gateway; SNI checks cannot inspect encrypted HTTP Host.

TLS remains end-to-end. Allowed hosts sharing infrastructure can still front for
other hosts using encrypted HTTP, so this is not a standalone security boundary.
"""
import ipaddress
import json
import re
import select
import socket
import socketserver
import subprocess
import sys
import threading
import time

SOCKET = '/run/egress/proxy.sock'
MAX_HEADER = 8192
MAX_CLIENT_HELLO = 65536
MAX_CONNECTIONS = 16
HANDSHAKE_TIMEOUT = 10
MAX_TUNNEL_SECONDS = 60
HOST = re.compile(r'^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*(?:youtube\.com|googlevideo\.com)$')
DNS_TIMEOUT = 5


def resolve_bounded(host, port, *, type):
    # A separate process can be killed and reaped even if libc DNS hangs.
    script = ('import json,socket,sys; '
              'print(json.dumps(socket.getaddrinfo(sys.argv[1],443,type=socket.SOCK_STREAM)))')
    try:
        result = subprocess.run([sys.executable, '-I', '-c', script, host],
                                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=DNS_TIMEOUT, check=True)
        if len(result.stdout) > 65536:
            raise ValueError('DNS result too large')
        return json.loads(result.stdout)
    except (subprocess.SubprocessError, OSError, ValueError) as exc:
        raise ValueError('DNS resolution failed') from exc


def connect_public(host, resolver=resolve_bounded, connector=socket.socket):
    if not HOST.fullmatch(host) or len(host) > 253:
        raise ValueError('host denied')
    records = resolver(host, 443, type=socket.SOCK_STREAM)
    if not records:
        raise ValueError('empty DNS result')
    addresses = []
    for family, kind, proto, _, address in records:
        ip = ipaddress.ip_address(address[0])
        if not ip.is_global or ip.is_multicast or ip.is_unspecified or ip.is_reserved:
            raise ValueError('non-public DNS result')
        addresses.append((family, kind, proto, tuple(address)))
    family, kind, proto, address = addresses[0]
    upstream = connector(family, kind, proto)
    try:
        upstream.settimeout(10)
        upstream.connect(address)  # Connect to the validated numeric address, without another lookup.
        return upstream
    except BaseException:
        upstream.close()
        raise


def tunnel(left, right):
    left.settimeout(10)
    right.settimeout(10)
    deadline = time.monotonic() + MAX_TUNNEL_SECONDS
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        ready, _, _ = select.select([left, right], [], [], min(30, remaining))
        if not ready:
            return
        for source in ready:
            data = source.recv(65536)
            if not data:
                return
            (right if source is left else left).sendall(data)


def read_client_hello(sock, host):
    """Buffer bounded TLS records and require one cleartext SNI matching CONNECT."""
    deadline = time.monotonic() + HANDSHAKE_TIMEOUT
    wire = bytearray()
    handshake = bytearray()

    def receive(size):
        data = bytearray()
        while len(data) < size:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise ValueError('ClientHello timeout')
            sock.settimeout(remaining)
            part = sock.recv(size - len(data))
            if not part:
                raise ValueError('truncated TLS record')
            data.extend(part)
        return data

    while len(handshake) < 4 or len(handshake) < 4 + int.from_bytes(handshake[1:4], 'big'):
        header = receive(5)
        size = int.from_bytes(header[3:5], 'big')
        if header[0] != 22 or header[1] != 3 or not 0 < size <= 16384 or len(wire) + 5 + size > MAX_CLIENT_HELLO:
            raise ValueError('invalid TLS record')
        body = receive(size)
        wire.extend(header + body)
        handshake.extend(body)
        if len(handshake) >= 4 and (handshake[0] != 1 or int.from_bytes(handshake[1:4], 'big') > MAX_CLIENT_HELLO - 4):
            raise ValueError('invalid ClientHello')

    hello = bytes(handshake[4:4 + int.from_bytes(handshake[1:4], 'big')])
    pos = 0

    def take(size):
        nonlocal pos
        if size < 0 or pos + size > len(hello):
            raise ValueError('truncated ClientHello')
        result = hello[pos:pos + size]
        pos += size
        return result

    def vector(width):
        return take(int.from_bytes(take(width), 'big'))

    take(34)  # legacy version and random
    vector(1)  # session id
    ciphers = vector(2)
    compression = vector(1)
    if not ciphers or len(ciphers) % 2 or not compression:
        raise ValueError('invalid ClientHello parameters')
    extensions = vector(2)
    if pos != len(hello):
        raise ValueError('invalid ClientHello length')
    names = []
    seen = set()
    i = 0
    while i < len(extensions):
        if i + 4 > len(extensions):
            raise ValueError('truncated extension')
        kind = int.from_bytes(extensions[i:i + 2], 'big')
        length = int.from_bytes(extensions[i + 2:i + 4], 'big')
        i += 4
        if kind in seen or i + length > len(extensions) or kind == 0xfe0d:
            raise ValueError('duplicate, truncated or ECH extension')
        seen.add(kind)
        value = extensions[i:i + length]
        i += length
        if kind == 0:
            if len(value) < 2 or int.from_bytes(value[:2], 'big') != len(value) - 2:
                raise ValueError('invalid SNI list')
            j = 2
            while j < len(value):
                if j + 3 > len(value):
                    raise ValueError('truncated SNI')
                name_type = value[j]
                n = int.from_bytes(value[j + 1:j + 3], 'big')
                j += 3
                if not n or j + n > len(value):
                    raise ValueError('invalid SNI')
                if name_type == 0:
                    names.append(value[j:j + n])
                j += n
    if names != [host.encode('ascii')]:
        raise ValueError('missing or mismatched SNI')
    return bytes(wire)


class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.settimeout(10)
        upstream = None
        established = False
        try:
            header = b''
            deadline = time.monotonic() + HANDSHAKE_TIMEOUT
            while not header.endswith(b'\r\n\r\n'):
                if len(header) >= MAX_HEADER:
                    raise ValueError('header too long')
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ValueError('header timeout')
                self.request.settimeout(remaining)
                byte = self.request.recv(1)
                if not byte:
                    return
                header += byte
            lines = header.split(b'\r\n')
            match = re.fullmatch(rb'CONNECT ([a-z0-9.-]+):443 HTTP/1\.[01]', lines[0])
            if not match or any(not line or b':' not in line for line in lines[1:-2]):
                raise ValueError('invalid CONNECT')
            host = match.group(1).decode('ascii')
            if len(host) > 253 or not HOST.fullmatch(host):
                raise ValueError('host denied')
            self.request.sendall(b'HTTP/1.1 200 Connection Established\r\n\r\n')
            established = True
            hello = read_client_hello(self.request, host)
            upstream = connect_public(host)
            upstream.sendall(hello)
            tunnel(self.request, upstream)
        except (OSError, ValueError, UnicodeError):
            if not established:
                try:
                    self.request.sendall(b'HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
                except OSError:
                    pass
        finally:
            if upstream:
                upstream.close()


class LimitedThreads(socketserver.ThreadingMixIn):
    daemon_threads = True

    def __init__(self, *args, **kwargs):
        self._slots = threading.BoundedSemaphore(MAX_CONNECTIONS)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        if not self._slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self._slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._slots.release()


class Server(LimitedThreads, socketserver.TCPServer):
    address_family = getattr(socket, 'AF_UNIX', None)
    daemon_threads = True
    request_queue_size = 16


if __name__ == '__main__':
    import os
    # Only remove a stale socket, not an arbitrary file in the shared directory.
    import stat
    if os.path.lexists(SOCKET):
        if not stat.S_ISSOCK(os.lstat(SOCKET).st_mode):
            raise RuntimeError('socket path occupied')
        os.unlink(SOCKET)
    os.umask(0o077)
    with Server(SOCKET, Handler) as server:
        server.serve_forever()
