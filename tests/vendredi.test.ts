import { describe, it, expect } from 'vitest';
import { cleanFriday, cleanPlace, nextFriday, isOpen, isCurrent, tally } from '../utils/vendredi';

describe('Mon vendredi soir', () => {
  it('prochain vendredi, à Paris', () => {
    expect(nextFriday(Date.UTC(2026, 10, 18, 12))).toBe('2026-11-20'); // mercredi
    expect(nextFriday(Date.UTC(2026, 10, 20, 22))).toBe('2026-11-20'); // vendredi 23 h
    expect(nextFriday(Date.UTC(2026, 10, 21, 10))).toBe('2026-11-27'); // samedi
  });
  it('vote ouvert jusqu’au samedi midi, visible du lundi au samedi', () => {
    expect(isOpen('2026-11-20', Date.UTC(2026, 10, 20, 20))).toBe(true);
    expect(isOpen('2026-11-20', Date.UTC(2026, 10, 21, 10))).toBe(true);   // samedi 11 h Paris
    expect(isOpen('2026-11-20', Date.UTC(2026, 10, 21, 12))).toBe(false);  // samedi 13 h Paris
    expect(isCurrent('2026-11-20', Date.UTC(2026, 10, 16, 9))).toBe(true);  // lundi
    expect(isCurrent('2026-11-20', Date.UTC(2026, 10, 22, 9))).toBe(false); // dimanche
  });
  it('2 ou 3 options avec un pourquoi ; « Chez moi » par défaut', () => {
    expect(cleanFriday({ date: '2026-11-27', options: [{ kind: 'home', why: 'Soirée jeux' }] })).toBeNull();
    const f = cleanFriday({ date: '2026-11-27', options: [{ kind: 'home', why: 'Soirée jeux' }, { kind: 'place', name: 'Chez Gala', why: 'Musique' }, { name: 'Sans pourquoi', why: '' }, { name: 'D', why: 'x' }] })!;
    expect(f.options.map(o => [o.id, o.name])).toEqual([['a', 'Chez moi'], ['b', 'Chez Gala']]);
    expect(cleanFriday({ date: 'pas une date', options: [] })).toBeNull();
  });
  it('compte les votes', () => {
    const f = cleanFriday({ date: '2026-11-27', options: [{ kind: 'home', why: 'a' }, { name: 'B', why: 'b' }] })!;
    expect(tally({ u1: 'a', u2: 'b', u3: 'a', u4: 'z' }, f.options)).toEqual({ a: 2, b: 1 });
  });
  it('adresse : un nom et un avis, lien https seulement', () => {
    expect(cleanPlace({ name: 'X' })).toBeNull();
    expect(cleanPlace({ name: 'X', review: 'Bien', url: 'javascript:alert(1)' })!.url).toBe('');
  });
});
