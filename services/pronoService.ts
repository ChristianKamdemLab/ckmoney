import { callApi } from './push';
import { PronoMatch, Pick } from '../utils/pronos';

// Pronos foot : tout passe par /api/radio (actions « pronos.* »), collections fermées côté Firestore.

const call = async (body: object) => {
  const r = await callApi('/api/radio', body);
  if (r.status !== 200) throw new Error((r.data as any)?.error || String(r.status));
  return r.data as any;
};

export const listPronos = async (): Promise<PronoMatch[]> => (await call({ action: 'pronos.list' })).matches || [];
export const savePick = async (matchId: string, pick: Pick | null, home?: number, away?: number): Promise<PronoMatch> =>
  (await call({ action: 'pronos.pick', matchId, pick, ...(home !== undefined ? { home, away } : {}) })).match;
