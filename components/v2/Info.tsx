import React, { useEffect, useState } from 'react';
import { Screen, TopBar, Card, Note, Skeleton, Icon, C, dateFr } from './ui';
import { listInfo } from '../../services/infoService';
import { InfoDay, InfoItem, SCOPE_LABEL } from '../../utils/infoDuJour';
import { frTypo } from '../../utils/articleText';

// « L'info du jour » : le sujet le plus suivi dans le monde et un sujet Cameroun / Afrique, résumés
// chaque matin avec nos mots, sources à l'appui. Les 7 derniers jours.

const Item: React.FC<{ it: InfoItem }> = ({ it }) => (
  <div className="px-5 py-5">
    <div className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.ochreText }}>{SCOPE_LABEL[it.scope]}</div>
    <h2 className="serif text-[22px] font-semibold leading-[1.2] mt-1">{frTypo(it.title)}</h2>
    {it.why && <div className="text-[13px] mt-1.5 flex gap-1.5" style={{ color: C.mute }}><span className="shrink-0 mt-px"><Icon name="activity" size={15} /></span><span>{frTypo(it.why)}</span></div>}
    <div className="serif text-[16.5px] leading-[1.65] mt-3 flex flex-col gap-3" style={{ color: '#22263A' }}>
      {it.summary.split(/\n+/).map((p, i) => <p key={i}>{frTypo(p)}</p>)}
    </div>
    <div className="mt-4 flex flex-wrap gap-1.5">
      {it.sources.map(s => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1" style={{ background: C.soft, color: C.ink }}>
          {s.name} <Icon name="arrow" size={13} />
        </a>
      ))}
    </div>
  </div>
);


const InfoScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [days, setDays] = useState<InfoDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); listInfo().then(setDays).catch(() => { setFailed(true); setDays([]); }); }, []);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date());
  return (
    <Screen>
      <TopBar onBack={onBack} title="L'info du jour" />
      <div className="px-6 pt-2 pb-4">
        <h1 className="serif text-[30px] font-semibold leading-tight">L’info du jour</h1>
        <p className="text-[15px] leading-relaxed mt-1.5" style={{ color: C.mute }}>Chaque matin, le sujet dont le monde parle le plus, et celui du Cameroun et de l’Afrique, résumés en quelques lignes, sources à l’appui.</p>
      </div>
      <div className="px-5 flex flex-col gap-5 pb-[max(env(safe-area-inset-bottom),28px)]">
        {!days && <><Skeleton h={260} /><Skeleton h={260} /></>}
        {failed && <Note tone="warn">L’info du jour n’a pas pu être chargée. Vérifie ta connexion.</Note>}
        {days && !failed && !days.length && <Card className="px-5 py-8 text-center"><div className="text-[15px] font-semibold">Première info demain matin</div></Card>}
        {days?.map(d => (
          <div key={d.date}>
            <div className="text-[13px] font-bold pb-2 capitalize" style={{ color: C.text2 }}>{d.date === today ? "Aujourd'hui" : dateFr(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <Card>{d.items.map((it, k) => <div key={it.scope} style={{ borderTop: k ? `1px solid ${C.line}` : undefined }}><Item it={it} /></div>)}</Card>
          </div>
        ))}
      </div>
    </Screen>
  );
};

export default InfoScreen;
