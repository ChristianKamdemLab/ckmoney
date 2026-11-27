import { describe, it, expect } from 'vitest';
import { cleanPlace, nextFriday } from '../utils/vendredi';

describe('Mes adresses et prochain vendredi', () => {
  it('prochain vendredi, à Paris', () => {
    expect(nextFriday(Date.UTC(2026, 10, 18, 12))).toBe('2026-11-20'); // mercredi
    expect(nextFriday(Date.UTC(2026, 10, 20, 22))).toBe('2026-11-20'); // vendredi 23 h
    expect(nextFriday(Date.UTC(2026, 10, 21, 10))).toBe('2026-11-27'); // samedi
  });
  it('adresse : un nom et un avis, lien https seulement', () => {
    expect(cleanPlace({ name: 'X' })).toBeNull();
    expect(cleanPlace({ name: 'X', review: 'Bien', url: 'javascript:alert(1)' })!.url).toBe('');
  });
});
