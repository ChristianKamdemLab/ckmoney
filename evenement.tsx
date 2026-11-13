import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Screen, Card, Skeleton, Icon, C } from './components/v2/ui';
import { EventDetail } from './components/v2/EventView';
import CKLogo from './components/brand/CKLogo';
import { AppEvent } from './utils/events';

// Page publique d'un événement (/e/ID, ou /evenement?id=ID) : s'ouvre sans compte et sans Firebase.
// En bas, un pont vers CKMoney pour les personnes qui ne connaissent pas encore l'appli.

const eventId = (() => {
  try {
    const m = window.location.pathname.match(/^\/e\/([A-Za-z0-9_-]{1,40})/);
    return (m?.[1] || new URLSearchParams(window.location.search).get('id') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  } catch { return ''; }
})();

const GAMES = [
  { href: '/jambo', label: 'Jambo' },
  { href: '/bac', label: 'Baccalauréat' },
  { href: '/wiseman', label: 'Le Wiseman' },
];

const Bridge: React.FC = () => (
  <div className="px-5 pt-8 pb-[max(env(safe-area-inset-bottom),28px)]">
    <div className="rounded-[22px] p-5" style={{ background: C.ink, color: '#fff' }}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-[14px] shrink-0" style={{ background: C.ochre, color: C.ink }}>CK</div>
        <div>
          <div className="text-[12px] font-semibold" style={{ color: C.ochre }}>Partagé avec CKMoney</div>
          <div className="text-[16px] font-bold leading-tight mt-0.5">L'appli CKLabs entre amis</div>
        </div>
      </div>
      <p className="text-[14px] leading-relaxed mt-3" style={{ color: 'rgba(255,255,255,.78)' }}>
        Des jeux à faire ensemble, chacun sur son téléphone, des articles, et les rendez-vous à ne pas manquer.
      </p>
      <div className="text-[12px] font-semibold mt-4 mb-2" style={{ color: 'rgba(255,255,255,.6)' }}>Jouer tout de suite, sans compte</div>
      <div className="flex gap-2 flex-wrap">
        {GAMES.map(g => (
          <a key={g.href} href={g.href} className="h-10 px-3.5 rounded-xl text-[14px] font-semibold flex items-center" style={{ background: 'rgba(255,255,255,.1)', color: '#fff' }}>{g.label}</a>
        ))}
      </div>
      <a href="/" className="mt-4 h-12 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold" style={{ background: C.ochre, color: C.ink }}>
        Découvrir l'appli <Icon name="arrow" size={18} />
      </a>
    </div>
  </div>
);

const Page: React.FC = () => {
  const [state, setState] = useState<{ k: 'loading' } | { k: 'ok'; e: AppEvent } | { k: 'missing' } | { k: 'error' }>({ k: 'loading' });
  useEffect(() => {
    if (!eventId) { setState({ k: 'missing' }); return; }
    fetch(`/api/events?id=${encodeURIComponent(eventId)}`)
      .then(async r => {
        if (r.status === 404) return setState({ k: 'missing' });
        if (!r.ok) throw new Error(String(r.status));
        const e = await r.json() as AppEvent;
        document.title = `${e.title} · CKMoney`;
        setState({ k: 'ok', e });
      })
      .catch(() => setState({ k: 'error' }));
  }, []);

  return (
    <Screen>
      <div className="px-5 pt-[max(env(safe-area-inset-top),18px)] pb-4 flex items-center justify-between">
        <a href="/" aria-label="CKMoney"><CKLogo size="sm" /></a>
        <span className="text-[12.5px] font-semibold" style={{ color: C.mute }}>Événement</span>
      </div>
      {state.k === 'loading' && <div className="px-5 flex flex-col gap-3"><Skeleton h={170} /><Skeleton h={150} /><Skeleton h={56} /></div>}
      {state.k === 'ok' && <EventDetail event={state.e} footer={<Bridge />} />}
      {(state.k === 'missing' || state.k === 'error') && (
        <>
          <div className="px-5">
            <Card className="px-5 py-8 text-center">
              <div className="text-[16px] font-semibold">{state.k === 'missing' ? "Cet événement n'est plus en ligne" : "La page n'a pas pu se charger"}</div>
              <div className="text-sm mt-1.5" style={{ color: C.mute }}>{state.k === 'missing' ? "Il a peut-être été retiré par la personne qui l'a partagé." : 'Vérifie ta connexion, puis recharge la page.'}</div>
            </Card>
          </div>
          <Bridge />
        </>
      )}
    </Screen>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
