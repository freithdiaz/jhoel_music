"""Validación aislada de candidatos Telegram; no inicia polling ni expone rutas.

No habilitar una integración hasta resolver la exclusión entre consumidores y
la coordinación con webhooks, además de revisar el transporte y almacenamiento.
"""

from dataclasses import dataclass


MAX_AUDIO_BYTES = 20 * 1024 * 1024
ALLOWED_AUDIO_TYPES = frozenset({'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/flac', 'audio/wav'})


@dataclass(frozen=True)
class Candidate:
    message_id: int
    file_id: str
    size: int
    mime_type: str


def candidate_from_update(update, *, group_id, sender_id):
    """Acepta solo audio de mensaje y origen exactos; nunca usa el nombre de archivo."""
    if type(group_id) is not int or group_id >= 0 or type(sender_id) is not int or sender_id <= 0:
        return None
    if not isinstance(update, dict):
        return None
    message = update.get('message')
    if not isinstance(message, dict):
        return None
    chat, sender, audio = message.get('chat'), message.get('from'), message.get('audio')
    if not all(isinstance(value, dict) for value in (chat, sender, audio)):
        return None
    if (type(chat.get('id')) is not int or chat['id'] != group_id
            or chat.get('type') not in ('group', 'supergroup')
            or type(sender.get('id')) is not int or sender['id'] != sender_id):
        return None
    message_id, file_id = message.get('message_id'), audio.get('file_id')
    size, mime_type = audio.get('file_size'), audio.get('mime_type')
    if (type(message_id) is not int or message_id <= 0
            or not isinstance(file_id, str) or not 1 <= len(file_id) <= 512
            or not file_id.isascii() or not all(c.isalnum() or c in '_-' for c in file_id)
            or type(size) is not int or not 0 < size <= MAX_AUDIO_BYTES
            or not isinstance(mime_type, str) or mime_type not in ALLOWED_AUDIO_TYPES):
        return None
    return Candidate(message_id, file_id, size, mime_type)


def has_track_consent(candidate, *, message_id, rights_confirmed):
    """La declaración es por mensaje, no una verificación de derechos."""
    return (isinstance(candidate, Candidate) and type(message_id) is int
            and message_id == candidate.message_id and rights_confirmed is True)
