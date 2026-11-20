import React, { useEffect, useState } from 'react';
import { Screen, TopBar, Button, Card, Note, Skeleton, Field, Toast, Icon, inputClass, inputStyle, C, dateFr } from './ui';
import { getFriday, voteFriday, saveFriday, decideFriday, listPlaces } from '../../services/vendrediService';
import { Friday, FridayOption, Place, nextFriday, isOpen } from '../../utils/vendredi';
import { mapsUrl } from '../../utils/events';
import { frTypo } from '../../utils/articleText';

// « Mon vendredi soir » : Christian propose 2 ou 3 options (chez lui, ou un lieu), chacune avec son
// « pourquoi » ; ses proches votent (anonymement : seuls les totaux sont visibles), puis il tranche.

const areaClass = `${inputClass} h-auto py-3 min-h-[84px]`;
type Draft = { kind: 'home' | 'place'; placeId?: string; name: string; address: string; why: string };
const emptyDraft = (kind: Draft['kind'] = 'place'): Draft => ({ kind, name: kind === 'home' ? 'Chez moi' : '', address: '', why: '' });

const Composer: React.FC<{ initial?: Friday | null; onBack: () => void; onSaved: (msg: string) => void }> = ({ initial, onBack, onSaved }) => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [intro, setIntro] = useState(initial?.intro || '');
  const [opts, setOpts] = useState<Draft[]>(initial?.options.map(o => ({ kind: o.kind, placeId: o.placeId, name: o.name, address: o.address, why: o.why })) || [emptyDraft('home'), emptyDraft(), emptyDraft()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { listPlaces().then(d => setPlaces(d.places)).catch(() => undefined); }, []);
  const date = initial?.date || nextFriday();
  const upd = (i: number, patch: Partial<Draft>) => setOpts(o => o.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const ready = opts.filter(o => o.name.trim() && o.why.trim());
  const publish = async () => {
    setBusy(true); setErr(null);
    try {
      const n = await saveFriday({ date, intro, options: ready.map((o, i) => ({ ...o, id: 'abc'[i] })) }, !initial);
      onSaved(initial ? 'Vendredi mis à jour' : `Publié${n ? ` · ${n} personne${n > 1 ? 's' : ''} prévenue${n > 1 ? 's' : ''}` : ''}`);
    } catch { setErr('Il faut au moins 2 options, chacune avec un nom et un « pourquoi ».'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <TopBar onBack={onBack} title="Mon vendredi soir" />
      <div className="px-5 flex flex-col gap-4 pb-8">
        <div className="text-[14px]" style={{ color: C.mute }}>Pour le {dateFr(date, { weekday: 'long', day: 'numeric', month: 'long' })}. 2 ou 3 options ; tes proches votent, puis tu tranches.</div>
        <Field label="Un mot d'introduction (facultatif)" htmlFor="fi"><textarea id="fi" value={intro} onChange={e => setIntro(e.target.value)} className={areaClass} style={inputStyle} maxLength={300} placeholder="Grosse semaine, j'ai envie de… " /></Field>
        {opts.map((o, i) => (
          <Card key={i} className="p-4 flex flex-col gap-3">
            <div className="text-[13px] font-bold" style={{ color: C.ochreText }}>Option {i + 1}{i === 2 ? ' (facultative)' : ''}</div>
            <select value={o.kind === 'home' ? 'home' : o.placeId || ''} className={inputClass} style={inputStyle}
              onChange={e => {
                const v = e.target.value;
                if (v === 'home') upd(i, { kind: 'home', placeId: undefined, name: 'Chez moi', address: '' });
                else if (!v) upd(i, { kind: 'place', placeId: undefined, name: '', address: '' });
                else { const p = places.find(x => x.id === v); if (p) upd(i, { kind: 'place', placeId: p.id, name: p.name, address: p.address }); }
              }}>
              <option value="home">Chez moi</option>
              <option value="">Autre lieu…</option>
              {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {o.kind === 'place' && !o.placeId && (
              <>
                <input aria-label="Nom du lieu" placeholder="Nom du lieu" value={o.name} onChange={e => upd(i, { name: e.target.value })} className={inputClass} style={inputStyle} maxLength={80} />
                <input aria-label="Adresse" placeholder="Adresse (facultatif)" value={o.address} onChange={e => upd(i, { address: e.target.value })} className={inputClass} style={inputStyle} maxLength={160} />
              </>
            )}
            <textarea aria-label="Pourquoi" placeholder="Pourquoi ? (l'ambiance, la musique, le thème…)" value={o.why} onChange={e => upd(i, { why: e.target.value })} className={areaClass} style={inputStyle} maxLength={400} />
          </Card>
        ))}
        {err && <Note tone="danger">{err}</Note>}
        <Button onClick={publish} busy={busy} disabled={ready.length < 2}>{initial ? 'Enregistrer' : 'Publier et prévenir tout le monde'}</Button>
        {initial && <div className="text-[12.5px] text-center" style={{ color: C.mute }}>Changer les lieux remet les votes à zéro.</div>}
      </div>
    </Screen>
  );
};

const OptionCard: React.FC<{ o: FridayOption; f: Friday; open: boolean; admin: boolean; busy: boolean; onVote: () => void; onDecide: () => void }> = ({ o, f, open, admin, busy, onVote, onDecide }) => {
  const mine = f.myVote === o.id, chosen = f.decided === o.id, total = f.total || 0;
  const pct = total ? Math.round(((o.votes || 0) / total) * 100) : 0;
  const dim = !!f.decided && !chosen;
  return (
    <Card className={`p-4 transition-opacity ${dim ? 'opacity-50' : ''}`} style={chosen ? { boxShadow: `0 0 0 2px ${C.green}` } : mine ? { boxShadow: `0 0 0 2px ${C.ochre}` } : undefined}>
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: o.kind === 'home' ? C.ochreSoft : C.soft, color: o.kind === 'home' ? C.ochreText : C.ink }}>
          <Icon name={o.kind === 'home' ? 'home' : 'glass'} size={21} />
        </span>
        <div className="flex-1 min-w-0">
          {chosen && <div className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.green }}>C'est décidé</div>}
          <div className="serif text-[19px] font-semibold leading-snug">{o.name}</div>
          {o.address && <a href={mapsUrl({ venue: o.name, address: o.address })} target="_blank" rel="noopener noreferrer" className="text-[12.5px] mt-0.5 block truncate" style={{ color: C.mute }}>{o.address}</a>}
        </div>
      </div>
      <p className="text-[14.5px] leading-relaxed mt-3" style={{ color: C.text2 }}>{frTypo(o.why)}</p>
      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: C.line }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: chosen ? C.green : C.ochre }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[12.5px]" style={{ color: C.mute }}>
        <span>{o.votes || 0} vote{(o.votes || 0) > 1 ? 's' : ''}{mine ? ' · dont le tien' : ''}</span>
        {total > 0 && <span>{pct} %</span>}
      </div>
      {open && !f.decided && (
        <button disabled={busy} onClick={onVote} className="mt-3 w-full h-11 rounded-xl text-[14px] font-bold disabled:opacity-50"
          style={mine ? { background: C.soft, color: C.ink } : { background: C.ink, color: '#fff' }}>
          {mine ? 'Retirer mon vote' : 'Je vote pour ça'}
        </button>
      )}
      {admin && !f.decided && (
        <button disabled={busy} onClick={onDecide} className="mt-2 w-full h-10 rounded-xl text-[13.5px] font-bold disabled:opacity-50" style={{ background: C.greenSoft, color: C.green }}>
          Choisir ce lieu
        </button>
      )}
    </Card>
  );
};

const VendrediScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<{ friday: Friday | null; admin: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [compose, setCompose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const load = (fresh = false) => getFriday(fresh).then(d => { setData(d); setFailed(false); }).catch(() => { setFailed(true); setData({ friday: null, admin: false }); });
  useEffect(() => { window.scrollTo(0, 0); load(); }, []);
  if (compose) return <Composer initial={data?.friday} onBack={() => setCompose(false)} onSaved={m => { setCompose(false); setToast(m); load(true); }} />;
  const f = data?.friday;
  const open = !!f && isOpen(f.date);
  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch { setToast('Un souci de connexion. Réessaie.'); } finally { setBusy(false); } };
  return (
    <Screen>
      <TopBar onBack={onBack} title="Mon vendredi soir" />
      <div className="px-6 pt-2 pb-4">
        <h1 className="serif text-[30px] font-semibold leading-tight">{f ? `Vendredi ${dateFr(f.date, { day: 'numeric', month: 'long' })}` : 'Mon vendredi soir'}</h1>
        <p className="text-[15px] leading-relaxed mt-1.5" style={{ color: C.mute }}>
          {f?.decided ? 'Le lieu est choisi. À vendredi !' : f ? 'Christian hésite. Vote pour l’option où tu viendrais : les votes restent anonymes.' : 'Le vendredi, Christian propose deux ou trois options pour la soirée, et vous votez.'}
        </p>
      </div>
      <div className="px-5 flex flex-col gap-3 pb-[max(env(safe-area-inset-bottom),28px)]">
        {!data && <><Skeleton h={200} /><Skeleton h={200} /></>}
        {failed && <Note tone="warn">Le vendredi n'a pas pu être chargé. Vérifie ta connexion.</Note>}
        {f?.intro && <Card className="px-4 py-3.5"><p className="serif text-[16px] leading-relaxed italic" style={{ color: C.text2 }}>« {frTypo(f.intro)} »</p></Card>}
        {f?.options.map(o => (
          <OptionCard key={o.id} o={o} f={f} open={open} admin={!!data?.admin} busy={busy}
            onVote={() => act(async () => { const n = await voteFriday(f.date, f.myVote === o.id ? null : o.id); setData(d => d && { ...d, friday: n }); setToast(f.myVote === o.id ? 'Vote retiré' : 'Vote enregistré'); })}
            onDecide={() => act(async () => { const r = await decideFriday(f.date, o.id); setData(d => d && { ...d, friday: r.friday }); setToast(`C'est décidé${r.notified ? ` · ${r.notified} prévenu${r.notified > 1 ? 's' : ''}` : ''}`); })} />
        ))}
        {f && <div className="text-[12.5px] text-center" style={{ color: C.mute }}>{f.total || 0} vote{(f.total || 0) > 1 ? 's' : ''} au total{open && !f.decided ? ' · ouvert jusqu’à samedi midi' : ''}</div>}
        {data && !f && !data.admin && !failed && <Card className="px-5 py-8 text-center"><div className="text-[15px] font-semibold">Rien de prévu pour l'instant</div><div className="text-sm mt-1" style={{ color: C.mute }}>Tu recevras une notification quand Christian proposera ses options.</div></Card>}
        {data?.admin && <Button variant={f ? 'secondary' : 'primary'} onClick={() => setCompose(true)}>{f ? 'Modifier les options' : 'Préparer mon vendredi'}</Button>}
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

export default VendrediScreen;
