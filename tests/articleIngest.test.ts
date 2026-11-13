import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { readPdf, readDocx, readText, classify, detectMedia, stripWatermark, pressExcerpt, findDate, MAX_TEASER_WORDS, mediaFromTitle, mediaFromLinks, docTitleParts, isIssueName, MEDIA } from '../api/_lib/articleIngest';
import { PdfTooLong } from '../utils/pdfLines';

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
    expect(findDate('Publié le 12 novembre 2026\nmis à jour le 13 novembre 2026')).toBe('2026-11-12T09:00:00.000Z');
    expect(findDate("Publié aujourd'hui à 08h28\nFichier généré le 13/11/2026 à 10:38")).toBe('2026-11-13T09:00:00.000Z');
    // Une date dans une légende de photo ne compte pas
    const c = classify('Un titre d’essai', [
      { t: 'p', text: 'Un ministre, le 29 juillet 2022, en déplacement. © Photographe' },
      { t: 'p', text: 'Un chapeau d’essai qui fait plus de soixante caractères pour compter comme un paragraphe.' },
      { t: 'p', text: 'Correspondant de Jeune Afrique' },
    ]);
    expect(c).toMatchObject({ kind: 'press', source: 'Jeune Afrique' });
    if (c.kind === 'press') expect(c.publishedAt).toBeUndefined();
    expect(readText('Mon titre\n\nPremier paragraphe.\n\nChristian Kamdem — CKLabs')).toMatchObject({ title: 'Mon titre' });
  });

  it('« Publié le 26.10.2026 » : date avec des points', () => {
    expect(findDate('Par Awa Test Publié le 26.10.2026 à 5h40 GMT | 4 min')).toBe('2026-10-26T09:00:00.000Z');
  });
});

// Novembre 2026 : quatre fichiers restés « à vérifier » alors qu'ils venaient d'Africa Intelligence et du
// Monde. Le nom du journal n'était ni au début ni à la fin du texte (pas d'en-tête d'impression), mais
// dans le titre du document PDF, dans le nom du fichier et dans les liens de la page.
describe('agent Articles : reconnaître le journal sans en-tête ni pied de page', () => {
  const AI = MEDIA.find(m => m.name === 'Africa Intelligence')!;
  const LM = MEDIA.find(m => m.name === 'Le Monde')!;

  it('titre du document « … - 26/10/2026 - Africa Intelligence » : journal, vrai titre, rubrique, auteur, date', async () => {
    const r = await readPdf(file('presse-titre.pdf'));
    expect(r.docTitle).toMatch(/- Africa Intelligence$/);
    // Sans ces indices, le texte seul ne dit pas d'où il vient (c'était le bug)
    expect(classify(r.title, r.blocks).kind).toBe('unknown');
    const c = classify(r.title, r.blocks, { fileName: 'x.pdf', docTitle: r.docTitle, links: r.links });
    expect(c).toMatchObject({
      kind: 'press', source: 'Africa Intelligence', sourceUrl: 'https://www.africaintelligence.fr',
      title: 'Un titre d’essai assez long pour la revue de presse', section: 'Afrique', author: 'Awa Test',
      publishedAt: '2026-10-26T09:00:00.000Z',
    });
    expect(JSON.stringify(c)).not.toContain('Deuxième paragraphe');
  }, 30000);

  it('le nom du fichier suffit aussi (le navigateur y met « _ » à la place de « / »)', async () => {
    const r = await readPdf(file('presse-titre.pdf'));
    const name = "Afrique • Un titre d'essai assez long pour la revue de presse - 26_10_2026 - Africa Intelligence.pdf";
    expect(classify(r.title, r.blocks, { fileName: name })).toMatchObject({ kind: 'press', source: 'Africa Intelligence', section: 'Afrique' });
    expect(docTitleParts(name, AI)).toEqual({ section: 'Afrique', title: "Un titre d'essai assez long pour la revue de presse" });
  }, 30000);

  it('liens de la page : la plupart vers lemonde.fr → Le Monde, auteurs multiples', async () => {
    const r = await readPdf(file('presse-liens.pdf'));
    expect(r.links.filter(u => u.includes('lemonde.fr'))).toHaveLength(5);
    expect(classify(r.title, r.blocks).kind).toBe('unknown');
    expect(classify(r.title, r.blocks, { fileName: 'Une panne d’essai expliquée.pdf', docTitle: r.docTitle, links: r.links })).toMatchObject({
      kind: 'press', source: 'Le Monde', title: 'Une panne d’essai expliquée', author: 'Awa Test, Paul Essai et Marie Exemple',
    });
  }, 30000);

  it('indices prudents : un titre ordinaire ou quelques liens ne désignent pas un journal', () => {
    expect(mediaFromTitle('Élections _ un titre ordinaire.pdf')).toBeNull();
    expect(mediaFromTitle('Un titre | Le Monde')).toBe(LM);
    expect(mediaFromTitle('Un titre - lemonde.fr')).toBe(LM);
    expect(mediaFromTitle('Un titre sans séparateur Africa Intelligence')).toBeNull();
    const lm = (n: number) => Array.from({ length: n }, (_, i) => `https://www.lemonde.fr/a/${i}`);
    const autres = (n: number) => Array.from({ length: n }, (_, i) => `https://site${i}.example.org/`);
    expect(mediaFromLinks(lm(2))).toBeNull();
    expect(mediaFromLinks([...lm(3), ...autres(4)])).toBeNull();
    expect(mediaFromLinks([...lm(4), ...autres(4), '#1', 'mailto:x@example.org'])).toBe(LM);
    expect(detectMedia('Un texte sans nom de journal.', { links: [...lm(4), ...autres(1)] }).media).toBe(LM);
  });

  it('auteur : « Par X Publié le… » ne prend pas « Publié »', () => {
    const c = classify('Un titre d’essai', [
      { t: 'p', text: 'Par Olivia Essai Publié le 26.10.2026 à 5h40 GMT' },
      { t: 'p', text: 'Un chapeau d’essai qui fait plus de soixante caractères pour compter comme un paragraphe.' },
    ], { fileName: 'Un titre d’essai - Jeune Afrique.pdf' });
    expect(c).toMatchObject({ kind: 'press', source: 'Jeune Afrique', author: 'Olivia Essai', publishedAt: '2026-10-26T09:00:00.000Z' });
  });

  it('un journal entier n’est pas un article', async () => {
    expect(isIssueName("L'Équipe du Vendredi 13 Novembre 2026.pdf")).toBe(true);
    expect(isIssueName('Le Parisien du dimanche 1er novembre 2026')).toBe(true);
    expect(isIssueName('Ce que l’on sait de la panne du vendredi.pdf')).toBe(false);
    await expect(readPdf(file('long.pdf'))).rejects.toBeInstanceOf(PdfTooLong);
  }, 30000);
});

