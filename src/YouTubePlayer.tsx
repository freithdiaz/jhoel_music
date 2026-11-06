import { useEffect, useRef, useState } from 'react';
import { youtubeEmbedUrl, youtubeErrorMessage } from './services/youtubePlayer';
import { searchYouTube } from './services/youtubeSearch';
import type { Track } from './types';

type Player = { destroy: () => void };
type YouTubeWindow = Window & {
  YT?: { Player: new (element: HTMLIFrameElement, options: { events: { onReady: () => void; onError: (event: { data: number }) => void } }) => Player };
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<void> | undefined;
function loadApi(): Promise<void> {
  const win = window as YouTubeWindow;
  if (win.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    const previous = win.onYouTubeIframeAPIReady;
    let script = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const timer = window.setTimeout(() => reject(new Error('Tiempo de espera agotado')), 15000);
    win.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      resolve();
    };
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
    script.addEventListener('error', () => { window.clearTimeout(timer); reject(new Error('No se pudo cargar la API')); }, { once: true });
  }).catch(error => { apiPromise = undefined; throw error; });
  return apiPromise;
}

export default function YouTubePlayer({ videoId, title, artist, baseUrl, onSelect }: { videoId: string; title: string; artist: string; baseUrl: string; onSelect: (track: Track) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [message, setMessage] = useState('');
  const [errorCode, setErrorCode] = useState<number>();
  const [results, setResults] = useState<Track[] | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    let disposed = false;
    let player: Player | undefined;
    loadApi().then(() => {
      if (disposed || !frameRef.current) return;
      player = new (window as YouTubeWindow).YT!.Player(frameRef.current, {
        events: {
          onReady: () => { if (!disposed) setMessage(''); },
          onError: event => { if (!disposed) { setErrorCode(event.data); setMessage(youtubeErrorMessage(event.data)); } }
        }
      });
    }).catch(() => { if (!disposed) setMessage('No se pudo cargar la API de YouTube. Revisa la conexión o bloqueadores; también puedes abrir el vídeo en YouTube.'); });
    return () => { disposed = true; requestRef.current?.abort(); requestRef.current = null; player?.destroy(); };
  }, [videoId]);

  const findAlternatives = async () => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 12000);
    setSearching(true);
    setSearchError('');
    setResults(null);
    try {
      const tracks = await searchYouTube(baseUrl, `${title} ${artist}`, controller.signal);
      if (requestRef.current === controller) setResults(tracks.filter(track => track.id !== `yt-${videoId}`));
    } catch (error) {
      if (requestRef.current === controller) setSearchError(controller.signal.aborted ? 'La búsqueda agotó el tiempo de espera. Puedes volver a intentarlo.' : error instanceof Error ? error.message : 'No se pudo buscar en YouTube.');
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === controller) { requestRef.current = null; setSearching(false); }
    }
  };

  return <div className="fixed z-[60] bottom-24 right-4 w-80 max-w-[90vw] bg-zinc-900 p-2 rounded-xl shadow-xl">
    <p className="text-xs text-zinc-300 mb-2">YouTube · usa sus controles; el volumen y los efectos de la aplicación no se aplican</p>
    <iframe ref={frameRef} className="w-full aspect-video" title={`YouTube: ${title}`} src={youtubeEmbedUrl(videoId, window.location.origin)} referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
    {message && <p role="alert" className="text-xs text-amber-300 mt-2">{message}</p>}
    <a className="text-xs text-sky-300 underline" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Abrir en YouTube</a>
    {(errorCode === 101 || errorCode === 150) && <div className="mt-2 text-xs">
      <button type="button" disabled={searching} onClick={findAlternatives} className="text-sky-300 underline disabled:opacity-50">{searching ? 'Buscando…' : 'Buscar versiones alternativas'}</button>
      <p className="text-zinc-400 mt-1">Son posibles coincidencias; su reproducción aquí no está garantizada.</p>
      {searchError && <p role="alert" className="text-amber-300 mt-1">{searchError}</p>}
      {results && (results.length ? <ul className="mt-2 max-h-36 overflow-y-auto space-y-1">{results.map(track => <li key={track.id}><button type="button" onClick={() => onSelect(track)} className="text-left text-sky-300 underline">{track.title} · {track.artist}</button></li>)}</ul> : <p className="text-zinc-400 mt-1">No se encontraron otras versiones.</p>)}
    </div>}
  </div>;
}
