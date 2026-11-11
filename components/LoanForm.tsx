
import React, { useState, useEffect } from 'react';
import { Loan, User } from '../types';
import { X, Loader2, User as UserIcon, Send, CreditCard, CheckCircle2, Copy, Printer, ArrowRight, ArrowLeft, Coins, Lock, FileText, UserPlus, AlertTriangle, MessageCircle, Phone } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { createLoanRequest } from '../services/loanService';
import CityInput from './CityInput';
import { buildSchedule, addMonths, formatMoney } from '../utils/schedule';
import { buildLoanContract, buildDebtAcknowledgment, sha256Hex, CONTRACT_VERSION } from '../utils/contract';
import { amountToFrenchWords } from '../utils/frenchNumbers';
import {
  RATE_CAP, RATE_CAP_LABEL, LEGAL_INTEREST_RATE, LEGAL_INTEREST_LABEL, MAX_INSTALLMENTS,
  WRITTEN_PROOF_THRESHOLD_EUR, HABITUAL_LENDING_WARNING_COUNT, DECLARATION_THRESHOLD_EUR,
} from '../config/legal';
import { annualTotalsForBorrower, loansInLast12Months } from '../utils/compliance';

interface LoanFormProps {
  onClose: () => void;
  user: User; // Le prêteur connecté
  existingLoans?: Loan[];
  onSuccess?: () => void;
  onViewContract?: (loan: Loan) => void;
}

export const inviteLinkFor = (loanId: string) => `${window.location.origin}/?pret=${loanId}`;

const CURRENCIES = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'XAF', symbol: 'FCFA' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'GBP', symbol: '£' }
];

const PHONE_PREFIXES = [
    { code: '33', country: 'FR (+33)' },
    { code: '237', country: 'CM (+237)' },
    { code: '1', country: 'US/CA (+1)' },
    { code: '32', country: 'BE (+32)' },
    { code: '41', country: 'CH (+41)' },
    { code: '44', country: 'UK (+44)' },
    { code: '225', country: 'CI (+225)' },
    { code: '221', country: 'SN (+221)' },
];

const InputGroup = ({ label, children }: { label: string, children?: React.ReactNode }) => (
  <div className="space-y-1 w-full">
    <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const LoanForm: React.FC<LoanFormProps> = ({ onClose, user, existingLoans = [], onSuccess, onViewContract }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 to 6
  const [createdLoan, setCreatedLoan] = useState<Loan | null>(null);
  const [lenderSignature, setLenderSignature] = useState('');
  const [attested, setAttested] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Payment Handle Logic
  const [paymentProvider, setPaymentProvider] = useState<'paypal' | 'lydia'>('paypal');
  const [paymentHandle, setPaymentHandle] = useState('');

  // Phone Logic
  const [phonePrefix, setPhonePrefix] = useState('33');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [formData, setFormData] = useState({
    // Prêteur
    lenderCivility: 'M.' as 'M.' | 'Mme',
    lenderBirthDate: '',
    lenderBirthPlace: '', 
    lenderCountry: '',
    lenderAddress: '',
    lenderIban: '',
    
    // Emprunteur (Saisi par le prêteur)
    borrowerName: '',
    borrowerCivility: 'M.' as 'M.' | 'Mme',
    borrowerBirthDate: '',
    borrowerBirthPlace: '',
    borrowerCountry: '',
    borrowerAddress: '',
    borrowerEmail: '',

    // Prêt
    amount: '',
    currency: 'EUR',
    loanDate: new Date().toISOString().split('T')[0],
    repaymentType: 'in_fine' as 'in_fine' | 'monthly',
    repaymentDate: '',
    installmentsCount: 6,
    firstDueDate: addMonths(new Date().toISOString().split('T')[0], 1),
    interestRate: 0,
    lateRateMode: 'legal' as 'none' | 'legal' | 'custom',
    lateInterestRate: 3,
  });

  const amountNum = parseFloat(formData.amount) || 0;
  const schedule = amountNum > 0 && (formData.repaymentType === 'monthly' || formData.repaymentDate)
    ? buildSchedule({
        amount: amountNum,
        annualRate: formData.interestRate,
        loanDate: formData.loanDate,
        repaymentType: formData.repaymentType,
        repaymentDate: formData.repaymentDate,
        installments: formData.installmentsCount,
        firstDueDate: formData.firstDueDate,
      })
    : [];
  const totalInterest = schedule.reduce((s, i) => s + i.interest, 0);
  const loanYear = parseInt(formData.loanDate.slice(0, 4), 10);
  const borrowerKey = formData.borrowerEmail.trim().toLowerCase() || formData.borrowerName.trim().toLowerCase();
  const [priorYearTotal, setPriorYearTotal] = useState(0);
  const [eurAmount, setEurAmount] = useState(0);
  useEffect(() => {
    let alive = true;
    annualTotalsForBorrower(existingLoans, borrowerKey, loanYear).then(t => { if (alive) setPriorYearTotal(t); });
    import('../services/exchangeRate').then(m => m.fetchExchangeRate(amountNum, formData.currency)).then(v => { if (alive) setEurAmount(v); });
    return () => { alive = false; };
  }, [existingLoans, borrowerKey, loanYear, amountNum, formData.currency]);
  const cumulativeEur = priorYearTotal + eurAmount;
  const recentLoans = loansInLast12Months(existingLoans, user.email);

  // Extraction auto du pays (Prêteur)
  useEffect(() => {
    if (formData.lenderBirthPlace.includes(',')) {
        const parts = formData.lenderBirthPlace.split(',');
        if (parts.length > 1) setFormData(prev => ({ ...prev, lenderCountry: parts[1].trim() }));
    }
  }, [formData.lenderBirthPlace]);

  // Extraction auto du pays (Emprunteur)
  useEffect(() => {
    if (formData.borrowerBirthPlace.includes(',')) {
        const parts = formData.borrowerBirthPlace.split(',');
        if (parts.length > 1) setFormData(prev => ({ ...prev, borrowerCountry: parts[1].trim() }));
    }
  }, [formData.borrowerBirthPlace]);

  const getFullPaymentLink = () => {
      if (!paymentHandle) return '';
      if (paymentProvider === 'paypal') return `paypal.me/${paymentHandle}`;
      if (paymentProvider === 'lydia') return `lydia-app.com/collect/${paymentHandle}`;
      return '';
  };

  const validateStep = (currentStep: number) => {
      switch(currentStep) {
          case 1: // Identité Prêteur
              return formData.lenderBirthDate && formData.lenderBirthPlace.includes(',') && formData.lenderAddress;
          case 2: // Paiement
              return true; // Optionnel
          case 3: // Identité Emprunteur
              return formData.borrowerName && formData.borrowerBirthDate && formData.borrowerBirthPlace.includes(',') && formData.borrowerAddress
                && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.borrowerEmail.trim())
                && formData.borrowerEmail.trim().toLowerCase() !== user.email.toLowerCase();
          case 4: // Détails Prêt
              if (!formData.amount || amountNum <= 0) return false;
              if (formData.interestRate < 0 || formData.interestRate > RATE_CAP) return false;
              if (formData.repaymentType === 'in_fine') {
                if (!formData.repaymentDate) return false;
                if (formData.repaymentDate <= formData.loanDate) return false;
              } else {
                if (formData.installmentsCount < 2 || formData.installmentsCount > MAX_INSTALLMENTS) return false;
                if (!formData.firstDueDate || formData.firstDueDate <= formData.loanDate) return false;
              }
              return schedule.length > 0;
          case 5: // Clause
              return formData.lateRateMode !== 'custom' || (formData.lateInterestRate > 0 && formData.lateInterestRate <= RATE_CAP);
          case 6: // Signature
              return !!lenderSignature && attested;
          default: return false;
      }
  };

  const handleNext = () => {
      if (validateStep(step)) {
          setStep(step + 1);
      } else {
          alert("Veuillez remplir correctement tous les champs obligatoires.");
      }
  };

  const formatPhoneNumber = () => {
      if (!phoneNumber) return undefined;
      // Enlever le 0 initial s'il existe
      let cleanNumber = phoneNumber.replace(/\D/g, ''); // Garder que les chiffres
      if (cleanNumber.startsWith('0')) cleanNumber = cleanNumber.substring(1);
      return `${phonePrefix}${cleanNumber}`;
  };

  const handleSubmit = async () => {
    if (!validateStep(6)) return;
    setLoading(true);

    try {
      // 1. Préparer l'objet Loan
      const lastDue = schedule[schedule.length - 1].dueDate;
      const loanData: any = {
        // Lender
        lenderUid: user.id,
        lenderName: user.name,
        lenderEmail: user.email.toLowerCase(),
        lenderCivility: formData.lenderCivility,
        lenderBirthDate: formData.lenderBirthDate,
        lenderBirthPlace: formData.lenderBirthPlace,
        lenderCountry: formData.lenderCountry,
        lenderAddress: formData.lenderAddress,
        lenderSignature: lenderSignature,
        lenderIban: formData.lenderIban,
        lenderPaymentLink: getFullPaymentLink(),

        // Borrower (Saisi par le prêteur)
        borrowerName: formData.borrowerName,
        borrowerCivility: formData.borrowerCivility,
        borrowerBirthDate: formData.borrowerBirthDate,
        borrowerBirthPlace: formData.borrowerBirthPlace,
        borrowerCountry: formData.borrowerCountry,
        borrowerAddress: formData.borrowerAddress,
        borrowerPhone: formatPhoneNumber(),
        borrowerEmail: formData.borrowerEmail.trim().toLowerCase(),

        // Loan
        amount: amountNum,
        currency: formData.currency,
        loanDate: formData.loanDate,
        repaymentDate: lastDue,
        repaymentType: schedule.length > 1 ? 'monthly' : 'in_fine',
        installmentsCount: schedule.length,
        schedule,
        interestRate: formData.interestRate,
        lateRateMode: formData.lateRateMode,
        lateInterestRate: formData.lateRateMode === 'custom' ? formData.lateInterestRate : 0,
        amountInWords: amountToFrenchWords(amountNum, formData.currency),
        lenderAttestation: `Prêt personnel et occasionnel attesté le ${new Date().toISOString()}`,
        contractVersion: CONTRACT_VERSION,
        
        status: 'pending_borrower',
        createdAt: new Date().toISOString(),
        
        // Context pour le contrat
        city: formData.lenderAddress.split(',').pop()?.trim() || 'Ville',
        country: formData.lenderCountry || 'Pays'
      };

      // 2. Rédiger le contrat et la reconnaissance de dette (modèle fixe) et les figer
      loanData.contractText = buildLoanContract(loanData);
      loanData.acknowledgmentText = buildDebtAcknowledgment(loanData);
      loanData.contractHash = await sha256Hex(loanData.contractText + '\n\n' + loanData.acknowledgmentText);

      // 3. Sauvegarder
      const loanId = await createLoanRequest(loanData);
      const newLoan = { id: loanId, ...loanData };
      setCreatedLoan(newLoan);
      
      // 4. Mettre à jour le dashboard immédiatement
      if (onSuccess) onSuccess();

    } catch (error) {
      console.error(error);
      alert("Erreur lors de la création. Vérifiez que votre adresse email est vérifiée et que les règles Firestore sont publiées.");
    } finally {
      setLoading(false);
    }
  };

  // --- ÉCRAN SUCCÈS ---
  if (createdLoan) {
      // Message adapté pour refléter la limitation de WhatsApp
      const inviteLink = inviteLinkFor(createdLoan.id);
      let whatsappText = `Salut ${createdLoan.borrowerName}, voici le contrat pour le prêt de ${createdLoan.amount} ${createdLoan.currency}. Tu peux le lire et le signer ici, en te connectant avec ton adresse ${createdLoan.borrowerEmail} : ${inviteLink}`;
      
      const whatsappLink = createdLoan.borrowerPhone 
        ? `https://wa.me/${createdLoan.borrowerPhone}?text=${encodeURIComponent(whatsappText)}`
        : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

      return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="text-emerald-600" size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Contrat prêt !</h2>
                <p className="text-slate-500 mb-6 leading-relaxed text-sm">
                    Contrat et reconnaissance de dette générés. Envoyez le lien de signature à {createdLoan.borrowerName} : il devra se connecter avec <strong>{createdLoan.borrowerEmail}</strong>.
                </p>

                <div className="mb-4 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                    <span className="flex-1 text-left text-xs font-mono text-slate-600 break-all">{inviteLink}</span>
                    <button
                        onClick={() => { navigator.clipboard.writeText(inviteLink); setCopied(true); }}
                        className="shrink-0 px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                    >
                        {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied ? 'Copié' : 'Copier'}
                    </button>
                </div>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => { 
                            if (onViewContract) onViewContract(createdLoan);
                        }} 
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"
                    >
                        <Printer size={18} /> VOIR / TÉLÉCHARGER LE PDF
                    </button>
                    
                    <a 
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#128C7E] transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-100"
                    >
                        <MessageCircle size={18} /> ENVOYER LE LIEN PAR WHATSAPP
                    </a>

                    <button onClick={onClose} className="w-full py-4 bg-white text-slate-900 border-2 border-slate-100 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all">
                        Retour au Tableau de Bord
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 min-h-screen sm:min-h-0 sm:my-8 border border-slate-100 flex flex-col">
        {/* ... (Le reste du formulaire reste inchangé) ... */}
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
          <div>
             <h2 className="text-lg font-black text-slate-900">Nouveau Contrat</h2>
             <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mt-1 text-slate-400">
                 <span className={step === 1 ? "text-indigo-600" : ""}>1.Vous</span>/
                 <span className={step === 2 ? "text-indigo-600" : ""}>2.Pay</span>/
                 <span className={step === 3 ? "text-indigo-600" : ""}>3.Lui</span>/
                 <span className={step === 4 ? "text-indigo-600" : ""}>4.Prêt</span>/
                 <span className={step === 5 ? "text-indigo-600" : ""}>5.Retard</span>/
                 <span className={step === 6 ? "text-indigo-600" : ""}>6.Sign</span>
             </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
            
            {/* STEP 1: PRÊTEUR */}
            {step === 1 && (
                <div className="space-y-5 animate-in slide-in-from-right-8 duration-300">
                    <div className="bg-indigo-50 p-4 rounded-2xl flex items-center gap-3 text-indigo-800 mb-2">
                        <UserIcon size={20} />
                        <span className="font-bold text-sm">Vos Informations (Prêteur)</span>
                    </div>

                    <InputGroup label="Civilité">
                        <select value={formData.lenderCivility} onChange={e => setFormData({...formData, lenderCivility: e.target.value as any})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none">
                            <option value="M.">Monsieur</option>
                            <option value="Mme">Madame</option>
                        </select>
                    </InputGroup>

                    <InputGroup label="Votre Nom">
                        <input disabled value={user.name} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-bold" />
                    </InputGroup>

                    <InputGroup label="Date de Naissance">
                        <input required type="date" value={formData.lenderBirthDate} onChange={e => setFormData({...formData, lenderBirthDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                    </InputGroup>

                    <CityInput label="Ville de Naissance" value={formData.lenderBirthPlace} onChange={(val) => setFormData({...formData, lenderBirthPlace: val})} required />
                    
                    {formData.lenderCountry && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Pays (Automatique)</label>
                            <div className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm">
                                {formData.lenderCountry}
                            </div>
                        </div>
                    )}

                    <InputGroup label="Adresse Complète">
                        <input required placeholder="12 rue de la Paix..." value={formData.lenderAddress} onChange={e => setFormData({...formData, lenderAddress: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                    </InputGroup>
                </div>
            )}

            {/* STEP 2: PAIEMENT */}
            {step === 2 && (
                <div className="space-y-5 animate-in slide-in-from-right-8 duration-300">
                    <div className="bg-emerald-50 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 mb-2">
                        <CreditCard size={20} />
                        <span className="font-bold text-sm">Vos préférences de remboursement</span>
                    </div>

                    <InputGroup label="Votre IBAN (Recommandé)">
                        <input placeholder="FR76 ...." value={formData.lenderIban} onChange={e => setFormData({...formData, lenderIban: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-mono uppercase" />
                    </InputGroup>

                    <div className="pt-4 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 block">Paiement Mobile (Optionnel)</label>
                        <div className="bg-slate-50 p-1 rounded-xl flex mb-3">
                            <button onClick={() => setPaymentProvider('paypal')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${paymentProvider === 'paypal' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>PayPal</button>
                            <button onClick={() => setPaymentProvider('lydia')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${paymentProvider === 'lydia' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Lydia</button>
                        </div>
                        
                        <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden focus-within:border-indigo-500 transition-colors">
                            <div className="bg-slate-100 px-3 py-3 text-xs font-bold text-slate-500 border-r border-slate-200">
                                {paymentProvider === 'paypal' ? 'paypal.me/' : 'lydia-app.com/collect/'}
                            </div>
                            <input 
                                placeholder="votre_pseudo" 
                                value={paymentHandle} 
                                onChange={e => setPaymentHandle(e.target.value)} 
                                className="flex-1 px-3 py-3 outline-none text-sm font-bold text-slate-900"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: EMPRUNTEUR */}
            {step === 3 && (
                <div className="space-y-5 animate-in slide-in-from-right-8 duration-300">
                    <div className="bg-indigo-50 p-4 rounded-2xl flex items-center gap-3 text-indigo-800 mb-2">
                        <UserPlus size={20} />
                        <span className="font-bold text-sm">Informations de l'Ami (Emprunteur)</span>
                    </div>

                    <InputGroup label="Civilité">
                        <select value={formData.borrowerCivility} onChange={e => setFormData({...formData, borrowerCivility: e.target.value as any})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none">
                            <option value="M.">Monsieur</option>
                            <option value="Mme">Madame</option>
                        </select>
                    </InputGroup>

                    <InputGroup label="Nom Complet de l'ami">
                        <input required placeholder="Prénom Nom" value={formData.borrowerName} onChange={e => setFormData({...formData, borrowerName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold" />
                    </InputGroup>
                    
                    <InputGroup label="Email de l'ami (pour signer en ligne)">
                        <input required type="email" placeholder="ami@email.com" value={formData.borrowerEmail} onChange={e => setFormData({...formData, borrowerEmail: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                        <p className="text-[10px] text-slate-400 ml-1">Il devra se connecter avec cette adresse pour voir et signer le contrat. Personne d'autre n'y aura accès.</p>
                    </InputGroup>

                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                         <label className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-1 block">Numéro WhatsApp (optionnel)</label>
                         <div className="flex gap-2">
                             <select 
                                value={phonePrefix} 
                                onChange={e => setPhonePrefix(e.target.value)}
                                className="px-2 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold w-28"
                             >
                                 {PHONE_PREFIXES.map(p => <option key={p.code} value={p.code}>{p.country}</option>)}
                             </select>
                             <input 
                                type="tel" 
                                placeholder="6 12 34 56 78" 
                                value={phoneNumber} 
                                onChange={e => setPhoneNumber(e.target.value)}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm" 
                             />
                         </div>
                    </div>

                    <InputGroup label="Date de Naissance">
                        <input required type="date" value={formData.borrowerBirthDate} onChange={e => setFormData({...formData, borrowerBirthDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                    </InputGroup>

                    <CityInput label="Ville de Naissance" value={formData.borrowerBirthPlace} onChange={(val) => setFormData({...formData, borrowerBirthPlace: val})} required />
                    
                    {formData.borrowerCountry && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Pays (Automatique)</label>
                            <div className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm">
                                {formData.borrowerCountry}
                            </div>
                        </div>
                    )}

                    <InputGroup label="Adresse Complète">
                        <input required placeholder="Adresse..." value={formData.borrowerAddress} onChange={e => setFormData({...formData, borrowerAddress: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                    </InputGroup>
                </div>
            )}

            {/* STEP 4: LE PRÊT */}
            {step === 4 && (
                <div className="space-y-5 animate-in slide-in-from-right-8 duration-300">
                    <div className="bg-amber-50 p-4 rounded-2xl flex items-center gap-3 text-amber-800 mb-2">
                        <Coins size={20} />
                        <span className="font-bold text-sm">Détails du Prêt</span>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 ml-1">MONTANT</label>
                            <input required type="number" min="1" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 text-3xl font-black text-slate-900 outline-none" placeholder="0.00" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 ml-1">DEVISE</label>
                            <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="w-full px-5 py-3 rounded-xl border-2 border-slate-100 font-bold bg-white outline-none">
                                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                            </select>
                        </div>
                    </div>

                    <InputGroup label="Date de remise des fonds">
                        <input required type="date" value={formData.loanDate} onChange={e => setFormData({...formData, loanDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                    </InputGroup>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wide">Remboursement</label>
                        <div className="bg-slate-50 p-1 rounded-xl flex">
                            <button type="button" onClick={() => setFormData({...formData, repaymentType: 'in_fine'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.repaymentType === 'in_fine' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>En une fois</button>
                            <button type="button" onClick={() => setFormData({...formData, repaymentType: 'monthly'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.repaymentType === 'monthly' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Mensualités</button>
                        </div>
                    </div>

                    {formData.repaymentType === 'in_fine' ? (
                        <InputGroup label="Date limite de remboursement">
                            <input required type="date" value={formData.repaymentDate} onChange={e => setFormData({...formData, repaymentDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                        </InputGroup>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <InputGroup label="Nombre de mois">
                                <input type="number" min={2} max={MAX_INSTALLMENTS} value={formData.installmentsCount} onChange={e => setFormData({...formData, installmentsCount: parseInt(e.target.value, 10) || 0})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                            </InputGroup>
                            <InputGroup label="1re échéance">
                                <input type="date" value={formData.firstDueDate} onChange={e => setFormData({...formData, firstDueDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                            </InputGroup>
                        </div>
                    )}

                    <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-700 uppercase">Intérêts (taux annuel)</label>
                            <span className="text-lg font-black text-indigo-600">{formData.interestRate === 0 ? 'Sans intérêt' : `${formData.interestRate.toLocaleString('fr-FR')} %`}</span>
                        </div>
                        <input type="range" min="0" max={RATE_CAP} step="0.25" value={formData.interestRate} onChange={e => setFormData({...formData, interestRate: parseFloat(e.target.value)})} className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            Plafond prudent : {RATE_CAP.toLocaleString('fr-FR')} % ({RATE_CAP_LABEL}). Les intérêts reçus sont imposables pour vous (prélèvement forfaitaire unique). Entre amis, un prêt sans intérêt reste le plus simple.
                        </p>
                    </div>

                    {schedule.length > 0 && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                            <div className="flex justify-between font-bold text-slate-700">
                                <span>{schedule.length > 1 ? `${schedule.length} mensualités de` : 'Remboursement unique'}</span>
                                <span>{formatMoney(schedule[0].amount, formData.currency)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500"><span>Intérêts totaux</span><span>{formatMoney(totalInterest, formData.currency)}</span></div>
                            <div className="flex justify-between text-slate-500"><span>Dernière échéance</span><span>{new Date(schedule[schedule.length - 1].dueDate).toLocaleDateString('fr-FR')}</span></div>
                            <div className="pt-1 text-slate-400 italic">« {amountToFrenchWords(amountNum, formData.currency)} »</div>
                        </div>
                    )}

                    {cumulativeEur > DECLARATION_THRESHOLD_EUR && (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                            <strong>Déclaration 2062 obligatoire.</strong> Avec ce prêt, le total prêté à {formData.borrowerName || 'cet ami'} en {loanYear} atteint environ {Math.round(cumulativeEur).toLocaleString('fr-FR')} €. Le prêt devra être déclaré avec les revenus {loanYear}, au printemps {loanYear + 1} (par l'emprunteur, ou par vous à défaut).
                        </div>
                    )}
                    {eurAmount > 0 && eurAmount <= WRITTEN_PROOF_THRESHOLD_EUR && (
                        <p className="text-[10px] text-slate-400">Sous {WRITTEN_PROOF_THRESHOLD_EUR.toLocaleString('fr-FR')} €, l'écrit n'est pas obligatoire mais reste la meilleure preuve.</p>
                    )}
                </div>
            )}

            {/* STEP 5: CLAUSE */}
            {step === 5 && (
                <div className="space-y-5 animate-in slide-in-from-right-8 duration-300">
                    <div className="bg-rose-50 p-4 rounded-2xl flex items-center gap-3 text-rose-800 mb-2">
                        <AlertTriangle size={20} />
                        <span className="font-bold text-sm">En cas de retard de paiement</span>
                    </div>
                    {([
                        ['legal', 'Intérêt au taux légal (recommandé)', `${LEGAL_INTEREST_RATE.toLocaleString('fr-FR')} % par an au ${LEGAL_INTEREST_LABEL}, révisé chaque semestre. Le plus sûr juridiquement.`],
                        ['none', 'Aucune pénalité', "Le taux légal reste réclamable après une mise en demeure (art. 1231-6 C. civ.)."],
                        ['custom', 'Taux fixé par vous', `Plafonné à ${RATE_CAP.toLocaleString('fr-FR')} % par an. Un juge peut réduire une pénalité excessive (art. 1231-5).`],
                    ] as const).map(([mode, title, desc]) => (
                        <button key={mode} type="button" onClick={() => setFormData({...formData, lateRateMode: mode})}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${formData.lateRateMode === mode ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 bg-white'}`}>
                            <div className="font-bold text-sm text-slate-900">{title}</div>
                            <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{desc}</div>
                        </button>
                    ))}
                    {formData.lateRateMode === 'custom' && (
                        <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-700 uppercase">Taux de retard annuel</label>
                                <span className="text-lg font-black text-rose-600">{formData.lateInterestRate.toLocaleString('fr-FR')} %</span>
                            </div>
                            <input type="range" min="0.5" max={RATE_CAP} step="0.25" value={formData.lateInterestRate} onChange={(e) => setFormData({...formData, lateInterestRate: parseFloat(e.target.value)})} className="w-full h-2 bg-rose-200 rounded-lg appearance-none cursor-pointer accent-rose-600" />
                        </div>
                    )}
                </div>
            )}

             {/* STEP 6: SIGNATURE */}
             {step === 6 && (
                <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                    <div className="bg-slate-900 p-4 rounded-2xl flex items-center gap-3 text-white mb-2">
                        <Lock size={20} />
                        <span className="font-bold text-sm">Votre Signature (Prêteur)</span>
                    </div>
                    {recentLoans >= HABITUAL_LENDING_WARNING_COUNT && (
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 leading-relaxed">
                            <strong>Attention au caractère habituel.</strong> Vous avez déjà consenti {recentLoans} prêts en 12 mois. Prêter de façon répétée, surtout avec intérêts, peut être regardé comme une activité de crédit réservée aux banques (art. L511-5 du Code monétaire et financier).
                        </div>
                    )}
                    <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer">
                        <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} className="mt-1 w-4 h-4 accent-indigo-600" />
                        <span className="text-xs text-slate-600 leading-relaxed">
                            J'atteste prêter à titre <strong>personnel et occasionnel</strong> à un proche, avec mes propres fonds, sans en faire une activité habituelle ni professionnelle.
                        </span>
                    </label>
                    <p className="text-xs text-slate-500">
                        En signant, vous validez le contrat. <strong>{formData.borrowerName}</strong> recevra un lien pour le relire, écrire la somme en lettres et signer à son tour.
                    </p>
                    <div className="border-t border-slate-100 pt-4">
                        <SignaturePad label="Signez dans le cadre" onSave={setLenderSignature} />
                    </div>
                </div>
            )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-white z-20">
            <div className="flex gap-3">
                {step > 1 && (
                    <button onClick={() => setStep(step - 1)} className="px-5 py-4 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                )}
                
                {step < 6 ? (
                    <button onClick={handleNext} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                        Suivant <ArrowRight size={18} />
                    </button>
                ) : (
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin" /> : <>Créer le contrat <FileText size={18} /></>}
                    </button>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default LoanForm;
