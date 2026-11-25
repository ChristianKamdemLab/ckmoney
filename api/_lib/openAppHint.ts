// Pages publiques (/a/, /d/) : sur iPhone, l'appli posée sur l'écran d'accueil et Safari ne partagent
// pas la connexion, et un lien ne peut pas ouvrir l'appli. « Ouvrir l'appli » y affiche donc une
// petite fenêtre qui l'explique, au lieu d'emmener vers une page de connexion (retour du 25/11).
// Sur Android, l'appli installée et Chrome partagent la connexion : le lien suffit.
export const OPEN_APP_HINT = (what: string) => `
<style>
  .hint { position:fixed; inset:0; background:rgba(14,21,51,.45); display:none; align-items:flex-end; justify-content:center; z-index:9; }
  .hint.on { display:flex; }
  .hint > div { background:#fff; width:100%; max-width:520px; border-radius:22px 22px 0 0; padding:22px 20px max(env(safe-area-inset-bottom),22px); }
  .hint h3 { margin:0; font-size:18px; font-weight:800; }
  .hint p { margin:8px 0 18px; color:#5B6285; font-size:14.5px; line-height:1.55; }
  .hint button, .hint a { display:flex; align-items:center; justify-content:center; width:100%; height:50px; border-radius:14px; font:inherit; font-weight:800; font-size:15.5px; text-decoration:none; border:0; }
  .hint button { background:#0E1533; color:#fff; }
  .hint a { color:#5B6285; font-weight:700; margin-top:6px; }
</style>
<div class="hint" id="hint" role="dialog" aria-modal="true"><div>
  <h3>Tu as déjà l’appli ?</h3>
  <p>Sur iPhone, ouvre CKMoney depuis ton écran d’accueil : ${what}. Ici, tu peux continuer sans compte.</p>
  <button id="hint-ok">Continuer ici</button>
  <a id="hint-go" href="/">Me connecter dans le navigateur</a>
</div></div>
<script>
(function(){
  var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var standalone=window.navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
  var link=document.getElementById('open-app'),hint=document.getElementById('hint');
  if(!ios||standalone||!link||!hint)return;
  document.getElementById('hint-go').href=link.getAttribute('href');
  link.addEventListener('click',function(ev){ev.preventDefault();hint.classList.add('on');});
  document.getElementById('hint-ok').onclick=function(){hint.classList.remove('on');};
  hint.addEventListener('click',function(ev){if(ev.target===hint)hint.classList.remove('on');});
})();
</script>`;
