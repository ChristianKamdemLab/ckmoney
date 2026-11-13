import { parseMedia, ogTags, Platform } from '../../utils/radio.js';

// Titre, émission et image d'un lien de podcast ou de vidéo, lus chez la plateforme (oEmbed, sinon
// balises d'aperçu de la page). Aucune clé d'API. Seul l'auteur s'en sert (api/radio, action « preview »).

const OEMBED: Partial<Record<Platform, (u: string) => string>> = {
  youtube: u => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  spotify: u => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  deezer: u => `https://api.deezer.com/oembed?format=json&url=${encodeURIComponent(u)}`,
};

/** Pas d'adresse privée ni de serveur local (le serveur ne va chercher que des pages publiques). */
export const publicHost = (u: string) => {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return !(h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^[\d.]+$/.test(h) || h.includes(':') || h === 'metadata.google.internal');
  } catch { return false; }
};

const get = async (url: string, accept: string) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { accept, 'accept-language': 'fr-FR,fr;q=0.9', 'user-agent': 'Mozilla/5.0 (compatible; CKMoney/1.0; +https://ck-money.vercel.app)' } });
    if (!r.ok) return null;
    return (await r.text()).slice(0, 600_000);
  } catch { return null; } finally { clearTimeout(t); }
};

export const fetchMeta = async (raw: string) => {
  const media = parseMedia(raw);
  if (!media || !publicHost(media.url)) return null;
  let title = '', show = '', thumbnail = media.thumbnail || '';
  const o = OEMBED[media.platform];
  if (o) {
    const txt = await get(o(media.url), 'application/json');
    try {
      const j = txt ? JSON.parse(txt) : null;
      if (j) { title = j.title || ''; show = j.author_name || ''; thumbnail = j.thumbnail_url || thumbnail; }
    } catch { /* page ci-dessous */ }
  }
  if (!title || !show || !thumbnail) {
    const html = await get(media.url, 'text/html');
    if (html) {
      const og = ogTags(html);
      title ||= og.title;
      thumbnail ||= og.image;
      // Spotify, Apple : le nom de l'émission est souvent dans la description de la page
      const fromDesc = og.description.match(/(?:épisode de|episode from|écoutez|listen to)\s+(.+?)\s+(?:sur|on|dans)\s+(?:Spotify|Apple)/i);
      show ||= (fromDesc && fromDesc[1]) || (og.site && !/spotify|apple|youtube|deezer/i.test(og.site) ? og.site : '');
    }
  }
  title = title.replace(/\s+[-|·]\s+(YouTube|Apple Podcasts|Spotify|Deezer)$/i, '').trim();
  return { ...media, title: title.slice(0, 200), show: show.slice(0, 120), thumbnail: /^https:\/\//i.test(thumbnail) ? thumbnail : media.thumbnail || '' };
};
