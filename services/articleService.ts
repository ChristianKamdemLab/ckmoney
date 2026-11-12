import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { Article } from '../types';
import { callApi } from './push';

const fromDoc = (id: string, d: any): Article => ({
  id, title: d.title || '', body: d.body || '', excerpt: d.excerpt || '', readMinutes: d.readMinutes || 1,
  status: d.status === 'draft' ? 'draft' : 'published', publishedAt: d.publishedAt || undefined,
  updatedAt: d.updatedAt || '', authorUid: d.authorUid || '', authorName: d.authorName || 'CKLabs',
});

/** Articles publiés (+ brouillons de l'auteur), du plus récent au plus ancien ; brouillons en tête. */
export const listArticles = async (uid: string, isAuthor: boolean): Promise<Article[]> => {
  const col = collection(db, 'articles');
  const [pub, own] = await Promise.all([
    getDocs(query(col, where('status', '==', 'published'))),
    isAuthor ? getDocs(query(col, where('authorUid', '==', uid))) : Promise.resolve(null),
  ]);
  const map = new Map<string, Article>();
  pub.docs.forEach(d => map.set(d.id, fromDoc(d.id, d.data())));
  own?.docs.forEach(d => map.set(d.id, fromDoc(d.id, d.data())));
  return [...map.values()].sort((a, b) =>
    (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1)
    || (b.publishedAt || b.updatedAt).localeCompare(a.publishedAt || a.updatedAt));
};

export type ArticleInput = { id?: string; title: string; body: string; status: 'published' | 'draft'; publishedAt?: string };

const ok = (r: { status: number; data: any }) => {
  if (r.status !== 200) throw new Error(r.data?.error || `http_${r.status}`);
  return r.data;
};

export const saveArticle = async (a: ArticleInput): Promise<string> => ok(await callApi('/api/articles', { action: 'save', article: a })).id;
export const importArticles = async (list: ArticleInput[]): Promise<string[]> => ok(await callApi('/api/articles', { action: 'import', articles: list })).ids;
export const deleteArticle = async (id: string) => { ok(await callApi('/api/articles', { action: 'delete', id })); };
