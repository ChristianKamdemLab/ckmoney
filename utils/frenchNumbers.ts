// Conversion des montants en toutes lettres (français) et relecture d'un montant
// écrit en lettres par l'emprunteur, pour la mention de l'article 1376 du Code civil.

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const TENS: Record<number, string> = {
  20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante',
};

/** 0..99, orthographe traditionnelle (traits d'union sauf avec « et »). */
const below100 = (n: number, trailing: boolean): string => {
  if (n < 17) return UNITS[n];
  if (n < 20) return 'dix-' + UNITS[n - 10];
  if (n >= 80) {
    const rest = n - 80;
    if (rest === 0) return trailing ? 'quatre-vingts' : 'quatre-vingt';
    return 'quatre-vingt-' + below100(rest, false);
  }
  if (n >= 60) {
    const rest = n - 60;
    if (rest === 0) return 'soixante';
    if (rest === 1) return 'soixante et un';
    if (rest === 11) return 'soixante et onze';
    return 'soixante-' + below100(rest, false);
  }
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  if (unit === 0) return TENS[tens];
  if (unit === 1) return `${TENS[tens]} et un`;
  return `${TENS[tens]}-${UNITS[unit]}`;
};

/** 0..999 ; `trailing` = le nombre termine l'expression (accord de cent / vingt). */
const below1000 = (n: number, trailing: boolean): string => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) {
    if (hundreds === 1) parts.push('cent');
    else parts.push(UNITS[hundreds] + ' ' + (rest === 0 && trailing ? 'cents' : 'cent'));
  }
  if (rest > 0) parts.push(below100(rest, trailing));
  return parts.join(' ');
};

export const integerToFrenchWords = (value: number): string => {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'zéro';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions > 0) {
    parts.push(`${below1000(millions, true)} million${millions > 1 ? 's' : ''}`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`);
  }
  if (rest > 0) parts.push(below1000(rest, true));
  return parts.join(' ');
};

const CURRENCY_WORDS: Record<string, [string, string, string, string]> = {
  // [singulier, pluriel, sous-unité singulier, sous-unité pluriel]
  EUR: ['euro', 'euros', 'centime', 'centimes'],
  USD: ['dollar américain', 'dollars américains', 'cent', 'cents'],
  CAD: ['dollar canadien', 'dollars canadiens', 'cent', 'cents'],
  CHF: ['franc suisse', 'francs suisses', 'centime', 'centimes'],
  GBP: ['livre sterling', 'livres sterling', 'penny', 'pence'],
  XAF: ['franc CFA', 'francs CFA', 'centime', 'centimes'],
};

/** Ex. 1250.5, 'EUR' → « mille deux cent cinquante euros et cinquante centimes ». */
export const amountToFrenchWords = (amount: number, currency = 'EUR'): string => {
  const [sg, pl, subSg, subPl] = CURRENCY_WORDS[currency] || [currency, currency, 'centime', 'centimes'];
  const totalCents = Math.round(amount * 100);
  const units = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const unitWords = integerToFrenchWords(units);
  // « un million d'euros », « deux millions d'euros »
  const de = /millions?$/.test(unitWords) ? (/^[aeiouyéè]/i.test(pl) ? "d'" : 'de ') : '';
  let out = `${unitWords} ${de}${units > 1 ? pl : sg}`.replace("d' ", "d'");
  if (currency !== 'XAF' && cents > 0) {
    out += ` et ${integerToFrenchWords(cents)} ${cents > 1 ? subPl : subSg}`;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Lecture d'un montant écrit en lettres
// ---------------------------------------------------------------------------

const WORD_VALUES: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
  septante: 70, octante: 80, huitante: 80, nonante: 90,
};

const IGNORED = new Set([
  'et', 'de', 'd', 'euro', 'euros', 'eur', 'dollar', 'dollars', 'americain', 'americains',
  'canadien', 'canadiens', 'franc', 'francs', 'cfa', 'fcfa', 'suisse', 'suisses',
  'livre', 'livres', 'sterling', 'la', 'somme', 'bon', 'pour',
]);
const SUB_UNITS = new Set(['centime', 'centimes', 'cent_sub', 'pence', 'penny']);
const MAIN_UNITS = new Set(['euro', 'euros', 'dollar', 'dollars', 'franc', 'francs', 'livre', 'livres', 'cfa', 'fcfa', 'suisse', 'suisses', 'sterling', 'americains', 'canadiens', 'americain', 'canadien']);

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/€/g, ' euros ')
    .replace(/['’\-–,.;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Lit une suite de mots (sans unité monétaire) ; null si un mot est inconnu. */
const parseIntegerWords = (tokens: string[]): number | null => {
  let total = 0;
  let current = 0;
  let seenNumber = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (IGNORED.has(t)) continue;
    if (t === 'cent' || t === 'cents') {
      current = (current || 1) * 100;
      seenNumber = true;
    } else if (t === 'mille' || t === 'mil') {
      total += (current || 1) * 1000;
      current = 0;
      seenNumber = true;
    } else if (t === 'million' || t === 'millions') {
      total += (current || 1) * 1_000_000;
      current = 0;
      seenNumber = true;
    } else if (t in WORD_VALUES) {
      const v = WORD_VALUES[t];
      // quatre-vingt(s) : 4 × 20
      if ((t === 'vingt' || t === 'vingts') && tokens[i - 1] === 'quatre' && current % 100 === 4) {
        current += 76;
      } else {
        current += v;
      }
      seenNumber = true;
    } else {
      return null;
    }
  }
  return seenNumber ? total + current : null;
};

/**
 * Relit un montant écrit en lettres (« mille deux cents euros et cinquante centimes »).
 * Retourne le montant en unités (ex. 1200.5) ou null si illisible ou s'il contient des chiffres.
 */
export const parseFrenchAmountWords = (text: string): number | null => {
  if (!text || /\d/.test(text)) return null;
  const tokens = normalize(text).split(' ').filter(Boolean);
  if (tokens.length === 0) return null;

  // Partie décimale : « virgule » ou mot de sous-unité (centimes)
  const virgule = tokens.indexOf('virgule');
  if (virgule >= 0) {
    const intPart = parseIntegerWords(tokens.slice(0, virgule));
    const decTokens = tokens.slice(virgule + 1).filter(t => !SUB_UNITS.has(t));
    const decPart = parseIntegerWords(decTokens);
    if (intPart === null || decPart === null || decPart > 99) return null;
    return intPart + decPart / 100;
  }

  const subIdx = tokens.findIndex(t => SUB_UNITS.has(t));
  if (subIdx >= 0) {
    // On coupe après le mot d'unité monétaire principal (euros, dollars…)
    const mainUnitIdx = tokens.findIndex(
      (t, i) => i < subIdx && MAIN_UNITS.has(t),
    );
    if (mainUnitIdx < 0) {
      const cents = parseIntegerWords(tokens.slice(0, subIdx));
      return cents === null ? null : cents / 100;
    }
    // Dernier mot d'unité principale avant les centimes
    let lastUnit = mainUnitIdx;
    for (let i = mainUnitIdx; i < subIdx; i++) {
      if (IGNORED.has(tokens[i]) && tokens[i] !== 'et') lastUnit = i;
    }
    const intPart = parseIntegerWords(tokens.slice(0, lastUnit + 1));
    const decPart = parseIntegerWords(tokens.slice(lastUnit + 1, subIdx));
    if (intPart === null || decPart === null || decPart > 99) return null;
    return intPart + decPart / 100;
  }

  // « vingt et un euros cinquante », « dix dollars et cinquante cents » : ce qui suit l'unité
  // monétaire, ce sont les centimes (le « cents » final est alors la sous-unité du dollar).
  let lastUnit = -1;
  tokens.forEach((t, i) => { if (MAIN_UNITS.has(t)) lastUnit = i; });
  if (lastUnit >= 0 && lastUnit < tokens.length - 1) {
    let tail = tokens.slice(lastUnit + 1);
    if (tail.length > 1 && /^cents?$/.test(tail[tail.length - 1])) tail = tail.slice(0, -1);
    const intPart = parseIntegerWords(tokens.slice(0, lastUnit + 1));
    const decPart = parseIntegerWords(tail);
    if (intPart !== null && decPart !== null && decPart <= 99) return intPart + decPart / 100;
  }

  return parseIntegerWords(tokens);
};

/** Vérifie que le texte saisi correspond exactement au montant (au centime près). */
export const amountWordsMatch = (text: string, amount: number): boolean => {
  const parsed = parseFrenchAmountWords(text);
  return parsed !== null && Math.round(parsed * 100) === Math.round(amount * 100);
};
