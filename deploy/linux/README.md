# Despliegue de Diaz Music en un servidor Linux

Esta guía deja la aplicación web/API y el puente de Telegram funcionando en un servidor Linux con HTTPS.

> **Versión de referencia:** `v1.0.0-inicial` (2026-11-08), validada por el usuario en el piloto. Ver `docs/releases/v1.0.0-inicial.md`.

> **Importante:** el puente de Telegram debe ejecutarse en el **mismo servidor y sistema de archivos** que la app. El puente publica los MP3 en `music/telegram-ready` y el contenedor los lee desde ahí. Un puente en otro PC no puede publicar archivos en el servidor sin un mecanismo de subida que este proyecto no incluye.

---

## 1. Arquitectura

```text
Navegador
   │ HTTPS
   ▼
Caddy (80/443) ──► Diaz Music (contenedor, 127.0.0.1:8589)
                         │
                         ├── SQLite: data/diaz_music_users.db
                         ├── Biblioteca: data/music
                         └── Importaciones: music/telegram-ready (solo lectura)

Puente Telegram (proceso host, usuario diaz)
   ├── Telethon + sesión dedicada
   ├── Descarga a music/telegram-imports
   ├── Valida/transcribe con Docker: diaz-audio-probe
   └── Publica en music/telegram-ready
```

- La app corre en Docker.
- El puente corre como servicio systemd en el host porque necesita Docker para validar audio y escribe en el sistema de archivos compartido.
- Caddy termina HTTPS y mantiene el puerto 8589 en loopback.
- La app y el puente comparten el mismo directorio `music/`.

---

## 2. Requisitos

- Ubuntu 22.04/24.04 LTS (o Debian 12) con acceso root/sudo.
- Docker Engine + plugin `docker compose`.
- Python 3.10+ (recomendado 3.11/3.12) y `python3-venv`.
- Un dominio o subdominio, por ejemplo `music.example.com`, apuntando al servidor.
- Puertos 80 y 443 abiertos. **No abrir 8589**.
- Cuenta dedicada de Telegram con acceso al grupo/bot de importación.
- Credenciales `Api_id`, `Api_hash` y token del bot.
- El repositorio copiado en `/opt/diaz-music`.

> Las constantes de cuenta, bot y grupo están fijadas al piloto actual en `telegram_third_party_search.py` y `telegram_manual_download.py`. Si vas a usar otra cuenta u otro grupo, actualízalas antes de desplegar y valida que el bot sea el correcto.

> La sesión DPAPI de Windows **no se puede descifrar en Linux**. En Linux hay que crear una sesión nueva iniciando sesión con la cuenta dedicada.

---

## 3. Directorios y usuario

```bash
sudo adduser --system --group --home /opt/diaz-music --shell /bin/bash diaz
sudo usermod -aG docker diaz
sudo systemctl restart docker
```

Cierra y vuelve a abrir la sesión SSH (o `newgrp docker`) para que el grupo aplique.

Copia el proyecto:

```bash
sudo mkdir -p /opt/diaz-music
sudo rsync -a --chown=diaz:diaz ./ /opt/diaz-music/
sudo chmod +x /opt/diaz-music/deploy/linux/backup.sh /opt/diaz-music/deploy/linux/preflight.sh
```

Si vienes desde Windows, la opción más limpia es hacer commit/push del código a un repositorio privado y clonarlo en el servidor. Si copias el árbol directamente, excluye `node_modules`, `dist`, `.git`, `__pycache__`, `music`, `data` y los archivos `.env`; luego copia `music/` y `data/` por separado con `rsync`/`scp`.

Crea directorios y permisos:

```bash
sudo install -d -o 10001 -g 10001 -m 0750 /opt/diaz-music/data
sudo install -d -o 10001 -g 10001 -m 0755 /opt/diaz-music/data/music
sudo install -d -o diaz -g diaz -m 0755 /opt/diaz-music/music/telegram-ready
sudo install -d -o diaz -g diaz -m 0755 /opt/diaz-music/music/telegram-imports
sudo install -d -o diaz -g diaz -m 0700 /var/lib/diaz-music
```

El contenedor corre con UID 10001. Por eso `data/` pertenece a 10001. Los archivos que publica el puente deben ser legibles por 10001; el servicio usa `UMask=0022` para crear MP3/JSON/JPG en 0644.

---

## 4. Migrar datos desde Windows

Detén el piloto antes de copiar.

### Base de datos

En Windows, compara las dos bases y usa la más reciente que contenga tus usuarios:

```powershell
Get-Item .\diaz_music_users.db, "$env:LOCALAPPDATA\DiazMusic\pilot\data\diaz_music_users.db" |
  Select-Object FullName, Length, LastWriteTime
```

Copia la elegida al servidor:

```bash
scp diaz_music_users.db usuario@servidor:/tmp/diaz_music_users.db
sudo install -o 10001 -g 10001 -m 0600 /tmp/diaz_music_users.db /opt/diaz-music/data/diaz_music_users.db
rm /tmp/diaz_music_users.db
```

Si empiezas con una base vacía, más abajo se explica cómo habilitar el registro temporalmente.

### Importaciones ya publicadas

```bash
rsync -a music/telegram-ready/ usuario@servidor:/tmp/telegram-ready/
sudo rsync -a --chown=diaz:diaz /tmp/telegram-ready/ /opt/diaz-music/music/telegram-ready/
sudo chmod -R a+rX /opt/diaz-music/music/telegram-ready
rm -rf /tmp/telegram-ready
```

Copia también los `.json` y `.jpg` sidecars. Sin ellos la app no muestra título/carátula.

### Cuarentena (opcional)

`music/telegram-imports` contiene archivos que no se publicaron. No es necesario para la app. Cópialo solo si quieres revisarlos o reintentarlos manualmente.

---

## 5. Variables de entorno

```bash
cd /opt/diaz-music/deploy/linux
sudo -u diaz cp app.env.example app.env
sudo -u diaz cp bridge.env.example bridge.env
sudo -u diaz chmod 600 app.env bridge.env
```

Genera una clave de puente:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Pega **la misma clave** en:

- `app.env` → `MUSIC_TELEGRAM_BRIDGE_KEY`
- `bridge.env` → `MUSIC_TELEGRAM_BRIDGE_KEY`

Edita `app.env`:

- `MUSIC_TELEGRAM_OPERATOR`: usuario de Diaz Music que será operador (ej. `jhoel`).
- `CORS_ORIGINS`: tu dominio real.
- `MUSIC_PUBLIC_ORIGIN`: tu dominio real con `https://` (debe coincidir con el navegador).
- `MUSIC_ALLOW_REGISTRATION=false` (cámbialo a `true` solo para el primer registro; luego vuelve a `false`).

Edita `bridge.env`:

- `MUSIC_BRIDGE_API_URL=http://127.0.0.1:8589/api` si el puente está en el mismo servidor.
- `MUSIC_TELEGRAM_BRIDGE_KEY`: la misma clave.
- `MUSIC_TELEGRAM_SESSION=/var/lib/diaz-music/telegram-session`.
- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_BOT_TOKEN`.
- `TELEGRAM_PHONE` solo para crear la sesión.

No subas estos archivos a git ni los compartas.

---

## 6. Construir imágenes

```bash
cd /opt/diaz-music
sudo -u diaz docker build -t diaz-audio-probe -f isolated/Dockerfile.audio-probe isolated
cd /opt/diaz-music/deploy/linux
sudo -u diaz docker compose build
```

`diaz-audio-probe` es la imagen aislada que valida y convierte audio a MP3. Sin ella, las descargas quedarán en cuarentena.

---

## 7. Arrancar la app

```bash
cd /opt/diaz-music/deploy/linux
sudo -u diaz docker compose up -d
sudo -u diaz docker compose ps
curl -fsS http://127.0.0.1:8589/api/health
```

Debe escuchar solo en loopback:

```bash
ss -ltnp | grep 8589
# 127.0.0.1:8589
```

### Primer usuario (si no migraste base)

1. Pon `MUSIC_ALLOW_REGISTRATION=true` en `app.env`.
2. `sudo -u diaz docker compose up -d --force-recreate`.
3. Abre la app y registra el usuario operador (mismo nombre que `MUSIC_TELEGRAM_OPERATOR`).
4. Vuelve a `MUSIC_ALLOW_REGISTRATION=false`.
5. `sudo -u diaz docker compose up -d --force-recreate`.

---

## 8. Caddy y HTTPS

Instala Caddy (Ubuntu/Debian):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Copia y ajusta el dominio:

```bash
sudo cp /opt/diaz-music/deploy/linux/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # reemplaza music.example.com
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

El `Caddyfile` fuerza `Host: 127.0.0.1:8589` hacia la app. Es necesario porque el servidor solo permite la búsqueda de YouTube desde Host local/docker.

Comprueba:

```bash
curl -I https://music.example.com
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8589/tcp
sudo ufw enable
```

No abras 8589 a Internet.

---

## 9. Preparar el puente de Telegram en Linux

### 9.1 Dependencias

```bash
cd /opt/diaz-music
sudo -u diaz python3 -m venv .venv
sudo -u diaz .venv/bin/pip install --upgrade pip
sudo -u diaz .venv/bin/pip install -r requirements.txt -r requirements-telegram-poc.txt
```

### 9.2 Crear la sesión

La sesión se guarda en `/var/lib/diaz-music/telegram-session` con permisos 0600 (directorio 0700). En Linux no está cifrada: es equivalente a la cuenta, protégela.

```bash
sudo -iu diaz
cd /opt/diaz-music
set -a
source deploy/linux/bridge.env
set +a
.venv/bin/python telegram_setup_windows.py
```

Introduce el código de Telegram y, si aplica, la contraseña 2FA. Verifica:

```bash
stat -c '%a %U:%G' /var/lib/diaz-music/telegram-session
# 600 diaz diaz
exit
```

### 9.3 Servicios systemd

```bash
sudo cp /opt/diaz-music/deploy/linux/diaz-music.service /etc/systemd/system/
sudo cp /opt/diaz-music/deploy/linux/diaz-telegram-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now diaz-music.service
sudo systemctl enable --now diaz-telegram-bridge.service
```

Logs:

```bash
sudo journalctl -u diaz-music -f
sudo journalctl -u diaz-telegram-bridge -f
```

El puente necesita acceso al socket de Docker para validar audio. El servicio lo obtiene con `SupplementaryGroups=docker`. El grupo `docker` equivale a root; limita quién pertenece a él.

---

## 10. Verificación funcional

1. Abre `https://music.example.com` e inicia sesión como operador.
2. La ficha de Telegram debe indicar **Puente disponible**.
3. Busca «Romeo Santos»:
   - Selector 10/50.
   - Con 50, páginas de 10 y botón **Siguiente**.
4. Pulsa una canción:
   - Aparece la tarjeta transitoria.
   - Se autoselecciona una opción MP3 320k si hay certeza.
   - Se descarga, valida/publica y **se reproduce automáticamente**.
5. Abre **Bóveda Offline**:
   - La importación aparece sin pulsar «Ver importaciones».
   - Reproduce, añade a playlist y prueba el borrado con una copia desechable.
6. Reproduce una canción importada y espera:
   - AutoDJ prepara la siguiente en segundo plano.
   - Al terminar, entra sola.
7. Prueba una opción M4A (por ejemplo BLESSD):
   - Debe convertirse a MP3 320k y publicarse, no quedarse en cuarentena.

---

## 11. Seguridad

- **No exponer 8589**. Solo Caddy debe llegar a `127.0.0.1:8589`.
- Usa una **cuenta dedicada de Telegram**, no tu cuenta personal.
- La sesión de Telegram en Linux es un archivo sensible: `0600`, dueño `diaz`, directorio `0700`. No la incluyas en backups sin cifrar.
- La clave del puente es un secreto. Para rotarla:
  1. Genera una nueva.
  2. Actualiza `app.env` y `bridge.env`.
  3. `sudo -u diaz docker compose up -d` y `sudo systemctl restart diaz-telegram-bridge`.
- Mantén `MUSIC_ALLOW_REGISTRATION=false` después de crear el operador.
- No compartas códigos de Telegram, tokens ni capturas con secretos.
- El puente puede pulsar botones, descargar, publicar y borrar solo si sus gates están en `1`. No los actives en un entorno no confiable.
- El grupo `docker` es privilegiado. Restringe el acceso SSH y usa claves.
- Si haces backups fuera del servidor, cífralos.

---

## 12. Respaldos

```bash
sudo install -d -o root -g root -m 0700 /var/backups/diaz-music
sudo /opt/diaz-music/deploy/linux/backup.sh /var/backups/diaz-music
```

Programa diario:

```bash
sudo crontab -e
# 30 3 * * * /opt/diaz-music/deploy/linux/backup.sh /var/backups/diaz-music
```

El script usa la API de backup de SQLite (sin detener la app) y guarda `music/telegram-ready`. Conserva 30 días.

Restauración:

```bash
sudo systemctl stop diaz-music.service
sudo cp /var/backups/diaz-music/db-AAAA.sqlite /opt/diaz-music/data/diaz_music_users.db
sudo chown 10001:10001 /opt/diaz-music/data/diaz_music_users.db
sudo chmod 600 /opt/diaz-music/data/diaz_music_users.db
sudo systemctl start diaz-music.service
```

Para las importaciones, extrae el tar en `/opt/diaz-music` y ajusta permisos:

```bash
sudo tar -xzf /var/backups/diaz-music/telegram-ready-AAAA.tar.gz -C /opt/diaz-music
sudo chown -R diaz:diaz /opt/diaz-music/music/telegram-ready
sudo chmod -R a+rX /opt/diaz-music/music/telegram-ready
```

---

## 13. Actualizaciones

```bash
cd /opt/diaz-music
sudo docker tag diaz-music:latest diaz-music:previous 2>/dev/null || true
git pull    # o rsync del nuevo código
cd deploy/linux
sudo -u diaz docker compose build
sudo systemctl restart diaz-music.service
sudo systemctl restart diaz-telegram-bridge.service
```

Recarga el navegador con `Ctrl+Shift+R`. El service worker v6 usa red primero, pero si ves interfaz vieja desregistra el service worker una vez.

Rollback:

```bash
sudo docker tag diaz-music:previous diaz-music:latest
cd /opt/diaz-music/deploy/linux
sudo -u diaz docker compose up -d --no-build
sudo systemctl restart diaz-telegram-bridge.service
```

Restaura la base desde el backup si el cambio afectó datos.

---

## 14. Diagnóstico

### La búsqueda devuelve 403 detrás de Caddy

El `Host` que llega a la app debe ser local. Comprueba que el `Caddyfile` tiene:

```caddy
reverse_proxy 127.0.0.1:8589 {
    header_up Host 127.0.0.1:8589
}
```

### El puente no aparece como listo

```bash
sudo systemctl status diaz-telegram-bridge
sudo journalctl -u diaz-telegram-bridge -n 100 --no-pager
```

Comprueba:

- `MUSIC_TELEGRAM_BRIDGE_KEY` coincide en ambos archivos.
- `MUSIC_BRIDGE_API_URL` es correcto.
- La sesión existe y es legible por `diaz`.
- Los gates están en `1`.
- El contenedor responde en `/api/health`.

### Error de Docker al validar audio

```bash
sudo -u diaz docker info
sudo -u diaz docker image inspect diaz-audio-probe
```

Si falla, añade `diaz` al grupo docker y reinicia la sesión/servicio.

### Un archivo queda en cuarentena

- Revisa `music/telegram-imports` y los logs del puente.
- Formatos soportados: MP3, M4A/MP4, OGG, FLAC, WAV. El validador convierte a MP3 320k.
- Si no es audio o el contenedor no está disponible, no se publica.

### La importación no aparece en la app

- El puente y la app deben compartir `/opt/diaz-music/music/telegram-ready`.
- Los archivos deben ser legibles por UID 10001 (`0644`).
- El mount del compose debe apuntar a `../../music/telegram-ready`.

### La canción no se reproduce sola

- Algunos navegadores bloquean autoplay tras una descarga larga. La canción queda en Bóveda; pulsa reproducir.
- No se reproduce mientras se descarga porque el archivo aún no está validado.

### Búsqueda de YouTube lenta o sin resultados

- `yt-dlp` consulta YouTube desde el contenedor; una IP bloqueada puede fallar.
- El respaldo directo solo obtiene metadatos y no descarga audio.
- Revisa `docker compose logs -f music`.

### La PWA muestra una versión vieja

- `Ctrl+Shift+R`.
- DevTools → Application → Service Workers → Unregister.
- El service worker v6 usa red primero para navegación.

---

## 15. Checklist final

- [ ] DNS de `music.example.com` apunta al servidor.
- [ ] Caddy responde por HTTPS.
- [ ] 8589 escucha solo en 127.0.0.1.
- [ ] Base de datos migrada o usuario registrado.
- [ ] `MUSIC_ALLOW_REGISTRATION=false` tras el registro.
- [ ] Importaciones copiadas con `.json`/`.jpg`.
- [ ] `diaz-audio-probe` construida.
- [ ] Contenedor `diaz-music` healthy.
- [ ] Puente systemd activo y sesión 0600.
- [ ] La ficha Telegram muestra «Puente disponible».
- [ ] Búsqueda 10/50 y paginación.
- [ ] Importación + autoplay.
- [ ] Bóveda, playlist y borrado.
- [ ] AutoDJ prepara la siguiente.
- [ ] Backup programado.
- [ ] Firewall cerrado salvo 22/80/443.
