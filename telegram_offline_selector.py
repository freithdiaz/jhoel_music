"""Fixture-only terminal presentation; no Telegram access or execution.

The caller supplies a complete synthetic message and an explicit choice. This
module does not establish provenance, consent, or authority to perform an action.
"""

import unicodedata
from dataclasses import dataclass


MAX_TEXT = 2000
MAX_LABEL = 120
MAX_ROWS = 20
MAX_COLUMNS = 10
MAX_BUTTONS = 50


def _safe(value, limit):
    if type(value) is not str or not value or len(value) > limit:
        raise ValueError('Contenido de fixture inválido')
    # Escape literal backslashes too, so text cannot imitate a control escape.
    def escape(c):
        if c == '\\':
            return '\\\\'
        if unicodedata.category(c).startswith('C') or c in '\u2028\u2029':
            code = ord(c)
            return f'\\u{code:04x}' if code <= 0xffff else f'\\U{code:08x}'
        return c

    result = ''.join(escape(c) for c in value)
    if not result.strip():
        raise ValueError('Contenido de fixture inválido')
    return result


@dataclass(frozen=True, init=False)
class Presentation:
    """A display and its inseparable fixture-only selection mapping."""

    display: str
    _coordinates: tuple

    def __init__(self):
        raise TypeError('Use present()')

    def select(self, choice):
        """Return only the coordinate selected from this presentation."""
        if (type(choice) is not str or not choice.isascii() or not choice.isdecimal()
                or len(choice) > 2 or choice.startswith('0')):
            raise ValueError('Selección inválida')
        index = int(choice)
        if not 1 <= index <= len(self._coordinates):
            raise ValueError('Selección inválida')
        return self._coordinates[index - 1]


def present(fixture):
    """Return an immutable presentation bound to its synthetic coordinates.

    Buttons have a label and optionally opaque data, which is never inspected,
    displayed, or returned. Over-limit input is rejected, never truncated.
    """
    if type(fixture) is not dict or set(fixture) != {'text', 'buttons'}:
        raise ValueError('Fixture inválido')
    text = _safe(fixture['text'], MAX_TEXT)
    rows = fixture['buttons']
    if type(rows) is not list or not 1 <= len(rows) <= MAX_ROWS:
        raise ValueError('Botones inválidos')
    lines = [text]
    coordinates = []
    labels = set()
    for row_index, row in enumerate(rows):
        if type(row) is not list or not 1 <= len(row) <= MAX_COLUMNS:
            raise ValueError('Botones inválidos')
        for column_index, button in enumerate(row):
            if (type(button) is not dict or set(button) not in
                    ({'label'}, {'label', 'data'})):
                raise ValueError('Botón inválido')
            label = _safe(button['label'], MAX_LABEL)
            if label in labels or len(coordinates) >= MAX_BUTTONS:
                raise ValueError('Botones ambiguos o excesivos')
            labels.add(label)
            coordinates.append((row_index, column_index))
            lines.append(f'{len(coordinates)}. {label}')
    presentation = object.__new__(Presentation)
    object.__setattr__(presentation, 'display', '\n'.join(lines))
    object.__setattr__(presentation, '_coordinates', tuple(coordinates))
    return presentation
