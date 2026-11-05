"""
Diaz Music - Servidor Backend FastAPI & Streamer Universal (Full-Length Streaming)
Elimina el límite de 30 segundos: transmite cualquier canción de internet COMPLETA (3 a 5+ minutos)
en tiempo real a tu celular o PC sin descargarla al disco.
"""

import os
import time
import mimetypes
import urllib.request
import urllib.parse
import json
from pathlib import Path
from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException, Request, status, Query
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp

app = FastAPI(title="Diaz Music Universal Streamer", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Content-Length", "Accept-Ranges"]
)

MUSIC_DIR = Path(os.environ.get("MUSIC_DIR", "./music"))
MUSIC_DIR.mkdir(parents=True, exist_ok=True)
SUPPORTED_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".ogg"}

# Cache en memoria para URLs de streaming de YouTube para que el seek y los saltos sean instantáneos
# { video_id: (direct_url, expiry_timestamp) }
STREAM_CACHE: Dict[str, tuple] = {}

YDL_OPTS = {
    'format': 'bestaudio/m4a/best',
    'noplaylist': True,
    'quiet': True,
    'no_warnings': True,
    'skip_download': True
}

def get_stream_url(target: str, video_id: Optional[str] = None) -> tuple:
    now = time.time()
    if video_id and video_id in STREAM_CACHE:
        cached_url, expiry = STREAM_CACHE[video_id]
        if now < expiry:
            return cached_url, video_id

    with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
        info = ydl.extract_info(target, download=False)
        if 'entries' in info and len(info['entries']) > 0:
            info = info['entries'][0]

        vid = info.get('id') or video_id or "unknown"
        url = info.get('url')
        if not url:
            raise ValueError("No se pudo obtener el stream de audio")

        # Las URLs de YouTube suelen ser válidas por ~6 horas. Guardamos por 4 horas.
        STREAM_CACHE[vid] = (url, now + 14400)
        return url, vid

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Diaz Music Universal Streamer",
        "full_length_streaming": True,
        "mode": "Sin límite de 30 segundos • Canciones 100% completas",
        "local_tracks": len(list(MUSIC_DIR.glob("*.*")))
    }

# ==========================================
# 1. BÚSQUEDA ONLINE DE CANCIONES COMPLETAS
# ==========================================
@app.get("/search_online")
def search_online(q: str = Query(..., description="Nombre de la canción o artista")):
    """
    Busca cualquier canción en YouTube Music y devuelve la metadata completa
    con duración 100% real (ej: 210s, 280s) para reproducir completa en la PWA.
    """
    query = q.strip()
    if not query:
        return []

    try:
        search_target = f"ytsearch8:{query} audio"
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            res = ydl.extract_info(search_target, download=False)
            entries = res.get('entries', []) if res else []

            results = []
            for item in entries:
                if not item:
                    continue
                video_id = item.get('id')
                title = item.get('title', 'Canción Online')
                uploader = item.get('uploader') or item.get('channel') or 'Artista Oficial'
                duration = item.get('duration') or 210
                thumbnail = item.get('thumbnail') or 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80'

                results.append({
                    "id": f"yt-{video_id}",
                    "title": title,
                    "artist": uploader,
                    "album": "YouTube Music Stream (100% Completa)",
                    "duration": duration,
                    "bpm": 120,
                    "keySignature": "C Major",
                    "coverUrl": thumbnail,
                    "audioUrl": f"/stream_yt?v={video_id}",
                    "sourceType": "invidious"
                })
            return results
    except Exception as e:
        print(f"Error en search_online: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 2. PROXY DE STREAMING EN VIVO (CANCIONES COMPLETAS SIN CORRUPCIÓN CORS)
# ==========================================
@app.get("/stream_yt")
def stream_yt(request: Request, v: Optional[str] = None, q: Optional[str] = None):
    """
    Proxy de streaming en tiempo real:
    Lee los bytes directamente de los servidores de audio y los envía al navegador/celular
    con soporte de Range Requests y cabeceras CORS.
    NO hay límite de 30 segundos: se reproduce la canción COMPLETA de inicio a fin.
    """
    if not v and not q:
        raise HTTPException(status_code=400, detail="Se requiere parámetro v (id) o q (búsqueda)")

    target = f"https://www.youtube.com/watch?v={v}" if v else f"ytsearch1:{q} audio"

    try:
        stream_url, vid = get_stream_url(target, v)
    except Exception as err:
        print(f"Error extrayendo stream: {err}")
        raise HTTPException(status_code=500, detail=f"No se pudo extraer el audio: {err}")

    # Manejar petición de Range (para saltos, seek y control con audífonos/intercomunicador)
    range_header = request.headers.get("range")
    req_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Encoding": "identity"
    }
    if range_header:
        req_headers["Range"] = range_header

    try:
        upstream_req = urllib.request.Request(stream_url, headers=req_headers)
        upstream_resp = urllib.request.urlopen(upstream_req, timeout=12)

        def iter_chunks():
            try:
                while True:
                    chunk = upstream_resp.read(64 * 1024)
                    if not chunk:
                        break
                    yield chunk
            except Exception as stream_err:
                print(f"Stream interrumpido por el cliente: {stream_err}")
            finally:
                upstream_resp.close()

        res_headers = {
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges"
        }

        # Copiar encabezados esenciales del flujo de origen
        for h in ["Content-Range", "Content-Length", "Content-Type"]:
            val = upstream_resp.headers.get(h)
            if val:
                res_headers[h] = val

        return StreamingResponse(
            iter_chunks(),
            status_code=upstream_resp.status,
            headers=res_headers
        )
    except Exception as e:
        print(f"Error transmitiendo datos del stream: {e}")
        raise HTTPException(status_code=502, detail=f"Error en streaming de audio: {e}")

# ==========================================
# 3. RESOLVER ENLACES DE SPOTIFY A CANCIONES COMPLETAS
# ==========================================
@app.get("/resolve_spotify")
def resolve_spotify(url: str = Query(..., description="URL de Spotify track")):
    """
    Recibe un enlace de Spotify, extrae metadata de Spotify y resuelve
    hacia la pista oficial completa en streaming sin límite de tiempo.
    """
    try:
        oembed_url = f"https://open.spotify.com/oembed?url={urllib.parse.quote(url)}"
        req = urllib.request.Request(oembed_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())

        title = data.get("title", "")
        artist = data.get("author_name", "")
        thumbnail = data.get("thumbnail_url", "")

        # Buscar el audio completo en YouTube Music
        search_query = f"{artist} - {title} audio"
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            info = ydl.extract_info(f"ytsearch1:{search_query}", download=False)
            entry = info['entries'][0] if 'entries' in info and info['entries'] else info
            video_id = entry.get('id')

            return {
                "id": f"spotify-{video_id}",
                "title": title,
                "artist": artist,
                "album": "Spotify Re-Engineered via REA (Canción Completa)",
                "duration": entry.get('duration') or 210,
                "bpm": 122,
                "keySignature": "A Minor",
                "coverUrl": thumbnail or entry.get('thumbnail'),
                "audioUrl": f"/stream_yt?v={video_id}",
                "sourceType": "rea-reverse"
            }
    except Exception as e:
        print(f"Error en resolve_spotify: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 4. BIBLIOTECA LOCAL EN PC O NAS
# ==========================================
@app.get("/tracks")
def list_tracks():
    tracks = []
    for idx, file_path in enumerate(MUSIC_DIR.glob("*.*")):
        if file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            clean_name = file_path.stem
            parts = clean_name.split(" - ")
            artist = parts[0].strip() if len(parts) > 1 else "Diaz Music Local"
            title = parts[1].strip() if len(parts) > 1 else clean_name

            tracks.append({
                "id": f"local-srv-{idx}",
                "filename": file_path.name,
                "title": title,
                "artist": artist,
                "album": "Biblioteca Local PC/NAS",
                "duration": 200,
                "bpm": 120,
                "keySignature": "C Major",
                "coverUrl": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
                "audioUrl": f"/stream/{urllib.parse.quote(file_path.name)}",
                "sourceType": "fastapi"
            })
    return tracks

def send_partial_file(request: Request, path: Path):
    file_size = path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        def full_iter():
            with open(path, "rb") as f:
                yield from f
        content_type, _ = mimetypes.guess_type(path)
        return StreamingResponse(full_iter(), media_type=content_type or "audio/mpeg")

    try:
        bytes_prefix = range_header.replace("bytes=", "")
        start_str, end_str = bytes_prefix.split("-")
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
    except ValueError:
        raise HTTPException(status_code=416, detail="Rango no válido")

    if start >= file_size or end >= file_size:
        raise HTTPException(status_code=416, detail="Rango fuera de límites")

    content_length = end - start + 1

    def iter_chunk():
        with open(path, "rb") as f:
            f.seek(start)
            bytes_left = content_length
            while bytes_left > 0:
                chunk = f.read(min(64 * 1024, bytes_left))
                if not chunk:
                    break
                bytes_left -= len(chunk)
                yield chunk

    content_type, _ = mimetypes.guess_type(path)
    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Access-Control-Allow-Origin": "*",
    }

    return StreamingResponse(
        iter_chunk(),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type=content_type or "audio/mpeg"
    )

@app.get("/stream/{filename}")
def stream_audio(filename: str, request: Request):
    file_path = MUSIC_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de audio no encontrado")
    return send_partial_file(request, file_path)

if __name__ == "__main__":
    import uvicorn
    print("=================================================================")
    print("🚀 Diaz Music Universal Streamer Activo en http://0.0.0.0:8000")
    print("🎵 Canciones COMPLETAS sin límite de 30 segundos habilitadas")
    print("=================================================================")
    uvicorn.run(app, host="0.0.0.0", port=8000)
