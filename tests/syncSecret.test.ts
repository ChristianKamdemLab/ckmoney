import { describe, it, expect } from 'vitest';
import { syncAllowed } from '../api/_lib/syncSecret';

describe('secret des routes de synchronisation', () => {
  it('reste ouvert tant que la variable Vercel n’est pas définie', () => {
    expect(syncAllowed({ headers: {} }, undefined)).toBe(true);
  });
  it('exige le bon secret une fois la variable définie', () => {
    expect(syncAllowed({ headers: {} }, 'abc')).toBe(false);
    expect(syncAllowed({ headers: { 'x-sync-secret': 'abd' } }, 'abc')).toBe(false);
    expect(syncAllowed({ headers: { 'x-sync-secret': '' } }, 'abc')).toBe(false);
    expect(syncAllowed({ headers: { 'x-sync-secret': 'abc' } }, 'abc')).toBe(true);
  });
});
