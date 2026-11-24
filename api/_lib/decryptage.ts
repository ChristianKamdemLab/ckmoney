import { createHash } from 'node:crypto';
import { adminDb, adminAuth, authorEmail, pushToUser } from './admin.js';
import type { DriveFile } from './drive.js';
import { joinMp3, describe } from './mp3.js';

// 2 : MP3 recollé proprement (sans les trames d'information des morceaux) avec la vraie durée en tête
// 3 : le jingle (stéréo) n'est plus collé aux voix (mono) : le lecteur le joue juste avant
// 4 : voix en 96 kb/s au lieu de 64 (24/11, Christian : « pas assez claire »)
// 6 : voix suave (24/11 au soir) et seconde voix Victoria
export const AUDIO_VERSION = 7; // 7 : décryptage en solo, virgules sonores entre les sujets
import { decryptageDate, parseDecryptage, minutesOf, Decryptage, decryptageKeepFrom } from '../../utils/decryptage.js';
import { synthesize, MODEL, voiceEnabled, PODCAST_SETTINGS, GUEST_VOICE_NAME, generateJingle, JINGLE_VERSION, JINGLE_PROMPT } from './voice.js';

// « Le décryptage du jour » : lu dans le document « Décryptage · AAAA-MM-JJ » du dossier Drive (écrit par
// l'agent du matin), mis en voix réplique par réplique (Christian et la seconde voix, ElevenLabs) au fil
// des passages de /api/articles-sync, puis publié : notification à tous à partir de 9 h 30 (heure de
// Paris). Un brouillon (« Statut : brouillon ») n'est entendu que par Christian, prévenu quand il est prêt.
// Firestore : decryptage/{date} (texte, état) et decryptageAudio/{date}/parts|chunks (fermées aux
// téléphones, servies par /api/articles).

const col = () => adminDb.collection('decryptage');
const audioCol = () => adminDb.collection('decryptageAudio');
const CHUNK = 900_000;
const FORMAT = 'mp3_44100_96';

export // Virgule sonore : un son court en MP3 mono 44,1 kHz 96 kb/s, comme les voix, pour être collé entre deux
// sujets sans changer de format dans le fichier (le téléphone s'arrête à un changement mono/stéréo).
const STING_URL = 'https://ck-money.vercel.app/sting-1.mp3';
const STING_KEY = 'sting';
let stingCache: Buffer | null = null;
const sting = async (): Promise<Buffer> => {
  if (stingCache) return stingCache;
  try {
    const r = await fetch(STING_URL);
    const b = r.ok ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0);
    const ok = b.length > 1000 && describe(b).runs.every(x => x.fmt.includes('44100 mono'));
    stingCache = ok ? b : Buffer.alloc(0);
  } catch { stingCache = Buffer.alloc(0); }
  return stingCache;
};

export const isDecryptageDoc = (f: DriveFile) => !!decryptageDate(f.name) && f.mimeType !== 'application/pdf';

const lineHash = (who: string, text: string) =>
  createHash('sha1').update(`${FORMAT}|${MODEL()}|${JSON.stringify(PODCAST_SETTINGS)}|${who}|${who === 'guest' ? GUEST_VOICE_NAME : ''}|${text}`).digest('hex').slice(0, 16);

/** Lit les documents des 3 derniers jours ; un document modifié remet l'audio à refaire. */
export const syncDecryptage = async (files: DriveFile[], download: (f: DriveFile) => Promise<{ data?: Uint8Array; text?: string }>) => {
  const keep = decryptageKeepFrom();
  const docs = files.filter(f => isDecryptageDoc(f) && decryptageDate(f.name)! >= keep).sort((a, b) => decryptageDate(b.name)!.localeCompare(decryptageDate(a.name)!)).slice(0, 2);
  const out: Record<string, string> = {};
  for (const f of docs) {
    const date = decryptageDate(f.name)!;
    const ref = col().doc(date);
    const prev = (await ref.get()).data();
    if (prev?.docModified === f.modifiedTime) continue;
    const c = await download(f);
    const d = parseDecryptage(c.text ?? new TextDecoder().decode(c.data!), date);
    if (!d) { await ref.set({ date, invalid: true, docModified: f.modifiedTime }, { merge: true }); out[date] = 'illisible'; continue; }
    await ref.set({
      ...d, minutes: minutesOf(d), docModified: f.modifiedTime, updatedAt: new Date().toISOString(),
      invalid: false, audioReady: false, audioBytes: 0,
      // Déjà annoncé : pas de seconde notification après une correction
      notifiedAt: prev?.notifiedAt || null, draftToldAt: d.draft ? prev?.draftToldAt || null : null,
    });
    out[date] = d.draft ? 'brouillon' : 'texte';
  }
  return out;
};

const parisHM = (now: number) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  return Number(p.find(x => x.type === 'hour')!.value) * 60 + Number(p.find(x => x.type === 'minute')!.value);
};
const parisDay = (now: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(now));

/** Le jingle, créé une fois (puis gardé) ; null si ElevenLabs refuse : le décryptage part sans. */
export const jingle = async (): Promise<Buffer | null> => {
  const ref = audioCol().doc('_jingle');
  const key = `${JINGLE_VERSION}|${JINGLE_PROMPT}`;
  const d = (await ref.get()).data();
  if (d?.key === key && d.data) return Buffer.from(d.data);
  try {
    const mp3 = await generateJingle();
    if (mp3.length < 900_000) await ref.set({ key, data: mp3, at: new Date().toISOString() });
    return mp3;
  } catch { return null; }
};

/** Met en voix ce qui manque, dans le temps donné, puis prévient (Christian pour un brouillon, tout le monde après 9 h 30). */
export const voiceDecryptage = async (opts: { budgetMs: number; now?: number }) => {
  const t0 = Date.now();
  const now = opts.now ?? Date.now();
  const left = () => opts.budgetMs - (Date.now() - t0);
  const out: Record<string, string> = {};
  const snap = await col().orderBy('date', 'desc').limit(3).get();
  for (const doc of snap.docs) {
    const d = doc.data() as Decryptage & { audioReady?: boolean; invalid?: boolean; notifiedAt?: string | null; draftToldAt?: string | null; minutes?: number };
    if (d.invalid || !d.lines?.length || d.date < decryptageKeepFrom(now)) continue;
    // Audio d'une version précédente (64 kb/s) : refait en meilleure qualité
    if (d.audioReady && (d as any).audioVersion !== AUDIO_VERSION) {
      await doc.ref.set({ audioReady: false }, { merge: true });
      d.audioReady = false;
    }
    if (!d.audioReady) {
      if (!voiceEnabled() || left() <= 0) { out[d.date] = 'audio en attente'; continue; }
      const parts = audioCol().doc(d.date).collection('parts');
      const keys = d.lines.map(l => l.who === 'sting' ? STING_KEY : lineHash(l.who, l.text));
      const have = new Map<string, Buffer>();
      if (keys.includes(STING_KEY)) have.set(STING_KEY, await sting()); // vide si indisponible : pas de virgule
      for (const k of new Set(keys)) { if (k === STING_KEY) continue; const p = (await parts.doc(k).get()).data(); if (p?.data) have.set(k, Buffer.from(p.data)); }
      let next = 0;
      let error = '';
      const worker = async () => {
        while (next < d.lines.length && left() > 0 && !error) {
          const i = next++;
          if (have.has(keys[i])) continue;
          try {
            const mp3 = await synthesize(d.lines[i].text, fetch, MODEL(), FORMAT, d.lines[i].who as 'host' | 'guest', PODCAST_SETTINGS);
            have.set(keys[i], mp3);
            await parts.doc(keys[i]).set({ data: mp3 });
          } catch (e: any) { error = String(e?.message || e).slice(0, 60); }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      const ready = keys.filter(k => have.has(k)).length;
      if (ready < keys.length) { out[d.date] = error ? `audio : ${error}` : `audio en cours (${ready}/${keys.length})`; continue; }
      await jingle(); // créé une fois et servi à part (action decryptage.audio, part jingle)
      const mp3 = joinMp3(keys.map(k => have.get(k)!));
      await saveDecryptageAudio(d.date, mp3, now);
      for (const k of new Set(keys)) if (k !== STING_KEY) await parts.doc(k).delete().catch(() => 0);
      await doc.ref.set({ audioReady: true, audioBytes: mp3.length, audioVersion: AUDIO_VERSION }, { merge: true });
      d.audioReady = true;
      out[d.date] = 'audio prêt';
    }
    // Annonces
    if (d.draft) {
      if (!d.draftToldAt) {
        try {
          const u = await adminAuth.getUserByEmail(authorEmail());
          await pushToUser(u.uid, { title: 'Décryptage à écouter', body: `Brouillon du ${d.date.slice(8)}/${d.date.slice(5, 7)} : « ${d.title} ». Écoute-le avant publication.`, url: `/?decryptage=${d.date}`, tag: `decryptage-${d.date}` });
        } catch { /* rien */ }
        await doc.ref.set({ draftToldAt: new Date(now).toISOString() }, { merge: true });
        out[d.date] = 'brouillon : Christian prévenu';
      }
      continue;
    }
    if (!d.notifiedAt && d.date === parisDay(now) && parisHM(now) >= 9 * 60 + 30 && parisHM(now) < 21 * 60) {
      await doc.ref.set({ notifiedAt: new Date(now).toISOString() }, { merge: true });
      const uids = (await adminDb.collection('pushTokens').get()).docs.map((x: any) => x.id);
      let people = 0;
      for (const uid of uids) {
        try {
          if (await pushToUser(uid, { title: 'Le décryptage du jour', body: `${d.title} · ${d.minutes || minutesOf(d)} min à écouter`, url: `/?decryptage=${d.date}`, tag: `decryptage-${d.date}` })) people++;
        } catch { /* appareil suivant */ }
      }
      out[d.date] = `publié, notification à ${people} personne(s)`;
    }
  }
  return out;
};

/** Ce que voit l'appli : aujourd'hui et la veille, s'ils sont prêts (et le brouillon pour Christian). */
export const listDecryptage = async (admin: boolean) => {
  const snap = await col().orderBy('date', 'desc').limit(10).get();
  return snap.docs.map((x: any) => x.data())
    .filter((d: any) => !d.invalid && d.audioReady && (!d.draft || admin) && d.date >= decryptageKeepFrom())
    .slice(0, 2)
    .map((d: any) => ({ date: d.date, title: d.title, draft: !!d.draft, minutes: d.minutes || minutesOf(d), subjects: d.subjects || [], sources: d.sources || [], lines: d.lines || [] }));
};

const saveDecryptageAudio = async (date: string, mp3: Buffer, now: number) => {
  const aref = audioCol().doc(date);
  const prev = (await aref.get()).data();
  const n = Math.ceil(mp3.length / CHUNK);
  for (let i = 0; i < n; i++) await aref.collection('chunks').doc(String(i)).set({ data: mp3.subarray(i * CHUNK, (i + 1) * CHUNK) });
  for (let i = n; i < (prev?.chunks || 0); i++) await aref.collection('chunks').doc(String(i)).delete().catch(() => 0);
  await aref.set({ chunks: n, bytes: mp3.length, at: new Date(now).toISOString() });
};

export const loadDecryptageAudio = async (date: string): Promise<Buffer | null> => {
  const ref = audioCol().doc(date);
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

/** Diagnostic (sans contenu) de l'audio et du jingle : formats et durées des trames. */
export const diagnoseDecryptage = async () => {
  const snap = await col().orderBy('date', 'desc').limit(1).get();
  const date = snap.docs[0]?.id;
  const audio = date ? await loadDecryptageAudio(date) : null;
  const j = (await audioCol().doc('_jingle').get()).data();
  return { date, audio: audio ? describe(audio) : null, jingle: j?.data ? describe(Buffer.from(j.data)) : null };
};

/** Efface l'audio des décryptages plus anciens que la veille (environ 3 Mo par jour) ; le texte reste
 *  dans Drive. Renvoie le nombre de jours effacés. */
export const purgeDecryptage = async (now = Date.now()) => {
  const keep = decryptageKeepFrom(now);
  let n = 0;
  for (const ref of await audioCol().listDocuments()) {
    if (ref.id.startsWith('_') || ref.id >= keep) continue;
    for (const sub of ['chunks', 'parts']) {
      const s = await ref.collection(sub).get();
      for (const d of s.docs) await d.ref.delete();
    }
    await ref.delete();
    n++;
  }
  return n;
};
