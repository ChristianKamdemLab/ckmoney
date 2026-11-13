import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

// Agent Articles : publication depuis le dossier Drive (simulé), suivi des fichiers, notifications.

const store = new Map<string, any>();
const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
let auto = 0;
const snapOf = (path: string) => ({ id: path.split('/').pop(), exists: store.has(path), data: () => clone(store.get(path)) });
const docRef = (path: string): any => ({
  id: path.split('/').pop(), path,
  get: async () => snapOf(path),
  set: async (d: any, o?: { merge?: boolean }) => { store.set(path, clone(o?.merge ? { ...store.get(path), ...d } : d)); },
});
const colRef = (name: string) => ({
  doc: (id?: string) => docRef(`${name}/${id || `auto${++auto}`}`),
  get: async () => ({ docs: [...store.keys()].filter(k => k.startsWith(`${name}/`)).map(snapOf) }),
});
const pushed: { uid: string; msg: any }[] = [];
vi.mock('../api/_lib/admin.js', () => ({
  adminDb: { collection: colRef },
  adminAuth: { getUserByEmail: async () => ({ uid: 'chris', displayName: 'Christian' }) },
  authorEmail: () => 'auteur@example.com',
  pushToUser: async (uid: string, msg: any) => { pushed.push({ uid, msg }); return 1; },
}));

const { syncArticles, CLASSIFIER } = await import('../api/_lib/articleSync');
const PDF = 'application/pdf', DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const drive = (files: { id: string; name: string; mimeType: string; modifiedTime: string; fixture?: string; size?: string }[]) => ({
  list: async () => files,
  download: async (f: any) => ({ data: new Uint8Array(fs.readFileSync(`tests/fixtures/${files.find(x => x.id === f.id)!.fixture}`)) }),
});

beforeEach(() => {
  store.clear(); pushed.length = 0;
  store.set('profiles/chris', { fullName: 'Christian Kamdem' });
  ['chris', 'pm'].forEach(u => store.set(`pushTokens/${u}`, { tokens: ['t'] }));
});

describe('agent Articles : publication', () => {
  it('publie le texte de Christian en entier et la fiche presse sans le texte ; prévient tout le monde une fois', async () => {
    const d = drive([
      { id: 'f1', name: 'mon-texte.pdf', mimeType: PDF, modifiedTime: '2026-11-13T09:00:00Z', fixture: 'ckl-article.pdf' },
      { id: 'f2', name: 'ja.pdf', mimeType: PDF, modifiedTime: '2026-11-13T09:01:00Z', fixture: 'presse-ja.pdf' },
    ]);
    const r = await syncArticles(d, new Date('2026-11-13T10:00:00Z'));
    expect(r.done).toEqual({ 'mon-texte.pdf': 'own', 'ja.pdf': 'press' });
    const own = store.get(`articles/${store.get('articleImports/f1').articleId}`);
    const press = store.get(`articles/${store.get('articleImports/f2').articleId}`);
    expect(own).toMatchObject({ kind: 'own', status: 'published', authorUid: 'chris', authorName: 'Christian Kamdem' });
    expect(own.body.length).toBeGreaterThan(200);
    expect(press).toMatchObject({ kind: 'press', status: 'published', source: 'Jeune Afrique', body: '' });
    expect(press.excerpt.split(/\s+/).length).toBeLessThanOrEqual(16);
    // Notification « nouvel article » à tous les appareils, une fois par article
    expect(pushed.filter(p => p.msg.title === 'Nouvel article de Christian').map(p => p.uid).sort()).toEqual(['chris', 'pm']);
    expect(pushed.filter(p => p.msg.title === 'Revue de presse · Jeune Afrique')).toHaveLength(2);
    // Rien de nouveau : rien ne se passe
    pushed.length = 0;
    expect((await syncArticles(d)).done).toEqual({});
    expect(pushed).toEqual([]);
  }, 60000);

  it('fichier modifié : même article mis à jour, pas de nouvelle notification', async () => {
    const files = [{ id: 'f1', name: 'mon-texte.docx', mimeType: DOCX, modifiedTime: '2026-11-13T09:00:00Z', fixture: 'ckl-article.docx' }];
    await syncArticles(drive(files));
    const id = store.get('articleImports/f1').articleId;
    pushed.length = 0;
    files[0].modifiedTime = '2026-11-13T11:00:00Z';
    await syncArticles(drive(files));
    expect(store.get('articleImports/f1').articleId).toBe(id);
    expect([...store.keys()].filter(k => k.startsWith('articles/'))).toHaveLength(1);
    expect(pushed).toEqual([]);
  }, 60000);

  it('source inconnue : brouillon et message à Christian seul ; format non lu : message à Christian', async () => {
    const r = await syncArticles(drive([
      { id: 'f1', name: 'notes.pdf', mimeType: PDF, modifiedTime: '2026-11-13T09:00:00Z', fixture: 'inconnu.pdf' },
      { id: 'f2', name: 'vieux.doc', mimeType: 'application/msword', modifiedTime: '2026-11-13T09:00:00Z' },
    ]));
    expect(r.done).toEqual({ 'notes.pdf': 'unknown', 'vieux.doc': 'format' });
    expect(store.get(`articles/${store.get('articleImports/f1').articleId}`).status).toBe('draft');
    expect(pushed.map(p => [p.uid, p.msg.title])).toEqual([['chris', 'Article à vérifier'], ['chris', 'Article non lu']]);
  }, 60000);

  it('essai (dry) : lit et classe sans rien écrire ni prévenir', async () => {
    const r = await syncArticles(drive([{ id: 'f2', name: 'ja.pdf', mimeType: PDF, modifiedTime: 'x', fixture: 'presse-ja.pdf' }]), new Date(), { dry: true });
    expect(r.done['ja.pdf']).toMatch(/^press · Jeune Afrique · /);
    expect([...store.keys()].some(k => k.startsWith('articles') || k.startsWith('articleImports'))).toBe(false);
    expect(pushed).toEqual([]);
  }, 60000);
});

describe('agent Articles : relecture et garde-fous', () => {
  const AI_NAME = "Afrique • Un titre d'essai assez long pour la revue de presse - 26_10_2026 - Africa Intelligence.pdf";
  // État laissé par l'ancien tri : un brouillon « à vérifier », jamais touché depuis
  const oldUnknown = (at = '2026-11-13T16:42:00.000Z', draft: object = {}) => {
    store.set('articleImports/f1', { name: AI_NAME, modifiedTime: 'm1', status: 'unknown', articleId: 'a1', at });
    store.set('articles/a1', { kind: 'own', status: 'draft', title: 'Afrique Un titre', body: 'le texte entier du journal', updatedAt: at, publishedAt: at, createdAt: at, ...draft });
  };
  const files = [{ id: 'f1', name: AI_NAME, mimeType: PDF, modifiedTime: 'm1', fixture: 'presse-titre.pdf' }];

  it('un brouillon « à vérifier » intact est relu : il devient une fiche, sans le texte, datée du jour de l’article', async () => {
    oldUnknown();
    const r = await syncArticles(drive(files), new Date('2026-11-13T18:00:00Z'));
    expect(r.done).toEqual({ [AI_NAME]: 'press' });
    expect(store.get('articles/a1')).toMatchObject({
      kind: 'press', status: 'published', body: '', source: 'Africa Intelligence', sourceSection: 'Afrique',
      title: 'Un titre d’essai assez long pour la revue de presse', publishedAt: '2026-10-26T09:00:00.000Z',
    });
    expect(store.get('articleImports/f1')).toMatchObject({ status: 'press', v: CLASSIFIER, articleId: 'a1' });
    expect(pushed.filter(p => p.msg.title === 'Revue de presse · Africa Intelligence')).toHaveLength(2);
    // Une seule fois
    pushed.length = 0;
    expect((await syncArticles(drive(files))).done).toEqual({});
    expect(pushed).toEqual([]);
  }, 60000);

  it('brouillon déjà retouché par Christian : on n’y touche pas', async () => {
    oldUnknown(undefined, { updatedAt: '2026-11-13T17:00:00.000Z', body: 'mon résumé' });
    expect((await syncArticles(drive(files))).done).toEqual({});
    expect(store.get('articles/a1')).toMatchObject({ kind: 'own', status: 'draft', body: 'mon résumé' });
    expect(store.get('articleImports/f1')).toMatchObject({ status: 'unknown', v: CLASSIFIER });
    expect(pushed).toEqual([]);
  }, 60000);

  it('relu sans plus de succès : reste en brouillon, sans nouveau message', async () => {
    store.set('articleImports/f9', { name: 'notes.pdf', modifiedTime: 'm1', status: 'unknown', articleId: 'a9', at: 't' });
    store.set('articles/a9', { kind: 'own', status: 'draft', title: 'Notes', body: 'x', updatedAt: 't' });
    const r = await syncArticles(drive([{ id: 'f9', name: 'notes.pdf', mimeType: PDF, modifiedTime: 'm1', fixture: 'inconnu.pdf' }]));
    expect(r.done).toEqual({ 'notes.pdf': 'unknown' });
    expect(store.get('articleImports/f9')).toMatchObject({ status: 'unknown', v: CLASSIFIER });
    expect(pushed).toEqual([]);
  }, 60000);

  it('journal entier (par son nom ou ses pages) : pas d’article, un mot à Christian seul', async () => {
    const r = await syncArticles(drive([
      { id: 'j1', name: "L'Équipe du Vendredi 13 Novembre 2026.pdf", mimeType: PDF, modifiedTime: 'm', fixture: 'presse-ja.pdf' },
      { id: 'j2', name: 'gros.pdf', mimeType: PDF, modifiedTime: 'm', fixture: 'long.pdf' },
    ]));
    expect(r.done).toEqual({ "L'Équipe du Vendredi 13 Novembre 2026.pdf": 'journal', 'gros.pdf': 'journal' });
    expect([...store.keys()].some(k => k.startsWith('articles/'))).toBe(false);
    expect(store.get('articleImports/j2')).toMatchObject({ status: 'journal', pages: 21 });
    expect(pushed.map(p => [p.uid, p.msg.title])).toEqual([['chris', 'Pas un article'], ['chris', 'Pas un article']]);
    expect(pushed[1].msg.body).toContain('21 pages');
  }, 60000);

  it('temps compté : on ne commence plus de fichier une fois le délai passé', async () => {
    const r = await syncArticles(drive(files), new Date(), { budgetMs: -1 });
    expect(r.done).toEqual({});
  }, 60000);
});

