#!/usr/bin/env bash
# Comprobaciones previas al despliegue. No imprime secretos.
set -euo pipefail

ROOT="${DIAZ_ROOT:-/opt/diaz-music}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ENV="$HERE/app.env"
BRIDGE_ENV="$HERE/bridge.env"
fail=0

ok() { echo "OK   $*"; }
bad() { echo "FALLA $*"; fail=1; }

command -v docker >/dev/null && ok "docker" || bad "docker no encontrado"
docker compose version >/dev/null 2>&1 && ok "docker compose" || bad "docker compose no disponible"
command -v python3 >/dev/null && ok "python3" || bad "python3 no encontrado"
command -v caddy >/dev/null && ok "caddy" || bad "caddy no encontrado (o usa nginx)"
command -v tar >/dev/null && ok "tar" || bad "tar no encontrado"

for path in "$ROOT/data" "$ROOT/music/telegram-ready" "$ROOT/music/telegram-imports"; do
  [[ -d "$path" ]] && ok "directorio $path" || bad "falta $path"
done

for file in "$APP_ENV" "$BRIDGE_ENV"; do
  if [[ -f "$file" ]]; then
    mode="$(stat -c '%a' "$file" 2>/dev/null || echo '?')"
    [[ "$mode" == "600" ]] && ok "permisos 600 en $file" || bad "$file debe tener permisos 600 (actual: $mode)"
  else
    bad "falta $file"
  fi
done

if [[ -f "$APP_ENV" && -f "$BRIDGE_ENV" ]]; then
  app_key="$(grep -E '^MUSIC_TELEGRAM_BRIDGE_KEY=' "$APP_ENV" | tail -n1 | cut -d= -f2- || true)"
  bridge_key="$(grep -E '^MUSIC_TELEGRAM_BRIDGE_KEY=' "$BRIDGE_ENV" | tail -n1 | cut -d= -f2- || true)"
  if [[ ${#app_key} -ge 43 && ${#app_key} -le 128 && "$app_key" == "$bridge_key" ]]; then
    ok "clave de puente presente y coincidente"
  else
    bad "la clave del puente falta, es corta o no coincide"
  fi
fi

for name in TELEGRAM_API_ID TELEGRAM_API_HASH TELEGRAM_BOT_TOKEN; do
  if [[ -f "$BRIDGE_ENV" ]] && grep -qE "^${name}=.+" "$BRIDGE_ENV"; then
    ok "$name presente"
  else
    bad "$name ausente en bridge.env"
  fi
done

if docker image inspect diaz-audio-probe >/dev/null 2>&1; then
  ok "imagen diaz-audio-probe"
else
  bad "falta la imagen diaz-audio-probe"
fi

if ss -ltn 2>/dev/null | grep -qE '127\.0\.0\.1:8589|\[::1\]:8589'; then
  ok "puerto 8589 ligado a loopback"
else
  echo "INFO 8589 aún no escucha (normal antes del primer arranque)"
fi

if docker info >/dev/null 2>&1; then
  ok "acceso al daemon Docker"
else
  bad "sin acceso al daemon Docker (grupo docker o sudo)"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "Preflight correcto."
else
  echo "Corrige los puntos marcados como FALLA."
  exit 1
fi
