import { describe, it, expect } from 'vitest';
import {
  makeDeck, claimOf, legalCards, currentBest, newGame, play, resolveTrick, claim, nextRound, aiMove, canClaim,
  Card, Game, Suit, POINTS,
} from '../games/fapfap';

const c = (r: number, s: Suit): Card => ({ r, s });

// Générateur pseudo-aléatoire reproductible
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

/** Partie à 2 joueurs avec des mains choisies (le joueur 0 commande). */
const fixed = (h0: Card[], h1: Card[]): Game => {
  const g = newGame([{ name: 'Moi', human: true }, { name: 'Tonton', human: false }], 10, seeded(1));
  return { ...g, players: [{ ...g.players[0], hand: h0 }, { ...g.players[1], hand: h1 }], leader: 0, turn: 0 };
};

describe('Fap Fap : le jeu', () => {
  it('31 cartes du 3 au 10, sans le 10 de pique', () => {
    const d = makeDeck();
    expect(d).toHaveLength(31);
    expect(d.some(x => x.r === 10 && x.s === 'pique')).toBe(false);
    expect(d.some(x => x.r === 10 && x.s === 'trefle')).toBe(true);
    expect(Math.min(...d.map(x => x.r))).toBe(3);
  });

  it('chacun reçoit 5 cartes, toutes différentes', () => {
    const g = newGame([{ name: 'A', human: true }, { name: 'B', human: false }, { name: 'C', human: false }, { name: 'D', human: false }], 10, seeded(7));
    const all = g.players.flatMap(p => p.hand);
    expect(g.players.every(p => p.hand.length === 5)).toBe(true);
    expect(new Set(all.map(x => `${x.r}${x.s}`)).size).toBe(20);
  });

  it('il faut fournir la famille demandée si on en a', () => {
    const hand = [c(4, 'coeur'), c(9, 'pique'), c(8, 'coeur')];
    expect(legalCards(hand, [{ p: 0, c: c(5, 'coeur') }])).toEqual([c(4, 'coeur'), c(8, 'coeur')]);
    expect(legalCards(hand, [{ p: 0, c: c(5, 'trefle') }])).toEqual(hand);
  });

  it('la plus forte carte de la famille demandée gagne, pas une plus forte d’une autre famille', () => {
    const best = currentBest([{ p: 0, c: c(5, 'coeur') }, { p: 1, c: c(10, 'trefle') }, { p: 2, c: c(7, 'coeur') }]);
    expect(best).toEqual({ p: 2, c: c(7, 'coeur') });
  });

  it('annonces : carré, trois 7, trois 3, même famille, 21 ou moins', () => {
    expect(claimOf([c(8, 'coeur'), c(8, 'pique'), c(8, 'trefle'), c(8, 'carreau'), c(9, 'coeur')])).toBe('carre');
    expect(claimOf([c(7, 'coeur'), c(7, 'pique'), c(7, 'trefle'), c(9, 'carreau'), c(10, 'coeur')])).toBe('trois7');
    expect(claimOf([c(3, 'coeur'), c(3, 'pique'), c(3, 'trefle'), c(9, 'carreau'), c(10, 'coeur')])).toBe('trois3');
    expect(claimOf([c(4, 'pique'), c(6, 'pique'), c(8, 'pique'), c(9, 'pique'), c(10, 'trefle')])).toBe(null);
    expect(claimOf([c(4, 'pique'), c(6, 'pique'), c(8, 'pique'), c(9, 'pique'), c(5, 'pique')])).toBe('couleur');
    expect(claimOf([c(3, 'pique'), c(4, 'coeur'), c(4, 'trefle'), c(5, 'pique'), c(5, 'coeur')])).toBe('vingtEtUn'); // 21
    expect(claimOf([c(3, 'pique'), c(4, 'coeur'), c(4, 'trefle'), c(5, 'pique'), c(6, 'coeur')])).toBe(null);       // 22
  });

  it("l'annonce n'est possible qu'au premier tour, avec ses 5 cartes", () => {
    const g = fixed([c(7, 'coeur'), c(7, 'pique'), c(7, 'trefle'), c(9, 'carreau'), c(10, 'coeur')],
      [c(4, 'coeur'), c(5, 'pique'), c(6, 'trefle'), c(8, 'carreau'), c(9, 'coeur')]);
    expect(canClaim(g, 0)).toBe('trois7');
    expect(canClaim(g, 1)).toBe(null); // pas son tour
    const after = claim(g, 0);
    expect(after.result).toMatchObject({ winner: 0, kind: 'claim', points: POINTS.claim });
    expect(after.players[0].score).toBe(POINTS.claim);
  });

  it('le dernier pli donne la manche ; Kora avec un 3, Double Kora avec deux 3', () => {
    // Moi : je commande tout, avec des cartes que Tonton ne peut pas suivre aux deux derniers plis
    let g = fixed(
      [c(10, 'coeur'), c(9, 'coeur'), c(8, 'coeur'), c(3, 'trefle'), c(3, 'carreau')],
      [c(4, 'coeur'), c(5, 'coeur'), c(6, 'coeur'), c(9, 'pique'), c(8, 'pique')],
    );
    const seq: [number, Card][] = [
      [0, c(10, 'coeur')], [1, c(4, 'coeur')],
      [0, c(9, 'coeur')], [1, c(5, 'coeur')],
      [0, c(8, 'coeur')], [1, c(6, 'coeur')],
      [0, c(3, 'trefle')], [1, c(9, 'pique')],
      [0, c(3, 'carreau')], [1, c(8, 'pique')],
    ];
    seq.forEach(([p, card], i) => { g = play(g, p, card); if (i % 2) g = resolveTrick(g); });
    expect(g.result).toMatchObject({ winner: 0, kind: 'doubleKora', points: POINTS.doubleKora });
    expect(g.players[0].score).toBe(4);
  });

  it('refuse une carte qui ne fournit pas', () => {
    const g = fixed([c(10, 'coeur'), c(4, 'pique'), c(5, 'pique'), c(6, 'pique'), c(7, 'pique')],
      [c(4, 'coeur'), c(9, 'pique'), c(8, 'trefle'), c(9, 'trefle'), c(10, 'trefle')]);
    const g1 = play(g, 0, c(10, 'coeur'));
    expect(() => play(g1, 1, c(9, 'pique'))).toThrow();
  });

  it("des parties entières contre l'ordinateur se terminent, avec des coups toujours valides", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed);
      const n = 2 + (seed % 3);
      let g = newGame(Array.from({ length: n }, (_, i) => ({ name: `J${i}`, human: false })), 10, rng);
      let guard = 0;
      while (g.matchWinner === null && guard++ < 2000) {
        if (g.result) { g = nextRound(g, rng); continue; }
        if (g.turn === null) { g = resolveTrick(g); continue; }
        const m = aiMove(g, g.turn);
        if ('claim' in m) g = claim(g, g.turn);
        else {
          expect(legalCards(g.players[g.turn].hand, g.trick)).toContainEqual(m.card);
          g = play(g, g.turn, m.card);
        }
      }
      expect(g.matchWinner).not.toBe(null);
      expect(g.players[g.matchWinner!].score).toBeGreaterThanOrEqual(10);
    }
  });
});
