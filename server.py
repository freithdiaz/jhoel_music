"""
Thomas Music - Servidor Backend FastAPI & Streamer Universal (Full-Length Streaming)
Elimina el límite de 30 segundos: transmite cualquier canción de internet COMPLETA (3 a 5+ minutos)
en tiempo real a tu celular o PC sin descargarla al disco.
"""

import os
import time
import mimetypes
import urllib.request
import urllib.parse
import urllib.error
import json
import sqlite3
import hashlib
import hmac
import secrets
import re
import threading
import socket
import ssl
import ipaddress
import http.client
import queue
from contextlib import closing
from pathlib import Path
from typing import List, Optional, Dict
from pydantic import BaseModel, StrictBool
from fastapi import FastAPI, HTTPException, Request, status, Query, Header
from fastapi.responses import StreamingResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp
from dotenv import load_dotenv
from isolated import ipc as worker_ipc
from telegram_app_guard import operator_allowed
from telegram_bridge_queue import BridgeQueue, BridgeQueueError
from telegram_deletion_queue import DeletionQueue, DeletionError

# Opcional: configurar la variable YOUTUBE_API_KEY en el .env del proyecto;
# las variables explícitas del proceso tienen prioridad.
load_dotenv(Path(__file__).resolve().parent / ".env", override=False, encoding="utf-8-sig")

app = FastAPI(title="Thomas Music Universal Streamer", version="2.7.0")

def pilot_enabled():
    return os.environ.get('MUSIC_ISOLATED_PILOT') == '1'


def youtube_search_enabled():
    """La búsqueda de metadatos puede funcionar en el piloto aunque no haya worker.

    No habilita la descarga ni el streaming de YouTube; solo `/search_online`.
    """
    return pilot_enabled() or os.environ.get('MUSIC_TELEGRAM_PILOT_READY') == '1'


@app.middleware('http')
async def restrict_pilot_to_loopback(request, call_next):
    path = request.url.path.rstrip('/').split('/')[-1]
    if not youtube_search_enabled() or path not in ('stream_yt', 'search_online'):
        return await call_next(request)
    try:
        peer = ipaddress.ip_address(request.client.host)
        host = request.url.hostname
        origin = request.headers.get('origin')
        # Dentro de Docker la petición llega desde la red privada del puente.
        # Solo se tolera para la búsqueda de metadatos; stream_yt sigue
        # exigiendo loopback. El puerto del piloto permanece ligado a 127.0.0.1.
        peer_allowed = peer.is_loopback or (path == 'search_online' and peer.is_private)
        if not peer_allowed or host not in ('localhost', '127.0.0.1', '::1'):
            return JSONResponse(status_code=403, content={'detail': 'Acceso local únicamente'})
        if origin and urllib.parse.urlsplit(origin).hostname not in ('localhost', '127.0.0.1', '::1'):
            public_origin = os.environ.get('MUSIC_PUBLIC_ORIGIN', '').rstrip('/')
            if not public_origin or origin.rstrip('/') != public_origin:
                return JSONResponse(status_code=403, content={'detail': 'Origen no permitido'})
    except (ValueError, AttributeError):
        return JSONResponse(status_code=403, content={'detail': 'Acceso local únicamente'})
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost,http://localhost",
    ).split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Content-Length", "Accept-Ranges"]
)

MUSIC_DIR = Path(os.environ.get("MUSIC_DIR", "./music"))
MUSIC_DIR.mkdir(parents=True, exist_ok=True)
SUPPORTED_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".ogg"}

# Cache en memoria para URLs de streaming de YouTube para que el seek y los saltos sean instantáneos
STREAM_CACHE: Dict[str, tuple] = {}
STREAM_LOCKS = [threading.Lock() for _ in range(64)]
SEARCH_SLOTS = threading.BoundedSemaphore(6)
TELEGRAM_BRIDGE_QUEUE = BridgeQueue(clock=time.monotonic)
TELEGRAM_DELETION_QUEUE = DeletionQueue(clock=time.monotonic)
TELEGRAM_BRIDGE_HEARTBEAT_LOCK = threading.Lock()
TELEGRAM_BRIDGE_HEARTBEAT = {'at': 0.0, 'ready': False}

class SilentYdlLogger:
    def debug(self, message): pass
    def warning(self, message): pass
    def error(self, message): pass

# Opciones ultrarrápidas de búsqueda: extract_flat=True (responde en ~1 segundo en vez de 19s)
YDL_FAST_SEARCH_OPTS = {
    'extract_flat': True,
    'quiet': True,
    'no_warnings': True,
    'noplaylist': True,
    'skip_download': True,
    'js_runtimes': {'node': {}}, 'socket_timeout': 8, 'retries': 0, 'ignoreconfig': True, 'logger': SilentYdlLogger(),
}

# Opciones de extracción de audio individual al reproducir
YDL_STREAM_OPTS = {
    'format': 'bestaudio[ext=m4a]/bestaudio/best',
    'noplaylist': True,
    'quiet': True,
    'no_warnings': True,
    'skip_download': True,
    'js_runtimes': {'node': {}}, 'socket_timeout': 8, 'retries': 0, 'ignoreconfig': True, 'logger': SilentYdlLogger(),
}


def direct_youtube_search(query, limit):
    """Busca metadatos en YouTube sin descargar audio.

    Respaldo para el piloto cuando el worker aislado no está disponible.
    Solo devuelve entradas validadas y acotadas; no resuelve ni descarga
    URLs de audio.
    """
    with yt_dlp.YoutubeDL(YDL_FAST_SEARCH_OPTS) as ydl:
        info = ydl.extract_info(f'ytsearch{limit}:{query}', download=False)
    entries = info.get('entries') if isinstance(info, dict) else None
    results = []
    for entry in entries or []:
        if not isinstance(entry, dict) or len(results) >= limit:
            continue
        video_id = entry.get('id')
        title = entry.get('title')
        artist = entry.get('artist') or entry.get('uploader') or entry.get('channel') or 'YouTube'
        duration = entry.get('duration')
        if not (isinstance(video_id, str) and re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id)):
            continue
        if not worker_ipc.valid_text(title, 200):
            continue
        if not worker_ipc.valid_text(artist, 200):
            artist = 'YouTube'
        try:
            duration = int(duration)
        except (TypeError, ValueError):
            duration = 0
        if not 0 <= duration <= 86400:
            duration = 0
        results.append({'video_id': video_id, 'title': title,
                        'artist': artist, 'duration': duration})
    return results

def valid_video_id(video_id: str) -> bool:
    return isinstance(video_id, str) and re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id) is not None

def validate_upstream_url(url: str) -> str:
    try:
        if not isinstance(url, str) or len(url) > 8192 or any(ord(c) <= 32 or ord(c) >= 127 or c == '\\' for c in url):
            raise ValueError('Invalid upstream URL')
        parts = urllib.parse.urlsplit(url)
        host = (parts.hostname or '').lower()
        if (parts.scheme != 'https' or parts.username is not None or parts.password is not None
                or parts.fragment or not re.fullmatch(r'[a-z0-9.-]+', host)
                or parts.port not in (None, 443) or not any(host == domain or host.endswith('.' + domain)
                for domain in ('youtube.com', 'googlevideo.com'))):
            raise ValueError('Invalid upstream URL')
    except (ValueError, TypeError):
        raise ValueError('Invalid upstream URL') from None
    return url

class SafeStreamRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_upstream_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

STREAM_TIMEOUT = 8
STREAM_MAX_REDIRECTS = 5
_DNS_SLOTS = threading.BoundedSemaphore(6)

def _resolve_public(host):
    # getaddrinfo no admite timeout; limitar también los resolvers que queden bloqueados.
    if not _DNS_SLOTS.acquire(blocking=False):
        raise TimeoutError('DNS unavailable')
    result = queue.Queue(maxsize=1)
    def resolve():
        try:
            result.put((True, socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)))
        except Exception as exc:
            result.put((False, exc))
        finally:
            _DNS_SLOTS.release()
    try:
        threading.Thread(target=resolve, daemon=True).start()
    except Exception:
        _DNS_SLOTS.release()
        raise
    try:
        ok, addresses = result.get(timeout=STREAM_TIMEOUT)
    except queue.Empty:
        raise TimeoutError('DNS timeout') from None
    if not ok:
        raise OSError('DNS resolution failed') from addresses
    if not addresses:
        raise ValueError('No upstream addresses')
    validated = []
    for family, socktype, proto, _, sockaddr in addresses:
        if family not in (socket.AF_INET, socket.AF_INET6) or socktype != socket.SOCK_STREAM:
            raise ValueError('Invalid upstream address')
        ip = ipaddress.ip_address(sockaddr[0])
        if not ip.is_global or ip.is_multicast or ip.is_reserved or (isinstance(ip, ipaddress.IPv6Address) and (ip.ipv4_mapped or sockaddr[3])):
            raise ValueError('Non-public upstream address')
        if sockaddr[1] != 443:
            raise ValueError('Invalid upstream port')
        validated.append((family, socktype, proto, sockaddr))
    return validated

class _PinnedResponse:
    def __init__(self, response, connection):
        self._response = response
        self._connection = connection
        self.status = response.status
        self.headers = response.headers

    def read(self, size=-1):
        return self._response.read(size)

    def close(self):
        try:
            self._response.close()
        finally:
            self._connection.close()

def open_stream_url(url, headers):
    """Open an allowlisted HTTPS stream without proxying, cookies or DNS rebinding."""
    if set(headers) - {'Range'} or ('Range' in headers and not validate_range_header(headers['Range'])):
        raise ValueError('Invalid stream headers')
    for hop in range(STREAM_MAX_REDIRECTS + 1):
        validate_upstream_url(url)
        parts = urllib.parse.urlsplit(url)
        host = parts.hostname.lower()
        addresses = _resolve_public(host)
        family, socktype, proto, sockaddr = addresses[0]
        raw = socket.socket(family, socktype, proto)
        connection = None
        tls = None
        try:
            raw.settimeout(STREAM_TIMEOUT)
            raw.connect(sockaddr)
            tls = ssl.create_default_context().wrap_socket(raw, server_hostname=host)
            connection = http.client.HTTPSConnection(host, timeout=STREAM_TIMEOUT)
            connection.sock = tls
            target = urllib.parse.urlunsplit(('', '', parts.path or '/', parts.query, ''))
            connection.request('GET', target, headers={'Host': host, 'Accept-Encoding': 'identity', **headers})
            response = connection.getresponse()
            if response.status not in (301, 302, 303, 307, 308):
                return _PinnedResponse(response, connection)
            location = response.getheader('Location')
            response.close()
            connection.close()
            if not location or hop == STREAM_MAX_REDIRECTS:
                raise ValueError('Invalid stream redirect')
            url = urllib.parse.urljoin(url, location)
        except BaseException:
            if connection is not None:
                connection.close()
            elif tls is not None:
                tls.close()
            raw.close()
            raise

def get_stream_url(video_id: str) -> str:
    if not valid_video_id(video_id):
        raise ValueError('Invalid video ID')
    with STREAM_LOCKS[hash(video_id) % len(STREAM_LOCKS)]:
        cached = STREAM_CACHE.get(video_id)
        if cached and cached[1] > time.monotonic():
            return validate_upstream_url(cached[0])
        with yt_dlp.YoutubeDL(YDL_STREAM_OPTS) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
        if info.get('has_drm'):
            raise ValueError('Protected content is not supported')
        url = validate_upstream_url(info.get('url'))
        STREAM_CACHE[video_id] = (url, time.monotonic() + 300)
        return url

def invalidate_stream_url(video_id: str, rejected_url: str):
    with STREAM_LOCKS[hash(video_id) % len(STREAM_LOCKS)]:
        cached = STREAM_CACHE.get(video_id)
        if cached and cached[0] == rejected_url:
            STREAM_CACHE.pop(video_id, None)

# ==========================================
# BASE DE DATOS SQLITE: USUARIOS Y DATOS
# ==========================================
DB_PATH = Path(os.environ.get("MUSIC_DB_PATH", "./diaz_music_users.db"))

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at REAL NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_data (
            username TEXT PRIMARY KEY,
            playlists TEXT NOT NULL,
            favorites TEXT NOT NULL,
            taste_profile TEXT NOT NULL,
            updated_at REAL NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            expires_at REAL NOT NULL
        )
    """)
    if "revision" not in {row[1] for row in cursor.execute("PRAGMA table_info(user_data)")}:
        cursor.execute("ALTER TABLE user_data ADD COLUMN revision INTEGER NOT NULL DEFAULT 0")
    conn.commit()
    conn.close()

init_db()

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600000).hex()
    return f"pbkdf2_sha256$600000${salt}${digest}"

def verify_password(password: str, stored: str) -> bool:
    if not stored.startswith("pbkdf2_sha256$"):
        return hmac.compare_digest(stored, hashlib.sha256(password.encode()).hexdigest())
    try:
        _, iterations, salt, expected = stored.split("$")
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations)).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False

def create_session(conn, username: str) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))
    conn.execute("INSERT INTO sessions VALUES (?, ?, ?)",
                 (hashlib.sha256(token.encode()).hexdigest(), username, time.time() + 7 * 86400))
    conn.commit()
    return token

def require_user(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesión requerida")
    token_hash = hashlib.sha256(authorization[7:].encode()).hexdigest()
    with closing(sqlite3.connect(DB_PATH)) as conn:
        row = conn.execute("SELECT username FROM sessions WHERE token_hash = ? AND expires_at > ?", (token_hash, time.time())).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Sesión inválida o vencida")
    return row[0]


def require_telegram_operator(authorization: Optional[str]) -> str:
    """Autentica antes de aplicar la lista de operador; no activa Telegram."""
    username = require_user(authorization)
    if not operator_allowed(
        enabled=os.environ.get('MUSIC_TELEGRAM_ENABLED') == '1',
        configured_operator=os.environ.get('MUSIC_TELEGRAM_OPERATOR'),
        authenticated_user=username,
    ):
        raise HTTPException(status_code=403, detail='Integración Telegram no autorizada')
    return username


@app.get('/telegram/status')
def telegram_status(authorization: Optional[str] = Header(default=None)):
    require_telegram_operator(authorization)
    with TELEGRAM_BRIDGE_HEARTBEAT_LOCK:
        heartbeat = dict(TELEGRAM_BRIDGE_HEARTBEAT)
    elapsed = time.monotonic() - heartbeat['at']
    directory = os.environ.get('MUSIC_TELEGRAM_IMPORTED_DIR', '')
    ready = (os.environ.get('MUSIC_TELEGRAM_PILOT_READY') == '1'
             and os.environ.get('MUSIC_ENABLE_LOCAL_LIBRARY') == 'true'
             and bool(directory) and Path(directory).is_dir()
             and heartbeat['ready'] is True and 0 <= elapsed < 90)
    return {'ready': ready, 'detail': 'Puente disponible para prueba' if ready else 'Integración en preparación'}


def require_telegram_bridge(key: Optional[str]) -> None:
    """Credencial distinta a la sesión del usuario; nunca devolverla ni registrarla."""
    expected = os.environ.get('MUSIC_TELEGRAM_BRIDGE_KEY', '')
    if (os.environ.get('MUSIC_TELEGRAM_ENABLED') != '1'
            or not re.fullmatch(r'[A-Za-z0-9_-]{43,128}', expected)
            or not isinstance(key, str) or not key.isascii()
            or not hmac.compare_digest(key, expected)):
        raise HTTPException(status_code=403, detail='Puente no autorizado')


class TelegramImportTarget(BaseModel):
    title: str
    artist: str = ''
    album: str = ''
    duration: Optional[float] = None


class TelegramSearchRequest(BaseModel):
    query: str
    client_id: Optional[str] = None
    target: Optional[TelegramImportTarget] = None
    auto_select: StrictBool = False


class TelegramBridgeResult(BaseModel):
    identifier: str
    results: Optional[list[dict]] = None
    failed: bool = False


class TelegramSelectionRequest(BaseModel):
    result_id: str
    accepts_group_publication: StrictBool
    accepts_uncertainty: StrictBool
    rights_confirmed: StrictBool
    auto_download: StrictBool = False


class TelegramSelectionCheck(BaseModel):
    identifier: str
    verified: StrictBool


class TelegramCallbackResult(BaseModel):
    identifier: str
    confirmed: StrictBool
    receipt: Optional[dict] = None


class TelegramReceiptApproval(BaseModel):
    receipt_id: str
    recognized: StrictBool
    rights_confirmed: StrictBool


class TelegramDownloadResult(BaseModel):
    identifier: str
    saved: StrictBool
    validated: StrictBool = False
    published: StrictBool = False


class TelegramDownloadProgress(BaseModel):
    identifier: str
    received: int
    total: int


class TelegramHeartbeat(BaseModel):
    session_present: StrictBool
    callback_enabled: StrictBool
    download_enabled: StrictBool
    publish_enabled: StrictBool
    delete_enabled: StrictBool


class TelegramDeleteRequest(BaseModel):
    filename: str
    confirmed: StrictBool
    client_id: Optional[str] = None


class TelegramDeleteResult(BaseModel):
    identifier: str
    deleted: StrictBool


@app.post('/telegram/search')
def telegram_search(req: TelegramSearchRequest, authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    try:
        target = req.target.model_dump() if req.target is not None else None
        return {'id': TELEGRAM_BRIDGE_QUEUE.submit(
            operator=operator, query=req.query, identifier=req.client_id,
            target=target, auto_select=req.auto_select)}
    except BridgeQueueError:
        raise HTTPException(status_code=409, detail='Búsqueda inválida o hay una solicitud pendiente') from None


@app.get('/telegram/active-search')
def telegram_active_search(authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    return {'job': TELEGRAM_BRIDGE_QUEUE.active(operator=operator)}


@app.get('/telegram/search/{identifier}')
def telegram_search_result(identifier: str, authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    try:
        return TELEGRAM_BRIDGE_QUEUE.result(identifier=identifier, operator=operator)
    except BridgeQueueError:
        raise HTTPException(status_code=404, detail='Solicitud no encontrada') from None


@app.delete('/telegram/search/{identifier}')
def telegram_search_clear(identifier: str, authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    try:
        TELEGRAM_BRIDGE_QUEUE.clear(identifier=identifier, operator=operator)
    except BridgeQueueError:
        raise HTTPException(status_code=409, detail='Solicitud no se puede cerrar') from None
    return {'closed': True}


@app.post('/telegram/search/{identifier}/select')
def telegram_select(identifier: str, req: TelegramSelectionRequest,
                    authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    try:
        TELEGRAM_BRIDGE_QUEUE.select(identifier=identifier, operator=operator, result_id=req.result_id,
                                    accepts_group_publication=req.accepts_group_publication,
                                    accepts_uncertainty=req.accepts_uncertainty,
                                    rights_confirmed=req.rights_confirmed, auto_download=req.auto_download)
    except BridgeQueueError:
        raise HTTPException(status_code=409, detail='Selección o confirmación inválida') from None
    return {'selected': True, 'callback_sent': False}


@app.post('/telegram/bridge/claim-selection')
def telegram_bridge_claim_selection(x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    return {'selection': TELEGRAM_BRIDGE_QUEUE.claim_selection()}


@app.post('/telegram/bridge/selection-check')
def telegram_bridge_selection_check(req: TelegramSelectionCheck,
                                    x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    try:
        TELEGRAM_BRIDGE_QUEUE.finish_selection_check(identifier=req.identifier, verified=req.verified)
    except BridgeQueueError:
        raise HTTPException(status_code=409, detail='Selección no disponible') from None
    return {'accepted': True, 'callback_sent': False}


@app.post('/telegram/bridge/callback-result')
def telegram_bridge_callback_result(req: TelegramCallbackResult,
                                    x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    try:
        TELEGRAM_BRIDGE_QUEUE.finish_callback(identifier=req.identifier, confirmed=req.confirmed, receipt=req.receipt)
    except BridgeQueueError:
        raise HTTPException(status_code=409, detail='Selección no disponible') from None
    return {'accepted': True}


@app.get('/telegram/search/{identifier}/receipt')
def telegram_receipt(identifier: str, authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    try:
        return {'receipt': TELEGRAM_BRIDGE_QUEUE.receipt(identifier=identifier, operator=operator)}
    except BridgeQueueError:
        raise HTTPException(status_code=404, detail='Solicitud no encontrada') from None


@app.post('/telegram/search/{identifier}/approve-receipt')
def telegram_approve_receipt(identifier: str, req: TelegramReceiptApproval,
                             authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    try:
        TELEGRAM_BRIDGE_QUEUE.approve_receipt(identifier=identifier, operator=operator,
                                              receipt_id=req.receipt_id, recognized=req.recognized,
                                              rights_confirmed=req.rights_confirmed)
    except BridgeQueueError:
        raise HTTPException(status_code=409, detail='Candidato o confirmación inválidos') from None
    return {'approved': True, 'downloaded': False}


@app.post('/telegram/bridge/claim-download')
def telegram_bridge_claim_download(x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    return {'download': TELEGRAM_BRIDGE_QUEUE.claim_download()}


def newest_imported_filename():
    """Devuelve el MP3 importado más reciente, sin seguir enlaces simbólicos."""
    directory = os.environ.get('MUSIC_TELEGRAM_IMPORTED_DIR', '')
    if not directory:
        return None
    try:
        candidates = []
        for path in Path(directory).glob('telegram-*.mp3'):
            try:
                if (re.fullmatch(r'telegram-[0-9a-f]{32}\.mp3', path.name)
                        and not path.is_symlink() and path.is_file()):
                    candidates.append((path.stat().st_mtime_ns, path.name))
            except OSError:
                continue
        return max(candidates)[1] if candidates else None
    except OSError:
        return None


@app.post('/telegram/bridge/download-result')
def telegram_bridge_download_result(req: TelegramDownloadResult,
                                    x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    try:
        filename = newest_imported_filename() if req.published else None
        TELEGRAM_BRIDGE_QUEUE.finish_download(identifier=req.identifier, saved=req.saved,
                                              validated=req.validated, published=req.published,
                                              filename=filename)
    except BridgeQueueError:
        raise HTTPException(status_code=409, detail='Descarga no disponible') from None
    return {'accepted': True}


@app.post('/telegram/bridge/download-progress')
def telegram_bridge_download_progress(req: TelegramDownloadProgress,
                                      x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    try:
        TELEGRAM_BRIDGE_QUEUE.download_progress(identifier=req.identifier, received=req.received, total=req.total)
    except BridgeQueueError:
        raise HTTPException(status_code=409, detail='Progreso inválido o descarga no disponible') from None
    return {'accepted': True}


@app.post('/telegram/library/delete')
def telegram_delete(req: TelegramDeleteRequest, authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    try:
        return {'id': TELEGRAM_DELETION_QUEUE.submit(operator=operator, filename=req.filename,
                                                    confirmed=req.confirmed, identifier=req.client_id)}
    except DeletionError:
        raise HTTPException(status_code=409, detail='Eliminación inválida o pendiente') from None


@app.get('/telegram/library/delete/{identifier}')
def telegram_delete_status(identifier: str, authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    try:
        return TELEGRAM_DELETION_QUEUE.status(identifier=identifier, operator=operator)
    except DeletionError:
        raise HTTPException(status_code=404, detail='Solicitud no encontrada') from None


@app.delete('/telegram/library/delete/{identifier}')
def telegram_delete_clear(identifier: str, authorization: Optional[str] = Header(default=None)):
    operator = require_telegram_operator(authorization)
    try:
        TELEGRAM_DELETION_QUEUE.clear(identifier=identifier, operator=operator)
    except DeletionError:
        raise HTTPException(status_code=409, detail='Eliminación no se puede cerrar') from None
    return {'closed': True}


@app.post('/telegram/bridge/claim-delete')
def telegram_bridge_claim_delete(x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    return {'delete': TELEGRAM_DELETION_QUEUE.claim()}


@app.post('/telegram/bridge/delete-result')
def telegram_bridge_delete_result(req: TelegramDeleteResult, x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    try:
        TELEGRAM_DELETION_QUEUE.finish(identifier=req.identifier, deleted=req.deleted)
    except DeletionError:
        raise HTTPException(status_code=409, detail='Eliminación no disponible') from None
    return {'accepted': True}


@app.post('/telegram/bridge/claim')
def telegram_bridge_claim(x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    return {'job': TELEGRAM_BRIDGE_QUEUE.claim()}


@app.post('/telegram/bridge/heartbeat')
def telegram_bridge_heartbeat(req: TelegramHeartbeat, x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    with TELEGRAM_BRIDGE_HEARTBEAT_LOCK:
        TELEGRAM_BRIDGE_HEARTBEAT.update(at=time.monotonic(), ready=all((req.session_present,
            req.callback_enabled, req.download_enabled, req.publish_enabled, req.delete_enabled)))
    return {'accepted': True}


@app.post('/telegram/bridge/finish')
def telegram_bridge_finish(req: TelegramBridgeResult, x_telegram_bridge_key: Optional[str] = Header(default=None)):
    require_telegram_bridge(x_telegram_bridge_key)
    try:
        TELEGRAM_BRIDGE_QUEUE.finish(identifier=req.identifier, results=req.results, failed=req.failed)
    except BridgeQueueError:
        raise HTTPException(status_code=409, detail='Respuesta inválida o solicitud no disponible') from None
    return {'accepted': True}

class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class UserSyncRequest(BaseModel):
    username: str
    base_revision: int
    playlists: list = []
    favorites: list = []
    taste_profile: dict = {}

# ==========================================
# ENDPOINTS DE AUTENTICACIÓN & MULTIUSUARIO
# ==========================================
@app.post("/auth/register")
def register(req: RegisterRequest):
    u = req.username.strip().lower()
    p = req.password.strip()
    if not u or len(u) < 3:
        raise HTTPException(status_code=400, detail="El nombre de usuario debe tener al menos 3 caracteres")
    if len(p) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")

    name = (req.display_name or u).strip()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE username = ?", (u,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Ese nombre de usuario ya está registrado")

        user_id = f"user-{int(time.time() * 1000)}"
        cursor.execute(
            "INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, u, hash_password(p), name, time.time())
        )
        cursor.execute(
            "INSERT INTO user_data (username, playlists, favorites, taste_profile, updated_at) VALUES (?, ?, ?, ?, ?)",
            (u, "[]", "[]", "{}", time.time())
        )
        conn.commit()
        return {
            "status": "success",
            "token": create_session(conn, u),
            "user": {
                "id": user_id,
                "username": u,
                "displayName": name,
                "createdAt": time.time()
            }
        }
    finally:
        conn.close()

@app.post("/auth/login")
def login(req: LoginRequest):
    u = req.username.strip().lower()
    p = req.password.strip()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, username, password_hash, display_name, created_at FROM users WHERE username = ?", (u,))
        row = cursor.fetchone()
        if not row or not verify_password(p, row[2]):
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

        if not row[2].startswith("pbkdf2_sha256$"):
            cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (hash_password(p), u))
            conn.commit()

        cursor.execute("SELECT playlists, favorites, taste_profile, revision FROM user_data WHERE username = ?", (u,))
        data_row = cursor.fetchone()
        playlists = json.loads(data_row[0]) if data_row and data_row[0] else []
        favorites = json.loads(data_row[1]) if data_row and data_row[1] else []
        taste_profile = json.loads(data_row[2]) if data_row and data_row[2] else {"favoriteArtists": {}, "favoriteGenres": {}}

        return {
            "status": "success",
            "token": create_session(conn, u),
            "user": {
                "id": row[0],
                "username": row[1],
                "displayName": row[3],
                "createdAt": row[4]
            },
            "data": {
                "playlists": playlists,
                "favorites": favorites,
                "tasteProfile": taste_profile,
                "revision": data_row[3] if data_row else 0
            }
        }
    finally:
        conn.close()

@app.post("/user/sync")
def sync_user_data(req: UserSyncRequest, authorization: Optional[str] = Header(default=None)):
    u = req.username.strip().lower()
    if require_user(authorization) != u:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE user_data SET playlists = ?, favorites = ?, taste_profile = ?,
                updated_at = ?, revision = revision + 1
            WHERE username = ? AND revision = ?
        """, (json.dumps(req.playlists), json.dumps(req.favorites), json.dumps(req.taste_profile), time.time(), u, req.base_revision))
        if cursor.rowcount != 1:
            raise HTTPException(status_code=409, detail="Los datos cambiaron en otro dispositivo")
        conn.commit()
        return {"status": "synced", "revision": req.base_revision + 1}
    finally:
        conn.close()

@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    require_user(authorization)
    token_hash = hashlib.sha256(authorization[7:].encode()).hexdigest()
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        conn.commit()
    return {"status": "logged_out"}

@app.get("/user/data/{username}")
def get_user_data(username: str, authorization: Optional[str] = Header(default=None)):
    u = username.strip().lower()
    if require_user(authorization) != u:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT playlists, favorites, taste_profile, revision FROM user_data WHERE username = ?", (u,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Datos no encontrados")
        return {
            "playlists": json.loads(row[0]),
            "favorites": json.loads(row[1]),
            "tasteProfile": json.loads(row[2]),
            "revision": row[3]
        }
    finally:
        conn.close()

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "Thomas Music Universal Streamer",
        "full_length_streaming": True,
        "mode": "Sin límite de 30 segundos • Canciones 100% completas",
        "local_tracks": len(list(MUSIC_DIR.glob("*.*")))
    }

# ==========================================
# 1. BÚSQUEDA RÁPIDA Y SUGERENCIAS EN VIVO (AUTOCLETO)
# ==========================================
@app.get("/suggestions")
def get_suggestions(q: str = Query(..., max_length=200, description="Término para autocompletar sugerencias")):
    """
    Autocompletado de búsqueda en milisegundos (~30ms) usando el motor de sugerencias.
    Devuelve lista de sugerencias de canciones y artistas populares.
    """
    query = q.strip()
    if not query:
        return []
    try:
        url = f"https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q={urllib.parse.quote(query)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=1.8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list):
                return data[1][:10]
    except Exception as e:
        print(f"Error obteniendo sugerencias: {e}")
    return []

@app.get("/youtube/search")
def youtube_search(q: str = Query(..., min_length=2, max_length=200)):
    key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="YouTube no está configurado: falta YOUTUBE_API_KEY en el servidor.")
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(status_code=422, detail="Escribe al menos dos caracteres.")
    params = urllib.parse.urlencode({"part": "snippet", "type": "video", "videoEmbeddable": "true", "videoCategoryId": "10", "maxResults": 25, "q": query})
    try:
        request = urllib.request.Request("https://www.googleapis.com/youtube/v3/search?" + params, headers={"x-goog-api-key": key})
        with urllib.request.urlopen(request, timeout=8) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        error.close()
        if error.code in (403, 429):
            raise HTTPException(status_code=503, detail="YouTube rechazó la consulta: comprueba la clave, los permisos o la cuota.")
        raise HTTPException(status_code=502, detail="No se pudo consultar YouTube.")
    except (OSError, ValueError):
        raise HTTPException(status_code=502, detail="No se pudo consultar YouTube.")
    results = []
    for item in data.get("items", []):
        video_id = item.get("id", {}).get("videoId", "")
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            continue
        snippet = item.get("snippet", {})
        results.append({"id": "yt-" + video_id, "title": snippet.get("title", "Video"),
            "artist": snippet.get("channelTitle", "YouTube"), "album": "YouTube",
            "duration": 0, "bpm": 0, "keySignature": "Desconocida", "energy": 0,
            "acousticness": 0, "danceability": 0, "genre": "YouTube",
            "coverUrl": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg", "audioUrl": "",
            "sourceType": "youtube", "cachedOffline": False, "liked": False, "lyrics": []})
    return results

@app.get("/search_online")
def search_online(
    q: str = Query(..., max_length=200, description="Nombre de la canción o artista"),
    limit: int = Query(10, description="Número de resultados a extraer (máximo 50)")
):
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(status_code=422, detail="Escribe al menos dos caracteres.")
    if not youtube_search_enabled():
        raise HTTPException(status_code=503, detail='Búsqueda de YouTube deshabilitada por seguridad.')
    if not worker_ipc.valid_text(query, worker_ipc.MAX_QUERY) or type(limit) is not int or not 1 <= limit <= 50:
        raise HTTPException(status_code=422, detail='Consulta inválida')
    limit = min(limit, worker_ipc.MAX_RESULTS)
    if not SEARCH_SLOTS.acquire(blocking=False):
        raise HTTPException(status_code=503, detail='El servidor está ocupado. Inténtalo de nuevo.', headers={'Retry-After': '5'})
    try:
        try:
            data = worker_ipc.search(query, limit, path=os.environ.get('MUSIC_WORKER_SOCKET', worker_ipc.SOCKET))
            if data.get('status') != 'ok':
                raise ValueError('worker unavailable')
            items = data['results']
        except Exception:
            # El piloto puede ejecutarse sin el worker aislado. El respaldo
            # solo busca metadatos; no descarga audio de YouTube.
            items = direct_youtube_search(query, limit)
        results = []
        for item in items:
            video_id = item['video_id']
            results.append({'id': 'yt-' + video_id, 'title': item['title'],
                'artist': item['artist'], 'album': 'YouTube',
                'duration': item.get('duration') or 0, 'bpm': 0, 'keySignature': 'Desconocida',
                'energy': 0, 'acousticness': 0, 'danceability': 0, 'genre': 'YouTube',
                'coverUrl': f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
                'audioUrl': f'/stream_yt?v={video_id}', 'sourceType': 'invidious',
                'cachedOffline': False, 'liked': False, 'lyrics': []})
        return results
    except Exception:
        raise HTTPException(status_code=502, detail='No se pudo consultar el catálogo de audio') from None
    finally:
        SEARCH_SLOTS.release()

# ==========================================
# 2. PROXY DE STREAMING EN VIVO (CANCIONES COMPLETAS)
# ==========================================
@app.get("/prepare_stream")
def prepare_stream(v: str = Query(..., min_length=11, max_length=11, pattern=r"^[A-Za-z0-9_-]{11}$")):
    """Prepara solo el enlace de la siguiente pista; no descarga el audio."""
    if not valid_video_id(v):
        raise HTTPException(status_code=422, detail='ID de video inválido')
    raise HTTPException(status_code=503, detail='Streaming de YouTube deshabilitado por seguridad.')

def _stream_pilot(v, range_header):
    if not pilot_enabled():
        raise HTTPException(status_code=503, detail='Streaming de YouTube deshabilitado por seguridad.')
    if not SEARCH_SLOTS.acquire(blocking=False):
        raise HTTPException(status_code=503, detail='Servidor ocupado')
    upstream = None
    try:
        url = worker_ipc.extract(v, path=os.environ.get('MUSIC_WORKER_SOCKET', worker_ipc.SOCKET))
        upstream = open_stream_url(validate_upstream_url(url), {'Range': range_header} if range_header else {})
        if upstream.status not in (200, 206) or (range_header and upstream.status != 206):
            raise ValueError('invalid upstream status')
        headers = {'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes',
                   'Content-Type': 'application/octet-stream', 'X-Content-Type-Options': 'nosniff'}
        for name in ('Content-Length', 'Content-Range'):
            value = upstream.headers.get(name)
            if value and len(value) <= 200 and all(32 <= ord(c) < 127 for c in value):
                headers[name] = value
        if 'Content-Length' in headers and not re.fullmatch(r'[0-9]{1,19}', headers['Content-Length']):
            raise ValueError('invalid content length')
        if upstream.status == 206 and not re.fullmatch(r'bytes [0-9]{1,19}-[0-9]{1,19}/(?:[0-9]{1,19}|\*)', headers.get('Content-Range', '')):
            raise ValueError('invalid content range')
        def chunks():
            try:
                while True:
                    chunk = upstream.read(65536)
                    if not chunk:
                        break
                    yield chunk
            except Exception:
                return
            finally:
                upstream.close()
                SEARCH_SLOTS.release()
        return StreamingResponse(chunks(), status_code=upstream.status, headers=headers)
    except Exception:
        if upstream is not None:
            upstream.close()
        SEARCH_SLOTS.release()
        raise HTTPException(status_code=502, detail='No se pudo abrir el audio') from None

def validate_range_header(value: str) -> bool:
    match = re.fullmatch(r'bytes=(\d{1,19})?-(\d{1,19})?', value, flags=re.ASCII)
    if not match or not any(match.groups()):
        return False
    start, end = match.groups()
    if start is None:
        return int(end) > 0
    return end is None or int(start) <= int(end)

@app.get("/stream_yt")
def stream_yt(request: Request, v: str = Query(..., min_length=11, max_length=11, pattern=r"^[A-Za-z0-9_-]{11}$", description="ID del video de YouTube")):
    """
    Proxy de streaming en tiempo real:
    Lee los bytes directamente de los servidores CDN de YouTube y los envía al celular/PC
    con soporte de Range Requests y cabeceras CORS.
    NO hay límite de 30 segundos: se reproduce la canción COMPLETA de inicio a fin.
    """
    if not valid_video_id(v):
        raise HTTPException(status_code=422, detail='ID de video inválido')
    range_header = request.headers.get('range')
    if range_header is not None and not validate_range_header(range_header):
        raise HTTPException(status_code=416, detail='Range inválido')
    return _stream_pilot(v, range_header)
# ==========================================
# 3. RESOLVER ENLACES DE SPOTIFY A CANCIONES COMPLETAS
# ==========================================
@app.get("/resolve_spotify")
def resolve_spotify(url: str = Query(..., max_length=2048, description="URL de Spotify track")):
    """
    Recibe un enlace de Spotify, extrae metadata de Spotify y resuelve
    hacia la pista oficial completa en streaming sin límite de tiempo.
    """
    # También utiliza el extractor heredado; no consultar siquiera oEmbed mientras esté bloqueado.
    raise HTTPException(status_code=503, detail='Resolución de YouTube deshabilitada por seguridad.')
    try:
        oembed_url = f"https://open.spotify.com/oembed?url={urllib.parse.quote(url)}"
        req = urllib.request.Request(oembed_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())

        title = data.get("title", "")
        artist = data.get("author_name", "")
        thumbnail = data.get("thumbnail_url", "")

        # Buscar el audio completo en YouTube Music
        search_query = f"{artist} - {title} audio"
        with yt_dlp.YoutubeDL(YDL_FAST_SEARCH_OPTS) as ydl:
            info = ydl.extract_info(f"ytsearch1:{search_query}", download=False)
            entry = info['entries'][0] if 'entries' in info and info['entries'] else info
            video_id = entry.get('id')

            return {
                "id": f"spotify-{video_id}",
                "title": title,
                "artist": artist,
                "album": "Posible coincidencia de YouTube",
                "duration": int(entry.get('duration') or 210),
                "bpm": 122,
                "keySignature": "A Minor",
                "coverUrl": thumbnail or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "audioUrl": f"/stream_yt?v={video_id}",
                "sourceType": "rea-reverse"
            }
    except Exception as e:
        print(f"Error en resolve_spotify: {e}")
        raise HTTPException(status_code=502, detail="No se pudo resolver el enlace")

# ==========================================
# 4. BIBLIOTECA LOCAL EN PC O NAS
# ==========================================
@app.get("/tracks")
def list_tracks():
    tracks = []
    for idx, file_path in enumerate(MUSIC_DIR.glob("*.*")):
        if file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            clean_name = file_path.stem
            parts = clean_name.split(" - ")
            artist = parts[0].strip() if len(parts) > 1 else "Thomas Music Local"
            title = parts[1].strip() if len(parts) > 1 else clean_name

            tracks.append({
                "id": f"local-srv-{idx}",
                "filename": file_path.name,
                "title": title,
                "artist": artist,
                "album": "Biblioteca Local PC/NAS",
                "duration": 200,
                "bpm": 120,
                "keySignature": "C Major",
                "coverUrl": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
                "audioUrl": f"/stream/{urllib.parse.quote(file_path.name)}",
                "sourceType": "fastapi"
            })
    imported_dir = os.environ.get('MUSIC_TELEGRAM_IMPORTED_DIR', '')
    if imported_dir:
        directory = Path(imported_dir)
        paths = []
        for candidate in directory.glob('telegram-*.mp3'):
            try:
                paths.append((candidate.stat().st_mtime_ns, candidate))
            except OSError:
                continue
        paths.sort(key=lambda item: item[0], reverse=True)
        for _, file_path in paths:
            if (not re.fullmatch(r'telegram-[0-9a-f]{32}\.mp3', file_path.name)
                    or file_path.is_symlink() or not file_path.is_file()):
                continue
            metadata = {}
            metadata_path = file_path.with_suffix('.json')
            try:
                if not metadata_path.is_symlink():
                    with metadata_path.open('rb') as source:
                        raw = source.read(4097)
                    if len(raw) <= 4096:
                        parsed = json.loads(raw)
                        if isinstance(parsed, dict):
                            metadata = {key: value for key, value in parsed.items()
                                        if key in ('title', 'artist', 'album', 'genre')
                                        and isinstance(value, str) and 0 < len(value) <= 120
                                        and all(c.isprintable() for c in value)}
            except (OSError, ValueError, UnicodeError):
                pass
            cover = file_path.with_suffix('.jpg')
            cover_url = (f'/telegram/cover/{cover.name}' if not cover.is_symlink() and cover.is_file() else None)
            tracks.append({
                'id': 'telegram-' + file_path.stem.removeprefix('telegram-'),
                'filename': file_path.name,
                'title': metadata.get('title', 'Importación Telegram · ' + file_path.stem[-8:]),
                'artist': metadata.get('artist', 'Biblioteca personal'),
                'album': metadata.get('album', 'Importaciones Telegram'),
                'genre': metadata.get('genre', 'Sin género'), 'cover_url': cover_url,
                'duration': 200, 'bpm': 120, 'keySignature': 'C Major',
                'audioUrl': f'/stream/{urllib.parse.quote(file_path.name)}', 'sourceType': 'fastapi',
            })
    return tracks


@app.get('/telegram/cover/{filename}')
def telegram_cover(filename: str):
    directory = os.environ.get('MUSIC_TELEGRAM_IMPORTED_DIR', '')
    if not directory or not re.fullmatch(r'telegram-[0-9a-f]{32}\.jpg', filename):
        raise HTTPException(status_code=404, detail='Carátula no encontrada')
    path = Path(directory) / filename
    try:
        if path.is_symlink():
            raise ValueError
        with path.open('rb') as source:
            data = source.read(2 * 1024 * 1024 + 1)
        if not data.startswith(b'\xff\xd8\xff') or len(data) > 2 * 1024 * 1024:
            raise ValueError
    except (OSError, ValueError):
        raise HTTPException(status_code=404, detail='Carátula no encontrada') from None
    return Response(data, media_type='image/jpeg', headers={'X-Content-Type-Options': 'nosniff'})

def send_partial_file(request: Request, path: Path):
    file_size = path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        def full_iter():
            with open(path, "rb") as f:
                yield from f
        content_type, _ = mimetypes.guess_type(path)
        return StreamingResponse(
            full_iter(),
            media_type=content_type or "audio/mpeg",
            headers={"Accept-Ranges": "bytes"},
        )

    try:
        bytes_prefix = range_header.replace("bytes=", "")
        start_str, end_str = bytes_prefix.split("-")
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
    except ValueError:
        raise HTTPException(status_code=416, detail="Rango no válido")

    if start >= file_size or end >= file_size:
        raise HTTPException(status_code=416, detail="Rango fuera de límites")

    content_length = end - start + 1

    def iter_chunk():
        with open(path, "rb") as f:
            f.seek(start)
            bytes_left = content_length
            while bytes_left > 0:
                chunk = f.read(min(64 * 1024, bytes_left))
                if not chunk:
                    break
                bytes_left -= len(chunk)
                yield chunk

    content_type, _ = mimetypes.guess_type(path)
    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Access-Control-Allow-Origin": "*",
    }

    return StreamingResponse(
        iter_chunk(),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type=content_type or "audio/mpeg"
    )

@app.get("/stream_radio")
def stream_radio_proxy(url: str):
    # Un proxy abierto permite acceder a servicios internos (SSRF).
    raise HTTPException(status_code=403, detail="Proxy de radio deshabilitado por seguridad")

@app.get("/stream/{filename}")
def stream_audio(filename: str, request: Request):
    file_path = MUSIC_DIR / filename
    if (not file_path.exists() and re.fullmatch(r'telegram-[0-9a-f]{32}\.mp3', filename)
            and os.environ.get('MUSIC_TELEGRAM_IMPORTED_DIR')):
        candidate = Path(os.environ['MUSIC_TELEGRAM_IMPORTED_DIR']) / filename
        if not candidate.is_symlink():
            file_path = candidate
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de audio no encontrado")
    return send_partial_file(request, file_path)

if __name__ == "__main__":
    import uvicorn
    print("=================================================================")
    print(f"🚀 Thomas Music Universal Streamer Activo en http://{os.environ.get('MUSIC_HOST', '127.0.0.1')}:8000")
    print("🎵 Canciones COMPLETAS sin límite de 30 segundos habilitadas")
    print("=================================================================")
    uvicorn.run(app, host=os.environ.get("MUSIC_HOST", "127.0.0.1"), port=8000)
