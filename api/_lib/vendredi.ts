import { adminDb } from './admin.js';
import { placeImage } from './vendrediShow.js';
import { cleanPlace, cleanId } from '../../utils/vendredi.js';

// Actions « places.* » (Mes adresses) de /api/events. Lecture : tout compte CKMoney ; écriture : Christian.
// (L'ancien vote « Mon vendredi soir » a été remplacé par le Vendredi Show le 26/11, puis retiré le 27/11.)

const places = () => adminDb.collection('places');

export const placeActions = async (body: any, admin: boolean): Promise<{ status: number; json: any }> => {
  const now = new Date().toISOString();
  const a = String(body.action);

  if (a === 'places.list') {
    const snap = await places().get();
    // La photo du lieu (tirée de son lien, gardée ensuite) : aussi dans « Mes adresses » (27/11)
    const list = (await Promise.all(snap.docs.map(async (d: any) => ({ id: d.id, ...d.data(), image: await placeImage(d.ref, d.data()) }))))
      .sort((x: any, y: any) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
    return { status: 200, json: { places: list, admin } };
  }

  if (!admin) return { status: 403, json: { error: 'not_author' } };
  if (a === 'places.save') {
    const p = cleanPlace(body.place);
    if (!p) return { status: 400, json: { error: 'invalid' } };
    const id = cleanId(body.place?.id);
    const ref = id ? places().doc(id) : places().doc();
    const prev = id ? (await ref.get()).data() : null;
    // Lien changé : la photo sera relue au prochain affichage
    await ref.set({ ...p, updatedAt: now, ...(id ? {} : { createdAt: now }), ...(prev && prev.url !== p.url ? { image: null } : {}) }, { merge: true });
    return { status: 200, json: { id: ref.id } };
  }
  if (a === 'places.delete') {
    await places().doc(cleanId(body.id) || 'x').delete();
    return { status: 200, json: { ok: true } };
  }
  return { status: 400, json: { error: 'action' } };
};
