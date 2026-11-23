import { Block, frTypo } from './articleText';

// Un article CKLabs en PDF (A4), pour le partager hors de l'appli : titre, auteur, date, texte,
// signature, et en bas de page « CKLabs · lu sur CKMoney ». jsPDF n'est chargé qu'au moment du partage.

export interface PdfArticle { title: string; authorName: string; date: string; blocks: Block[] }

/** Les polices standard du PDF ne connaissent pas l'espace fine insécable : espace insécable à la place. */
export const pdfText = (s: string) => frTypo(s).replace(/[  ]/g, ' ').replace(/[^\u0000-ÿ‘’‚“”„…–—Œœ€•]/gu, '');

export const pdfFileName = (title: string) =>
  `${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'article'}.pdf`;

const INK: [number, number, number] = [14, 21, 51];
const BODY: [number, number, number] = [34, 38, 58];
const MUTE: [number, number, number] = [110, 116, 140];
const OCHRE: [number, number, number] = [122, 74, 0];
const GOLD: [number, number, number] = [242, 167, 27];

export const buildArticlePdf = async (a: PdfArticle): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 22, TW = W - 2 * M, BOTTOM = H - 22;
  let y = 26;
  const ensure = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = 24; } };
  const write = (text: string, o: { size: number; style?: 'normal' | 'bold'; color: [number, number, number]; lh: number; indent?: number; after?: number }) => {
    doc.setFont('helvetica', o.style || 'normal'); doc.setFontSize(o.size); doc.setTextColor(...o.color);
    const step = o.size * 0.3528 * o.lh;
    for (const line of doc.splitTextToSize(pdfText(text), TW - (o.indent || 0)) as string[]) {
      ensure(step); doc.text(line, M + (o.indent || 0), y); y += step;
    }
    y += o.after || 0;
  };

  write('CKLabs', { size: 10, style: 'bold', color: OCHRE, lh: 1.2, after: 3 });
  write(a.title, { size: 19, style: 'bold', color: INK, lh: 1.25, after: 3 });
  write(`${a.authorName} · ${a.date}`, { size: 10, color: MUTE, lh: 1.3, after: 2 });
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(M, y, M + 14, y); y += 9;

  a.blocks.forEach((b, i) => {
    if (b.t === 'h') { y += 2; ensure(14); write(b.text, { size: 13, style: 'bold', color: INK, lh: 1.3, after: 2 }); return; }
    if (b.t === 'li') {
      ensure(7); doc.setFillColor(...GOLD); doc.circle(M + 1.4, y - 1.3, 0.75, 'F');
      write(b.text, { size: 11, color: BODY, lh: 1.5, indent: 6, after: 2 });
      return;
    }
    write(b.text, { size: i === 0 ? 12 : 11, color: BODY, lh: 1.55, after: 3.5 });
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTE);
    doc.text(pdfText('CKLabs · lu sur CKMoney, ck-money.vercel.app'), M, H - 12);
    doc.text(`${p} / ${pages}`, W - M, H - 12, { align: 'right' });
  }
  return doc.output('blob');
};

/** Partage le PDF (feuille de partage du téléphone) ; sinon, le télécharge. */
export const shareArticlePdf = async (a: PdfArticle): Promise<'shared' | 'downloaded' | 'cancelled'> => {
  const blob = await buildArticlePdf(a);
  const file = new File([blob], pdfFileName(a.title), { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: a.title }); return 'shared'; }
    catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
};
