import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanEvent, whenText, shortWhen, sortUpcoming, icsFor, shareText, toLocalInput, fromLocalInput, googleCalendarUrl, encodePrefill, decodePrefill, AppEvent } from '../utils/events';

// Événements : mise en forme (heure de Paris), validation, agenda, et serveur (api/events) testé
// avec une base Firestore simulée en mémoire.

const SALON: AppEvent = {
  id: 'salon26', title: 'Salon des Diasporas Africaines 2026', startsAt: '2026-12-04T12:00:00.000Z', endsAt: '2026-12-05T18:00:00.000Z',
  venue: 'Palais de la Porte Dorée', address: '293 avenue Daumesnil, 75012 Paris', url: 'https://www.billetweb.fr/salon-des-diasporas-africaines-2026',
  price: 'Gratuit', organizer: 'Expertise France', description: 'Six pays invitent leurs diasporas.', status: 'published',
};

describe('événements : mise en forme', () => {
  it('dates à l’heure de Paris', () => {
    expect(whenText(SALON)).toBe('Du vendredi 4 décembre, 13 h, au samedi 5 décembre 2026, 19 h');
    expect(shortWhen(SALON)).toMatch(/^4–5 déc\.? 2026$/);
    const soir = { startsAt: '2026-06-20T17:30:00.000Z', endsAt: '2026-06-20T21:00:00.000Z' };
    expect(whenText(soir)).toBe('Samedi 20 juin 2026, 19 h 30 – 23 h');
    expect(shortWhen(soir)).toMatch(/^20 juin 2026$/);
    expect(whenText({ startsAt: soir.startsAt, endsAt: soir.startsAt })).toBe('Samedi 20 juin 2026, 19 h 30');
  });

  it('seuls les événements pas encore finis, du plus proche au plus lointain', () => {
    const now = Date.parse('2026-12-05T10:00:00Z');
    const list = [
      { ...SALON, id: 'b', startsAt: '2027-01-10T10:00:00.000Z', endsAt: '2027-01-10T12:00:00.000Z' },
      { ...SALON, id: 'old', startsAt: '2026-11-01T10:00:00.000Z', endsAt: '2026-11-01T12:00:00.000Z' },
      SALON,
    ];
    expect(sortUpcoming(list, now).map(e => e.id)).toEqual(['salon26', 'b']);
  });

  it('validation : titre, dates dans l’ordre, lien http(s), pas de balises', () => {
    expect(cleanEvent({ ...SALON, title: '  ' })).toBeNull();
    expect(cleanEvent({ ...SALON, startsAt: 'pas une date' })).toBeNull();
    expect(cleanEvent({ ...SALON, endsAt: '2026-12-01T10:00:00Z' })).toBeNull();
    expect(cleanEvent({ ...SALON, url: 'javascript:alert(1)' })).toBeNull();
    const ok = cleanEvent({ ...SALON, title: '<b>Salon</b>', endsAt: '', price: '' })!;
    expect(ok.title).toBe('bSalon/b');
    expect(ok.endsAt).toBe(ok.startsAt);
    expect(ok.price).toBe('Gratuit');
    expect(cleanEvent({ ...SALON, description: 'x'.repeat(5000) })!.description).toHaveLength(2000);
  });

  it('fichier agenda et lien Google Agenda', () => {
    const ics = icsFor(SALON, 'https://ck-money.vercel.app/e/salon26');
    expect(ics).toContain('DTSTART:20261204T120000Z');
    expect(ics).toContain('DTEND:20261205T180000Z');
    expect(ics).toContain('LOCATION:Palais de la Porte Dorée\\, 293 avenue Daumesnil\\, 75012 Paris');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
    const g = new URL(googleCalendarUrl(SALON, 'https://x/e/1'));
    expect(g.searchParams.get('dates')).toBe('20261204T120000Z/20261205T180000Z');
  });

  it('lien préparé : aller-retour avec accents, et refus des données cassées', () => {
    const { id, status, ...input } = SALON;
    expect(decodePrefill(encodePrefill(input))).toEqual(input);
    expect(encodePrefill(input)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePrefill('%%%')).toBeUndefined();
    expect(decodePrefill(encodePrefill([1, 2] as any))).toBeUndefined();
  });

  it('texte de partage et champ date-heure', () => {
    expect(shareText(SALON)).toMatch(/^Salon des Diasporas Africaines 2026\n4–5 déc\.? 2026 · Palais de la Porte Dorée · Gratuit$/);
    expect(fromLocalInput(toLocalInput(SALON.startsAt))).toBe(SALON.startsAt);
    expect(fromLocalInput('')).toBe('');
  });
});

// ---------- Serveur

const store = new Map<string, any>();
const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
let auto = 0;
const docRef = (path: string): any => ({
  id: path.split('/').pop(), path,
  get: async () => ({ exists: store.has(path), data: () => clone(store.get(path)) }),
  set: async (d: any, o?: { merge?: boolean }) => { store.set(path, clone(o?.merge ? { ...store.get(path), ...d } : d)); },
  delete: async () => { store.delete(path); },
});
const colRef = (name: string) => ({
  doc: (id?: string) => docRef(`${name}/${id || `auto${++auto}`}`),
  where: (field: string, _op: string, value: unknown) => ({
    get: async () => ({
      docs: [...store.entries()].filter(([k, v]) => k.startsWith(`${name}/`) && v[field] === value)
        .map(([k, v]) => ({ id: k.split('/').pop(), data: () => clone(v) })),
    }),
  }),
});

const USERS: Record<string, any> = {
  chris: { uid: 'chris', email: 'auteur@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } },
  pm: { uid: 'pm', email: 'pm@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } },
  guest: { uid: 'guest', firebase: { sign_in_provider: 'anonymous' } },
};
vi.mock('../api/_lib/admin.js', () => ({
  adminAuth: { verifyIdToken: async (t: string) => { if (!USERS[t]) throw new Error('no'); return USERS[t]; } },
  adminDb: { collection: colRef },
  isAllowedLender: (email?: string, verified = true) => verified && email === 'auteur@example.com',
}));

const { default: handler } = await import('../api/events');

const run = async (req: any) => {
  let status = 200, body: any = null;
  const headers: Record<string, string> = {};
  const res: any = {
    status: (s: number) => { status = s; return res; }, json: (j: any) => { body = j; return res; },
    send: (t: any) => { body = t; return res; }, end: () => res, setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
  };
  await handler({ headers: { host: 'ck-money.vercel.app', ...(req.headers || {}) }, ...req }, res);
  return { status, body, headers };
};
const post = (who: string, body: object) => run({ method: 'POST', headers: { authorization: `Bearer ${who}` }, body });
const get = (query: object) => run({ method: 'GET', query });

beforeEach(() => { store.clear(); vi.unstubAllGlobals(); });

describe('événements : serveur', () => {
  it('seul l’auteur publie, modifie et supprime', async () => {
    expect((await post('pm', { action: 'save', event: SALON })).status).toBe(403);
    expect((await post('nobody', { action: 'save', event: SALON })).status).toBe(401);
    expect((await post('chris', { action: 'save', event: { ...SALON, id: undefined, startsAt: 'x' } })).status).toBe(400);
    const { body } = await post('chris', { action: 'save', event: { ...SALON, id: undefined } });
    const saved = store.get(`events/${body.id}`);
    expect(saved).toMatchObject({ title: SALON.title, status: 'published', authorUid: 'chris', price: 'Gratuit' });
    expect(saved.createdAt).toBeTruthy();
    // Modifier un événement inexistant : refusé (pas de création déguisée)
    expect((await post('chris', { action: 'save', event: { ...SALON, id: 'inconnu' } })).status).toBe(403);
    await post('chris', { action: 'save', event: { ...SALON, id: body.id, price: '5 €' } });
    expect(store.get(`events/${body.id}`)).toMatchObject({ price: '5 €', createdAt: saved.createdAt });
    expect((await post('pm', { action: 'delete', id: body.id })).status).toBe(403);
    expect((await post('chris', { action: 'delete', id: body.id })).status).toBe(200);
    expect(store.has(`events/${body.id}`)).toBe(false);
  });

  it('la liste : comptes connectés seulement ; les passés pour l’auteur uniquement ; jamais de participants', async () => {
    store.set('events/a', { ...SALON, id: undefined, authorUid: 'chris', startsAt: '2099-01-01T10:00:00.000Z', endsAt: '2099-01-01T12:00:00.000Z' });
    store.set('events/old', { ...SALON, id: undefined, authorUid: 'chris', startsAt: '2020-01-01T10:00:00.000Z', endsAt: '2020-01-01T12:00:00.000Z' });
    store.set('events/draft', { ...SALON, id: undefined, authorUid: 'chris', status: 'draft' });
    expect((await post('guest', { action: 'list' })).status).toBe(403);
    expect((await post('nobody', { action: 'list' })).status).toBe(401);
    expect((await post('pm', { action: 'list' })).body.events.map((e: AppEvent) => e.id)).toEqual(['a']);
    const mine = (await post('chris', { action: 'list' })).body.events;
    expect(mine.map((e: AppEvent) => e.id)).toEqual(['old', 'a']);
    expect(JSON.stringify(mine)).not.toMatch(/authorUid|attendees|participants/);
  });

  it('fiche publique sans compte, et rien pour un brouillon ou un identifiant inconnu', async () => {
    store.set('events/salon26', { ...SALON, id: undefined, authorUid: 'chris' });
    store.set('events/draft', { ...SALON, id: undefined, authorUid: 'chris', status: 'draft' });
    const r = await get({ id: 'salon26' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: 'salon26', title: SALON.title, venue: SALON.venue });
    expect(r.body.authorUid).toBeUndefined();
    expect((await get({ id: 'draft' })).status).toBe(404);
    expect((await get({ id: '../loans/x' })).status).toBe(404);
  });

  it('page partagée : balises d’aperçu échappées, glissées dans la vraie page', async () => {
    store.set('events/salon26', { ...SALON, id: undefined, authorUid: 'chris', title: 'Salon "A" & co', venue: 'Paris' });
    const shell = '<!doctype html><html><head><title>Événement · CKMoney</title>\n<!--og-->\n</head><body><div id="root"></div></body></html>';
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => shell }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await get({ page: 'salon26' });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(fetchMock).toHaveBeenCalledWith('https://ck-money.vercel.app/evenement.html', expect.anything());
    expect(r.body).toContain('<meta property="og:title" content="Salon &quot;A&quot; &amp; co">');
    expect(r.body).toMatch(/og:description" content="4–5 déc\.? 2026 · Paris · Gratuit"/);
    expect(r.body).toContain('<meta property="og:url" content="https://ck-money.vercel.app/e/salon26">');
    expect(r.body).toContain('<div id="root">');
    expect(r.body.match(/<title>/g)).toHaveLength(1);
    expect((await get({ page: 'inconnu' })).status).toBe(404);
  });

  it('fichier agenda servi au bon format', async () => {
    store.set('events/salon26', { ...SALON, id: undefined, authorUid: 'chris' });
    const r = await get({ ics: 'salon26' });
    expect(r.headers['content-type']).toContain('text/calendar');
    expect(r.body).toContain('SUMMARY:Salon des Diasporas Africaines 2026');
    expect(r.body).toContain('URL:https://ck-money.vercel.app/e/salon26');
    expect((await get({ ics: 'inconnu' })).status).toBe(404);
  });
});
