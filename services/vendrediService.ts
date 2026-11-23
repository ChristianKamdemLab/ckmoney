import { callApi } from './push';
import type { Friday, Place } from '../utils/vendredi';

const call = async (body: Record<string, unknown>) => {
  const r = await callApi('/api/events', body);
  if (r.status !== 200) throw new Error(r.data?.error || `http_${r.status}`);
  return r.data;
};

let fridayCache: { at: number; p: Promise<{ friday: Friday | null; admin: boolean }> } | null = null;
export const getFriday = (fresh = false) => {
  if (fresh || !fridayCache || Date.now() - fridayCache.at > 60_000) {
    const p = call({ action: 'friday.get' }).then(d => ({ friday: d.friday as Friday | null, admin: !!d.admin }));
    p.catch(() => { fridayCache = null; });
    fridayCache = { at: Date.now(), p };
  }
  return fridayCache.p;
};
export const voteFriday = async (date: string, option: string | null): Promise<Friday> => { fridayCache = null; return (await call({ action: 'friday.vote', date, option })).friday; };
export const saveFriday = async (friday: Omit<Friday, 'myVote' | 'total' | 'decided'>, notify: boolean): Promise<number> => { fridayCache = null; return (await call({ action: 'friday.save', friday, notify })).notified || 0; };
export const decideFriday = async (date: string, option: string): Promise<{ friday: Friday; notified: number }> => { fridayCache = null; return call({ action: 'friday.decide', date, option }); };

export const listPlaces = async (): Promise<{ places: Place[]; admin: boolean }> => call({ action: 'places.list' });
export const savePlace = async (place: Partial<Place>): Promise<string> => (await call({ action: 'places.save', place })).id;
export const deletePlace = async (id: string) => { await call({ action: 'places.delete', id }); };
