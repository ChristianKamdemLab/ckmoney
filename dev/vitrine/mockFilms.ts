import { FILMS_2026_11_21 } from '../../api/_lib/filmsSeed';
export const listFilms = async () => ({ films: FILMS_2026_11_21, admin: true });
export const saveFilm = async () => 'x';
export const deleteFilm = async () => undefined;
