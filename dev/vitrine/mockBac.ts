import handler from '../../api/bac';
import { store, onChange } from './fakeAdmin';
export { bacLink } from '../../services/bacOnline.real';
export type { BacTable, BacSeat, AutoReject } from '../../services/bacOnline.real';
const me = new URLSearchParams(location.search).get('as') || 'ana';
export const callBac = async (uid: string, action: string, body: Record<string, unknown> = {}) => {
  let status = 200, json: any = {};
  const res: any = { status: (s: number) => { status = s; return res; }, json: (j: any) => { json = j; return res; }, end: () => res };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${uid}` }, body: { action, ...body } }, res);
  if (status !== 200) throw new Error(json.error || 'http');
  return json;
};
export const bac = (action: string, body: Record<string, unknown> = {}) => callBac(me, action, body);
export const watchBac = (code: string, cb: (t: any) => void) => { const f = () => { const v = store.get(`bacTables/${code}`); cb(v ? JSON.parse(JSON.stringify(v)) : null); }; f(); return onChange(f); };
(window as any).__bac = callBac;
(window as any).__store = store;
