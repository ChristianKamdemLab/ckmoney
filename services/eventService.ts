import { callApi } from './push';
import { AppEvent, EventInput } from '../utils/events';

// Sorties vues depuis l'appli (compte connecté). La page publique /e/ID passe par guestRsvp et fetch,
// sans Firebase.

const ok = (r: { status: number; data: any }) => {
  if (r.status !== 200) throw new Error(r.data?.error || `http_${r.status}`);
  return r.data;
};

let cache: { at: number; list: Promise<AppEvent[]> } | null = null;

/** Les sorties que la personne a le droit de voir (et toutes, pour l'auteur), de la plus proche à la plus lointaine. */
export const listEvents = (fresh = false): Promise<AppEvent[]> => {
  if (!fresh && cache && Date.now() - cache.at < 120_000) return cache.list;
  const list = callApi('/api/events', { action: 'list' }).then(r => ok(r).events as AppEvent[]);
  cache = { at: Date.now(), list };
  list.catch(() => { cache = null; });
  return list;
};

export const saveEvent = async (e: EventInput, notify = false): Promise<{ id: string; notified: number }> => {
  const r = ok(await callApi('/api/events', { action: 'save', event: e, notify }));
  cache = null;
  return { id: r.id, notified: r.notified || 0 };
};
export const deleteEvent = async (id: string) => { ok(await callApi('/api/events', { action: 'delete', id })); cache = null; };

/** « Je viens » / « Je ne viens plus » à un chill, avec son compte. */
export const rsvp = async (id: string, going: boolean): Promise<{ going: boolean; placesLeft: number | null }> => {
  const r = ok(await callApi('/api/events', { action: 'rsvp', id, going }));
  cache = null;
  return r;
};

/** Qui vient (auteur seulement). */
export const listRsvps = async (id: string): Promise<{ name: string; at: string; member: boolean }[]> =>
  ok(await callApi('/api/events', { action: 'rsvps', id })).people;

/** Les comptes CKMoney, pour choisir qui voit une sortie (auteur seulement). */
export const listPeople = async (): Promise<{ uid: string; name: string }[]> =>
  ok(await callApi('/api/events', { action: 'people' })).people;
