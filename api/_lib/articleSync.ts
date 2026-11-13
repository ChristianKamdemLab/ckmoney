import { adminAuth, adminDb, authorEmail, pushToUser } from './admin.js';
import { DriveFile } from './drive.js';
import { classify, readDocx, readPdf, readText, Ingested } from './articleIngest.js';
import { excerptOf, readMinutes } from '../../utils/articleText.js';

// Agent Articles : chaque fichier nouveau ou modifié du dossier Drive devient un article.
// Publication automatique (choix de Christian) et notification « nouvel article » à tous les appareils
// (pas d'e-mail). Un fichier dont on ne sait pas dire d'où il vient reste en brouillon et Christian est
// prévenu. Suivi dans Firestore : articleImports/{id du fichier}.

const TYPES: Record<string, 'pdf' | 'docx' | 'gdoc' | 'txt'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.google-apps.document': 'gdoc',
  'text/plain': 'txt',
};
const MAX_PER_RUN = 5;

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

const read = async (f: DriveFile, deps: SyncDeps) => {
  const type = TYPES[f.mimeType];
  const c = await deps.download(f);
  if (type === 'pdf') return readPdf(c.data!);
  if (type === 'docx') return readDocx(c.data!);
  return readText(c.text ?? new TextDecoder().decode(c.data!));
};

export const syncArticles = async (deps: SyncDeps, now = new Date(), opts: { dry?: boolean } = {}) => {
  const iso = now.toISOString();
  const files = await deps.list();
  const imports = adminDb.collection('articleImports');
  const done: Record<string, string> = {};
  let me: Awaited<ReturnType<typeof author>> | null = null;
  let handled = 0;
  for (const f of files) {
    if (handled >= MAX_PER_RUN) break;
    const state = (await imports.doc(f.id).get()).data();
    if (state && state.modifiedTime === f.modifiedTime) continue;
    handled++;
    if (opts.dry) {
      // Essai : on lit et on classe, sans rien publier ni prévenir
      try {
        if (!TYPES[f.mimeType]) { done[f.name] = 'format'; continue; }
        const { title, blocks } = await read(f, deps);
        const r = classify(title || f.name, blocks);
        done[f.name] = `${r.kind} · ${r.kind === 'press' ? `${r.source} · ` : ''}${r.title.slice(0, 80)}`;
      } catch (e: any) { done[f.name] = `erreur ${String(e?.message || e).slice(0, 80)}`; }
      continue;
    }
    me = me || await author();
    if (!TYPES[f.mimeType]) {
      await imports.doc(f.id).set({ name: f.name, modifiedTime: f.modifiedTime, status: 'format', at: iso });
      await pushToUser(me.uid, { title: 'Article non lu', body: `« ${f.name} » : enregistre-le en PDF ou en Word (.docx).`, url: '/', tag: `import-${f.id}` }).catch(() => 0);
      done[f.name] = 'format';
      continue;
    }
    try {
      const { title, blocks } = await read(f, deps);
      if (!title && !blocks.length) throw new Error('vide');
      const r: Ingested = classify(title || f.name.replace(/\.[a-z0-9]+$/i, ''), blocks);
      const ref = state?.articleId ? adminDb.collection('articles').doc(state.articleId) : adminDb.collection('articles').doc();
      const prev = (await ref.get()).data();
      const base = {
        authorUid: me.uid, authorName: me.name, updatedAt: iso, importedFrom: f.id, ...(prev ? {} : { createdAt: iso }),
      };
      if (r.kind === 'press') {
        await ref.set({
          ...base, kind: 'press', title: r.title, body: '', excerpt: r.excerpt, readMinutes: 1, status: 'published',
          source: r.source, sourceUrl: r.sourceUrl, sourceSection: r.section || '', sourceAuthor: r.author || '', publishedAt: prev?.publishedAt || r.publishedAt || iso,
        }, { merge: true });
      } else {
        await ref.set({
          ...base, kind: 'own', title: r.title, body: r.body, excerpt: excerptOf(r.body), readMinutes: readMinutes(r.body),
          status: r.kind === 'own' ? 'published' : 'draft', source: '', sourceUrl: '', sourceSection: '',
          publishedAt: prev?.publishedAt || (r.kind === 'own' ? r.publishedAt : undefined) || iso,
        }, { merge: true });
      }
      await imports.doc(f.id).set({ name: f.name, modifiedTime: f.modifiedTime, status: r.kind, articleId: ref.id, at: iso });
      if (r.kind === 'unknown') {
        await pushToUser(me.uid, { title: 'Article à vérifier', body: `« ${r.title} » : je n'ai pas reconnu sa source. Il t'attend en brouillon.`, url: `/?article=${ref.id}`, tag: `import-${f.id}` }).catch(() => 0);
      } else {
        await notifyNewArticle(ref.id, { title: r.title, kind: r.kind, source: r.kind === 'press' ? r.source : undefined, authorFirst: me.first });
      }
      done[f.name] = r.kind;
    } catch (e: any) {
      await imports.doc(f.id).set({ name: f.name, modifiedTime: f.modifiedTime, status: 'erreur', error: String(e?.message || e).slice(0, 200), at: iso });
      await pushToUser(me.uid, { title: 'Article non lu', body: `« ${f.name} » n'a pas pu être lu. Essaie de l'enregistrer à nouveau en PDF.`, url: '/', tag: `import-${f.id}` }).catch(() => 0);
      done[f.name] = 'erreur';
    }
  }
  return { files: files.length, done };
};
