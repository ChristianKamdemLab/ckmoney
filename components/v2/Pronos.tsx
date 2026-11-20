import React, { useEffect, useMemo, useState } from 'react';
import { Screen, TopBar, Note, Skeleton, Chips, Toast, C } from './ui';
import { listPronos, savePick } from '../../services/pronoService';
import { COMPETITIONS, PronoMatch, Pick, compName, isFinished, isLiveStatus, percents, pickOfScore, MAX_GOALS } from '../../utils/pronos';

// Pronos foot : chacun donne 1, N ou 2 (et le score exact s'il veut) jusqu'au coup d'envoi. Anonyme :
// on ne voit que les tendances de tous. Pas de cotes, pas de classement, aucun lien vers un site de paris.

const tz = 'Europe/Paris';
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso));
const dayLabel = (iso: string) => {
  const k = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000).toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (k === today) return "Aujourd'hui";
  if (k === tomorrow) return 'Demain';
  if (k === yesterday) return 'Hier';
  const s = new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const hour = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
const ERR: Record<string, string> = { pronos_fermes: 'Le match a commencé : pronos fermés.', prono_invalide: 'Le score ne va pas avec ton choix.', match_introuvable: 'Match introuvable.' };

const Crest: React.FC<{ src: string; name: string }> = ({ src, name }) => (
  src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-7 h-7 object-contain shrink-0" />
    : <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold" style={{ background: C.soft, color: C.ink }}>{name.slice(0, 2).toUpperCase()}</span>
);

const Stepper: React.FC<{ value: number; onChange: (n: number) => void; label: string }> = ({ value, onChange, label }) => (
  <div className="flex items-center gap-1.5" aria-label={label}>
    <button onClick={() => onChange(Math.max(0, value - 1))} className="w-9 h-9 rounded-full text-[18px] font-semibold" style={{ background: C.soft, color: C.ink }} aria-label={`${label} : moins`}>−</button>
    <span className="w-7 text-center serif text-[22px] font-semibold tabular-nums">{value}</span>
    <button onClick={() => onChange(Math.min(MAX_GOALS, value + 1))} className="w-9 h-9 rounded-full text-[18px] font-semibold" style={{ background: C.soft, color: C.ink }} aria-label={`${label} : plus`}>+</button>
  </div>
);

const MatchCard: React.FC<{ m: PronoMatch; onSaved: (m: PronoMatch) => void; onError: (t: string) => void }> = ({ m, onSaved, onError }) => {
  const [busy, setBusy] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [h, setH] = useState(m.mine?.home ?? 1);
  const [a, setA] = useState(m.mine?.away ?? 0);
  const pct = percents(m.tally);
  const finished = isFinished(m.status);
  const live = isLiveStatus(m.status);
  const result: Pick | null = finished && m.score.home !== null && m.score.away !== null ? pickOfScore(m.score.home, m.score.away) : null;

  const send = async (pick: Pick | null, home?: number, away?: number) => {
    setBusy(true);
    try { onSaved(await savePick(m.id, pick, home, away)); setScoreOpen(false); }
    catch (e: any) { onError(ERR[e?.message] || "Prono non enregistré, réessaie."); }
    finally { setBusy(false); }
  };

  const choices: { k: Pick; label: string }[] = [{ k: '1', label: m.home.short }, { k: 'N', label: 'Nul' }, { k: '2', label: m.away.short }];

  return (
    <div className="rounded-2xl p-4" style={{ background: C.card }}>
      <div className="flex items-center justify-between text-[12px] font-semibold" style={{ color: C.mute }}>
        <span>{compName(m.comp)}</span>
        <span style={{ color: live ? C.green : C.mute }}>{live ? 'En cours' : finished ? 'Terminé' : hour(m.utcDate)}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-2 min-w-0"><Crest src={m.home.crest} name={m.home.short} /><span className="font-semibold text-[15px] truncate">{m.home.short}</span></div>
        <div className="serif text-[20px] font-semibold tabular-nums px-1">{m.score.home !== null && m.score.away !== null ? `${m.score.home} – ${m.score.away}` : '–'}</div>
        <div className="flex items-center gap-2 min-w-0 justify-end"><span className="font-semibold text-[15px] truncate text-right">{m.away.short}</span><Crest src={m.away.crest} name={m.away.short} /></div>
      </div>

      {m.open ? (
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {choices.map(c => {
            const on = m.mine?.pick === c.k;
            return (
              <button key={c.k} disabled={busy} onClick={() => send(on ? null : c.k)}
                className="h-12 rounded-xl px-2 flex flex-col items-center justify-center leading-tight"
                style={{ background: on ? C.ink : C.soft, color: on ? '#fff' : C.ink }} aria-pressed={on}>
                <span className="text-[15px] font-bold">{c.k}</span>
                <span className="text-[11px] truncate max-w-full" style={{ opacity: .75 }}>{c.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 text-[13px]" style={{ color: C.mute }}>
          {m.mine ? <>Ton prono : <b style={{ color: result && result === m.mine.pick ? C.green : C.ink }}>{m.mine.pick}{m.mine.home !== undefined ? ` (${m.mine.home}-${m.mine.away})` : ''}</b>{result ? (result === m.mine.pick ? ' · bien vu' : '') : ''}</> : 'Pronos fermés'}
        </div>
      )}

      {m.open && (
        scoreOpen ? (
          <div className="mt-3 rounded-xl p-3" style={{ background: C.bg }}>
            <div className="flex items-center justify-center gap-4">
              <Stepper value={h} onChange={setH} label={m.home.short} />
              <span className="serif text-[18px]" style={{ color: C.mute }}>–</span>
              <Stepper value={a} onChange={setA} label={m.away.short} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setScoreOpen(false)} className="flex-1 h-10 rounded-xl text-[14px] font-semibold" style={{ background: C.card, color: C.ink }}>Annuler</button>
              <button disabled={busy} onClick={() => send(pickOfScore(h, a), h, a)} className="flex-1 h-10 rounded-xl text-[14px] font-semibold" style={{ background: C.ink, color: '#fff' }}>Valider {h}-{a}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setScoreOpen(true)} className="mt-2.5 text-[13px] font-semibold" style={{ color: C.ochreText }}>
            {m.mine?.home !== undefined ? `Ton score : ${m.mine.home}-${m.mine.away} · modifier` : '+ Score exact (facultatif)'}
          </button>
        )
      )}

      <div className="mt-3.5">
        {m.total > 0 ? (
          <>
            <div className="flex h-2 rounded-full overflow-hidden" style={{ background: C.line }}>
              <div style={{ width: `${pct['1']}%`, background: C.ink }} />
              <div style={{ width: `${pct.N}%`, background: C.mute }} />
              <div style={{ width: `${pct['2']}%`, background: C.ochre }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[12px]" style={{ color: C.text2 }}>
              <span>1 · {pct['1']} %</span><span>N · {pct.N} %</span><span>2 · {pct['2']} %</span>
            </div>
            <div className="mt-1 text-[12px]" style={{ color: C.mute }}>
              {m.total} prono{m.total > 1 ? 's' : ''}{m.topScores.length ? ` · scores les plus joués : ${m.topScores.map(s => `${s.score} (${s.n})`).join(', ')}` : ''}
            </div>
          </>
        ) : <div className="text-[12px]" style={{ color: C.mute }}>{m.open ? 'Sois le premier à donner ton prono.' : 'Aucun prono sur ce match.'}</div>}
      </div>
    </div>
  );
};

const Pronos: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<PronoMatch[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [comp, setComp] = useState('all');
  const [toast, setToast] = useState<string | null>(null);

  const load = () => { setFailed(false); listPronos().then(setItems).catch(() => setFailed(true)); };
  useEffect(load, []);

  const shown = useMemo(() => (items || []).filter(m => comp === 'all' || m.comp === comp), [items, comp]);
  const groups = useMemo(() => {
    const g: { key: string; label: string; list: PronoMatch[] }[] = [];
    // Les matchs à venir d'abord, puis ceux d'hier et d'avant-hier
    const upcoming = shown.filter(m => !isFinished(m.status));
    const past = shown.filter(m => isFinished(m.status)).reverse();
    for (const m of [...upcoming, ...past]) {
      const key = (isFinished(m.status) ? 'p' : 'u') + dayKey(m.utcDate);
      let grp = g.find(x => x.key === key);
      if (!grp) g.push(grp = { key, label: (isFinished(m.status) ? 'Résultats · ' : '') + dayLabel(m.utcDate), list: [] });
      grp.list.push(m);
    }
    return g;
  }, [shown]);
  const present = new Set((items || []).map(m => m.comp));

  return (
    <Screen>
      <TopBar onBack={onBack} title="Pronos foot" />
      <div className="px-5 pb-10">
        <Note>Tes pronos sont anonymes : chacun ne voit que les tendances de tous. Les pronos ferment au coup d'envoi.</Note>
        {items && items.length > 0 && (
          <div className="mt-4 -mx-5 px-5 overflow-x-auto">
            <Chips value={comp} onChange={setComp} options={[{ id: 'all', label: 'Tout' }, ...COMPETITIONS.filter(c => present.has(c.code)).map(c => ({ id: c.code, label: c.short }))]} />
          </div>
        )}
        {failed ? (
          <div className="mt-6 text-center text-[14px]" style={{ color: C.mute }}>
            Impossible de charger les matchs. <button onClick={load} className="font-semibold underline" style={{ color: C.ink }}>Réessayer</button>
          </div>
        ) : !items ? (
          <div className="mt-4 flex flex-col gap-3"><Skeleton h={170} /><Skeleton h={170} /><Skeleton h={170} /></div>
        ) : !shown.length ? (
          <div className="mt-8 text-center text-[14px]" style={{ color: C.mute }}>Pas de match dans les prochains jours.</div>
        ) : groups.map(g => (
          <div key={g.key} className="mt-6">
            <div className="text-[13px] font-bold mb-2.5" style={{ color: C.text2 }}>{g.label}</div>
            <div className="flex flex-col gap-3">
              {g.list.map(m => (
                <MatchCard key={m.id} m={m} onError={setToast}
                  onSaved={nm => setItems(list => (list || []).map(x => (x.id === nm.id ? nm : x)))} />
              ))}
            </div>
          </div>
        ))}
        <p className="mt-8 text-[11.5px] leading-relaxed text-center" style={{ color: C.mute }}>
          Pour le plaisir, entre proches. Les jeux d'argent sont interdits aux mineurs. Jouer comporte des risques : endettement, dépendance… Appelez le 09 74 75 13 13 (appel non surtaxé).
        </p>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

export default Pronos;
