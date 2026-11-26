import { callApi } from './push';
import { player } from './player';
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
export const fetchDecryptageAudio = async (date: string, part?: 'jingle'): Promise<string> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('auth');
  const r = await fetch('/api/articles', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'decryptage.audio', date, part }) });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return URL.createObjectURL(await r.blob());
};

// Lecture par le lecteur de l'appli (services/player.ts) : le jingle puis les voix ; les liens locaux
// sont gardés le temps de la session pour ne pas retélécharger l'audio.
const blobs = new Map<string, Promise<[string, string]>>();
export const decryptageTrackId = (date: string) => `decryptage-${date}`;
export const playDecryptage = async (d: DecryptageDay, open?: () => void) => {
  const id = decryptageTrackId(d.date);
  const cur = player.get();
  if (cur.track?.id === id && cur.track.queue.length) { player.toggle(); return; }
  player.loading(id, d.title, 'Le décryptage');
  if (!blobs.has(d.date)) {
    const p = Promise.all([fetchDecryptageAudio(d.date, 'jingle').catch(() => ''), fetchDecryptageAudio(d.date)]) as Promise<[string, string]>;
    p.catch(() => blobs.delete(d.date));
    blobs.set(d.date, p);
  }
  try {
    const [j, main] = await blobs.get(d.date)!;
    player.play({ id, title: d.title, sub: 'Le décryptage', queue: [j, main], open }, d.minutes * 60);
  } catch { player.failed(); }
};
