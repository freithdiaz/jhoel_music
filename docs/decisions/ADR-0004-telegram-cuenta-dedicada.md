# ADR-0004: Investigación local con cuenta Telegram dedicada

Estado: propuesta; implementación y revisión pendientes

## Contexto
Seleccionar botones callback mediante el método documentado por Telegram requiere cuenta de usuario. Automatizar con una cuenta confiere acceso a su sesión y no demuestra derechos de uso de archivos. Esta investigación es independiente y no modifica el flujo de importación manual del ADR-0003.

## Decisión propuesta
Una PoC local efímera con cuenta exclusivamente dedicada y bot de prueba propio, sin rutas HTTP, integración de biblioteca, extracción de audio ni acceso a cuenta principal. Validar bot, chat, mensaje, botón y vigencia; un solo callback por aprobación explícita. Primero fixtures offline; pruebas en vivo requieren autorización específica. El uso de bots de terceros requiere aprobación adicional y revisar condiciones.

Credenciales y sesión nunca via chat, logs, argumentos o repositorio; almacenar fuera del proyecto con permisos del usuario y revocar sesión al finalizar. Sin reintentos automáticos ni acceso al historial no relacionado. No afirmar que el clic confirma licencia o autoriza descarga.

## Gates
Revisión independiente de credenciales, dependencia y límites; pruebas offline de negativos, cancelación y ausencia de filtración; aislamiento de secretos y procedimiento de revocación. No habilitar servicio persistente ni desplegar sin revisión adicional.

## Ampliación propuesta: investigación de bot tercero (no aprobada para ejecución)
El usuario autorizó investigar y preparar sin ejecutar una búsqueda «Romeo Santos» y la selección de un botón de @vkmusbot en el grupo de prueba. Architect identifica un límite de confianza nuevo. Esta propuesta no autoriza código operativo contra el tercero ni tráfico real; requiere revisión arquitectónica y de seguridad antes de habilitarlo, y consentimiento específico para cada ensayo.

- Buscar y seleccionar son acciones distintas; confirmar explícitamente la búsqueda y, tras mostrar el resultado concreto, confirmar por separado un solo callback. Sin reintentos automáticos; estado incierto requiere comprobación manual.
- Un callback puede provocar que el tercero publique audio en el grupo aunque el cliente no lo descargue; advertirlo y verificar que el usuario acepte la exposición a los miembros y la retención en Telegram. No prometer eliminación remota ni ausencia de caché de terceros.
- Sin descarga ni procesamiento de medios, biblioteca, servidor o automatización persistente. Verificar condiciones aplicables de Telegram y del tercero; si son desconocidas, no presentarlas como satisfechas. La licencia de los archivos no está verificada.
- Cuenta dedicada, grupo privado y bot permitidos por ID fiable; asociar consentimiento al mensaje, remitente, botón y vigencia, y volver a verificar antes del envío. No registrar payloads ni leer historial ajeno innecesario.
- Diseñar exclusión entre procesos y consumo atómico persistente resistente a reinicio, con estado protegido; no afirmar ejecución remota exactamente una vez. Sin esta garantía y revisión independiente mantener el callback bloqueado.
- Primero pruebas offline de identidad, expiración, concurrencia, cancelación y efectos simulados; luego revisión y autorización específica adicional para una búsqueda real y cada callback real. Usuario informó ensayo exitoso de recuperación y callback con bot propio; no demuestra funcionamiento del bot tercero.

### Alternativa excepcional aprobada para preparar, pendiente de revisión
Una PoC supervisada de una sola ejecución, con sesión y consumo solo en memoria, sin SQLite ni reintentos automáticos, podría permitir como máximo un intento por proceso si se implementa correctamente. No protege contra otra ejecución, otros procesos, reinicios ni garantiza ejecución remota única; mantener como precondición operativa que no existan otros clientes. Si el resultado es incierto, detenerse y comprobar manualmente. Las credenciales en `.env` conservan los permisos existentes, con el riesgo previamente comunicado. El tercero podría publicar o retener audio en el grupo. Esta alternativa sustituiría la exigencia de anti-replay persistente únicamente para un ensayo excepcional y necesita aprobación expresa del usuario, modificación formal de la decisión, pruebas y revisión independiente antes de habilitar código real. Hasta entonces se mantiene el gate anterior y el callback bloqueado.

Usuario aceptó explícitamente preparar esta alternativa excepcional con el límite de repeticiones entre ejecuciones. La aceptación no aprueba un ensayo real: siguen pendientes implementación, pruebas, revisión independiente y autorización separada antes de búsqueda y callback. El resto de este ADR permanece propuesto; no desplegar ni integrar en la aplicación.

### Selección supervisada de respuesta no correlacionada (preparación autorizada)
Usuario acepta preparar presentación local y elección de canción aunque una respuesta no tenga correlación automática demostrable. Una respuesta sin `reply_to` verificable no debe presentarse como definitivamente causada por la búsqueda; usuario debe identificarla explícitamente y aceptar incertidumbre. Restringir grupo e identidad verificados, mensajes y botones acotados, sanitización terminal, revalidación antes de selección y un solo intento por proceso; sin descarga explícita ni reintentos. El bot podría publicar audio en el grupo. Esta aceptación autoriza preparar, no pulsar en vivo: requiere revisión independiente y confirmaciones separadas para búsqueda y selección concreta.

### Solicitud posterior de recepción y descarga (propuesta, no habilitada)
El usuario solicitó preparar además recepción y descarga de «Imitadora» y declaró autorización para esa grabación; dicha declaración no verifica independientemente licencia, fuente ni identidad de archivo. Architect recomienda separar callback, recepción de un candidato y descarga: un mensaje de audio posterior no demuestra que corresponda al botón ni a la canción. La descarga requeriría decisión específica compatible con ADR-0001 y ADR-0003, autorización positiva verificable para archivo/origen/uso, identidad y pertenencia autenticadas, límites efectivos de bytes y tiempo, validación de contenido, rutas y limpieza seguras, pruebas y revisión independiente. Hasta satisfacer estos gates no se habilita descarga ni se interpreta una fixture como licencia. La propuesta no modifica autorización de almacenamiento actual.
