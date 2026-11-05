# Guía de Integración REA (Reverse Engineer Anything) + Diaz Music

Esta guía documenta cómo utilizar la herramienta de código abierto [morluto/rea](https://github.com/morluto/rea) junto a agentes de IA y MCP para realizar ingeniería inversa a plataformas de música y alimentar tu reproductor libre **Diaz Music**.

---

## 1. ¿Qué es REA (`morluto/rea`)?

**REA (Reverse Engineer Anything)** es un framework y servidor MCP diseñado para permitir que agentes de IA inspeccionen y analicen:
- Aplicaciones web y paquetes de Electron (como el cliente de escritorio de Spotify).
- APKs de Android (usando decompiladores integrados como JADX).
- Binarios nativos (con Ghidra).
- Peticiones de red, tokens y esquemas de API no documentadas.

---

## 2. Cómo usar REA para analizar clientes de música

### Caso A: Análisis del cliente Web / Electron de Spotify
1. Clona el repositorio de REA:
   ```bash
   git clone https://github.com/morluto/rea.git
   cd rea
   ```
2. Inspecciona los archivos empaquetados (`app.asar` o bundles JavaScript):
   - Con REA, el agente puede buscar cómo el cliente genera tokens efímeros:
     - Endpoints como `spclient.wg.spotify.com/metadata/4/track/...`
     - Métodos de autorización vía cookies o tokens anónimos (`client-token`).
3. Extracción de letras y metadata limpia:
   - REA permite desestructurar las respuestas en formato Protobuf o JSON interno.

### Caso B: Mapeo automático hacia streams libres de DRM
En **Diaz Music**, implementamos el módulo `src/services/reaBridge.ts`:
- Tomás un enlace oficial (ejemplo: `https://open.spotify.com/track/...`).
- El puente extrae la metadata completa (Carátula Ultra-HD, Título, Artista, BPM, Clave musical).
- Mapea la pista hacia proveedores libres como la **Red Descentralizada Audius**, **Invidious/Piped** o tu propio **Servidor FastAPI**.
- El usuario escucha la canción **100% gratis, sin anuncios y sin suscripciones**.

---

## 3. Control desde Audífonos e Intercomunicador de Casco

Para que puedas controlar la música en tu celular mientras andas en moto o haces deporte:
- **Media Session API**: `play`, `pause`, `nexttrack`, `previoustrack`, `seekbackward`, `seekforward`.
- **Botones del intercomunicador**:
  - 1 pulsación: Pausar / Reanudar.
  - 2 pulsaciones: Siguiente canción.
  - 3 pulsaciones: Canción anterior.
  - Mantener presionado: Salto de 10 segundos.
- **Modo Intercomunicador (WakeLock)**: Mantiene el proceso activo para evitar que el sistema operativo mate el audio en segundo plano.
- **Audio 8D Espacial**: Paneo circular binaural 360° optimizado para audífonos y cascos con altavoces duales.

---

## 4. Instalación como PWA en tu Celular

1. En tu PC, corre el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Vite mostrará tu dirección de red local (ejemplo: `http://192.168.1.50:5173`).
2. Abre esa dirección en el navegador de tu celular (Chrome en Android o Safari en iPhone).
3. **Android**: Toca en "Instalar App" o en los 3 puntos del navegador y elige **"Instalar aplicación"**.
4. **iPhone**: Toca en el botón de compartir y selecciona **"Agregar al inicio"**.
5. ¡Listo! Se abrirá como una app nativa a pantalla completa sin barras de navegador.

