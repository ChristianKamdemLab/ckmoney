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
