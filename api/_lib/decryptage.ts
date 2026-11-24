import { createHash } from 'node:crypto';
import { adminDb, adminAuth, authorEmail, pushToUser } from './admin.js';
import type { DriveFile } from './drive.js';
import { joinMp3, describe, dominantOnly } from './mp3.js';

// 2 : MP3 recollé proprement (sans les trames d'information des morceaux) avec la vraie durée en tête
// 3 : le jingle (stéréo) n'est plus collé aux voix (mono) : le lecteur le joue juste avant
export const AUDIO_VERSION = 3;
import { decryptageDate, parseDecryptage, minutesOf, Decryptage } from '../../utils/decryptage.js';
import { synthesize, MODEL, voiceEnabled, VOICE_SETTINGS, generateJingle, JINGLE_VERSION, JINGLE_PROMPT } from './voice.js';

// « Le décryptage du jour » : lu dans le document « Décryptage · AAAA-MM-JJ » du dossier Drive (écrit par
// l'agent du matin), mis en voix réplique par réplique (Christian et la seconde voix, ElevenLabs) au fil
// des passages de /api/articles-sync, puis publié : notification à tous à partir de 9 h 30 (heure de
// Paris). Un brouillon (« Statut : brouillon ») n'est entendu que par Christian, prévenu quand il est prêt.
// Firestore : decryptage/{date} (texte, état) et decryptageAudio/{date}/parts|chunks (fermées aux
// téléphones, servies par /api/articles).

const col = () => adminDb.collection('decryptage');
const audioCol = () => adminDb.collection('decryptageAudio');
const CHUNK = 900_000;
const FORMAT = 'mp3_44100_64';

export const isDecryptageDoc = (f: DriveFile) => !!decryptageDate(f.name) && f.mimeType !== 'application/pdf';

const lineHash = (who: string, text: string) =>
  createHash('sha1').update(`${MODEL()}|${JSON.stringify(VOICE_SETTINGS)}|${who}|${text}`).digest('hex').slice(0, 16);

/** Lit les documents des 3 derniers jours ; un document modifié remet l'audio à refaire. */
export const syncDecryptage = async (files: DriveFile[], download: (f: DriveFile) => Promise<{ data?: Uint8Array; text?: string }>) => {
  const docs = files.filter(isDecryptageDoc).sort((a, b) => decryptageDate(b.name)!.localeCompare(decryptageDate(a.name)!)).slice(0, 3);
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
    if (d.invalid || !d.lines?.length) continue;
    // Réparation d'un audio recollé avant la version 2 (le lecteur s'arrêtait après le jingle)
    if (d.audioReady && (d as any).audioVersion !== AUDIO_VERSION && left() > 5000) {
      const old = await loadDecryptageAudio(d.date);
      if (old) {
        const mp3 = dominantOnly(old);
        await saveDecryptageAudio(d.date, mp3, now);
        await doc.ref.set({ audioVersion: AUDIO_VERSION, audioBytes: mp3.length }, { merge: true });
        out[d.date] = 'audio réparé';
      }
    }
    if (!d.audioReady) {
      if (!voiceEnabled() || left() <= 0) { out[d.date] = 'audio en attente'; continue; }
      const parts = audioCol().doc(d.date).collection('parts');
      const keys = d.lines.map(l => lineHash(l.who, l.text));
      const have = new Map<string, Buffer>();
      for (const k of new Set(keys)) { const p = (await parts.doc(k).get()).data(); if (p?.data) have.set(k, Buffer.from(p.data)); }
      let next = 0;
      let error = '';
      const worker = async () => {
        while (next < d.lines.length && left() > 0 && !error) {
          const i = next++;
          if (have.has(keys[i])) continue;
          try {
            const mp3 = await synthesize(d.lines[i].text, fetch, MODEL(), FORMAT, d.lines[i].who);
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
      for (const k of new Set(keys)) await parts.doc(k).delete().catch(() => 0);
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

/** Ce que voit l'appli : les 7 derniers jours prêts (et le brouillon pour Christian). */
export const listDecryptage = async (admin: boolean) => {
  const snap = await col().orderBy('date', 'desc').limit(10).get();
  return snap.docs.map((x: any) => x.data())
    .filter((d: any) => !d.invalid && d.audioReady && (!d.draft || admin))
    .slice(0, 7)
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
