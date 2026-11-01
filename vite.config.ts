import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server pinned to 5175 — matches the API's AllowedOrigin config.
// /api and /gamehub are proxied to the Worldiator.Server dev instance
// (appsettings.json "Urls": http://localhost:5003), so the client can use
// relative URLs in both dev and production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:5003',
        changeOrigin: true,
      },
      '/gamehub': {
        target: 'http://localhost:5003',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
