import pytest

from telegram_deletion_queue import DeletionError, DeletionQueue


def test_deletion_requires_exact_filename_confirmation_and_owner():
    queue = DeletionQueue(clock=lambda: 1)
    filename = 'telegram-' + 'a' * 32 + '.mp3'
    with pytest.raises(DeletionError):
        queue.submit(operator='alice', filename=filename, confirmed=False)
    with pytest.raises(DeletionError):
        queue.submit(operator='alice', filename='../other.mp3', confirmed=True)
    identifier = queue.submit(operator='alice', filename=filename, confirmed=True)
    assert queue.claim() == {'id': identifier, 'filename': filename}
    assert queue.claim() is None
    with pytest.raises(DeletionError):
        queue.status(identifier=identifier, operator='bob')
    queue.finish(identifier=identifier, deleted=True)
    assert queue.status(identifier=identifier, operator='alice')['state'] == 'deleted'
    queue.clear(identifier=identifier, operator='alice')


def test_inflight_timeout_is_uncertain_and_not_retried():
    now = [1]
    queue = DeletionQueue(clock=lambda: now[0], timeout=5)
    identifier = queue.submit(operator='alice', filename='telegram-' + 'a' * 32 + '.mp3', confirmed=True)
    queue.claim()
    now[0] = 6
    assert queue.status(identifier=identifier, operator='alice')['state'] == 'uncertain'
    assert queue.claim() is None
    with pytest.raises(DeletionError):
        queue.finish(identifier=identifier, deleted=True)
