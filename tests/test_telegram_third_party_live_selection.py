import asyncio
import socket
from types import SimpleNamespace

import pytest
from telethon.tl.types import (InlineButtonTypeCallback, KeyboardInlineButton,
                               KeyboardInlineButtonRow, Message, PeerChat, PeerUser,
                               ReplyInlineMarkup)

import telegram_third_party_search as search


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    original = socket.socket.connect

    def blocked(sock, address):
        if isinstance(address, tuple) and address[0] == '127.0.0.1':
            return original(sock, address)
        raise AssertionError('network forbidden')

    monkeypatch.setattr(socket.socket, 'connect', blocked)
    monkeypatch.setattr(socket, 'create_connection', lambda *a, **k: pytest.fail('network forbidden'))


def observed(sender=42):
    return Message(id=3, peer_id=PeerChat(10), date=None, message='resultado\x1b[2J',
                   from_id=PeerUser(sender), reply_markup=ReplyInlineMarkup(rows=[
                       KeyboardInlineButtonRow(buttons=[KeyboardInlineButton(
                           text='canción\n1. falso', type=InlineButtonTypeCallback(data=b'SECRET_PAYLOAD'))])]))


def test_live_observation_to_local_selection(monkeypatch, capsys):
    class Client:
        def add_event_handler(self, fn, event):
            self.fn = fn

        def remove_event_handler(self, fn, event):
            pass

        async def send_message(self, group, text):
            return SimpleNamespace(id=7)

    client = Client()

    async def observe(_):
        await client.fn(SimpleNamespace(message=observed()))
        await client.fn(SimpleNamespace(message=observed(sender=43)))

    monkeypatch.setattr(search.asyncio, 'sleep', observe)
    candidates = []
    result = asyncio.run(search.search_once(client, object(), -10, 42, 'test', candidates=candidates))
    assert result == [('indeterminado', 'sin medio')]
    assert len(candidates) == 1
    answers = iter(['1', 'SI', '1'])
    prompts = []
    def answer(prompt):
        prompts.append(prompt)
        return next(answers)
    monkeypatch.setattr('builtins.input', answer)
    assert search.select_observed(candidates) == (0, (0, 0))
    output = capsys.readouterr().out
    assert 'resultado\\u001b[2J' in output
    assert 'canción\\u000a1. falso' in output
    assert 'SECRET_PAYLOAD' not in output and '\x1b' not in output
    assert output.index('no resultados verificados') < output.index('--- Mensaje 1 ---')
    assert 'no se ha establecido causalidad' in output
    assert 'Reconoce' in prompts[1] and 'Índice de botón' in prompts[2]
    assert 'no se envió callback' in output


def test_unsupported_or_ambiguous_markup_not_selectable(monkeypatch, capsys):
    msg = observed()
    msg.reply_markup.rows[0].buttons.append(KeyboardInlineButton(text='canción\n1. falso', type=InlineButtonTypeCallback(data=b'x')))
    monkeypatch.setattr('builtins.input', lambda _: pytest.fail('unexpected prompt'))
    assert search.select_observed([msg]) is None
    assert 'No hay mensajes observados' in capsys.readouterr().out


def test_selection_index_refers_to_original_candidate(monkeypatch):
    unsupported = observed()
    unsupported.reply_markup = None
    answers = iter(['1', 'SI', '1'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    assert search.select_observed([unsupported, observed()]) == (1, (0, 0))


def test_cancel_does_not_select(monkeypatch):
    monkeypatch.setattr('builtins.input', lambda _: '0')
    assert search.select_observed([observed()]) is None


@pytest.mark.parametrize('confirmation', ['NO', '', 'si', '1'])
def test_recognition_requires_explicit_confirmation(monkeypatch, confirmation, capsys):
    answers = iter(['1', confirmation])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    assert search.select_observed([observed()]) is None
    assert 'Selección cancelada; no se envió callback' in capsys.readouterr().out
