import { sendDueAnnouncements } from './_lib/annonces.js';

// /api/annonces : envoie les annonces dues (voir api/_lib/annonces.ts). Sans effet hors de l'heure
// prévue, et une seule fois par annonce : on peut l'appeler sans risque.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  try {
    return res.status(200).json({ sent: await sendDueAnnouncements() });
  } catch (e: any) {
    console.error('annonces', e?.message);
    return res.status(500).json({ error: 'erreur' });
  }
}
