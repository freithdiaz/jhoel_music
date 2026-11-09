"""Una eliminación solicitada explícitamente; sin ejecución ni reintentos automáticos."""

import re
import secrets
import threading


class DeletionError(ValueError):
    pass


class DeletionQueue:
    def __init__(self, *, clock, timeout=120):
        self._clock, self._timeout = clock, timeout
        self._lock = threading.Lock()
        self._job = None

    def _expire(self):
        if self._job and self._job['state'] in ('pending', 'claimed') and self._clock() >= self._job['deadline']:
            self._job['state'] = 'expired' if self._job['state'] == 'pending' else 'uncertain'

    def submit(self, *, operator, filename, confirmed, identifier=None):
        if (type(operator) is not str or not operator or type(filename) is not str
                or not re.fullmatch(r'telegram-[0-9a-f]{32}\.mp3', filename) or confirmed is not True
                or (identifier is not None and (type(identifier) is not str or not re.fullmatch(r'[A-Za-z0-9_-]{43}', identifier)))):
            raise DeletionError('Solicitud inválida')
        with self._lock:
            self._expire()
            if self._job is not None:
                raise DeletionError('Hay una eliminación sin cerrar')
            identifier = identifier or secrets.token_urlsafe(32)
            self._job = {'id': identifier, 'operator': operator, 'filename': filename,
                         'state': 'pending', 'deadline': self._clock() + self._timeout}
            return identifier

    def claim(self):
        with self._lock:
            self._expire()
            if not self._job or self._job['state'] != 'pending':
                return None
            self._job['state'] = 'claimed'
            self._job['deadline'] = self._clock() + self._timeout
            return {'id': self._job['id'], 'filename': self._job['filename']}

    def finish(self, *, identifier, deleted):
        if type(deleted) is not bool:
            raise DeletionError('Resultado inválido')
        with self._lock:
            self._expire()
            if not self._job or self._job['id'] != identifier or self._job['state'] != 'claimed':
                raise DeletionError('Solicitud no disponible')
            self._job['state'] = 'deleted' if deleted else 'uncertain'

    def status(self, *, identifier, operator):
        with self._lock:
            self._expire()
            if not self._job or self._job['id'] != identifier or self._job['operator'] != operator:
                raise DeletionError('Solicitud no encontrada')
            return {'state': self._job['state'], 'filename': self._job['filename']}

    def clear(self, *, identifier, operator):
        with self._lock:
            self._expire()
            if (not self._job or self._job['id'] != identifier or self._job['operator'] != operator
                    or self._job['state'] not in ('deleted', 'expired', 'uncertain')):
                raise DeletionError('Solicitud no se puede cerrar')
            self._job = None
