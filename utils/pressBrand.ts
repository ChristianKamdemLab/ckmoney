// Couleur de l'étiquette d'un journal sur les cartes de la revue de presse (27/11, version « mélange »).
// 1. un journal de la liste : sa couleur ; 2. sinon la couleur lue sur son site (balise theme-color, gardée
// dans la fiche : sourceColor) ; 3. sinon une étiquette neutre. Jamais de logo ni de police du journal.

const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Couleurs dominantes des journaux suivis. Celles marquées « à confirmer » sont proches du logo. */
const BRANDS: Record<string, { bg: string; fg?: string }> = {
  lemonde: { bg: '#000B15' },
  financialtimes: { bg: '#FFF1E5', fg: '#990F3D' },
  ft: { bg: '#FFF1E5', fg: '#990F3D' },
  reuters: { bg: '#FF8000' },
  jeuneafrique: { bg: '#D5001C' },        // à confirmer
  mediapart: { bg: '#E2001A' },           // à confirmer
  lesechos: { bg: '#E2231A' },            // à confirmer
  africaintelligence: { bg: '#1D2A44' },  // à confirmer
};

export const NEUTRAL = { bg: '#FFFFFF', fg: '#0E1533' };

/** #RRGGBB (ou #RGB) valide, sinon null. */
export const cleanHex = (v?: string | null): string | null => {
  const m = String(v || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return `#${h.toUpperCase()}`;
};

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Texte lisible sur ce fond : blanc ou bleu nuit, celui qui contraste le plus. */
export const textOn = (bg: string) => {
  const l = lum(bg);
  return (1.05) / (l + 0.05) >= (l + 0.05) / (lum(NEUTRAL.fg) + 0.05) ? '#FFFFFF' : NEUTRAL.fg;
};

/** Une couleur trop pâle (blanc, gris clair) ne sert à rien comme étiquette : neutre. */
const usable = (hex: string) => lum(hex) < 0.85;

export const pressBrand = (source?: string, sourceColor?: string | null): { bg: string; fg: string } => {
  const known = BRANDS[key(source || '')];
  if (known) return { bg: known.bg, fg: known.fg || textOn(known.bg) };
  const c = cleanHex(sourceColor);
  if (c && usable(c)) return { bg: c, fg: textOn(c) };
  return NEUTRAL;
};

export const knownBrand = (source?: string) => !!BRANDS[key(source || '')];

/** Lit <meta name="theme-color" content="…"> dans une page HTML. */
export const themeColorIn = (html: string): string | null => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (!/name\s*=\s*["']?theme-color/i.test(tag)) continue;
    if (/media\s*=\s*["'][^"']*dark/i.test(tag)) continue; // la variante pour le mode sombre ne compte pas
    const c = cleanHex(tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]);
    if (c) return c;
  }
  return null;
};
