// Retour « natif » : le bouton Retour d'Android, le retour du navigateur et un glissement depuis le
// bord gauche de l'écran (iPhone, appli installée) font la même chose que la flèche ← de l'écran.
// Chaque barre du haut avec une flèche s'inscrit ici ; la plus récente répond. Une seule entrée
// d'historique « sentinelle » est gardée tant qu'un écran a une flèche : depuis l'accueil, Retour
// quitte l'appli comme d'habitude.

type Handler = { fn: () => void };
const stack: Handler[] = [];
let installed = false;

const hasSentinel = () => { try { return !!(window.history.state && window.history.state.ckBack); } catch { return false; } };
const ensureSentinel = () => {
  try { if (stack.length && !hasSentinel()) window.history.pushState({ ckBack: 1 }, ''); } catch { /* ignore */ }
};

/** Déclenche le retour de l'écran courant ; renvoie false s'il n'y en a pas. */
export const goBack = () => {
  const h = stack[stack.length - 1];
  if (!h) return false;
  h.fn();
  return true;
};

const install = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', () => {
    if (goBack()) setTimeout(ensureSentinel, 50);
  });
  // Glissement depuis le bord gauche (24 px), surtout horizontal : seulement dans l'appli installée
  // (dans Safari ou Chrome, le navigateur fait déjà ce geste et déclenche popstate ci-dessus)
  const standalone = (() => { try { return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true; } catch { return false; } })();
  if (!standalone) return;
  let sx = 0, sy = 0, armed = false;
  window.addEventListener('touchstart', e => {
    const t = e.touches[0];
    armed = !!t && t.clientX <= 24 && stack.length > 0;
    if (armed) { sx = t.clientX; sy = t.clientY; }
  }, { passive: true });
  window.addEventListener('touchend', e => {
    if (!armed) return;
    armed = false;
    const t = e.changedTouches[0];
    if (t && t.clientX - sx > 80 && Math.abs(t.clientY - sy) < 60) goBack();
  }, { passive: true });
};

/** À appeler par un écran qui a une flèche ← ; renvoie la fonction de désinscription. */
export const registerBack = (fn: () => void) => {
  install();
  const h: Handler = { fn };
  stack.push(h);
  ensureSentinel();
  return () => { const i = stack.indexOf(h); if (i >= 0) stack.splice(i, 1); };
};
