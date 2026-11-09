# Workspace state

- TASK activa: `docs/tasks/TASK-0001.md` (IN PROGRESS).
- Despliegue Linux preparado en `deploy/linux/` (guía, compose, Caddy, systemd, backups, preflight, env de ejemplo). El puente ya soporta Linux con sesión 0600, `flock`, URL configurable y credenciales por entorno. La app mantiene búsqueda 10/50, autoplay, AutoDJ, Bóveda y conversión M4A→MP3. Falta ejecutar el despliegue en el servidor real y validar Telegram/Telethon, Caddy y systemd; el piloto Windows sigue siendo la referencia.
