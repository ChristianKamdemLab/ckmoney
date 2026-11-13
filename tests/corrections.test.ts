import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeSituation, buildSchedule } from '../utils/schedule';

// Corrections du prêteur : paiement confirmé par erreur (annulé) et frais de retard abandonnés.

const schedule = buildSchedule({ amount: 150, annualRate: 0, loanDate: '2026-10-29', repaymentType: 'in_fine', repaymentDate: '2026-11-05' });
const loan = (payments: any[], extra: any = {}) => ({
  id: 'pm', status: 'active', lenderUid: 'chris', borrowerUid: 'pm', amount: 150, currency: 'EUR', loanDate: '2026-10-29', repaymentDate: '2026-11-05',
  schedule, interestRate: 0, lateRateMode: 'legal', penaltyRate: 10, payments, createdAt: '2026-11-11', ...extra,
}) as any;
const pay = (id: string, amount: number, status = 'confirmed') => ({ id, amount, status, date: '2026-11-13', method: 'PayPal', declaredBy: 'borrower', declaredAt: '2026-11-13' });
const day = new Date('2026-11-13T12:00:00');

describe('calcul', () => {
  it('un paiement annulé ne compte plus', () => {
    const s = computeSituation(loan([pay('a', 150), pay('b', 165.22, 'cancelled')]), 6.84, day);
    expect(s.confirmedPaid).toBe(150);
    expect(s.isFullyPaid).toBe(false);
    // Le paiement s'impute d'abord sur les frais de retard : il reste 15,22 € de capital
    expect(s.totalDueNow).toBeCloseTo(15.22, 1);
  });
  it('frais de retard abandonnés : 150 € suffisent', () => {
    const s = computeSituation(loan([pay('a', 150), pay('b', 165.22, 'cancelled')], { lateFeesWaivedAt: '2026-11-13' }), 6.84, day);
    expect(s.penalty).toBe(0);
    expect(s.lateInterest).toBe(0);
    expect(s.totalDueNow).toBe(0);
    expect(s.isFullyPaid).toBe(true);
  });
  it('sans abandon, les frais restent dus', () => {
    const s = computeSituation(loan([]), 6.84, day);
    expect(s.penalty).toBe(15);
    expect(s.lateInterest).toBeGreaterThan(0.2);
  });
});

// Serveur (api/remind) : seules les corrections du prêteur de ce prêt passent
const store = new Map<string, any>();
const ref = (path: string): any => ({
  path, get: async () => ({ exists: store.has(path), id: path.split('/').pop(), data: () => store.get(path) }),
  set: async (d: any, o?: any) => { store.set(path, o?.merge ? { ...store.get(path), ...d } : d); },
  collection: (c: string) => ({ doc: (id: string) => ref(`${path}/${c}/${id}`), get: async () => ({ docs: [] }) }),
});
let caller: any = { uid: 'chris', email: 'chris@example.com', email_verified: true };
vi.mock('../api/_lib/admin.js', () => ({
  adminAuth: { verifyIdToken: async () => caller },
  adminDb: { collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`), add: async () => undefined }) },
  pushToUser: async () => 0, verifiedEmail: async () => null,
  isAllowedLender: (e?: string, v = true) => v && e === 'chris@example.com',
}));
vi.mock('../api/_lib/mail.js', () => ({ sendReminderMail: async () => false }));
const handler = (await import('../api/remind')).default;
const call = async (body: any) => {
  let status = 0, json: any = null;
  const res: any = { status: (n: number) => { status = n; return res; }, json: (j: any) => { json = j; return res; }, end: () => res };
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body }, res);
  return { status, json };
};

describe('api/remind : corrections', () => {
  beforeEach(() => {
    store.clear();
    caller = { uid: 'chris', email: 'chris@example.com', email_verified: true };
    store.set('loans/pm', { lenderUid: 'chris', borrowerUid: 'pm', status: 'paid' });
    store.set('loans/pm/payments/b', { amount: 165.22, status: 'confirmed' });
    store.set('loans/pm/payments/d', { amount: 10, status: 'declared' });
  });
  it('le prêteur annule un paiement confirmé, gardé dans l’historique', async () => {
    expect((await call({ action: 'cancelPayment', loanId: 'pm', paymentId: 'b' })).status).toBe(200);
    expect(store.get('loans/pm/payments/b')).toMatchObject({ amount: 165.22, status: 'cancelled' });
  });
  it('pas un paiement seulement déclaré, ni un paiement inconnu', async () => {
    expect((await call({ action: 'cancelPayment', loanId: 'pm', paymentId: 'd' })).status).toBe(409);
    expect((await call({ action: 'cancelPayment', loanId: 'pm', paymentId: 'zz' })).status).toBe(409);
  });
  it('le prêteur renonce aux frais de retard', async () => {
    expect((await call({ action: 'waiveFees', loanId: 'pm' })).status).toBe(200);
    expect(store.get('loans/pm').lateFeesWaivedAt).toBeTruthy();
  });
  it('personne d’autre : ni l’emprunteur, ni un autre compte', async () => {
    caller = { uid: 'pm', email: 'pm@example.com', email_verified: true };
    expect((await call({ action: 'waiveFees', loanId: 'pm' })).status).toBe(403);
    expect((await call({ action: 'cancelPayment', loanId: 'pm', paymentId: 'b' })).status).toBe(403);
    expect(store.get('loans/pm/payments/b').status).toBe('confirmed');
    expect(store.get('loans/pm').lateFeesWaivedAt).toBeUndefined();
  });
});
