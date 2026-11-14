import { adminAuth, adminDb, authorEmail, pushToUser } from './admin.js';
import { DriveFile } from './drive.js';
import { classify, readDocx, readPdf, readText, isIssueName, findDate, norm, MEDIA, Ingested, Hints } from './articleIngest.js';
import { PdfTooLong } from '../../utils/pdfLines.js';
import { excerptOf, readMinutes } from '../../utils/articleText.js';

// Agent Articles : chaque fichier nouveau ou modifié du dossier Drive devient un article.
// Texte de Christian : publié tout de suite (son choix), notification « nouvel article » à tous les
// appareils (pas d'e-mail). Article d'un journal : la fiche attend son « L'essentiel » (synthèse avec nos
// mots), écrit dans un document à côté du PDF, nommé « <nom du PDF> · L'essentiel » ; elle est publiée,
// avec la notification, quand ce document existe, et mise à jour quand il change. Un fichier dont on ne
// sait pas dire d'où il vient reste en brouillon et Christian est prévenu.
// Suivi dans Firestore : articleImports/{id du fichier}.

const TYPES: Record<string, 'pdf' | 'docx' | 'gdoc' | 'txt'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.google-apps.document': 'gdoc',
  'text/plain': 'txt',
};
const MAX_PER_RUN = 5;
/** Version du tri. Quand elle augmente, les fichiers restés « à vérifier » (ou illisibles) sont relus une
 *  fois, sauf si Christian a déjà touché au brouillon. */
export const CLASSIFIER = 2;
/** On ne commence plus de fichier après ce délai : la fonction a 60 s en tout. */
const TIME_BUDGET_MS = 35_000;
const MAX_BYTES = 20 * 1024 * 1024;

export interface SyncDeps {
  list: () => Promise<DriveFile[]>;
  download: (f: DriveFile) => Promise<{ data?: Uint8Array; text?: string }>;
}

const author = async () => {
  const u = await adminAuth.getUserByEmail(authorEmail());
  const profile = (await adminDb.collection('profiles').doc(u.uid).get()).data();
  const name = String(profile?.fullName || u.displayName || 'Christian');
  return { uid: u.uid, name, first: name.split(/\s+/)[0] };
};

const pushAll = async (msg: { title: string; body: string; url: string; tag: string }) => {
  const uids = (await adminDb.collection('pushTokens').get()).docs.map((d: any) => d.id);
  const sent = await Promise.all(uids.map((u: string) => pushToUser(u, msg).catch(() => 0)));
  return sent.filter((n: number) => n > 0).length;
};

/** « Nouvel article » : une seule fois par article. */
export const notifyNewArticle = async (id: string, a: { title: string; kind?: string; source?: string; authorFirst?: string }) => {
  const ref = adminDb.collection('articles').doc(id);
  const snap = await ref.get();
  if (snap.data()?.notifiedAt) return 0;
  await ref.set({ notifiedAt: new Date().toISOString() }, { merge: true });
  return pushAll({
    title: a.kind === 'press' ? `Revue de presse · ${a.source}` : `Nouvel article${a.authorFirst ? ` de ${a.authorFirst}` : ''}`,
    body: a.title, url: `/?article=${id}`, tag: `article-${id}`,
  });
};

const read = async (f: DriveFile, deps: SyncDeps): Promise<{ title: string; blocks: any[]; hints: Hints }> => {
  const type = TYPES[f.mimeType];
  const c = await deps.download(f);
  if (type === 'pdf') {
    const r = await readPdf(c.data!);
    return { title: r.title, blocks: r.blocks, hints: { fileName: f.name, docTitle: r.docTitle, links: r.links } };
  }
  const r = type === 'docx' ? await readDocx(c.data!) : readText(c.text ?? new TextDecoder().decode(c.data!));
  return { ...r, hints: { fileName: f.name } };
};

/** Un numéro entier de journal, ou un fichier démesuré : pas un article. */
const notAnArticle = (f: DriveFile) => isIssueName(f.name) || Number(f.size || 0) > MAX_BYTES;

// ---------- « L'essentiel » : un document à côté du PDF

export const ESSENTIEL = "L'essentiel";
const baseName = (n: string) => n.replace(/\.(pdf|docx?|txt)$/i, '').trim();
const ESSENTIEL_RE = /\s*[·•|_-]\s*L['’]essentiel\s*$/i;
const keyOf = (n: string) => baseName(n).replace(ESSENTIEL_RE, '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** « <nom du PDF> · L'essentiel » (Google Doc, Word ou texte). */
export const isEssentielDoc = (f: DriveFile) => !!TYPES[f.mimeType] && TYPES[f.mimeType] !== 'pdf' && ESSENTIEL_RE.test(baseName(f.name));
export const essentielName = (pdfName: string) => `${baseName(pdfName)} · ${ESSENTIEL}`;
export const MAX_SUMMARY = 4000;

/** Le document : en tête, des lignes facultatives « Accroche : … », « Source : … » (le journal),
 *  « Titre : … », « Date : 12/11/2026 », « Auteur : … », « Lien : https://… » ; puis la synthèse, un
 *  paragraphe par ligne. La source et le titre permettent de publier la fiche même quand le PDF ne dit
 *  pas d'où il vient ou ne se lit pas (capture d'écran). */
export const parseEssentiel = (raw: string) => {
  const lines = raw.replace(/^\ufeff/, '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const head: Record<string, string> = {};
  while (lines.length) {
    const m = lines[0].match(/^(accroche|source|journal|titre|date|auteur|lien)\s*:\s*(.*)$/i);
    if (!m) break;
    head[m[1].toLowerCase()] = m[2].replace(/[<>]/g, '').trim();
    lines.shift();
  }
  const link = /^https:\/\/[^\s"'<>]+$/.test(head.lien || '') ? head.lien : '';
  return {
    teaser: (head.accroche || '').slice(0, 200),
    source: (head.source || head.journal || '').slice(0, 80),
    title: (head.titre || '').slice(0, 200),
    date: head.date ? findDate(head.date.replace(/\./g, '/')) : undefined,
    author: (head.auteur || '').slice(0, 120),
    link,
    summary: lines.join('\n\n').replace(/[<>]/g, '').slice(0, MAX_SUMMARY).trim(),
  };
};
type Essentiel = ReturnType<typeof parseEssentiel>;

/** La fiche décrite par le document « L'essentiel » seul (source et titre donnés). */
const pressFromEssentiel = (e: Essentiel, fallbackTitle = ''): Ingested | null => {
  const title = e.title || fallbackTitle;
  if (!e.source || !title || !e.summary) return null;
  const media = MEDIA.find(m => norm(m.name) === norm(e.source));
  return {
    kind: 'press', title, source: media?.name || e.source, excerpt: e.teaser,
    sourceUrl: e.link || (media ? `https://www.${media.domains[0].split('/')[0]}` : ''),
    author: e.author || undefined, publishedAt: e.date,
  };
};

const readEssentiel = async (f: DriveFile, deps: SyncDeps) => {
  const c = await deps.download(f);
  if (TYPES[f.mimeType] === 'docx') {
    const d = await readDocx(c.data!);
    return parseEssentiel([d.title, ...d.blocks.map(b => b.text)].join('\n'));
  }
  return parseEssentiel(c.text ?? new TextDecoder().decode(c.data!));
};

export const syncArticles = async (deps: SyncDeps, now = new Date(), opts: { dry?: boolean; budgetMs?: number } = {}) => {
  const iso = now.toISOString();
  const t0 = Date.now();
  const files = await deps.list();
  const imports = adminDb.collection('articleImports');
  const articles = adminDb.collection('articles');
  const done: Record<string, string> = {};
  let me: Awaited<ReturnType<typeof author>> | null = null;
  let handled = 0;
  // Un document par article ; s'il y en a deux du même nom, le plus récent compte
  const essentiels = new Map<string, DriveFile>();
  for (const d of files.filter(isEssentielDoc)) {
    const cur = essentiels.get(keyOf(d.name));
    if (!cur || d.modifiedTime > cur.modifiedTime) essentiels.set(keyOf(d.name), d);
  }
  for (const f of files.filter(x => !isEssentielDoc(x))) {
    if (handled >= MAX_PER_RUN || Date.now() - t0 > (opts.budgetMs ?? TIME_BUDGET_MS)) break;
    const state = (await imports.doc(f.id).get()).data();
    const ess = essentiels.get(keyOf(f.name));
    // Déjà lu, dans cette version : rien à faire. Resté « à vérifier » ou illisible avec un tri plus
    // ancien : on le relit une fois, si le brouillon n'a pas été touché depuis. Fiche de presse dont
    // « L'essentiel » est arrivé ou a changé : on la reprend.
    const retry = !!state && state.modifiedTime === f.modifiedTime && ['unknown', 'erreur'].includes(state.status) && (state.v || 1) < CLASSIFIER;
    const essChanged = !!state && ['press', 'unknown', 'erreur'].includes(state.status) && (state.essentiel || '') !== (ess?.modifiedTime || '');
    if (state && state.modifiedTime === f.modifiedTime && !retry && !essChanged) continue;
    if ((retry || essChanged) && state!.status === 'unknown') {
      const draft = state!.articleId ? (await articles.doc(state!.articleId).get()).data() : undefined;
      if (!draft || draft.status !== 'draft' || draft.updatedAt !== state!.at) {
        if (!opts.dry) await imports.doc(f.id).set({ ...state, v: CLASSIFIER }, { merge: true });
        continue;
      }
    }
    handled++;
    if (opts.dry) {
      // Essai : on lit et on classe, sans rien publier ni prévenir
      try {
        if (!TYPES[f.mimeType]) { done[f.name] = 'format'; continue; }
        if (notAnArticle(f)) { done[f.name] = 'journal'; continue; }
        const e = ess ? await readEssentiel(ess, deps) : null;
        let r: Ingested;
        try {
          const { title, blocks, hints } = await read(f, deps);
          if (!title && !blocks.length) throw new Error('vide');
          r = classify(title || f.name, blocks, hints);
        } catch (err) {
          const fromDoc = !(err instanceof PdfTooLong) && e ? pressFromEssentiel(e) : null;
          if (!fromDoc) throw err;
          r = fromDoc;
        }
        if (r.kind === 'unknown' && e) r = pressFromEssentiel(e, r.title) || r;
        done[f.name] = `${r.kind} · ${r.kind === 'press' ? `${r.source} · ${e?.summary ? 'avec' : 'sans'} l'essentiel · ` : ''}${r.title.slice(0, 80)}`;
      } catch (e: any) { done[f.name] = e instanceof PdfTooLong ? 'journal' : `erreur ${String(e?.message || e).slice(0, 80)}`; }
      continue;
    }
    me = me || await author();
    const track = (status: string, extra: object = {}) =>
      imports.doc(f.id).set({ name: f.name, modifiedTime: f.modifiedTime, status, at: iso, v: CLASSIFIER, ...extra });
    const tooLong = async (pages?: number) => {
      await track('journal', pages ? { pages } : {});
      await pushToUser(me!.uid, {
        title: 'Pas un article',
        body: `« ${f.name} »${pages ? ` fait ${pages} pages` : ''} : on dirait un journal entier. Dépose plutôt l'article seul, enregistré en PDF depuis sa page.`,
        url: '/', tag: `import-${f.id}`,
      }).catch(() => 0);
      done[f.name] = 'journal';
    };
    if (!TYPES[f.mimeType]) {
      await track('format');
      await pushToUser(me.uid, { title: 'Article non lu', body: `« ${f.name} » : enregistre-le en PDF ou en Word (.docx).`, url: '/', tag: `import-${f.id}` }).catch(() => 0);
      done[f.name] = 'format';
      continue;
    }
    if (notAnArticle(f)) { await tooLong(); continue; }
    try {
      const e = ess ? await readEssentiel(ess, deps) : null;
      let r: Ingested;
      try {
        const { title, blocks, hints } = await read(f, deps);
        if (!title && !blocks.length) throw new Error('vide');
        r = classify(title || f.name.replace(/\.[a-z0-9]+$/i, ''), blocks, hints);
      } catch (err) {
        // Illisible (capture d'écran sans texte…) : la fiche peut venir du document seul
        const fromDoc = !(err instanceof PdfTooLong) && e ? pressFromEssentiel(e) : null;
        if (!fromDoc) throw err;
        r = fromDoc;
      }
      if (r.kind === 'unknown' && e) r = pressFromEssentiel(e, r.title) || r;
      else if (r.kind === 'press' && e) {
        r = { ...r, title: e.title || r.title, publishedAt: r.publishedAt || e.date, author: r.author || e.author || undefined, sourceUrl: e.link || r.sourceUrl };
      }
      const ref = state?.articleId ? articles.doc(state.articleId) : articles.doc();
      const prev = (await ref.get()).data();
      // La date d'un article déjà en ligne ne bouge pas ; celle d'un brouillon, si
      const kept = prev?.status === 'published' ? prev.publishedAt : undefined;
      const base = {
        authorUid: me.uid, authorName: me.name, updatedAt: iso, importedFrom: f.id, ...(prev ? {} : { createdAt: iso }),
      };
      let live = r.kind === 'own';
      if (r.kind === 'press') {
        // Publiée seulement avec « L'essentiel » (ou si elle l'était déjà) ; jamais le texte du journal
        live = !!e?.summary || (prev?.kind === 'press' && prev?.status === 'published');
        await ref.set({
          ...base, kind: 'press', title: r.title, body: '', excerpt: e?.teaser || r.excerpt, readMinutes: 1, status: live ? 'published' : 'draft',
          ...(e?.summary ? { summary: e.summary } : {}),
          // La date d'une fiche est celle du journal quand on la connaît (elle ne change pas d'une lecture à l'autre)
          source: r.source, sourceUrl: r.sourceUrl, sourceSection: r.section || '', sourceAuthor: r.author || '', publishedAt: r.publishedAt || kept || iso,
        }, { merge: true });
      } else {
        await ref.set({
          ...base, kind: 'own', title: r.title, body: r.body, excerpt: excerptOf(r.body), readMinutes: readMinutes(r.body),
          status: r.kind === 'own' ? 'published' : 'draft', source: '', sourceUrl: '', sourceSection: '',
          publishedAt: kept || (r.kind === 'own' ? r.publishedAt : undefined) || iso,
        }, { merge: true });
      }
      await track(r.kind, { articleId: ref.id, essentiel: ess?.modifiedTime || '' });
      if (r.kind === 'unknown') {
        // Relu sans plus de succès : Christian a déjà été prévenu la première fois
        if (!retry && !essChanged) await pushToUser(me.uid, { title: 'Article à vérifier', body: `« ${r.title} » : je n'ai pas reconnu sa source. Il t'attend en brouillon.`, url: `/?article=${ref.id}`, tag: `import-${f.id}` }).catch(() => 0);
      } else if (live) {
        await notifyNewArticle(ref.id, { title: r.title, kind: r.kind, source: r.kind === 'press' ? r.source : undefined, authorFirst: me.first });
      } else if (r.kind === 'press' && state?.status !== 'press') {
        // Fiche reconnue, en attente de sa synthèse : Christian seul est prévenu, une fois
        await pushToUser(me.uid, { title: `Fiche à compléter · ${r.source}`, body: `« ${r.title} » attend son « L'essentiel » avant d'être publiée.`, url: `/?article=${ref.id}`, tag: `import-${f.id}` }).catch(() => 0);
      }
      done[f.name] = r.kind === 'press' ? (live ? 'press' : "press · en attente de l'essentiel") : r.kind;
    } catch (e: any) {
      if (e instanceof PdfTooLong) { await tooLong(e.pages); continue; }
      await track('erreur', { error: String(e?.message || e).slice(0, 200), essentiel: ess?.modifiedTime || '', ...(state?.articleId ? { articleId: state.articleId } : {}) });
      const empty = String(e?.message || '') === 'vide';
      if (!retry && !essChanged) await pushToUser(me.uid, empty
        ? { title: 'Pas de texte lisible', body: `« ${f.name} » est une image (capture d'écran ?). La fiche sera publiée avec son « L'essentiel ».`, url: '/', tag: `import-${f.id}` }
        : { title: 'Article non lu', body: `« ${f.name} » n'a pas pu être lu. Essaie de l'enregistrer à nouveau en PDF.`, url: '/', tag: `import-${f.id}` }).catch(() => 0);
      done[f.name] = 'erreur';
    }
  }
  return { files: files.length, done };
};
