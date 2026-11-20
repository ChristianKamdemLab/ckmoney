import { adminDb } from './admin.js';
import { COMPETITIONS, PronoMatch, MyPick, Pick, cleanPick, isOpen } from '../../utils/pronos.js';

// /api/radio, actions « pronos.* » (regroupées là : le plan gratuit Vercel est limité à 12 fonctions).
// Matchs : football-data.org (offre gratuite, clé FOOTBALL_DATA_KEY), relus au plus toutes les 20 min,
// de 3 jours avant à 7 jours après aujourd'hui. Collections fermées aux téléphones :
//   pronoMatches/{id}        le match, et les totaux (tally 1/N/2, scores) — jamais qui a dit quoi
//   pronoPicks/{id}_{uid}    le prono d'une personne, renvoyé à elle seule

const API = 'https://api.football-data.org/v4';
export const SYNC_EVERY_MS = 20 * 60_000;
const DAY = 86_400_000;
const matches = () => adminDb.collection('pronoMatches');
const picks = () => adminDb.collection('pronoPicks');
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

const team = (t: any) => ({
  name: String(t?.name || t?.shortName || '?').slice(0, 60),
  short: String(t?.shortName || t?.tla || t?.name || '?').slice(0, 30),
  crest: /^https:\/\//.test(String(t?.crest || '')) ? String(t.crest) : '',
});

/** Relit les matchs chez football-data.org si la dernière lecture date de plus de 20 min. */
export const syncMatches = async (now = Date.now(), f: typeof fetch = fetch) => {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) return { synced: false, reason: 'no_key' };
  const state = adminDb.collection('settings').doc('pronos');
  const last = (await state.get()).data()?.lastSync;
  if (last && now - Date.parse(last) < SYNC_EVERY_MS) return { synced: false, reason: 'fresh' };
  await state.set({ lastSync: new Date(now).toISOString() }, { merge: true });
  const url = `${API}/matches?competitions=${COMPETITIONS.map(c => c.code).join(',')}&dateFrom=${ymd(now - 3 * DAY)}&dateTo=${ymd(now + 7 * DAY)}`;
  const r = await f(url, { headers: { 'X-Auth-Token': key } });
  if (!r.ok) return { synced: false, reason: `http_${r.status}` };
  const list: any[] = (await r.json())?.matches || [];
  for (const m of list) {
    await matches().doc(String(m.id)).set({
      comp: String(m.competition?.code || ''), utcDate: String(m.utcDate), status: String(m.status),
      stage: String(m.stage || ''), matchday: m.matchday ?? null,
      home: team(m.homeTeam), away: team(m.awayTeam),
      score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
      updatedAt: new Date(now).toISOString(),
    }, { merge: true });
  }
  return { synced: true, count: list.length };
};

const toMatch = (id: string, d: any, mine: MyPick | null, now: number): PronoMatch => {
  const tally = { '1': d.tally?.['1'] || 0, N: d.tally?.N || 0, '2': d.tally?.['2'] || 0 } as Record<Pick, number>;
  const topScores = Object.entries(d.scores || {})
    .filter(([, n]) => (n as number) > 0)
    .map(([score, n]) => ({ score, n: n as number }))
    .sort((a, b) => b.n - a.n || a.score.localeCompare(b.score))
    .slice(0, 3);
  return {
    id, comp: d.comp, utcDate: d.utcDate, status: d.status, stage: d.stage || undefined, matchday: d.matchday ?? undefined,
    home: d.home, away: d.away, score: d.score || { home: null, away: null },
    tally, total: tally['1'] + tally.N + tally['2'], topScores, mine, open: isOpen(d.status, d.utcDate, now),
  };
};

export const listMatches = async (uid: string, now = Date.now()) => {
  const snap = await matches().where('utcDate', '>=', new Date(now - 3 * DAY).toISOString()).orderBy('utcDate', 'asc').limit(400).get();
  const docs = snap.docs.filter((d: any) => Date.parse(d.data().utcDate) <= now + 8 * DAY);
  const mine = await Promise.all(docs.map((d: any) => picks().doc(`${d.id}_${uid}`).get()));
  return docs.map((d: any, i: number) => {
    const p = mine[i].data();
    return toMatch(d.id, d.data(), p ? cleanPick(p) : null, now);
  });
};

/** Donner, changer ou retirer (pick = null) son prono, jusqu'au coup d'envoi. */
export const savePick = async (uid: string, matchId: string, raw: any, now = Date.now()) => {
  const id = String(matchId || '').replace(/[^0-9A-Za-z_-]/g, '').slice(0, 30);
  const next = raw?.pick == null ? null : cleanPick(raw);
  if (raw?.pick != null && !next) return { error: 'prono_invalide' as const };
  const mref = matches().doc(id);
  const pref = picks().doc(`${id}_${uid}`);
  return adminDb.runTransaction(async (tx: any) => {
    const m = await tx.get(mref);
    if (!m.exists) return { error: 'match_introuvable' as const };
    const d = m.data();
    if (!isOpen(d.status, d.utcDate, now)) return { error: 'pronos_fermes' as const };
    const prevDoc = await tx.get(pref);
    const prev: MyPick | null = prevDoc.exists ? cleanPick(prevDoc.data()) : null;
    const tally = { '1': d.tally?.['1'] || 0, N: d.tally?.N || 0, '2': d.tally?.['2'] || 0 } as Record<Pick, number>;
    const scores: Record<string, number> = { ...(d.scores || {}) };
    const key = (p: MyPick) => (p.home !== undefined ? `${p.home}-${p.away}` : '');
    if (prev) { tally[prev.pick] = Math.max(0, tally[prev.pick] - 1); const k = key(prev); if (k) scores[k] = Math.max(0, (scores[k] || 0) - 1); }
    if (next) { tally[next.pick]++; const k = key(next); if (k) scores[k] = (scores[k] || 0) + 1; }
    for (const k of Object.keys(scores)) if (!scores[k]) delete scores[k];
    tx.update(mref, { tally, scores });
    if (next) tx.set(pref, { matchId: id, uid, ...next, at: new Date(now).toISOString() });
    else if (prevDoc.exists) tx.delete(pref);
    return { match: toMatch(id, { ...d, tally, scores }, next, now) };
  });
};
