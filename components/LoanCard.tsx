
import React, { useState, useEffect, useRef } from 'react';
import { Loan } from '../types';
import { calculateDueAmount, formatDate } from '../utils/calculations';
import { fetchExchangeRate } from '../services/exchangeRate';
import { activateLoanWithContract } from '../services/loanService';
import { Calendar, User, CreditCard, AlertCircle, CheckCircle2, Coins, TrendingUp, Loader2, Clock, Upload, FileText, Check, MessageCircle, Calculator, BellRing } from 'lucide-react';
import PenaltyCalculator from './PenaltyCalculator';

interface LoanCardProps {
  loan: Loan;
  onClick: (loan: Loan) => void;
  onMarkAsPaid: (id: string) => void;
}

const LoanCard: React.FC<LoanCardProps> = ({ loan, onClick, onMarkAsPaid }) => {
  const [eurEquivalent, setEurEquivalent] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculation = calculateDueAmount(loan.amount, loan.repaymentDate, loan.status, loan.lateInterestRate || 0);

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
                window.location.reload(); // Simple reload to refresh state
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
      whatsappText = `Salut ${loan.borrowerName}, pour notre prêt de ${loan.amount} ${loan.currency}, je t'envoie le contrat PDF à signer juste après ce message.`;
  } else if (calculation.isOverdue) {
      whatsappText = `Salut ${loan.borrowerName}, sauf erreur de ma part, le remboursement de ${loan.amount} ${loan.currency} était prévu le ${formatDate(loan.repaymentDate)}. Avec les pénalités de retard, le montant s'élève aujourd'hui à ${calculation.totalDue.toFixed(2)} ${loan.currency}. Merci de me tenir au courant.`;
  } else {
      whatsappText = `Salut ${loan.borrowerName}, petit rappel pour le prêt de ${loan.amount} ${loan.currency} prévu pour le ${formatDate(loan.repaymentDate)}.`;
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
                  {loan.borrowerName}
              </h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                  {isPending ? 'Contrat à signer' : 'Contrat Actif'}
              </p>
            </div>
          </div>
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
            loan.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
            isPending ? 'bg-amber-100 text-amber-700' :
            calculation.isOverdue ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-indigo-100 text-indigo-700'
          }`}>
            {loan.status === 'paid' ? 'Soldé' : isPending ? 'En Attente' : calculation.isOverdue ? 'En Retard' : 'Actif'}
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

          <div className="flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-slate-300" />
              <span className="text-sm font-bold">Échéance</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{formatDate(loan.repaymentDate)}</span>
          </div>
          
          {calculation.isOverdue && loan.status !== 'paid' && (
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 flex justify-between items-center cursor-pointer hover:bg-rose-100 transition-colors" onClick={() => setShowCalculator(true)}>
                  <div className="flex items-center gap-2 text-rose-700 text-xs font-bold">
                      <AlertCircle size={14} />
                      <span>Pénalités incluses</span>
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
          
          <a 
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
            {calculation.isOverdue ? 'Relancer (Retard)' : 'Message WhatsApp'}
          </a>

          {/* SIMULATEUR: Visible pour tout prêt non remboursé, même en attente de signature */}
          {loan.status !== 'paid' && (
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setShowCalculator(true);
                }}
                className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
            >
                <Calculator size={14} />
                Simuler les Pénalités
            </button>
          )}

          {isPending ? (
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
                    Déposer Contrat Signé
                 </button>
              </>
          ) : loan.status !== 'paid' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsPaid(loan.id);
              }}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} />
              Marquer Remboursé
            </button>
          )}
        </div>
      </div>
    </div>
    
    {showCalculator && (
        <PenaltyCalculator loan={loan} onClose={() => setShowCalculator(false)} />
    )}
    </>
  );
};

export default LoanCard;
