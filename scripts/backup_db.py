"""Copia consistente de SQLite sin sobrescribir archivos existentes."""
import sqlite3
import sys
from contextlib import closing
from pathlib import Path


def main():
    if len(sys.argv) != 3:
        print('Uso: python scripts/backup_db.py ORIGEN DESTINO', file=sys.stderr)
        return 2
    source, target = (Path(arg).resolve() for arg in sys.argv[1:])
    if not source.is_file() or target.exists() or not target.parent.is_dir():
        print('El origen debe existir, el destino no debe existir y su carpeta debe estar creada.', file=sys.stderr)
        return 1
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src:
        with closing(sqlite3.connect(str(target))) as dst:
            src.backup(dst)
    print(f'Copia creada en {target}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
