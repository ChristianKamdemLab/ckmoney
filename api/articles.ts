import { adminAuth, adminDb, isAllowedLender } from './_lib/admin.js';
import { excerptOf, readMinutes } from '../utils/articleText.js';

// POST /api/articles — l'auteur (compte prêteur autorisé, e-mail vérifié) écrit ses articles.
//   { action: 'save', article: { id?, title, body, status, publishedAt? } }
//   { action: 'import', articles: [{ title, body, status?, publishedAt? }, …] }   (20 au plus)
//   { action: 'delete', id }
// La lecture se fait directement dans Firestore : réservée aux comptes connectés (voir firestore.rules).
// Les textes ne sont jamais dans le dépôt GitHub, qui est public.

const MAX_BODY = 200_000;
const isIso = (s: unknown) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

const clean = (a: any) => {
  const title = String(a?.title || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const body = String(a?.body || '').replace(/\r\n/g, '\n').trim();
  if (!title || !body || body.length > MAX_BODY) return null;
  const status: 'published' | 'draft' = a?.status === 'draft' ? 'draft' : 'published';
  return { title, body, status, publishedAt: isIso(a?.publishedAt) ? new Date(a.publishedAt).toISOString() : undefined };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  let caller;
  try { caller = await adminAuth.verifyIdToken((req.headers.authorization || '').replace(/^Bearer /, '')); }
  catch { return res.status(401).json({ error: 'unauthorized' }); }
  if (!isAllowedLender(caller.email, caller.email_verified === true)) return res.status(403).json({ error: 'not_author' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const col = adminDb.collection('articles');
    const now = new Date().toISOString();
    const profile = (await adminDb.collection('profiles').doc(caller.uid).get()).data();
    const authorName = profile?.fullName || caller.name || 'CKLabs';

    const write = async (input: ReturnType<typeof clean>, id?: string) => {
      if (!input) throw new Error('invalid');
      const ref = id ? col.doc(id) : col.doc();
      const prev = id ? (await ref.get()).data() : undefined;
      if (id && (!prev || prev.authorUid !== caller.uid)) throw new Error('forbidden');
      const publishedAt = input.status === 'published' ? (input.publishedAt || prev?.publishedAt || now) : (input.publishedAt || prev?.publishedAt || null);
      await ref.set({
        title: input.title, body: input.body, status: input.status,
        excerpt: excerptOf(input.body), readMinutes: readMinutes(input.body),
        publishedAt, updatedAt: now, authorUid: caller.uid, authorName,
        ...(prev ? {} : { createdAt: now }),
      }, { merge: true });
      return ref.id;
    };

    if (body.action === 'save') {
      const id = await write(clean(body.article), body.article?.id ? String(body.article.id) : undefined);
      return res.status(200).json({ id });
    }
    if (body.action === 'import') {
      const list = Array.isArray(body.articles) ? body.articles.slice(0, 20).map(clean) : [];
      if (!list.length || list.some((a: unknown) => !a)) return res.status(400).json({ error: 'invalid' });
      const ids = [];
      for (const a of list) ids.push(await write(a));
      return res.status(200).json({ ids });
    }
    if (body.action === 'delete') {
      const ref = col.doc(String(body.id || ''));
      const prev = (await ref.get()).data();
      if (!prev || prev.authorUid !== caller.uid) return res.status(404).end();
      await ref.delete();
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e: any) {
    const m = e?.message;
    console.error('articles', m);
    return res.status(m === 'invalid' ? 400 : m === 'forbidden' ? 403 : 500).json({ error: m || 'error' });
  }
}
