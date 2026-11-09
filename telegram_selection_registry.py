"""Selecciones temporales para el futuro puente; no realiza operaciones Telegram."""

import math
import secrets
import threading


class SelectionUnavailable(ValueError):
    pass


class SelectionRegistry:
    """Registro efímero de un solo proceso; no sobrevive a reinicios."""

    def __init__(self, *, clock, limit=100, ttl=120):
        if (not callable(clock) or type(limit) is not int or not 1 <= limit <= 1000
                or type(ttl) not in (int, float) or not math.isfinite(ttl) or not 0 < ttl <= 300):
            raise ValueError('Configuración inválida')
        self._clock = clock
        self._limit = limit
        self._ttl = ttl
        self._entries = {}
        self._lock = threading.Lock()

    def _now(self):
        now = self._clock()
        if type(now) not in (int, float) or not math.isfinite(now):
            raise SelectionUnavailable('Reloj inválido')
        return now

    def _expire(self, now):
        self._entries = {key: value for key, value in self._entries.items()
                         if value[2] <= now < value[3]}

    def issue(self, *, operator, value):
        """Asocia un objeto interno a un operador; no expone datos de callback."""
        if type(operator) is not str or not operator or len(operator) > 64 or value is None:
            raise SelectionUnavailable('Selección inválida')
        with self._lock:
            now = self._now()
            self._expire(now)
            if len(self._entries) >= self._limit:
                raise SelectionUnavailable('Demasiadas selecciones pendientes')
            token = secrets.token_urlsafe(32)
            while token in self._entries:
                token = secrets.token_urlsafe(32)
            self._entries[token] = (operator, value, now, now + self._ttl)
            return token

    def consume(self, token, *, operator):
        """Consume atómicamente la referencia solo para el operador propietario."""
        if type(token) is not str or type(operator) is not str:
            raise SelectionUnavailable('Selección inválida')
        with self._lock:
            now = self._now()
            self._expire(now)
            entry = self._entries.get(token)
            if entry is None or entry[0] != operator:
                raise SelectionUnavailable('Selección ausente, vencida o no autorizada')
            del self._entries[token]
            return entry[1]
