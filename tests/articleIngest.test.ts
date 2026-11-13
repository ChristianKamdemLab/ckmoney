import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { readPdf, readDocx, readText, classify, detectMedia, stripWatermark, pressExcerpt, findDate, MAX_TEASER_WORDS } from '../api/_lib/articleIngest';

// Agent Articles : lecture des fichiers et tri entre les textes de Christian et la revue de presse.
// Les fichiers d'essai (tests/fixtures) sont inventés : aucun texte de journal dans le dépôt.

const file = (f: string) => new Uint8Array(fs.readFileSync(`tests/fixtures/${f}`));
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe('agent Articles : tri', () => {
  it('texte signé CKLabs (PDF et Word) : publié en entier', async () => {
    for (const r of [await readPdf(file('ckl-article.pdf')), await readDocx(file('ckl-article.docx'))]) {
      const c = classify(r.title, r.blocks);
      expect(c.kind).toBe('own');
      if (c.kind === 'own') expect(c.body.split('\n\n').length).toBeGreaterThanOrEqual(3);
    }
  }, 30000);

  it('article de presse imprimé depuis le navigateur : média, vrai titre, lien, date, accroche courte', async () => {
    const r = await readPdf(file('presse-ja.pdf'));
    const c = classify(r.title, r.blocks);
    expect(c).toMatchObject({
      kind: 'press', source: 'Jeune Afrique', title: 'Les fintech africaines accélèrent (essai)',
      sourceUrl: 'https://www.jeuneafrique.com/1700001/economie-entreprises/les-fintech-africaines-accelerent-essai/',
      author: 'Awa Test', publishedAt: '2026-11-12T09:00:00.000Z',
    });
    if (c.kind === 'press') expect(words(c.excerpt)).toBeLessThanOrEqual(MAX_TEASER_WORDS + 1);
    // Jamais le corps de l'article
    expect(JSON.stringify(c)).not.toContain('Deuxième paragraphe');
  }, 30000);

  it('Word d’un journal (nom en capitales, ©) ; « l’équipe » écrit normalement ne suffit pas', async () => {
    const r = await readDocx(file('presse-equipe.docx'));
    expect(classify(r.title, r.blocks)).toMatchObject({ kind: 'press', source: "L'Équipe", sourceUrl: 'https://www.lequipe.fr' });
    expect(detectMedia("Toute l'équipe a travaillé dur.\nFin.").media).toBeNull();
  }, 30000);

  it('ni signature ni média : brouillon à vérifier', async () => {
    const r = await readPdf(file('inconnu.pdf'));
    expect(classify(r.title, r.blocks).kind).toBe('unknown');
  }, 30000);

  it('le filigrane d’abonné disparaît, même coupé sur plusieurs lignes, et ne fait pas croire à un texte de Christian', () => {
    const lines = [
      'Exemplaire destiné exclusivement à Christian KAMDEM - Abonné n°AA000000', 'Titre de l’essai', 'Exemplaire destiné exclusivement à',
      'Christian KAMDEM', '- Abonné n°AA000000', 'Un paragraphe d’essai assez long pour être un vrai paragraphe de texte, sans rien de réel.',
    ].map(text => ({ text }));
    expect(stripWatermark(lines).map(l => l.text)).toEqual(['Titre de l’essai', 'Un paragraphe d’essai assez long pour être un vrai paragraphe de texte, sans rien de réel.']);
    const c = classify('30/10/2026', [
      { t: 'p', text: 'CAMEROUN ÉNERGIES, POLITIQUE' }, { t: 'h', text: 'Un titre d’essai' }, { t: 'h', text: 'sur deux lignes' },
      { t: 'p', text: 'Un chapeau d’essai qui fait plus de soixante caractères pour compter comme un paragraphe.' },
      { t: 'p', text: 'Publié sur AfricaIntelligence.fr' }, { t: 'p', text: 'Christian KAMDEM' },
    ]);
    expect(c).toMatchObject({ kind: 'press', source: 'Africa Intelligence', title: 'Un titre d’essai sur deux lignes', section: 'Cameroun · Énergies · Politique', publishedAt: '2026-10-30T09:00:00.000Z' });
  });

  it('accroche : 15 mots au plus, jamais une légende de photo', () => {
    const long = 'Mot '.repeat(40).trim() + '.';
    expect(words(pressExcerpt([{ t: 'p', text: 'Une photo prise en 2011, légende assez longue pour passer le filtre. © Photographe' }, { t: 'p', text: long }], 'T'))).toBe(MAX_TEASER_WORDS);
    expect(pressExcerpt([{ t: 'p', text: 'Une phrase courte mais de plus de soixante caractères au total. Puis une autre.' }], 'T')).toBe('Une phrase courte mais de plus de soixante caractères au total.');
  });

  it('dates et Google Docs exportés en texte', () => {
    expect(findDate('Publié le 1er mars 2026')).toBe('2026-03-01T09:00:00.000Z');
    expect(findDate('13/11/2026')).toBe('2026-11-13T09:00:00.000Z');
    expect(findDate('rien')).toBeUndefined();
    expect(readText('Mon titre\n\nPremier paragraphe.\n\nChristian Kamdem — CKLabs')).toMatchObject({ title: 'Mon titre' });
  });
});
