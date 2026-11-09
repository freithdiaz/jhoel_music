"""Validación MP3 aislada en Docker; no publica ni verifica identidad o derechos."""

import os
import json
import shutil
import subprocess
import secrets
import tempfile
import unicodedata
from pathlib import Path

from telegram_import import MAX_AUDIO_BYTES


class AudioValidationError(ValueError):
    pass


def docker_executable():
    executable = shutil.which('docker')
    if executable:
        return executable
    candidate = Path(os.environ.get('LOCALAPPDATA', '')) / 'Programs' / 'DockerDesktop' / 'resources' / 'bin' / 'docker.exe'
    if os.name == 'nt' and candidate.is_file():
        return str(candidate)
    raise AudioValidationError('Docker no disponible')


TRANSCODE_FORMATS = ('mov,mp4,m4a,3gp,3g2,mj2', 'ogg', 'flac', 'wav', 'matroska,webm')


def _isolated_command(docker, container_name, args):
    return [docker, 'run', '--rm', '-i', '--name', container_name, '--pull=never', '--network', 'none',
            '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
            '--pids-limit', '32', '--memory', '256m', '--cpus', '1', *args]


def _remove_container(run, docker, container_name):
    try:
        run([docker, 'rm', '-f', container_name], stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, timeout=15, check=False)
    except (OSError, subprocess.TimeoutExpired):
        pass


def validate_mp3(path, *, run=subprocess.run):
    """Devuelve bytes MP3 válidos, convirtiendo M4A/OGG/FLAC/WAV si hace falta.

    Requiere la imagen local `diaz-audio-probe`. La salida no verifica que el
    archivo sea la canción esperada ni garantiza ausencia de contenido dañino.
    """
    try:
        with Path(path).open('rb') as source:
            data = source.read(MAX_AUDIO_BYTES + 1)
    except OSError as exc:
        raise AudioValidationError('No se pudo leer el candidato') from exc
    if not 0 < len(data) <= MAX_AUDIO_BYTES:
        raise AudioValidationError('Tamaño inválido')
    docker = docker_executable()

    def invoke(args, *, capture=False, timeout=90):
        container_name = 'diaz-audio-probe-' + secrets.token_hex(16)
        command = _isolated_command(docker, container_name, args)
        try:
            return run(command, input=data,
                       stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=timeout, check=False)
        except subprocess.TimeoutExpired as exc:
            # Docker puede dejar el contenedor vivo si solo termina el cliente CLI.
            _remove_container(run, docker, container_name)
            raise AudioValidationError('Tiempo de validación agotado; limpieza no garantizada') from exc
        except OSError as exc:
            raise AudioValidationError('No se completó la validación aislada') from exc

    # 1. Si ya es MP3, se decodifica sin recompresión.
    decoded = invoke(['--entrypoint', 'ffmpeg', 'diaz-audio-probe', '-v', 'error', '-xerror',
                      '-protocol_whitelist', 'pipe', '-f', 'mp3', '-i', 'pipe:0',
                      '-map', '0:a:0', '-f', 'null', '-'])
    if decoded.returncode == 0:
        return data

    # 2. Si no es MP3, se detecta el contenedor y se convierte a MP3 320k.
    probe = invoke(['--entrypoint', 'ffprobe', 'diaz-audio-probe', '-v', 'error',
                    '-protocol_whitelist', 'pipe', '-show_entries', 'format=format_name',
                    '-of', 'default=nw=1:nk=1', '-i', 'pipe:0'], capture=True, timeout=30)
    try:
        format_name = probe.stdout.decode('ascii', 'replace').strip().lower()
    except AttributeError:
        format_name = ''
    if probe.returncode != 0 or not any(name in format_name for name in TRANSCODE_FORMATS):
        raise AudioValidationError('El audio no superó la validación')

    converted = invoke(['--entrypoint', 'ffmpeg', 'diaz-audio-probe', '-v', 'error', '-xerror',
                        '-protocol_whitelist', 'pipe', '-i', 'pipe:0',
                        '-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '320k',
                        '-f', 'mp3', 'pipe:1'], capture=True, timeout=120)
    output = converted.stdout or b''
    if (converted.returncode != 0 or not 0 < len(output) <= MAX_AUDIO_BYTES
            or not (output.startswith(b'ID3') or output[:2] in (b'\xff\xfb', b'\xff\xf3', b'\xff\xf2'))):
        raise AudioValidationError('El audio no superó la validación')
    return output


def extract_mp3_metadata(data, *, run=subprocess.run):
    """Extrae etiquetas y recodifica portada en aislamiento; datos no verificados."""
    if type(data) is not bytes or not 0 < len(data) <= MAX_AUDIO_BYTES:
        raise AudioValidationError('Datos inválidos')
    docker = docker_executable()
    base = [docker, 'run', '--rm', '-i', '--pull=never', '--network', 'none', '--read-only',
            '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '32',
            '--memory', '256m', '--cpus', '1']

    def invoke(args):
        try:
            return run(base + args, input=data, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                       timeout=90, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise AudioValidationError('No se pudieron leer metadatos de forma aislada') from exc

    probe = invoke(['diaz-audio-probe', '-v', 'error', '-protocol_whitelist', 'pipe',
                    '-f', 'mp3', '-i', 'pipe:0', '-show_entries', 'format_tags=title,artist,album,genre', '-of', 'json'])
    if probe.returncode != 0 or len(probe.stdout) > 65536:
        raise AudioValidationError('Metadatos inválidos')
    try:
        parsed = json.loads(probe.stdout)
        tags = parsed.get('format', {}).get('tags', {})
        if not isinstance(tags, dict):
            raise ValueError
    except (ValueError, AttributeError, TypeError):
        raise AudioValidationError('Metadatos inválidos') from None
    metadata = {}
    for key in ('title', 'artist', 'album', 'genre'):
        value = tags.get(key)
        if isinstance(value, str):
            clean = ''.join(c for c in value if c.isprintable() and not unicodedata.category(c).startswith('C')).strip()
            if clean:
                metadata[key] = clean[:120]

    cover_result = invoke(['--entrypoint', 'ffmpeg', 'diaz-audio-probe', '-v', 'error',
                           '-protocol_whitelist', 'pipe', '-f', 'mp3', '-i', 'pipe:0',
                           '-map', '0:v:0', '-frames:v', '1', '-vf',
                           'scale=512:512:force_original_aspect_ratio=decrease',
                           '-threads', '1', '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1'])
    cover = cover_result.stdout if cover_result.returncode == 0 else b''
    if not isinstance(cover, bytes) or not cover.startswith(b'\xff\xd8\xff') or len(cover) > 2 * 1024 * 1024:
        cover = b''
    return metadata, cover


def write_metadata_sidecars(audio_path, data, metadata, cover):
    """Añade datos y portada al archivo exacto sin sobrescribir sidecars existentes."""
    audio_path = Path(audio_path)
    import re
    if not re.fullmatch(r'telegram-[0-9a-f]{32}\.mp3', audio_path.name):
        raise AudioValidationError('Nombre de audio inválido')
    if type(data) is not bytes or not 0 < len(data) <= MAX_AUDIO_BYTES:
        raise AudioValidationError('Datos inválidos')
    if type(metadata) is not dict or set(metadata) - {'title', 'artist', 'album', 'genre'}:
        raise AudioValidationError('Metadatos inválidos')
    if any(type(value) is not str or len(value) > 120 or any(not c.isprintable() for c in value)
           for value in metadata.values()):
        raise AudioValidationError('Metadatos inválidos')
    if type(cover) is not bytes or (cover and (not cover.startswith(b'\xff\xd8\xff') or len(cover) > 2 * 1024 * 1024)):
        raise AudioValidationError('Carátula inválida')
    try:
        with audio_path.open('rb') as source:
            if source.read(MAX_AUDIO_BYTES + 1) != data:
                raise AudioValidationError('El audio cambió durante la lectura')
        meta_path = audio_path.with_suffix('.json')
        cover_path = audio_path.with_suffix('.jpg')
        # No alterar sidecars existentes, aunque pertenezcan a otra ejecución.
        if meta_path.exists() or (cover and cover_path.exists()):
            raise AudioValidationError('Ya existen metadatos o carátula')
        if cover:
            with cover_path.open('xb') as output:
                output.write(cover)
        with meta_path.open('xb') as output:
            output.write(json.dumps(metadata, ensure_ascii=False).encode('utf-8'))
    except OSError as exc:
        raise AudioValidationError('No se pudieron guardar los metadatos') from exc


def publish_validated_mp3(data, *, directory):
    """Publica bytes ya validados sin sobrescribir archivos existentes.

    El llamador debe pasar exactamente el resultado de validate_mp3; esta función
    no vuelve a decodificar el audio ni verifica su identidad o autorización.
    """
    if type(data) is not bytes or not 0 < len(data) <= MAX_AUDIO_BYTES:
        raise AudioValidationError('Datos inválidos')
    directory = Path(directory)
    temp_name = None
    try:
        directory.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(mode='wb', prefix='.telegram-', dir=directory, delete=False) as output:
            temp_name = output.name
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        target = directory / ('telegram-' + secrets.token_hex(16) + '.mp3')
        os.link(temp_name, target)
        return target
    except OSError as exc:
        raise AudioValidationError('No se pudo publicar el audio') from exc
    finally:
        if temp_name is not None:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass
