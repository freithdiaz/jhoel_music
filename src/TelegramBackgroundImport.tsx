import { useEffect, useRef } from 'react';
import { getServerToken } from './services/authService';
import type { TelegramImportTarget } from './services/telegramImport';

type Job = { state: string; filename?: string };
export type BackgroundImportResult = { ok: boolean; filename?: string; state: string; target: TelegramImportTarget };

interface Props {
  username?: string;
  apiUrl: string;
  target: TelegramImportTarget | null;
  onFinished: (result: BackgroundImportResult) => void;
}

function newRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const ACTIVE = ['pending', 'claimed', 'selection_pending', 'selection_claimed',
  'callback_confirmed', 'download_pending'];

/** Importa en segundo plano una canción para AutoDJ; no muestra interfaz. */
export function TelegramBackgroundImport({ username, apiUrl, target, onFinished }: Props) {
  const generation = useRef(0);

  useEffect(() => {
    if (!target) return;
    const current = ++generation.current;
    let cancelled = false;
    let timer: number | undefined;
    let jobId = '';

    async function request(path: string, init: RequestInit = {}) {
      const token = username ? getServerToken(username, apiUrl) : null;
      if (!token) throw new Error('auth');
      const response = await fetch(`${apiUrl}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    }

    function finish(result: BackgroundImportResult, free = true) {
      if (cancelled || current !== generation.current) return;
      onFinished(result);
      if (free && jobId) {
        void request(`/telegram/search/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).catch(() => {});
      }
    }

    async function start() {
      jobId = newRequestId();
      try {
        const data = await request('/telegram/search', {
          method: 'POST',
          body: JSON.stringify({
            query: target.query,
            client_id: jobId,
            target: {
              title: target.title,
              artist: target.artist,
              album: target.album,
              duration: target.duration,
            },
            auto_select: true,
          }),
        });
        if (data.id !== jobId) throw new Error('invalid');
      } catch {
        finish({ ok: false, state: 'request', target }, false);
        return;
      }

      let polls = 0;
      const poll = async () => {
        if (cancelled || current !== generation.current) return;
        polls += 1;
        if (polls > 300) {
          finish({ ok: false, state: 'expired', target }, false);
          return;
        }
        let delay = 1000;
        try {
          const job: Job = await request(`/telegram/search/${encodeURIComponent(jobId)}`);
          if (ACTIVE.includes(job.state)) {
            delay = 1000;
          } else if (job.state === 'download_claimed') {
            delay = 600;
          } else {
            finish({ ok: job.state === 'published', filename: job.filename,
              state: job.state, target });
            return;
          }
        } catch {
          // No se reintenta una respuesta incierta: se libera la intención local
          // y el operador decide en la pantalla de importación si hace falta.
          finish({ ok: false, state: 'uncertain', target }, false);
          return;
        }
        timer = window.setTimeout(poll, delay);
      };
      void poll();
    }

    void start();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [target?.nonce, apiUrl, username]);

  return null;
}
