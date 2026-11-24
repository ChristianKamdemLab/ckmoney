import { describe, it, expect, vi } from 'vitest';

// Ajouter un paquet de mots ne doit jamais changer les mots des jours déjà prévus
describe('réserve du mot du jour', () => {
  it('un paquet ajouté à la fin ne change pas les jours prévus', async () => {
    const before = await import('../games/mot');
    const words = Array.from({ length: 400 }, (_, k) => before.puzzleFor(k + 1).word);
    vi.resetModules();
    vi.doMock('../games/motWords', async () => {
      const real: any = await vi.importActual('../games/motWords');
      const fr = [...real.FR_WORDS, ...Array.from({ length: 20 }, (_, k) => `MOTFR${String.fromCharCode(65 + k)}`)];
      const local = [...real.LOCAL_WORDS, ...Array.from({ length: 10 }, (_, k) => ({ w: `MOTLO${String.fromCharCode(65 + k)}`, show: 'x', cat: 'plat', def: 'x' }))];
      return { ...real, FR_WORDS: fr, LOCAL_WORDS: local };
    });
    const after = await import('../games/mot');
    const localDays = Array.from({ length: 400 }, (_, k) => k + 1).filter(n => after.isLocalDay(n));
    // Les 44 premiers jours du 237 et les 260 premiers jours français restent identiques
    const firstLocal = localDays.slice(0, 44);
    for (const n of firstLocal) expect(after.puzzleFor(n).word).toBe(words[n - 1]);
    const frDays = Array.from({ length: 400 }, (_, k) => k + 1).filter(n => !after.isLocalDay(n)).slice(0, 260);
    for (const n of frDays) expect(after.puzzleFor(n).word).toBe(words[n - 1]);
    // Le 45e jour du 237 prend un mot du nouveau paquet
    expect(after.puzzleFor(localDays[44]).word.startsWith('MOTLO')).toBe(true);
    vi.doUnmock('../games/motWords');
  });
});
