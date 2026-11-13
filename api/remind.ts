import { adminAuth, adminDb, pushToUser, isAdmin, verifiedEmail } from './_lib/admin.js';
import { sendReminderMail } from './_lib/mail.js';
import { computeSituation } from '../utils/schedule.js';
import { LEGAL_INTEREST_RATE } from '../config/legal.js';

// POST /api/remind { loanId } — le prêteur envoie tout de suite un rappel (notification + e-mail)
// à son proche. Un rappel manuel par prêt et par jour au plus.
// Corrections du prêteur sur son prêt (les règles Firestore ne permettent pas de toucher un paiement confirmé) :
//  { action: 'cancelPayment', loanId, paymentId }  paiement confirmé par erreur → « annulé » (gardé dans l'historique)
//  { action: 'waiveFees', loanId }                 renoncer aux frais de retard (pénalité et intérêts de retard)
const eur = (n: number, c = 'EUR') => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c === 'EUR' ? '€' : c}`;
const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
const first = (s?: string) => (s || '').trim().split(/\s+/)[0] || '';
const payUrl = (link: string | undefined, amount: number, currency = 'EUR') => {
  if (!link) return null;
  const url = link.startsWith('http') ? link : `https://${link}`;
  const pp = url.match(/^https?:\/\/(?:www\.)?paypal\.me\/([^/?#]+)/i);
  return pp ? `https://paypal.me/${pp[1]}/${amount.toFixed(2)}${currency}` : url;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const caller = await adminAuth.verifyIdToken((req.headers.authorization || '').replace(/^Bearer /, ''));
    const { loanId } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const ref = adminDb.collection('loans').doc(String(loanId || ''));
    const snap = await ref.get();
    const loan: any = snap.exists ? { id: snap.id, ...snap.data() } : null;
    // Le prêteur de ce prêt (tout compte peut prêter), avec une adresse e-mail vérifiée
    if (!loan || loan.lenderUid !== caller.uid || caller.email_verified !== true) return res.status(403).end();
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (input.action === 'cancelPayment') {
      const pref = ref.collection('payments').doc(String(input.paymentId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || '-');
      const p = (await pref.get()).data();
      if (!p || p.status !== 'confirmed') return res.status(409).json({ error: 'pas_confirme' });
      await pref.set({ status: 'cancelled', cancelledAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ ok: true });
    }
    if (input.action === 'waiveFees') {
      await ref.set({ lateFeesWaivedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ ok: true });
    }
    if (!loan.borrowerUid || !['active', 'delay_requested'].includes(loan.status)) return res.status(409).json({ error: 'pas_signe' });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    if ((loan.lastManualReminderAt || '').slice(0, 10) === today) return res.status(429).json({ error: 'deja_relance' });

    loan.payments = (await ref.collection('payments').get()).docs.map(p => ({ id: p.id, ...p.data() }));
    const s = computeSituation(loan, LEGAL_INTEREST_RATE, new Date(today + 'T12:00:00'));
    if (s.isFullyPaid) return res.status(409).json({ error: 'rembourse' });
    const lender = first(loan.lenderName);
    const card = (await adminDb.collection('lenders').doc(loan.lenderUid).get()).data();
    let title: string, body: string, amount: number;
    if (s.isOverdue) {
      const oldest = s.schedule.find(i => i.isOverdue)!;
      amount = Math.round((s.overdueAmount + s.lateInterest + s.penalty) * 100) / 100;
      title = 'Rappel de remboursement';
      body = `${eur(s.overdueAmount, loan.currency)} dus à ${lender} depuis le ${fmtDate(oldest.dueDate)}.${s.penalty > 0 ? ` Pénalité de retard : ${eur(s.penalty, loan.currency)}.` : ''}${s.lateInterest > 0 ? ` Intérêts de retard à ce jour : ${eur(s.lateInterest, loan.currency)}.` : ''} Paie ou propose une nouvelle date dans CKMoney.`;
    } else {
      const n = s.nextInstallment!;
      amount = Math.round((n.outstanding + s.lateInterest + s.penalty) * 100) / 100;
      title = 'Petit rappel';
      body = `Prochaine échéance : ${eur(amount, loan.currency)} à rembourser à ${lender} le ${fmtDate(n.dueDate)}.`;
    }
    await adminDb.collection('notifications').add({ userId: loan.borrowerUid, loanId: loan.id, type: s.isOverdue ? 'danger' : 'info', title, message: body, date: new Date().toISOString(), read: false, pushedAt: new Date().toISOString() });
    const pushed = await pushToUser(loan.borrowerUid, { title, body, url: `/?loan=${loan.id}`, tag: `${loan.id}-rappel` });
    // E-mail seulement pour les prêts de l'administrateur (il part du Gmail de l'appli) ; sinon notification
    const to = isAdmin(caller.email, true) ? await verifiedEmail(loan.borrowerUid) : undefined;
    const mailed = to ? await sendReminderMail({
      to, replyTo: caller.email, fromName: lender || 'CKMoney', subject: `CKMoney · ${title}`, title, body, loanId: loan.id,
      payUrl: payUrl(card?.paymentLink || loan.lenderPaymentLink, amount, loan.currency), payLabel: 'Payer maintenant',
    }) : false;
    await ref.set({ lastManualReminderAt: new Date().toISOString() }, { merge: true });
    return res.status(200).json({ pushed, mailed });
  } catch (e: any) {
    console.error('remind', e?.message);
    return res.status(401).json({ error: 'unauthorized' });
  }
}
