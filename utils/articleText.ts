// Texte des articles : un format très simple, lisible et modifiable à la main.
//   « ## Intertitre »  → intertitre
//   « - élément »      → puce
//   toute autre ligne  → paragraphe (une ligne = un paragraphe)
// La conversion depuis un PDF reconstruit ce format à partir des lignes du document.

export type Block = { t: 'h' | 'p' | 'li'; text: string };

export const parseBody = (body: string): Block[] =>
  body.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    if (/^#{1,3}\s+/.test(l)) return { t: 'h' as const, text: l.replace(/^#{1,3}\s+/, '') };
    if (/^[-•–]\s+/.test(l)) return { t: 'li' as const, text: l.replace(/^[-•–]\s+/, '') };
    return { t: 'p' as const, text: l };
  });

export const blocksToBody = (blocks: Block[]) =>
  blocks.map(b => (b.t === 'h' ? `## ${b.text}` : b.t === 'li' ? `- ${b.text}` : b.text)).join('\n\n');

export const wordCount = (body: string) => (body.match(/[\p{L}\p{N}’']+/gu) || []).length;
export const readMinutes = (body: string) => Math.max(1, Math.round(wordCount(body) / 220));

export const excerptOf = (body: string, max = 180) => {
  const p = parseBody(body).find(b => b.t === 'p')?.text || '';
  if (p.length <= max) return p;
  const cut = p.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : max).replace(/[\s,;:.]+$/, '')}…`;
};

// ---------- Reconstruction depuis les lignes d'un PDF

export interface PdfLine {
  text: string;
  x0: number;
  x1: number;
  y: number;      // position verticale dans la page (vers le bas = plus grand)
  size: number;   // corps du texte
  bold: boolean;
  page: number;
}

const median = (v: number[]) => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** Regroupe les lignes d'un PDF en titre + blocs (intertitres, paragraphes, puces). */
export const linesToArticle = (raw: PdfLine[]): { title: string; blocks: Block[] } => {
  const lines = raw.filter(l => l.text.trim() && !/^\d{1,3}$/.test(l.text.trim()));
  if (!lines.length) return { title: '', blocks: [] };

  // Corps courant : la taille la plus fréquente, pondérée par la longueur des lignes
  const weight = new Map<number, number>();
  lines.forEach(l => { const k = Math.round(l.size * 2) / 2; weight.set(k, (weight.get(k) || 0) + l.text.length); });
  const bodySize = [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const body = lines.filter(l => Math.abs(l.size - bodySize) < 0.6 && !l.bold);
  const left = median(body.map(l => l.x0));
  const right = Math.max(...body.map(l => l.x1));
  const width = right - left || 1;
  const gaps: number[] = [];
  for (let i = 1; i < body.length; i++) if (body[i].page === body[i - 1].page) { const g = body[i].y - body[i - 1].y; if (g > 0) gaps.push(g); }
  const lineGap = median(gaps) || bodySize * 1.25;

  // Puces : rond, carré ou tiret en début de ligne (\uf0b7 = puce Symbol de Word)
  const BULLET_RE = /^[\u2022\u25CF\u25AA\u25E6\uf0b7-]\s*/;
  // Intertitres : un corps à peine plus grand suffit (souvent 12 pt pour un texte en 11 pt)
  const isBig = (l: PdfLine) => l.size - bodySize > Math.max(0.4, bodySize * 0.015);
  const isBullet = (s: string) => BULLET_RE.test(s.trim()) && s.trim().length > 2;

  type Para = { lines: PdfLine[]; bullet: boolean };
  const paras: Para[] = [];
  let cur: Para | null = null;
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    let brk = !cur;
    if (cur && prev) {
      const samePage = prev.page === l.page;
      const gap = samePage ? l.y - prev.y : lineGap;
      const prevShort = prev.x1 < right - width * 0.1;
      // Suite de phrase : la ligne précédente va jusqu'à la marge, sans ponctuation finale, et celle-ci commence en minuscule
      const continuation = !prevShort && !/[.!?:»"…]$/.test(prev.text.trim()) && /^\p{Ll}/u.test(l.text.trim());
      brk = !continuation && (isBig(l) !== isBig(prev)
        || (isBig(l) && Math.abs(l.size - prev.size) > 0.6)
        || (samePage && gap > lineGap * 1.45)
        || (prevShort && /[.!?:»"…)]$/.test(prev.text.trim()))
        || (prevShort && prev.x1 < right - width * 0.3)
        || (prevShort && prev.bold !== l.bold)
        || isBullet(l.text));
    }
    if (brk) { cur = { lines: [], bullet: isBullet(l.text) }; paras.push(cur); }
    cur!.lines.push(l);
  });
  // Signature finale (« CK », « CKLabs ») : déjà affichée sous le titre
  while (paras.length > 1 && /^(CK|CKLabs|CK Labs)\.?$/i.test(paras[paras.length - 1].lines.map(l => l.text.trim()).join(' '))) paras.pop();
  const headingPara = (p: Para) => !p.bullet && !/^\(/.test(p.lines[0].text.trim())
    && (p.lines.every(isBig) || p.lines.every(l => l.bold && l.size > bodySize - 0.3));

  const join = (ls: PdfLine[]) => ls.reduce((acc, l) => {
    const t = l.text.trim();
    if (!acc) return t;
    return acc.endsWith('-') && /^\p{Ll}/u.test(t) ? acc + t : `${acc} ${t}`;
  }, '').replace(/\s+/g, ' ').trim();

  let title = '';
  const blocks: Block[] = [];
  paras.forEach((p, i) => {
    const text = join(p.lines);
    if (!text) return;
    if (i === 0 && (headingPara(p) || text.length < 160)) { title = text; return; }
    if (p.bullet) { blocks.push({ t: 'li', text: text.replace(BULLET_RE, '') }); return; }
    if (headingPara(p) && text.length < 160) { blocks.push({ t: 'h', text }); return; }
    blocks.push({ t: 'p', text });
  });
  return { title, blocks };
};

/** Typographie française à l'affichage : guillemets et apostrophes courbes, espaces insécables. */
export const frTypo = (s: string) => s
  .replace(/"([^"\n]{1,300})"/g, '« $1 »')
  .replace(/'/g, '’')
  .replace(/«\s*/g, '« ')
  .replace(/\s*»/g, ' »')
  .replace(/\s+([:;?!])/g, ' $1');
