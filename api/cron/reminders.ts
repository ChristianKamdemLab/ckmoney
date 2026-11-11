import { adminDb, pushToUser } from '../_lib/admin.js';
import { computeSituation, daysBetween } from '../../utils/schedule.js';
import { LEGAL_INTEREST_RATE } from '../../config/legal.js';

// Tâche quotidienne (Vercel Cron, gratuit) : rappels d'échéance et de retard.
// Proche : la veille, le jour J, puis 1, 3 et 7 jours de retard, ensuite chaque semaine.
// Prêteur : prévenu au premier jour de retard.

const parisToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
const eur = (n: number, c = 'EUR') => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c === 'EUR' ? '€' : c}`;
const first = (s?: string) => (s || '').trim().split(/\s+/)[0] || '';

const notify = async (userId: string, loanId: string, type: string, title: string, message: string) => {
  await adminDb.collection('notifications').add({ userId, loanId, type, title, message, date: new Date().toISOString(), read: false, pushedAt: new Date().toISOString() });
  return pushToUser(userId, { title, body: message, url: `/?loan=${loanId}`, tag: `${loanId}-rappel` });
};

export default async function handler(req: any, res: any) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();
  const today = parisToday();
  const snap = await adminDb.collection('loans').where('status', 'in', ['active', 'delay_requested']).get();
  let sent = 0;
  for (const d of snap.docs) {
    const loan: any = { id: d.id, ...d.data() };
    if (!loan.borrowerUid) continue;
    const pay = await d.ref.collection('payments').get();
    loan.payments = pay.docs.map(p => ({ id: p.id, ...p.data() }));
    const s = computeSituation(loan, LEGAL_INTEREST_RATE, new Date(today + 'T12:00:00'));
    if (s.isFullyPaid) continue;
    const lender = first(loan.lenderName);
    const borrower = loan.borrowerNickname || first(loan.borrowerName);
    const next = s.nextInstallment;

    if (s.isOverdue && loan.status === 'active' && s.pendingDeclared < s.overdueAmount) {
      const late = s.daysLate;
      const oldest = s.schedule.find(i => i.isOverdue)!;
      if (late === 1 || late === 3 || late === 7 || (late > 7 && late % 7 === 0)) {
        const interest = s.lateInterest > 0 ? ` Intérêts de retard à ce jour : ${eur(s.lateInterest, loan.currency)}.` : '';
        sent += await notify(loan.borrowerUid, loan.id, 'danger', 'Remboursement en retard',
          `${eur(s.overdueAmount, loan.currency)} dus à ${lender} depuis le ${fmtDate(oldest.dueDate)}.${interest} Paie ou propose une nouvelle date dans CKMoney.`);
      }
      if (late === 1 && loan.lenderUid) {
        sent += await notify(loan.lenderUid, loan.id, 'warning', `${borrower} est en retard`,
          `${eur(s.overdueAmount, loan.currency)} étaient prévus hier. Un rappel lui a été envoyé.`);
      }
    } else if (next && !s.isOverdue) {
      const days = daysBetween(today, next.dueDate);
      if (days === 1 || days === 0) {
        sent += await notify(loan.borrowerUid, loan.id, 'info', days === 1 ? 'Échéance demain' : "C'est aujourd'hui",
          `${eur(next.outstanding + s.lateInterest, loan.currency)} à rembourser à ${lender} ${days === 1 ? 'demain' : "aujourd'hui"}, le ${fmtDate(next.dueDate)}.`);
      }
    }
  }
  return res.status(200).json({ today, loans: snap.size, sent });
}
