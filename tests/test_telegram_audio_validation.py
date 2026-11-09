from types import SimpleNamespace
import subprocess

import pytest

import telegram_audio_validation as validation


def test_validation_uses_bounded_isolated_container(tmp_path, monkeypatch):
    path = tmp_path / 'audio.bin'
    path.write_bytes(b'audio')
    monkeypatch.setattr(validation, 'docker_executable', lambda: 'docker')
    calls = []

    def run(command, **kwargs):
        calls.append((command, kwargs))
        return SimpleNamespace(returncode=0)

    assert validation.validate_mp3(path, run=run) == b'audio'
    command, kwargs = calls[0]
    assert command[command.index('--network') + 1] == 'none'
    assert '--read-only' in command and '--pull=never' in command and '-xerror' in command
    assert kwargs['input'] == b'audio' and kwargs['timeout'] == 90


def test_validation_rejects_empty_and_failed_decoder(tmp_path, monkeypatch):
    path = tmp_path / 'audio.bin'
    path.write_bytes(b'')
    with pytest.raises(validation.AudioValidationError):
        validation.validate_mp3(path)
    path.write_bytes(b'not audio')
    monkeypatch.setattr(validation, 'docker_executable', lambda: 'docker')
    with pytest.raises(validation.AudioValidationError):
        validation.validate_mp3(path, run=lambda *args, **kwargs: SimpleNamespace(returncode=1))


def test_validation_rejects_oversized_without_docker(tmp_path, monkeypatch):
    path = tmp_path / 'audio.bin'
    path.write_bytes(b'a' * (validation.MAX_AUDIO_BYTES + 1))
    monkeypatch.setattr(validation, 'docker_executable', lambda: pytest.fail('no Docker for oversized input'))
    with pytest.raises(validation.AudioValidationError):
        validation.validate_mp3(path)


def test_validation_transcodes_supported_container_to_mp3(tmp_path, monkeypatch):
    path = tmp_path / 'audio.bin'
    path.write_bytes(b'm4a')
    monkeypatch.setattr(validation, 'docker_executable', lambda: 'docker')
    calls = []

    def run(command, **kwargs):
        calls.append(command)
        if 'ffprobe' in command:
            return SimpleNamespace(returncode=0, stdout=b'mov,mp4,m4a,3gp,3g2,mj2\n')
        if 'libmp3lame' in command:
            return SimpleNamespace(returncode=0, stdout=b'ID3converted')
        return SimpleNamespace(returncode=1)

    assert validation.validate_mp3(path, run=run) == b'ID3converted'
    assert any('libmp3lame' in command for command in calls)


def test_validation_rejects_unknown_container(tmp_path, monkeypatch):
    path = tmp_path / 'audio.bin'
    path.write_bytes(b'not audio')
    monkeypatch.setattr(validation, 'docker_executable', lambda: 'docker')

    def run(command, **kwargs):
        if 'ffprobe' in command:
            return SimpleNamespace(returncode=0, stdout=b'application/pdf\n')
        return SimpleNamespace(returncode=1)

    with pytest.raises(validation.AudioValidationError):
        validation.validate_mp3(path, run=run)


def test_publication_creates_distinct_complete_files_without_temporaries(tmp_path):
    first = validation.publish_validated_mp3(b'validated-audio', directory=tmp_path)
    second = validation.publish_validated_mp3(b'other-audio', directory=tmp_path)
    assert first != second
    assert first.read_bytes() == b'validated-audio'
    assert second.read_bytes() == b'other-audio'
    assert all(path.name.startswith('telegram-') and path.suffix == '.mp3' for path in tmp_path.iterdir())


def test_failed_publication_leaves_no_partial_file(tmp_path, monkeypatch):
    def fail(*args):
        raise OSError('failure')
    monkeypatch.setattr(validation.os, 'link', fail)
    with pytest.raises(validation.AudioValidationError):
        validation.publish_validated_mp3(b'audio', directory=tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_timeout_only_targets_the_container_from_this_attempt(tmp_path, monkeypatch):
    path = tmp_path / 'audio.bin'
    path.write_bytes(b'audio')
    monkeypatch.setattr(validation, 'docker_executable', lambda: 'docker')
    calls = []

    def run(command, **kwargs):
        calls.append(command)
        if command[1] == 'run':
            raise subprocess.TimeoutExpired(command, 90)
        return SimpleNamespace(returncode=0)

    with pytest.raises(validation.AudioValidationError):
        validation.validate_mp3(path, run=run)
    container_name = calls[0][calls[0].index('--name') + 1]
    assert calls[1] == ['docker', 'rm', '-f', container_name]


def test_extracts_sanitized_tags_and_recoded_cover(monkeypatch):
    monkeypatch.setattr(validation, 'docker_executable', lambda: 'docker')
    results = iter([
        SimpleNamespace(returncode=0, stdout=b'{"format":{"tags":{"title":"Imitadora","artist":"Romeo Santos","genre":"Bachata"}}}'),
        SimpleNamespace(returncode=0, stdout=b'\xff\xd8\xffimage'),
    ])
    metadata, cover = validation.extract_mp3_metadata(b'audio', run=lambda *args, **kwargs: next(results))
    assert metadata == {'title': 'Imitadora', 'artist': 'Romeo Santos', 'genre': 'Bachata'}
    assert cover == b'\xff\xd8\xffimage'


def test_sidecars_do_not_overwrite_and_require_exact_audio(tmp_path):
    audio = tmp_path / ('telegram-' + 'a' * 32 + '.mp3')
    audio.write_bytes(b'audio')
    with pytest.raises(validation.AudioValidationError):
        validation.write_metadata_sidecars(audio, b'changed', {'title': 'Song'}, b'')
    validation.write_metadata_sidecars(audio, b'audio', {'title': 'Song', 'genre': 'Bachata'}, b'\xff\xd8\xffimage')
    assert audio.with_suffix('.jpg').read_bytes() == b'\xff\xd8\xffimage'
    assert 'Bachata' in audio.with_suffix('.json').read_text(encoding='utf-8')
    with pytest.raises(validation.AudioValidationError):
        validation.write_metadata_sidecars(audio, b'audio', {'title': 'Other'}, b'')
