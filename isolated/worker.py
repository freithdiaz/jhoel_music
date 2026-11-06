"""One-shot experimental yt-dlp worker with an AF_UNIX-backed loopback relay."""
import os
import json
import re
import socket
import socketserver
import subprocess
import sys
import threading

from egress import SOCKET, LimitedThreads, tunnel
import ipc

MAX_OUTPUT = 1024 * 1024


def bounded_output(args, env):
    with subprocess.Popen(args, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL) as process:
        output = bytearray()
        def collect():
            while True:
                chunk = process.stdout.read(65536)
                if not chunk:
                    break
                output.extend(chunk)
                if len(output) > MAX_OUTPUT:
                    process.kill()
                    break
        reader = threading.Thread(target=collect, daemon=True)
        reader.start()
        try:
            process.wait(timeout=60)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            raise
        finally:
            reader.join()
        if process.returncode != 0 or len(output) > MAX_OUTPUT:
            raise ValueError('worker failed')
        return json.loads(output)


def extract(video_id):
    if not isinstance(video_id, str) or not ipc.VIDEO_ID.fullmatch(video_id):
        raise ValueError('invalid video id')
    with Server(('127.0.0.1', 0), Relay) as relay:
        thread = threading.Thread(target=relay.serve_forever, daemon=True)
        thread.start()
        try:
            data = bounded_output([
                sys.executable, '-m', 'yt_dlp', '--ignore-config', '--no-plugin-dirs',
                '--no-playlist', '--skip-download', '--dump-single-json',
                '--format', 'bestaudio[ext=m4a]/bestaudio', '--socket-timeout', '10', '--retries', '0',
                '--proxy', f'http://127.0.0.1:{relay.server_address[1]}',
                '--', f'https://www.youtube.com/watch?v={video_id}',
            ], {'PATH': os.defpath, 'HOME': '/nonexistent', 'LANG': 'C.UTF-8'})
            if (not isinstance(data, dict) or data.get('has_drm') or data.get('_type') in ('playlist', 'multi_video')
                    or data.get('protocol') not in ('https', 'http')
                    or data.get('vcodec') != 'none' or data.get('acodec') in (None, 'none')):
                raise ValueError('unsupported media')
            return ipc.validate_url(data.get('url'))
        finally:
            relay.shutdown()
            thread.join()


class Relay(socketserver.BaseRequestHandler):
    def handle(self):
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as upstream:
            upstream.settimeout(10)
            upstream.connect(SOCKET)
            tunnel(self.request, upstream)


class Server(LimitedThreads, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = False


def main(video_id):
    if not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id):
        raise ValueError('invalid video id')
    with Server(('127.0.0.1', 0), Relay) as relay:
        thread = threading.Thread(target=relay.serve_forever, daemon=True)
        thread.start()
        try:
            # No inherited proxy configuration, cookies, home config or plugins.
            env = {'PATH': os.defpath, 'HOME': '/nonexistent', 'LANG': 'C.UTF-8'}
            result = subprocess.run([
                sys.executable, '-m', 'yt_dlp', '--ignore-config', '--no-plugin-dirs',
                '--no-playlist', '--skip-download', '--dump-single-json',
                '--socket-timeout', '10', '--retries', '0',
                '--proxy', f'http://127.0.0.1:{relay.server_address[1]}',
                '--', f'https://www.youtube.com/watch?v={video_id}',
            ], env=env, timeout=60, check=False, stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return result.returncode
        finally:
            relay.shutdown()
            thread.join()


def search(query, limit):
    if not ipc.valid_text(query, ipc.MAX_QUERY) or type(limit) is not int or not 1 <= limit <= ipc.MAX_RESULTS:
        raise ValueError('invalid search request')
    with Server(('127.0.0.1', 0), Relay) as relay:
        thread = threading.Thread(target=relay.serve_forever, daemon=True)
        thread.start()
        try:
            env = {'PATH': os.defpath, 'HOME': '/nonexistent', 'LANG': 'C.UTF-8'}
            with subprocess.Popen([
                sys.executable, '-m', 'yt_dlp', '--ignore-config', '--no-plugin-dirs',
                '--flat-playlist', '--skip-download', '--dump-single-json',
                '--socket-timeout', '10', '--retries', '0',
                '--proxy', f'http://127.0.0.1:{relay.server_address[1]}',
                '--', f'ytsearch{limit}:{query}',
            ], env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL) as process:
                output = bytearray()
                def collect():
                    while True:
                        chunk = process.stdout.read(65536)
                        if not chunk:
                            break
                        output.extend(chunk)
                        if len(output) > MAX_OUTPUT:
                            process.kill()
                            break
                reader = threading.Thread(target=collect, daemon=True)
                reader.start()
                try:
                    process.wait(timeout=60)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                    raise
                finally:
                    reader.join()
                if process.returncode != 0 or len(output) > MAX_OUTPUT:
                    raise ValueError('search failed')
            data = json.loads(output)
            if not isinstance(data, dict) or not isinstance(data.get('entries'), list):
                raise ValueError('invalid search output')
            results = []
            for entry in data['entries'][:limit]:
                if not isinstance(entry, dict):
                    continue
                item = {'video_id': entry.get('id'), 'title': entry.get('title'),
                        'artist': entry.get('artist') or entry.get('uploader') or entry.get('channel'),
                        'duration': entry.get('duration')}
                try:
                    ipc.validate_results({'status': 'ok', 'results': [item]}, 1)
                except ValueError:
                    continue
                results.append(item)
            return results
        finally:
            relay.shutdown()
            thread.join()


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('expected one YouTube video ID')
    sys.exit(main(sys.argv[1]))
