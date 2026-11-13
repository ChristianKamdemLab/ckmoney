import { callApi } from './push';
import { RadioItem, RadioComment, RadioInput } from '../utils/radio';

// Radio CK : tout passe par /api/radio (collection fermée côté Firestore).

const call = async (body: object) => {
  const r = await callApi('/api/radio', body);
  if (r.status !== 200) throw new Error((r.data as any)?.error || String(r.status));
  return r.data as any;
};

let cache: { at: number; items: RadioItem[]; author: boolean } | null = null;
export const listRadio = async (fresh = false): Promise<{ items: RadioItem[]; author: boolean }> => {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache;
  const d = await call({ action: 'list' });
  cache = { at: Date.now(), items: d.items || [], author: !!d.author };
  return cache;
};
const forget = () => { cache = null; };

export const getRadio = async (id: string): Promise<{ item: RadioItem; comments: RadioComment[] }> => call({ action: 'get', id });
export const previewRadio = async (url: string) => (await call({ action: 'preview', url })).meta as { platform: string; kind?: string; url: string; title: string; show: string; thumbnail: string; embedUrl: string };
export const saveRadio = async (item: RadioInput, notify: boolean): Promise<{ id: string; notified: number }> => { forget(); return call({ action: 'save', item, notify }); };
export const deleteRadio = async (id: string) => { forget(); return call({ action: 'delete', id }); };
export const reactRadio = async (id: string, emoji: string | null): Promise<RadioItem> => { forget(); return (await call({ action: 'react', id, emoji })).item; };
export const commentRadio = async (id: string, text: string): Promise<RadioComment> => { forget(); return (await call({ action: 'comment', id, text })).comment; };
export const deleteRadioComment = async (id: string, commentId: string) => { forget(); return call({ action: 'uncomment', id, commentId }); };
