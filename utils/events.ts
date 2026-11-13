// Événements : forme des données, dates à l'heure de Paris, agenda, itinéraire. Sans dépendance,
// utilisé par l'appli, la page publique et le serveur (api/events).

export interface AppEvent {
  id: string;
  title: string;
  startsAt: string;      // ISO
  endsAt: string;        // ISO
  venue: string;         // lieu (ex. Palais de la Porte Dorée)
  address: string;       // adresse complète
  url: string;           // billetterie ou page officielle
  price: string;         // « Gratuit », « 10 € »…
  organizer: string;
  description: string;
  status: 'published' | 'draft';
  updatedAt?: string;
}

export type EventInput = Omit<AppEvent, 'id' | 'status' | 'updatedAt'> & { id?: string };

const TZ = 'Europe/Paris';
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('fr-FR', { timeZone: TZ, ...opts });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const time = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ').replace(/ h 00$/, ' h');

/** « Ven. 4 déc. » pour le bloc de date. */
export const dayBlock = (iso: string) => ({
  day: fmt(iso, { day: 'numeric' }),
  month: fmt(iso, { month: 'short' }).replace('.', ''),
  weekday: fmt(iso, { weekday: 'short' }).replace('.', ''),
});

/** « Du vendredi 4 décembre, 13 h, au samedi 5 décembre 2026, 19 h » ou « Samedi 5 décembre 2026, 14 h – 18 h ». */
export const whenText = (e: Pick<AppEvent, 'startsAt' | 'endsAt'>) => {
  const sameDay = dayKey(e.startsAt) === dayKey(e.endsAt);
  const d1 = fmt(e.startsAt, { weekday: 'long', day: 'numeric', month: 'long' });
  const d2 = fmt(e.endsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const day = cap(fmt(e.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  if (e.startsAt === e.endsAt) return `${day}, ${time(e.startsAt)}`;
  if (sameDay) return `${day}, ${time(e.startsAt)} – ${time(e.endsAt)}`;
  return `Du ${d1}, ${time(e.startsAt)}, au ${d2}, ${time(e.endsAt)}`;
};

/** Courte : « 4–5 déc. 2026 » ou « 5 déc. 2026 ». */
export const shortWhen = (e: Pick<AppEvent, 'startsAt' | 'endsAt'>) => {
  const a = new Date(e.startsAt), b = new Date(e.endsAt);
  const m = (d: Date) => fmt(d.toISOString(), { month: 'short' });
  const y = fmt(e.endsAt, { year: 'numeric' });
  const da = fmt(a.toISOString(), { day: 'numeric' }), db = fmt(b.toISOString(), { day: 'numeric' });
  if (dayKey(e.startsAt) === dayKey(e.endsAt)) return `${da} ${m(a)} ${y}`;
  return m(a) === m(b) ? `${da}–${db} ${m(b)} ${y}` : `${da} ${m(a)} – ${db} ${m(b)} ${y}`;
};

export const isUpcoming = (e: Pick<AppEvent, 'endsAt'>, now = Date.now()) => new Date(e.endsAt).getTime() >= now;
export const sortUpcoming = <T extends Pick<AppEvent, 'startsAt' | 'endsAt'>>(list: T[], now = Date.now()) =>
  list.filter(e => isUpcoming(e, now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Fichier agenda (.ics) : iPhone, Android, Outlook. */
export const icsFor = (e: AppEvent, pageUrl: string) => [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CKLabs//CKMoney//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  'BEGIN:VEVENT',
  `UID:${e.id}@ck-money`,
  `DTSTAMP:${stamp(new Date().toISOString())}`,
  `DTSTART:${stamp(e.startsAt)}`,
  `DTEND:${stamp(e.endsAt)}`,
  `SUMMARY:${icsText(e.title)}`,
  `LOCATION:${icsText([e.venue, e.address].filter(Boolean).join(', '))}`,
  `DESCRIPTION:${icsText([e.description, e.url, pageUrl].filter(Boolean).join('\n\n'))}`,
  `URL:${pageUrl}`,
  'END:VEVENT', 'END:VCALENDAR',
].join('\r\n');

export const googleCalendarUrl = (e: AppEvent, pageUrl: string) =>
  `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: 'TEMPLATE', text: e.title, dates: `${stamp(e.startsAt)}/${stamp(e.endsAt)}`,
    location: [e.venue, e.address].filter(Boolean).join(', '), details: [e.description, e.url, pageUrl].filter(Boolean).join('\n\n'),
  })}`;

export const mapsUrl = (e: Pick<AppEvent, 'venue' | 'address'>) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.venue, e.address].filter(Boolean).join(', '))}`;

/** Validation et nettoyage (côté serveur). Renvoie null si l'événement n'est pas complet. */
export const cleanEvent = (raw: any): Omit<EventInput, 'id'> | null => {
  const s = (v: unknown, max: number) => String(v ?? '').replace(/[<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
  const iso = (v: unknown) => { const d = new Date(String(v || '')); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
  const title = s(raw?.title, 120);
  const startsAt = iso(raw?.startsAt);
  const endsAt = iso(raw?.endsAt) || startsAt;
  const url = s(raw?.url, 500);
  if (!title || !startsAt || !endsAt || endsAt < startsAt) return null;
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return null;
  return {
    title, startsAt, endsAt, url,
    venue: s(raw?.venue, 120), address: s(raw?.address, 200), price: s(raw?.price, 40) || 'Gratuit',
    organizer: s(raw?.organizer, 120), description: String(raw?.description ?? '').replace(/[<>]/g, '').trim().slice(0, 2000),
  };
};

/** Texte qui accompagne le lien partagé (WhatsApp, SMS…). */
export const shareText = (e: Pick<AppEvent, 'title' | 'startsAt' | 'endsAt' | 'venue' | 'price'>) =>
  `${e.title}\n${[shortWhen(e), e.venue, e.price].filter(Boolean).join(' · ')}`;

/** ISO ⇄ champ « date et heure » du téléphone (heure locale). */
export const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => { const d = new Date(v); return v && !Number.isNaN(d.getTime()) ? d.toISOString() : ''; };

/** Nom de domaine lisible du lien de réservation (billetweb.fr). */
export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Lien « événement préparé » : les champs voyagent dans l'adresse (base64url de JSON). */
export const encodePrefill = (e: Partial<EventInput>) => {
  let bin = '';
  new TextEncoder().encode(JSON.stringify(e)).forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const decodePrefill = (s: string): Partial<EventInput> | undefined => {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const v = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined;
  } catch { return undefined; }
};

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
