import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const KEY = 'ckmoney_install_dismissed';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

/** Bandeau discret qui propose d'installer CKMoney sur l'écran d'accueil du téléphone. */
const InstallPrompt: React.FC = () => {
  const [deferred, setDeferred] = useState<any>(null);
  const [hidden, setHidden] = useState(() => {
    try { return isStandalone() || localStorage.getItem(KEY) === '1'; } catch { return isStandalone(); }
  });

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const onInstalled = () => setHidden(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };
  const ios = isIOS();
  if (hidden || (!deferred && !ios)) return null;

  return (
    <div className="no-print max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0" style={{ background: '#C98A1E' }}>CK</div>
        <div className="flex-1 text-sm">
          <p className="font-bold text-slate-900">Installer CKMoney sur ton téléphone</p>
          {ios ? (
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
              Dans Safari, touche <Share size={13} className="inline -mt-0.5" /> Partager, puis « Sur l'écran d'accueil ».
            </p>
          ) : (
            <p className="text-slate-500 text-xs mt-0.5">Elle s'ouvrira en plein écran, comme une appli.</p>
          )}
        </div>
        {deferred && (
          <button
            onClick={async () => { deferred.prompt(); await deferred.userChoice; setDeferred(null); dismiss(); }}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold flex items-center gap-1.5 shrink-0"
          >
            <Download size={14} /> Installer
          </button>
        )}
        <button onClick={dismiss} aria-label="Fermer" className="p-1 text-slate-400 hover:text-slate-700 shrink-0"><X size={16} /></button>
      </div>
    </div>
  );
};

export default InstallPrompt;
