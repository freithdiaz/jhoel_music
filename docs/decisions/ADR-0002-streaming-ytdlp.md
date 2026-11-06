# ADR-0002: Evaluación de streaming mediante yt-dlp

Estado: propuesta en implementación y pendiente de revisión de seguridad

## Contexto
El usuario solicitó restaurar el mecanismo previo de búsqueda y streaming porque el reproductor oficial devolvió error 150. Esta propuesta cambia el límite del ADR-0001, que reservaba YouTube al reproductor oficial.

## Decisión propuesta
Restaurar búsqueda y streaming heredados sin API key; retirar de la interfaz el reproductor oficial de YouTube y las pruebas puntuales de Spotify y SoundCloud según la instrucción posterior del usuario. Validar identificadores, destinos y redirecciones; limitar recursos y evitar registrar URLs firmadas. No incluir autenticación, cookies ni elusión de DRM. El acceso a contenido y su uso siguen sujetos a las condiciones del proveedor y derechos aplicables; yt-dlp no concede permisos. Mantener deshabilitado el guardado offline de YouTube.

## Consecuencias y validación
La disponibilidad es incierta y puede depender de región y cambios del proveedor. El proxy entrega datos al cliente por lo que el rechazo en la bóveda no impide su copia fuera de la app. Requiere pruebas de SSRF, límites, errores y revisión independiente antes de considerar el cambio terminado. Reversión: deshabilitar búsqueda y resolución heredadas; restaurar la opción oficial solo si se solicita y valida de nuevo.
