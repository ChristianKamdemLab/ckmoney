// « Nouveau » depuis la dernière visite : on retient sur le téléphone quand chaque rubrique a été
// ouverte. Première fois : est nouveau ce qui date de moins de 7 jours.

export type Section = 'articles' | 'radio';
const KEY = 'ck_seen';
const WEEK = 7 * 86_400_000;

const read = (): Partial<Record<Section, number>> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

/** Moment de la dernière visite (ou il y a 7 jours). */
export const seenAt = (s: Section, now = Date.now()) => read()[s] ?? now - WEEK;
export const markSeen = (s: Section, now = Date.now()) => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), [s]: now })); } catch { /* stockage indisponible */ } };
export const isNewSince = (iso: string | undefined, since: number) => !!iso && Date.parse(iso) > since;
