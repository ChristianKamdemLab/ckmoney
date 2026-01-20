import React, { useState, useEffect } from 'react';
import { Loan } from '../types';
import { X, Loader2, PenTool, MapPin, Coins, TrendingUp, User, Home } from 'lucide-react';
import { generateContractContent } from '../services/geminiService';
import { fetchExchangeRate } from '../services/exchangeRate';
import SignaturePad from './SignaturePad';

interface LoanFormProps {
  onClose: () => void;
  onSubmit: (loan: Loan) => void;
  lenderName: string; // Dynamic lender name
}

const CURRENCIES = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'XAF', symbol: 'FCFA' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'GBP', symbol: '£' }
];

const COUNTRIES = [
  "Cameroun", "France", "Canada", "Belgique", "Suisse", "Côte d'Ivoire", 
  "Sénégal", "Gabon", "Congo", "Bénin", "Togo", "Mali", "Guinée", 
  "Maroc", "Algérie", "Tunisie", "États-Unis", "Allemagne", "Luxembourg"
].sort();

const InputGroup = ({ label, children }: { label: string, children?: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const LoanForm: React.FC<LoanFormProps> = ({ onClose, onSubmit, lenderName }) => {
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [borrowerSignature, setBorrowerSignature] = useState('');
  const [lenderSignature, setLenderSignature] = useState('');
  
  const [formData, setFormData] = useState({
    // Lender
    lenderCivility: 'M.' as 'M.' | 'Mme',
    lenderBirthDate: '',
    lenderBirthPlace: '',
    lenderAddress: '',
    
    // Borrower
    borrowerName: '',
    borrowerCivility: 'M.' as 'M.' | 'Mme',
    borrowerBirthDate: '',
    borrowerBirthPlace: '',
    borrowerAddress: '',

    // Loan
    amount: '',
    currency: 'EUR',
    loanDate: new Date().toISOString().split('T')[0],
    repaymentDate: '',
    city: '',
    country: 'Cameroun'
  });

  // Effect pour la conversion temps réel
  useEffect(() => {
    const amount = parseFloat(formData.amount);
    if (!isNaN(amount) && amount > 0) {
      setConverting(true);
      const timer = setTimeout(async () => {
        const result = await fetchExchangeRate(amount, formData.currency);
        setConvertedAmount(result);
        setConverting(false);
      }, 500); 
      return () => clearTimeout(timer);
    } else {
      setConvertedAmount(null);
    }
  }, [formData.amount, formData.currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowerSignature || !lenderSignature) {
      alert("Les deux signatures électroniques sont obligatoires.");
      return;
    }

    setLoading(true);

    const newLoan: Loan = {
      id: Math.random().toString(36).substr(2, 9),
      lenderName: lenderName,
      ...formData,
      amount: parseFloat(formData.amount),
      signedDate: new Date().toISOString(),
      status: 'active',
      borrowerSignature,
      lenderSignature,
    };

    const contractText = await generateContractContent(newLoan);
    onSubmit({ ...newLoan, contractText });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 min-h-screen sm:min-h-0 sm:my-8 border border-slate-100 flex flex-col">
        
        {/* Header Fixed */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white/95 backdrop-blur z-10 sticky top-0">
          <div>
            <h2 className="text-xl font-black text-slate-900">Nouveau Contrat</h2>
            <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Édition Complète</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Section Prêteur */}
            <div className="space-y-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><User size={18} /></div>
                <h3 className="font-black text-slate-900">Le Prêteur (Vous)</h3>
              </div>
              
              <div className="grid grid-cols-12 gap-3">
                 <div className="col-span-4 sm:col-span-3">
                  <InputGroup label="Civilité">
                    <select 
                      value={formData.lenderCivility}
                      onChange={e => setFormData({...formData, lenderCivility: e.target.value as any})}
                      className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 outline-none text-sm font-medium"
                    >
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                    </select>
                  </InputGroup>
                 </div>
                 <div className="col-span-8 sm:col-span-9">
                   <InputGroup label="Nom Complet">
                     <input disabled value={lenderName} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-bold text-sm cursor-not-allowed" />
                   </InputGroup>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputGroup label="Date de Naissance">
                  <input required type="date" value={formData.lenderBirthDate} onChange={e => setFormData({...formData, lenderBirthDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm" />
                </InputGroup>
                <InputGroup label="Lieu de Naissance">
                  <input required type="text" placeholder="Ville, Pays" value={formData.lenderBirthPlace} onChange={e => setFormData({...formData, lenderBirthPlace: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm" />
                </InputGroup>
              </div>

              <InputGroup label="Adresse de Résidence">
                <input required type="text" placeholder="Adresse complète" value={formData.lenderAddress} onChange={e => setFormData({...formData, lenderAddress: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm" />
              </InputGroup>
            </div>

            {/* Section Emprunteur */}
            <div className="space-y-4 p-5 bg-white rounded-3xl border-2 border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><User size={18} /></div>
                <h3 className="font-black text-slate-900">L'Emprunteur</h3>
              </div>

              <div className="grid grid-cols-12 gap-3">
                 <div className="col-span-4 sm:col-span-3">
                  <InputGroup label="Civilité">
                    <select 
                      value={formData.borrowerCivility}
                      onChange={e => setFormData({...formData, borrowerCivility: e.target.value as any})}
                      className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 outline-none text-sm font-medium"
                    >
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                    </select>
                  </InputGroup>
                 </div>
                 <div className="col-span-8 sm:col-span-9">
                   <InputGroup label="Nom Complet">
                     <input required placeholder="Ex: Jean Dupont" value={formData.borrowerName} onChange={e => setFormData({...formData, borrowerName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 outline-none font-bold text-sm" />
                   </InputGroup>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputGroup label="Date de Naissance">
                  <input required type="date" value={formData.borrowerBirthDate} onChange={e => setFormData({...formData, borrowerBirthDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 outline-none text-sm" />
                </InputGroup>
                <InputGroup label="Lieu de Naissance">
                  <input required type="text" placeholder="Ville, Pays" value={formData.borrowerBirthPlace} onChange={e => setFormData({...formData, borrowerBirthPlace: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 outline-none text-sm" />
                </InputGroup>
              </div>

              <InputGroup label="Adresse de Résidence">
                <input required type="text" placeholder="Adresse complète" value={formData.borrowerAddress} onChange={e => setFormData({...formData, borrowerAddress: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 outline-none text-sm" />
              </InputGroup>
            </div>

            {/* Section Prêt */}
            <div className="space-y-4">
               <h3 className="font-black text-slate-900 px-1">Conditions Financières</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 ml-1">MONTANT</label>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        min="1"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-black text-2xl text-slate-900"
                        placeholder="0.00"
                      />
                      {formData.currency !== 'EUR' && convertedAmount !== null && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1 bg-indigo-50 rounded-xl">
                          {converting ? (
                            <Loader2 className="animate-spin text-indigo-400" size={14} />
                          ) : (
                            <>
                              <TrendingUp className="text-indigo-600" size={14} />
                              <span className="text-xs font-black text-indigo-700">≈ {convertedAmount.toFixed(2)} €</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 ml-1">DEVISE</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all bg-slate-50 font-bold h-[72px]"
                    >
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                    </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Date du prêt">
                    <input required type="date" value={formData.loanDate} onChange={e => setFormData({...formData, loanDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm" />
                  </InputGroup>
                  <InputGroup label="Date de Remboursement">
                    <input required type="date" value={formData.repaymentDate} onChange={e => setFormData({...formData, repaymentDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm" />
                  </InputGroup>
               </div>
            </div>

            {/* Localisation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="Pays de signature">
                <select required value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-500 outline-none text-sm">
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </InputGroup>
              <InputGroup label="Ville de signature">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input required type="text" placeholder="Ex: Paris" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm" />
                </div>
              </InputGroup>
            </div>

            {/* Signatures */}
            <div className="pt-6 border-t border-slate-100 space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                <PenTool size={14} className="text-indigo-500" /> Signatures Numériques
              </h3>
              <div className="grid grid-cols-1 gap-6">
                <SignaturePad label="Signature de l'Emprunteur" onSave={setBorrowerSignature} />
                <SignaturePad label="Signature du Prêteur" onSave={setLenderSignature} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button type="button" onClick={onClose} disabled={loading} className="w-full sm:w-1/3 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm uppercase tracking-wider hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button disabled={loading} type="submit" className="w-full sm:w-2/3 py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
                {loading ? <><Loader2 className="animate-spin" size={24} /> Rédaction...</> : 'Générer le Contrat'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default LoanForm;
