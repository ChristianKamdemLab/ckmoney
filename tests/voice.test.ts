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
vi.mock('../api/_lib/admin.js', () => ({ adminDb: { collection: colRef } }));

const { speechText, hashOf, generateAudios, loadAudio } = await import('../api/_lib/voice');

const calls: { url: string; body?: any }[] = [];
const fakeFetch = (async (url: string, init?: any) => {
  calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
  if (url.endsWith('/voices')) return new Response(JSON.stringify({ voices: [{ voice_id: 'v1', name: 'Rachel' }, { voice_id: 'v2', name: 'Christian voice' }] }));
  return new Response(new Uint8Array(2_000_000).fill(7));
}) as any;

beforeEach(() => {
  store.clear(); calls.length = 0;
  process.env.ELEVENLABS_API_KEY = 'cle-de-test';
  delete process.env.ELEVENLABS_VOICE_ID;
});

describe('Écouter L’essentiel', () => {
  it('lit le titre, le journal puis la synthèse', () => {
    expect(speechText({ title: 'Un titre', source: 'Le Monde', summary: 'Un.\n\nDeux.' })).toBe("Un titre. D'après Le Monde.\n\nUn.\n\nDeux.");
    expect(speechText({ title: 'Sans synthèse', source: 'X' })).toBe('');
  });

  it('génère l’audio des fiches publiées sans audio, avec la voix « Christian », et le relit en entier', async () => {
    store.set('articles/a', { kind: 'press', status: 'published', title: 'T', source: 'Reuters', summary: 'Synthèse.', publishedAt: '2026-11-14' });
    store.set('articles/b', { kind: 'own', status: 'published', title: 'Texte', body: 'x' });
    store.set('articles/c', { kind: 'press', status: 'draft', title: 'Brouillon', source: 'X', summary: 'S.' });
    const done = await generateAudios({ budgetMs: 10_000, f: fakeFetch });
    expect(done).toEqual({ T: 'audio' });
    expect(calls.find(c => c.url.includes('/text-to-speech/v2'))?.body).toMatchObject({ text: "T. D'après Reuters.\n\nSynthèse.", model_id: 'eleven_multilingual_v2' });
    expect(store.get('articles/a').audioHash).toBe(hashOf("T. D'après Reuters.\n\nSynthèse."));
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
});
