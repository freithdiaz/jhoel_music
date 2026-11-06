"""Private, bounded Unix-socket protocol for the experimental worker."""
import json
import os
import re
import socket
import socketserver
import stat
import subprocess
import time
import urllib.parse

SOCKET = '/run/worker/worker.sock'
MAX_MESSAGE = 65536
VIDEO_ID = re.compile(r'[A-Za-z0-9_-]{11}\Z')
MAX_QUERY = 160
MAX_RESULTS = 10


def validate_url(url):
    try:
        if not isinstance(url, str) or not url or len(url) > 8192 or any(ord(c) <= 32 or ord(c) >= 127 or c == '\\' for c in url):
            raise ValueError()
        parts = urllib.parse.urlsplit(url)
        host = (parts.hostname or '').lower()
        if (parts.scheme != 'https' or parts.username is not None or parts.password is not None
                or parts.fragment or parts.port not in (None, 443)
                or not re.fullmatch(r'[a-z0-9.-]+', host)
                or not any(host == d or host.endswith('.' + d) for d in ('youtube.com', 'googlevideo.com'))):
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError('invalid worker URL') from None
    return url


def extract(video_id, path=SOCKET, timeout=70):
    if not isinstance(video_id, str) or not VIDEO_ID.fullmatch(video_id):
        raise ValueError('invalid video id')
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(timeout)
        client.connect(path)
        client.sendall(json.dumps({'extract': video_id}).encode('ascii') + b'\n')
        result = read_message(client, timeout, 16384)
    if result == {'status': 'failed'}:
        raise ValueError('worker failed')
    if set(result) != {'status', 'url'} or result['status'] != 'ok':
        raise ValueError('invalid worker response')
    return validate_url(result['url'])


def valid_text(value, limit):
    return (isinstance(value, str) and 0 < len(value) <= limit
            and all(ord(c) >= 32 and ord(c) != 127 for c in value)
            and not re.search(r'(?i)(?:https?://|www\.)', value))


def validate_results(result, limit):
    if not isinstance(result, dict) or set(result) != {'status', 'results'} or result['status'] != 'ok':
        raise ValueError('invalid worker response')
    entries = result['results']
    if not isinstance(entries, list) or len(entries) > limit:
        raise ValueError('invalid worker response')
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {'video_id', 'title', 'artist', 'duration'}:
            raise ValueError('invalid worker response')
        if (not isinstance(entry['video_id'], str) or not VIDEO_ID.fullmatch(entry['video_id'])
                or not valid_text(entry['title'], 200) or not valid_text(entry['artist'], 200)
                or type(entry['duration']) is not int or not 0 <= entry['duration'] <= 86400):
            raise ValueError('invalid worker response')
    return result


def read_message(sock, timeout, max_message=MAX_MESSAGE):
    data = bytearray()
    deadline = time.monotonic() + timeout
    while len(data) <= max_message:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('message timeout')
        sock.settimeout(remaining)
        chunk = sock.recv(1)
        if not chunk:
            raise ValueError('incomplete message')
        if chunk == b'\n':
            value = json.loads(data)
            if not isinstance(value, dict):
                raise ValueError('invalid message')
            return value
        data.extend(chunk)
    raise ValueError('message too large')


def invoke(video_id, path=SOCKET, timeout=70):
    if not isinstance(video_id, str) or not VIDEO_ID.fullmatch(video_id):
        raise ValueError('invalid video id')
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(timeout)
        client.connect(path)
        client.sendall(json.dumps({'video_id': video_id}).encode('ascii') + b'\n')
        result = read_message(client, timeout)
    if result not in ({'status': 'ok'}, {'status': 'failed'}):
        raise ValueError('invalid worker response')
    return result


def search(query, limit=5, path=SOCKET, timeout=70):
    if not valid_text(query, MAX_QUERY) or type(limit) is not int or not 1 <= limit <= MAX_RESULTS:
        raise ValueError('invalid search request')
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(timeout)
        client.connect(path)
        client.sendall(json.dumps({'query': query, 'limit': limit}).encode('ascii') + b'\n')
        result = read_message(client, timeout)
    if result == {'status': 'failed'}:
        return result
    return validate_results(result, limit)


class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.settimeout(5)
        try:
            request = read_message(self.request, 5, 4096)
            import worker
            if set(request) == {'extract'}:
                video_id = request['extract']
                if not isinstance(video_id, str) or not VIDEO_ID.fullmatch(video_id):
                    raise ValueError('invalid request')
                try:
                    result = {'status': 'ok', 'url': validate_url(worker.extract(video_id))}
                except (OSError, subprocess.SubprocessError, ValueError):
                    result = {'status': 'failed'}
                self.request.sendall(json.dumps(result).encode('ascii') + b'\n')
                return
            if set(request) == {'query', 'limit'}:
                query, limit = request['query'], request['limit']
                if not valid_text(query, MAX_QUERY) or type(limit) is not int or not 1 <= limit <= MAX_RESULTS:
                    raise ValueError('invalid request')
                try:
                    result = validate_results({'status': 'ok', 'results': worker.search(query, limit)}, limit)
                except (OSError, subprocess.SubprocessError, ValueError):
                    result = {'status': 'failed'}
                self.request.sendall(json.dumps(result).encode('ascii') + b'\n')
                return
            video_id = request.get('video_id')
            if set(request) != {'video_id'} or not isinstance(video_id, str) or not VIDEO_ID.fullmatch(video_id):
                raise ValueError('invalid request')
            try:
                status = 'ok' if worker.main(video_id) == 0 else 'failed'
            except (OSError, subprocess.SubprocessError):
                status = 'failed'
            self.request.sendall(json.dumps({'status': status}).encode('ascii') + b'\n')
        except (ValueError, UnicodeError, OSError):
            return


class Server(socketserver.TCPServer):
    address_family = getattr(socket, 'AF_UNIX', None)
    request_queue_size = 4

    def handle_error(self, request, client_address):
        # Worker errors may contain signed URLs; never print tracebacks here.
        pass


def serve(path=SOCKET):
    if os.path.lexists(path):
        if not stat.S_ISSOCK(os.lstat(path).st_mode):
            raise RuntimeError('socket path occupied')
        os.unlink(path)
    os.umask(0o077)
    with Server(path, Handler) as server:
        server.serve_forever()


if __name__ == '__main__':
    serve()
