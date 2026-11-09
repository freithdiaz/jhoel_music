# Workspace state

- TASK activa para esta sesión: `docs/tasks/TASK-0002.md` (IN PROGRESS; implementados dos decks A/B con precarga, intercambio y cebado silencioso en segundo plano; build y 55 pruebas JS en verde; prueba física Android/Bluetooth pendiente). `docs/tasks/TASK-0001.md` permanece IN PROGRESS con trabajo previo independiente.
- **Versión inicial validada por el usuario:** `v1.0.0-inicial` (2026-11-08). Documentación en `docs/releases/v1.0.0-inicial.md`.
- Funciona: búsqueda YouTube 10/50, importación automática desde Telegram, conversión M4A→MP3, autoplay al publicar, Bóveda, playlists, borrado confirmado, AutoDJ con descarga anticipada y sugerencias.
- Despliegue Linux preparado en `deploy/linux/` (guía, compose, Caddy, systemd, backups, preflight, env de ejemplo). El puente soporta Linux con sesión 0600, `flock`, URL configurable y credenciales por entorno.
- Pendiente: hacer commit/etiqueta, ejecutar el despliegue Linux real, crear la sesión de Telegram en Linux y validar Caddy/systemd. La prueba física de continuidad y pausa móvil/intercom sigue pendiente en TASK-0002; el piloto Windows sigue siendo la referencia.
