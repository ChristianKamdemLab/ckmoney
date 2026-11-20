// « Mes adresses » (lieux testés et recommandés par Christian) et « Mon vendredi soir » (2 ou 3 options,
// les proches votent, Christian tranche). Formes des données et nettoyage, sans dépendance.

export interface Place {
  id: string;
  name: string;
  address: string;
  url: string;
  review: string;   // l'avis de Christian
  budget: string;   // « Chicha 70 € », « Cocktail 15 € »…
  hours: string;
  updatedAt?: string;
}

export type OptionKind = 'home' | 'place';
export interface FridayOption { id: string; kind: OptionKind; placeId?: string; name: string; address: string; why: string; votes?: number }
export interface Friday {
  date: string;              // le vendredi, AAAA-MM-JJ
  intro: string;
  options: FridayOption[];
  decided?: string | null;   // option retenue
  myVote?: string | null;
  total?: number;
}

const s = (v: unknown, max: number) => String(v ?? '').replace(/[<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const text = (v: unknown, max: number) => String(v ?? '').replace(/[<>]/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const url = (v: unknown) => { const u = s(v, 500); return /^https:\/\/\S+$/i.test(u) ? u : ''; };
export const cleanId = (v: unknown) => String(v ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

export const cleanPlace = (raw: any): Omit<Place, 'id' | 'updatedAt'> | null => {
  const name = s(raw?.name, 80);
  const review = text(raw?.review, 1500);
  if (!name || !review) return null;
  return { name, address: s(raw?.address, 160), url: url(raw?.url), review, budget: s(raw?.budget, 80), hours: s(raw?.hours, 120) };
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const cleanFriday = (raw: any): Omit<Friday, 'myVote' | 'total'> | null => {
  const date = String(raw?.date || '');
  if (!ISO_DAY.test(date) || Number.isNaN(Date.parse(date))) return null;
  const options: FridayOption[] = (Array.isArray(raw?.options) ? raw.options : []).slice(0, 3).map((o: any, i: number) => ({
    id: 'abc'[i], kind: o?.kind === 'home' ? 'home' as const : 'place' as const, placeId: cleanId(o?.placeId) || undefined,
    name: s(o?.kind === 'home' && !o?.name ? 'Chez moi' : o?.name, 80), address: s(o?.address, 160), why: text(o?.why, 400),
  })).filter((o: FridayOption) => o.name && o.why);
  if (options.length < 2) return null;
  options.forEach((o, i) => { o.id = 'abc'[i]; if (!o.placeId) delete o.placeId; });
  return { date, intro: text(raw?.intro, 300), options, decided: null };
};

/** Jour (AAAA-MM-JJ) à Paris. */
export const parisDay = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(now));
/** Le vendredi qui vient (aujourd'hui si on est vendredi), à Paris. */
export const nextFriday = (now = Date.now()) => {
  const d = new Date(parisDay(now) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
};
/** Le vote reste ouvert jusqu'au samedi midi (heure de Paris). */
export const isOpen = (date: string, now = Date.now()) => parisDay(now) <= date || (parisDay(now) === addDays(date, 1) && Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).format(new Date(now))) < 12);
/** Visible dans l'appli du lundi qui précède au samedi soir. */
export const isCurrent = (date: string, now = Date.now()) => parisDay(now) >= addDays(date, -4) && parisDay(now) <= addDays(date, 1);
export const addDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Nombre de votes par option, à partir de { uid: option }. */
export const tally = (votes: Record<string, string>, options: FridayOption[]) => {
  const n: Record<string, number> = Object.fromEntries(options.map(o => [o.id, 0]));
  Object.values(votes || {}).forEach(v => { if (v in n) n[v]++; });
  return n;
};
