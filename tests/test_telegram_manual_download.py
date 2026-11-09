import pytest
import telegram_manual_download as manual

from telegram_import import Candidate
from telegram_manual_download import candidates_from_updates, get_chunks, save_quarantined


def test_saves_exact_bytes_without_overwriting(tmp_path):
    candidate = Candidate(7, 'file_123', 3, 'audio/mpeg')
    first = save_quarantined([b'a', b'bc'], candidate=candidate, destination=tmp_path)
    second = save_quarantined([b'xyz'], candidate=candidate, destination=tmp_path)
    assert first != second
    assert first.read_bytes() == b'abc'
    assert second.read_bytes() == b'xyz'


def test_incomplete_transfer_does_not_publish(tmp_path):
    candidate = Candidate(7, 'file_123', 3, 'audio/mpeg')
    with pytest.raises(ValueError):
        save_quarantined([b'a'], candidate=candidate, destination=tmp_path)
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize('path', ['../secret', '/etc/passwd', 'a//b', 'https://evil.test/a'])
def test_bad_paths_rejected_before_network(path):
    with pytest.raises(ValueError):
        list(get_chunks('unused', path))


def test_full_update_page_is_rejected():
    with pytest.raises(ValueError):
        candidates_from_updates([{}] * 100)


def test_only_expected_sender_and_group_are_listed():
    update = {'message': {'message_id': 7, 'chat': {'id': -5498752855, 'type': 'group'},
                          'from': {'id': 117250343}, 'audio': {'file_id': 'file_123',
                          'file_size': 3, 'mime_type': 'audio/mpeg', 'title': 'Song\x1b'}}}
    found = candidates_from_updates([update])
    assert len(found) == 1
    assert found[0][1] == 'Song?'
    update['message']['from']['id'] = 1
    assert candidates_from_updates([update]) == []


def test_diagnostic_shows_stage_without_exception_details(monkeypatch, capsys):
    monkeypatch.setattr(manual.sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr('builtins.input', lambda prompt: 'CONTINUAR')
    monkeypatch.setattr(manual, 'read_bot_token', lambda: 'token')

    def fail(*args):
        raise RuntimeError('secret token and URL')

    monkeypatch.setattr(manual, 'bot_request', fail)
    assert manual.main() == 1
    output = capsys.readouterr().out
    assert 'consulta de identidad del bot' in output
    assert 'secret token and URL' not in output
