import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { Notification, Loan } from "../types";
import { computeSituation, formatMoney } from "../utils/schedule";
import { LEGAL_INTEREST_RATE } from "../config/legal";

const NOTIF_COLLECTION = "notifications";

export const sendNotification = async (notifData: Omit<Notification, 'id' | 'date' | 'read'>) => {
  if (!notifData.userId) return;
  try {
    await addDoc(collection(db, NOTIF_COLLECTION), {
      ...notifData,
      userId: notifData.userId.toLowerCase(),
      date: new Date().toISOString(),
      read: false,
    });
  } catch (e) {
    console.warn("Notification non envoyée", e);
  }
};

export const getUserNotifications = async (userEmail: string): Promise<Notification[]> => {
  try {
    const q = query(collection(db, NOTIF_COLLECTION), where("userId", "==", userEmail.toLowerCase()));
    const snapshot = await getDocs(q);
    const notifs: Notification[] = [];
    snapshot.forEach(d => notifs.push({ id: d.id, ...d.data() } as Notification));
    return notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
};

export const markNotificationAsRead = async (notifId: string) => {
  try {
    await updateDoc(doc(db, NOTIF_COLLECTION, notifId), { read: true });
  } catch (e) {
    console.error(e);
  }
};

/** Rappels automatiques pour l'emprunteur, calculés à l'ouverture de l'appli. */
export const checkAutomaticNotifications = async (loans: Loan[], userEmail: string) => {
  const email = userEmail.toLowerCase();
  const existing = await getUserNotifications(email);
  const hasRecent = (loanId: string, title: string, days = 3) =>
    existing.some(n => n.loanId === loanId && n.title === title &&
      new Date(n.date).getTime() > Date.now() - 86_400_000 * days);

  for (const loan of loans) {
    if (loan.status !== 'active' || (loan.borrowerEmail || '').toLowerCase() !== email) continue;
    const s = computeSituation(loan, LEGAL_INTEREST_RATE);
    const next = s.nextInstallment;
    if (!next) continue;
    const daysToNext = Math.round((new Date(next.dueDate).getTime() - Date.now()) / 86_400_000);

    if (!s.isOverdue && daysToNext <= 7 && daysToNext >= 0 && !hasRecent(loan.id, 'Échéance proche', 8)) {
      await sendNotification({
        userId: email, loanId: loan.id, type: 'info', title: 'Échéance proche',
        message: `📅 Échéance de ${formatMoney(next.outstanding, loan.currency)} le ${new Date(next.dueDate).toLocaleDateString('fr-FR')} pour le prêt de ${loan.lenderName}.`,
      });
    }
    if (s.isOverdue && !hasRecent(loan.id, 'Échéance dépassée', 7)) {
      await sendNotification({
        userId: email, loanId: loan.id, type: 'danger', title: 'Échéance dépassée',
        message: `🚨 ${formatMoney(s.overdueAmount, loan.currency)} sont échus depuis ${s.daysLate} jour(s). Reste dû aujourd'hui : ${formatMoney(s.totalDueNow, loan.currency)}.`,
      });
    }
  }
};
