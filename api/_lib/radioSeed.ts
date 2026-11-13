import { adminAuth, adminDb, isAllowedLender } from './admin.js';
import { fetchMeta } from './radioMeta.js';
import { cleanReco } from '../../utils/radio.js';

// Recos Radio CK publiées d'un coup au nom de Christian (quand il envoie des liens dans la conversation),
// sans notification individuelle : l'annonce qui les publie envoie une seule notification.
// Identifiant fixe : une reco déjà là (ou supprimée ensuite par Christian) n'est pas recréée.

export interface RadioSeed { id: string; url: string; title?: string; show?: string; comment?: string }

export const importRadio = async (list: RadioSeed[], now = Date.now()) => {
  const users = (await adminAuth.listUsers(1000)).users;
  const author = users.find((u: any) => isAllowedLender(u.email, u.emailVerified === true));
  if (!author) throw new Error('auteur introuvable');
  const profile = (await adminDb.collection('profiles').doc(author.uid).get()).data();
  const authorName = String(profile?.fullName || author.displayName || '').trim().split(/\s+/)[0] || 'Christian';
  let added = 0, already = 0, invalid = 0;
  // Le premier de la liste est le plus récent (en tête de Radio CK)
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const ref = adminDb.collection('radio').doc(`seed-${s.id}`.slice(0, 40));
    if ((await ref.get()).exists) { already++; continue; }
    const meta = await fetchMeta(s.url).catch(() => null);
    const e = cleanReco({ url: s.url, kind: meta?.kind, title: s.title || meta?.title, show: s.show || meta?.show, thumbnail: meta?.thumbnail, comment: s.comment || '' });
    if (!e) { invalid++; continue; }
    const at = new Date(now - i * 1000).toISOString();
    await ref.set({ ...e, authorUid: author.uid, authorName, publishedAt: at, updatedAt: at, notifiedAt: at, reactions: {}, commentCount: 0 });
    added++;
  }
  return { added, already, invalid };
};

/** Liens envoyés par Christian le 13/11/2026 pour lancer Radio CK (« pourquoi je le recommande » à écrire par lui). */
export const RADIO_LANCEMENT: RadioSeed[] = [
  { id: 'nectar-markovits', url: 'https://open.spotify.com/episode/5dWGmuYROwG8m31JcOX9PV', title: '007 | The Meritocracy Trap - Daniel Markovits', show: 'Le Nectar' },
  { id: 'heure-du-monde-lfi', url: 'https://open.spotify.com/episode/5jcKC7qE3mmpiwIV0b1fHN', title: 'L’avenir selon La France insoumise : l’analyse du programme de Jean-Luc Mélenchon', show: "L'Heure du Monde" },
  { id: 'yt-TiQDz7-irPo', url: 'https://youtu.be/TiQDz7-irPo' },
];
