import { describe, it, expect } from 'vitest';
import { cleanShowInput } from '../utils/vendrediShow';

describe('Vendredi Show : ce que propose un proche', () => {
  it('accepte un lieu avec un lien https', () => {
    expect(cleanShowInput({ kind: 'place', name: ' Le Bar ', address: 'Paris', url: 'https://instagram.com/lebar' })).toEqual({ kind: 'place', name: 'Le Bar', address: 'Paris', url: 'https://instagram.com/lebar' });
  });
  it('refuse un lieu sans nom ou un lien qui n’est pas en https', () => {
    expect(cleanShowInput({ kind: 'place', name: 'x' })).toBeNull();
    expect(cleanShowInput({ kind: 'place', name: 'Le Bar', url: 'javascript:alert(1)' })).toBeNull();
  });
  it('accepte un chill chez moi sans adresse', () => {
    expect(cleanShowInput({ kind: 'home' })?.kind).toBe('home');
  });
});
