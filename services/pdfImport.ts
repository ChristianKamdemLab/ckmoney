
// Lecture d'un PDF (côté navigateur, rien n'est envoyé ailleurs) : on récupère les lignes de texte
// avec leur position, leur taille et leur graisse, puis utils/articleText reconstruit les paragraphes.

import { pdfToLines, PdfJs } from '../utils/pdfLines';
export { pdfToLines };

/** Dans le navigateur : charge pdf.js à la demande (le module n'est téléchargé que par l'auteur). */
export const readPdfFile = async (file: File) => {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/build/pdf.min.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  (pdfjs as any).GlobalWorkerOptions.workerSrc = (worker as any).default;
  const { linesToArticle } = await import('../utils/articleText');
  return linesToArticle(await pdfToLines(pdfjs as unknown as PdfJs, new Uint8Array(await file.arrayBuffer())));
};
