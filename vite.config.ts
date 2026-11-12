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
      // Pages : l'appli (index.html) et les jeux publics sans compte (jambo.html sur /jambo, bac.html sur /bac).
      build: {
        rollupOptions: {
          input: { main: path.resolve(__dirname, 'index.html'), jambo: path.resolve(__dirname, 'jambo.html'), bac: path.resolve(__dirname, 'bac.html') },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
