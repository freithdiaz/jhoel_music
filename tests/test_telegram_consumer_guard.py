import pytest

from telegram_consumer_guard import ConsumerGuard, ConsumerUnavailable


NO_WEBHOOK = {'ok': True, 'result': {'url': ''}}


@pytest.mark.parametrize('info', [None, {}, {'ok': True},
    {'ok': True, 'result': {}}, {'ok': True, 'result': {'url': None}},
    {'ok': True, 'result': {'url': 'https://example.com'}},
    {'ok': 1, 'result': {'url': ''}}])
def test_unknown_or_active_webhook_fails_closed(info):
    guard = ConsumerGuard()
    with pytest.raises(ConsumerUnavailable):
        with guard.claim(info):
            pass
    with guard.claim(NO_WEBHOOK):
        pass


def test_rejects_simultaneous_claim_and_releases_on_error():
    guard = ConsumerGuard()
    with pytest.raises(ValueError):
        with guard.claim(NO_WEBHOOK):
            with pytest.raises(ConsumerUnavailable):
                with guard.claim(NO_WEBHOOK):
                    pass
            raise ValueError('error')
    with guard.claim(NO_WEBHOOK):
        pass
