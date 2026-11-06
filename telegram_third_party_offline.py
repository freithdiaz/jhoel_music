"""Synthetic third-party search/selection contract, with no execution capability.

All identities, approvals and times are untrusted caller-supplied values. These
checks neither authenticate them nor provide persistent, cross-process replay
protection. Dispatch is unconditionally blocked, including for valid fixtures.
"""

MAX_LIFETIME_SECONDS = 300


def _id(value):
    return type(value) is int and value > 0


def _chat(value):
    return type(value) is int and value != 0


def _token(value):
    return type(value) is str and 0 < len(value) <= 128 and bool(value.strip())


def _time_window(issued, expires, now):
    return (type(issued) is int and type(expires) is int and type(now) is int
            and issued <= now < expires and expires - issued <= MAX_LIFETIME_SECONDS)


def validate_search(fixture, *, account_id, chat_id, bot_id, now):
    """Check a synthetic search approval; a True result is not authorization."""
    if type(fixture) is not dict or set(fixture) != {
            'account_id', 'chat_id', 'bot_id', 'is_bot', 'query', 'search_id',
            'issued_at', 'expires_at', 'search_consent'}:
        return False
    query = fixture['query']
    return (type(account_id) is int and _id(account_id)
            and _chat(chat_id) and _id(bot_id)
            and _id(fixture['account_id']) and fixture['account_id'] == account_id
            and _chat(fixture['chat_id']) and fixture['chat_id'] == chat_id
            and _id(fixture['bot_id']) and fixture['bot_id'] == bot_id
            and fixture['is_bot'] is True and fixture['search_consent'] is True
            and type(query) is str and bool(query.strip()) and len(query) <= 200
            and _token(fixture['search_id'])
            and _time_window(fixture['issued_at'], fixture['expires_at'], now))


def validate_selection(search, result, approval, *, account_id, chat_id, bot_id, now):
    """Check separate synthetic selection approval against a specific result.

    Exposure and retention consent is explicit: a callback could cause a third
    party to post media to a group. No actual result or consent is verified.
    """
    if not validate_search(search, account_id=account_id, chat_id=chat_id,
                           bot_id=bot_id, now=now):
        return False
    if (type(result) is not dict or set(result) != {
            'chat_id', 'sender_id', 'is_bot', 'message_id', 'row', 'column',
            'issued_at', 'expires_at', 'search_id', 'query', 'result_id'}
            or type(approval) is not dict or set(approval) != {
                'account_id', 'chat_id', 'bot_id', 'message_id', 'row', 'column',
                'issued_at', 'expires_at', 'selection_consent', 'exposure_consent',
                'search_id', 'query', 'result_id'}):
        return False
    return (_token(result['search_id']) and result['search_id'] == search['search_id']
            and type(result['query']) is str and result['query'] == search['query']
            and _token(result['result_id'])
            and _token(approval['search_id']) and approval['search_id'] == result['search_id']
            and type(approval['query']) is str and approval['query'] == result['query']
            and _token(approval['result_id']) and approval['result_id'] == result['result_id']
            and _chat(result['chat_id']) and result['chat_id'] == chat_id
            and _id(result['sender_id']) and result['sender_id'] == bot_id
            and result['is_bot'] is True and _id(result['message_id'])
            and type(result['row']) is int and result['row'] >= 0
            and type(result['column']) is int and result['column'] >= 0
            and _time_window(result['issued_at'], result['expires_at'], now)
            and search['issued_at'] <= result['issued_at']
            and _id(approval['account_id']) and approval['account_id'] == account_id
            and _chat(approval['chat_id']) and approval['chat_id'] == chat_id
            and _id(approval['bot_id']) and approval['bot_id'] == bot_id
            and _id(approval['message_id']) and approval['message_id'] == result['message_id']
            and type(approval['row']) is int and approval['row'] == result['row']
            and type(approval['column']) is int and approval['column'] == result['column']
            and approval['selection_consent'] is True and approval['exposure_consent'] is True
            and _time_window(approval['issued_at'], approval['expires_at'], now)
            and result['issued_at'] <= approval['issued_at']
            and approval['expires_at'] <= result['expires_at']
            and result['expires_at'] <= search['expires_at'])


def ledger_transition(state, action):
    """Specify one atomic transaction on an already scoped approval, not a ledger.

    A real implementation must bind a unique approval to its full selection,
    atomically persist transitions across processes and restarts, protect state,
    and use a trustworthy clock. This pure model supplies none of those things.
    Uncertain outcomes require manual investigation and never permit retry.
    Invalid transitions fail closed without changing state.
    """
    transitions = {
        ('available', 'consume'): 'consumed',
        ('available', 'cancel'): 'cancelled',
        ('consumed', 'uncertain'): 'uncertain',
    }
    if type(state) is not str or type(action) is not str:
        return state, False
    next_state = transitions.get((state, action))
    return (next_state, True) if next_state is not None else (state, False)


def dispatch(*args, **kwargs):
    """Never dispatch search or selection, regardless of supplied fixtures."""
    return False
