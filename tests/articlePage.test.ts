import { describe, it, expect } from 'vitest';
import { articlePage, teaserOf, isShareable } from '../api/_lib/articlePage';

const art = { status: 'published', kind: 'own', title: 'Un titre <b>d’essai</b>', authorName: 'Auteur', publishedAt: '2026-11-23T09:58:00.000Z', readMinutes: 3,
  excerpt: 'Accroche', body: ['Premier paragraphe.', 'Deuxième paragraphe.', 'Troisième.', 'Quatrième, jamais montré.', 'CKLabs'].join('\n') };

describe('page publique d’un article', () => {
  it('ne montre que le début du texte', () => {
    expect(teaserOf(art.body)).toEqual(['Premier paragraphe.', 'Deuxième paragraphe.', 'Troisième.']);
    const html = articlePage('https://x.test', 'abc', art);
    expect(html).not.toContain('Quatrième');
    expect(html).toContain('/?article=abc');
    expect(html).toContain('og:title');
    expect(html).toContain('23 novembre 2026');
  });
  it('échappe le titre', () => {
    const h = articlePage('https://x.test', 'abc', art); expect(h).toContain('Un titre &lt;b&gt;'); expect(h).not.toContain('Un titre <b>');
  });
  it('jamais les fiches de revue de presse ni les brouillons', () => {
    expect(isShareable({ ...art, kind: 'press' })).toBe(false);
    expect(isShareable({ ...art, status: 'draft' })).toBe(false);
    expect(articlePage('https://x.test', 'abc', null)).toContain('Article introuvable');
  });
  it('coupe un premier paragraphe trop long à la fin d’une phrase', () => {
    const long = ('Une phrase assez longue pour remplir. ').repeat(30);
    const [p] = teaserOf(long);
    expect(p.length).toBeLessThanOrEqual(650);
    expect(p.endsWith('.')).toBe(true);
  });
});
