# Diaz Music • Spotify Clone Studio PWA

Un clon de Spotify 100% libre, gratuito y autoalojable, diseñado para funcionar tanto en la web como en teléfonos móviles como **PWA (Progressive Web App)**, con control total mediante **audífonos Bluetooth** e **intercomunicadores de casco**.

---

## 🚀 Características Principales

1. **Música 100% Gratis y Libre:**
   - **Buscador en Streaming Libre (Audius API):** Explora y reproduce millones de canciones sin anuncios, sin pagos y sin registrarte.
   - **Puente REA Spotify ([morluto/rea](https://github.com/morluto/rea)):** Pega cualquier enlace de canción de Spotify (`https://open.spotify.com/track/...`) para decodificar su metadata, carátula HD y reproducirla libremente.
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

### Paso 1: Iniciar el servidor en tu computadora
En la terminal del proyecto, ejecuta:
```bash
npm run dev
```
Vite te mostrará las direcciones de acceso:
- Local: `http://localhost:5173`
- Red Local (Wi-Fi): `http://192.168.0.36:5173` (o la IP asignada a tu PC).

### Paso 2: Abrir desde el celular
1. Asegúrate de que tu celular esté conectado a la misma red Wi-Fi que tu PC (o usando Tailscale VPN).
2. Abre en Chrome (Android) o Safari (iPhone) la URL: `http://192.168.0.36:5173`.

### Paso 3: Instalar como App Nativa
- **En Android:** Toca el botón **"Instalar App"** en el banner superior, o en el menú de 3 puntos selecciona **"Instalar aplicación"**.
- **En iPhone (iOS):** Toca el botón **Compartir** (icono con flecha hacia arriba) y selecciona **"Agregar a la pantalla de inicio"**.

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
python server.py
```
El servidor transmitirá automáticamente tus archivos locales por red con soporte para streaming y saltos en la barra de tiempo.

