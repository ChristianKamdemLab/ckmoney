import { callApi } from './push';
import { auth } from './firebase';
import type { Decryptage } from '../utils/decryptage';

// « Le décryptage du jour » : lu par /api/articles (action decryptage), gardé 2 minutes dans la page.
export type DecryptageDay = Decryptage & { minutes: number };
let cache: { at: number; p: Promise<DecryptageDay[]> } | null = null;

export const listDecryptage = (): Promise<DecryptageDay[]> => {
  if (!cache || Date.now() - cache.at > 120_000) {
    const p = callApi('/api/articles', { action: 'decryptage' }).then(r => {
      if (r.status !== 200) throw new Error(`http_${r.status}`);
      return (r.data?.days || []) as DecryptageDay[];
    });
    p.catch(() => { cache = null; });
    cache = { at: Date.now(), p };
  }
  return cache.p;
};

/** L'audio d'un jour : un lien local (à libérer avec URL.revokeObjectURL). */
export const fetchDecryptageAudio = async (date: string): Promise<string> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('auth');
  const r = await fetch('/api/articles', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'decryptage.audio', date }) });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return URL.createObjectURL(await r.blob());
};
