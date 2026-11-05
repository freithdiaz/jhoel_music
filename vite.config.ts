import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Permite abrir desde el celular en la misma red Wi-Fi
    port: 5173,
  },
});

