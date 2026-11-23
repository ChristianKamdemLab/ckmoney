import { describe, it, expect } from 'vitest';
import { isIdentityComplete } from '../types';

describe('Identité du proche', () => {
  const base = { fullName: 'Ami Test', birthDate: '1990-01-01', address: '1 rue de la Paix, 75002 Paris' };
  it('accepte une ville tapée sans la choisir dans la liste', () => {
    expect(isIdentityComplete({ ...base, birthPlace: 'Yaoundé' })).toBe(true);
    expect(isIdentityComplete({ ...base, birthPlace: 'Bafoussam, Cameroun' })).toBe(true);
  });
  it('refuse un champ vide', () => {
    expect(isIdentityComplete({ ...base, birthPlace: ' ' })).toBe(false);
    expect(isIdentityComplete({ ...base, birthPlace: 'Paris', address: '' })).toBe(false);
  });
});
