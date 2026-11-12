import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // Deux pages : l'appli (index.html) et le Jambo public sans compte (jambo.html, servi sur /jambo).
      build: {
        rollupOptions: {
          input: { main: path.resolve(__dirname, 'index.html'), jambo: path.resolve(__dirname, 'jambo.html') },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
