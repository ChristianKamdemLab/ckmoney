import { adminAuth, adminDb, pushToUser } from './_lib/admin.js';

// POST /api/notify { notificationId } — envoie en push une notification de l'appli.
// L'appelant doit être connecté et partie au prêt concerné (prêteur ou emprunteur).
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const idToken = (req.headers.authorization || '').replace(/^Bearer /, '');
    const caller = await adminAuth.verifyIdToken(idToken);
    const { notificationId } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!notificationId) return res.status(400).json({ error: 'notificationId' });
    const n = (await adminDb.collection('notifications').doc(String(notificationId)).get()).data();
    if (!n) return res.status(404).end();
    const loan = (await adminDb.collection('loans').doc(n.loanId).get()).data();
    if (!loan || ![loan.lenderUid, loan.borrowerUid].includes(caller.uid) || caller.uid === n.userId) return res.status(403).end();
    if (n.pushedAt) return res.status(200).json({ sent: 0 });
    const sent = await pushToUser(n.userId, { title: n.title, body: n.message, url: `/?loan=${n.loanId}`, tag: n.loanId });
    await adminDb.collection('notifications').doc(String(notificationId)).set({ pushedAt: new Date().toISOString() }, { merge: true });
    return res.status(200).json({ sent });
  } catch (e: any) {
    console.error('notify', e?.message);
    return res.status(401).json({ error: 'unauthorized' });
  }
}
