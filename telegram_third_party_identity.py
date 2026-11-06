"""Read-only identity checks for a future supervised third-party experiment.

Requires an already authenticated, memory-only client. This is not a login
entry point or authorization to search or invoke a callback. Resolving entities
and checking membership can contact Telegram if called with a real client.
"""


class IdentityRefused(ValueError):
    pass


async def verify_identity(client, *, account_id, bot_id, confirmed_bot_id,
                          group_id, confirmed_group_id):
    """Resolve the account, @vkmusbot and private group by confirmed IDs.

    The caller must obtain confirmations directly from the operator. The result
    is ephemeral and does not authorize any subsequent operation.
    """
    if (type(account_id) is not int or account_id <= 0
            or type(bot_id) is not int or bot_id <= 0
            or type(confirmed_bot_id) is not int or bot_id != confirmed_bot_id
            or type(group_id) is not int or group_id >= 0
            or type(confirmed_group_id) is not int or group_id != confirmed_group_id):
        raise IdentityRefused('Identificadores no confirmados')

    from telethon.tl.types import (
        User, Chat, Channel, ChatParticipant, ChatParticipantAdmin,
        ChatParticipantCreator, ChannelParticipant, ChannelParticipantAdmin,
        ChannelParticipantCreator,
    )
    from telethon.utils import get_peer_id

    me = await client.get_me()
    bot = await client.get_entity('vkmusbot')
    group = await client.get_entity(group_id)
    if (not isinstance(me, User) or me.bot or me.id != account_id
            or not isinstance(bot, User) or bot.bot is not True or bot.id != bot_id
            or (bot.username or '').lower() != 'vkmusbot'
            or not isinstance(group, (Chat, Channel)) or get_peer_id(group) != group_id
            or getattr(group, 'username', None) or getattr(group, 'usernames', None)
            or getattr(group, 'left', False) or getattr(group, 'deactivated', False)
            or getattr(group, 'forbidden', False)
            or (isinstance(group, Channel) and not group.megagroup)):
        raise IdentityRefused('No se verificaron las identidades')

    allowed = (ChatParticipant, ChatParticipantAdmin, ChatParticipantCreator,
               ChannelParticipant, ChannelParticipantAdmin, ChannelParticipantCreator)
    for entity in (me, bot):
        permissions = await client.get_permissions(group, entity)
        if not isinstance(getattr(permissions, 'participant', None), allowed):
            raise IdentityRefused('No se verificó la membresía')
    return me, bot, group
