"""Almacenamiento de sesión: DPAPI en Windows; archivo 0600 en Linux.

No inicia sesión ni contacta Telegram. En Linux el archivo no está cifrado:
debe vivir en un directorio 0700 propiedad del usuario del servicio. La
protección DPAPI no aísla procesos del mismo usuario ni es portable.
"""

import ctypes
import os
import tempfile
from ctypes import wintypes
from pathlib import Path


class SessionStorageError(RuntimeError):
    pass


class _Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]


def _crypt(data, *, decrypt):
    if type(data) is not bytes or not data:
        raise SessionStorageError('Protección no disponible o datos inválidos')
    if os.name != 'nt':
        # La sesión queda en un archivo 0600; no se expande ni transforma.
        return data
    buf = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    source = _Blob(len(data), buf)
    output = _Blob()
    crypt32 = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel32.LocalFree.argtypes = [wintypes.HLOCAL]
    kernel32.LocalFree.restype = wintypes.HLOCAL
    if decrypt:
        fn = crypt32.CryptUnprotectData
        fn.argtypes = [ctypes.POINTER(_Blob), ctypes.c_void_p, ctypes.c_void_p,
                       ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(_Blob)]
        ok = fn(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(output))
    else:
        fn = crypt32.CryptProtectData
        fn.argtypes = [ctypes.POINTER(_Blob), wintypes.LPCWSTR, ctypes.c_void_p,
                       ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(_Blob)]
        ok = fn(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(output))
    if not ok:
        raise SessionStorageError('No se pudo proteger o recuperar la sesión')
    try:
        return ctypes.string_at(output.data, output.size)
    finally:
        kernel32.LocalFree(output.data)


def save_session(path, session):
    """Crear un archivo cifrado sin sobrescribir; el directorio debe ser privado."""
    if type(session) is not str or not session or len(session) > 4096:
        raise SessionStorageError('Sesión inválida')
    encrypted = _crypt(session.encode('utf-8'), decrypt=False)
    target = Path(path)
    # Un archivo temporal exclusivo evita publicar datos parcialmente escritos.
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(mode='wb', prefix='.session-', dir=target.parent,
                                         delete=False) as output:
            temp_name = output.name
            output.write(encrypted)
            output.flush()
            os.fsync(output.fileno())
        # El enlace falla si ya existe el destino, sin sobrescribirlo.
        os.link(temp_name, target)
    except OSError as exc:
        raise SessionStorageError('No se pudo crear el archivo de sesión') from exc
    finally:
        if temp_name is not None:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass


def load_session(path):
    """Recuperar una sesión de un archivo cifrado previamente creado."""
    try:
        with Path(path).open('rb') as source:
            encrypted = source.read(16385)
        if not 0 < len(encrypted) <= 16384:
            raise SessionStorageError('Archivo de sesión inválido')
        return _crypt(encrypted, decrypt=True).decode('utf-8')
    except (OSError, UnicodeError) as exc:
        raise SessionStorageError('No se pudo abrir la sesión') from exc
