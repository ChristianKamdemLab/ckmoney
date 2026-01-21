
import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { Notification, Loan } from "../types";
import { calculateDueAmount } from "../utils/calculations";

const NOTIF_COLLECTION = "notifications";

// Envoi d'une notification (Database)
export const sendNotification = async (notifData: Omit<Notification, 'id' | 'date' | 'read'>) => {
    try {
        await addDoc(collection(db, NOTIF_COLLECTION), {
            ...notifData,
            date: new Date().toISOString(),
            read: false
        });
    } catch (e) {
        console.warn("Offline notification logic not implemented fully", e);
    }
};

// Récupération des notifications pour un utilisateur
export const getUserNotifications = async (userEmail: string): Promise<Notification[]> => {
    try {
        const q = query(collection(db, NOTIF_COLLECTION), where("userId", "==", userEmail));
        const snapshot = await getDocs(q);
        const notifs: Notification[] = [];
        snapshot.forEach(doc => {
            notifs.push({ id: doc.id, ...doc.data() } as Notification);
        });
        // Tri local car Firestore composite index peut manquer
        return notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (e) {
        return [];
    }
};

export const markNotificationAsRead = async (notifId: string) => {
    try {
        const ref = doc(db, NOTIF_COLLECTION, notifId);
        await updateDoc(ref, { read: true });
    } catch (e) {
        console.error(e);
    }
};

// --- AUTOMATION ENGINE (Simule un backend cron job) ---
// Cette fonction doit être appelée au lancement de l'app (useEffect dans App.tsx)
export const checkAutomaticNotifications = async (loans: Loan[], userEmail: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const existingNotifs = await getUserNotifications(userEmail);

    // Fonction helper pour vérifier si une notif de ce type existe déjà pour ce prêt aujourd'hui ou récemment
    const hasRecentNotif = (loanId: string, titlePartial: string) => {
        return existingNotifs.some(n => 
            n.loanId === loanId && 
            n.title.includes(titlePartial) &&
            // Éviter de spammer : on regarde si une notif similaire a été envoyée dans les dernières 24h pour les retards
            (new Date(n.date).getTime() > new Date().getTime() - 86400000 * 3) // 3 jours de cooldown
        );
    };

    for (const loan of loans) {
        // On ne traite que les prêts ACTIFS où l'utilisateur est l'EMPRUNTEUR
        if (loan.status !== 'active' || loan.borrowerEmail !== userEmail) continue;

        const calc = calculateDueAmount(loan.amount, loan.repaymentDate, loan.status, loan.lateInterestRate || 0);
        
        // 1. Rappel J-7
        if (calc.daysRemaining === 7 && !hasRecentNotif(loan.id, 'J-7')) {
            await sendNotification({
                userId: userEmail,
                loanId: loan.id,
                type: 'info',
                title: 'Rappel J-7',
                message: `📅 Rappel : Votre remboursement de ${loan.amount} ${loan.currency} est prévu dans 7 jours. Pensez à préparer votre virement !`
            });
        }

        // 2. Rappel J-1 (Dernier jour)
        if (calc.daysRemaining === 1 && !hasRecentNotif(loan.id, 'Dernier jour')) {
            await sendNotification({
                userId: userEmail,
                loanId: loan.id,
                type: 'warning',
                title: 'Dernier jour',
                message: `⚠️ Dernier jour ! Votre remboursement est dû demain. Après cette date, la clause de retard de ${loan.lateInterestRate || 0}% s'appliquera.`
            });
        }

        // 3. Clause de retard activée (J+1)
        if (calc.daysLate === 1 && !hasRecentNotif(loan.id, 'Retard activé')) {
             const dailyCost = (loan.amount * ((loan.lateInterestRate || 0) / 100)) / 365;
             await sendNotification({
                userId: userEmail,
                loanId: loan.id,
                type: 'danger',
                title: 'Retard activé',
                message: `🚨 Échéance dépassée. La clause de retard est activée. Des intérêts de ${dailyCost.toFixed(2)} ${loan.currency} s'ajouteront désormais chaque jour.`
            });
        }

        // 4. Point Hebdomadaire sur retard (Tous les 7 jours de retard)
        if (calc.daysLate > 1 && calc.daysLate % 7 === 0 && !hasRecentNotif(loan.id, 'Point sur votre prêt')) {
            await sendNotification({
                userId: userEmail,
                loanId: loan.id,
                type: 'danger',
                title: 'Point sur votre prêt',
                message: `📉 Point sur votre prêt : Avec le retard (${calc.daysLate} jours), vous devez actuellement un total de ${calc.totalDue.toFixed(2)} ${loan.currency} à ${loan.lenderName}.`
            });
        }
    }
};
