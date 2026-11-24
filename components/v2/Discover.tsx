import React, { useEffect, useState } from 'react';
import { C, Icon, NewPill, ndopShadow } from './ui';
import { auth } from '../../services/firebase';
import { listArticles } from '../../services/articleService';
import { seenAt, isNewSince } from '../../utils/seen';
import { listInfo } from '../../services/infoService';
import { getFriday } from '../../services/vendrediService';
import { Friday } from '../../utils/vendredi';
import { InfoDay, InfoScope } from '../../utils/infoDuJour';
import { DateBlock, LiveDot } from './EventView';
import { listEvents } from '../../services/eventService';
import { AppEvent, isLive, sortUpcoming, summary, untilText, KIND_LABEL } from '../../utils/events';
import { listRadio } from '../../services/radioService';
import { RadioItem, KIND_LABEL as RADIO_KIND } from '../../utils/radio';
import { dayNumber, puzzleFor, isOver, isWon, stats, MAX_TRIES } from '../../games/mot';
import { listDecryptage, DecryptageDay } from '../../services/decryptageService';

// « À découvrir » : le prochain événement, Radio CK, les articles et les jeux, sur l'accueil du prêteur
// comme sur l'espace des proches.

/** Grande case des sorties : un spot en cours d'abord, sinon la prochaine sortie. */
const EventsTile: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [next, setNext] = useState<AppEvent | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    listEvents().then(l => {
      if (!on) return;
      const upcoming = sortUpcoming(l);
      setNext(upcoming.find(e => isLive(e)) || upcoming[0] || null);
    }).catch(() => { if (on) setNext(null); });
    return () => { on = false; };
  }, []);
  const live = !!next && isLive(next);
  const label = !next ? 'Sorties' : live ? 'En ce moment' : next.kind === 'event' ? 'Prochain événement' : `${KIND_LABEL[next.kind]} à venir`;
  return (
    <button onClick={onClick} className="col-span-2 text-left rounded-[10px] p-3.5 flex items-center gap-3.5" style={{ background: C.card, color: C.ink }}>
      {next && !live ? <DateBlock iso={next.startsAt} /> : (
        <span className="w-[54px] h-[54px] rounded-xl flex items-center justify-center shrink-0" style={{ background: C.ink, color: C.ochre }}><Icon name={live ? 'pin' : 'calendar'} size={24} /></span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: live ? C.green : C.ochreText }}>{live && <LiveDot color={C.green} />}{label}</div>
        <div className="text-[16.5px] font-extrabold leading-snug mt-0.5 line-clamp-2">{next ? next.title : 'Événements, spots et chills'}</div>
        {next && <div className="text-[12.5px] mt-0.5 truncate" style={{ color: C.mute }}>{live ? [next.venue, untilText(next)].filter(Boolean).join(' · ') : summary(next)}</div>}
      </div>
      <span style={{ color: C.mute }}><Icon name="chevron" size={18} /></span>
    </button>
  );
};

/** Case « Radio CK » de « À découvrir » : la dernière reco. */
const RadioTile: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [last, setLast] = useState<RadioItem | null | undefined>(undefined);
  useEffect(() => { let on = true; listRadio().then(r => on && setLast(r.items[0] || null)).catch(() => on && setLast(null)); return () => { on = false; }; }, []);
  return (
    <button onClick={onClick} className="col-span-2 text-left rounded-[10px] p-3.5 flex items-center gap-3.5" style={{ background: C.coral, color: C.ink }}>
      {last?.thumbnail
        ? <img src={last.thumbnail} alt="" referrerPolicy="no-referrer" className="w-[54px] h-[54px] rounded-xl object-cover shrink-0" />
        : <span className="w-[54px] h-[54px] rounded-lg flex items-center justify-center shrink-0 display text-[14px]" style={{ background: C.ink, color: C.coral }}>CK</span>}
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-extrabold uppercase tracking-wide flex items-center gap-2" style={{ color: C.ink }}>{last && isNewSince(last.publishedAt, seenAt('radio')) && <NewPill />}{last ? `Radio CK · ${RADIO_KIND[last.kind] === 'Vidéo' ? 'nouvelle vidéo' : RADIO_KIND[last.kind] === 'Musique' ? 'nouveau son' : 'nouveau podcast'}` : 'Radio CK'}</div>
        <div className="text-[16.5px] font-extrabold leading-snug mt-0.5 line-clamp-2">{last ? last.title : 'Podcasts et vidéos à ne pas rater'}</div>
        {last && (last.show || last.commentCount > 0) && <div className="text-[12.5px] mt-0.5 truncate font-semibold" style={{ color: 'rgba(14,21,51,.75)' }}>{[last.show, last.commentCount ? `${last.commentCount} avis` : ''].filter(Boolean).join(' · ')}</div>}
      </div>
      <span style={{ color: C.ink }}><Icon name="chevron" size={18} /></span>
    </button>
  );
};

/** Case « Le mot du jour » : où on en est aujourd'hui, et la série. */
const MotTile: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const n = dayNumber(), p = puzzleFor(n);
  let h: Record<string, string[]> = {};
  try { h = JSON.parse(localStorage.getItem('ck_mot') || '{}').h || {}; } catch { /* stockage indisponible */ }
  const g = h[n] || [], done = isOver(g, p.word), streak = stats(h, n).streak;
  const line = done ? (isWon(g, p.word) ? `Trouvé en ${g.length}/${MAX_TRIES}` : 'Raté aujourd’hui') : g.length ? `${g.length}/${MAX_TRIES} essais · à finir` : `${p.word.length} lettres${p.local ? ' · mot du 237' : ''} · à toi de jouer`;
  return (
    <button onClick={onClick} className="col-span-2 text-left rounded-[10px] p-3.5 flex items-center gap-3.5" style={{ background: C.teal, color: C.ink }}>
      <span className="w-[54px] h-[54px] rounded-lg grid grid-cols-2 gap-[3px] p-[7px] shrink-0" style={{ background: C.ink }} aria-hidden="true">
        {[C.teal, C.mango, '#F7F3EA', C.teal].map((bg, i) => <span key={i} className="rounded-[4px]" style={{ background: bg }} />)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-extrabold uppercase tracking-wide">Le mot du jour · n° {n}</div>
        <div className="text-[16.5px] font-extrabold leading-snug mt-0.5">{done ? 'Reviens demain pour le prochain' : 'Un mot, six essais'}</div>
        <div className="text-[12.5px] mt-0.5 truncate font-semibold" style={{ color: 'rgba(14,21,51,.78)' }}>{line}{streak > 0 ? ` · série de ${streak} jour${streak > 1 ? 's' : ''}` : ''}</div>
      </div>
      <span style={{ color: C.ink }}><Icon name="chevron" size={18} /></span>
    </button>
  );
};

/** Case « L'info du jour » : les deux titres, comme une une de journal ; chacun ouvre son info. */
const InfoTile: React.FC<{ onClick: (scope?: InfoScope | 'decryptage') => void }> = ({ onClick }) => {
  const [day, setDay] = useState<InfoDay | null | undefined>(undefined);
  useEffect(() => { let on = true; listInfo().then(d => on && setDay(d[0] || null)).catch(() => on && setDay(null)); return () => { on = false; }; }, []);
  const [dec, setDec] = useState<DecryptageDay | null>(null);
  useEffect(() => { let on = true; listDecryptage().then(d => on && setDec(d[0] || null)).catch(() => undefined); return () => { on = false; }; }, []);
  if (!day && !dec) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date());
  const decToday = dec && dec.date === new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  return (
    <div className="col-span-2 rounded-[10px] overflow-hidden" style={{ background: C.ink, color: '#fff' }}>
      {dec && (
        <button onClick={() => onClick('decryptage')} className="w-full text-left px-4 py-3.5 flex items-center gap-3" style={{ background: 'rgba(255,194,61,.1)', borderBottom: day ? '1px solid rgba(255,255,255,.12)' : undefined }}>
          <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: C.mango, color: C.ink }}>
            <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3.2v13.6L16.5 10z" fill="currentColor" /></svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] font-extrabold uppercase tracking-wide" style={{ color: C.mango }}>{decToday ? 'Le décryptage du jour' : "Le décryptage d'hier"} · {dec.minutes} min</span>
            <span className="block text-[15.5px] font-extrabold leading-snug mt-0.5 line-clamp-2">{dec.title}</span>
          </span>
        </button>
      )}
      {day && <>
      <button onClick={() => onClick()} className="w-full text-left px-4 pt-3.5 flex items-center justify-between">
        <span className="text-[11.5px] font-extrabold uppercase tracking-wide" style={{ color: C.mango }}>{day.date === today ? "L'info du jour" : "L'info d'hier"}</span>
        <span style={{ color: 'rgba(255,255,255,.55)' }}><Icon name="chevron" size={16} /></span>
      </button>
      {day.items.map((it, i) => (
        <button key={it.scope} onClick={() => onClick(it.scope)} className="w-full text-left px-4 py-3" style={{ borderTop: i ? '1px solid rgba(255,255,255,.12)' : undefined }}>
          <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,.55)' }}>{it.scope === 'monde' ? 'Monde' : 'Cameroun et Afrique'}</div>
          <div className="text-[16px] font-extrabold leading-snug mt-0.5 line-clamp-2">{it.title}</div>
        </button>
      ))}
      </>}
    </div>
  );
};

/** Case « Mon vendredi soir » : visible du lundi au samedi quand Christian a proposé ses options. */
const FridayTile: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [f, setF] = useState<Friday | null>(null);
  useEffect(() => { let on = true; getFriday().then(d => on && setF(d.friday)).catch(() => undefined); return () => { on = false; }; }, []);
  if (!f) return null;
  const chosen = f.options.find(o => o.id === f.decided);
  return (
    <button onClick={onClick} className="col-span-2 text-left rounded-[10px] p-3.5 flex items-center gap-3.5 mb-1" style={{ background: C.mango, color: C.ink, boxShadow: ndopShadow() }}>
      <span className="w-[54px] h-[54px] rounded-lg flex flex-col items-center justify-center shrink-0 leading-none" style={{ background: C.ink, color: C.mango }}>
        <span className="text-[10px] font-bold uppercase">Ven.</span><span className="display text-[20px] mt-1">{Number(f.date.slice(8))}</span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-extrabold uppercase tracking-wide">Mon vendredi soir{f.myVote && !chosen ? ' · tu as voté' : ''}</div>
        <div className="text-[16.5px] font-extrabold leading-snug mt-0.5 line-clamp-2">{chosen ? `Ce sera ${chosen.name}` : `J'hésite entre ${f.options.length} options`}</div>
        <div className="text-[12.5px] mt-0.5 truncate font-semibold" style={{ color: 'rgba(14,21,51,.75)' }}>{chosen ? chosen.address || 'À vendredi !' : f.options.map(o => o.name).join(' · ')}</div>
      </div>
      <span style={{ color: C.ink }}><Icon name="chevron" size={18} /></span>
    </button>
  );
};

const MiniCard: React.FC<{ r: number; red?: boolean; rot: number; x: number }> = ({ r, red, rot, x }) => (
  <div className="absolute w-[30px] h-[42px] rounded-[5px] bg-white serif font-bold text-[14px] pl-1 pt-0.5 shadow"
    style={{ transform: `rotate(${rot}deg)`, right: x, top: 12, color: red ? C.red : C.ink }}>{r}</div>
);

const Tile: React.FC<{ onClick: () => void; title: string; sub?: string; bg: string; fg: string; subColor: string; children?: React.ReactNode; badge?: React.ReactNode }> = ({ onClick, title, sub, bg, fg, subColor, children, badge }) => (
  <button onClick={onClick} className="relative text-left rounded-[10px] p-4 pt-14 min-h-[128px] overflow-hidden" style={{ background: bg, color: fg }}>
    {children}
    {badge && <span className="absolute top-3.5 right-3.5">{badge}</span>}
    <div className="display text-[16px] leading-tight">{title}</div>
    {sub && <div className="text-[12.5px] mt-0.5" style={{ color: subColor }}>{sub}</div>}
  </button>
);

/** Nombre d'articles parus depuis la dernière visite de la rubrique. */
const useNewArticles = () => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    let on = true;
    const since = seenAt('articles');
    listArticles(uid, false).then(l => on && setN(l.filter(a => a.status === 'published' && isNewSince(a.publishedAt, since)).length)).catch(() => undefined);
    return () => { on = false; };
  }, []);
  return n;
};

type Props = { onArticles: () => void; onJambo: () => void; onBac: () => void; onWiseman: () => void; onEvents: () => void; onRadio?: () => void; onMot?: () => void; onInfo?: (scope?: InfoScope | 'decryptage') => void; onVendredi?: () => void; onAdresses?: () => void; onFilms?: () => void };

/** « Aujourd'hui » : ce qui change chaque jour (le mot, la sortie du moment, la dernière reco). */
export const Today: React.FC<Pick<Props, 'onEvents' | 'onRadio' | 'onMot' | 'onInfo' | 'onVendredi'>> = ({ onEvents, onRadio, onMot, onInfo, onVendredi }) => (
  <>
    <div className="px-5 pt-7 pb-3 display text-[12px] uppercase tracking-[0.16em]" style={{ color: C.mute }}>Aujourd’hui</div>
    <div className="px-5 grid grid-cols-2 gap-2.5">
      {onVendredi && <FridayTile onClick={onVendredi} />}
      {onInfo && <InfoTile onClick={onInfo} />}
      {onMot && <MotTile onClick={onMot} />}
      <EventsTile onClick={onEvents} />
      {onRadio && <RadioTile onClick={onRadio} />}
    </div>
  </>
);

const INVITE_TEXT = "Rejoins-moi sur CKMoney : l'info du jour, le mot du jour, les films et séries, les sorties, Radio CK et des jeux entre amis. C'est gratuit.";
const INVITE_URL = 'https://ck-money.vercel.app';

/** « Inviter un ami » : partage l'appli elle-même (pas un lien de demande de prêt). */
export const InviteCard: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = { title: 'CKMoney', text: INVITE_TEXT, url: INVITE_URL };
    if (typeof navigator.share === 'function') {
      try { await navigator.share(data); return; } catch (e: any) { if (e?.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${INVITE_TEXT}\n${INVITE_URL}`)}`, '_blank', 'noopener');
  };
  const copy = () => { navigator.clipboard?.writeText(`${INVITE_TEXT}\n${INVITE_URL}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => undefined); };
  return (
    <div className="px-5 pt-7">
      <div className="rounded-[10px] p-4" style={{ background: C.teal, color: C.ink }}>
        <div className="display text-[17px] leading-tight">Fais découvrir CKMoney</div>
        <p className="text-[14px] leading-snug mt-1.5 font-semibold" style={{ color: 'rgba(14,21,51,.8)' }}>Invite un ami à rejoindre l’appli : l’info du jour, le mot du jour, les films, les sorties… Rien à voir avec un prêt.</p>
        <div className="grid grid-cols-[1fr_auto] gap-2 mt-3.5">
          <button onClick={share} className="h-12 rounded-xl flex items-center justify-center gap-2 text-[15px] font-extrabold" style={{ background: C.ink, color: '#fff' }}>
            <Icon name="chat" size={19} /> Inviter un ami
          </button>
          <button onClick={copy} aria-label="Copier le lien de l’appli" className="h-12 px-4 rounded-xl flex items-center justify-center gap-1.5 text-[14px] font-bold" style={{ background: 'rgba(14,21,51,.12)', color: C.ink }}>
            <Icon name="copy" size={18} /> {copied ? 'Copié' : 'Lien'}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Articles et jeux. Avec « today », le bloc « Aujourd'hui » est affiché juste avant. */
const Discover: React.FC<Props & { today?: boolean }> = ({ onArticles, onJambo, onBac, onWiseman, onEvents, onRadio, onMot, onInfo, onVendredi, onAdresses, onFilms, today = true }) => {
  const fresh = useNewArticles();
  return (
    <>
      {today && <Today onEvents={onEvents} onRadio={onRadio} onMot={onMot} onInfo={onInfo} onVendredi={onVendredi} />}
      <div className="px-5 pt-7 pb-3 display text-[12px] uppercase tracking-[0.16em]" style={{ color: C.mute }}>À découvrir</div>
      <div className="px-5 grid grid-cols-2 gap-2.5">
        <Tile onClick={onArticles} title="Articles" sub="Lire entre les lignes" bg={C.ochreSoft} fg={C.ink} subColor={C.ochreText}
          badge={fresh > 0 ? <span className="text-[11px] font-bold px-2 py-[3px] rounded-full" style={{ background: C.ochre, color: C.ink }}>{fresh} nouveau{fresh > 1 ? 'x' : ''}</span> : undefined}>
          <div className="absolute top-4 left-4 serif text-[34px] leading-none font-semibold" style={{ color: C.ochre }} aria-hidden="true">«</div>
        </Tile>
        {onAdresses && (
          <Tile onClick={onAdresses} title="Mes adresses" sub="Les lieux que je recommande" bg={C.card} fg={C.ink} subColor={C.mute}>
            <div className="absolute top-3.5 left-4 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.ochreSoft, color: C.ochreText }} aria-hidden="true"><Icon name="pin" size={20} /></div>
          </Tile>
        )}
        {onFilms && (
          <Tile onClick={onFilms} title="Films et séries" sub="Mes notes et mes avis" bg={C.night} fg="#F7F3EA" subColor="rgba(247,243,234,.7)">
            <div className="absolute top-3.5 left-4 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.coral, color: C.ink }} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
            </div>
          </Tile>
        )}
        <Tile onClick={onJambo} title="Jambo" sub="Fap Fap, seul ou entre amis" bg="#16204A" fg="#fff" subColor="rgba(255,255,255,.7)">
          <MiniCard r={3} red rot={-12} x={46} />
          <MiniCard r={10} rot={8} x={18} />
        </Tile>
        <Tile onClick={onBac} title="Baccalauréat" sub="Le petit bac, sans feuille ni stylo" bg={C.card} fg={C.ink} subColor={C.mute}>
          <div className="absolute top-3.5 left-4 w-10 h-10 rounded-xl flex items-center justify-center serif text-[24px] font-semibold" style={{ background: C.ink, color: C.ochre }} aria-hidden="true">B</div>
        </Tile>
        <Tile onClick={onWiseman} title="Le Wiseman" sub="Trouve l'intrus parmi vous" bg={C.card} fg={C.ink} subColor={C.mute}>
          <div className="absolute top-3.5 left-4 flex -space-x-2" aria-hidden="true">
            {[C.soft, C.ochreSoft, C.ink].map((bg, i) => (
              <span key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[13px] font-bold" style={{ background: bg, color: i === 2 ? C.ochre : C.ink }}>{i === 2 ? '?' : ''}</span>
            ))}
          </div>
        </Tile>
      </div>
    </>
  );
};

export default Discover;
