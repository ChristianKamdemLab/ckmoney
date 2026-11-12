import { adminAuth, adminDb, pushToUser } from './_lib/admin.js';
import { sendReminderMail, mailEnabled } from './_lib/mail.js';

// POST /api/test-mail — le prêteur s'envoie un rappel d'exemple (e-mail + notification).
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const caller = await adminAuth.verifyIdToken((req.headers.authorization || '').replace(/^Bearer /, ''));
    const card = (await adminDb.collection('lenders').doc(caller.uid).get()).data();
    if (!card) return res.status(403).json({ error: 'not_lender' });
    if (!mailEnabled()) return res.status(200).json({ mail: false, reason: 'gmail_non_configure' });
    const ok = await sendReminderMail({
      to: caller.email || '', fromName: card.firstName || 'CKMoney', subject: 'CKMoney · Rappel de test',
      title: 'Rappel de test', body: `Voici à quoi ressemble un rappel envoyé à tes proches. Exemple : 150,00 € dus à ${card.firstName || 'toi'} depuis le 5 novembre. Intérêts de retard à ce jour : 0,22 €.`,
      loanId: 'test', payUrl: card.paymentLink ? (card.paymentLink.startsWith('http') ? card.paymentLink : `https://${card.paymentLink}`) : null, payLabel: 'Payer maintenant',
    });
    const pushed = await pushToUser(caller.uid, { title: 'Rappel de test', body: 'Les notifications CKMoney fonctionnent.', url: '/' });
    return res.status(200).json({ mail: ok, pushed, to: caller.email });
  } catch (e: any) {
    console.error('test-mail', e?.message);
    return res.status(401).json({ error: 'unauthorized' });
  }
}
