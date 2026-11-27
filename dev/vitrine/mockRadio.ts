import { RadioItem } from '../../utils/radio';
const author = new URLSearchParams(location.search).get('v')?.includes('author') ?? false;
let items: RadioItem[] = [
  { id: 'r1', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', platform: 'youtube', kind: 'video', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', title: 'Comment la diaspora finance le continent : le vrai poids des transferts', show: 'Le Débrief Éco', thumbnail: '', comment: 'Un commentaire inventé pour la vitrine.', publishedAt: new Date(Date.now() - 3 * 3600_000).toISOString(), by: 'Christian', reactions: { '🔥': 3, '🤯': 1 }, myReaction: '🔥', commentCount: 2 },
  { id: 'r2', url: 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk', platform: 'spotify', kind: 'podcast', embedUrl: 'https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk', title: "L'IA va-t-elle remplacer les auteurs ?", show: 'Génération Do It Yourself', thumbnail: '', comment: 'Un autre commentaire inventé.', publishedAt: new Date(Date.now() - 5 * 86400_000).toISOString(), by: 'Christian', reactions: {}, myReaction: null, commentCount: 0 },
];
const comments = [
  { id: 'c1', name: 'Nina', text: 'Très clair, merci.', at: new Date(Date.now() - 2 * 3600_000).toISOString(), mine: false, canDelete: author },
  { id: 'c2', name: 'Yann', text: 'Je le fais écouter à ma sœur.', at: new Date(Date.now() - 40 * 60_000).toISOString(), mine: true, canDelete: true },
];
export const listRadio = async () => ({ items, author });
export const getRadio = async (id: string) => ({ item: items.find(i => i.id === id)!, comments: id === 'r1' ? comments : [] });
export const previewRadio = async (url: string) => ({ platform: 'youtube', kind: 'video', url, title: 'Titre lu automatiquement', show: 'Une chaîne', thumbnail: '', embedUrl: '' });
export const saveRadio = async () => ({ id: 'r1', notified: 3 });
export const deleteRadio = async () => ({});
export const reactRadio = async (id: string, emoji: string | null) => { const i = items.find(x => x.id === id)!; return { ...i, myReaction: emoji }; };
export const commentRadio = async (_id: string, text: string) => ({ id: 'c' + Date.now(), name: 'Toi', text, at: new Date().toISOString(), mine: true, canDelete: true });
export const deleteRadioComment = async () => ({});
