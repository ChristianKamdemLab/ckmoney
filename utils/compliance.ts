// Garde-fous fiscaux (formulaire 2062) et « monopole bancaire » (prêts habituels).
import { Loan } from '../types';
import { fetchExchangeRate } from '../services/exchangeRate';
import { DECLARATION_THRESHOLD_EUR } from '../config/legal';

export const borrowerKeyOf = (l: Loan) => (l.borrowerUid || l.borrowerPhone || l.borrowerNickname || l.borrowerName || '').trim().toLowerCase();

/** Cumul en euros des prêts déjà consentis à cet emprunteur pendant l'année civile. */
export const annualTotalsForBorrower = async (loans: Loan[], borrowerKey: string, year: number): Promise<number> => {
  if (!borrowerKey) return 0;
  const same = loans.filter(l =>
    borrowerKeyOf(l) === borrowerKey && l.status !== 'declined' &&
    parseInt((l.loanDate || '').slice(0, 4), 10) === year,
  );
  const values = await Promise.all(same.map(l => fetchExchangeRate(l.amount, l.currency)));
  return values.reduce((s, v) => s + v, 0);
};

/** Nombre de prêts consentis par ce prêteur sur les 12 derniers mois. */
export const loansInLast12Months = (loans: Loan[], lenderUid: string): number => {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  return loans.filter(l => l.lenderUid === lenderUid && ['active', 'paid', 'pending_borrower', 'delay_requested'].includes(l.status) && new Date(l.loanDate) >= since).length;
};

export interface DeclarationLine {
  year: number;
  borrowerName: string;
  borrowerEmail?: string;
  totalEur: number;
  loansCount: number;
  mustDeclare: boolean;
  declareBefore: string; // période de dépôt
}

/** Tableau des déclarations 2062 par année et par emprunteur (prêts dont l'utilisateur est le prêteur). */
export const declarationSummary = async (loans: Loan[], lenderUid: string): Promise<DeclarationLine[]> => {
  const mine = loans.filter(l => l.lenderUid === lenderUid && ['active', 'paid', 'delay_requested', 'repayment_pending'].includes(l.status));
  const groups = new Map<string, Loan[]>();
  for (const l of mine) {
    const year = (l.loanDate || '').slice(0, 4);
    const key = `${year}|${borrowerKeyOf(l)}`;
    groups.set(key, [...(groups.get(key) || []), l]);
  }
  const lines = await Promise.all(Array.from(groups.entries()).map(async ([key, group]) => {
    const year = parseInt(key.split('|')[0], 10);
    const values = await Promise.all(group.map(l => fetchExchangeRate(l.amount, l.currency)));
    const totalEur = values.reduce((s, v) => s + v, 0);
    return {
      year,
      borrowerName: group[0].borrowerNickname || group[0].borrowerName,
      borrowerEmail: group[0].borrowerEmail,
      totalEur,
      loansCount: group.length,
      mustDeclare: totalEur > DECLARATION_THRESHOLD_EUR,
      declareBefore: `avec la déclaration des revenus ${year}, au printemps ${year + 1}`,
    };
  }));
  return lines.sort((a, b) => b.year - a.year || b.totalEur - a.totalEur);
};
