import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanPick, percents, isOpen, pickOfScore } from '../utils/pronos';

// Pronos foot : règles, synchronisation football-data.org (simulée), totaux anonymes.

const store = new Map<string, any>();
const snapOf = (path: string) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => store.get(path) });
const docRef = (path: string): any => ({
  id: path.split('/').pop(), path,
  get: async () => snapOf(path),
  set: async (d: any, o?: { merge?: boolean }) => { store.set(path, o?.merge ? { ...store.get(path), ...d } : d); },
  update: async (d: any) => { store.set(path, { ...store.get(path), ...d }); },
  delete: async () => { store.delete(path); },
});
const colRef = (name: string): any => ({
  doc: (id: string) => docRef(`${name}/${id}`),
  where: (f: string, _op: string, v: any) => ({
    orderBy: () => ({ limit: () => ({ get: async () => ({
      docs: [...store.keys()].filter(k => k.startsWith(`${name}/`) && k.split('/').length === 2 && store.get(k)[f] >= v)
        .sort((a, b) => store.get(a)[f].localeCompare(store.get(b)[f])).map(snapOf),
    }) }) }),
  }),
});
const runTransaction = async (fn: any) => fn({
  get: (r: any) => r.get(), set: (r: any, d: any) => r.set(d), update: (r: any, d: any) => r.update(d), delete: (r: any) => r.delete(),
});
vi.mock('../api/_lib/admin.js', () => ({ adminDb: { collection: colRef, runTransaction } }));

const { syncMatches, listMatches, savePick, SYNC_EVERY_MS } = await import('../api/_lib/pronos');

const NOW = Date.parse('2026-11-20T17:00:00Z');
const apiMatch = (id: number, utcDate: string, status = 'TIMED', score = { home: null, away: null }) => ({
  id, utcDate, status, matchday: 13, stage: 'REGULAR_SEASON', competition: { code: 'FL1' },
  homeTeam: { name: 'Paris Saint-Germain FC', shortName: 'PSG', crest: 'https://crests.football-data.org/524.png' },
  awayTeam: { name: 'Olympique de Marseille', shortName: 'Marseille', crest: 'javascript:alert(1)' },
  score: { fullTime: score },
});
const calls: string[] = [];
const fakeFetch = (async (url: string) => {
  calls.push(url);
  return new Response(JSON.stringify({ matches: [
    apiMatch(1, '2026-11-22T20:00:00Z'),
    apiMatch(2, '2026-11-19T20:00:00Z', 'FINISHED', { home: 2, away: 1 } as any),
  ] }));
}) as any;

beforeEach(() => { store.clear(); calls.length = 0; process.env.FOOTBALL_DATA_KEY = 'cle'; });

describe('Pronos foot : règles', () => {
  it('1, N ou 2 ; le score, s’il est donné, doit aller avec', () => {
    expect(cleanPick({ pick: '1' })).toEqual({ pick: '1' });
    expect(cleanPick({ pick: '1', home: 2, away: 1 })).toEqual({ pick: '1', home: 2, away: 1 });
    expect(cleanPick({ pick: 'N', home: 2, away: 1 })).toBeNull();
    expect(cleanPick({ pick: 'X' })).toBeNull();
    expect(cleanPick({ pick: '2', home: -1, away: 3 })).toBeNull();
    expect(pickOfScore(0, 0)).toBe('N');
  });
  it('pourcentages qui tombent juste à 100', () => {
    expect(percents({ '1': 1, N: 1, '2': 1 })).toEqual({ '1': 34, N: 33, '2': 33 });
    expect(percents({ '1': 0, N: 0, '2': 0 })).toEqual({ '1': 0, N: 0, '2': 0 });
  });
  it('fermé au coup d’envoi', () => {
    expect(isOpen('TIMED', '2026-11-22T20:00:00Z', NOW)).toBe(true);
    expect(isOpen('TIMED', '2026-11-20T16:59:00Z', NOW)).toBe(false);
    expect(isOpen('IN_PLAY', '2026-11-22T20:00:00Z', NOW)).toBe(false);
  });
});

describe('Pronos foot : serveur', () => {
  it('lit les matchs (J-3 à J+7, 6 compétitions) au plus toutes les 20 minutes', async () => {
    expect(await syncMatches(NOW, fakeFetch)).toEqual({ synced: true, count: 2 });
    expect(calls[0]).toContain('competitions=FL1,PL,PD,SA,BL1,CL&dateFrom=2026-11-17&dateTo=2026-11-27');
    expect(store.get('pronoMatches/1')).toMatchObject({ comp: 'FL1', status: 'TIMED', home: { short: 'PSG' }, away: { short: 'Marseille', crest: '' } });
    expect((await syncMatches(NOW + 60_000, fakeFetch)).reason).toBe('fresh');
    expect((await syncMatches(NOW + SYNC_EVERY_MS + 1, fakeFetch)).synced).toBe(true);
    delete process.env.FOOTBALL_DATA_KEY;
    expect((await syncMatches(NOW + 3 * SYNC_EVERY_MS, fakeFetch)).reason).toBe('no_key');
  });

  it('pronos anonymes : totaux et scores les plus joués, chacun ne revoit que le sien ; changer, retirer', async () => {
    await syncMatches(NOW, fakeFetch);
    await savePick('anne', '1', { pick: '1', home: 2, away: 0 }, NOW);
    await savePick('bob', '1', { pick: '1', home: 2, away: 0 }, NOW);
    const r: any = await savePick('chris', '1', { pick: 'N' }, NOW);
    expect(r.match).toMatchObject({ tally: { '1': 2, N: 1, '2': 0 }, total: 3, topScores: [{ score: '2-0', n: 2 }], mine: { pick: 'N' } });
    const list = await listMatches('anne', NOW);
    const m1 = list.find(m => m.id === '1')!;
    expect(m1.mine).toEqual({ pick: '1', home: 2, away: 0 });
    expect(JSON.stringify(list)).not.toMatch(/bob|chris/);
    // Bob change d'avis, puis Anne retire le sien
    await savePick('bob', '1', { pick: '2', home: 0, away: 1 }, NOW);
    const after: any = await savePick('anne', '1', { pick: null }, NOW);
    expect(after.match).toMatchObject({ tally: { '1': 0, N: 1, '2': 1 }, topScores: [{ score: '0-1', n: 1 }], mine: null });
    expect(store.has('pronoPicks/1_anne')).toBe(false);
  });

  it('refuse un prono après le coup d’envoi ou incohérent', async () => {
    await syncMatches(NOW, fakeFetch);
    expect(await savePick('anne', '2', { pick: '1' }, NOW)).toEqual({ error: 'pronos_fermes' });
    expect(await savePick('anne', '1', { pick: 'N', home: 3, away: 1 }, NOW)).toEqual({ error: 'prono_invalide' });
    expect(await savePick('anne', '999', { pick: '1' }, NOW)).toEqual({ error: 'match_introuvable' });
  });
});
