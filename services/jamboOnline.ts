import { signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Card, Play, RoundResult } from '../games/fapfap';

// Jambo en ligne, côté téléphone : on lit la table et sa propre main en direct,
// et on envoie ses coups au serveur (api/jambo), qui les vérifie.

export type Seat = { uid: string | null; name: string; bot: boolean };
export interface OnlineTable {
  code: string;
  hostUid: string;
  status: 'lobby' | 'playing';
  seats: Seat[];
  target: number;
  version: number;
  round?: number;
  trickNo?: number;
  leader?: number;
  turn?: number | null;
  trick?: Play[];
  counts?: number[];
  scores?: number[];
  result?: RoundResult | null;
  matchWinner?: number | null;
  deadline?: number | null;
  lastTrick?: { plays: Play[]; winner: number; at: number } | null;
  auto?: { seat: number; at: number } | null;
}

/** Un compte pour jouer : celui de CKMoney s'il existe, sinon un compte invité (sans e-mail). */
export const ensurePlayer = async () => {
  await (auth as any).authStateReady?.();
  return auth.currentUser || (await signInAnonymously(auth)).user;
};

export const jambo = async (action: string, body: Record<string, unknown> = {}): Promise<any> => {
  const user = await ensurePlayer();
  const r = await fetch('/api/jambo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `http_${r.status}`);
  return data;
};

export const watchTable = (code: string, cb: (t: OnlineTable | null) => void, onError?: (e: Error) => void) =>
  onSnapshot(doc(db, 'jamboTables', code), s => cb(s.exists() ? (s.data() as OnlineTable) : null), e => onError?.(e));

export const watchHand = (code: string, uid: string, cb: (cards: Card[]) => void) =>
  onSnapshot(doc(db, 'jamboTables', code, 'hands', uid), s => cb((s.data()?.cards as Card[]) || []), () => cb([]));

export const tableLink = (code: string) => `${window.location.origin}/jambo?t=${code}`;

const NAME_KEY = 'ck_jambo_name';
export const savedName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
export const saveName = (n: string) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* stockage indisponible */ } };

export const ERRORS: Record<string, string> = {
  table_introuvable: "Cette table n'existe plus. Demande un nouveau lien.",
  partie_commencee: 'La partie a déjà commencé sans toi. Demande à rejoindre la prochaine.',
  table_pleine: 'La table est complète (4 joueurs).',
  prenom: 'Indique ton prénom.',
  coup_refuse: 'Ce coup n’est pas possible.',
  pas_ton_tour: 'Ce n’est pas ton tour.',
};
