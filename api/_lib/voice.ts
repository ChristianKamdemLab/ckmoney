// Voix ElevenLabs du « Décryptage du jour » (api/_lib/decryptage.ts) : le clone de Christian et la
// seconde voix, et le jingle d'ouverture. (L'écoute des articles a été retirée le 24/11, avec son code.)
// Variables Vercel : ELEVENLABS_API_KEY (obligatoire), ELEVENLABS_VOICE_ID ou ELEVENLABS_VOICE_NAME
// (sinon la première voix dont le nom contient « Christian »), ELEVENLABS_GUEST_VOICE_ID, ELEVENLABS_MODEL.

const API = 'https://api.elevenlabs.io/v1';

export const voiceEnabled = () => !!process.env.ELEVENLABS_API_KEY;

// Modèle ElevenLabs : Eleven v4 (19/11, choix de Christian), sinon ELEVENLABS_MODEL. Si v4 refuse la
// demande, on retombe sur Multilingual v2. v4 ne lit pas les balises <break> : les pauses y passent par
// la ponctuation.
export const MODEL = () => process.env.ELEVENLABS_MODEL || 'eleven_v4';
const FALLBACK_MODEL = 'eleven_multilingual_v2';
const forModel = (text: string, model: string) =>
  model === 'eleven_multilingual_v2' ? text : text.replace(/\s*<break time="([\d.]+)s" \/>\s*/g, (_, t) => (+t >= 1 ? '…\n\n' : '… '));
export const VOICE_SETTINGS = { stability: 0.6, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true, speed: 0.88 };
/** Réglages du « Décryptage du jour » (24/11, Christian : « pas assez claire ») : voix plus proche du
 *  timbre d'origine et plus nette (similarity_boost), un peu plus vivante (stability, style), débit de
 *  podcast (speed). */
export const PODCAST_SETTINGS = { stability: 0.72, similarity_boost: 0.7, style: 0, use_speaker_boost: false, speed: 0.93 };
// Réglages du 24/11 au soir (Christian : « plus suave, rassurante, moins de bruitage derrière la voix ») :
// stabilité haute et style à 0 pour une voix posée ; similarité et amplification plus basses pour ne plus
// reproduire le souffle et les bruits de l'enregistrement du clone ; débit un peu plus lent.
/** La seconde voix du décryptage, choisie par Christian le 24/11 dans la bibliothèque ElevenLabs. */
export const GUEST_VOICE_NAME = 'Victoria - Warm and calm';
type Fetch = typeof fetch;
const cachedVoice = new Map<string, string>();
const voiceId = async (f: Fetch) => {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  const r = await f(`${API}/voices`, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! } });
  if (!r.ok) throw new Error(`voices_${r.status}`);
  const voices: { voice_id: string; name: string }[] = (await r.json())?.voices || [];
  // Le clone de Christian : « Christian Kamdem voice » depuis le 20/11 (avant : « Christian voice »)
  const wanted = (process.env.ELEVENLABS_VOICE_NAME || 'christian kamdem voice').toLowerCase();
  const key = `${process.env.ELEVENLABS_API_KEY}|${wanted}`;
  if (cachedVoice.has(key)) return cachedVoice.get(key)!;
  const v = voices.find(x => x.name.toLowerCase() === wanted) || voices.find(x => x.name.toLowerCase().includes(wanted))
    || voices.find(x => /christian/i.test(x.name));
  if (!v) throw new Error('voice_not_found');
  cachedVoice.set(key, v.voice_id);
  return v.voice_id;
};

/** La seconde voix du « Décryptage du jour » : ELEVENLABS_GUEST_VOICE_ID, sinon une voix féminine qui
 *  parle français dans le compte (sinon la première voix féminine des voix fournies par ElevenLabs). */
const guestVoiceId = async (f: Fetch) => {
  if (process.env.ELEVENLABS_GUEST_VOICE_ID) return process.env.ELEVENLABS_GUEST_VOICE_ID;
  const key = `${process.env.ELEVENLABS_API_KEY}|guest|${GUEST_VOICE_NAME}`;
  if (cachedVoice.has(key)) return cachedVoice.get(key)!;
  const r = await f(`${API}/voices`, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! } });
  if (!r.ok) throw new Error(`voices_${r.status}`);
  const voices: any[] = (await r.json())?.voices || [];
  const female = (v: any) => /female|femme/i.test(String(v?.labels?.gender || ''));
  const french = (v: any) => /fr/i.test(String(v?.labels?.language || '')) || /french|fran/i.test(String(v?.labels?.accent || ''))
    || (v?.verified_languages || []).some((l: any) => /^fr/i.test(String(l?.language || '')));
  const v = voices.find(x => String(x.name || '').startsWith(GUEST_VOICE_NAME))
    || voices.find(x => female(x) && french(x) && !/christian/i.test(x.name))
    || voices.find(x => female(x) && x.category === 'premade')
    || voices.find(x => female(x) && !/christian/i.test(x.name));
  if (!v) throw new Error('guest_voice_not_found');
  cachedVoice.set(key, v.voice_id);
  return v.voice_id;
};

const TTS_TIMEOUT_MS = 25_000;
export const synthesize = async (text: string, f: Fetch = fetch, model = MODEL(), format = 'mp3_44100_64', who: 'host' | 'guest' = 'host', settings: typeof VOICE_SETTINGS = VOICE_SETTINGS): Promise<Buffer> => {
  const id = who === 'guest' ? await guestVoiceId(f) : await voiceId(f);
  const r = await f(`${API}/text-to-speech/${encodeURIComponent(id)}?output_format=${format}`, {
    method: 'POST', signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: forModel(text, model), model_id: model, language_code: 'fr', voice_settings: settings }),
  });
  // Modèle refusé (paramètre non pris en charge, modèle indisponible sur le compte) : Multilingual v2
  if ((r.status === 400 || r.status === 422) && model !== FALLBACK_MODEL) return synthesize(text, f, FALLBACK_MODEL, format, who, settings);
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    // Crédits épuisés (ou clé refusée) : on met la voix en pause plutôt que de réessayer à chaque passage
    if (/quota|insufficient|credits/i.test(detail) || r.status === 402) throw new Error('quota');
    throw new Error(`tts_${r.status}`);
  }
  return Buffer.from(await r.arrayBuffer());
};

/** Le jingle d'ouverture du « Décryptage du jour » : quelques secondes de musique créées une fois par
 *  ElevenLabs (effets sonores), sans voix. Changer JINGLE_PROMPT ou JINGLE_VERSION le refait. */
export const JINGLE_VERSION = 2;
export const JINGLE_PROMPT = 'Short upbeat news podcast intro jingle, warm Cameroonian makossa groove with a bright saxophone riff and bass, modern, elegant and confident, clean ending, no vocals';
export const JINGLE_SECONDS = 6;
export const generateJingle = async (f: Fetch = fetch): Promise<Buffer> => {
  const r = await f(`${API}/sound-generation?output_format=mp3_44100_96`, {
    method: 'POST', signal: AbortSignal.timeout(40_000),
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: JINGLE_PROMPT, duration_seconds: JINGLE_SECONDS, prompt_influence: 0.6 }),
  });
  if (!r.ok) throw new Error(`jingle_${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};
