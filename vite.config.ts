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
      // Pages : l'appli (index.html) et les jeux publics sans compte (jambo.html sur /jambo, bac.html sur /bac, wiseman.html sur /wiseman) et la page publique d'un événement (evenement.html, servie sur /e/ID).
      build: {
        rollupOptions: {
          input: { main: path.resolve(__dirname, 'index.html'), jambo: path.resolve(__dirname, 'jambo.html'), bac: path.resolve(__dirname, 'bac.html'), wiseman: path.resolve(__dirname, 'wiseman.html'), evenement: path.resolve(__dirname, 'evenement.html') },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
