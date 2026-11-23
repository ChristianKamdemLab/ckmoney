import { parseBody, frTypo, Block } from '../../utils/articleText.js';
import { escapeHtml } from '../../utils/events.js';

// Page publique d'un article CKLabs (/a/ID) : ce qu'on partage par lien. L'article en entier, lisible
// sans connexion (choix de Christian, 23/11 : un lien s'ouvre dans le navigateur ou dans WhatsApp, jamais
// dans l'appli installée sur l'écran d'accueil, et redemander la connexion gênait les amis déjà inscrits).
// À la fin, l'invitation à rejoindre CKMoney. Les balises d'aperçu donnent le titre et l'accroche.
// Seulement les articles CKLabs publiés : jamais les fiches de revue de presse.

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dayFr = (iso?: string) => {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return '';
  const p = new Date(d.getTime() + 3600_000); // heure de Paris (à une heure près, pour la date seule)
  return `${p.getUTCDate()} ${MONTHS[p.getUTCMonth()]} ${p.getUTCFullYear()}`;
};

export const isShareable = (d: any) => !!d && d.status === 'published' && d.kind !== 'press';

export const articlePage = (origin: string, id: string, d: any | null): string => {
  const ok = isShareable(d);
  const title = ok ? frTypo(String(d.title || '')) : 'Article introuvable';
  const desc = ok ? String(d.excerpt || '') : "Cet article n'est plus en ligne.";
  const author = ok ? String(d.authorName || 'CKLabs') : '';
  const date = ok ? dayFr(d.publishedAt || d.updatedAt) : '';
  const e = escapeHtml;
  const blocks: Block[] = ok ? parseBody(String(d.body || '')) : [];
  // Les puces qui se suivent forment une liste
  const html: string[] = [];
  blocks.forEach((b, i) => {
    const t = e(frTypo(b.text));
    if (b.t === 'li') {
      if (blocks[i - 1]?.t !== 'li') html.push('<ul>');
      html.push(`<li>${t}</li>`);
      if (blocks[i + 1]?.t !== 'li') html.push('</ul>');
    } else html.push(b.t === 'h' ? `<h2>${t}</h2>` : `<p>${t}</p>`);
  });
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
  .text { padding-top:24px; font-size:17px; line-height:1.7; color:var(--text); }
  .text p { margin:0 0 18px; }
  .text > p:first-child { font-size:18px; line-height:1.65; }
  .text h2 { font-size:19px; line-height:1.35; color:var(--ink); margin:34px 0 12px; }
  .text ul { margin:0 0 18px; padding:0; list-style:none; }
  .text li { position:relative; padding-left:22px; margin:0 0 14px; }
  .text li::before { content:''; position:absolute; left:4px; top:.72em; width:6px; height:6px; border-radius:50%; background:var(--ochre); }
  .end { display:flex; justify-content:center; padding:8px 0 30px; }
  .end i { width:40px; height:3px; border-radius:3px; background:var(--ochre); }
  .cta { background:var(--ink); color:#fff; border-radius:18px; padding:22px 20px; margin-bottom:max(env(safe-area-inset-bottom),28px); }
  .cta h3 { margin:0; font-size:18px; line-height:1.3; font-weight:800; }
  .cta p { margin:8px 0 18px; color:rgba(255,255,255,.75); font-size:14.5px; line-height:1.55; }
  .btn { display:flex; align-items:center; justify-content:center; height:52px; border-radius:14px; background:var(--ochre); color:var(--ink); font-weight:800; font-size:16px; text-decoration:none; }
  .note { text-align:center; color:rgba(255,255,255,.6); font-size:12.5px; margin-top:10px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><b>CK<i>·</i>MONEY</b><a href="/">Ouvrir l'appli</a></div>
  <div class="kicker">CKLabs</div>
  <h1>${e(title)}</h1>
  ${ok ? `<div class="by"><strong>${e(author)}</strong>${date ? ` · ${e(date)}` : ''}${d.readMinutes ? ` · ${Number(d.readMinutes)} min de lecture` : ''}</div>` : `<div class="by">${e(desc)}</div>`}
  ${ok ? `<article class="text">${html.join('')}</article><div class="end"><i></i></div>` : '<div style="height:28px"></div>'}
  <div class="cta">
    <h3>${ok ? 'D’autres articles t’attendent sur CKMoney' : 'Découvre CKMoney'}</h3>
    <p>Les articles CKLabs, la revue de presse, le mot du jour, Radio CK et les sorties entre amis.</p>
    <a class="btn" href="/">Rejoindre CKMoney</a>
    <div class="note">Gratuit · connexion avec Google ou un e-mail</div>
  </div>
</div>
</body>
</html>`;
};
