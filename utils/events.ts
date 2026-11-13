// Événements : forme des données, dates à l'heure de Paris, agenda, itinéraire. Sans dépendance,
// utilisé par l'appli, la page publique et le serveur (api/events).

export type EventKind = 'event' | 'spot' | 'chill';
export type Audience = 'all' | 'some' | 'link';

export interface AppEvent {
  id: string;
  kind: EventKind;       // événement (salon…), spot (« je suis au bar X »), chill (organisé par l'auteur)
  title: string;
  startsAt: string;      // ISO
  endsAt: string;        // ISO
  venue: string;         // lieu (ex. Palais de la Porte Dorée)
  address: string;       // adresse complète
  url: string;           // billetterie ou page officielle
  price: string;         // « Gratuit », « 10 € »… (événements)
  organizer: string;
  description: string;
  theme: string;         // chill : thème de discussion
  drinks: string;        // chill : boissons
  capacity: number | null; // chill : nombre de places
  placesLeft?: number | null;
  status: 'published' | 'draft';
  updatedAt?: string;
  // Réservé à l'auteur
  audience?: Audience;
  invitees?: string[];
  going?: number;
  // Pour la personne connectée
  meGoing?: boolean;
}

export type EventInput = Omit<AppEvent, 'id' | 'status' | 'updatedAt' | 'placesLeft' | 'going' | 'meGoing'> & { id?: string };

export const KIND_LABEL: Record<EventKind, string> = { event: 'Événement', spot: 'Spot', chill: 'Chill' };
export const AUDIENCE_LABEL: Record<Audience, string> = { all: 'Tout le monde', some: 'Certaines personnes', link: 'Seulement par lien' };

const TZ = 'Europe/Paris';
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('fr-FR', { timeZone: TZ, ...opts });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const time = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ').replace(/ h 00$/, ' h').replace(/^0(\d)/, '$1').replace(/ /g, '\u00a0');
const hourOf = (iso: string) => parseInt(fmt(iso, { hour: '2-digit', hour12: false }), 10) % 24;
/** Même jour, ou même soirée qui finit avant 6 h du matin (« 20 h – 0 h 30 »). */
const sameEvening = (a: string, b: string) => {
  if (dayKey(a) === dayKey(b)) return true;
  const next = dayKey(new Date(Date.parse(a) + 86_400_000).toISOString()) === dayKey(b);
  return next && hourOf(b) < 6 && Date.parse(b) - Date.parse(a) < 86_400_000;
};

/** « Ven. 4 déc. » pour le bloc de date. */
export const dayBlock = (iso: string) => ({
  day: fmt(iso, { day: 'numeric' }),
  month: fmt(iso, { month: 'short' }).replace('.', ''),
  weekday: fmt(iso, { weekday: 'short' }).replace('.', ''),
});

/** « Du vendredi 4 décembre, 13 h, au samedi 5 décembre 2026, 19 h » ou « Samedi 5 décembre 2026, 14 h – 18 h ». */
export const whenText = (e: Pick<AppEvent, 'startsAt' | 'endsAt'>) => {
  const sameDay = sameEvening(e.startsAt, e.endsAt);
  const d1 = fmt(e.startsAt, { weekday: 'long', day: 'numeric', month: 'long' });
  const d2 = fmt(e.endsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const day = cap(fmt(e.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  if (e.startsAt === e.endsAt) return `${day}, ${time(e.startsAt)}`;
  if (sameDay) return `${day}, ${time(e.startsAt)} – ${time(e.endsAt)}`;
  return `Du ${d1}, ${time(e.startsAt)}, au ${d2}, ${time(e.endsAt)}`;
};

/** « jusqu'à 4 h » */
export const untilText = (e: Pick<AppEvent, 'endsAt'>) => `jusqu'à ${time(e.endsAt)}`;

/** Courte : « 4–5 déc. 2026 » ou « 5 déc. 2026 ». */
export const shortWhen = (e: Pick<AppEvent, 'startsAt' | 'endsAt'>) => {
  const a = new Date(e.startsAt), b = new Date(e.endsAt);
  const m = (d: Date) => fmt(d.toISOString(), { month: 'short' });
  const y = fmt(e.endsAt, { year: 'numeric' });
  const da = fmt(a.toISOString(), { day: 'numeric' }), db = fmt(b.toISOString(), { day: 'numeric' });
  if (sameEvening(e.startsAt, e.endsAt)) return `${da} ${m(a)} ${fmt(e.startsAt, { year: 'numeric' })}`;
  return m(a) === m(b) ? `${da}–${db} ${m(b)} ${y}` : `${da} ${m(a)} – ${db} ${m(b)} ${y}`;
};

export const isUpcoming = (e: Pick<AppEvent, 'endsAt'>, now = Date.now()) => new Date(e.endsAt).getTime() >= now;
/** En cours : commencé et pas encore fini (un spot « en ce moment »). */
export const isLive = (e: Pick<AppEvent, 'startsAt' | 'endsAt'>, now = Date.now()) => new Date(e.startsAt).getTime() <= now && now <= new Date(e.endsAt).getTime();
/** Fin par défaut d'un spot : un spot du soir (à partir de 16 h) ou de la nuit finit à 4 h du matin
 *  (heure du téléphone) ; un spot de journée dure 6 h. */
export const defaultSpotEnd = (startIso: string) => {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  if (h >= 4 && h < 16) return new Date(d.getTime() + 6 * 3_600_000).toISOString();
  const end = new Date(d);
  end.setHours(4, 0, 0, 0);
  if (end.getTime() <= d.getTime()) end.setDate(end.getDate() + 1);
  return end.toISOString();
};
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
  const kind: EventKind = raw?.kind === 'spot' || raw?.kind === 'chill' ? raw.kind : 'event';
  const audience: Audience = raw?.audience === 'some' || raw?.audience === 'link' ? raw.audience : 'all';
  const title = s(raw?.title, 120);
  const startsAt = iso(raw?.startsAt);
  const endsAt = iso(raw?.endsAt) || (startsAt && kind === 'spot' ? new Date(Date.parse(startsAt) + 6 * 3_600_000).toISOString() : startsAt);
  const url = s(raw?.url, 500);
  if (!title || !startsAt || !endsAt || endsAt < startsAt) return null;
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return null;
  const cap = Math.floor(Number(raw?.capacity));
  const invitees = audience === 'some' && Array.isArray(raw?.invitees)
    ? [...new Set<string>(raw.invitees.map((u: unknown) => String(u).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128)).filter(Boolean))].slice(0, 200)
    : [];
  return {
    kind, audience, invitees, title, startsAt, endsAt, url,
    venue: s(raw?.venue, 120), address: s(raw?.address, 200),
    price: kind === 'event' ? s(raw?.price, 40) || 'Gratuit' : s(raw?.price, 40),
    organizer: s(raw?.organizer, 120), description: String(raw?.description ?? '').replace(/[<>]/g, '').trim().slice(0, 2000),
    theme: kind === 'chill' ? s(raw?.theme, 200) : '', drinks: kind === 'chill' ? s(raw?.drinks, 200) : '',
    capacity: kind === 'chill' && cap >= 1 && cap <= 500 ? cap : null,
  };
};

/** Prénom affiché pour une réponse sans compte. */
export const cleanName = (v: unknown) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

/** Texte qui accompagne le lien partagé (WhatsApp, SMS…). */
export const shareText = (e: Pick<AppEvent, 'title' | 'startsAt' | 'endsAt' | 'venue' | 'price'>) =>
  `${e.title}\n${summary(e)}`;

/** « 4–5 déc. 2026 · Palais de la Porte Dorée · Gratuit » */
export const summary = (e: Pick<AppEvent, 'startsAt' | 'endsAt' | 'venue' | 'price'>) => [shortWhen(e), e.venue, e.price].filter(Boolean).join(' · ');

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
