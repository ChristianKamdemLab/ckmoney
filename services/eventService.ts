import { callApi } from './push';
import { AppEvent, EventInput } from '../utils/events';

// Événements vus depuis l'appli (compte connecté). La page publique /e/ID passe par fetchPublicEvent,
// sans Firebase.

const ok = (r: { status: number; data: any }) => {
  if (r.status !== 200) throw new Error(r.data?.error || `http_${r.status}`);
  return r.data;
};

let cache: { at: number; list: Promise<AppEvent[]> } | null = null;

/** Les événements à venir (et passés, pour l'auteur), du plus proche au plus lointain. */
export const listEvents = (fresh = false): Promise<AppEvent[]> => {
  if (!fresh && cache && Date.now() - cache.at < 120_000) return cache.list;
  const list = callApi('/api/events', { action: 'list' }).then(r => ok(r).events as AppEvent[]);
  cache = { at: Date.now(), list };
  list.catch(() => { cache = null; });
  return list;
};

export const saveEvent = async (e: EventInput): Promise<string> => { const r = ok(await callApi('/api/events', { action: 'save', event: e })).id; cache = null; return r; };
export const deleteEvent = async (id: string) => { ok(await callApi('/api/events', { action: 'delete', id })); cache = null; };
