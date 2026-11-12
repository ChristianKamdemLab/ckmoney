// Fap Fap (Jambo camerounais) : moteur de jeu, sans interface, pour jouer contre l'ordinateur.
// Règles de base (njambo.fr) :
//  - 31 cartes, du 3 au 10 dans les quatre familles, le 10 de pique (10 noir) écarté ; 2 à 4 joueurs, 5 cartes chacun.
//  - Le commandant ouvre le pli. Chacun doit fournir la famille demandée s'il en a ; sinon il jette ce qu'il veut.
//  - La plus forte carte de la famille demandée remporte le pli ; son joueur commande le pli suivant.
//  - Le dernier pli (le 5e) donne la manche.
//  - À son premier tour, un joueur peut annoncer et gagner tout de suite avec : 21 ou moins (somme des
//    valeurs faciales), trois 3, trois 7, un carré, ou cinq cartes de la même famille.
// Points (à confirmer avec Christian, réglables ici) : manche 1 point, Kora (dernier pli gagné avec un 3)
// 2 points, Double Kora (les deux derniers plis gagnés avec des 3) 4 points, annonce 1 point.
// On joue pour des points, jamais pour de l'argent.

export type Suit = 'coeur' | 'carreau' | 'pique' | 'trefle';
export interface Card { s: Suit; r: number }

export const SUITS: Suit[] = ['coeur', 'carreau', 'pique', 'trefle'];
export const RANKS = [3, 4, 5, 6, 7, 8, 9, 10];
export const SUIT_NAME: Record<Suit, string> = { coeur: 'Koubi', carreau: 'Zing', pique: 'pique', trefle: 'trèfle' };
export const SUIT_FULL: Record<Suit, string> = { coeur: 'Koubi (cœur)', carreau: 'Zing (carreau)', pique: 'Pique', trefle: 'Trèfle' };
export const isRed = (s: Suit) => s === 'coeur' || s === 'carreau';
export const cardName = (c: Card) => `${c.r} de ${SUIT_NAME[c.s]}`;
export const sameCard = (a: Card) => (b: Card) => a.s === b.s && a.r === b.r;

export const POINTS = { normal: 1, kora: 2, doubleKora: 4, claim: 1 };

export const makeDeck = (): Card[] =>
  SUITS.flatMap(s => RANKS.map(r => ({ s, r }))).filter(c => !(c.s === 'pique' && c.r === 10));

export type Rng = () => number;
export const shuffle = <T>(arr: T[], rng: Rng = Math.random): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export type ClaimKind = 'carre' | 'trois7' | 'trois3' | 'couleur' | 'vingtEtUn';
export const CLAIM_LABEL: Record<ClaimKind, string> = {
  carre: 'Carré', trois7: 'Trois 7', trois3: 'Trois 3', couleur: 'Cinq cartes de la même famille', vingtEtUn: '21 ou moins',
};
export const handSum = (h: Card[]) => h.reduce((a, c) => a + c.r, 0);

/** Annonce possible avec cette main de 5 cartes (la plus forte d'abord). */
export const claimOf = (hand: Card[]): ClaimKind | null => {
  if (hand.length !== 5) return null;
  const count = (r: number) => hand.filter(c => c.r === r).length;
  if (RANKS.some(r => count(r) === 4)) return 'carre';
  if (count(7) >= 3) return 'trois7';
  if (count(3) >= 3) return 'trois3';
  if (hand.every(c => c.s === hand[0].s)) return 'couleur';
  if (handSum(hand) <= 21) return 'vingtEtUn';
  return null;
};

export interface Player { name: string; human: boolean; hand: Card[]; score: number }
export interface Play { p: number; c: Card }
export interface TrickResult { winner: number; card: Card; plays: Play[] }
export interface RoundResult {
  winner: number;
  kind: 'normal' | 'kora' | 'doubleKora' | 'claim';
  points: number;
  card?: Card;
  claim?: ClaimKind;
  hand?: Card[];
}
export interface Game {
  players: Player[];
  target: number;
  round: number;
  dealer: number;
  trickNo: number;            // 1 à 5
  leader: number;             // commandant du pli en cours
  turn: number | null;        // null : pli complet, en attente de ramassage
  trick: Play[];
  history: TrickResult[];
  played: Card[];             // cartes vues pendant la manche
  result: RoundResult | null;
  matchWinner: number | null;
}

const deal = (g: Game, rng: Rng): Game => {
  const deck = shuffle(makeDeck(), rng);
  const n = g.players.length;
  const leader = (g.dealer + 1) % n;
  return {
    ...g,
    players: g.players.map((p, i) => ({ ...p, hand: deck.slice(i * 5, i * 5 + 5) })),
    trickNo: 1, leader, turn: leader, trick: [], history: [], played: [], result: null,
  };
};

/** Nouvelle partie : le joueur humain (indice 0) commande la première manche. */
export const newGame = (names: { name: string; human: boolean }[], target = 10, rng: Rng = Math.random): Game => {
  if (names.length < 2 || names.length > 4) throw new Error('2 à 4 joueurs');
  return deal({
    players: names.map(x => ({ ...x, hand: [], score: 0 })), target, round: 1, dealer: names.length - 1,
    trickNo: 1, leader: 0, turn: 0, trick: [], history: [], played: [], result: null, matchWinner: null,
  }, rng);
};

export const nextRound = (g: Game, rng: Rng = Math.random): Game =>
  g.matchWinner !== null ? g : deal({ ...g, round: g.round + 1, dealer: (g.dealer + 1) % g.players.length }, rng);

export const legalCards = (hand: Card[], trick: Play[]): Card[] => {
  if (!trick.length) return hand;
  const follow = hand.filter(c => c.s === trick[0].c.s);
  return follow.length ? follow : hand;
};

/** Carte qui tient le pli pour l'instant : la plus forte de la famille demandée. */
export const currentBest = (trick: Play[]): Play | null => {
  if (!trick.length) return null;
  const led = trick[0].c.s;
  return trick.filter(x => x.c.s === led).reduce((a, b) => (b.c.r > a.c.r ? b : a));
};

export const canClaim = (g: Game, p: number) =>
  !g.result && g.turn === p && g.trickNo === 1 && g.players[p].hand.length === 5 ? claimOf(g.players[p].hand) : null;

const finish = (g: Game, result: RoundResult): Game => {
  const players = g.players.map((p, i) => (i === result.winner ? { ...p, score: p.score + result.points } : p));
  const matchWinner = players[result.winner].score >= g.target ? result.winner : null;
  return { ...g, players, result, turn: null, matchWinner };
};

export const claim = (g: Game, p: number): Game => {
  const kind = canClaim(g, p);
  if (!kind) throw new Error('annonce impossible');
  return finish(g, { winner: p, kind: 'claim', claim: kind, points: POINTS.claim, hand: g.players[p].hand });
};

export const play = (g: Game, p: number, card: Card): Game => {
  if (g.result || g.turn !== p) throw new Error('pas ton tour');
  const hand = g.players[p].hand;
  if (!hand.some(sameCard(card))) throw new Error('carte absente');
  if (!legalCards(hand, g.trick).some(sameCard(card))) throw new Error('il faut fournir');
  const players = g.players.map((x, i) => (i === p ? { ...x, hand: x.hand.filter(c => !sameCard(card)(c)) } : x));
  const trick = [...g.trick, { p, c: card }];
  const complete = trick.length === g.players.length;
  return { ...g, players, trick, played: [...g.played, card], turn: complete ? null : (p + 1) % g.players.length };
};

/** Ramasse le pli complet : son gagnant commande le suivant ; après le 5e, la manche est jouée. */
export const resolveTrick = (g: Game): Game => {
  if (g.result || g.trick.length !== g.players.length) return g;
  const best = currentBest(g.trick)!;
  const history = [...g.history, { winner: best.p, card: best.c, plays: g.trick }];
  if (g.trickNo < 5) return { ...g, history, trick: [], trickNo: g.trickNo + 1, leader: best.p, turn: best.p };
  const last = history[4], before = history[3];
  const kind: RoundResult['kind'] = last.card.r === 3
    ? (before.winner === last.winner && before.card.r === 3 ? 'doubleKora' : 'kora')
    : 'normal';
  return finish({ ...g, history, trick: [] }, { winner: last.winner, kind, points: POINTS[kind], card: last.card });
};

// ---------- Ordinateur

/**
 * Seul le dernier pli compte : l'ordinateur garde sa meilleure carte (sa « championne ») pour la fin,
 * se débarrasse de ses petites cartes avant, et cherche à remporter le 4e pli pour commander le dernier.
 */
export const aiMove = (g: Game, p: number): { claim: true } | { card: Card } => {
  if (canClaim(g, p)) return { claim: true };
  const hand = g.players[p].hand;
  const legal = legalCards(hand, g.trick);
  if (legal.length === 1) return { card: legal[0] };

  const unseen = makeDeck().filter(c => !g.played.some(sameCard(c)) && !hand.some(sameCard(c)));
  const strength = (c: Card) => c.r - 2.2 * unseen.filter(u => u.s === c.s && u.r > c.r).length;
  const byStrength = (cs: Card[]) => cs.slice().sort((a, b) => strength(a) - strength(b) || a.r - b.r);
  const champion = byStrength(hand)[hand.length - 1];
  const pool = legal.filter(c => !sameCard(champion)(c));
  const choices = pool.length ? pool : legal;
  const best = currentBest(g.trick);

  if (g.trickNo === 4 && best) {
    // Gagner ce pli avec une autre carte que la championne : on commandera le dernier pli.
    const winners = choices.filter(c => c.s === g.trick[0].c.s && c.r > best.c.r).sort((a, b) => a.r - b.r);
    if (winners.length) return { card: winners[0] };
  }
  return { card: byStrength(choices)[0] };
};
