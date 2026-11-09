from concurrent.futures import ThreadPoolExecutor

import pytest

from telegram_selection_registry import SelectionRegistry, SelectionUnavailable


def test_owned_selection_is_single_use():
    registry = SelectionRegistry(clock=lambda: 100)
    token = registry.issue(operator='alice', value=('message', 1))
    with pytest.raises(SelectionUnavailable):
        registry.consume(token, operator='bob')
    assert registry.consume(token, operator='alice') == ('message', 1)
    with pytest.raises(SelectionUnavailable):
        registry.consume(token, operator='alice')


def test_expiry_and_clock_rollback_are_rejected():
    now = [100]
    registry = SelectionRegistry(clock=lambda: now[0], ttl=10)
    token = registry.issue(operator='alice', value='x')
    now[0] = 110
    with pytest.raises(SelectionUnavailable):
        registry.consume(token, operator='alice')
    now[0] = 100
    token = registry.issue(operator='alice', value='x')
    now[0] = 99
    with pytest.raises(SelectionUnavailable):
        registry.consume(token, operator='alice')


def test_concurrent_consume_has_one_winner():
    registry = SelectionRegistry(clock=lambda: 100)
    token = registry.issue(operator='alice', value='x')

    def consume():
        try:
            return registry.consume(token, operator='alice')
        except SelectionUnavailable:
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert list(pool.map(lambda _: consume(), range(16))).count('x') == 1


def test_capacity_and_invalid_clock_fail_closed():
    now = [100]
    registry = SelectionRegistry(clock=lambda: now[0], limit=1)
    registry.issue(operator='alice', value='x')
    with pytest.raises(SelectionUnavailable):
        registry.issue(operator='alice', value='y')
    now[0] = float('nan')
    with pytest.raises(SelectionUnavailable):
        registry.issue(operator='alice', value='y')
