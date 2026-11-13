import React, { useState } from 'react';
import { Profile, User, isProfileComplete, formatIban } from '../types';
import CityInput from './CityInput';
import SignaturePad from './SignaturePad';
import CKLogo from './brand/CKLogo';
import { saveProfile } from '../services/profileService';
import { USURY_BRACKETS } from '../config/legal';
import { cityOf } from '../utils/contract';
import { Screen, TopBar, H1, Field, Chips, Card, Note, Footer, Button, inputClass, inputStyle, C } from './v2/ui';

interface ProfileSetupProps {
  user: User;
  initial?: Profile | null;
  onSaved: (p: Profile) => void;
  onCancel?: () => void; // absent lors de la première connexion
}


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
    if (!complete) { setError('Complète les champs obligatoires (la ville de naissance au format « Ville, Pays »).'); return; }
    if (!cityOf(p.address)) { setError('Ajoute la ville à ton adresse, après le code postal (ex. « 12 rue de la Paix, 91120 Palaiseau ») : elle figure sur les contrats.'); return; }
    setSaving(true);
    setError(null);
    try {
      const cleaned: Profile = { ...p, iban: p.iban?.replace(/\s+/g, ' ').trim().toUpperCase() };
      await saveProfile(user.id, cleaned);
      onSaved(cleaned);
    } catch (e) {
      console.error(e);
      setError("L'enregistrement a échoué. Vérifie ta connexion et réessaie.");
      setSaving(false);
    }
  };

  const cap = USURY_BRACKETS[0].rate;
  return (
    <Screen>
      {onCancel ? <TopBar onBack={onCancel} title="Mes informations" /> : <div className="px-6 pt-[max(env(safe-area-inset-top),24px)]"><CKLogo size="sm" /></div>}
      <H1 desc="Elles figurent dans chaque contrat où tu es le prêteur. Tu ne les saisis qu'une fois et tu peux les modifier à tout moment.">
        {onCancel ? 'Tes informations' : 'Tes informations, une fois pour toutes'}
      </H1>

      <div className="px-6 pt-5 flex flex-col gap-4">
        <Chips options={[{ id: 'M.', label: 'M.' }, { id: 'Mme', label: 'Mme' }]} value={p.civility} onChange={v => setP({ ...p, civility: v as Profile['civility'] })} />
        <Field label="Prénom et nom" htmlFor="pf-name">
          <input id="pf-name" autoComplete="name" value={p.fullName} onChange={e => setP({ ...p, fullName: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <Field label="Date de naissance" htmlFor="pf-birth">
          <input id="pf-birth" type="date" value={p.birthDate} onChange={e => setP({ ...p, birthDate: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <CityInput label="Ville de naissance" value={p.birthPlace} onChange={v => setP({ ...p, birthPlace: v })} required />
        <Field label="Adresse complète" htmlFor="pf-addr">
          <input id="pf-addr" autoComplete="street-address" value={p.address} onChange={e => setP({ ...p, address: e.target.value })} placeholder="12 rue de la Paix, 13200 Arles" className={inputClass} style={inputStyle} />
        </Field>
      </div>

      <div className="px-6 pt-8 pb-1 text-[17px] font-bold">Pour être remboursé</div>
      <div className="px-6 pt-3 flex flex-col gap-4">
        <Field label="Lien de paiement" htmlFor="pf-link" hint="Ton lien PayPal.me : tes proches auront un bouton « Payer » avec le montant déjà rempli. Un lien Revolut ou Lydia marche aussi.">
          <input id="pf-link" autoCapitalize="none" autoComplete="off" value={p.paymentLink} onChange={e => setP({ ...p, paymentLink: e.target.value })} placeholder="paypal.me/ton-nom" className={inputClass} style={inputStyle} />
        </Field>
        <Field label="IBAN (facultatif)" htmlFor="pf-iban" hint={`${p.iban?.trim() ? `${formatIban(p.iban)}. ` : ''}Indiqué dans les contrats pour les remboursements par virement.`}>
          <input id="pf-iban" autoCapitalize="characters" autoComplete="off" value={p.iban} onChange={e => setP({ ...p, iban: e.target.value })} placeholder="FR76 …" className={inputClass} style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace' }} />
        </Field>
      </div>

      <div className="px-6 pt-8 pb-1 text-[17px] font-bold">En cas de retard</div>
      <div className="px-6 pt-1 text-[13px]" style={{ color: C.mute }}>Tes réglages par défaut, repris dans chaque nouveau contrat. Tu peux les changer prêt par prêt.</div>
      <div className="px-6 pt-4 flex flex-col gap-5">
        <Field label={`Pénalité forfaitaire : ${p.penaltyRate ? `${p.penaltyRate.toLocaleString('fr-FR')} %` : 'aucune'}`} hint="Due une fois si une échéance n'est pas payée à temps. Maximum 10 %.">
          <input type="range" min={0} max={10} step={1} value={p.penaltyRate || 0} onChange={e => setP({ ...p, penaltyRate: parseFloat(e.target.value) || undefined })} className="w-full accent-[#1C2551]" />
        </Field>
        <Field label={`Taux de report : ${p.delayRate ? `${p.delayRate.toLocaleString('fr-FR')} % par an` : 'taux de retard du contrat'}`} hint={`Appliqué quand un proche te propose une nouvelle date, depuis l'échéance manquée. Plafonné au taux de l'usure (${cap.toLocaleString('fr-FR')} % jusqu'à 3 000 € aujourd'hui).`}>
          <input type="range" min={0} max={cap} step={0.5} value={Math.min(cap, p.delayRate || 0)} onChange={e => setP({ ...p, delayRate: parseFloat(e.target.value) || undefined })} className="w-full accent-[#1C2551]" />
        </Field>
      </div>

      <div className="px-6 pt-8 pb-1 text-[17px] font-bold">Ta signature</div>
      <div className="px-6 pt-1 text-[13px]" style={{ color: C.mute }}>Enregistrée ici, elle est reprise dans tes contrats. Tu valides toujours chaque contrat en glissant pour signer.</div>
      <div className="px-6 pt-3">
        {p.signature && !redraw ? (
          <Card className="p-3 flex items-center justify-between gap-4">
            <img src={p.signature} alt="Signature enregistrée" className="h-16 object-contain" />
            <button onClick={() => { setRedraw(true); setP({ ...p, signature: '' }); }} className="text-sm font-bold px-3 py-3" style={{ color: C.ink }}>Refaire</button>
          </Card>
        ) : (
          <SignaturePad label="Signe dans le cadre" onSave={sig => setP({ ...p, signature: sig })} />
        )}
      </div>

      <div className="px-6 pt-5 flex flex-col gap-2.5">
        <Note>Ces informations ne sont visibles que par toi, et par tes proches dans les contrats qui les concernent.</Note>
        {error && <Note tone="danger" icon="alert">{error}</Note>}
      </div>
      <Footer><Button disabled={!complete} busy={saving} onClick={submit}>Enregistrer</Button></Footer>
    </Screen>
  );
};

export default ProfileSetup;
