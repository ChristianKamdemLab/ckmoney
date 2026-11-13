import { adminEmails, isAdminEmail } from './roles.js';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

// Accès serveur à Firebase, avec la clé de service rangée dans la variable Vercel
// FIREBASE_SERVICE_ACCOUNT (contenu JSON de la clé). Jamais exposée au navigateur.
const app = getApps()[0] || initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')),
});

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export const adminMessaging = getMessaging(app);

/** Envoie un push à tous les appareils d'un compte ; retire les jetons périmés. */
export const pushToUser = async (uid: string, msg: { title: string; body: string; url?: string; tag?: string }) => {
  const ref = adminDb.collection('pushTokens').doc(uid);
  const snap = await ref.get();
  const tokens: string[] = (snap.exists && snap.data()?.tokens) || [];
  if (!tokens.length) return 0;
  const res = await adminMessaging.sendEachForMulticast({
    tokens,
    data: { title: msg.title, body: msg.body, url: msg.url || '/', tag: msg.tag || '' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  });
  const dead = res.responses
    .map((r, i) => (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(r.error?.code || '') ? tokens[i] : null))
    .filter(Boolean) as string[];
  if (dead.length) await ref.set({ tokens: tokens.filter(t => !dead.includes(t)) }, { merge: true });
  return res.successCount;
};

/** Adresse e-mail d'un compte, seulement si elle est vérifiée (Google, ou lien de confirmation cliqué). */
export const verifiedEmail = async (uid?: string): Promise<string | undefined> => {
  if (!uid) return undefined;
  const u = await adminAuth.getUser(uid).catch(() => null);
  return u?.email && u.emailVerified ? u.email : undefined;
};

/** Administrateur (Christian) : publie articles, recos et annonces, voit la liste des comptes (voir roles.ts).
 *  Prêter est ouvert à tous les comptes. */
export { mailForAllLenders, lenderMailAllowed } from './roles.js';
/** Adresse de l'auteur (Christian). */
export const authorEmail = () => adminEmails()[0] || '';
export const isAdmin = (email?: string, emailVerified = true) => isAdminEmail(email, emailVerified);
/** Ancien nom (avant l'ouverture du prêt à tous) : même chose que isAdmin. */
export const isAllowedLender = isAdmin;
