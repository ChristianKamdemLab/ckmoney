import { describe, it, expect } from 'vitest';
import { openLoanWith, blockedReason, requestTargets } from '../utils/requests';
import { buildSchedule } from '../utils/schedule';

// Demandes directes : une seule à la fois entre un proche et un prêteur.

const schedule = buildSchedule({ amount: 100, annualRate: 0, loanDate: '2099-01-01', repaymentType: 'in_fine', repaymentDate: '2099-02-01' });
const L = (id: string, status: string, extra: any = {}) => ({
  id, status, borrowerUid: 'ami', lenderUid: 'chris', amount: 100, currency: 'EUR', loanDate: '2099-01-01', repaymentDate: '2099-02-01',
  schedule, interestRate: 0, lateRateMode: 'legal', payments: [], createdAt: '2099-01-01', ...extra,
}) as any;

describe('une demande à la fois', () => {
  it('libre quand rien n’est en cours (ou tout est terminé, refusé)', () => {
    expect(openLoanWith([], 'ami', 'chris')).toBeNull();
    expect(openLoanWith([L('a', 'paid'), L('b', 'declined')], 'ami', 'chris')).toBeNull();
  });
  it('bloquée par une demande en attente, une offre à signer ou un prêt pas remboursé', () => {
    expect(openLoanWith([L('a', 'requested')], 'ami', 'chris')?.id).toBe('a');
    expect(openLoanWith([L('a', 'pending_borrower')], 'ami', 'chris')?.id).toBe('a');
    expect(openLoanWith([L('a', 'active')], 'ami', 'chris')?.id).toBe('a');
    expect(openLoanWith([L('a', 'delay_requested')], 'ami', 'chris')?.id).toBe('a');
  });
  it('un prêt entièrement payé ne bloque plus, même avant d’être classé « remboursé »', () => {
    const paid = L('a', 'active', { payments: [{ id: 'p', amount: 100, date: '2099-01-15', status: 'confirmed', declaredBy: 'borrower' }] });
    expect(openLoanWith([paid], 'ami', 'chris')).toBeNull();
  });
  it('ne regarde que ce proche et ce prêteur ; ignore la demande examinée', () => {
    expect(openLoanWith([L('a', 'active', { borrowerUid: 'autre' })], 'ami', 'chris')).toBeNull();
    expect(openLoanWith([L('a', 'active', { lenderUid: 'autre' })], 'ami', 'chris')).toBeNull();
    expect(openLoanWith([L('a', 'requested')], 'ami', 'chris', 'a')).toBeNull();
  });
  it('dit pourquoi, avec le prénom du prêteur', () => {
    expect(blockedReason(L('a', 'requested'), 'Christian')).toContain('Christian va l');
    expect(blockedReason(L('a', 'pending_borrower'), 'Christian')).toContain('Christian t');
    expect(blockedReason(L('a', 'active'), 'Christian')).toContain('remboursé');
  });
});

describe('à qui faire une demande', () => {
  it('seulement ses prêteurs : prêt, demande ou lien ouvert ; jamais soi-même ni un inconnu', () => {
    expect(requestTargets([], 'ami')).toEqual([]);
    expect(requestTargets([L('a', 'paid')], 'ami')).toEqual(['chris']);
    expect(requestTargets([L('a', 'declined', { lenderUid: 'marie' })], 'ami', ['chris', 'chris'])).toEqual(['marie', 'chris']);
    expect(requestTargets([L('a', 'active', { borrowerUid: 'autre', lenderUid: 'ami' })], 'ami', ['ami'])).toEqual([]);
  });
});
