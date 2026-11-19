import { createHash } from 'node:crypto';
import { adminDb } from './admin.js';

// « Écouter » : « L'essentiel » des fiches de revue de presse lu par la voix de Christian (ElevenLabs).
// L'audio est généré une fois par fiche (et refait si la synthèse change), découpé en morceaux dans
// Firestore (collection articleAudio, fermée aux téléphones : elle ne se lit que par /api/articles).
// Variables Vercel : ELEVENLABS_API_KEY (obligatoire), ELEVENLABS_VOICE_ID ou ELEVENLABS_VOICE_NAME
// (sinon la première voix dont le nom contient « Christian »).

const API = 'https://api.elevenlabs.io/v1';
const CHUNK = 900_000;                 // octets par document Firestore (limite : 1 Mo)
export const MAX_SPEECH = 5000;        // caractères envoyés à ElevenLabs pour une fiche

export const voiceEnabled = () => !!process.env.ELEVENLABS_API_KEY;

/** Ce qui est lu : le titre, le journal, puis « L'essentiel ». */
export const speechText = (a: { title?: string; source?: string; summary?: string }) => {
  const summary = String(a.summary || '').split(/\n+/).map(s => s.trim()).filter(Boolean).join('\n\n');
  if (!summary) return '';
  return `${String(a.title || '').trim()}. D'après ${String(a.source || 'la presse').trim()}.\n\n${summary}`.slice(0, MAX_SPEECH);
};
export const hashOf = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);

type Fetch = typeof fetch;
let cachedVoice = '';
const voiceId = async (f: Fetch) => {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  if (cachedVoice) return cachedVoice;
  const r = await f(`${API}/voices`, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! } });
  if (!r.ok) throw new Error(`voices_${r.status}`);
  const voices: { voice_id: string; name: string }[] = (await r.json())?.voices || [];
  const wanted = (process.env.ELEVENLABS_VOICE_NAME || 'christian').toLowerCase();
  const v = voices.find(x => x.name.toLowerCase() === wanted) || voices.find(x => x.name.toLowerCase().includes(wanted));
  if (!v) throw new Error('voice_not_found');
  return (cachedVoice = v.voice_id);
};

export const synthesize = async (text: string, f: Fetch = fetch): Promise<Buffer> => {
  const id = await voiceId(f);
  const r = await f(`${API}/text-to-speech/${encodeURIComponent(id)}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!r.ok) throw new Error(`tts_${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};

const audioCol = () => adminDb.collection('articleAudio');

export const saveAudio = async (articleId: string, hash: string, mp3: Buffer) => {
  const ref = audioCol().doc(articleId);
  const n = Math.ceil(mp3.length / CHUNK);
  for (let i = 0; i < n; i++) await ref.collection('chunks').doc(String(i)).set({ data: mp3.subarray(i * CHUNK, (i + 1) * CHUNK) });
  await ref.set({ hash, chunks: n, bytes: mp3.length, at: new Date().toISOString() });
};

export const loadAudio = async (articleId: string): Promise<Buffer | null> => {
  const ref = audioCol().doc(articleId);
  const meta = (await ref.get()).data();
  if (!meta?.chunks) return null;
  const parts: Buffer[] = [];
  for (let i = 0; i < meta.chunks; i++) {
    const d = (await ref.collection('chunks').doc(String(i)).get()).data();
    if (!d?.data) return null;
    parts.push(Buffer.from(d.data));
  }
  return Buffer.concat(parts);
};

/** Génère l'audio des fiches publiées qui n'en ont pas (ou dont la synthèse a changé), dans le temps donné. */
export const generateAudios = async (opts: { budgetMs: number; max?: number; f?: Fetch }) => {
  const t0 = Date.now();
  const done: Record<string, string> = {};
  if (!voiceEnabled()) return done;
  const snap = await adminDb.collection('articles').where('status', '==', 'published').get();
  const todo = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(a => a.kind === 'press' && speechText(a) && a.audioHash !== hashOf(speechText(a)))
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  for (const a of todo.slice(0, opts.max ?? 2)) {
    if (Date.now() - t0 > opts.budgetMs) break;
    try {
      const text = speechText(a);
      const hash = hashOf(text);
      await saveAudio(a.id, hash, await synthesize(text, opts.f));
      await adminDb.collection('articles').doc(a.id).set({ audioHash: hash }, { merge: true });
      done[String(a.title).slice(0, 60)] = 'audio';
    } catch (e: any) {
      done[String(a.title).slice(0, 60)] = `audio : ${String(e?.message || e).slice(0, 60)}`;
      if (/^(tts|voices)_(401|402|403)|voice_not_found/.test(String(e?.message))) break;
    }
  }
  return done;
};
