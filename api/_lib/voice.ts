import { createHash } from 'node:crypto';
import { adminDb, adminAuth, authorEmail, pushToUser } from './admin.js';

// « Écouter » : « L'essentiel » des fiches de revue de presse, et les textes CKLabs en entier, lus par la
// voix de Christian (ElevenLabs). L'audio est généré une fois par article (et refait si le texte change),
// paragraphe par paragraphe, au fil des passages s'il est long ; le résultat est découpé en morceaux dans
// Firestore (collection articleAudio, fermée aux téléphones : elle ne se lit que par /api/articles).
// Variables Vercel : ELEVENLABS_API_KEY (obligatoire), ELEVENLABS_VOICE_ID ou ELEVENLABS_VOICE_NAME
// (sinon la première voix dont le nom contient « Christian »).

const API = 'https://api.elevenlabs.io/v1';
const CHUNK = 900_000;                 // octets par document Firestore (limite : 1 Mo)
export const MAX_SPEECH = 5000;        // caractères envoyés à ElevenLabs pour une fiche de presse
export const MAX_OWN_SPEECH = 20_000;  // pour un texte CKLabs (au-delà, l'audio dépasserait la taille servie)
const MAX_SEGMENT = 1200;              // caractères par demande (un paragraphe, coupé aux phrases s'il est long)

export const voiceEnabled = () => !!process.env.ELEVENLABS_API_KEY;

// Réglages de la voix (19/11, retour de Christian : trop rapide, sans pauses, pas assez « podcast »).
// Changer un réglage ou VOICE_VERSION refait tous les audios.
export const VOICE_VERSION = 5; // 5 : nouveau clone « Christian Kamdem voice » (20/11)
// Modèle ElevenLabs : Eleven v4 (19/11, choix de Christian), sinon ELEVENLABS_MODEL. Si v4 refuse la
// demande, on retombe sur Multilingual v2. v4 ne lit pas les balises <break> : les pauses y passent par
// la ponctuation.
export const MODEL = () => process.env.ELEVENLABS_MODEL || 'eleven_v4';
const FALLBACK_MODEL = 'eleven_multilingual_v2';
const forModel = (text: string, model: string) =>
  model === 'eleven_multilingual_v2' ? text : text.replace(/\s*<break time="([\d.]+)s" \/>\s*/g, (_, t) => (+t >= 1 ? '…\n\n' : '… '));
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
/** Les morceaux lus, un par paragraphe : générés en parallèle puis mis bout à bout (une seule demande
 *  pour toute la fiche dépassait les 60 s de la fonction avec Eleven v4, le 19/11). */
export const speechSegments = (a: { title?: string; source?: string; summary?: string }, aliases: [string, string][] = []) => {
  const paras = String(a.summary || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (!paras.length) return [];
  const say = (t: string) => spellAcronyms(applyAliases(t, aliases));
  const source = String(a.source || 'la presse').trim();
  const segs = [
    `La revue de presse de CKMoney.${pause(0.8)}D'après ${say(source)} :${pause(0.5)}${say(String(a.title || '').trim().replace(/[.!?…]+$/, ''))}.${pause(1.5)}`,
    ...paras.map(p => `${say(p)}${pause(1.2)}`),
  ];
  segs[segs.length - 1] += `C'était l'essentiel, d'après ${say(source)}.`;
  let total = 0;
  return segs.filter(x => (total += x.length) <= MAX_SPEECH);
};
/** Un paragraphe trop long est coupé entre deux phrases. */
const splitLong = (p: string) => {
  if (p.length <= MAX_SEGMENT) return [p];
  const out: string[] = [];
  let cur = '';
  for (const sentence of p.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) || [p]) {
    if (cur && (cur + sentence).length > MAX_SEGMENT) { out.push(cur.trim()); cur = ''; }
    cur += sentence;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

/** Texte CKLabs : présentation, titre, puis le texte entier (intertitres suivis d'une pause). */
export const ownSegments = (a: { title?: string; body?: string; authorName?: string }, aliases: [string, string][] = []) => {
  const lines = String(a.body || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) return [];
  const say = (t: string) => spellAcronyms(applyAliases(t, aliases));
  const first = String(a.authorName || 'Christian').split(' ')[0] || 'Christian';
  const segs = [`Un texte de ${first}, pour CKLabs.${pause(0.8)}${say(String(a.title || '').trim().replace(/[.!?…]+$/, ''))}.${pause(1.5)}`];
  for (const l of lines) {
    if (/^#{1,3}\s+/.test(l)) segs.push(`${pause(0.8)}${say(l.replace(/^#{1,3}\s+/, '').replace(/[.!?…:]+$/, ''))}.${pause(1.0)}`);
    else segs.push(...splitLong(say(l.replace(/^[-•]\s+/, ''))).map(x => `${x}${pause(0.9)}`));
  }
  segs[segs.length - 1] += `${pause(0.8)}C'était un texte de ${first}, pour CKLabs.`;
  let total = 0;
  return segs.filter(x => (total += x.length) <= MAX_OWN_SPEECH);
};

/** Les morceaux d'un article, presse ou CKLabs. */
// Textes CKLabs : plus d'audio (Christian, 19/11 : « je n'ai pas aimé ma voix ») ; seule la revue de
// presse est lue. ownSegments reste disponible si on y revient.
export const segmentsOf = (a: any, aliases: [string, string][] = []) =>
  a.kind === 'press' ? speechSegments(a, aliases).flatMap(splitLong) : [];
const formatOf = (a: any) => (a.kind === 'press' ? 'mp3_44100_64' : 'mp3_44100_32');

export const speechText = (a: { title?: string; source?: string; summary?: string }, aliases: [string, string][] = []) =>
  speechSegments(a, aliases).join('\n\n');
export const hashOf = (s: string) => createHash('sha1').update(`${VOICE_VERSION}|${MODEL()}|${JSON.stringify(VOICE_SETTINGS)}|${s}`).digest('hex').slice(0, 16);

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

const TTS_TIMEOUT_MS = 25_000;
export const synthesize = async (text: string, f: Fetch = fetch, model = MODEL(), format = 'mp3_44100_64'): Promise<Buffer> => {
  const id = await voiceId(f);
  const r = await f(`${API}/text-to-speech/${encodeURIComponent(id)}?output_format=${format}`, {
    method: 'POST', signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: forModel(text, model), model_id: model, language_code: 'fr', voice_settings: VOICE_SETTINGS }),
  });
  // Modèle refusé (paramètre non pris en charge, modèle indisponible sur le compte) : Multilingual v2
  if ((r.status === 400 || r.status === 422) && model !== FALLBACK_MODEL) return synthesize(text, f, FALLBACK_MODEL, format);
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

export const removeAudio = async (articleId: string) => {
  const ref = audioCol().doc(articleId);
  const meta = (await ref.get()).data();
  for (let i = 0; i < (meta?.chunks || 0); i++) await ref.collection('chunks').doc(String(i)).delete().catch(() => 0);
  await ref.delete().catch(() => 0);
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
  // Une pause pour clé ou voix refusée ne compte plus quand les réglages de la voix ont changé
  const stale = !!pause?.pausedAt && pause.reason !== 'quota' && pause.version !== VOICE_VERSION;
  const paused = !!pause?.pausedAt && !stale;
  if (paused && now - Date.parse(pause!.lastTryAt || pause!.pausedAt) < PAUSE_RETRY_MS) return { voix: 'en pause' };
  if (stale) await pauseRef().set({ pausedAt: null, lastTryAt: null, reason: null, resumedAt: new Date(now).toISOString() });
  const snap = await adminDb.collection('articles').where('status', '==', 'published').get();
  // Audio retiré des textes CKLabs : on efface ce qui avait été fait
  for (const d of snap.docs) {
    const a = d.data() as any;
    if (a.kind === 'press' || !a.audioHash) continue;
    await adminDb.collection('articles').doc(d.id).set({ audioHash: null }, { merge: true });
    await removeAudio(d.id);
    done[String(a.title).slice(0, 60)] = 'audio retiré';
  }
  const hashFor = (a: any) => hashOf(`${formatOf(a)}|${segmentsOf(a, opts.aliases).join('\n\n')}`);
  const todo = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(a => segmentsOf(a, opts.aliases).length && a.audioHash !== hashFor(a))
    // Revue de presse d'abord (plus courte), puis les textes CKLabs ; les plus récents en premier
    .sort((a, b) => (a.kind === 'press' ? 0 : 1) - (b.kind === 'press' ? 0 : 1) || String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  const left = () => opts.budgetMs - (Date.now() - t0);
  let finished = 0;
  // En pause : un seul article essayé, pour voir si le compte a été rechargé
  for (const a of todo.slice(0, paused ? 1 : (opts.max ?? 50))) {
    if (left() <= 0) break;
    const label = String(a.title).slice(0, 60);
    try {
      const segs = segmentsOf(a, opts.aliases);
      const format = formatOf(a);
      // Morceaux déjà générés lors d'un passage précédent (gardés tant que l'article n'est pas fini)
      const parts = audioCol().doc(a.id).collection('parts');
      const keys = segs.map(x => hashOf(`${format}|${x}`));
      const have = new Map<string, Buffer>();
      for (const k of new Set(keys)) { const d = (await parts.doc(k).get()).data(); if (d?.data) have.set(k, Buffer.from(d.data)); }
      let next = 0;
      const worker = async () => {
        while (next < segs.length && left() > 0) {
          const i = next++;
          if (have.has(keys[i])) continue;
          const mp3 = await synthesize(segs[i], opts.f, MODEL(), format);
          have.set(keys[i], mp3);
          await parts.doc(keys[i]).set({ data: mp3 });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (keys.some(k => !have.has(k))) { done[label] = `audio en cours (${keys.filter(k => have.has(k)).length}/${keys.length})`; break; }
      const hash = hashFor(a);
      await saveAudio(a.id, hash, Buffer.concat(keys.map(k => have.get(k)!)));
      await adminDb.collection('articles').doc(a.id).set({ audioHash: hash }, { merge: true });
      for (const k of new Set(keys)) await parts.doc(k).delete().catch(() => 0);
      done[label] = 'audio';
      finished++;
      if (paused) {
        await pauseRef().set({ pausedAt: null, lastTryAt: null, reason: null, resumedAt: new Date(now).toISOString() });
        await tellChristian('Audio relancé', "Ton compte ElevenLabs répond de nouveau : les articles vont retrouver leur version audio.");
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      done[label] = `audio : ${msg.slice(0, 60)}`;
      if (msg === 'quota' || /^(tts|voices)_(401|403)|voice_not_found/.test(msg)) {
        const iso = new Date(now).toISOString();
        await pauseRef().set({ pausedAt: (!stale && pause?.pausedAt) || iso, lastTryAt: iso, reason: msg, version: VOICE_VERSION });
        if (!paused) await tellChristian('Audio en pause', msg === 'quota'
          ? "Plus de crédits ElevenLabs : les nouveaux articles n'auront pas de version audio. Tout reprendra seul dès que ton compte sera rechargé."
          : "ElevenLabs refuse la clé de l'appli (ou ne trouve pas ta voix). Les nouveaux articles n'auront pas d'audio tant que ce n'est pas réglé.");
        break;
      }
      break;
    }
  }
  void finished;
  return done;
};
