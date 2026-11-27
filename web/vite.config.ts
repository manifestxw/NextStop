import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Bundle shared/ from source so edits show up without rebuilding it.
    alias: { '@nextstop/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) },
  },
  build: { outDir: '../server/public', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
