import { adminDb, pushToUser, verifiedEmail, lenderMailAllowed } from './admin.js';
import { sendReminderMail } from './mail.js';
import { computeSituation } from '../../utils/schedule.js';
import { LEGAL_INTEREST_RATE } from '../../config/legal.js';

// Rappels de prêts, partagés par la tâche quotidienne (api/cron/reminders.ts) et les relances de retard
// (sendOverdueRounds, appelée par /api/annonces à chaque passage).

export const parisToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
export const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
export const eur = (n: number, c = 'EUR') => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c === 'EUR' ? '€' : c}`;
export const first = (s?: string) => (s || '').trim().split(/\s+/)[0] || '';

/** Lien PayPal.me avec le montant, sinon le lien tel quel. */
export const payUrl = (link: string | undefined, amount: number, currency = 'EUR') => {
  if (!link) return null;
  const url = link.startsWith('http') ? link : `https://${link}`;
  const pp = url.match(/^https?:\/\/(?:www\.)?paypal\.me\/([^/?#]+)/i);
  return pp ? `https://paypal.me/${pp[1]}/${amount.toFixed(2)}${currency}` : url;
};

const lenderCards = new Map<string, any>();
export const lenderCard = async (uid: string) => {
  if (!lenderCards.has(uid)) lenderCards.set(uid, (await adminDb.collection('lenders').doc(uid).get()).data() || null);
  return lenderCards.get(uid);
};

export const notify = async (userId: string, loanId: string, type: string, title: string, message: string,
  mail?: { to?: string; replyTo?: string; fromName: string; payUrl?: string | null }) => {
  await adminDb.collection('notifications').add({ userId, loanId, type, title, message, date: new Date().toISOString(), read: false, pushedAt: new Date().toISOString() });
  const pushed = await pushToUser(userId, { title, body: message, url: `/?loan=${loanId}`, tag: `${loanId}-rappel` });
  const mailed = mail?.to ? await sendReminderMail({ to: mail.to, replyTo: mail.replyTo, fromName: mail.fromName, subject: `CKMoney · ${title}`, title, body: message, loanId, payUrl: mail.payUrl, payLabel: 'Payer maintenant' }) : false;
  return pushed + (mailed ? 1 : 0);
};


/** Le créneau de relance du moment (heure de Paris) : 8 h, 12 h, 16 h et 19 h ; aucun la nuit. */
export const overdueSlot = (now = new Date()) => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(now));
  const slot = h >= 19 && h < 21 ? 3 : h >= 16 && h < 19 ? 2 : h >= 12 ? (h < 16 ? 1 : -1) : h >= 8 ? 0 : -1;
  return slot < 0 ? null : `${parisToday()}-${slot}`;
};

/** Relances de retard (26/11, demande de Christian) : quatre par jour (8 h, 12 h, 16 h, 19 h) dès le
 *  premier jour de retard, tant que le proche n'a ni payé ni déclaré son paiement ni demandé un délai.
 *  Une notification à chaque créneau ; l'e-mail une seule fois par jour (le premier créneau), pour ne
 *  pas finir dans les indésirables. Le créneau envoyé est noté sur le prêt (overdueSlot). */
export const sendOverdueRounds = async (now = new Date()) => {
  const slot = overdueSlot(now);
  if (!slot) return { slot: null, sent: 0 };
  const today = parisToday();
  const snap = await adminDb.collection('loans').where('status', '==', 'active').get();
  let sent = 0;
  for (const d of snap.docs) {
    const loan: any = { id: d.id, ...d.data() };
    if (!loan.borrowerUid || loan.overdueSlot === slot) continue;
    const pay = await d.ref.collection('payments').get();
    loan.payments = pay.docs.map(p => ({ id: p.id, ...p.data() }));
    const s = computeSituation(loan, LEGAL_INTEREST_RATE, new Date(today + 'T12:00:00'));
    if (s.isFullyPaid || !s.isOverdue || s.pendingDeclared >= s.overdueAmount) continue;
    await d.ref.update({ overdueSlot: slot });
    const lender = first(loan.lenderName);
    const oldest = s.schedule.find(i => i.isOverdue)!;
    const firstToday = !String(loan.overdueMailDay || '').startsWith(today);
    let borrowerMail: string | undefined;
    let lenderMail: string | undefined;
    if (firstToday) {
      lenderMail = await verifiedEmail(loan.lenderUid);
      borrowerMail = lenderMailAllowed(lenderMail) ? await verifiedEmail(loan.borrowerUid) : undefined;
      await d.ref.update({ overdueMailDay: today });
    }
    const card = loan.lenderUid ? await lenderCard(loan.lenderUid) : null;
    const total = Math.round((s.overdueAmount + s.lateInterest + s.penalty) * 100) / 100;
    const interest = (s.penalty > 0 ? ` Pénalité de retard : ${eur(s.penalty, loan.currency)}.` : '') + (s.lateInterest > 0 ? ` Intérêts de retard à ce jour : ${eur(s.lateInterest, loan.currency)}.` : '');
    sent += await notify(loan.borrowerUid, loan.id, 'danger', `Remboursement en retard de ${s.daysLate} jour${s.daysLate > 1 ? 's' : ''}`,
      `${eur(s.overdueAmount, loan.currency)} dus à ${lender} depuis le ${fmtDate(oldest.dueDate)}.${interest} Paie ou propose une nouvelle date dans CKMoney.`,
      borrowerMail ? { to: borrowerMail, replyTo: lenderMail, fromName: lender || 'CKMoney', payUrl: payUrl(card?.paymentLink || loan.lenderPaymentLink, total, loan.currency) } : undefined);
  }
  return { slot, sent };
};
