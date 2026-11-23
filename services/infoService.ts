import { callApi } from './push';
import type { InfoDay } from '../utils/infoDuJour';

// « L'info du jour » : lue par /api/articles (action daily), gardée 5 minutes dans la page.
let cache: { at: number; p: Promise<InfoDay[]> } | null = null;

export const listInfo = (): Promise<InfoDay[]> => {
  if (!cache || Date.now() - cache.at > 300_000) {
    const p = callApi('/api/articles', { action: 'daily' }).then(r => {
      if (r.status !== 200) throw new Error(`http_${r.status}`);
      return (r.data?.days || []) as InfoDay[];
    });
    p.catch(() => { cache = null; });
    cache = { at: Date.now(), p };
  }
  return cache.p;
};
