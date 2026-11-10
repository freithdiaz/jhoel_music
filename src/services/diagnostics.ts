export type DiagnosticEntry = {
  time: number;
  event: string;
  detail: string;
};

const STORAGE_KEY = 'thomas_music_diagnostics_v1';
const MAX_ENTRIES = 120;
const MAX_DETAIL = 600;

function safeDetail(detail: unknown): string {
  if (detail === undefined || detail === null) return '';
  if (typeof detail === 'string') return detail.slice(0, MAX_DETAIL);
  if (typeof detail === 'number' || typeof detail === 'boolean') return String(detail);
  if (detail instanceof Error) {
    return `${detail.name}: ${detail.message}`.slice(0, MAX_DETAIL);
  }
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(detail, (key, value) => {
      if (typeof value === 'string') return value.slice(0, 200);
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[circular]';
        seen.add(value);
      }
      return value;
    }).slice(0, MAX_DETAIL);
  } catch {
    return '[detalle no serializable]';
  }
}

function readRaw(): DiagnosticEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DiagnosticEntry =>
      !!item && typeof item === 'object'
      && typeof item.time === 'number'
      && typeof item.event === 'string'
      && typeof item.detail === 'string').slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function logDiagnostic(event: string, detail?: unknown): void {
  try {
    const entries = readRaw();
    entries.push({ time: Date.now(), event: event.slice(0, 80), detail: safeDetail(detail) });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // El diagnóstico nunca debe interrumpir la reproducción.
  }
}

export function readDiagnostics(): DiagnosticEntry[] {
  return readRaw();
}

export function clearDiagnostics(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function diagnosticsText(): string {
  return readDiagnostics()
    .map(entry => `${new Date(entry.time).toISOString()}  ${entry.event}${entry.detail ? `  ${entry.detail}` : ''}`)
    .join('\n');
}

export function installGlobalDiagnosticHandlers(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', event => {
    logDiagnostic('window.error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });
  window.addEventListener('unhandledrejection', event => {
    logDiagnostic('promise.rejection', event.reason);
  });
  document.addEventListener('visibilitychange', () => {
    logDiagnostic('visibility', document.visibilityState);
  });
}
