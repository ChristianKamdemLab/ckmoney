import React, { useState } from 'react';
import { Screen, TopBar, Button, Note, Field, Icon, inputClass, inputStyle, C } from './ui';
import { FELT } from './JamboTable';
export { nameOf } from '../../games/tableNames';

// Briques communes aux jeux en ligne (Jambo, Baccalauréat…) : bandeau, prénom, partage du lien.

export const Felt: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mx-5 mt-2 rounded-[24px] px-6 pt-6 pb-6 text-white" style={{ background: FELT }}>{children}</div>
);

/** Prénom avant de créer ou de rejoindre une table. */
export const NameStep: React.FC<{ topTitle: string; eyebrow: string; title: string; desc: string; cta: string; initial: string; busy: boolean; error: string | null; onBack: () => void; onSubmit: (name: string) => void }> = ({ topTitle, eyebrow, title, desc, cta, initial, busy, error, onBack, onSubmit }) => {
  const [name, setName] = useState(initial);
  return (
    <Screen>
      <TopBar onBack={onBack} title={topTitle} />
      <Felt>
        <div className="text-[13px] font-semibold" style={{ color: C.ochre }}>{eyebrow}</div>
        <h1 className="serif text-[28px] font-semibold leading-[1.1] mt-1">{title}</h1>
        <p className="text-[14px] leading-relaxed mt-2" style={{ color: 'rgba(255,255,255,.75)' }}>{desc}</p>
      </Felt>
      <form className="px-5 pt-6 flex flex-col gap-4 flex-1" onSubmit={e => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}>
        <Field label="Ton prénom" htmlFor="jn" hint="C'est le nom que verront les autres joueurs.">
          <input id="jn" autoComplete="given-name" maxLength={20} value={name} onChange={e => setName(e.target.value)} className={inputClass} style={inputStyle} />
        </Field>
        {error && <Note tone="danger">{error}</Note>}
        <div className="mt-auto pb-[max(env(safe-area-inset-bottom),24px)]">
          <Button type="submit" busy={busy} disabled={!name.trim()}>{cta}</Button>
        </div>
      </form>
    </Screen>
  );
};

/** Nom de la table, code en petit, et partage (WhatsApp, copie du lien). L'hôte peut tirer un autre nom. */
export const ShareBox: React.FC<{ name: string; code: string; link: string; text: string; onCopied: () => void; desc?: string; onRename?: () => void; renaming?: boolean }> = ({ name, code, link, text, onCopied, desc, onRename, renaming }) => (
  <Felt>
    <div className="flex items-center justify-between gap-2">
      <div className="text-[13px] font-semibold" style={{ color: C.ochre }}>Table</div>
      {onRename && (
        <button onClick={onRename} disabled={renaming} className="h-8 px-3 rounded-full flex items-center gap-1.5 text-[12.5px] font-semibold disabled:opacity-50" style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.85)' }}>
          <Icon name="refresh" size={14} /> Autre nom
        </button>
      )}
    </div>
    <div className="serif text-[34px] font-semibold leading-[1.08] mt-1">{name}</div>
    <div className="text-[12px] font-medium mt-1.5 tracking-[1.5px]" style={{ color: 'rgba(255,255,255,.5)' }}>CODE {code}</div>
    <p className="text-[14px] leading-relaxed mt-3" style={{ color: 'rgba(255,255,255,.75)' }}>{desc || "Envoie le lien à tes amis : ils entrent leur prénom et s'assoient. Pas besoin de compte."}</p>
    <div className="grid grid-cols-2 gap-2 mt-4">
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
        className="h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-bold text-white" style={{ background: C.green }}>
        <Icon name="chat" size={18} /> WhatsApp
      </a>
      <button onClick={() => { navigator.clipboard?.writeText(link); onCopied(); }}
        className="h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-bold" style={{ background: 'rgba(255,255,255,.12)' }}>
        <Icon name="copy" size={18} /> Copier le lien
      </button>
    </div>
  </Felt>
);
