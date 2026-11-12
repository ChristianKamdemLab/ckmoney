// Baccalauréat (petit bac) : règles et calcul des points, sans interface.
//  - Une lettre tirée au hasard ; un mot par catégorie, commençant par cette lettre.
//  - Le premier qui a tout rempli peut dire STOP : les autres ont alors 10 secondes.
//  - Correction : chacun voit toutes les réponses et peut en contester ; une réponse est refusée
//    si plus de la moitié des AUTRES joueurs la contestent.
//  - Points : 10 pour une réponse valable que personne d'autre n'a donnée, 5 si elle est partagée, 0 sinon.
// Les articles (le, la, l', un…) et les accents ne comptent pas.

export const POINTS_UNIQUE = 10;
export const POINTS_SHARED = 5;
export const STOP_GRACE_S = 10;

export const DEFAULT_CATEGORIES = ['Prénom', 'Pays', 'Ville', 'Animal', 'Métier', 'Fruit ou légume', 'Plat', 'Objet'];
export const MORE_CATEGORIES = ['Marque', 'Célébrité', 'Sport', 'Film ou série', 'Chanteur ou chanteuse', 'Partie du corps', 'Vêtement', 'Couleur', 'Boisson', 'Instrument de musique', 'Footballeur', 'Quartier ou village du Cameroun'];

// Lettres jouables (les très rares sont écartées)
export const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('');

export const pickLetter = (used: string[], rng: () => number = Math.random) => {
  const free = LETTERS.filter(l => !used.includes(l));
  const pool = free.length ? free : LETTERS;
  return pool[Math.floor(rng() * pool.length)];
};

const ARTICLES = /^(le|la|les|l|un|une|des|du|de|d)\s*['’]?\s+|^(l|d)['’]\s*/i;

/** Forme de comparaison : sans accents, sans article, sans ponctuation, en minuscules. */
export const normalize = (s: string) => {
  let t = (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/[’']/g, "'");
  for (let i = 0; i < 2; i++) t = t.replace(ARTICLES, '');
  return t.replace(/[^a-z0-9]+/g, ' ').trim();
};

export const startsWithLetter = (s: string, letter: string) => normalize(s).startsWith(letter.toLowerCase());

export type AutoReject = 'vide' | 'lettre';
export const autoCheck = (s: string, letter: string): AutoReject | null =>
  !normalize(s) ? 'vide' : !startsWithLetter(s, letter) ? 'lettre' : null;

/** Contestée par plus de la moitié des autres joueurs ? */
export const rejectedByVote = (votes: number, players: number) => votes * 2 > players - 1;

export interface RoundInput {
  letter: string;
  categories: string[];
  players: string[];                                  // identifiants des joueurs
  answers: Record<string, string[]>;                  // joueur → réponses, dans l'ordre des catégories
  votes: Record<string, string[]>;                    // `${catégorie}|${joueur}` → joueurs qui contestent
}

export interface RoundOutcome {
  points: Record<string, number>;                     // total de la manche par joueur
  detail: Record<string, number>;                     // `${catégorie}|${joueur}` → 0, 5 ou 10
  status: Record<string, 'ok' | 'conteste' | AutoReject>;
}

export const scoreRound = (r: RoundInput): RoundOutcome => {
  const points: Record<string, number> = Object.fromEntries(r.players.map(p => [p, 0]));
  const detail: Record<string, number> = {};
  const status: RoundOutcome['status'] = {};
  r.categories.forEach((_, c) => {
    const valid: { p: string; key: string }[] = [];
    r.players.forEach(p => {
      const text = r.answers[p]?.[c] || '';
      const k = `${c}|${p}`;
      const auto = autoCheck(text, r.letter);
      if (auto) { status[k] = auto; detail[k] = 0; return; }
      if (rejectedByVote((r.votes[k] || []).filter(v => v !== p).length, r.players.length)) { status[k] = 'conteste'; detail[k] = 0; return; }
      status[k] = 'ok';
      valid.push({ p, key: normalize(text) });
    });
    valid.forEach(({ p, key }) => {
      const same = valid.filter(v => v.key === key).length;
      const pts = same > 1 ? POINTS_SHARED : POINTS_UNIQUE;
      detail[`${c}|${p}`] = pts;
      points[p] += pts;
    });
  });
  return { points, detail, status };
};
