import { describe, it, expect, vi, beforeEach } from 'vitest';

// Serveur du Baccalauréat (api/bac) testé avec une base Firestore simulée en mémoire.

const store = new Map<string, any>();
const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const snap = (path: string) => ({ exists: store.has(path), data: () => clone(store.get(path)) });
const docRef = (path: string): any => ({
  path, collection: (c: string) => colRef(`${path}/${c}`),
  get: async () => snap(path), set: async (d: any) => { store.set(path, clone(d)); },
});
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

const { default: handler } = await import('../api/bac');

let clock = 5_000_000;
const call = async (uid: string, body: Record<string, unknown>) => {
  let status = 200, json: any = null;
  const res = { status: (s: number) => { status = s; return res; }, json: (j: any) => { json = j; return res; }, end: () => res };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${uid}` }, body } as any, res as any);
  return { status, json };
};
const table = (code: string) => clone(store.get(`bacTables/${code}`));
const word = (letter: string, cat: string, who: string) => `${letter}${cat.slice(0, 3).toLowerCase()}${who}`;

beforeEach(() => { store.clear(); clock = 5_000_000; vi.spyOn(Date, 'now').mockImplementation(() => clock); });

const setup = async () => {
  const code = (await call('ana', { action: 'create', name: 'Ana' })).json.code;
  await call('ben', { action: 'join', code, name: 'Ben' });
  await call('cyr', { action: 'join', code, name: 'Cyr' });
  await call('ana', { action: 'config', code, categories: ['Pays', 'Animal', 'Métier'], rounds: 3, duration: 90 });
  await call('ana', { action: 'start', code });
  return code;
};

describe('Baccalauréat en ligne : serveur', () => {
  it('les réponses restent cachées pendant l’écriture', async () => {
    const code = await setup();
    const t = table(code);
    expect(t.status).toBe('writing');
    expect(t.letter).toMatch(/^[A-Z]$/);
    await call('ana', { action: 'save', code, round: 1, answers: ['Bénin', 'Baleine', ''] });
    expect(JSON.stringify(table(code))).not.toContain('Baleine');
    expect(table(code).filled).toEqual({ ana: 2 });
  });

  it('STOP seulement avec toutes les cases remplies, puis 10 s pour les autres', async () => {
    const code = await setup();
    const L = table(code).letter;
    await call('ana', { action: 'save', code, round: 1, answers: [word(L, 'Pays', 'a'), word(L, 'Animal', 'a'), ''] });
    expect((await call('ana', { action: 'stop', code })).json.error).toBe('incomplet');
    await call('ana', { action: 'save', code, round: 1, answers: [word(L, 'Pays', 'a'), word(L, 'Animal', 'a'), word(L, 'Metier', 'a')] });
    await call('ana', { action: 'stop', code });
    expect(table(code).stopAt).toBe(clock + 10_000);
    clock += 5_000;
    expect((await call('ben', { action: 'close', code })).json.wait).toBeGreaterThan(0);
    await call('ben', { action: 'save', code, round: 1, answers: [word(L, 'Pays', 'a'), '', ''] });
    clock += 7_000;
    // Trop tard : la réponse n'est plus acceptée
    expect((await call('cyr', { action: 'save', code, round: 1, answers: ['x', 'y', 'z'] })).json.late).toBe(true);
    await call('cyr', { action: 'close', code });
    const t = table(code);
    expect(t.status).toBe('review');
    expect(t.review[0].answers.map((a: any) => a.text)).toEqual([word(L, 'Pays', 'a'), word(L, 'Pays', 'a'), '']);
    expect(t.review[1].answers[1].auto).toBe('vide');
  });

  it('sortie de l’appli signalée à tous', async () => {
    const code = await setup();
    await call('ben', { action: 'away', code, state: 'out' });
    expect(table(code).away.ben).toEqual({ n: 1, secs: 0, out: true });
    await call('ben', { action: 'away', code, state: 'back', secs: 14 });
    expect(table(code).away.ben).toEqual({ n: 1, secs: 14, out: false });
  });

  it('contestations, points et partie complète', async () => {
    const code = await setup();
    for (let round = 1; round <= 3; round++) {
      const L = table(code).letter;
      await call('ana', { action: 'save', code, round, answers: [word(L, 'Pays', 'x'), word(L, 'Animal', 'a'), word(L, 'Metier', 'a')] });
      await call('ben', { action: 'save', code, round, answers: [word(L, 'Pays', 'x'), word(L, 'Animal', 'b'), 'Zzz'] });
      await call('cyr', { action: 'save', code, round, answers: [word(L, 'Pays', 'c'), '', word(L, 'Metier', 'c')] });
      clock += 91_600;
      await call('ana', { action: 'close', code });
      // Ana et Ben contestent le métier de Cyr
      await call('ana', { action: 'vote', code, cat: 2, target: 'cyr' });
      await call('ben', { action: 'vote', code, cat: 2, target: 'cyr' });
      expect((await call('cyr', { action: 'vote', code, cat: 2, target: 'cyr' })).status).toBe(400); // pas soi-même
      for (const u of ['ana', 'ben', 'cyr']) await call(u, { action: 'ready', code });
      const t = table(code);
      expect(t.status).toBe('scores');
      // Pays : Ana et Ben pareil (5 chacun), Cyr seul (10). Animal : Ana 10, Ben 10. Métier : Ana 10, Ben lettre (0), Cyr contesté (0)
      expect(t.roundPoints).toEqual({ ana: 25, ben: 15, cyr: 10 });
      expect(t.scores).toEqual({ ana: 25 * round, ben: 15 * round, cyr: 10 * round });
      if (round < 3) await call('cyr', { action: 'next', code, version: t.version });
    }
    expect(new Set(table(code).usedLetters).size).toBe(3);
    // Dernière manche : plus de « suivante », revanche possible
    await call('ana', { action: 'next', code });
    expect(table(code).round).toBe(3);
    await call('ben', { action: 'rematch', code });
    expect(table(code).status).toBe('lobby');
  });

  it("l'hôte peut compter les points sans attendre tout le monde", async () => {
    const code = await setup();
    clock += 91_600;
    await call('ana', { action: 'close', code });
    expect((await call('ben', { action: 'score', code })).status).toBe(403);
    await call('ana', { action: 'score', code });
    expect(table(code).status).toBe('scores');
  });
});
