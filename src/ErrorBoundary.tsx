import React from 'react';
import { diagnosticsText, logDiagnostic } from './services/diagnostics';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logDiagnostic('app.render_error', {
      message: error.message,
      componentStack: info.componentStack?.slice(0, 300),
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#0b0d10] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-rose-500/40 bg-rose-950/20 p-5 space-y-3">
          <h1 className="text-lg font-bold text-rose-200">La aplicación encontró un error</h1>
          <p className="text-sm text-zinc-300 break-words">{this.state.error.message}</p>
          <p className="text-xs text-zinc-400">
            El detalle quedó guardado en el diagnóstico. Puedes recargar y, si vuelve a pasar, enviarnos el diagnóstico.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-10 rounded-lg bg-emerald-400 px-4 text-sm font-bold text-black"
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={() => {
                const text = diagnosticsText();
                void navigator.clipboard?.writeText(text).catch(() => {});
              }}
              className="min-h-10 rounded-lg border border-zinc-600 px-4 text-sm text-zinc-200"
            >
              Copiar diagnóstico
            </button>
          </div>
          <pre className="max-h-48 overflow-auto rounded-lg bg-black/40 p-2 text-[10px] text-zinc-400 whitespace-pre-wrap">
            {diagnosticsText().slice(-4000)}
          </pre>
        </div>
      </div>
    );
  }
}
