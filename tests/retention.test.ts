import { describe, it, expect, vi } from 'vitest';
vi.mock('../api/_lib/admin', () => ({ adminDb: {} }));
import { isExpiredPress, cutoffDate } from '../api/_lib/retention';

const now = Date.parse('2026-11-24T17:00:00Z');

describe('durée de vie des infos (7 jours)', () => {
  it('efface la revue de presse arrivée depuis plus de 7 jours', () => {
    expect(isExpiredPress({ kind: 'press', createdAt: '2026-11-16T10:00:00Z' }, now)).toBe(true);
    expect(isExpiredPress({ kind: 'press', createdAt: '2026-11-18T10:00:00Z' }, now)).toBe(false);
  });
  it('ne touche jamais aux textes CKLabs ni aux fiches sans date', () => {
    expect(isExpiredPress({ kind: 'own', createdAt: '2025-01-01T00:00:00Z' }, now)).toBe(false);
    expect(isExpiredPress({ kind: 'press' }, now)).toBe(false);
  });
  it("garde l'info du jour des 7 derniers jours", () => {
    expect(cutoffDate(now)).toBe('2026-11-17');
  });
});
