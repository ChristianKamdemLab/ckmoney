import { describe, it, expect, beforeEach } from 'vitest';

// La voix (ElevenLabs simulé) : choix de la voix de Christian, repli de v4 vers Multilingual v2, crédits épuisés.
// L'audio des fiches « Écouter L'essentiel » a été retiré le 27/11 ; seul le Décryptage du jour parle.

const { synthesize, voiceEnabled, VOICE_SETTINGS } = await import('../api/_lib/voice');

const calls: { url: string; body?: any }[] = [];
const fake = (opts: { refuseV4?: boolean; quota?: boolean } = {}) => (async (url: string, init?: any) => {
  const body = init?.body ? JSON.parse(init.body) : undefined;
  calls.push({ url, body });
  if (url.endsWith('/voices')) return new Response(JSON.stringify({ voices: [{ voice_id: 'x', name: 'Christian ancien' }, { voice_id: 'v9', name: 'Christian Kamdem voice' }, { voice_id: 'g1', name: 'Victoria - Warm and calm' }] }));
  if (opts.quota) return new Response('{"detail":{"status":"quota_exceeded"}}', { status: 401 });
  if (opts.refuseV4 && body.model_id === 'eleven_v4') return new Response('{"detail":"unsupported"}', { status: 400 });
  return new Response(new Uint8Array(5));
}) as any;

let n = 0;
beforeEach(() => {
  calls.length = 0;
  process.env.ELEVENLABS_API_KEY = `cle-${n++}`; // une clé neuve : pas de voix gardée en mémoire d'un test à l'autre
  delete process.env.ELEVENLABS_VOICE_ID; delete process.env.ELEVENLABS_MODEL;
});

describe('Voix ElevenLabs', () => {
  it('sans clé : voix désactivée', () => {
    delete process.env.ELEVENLABS_API_KEY;
    expect(voiceEnabled()).toBe(false);
  });

  it('choisit « Christian Kamdem voice », en français, avec les réglages de lecture', async () => {
    const out = await synthesize('Bonjour.', fake());
    expect(out.length).toBe(5);
    const tts = calls.filter(c => c.url.includes('/text-to-speech/'));
    expect(tts).toHaveLength(1);
    expect(tts[0].url).toContain('/v9?');
    expect(tts[0].body).toMatchObject({ model_id: 'eleven_v4', language_code: 'fr', voice_settings: VOICE_SETTINGS });
  });

  it('v4 refusé : nouvel essai avec Multilingual v2', async () => {
    await synthesize('Une phrase.', fake({ refuseV4: true }));
    expect(calls.filter(c => c.url.includes('/text-to-speech/')).map(c => c.body.model_id)).toEqual(['eleven_v4', 'eleven_multilingual_v2']);
  });

  it('crédits épuisés : erreur « quota » (la voix se met en pause)', async () => {
    await expect(synthesize('Une phrase.', fake({ quota: true }))).rejects.toThrow('quota');
  });

  it('seconde voix : Victoria quand on la demande', async () => {
    await synthesize('Une phrase.', fake(), undefined, undefined, 'guest');
    expect(calls.find(c => c.url.includes('/text-to-speech/'))!.url).toContain('/g1?');
  });
});
