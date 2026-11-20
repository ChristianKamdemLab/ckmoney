import { adminDb, pushToUser } from './admin.js';
import { cleanPlace, cleanFriday, cleanId, tally, isOpen, isCurrent, parisDay, addDays, Friday } from '../../utils/vendredi.js';

// Actions « places.* » (Mes adresses) et « friday.* » (Mon vendredi soir) de /api/events.
// Lecture : tout compte CKMoney ; écriture : Christian, sauf le vote. Les votes restent anonymes :
// seuls les totaux sont renvoyés (et son propre vote à chacun).

const places = () => adminDb.collection('places');
const fridays = () => adminDb.collection('fridays');

const allTokens = async (except: string) => (await adminDb.collection('pushTokens').get()).docs.map((d: any) => d.id).filter((u: string) => u !== except);
const pushMany = async (uids: string[], msg: { title: string; body: string; url: string; tag: string }) =>
  (await Promise.all(uids.map(u => pushToUser(u, msg).catch(() => 0)))).filter(n => n > 0).length;

const view = (d: any, uid: string): Friday => {
  const counts = tally(d.votes || {}, d.options);
  return {
    date: d.date, intro: d.intro || '', decided: d.decided || null, myVote: (d.votes || {})[uid] || null,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    options: d.options.map((o: any) => ({ ...o, votes: counts[o.id] })),
  };
};

/** Le vendredi en cours (du lundi au samedi), ou null. */
const current = async (now = Date.now()) => {
  const from = addDays(parisDay(now), -1);
  const snap = await fridays().where('date', '>=', from).orderBy('date', 'asc').limit(3).get();
  return snap.docs.map((d: any) => d.data()).find((d: any) => isCurrent(d.date, now)) || null;
};

export const fridayActions = async (body: any, who: { uid: string }, admin: boolean): Promise<{ status: number; json: any }> => {
  const now = new Date().toISOString();
  const a = String(body.action);

  if (a === 'places.list') {
    const snap = await places().get();
    const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).sort((x: any, y: any) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
    return { status: 200, json: { places: list, admin } };
  }
  if (a === 'friday.get') {
    const d = await current();
    return { status: 200, json: { friday: d ? view(d, who.uid) : null, admin } };
  }
  if (a === 'friday.vote') {
    const date = String(body.date || '');
    const ref = fridays().doc(date.replace(/[^0-9-]/g, '').slice(0, 10) || 'x');
    const out = await adminDb.runTransaction(async (tx: any) => {
      const d = (await tx.get(ref)).data();
      if (!d || !isOpen(d.date) || d.decided) return null;
      const opt = body.option ? String(body.option) : null;
      if (opt && !d.options.some((o: any) => o.id === opt)) return null;
      const votes = { ...(d.votes || {}) };
      if (opt) votes[who.uid] = opt; else delete votes[who.uid];
      tx.update(ref, { votes });
      return view({ ...d, votes }, who.uid);
    });
    return out ? { status: 200, json: { friday: out } } : { status: 409, json: { error: 'ferme' } };
  }

  if (!admin) return { status: 403, json: { error: 'not_author' } };

  if (a === 'places.save') {
    const p = cleanPlace(body.place);
    if (!p) return { status: 400, json: { error: 'invalid' } };
    const id = cleanId(body.place?.id);
    const ref = id ? places().doc(id) : places().doc();
    await ref.set({ ...p, updatedAt: now, ...(id ? {} : { createdAt: now }) }, { merge: true });
    return { status: 200, json: { id: ref.id } };
  }
  if (a === 'places.delete') {
    await places().doc(cleanId(body.id) || 'x').delete();
    return { status: 200, json: { ok: true } };
  }
  if (a === 'friday.save') {
    const f = cleanFriday(body.friday);
    if (!f) return { status: 400, json: { error: 'invalid' } };
    const ref = fridays().doc(f.date);
    const prev = (await ref.get()).data();
    // Les options changent : les votes repartent de zéro (sauf simple correction de texte)
    const sameOptions = prev && JSON.stringify(prev.options.map((o: any) => o.name)) === JSON.stringify(f.options.map(o => o.name));
    await ref.set({ ...f, votes: sameOptions ? prev.votes || {} : {}, decided: null, updatedAt: now, ...(prev ? {} : { createdAt: now }), ...(prev?.notifiedAt ? { notifiedAt: prev.notifiedAt } : {}) });
    let notified = 0;
    if (body.notify && !prev?.notifiedAt) {
      await ref.update({ notifiedAt: now });
      notified = await pushMany(await allTokens(who.uid), {
        title: 'Vendredi soir : vote pour le lieu',
        body: `J'hésite entre ${f.options.map(o => o.name).join(', ').replace(/, ([^,]*)$/, ' et $1')}. Dis-moi où tu viendrais.`,
        url: '/?vendredi', tag: `vendredi-${f.date}`,
      });
    }
    return { status: 200, json: { date: f.date, notified } };
  }
  if (a === 'friday.decide') {
    const ref = fridays().doc(String(body.date || '').replace(/[^0-9-]/g, '').slice(0, 10) || 'x');
    const d = (await ref.get()).data();
    const opt = d?.options.find((o: any) => o.id === body.option);
    if (!d || !opt) return { status: 404, json: { error: 'introuvable' } };
    await ref.update({ decided: opt.id, decidedAt: now });
    // Ceux qui ont voté sont prévenus, une seule fois
    const voters = Object.keys(d.votes || {}).filter(u => u !== who.uid);
    const notified = d.decidedNotifiedAt ? 0 : await pushMany(voters, {
      title: `Vendredi soir : ce sera ${opt.name}`,
      body: opt.address ? `${opt.name}, ${opt.address}. Merci pour ton vote !` : 'Merci pour ton vote !',
      url: '/?vendredi', tag: `vendredi-${d.date}`,
    });
    if (!d.decidedNotifiedAt) await ref.update({ decidedNotifiedAt: now });
    return { status: 200, json: { friday: view({ ...d, decided: opt.id }, who.uid), notified } };
  }
  return { status: 400, json: { error: 'action' } };
};

export type { Friday };
