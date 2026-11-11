
import React, { useState, useEffect, useRef } from 'react';
import { Loan } from '../types';
import { formatDate } from '../utils/calculations';
import { computeSituation, formatMoney } from '../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../config/legal';
import { inviteLinkFor } from './LoanForm';
import { fetchExchangeRate } from '../services/exchangeRate';
import { activateLoanWithContract } from '../services/loanService';
import { Calendar, User, CreditCard, AlertCircle, Loader2, Clock, Upload, FileText, MessageCircle, BellRing, ListChecks, Link2, Check } from 'lucide-react';
import LoanLedger from './LoanLedger';

interface LoanCardProps {
  loan: Loan;
  currentUserEmail: string;
  onClick: (loan: Loan) => void;
  onChanged: () => void;
}

const LoanCard: React.FC<LoanCardProps> = ({ loan, currentUserEmail, onClick, onChanged }) => {
  const [eurEquivalent, setEurEquivalent] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLender = (loan.lenderEmail || '').toLowerCase() === currentUserEmail.toLowerCase();
  const s = computeSituation(loan, LEGAL_INTEREST_RATE);
  const calculation = { isOverdue: s.isOverdue, totalDue: s.totalDueNow, interestAmount: s.lateInterest };
  const nextDue = s.nextInstallment?.dueDate || loan.repaymentDate;
  const inviteLink = inviteLinkFor(loan.id);
  const counterpart = isLender ? loan.borrowerName : loan.lenderName;

  useEffect(() => {
    if (loan.currency !== 'EUR' && loan.status !== 'paid') {
      setLoadingRate(true);
      fetchExchangeRate(loan.amount, loan.currency).then(rate => {
        setEurEquivalent(rate);
        setLoadingRate(false);
      });
    }
  }, [loan.amount, loan.currency, loan.status]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            try {
                await activateLoanWithContract(loan.id, base64);
                setUploading(false);
                onChanged();
            } catch (err) {
                alert("Erreur lors de l'envoi du fichier.");
                setUploading(false);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const isPending = loan.status === 'pending_borrower';
  
  // Génération du lien WhatsApp intelligent
  // NOTE: WhatsApp Web ne permet pas d'attacher des fichiers via URL.
  // Le texte a été adapté pour indiquer que le PDF suit le message.
  let whatsappText = '';
  if (isPending) {
      whatsappText = `Salut ${loan.borrowerName}, voici le contrat pour notre prêt de ${loan.amount} ${loan.currency}. Tu peux le lire et le signer ici en te connectant avec ${loan.borrowerEmail} : ${inviteLink}`;
  } else if (calculation.isOverdue) {
      whatsappText = `Salut ${loan.borrowerName}, sauf erreur de ma part, ${formatMoney(s.overdueAmount, loan.currency)} étaient attendus pour le prêt de ${loan.amount} ${loan.currency}. Le reste dû s'élève aujourd'hui à ${formatMoney(s.totalDueNow, loan.currency)}. Tu peux suivre l'échéancier ici : ${inviteLink}`;
  } else {
      whatsappText = `Salut ${loan.borrowerName}, petit rappel : prochaine échéance de ${formatMoney(s.nextInstallment?.outstanding || 0, loan.currency)} le ${formatDate(nextDue)}.`;
  }

  const whatsappLink = loan.borrowerPhone 
    ? `https://wa.me/${loan.borrowerPhone}?text=${encodeURIComponent(whatsappText)}`
    : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  return (
    <>
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group flex flex-col h-full">
      <div className="p-8 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform ${isPending ? 'bg-amber-500' : 'bg-slate-900'}`}>
              {isPending ? <Clock size={24} /> : <User size={24} />}
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg tracking-tight">
                  {counterpart}
              </h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                  {isLender ? 'Vous prêtez' : 'Vous empruntez'} · {isPending ? 'à signer' : loan.interestRate ? `${loan.interestRate} %/an` : 'sans intérêt'}
              </p>
            </div>
          </div>
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
            loan.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
            isPending ? 'bg-amber-100 text-amber-700' :
            calculation.isOverdue ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-indigo-100 text-indigo-700'
          }`}>
            {loan.status === 'paid' ? 'Soldé' : isPending ? 'À signer' : calculation.isOverdue ? 'En Retard' : s.pendingDeclared > 0 ? 'À confirmer' : 'Actif'}
          </div>
        </div>

        <div className="space-y-4 mb-8 flex-1">
          <div className="flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-slate-300" />
              <span className="text-sm font-bold">Principal</span>
            </div>
            <span className="font-black text-slate-900">{loan.amount.toLocaleString('fr-FR')} {loan.currency}</span>
          </div>

          {!isPending && loan.status !== 'paid' && (
            <div className="flex items-center justify-between text-slate-600">
              <div className="flex items-center gap-3">
                <ListChecks size={18} className="text-slate-300" />
                <span className="text-sm font-bold">Reste dû</span>
              </div>
              <span className="font-black text-indigo-600">{formatMoney(s.totalDueNow, loan.currency)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-slate-300" />
              <span className="text-sm font-bold">{s.schedule.length > 1 ? `Échéance (${s.schedule.length} mois)` : 'Échéance'}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{formatDate(nextDue)}</span>
          </div>
          
          {calculation.isOverdue && loan.status !== 'paid' && (
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 flex justify-between items-center cursor-pointer hover:bg-rose-100 transition-colors" onClick={() => setShowLedger(true)}>
                  <div className="flex items-center gap-2 text-rose-700 text-xs font-bold">
                      <AlertCircle size={14} />
                      <span>Retard {s.daysLate} j · intérêts</span>
                  </div>
                  <span className="text-xs font-black text-rose-600">
                      +{calculation.interestAmount.toFixed(2)} {loan.currency}
                  </span>
              </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
               <button 
                onClick={() => onClick(loan)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <FileText size={14} /> PDF
              </button>
          </div>
          
          {isLender && <a 
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2 ${
                calculation.isOverdue 
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-200' 
                : 'bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20'
            }`}
            onClick={(e) => e.stopPropagation()}
            title="Ouvre WhatsApp avec un message pré-rempli. Vous devrez joindre le PDF manuellement."
          >
            {calculation.isOverdue ? <BellRing size={14} /> : <MessageCircle size={14} />} 
            {calculation.isOverdue ? 'Relancer (Retard)' : isPending ? 'Envoyer le lien (WhatsApp)' : 'Message WhatsApp'}
          </a>}

          {isLender && isPending && (
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(inviteLink); setCopied(true); }}
              className="w-full py-3 bg-slate-50 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? <Check size={14} /> : <Link2 size={14} />}
              {copied ? 'Lien copié' : 'Copier le lien de signature'}
            </button>
          )}

          {isPending ? isLender && (
              <>
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*,.pdf" 
                    className="hidden" 
                    onChange={handleFileUpload}
                 />
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full px-4 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                 >
                    {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                    Ou déposer un contrat papier signé
                 </button>
              </>
          ) : (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowLedger(true);
              }}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <ListChecks size={14} />
              Échéancier et paiements{isLender && s.pendingDeclared > 0 ? ' · à confirmer' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
    
    {showLedger && (
        <LoanLedger loan={loan} isLender={isLender} onClose={() => setShowLedger(false)} onChanged={() => { setShowLedger(false); onChanged(); }} />
    )}
    </>
  );
};

export default LoanCard;
