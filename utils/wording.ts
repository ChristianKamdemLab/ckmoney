// Petites phrases partagées entre les écrans, pour dire la même chose partout.

/**
 * Détail des frais de retard réellement dus, par exemple
 * « 15,00 € de pénalité et 0,42 € d'intérêts de retard ».
 * Un frais nul n'est pas cité ; chaîne vide s'il n'y en a aucun.
 */
export const lateFeesDetail = (penalty: number, lateInterest: number, money: (n: number) => string): string =>
  [
    penalty > 0.004 ? `${money(penalty)} de pénalité` : '',
    lateInterest > 0.004 ? `${money(lateInterest)} d'intérêts de retard` : '',
  ].filter(Boolean).join(' et ');

/**
 * Ce qu'un prêt prévoit en cas de retard, en quelques mots : intérêts de retard
 * et pénalité forfaitaire sont deux choses distinctes, on cite celles qui existent.
 */
export const lateTermsLabel = (mode: 'none' | 'legal' | 'custom' | undefined, lateRate: number, penaltyRate = 0): string => {
  const pct = (n: number) => n.toLocaleString('fr-FR');
  const interest = mode === 'none' ? '' : mode === 'legal' ? 'Taux légal' : `${pct(lateRate)} % / an`;
  if (!(penaltyRate > 0)) return interest || 'Aucune pénalité';
  return interest ? `${interest} + pénalité ${pct(penaltyRate)} %` : `Pénalité ${pct(penaltyRate)} %`;
};
