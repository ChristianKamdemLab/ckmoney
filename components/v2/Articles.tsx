import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Article, User } from '../../types';
import { Screen, TopBar, Button, Card, Note, Sheet, Toast, Skeleton, Avatar, Chips, Field, inputClass, inputStyle, Icon, C, dateFr } from './ui';
import { listArticles, saveArticle, importArticles, deleteArticle, savePress, ArticleInput, PressInput } from '../../services/articleService';
import { parseBody, blocksToBody, readMinutes, frTypo, Block } from '../../utils/articleText';

// Articles : les textes de Christian (signés CKLabs, en entier) et sa revue de presse (fiches qui
// renvoient vers le journal : source, titre, accroche, lien ; jamais le texte du journal).
// Lecture réservée aux comptes connectés, écriture réservée à l'auteur.

const day = (a: Pick<Article, 'publishedAt' | 'updatedAt'>) => dateFr(a.publishedAt || a.updatedAt, { day: 'numeric', month: 'long', year: 'numeric' });
const isPress = (a: Pick<Article, 'kind'>) => a.kind === 'press';
const meta = (a: Article) => isPress(a) ? `${a.source} · ${day(a)}` : `${a.readMinutes} min de lecture · ${day(a)}`;
const hostOf = (u?: string) => { try { return new URL(u || '').hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Étiquette de type : « Revue de presse · Africa Intelligence » ou « CKLabs ». */
const Kind: React.FC<{ a: Article; dark?: boolean }> = ({ a, dark }) => (
  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: dark ? C.ochre : C.ochreText }}>
    {isPress(a) ? <>Revue de presse <span style={{ opacity: .5 }}>·</span> {a.source}</> : 'CKLabs'}
  </span>
);

const Blocks: React.FC<{ blocks: Block[] }> = ({ blocks }) => (
  <div className="serif text-[18px] leading-[1.72]" style={{ color: '#22263A' }}>
    {blocks.map((b, i) => {
      if (b.t === 'h') return <h2 key={i} className="font-sans text-[20px] font-bold leading-snug mt-9 mb-3" style={{ color: C.ink, fontFamily: 'Figtree, system-ui, sans-serif' }}>{frTypo(b.text)}</h2>;
      if (b.t === 'li') return (
        <div key={i} className="flex gap-3 mb-4 pl-1">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[13px]" style={{ background: C.ochre }} />
          <p>{(() => {
            // Puce « Intitulé : explication » : l'intitulé en gras, pour se repérer d'un coup d'œil
            const t = frTypo(b.text), k = t.indexOf('\u00a0:');
            return k > 0 && k < 70 ? <><b className="font-semibold" style={{ color: C.ink }}>{t.slice(0, k)}</b>{t.slice(k)}</> : t;
          })()}</p>
        </div>
      );
      return <p key={i} className={i === 0 ? 'text-[19.5px] leading-[1.65] mb-5' : 'mb-5'}>{frTypo(b.text)}</p>;
    })}
  </div>
);

/** Barre de lecture : avance avec le défilement. */
const ReadingProgress: React.FC = () => {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setP(h > 0 ? Math.min(1, window.scrollY / h) : 0);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return <div className="fixed top-0 left-0 right-0 h-[3px] z-50" aria-hidden="true"><div className="h-full" style={{ width: `${p * 100}%`, background: C.ochre }} /></div>;
};

const PressReader: React.FC<{ article: Article; isAuthor: boolean; onBack: () => void; onEdit: () => void }> = ({ article: a, isAuthor, onBack, onEdit }) => {
  useEffect(() => { window.scrollTo(0, 0); }, [a.id]);
  const host = hostOf(a.sourceUrl);
  return (
    <Screen>
      <TopBar onBack={onBack} right={isAuthor ? <button onClick={onEdit} className="text-[15px] font-semibold px-1" style={{ color: C.ochreText }}>Modifier</button> : undefined} />
      <article className="px-6 pt-3 pb-10">
        <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.mute }}>Revue de presse</div>
        <div className="serif text-[22px] font-semibold mt-1" style={{ color: C.ochreText }}>{a.source}</div>
        {a.sourceSection && <div className="text-[13px] font-semibold mt-0.5" style={{ color: C.mute }}>{a.sourceSection}</div>}
        <h1 className="serif text-[28px] leading-[1.18] font-semibold tracking-[-0.3px] mt-4">{frTypo(a.title)}</h1>
        <div className="text-[13px] mt-3" style={{ color: C.mute }}>{day(a)}{a.sourceAuthor ? ` · ${a.sourceAuthor}` : ''}</div>
        {a.excerpt && (
          <p className="serif text-[18px] leading-[1.55] mt-6 pl-4" style={{ borderLeft: `3px solid ${C.ochre}`, color: C.text2 }}>{frTypo(a.excerpt)}</p>
        )}
        {a.sourceUrl && (
          <div className="mt-7"><Button onClick={() => window.open(a.sourceUrl, '_blank', 'noopener')}>Lire l'article{host ? ` sur ${host}` : ''} <Icon name="arrow" size={18} /></Button></div>
        )}
        <p className="text-[13px] leading-relaxed mt-4" style={{ color: C.mute }}>Article de {a.source}, partagé par {a.authorName.split(' ')[0] || 'Christian'}. Le texte complet est sur le site du journal.</p>
      </article>
    </Screen>
  );
};

/** Fiche « revue de presse » écrite à la main (ou ouverte depuis un lien préparé /?presse=…). */
const PressEditor: React.FC<{ initial?: Article; prefill?: Partial<PressInput>; onBack: () => void; onSaved: (id?: string) => void }> = ({ initial, prefill, onBack, onSaved }) => {
  const [p, setP] = useState<PressInput>(() => ({
    id: initial?.id, title: initial?.title || prefill?.title || '', source: initial?.source || prefill?.source || '',
    sourceUrl: initial?.sourceUrl || prefill?.sourceUrl || '', sourceSection: initial?.sourceSection || prefill?.sourceSection || '',
    excerpt: initial?.excerpt || prefill?.excerpt || '', publishedAt: initial?.publishedAt || prefill?.publishedAt,
  }));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof PressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });
  const save = async () => {
    if (!p.title.trim() || !p.source.trim()) { setError('Il faut au moins le titre et le nom du média.'); return; }
    if (p.sourceUrl && !/^https?:\/\//i.test(p.sourceUrl.trim())) { setError('Le lien doit commencer par https://'); return; }
    setBusy('save'); setError(null);
    try { onSaved(await savePress({ ...p, sourceUrl: p.sourceUrl.trim() })); }
    catch { setError("L'enregistrement a échoué. Réessaie."); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    if (!p.id) return;
    setBusy('delete');
    try { await deleteArticle(p.id); onSaved(); } catch { setError('La suppression a échoué.'); } finally { setBusy(null); setConfirm(false); }
  };
  const dateValue = p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : '';
  return (
    <Screen>
      <TopBar onBack={onBack} title={initial ? 'Modifier la fiche' : 'Revue de presse'} />
      <div className="px-5 pt-2 flex flex-col gap-4">
        <Note tone="info">Une fiche renvoie vers le journal : son titre, une phrase d'accroche et le lien. Jamais le texte de l'article.</Note>
        <Field label="Média" htmlFor="ps"><input id="ps" value={p.source} onChange={set('source')} placeholder="Jeune Afrique, Africa Intelligence…" className={inputClass} style={inputStyle} /></Field>
        <Field label="Rubrique" htmlFor="pr" hint="Facultatif : « Grande enquête », « Secret de palais »…"><input id="pr" value={p.sourceSection} onChange={set('sourceSection')} className={inputClass} style={inputStyle} /></Field>
        <Field label="Titre de l'article" htmlFor="pt"><input id="pt" value={p.title} onChange={set('title')} className={inputClass} style={inputStyle} /></Field>
        <Field label="Date de l'article" htmlFor="pd"><input id="pd" type="date" value={dateValue} onChange={e => setP({ ...p, publishedAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : undefined })} className={inputClass} style={inputStyle} /></Field>
        <Field label="Accroche" htmlFor="pe" hint={`Une phrase pour donner envie, ${200 - p.excerpt.length} caractères restants.`}>
          <textarea id="pe" value={p.excerpt} maxLength={200} onChange={set('excerpt')} rows={3} className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none border-[1.5px] focus:border-[#1C2551]" style={inputStyle} />
        </Field>
        <Field label="Lien vers l'article" htmlFor="pu"><input id="pu" type="url" inputMode="url" value={p.sourceUrl} onChange={set('sourceUrl')} placeholder="https://" className={inputClass} style={inputStyle} /></Field>
        {error && <Note tone="danger">{error}</Note>}
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        <Button busy={busy === 'save'} onClick={save}>{initial ? 'Enregistrer' : 'Publier la fiche'}</Button>
        {p.id && <Button variant="danger" onClick={() => setConfirm(true)}>Supprimer la fiche</Button>}
      </div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Supprimer cette fiche ?">
        <p className="text-[15px] leading-relaxed mb-4" style={{ color: C.text2 }}>Elle disparaîtra de l'appli. Ce n'est pas réversible.</p>
        <div className="flex flex-col gap-2.5">
          <Button variant="danger" busy={busy === 'delete'} onClick={remove}>Supprimer définitivement</Button>
          <Button variant="secondary" onClick={() => setConfirm(false)}>Annuler</Button>
        </div>
      </Sheet>
    </Screen>
  );
};

const Reader: React.FC<{ article: Article; next?: Article; isAuthor: boolean; onBack: () => void; onEdit: () => void; onOpen: (a: Article) => void }> = ({ article, next, isAuthor, onBack, onEdit, onOpen }) => {
  const blocks = useMemo(() => parseBody(article.body), [article.body]);
  useEffect(() => { window.scrollTo(0, 0); }, [article.id]);
  return (
    <Screen>
      <ReadingProgress />
      <TopBar onBack={onBack} right={isAuthor ? <button onClick={onEdit} className="text-[15px] font-semibold px-1" style={{ color: C.ochreText }}>Modifier</button> : undefined} />
      <article className="px-6 pt-3 pb-10">
        <div className="text-[13px] font-semibold" style={{ color: C.ochreText }}>
          {article.status === 'draft' ? 'Brouillon · visible par toi seul' : 'CKLabs'}
        </div>
        <h1 className="serif text-[30px] leading-[1.15] font-semibold tracking-[-0.3px] mt-2">{frTypo(article.title)}</h1>
        <div className="flex items-center gap-3 mt-5 pb-6" style={{ borderBottom: `1px solid ${C.line}` }}>
          <Avatar name={article.authorName} size={40} tone={0} />
          <div>
            <div className="text-[15px] font-semibold">{article.authorName}</div>
            <div className="text-[13px]" style={{ color: C.mute }}>{meta(article)}</div>
          </div>
        </div>
        <div className="pt-7"><Blocks blocks={blocks} /></div>
        <div className="flex justify-center pt-4" aria-hidden="true"><div className="w-10 h-[3px] rounded-full" style={{ background: C.ochre }} /></div>
      </article>
      {next && (
        <div className="px-5 pb-[max(env(safe-area-inset-bottom),28px)]">
          <div className="text-[13px] font-semibold mb-2" style={{ color: C.mute }}>À lire aussi</div>
          <button onClick={() => onOpen(next)} className="w-full text-left">
            <Card className="p-4">
              <div className="serif text-[19px] font-semibold leading-snug">{frTypo(next.title)}</div>
              <div className="text-[13px] mt-1.5" style={{ color: C.mute }}>{meta(next)}</div>
            </Card>
          </button>
        </div>
      )}
    </Screen>
  );
};

// ---------- Écriture (auteur)

type Draft = { id?: string; title: string; body: string; publishedAt?: string; status: 'published' | 'draft' };

const readTextFile = (f: File) => f.text();

const Editor: React.FC<{ initial?: Article; onBack: () => void; onSaved: (id?: string) => void }> = ({ initial, onBack, onSaved }) => {
  const [d, setD] = useState<Draft>(() => initial
    ? { id: initial.id, title: initial.title, body: initial.body, publishedAt: initial.publishedAt, status: initial.status }
    : { title: '', body: '', status: 'published' });
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulk, setBulk] = useState<ArticleInput[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fromFile = async (f: File): Promise<ArticleInput[]> => {
    const name = f.name.toLowerCase();
    if (name.endsWith('.json')) {
      const j = JSON.parse(await readTextFile(f));
      const list = Array.isArray(j) ? j : j.articles;
      if (!Array.isArray(list)) throw new Error('json');
      return list.map((a: any) => ({ title: String(a.title || ''), body: String(a.body || ''), status: a.status === 'draft' ? 'draft' : 'published', publishedAt: a.publishedAt }));
    }
    if (name.endsWith('.pdf')) {
      const { readPdfFile } = await import('../../services/pdfImport');
      const a = await readPdfFile(f);
      return [{ title: a.title || f.name.replace(/\.pdf$/i, ''), body: blocksToBody(a.blocks), status: 'published' }];
    }
    const text = await readTextFile(f);
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const first = lines.findIndex(l => l.trim());
    const title = (lines[first] || f.name).replace(/^#+\s*/, '').trim();
    return [{ title, body: lines.slice(first + 1).join('\n').trim(), status: 'published' }];
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('import'); setError(null);
    try {
      const all = (await Promise.all(Array.from(files).map(fromFile))).flat().filter(a => a.title && a.body);
      if (!all.length) throw new Error('vide');
      if (all.length === 1 && !files[0].name.toLowerCase().endsWith('.json')) {
        setD(x => ({ ...x, title: all[0].title, body: all[0].body }));
        setMode('preview');
      } else setBulk(all);
    } catch (e) {
      setError((e as Error).message === 'json' ? "Ce fichier n'est pas un fichier d'articles." : "Impossible de lire ce fichier. Essaie de copier-coller le texte.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (status: 'published' | 'draft') => {
    if (!d.title.trim() || !d.body.trim()) { setError('Il faut un titre et un texte.'); return; }
    setBusy(status); setError(null);
    try { const id = await saveArticle({ ...d, status }); onSaved(id); }
    catch (e) { setError((e as Error).message === 'not_author' ? "Seul l'auteur peut publier." : "L'enregistrement a échoué. Réessaie."); }
    finally { setBusy(null); }
  };

  const runBulk = async (status: 'published' | 'draft') => {
    if (!bulk) return;
    setBusy(`bulk-${status}`);
    try { await importArticles(bulk.map(a => ({ ...a, status: a.status === 'draft' ? 'draft' : status }))); setBulk(null); onSaved(); }
    catch { setError("L'import a échoué. Réessaie."); setBulk(null); }
    finally { setBusy(null); }
  };

  const remove = async () => {
    if (!d.id) return;
    setBusy('delete');
    try { await deleteArticle(d.id); setConfirmDelete(false); onSaved(); }
    catch { setError('La suppression a échoué.'); }
    finally { setBusy(null); }
  };

  const blocks = parseBody(d.body);
  return (
    <Screen>
      <TopBar onBack={onBack} title={initial ? "Modifier l'article" : 'Nouvel article'} />
      <div className="px-5 pt-2 flex flex-col gap-4">
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.json,application/pdf,text/plain,application/json" multiple className="hidden"
          onChange={e => onFiles(e.target.files)} />
        <Button variant="secondary" busy={busy === 'import'} onClick={() => fileRef.current?.click()}>
          <Icon name="file" size={20} /> Importer un PDF ou un texte
        </Button>
        <Chips options={[{ id: 'write', label: 'Écrire' }, { id: 'preview', label: 'Aperçu' }]} value={mode} onChange={v => setMode(v as 'write' | 'preview')} />
        {mode === 'write' ? (
          <>
            <Field label="Titre" htmlFor="at"><input id="at" value={d.title} onChange={e => setD({ ...d, title: e.target.value })} className={inputClass} style={inputStyle} /></Field>
            <Field label="Date de l'article" htmlFor="ad" hint="Le jour où tu l'as écrit. Vide : la date de publication. Les articles sont classés du plus récent au plus ancien.">
              <input id="ad" type="date" value={(d.publishedAt || '').slice(0, 10)} max={new Date().toISOString().slice(0, 10)}
                onChange={e => setD({ ...d, publishedAt: e.target.value ? `${e.target.value}T12:00:00.000Z` : undefined })} className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Texte" htmlFor="ab" hint={<>Une ligne = un paragraphe. Commence une ligne par <b>##</b> pour un intertitre, par <b>-</b> pour une puce.</>}>
              <textarea id="ab" value={d.body} onChange={e => setD({ ...d, body: e.target.value })} rows={16}
                className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none border-[1.5px] focus:border-[#1C2551] min-h-[45dvh]" style={inputStyle} />
            </Field>
          </>
        ) : (
          <Card className="px-5 py-6">
            <h1 className="serif text-[26px] leading-[1.15] font-semibold">{frTypo(d.title) || 'Sans titre'}</h1>
            <div className="text-[13px] mt-2 mb-5" style={{ color: C.mute }}>{readMinutes(d.body)} min de lecture</div>
            {blocks.length ? <Blocks blocks={blocks} /> : <div className="text-sm" style={{ color: C.mute }}>Le texte apparaîtra ici.</div>}
          </Card>
        )}
        {error && <Note tone="danger">{error}</Note>}
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        <Button busy={busy === 'published'} onClick={() => save('published')}>{initial?.status === 'published' ? 'Enregistrer' : 'Publier'}</Button>
        <Button variant="secondary" busy={busy === 'draft'} onClick={() => save('draft')}>{initial?.status === 'published' ? 'Repasser en brouillon' : 'Enregistrer en brouillon'}</Button>
        {d.id && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Supprimer l'article</Button>}
      </div>

      <Sheet open={!!bulk} onClose={() => setBulk(null)} title={`${bulk?.length || 0} article${(bulk?.length || 0) > 1 ? 's' : ''} à importer`}>
        <Card className="mb-4">
          {bulk?.map((a, i) => (
            <div key={i} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
              <div className="serif text-[16px] font-semibold leading-snug">{a.title}</div>
              <div className="text-[12px] mt-0.5" style={{ color: C.mute }}>{readMinutes(a.body)} min de lecture{a.status === 'draft' ? ' · brouillon' : ''}</div>
            </div>
          ))}
        </Card>
        <div className="flex flex-col gap-2.5">
          <Button busy={busy === 'bulk-published'} onClick={() => runBulk('published')}>Publier</Button>
          <Button variant="secondary" busy={busy === 'bulk-draft'} onClick={() => runBulk('draft')}>Garder en brouillons</Button>
        </div>
      </Sheet>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer cet article ?">
        <p className="text-[15px] leading-relaxed mb-4" style={{ color: C.text2 }}>« {d.title} » disparaîtra pour tout le monde. Ce n'est pas réversible.</p>
        <div className="flex flex-col gap-2.5">
          <Button variant="danger" busy={busy === 'delete'} onClick={remove}>Supprimer définitivement</Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Annuler</Button>
        </div>
      </Sheet>
    </Screen>
  );
};

// ---------- Liste

type Filter = 'all' | 'own' | 'press' | `src:${string}`;

const ArticlesScreen: React.FC<{ user: User; isAuthor: boolean; onBack: () => void; initialId?: string; prefill?: Partial<PressInput> }> = ({ user, isAuthor, onBack, initialId, prefill }) => {
  const [list, setList] = useState<Article[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{ k: 'list' } | { k: 'read'; id: string } | { k: 'edit'; id?: string } | { k: 'press'; id?: string; prefill?: Partial<PressInput> }>(
    prefill && isAuthor ? { k: 'press', prefill } : initialId ? { k: 'read', id: initialId } : { k: 'list' });
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<string | null>(null);

  const load = () => listArticles(user.id, isAuthor).then(l => { setList(l); setFailed(false); }).catch(() => { setFailed(true); setList([]); });
  useEffect(() => { load(); }, [user.id, isAuthor]);

  const published = (list || []).filter(a => a.status === 'published');
  const go = (v: typeof view) => { setView(v); window.scrollTo(0, 0); };

  const withToast = (n: React.ReactNode) => <>{n}<Toast text={toast} onDone={() => setToast(null)} /></>;

  if (view.k === 'read') {
    if (!list) return <Screen><TopBar onBack={() => go({ k: 'list' })} /><div className="px-6 flex flex-col gap-3"><Skeleton h={40} /><Skeleton h={20} /><Skeleton h={300} /></div></Screen>;
    const a = list.find(x => x.id === view.id);
    if (a && isPress(a)) return withToast(<PressReader article={a} isAuthor={isAuthor} onBack={() => go({ k: 'list' })} onEdit={() => go({ k: 'press', id: a.id })} />);
    if (a) {
      const own = published.filter(x => !isPress(x));
      const idx = own.findIndex(x => x.id === a.id);
      const next = own.length > 1 ? own[(idx + 1) % own.length] : undefined;
      return withToast(<Reader article={a} next={next && next.id !== a.id ? next : undefined} isAuthor={isAuthor} onBack={() => go({ k: 'list' })} onEdit={() => go({ k: 'edit', id: a.id })} onOpen={x => go({ k: 'read', id: x.id })} />);
    }
    // Article introuvable (supprimé entre-temps) : on retombe sur la liste
  }

  if (view.k === 'edit' && isAuthor) {
    const a = view.id ? list?.find(x => x.id === view.id) : undefined;
    return <Editor initial={a} onBack={() => go(view.id ? { k: 'read', id: view.id } : { k: 'list' })}
      onSaved={id => { load(); setToast('Enregistré'); go(id ? { k: 'read', id } : { k: 'list' }); }} />;
  }

  if (view.k === 'press' && isAuthor) {
    const a = view.id ? list?.find(x => x.id === view.id) : undefined;
    if (view.id && !a) return <Screen><TopBar onBack={() => go({ k: 'list' })} /><div className="px-5"><Skeleton h={300} /></div></Screen>;
    return <PressEditor initial={a} prefill={view.prefill} onBack={() => go(view.id ? { k: 'read', id: view.id } : { k: 'list' })}
      onSaved={id => { load(); setToast(id ? 'Fiche publiée' : 'Fiche supprimée'); go(id ? { k: 'read', id } : { k: 'list' }); }} />;
  }

  const sources = [...new Set(published.filter(isPress).map(a => a.source || ''))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));
  const shown = published.filter(a => filter === 'all' || (filter === 'own' ? !isPress(a) : filter === 'press' ? isPress(a) : isPress(a) && `src:${a.source}` === filter));
  const [first, ...rest] = shown;
  const drafts = (list || []).filter(a => a.status === 'draft');
  const hasPress = sources.length > 0;
  return withToast(
    <Screen>
      <TopBar onBack={onBack} title="Articles" />
      <div className="px-6 pt-2 pb-4">
        <h1 className="serif text-[30px] font-semibold leading-tight">Articles</h1>
        <p className="text-[15px] leading-relaxed mt-1.5" style={{ color: C.mute }}>Les textes de Christian, signés CKLabs, et sa revue de presse. Réservés aux proches inscrits sur l'appli.</p>
      </div>
      {isAuthor && (
        <div className="px-5 pb-4 flex flex-col gap-2.5">
          <Button onClick={() => go({ k: 'edit' })}><Icon name="plus" size={20} /> Écrire ou importer un article</Button>
          <Button variant="secondary" onClick={() => go({ k: 'press' })}><Icon name="file" size={20} /> Ajouter une revue de presse</Button>
        </div>
      )}
      {list && hasPress && (
        <div className="px-5 pb-3 flex flex-col gap-2">
          <Chips options={[{ id: 'all', label: 'Tout' }, { id: 'own', label: 'Textes de Christian' }, { id: 'press', label: 'Revue de presse' }]}
            value={filter.startsWith('src:') ? 'press' : filter} onChange={v => setFilter(v as Filter)} />
          {(filter === 'press' || filter.startsWith('src:')) && sources.length > 1 && (
            <Chips options={[{ id: 'press', label: 'Tous les médias' }, ...sources.map(s => ({ id: `src:${s}`, label: s }))]} value={filter} onChange={v => setFilter(v as Filter)} />
          )}
        </div>
      )}
      <div className="px-5 flex flex-col gap-3 pb-[max(env(safe-area-inset-bottom),28px)]">
        {!list ? <><Skeleton h={180} /><Skeleton h={96} /><Skeleton h={96} /></> : null}
        {failed && <Note tone="warn">Les articles n'ont pas pu être chargés. Vérifie ta connexion.</Note>}
        {drafts.length > 0 && filter === 'all' && (
          <Card>
            {drafts.map((a, i) => (
              <button key={a.id} onClick={() => go({ k: 'read', id: a.id })} className="w-full text-left px-4 py-3.5 flex items-center gap-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <span className="text-[11px] font-bold px-2 py-1 rounded-full shrink-0" style={{ background: C.ochreSoft, color: C.ochreText }}>Brouillon</span>
                <span className="serif text-[16px] font-semibold leading-snug flex-1 min-w-0 truncate">{frTypo(a.title)}</span>
              </button>
            ))}
          </Card>
        )}
        {first && (
          <button onClick={() => go({ k: 'read', id: first.id })} className="text-left rounded-2xl p-5 pt-5" style={{ background: C.ink, color: '#fff' }}>
            <div className="flex items-center justify-between gap-2"><Kind a={first} dark /><span className="text-[11.5px] font-semibold" style={{ color: 'rgba(255,255,255,.55)' }}>Le plus récent</span></div>
            <div className="serif text-[24px] font-semibold leading-[1.18] mt-2">{frTypo(first.title)}</div>
            {first.excerpt && <p className="text-[14px] leading-relaxed mt-3 line-clamp-3" style={{ color: 'rgba(255,255,255,.78)' }}>{isPress(first) ? `« ${frTypo(first.excerpt)} »` : frTypo(first.excerpt)}</p>}
            <div className="text-[12px] mt-4" style={{ color: 'rgba(255,255,255,.6)' }}>{meta(first)}</div>
          </button>
        )}
        {rest.length > 0 && (
          <Card>
            {rest.map((a, i) => (
              <button key={a.id} onClick={() => go({ k: 'read', id: a.id })} className="w-full text-left px-4 py-4" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <Kind a={a} />
                <div className="serif text-[18px] font-semibold leading-snug mt-1">{frTypo(a.title)}</div>
                {a.excerpt && <p className="text-[14px] leading-snug mt-1.5 line-clamp-2" style={{ color: C.text2 }}>{isPress(a) ? `« ${frTypo(a.excerpt)} »` : frTypo(a.excerpt)}</p>}
                <div className="text-[12px] mt-2" style={{ color: C.mute }}>{meta(a)}</div>
              </button>
            ))}
          </Card>
        )}
        {list && !failed && !first && !drafts.length && (
          <Card className="px-5 py-8 text-center">
            <div className="text-[15px] font-semibold">{filter === 'all' ? "Pas encore d'article" : 'Rien dans cette catégorie'}</div>
            <div className="text-sm mt-1" style={{ color: C.mute }}>{isAuthor ? 'Dépose un PDF ou un Word dans le dossier Drive, ou importe-le ici.' : 'Les prochains articles apparaîtront ici.'}</div>
          </Card>
        )}
      </div>
    </Screen>
  );
};

export default ArticlesScreen;
