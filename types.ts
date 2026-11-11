
export interface Loan {
  id: string;
  // Lender Details
  lenderName: string;
  lenderEmail: string;
  lenderCivility: 'M.' | 'Mme';
  lenderBirthDate: string;
  lenderBirthPlace: string;
  lenderAddress: string;
  lenderSignature: string;
  
  // Payment Preferences
  lenderIban?: string;
  lenderPaymentLink?: string;

  // Borrower Details (Remplis par le prêteur désormais)
  borrowerName: string;
  borrowerCivility: 'M.' | 'Mme';
  borrowerBirthDate: string;
  borrowerBirthPlace: string;
  borrowerAddress: string;
  borrowerEmail?: string; 
  borrowerPhone?: string; // Format international sans +, ex: 33612345678
  
  // La signature emprunteur est désormais sur le document papier uploadé
  borrowerSignature?: string; 

  // Loan Details
  amount: number;
  currency: string;
  loanDate: string;
  repaymentDate: string; // date de la dernière échéance

  // Intérêts conventionnels et échéancier
  interestRate?: number;                         // % annuel, 0 = prêt gratuit
  repaymentType?: 'in_fine' | 'monthly';
  installmentsCount?: number;
  schedule?: import('./utils/schedule').Installment[];
  payments?: Payment[];

  // Intérêts de retard : aucun, taux légal, ou taux convenu (plafonné)
  lateRateMode?: 'none' | 'legal' | 'custom';

  // Attestation du prêteur (prêt occasionnel, non professionnel)
  lenderAttestation?: string;

  // Contrat figé et signature électronique de l'emprunteur
  contractVersion?: string;
  acknowledgmentText?: string;      // reconnaissance de dette
  contractHash?: string;            // SHA-256 du contrat + reconnaissance
  amendments?: { type: string; newDate: string; acceptedAt: string; requestedAt?: string }[];
  amountInWords?: string;           // montant en lettres attendu
  borrowerAmountWords?: string;     // mention saisie par l'emprunteur (art. 1376)
  borrowerSignedName?: string;
  borrowerSignedAt?: string;
  borrowerSignedHash?: string;      // empreinte du texte au moment de la signature
  borrowerSignedUserAgent?: string;
  borrowerUid?: string;
  lenderUid?: string;

  // Status
  status: 'pending_borrower' | 'active' | 'repayment_pending' | 'paid' | 'delay_requested';
  lateInterestRate?: number;
  
  // Contract Data
  contractText?: string;
  city?: string;
  country?: string; // Pays du prêteur (contexte signature)
  
  // Champs spécifiques pour l'automatisation
  lenderCountry?: string;
  borrowerCountry?: string;

  signedDate?: string;
  signedContractUrl?: string; // URL/Base64 du contrat scanné

  // Repayment Data
  repaymentDeclaredDate?: string;
  repaymentMethod?: string;
  repaymentProof?: string;

  // Delay / Amendment Request
  delayProposedDate?: string; 
  delayRequestDate?: string; 

  createdAt: string;
}

export interface Payment {
  id: string;
  date: string;            // date du paiement (YYYY-MM-DD)
  amount: number;
  method: string;
  status: 'declared' | 'confirmed' | 'rejected';
  declaredBy: 'borrower' | 'lender';
  declaredAt: string;
  confirmedAt?: string;
  proof?: string;          // capture (data URL), optionnelle
}

export interface Notification {
  id: string;
  userId: string;
  loanId: string;
  type: 'info' | 'warning' | 'danger' | 'success' | 'action_required';
  title: string;
  message: string;
  date: string;
  read: boolean;
  actionType?: 'review_delay' | 'review_payment';
}

export interface CalculationResult {
  daysLate: number;
  interestAmount: number;
  totalDue: number;
  isOverdue: boolean;
  daysRemaining: number;
  dailyCost: number; // Coût par jour
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

/** Profil du prêteur, saisi une seule fois (collection profiles/{uid}). */
export interface Profile {
  civility: 'M.' | 'Mme';
  fullName: string;
  birthDate: string;
  birthPlace: string;   // « Ville, Pays »
  address: string;
  iban?: string;
  paymentLink?: string;
  signature?: string;   // signature dessinée, réutilisable
  updatedAt?: string;
}

export const isProfileComplete = (p: Profile | null | undefined): p is Profile =>
  !!p && !!p.fullName && !!p.birthDate && !!p.birthPlace && p.birthPlace.includes(',') && !!p.address;
