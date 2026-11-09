"""Cola acotada en memoria para un puente local; no realiza operaciones de red."""

import math
import re
import secrets
import threading

from telegram_match import best_match, candidate_line, receipt_matches_selection


class BridgeQueueError(ValueError):
    pass


def _valid_target(target):
    """Valida la referencia usada solo para ordenar resultados, no para descargar."""
    if type(target) is not dict or not set(target) <= {'title', 'artist', 'album', 'duration'}:
        return False

    def text(value, limit):
        return (type(value) is str and 0 < len(value.strip()) <= limit
                and not any(ord(char) < 32 or ord(char) == 127 for char in value))

    title = target.get('title')
    artist = target.get('artist', '')
    album = target.get('album', '')
    duration = target.get('duration')
    return (text(title, 200) and (artist == '' or text(artist, 200))
            and (album == '' or text(album, 200))
            and (duration is None or (type(duration) in (int, float)
                                      and math.isfinite(duration) and 0 < duration <= 86400)))


def _receipt_matches_selection(selection, receipt):
    """Solo permite coincidencias textuales conservadoras; no prueba identidad."""
    title = receipt.get('title', '')
    label = selection.get('label', '')
    if type(title) is not str or type(label) is not str:
        return False
    if re.fullmatch(r'[0-9]{1,3}', label):
        lines = [line for line in selection.get('context', '').splitlines()
                 if re.match(r'^\s*' + re.escape(label) + r'[.)]\s', line)]
        if len(lines) != 1:
            return False
        selection_text = lines[0]
    else:
        selection_text = label
    return receipt_matches_selection(selection_text, title)


class BridgeQueue:
    """Solo una operación pendiente; no reintenta resultados inciertos."""

    def __init__(self, *, clock, timeout=300):
        if not callable(clock) or type(timeout) not in (int, float) or not math.isfinite(timeout) or not 0 < timeout <= 300:
            raise ValueError('Configuración inválida')
        self._clock = clock
        self._timeout = timeout
        self._lock = threading.Lock()
        self._job = None

    def _now(self):
        now = self._clock()
        if type(now) not in (int, float) or not math.isfinite(now):
            raise BridgeQueueError('Reloj inválido')
        return now

    def _check_time(self, now):
        if (self._job is not None and self._job['state'] in ('pending', 'claimed', 'completed', 'selection_pending', 'selection_claimed', 'receipt_pending', 'download_pending', 'download_claimed')
                and not self._job['created'] <= now < self._job['deadline']):
            # Un trabajo iniciado puede haber tenido efectos remotos: nunca reenviar.
            self._job['state'] = ('uncertain' if self._job['state'] in ('claimed', 'selection_claimed', 'download_claimed')
                                  else 'expired')

    def _renew(self, now):
        self._job['created'] = now
        self._job['deadline'] = now + self._timeout

    def submit(self, *, operator, query, identifier=None, target=None, auto_select=False):
        if (type(operator) is not str or not operator or len(operator) > 64
                or type(query) is not str or not query.strip() or len(query) > 200
                or any(ord(c) < 32 or ord(c) == 127 for c in query)
                or query.strip().startswith('/')
                or type(auto_select) is not bool
                or (auto_select and not _valid_target(target))
                or (target is not None and (not auto_select or not _valid_target(target)))
                or (identifier is not None and (type(identifier) is not str
                    or re.fullmatch(r'[A-Za-z0-9_-]{43}', identifier) is None))):
            raise BridgeQueueError('Solicitud inválida')
        with self._lock:
            now = self._now()
            self._check_time(now)
            if self._job is not None and self._job['state'] in ('published', 'validated'):
                # La importación ya terminó y no dejó efectos pendientes: se
                # puede iniciar otra sin exigir un cierre manual.
                self._job = None
            if self._job is not None:
                raise BridgeQueueError('Hay una solicitud pendiente o sin resolver')
            identifier = identifier or secrets.token_urlsafe(32)
            self._job = {'id': identifier, 'operator': operator, 'query': query.strip(),
                         'created': now, 'deadline': now + self._timeout, 'state': 'pending',
                         'target': dict(target) if target is not None else None,
                         'auto_select': auto_select, 'auto_selected': False}
            return identifier

    def claim(self):
        with self._lock:
            now = self._now()
            self._check_time(now)
            if self._job is None or self._job['state'] != 'pending':
                return None
            self._job['state'] = 'claimed'
            self._renew(now)
            return {'id': self._job['id'], 'query': self._job['query']}

    def status(self, *, identifier, operator):
        with self._lock:
            now = self._now()
            self._check_time(now)
            if self._job is None or self._job['id'] != identifier or self._job['operator'] != operator:
                raise BridgeQueueError('Solicitud no encontrada')
            return self._job['state']

    def active(self, *, operator):
        """Permite al propietario recuperar su trabajo sin revelar datos a otros."""
        with self._lock:
            now = self._now()
            self._check_time(now)
            if self._job is None or self._job['operator'] != operator:
                return None
            return {'id': self._job['id'], 'state': self._job['state']}

    def finish(self, *, identifier, results=None, failed=False):
        """Finaliza una búsqueda con referencias opacas, sin datos de callbacks."""
        if type(failed) is not bool or (failed and results is not None):
            raise BridgeQueueError('Respuesta inválida')
        if not failed:
            def invalid(item):
                if type(item) is not dict or set(item) != {'id', 'label', 'context', 'relation'}:
                    return True
                identifier, label, context, relation = item['id'], item['label'], item['context'], item['relation']
                return (type(identifier) is not str or re.fullmatch(r'[A-Za-z0-9_-]{43}', identifier) is None
                        or type(label) is not str or not label.strip() or len(label) > 200
                        or any(ord(c) < 32 or ord(c) == 127 for c in label)
                        or type(context) is not str or not context.strip() or len(context) > 2000
                        or any((ord(c) < 32 and c != '\n') or ord(c) == 127 for c in context)
                        or relation not in ('vinculado', 'indeterminado'))

            if type(results) is not list or len(results) > 50 or any(invalid(item) for item in results):
                raise BridgeQueueError('Resultados inválidos')
        with self._lock:
            now = self._now()
            self._check_time(now)
            if (self._job is None or self._job['id'] != identifier
                    or self._job['state'] != 'claimed'):
                raise BridgeQueueError('Solicitud no disponible')
            # Un fallo comunicado por el agente no demuestra que Telegram no
            # haya recibido el envío: no clasificarlo como seguro para reintento.
            self._job['state'] = 'uncertain' if failed else 'completed'
            self._job['results'] = None if failed else [dict(item) for item in results]
            if not failed and self._job.get('auto_select') is True and self._job['results']:
                # Solo se preselecciona si la coincidencia textual es clara. El
                # puente revalida el botón y el audio recibido antes de descargar.
                match = best_match(self._job['target'], self._job['results'])
                if match is not None:
                    self._job['selection_id'] = match['result']['id']
                    self._job['selection'] = dict(match['result'])
                    self._job['selection_display'] = match['display']
                    self._job['auto_download'] = True
                    self._job['auto_selected'] = True
                    self._job['state'] = 'selection_pending'
            self._renew(now)

    def result(self, *, identifier, operator):
        """Devuelve copia de resultados solo al operador que inició la búsqueda."""
        with self._lock:
            now = self._now()
            self._check_time(now)
            if self._job is None or self._job['id'] != identifier or self._job['operator'] != operator:
                raise BridgeQueueError('Solicitud no encontrada')
            result = self._job.get('results')
            response = {'state': self._job['state'],
                        'results': [dict(item) for item in result] if result is not None else None}
            if self._job.get('progress') is not None:
                response['progress'] = self._job['progress']
            if self._job.get('selection') is not None:
                response['selection'] = {
                    'label': self._job.get('selection_display') or self._job['selection']['label'],
                    'relation': self._job['selection']['relation'],
                }
                response['auto_selected'] = bool(self._job.get('auto_selected'))
            if self._job.get('filename') is not None:
                response['filename'] = self._job['filename']
            return response

    def clear(self, *, identifier, operator):
        """Descarta un estado terminal tras una decisión explícita del operador."""
        with self._lock:
            now = self._now()
            self._check_time(now)
            if (self._job is None or self._job['id'] != identifier
                    or self._job['operator'] != operator
                    or self._job['state'] not in ('completed', 'failed', 'expired', 'uncertain', 'selection_verified', 'callback_confirmed', 'receipt_pending', 'quarantined', 'validated', 'published')):
                raise BridgeQueueError('Solicitud no se puede cerrar')
            self._job = None

    def select(self, *, identifier, operator, result_id, accepts_group_publication, accepts_uncertainty,
               rights_confirmed, auto_download=False):
        """Registra una elección explícita; no envía ningún callback."""
        if (type(result_id) is not str or accepts_group_publication is not True or rights_confirmed is not True
                or type(accepts_uncertainty) is not bool or type(auto_download) is not bool):
            raise BridgeQueueError('Confirmación inválida')
        with self._lock:
            now = self._now()
            self._check_time(now)
            if (self._job is None or self._job['id'] != identifier
                    or self._job['operator'] != operator or self._job['state'] != 'completed'
                    or not self._job['created'] <= now < self._job['deadline']):
                raise BridgeQueueError('Selección no disponible')
            matches = [item for item in self._job['results'] if item['id'] == result_id]
            if len(matches) != 1 or (matches[0]['relation'] == 'indeterminado' and not accepts_uncertainty):
                raise BridgeQueueError('Resultado o confirmación inválidos')
            self._job['selection_id'] = result_id
            self._job['selection'] = dict(matches[0])
            self._job['selection_display'] = candidate_line(matches[0]) or matches[0]['label']
            self._job['auto_download'] = auto_download
            self._job['state'] = 'selection_pending'
            self._renew(now)

    def claim_selection(self):
        """Entrega la referencia una vez; el agente debe revalidar antes de actuar."""
        with self._lock:
            now = self._now()
            self._check_time(now)
            if self._job is None or self._job['state'] != 'selection_pending':
                return None
            self._job['state'] = 'selection_claimed'
            self._renew(now)
            return {'search_id': self._job['id'], 'result_id': self._job['selection_id']}

    def finish_selection_check(self, *, identifier, verified):
        """Registra una comprobación sin callback; no autoriza efectos posteriores."""
        if type(verified) is not bool:
            raise BridgeQueueError('Resultado inválido')
        with self._lock:
            now = self._now()
            self._check_time(now)
            if (self._job is None or self._job['id'] != identifier
                    or self._job['state'] != 'selection_claimed'):
                raise BridgeQueueError('Selección no disponible')
            self._job['state'] = 'selection_verified' if verified else 'uncertain'

    def finish_callback(self, *, identifier, confirmed, receipt=None):
        """Registra respuesta de Telegram o resultado incierto; no permite reintento."""
        if type(confirmed) is not bool or (not confirmed and receipt is not None):
            raise BridgeQueueError('Resultado inválido')
        if receipt is not None:
            if (type(receipt) is not dict or set(receipt) != {'id', 'message_id', 'size', 'mime_type', 'title'}
                    or type(receipt['id']) is not str or re.fullmatch(r'[A-Za-z0-9_-]{43}', receipt['id']) is None
                    or type(receipt['message_id']) is not int or receipt['message_id'] <= 0
                    or type(receipt['size']) is not int or not 0 < receipt['size'] <= 20 * 1024 * 1024
                    or receipt['mime_type'] not in ('audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
                                                    'audio/x-m4a', 'audio/ogg', 'audio/flac', 'audio/wav',
                                                    'application/octet-stream')
                    or type(receipt['title']) is not str or len(receipt['title']) > 120
                    or any(ord(c) < 32 or ord(c) == 127 for c in receipt['title'])):
                raise BridgeQueueError('Candidato inválido')
        with self._lock:
            now = self._now()
            self._check_time(now)
            if (self._job is None or self._job['id'] != identifier
                    or self._job['state'] != 'selection_claimed'):
                raise BridgeQueueError('Selección no disponible')
            can_auto_download = (receipt is not None and self._job.get('auto_download') is True
                                 and _receipt_matches_selection(self._job['selection'], receipt))
            self._job['state'] = ('download_pending' if can_auto_download else 'receipt_pending') if receipt is not None else ('callback_confirmed' if confirmed else 'uncertain')
            self._job['receipt'] = dict(receipt) if receipt is not None else None
            self._renew(now)

    def receipt(self, *, identifier, operator):
        with self._lock:
            now = self._now()
            self._check_time(now)
            if (self._job is None or self._job['id'] != identifier
                    or self._job['operator'] != operator):
                raise BridgeQueueError('Solicitud no encontrada')
            item = self._job.get('receipt') if self._job['state'] == 'receipt_pending' else None
            return dict(item) if item is not None else None

    def approve_receipt(self, *, identifier, operator, receipt_id, recognized, rights_confirmed):
        """Autoriza solo el candidato mostrado; no verifica identidad ni licencia."""
        if type(receipt_id) is not str or recognized is not True or rights_confirmed is not True:
            raise BridgeQueueError('Confirmación inválida')
        with self._lock:
            now = self._now()
            self._check_time(now)
            if (self._job is None or self._job['id'] != identifier or self._job['operator'] != operator
                    or self._job['state'] != 'receipt_pending' or self._job['receipt']['id'] != receipt_id):
                raise BridgeQueueError('Candidato no disponible')
            self._job['state'] = 'download_pending'
            self._renew(now)

    def claim_download(self):
        with self._lock:
            now = self._now()
            self._check_time(now)
            if self._job is None or self._job['state'] != 'download_pending':
                return None
            self._job['state'] = 'download_claimed'
            self._job['progress'] = 0
            self._renew(now)
            return {'search_id': self._job['id'], 'receipt_id': self._job['receipt']['id']}

    def download_progress(self, *, identifier, received, total):
        if type(received) is not int or type(total) is not int or total <= 0 or not 0 <= received <= total:
            raise BridgeQueueError('Progreso inválido')
        with self._lock:
            now = self._now()
            self._check_time(now)
            if (self._job is None or self._job['id'] != identifier or self._job['state'] != 'download_claimed'
                    or total != self._job['receipt']['size']):
                raise BridgeQueueError('Descarga no disponible')
            percentage = received * 100 // total
            if percentage < self._job.get('progress', 0):
                raise BridgeQueueError('Progreso no puede retroceder')
            self._job['progress'] = percentage

    def finish_download(self, *, identifier, saved, validated=False, published=False, filename=None):
        if (type(saved) is not bool or type(validated) is not bool or type(published) is not bool
                or (validated and not saved) or (published and not validated)
                or (filename is not None and (not published or type(filename) is not str
                    or re.fullmatch(r'telegram-[0-9a-f]{32}\.mp3', filename) is None))):
            raise BridgeQueueError('Resultado inválido')
        with self._lock:
            now = self._now()
            self._check_time(now)
            if self._job is None or self._job['id'] != identifier or self._job['state'] != 'download_claimed':
                raise BridgeQueueError('Descarga no disponible')
            self._job['state'] = ('published' if published else 'validated' if validated else 'quarantined') if saved else 'uncertain'
            if published and filename is not None:
                self._job['filename'] = filename
            if saved:
                self._job['progress'] = 100
