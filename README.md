# Diaz Music • Spotify Clone Studio PWA

Un clon de Spotify 100% libre, gratuito y autoalojable, diseñado para funcionar tanto en la web como en teléfonos móviles como **PWA (Progressive Web App)**, con control total mediante **audífonos Bluetooth** e **intercomunicadores de casco**.

---

## 🚀 Características Principales

1. **Música 100% Gratis y Libre:**
   - **Buscador en Streaming Libre (Audius API):** Explora y reproduce millones de canciones sin anuncios, sin pagos y sin registrarte.
   - **Importación de enlaces de Spotify:** consulta metadatos y busca una posible coincidencia en otro catálogo; no reproduce directamente el audio de Spotify. La coincidencia puede ser distinta o una vista previa.
   - **Bóveda Offline Persistente (IndexedDB):** Descarga pistas a la memoria de tu celular para escucharlas sin conexión ni gastar datos móviles.
   - **Exportación Directa MP3:** Descarga cualquier canción libre de DRM.
   - **Carga de MP3/FLAC locales:** Arrastra o selecciona música guardada en tu teléfono o PC.

2. **Control Total por Audífonos e Intercomunicador de Casco:**
   - **Media Session API (`navigator.mediaSession`):** Controles nativos en pantalla de bloqueo, barra de notificaciones y smartwatches.
   - **Comandos de hardware (Bluetooth / Intercom):**
     - 1 toque: Reproducir / Pausar.
     - 2 toques: Siguiente canción.
     - 3 toques: Canción anterior.
     - Mantener presionado: Salto de 10 segundos.
   - **Modo Intercomunicador (Screen WakeLock):** Evita que el celular apague el proceso de audio en paseos en moto o entrenamientos.
   - **Audio Espacial 8D:** Paneo circular dinámico 360° para una experiencia envolvente en auriculares.

3. **Estudio DSP de Masterización en Tiempo Real:**
   - Ecualizador paramétrico de 5 bandas (60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz).
   - Presets DJ: Slowed + Reverb (0.84x), Nightcore (1.25x), Lo-Fi Vinyl (Filtro 1.8kHz), Mega Bass (+10dB).
   - Loop A-B de sección para repetir tus partes y solos preferidos.
   - Visualizador de espectro FFT en tiempo real (Barras, Onda, Círculo).
   - Sintetizador procedural WebAudio en vivo de respaldo.

4. **Interfaz Pro Responsive (Móvil y Escritorio):**
   - **Celular:** Barra de navegación inferior fija, reproductor mini acoplado y vista completa Now Playing deslizable.
   - **Escritorio:** Diseño de 3 columnas estilo Spotify Pro con control de algoritmo en vivo.

---

## 📲 Cómo Abrir e Instalar en tu Celular (PWA)

### Desarrollo y acceso desde el celular
Ejecuta `iniciar_diaz_music.bat` y abre en el celular la dirección **Network** que muestra Vite, conectado a la misma red. Esa dirección HTTP sirve para desarrollar y probar con el servidor activo, pero **no es una instalación offline**. El service worker se activa únicamente en la versión de producción y en un contexto seguro.

### Preparar la versión instalable
1. Ejecuta `npm run build`. El resultado queda en `dist/`.
2. Sirve esa carpeta desde la misma dirección HTTPS en la que se abrirá la app. Configura el servidor web para que `/api/` se envíe a FastAPI en `127.0.0.1:8000/`, quitando el prefijo `/api`. No expongas directamente el servidor de desarrollo de Vite a Internet.
3. Abre la dirección HTTPS en el celular mientras haya conexión. Espera a que cargue y recarga una vez para permitir que se prepare la app.
4. En Android, usa **Instalar aplicación** en el navegador si está disponible. En iPhone, abre la página en Safari y usa **Compartir → Agregar a pantalla de inicio**.

La URL de la API se puede configurar al compilar con `VITE_API_BASE_URL`; por defecto es `/api` del mismo origen. Cuando migres a un servidor o a un acceso HTTPS por Tailscale, habrá que configurar y probar ese acceso por separado. **Cambiar de dirección u origen crea otro almacenamiento del navegador:** las canciones descargadas desde la IP HTTP no se trasladan automáticamente al nuevo HTTPS. Conviene hacer la instalación y las descargas definitivas cuando tengas la dirección final.

### Descargar y probar sin conexión
Con la aplicación abierta y conectada, usa el botón de descarga de cada canción; en una playlist se muestra cuántas están guardadas en ese dispositivo. Las emisoras en vivo no se pueden descargar. Una vez finalizada cada descarga, entra en **Descargas** desde la barra móvil o reproduce una playlist que contenga esas canciones. Después prueba con el modo avión. Si falta una pista, la app avisará; no la inventará ni marcará como descargada. Las descargas dependen de que el proveedor permita acceder al archivo, tienen un límite de 100 MB por pista y pueden ser eliminadas por el navegador o por el sistema para liberar espacio.

---

## 🎧 Uso con Intercomunicadores (Sena, Cardo, FreedConn, Lexin)
1. Empareja tu intercomunicador por Bluetooth a tu celular.
2. Abre **Diaz Music** y dale reproducir.
3. Activa el botón **"Intercom"** en la barra superior para mantener la aplicación despierta.
4. ¡Listo! Puedes controlar el reproductor con la rueda o botones de tu casco mientras conduces.

---

## 🖥️ Servidor Backend Local Opcional (FastAPI)
Si tienes una colección de música en tu computadora o NAS, inicia el servidor Python:
```bash
pip install -r requirements.txt
python server.py
```
El servidor transmitirá automáticamente tus archivos locales por red con soporte para streaming y saltos en la barra de tiempo.

Por seguridad, el backend escucha solo en `127.0.0.1` por defecto. En desarrollo, Vite conecta el celular con el backend mediante `/api`, por lo que basta iniciar ambos con `iniciar_diaz_music.bat` y abrir en el celular la dirección **Network** que muestra Vite. Reinicia ambos procesos después de cambiar la configuración. El proxy de desarrollo permite acceder al backend desde los dispositivos que alcanzan Vite: úsalo solo en una red de confianza, no lo expongas a Internet.

Para una instalación distinta que necesite acceder directamente al puerto 8000 desde otro dispositivo de confianza, configura `MUSIC_HOST=0.0.0.0` y añade el origen exacto de la aplicación a `CORS_ORIGINS` (separando varios orígenes con comas). En PowerShell, por ejemplo:

```powershell
$env:MUSIC_HOST = "0.0.0.0"
$env:CORS_ORIGINS = "http://localhost:5173,http://192.168.0.36:5173"
python server.py
```

Reemplaza la dirección por la IP real. No expongas el servidor directamente a Internet: aún necesita HTTPS, límites de intentos y otras protecciones. Las contraseñas y los tokens enviados por HTTP son visibles para terceros en la red. Las cuentas locales offline no ofrecen protección fuerte frente a alguien con acceso al navegador. El proxy de radio del backend está deshabilitado por seguridad; las emisoras que admiten reproducción directa siguen disponibles.

La instalación PWA y las funciones offline en un teléfono normalmente requieren HTTPS: acceder por una IP local con HTTP no es equivalente a `localhost` en el propio teléfono.

Para ejecutar las pruebas del backend: `python -m unittest discover -s tests`.

### Sincronización de la biblioteca

Las playlists, favoritas y el perfil de gustos se guardan en el navegador. Los cambios pendientes se reintentan al recuperar la conexión y periódicamente mientras la app esté abierta. Si otro dispositivo cambió la biblioteca desde la última sincronización, la aplicación detiene el envío y permite comparar las versiones antes de elegir. La opción de combinar conserva las playlists diferentes de ambos lados y duplica las que comparten ID pero tienen cambios distintos; como no se dispone de una base común, los elementos borrados pueden reaparecer. Los favoritos se unen por ID y los contadores de gustos conservan el valor mayor. Antes de aplicar cambios se guarda una copia de ambos conjuntos de metadatos en el almacenamiento local; también se pueden descargar copias JSON. Los audios no se incluyen en estas copias. Cuando no hay cambios pendientes, la app consulta también las actualizaciones del servidor.

Las cuentas creadas sin servidor son locales a ese navegador y no se crean automáticamente en el backend. La sesión del servidor puede vencer: vuelve a iniciar sesión para enviar los cambios pendientes. Las canciones descargadas permanecen en la bóveda del dispositivo y no se sincronizan con el servidor. Las pruebas del cliente se ejecutan con `node --test tests/sync.test.mjs`.

### Auto-DJ y recomendaciones

En Inicio puedes elegir Colombia, Global o usar la región del idioma del dispositivo; Colombia es la opción predeterminada y no se consulta tu ubicación GPS. Sin historial, Colombia inicia una búsqueda orientativa de música urbana y tropical. Con el uso, la pantalla incorpora sugerencias relacionadas con tus escuchas.

Auto-DJ prioriza el artista y género de la canción actual, utiliza el perfil de escuchas como señal adicional y evita canciones recientes. Busca posibles pistas sin interrumpir la reproducción actual. Si no encuentra una coincidencia, avisa en vez de cambiar a un género sin relación; puedes desactivar Auto-DJ para seguir el orden de la lista. La relación es una aproximación basada en metadatos y una pequeña selección editorial, no un catálogo completo de artistas similares. La disponibilidad y duración dependen del proveedor; algunas fuentes solo ofrecen vistas previas. Las búsquedas de recomendaciones envían un nombre de artista o género al proveedor configurado.

El perfil aprende tras escuchar aproximadamente la mitad del audio, sin contar saltos en la barra de reproducción. Las vistas previas detectadas no se cuentan como una canción completa. Ejecuta `node --test tests/recommendations.test.mjs` para comprobar los casos básicos de recomendaciones.
