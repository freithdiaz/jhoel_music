"""Bloqueo cooperativo entre procesos Windows para la cuenta Telegram dedicada."""

import os
from contextlib import contextmanager
from pathlib import Path


class AccountBusy(RuntimeError):
    pass


@contextmanager
def exclusive_account_lock(path):
    """Bloquea un byte mientras se usa la cuenta; nunca borra el archivo.

    Todos los consumidores deben usar el mismo archivo en un directorio confiable.
    No impide conexiones que ignoren este mecanismo ni garantiza exclusión si
    el archivo es reemplazado mientras está bloqueado.
    """
    try:
        handle = Path(path).open('a+b')
    except OSError as exc:
        raise AccountBusy('No se pudo abrir el bloqueo') from exc
    locked = False
    try:
        handle.seek(0)
        if os.name == 'nt':
            import msvcrt
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as exc:
                raise AccountBusy('La cuenta ya está en uso') from exc
        else:
            import fcntl
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as exc:
                raise AccountBusy('La cuenta ya está en uso') from exc
        locked = True
        yield
    finally:
        try:
            if locked:
                handle.seek(0)
                if os.name == 'nt':
                    import msvcrt
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        finally:
            handle.close()
