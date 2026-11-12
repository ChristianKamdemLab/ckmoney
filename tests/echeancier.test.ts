import { describe, it, expect } from 'vitest';
import { computeSituation, buildSchedule, addMonths, daysBetween } from '../utils/schedule';
import { amountToFrenchWords, amountWordsMatch } from '../utils/frenchNumbers';

// Compléments aux calculs de tests/calculs.test.ts : dates de fin de mois, arrondis,
// prêts en plusieurs échéances et mention du montant en lettres.
const at = (iso: string) => new Date(iso + 'T12:00:00');
const L = 6.84;

describe('dates', () => {
  it('ajout de mois borné à la fin du mois', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-11-12', 3)).toBe('2027-02-12');
  });
  it('nombre de jours entre deux dates, changement d’heure compris', () => {
    expect(daysBetween('2026-10-20', '2026-10-30')).toBe(10); // passage à l'heure d'hiver le 25/10
    expect(daysBetween('2026-03-25', '2026-04-01')).toBe(7);  // passage à l'heure d'été le 29/03
    expect(daysBetween('2026-11-05', '2026-11-05')).toBe(0);
  });
});

describe('échéancier mensuel', () => {
  it('sans intérêt : les centimes d’arrondi vont sur la dernière échéance', () => {
    const s = buildSchedule({ amount: 100, annualRate: 0, loanDate: '2026-11-12', repaymentType: 'monthly', installments: 3, firstDueDate: '2026-12-12' });
    expect(s.map(i => i.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(s.map(i => i.dueDate)).toEqual(['2026-12-12', '2027-01-12', '2027-02-12']);
    expect(s[2].remainingPrincipal).toBe(0);
  });
  it('avec intérêts : le capital remboursé égale exactement la somme prêtée', () => {
    for (const [amount, rate, n] of [[1000, 23.6, 6], [1250.5, 5, 6], [333.33, 8.56, 12], [50, 15.76, 2]] as const) {
      const s = buildSchedule({ amount, annualRate: rate, loanDate: '2026-11-12', repaymentType: 'monthly', installments: n, firstDueDate: '2026-12-12' });
      expect(s).toHaveLength(n);
      expect(Math.round(s.reduce((a, i) => a + i.principal, 0) * 100)).toBe(Math.round(amount * 100));
      expect(s[n - 1].remainingPrincipal).toBe(0);
      s.forEach(i => expect(Math.round(i.amount * 100)).toBe(Math.round((i.principal + i.interest) * 100)));
    }
  });
  it('première échéance un 31 : les suivantes tombent en fin de mois', () => {
    const s = buildSchedule({ amount: 300, annualRate: 0, loanDate: '2026-12-15', repaymentType: 'monthly', installments: 3, firstDueDate: '2027-01-31' });
    expect(s.map(i => i.dueDate)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });
  it('en une fois avec intérêts : prorata exact/365', () => {
    const s = buildSchedule({ amount: 1000, annualRate: 5, loanDate: '2026-01-01', repaymentType: 'in_fine', repaymentDate: '2027-01-01' });
    expect(s[0].interest).toBe(50);
    expect(s[0].amount).toBe(1050);
  });
});

describe('prêt en plusieurs échéances', () => {
  // 300 € en 3 × 100 € (1er sept., 1er oct., 1er nov. 2026), pénalité de 10 %, retard au taux légal.
  const schedule = buildSchedule({ amount: 300, annualRate: 0, loanDate: '2026-08-01', repaymentType: 'monthly', installments: 3, firstDueDate: '2026-09-01' });
  const loan: any = { amount: 300, currency: 'EUR', loanDate: '2026-08-01', lateRateMode: 'legal', status: 'active', schedule, penaltyRate: 10, payments: [] };
  const pay = (amount: number, date: string, status = 'confirmed') => ({ id: date + amount, amount, date, status });

  it('seules les échéances déjà dépassées sont en retard', () => {
    const s = computeSituation(loan, L, at('2026-10-15'));
    expect(s.overdueAmount).toBe(200);
    expect(s.outstanding).toBe(300);
    expect(s.daysLate).toBe(44); // depuis le 1er septembre
    expect(s.penalty).toBe(20);  // 10 % de chacune des deux échéances manquées
    expect(s.nextInstallment?.dueDate).toBe('2026-09-01');
    // 100 € × 6,84 % × 44 j + 100 € × 6,84 % × 14 j, sur 365 jours
    expect(s.lateInterest).toBeCloseTo(100 * 0.0684 * (44 + 14) / 365, 2);
  });
  it('un paiement en retard règle d’abord intérêts et pénalité, puis l’échéance la plus ancienne', () => {
    const s = computeSituation({ ...loan, payments: [pay(100, '2026-09-01'), pay(50, '2026-10-10')] }, L, at('2026-10-10'));
    const interest = 100 * 0.0684 * 9 / 365; // 2e échéance, du 1er au 10 octobre
    expect(s.schedule[0].outstanding).toBe(0);
    expect(s.penalty).toBe(0);
    expect(s.lateInterest).toBe(0);
    expect(s.schedule[1].outstanding).toBeCloseTo(100 - (50 - 10 - interest), 2);
    expect(s.schedule[2].outstanding).toBe(100);
  });
  it('tout payé en avance : ni retard ni pénalité ensuite', () => {
    const s = computeSituation({ ...loan, payments: [pay(300, '2026-08-15')] }, L, at('2026-11-12'));
    expect(s.isFullyPaid).toBe(true);
    expect(s.isOverdue).toBe(false);
    expect(s.penalty).toBe(0);
    expect(s.totalDueNow).toBe(0);
  });
  it('un paiement déclaré mais pas encore confirmé ne réduit pas la dette', () => {
    const s = computeSituation({ ...loan, payments: [pay(100, '2026-09-01', 'declared')] }, L, at('2026-09-01'));
    expect(s.pendingDeclared).toBe(100);
    expect(s.confirmedPaid).toBe(0);
    expect(s.outstanding).toBe(300);
  });
  it('un paiement refusé est ignoré', () => {
    const s = computeSituation({ ...loan, payments: [pay(100, '2026-09-01', 'rejected')] }, L, at('2026-09-01'));
    expect(s.pendingDeclared).toBe(0);
    expect(s.outstanding).toBe(300);
  });
  it('ancien prêt sans échéancier : une échéance à la date de remboursement', () => {
    const s = computeSituation({ amount: 200, currency: 'EUR', loanDate: '2026-01-01', repaymentDate: '2026-06-01', status: 'active', lateInterestRate: 5 } as any, L, at('2026-11-12'));
    expect(s.schedule).toHaveLength(1);
    expect(s.daysLate).toBe(164);
    expect(s.lateInterest).toBeCloseTo(200 * 0.05 * 164 / 365, 2);
  });
});

describe('montant en lettres', () => {
  it('la mention proposée par l’appli est toujours acceptée (de 0,01 € à 3 000 €)', () => {
    const refused: string[] = [];
    for (let cents = 1; cents <= 300000; cents++) {
      const amount = cents / 100;
      const words = amountToFrenchWords(amount, 'EUR');
      if (!amountWordsMatch(words, amount)) refused.push(`${amount} : ${words}`);
    }
    expect(refused).toEqual([]);
  });
  it('écritures courantes acceptées', () => {
    expect(amountWordsMatch('Cent cinquante euros', 150)).toBe(true);
    expect(amountWordsMatch('cent cinquante', 150)).toBe(true);
    expect(amountWordsMatch('quatre-vingts euros', 80)).toBe(true);
    expect(amountWordsMatch('quatre vingt euros', 80)).toBe(true);
    expect(amountWordsMatch('soixante et onze euros', 71)).toBe(true);
    expect(amountWordsMatch('mille cinq cents euros', 1500)).toBe(true);
    expect(amountWordsMatch('vingt et un euros et cinquante centimes', 21.5)).toBe(true);
  });
  it('centimes dits sans le mot « centimes », symbole € et cents du dollar', () => {
    expect(amountWordsMatch('vingt et un euros cinquante', 21.5)).toBe(true);
    expect(amountWordsMatch('zéro euro cinquante', 0.5)).toBe(true);
    expect(amountWordsMatch('cent cinquante €', 150)).toBe(true);
    expect(amountWordsMatch('cent euros cinquante', 150)).toBe(false); // 100,50 € et non 150 €
    expect(amountWordsMatch('cent euros cinquante', 100.5)).toBe(true);
    for (const cur of ['USD', 'CAD', 'CHF', 'GBP']) for (const a of [1, 1.01, 21.5, 200, 1500.5, 2000000]) {
      expect(amountWordsMatch(amountToFrenchWords(a, cur), a), `${a} ${cur}`).toBe(true);
    }
    expect(amountWordsMatch('deux cents dollars', 200)).toBe(true);
    expect(amountWordsMatch('mille francs CFA', 1000)).toBe(true);
    expect(amountWordsMatch("un million d'euros", 1000000)).toBe(true);
    expect(amountWordsMatch('Bon pour la somme de cent cinquante euros', 150)).toBe(true);
  });
  it('un montant en chiffres ou approximatif est refusé', () => {
    expect(amountWordsMatch('150 euros', 150)).toBe(false);
    expect(amountWordsMatch('cent cinquante euros', 150.5)).toBe(false);
    expect(amountWordsMatch('', 150)).toBe(false);
  });
});
