# ADR-0001: Búsqueda oficial y almacenamiento autorizado

Estado: propuesta para implementación de TASK-0001

## Contexto
El catálogo comercial requiere un proveedor y la escucha no concede derechos de copia. La bóveda existente almacena blobs, pero su presencia no demuestra autorización de descarga.

## Decisión
- Separar la búsqueda con YouTube Data API y su reproductor oficial de la descarga de archivos. No extraer audio de YouTube para almacenamiento offline.
- Configurar credenciales fuera del repositorio; gestionar su ausencia, las cuotas y videos que no admitan inserción.
- El guardado automático requiere autorización positiva verificable para la pista y su origen. Si no se puede determinar, no descargar. No tratar archivos existentes en la bóveda como prueba de derechos ni borrarlos automáticamente durante una migración.
- Para fuentes autorizadas, medir escucha real sin contar saltos; conservar solo al superar el 50 %, mantener durante pausa y limpiar temporales al abandonar antes del umbral. Recuperar temporales abandonados tras cierre inesperado cuando sea posible.

## Consecuencias
El catálogo comercial puede tener anuncios o restricciones de región y no queda disponible sin conexión a través de YouTube. La descarga automática no se habilita para ninguna fuente hasta verificar su autorización específica. Se requieren pruebas de cuota, saltos, interrupciones y almacenamiento.
