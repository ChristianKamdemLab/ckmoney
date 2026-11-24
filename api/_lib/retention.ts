import { adminDb } from './admin.js';
import { decryptageKeepFrom } from '../../utils/decryptage.js';

// Le moins de stockage possible (choix de Christian, 24/11) : l'actualité ne vit que 7 jours dans
// l'appli, les textes CKLabs de Christian (kind « own ») sont gardés sans limite.
// - revue de presse (kind « press ») : effacée 7 jours après son arrivée dans l'appli. Sa ligne dans
//   articleImports passe à « expired » pour que le PDF resté dans Drive ne soit jamais réimporté ;
// - info du jour (daily/{date}) : 7 jours ;
// - décryptage : le jour et la veille (texte ; l'audio est effacé par purgeDecryptage) ;
// - articleAudio : l'écoute des articles a été retirée le 24/11, tout est effacé.
// Au plus MAX suppressions par passage, pour rester dans le temps de la fonction.

export const KEEP_DAYS = 7;
const MAX = 60;

export const cutoffIso = (now = Date.now()) => new Date(now - KEEP_DAYS * 86_400_000).toISOString();
export const cutoffDate = (now = Date.now()) => cutoffIso(now).slice(0, 10);

/** Une fiche à effacer : de la revue de presse arrivée depuis plus de 7 jours. Jamais un texte CKLabs. */
export const isExpiredPress = (a: { kind?: string; createdAt?: string; updatedAt?: string }, now = Date.now()) =>
  a.kind === 'press' && !!(a.createdAt || a.updatedAt) && (a.createdAt || a.updatedAt)! < cutoffIso(now);

const deleteTree = async (ref: any, subs: string[]) => {
  for (const sub of subs) {
    const s = await ref.collection(sub).get();
    for (const d of s.docs) await d.ref.delete();
  }
  await ref.delete();
};

export const purgeOld = async (now = Date.now()) => {
  const out = { presse: 0, infos: 0, decryptages: 0, audiosArticles: 0 };
  let left = MAX;

  // Revue de presse
  const press = await adminDb.collection('articles').where('kind', '==', 'press').get();
  for (const d of press.docs) {
    if (left <= 0) break;
    const a = d.data();
    if (!isExpiredPress(a, now)) continue;
    if (a.importedFrom) await adminDb.collection('articleImports').doc(a.importedFrom).set({ status: 'expired', articleId: null, expiredAt: new Date(now).toISOString() }, { merge: true });
    await adminDb.collection('articleAudio').doc(d.id).delete().catch(() => 0);
    await d.ref.delete();
    out.presse++; left--;
  }

  // Info du jour
  const old = cutoffDate(now);
  for (const ref of await adminDb.collection('daily').listDocuments()) {
    if (left <= 0) break;
    if (ref.id < old) { await ref.delete(); out.infos++; left--; }
  }

  // Textes des décryptages plus anciens que la veille
  const keep = decryptageKeepFrom(now);
  for (const ref of await adminDb.collection('decryptage').listDocuments()) {
    if (left <= 0) break;
    if (ref.id < keep) { await ref.delete(); out.decryptages++; left--; }
  }

  // Audio des articles (fonction retirée)
  for (const ref of await adminDb.collection('articleAudio').listDocuments()) {
    if (left <= 0) break;
    await deleteTree(ref, ['chunks']);
    out.audiosArticles++; left--;
  }
  return out;
};
