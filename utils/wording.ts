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

/**
 * Message reçu par le prêteur quand un proche propose une nouvelle date. Le détail s'additionne
 * jusqu'au total : somme due, pénalité forfaitaire s'il y en a une, intérêts de retard.
 */
export const delayRequestMessage = (
  name: string, dateLabel: string,
  quote: { principal: number; interest: number; penalty?: number; total: number },
  lateRate = 0,
): string => {
  const eur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const penalty = (quote.penalty || 0) > 0.004 ? ` + ${eur(quote.penalty || 0)} de pénalité` : '';
  const rate = lateRate ? ` (${lateRate.toLocaleString('fr-FR')} %/an)` : '';
  return `${name} propose de payer le ${dateLabel} : ${eur(quote.principal)}${penalty} + ${eur(quote.interest)} d'intérêts de retard${rate} = ${eur(quote.total)}.`;
};

/**
 * Ce qui est dû dès la signature quand l'échéance est déjà passée (contrat signé en retard) :
 * la somme échue, la pénalité et les intérêts de retard déjà courus, et leur total.
 */
export const dueAtSigning = (s: { overdueAmount: number; penalty: number; lateInterest: number }) =>
  ({ total: Math.round((s.overdueAmount + s.penalty + s.lateInterest) * 100) / 100 });
