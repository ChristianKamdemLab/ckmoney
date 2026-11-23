import { describe, it, expect } from 'vitest';
import { buildArticlePdf, pdfText, pdfFileName } from '../utils/articlePdf';

describe('article en PDF', () => {
  it('nettoie le texte pour les polices du PDF', () => {
    expect(pdfText('Oui ? 🎧 « bien »')).not.toMatch(/[ 🎧]/u);
    expect(pdfText('l’été')).toBe('l’été');
  });
  it('donne un nom de fichier lisible', () => {
    expect(pdfFileName("Et si c'était la solution ?")).toBe('Et-si-c-etait-la-solution.pdf');
  });
  it('fabrique un PDF de plusieurs pages pour un long texte', async () => {
    const blocks = Array.from({ length: 40 }, (_, i) => ({ t: (i % 7 === 3 ? 'li' : 'p') as 'li' | 'p', text: 'Un paragraphe d’essai, avec des accents : é, à, ç, œ. '.repeat(4) }));
    const blob = await buildArticlePdf({ title: 'Titre d’essai', authorName: 'Auteur', date: '23 novembre 2026', blocks });
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(3000);
  });
});
