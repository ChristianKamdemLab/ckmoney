
import React, { useState, useRef } from 'react';
import { Loan } from '../types';
import { computeSituation, formatMoney, toISODate } from '../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../config/legal';
import { X, Copy, Smartphone, CheckSquare, ArrowRight, Wallet, ExternalLink, ShieldCheck, Upload, AlertTriangle, FileCheck, Info } from 'lucide-react';

interface PaymentPortalProps {
  loan: Loan;
  onClose: () => void;
  onSuccess: (method: string, proof: string | null, amount: number, date: string) => void;
}

const PaymentPortal: React.FC<PaymentPortalProps> = ({ loan, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'bank' | 'mobile'>('bank');
  const [confirmed, setConfirmed] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const s = computeSituation(loan, LEGAL_INTEREST_RATE);
  const suggested = s.isOverdue ? s.overdueAmount + s.lateInterest : (s.nextInstallment?.outstanding ?? s.totalDueNow);
  const [amount, setAmount] = useState(String(Math.round(suggested * 100) / 100));
  const [payDate, setPayDate] = useState(toISODate(new Date()));
  const amountNum = parseFloat(amount) || 0;
  
  const referenceCode = `REF-${loan.id.substr(0, 6).toUpperCase()}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copié dans le presse-papier !");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setProofImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleConfirm = () => {
      if (!confirmed || amountNum <= 0) return;
      onSuccess(activeTab === 'bank' ? 'Virement bancaire' : 'Paiement mobile', proofImage, amountNum, payDate);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-500" size={18} />
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Remboursement Sécurisé</span>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Section Résumé Financier */}
          <div className="text-center mb-6">
            <p className="text-slate-500 text-sm font-medium mb-1">Reste dû aujourd'hui</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{formatMoney(s.totalDueNow, loan.currency)}</h3>
            {s.lateInterest > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-full text-xs font-bold border border-rose-100">
                <AlertTriangle size={12} />
                <span>Dont {formatMoney(s.lateInterest, loan.currency)} d'intérêts de retard</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Montant versé</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-black text-slate-900" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Date du paiement</label>
              <input type="date" value={payDate} max={toISODate(new Date())} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold text-slate-900" />
            </div>
            <p className="col-span-2 text-[10px] text-slate-400">Vous pouvez payer une échéance, une partie, ou tout rembourser par anticipation sans frais.</p>
          </div>

          {/* Onglets */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button 
                onClick={() => setActiveTab('bank')}
                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'bank' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Wallet size={16} /> Virement
            </button>
            <button 
                onClick={() => setActiveTab('mobile')}
                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'mobile' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Smartphone size={16} /> Mobile / App
            </button>
          </div>

          {/* Contenu Virement */}
          {activeTab === 'bank' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  {loan.lenderIban ? (
                      <>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1 group hover:border-indigo-200 transition-colors">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">IBAN du Prêteur</label>
                            <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-slate-800 break-all text-sm">{loan.lenderIban}</span>
                                <button onClick={() => copyToClipboard(loan.lenderIban || '')} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg">
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 space-y-1">
                            <label className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1"><Info size={10} /> Référence Obligatoire</label>
                            <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-slate-900 text-lg">{referenceCode}</span>
                                <button onClick={() => copyToClipboard(referenceCode)} className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg">
                                    <Copy size={16} />
                                </button>
                            </div>
                            <p className="text-[10px] text-amber-600/80 leading-tight pt-1">
                                Indiquez cette référence dans le libellé du virement.
                            </p>
                        </div>
                      </>
                  ) : (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                          <p className="text-sm font-medium text-slate-500">Le prêteur n'a pas renseigné son IBAN.</p>
                          <p className="text-xs text-slate-400 mt-1">Veuillez le contacter directement ou utiliser une autre méthode.</p>
                      </div>
                  )}
              </div>
          )}

          {/* Contenu Mobile */}
          {activeTab === 'mobile' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                   {loan.lenderPaymentLink ? (
                       <div className="text-center py-6">
                           <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                               <Smartphone size={32} />
                           </div>
                           <h4 className="font-bold text-slate-900 mb-2">Payer via Application</h4>
                           <p className="text-sm text-slate-500 mb-6 px-4">
                               Utilisez le lien ci-dessous pour ouvrir PayPal, Lydia ou Revolut directement sur le profil du prêteur.
                           </p>
                           <a 
                             href={loan.lenderPaymentLink.startsWith('http') ? loan.lenderPaymentLink : `https://${loan.lenderPaymentLink}`} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                           >
                               Ouvrir l'application de paiement <ExternalLink size={16} />
                           </a>
                       </div>
                   ) : (
                       <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                          <p className="text-sm font-medium text-slate-500">Le prêteur n'a pas renseigné de lien mobile.</p>
                          <p className="text-xs text-slate-400 mt-1">Veuillez le contacter directement.</p>
                      </div>
                   )}
              </div>
          )}

          {/* Zone d'Upload de Preuve */}
          <div className="mt-8 pt-6 border-t border-slate-100">
             <label className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3 block">Preuve de paiement (Optionnel)</label>
             <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handleFileChange} 
                className="hidden" 
             />
             
             {!proofImage ? (
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all"
                 >
                    <Upload size={24} className="mb-2" />
                    <span className="text-xs font-bold">Ajouter une capture d'écran</span>
                 </button>
             ) : (
                 <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-200 group">
                    <img src={proofImage} alt="Preuve" className="w-full h-full object-cover" />
                    <button 
                        onClick={() => setProofImage(null)}
                        className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur rounded-full text-slate-600 hover:text-red-500 shadow-sm"
                    >
                        <X size={16} />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-emerald-500 text-white px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <FileCheck size={12} /> Image chargée
                    </div>
                 </div>
             )}
          </div>

          {/* Zone de Validation */}
          <div className="mt-8">
             <div className="bg-indigo-50 p-4 rounded-2xl mb-6 flex gap-3 items-start">
                <Info className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                    <strong>Important :</strong> le paiement sera pris en compte à la date indiquée dès que le prêteur aura confirmé l'avoir reçu. Sa confirmation vaut quittance.
                </p>
             </div>

             <div className="flex items-start gap-3 mb-6 cursor-pointer" onClick={() => setConfirmed(!confirmed)}>
                 <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${confirmed ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'}`}>
                     {confirmed && <CheckSquare size={14} className="text-white" />}
                 </div>
                 <p className="text-xs text-slate-600 leading-relaxed select-none">
                     Je certifie sur l'honneur avoir versé {formatMoney(amountNum, loan.currency)} au prêteur.
                 </p>
             </div>

             <button 
                onClick={handleConfirm}
                disabled={!confirmed}
                className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${confirmed ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
             >
                 Confirmer le paiement <ArrowRight size={20} />
             </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PaymentPortal;
