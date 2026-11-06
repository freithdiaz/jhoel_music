import asyncio
from types import SimpleNamespace

import pytest

pytest.importorskip('telethon')
from telethon.tl.types import User, Chat, ChatParticipant, ChannelParticipantLeft, PeerUser

from telegram_third_party_identity import IdentityRefused, verify_identity


class Client:
    def __init__(self):
        self.me = User(id=1, bot=False)
        self.bot = User(id=2, bot=True, username='vkmusbot')
        self.group = Chat(id=3, title='private', photo=None, participants_count=2,
                          date=None, version=1)
        self.participant = ChatParticipant(user_id=2, inviter_id=1, date=None)
        self.calls = []

    async def get_me(self):
        self.calls.append('me')
        return self.me

    async def get_entity(self, value):
        self.calls.append(value)
        return self.bot if value == 'vkmusbot' else self.group

    async def get_permissions(self, group, entity):
        self.calls.append('permissions')
        return SimpleNamespace(participant=self.participant)


def run(client, **changes):
    args = dict(account_id=1, bot_id=2, confirmed_bot_id=2,
                group_id=-3, confirmed_group_id=-3)
    args.update(changes)
    return asyncio.run(verify_identity(client, **args))


def test_verified_with_authenticated_client_stub():
    client = Client()
    assert run(client) == (client.me, client.bot, client.group)
    assert client.calls == ['me', 'vkmusbot', -3, 'permissions', 'permissions']


@pytest.mark.parametrize('changes', [dict(confirmed_bot_id=4),
                                      dict(confirmed_group_id=-4),
                                      dict(bot_id=True), dict(group_id=3)])
def test_invalid_confirmation_never_calls_client(changes):
    client = Client()
    with pytest.raises(IdentityRefused):
        run(client, **changes)
    assert client.calls == []


def test_impostor_and_inactive_membership_rejected():
    client = Client()
    client.bot.username = 'otherbot'
    with pytest.raises(IdentityRefused):
        run(client)
    client.bot.username = 'vkmusbot'
    client.participant = ChannelParticipantLeft(peer=PeerUser(2))
    with pytest.raises(IdentityRefused):
        run(client)
