// Échéancier, intérêts conventionnels, suivi des paiements et intérêts de retard.
import { Loan, Payment } from '../types';

export interface Installment {
  index: number;      // 1..n
  dueDate: string;    // YYYY-MM-DD
  amount: number;     // montant de l'échéance
  principal: number;  // part de capital
  interest: number;   // part d'intérêts
  remainingPrincipal: number; // capital restant dû après l'échéance
  lateFrom?: string;  // échéance d'origine si un report a été accordé en maintenant les intérêts de retard
  lateRate?: number;  // taux de retard (% par an) convenu lors d'un report, à la place du taux du contrat
}

export interface InstallmentStatus extends Installment {
  paid: number;       // montant affecté à cette échéance (paiements confirmés)
  outstanding: number;
  isOverdue: boolean;
  daysLate: number;
}

export interface LoanSituation {
  schedule: InstallmentStatus[];
  totalScheduled: number;    // capital + intérêts conventionnels
  totalInterest: number;     // intérêts conventionnels
  confirmedPaid: number;     // paiements confirmés par le prêteur
  pendingDeclared: number;   // paiements déclarés, en attente de confirmation
  outstanding: number;       // reste dû hors intérêts de retard
  overdueAmount: number;     // montant des échéances échues impayées
  lateInterest: number;      // intérêts de retard courus
  penalty: number;           // pénalité forfaitaire de retard restant due (clause pénale)
  totalDueNow: number;       // reste dû + intérêts de retard
  nextInstallment: InstallmentStatus | null;
  daysLate: number;          // retard de l'échéance impayée la plus ancienne
  isOverdue: boolean;
  isFullyPaid: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Parse « YYYY-MM-DD » en date locale (évite les décalages de fuseau). */
export const parseISODate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Ajoute n mois en gardant le jour, borné à la fin du mois (31 janv. + 1 mois = 28/29 févr.). */
export const addMonths = (iso: string, n: number) => {
  const d = parseISODate(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISODate(target);
};

export const daysBetween = (fromISO: string, toISO: string) =>
  Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86_400_000);

/**
 * Construit l'échéancier.
 * - in fine : une seule échéance à `repaymentDate`, intérêts simples au prorata (exact/365).
 * - mensuel : `installments` mensualités constantes à partir de `firstDueDate`,
 *   intérêts au taux mensuel (taux annuel / 12) ; à 0 %, capital réparti à parts égales.
 */
export const buildSchedule = (params: {
  amount: number;
  annualRate: number;
  loanDate: string;
  repaymentType: 'in_fine' | 'monthly';
  repaymentDate?: string;
  installments?: number;
  firstDueDate?: string;
}): Installment[] => {
  const { amount, annualRate, loanDate } = params;
  const rate = Math.max(0, annualRate || 0) / 100;

  if (params.repaymentType !== 'monthly' || !params.installments || params.installments <= 1) {
    const due = params.repaymentDate || params.firstDueDate || loanDate;
    const days = Math.max(0, daysBetween(loanDate, due));
    const interest = round2(amount * rate * days / 365);
    return [{
      index: 1, dueDate: due, amount: round2(amount + interest),
      principal: round2(amount), interest, remainingPrincipal: 0,
    }];
  }

  const n = Math.floor(params.installments);
  const first = params.firstDueDate || addMonths(loanDate, 1);
  const monthly = rate / 12;
  const payment = monthly === 0
    ? amount / n
    : (amount * monthly) / (1 - Math.pow(1 + monthly, -n));

  const out: Installment[] = [];
  let remaining = amount;
  for (let i = 1; i <= n; i++) {
    const interest = round2(remaining * monthly);
    let principal = round2(payment - interest);
    if (i === n) principal = round2(remaining); // la dernière échéance solde les arrondis
    remaining = round2(remaining - principal);
    out.push({
      index: i,
      dueDate: addMonths(first, i - 1),
      amount: round2(principal + interest),
      principal,
      interest,
      remainingPrincipal: Math.max(0, remaining),
    });
  }
  return out;
};

export const scheduleForLoan = (loan: Loan): Installment[] =>
  loan.schedule && loan.schedule.length > 0
    ? loan.schedule
    : buildSchedule({
        amount: loan.amount,
        annualRate: loan.interestRate || 0,
        loanDate: loan.loanDate,
        repaymentType: 'in_fine',
        repaymentDate: loan.repaymentDate,
      });

/** Taux de retard effectif (% annuel) selon l'option choisie au contrat. */
export const effectiveLateRate = (loan: Loan, legalRate: number): number => {
  if (loan.lateRateMode === 'none') return 0;
  if (loan.lateRateMode === 'legal') return legalRate;
  return loan.lateInterestRate || 0; // 'custom' ou anciens prêts
};

/**
 * Situation du prêt à une date donnée.
 * Les paiements confirmés s'imputent d'abord sur les intérêts de retard,
 * puis sur les échéances les plus anciennes (C. civ. art. 1343-1 et 1342-10).
 * Simplification : les intérêts de retard courent jour par jour sur chaque
 * échéance échue, jusqu'à son paiement complet.
 */
export const computeSituation = (loan: Loan, legalRate: number, today: Date = new Date()): LoanSituation => {
  const todayISO = toISODate(today);
  const base = scheduleForLoan(loan);
  const payments: Payment[] = (loan.payments || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const confirmed = payments.filter(p => p.status === 'confirmed');
  const pendingDeclared = round2(payments.filter(p => p.status === 'declared').reduce((s, p) => s + p.amount, 0));
  const lateRate = effectiveLateRate(loan, legalRate) / 100;

  // Anciens prêts marqués « paid » sans paiements enregistrés
  if (loan.status === 'paid' && confirmed.length === 0) {
    const total = round2(base.reduce((s, i) => s + i.amount, 0));
    const schedule = base.map(i => ({ ...i, paid: i.amount, outstanding: 0, isOverdue: false, daysLate: 0 }));
    return {
      schedule, totalScheduled: total, totalInterest: round2(base.reduce((s, i) => s + i.interest, 0)),
      confirmedPaid: total, pendingDeclared: 0, outstanding: 0, overdueAmount: 0, lateInterest: 0, penalty: 0,
      totalDueNow: 0, nextInstallment: null, daysLate: 0, isOverdue: false, isFullyPaid: true,
    };
  }

  // Simulation chronologique : on rejoue les paiements dans l'ordre.
  const remaining = base.map(i => i.amount);
  let accruedLate = 0;
  // Pénalité forfaitaire (clause pénale) : due une fois par échéance non payée à sa date d'origine.
  const penaltyRate = Math.max(0, loan.penaltyRate || 0) / 100;
  const penaltyDone = base.map(() => false);
  let accruedPenalty = 0;
  // Les intérêts de retard courent depuis l'échéance d'origine si un report les a maintenus.
  const lateStart = base.map(i => i.lateFrom && i.lateFrom < i.dueDate ? i.lateFrom : i.dueDate);
  let lastAccrual = base.length ? lateStart.reduce((a, b) => (a < b ? a : b)) : todayISO;

  const accrueUntil = (dateISO: string) => {
    if (lateRate <= 0 && !base.some(i => (i.lateRate || 0) > 0)) { lastAccrual = dateISO; return; }
    // Somme des échéances échues et impayées, jour par jour (par segments).
    const from = lastAccrual < dateISO ? lastAccrual : dateISO;
    const dueDates = lateStart.filter(d => d > from && d < dateISO);
    const cuts = [from, ...dueDates, dateISO];
    for (let k = 0; k < cuts.length - 1; k++) {
      const segStart = cuts[k];
      const segEnd = cuts[k + 1];
      const days = daysBetween(segStart, segEnd);
      if (days <= 0) continue;
      // Chaque échéance porte le taux du contrat, ou celui convenu lors d'un report.
      const weighted = base.reduce((s, inst, idx) => (lateStart[idx] <= segStart ? s + remaining[idx] * (inst.lateRate != null ? inst.lateRate / 100 : lateRate) : s), 0);
      accruedLate += weighted * days / 365;
    }
    lastAccrual = dateISO;
  };

  const applyPenalties = (dateISO: string) => {
    if (penaltyRate <= 0) return;
    base.forEach((_inst, idx) => {
      if (!penaltyDone[idx] && lateStart[idx] < dateISO) {
        penaltyDone[idx] = true;
        if (remaining[idx] > 0.004) accruedPenalty += round2(remaining[idx] * penaltyRate);
      }
    });
  };

  for (const p of confirmed) {
    const pDate = p.date.slice(0, 10);
    accrueUntil(pDate);
    applyPenalties(pDate);
    let amount = p.amount;
    const toLate = Math.min(amount, accruedLate);
    accruedLate -= toLate;
    amount -= toLate;
    const toPenalty = Math.min(amount, accruedPenalty);
    accruedPenalty -= toPenalty;
    amount -= toPenalty;
    for (let idx = 0; idx < remaining.length && amount > 0.004; idx++) {
      const take = Math.min(amount, remaining[idx]);
      remaining[idx] = round2(remaining[idx] - take);
      amount -= take;
    }
  }
  if (todayISO > lastAccrual) accrueUntil(todayISO);
  applyPenalties(todayISO);

  const schedule: InstallmentStatus[] = base.map((inst, idx) => {
    const outstanding = round2(Math.max(0, remaining[idx]));
    const isOverdue = outstanding > 0.004 && inst.dueDate < todayISO;
    return {
      ...inst,
      paid: round2(inst.amount - outstanding),
      outstanding,
      isOverdue,
      daysLate: isOverdue ? daysBetween(inst.dueDate, todayISO) : 0,
    };
  });

  const outstanding = round2(schedule.reduce((s, i) => s + i.outstanding, 0));
  const overdueList = schedule.filter(i => i.isOverdue);
  const lateInterest = round2(accruedLate);
  const penalty = round2(accruedPenalty);
  const totalScheduled = round2(base.reduce((s, i) => s + i.amount, 0));
  return {
    schedule,
    totalScheduled,
    totalInterest: round2(base.reduce((s, i) => s + i.interest, 0)),
    confirmedPaid: round2(confirmed.reduce((s, p) => s + p.amount, 0)),
    pendingDeclared,
    outstanding,
    overdueAmount: round2(overdueList.reduce((s, i) => s + i.outstanding, 0)),
    lateInterest,
    penalty,
    totalDueNow: round2(outstanding + lateInterest + penalty),
    nextInstallment: schedule.find(i => i.outstanding > 0.004) || null,
    daysLate: overdueList.length ? overdueList[0].daysLate : 0,
    isOverdue: overdueList.length > 0,
    isFullyPaid: outstanding <= 0.004 && lateInterest <= 0.004 && penalty <= 0.004,
  };
};

export const formatMoney = (n: number, currency: string) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
