import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { Notification, Loan } from "../types";
import { computeSituation, formatMoney } from "../utils/schedule";
import { LEGAL_INTEREST_RATE } from "../config/legal";

// Les notifications sont adressées à un compte (uid), jamais à une adresse email.
const COL = "notifications";

export const sendNotification = async (n: Omit<Notification, 'id' | 'date' | 'read'>) => {
  if (!n.userId) return;
  try {
    await addDoc(collection(db, COL), { ...n, date: new Date().toISOString(), read: false });
  } catch (e) {
    console.warn("Notification non envoyée", e);
  }
};

export const getUserNotifications = async (uid: string): Promise<Notification[]> => {
  try {
    const snap = await getDocs(query(collection(db, COL), where("userId", "==", uid)));
    const out: Notification[] = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() } as Notification));
    return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
};

export const markNotificationAsRead = async (id: string) => {
  try { await updateDoc(doc(db, COL, id), { read: true }); } catch (e) { console.error(e); }
};

/** Rappels automatiques pour l'emprunteur, calculés à l'ouverture de l'appli. */
export const checkAutomaticNotifications = async (loans: Loan[], uid: string) => {
  const existing = await getUserNotifications(uid);
  const recent = (loanId: string, title: string, days: number) =>
    existing.some(n => n.loanId === loanId && n.title === title && new Date(n.date).getTime() > Date.now() - 86_400_000 * days);
  for (const loan of loans) {
    if (loan.status !== 'active' || loan.borrowerUid !== uid) continue;
    const s = computeSituation(loan, LEGAL_INTEREST_RATE);
    const next = s.nextInstallment;
    if (!next) continue;
    const days = Math.round((new Date(next.dueDate).getTime() - Date.now()) / 86_400_000);
    if (!s.isOverdue && days >= 0 && days <= 7 && !recent(loan.id, 'Échéance proche', 8)) {
      await sendNotification({ userId: uid, loanId: loan.id, type: 'info', title: 'Échéance proche',
        message: `${formatMoney(next.outstanding, loan.currency)} à rembourser le ${new Date(next.dueDate).toLocaleDateString('fr-FR')}.` });
    }
    if (s.isOverdue && !recent(loan.id, 'Échéance dépassée', 7)) {
      await sendNotification({ userId: uid, loanId: loan.id, type: 'danger', title: 'Échéance dépassée',
        message: `${formatMoney(s.overdueAmount, loan.currency)} en retard de ${s.daysLate} jour(s).` });
    }
  }
};
