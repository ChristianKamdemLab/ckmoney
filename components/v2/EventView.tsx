import React, { useState } from 'react';
import { AppEvent, whenText, shortWhen, dayBlock, mapsUrl, googleCalendarUrl, isUpcoming, isLive, untilText, shareText, hostOf, KIND_LABEL } from '../../utils/events';
import { Card, Button, Sheet, Note, Icon, IconName, Toast, C } from './ui';
import { detectedPhone, isStandalone } from '../../services/install';

// Fiche d'une sortie (événement, spot, chill), commune à l'appli et à la page publique /e/ID
// (sans compte, sans Firebase). Pas de liste de participants visible : seul l'auteur sait qui vient.

export const shareLink = (id: string) => `${window.location.origin}/e/${id}`;
const icsLink = (id: string) => `${window.location.origin}/api/events?ics=${encodeURIComponent(id)}`;

const open = (url: string, sameTab = false) => {
  if (sameTab && !isStandalone()) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
};

/** Pavé de date : « 4 DÉC. » */
export const DateBlock: React.FC<{ iso: string; tone?: 'ink' | 'soft' }> = ({ iso, tone = 'ink' }) => {
  const d = dayBlock(iso);
  const dark = tone === 'ink';
  return (
    <div className="w-[54px] shrink-0 rounded-xl overflow-hidden text-center" style={{ background: dark ? C.ink : C.ochreSoft }} aria-hidden="true">
      <div className="text-[10.5px] font-bold uppercase tracking-wide pt-1.5" style={{ color: dark ? C.ochre : C.ochreText }}>{d.month}</div>
      <div className="serif text-[24px] font-semibold leading-none pb-2 pt-0.5" style={{ color: dark ? '#fff' : C.ink }}>{d.day}</div>
    </div>
  );
};

/** Pastille « En ce moment » qui pulse. */
export const LiveDot: React.FC<{ color?: string }> = ({ color = '#2E8B62' }) => (
  <span className="relative inline-flex w-2 h-2" aria-hidden="true">
    <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: color }} />
    <span className="relative w-2 h-2 rounded-full" style={{ background: color }} />
  </span>
);

const Tag: React.FC<{ children: React.ReactNode; tone?: 'green' | 'soft' | 'ochre' }> = ({ children, tone = 'soft' }) => {
  const t = { green: [C.greenSoft, C.green], soft: [C.soft, C.ink], ochre: [C.ochreSoft, C.ochreText] }[tone];
  return <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: t[0], color: t[1] }}>{children}</span>;
};

/** Ligne de liste. `note` : petite précision pour l'auteur (qui la voit, combien viennent). */
export const EventRow: React.FC<{ event: AppEvent; onOpen: () => void; past?: boolean; note?: string }> = ({ event: e, onOpen, past, note }) => {
  const live = !past && isLive(e);
  const free = /gratuit/i.test(e.price);
  return (
    <button onClick={onOpen} className="w-full text-left flex items-center gap-3.5 px-4 py-3.5" style={{ opacity: past ? 0.6 : 1 }}>
      <DateBlock iso={e.startsAt} tone={past ? 'soft' : 'ink'} />
      <div className="flex-1 min-w-0">
        <div className="serif text-[17px] font-semibold leading-snug">{e.title}</div>
        <div className="text-[13px] mt-0.5 truncate" style={{ color: C.mute }}>{[live ? `En ce moment, ${untilText(e)}` : shortWhen(e), e.venue].filter(Boolean).join(' · ')}</div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {live && <Tag tone="green"><LiveDot color={C.green} /> En ce moment</Tag>}
          {e.kind !== 'event' && !live && <Tag tone="ochre">{KIND_LABEL[e.kind]}</Tag>}
          {e.kind === 'chill' && e.meGoing && <Tag tone="green">Tu viens</Tag>}
          {e.price && <Tag tone={free ? 'green' : 'soft'}>{e.price}</Tag>}
          {note && <span className="text-[11.5px] font-semibold self-center" style={{ color: C.mute }}>{note}</span>}
        </div>
      </div>
      <Icon name="chevron" size={18} />
    </button>
  );
};

const Row: React.FC<{ icon: IconName; children: React.ReactNode; onClick?: () => void; first?: boolean }> = ({ icon, children, onClick, first }) => {
  const inner = (
    <>
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.soft, color: C.ink }}><Icon name={icon} size={18} /></span>
      <div className="flex-1 min-w-0 text-[15px] leading-snug">{children}</div>
      {onClick && <span style={{ color: C.mute }}><Icon name="chevron" size={18} /></span>}
    </>
  );
  const cls = 'w-full text-left flex items-center gap-3 px-4 py-3.5';
  const style = { borderTop: first ? undefined : `1px solid ${C.line}` };
  return onClick ? <button onClick={onClick} className={cls} style={style}>{inner}</button> : <div className={cls} style={style}>{inner}</div>;
};
const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="text-[13.5px] mt-0.5" style={{ color: C.mute }}>{children}</div>;

const Action: React.FC<{ icon: IconName; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="flex-1 rounded-2xl py-3 flex flex-col items-center gap-1.5 text-[13px] font-semibold" style={{ background: C.card, color: C.ink }}>
    <Icon name={icon} size={21} />{label}
  </button>
);

export type RsvpState = { going: boolean; busy?: boolean; error?: string | null; onChange: (going: boolean) => void };

export const EventDetail: React.FC<{ event: AppEvent; rsvp?: RsvpState; extra?: React.ReactNode; footer?: React.ReactNode }> = ({ event: e, rsvp, extra, footer }) => {
  const [agenda, setAgenda] = useState(false);
  const [share, setShare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const upcoming = isUpcoming(e);
  const live = isLive(e);
  const link = shareLink(e.id);
  const free = /gratuit/i.test(e.price);
  const site = hostOf(e.url);
  const hasPlace = !!(e.venue || e.address);
  const full = e.placesLeft === 0 && !rsvp?.going;

  const doShare = async () => {
    const data = { title: e.title, text: shareText(e), url: link };
    if (typeof navigator.share === 'function') {
      try { await navigator.share(data); return; }
      catch (err) { if ((err as Error)?.name === 'AbortError') return; }
    }
    setShare(true);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${shareText(e)}\n${link}`); setToast('Lien copié'); }
    catch { setToast('Copie impossible : sélectionne le lien'); }
    setShare(false);
  };

  const phone = detectedPhone();
  const agendaOptions = [
    { id: 'ics', label: phone === 'android' ? 'Fichier agenda (.ics)' : "Agenda de l'iPhone ou Outlook", go: () => open(icsLink(e.id), true) },
    { id: 'google', label: 'Google Agenda', go: () => open(googleCalendarUrl(e, link)) },
  ];
  if (phone === 'android') agendaOptions.reverse();
  const showAgenda = upcoming && !(e.kind === 'spot' && live);

  return (
    <>
      <div className="px-5 pt-1">
        <div className="rounded-[22px] p-5 pt-4" style={{ background: C.ink, color: '#fff' }}>
          <div className="flex items-center gap-2 flex-wrap">
            {live ? (
              <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ background: 'rgba(46,139,98,.25)', color: '#7FD4AE' }}><LiveDot color="#7FD4AE" /> En ce moment</span>
            ) : (
              <span className="text-[12px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ background: 'rgba(201,138,30,.18)', color: C.ochre }}>{shortWhen(e)}</span>
            )}
            {e.kind !== 'event' && <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>{KIND_LABEL[e.kind]}</span>}
            {e.price && <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: free ? '#2E8B62' : 'rgba(255,255,255,.12)', color: '#fff' }}>{e.price}</span>}
          </div>
          <h1 className="serif text-[28px] leading-[1.14] font-semibold tracking-[-0.3px] mt-4">{e.title}</h1>
          {e.organizer && <div className="text-[14px] mt-2" style={{ color: 'rgba(255,255,255,.72)' }}>{e.kind === 'event' ? 'Par' : 'Avec'} {e.organizer}</div>}
          {e.kind === 'event' && e.by && <div className="text-[12.5px] mt-1" style={{ color: 'rgba(255,255,255,.55)' }}>Partagé par {e.by}</div>}
        </div>
      </div>

      <div className="px-5 pt-3">
        <Card>
          <Row icon="calendar" first>{live ? <>En ce moment, {untilText(e)}</> : whenText(e)}</Row>
          {hasPlace && (
            <Row icon="pin" onClick={() => open(mapsUrl(e))}>
              <div className="font-semibold">{e.venue || e.address}</div>
              {e.venue && e.address && <Sub>{e.address}</Sub>}
            </Row>
          )}
          {e.kind === 'chill' && e.theme && <Row icon="chat"><Sub>Thème de discussion</Sub><div className="font-semibold">{e.theme}</div></Row>}
          {e.kind === 'chill' && e.drinks && <Row icon="glass"><Sub>À boire</Sub><div className="font-semibold">{e.drinks}</div></Row>}
          {e.kind === 'chill' && e.capacity && (
            <Row icon="users"><div className="font-semibold">{e.placesLeft === 0 ? 'Complet' : `Plus que ${e.placesLeft} place${(e.placesLeft || 0) > 1 ? 's' : ''}`}</div><Sub>{e.capacity} places en tout</Sub></Row>
          )}
          {e.kind === 'event' && (e.price || site) && (
            <Row icon="ticket">
              <div className="font-semibold">{free ? 'Entrée gratuite' : e.price}</div>
              {site && <Sub>Réservation sur {site}</Sub>}
            </Row>
          )}
        </Card>
      </div>

      <div className="px-5 pt-3 flex flex-col gap-2.5">
        {e.kind === 'event' && upcoming && e.url && <Button onClick={() => open(e.url)}><Icon name="ticket" size={20} /> {free ? 'Réserver ma place' : 'Prendre ma place'}</Button>}
        {e.kind === 'chill' && upcoming && rsvp && (
          rsvp.going ? (
            <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: C.greenSoft, color: C.green }}>
              <Icon name="check" size={22} />
              <div className="flex-1 text-[15px] font-bold">Tu viens. À très vite !</div>
              <button onClick={() => rsvp.onChange(false)} disabled={rsvp.busy} className="text-[13.5px] font-semibold underline underline-offset-2 disabled:opacity-50" style={{ color: C.green }}>Je ne viens plus</button>
            </div>
          ) : (
            <Button busy={rsvp.busy} disabled={full} onClick={() => rsvp.onChange(true)}><Icon name="check" size={20} /> {full ? 'Complet' : 'Je viens'}</Button>
          )
        )}
        {rsvp?.error && <Note tone="danger">{rsvp.error}</Note>}
        <div className="flex gap-2.5">
          {showAgenda && <Action icon="calendar" label="Agenda" onClick={() => setAgenda(true)} />}
          {hasPlace && <Action icon="pin" label="Itinéraire" onClick={() => open(mapsUrl(e))} />}
          <Action icon="share" label="Partager" onClick={doShare} />
        </div>
        {!upcoming && <Note tone="info" icon="clock">{e.kind === 'spot' ? 'Ce spot est terminé.' : e.kind === 'chill' ? 'Ce chill est terminé.' : 'Cet événement est terminé.'}</Note>}
      </div>

      {extra}

      {e.description && (
        <div className="px-6 pt-6">
          <div className="text-[13px] font-semibold mb-2" style={{ color: C.mute }}>{e.kind === 'spot' ? 'Le petit mot' : 'À propos'}</div>
          {e.description.split(/\n+/).filter(Boolean).map((p, i) => (
            <p key={i} className="text-[15.5px] leading-[1.6] mb-3" style={{ color: C.text2 }}>{p}</p>
          ))}
        </div>
      )}

      {footer}

      <Sheet open={agenda} onClose={() => setAgenda(false)} title="Ajouter à mon agenda">
        <div className="flex flex-col gap-2.5">
          {agendaOptions.map((o, i) => (
            <Button key={o.id} variant={i ? 'secondary' : 'primary'} onClick={() => { o.go(); setAgenda(false); }}><Icon name="calendar" size={20} /> {o.label}</Button>
          ))}
        </div>
      </Sheet>
      <Sheet open={share} onClose={() => setShare(false)} title={`Partager ${e.kind === 'event' ? "l'événement" : e.kind === 'spot' ? 'le spot' : 'le chill'}`}>
        <Card className="px-4 py-3 mb-4">
          <div className="text-[14px] font-semibold leading-snug">{e.title}</div>
          <div className="text-[13px] mt-1 break-all" style={{ color: C.mute }}>{link}</div>
        </Card>
        <div className="flex flex-col gap-2.5">
          <Button variant="whatsapp" onClick={() => { open(`https://wa.me/?text=${encodeURIComponent(`${shareText(e)}\n${link}`)}`); setShare(false); }}><Icon name="chat" size={20} /> Envoyer sur WhatsApp</Button>
          <Button variant="secondary" onClick={copy}><Icon name="copy" size={20} /> Copier le lien</Button>
        </div>
      </Sheet>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
};
