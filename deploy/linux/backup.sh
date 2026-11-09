#!/usr/bin/env bash
# Respaldo en línea de la base SQLite y de las importaciones publicadas.
# Uso: backup.sh [DIRECTORIO_DESTINO]
set -euo pipefail

ROOT="${DIAZ_ROOT:-/opt/diaz-music}"
DEST="${1:-/var/backups/diaz-music}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB="$ROOT/data/diaz_music_users.db"
READY="$ROOT/music/telegram-ready"

mkdir -p "$DEST"
chmod 700 "$DEST"

if [[ -f "$DB" ]]; then
  python3 - "$DB" "$DEST/db-$STAMP.sqlite" <<'PY'
import sqlite3
import sys

source_path, target_path = sys.argv[1], sys.argv[2]
source = sqlite3.connect(source_path)
target = sqlite3.connect(target_path)
try:
    source.backup(target)
finally:
    target.close()
    source.close()
PY
  chmod 600 "$DEST/db-$STAMP.sqlite"
fi

if [[ -d "$READY" ]]; then
  tar -C "$ROOT" -czf "$DEST/telegram-ready-$STAMP.tar.gz" music/telegram-ready
  chmod 600 "$DEST/telegram-ready-$STAMP.tar.gz"
fi

if [[ -d "$ROOT/data/music" ]]; then
  tar -C "$ROOT" -czf "$DEST/local-music-$STAMP.tar.gz" data/music
  chmod 600 "$DEST/local-music-$STAMP.tar.gz"
fi

# Conservar 30 días por defecto.
find "$DEST" -maxdepth 1 -type f -mtime +30 -delete

echo "Respaldo completado en $DEST"
