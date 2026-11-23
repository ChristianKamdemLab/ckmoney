import { describe, it, expect } from 'vitest';
import { cleanFilm, youtubeId, ratingLabel } from '../utils/films';
import { FILMS_2026_11_21 } from '../api/_lib/filmsSeed';

describe('Films et séries', () => {
  it('reconnaît les liens YouTube', () => {
    expect(youtubeId('https://youtu.be/VvYl1a1Px5Y?si=abc')).toBe('VvYl1a1Px5Y');
    expect(youtubeId('https://www.youtube.com/watch?v=ZybkHGaoPvQ&t=3')).toBe('ZybkHGaoPvQ');
    expect(youtubeId('https://www.youtube.com/embed/R5jcEBVBEbQ')).toBe('R5jcEBVBEbQ');
    expect(youtubeId('R5jcEBVBEbQ')).toBe('R5jcEBVBEbQ');
    expect(youtubeId('https://vimeo.com/123')).toBe('');
  });
  it('note entre 0 et 10, au demi-point', () => {
    expect(cleanFilm({ title: 'X', review: 'Bien', rating: 7.3 })!.rating).toBe(7.5);
    expect(cleanFilm({ title: 'X', review: 'Bien', rating: 12 })).toBeNull();
    expect(cleanFilm({ title: 'X', rating: 5 })).toBeNull();
    expect(ratingLabel(7.5)).toBe('7,5/10');
  });
  it('affiche https seulement', () => {
    expect(cleanFilm({ title: 'X', review: 'Bien', rating: 5, poster: 'javascript:alert(1)' })!.poster).toBe('');
  });
  it('les trois avis de Christian sont valides', () => {
    FILMS_2026_11_21.forEach(f => {
      const c = cleanFilm(f)!;
      expect(c).toBeTruthy();
      expect(c.trailer).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(c.review.length).toBeLessThan(4000);
    });
  });
});
