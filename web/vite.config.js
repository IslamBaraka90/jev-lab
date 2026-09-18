import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The dashboard. `npm run dev:web` serves it with hot reload and forwards /api to the Express server
// (`npm run dev`); `npm run build` writes web/dist, which `npm start` serves.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
