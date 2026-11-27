import { PronoMatch, Pick, pickOfScore } from '../../utils/pronos';
const d = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const t = (s: string, n: string) => ({ name: n, short: s, crest: '' });
let items: PronoMatch[] = [
  { id: '1', comp: 'FL1', utcDate: d(26), status: 'TIMED', home: t('PSG', 'Paris'), away: t('Marseille', 'OM'), score: { home: null, away: null }, tally: { '1': 8, N: 3, '2': 2 }, total: 13, topScores: [{ score: '2-1', n: 4 }, { score: '3-1', n: 2 }], mine: null, open: true },
  { id: '2', comp: 'CL', utcDate: d(50), status: 'TIMED', home: t('Real Madrid', 'Real'), away: t('Man City', 'City'), score: { home: null, away: null }, tally: { '1': 0, N: 0, '2': 0 }, total: 0, topScores: [], mine: null, open: true },
  { id: '3', comp: 'PL', utcDate: d(-20), status: 'FINISHED', home: t('Arsenal', 'Ars'), away: t('Chelsea', 'Che'), score: { home: 2, away: 2 }, tally: { '1': 3, N: 2, '2': 1 }, total: 6, topScores: [{ score: '2-1', n: 2 }], mine: { pick: 'N', home: 1, away: 1 }, open: false },
];
export const listPronos = async () => items;
export const savePick = async (id: string, pick: Pick | null, home?: number, away?: number) => {
  const m = items.find(x => x.id === id)!;
  const tally = { ...m.tally }; if (m.mine) tally[m.mine.pick]--; if (pick) tally[pick]++;
  const nm = { ...m, tally, total: tally['1'] + tally.N + tally['2'], mine: pick ? { pick, ...(home !== undefined ? { home, away } : {}) } : null };
  items = items.map(x => (x.id === id ? nm : x)); return nm;
};
