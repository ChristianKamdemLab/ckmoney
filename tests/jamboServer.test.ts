import { describe, it, expect, vi, beforeEach } from 'vitest';
import { legalCards, claimOf, Card, Play } from '../games/fapfap';

// Arbitre du Jambo en ligne (api/jambo) testé avec une base Firestore simulée en mémoire.

const store = new Map<string, any>();
const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const snap = (path: string) => ({ exists: store.has(path), data: () => clone(store.get(path)) });
const docRef = (path: string): any => ({ path, id: path.split('/').pop(), collection: (c: string) => colRef(`${path}/${c}`), get: async () => snap(path) });
const colRef = (path: string) => ({ doc: (id?: string) => docRef(`${path}/${id || Math.random().toString(36).slice(2)}`) });

vi.mock('../api/_lib/admin.js', () => ({
  adminAuth: { verifyIdToken: async (t: string) => { if (!t) throw new Error('no'); return { uid: t, name: t }; } },
  adminDb: {
    collection: colRef,
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const writes: (() => void)[] = [];
      const tx = {
        get: async (ref: any) => snap(ref.path),
        set: (ref: any, data: any) => writes.push(() => store.set(ref.path, clone(data))),
        update: (ref: any, data: any) => writes.push(() => { if (!store.has(ref.path)) throw new Error('absent'); store.set(ref.path, { ...store.get(ref.path), ...clone(data) }); }),
        delete: (ref: any) => writes.push(() => store.delete(ref.path)),
      };
      const r = await fn(tx);
      writes.forEach(w => w());
      return r;
    },
  },
}));

const { default: handler } = await import('../api/jambo');

let clock = 1_000_000;
const call = async (uid: string, body: Record<string, unknown>) => {
  let status = 200, json: any = null;
  const res = { status: (s: number) => { status = s; return res; }, json: (j: any) => { json = j; return res; }, end: () => res };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${uid}` }, body } as any, res as any);
  return { status, json };
};
const table = (code: string) => clone(store.get(`jamboTables/${code}`));
const hand = (code: string, uid: string): Card[] => store.get(`jamboTables/${code}/hands/${uid}`)?.cards || [];

beforeEach(() => { store.clear(); clock = 1_000_000; vi.spyOn(Date, 'now').mockImplementation(() => clock); });

describe('Jambo en ligne : arbitre', () => {
  it('crée une table, deux amis s’assoient, l’ordinateur complète, la partie démarre', async () => {
    const { json } = await call('ana', { action: 'create', name: 'Ana', target: 5 });
    const code = json.code;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect((await call('ben', { action: 'join', code, name: 'Ben' })).json.seat).toBe(1);
    expect((await call('ben', { action: 'addBot', code })).status).toBe(403); // seul l'hôte
    await call('ana', { action: 'addBot', code });
    expect(table(code).seats.map((s: any) => s.name)).toEqual(['Ana', 'Ben', 'Tonton']);
    expect((await call('ben', { action: 'start', code })).status).toBe(403);
    await call('ana', { action: 'start', code });
    const t = table(code);
    expect(t.status).toBe('playing');
    expect(t.counts).toEqual([5, 5, 5]);
    // Chacun a sa main ; les mains ne sont pas dans la table
    expect(hand(code, 'ana')).toHaveLength(5);
    expect(hand(code, 'ben')).toHaveLength(5);
    expect(JSON.stringify(t)).not.toContain('"hand"');
    // Arrivé trop tard
    expect((await call('zoe', { action: 'join', code, name: 'Zoé' })).json.error).toBe('partie_commencee');
  });

  it('refuse de jouer hors de son tour, ou une carte qui ne fournit pas', async () => {
    const code = (await call('ana', { action: 'create', name: 'Ana' })).json.code;
    await call('ben', { action: 'join', code, name: 'Ben' });
    await call('ana', { action: 'start', code });
    const t = table(code);
    expect(t.turn).toBe(0);
    expect((await call('ben', { action: 'play', code, version: t.version, card: hand(code, 'ben')[0] })).status).toBe(409);
    await call('ana', { action: 'play', code, version: t.version, card: hand(code, 'ana')[0] });
    const t2 = table(code);
    const led = t2.trick[0].c.s;
    const bad = hand(code, 'ben').find(c => c.s !== led);
    if (bad && hand(code, 'ben').some(c => c.s === led)) {
      expect((await call('ben', { action: 'play', code, version: t2.version, card: bad })).status).toBe(409);
    }
  });

  it("l'ordinateur joue pour un joueur absent au bout de 30 s, pas avant", async () => {
    const code = (await call('ana', { action: 'create', name: 'Ana' })).json.code;
    await call('ben', { action: 'join', code, name: 'Ben' });
    await call('ana', { action: 'start', code });
    const t = table(code);
    clock += 10_000;
    expect((await call('ben', { action: 'tick', code, version: t.version })).json.wait).toBeGreaterThan(0);
    clock += 21_000;
    await call('ben', { action: 'tick', code, version: t.version });
    const t2 = table(code);
    expect(t2.trick).toHaveLength(1);
    expect(t2.auto).toMatchObject({ seat: 0 });
    expect(hand(code, 'ana')).toHaveLength(4);
    // Deux téléphones qui demandent en même temps : un seul coup joué
    await call('ana', { action: 'tick', code, version: t.version });
    expect(table(code).trick).toHaveLength(1);
  });

  it('une partie complète à 2 humains et 2 ordinateurs se termine, coups toujours valides', async () => {
    for (let round = 0; round < 5; round++) {
      store.clear();
      const code = (await call('ana', { action: 'create', name: 'Ana', target: 5 })).json.code;
      await call('ben', { action: 'join', code, name: 'Ben' });
      await call('ana', { action: 'addBot', code });
      await call('ana', { action: 'addBot', code });
      await call('ana', { action: 'start', code });
      const uids = ['ana', 'ben'];
      let guard = 0;
      while (guard++ < 3000) {
        const t = table(code);
        if (t.matchWinner !== null && t.matchWinner !== undefined) break;
        if (t.result) { await call('ben', { action: 'next', code, version: t.version }); continue; }
        const seat = t.turn as number;
        if (t.seats[seat].bot) { clock += 2_000; await call(uids[guard % 2], { action: 'tick', code, version: t.version }); continue; }
        const uid = t.seats[seat].uid;
        const h = hand(code, uid);
        if (t.trickNo === 1 && h.length === 5 && claimOf(h)) { await call(uid, { action: 'claim', code, version: t.version }); continue; }
        const legal = legalCards(h, t.trick as Play[]);
        const r = await call(uid, { action: 'play', code, version: t.version, card: legal[legal.length - 1] });
        expect(r.status).toBe(200);
      }
      const end = table(code);
      expect(end.matchWinner).not.toBe(null);
      expect(Math.max(...end.scores)).toBeGreaterThanOrEqual(5);
      // Revanche : nouvelle partie, scores remis à zéro
      await call('ben', { action: 'rematch', code, version: end.version });
      expect(table(code).scores).toEqual([0, 0, 0, 0]);
    }
  });

  it('salle d’attente : l’hôte qui part passe la main, la table disparaît quand tout le monde est parti', async () => {
    const code = (await call('ana', { action: 'create', name: 'Ana' })).json.code;
    await call('ben', { action: 'join', code, name: 'Ben' });
    await call('ana', { action: 'leave', code });
    expect(table(code).hostUid).toBe('ben');
    await call('ben', { action: 'leave', code });
    expect(table(code)).toBeUndefined();
  });
});
