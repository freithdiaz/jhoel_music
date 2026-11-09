"""Política de acceso preparatoria para una futura integración de Telegram.

No consulta Telegram ni registra rutas. El llamador debe autenticar la sesión
mediante el mecanismo del servidor antes de invocar esta política.
"""

import hmac
import re


def operator_allowed(*, enabled, configured_operator, authenticated_user):
    """Solo permite un operador explícito y autenticado; cerrado por defecto."""
    if enabled is not True:
        return False
    if not isinstance(configured_operator, str) or not isinstance(authenticated_user, str):
        return False
    # Los nombres de usuario del servidor se normalizan a minúsculas.
    if (not re.fullmatch(r'[a-z0-9_.-]{3,64}', configured_operator)
            or not re.fullmatch(r'[a-z0-9_.-]{3,64}', authenticated_user)):
        return False
    return hmac.compare_digest(configured_operator, authenticated_user)
