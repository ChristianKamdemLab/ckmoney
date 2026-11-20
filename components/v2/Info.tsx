import React, { useEffect, useState } from 'react';
import { Screen, TopBar, Card, Note, Skeleton, Icon, Toast, C, dateFr } from './ui';
import { listInfo } from '../../services/infoService';
import { InfoDay, InfoItem, InfoScope, SCOPE_LABEL } from '../../utils/infoDuJour';
import { frTypo } from '../../utils/articleText';

// « L'info du jour » : le sujet le plus suivi dans le monde et un sujet Cameroun / Afrique, résumés
// chaque matin avec nos mots, sources à l'appui. Un onglet par info ; les jours précédents en dessous.

const LINK = 'https://ck-money.vercel.app/?info';
const SHORT: Record<InfoScope, string> = { monde: 'Monde', afrique: 'Cameroun et Afrique' };
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date());
const dayName = (date: string) => (date === todayIso() ? "Aujourd'hui" : dateFr(date, { weekday: 'long', day: 'numeric', month: 'long' }));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const Article: React.FC<{ it: InfoItem; date: string; onCopied: () => void }> = ({ it, date, onCopied }) => {
  const [lead, ...rest] = it.summary.split(/\n+/);
  const share = `${it.title}\n\nL'info du jour sur CKMoney : ${LINK}`;
  return (
    <Card className="px-5 pt-5 pb-5">
      <div className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.ochreText }}>{SCOPE_LABEL[it.scope]} · {dayName(date)}</div>
      <h2 className="serif text-[24px] font-semibold leading-[1.18] mt-1.5">{frTypo(it.title)}</h2>
      {it.why && (
        <div className="mt-3 rounded-xl px-3 py-2.5 text-[13px] leading-snug flex gap-2" style={{ background: C.ochreSoft, color: C.ochreText }}>
          <span className="shrink-0 mt-px"><Icon name="activity" size={15} /></span><span>{frTypo(cap(it.why))}</span>
        </div>
      )}
      <p className="serif text-[18px] leading-[1.6] mt-4 font-medium" style={{ color: C.ink }}>{frTypo(lead)}</p>
      {rest.map((p, i) => <p key={i} className="serif text-[16.5px] leading-[1.65] mt-3" style={{ color: '#22263A' }}>{frTypo(p)}</p>)}
      <div className="text-[12px] font-semibold mt-5" style={{ color: C.mute }}>Sources</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {it.sources.map(s => (
          <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1" style={{ background: C.soft, color: C.ink }}>
            {s.name} <Icon name="arrow" size={13} />
          </a>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-5">
        <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer"
          className="h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-bold text-white" style={{ background: C.green }}>
          <Icon name="chat" size={17} /> Partager
        </a>
        <button onClick={() => { navigator.clipboard?.writeText(share).then(onCopied).catch(() => undefined); }}
          className="h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-bold" style={{ background: C.soft, color: C.ink }}>
          <Icon name="copy" size={17} /> Copier
        </button>
      </div>
    </Card>
  );
};

const InfoScreen: React.FC<{ onBack: () => void; initialScope?: InfoScope }> = ({ onBack, initialScope }) => {
  const [days, setDays] = useState<InfoDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<{ date?: string; scope: InfoScope }>({ scope: initialScope || 'monde' });
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { window.scrollTo(0, 0); listInfo().then(setDays).catch(() => { setFailed(true); setDays([]); }); }, []);

  const day = days?.find(d => d.date === sel.date) || days?.[0];
  const item = day?.items.find(i => i.scope === sel.scope) || day?.items[0];
  const older = (days || []).filter(d => d !== day);
  const open = (date: string, scope: InfoScope) => { setSel({ date, scope }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <Screen>
      <TopBar onBack={onBack} title="L'info du jour" />
      <div className="px-5 flex flex-col gap-4 pb-[max(env(safe-area-inset-bottom),28px)]">
        {!days && <><Skeleton h={44} /><Skeleton h={420} /></>}
        {failed && <Note tone="warn">L’info du jour n’a pas pu être chargée. Vérifie ta connexion.</Note>}
        {days && !failed && !days.length && <Card className="px-5 py-8 text-center"><div className="text-[15px] font-semibold">Première info demain matin</div></Card>}
        {day && day.items.length > 1 && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl" style={{ background: C.soft }}>
            {day.items.map(i => (
              <button key={i.scope} onClick={() => setSel({ date: day.date, scope: i.scope })}
                className="h-10 rounded-xl text-[14px] font-bold transition-colors"
                style={item?.scope === i.scope ? { background: C.card, color: C.ink, boxShadow: '0 1px 2px rgba(0,0,0,.06)' } : { color: C.mute }}>
                {SHORT[i.scope]}
              </button>
            ))}
          </div>
        )}
        {day && item && <Article key={day.date + item.scope} it={item} date={day.date} onCopied={() => setToast('Copié')} />}
        {older.length > 0 && (
          <>
            <div className="text-[15px] font-bold pt-3">Les jours précédents</div>
            <Card>
              {older.flatMap(d => d.items.map(i => ({ d, i }))).map(({ d, i }, n) => (
                <button key={d.date + i.scope} onClick={() => open(d.date, i.scope)} className="w-full text-left px-4 py-3.5 flex items-center gap-3" style={{ borderTop: n ? `1px solid ${C.line}` : undefined }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.ochreText }}>{SHORT[i.scope]} · {dayName(d.date)}</div>
                    <div className="serif text-[16px] font-semibold leading-snug mt-0.5 line-clamp-2">{frTypo(i.title)}</div>
                  </div>
                  <span style={{ color: C.mute }}><Icon name="chevron" size={18} /></span>
                </button>
              ))}
            </Card>
          </>
        )}
        <p className="text-[12.5px] leading-relaxed px-1" style={{ color: C.mute }}>Chaque matin, le sujet dont le monde parle le plus et celui du Cameroun et de l’Afrique, résumés avec nos mots à partir d’au moins deux médias.</p>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

export default InfoScreen;
