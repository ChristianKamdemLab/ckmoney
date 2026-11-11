import { db } from "./firebase";
import {
  collection, addDoc, updateDoc, doc, getDoc, query, where, getDocs, deleteField,
} from "firebase/firestore";
import { Loan, Payment } from "../types";
import { sendNotification } from "./notificationService";

// Les données sont stockées uniquement dans Firestore, protégées par firestore.rules.
// (L'ancien mode « hors ligne » qui copiait les prêts dans le navigateur a été retiré :
// il masquait les erreurs et laissait des contrats non synchronisés.)

const COLLECTION_NAME = "loans";
const paymentsCol = (loanId: string) => collection(db, COLLECTION_NAME, loanId, "payments");

const clean = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const createLoanRequest = async (loanData: Omit<Loan, 'id'>): Promise<string> => {
  const { payments, ...rest } = loanData as Loan;
  const docRef = await addDoc(collection(db, COLLECTION_NAME), clean(rest));
  return docRef.id;
};

export const updateLoan = async (loanId: string, updates: Partial<Loan>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION_NAME, loanId), clean(updates) as any);
};

/** Activation par dépôt d'un contrat papier signé (alternative à la signature en ligne). */
export const activateLoanWithContract = async (loanId: string, fileDataUrl: string): Promise<void> => {
  await updateLoan(loanId, {
    status: 'active',
    signedContractUrl: fileDataUrl,
    signedDate: new Date().toISOString(),
  });
};

/** Signature électronique par l'Emprunteur (mention art. 1376 + signature manuscrite numérisée). */
export const signAsBorrower = async (
  loan: Loan,
  data: { amountWords: string; signedName: string; signature: string; hash: string; uid: string },
): Promise<void> => {
  const now = new Date().toISOString();
  await updateDoc(doc(db, COLLECTION_NAME, loan.id), {
    status: 'active',
    borrowerAmountWords: data.amountWords.trim(),
    borrowerSignedName: data.signedName.trim(),
    borrowerSignature: data.signature,
    borrowerSignedAt: now,
    borrowerSignedHash: data.hash,
    borrowerSignedUserAgent: navigator.userAgent.slice(0, 300),
    borrowerUid: data.uid,
    signedDate: now,
  });
  await sendNotification({
    userId: loan.lenderEmail,
    loanId: loan.id,
    type: 'success',
    title: 'Contrat signé',
    message: `✍️ ${loan.borrowerName} a signé le contrat de prêt de ${loan.amount} ${loan.currency}.`,
  });
};

// --- PAIEMENTS -------------------------------------------------------------

export const getLoanPayments = async (loanId: string): Promise<Payment[]> => {
  const snap = await getDocs(paymentsCol(loanId));
  const out: Payment[] = [];
  snap.forEach(d => out.push({ id: d.id, ...d.data() } as Payment));
  return out.sort((a, b) => a.date.localeCompare(b.date));
};

/** L'emprunteur déclare un paiement (partiel ou total) ; le prêteur doit le confirmer. */
export const declarePayment = async (
  loan: Loan,
  payment: { amount: number; date: string; method: string; proof?: string | null },
): Promise<void> => {
  await addDoc(paymentsCol(loan.id), clean({
    amount: Math.round(payment.amount * 100) / 100,
    date: payment.date,
    method: payment.method,
    proof: payment.proof || undefined,
    status: 'declared',
    declaredBy: 'borrower',
    declaredAt: new Date().toISOString(),
  }));
  await sendNotification({
    userId: loan.lenderEmail,
    loanId: loan.id,
    type: 'action_required',
    title: 'Remboursement déclaré',
    message: `💰 ${loan.borrowerName} déclare vous avoir versé ${payment.amount} ${loan.currency} le ${new Date(payment.date).toLocaleDateString('fr-FR')}.`,
    actionType: 'review_payment',
  });
};

/** Le prêteur enregistre directement un paiement reçu (déjà confirmé). */
export const recordPaymentByLender = async (
  loan: Loan,
  payment: { amount: number; date: string; method: string },
): Promise<void> => {
  const now = new Date().toISOString();
  await addDoc(paymentsCol(loan.id), {
    amount: Math.round(payment.amount * 100) / 100,
    date: payment.date,
    method: payment.method,
    status: 'confirmed',
    declaredBy: 'lender',
    declaredAt: now,
    confirmedAt: now,
  });
};

/** Confirmation ou refus par le prêteur d'un paiement déclaré. */
export const reviewPayment = async (loanId: string, paymentId: string, accept: boolean): Promise<void> => {
  await updateDoc(doc(db, COLLECTION_NAME, loanId, "payments", paymentId), {
    status: accept ? 'confirmed' : 'rejected',
    confirmedAt: new Date().toISOString(),
  });
};

/** Confirme tous les paiements en attente d'un prêt (action rapide depuis une notification). */
export const confirmPendingPayments = async (loanId: string): Promise<void> => {
  const payments = await getLoanPayments(loanId);
  await Promise.all(payments.filter(p => p.status === 'declared').map(p => reviewPayment(loanId, p.id, true)));
};

/** Passe le prêt au statut « soldé » quand le reste dû est nul (appelé par le prêteur). */
export const markLoanPaid = async (loanId: string): Promise<void> => {
  await updateLoan(loanId, { status: 'paid' });
};

// --- DÉLAIS -----------------------------------------------------------------

export const requestDelay = async (loanId: string, newDate: string): Promise<void> => {
  const loan = await getLoanById(loanId);
  if (!loan) return;
  await updateDoc(doc(db, COLLECTION_NAME, loanId), {
    status: 'delay_requested',
    delayProposedDate: newDate,
    delayRequestDate: new Date().toISOString(),
  });
  await sendNotification({
    userId: loan.lenderEmail,
    loanId,
    type: 'action_required',
    title: 'Demande de délai',
    message: `📅 ${loan.borrowerName} propose de reporter les échéances impayées au ${new Date(newDate).toLocaleDateString('fr-FR')}.`,
    actionType: 'review_delay',
  });
};

/**
 * Réponse du prêteur. En cas d'accord, les échéances impayées dont la date est
 * antérieure à la nouvelle date y sont reportées (avenant enregistré dans `delayHistory`).
 */
export const respondToDelay = async (loanId: string, accepted: boolean): Promise<void> => {
  const loan = await getLoanById(loanId);
  if (!loan || !loan.delayProposedDate) return;
  const newDate = loan.delayProposedDate;
  const updates: Record<string, unknown> = {
    status: 'active',
    delayProposedDate: deleteField(),
    delayRequestDate: deleteField(),
  };
  if (accepted) {
    const payments = await getLoanPayments(loanId);
    const paidTotal = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0);
    let covered = paidTotal;
    const schedule = (loan.schedule || []).map(inst => {
      const fullyPaid = covered >= inst.amount - 0.004;
      covered = Math.max(0, covered - inst.amount);
      return !fullyPaid && inst.dueDate < newDate ? { ...inst, dueDate: newDate } : inst;
    });
    if (schedule.length) updates.schedule = schedule;
    const last = schedule.length ? schedule[schedule.length - 1].dueDate : newDate;
    updates.repaymentDate = last > newDate ? last : newDate;
    updates.amendments = [
      ...(loan.amendments || []),
      { type: 'report_echeance', newDate, acceptedAt: new Date().toISOString(), requestedAt: loan.delayRequestDate },
    ];
  }
  await updateDoc(doc(db, COLLECTION_NAME, loanId), updates as any);
  await sendNotification({
    userId: loan.borrowerEmail || '',
    loanId,
    type: accepted ? 'success' : 'warning',
    title: accepted ? 'Délai accepté' : 'Délai refusé',
    message: accepted
      ? `✅ ${loan.lenderName} accepte le report au ${new Date(newDate).toLocaleDateString('fr-FR')}.`
      : `${loan.lenderName} n'a pas accepté le report demandé.`,
  });
};

// --- LECTURE ----------------------------------------------------------------

const withPayments = async (loan: Loan): Promise<Loan> => {
  try {
    return { ...loan, payments: await getLoanPayments(loan.id) };
  } catch {
    return { ...loan, payments: [] };
  }
};

export const getLoanById = async (loanId: string): Promise<Loan | null> => {
  const snap = await getDoc(doc(db, COLLECTION_NAME, loanId));
  if (!snap.exists()) return null;
  return withPayments({ id: snap.id, ...snap.data() } as Loan);
};

export const getUserLoans = async (userEmail: string): Promise<Loan[]> => {
  const email = userEmail.toLowerCase();
  const loansRef = collection(db, COLLECTION_NAME);
  const [lenderSnap, borrowerSnap] = await Promise.all([
    getDocs(query(loansRef, where("lenderEmail", "==", email))),
    getDocs(query(loansRef, where("borrowerEmail", "==", email))),
  ]);
  const map = new Map<string, Loan>();
  lenderSnap.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Loan));
  borrowerSnap.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Loan));
  const loans = await Promise.all(Array.from(map.values()).map(withPayments));
  return loans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

