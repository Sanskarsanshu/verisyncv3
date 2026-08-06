import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Dev-only: listen on all interfaces and accept any Host header so the app
    // works through Cloudflare Tunnel / ngrok and on a LAN. This does not affect
    // the production build (vite build ignores the `server` block).
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
});
