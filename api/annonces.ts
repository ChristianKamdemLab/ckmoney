import { sendDueAnnouncements } from './_lib/annonces.js';
import { sendOverdueRounds } from './_lib/reminders.js';
import { syncAllowed } from './_lib/syncSecret.js';
import { adminDb, adminAuth, authorEmail } from './_lib/admin.js';

// Envoi des e-mails un par un depuis Gmail : on laisse jusqu'à 60 s (maximum du plan gratuit).
export const config = { maxDuration: 60 };

// /api/annonces : envoie les annonces dues (voir api/_lib/annonces.ts). Sans effet hors de l'heure
// prévue, et une seule fois par annonce : on peut l'appeler sans risque.
/** Combien de comptes et d'appareils peuvent recevoir une notification (chiffres seulement). */
const pushStats = async () => {
  const docs = (await adminDb.collection('pushTokens').get()).docs;
  const me = await adminAuth.getUserByEmail(authorEmail()).catch(() => null);
  const n = (d: any) => (d.data()?.tokens || []).length;
  return { comptes: docs.filter((d: any) => n(d) > 0).length, appareils: docs.reduce((t: number, d: any) => t + n(d), 0), christian: me ? n(docs.find((d: any) => d.id === me.uid) || { data: () => ({}) }) : null };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  if (!syncAllowed(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    // Relance de retard : une par jour, au premier passage après 8 h
    const relances = await sendOverdueRounds().catch(e => { console.error('relances', e?.message); return { error: true }; });
    return res.status(200).json({ sent: await sendDueAnnouncements(), relances, push: await pushStats().catch(() => null) });
  } catch (e: any) {
    console.error('annonces', e?.message);
    return res.status(500).json({ error: 'erreur' });
  }
}
