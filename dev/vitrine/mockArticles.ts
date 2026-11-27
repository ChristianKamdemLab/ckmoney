import { Article } from '../../types';
import { excerptOf, readMinutes } from '../../utils/articleText';
// Articles inventés pour la vitrine (aucun texte réel : le dépôt est public).
const para = (n: number) => Array.from({ length: n }, (_, i) => `Paragraphe ${i + 1} d'un article inventé pour la vitrine de l'appli. Il sert à juger la mise en page, la longueur des lignes, les intertitres et le confort de lecture sur un téléphone, sans reprendre le texte d'un vrai article.`).join('\n\n');
const own = (id: string, title: string, days: number, n: number): Article => {
  const body = para(n), at = new Date(Date.now() - days * 86400_000).toISOString();
  return { id, title, body, excerpt: excerptOf(body), readMinutes: readMinutes(body), status: 'published', publishedAt: at, updatedAt: at, authorUid: 'me', authorName: 'Christian Kamdem' } as any;
};
const press = (id: string, title: string, source: string, days: number, zones: string[]): Article => {
  const at = new Date(Date.now() - days * 86400_000).toISOString();
  return { id, kind: 'press', title, body: '', excerpt: 'Une accroche inventée pour la vitrine, sur deux lignes, pour voir le rendu sous la carte.', readMinutes: 1, status: 'published', publishedAt: at, updatedAt: at,
    authorUid: 'me', authorName: 'Christian Kamdem', source, sourceUrl: 'https://example.com', zones,
    summary: "Premier paragraphe de synthèse inventé pour la vitrine.\nDeuxième paragraphe, un peu plus long, pour voir la mise en page d'une fiche de revue de presse sur un petit écran." } as any;
};
const list: Article[] = [
  own('a0', "Tribune d'exemple : un titre assez long pour voir comment il se coupe sur deux ou trois lignes", 1, 6),
  own('a1', 'Chronique inventée', 9, 4),
  press('p1', 'Titre de presse inventé, aussi long qu’un vrai : un responsable politique s’enferre dans le déni face aux nouvelles preuves', 'Jeune Afrique', 0, ['afrique', 'eco']),
  press('p2', 'En Afrique de l’Est, une région déjà touchée par la guerre subit une sécheresse aggravée par El Niño (exemple)', 'Le Monde', 0, ['monde']),
  press('p3', 'Économie camerounaise : un titre d\'exemple', 'EcoMatin', 1, ['cameroun', 'afrique', 'eco']),
];
export const listArticles = async () => [...list].sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
export const savePress = async () => 'p1';
export type PressInput = any;
export const saveArticle = async () => 'a0';
export const importArticles = async () => [];
export const deleteArticle = async () => undefined;
export type ArticleInput = any;
export const fetchAudio = async (_id: string) => '';
