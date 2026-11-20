import React, { useEffect, useState } from 'react';
import { C, Icon, NewPill } from './ui';
import { auth } from '../../services/firebase';
import { listArticles } from '../../services/articleService';
import { seenAt, isNewSince } from '../../utils/seen';
import { DateBlock, LiveDot } from './EventView';
import { listEvents } from '../../services/eventService';
import { AppEvent, isLive, sortUpcoming, summary, untilText, KIND_LABEL } from '../../utils/events';
import { listRadio } from '../../services/radioService';
import { RadioItem, KIND_LABEL as RADIO_KIND } from '../../utils/radio';
import { dayNumber, puzzleFor, isOver, isWon, stats, MAX_TRIES } from '../../games/mot';

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
    <button onClick={onClick} className="col-span-2 text-left rounded-2xl p-3.5 flex items-center gap-3.5" style={{ background: C.card, color: C.ink }}>
      {next && !live ? <DateBlock iso={next.startsAt} /> : (
        <span className="w-[54px] h-[54px] rounded-xl flex items-center justify-center shrink-0" style={{ background: C.ink, color: C.ochre }}><Icon name={live ? 'pin' : 'calendar'} size={24} /></span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: live ? C.green : C.ochreText }}>{live && <LiveDot color={C.green} />}{label}</div>
        <div className="serif text-[17px] font-semibold leading-snug mt-0.5 line-clamp-2">{next ? next.title : 'Événements, spots et chills'}</div>
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
    <button onClick={onClick} className="col-span-2 text-left rounded-2xl p-3.5 flex items-center gap-3.5" style={{ background: C.ink, color: '#fff' }}>
      {last?.thumbnail
        ? <img src={last.thumbnail} alt="" referrerPolicy="no-referrer" className="w-[54px] h-[54px] rounded-xl object-cover shrink-0" />
        : <span className="w-[54px] h-[54px] rounded-xl flex items-center justify-center shrink-0 serif text-[15px] font-bold" style={{ background: C.ochre, color: C.ink }}>CK</span>}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold flex items-center gap-2" style={{ color: C.ochre }}>{last && isNewSince(last.publishedAt, seenAt('radio')) && <NewPill dark />}{last ? `Radio CK · ${RADIO_KIND[last.kind] === 'Vidéo' ? 'nouvelle vidéo' : RADIO_KIND[last.kind] === 'Musique' ? 'nouveau son' : 'nouveau podcast'}` : 'Radio CK'}</div>
        <div className="serif text-[17px] font-semibold leading-snug mt-0.5 line-clamp-2">{last ? last.title : 'Podcasts et vidéos à ne pas rater'}</div>
        {last && (last.show || last.commentCount > 0) && <div className="text-[12.5px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,.65)' }}>{[last.show, last.commentCount ? `${last.commentCount} avis` : ''].filter(Boolean).join(' · ')}</div>}
      </div>
      <span style={{ color: 'rgba(255,255,255,.6)' }}><Icon name="chevron" size={18} /></span>
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
    <button onClick={onClick} className="col-span-2 text-left rounded-2xl p-3.5 flex items-center gap-3.5" style={{ background: C.card, color: C.ink }}>
      <span className="w-[54px] h-[54px] rounded-xl grid grid-cols-2 gap-[3px] p-[7px] shrink-0" style={{ background: C.ink }} aria-hidden="true">
        {[C.green, C.ochre, '#8A8E9C', C.green].map((bg, i) => <span key={i} className="rounded-[4px]" style={{ background: bg }} />)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold" style={{ color: C.ochreText }}>Le mot du jour · n° {n}</div>
        <div className="serif text-[17px] font-semibold leading-snug mt-0.5">{done ? 'Reviens demain pour le prochain' : 'Un mot, six essais'}</div>
        <div className="text-[12.5px] mt-0.5 truncate" style={{ color: C.mute }}>{line}{streak > 0 ? ` · 🔥 ${streak} jour${streak > 1 ? 's' : ''}` : ''}</div>
      </div>
      <span style={{ color: C.mute }}><Icon name="chevron" size={18} /></span>
    </button>
  );
};

const MiniCard: React.FC<{ r: number; red?: boolean; rot: number; x: number }> = ({ r, red, rot, x }) => (
  <div className="absolute w-[30px] h-[42px] rounded-[5px] bg-white serif font-bold text-[14px] pl-1 pt-0.5 shadow"
    style={{ transform: `rotate(${rot}deg)`, right: x, top: 12, color: red ? C.red : C.ink }}>{r}</div>
);

const Tile: React.FC<{ onClick: () => void; title: string; sub?: string; bg: string; fg: string; subColor: string; children?: React.ReactNode; badge?: React.ReactNode }> = ({ onClick, title, sub, bg, fg, subColor, children, badge }) => (
  <button onClick={onClick} className="relative text-left rounded-2xl p-4 pt-14 min-h-[128px] overflow-hidden" style={{ background: bg, color: fg }}>
    {children}
    {badge && <span className="absolute top-3.5 right-3.5">{badge}</span>}
    <div className="serif text-[19px] font-semibold leading-tight">{title}</div>
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

type Props = { onArticles: () => void; onJambo: () => void; onBac: () => void; onWiseman: () => void; onEvents: () => void; onRadio?: () => void; onMot?: () => void };

/** « Aujourd'hui » : ce qui change chaque jour (le mot, la sortie du moment, la dernière reco). */
export const Today: React.FC<Pick<Props, 'onEvents' | 'onRadio' | 'onMot'>> = ({ onEvents, onRadio, onMot }) => (
  <>
    <div className="px-5 pt-7 pb-3 text-[17px] font-bold">Aujourd’hui</div>
    <div className="px-5 grid grid-cols-2 gap-2.5">
      {onMot && <MotTile onClick={onMot} />}
      <EventsTile onClick={onEvents} />
      {onRadio && <RadioTile onClick={onRadio} />}
    </div>
  </>
);

/** Articles et jeux. Avec « today », le bloc « Aujourd'hui » est affiché juste avant. */
const Discover: React.FC<Props & { today?: boolean }> = ({ onArticles, onJambo, onBac, onWiseman, onEvents, onRadio, onMot, today = true }) => {
  const fresh = useNewArticles();
  return (
    <>
      {today && <Today onEvents={onEvents} onRadio={onRadio} onMot={onMot} />}
      <div className="px-5 pt-7 pb-3 text-[17px] font-bold">À découvrir</div>
      <div className="px-5 grid grid-cols-2 gap-2.5">
        <Tile onClick={onArticles} title="Articles" sub="Lire entre les lignes" bg={C.ochreSoft} fg={C.ink} subColor={C.ochreText}
          badge={fresh > 0 ? <span className="text-[11px] font-bold px-2 py-[3px] rounded-full" style={{ background: C.ochre, color: C.ink }}>{fresh} nouveau{fresh > 1 ? 'x' : ''}</span> : undefined}>
          <div className="absolute top-4 left-4 serif text-[34px] leading-none font-semibold" style={{ color: C.ochre }} aria-hidden="true">«</div>
        </Tile>
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
