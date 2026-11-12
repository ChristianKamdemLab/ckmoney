import { db } from "./firebase";
import {
  collection, addDoc, updateDoc, doc, getDoc, query, where, getDocs, deleteField, setDoc, deleteDoc,
} from "firebase/firestore";
import { Loan, Payment, Invite, Profile, User, ReceiveInfo } from "../types";
import { sendNotification } from "./notificationService";
import { Installment } from "../utils/schedule";
import { buildLoanContract, buildDebtAcknowledgment, sha256Hex, CONTRACT_VERSION } from "../utils/contract";
import { amountToFrenchWords } from "../utils/frenchNumbers";

// v2 : les prêts sont reliés aux comptes par identifiant (uid). L'ami se relie à un prêt
// grâce au lien personnel reçu sur WhatsApp (collection invites/{jeton}).

const LOANS = "loans";
const paymentsCol = (loanId: string) => collection(db, LOANS, loanId, "payments");
const clean = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

const firstName = (full: string) => (full || '').trim().split(/\s+/)[0] || full;

/** Partie aléatoire des liens (sans caractères ambigus). */
const randomPart = (n: number, alphabet = 'abcdefghijkmnpqrstuvwxyz23456789') => {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
};

/** Prénom ou surnom réduit à des caractères simples pour une adresse web. */
export const slugify = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'ami';

/**
 * Identifiant du lien de signature, lisible et personnel : prénom, montant, puis 8 caractères
 * aléatoires (≈ 10¹² possibilités) pour qu'il reste impossible à deviner. Ex. charles-150-k7qm2xpa.
 */
const newInviteId = (nickname: string, amount: number) => {
  const amt = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${slugify(nickname)}-${amt}-${randomPart(8)}`;
};

export interface Terms {
  amount: number;
  currency: string;
  loanDate: string;
  schedule: Installment[];
  interestRate: number;
  lateRateMode: 'none' | 'legal' | 'custom';
  lateInterestRate: number;
}

/** Empreinte des conditions de l'offre, pour prouver qu'elles n'ont pas changé. */
export const hashTerms = (t: Terms) =>
  sha256Hex(JSON.stringify([t.amount, t.currency, t.loanDate, t.interestRate, t.lateRateMode, t.lateInterestRate,
    t.schedule.map(i => [i.index, i.dueDate, i.amount, i.principal, i.interest])]));

const termsFields = (t: Terms) => ({
  amount: t.amount,
  currency: t.currency,
  loanDate: t.loanDate,
  schedule: t.schedule,
  repaymentDate: t.schedule[t.schedule.length - 1].dueDate,
  repaymentType: t.schedule.length > 1 ? 'monthly' as const : 'in_fine' as const,
  installmentsCount: t.schedule.length,
  interestRate: t.interestRate,
  lateRateMode: t.lateRateMode,
  lateInterestRate: t.lateRateMode === 'custom' ? t.lateInterestRate : 0,
});

const lenderFields = (p: Profile, user: User) => ({
  lenderUid: user.id,
  lenderEmail: user.email,
  lenderName: p.fullName,
  lenderCivility: p.civility,
  lenderBirthDate: p.birthDate,
  lenderBirthPlace: p.birthPlace,
  lenderAddress: p.address,
  lenderIban: p.iban || '',
  lenderPaymentLink: p.paymentLink || '',
  city: (p.address.split(',').pop() || '').replace(/\d+/g, '').trim() || 'Ville',
});

export const scheduleSummary = (s: Installment[], currency: string) => {
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return s.length > 1 ? `${s.length} × ${fmt(s[0].amount)} ${currency === 'EUR' ? '€' : currency}` : `En une fois`;
};

// --- OFFRE DU PRÊTEUR -------------------------------------------------------

/**
 * Le prêteur signe une offre. Si l'ami est déjà connu (borrowerUid), le prêt apparaît
 * directement dans son espace ; sinon un lien personnel est créé pour WhatsApp.
 */
export const createOffer = async (args: {
  user: User; profile: Profile; terms: Terms; nickname: string; phone?: string;
  lenderSignature: string; knownBorrowerUid?: string; counterOf?: string; borrowerPaymentLink?: string; borrowerReceive?: ReceiveInfo;
}): Promise<{ loanId: string; token: string }> => {
  const { user, profile, terms } = args;
  const token = newInviteId(args.nickname, terms.amount);
  const loan = clean({
    ...lenderFields(profile, user),
    ...termsFields(terms),
    termsHash: await hashTerms(terms),
    borrowerNickname: args.nickname.trim(),
    borrowerName: args.nickname.trim(),
    borrowerPhone: args.phone || undefined,
    borrowerUid: args.knownBorrowerUid || undefined,
    counterOf: args.counterOf || undefined,
    borrowerPaymentLink: args.borrowerPaymentLink || undefined,
    borrowerReceive: args.borrowerReceive ? clean(args.borrowerReceive) : undefined,
    lenderSignature: args.lenderSignature,
    lenderAttestation: `Prêt personnel et occasionnel attesté le ${new Date().toISOString()}`,
    amountInWords: amountToFrenchWords(terms.amount, terms.currency),
    inviteToken: token,
    status: 'pending_borrower',
    initiatedBy: 'lender',
    createdAt: new Date().toISOString(),
  });
  const ref = await addDoc(collection(db, LOANS), loan);
  const invite: Invite = {
    loanId: ref.id,
    lenderUid: user.id,
    lenderFirstName: firstName(profile.fullName),
    borrowerNickname: args.nickname.trim(),
    amount: terms.amount,
    currency: terms.currency,
    scheduleSummary: scheduleSummary(terms.schedule, terms.currency),
    firstDueDate: terms.schedule[0].dueDate,
    interestRate: terms.interestRate,
    lateRateMode: terms.lateRateMode,
    createdAt: new Date().toISOString(),
    claimedBy: null,
  };
  await setDoc(doc(db, "invites", token), invite);
  if (args.knownBorrowerUid) {
    await sendNotification({
      userId: args.knownBorrowerUid, loanId: ref.id, type: 'action_required',
      title: args.counterOf ? 'Contre-proposition' : 'Contrat à signer',
      message: args.counterOf
        ? `${firstName(profile.fullName)} te propose d'autres conditions pour ${terms.amount} ${terms.currency}. Ouvre CKMoney pour les voir et signer.`
        : `${firstName(profile.fullName)} te prête ${terms.amount} ${terms.currency}. Ouvre CKMoney pour signer.`,
    });
  }
  return { loanId: ref.id, token };
};

export const inviteLinkFor = (token: string) => `${window.location.origin}/p/${token}`;

// --- CARTE PUBLIQUE DU PRÊTEUR ET LIEN DE DEMANDE ----------------------------

/** Ce que voit un proche qui ouvre le lien de demande : prénom et lien de paiement, rien d'autre. */
export interface LenderCard { firstName: string; paymentLink?: string; handle?: string; updatedAt: string }

/**
 * Réserve l'adresse courte du prêteur (ex. /christian) dans handles/{nom} → uid.
 * Si le prénom est déjà pris par un autre prêteur, on ajoute un chiffre (christian2…).
 */
const claimHandle = async (uid: string, first: string, current?: string): Promise<string> => {
  const base = slugify(first);
  if (current && (current === base || current.startsWith(base))) {
    const snap = await getDoc(doc(db, "handles", current)).catch(() => null);
    if (snap?.exists() && snap.data().uid === uid) return current;
  }
  for (let i = 0; i < 20; i++) {
    const h = i === 0 ? base : `${base}${i + 1}`;
    if (RESERVED.has(h)) continue;
    const ref = doc(db, "handles", h);
    const snap = await getDoc(ref).catch(() => null);
    if (snap?.exists()) { if (snap.data().uid === uid) return h; continue; }
    try { await setDoc(ref, { uid, createdAt: new Date().toISOString() }); return h; } catch { /* pris entre-temps */ }
  }
  return uid;
};
const RESERVED = new Set(['p', 'assets', 'icons', 'api', 'app', 'sw', 'manifest', 'index', 'login', 'admin']);

export const publishLenderCard = async (uid: string, profile: Profile): Promise<string> => {
  const prev = await getLenderCard(uid);
  const first = firstName(profile.fullName);
  const handle = await claimHandle(uid, first, prev?.handle);
  const card: LenderCard = clean({
    firstName: first,
    paymentLink: profile.paymentLink?.trim() || undefined,
    handle,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(doc(db, "lenders", uid), card);
  return handle;
};

export const getLenderCard = async (uid: string): Promise<LenderCard | null> => {
  try {
    const snap = await getDoc(doc(db, "lenders", uid));
    return snap.exists() ? (snap.data() as LenderCard) : null;
  } catch { return null; }
};

/** Adresse courte → identifiant du prêteur. */
export const resolveHandle = async (handle: string): Promise<string | null> => {
  try {
    const snap = await getDoc(doc(db, "handles", handle.toLowerCase()));
    return snap.exists() ? (snap.data().uid as string) : null;
  } catch { return null; }
};

/** Lien permanent à envoyer une fois à ses proches : ils y font leurs demandes. */
export const requestLinkFor = (handleOrUid: string) => `${window.location.origin}/${handleOrUid}`;

/** Lien de paiement avec le montant déjà rempli quand le service le permet (PayPal.me). */
export const payUrl = (link: string | undefined, amount?: number, currency = 'EUR'): string | null => {
  if (!link) return null;
  const url = link.startsWith('http') ? link : `https://${link}`;
  const pp = url.match(/^https?:\/\/(?:www\.)?paypal\.me\/([^/?#]+)/i);
  if (pp && amount && amount > 0) return `https://paypal.me/${pp[1]}/${amount.toFixed(2)}${currency}`;
  return url;
};

export const payProvider = (link?: string) =>
  !link ? '' : /paypal/i.test(link) ? 'PayPal' : /revolut/i.test(link) ? 'Revolut' : /lydia/i.test(link) ? 'Lydia' : 'le lien de paiement';

export const getInvite = async (token: string): Promise<Invite | null> => {
  const snap = await getDoc(doc(db, "invites", token));
  return snap.exists() ? (snap.data() as Invite) : null;
};

/** L'ami se relie au prêt : d'abord l'invitation, puis le prêt (vérifié par les règles). */
export const claimInvite = async (token: string, user: User): Promise<string> => {
  const inv = await getInvite(token);
  if (!inv) throw new Error('introuvable');
  if (inv.claimedBy && inv.claimedBy !== user.id) throw new Error('deja_utilise');
  if (inv.lenderUid === user.id) throw new Error('propre_lien');
  if (!inv.claimedBy) await updateDoc(doc(db, "invites", token), { claimedBy: user.id });
  const loanRef = doc(db, LOANS, inv.loanId);
  try {
    await updateDoc(loanRef, { borrowerUid: user.id, claimToken: token });
  } catch (e) {
    // Déjà relié à ce compte : rien à faire
    const snap = await getDoc(loanRef).catch(() => null);
    if (!snap || !snap.exists() || (snap.data() as Loan).borrowerUid !== user.id) throw e;
  }
  return inv.loanId;
};

// --- SIGNATURE DE L'AMI -----------------------------------------------------

export interface BorrowerIdentity {
  civility: 'M.' | 'Mme';
  fullName: string;
  birthDate: string;
  birthPlace: string;
  address: string;
}

const borrowerFields = (b: BorrowerIdentity) => ({
  borrowerName: b.fullName.trim(),
  borrowerCivility: b.civility,
  borrowerBirthDate: b.birthDate,
  borrowerBirthPlace: b.birthPlace,
  borrowerAddress: b.address.trim(),
  borrowerCountry: (b.birthPlace.split(',')[1] || '').trim(),
});

/** Construit le texte définitif du contrat à partir des conditions et des deux identités. */
const buildTexts = async (loan: Loan, b: BorrowerIdentity) => {
  const input: any = { ...loan, ...borrowerFields(b), schedule: loan.schedule || [] };
  const contractText = buildLoanContract(input);
  const acknowledgmentText = buildDebtAcknowledgment(input);
  const contractHash = await sha256Hex(contractText + '\n\n' + acknowledgmentText);
  return { contractText, acknowledgmentText, contractHash };
};

export const previewTexts = buildTexts;

/** L'ami accepte l'offre du prêteur : identité, mention en lettres, signature. */
export const signOffer = async (loan: Loan, user: User, b: BorrowerIdentity, sig: { amountWords: string; signature: string }) => {
  const texts = await buildTexts(loan, b);
  const now = new Date().toISOString();
  await updateDoc(doc(db, LOANS, loan.id), clean({
    ...borrowerFields(b),
    borrowerEmail: user.email || undefined,
    ...texts,
    contractVersion: CONTRACT_VERSION,
    borrowerAmountWords: sig.amountWords.trim(),
    borrowerSignedName: b.fullName.trim(),
    borrowerSignature: sig.signature,
    borrowerSignedAt: now,
    borrowerSignedHash: texts.contractHash,
    borrowerSignedUserAgent: navigator.userAgent.slice(0, 300),
    status: 'active',
    signedDate: now,
  }) as any);
  if (loan.lenderUid) {
    await sendNotification({
      userId: loan.lenderUid, loanId: loan.id, type: 'success', title: 'Contrat signé',
      message: `${firstName(b.fullName)} a signé le prêt de ${loan.amount} ${loan.currency}.`,
    });
  }
};

// --- DEMANDE DE L'AMI ------------------------------------------------------

/** L'ami demande un nouveau prêt à un prêteur qu'il connaît, et signe sa demande. */
export const createRequest = async (args: {
  user: User; lenderUid: string; lenderName: string; identity: BorrowerIdentity; terms: Terms; note: string;
  amountWords: string; signature: string; receive?: ReceiveInfo;
}) => {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, LOANS), clean({
    ...termsFields(args.terms),
    termsHash: await hashTerms(args.terms),
    lenderUid: args.lenderUid,
    lenderName: args.lenderName,
    borrowerUid: args.user.id,
    borrowerEmail: args.user.email || undefined,
    borrowerNickname: firstName(args.identity.fullName),
    ...borrowerFields(args.identity),
    borrowerAmountWords: args.amountWords.trim(),
    borrowerSignedName: args.identity.fullName.trim(),
    borrowerSignature: args.signature,
    borrowerSignedAt: now,
    borrowerSignedUserAgent: navigator.userAgent.slice(0, 300),
    amountInWords: amountToFrenchWords(args.terms.amount, args.terms.currency),
    requestNote: args.note.trim() || undefined,
    borrowerReceive: args.receive ? clean(args.receive) : undefined,
    borrowerPaymentLink: args.receive?.method !== 'virement' ? args.receive?.value || undefined : undefined,
    status: 'requested',
    initiatedBy: 'borrower',
    createdAt: now,
  }));
  await sendNotification({
    userId: args.lenderUid, loanId: ref.id, type: 'action_required', title: 'Nouvelle demande',
    message: `${firstName(args.identity.fullName)} te demande ${args.terms.amount} ${args.terms.currency}.`,
  });
  return ref.id;
};

/** Le prêteur accepte la demande : son identité complète le contrat, il signe. */
export const acceptRequest = async (loan: Loan, user: User, profile: Profile, lenderSignature: string) => {
  const merged = { ...loan, ...lenderFields(profile, user) } as Loan;
  const b: BorrowerIdentity = {
    civility: loan.borrowerCivility, fullName: loan.borrowerName, birthDate: loan.borrowerBirthDate,
    birthPlace: loan.borrowerBirthPlace, address: loan.borrowerAddress,
  };
  const texts = await buildTexts(merged, b);
  const now = new Date().toISOString();
  await updateDoc(doc(db, LOANS, loan.id), {
    ...lenderFields(profile, user),
    ...texts,
    contractVersion: CONTRACT_VERSION,
    lenderSignature,
    lenderAttestation: `Prêt personnel et occasionnel attesté le ${now}`,
    status: 'active',
    signedDate: now,
  });
  if (loan.borrowerUid) {
    await sendNotification({
      userId: loan.borrowerUid, loanId: loan.id, type: 'success', title: 'Demande acceptée',
      message: `${firstName(profile.fullName)} a accepté de te prêter ${loan.amount} ${loan.currency}.`,
    });
  }
};

export const declineRequest = async (loan: Loan, lenderFirstName: string, silent = false) => {
  await updateDoc(doc(db, LOANS, loan.id), { status: 'declined' });
  if (loan.borrowerUid && !silent) {
    await sendNotification({
      userId: loan.borrowerUid, loanId: loan.id, type: 'warning', title: 'Demande non retenue',
      message: `${lenderFirstName} n'a pas pu accepter ta demande de ${loan.amount} ${loan.currency}.`,
    });
  }
};

export const deleteOffer = async (loan: Loan) => {
  if (loan.inviteToken) await deleteDoc(doc(db, "invites", loan.inviteToken)).catch(() => undefined);
  await deleteDoc(doc(db, LOANS, loan.id));
};

// --- PAIEMENTS --------------------------------------------------------------

export const getLoanPayments = async (loanId: string): Promise<Payment[]> => {
  const snap = await getDocs(paymentsCol(loanId));
  const out: Payment[] = [];
  snap.forEach(d => out.push({ id: d.id, ...d.data() } as Payment));
  return out.sort((a, b) => a.date.localeCompare(b.date));
};

export const declarePayment = async (loan: Loan, p: { amount: number; date: string; method: string; proof?: string | null }) => {
  await addDoc(paymentsCol(loan.id), clean({
    amount: Math.round(p.amount * 100) / 100, date: p.date, method: p.method, proof: p.proof || undefined,
    status: 'declared', declaredBy: 'borrower', declaredAt: new Date().toISOString(),
  }));
  if (loan.lenderUid) {
    await sendNotification({
      userId: loan.lenderUid, loanId: loan.id, type: 'action_required', title: 'Paiement déclaré',
      message: `${loan.borrowerNickname || firstName(loan.borrowerName)} dit t'avoir versé ${p.amount} ${loan.currency}.`,
      actionType: 'review_payment',
    });
  }
};

export const recordPaymentByLender = async (loan: Loan, p: { amount: number; date: string; method: string }) => {
  const now = new Date().toISOString();
  await addDoc(paymentsCol(loan.id), {
    amount: Math.round(p.amount * 100) / 100, date: p.date, method: p.method,
    status: 'confirmed', declaredBy: 'lender', declaredAt: now, confirmedAt: now,
  });
};

export const reviewPayment = async (loanId: string, paymentId: string, accept: boolean) => {
  await updateDoc(doc(db, LOANS, loanId, "payments", paymentId), {
    status: accept ? 'confirmed' : 'rejected', confirmedAt: new Date().toISOString(),
  });
};

export const confirmPendingPayments = async (loanId: string) => {
  const payments = await getLoanPayments(loanId);
  await Promise.all(payments.filter(p => p.status === 'declared').map(p => reviewPayment(loanId, p.id, true)));
};

export const markLoanPaid = async (loanId: string) => {
  await updateDoc(doc(db, LOANS, loanId), { status: 'paid' });
};

// --- DÉLAIS -----------------------------------------------------------------

export const requestDelay = async (loan: Loan, newDate: string, quote?: { principal: number; interest: number; total: number }, lateRate = 0) => {
  await updateDoc(doc(db, LOANS, loan.id), {
    status: 'delay_requested', delayProposedDate: newDate, delayRequestDate: new Date().toISOString(),
  });
  if (loan.lenderUid) {
    await sendNotification({
      userId: loan.lenderUid, loanId: loan.id, type: 'action_required', title: 'Demande de délai',
      message: quote
        ? `${loan.borrowerNickname || firstName(loan.borrowerName)} propose de payer le ${new Date(newDate).toLocaleDateString('fr-FR')} : ${quote.principal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € + ${quote.interest.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € d'intérêts de retard${lateRate ? ` (${lateRate.toLocaleString('fr-FR')} %/an)` : ''} = ${quote.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €.`
        : `${loan.borrowerNickname || firstName(loan.borrowerName)} propose de reporter au ${new Date(newDate).toLocaleDateString('fr-FR')}.`,
      actionType: 'review_delay',
    });
  }
};

export const respondToDelay = async (loan: Loan, accepted: boolean, keepLateInterest = true) => {
  if (!loan.delayProposedDate) return;
  const newDate = loan.delayProposedDate;
  const updates: Record<string, unknown> = { status: 'active', delayProposedDate: deleteField(), delayRequestDate: deleteField() };
  if (accepted) {
    const paidTotal = (loan.payments || []).filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0);
    let covered = paidTotal;
    const schedule = (loan.schedule || []).map(inst => {
      const fullyPaid = covered >= inst.amount - 0.004;
      covered = Math.max(0, covered - inst.amount);
      if (fullyPaid || inst.dueDate >= newDate) return inst;
      // Intérêts de retard maintenus : ils continuent de courir depuis l'échéance d'origine.
      return keepLateInterest ? { ...inst, dueDate: newDate, lateFrom: inst.lateFrom || inst.dueDate } : { ...inst, dueDate: newDate };
    });
    updates.schedule = schedule;
    const last = schedule.length ? schedule[schedule.length - 1].dueDate : newDate;
    updates.repaymentDate = last > newDate ? last : newDate;
    updates.amendments = [...(loan.amendments || []),
      { type: 'report_echeance', newDate, acceptedAt: new Date().toISOString(), requestedAt: loan.delayRequestDate, lateInterestKept: keepLateInterest }];
  }
  await updateDoc(doc(db, LOANS, loan.id), updates as any);
  if (loan.borrowerUid) {
    await sendNotification({
      userId: loan.borrowerUid, loanId: loan.id, type: accepted ? 'success' : 'warning',
      title: accepted ? 'Délai accepté' : 'Délai refusé',
      message: accepted
        ? `Report accepté au ${new Date(newDate).toLocaleDateString('fr-FR')}${keepLateInterest ? ', les intérêts de retard continuent de courir' : ''}.`
        : `Le report demandé n'a pas été accepté.`,
    });
  }
};

// --- LECTURE ----------------------------------------------------------------

const withPayments = async (loan: Loan): Promise<Loan> => {
  try { return { ...loan, payments: await getLoanPayments(loan.id) }; } catch { return { ...loan, payments: [] }; }
};

export const getLoanById = async (loanId: string): Promise<Loan | null> => {
  const snap = await getDoc(doc(db, LOANS, loanId));
  return snap.exists() ? withPayments({ id: snap.id, ...snap.data() } as Loan) : null;
};

export const getUserLoans = async (uid: string): Promise<Loan[]> => {
  const ref = collection(db, LOANS);
  const [asLender, asBorrower] = await Promise.all([
    getDocs(query(ref, where("lenderUid", "==", uid))),
    getDocs(query(ref, where("borrowerUid", "==", uid))),
  ]);
  const map = new Map<string, Loan>();
  asLender.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Loan));
  asBorrower.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Loan));
  const loans = await Promise.all(Array.from(map.values()).map(withPayments));
  return loans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

/** Proches déjà connus du prêteur (pour les choisir en un geste). */
export interface KnownFriend { uid?: string; nickname: string; phone?: string; lastLoan: Loan }
export const knownFriends = (loans: Loan[], lenderUid: string): KnownFriend[] => {
  const map = new Map<string, KnownFriend>();
  loans.filter(l => l.lenderUid === lenderUid)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach(l => {
      const key = l.borrowerUid || l.borrowerPhone || l.borrowerNickname || l.borrowerName;
      if (!key) return;
      map.set(key, { uid: l.borrowerUid, nickname: l.borrowerNickname || firstName(l.borrowerName), phone: l.borrowerPhone, lastLoan: l });
    });
  return Array.from(map.values()).reverse();
};

/** Le prêteur indique qu'il a envoyé l'argent ; l'ami est prévenu. */
export const markFundsSent = async (loan: Loan) => {
  await updateDoc(doc(db, LOANS, loan.id), { fundsSentAt: new Date().toISOString() });
  if (loan.borrowerUid) await sendNotification({
    userId: loan.borrowerUid, loanId: loan.id, type: 'success', title: 'Argent envoyé',
    message: `${firstName(loan.lenderName)} t'a envoyé ${loan.amount} ${loan.currency}.`,
  });
};
