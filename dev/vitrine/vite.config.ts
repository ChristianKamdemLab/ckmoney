// Vitrine de l'appli (données inventées) pour l'agent UX : npx vite --config dev/vitrine/vite.config.ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import base from '../../tailwind.config.js';
const root = path.resolve(__dirname, '../..');
export default defineConfig({
  root,
  plugins: [react()],
  optimizeDeps: { entries: ['dev/vitrine/index.html'] },
  server: { port: 5179, host: '127.0.0.1' },
  css: { postcss: { plugins: [tailwindcss({ ...base, content: [...base.content.map((c: string) => path.resolve(root, c)), path.resolve(root, 'dev/vitrine/*.tsx')] }), autoprefixer()] } },
  resolve: { alias: [
    { find: /^.*services\/eventService$/, replacement: path.resolve(root, 'dev/vitrine/mockEvents.ts') },
    { find: /^.*services\/loanService$/, replacement: path.resolve(root, 'dev/vitrine/mockLoan.ts') },
    { find: /^.*services\/filmService$/, replacement: path.resolve(root, 'dev/vitrine/mockFilms.ts') },
    { find: /^.*services\/vendrediService$/, replacement: path.resolve(root, 'dev/vitrine/mockVendredi.ts') },
    { find: /^.*services\/infoService$/, replacement: path.resolve(root, 'dev/vitrine/mockInfo.ts') },
    { find: /^.*services\/decryptageService$/, replacement: path.resolve(root, 'dev/vitrine/mockDecryptage.ts') },
    { find: /^.*services\/pronoService$/, replacement: path.resolve(root, 'dev/vitrine/mockPronos.ts') },
    { find: /^.*services\/radioService$/, replacement: path.resolve(root, 'dev/vitrine/mockRadio.ts') },
    { find: /^.*services\/push$/, replacement: path.resolve(root, 'dev/vitrine/mockPush.ts') },
    { find: /^.*services\/notificationService$/, replacement: path.resolve(root, 'dev/vitrine/mockNotif.ts') },
    { find: /^.*services\/profileService$/, replacement: path.resolve(root, 'dev/vitrine/mockProfile.ts') },
    { find: /^.*services\/articleService$/, replacement: path.resolve(root, 'dev/vitrine/mockArticles.ts') },
    { find: /^.*services\/jamboOnline\.real$/, replacement: path.resolve(root, 'services/jamboOnline.ts') },
    { find: /^.*services\/jamboOnline$/, replacement: path.resolve(root, 'dev/vitrine/mockJamboOnline.ts') },
    { find: /^.*services\/bacOnline\.real$/, replacement: path.resolve(root, 'services/bacOnline.ts') },
    { find: /^.*services\/bacOnline$/, replacement: path.resolve(root, 'dev/vitrine/mockBac.ts') },
    { find: /^.*services\/wisemanOnline\.real$/, replacement: path.resolve(root, 'services/wisemanOnline.ts') },
    { find: /^.*services\/wisemanOnline$/, replacement: path.resolve(root, 'dev/vitrine/mockWiseman.ts') },
    { find: /^.*_lib\/admin\.js$/, replacement: path.resolve(root, 'dev/vitrine/fakeAdmin.ts') },
  ] },
});
