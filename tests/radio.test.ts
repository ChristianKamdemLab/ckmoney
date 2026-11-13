import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseMedia, cleanReco, cleanComment, ogTags, embedHeight, showFromDescription } from '../utils/radio';

// Radio CK : liens des plateformes, validation, et serveur (api/radio) avec une base simulée.

describe('liens', () => {
  it('YouTube : toutes les formes, lecteur sans cookies', () => {
    for (const u of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42', 'https://youtu.be/dQw4w9WgXcQ?si=x', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/live/dQw4w9WgXcQ']) {
      expect(parseMedia(u)).toMatchObject({ platform: 'youtube', kind: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' });
    }
  });
  it('Spotify, Apple Podcasts, Deezer', () => {
    expect(parseMedia('https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=abc')).toMatchObject({ platform: 'spotify', kind: 'podcast', embedUrl: 'https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk' });
    expect(parseMedia('https://open.spotify.com/intl-fr/show/2MAi0BvDc6GTFvKFPXnkCL')).toMatchObject({ kind: 'podcast', embedUrl: 'https://open.spotify.com/embed/show/2MAi0BvDc6GTFvKFPXnkCL' });
    expect(parseMedia('https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl')?.kind).toBe('musique');
    const ap = parseMedia('https://podcasts.apple.com/fr/podcast/generation-do-it-yourself/id1209142330?i=1000650000000&l=fr');
    expect(ap).toMatchObject({ platform: 'apple', kind: 'podcast', embedUrl: 'https://embed.podcasts.apple.com/fr/podcast/generation-do-it-yourself/id1209142330?i=1000650000000' });
    expect(embedHeight(ap as any)).toBe(175);
    expect(parseMedia('https://www.deezer.com/fr/episode/123456')).toMatchObject({ platform: 'deezer', kind: 'podcast', embedUrl: 'https://widget.deezer.com/widget/auto/episode/123456' });
  });
  it('autre site : pas de lecteur ; refus de ce qui n’est pas un lien web', () => {
    expect(parseMedia('https://www.franceinter.fr/emissions/x')).toMatchObject({ platform: 'web', embedUrl: '' });
    expect(parseMedia('javascript:alert(1)')).toBeNull();
    expect(parseMedia('pas un lien')).toBeNull();
    expect(parseMedia('https://www.youtube.com/watch?v=court')?.platform).toBe('web');
  });
  it('validation : lecteur recalculé, image en https seulement, texte nettoyé', () => {
    const r = cleanReco({ url: 'https://youtu.be/dQw4w9WgXcQ', title: ' Un <b>titre</b> ', thumbnail: 'http://x.fr/a.jpg', comment: 'a\n\n\n\nb', embedUrl: 'https://pirate.example' })!;
    expect(r).toMatchObject({ platform: 'youtube', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', title: 'Un btitre/b', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', comment: 'a\n\nb', kind: 'video' });
    expect(cleanReco({ url: 'https://youtu.be/dQw4w9WgXcQ', title: '' })).toBeNull();
    expect(cleanComment('x'.repeat(900)).length).toBe(500);
  });
  it('lien Spotify partagé depuis l’appli (Le Nectar) : épisode, lecteur, nom de l’émission', () => {
    const m = parseMedia('https://open.spotify.com/episode/5dWGmuYROwG8m31JcOX9PV?si=Dv2TGSJvQb6vlKigIjkp7Q&utm_source=copy-link');
    expect(m).toMatchObject({ platform: 'spotify', kind: 'podcast', url: 'https://open.spotify.com/episode/5dWGmuYROwG8m31JcOX9PV', embedUrl: 'https://open.spotify.com/embed/episode/5dWGmuYROwG8m31JcOX9PV' });
    expect(showFromDescription('Le Nectar · Episode')).toBe('Le Nectar');
    expect(showFromDescription('Listen to this episode from Le Nectar on Spotify. Daniel Markovits…')).toBe('Le Nectar');
    expect(showFromDescription('Écoutez cet épisode de Le Nectar sur Spotify.')).toBe('Le Nectar');
    expect(showFromDescription('Un texte sans émission')).toBe('');
  });
  it('balises d’aperçu d’une page', () => {
    const t = ogTags('<html><head><meta property="og:title" content="L&#39;épisode &amp; co"><meta content="https://img/x.jpg" property="og:image"><title>autre</title></head>');
    expect(t).toMatchObject({ title: "L'épisode & co", image: 'https://img/x.jpg' });
  });
});

// --- Serveur
const store = new Map<string, any>();
let auto = 0;
const snap = (path: string) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => store.get(path) });
const ref = (path: string): any => ({
  path, id: path.split('/').pop(),
  get: async () => snap(path),
  set: async (d: any, o?: any) => { store.set(path, o?.merge ? { ...store.get(path), ...d } : d); },
  update: async (d: any) => { store.set(path, { ...store.get(path), ...d }); },
  delete: async () => { store.delete(path); },
  collection: (c: string) => coll(`${path}/${c}`),
});
const coll = (base: string): any => ({
  doc: (id?: string) => ref(`${base}/${id || `auto${++auto}`}`),
  add: async (d: any) => { const r = ref(`${base}/auto${++auto}`); store.set(r.path, d); return r; },
  orderBy: (f: string, dir = 'asc') => ({ limit: () => ({ get: async () => ({
    docs: [...store.keys()].filter(k => k.startsWith(`${base}/`) && !k.slice(base.length + 1).includes('/')).map(snap)
      .sort((a: any, b: any) => (dir === 'desc' ? -1 : 1) * String(a.data()[f]).localeCompare(String(b.data()[f]))),
  }) }) }),
  get: async () => ({ docs: [...store.keys()].filter(k => k.startsWith(`${base}/`) && !k.slice(base.length + 1).includes('/')).map(snap) }),
});
const pushed: { uid: string; msg: any }[] = [];
let caller: any;
vi.mock('../api/_lib/admin.js', () => ({
  adminAuth: { verifyIdToken: async (t: string) => { if (t === 'bad') throw new Error('x'); return caller; } },
  adminDb: {
    collection: (c: string) => coll(c),
    runTransaction: async (fn: any) => fn({ get: (r: any) => r.get(), set: (r: any, d: any) => store.set(r.path, d), update: (r: any, d: any) => store.set(r.path, { ...store.get(r.path), ...d }) }),
    recursiveDelete: async (r: any) => { [...store.keys()].filter(k => k === r.path || k.startsWith(`${r.path}/`)).forEach(k => store.delete(k)); },
  },
  pushToUser: async (uid: string, msg: any) => { pushed.push({ uid, msg }); return 1; },
  isAllowedLender: (e?: string, v = true) => v && e === 'chris@example.com',
}));
vi.mock('../api/_lib/radioMeta.js', () => ({ fetchMeta: async (u: string) => (u.includes('youtu') ? { platform: 'youtube', kind: 'video', url: u, title: 'Titre lu', show: 'Chaîne', thumbnail: 'https://i.ytimg.com/x.jpg', embedUrl: 'e' } : null) }));
const handler = (await import('../api/radio')).default;
const CHRIS = { uid: 'chris', email: 'chris@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const AMI = { uid: 'ami', email: 'ami@example.com', email_verified: true, firebase: { sign_in_provider: 'password' } };
const call = async (who: any, body: any, token = 'ok') => {
  caller = who;
  let status = 0, json: any = null;
  const res: any = { status: (n: number) => { status = n; return res; }, json: (j: any) => { json = j; return res; }, end: () => res };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body }, res);
  return { status, json };
};

describe('api/radio', () => {
  beforeEach(() => {
    store.clear(); pushed.length = 0;
    store.set('profiles/chris', { fullName: 'Christian Kamdem' });
    store.set('profiles/ami', { fullName: 'Awa Diallo' });
    ['chris', 'ami', 'pm'].forEach(u => store.set(`pushTokens/${u}`, { tokens: ['t'] }));
  });
  const publish = async (notify = true) => (await call(CHRIS, { action: 'save', notify, item: { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Une vidéo', show: 'Chaîne', comment: 'À voir.', kind: 'video' } })).json;

  it('Christian publie : une notification à tous les autres, une seule fois', async () => {
    const r = await publish();
    expect(r.notified).toBe(2);
    expect(pushed.map(p => p.uid).sort()).toEqual(['ami', 'pm']);
    expect(pushed[0].msg).toMatchObject({ title: 'Radio CK · nouvelle vidéo', url: `/?radio=${r.id}` });
    expect(store.get(`radio/${r.id}`)).toMatchObject({ authorName: 'Christian', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', commentCount: 0 });
    pushed.length = 0;
    await call(CHRIS, { action: 'save', notify: true, item: { id: r.id, url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Corrigé' } });
    expect(pushed).toEqual([]);
    expect(store.get(`radio/${r.id}`).title).toBe('Corrigé');
  });

  it('les proches ne publient pas, ne suppriment pas, ne lisent pas les liens', async () => {
    expect((await call(AMI, { action: 'save', item: { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'x' } })).status).toBe(403);
    expect((await call(AMI, { action: 'preview', url: 'https://youtu.be/dQw4w9WgXcQ' })).status).toBe(403);
    const { id } = await publish(false);
    expect((await call(AMI, { action: 'delete', id })).status).toBe(403);
    expect((await call(CHRIS, { action: 'preview', url: 'https://youtu.be/dQw4w9WgXcQ' })).json.meta.title).toBe('Titre lu');
  });

  it('sans compte ou invité des jeux : refusé', async () => {
    expect((await call(AMI, { action: 'list' }, 'bad')).status).toBe(401);
    expect((await call({ uid: 'g', firebase: { sign_in_provider: 'anonymous' } }, { action: 'list' })).status).toBe(403);
  });

  it('réactions : une par personne, changeable ; on ne voit que les totaux', async () => {
    const { id } = await publish(false);
    await call(AMI, { action: 'react', id, emoji: '🔥' });
    await call(CHRIS, { action: 'react', id, emoji: '🔥' });
    let r = await call(AMI, { action: 'react', id, emoji: '😂' });
    expect(r.json.item).toMatchObject({ reactions: { '🔥': 1, '😂': 1 }, myReaction: '😂' });
    r = await call(AMI, { action: 'react', id, emoji: null });
    expect(r.json.item.reactions).toEqual({ '🔥': 1 });
    expect((await call(AMI, { action: 'react', id, emoji: '💩' })).status).toBe(400);
    const list = (await call(AMI, { action: 'list' })).json;
    expect(JSON.stringify(list)).not.toContain('chris"');
    expect(list.items[0].reactions).toEqual({ '🔥': 1 });
    expect(list.author).toBe(false);
  });

  it('commentaires : Christian prévenu, chacun retire le sien, Christian peut tout retirer', async () => {
    const { id } = await publish(false);
    const c = (await call(AMI, { action: 'comment', id, text: 'Trop fort ce passage sur la diaspora' })).json.comment;
    expect(c).toMatchObject({ name: 'Awa', mine: true });
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({ uid: 'chris', msg: { title: 'Awa sur Radio CK', url: `/?radio=${id}` } });
    const view = (await call({ ...AMI, uid: 'pm', email: 'pm@x.fr' }, { action: 'get', id })).json;
    expect(view.comments[0]).toMatchObject({ name: 'Awa', mine: false, canDelete: false });
    expect(view.item.commentCount).toBe(1);
    expect((await call({ ...AMI, uid: 'pm', email: 'pm@x.fr' }, { action: 'uncomment', id, commentId: c.id })).status).toBe(404);
    expect((await call(CHRIS, { action: 'uncomment', id, commentId: c.id })).status).toBe(200);
    expect((await call(AMI, { action: 'get', id })).json.item.commentCount).toBe(0);
    expect((await call(AMI, { action: 'comment', id, text: '   ' })).status).toBe(400);
  });

  it('30 commentaires par jour au plus', async () => {
    const { id } = await publish(false);
    for (let i = 0; i < 30; i++) await call(AMI, { action: 'comment', id, text: `n${i}` });
    expect((await call(AMI, { action: 'comment', id, text: 'encore' })).status).toBe(429);
  });

  it('supprimer une reco efface aussi réactions et commentaires', async () => {
    const { id } = await publish(false);
    await call(AMI, { action: 'comment', id, text: 'top' });
    await call(CHRIS, { action: 'delete', id });
    expect([...store.keys()].some(k => k.startsWith(`radio/${id}`))).toBe(false);
    expect((await call(AMI, { action: 'get', id })).status).toBe(404);
  });
});
