import { adminDb, pushToUser } from './admin.js';

// Annonces : une notification envoyée une seule fois, à l'heure prévue, à tous les appareils inscrits
// (l'appli installée avec les notifications activées). Les annonces sont écrites ici, dans le code :
// les mettre en ligne passe par une fusion validée par Christian.
// Déclenchement : GitHub Actions toutes les heures à :30 (.github/workflows/annonces.yml), et le cron
// du matin en secours. Une annonce n'est plus envoyée 6 h après son heure (pas de récap périmé).

export interface Announcement { id: string; sendAt: string; title: string; body: string; url: string }

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: '2026-11-13-nouveautes',
    sendAt: '2026-11-13T07:30:00.000Z', // 8 h 30 à Paris
    title: 'Du nouveau sur CKMoney',
    body: 'Nouvelle rubrique Sorties : événements, spots et chills à partager. Et les tables de jeu ont maintenant de vrais noms. À découvrir !',
    url: '/?sorties',
  },
];

const WINDOW = 6 * 3_600_000;

/** Envoie les annonces dues et pas encore parties. Renvoie, pour chacune, le nombre d'appareils touchés. */
export const sendDueAnnouncements = async (now = Date.now(), list = ANNOUNCEMENTS) => {
  const out: Record<string, number | string> = {};
  for (const a of list) {
    const at = Date.parse(a.sendAt);
    if (!(at <= now && now - at < WINDOW)) continue;
    const ref = adminDb.collection('announcementsSent').doc(a.id);
    // Un seul envoi, même si deux déclenchements arrivent en même temps
    const mine = await adminDb.runTransaction(async (tx: any) => {
      if ((await tx.get(ref)).exists) return false;
      tx.set(ref, { startedAt: new Date(now).toISOString() });
      return true;
    });
    if (!mine) { out[a.id] = 'déjà envoyée'; continue; }
    const uids = (await adminDb.collection('pushTokens').get()).docs.map((d: any) => d.id);
    const sent = await Promise.all(uids.map((u: string) => pushToUser(u, { title: a.title, body: a.body, url: a.url, tag: `annonce-${a.id}` }).catch(() => 0)));
    const people = sent.filter((n: number) => n > 0).length;
    await ref.set({ sentAt: new Date().toISOString(), people, devices: sent.reduce((s: number, n: number) => s + n, 0) }, { merge: true });
    out[a.id] = people;
  }
  return out;
};
