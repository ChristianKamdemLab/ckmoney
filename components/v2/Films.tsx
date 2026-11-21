import React, { useEffect, useState } from 'react';
import { Screen, TopBar, NightHeader, Button, Card, Note, Skeleton, Field, Toast, Icon, inputClass, inputStyle, C } from './ui';
import { listFilms, saveFilm, deleteFilm } from '../../services/filmService';
import { Film, FilmKind, KIND_LABEL, ratingLabel, trailerImage, youtubeId } from '../../utils/films';
import { frTypo } from '../../utils/articleText';

// « Films et séries » : ce que Christian a regardé, avec la bande-annonce officielle (son image sert
// d'affiche), sa note sur 10 et son avis ; un avis qui dévoile l'intrigue reste masqué jusqu'au clic.

const meta = (f: Film) => [KIND_LABEL[f.kind], f.season, f.by, f.where].filter(Boolean).join(' · ');

/** Image de la bande-annonce, avec repli sur la petite si la grande n'existe pas. */
const Still: React.FC<{ id: string; alt: string; className?: string }> = ({ id, alt, className = '' }) => {
  const [src, setSrc] = useState<string | null>(trailerImage(id));
  useEffect(() => { setSrc(trailerImage(id)); }, [id]);
  if (!src) return null; // ni grande ni petite image : on garde le fond indigo
  const fallback = () => setSrc(s => (s && s.includes('maxres') ? trailerImage(id, 'hq') : null));
  return <img src={src} alt={alt} loading="lazy" className={`w-full h-full object-cover ${className}`} onError={fallback}
    onLoad={e => { if ((e.target as HTMLImageElement).naturalWidth <= 120) fallback(); }} />;
};

const Rating: React.FC<{ r: number; big?: boolean }> = ({ r, big }) => (
  <span className={`display inline-flex items-baseline rounded-md ${big ? 'px-3 py-2 text-[26px]' : 'px-2 py-1 text-[15px]'}`} style={{ background: C.mango, color: C.ink }}>
    {String(r).replace('.', ',')}<span className={big ? 'text-[14px] ml-0.5' : 'text-[10px] ml-0.5'}>/10</span>
  </span>
);

const Player: React.FC<{ f: Film }> = ({ f }) => {
  const [play, setPlay] = useState(false);
  if (!f.trailer) return null;
  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '16 / 9' }}>
      {play ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${f.trailer}?autoplay=1&rel=0&playsinline=1`} title={`Bande-annonce : ${f.title}`}
          className="absolute inset-0 w-full h-full" style={{ border: 0 }} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <button onClick={() => setPlay(true)} className="absolute inset-0 w-full h-full" aria-label={`Lire la bande-annonce de ${f.title}`}>
          <Still id={f.trailer} alt="" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-[68px] h-[68px] rounded-full flex items-center justify-center" style={{ background: C.mango, color: C.ink, boxShadow: '0 4px 18px rgba(0,0,0,.35)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
            </span>
          </span>
          <span className="absolute left-3 bottom-3 text-[12px] font-extrabold px-2.5 py-1 rounded-md" style={{ background: 'rgba(14,21,51,.85)', color: '#F7F3EA' }}>Bande-annonce</span>
        </button>
      )}
    </div>
  );
};

const Detail: React.FC<{ f: Film; admin: boolean; onBack: () => void; onEdit: () => void }> = ({ f, admin, onBack, onEdit }) => {
  const [show, setShow] = useState(!f.spoilers);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <Screen>
      <TopBar onBack={onBack} title={KIND_LABEL[f.kind]} right={admin ? <button onClick={onEdit} className="text-[13px] font-bold pr-1" style={{ color: C.ochreText }}>Modifier</button> : undefined} />
      <Player f={f} />
      <div className="px-5 pt-5 pb-[max(env(safe-area-inset-bottom),28px)]">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: C.ochreText }}>{meta(f)}</div>
            <h1 className="display text-[28px] leading-[1.08] mt-1.5">{f.title}</h1>
          </div>
          <Rating r={f.rating} big />
        </div>
        {f.teaser && <p className="text-[16px] leading-relaxed mt-3 font-semibold" style={{ color: C.text2 }}>{frTypo(f.teaser)}</p>}
        <div className="display text-[12px] uppercase tracking-[0.16em] mt-7 mb-2.5" style={{ color: C.mute }}>Mon avis</div>
        {show ? (
          <div className="flex flex-col gap-3">
            {f.review.split(/\n+/).map((p, i) => <p key={i} className="text-[16.5px] leading-[1.65]" style={{ color: '#1B2140' }}>{frTypo(p)}</p>)}
            <div className="text-[13px] font-semibold mt-1" style={{ color: C.mute }}>Christian · {ratingLabel(f.rating)}</div>
          </div>
        ) : (
          <Card className="p-4" style={{ boxShadow: `inset 0 0 0 1.5px ${C.border}` }}>
            <div className="text-[15px] font-extrabold">Attention, spoilers</div>
            <p className="text-[14px] leading-relaxed mt-1" style={{ color: C.text2 }}>Mon avis dévoile une bonne partie de l’intrigue. Regarde d’abord, ou lis quand même.</p>
            <button onClick={() => setShow(true)} className="mt-3 w-full h-12 rounded-xl text-[15px] font-extrabold" style={{ background: C.ink, color: '#fff' }}>Lire quand même</button>
          </Card>
        )}
      </div>
    </Screen>
  );
};

const areaClass = `${inputClass} h-auto py-3 min-h-[150px]`;

const Editor: React.FC<{ initial?: Film; onBack: () => void; onSaved: (msg: string) => void }> = ({ initial, onBack, onSaved }) => {
  const [f, setF] = useState<Partial<Film>>(initial || { kind: 'serie', title: '', season: '', by: '', where: '', rating: 8, teaser: '', review: '', spoilers: false, trailer: '', poster: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Film) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const yt = youtubeId(f.trailer);
  const save = async () => {
    setBusy(true); setErr(null);
    try { await saveFilm({ ...f, trailer: yt }); onSaved('Enregistré'); } catch { setErr('Il faut au moins un titre, une note et ton avis.'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <TopBar onBack={onBack} title={initial ? 'Modifier' : 'Nouveau film ou série'} />
      <div className="px-5 flex flex-col gap-4 pb-8">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: C.soft }}>
          {(['serie', 'film'] as FilmKind[]).map(k => (
            <button key={k} onClick={() => setF({ ...f, kind: k })} className="h-11 rounded-lg text-[14.5px] font-extrabold"
              style={f.kind === k ? { background: C.card, color: C.ink } : { color: C.mute }}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        <Field label="Titre" htmlFor="ft"><input id="ft" value={f.title} onChange={set('title')} className={inputClass} style={inputStyle} maxLength={100} /></Field>
        <div className="grid grid-cols-2 gap-3">
          {f.kind === 'serie'
            ? <Field label="Saison" htmlFor="fs"><input id="fs" value={f.season} onChange={set('season')} placeholder="Saison 2" className={inputClass} style={inputStyle} maxLength={40} /></Field>
            : <Field label="Réalisateur" htmlFor="fb"><input id="fb" value={f.by} onChange={set('by')} className={inputClass} style={inputStyle} maxLength={80} /></Field>}
          <Field label="Où le voir" htmlFor="fw"><input id="fw" value={f.where} onChange={set('where')} placeholder="Netflix, au cinéma…" className={inputClass} style={inputStyle} maxLength={60} /></Field>
        </div>
        <Field label={`Ta note : ${ratingLabel(Number(f.rating) || 0)}`} htmlFor="fr">
          <input id="fr" type="range" min={0} max={10} step={0.5} value={f.rating} onChange={e => setF({ ...f, rating: Number(e.target.value) })} className="w-full h-11" style={{ accentColor: C.mango }} />
        </Field>
        <Field label="Bande-annonce (lien YouTube)" htmlFor="fy" hint="La chaîne officielle de préférence. Son image sert d’affiche.">
          <input id="fy" value={f.trailer} onChange={set('trailer')} inputMode="url" placeholder="https://youtu.be/…" className={inputClass} style={inputStyle} />
        </Field>
        {yt && <div className="rounded-[10px] overflow-hidden" style={{ aspectRatio: '16 / 9' }}><Still id={yt} alt="Aperçu de la bande-annonce" /></div>}
        <Field label="En une phrase (sans spoiler)" htmlFor="fz"><input id="fz" value={f.teaser} onChange={set('teaser')} className={inputClass} style={inputStyle} maxLength={200} /></Field>
        <Field label="Ton avis" htmlFor="fv"><textarea id="fv" value={f.review} onChange={set('review')} className={areaClass} style={inputStyle} maxLength={4000} /></Field>
        <label className="flex items-center gap-3 min-h-[44px] text-[15px] font-semibold">
          <input type="checkbox" checked={!!f.spoilers} onChange={e => setF({ ...f, spoilers: e.target.checked })} className="w-5 h-5" style={{ accentColor: C.ink }} />
          Mon avis contient des spoilers
        </label>
        {err && <Note tone="danger">{err}</Note>}
        <Button onClick={save} busy={busy} disabled={!f.title?.trim() || !f.review?.trim()}>Enregistrer</Button>
        {initial && <Button variant="danger" onClick={async () => { setBusy(true); try { await deleteFilm(initial.id); onSaved('Retiré'); } finally { setBusy(false); } }}>Retirer</Button>}
      </div>
    </Screen>
  );
};

const FilmCard: React.FC<{ f: Film; onOpen: () => void }> = ({ f, onOpen }) => (
  <button onClick={onOpen} className="text-left w-full rounded-[10px] overflow-hidden" style={{ background: C.card }}>
    <div className="relative w-full" style={{ aspectRatio: '16 / 9', background: C.night }}>
      {f.trailer && <Still id={f.trailer} alt="" />}
      <span className="absolute top-3 right-3"><Rating r={f.rating} /></span>
      {f.trailer && (
        <span className="absolute left-3 bottom-3 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(14,21,51,.85)', color: C.mango }} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
        </span>
      )}
    </div>
    <div className="px-4 py-3.5">
      <div className="text-[11.5px] font-extrabold uppercase tracking-wide" style={{ color: C.ochreText }}>{meta(f)}</div>
      <div className="display text-[19px] leading-tight mt-1">{f.title}</div>
      {f.teaser && <div className="text-[14px] leading-snug mt-1.5" style={{ color: C.text2 }}>{frTypo(f.teaser)}</div>}
    </div>
  </button>
);

const FilmsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<{ films: Film[]; admin: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{ k: 'list' } | { k: 'read'; f: Film } | { k: 'edit'; f?: Film }>({ k: 'list' });
  const [filter, setFilter] = useState<'all' | FilmKind>('all');
  const [toast, setToast] = useState<string | null>(null);
  const load = () => listFilms().then(d => { setData(d); setFailed(false); }).catch(() => { setFailed(true); setData({ films: [], admin: false }); });
  useEffect(() => { window.scrollTo(0, 0); load(); }, []);

  if (view.k === 'read') return <Detail f={view.f} admin={!!data?.admin} onBack={() => setView({ k: 'list' })} onEdit={() => setView({ k: 'edit', f: view.f })} />;
  if (view.k === 'edit') return <Editor initial={view.f} onBack={() => setView(view.f ? { k: 'read', f: view.f } : { k: 'list' })} onSaved={m => { setView({ k: 'list' }); setToast(m); load(); }} />;

  const list = (data?.films || []).filter(f => filter === 'all' || f.kind === filter);
  return (
    <Screen>
      <NightHeader onBack={onBack} title="Films et séries" accent={C.coral} desc="Ce que Christian a regardé : la bande-annonce, sa note et son avis.">
        {data?.admin && <button onClick={() => setView({ k: 'edit' })} className="w-full min-h-[52px] rounded-xl flex items-center justify-center gap-2 text-[15.5px] font-extrabold" style={{ background: C.coral, color: C.ink }}><Icon name="plus" size={20} /> Ajouter un film ou une série</button>}
      </NightHeader>
      <div className="px-5 flex gap-2 pb-3">
        {([['all', 'Tout'], ['serie', 'Séries'], ['film', 'Films']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className="h-10 px-4 rounded-full text-[14px] font-bold"
            style={filter === k ? { background: C.ink, color: '#fff' } : { background: C.card, color: C.ink }}>{l}</button>
        ))}
      </div>
      <div className="px-5 flex flex-col gap-4 pb-[max(env(safe-area-inset-bottom),28px)]">
        {!data && <><Skeleton h={300} /><Skeleton h={300} /></>}
        {failed && <Note tone="warn">La liste n’a pas pu être chargée. Vérifie ta connexion.</Note>}
        {list.map(f => <FilmCard key={f.id} f={f} onOpen={() => setView({ k: 'read', f })} />)}
        {data && !failed && !list.length && <Card className="px-5 py-8 text-center"><div className="text-[15px] font-semibold">Rien pour l’instant</div></Card>}
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

export default FilmsScreen;
