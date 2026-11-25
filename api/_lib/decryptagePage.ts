import { frTypo } from '../../utils/articleText.js';
import { escapeHtml } from '../../utils/events.js';
import { OPEN_APP_HINT } from './openAppHint.js';

// Page publique d'un décryptage partagé (/d/AAAA-MM-JJ, 25/11) : le titre, un lecteur (jingle puis
// voix, servis par /api/articles?ecoute=DATE&audio=jingle|voix), les sujets, et l'invitation à
// rejoindre CKMoney. Pas de programme écrit (choix de Christian, 24/11 : à écouter seulement). Seulement un décryptage publié (jamais un brouillon), gardé 2 jours.

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dayFr = (date: string) => { const [y, m, d] = date.split('-').map(Number); return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : ''; };

export interface PublicDecryptage { date: string; title: string; minutes: number; subjects: { title: string; link: string }[] }

export const decryptagePage = (origin: string, date: string, d: PublicDecryptage | null): string => {
  const e = escapeHtml;
  const ok = !!d;
  const title = ok ? frTypo(d!.title) : 'Décryptage introuvable';
  const desc = ok ? `${d!.minutes} min à écouter · l'actualité décryptée par Christian Kamdem (CKLabs)` : "Ce décryptage n'est plus en ligne : chaque décryptage reste disponible deux jours.";
  const audio = (part: string) => `/api/articles?ecoute=${encodeURIComponent(date)}&audio=${part}`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(ok ? `Le décryptage · ${title}` : title)} · CKMoney</title>
<meta name="description" content="${e(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="CKMoney · CKLabs">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${e(ok ? `Le décryptage du ${dayFr(date)} : ${title}` : title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(`${origin}/d/${date}`)}">
<meta property="og:image" content="${e(`${origin}/og/evenement.png`)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E1533">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap" rel="stylesheet">
<style>
  :root { --ink:#0E1533; --night:#0E1533; --nightText:#F7F3EA; --nightMute:#A9B1D6; --mango:#FFC23D; --coral:#FF5C7A; --bg:#F5F3EE; --mute:#5B6285; --line:#ECEAE4; --ochreText:#7A4A00; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:'Manrope', system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:640px; margin:0 auto; padding:max(env(safe-area-inset-top),20px) 20px 0; }
  .brand { display:flex; align-items:center; justify-content:space-between; padding:6px 4px 18px; }
  .brand b { font-weight:800; letter-spacing:.06em; font-size:15px; }
  .brand b i { color:#F2A71B; font-style:normal; }
  .brand a { color:var(--ochreText); font-weight:700; font-size:14px; text-decoration:none; padding:10px 0 10px 12px; }
  .player { position:relative; overflow:hidden; background:var(--night); color:var(--nightText); border-radius:22px; padding:22px 20px 22px; }
  .player .sun { position:absolute; width:140px; height:140px; border-radius:50%; background:var(--mango); top:-76px; right:-50px; }
  .kick { position:relative; color:var(--mango); font-size:11.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
  h1 { position:relative; font-size:${title.length > 80 ? 20 : 22}px; line-height:1.28; font-weight:800; margin:8px 60px 0 0; }
  .meta { color:var(--nightMute); font-size:13.5px; margin-top:6px; }
  .row { display:flex; align-items:center; gap:14px; margin-top:20px; }
  .play { width:60px; height:60px; border-radius:50%; border:0; background:var(--mango); color:var(--ink); display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer; }
  .bar { height:5px; border-radius:5px; background:rgba(255,255,255,.16); overflow:hidden; }
  .bar i { display:block; height:100%; width:0; background:var(--mango); border-radius:5px; }
  .times { display:flex; justify-content:space-between; font-size:12px; color:var(--nightMute); margin-top:6px; }
  .grow { flex:1; min-width:0; }
  .subj { margin:22px 4px 0; }
  .subj div { color:var(--mute); font-size:12.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; margin-bottom:8px; }
  .subj p { margin:0; padding:11px 0; border-top:1px solid var(--line); font-size:15.5px; line-height:1.45; font-weight:600; }
  .cta { background:#fff; border-radius:18px; padding:20px; margin:26px 0 max(env(safe-area-inset-bottom),28px); }
  .cta h3 { margin:0; font-size:17px; line-height:1.3; font-weight:800; }
  .cta p { margin:6px 0 16px; color:var(--mute); font-size:14px; line-height:1.55; }
  .btn { display:flex; align-items:center; justify-content:center; height:52px; border-radius:14px; background:var(--ink); color:#fff; font-weight:800; font-size:16px; text-decoration:none; }
  .note { text-align:center; color:var(--mute); font-size:12.5px; margin-top:10px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><b>CK<i>·</i>MONEY</b><a id="open-app" href="${ok ? `/?decryptage=${e(date)}` : '/'}">Ouvrir l'appli</a></div>
  <div class="player">
    <span class="sun" aria-hidden="true"></span>
    <div class="kick">Le décryptage${ok ? ` · ${e(dayFr(date))}` : ''}</div>
    <h1>${e(title)}</h1>
    <div class="meta">${ok ? `${d!.minutes} min · par Christian · CKLabs` : e(desc)}</div>
    ${ok ? `<div class="row">
      <button class="play" id="play" aria-label="Écouter"><svg id="ico" width="22" height="22" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3.2v13.6L16.5 10z" fill="currentColor"/></svg></button>
      <div class="grow"><div class="bar"><i id="fill"></i></div><div class="times"><span id="t">0:00</span><span id="len">${d!.minutes}:00</span></div></div>
    </div>
    <audio id="a" preload="none"></audio>` : ''}
  </div>
  <div class="cta">
    <h3>Chaque matin sur CKMoney</h3>
    <p>Le décryptage du jour, l’info du jour, la revue de presse, les articles CKLabs, le mot du jour et les sorties entre amis.</p>
    <a class="btn" href="/">Rejoindre CKMoney</a>
    <div class="note">Gratuit · connexion avec Google ou un e-mail</div>
  </div>
</div>
${ok ? `<script>
(function(){
  var a=document.getElementById('a'),b=document.getElementById('play'),ico=document.getElementById('ico'),fill=document.getElementById('fill'),t=document.getElementById('t'),len=document.getElementById('len');
  var J='${audio('jingle')}',V='${audio('voix')}',phase='';
  var fmt=function(s){s=Math.floor(s||0);return Math.floor(s/60)+':'+('0'+s%60).slice(-2)};
  var icon=function(p){ico.innerHTML=p?'<rect x="4" y="3" width="4.5" height="14" rx="1.2" fill="currentColor"/><rect x="11.5" y="3" width="4.5" height="14" rx="1.2" fill="currentColor"/>':'<path d="M5.5 3.2v13.6L16.5 10z" fill="currentColor"/>'};
  b.onclick=function(){ if(!phase){phase='jingle';a.src=J;a.play().catch(function(){phase='voix';a.src=V;a.play()});return;} if(a.paused)a.play();else a.pause(); };
  a.onplay=function(){icon(true)}; a.onpause=function(){icon(false)};
  a.onerror=function(){ if(phase==='jingle'){phase='voix';a.src=V;a.play();} };
  a.onended=function(){ if(phase==='jingle'){phase='voix';a.src=V;a.play();} else icon(false); };
  a.onloadedmetadata=function(){ if(phase==='voix'&&isFinite(a.duration))len.textContent=fmt(a.duration); };
  a.ontimeupdate=function(){ if(phase!=='voix')return; t.textContent=fmt(a.currentTime); if(a.duration)fill.style.width=(100*a.currentTime/a.duration)+'%'; };
})();
</script>` : ''}
${OPEN_APP_HINT('le décryptage du jour est en haut de l’info du jour')}
</body>
</html>`;
};
