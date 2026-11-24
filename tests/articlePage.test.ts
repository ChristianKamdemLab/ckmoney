import { describe, it, expect } from 'vitest';
import { articlePage, isShareable } from '../api/_lib/articlePage';

const art = { status: 'published', kind: 'own', title: 'Un titre <b>d’essai</b>', authorName: 'Auteur', publishedAt: '2026-11-23T09:58:00.000Z', readMinutes: 3,
  excerpt: 'Accroche', body: ['Premier paragraphe.', 'Deuxième paragraphe.', 'Troisième.', 'Quatrième, jamais montré.', 'CKLabs'].join('\n') };

describe('page publique d’un article', () => {
  it('montre l’article en entier, sans connexion', () => {
    const html = articlePage('https://x.test', 'abc', { ...art, body: art.body + '\n- Une puce\n- Une autre' });
    expect(html).toContain('Quatrième, jamais montré.');
    expect(html).toContain('<ul><li>Une puce</li><li>Une autre</li></ul>');
    expect(html).toContain('Rejoindre CKMoney');
    expect(html).toContain('og:title');
    expect(html).toContain('23 novembre 2026');
  });
  it('échappe le titre', () => {
    const h = articlePage('https://x.test', 'abc', art); expect(h).toContain('Un titre &lt;b&gt;'); expect(h).not.toContain('Un titre <b>');
  });
  it('jamais les fiches de revue de presse ni les brouillons', () => {
    expect(isShareable({ ...art, kind: 'press' })).toBe(true);
    const fiche = articlePage('https://x.test', 'p1', { ...art, kind: 'press', body: '', source: 'Le Monde', excerpt: 'Une accroche.', summary: 'Premier paragraphe.\nSecond paragraphe.', sourceUrl: 'https://www.lemonde.fr/x' });
    expect(fiche).toContain('Revue de presse · Le Monde');
    expect(fiche).toContain('<p>Second paragraphe.</p>');
    expect(fiche).toContain('Lire sur lemonde.fr');
    expect(isShareable({ ...art, status: 'draft' })).toBe(false);
    expect(articlePage('https://x.test', 'abc', null)).toContain('Article introuvable');
  });
});
