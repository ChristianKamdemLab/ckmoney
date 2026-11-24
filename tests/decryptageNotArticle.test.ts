import { describe, it, expect, vi } from 'vitest';
vi.mock('../api/_lib/admin.js', () => ({ adminDb: {}, adminAuth: {}, authorEmail: () => '', pushToUser: async () => 0 }));
import { isDecryptageName } from '../api/_lib/articleSync';

describe('le décryptage n’est pas un article', () => {
  it('reconnaît ses documents, versions comprises', () => {
    expect(isDecryptageName('Décryptage · 2026-11-24')).toBe(true);
    expect(isDecryptageName('Décryptage · 2026-11-24 (premier jet)')).toBe(true);
    expect(isDecryptageName('Le décryptage de Jeune Afrique.pdf')).toBe(false);
  });
});
