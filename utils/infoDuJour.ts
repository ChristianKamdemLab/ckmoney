import { parseRubrique, Zone } from './rubrique.js';
// « L'info du jour » : chaque matin, le sujet le plus suivi dans le monde, et un sujet Cameroun ou
// Afrique, résumés avec nos mots. Écrits par la tâche planifiée « Info du jour CKMoney » dans un
// document Google du dossier Drive des articles, nommé « Info du jour · AAAA-MM-JJ » :
//
//   ## Monde
//   Titre : …
//   Pourquoi on en parle : …            (facultatif : où le sujet est en tête des recherches…)
//   Source : Nom du média | https://…    (au moins deux lignes Source)
//   Un paragraphe par ligne…
//
//   ## Afrique
//   …
// Une info sans titre, sans texte ou avec moins de deux sources valides n'est pas publiée.

export type InfoScope = 'monde' | 'afrique';
export interface InfoSource { name: string; url: string }
export interface InfoItem { scope: InfoScope; title: string; why: string; summary: string; sources: InfoSource[]; zones?: Zone[] }
export interface InfoDay { date: string; items: InfoItem[]; updatedAt?: string }

export const INFO_RE = /^(?:ckmoney\s*[·•|-]\s*)?info du jour\s*[·•|_-]\s*(\d{4}-\d{2}-\d{2})\s*(?:\.(?:txt|docx?))?$/i;
/** Date du document « Info du jour · AAAA-MM-JJ », ou null. */
export const infoDate = (name: string) => name.trim().match(INFO_RE)?.[1] ?? null;

export const SCOPE_LABEL: Record<InfoScope, string> = { monde: 'Monde', afrique: 'Cameroun et Afrique' };
const MAX_SUMMARY = 1500;

const clean = (s: string) => s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

export const parseInfo = (raw: string): InfoItem[] => {
  const items: InfoItem[] = [];
  let cur: { scope: InfoScope; head: Record<string, string>; sources: InfoSource[]; lines: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const title = (cur.head.titre || '').slice(0, 160);
    const summary = cur.lines.join('\n\n').slice(0, MAX_SUMMARY).trim();
    const sources = cur.sources.filter((s, i, a) => a.findIndex(x => x.url === s.url) === i).slice(0, 6);
    if (title && summary.length >= 80 && sources.length >= 2 && !items.some(x => x.scope === cur!.scope))
      items.push({ scope: cur.scope, title, why: (cur.head['pourquoi on en parle'] || '').slice(0, 200), summary, sources, ...(cur.head.rubrique ? { zones: parseRubrique(cur.head.rubrique) } : {}) });
    cur = null;
  };
  for (const rawLine of raw.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = clean(rawLine.replace(/^[*_]+|[*_]+$/g, ''));
    if (!line) continue;
    const sec = line.match(/^#{1,3}\s*(.+)$/);
    if (sec) {
      flush();
      const n = sec[1].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      cur = /monde/.test(n) ? { scope: 'monde', head: {}, sources: [], lines: [] } : /afrique|cameroun/.test(n) ? { scope: 'afrique', head: {}, sources: [], lines: [] } : null;
      continue;
    }
    if (!cur) continue;
    const src = line.match(/^sources?\s*:\s*(.+?)\s*\|\s*(https:\/\/\S+)$/i);
    if (src) { cur.sources.push({ name: src[1].slice(0, 60), url: src[2].slice(0, 500) }); continue; }
    const h = line.match(/^(titre|pourquoi on en parle|rubrique)\s*:\s*(.*)$/i);
    if (h && !cur.lines.length) { cur.head[h[1].toLowerCase()] = h[2]; continue; }
    cur.lines.push(line);
  }
  flush();
  return items.sort((a, b) => (a.scope === 'monde' ? 0 : 1) - (b.scope === 'monde' ? 0 : 1));
};
