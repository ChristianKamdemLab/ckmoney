import { describe, it, expect } from 'vitest';
import { lateFeesDetail, lateTermsLabel } from '../utils/wording';

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
