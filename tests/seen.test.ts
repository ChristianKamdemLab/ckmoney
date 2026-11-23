import { describe, it, expect, beforeEach } from 'vitest';
import { seenAt, markSeen, isNewSince } from '../utils/seen';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };

describe('Nouveau depuis la dernière visite', () => {
  beforeEach(() => { delete mem.ck_seen; });
  it('première visite : ce qui a moins de 7 jours', () => {
    const now = Date.UTC(2026, 10, 20);
    const since = seenAt('articles', now);
    expect(isNewSince(new Date(now - 2 * 86_400_000).toISOString(), since)).toBe(true);
    expect(isNewSince(new Date(now - 9 * 86_400_000).toISOString(), since)).toBe(false);
    expect(isNewSince(undefined, since)).toBe(false);
  });
  it('après une visite : seulement ce qui est arrivé depuis', () => {
    const now = Date.UTC(2026, 10, 20);
    markSeen('radio', now);
    expect(seenAt('radio')).toBe(now);
    expect(isNewSince(new Date(now + 1000).toISOString(), seenAt('radio'))).toBe(true);
    expect(isNewSince(new Date(now - 1000).toISOString(), seenAt('radio'))).toBe(false);
    expect(seenAt('articles', now)).toBe(now - 7 * 86_400_000);
  });
});
