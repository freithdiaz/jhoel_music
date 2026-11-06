import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'offline-asset-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(file => /\.(?:js|css|woff2?|png|svg|webp)$/i.test(file));
      this.emitFile({ type: 'asset', fileName: 'offline-assets.json', source: JSON.stringify(files.map(file => `/${file}`)) });
    },
  }],
  server: {
    host: true, // Permite abrir desde el celular en la misma red Wi-Fi
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, '') || '/',
      },
    },
  },
});
