// Rubriques du fil « Actu » (26/11). L'agent « L'essentiel » écrit la rubrique de chaque fiche
// (« Rubrique : Cameroun, Éco ») et l'agent « Info du jour » celle de chaque info ; l'appli ne devine
// plus que pour les fiches qui n'en ont pas. Cameroun compte aussi pour Afrique.

export type Zone = 'cameroun' | 'afrique' | 'monde' | 'eco';
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** « Cameroun, Éco » → ['cameroun', 'afrique', 'eco'] ; rien de reconnu → []. */
export const parseRubrique = (raw: string): Zone[] => {
  const z = new Set<Zone>();
  for (const part of norm(raw || '').split(/[,/;|&+]|\bet\b/)) {
    const p = part.trim();
    if (/camer/.test(p)) { z.add('cameroun'); z.add('afrique'); }
    else if (/afri/.test(p)) z.add('afrique');
    else if (/monde|internat/.test(p)) z.add('monde');
    else if (/eco|financ|business/.test(p)) z.add('eco');
  }
  return [...z];
};

// Rubriques devinées quand la fiche n'en a pas (avant la ligne « Rubrique : » des agents).
const CM_RE = /camer|yaound|douala|biya|rdpc|elecam|bamenda|garoua|bafoussam/i;
const AF_RE = /afri|sénégal|senegal|nigeria|côte d.ivoire|rdc|congo|gabon|tchad|maroc|algérie|tunisie|kenya|mali\b|burkina|niger\b|ghana|éthiopie|soudan|libye|can 20/i;
const ECO_RE = /écono|economi|financ|bours|banque|budget|dette|inflation|entreprise|investiss|immobili|fiscal|impôt|pétrole|croissance|marché/i;
const CM_SRC = /cameroon|cameroun|ecomatin|quotidien de l.économie|actu cameroun|mimi mefo|crtv|data cameroon|business in cameroon/i;
const AF_SRC = /jeune afrique|africa intelligence|rfi afrique|monde afrique|africa report|africanews|ecofin|bbc afrique/i;
const ECO_SRC = /les echos|financial times|ecofin|ecomatin|économie|business in|investir/i;
export const guessZones = (text: string, source = ''): Zone[] => {
  const z = new Set<Zone>();
  if (CM_RE.test(text) || CM_SRC.test(source)) { z.add('cameroun'); z.add('afrique'); }
  if (AF_RE.test(text) || AF_SRC.test(source)) z.add('afrique');
  if (ECO_RE.test(text) || ECO_SRC.test(source)) z.add('eco');
  if (!z.has('afrique')) z.add('monde');
  return [...z];
};

