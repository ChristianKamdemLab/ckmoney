import React, { useEffect, useState } from 'react';
import { C, Icon, Sheet, Field, Button, Note, Toast, inputClass, inputStyle, dateFr } from './ui';
import { getShow, pickShow, addShow, removeShow } from '../../services/vendrediService';
import type { Show, ShowChoice } from '../../utils/vendrediShow';

// « Vendredi Show » (26/11) : la rangée des plans pour vendredi soir, sans vote. Chacun touche « J'y vais »
// sur le choix qui lui plaît ; l'hôte d'un chill à domicile est prévenu à chaque venue.

const going = (c: ShowChoice) => c.going.length ? `${c.going.length} y ${c.going.length > 1 ? 'vont' : 'va'}` : '';

const Cover: React.FC<{ c: ShowChoice; h: number }> = ({ c, h }) => (
  <span className="relative overflow-hidden block rounded-2xl" style={{ height: h, background: c.kind === 'home' ? C.mango : C.night, color: c.kind === 'home' ? C.ink : C.mango }}>
    {c.image
      ? <img src={c.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
      : <span className="absolute inset-0 flex items-center justify-center"><Icon name={c.kind === 'home' ? 'home' : 'pin'} size={34} /></span>}
    {c.going.length > 0 && <span className="absolute left-2 bottom-2 px-2 py-[3px] rounded-full text-[11.5px] font-extrabold" style={{ background: C.ink, color: '#fff' }}>{going(c)}</span>}
  </span>
);

const VendrediShow: React.FC<{ standalone?: boolean }> = ({ standalone }) => {
  const [show, setShow] = useState<Show | null>(null);
  const [open, setOpen] = useState<ShowChoice | null>(null);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<'place' | 'home'>('place');
  const [form, setForm] = useState({ name: '', address: '', url: '' });
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { getShow().then(setShow).catch(() => undefined); }, []);
  if (!show) return null;

  const act = async (key: string, f: () => Promise<Show>, ok?: string) => {
    setBusy(key);
    try { const s = await f(); setShow(s); if (open) setOpen(s.choices.find(c => c.id === open.id) || null); if (ok) setToast(ok); return true; }
    catch (e: any) { setToast(e?.message === 'deja' ? 'Ton chill est déjà dans la liste.' : e?.message === 'complet' ? 'La liste de la semaine est pleine.' : "Ça n'a pas marché, réessaie."); return false; }
    finally { setBusy(''); }
  };
  const pick = (c: ShowChoice) => act(c.id, () => pickShow(c.me ? null : c.id), c.me ? undefined : c.kind === 'home' && c.hostUid ? `C'est noté, ${c.name.replace(/^Chill chez /, '')} est prévenu` : "C'est noté, à vendredi !");
  const submit = async () => {
    const ok = await act('add', () => addShow(kind === 'home' ? { kind, address: form.address } : { kind, ...form }), kind === 'home' ? 'Ton chill est proposé' : 'Lieu ajouté');
    if (ok) { setAdding(false); setForm({ name: '', address: '', url: '' }); }
  };
  const friday = dateFr(show.date, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className={`px-5 ${standalone ? 'pt-2' : 'pt-7'} pb-3 flex items-end justify-between`}>
        <div>
          <h2 className="text-[18px] font-extrabold">Vendredi Show</h2>
          <div className="text-[12.5px] first-letter:uppercase" style={{ color: C.mute }}>{friday} · touche « J'y vais »</div>
        </div>
        <button onClick={() => setAdding(true)} className="text-[14px] font-bold" style={{ color: C.ochreText }}>Proposer</button>
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }}>
        {show.choices.map(c => (
          <div key={c.id} className="shrink-0 w-[136px]">
            <button onClick={() => setOpen(c)} className="block w-full text-left">
              <Cover c={c} h={136} />
              <span className="text-[14px] font-extrabold leading-[1.3] mt-1.5 line-clamp-1">{c.name}</span>
              <span className="text-[12.5px] line-clamp-1" style={{ color: C.mute }}>{c.sub || ' '}</span>
            </button>
            <button onClick={() => pick(c)} disabled={busy === c.id} className="mt-2 w-full h-9 rounded-full text-[13px] font-extrabold flex items-center justify-center gap-1.5"
              style={c.me ? { background: C.green, color: '#fff' } : { background: C.card, color: C.ink, border: `1.5px solid ${C.border}` }}>
              {busy === c.id ? '…' : c.me ? <><Icon name="check" size={15} /> J'y vais</> : "J'y vais"}
            </button>
          </div>
        ))}
        <button onClick={() => setAdding(true)} className="shrink-0 w-[136px] h-[136px] rounded-2xl flex flex-col items-center justify-center gap-2 text-[14px] font-extrabold" style={{ border: `2px dashed ${C.border}`, color: C.text2 }}>
          <Icon name="plus" size={24} />Proposer un plan
        </button>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name || ''}>
        {open && (
          <div className="flex flex-col gap-3">
            <Cover c={open} h={170} />
            {open.review && <div className="text-[14.5px] leading-relaxed" style={{ color: C.text2 }}>« {open.review} » <span style={{ color: C.mute }}>· Christian</span></div>}
            {open.sub && <div className="text-[14px] font-semibold" style={{ color: C.mute }}>{open.sub}</div>}
            {open.address
              ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(open.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[14.5px] font-semibold" style={{ color: C.ink }}><Icon name="pin" size={18} />{open.address}</a>
              : open.kind === 'home' && <div className="text-[13.5px]" style={{ color: C.mute }}>L'adresse s'affiche quand tu y vas.</div>}
            {open.url && <a href={open.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-bold" style={{ color: C.ochreText }}>Voir la page du lieu</a>}
            <div className="text-[14px]"><b>{open.going.length ? `${going(open)} :` : "Personne pour l'instant."}</b> {open.going.join(', ')}</div>
            <Button busy={busy === open.id} variant={open.me ? 'secondary' : 'primary'} onClick={() => pick(open)}>{open.me ? "Je n'y vais plus" : "J'y vais"}</Button>
            {(open.mine || (show.admin && !open.id.startsWith('p_') && open.id !== 'home_christian')) && (
              <Button variant="danger" busy={busy === 'rm'} onClick={async () => { if (await act('rm', () => removeShow(open.id), 'Choix retiré')) setOpen(null); }}>Retirer ce choix</Button>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Proposer un plan pour vendredi">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: C.soft }}>
            {([['place', 'Un lieu'], ['home', 'Chill chez moi']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setKind(k)} disabled={k === 'home' && !show.canHome} className="h-11 rounded-xl text-[14.5px] font-bold disabled:opacity-40"
                style={kind === k ? { background: C.card, color: C.ink, boxShadow: '0 1px 3px rgba(14,21,51,.12)' } : { color: C.mute }}>{l}</button>
            ))}
          </div>
          {kind === 'place' ? (
            <>
              <Field label="Nom du lieu" htmlFor="sh-n"><input id="sh-n" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} placeholder="Le bar, le resto, le spot…" /></Field>
              <Field label="Adresse" htmlFor="sh-a"><input id="sh-a" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputClass} style={inputStyle} placeholder="12 rue…, Paris" /></Field>
              <Field label="Lien (Instagram, site, Google Maps)" htmlFor="sh-u" hint="L'appli en tire la photo du lieu."><input id="sh-u" type="url" inputMode="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value.trim() })} className={inputClass} style={inputStyle} placeholder="https://" /></Field>
              <Button busy={busy === 'add'} disabled={form.name.trim().length < 2 || (!!form.url && !/^https:\/\//.test(form.url))} onClick={submit}>Ajouter ce lieu</Button>
            </>
          ) : (
            <>
              <Field label="Ton adresse (facultatif)" htmlFor="sh-h"><input id="sh-h" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputClass} style={inputStyle} placeholder="Visible seulement par ceux qui viennent" /></Field>
              <Note icon="bell">Tu recevras une notification à chaque personne qui choisit ton chill.</Note>
              <Button busy={busy === 'add'} onClick={submit}>Proposer un chill chez moi</Button>
            </>
          )}
        </div>
      </Sheet>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
};

export default VendrediShow;
