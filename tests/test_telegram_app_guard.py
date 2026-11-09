import pytest

from telegram_app_guard import operator_allowed


def test_requires_explicit_enable_and_matching_operator():
    assert operator_allowed(enabled=True, configured_operator='operador', authenticated_user='operador')
    assert not operator_allowed(enabled=False, configured_operator='operador', authenticated_user='operador')
    assert not operator_allowed(enabled=1, configured_operator='operador', authenticated_user='operador')
    assert not operator_allowed(enabled=True, configured_operator='operador', authenticated_user='otro')


@pytest.mark.parametrize('value', [None, '', 'ABC', ' ab', 'a', 'a' * 65, 'op/erador'])
def test_rejects_missing_or_invalid_operator(value):
    assert not operator_allowed(enabled=True, configured_operator=value, authenticated_user=value)
