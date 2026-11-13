import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanEvent, dayStart, dayEnd, regionOf } from '../utils/events';

// Import d'un calendrier de salons dans les sorties : une fois, au nom de Christian, sans notification.

const store = new Map<string, any>();
const snapOf = (path: string) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => store.get(path) });
const docRef = (path: string): any => ({
  path,
  get: async () => snapOf(path),
  set: async (d: any, o?: any) => { store.set(path, o?.merge ? { ...store.get(path), ...d } : d); },
  delete: async () => { store.delete(path); },
});
const pushed: string[] = [];
let users: any[] = [];
vi.mock('../api/_lib/admin.js', () => ({
  adminDb: {
    collection: (c: string) => ({
      doc: (id: string) => docRef(`${c}/${id}`),
      get: async () => ({ docs: [...store.keys()].filter(k => k.startsWith(`${c}/`)).map(snapOf) }),
    }),
    runTransaction: async (fn: any) => {
      const writes: (() => void)[] = [];
      const r = await fn({ get: async (ref: any) => snapOf(ref.path), set: (ref: any, d: any) => writes.push(() => store.set(ref.path, d)) });
      writes.forEach(w => w());
      return r;
    },
  },
  pushToUser: async (uid: string) => { pushed.push(uid); return 1; },
  isAllowedLender: (email?: string, verified = true) => verified && email === 'chris@example.com',
  isAdmin: (email?: string, verified = true) => verified && email === 'chris@example.com',
  adminAuth: { listUsers: async () => ({ users }) },
}));
vi.mock('../api/_lib/mail.js', () => ({ sendMail: async () => true }));

const { importEvents, SALONS_2026_2027 } = await import('../api/_lib/salons');
const { sendDueAnnouncements, ANNOUNCEMENTS } = await import('../api/_lib/annonces');

const S = (id: string, start: string, end = start) => ({
  id, title: `Salon ${id}`, start, end, venue: 'Parc des expositions, Abidjan', address: 'Abidjan, Côte d’Ivoire',
  price: 'Prix non communiqué', url: 'https://example.com', description: 'Thème : test.',
});
const NOW = Date.parse('2026-11-13T10:45:00Z');

beforeEach(() => {
  store.clear(); pushed.length = 0;
  users = [
    { uid: 'chris', email: 'chris@example.com', emailVerified: true, providerData: [{}] },
    { uid: 'pm', email: 'pm@example.com', emailVerified: true, providerData: [{}] },
  ];
  store.set('profiles/chris', { fullName: 'Christian Kamdem' });
  store.set('pushTokens/pm', { tokens: ['t'] });
});

describe('import de salons', () => {
  it('publie au nom de Christian, journée entière, visible par tous', async () => {
    expect(await importEvents([S('a', '2026-11-18', '2026-11-22')], NOW)).toEqual({ added: 1, already: 0, past: 0, invalid: 0 });
    expect(store.get('events/salon-a')).toMatchObject({
      kind: 'event', audience: 'all', allDay: true, status: 'published', authorUid: 'chris', authorName: 'Christian', goingCount: 0,
      startsAt: '2026-11-17T23:00:00.000Z', endsAt: '2026-11-22T22:59:59.000Z', price: 'Prix non communiqué',
    });
    expect(store.get('events/salon-a').notifiedAt).toBeUndefined();
    expect(pushed).toEqual([]);
  });

  it('ne recrée pas une sortie déjà là, ignore le passé et les lignes invalides', async () => {
    store.set('events/salon-a', { title: 'Modifiée par Christian' });
    const r = await importEvents([S('a', '2026-11-18'), S('b', '2026-11-01'), { ...S('c', '2026-12-01'), url: 'pas un lien' }, S('d', '2027-01-12')], NOW);
    expect(r).toEqual({ added: 1, already: 1, past: 1, invalid: 1 });
    expect(store.get('events/salon-a')).toEqual({ title: 'Modifiée par Christian' });
    expect(store.has('events/salon-d')).toBe(true);
  });

  it('sans compte de Christian : erreur, et l’annonce se relance au passage suivant', async () => {
    const A = { id: 'import-test', sendAt: '2026-11-13T10:30:00.000Z', events: [S('a', '2026-11-18')] };
    users = users.filter(u => u.uid !== 'chris');
    await expect(sendDueAnnouncements(NOW, [A])).rejects.toThrow('auteur');
    expect(store.has('announcementsSent/import-test')).toBe(false);
    users.push({ uid: 'chris', email: 'chris@example.com', emailVerified: true, providerData: [{}] });
    expect(await sendDueAnnouncements(NOW + 3_600_000, [A])).toEqual({ 'import-test': { added: 1, already: 0, past: 0, invalid: 0 } });
    expect(await sendDueAnnouncements(NOW + 7_200_000, [A])).toEqual({ 'import-test': 'déjà envoyée' });
    expect(pushed).toEqual([]);
  });

  it('le calendrier du 13/11 : Paris et Afrique subsaharienne, données valides', () => {
    expect(SALONS_2026_2027.length).toBe(32);
    const ids = SALONS_2026_2027.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SALONS_2026_2027) {
      expect(`salon-${s.id}`.length).toBeLessThanOrEqual(40);
      expect(s.price.length).toBeLessThanOrEqual(40);
      expect(s.end >= s.start).toBe(true);
      expect(['paris', 'afrique']).toContain(regionOf(s));
      const e = cleanEvent({ kind: 'event', allDay: true, ...s, startsAt: dayStart(s.start), endsAt: dayEnd(s.end) });
      expect(e, s.id).not.toBeNull();
      expect(s.description).not.toMatch(/—/);
    }
    expect(SALONS_2026_2027.filter(s => regionOf(s) === 'paris').length).toBe(15);
    // Déjà dans les sorties
    expect(SALONS_2026_2027.some(s => /diasporas africaines/i.test(s.title))).toBe(false);
    const a = ANNOUNCEMENTS.find(x => x.id === '2026-11-13-salons')!;
    expect(a.events).toBe(SALONS_2026_2027);
    expect(a.push).toBeUndefined();
    expect(a.email).toBeUndefined();
  });
});
