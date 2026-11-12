import { adminAuth, adminDb } from './_lib/admin.js';
import {
  Game, Card, Play, SUITS, RANKS, newGame, play, claim, resolveTrick, nextRound, aiMove, currentBest,
} from '../games/fapfap.js';

// POST /api/jambo — Jambo en ligne entre amis. Le serveur est l'arbitre :
//  - l'état complet (toutes les mains) est dans jamboSecrets/{code}, illisible depuis les téléphones ;
//  - chacun lit la table (jamboTables/{code}) et SA main seulement (jamboTables/{code}/hands/{uid}) ;
//  - chaque coup est vérifié ici avec le même moteur que le jeu contre l'ordinateur.
// Comptes : Google, e-mail ou invité (connexion anonyme + prénom). Des points, jamais d'argent.
//
// Actions : create, join, leave, addBot, removeBot, setTarget, start, play, claim, tick, next, rematch.
// « tick » fait jouer l'ordinateur : pour une place ordinateur, ou pour un joueur qui n'a pas joué en 30 s.

const TURN_MS = 30_000;        // temps laissé à un joueur
const BOT_MS = 900;            // rythme de l'ordinateur
const AFTER_TRICK_MS = 1_700;  // le temps de voir le pli ramassé
const BOT_NAMES = ['Tonton', 'La Go', 'Le Boss'];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

type Seat = { uid: string | null; name: string; bot: boolean };

const tables = () => adminDb.collection('jamboTables');
const secrets = () => adminDb.collection('jamboSecrets');
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v)); // Firestore refuse les « undefined »
const cleanName = (s: unknown) => String(s || '').replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const validCard = (c: any): c is Card => c && SUITS.includes(c.s) && RANKS.includes(c.r);

class Refus extends Error { constructor(public code: string, public status = 400) { super(code); } }

/** Vue publique d'une partie : rien sur les mains, sauf leur nombre de cartes. */
const publicOf = (g: Game, seats: Seat[], now: number, lastTrick?: { plays: Play[]; winner: number; at: number } | null, slow = false) => {
  const turnSeat = g.turn === null ? null : seats[g.turn];
  return clean({
    round: g.round, trickNo: g.trickNo, leader: g.leader, turn: g.turn, trick: g.trick,
    counts: g.players.map(p => p.hand.length), scores: g.players.map(p => p.score),
    result: g.result, matchWinner: g.matchWinner,
    deadline: g.result || !turnSeat ? null : now + (turnSeat.bot ? BOT_MS : TURN_MS) + (slow ? AFTER_TRICK_MS : 0),
    ...(lastTrick !== undefined ? { lastTrick } : {}),
  });
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  let caller;
  try { caller = await adminAuth.verifyIdToken((req.headers.authorization || '').replace(/^Bearer /, '')); }
  catch { return res.status(401).json({ error: 'unauthorized' }); }
  const uid = caller.uid;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || '');
    const now = Date.now();

    if (action === 'create') {
      const name = cleanName(body.name);
      if (!name) throw new Refus('prenom');
      const target = [5, 10, 15].includes(Number(body.target)) ? Number(body.target) : 10;
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        const ref = tables().doc(code);
        const created = await adminDb.runTransaction(async tx => {
          if ((await tx.get(ref)).exists) return false;
          tx.set(ref, { code, hostUid: uid, status: 'lobby', seats: [{ uid, name, bot: false }], target, version: 1, createdAt: now, updatedAt: now });
          return true;
        });
        if (created) return res.status(200).json({ code });
      }
      throw new Refus('code', 500);
    }

    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!code) throw new Refus('code');
    const ref = tables().doc(code);
    const secRef = secrets().doc(code);

    const out = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Refus('table_introuvable', 404);
      const t = snap.data() as any;
      const seats: Seat[] = t.seats;
      const seat = seats.findIndex(s => s.uid === uid);
      const isHost = t.hostUid === uid;
      const secSnap = t.status === 'playing' ? await tx.get(secRef) : null;
      let g: Game | null = secSnap?.exists ? JSON.parse(secSnap.data()!.state) : null;
      if (body.version !== undefined && Number(body.version) !== t.version && ['play', 'claim', 'tick', 'next', 'rematch'].includes(action)) {
        return { stale: true, version: t.version };
      }
      const bump = { version: t.version + 1, updatedAt: now };
      const writeHands = (game: Game, only?: number) => game.players.forEach((p, i) => {
        if (seats[i].bot || !seats[i].uid || (only !== undefined && i !== only)) return;
        tx.set(ref.collection('hands').doc(seats[i].uid!), { cards: clean(p.hand), round: game.round });
      });
      const deal = (game: Game) => {
        tx.set(secRef, { state: JSON.stringify(game), updatedAt: now });
        writeHands(game);
        tx.update(ref, { ...bump, status: 'playing', ...publicOf(game, seats, now, null) });
      };

      switch (action) {
        case 'join': {
          if (seat >= 0) return { seat };
          if (t.status !== 'lobby') throw new Refus('partie_commencee', 409);
          if (seats.length >= 4) throw new Refus('table_pleine', 409);
          const name = cleanName(body.name);
          if (!name) throw new Refus('prenom');
          tx.update(ref, { ...bump, seats: [...seats, { uid, name, bot: false }] });
          return { seat: seats.length };
        }
        case 'leave': {
          if (seat < 0 || t.status !== 'lobby') return {};
          const rest = seats.filter((_, i) => i !== seat);
          const humans = rest.filter(s => !s.bot);
          if (!humans.length) { tx.delete(ref); return {}; }
          tx.update(ref, { ...bump, seats: rest, hostUid: isHost ? humans[0].uid : t.hostUid });
          return {};
        }
        case 'addBot': {
          if (!isHost || t.status !== 'lobby') throw new Refus('hote', 403);
          if (seats.length >= 4) throw new Refus('table_pleine', 409);
          const name = BOT_NAMES.find(n => !seats.some(s => s.name === n)) || 'Ordinateur';
          tx.update(ref, { ...bump, seats: [...seats, { uid: null, name, bot: true }] });
          return {};
        }
        case 'removeBot': {
          const i = Number(body.index);
          if (!isHost || t.status !== 'lobby' || !seats[i]?.bot) throw new Refus('hote', 403);
          tx.update(ref, { ...bump, seats: seats.filter((_, k) => k !== i) });
          return {};
        }
        case 'setTarget': {
          if (!isHost || t.status !== 'lobby' || ![5, 10, 15].includes(Number(body.target))) throw new Refus('hote', 403);
          tx.update(ref, { ...bump, target: Number(body.target) });
          return {};
        }
        case 'start': {
          if (!isHost || t.status !== 'lobby') throw new Refus('hote', 403);
          if (seats.length < 2) throw new Refus('seul', 409);
          deal(newGame(seats.map(s => ({ name: s.name, human: !s.bot })), t.target));
          return {};
        }
        case 'rematch': {
          if (seat < 0 || !g || g.matchWinner === null) throw new Refus('pas_fini', 409);
          deal(newGame(seats.map(s => ({ name: s.name, human: !s.bot })), t.target));
          return {};
        }
        case 'next': {
          if (seat < 0 || !g || !g.result || g.matchWinner !== null) return {};
          deal(nextRound(g));
          return {};
        }
        case 'play': case 'claim': case 'tick': {
          if (!g || g.result || g.turn === null) return {};
          if (seat < 0) throw new Refus('pas_a_table', 403);
          let actor = g.turn;
          let move: { card: Card } | { claim: true };
          let auto = false;
          if (action === 'tick') {
            if (now < (t.deadline || 0)) return { wait: (t.deadline || 0) - now };
            move = aiMove(g, actor);
            auto = !seats[actor].bot;
          } else {
            if (actor !== seat) throw new Refus('pas_ton_tour', 409);
            if (action === 'claim') move = { claim: true };
            else { if (!validCard(body.card)) throw new Refus('carte'); move = { card: { s: body.card.s, r: body.card.r } }; }
          }
          let lastTrick: { plays: Play[]; winner: number; at: number } | undefined;
          if ('claim' in move) g = claim(g, actor);
          else {
            g = play(g, actor, move.card);
            if (g.turn === null) {
              lastTrick = { plays: g.trick, winner: currentBest(g.trick)!.p, at: now };
              g = resolveTrick(g);
            }
          }
          tx.set(secRef, { state: JSON.stringify(g), updatedAt: now });
          writeHands(g, actor);
          tx.update(ref, { ...bump, ...publicOf(g, seats, now, lastTrick, !!lastTrick), auto: auto ? { seat: actor, at: now } : null });
          return {};
        }
        default:
          throw new Refus('action');
      }
    });
    return res.status(200).json(out || {});
  } catch (e: any) {
    if (e instanceof Refus) return res.status(e.status).json({ error: e.code });
    const m = String(e?.message || '');
    // Coup refusé par le moteur (pas son tour, carte absente, il faut fournir…)
    if (/tour|carte|fournir|annonce/.test(m)) return res.status(409).json({ error: 'coup_refuse' });
    console.error('jambo', m);
    return res.status(500).json({ error: 'erreur' });
  }
}
