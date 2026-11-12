import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { ensurePlayer } from './jamboOnline';

// Baccalauréat en ligne, côté téléphone : la table en direct, et les actions envoyées au serveur (api/bac).

export type BacSeat = { uid: string; name: string };
export type AutoReject = 'vide' | 'lettre';
export interface BacTable {
  code: string;
  hostUid: string;
  status: 'lobby' | 'writing' | 'review' | 'scores';
  seats: BacSeat[];
  categories: string[];
  rounds: number;
  duration: number;
  round: number;
  letter?: string;
  endsAt?: number;
  stopAt?: number | null;
  stoppedBy?: string | null;
  filled?: Record<string, number>;
  away?: Record<string, { n: number; secs: number; out: boolean }>;
  review?: { cat: string; answers: { uid: string; text: string; auto: AutoReject | null }[] }[] | null;
  votes?: Record<string, string[]>;
  ready?: string[];
  roundPoints?: Record<string, number> | null;
  detail?: Record<string, number> | null;
  verdict?: Record<string, 'ok' | 'conteste' | AutoReject> | null;
  scores?: Record<string, number>;
  version: number;
}

export const bac = async (action: string, body: Record<string, unknown> = {}, keepalive = false): Promise<any> => {
  const user = await ensurePlayer();
  const r = await fetch('/api/bac', {
    method: 'POST', keepalive,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `http_${r.status}`);
  return data;
};

export const watchBac = (code: string, cb: (t: BacTable | null) => void) =>
  onSnapshot(doc(db, 'bacTables', code), s => cb(s.exists() ? (s.data() as BacTable) : null), () => cb(null));

export const bacLink = (code: string) => `${window.location.origin}/bac?t=${code}`;
