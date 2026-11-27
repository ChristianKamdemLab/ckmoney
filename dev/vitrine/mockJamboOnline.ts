import handler from '../../api/jambo';
import { store, onChange } from './fakeAdmin';
export { tableLink, savedName, saveName, ERRORS } from '../../services/jamboOnline.real';
export type { Seat, OnlineTable } from '../../services/jamboOnline.real';
const me = new URLSearchParams(location.search).get('as') || 'ana';
export const ensurePlayer = async () => ({ uid: me, isAnonymous: true, displayName: null } as any);
export const call = async (uid: string, action: string, body: Record<string, unknown> = {}) => {
  let status = 200, json: any = {};
  const res: any = { status: (s: number) => { status = s; return res; }, json: (j: any) => { json = j; return res; }, end: () => res };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${uid}` }, body: { action, ...body } }, res);
  if (status !== 200) throw new Error(json.error || 'http');
  return json;
};
export const jambo = (action: string, body: Record<string, unknown> = {}) => call(me, action, body);
export const watchTable = (code: string, cb: (t: any) => void) => { const f = () => cb(store.get(`jamboTables/${code}`) ? JSON.parse(JSON.stringify(store.get(`jamboTables/${code}`))) : null); f(); return onChange(f); };
export const watchHand = (code: string, uid: string, cb: (c: any[]) => void) => { const f = () => cb(store.get(`jamboTables/${code}/hands/${uid}`)?.cards || []); f(); return onChange(f); };
(window as any).__call = call;
(window as any).__store = store;
