import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { ensurePlayer } from './jamboOnline';
import type { Role, Winner } from '../games/wiseman';

// Le Wiseman en ligne, côté téléphone : la table et SA carte en direct ; les actions passent par api/wiseman.

export type WSeat = { uid: string; name: string };
export interface WisemanTable {
  code: string;
  name?: string;        // nom de la table (foot, séries) ; le code sert à rejoindre
  hostUid: string;
  status: 'lobby' | 'clues' | 'vote' | 'guess' | 'end';
  seats: WSeat[];
  withBlank: boolean;
  blankInGame?: boolean;
  games?: number;
  round?: number;
  order?: string[];
  turnUid?: string | null;
  deadline?: number | null;
  clues?: { round: number; uid: string; text: string }[];
  voted?: string[];
  eliminated?: { uid: string; role: Role; round: number }[];
  lastOut?: { uid: string | null; role?: Role; round: number } | null;
  lastVotes?: Record<string, string> | null;
  guess?: { uid: string; word: string; ok: boolean } | null;
  winner?: Winner | null;
  reveal?: { roles: Record<string, Role>; civil: string; intrus: string } | null;
  scores?: Record<string, number>;
  version: number;
}
export interface WisemanCard { word: string | null; blank: boolean; game: number }

export const wiseman = async (action: string, body: Record<string, unknown> = {}): Promise<any> => {
  const user = await ensurePlayer();
  const r = await fetch('/api/wiseman', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `http_${r.status}`);
  return data;
};

export const watchWiseman = (code: string, cb: (t: WisemanTable | null) => void) =>
  onSnapshot(doc(db, 'wisemanTables', code), s => cb(s.exists() ? (s.data() as WisemanTable) : null), () => cb(null));

export const watchCard = (code: string, uid: string, cb: (c: WisemanCard | null) => void) =>
  onSnapshot(doc(db, 'wisemanTables', code, 'cards', uid), s => cb(s.exists() ? (s.data() as WisemanCard) : null), () => cb(null));

export const wisemanLink = (code: string) => `${window.location.origin}/wiseman?t=${code}`;
