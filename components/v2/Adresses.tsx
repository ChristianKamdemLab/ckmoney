import React, { useEffect, useState } from 'react';
import { Screen, TopBar, Button, Card, Note, Skeleton, Field, Toast, Icon, inputClass, inputStyle, C, NightHeader } from './ui';
import { listPlaces, savePlace, deletePlace } from '../../services/vendrediService';
import { Place } from '../../utils/vendredi';
import { mapsUrl } from '../../utils/events';
import { frTypo } from '../../utils/articleText';

// « Mes adresses » : les lieux que Christian a testés et recommande, avec son avis et le budget à prévoir.

const areaClass = `${inputClass} h-auto py-3 min-h-[110px]`;

const Editor: React.FC<{ initial?: Place; onBack: () => void; onSaved: (msg: string) => void }> = ({ initial, onBack, onSaved }) => {
  const [p, setP] = useState<Partial<Place>>(initial || { name: '', address: '', url: '', review: '', budget: '', hours: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Place) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });
  const save = async () => {
    setBusy(true); setErr(null);
    try { await savePlace(p); onSaved('Adresse enregistrée'); } catch { setErr('Il faut au moins un nom et ton avis.'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <TopBar onBack={onBack} title={initial ? "Modifier l'adresse" : 'Nouvelle adresse'} />
      <div className="px-5 flex flex-col gap-4 pb-8">
        <Field label="Nom du lieu" htmlFor="pn"><input id="pn" value={p.name} onChange={set('name')} className={inputClass} style={inputStyle} maxLength={80} /></Field>
        <Field label="Ton avis" htmlFor="pr" hint="Ce que tu as aimé, le bémol, pour qui c'est."><textarea id="pr" value={p.review} onChange={set('review')} className={areaClass} style={inputStyle} maxLength={1500} /></Field>
        <Field label="Budget à prévoir" htmlFor="pb" hint="Par exemple : cocktails 15 €, chicha 70 €."><input id="pb" value={p.budget} onChange={set('budget')} className={inputClass} style={inputStyle} maxLength={80} /></Field>
        <Field label="Adresse" htmlFor="pa"><input id="pa" value={p.address} onChange={set('address')} className={inputClass} style={inputStyle} maxLength={160} /></Field>
        <Field label="Horaires" htmlFor="ph"><input id="ph" value={p.hours} onChange={set('hours')} className={inputClass} style={inputStyle} maxLength={120} /></Field>
        <Field label="Site ou page (https://…)" htmlFor="pu"><input id="pu" value={p.url} onChange={set('url')} className={inputClass} style={inputStyle} inputMode="url" /></Field>
        {err && <Note tone="danger">{err}</Note>}
        <Button onClick={save} busy={busy} disabled={!p.name?.trim() || !p.review?.trim()}>Enregistrer</Button>
        {initial && <Button variant="danger" onClick={async () => { setBusy(true); try { await deletePlace(initial.id); onSaved('Adresse retirée'); } finally { setBusy(false); } }}>Retirer cette adresse</Button>}
      </div>
    </Screen>
  );
};

export const PlaceCard: React.FC<{ p: Place; onEdit?: () => void }> = ({ p, onEdit }) => (
  <Card className="px-5 py-5 overflow-hidden">
    {/* Photo du lieu (27/11), comme dans le Vendredi Show */}
    {p.image && <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="-mx-5 -mt-5 mb-4 w-[calc(100%+2.5rem)] max-w-none aspect-[16/9] object-cover" />}
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-[20px] font-extrabold leading-tight">{p.name}</h2>
      {onEdit && <button onClick={onEdit} className="text-[13px] font-semibold shrink-0" style={{ color: C.ochreText }}>Modifier</button>}
    </div>
    <div className="mt-3 flex flex-col gap-2.5">
      {p.review.split(/\n+/).filter(Boolean).map((t, i) => <p key={i} className="text-[16px] leading-[1.6]" style={{ color: '#1B2140' }}>{frTypo(t)}</p>)}
    </div>
    {/* Sans avis (lieu ajouté avant d'y être allé) : pas de mention « L'avis de Christian » */}
    {p.review.trim() ? <div className="text-[12.5px] mt-1.5" style={{ color: C.mute }}>L'avis de Christian</div> : <div className="text-[14px] italic" style={{ color: C.mute }}>Avis à venir.</div>}
    <div className="mt-4 flex flex-col gap-2 text-[13.5px]" style={{ color: C.text2 }}>
      {p.budget && <div className="flex gap-2"><span className="shrink-0" style={{ color: C.ochreText }}><Icon name="ticket" size={17} /></span>{p.budget}</div>}
      {p.hours && <div className="flex gap-2"><span className="shrink-0" style={{ color: C.ochreText }}><Icon name="clock" size={17} /></span>{p.hours}</div>}
      {p.address && <a href={mapsUrl({ venue: p.name.split(' · ')[0], address: p.address })} target="_blank" rel="noopener noreferrer" className="flex gap-2 underline-offset-2 hover:underline"><span className="shrink-0" style={{ color: C.ochreText }}><Icon name="pin" size={17} /></span>{p.address}</a>}
    </div>
    {/* « Voir le lieu » : la fiche Google Maps (photos, avis, horaires), même sans site ; le site en plus s'il existe */}
    <div className={`mt-4 grid gap-2 ${p.url ? 'grid-cols-2' : 'grid-cols-1'}`}>
      <a href={mapsUrl({ venue: p.name.split(' · ')[0], address: p.address })} target="_blank" rel="noopener noreferrer"
        className="h-12 rounded-xl flex items-center justify-center gap-2 text-[14.5px] font-extrabold" style={{ background: C.ink, color: '#fff' }}>
        <Icon name="pin" size={17} /> Voir le lieu
      </a>
      {p.url && (
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="h-12 rounded-xl flex items-center justify-center gap-2 text-[14.5px] font-bold" style={{ background: C.soft, color: C.ink }}>
          Le site <Icon name="arrow" size={16} />
        </a>
      )}
    </div>
  </Card>
);

const AdressesScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<{ places: Place[]; admin: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [edit, setEdit] = useState<Place | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const load = () => listPlaces().then(d => { setData(d); setFailed(false); }).catch(() => { setFailed(true); setData({ places: [], admin: false }); });
  useEffect(() => { window.scrollTo(0, 0); load(); }, []);
  if (edit) return <Editor initial={edit === 'new' ? undefined : edit} onBack={() => setEdit(null)} onSaved={m => { setEdit(null); setToast(m); load(); }} />;
  return (
    <Screen>
      <NightHeader onBack={onBack} title="Mes adresses" accent={C.teal} desc="Les lieux que Christian a testés et recommande, avec son avis et le budget à prévoir." />
      <div className="px-5 flex flex-col gap-3 pb-[max(env(safe-area-inset-bottom),28px)]">
        {data?.admin && <Button onClick={() => setEdit('new')}><Icon name="plus" size={20} /> Ajouter une adresse</Button>}
        {!data && <><Skeleton h={220} /><Skeleton h={220} /></>}
        {failed && <Note tone="warn">Les adresses n'ont pas pu être chargées. Vérifie ta connexion.</Note>}
        {data?.places.map(p => <PlaceCard key={p.id} p={p} onEdit={data.admin ? () => setEdit(p) : undefined} />)}
        {data && !failed && !data.places.length && <Card className="px-5 py-8 text-center"><div className="text-[15px] font-semibold">Pas encore d'adresse</div></Card>}
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

export default AdressesScreen;
