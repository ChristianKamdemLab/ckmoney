import { adminAuth, adminDb, isAdmin } from './admin.js';
import { fetchMeta } from './radioMeta.js';
import { cleanReco } from '../../utils/radio.js';

// Recos Radio CK publiées d'un coup au nom de Christian (quand il envoie des liens dans la conversation),
// sans notification individuelle : l'annonce qui les publie envoie une seule notification.
// Identifiant fixe : une reco déjà là (ou supprimée ensuite par Christian) n'est pas recréée.

export interface RadioSeed { id: string; url: string; title?: string; show?: string; comment?: string }

export const importRadio = async (list: RadioSeed[], now = Date.now()) => {
  const users = (await adminAuth.listUsers(1000)).users;
  const author = users.find((u: any) => isAdmin(u.email, u.emailVerified === true));
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

/** Complète « pourquoi je le recommande » d'une reco déjà publiée, seulement s'il est encore vide
 *  (une modification faite par Christian dans l'appli n'est jamais écrasée). */
export const fillRadioComments = async (list: { id: string; comment: string }[]) => {
  let filled = 0, kept = 0, missing = 0;
  for (const c of list) {
    const ref = adminDb.collection('radio').doc(`seed-${c.id}`.slice(0, 40));
    const d = (await ref.get()).data();
    if (!d) { missing++; continue; }
    if (String(d.comment || '').trim()) { kept++; continue; }
    await ref.set({ comment: String(c.comment).slice(0, 1500), updatedAt: new Date().toISOString() }, { merge: true });
    filled++;
  }
  return { filled, kept, missing };
};

/** Raison donnée par Christian à 14 h 39 pour L'Heure du Monde. */
export const HEURE_DU_MONDE_POURQUOI = "Le matin, sur le chemin du travail, c’est mon rendez-vous avec l’actualité. Pour s’informer en France, L’Heure du Monde est à mes yeux le meilleur podcast, parce qu’il traite tous les sujets sans prisme de droite ou de gauche (et, sur un sujet comme le programme d’un parti, c’est précisément ce que l’on cherche).\n\nÉcoutez, et dites-moi si vous trouvez qu’ils penchent d’un côté.";

/** Liens envoyés par Christian le 13/11/2026 pour lancer Radio CK. « Pourquoi je le recommande » rédigé dans sa voix à partir
 *  de ce qu'il a dit (méritocratie, monogamie) ; rien pour L'Heure du Monde, dont il n'a pas donné la raison. */
export const RADIO_LANCEMENT: RadioSeed[] = [
  { id: 'nectar-markovits', url: 'https://open.spotify.com/episode/5dWGmuYROwG8m31JcOX9PV', title: '007 | The Meritocracy Trap - Daniel Markovits', show: 'Le Nectar',
    comment: "Au moment où j’écris ces quelques lignes, on continue de nous vendre l’idée que si l’on travaille assez dur, on finit forcément par réussir, comme si nous partions tous de la même ligne de départ. Daniel Markovits, professeur de droit à Yale (donc, si l’on suit le mythe, un pur produit de la méritocratie), casse justement cette histoire : on ne naît pas tous avec les mêmes avantages, et le mérite que l’on célèbre ressemble souvent à un héritage qui ne dit pas son nom.\n\nEst-ce que celui qui a grandi avec des parents diplômés, un carnet d’adresses et des cours particuliers a vraiment le même mérite que celui qui a tout appris seul ? Écoutez, et dites-moi ce que vous en pensez." },
  { id: 'heure-du-monde-lfi', url: 'https://open.spotify.com/episode/5jcKC7qE3mmpiwIV0b1fHN', title: 'L’avenir selon La France insoumise : l’analyse du programme de Jean-Luc Mélenchon', show: "L'Heure du Monde" },
  { id: 'yt-TiQDz7-irPo', url: 'https://youtu.be/TiQDz7-irPo',
    comment: "Je sais qu’en lisant le sujet, certains vont lever les sourcils, mais suivez-moi. L’idée est simple : biologiquement, rien ne prouverait que l’homme ou la femme soit fait pour la monogamie, et la fidélité serait avant tout une conception de la société, qui d’ailleurs varie selon les régions du monde.\n\nPareil pour le mariage qui, à la base, servait surtout à réunir des familles, à conserver un héritage ou un rang social, voire à s’enrichir (l’amour ne serait arrivé que bien plus tard dans l’équation). Est-ce que cela veut dire qu’il faut tout jeter ? La question mérite au moins d’être posée, et je compte sur vos commentaires." },
];

/** Trois épisodes de L'Heure du Monde envoyés par Christian le 19/11/2026 (le plus récent en tête).
 *  « Pourquoi je le recommande » proposé dans sa voix et validé par lui à 14 h 40. */
export const RADIO_2026_11_19: RadioSeed[] = [
  { id: 'hdm-medias-extreme-droite', url: 'https://open.spotify.com/episode/03R28baSoTskT1ZlLgMYw7', title: 'Médias et extrême droite : histoire d’un glissement ?', show: "L'Heure du Monde",
    comment: "Au moment où l’on se demande qui fixe encore les limites de ce qui peut se dire à l’antenne, cet épisode revient sur les dérapages de plusieurs chaînes après les mobilisations d’octobre 2025, jusqu’à la lettre de l’Arcom du 22 octobre leur rappelant leur devoir d’informer de façon exacte. Est-ce que les plateaux suivent l’opinion, ou est-ce qu’ils la fabriquent ? Écoutez, et dites-moi ce que vous en pensez." },
  { id: 'hdm-gta-vi', url: 'https://open.spotify.com/episode/2ykPZzdnSIVt2pQAGBPIVT', title: 'Comment « GTA VI » est-il devenu le produit culturel le plus attendu de la décennie ?', show: "L'Heure du Monde",
    comment: "Un jeu vidéo qui rapporte plus d’un milliard de dollars avant même sa sortie, ça mérite qu’on s’y arrête, même quand on n’a jamais tenu une manette. L’épisode explique comment une série née en Écosse il y a trente ans a fini par faire de l’ombre à Hollywood (et, pour ceux qui veulent les chiffres, la synthèse du Monde est aussi dans la revue de presse)." },
  { id: 'hdm-inside-deutsche-bank', url: 'https://open.spotify.com/episode/6Eh82LUo8VJ6gCetCIS7EM', title: '« Inside Deutsche Bank » : plongée dans la banque aux mille scandales', show: "L'Heure du Monde",
    comment: "15,6 millions de documents et environ 230 journalistes pour raconter comment une des plus grandes banques du monde contournerait ses propres engagements, entre soupçons de blanchiment et clients sous sanctions. Pour qui s’intéresse à l’argent et à ceux qui le gardent, c’est une enquête à écouter jusqu’au bout. La question que je me pose : qui contrôle vraiment les banques ?" },
];
