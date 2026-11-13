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
  isAllowedLender: (email?: string) => email === 'chris@example.com',
  isAdmin: (email?: string) => email === 'chris@example.com',
  adminAuth: {
    listUsers: async () => ({ users: [
      { uid: 'chris', email: 'chris@example.com', emailVerified: true, providerData: [{}] },
      { uid: 'pm', email: 'pm@example.com', emailVerified: true, providerData: [{}], displayName: 'PM' },
      { uid: 'laura', email: 'laura@example.com', emailVerified: true, providerData: [{}] },
      { uid: 'awa', email: 'awa@example.com', emailVerified: true, providerData: [{}], displayName: 'Awa Diallo' },
      { uid: 'nonverifie', email: 'x@example.com', emailVerified: false, providerData: [{}] },
      { uid: 'invite', providerData: [] },
      { uid: 'off', email: 'off@example.com', emailVerified: true, disabled: true, providerData: [{}] },
    ] }),
  },
}));
const mails: any[] = [];
vi.mock('../api/_lib/mail.js', () => ({ sendMail: async (m: any) => { mails.push(m); return true; } }));

const { sendDueAnnouncements, ANNOUNCEMENTS, NEWS_2026_11_13, renderNewsEmail } = await import('../api/_lib/annonces');
const A = { id: 'test', sendAt: '2026-11-13T07:30:00.000Z', push: { title: 'Du nouveau', body: 'Texte', url: '/?sorties' } };
const at = (iso: string) => Date.parse(iso);

beforeEach(() => {
  store.clear(); pushed.length = 0; mails.length = 0;
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

  it('e-mail : comptes à adresse vérifiée (tous, ou seulement ceux sans notifications), prénom, une seule fois', async () => {
    const E = { id: 'mail', sendAt: A.sendAt, email: NEWS_2026_11_13, emailTo: 'no-push' as const };
    store.set('profiles/laura', { fullName: 'Laura Mbappé' });
    expect(await sendDueAnnouncements(at('2026-11-13T07:31:00Z'), [E])).toEqual({ mail: { emails: 2 } });
    expect(mails.map(m => m.to).sort()).toEqual(['awa@example.com', 'laura@example.com']);
    expect(mails.find(m => m.to === 'laura@example.com')!.html).toContain('Bonjour Laura,');
    expect(mails[0].html).toContain('/?installer');
    expect(mails[0].subject).toBe(NEWS_2026_11_13.subject);
    expect(await sendDueAnnouncements(at('2026-11-13T07:40:00Z'), [E])).toEqual({ mail: 'déjà envoyée' });
    mails.length = 0;
    await sendDueAnnouncements(at('2026-11-13T07:31:00Z'), [{ ...E, id: 'mail2', emailTo: 'all' }]);
    expect(mails.map(m => m.to).sort()).toEqual(['awa@example.com', 'chris@example.com', 'laura@example.com', 'pm@example.com']);
    // Essai : Christian seul
    mails.length = 0;
    await sendDueAnnouncements(at('2026-11-13T07:31:00Z'), [{ ...E, id: 'essai', emailTo: 'author' }]);
    expect(mails.map(m => m.to)).toEqual(['chris@example.com']);
    // Tous sauf Christian (qui a déjà reçu l'essai)
    mails.length = 0;
    await sendDueAnnouncements(at('2026-11-13T07:31:00Z'), [{ ...E, id: 'autres', emailTo: 'others' }]);
    expect(mails.map(m => m.to).sort()).toEqual(['awa@example.com', 'laura@example.com', 'pm@example.com']);
  });

  it('e-mail : texte échappé, version texte complète', () => {
    const m = renderNewsEmail({ subject: 's', intro: 'a <b> & "c"', sections: [{ title: 'T', text: 'x', link: { label: 'Voir', url: 'https://x/?a=1&b=2' } }] }, 'Ana');
    expect(m.html).toContain('a &lt;b&gt; &amp; &quot;c&quot;');
    expect(m.html).toContain('https://x/?a=1&amp;b=2');
    expect(m.text).toContain('Voir : https://x/?a=1&b=2');
    expect(m.text.startsWith('Bonjour Ana,')).toBe(true);
  });

  it('les annonces du code sont bien formées et assez courtes pour un écran verrouillé', () => {
    for (const a of ANNOUNCEMENTS) {
      expect(Number.isNaN(Date.parse(a.sendAt))).toBe(false);
      expect(a.push || a.email || a.events?.length || a.radio?.length || a.radioComments?.length).toBeTruthy();
      if (a.push) {
        expect(a.push.title.length).toBeLessThanOrEqual(40);
        expect(a.push.body.length).toBeLessThanOrEqual(170);
        expect(a.push.url.startsWith('/')).toBe(true);
      }
    }
    expect(new Set(ANNOUNCEMENTS.map(a => a.id)).size).toBe(ANNOUNCEMENTS.length);
  });
});
