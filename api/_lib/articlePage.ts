import { parseBody, frTypo } from '../../utils/articleText.js';
import { escapeHtml } from '../../utils/events.js';

// Page publique d'un article CKLabs (/a/ID) : ce qu'on partage par lien. Titre, auteur, date et le
// début du texte (pas l'article entier) ; « Lire la suite » ouvre l'appli, qui demande de se connecter
// puis ouvre l'article. Les balises d'aperçu donnent le titre et l'accroche dans WhatsApp, iMessage…
// Seulement les articles CKLabs publiés : jamais les fiches de revue de presse.

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dayFr = (iso?: string) => {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return '';
  const p = new Date(d.getTime() + 3600_000); // heure de Paris (à une heure près, pour la date seule)
  return `${p.getUTCDate()} ${MONTHS[p.getUTCMonth()]} ${p.getUTCFullYear()}`;
};

/** Le début de l'article : les premiers paragraphes, environ 650 caractères, sans couper une phrase. */
export const teaserOf = (body: string, max = 650): string[] => {
  const out: string[] = [];
  let n = 0;
  for (const b of parseBody(body)) {
    if (b.t === 'h') continue;
    const t = frTypo(b.text);
    if (n && n + t.length > max) break;
    if (!n && t.length > max) {
      const cut = t.slice(0, max);
      const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
      out.push(end > 200 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`);
      break;
    }
    out.push(b.t === 'li' ? `• ${t}` : t);
    n += t.length;
    if (out.length >= 3) break;
  }
  return out;
};

export const isShareable = (d: any) => !!d && d.status === 'published' && d.kind !== 'press';

export const articlePage = (origin: string, id: string, d: any | null): string => {
  const ok = isShareable(d);
  const title = ok ? frTypo(String(d.title || '')) : 'Article introuvable';
  const desc = ok ? String(d.excerpt || '') : "Cet article n'est plus en ligne.";
  const author = ok ? String(d.authorName || 'CKLabs') : '';
  const date = ok ? dayFr(d.publishedAt || d.updatedAt) : '';
  const appUrl = ok ? `/?article=${encodeURIComponent(id)}` : '/';
  const e = escapeHtml;
  const paras = ok ? teaserOf(String(d.body || '')) : [];
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(title)} · CKLabs</title>
<meta name="description" content="${e(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="CKMoney · CKLabs">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(`${origin}/a/${id}`)}">
<meta property="og:image" content="${e(`${origin}/og/evenement.png`)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E1533">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap" rel="stylesheet">
<style>
  :root { --ink:#0E1533; --text:#22263A; --mute:#6E748C; --ochre:#F2A71B; --ochreText:#7A4A00; --bg:#F5F3EE; --line:#E4E0D6; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:'Manrope', system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:640px; margin:0 auto; padding:max(env(safe-area-inset-top),20px) 24px 0; }
  .brand { display:flex; align-items:center; justify-content:space-between; padding:6px 0 22px; }
  .brand b { font-weight:800; letter-spacing:.06em; font-size:15px; }
  .brand b i { color:var(--ochre); font-style:normal; }
  .brand a { color:var(--ochreText); font-weight:700; font-size:14px; text-decoration:none; padding:10px 0 10px 12px; }
  .kicker { color:var(--ochreText); font-size:13px; font-weight:700; }
  h1 { font-size:${title.length > 90 ? 22 : title.length > 55 ? 24 : 27}px; line-height:1.28; font-weight:800; letter-spacing:-.2px; margin:8px 0 0; }
  .by { color:var(--mute); font-size:14px; margin-top:14px; padding-bottom:22px; border-bottom:1px solid var(--line); }
  .by strong { color:var(--ink); font-weight:600; }
  .text { position:relative; padding-top:24px; font-size:17px; line-height:1.7; color:var(--text); }
  .text p { margin:0 0 18px; }
  .text p:first-child { font-size:18px; line-height:1.65; }
  .fade { position:absolute; left:0; right:0; bottom:0; height:120px; background:linear-gradient(rgba(245,243,238,0), var(--bg)); }
  .cta { position:sticky; bottom:0; background:linear-gradient(rgba(245,243,238,0), var(--bg) 22%); padding:26px 0 max(env(safe-area-inset-bottom),22px); }
  .btn { display:flex; align-items:center; justify-content:center; height:54px; border-radius:14px; background:var(--ink); color:#fff; font-weight:700; font-size:16px; text-decoration:none; }
  .note { text-align:center; color:var(--mute); font-size:13px; margin-top:10px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><b>CK<i>·</i>MONEY</b><a href="${e(appUrl)}">Ouvrir l'appli</a></div>
  <div class="kicker">CKLabs</div>
  <h1>${e(title)}</h1>
  ${ok ? `<div class="by"><strong>${e(author)}</strong>${date ? ` · ${e(date)}` : ''}${d.readMinutes ? ` · ${Number(d.readMinutes)} min de lecture` : ''}</div>` : `<div class="by">${e(desc)}</div>`}
  ${ok ? `<div class="text">${paras.map(p => `<p>${e(p)}</p>`).join('')}<div class="fade"></div></div>` : ''}
  <div class="cta">
    <a class="btn" href="${e(appUrl)}">${ok ? 'Lire la suite sur CKMoney' : 'Découvrir CKMoney'}</a>
    <div class="note">Gratuit · connexion avec Google ou un e-mail</div>
  </div>
</div>
</body>
</html>`;
};
