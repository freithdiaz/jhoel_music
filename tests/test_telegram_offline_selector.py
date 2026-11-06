import pytest

import telegram_offline_selector as selector


def test_synthetic_presentation_and_explicit_selection():
    fixture = {'text': 'Resultados ficticios', 'buttons': [
        [{'label': 'Canción A', 'data': b'secret-payload'}],
        [{'label': 'Canción B'}],
    ]}
    presentation = selector.present(fixture)
    assert presentation.display == 'Resultados ficticios\n1. Canción A\n2. Canción B'
    assert 'secret-payload' not in presentation.display
    assert presentation.select('2') == (1, 0)


def test_untrusted_controls_cannot_control_terminal():
    presentation = selector.present({'text': 'a\x1b[31m\n\u202eb\x9b',
                                   'buttons': [[{'label': 'x\r\t\u2066y'}]]})
    assert presentation.display == r'a\u001b[31m\u000a\u202eb\u009b' + '\n' + r'1. x\u000d\u0009\u2066y'


@pytest.mark.parametrize('choice', ['', '0', '01', ' 1', '1\n', '-1', '2', '١', True, None, '9' * 100])
def test_selection_must_be_explicit_and_in_range(choice):
    with pytest.raises(ValueError):
        selector.present({'text': 'x', 'buttons': [[{'label': 'a'}]]}).select(choice)


@pytest.mark.parametrize('fixture', [
    {'text': 'x' * (selector.MAX_TEXT + 1), 'buttons': [[{'label': 'a'}]]},
    {'text': 'x', 'buttons': [[{'label': 'a' * (selector.MAX_LABEL + 1)}]]},
    {'text': 'x', 'buttons': [[{'label': 'a'}, {'label': 'a'}]]},
    {'text': 'x', 'buttons': []},
    {'text': 'x', 'buttons': [[]]},
    {'text': 'x', 'buttons': [[{'label': 'a'}]] * (selector.MAX_ROWS + 1)},
    {'text': 'x', 'buttons': [[{'label': str(i)} for i in range(selector.MAX_COLUMNS + 1)]]},
    {'text': 'x', 'buttons': [[{'label': str(i * 10 + j)} for j in range(10)] for i in range(6)]},
    {'text': 'x', 'buttons': [[{'label': 'a', 'unexpected': 'secret'}]]},
])
def test_rejects_incomplete_ambiguous_or_invalid_fixtures(fixture):
    with pytest.raises(ValueError):
        selector.present(fixture)


def test_opaque_payload_is_never_inspected():
    class Opaque:
        def __repr__(self):
            pytest.fail('payload inspected')

    presentation = selector.present({'text': 'x', 'buttons': [[{'label': 'a', 'data': Opaque()}]]})
    assert presentation.display == 'x\n1. a'


def test_mapping_is_bound_to_immutable_presentation():
    from dataclasses import FrozenInstanceError

    first = selector.present({'text': 'x', 'buttons': [[{'label': 'a'}, {'label': 'b'}]]})
    second = selector.present({'text': 'y', 'buttons': [[{'label': 'a'}], [{'label': 'b'}]]})
    assert first.select('2') == (0, 1)
    assert second.select('2') == (1, 0)
    with pytest.raises(FrozenInstanceError):
        first._coordinates = ((9, 9),)
    with pytest.raises(TypeError):
        selector.Presentation()
    with pytest.raises(TypeError):
        first.select('1', ((9, 9),))


def test_escape_not_confused_with_literal_or_other_controls():
    presentation = selector.present({'text': '\\u001b\x1b\x9b\u202e', 'buttons': [[
        {'label': '\\u001b'}, {'label': '\x1b'}, {'label': '\u202e'}]]})
    assert presentation.display == (r'\\u001b\u001b\u009b\u202e' + '\n'
                                    + r'1. \\u001b' + '\n' + r'2. \u001b' + '\n'
                                    + r'3. \u202e')
