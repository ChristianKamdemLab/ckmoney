import { FR_WORDS, LOCAL_WORDS, LocalWord } from './motWords.js';

// « Le mot du jour » : un mot par jour, le même pour tous, à trouver en 6 essais.
// Le jour change à minuit, heure du Cameroun (UTC+1, sans heure d'été).

export const MAX_TRIES = 6;
export const START = Date.UTC(2026, 10, 20); // n° 1 : vendredi 20 novembre 2026
const DAY = 86_400_000;
const TZ = 3_600_000;

export type Mark = 'ok' | 'near' | 'no';
export type Puzzle = { n: number; word: string; show: string; local?: LocalWord };

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').toUpperCase().replace(/[^A-Z]/g, '');

/** Numéro du jour (1 le jour du lancement). */
export const dayNumber = (now = Date.now()) => Math.floor((now + TZ - START) / DAY) + 1;
/** Millisecondes jusqu'au prochain mot. */
export const untilNext = (now = Date.now()) => DAY - ((now + TZ - START) % DAY + DAY) % DAY;

// Ordre mélangé mais fixe (le même pour tout le monde)
const shuffled = <T,>(list: T[], seed: number): T[] => {
  const a = list.slice();
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
// Les mots ajoutés après coup (par paquets de FR_CHUNK et LOCAL_CHUNK, à la fin des listes) sont mélangés
// paquet par paquet et placés après les autres : l'ordre des mots déjà prévus ne bouge jamais.
export const FR_BASE = 260, FR_CHUNK = 20, LOCAL_BASE = 44, LOCAL_CHUNK = 10;
const ordered = <T,>(list: T[], base: number, chunk: number, seed: number): T[] => {
  const out = shuffled(list.slice(0, base), seed);
  for (let k = 0, i = base; i < list.length; k++, i += chunk) out.push(...shuffled(list.slice(i, i + chunk), seed + k + 1));
  return out;
};
const FR_ORDER = ordered(FR_WORDS, FR_BASE, FR_CHUNK, 237);
const LOCAL_ORDER = ordered(LOCAL_WORDS, LOCAL_BASE, LOCAL_CHUNK, 1960);

/** Un jour sur trois (n° 3, 6, 9…), un mot du 237. Le premier jour, un mot du 237 aussi. */
export const isLocalDay = (n: number) => n === 1 || n % 3 === 0;

const localCount = (m: number) => (m >= 1 ? 1 + Math.floor(m / 3) : 0); // jours du 237 parmi 1..m

export const puzzleFor = (n: number): Puzzle => {
  const i = Math.max(1, Math.floor(n));
  if (isLocalDay(i)) {
    const local = LOCAL_ORDER[(localCount(i) - 1) % LOCAL_ORDER.length];
    return { n: i, word: local.w, show: local.show, local };
  }
  const word = FR_ORDER[(i - 1 - localCount(i - 1)) % FR_ORDER.length];
  return { n: i, word, show: word.toLowerCase() };
};

/** Couleurs d'un essai : lettres bien placées d'abord, puis présentes ailleurs (sans compter deux fois). */
export const evaluate = (guess: string, answer: string): Mark[] => {
  const g = norm(guess), a = norm(answer);
  const marks: Mark[] = Array(a.length).fill('no');
  const left = new Map<string, number>();
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) marks[i] = 'ok';
    else left.set(a[i], (left.get(a[i]) || 0) + 1);
  }
  for (let i = 0; i < a.length; i++) {
    if (marks[i] === 'ok') continue;
    const c = left.get(g[i]) || 0;
    if (c > 0) { marks[i] = 'near'; left.set(g[i], c - 1); }
  }
  return marks;
};

/** État du clavier : la meilleure couleur vue pour chaque lettre. */
export const keyMarks = (guesses: string[], answer: string) => {
  const rank = { no: 0, near: 1, ok: 2 } as const;
  const out: Record<string, Mark> = {};
  guesses.forEach(g => evaluate(g, answer).forEach((m, i) => {
    const l = norm(g)[i];
    if (!out[l] || rank[m] > rank[out[l]]) out[l] = m;
  }));
  return out;
};

export const isWon = (guesses: string[], answer: string) => guesses.some(g => norm(g) === norm(answer));
export const isOver = (guesses: string[], answer: string) => isWon(guesses, answer) || guesses.length >= MAX_TRIES;

/** Grille à partager : les couleurs, jamais les lettres. */
/** Nombre d'essais ratés à partir duquel on propose l'indice (mots du 237). */
export const HINT_AFTER = 2;

export const shareText = (p: Puzzle, guesses: string[], link: string, hinted = false) => {
  const won = isWon(guesses, p.word);
  const rows = guesses.map(g => evaluate(g, p.word).map(m => (m === 'ok' ? '🟩' : m === 'near' ? '🟨' : '⬛')).join(''));
  return `Le mot du jour n° ${p.n}${p.local ? ' · mot du 237' : ''} : ${won ? guesses.length : 'X'}/${MAX_TRIES}${hinted ? ' (avec indice)' : ''}\n\n${rows.join('\n')}\n\nÀ toi : ${link}`;
};

export type History = Record<string, string[]>; // n° du jour → essais

export const stats = (h: History, today: number) => {
  const days = Object.keys(h).map(Number).filter(n => n <= today && isOver(h[n], puzzleFor(n).word)).sort((a, b) => a - b);
  const won = days.filter(n => isWon(h[n], puzzleFor(n).word));
  const wonSet = new Set(won);
  let best = 0, run = 0, prev = -9;
  for (const n of won) { run = n === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = n; }
  // Série en cours : jours gagnés d'affilée jusqu'à aujourd'hui (ou hier si aujourd'hui n'est pas encore joué)
  let streak = 0;
  for (let n = wonSet.has(today) ? today : today - 1; wonSet.has(n); n--) streak++;
  const dist = Array(MAX_TRIES).fill(0);
  won.forEach(n => { dist[h[n].length - 1]++; });
  return { played: days.length, won: won.length, streak, best, dist };
};

/** Mots acceptés comme essais en plus du dictionnaire. */
export const EXTRA_WORDS = new Set([...FR_WORDS, ...LOCAL_WORDS.map(l => l.w)]);
