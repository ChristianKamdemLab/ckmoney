import { syncArticles } from './_lib/articleSync.js';
import { listFolder, downloadFile } from './_lib/drive.js';
import { generateAudios } from './_lib/voice.js';

// /api/articles-sync : l'agent Articles (voir api/_lib/articleSync.ts). Appelé toutes les heures par
// GitHub Actions ; sans effet s'il n'y a rien de nouveau dans le dossier Drive.
export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  try {
    const t0 = Date.now();
    const dry = String(req.query?.dry || '') === '1';
    const out: any = await syncArticles({ list: () => listFolder(), download: downloadFile }, new Date(), { dry });
    // Puis la voix : les fiches publiées sans audio, tant qu'il reste du temps (la fonction a 60 s)
    if (!dry) out.audio = await generateAudios({ budgetMs: Math.max(0, 40_000 - (Date.now() - t0)) });
    return res.status(200).json(out);
  } catch (e: any) {
    console.error('articles-sync', e?.message);
    return res.status(500).json({ error: String(e?.message || 'erreur').slice(0, 120) });
  }
}
