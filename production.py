"""Entrada de producción: PWA y API en el mismo origen.

Los límites son globales por proceso: no confían en cabeceras de IP reenviadas.
Ejecutar un único worker; complementarlos con controles de acceso y monitorización.
"""
import asyncio
import os
import time
from collections import deque
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.datastructures import MutableHeaders

from server import app as api

MAX_BODY = 2 * 1024 * 1024


def enabled(name: str) -> bool:
    return os.environ.get(name, '').strip().lower() in {'1', 'true', 'yes'}


class PublicSafety:
    """Cotas básicas compartidas; no identifican ni autentican visitantes."""

    def __init__(self, app):
        self.app = app
        self.events = {name: deque() for name in ('auth', 'search', 'prepare')}
        self.expensive = asyncio.Semaphore(6)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        path = scope.get('path', '')
        method = scope.get('method', 'GET')
        original_send = send

        async def secured_send(message):
            if message['type'] == 'http.response.start':
                headers = MutableHeaders(scope=message)
                headers.setdefault('X-Content-Type-Options', 'nosniff')
                headers.setdefault('X-Frame-Options', 'DENY')
                headers.setdefault('Referrer-Policy', 'same-origin')
                if path.startswith('/api/'):
                    headers.setdefault('Cache-Control', 'no-store')
            await original_send(message)

        send = secured_send

        async def reject(code, message, headers=None):
            await JSONResponse({'detail': message}, status_code=code, headers=headers)(scope, receive, send)

        if path == '/api/auth/register' and not enabled('MUSIC_ALLOW_REGISTRATION'):
            return await reject(403, 'El registro público está desactivado. Contacta al administrador.')
        if (path == '/api/tracks' or path.startswith('/api/stream/') or path.startswith('/api/telegram/cover/')) and not enabled('MUSIC_ENABLE_LOCAL_LIBRARY'):
            return await reject(403, 'La biblioteca local no está publicada.')
        if path in ('/api/docs', '/api/redoc', '/api/openapi.json'):
            return await reject(404, 'No encontrado')

        bucket = ('auth', 12) if path in ('/api/auth/login', '/api/auth/register') and method == 'POST' else \
                 ('search', 45) if path in ('/api/search_online', '/api/resolve_spotify') else \
                 ('prepare', 90) if path in ('/api/prepare_stream', '/api/suggestions') else None
        if bucket:
            name, limit = bucket
            now = time.monotonic()
            events = self.events[name]
            while events and events[0] <= now - 60:
                events.popleft()
            if len(events) >= limit:
                return await reject(429, 'Demasiadas solicitudes. Inténtalo de nuevo en un minuto.', {'Retry-After': '60'})
            events.append(now)

        if path.startswith('/api/') and method in ('POST', 'PUT', 'PATCH'):
            body = bytearray()
            more = True
            while more:
                message = await receive()
                if message['type'] == 'http.disconnect':
                    return
                body.extend(message.get('body', b''))
                if len(body) > MAX_BODY:
                    return await reject(413, 'Solicitud demasiado grande.')
                more = message.get('more_body', False)
            original_receive = receive
            sent = False

            async def buffered_receive():
                nonlocal sent
                if not sent:
                    sent = True
                    return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
                return await original_receive()

            receive = buffered_receive

        expensive = path in ('/api/stream_yt', '/api/prepare_stream', '/api/search_online', '/api/resolve_spotify')
        if expensive:
            if self.expensive.locked():
                return await reject(503, 'El servidor está ocupado. Inténtalo de nuevo.', {'Retry-After': '5'})
            await self.expensive.acquire()
            try:
                return await self.app(scope, receive, send)
            finally:
                self.expensive.release()
        return await self.app(scope, receive, send)


def create_app(dist_dir: str | Path | None = None):
    directory = Path(dist_dir or os.environ.get('MUSIC_DIST_DIR', 'dist')).resolve()
    if not (directory / 'index.html').is_file() or not (directory / 'offline-assets.json').is_file():
        raise RuntimeError(f'No se encontró una compilación válida en {directory}. Ejecuta npm run build.')
    site = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    site.mount('/api', api)
    site.mount('/', StaticFiles(directory=str(directory), html=True), name='pwa')
    site.add_middleware(PublicSafety)
    return site


app = create_app()
