import { syncArticles } from './_lib/articleSync.js';
import { listFolder, downloadFile } from './_lib/drive.js';
import { syncDecryptage, voiceDecryptage, purgeDecryptage } from './_lib/decryptage.js';
import { purgeOld } from './_lib/retention.js';
import { syncInfo } from './_lib/infoSync.js';
import { syncAllowed } from './_lib/syncSecret.js';
import { adminDb } from './_lib/admin.js';
import { takeLock, summarize } from './_lib/syncGuard.js';

// /api/articles-sync : l'agent Articles (voir api/_lib/articleSync.ts). Appelé toutes les heures par
// GitHub Actions ; sans effet s'il n'y a rien de nouveau dans le dossier Drive.
export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  // Déclenche des lectures Drive et la voix ElevenLabs (payante) : réservé au workflow GitHub
  if (!syncAllowed(req)) return res.status(401).json({ error: 'unauthorized' });
  // Route publique tant que le secret n'est pas configuré : un seul passage à la fois, et pas plus
  // d'un toutes les 45 s (on ne peut plus la faire tourner en boucle pour consommer la voix)
  const lockRef = adminDb.collection('settings').doc('syncLock');
  if (!(await takeLock(lockRef, Date.now()).catch(() => false))) return res.status(200).json({ skipped: 'déjà en cours ou passé il y a moins de 45 s' });
  try {
    const t0 = Date.now();
    const dry = String(req.query?.dry || '') === '1';
    const files = await listFolder();
    // « L'info du jour » d'abord : rapide, et attendue le matin
    const info = dry ? {} : await syncInfo(files, downloadFile).catch(e => ({ erreur: String(e?.message || e).slice(0, 80) }));
    const out: any = await syncArticles({ list: async () => files, download: downloadFile }, new Date(), { dry });
    out.info = info;
    // La lecture audio des articles a été retirée le 24/11 (choix de Christian : peu écoutée) ;
    // la voix sert désormais au « Décryptage du jour » : texte, puis voix dans le temps qui reste.
    if (!dry) {
      const txt = await syncDecryptage(files, downloadFile).catch(e => ({ erreur: String(e?.message || e).slice(0, 60) }));
      const voice = await voiceDecryptage({ budgetMs: Math.max(0, 42_000 - (Date.now() - t0)) }).catch(e => ({ erreur: String(e?.message || e).slice(0, 60) }));
      out.decryptage = { ...txt, ...voice };
      const purged = await purgeDecryptage().catch(() => 0);
      if (purged) out.decryptage.effacés = purged;
      const old = await purgeOld().catch(e => ({ erreur: String(e?.message || e).slice(0, 60) }));
      if (Object.values(old).some(v => v)) out.effacés = old;
    }
    await lockRef.set({ until: Date.now() + 45_000 }, { merge: true }).catch(() => undefined);
    // Jamais de noms de fichiers ni de titres dans la réponse : seulement des comptes
    return res.status(200).json(summarize(out));
  } catch (e: any) {
    await lockRef.set({ until: Date.now() + 45_000 }, { merge: true }).catch(() => undefined);
    console.error('articles-sync', e?.message);
    return res.status(500).json({ error: String(e?.message || 'erreur').slice(0, 120) });
  }
}
