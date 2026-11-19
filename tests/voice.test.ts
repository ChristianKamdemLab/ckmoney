import { describe, it, expect, vi, beforeEach } from 'vitest';

// « Écouter » : génération de l'audio (ElevenLabs simulé), stockage en morceaux, relecture.

const store = new Map<string, any>();
const snapOf = (path: string) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => store.get(path) });
const docRef = (path: string): any => ({
  id: path.split('/').pop(), path,
  get: async () => snapOf(path),
  set: async (d: any, o?: { merge?: boolean }) => { store.set(path, o?.merge ? { ...store.get(path), ...d } : d); },
  collection: (sub: string) => colRef(`${path}/${sub}`),
});
const colRef = (name: string): any => ({
  doc: (id: string) => docRef(`${name}/${id}`),
  where: (f: string, _op: string, v: any) => ({
    get: async () => ({ docs: [...store.keys()].filter(k => k.startsWith(`${name}/`) && k.split('/').length === 2 && store.get(k)[f] === v).map(snapOf) }),
  }),
});
const pushed: any[] = [];
vi.mock('../api/_lib/admin.js', () => ({
  adminDb: { collection: colRef },
  adminAuth: { getUserByEmail: async () => ({ uid: 'chris' }) },
  authorEmail: () => 'auteur@example.com',
  pushToUser: async (uid: string, msg: any) => { pushed.push({ uid, title: msg.title }); return 1; },
}));

const { speechText, hashOf, generateAudios, loadAudio, parseAliases, PAUSE_RETRY_MS, VOICE_SETTINGS } = await import('../api/_lib/voice');

const calls: { url: string; body?: any }[] = [];
const fakeFetch = (async (url: string, init?: any) => {
  calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
  if (url.endsWith('/voices')) return new Response(JSON.stringify({ voices: [{ voice_id: 'v1', name: 'Rachel' }, { voice_id: 'v2', name: 'Christian voice' }] }));
  return new Response(new Uint8Array(2_000_000).fill(7));
}) as any;

beforeEach(() => {
  store.clear(); calls.length = 0; pushed.length = 0;
  process.env.ELEVENLABS_API_KEY = 'cle-de-test';
  delete process.env.ELEVENLABS_VOICE_ID;
});

describe('Écouter L’essentiel', () => {
  it('se lit comme un court podcast : présentation, titre, pauses entre les paragraphes, conclusion', () => {
    const t = speechText({ title: 'Un titre.', source: 'Le Monde', summary: 'Un.\n\nDeux.' });
    expect(t).toBe([
      'La revue de presse de CKMoney. <break time="0.8s" /> ',
      `D'après Le Monde : <break time="0.5s" /> Un titre. <break time="1.5s" /> `,
      'Un. <break time="1.2s" /> ', 'Deux. <break time="1.2s" /> ', "C'était l'essentiel, d'après Le Monde.",
    ].join('\n\n'));
    expect(speechText({ title: 'Sans synthèse', source: 'X' })).toBe('');
  });

  it('épelle les sigles (sauf ceux qui se lisent comme des mots) et applique les prononciations de Christian', () => {
    const aliases = parseAliases('\ufeffTshisekedi = Tchissékédi\r\nRDC = République démocratique du Congo\n# commentaire\nligne sans égal');
    expect(aliases).toEqual([['Tshisekedi', 'Tchissékédi'], ['RDC', 'République démocratique du Congo']]);
    const t = speechText({ title: 'T', source: 'S', summary: 'Le RDPC, la CEMAC, la RDC et Félix Tshisekedi (Tshisekedis non).' }, aliases);
    expect(t).toContain('Le R. D. P. C., la CEMAC, la République démocratique du Congo et Félix Tchissékédi (Tshisekedis non).');
  });

  it('génère l’audio des fiches publiées sans audio, avec la voix « Christian », et le relit en entier', async () => {
    store.set('articles/a', { kind: 'press', status: 'published', title: 'T', source: 'Reuters', summary: 'Synthèse.', publishedAt: '2026-11-14' });
    store.set('articles/b', { kind: 'own', status: 'published', title: 'Texte', body: 'x' });
    store.set('articles/c', { kind: 'press', status: 'draft', title: 'Brouillon', source: 'X', summary: 'S.' });
    const done = await generateAudios({ budgetMs: 10_000, f: fakeFetch });
    expect(done).toEqual({ T: 'audio' });
    const said = speechText({ title: 'T', source: 'Reuters', summary: 'Synthèse.' });
    const body = calls.find(c => c.url.includes('/text-to-speech/v2'))?.body;
    expect(body).toMatchObject({ model_id: 'eleven_v4', language_code: 'fr', voice_settings: VOICE_SETTINGS });
    // v4 : pauses par la ponctuation, pas de balise
    expect(body.text).not.toContain('<break');
    expect(body.text).toContain('La revue de presse de CKMoney.…');
    expect(VOICE_SETTINGS.speed).toBeLessThan(1);
    expect(store.get('articles/a').audioHash).toBe(hashOf(said));
    expect(store.get('articleAudio/a').chunks).toBe(3);
    expect((await loadAudio('a'))!.length).toBe(2_000_000);
    // Déjà fait : rien de plus ; synthèse modifiée : refait
    calls.length = 0;
    expect(await generateAudios({ budgetMs: 10_000, f: fakeFetch })).toEqual({});
    store.set('articles/a', { ...store.get('articles/a'), summary: 'Synthèse corrigée.' });
    expect(await generateAudios({ budgetMs: 10_000, f: fakeFetch })).toEqual({ T: 'audio' });
  });

  it('sans clé ElevenLabs : rien', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    store.set('articles/a', { kind: 'press', status: 'published', title: 'T', source: 'R', summary: 'S.' });
    expect(await generateAudios({ budgetMs: 10_000, f: fakeFetch })).toEqual({});
    expect(calls).toEqual([]);
  });

  it('crédits épuisés : pause, Christian prévenu une fois, un essai par jour, reprise dès que le compte est rechargé', async () => {
    let quota = true;
    const f = (async (url: string, init?: any) => {
      calls.push({ url });
      if (url.endsWith('/voices')) return new Response(JSON.stringify({ voices: [{ voice_id: 'v2', name: 'Christian voice' }] }));
      if (quota) return new Response(JSON.stringify({ detail: { status: 'quota_exceeded' } }), { status: 401 });
      return new Response(new Uint8Array(10));
    }) as any;
    ['a', 'b', 'c'].forEach(id => store.set(`articles/${id}`, { kind: 'press', status: 'published', title: id, source: 'R', summary: 'S.' }));
    const t = Date.parse('2026-11-19T10:00:00Z');
    expect((await generateAudios({ budgetMs: 10_000, f, now: t })).a).toBe('audio : quota');
    expect(store.get('settings/voice')).toMatchObject({ pausedAt: '2026-11-19T10:00:00.000Z', reason: 'quota' });
    expect(pushed).toEqual([{ uid: 'chris', title: 'Audio en pause' }]);
    // Pendant la pause : aucun appel à ElevenLabs
    calls.length = 0;
    expect(await generateAudios({ budgetMs: 10_000, f, now: t + 3600_000 })).toEqual({ voix: 'en pause' });
    expect(calls).toEqual([]);
    // Le lendemain, toujours sans crédits : un seul essai, pas de nouveau message
    expect(Object.keys(await generateAudios({ budgetMs: 10_000, f, now: t + PAUSE_RETRY_MS + 1 }))).toHaveLength(1);
    expect(pushed).toHaveLength(1);
    // Compte rechargé : l'essai du jour réussit, la pause est levée, puis tout reprend
    quota = false;
    expect(Object.values(await generateAudios({ budgetMs: 10_000, f, now: t + 2 * PAUSE_RETRY_MS + 2 }))).toEqual(['audio']);
    expect(store.get('settings/voice').pausedAt).toBeNull();
    expect(pushed.map(p => p.title)).toEqual(['Audio en pause', 'Audio relancé']);
    expect(Object.values(await generateAudios({ budgetMs: 10_000, f, now: t + 2 * PAUSE_RETRY_MS + 3 }))).toEqual(['audio', 'audio']);
  });

  it('v4 refusé : Multilingual v2 avec les balises de pause ; la voix « Christian voice » est choisie', async () => {
    const f = (async (url: string, init?: any) => {
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ url, body });
      if (url.endsWith('/voices')) return new Response(JSON.stringify({ voices: [{ voice_id: 'x', name: 'Christian ancien' }, { voice_id: 'v9', name: 'Christian voice' }] }));
      if (body.model_id === 'eleven_v4') return new Response('{"detail":"unsupported"}', { status: 400 });
      return new Response(new Uint8Array(5));
    }) as any;
    process.env.ELEVENLABS_API_KEY = 'autre-cle';
    store.set('articles/a', { kind: 'press', status: 'published', title: 'T', source: 'R', summary: 'S.' });
    expect(await generateAudios({ budgetMs: 10_000, f })).toEqual({ T: 'audio' });
    const tts = calls.filter(c => c.url.includes('/text-to-speech/'));
    expect(tts.map(c => [c.url.includes('/v9?'), c.body.model_id])).toEqual([[true, 'eleven_v4'], [true, 'eleven_multilingual_v2']]);
    expect(tts[1].body.text).toContain('<break time="0.8s" />');
  });
});

