import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanEvent, whenText, shortWhen, sortUpcoming, icsFor, shareText, toLocalInput, fromLocalInput, googleCalendarUrl,
  encodePrefill, decodePrefill, defaultSpotEnd, isLive, AppEvent, dayStart, dayEnd, parisDay, untilText, regionOf, priceUnknown,
  summary, monthOf,
} from '../utils/events';

// Sorties (événements, spots, chills) : mise en forme (heure de Paris), validation, agenda, et serveur
// (api/events) testé avec une base Firestore simulée en mémoire.

const SALON: AppEvent = {
  id: 'salon26', kind: 'event', title: 'Salon des Diasporas Africaines 2026', startsAt: '2026-12-04T12:00:00.000Z', endsAt: '2026-12-05T18:00:00.000Z',
  venue: 'Palais de la Porte Dorée', address: '293 avenue Daumesnil, 75012 Paris', url: 'https://www.billetweb.fr/salon-des-diasporas-africaines-2026',
  price: 'Gratuit', organizer: 'Expertise France', description: 'Six pays invitent leurs diasporas.', status: 'published',
  theme: '', drinks: '', capacity: null,
};
const plain = (s: string) => s.replace(/\u00a0/g, ' ');
const FUTURE = { startsAt: '2099-06-01T18:00:00.000Z', endsAt: '2099-06-01T21:00:00.000Z' };
const PAST = { startsAt: '2020-01-01T18:00:00.000Z', endsAt: '2020-01-01T23:00:00.000Z' };

describe('sorties : mise en forme', () => {
  it('dates à l’heure de Paris', () => {
    expect(plain(whenText(SALON))).toBe('Du vendredi 4 décembre, 13 h, au samedi 5 décembre 2026, 19 h');
    expect(shortWhen(SALON)).toMatch(/^4–5 déc\.? 2026$/);
    const soir = { startsAt: '2026-06-20T17:30:00.000Z', endsAt: '2026-06-20T21:00:00.000Z' };
    expect(plain(whenText(soir))).toBe('Samedi 20 juin 2026, 19 h 30 – 23 h');
    expect(shortWhen(soir)).toMatch(/^20 juin 2026$/);
    expect(plain(whenText({ startsAt: soir.startsAt, endsAt: soir.startsAt }))).toBe('Samedi 20 juin 2026, 19 h 30');
    // Une soirée qui finit après minuit reste une soirée
    const nuit = { startsAt: '2026-11-20T19:00:00.000Z', endsAt: '2026-11-20T23:30:00.000Z' };
    expect(plain(whenText(nuit))).toBe('Vendredi 20 novembre 2026, 20 h – 0 h 30');
    expect(shortWhen(nuit)).toMatch(/^20 nov\.? 2026$/);
    expect(plain(whenText({ startsAt: '2026-11-21T08:00:00.000Z', endsAt: '2026-11-21T09:00:00.000Z' }))).toBe('Samedi 21 novembre 2026, 9 h – 10 h');
  });

  it('seules les sorties pas encore finies, de la plus proche à la plus lointaine ; « en ce moment »', () => {
    const now = Date.parse('2026-12-05T10:00:00Z');
    const list = [
      { ...SALON, id: 'b', startsAt: '2027-01-10T10:00:00.000Z', endsAt: '2027-01-10T12:00:00.000Z' },
      { ...SALON, id: 'old', startsAt: '2026-11-01T10:00:00.000Z', endsAt: '2026-11-01T12:00:00.000Z' },
      SALON,
    ];
    expect(sortUpcoming(list, now).map(e => e.id)).toEqual(['salon26', 'b']);
    expect(isLive(SALON, now)).toBe(true);
    expect(isLive(list[0], now)).toBe(false);
  });

  it('fin par défaut d’un spot : le lendemain à 4 h', () => {
    const start = new Date(2026, 10, 13, 21, 30).toISOString();
    const end = new Date(defaultSpotEnd(start));
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([14, 4, 0]);
    // Après minuit : même nuit, 4 h
    const late = new Date(defaultSpotEnd(new Date(2026, 10, 14, 1, 0).toISOString()));
    expect([late.getDate(), late.getHours()]).toEqual([14, 4]);
    // En journée : 6 h plus tard plutôt que le lendemain matin
    const day = new Date(2026, 10, 14, 10, 0);
    expect(Date.parse(defaultSpotEnd(day.toISOString())) - day.getTime()).toBe(6 * 3_600_000);
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
    expect(ok).toMatchObject({ kind: 'event', audience: 'all', invitees: [] });
    expect(cleanEvent({ ...SALON, description: 'x'.repeat(5000) })!.description).toHaveLength(2000);
  });

  it('validation par type : chill (thème, boissons, places) et spot (pas de prix, fin par défaut)', () => {
    const chill = cleanEvent({ ...SALON, kind: 'chill', price: '', theme: 'La diaspora', drinks: 'Vin', capacity: '12', audience: 'some', invitees: ['ana', 'ana', 'b$en'] })!;
    expect(chill).toMatchObject({ kind: 'chill', theme: 'La diaspora', drinks: 'Vin', capacity: 12, price: '', audience: 'some', invitees: ['ana', 'ben'] });
    expect(cleanEvent({ ...SALON, kind: 'chill', capacity: 0 })!.capacity).toBeNull();
    expect(cleanEvent({ ...SALON, kind: 'chill', capacity: 9999 })!.capacity).toBeNull();
    const spot = cleanEvent({ ...SALON, kind: 'spot', price: '', endsAt: '', theme: 'ignoré' })!;
    expect(spot).toMatchObject({ kind: 'spot', price: '', theme: '', capacity: null });
    expect(Date.parse(spot.endsAt) - Date.parse(spot.startsAt)).toBe(6 * 3_600_000);
    // Les invités ne comptent que pour « certaines personnes »
    expect(cleanEvent({ ...SALON, audience: 'all', invitees: ['ana'] })!.invitees).toEqual([]);
    expect(cleanEvent({ ...SALON, audience: 'n’importe quoi' })!.audience).toBe('all');
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
const snapOf = (path: string) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => clone(store.get(path)) });
const childrenOf = (path: string) => [...store.keys()].filter(k => k.startsWith(`${path}/`) && k.split('/').length === path.split('/').length + 1);
const docRef = (path: string): any => ({
  id: path.split('/').pop(), path,
  collection: (c: string) => colRef(`${path}/${c}`),
  get: async () => snapOf(path),
  set: async (d: any, o?: { merge?: boolean }) => { store.set(path, clone(o?.merge ? { ...store.get(path), ...d } : d)); },
  delete: async () => { store.delete(path); },
});
const colRef = (path: string): any => ({
  doc: (id?: string) => docRef(`${path}/${id || `auto${++auto}`}`),
  get: async () => ({ docs: childrenOf(path).map(snapOf) }),
  where: (field: string, _op: string, value: unknown) => ({
    get: async () => ({ docs: childrenOf(path).filter(k => store.get(k)[field] === value).map(snapOf) }),
  }),
});

const USERS: Record<string, any> = {
  chris: { uid: 'chris', email: 'auteur@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } },
  pm: { uid: 'pm', email: 'pm@example.com', email_verified: true, name: 'P M', firebase: { sign_in_provider: 'google.com' } },
  laura: { uid: 'laura', email: 'laura@example.com', email_verified: true, firebase: { sign_in_provider: 'password' } },
  guest: { uid: 'guest', firebase: { sign_in_provider: 'anonymous' } },
};
const pushed: { uid: string; msg: any }[] = [];
vi.mock('../api/_lib/admin.js', () => ({
  adminAuth: {
    verifyIdToken: async (t: string) => { if (!USERS[t]) throw new Error('no'); return USERS[t]; },
    listUsers: async () => ({ users: [
      { uid: 'chris', email: 'auteur@example.com', providerData: [{}] },
      { uid: 'pm', email: 'pm@example.com', displayName: 'PM', providerData: [{}] },
      { uid: 'laura', email: 'laura.k@example.com', providerData: [{}] },
      { uid: 'guest', providerData: [] },
    ] }),
  },
  adminDb: {
    collection: (c: string) => colRef(c),
    recursiveDelete: async (ref: any) => { [...store.keys()].filter(k => k === ref.path || k.startsWith(`${ref.path}/`)).forEach(k => store.delete(k)); },
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const writes: (() => void)[] = [];
      const tx = {
        get: async (ref: any) => snapOf(ref.path),
        set: (ref: any, d: any) => writes.push(() => store.set(ref.path, clone(d))),
        update: (ref: any, d: any) => writes.push(() => store.set(ref.path, { ...store.get(ref.path), ...clone(d) })),
        delete: (ref: any) => writes.push(() => store.delete(ref.path)),
      };
      const r = await fn(tx);
      writes.forEach(w => w());
      return r;
    },
  },
  isAllowedLender: (email?: string, verified = true) => verified && email === 'auteur@example.com',
  isAdmin: (email?: string, verified = true) => verified && email === 'auteur@example.com',
  pushToUser: async (uid: string, msg: any) => { pushed.push({ uid, msg }); return 1; },
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
const post = (who: string | null, body: object) => run({ method: 'POST', headers: who ? { authorization: `Bearer ${who}` } : {}, body });
const get = (query: object) => run({ method: 'GET', query });
const put = (id: string, d: object) => store.set(`events/${id}`, { ...SALON, id: undefined, authorUid: 'chris', ...d });

beforeEach(() => { store.clear(); pushed.length = 0; vi.unstubAllGlobals(); });

describe('sorties : serveur', () => {
  it('chaque compte publie et gère ses sorties ; pas les invités des jeux', async () => {
    expect((await post('guest', { action: 'save', event: SALON })).status).toBe(403);
    expect((await post('nobody', { action: 'save', event: SALON })).status).toBe(401);
    expect((await post('pm', { action: 'save', event: { ...SALON, id: undefined, startsAt: 'x' } })).status).toBe(400);
    store.set('profiles/pm', { fullName: 'Paul-Marie Ndong' });
    const { body } = await post('pm', { action: 'save', event: { ...SALON, id: undefined } });
    const saved = store.get(`events/${body.id}`);
    expect(saved).toMatchObject({ title: SALON.title, status: 'published', authorUid: 'pm', authorName: 'Paul-Marie', kind: 'event', goingCount: 0 });
    expect(saved.createdAt).toBeTruthy();
    // Modifier : seulement la sienne (pas de création déguisée non plus)
    expect((await post('laura', { action: 'save', event: { ...SALON, id: body.id, price: '5 €' } })).status).toBe(403);
    expect((await post('chris', { action: 'save', event: { ...SALON, id: body.id, price: '5 €' } })).status).toBe(403);
    expect((await post('pm', { action: 'save', event: { ...SALON, id: 'inconnu' } })).status).toBe(403);
    await post('pm', { action: 'save', event: { ...SALON, id: body.id, price: '5 €' } });
    expect(store.get(`events/${body.id}`)).toMatchObject({ price: '5 €', createdAt: saved.createdAt });
    // Ce que les autres voient : « par Paul-Marie »
    expect((await get({ id: body.id })).body.by).toBe('Paul-Marie');
    // Supprimer : la sienne (avec les réponses), ou n'importe laquelle pour Christian
    store.set(`events/${body.id}/rsvps/laura`, { name: 'Laura' });
    expect((await post('laura', { action: 'delete', id: body.id })).status).toBe(404);
    expect((await post('pm', { action: 'delete', id: body.id })).status).toBe(200);
    expect([...store.keys()].some(k => k.startsWith(`events/${body.id}`))).toBe(false);
    const other = (await post('laura', { action: 'save', event: { ...SALON, id: undefined } })).body.id;
    expect((await post('chris', { action: 'delete', id: other })).status).toBe(200);
    expect(store.has(`events/${other}`)).toBe(false);
  });

  it('« certaines personnes » est réservé à Christian ; 10 sorties par jour au plus pour les autres', async () => {
    expect((await post('pm', { action: 'save', event: { ...SALON, id: undefined, audience: 'some', invitees: ['laura'] } })).body.error).toBe('audience');
    expect((await post('chris', { action: 'save', event: { ...SALON, id: undefined, audience: 'some', invitees: ['laura'] } })).status).toBe(200);
    for (let i = 0; i < 10; i++) expect((await post('laura', { action: 'save', event: { ...SALON, id: undefined } })).status).toBe(200);
    expect((await post('laura', { action: 'save', event: { ...SALON, id: undefined } })).status).toBe(429);
  });

  it('la liste respecte « qui le voit » : tout le monde, certaines personnes, seulement par lien', async () => {
    put('tous', { ...FUTURE });
    put('pm', { ...FUTURE, audience: 'some', invitees: ['pm'] });
    put('lien', { ...FUTURE, audience: 'link' });
    put('old', { ...PAST });
    put('draft', { ...FUTURE, status: 'draft' });
    expect((await post('guest', { action: 'list' })).status).toBe(403);
    expect((await post('nobody', { action: 'list' })).status).toBe(401);
    store.set('events/laura-lien', { ...SALON, ...FUTURE, id: undefined, authorUid: 'laura', audience: 'link' });
    store.set('events/laura-old', { ...SALON, ...PAST, id: undefined, authorUid: 'laura' });
    const ids = async (who: string) => (await post(who, { action: 'list' })).body.events.map((e: AppEvent) => e.id).sort();
    expect(await ids('pm')).toEqual(['pm', 'tous']);
    // Ses propres sorties toujours (passées et « par lien » comprises), celles des autres selon « qui le voit »
    expect(await ids('laura')).toEqual(['laura-lien', 'laura-old', 'tous']);
    expect(await ids('chris')).toEqual(['lien', 'old', 'pm', 'tous']);
    const forPm = JSON.stringify((await post('pm', { action: 'list' })).body);
    expect(forPm).not.toMatch(/authorUid|invitees|audience|goingCount/);
    const mine = (await post('chris', { action: 'list' })).body.events.find((e: AppEvent) => e.id === 'pm');
    expect(mine).toMatchObject({ audience: 'some', invitees: ['pm'] });
  });

  it('fiche publique sans compte (même « par lien »), rien pour un brouillon ou un identifiant inconnu', async () => {
    put('salon26', {});
    put('lien', { ...FUTURE, audience: 'link', invitees: ['pm'] });
    put('draft', { status: 'draft' });
    const r = await get({ id: 'salon26' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: 'salon26', title: SALON.title, venue: SALON.venue, kind: 'event' });
    expect(r.body.authorUid).toBeUndefined();
    const l = await get({ id: 'lien' });
    expect(l.status).toBe(200);
    expect(l.body.invitees).toBeUndefined();
    expect(l.body.audience).toBeUndefined();
    expect((await get({ id: 'draft' })).status).toBe(404);
    expect((await get({ id: '../loans/x' })).status).toBe(404);
  });

  it('un spot terminé ne dit plus où l’auteur était', async () => {
    put('spot', { ...PAST, kind: 'spot', venue: 'Le Comptoir', address: '80 quai de Jemmapes', description: 'Passez !' });
    const r = (await get({ id: 'spot' })).body;
    expect([r.venue, r.address, r.description]).toEqual(['', '', '']);
    put('spot2', { ...FUTURE, kind: 'spot', venue: 'Le Comptoir' });
    expect((await get({ id: 'spot2' })).body.venue).toBe('Le Comptoir');
    // L'auteur garde tout dans sa liste
    expect((await post('chris', { action: 'list' })).body.events.find((e: AppEvent) => e.id === 'spot').venue).toBe('Le Comptoir');
  });

  it('chill : « Je viens » avec ou sans compte, places limitées, liste visible par l’auteur seul', async () => {
    put('chill', { ...FUTURE, kind: 'chill', capacity: 2, goingCount: 0, price: '' });
    const T1 = 'a'.repeat(20), T2 = 'b'.repeat(20);
    expect((await post(null, { action: 'rsvp', id: 'chill', going: true, token: T1 })).body.error).toBe('name');
    expect((await post(null, { action: 'rsvp', id: 'chill', going: true, name: 'Awa', token: 'court' })).body.error).toBe('token');
    const a = await post(null, { action: 'rsvp', id: 'chill', going: true, name: '<Awa>', token: T1 });
    expect(a.body).toEqual({ going: true, placesLeft: 1 });
    // Répondre deux fois ne compte qu'une fois
    await post(null, { action: 'rsvp', id: 'chill', going: true, name: 'Awa', token: T1 });
    expect(store.get('events/chill').goingCount).toBe(1);
    store.set('profiles/pm', { fullName: 'Paul-Marie' });
    expect((await post('pm', { action: 'rsvp', id: 'chill', going: true })).body.placesLeft).toBe(0);
    // Complet
    const full = await post(null, { action: 'rsvp', id: 'chill', going: true, name: 'Ben', token: T2 });
    expect([full.status, full.body.error]).toEqual([409, 'complet']);
    // Ce que voient les autres : le nombre de places, jamais les prénoms
    expect(JSON.stringify((await get({ id: 'chill' })).body)).not.toMatch(/Awa|Paul/);
    expect((await get({ id: 'chill' })).body.placesLeft).toBe(0);
    expect((await post('pm', { action: 'list' })).body.events[0].meGoing).toBe(true);
    expect((await post('laura', { action: 'list' })).body.events[0].meGoing).toBe(false);
    expect((await post('pm', { action: 'rsvps', id: 'chill' })).status).toBe(404);
    const people = (await post('chris', { action: 'rsvps', id: 'chill' })).body.people;
    expect(people.map((p: any) => [p.name, p.member])).toEqual([['Awa', false], ['Paul-Marie', true]]);
    // Annuler libère la place
    expect((await post(null, { action: 'rsvp', id: 'chill', going: false, token: T1 })).body).toEqual({ going: false, placesLeft: 1 });
    expect(store.has(`events/chill/rsvps/g_${T1}`)).toBe(false);
  });

  it('on ne répond qu’à un chill à venir', async () => {
    put('salon', { ...FUTURE });
    put('fini', { ...PAST, kind: 'chill' });
    const T = 'c'.repeat(20);
    expect((await post(null, { action: 'rsvp', id: 'salon', going: true, name: 'A', token: T })).status).toBe(404);
    expect((await post(null, { action: 'rsvp', id: 'fini', going: true, name: 'A', token: T })).status).toBe(404);
    expect((await post(null, { action: 'rsvp', id: 'inconnu', going: true, name: 'A', token: T })).status).toBe(404);
  });

  it('« Prévenir » : notification à tous, aux personnes choisies, ou à personne (par lien)', async () => {
    store.set('pushTokens/pm', { tokens: ['x'] });
    store.set('pushTokens/laura', { tokens: ['y'] });
    store.set('pushTokens/chris', { tokens: ['z'] });
    const spot = { ...SALON, ...FUTURE, id: undefined, kind: 'spot', title: 'Ce soir je suis au Comptoir', venue: 'Le Comptoir', price: '' };
    const r = await post('chris', { action: 'save', event: spot, notify: true });
    expect(r.body.notified).toBe(2);
    expect(pushed.map(p => p.uid).sort()).toEqual(['laura', 'pm']);
    expect(pushed[0].msg).toMatchObject({ title: 'Ce soir je suis au Comptoir', url: `/?evenement=${r.body.id}` });
    pushed.length = 0;
    await post('chris', { action: 'save', event: { ...spot, kind: 'chill', title: 'Chill', audience: 'some', invitees: ['pm'] }, notify: true });
    expect(pushed.map(p => p.uid)).toEqual(['pm']);
    expect(pushed[0].msg.title).toBe('Chill : Chill');
    pushed.length = 0;
    await post('chris', { action: 'save', event: { ...spot, audience: 'link' }, notify: true });
    await post('chris', { action: 'save', event: spot });
    expect(pushed).toEqual([]);
    // Une seule notification par sortie, même modifiée ensuite
    expect((await post('chris', { action: 'save', event: { ...spot, id: r.body.id, title: 'Finalement au Baron' }, notify: true })).body.notified).toBe(0);
    expect(pushed).toEqual([]);
  });

  it('les comptes à choisir (Christian seulement) : prénoms seulement, sans lui ni les invités des jeux', async () => {
    store.set('profiles/pm', { fullName: 'Paul-Marie Ndong' });
    expect((await post('pm', { action: 'people' })).status).toBe(403);
    const people = (await post('chris', { action: 'people' })).body.people;
    expect(people).toEqual([{ uid: 'laura', name: 'laura.k' }, { uid: 'pm', name: 'Paul-Marie Ndong' }]);
    expect(JSON.stringify(people)).not.toContain('@');
  });

  it('page partagée : balises d’aperçu échappées, glissées dans la vraie page', async () => {
    put('salon26', { title: 'Salon "A" & co', venue: 'Paris' });
    put('chill', { ...FUTURE, kind: 'chill', title: 'Chill', venue: 'Chez moi', price: '' });
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
    expect((await get({ page: 'chill' })).body).toMatch(/og:description" content="Chill · 1(er)? juin 2099 · Chez moi"/);
    expect((await get({ page: 'inconnu' })).status).toBe(404);
  });

  it('fichier agenda servi au bon format', async () => {
    put('salon26', {});
    const r = await get({ ics: 'salon26' });
    expect(r.headers['content-type']).toContain('text/calendar');
    expect(r.body).toContain('SUMMARY:Salon des Diasporas Africaines 2026');
    expect(r.body).toContain('URL:https://ck-money.vercel.app/e/salon26');
    expect((await get({ ics: 'inconnu' })).status).toBe(404);
  });
});

describe('sorties sans horaire (salons sur plusieurs jours)', () => {
  const SIREXE: AppEvent = {
    ...SALON, id: 'sirexe', title: 'SIREXE', allDay: true, startsAt: dayStart('2026-11-18'), endsAt: dayEnd('2026-11-22'),
    venue: 'Parc des expositions d’Abidjan', address: 'Abidjan, Côte d’Ivoire', price: 'Dès 250 000 FCFA HT',
  };

  it('minuit et fin de journée à Paris, en hiver comme en été', () => {
    expect(dayStart('2026-11-18')).toBe('2026-11-17T23:00:00.000Z');
    expect(dayEnd('2026-11-22')).toBe('2026-11-22T22:59:59.000Z');
    expect(dayStart('2027-07-01')).toBe('2027-06-30T22:00:00.000Z');
    expect(dayEnd('2027-03-28')).toBe('2027-03-28T21:59:59.000Z'); // passage à l'heure d'été ce jour-là
    expect(dayStart('2026-12-31', 1)).toBe('2026-12-31T23:00:00.000Z');
    expect(dayStart('18/11/2026')).toBe('');
    expect(parisDay(dayEnd('2026-11-22'))).toBe('2026-11-22');
  });

  it('dates en toutes lettres, sans heure', () => {
    expect(whenText(SIREXE)).toBe('Du mercredi 18 au dimanche 22 novembre 2026');
    expect(whenText({ allDay: true, startsAt: dayStart('2026-11-19'), endsAt: dayEnd('2026-11-19') })).toBe('Jeudi 19 novembre 2026');
    expect(whenText({ allDay: true, startsAt: dayStart('2027-06-27'), endsAt: dayEnd('2027-07-01') })).toBe('Du dimanche 27 juin au jeudi 1er juillet 2027');
    expect(whenText({ allDay: true, startsAt: dayStart('2026-12-30'), endsAt: dayEnd('2027-01-02') })).toBe('Du mercredi 30 décembre 2026 au samedi 2 janvier 2027');
    expect(shortWhen(SIREXE)).toMatch(/^18–22 nov\.? 2026$/);
    expect(shortWhen(SIREXE, false)).toMatch(/^18–22 nov\.?$/);
    expect(shortWhen({ startsAt: dayStart('2026-11-19'), endsAt: dayEnd('2026-11-19') }, false)).toMatch(/^19 nov\.?$/);
    // « 1er » aussi pour les sorties avec horaire
    expect(plain(whenText({ startsAt: '2027-07-01T17:00:00.000Z', endsAt: '2027-07-01T20:00:00.000Z' }))).toBe('Jeudi 1er juillet 2027, 19 h – 22 h');
  });

  it('« en ce moment » : jusqu’à quand', () => {
    expect(untilText(SIREXE, Date.parse('2026-11-19T10:00:00Z'))).toMatch(/^jusqu'au 22 nov\.?$/);
    expect(untilText(SIREXE, Date.parse('2026-11-22T10:00:00Z'))).toBe('toute la journée');
    expect(plain(untilText(SALON, Date.parse('2026-12-04T13:00:00Z')))).toMatch(/^jusqu'au 5 déc\.?, 19 h$/);
    expect(plain(untilText(SALON, Date.parse('2026-12-05T13:00:00Z')))).toBe("jusqu'à 19 h");
    expect(isLive(SIREXE, Date.parse('2026-11-22T21:00:00Z'))).toBe(true);
    expect(isLive(SIREXE, Date.parse('2026-11-22T23:30:00Z'))).toBe(false);
  });

  it('agenda : journée entière (fin exclue, norme des agendas)', () => {
    const ics = icsFor(SIREXE, 'https://x/e/sirexe');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261118');
    expect(ics).toContain('DTEND;VALUE=DATE:20261123');
    expect(ics).not.toContain('DTSTART:');
    expect(new URL(googleCalendarUrl(SIREXE, 'https://x')).searchParams.get('dates')).toBe('20261118/20261123');
  });

  it('validation : ramené au jour entier, seulement pour un événement', () => {
    const e = cleanEvent({ ...SIREXE, startsAt: '2026-11-18T09:30:00.000Z', endsAt: '2026-11-22T15:00:00.000Z' })!;
    expect(e).toMatchObject({ allDay: true, startsAt: '2026-11-17T23:00:00.000Z', endsAt: '2026-11-22T22:59:59.000Z' });
    expect(cleanEvent({ ...SIREXE, kind: 'chill' })!.allDay).toBe(false);
    expect(cleanEvent({ ...SALON, allDay: 'oui' })!.allDay).toBe(false);
    expect(cleanEvent(SALON)!.startsAt).toBe(SALON.startsAt);
  });

  it('région, prix inconnu, intertitre du mois', () => {
    expect(regionOf(SIREXE)).toBe('afrique');
    expect(regionOf(SALON)).toBe('paris');
    expect(regionOf({ venue: 'Hôtel Meliá Paris La Défense', address: 'Courbevoie, France' })).toBe('paris');
    expect(regionOf({ venue: 'Pullman Grand Karavia, Lubumbashi', address: 'Lubumbashi, RD Congo' })).toBe('afrique');
    expect(regionOf({ venue: 'Eurexpo', address: 'Chassieu, France' })).toBe('ailleurs');
    expect(regionOf({ venue: 'Chez moi', address: '' })).toBe('ailleurs');
    expect(priceUnknown('Prix non communiqué')).toBe(true);
    expect(priceUnknown('Dès 23 €')).toBe(false);
    expect(summary({ ...SIREXE, price: 'Prix non communiqué' })).not.toContain('communiqué');
    expect(monthOf(SIREXE.startsAt)).toBe('Novembre 2026');
    expect(monthOf(dayStart('2027-07-01'))).toBe('Juillet 2027');
  });
});
