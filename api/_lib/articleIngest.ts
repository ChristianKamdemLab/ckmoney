import { pdfToLines } from '../../utils/pdfLines.js';
import { linesToArticle, blocksToBody, excerptOf, Block, frTypo } from '../../utils/articleText.js';

// Agent Articles : lit un fichier (PDF, Word, Google Doc) déposé dans le dossier Drive et décide :
//  - texte de Christian (signé CKLabs) → publié en entier, à son nom ;
//  - article d'un média (nom ou adresse du site reconnus) → fiche « revue de presse » : la source, le
//    titre, quelques lignes du début entre guillemets et le lien vers l'original. Jamais le texte entier :
//    ce serait reproduire le travail du journal ;
//  - ni l'un ni l'autre → brouillon, et Christian est prévenu.

export interface Media { name: string; domains: string[]; masthead?: RegExp }

export const MEDIA: Media[] = [
  { name: 'Jeune Afrique', domains: ['jeuneafrique.com'], masthead: /jeune\s+afrique/i },
  { name: 'Africa Intelligence', domains: ['africaintelligence.fr', 'africaintelligence.com'], masthead: /africa\s+intelligence/i },
  { name: 'Les Échos', domains: ['lesechos.fr'], masthead: /\bles\s+[ée]chos\b/i },
  // « l'équipe » est aussi un mot courant : seulement en capitales ou avec ©
  { name: "L'Équipe", domains: ['lequipe.fr'], masthead: /(?:©\s*L['’]\s?[ÉE]quipe\b|\bL['’]\s?ÉQUIPE\b)/ },
  { name: 'Le Parisien', domains: ['leparisien.fr'], masthead: /\ble\s+parisien\b/i },
  { name: 'Le Monde', domains: ['lemonde.fr'], masthead: /©\s*le\s+monde\b/i },
  { name: 'Le Figaro', domains: ['lefigaro.fr'], masthead: /\ble\s+figaro\b/i },
  { name: 'Libération', domains: ['liberation.fr'], masthead: /©\s*lib[ée]ration\b/i },
  { name: 'Le Point', domains: ['lepoint.fr'] },
  { name: "L'Express", domains: ['lexpress.fr'] },
  { name: 'Challenges', domains: ['challenges.fr'] },
  { name: 'Mediapart', domains: ['mediapart.fr'], masthead: /\bmediapart\b/i },
  { name: 'RFI', domains: ['rfi.fr'] },
  { name: 'France 24', domains: ['france24.com'] },
  { name: 'BBC Afrique', domains: ['bbc.com'] },
  { name: 'Reuters', domains: ['reuters.com'] },
  { name: 'Bloomberg', domains: ['bloomberg.com'] },
  { name: 'Financial Times', domains: ['ft.com'] },
  { name: 'Forbes Afrique', domains: ['forbesafrique.com'], masthead: /forbes\s+afrique/i },
  { name: 'Financial Afrik', domains: ['financialafrik.com'], masthead: /financial\s+afrik\b/i },
  { name: 'Agence Ecofin', domains: ['agenceecofin.com'], masthead: /agence\s+ecofin/i },
  { name: 'Investir au Cameroun', domains: ['investiraucameroun.com'], masthead: /investir\s+au\s+cameroun/i },
  { name: 'Cameroon Tribune', domains: ['cameroon-tribune.cm'], masthead: /cameroon\s+tribune/i },
  { name: 'Actu Cameroun', domains: ['actucameroun.com'] },
  { name: 'Le Monde Afrique', domains: ['lemonde.fr/afrique'] },
];

export type Ingested =
  | { kind: 'own'; title: string; body: string; publishedAt?: string }
  | { kind: 'press'; title: string; source: string; sourceUrl: string; excerpt: string; author?: string; section?: string; publishedAt?: string }
  | { kind: 'unknown'; title: string; body: string };

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** Première date « 12 novembre 2026 » ou « 12/11/2026 » trouvée dans le début du texte. */
export const findDate = (text: string): string | undefined => {
  const head = text.slice(0, 1500);
  const m = head.match(new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${MONTHS.join('|')})\\s+(20\\d{2})\\b`, 'i'));
  if (m) return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[2].toLowerCase()), +m[1], 9)).toISOString();
  const n = head.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (n && +n[2] >= 1 && +n[2] <= 12) return new Date(Date.UTC(+n[3], +n[2] - 1, +n[1], 9)).toISOString();
  return undefined;
};

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Le média d'un texte : d'abord par l'adresse du site (en-tête ou pied de page), puis par son nom. */
export const detectMedia = (text: string): { media: Media | null; url: string } => {
  const urls = (text.match(URL_RE) || []).map(u => u.replace(/[.,;:]+$/, ''));
  for (const u of urls) {
    const full = u.replace(/^https?:\/\/(www\.)?/, '');
    const m = MEDIA.slice().sort((a, b) => Math.max(...b.domains.map(d => d.length)) - Math.max(...a.domains.map(d => d.length)))
      .find(x => x.domains.some(d => full.startsWith(d) || hostOf(u) === d || hostOf(u).endsWith(`.${d}`)));
    if (m) return { media: m, url: u };
  }
  const edges = `${text.slice(0, 600)}\n${text.slice(-600)}`;
  // Nom de domaine écrit sans « https:// » (« Publié sur AfricaIntelligence.fr »)
  const byDomain = MEDIA.find(x => x.domains.some(d => new RegExp(`\\b(?:www\\.)?${d.split('/')[0].replace(/\./g, '\\.')}\\b`, 'i').test(edges)));
  if (byDomain) return { media: byDomain, url: '' };
  const byName = MEDIA.find(x => x.masthead && x.masthead.test(edges));
  if (byName) return { media: byName, url: '' };
  // Une adresse de site inconnu, en en-tête ou en pied de page : on cite ce site
  const edgeUrl = (edges.match(URL_RE) || [])[0];
  if (edgeUrl && hostOf(edgeUrl)) return { media: { name: hostOf(edgeUrl), domains: [hostOf(edgeUrl)] }, url: edgeUrl.replace(/[.,;:]+$/, '') };
  return { media: null, url: '' };
};

/** Signé par Christian ? Une des dernières lignes, courte, porte « CKLabs », sa signature. Son nom seul ne
 *  suffit pas : c'est aussi le filigrane des journaux auxquels il est abonné. */
export const isOwn = (blocks: Block[]) => blocks.slice(-3).some(b =>
  b.text.length < 90 && /\bCK\s?Labs\b/i.test(b.text) && !/exclusivement|abonn/i.test(b.text));

/** Accroche : le début de la première phrase du chapeau, 15 mots au plus. Jamais davantage : le texte
 *  appartient au journal, la fiche renvoie vers lui. */
export const MAX_TEASER_WORDS = 15;
export const pressExcerpt = (blocks: Block[], title: string) => {
  const para = blocks.find(b => b.t === 'p' && b.text.length > 60 && b.text !== title && !/https?:\/\//.test(b.text) && !/^par\s/i.test(b.text) && !/©/.test(b.text));
  if (!para) return '';
  const sentence = (para.text.match(/^.+?[.!?](?=\s|$)/) || [para.text])[0];
  const words = sentence.split(/\s+/);
  return words.length <= MAX_TEASER_WORDS ? sentence : `${words.slice(0, MAX_TEASER_WORDS).join(' ').replace(/[,;:]$/, '')}…`;
};

// Lignes à ne jamais reprendre : filigrane d'abonné (avec son numéro), coordonnées du journal, légendes
// de photo, rubriques en capitales (gardées à part)
const NOISE = [
  /exemplaire\s+destin[ée]\s+exclusivement/i, /abonn[ée]\s+n[°o]/i, /tous\s+droits\s+r[ée]serv[ée]s/i,
  /^t[ée]l\.?\s*:/i, /@[a-z0-9.-]+\.[a-z]{2,}/i, /\|\s*page\s+\d+\s*\/\s*\d+/i, /^page\s+\d+/i,
];
/** Retire le filigrane d'abonné, même coupé sur plusieurs lignes (« … exclusivement à » / « Prénom NOM » /
 *  « - Abonné n°… »). Le nom de l'abonné est lu dans le filigrane lui-même. */
export const stripWatermark = <T extends { text: string }>(lines: T[]): T[] => {
  const joined = lines.map(l => l.text).join(' ');
  const name = (joined.match(/exclusivement\s+à\s+(.{3,60}?)\s+-\s+Abonn/i) || [])[1]?.trim().toLowerCase();
  return lines.filter(l => !NOISE.some(r => r.test(l.text)) && !(name && l.text.trim().toLowerCase() === name));
};
const isCaption = (s: string) => /©/.test(s) && s.length < 300;
const isTagLine = (s: string) => s.length < 80 && /^[A-ZÀ-Ý0-9 ,'’&\-]+$/.test(s) && /[A-Z]{4,}/.test(s);
const isDateLine = (s: string) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s.trim());

const stripMedia = (title: string, media: Media | null) =>
  (media ? title.replace(new RegExp(`\\s*[–—|-]\\s*${media.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '') : title).trim();

// Lignes techniques des PDF imprimés depuis un navigateur : date et heure d'impression, numéro de page
const PRINT_HEADER = /^\d{1,2}\/\d{1,2}\/\d{2,4}[,\s]+\d{1,2}\D?\d{2}\b/;
const PAGE_NO = /^\d+\s*\/\s*\d+$/;

/** Décide quoi faire d'un texte déjà découpé en titre + blocs. */
export const classify = (rawTitle: string, blocks: Block[]): Ingested => {
  const header = PRINT_HEADER.test(rawTitle) || /https?:\/\//.test(rawTitle) ? rawTitle : '';
  const all = [{ t: 'p' as const, text: rawTitle }, ...blocks];
  const tags = all.filter(b => isTagLine(b.text)).map(b => b.text.replace(/\s+/g, ' ').trim());
  const dateLine = all.find(b => isDateLine(b.text))?.text;
  let clean = blocks.filter(b => !PRINT_HEADER.test(b.text) && !PAGE_NO.test(b.text) && !NOISE.some(r => r.test(b.text)) && !isTagLine(b.text) && !isDateLine(b.text));
  let title = NOISE.some(r => r.test(rawTitle)) || isTagLine(rawTitle) || isDateLine(rawTitle) ? '' : rawTitle;
  if (!title) {
    const i = clean.findIndex(b => b.t === 'h' || b.text.length < 140);
    // Un titre sur plusieurs lignes arrive en plusieurs intertitres qui se suivent : on les recolle
    let j = i;
    while (i >= 0 && clean[i].t === 'h' && clean[j + 1]?.t === 'h' && !/[.!?:]$/.test(clean[j].text) && j - i < 3) j++;
    title = i >= 0 ? clean.slice(i, j + 1).map(b => b.text).join(' ') : '';
    clean = clean.filter((_, k) => k < i || k > j);
  }
  if (header) {
    // Le vrai titre : le premier intertitre, sinon la première ligne courte
    const i = clean.findIndex(b => b.t === 'h');
    const j = i >= 0 ? i : clean.findIndex(b => b.text.length < 140);
    title = j >= 0 ? clean[j].text : rawTitle.replace(PRINT_HEADER, '').replace(/^[\s·|-]+/, '');
    clean = clean.filter((_, k) => k !== j);
  }
  const text = [header, title, ...clean.map(b => b.text)].join('\n');
  if (isOwn(clean)) {
    // La signature reste en bas de l'article
    return { kind: 'own', title: frTypo(title), body: blocksToBody(clean), publishedAt: findDate(text) };
  }
  const { media, url } = detectMedia(text);
  if (media) {
    const bodyBlocks = clean.filter(b => !(URL_RE.test(b.text) && b.text.length < 200));
    URL_RE.lastIndex = 0;
    const author = (text.match(/\bPar\s+([A-ZÀ-Ý][\p{L}'’-]+(?:\s+[A-ZÀ-Ý][\p{L}'’-]+){0,3})/u) || [])[1];
    const sectionTags = tags.filter(t => !(media.masthead && media.masthead.test(t)) && !new RegExp(media.name.replace(/[’']/g, '.'), 'i').test(t));
    const section = sectionTags.length ? sectionTags[0].split(/[ ,]+/).filter(Boolean).map(w => w[0] + w.slice(1).toLowerCase()).join(' · ') : undefined;
    return {
      kind: 'press', title: frTypo(stripMedia(title, media)), source: media.name,
      sourceUrl: url || `https://www.${media.domains[0]}`, excerpt: frTypo(pressExcerpt(bodyBlocks, title)),
      author, section, publishedAt: findDate(dateLine ? `${dateLine}\n${text}` : text),
    };
  }
  return { kind: 'unknown', title: frTypo(title), body: blocksToBody(clean) };
};

// ---------- Lecture des fichiers

export const readPdf = async (data: Uint8Array) => {
  const { getResolvedPDFJS } = await import('unpdf');
  const pdfjs = await getResolvedPDFJS();
  return linesToArticle(stripWatermark(await pdfToLines(pdfjs as any, data)));
};

const decode = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/** Word : titres (h1/h2…), paragraphes et puces. Le premier titre (ou la première ligne) devient le titre. */
export const readDocx = async (data: Uint8Array) => {
  const mammoth = (await import('mammoth')).default;
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(data) });
  const blocks: Block[] = [];
  for (const m of value.matchAll(/<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/g)) {
    const text = decode(m[2]);
    if (text) blocks.push({ t: m[1] === 'li' ? 'li' : m[1].startsWith('h') ? 'h' : 'p', text });
  }
  return titleFirst(blocks);
};

/** Texte brut (Google Doc exporté) : une ligne vide sépare les paragraphes. */
export const readText = (text: string) =>
  titleFirst(text.split(/\n\s*\n|\r?\n/).map(s => s.trim()).filter(Boolean).map(t => ({ t: 'p' as const, text: t })));

const titleFirst = (blocks: Block[]) => {
  const i = blocks.findIndex(b => b.t === 'h');
  const at = i >= 0 && i < 3 ? i : 0;
  const title = blocks[at]?.text || '';
  return { title, blocks: blocks.filter((_, k) => k !== at) };
};

export { excerptOf };
