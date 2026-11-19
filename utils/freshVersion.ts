// L'appli installée sur un téléphone peut rester ouverte en mémoire pendant des jours et garder une
// ancienne version (constaté le 19/11 : l'exemple « Charles André », retiré le 13/11, encore affiché).
// Quand l'appli revient au premier plan, on compare le script principal de la page en ligne avec celui
// qui tourne ; s'il a changé, on recharge, sauf si la personne est en train d'écrire.

const currentScript = () =>
  [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map(s => new URL(s.src, location.href).pathname).find(p => p.includes('/assets/')) || '';

export const scriptOf = (html: string) => html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/)?.[1] || '';

export const watchForNewVersion = () => {
  if (typeof window === 'undefined' || import.meta.env.DEV) return;
  let last = 0;
  const check = async () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < 60_000) return;
    last = Date.now();
    try {
      const html = await (await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })).text();
      const online = scriptOf(html);
      const running = currentScript();
      const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (online && running && online !== running && !typing) location.reload();
    } catch { /* hors ligne : on réessaiera */ }
  };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  void check();
};
