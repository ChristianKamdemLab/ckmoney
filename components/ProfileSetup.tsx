import React, { useState } from 'react';
import { Profile, User, isProfileComplete } from '../types';
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import CityInput from './CityInput';
import SignaturePad from './SignaturePad';
import CKLogo from './brand/CKLogo';
import { saveProfile } from '../services/profileService';

interface ProfileSetupProps {
  user: User;
  initial?: Profile | null;
  onSaved: (p: Profile) => void;
  onCancel?: () => void; // absent lors de la première connexion
}

const field = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600';
const label = 'text-[11px] font-bold text-slate-600 uppercase tracking-wide ml-1';

/** Saisie unique de l'identité du prêteur, réutilisée dans tous ses contrats. */
const ProfileSetup: React.FC<ProfileSetupProps> = ({ user, initial, onSaved, onCancel }) => {
  const [p, setP] = useState<Profile>(initial || {
    civility: 'M.', fullName: user.name, birthDate: '', birthPlace: '', address: '', iban: '', paymentLink: '', signature: '',
  });
  const [redraw, setRedraw] = useState(!initial?.signature);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = isProfileComplete(p);

  const submit = async () => {
    if (!complete) { setError('Complétez les champs obligatoires (la ville de naissance doit être au format « Ville, Pays »).'); return; }
    setSaving(true);
    setError(null);
    try {
      const cleaned: Profile = { ...p, iban: p.iban?.replace(/\s+/g, ' ').trim().toUpperCase() };
      await saveProfile(user.id, cleaned);
      onSaved(cleaned);
    } catch (e) {
      console.error(e);
      setError("L'enregistrement a échoué. Vérifiez votre connexion et réessayez.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {onCancel ? (
          <button onClick={onCancel} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm"><ArrowLeft size={18} /> Retour</button>
        ) : (
          <div className="mb-8"><CKLogo subtitle="Prêts entre proches" /></div>
        )}

        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 sm:p-8 space-y-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-500">{onCancel ? 'Mon profil' : 'Première connexion'}</p>
            <h1 className="serif text-3xl font-semibold text-indigo-600 mt-1">Vos informations, une fois pour toutes</h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Elles figureront dans chaque contrat où vous êtes le prêteur. Vous n'aurez plus à les ressaisir, et vous pourrez les modifier à tout moment.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className={label}>Civilité</label>
              <select value={p.civility} onChange={e => setP({ ...p, civility: e.target.value as Profile['civility'] })} className={field}>
                <option value="M.">M.</option><option value="Mme">Mme</option>
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <label className={label}>Prénom et nom</label>
              <input value={p.fullName} onChange={e => setP({ ...p, fullName: e.target.value })} className={field} />
            </div>
          </div>
          <div className="space-y-1">
            <label className={label}>Date de naissance</label>
            <input type="date" value={p.birthDate} onChange={e => setP({ ...p, birthDate: e.target.value })} className={field} />
          </div>
          <CityInput label="Ville de naissance" value={p.birthPlace} onChange={v => setP({ ...p, birthPlace: v })} required />
          <div className="space-y-1">
            <label className={label}>Adresse complète</label>
            <input value={p.address} onChange={e => setP({ ...p, address: e.target.value })} placeholder="12 rue de la Paix, 13200 Arles" className={field} />
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-500">Pour être remboursé</p>
            <div className="space-y-1">
              <label className={label}>IBAN (recommandé)</label>
              <input value={p.iban} onChange={e => setP({ ...p, iban: e.target.value })} placeholder="FR76 …" className={`${field} font-mono uppercase`} />
            </div>
            <div className="space-y-1">
              <label className={label}>Lien de paiement (optionnel)</label>
              <input value={p.paymentLink} onChange={e => setP({ ...p, paymentLink: e.target.value })} placeholder="paypal.me/votre_pseudo ou lien Revolut / Lydia" className={field} />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-500">Votre signature (optionnel)</p>
            <p className="text-xs text-slate-500">Enregistrée ici, elle vous sera proposée à chaque contrat ; vous validerez toujours chaque signature d'un clic.</p>
            {p.signature && !redraw ? (
              <div className="flex items-center justify-between gap-4 p-3 border border-slate-200 rounded-xl">
                <img src={p.signature} alt="Signature enregistrée" className="h-16 object-contain" />
                <button onClick={() => { setRedraw(true); setP({ ...p, signature: '' }); }} className="text-xs font-bold text-indigo-600">Refaire</button>
              </div>
            ) : (
              <SignaturePad label="Signez dans le cadre" onSave={sig => setP({ ...p, signature: sig })} />
            )}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-indigo-50 rounded-xl p-3">
            <ShieldCheck size={14} className="shrink-0 mt-0.5 text-indigo-600" />
            Ces données ne sont visibles que par vous, et par vos emprunteurs dans les contrats qui les concernent.
          </div>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <button onClick={submit} disabled={saving} className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 ${complete ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
            {saving ? <Loader2 className="animate-spin" /> : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
