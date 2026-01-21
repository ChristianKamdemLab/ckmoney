
import React, { useState, useEffect } from 'react';
import { Loan, User } from '../types';
import { Loader2, PenTool, User as UserIcon, MapPin, Calendar, CreditCard, AlertTriangle, ArrowRight, Info, ShieldAlert } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { updateLoan } from '../services/loanService';
import { generateContractContent } from '../services/geminiService';
import CityInput from './CityInput';

interface BorrowerFormProps {
  loan: Loan;
  user: User; // L'emprunteur connecté
  onSuccess: () => void;
}

const InputGroup = ({ label, children }: { label: string, children?: React.ReactNode }) => (
  <div className="space-y-1 w-full">
    <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const BorrowerForm: React.FC<BorrowerFormProps> = ({ loan, user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [borrowerSignature, setBorrowerSignature] = useState('');
  
  // Protection contre le crash si loan est partiel
  const safeRepaymentDate = loan?.repaymentDate || new Date().toISOString().split('T')[0];
  
  // L'emprunteur peut modifier la date de remboursement
  const [repaymentDate, setRepaymentDate] = useState(safeRepaymentDate);
  const [isDateModified, setIsDateModified] = useState(false);
  
  const [formData, setFormData] = useState({
    borrowerCivility: 'M.' as 'M.' | 'Mme',
    borrowerBirthDate: '',
    borrowerBirthPlace: '',
    borrowerCountry: '',
    borrowerAddress: '',
    city: '',
    signingCountry: ''
  });

  // Détection d'une différence de compte (Warning Pro)
  const isDifferentAccount = loan.borrowerEmail && user.email.toLowerCase() !== loan.borrowerEmail.toLowerCase();

  useEffect(() => {
    if (repaymentDate !== safeRepaymentDate) {
        setIsDateModified(true);
    } else {
        setIsDateModified(false);
    }
  }, [repaymentDate, safeRepaymentDate]);

  // Extraction Pays auto
  useEffect(() => {
      if (formData.borrowerBirthPlace.includes(',')) {
          const parts = formData.borrowerBirthPlace.split(',');
          if (parts.length > 1) setFormData(p => ({...p, borrowerCountry: parts[1].trim()}));
      } else {
          setFormData(p => ({...p, borrowerCountry: ''}));
      }

      if (formData.city.includes(',')) {
          const parts = formData.city.split(',');
          if (parts.length > 1) setFormData(p => ({...p, signingCountry: parts[1].trim()}));
      } else {
          setFormData(p => ({...p, signingCountry: ''}));
      }
  }, [formData.borrowerBirthPlace, formData.city]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowerSignature) {
      alert("Votre signature est obligatoire pour valider le contrat.");
      return;
    }

    if (!formData.borrowerBirthPlace.includes(',')) {
        alert("Veuillez sélectionner votre lieu de naissance dans la liste proposée.");
        return;
    }
    
    if (!formData.city.includes(',')) {
        alert("Veuillez sélectionner la ville de signature dans la liste proposée.");
        return;
    }

    // Extraction ville/pays propre pour le stockage
    const signatureCity = formData.city.split(',')[0].trim();
    const signatureCountry = formData.city.split(',')[1].trim();

    setLoading(true);

    try {
      // 1. Reconstruire l'objet Loan complet pour le générateur de contrat
      const completedLoan: Loan = {
        ...loan,
        borrowerName: user.name, // Nom du compte Google/Email
        borrowerCivility: formData.borrowerCivility,
        borrowerBirthDate: formData.borrowerBirthDate,
        borrowerBirthPlace: formData.borrowerBirthPlace,
        borrowerAddress: formData.borrowerAddress,
        borrowerSignature: borrowerSignature,
        repaymentDate: repaymentDate, // Date potentiellement modifiée
        city: signatureCity,
        country: signatureCountry,
        signedDate: new Date().toISOString(),
        status: 'active'
      };

      // 2. Générer le texte légal via Gemini
      const contractText = await generateContractContent(completedLoan);

      // 3. Sauvegarder dans Firestore
      await updateLoan(loan.id, {
        borrowerName: user.name,
        borrowerCivility: formData.borrowerCivility,
        borrowerBirthDate: formData.borrowerBirthDate,
        borrowerBirthPlace: formData.borrowerBirthPlace,
        borrowerAddress: formData.borrowerAddress,
        borrowerSignature: borrowerSignature,
        repaymentDate: repaymentDate,
        city: signatureCity,
        country: signatureCountry,
        signedDate: completedLoan.signedDate,
        contractText: contractText,
        status: 'active'
      });
      
      if (isDateModified) {
          alert("Note : La date de remboursement a été modifiée. Le prêteur recevra une notification de mise à jour.");
      }
      
      alert("Félicitations ! Le contrat a été généré et signé.");
      onSuccess();

    } catch (error) {
      console.error(error);
      alert("Erreur lors de la finalisation. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (!loan) {
      return <div className="p-8 text-center text-red-500">Erreur : Données du prêt manquantes.</div>;
  }

  return (
    <div className="bg-white w-full max-w-3xl mx-auto sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-100 flex flex-col my-8">
        
        <div className="bg-slate-900 px-8 py-6 text-white">
          <h2 className="text-2xl font-black">Finaliser le Prêt</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Étape 2 : L'Emprunteur (Vous)</p>
        </div>

        {isDifferentAccount && (
          <div className="bg-amber-50 px-8 py-4 border-b border-amber-100 flex gap-3 items-start">
             <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={20} />
             <div>
               <p className="text-sm font-bold text-amber-800">Compte différent détecté</p>
               <p className="text-xs text-amber-700 leading-relaxed mt-1">
                 Ce prêt a été initié pour l'email <strong>{loan.borrowerEmail}</strong>, mais vous êtes connecté en tant que <strong>{user.email}</strong>. 
                 En signant, vous acceptez que le contrat soit généré au nom de votre compte actuel.
               </p>
             </div>
          </div>
        )}

        <div className="p-8">
          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl mb-8">
             <h3 className="text-indigo-900 font-bold mb-4 flex items-center gap-2">
                <CreditCard size={20} /> Récapitulatif de la dette
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Prêteur</span>
                    <p className="font-black text-indigo-900 text-lg">{loan.lenderName || 'Prêteur inconnu'}</p>
                 </div>
                 <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Montant (Non modifiable)</span>
                    <p className="font-black text-indigo-900 text-2xl">{loan.amount || 0} {loan.currency || 'EUR'}</p>
                 </div>
                 <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Date du prêt</span>
                    <p className="font-bold text-indigo-800">{loan.loanDate ? new Date(loan.loanDate).toLocaleDateString() : 'N/A'}</p>
                 </div>
                 <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Taux pénalité annuel</span>
                    <p className="font-black text-rose-500">{loan.lateInterestRate || 0}%</p>
                 </div>
             </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Section Infos Perso */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><UserIcon size={18} /></div>
                <h3 className="font-black text-slate-900">Vos Informations Personnelles</h3>
              </div>
              
              <div className="flex flex-col gap-4">
                  <InputGroup label="Civilité">
                    <select 
                      value={formData.borrowerCivility}
                      onChange={e => setFormData({...formData, borrowerCivility: e.target.value as any})}
                      className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 outline-none text-sm font-medium"
                    >
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                    </select>
                  </InputGroup>
                  
                   <InputGroup label="Votre Nom (Compte)">
                     <input disabled value={user.name} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-bold text-sm cursor-not-allowed" />
                   </InputGroup>
              </div>

              <div className="flex flex-col gap-4">
                <InputGroup label="Date de Naissance">
                  <input required type="date" value={formData.borrowerBirthDate} onChange={e => setFormData({...formData, borrowerBirthDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-sm" />
                </InputGroup>
                
                <div className="space-y-2">
                    <CityInput 
                        label="Lieu de Naissance"
                        value={formData.borrowerBirthPlace}
                        onChange={(val) => setFormData({...formData, borrowerBirthPlace: val})}
                        required
                    />
                    {formData.borrowerCountry && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Pays (Automatique)</label>
                            <div className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm">
                                {formData.borrowerCountry}
                            </div>
                        </div>
                    )}
                </div>
              </div>

              <InputGroup label="Votre Adresse de Résidence">
                <input required type="text" placeholder="Adresse complète" value={formData.borrowerAddress} onChange={e => setFormData({...formData, borrowerAddress: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-sm" />
              </InputGroup>
            </div>

            {/* Validation Date et Lieu */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 mt-6">
                <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><Calendar size={18} /></div>
                <h3 className="font-black text-slate-900">Validation des Termes</h3>
              </div>

               <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={18} />
                  <div className="space-y-2">
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        Vous pouvez ajuster la date de remboursement ci-dessous.
                    </p>
                    {isDateModified && (
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-100/50 p-2 rounded-lg">
                            <ArrowRight size={14} /> Attention : La modification de la date notifiera le prêteur.
                        </div>
                    )}
                  </div>
               </div>

               <InputGroup label="Date de Remboursement (Modifiable)">
                  <input required type="date" value={repaymentDate} onChange={e => setRepaymentDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-500 outline-none text-sm font-bold text-slate-900" />
               </InputGroup>

               <div className="mt-4 space-y-2">
                  <CityInput 
                    label="Ville de signature"
                    value={formData.city}
                    onChange={(val) => setFormData({...formData, city: val})}
                    required
                  />
                   {formData.signingCountry && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Pays (Automatique)</label>
                            <div className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm">
                                {formData.signingCountry}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Signatures */}
            <div className="pt-6 border-t border-slate-100 space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                <PenTool size={14} className="text-emerald-500" /> Votre Signature
              </h3>
              <div className="grid grid-cols-1 gap-6">
                <SignaturePad label="Signature Emprunteur" onSave={setBorrowerSignature} />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4">
              <button disabled={loading} type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
                {loading ? <><Loader2 className="animate-spin" size={24} /> Génération du contrat...</> : 'Valider et Signer le Contrat'}
              </button>
            </div>

          </form>
        </div>
    </div>
  );
};

export default BorrowerForm;
