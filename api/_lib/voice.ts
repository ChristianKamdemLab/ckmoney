import { createHash } from 'node:crypto';
import { adminDb, adminAuth, authorEmail, pushToUser } from './admin.js';

// « Écouter » : « L'essentiel » des fiches de revue de presse lu par la voix de Christian (ElevenLabs).
// L'audio est généré une fois par fiche (et refait si la synthèse change), découpé en morceaux dans
// Firestore (collection articleAudio, fermée aux téléphones : elle ne se lit que par /api/articles).
// Variables Vercel : ELEVENLABS_API_KEY (obligatoire), ELEVENLABS_VOICE_ID ou ELEVENLABS_VOICE_NAME
// (sinon la première voix dont le nom contient « Christian »).

const API = 'https://api.elevenlabs.io/v1';
const CHUNK = 900_000;                 // octets par document Firestore (limite : 1 Mo)
export const MAX_SPEECH = 5000;        // caractères envoyés à ElevenLabs pour une fiche

export const voiceEnabled = () => !!process.env.ELEVENLABS_API_KEY;

// Réglages de la voix (19/11, retour de Christian : trop rapide, sans pauses, pas assez « podcast »).
// Changer un réglage ou VOICE_VERSION refait tous les audios.
export const VOICE_VERSION = 2;
export const VOICE_SETTINGS = { stability: 0.6, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true, speed: 0.88 };
const pause = (s: number) => ` <break time="${s.toFixed(1)}s" /> `;

// Sigles lus comme des mots (les autres sont épelés : R. D. P. C.)
const WORD_ACRONYMS = new Set(['OTAN', 'ONU', 'UNESCO', 'CEMAC', 'OPEP', 'FIFA', 'UNICEF', 'COVID', 'NASA', 'CAN', 'CAF', 'COP', 'BRICS', 'ASEAN', 'OHADA', 'UEMOA', 'CEDEAO', 'SADC', 'CIA', 'FBI', 'PDG']);
const spellAcronyms = (t: string) => t.replace(/\b[A-Z]{2,6}\b/g, w => WORD_ACRONYMS.has(w) ? w : w.split('').join('. ') + '.');

/** Prononciations : « Tshisekedi = Tchissékédi », une par ligne (document « CKMoney · Prononciations »). */
export const parseAliases = (raw: string) => {
  const out: [string, string][] = [];
  for (const line of String(raw || '').replace(/^\ufeff/, '').split(/\r?\n/)) {
    const m = line.match(/^\s*([^=#]{2,60}?)\s*=\s*(.{1,80}?)\s*$/);
    if (m) out.push([m[1], m[2]]);
  }
  return out;
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const applyAliases = (t: string, aliases: [string, string][]) =>
  aliases.reduce((acc, [from, to]) => acc.replace(new RegExp(`(?<![\\p{L}])${esc(from)}(?![\\p{L}])`, 'gu'), to), t);

/** Ce qui est lu, comme un court podcast : présentation, titre, puis « L'essentiel » avec des pauses. */
export const speechText = (a: { title?: string; source?: string; summary?: string }, aliases: [string, string][] = []) => {
  const paras = String(a.summary || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (!paras.length) return '';
  const say = (t: string) => spellAcronyms(applyAliases(t, aliases));
  const source = String(a.source || 'la presse').trim();
  const text = [
    `La revue de presse de CKMoney.${pause(0.8)}`,
    `D'après ${say(source)} :${pause(0.5)}${say(String(a.title || '').trim().replace(/[.!?…]+$/, ''))}.${pause(1.5)}`,
    ...paras.map(p => `${say(p)}${pause(1.2)}`),
    `C'était l'essentiel, d'après ${say(source)}.`,
  ].join('\n\n');
  return text.slice(0, MAX_SPEECH);
};
export const hashOf = (s: string) => createHash('sha1').update(`${VOICE_VERSION}|${JSON.stringify(VOICE_SETTINGS)}|${s}`).digest('hex').slice(0, 16);

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
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', language_code: 'fr', voice_settings: VOICE_SETTINGS }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    // Crédits épuisés (ou clé refusée) : on met la voix en pause plutôt que de réessayer à chaque passage
    if (/quota|insufficient|credits/i.test(detail) || r.status === 402) throw new Error('quota');
    throw new Error(`tts_${r.status}`);
  }
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

// Pause : quand ElevenLabs refuse (crédits épuisés, clé refusée), plus d'appel pendant 24 h, puis un
// seul essai par jour ; dès qu'un essai réussit (compte rechargé), tout reprend. Christian est prévenu
// une fois à la mise en pause et une fois à la reprise. État : settings/voice.
export const PAUSE_RETRY_MS = 24 * 3600_000;
const pauseRef = () => adminDb.collection('settings').doc('voice');
const tellChristian = async (title: string, body: string) => {
  try {
    const email = authorEmail();
    if (!email) return;
    const u = await adminAuth.getUserByEmail(email);
    await pushToUser(u.uid, { title, body, url: '/', tag: 'voix-ckmoney' });
  } catch { /* la pause compte plus que le message */ }
};

/** Génère l'audio des fiches publiées qui n'en ont pas (ou dont la synthèse a changé), dans le temps donné. */
export const generateAudios = async (opts: { budgetMs: number; max?: number; f?: Fetch; now?: number; aliases?: [string, string][] }) => {
  const t0 = Date.now();
  const now = opts.now ?? Date.now();
  const done: Record<string, string> = {};
  if (!voiceEnabled()) return done;
  const pause = (await pauseRef().get()).data();
  const paused = !!pause?.pausedAt;
  if (paused && now - Date.parse(pause!.lastTryAt || pause!.pausedAt) < PAUSE_RETRY_MS) return { voix: 'en pause' };
  const snap = await adminDb.collection('articles').where('status', '==', 'published').get();
  const todo = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(a => a.kind === 'press' && speechText(a, opts.aliases) && a.audioHash !== hashOf(speechText(a, opts.aliases)))
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  // En pause : un seul essai, pour voir si le compte a été rechargé
  for (const a of todo.slice(0, paused ? 1 : (opts.max ?? 2))) {
    if (Date.now() - t0 > opts.budgetMs) break;
    try {
      const text = speechText(a, opts.aliases);
      const hash = hashOf(text);
      await saveAudio(a.id, hash, await synthesize(text, opts.f));
      await adminDb.collection('articles').doc(a.id).set({ audioHash: hash }, { merge: true });
      done[String(a.title).slice(0, 60)] = 'audio';
      if (paused) {
        await pauseRef().set({ pausedAt: null, lastTryAt: null, reason: null, resumedAt: new Date(now).toISOString() });
        await tellChristian('Audio relancé', "Ton compte ElevenLabs répond de nouveau : les fiches vont retrouver leur version audio.");
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      done[String(a.title).slice(0, 60)] = `audio : ${msg.slice(0, 60)}`;
      if (msg === 'quota' || /^(tts|voices)_(401|403)|voice_not_found/.test(msg)) {
        const iso = new Date(now).toISOString();
        await pauseRef().set({ pausedAt: pause?.pausedAt || iso, lastTryAt: iso, reason: msg });
        if (!paused) await tellChristian('Audio en pause', msg === 'quota'
          ? "Plus de crédits ElevenLabs : les nouvelles fiches n'auront pas de version audio. Tout reprendra seul dès que ton compte sera rechargé."
          : "ElevenLabs refuse la clé de l'appli (ou ne trouve pas ta voix). Les nouvelles fiches n'auront pas d'audio tant que ce n'est pas réglé.");
        break;
      }
    }
  }
  return done;
};
