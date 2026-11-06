# Migración de Diaz Music: Tailscale Serve y Funnel

Esta guía prepara una instalación con Docker en el servidor. **No ejecuta ni activa Tailscale automáticamente.** Funnel es público: cualquier persona con acceso a Internet puede entrar, aunque no tenga Tailscale. Para uso personal, prueba primero con Serve, que limita el acceso a tu tailnet y sus reglas de acceso.

## Arquitectura

```text
Celular → HTTPS Tailscale Serve/Funnel → 127.0.0.1:8589
                                      → aplicación compilada y /api
                                      → SQLite en volumen Docker
```

Tailscale gestiona HTTPS para su nombre `*.ts.net`. El contenedor escucha en el puerto 8589, pero Compose lo publica **solo en `127.0.0.1` del servidor**. No abras directamente 8589 ni uses Vite de desarrollo para la publicación. La interfaz y la API comparten origen; no se requiere un proxy adicional para `/api`.

## Seguridad y límites antes de hacerla pública

- La página, la búsqueda y los streams no exigen inicio de sesión. Con Funnel, cualquier visitante puede usarlos y consumir ancho de banda y recursos. El registro público y la biblioteca local del servidor están **desactivados por defecto**; los datos privados de usuario requieren sesión.
- Se aplican límites **globales por proceso** a inicios de sesión, búsquedas y operaciones costosas, un límite de seis operaciones de búsqueda/stream simultáneas y un límite de 2 MiB en cuerpos de API. No se confía en cabeceras de IP: los límites no son por visitante, se reinician con el proceso y un tercero puede agotarlos para todos. Usar exactamente un worker. No sustituyen WAF, límites por usuario, supervisión ni una auditoría de seguridad.
- Las cuentas existentes pueden tener contraseñas antiguas débiles. Revisa y cambia credenciales comprometidas o débiles antes de publicar. El acceso offline local del navegador no protege los datos frente a una persona con acceso al dispositivo.
- Funnel tiene límites de ancho de banda, usa nombres `*.ts.net` y solo admite los puertos HTTPS públicos 443, 8443 y 10000. **8589 es el puerto local**, no el puerto público de Funnel. El proveedor de música también puede rechazar solicitudes o cambiar sus condiciones; revisa las licencias antes de ofrecer el servicio públicamente.
- Conserva las descargas, copias de seguridad y el volumen fuera de los directorios públicos. No actives `MUSIC_ENABLE_LOCAL_LIBRARY` en Funnel: esas rutas actualmente no requieren autenticación.

## 1. Requisitos

- Docker Engine con Docker Compose, o Docker Desktop con contenedores Linux.
- Tailscale instalado y conectado en el servidor, con MagicDNS y HTTPS habilitados en el tailnet. Para Funnel se necesita además la autorización de Funnel en la política de Tailscale.
- Una dirección de servidor definitiva: el almacenamiento offline del navegador depende del origen. Cambiar de IP, nombre o esquema HTTP/HTTPS crea otro almacenamiento; las descargas no se migran automáticamente.

Los comandos son ejemplos para ejecutarse **en el servidor**. No se han ejecutado desde este proyecto. Según el sistema y permisos podrían requerir `sudo`. Antes de usar Serve o Funnel, comprueba `tailscale serve status` y `tailscale funnel status`: configurar el mismo puerto HTTPS puede sustituir una configuración existente.

## 2. Migrar datos existentes, solo si los necesitas

Haz una copia consistente de la base original, sin copiarla mientras se está escribiendo con un simple arrastrar y soltar:

```bash
python scripts/backup_db.py diaz_music_users.db migracion.db
```

El destino no debe existir. Guarda esa copia fuera de la carpeta pública y transfiérela de manera segura al servidor. Incluye usuarios, playlists, gustos y sesiones de la base; las canciones descargadas en el celular y los datos que solo existen como invitado en el navegador **no** están en esa base. Una sesión puede seguir válida hasta su expiración: trata la copia como sensible.

**Antes de arrancar por primera vez** el servicio nuevo, y solo con un volumen nuevo sin base existente, puedes importar una copia en Linux desde la carpeta del proyecto:

```bash
docker compose build
docker compose run --rm --no-deps -v "$PWD/migracion.db:/migration.db:ro" --entrypoint python music scripts/backup_db.py /migration.db /data/diaz_music_users.db
```

El usuario del contenedor (UID 10001) debe poder leer la copia montada. El script se niega a sobrescribir el destino si ya existe. No borres el volumen ni sobrescribas una base existente para importar; si ya hay datos en el servidor, prepara primero una copia y un plan de restauración. En Windows o con otro sistema, adapta el montaje y confirma los permisos antes de ejecutar la importación.

## 3. Construir e iniciar

```bash
docker compose up -d --build
docker compose ps
```

En el propio servidor, abre `http://127.0.0.1:8589/` y comprueba `http://127.0.0.1:8589/api/health`. Desde PowerShell se puede usar `Invoke-RestMethod http://127.0.0.1:8589/api/health`. La base y la carpeta de datos viven en el volumen `music_data`, no en la imagen; reconstruir no debería borrarlos. No ejecutes comandos que eliminen volúmenes si quieres conservarlos.

Para una instalación nueva, crea una cuenta desde la consola del servidor:

```bash
docker compose exec music python scripts/create_user.py
```

El script pide una contraseña de al menos 12 caracteres sin mostrarla. El registro a través de la web queda desactivado. Para revisar fallos usa `docker compose logs music`; el registro de acceso HTTP está desactivado para no registrar búsquedas en cada petición.

## 4. Probar en privado con Tailscale Serve

Con el servicio en marcha, revisa primero la configuración actual de Serve/Funnel y, si el puerto 443 está libre para este proyecto, ejecuta:

```bash
tailscale serve --bg --https=443 8589
tailscale serve status
```

Abre en el celular la dirección HTTPS `*.ts.net` indicada por Tailscale y comprueba inicio de sesión, búsqueda, reproducción, playlists, sincronización y descargas. Instala la PWA desde el navegador, descarga una pista autorizada y prueba modo avión. Las listas y los archivos offline guardados en el origen anterior no se transfieren automáticamente.

Para apagar **esa configuración de Serve** cuando ya no se necesite:

```bash
tailscale serve --https=443 off
```

## 5. Funnel público: solo tras revisar los riesgos

Funnel no autentica a los visitantes con tu tailnet. Si decides publicar, vuelve a comprobar las configuraciones existentes y, cuando el puerto HTTPS esté libre para este proyecto, activa explícitamente:

```bash
tailscale funnel --bg --https=443 8589
tailscale funnel status
```

La salida mostrará la URL pública HTTPS. Antes de compartirla, prueba desde fuera del tailnet, verifica que `/api/auth/register` y `/api/tracks` respondan 403 y confirma que los datos de una cuenta no son accesibles sin su sesión. El modo `--bg` persiste al reiniciar Tailscale o el equipo.

Para retirar esta publicación:

```bash
tailscale funnel --https=443 off
tailscale funnel status
```

No uses `reset` si hay otros servicios de Tailscale configurados que quieras conservar. La última configuración de Serve/Funnel para un mismo puerto determina si queda privado o público.

## 6. Copias de seguridad posteriores

Con el servicio en marcha, crea la carpeta y un nombre de copia nuevo:

```bash
docker compose exec music mkdir -p /data/backups
docker compose exec music python scripts/backup_db.py /data/diaz_music_users.db /data/backups/backup-2026-11-05.db
docker compose cp music:/data/backups/backup-2026-11-05.db ./backup-2026-11-05.db
```

Cambia el nombre en cada copia. Guarda otra copia cifrada fuera del servidor y prueba una restauración en una instalación separada. La copia dentro del mismo volumen no protege contra la pérdida del disco. No incluye descargas offline del navegador.

Referencias oficiales: [Tailscale Funnel](https://tailscale.com/kb/1223/funnel), [CLI de Funnel](https://tailscale.com/docs/reference/tailscale-cli/funnel) y [CLI de Serve](https://tailscale.com/docs/reference/tailscale-cli/serve).
