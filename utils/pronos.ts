// Pronos foot : partagé entre l'appli et le serveur (api/_lib/pronos.ts).
// Chacun donne 1, N ou 2 (et, s'il veut, le score exact) avant le coup d'envoi. Les pronos sont
// anonymes : on ne montre que les tendances (pourcentages et scores les plus joués). Pas de classement,
// pas de cotes, aucun lien vers un site de paris.

export const COMPETITIONS = [
  { code: 'FL1', name: 'Ligue 1', short: 'Ligue 1' },
  { code: 'PL', name: 'Premier League', short: 'Premier League' },
  { code: 'PD', name: 'Liga', short: 'Liga' },
  { code: 'SA', name: 'Serie A', short: 'Serie A' },
  { code: 'BL1', name: 'Bundesliga', short: 'Bundesliga' },
  { code: 'CL', name: 'Ligue des champions', short: 'Ligue des champions' },
] as const;
export type CompCode = typeof COMPETITIONS[number]['code'];
export const compName = (code: string) => COMPETITIONS.find(c => c.code === code)?.name || code;

export type Pick = '1' | 'N' | '2';
export interface Team { name: string; short: string; crest: string }
export interface MyPick { pick: Pick; home?: number; away?: number }
export interface PronoMatch {
  id: string; comp: string; utcDate: string; status: string; stage?: string; matchday?: number;
  home: Team; away: Team;
  score: { home: number | null; away: number | null };
  tally: Record<Pick, number>; total: number;
  topScores: { score: string; n: number }[];
  mine: MyPick | null;
  open: boolean;
}

export const MAX_GOALS = 15;
export const pickOfScore = (h: number, a: number): Pick => (h > a ? '1' : h < a ? '2' : 'N');

/** Un prono valide : 1, N ou 2 ; le score exact, s'il est donné, doit aller avec. */
export const cleanPick = (raw: any): MyPick | null => {
  if (!raw || !['1', 'N', '2'].includes(raw.pick)) return null;
  const has = raw.home !== undefined && raw.home !== null && raw.away !== undefined && raw.away !== null;
  if (!has) return { pick: raw.pick };
  const h = Number(raw.home), a = Number(raw.away);
  if (![h, a].every(n => Number.isInteger(n) && n >= 0 && n <= MAX_GOALS)) return null;
  if (pickOfScore(h, a) !== raw.pick) return null;
  return { pick: raw.pick, home: h, away: a };
};

/** On pronostique jusqu'au coup d'envoi. */
export const isOpen = (status: string, utcDate: string, now = Date.now()) =>
  ['SCHEDULED', 'TIMED'].includes(status) && Date.parse(utcDate) > now;

export const isFinished = (status: string) => status === 'FINISHED';
export const isLiveStatus = (status: string) => ['IN_PLAY', 'PAUSED', 'LIVE'].includes(status);

export const percents = (tally: Record<Pick, number>) => {
  const total = tally['1'] + tally.N + tally['2'];
  if (!total) return { '1': 0, N: 0, '2': 0 } as Record<Pick, number>;
  const raw = (['1', 'N', '2'] as Pick[]).map(k => (tally[k] / total) * 100);
  const floor = raw.map(Math.floor);
  let rest = 100 - floor.reduce((s, x) => s + x, 0);
  raw.map((x, i) => [x - floor[i], i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { floor[i]++; rest--; } });
  return { '1': floor[0], N: floor[1], '2': floor[2] } as Record<Pick, number>;
};
