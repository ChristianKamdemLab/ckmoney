// « Mes adresses » (lieux testés et recommandés par Christian) et le prochain vendredi (Vendredi Show).
// Formes des données et nettoyage, sans dépendance.

export interface Place {
  id: string;
  name: string;
  address: string;
  url: string;
  review: string;   // l'avis de Christian
  budget: string;   // « Chicha 70 € », « Cocktail 15 € »…
  hours: string;
  image?: string;   // photo tirée du lien du lieu (serveur)
  updatedAt?: string;
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

/** Jour (AAAA-MM-JJ) à Paris. */
export const parisDay = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(now));
/** Le vendredi qui vient (aujourd'hui si on est vendredi), à Paris. */
export const nextFriday = (now = Date.now()) => {
  const d = new Date(parisDay(now) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
};
