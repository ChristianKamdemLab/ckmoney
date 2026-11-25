import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Article, User } from '../../types';
import { Screen, TopBar, Button, Card, Note, Sheet, Toast, Skeleton, Avatar, Chips, Field, inputClass, inputStyle, Icon, C, dateFr, NewPill, NightHeader } from './ui';
import { listArticles, saveArticle, importArticles, deleteArticle, savePress, ArticleInput, PressInput } from '../../services/articleService';
import { parseBody, blocksToBody, readMinutes, frTypo, Block } from '../../utils/articleText';
import { seenAt, markSeen, isNewSince } from '../../utils/seen';
import { shareArticlePdf, PdfArticle } from '../../utils/articlePdf';

// Articles : les textes de Christian (signés CKLabs, en entier) et sa revue de presse (fiches qui
// renvoient vers le journal : source, titre, accroche, lien ; jamais le texte du journal).
// Lecture réservée aux comptes connectés, écriture réservée à l'auteur.

const day = (a: Pick<Article, 'publishedAt' | 'updatedAt'>) => dateFr(a.publishedAt || a.updatedAt, { day: 'numeric', month: 'long', year: 'numeric' });
const isPress = (a: Pick<Article, 'kind'>) => a.kind === 'press';
const meta = (a: Article) => isPress(a) ? `${a.source} · ${day(a)}` : `${a.readMinutes} min de lecture · ${day(a)}`;
/** « d'Africa Intelligence », « de Jeune Afrique » */
const deMedia = (s = '') => (/^[aeiouyhàâéèêîïôûœ]/i.test(s) ? `d’${s}` : `de ${s}`);
const hostOf = (u?: string) => { try { return new URL(u || '').hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Étiquette de type : « Revue de presse · Africa Intelligence » ou « CKLabs ». */
/** Titre d'article : la police du texte (Manrope), en gras ; plus petit quand il est long, pour
 *  qu'il tienne en quelques lignes et laisse voir le début de l'article sur l'écran d'un téléphone. */
const titleCls = (t: string) => `${t.length > 90 ? 'text-[21px]' : t.length > 55 ? 'text-[23px]' : 'text-[25px]'} leading-[1.28] font-extrabold tracking-[-0.2px]`;

const Kind: React.FC<{ a: Article; dark?: boolean }> = ({ a, dark }) => (
  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: dark ? C.ochre : C.ochreText }}>
    {isPress(a) ? <>Revue de presse <span style={{ opacity: .5 }}>·</span> {a.source}</> : 'CKLabs'}
  </span>
);

const Blocks: React.FC<{ blocks: Block[] }> = ({ blocks }) => (
  <div className="text-[17px] leading-[1.7]" style={{ color: '#22263A' }}>
    {blocks.map((b, i) => {
      if (b.t === 'h') return <h2 key={i} className="text-[19px] font-bold leading-snug mt-9 mb-3" style={{ color: C.ink }}>{frTypo(b.text)}</h2>;
      if (b.t === 'li') return (
        <div key={i} className="flex gap-3 mb-4 pl-1">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[12px]" style={{ background: C.ochre }} />
          <p>{(() => {
            // Puce « Intitulé : explication » : l'intitulé en gras, pour se repérer d'un coup d'œil
            const t = frTypo(b.text), k = t.indexOf('\u00a0:');
            return k > 0 && k < 70 ? <><b className="font-semibold" style={{ color: C.ink }}>{t.slice(0, k)}</b>{t.slice(k)}</> : t;
          })()}</p>
        </div>
      );
      return <p key={i} className={i === 0 ? 'text-[18px] leading-[1.65] mb-5' : 'mb-5'}>{frTypo(b.text)}</p>;
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


/** Partager une fiche (lien web /a/ID ou PDF) : articles CKLabs et revue de presse publiés. */
const useShare = (a: Article, pdf: () => PdfArticle) => {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const sharePdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await shareArticlePdf(pdf());
      if (r === 'downloaded') setToast('PDF téléchargé');
      setOpen(false);
    } catch { setToast("Le PDF n'a pas pu être créé"); }
    finally { setBusy(false); }
  };
  const shareLink = async () => {
    const url = `${window.location.origin}/a/${a.id}`;
    setOpen(false);
    const text = isPress(a) ? `${frTypo(a.title)} · la revue de presse CKMoney (${a.source})` : `${frTypo(a.title)} · un article CKLabs`;
    try {
      if (navigator.share) { await navigator.share({ title: a.title, text, url }); return; }
    } catch (e: any) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); setToast('Lien copié'); } catch { setToast(url); }
  };
  const waText = `${isPress(a) ? `${frTypo(a.title)} (revue de presse CKMoney · ${a.source})` : `${frTypo(a.title)} · un article CKLabs`}\n${window.location.origin}/a/${a.id}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;
  return { busy, open, setOpen, toast, setToast, sharePdf, shareLink, waHref };
};
type Share = ReturnType<typeof useShare>;

/** Les trois façons de partager, en pastilles rondes : WhatsApp (le plus utilisé par les proches), le
 *  lien (feuille de partage du téléphone, sinon copié) et le PDF. */
const ShareTiles: React.FC<{ s: Share; dark?: boolean }> = ({ s, dark }) => {
  const label = dark ? C.nightText : C.ink;
  const tile = (key: string, name: string, icon: React.ReactNode, bg: string, fg: string, onClick: () => void, busy?: boolean, href?: string) => {
    const inner = (
      <>
        <span className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-active:scale-95" style={{ background: bg, color: fg }}>
          {busy ? <span className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: `${fg}55`, borderTopColor: fg }} /> : icon}
        </span>
        <span className="text-[13px] font-bold" style={{ color: label }}>{name}</span>
      </>
    );
    const cls = 'group flex flex-col items-center gap-2 py-1 rounded-2xl';
    return href
      ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls}>{inner}</a>
      : <button key={key} onClick={onClick} disabled={busy} className={cls}>{inner}</button>;
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {tile('wa', 'WhatsApp', <svg width="25" height="25" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>,
        '#25D366', '#fff', () => s.setOpen(false), false, s.waHref)}
      {tile('link', 'Le lien', <Icon name="share" size={23} />, dark ? C.mango : C.ink, dark ? C.ink : '#fff', s.shareLink)}
      {tile('pdf', 'En PDF', <Icon name="file" size={23} />, dark ? 'rgba(255,255,255,.12)' : C.soft, dark ? C.nightText : C.ink, s.sharePdf, s.busy)}
    </div>
  );
};

/** Bas de fiche : une carte « nuit » aux couleurs de l'appli (le cercle mangue de l'accueil). */
const ShareCard: React.FC<{ s: Share; press?: boolean }> = ({ s, press }) => (
  <div className="relative overflow-hidden rounded-[22px] mt-9 px-5 pt-5 pb-5" style={{ background: C.night, color: C.nightText }}>
    <span aria-hidden="true" className="absolute rounded-full" style={{ width: 120, height: 120, background: C.mango, top: -64, right: -40 }} />
    <div className="relative">
      <div className="text-[11.5px] font-extrabold uppercase tracking-wide" style={{ color: C.mango }}>Partager</div>
      <div className="text-[19px] font-extrabold leading-snug mt-1 pr-20">{press ? 'Fais-la lire autour de toi' : 'Fais-le lire autour de toi'}</div>
      <div className="text-[13.5px] leading-relaxed mt-1.5 mb-5 pr-6" style={{ color: C.nightMute }}>
        {press ? 'Le lien s’ouvre sans compte pendant 7 jours, avec la source du journal.' : 'Le lien s’ouvre sans compte, avec une invitation à rejoindre CKMoney.'}
      </div>
      <ShareTiles s={s} dark />
    </div>
  </div>
);
const ShareIcon: React.FC<{ s: Share }> = ({ s }) => (
  <button onClick={() => s.setOpen(true)} aria-label="Partager" className="w-11 h-11 flex items-center justify-center rounded-full" style={{ color: C.ink }}>
    <Icon name="share" size={21} />
  </button>
);
const ShareSheet: React.FC<{ s: Share; press?: boolean }> = ({ s, press }) => (
  <>
    <Sheet open={s.open} onClose={() => s.setOpen(false)} title={press ? 'Partager la fiche' : "Partager l'article"}>
      <p className="text-[14.5px] leading-relaxed mb-4" style={{ color: C.text2 }}>
        {press ? "Le lien ouvre la fiche sans connexion (pendant 7 jours), avec le lien vers l'article du journal et une invitation à rejoindre CKMoney. Le PDF, lui, s'enregistre et s'imprime."
          : "Le lien ouvre l'article en entier, sans connexion, avec une invitation à rejoindre CKMoney. Le PDF, lui, s'enregistre et s'imprime."}
      </p>
      <ShareTiles s={s} />
    </Sheet>
    <Toast text={s.toast} onDone={() => s.setToast(null)} />
  </>
);

const PressReader: React.FC<{ article: Article; isAuthor: boolean; onBack: () => void; onEdit: () => void }> = ({ article: a, isAuthor, onBack, onEdit }) => {
  useEffect(() => { window.scrollTo(0, 0); }, [a.id]);
  const host = hostOf(a.sourceUrl);
  const paras = (a.summary || '').split(/\n+/).filter(Boolean);
  const canShare = a.status !== 'draft';
  const share = useShare(a, () => ({
    kicker: `Revue de presse · ${a.source}`, title: a.title, authorName: a.sourceAuthor || '', date: day(a),
    lead: a.excerpt || undefined, label: paras.length ? "L'essentiel" : undefined,
    blocks: paras.map(text => ({ t: 'p', text } as Block)),
    sourceNote: `Source : ${a.source}${a.sourceSection ? `, « ${a.sourceSection} »` : ''}, ${day(a)}. Synthèse rédigée pour CKMoney ; l'article complet est sur le site du journal${a.sourceUrl ? ` : ${a.sourceUrl}` : '.'}`,
  }));
  const right = (canShare || isAuthor) ? (
    <div className="flex items-center gap-1">
      {canShare && <ShareIcon s={share} />}
      {isAuthor && <button onClick={onEdit} className="text-[15px] font-semibold px-1" style={{ color: C.ochreText }}>Modifier</button>}
    </div>
  ) : undefined;
  return (
    <Screen>
      <TopBar onBack={onBack} right={right} />
      <article className="px-6 pt-3 pb-10">
        <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.mute }}>Revue de presse</div>
        <div className="serif text-[22px] font-semibold mt-1" style={{ color: C.ochreText }}>{a.source}</div>
        {a.sourceSection && <div className="text-[13px] font-semibold mt-0.5" style={{ color: C.mute }}>{a.sourceSection}</div>}
        <h1 className={`${titleCls(a.title)} mt-4`}>{frTypo(a.title)}</h1>
        <div className="text-[13px] mt-3" style={{ color: C.mute }}>{day(a)}{a.sourceAuthor ? ` · ${a.sourceAuthor}` : ''}</div>
        {a.excerpt && <p className="serif text-[18px] leading-[1.55] mt-6 pl-4" style={{ borderLeft: `3px solid ${C.ochre}`, color: C.text2 }}>{frTypo(a.excerpt)}</p>}
        {paras.length > 0 && (
          <div className="mt-7">
            <div className="text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: C.ochreText }}>L'essentiel</div>
            {paras.map((p, i) => <p key={i} className="text-[16.5px] leading-[1.7] mb-4" style={{ color: C.ink }}>{frTypo(p)}</p>)}
          </div>
        )}
        <div className="mt-6 pt-5 text-[13px] leading-relaxed" style={{ borderTop: `1px solid ${C.line}`, color: C.mute }}>
          Source : {a.source}{a.sourceSection ? `, « ${a.sourceSection} »` : ''}, {day(a)}. Synthèse rédigée pour CKMoney et partagée par {a.authorName.split(' ')[0] || 'Christian'} ; l'article complet est sur le site du journal.
          {a.sourceUrl && <> <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{host || 'Voir la source'}</a></>}
        </div>
        {canShare && <ShareCard s={share} press />}
      </article>
      <ShareSheet s={share} press />
    </Screen>
  );
};

/** Fiche « revue de presse » écrite à la main (ou ouverte depuis un lien préparé /?presse=…). */
const PressEditor: React.FC<{ initial?: Article; prefill?: Partial<PressInput>; onBack: () => void; onSaved: (id?: string) => void }> = ({ initial, prefill, onBack, onSaved }) => {
  const [p, setP] = useState<PressInput>(() => ({
    id: initial?.id, title: initial?.title || prefill?.title || '', source: initial?.source || prefill?.source || '',
    sourceUrl: initial?.sourceUrl || prefill?.sourceUrl || '', sourceSection: initial?.sourceSection || prefill?.sourceSection || '',
    excerpt: initial?.excerpt || prefill?.excerpt || '', summary: initial?.summary || prefill?.summary || '', publishedAt: initial?.publishedAt || prefill?.publishedAt,
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
        <Note tone="info">Une fiche présente l'article avec tes mots : une accroche et l'essentiel (plus fourni si l'article est long), la source en bas. Jamais le texte du journal.</Note>
        <Field label="Média" htmlFor="ps"><input id="ps" value={p.source} onChange={set('source')} placeholder="Jeune Afrique, Africa Intelligence…" className={inputClass} style={inputStyle} /></Field>
        <Field label="Rubrique" htmlFor="pr" hint="Facultatif : « Grande enquête », « Secret de palais »…"><input id="pr" value={p.sourceSection} onChange={set('sourceSection')} className={inputClass} style={inputStyle} /></Field>
        <Field label="Titre de l'article" htmlFor="pt"><input id="pt" value={p.title} onChange={set('title')} className={inputClass} style={inputStyle} /></Field>
        <Field label="Date de l'article" htmlFor="pd"><input id="pd" type="date" value={dateValue} onChange={e => setP({ ...p, publishedAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : undefined })} className={inputClass} style={inputStyle} /></Field>
        <Field label="Accroche" htmlFor="pe" hint={`Une phrase pour donner envie, ${200 - p.excerpt.length} caractères restants.`}>
          <textarea id="pe" value={p.excerpt} maxLength={200} onChange={set('excerpt')} rows={3} className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none border-[1.5px] focus:border-[#0E1533]" style={inputStyle} />
        </Field>
        <Field label="L'essentiel" htmlFor="pm" hint={`Le récap avec tes mots, plus fourni quand l'article est long : les faits, les acteurs, les enjeux. ${4000 - (p.summary || '').length} caractères restants.`}>
          <textarea id="pm" value={p.summary} maxLength={4000} onChange={set('summary')} rows={12} className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none border-[1.5px] focus:border-[#0E1533]" style={inputStyle} />
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
  const canPdf = article.status !== 'draft' && !isPress(article);
  const share = useShare(article, () => ({ title: article.title, authorName: article.authorName, date: day(article), blocks }));
  const right = (canPdf || isAuthor) ? (
    <div className="flex items-center gap-1">
      {canPdf && <ShareIcon s={share} />}
      {isAuthor && <button onClick={onEdit} className="text-[15px] font-semibold px-1" style={{ color: C.ochreText }}>Modifier</button>}
    </div>
  ) : undefined;
  return (
    <Screen>
      <ReadingProgress />
      <TopBar onBack={onBack} right={right} />
      <article className="px-6 pt-3 pb-10">
        <div className="text-[13px] font-semibold" style={{ color: C.ochreText }}>
          {article.status === 'draft' ? 'Brouillon · visible par toi seul' : 'CKLabs'}
        </div>
        <h1 className={`${titleCls(article.title)} mt-2`}>{frTypo(article.title)}</h1>
        <div className="flex items-center gap-3 mt-5 pb-6" style={{ borderBottom: `1px solid ${C.line}` }}>
          <Avatar name={article.authorName} size={40} tone={0} />
          <div>
            <div className="text-[15px] font-semibold">{article.authorName}</div>
            <div className="text-[13px]" style={{ color: C.mute }}>{meta(article)}</div>
          </div>
        </div>
        <div className="pt-7"><Blocks blocks={blocks} /></div>
        <div className="flex justify-center pt-4" aria-hidden="true"><div className="w-10 h-[3px] rounded-full" style={{ background: C.ochre }} /></div>
        {canPdf && <ShareCard s={share} />}
      </article>
      <ShareSheet s={share} />
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
                className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none border-[1.5px] focus:border-[#0E1533] min-h-[45dvh]" style={inputStyle} />
            </Field>
          </>
        ) : (
          <Card className="px-5 py-6">
            <h1 className={titleCls(d.title || '')}>{frTypo(d.title) || 'Sans titre'}</h1>
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
  // « Nouveau » : ce qui est paru depuis la dernière visite (retenue à l'ouverture)
  const [since] = useState(() => seenAt('articles'));
  useEffect(() => { markSeen('articles'); }, []);
  const fresh = (a: Article) => isNewSince(a.publishedAt, since);

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
      <NightHeader onBack={onBack} title="Articles" accent={C.mango} desc="Les textes de Christian, signés CKLabs, et sa revue de presse. Réservés aux proches inscrits sur l'appli." />
      {isAuthor && (
        <div className="px-5 pb-4 flex flex-col gap-2.5">
          <Button onClick={() => go({ k: 'edit' })}><Icon name="plus" size={20} /> Écrire ou importer un article</Button>
          <Button variant="secondary" onClick={() => go({ k: 'press' })}><Icon name="file" size={20} /> Ajouter une revue de presse</Button>
        </div>
      )}
      {list && hasPress && (
        <div className="px-5 pb-3 flex flex-col gap-2">
          <Chips options={[{ id: 'all', label: 'Tout' }, { id: 'own', label: 'Christian' }, { id: 'press', label: 'Presse' }]}
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
            <div className="flex items-center justify-between gap-2"><Kind a={first} dark />{fresh(first) ? <NewPill dark /> : <span className="text-[11.5px] font-semibold" style={{ color: 'rgba(255,255,255,.55)' }}>Le plus récent</span>}</div>
            <div className="serif text-[24px] font-semibold leading-[1.18] mt-2">{frTypo(first.title)}</div>
            {first.excerpt && <p className="text-[14px] leading-relaxed mt-3 line-clamp-3" style={{ color: 'rgba(255,255,255,.78)' }}>{frTypo(first.excerpt)}</p>}
            <div className="text-[12px] mt-4" style={{ color: 'rgba(255,255,255,.6)' }}>{meta(first)}</div>
          </button>
        )}
        {rest.length > 0 && (
          <Card>
            {rest.map((a, i) => (
              <button key={a.id} onClick={() => go({ k: 'read', id: a.id })} className="w-full text-left px-4 py-4" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <div className="flex items-center justify-between gap-2"><Kind a={a} />{fresh(a) && <NewPill />}</div>
                <div className="serif text-[18px] font-semibold leading-snug mt-1">{frTypo(a.title)}</div>
                {a.excerpt && <p className="text-[14px] leading-snug mt-1.5 line-clamp-2" style={{ color: C.text2 }}>{frTypo(a.excerpt)}</p>}
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
