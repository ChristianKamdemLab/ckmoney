import { describe, it, expect, vi, beforeEach } from 'vitest';

// Lancement de Radio CK : recos publiées une fois au nom de Christian, une seule notification.

const store = new Map<string, any>();
const snap = (p: string) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => store.get(p) });
const ref = (p: string): any => ({ path: p, get: async () => snap(p), set: async (d: any, o?: any) => { store.set(p, o?.merge ? { ...store.get(p), ...d } : d); }, delete: async () => { store.delete(p); } });
const pushed: string[] = [];
let users: any[] = [];
let metaFails = false;
vi.mock('../api/_lib/admin.js', () => ({
  adminDb: {
    collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`), get: async () => ({ docs: [...store.keys()].filter(k => k.startsWith(`${c}/`)).map(snap) }) }),
    runTransaction: async (fn: any) => { const w: any[] = []; const r = await fn({ get: async (x: any) => snap(x.path), set: (x: any, d: any) => w.push(() => store.set(x.path, d)) }); w.forEach(f => f()); return r; },
  },
  pushToUser: async (uid: string) => { pushed.push(uid); return 1; },
  isAllowedLender: (e?: string, v = true) => v && e === 'chris@example.com',
  isAdmin: (e?: string, v = true) => v && e === 'chris@example.com',
  adminAuth: { listUsers: async () => ({ users }) },
}));
vi.mock('../api/_lib/mail.js', () => ({ sendMail: async () => true }));
vi.mock('../api/_lib/radioMeta.js', () => ({
  fetchMeta: async (u: string) => {
    if (metaFails) throw new Error('réseau');
    return u.includes('youtu') ? { platform: 'youtube', kind: 'video', title: 'Titre YouTube', show: 'Une chaîne', thumbnail: 'https://i.ytimg.com/vi/TiQDz7-irPo/hqdefault.jpg' }
      : { platform: 'spotify', kind: 'podcast', title: 'Titre Spotify', show: '', thumbnail: 'https://i.scdn.co/image/x' };
  },
}));
const { importRadio, RADIO_LANCEMENT } = await import('../api/_lib/radioSeed');
const { sendDueAnnouncements, ANNOUNCEMENTS } = await import('../api/_lib/annonces');
const NOW = Date.parse('2026-11-13T13:26:00Z');

beforeEach(() => {
  store.clear(); pushed.length = 0; metaFails = false;
  users = [{ uid: 'chris', email: 'chris@example.com', emailVerified: true, providerData: [{}] }];
  store.set('profiles/chris', { fullName: 'Christian Kamdem' });
  ['chris', 'ami'].forEach(u => store.set(`pushTokens/${u}`, { tokens: ['t'] }));
});

describe('lancement de Radio CK', () => {
  it('trois recos au nom de Christian, dans l’ordre envoyé, avec ses raisons quand il les a données', async () => {
    expect(await importRadio(RADIO_LANCEMENT, NOW)).toEqual({ added: 3, already: 0, invalid: 0 });
    const a = store.get('radio/seed-nectar-markovits'), b = store.get('radio/seed-heure-du-monde-lfi'), c = store.get('radio/seed-yt-TiQDz7-irPo');
    expect(a).toMatchObject({ platform: 'spotify', kind: 'podcast', title: '007 | The Meritocracy Trap - Daniel Markovits', show: 'Le Nectar', thumbnail: 'https://i.scdn.co/image/x', authorName: 'Christian', commentCount: 0 });
    expect(a.comment).toContain('on ne naît pas tous avec les mêmes avantages');
    expect(c.comment).toContain('monogamie');
    expect(b.comment).toBe(''); // raison non donnée par Christian : rien d'inventé
    expect(b).toMatchObject({ show: "L'Heure du Monde", embedUrl: 'https://open.spotify.com/embed/episode/5jcKC7qE3mmpiwIV0b1fHN' });
    expect(c).toMatchObject({ platform: 'youtube', kind: 'video', title: 'Titre YouTube', show: 'Une chaîne', embedUrl: 'https://www.youtube-nocookie.com/embed/TiQDz7-irPo' });
    expect(a.publishedAt > b.publishedAt && b.publishedAt > c.publishedAt).toBe(true);
    expect(a.notifiedAt).toBeTruthy(); // une modification plus tard ne renotifie pas
    expect(await importRadio(RADIO_LANCEMENT, NOW)).toEqual({ added: 0, already: 3, invalid: 0 });
  });

  it('si YouTube ne répond pas : la vidéo sans titre est écartée, les podcasts passent', async () => {
    metaFails = true;
    expect(await importRadio(RADIO_LANCEMENT, NOW)).toEqual({ added: 2, already: 0, invalid: 1 });
    expect(store.get('radio/seed-nectar-markovits').thumbnail).toBe('');
  });

  it('l’annonce publie puis envoie une seule notification, une fois', async () => {
    const A = ANNOUNCEMENTS.find(x => x.id === '2026-11-13-radio-ck')!;
    expect(A.radio).toBe(RADIO_LANCEMENT);
    const out: any = await sendDueAnnouncements(NOW, [A]);
    expect(out['2026-11-13-radio-ck']).toMatchObject({ radioAdded: 3, people: 2 });
    expect(pushed.sort()).toEqual(['ami', 'chris']);
    expect(await sendDueAnnouncements(NOW + 60_000, [A])).toEqual({ '2026-11-13-radio-ck': 'déjà envoyée' });
  });

  it('raison de L’Heure du Monde : ajoutée si vide, jamais par-dessus une modification de Christian, sans notification', async () => {
    await importRadio(RADIO_LANCEMENT, NOW);
    const A = ANNOUNCEMENTS.find(x => x.id === '2026-11-13-radio-heure-du-monde')!;
    expect(A.push).toBeUndefined();
    const out: any = await sendDueAnnouncements(Date.parse('2026-11-13T13:50:00Z'), [A]);
    expect(out['2026-11-13-radio-heure-du-monde']).toMatchObject({ filled: 1, kept: 0, missing: 0 });
    expect(store.get('radio/seed-heure-du-monde-lfi').comment).toContain('sans prisme de droite ou de gauche');
    expect(pushed).toEqual([]);
    store.set('radio/seed-heure-du-monde-lfi', { ...store.get('radio/seed-heure-du-monde-lfi'), comment: 'Mon texte' });
    const { fillRadioComments } = await import('../api/_lib/radioSeed');
    expect(await fillRadioComments([{ id: 'heure-du-monde-lfi', comment: 'autre' }])).toEqual({ filled: 0, kept: 1, missing: 0 });
    expect(store.get('radio/seed-heure-du-monde-lfi').comment).toBe('Mon texte');
  });

  it('sans compte de Christian : rien n’est envoyé et l’annonce se relance', async () => {
    users = [];
    const A = ANNOUNCEMENTS.find(x => x.id === '2026-11-13-radio-ck')!;
    await expect(sendDueAnnouncements(NOW, [A])).rejects.toThrow();
    expect(pushed).toEqual([]);
    expect(store.has('announcementsSent/2026-11-13-radio-ck')).toBe(false);
  });
});
