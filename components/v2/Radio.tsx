import React, { useEffect, useState } from 'react';
import { Screen, TopBar, Button, Card, Note, Sheet, Toast, Skeleton, Chips, Field, inputClass, inputStyle, Icon, C, dateFr } from './ui';
import { listRadio, getRadio, previewRadio, saveRadio, deleteRadio, reactRadio, commentRadio, deleteRadioComment } from '../../services/radioService';
import { RadioItem, RadioComment, RadioKind, REACTIONS, KIND_LABEL, PLATFORM_LABEL, MAX_COMMENT, embedHeight, parseMedia } from '../../utils/radio';

// Radio CK : les podcasts et vidéos que Christian recommande. On écoute dans l'appli (lecteur officiel
// de la plateforme, chargé seulement quand on appuie sur lecture), puis on réagit et on commente.

type Filter = 'all' | RadioKind;
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  if (m < 24 * 60) return `il y a ${Math.round(m / 60)} h`;
  return dateFr(iso, { day: 'numeric', month: 'short' });
};

/** Vignette : 16:9 pour une vidéo, carrée pour un podcast ou un son. */
const Thumb: React.FC<{ item: Pick<RadioItem, 'thumbnail' | 'kind' | 'title'>; size?: number }> = ({ item, size = 76 }) => {
  const video = item.kind === 'video';
  const w = video ? Math.round(size * 1.5) : size, h = video ? Math.round(size * 1.5 * 9 / 16) : size;
  return (
    <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: w, height: h, background: C.ink }}>
      {item.thumbnail
        ? <img src={item.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center serif text-[22px] font-semibold" style={{ color: C.ochre }}>CK</div>}
      <span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,.55)' }} aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="#fff" /></svg>
      </span>
    </div>
  );
};

const Reactions: React.FC<{ item: RadioItem; compact?: boolean }> = ({ item, compact }) => {
  const list = REACTIONS.filter(e => item.reactions[e]);
  if (!list.length && !item.commentCount) return null;
  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-[12.5px]' : 'text-[13px]'}`} style={{ color: C.mute }}>
      {list.map(e => <span key={e}>{e} {item.reactions[e]}</span>)}
      {item.commentCount > 0 && <span className="inline-flex items-center gap-1"><Icon name="chat" size={14} /> {item.commentCount}</span>}
    </div>
  );
};

/** Lecteur : l'image d'abord, le lecteur de la plateforme seulement quand on appuie sur lecture. */
const Player: React.FC<{ item: RadioItem }> = ({ item }) => {
  const [on, setOn] = useState(false);
  const video = item.platform === 'youtube';
  if (!item.embedUrl) return null;
  if (on) {
    const src = video ? `${item.embedUrl}?autoplay=1&rel=0` : item.embedUrl;
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: video ? '#000' : 'transparent', aspectRatio: video ? '16 / 9' : undefined }}>
        <iframe src={src} title={item.title} width="100%" height={video ? '100%' : embedHeight(item)} style={{ border: 0, display: 'block', borderRadius: video ? 0 : 12 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    );
  }
  return (
    <button onClick={() => setOn(true)} className="relative w-full rounded-2xl overflow-hidden block" style={{ aspectRatio: video ? '16 / 9' : '16 / 10', background: C.ink }} aria-label={video ? 'Regarder' : 'Écouter'}>
      {item.thumbnail && <img src={item.thumbnail} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: video ? 1 : 0.55, filter: video ? undefined : 'blur(1px)' }} />}
      {!video && item.thumbnail && <img src={item.thumbnail} alt="" referrerPolicy="no-referrer" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46%] aspect-square object-cover rounded-xl shadow-lg" />}
      <span className="absolute inset-0 flex items-end justify-start p-3.5">
        <span className="inline-flex items-center gap-2 rounded-full pl-2 pr-4 py-2 text-[15px] font-bold" style={{ background: C.ochre, color: C.ink }}>
          <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.ink }}><svg width="11" height="11" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="#fff" /></svg></span>
          {video ? 'Regarder' : 'Écouter'}
        </span>
      </span>
    </button>
  );
};

const Reader: React.FC<{ id: string; isAuthor: boolean; onBack: () => void; onEdit: (i: RadioItem) => void; onChanged: () => void }> = ({ id, isAuthor, onBack, onEdit, onChanged }) => {
  const [data, setData] = useState<{ item: RadioItem; comments: RadioComment[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState<RadioComment | null>(null);
  useEffect(() => { window.scrollTo(0, 0); getRadio(id).then(setData).catch(() => setFailed(true)); }, [id]);

  if (failed) return <Screen><TopBar onBack={onBack} /><div className="px-5"><Note tone="warn">Cette reco n'est plus en ligne.</Note></div></Screen>;
  if (!data) return <Screen><TopBar onBack={onBack} /><div className="px-5 flex flex-col gap-3"><Skeleton h={210} /><Skeleton h={90} /><Skeleton h={60} /></div></Screen>;
  const { item: r, comments } = data;

  const react = async (e: string) => {
    const next = r.myReaction === e ? null : e;
    // Affichage immédiat, puis la réponse du serveur
    const reactions = { ...r.reactions };
    if (r.myReaction) reactions[r.myReaction] = Math.max(0, (reactions[r.myReaction] || 1) - 1);
    if (next) reactions[next] = (reactions[next] || 0) + 1;
    setData({ ...data, item: { ...r, reactions, myReaction: next } });
    try { const item = await reactRadio(r.id, next); setData(d => d && { ...d, item }); onChanged(); }
    catch { setData(data); setError("Ta réaction n'est pas passée. Réessaie."); }
  };
  const send = async () => {
    if (!text.trim()) return;
    setBusy('send'); setError(null);
    try {
      const c = await commentRadio(r.id, text);
      setData(d => d && { item: { ...d.item, commentCount: d.item.commentCount + 1 }, comments: [...d.comments, c] });
      setText(''); onChanged();
    } catch (e) { setError((e as Error).message === 'trop' ? 'Tu as beaucoup commenté aujourd’hui : reviens demain.' : "Ton commentaire n'est pas parti. Réessaie."); }
    finally { setBusy(null); }
  };
  const del = async (c: RadioComment) => {
    setBusy(c.id);
    try { await deleteRadioComment(r.id, c.id); setData(d => d && { item: { ...d.item, commentCount: Math.max(0, d.item.commentCount - 1) }, comments: d.comments.filter(x => x.id !== c.id) }); setRemove(null); onChanged(); }
    catch { setError('La suppression a échoué.'); }
    finally { setBusy(null); }
  };

  return (
    <Screen>
      <TopBar onBack={onBack} title="Radio CK" right={isAuthor ? <button onClick={() => onEdit(r)} className="text-[15px] font-semibold px-1" style={{ color: C.ochreText }}>Modifier</button> : undefined} />
      <div className="px-5 pt-1"><Player item={r} /></div>
      <div className="px-6 pt-4">
        <div className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.ochreText }}>{KIND_LABEL[r.kind]} · {PLATFORM_LABEL[r.platform]}</div>
        <h1 className="serif text-[25px] font-semibold leading-[1.18] mt-1.5">{r.title}</h1>
        {r.show && <div className="text-[15px] mt-1.5" style={{ color: C.text2 }}>{r.show}</div>}
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-semibold mt-3" style={{ color: C.ink }}>
          Ouvrir dans {PLATFORM_LABEL[r.platform]} <Icon name="arrow" size={16} />
        </a>
      </div>

      {r.comment && (
        <div className="px-5 pt-5">
          <div className="rounded-2xl p-5" style={{ background: C.ochreSoft }}>
            <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.ochreText }}>Pourquoi {r.by || 'Christian'} le recommande</div>
            {r.comment.split(/\n+/).map((p, i) => <p key={i} className="serif text-[17px] leading-[1.6] mt-2" style={{ color: '#22263A' }}>{p}</p>)}
          </div>
        </div>
      )}

      <div className="px-5 pt-5">
        <div className="text-[13px] font-semibold mb-2 px-1" style={{ color: C.mute }}>Ta réaction</div>
        <div className="flex gap-2" role="group" aria-label="Réactions">
          {REACTIONS.map(e => {
            const on = r.myReaction === e;
            return (
              <button key={e} onClick={() => react(e)} aria-pressed={on} aria-label={`Réagir ${e}`}
                className="flex-1 h-12 rounded-2xl flex items-center justify-center gap-1 text-[19px] border-[1.5px]"
                style={{ background: on ? C.ink : C.card, borderColor: on ? C.ink : C.border, color: on ? '#fff' : C.ink }}>
                {e}{r.reactions[e] ? <span className="text-[13px] font-bold">{r.reactions[e]}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pt-6 pb-[max(env(safe-area-inset-bottom),28px)]">
        <div className="text-[17px] font-bold px-1 mb-3">{comments.length ? `Ce qu'on en dit (${comments.length})` : "Ce qu'on en dit"}</div>
        {comments.length > 0 && (
          <Card>
            {comments.map((c, i) => (
              <div key={c.id} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-bold" style={{ color: C.ink }}>{c.mine ? 'Toi' : c.name}</span>
                  <span style={{ color: C.mute }}>{ago(c.at)}</span>
                  {c.canDelete && <button onClick={() => setRemove(c)} className="ml-auto text-[12.5px] font-semibold" style={{ color: C.mute }}>Retirer</button>}
                </div>
                <p className="text-[15px] leading-snug mt-1 whitespace-pre-line" style={{ color: C.text2 }}>{c.text}</p>
              </div>
            ))}
          </Card>
        )}
        <div className="mt-3 flex flex-col gap-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={MAX_COMMENT} aria-label="Ton commentaire"
            placeholder={comments.length ? 'Ajoute ton avis…' : 'Sois le premier à donner ton avis…'}
            className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none border-[1.5px] focus:border-[#1C2551] resize-none" style={inputStyle} />
          {text.trim() && <Button busy={busy === 'send'} onClick={send}>Envoyer</Button>}
          {error && <Note tone="danger">{error}</Note>}
        </div>
      </div>

      <Sheet open={!!remove} onClose={() => setRemove(null)} title="Retirer ce commentaire ?">
        <p className="text-[15px] leading-relaxed mb-4" style={{ color: C.text2 }}>{remove?.mine ? 'Ton commentaire' : `Le commentaire de ${remove?.name}`} disparaîtra pour tout le monde.</p>
        <div className="flex flex-col gap-2.5">
          <Button variant="danger" busy={!!remove && busy === remove.id} onClick={() => remove && del(remove)}>Retirer</Button>
          <Button variant="secondary" onClick={() => setRemove(null)}>Annuler</Button>
        </div>
      </Sheet>
    </Screen>
  );
};

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }> = ({ on, onChange, label, sub }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="w-full text-left flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: C.card }}>
    <div className="flex-1 min-w-0">
      <div className="text-[15px] font-semibold">{label}</div>
      {sub && <div className="text-[13px] mt-0.5" style={{ color: C.mute }}>{sub}</div>}
    </div>
    <span className="w-12 h-7 rounded-full p-0.5 shrink-0 transition-colors" style={{ background: on ? C.green : C.border }}>
      <span className="block w-6 h-6 rounded-full bg-white shadow transition-transform" style={{ transform: on ? 'translateX(20px)' : 'none' }} />
    </span>
  </button>
);

const Editor: React.FC<{ initial?: RadioItem; onBack: () => void; onSaved: (id?: string, notified?: number) => void }> = ({ initial, onBack, onSaved }) => {
  const [url, setUrl] = useState(initial?.url || '');
  const [f, setF] = useState({ title: initial?.title || '', show: initial?.show || '', thumbnail: initial?.thumbnail || '', kind: (initial?.kind || 'podcast') as RadioKind, comment: initial?.comment || '' });
  const [found, setFound] = useState(!!initial);
  const [notify, setNotify] = useState(!initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const media = parseMedia(url);

  const look = async () => {
    if (!media) { setError('Colle un lien qui commence par https://'); return; }
    setBusy('look'); setError(null);
    try {
      const m = await previewRadio(url.trim());
      setF(x => ({ ...x, title: m.title || x.title, show: m.show || x.show, thumbnail: m.thumbnail || x.thumbnail, kind: (m.kind as RadioKind) || x.kind }));
      setFound(true);
      if (!m.title) setError("Le titre n'a pas pu être lu : écris-le toi-même.");
    } catch { setFound(true); setError("Les infos n'ont pas pu être lues : remplis-les toi-même."); }
    finally { setBusy(null); }
  };
  const save = async () => {
    if (!media || !f.title.trim()) { setError('Il faut au moins le lien et un titre.'); return; }
    setBusy('save'); setError(null);
    try { const r = await saveRadio({ id: initial?.id, url: url.trim(), ...f }, notify); onSaved(r.id, r.notified); }
    catch { setError("L'enregistrement a échoué. Réessaie."); }
    finally { setBusy(null); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Screen>
      <TopBar onBack={onBack} title={initial ? 'Modifier la reco' : 'Nouvelle reco'} />
      <div className="px-5 pt-2 flex flex-col gap-4">
        <Field label="Lien" htmlFor="ru" hint="YouTube, Spotify, Apple Podcasts, Deezer… Le titre et l'image se remplissent tout seuls.">
          <div className="flex gap-2">
            <input id="ru" value={url} onChange={e => { setUrl(e.target.value); if (!initial) setFound(false); }} type="url" inputMode="url" autoCapitalize="none" placeholder="https://" className={inputClass} style={inputStyle} />
            {!initial && <Button className="!w-auto shrink-0 px-5" busy={busy === 'look'} onClick={look}>OK</Button>}
          </div>
        </Field>
        {found && (
          <>
            {f.thumbnail && (
              <div className="flex items-center gap-3.5">
                <Thumb item={{ ...f, title: f.title }} size={64} />
                <div className="text-[13px]" style={{ color: C.mute }}>{media ? PLATFORM_LABEL[media.platform] : ''}</div>
              </div>
            )}
            <Chips options={(['podcast', 'video', 'musique'] as RadioKind[]).map(k => ({ id: k, label: KIND_LABEL[k] }))} value={f.kind} onChange={k => setF({ ...f, kind: k as RadioKind })} />
            <Field label="Titre" htmlFor="rt"><input id="rt" value={f.title} onChange={set('title')} className={inputClass} style={inputStyle} /></Field>
            <Field label="Émission ou chaîne" htmlFor="rs"><input id="rs" value={f.show} onChange={set('show')} className={inputClass} style={inputStyle} /></Field>
            <Field label="Pourquoi tu le recommandes" htmlFor="rc" hint="Ce qui t'a marqué, ce qu'il faut écouter en premier…">
              <textarea id="rc" value={f.comment} onChange={set('comment')} rows={5} maxLength={1500}
                className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none border-[1.5px] focus:border-[#1C2551]" style={inputStyle} />
            </Field>
            {!initial?.notified && <Toggle on={notify} onChange={setNotify} label="Prévenir par notification" sub="Tous ceux qui ont activé les notifications" />}
          </>
        )}
        {error && <Note tone={found ? 'warn' : 'danger'}>{error}</Note>}
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        {found && <Button busy={busy === 'save'} onClick={save}>{initial ? 'Enregistrer' : 'Publier sur Radio CK'}</Button>}
        {initial && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Supprimer la reco</Button>}
      </div>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer cette reco ?">
        <p className="text-[15px] leading-relaxed mb-4" style={{ color: C.text2 }}>« {f.title} » disparaîtra, avec ses réactions et ses commentaires. Ce n'est pas réversible.</p>
        <div className="flex flex-col gap-2.5">
          <Button variant="danger" busy={busy === 'del'} onClick={async () => { setBusy('del'); try { await deleteRadio(initial!.id); onSaved(); } catch { setError('La suppression a échoué.'); setConfirmDelete(false); } finally { setBusy(null); } }}>Supprimer définitivement</Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Annuler</Button>
        </div>
      </Sheet>
    </Screen>
  );
};

const RadioScreen: React.FC<{ onBack: () => void; initialId?: string }> = ({ onBack, initialId }) => {
  const [list, setList] = useState<RadioItem[] | null>(null);
  const [author, setAuthor] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<{ k: 'list' } | { k: 'read'; id: string } | { k: 'edit'; item?: RadioItem }>(initialId ? { k: 'read', id: initialId } : { k: 'list' });
  const [toast, setToast] = useState<string | null>(null);
  const load = (fresh = false) => listRadio(fresh).then(r => { setList(r.items); setAuthor(r.author); setFailed(false); }).catch(() => { setFailed(true); setList([]); });
  useEffect(() => { load(); }, []);
  const go = (v: typeof view) => { setView(v); window.scrollTo(0, 0); };
  const withToast = (n: React.ReactNode) => <>{n}<Toast text={toast} onDone={() => setToast(null)} /></>;

  if (view.k === 'edit') return <Editor initial={view.item} onBack={() => go(view.item ? { k: 'read', id: view.item.id } : { k: 'list' })}
    onSaved={(id, n) => { load(true); setToast(!id ? 'Reco supprimée' : n ? `Publié · ${n} personne${n > 1 ? 's' : ''} prévenue${n > 1 ? 's' : ''}` : 'Publié'); go(id ? { k: 'read', id } : { k: 'list' }); }} />;
  if (view.k === 'read') return withToast(<Reader key={view.id} id={view.id} isAuthor={author} onBack={() => go({ k: 'list' })} onEdit={item => go({ k: 'edit', item })} onChanged={() => load(true)} />);

  const kinds = (['podcast', 'video', 'musique'] as RadioKind[]).filter(k => (list || []).some(i => i.kind === k));
  const shown = (list || []).filter(i => filter === 'all' || i.kind === filter);
  return withToast(
    <Screen>
      <TopBar onBack={onBack} title="Radio CK" />
      <div className="px-6 pt-2 pb-4">
        <h1 className="serif text-[30px] font-semibold leading-tight">Radio CK</h1>
        <p className="text-[15px] leading-relaxed mt-1.5" style={{ color: C.mute }}>Les podcasts et vidéos que Christian a aimés. Écoute, puis dis ce que tu en penses.</p>
      </div>
      {author && <div className="px-5 pb-4"><Button onClick={() => go({ k: 'edit' })}><Icon name="plus" size={20} /> Ajouter une reco</Button></div>}
      {kinds.length > 1 && (
        <div className="px-5 pb-3">
          <Chips options={[{ id: 'all', label: 'Tout' }, ...kinds.map(k => ({ id: k, label: k === 'musique' ? 'Musique' : `${KIND_LABEL[k]}s` }))]} value={filter} onChange={v => setFilter(v as Filter)} />
        </div>
      )}
      <div className="px-5 flex flex-col gap-3 pb-[max(env(safe-area-inset-bottom),28px)]">
        {!list && <><Skeleton h={96} /><Skeleton h={96} /></>}
        {failed && <Note tone="warn">Radio CK n'a pas pu être chargée. Vérifie ta connexion.</Note>}
        {shown.length > 0 && (
          <Card>
            {shown.map((i, n) => (
              <button key={i.id} onClick={() => go({ k: 'read', id: i.id })} className="w-full text-left flex items-center gap-3.5 px-4 py-3.5" style={{ borderTop: n ? `1px solid ${C.line}` : undefined }}>
                <Thumb item={i} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.ochreText }}>{KIND_LABEL[i.kind]} · {ago(i.publishedAt)}</div>
                  <div className="serif text-[16.5px] font-semibold leading-snug mt-0.5 line-clamp-2">{i.title}</div>
                  {i.show && <div className="text-[13px] mt-0.5 truncate" style={{ color: C.mute }}>{i.show}</div>}
                  <div className="mt-1"><Reactions item={i} compact /></div>
                </div>
              </button>
            ))}
          </Card>
        )}
        {list && !failed && !shown.length && (
          <Card className="px-5 py-8 text-center">
            <div className="text-[15px] font-semibold">Pas encore de reco</div>
            <div className="text-sm mt-1" style={{ color: C.mute }}>{author ? 'Colle le lien d’un podcast ou d’une vidéo que tu as aimé.' : 'Les prochaines recos de Christian apparaîtront ici.'}</div>
          </Card>
        )}
      </div>
    </Screen>,
  );
};

export default RadioScreen;

