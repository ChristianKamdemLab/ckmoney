// Installer CKMoney sur l'écran d'accueil (appli web) : détection du téléphone et du navigateur,
// et invite d'installation d'Android gardée dès le chargement de la page (elle n'arrive qu'une fois).

type Listener = () => void;
let deferred: any = null;
let installed = false;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(l => l());

export const initInstall = () => {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e: Event) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; emit(); });
};

export const onInstallChange = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const canPromptInstall = () => !!deferred;
export const wasInstalled = () => installed;

/** Ouvre la fenêtre d'installation d'Android (Chrome). Renvoie true si la personne a accepté. */
export const promptInstall = async () => {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  emit();
  return choice?.outcome === 'accepted';
};

export const isStandalone = () => {
  try { return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true; }
  catch { return false; }
};

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);
export const isIOS = () => /iphone|ipad|ipod/i.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /android/i.test(ua());
export const detectedPhone = (): 'iphone' | 'android' | null => (isIOS() ? 'iphone' : isAndroid() ? 'android' : null);

/** Navigateur sur iPhone : l'installation complète se fait dans Safari. */
export const iosBrowser = (): 'safari' | 'chrome' | 'autre' => {
  const u = ua();
  if (/CriOS/i.test(u)) return 'chrome';
  if (/FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Snapchat|GSA\/|Line\//i.test(u)) return 'autre';
  return 'safari';
};

/** Navigateur sur Android : Chrome propose l'installation en un geste. */
export const androidBrowser = (): 'chrome' | 'samsung' | 'autre' => {
  const u = ua();
  if (/SamsungBrowser/i.test(u)) return 'samsung';
  if (/; wv\)|FBAN|FBAV|Instagram|WhatsApp|Snapchat/i.test(u)) return 'autre';
  if (/Chrome\//.test(u) && !/Edg|OPR|YaBrowser|Firefox/i.test(u)) return 'chrome';
  return 'autre';
};

export const appUrl = () => `${window.location.origin}/`;
/** Ouvre l'adresse dans Safari depuis un autre navigateur ou une appli (iOS 17 et plus). */
export const safariLink = () => `x-safari-${appUrl()}`;
/** Ouvre l'adresse dans Chrome depuis un autre navigateur Android. */
export const chromeIntent = () => `intent://${window.location.host}/#Intent;scheme=https;package=com.android.chrome;end`;
