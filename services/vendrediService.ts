import { callApi } from './push';
import type { Place } from '../utils/vendredi';

const call = async (body: Record<string, unknown>) => {
  const r = await callApi('/api/events', body);
  if (r.status !== 200) throw new Error(r.data?.error || `http_${r.status}`);
  return r.data;
};

export const listPlaces = async (): Promise<{ places: Place[]; admin: boolean }> => call({ action: 'places.list' });
export const savePlace = async (place: Partial<Place>): Promise<string> => (await call({ action: 'places.save', place })).id;
export const deletePlace = async (id: string) => { await call({ action: 'places.delete', id }); };

// Vendredi Show (26/11) : les choix de vendredi soir, sans vote (voir utils/vendrediShow.ts)
import type { Show } from '../utils/vendrediShow';
export const getShow = async (): Promise<Show> => (await call({ action: 'show.get' })).show;
export const pickShow = async (choice: string | null): Promise<Show> => (await call({ action: 'show.pick', choice })).show;
export const addShow = async (input: { kind: 'place' | 'home'; name?: string; address?: string; url?: string }): Promise<Show> => (await call({ action: 'show.add', ...input })).show;
export const removeShow = async (id: string): Promise<Show> => (await call({ action: 'show.remove', id })).show;
