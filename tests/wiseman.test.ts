import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignRoles, tally, winnerOf, guessMatches, pointsFor, pickPair, WORD_PAIRS } from '../games/wiseman';

describe('Wiseman : règles', () => {
  it('1 intrus jusqu’à 5 joueurs, 2 au-delà, sans mot seulement à 5 et plus', () => {
    const count = (r: string[], x: string) => r.filter(y => y === x).length;
    expect(count(assignRoles(3, true), 'intrus')).toBe(1);
    expect(count(assignRoles(3, true), 'blanc')).toBe(0);
    expect(count(assignRoles(5, true), 'blanc')).toBe(1);
    expect(count(assignRoles(6, false), 'intrus')).toBe(2);
    expect(assignRoles(8, true)).toHaveLength(8);
  });
  it('vote : le plus désigné, personne en cas d’égalité', () => {
    expect(tally({ a: 'b', c: 'b', b: 'a' })).toBe('b');
    expect(tally({ a: 'b', b: 'a' })).toBe(null);
    expect(tally({})).toBe(null);
  });
  it('fin de partie', () => {
    expect(winnerOf(['civil', 'civil'])).toBe('civils');
    expect(winnerOf(['civil', 'intrus'])).toBe('imposteurs');
    expect(winnerOf(['civil', 'civil', 'intrus'])).toBe(null);
    expect(winnerOf(['civil', 'blanc'])).toBe('imposteurs');
  });
  it('le sans mot devine sans tenir compte des accents ni des articles', () => {
    expect(guessMatches('le ndole', 'Ndolé')).toBe(true);
    expect(guessMatches('eru', 'Ndolé')).toBe(false);
    expect(guessMatches('', '')).toBe(false);
  });
  it('points', () => {
    expect(pointsFor('civil', 'civils')).toBe(2);
    expect(pointsFor('intrus', 'civils')).toBe(0);
    expect(pointsFor('intrus', 'imposteurs')).toBe(10);
    expect(pointsFor('blanc', 'imposteurs')).toBe(6);
    expect(pointsFor('intrus', 'blanc')).toBe(0);
  });
  it('paires de mots : jamais deux fois la même si possible', () => {
    const used: number[] = [];
    for (let i = 0; i < 30; i++) used.push(pickPair(used).index);
    expect(new Set(used).size).toBe(30);
    expect(WORD_PAIRS.length).toBeGreaterThan(100);
  });
});

// ---------- Serveur (api/wiseman) avec une base simulée

const store = new Map<string, any>();
const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const snap = (path: string) => ({ exists: store.has(path), data: () => clone(store.get(path)) });
const docRef = (path: string): any => ({ path, collection: (c: string) => colRef(`${path}/${c}`), get: async () => snap(path) });
const colRef = (path: string) => ({ doc: (id: string) => docRef(`${path}/${id}`) });
vi.mock('../api/_lib/admin.js', () => ({
  adminAuth: { verifyIdToken: async (t: string) => { if (!t) throw new Error('no'); return { uid: t }; } },
  adminDb: {
    collection: colRef,
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const writes: (() => void)[] = [];
      const tx = {
        get: async (ref: any) => snap(ref.path),
        set: (ref: any, d: any) => writes.push(() => store.set(ref.path, clone(d))),
        update: (ref: any, d: any) => writes.push(() => store.set(ref.path, { ...store.get(ref.path), ...clone(d) })),
        delete: (ref: any) => writes.push(() => store.delete(ref.path)),
      };
      const r = await fn(tx);
      writes.forEach(w => w());
      return r;
    },
  },
}));
const { default: handler } = await import('../api/wiseman');
let clock = 9_000_000;
const call = async (uid: string, body: Record<string, unknown>) => {
  let status = 200, json: any = null;
  const res = { status: (s: number) => { status = s; return res; }, json: (j: any) => { json = j; return res; }, end: () => res };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${uid}` }, body } as any, res as any);
  return { status, json };
};
const table = (code: string) => clone(store.get(`wisemanTables/${code}`));
const secret = (code: string) => clone(store.get(`wisemanSecrets/${code}`));
const card = (code: string, uid: string) => clone(store.get(`wisemanTables/${code}/cards/${uid}`));
beforeEach(() => { store.clear(); clock = 9_000_000; vi.spyOn(Date, 'now').mockImplementation(() => clock); });

const players = ['ana', 'ben', 'cyr', 'dan', 'eve'];
const setup = async (n = 4, withBlank = false) => {
  const code = (await call('ana', { action: 'create', name: 'Ana' })).json.code;
  for (const u of players.slice(1, n)) await call(u, { action: 'join', code, name: u });
  if (withBlank) await call('ana', { action: 'config', code, withBlank: true });
  await call('ana', { action: 'start', code });
  return code;
};
const playClues = async (code: string) => {
  let t = table(code);
  while (t.status === 'clues') { await call(t.turnUid, { action: 'clue', code, text: `indice de ${t.turnUid}` }); t = table(code); }
};

describe('Wiseman en ligne : serveur', () => {
  it('chacun reçoit sa carte ; la table ne montre ni mots ni rôles', async () => {
    const code = await setup(4);
    const s = secret(code);
    const t = table(code);
    expect(t.status).toBe('clues');
    for (const u of players.slice(0, 4)) expect(card(code, u).word).toBe(s.roles[u] === 'civil' ? s.civil : s.intrus);
    expect(JSON.stringify(t)).not.toContain(s.civil);
    expect(JSON.stringify(t)).not.toContain('"roles"');
  });

  it('indices à tour de rôle, 60 s chacun, puis vote ; l’intrus éliminé fait gagner les civils', async () => {
    const code = await setup(4);
    const t0 = table(code);
    expect((await call(t0.order[1], { action: 'clue', code, text: 'x' })).status).toBe(409); // pas son tour
    clock += 61_000;
    await call('ana', { action: 'tick', code, version: t0.version });
    expect(table(code).clues[0]).toMatchObject({ uid: t0.order[0], text: '' });
    await playClues(code);
    expect(table(code).status).toBe('vote');
    const s = secret(code);
    const intrus = Object.keys(s.roles).find(u => s.roles[u] === 'intrus')!;
    for (const u of players.slice(0, 4)) await call(u, { action: 'vote', code, target: u === intrus ? players.find(p => p !== intrus)! : intrus });
    const t = table(code);
    expect(t.status).toBe('end');
    expect(t.winner).toBe('civils');
    expect(t.reveal.civil).toBe(s.civil);
    for (const u of players.slice(0, 4)) expect(t.scores[u]).toBe(u === intrus ? 0 : 2);
  });

  it('égalité : personne ne sort, nouveau tour ; un civil éliminé laisse la partie continuer', async () => {
    const code = await setup(4);
    await playClues(code);
    const [a, b, c, d] = players;
    await call(a, { action: 'vote', code, target: b });
    await call(b, { action: 'vote', code, target: a });
    await call(c, { action: 'vote', code, target: d });
    await call(d, { action: 'vote', code, target: c });
    let t = table(code);
    expect(t.status).toBe('clues');
    expect(t.round).toBe(2);
    expect(t.lastOut.uid).toBe(null);
    await playClues(code);
    const s = secret(code);
    const civil = players.slice(0, 4).find(u => s.roles[u] === 'civil')!;
    for (const u of players.slice(0, 4)) await call(u, { action: 'vote', code, target: u === civil ? players.slice(0, 4).find(x => x !== civil)! : civil });
    t = table(code);
    expect(t.eliminated[0]).toMatchObject({ uid: civil, role: 'civil' });
    // 4 joueurs, 1 civil sorti : 2 civils + 1 intrus, la partie continue
    expect(t.status).toBe('clues');
    expect(t.order).not.toContain(civil);
    expect((await call(civil, { action: 'vote', code, target: 'ana' })).status).toBe(409);
  });

  it('le sans mot éliminé gagne s’il devine le mot des civils', async () => {
    const code = await setup(5, true);
    const s = secret(code);
    const blank = Object.keys(s.roles).find(u => s.roles[u] === 'blanc')!;
    expect(card(code, blank)).toMatchObject({ word: null, blank: true });
    expect(table(code).order[0]).not.toBe(blank);
    await playClues(code);
    for (const u of players) await call(u, { action: 'vote', code, target: u === blank ? players.find(p => p !== blank)! : blank });
    expect(table(code).status).toBe('guess');
    expect((await call('ana' === blank ? 'ben' : 'ana', { action: 'guess', code, word: s.civil })).status).toBe(409);
    await call(blank, { action: 'guess', code, word: s.civil.toLowerCase() });
    const t = table(code);
    expect(t.status).toBe('end');
    expect(t.winner).toBe('blanc');
    expect(t.scores[blank]).toBe(6);
    // Revanche : nouvelles cartes, scores conservés
    await call('ben', { action: 'rematch', code });
    expect(table(code).status).toBe('clues');
    expect(table(code).scores[blank]).toBe(6);
    expect(table(code).games).toBe(2);
  });
});
