import { describe, it, expect, vi, beforeEach } from 'vitest';

// Annonces : envoyées une seule fois, à l'heure prévue, à tous les appareils inscrits.

const store = new Map<string, any>();
const snapOf = (path: string) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => store.get(path) });
const docRef = (path: string): any => ({ path, set: async (d: any, o?: any) => { store.set(path, o?.merge ? { ...store.get(path), ...d } : d); } });
const pushed: { uid: string; msg: any }[] = [];
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
  pushToUser: async (uid: string, msg: any) => { pushed.push({ uid, msg }); return uid === 'sans-appareil' ? 0 : 2; },
}));

const { sendDueAnnouncements, ANNOUNCEMENTS } = await import('../api/_lib/annonces');
const A = { id: 'test', sendAt: '2026-11-13T07:30:00.000Z', title: 'Du nouveau', body: 'Texte', url: '/?sorties' };
const at = (iso: string) => Date.parse(iso);

beforeEach(() => {
  store.clear(); pushed.length = 0;
  ['chris', 'pm', 'sans-appareil'].forEach(u => store.set(`pushTokens/${u}`, { tokens: ['t'] }));
});

describe('annonces', () => {
  it('rien avant l’heure, ni plus de 6 h après', async () => {
    expect(await sendDueAnnouncements(at('2026-11-13T07:29:00Z'), [A])).toEqual({});
    expect(await sendDueAnnouncements(at('2026-11-13T13:31:00Z'), [A])).toEqual({});
    expect(pushed).toEqual([]);
  });

  it('une seule fois, à tous les appareils inscrits (auteur compris)', async () => {
    expect(await sendDueAnnouncements(at('2026-11-13T07:31:00Z'), [A])).toEqual({ test: 2 });
    expect(pushed.map(p => p.uid).sort()).toEqual(['chris', 'pm', 'sans-appareil']);
    expect(pushed[0].msg).toMatchObject({ title: 'Du nouveau', body: 'Texte', url: '/?sorties', tag: 'annonce-test' });
    expect(store.get('announcementsSent/test')).toMatchObject({ people: 2, devices: 4 });
    expect(await sendDueAnnouncements(at('2026-11-13T08:30:00Z'), [A])).toEqual({ test: 'déjà envoyée' });
    expect(pushed).toHaveLength(3);
  });

  it('les annonces du code sont bien formées et assez courtes pour un écran verrouillé', () => {
    for (const a of ANNOUNCEMENTS) {
      expect(Number.isNaN(Date.parse(a.sendAt))).toBe(false);
      expect(a.title.length).toBeLessThanOrEqual(40);
      expect(a.body.length).toBeLessThanOrEqual(170);
      expect(a.url.startsWith('/')).toBe(true);
    }
    expect(new Set(ANNOUNCEMENTS.map(a => a.id)).size).toBe(ANNOUNCEMENTS.length);
  });
});
