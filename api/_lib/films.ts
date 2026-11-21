import { adminDb } from './admin.js';
import { cleanFilm } from '../../utils/films.js';
import { cleanId } from '../../utils/vendredi.js';

// Actions « films.* » de /api/events : lecture pour tout compte CKMoney, écriture pour Christian.
const col = () => adminDb.collection('films');

export const filmActions = async (body: any, admin: boolean): Promise<{ status: number; json: any }> => {
  const a = String(body.action);
  if (a === 'films.list') {
    const snap = await col().get();
    const films = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).sort((x: any, y: any) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
    return { status: 200, json: { films, admin } };
  }
  if (!admin) return { status: 403, json: { error: 'not_author' } };
  if (a === 'films.save') {
    const f = cleanFilm(body.film);
    if (!f) return { status: 400, json: { error: 'invalid' } };
    const id = cleanId(body.film?.id);
    const ref = id ? col().doc(id) : col().doc();
    const now = new Date().toISOString();
    await ref.set({ ...f, updatedAt: now, ...(id ? {} : { createdAt: now }) }, { merge: true });
    return { status: 200, json: { id: ref.id } };
  }
  if (a === 'films.delete') {
    await col().doc(cleanId(body.id) || 'x').delete();
    return { status: 200, json: { ok: true } };
  }
  return { status: 400, json: { error: 'action' } };
};
