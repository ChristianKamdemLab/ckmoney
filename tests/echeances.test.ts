import { describe, it, expect } from 'vitest';
import { installmentNote } from '../utils/echeances';
import { buildSchedule, computeSituation } from '../utils/schedule';
import type { Loan } from '../types';

describe('installmentNote : échéance entamée', () => {
  const money = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
  const loan = (payments: Loan['payments']): Loan => ({
    amount: 300, currency: 'EUR', interestRate: 0, repaymentType: 'monthly', lateRateMode: 'none', status: 'active',
    loanDate: '2026-11-01', repaymentDate: '2027-02-01', payments,
    schedule: buildSchedule({ amount: 300, annualRate: 0, loanDate: '2026-11-01', repaymentType: 'monthly', installments: 3, firstDueDate: '2026-12-01' }),
  } as unknown as Loan);
  const note = (...a: Parameters<typeof installmentNote>) => installmentNote(...a).replace(/\u00a0/g, ' ');
  const pay = (amount: number) => [{ id: 'p', date: '2026-11-15', amount, method: 'PayPal', status: 'confirmed' as const, declaredBy: 'borrower' as const, declaredAt: '2026-11-15' }];

  it('sans paiement : seulement la date relative', () => {
    const s = computeSituation(loan([]), 6.84, new Date(2026, 10, 19));
    expect(note(s.schedule[0], 'dans 12 jours', money)).toBe('dans 12 jours');
  });
  it('paiement partiel : indique le reste de l\'échéance', () => {
    const s = computeSituation(loan(pay(60)), 6.84, new Date(2026, 10, 19));
    expect(note(s.schedule[0], 'dans 12 jours', money)).toBe('dans 12 jours · reste 40,00 €');
    expect(note(s.schedule[1], 'dans 42 jours', money)).toBe('dans 42 jours');
  });
  it('en retard et entamée', () => {
    const s = computeSituation(loan(pay(60)), 6.84, new Date(2026, 11, 6));
    expect(note(s.schedule[0], '', money)).toBe('En retard de 5 j · reste 40,00 €');
  });
  it('le reste ne se coupe pas en fin de ligne', () => {
    const s = computeSituation(loan(pay(60)), 6.84, new Date(2026, 10, 19));
    expect(installmentNote(s.schedule[0], 'dans 12 jours', money)).toContain('reste\u00a040,00\u00a0€');
  });
  it('payée', () => {
    const s = computeSituation(loan(pay(100)), 6.84, new Date(2026, 10, 19));
    expect(note(s.schedule[0], 'dans 12 jours', money)).toBe('Payée');
  });
});
