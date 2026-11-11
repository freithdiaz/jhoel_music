import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { installGlobalDiagnosticHandlers, logDiagnostic } from './services/diagnostics';
import './index.css';

installGlobalDiagnosticHandlers();
logDiagnostic('app.boot', { ua: navigator.userAgent, online: navigator.onLine, visibility: document.visibilityState });

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Vite de desarrollo no es una instalación offline. En producción se requiere HTTPS o localhost.
// En Capacitor la app ya está empaquetada; el SW puede interferir con assets locales.
if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => console.warn('No se pudo activar el modo offline:', error));
  });
}
