// « Films et séries » : ce que Christian a regardé, avec sa note sur 10 et son avis.

export type FilmKind = 'film' | 'serie';
export interface Film {
  id: string;
  kind: FilmKind;
  title: string;
  season: string;    // « Saison 2 » (séries)
  by: string;        // réalisateur, créateur
  where: string;     // « Paramount+ », « HBO Max », « Au cinéma »
  rating: number;    // 0 à 10
  teaser: string;    // une phrase, sans spoiler
  review: string;    // l'avis de Christian, sans spoiler (toujours visible)
  spoilerText: string; // la suite, qui dévoile l'intrigue : masquée derrière « Lire quand même »
  spoilers: boolean; // ancien format : tout l'avis dévoile l'intrigue
  trailer: string;   // identifiant YouTube de la bande-annonce officielle (son image sert d'affiche)
  poster: string;    // affiche verticale (lien https d'une image), facultative
  updatedAt?: string;
}

/** Identifiant YouTube (11 caractères) d'un lien youtube.com / youtu.be, ou de l'identifiant seul. */
export const youtubeId = (v: unknown) => {
  const t = String(v ?? '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  const m = t.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
};
/** Image de la bande-annonce (grande, puis repli). */
export const trailerImage = (id: string, size: 'max' | 'hq' = 'max') => `https://i.ytimg.com/vi/${id}/${size === 'max' ? 'maxresdefault' : 'hqdefault'}.jpg`;

const s = (v: unknown, max: number) => String(v ?? '').replace(/[<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const text = (v: unknown, max: number) => String(v ?? '').replace(/[<>]/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

export const cleanFilm = (raw: any): Omit<Film, 'id' | 'updatedAt'> | null => {
  const title = s(raw?.title, 100), review = text(raw?.review, 4000);
  const rating = Math.round(Number(raw?.rating) * 2) / 2;
  if (!title || !review || !(rating >= 0 && rating <= 10)) return null;
  return {
    kind: raw?.kind === 'film' ? 'film' : 'serie', title, season: s(raw?.season, 40), by: s(raw?.by, 80), where: s(raw?.where, 60),
    rating, teaser: s(raw?.teaser, 200), review, spoilerText: text(raw?.spoilerText, 3000), spoilers: false,
    trailer: youtubeId(raw?.trailer), poster: /^https:\/\/\S+$/i.test(s(raw?.poster, 500)) ? s(raw?.poster, 500) : '',
  };
};

export const KIND_LABEL: Record<FilmKind, string> = { film: 'Film', serie: 'Série' };
/** « 8/10 », « 7,5/10 » */
export const ratingLabel = (r: number) => `${String(r).replace('.', ',')}/10`;
