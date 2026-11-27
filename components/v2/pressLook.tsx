import React from 'react';
import { C } from './ui';
import { Article } from '../../types';
import { guessZones } from '../../utils/rubrique';
import { pressBrand } from '../../utils/pressBrand';

// Allure commune des fiches de presse (27/11), sur l'accueil comme dans la liste des articles :
// une couleur par rubrique, et le nom du journal dans une étiquette à sa couleur.

const ZONE_COVER: Record<string, { bg: string; fg: string; tag: string; dot: string; label: string }> = {
  cameroun: { bg: C.teal, fg: C.ink, tag: C.ink, dot: C.night, label: 'Cameroun' },
  afrique: { bg: C.mango, fg: C.ink, tag: C.ochreText, dot: C.coral, label: 'Afrique' },
  monde: { bg: C.coral, fg: C.ink, tag: C.ink, dot: C.mango, label: 'Monde' },
  eco: { bg: C.green, fg: '#fff', tag: C.mango, dot: C.mango, label: 'Éco' },
};

export const zonesOfArticle = (a: Article) => a.zones?.length ? a.zones : guessZones(`${a.title} ${a.sourceSection || ''} ${a.excerpt}`, a.source);

/** Couleurs de la rubrique principale d'une fiche (Cameroun avant Afrique, Éco seulement s'il est seul). */
export const pressCover = (a: Article) => {
  const zones = zonesOfArticle(a);
  const z = zones.find(x => x !== 'eco' && ZONE_COVER[x]) || (zones.includes('eco') ? 'eco' : 'monde');
  const c = ZONE_COVER[z];
  return { ...c, deco: <span aria-hidden="true" className="absolute rounded-full" style={{ width: 52, height: 52, background: c.dot, top: -20, right: -16 }} /> };
};

/** Textes CKLabs : la nuit et la mangue de l'appli. */
export const CK_COVER = { bg: C.night, fg: '#F7F3EA', tag: C.mango, dot: C.mango, label: 'CKLabs',
  deco: <span aria-hidden="true" className="absolute rounded-full" style={{ width: 64, height: 64, background: C.mango, top: -22, right: -18 }} /> };

/** Le nom du journal dans une étiquette à sa couleur (voir utils/pressBrand.ts). */
export const BrandTag: React.FC<{ a: Article }> = ({ a }) => {
  const b = pressBrand(a.source, a.sourceColor);
  return (
    <span className="shrink min-w-0 truncate text-[10px] font-extrabold tracking-[.06em] uppercase px-[7px] py-[3px] rounded-md"
      style={{ background: b.bg, color: b.fg, boxShadow: b.bg === '#FFFFFF' ? `inset 0 0 0 1px ${C.border}` : undefined }}>{a.source || 'Presse'}</span>
  );
};
