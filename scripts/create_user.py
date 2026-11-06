"""Crear una cuenta localmente sin habilitar registro público."""
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import server
from fastapi import HTTPException


def main():
    username = input('Usuario: ').strip()
    display_name = input('Nombre para mostrar (opcional): ').strip()
    password = getpass.getpass('Contraseña (mínimo 12 caracteres): ')
    if len(password.strip()) < 12:
        print('La contraseña debe tener al menos 12 caracteres.', file=sys.stderr)
        return 1
    if password != getpass.getpass('Repetir contraseña: '):
        print('Las contraseñas no coinciden.', file=sys.stderr)
        return 1
    try:
        result = server.register(server.RegisterRequest(username=username, password=password, display_name=display_name or None))
        server.logout('Bearer ' + result['token'])
    except HTTPException as error:
        print(f'No se pudo crear la cuenta: {error.detail}', file=sys.stderr)
        return 1
    print(f"Cuenta creada: {result['user']['username']}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
