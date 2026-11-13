import React, { useState } from 'react';
import { AppEvent, whenText, shortWhen, dayBlock, mapsUrl, googleCalendarUrl, isUpcoming, shareText, hostOf } from '../../utils/events';
import { Card, Button, Sheet, Note, Icon, IconName, Toast, C } from './ui';
import { detectedPhone, isStandalone } from '../../services/install';

// Fiche d'un événement, commune à l'appli et à la page publique /e/ID (sans compte, sans Firebase).
// Pas de liste de participants.

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

/** Ligne de liste. */
export const EventRow: React.FC<{ event: AppEvent; onOpen: () => void; past?: boolean }> = ({ event: e, onOpen, past }) => (
  <button onClick={onOpen} className="w-full text-left flex items-center gap-3.5 px-4 py-3.5" style={{ opacity: past ? 0.6 : 1 }}>
    <DateBlock iso={e.startsAt} tone={past ? 'soft' : 'ink'} />
    <div className="flex-1 min-w-0">
      <div className="serif text-[17px] font-semibold leading-snug">{e.title}</div>
      <div className="text-[13px] mt-0.5 truncate" style={{ color: C.mute }}>{[shortWhen(e), e.venue].filter(Boolean).join(' · ')}</div>
      {e.price && <span className="inline-block text-[11.5px] font-bold mt-1.5 px-2 py-0.5 rounded-full" style={{ background: /gratuit/i.test(e.price) ? C.greenSoft : C.soft, color: /gratuit/i.test(e.price) ? C.green : C.ink }}>{e.price}</span>}
    </div>
    <Icon name="chevron" size={18} />
  </button>
);

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

const Action: React.FC<{ icon: IconName; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="flex-1 rounded-2xl py-3 flex flex-col items-center gap-1.5 text-[13px] font-semibold" style={{ background: C.card, color: C.ink }}>
    <Icon name={icon} size={21} />{label}
  </button>
);

export const EventDetail: React.FC<{ event: AppEvent; footer?: React.ReactNode }> = ({ event: e, footer }) => {
  const [agenda, setAgenda] = useState(false);
  const [share, setShare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const upcoming = isUpcoming(e);
  const link = shareLink(e.id);
  const free = /gratuit/i.test(e.price);
  const site = hostOf(e.url);

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

  return (
    <>
      <div className="px-5 pt-1">
        <div className="rounded-[22px] p-5 pt-4" style={{ background: C.ink, color: '#fff' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ background: 'rgba(201,138,30,.18)', color: C.ochre }}>{shortWhen(e)}</span>
            {e.price && <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: free ? '#2E8B62' : 'rgba(255,255,255,.12)', color: '#fff' }}>{e.price}</span>}
          </div>
          <h1 className="serif text-[28px] leading-[1.14] font-semibold tracking-[-0.3px] mt-4">{e.title}</h1>
          {e.organizer && <div className="text-[14px] mt-2" style={{ color: 'rgba(255,255,255,.72)' }}>Par {e.organizer}</div>}
        </div>
      </div>

      <div className="px-5 pt-3">
        <Card>
          <Row icon="calendar" first>{whenText(e)}</Row>
          {(e.venue || e.address) && (
            <Row icon="pin" onClick={() => open(mapsUrl(e))}>
              <div className="font-semibold">{e.venue || e.address}</div>
              {e.venue && e.address && <div className="text-[13.5px] mt-0.5" style={{ color: C.mute }}>{e.address}</div>}
            </Row>
          )}
          {(e.price || site) && (
            <Row icon="ticket">
              <div className="font-semibold">{free ? 'Entrée gratuite' : e.price}</div>
              {site && <div className="text-[13.5px] mt-0.5" style={{ color: C.mute }}>Réservation sur {site}</div>}
            </Row>
          )}
        </Card>
      </div>

      <div className="px-5 pt-3 flex flex-col gap-2.5">
        {upcoming && e.url && <Button onClick={() => open(e.url)}><Icon name="ticket" size={20} /> {free ? 'Réserver ma place' : 'Prendre ma place'}</Button>}
        <div className="flex gap-2.5">
          {upcoming && <Action icon="calendar" label="Agenda" onClick={() => setAgenda(true)} />}
          {(e.venue || e.address) && <Action icon="pin" label="Itinéraire" onClick={() => open(mapsUrl(e))} />}
          <Action icon="share" label="Partager" onClick={doShare} />
        </div>
        {!upcoming && <Note tone="info" icon="clock">Cet événement est terminé.</Note>}
      </div>

      {e.description && (
        <div className="px-6 pt-6">
          <div className="text-[13px] font-semibold mb-2" style={{ color: C.mute }}>À propos</div>
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
      <Sheet open={share} onClose={() => setShare(false)} title="Partager l'événement">
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
