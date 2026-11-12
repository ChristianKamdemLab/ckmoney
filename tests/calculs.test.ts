import { describe, it, expect } from 'vitest';
import { computeSituation, buildSchedule } from '../utils/schedule';
import { isValidIban } from '../types';
import { rateCapFor, USURY_BRACKETS, LEGAL_INTEREST_RATE, PENALTY_MAX } from '../config/legal';
import { amountWordsMatch } from '../utils/frenchNumbers';
import { buildLoanContract } from '../utils/contract';

// Prêt de référence : 150 € versés le 29/10/2026, à rembourser en une fois le 05/11/2026.
const base: any = {
  amount: 150, currency: 'EUR', loanDate: '2026-10-29', lateRateMode: 'legal', status: 'active', payments: [],
  schedule: [{ index: 1, dueDate: '2026-11-05', amount: 150, principal: 150, interest: 0, remainingPrincipal: 0 }],
};
const at = (iso: string) => new Date(iso + 'T12:00:00');
const L = 6.84; // taux légal figé pour les tests, indépendant des mises à jour de config

describe('intérêts de retard', () => {
  it('rien de dû le jour de l’échéance', () => {
    const s = computeSituation(base, L, at('2026-11-05'));
    expect(s.isOverdue).toBe(false);
    expect(s.lateInterest).toBe(0);
  });
  it('taux légal, 15 jours de retard : 0,42 €', () => {
    const s = computeSituation(base, L, at('2026-11-20'));
    expect(s.isOverdue).toBe(true);
    expect(s.daysLate).toBe(15);
    expect(s.lateInterest).toBeCloseTo(0.42, 2);
  });
  it('aucun intérêt si l’option « rien » est choisie', () => {
    expect(computeSituation({ ...base, lateRateMode: 'none' }, L, at('2026-11-20')).lateInterest).toBe(0);
  });
  it('taux de report 15 % depuis l’échéance d’origine : 0,92 €', () => {
    const moved = { ...base, schedule: [{ ...base.schedule[0], dueDate: '2026-11-30', lateFrom: '2026-11-05', lateRate: 15 }] };
    const s = computeSituation(moved, L, at('2026-11-20'));
    expect(s.isOverdue).toBe(false);
    expect(s.lateInterest).toBeCloseTo(0.92, 2);
  });
  it('report sans maintien des intérêts : rien avant la nouvelle date', () => {
    const moved = { ...base, schedule: [{ ...base.schedule[0], dueDate: '2026-11-30' }] };
    expect(computeSituation(moved, L, at('2026-11-20')).lateInterest).toBe(0);
  });
});

describe('pénalité forfaitaire (clause pénale)', () => {
  const pen = { ...base, penaltyRate: 10 };
  it('due une fois dès le lendemain de l’échéance', () => {
    expect(computeSituation(pen, L, at('2026-11-05')).penalty).toBe(0);
    expect(computeSituation(pen, L, at('2026-11-06')).penalty).toBe(15);
    const s = computeSituation(pen, L, at('2026-11-20'));
    expect(s.penalty).toBe(15);
    expect(s.totalDueNow).toBeCloseTo(165.42, 2);
  });
  it('pas de pénalité si payé à l’échéance', () => {
    const s = computeSituation({ ...pen, payments: [{ id: 'p', amount: 150, date: '2026-11-05', status: 'confirmed' }] }, L, at('2026-11-20'));
    expect(s.penalty).toBe(0);
    expect(s.isFullyPaid).toBe(true);
  });
  it('un paiement couvre d’abord intérêts et pénalité, puis le capital', () => {
    const s = computeSituation({ ...pen, payments: [{ id: 'p', amount: 50, date: '2026-11-20', status: 'confirmed' }] }, L, at('2026-11-20'));
    expect(s.lateInterest).toBe(0);
    expect(s.penalty).toBe(0);
    expect(s.outstanding).toBeCloseTo(150 - (50 - 15 - 0.42), 2);
  });
  it('soldé quand tout est payé', () => {
    const s = computeSituation({ ...pen, payments: [{ id: 'p', amount: 165.42, date: '2026-11-20', status: 'confirmed' }] }, L, at('2026-11-20'));
    expect(s.isFullyPaid).toBe(true);
  });
  it('plafond de l’appli : 10 %', () => expect(PENALTY_MAX).toBe(10));
});

describe('échéancier', () => {
  it('la somme des échéances égale capital + intérêts', () => {
    const sch = buildSchedule({ amount: 600, annualRate: 5, loanDate: '2026-11-11', repaymentType: 'monthly', installments: 3, firstDueDate: '2026-12-11' });
    expect(sch).toHaveLength(3);
    const total = sch.reduce((a, i) => a + i.amount, 0);
    const principal = sch.reduce((a, i) => a + i.principal, 0);
    expect(principal).toBeCloseTo(600, 2);
    expect(total).toBeGreaterThan(600);
    expect(sch[2].remainingPrincipal).toBe(0);
  });
  it('sans intérêt en une fois : le montant exact', () => {
    const sch = buildSchedule({ amount: 150, annualRate: 0, loanDate: '2026-10-29', repaymentType: 'in_fine', repaymentDate: '2026-11-05' });
    expect(sch[0].amount).toBe(150);
  });
});

describe('plafonds légaux', () => {
  it('seuil de l’usure selon le montant', () => {
    expect(rateCapFor(150)).toBe(USURY_BRACKETS[0].rate);
    expect(rateCapFor(4000)).toBe(USURY_BRACKETS[1].rate);
    expect(rateCapFor(10000)).toBe(USURY_BRACKETS[2].rate);
    expect(rateCapFor(150, 'XAF')).toBe(USURY_BRACKETS[2].rate);
  });
  it('les seuils sont décroissants et plausibles', () => {
    expect(USURY_BRACKETS[0].rate).toBeGreaterThan(USURY_BRACKETS[1].rate);
    expect(USURY_BRACKETS[1].rate).toBeGreaterThan(USURY_BRACKETS[2].rate);
    expect(LEGAL_INTEREST_RATE).toBeGreaterThan(0);
    expect(LEGAL_INTEREST_RATE).toBeLessThan(USURY_BRACKETS[2].rate);
  });
});

describe('contrôles de saisie', () => {
  it('IBAN : clé de contrôle', () => {
    expect(isValidIban('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
    expect(isValidIban('FR76 3000 6000 0112 3456 7890 188')).toBe(false);
    expect(isValidIban('pas un iban')).toBe(false);
  });
  it('montant en lettres (art. 1376 du Code civil)', () => {
    expect(amountWordsMatch('cent cinquante euros', 150)).toBe(true);
    expect(amountWordsMatch('mille euros', 1000)).toBe(true);
    expect(amountWordsMatch('cent euros', 150)).toBe(false);
  });
});

describe('contrat', () => {
  const contrat = buildLoanContract({
    ...base, lenderCivility: 'M.', lenderName: 'Prêteur Test', lenderBirthDate: '1990-01-01', lenderBirthPlace: 'Paris, France', lenderAddress: '1 rue A',
    borrowerCivility: 'M.', borrowerName: 'Ami Test', borrowerBirthDate: '1990-01-01', borrowerBirthPlace: 'Paris, France', borrowerAddress: '2 rue B',
    repaymentDate: '2026-11-05', interestRate: 0, repaymentType: 'in_fine', lateInterestRate: 0, city: 'Paris', penaltyRate: 10, delayRate: 15,
  } as any);
  it('mentionne la pénalité et le taux de report', () => {
    expect(contrat).toContain('pénalité forfaitaire égale à 10 %');
    expect(contrat).toContain('taux de report de 15 %');
  });
  it('mentionne le montant en lettres', () => expect(contrat.toLowerCase()).toContain('cent cinquante euros'));
});
