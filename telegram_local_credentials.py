"""Optional local credential discovery. Never invoked without explicit consent."""

import json
import os
import re
import urllib.request
from pathlib import Path


class Refused(ValueError):
    pass


def _env_value(name):
    value = os.environ.get(name, '').strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return value


def read_optional_phone():
    """Read only the optional local phone, without expanding or logging it."""
    env_phone = _env_value('TELEGRAM_PHONE')
    if env_phone:
        if not re.fullmatch(r'\+[1-9][0-9]{1,14}', env_phone):
            raise Refused('Configuración telefónica inválida')
        return env_phone
    values = []
    for line in (Path(__file__).resolve().parent / '.env').read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        if key.strip() != 'TELEGRAM_PHONE':
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values.append(value)
    if len(values) > 1:
        raise Refused('Configuración telefónica ambigua')
    if not values or not values[0]:
        return None
    if not re.fullmatch(r'\+[1-9][0-9]{1,14}', values[0]):
        raise Refused('Configuración telefónica inválida')
    return values[0]


def read_credentials():
    # Environment variables (systemd EnvironmentFile) take precedence over .env.
    env_api_id = _env_value('TELEGRAM_API_ID')
    env_api_hash = _env_value('TELEGRAM_API_HASH')
    env_token = _env_value('TELEGRAM_BOT_TOKEN')
    if env_api_id or env_api_hash or env_token:
        api_id, api_hash, token = env_api_id, env_api_hash, env_token
    else:
        # Intentionally do not expand variables, execute shell syntax, or alter os.environ.
        values = {}
        for line in (Path(__file__).resolve().parent / '.env').read_text(encoding='utf-8-sig').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            key, value = key.strip(), value.strip()
            if key not in ('Api_id', 'Api_hash', 'token_telegram'):
                continue
            if key in values:
                raise Refused('Credenciales ambiguas')
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[key] = value
        api_id = values.get('Api_id', '')
        api_hash = values.get('Api_hash', '')
        token = values.get('token_telegram', '')
    if (not re.fullmatch(r'[0-9]+', api_id) or int(api_id) <= 0
            or not re.fullmatch(r'[0-9a-fA-F]{32}', api_hash)
            or not re.fullmatch(r'[0-9]+:[A-Za-z0-9_-]+', token)):
        raise Refused('Credenciales inválidas')
    return int(api_id), api_hash, token


def read_bot_token():
    """Lee solo el token para pruebas Bot API, sin exigir credenciales MTProto."""
    env_token = _env_value('TELEGRAM_BOT_TOKEN')
    if env_token:
        if not re.fullmatch(r'[0-9]+:[A-Za-z0-9_-]+', env_token):
            raise Refused('Token ausente, ambiguo o inválido')
        return env_token
    values = []
    for line in (Path(__file__).resolve().parent / '.env').read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        if key.strip() != 'token_telegram':
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values.append(value)
    if len(values) != 1 or not re.fullmatch(r'[0-9]+:[A-Za-z0-9_-]+', values[0]):
        raise Refused('Token ausente, ambiguo o inválido')
    return values[0]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Refused('Redirección rechazada')


def bot_request(token, method, payload):
    # No offset: getUpdates must never acknowledge an update. Do not log errors.
    request = urllib.request.Request(
        'https://api.telegram.org/bot' + token + '/' + method,
        data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(request, timeout=10) as response:
        body = response.read(2_000_001)
    if len(body) > 2_000_000:
        raise Refused('Respuesta demasiado grande')
    result = json.loads(body)
    if not isinstance(result, dict) or result.get('ok') is not True or 'result' not in result:
        raise Refused('Respuesta inválida')
    return result['result']


def discover(token):
    bot = bot_request(token, 'getMe', {})
    if (not isinstance(bot, dict) or bot.get('is_bot') is not True
            or str(bot.get('username', '')).lower() != 'mussicart_bot'
            or type(bot.get('id')) is not int or bot['id'] <= 0):
        raise Refused('Bot incorrecto')
    webhook = bot_request(token, 'getWebhookInfo', {})
    if not isinstance(webhook, dict) or webhook.get('url') != '':
        raise Refused('Webhook activo o desconocido')
    updates = bot_request(token, 'getUpdates', {'limit': 100, 'timeout': 0})
    if not isinstance(updates, list) or len(updates) >= 100:
        raise Refused('Actualizaciones incompletas')
    candidates = set()
    for update in updates:
        if not isinstance(update, dict):
            raise Refused('Actualización inválida')
        message = update.get('message')
        if not isinstance(message, dict):
            continue
        sender, chat = message.get('from'), message.get('chat')
        if not isinstance(sender, dict) or not isinstance(chat, dict):
            continue
        text = message.get('text')
        if (sender.get('is_bot') is False and type(sender.get('id')) is int
                and sender['id'] > 0 and isinstance(sender.get('username'), str)
                and sender['username'].lower() == 'jhoelti'
                and chat.get('type') == 'private' and type(chat.get('id')) is int
                and chat['id'] == sender['id'] and isinstance(text, str)
                and re.fullmatch(r'/start(?:@Mussicart_bot)?(?:\s+[^\s]+)?', text, re.IGNORECASE)):
            candidates.add(sender['id'])
    if len(candidates) != 1:
        raise Refused('Identidad ausente o ambigua')
    return candidates.pop(), bot['id']
