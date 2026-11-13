// Radio CK : les podcasts et vidéos que Christian recommande, et les réactions de ses proches.
// Sans dépendance : utilisé par l'appli et par le serveur (api/radio).

export type RadioKind = 'podcast' | 'video' | 'musique';
export type Platform = 'youtube' | 'spotify' | 'apple' | 'deezer' | 'web';

export interface RadioItem {
  id: string;
  url: string;            // lien d'origine (ouvrir dans l'appli de la plateforme)
  platform: Platform;
  kind: RadioKind;
  embedUrl: string;       // lecteur officiel de la plateforme ('' : pas de lecteur, on ouvre le lien)
  title: string;
  show: string;           // émission ou chaîne
  thumbnail: string;
  comment: string;        // « pourquoi je le recommande »
  publishedAt: string;
  updatedAt?: string;
  by?: string;            // prénom de l'auteur
  reactions: Record<string, number>;
  myReaction?: string | null;
  commentCount: number;
  notified?: boolean;     // auteur seulement
}

export interface RadioComment { id: string; name: string; text: string; at: string; mine: boolean; canDelete: boolean }

export type RadioInput = Pick<RadioItem, 'url' | 'kind' | 'title' | 'show' | 'thumbnail' | 'comment'> & { id?: string };

export const REACTIONS = ['🔥', '👏', '😂', '🤯', '🤔'] as const;
export const KIND_LABEL: Record<RadioKind, string> = { podcast: 'Podcast', video: 'Vidéo', musique: 'Musique' };
export const PLATFORM_LABEL: Record<Platform, string> = { youtube: 'YouTube', spotify: 'Spotify', apple: 'Apple Podcasts', deezer: 'Deezer', web: 'le site' };

export interface Media { platform: Platform; kind?: RadioKind; url: string; embedUrl: string; thumbnail?: string }

/** Reconnaît le lien et prépare le lecteur officiel (YouTube sans cookies, Spotify, Apple Podcasts, Deezer). */
export const parseMedia = (raw: string): Media | null => {
  let u: URL;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const id = host === 'youtu.be' ? u.pathname.slice(1).split('/')[0]
      : u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/) || [])[1] || '';
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
      return { platform: 'youtube', kind: 'video', url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    }
  }
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(episode|show|track|album|playlist)\/([A-Za-z0-9]+)/);
    if (m) return { platform: 'spotify', kind: m[1] === 'episode' || m[1] === 'show' ? 'podcast' : 'musique', url: `https://open.spotify.com/${m[1]}/${m[2]}`, embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}` };
  }
  if (host === 'podcasts.apple.com' && /\/id\d+/.test(u.pathname)) {
    const ep = u.searchParams.get('i');
    const path = u.pathname.replace(/\/+$/, '');
    return { platform: 'apple', kind: 'podcast', url: `https://podcasts.apple.com${path}${ep ? `?i=${ep}` : ''}`, embedUrl: `https://embed.podcasts.apple.com${path}${ep ? `?i=${ep}` : ''}` };
  }
  if (host === 'deezer.com') {
    const m = u.pathname.match(/^\/(?:[a-z]{2}\/)?(episode|show|track|album|playlist)\/(\d+)/);
    if (m) return { platform: 'deezer', kind: m[1] === 'episode' || m[1] === 'show' ? 'podcast' : 'musique', url: `https://www.deezer.com/${m[1]}/${m[2]}`, embedUrl: `https://widget.deezer.com/widget/auto/${m[1]}/${m[2]}` };
  }
  return { platform: 'web', url: u.toString(), embedUrl: '' };
};

/** Hauteur du lecteur (hors YouTube, qui suit le format 16:9). */
export const embedHeight = (i: Pick<RadioItem, 'platform' | 'embedUrl'>) =>
  i.platform === 'spotify' ? 232 : i.platform === 'apple' ? (/[?&]i=/.test(i.embedUrl) ? 175 : 450) : i.platform === 'deezer' ? 300 : 0;

const s = (v: unknown, max: number) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Validation (serveur). Le lecteur est toujours recalculé à partir du lien. */
export const cleanReco = (raw: any): (Omit<RadioInput, 'id'> & Pick<Media, 'platform' | 'embedUrl'>) | null => {
  const media = parseMedia(raw?.url);
  const title = s(raw?.title, 200);
  if (!media || !title) return null;
  const kind: RadioKind = raw?.kind === 'video' || raw?.kind === 'musique' || raw?.kind === 'podcast' ? raw.kind : media.kind || 'podcast';
  const thumb = s(raw?.thumbnail, 500);
  return {
    url: media.url, platform: media.platform, embedUrl: media.embedUrl, kind, title, show: s(raw?.show, 120),
    thumbnail: /^https:\/\/\S+$/i.test(thumb) ? thumb : media.thumbnail || '',
    comment: String(raw?.comment ?? '').replace(/[<>]/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1500),
  };
};

export const MAX_COMMENT = 500;
export const cleanComment = (v: unknown) => String(v ?? '').replace(/[<>]/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_COMMENT);
export const isReaction = (v: unknown): v is string => typeof v === 'string' && (REACTIONS as readonly string[]).includes(v);

/** Décodage des entités HTML des balises d'aperçu (&amp;, &#39;, &quot;…). */
export const decodeEntities = (t: string) => t
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/** Titre, image et site d'une page, d'après ses balises d'aperçu (Open Graph). */
export const ogTags = (html: string) => {
  const get = (p: string) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*>`, 'i'));
    const c = m && m[0].match(/content=["']([^"']*)["']/i);
    return c ? decodeEntities(c[1]).trim() : '';
  };
  const title = get('og:title') || get('twitter:title') || decodeEntities((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '').trim();
  return { title, image: get('og:image') || get('twitter:image'), site: get('og:site_name'), description: get('og:description') };
};
