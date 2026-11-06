# ADR-0003: Prueba de importación manual Telegram

Estado: propuesta en desarrollo; requiere revisión de seguridad

## Contexto
El usuario selecciona manualmente archivos en un grupo de prueba y afirma contar con autorización para conservar el archivo elegido. Esa afirmación no verifica de forma independiente los derechos de terceros. Telegram no permite a una cuenta bot usar el método de usuario para pulsar botones de otro bot.

## Decisión propuesta
La integración será opcional y deshabilitada por defecto. Se limitará a operador autenticado y grupo expresamente configurados; no se automatizan botones ni se accede a cuenta personal Telegram. Cada importación requiere confirmación expresa de derechos del archivo específico. No se presenta como verificación independiente de licencia.

El servidor protege el token y nunca entrega URLs de Telegram ni credenciales al navegador. Un único consumidor controla actualizaciones y conflictos de webhook; no se borrará ni alterará automáticamente un webhook existente. Validar remitente, grupo, límite de tamaño y formato; usar rutas generadas, limitar bytes y eliminar temporales. Errores y registros omiten secretos y datos innecesarios.

## Riesgos y validación
El consentimiento declarado no concede derechos inexistentes; la disponibilidad depende del proveedor. La sincronización de actualizaciones, identidad de mensajes, exposición de red, archivos no confiables y concurrencia requieren pruebas y revisión independiente. No habilitar sin cumplir controles; revertir desactivando la integración sin eliminar biblioteca previa.
