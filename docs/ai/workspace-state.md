# Workspace state

- TASK activa para esta sesión: `docs/tasks/TASK-0002.md` (IN PROGRESS; decks A/B persistentes con precarga y liberación, audio directo en móvil sin Web Audio, persistencia de cola/pista/posición cada 2 s, keep-alive silencioso 15 min, recuperación de URL/Blob al reanudar, MediaSession/WakeLock, protección de ObjectURL, salto de archivos dañados y service worker v13; build y 57 pruebas JS en verde). `docs/tasks/TASK-0001.md` permanece IN PROGRESS con trabajo previo independiente.
- **Versión inicial validada por el usuario:** `v1.0.0-inicial` (2026-11-08). Documentación en `docs/releases/v1.0.0-inicial.md`.
- Funciona: búsqueda YouTube 10/50, importación automática desde Telegram, conversión M4A→MP3, autoplay al publicar, Bóveda, playlists, borrado confirmado, AutoDJ con descarga anticipada y sugerencias.
- Despliegue Linux preparado en `deploy/linux/` (guía, compose, Caddy, systemd, backups, preflight, env de ejemplo). El puente soporta Linux con sesión 0600, `flock`, URL configurable y credenciales por entorno.
- Telegram: corregida la cola de `getUpdates` que se llenaba y bloqueaba la importación, la huella de mensaje que fallaba por contadores volátiles y el cierre del puente ante un fallo aislado. Pendiente reiniciar el puente y probar una importación real tras el cambio.
- Pendiente: hacer commit/etiqueta, ejecutar el despliegue Linux real, crear la sesión de Telegram en Linux y validar Caddy/systemd. La prueba física de continuidad y pausa móvil/intercom sigue pendiente en TASK-0002; el piloto Windows sigue siendo la referencia.
