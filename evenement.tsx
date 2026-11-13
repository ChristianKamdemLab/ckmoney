import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Screen, Card, Skeleton, Icon, Sheet, Button, Field, inputClass, inputStyle, C } from './components/v2/ui';
import { EventDetail } from './components/v2/EventView';
import CKLogo from './components/brand/CKLogo';
import { AppEvent, cleanName } from './utils/events';
import { guestGoing, guestName, guestRsvp } from './services/guestRsvp';

// Page publique d'une sortie (/e/ID, ou /evenement?id=ID) : s'ouvre sans compte et sans Firebase.
// Pour un chill, on répond « Je viens » avec son prénom (seul l'organisateur voit qui vient).
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

/** « Je viens » sans compte : on demande le prénom une fois, le navigateur s'en souvient. */
const useGuestRsvp = (e: AppEvent | null, onPlaces: (n: number | null) => void) => {
  const [going, setGoing] = useState(() => (e ? guestGoing(e.id) : false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const [name, setName] = useState(guestName());
  useEffect(() => { if (e) setGoing(guestGoing(e.id)); }, [e?.id]);
  const send = async (g: boolean, who = name) => {
    if (!e) return;
    if (g && !cleanName(who)) { setAsk(true); return; }
    setBusy(true); setError(null);
    try { const r = await guestRsvp(e.id, g, cleanName(who)); setGoing(r.going); onPlaces(r.placesLeft); setAsk(false); }
    catch (err) { setError((err as Error).message === 'complet' ? "C'est complet." : "Ça n'a pas marché. Réessaie."); setAsk(false); }
    finally { setBusy(false); }
  };
  const sheet = (
    <Sheet open={ask} onClose={() => setAsk(false)} title="Ton prénom">
      <p className="text-[14.5px] leading-relaxed mb-4" style={{ color: C.text2 }}>Pour que {e?.organizer || "l'organisateur"} sache qui vient.</p>
      <form onSubmit={ev => { ev.preventDefault(); send(true, name); }} className="flex flex-col gap-3">
        <Field label="Prénom" htmlFor="gn"><input id="gn" autoFocus autoComplete="given-name" value={name} onChange={ev => setName(ev.target.value)} maxLength={40} className={inputClass} style={inputStyle} /></Field>
        <Button type="submit" busy={busy} disabled={!cleanName(name)}>Je viens</Button>
      </form>
    </Sheet>
  );
  return { rsvp: { going, busy, error, onChange: (g: boolean) => send(g) }, sheet };
};

const Page: React.FC = () => {
  const [state, setState] = useState<{ k: 'loading' } | { k: 'ok'; e: AppEvent } | { k: 'missing' } | { k: 'error' }>({ k: 'loading' });
  const ev = state.k === 'ok' ? state.e : null;
  const guest = useGuestRsvp(ev, n => setState(s => (s.k === 'ok' ? { k: 'ok', e: { ...s.e, placesLeft: n } } : s)));
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
        <span className="text-[12.5px] font-semibold" style={{ color: C.mute }}>{ev ? ({ event: 'Événement', spot: 'Spot', chill: 'Chill' } as const)[ev.kind] : 'Sortie'}</span>
      </div>
      {state.k === 'loading' && <div className="px-5 flex flex-col gap-3"><Skeleton h={170} /><Skeleton h={150} /><Skeleton h={56} /></div>}
      {state.k === 'ok' && <EventDetail event={state.e} rsvp={state.e.kind === 'chill' ? guest.rsvp : undefined} footer={<Bridge />} />}
      {guest.sheet}
      {(state.k === 'missing' || state.k === 'error') && (
        <>
          <div className="px-5">
            <Card className="px-5 py-8 text-center">
              <div className="text-[16px] font-semibold">{state.k === 'missing' ? "Cette sortie n'est plus en ligne" : "La page n'a pas pu se charger"}</div>
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
