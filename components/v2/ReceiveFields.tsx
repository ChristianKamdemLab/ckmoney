import React from 'react';
import { ReceiveInfo, isValidIban, formatIban } from '../../types';
import { Chips, Field, inputClass, inputStyle } from './ui';

export const receiveValid = (r: ReceiveInfo) => {
  const v = r.value.trim();
  if (r.method === 'paypal') return /paypal\.me\/[^\s/]+/i.test(v) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (r.method === 'virement') return isValidIban(v) && r.holder !== undefined && r.holder.trim().length > 2;
  return /^(https?:\/\/)?[^\s]+\.[^\s]+$/i.test(v);
};

export const receiveLabel = (r?: ReceiveInfo) =>
  !r ? '' : r.method === 'paypal' ? `PayPal · ${r.value}` : r.method === 'virement' ? `Virement instantané · ${formatIban(r.value)}` : `Lien de paiement · ${r.value}`;

/** Choix du moyen de réception : PayPal, virement instantané (RIB) ou lien de paiement. */
const ReceiveFields: React.FC<{ value: ReceiveInfo; onChange: (r: ReceiveInfo) => void; defaultHolder: string }> = ({ value, onChange, defaultHolder }) => {
  const r = value;
  const ibanTyped = r.method === 'virement' && r.value.replace(/\s/g, '').length >= 14;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] font-semibold" style={{ color: '#3A3E52' }}>Où veux-tu recevoir l'argent ?</div>
      <Chips value={r.method} onChange={m => onChange({ method: m as ReceiveInfo['method'], value: '', holder: m === 'virement' ? (r.holder || defaultHolder) : undefined })}
        options={[{ id: 'paypal', label: 'PayPal' }, { id: 'virement', label: 'Virement instantané' }, { id: 'lien', label: 'Lien de paiement' }]} />
      {r.method === 'paypal' && (
        <Field label="Ton lien PayPal.me ou ton e-mail PayPal" htmlFor="rcv">
          <input id="rcv" value={r.value} onChange={e => onChange({ ...r, value: e.target.value })} autoCapitalize="none" autoComplete="off" inputMode="email" className={inputClass} style={inputStyle} placeholder="paypal.me/ton-nom" />
        </Field>
      )}
      {r.method === 'virement' && (
        <>
          <Field label="IBAN" htmlFor="iban" hint={ibanTyped && !isValidIban(r.value) ? "Cet IBAN n'est pas valide, vérifie-le." : 'Ton RIB : il te fait un virement instantané.'}>
            <input id="iban" value={r.value} onChange={e => onChange({ ...r, value: e.target.value.toUpperCase() })} autoCapitalize="characters" autoComplete="off"
              className={inputClass} style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em' }} placeholder="FR76 3000 …" />
          </Field>
          <Field label="Titulaire du compte" htmlFor="holder">
            <input id="holder" value={r.holder ?? defaultHolder} onChange={e => onChange({ ...r, holder: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="BIC (facultatif)" htmlFor="bic">
            <input id="bic" value={r.bic || ''} onChange={e => onChange({ ...r, bic: e.target.value.toUpperCase() })} autoCapitalize="characters" autoComplete="off" className={inputClass} style={inputStyle} />
          </Field>
        </>
      )}
      {r.method === 'lien' && (
        <Field label="Ton lien de paiement" htmlFor="lnk" hint="Lydia, Revolut, Wero… le lien où il peut t'envoyer l'argent.">
          <input id="lnk" value={r.value} onChange={e => onChange({ ...r, value: e.target.value })} autoCapitalize="none" autoComplete="off" inputMode="url" className={inputClass} style={inputStyle} placeholder="revolut.me/ton-nom" />
        </Field>
      )}
    </div>
  );
};

export default ReceiveFields;
