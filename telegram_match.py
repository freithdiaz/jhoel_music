"""Heurística textual conservadora para elegir una coincidencia; no prueba identidad.

El resultado solo ordena candidatos observados. No verifica autoría, licencia,
formato real ni que el audio descargado corresponda a la canción elegida.
"""

import re
import unicodedata
from difflib import SequenceMatcher
from decimal import Decimal, InvalidOperation

from telegram_import import MAX_AUDIO_BYTES


MAX_TEXT = 200
QUALITY_RE = re.compile(r'\b(\d{2,4})\s*(?:kbps|kb\s*s|kbit|k)\b', re.I)
DURATION_RE = re.compile(r'(?<!\d)(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?!\d)')
FILE_SIZE_RE = re.compile(r'(?<![\w.,])(\d+(?:[.,]\d+)?)\s*(MiB|MB|KiB|KB|GiB|GB)(?!\w)', re.I)

# El bot suele añadir tamaño, bitrate y un remitente desconocido. Se eliminan
# antes de comparar el título, pero se conservan para mostrar/ordenar calidad.
METADATA_RE = re.compile(
    r'(?<!\w)\d+(?:[.,]\d+)?\s*(?:kbps|kbit|kb/s|kb|k|mib|mb|gb|m|g)\b', re.I)
UNKNOWN_RE = re.compile(r'<\s*unknown\s*>|\bunknown\b', re.I)

# Palabras que suelen acompañar al título sin cambiar la canción. Solo se
# ignoran si no forman parte del título buscado.
NOISE_TOKENS = frozenset({
    'audio', 'oficial', 'official', 'video', 'lyrics', 'lyric', 'letra',
    'visualizer', 'hd', '4k', 'mv', 'remaster', 'remastered', 'single',
    'album', 'explicit', 'clean', 'deluxe', 'original', 'version', 'music',
    'topic', 'vevo', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wav',
    'lossless', 'kbps', 'kb', 'kbit', 'hq', 'high', 'quality', 'alta',
    'calidad', 'mb', 'mib', 'size', 'peso', 'bachata', 'reggaeton', 'salsa',
    'merengue', 'pop', 'rock', 'latin', 'latino', 'urbano', 'unknown',
})

# Variantes que no deben elegirse si el título buscado no las menciona.
VARIANTS = (
    'cover', 'portada', 'instrumental', 'karaoke', 'remix', 'live', 'en vivo',
    'sped up', 'slowed', 'reverb', 'nightcore', '8d', 'acoustic', 'acustico',
    'tribute', 'tributo', 'parody', 'parodia', 'mashup', 'bootleg', 'demo',
)

# El publicador actual valida y publica MP3. No se autoseleccionan etiquetas
# que declaren otro contenedor, porque el archivo sería rechazado después.
UNSUPPORTED_FORMATS = ('flac', 'wav', 'm4a', 'aac', 'ogg', 'opus')


def normalize(text):
    """Minúsculas sin acentos ni puntuación, con tokens separados por espacios."""
    if type(text) is not str:
        return ''
    decomposed = unicodedata.normalize('NFKD', text).casefold()
    return ' '.join(re.findall(r'[^\W_]+', ''.join(
        char for char in decomposed if not unicodedata.combining(char))))


def clean_candidate_text(text):
    """Quita remitente desconocido, tamaño y bitrate antes de comparar."""
    if type(text) is not str:
        return ''
    return normalize(UNKNOWN_RE.sub(' ', METADATA_RE.sub(' ', text)))


def candidate_line(result):
    """Devuelve el texto propio de un resultado; None si es ambiguo o inválido."""
    if type(result) is not dict:
        return None
    label = result.get('label')
    context = result.get('context')
    if type(label) is not str or type(context) is not str:
        return None
    label = label.strip()
    if re.fullmatch(r'\d{1,3}', label):
        pattern = re.compile(r'^\s*' + re.escape(label) + r'[.)]\s+')
        lines = [line for line in context.splitlines() if pattern.match(line)]
        if len(lines) != 1:
            return None
        line = pattern.sub('', lines[0], count=1)
    else:
        line = label
    line = re.sub(r'^\s*\d{1,3}[.)]\s*', '', line).strip()
    return line or None


def quality_tier(text):
    """Preferencia de calidad MP3; 4 es la mejor etiqueta observada."""
    norm = normalize(text)
    if not norm:
        return 0
    if any(token in UNSUPPORTED_FORMATS for token in norm.split()):
        return 0
    bitrates = [int(value) for value in QUALITY_RE.findall(norm)]
    if bitrates:
        bitrate = max(bitrates)
        if bitrate >= 320:
            return 4
        if bitrate >= 256:
            return 3
        if bitrate >= 192:
            return 2
        if bitrate >= 128:
            return 1
    if re.search(r'\b(hq|high quality|alta calidad)\b', norm):
        return 2
    return 0


def declared_size_exceeds_limit(text):
    """Rechaza tamaños declarados superiores al límite; no verifica el archivo real."""
    if not isinstance(text, str):
        return False
    factors = {'kb': 1000, 'kib': 1024, 'mb': 1000000, 'mib': 1048576,
               'gb': 1000000000, 'gib': 1073741824}
    for match in FILE_SIZE_RE.finditer(text):
        try:
            if Decimal(match.group(1).replace(',', '.')) * factors[match.group(2).lower()] > MAX_AUDIO_BYTES:
                return True
        except InvalidOperation:
            continue
    return False


def duration_seconds(text):
    if type(text) is not str:
        return None
    match = DURATION_RE.search(text)
    if match is None:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2))
    seconds = int(match.group(3))
    if seconds >= 60 or (match.group(1) is None and minutes >= 60):
        return None
    return hours * 3600 + minutes * 60 + seconds


def _unwanted_variants(target_norm, candidate_norm):
    target_tokens = set(target_norm.split())
    candidate_tokens = set(candidate_norm.split())
    found = []
    for variant in VARIANTS:
        tokens = variant.split()
        if all(token in candidate_tokens for token in tokens) and not all(token in target_tokens for token in tokens):
            found.append(variant)
    return found


def _candidate_title_tokens(candidate_norm, artist_norm, target_tokens):
    """Quita artista, ruido, duración y bitrate antes de comparar el título."""
    artist_tokens = set(artist_norm.split())
    result = []
    for token in candidate_norm.split():
        if token in artist_tokens and token not in target_tokens:
            continue
        if token in NOISE_TOKENS and token not in target_tokens:
            continue
        # Años, bitrates y fragmentos de duración no forman parte del título.
        if token.isdigit() and len(token) <= 4 and token not in target_tokens:
            continue
        if re.fullmatch(r'\d+[a-z]{1,3}', token) and token not in target_tokens:
            continue
        result.append(token)
    return result


def _title_score(target_title, candidate_norm, artist_norm):
    target_tokens = target_title.split()
    if not target_tokens:
        return 0.0
    candidate_tokens = _candidate_title_tokens(candidate_norm, artist_norm, set(target_tokens))
    if not candidate_tokens:
        return 0.0
    target_set = set(target_tokens)
    candidate_set = set(candidate_tokens)
    if not target_set <= candidate_set:
        return 0.0
    # La precisión evita aceptar «Amor» cuando el candidato dice «Amor prohibido».
    precision = len(target_set) / len(candidate_set)
    ratio = SequenceMatcher(None, target_title, ' '.join(candidate_tokens)).ratio()
    return 0.6 * precision + 0.4 * ratio


def _artist_score(target_artist, candidate_norm):
    if not target_artist:
        return 1.0
    tokens = set(target_artist.split())
    if not tokens:
        return 1.0
    present = len(tokens & set(candidate_norm.split()))
    return present / len(tokens)


def _duration_score(target_duration, candidate_duration):
    if target_duration is None or candidate_duration is None:
        return 0.0
    difference = abs(float(target_duration) - candidate_duration)
    if difference <= 2:
        return 1.0
    if difference <= 5:
        return 0.7
    if difference <= 10:
        return 0.4
    return 0.0


def score_candidate(target, result):
    """Puntúa un candidato o devuelve None si no supera los límites conservadores."""
    if type(target) is not dict or type(result) is not dict:
        return None
    title = normalize(target.get('title'))
    artist = normalize(target.get('artist'))
    if not title:
        return None
    line = candidate_line(result)
    if line is None:
        return None
    if declared_size_exceeds_limit(line):
        return None
    candidate_norm = clean_candidate_text(line)
    if not candidate_norm:
        return None

    # Un formato declarado no publicable no debe autoseleccionarse.
    if any(token in UNSUPPORTED_FORMATS for token in candidate_norm.split()):
        return None
    if _unwanted_variants(title + ' ' + artist, candidate_norm):
        return None

    title_score = _title_score(title, candidate_norm, artist)
    artist_score = _artist_score(artist, candidate_norm)
    if title_score < 0.88 or artist_score < 0.6:
        return None

    quality = quality_tier(line)
    duration = duration_seconds(line)
    duration_score = _duration_score(target.get('duration'), duration)
    if artist:
        final = 0.78 * title_score + 0.15 * artist_score + 0.05 * (quality / 4) + 0.02 * duration_score
    else:
        final = 0.93 * title_score + 0.05 * (quality / 4) + 0.02 * duration_score
    return {
        'result': dict(result),
        'display': line,
        'normalized': candidate_norm,
        'score': final,
        'title_score': title_score,
        'artist_score': artist_score,
        'quality': quality,
        'duration': duration,
        'duration_score': duration_score,
    }


def _meaningful_tokens(text):
    if type(text) is not str:
        return []
    result = []
    for token in clean_candidate_text(text).split():
        if token in NOISE_TOKENS or token.isdigit() or re.fullmatch(r'\d+[a-z]{1,3}', token):
            continue
        result.append(token)
    return result


def receipt_matches_selection(selection_text, receipt_title):
    """Comprueba el título recibido tras quitar ruido; no prueba identidad."""
    receipt = _meaningful_tokens(receipt_title)
    selection = set(_meaningful_tokens(selection_text))
    if not receipt or not selection or sum(len(token) for token in receipt) < 4:
        return False
    return all(token in selection for token in receipt)


def best_match(target, results):
    """Devuelve la mejor coincidencia solo si es clara; si hay empate, None."""
    if type(results) is not list:
        return None
    scored = []
    for result in results:
        score = score_candidate(target, result)
        if score is not None:
            scored.append(score)
    if not scored:
        return None
    scored.sort(key=lambda item: (item['score'], item['quality'], item['duration_score']),
                reverse=True)
    best = scored[0]
    if len(scored) > 1:
        second = scored[1]
        if (second['score'] >= best['score'] - 0.02
                and second['quality'] == best['quality']
                and abs(second['duration_score'] - best['duration_score']) < 0.01):
            # Dos opciones equivalentes con el mismo título limpio, calidad y
            # duración suelen ser la misma copia publicada dos veces. Se elige
            # la primera; si difieren en algo relevante, se deja al operador.
            if second['normalized'] != best['normalized'] or second['duration'] != best['duration']:
                return None
    return {
        'result': best['result'],
        'display': best['display'],
        'score': round(best['score'], 4),
        'title_score': round(best['title_score'], 4),
        'artist_score': round(best['artist_score'], 4),
        'quality': best['quality'],
    }
