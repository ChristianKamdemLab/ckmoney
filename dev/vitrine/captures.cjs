// Captures de la vitrine (données inventées) pour l'agent UX et ergonomie.
// Usage : npx vite --config dev/vitrine/vite.config.ts &   puis   node dev/vitrine/captures.cjs <dossier>
// Pour chaque écran : une capture à l'ouverture (60 ms), une une fois chargé, et des mesures :
// décalage de mise en page (CLS), boutons trop petits (< 40 px), textes qui débordent de l'écran.
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2] || 'captures-ux';
const BASE = 'http://127.0.0.1:5179/dev/vitrine/index.html?v=';
const SCREENS = [
  ['accueil', 'shell'], ['actu', 'shell&tab=actu'], ['podcasts', 'shell&tab=podcasts'], ['prets', 'shell&tab=loans'],
  ['entre-amis', 'shell&tab=amis'], ['profil', 'shell&tab=profile'], ['article', 'reada0'], ['fiche-presse', 'readp1'],
  ['info-du-jour', 'info'], ['evenements', 'events'], ['films', 'films'], ['mot-du-jour', 'mot'], ['fiche-pret', 'pm-late'],
  ['nouveau-pret', 'lend'], ['espace-ami', 'friend-active'], ['connexion', 'auth'],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const report = [];
  for (const [name, v] of SCREENS) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    await ctx.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    try {
      await p.goto(BASE + v);
      await p.waitForTimeout(60);
      await p.screenshot({ path: `${out}/${name}-0-ouverture.png` });
      await p.waitForTimeout(2500);
      await p.screenshot({ path: `${out}/${name}-1-charge.png`, fullPage: true });
      const m = await p.evaluate(() => {
        const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const label = el => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        const small = [...document.querySelectorAll('button, a, [role=button], input, select')].filter(vis)
          .map(el => ({ el, r: el.getBoundingClientRect() })).filter(x => x.r.height < 40 || x.r.width < 40)
          .map(x => `${label(x.el) || x.el.tagName} (${Math.round(x.r.width)}×${Math.round(x.r.height)})`);
        const overflow = [...document.querySelectorAll('body *')].filter(vis).filter(el => { const r = el.getBoundingClientRect(); if (r.right <= innerWidth + 1 || el.closest('[class*=overflow-x]')) return false;
          // Coupé par un parent (overflow hidden) qui tient dans l'écran : rien ne dépasse à l'œil
          for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (/hidden|clip/.test(s.overflow + s.overflowX) && a.getBoundingClientRect().right <= innerWidth + 1) return false; }
          return true; })
          .slice(0, 8).map(el => label(el) || el.tagName);
        return { cls: Math.round(window.__cls * 1000) / 1000, petitsBoutons: [...new Set(small)].slice(0, 15), debordements: [...new Set(overflow)] };
      });
      report.push({ ecran: name, ...m, erreurs: errors });
    } catch (e) {
      report.push({ ecran: name, erreurs: [String(e.message || e).slice(0, 200)] });
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(`${out}/mesures.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
