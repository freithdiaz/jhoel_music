import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, ListPlus, Play, RefreshCw, Trash2 } from 'lucide-react';
import { getServerToken } from './services/authService';

export type Imported = { filename: string; title: string; artist: string; album: string; genre: string; coverUrl: string };

export function TelegramImported({ apiUrl, username, canDelete, onPlay, onAdd, onDeleted, refreshSignal, onDownload, isDownloaded, downloadingId }: { apiUrl: string; username?: string; canDelete: boolean; onPlay: (item: Imported) => void; onAdd: (item: Imported) => void; onDeleted: (filename: string) => void; refreshSignal: number; onDownload?: (item: Imported) => void; isDownloaded?: (item: Imported) => boolean; downloadingId?: string | null }) {
  const [items, setItems] = useState<Imported[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const deletionPolling = useRef(false);
  const onDeletedRef = useRef(onDeleted);
  useEffect(() => { onDeletedRef.current = onDeleted; }, [onDeleted]);
  const deletionKey = `diaz-telegram-delete:${apiUrl}:${username || ''}`;
  const [deletion, setDeletion] = useState<{ id: string; filename: string; state: string } | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(deletionKey) || 'null'); } catch { return null; }
  });

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${apiUrl}/tracks`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error();
      const found: Imported[] = [];
      for (const item of data) {
        if (item && typeof item.filename === 'string' && /^telegram-[0-9a-f]{32}\.mp3$/.test(item.filename)) {
          const cover = typeof item.cover_url === 'string' && /^\/telegram\/cover\/telegram-[0-9a-f]{32}\.jpg$/.test(item.cover_url)
            ? `${apiUrl}${item.cover_url}` : '';
          found.push({ filename: item.filename, title: typeof item.title === 'string' ? item.title : item.filename,
            artist: typeof item.artist === 'string' ? item.artist : 'Biblioteca personal',
            album: typeof item.album === 'string' ? item.album : 'Importaciones Telegram',
            genre: typeof item.genre === 'string' ? item.genre : 'Sin género', coverUrl: cover });
        }
      }
      setItems(found);
    } catch {
      setItems(null);
      setError('No se pudo consultar la biblioteca. Comprueba la conexión y su configuración.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [refreshSignal, apiUrl, username]);

  async function authenticated(path: string, init: RequestInit = {}) {
    const token = username ? getServerToken(username, apiUrl) : null;
    if (!token) throw new Error('Sesión no disponible');
    const response = await fetch(`${apiUrl}${path}`, { ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Solicitud no confirmada');
    return response.json();
  }

  async function remove(item: Imported) {
    if (deletion || !canDelete) return;
    if (!window.confirm(`¿Eliminar «${item.title}» de este servidor? Se borrarán esta copia MP3, su carátula y sus metadatos. Las playlists, descargas offline y copias en cuarentena no se modificarán.`)) return;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const pending = { id, filename: item.filename, state: 'pending' };
    sessionStorage.setItem(deletionKey, JSON.stringify(pending));
    setDeletion(pending); setError('');
    try {
      const data = await authenticated('/telegram/library/delete', { method: 'POST',
        body: JSON.stringify({ filename: item.filename, confirmed: true, client_id: id }) });
      if (data.id !== id) throw new Error('Respuesta inválida');
    } catch { setError('No se confirmó la solicitud. Comprueba el estado; no la repitas automáticamente.'); }
  }

  useEffect(() => {
    if (!deletion || ['deleted', 'uncertain', 'expired'].includes(deletion.state)) return;
    let active = true;
    async function poll() {
      if (deletionPolling.current) return;
      deletionPolling.current = true;
      try {
        const data = await authenticated(`/telegram/library/delete/${encodeURIComponent(deletion!.id)}`);
        if (!active || data.filename !== deletion!.filename) return;
        setDeletion(previous => previous && previous.id === deletion!.id ? { ...previous, state: data.state } : previous);
        if (data.state === 'deleted') {
          setItems(previous => previous?.filter(item => item.filename !== data.filename) || null);
          onDeletedRef.current(data.filename);
        }
      } catch { if (active) setError('No se pudo consultar la eliminación. No la repitas hasta comprobar el archivo.'); }
      finally { deletionPolling.current = false; }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [deletion?.id, deletion?.state, apiUrl, username]);

  async function closeDeletion() {
    if (!deletion) return;
    if (deletion.state === 'uncertain' && !window.confirm('El resultado es incierto. Comprueba si el archivo sigue en la biblioteca antes de cerrar este aviso. ¿Continuar?')) return;
    try {
      await authenticated(`/telegram/library/delete/${encodeURIComponent(deletion.id)}`, { method: 'DELETE' });
      sessionStorage.removeItem(deletionKey); setDeletion(null); setError('');
    } catch { setError('No se pudo cerrar el aviso de eliminación.'); }
  }

  return <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h5 className="text-sm font-semibold text-zinc-100">Importaciones locales</h5>
        <p className="mt-1 text-xs text-zinc-500">Archivos MP3 disponibles en este servidor.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-xs font-semibold text-zinc-200 hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50">
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        {items === null ? 'Ver importaciones' : 'Actualizar'}
      </button>
    </div>
    {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
    {deletion && <div className="rounded-lg bg-zinc-950 p-3 text-xs text-zinc-300" aria-live="polite">
      {deletion.state === 'deleted' ? 'Copia eliminada del servidor. Las playlists y descargas offline no se modificaron.' :
        deletion.state === 'uncertain' ? 'Resultado incierto: comprueba si el archivo sigue en la biblioteca antes de repetir.' :
        deletion.state === 'expired' ? 'La solicitud caducó sin eliminar la copia.' : 'Procesando eliminación…'}
      {['deleted', 'uncertain', 'expired'].includes(deletion.state) && <button type="button" onClick={() => void closeDeletion()} className="ml-3 min-h-10 underline hover:text-white">Cerrar aviso</button>}
      {error && <button type="button" onClick={() => {
        if (!window.confirm('Esto solo olvida la referencia en este navegador; no cancela una eliminación. Comprueba primero la biblioteca. ¿Continuar?')) return;
        sessionStorage.removeItem(deletionKey); setDeletion(null); setError('');
      }} className="ml-3 min-h-10 underline hover:text-white">Olvidar referencia local</button>}
    </div>}
    {items && !items.length && <p className="text-xs text-zinc-400">No se encontraron importaciones en este servidor.</p>}
    {items && items.length > 0 && <div className="max-h-48 space-y-1 overflow-y-auto">
      {items.map(item => <div key={item.filename} className="flex items-center gap-1 rounded-lg border border-zinc-800 pr-2 hover:bg-zinc-800/60">
        <button type="button" onClick={() => onPlay(item)}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-sm text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
        {item.coverUrl ? <img src={item.coverUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" /> : <Play className="h-4 w-4 shrink-0 text-emerald-400" />}
        <span className="min-w-0"><span className="block break-words font-semibold">{item.title}</span><span className="mt-0.5 block text-xs text-zinc-400">{item.artist} · {item.genre}</span></span>
        </button>
        {onDownload && <button type="button" onClick={() => onDownload(item)} disabled={isDownloaded?.(item) || !!downloadingId}
          aria-label={isDownloaded?.(item) ? `${item.title} descargada en este dispositivo` : `Descargar ${item.title} en este dispositivo`}
          title={isDownloaded?.(item) ? 'Ya descargada en este dispositivo' : 'Descargar en este dispositivo'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-emerald-400 hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-60">
          {downloadingId === item.filename ? <RefreshCw className="h-4 w-4 animate-spin" /> : isDownloaded?.(item) ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        </button>}
        <button type="button" onClick={() => onAdd(item)} aria-label={`Añadir ${item.title} a una playlist`} title="Añadir a playlist"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"><ListPlus className="h-4 w-4" /></button>
        <button type="button" onClick={() => void remove(item)} disabled={!canDelete || !!deletion} aria-label={`Eliminar ${item.title} del servidor`} title={canDelete ? 'Eliminar copia del servidor' : 'Comprueba primero el puente'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-700 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
      </div>)}
    </div>}
  </div>;
}
