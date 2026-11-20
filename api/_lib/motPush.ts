import { adminDb, pushToUser } from './admin.js';
import { dayNumber, puzzleFor } from '../../games/mot.js';

// « Le mot du jour est là » : une notification par jour, le matin (tâche quotidienne de 9 h).
// Une seule fois par numéro, même si la tâche repasse ; pas à ceux qui ont coupé le rappel.

const CAT: Record<string, string> = { plat: 'un plat', camfranglais: 'du camfranglais', ville: 'une ville', musique: 'une musique', foot: 'une figure du foot', 'vie courante': 'la vie de tous les jours' };

export const motMessage = (n: number) => {
  const p = puzzleFor(n);
  return {
    title: `Le mot du jour n° ${n}`,
    body: p.local ? `Aujourd’hui, un mot du 237 : ${CAT[p.local.cat]}. ${p.word.length} lettres, six essais.` : `${p.word.length} lettres, six essais. À toi de jouer !`,
    url: '/?mot', tag: `mot-${n}`,
  };
};

export const sendDailyMot = async (now = Date.now()) => {
  const n = dayNumber(now);
  if (n < 1) return { n, sent: 0 };
  const flag = adminDb.collection('settings').doc('motPush');
  const fresh = await adminDb.runTransaction(async (t: any) => {
    const s = await t.get(flag);
    if ((s.data()?.n || 0) >= n) return false;
    t.set(flag, { n, at: new Date(now).toISOString() }, { merge: true });
    return true;
  });
  if (!fresh) return { n, sent: 0 };
  const msg = motMessage(n);
  const docs = (await adminDb.collection('pushTokens').get()).docs.filter((d: any) => !d.data()?.motOff);
  const sent = await Promise.all(docs.map((d: any) => pushToUser(d.id, msg).catch(() => 0)));
  return { n, sent: sent.filter((x: number) => x > 0).length };
};
