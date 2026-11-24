import { adminDb } from './admin.js';

// Veille des médias reconnus, pour les agents « Info du jour » et « Décryptage du jour » : les titres et
// chapôs publiés par leurs flux RSS (faits pour être repris), sur les 36 dernières heures. Les outils de
// lecture des agents ne peuvent pas ouvrir plusieurs de ces sites (RFI, Le Monde, France 24…) ; le
// serveur de l'appli, lui, lit leurs flux. Jamais le texte des articles : titre, chapô court, lien, date.
// Mis en cache 15 minutes (Firestore settings/veille).

export interface Feed { media: string; zone: 'monde' | 'afrique' | 'cameroun'; url: string }

export const FEEDS: Feed[] = [
  // Monde
  { media: 'Le Monde', zone: 'monde', url: 'https://www.lemonde.fr/rss/une.xml' },
  { media: 'franceinfo', zone: 'monde', url: 'https://www.francetvinfo.fr/titres.rss' },
  { media: 'France 24', zone: 'monde', url: 'https://www.france24.com/fr/rss' },
  { media: 'RFI', zone: 'monde', url: 'https://www.rfi.fr/fr/rss' },
  { media: 'Le Figaro', zone: 'monde', url: 'https://www.lefigaro.fr/rss/figaro_international.xml' },
  { media: 'BBC News', zone: 'monde', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { media: 'The Guardian', zone: 'monde', url: 'https://www.theguardian.com/world/rss' },
  { media: 'Al Jazeera', zone: 'monde', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { media: 'Euronews', zone: 'monde', url: 'https://fr.euronews.com/rss' },
  // Demandés par Christian (24/11) : Reuters, Les Echos, Financial Times, AFP, Africa Intelligence
  { media: 'Reuters', zone: 'monde', url: 'https://www.reutersagency.com/feed/?best-topics=top-news&post_type=best' },
  { media: 'Les Echos', zone: 'monde', url: 'https://services.lesechos.fr/rss/les-echos-monde.xml' },
  { media: 'Les Echos Économie', zone: 'monde', url: 'https://services.lesechos.fr/rss/les-echos-economie.xml' },
  { media: 'Financial Times', zone: 'monde', url: 'https://www.ft.com/world?format=rss' },
  { media: 'AFP', zone: 'monde', url: 'https://www.afp.com/fr/rss' },
  { media: 'TV5Monde (AFP)', zone: 'monde', url: 'https://information.tv5monde.com/rss.xml' },
  { media: 'Africa Intelligence', zone: 'afrique', url: 'https://www.africaintelligence.fr/rss' },
  // Afrique
  { media: 'RFI Afrique', zone: 'afrique', url: 'https://www.rfi.fr/fr/afrique/rss' },
  { media: 'Le Monde Afrique', zone: 'afrique', url: 'https://www.lemonde.fr/afrique/rss_full.xml' },
  { media: 'France 24 Afrique', zone: 'afrique', url: 'https://www.france24.com/fr/afrique/rss' },
  { media: 'BBC Afrique', zone: 'afrique', url: 'https://feeds.bbci.co.uk/afrique/rss.xml' },
  { media: 'Jeune Afrique', zone: 'afrique', url: 'https://www.jeuneafrique.com/feed/' },
  { media: 'Africanews', zone: 'afrique', url: 'https://fr.africanews.com/feed/rss' },
  { media: 'Agence Ecofin', zone: 'afrique', url: 'https://www.agenceecofin.com/?format=feed&type=rss' },
  { media: 'The Africa Report', zone: 'afrique', url: 'https://www.theafricareport.com/feed/' },
  // Cameroun
  { media: 'Investir au Cameroun', zone: 'cameroun', url: 'https://www.investiraucameroun.com/?format=feed&type=rss' },
  { media: 'Business in Cameroon', zone: 'cameroun', url: 'https://www.businessincameroon.com/?format=feed&type=rss' },
  { media: 'Actu Cameroun', zone: 'cameroun', url: 'https://actucameroun.com/feed/' },
  { media: 'Journal du Cameroun', zone: 'cameroun', url: 'https://www.journalducameroun.com/feed/' },
  { media: 'Mimi Mefo Info', zone: 'cameroun', url: 'https://mimimefoinfos.com/feed/' },
  { media: 'CRTV', zone: 'cameroun', url: 'https://www.crtv.cm/feed/' },
  { media: 'Cameroon Tribune', zone: 'cameroun', url: 'https://www.cameroon-tribune.cm/rss.xml' },
  { media: 'Data Cameroon', zone: 'cameroun', url: 'https://datacameroon.com/feed/' },
];

export interface VeilleItem { media: string; zone: Feed['zone']; title: string; link: string; date: string; desc: string }

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
export const clean = (s: string) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ').trim();

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

/** Les articles d'un flux RSS 2.0 ou Atom : titre, lien, date, chapô (300 caractères au plus). */
export const parseFeed = (xml: string, feed: Feed): VeilleItem[] => {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const out: VeilleItem[] = [];
  for (const b of blocks) {
    const title = clean(tag(b, 'title'));
    let link = clean(tag(b, 'link'));
    if (!/^https?:/.test(link)) link = (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '';
    const rawDate = clean(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const d = new Date(rawDate);
    const desc = clean(tag(b, 'description') || tag(b, 'summary')).slice(0, 300);
    if (!title || !/^https:\/\//.test(link)) continue;
    out.push({ media: feed.media, zone: feed.zone, title: title.slice(0, 200), link: link.slice(0, 400), date: Number.isNaN(d.getTime()) ? '' : d.toISOString(), desc });
  }
  return out;
};

const fetchFeed = async (feed: Feed): Promise<{ items: VeilleItem[]; status: string }> => {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(feed.url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CKMoney-veille/1.0; +https://ck-money.vercel.app)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
    clearTimeout(timer);
    if (!r.ok) return { items: [], status: `HTTP ${r.status}` };
    const items = parseFeed((await r.text()).slice(0, 2_000_000), feed);
    return { items, status: items.length ? 'ok' : 'vide' };
  } catch (e: any) { return { items: [], status: e?.name === 'AbortError' ? 'délai dépassé' : 'erreur' }; }
};

/** Les articles des 36 dernières heures, du plus récent au plus ancien, et l'état de chaque flux. */
export const veille = async (now = Date.now()) => {
  const ref = adminDb.collection('settings').doc('veille');
  const cached = (await ref.get()).data();
  if (cached && now - Number(cached.at || 0) < 15 * 60_000) return JSON.parse(cached.json);
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const since = now - 36 * 3600_000;
  const seen = new Set<string>();
  const items = results.flatMap(r => r.items)
    .filter(i => !i.date || Date.parse(i.date) >= since)
    .filter(i => (seen.has(i.link) ? false : (seen.add(i.link), true)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 400);
  const feeds = FEEDS.map((f, k) => ({ media: f.media, zone: f.zone, status: results[k].status, count: results[k].items.length }));
  const body = { updatedAt: new Date(now).toISOString(), feeds, items };
  const json = JSON.stringify(body);
  if (json.length < 900_000) await ref.set({ at: now, json }).catch(() => undefined);
  return body;
};
