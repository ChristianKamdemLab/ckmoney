import { describe, it, expect } from 'vitest';
import { evaluate, norm, dayNumber, untilNext, puzzleFor, isLocalDay, keyMarks, shareText, stats, isWon, MAX_TRIES } from '../games/mot';
import { FR_WORDS, LOCAL_WORDS } from '../games/motWords';
import fs from 'node:fs';

describe('Le mot du jour', () => {
  it('compare les lettres comme Wordle, doublons compris', () => {
    expect(evaluate('ARBRE', 'ARBRE')).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(evaluate('RABER', 'ARBRE')).toEqual(['near', 'near', 'ok', 'near', 'near']);
    // Un seul E dans la réponse : un seul E coloré
    expect(evaluate('EEEEE', 'PLAGE')).toEqual(['no', 'no', 'no', 'no', 'ok']);
    expect(evaluate('ELEVE', 'PLAGE')).toEqual(['no', 'ok', 'no', 'no', 'ok']);
    expect(evaluate('ESSAI', 'SABLE')).toEqual(['near', 'near', 'no', 'near', 'no']);
  });

  it('ignore les accents et la casse', () => {
    expect(norm('ndolè')).toBe('NDOLE');
    expect(norm('Yaoundé')).toBe('YAOUNDE');
    expect(evaluate('fêtes', 'FETES')).toEqual(Array(5).fill('ok'));
  });

  it('change de mot à minuit, heure du Cameroun', () => {
    expect(dayNumber(Date.UTC(2026, 10, 19, 23, 0))).toBe(1); // minuit au Cameroun le 20
    expect(dayNumber(Date.UTC(2026, 10, 19, 22, 59))).toBe(0);
    expect(dayNumber(Date.UTC(2026, 10, 20, 22, 59))).toBe(1);
    expect(dayNumber(Date.UTC(2026, 10, 20, 23, 0))).toBe(2);
    expect(untilNext(Date.UTC(2026, 10, 20, 22, 0))).toBe(3_600_000);
  });

  it('un mot du 237 le premier jour puis un jour sur trois', () => {
    expect([1, 2, 3, 4, 5, 6].map(isLocalDay)).toEqual([true, false, true, false, false, true]);
    expect(puzzleFor(1).local).toBeTruthy();
    expect(puzzleFor(2).local).toBeUndefined();
  });

  it('ne repasse pas le même mot avant d’avoir épuisé la liste', () => {
    const fr = new Set<string>(), loc = new Set<string>();
    let frDays = 0, locDays = 0;
    for (let n = 1; frDays < FR_WORDS.length || locDays < LOCAL_WORDS.length; n++) {
      const p = puzzleFor(n);
      if (p.local) { if (locDays < LOCAL_WORDS.length) { loc.add(p.word); locDays++; } }
      else if (frDays < FR_WORDS.length) { fr.add(p.word); frDays++; }
    }
    expect(fr.size).toBe(FR_WORDS.length);
    expect(loc.size).toBe(LOCAL_WORDS.length);
  });

  it('listes propres : 5 à 8 lettres, sans doublon, mots français du dictionnaire', () => {
    const all = [...FR_WORDS, ...LOCAL_WORDS.map(l => l.w)];
    expect(new Set(all).size).toBe(all.length);
    all.forEach(w => { expect(w).toMatch(/^[A-Z]{5,8}$/); });
    LOCAL_WORDS.forEach(l => { expect(norm(l.show)).toBe(l.w); expect(l.def.length).toBeGreaterThan(10); });
    const dict = new Set([5, 6, 7, 8].flatMap(k => fs.readFileSync(`public/mots/fr${k}.txt`, 'utf8').split('\n')));
    FR_WORDS.forEach(w => expect(dict.has(w), w).toBe(true));
  });

  it('clavier : garde la meilleure couleur', () => {
    const k = keyMarks(['SABLE', 'PLAGE'], 'PLAGE');
    expect(k.P).toBe('ok'); expect(k.S).toBe('no'); expect(k.A).toBe('ok'); expect(k.L).toBe('ok');
  });

  it('partage les couleurs sans les lettres', () => {
    const p = { n: 4, word: 'PLAGE', show: 'plage' };
    const t = shareText(p, ['SABLE', 'PLAGE'], 'https://ck-money.vercel.app/?mot');
    expect(t).toContain('n° 4 : 2/6');
    expect(t).toContain('🟩🟩🟩🟩🟩');
    expect(t).not.toMatch(/PLAGE|SABLE/i);
    expect(shareText(p, Array(MAX_TRIES).fill('SABLE'), 'x')).toContain('X/6');
  });

  it('statistiques et série', () => {
    const h: Record<string, string[]> = {};
    [1, 2, 3, 5].forEach(n => { h[n] = [puzzleFor(n).word]; });
    h[4] = Array(MAX_TRIES).fill('ZZZZZ');
    const s = stats(h, 5);
    expect(s.played).toBe(5); expect(s.won).toBe(4); expect(s.best).toBe(3); expect(s.streak).toBe(1);
    expect(s.dist[0]).toBe(4);
    expect(isWon(h[1], puzzleFor(1).word)).toBe(true);
    // Aujourd'hui pas encore joué : la série d'hier compte toujours
    expect(stats({ 1: [puzzleFor(1).word], 2: [puzzleFor(2).word] }, 3).streak).toBe(2);
  });
});
