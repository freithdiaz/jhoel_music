import React, { useEffect, useRef, useState } from 'react';
import { getServerToken } from './services/authService';
import type { TelegramImportTarget } from './services/telegramImport';

type Result = { id: string; label: string; context: string; relation: 'vinculado' | 'indeterminado' };
type Selection = { label: string; relation: 'vinculado' | 'indeterminado' };
type Job = { state: string; results: Result[] | null; progress?: number; selection?: Selection; auto_selected?: boolean; filename?: string };
type Receipt = { id: string; title: string; message_id: number; size: number; mime_type: string };

interface Props {
  username: string;
  apiUrl: string;
  onPublished: (filename?: string) => void;
  importTarget?: TelegramImportTarget | null;
  onImportHandled?: (nonce?: number) => void;
  compact?: boolean;
}

class RequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function newRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function matchingLine(item: Result): string | null {
  // Solo una ayuda visual para botones numéricos, no una prueba de identidad.
  if (!/^\d{1,3}$/.test(item.label)) return null;
  const pattern = new RegExp(`^\\s*${item.label}[.)]\\s`);
  const matches = item.context.split('\n').filter(line => pattern.test(line));
  return matches.length === 1 ? matches[0].trim() : null;
}

export function TelegramSearch({ username, apiUrl, onPublished, importTarget, onImportHandled, compact = false }: Props) {
  const storageKey = `diaz-telegram-job:${apiUrl}:${username}`;
  const [query, setQuery] = useState('');
  const [jobId, setJobId] = useState(() => sessionStorage.getItem(storageKey) || '');
  const [job, setJob] = useState<Job | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const polling = useRef(false);
  const refreshedJob = useRef('');
  const selectionSent = useRef('');
  const startedImport = useRef(0);
  const jobImportNonce = useRef<number | undefined>(undefined);

  async function request(path: string, init: RequestInit = {}) {
    const token = getServerToken(username, apiUrl);
    if (!token) throw new RequestError('Inicia sesión de nuevo para continuar.', 401);
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new RequestError(response.status === 401 || response.status === 403
      ? 'Sesión vencida o acceso no autorizado.' : 'El servidor no pudo completar la solicitud.', response.status);
    return response.json();
  }

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer: number | undefined;

    async function refresh() {
      if (!active) return;
      if (polling.current) {
        timer = window.setTimeout(refresh, 500);
        return;
      }
      polling.current = true;
      let delay = 3000;
      try {
        const data: Job = await request(`/telegram/search/${encodeURIComponent(jobId)}`);
        if (!active) return;
        // Una respuesta anterior al clic puede llegar después; no reabre la lista.
        if (!(data.state === 'completed' && selectionSent.current === jobId)) setJob(data);
        setMessage('');
        if (['pending', 'claimed', 'selection_pending', 'selection_claimed', 'callback_confirmed', 'receipt_pending', 'download_pending'].includes(data.state)) {
          delay = 1000;
        } else if (data.state === 'download_claimed') {
          // El progreso lo informa el puente varias veces por segundo.
          delay = 600;
        }
      } catch {
        if (active) setMessage('No se pudo actualizar el estado. No repitas la acción hasta comprobarla.');
        delay = 2000;
      } finally {
        polling.current = false;
        if (active) timer = window.setTimeout(refresh, delay);
      }
    }

    void refresh();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [jobId, apiUrl, username]);

  useEffect(() => {
    if (!jobId || job?.state !== 'receipt_pending') { setReceipt(null); return; }
    let active = true;
    request(`/telegram/search/${encodeURIComponent(jobId)}/receipt`)
      .then(data => { if (active) setReceipt(data.receipt || null); })
      .catch(() => { if (active) setMessage('No se pudo consultar el audio observado.'); });
    return () => { active = false; };
  }, [jobId, job?.state, apiUrl, username]);

  useEffect(() => {
    if (!jobId || job?.state !== 'published' || refreshedJob.current === jobId) return;
    refreshedJob.current = jobId;
    const completedId = jobId;
    const publishedFilename = job?.filename;
    onPublished(publishedFilename);
    sessionStorage.removeItem(storageKey);
    setJobId(''); setJob(null); setReceipt(null); setChosen('');
    setMessage('Importación completada. Ya puedes buscar otra canción.');
    const handledNonce = jobImportNonce.current;
    jobImportNonce.current = undefined;
    if (handledNonce !== undefined) onImportHandled?.(handledNonce);
    // Libera la cola; si falla, el servidor permite reemplazar una solicitud publicada.
    void request(`/telegram/search/${encodeURIComponent(completedId)}`, { method: 'DELETE' }).catch(() => {});
  }, [jobId, job?.state, onPublished, onImportHandled, storageKey]);

  useEffect(() => {
    if (!importTarget || startedImport.current === importTarget.nonce) return;
    if (jobId) {
      // No se marca como iniciada: al cerrar o publicar la solicitud actual,
      // este objetivo pendiente arrancará sin exigir otro clic.
      setMessage('Hay una importación anterior en curso. En cuanto termine, se buscará la nueva canción.');
      return;
    }
    startedImport.current = importTarget.nonce;
    setQuery(importTarget.query);
    void startSearch(importTarget.query, importTarget);
  }, [importTarget, jobId]);

  async function startSearch(rawQuery: string, target?: TelegramImportTarget) {
    const text = rawQuery.trim();
    if (!text || jobId) return;
    setBusy(true); setMessage('');
    const clientId = newRequestId();
    // Guardar antes del POST permite comprobar un envío con respuesta perdida.
    sessionStorage.setItem(storageKey, clientId);
    setJobId(clientId); setJob(null); setChosen(''); setReceipt(null);
    selectionSent.current = '';
    jobImportNonce.current = target?.nonce;
    try {
      const payload: Record<string, unknown> = { query: text, client_id: clientId };
      if (target) {
        payload.target = {
          title: target.title,
          artist: target.artist,
          album: target.album,
          duration: target.duration,
        };
        payload.auto_select = true;
      }
      const data = await request('/telegram/search', { method: 'POST', body: JSON.stringify(payload) });
      if (data.id !== clientId) throw new Error('Respuesta inválida del servidor.');
      setQuery(text);
    } catch (error) {
      if (error instanceof RequestError && error.status < 500) {
        // El servidor rechazó la solicitud: no existe trabajo que recuperar.
        sessionStorage.removeItem(storageKey);
        setJobId(''); setJob(null);
        jobImportNonce.current = undefined;
        if (target) onImportHandled?.(target.nonce);
        setMessage(`${error.message} Puedes intentarlo de nuevo.`);
      } else {
        const reason = error instanceof Error ? error.message : 'No se pudo iniciar la búsqueda.';
        setMessage(`${reason} Usa «Recuperar solicitud» y comprueba el grupo antes de volver a intentar.`);
      }
    } finally { setBusy(false); }
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim() || jobId) return;
    await startSearch(query);
  }

  async function recover() {
    setBusy(true);
    try {
      const data = await request('/telegram/active-search');
      if (data.job && typeof data.job.id === 'string') {
        sessionStorage.setItem(storageKey, data.job.id);
        setJobId(data.job.id);
        setMessage('Solicitud recuperada.');
      } else {
        setMessage('El servidor no informa una solicitud activa. Comprueba el grupo antes de descartar la referencia local.');
      }
    } catch { setMessage('No se pudo comprobar la solicitud activa. No vuelvas a intentar todavía.'); }
    finally { setBusy(false); }
  }

  function forgetLocalReference() {
    if (!window.confirm('Esto solo borra la referencia de este navegador. Comprueba antes el servidor y el grupo; no cancela operaciones. ¿Continuar?')) return;
    sessionStorage.removeItem(storageKey);
    setJobId(''); setJob(null); setChosen(''); setReceipt(null);
    selectionSent.current = '';
    const handledNonce = jobImportNonce.current;
    jobImportNonce.current = undefined;
    if (handledNonce !== undefined) onImportHandled?.(handledNonce);
    setMessage('Referencia local descartada; comprueba el servidor antes de iniciar otra búsqueda.');
  }

  async function select(item: Result) {
    if (busy) return;
    setBusy(true); setMessage(''); setChosen(item.label);
    try {
      await request(`/telegram/search/${encodeURIComponent(jobId)}/select`, {
        method: 'POST', body: JSON.stringify({ result_id: item.id, accepts_group_publication: true,
          accepts_uncertainty: item.relation === 'indeterminado', rights_confirmed: true, auto_download: true }),
      });
      selectionSent.current = jobId;
      setJob(previous => previous ? { ...previous, state: 'selection_pending' } : previous);
      setMessage(`Enviando «${item.label}»…`);
    } catch {
      selectionSent.current = '';
      setMessage('No se confirmó la selección. Comprueba el estado antes de repetirla.');
    } finally { setBusy(false); }
  }

  async function clear() {
    if (!window.confirm('¿Cerrar esta solicitud? Si hubo un resultado incierto, comprueba primero el grupo de Telegram.')) return;
    setBusy(true);
    try {
      await request(`/telegram/search/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
      sessionStorage.removeItem(storageKey);
      setJobId(''); setJob(null); setChosen(''); setReceipt(null); setMessage('');
      selectionSent.current = '';
      const handledNonce = jobImportNonce.current;
      jobImportNonce.current = undefined;
      if (handledNonce !== undefined) onImportHandled?.(handledNonce);
    } catch { setMessage('No se pudo cerrar la solicitud; revisa su estado.'); }
    finally { setBusy(false); }
  }

  async function approveReceipt() {
    if (!receipt) return;
    setBusy(true); setMessage('');
    try {
      await request(`/telegram/search/${encodeURIComponent(jobId)}/approve-receipt`, {
        method: 'POST', body: JSON.stringify({ receipt_id: receipt.id, recognized: true, rights_confirmed: true }),
      });
      setJob(previous => previous ? { ...previous, state: 'download_pending' } : previous);
    } catch { setMessage('No se confirmó la descarga. Comprueba el estado antes de repetirla.'); }
    finally { setBusy(false); }
  }

  const terminal = job && ['completed', 'failed', 'expired', 'uncertain', 'selection_verified', 'callback_confirmed', 'receipt_pending', 'quarantined', 'validated', 'published'].includes(job.state);
  const progress = Math.max(0, Math.min(100, job?.progress ?? 0));
  const autoWorking = !!job?.auto_selected && !!job.selection
    && !['completed', 'failed', 'expired', 'uncertain', 'published'].includes(job.state);
  const descriptions: Record<string, string> = {
    pending: 'Esperando al puente de Windows.', claimed: 'Buscando en Telegram…',
    completed: 'Elige la canción que reconozcas.',
    selection_pending: 'Selección enviada al puente.', selection_claimed: 'Comprobando el mensaje y el botón…',
    callback_confirmed: 'Telegram respondió al botón. Esto no confirma que el audio haya llegado.',
    receipt_pending: 'El audio recibido no coincide con la opción elegida; requiere comprobación.',
    download_pending: 'Preparando la descarga automática…', download_claimed: 'Descargando…',
    quarantined: 'El archivo no superó la validación MP3 (por ejemplo, era M4A/MP4) y quedó en cuarentena. No se añadió a la biblioteca; cierra esta solicitud y elige otra opción.',
    validated: 'Audio MP3 decodificado sin errores en aislamiento. Sigue en cuarentena y no está en la biblioteca.',
    published: 'Importación completada.',
    selection_verified: 'Botón comprobado; aún no se ha pulsado.',
    failed: 'La búsqueda no se completó.', expired: 'La solicitud caducó.',
    uncertain: 'Resultado incierto: revisa el grupo antes de volver a intentar.',
  };

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
      {importTarget && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Importación automática desde YouTube</p>
          <p className="mt-1 break-words text-sm font-semibold text-zinc-100">{importTarget.title}</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {importTarget.artist || 'Artista desconocido'} · se buscará en Telegram la mejor coincidencia MP3.
          </p>
        </div>
      )}
      {!compact && <form onSubmit={search} className="flex flex-wrap gap-2">
        <input aria-label="Buscar canción en Telegram" value={query} onChange={event => setQuery(event.target.value)}
          maxLength={200} disabled={!!jobId || busy} placeholder="Artista o canción"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-400 disabled:opacity-50" />
        <button disabled={busy || !!jobId || !query.trim()} className="min-h-10 rounded-lg bg-emerald-400 px-4 text-sm font-bold text-zinc-950 disabled:opacity-40">Buscar</button>
      </form>}
      {jobId && <p className="text-xs text-zinc-400" aria-live="polite">{job ? descriptions[job.state] || 'Estado no reconocido; comprueba el servidor.' : 'Consultando estado…'}</p>}
      {autoWorking && job?.selection && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200" aria-live="polite">
          <span className="font-semibold">Elegida automáticamente:</span> {job.selection.label}
        </p>
      )}
      {chosen && job && job.state !== 'completed' && !autoWorking && <p className="text-xs text-zinc-300">Elegida: {chosen}</p>}
      {job?.state === 'completed' && (
        <div className="space-y-2">
          {!job.results?.length && <p className="text-xs text-zinc-400">No se observaron resultados compatibles.</p>}
          {!!job.results?.length && importTarget && <p className="text-xs text-amber-300">No hubo una coincidencia automática suficientemente segura. Elige manualmente la canción correcta.</p>}
          {!!job.results?.length && <p className="text-xs text-zinc-400">Pulsa la canción que reconozcas. La descarga comenzará automáticamente.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {job.results?.map(item => {
              const line = matchingLine(item);
              const numeric = /^\d{1,3}$/.test(item.label);
              return (
                <button key={item.id} type="button" onClick={() => void select(item)} disabled={busy}
                  className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-100 transition hover:border-emerald-500 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-40">
                  <span className="block break-words font-semibold">{line || (numeric ? `Botón ${item.label}` : item.label)}</span>
                  {line && <span className="mt-0.5 block text-[11px] text-zinc-500">Botón {item.label}</span>}
                  {item.relation === 'indeterminado' && <span className="mt-0.5 block text-[11px] text-amber-300">Relación con la búsqueda no comprobada</span>}
                </button>
              );
            })}
          </div>
          {!!job.results?.length && <p className="text-[11px] leading-relaxed text-zinc-500">Al pulsar aceptas que el bot puede publicar el audio en el grupo y declaras que tienes autorización para conservarlo. Si el título recibido no coincide, se pedirá una comprobación antes de descargar.</p>}
        </div>
      )}
      {job?.state === 'download_claimed' && <div className="space-y-1" aria-live="polite">
        <div className="flex items-center justify-between text-xs text-zinc-300"><span>{progress >= 100 ? 'Validando y publicando…' : 'Descargando…'}</span><span>{progress}%</span></div>
        <div className="h-2 overflow-hidden rounded bg-zinc-800" role="progressbar" aria-label="Progreso de descarga"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>}
      {job?.state === 'receipt_pending' && receipt && <div className="rounded-lg border border-zinc-700 p-3 text-xs leading-relaxed text-zinc-300">
        <p className="font-semibold text-zinc-100">Audio observado: {receipt.title || 'Sin título'}</p>
        <p className="mt-1">Mensaje {receipt.message_id} · {(receipt.size / 1048576).toFixed(2)} MiB · {receipt.mime_type}</p>
        <p className="mt-2 text-amber-300">No se pudo comprobar automáticamente que corresponda a tu selección; el título y el remitente no prueban la identidad ni la licencia.</p>
        <div className="mt-3 space-y-2">
          <p className="text-zinc-400">Al descargar confirmas que reconoces el candidato, aceptas esta incertidumbre y tienes autorización para descargar y conservar este archivo concreto.</p>
          <button type="button" onClick={() => void approveReceipt()} disabled={busy}
            className="min-h-10 rounded-lg bg-emerald-400 px-4 font-bold text-zinc-950 disabled:opacity-40">Descargar este audio</button>
        </div>
      </div>}
      {message && <p className="text-xs text-amber-300" role="alert">{message}</p>}
      <div className="flex flex-wrap gap-4">
        <button type="button" onClick={() => void recover()} disabled={busy} className="min-h-10 text-xs text-zinc-400 underline hover:text-white disabled:opacity-40">Recuperar solicitud</button>
        {jobId && !job && <button type="button" onClick={forgetLocalReference} disabled={busy} className="min-h-10 text-xs text-zinc-400 underline hover:text-white disabled:opacity-40">Descartar referencia local</button>}
      </div>
      {terminal && <button type="button" onClick={() => void clear()} disabled={busy} className="min-h-10 text-xs text-zinc-400 underline hover:text-white disabled:opacity-40">Cerrar y buscar otra</button>}
    </div>
  );
}
