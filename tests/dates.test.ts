import { describe, it, expect } from 'vitest';
import { avecPremier } from '../utils/dates';

const fr = (iso: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = iso.split('-').map(Number);
  return avecPremier(new Date(y, m - 1, d).toLocaleDateString('fr-FR', opts));
};

describe('avecPremier : « 1er » pour le premier du mois', () => {
  it('mois long, avec année', () => {
    expect(fr('2026-08-01', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('1er août 2026');
    expect(fr('2026-10-01', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('1er octobre 2026');
  });
  it('mois long sans année, et mois abrégé', () => {
    expect(fr('2026-09-01', { day: 'numeric', month: 'long' })).toBe('1er septembre');
    expect(fr('2026-12-01', { day: 'numeric', month: 'short' })).toBe('1er déc.');
  });
  it('avec le jour de la semaine', () => {
    expect(fr('2027-07-01', { weekday: 'long', day: 'numeric', month: 'long' })).toBe('jeudi 1er juillet');
  });
  it('ne touche pas aux autres jours ni aux dates en chiffres', () => {
    expect(fr('2026-08-11', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('11 août 2026');
    expect(fr('2026-08-21', { day: 'numeric', month: 'long' })).toBe('21 août');
    expect(fr('2026-08-01', { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('01/08/2026');
  });
  it('date et heure (signature)', () => {
    expect(avecPremier(new Date(2026, 9, 1, 14, 3).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }))).toMatch(/^1er octobre 2026/);
  });
});
