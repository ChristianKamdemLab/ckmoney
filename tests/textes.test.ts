import { describe, it, expect } from 'vitest';
import { lateFeesDetail, lateTermsLabel, delayRequestMessage, dueAtSigning } from '../utils/wording';
import { buildSchedule, computeSituation } from '../utils/schedule';

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

describe('détail des frais de retard', () => {
  it('pénalité et intérêts : les deux sont cités', () => {
    expect(lateFeesDetail(15, 0.42, eur)).toBe("15,00 € de pénalité et 0,42 € d'intérêts de retard");
  });
  it('intérêts seuls : pas de « 0,00 € de pénalité »', () => {
    expect(lateFeesDetail(0, 0.42, eur)).toBe("0,42 € d'intérêts de retard");
  });
  it('pénalité seule : pas de « 0,00 € d’intérêts de retard »', () => {
    expect(lateFeesDetail(15, 0, eur)).toBe('15,00 € de pénalité');
  });
  it('aucun frais : rien à dire', () => {
    expect(lateFeesDetail(0, 0, eur)).toBe('');
  });
});

describe('résumé « si retard » du contrat', () => {
  it('ne dit jamais « aucune pénalité » quand une pénalité forfaitaire est prévue', () => {
    expect(lateTermsLabel('none', 0, 10)).toBe('Pénalité 10 %');
    expect(lateTermsLabel('legal', 6.84, 10)).toBe('Taux légal + pénalité 10 %');
    expect(lateTermsLabel('custom', 8, 5)).toBe('8 % / an + pénalité 5 %');
  });
  it('sans pénalité forfaitaire : comme avant', () => {
    expect(lateTermsLabel('none', 0, 0)).toBe('Aucune pénalité');
    expect(lateTermsLabel('legal', 6.84)).toBe('Taux légal');
    expect(lateTermsLabel('custom', 3.5, 0)).toBe('3,5 % / an');
    expect(lateTermsLabel(undefined, 5)).toBe('5 % / an');
  });
});

describe('demande de délai : message reçu par le prêteur', () => {
  it('avec une pénalité forfaitaire, le détail s’additionne jusqu’au total', () => {
    // 150 € échus le 5/11, pénalité de 10 %, report au 15/12 à 12 % par an (40 jours)
    const m = delayRequestMessage('Laura', '15/12/2026', { principal: 150, penalty: 15, interest: 1.97, total: 166.97 }, 12);
    expect(m).toBe("Laura propose de payer le 15/12/2026 : 150,00 € + 15,00 € de pénalité + 1,97 € d'intérêts de retard (12 %/an) = 166,97 €.");
  });
  it('sans pénalité : comme avant', () => {
    const m = delayRequestMessage('Sam', '20/12/2026', { principal: 400, interest: 5.26, total: 405.26 }, 6.84);
    expect(m).toBe("Sam propose de payer le 20/12/2026 : 400,00 € + 5,26 € d'intérêts de retard (6,84 %/an) = 405,26 €.");
    expect(delayRequestMessage('Sam', '20/12/2026', { principal: 400, penalty: 0, interest: 0, total: 400 })).not.toContain('pénalité');
  });
});

describe('contrat signé après l’échéance : ce qui est dû dès la signature', () => {
  // Cas réel du 12/11 : 150 € prévus le 5/11, pénalité de 10 %, taux légal, contrat signé une semaine après
  const loan: any = {
    amount: 150, currency: 'EUR', loanDate: '2026-10-05', repaymentDate: '2026-11-05', status: 'pending_borrower',
    lateRateMode: 'legal', penaltyRate: 10, payments: [],
    schedule: buildSchedule({ amount: 150, annualRate: 0, loanDate: '2026-10-05', repaymentType: 'in_fine', repaymentDate: '2026-11-05' }),
  };
  it('la pénalité et les intérêts courus s’ajoutent à la somme prêtée', () => {
    const s = computeSituation(loan, 6.84, new Date(2026, 10, 12));
    expect(s.penalty).toBe(15);
    expect(s.lateInterest).toBe(0.2); // 150 € × 6,84 % × 7 jours / 365
    expect(dueAtSigning(s).total).toBe(165.2);
    expect(dueAtSigning(s).total).toBe(s.totalDueNow);
  });
  it('échéance pas encore passée : rien de plus que la somme prêtée', () => {
    const s = computeSituation(loan, 6.84, new Date(2026, 10, 5));
    expect(lateFeesDetail(s.penalty, s.lateInterest, eur)).toBe('');
    expect(dueAtSigning(s).total).toBe(0);
  });
  it('prêt en plusieurs fois : seules les échéances passées comptent', () => {
    const monthly: any = { ...loan, amount: 300, schedule: buildSchedule({ amount: 300, annualRate: 0, loanDate: '2026-10-05', repaymentType: 'monthly', installments: 3, firstDueDate: '2026-11-05' }) };
    const s = computeSituation(monthly, 6.84, new Date(2026, 10, 12));
    expect(s.overdueAmount).toBe(100);
    expect(s.penalty).toBe(10);
    expect(dueAtSigning(s).total).toBe(Math.round((100 + 10 + s.lateInterest) * 100) / 100);
  });
});
