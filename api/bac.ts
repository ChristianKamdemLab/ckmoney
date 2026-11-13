import { adminAuth, adminDb } from './_lib/admin.js';
import { pickTableName } from '../games/tableNames.js';
import { DEFAULT_CATEGORIES, STOP_GRACE_S, pickLetter, autoCheck, scoreRound } from '../games/bac.js';

// POST /api/bac — Baccalauréat en ligne entre amis.
//  - La table (bacTables/{code}) est lisible par qui a le code ; les réponses de chacun restent
//    cachées dans bacSecrets/{code}/answers/{uid} jusqu'à la fin de l'écriture.
//  - Le serveur ouvre la correction quand le temps est écoulé ou 10 s après un STOP.
//  - Quitter l'appli pendant l'écriture est signalé à tous (nombre de sorties et durée).
// Actions : create, join, leave, config, start, save, stop, close, away, vote, ready, score, next, rematch.

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CLOSE_GRACE_MS = 1_500;   // dernières réponses envoyées juste avant la fin
type Seat = { uid: string; name: string };

const tables = () => adminDb.collection('bacTables');
const secrets = () => adminDb.collection('bacSecrets');
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const cleanText = (s: unknown, max: number) => String(s ?? '').replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

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
          tx.set(ref, {
            code, name: pickTableName(), hostUid: uid, status: 'lobby', seats: [{ uid, name }], categories: DEFAULT_CATEGORIES,
            rounds: 5, duration: 120, round: 0, usedLetters: [], scores: {}, version: 1, createdAt: now, updatedAt: now,
          });
          return true;
        });
        if (ok) return res.status(200).json({ code });
      }
      throw new Refus('code', 500);
    }

    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!code) throw new Refus('code');
    const ref = tables().doc(code);
    const answersRef = (u: string) => secrets().doc(code).collection('answers').doc(u);

    // Réponses : un document par joueur (pas de bouchon quand tout le monde écrit en même temps)
    if (action === 'save') {
      const t = (await ref.get()).data() as any;
      if (!t) throw new Refus('table_introuvable', 404);
      if (!t.seats.some((s: Seat) => s.uid === uid)) throw new Refus('pas_a_table', 403);
      const limit = (t.stopAt || t.endsAt || 0) + CLOSE_GRACE_MS;
      if (t.status !== 'writing' || now > limit || Number(body.round) !== t.round) return res.status(200).json({ late: true });
      const answers = (Array.isArray(body.answers) ? body.answers : []).slice(0, t.categories.length).map((a: unknown) => cleanText(a, 40));
      await answersRef(uid).set({ round: t.round, answers, at: now });
      const filled = answers.filter((a: string) => a).length;
      if ((t.filled || {})[uid] !== filled) {
        await adminDb.runTransaction(async tx => {
          const cur = (await tx.get(ref)).data() as any;
          if (cur?.status === 'writing' && cur.round === t.round) tx.update(ref, { filled: { ...(cur.filled || {}), [uid]: filled }, updatedAt: now });
        });
      }
      return res.status(200).json({ ok: true });
    }

    const out = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Refus('table_introuvable', 404);
      const t = snap.data() as any;
      const seats: Seat[] = t.seats;
      const seated = seats.some(s => s.uid === uid);
      const isHost = t.hostUid === uid;
      // Lectures avant écritures (règle des transactions)
      const answerSnaps = action === 'close' || action === 'stop'
        ? await Promise.all(seats.map(s => tx.get(answersRef(s.uid))))
        : [];
      const bump = { version: (t.version || 0) + 1, updatedAt: now };
      const newRound = (round: number, used: string[]) => {
        const letter = pickLetter(used);
        return {
          status: 'writing', round, letter, usedLetters: [...used, letter], endsAt: now + t.duration * 1000, startedAt: now,
          stopAt: null, stoppedBy: null, filled: {}, away: {}, review: null, votes: {}, ready: [], roundPoints: null, detail: null, verdict: null,
        };
      };

      switch (action) {
        case 'join': {
          if (seated) return {};
          if (t.status !== 'lobby') throw new Refus('partie_commencee', 409);
          if (seats.length >= 8) throw new Refus('table_pleine', 409);
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
        case 'rename': {
          if (!isHost || t.status !== 'lobby') throw new Refus('hote', 403);
          tx.update(ref, { ...bump, name: pickTableName(t.name) });
          return {};
        }
        case 'config': {
          if (!isHost || t.status !== 'lobby') throw new Refus('hote', 403);
          const cats = Array.isArray(body.categories) ? body.categories.map((c: unknown) => cleanText(c, 30)).filter(Boolean) : t.categories;
          const uniq = [...new Set(cats as string[])].slice(0, 12);
          if (uniq.length < 3) throw new Refus('categories');
          tx.update(ref, {
            ...bump, categories: uniq,
            rounds: [3, 5, 10].includes(Number(body.rounds)) ? Number(body.rounds) : t.rounds,
            duration: [90, 120, 180].includes(Number(body.duration)) ? Number(body.duration) : t.duration,
          });
          return {};
        }
        case 'start': {
          if (!isHost || t.status !== 'lobby') throw new Refus('hote', 403);
          if (seats.length < 2) throw new Refus('seul', 409);
          tx.update(ref, { ...bump, scores: Object.fromEntries(seats.map(s => [s.uid, 0])), ...newRound(1, []) });
          return {};
        }
        case 'stop': {
          if (!seated || t.status !== 'writing' || t.stopAt) return {};
          const mine = answerSnaps[seats.findIndex(s => s.uid === uid)]?.data();
          const full = mine?.round === t.round && t.categories.every((_: string, i: number) => (mine.answers?.[i] || '').trim());
          if (!full) throw new Refus('incomplet', 409);
          tx.update(ref, { ...bump, stopAt: Math.min(t.endsAt, now + STOP_GRACE_S * 1000), stoppedBy: uid });
          return {};
        }
        case 'close': {
          if (t.status !== 'writing') return {};
          const deadline = (t.stopAt || t.endsAt) + CLOSE_GRACE_MS;
          if (now < deadline) return { wait: deadline - now };
          const answers: Record<string, string[]> = {};
          seats.forEach((s, i) => {
            const d = answerSnaps[i]?.data();
            answers[s.uid] = d?.round === t.round ? (d.answers || []) : [];
          });
          const review = t.categories.map((cat: string, c: number) => ({
            cat,
            answers: seats.map(s => ({ uid: s.uid, text: answers[s.uid][c] || '', auto: autoCheck(answers[s.uid][c] || '', t.letter) })),
          }));
          tx.update(ref, { ...bump, status: 'review', review: clean(review), votes: {}, ready: [] });
          return {};
        }
        case 'away': {
          if (!seated || t.status !== 'writing') return {};
          const cur = (t.away || {})[uid] || { n: 0, secs: 0, out: false };
          const next = body.state === 'out'
            ? { n: cur.n + 1, secs: cur.secs, out: true }
            : { n: Math.max(cur.n, 1), secs: cur.secs + Math.min(600, Math.max(0, Math.round(Number(body.secs) || 0))), out: false };
          tx.update(ref, { ...bump, away: { ...(t.away || {}), [uid]: next } });
          return {};
        }
        case 'vote': {
          if (!seated || t.status !== 'review') return {};
          const c = Number(body.cat), target = String(body.target || '');
          if (!(c >= 0 && c < t.categories.length) || target === uid || !seats.some(s => s.uid === target)) throw new Refus('vote');
          const k = `${c}|${target}`;
          const list: string[] = (t.votes || {})[k] || [];
          const on = body.on !== false;
          const next = on ? [...new Set([...list, uid])] : list.filter(v => v !== uid);
          tx.update(ref, { ...bump, votes: { ...(t.votes || {}), [k]: next } });
          return {};
        }
        case 'ready': case 'score': {
          if (!seated || t.status !== 'review') return {};
          const ready = [...new Set([...(t.ready || []), uid])];
          if (action === 'ready' && ready.length < seats.length) { tx.update(ref, { ...bump, ready }); return {}; }
          if (action === 'score' && !isHost) throw new Refus('hote', 403);
          const answers: Record<string, string[]> = {};
          seats.forEach(s => { answers[s.uid] = t.review.map((r: any) => r.answers.find((a: any) => a.uid === s.uid)?.text || ''); });
          const outcome = scoreRound({ letter: t.letter, categories: t.categories, players: seats.map(s => s.uid), answers, votes: t.votes || {} });
          const scores = { ...(t.scores || {}) };
          seats.forEach(s => { scores[s.uid] = (scores[s.uid] || 0) + (outcome.points[s.uid] || 0); });
          tx.update(ref, { ...bump, status: 'scores', ready, roundPoints: outcome.points, detail: outcome.detail, verdict: outcome.status, scores });
          return {};
        }
        case 'next': {
          if (!seated || t.status !== 'scores' || t.round >= t.rounds) return {};
          if (body.version !== undefined && Number(body.version) !== t.version) return { stale: true };
          tx.update(ref, { ...bump, ...newRound(t.round + 1, t.usedLetters || []) });
          return {};
        }
        case 'rematch': {
          if (!seated || t.status !== 'scores' || t.round < t.rounds) return {};
          tx.update(ref, { ...bump, status: 'lobby', round: 0, usedLetters: [], scores: {}, review: null, votes: {}, ready: [], roundPoints: null, detail: null, verdict: null, filled: {}, away: {} });
          return {};
        }
        default:
          throw new Refus('action');
      }
    });
    return res.status(200).json(out || {});
  } catch (e: any) {
    if (e instanceof Refus) return res.status(e.status).json({ error: e.code });
    console.error('bac', e?.message);
    return res.status(500).json({ error: 'erreur' });
  }
}
