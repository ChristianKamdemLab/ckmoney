import type { PdfLine } from './articleText';

// Lignes de texte d'un PDF (position, taille, graisse) : utilisé dans le navigateur (import d'un PDF
// par l'auteur) et sur le serveur (agent Articles). Ne dépend que de l'objet pdf.js qu'on lui passe.

export type PdfJs = { getDocument: (src: any) => { promise: Promise<any> } };

/** Ce que le PDF dit de lui-même : nombre de pages, titre du document (un PDF enregistré depuis le
 *  navigateur porte le titre de la page, souvent « Titre - Nom du journal ») et adresses des liens. */
export interface PdfInfo { pages: number; title: string; links: string[] }

/** Trop de pages pour un article : sans doute un journal entier. */
export class PdfTooLong extends Error {
  constructor(public pages: number) { super(`trop_long ${pages}`); }
}

export const pdfToLines = async (pdfjs: PdfJs, data: Uint8Array, opts: { maxPages?: number; info?: PdfInfo } = {}): Promise<PdfLine[]> => {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, fontExtraProperties: true, disableFontFace: true, verbosity: 0 }).promise;
  const info = opts.info;
  if (info) {
    info.pages = doc.numPages;
    try { info.title = String((await doc.getMetadata())?.info?.Title || '').replace(/\s+/g, ' ').trim(); } catch { /* sans métadonnées */ }
  }
  if (opts.maxPages && doc.numPages > opts.maxPages) throw new PdfTooLong(doc.numPages);
  const out: PdfLine[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    if (info) {
      try {
        for (const a of await page.getAnnotations()) if (a?.subtype === 'Link' && typeof a.url === 'string') info.links.push(a.url);
      } catch { /* pas de liens lisibles */ }
    }
    const height = page.getViewport({ scale: 1 }).height;
    await page.getOperatorList(); // charge les polices, pour savoir ce qui est en gras
    const boldOf = new Map<string, boolean>();
    const isBold = (fontName: string) => {
      if (!boldOf.has(fontName)) {
        let name = '';
        try { name = page.commonObjs.get(fontName)?.name || ''; } catch { /* police non chargée */ }
        boldOf.set(fontName, /bold|black|heavy|semibold|demi/i.test(name));
      }
      return boldOf.get(fontName)!;
    };
    const tc = await page.getTextContent();
    type Frag = { str: string; x: number; x1: number; y: number; size: number; bold: boolean };
    const frags: Frag[] = (tc.items as any[])
      .filter(it => typeof it.str === 'string' && it.str.length)
      .map(it => {
        const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
        return { str: it.str, x: it.transform[4], x1: it.transform[4] + it.width, y: height - it.transform[5], size, bold: isBold(it.fontName) };
      });
    // Regrouper par ligne (même hauteur, à une demi-taille près)
    frags.sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: Frag[][] = [];
    frags.forEach(f => {
      const row = rows[rows.length - 1];
      if (row && Math.abs(row[0].y - f.y) < Math.max(2, f.size * 0.4)) row.push(f); else rows.push([f]);
    });
    rows.forEach(row => {
      row.sort((a, b) => a.x - b.x);
      let text = '';
      let end = -Infinity;
      row.forEach(f => {
        const needSpace = text && !/\s$/.test(text) && !/^\s/.test(f.str) && f.x - end > f.size * 0.18;
        text += (needSpace ? ' ' : '') + f.str;
        end = Math.max(end, f.x1);
      });
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) return;
      const visible = row.filter(f => f.str.trim());
      const chars = visible.reduce((a, f) => a + f.str.trim().length, 0) || 1;
      const boldChars = visible.filter(f => f.bold).reduce((a, f) => a + f.str.trim().length, 0);
      out.push({
        text, page: n,
        x0: Math.min(...visible.map(f => f.x)), x1: Math.max(...visible.map(f => f.x1)),
        y: visible[0]?.y ?? row[0].y,
        // Corps de la ligne : celui de la majorité des caractères (un mot isolé plus grand ne compte pas)
        size: (() => {
          const w = new Map<number, number>();
          visible.forEach(f => { const k = Math.round(f.size * 10) / 10; w.set(k, (w.get(k) || 0) + f.str.trim().length); });
          return [...w.entries()].sort((a, b) => b[1] - a[1])[0][0];
        })(),
        bold: boldChars / chars > 0.6,
      });
    });
  }
  return out;
};
