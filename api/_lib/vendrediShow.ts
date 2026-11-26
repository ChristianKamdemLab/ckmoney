import { adminAuth, adminDb, authorEmail, pushToUser } from './admin.js';
import { pageImage } from './radioMeta.js';
import { nextFriday, cleanId } from '../../utils/vendredi.js';
import { cleanShowInput, ShowChoice } from '../../utils/vendrediShow.js';

// Actions « show.* » de /api/events : Vendredi Show (voir utils/vendrediShow.ts).
// Firestore : vendrediShow/{date du vendredi} = { choices: [ajouts de la semaine], picks: { uid: choix } }.

const shows = () => adminDb.collection('vendrediShow');
const MAX_ADDED = 15;
const first = (s: string) => (s || '').trim().split(/\s+/)[0] || '';

const nameOf = async (uid: string, fallback = '') => {
  const p = (await adminDb.collection('profiles').doc(uid).get()).data();
  return first(p?.fullName || fallback) || 'Un proche';
};
let christianUid: string | null = null;
const christian = async () => {
  if (christianUid) return christianUid;
  try { christianUid = (await adminAuth.getUserByEmail(authorEmail())).uid; } catch { christianUid = ''; }
  return christianUid;
};

/** La photo d'un lieu recommandé, tirée de son lien une fois (puis gardée). */
const placeImage = async (ref: any, p: any) => {
  if (typeof p.image === 'string') return p.image;
  let img = '';
  try { img = p.url ? await Promise.race([pageImage(p.url), new Promise<string>(r => setTimeout(() => r(''), 4000))]) : ''; } catch { img = ''; }
  await ref.set({ image: img }, { merge: true }).catch(() => undefined);
  return img;
};

const build = async (uid: string, admin: boolean) => {
  const date = nextFriday();
  const ref = shows().doc(date);
  const d = (await ref.get()).data() || { choices: [], picks: {}, names: {} };
  const picks: Record<string, string> = d.picks || {};
  const names: Record<string, string> = d.names || {};
  const goingTo = (id: string) => Object.entries(picks).filter(([, c]) => c === id).map(([u]) => names[u] || 'Un proche');
  const host = await christian();
  const placeSnap = await adminDb.collection('places').get();
  const base: any[] = [];
  for (const doc of placeSnap.docs) {
    const p = doc.data();
    base.push({ id: `p_${doc.id}`, kind: 'place', name: p.name, sub: p.budget || '', review: p.review || '', address: p.address || '', url: p.url || '', image: await placeImage(doc.ref, p), mine: false });
  }
  base.push({ id: 'home_christian', kind: 'home', name: 'Chill chez Christian', sub: 'Chill à domicile', address: '', url: '', image: '', hostUid: host, mine: false });
  const added = (d.choices || []).map((c: any) => ({ ...c, sub: c.kind === 'home' ? 'Chill à domicile' : `Proposé par ${c.byName}`, mine: c.byUid === uid }));
  const choices: ShowChoice[] = [...base, ...added].map((c: any) => {
    const going = goingTo(c.id);
    const me = picks[uid] === c.id;
    const seeAddress = c.kind !== 'home' || me || c.hostUid === uid || admin;
    return { id: c.id, kind: c.kind, name: c.name, sub: c.sub, review: c.review, address: seeAddress ? c.address || '' : '', url: c.url || '', image: c.image || '', hostUid: c.hostUid, mine: c.mine, going, me };
  });
  return { show: { date, choices, canHome: !(d.choices || []).some((c: any) => c.kind === 'home' && c.byUid === uid) && uid !== host, admin }, ref, d };
};

export const showActions = async (body: any, who: { uid: string; name?: string }, admin: boolean): Promise<{ status: number; json: any }> => {
  const a = String(body.action);
  const now = new Date().toISOString();

  if (a === 'show.get') return { status: 200, json: { show: (await build(who.uid, admin)).show } };

  if (a === 'show.pick') {
    const { show, ref } = await build(who.uid, admin);
    const id = body.choice ? cleanId(body.choice) : '';
    const target = id ? show.choices.find(c => c.id === id) : null;
    if (id && !target) return { status: 404, json: { error: 'introuvable' } };
    const me = await nameOf(who.uid, who.name);
    let prev = '';
    await adminDb.runTransaction(async (tx: any) => {
      const d = (await tx.get(ref)).data() || {};
      const picks = { ...(d.picks || {}) };
      prev = picks[who.uid] || '';
      if (id) picks[who.uid] = id; else delete picks[who.uid];
      tx.set(ref, { picks, names: { ...(d.names || {}), [who.uid]: me }, updatedAt: now }, { merge: true });
    });
    // Seul l'hôte d'un chill à domicile est prévenu, une fois par venue
    if (target?.kind === 'home' && target.hostUid && target.hostUid !== who.uid && prev !== id) {
      await pushToUser(target.hostUid, { title: 'Vendredi Show', body: `${me} vient chill chez toi vendredi soir.`, url: '/?vendredi', tag: `show-${show.date}-${who.uid}` }).catch(() => 0);
    }
    return { status: 200, json: { show: (await build(who.uid, admin)).show } };
  }

  if (a === 'show.add') {
    const input = cleanShowInput(body);
    if (!input) return { status: 400, json: { error: 'invalid' } };
    const { show, ref, d } = await build(who.uid, admin);
    if ((d.choices || []).length >= MAX_ADDED) return { status: 409, json: { error: 'complet' } };
    if (input.kind === 'home' && !show.canHome) return { status: 409, json: { error: 'deja' } };
    const me = await nameOf(who.uid, who.name);
    let image = '';
    if (input.kind === 'place' && input.url) {
      try { image = await Promise.race([pageImage(input.url), new Promise<string>(r => setTimeout(() => r(''), 5000))]); } catch { image = ''; }
    }
    const choice = {
      id: `${input.kind === 'home' ? 'h' : 'l'}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      kind: input.kind, name: input.kind === 'home' ? `Chill chez ${me}` : input.name, address: input.address, url: input.url, image,
      byUid: who.uid, byName: me, ...(input.kind === 'home' ? { hostUid: who.uid } : {}), at: now,
    };
    await ref.set({ date: show.date, choices: [...(d.choices || []), choice], updatedAt: now }, { merge: true });
    return { status: 200, json: { show: (await build(who.uid, admin)).show } };
  }

  if (a === 'show.remove') {
    const id = cleanId(body.id);
    const { show, ref, d } = await build(who.uid, admin);
    const c = (d.choices || []).find((x: any) => x.id === id);
    if (!c) return { status: 404, json: { error: 'introuvable' } };
    if (c.byUid !== who.uid && !admin) return { status: 403, json: { error: 'forbidden' } };
    const picks = { ...(d.picks || {}) };
    const went = Object.keys(picks).filter(u => picks[u] === id);
    went.forEach(u => delete picks[u]);
    await ref.set({ choices: (d.choices || []).filter((x: any) => x.id !== id), picks, updatedAt: now }, { merge: true });
    if (c.kind === 'home') {
      await Promise.all(went.filter(u => u !== who.uid).map(u => pushToUser(u, { title: 'Vendredi Show', body: `${c.name} est annulé. Choisis un autre plan pour vendredi.`, url: '/?vendredi', tag: `show-${show.date}-off` }).catch(() => 0)));
    }
    return { status: 200, json: { show: (await build(who.uid, admin)).show } };
  }
  return { status: 400, json: { error: 'action' } };
};
