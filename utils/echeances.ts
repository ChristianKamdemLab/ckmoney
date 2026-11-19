import type { InstallmentStatus } from './schedule';

/**
 * Ligne d'état d'une échéance dans le détail d'un prêt.
 * Une échéance entamée (paiement partiel) indique ce qu'il en reste, sinon on croit que rien n'a été payé.
 * `when` : « dans 5 jours », « demain »… pour une échéance à venir.
 */
export const installmentNote = (i: InstallmentStatus, when: string, money: (n: number) => string) => {
  if (i.outstanding <= 0.004) return 'Payée';
  const base = i.isOverdue ? `En retard de ${i.daysLate} j` : when;
  // Espaces insécables : « reste 68,13 € » ne se coupe pas en fin de ligne.
  return i.paid > 0.004 ? `${base} · reste\u00a0${money(i.outstanding).replace(/ /g, '\u00a0')}` : base;
};
