"""Controles locales preparatorios; no consulta ni modifica Telegram."""

from contextlib import contextmanager
from threading import Lock


class ConsumerUnavailable(RuntimeError):
    pass


class ConsumerGuard:
    """Exclusión dentro de esta instancia; no protege procesos ni reinicios."""

    def __init__(self):
        self._lock = Lock()

    @contextmanager
    def claim(self, webhook_info):
        if not self._lock.acquire(blocking=False):
            raise ConsumerUnavailable('Ya existe un consumidor local')
        try:
            # Solo una respuesta completa y explícita sin webhook permite seguir.
            if (not isinstance(webhook_info, dict)
                    or webhook_info.get('ok') is not True
                    or not isinstance(webhook_info.get('result'), dict)
                    or webhook_info['result'].get('url') != ''):
                raise ConsumerUnavailable('Estado de webhook activo o desconocido')
            yield
        finally:
            self._lock.release()
