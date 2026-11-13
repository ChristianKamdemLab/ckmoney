import { adminAuth, adminDb, isAdmin, pushToUser } from './_lib/admin.js';
import { fetchMeta } from './_lib/radioMeta.js';
import { cleanReco, cleanComment, isReaction, RadioItem, RadioComment } from '../utils/radio.js';

// /api/radio — Radio CK : les podcasts et vidéos que Christian recommande. Comptes CKMoney seulement
// (pas les invités des jeux). La collection Firestore « radio » reste fermée : tout passe par ici.
//  list                          les recos, du plus récent au plus ancien, avec les réactions
//  get {id}                      une reco et ses commentaires
//  react {id, emoji|null}        une réaction par personne (on peut la changer ou l'enlever)
//  comment {id, text}            commenter (30 par jour au plus) ; Christian est prévenu
//  uncomment {id, commentId}     retirer son commentaire (Christian peut retirer n'importe lequel)
//  preview {url} · save {item, notify} · delete {id}      Christian seulement

const col = () => adminDb.collection('radio');
const cleanId = (v: unknown) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
const firstName = (s: unknown) => String(s || '').trim().split(/\s+/)[0].replace(/[<>]/g, '').slice(0, 30);
const MAX_PER_DAY = 30;

const toItem = (id: string, d: any, uid: string, author: boolean): RadioItem => {
  const reactions: Record<string, number> = {};
  Object.values(d.reactions || {}).forEach((e: any) => { reactions[e] = (reactions[e] || 0) + 1; });
  return {
    id, url: d.url, platform: d.platform, kind: d.kind, embedUrl: d.embedUrl || '', title: d.title, show: d.show || '', thumbnail: d.thumbnail || '',
    comment: d.comment || '', publishedAt: d.publishedAt, updatedAt: d.updatedAt, by: d.authorName || '',
    reactions, myReaction: (d.reactions || {})[uid] || null, commentCount: d.commentCount || 0,
    ...(author ? { notified: !!d.notifiedAt } : {}),
  };
};

const pushAll = async (msg: { title: string; body: string; url: string; tag: string }, except: string) => {
  const uids = (await adminDb.collection('pushTokens').get()).docs.map((d: any) => d.id).filter((u: string) => u !== except);
  const sent = await Promise.all(uids.map((u: string) => pushToUser(u, msg).catch(() => 0)));
  return sent.filter((n: number) => n > 0).length;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  let who: any;
  try { who = await adminAuth.verifyIdToken((req.headers.authorization || '').replace(/^Bearer /, '')); }
  catch { return res.status(401).json({ error: 'unauthorized' }); }
  if (who.firebase?.sign_in_provider === 'anonymous') return res.status(403).json({ error: 'forbidden' });
  const author = isAdmin(who.email, who.email_verified === true);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const now = new Date().toISOString();

    if (body.action === 'list') {
      const snap = await col().orderBy('publishedAt', 'desc').limit(100).get();
      return res.status(200).json({ items: snap.docs.map((d: any) => toItem(d.id, d.data(), who.uid, author)), author });
    }

    const id = cleanId(body.id);
    const ref = id ? col().doc(id) : null;

    if (body.action === 'get') {
      const d = ref ? (await ref.get()).data() : null;
      if (!d) return res.status(404).json({ error: 'introuvable' });
      const cs = await ref!.collection('comments').orderBy('at', 'asc').limit(300).get();
      const comments: RadioComment[] = cs.docs.map((c: any) => {
        const x = c.data();
        return { id: c.id, name: x.name, text: x.text, at: x.at, mine: x.uid === who.uid, canDelete: x.uid === who.uid || author };
      });
      return res.status(200).json({ item: toItem(id, d, who.uid, author), comments });
    }

    if (body.action === 'react') {
      if (!ref) return res.status(400).json({ error: 'id' });
      const emoji = body.emoji === null ? null : isReaction(body.emoji) ? body.emoji : undefined;
      if (emoji === undefined) return res.status(400).json({ error: 'emoji' });
      const out = await adminDb.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const reactions = { ...(snap.data().reactions || {}) };
        if (emoji) reactions[who.uid] = emoji; else delete reactions[who.uid];
        tx.update(ref, { reactions });
        return toItem(id, { ...snap.data(), reactions }, who.uid, author);
      });
      return out ? res.status(200).json({ item: out }) : res.status(404).json({ error: 'introuvable' });
    }

    if (body.action === 'comment') {
      const text = cleanComment(body.text);
      if (!ref || !text) return res.status(400).json({ error: 'texte' });
      const d = (await ref.get()).data();
      if (!d) return res.status(404).json({ error: 'introuvable' });
      // Garde-fou : 30 commentaires par jour et par compte
      const day = now.slice(0, 10);
      const lim = adminDb.collection('radioLimits').doc(who.uid);
      const ok = await adminDb.runTransaction(async (tx: any) => {
        const l = (await tx.get(lim)).data();
        const n = l?.day === day ? l.n || 0 : 0;
        if (n >= MAX_PER_DAY) return false;
        tx.set(lim, { day, n: n + 1 });
        return true;
      });
      if (!ok) return res.status(429).json({ error: 'trop' });
      const profile = (await adminDb.collection('profiles').doc(who.uid).get()).data();
      const name = firstName(profile?.fullName) || firstName(who.name) || 'Un proche';
      const cref = await ref.collection('comments').add({ uid: who.uid, name, text, at: now });
      await adminDb.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        tx.update(ref, { commentCount: (snap.data()?.commentCount || 0) + 1 });
      });
      if (d.authorUid && d.authorUid !== who.uid) {
        await pushToUser(d.authorUid, { title: `${name} sur Radio CK`, body: `« ${text.slice(0, 120)} » · ${d.title}`.slice(0, 170), url: `/?radio=${id}`, tag: `radio-${id}-c` }).catch(() => 0);
      }
      const c: RadioComment = { id: cref.id, name, text, at: now, mine: true, canDelete: true };
      return res.status(200).json({ comment: c });
    }

    if (body.action === 'uncomment') {
      const cid = cleanId(body.commentId);
      if (!ref || !cid) return res.status(400).json({ error: 'id' });
      const cref = ref.collection('comments').doc(cid);
      const c = (await cref.get()).data();
      if (!c || !(c.uid === who.uid || author)) return res.status(404).json({ error: 'introuvable' });
      await cref.delete();
      await adminDb.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        tx.update(ref, { commentCount: Math.max(0, (snap.data()?.commentCount || 0) - 1) });
      });
      return res.status(200).json({ ok: true });
    }

    // Écriture : Christian seulement
    if (!author) return res.status(403).json({ error: 'not_author' });

    if (body.action === 'preview') {
      const meta = await fetchMeta(String(body.url || ''));
      return meta ? res.status(200).json({ meta }) : res.status(400).json({ error: 'lien' });
    }

    if (body.action === 'save') {
      const e = cleanReco(body.item);
      if (!e) return res.status(400).json({ error: 'invalid' });
      const eid = cleanId(body.item?.id);
      const r = eid ? col().doc(eid) : col().doc();
      const prev = eid ? (await r.get()).data() : null;
      if (eid && !prev) return res.status(404).json({ error: 'introuvable' });
      const profile = (await adminDb.collection('profiles').doc(who.uid).get()).data();
      const notifyNow = !!body.notify && !prev?.notifiedAt;
      await r.set({
        ...e, authorUid: who.uid, authorName: firstName(profile?.fullName) || firstName(who.name), updatedAt: now,
        ...(prev ? {} : { publishedAt: now, reactions: {}, commentCount: 0 }), ...(notifyNow ? { notifiedAt: now } : {}),
      }, { merge: true });
      const notified = notifyNow
        ? await pushAll({ title: `Radio CK · ${e.kind === 'video' ? 'nouvelle vidéo' : e.kind === 'musique' ? 'nouveau son' : 'nouveau podcast'}`, body: [e.title, e.show].filter(Boolean).join(' · ').slice(0, 170), url: `/?radio=${r.id}`, tag: `radio-${r.id}` }, who.uid)
        : 0;
      return res.status(200).json({ id: r.id, notified });
    }

    if (body.action === 'delete') {
      if (!ref) return res.status(400).json({ error: 'id' });
      await adminDb.recursiveDelete(ref);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e: any) {
    console.error('radio', e?.message);
    return res.status(500).json({ error: 'erreur' });
  }
}
