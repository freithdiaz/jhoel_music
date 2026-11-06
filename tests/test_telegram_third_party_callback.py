from telethon.tl.types import (Chat, InlineButtonTypeCallback, KeyboardInlineButton,
                               KeyboardInlineButtonRow, Message, PeerChat, PeerUser,
                               ReplyInlineMarkup, User)

import telegram_third_party_callback as callback


def fixtures():
    me = User(id=1)
    bot = User(id=42, bot=True, username='vkmusbot')
    group = Chat(id=10, title='private', photo=None, participants_count=2,
                 date=None, version=1)
    message = Message(id=3, peer_id=PeerChat(10), date=None, message='result',
                      from_id=PeerUser(42), reply_markup=ReplyInlineMarkup(rows=[
                          KeyboardInlineButtonRow(buttons=[KeyboardInlineButton(
                              text='song', type=InlineButtonTypeCallback(data=b'secret'))])]))
    return me, bot, group, message


def test_confirmation_revalidation_and_process_limit(monkeypatch):
    monkeypatch.setattr(callback, '_consumed', False)
    me, bot, group, message = fixtures()
    prepared = callback.prepare(message, (0, 0), me=me, bot=bot, group=group,
                                account_id=1, bot_id=42, group_id=-10)
    args = dict(me=me, bot=bot, group=group)
    assert prepared.confirm_and_check(message, confirmation='NO', **args) is False
    assert not callback._consumed
    message.reply_markup.rows[0].buttons[0].type.data = b'changed'
    assert prepared.confirm_and_check(message, confirmation='SI', **args) is False
    assert not callback._consumed
    message.reply_markup.rows[0].buttons[0].type.data = b'secret'
    bot.username = 'other'
    assert prepared.confirm_and_check(message, confirmation='SI', **args) is False
    assert not callback._consumed
    bot.username = 'vkmusbot'
    assert prepared.confirm_and_check(message, confirmation='SI', **args) is False
    assert callback._consumed
    assert prepared.confirm_and_check(message, confirmation='SI', **args) is False
