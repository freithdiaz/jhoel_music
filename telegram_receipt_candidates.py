"""Comparación de snapshots Bot API, sin polling ni descarga de archivos."""

from telegram_import import candidate_from_update


class ReceiptObservationError(ValueError):
    pass


def _index(updates):
    if not isinstance(updates, list) or len(updates) >= 100:
        raise ReceiptObservationError('Página de actualizaciones incompleta')
    indexed = {}
    for update in updates:
        if not isinstance(update, dict):
            raise ReceiptObservationError('Actualización inválida')
        update_id = update.get('update_id')
        if type(update_id) is not int or update_id < 0 or update_id in indexed:
            raise ReceiptObservationError('Identificadores de actualización inválidos')
        indexed[update_id] = update
    return indexed


def new_audio_candidates(before, after, *, group_id, sender_id):
    """Lista audios nuevos observados; no demuestra causalidad ni licencia.

    Rechaza páginas llenas y cambios que impidan comparar ambas observaciones.
    No confirma actualizaciones y no realiza solicitudes a Telegram.
    """
    old, new = _index(before), _index(after)
    if not old.keys() <= new.keys():
        raise ReceiptObservationError('La cola cambió o fue consumida')
    if any(old[update_id] != new[update_id] for update_id in old):
        raise ReceiptObservationError('Una actualización observada cambió')
    result = []
    for update_id in sorted(new.keys() - old.keys()):
        candidate = candidate_from_update(new[update_id], group_id=group_id, sender_id=sender_id)
        if candidate is not None:
            result.append(candidate)
    return result
