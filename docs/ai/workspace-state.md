# Workspace state

- TASK activa: `docs/tasks/TASK-0001.md` (IN PROGRESS).
- **Versión inicial validada por el usuario:** `v1.0.0-inicial` (2026-11-08). Documentación en `docs/releases/v1.0.0-inicial.md`.
- Funciona: búsqueda YouTube 10/50, importación automática desde Telegram, conversión M4A→MP3, autoplay al publicar, Bóveda, playlists, borrado confirmado, AutoDJ con descarga anticipada y sugerencias.
- Despliegue Linux preparado en `deploy/linux/` (guía, compose, Caddy, systemd, backups, preflight, env de ejemplo). El puente soporta Linux con sesión 0600, `flock`, URL configurable y credenciales por entorno.
- Pendiente: hacer commit/etiqueta, ejecutar el despliegue Linux real, crear la sesión de Telegram en Linux, validar Caddy/systemd y probar en móvil/intercom. El piloto Windows sigue siendo la referencia.
