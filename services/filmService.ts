import { callApi } from './push';
import type { Film } from '../utils/films';

const call = async (body: Record<string, unknown>) => {
  const r = await callApi('/api/events', body);
  if (r.status !== 200) throw new Error(r.data?.error || `http_${r.status}`);
  return r.data;
};
export const listFilms = async (): Promise<{ films: Film[]; admin: boolean }> => call({ action: 'films.list' });
export const saveFilm = async (film: Partial<Film>): Promise<string> => (await call({ action: 'films.save', film })).id;
export const deleteFilm = async (id: string) => { await call({ action: 'films.delete', id }); };
