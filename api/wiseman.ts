import { adminAuth, adminDb } from './_lib/admin.js';
import { Role, Winner, MIN_PLAYERS, MAX_PLAYERS, BLANK_MIN_PLAYERS, assignRoles, pickPair, tally, winnerOf, guessMatches, pointsFor } from '../games/wiseman.js';

// POST /api/wiseman — Le Wiseman (jeu de l'intrus) en ligne entre amis.
//  - Rôles, mots et votes en cours restent sur le serveur (wisemanSecrets/{code}).
//  - Chacun ne lit que SA carte (wisemanTables/{code}/cards/{uid}) : son mot, ou rien s'il est le sans mot.
//  - Indice : 60 s par joueur ; vote : 90 s ; le sans mot éliminé a 45 s pour deviner.
// Actions : create, join, leave, config, start, clue, vote, guess, tick, rematch.

const CLUE_MS = 60_000;
const VOTE_MS = 90_000;
const GUESS_MS = 45_000;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
type Seat = { uid: string; name: string };
type Clue = { round: number; uid: string; text: string };

const tables = () => adminDb.collection('wisemanTables');
const secrets = () => adminDb.collection('wisemanSecrets');
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const cleanText = (s: unknown, max: number) => String(s ?? '').replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const shuffle = <T>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

class Refus extends Error { constructor(public code: string, public status = 400) { super(code); } }

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
      const name = cleanText(body.name, 20);
      if (!name) throw new Refus('prenom');
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        const ref = tables().doc(code);
        const ok = await adminDb.runTransaction(async tx => {
          if ((await tx.get(ref)).exists) return false;
          tx.set(ref, { code, hostUid: uid, status: 'lobby', seats: [{ uid, name }], withBlank: false, scores: {}, games: 0, version: 1, createdAt: now, updatedAt: now });
          return true;
        });
        if (ok) return res.status(200).json({ code });
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
      const seated = seats.some(s => s.uid === uid);
      const isHost = t.hostUid === uid;
      const sec = t.status !== 'lobby' ? (await tx.get(secRef)).data() as any : null;
      if (body.version !== undefined && Number(body.version) !== t.version && ['tick'].includes(action)) return { stale: true };
      const bump = { version: (t.version || 0) + 1, updatedAt: now };
      const roles: Record<string, Role> = sec?.roles || {};
      const out: string[] = (t.eliminated || []).map((e: any) => e.uid);
      const alive = seats.map(s => s.uid).filter(u => !out.includes(u));

      /** Après une élimination (ou une égalité) : fin de partie ou nouveau tour d'indices. */
      const afterElimination = (patch: Record<string, unknown>, eliminatedNow: string[], forced?: Winner) => {
        const stillAlive = alive.filter(u => !eliminatedNow.includes(u));
        const winner = forced || winnerOf(stillAlive.map(u => roles[u]));
        if (winner) {
          const scores = { ...(t.scores || {}) };
          seats.forEach(s => { scores[s.uid] = (scores[s.uid] || 0) + pointsFor(roles[s.uid], winner); });
          tx.update(ref, { ...bump, ...patch, status: 'end', winner, reveal: { roles, civil: sec.civil, intrus: sec.intrus }, scores, deadline: null, turnUid: null });
          return;
        }
        const round = (t.round || 1) + 1;
        // Le tour suivant commence par le joueur après le premier du tour précédent ; jamais par le sans mot si possible
        let order = stillAlive.slice((round - 1) % stillAlive.length).concat(stillAlive.slice(0, (round - 1) % stillAlive.length));
        if (roles[order[0]] === 'blanc' && order.length > 1) order = [...order.slice(1), order[0]];
        tx.update(ref, { ...bump, ...patch, status: 'clues', round, order, turnUid: order[0], deadline: now + CLUE_MS, voted: [] });
        tx.set(secRef, { ...sec, votes: {} });
      };

      const resolveVote = () => {
        const votes: Record<string, string> = sec.votes || {};
        const target = tally(votes);
        const lastVotes = clean(votes);
        if (!target) { afterElimination({ lastOut: { uid: null, round: t.round }, lastVotes }, []); return; }
        const role = roles[target];
        const eliminated = [...(t.eliminated || []), { uid: target, role, round: t.round }];
        if (role === 'blanc') {
          tx.update(ref, { ...bump, status: 'guess', eliminated, lastOut: { uid: target, role, round: t.round }, lastVotes, turnUid: target, deadline: now + GUESS_MS });
          return;
        }
        afterElimination({ eliminated, lastOut: { uid: target, role, round: t.round }, lastVotes }, [target]);
      };

      const nextClue = (clues: Clue[]) => {
        const order: string[] = t.order;
        const i = order.indexOf(t.turnUid) + 1;
        if (i < order.length) tx.update(ref, { ...bump, clues, turnUid: order[i], deadline: now + CLUE_MS });
        else tx.update(ref, { ...bump, clues, status: 'vote', turnUid: null, voted: [], deadline: now + VOTE_MS });
      };

      switch (action) {
        case 'join': {
          if (seated) return {};
          if (t.status !== 'lobby') throw new Refus('partie_commencee', 409);
          if (seats.length >= MAX_PLAYERS) throw new Refus('table_pleine', 409);
          const name = cleanText(body.name, 20);
          if (!name) throw new Refus('prenom');
          tx.update(ref, { ...bump, seats: [...seats, { uid, name }] });
          return {};
        }
        case 'leave': {
          if (!seated || t.status !== 'lobby') return {};
          const rest = seats.filter(s => s.uid !== uid);
          if (!rest.length) { tx.delete(ref); return {}; }
          tx.update(ref, { ...bump, seats: rest, hostUid: isHost ? rest[0].uid : t.hostUid });
          return {};
        }
        case 'config': {
          if (!isHost || t.status !== 'lobby') throw new Refus('hote', 403);
          tx.update(ref, { ...bump, withBlank: !!body.withBlank });
          return {};
        }
        case 'start': case 'rematch': {
          if (action === 'start' && (!isHost || t.status !== 'lobby')) throw new Refus('hote', 403);
          if (action === 'rematch' && (!seated || t.status !== 'end')) return {};
          if (seats.length < MIN_PLAYERS) throw new Refus('trop_peu', 409);
          const rolesList = assignRoles(seats.length, !!t.withBlank && seats.length >= BLANK_MIN_PLAYERS);
          const pair = pickPair(t.usedPairs || []);
          const newRoles: Record<string, Role> = Object.fromEntries(seats.map((s, i) => [s.uid, rolesList[i]]));
          let order = shuffle(seats.map(s => s.uid));
          if (newRoles[order[0]] === 'blanc') order = [...order.slice(1), order[0]];
          tx.set(secRef, { roles: newRoles, civil: pair.civil, intrus: pair.intrus, votes: {} });
          seats.forEach(s => {
            const r = newRoles[s.uid];
            tx.set(ref.collection('cards').doc(s.uid), { word: r === 'blanc' ? null : r === 'civil' ? pair.civil : pair.intrus, blank: r === 'blanc', game: (t.games || 0) + 1 });
          });
          tx.update(ref, {
            ...bump, status: 'clues', games: (t.games || 0) + 1, round: 1, order, turnUid: order[0], deadline: now + CLUE_MS,
            clues: [], voted: [], eliminated: [], lastOut: null, lastVotes: null, winner: null, reveal: null,
            usedPairs: [...(t.usedPairs || []), pair.index].slice(-60), blankInGame: rolesList.includes('blanc'),
          });
          return {};
        }
        case 'clue': {
          if (t.status !== 'clues' || t.turnUid !== uid) throw new Refus('pas_ton_tour', 409);
          const text = cleanText(body.text, 30);
          if (!text) throw new Refus('indice');
          nextClue([...(t.clues || []), { round: t.round, uid, text }]);
          return {};
        }
        case 'vote': {
          if (t.status !== 'vote' || !alive.includes(uid)) throw new Refus('vote', 409);
          const target = String(body.target || '');
          if (target === uid || !alive.includes(target)) throw new Refus('vote');
          sec.votes = { ...(sec.votes || {}), [uid]: target };
          const voted = [...new Set([...(t.voted || []), uid])];
          if (voted.length >= alive.length) { resolveVote(); return {}; }
          tx.set(secRef, sec);
          tx.update(ref, { ...bump, voted });
          return {};
        }
        case 'guess': {
          if (t.status !== 'guess' || t.turnUid !== uid) throw new Refus('pas_ton_tour', 409);
          const ok = guessMatches(String(body.word || ''), sec.civil);
          afterElimination({ guess: { uid, word: cleanText(body.word, 30), ok } }, [uid], ok ? 'blanc' : undefined);
          return {};
        }
        case 'tick': {
          if (!seated || !['clues', 'vote', 'guess'].includes(t.status)) return {};
          if (now < (t.deadline || 0)) return { wait: t.deadline - now };
          if (t.status === 'clues') nextClue([...(t.clues || []), { round: t.round, uid: t.turnUid, text: '' }]);
          else if (t.status === 'vote') resolveVote();
          else afterElimination({ guess: { uid: t.turnUid, word: '', ok: false } }, [t.turnUid]);
          return {};
        }
        default:
          throw new Refus('action');
      }
    });
    return res.status(200).json(out || {});
  } catch (e: any) {
    if (e instanceof Refus) return res.status(e.status).json({ error: e.code });
    console.error('wiseman', e?.message);
    return res.status(500).json({ error: 'erreur' });
  }
}
