"""Piloto supervisado local en Windows, con copia aislada de la base de datos."""

import os
import re
import secrets
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from telegram_audio_validation import docker_executable
from telegram_setup_windows import session_path
from telegram_windows_session import load_session, save_session

ROOT = Path(__file__).resolve().parent
PROJECT = 'diaz-telegram-pilot'


def wait_for_server(*, timeout=90, clock=time.monotonic, wait=time.sleep):
    """Espera solo al servidor local; no incluye credenciales en la petición."""
    deadline = clock() + timeout
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while clock() < deadline:
        try:
            with opener.open('http://127.0.0.1:8589/api/health', timeout=2) as response:
                if response.status == 200:
                    return
        except (OSError, urllib.error.URLError):
            pass
        wait(1)
    raise TimeoutError('El servidor no quedó listo')


def prepare_pilot(operator):
    if os.name != 'nt' or not re.fullmatch(r'[a-z0-9_.-]{3,64}', operator):
        raise ValueError('Operador o sistema inválido')
    session = session_path()
    if not session.is_file():
        raise ValueError('Falta sesión dedicada')
    source = ROOT / 'diaz_music_users.db'
    if not source.is_file():
        raise ValueError('Falta base local')
    pilot = session.parent / 'pilot'
    data = pilot / 'data'
    key_path = pilot / 'bridge-key.dpapi'
    database = data / 'diaz_music_users.db'
    if not pilot.exists():
        # Verificar usuario y copiar con la API de backup, sin modificar el original.
        src = sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True)
        try:
            if src.execute('SELECT 1 FROM users WHERE username = ?', (operator,)).fetchone() is None:
                raise ValueError('El operador no existe en la base local')
            data.mkdir(parents=True, exist_ok=False)
            with database.open('xb'):
                pass
            dst = sqlite3.connect(database)
            try:
                src.backup(dst)
            finally:
                dst.close()
        finally:
            src.close()
        save_session(key_path, secrets.token_urlsafe(32))
    if not database.is_file() or not key_path.is_file():
        raise ValueError('Preparación anterior incompleta; no se sobrescribirá')
    with sqlite3.connect(database) as db:
        if db.execute('SELECT 1 FROM users WHERE username = ?', (operator,)).fetchone() is None:
            raise ValueError('Operador no encontrado en la copia')
    key = load_session(key_path)
    if not re.fullmatch(r'[A-Za-z0-9_-]{43,128}', key):
        raise ValueError('Clave inválida')
    env = os.environ.copy()
    env.update(MUSIC_TELEGRAM_OPERATOR=operator, MUSIC_TELEGRAM_BRIDGE_KEY=key,
               MUSIC_TELEGRAM_PILOT_DATA=str(data), MUSIC_TELEGRAM_CALLBACK_ENABLED='1',
               MUSIC_TELEGRAM_DOWNLOAD_ENABLED='1', MUSIC_TELEGRAM_PUBLISH_ENABLED='1',
               MUSIC_TELEGRAM_DELETE_ENABLED='1')
    return env


def main():
    if len(sys.argv) != 2 or not sys.stdin.isatty() or not sys.stdout.isatty():
        print('Uso en consola: py -3.10 telegram_pilot.py OPERADOR')
        return 1
    print('Piloto local en 127.0.0.1:8589; usa copia de la base y una cuenta dedicada.')
    print('No actives Tailscale Serve/Funnel ni expongas el puerto durante la prueba.')
    print('El puente puede pulsar botones y descargar solo después de tus confirmaciones en la app.')
    if input('Escribe SI para iniciar el piloto: ').strip() != 'SI':
        return 1
    try:
        env = prepare_pilot(sys.argv[1].strip().lower())
        docker = docker_executable()
        env['PATH'] = str(Path(docker).parent) + os.pathsep + env.get('PATH', '')
        command = [docker, 'compose', '-p', PROJECT, '-f', 'compose.yaml', '-f', 'compose.telegram.yaml',
                   '-f', 'compose.telegram-pilot.yaml', 'up', '-d', '--build']
        print('Preparando contenedor local; puede tardar varios minutos.')
        result = subprocess.run(command, cwd=ROOT, env=env, stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, timeout=600, check=False)
        if result.returncode != 0:
            raise RuntimeError('No se pudo iniciar el contenedor')
        wait_for_server()
        print('Abre http://127.0.0.1:8589 e inicia sesión con tu cuenta de Diaz Music.')
        print('Mantén esta consola abierta. Ctrl+C detiene el puente; el contenedor permanece activo.')
        return subprocess.call([sys.executable, '-u', str(ROOT / 'telegram_windows_bridge.py'), '--serve'],
                               cwd=ROOT, env=env)
    except (Exception, KeyboardInterrupt):
        print('No se confirmó el estado del piloto. Revisa el contenedor y no compartas claves ni códigos.')
        return 1


if __name__ == '__main__':
    sys.exit(main())
