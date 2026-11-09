import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getServerToken } from './services/authService';
import { TelegramSearch } from './TelegramSearch';
import { TelegramImported, Imported } from './TelegramImported';
import type { TelegramImportTarget } from './services/telegramImport';

type Status = 'idle' | 'checking' | 'preparing' | 'ready' | 'denied' | 'unavailable';
type Mode = 'full' | 'import' | 'library';

interface Props {
  username?: string;
  apiUrl: string;
  onPublished: (filename?: string) => void;
  onPlayImported: (item: Imported) => void;
  onAddImported: (item: Imported) => void;
  onDeletedImported: (filename: string) => void;
  importTarget?: TelegramImportTarget | null;
  onImportHandled?: (nonce?: number) => void;
  mode?: Mode;
}

/** Estado de integración: comprueba el puente al abrir y busca solo si el usuario eligió una canción. */
export function TelegramStatus({ username, apiUrl, onPublished, onPlayImported, onAddImported, onDeletedImported, importTarget, onImportHandled, mode = 'full' }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [refreshSignal, setRefreshSignal] = useState(0);

  async function check() {
    const token = username ? getServerToken(username, apiUrl) : null;
    if (!token) {
      setStatus('denied');
      return;
    }
    setStatus('checking');
    try {
      const response = await fetch(`${apiUrl}/telegram/status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 401 || response.status === 403) {
        setStatus('denied');
      } else if (!response.ok) {
        setStatus('unavailable');
      } else {
        const data: unknown = await response.json();
        if (typeof data !== 'object' || data === null || !('ready' in data) || typeof data.ready !== 'boolean') {
          setStatus('unavailable');
        } else {
          setStatus(data.ready ? 'ready' : 'preparing');
        }
      }
    } catch {
      setStatus('unavailable');
    }
  }

  useEffect(() => {
    void check();
    // El componente se remonta al cambiar de usuario o servidor (key en App).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, apiUrl]);

  useEffect(() => {
    if (importTarget && status === 'unavailable') void check();
    // Solo reintenta cuando llega una nueva canción; no crea un bucle de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importTarget?.nonce]);

  const message: Record<Status, string> = {
    idle: 'Comprobando la conexión con Telegram…',
    checking: 'Comprobando el servidor…',
    preparing: 'El servidor responde, pero la integración aún no está lista.',
    ready: 'Puente disponible para prueba; la conexión con Telegram aún debe comprobarse.',
    denied: 'Inicia sesión como operador autorizado; la integración también debe estar habilitada.',
    unavailable: 'No se pudo comprobar el estado del servidor.',
  };

  if (mode === 'import') {
    return (
      <section id="telegram-import" aria-label="Importación desde Telegram" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
        {status !== 'ready' && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-relaxed text-amber-200" aria-live="polite">
              <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
              {message[status]}
            </p>
            <button type="button" onClick={() => void check()} disabled={status === 'checking'}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
              Comprobar estado
            </button>
          </div>
        )}
        {status === 'ready' && username && (
          <TelegramSearch
            username={username}
            apiUrl={apiUrl}
            compact
            importTarget={importTarget}
            onImportHandled={onImportHandled}
            onPublished={(filename?: string) => { setRefreshSignal(value => value + 1); onPublished(filename); }}
          />
        )}
      </section>
    );
  }

  return (
    <section aria-label="Integración de Telegram" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Fuente personal</p>
          <h4 className="mt-1 text-sm font-bold text-zinc-100">Telegram · selección supervisada</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400" aria-live="polite">
            {status === 'ready' ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-400" /> :
              status === 'denied' || status === 'unavailable' ? <AlertCircle className="mr-1 inline h-3.5 w-3.5 text-amber-400" /> : null}
            {message[status]}
          </p>
          {status !== 'ready' && <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            La búsqueda y selección desde la app aún no están disponibles. El bot puede publicar audio en el grupo.
          </p>}
        </div>
        <button type="button" onClick={() => void check()} disabled={status === 'checking'}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
          Comprobar estado
        </button>
      </div>
      {mode === 'full' && status === 'ready' && username && (
        <TelegramSearch
          username={username}
          apiUrl={apiUrl}
          importTarget={importTarget}
          onImportHandled={onImportHandled}
          onPublished={(filename?: string) => { setRefreshSignal(value => value + 1); onPublished(filename); }}
        />
      )}
      <TelegramImported apiUrl={apiUrl} username={username} canDelete={status === 'ready'} onPlay={onPlayImported} onAdd={onAddImported} onDeleted={onDeletedImported} refreshSignal={refreshSignal} />
    </section>
  );
}
