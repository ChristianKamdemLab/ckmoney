// « Le décryptage du jour » : un court dialogue (environ 4 minutes) entre Christian et une seconde voix,
// qui reprend les grands sujets de la veille (revue de presse, textes CKLabs, info du jour) avec leurs
// tenants et aboutissants. Écrit chaque matin par l'agent « Décryptage du jour » dans le dossier Drive,
// document « Décryptage · AAAA-MM-JJ », au format :
//
//   Titre : <titre du jour>
//   Statut : publié            (ou « brouillon » : seul Christian l'entend, pour validation)
//   Sujet : <titre court> | <lien : /?article=ID, /?info ou https://…>
//   Source : <média> | https://…
//   CHRISTIAN : <réplique>
//   AWA : <réplique>
//
// Les répliques de CHRISTIAN sont lues avec sa voix, les autres avec la seconde voix.

export interface DecryptageLine { who: 'host' | 'guest'; name: string; text: string }
export interface DecryptageLink { title: string; link: string }
export interface Decryptage {
  date: string;
  title: string;
  draft: boolean;
  subjects: DecryptageLink[];
  sources: DecryptageLink[];
  lines: DecryptageLine[];
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** « Décryptage · 2026-11-24 » (accents, espaces et point médian tolérés) → « 2026-11-24 ». */
export const decryptageDate = (name: string) => {
  const m = norm(name).match(/^decryptage\s*[·.\-–]\s*(\d{4}-\d{2}-\d{2})(\.(txt|docx))?\s*$/);
  return m ? m[1] : null;
};

const safeLink = (u: string) => {
  const s = u.trim();
  if (/^\/\?[a-z]+(=[A-Za-z0-9_-]{1,60})?$/.test(s)) return s;
  return /^https:\/\/[^\s<>"]{3,500}$/.test(s) ? s : '';
};
const clean = (s: string, max: number) => s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export const MAX_LINES = 60;
export const MAX_CHARS = 7000; // environ 6 minutes de parole au plus

export const parseDecryptage = (raw: string, date: string): Decryptage | null => {
  const out: Decryptage = { date, title: '', draft: false, subjects: [], sources: [], lines: [] };
  let total = 0;
  for (const line0 of String(raw || '').replace(/^﻿/, '').split(/\r?\n/)) {
    const line = line0.replace(/^\s*[*_#>-]+\s*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([\p{L}' ]{2,30}?)\s*:\s*(.+)$/u);
    if (!m) continue;
    const key = norm(m[1]).trim();
    const val = m[2].trim();
    if (key === 'titre') { out.title = clean(val, 140); continue; }
    if (key === 'statut') { out.draft = /brouillon/i.test(norm(val)); continue; }
    if (key === 'sujet' || key === 'source') {
      const [t, l] = val.split(/\s+\|\s+/);
      const link = safeLink(l || '');
      const item = { title: clean(t || '', 140), link };
      if (!item.title) continue;
      if (key === 'sujet' && out.subjects.length < 5) out.subjects.push(item);
      if (key === 'source' && link && out.sources.length < 20) out.sources.push(item);
      continue;
    }
    // Réplique : un nom en majuscules (CHRISTIAN, AWA…)
    if (m[1] === m[1].toUpperCase() && /\p{Lu}/u.test(m[1]) && out.lines.length < MAX_LINES) {
      const text = clean(val, 900);
      if (!text || total + text.length > MAX_CHARS) continue;
      total += text.length;
      const name = m[1].trim();
      out.lines.push({ who: /^christian/i.test(norm(name)) ? 'host' : 'guest', name: name[0] + name.slice(1).toLowerCase(), text });
    }
  }
  const voices = new Set(out.lines.map(l => l.who));
  if (!out.title || out.lines.length < 4 || voices.size < 2) return null;
  return out;
};

/** Durée approximative de la lecture (environ 14 caractères par seconde, voix posée). */
export const minutesOf = (d: Pick<Decryptage, 'lines'>) =>
  Math.max(1, Math.round(d.lines.reduce((n, l) => n + l.text.length, 0) / 14 / 60));
