import handler from '../../api/wiseman';
import { store, onChange } from './fakeAdmin';
export { wisemanLink } from '../../services/wisemanOnline.real';
export type { WisemanTable, WisemanCard, WSeat } from '../../services/wisemanOnline.real';
const me = new URLSearchParams(location.search).get('as') || 'ana';
export const callW = async (uid: string, action: string, body: Record<string, unknown> = {}) => {
  let status = 200, json: any = {};
  const res: any = { status: (s: number) => { status = s; return res; }, json: (j: any) => { json = j; return res; }, end: () => res };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${uid}` }, body: { action, ...body } }, res);
  if (status !== 200) throw new Error(json.error || 'http');
  return json;
};
export const wiseman = (action: string, body: Record<string, unknown> = {}) => callW(me, action, body);
const watch = (path: string, cb: (v: any) => void) => { const f = () => { const v = store.get(path); cb(v ? JSON.parse(JSON.stringify(v)) : null); }; f(); return onChange(f); };
export const watchWiseman = (code: string, cb: (t: any) => void) => watch(`wisemanTables/${code}`, cb);
export const watchCard = (code: string, uid: string, cb: (c: any) => void) => watch(`wisemanTables/${code}/cards/${uid}`, cb);
(window as any).__w = callW;
(window as any).__store = store;
